// artifacts/api-server/src/routes/payments.ts
import { Router, type IRouter } from "express";
import { db, courseEnrollmentsTable, coursePackagesTable, paymentSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import https from "https";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getMidtransConfig() {
  try {
    const [row] = await db
      .select()
      .from(paymentSettingsTable)
      .where(eq(paymentSettingsTable.provider, "midtrans"))
      .limit(1);
    if (!row || !row.isEnabled) return null;
    const cfg = JSON.parse(row.config || "{}");
    if (!cfg.serverKey) return null;
    return {
      serverKey: cfg.serverKey as string,
      clientKey: cfg.clientKey as string,
      isProduction: !!cfg.isProduction,
    };
  } catch {
    return null;
  }
}

function midtransRequest(
  path: string,
  method: string,
  serverKey: string,
  isProduction: boolean,
  body?: object
): Promise<any> {
  const host = isProduction
    ? "app.midtrans.com"
    : "app.sandbox.midtrans.com";
  const auth = Buffer.from(serverKey + ":").toString("base64");
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── POST /payments/midtrans/snap ─────────────────────────────────────────────
// Called from course-page.tsx enrollment form
router.post("/payments/midtrans/snap", async (req, res): Promise<void> => {
  try {
    const { courseId, packageId, name, email, phone } = req.body;

    if (!courseId || !packageId || !name || !email) {
      res.status(400).json({ error: "Data tidak lengkap" });
      return;
    }

    // Fetch package price
    const [pkg] = await db
      .select()
      .from(coursePackagesTable)
      .where(eq(coursePackagesTable.id, packageId))
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "Paket tidak ditemukan" });
      return;
    }

    const price = Number(pkg.price);

    // Create enrollment record first
    const orderId = `FC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const [enrollment] = await db
      .insert(courseEnrollmentsTable)
      .values({
        courseId,
        packageId,
        name,
        email,
        phone: phone || null,
        status: "pending",
        paymentStatus: price === 0 ? "paid" : "unpaid",
        midtransOrderId: orderId,
        paidAt: price === 0 ? new Date() : null,
      })
      .returning();

    // Free package — skip payment
    if (price === 0) {
      res.json({ free: true, enrollmentId: enrollment.id });
      return;
    }

    // Get Midtrans config
    const cfg = await getMidtransConfig();
    if (!cfg) {
      // No gateway configured — admin will confirm manually
      res.json({ noGateway: true, enrollmentId: enrollment.id });
      return;
    }

    // Create Midtrans Snap transaction
    const snapBody = {
      transaction_details: {
        order_id: orderId,
        gross_amount: Math.round(price),
      },
      customer_details: {
        first_name: name,
        email,
        phone: phone || undefined,
      },
      item_details: [
        {
          id: pkg.id,
          price: Math.round(price),
          quantity: 1,
          name: pkg.name,
        },
      ],
      callbacks: {
        finish: `${process.env.APP_URL || ""}/portal/${enrollment.id}`,
      },
    };

    const snapResult = await midtransRequest(
      "/snap/v1/transactions",
      "POST",
      cfg.serverKey,
      cfg.isProduction,
      snapBody
    );

    if (!snapResult.token) {
      console.error("Midtrans snap error:", snapResult);
      res.json({ noGateway: true, enrollmentId: enrollment.id });
      return;
    }

    // Update enrollment with token
    await db
      .update(courseEnrollmentsTable)
      .set({ paymentToken: snapResult.token })
      .where(eq(courseEnrollmentsTable.id, enrollment.id));

    res.json({
      snapToken: snapResult.token,
      isProduction: cfg.isProduction,
      enrollmentId: enrollment.id,
    });
  } catch (err) {
    console.error("Payment snap error:", err);
    res.status(500).json({ error: "Gagal membuat transaksi" });
  }
});

// ── POST /payments/midtrans/notification ─────────────────────────────────────
// Midtrans webhook — update enrollment payment status
router.post(
  "/payments/midtrans/notification",
  async (req, res): Promise<void> => {
    try {
      const { order_id, transaction_status, fraud_status, gross_amount } =
        req.body;
      if (!order_id) {
        res.status(400).json({ error: "Missing order_id" });
        return;
      }

      const isPaid =
        transaction_status === "settlement" ||
        (transaction_status === "capture" && fraud_status === "accept");
      const isFailed =
        transaction_status === "deny" ||
        transaction_status === "cancel" ||
        transaction_status === "expire";

      const [enrollment] = await db
        .select()
        .from(courseEnrollmentsTable)
        .where(eq(courseEnrollmentsTable.midtransOrderId, order_id))
        .limit(1);

      if (!enrollment) {
        res.status(404).json({ error: "Enrollment not found" });
        return;
      }

      if (isPaid) {
        await db
          .update(courseEnrollmentsTable)
          .set({
            paymentStatus: "paid",
            status: "active",
            paidAt: new Date(),
          })
          .where(eq(courseEnrollmentsTable.id, enrollment.id));
      } else if (isFailed) {
        await db
          .update(courseEnrollmentsTable)
          .set({ paymentStatus: "failed" })
          .where(eq(courseEnrollmentsTable.id, enrollment.id));
      }

      res.json({ status: "ok" });
    } catch (err) {
      console.error("Midtrans notification error:", err);
      res.status(500).json({ error: "Notification processing failed" });
    }
  }
);

// ── GET /payments/enrollment/:id ─────────────────────────────────────────────
// Check enrollment status (used by portal page)
router.get("/payments/enrollment/:id", async (req, res): Promise<void> => {
  try {
    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, req.params.id))
      .limit(1);

    if (!enrollment) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
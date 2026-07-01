// artifacts/api-server/src/routes/payments.ts
// COMPLETE - Better logging, polling endpoint, reliable activation

import { Router, type IRouter } from "express";
import {
  db,
  courseEnrollmentsTable,
  coursePackagesTable,
  paymentSettingsTable,
  type PaymentSetting,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import https from "https";
import crypto from "crypto";
import { activateCourseEnrollment } from "../lib/course-access.js";

const router: IRouter = Router();
const LOG = "[PAYMENTS]";

// ─── Midtrans helpers ─────────────────────────────────────────────────────────

interface MidtransConfig {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
}

async function getMidtransConfig(): Promise<MidtransConfig | null> {
  try {
    const [row] = await db
      .select()
      .from(paymentSettingsTable)
      .where(eq(paymentSettingsTable.provider, "midtrans"))
      .limit(1);

    if (!row?.isEnabled) return null;
    const cfg = JSON.parse(row.config || "{}");
    if (!cfg.serverKey?.trim()) return null;

    return {
      serverKey:    cfg.serverKey.trim(),
      clientKey:    (cfg.clientKey || "").trim(),
      isProduction: cfg.isProduction === "true" || cfg.isProduction === true,
    };
  } catch (err) {
    console.error(`${LOG} getMidtransConfig error:`, err);
    return null;
  }
}

async function getContactWhatsApp(): Promise<string> {
  try {
    const rows = await db.select().from(paymentSettingsTable);
    const wa = rows.find((r: PaymentSetting) => r.provider === "whatsapp" || r.provider === "contact");
    if (wa) {
      const cfg = JSON.parse(wa.config || "{}");
      const num = (cfg.phoneNumber || cfg.whatsapp || "").replace(/\D/g, "");
      if (num) return num;
    }
  } catch {}
  return process.env.WA_NUMBER || "6281234567890";
}

function midtransRequest(
  path: string,
  method: string,
  serverKey: string,
  isProduction: boolean,
  body?: object,
): Promise<any> {
  const host    = isProduction ? "app.midtrans.com" : "app.sandbox.midtrans.com";
  const auth    = Buffer.from(serverKey + ":").toString("base64");
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host, port: 443, path, method,
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Basic ${auth}`,
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data",  chunk => (data += chunk));
        res.on("end",   () => {
          try { resolve(JSON.parse(data)); } catch { resolve(data); }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function verifySignature(
  orderId: string, statusCode: string, grossAmount: string,
  serverKey: string, received: string,
): boolean {
  const expected = crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
  return expected === received;
}

function isPaid(ts: string, fs?: string) {
  return ts === "settlement" || (ts === "capture" && (!fs || fs === "accept"));
}
function isFailed(ts: string) {
  return ts === "deny" || ts === "cancel" || ts === "expire";
}

// ─── POST /payments/midtrans/snap ─────────────────────────────────────────────

router.post("/payments/midtrans/snap", async (req, res): Promise<void> => {
  try {
    const { courseId: rawCourseId, packageId, name, email, phone } =
      req.body as Record<string, string | undefined>;

    console.log(`${LOG} [SNAP] request:`, { packageId, email });

    if (!packageId || !name || !email) {
      res.status(400).json({ error: "packageId, name, email wajib diisi" });
      return;
    }

    const [pkg] = await db
      .select()
      .from(coursePackagesTable)
      .where(eq(coursePackagesTable.id, packageId))
      .limit(1);

    if (!pkg) {
      res.status(404).json({ error: "Paket tidak ditemukan" });
      return;
    }

    const courseId = String(pkg.courseId || rawCourseId || "");
    if (!courseId) {
      res.status(400).json({ error: "courseId tidak ditemukan" });
      return;
    }

    const price   = Number(pkg.price);
    const orderId = `FC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Buat enrollment
    let enrollment: any;
    try {
      const [row] = await db
        .insert(courseEnrollmentsTable)
        .values({
          courseId,
          packageId,
          name:            name.trim(),
          email:           email.trim().toLowerCase(),
          phone:           phone?.trim() || null,
          status:          "pending",
          paymentStatus:   price === 0 ? "paid" : "unpaid",
          midtransOrderId: orderId,
          paidAt:          price === 0 ? new Date() : null,
        })
        .returning();
      enrollment = row;
      console.log(`${LOG} [SNAP] enrollment created: ${enrollment.id}`);
    } catch (err: any) {
      console.error(`${LOG} [SNAP] insert failed:`, err?.message);
      res.status(500).json({ error: `Gagal menyimpan pendaftaran: ${err?.message || "DB error"}` });
      return;
    }

    // Gratis — langsung aktifkan
    if (price === 0) {
      try {
        const activated = await activateCourseEnrollment(enrollment.id, { paidAt: new Date() });
        res.json({ free: true, enrollmentId: activated.id, memberCode: (activated as any).memberCode, status: "paid" });
      } catch (err: any) {
        res.status(500).json({ error: "Gagal mengaktifkan akses gratis" });
      }
      return;
    }

    // Cek Midtrans config
    const cfg = await getMidtransConfig();
    if (!cfg) {
      const waNumber = await getContactWhatsApp();
      console.warn(`${LOG} [SNAP] Midtrans tidak terkonfigurasi, fallback WA`);
      res.json({ noGateway: true, enrollmentId: enrollment.id, waNumber });
      return;
    }

    // Request Snap token
    const snapBody = {
      transaction_details: { order_id: orderId, gross_amount: Math.round(price) },
      customer_details:    { first_name: name.trim(), email: email.trim().toLowerCase(), phone: phone?.trim() || undefined },
      item_details:        [{ id: pkg.id, price: Math.round(price), quantity: 1, name: pkg.name }],
      callbacks:           { finish: `${process.env.APP_URL || ""}/portal/${enrollment.id}` },
    };

    const snapResult = await midtransRequest("/snap/v1/transactions", "POST", cfg.serverKey, cfg.isProduction, snapBody);

    if (!snapResult?.token) {
      console.error(`${LOG} [SNAP] no token:`, snapResult);
      const waNumber = await getContactWhatsApp();
      res.json({ noGateway: true, enrollmentId: enrollment.id, waNumber });
      return;
    }

    // Simpan payment token (non-critical)
    try {
      await db
        .update(courseEnrollmentsTable)
        .set({ paymentToken: snapResult.token } as any)
        .where(eq(courseEnrollmentsTable.id, enrollment.id));
    } catch {}

    console.log(`${LOG} [SNAP] ✓ snap token created for enrollment ${enrollment.id}`);
    res.json({
      snapToken:    snapResult.token,
      isProduction: cfg.isProduction,
      clientKey:    cfg.clientKey,
      enrollmentId: enrollment.id,
    });
  } catch (err) {
    console.error(`${LOG} [SNAP] unhandled:`, err);
    res.status(500).json({ error: "Gagal membuat transaksi. Coba lagi." });
  }
});

// ─── POST /payments/midtrans/notification ─────────────────────────────────────
// Server-to-server webhook dari Midtrans (AUTHORITATIVE)

router.post("/payments/midtrans/notification", async (req, res): Promise<void> => {
  try {
    const { order_id, transaction_status, fraud_status, gross_amount, status_code, signature_key } =
      req.body as Record<string, string>;

    console.log(`${LOG} [WEBHOOK] notification:`, { order_id, transaction_status });

    if (!order_id) {
      res.status(400).json({ error: "Missing order_id" });
      return;
    }

    // Verifikasi signature
    if (signature_key) {
      const cfg = await getMidtransConfig();
      if (cfg) {
        const valid = verifySignature(order_id, status_code, gross_amount, cfg.serverKey, signature_key);
        if (!valid) {
          console.error(`${LOG} [WEBHOOK] invalid signature for order: ${order_id}`);
          res.status(400).json({ error: "Invalid signature" });
          return;
        }
      }
    }

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.midtransOrderId, order_id))
      .limit(1);

    if (!enrollment) {
      console.warn(`${LOG} [WEBHOOK] enrollment not found for order: ${order_id}`);
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }

    if (isPaid(transaction_status, fraud_status)) {
      console.log(`${LOG} [WEBHOOK] payment settled for enrollment: ${enrollment.id}`);
      try {
        await activateCourseEnrollment(enrollment.id, {
          method: (req.body as any).payment_type || "midtrans",
          raw:    req.body,
          paidAt: new Date(),
        });
        console.log(`${LOG} [WEBHOOK] ✓ activated: ${enrollment.id}`);
      } catch (err: any) {
        console.error(`${LOG} [WEBHOOK] activation failed:`, err?.message);
        // Fallback: minimal update supaya tidak retry terus dari Midtrans
        await db
          .update(courseEnrollmentsTable)
          .set({ paymentStatus: "paid", status: "active", updatedAt: new Date() } as any)
          .where(eq(courseEnrollmentsTable.id, enrollment.id));
      }
    } else if (isFailed(transaction_status)) {
      console.log(`${LOG} [WEBHOOK] payment failed (${transaction_status}) for: ${enrollment.id}`);
      await db
        .update(courseEnrollmentsTable)
        .set({ paymentStatus: "failed", updatedAt: new Date() } as any)
        .where(eq(courseEnrollmentsTable.id, enrollment.id));
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error(`${LOG} [WEBHOOK] unhandled:`, err);
    res.status(500).json({ error: "Notification processing failed" });
  }
});

// ─── GET /payments/enrollment/:id ─────────────────────────────────────────────

router.get("/payments/enrollment/:id", async (req, res): Promise<void> => {
  try {
    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, req.params.id))
      .limit(1);

    if (!enrollment) {
      res.status(404).json({ error: "Enrollment tidak ditemukan" });
      return;
    }
    res.json(enrollment);
  } catch (err) {
    console.error(`${LOG} [GET enrollment/:id]`, err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /payments/enrollment/:id/check-status ────────────────────────────────
// POLLING endpoint — frontend call ini setelah Snap popup tutup

router.get("/payments/enrollment/:id/check-status", async (req, res): Promise<void> => {
  try {
    const enrollmentId = req.params.id;
    console.log(`${LOG} [CHECK-STATUS] poll: ${enrollmentId}`);

    const [enrollment] = await db
      .select()
      .from(courseEnrollmentsTable)
      .where(eq(courseEnrollmentsTable.id, enrollmentId))
      .limit(1);

    if (!enrollment) {
      res.status(404).json({ error: "Enrollment not found" });
      return;
    }

    // Sudah aktif
    if (enrollment.paymentStatus === "paid" && enrollment.status === "active") {
      res.json({
        status: "paid",
        enrollmentId,
        memberCode: (enrollment as any).memberCode,
        message:    "Akses sudah aktif!",
      });
      return;
    }

    // Gagal
    if (enrollment.paymentStatus === "failed") {
      res.json({ status: "failed", enrollmentId, message: "Pembayaran ditolak. Silakan coba lagi." });
      return;
    }

    // Cek langsung ke Midtrans
    const cfg = await getMidtransConfig();
    if (!cfg || !(enrollment as any).midtransOrderId) {
      res.json({ status: "pending", enrollmentId, message: "Pembayaran sedang diproses..." });
      return;
    }

    const mtStatus = await midtransRequest(
      `/v2/${(enrollment as any).midtransOrderId}/status`,
      "GET",
      cfg.serverKey,
      cfg.isProduction,
    );

    const ts = mtStatus?.transaction_status;
    const fs = mtStatus?.fraud_status;
    console.log(`${LOG} [CHECK-STATUS] Midtrans status: ${ts} for ${enrollmentId}`);

    if (isPaid(ts, fs)) {
      // Aktifkan enrollment
      const activated = await activateCourseEnrollment(enrollmentId, {
        method: mtStatus?.payment_type || "midtrans",
        raw:    mtStatus,
        paidAt: new Date(),
      });
      res.json({
        status:      "paid",
        enrollmentId,
        memberCode:  (activated as any).memberCode,
        message:     "✓ Pembayaran berhasil! Akses aktif sekarang.",
      });
      return;
    }

    if (isFailed(ts)) {
      await db
        .update(courseEnrollmentsTable)
        .set({ paymentStatus: "failed", updatedAt: new Date() } as any)
        .where(eq(courseEnrollmentsTable.id, enrollmentId));
      res.json({ status: "failed", enrollmentId, message: "Pembayaran ditolak atau expired." });
      return;
    }

    res.json({ status: "pending", enrollmentId, transactionStatus: ts, message: "Pembayaran sedang diproses..." });
  } catch (err: any) {
    console.error(`${LOG} [CHECK-STATUS] error:`, err);
    res.status(500).json({ error: "Gagal memeriksa status pembayaran" });
  }
});

// ─── GET /payments/config ─────────────────────────────────────────────────────

router.get("/payments/config", async (_req, res): Promise<void> => {
  try {
    const cfg      = await getMidtransConfig();
    const waNumber = await getContactWhatsApp();
    res.json({
      midtrans: cfg
        ? { clientKey: cfg.clientKey, isProduction: cfg.isProduction, enabled: true }
        : { enabled: false },
      waNumber,
    });
  } catch (err) {
    console.error(`${LOG} [GET /config]`, err);
    res.json({ midtrans: { enabled: false }, waNumber: "6281234567890" });
  }
});

// ─── POST /payments/activate/:enrollmentId — admin manual ────────────────────

router.post("/payments/activate/:enrollmentId", async (req, res): Promise<void> => {
  try {
    const id = String(req.params.enrollmentId);
    console.log(`${LOG} [MANUAL ACTIVATE] admin activation: ${id}`);
    const activated = await activateCourseEnrollment(id, { method: "manual", paidAt: new Date() });
    res.json({ ok: true, enrollment: activated });
  } catch (err: any) {
    console.error(`${LOG} [MANUAL ACTIVATE] error:`, err);
    res.status(500).json({ error: err.message || "Activation failed" });
  }
});

export default router;
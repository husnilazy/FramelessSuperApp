import { Router, type IRouter } from "express";
import { db, courseEnrollmentsTable, coursePackagesTable, paymentSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

async function getMidtransConfig() {
  const rows = await db.select().from(paymentSettingsTable).where(eq(paymentSettingsTable.provider, "midtrans")).limit(1);
  if (!rows[0]) return null;
  try { return { ...JSON.parse(rows[0].config || "{}"), isEnabled: rows[0].isEnabled }; } catch { return null; }
}

// Create Midtrans Snap transaction
router.post("/payments/midtrans/snap", async (req, res): Promise<void> => {
  const { courseId, packageId, name, email, phone } = req.body;
  if (!courseId || !packageId || !name || !email) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }

  // Get package price
  const [pkg] = await db.select().from(coursePackagesTable).where(eq(coursePackagesTable.id, packageId)).limit(1);
  if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }

  const price = Number(pkg.price);

  // Create enrollment record first
  const orderId = `FRAME-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const [enrollment] = await db.insert(courseEnrollmentsTable).values({
    courseId, packageId, name, email, phone: phone || null,
    status: "pending", paymentStatus: price === 0 ? "paid" : "unpaid",
    midtransOrderId: orderId,
  }).returning();

  // Free package — skip Midtrans
  if (price === 0) {
    await db.update(courseEnrollmentsTable).set({ status: "active", paymentStatus: "paid", paidAt: new Date() }).where(eq(courseEnrollmentsTable.id, enrollment.id));
    res.json({ enrollmentId: enrollment.id, free: true });
    return;
  }

  const config = await getMidtransConfig();
  if (!config?.serverKey) {
    // Fallback: create pending enrollment without Midtrans
    res.json({ enrollmentId: enrollment.id, noGateway: true });
    return;
  }

  const isProduction = config.isProduction === "true";
  const baseUrl = isProduction ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const authKey = Buffer.from(config.serverKey + ":").toString("base64");

  try {
    const snapRes = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${authKey}` },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: Math.round(price) },
        customer_details: { first_name: name, email, phone: phone || "" },
        item_details: [{ id: packageId, price: Math.round(price), quantity: 1, name: pkg.name }],
        callbacks: { finish: `${req.headers.origin}/portal/${enrollment.id}` },
      }),
    });
    const snapData = await snapRes.json() as any;
    if (!snapRes.ok) {
      req.log.error({ snapData }, "Midtrans error");
      res.json({ enrollmentId: enrollment.id, noGateway: true });
      return;
    }
    await db.update(courseEnrollmentsTable).set({ paymentToken: snapData.token }).where(eq(courseEnrollmentsTable.id, enrollment.id));
    res.json({ enrollmentId: enrollment.id, snapToken: snapData.token, isProduction });
  } catch (err) {
    req.log.error({ err }, "Midtrans fetch error");
    res.json({ enrollmentId: enrollment.id, noGateway: true });
  }
});

// Midtrans webhook notification
router.post("/payments/midtrans/notify", async (req, res): Promise<void> => {
  const { order_id, transaction_status, fraud_status, signature_key, gross_amount, status_code } = req.body;

  const config = await getMidtransConfig();
  if (config?.serverKey) {
    const expectedSig = crypto.createHash("sha512")
      .update(`${order_id}${status_code}${gross_amount}${config.serverKey}`)
      .digest("hex");
    if (signature_key !== expectedSig) {
      res.status(401).json({ error: "Invalid signature" }); return;
    }
  }

  const isPaid = (transaction_status === "capture" && fraud_status === "accept") ||
    transaction_status === "settlement";

  if (isPaid) {
    await db.update(courseEnrollmentsTable).set({
      paymentStatus: "paid", status: "active", paidAt: new Date(),
    }).where(eq(courseEnrollmentsTable.midtransOrderId, order_id));
  } else if (transaction_status === "expire" || transaction_status === "cancel") {
    await db.update(courseEnrollmentsTable).set({ paymentStatus: "failed", status: "cancelled" })
      .where(eq(courseEnrollmentsTable.midtransOrderId, order_id));
  }

  res.json({ ok: true });
});

// Check payment status
router.get("/payments/status/:enrollmentId", async (req, res): Promise<void> => {
  const [enrollment] = await db.select().from(courseEnrollmentsTable).where(eq(courseEnrollmentsTable.id, req.params.enrollmentId)).limit(1);
  if (!enrollment) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ status: enrollment.status, paymentStatus: enrollment.paymentStatus });
});

export default router;

import { Router, type IRouter } from "express";
import { db, companyProfileTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();
const DEFAULT_ID = "default";

async function ensureRow() {
  const [row] = await db.select().from(companyProfileTable).where(eq(companyProfileTable.id, DEFAULT_ID)).limit(1);
  if (row) return row;
  const [created] = await db.insert(companyProfileTable).values({ id: DEFAULT_ID }).returning();
  return created;
}

// Hanya nama & logo — aman untuk halaman login / publik.
router.get("/public/brand", async (_req, res): Promise<void> => {
  try {
    const row = await ensureRow();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ companyName: row.companyName, tagline: row.tagline, logoUrl: row.logoUrl, logoDarkUrl: (row as any).logoDarkUrl ?? null });
  } catch (err) {
    logger.error({ err }, "public-brand.get.error");
    res.status(500).json({ error: "Failed to fetch brand" });
  }
});

router.get("/company-profile", async (_req, res): Promise<void> => {
  try {
    const row = await ensureRow();
    res.json(mapProfile(row));
  } catch (err) {
    logger.error({ err }, "company-profile.get.error");
    res.status(500).json({ error: "Failed to fetch company profile" });
  }
});

router.put("/company-profile", async (req, res): Promise<void> => {
  try {
    await ensureRow();
    const { companyName, tagline, address, email, phone, website, logoUrl, logoDarkUrl, bankName, bankNumber, bankHolder, signerName } = req.body ?? {};
    const [row] = await db.update(companyProfileTable).set({
      ...(companyName !== undefined && { companyName: String(companyName) }),
      ...(tagline !== undefined && { tagline: String(tagline) }),
      ...(address !== undefined && { address: String(address) }),
      ...(email !== undefined && { email: String(email) }),
      ...(phone !== undefined && { phone: String(phone) }),
      ...(website !== undefined && { website: String(website) }),
      ...(logoUrl !== undefined && { logoUrl: logoUrl ? String(logoUrl) : null }),
      ...(logoDarkUrl !== undefined && { logoDarkUrl: logoDarkUrl ? String(logoDarkUrl) : null }),
      ...(bankName !== undefined && { bankName: String(bankName) || null }),
      ...(bankNumber !== undefined && { bankNumber: String(bankNumber) || null }),
      ...(bankHolder !== undefined && { bankHolder: String(bankHolder) || null }),
      ...(signerName !== undefined && { signerName: String(signerName) || null }),
      updatedAt: new Date(),
    }).where(eq(companyProfileTable.id, DEFAULT_ID)).returning();
    res.json(mapProfile(row));
  } catch (err) {
    logger.error({ err }, "company-profile.put.error");
    res.status(500).json({ error: "Failed to update company profile" });
  }
});

function mapProfile(p: any) {
  return {
    companyName: p.companyName, tagline: p.tagline, address: p.address,
    email: p.email, phone: p.phone, website: p.website, logoUrl: p.logoUrl, logoDarkUrl: p.logoDarkUrl ?? null,
    bankName: p.bankName ?? null, bankNumber: p.bankNumber ?? null, bankHolder: p.bankHolder ?? null, signerName: p.signerName ?? null,
    updatedAt: p.updatedAt,
  };
}

export default router;
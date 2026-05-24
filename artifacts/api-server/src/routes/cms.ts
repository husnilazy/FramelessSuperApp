import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cmsSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

router.get("/cms", async (req, res): Promise<void> => {
  const rows = await db.select().from(cmsSettingsTable).orderBy(cmsSettingsTable.section);
  const grouped: Record<string, Record<string, string>> = {};
  for (const r of rows) {
    if (!grouped[r.section]) grouped[r.section] = {};
    grouped[r.section][r.key] = r.value;
  }
  res.json(grouped);
});

router.put("/cms", requireAuth, async (req, res): Promise<void> => {
  const updates: { section: string; key: string; value: string }[] = req.body;
  if (!Array.isArray(updates)) { res.status(400).json({ error: "Array required" }); return; }
  for (const u of updates) {
    const existing = await db.select().from(cmsSettingsTable)
      .where(and(eq(cmsSettingsTable.section, u.section), eq(cmsSettingsTable.key, u.key)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(cmsSettingsTable).set({ value: u.value, updatedAt: new Date() })
        .where(and(eq(cmsSettingsTable.section, u.section), eq(cmsSettingsTable.key, u.key)));
    } else {
      await db.insert(cmsSettingsTable).values({ section: u.section, key: u.key, value: u.value });
    }
  }
  res.json({ success: true });
});

// POST /cms/inquiry — simpan atau kirim email inquiry
router.post("/cms/inquiry", async (req, res): Promise<void> => {
  try {
    const { name, email, phone, message, service, slug } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: "Nama dan email wajib diisi" });
      return;
    }

    // Log inquiry (bisa ditambahkan ke DB atau dikirim via email)
    console.log(`[Inquiry] ${new Date().toISOString()}`);
    console.log(`  Service: ${service || "General"}`);
    console.log(`  Name   : ${name}`);
    console.log(`  Email  : ${email}`);
    console.log(`  Phone  : ${phone || "-"}`);
    console.log(`  Message: ${message || "-"}`);

    // TODO: Kirim email notifikasi ke admin menggunakan nodemailer
    // atau simpan ke database jika ada tabel inquiry

    res.json({ success: true, message: "Inquiry diterima" });
  } catch (err) {
    console.error("[inquiry] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

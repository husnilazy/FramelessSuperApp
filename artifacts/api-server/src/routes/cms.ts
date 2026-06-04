import { Router, type IRouter } from "express";
import { db, cmsSettingsTable, pool } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "./middleware.js";
import crypto from "crypto";

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
    const { name, email, phone, company, message, service, budget, timeline, preferred, slug } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: "Nama dan email wajib diisi" });
      return;
    }

    // Log inquiry
    console.log(`[Inquiry] ${new Date().toISOString()}`);
    console.log(`  Service: ${service || "General"}`);
    console.log(`  Name   : ${name}`);
    console.log(`  Email  : ${email}`);
    console.log(`  Phone  : ${phone || "-"}`);
    console.log(`  Company: ${company || "-"}`);
    console.log(`  Budget : ${budget || "-"}`);
    console.log(`  Timeline: ${timeline || "-"}`);
    console.log(`  Preferred: ${preferred || "-"}`);
    console.log(`  Message: ${message || "-"}`);

    // Auto-create prospect client for admin follow-up (ROBUST raw SQL only - survives missing columns / schema drift)
    // Always creates visible row with rich [INQUIRY] notes so it shows as LEAD even before ALTER TABLE
    if (!pool) {
      console.warn("[inquiry] No pool, skipping client auto-create (inquiry still accepted)");
    } else {
      try {
        // SAFE existing check: ONLY core columns that always exist
        const existingRes = await pool.query(
          `SELECT id, name, email, phone, company, notes FROM clients WHERE lower(email) = lower($1) LIMIT 1`,
          [email]
        );
        const existing = existingRes.rows[0];
        const clientId = existing?.id || crypto.randomUUID();

        const inquiryNote = [
          `--- Inquiry ${new Date().toISOString().slice(0, 10)} ---`,
          `Service: ${service || "General"}`,
          budget ? `Budget: ${budget}` : "",
          timeline ? `Timeline: ${timeline}` : "",
          preferred ? `Preferred Contact: ${preferred}` : "",
          message ? `Message: ${message}` : "",
          slug ? `Source: ${slug}` : ""
        ].filter(Boolean).join("\n");

        if (existing) {
          // append to notes + best effort categories
          const prevNotes = existing.notes || "";
          const newNotes = prevNotes ? `${prevNotes}\n\n${inquiryNote}` : inquiryNote;
          // try full (with status/tier) then fallback to core only
          try {
            await pool.query(
              `UPDATE clients SET notes = $1, phone = COALESCE($2, phone), company = COALESCE($3, company), status = COALESCE(status, 'prospect'), tier = COALESCE(tier, 'new'), "updatedAt" = now() WHERE id = $4`,
              [newNotes, phone || null, company || null, clientId]
            );
          } catch (updErr) {
            console.error("[inquiry] update with status/tier failed, core only:", updErr);
            try {
              await pool.query(
                `UPDATE clients SET notes = $1, phone = COALESCE($2, phone), company = COALESCE($3, company), "updatedAt" = now() WHERE id = $4`,
                [newNotes, phone || null, company || null, clientId]
              );
            } catch (coreUpdErr) {
              console.error("[inquiry] core update failed:", coreUpdErr);
            }
          }
          console.log(`[Inquiry] Appended to existing client ${clientId}`);
        } else {
          // NEW: try rich insert (status/tier) -> fallback core (always at least name+email+notes with Inquiry marker)
          let inserted = false;
          try {
            await pool.query(
              `INSERT INTO clients (id, name, email, phone, company, notes, status, tier)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [clientId, name, email, phone || null, company || null, inquiryNote, "prospect", "new"]
            );
            inserted = true;
            console.log(`[Inquiry] Created new client (rich) ${clientId}`);
          } catch (richErr) {
            console.error("[inquiry] Rich insert (w/ status tier) failed, trying core only:", richErr);
            try {
              await pool.query(
                `INSERT INTO clients (id, name, email, phone, company, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [clientId, name, email, phone || null, company || null, inquiryNote]
              );
              inserted = true;
              console.log(`[Inquiry] Created new client (core) ${clientId}`);
            } catch (coreErr) {
              console.error("[inquiry] Core insert failed completely:", coreErr);
            }
          }
          // Best-effort: after core insert, try to flip status/tier (no-op if cols missing)
          if (inserted) {
            try {
              await pool.query(`UPDATE clients SET status='prospect', tier='new', "updatedAt"=now() WHERE id=$1`, [clientId]);
            } catch {}
          }
        }
      } catch (dbErr) {
        console.error("[inquiry] Client auto-create error (non-fatal, inquiry accepted):", dbErr);
      }
    }

    // Log to activity for dashboard live feed (new lead / inquiry)
    try {
      const { db: db2, activityLogsTable } = await import("@workspace/db");
      const { randomUUID } = await import("crypto");
      await db2.insert(activityLogsTable).values({
        id: randomUUID(),
        userId: null,
        projectId: null,
        action: "lead.inquiry",
        description: `New inquiry/lead from ${name}${company ? ` (${company})` : ''} - ${service || 'General'}`,
      });
    } catch {}

    // TODO: Kirim email notifikasi ke admin menggunakan nodemailer

    res.json({ success: true, message: "Inquiry diterima. Tim kami akan segera menghubungi Anda." });
  } catch (err) {
    console.error("[inquiry] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

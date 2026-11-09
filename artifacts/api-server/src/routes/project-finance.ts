import { Router, type IRouter, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Keuangan per proyek: pengaturan potongan, alokasi crew per peran, dan bagi hasil margin.
 * Dipasang di bawah prefix "/projects" sehingga otomatis dilindungi guard admin (lihat routes/index.ts).
 * Hanya MENAMBAH tabel baru; tidak mengubah tabel payments/expenses/income_entries/equipment yang dibaca Frameless Hub.
 */
const router: IRouter = Router();

let ready: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS project_finance (
          project_id  TEXT PRIMARY KEY,
          base_amount NUMERIC,
          margin_pct  NUMERIC NOT NULL DEFAULT 20,
          tools_pct   NUMERIC NOT NULL DEFAULT 5,
          direct_pct  NUMERIC NOT NULL DEFAULT 15,
          split       TEXT NOT NULL DEFAULT '[]',
          note        TEXT,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS project_allocations (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL,
          role        TEXT NOT NULL,
          member_id   TEXT,
          person      TEXT NOT NULL DEFAULT '',
          share_pct   NUMERIC NOT NULL DEFAULT 0,
          amount_override NUMERIC,
          paid        BOOLEAN NOT NULL DEFAULT FALSE,
          paid_at     TIMESTAMPTZ,
          note        TEXT,
          sort        INT NOT NULL DEFAULT 0
        )`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS project_alloc_proj ON project_allocations (project_id)`);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

/** Default peran = pembagian bagian crew (persen dari porsi crew), sama dengan kalkulator di Frameless Hub. */
const DEFAULT_ROLES: [string, number][] = [
  ["Produser / PM & klien", 15], ["Director / DOP", 20], ["Kameramen / crew lapangan", 20], ["Editor / post-production", 25],
  ["Gaffer / lighting", 6], ["Artistik", 6], ["Asisten / runner", 8],
];

// GET /projects/:id/finance
router.get("/projects/:id/finance", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const [proj] = rows(await db.execute(sql`SELECT id, title, client, budget FROM projects WHERE id::text = ${id}`));
    if (!proj) { res.status(404).json({ error: "Proyek tidak ditemukan" }); return; }

    const [cfg] = rows(await db.execute(sql`SELECT * FROM project_finance WHERE project_id = ${id}`));
    const allocs = rows(await db.execute(sql`SELECT * FROM project_allocations WHERE project_id = ${id} ORDER BY sort, id`));
    const inv = rows(await db.execute(sql`
      SELECT i.id, i.number, i.status, i.total::float8 AS total, i."paidAmount"::float8 AS paid
        FROM invoices i WHERE i."projectId" = ${id} ORDER BY i."createdAt"`));
    const pays = rows(await db.execute(sql`
      SELECT p.id, p.amount::float8 AS amount, p.method, to_char(p."paidAt", 'YYYY-MM-DD') AS date, i.number
        FROM payments p JOIN invoices i ON i.id = p."invoiceId" WHERE i."projectId" = ${id} ORDER BY p."paidAt"`));
    const exps = rows(await db.execute(sql`
      SELECT id, category, description, amount::float8 AS amount, to_char(date, 'YYYY-MM-DD') AS date
        FROM expenses WHERE "projectId" = ${id} ORDER BY date`));

    const invoiced = inv.reduce((a, r) => a + num(r.total), 0);
    const received = pays.reduce((a, r) => a + num(r.amount), 0);
    const directActual = exps.reduce((a, r) => a + num(r.amount), 0);
    const budget = num(cfg?.base_amount) || num(proj.budget) || invoiced;

    const config = {
      baseAmount: cfg?.base_amount != null ? num(cfg.base_amount) : null,
      marginPct: num(cfg?.margin_pct, 20), toolsPct: num(cfg?.tools_pct, 5), directPct: num(cfg?.direct_pct, 15),
      split: (() => { try { return JSON.parse(cfg?.split || "[]"); } catch { return []; } })() as { name: string; pct: number }[],
      note: cfg?.note ?? "",
    };
    const crewPool = Math.round(budget * (1 - (config.marginPct + config.toolsPct + config.directPct) / 100));
    const allocations = allocs.map((a) => {
      const computed = Math.round((crewPool * num(a.share_pct)) / 100);
      return {
        id: a.id, role: a.role, memberId: a.member_id, person: a.person, sharePct: num(a.share_pct),
        amount: a.amount_override != null ? num(a.amount_override) : computed, computed, overridden: a.amount_override != null,
        paid: !!a.paid, paidAt: a.paid_at, note: a.note ?? "",
      };
    });
    const crewTotal = allocations.reduce((a, r) => a + r.amount, 0);
    const perPerson = new Map<string, { person: string; amount: number; paid: number }>();
    for (const a of allocations) {
      const key = a.person || "(belum ditentukan)";
      const e = perPerson.get(key) ?? { person: key, amount: 0, paid: 0 };
      e.amount += a.amount; if (a.paid) e.paid += a.amount;
      perPerson.set(key, e);
    }
    // Margin nyata = uang diterima - biaya langsung nyata - fee crew - alokasi alat. Dibagi sesuai skema (default seluruhnya kas perusahaan).
    const toolsAmt = Math.round((budget * config.toolsPct) / 100);
    const margin = received - directActual - crewTotal - toolsAmt;
    const split = config.split.length ? config.split : [{ name: "Kas perusahaan", pct: 100 }];
    const marginSplit = split.map((s) => ({ name: s.name, pct: num(s.pct), amount: Math.round((Math.max(0, margin) * num(s.pct)) / 100) }));

    res.json({
      project: { id: proj.id, title: proj.title, client: proj.client, budget: num(proj.budget) },
      config, budget, crewPool, toolsAmt, directPlanned: Math.round((budget * config.directPct) / 100),
      invoiced, received, outstanding: Math.max(0, budget - received), directActual,
      allocations, crewTotal, crewUnallocatedPct: Math.round((100 - allocations.reduce((a, r) => a + r.sharePct, 0)) * 10) / 10,
      perPerson: [...perPerson.values()], margin, marginPct: received > 0 ? (margin / received) * 100 : 0, marginSplit,
      invoices: inv, payments: pays, expenses: exps, defaultRoles: DEFAULT_ROLES.map(([role, pct]) => ({ role, pct })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Gagal memuat keuangan proyek" });
  }
});

// PUT /projects/:id/finance  — simpan pengaturan + seluruh daftar alokasi (diganti utuh).
router.put("/projects/:id/finance", async (req: Request, res: Response): Promise<void> => {
  try {
    await ensureTables();
    const id = String(req.params.id);
    const b = req.body ?? {};
    const c = b.config ?? {};
    const margin = Math.min(90, Math.max(0, num(c.marginPct, 20))), tools = Math.min(90, Math.max(0, num(c.toolsPct, 5))), direct = Math.min(90, Math.max(0, num(c.directPct, 15)));
    if (margin + tools + direct >= 100) { res.status(400).json({ error: "Total potongan harus di bawah 100%." }); return; }
    const base = c.baseAmount === null || c.baseAmount === "" || c.baseAmount === undefined ? null : Math.max(0, num(c.baseAmount));
    const split = (Array.isArray(c.split) ? c.split : []).map((s: any) => ({ name: String(s.name ?? "").slice(0, 60), pct: Math.max(0, num(s.pct)) })).filter((s: any) => s.name);
    if (split.length && Math.abs(split.reduce((a: number, s: any) => a + s.pct, 0) - 100) > 0.5) { res.status(400).json({ error: "Pembagian margin harus berjumlah 100%." }); return; }
    const list = (Array.isArray(b.allocations) ? b.allocations : []).slice(0, 40);
    if (list.reduce((a: number, r: any) => a + Math.max(0, num(r.sharePct)), 0) > 100.5) { res.status(400).json({ error: "Total persen alokasi crew melebihi 100%." }); return; }

    await db.execute(sql`
      INSERT INTO project_finance (project_id, base_amount, margin_pct, tools_pct, direct_pct, split, note, updated_at)
      VALUES (${id}, ${base}, ${margin}, ${tools}, ${direct}, ${JSON.stringify(split)}, ${String(c.note ?? "").slice(0, 500)}, NOW())
      ON CONFLICT (project_id) DO UPDATE SET base_amount = EXCLUDED.base_amount, margin_pct = EXCLUDED.margin_pct, tools_pct = EXCLUDED.tools_pct,
        direct_pct = EXCLUDED.direct_pct, split = EXCLUDED.split, note = EXCLUDED.note, updated_at = NOW()`);
    await db.execute(sql`DELETE FROM project_allocations WHERE project_id = ${id}`);
    for (const [i, r] of list.entries()) {
      const aid = String(r.id || "").startsWith("new-") || !r.id ? crypto.randomUUID() : String(r.id);
      const ov = r.amountOverride === null || r.amountOverride === undefined || r.amountOverride === "" ? null : Math.max(0, num(r.amountOverride));
      await db.execute(sql`
        INSERT INTO project_allocations (id, project_id, role, member_id, person, share_pct, amount_override, paid, paid_at, note, sort)
        VALUES (${aid}, ${id}, ${String(r.role ?? "Crew").slice(0, 80)}, ${r.memberId || null}, ${String(r.person ?? "").slice(0, 80)}, ${Math.max(0, num(r.sharePct))},
                ${ov}, ${!!r.paid}, ${r.paid ? (r.paidAt ? new Date(r.paidAt) : new Date()) : null}, ${String(r.note ?? "").slice(0, 200)}, ${i})`);
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || "Gagal menyimpan keuangan proyek" });
  }
});

export default router;

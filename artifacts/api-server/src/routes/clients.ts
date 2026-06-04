import { Router, type IRouter } from "express";
import { db, clientsTable, pool } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };
  let rows: any[] = [];
  if (pool) {
    const searchSql = search
      ? `WHERE lower(name) LIKE lower($1) OR lower(email) LIKE lower($1) OR lower(COALESCE(company,'')) LIKE lower($1)`
      : "";
    const params = search ? [`%${search}%`] : [];
    try {
      // try with category columns (website/status/tier) - works after ALTER
      const { rows: full } = await pool.query(
        `SELECT id, name, email, phone, company, address, notes, website, status, tier, "createdAt"
         FROM clients ${searchSql}
         ORDER BY "createdAt" DESC NULLS LAST`,
        params
      );
      rows = full;
    } catch {
      // fallback: core columns only (survives before ALTER)
      try {
        const { rows: core } = await pool.query(
          `SELECT id, name, email, phone, company, address, notes, "createdAt"
           FROM clients ${searchSql}
           ORDER BY "createdAt" DESC NULLS LAST`,
          params
        );
        rows = core.map((r: any) => ({ ...r, website: null, status: null, tier: null }));
      } catch (e) {
        console.error("[clients] GET list failed even core:", e);
        rows = [];
      }
    }
  } else {
    // last resort drizzle (may still fail on drift)
    try {
      const base = db.select({
        id: clientsTable.id, name: clientsTable.name, email: clientsTable.email,
        phone: clientsTable.phone, company: clientsTable.company, address: clientsTable.address,
        notes: clientsTable.notes, createdAt: clientsTable.createdAt,
      }).from(clientsTable);
      const clients = search
        ? await base.where(or(ilike(clientsTable.name, `%${search}%`), ilike(clientsTable.email, `%${search}%`), ilike(clientsTable.company as any, `%${search}%`)))
        : await base.orderBy(clientsTable.createdAt);
      rows = clients;
    } catch (e) { console.error("[clients] drizzle fallback failed:", e); }
  }
  res.json(rows.map(mapClient));
});

router.post("/clients", async (req, res): Promise<void> => {
  const { name, email, phone, company, address, notes, website, status, tier } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }
  const id = crypto.randomUUID();
  let client: any = null;
  if (pool) {
    // try rich (categories) then core
    try {
      const { rows } = await pool.query(
        `INSERT INTO clients (id, name, email, phone, company, address, notes, website, status, tier)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [id, name, email, phone||null, company||null, address||null, notes||null, website||null, status||"prospect", tier||"new"]
      );
      client = rows[0];
    } catch (richErr) {
      console.error("[clients] POST rich failed, core only:", richErr);
      try {
        const { rows } = await pool.query(
          `INSERT INTO clients (id, name, email, phone, company, address, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [id, name, email, phone||null, company||null, address||null, notes||null]
        );
        client = rows[0];
      } catch (coreErr) {
        console.error("[clients] POST core failed:", coreErr);
      }
    }
  }
  if (!client) {
    // drizzle last resort (will fail if drift)
    try {
      const [c] = await db.insert(clientsTable).values({
        id, name, email, phone: phone||null, company: company||null, address: address||null,
        notes: notes||null, website: website||null, status: status||"prospect", tier: tier||"new",
        createdAt: new Date(), updatedAt: new Date(),
      }).returning();
      client = c;
    } catch (e) { console.error("[clients] POST drizzle fail:", e); }
  }
  if (!client) {
    res.status(500).json({ error: "Failed to create client (check DB columns)" });
    return;
  }
  await logClientActivity("client.created", `Client "${name}" created${company ? ` (${company})` : ''}`);
  res.status(201).json(mapClient(client));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let client: any = null;
  if (pool) {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, email, phone, company, address, notes, website, status, tier, "createdAt" FROM clients WHERE id = $1 LIMIT 1`,
        [id]
      );
      client = rows[0] || null;
    } catch {
      try {
        const { rows } = await pool.query(
          `SELECT id, name, email, phone, company, address, notes, "createdAt" FROM clients WHERE id = $1 LIMIT 1`,
          [id]
        );
        client = rows[0] ? { ...rows[0], website: null, status: null, tier: null } : null;
      } catch (e) { console.error("[clients] single GET core fail:", e); }
    }
  }
  if (!client) {
    try {
      const [c] = await db.select({
        id: clientsTable.id, name: clientsTable.name, email: clientsTable.email,
        phone: clientsTable.phone, company: clientsTable.company, address: clientsTable.address,
        notes: clientsTable.notes, createdAt: clientsTable.createdAt,
      }).from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
      client = c || null;
    } catch {}
  }
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(mapClient(client));
});

router.put("/clients/:id", async (req, res): Promise<void> => {
  await handleClientUpdate(req, res);
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  await handleClientUpdate(req, res);
});

async function handleClientUpdate(req: any, res: any) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email, phone, company, address, notes, website, status, tier } = req.body;
  let client: any = null;
  if (pool) {
    // build dynamic sets safely
    const sets: string[] = [];
    const vals: any[] = [];
    let idx = 1;
    if (name) { sets.push(`name = $${idx++}`); vals.push(name); }
    if (email) { sets.push(`email = $${idx++}`); vals.push(email); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); vals.push(phone); }
    if (company !== undefined) { sets.push(`company = $${idx++}`); vals.push(company); }
    if (address !== undefined) { sets.push(`address = $${idx++}`); vals.push(address); }
    if (notes !== undefined) { sets.push(`notes = $${idx++}`); vals.push(notes); }
    if (website !== undefined) { sets.push(`website = $${idx++}`); vals.push(website); }
    if (status) { sets.push(`status = $${idx++}`); vals.push(status); }
    if (tier) { sets.push(`tier = $${idx++}`); vals.push(tier); }
    sets.push(`"updatedAt" = now()`);
    try {
      const { rows } = await pool.query(
        `UPDATE clients SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
        [...vals, id]
      );
      client = rows[0];
    } catch (richUpd) {
      console.error("[clients] PUT/PATCH rich update failed, core fields only:", richUpd);
      // retry with only guaranteed core fields
      const coreSets: string[] = [];
      const coreVals: any[] = [];
      let cidx = 1;
      if (name) { coreSets.push(`name = $${cidx++}`); coreVals.push(name); }
      if (email) { coreSets.push(`email = $${cidx++}`); coreVals.push(email); }
      if (phone !== undefined) { coreSets.push(`phone = $${cidx++}`); coreVals.push(phone); }
      if (company !== undefined) { coreSets.push(`company = $${cidx++}`); coreVals.push(company); }
      if (address !== undefined) { coreSets.push(`address = $${cidx++}`); coreVals.push(address); }
      if (notes !== undefined) { coreSets.push(`notes = $${cidx++}`); coreVals.push(notes); }
      coreSets.push(`"updatedAt" = now()`);
      try {
        const { rows } = await pool.query(
          `UPDATE clients SET ${coreSets.join(", ")} WHERE id = $${cidx} RETURNING *`,
          [...coreVals, id]
        );
        client = rows[0];
      } catch (coreErr) {
        console.error("[clients] core update failed:", coreErr);
      }
    }
  }
  if (!client) {
    try {
      const [c] = await db.update(clientsTable).set({
        ...(name && { name }),
        ...(email && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(website !== undefined && { website }),
        ...(status && { status }),
        ...(tier && { tier }),
        updatedAt: new Date(),
      }).where(eq(clientsTable.id, id)).returning();
      client = c;
    } catch (e) { console.error("[clients] drizzle update fail:", e); }
  }
  if (!client) {
    res.status(404).json({ error: "Client not found or update failed (add columns via ALTER?)" });
    return;
  }
  // log important client updates (status/tier change = convert/lead update)
  if (status || tier) {
    await logClientActivity("client.updated", `Client status/tier updated to ${status || ''} / ${tier || ''}`);
  } else {
    await logClientActivity("client.updated", `Client "${client.name}" details updated`);
  }
  res.json(mapClient(client));
}

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let clientName = id;
  try {
    const [c] = await db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
    if (c?.name) clientName = c.name;
  } catch {}
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  await logClientActivity("client.deleted", `Client "${clientName}" deleted`);
  res.json({ success: true, message: "Client deleted" });
});

function mapClient(c: any) {
  const hasInquiry = c.notes && /Inquiry/i.test(c.notes);
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    address: c.address,
    website: c.website,
    notes: c.notes,
    status: c.status || (hasInquiry ? "prospect" : "active"),
    tier: c.tier || (hasInquiry ? "new" : "regular"),
    createdAt: c.createdAt,
  };
}

async function logClientActivity(action: string, description: string, userId?: string) {
  try {
    const { activityLogsTable } = await import("@workspace/db");
    await db.insert(activityLogsTable).values({
      id: crypto.randomUUID(),
      userId: userId || null,
      projectId: null,
      action,
      description,
    });
  } catch (e) {
    // non fatal
  }
}

export default router;

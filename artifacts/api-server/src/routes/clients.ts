import { Router, type IRouter } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

router.get("/clients", async (req, res): Promise<void> => {
  const { search } = req.query as { search?: string };
  const clients = search
    ? await db.select().from(clientsTable).where(
        or(
          ilike(clientsTable.name, `%${search}%`),
          ilike(clientsTable.email, `%${search}%`),
          ilike(clientsTable.company as any, `%${search}%`)
        )
      )
    : await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
  res.json(clients.map(mapClient));
});

router.post("/clients", async (req, res): Promise<void> => {
  const { name, email, phone, company, address, notes } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "Name and email are required" });
    return;
  }
  const [client] = await db
    .insert(clientsTable)
    .values({
      id: crypto.randomUUID(),
      name,
      email,
      phone,
      company,
      address,
      notes,
    })
    .returning();
  res.status(201).json(mapClient(client));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1);
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(mapClient(client));
});

router.put("/clients/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email, phone, company, address, notes } = req.body;
  const [client] = await db
    .update(clientsTable)
    .set({
      ...(name && { name }),
      ...(email && { email }),
      ...(phone !== undefined && { phone }),
      ...(company !== undefined && { company }),
      ...(address !== undefined && { address }),
      ...(notes !== undefined && { notes }),
      updatedAt: new Date(),
    })
    .where(eq(clientsTable.id, id))
    .returning();
  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json(mapClient(client));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.json({ success: true, message: "Client deleted" });
});

function mapClient(c: any) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    address: c.address,
    notes: c.notes,
    createdAt: c.createdAt,
  };
}

export default router;

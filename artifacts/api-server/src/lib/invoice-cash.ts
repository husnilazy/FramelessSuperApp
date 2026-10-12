import { db, invoicesTable, paymentsTable, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type CashEvent = {
  /** id pembayaran, atau `legacy:<invoiceId>` untuk data lama tanpa rincian */
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string | null;
  amount: number;
  date: string; // ISO
  method: string;
  legacy: boolean;
};

/**
 * Semua uang masuk dari invoice, per TANGGAL PEMBAYARAN.
 * Invoice lama yang punya paidAmount tetapi belum punya rincian pembayaran dihitung
 * sebagai satu kejadian (tanggal = paidAt → updatedAt → createdAt) — sama seperti perilaku lama.
 */
export async function loadCashEvents(): Promise<CashEvent[]> {
  const invoices = await db
    .select({ inv: invoicesTable, clientName: clientsTable.name })
    .from(invoicesTable)
    .leftJoin(clientsTable, eq(invoicesTable.clientId, clientsTable.id));
  const payments = await db.select().from(paymentsTable);

  const byInvoice = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = byInvoice.get(p.invoiceId) ?? [];
    list.push(p);
    byInvoice.set(p.invoiceId, list);
  }

  const events: CashEvent[] = [];
  for (const { inv, clientName } of invoices) {
    const rows = byInvoice.get(inv.id) ?? [];
    if (rows.length > 0) {
      for (const p of rows) {
        events.push({
          id: p.id,
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          clientName,
          amount: Number(p.amount),
          date: new Date(p.paidAt).toISOString(),
          method: p.method,
          legacy: false,
        });
      }
    } else if (Number(inv.paidAmount) > 0) {
      const ref = inv.paidAt ?? inv.updatedAt ?? inv.createdAt;
      events.push({
        id: `legacy:${inv.id}`,
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        clientName,
        amount: Number(inv.paidAmount),
        date: new Date(ref).toISOString(),
        method: "—",
        legacy: true,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

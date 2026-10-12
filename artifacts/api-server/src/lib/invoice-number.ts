import { db, invoicesTable } from "@workspace/db";

/** Nomor berikutnya = angka terbesar yang ada + 1 (aman setelah ada invoice yang dihapus). */
export async function nextInvoiceNumber(): Promise<string> {
  const rows = await db.select({ number: invoicesTable.number }).from(invoicesTable);
  let max = 0;
  for (const r of rows) {
    const m = /^INV-(\d+)$/i.exec(r.number);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `INV-${String(max + 1).padStart(4, "0")}`;
}

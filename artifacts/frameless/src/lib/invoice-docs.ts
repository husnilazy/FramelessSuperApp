// Klien untuk dokumen cetak invoice/kwitansi yang dirender server
// (satu template untuk preview, cetak, dan PDF).

export type InvoiceDocKind = "invoice" | "receipt";

export interface InvoicePayment {
  id: string;
  amount: number;
  method: string;
  reference?: string | null;
  paidAt: string | null;
  notes?: string | null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  let token: string | null = null;
  try { token = localStorage.getItem("token"); } catch {}
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res;
  let msg = `Permintaan gagal (${res.status})`;
  try {
    const j = await res.clone().json();
    msg = j.error || msg;
    if (j.detail) msg += ` — ${j.detail}`;
  } catch {}
  throw new Error(msg);
}

export async function fetchInvoiceDocHtml(
  id: string,
  doc: InvoiceDocKind,
  opts: { paymentId?: string | null } = {},
): Promise<string> {
  const q = new URLSearchParams({ doc, format: "html" });
  if (opts.paymentId) q.set("paymentId", opts.paymentId);
  const res = await ensureOk(await fetch(`/api/invoices/${id}/doc?${q}`, { headers: authHeaders() }));
  return res.text();
}

export async function fetchInvoiceDocPdf(
  id: string,
  doc: InvoiceDocKind,
  opts: { paymentId?: string | null } = {},
): Promise<Blob> {
  const q = new URLSearchParams({ doc, format: "pdf" });
  if (opts.paymentId) q.set("paymentId", opts.paymentId);
  const res = await ensureOk(await fetch(`/api/invoices/${id}/doc?${q}`, { headers: authHeaders() }));
  return res.blob();
}

/** Render draft (belum disimpan) → HTML untuk preview langsung di editor. */
export async function fetchDraftPreviewHtml(draft: unknown, signal?: AbortSignal): Promise<string> {
  const res = await ensureOk(
    await fetch("/api/invoices/preview-html", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(draft),
      signal,
    }),
  );
  return res.text();
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const slugifyNumber = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "invoice";

export async function recordPayment(
  invoiceId: string,
  body: { amount: number; method: string; paidAt?: string; reference?: string; notes?: string },
) {
  const res = await ensureOk(
    await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    }),
  );
  return res.json();
}

export async function deletePayment(invoiceId: string, paymentId: string) {
  const res = await ensureOk(
    await fetch(`/api/invoices/${invoiceId}/payments/${paymentId}`, { method: "DELETE", headers: authHeaders() }),
  );
  return res.json();
}

export async function fetchInvoiceDetail(id: string) {
  const res = await ensureOk(await fetch(`/api/invoices/${id}`, { headers: authHeaders() }));
  return res.json();
}

export async function fetchNextInvoiceNumber(): Promise<string> {
  const res = await ensureOk(await fetch("/api/invoices/next-number", { headers: authHeaders() }));
  return (await res.json()).number;
}

/** Buat link publik (tanpa login) untuk invoice / kwitansi — untuk dikirim ke client. */
export async function createShareLink(invoiceId: string, doc: InvoiceDocKind, paymentId?: string | null): Promise<string> {
  const res = await ensureOk(
    await fetch(`/api/invoices/${invoiceId}/share`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ doc, paymentId: paymentId || "" }),
    }),
  );
  return (await res.json()).url;
}

/** 08123… / +62812… / 812… → 62812… (format wa.me). Kosong bila tidak valid. */
export function normalizeWaNumber(raw?: string | null): string {
  const d = (raw || "").replace(/[^\d]/g, "");
  if (d.length < 8) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return "62" + d.slice(1);
  if (d.startsWith("8")) return "62" + d;
  return d;
}

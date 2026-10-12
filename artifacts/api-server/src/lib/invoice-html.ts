// Template dokumen Invoice & Kwitansi (DP / Pelunasan).
// Satu-satunya sumber tampilan: dipakai untuk preview (iframe), cetak (window.print)
// dan PDF (puppeteer), jadi ketiganya selalu identik.

export type DocPayment = {
  id: string;
  amount: number;
  method: string;
  reference?: string | null;
  paidAt: Date | string | null;
  notes?: string | null;
};

export type DocItem = { description: string; quantity: number; unitPrice: number; total: number };

export type InvoiceDocData = {
  number: string;
  status: string;
  invoiceDate?: Date | string | null;
  dueDate?: Date | string | null;
  paymentTerms?: string | null;
  poNumber?: string | null;
  clientName?: string | null;
  projectName?: string | null;
  billTo?: string | null;
  shipTo?: string | null;
  items: DocItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  shipping: number;
  total: number;
  paidAmount: number;
  payments: DocPayment[];
  notes?: string | null;
  terms?: string | null;
};

export type DocCompany = {
  name: string;
  tagline?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  /** Nama penandatangan di kwitansi (default: nama perusahaan) */
  signerName?: string | null;
};

export type DocBank = { bank: string; number: string; holder: string };

export const DEFAULT_BANK: DocBank = {
  bank: "Bank Central Asia (BCA)",
  number: "239-0777895",
  holder: "FRAMELESS CREATIVE PROJECT PT",
};

export type DocKind = "invoice" | "receipt";

export type BuildOptions = {
  kind: DocKind;
  company: DocCompany;
  bank?: DocBank;
  /** Kwitansi: pembayaran yang dikwitansikan. Default = pembayaran terakhir. */
  paymentId?: string | null;
  /** Invoice: tampilkan stempel DP/LUNAS bila sudah ada pembayaran. Default true. */
  stamp?: boolean;
  /** Origin frontend, untuk logo relatif seperti /logo-frameless.png */
  appUrl?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (v: unknown): string => esc(v).replace(/\r?\n/g, "<br>");

export function formatRupiah(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}Rp ${s}`;
}

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Tanggal dalam zona WIB, mis. "12 Oktober 2026". */
export function formatTanggal(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  const w = new Date(date.getTime() + 7 * 3600_000);
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}`;
}

const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function spell(n: number): string {
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${spell(n - 10)} belas`;
  if (n < 100) return `${spell(Math.floor(n / 10))} puluh${n % 10 ? " " + spell(n % 10) : ""}`;
  if (n < 200) return `seratus${n - 100 ? " " + spell(n - 100) : ""}`;
  if (n < 1000) return `${spell(Math.floor(n / 100))} ratus${n % 100 ? " " + spell(n % 100) : ""}`;
  if (n < 2000) return `seribu${n - 1000 ? " " + spell(n - 1000) : ""}`;
  if (n < 1e6) return `${spell(Math.floor(n / 1e3))} ribu${n % 1e3 ? " " + spell(n % 1e3) : ""}`;
  if (n < 1e9) return `${spell(Math.floor(n / 1e6))} juta${n % 1e6 ? " " + spell(n % 1e6) : ""}`;
  if (n < 1e12) return `${spell(Math.floor(n / 1e9))} miliar${n % 1e9 ? " " + spell(n % 1e9) : ""}`;
  return `${spell(Math.floor(n / 1e12))} triliun${n % 1e12 ? " " + spell(n % 1e12) : ""}`;
}

/** 1500000 → "Satu juta lima ratus ribu rupiah" */
export function terbilang(amount: number): string {
  const n = Math.round(Math.abs(amount));
  const words = n === 0 ? "nol" : spell(n);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupiah`;
}

function resolveLogo(url: string | null | undefined, appUrl?: string): string {
  if (!url) return "";
  if (/^(https?:|data:)/i.test(url)) return url;
  if (url.startsWith("/") && appUrl) return `${appUrl.replace(/\/$/, "")}${url}`;
  return "";
}

// ─── Status pembayaran ──────────────────────────────────────────────────────

export type PaymentStage = "UNPAID" | "DP" | "PAID";

export function paymentStage(total: number, paid: number): PaymentStage {
  if (paid <= 0) return "UNPAID";
  return paid >= total - 0.5 ? "PAID" : "DP";
}

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif; font-size: 12px; line-height: 1.55; color: #161616; background: #fff; }
  @media screen {
    body { background: #d9dce1; padding: 24px 12px; }
    .sheet { width: 210mm; max-width: 100%; margin: 0 auto; background: #fff; padding: 16mm 14mm; box-shadow: 0 6px 30px rgba(0,0,0,.18); border-radius: 3px; }
  }
  .sheet { position: relative; }
  .muted { color: #6b6b6b; }
  .label { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: #8a8a8a; font-weight: 700; margin-bottom: 5px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  .brand img { max-height: 64px; max-width: 220px; object-fit: contain; display: block; margin-bottom: 10px; }
  .brand .name { font-weight: 800; font-size: 13px; letter-spacing: .3px; }
  .brand .addr { font-size: 10.5px; color: #5a5a5a; line-height: 1.6; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 32px; font-weight: 900; letter-spacing: 4px; line-height: 1; margin-bottom: 10px; }
  .meta { margin-left: auto; border-collapse: collapse; }
  .meta td { padding: 1.5px 0 1.5px 14px; font-size: 11.5px; text-align: right; }
  .meta td:first-child { color: #8a8a8a; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; }
  .rule { height: 3px; margin: 18px 0 20px; border-radius: 2px; background: linear-gradient(90deg, #ff6b35, #ff9a35 60%, rgba(255,210,53,.15)); }
  .parties { display: grid; gap: 16px; margin-bottom: 20px; }
  .box { background: #f7f7f7; border-radius: 6px; padding: 12px 14px; border-left: 3px solid #ff6b35; }
  .box.plain { border-left-color: #cfcfcf; }
  .box .who { font-weight: 800; font-size: 13.5px; margin-bottom: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  table.items th { background: #1a1a1a; color: #fff; font-size: 9px; letter-spacing: 1.8px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
  table.items td { padding: 8px 10px; border-bottom: 1px solid #ececec; vertical-align: top; }
  table.items tbody tr:nth-child(even) td { background: #fafafa; }
  table.items tr { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  .r { text-align: right; } .c { text-align: center; }
  .bottom { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; break-inside: avoid; page-break-inside: avoid; }
  .totals { width: 320px; margin-left: auto; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 3.5px 0; font-size: 12px; }
  .totals td:last-child { text-align: right; font-weight: 600; }
  .totals tr.grand td { border-top: 2px solid #1a1a1a; padding-top: 8px; font-weight: 800; }
  .totals tr.grand td:last-child { font-size: 16px; color: #ff6b35; }
  .due { background: #1a1a1a; color: #fff; border-radius: 5px; padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
  .due b { font-size: 9.5px; letter-spacing: 2px; text-transform: uppercase; }
  .due span { font-size: 17px; font-weight: 900; color: #ff9a35; }
  .due.settled span { color: #5ee08a; }
  .green { color: #15924a; }
  .bank { border: 1.5px solid #1a4f9b; background: #f0f5ff; border-radius: 8px; padding: 10px 14px; margin-top: 4px; }
  .bank .b1 { font-size: 9px; color: #1a4f9b; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
  .bank .b2 { font-size: 16px; font-weight: 800; color: #1a4f9b; letter-spacing: 2px; font-family: "Courier New", monospace; }
  .bank .b3 { font-size: 9px; font-weight: 700; color: #1a4f9b; text-transform: uppercase; }
  .notes { display: grid; gap: 24px; border-top: 1px solid #ececec; padding-top: 14px; margin-top: 18px; break-inside: avoid; page-break-inside: avoid; }
  .notes .txt { font-size: 11px; color: #4a4a4a; line-height: 1.7; }
  .foot { border-top: 2px solid #1a1a1a; padding-top: 12px; margin-top: 22px; display: flex; justify-content: space-between; gap: 16px; font-size: 9.5px; color: #8a8a8a; break-inside: avoid; page-break-inside: avoid; }
  .foot b { color: #161616; letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px; display: block; margin-bottom: 2px; }

  /* Stempel */
  .stamp { position: absolute; z-index: 5; transform: rotate(-13deg); border: 4px double currentColor; border-radius: 10px; padding: 6px 20px 5px; text-align: center; font-weight: 900; letter-spacing: 5px; line-height: 1.05; opacity: .82; mix-blend-mode: multiply; pointer-events: none; }
  .stamp .s1 { font-size: 34px; }
  .stamp .s2 { font-size: 9px; letter-spacing: 2px; font-weight: 700; margin-top: 3px; }
  .stamp.lunas { color: #12a150; } .stamp.dp { color: #e8590c; }
  .stamp { white-space: nowrap; }
  .stamp.inline { position: relative; display: inline-block; margin: 18px 0 30px 14px; }

  /* Kwitansi */
  .rc-banner { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #f7f7f7; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .rc-banner .big { font-size: 15px; font-weight: 800; }
  .rc-line { display: grid; grid-template-columns: 130px 1fr; gap: 6px 10px; padding: 7px 0; border-bottom: 1px dotted #c8c8c8; font-size: 12.5px; }
  .rc-line .k { color: #7a7a7a; }
  .rc-line .v { font-weight: 600; }
  .rc-line .terbilang { font-style: italic; font-weight: 700; }
  .rc-amount { display: inline-block; margin: 16px 0 6px; padding: 10px 22px; font-size: 24px; font-weight: 900; border: 2px solid #161616; border-radius: 6px; background: #fffaf5; }
  .progress { height: 9px; border-radius: 99px; background: #ececec; overflow: hidden; margin: 6px 0 4px; }
  .progress i { display: block; height: 100%; background: linear-gradient(90deg, #ff6b35, #ff9a35); }
  .progress.done i { background: #12a150; }
  .sum { width: 100%; border-collapse: collapse; }
  .sum td { padding: 4px 0; font-size: 12px; } .sum td:last-child { text-align: right; font-weight: 700; }
  .sum tr.hi td { border-top: 1.5px solid #161616; padding-top: 7px; font-size: 13.5px; font-weight: 800; }
  table.hist { width: 100%; border-collapse: collapse; margin: 6px 0 18px; font-size: 11px; }
  table.hist th { text-align: left; font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: #8a8a8a; padding: 6px 8px; border-bottom: 1.5px solid #161616; }
  table.hist td { padding: 6px 8px; border-bottom: 1px solid #ececec; }
  table.hist tr.cur td { background: #fff4ec; font-weight: 700; }
  .sign { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; margin-top: 22px; break-inside: avoid; page-break-inside: avoid; position: relative; min-height: 120px; }
  .sign .col { width: 200px; text-align: center; font-size: 11px; }
  .sign .line { border-bottom: 1px solid #161616; height: 62px; margin-bottom: 4px; }
  .sign .stamp { position: absolute; left: 50%; top: -6px; transform: translateX(-50%) rotate(-10deg); }
`;

// ─── Builder ────────────────────────────────────────────────────────────────

export function buildInvoiceHtml(data: InvoiceDocData, opts: BuildOptions): string {
  const bank = opts.bank ?? DEFAULT_BANK;
  const { company } = opts;
  const logo = resolveLogo(company.logoUrl, opts.appUrl);

  const payments = [...data.payments].sort(
    (a, b) => new Date(a.paidAt ?? 0).getTime() - new Date(b.paidAt ?? 0).getTime(),
  );
  const paid = Math.max(data.paidAmount, 0);
  const stage = paymentStage(data.total, paid);

  const head = (title: string, metaRows: [string, string][]) => `
    <div class="head">
      <div class="brand">
        ${logo ? `<img src="${esc(logo)}" alt="">` : ""}
        <div class="name">${esc(company.name)}</div>
        <div class="addr">${nl2br(company.address || "")}${company.email || company.phone || company.website ? "<br>" : ""}${esc(
    [company.email, company.phone, company.website].filter(Boolean).join(" · "),
  )}</div>
      </div>
      <div class="doc-title">
        <h1>${esc(title)}</h1>
        <table class="meta"><tbody>
          ${metaRows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join("")}
        </tbody></table>
      </div>
    </div>
    <div class="rule"></div>`;

  const billBox = (() => {
    const lines = (data.billTo || "").split(/\r?\n/).filter(Boolean);
    const name = data.clientName || lines[0] || "—";
    const dupFirst = lines[0] && data.clientName && lines[0].trim().toLowerCase() === data.clientName.trim().toLowerCase();
    const rest = data.clientName ? (dupFirst ? lines.slice(1) : lines) : lines.slice(1);
    return `<div class="box">
      <div class="label">Tagihan Kepada</div>
      <div class="who">${esc(name)}</div>
      <div class="muted">${rest.map(esc).join("<br>")}</div>
    </div>`;
  })();

  const footer = `
    <div class="foot">
      <div><b>${esc(company.name)}</b>Dokumen ini diterbitkan secara elektronik oleh ${esc(company.name)} dan sah tanpa tanda tangan basah.</div>
      <div style="text-align:right;white-space:nowrap">Dicetak<br><span style="color:#161616;font-weight:700">${formatTanggal(new Date())}</span></div>
    </div>`;

  let body = "";

  if (opts.kind === "invoice") {
    const showStamp = opts.stamp !== false && stage !== "UNPAID";
    const stampHtml = showStamp
      ? `<div class="stamp inline ${stage === "PAID" ? "lunas" : "dp"}">
           <div class="s1">${stage === "PAID" ? "LUNAS" : "DP DITERIMA"}</div>
           <div class="s2">${esc(formatTanggal(payments.at(-1)?.paidAt ?? new Date()))}</div>
         </div>`
      : "";

    const meta: [string, string][] = [
      ["No. Invoice", `<b>${esc(data.number)}</b>`],
      ["Tanggal", esc(formatTanggal(data.invoiceDate))],
      ["Jatuh Tempo", `<b style="color:#c0392b">${esc(formatTanggal(data.dueDate))}</b>`],
    ];
    if (data.paymentTerms) meta.push(["Termin", esc(data.paymentTerms)]);
    if (data.poNumber) meta.push(["No. PO", esc(data.poNumber)]);
    if (data.projectName) meta.push(["Proyek", esc(data.projectName)]);

    const taxRow = data.tax > 0 ? `<tr><td class="muted">PPN (${esc(data.taxRate)}%)</td><td>${formatRupiah(data.tax)}</td></tr>` : "";
    const discRow = data.discount > 0 ? `<tr><td class="muted">Diskon</td><td class="green">−${formatRupiah(data.discount)}</td></tr>` : "";
    const shipRow = data.shipping > 0 ? `<tr><td class="muted">Ongkos Kirim</td><td>${formatRupiah(data.shipping)}</td></tr>` : "";
    const balance = Math.max(data.total - paid, 0);

    body = `
      ${head("INVOICE", meta)}
      <div class="parties" style="grid-template-columns:${data.shipTo ? "1fr 1fr" : "1fr 1fr"}">
        ${billBox}
        ${
          data.shipTo
            ? `<div class="box plain"><div class="label">Dikirim Ke</div><div>${nl2br(data.shipTo)}</div></div>`
            : `<div></div>`
        }
      </div>
      <table class="items">
        <thead><tr><th>Deskripsi Item / Layanan</th><th class="c" style="width:55px">Qty</th><th class="r" style="width:120px">Harga Satuan</th><th class="r" style="width:120px">Jumlah</th></tr></thead>
        <tbody>
          ${
            data.items.length
              ? data.items
                  .map(
                    (i) => `<tr><td>${nl2br(i.description || "—")}</td><td class="c">${esc(i.quantity)}</td><td class="r">${formatRupiah(i.unitPrice)}</td><td class="r"><b>${formatRupiah(i.total)}</b></td></tr>`,
                  )
                  .join("")
              : `<tr><td colspan="4" class="c muted">Belum ada item</td></tr>`
          }
        </tbody>
      </table>
      <div class="bottom">
        <div style="flex:1;max-width:300px">
          <div class="label">Informasi Pembayaran</div>
          <div class="bank">
            <div class="b1">${esc(bank.bank)}</div>
            <div class="b2">${esc(bank.number)}</div>
            <div class="b3">a.n. ${esc(bank.holder)}</div>
          </div>
          <div class="muted" style="font-size:10px;margin-top:6px">Sertakan nomor invoice <b>${esc(data.number)}</b> pada berita transfer.</div>
          ${stampHtml}
        </div>
        <div class="totals">
          <table><tbody>
            <tr><td class="muted">Subtotal</td><td>${formatRupiah(data.subtotal)}</td></tr>
            ${taxRow}${discRow}${shipRow}
            <tr class="grand"><td>TOTAL</td><td>${formatRupiah(data.total)}</td></tr>
            ${paid > 0 ? `<tr><td class="muted">Sudah Dibayar</td><td class="green">−${formatRupiah(paid)}</td></tr>` : ""}
          </tbody></table>
          <div class="due ${balance <= 0 ? "settled" : ""}"><b>${balance <= 0 ? "Status" : "Sisa Tagihan"}</b><span>${balance <= 0 ? "LUNAS" : formatRupiah(balance)}</span></div>
        </div>
      </div>
      ${
        data.notes || data.terms
          ? `<div class="notes" style="grid-template-columns:${data.notes && data.terms ? "1fr 1fr" : "1fr"}">
              ${data.notes ? `<div><div class="label">Catatan</div><div class="txt">${nl2br(data.notes)}</div></div>` : ""}
              ${data.terms ? `<div><div class="label">Syarat &amp; Ketentuan</div><div class="txt">${nl2br(data.terms)}</div></div>` : ""}
            </div>`
          : ""
      }
      ${footer}`;
  } else {
    // ── Kwitansi (DP / termin / pelunasan) ──────────────────────────────────
    let list = payments;
    if (list.length === 0 && paid > 0) {
      // data lama: paidAmount terisi tapi belum ada rincian pembayaran
      list = [{ id: "legacy", amount: paid, method: "—", paidAt: null }];
    }
    let idx = opts.paymentId ? list.findIndex((p) => p.id === opts.paymentId) : -1;
    if (idx < 0) idx = list.length - 1;
    const cur = idx >= 0 ? list[idx] : null;
    const upTo = list.slice(0, idx + 1).reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(data.total - upTo, 0);
    const settled = remaining <= 0.5 && upTo > 0;
    const pct = data.total > 0 ? Math.min(100, Math.round((upTo / data.total) * 100)) : 0;
    const termNo = idx + 1;
    const isDp = !settled && termNo === 1;

    const title = settled ? "BUKTI PELUNASAN" : isDp ? "KWITANSI DP" : `KWITANSI TERMIN ${termNo}`;
    const purpose = settled
      ? termNo === 1
        ? `Pelunasan penuh Invoice ${data.number}`
        : `Pelunasan Invoice ${data.number}`
      : isDp
      ? `Down Payment (DP ${pct}%) Invoice ${data.number}`
      : `Pembayaran Termin ${termNo} Invoice ${data.number}`;
    const stampTxt = settled ? "LUNAS" : isDp ? "DP DITERIMA" : `TERMIN ${termNo}`;
    const receiptNo = `KW-${data.number}-${String(termNo).padStart(2, "0")}`;
    const payDate = cur?.paidAt ?? data.invoiceDate ?? null;
    const payer = data.clientName || (data.billTo || "").split(/\r?\n/)[0] || "—";

    body = `
      ${head(title, [
        ["No. Kwitansi", `<b>${esc(receiptNo)}</b>`],
        ["Tanggal Bayar", esc(formatTanggal(payDate))],
        ["Ref. Invoice", esc(data.number)],
        ...(data.projectName ? ([["Proyek", esc(data.projectName)]] as [string, string][]) : []),
      ])}

      <div class="rc-line"><div class="k">Telah terima dari</div><div class="v">${esc(payer)}</div></div>
      <div class="rc-line"><div class="k">Uang sejumlah</div><div class="v terbilang">${esc(terbilang(cur?.amount ?? 0))}</div></div>
      <div class="rc-line"><div class="k">Untuk pembayaran</div><div class="v">${esc(purpose)}${data.projectName ? ` — ${esc(data.projectName)}` : ""}</div></div>
      <div class="rc-line"><div class="k">Metode</div><div class="v">${esc(cur?.method || "—")}${cur?.reference ? ` · Ref: ${esc(cur.reference)}` : ""}</div></div>
      ${cur?.notes ? `<div class="rc-line"><div class="k">Catatan</div><div class="v">${nl2br(cur.notes)}</div></div>` : ""}

      <div class="rc-amount">${formatRupiah(cur?.amount ?? 0)}</div>

      <div class="bottom" style="margin-top:16px">
        <div style="flex:1">
          <div class="label">Riwayat Pembayaran</div>
          <table class="hist">
            <thead><tr><th>#</th><th>Tanggal</th><th>Metode</th><th class="r">Jumlah</th></tr></thead>
            <tbody>
              ${list
                .map(
                  (p, i) => `<tr class="${i === idx ? "cur" : ""}"><td>${i + 1}</td><td>${esc(formatTanggal(p.paidAt))}</td><td>${esc(p.method || "—")}${p.reference ? ` · ${esc(p.reference)}` : ""}</td><td class="r">${formatRupiah(p.amount)}</td></tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="totals" style="width:290px">
          <div class="label">Ringkasan Invoice</div>
          <table class="sum"><tbody>
            <tr><td class="muted">Total tagihan</td><td>${formatRupiah(data.total)}</td></tr>
            <tr><td class="muted">Terbayar s/d kwitansi ini</td><td class="green">${formatRupiah(upTo)}</td></tr>
            <tr class="hi"><td>${settled ? "Status" : "Sisa tagihan"}</td><td style="color:${settled ? "#12a150" : "#e8590c"}">${settled ? "LUNAS" : formatRupiah(remaining)}</td></tr>
          </tbody></table>
          <div class="progress ${settled ? "done" : ""}"><i style="width:${pct}%"></i></div>
          <div class="muted" style="font-size:10px">${pct}% dari total tagihan telah dibayar</div>
        </div>
      </div>

      ${
        !settled && data.dueDate
          ? `<div class="box plain" style="margin-top:6px;font-size:11px"><b>Sisa ${formatRupiah(remaining)}</b> mohon dilunasi paling lambat <b>${esc(formatTanggal(data.dueDate))}</b> ke rekening ${esc(bank.bank)} <b>${esc(bank.number)}</b> a.n. ${esc(bank.holder)}.</div>`
          : ""
      }

      <div class="sign">
        <div class="col"><div class="muted" style="font-size:10px">Pembayar</div><div class="line"></div><b>${esc(payer)}</b></div>
        <div class="stamp ${settled ? "lunas" : "dp"}">
          <div class="s1">${esc(stampTxt)}</div>
          <div class="s2">${esc(formatTanggal(payDate))}</div>
        </div>
        <div class="col"><div class="muted" style="font-size:10px">Penerima</div><div class="line"></div><b>${esc(company.signerName || company.name)}</b></div>
      </div>
      ${footer}`;
  }

  return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.kind === "invoice" ? "Invoice" : "Kwitansi")} ${esc(data.number)}</title>
<style>${CSS}</style></head><body><div class="sheet">${body}</div></body></html>`;
}

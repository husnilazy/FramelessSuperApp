/**
 * Identitas perusahaan untuk laporan cetak (Finance, Akuntansi, Expenses).
 * Logo, nama, dan alamat diambil dari Pengaturan Dokumen (logo yang diunggah admin),
 * jadi laporan selalu satu identitas dengan Invoice & Kwitansi.
 */
export interface Brand {
  name: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
}

const FALLBACK: Brand = {
  name: "Frameless Creative",
  address: "Jl. Lurah Sudarto Jlamprang Wonosobo 56319",
  email: "info@frameless.com",
  phone: "",
  website: "www.framelesscreative.com",
  logoUrl: "",
};

const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function fetchBrand(): Promise<Brand> {
  try {
    let token: string | null = null;
    try { token = localStorage.getItem("token"); } catch {}
    const r = await fetch("/api/company-profile", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!r.ok) return FALLBACK;
    const d = await r.json();
    return {
      name: d.companyName || FALLBACK.name,
      address: d.address || FALLBACK.address,
      email: d.email || FALLBACK.email,
      phone: d.phone || "",
      website: d.website || FALLBACK.website,
      logoUrl: d.logoUrl || "",
    };
  } catch {
    return FALLBACK;
  }
}

/** Satu baris kontak: alamat · email · telepon · website */
export const brandContactLine = (b: Brand) => [b.address, b.email, b.phone, b.website].filter(Boolean).map(esc).join(" · ");

export function reportHeaderHtml(brand: Brand, kicker: string, title: string, metaLines: string[]) {
  return `<div class="rpt-head">
  <div class="rpt-brand">
    ${brand.logoUrl ? `<img class="rpt-logo" src="${esc(brand.logoUrl)}" alt="">` : `<div class="rpt-wordmark">${esc(brand.name)}</div>`}
    <div class="rpt-name">${esc(brand.name)}</div>
    <div class="rpt-addr">${brandContactLine(brand)}</div>
  </div>
  <div class="rpt-titlebox">
    <div class="rpt-kicker">${esc(kicker)}</div>
    <div class="rpt-title">${esc(title)}</div>
    ${metaLines.map((m) => `<div class="rpt-meta">${m}</div>`).join("")}
  </div>
</div>
<div class="rpt-bar"></div>
${brand.logoUrl ? `<img class="rpt-watermark" src="${esc(brand.logoUrl)}" alt="">` : ""}`;
}

/** Gaya tambahan: menimpa kop lama & mempercantik kartu, tabel, dan nomor halaman. */
export const REPORT_BRAND_CSS = `
  @page { size: A4; margin: 14mm 12mm 16mm; @bottom-right { content: "Hal. " counter(page) " / " counter(pages); font-size: 9px; color: #9ca3af; } }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Helvetica Neue", Helvetica, Arial, "Segoe UI", sans-serif !important; color: #161a2b; }
  .rpt-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 14px; }
  .rpt-logo { max-height: 58px; max-width: 220px; object-fit: contain; display: block; margin-bottom: 8px; }
  .rpt-wordmark { font-size: 24px; font-weight: 900; color: #FF6A20; letter-spacing: -.02em; margin-bottom: 4px; }
  .rpt-name { font-weight: 800; font-size: 13px; }
  .rpt-addr { font-size: 10px; color: #6b7280; line-height: 1.6; margin-top: 2px; max-width: 360px; }
  .rpt-titlebox { text-align: right; }
  .rpt-kicker { display: inline-block; background: #FF6A20; color: #fff; font-size: 9px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; padding: 3px 10px; border-radius: 99px; }
  .rpt-title { font-size: 26px; font-weight: 900; letter-spacing: -.02em; line-height: 1.1; margin: 8px 0 6px; }
  .rpt-meta { font-size: 10.5px; color: #6b7280; line-height: 1.55; }
  .rpt-bar { height: 4px; border-radius: 3px; margin: 0 0 22px; background: linear-gradient(90deg, #FF6A20, #ff9a35 55%, rgba(255,210,53,.2)); }
  .rpt-watermark { position: fixed; left: 50%; top: 50%; width: 360px; max-height: 260px; object-fit: contain; transform: translate(-50%, -50%); opacity: .045; z-index: -1; pointer-events: none; }
  .kpi { border: 1px solid #e5e7eb !important; border-left: 4px solid #FF6A20 !important; border-radius: 10px !important; background: linear-gradient(180deg, #fffaf6, #ffffff) !important; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  .kpi-label { letter-spacing: .1em; }
  th { background: #1a1d2e !important; color: #fff !important; border-bottom: none !important; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .total-row td, .total td { background: #fff3e8 !important; }
  .section-title { color: #1a1d2e; }
  .section, tr { break-inside: avoid; page-break-inside: avoid; }
  .footer { border-top: 2px solid #1a1d2e !important; margin-top: 28px; }
`;

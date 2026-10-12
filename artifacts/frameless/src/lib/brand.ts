import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";

/**
 * Identitas yang boleh tampil di halaman publik/login & sidebar:
 * nama + logo dari Pengaturan Dokumen (logo yang diunggah admin).
 * Diambil dari endpoint publik /api/public/brand (hanya nama & logo, tanpa data sensitif).
 */
export interface PublicBrand {
  name: string;
  tagline: string;
  /** logo untuk latar terang */
  logoUrl: string;
  /** logo untuk latar gelap */
  logoDarkUrl: string;
}

const KEY = "public_brand_v1";
let memo: PublicBrand | null = null;
let inflight: Promise<PublicBrand | null> | null = null;

function readCache(): PublicBrand | null {
  if (memo) return memo;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return (memo = JSON.parse(raw));
  } catch {}
  return null;
}

async function load(): Promise<PublicBrand | null> {
  if (!inflight) {
    inflight = fetch("/api/public/brand", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return null;
        const b: PublicBrand = { name: d.companyName || "", tagline: d.tagline || "", logoUrl: d.logoUrl || "", logoDarkUrl: d.logoDarkUrl || "" };
        memo = b;
        try { sessionStorage.setItem(KEY, JSON.stringify(b)); } catch {}
        return b;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

const listeners = new Set<(b: PublicBrand | null) => void>();

/** Hapus cache lalu muat ulang & beri tahu semua komponen (dipanggil setelah Pengaturan Dokumen disimpan). */
export function invalidateBrand() {
  memo = null;
  try { sessionStorage.removeItem(KEY); } catch {}
  load().then((b) => listeners.forEach((fn) => fn(b)));
}

/** Logo & nama untuk antarmuka. Pilihan manual di Appearance menang atas Pengaturan Dokumen. */
export function useBrand(): { name: string; tagline: string; logoUrl: string; loading: boolean; invertLogo: boolean } {
  const { appearance, theme } = useTheme();
  const [brand, setBrand] = useState<PublicBrand | null>(readCache);
  const [loading, setLoading] = useState(!brand);

  useEffect(() => {
    let alive = true;
    load().then((b) => { if (alive) { setBrand(b ?? readCache()); setLoading(false); } });
    const fn = (b: PublicBrand | null) => { if (alive && b) setBrand(b); };
    listeners.add(fn);
    return () => { alive = false; listeners.delete(fn); };
  }, []);

  return {
    name: appearance.companyName || brand?.name || "Frameless Creative",
    tagline: brand?.tagline || "",
    // Logo yang diunggah admin: versi gelap untuk tema gelap, versi terang untuk tema terang.
    // Bila hanya satu yang ada, dipakai untuk keduanya.
    logoUrl:
      appearance.logoUrl ||
      (theme === "dark" ? brand?.logoDarkUrl || brand?.logoUrl : brand?.logoUrl || brand?.logoDarkUrl) ||
      "",
    loading,
    // tema gelap, belum ada logo gelap, dan logo bukan pilihan manual → siluet putih agar tetap terbaca
    invertLogo: theme === "dark" && !appearance.logoUrl && !brand?.logoDarkUrl && !!brand?.logoUrl,
  };
}

import {
  LayoutDashboard, Activity, Film, Users, UsersRound, FileText, Receipt, CreditCard, PieChart, BookOpen,
  Globe, GraduationCap, Package, Banknote, Clapperboard, Inbox, Paintbrush, Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** kata kunci tambahan untuk pencarian (Ctrl/⌘ + K) */
  keywords?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: "beranda ringkasan home" },
      { href: "/command-center", label: "Command Center", icon: Activity, keywords: "pipeline workload crew" },
    ],
  },
  {
    id: "ops",
    label: "Operasional",
    items: [
      { href: "/projects", label: "Project", icon: Film, keywords: "proyek produksi" },
      { href: "/team", label: "Crew", icon: Users, keywords: "tim team anggota" },
      { href: "/clients", label: "Klien", icon: UsersRound, keywords: "client customer" },
    ],
  },
  {
    id: "money",
    label: "Keuangan",
    items: [
      { href: "/quotations", label: "Penawaran", icon: FileText, keywords: "quotation penawaran" },
      { href: "/invoices", label: "Invoice", icon: Receipt, keywords: "tagihan kwitansi dp lunas" },
      { href: "/expenses", label: "Pengeluaran", icon: CreditCard, keywords: "expense biaya" },
      { href: "/finance", label: "Keuangan", icon: PieChart, keywords: "finance laporan arus kas" },
      { href: "/accounting", label: "Akuntansi", icon: BookOpen, keywords: "jurnal buku besar neraca laba rugi" },
    ],
  },
  {
    id: "content",
    label: "Konten",
    items: [
      { href: "/cms", label: "CMS Website", icon: Globe, keywords: "landing konten situs" },
      { href: "/courses-admin", label: "Kursus", icon: GraduationCap, keywords: "academy course peserta" },
      { href: "/digital-assets-admin", label: "Aset Digital", icon: Package, keywords: "store produk digital" },
      { href: "/filmmaking-tools", label: "Filmmaking Tools", icon: Clapperboard, keywords: "script shotlist breakdown" },
      { href: "/admin/filmmaking-submissions", label: "Submisi Film", icon: Inbox, keywords: "submission masuk" },
      { href: "/payment-settings", label: "Pembayaran", icon: Banknote, keywords: "midtrans payment gateway" },
    ],
  },
  {
    id: "system",
    label: "Sistem",
    items: [
      { href: "/appearance", label: "Tampilan", icon: Paintbrush, keywords: "tema warna logo appearance" },
      { href: "/settings", label: "Pengaturan", icon: Settings, keywords: "settings akun" },
    ],
  },
];

export const ALL_NAV: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Tab utama di bar bawah (mobile). Sisanya lewat tombol "Menu". */
export const MOBILE_TABS = ["/dashboard", "/projects", "/invoices", "/finance"];

export function isNavActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return href !== "/dashboard" && pathname.startsWith(href + "/");
}

/** Cari menu terbaik untuk path (prefix terpanjang). */
export function findNav(pathname: string): NavItem | undefined {
  return [...ALL_NAV]
    .filter((n) => isNavActive(pathname, n.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

/** Judul halaman + remah roti untuk top bar. */
export function crumbsFor(pathname: string): { title: string; parent?: { label: string; href: string } } {
  const nav = findNav(pathname) ?? (pathname === "/" ? ALL_NAV[0] : undefined);
  if (!nav) return { title: "Admin" };
  const rest = pathname.slice(nav.href.length).replace(/^\/+/, "");
  if (!rest) return { title: nav.label };
  const title = rest === "new" ? "Baru" : "Detail";
  return { title, parent: { label: nav.label, href: nav.href } };
}

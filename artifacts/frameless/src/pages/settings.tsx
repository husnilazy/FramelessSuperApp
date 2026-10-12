import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth, getToken } from "@/lib/auth";
import { useBrand } from "@/lib/brand";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, Pill, Skeleton } from "@/components/shell/ui";
import { CompanyProfileDialog } from "@/components/company-profile-dialog";
import { Button } from "@/components/ui/button";
import {
  Building2, CheckCircle2, ExternalLink, Landmark, LogOut, Mail, MapPin, Moon, Palette,
  Phone, RefreshCw, ServerCog, Shield, Sun, Monitor, UserRound, XCircle, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Profile {
  companyName: string; tagline?: string | null; address?: string | null; email?: string | null;
  phone?: string | null; website?: string | null; bankName?: string | null; bankNumber?: string | null;
  bankHolder?: string | null; signerName?: string | null;
}

type Health = { state: "checking" } | { state: "ok"; ms: number } | { state: "down"; error: string };

/** Baris label → nilai. Nilai kosong ditampilkan sebagai "Belum diisi" supaya jelas apa yang kurang. */
function Row({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1 sm:flex sm:items-baseline sm:justify-between sm:gap-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-sm break-words sm:text-right", value ? "text-foreground font-medium" : "text-muted-foreground italic")}>
          {value || "Belum diisi"}
        </p>
      </div>
    </div>
  );
}

const THEME_OPTIONS = [
  { value: "light", label: "Terang", icon: Sun },
  { value: "dark", label: "Gelap", icon: Moon },
  { value: "system", label: "Ikuti sistem", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const brand = useBrand();
  const { preference: mode, setPreference: setMode } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [health, setHealth] = useState<Health>({ state: "checking" });

  const loadProfile = useCallback(() => {
    setProfileError(false);
    fetch("/api/company-profile", { headers: { Authorization: `Bearer ${getToken() ?? ""}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setProfile)
      .catch(() => setProfileError(true));
  }, []);

  const checkHealth = useCallback(() => {
    setHealth({ state: "checking" });
    const t0 = performance.now();
    fetch("/api/healthz", { cache: "no-store" })
      .then((r) => (r.ok ? setHealth({ state: "ok", ms: Math.round(performance.now() - t0) }) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .catch((e: Error) => setHealth({ state: "down", error: e.message || "Tidak terjangkau" }));
  }, []);

  useEffect(() => { loadProfile(); checkHealth(); }, [loadProfile, checkHealth]);

  const initial = (user?.name || "A").charAt(0).toUpperCase();
  const role = (user?.role || "ADMIN").toUpperCase();

  return (
    <div className="max-w-3xl pb-10">
      <PageHeader eyebrow="Sistem" title="Pengaturan" description="Profil akun, identitas perusahaan, tampilan, dan status layanan." />

      <div className="space-y-5">
        {/* ── Akun ── */}
        <Panel title="Akun saya" description="Akun yang sedang login di perangkat ini.">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 shrink-0 rounded-2xl bg-primary/12 text-primary grid place-items-center text-xl font-extrabold">{initial}</div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-foreground truncate">{user?.name || "Admin"}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="mt-2"><Pill tone="primary"><UserRound className="h-3 w-3" />{role}</Pill></div>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="shrink-0 gap-1.5">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </Panel>

        {/* ── Perusahaan ── */}
        <Panel
          title="Profil perusahaan"
          description="Dipakai pada kop invoice, kwitansi, penawaran, dan laporan."
          action={<Button size="sm" onClick={() => setDialogOpen(true)}>Ubah</Button>}
        >
          {profileError ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-destructive">Gagal memuat profil perusahaan.</span>
              <Button variant="outline" size="sm" onClick={loadProfile}>Coba lagi</Button>
            </div>
          ) : !profile ? (
            <div className="space-y-2.5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-5 w-3/4" /></div>
          ) : (
            <div>
              <Row icon={Building2} label="Nama" value={profile.companyName} />
              <Row icon={Mail} label="Email" value={profile.email} />
              <Row icon={Phone} label="Telepon" value={profile.phone} />
              <Row icon={Globe} label="Website" value={profile.website} />
              <Row icon={MapPin} label="Alamat" value={profile.address} />
              <Row icon={Landmark} label="Rekening" value={profile.bankName ? `${profile.bankName} · ${profile.bankNumber || "—"}${profile.bankHolder ? ` a.n. ${profile.bankHolder}` : ""}` : null} />
              <Row icon={UserRound} label="Penandatangan" value={profile.signerName} />
            </div>
          )}
        </Panel>

        {/* ── Tampilan ── */}
        <Panel title="Tampilan" description="Tema berlaku di perangkat ini. Warna & logo situs diatur di halaman Tampilan.">
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={active}
                  className={cn(
                    "rounded-xl border p-3 flex flex-col items-center gap-1.5 text-xs font-semibold transition-colors",
                    active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/25",
                  )}
                >
                  <Icon className="h-5 w-5" />{label}
                </button>
              );
            })}
          </div>
          <Link href="/appearance" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <Palette className="h-4 w-4" /> Atur warna utama & logo <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          {brand.name && <p className="mt-2 text-xs text-muted-foreground">Nama merek aktif: {brand.name}</p>}
        </Panel>

        {/* ── Status layanan ── */}
        <Panel
          title="Status layanan"
          description="Pemeriksaan langsung ke server API."
          action={<Button variant="ghost" size="sm" onClick={checkHealth} className="gap-1.5"><RefreshCw className={cn("h-4 w-4", health.state === "checking" && "animate-spin")} />Periksa</Button>}
        >
          <div className="flex items-center gap-3">
            <span className={cn("h-10 w-10 rounded-xl grid place-items-center", health.state === "ok" ? "bg-success/12 text-success" : health.state === "down" ? "bg-destructive/12 text-destructive" : "bg-muted text-muted-foreground")}>
              {health.state === "ok" ? <CheckCircle2 className="h-5 w-5" /> : health.state === "down" ? <XCircle className="h-5 w-5" /> : <ServerCog className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">
                {health.state === "ok" ? "Server API berjalan normal" : health.state === "down" ? "Server API tidak merespons" : "Memeriksa…"}
              </p>
              <p className="text-xs text-muted-foreground">
                {health.state === "ok" ? `Waktu respons ${health.ms} ms` : health.state === "down" ? health.error : "Mohon tunggu"}
              </p>
            </div>
          </div>
        </Panel>

        {/* ── Keamanan ── */}
        <Panel title="Keamanan" description="Sesi login disimpan di browser ini.">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Shield className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p>
              Keluar akan menghapus token dari perangkat ini. Jika memakai komputer bersama, selalu keluar setelah selesai.
              Akun baru hanya bisa dibuat oleh admin.
            </p>
          </div>
        </Panel>
      </div>

      <CompanyProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={loadProfile} />
    </div>
  );
}

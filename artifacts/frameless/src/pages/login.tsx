import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff, Loader2, Moon, Sun, ShieldCheck, Receipt, Film, LineChart, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useBrand } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const FEATURES = [
  { icon: Film, title: "Project & crew", text: "Pantau pipeline produksi, jadwal, dan beban kerja tim." },
  { icon: Receipt, title: "Invoice & kwitansi", text: "Tagihan, DP, dan pelunasan rapi — siap kirim ke klien." },
  { icon: LineChart, title: "Keuangan real-time", text: "Arus kas, laporan, dan jurnal akuntansi otomatis." },
];

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { name, logoUrl, invertLogo } = useBrand();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Format email tidak valid";
    if (!password.trim()) e.password = "Kata sandi wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const text = await res.text();
      let data: any = null;
      if (text) {
        try { data = JSON.parse(text); } catch { throw new Error(text || `Login gagal (${res.status})`); }
      }
      if (!res.ok) throw new Error(data?.error || data?.message || text || "Email atau kata sandi salah");
      if (data?.token && data?.user) login(data.token, data.user);
      else if (data?.token) localStorage.setItem("token", data.token);
      else throw new Error("Token tidak ditemukan dari server");
      toast({ title: "Berhasil masuk", description: `Selamat datang di ${name}.` });
      navigate("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Email atau kata sandi salah";
      toast({ variant: "destructive", title: "Gagal masuk", description: msg });
      setErrors({ password: msg });
    } finally {
      setLoading(false);
    }
  }

  // Logo polos (tanpa kotak). Versi terang/gelap diunggah admin di Pengaturan Dokumen.
  const Logo = ({ size = "lg" }: { size?: "lg" | "sm" }) =>
    logoUrl ? (
      <img src={logoUrl} alt={name} style={invertLogo ? { filter: "brightness(0) invert(1)" } : undefined} className={size === "lg" ? "h-16 w-auto max-w-[280px] object-contain object-left" : "h-11 w-auto max-w-[200px] object-contain object-left"} />
    ) : (
      <span className={`font-extrabold tracking-tight ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{name}</span>
    );

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr] bg-background text-foreground">
      {/* Panel merek */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 border-r border-border bg-sidebar">
        <div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(70% 60% at 20% 10%, hsl(var(--primary) / .22), transparent 65%), radial-gradient(60% 50% at 90% 90%, hsl(var(--primary) / .10), transparent 70%)" }} />
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{ backgroundImage: "linear-gradient(hsl(var(--foreground) / .05) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / .05) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at 30% 20%, black 20%, transparent 70%)" }} />

        <div className="relative"><Logo /></div>

        <div className="relative max-w-md">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary mb-4">Panel admin</p>
          <h2 className="text-4xl font-extrabold tracking-tight leading-[1.1]">
            Kelola produksi, klien, dan keuangan dalam satu tempat.
          </h2>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="h-10 w-10 shrink-0 rounded-xl bg-primary/12 text-primary grid place-items-center"><f.icon className="h-5 w-5" /></span>
                <span>
                  <span className="block text-sm font-bold">{f.title}</span>
                  <span className="block text-sm text-muted-foreground mt-0.5">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} {name}. Seluruh hak dilindungi.</p>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Website
          </a>
          <button onClick={toggleTheme} aria-label="Ganti tema"
            className="h-10 w-10 grid place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>

        <div className="flex-1 grid place-items-center px-5 pb-12">
          <div className="w-full max-w-[400px]">
            <div className="lg:hidden mb-8"><Logo size="sm" /></div>

            <h1 className="text-3xl font-extrabold tracking-tight">Masuk</h1>
            <p className="mt-2 text-sm text-muted-foreground">Gunakan akun admin untuk membuka dashboard.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-semibold">Email</label>
                <Input
                  id="email" ref={emailRef} type="email" autoComplete="username" inputMode="email"
                  value={email} onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="nama@perusahaan.com" aria-invalid={!!errors.email}
                  className={`h-12 rounded-xl ${errors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-semibold">Kata sandi</label>
                <div className="relative">
                  <Input
                    id="password" type={show ? "text" : "password"} autoComplete="current-password"
                    value={password} onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="••••••••" aria-invalid={!!errors.password}
                    className={`h-12 rounded-xl pr-12 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                    {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
              </div>

              <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl text-[15px] font-bold shadow-lg shadow-primary/25">
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Memproses…</> : "Masuk"}
              </Button>
            </form>

            <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-success" /> Koneksi terenkripsi. Akses hanya untuk admin yang berwenang.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

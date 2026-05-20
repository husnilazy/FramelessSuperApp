// artifacts/frameless/src/pages/course-page.tsx
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import {
  ArrowLeft, Check, Play, Clock, Award, Users, Zap, Film,
  BookOpen, Star, ChevronRight, Lock, FileText, Shield,
  CheckCircle2, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
}
interface Material {
  id: string; title: string; type: string; description?: string;
}
interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; instructor?: string; level?: string; category?: string;
  curriculumPdfUrl?: string; packages: Package[]; materials: Material[];
}

declare global { interface Window { snap: any; } }

const ORANGE = "hsl(20,100%,58%)";
const BG = "#0a0a0c";
const font = "'Plus Jakarta Sans', sans-serif";

// ── Midtrans Snap loader ───────────────────────────────────────────────────────
function loadSnapScript(isProduction: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (window.snap) { resolve(); return; }
    const existing = document.getElementById("midtrans-snap");
    if (existing) { (existing as any).onload = () => resolve(); return; }
    const s = document.createElement("script");
    s.id = "midtrans-snap";
    s.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

const MATERIAL_ICONS: Record<string, string> = { video: "🎬", pdf: "📄", doc: "📝", link: "🔗" };

const WHY_ITEMS = [
  { icon: "🎥", title: "Kurikulum Praktis", desc: "Belajar langsung dari proyek nyata Frameless Creative, bukan teori saja." },
  { icon: "🧑‍🏫", title: "Mentor Berpengalaman", desc: "Dibimbing oleh sineas profesional dengan track record proyek nasional." },
  { icon: "💻", title: "Akses Lifetime", desc: "Materi terus diperbarui. Sekali bayar, belajar seumur hidup." },
  { icon: "🏆", title: "Sertifikat Resmi", desc: "Sertifikat dari Frameless Creative yang diakui industri kreatif Indonesia." },
  { icon: "👥", title: "Komunitas Aktif", desc: "Bergabung dengan 500+ alumni yang saling support dan kolaborasi." },
  { icon: "🎞️", title: "Feedback Personal", desc: "Review karya kamu langsung oleh mentor berpengalaman di bidangnya." },
];

// ── Enrollment Modal ──────────────────────────────────────────────────────────
interface EnrollModalProps {
  selectedPkg: Package;
  courseName: string;
  onClose: () => void;
  onSuccess: (enrollmentId: string) => void;
}

function EnrollModal({ selectedPkg, courseName, onClose, onSuccess }: EnrollModalProps) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [step, setStep] = useState<"form" | "paying" | "success" | "manual">("form");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nama wajib diisi";
    if (!form.email.trim()) e.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Format email tidak valid";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleEnroll() {
    if (!validate()) return;
    setStep("paying");

    try {
      const res = await fetch("/api/payments/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Server error");
      }

      const data = await res.json();

      // Free / trial
      if (data.free || Number(selectedPkg.price) === 0) {
        setStep("success");
        setTimeout(() => onSuccess(data.enrollmentId), 1800);
        return;
      }

      // No gateway — manual confirmation
      if (data.noGateway) {
        setStep("manual");
        return;
      }

      // Midtrans Snap
      if (data.snapToken) {
        await loadSnapScript(data.isProduction);
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            setStep("success");
            setTimeout(() => onSuccess(data.enrollmentId), 1500);
          },
          onPending: () => {
            toast({ title: "Pembayaran sedang diproses. Kami akan konfirmasi melalui email." });
            onClose();
          },
          onError: () => {
            toast({ variant: "destructive", title: "Pembayaran gagal. Silakan coba lagi." });
            setStep("form");
          },
          onClose: () => {
            setStep("form");
          },
        });
        return;
      }

      throw new Error("Respons tidak dikenali");
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Terjadi kesalahan. Coba lagi." });
      setStep("form");
    }
  }

  const price = Number(selectedPkg.price);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={(e) => { if (e.target === e.currentTarget && step === "form") onClose(); }}
    >
      <div style={{ background: "#111315", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 26, padding: "40px 36px", width: "100%", maxWidth: 460, animation: "fadeUp 0.3s ease", position: "relative" }}>

        {/* Step: Form */}
        {step === "form" && (
          <>
            <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>

            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Daftar Sekarang</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>{courseName}</p>

            {/* Package summary */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, background: ORANGE + "12", border: `1px solid ${ORANGE}30`, marginBottom: 26 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: ORANGE + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen style={{ width: 16, height: 16, color: ORANGE }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>Paket dipilih</p>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0 }}>
                  {selectedPkg.name} ·{" "}
                  <span style={{ color: ORANGE }}>{price === 0 ? "GRATIS" : formatCurrency(price)}</span>
                </p>
              </div>
            </div>

            {/* Form fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              {[
                { k: "name", l: "Nama Lengkap *", t: "text", ph: "Nama lengkap kamu" },
                { k: "email", l: "Email *", t: "email", ph: "email@kamu.com" },
                { k: "phone", l: "No. WhatsApp (opsional)", t: "tel", ph: "+62 8xx-xxxx-xxxx" },
              ].map((f) => (
                <div key={f.k}>
                  <label style={{ fontSize: 11, color: errors[f.k] ? "#f87171" : "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 6 }}>{f.l}</label>
                  <input
                    type={f.t}
                    value={(form as any)[f.k]}
                    onChange={(e) => { setForm((p) => ({ ...p, [f.k]: e.target.value })); if (errors[f.k]) setErrors((p) => ({ ...p, [f.k]: "" })); }}
                    style={{ width: "100%", background: errors[f.k] ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.05)", border: `1px solid ${errors[f.k] ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, padding: "12px 15px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" as any, fontFamily: font, transition: "border-color 0.2s" }}
                    placeholder={f.ph}
                    onFocus={(e) => { if (!errors[f.k]) (e.target as HTMLElement).style.borderColor = ORANGE + "66"; }}
                    onBlur={(e) => { (e.target as HTMLElement).style.borderColor = errors[f.k] ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.1)"; }}
                  />
                  {errors[f.k] && <p style={{ fontSize: 11, color: "#f87171", marginTop: 4 }}>{errors[f.k]}</p>}
                </div>
              ))}
            </div>

            <button
              onClick={handleEnroll}
              style={{ width: "100%", padding: "15px", borderRadius: 14, background: ORANGE, border: "none", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15, fontFamily: font, letterSpacing: "-0.01em", transition: "opacity 0.2s" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.9")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
            >
              {price === 0 ? "Daftar Gratis →" : "Lanjut ke Pembayaran 🔒"}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 16 }}>
              <Shield style={{ width: 12, height: 12, color: "rgba(255,255,255,0.25)" }} />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", margin: 0 }}>Data aman. Pembayaran via Midtrans terenkripsi.</p>
            </div>
          </>
        )}

        {/* Step: Processing */}
        {step === "paying" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 24px" }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Memproses...</h3>
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 1.6 }}>Halaman pembayaran Midtrans akan segera muncul.</p>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#4ade8018", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <CheckCircle2 style={{ width: 36, height: 36, color: "#4ade80" }} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Pendaftaran Berhasil! 🎉</h3>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.65 }}>Selamat datang di Frameless Academy! Mengarahkan ke halaman kelas...</p>
          </div>
        )}

        {/* Step: Manual payment */}
        {step === "manual" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: ORANGE + "15", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <AlertCircle style={{ width: 32, height: 32, color: ORANGE }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 12 }}>Pendaftaran Tercatat!</h3>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, lineHeight: 1.65, marginBottom: 24 }}>
              Tim Frameless Creative akan menghubungi kamu melalui email atau WhatsApp untuk konfirmasi pembayaran dalam 1×24 jam.
            </p>
            <button onClick={onClose} style={{ padding: "12px 28px", borderRadius: 100, background: ORANGE, border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: font }}>
              Oke, Mengerti
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CoursePage() {
  const [, params] = useRoute("/course/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/courses/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  function openEnroll(pkg: Package) {
    setSelectedPkg(pkg);
    setShowModal(true);
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );

  if (!course) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: font }}>
      <Film size={52} color="rgba(255,255,255,0.12)" />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Course tidak ditemukan</p>
      <button onClick={() => navigate("/")} style={{ color: ORANGE, background: "none", border: "none", cursor: "pointer", fontSize: 14, fontFamily: font }}>← Kembali ke beranda</button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const activePkgs = course.packages.filter((p) => p.isActive !== false);
  const trialPkg = activePkgs.find((p) => p.isTrial);
  const paidPkgs = activePkgs.filter((p) => !p.isTrial);
  const minPrice = paidPkgs.length ? Math.min(...paidPkgs.map((p) => Number(p.price))) : 0;

  return (
    <div style={{ fontFamily: font, background: BG, color: "#f0f0f0", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .pkg-card { transition: all 0.2s; cursor: pointer; }
        .pkg-card:hover { border-color: ${ORANGE}55 !important; background: rgba(255,255,255,0.04) !important; }
        @media (max-width: 860px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr 1fr !important; }
          .pkg-grid { grid-template-columns: 1fr !important; }
          .materials-grid { grid-template-columns: 1fr !important; }
          .section-pad { padding: 0 20px 60px !important; }
        }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav style={{ position: "sticky", top: 0, background: "rgba(10,10,12,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px", height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: font }}>
          <ArrowLeft size={15} /> Beranda
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>Frameless Academy</span>
        </div>
        {trialPkg && (
          <button onClick={() => openEnroll(trialPkg)} style={{ padding: "8px 18px", borderRadius: 100, background: ORANGE + "18", border: `1px solid ${ORANGE}44`, color: ORANGE, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
            Coba Gratis
          </button>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="section-pad" style={{ padding: "72px 64px 56px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 64, alignItems: "start" }}>

          {/* Left: Info */}
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
              <span style={{ background: ORANGE + "18", color: ORANGE, fontSize: 11, padding: "5px 14px", borderRadius: 100, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>{course.level}</span>
              {course.category && <span style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", fontSize: 11, padding: "5px 14px", borderRadius: 100, textTransform: "uppercase", fontWeight: 600 }}>{course.category}</span>}
            </div>
            <h1 style={{ fontSize: "clamp(34px,5vw,54px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18, color: "#fff" }}>{course.title}</h1>
            {course.subtitle && <p style={{ fontSize: 18, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 28 }}>{course.subtitle}</p>}

            {/* Social proof */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 32 }}>
              {[{ icon: "⭐", v: "4.9/5.0", l: "Rating" }, { icon: "👥", v: "500+", l: "Alumni" }, { icon: "🏆", v: "Sertifikat", l: "Resmi" }].map((s) => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}><strong style={{ color: "#fff" }}>{s.v}</strong> {s.l}</span>
                </div>
              ))}
            </div>

            {course.instructor && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: ORANGE + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={18} color={ORANGE} />
                </div>
                <div>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: 0, textTransform: "uppercase", letterSpacing: "0.12em" }}>Instruktur</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>{course.instructor}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sticky purchase box */}
          <div style={{ animation: "fadeUp 0.6s ease", position: "sticky", top: 80 }}>
            <div style={{ borderRadius: 22, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }}>
              {/* Thumbnail */}
              <div style={{ aspectRatio: "16/9", background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : `linear-gradient(135deg, #1a0800, #3d1500)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!course.thumbnail && <Film size={56} color={ORANGE + "40"} />}
              </div>

              <div style={{ padding: "22px 24px 26px" }}>
                {minPrice > 0 && (
                  <>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mulai dari</p>
                    <p style={{ fontSize: 32, fontWeight: 900, color: ORANGE, margin: "0 0 18px", letterSpacing: "-0.02em" }}>{formatCurrency(minPrice)}</p>
                  </>
                )}

                {/* Primary CTA */}
                <button
                  onClick={() => openEnroll(paidPkgs[0] || trialPkg!)}
                  style={{ width: "100%", padding: "15px", borderRadius: 14, background: ORANGE, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font, marginBottom: 10 }}
                >
                  {!paidPkgs.length && trialPkg ? "Coba Gratis Sekarang →" : "Daftar Sekarang →"}
                </button>

                {trialPkg && paidPkgs.length > 0 && (
                  <button
                    onClick={() => openEnroll(trialPkg)}
                    style={{ width: "100%", padding: "12px", borderRadius: 14, background: "transparent", border: `1px solid ${ORANGE}44`, color: ORANGE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}
                  >
                    <Play size={12} style={{ display: "inline", marginRight: 6 }} />
                    Coba Trial Gratis Dulu
                  </button>
                )}

                {/* Trust signals */}
                <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
                  {["✅ Garansi 7 hari", "🔒 Bayar aman", "📱 Akses mobile"].map((t) => (
                    <span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{t}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Scroll to packages */}
            <button
              onClick={() => document.getElementById("paket")?.scrollIntoView({ behavior: "smooth" })}
              style={{ width: "100%", marginTop: 12, padding: "11px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: font }}
            >
              Lihat semua paket ↓
            </button>
          </div>
        </div>
      </section>

      {/* ── Description ─────────────────────────────────────────── */}
      {course.description && (
        <section className="section-pad" style={{ padding: "0 64px 60px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 40px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 16, letterSpacing: "-0.02em" }}>Tentang Kursus Ini</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.8, fontSize: 15, whiteSpace: "pre-line", maxWidth: 760 }}>{course.description}</p>
          </div>
        </section>
      )}

      {/* ── Why Frameless ────────────────────────────────────────── */}
      <section className="section-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
            Kenapa Belajar di <span style={{ color: ORANGE }}>Frameless?</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, maxWidth: 460, margin: "0 auto" }}>
            Kami bukan sekadar kursus online — kami komunitas sineas yang saling tumbuh.
          </p>
        </div>
        <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {WHY_ITEMS.map((w) => (
            <div key={w.title}
              style={{ padding: "24px 26px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", transition: "border-color 0.2s, transform 0.2s" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = ORANGE + "30"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{w.icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.01em" }}>{w.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Materials ────────────────────────────────────────────── */}
      {course.materials?.length > 0 && (
        <section className="section-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
          <div className="materials-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }}>
            <div>
              <h2 style={{ fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
                Apa yang Akan <span style={{ color: ORANGE }}>Kamu Pelajari</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, lineHeight: 1.65, marginBottom: 24 }}>
                {course.materials.length} materi pembelajaran yang terstruktur dan siap membawamu dari pemula ke profesional.
              </p>
              {course.curriculumPdfUrl && (
                <a href={course.curriculumPdfUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, border: `1px solid ${ORANGE}44`, color: ORANGE, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  <FileText size={14} /> Download Kurikulum PDF
                </a>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {course.materials.slice(0, 7).map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: ORANGE + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {MATERIAL_ICONS[m.type] || "📌"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: i < 2 ? "#fff" : "rgba(255,255,255,0.6)", margin: 0 }}>{m.title}</p>
                    {m.description && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>{m.description}</p>}
                  </div>
                  {i >= 2 && <Lock size={12} color="rgba(255,255,255,0.2)" />}
                </div>
              ))}
              {course.materials.length > 7 && (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "8px 0" }}>
                  +{course.materials.length - 7} materi lainnya setelah mendaftar
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── Packages ─────────────────────────────────────────────── */}
      <section className="section-pad" id="paket" style={{ padding: "0 64px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
            Pilih <span style={{ color: ORANGE }}>Paket Kelas</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, maxWidth: 440, margin: "0 auto" }}>
            Mulai dengan trial gratis, atau langsung ambil paket penuh dengan semua akses.
          </p>
        </div>

        {/* Trial package */}
        {trialPkg && (
          <div className="pkg-card" onClick={() => openEnroll(trialPkg)}
            style={{ marginBottom: 28, padding: "24px 28px", borderRadius: 20, border: `2px solid ${ORANGE}28`, background: ORANGE + "06", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ width: 50, height: 50, background: ORANGE + "18", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Play size={20} color={ORANGE} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{trialPkg.name}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{trialPkg.description || "Coba tanpa komitmen — tidak perlu kartu kredit"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: ORANGE }}>{Number(trialPkg.price) === 0 ? "GRATIS" : formatCurrency(Number(trialPkg.price))}</div>
              <div style={{ padding: "11px 22px", borderRadius: 12, background: ORANGE, color: "#fff", fontWeight: 700, fontSize: 13 }}>Mulai Trial →</div>
            </div>
          </div>
        )}

        {/* Paid packages */}
        {paidPkgs.length > 0 && (
          <>
            {trialPkg && <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 20, fontWeight: 700 }}>PAKET LENGKAP</p>}
            <div className="pkg-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(paidPkgs.length, 3)}, 1fr)`, gap: 20 }}>
              {paidPkgs.map((pkg, idx) => {
                const features = (() => { try { return JSON.parse(pkg.features || "[]"); } catch { return pkg.features?.split("\n").filter(Boolean) || []; } })();
                const isPopular = paidPkgs.length > 1 && idx === Math.floor(paidPkgs.length / 2);
                return (
                  <div key={pkg.id} className="pkg-card" onClick={() => openEnroll(pkg)}
                    style={{ background: "rgba(255,255,255,0.025)", border: `2px solid ${isPopular ? ORANGE + "55" : "rgba(255,255,255,0.08)"}`, borderRadius: 22, padding: "30px 26px", position: "relative", display: "flex", flexDirection: "column" }}>
                    {isPopular && <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: ORANGE, color: "#fff", fontSize: 10, padding: "4px 18px", borderRadius: 100, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 700 }}>⭐ Most Popular</div>}
                    <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 6 }}>{pkg.name}</div>
                    {pkg.description && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20, lineHeight: 1.55 }}>{pkg.description}</p>}
                    <div style={{ fontSize: 34, fontWeight: 900, color: ORANGE, letterSpacing: "-0.02em", marginBottom: 4 }}>{formatCurrency(Number(pkg.price))}</div>
                    {pkg.durationDays && (
                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
                        <Clock size={11} /> {pkg.durationDays} hari akses
                      </div>
                    )}
                    {features.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                        {features.map((f: string, fi: number) => (
                          <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "rgba(255,255,255,0.62)" }}>
                            <Check size={14} color={ORANGE} style={{ marginTop: 2, flexShrink: 0 }} />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div style={{ padding: "13px", borderRadius: 12, background: isPopular ? ORANGE : "rgba(255,255,255,0.07)", color: isPopular ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14, textAlign: "center" }}>
                      Pilih Paket →
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* No packages edge case */}
        {activePkgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 32px", borderRadius: 20, border: "2px dashed rgba(255,255,255,0.1)" }}>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>Paket kursus belum tersedia. Hubungi kami untuk info lebih lanjut.</p>
          </div>
        )}
      </section>

      {/* ── Social proof banner ──────────────────────────────────── */}
      <section className="section-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "56px 40px", background: `linear-gradient(135deg, ${ORANGE}14, rgba(124,58,237,0.1))`, borderRadius: 26, border: `1px solid ${ORANGE}22` }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: ORANGE, textTransform: "uppercase", marginBottom: 16 }}>JOIN 500+ ALUMNI SUKSES</p>
          <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16 }}>
            Siap Mulai Perjalananmu<br /><span style={{ color: ORANGE }}>sebagai Videografer?</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.65 }}>
            Ratusan alumni sudah membuktikan. Kini giliran kamu.
          </p>
          <button
            onClick={() => document.getElementById("paket")?.scrollIntoView({ behavior: "smooth" })}
            style={{ padding: "14px 32px", borderRadius: 100, background: ORANGE, border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: font }}
          >
            Lihat Paket & Daftar →
          </button>
        </div>
      </section>

      {/* ── Enrollment Modal ─────────────────────────────────────── */}
      {showModal && selectedPkg && (
        <EnrollModal
          selectedPkg={selectedPkg}
          courseName={course.title}
          onClose={() => { setShowModal(false); setSelectedPkg(null); }}
          onSuccess={(enrollmentId) => navigate(`/portal/${enrollmentId}`)}
        />
      )}
    </div>
  );
}
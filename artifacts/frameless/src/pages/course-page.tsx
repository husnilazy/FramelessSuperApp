import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Film,
  Lock,
  Play,
  Shield,
  Star,
  Users,
} from "lucide-react";

interface Package {
  id: string;
  name: string;
  price: string;
  isTrial: boolean;
  durationDays?: number;
  features?: string;
  description?: string;
  isActive?: boolean;
}

interface Material {
  id: string;
  title: string;
  type: string;
  description?: string;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  highlightVideoUrl?: string;
  instructor?: string;
  level?: string;
  category?: string;
  curriculumPdfUrl?: string;
  packages: Package[];
  materials: Material[];
}

declare global {
  interface Window {
    snap: any;
  }
}

const ORANGE = "hsl(20,100%,58%)";
const BG = "#0a0a0c";
const PANEL = "rgba(255,255,255,0.04)";
const BORDER = "rgba(255,255,255,0.09)";
const font = "'Plus Jakarta Sans', sans-serif";

function ytId(url?: string) {
  if (!url) return null;
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/)?.[1] ?? null;
}

function watchUrl(url: string) {
  const id = ytId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;

  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;

  return url;
}

function getThumb(url?: string, custom?: string) {
  if (custom) return custom;
  const id = ytId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "";
}

function isDirectVideo(url?: string) {
  return !!url && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url);
}

function parseFeatures(features?: string) {
  if (!features) return [];
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return features.split("\n").map((item) => item.trim()).filter(Boolean);
  }
}

function loadSnapScript(isProduction: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (window.snap) {
      resolve();
      return;
    }
    const existing = document.getElementById("midtrans-snap");
    if (existing) {
      (existing as any).onload = () => resolve();
      return;
    }
    const script = document.createElement("script");
    script.id = "midtrans-snap";
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 210,
        background: "rgba(0,0,0,0.92)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 18,
          right: 18,
          width: 42,
          height: 42,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(255,255,255,0.08)",
          color: "#fff",
          cursor: "pointer",
          fontSize: 18,
        }}
      >
        x
      </button>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "min(94vw,1120px)", aspectRatio: "16 / 9" }}>
        {isDirectVideo(url) ? (
          <video src={url} controls autoPlay playsInline style={{ width: "100%", height: "100%", borderRadius: 18, background: "#000" }} />
        ) : (
          <iframe src={watchUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 18, border: "none" }} allow="autoplay; fullscreen" allowFullScreen />
        )}
      </div>
    </div>
  );
}

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
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Nama wajib diisi";
    if (!form.email.trim()) nextErrors.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = "Format email tidak valid";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleEnroll() {
    if (!validate()) return;
    setStep("paying");

    try {
      const response = await fetch("/api/payments/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: selectedPkg.id,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || "Server error");
      }

      const data = await response.json();

      if (data.free || Number(selectedPkg.price) === 0) {
        setStep("success");
        setTimeout(() => onSuccess(data.enrollmentId), 1600);
        return;
      }

      if (data.noGateway) {
        setStep("manual");
        return;
      }

      if (data.snapToken) {
        await loadSnapScript(data.isProduction);
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            setStep("success");
            setTimeout(() => onSuccess(data.enrollmentId), 1200);
          },
          onPending: () => {
            toast({ title: "Pembayaran sedang diproses. Kami akan konfirmasi melalui email." });
            onClose();
          },
          onError: () => {
            toast({ variant: "destructive", title: "Pembayaran gagal. Silakan coba lagi." });
            setStep("form");
          },
          onClose: () => setStep("form"),
        });
        return;
      }

      throw new Error("Respons pembayaran tidak dikenali");
    } catch (error: any) {
      toast({ variant: "destructive", title: error.message || "Terjadi kesalahan. Coba lagi." });
      setStep("form");
    }
  }

  const price = Number(selectedPkg.price);

  return (
    <div
      onClick={(event) => { if (event.target === event.currentTarget && step === "form") onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 460, borderRadius: 26, border: `1px solid ${BORDER}`, background: "#111315", padding: "36px 32px", position: "relative" }}>
        {step === "form" && (
          <>
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "none",
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.6)",
                cursor: "pointer",
                fontSize: 17,
              }}
            >
              x
            </button>

            <h3 style={{ margin: "0 0 6px", color: "#fff", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>Daftar Sekarang</h3>
            <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.42)", fontSize: 13 }}>{courseName}</p>

            <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 16, border: `1px solid ${ORANGE}30`, background: `${ORANGE}12`, marginBottom: 24 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ORANGE}1f`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={17} color={ORANGE} />
              </div>
              <div>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" }}>Paket dipilih</p>
                <p style={{ margin: "2px 0 0", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  {selectedPkg.name} <span style={{ color: ORANGE }}>- {price === 0 ? "GRATIS" : formatCurrency(price)}</span>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 22 }}>
              {[
                { key: "name", label: "Nama Lengkap *", type: "text", placeholder: "Nama lengkap kamu" },
                { key: "email", label: "Email *", type: "email", placeholder: "email@kamu.com" },
                { key: "phone", label: "No. WhatsApp", type: "tel", placeholder: "+62 8xx xxxx xxxx" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{ display: "block", marginBottom: 6, color: errors[field.key] ? "#f87171" : "rgba(255,255,255,0.42)", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={(event) => {
                      setForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                      if (errors[field.key]) setErrors((prev) => ({ ...prev, [field.key]: "" }));
                    }}
                    placeholder={field.placeholder}
                    style={{
                      width: "100%",
                      borderRadius: 12,
                      border: `1px solid ${errors[field.key] ? "rgba(248,113,113,0.45)" : "rgba(255,255,255,0.12)"}`,
                      background: errors[field.key] ? "rgba(248,113,113,0.08)" : "rgba(255,255,255,0.05)",
                      padding: "12px 14px",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none",
                      fontFamily: font,
                    }}
                  />
                  {errors[field.key] && <p style={{ margin: "6px 0 0", color: "#f87171", fontSize: 11 }}>{errors[field.key]}</p>}
                </div>
              ))}
            </div>

            <button
              onClick={handleEnroll}
              style={{
                width: "100%",
                border: "none",
                borderRadius: 14,
                background: ORANGE,
                color: "#fff",
                padding: "15px 18px",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: font,
              }}
            >
              {price === 0 ? "Daftar Gratis" : "Lanjut ke Pembayaran"}
            </button>

            <div style={{ display: "flex", justifyContent: "center", gap: 10, alignItems: "center", marginTop: 14 }}>
              <Shield size={13} color="rgba(255,255,255,0.25)" />
              <p style={{ margin: 0, color: "rgba(255,255,255,0.25)", fontSize: 11 }}>Data aman. Pembayaran terenkripsi.</p>
            </div>
          </>
        )}

        {step === "paying" && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin .8s linear infinite", margin: "0 auto 22px" }} />
            <h3 style={{ margin: "0 0 8px", fontSize: 21, fontWeight: 800, color: "#fff" }}>Memproses Pembayaran</h3>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 1.6 }}>Jendela pembayaran akan muncul sebentar lagi.</p>
          </div>
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ width: 74, height: 74, borderRadius: "50%", background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <CheckCircle2 size={38} color="#4ade80" />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#fff" }}>Pendaftaran Berhasil</h3>
            <p style={{ margin: 0, color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 1.6 }}>Kamu akan diarahkan ke portal kelas.</p>
          </div>
        )}

        {step === "manual" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: `${ORANGE}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
              <AlertCircle size={34} color={ORANGE} />
            </div>
            <h3 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 800, color: "#fff" }}>Pendaftaran Tercatat</h3>
            <p style={{ margin: "0 0 22px", color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 1.65 }}>
              Tim kami akan menghubungi kamu melalui email atau WhatsApp untuk konfirmasi pembayaran.
            </p>
            <button onClick={onClose} style={{ border: "none", borderRadius: 100, background: ORANGE, color: "#fff", padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
              Oke, Mengerti
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CoursePage() {
  const [, params] = useRoute("/course/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/courses/${encodeURIComponent(slug)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        setCourse(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  function openEnroll(pkg: Package) {
    setSelectedPkg(pkg);
    setShowEnroll(true);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        <div style={{ width: 42, height: 42, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, color: "#fff", fontFamily: font }}>
        <Film size={54} color="rgba(255,255,255,0.14)" />
        <p style={{ margin: 0, color: "rgba(255,255,255,0.45)", fontSize: 15 }}>Course tidak ditemukan</p>
        <button onClick={() => navigate("/")} style={{ border: "none", background: "none", color: ORANGE, cursor: "pointer", fontFamily: font, fontSize: 14 }}>
          Kembali ke beranda
        </button>
      </div>
    );
  }

  const activePkgs = course.packages.filter((pkg) => pkg.isActive !== false);
  const trialPkg = activePkgs.find((pkg) => pkg.isTrial) || null;
  const paidPkgs = activePkgs.filter((pkg) => !pkg.isTrial);
  const minPrice = paidPkgs.length ? Math.min(...paidPkgs.map((pkg) => Number(pkg.price))) : 0;
  const featuredPkg = paidPkgs[0] || trialPkg;
  const poster = getThumb(course.highlightVideoUrl, course.thumbnail);
  const descriptionPreview = (course.description || course.subtitle || "").trim();

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: font }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .page-shell { max-width: 1240px; margin: 0 auto; padding: 0 28px; }
        .hero-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(360px, .92fr); gap: 34px; align-items: start; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .package-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 18px; }
        .info-grid { display: grid; grid-template-columns: 1.1fr .9fr; gap: 22px; }
        .why-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .surface { background: ${PANEL}; border: 1px solid ${BORDER}; border-radius: 24px; }
        .package-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
        .package-card:hover { transform: translateY(-4px); border-color: ${ORANGE}55 !important; box-shadow: 0 18px 48px rgba(0,0,0,.28); }
        @media (max-width: 980px) {
          .hero-grid, .info-grid, .why-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 640px) {
          .page-shell { padding: 0 18px; }
          .stats-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <nav style={{ position: "sticky", top: 0, zIndex: 80, backdropFilter: "blur(20px)", background: "rgba(10,10,12,0.88)", borderBottom: `1px solid ${BORDER}` }}>
        <div className="page-shell" style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
          <button onClick={() => navigate("/")} style={{ border: "none", background: "none", color: "rgba(255,255,255,.58)", display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 600 }}>
            <ArrowLeft size={15} /> Beranda
          </button>
          <div style={{ textAlign: "center", fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em" }}>Frameless Academy</div>
          {featuredPkg ? (
            <button onClick={() => openEnroll(featuredPkg)} style={{ border: "none", borderRadius: 100, background: ORANGE, color: "#fff", padding: "10px 18px", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 700 }}>
              Daftar
            </button>
          ) : (
            <div style={{ width: 78 }} />
          )}
        </div>
      </nav>

      <section className="page-shell" style={{ paddingTop: 36, paddingBottom: 32 }}>
        <div className="hero-grid">
          <div style={{ animation: "fadeUp .45s ease both" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {course.level && <span style={{ padding: "6px 14px", borderRadius: 100, background: `${ORANGE}18`, border: `1px solid ${ORANGE}35`, color: ORANGE, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em" }}>{course.level}</span>}
              {course.category && <span style={{ padding: "6px 14px", borderRadius: 100, background: "rgba(255,255,255,.06)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,.58)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{course.category}</span>}
            </div>

            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(34px,5vw,62px)", lineHeight: 1.02, letterSpacing: "-0.05em", fontWeight: 900 }}>
              {course.title}
            </h1>

            {course.subtitle && (
              <p style={{ margin: "0 0 18px", maxWidth: 720, color: "rgba(255,255,255,.55)", fontSize: 18, lineHeight: 1.65 }}>
                {course.subtitle}
              </p>
            )}

            {descriptionPreview && (
              <p style={{ margin: "0 0 26px", maxWidth: 720, color: "rgba(255,255,255,.42)", fontSize: 14, lineHeight: 1.8 }}>
                {descriptionPreview.length > 220 ? `${descriptionPreview.slice(0, 220)}...` : descriptionPreview}
              </p>
            )}

            <div className="stats-grid" style={{ marginBottom: 26 }}>
              {[
                { icon: <Star size={14} color={ORANGE} />, label: "Rating", value: "4.9/5" },
                { icon: <Users size={14} color={ORANGE} />, label: "Alumni", value: "500+" },
                { icon: <Award size={14} color={ORANGE} />, label: "Sertifikat", value: "Included" },
                { icon: <BookOpen size={14} color={ORANGE} />, label: "Materi", value: `${course.materials?.length || 0}+` },
              ].map((item) => (
                <div key={item.label} className="surface" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>{item.icon}<span style={{ fontSize: 11, color: "rgba(255,255,255,.38)", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>{item.label}</span></div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em" }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              {featuredPkg && (
                <button onClick={() => openEnroll(featuredPkg)} style={{ border: "none", borderRadius: 100, background: ORANGE, color: "#fff", padding: "14px 24px", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 800 }}>
                  {featuredPkg.isTrial ? "Mulai Trial" : "Daftar Sekarang"}
                </button>
              )}
              {course.highlightVideoUrl && (
                <button onClick={() => setPreviewUrl(course.highlightVideoUrl || null)} style={{ borderRadius: 100, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.04)", color: "#fff", padding: "13px 22px", cursor: "pointer", fontFamily: font, fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Play size={14} fill="#fff" /> Tonton Highlight
                </button>
              )}
            </div>

            {course.instructor && (
              <div className="surface" style={{ padding: "18px 20px", display: "inline-flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${ORANGE}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={18} color={ORANGE} />
                </div>
                <div>
                  <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>Instruktur</p>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{course.instructor}</p>
                </div>
              </div>
            )}
          </div>

          <div style={{ animation: "fadeUp .55s ease both" }}>
            <div className="surface" style={{ overflow: "hidden" }}>
              <div style={{ aspectRatio: "16 / 10", position: "relative", background: poster ? `url(${poster}) center/cover` : "linear-gradient(135deg,#1a0800,#3d1500)" }}>
                {course.highlightVideoUrl ? (
                  isDirectVideo(course.highlightVideoUrl) ? (
                    <video src={course.highlightVideoUrl} poster={poster || undefined} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : poster ? (
                    <img src={poster} alt={course.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null
                ) : poster ? (
                  <img src={poster} alt={course.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Film size={60} color="rgba(255,255,255,.16)" />
                  </div>
                )}

                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,12,.78) 0%, rgba(10,10,12,.18) 52%, rgba(10,10,12,.2) 100%)" }} />

                {course.highlightVideoUrl && (
                  <button onClick={() => setPreviewUrl(course.highlightVideoUrl || null)} style={{ position: "absolute", inset: "auto auto 22px 22px", border: "none", borderRadius: 100, background: ORANGE, color: "#fff", padding: "12px 18px", cursor: "pointer", fontFamily: font, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <Play size={13} fill="#fff" /> Play Highlight
                  </button>
                )}

                <div style={{ position: "absolute", right: 20, bottom: 20, textAlign: "right" }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>Mulai dari</p>
                  <p style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", color: ORANGE }}>{minPrice > 0 ? formatCurrency(minPrice) : trialPkg ? "GRATIS" : "-"}</p>
                </div>
              </div>

              <div style={{ padding: 22 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                  {[
                    { label: "Paket", value: `${activePkgs.length}` },
                    { label: "Materi", value: `${course.materials?.length || 0}` },
                    { label: "Trial", value: trialPkg ? "Ada" : "Tidak" },
                  ].map((item) => (
                    <div key={item.label} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.03)", padding: "14px 12px" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.34)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6, fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800 }}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, color: "rgba(255,255,255,.36)", fontSize: 11 }}>
                  <span>Belajar lewat desktop atau mobile</span>
                  <span>Pembayaran aman</span>
                  <span>Sertifikat tersedia</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="page-shell" style={{ paddingBottom: 22 }}>
        <div className="info-grid">
          {course.description && (
            <div className="surface" style={{ padding: "28px 28px 30px" }}>
              <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Tentang Course</p>
              <h2 style={{ margin: "0 0 14px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>Belajar lebih terarah dan praktis</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,.54)", fontSize: 14, lineHeight: 1.85, whiteSpace: "pre-line" }}>{course.description}</p>
            </div>
          )}

          <div className="surface" style={{ padding: "28px 24px 26px" }}>
            <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Quick Summary</p>
            <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Sebelum pilih paket</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                `Akses ${activePkgs.length} paket pembelajaran.`,
                `${course.materials?.length || 0}+ materi tersusun untuk progres belajar.`,
                trialPkg ? "Ada opsi trial untuk mulai tanpa komitmen penuh." : "Langsung pilih paket penuh untuk akses lengkap.",
                course.curriculumPdfUrl ? "Kurikulum PDF tersedia untuk diunduh." : "Kurikulum detail tersedia di dalam materi course.",
              ].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "rgba(255,255,255,.58)", fontSize: 13, lineHeight: 1.65 }}>
                  <Check size={14} color={ORANGE} style={{ flexShrink: 0, marginTop: 3 }} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            {course.curriculumPdfUrl && (
              <a href={course.curriculumPdfUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", color: ORANGE, fontSize: 13, fontWeight: 700 }}>
                <FileText size={14} /> Download Kurikulum
              </a>
            )}
          </div>
        </div>
      </section>

      <section id="paket" className="page-shell" style={{ paddingTop: 18, paddingBottom: 30 }}>
        <div style={{ marginBottom: 22 }}>
          <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Paket Kelas</p>
          <h2 style={{ margin: "0 0 8px", fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.04em" }}>Pilih paket yang paling pas</h2>
          <p style={{ margin: 0, color: "rgba(255,255,255,.45)", fontSize: 15, lineHeight: 1.7 }}>Landing page sekarang cukup kasih teaser. Detail paket lengkap memang dipusatkan di sini.</p>
        </div>

        {trialPkg && (
          <button
            onClick={() => openEnroll(trialPkg)}
            className="surface package-card"
            style={{ width: "100%", marginBottom: 18, padding: "22px 24px", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: `${ORANGE}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Play size={20} color={ORANGE} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>{trialPkg.name}</span>
                  <span style={{ padding: "4px 10px", borderRadius: 100, background: `${ORANGE}16`, border: `1px solid ${ORANGE}30`, color: ORANGE, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Trial</span>
                </div>
                <p style={{ margin: 0, color: "rgba(255,255,255,.44)", fontSize: 13, lineHeight: 1.6 }}>{trialPkg.description || "Coba kelas ini dulu sebelum mengambil paket lengkap."}</p>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: ORANGE }}>{Number(trialPkg.price) === 0 ? "GRATIS" : formatCurrency(Number(trialPkg.price))}</div>
              <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, color: "#fff", fontSize: 12, fontWeight: 700 }}>Mulai Trial <ChevronRight size={13} /></div>
            </div>
          </button>
        )}

        {paidPkgs.length > 0 ? (
          <div className="package-grid">
            {paidPkgs.map((pkg, index) => {
              const features = parseFeatures(pkg.features);
              const isPopular = paidPkgs.length > 1 && index === Math.floor(paidPkgs.length / 2);
              return (
                <button
                  key={pkg.id}
                  onClick={() => openEnroll(pkg)}
                  className="surface package-card"
                  style={{ textAlign: "left", padding: "26px 22px 22px", cursor: "pointer", position: "relative", borderColor: isPopular ? `${ORANGE}66` : BORDER }}
                >
                  {isPopular && (
                    <div style={{ position: "absolute", top: 16, right: 16, padding: "5px 10px", borderRadius: 100, background: `${ORANGE}18`, border: `1px solid ${ORANGE}30`, color: ORANGE, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                      Popular
                    </div>
                  )}

                  <div style={{ marginBottom: 10 }}>
                    <h3 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em" }}>{pkg.name}</h3>
                    {pkg.description && <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.43)", fontSize: 13, lineHeight: 1.6 }}>{pkg.description}</p>}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: "-0.04em", color: ORANGE }}>{formatCurrency(Number(pkg.price))}</div>
                    {pkg.durationDays && <div style={{ marginTop: 6, color: "rgba(255,255,255,.38)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}><Clock size={12} /> {pkg.durationDays} hari akses</div>}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20, minHeight: 118 }}>
                    {(features.length > 0 ? features.slice(0, 5) : ["Akses materi utama", "Support pembelajaran", "Template belajar terstruktur"]).map((feature) => (
                      <div key={feature} style={{ display: "flex", alignItems: "flex-start", gap: 9, color: "rgba(255,255,255,.58)", fontSize: 13, lineHeight: 1.55 }}>
                        <Check size={14} color={ORANGE} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "inline-flex", alignItems: "center", gap: 7, color: isPopular ? "#fff" : ORANGE, fontSize: 13, fontWeight: 800 }}>
                    Ambil Paket <ChevronRight size={14} />
                  </div>
                </button>
              );
            })}
          </div>
        ) : !trialPkg ? (
          <div className="surface" style={{ padding: "30px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, color: "rgba(255,255,255,.42)", fontSize: 14 }}>Paket course belum tersedia. Hubungi kami untuk info lebih lanjut.</p>
          </div>
        ) : null}
      </section>

      {course.materials?.length > 0 && (
        <section className="page-shell" style={{ paddingTop: 24, paddingBottom: 30 }}>
          <div className="info-grid">
            <div className="surface" style={{ padding: "28px 28px 30px" }}>
              <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Materi Pembelajaran</p>
              <h2 style={{ margin: "0 0 10px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>Apa yang akan kamu pelajari</h2>
              <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,.45)", fontSize: 14, lineHeight: 1.75 }}>
                {course.materials.length} materi disusun dari pondasi sampai praktik, supaya progres belajarnya lebih jelas dan tidak lompat-lompat.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {course.materials.slice(0, 8).map((material, index) => (
                  <div key={material.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px", borderRadius: 16, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.03)" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: `${ORANGE}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <BookOpen size={15} color={ORANGE} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{material.title}</span>
                        <span style={{ padding: "3px 8px", borderRadius: 100, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.45)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{material.type}</span>
                      </div>
                      {material.description && <p style={{ margin: 0, color: "rgba(255,255,255,.4)", fontSize: 12, lineHeight: 1.6 }}>{material.description}</p>}
                    </div>
                    {index >= 2 && <Lock size={13} color="rgba(255,255,255,.24)" style={{ marginTop: 4 }} />}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface" style={{ padding: "28px 24px 26px" }}>
              <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Kenapa Course Ini</p>
              <h2 style={{ margin: "0 0 16px", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>Belajar dengan ritme yang lebih enak</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  "Struktur materi dibuat bertahap dari pondasi ke praktik.",
                  "Akses bisa dibuka dari desktop maupun mobile.",
                  "Ada kombinasi video, file, dan materi pendukung.",
                  "Paket dan trial dipisah jelas supaya kamu gampang pilih.",
                ].map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, color: "rgba(255,255,255,.56)", fontSize: 13, lineHeight: 1.65 }}>
                    <Check size={14} color={ORANGE} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="page-shell" style={{ paddingTop: 24, paddingBottom: 64 }}>
        <div className="why-grid">
          {[
            { title: "Praktikal", body: "Lebih banyak fokus ke hasil dan workflow nyata, bukan teori yang berputar-putar." },
            { title: "Terarah", body: "Mulai dari level awal sampai paket yang lebih lengkap, semuanya punya jalur yang jelas." },
            { title: "Siap Dipakai", body: "Setelah daftar, semua detail paket, harga, dan materi tetap rapi di satu halaman ini." },
          ].map((item) => (
            <div key={item.title} className="surface" style={{ padding: "24px 22px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>{item.title}</h3>
              <p style={{ margin: 0, color: "rgba(255,255,255,.44)", fontSize: 13, lineHeight: 1.7 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="page-shell" style={{ paddingBottom: 82 }}>
        <div className="surface" style={{ padding: "38px 32px", background: `linear-gradient(135deg, ${ORANGE}12, rgba(255,255,255,0.03))` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: "0 0 10px", color: ORANGE, fontSize: 10, letterSpacing: ".18em", textTransform: "uppercase", fontWeight: 700 }}>Siap Mulai</p>
              <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,4vw,40px)", fontWeight: 900, letterSpacing: "-0.04em" }}>Pilih paket dan mulai belajar dengan lebih fokus</h2>
              <p style={{ margin: 0, color: "rgba(255,255,255,.44)", fontSize: 14, lineHeight: 1.7 }}>Preview highlight ada di atas, detail paket ada di sini, dan proses daftar tinggal satu langkah.</p>
            </div>
            {featuredPkg && (
              <button onClick={() => openEnroll(featuredPkg)} style={{ border: "none", borderRadius: 100, background: ORANGE, color: "#fff", padding: "14px 26px", cursor: "pointer", fontFamily: font, fontSize: 15, fontWeight: 800 }}>
                {featuredPkg.isTrial ? "Mulai Trial" : "Daftar Sekarang"}
              </button>
            )}
          </div>
        </div>
      </section>

      {previewUrl && <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}

      {showEnroll && selectedPkg && (
        <EnrollModal
          selectedPkg={selectedPkg}
          courseName={course.title}
          onClose={() => {
            setShowEnroll(false);
            setSelectedPkg(null);
          }}
          onSuccess={(enrollmentId) => navigate(`/portal/${enrollmentId}`)}
        />
      )}
    </div>
  );
}

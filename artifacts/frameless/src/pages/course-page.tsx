import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, Check, Play, Clock, Award, Users, Zap, Film, BookOpen, Star, ChevronRight, Lock, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
}
interface Material { id: string; title: string; type: string; description?: string; }
interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; instructor?: string; level?: string; category?: string;
  curriculumPdfUrl?: string; packages: Package[]; materials: Material[];
}

declare global { interface Window { snap: any; } }

const ORANGE = "hsl(20,100%,58%)";
const BG = "#0a0a0c";
const font = "'Plus Jakarta Sans', sans-serif";

function loadSnapScript(isProduction: boolean): Promise<void> {
  return new Promise((resolve) => {
    if (window.snap) { resolve(); return; }
    const existing = document.getElementById("midtrans-snap");
    if (existing) { existing.onload = () => resolve(); return; }
    const s = document.createElement("script");
    s.id = "midtrans-snap";
    s.src = isProduction ? "https://app.midtrans.com/snap/snap.js" : "https://app.sandbox.midtrans.com/snap/snap.js";
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

export default function CoursePage() {
  const [, params] = useRoute("/course/:slug");
  const [, navigate] = useLocation();
  const slug = params?.slug;
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState<"form" | "paying">("form");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/courses/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  async function handleEnroll() {
    if (!selectedPkg || !course) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast({ variant: "destructive", title: "Nama dan email wajib diisi" }); return;
    }
    setEnrolling(true);
    setFormStep("paying");
    try {
      const res = await fetch("/api/payments/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId: course.id, packageId: selectedPkg.id, name: form.name, email: form.email, phone: form.phone }),
      });
      const data = await res.json();

      if (data.free || Number(selectedPkg.price) === 0) {
        toast({ title: "Pendaftaran berhasil! 🎉 Selamat datang di kelas." });
        navigate(`/portal/${data.enrollmentId}`);
        return;
      }

      if (data.noGateway) {
        toast({ title: "Pendaftaran tercatat! Tim kami akan menghubungi Anda untuk konfirmasi pembayaran." });
        setShowForm(false);
        return;
      }

      if (data.snapToken) {
        await loadSnapScript(data.isProduction);
        window.snap.pay(data.snapToken, {
          onSuccess: () => { navigate(`/portal/${data.enrollmentId}`); },
          onPending: () => { toast({ title: "Pembayaran sedang diproses..." }); setShowForm(false); },
          onError: () => { toast({ variant: "destructive", title: "Pembayaran gagal" }); setFormStep("form"); },
          onClose: () => { setFormStep("form"); setEnrolling(false); },
        });
        return;
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Terjadi kesalahan, coba lagi" });
    }
    setEnrolling(false);
    setFormStep("form");
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!course) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: font }}>
      <Film size={52} color="rgba(255,255,255,0.15)" />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>Course tidak ditemukan</p>
      <button onClick={() => navigate("/")} style={{ color: ORANGE, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Kembali ke beranda</button>
    </div>
  );

  const activePkgs = course.packages.filter(p => p.isActive !== false);
  const trialPkg = activePkgs.find(p => p.isTrial);
  const paidPkgs = activePkgs.filter(p => !p.isTrial);
  const minPrice = paidPkgs.length ? Math.min(...paidPkgs.map(p => Number(p.price))) : 0;

  return (
    <div style={{ fontFamily: font, background: BG, color: "#f0f0f0", minHeight: "100vh", position: "relative" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .pkg-card { transition: all 0.2s; cursor: pointer; }
        .pkg-card:hover { border-color: ${ORANGE}55 !important; background: rgba(255,255,255,0.04) !important; }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .why-grid { grid-template-columns: 1fr 1fr !important; }
          .pkg-grid { grid-template-columns: 1fr !important; }
          .mob-pad { padding-left: 20px !important; padding-right: 20px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, background: "rgba(10,10,12,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 50 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: font }}>
          <ArrowLeft size={15} /> Kembali
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
          </div>
          <span style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>Frameless Academy</span>
        </div>
        {trialPkg && (
          <button onClick={() => { setSelectedPkg(trialPkg); setShowForm(true); }} style={{ padding: "8px 18px", borderRadius: 100, background: `${ORANGE}18`, border: `1px solid ${ORANGE}44`, color: ORANGE, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: font }}>
            Coba Gratis
          </button>
        )}
      </nav>

      {/* Hero */}
      <section className="mob-pad" style={{ padding: "72px 64px 56px", maxWidth: 1200, margin: "0 auto" }}>
        <div className="hero-grid" style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 60, alignItems: "center" }}>
          <div style={{ animation: "fadeUp 0.5s ease" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
              <span style={{ background: `${ORANGE}18`, color: ORANGE, fontSize: 10, padding: "5px 13px", borderRadius: 100, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>{course.level}</span>
              <span style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", fontSize: 10, padding: "5px 13px", borderRadius: 100, textTransform: "uppercase", fontWeight: 700 }}>{course.category}</span>
              {minPrice > 0 && <span style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.5)", fontSize: 10, padding: "5px 13px", borderRadius: 100, fontWeight: 700 }}>ab. {formatCurrency(minPrice)}</span>}
            </div>
            <h1 style={{ fontSize: "clamp(36px,5vw,56px)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: 18, color: "#fff" }}>{course.title}</h1>
            {course.subtitle && <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, marginBottom: 28 }}>{course.subtitle}</p>}

            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 36 }}>
              {[{ icon: "⭐", v: "4.9/5.0", l: "Rating" }, { icon: "👥", v: "500+", l: "Alumni" }, { icon: "🏆", v: "Sertifikat", l: "Resmi" }].map(s => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)" }}><strong style={{ color: "#fff" }}>{s.v}</strong> {s.l}</span>
                </div>
              ))}
            </div>

            {course.instructor && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${ORANGE}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={16} color={ORANGE} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0, textTransform: "uppercase", letterSpacing: "0.1em" }}>Instruktur</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{course.instructor}</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Thumbnail + quick CTA */}
          <div style={{ animation: "fadeUp 0.6s ease" }}>
            <div style={{ borderRadius: 20, overflow: "hidden", aspectRatio: "4/3", background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : `linear-gradient(135deg, #1a0800, #3d1500)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
              {!course.thumbnail && <Film size={60} color="rgba(255,107,53,0.25)" />}
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "20px 22px" }}>
              {minPrice > 0 && (
                <>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>Mulai dari</p>
                  <p style={{ fontSize: 30, fontWeight: 900, color: ORANGE, margin: "0 0 14px", letterSpacing: "-0.02em" }}>{formatCurrency(minPrice)}</p>
                </>
              )}
              <button
                onClick={() => { setSelectedPkg(paidPkgs[0] || trialPkg || null); setShowForm(true); }}
                style={{ width: "100%", padding: "14px", borderRadius: 12, background: ORANGE, border: "none", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: font, letterSpacing: "-0.01em" }}>
                {trialPkg && !paidPkgs.length ? "Coba Gratis Sekarang" : "Daftar Sekarang →"}
              </button>
              {trialPkg && paidPkgs.length > 0 && (
                <button
                  onClick={() => { setSelectedPkg(trialPkg); setShowForm(true); }}
                  style={{ width: "100%", marginTop: 10, padding: "12px", borderRadius: 12, background: "transparent", border: `1px solid ${ORANGE}44`, color: ORANGE, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: font }}>
                  <Play size={12} style={{ display: "inline", marginRight: 6 }} />Coba Trial Gratis Dulu
                </button>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 14, justifyContent: "center" }}>
                {["✅ Garansi 7 hari", "🔒 Pembayaran aman", "📱 Akses mobile"].map(t => (
                  <span key={t} style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What You'll Learn */}
      {course.description && (
        <section className="mob-pad" style={{ padding: "0 64px 60px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "36px 40px" }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: "#fff", marginBottom: 16, letterSpacing: "-0.02em" }}>Tentang Course Ini</h2>
            <p style={{ color: "rgba(255,255,255,0.55)", lineHeight: 1.8, fontSize: 15, whiteSpace: "pre-line", maxWidth: 760 }}>{course.description}</p>
          </div>
        </section>
      )}

      {/* Why Choose Frameless */}
      <section className="mob-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
            Kenapa Belajar di <span style={{ color: ORANGE }}>Frameless?</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
            Kami bukan sekadar kursus online — kami komunitas sineas yang saling tumbuh bersama.
          </p>
        </div>
        <div className="why-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {WHY_ITEMS.map(w => (
            <div key={w.title} style={{ padding: "24px 26px", borderRadius: 18, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", transition: "border-color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${ORANGE}30`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{w.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-0.01em" }}>{w.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{w.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Materials Preview */}
      {course.materials && course.materials.length > 0 && (
        <section className="mob-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
            <div>
              <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
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
            <div style={{ space: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {course.materials.slice(0, 6).map((m, i) => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: `${ORANGE}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {MATERIAL_ICONS[m.type] || "📌"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{m.title}</p>
                    {m.description && <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "2px 0 0" }}>{m.description}</p>}
                  </div>
                  {i > 1 && <Lock size={12} color="rgba(255,255,255,0.2)" />}
                </div>
              ))}
              {course.materials.length > 6 && (
                <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, padding: "10px 0" }}>
                  +{course.materials.length - 6} materi lainnya setelah mendaftar
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Packages */}
      <section className="mob-pad" id="paket" style={{ padding: "0 64px 100px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(30px,4vw,46px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 12 }}>
            Pilih <span style={{ color: ORANGE }}>Paket Kelas</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 16, maxWidth: 460, margin: "0 auto" }}>
            Mulai dengan trial gratis, atau langsung ambil paket lengkap dengan akses semua materi.
          </p>
        </div>

        {/* Trial */}
        {trialPkg && (
          <div className="pkg-card" onClick={() => { setSelectedPkg(trialPkg); setShowForm(true); }}
            style={{ marginBottom: 24, padding: "24px 28px", borderRadius: 18, border: `2px solid ${selectedPkg?.id === trialPkg.id ? ORANGE : `${ORANGE}28`}`, background: selectedPkg?.id === trialPkg.id ? `${ORANGE}0a` : "rgba(255,107,53,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <div style={{ width: 48, height: 48, background: `${ORANGE}18`, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Play size={20} color={ORANGE} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{trialPkg.name}</div>
                <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{trialPkg.description || "Coba tanpa komitmen — tidak perlu kartu kredit"}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: ORANGE }}>{Number(trialPkg.price) === 0 ? "GRATIS" : formatCurrency(Number(trialPkg.price))}</div>
              <div style={{ padding: "10px 20px", borderRadius: 10, background: ORANGE, color: "#fff", fontWeight: 700, fontSize: 13 }}>
                Mulai Trial →
              </div>
            </div>
          </div>
        )}

        {/* Paid Packages */}
        {paidPkgs.length > 0 && (
          <>
            <p style={{ fontSize: 11, letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 18, fontWeight: 700 }}>PAKET LENGKAP</p>
            <div className="pkg-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(paidPkgs.length, 3)}, 1fr)`, gap: 20 }}>
              {paidPkgs.map((pkg, idx) => {
                const features = (() => { try { return JSON.parse(pkg.features || "[]"); } catch { return pkg.features?.split("\n").filter(Boolean) || []; } })();
                const isSelected = selectedPkg?.id === pkg.id;
                const isPopular = paidPkgs.length > 1 && idx === Math.floor(paidPkgs.length / 2);
                return (
                  <div key={pkg.id} className="pkg-card" onClick={() => { setSelectedPkg(pkg); setShowForm(true); }}
                    style={{ background: isSelected ? `${ORANGE}0c` : "rgba(255,255,255,0.025)", border: `2px solid ${isSelected ? ORANGE : isPopular ? `${ORANGE}44` : "rgba(255,255,255,0.07)"}`, borderRadius: 20, padding: "30px 26px", position: "relative", display: "flex", flexDirection: "column" }}>
                    {isPopular && <div style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", background: ORANGE, color: "#fff", fontSize: 10, padding: "4px 16px", borderRadius: 100, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", fontWeight: 700 }}>⭐ Most Popular</div>}
                    <div style={{ fontWeight: 800, fontSize: 20, color: "#fff", marginBottom: 6, letterSpacing: "-0.01em" }}>{pkg.name}</div>
                    {pkg.description && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginBottom: 20, lineHeight: 1.55 }}>{pkg.description}</p>}
                    <div style={{ fontSize: 34, fontWeight: 900, color: ORANGE, letterSpacing: "-0.02em", marginBottom: 4 }}>{formatCurrency(Number(pkg.price))}</div>
                    {pkg.durationDays && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}><Clock size={11} /> {pkg.durationDays} hari akses</div>}
                    {features.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                        {features.map((f: string, fi: number) => (
                          <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                            <Check size={14} color={ORANGE} style={{ marginTop: 2, flexShrink: 0 }} />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button style={{ width: "100%", padding: "13px", borderRadius: 12, background: isSelected ? ORANGE : isPopular ? `${ORANGE}18` : "rgba(255,255,255,0.07)", border: isPopular && !isSelected ? `1px solid ${ORANGE}44` : "none", color: isSelected || isPopular ? (isSelected ? "#fff" : ORANGE) : "rgba(255,255,255,0.7)", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: font }}>
                      {isSelected ? "✓ Terpilih — Daftar Sekarang" : "Pilih Paket"}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Social Proof */}
      <section className="mob-pad" style={{ padding: "0 64px 80px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ textAlign: "center", padding: "56px 40px", background: `linear-gradient(135deg, ${ORANGE}14, rgba(124,58,237,0.1))`, borderRadius: 24, border: `1px solid ${ORANGE}22` }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", color: ORANGE, textTransform: "uppercase", marginBottom: 16 }}>JOIN 500+ ALUMNI SUKSES</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginBottom: 18 }}>
            Siap Mulai Perjalananmu<br /><span style={{ color: ORANGE }}>sebagai Videografer?</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.65 }}>
            Ratusan alumni Frameless Academy sudah membuktikan. Kini giliran kamu untuk mengubah passion menjadi profesi.
          </p>
          <button onClick={() => { document.getElementById("paket")?.scrollIntoView({ behavior: "smooth" }); }}
            style={{ padding: "14px 32px", borderRadius: 100, background: ORANGE, border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer", fontFamily: font }}>
            Lihat Paket & Daftar →
          </button>
        </div>
      </section>

      {/* Enrollment Form Modal */}
      {showForm && selectedPkg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#111315", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24, padding: "40px 36px", width: "100%", maxWidth: 440, animation: "fadeUp 0.3s ease" }}>
            {formStep === "form" ? (
              <>
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6, letterSpacing: "-0.02em" }}>Daftar Sekarang</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: `${ORANGE}12`, border: `1px solid ${ORANGE}28` }}>
                    <span style={{ fontSize: 20 }}>📦</span>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, margin: 0 }}>Paket dipilih</p>
                      <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0 }}>{selectedPkg.name} · <span style={{ color: ORANGE }}>{Number(selectedPkg.price) === 0 ? "Gratis" : formatCurrency(Number(selectedPkg.price))}</span></p>
                    </div>
                    <button onClick={() => { setShowForm(false); setSelectedPkg(null); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 18 }}>×</button>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {[{ k: "name", l: "Nama Lengkap *", t: "text", ph: "Nama kamu" }, { k: "email", l: "Email *", t: "email", ph: "email@kamu.com" }, { k: "phone", l: "No. WhatsApp", t: "tel", ph: "+62 8xx-xxxx-xxxx" }].map(f => (
                    <div key={f.k}>
                      <label style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>{f.l}</label>
                      <input type={f.t} value={(form as any)[f.k]} onChange={e => setForm(p => ({...p, [f.k]: e.target.value}))}
                        style={{ width: "100%", marginTop: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "11px 15px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: font }}
                        placeholder={f.ph} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
                  <button onClick={() => { setShowForm(false); setSelectedPkg(null); }} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 12, padding: "13px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontWeight: 600, fontFamily: font }}>Batal</button>
                  <button onClick={handleEnroll} disabled={enrolling} style={{ flex: 2, background: enrolling ? "rgba(255,107,53,0.5)" : ORANGE, border: "none", borderRadius: 12, padding: "13px", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15, fontFamily: font }}>
                    {Number(selectedPkg.price) === 0 ? "Daftar Gratis →" : enrolling ? "Memproses..." : "Lanjut ke Pembayaran 🔒"}
                  </button>
                </div>
                <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 14 }}>🔒 Data kamu aman. Pembayaran melalui Midtrans yang terenkripsi.</p>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 20px" }} />
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Membuka Pembayaran...</h3>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Sebentar ya, halaman pembayaran Midtrans akan segera muncul.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

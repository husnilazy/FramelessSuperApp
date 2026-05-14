import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Play, FileText, Link, BookOpen, Download, CheckCircle, Lock, ArrowRight, Film, MessageCircle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Material { id: string; title: string; description: string; url: string; type: string; orderIndex: number; }
interface Course { id: string; title: string; subtitle?: string; thumbnail?: string; instructor?: string; curriculumPdfUrl?: string; }
interface Enrollment { id: string; name: string; email: string; phone?: string; status: string; paymentStatus: string; createdAt: string; }
interface Package { name: string; price: string; durationDays?: number; }
interface PortalData { enrollment: Enrollment; course: Course; package: Package | null; materials: Material[]; }

const ORANGE = "hsl(20,100%,58%)";
const font = "'Plus Jakarta Sans', sans-serif";

const MATERIAL_ICONS: Record<string, any> = {
  video: Play, pdf: FileText, doc: BookOpen, link: Link,
};
const MATERIAL_COLORS: Record<string, string> = {
  video: "#ef4444", pdf: "#f97316", doc: "#3b82f6", link: "#8b5cf6",
};

export default function PortalPage() {
  const [, params] = useRoute("/portal/:id");
  const [, navigate] = useLocation();
  const enrollmentId = params?.id;

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const saved = localStorage.getItem(`portal_completed_${enrollmentId}`);
    if (saved) { try { setCompletedIds(new Set(JSON.parse(saved))); } catch {} }
  }, [enrollmentId]);

  useEffect(() => {
    if (!enrollmentId) return;
    fetch(`/api/portal/${enrollmentId}`)
      .then(r => r.ok ? r.json() : Promise.reject("not_found"))
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Enrollment tidak ditemukan"); setLoading(false); });
  }, [enrollmentId]);

  function toggleComplete(id: string) {
    setCompletedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(`portal_completed_${enrollmentId}`, JSON.stringify([...next]));
      return next;
    });
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0c", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, fontFamily: font }}>
      <Lock size={48} color="rgba(255,255,255,0.15)" />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }}>{error || "Halaman tidak ditemukan"}</p>
      <button onClick={() => navigate("/")} style={{ color: ORANGE, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Kembali ke beranda</button>
    </div>
  );

  const { enrollment, course, package: pkg, materials } = data;
  const progress = materials.length > 0 ? Math.round((completedIds.size / materials.length) * 100) : 0;
  const isActive = enrollment.status === "active" || enrollment.paymentStatus === "paid";

  return (
    <div style={{ fontFamily: font, background: "#0a0a0c", color: "#f0f0f0", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 768px) {
          .portal-grid { grid-template-columns: 1fr !important; }
          .portal-pad { padding: 20px !important; }
        }
      `}</style>

      {/* Header */}
      <header style={{ background: "rgba(10,10,12,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
            </div>
            <span style={{ fontWeight: 800, color: "#fff", fontSize: 14 }}>Frameless Academy</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{course.title}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{progress}% selesai</div>
            <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 2 }}>
              <div style={{ width: `${progress}%`, height: "100%", background: ORANGE, borderRadius: 2, transition: "width 0.4s" }} />
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px" }}>
        {/* Welcome Banner */}
        <div style={{ marginBottom: 36, padding: "28px 32px", borderRadius: 20, background: `linear-gradient(135deg, ${ORANGE}18, rgba(124,58,237,0.12))`, border: `1px solid ${ORANGE}28`, animation: "fadeUp 0.4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: ORANGE, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", margin: "0 0 6px" }}>
                {isActive ? "🎉 AKSES AKTIF" : "⏳ MENUNGGU KONFIRMASI"}
              </p>
              <h1 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
                Selamat datang, {enrollment.name}! 👋
              </h1>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: 0 }}>
                {isActive ? `Kamu sudah terdaftar di "${course.title}". Selamat belajar!` : "Pembayaranmu sedang kami verifikasi. Tim kami akan menghubungimu segera."}
              </p>
            </div>
            {pkg && (
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: "0 0 4px" }}>Paket aktif</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>{pkg.name}</p>
                {pkg.durationDays && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>{pkg.durationDays} hari akses</p>}
              </div>
            )}
          </div>
        </div>

        <div className="portal-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>
          {/* Materials */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: "-0.01em" }}>
                Materi Pembelajaran
              </h2>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>{completedIds.size}/{materials.length} selesai</span>
            </div>

            {!isActive ? (
              <div style={{ textAlign: "center", padding: "60px 32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18 }}>
                <Lock size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 14 }} />
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: 0 }}>Materi akan tersedia setelah pembayaran dikonfirmasi.</p>
                <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 13, margin: "8px 0 0" }}>Hubungi kami jika ada pertanyaan.</p>
              </div>
            ) : materials.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 32px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18 }}>
                <Film size={40} color="rgba(255,255,255,0.15)" style={{ marginBottom: 14 }} />
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: 0 }}>Materi sedang disiapkan. Pantau terus ya!</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {materials.map((m, i) => {
                  const Icon = MATERIAL_ICONS[m.type] || BookOpen;
                  const color = MATERIAL_COLORS[m.type] || ORANGE;
                  const done = completedIds.has(m.id);
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, background: done ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.025)", border: `1px solid ${done ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`, transition: "all 0.2s" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={16} color={color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: done ? "rgba(255,255,255,0.5)" : "#fff", textDecoration: done ? "line-through" : "none" }}>{i + 1}. {m.title}</div>
                        {m.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{m.description}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noopener noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, color, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                            {m.type === "video" ? <><Play size={11} /> Tonton</> : m.type === "pdf" ? <><Download size={11} /> Download</> : <><Link size={11} /> Buka</>}
                          </a>
                        )}
                        <button onClick={() => toggleComplete(m.id)}
                          style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${done ? "#4ade80" : "rgba(255,255,255,0.15)"}`, background: done ? "rgba(74,222,128,0.15)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {done && <CheckCircle size={14} color="#4ade80" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Progress */}
            {isActive && materials.length > 0 && (
              <div style={{ padding: "22px 24px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Progress Kamu</h3>
                <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${ORANGE}, #ff9d5c)`, borderRadius: 4, transition: "width 0.4s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{completedIds.size} dari {materials.length} materi</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: ORANGE }}>{progress}%</span>
                </div>
                {progress === 100 && (
                  <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.25)", textAlign: "center" }}>
                    <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 700, margin: 0 }}>🏆 Kamu sudah menyelesaikan semua materi!</p>
                  </div>
                )}
              </div>
            )}

            {/* Course Info */}
            <div style={{ padding: "22px 24px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {course.thumbnail && <img src={course.thumbnail} alt={course.title} style={{ width: "100%", borderRadius: 12, marginBottom: 14, objectFit: "cover", aspectRatio: "16/9" }} />}
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{course.title}</h3>
              {course.subtitle && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.5 }}>{course.subtitle}</p>}
              {course.instructor && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14 }}>
                  Instruktur: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{course.instructor}</strong>
                </div>
              )}
              {course.curriculumPdfUrl && (
                <a href={course.curriculumPdfUrl} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderRadius: 10, background: `${ORANGE}12`, border: `1px solid ${ORANGE}28`, color: ORANGE, textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  <Download size={13} /> Download Kurikulum PDF
                </a>
              )}
            </div>

            {/* Contact */}
            <div style={{ padding: "22px 24px", borderRadius: 16, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 10 }}>Butuh Bantuan?</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, lineHeight: 1.6 }}>
                Tim Frameless siap membantu kamu. Hubungi kami melalui WhatsApp atau email.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <a href={`mailto:support@frameless.id?subject=Portal - ${enrollment.name}&body=Nama: ${enrollment.name}%0AEmail: ${enrollment.email}%0ACourse: ${course.title}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                  ✉️ Email Support
                </a>
                <a href="https://wa.me/628xxx" target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#25D366", textDecoration: "none", fontSize: 12, fontWeight: 600 }}>
                  💬 WhatsApp Admin
                </a>
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: 0 }}>ID Pendaftaran: <code style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{enrollment.id.slice(0, 18)}...</code></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

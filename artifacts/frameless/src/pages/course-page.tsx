import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { ArrowLeft, Check, Play, Clock, Award, Users, Zap, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
}
interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; instructor?: string; level?: string; category?: string; packages: Package[];
}

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

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/courses/${slug}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setCourse(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [slug]);

  const handleEnroll = async () => {
    if (!selectedPkg || !course) return;
    if (!form.name || !form.email) { toast({ variant: "destructive", title: "Nama dan email wajib diisi" }); return; }
    setEnrolling(true);
    try {
      const res = await fetch(`/api/courses/${course.id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, packageId: selectedPkg.id }),
      });
      if (res.ok) {
        toast({ title: "Pendaftaran berhasil! Tim kami akan menghubungi Anda segera." });
        setShowForm(false);
        setForm({ name: "", email: "", phone: "" });
      } else {
        toast({ variant: "destructive", title: "Gagal mendaftar, coba lagi" });
      }
    } finally { setEnrolling(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "32px", height: "32px", borderRadius: "50%", border: "2px solid #ff6b35", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (!course) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
      <Film size={48} color="rgba(255,255,255,0.2)" />
      <p style={{ color: "rgba(255,255,255,0.4)" }}>Course tidak ditemukan</p>
      <button onClick={() => navigate("/")} style={{ color: "#ff6b35", background: "none", border: "none", cursor: "pointer" }}>← Kembali</button>
    </div>
  );

  const activePkgs = course.packages.filter(p => p.isActive !== false);
  const trialPkg = activePkgs.find(p => p.isTrial);
  const paidPkgs = activePkgs.filter(p => !p.isTrial);

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#0a0a0a", color: "#fff", minHeight: "100vh" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 40px", height: "60px", display: "flex", alignItems: "center", gap: "16px", zIndex: 50 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
          <ArrowLeft size={16} /> Kembali
        </button>
        <div style={{ height: "20px", width: "1px", background: "rgba(255,255,255,0.1)" }} />
        <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>Course</span>
      </nav>

      {/* Hero */}
      <section style={{ padding: "60px 40px 40px", maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <span style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", fontSize: "11px", padding: "4px 12px", borderRadius: "100px", letterSpacing: "1px", textTransform: "uppercase" }}>{course.level}</span>
            <span style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: "11px", padding: "4px 12px", borderRadius: "100px", textTransform: "uppercase" }}>{course.category}</span>
          </div>
          <h1 style={{ fontSize: "44px", fontWeight: "900", lineHeight: "1.05", marginBottom: "16px" }}>{course.title}</h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", marginBottom: "24px", lineHeight: "1.6" }}>{course.subtitle}</p>
          {course.instructor && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,107,53,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Users size={14} color="#ff6b35" />
              </div>
              Instruktur: <strong style={{ color: "#fff" }}>{course.instructor}</strong>
            </div>
          )}
          {trialPkg && (
            <div style={{ marginTop: "32px" }}>
              <button
                onClick={() => { setSelectedPkg(trialPkg); setShowForm(true); }}
                style={{ background: "rgba(255,107,53,0.12)", border: "1px solid rgba(255,107,53,0.3)", color: "#ff6b35", borderRadius: "8px", padding: "12px 24px", fontSize: "14px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Play size={14} /> Coba Trial Gratis
              </button>
            </div>
          )}
        </div>
        <div style={{ background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : "linear-gradient(135deg, #1a0800 0%, #3d1500 100%)", borderRadius: "20px", aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {!course.thumbnail && <Film size={56} color="rgba(255,107,53,0.3)" />}
        </div>
      </section>

      {/* Description */}
      {course.description && (
        <section style={{ padding: "0 40px 40px", maxWidth: "1100px", margin: "0 auto" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "32px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "16px" }}>Tentang Course Ini</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: "1.75", fontSize: "15px", whiteSpace: "pre-line" }}>{course.description}</p>
          </div>
        </section>
      )}

      {/* Packages */}
      <section style={{ padding: "20px 40px 80px", maxWidth: "1100px", margin: "0 auto" }}>
        <h2 style={{ fontSize: "32px", fontWeight: "800", marginBottom: "8px" }}>Pilih Paket</h2>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "15px", marginBottom: "40px" }}>Pilih paket yang sesuai dengan kebutuhan Anda</p>

        {trialPkg && (
          <div style={{ marginBottom: "32px" }}>
            <div style={{ fontSize: "11px", letterSpacing: "3px", color: "#ff6b35", textTransform: "uppercase", marginBottom: "16px" }}>Trial</div>
            <div
              onClick={() => { setSelectedPkg(trialPkg); setShowForm(true); }}
              style={{ background: "rgba(255,107,53,0.06)", border: `2px solid ${selectedPkg?.id === trialPkg.id ? "#ff6b35" : "rgba(255,107,53,0.2)"}`, borderRadius: "16px", padding: "24px 28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}
            >
              <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                <div style={{ width: "48px", height: "48px", background: "rgba(255,107,53,0.15)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Play size={20} color="#ff6b35" />
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "18px" }}>{trialPkg.name}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>{trialPkg.description || "Coba tanpa komitmen"}</div>
                  {trialPkg.durationDays && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> {trialPkg.durationDays} hari</div>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "28px", fontWeight: "900", color: "#ff6b35" }}>{Number(trialPkg.price) === 0 ? "GRATIS" : formatCurrency(Number(trialPkg.price))}</div>
              </div>
            </div>
          </div>
        )}

        {paidPkgs.length > 0 && (
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "3px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", marginBottom: "16px" }}>Paket Lengkap</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
              {paidPkgs.map((pkg, idx) => {
                const features = (() => { try { return JSON.parse(pkg.features || "[]"); } catch { return pkg.features?.split("\n").filter(Boolean) || []; } })();
                const isSelected = selectedPkg?.id === pkg.id;
                const isPopular = idx === Math.floor(paidPkgs.length / 2);
                return (
                  <div
                    key={pkg.id}
                    onClick={() => { setSelectedPkg(pkg); setShowForm(true); }}
                    style={{ background: isSelected ? "rgba(255,107,53,0.08)" : "rgba(255,255,255,0.03)", border: `2px solid ${isSelected ? "#ff6b35" : isPopular ? "rgba(255,107,53,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: "20px", padding: "28px", cursor: "pointer", position: "relative" }}
                  >
                    {isPopular && <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "#ff6b35", color: "#fff", fontSize: "10px", padding: "4px 16px", borderRadius: "100px", letterSpacing: "1px", textTransform: "uppercase", whiteSpace: "nowrap" }}>Most Popular</div>}
                    <div style={{ fontWeight: "800", fontSize: "20px", marginBottom: "8px" }}>{pkg.name}</div>
                    {pkg.description && <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "20px", lineHeight: "1.5" }}>{pkg.description}</p>}
                    <div style={{ fontSize: "32px", fontWeight: "900", color: "#ff6b35", marginBottom: "4px" }}>{formatCurrency(Number(pkg.price))}</div>
                    {pkg.durationDays && <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", marginBottom: "20px" }}><Clock size={12} /> {pkg.durationDays} hari akses</div>}
                    {features.length > 0 && (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
                        {features.map((f: string, fi: number) => (
                          <li key={fi} style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                            <Check size={14} color="#ff6b35" style={{ marginTop: "2px", flexShrink: 0 }} />{f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <button style={{ marginTop: "24px", width: "100%", background: isSelected ? "#ff6b35" : "rgba(255,255,255,0.06)", border: "none", borderRadius: "8px", padding: "12px", color: "#fff", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}>
                      {isSelected ? "Dipilih ✓" : "Pilih Paket"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Enrollment Form Modal */}
      {showForm && selectedPkg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "40px", width: "100%", maxWidth: "440px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "6px" }}>Daftar Sekarang</h3>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", marginBottom: "24px" }}>Paket: <strong style={{ color: "#ff6b35" }}>{selectedPkg.name}</strong> · {Number(selectedPkg.price) === 0 ? "Gratis" : formatCurrency(Number(selectedPkg.price))}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Nama Lengkap *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} style={{ width: "100%", marginTop: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} placeholder="Nama Anda" />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} style={{ width: "100%", marginTop: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} placeholder="email@anda.com" />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", letterSpacing: "1px", textTransform: "uppercase" }}>No. WhatsApp</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))} style={{ width: "100%", marginTop: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }} placeholder="+62 xxx" />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "28px" }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "8px", padding: "12px", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontWeight: "600" }}>Batal</button>
              <button onClick={handleEnroll} disabled={enrolling} style={{ flex: 2, background: "#ff6b35", border: "none", borderRadius: "8px", padding: "12px", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "14px" }}>
                {enrolling ? "Mendaftar..." : "Daftar Sekarang →"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

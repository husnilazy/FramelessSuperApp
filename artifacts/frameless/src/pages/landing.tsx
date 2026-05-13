import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { ChevronRight, Play, Star, Award, Users, Camera, Film, Zap, ArrowRight, Mail, Phone, MapPin, Instagram, Youtube, Menu, X } from "lucide-react";

interface CmsData {
  hero?: { heading?: string; subheading?: string; tagline?: string; cta?: string; ctaSecondary?: string; videoUrl?: string };
  about?: { heading?: string; body?: string; mission?: string };
  services?: { heading?: string; subtitle?: string; items?: string };
  courses?: { heading?: string; subtitle?: string };
  stats?: { clients?: string; projects?: string; years?: string; awards?: string };
  contact?: { email?: string; phone?: string; address?: string; instagram?: string; youtube?: string };
  footer?: { tagline?: string; copyright?: string };
  general?: { siteName?: string; logoUrl?: string; primaryColor?: string };
}

interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; instructor?: string; level?: string; category?: string; isPublished?: boolean;
  packages: { id: string; name: string; price: string; isTrial: boolean; durationDays?: number; features?: string; description?: string }[];
}

const DEFAULT_CMS: CmsData = {
  hero: {
    heading: "WE FRAME\nYOUR STORY",
    subheading: "Premium Video Production & Creative Media Agency",
    tagline: "STUDIODO · ZENSVISUAL · FRAMELESS",
    cta: "Mulai Proyek",
    ctaSecondary: "Lihat Portfolio",
  },
  about: {
    heading: "Tentang Kami",
    body: "Frameless Creative adalah studio produksi video premium berbasis di Jakarta. Kami menggabungkan kreativitas tinggi dengan teknologi terkini untuk menciptakan konten visual yang berkesan.",
    mission: "Menciptakan karya visual yang tak terlupakan untuk brand Anda.",
  },
  services: {
    heading: "Layanan Kami",
    subtitle: "Solusi kreatif lengkap untuk kebutuhan visual brand Anda",
    items: JSON.stringify([
      { icon: "Film", title: "Music Video", desc: "Produksi music video profesional dengan konsep kreatif dan sinematografi berkelas." },
      { icon: "Camera", title: "Commercial", desc: "Iklan TVC dan digital yang memukau, dirancang untuk memaksimalkan brand awareness." },
      { icon: "Play", title: "Documentary", desc: "Film dokumenter yang menceritakan kisah nyata dengan pendekatan sinematik yang kuat." },
      { icon: "Zap", title: "Social Content", desc: "Konten media sosial yang engaging dan viral-ready untuk platform digital Anda." },
    ]),
  },
  stats: { clients: "150+", projects: "500+", years: "8+", awards: "25+" },
  contact: {
    email: "info@frameless.id",
    phone: "+62 xxx xxxx xxxx",
    address: "Jakarta, Indonesia",
    instagram: "@frameless.id",
    youtube: "Frameless Creative",
  },
  footer: {
    tagline: "Menciptakan visual yang tak terlupakan.",
    copyright: "© 2026 Frameless Creative Project PT. All rights reserved.",
  },
  general: { siteName: "FRAMELESS™", logoUrl: "/logo-frameless.png" },
  courses: { heading: "Videography Course", subtitle: "Pelajari seni videografi dari para profesional industri" },
};

function merge(def: any, cms: any): any {
  if (!cms) return def;
  const out: any = { ...def };
  for (const k in cms) { out[k] = { ...def?.[k], ...cms[k] }; }
  return out;
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [cms, setCms] = useState<CmsData>(DEFAULT_CMS);
  const [courses, setCourses] = useState<Course[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/cms").then(r => r.json()).then(d => setCms(merge(DEFAULT_CMS, d))).catch(() => {});
    fetch("/api/courses").then(r => r.json()).then(d => setCourses(d)).catch(() => {});
  }, []);

  const c = cms;
  const services = (() => {
    try { return JSON.parse(c.services?.items || "[]"); } catch { return []; }
  })();
  const iconMap: Record<string, any> = { Film, Camera, Play, Zap };

  const stats = [
    { value: c.stats?.clients || "150+", label: "Happy Clients" },
    { value: c.stats?.projects || "500+", label: "Projects" },
    { value: c.stats?.years || "8+", label: "Years Experience" },
    { value: c.stats?.awards || "25+", label: "Awards" },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#0a0a0a", color: "#fff", overflowX: "hidden" }}>

      {/* ── NAV ── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 40px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {c.general?.logoUrl && <img src={c.general.logoUrl} alt="Logo" style={{ height: "28px", objectFit: "contain", filter: "invert(1)" }} />}
        </div>
        <div style={{ display: "flex", gap: "32px", alignItems: "center" }} className="hidden-mobile">
          {["Layanan", "Tentang", "Course", "Kontak"].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", letterSpacing: "1px", textDecoration: "none", textTransform: "uppercase" }}>{l}</a>
          ))}
          <button onClick={() => navigate("/login")} style={{ background: "#ff6b35", color: "#fff", border: "none", borderRadius: "6px", padding: "8px 20px", fontSize: "12px", letterSpacing: "1px", textTransform: "uppercase", fontWeight: "700", cursor: "pointer" }}>Admin</button>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", display: "none" }} className="show-mobile">
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* ── HERO ── */}
      <section id="hero" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", padding: "120px 40px 80px", textAlign: "center" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center top, rgba(255,107,53,0.15) 0%, transparent 70%)" }} />
        <div style={{ position: "relative", maxWidth: "900px" }}>
          <div style={{ display: "inline-block", background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.3)", borderRadius: "100px", padding: "6px 20px", fontSize: "11px", letterSpacing: "3px", color: "#ff6b35", marginBottom: "32px", textTransform: "uppercase" }}>
            {c.hero?.tagline}
          </div>
          <h1 style={{ fontSize: "clamp(52px, 9vw, 96px)", fontWeight: "900", lineHeight: "0.95", letterSpacing: "-2px", marginBottom: "28px", whiteSpace: "pre-line" }}>
            {c.hero?.heading}
          </h1>
          <p style={{ fontSize: "18px", color: "rgba(255,255,255,0.6)", maxWidth: "560px", margin: "0 auto 48px", lineHeight: "1.6" }}>
            {c.hero?.subheading}
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#kontak" style={{ background: "#ff6b35", color: "#fff", textDecoration: "none", borderRadius: "8px", padding: "16px 36px", fontSize: "14px", fontWeight: "700", letterSpacing: "1px", display: "flex", alignItems: "center", gap: "8px" }}>
              {c.hero?.cta} <ArrowRight size={16} />
            </a>
            <a href="#course" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", textDecoration: "none", borderRadius: "8px", padding: "16px 36px", fontSize: "14px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
              <Play size={16} /> {c.hero?.ctaSecondary}
            </a>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: "40px", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: "10px", letterSpacing: "3px", textTransform: "uppercase" }}>Scroll</div>
          <div style={{ width: "1px", height: "40px", background: "linear-gradient(to bottom, rgba(255,107,53,0.6), transparent)" }} />
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "40px 40px", background: "rgba(255,255,255,0.02)" }}>
        <div style={{ maxWidth: "960px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "24px", textAlign: "center" }}>
          {stats.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: "36px", fontWeight: "900", color: "#ff6b35", letterSpacing: "-1px" }}>{s.value}</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", letterSpacing: "2px", textTransform: "uppercase", marginTop: "4px" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SERVICES ── */}
      <section id="layanan" style={{ padding: "100px 40px", maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "60px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#ff6b35", textTransform: "uppercase", marginBottom: "16px" }}>What We Do</div>
          <h2 style={{ fontSize: "44px", fontWeight: "800", marginBottom: "16px" }}>{c.services?.heading}</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "16px" }}>{c.services?.subtitle}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
          {services.map((s: any, i: number) => {
            const Icon = iconMap[s.icon] || Film;
            return (
              <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "32px 28px", transition: "border-color 0.2s" }}>
                <div style={{ width: "48px", height: "48px", background: "rgba(255,107,53,0.12)", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                  <Icon size={22} color="#ff6b35" />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "10px" }}>{s.title}</h3>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", lineHeight: "1.65" }}>{s.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="tentang" style={{ padding: "80px 40px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#ff6b35", textTransform: "uppercase", marginBottom: "16px" }}>Tentang Kami</div>
            <h2 style={{ fontSize: "38px", fontWeight: "800", lineHeight: "1.1", marginBottom: "20px" }}>{c.about?.heading}</h2>
            <p style={{ color: "rgba(255,255,255,0.6)", lineHeight: "1.75", fontSize: "15px", marginBottom: "20px" }}>{c.about?.body}</p>
            <div style={{ borderLeft: "3px solid #ff6b35", paddingLeft: "20px", color: "rgba(255,255,255,0.5)", fontStyle: "italic", fontSize: "14px" }}>{c.about?.mission}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {[{ icon: Award, label: "Award Winning", desc: "Diakui industri kreatif Indonesia" }, { icon: Users, label: "Expert Team", desc: "Tim profesional berpengalaman" }, { icon: Star, label: "Quality First", desc: "Standar produksi premium" }].map(item => (
              <div key={item.label} style={{ display: "flex", gap: "16px", alignItems: "flex-start", background: "rgba(255,255,255,0.03)", borderRadius: "12px", padding: "20px" }}>
                <div style={{ width: "40px", height: "40px", background: "rgba(255,107,53,0.12)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} color="#ff6b35" />
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "14px", marginBottom: "4px" }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COURSES ── */}
      {courses.length > 0 && (
        <section id="course" style={{ padding: "100px 40px" }}>
          <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: "60px" }}>
              <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#ff6b35", textTransform: "uppercase", marginBottom: "16px" }}>Education</div>
              <h2 style={{ fontSize: "44px", fontWeight: "800", marginBottom: "16px" }}>{c.courses?.heading}</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "16px" }}>{c.courses?.subtitle}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "28px" }}>
              {courses.filter(co => co.isPublished !== false).map(course => (
                <a key={course.id} href={`/course/${course.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", overflow: "hidden", cursor: "pointer", transition: "border-color 0.2s" }}>
                    <div style={{ height: "180px", background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : "linear-gradient(135deg, #1a0a00 0%, #3d1500 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!course.thumbnail && <Film size={40} color="rgba(255,107,53,0.4)" />}
                    </div>
                    <div style={{ padding: "24px" }}>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                        <span style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", fontSize: "10px", padding: "3px 10px", borderRadius: "100px", letterSpacing: "1px", textTransform: "uppercase" }}>{course.level}</span>
                        <span style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: "10px", padding: "3px 10px", borderRadius: "100px", letterSpacing: "1px", textTransform: "uppercase" }}>{course.category}</span>
                      </div>
                      <h3 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>{course.title}</h3>
                      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px", lineHeight: "1.5" }}>{course.subtitle}</p>
                      {course.instructor && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>oleh {course.instructor}</div>}
                      <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "13px", color: "#ff6b35", fontWeight: "700" }}>
                          {course.packages?.[0] ? (Number(course.packages[0].price) === 0 ? "Gratis" : formatCurrency(Number(course.packages[0].price))) : "—"}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Lihat Detail <ChevronRight size={14} /></div>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ── */}
      <section id="kontak" style={{ padding: "100px 40px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ maxWidth: "860px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "11px", letterSpacing: "4px", color: "#ff6b35", textTransform: "uppercase", marginBottom: "16px" }}>Hubungi Kami</div>
          <h2 style={{ fontSize: "44px", fontWeight: "800", marginBottom: "16px" }}>Siap Berkolaborasi?</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "16px", marginBottom: "48px" }}>Ceritakan proyek Anda kepada kami. Kami siap mewujudkan visi kreatif Anda.</p>
          <div style={{ display: "flex", gap: "24px", justifyContent: "center", flexWrap: "wrap" }}>
            {c.contact?.email && (
              <a href={`mailto:${c.contact.email}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 24px", color: "#fff", textDecoration: "none", fontSize: "14px" }}>
                <Mail size={16} color="#ff6b35" />{c.contact.email}
              </a>
            )}
            {c.contact?.phone && (
              <a href={`tel:${c.contact.phone}`} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 24px", color: "#fff", textDecoration: "none", fontSize: "14px" }}>
                <Phone size={16} color="#ff6b35" />{c.contact.phone}
              </a>
            )}
            {c.contact?.address && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px", padding: "16px 24px", fontSize: "14px", color: "rgba(255,255,255,0.7)" }}>
                <MapPin size={16} color="#ff6b35" />{c.contact.address}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {c.general?.logoUrl && <img src={c.general.logoUrl} alt="Logo" style={{ height: "22px", filter: "invert(1)", opacity: 0.7 }} />}
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}>{c.footer?.tagline}</span>
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>{c.footer?.copyright}</div>
        <div style={{ display: "flex", gap: "16px" }}>
          {c.contact?.instagram && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}><Instagram size={14} style={{ display: "inline", marginRight: "4px" }} />{c.contact.instagram}</div>}
          {c.contact?.youtube && <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}><Youtube size={14} style={{ display: "inline", marginRight: "4px" }} />{c.contact.youtube}</div>}
        </div>
      </footer>
    </div>
  );
}

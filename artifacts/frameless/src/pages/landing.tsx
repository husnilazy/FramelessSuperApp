import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Play, X, ArrowRight, Star, ChevronRight, Check, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface CmsData { [section: string]: { [key: string]: string } }
interface SiteVideo { id: string; title: string; description: string; embedUrl: string; thumbnailUrl: string; category: string; tags: string; isActive: boolean; orderIndex: number; }
interface SiteLogo { id: string; name: string; imageUrl: string; isActive: boolean; orderIndex: number; }
interface Package { id: string; name: string; price: string; isTrial: boolean; isActive?: boolean; }
interface Course { id: string; title: string; slug: string; level: string; subtitle?: string; thumbnail?: string; instructor?: string; packages: Package[]; }

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return m ? m[1] : null;
}
function getEmbedUrl(url: string) {
  const id = getYouTubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
  if (url.includes("vimeo.com")) { const m = url.match(/vimeo\.com\/(\d+)/); if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1`; }
  return url;
}
function getAutoplayEmbed(url: string) {
  const id = getYouTubeId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`;
  if (url.includes("vimeo.com")) { const m = url.match(/vimeo\.com\/(\d+)/); if (m) return `https://player.vimeo.com/video/${m[1]}?autoplay=1&muted=1&loop=1&background=1`; }
  return null;
}
function getThumb(url: string, custom?: string) {
  if (custom) return custom;
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : "";
}

const ORANGE = "hsl(20,100%,58%)";
const font = "'Plus Jakarta Sans', sans-serif";

const DEFAULT_SERVICES = [
  { title: "Commercial Video", desc: "Iklan TV, digital ads, dan brand video yang membangun awareness dan konversi.", tags: ["TVC", "Digital Ads", "Brand Story"], icon: "🎬" },
  { title: "Music Video", desc: "Visual musik yang berani, artistik, dan memorable untuk artis lokal & nasional.", tags: ["Concept", "Production", "Color Grading"], icon: "🎵" },
  { title: "Short Film", desc: "Film pendek naratif dengan sinematografi profesional dan storytelling kuat.", tags: ["Script", "Directing", "Post Production"], icon: "🎞️" },
  { title: "Documentary", desc: "Dokumenter yang menceritakan kisah nyata dengan pendekatan sinematik.", tags: ["Research", "Interviews", "Narration"], icon: "📽️" },
  { title: "Wedding Cinema", desc: "Cinematic wedding film yang mengabadikan momen spesial dengan indah.", tags: ["Pre-wedding", "Ceremony", "Reception"], icon: "💍" },
  { title: "Social Media Content", desc: "Konten video yang viral-ready untuk Instagram, TikTok, dan YouTube.", tags: ["Reels", "TikTok", "YouTube"], icon: "📱" },
];

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
        <X style={{ width: 18, height: 18 }} />
      </button>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(90vw,900px)", aspectRatio: "16/9" }}>
        <iframe src={getEmbedUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 16, border: "none" }} allow="autoplay; fullscreen" allowFullScreen />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [videoModal, setVideoModal] = useState<string | null>(null);
  const [portfolioFilter, setPortfolioFilter] = useState("All");

  const { data: cms } = useQuery<CmsData>({ queryKey: ["/api/cms"], queryFn: () => fetch("/api/cms").then(r => r.json()) });
  const { data: videos = [] } = useQuery<SiteVideo[]>({
    queryKey: ["/api/site-videos"],
    queryFn: () => fetch("/api/site-videos").then(r => r.json()).then((v: SiteVideo[]) => v.filter(x => x.isActive)),
  });
  const { data: logos = [] } = useQuery<SiteLogo[]>({
    queryKey: ["/api/site-logos"],
    queryFn: () => fetch("/api/site-logos").then(r => r.json()).then((l: SiteLogo[]) => l.filter(x => x.isActive)),
  });
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    queryFn: () => fetch("/api/courses").then(r => r.json()),
  });

  const c = cms || {};
  const hero = c.hero || {};
  const branding = c.branding || {};
  const stats = c.stats || {};
  const contact = c.contact || {};
  const theme = c.theme || {};

  const logoUrl = branding.logoUrl || "";
  const logoSizePx = Math.max(20, Math.min(80, parseInt(branding.logoSize || "32")));
  const meshColor1 = theme.meshColor1 || ORANGE;
  const meshColor2 = theme.meshColor2 || "#7c3aed";
  const meshColor3 = theme.meshColor3 || "#1e40af";
  const bannerVideoUrl = hero.bannerVideoUrl || "";
  const bannerEmbedUrl = bannerVideoUrl ? getAutoplayEmbed(bannerVideoUrl) : null;
  const isDirectVideo = bannerVideoUrl && !getYouTubeId(bannerVideoUrl) && !bannerVideoUrl.includes("vimeo") && (bannerVideoUrl.includes(".mp4") || bannerVideoUrl.includes(".webm") || bannerVideoUrl.includes(".mov"));

  const showreelVideo = videos.find(v => v.category === "showreel");
  const portfolioVideos = videos.filter(v => v.category === "portfolio");
  const allTags = Array.from(new Set(portfolioVideos.flatMap(v => { try { return JSON.parse(v.tags || "[]"); } catch { return []; } })));
  const portfolioCats = ["All", ...allTags];
  const filteredPortfolio = portfolioFilter === "All" ? portfolioVideos : portfolioVideos.filter(v => { try { return JSON.parse(v.tags || "[]").includes(portfolioFilter); } catch { return false; } });

  const publishedCourses = courses.filter(c => c.packages?.length);

  return (
    <div style={{ background: "#0a0a0c", color: "#f0f0f0", fontFamily: font, minHeight: "100vh", position: "relative" }}>
      <style>{`
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hero-h1 { font-size: clamp(40px,10vw,68px) !important; }
          .stat-grid { gap: 28px !important; }
          .services-grid { grid-template-columns: 1fr !important; }
          .portfolio-grid { grid-template-columns: 1fr !important; }
          .academy-grid { grid-template-columns: 1fr !important; }
          .course-cards-grid { grid-template-columns: 1fr !important; }
          .footer-row { flex-direction: column !important; text-align: center !important; }
        }
        @media (max-width: 560px) {
          .cta-row { flex-direction: column !important; align-items: stretch !important; }
          .cta-row a, .cta-row button { text-align: center !important; justify-content: center !important; }
        }
        .hover-card { transition: border-color 0.25s, background 0.25s; }
        .hover-card:hover { border-color: ${ORANGE}44 !important; background: rgba(255,255,255,0.045) !important; }
        .play-overlay { opacity: 0; transition: opacity 0.3s; }
        .video-thumb:hover .play-overlay { opacity: 1; }
      `}</style>

      {/* Gradient mesh background */}
      <div className="mesh-wrap" aria-hidden="true">
        <div className="mesh-blob mesh-blob-1" style={{ background: meshColor1 }} />
        <div className="mesh-blob mesh-blob-2" style={{ background: meshColor2 }} />
        <div className="mesh-blob mesh-blob-3" style={{ background: meshColor3 }} />
      </div>

      {/* ── NAV ───────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, backdropFilter: "blur(20px)", background: "rgba(10,10,12,0.88)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" style={{ height: logoSizePx, width: "auto", filter: "brightness(0) invert(1)", objectFit: "contain" }} />
            ) : (
              <>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>F</span>
                </div>
                <span style={{ fontWeight: 900, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>FRAMELESS</span>
              </>
            )}
          </div>
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: 32 }}>
            {[["#services", "Services"], ["#portfolio", "Portfolio"], ["#courses", "Academy"], ["#contact", "Contact"]].map(([href, label]) => (
              <a key={href} href={href} style={{ color: "rgba(255,255,255,0.55)", textDecoration: "none", fontSize: 14, fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}>
                {label}
              </a>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="#contact" style={{ padding: "9px 22px", borderRadius: 100, background: ORANGE, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Get Started</a>
            <Link href="/login"><span style={{ padding: "8px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Admin</span></Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", marginBottom: 36 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ORANGE, boxShadow: `0 0 8px ${ORANGE}` }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>VIDEO PRODUCTION HOUSE</span>
          </div>

          <h1 className="hero-h1" style={{ fontSize: "clamp(48px,8.5vw,92px)", fontWeight: 800, lineHeight: 1.04, letterSpacing: "-0.035em", color: "#fff", margin: "0 0 24px" }}>
            {hero.headline1 || "We Craft"}<br />
            <span style={{ color: ORANGE }}>{hero.headline2 || "Visual Stories"}</span><br />
            {hero.headline3 || "That Move."}
          </h1>

          <p style={{ fontSize: "clamp(15px,1.8vw,19px)", color: "rgba(255,255,255,0.48)", maxWidth: 540, margin: "0 auto 44px", lineHeight: 1.65, fontWeight: 400 }}>
            {hero.subtitle || "Frameless Creative adalah rumah produksi video yang menghadirkan visual berkelas untuk brand, musik, film, dan konten digital."}
          </p>

          <div className="cta-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <a href="#portfolio" style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 100, background: ORANGE, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
              <Play style={{ width: 15, height: 15, fill: "#fff" }} />
              {hero.cta1 || "Lihat Portfolio"} <ArrowRight style={{ width: 15, height: 15 }} />
            </a>
            <a href="#contact" style={{ padding: "13px 26px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>
              {hero.cta2 || "Hubungi Kami"}
            </a>
          </div>

          <div className="stat-grid" style={{ display: "flex", justifyContent: "center", gap: 56, marginTop: 64, flexWrap: "wrap" }}>
            {[{ v: stats.projects || "150+", l: "PROJECTS" }, { v: stats.clients || "50+", l: "CLIENTS" }, { v: stats.years || "5+", l: "YEARS" }].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(30px,4vw,42px)", fontWeight: 900, color: ORANGE, letterSpacing: "-0.025em" }}>{s.v}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginTop: 4 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUTOPLAY BANNER VIDEO ───────────────────────── */}
      {(bannerEmbedUrl || isDirectVideo) && (
        <section style={{ position: "relative", width: "100%", maxHeight: "70vh", overflow: "hidden", background: "#000" }}>
          {isDirectVideo ? (
            <video autoPlay muted loop playsInline style={{ width: "100%", maxHeight: "70vh", objectFit: "cover", display: "block" }}>
              <source src={bannerVideoUrl} />
            </video>
          ) : (
            <div style={{ position: "relative", paddingBottom: "42.857%", background: "#000", overflow: "hidden" }}>
              <iframe src={bannerEmbedUrl!} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                allow="autoplay; fullscreen" allowFullScreen title="Banner Video" />
            </div>
          )}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(10,10,12,0.35) 0%, transparent 30%, transparent 70%, rgba(10,10,12,0.7) 100%)", pointerEvents: "none" }} />
        </section>
      )}

      {/* ── SHOWREEL ───────────────────────────────────── */}
      {showreelVideo && (
        <section style={{ background: "#060608", padding: "80px 24px", textAlign: "center" }}>
          <button onClick={() => setVideoModal(showreelVideo.embedUrl)}
            style={{ width: 84, height: 84, borderRadius: "50%", background: ORANGE, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px", boxShadow: `0 0 50px ${ORANGE}55`, transition: "transform 0.25s" }}
            onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}>
            <Play style={{ width: 30, height: 30, fill: "#fff", color: "#fff", marginLeft: 4 }} />
          </button>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>TONTON SHOWREEL</p>
        </section>
      )}

      {/* ── SERVICES ───────────────────────────────────── */}
      <section id="services" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: ORANGE, textTransform: "uppercase", marginBottom: 14 }}>WHAT WE DO</div>
            <h2 style={{ fontSize: "clamp(34px,5vw,54px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 16px" }}>
              Our <span style={{ color: ORANGE }}>Services</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,0.42)", maxWidth: 460, margin: "0 auto", fontSize: 16, lineHeight: 1.65 }}>
              End-to-end video production untuk setiap kebutuhan visual brand kamu.
            </p>
          </div>
          <div className="services-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18 }}>
            {DEFAULT_SERVICES.map(s => (
              <div key={s.title} className="hover-card" style={{ padding: 28, borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.025)", cursor: "default" }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: ORANGE + "20", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, fontSize: 20 }}>{s.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 10, letterSpacing: "-0.015em" }}>{s.title}</h3>
                <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 14, lineHeight: 1.65, marginBottom: 16 }}>{s.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {s.tags.map(t => <span key={t} style={{ padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.4)" }}>{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO ──────────────────────────────────── */}
      {portfolioVideos.length > 0 && (
        <section id="portfolio" style={{ padding: "100px 24px", background: "rgba(6,6,8,0.6)", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: "clamp(34px,5vw,54px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 14px" }}>
                Selected <span style={{ color: ORANGE }}>Portfolio</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 16 }}>Setiap project kami adalah cerita yang dibangun dengan passion dan presisi.</p>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 }}>
              {portfolioCats.map(cat => (
                <button key={cat} onClick={() => setPortfolioFilter(cat)}
                  style={{ padding: "7px 18px", borderRadius: 100, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s", background: portfolioFilter === cat ? ORANGE : "rgba(255,255,255,0.07)", color: portfolioFilter === cat ? "#fff" : "rgba(255,255,255,0.5)" }}>
                  {cat}
                </button>
              ))}
            </div>
            <div className="portfolio-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
              {filteredPortfolio.map((v, i) => {
                const thumb = getThumb(v.embedUrl, v.thumbnailUrl || undefined);
                return (
                  <div key={v.id} className="video-thumb" onClick={() => setVideoModal(v.embedUrl)}
                    style={{ position: "relative", borderRadius: 18, overflow: "hidden", cursor: "pointer", aspectRatio: i === 0 && filteredPortfolio.length > 1 ? "16/9" : "4/3", border: "1px solid rgba(255,255,255,0.08)", gridColumn: i === 0 && filteredPortfolio.length > 1 ? "1 / -1" : undefined }}>
                    {thumb ? <img src={thumb} style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.5s" }} onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")} onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")} /> : <div style={{ width: "100%", height: "100%", minHeight: 200, background: "rgba(255,255,255,0.05)" }} />}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)" }} />
                    <div className="play-overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.25)" }}>
                      <div style={{ width: 56, height: 56, borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Play style={{ width: 20, height: 20, fill: "#fff", color: "#fff", marginLeft: 2 }} />
                      </div>
                    </div>
                    <div style={{ position: "absolute", bottom: 18, left: 22, right: 22 }}>
                      {i === 0 && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: ORANGE, textTransform: "uppercase", marginBottom: 5 }}>FEATURED WORK</div>}
                      <div style={{ fontSize: i === 0 ? 20 : 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>{v.title}</div>
                      {v.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)", marginTop: 3 }}>{v.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── COURSE VIDEOGRAPHY ─────────────────────────── */}
      {publishedCourses.length > 0 && (
        <section id="courses" style={{ padding: "110px 24px", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ textAlign: "center", marginBottom: 64 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 100, background: ORANGE + "1c", marginBottom: 20 }}>
                <Star style={{ width: 12, height: 12, color: ORANGE }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: ORANGE, textTransform: "uppercase" }}>FRAMELESS ACADEMY</span>
              </div>
              <h2 style={{ fontSize: "clamp(36px,5.5vw,60px)", fontWeight: 800, letterSpacing: "-0.035em", color: "#fff", margin: "0 0 18px", lineHeight: 1.08 }}>
                Kuasai Videografi.<br />
                <span style={{ color: ORANGE }}>Bersama Sineas Profesional.</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 17, lineHeight: 1.65, maxWidth: 520, margin: "0 auto 36px" }}>
                Bukan sekadar kursus online — ini adalah pengalaman belajar dari sineas yang sudah terjun di industri selama bertahun-tahun.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
                {[{ icon: "👥", v: "500+", l: "Alumni aktif" }, { icon: "⭐", v: "4.9/5", l: "Rating rata-rata" }, { icon: "🏆", v: "100%", l: "Sertifikat resmi" }, { icon: "🎬", v: `${publishedCourses.length}`, l: "Kelas tersedia" }].map(s => (
                  <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 16 }}>{s.icon}</span>
                    <span style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}><strong style={{ color: "#fff" }}>{s.v}</strong> {s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Course Cards */}
            <div className="course-cards-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(publishedCourses.length, 3)}, 1fr)`, gap: 24, marginBottom: 48 }}>
              {publishedCourses.slice(0, 3).map((course, idx) => {
                const activePkgs = course.packages.filter(p => p.isActive !== false);
                const trialPkg = activePkgs.find(p => p.isTrial);
                const paidPkgs = activePkgs.filter(p => !p.isTrial);
                const minPrice = paidPkgs.length ? Math.min(...paidPkgs.map(p => Number(p.price))) : 0;
                const isPopular = idx === 0 && publishedCourses.length > 1;
                return (
                  <div key={course.id} style={{ borderRadius: 22, overflow: "hidden", border: `2px solid ${isPopular ? ORANGE + "55" : "rgba(255,255,255,0.09)"}`, background: "rgba(255,255,255,0.025)", display: "flex", flexDirection: "column", position: "relative" }}>
                    {isPopular && <div style={{ position: "absolute", top: 16, right: 16, background: ORANGE, color: "#fff", fontSize: 10, padding: "4px 14px", borderRadius: 100, letterSpacing: "0.1em", fontWeight: 700, textTransform: "uppercase" }}>⭐ Most Popular</div>}
                    <div style={{ aspectRatio: "16/9", background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : `linear-gradient(135deg, #1a0800, #3d1500)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {!course.thumbnail && <span style={{ fontSize: 40 }}>🎬</span>}
                    </div>
                    <div style={{ padding: "24px 26px 28px", flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        <span style={{ background: ORANGE + "1c", color: ORANGE, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, textTransform: "capitalize" }}>{course.level}</span>
                      </div>
                      <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-0.02em" }}>{course.title}</h3>
                      {course.subtitle && <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: "0 0 16px", lineHeight: 1.5 }}>{course.subtitle}</p>}
                      {course.instructor && <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", margin: "0 0 16px" }}>Instruktur: <strong style={{ color: "rgba(255,255,255,0.6)" }}>{course.instructor}</strong></p>}

                      {/* Quick features */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 22, flex: 1 }}>
                        {["Kurikulum terstruktur & terupdate", "Sertifikat resmi Frameless", "Akses komunitas alumni", trialPkg ? "Trial gratis tersedia" : ""].filter(Boolean).map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,0.55)" }}>
                            <Check size={13} color={ORANGE} style={{ flexShrink: 0 }} />{f}
                          </div>
                        ))}
                      </div>

                      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          {minPrice > 0 ? (
                            <div>
                              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", margin: "0 0 2px" }}>Mulai dari</p>
                              <p style={{ fontSize: 22, fontWeight: 900, color: ORANGE, margin: 0, letterSpacing: "-0.02em" }}>{formatCurrency(minPrice)}</p>
                            </div>
                          ) : trialPkg ? (
                            <p style={{ fontSize: 16, fontWeight: 800, color: ORANGE, margin: 0 }}>GRATIS</p>
                          ) : null}
                        </div>
                        <a href={`/course/${course.slug}`}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "11px 20px", borderRadius: 100, background: ORANGE, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                          Daftar <ChevronRight size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom CTA */}
            <div style={{ textAlign: "center", padding: "52px 32px", borderRadius: 22, background: `linear-gradient(135deg, ${ORANGE}14, rgba(124,58,237,0.1))`, border: `1px solid ${ORANGE}22` }}>
              <h3 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#fff", margin: "0 0 12px", letterSpacing: "-0.02em" }}>
                Siap Mulai Perjalanan Videografimu?
              </h3>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 15, margin: "0 0 24px", maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
                Mulai dengan trial gratis. Tidak perlu kartu kredit.
              </p>
              <div className="cta-row" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                {publishedCourses[0] && (
                  <a href={`/course/${publishedCourses[0].slug}`}
                    style={{ padding: "13px 28px", borderRadius: 100, background: ORANGE, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
                    Mulai Belajar Sekarang →
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── LOGOS MARQUEE ──────────────────────────────── */}
      {logos.length > 0 && (
        <section style={{ padding: "72px 0", background: "rgba(7,7,9,0.6)", overflow: "hidden", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", color: "rgba(255,255,255,0.22)", textTransform: "uppercase" }}>TRUSTED BY BRANDS ACROSS INDONESIA</p>
          </div>
          <div style={{ overflow: "hidden", position: "relative" }}>
            <div className="marquee-track" style={{ display: "flex", gap: 56, width: "max-content", alignItems: "center" }}>
              {[...logos, ...logos].map((logo, i) => (
                <div key={`${logo.id}-${i}`} style={{ height: 44, minWidth: 100, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35, filter: "brightness(0) invert(1)", transition: "opacity 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "0.35")}>
                  <img src={logo.imageUrl} alt={logo.name} style={{ height: "100%", width: "auto", objectFit: "contain", maxWidth: 140 }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CONTACT ────────────────────────────────────── */}
      <section id="contact" style={{ padding: "100px 24px", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: "clamp(34px,5vw,58px)", fontWeight: 800, letterSpacing: "-0.03em", color: "#fff", margin: "0 0 18px" }}>
            Siap Memulai<br /><span style={{ color: ORANGE }}>Proyek Kamu?</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.42)", fontSize: 17, lineHeight: 1.65, margin: "0 0 40px" }}>
            {contact.desc || "Ceritakan visi kamu kepada kami. Tim Frameless Creative siap mengubah ide menjadi visual yang luar biasa."}
          </p>
          <div className="cta-row" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {contact.whatsapp && (
              <a href={`https://wa.me/${contact.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 100, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
                💬 WhatsApp
              </a>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>
                ✉️ {contact.email}
              </a>
            )}
            {!contact.whatsapp && !contact.email && (
              <a href="mailto:hello@frameless.id" style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 100, background: ORANGE, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>
                Hubungi Kami <ArrowRight style={{ width: 15, height: 15 }} />
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)", padding: "36px 24px", position: "relative", zIndex: 1 }}>
        <div className="footer-row" style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 14, color: "#fff", letterSpacing: "-0.01em" }}>Frameless Creative</span>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)" }}>© {new Date().getFullYear()} Frameless Creative. All rights reserved.</p>
          <div style={{ display: "flex", gap: 20 }}>
            {[["Store", "/store"], ["Academy", "#courses"], ["Crew", "/crew/login"], ["Admin", "/login"]].map(([label, href]) => (
              <a key={href} href={href} style={{ fontSize: 12, color: "rgba(255,255,255,0.28)", textDecoration: "none" }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,0.65)"}
                onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,0.28)"}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>

      {videoModal && <VideoModal url={videoModal} onClose={() => setVideoModal(null)} />}
    </div>
  );
}

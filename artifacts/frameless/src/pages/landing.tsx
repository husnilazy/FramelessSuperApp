// artifacts/frameless/src/pages/landing.tsx
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play, X, ArrowRight, Check, ChevronRight, Menu,
  Users, Award, Film, BookOpen, Shield, Zap, Mail,
  MessageCircle, MapPin, Phone, Instagram, Youtube,
  Star, Clock, TrendingUp, Volume2, VolumeX,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CmsData { [s: string]: { [k: string]: string } }
interface SiteVideo { id: string; title: string; description: string; embedUrl: string; thumbnailUrl: string; category: string; tags: string; isActive: boolean; orderIndex: number; }
interface SiteLogo { id: string; name: string; imageUrl: string; isActive: boolean; orderIndex: number; }
interface Package { id: string; name: string; price: string; isTrial: boolean; isActive?: boolean; features?: string; description?: string; }
interface Course { id: string; title: string; slug: string; level: string; subtitle?: string; thumbnail?: string; instructor?: string; category?: string; packages: Package[]; }
interface DigitalAsset { id: string; title: string; description?: string; price: string; thumbnailUrl?: string; category?: string; fileType?: string; isActive: boolean; }
interface Service { icon: string; title: string; description: string; tags: string[]; slug: string; price?: string; }

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────
function ytId(url?: string) {
  if (!url) return null;
  return url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/)?.[1] ?? null;
}

function igId(url?: string) {
  if (!url) return null;
  return url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/)?.[1] ?? null;
}

function autoEmbed(url?: string, muted = true) {
  if (!url) return null;
  
  const id = ytId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&${muted ? "mute=1&" : ""}loop=1&playlist=${id}&controls=0&showinfo=0&rel=0&modestbranding=1&playsinline=1`;
  
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&${muted ? "muted=1&" : ""}loop=1&background=1`;
  
  const ig = igId(url);
  if (ig) return `https://www.instagram.com/p/${ig}/embed`;

  return null;
}

function watchUrl(url: string) {
  const id = ytId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  
  const ig = igId(url);
  if (ig) return `https://www.instagram.com/p/${ig}/embed`;

  return url;
}

function getThumbnail(url: string, custom?: string) {
  if (custom) return custom;
  const id = ytId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "";
}
// ── Default Services ──────────────────────────────────────────────────────────
const DEFAULT_SERVICES: Service[] = [
  { icon: "🎬", title: "Commercial Video", description: "Iklan TV, digital ads, dan brand video yang membangun awareness & konversi tinggi.", tags: ["TVC", "Digital Ads", "Brand Story"], slug: "commercial-video" },
  { icon: "🎵", title: "Music Video", description: "Visual musik yang berani, artistik, dan memorable untuk artis lokal & nasional.", tags: ["Concept", "Production", "Grading"], slug: "music-video" },
  { icon: "🎞️", title: "Short Film", description: "Film pendek naratif dengan sinematografi profesional dan storytelling yang kuat.", tags: ["Script", "Directing", "Post"], slug: "short-film" },
  { icon: "📽️", title: "Documentary", description: "Dokumenter kisah nyata dengan pendekatan sinematik yang mendalam dan autentik.", tags: ["Research", "Interview", "Narasi"], slug: "documentary" },
  { icon: "💍", title: "Wedding Cinema", description: "Cinematic wedding film yang mengabadikan setiap momen spesial hari terbaik hidupmu.", tags: ["Pre-wedding", "Ceremony", "Reception"], slug: "wedding-cinema" },
  { icon: "📱", title: "Social Media Content", description: "Konten video viral-ready & algorithmik untuk Instagram Reels, TikTok, dan YouTube Shorts.", tags: ["Reels", "TikTok", "YouTube"], slug: "social-media" },
  { icon: "🏢", title: "Corporate Video", description: "Video profil perusahaan, training, dan internal communication yang profesional.", tags: ["Profile", "Training", "Annual Report"], slug: "corporate-video" },
  { icon: "🎪", title: "Event Coverage", description: "Dokumentasi event, konser, pameran, dan aktivasi brand dengan multi-kamera.", tags: ["Multi-cam", "Highlight", "Livestream"], slug: "event-coverage" },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{overflow-x:hidden;}

@keyframes b1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(90px,-70px) scale(1.18);}66%{transform:translate(-50px,90px) scale(0.9);}}
@keyframes b2{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-100px,70px) scale(0.85);}66%{transform:translate(70px,-100px) scale(1.22);}}
@keyframes b3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(60px,80px) scale(1.12);}}
@keyframes marquee{0%{transform:translateX(0);}100%{transform:translateX(-25%);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
@keyframes glow{0%,100%{box-shadow:0 0 20px ${OR}44;}50%{box-shadow:0 0 40px ${OR}88;}}
@keyframes spin{to{transform:rotate(360deg);}}

.mq-inner{animation:marquee 40s linear infinite;}
.mq-inner:hover{animation-play-state:paused;}

.fu{opacity:0;animation:fadeUp .7s ease forwards;}
.d1{animation-delay:.08s;}.d2{animation-delay:.22s;}.d3{animation-delay:.38s;}.d4{animation-delay:.56s;}

.nav-link{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);text-decoration:none;transition:color .2s;letter-spacing:.01em;padding:6px 0;}
.nav-link:hover{color:#fff;}

.svc-card{transition:border-color .25s,background .25s,transform .28s,box-shadow .28s;cursor:pointer;}
.svc-card:hover{transform:translateY(-4px);border-color:${OR}55!important;box-shadow:0 16px 48px rgba(0,0,0,.4)!important;}

.pf-card{transition:transform .5s cubic-bezier(.16,1,.3,1);}
.pf-card:hover{transform:scale(1.03);}
.pf-card .overlay{opacity:0;transition:opacity .28s;}
.pf-card:hover .overlay{opacity:1;}
.pf-card img{transition:transform .6s cubic-bezier(.16,1,.3,1);}
.pf-card:hover img{transform:scale(1.07);}

/* Portrait video cards */
.reel-card{transition:transform .3s cubic-bezier(.16,1,.3,1),box-shadow .3s;}
.reel-card:hover{transform:translateY(-8px) scale(1.02);box-shadow:0 24px 64px rgba(0,0,0,.6)!important;}
.reel-card .reel-overlay{opacity:0;transition:opacity .25s;}
.reel-card:hover .reel-overlay{opacity:1;}

.course-card{transition:transform .28s,border-color .25s,box-shadow .28s;}
.course-card:hover{transform:translateY(-5px);}

.asset-card{transition:transform .25s,border-color .25s;}
.asset-card:hover{transform:translateY(-3px);}

@media(max-width:900px){
  .nl{display:none!important;}
  .nav-cta-desktop{display:none!important;}
  .hamburger{display:flex!important;}
  .h1{font-size:clamp(42px,10vw,72px)!important;letter-spacing:-.04em!important;}
  .sg{gap:28px!important;}
  .g3{grid-template-columns:1fr 1fr!important;}
  .g4{grid-template-columns:1fr 1fr!important;}
  .footer-grid{grid-template-columns:1fr 1fr!important;}
  .col{flex-direction:column!important;align-items:stretch!important;}
  .pxs{padding-left:20px!important;padding-right:20px!important;}
}
@media(max-width:560px){
  .g3{grid-template-columns:1fr!important;}
  .g4{grid-template-columns:1fr!important;}
  .footer-grid{grid-template-columns:1fr!important;}
  .reel-scroll{gap:14px!important;}
}
`;

// ── Animated Mesh ─────────────────────────────────────────────────────────────
function Mesh({ c1, c2, c3, opacity = 1 }: { c1: string; c2: string; c3: string; opacity?: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity }}>
      <div style={{ position: "absolute", width: "80%", height: "80%", top: "-28%", left: "-22%", background: `radial-gradient(ellipse at center,${c1}62 0%,${c1}26 40%,transparent 68%)`, filter: "blur(56px)", animation: "b1 20s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "72%", height: "72%", top: "3%", right: "-28%", background: `radial-gradient(ellipse at center,${c2}52 0%,${c2}22 46%,transparent 72%)`, filter: "blur(68px)", animation: "b2 24s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "62%", height: "58%", bottom: "-22%", left: "18%", background: `radial-gradient(ellipse at center,${c3}42 0%,${c3}18 52%,transparent 76%)`, filter: "blur(80px)", animation: "b3 28s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "48%", height: "48%", top: "36%", left: "26%", background: `radial-gradient(ellipse at center,${c1}28 0%,transparent 60%)`, filter: "blur(50px)", animation: "b2 16s ease-in-out infinite reverse" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 140% 110% at 50% 0%,transparent 28%,rgba(10,10,12,.78) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(10,10,12,0) 18%,rgba(10,10,12,.42) 62%,rgba(10,10,12,1) 100%)" }} />
    </div>
  );
}

// ── Video Modal ───────────────────────────────────────────────────────────────
function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.95)", backdropFilter: "blur(20px)", animation: "fadeIn .18s ease" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><X size={18} /></button>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw,1000px)", aspectRatio: "16/9" }}>
        <iframe src={watchUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 14, border: "none" }} allow="autoplay;fullscreen" allowFullScreen />
      </div>
    </div>
  );
}

// ── Portrait Reel Card (Premium Glassmorphic Glow & Clean Fix) ────────────────
function ReelCard({ video, onClick }: { video: SiteVideo; onClick: () => void }) {
  const th = getThumbnail(video.embedUrl, video.thumbnailUrl);
  const embedSrc = autoEmbed(video.embedUrl, true);

  return (
    <div className="reel-card"
      onClick={onClick}
      style={{ 
        flexShrink: 0, 
        width: "clamp(180px,26vw,240px)", 
        aspectRatio: "9/16", 
        borderRadius: 22, 
        overflow: "hidden", 
        position: "relative", 
        cursor: "pointer", 
        background: "rgba(255, 255, 255, 0.02)", 
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255, 255, 255, 0.12)", 
        boxShadow: `0 12px 40px 0 rgba(0, 0, 0, 0.4), 
                    0 0 20px 0px rgba(255, 106, 34, 0.15), 
                    inset 0 0 12px rgba(255, 255, 255, 0.05)`,
        transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-8px) scale(1.02)";
        e.currentTarget.style.boxShadow = `0 16px 50px 0 rgba(0, 0, 0, 0.55), 
                                           0 0 30px 4px rgba(255, 106, 34, 0.35), 
                                           inset 0 0 16px rgba(255, 255, 255, 0.15)`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0) scale(1)";
        e.currentTarget.style.boxShadow = `0 12px 40px 0 rgba(0, 0, 0, 0.4), 
                                           0 0 20px 0px rgba(255, 106, 34, 0.15), 
                                           inset 0 0 12px rgba(255, 255, 255, 0.05)`;
      }}
    >
      
      {/* Container Video dengan Trik Zoom & Masking untuk Menyembunyikan Tombol Play YT */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 22 }}>
        {embedSrc ? (
          <iframe 
            src={`${embedSrc}&controls=0&modestbranding=1&rel=0`}
            style={{ 
              position: "absolute", 
              top: "50%", 
              left: "50%", 
              width: "240%", 
              height: "240%", 
              transform: "translate(-50%, -50%)", 
              border: "none", 
              pointerEvents: "none" 
            }}
            allow="autoplay; muted" 
          />
        ) : (
          th ? <img src={th} alt={video.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            // MENGGANTI ${OR} MENJADI WARNA LANGSUNG #FF6A22 AGAR TIDAK ERROR
            : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, rgba(255, 106, 34, 0.13), rgba(124, 58, 237, 0.13))" }} />
        )}
      </div>

      {/* Gradasi Gelap Premium Semitransparan */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)", pointerEvents: "none" }} />

      {/* Glassmorphism Info Text di Bagian Bawah */}
      <div style={{ 
        position: "absolute", 
        bottom: 0, 
        left: 0, 
        right: 0, 
        padding: "18px 16px", 
        background: "rgba(10, 10, 14, 0.4)", 
        backdropFilter: "blur(20px)", 
        WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        pointerEvents: "none"
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.2px" }}>
          {video.title}
        </p>
        {video.description && (
          <p style={{ fontSize: 10.5, color: "rgba(255, 255, 255, 0.45)", margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {video.description}
          </p>
        )}
      </div>
    </div>
  );
}
// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [modal, setModal] = useState<string | null>(null);
  const [pfTag, setPfTag] = useState("All");
  const [vReady, setVReady] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);

  // Parallax
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      raf = requestAnimationFrame(() => {
        const sy = window.scrollY;
        if (bgRef.current) bgRef.current.style.transform = `translateY(${sy * 0.36}px)`;
        document.querySelectorAll("[data-px]").forEach(el => {
          const spd = parseFloat((el as HTMLElement).dataset.px || "0");
          const rect = (el as HTMLElement).getBoundingClientRect();
          const off = (sy - window.innerHeight + rect.top + rect.height * .5) * spd;
          (el as HTMLElement).style.transform = `translateY(${off}px)`;
        });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: cms } = useQuery<CmsData>({ queryKey: ["/api/cms"], queryFn: () => fetch("/api/cms").then(r => r.json()), staleTime: 60_000 });
  const { data: vids = [] } = useQuery<SiteVideo[]>({ queryKey: ["/api/site-videos"], queryFn: () => fetch("/api/site-videos").then(r => r.json()).then((a: SiteVideo[]) => a.filter(v => v.isActive).sort((a, b) => a.orderIndex - b.orderIndex)) });
  const { data: logos = [] } = useQuery<SiteLogo[]>({ queryKey: ["/api/site-logos"], queryFn: () => fetch("/api/site-logos").then(r => r.json()).then((a: SiteLogo[]) => a.filter(l => l.isActive).sort((a, b) => a.orderIndex - b.orderIndex)) });
  const { data: courses = [] } = useQuery<Course[]>({ queryKey: ["/api/courses"], queryFn: () => fetch("/api/courses").then(r => r.json()) });
  const { data: assets = [] } = useQuery<DigitalAsset[]>({ queryKey: ["/api/digital-assets"], queryFn: () => fetch("/api/digital-assets?isActive=true").then(r => r.ok ? r.json() : []).catch(() => []) });

  // ── CMS fields ────────────────────────────────────────────────────────────
  const hero = cms?.hero || {};
  const brand = cms?.branding || {};
  const stat = cms?.stats || {};
  const cont = cms?.contact || {};
  const thm = cms?.theme || {};

  const c1 = thm.meshColor1 || OR, c2 = thm.meshColor2 || "#7c3aed", c3 = thm.meshColor3 || "#2563eb";
  const logoUrl = brand.logoUrl || "";
  const brandName = brand.name || "Frameless Creative";
  const hl1 = hero.headline1 || "Crafting Stories";
  const hl2 = hero.headline2 || "Through the Lens.";
  const hl3 = hero.headline3 || "";
  const sub = hero.subtitle || "Media agency Wonosobo — mengubah ide menjadi visual sinematik yang tak terlupakan.";
  const bannerUrl = hero.bannerVideoUrl || "";
  const bgVid = vids.find(v => v.category === "background");
  const activeEmbed = autoEmbed(bannerUrl) || (bgVid ? autoEmbed(bgVid.embedUrl) : null);
  const directVid = !activeEmbed && !!bannerUrl && !ytId(bannerUrl) && !bannerUrl.includes("vimeo") && /\.(mp4|webm|mov)/.test(bannerUrl);

  // Services from CMS or defaults
  const cmsServices = (() => {
    try { return JSON.parse(cms?.services?.items || "[]") as Service[]; } catch { return []; }
  })();
  const services = cmsServices.length > 0 ? cmsServices : DEFAULT_SERVICES;

  // Videos by category
  const showreel = vids.find(v => v.category === "showreel");
  const pfVids = vids.filter(v => v.category === "portfolio");

  // LOGIC FILTER YANG DIPERBAIKI (TIDAK MENGARANG):
  // Menambahkan semua kemungkinan input CMS agar videonya pasti terbaca
  const reelVids = vids.filter(v => v.category === "reels" || v.category === "portrait" || v.category === "behind-the-frame" || v.category === "Behind the Frame");

  const allTags = Array.from(new Set(pfVids.flatMap(v => { try { return JSON.parse(v.tags || "[]"); } catch { return []; } })));
  const pfShown = pfTag === "All" ? pfVids : pfVids.filter(v => { try { return JSON.parse(v.tags || "[]").includes(pfTag); } catch { return false; } });

  const pubCourses = courses.filter(c => c.packages?.length > 0);
  const pubAssets = assets.filter(a => a.isActive).slice(0, 6);

  const wa = cont.whatsapp ? `https://wa.me/${cont.whatsapp.replace(/\D/g, "")}` : "#";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0a0a0c", color: "#f0f0f0", fontFamily: FONT, minHeight: "100vh", overflowX: "hidden" }}>
      <style>{CSS}</style>

      {/* ══════ MOBILE NAV ══════ */}
      {mobileNav && (
        <div onClick={() => setMobileNav(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,12,.98)", backdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <button onClick={() => setMobileNav(false)} style={{ position: "absolute", top: 22, right: 22, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><X size={20} /></button>
          {[["Services", "#services"], ["Portfolio", "#portfolio"], ["Reels", "#reels"], ["Academy", "#courses"], ["Store", "#store"], ["Contact", "#contact"]].map(([l, h]) => (
            <a key={h} href={h} onClick={() => setMobileNav(false)} style={{ fontSize: 30, fontWeight: 900, color: "rgba(255,255,255,.65)", textDecoration: "none", letterSpacing: "-.03em", padding: "8px 0", transition: "color .2s" }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
              onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.65)"}>{l}</a>
          ))}
          <a href="#courses" onClick={() => setMobileNav(false)} style={{ marginTop: 16, padding: "14px 40px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 16, fontWeight: 800 }}>Mulai Belajar</a>
        </div>
      )}

      {/* ══════ NAVBAR ══════ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 66, background: "rgba(10,10,12,.72)", backdropFilter: "blur(24px) saturate(180%)", borderBottom: "1px solid rgba(255,255,255,.055)" }}>
        {/* Inner container — properly centered */}
        <div style={{ maxWidth: 1280, margin: "0 auto", height: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>

          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            {logoUrl
              ? <img src={logoUrl} alt={brandName} style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              : <>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: OR, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${OR}55`, flexShrink: 0 }}><span style={{ color: "#fff", fontWeight: 900, fontSize: 16, letterSpacing: "-.02em" }}>F</span></div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#fff", letterSpacing: "-.02em", lineHeight: 1 }}>Frameless</div>
                  <div style={{ fontSize: 9, color: "rgba(255,255,255,.4)", letterSpacing: ".08em", marginTop: 1 }}>CREATIVE STUDIO</div>
                </div>
              </>
            }
          </a>

          {/* Desktop links — centered */}
          <div className="nl" style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {[["Services", "#services"], ["Portfolio", "#portfolio"], ["Reels", "#reels"], ["Academy", "#courses"], ["Store", "#store"], ["Contact", "#contact"]].map(([l, h]) => (
              <a key={h} href={h} className="nav-link" style={{ padding: "6px 14px", borderRadius: 8, fontSize: 13 }}>{l}</a>
            ))}
          </div>

          {/* CTA + hamburger */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <a href="#courses" className="nav-cta-desktop" style={{ padding: "9px 20px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", transition: "opacity .2s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = ".88"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
              Mulai Belajar
            </a>
            {/* Hamburger */}
            <button className="hamburger" onClick={() => setMobileNav(true)}
              style={{ display: "none", width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)", cursor: "pointer", alignItems: "center", justifyContent: "center", color: "#fff" }}>
              <Menu size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* ══════ HERO ══════ */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", position: "relative", overflow: "hidden", paddingTop: 66 }}>
        {/* Video BG */}
        {activeEmbed && (
          <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
            <iframe src={activeEmbed} style={{ position: "absolute", top: "50%", left: "50%", width: "calc(100% + 320px)", height: "calc(100% + 320px)", transform: "translate(-50%,-50%)", border: "none", pointerEvents: "none", opacity: vReady ? 1 : 0, transition: "opacity 1.8s ease" }} allow="autoplay;encrypted-media" onLoad={() => setTimeout(() => setVReady(true), 1000)} />
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.58)" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(10,10,12,.25) 0%,rgba(10,10,12,0) 28%,rgba(10,10,12,.55) 68%,rgba(10,10,12,1) 100%)" }} />
          </div>
        )}
        {directVid && <div style={{ position: "absolute", inset: 0, zIndex: 0 }}><video src={bannerUrl} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /><div style={{ position: "absolute", inset: 0, background: "rgba(10,10,12,.55)" }} /><div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(10,10,12,.1) 0%,rgba(10,10,12,.7) 80%,rgba(10,10,12,1) 100%)" }} /></div>}

        {/* Mesh parallax BG */}
        <div ref={bgRef} style={{ position: "absolute", inset: 0, zIndex: 0, opacity: vReady ? .22 : 1, transition: "opacity 2s ease", willChange: "transform" }}>
          <Mesh c1={c1} c2={c2} c3={c3} />
        </div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 1280, margin: "0 auto", padding: "80px 28px", width: "100%" }}>
          <div className="fu d1" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", borderRadius: 100, background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 28 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s ease infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase" }}>Media Agency · Wonosobo, Central Java</span>
          </div>
          <h1 className="h1 fu d2" style={{ fontSize: "clamp(48px,6.5vw,96px)", fontWeight: 900, lineHeight: 1.0, letterSpacing: "-.045em", color: "#fff", marginBottom: 24, maxWidth: 900 }}>
            {hl1}{hl2 && <span style={{ color: OR, display: "block" }}>{hl2}</span>}{hl3 && <span style={{ display: "block" }}>{hl3}</span>}
          </h1>
          <p className="fu d3" style={{ fontSize: "clamp(15px,1.8vw,19px)", color: "rgba(255,255,255,.46)", lineHeight: 1.74, maxWidth: 560, marginBottom: 44 }}>{sub}</p>
          <div className="col fu d4" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {showreel
              ? <button onClick={() => setModal(showreel.embedUrl)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><Play style={{ width: 15, height: 15, fill: "#fff" }} /> Tonton Showreel</button>
              : <a href="#services" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>Lihat Layanan <ArrowRight size={15} /></a>
            }
            <a href="#courses" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.78)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}><BookOpen size={15} /> Frameless Academy</a>
          </div>
          {/* Scroll indicator */}
          <div className="float" style={{ position: "absolute", bottom: -48, left: 28, display: "flex", alignItems: "center", gap: 8, opacity: .3, animation: "float 2.5s ease-in-out infinite" }}>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,.4)" }} />
            <span style={{ fontSize: 9, letterSpacing: ".28em", color: "rgba(255,255,255,.5)", textTransform: "uppercase" }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* ══════ STATS ══════ */}
      <section style={{ background: "rgba(255,255,255,.013)", borderTop: "1px solid rgba(255,255,255,.05)", borderBottom: "1px solid rgba(255,255,255,.05)", padding: "60px 28px", position: "relative", overflow: "hidden" }}>
        <div data-px="0.08" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 60% 80% at 20% 50%,${OR}08,transparent 70%)`, willChange: "transform" }} />
        <div className="sg" style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 48, justifyContent: "center", flexWrap: "wrap", position: "relative" }}>
          {[{ v: stat.projects || "200+", l: "Proyek Selesai" }, { v: stat.clients || "80+", l: "Klien Puas" }, { v: stat.years || "8+", l: "Tahun Pengalaman" }, { v: stat.alumni || "500+", l: "Alumni Academy" }].map(s => (
            <div key={s.l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "clamp(36px,4vw,56px)", fontWeight: 900, color: "#fff", letterSpacing: "-.04em", lineHeight: 1 }}>{s.v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,.32)", marginTop: 10, letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 700 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════ SERVICES ══════ */}
      <section id="services" className="pxs" style={{ padding: "110px 28px", position: "relative", overflow: "hidden" }}>
        <div data-px="0.1" style={{ position: "absolute", top: "5%", right: "-8%", width: "55%", height: "65%", background: `radial-gradient(ellipse at center,${c2}10,transparent 70%)`, filter: "blur(60px)", willChange: "transform" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 60, flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>LAYANAN KAMI</p>
              <h2 style={{ fontSize: "clamp(32px,5vw,60px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", margin: 0, lineHeight: 1.0 }}>
                Produksi Video<br /><span style={{ color: "rgba(255,255,255,.28)" }}>dari Konsep ke Screen</span>
              </h2>
            </div>
            <a href="/services" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, border: `1px solid ${OR}44`, color: OR, textDecoration: "none", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Lihat semua layanan <ChevronRight size={14} />
            </a>
          </div>
          <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
            {services.map((s, i) => (
              <a key={s.slug || i} href={`/services#${s.slug || i}`} style={{ textDecoration: "none" }}>
                <div className="svc-card" style={{ padding: "24px 22px", borderRadius: 20, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", height: "100%", display: "flex", flexDirection: "column" }}>
                  <div style={{ fontSize: 28, marginBottom: 14 }}>{s.icon}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8, letterSpacing: "-.01em", flex: 1 }}>{s.title}</h3>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,.43)", lineHeight: 1.65, marginBottom: 14 }}>{s.description}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {(s.tags || []).slice(0, 3).map((t: string) => (
                      <span key={t} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.38)", fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ PORTRAIT REEL VIDEOS ══════ */}
      {(reelVids.length > 0 || true) && (
        <section id="reels" style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 50%,${OR}08,transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,${OR}33,transparent)` }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,${OR}22,transparent)` }} />

          {/* Header */}
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 48px" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>FILM & REEL</p>
                <h2 style={{ fontSize: "clamp(30px,4.5vw,54px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", margin: 0, lineHeight: 1.0 }}>
                  Behind the Frame
                </h2>
              </div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.4)", maxWidth: 360, lineHeight: 1.65 }}>Cuplikan karya terbaik dari berbagai project yang sudah kami kerjakan.</p>
            </div>
          </div>

          {/* Scrollable portrait cards */}
          <div style={{ overflowX: "auto", overflowY: "visible", paddingBottom: 24, scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as any}>
            <div className="reel-scroll" style={{ display: "flex", gap: 20, padding: "0 28px", width: "max-content", margin: "0 auto" }}>
              {(reelVids.length > 0 ? reelVids : [
                { id: "demo1", title: "Wedding Film", description: "Cinematic Wedding", embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", tags: "[]", isActive: true, orderIndex: 0 },
                { id: "demo2", title: "Commercial TVC", description: "Brand Video", embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", tags: "[]", isActive: true, orderIndex: 1 },
                { id: "demo3", title: "Music Video", description: "Artist Production", embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", tags: "[]", isActive: true, orderIndex: 2 },
              ]).map(v => (
                <ReelCard key={v.id} video={v} onClick={() => setModal(v.embedUrl)} />
              ))}
            </div>
          </div>

          {/* Upload hint for admin */}
          <div style={{ maxWidth: 1280, margin: "24px auto 0", padding: "0 28px" }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.2)", textAlign: "center" }}>Upload video portrait di Admin → Site Videos → kategori "reels", "portrait", atau "Behind the Frame"</p>
          </div>
        </section>
      )}

      {/* ══════ PORTFOLIO ══════ */}
      {pfVids.length > 0 && (
        <section id="portfolio" className="pxs" style={{ padding: "110px 28px", position: "relative", overflow: "hidden" }}>
          <div data-px="0.12" style={{ position: "absolute", bottom: 0, left: "8%", width: "65%", height: "55%", background: `radial-gradient(ellipse at center,${OR}08,transparent 70%)`, filter: "blur(70px)", willChange: "transform" }} />
          <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 44, gap: 20, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 12 }}>PORTFOLIO</p>
                <h2 style={{ fontSize: "clamp(28px,4.5vw,52px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.0 }}>Karya Terbaik Kami</h2>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["All", ...allTags].map(cat => (
                  <button key={cat} onClick={() => setPfTag(cat)} style={{ padding: "7px 18px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, transition: "all .2s", background: pfTag === cat ? OR : "rgba(255,255,255,.06)", border: pfTag === cat ? "none" : "1px solid rgba(255,255,255,.1)", color: pfTag === cat ? "#fff" : "rgba(255,255,255,.47)" }}>{cat}</button>
                ))}
              </div>
            </div>
            <div className="g3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 18 }}>
              {pfShown.map((v, i) => {
                const t = getThumbnail(v.embedUrl, v.thumbnailUrl);
                const big = i === 0 && pfShown.length > 2;
                return (
                  <div key={v.id} className="pf-card" onClick={() => setModal(v.embedUrl)}
                    style={{ position: "relative", borderRadius: 18, overflow: "hidden", cursor: "pointer", aspectRatio: big ? "16/9" : "4/3", border: "1px solid rgba(255,255,255,.07)", gridColumn: big ? "1/-1" : undefined }}>
                    {t ? <img src={t} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt={v.title} /> : <div style={{ width: "100%", height: "100%", minHeight: 200, background: "rgba(255,255,255,.04)" }} />}
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 55%)" }} />
                    <div className="overlay" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.22)" }}>
                      <div style={{ width: 58, height: 58, borderRadius: "50%", background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={20} style={{ fill: "#fff", color: "#fff", marginLeft: 2 }} /></div>
                    </div>
                    <div style={{ position: "absolute", bottom: 18, left: 22, right: 22 }}>
                      {big && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".15em", color: OR, textTransform: "uppercase", marginBottom: 5 }}>FEATURED</div>}
                      <div style={{ fontSize: big ? 20 : 15, fontWeight: 700, color: "#fff" }}>{v.title}</div>
                      {v.description && <div style={{ fontSize: 12, color: "rgba(255,255,255,.44)", marginTop: 3 }}>{v.description}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════ ACADEMY ══════ */}
      <section id="courses" className="pxs" style={{ padding: "120px 28px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 85% 65% at 50% 0%,${OR}12,transparent 65%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,${OR}44,transparent)` }} />
        <div data-px="0.1" style={{ position: "absolute", bottom: "-20%", right: "-8%", width: "55%", height: "70%", background: `radial-gradient(ellipse at center,${c2}10,transparent 70%)`, filter: "blur(80px)", willChange: "transform" }} />

        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", borderRadius: 100, background: `${OR}18`, border: `1px solid ${OR}35`, marginBottom: 24 }}>
              <BookOpen size={13} color={OR} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".2em", color: OR, textTransform: "uppercase" }}>FRAMELESS ACADEMY</span>
            </div>
            <h2 style={{ fontSize: "clamp(36px,5.5vw,72px)", fontWeight: 900, letterSpacing: "-.045em", color: "#fff", margin: "0 0 20px", lineHeight: .98 }}>
              Kuasai Videografi.<br /><span style={{ color: OR }}>Bersama Sineas Pro.</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,.4)", fontSize: 18, lineHeight: 1.7, maxWidth: 520, margin: "0 auto 36px" }}>
              Bukan sekadar kursus online — pengalaman belajar langsung dari sineas industri.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
              {[{ icon: <Users size={14} color={OR} />, v: "500+", l: "Alumni" }, { icon: <Star size={14} color={OR} />, v: "4.9/5", l: "Rating" }, { icon: <Award size={14} color={OR} />, v: "100%", l: "Sertifikat" }, { icon: <Film size={14} color={OR} />, v: `${pubCourses.length || "3"}+`, l: "Kelas" }].map(s => (
                <div key={s.l} style={{ display: "flex", alignItems: "center", gap: 7 }}>{s.icon}<span style={{ fontSize: 14, color: "rgba(255,255,255,.46)" }}><strong style={{ color: "#fff", fontWeight: 800 }}>{s.v}</strong> {s.l}</span></div>
              ))}
            </div>
          </div>

          {/* Course cards — real links */}
          {pubCourses.length > 0 ? (
            <>
              <div className="g3" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(pubCourses.length, 3)},1fr)`, gap: 22, marginBottom: 48 }}>
                {pubCourses.slice(0, 3).map((c, idx) => {
                  const pkgs = c.packages.filter(p => p.isActive !== false);
                  const trial = pkgs.find(p => p.isTrial), paid = pkgs.filter(p => !p.isTrial);
                  const minPr = paid.length ? Math.min(...paid.map(p => Number(p.price))) : 0;
                  const pop = idx === 0 && pubCourses.length > 1;
                  const feats = (() => { const f = paid[0]?.features || trial?.features || ""; try { return JSON.parse(f); } catch { return f.split("\n").filter(Boolean).slice(0, 4); } })();
                  return (
                    <a key={c.id} href={`/course/${c.slug}`} className="course-card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", border: `1.5px solid ${pop ? OR + "55" : "rgba(255,255,255,.08)"}`, background: "rgba(255,255,255,.022)", position: "relative" }}>
                      {pop && <div style={{ position: "absolute", top: 14, right: 14, background: OR, color: "#fff", fontSize: 10, padding: "4px 14px", borderRadius: 100, fontWeight: 700, textTransform: "uppercase", zIndex: 2 }}>⭐ Popular</div>}
                      <div style={{ aspectRatio: "16/9", background: c.thumbnail ? `url(${c.thumbnail}) center/cover` : "linear-gradient(135deg,#1a0800,#3d1500)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {!c.thumbnail && <span style={{ fontSize: 42 }}>🎬</span>}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 60%)" }} />
                        <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 6 }}>
                          <span style={{ background: `${OR}22`, border: `1px solid ${OR}44`, color: OR, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, backdropFilter: "blur(8px)" }}>{c.level}</span>
                          {c.category && <span style={{ background: "rgba(0,0,0,.35)", color: "rgba(255,255,255,.6)", fontSize: 10, padding: "3px 10px", borderRadius: 100, backdropFilter: "blur(8px)" }}>{c.category}</span>}
                        </div>
                      </div>
                      <div style={{ padding: "20px 20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-.02em", lineHeight: 1.2 }}>{c.title}</h3>
                        {c.subtitle && <p style={{ fontSize: 13, color: "rgba(255,255,255,.42)", margin: "0 0 12px", lineHeight: 1.55 }}>{c.subtitle}</p>}
                        {c.instructor && <p style={{ fontSize: 11, color: "rgba(255,255,255,.27)", margin: "0 0 12px" }}>Instruktur: <strong style={{ color: "rgba(255,255,255,.55)" }}>{c.instructor}</strong></p>}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, flex: 1 }}>
                          {(feats.length > 0 ? feats.slice(0, 3) : ["Kurikulum terstruktur", "Sertifikat resmi", trial ? "Trial gratis" : "Materi pro"]).map((f: string) => (
                            <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,.47)" }}><Check size={11} color={OR} style={{ flexShrink: 0 }} />{f}</div>
                          ))}
                        </div>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>{minPr > 0 ? (<><p style={{ fontSize: 9, color: "rgba(255,255,255,.27)", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: ".08em" }}>Mulai dari</p><p style={{ fontSize: 20, fontWeight: 900, color: OR, margin: 0 }}>{formatCurrency(minPr)}</p></>) : trial && <p style={{ fontSize: 17, fontWeight: 800, color: OR, margin: 0 }}>GRATIS</p>}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 16px", borderRadius: 100, background: OR, color: "#fff", fontSize: 12, fontWeight: 700 }}>Daftar <ChevronRight size={12} /></div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
              {pubCourses.length > 3 && (
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                  <a href="/store" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 100, border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                    Lihat semua {pubCourses.length} kursus <ChevronRight size={15} />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px", borderRadius: 20, border: "2px dashed rgba(255,255,255,.08)", marginBottom: 48 }}>
              <p style={{ color: "rgba(255,255,255,.33)", fontSize: 14 }}>Kursus segera hadir. <a href="/courses-admin" style={{ color: OR, textDecoration: "none", fontWeight: 700 }}>Tambah kursus di admin →</a></p>
            </div>
          )}

          {/* Academy CTA */}
          <div style={{ padding: "48px 40px", borderRadius: 26, background: `linear-gradient(135deg,${OR}14,rgba(124,58,237,.1))`, border: `1px solid ${OR}28`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: `${OR}08`, filter: "blur(50px)" }} />
            <div className="g2" style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: OR, textTransform: "uppercase", marginBottom: 10 }}>MULAI SEKARANG</p>
                <h3 style={{ fontSize: "clamp(20px,3vw,32px)", fontWeight: 900, color: "#fff", letterSpacing: "-.03em", marginBottom: 8, lineHeight: 1.1 }}>Siap Mulai Perjalananmu?</h3>
                <p style={{ color: "rgba(255,255,255,.41)", fontSize: 14, maxWidth: 400, lineHeight: 1.65 }}>Trial gratis tersedia. Tidak perlu kartu kredit. 500+ alumni.</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexDirection: "column", flexShrink: 0 }}>
                <a href="/store" style={{ padding: "13px 26px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", textAlign: "center" }}>Lihat Semua Kelas →</a>
                <a href="#contact" style={{ padding: "11px 20px", borderRadius: 100, border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.63)", textDecoration: "none", fontSize: 13, fontWeight: 600, textAlign: "center" }}>Konsultasi dulu</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════ DIGITAL ASSETS STORE ══════ */}
      <section id="store" className="pxs" style={{ padding: "110px 28px", position: "relative", overflow: "hidden" }}>
        <div data-px="0.08" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 80% 50%,${c3}10,transparent 70%)`, willChange: "transform" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 56, flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>DIGITAL STORE</p>
              <h2 style={{ fontSize: "clamp(30px,4.5vw,56px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", margin: 0, lineHeight: 1.0 }}>
                Aset Editing<br /><span style={{ color: "rgba(255,255,255,.28)" }}>Profesional</span>
              </h2>
            </div>
            <div>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.4)", lineHeight: 1.65, maxWidth: 340, marginBottom: 14 }}>LUT, template, preset, dan aset editing dari Frameless Creative — siap pakai untuk proyekmu.</p>
              <a href="/store" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 12, background: OR, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Lihat Semua Aset <ArrowRight size={14} /></a>
            </div>
          </div>

          {pubAssets.length > 0 ? (
            <div className="g3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 18 }}>
              {pubAssets.map(asset => (
                <a key={asset.id} href="/store" className="asset-card" style={{ textDecoration: "none", borderRadius: 20, overflow: "hidden", border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.025)", display: "flex", flexDirection: "column", transition: "transform .25s,border-color .25s" }}>
                  <div style={{ aspectRatio: "4/3", background: asset.thumbnailUrl ? `url(${asset.thumbnailUrl}) center/cover` : `linear-gradient(135deg,${OR}22,${c2}22)`, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {!asset.thumbnailUrl && <span style={{ fontSize: 36 }}>🎨</span>}
                    {asset.category && <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)", borderRadius: 8, padding: "3px 10px" }}><span style={{ fontSize: 10, color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{asset.category}</span></div>}
                    {asset.fileType && <div style={{ position: "absolute", top: 12, right: 12, background: `${OR}22`, border: `1px solid ${OR}44`, borderRadius: 8, padding: "3px 10px" }}><span style={{ fontSize: 10, color: OR, fontWeight: 700 }}>{asset.fileType}</span></div>}
                  </div>
                  <div style={{ padding: "16px 16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: "0 0 5px" }}>{asset.title}</h3>
                    {asset.description && <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", margin: "0 0 12px", lineHeight: 1.5, flex: 1 }}>{asset.description.slice(0, 80)}{asset.description.length > 80 ? "..." : ""}</p>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: Number(asset.price) === 0 ? "#4ade80" : OR }}>{Number(asset.price) === 0 ? "GRATIS" : formatCurrency(Number(asset.price))}</span>
                      <div style={{ padding: "7px 14px", borderRadius: 100, background: OR, color: "#fff", fontSize: 11, fontWeight: 700 }}>Beli</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "56px 40px", borderRadius: 22, border: "2px dashed rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🎨</div>
              <p style={{ color: "rgba(255,255,255,.33)", fontSize: 14, marginBottom: 16 }}>Aset digital segera hadir.</p>
              <a href="/digital-assets-admin" style={{ color: OR, textDecoration: "none", fontWeight: 700, fontSize: 13 }}>Tambah aset di admin →</a>
            </div>
          )}
        </div>
      </section>

      {/* ══════ LOGOS MARQUEE ══════ */}
      {logos.length > 0 && (
        <section style={{ padding: "60px 0", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,.05)" }}>
          <p style={{ textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: "rgba(255,255,255,.18)", textTransform: "uppercase", marginBottom: 36 }}>TRUSTED BY BRANDS ACROSS INDONESIA</p>
          {/* Outer: full width, overflow hidden */}
          <div style={{ width: "100%", overflow: "hidden" }}>
            {/* Inner: flex row, 4x duplicated to always fill */}
            <div className="mq-inner" style={{ display: "flex", alignItems: "center", gap: 56, width: "max-content" }}>
              {[...logos, ...logos, ...logos, ...logos].map((l, i) => (
                <div key={`${l.id}-${i}`} style={{ height: 34, minWidth: 80, maxWidth: 120, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: .28, filter: "brightness(0) invert(1)", transition: "opacity .2s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = ".72"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = ".28"}>
                  <img src={l.imageUrl} alt={l.name} style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════ CONTACT ══════ */}
      <section id="contact" className="pxs" style={{ padding: "110px 28px", position: "relative", overflow: "hidden" }}>
        <div data-px="0.1" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 100%,${OR}0e,transparent 70%)`, willChange: "transform" }} />
        <div style={{ maxWidth: 660, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 16 }}>HUBUNGI KAMI</p>
          <h2 style={{ fontSize: "clamp(34px,5vw,60px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", margin: "0 0 20px", lineHeight: 1.0 }}>Siap Mulai<br /><span style={{ color: OR }}>Proyek Kamu?</span></h2>
          <p style={{ color: "rgba(255,255,255,.4)", fontSize: 16, lineHeight: 1.72, margin: "0 0 44px" }}>{cont.desc || "Tim Frameless Creative siap mewujudkan visi kamu menjadi visual sinematik yang tak terlupakan."}</p>
          <div className="col" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            {cont.whatsapp && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 26px", borderRadius: 100, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}><MessageCircle size={16} /> WhatsApp</a>}
            {cont.email && <a href={`mailto:${cont.email}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 100, border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.78)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}><Mail size={15} />{cont.email}</a>}
            {!cont.whatsapp && !cont.email && <a href="mailto:hello@frameless.id" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>Hubungi Kami <ArrowRight size={15} /></a>}
          </div>
        </div>
      </section>

      {/* ══════ FOOTER ══════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(0,0,0,.45)", backdropFilter: "blur(24px)" }}>
        <div className="footer-grid pxs" style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 28px 48px", display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1.2fr", gap: 44 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              {logoUrl ? <img src={logoUrl} alt={brandName} style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }} />
                : <><div style={{ width: 36, height: 36, borderRadius: 11, background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontWeight: 900, fontSize: 17 }}>F</span></div>
                  <div><div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-.01em" }}>{brandName}</div><div style={{ fontSize: 9, color: "rgba(255,255,255,.3)", letterSpacing: ".08em" }}>MEDIA AGENCY</div></div></>}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.4)", lineHeight: 1.72, maxWidth: 280, marginBottom: 24 }}>Video production & media agency profesional berbasis di Wonosobo, Central Java. Mengubah ide menjadi visual sinematik yang tak terlupakan.</p>
            <div style={{ display: "flex", gap: 9 }}>
              {[{ icon: <Instagram size={14} />, href: cont.instagram || "#", label: "IG" }, { icon: <Youtube size={14} />, href: cont.youtube || "#", label: "YT" }, { icon: <MessageCircle size={14} />, href: wa, label: "WA" }].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" title={s.label} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.45)", textDecoration: "none", transition: "all .2s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = `${OR}22`; el.style.borderColor = `${OR}44`; el.style.color = OR; }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "rgba(255,255,255,.06)"; el.style.borderColor = "rgba(255,255,255,.09)"; el.style.color = "rgba(255,255,255,.45)"; }}>
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
          {/* Services */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 20 }}>Layanan</p>
            {["Commercial Video", "Music Video", "Short Film", "Documentary", "Wedding Cinema", "Corporate", "Event"].map(l => (
              <a key={l} href={`#services`} style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,.44)", textDecoration: "none", marginBottom: 10, transition: "color .2s" }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
                onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.44)"}>{l}</a>
            ))}
          </div>
          {/* Academy */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 20 }}>Academy</p>
            {["Semua Kursus", "Videografi Dasar", "Sinematografi Pro", "Color Grading", "Editing", "Sertifikasi", "Digital Assets"].map(l => (
              <a key={l} href={`/store`} style={{ display: "block", fontSize: 13, color: "rgba(255,255,255,.44)", textDecoration: "none", marginBottom: 10, transition: "color .2s" }}
                onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
                onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.44)"}>{l}</a>
            ))}
          </div>
          {/* Contact info */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginBottom: 20 }}>Info</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <MapPin size={13} color={OR} style={{ flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 13, color: "rgba(255,255,255,.44)", lineHeight: 1.55 }}>Wonosobo,<br />Central Java, Indonesia</span>
              </div>
              {cont.email && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Mail size={13} color={OR} style={{ flexShrink: 0 }} /><a href={`mailto:${cont.email}`} style={{ fontSize: 13, color: "rgba(255,255,255,.44)", textDecoration: "none" }}>{cont.email}</a></div>}
              {cont.phone && <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Phone size={13} color={OR} style={{ flexShrink: 0 }} /><span style={{ fontSize: 13, color: "rgba(255,255,255,.44)" }}>{cont.phone}</span></div>}
              {cont.whatsapp && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 100, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700, width: "fit-content", marginTop: 4 }}><MessageCircle size={13} /> Chat Sekarang</a>}
            </div>
          </div>
        </div>
        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,.055)", padding: "18px 28px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.18)" }}>© {new Date().getFullYear()} {brandName}. All rights reserved.</p>
            <div style={{ display: "flex", gap: 20 }}>
              {[["Home", "/"], ["Academy", "#courses"], ["Store", "/store"], ["Crew", "/crew/login"], ["Admin", "/login"]].map(([lbl, href]) => (
                <a key={href} href={href} style={{ fontSize: 11, color: "rgba(255,255,255,.22)", textDecoration: "none", transition: "color .2s" }}
                  onMouseEnter={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.65)"}
                  onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.22)"}>{lbl}</a>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.14)" }}>Built with ❤️ Frameless Team</p>
          </div>
        </div>
      </footer>

      {modal && <VideoModal url={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
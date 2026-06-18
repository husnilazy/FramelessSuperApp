// artifacts/frameless/src/pages/landing.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Play, X, ArrowRight, ChevronRight, Menu,
  Users, Award, Film, BookOpen, Shield, Zap, Mail,
  MessageCircle, MapPin, Phone, Instagram, Youtube,
  Star, Clock, TrendingUp, Volume2, VolumeX,
  Linkedin, Twitter, Globe,
  Clapperboard, Music2, Camera, Tv, Heart, Smartphone, Building2, PartyPopper,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CmsData { [s: string]: { [k: string]: string } }
interface SiteVideo { id: string; title: string; description: string; embedUrl: string; thumbnailUrl: string; category: string; tags: string; isActive: boolean; orderIndex: number; }
interface SiteLogo { id: string; name: string; imageUrl: string; isActive: boolean; orderIndex: number; }
interface Package { id: string; name: string; price: string; isTrial: boolean; isActive?: boolean; features?: string; description?: string; }
interface Course { id: string; title: string; slug: string; level: string; subtitle?: string; thumbnail?: string; highlightVideoUrl?: string; instructor?: string; category?: string; isPublished?: boolean; packages: Package[]; }
interface DigitalAsset { id: string; title: string; description?: string; price: string; thumbnailUrl?: string; category?: string; fileType?: string; isActive: boolean; }
interface Service { icon: string; title: string; description: string; tags: string[]; slug: string; price?: string; highlightVideoUrl?: string; }

const OR = "#F03820";   // Red-orange (warmer, more vibrant red)
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

function isDirectVideo(url?: string) {
  return !!url && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url);
}

function formatIdDate(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function courseHref(slug: string) {
  return `/course/${encodeURIComponent(slug)}`;
}

// ── Service icon map (slug → Lucide icon, replaces emoji) ──────────────────────
const SERVICE_ICON_MAP: Record<string, any> = {
  "commercial-video": Tv,
  "music-video": Music2,
  "short-film": Clapperboard,
  "documentary": Camera,
  "wedding-cinema": Heart,
  "social-media": Smartphone,
  "corporate-video": Building2,
  "event-coverage": PartyPopper,
};
function getServiceIcon(slug: string) {
  return SERVICE_ICON_MAP[slug] || Film;
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
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);}}
@keyframes glow{0%,100%{box-shadow:0 0 20px ${OR}44;}50%{box-shadow:0 0 40px ${OR}88;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pf-pulse-glow{0%,100%{box-shadow:0 32px 96px rgba(0,0,0,.75),0 0 60px ${OR}22,0 0 120px ${OR}08;}50%{box-shadow:0 32px 96px rgba(0,0,0,.75),0 0 100px ${OR}40,0 0 200px ${OR}14;}}
@keyframes pf-progress{from{width:0%;}to{width:100%;}}
@keyframes click-glow{0%{box-shadow:0 0 0 0 ${OR}66;}100%{box-shadow:0 0 0 10px ${OR}00;}}

.pf-3d-card{transition:all .58s cubic-bezier(.16,1,.3,1);}
.pf-3d-card:hover img{transform:scale(1.06);}
.pf-center-card{animation:pf-pulse-glow 3.5s ease-in-out infinite;}

/* Crew Gallery — 3 baris marquee independen, auto-scroll terus-menerus (linear infinite, tanpa jeda).
   Baris tengah (.cg-row-reverse) bergerak ke arah BERLAWANAN dari baris atas & bawah, sesuai permintaan.
   Track digandakan 2x di JSX -> animasi geser dari 0% ke -50% supaya loop-nya seamless tanpa "patah". */
@keyframes cg-row-scroll-left{from{transform:translateX(0);}to{transform:translateX(-50%);}}
@keyframes cg-row-scroll-right{from{transform:translateX(-50%);}to{transform:translateX(0);}}
.cg-row-track{animation:cg-row-scroll-left linear infinite;}
.cg-row-track.cg-row-reverse{animation:cg-row-scroll-right linear infinite;}
.cg-row-card{transition:transform .3s ease;}
.cg-row-card:hover{transform:scale(1.04);z-index:5;}
.cg-row-card:hover img{transform:scale(1.06);transition:transform .4s ease;}

.pf-arrow{transition:background .2s,border-color .2s,box-shadow .2s!important;}
.pf-arrow:hover{background:${OR}22!important;border-color:${OR}55!important;box-shadow:0 0 20px ${OR}33!important;}
.pf-arrow:active{animation:click-glow .4s ease-out;}
.pf-dot{transition:all .35s cubic-bezier(.16,1,.3,1);}
.pf-thumb{transition:opacity .25s,border-color .25s,box-shadow .25s,transform .22s;}
.pf-thumb:hover{opacity:.9!important;transform:scale(1.06) translateY(-2px)!important;}
.pf-progress-bar{animation:pf-progress 4.5s linear forwards;}
.no-scrollbar::-webkit-scrollbar{display:none;}
.no-scrollbar{scrollbar-width:none;}

/* Crew Gallery thumbnail caption — hidden by default, fades in on hover/touch */
.cg-thumb-caption{transition:opacity .22s ease;}
.cg-thumb:hover .cg-thumb-caption{opacity:1!important;}

/* ── Spring-physics button animations ─────────────────────────────────── */

.wa-btn {
  transition: transform .24s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease !important;
  will-change: transform;
}
.wa-btn:hover {
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 10px 32px rgba(37,211,102,.45), 0 0 22px rgba(37,211,102,.3) !important;
}
.wa-btn:active {
  transform: scale(0.91) !important;
  box-shadow: 0 0 0 5px rgba(37,211,102,.35) !important;
  transition: transform .07s ease, box-shadow .07s ease !important;
}

/* Orange primary buttons */
.og-btn {
  transition: transform .24s cubic-bezier(.34,1.56,.64,1), box-shadow .22s ease, opacity .15s !important;
  will-change: transform;
}
.og-btn:hover {
  transform: translateY(-2px) scale(1.05) !important;
  box-shadow: 0 10px 36px ${OR}55, 0 0 0 1px ${OR}38, 0 0 24px ${OR}35 !important;
  opacity: 1 !important;
}
.og-btn:active {
  transform: scale(0.91) !important;
  box-shadow: 0 0 0 5px ${OR}44, 0 0 28px ${OR}66 !important;
  transition: transform .07s ease, box-shadow .07s ease !important;
}

/* Outline / ghost buttons */
.outline-btn {
  transition: transform .24s cubic-bezier(.34,1.56,.64,1), border-color .18s, background .18s, box-shadow .18s !important;
  will-change: transform;
}
.outline-btn:hover {
  transform: translateY(-1px) scale(1.03) !important;
  border-color: rgba(255,255,255,.32) !important;
  background: rgba(255,255,255,.06) !important;
}
.outline-btn:active {
  transform: scale(0.94) !important;
  box-shadow: 0 0 0 3px rgba(255,255,255,.22) !important;
  transition: transform .07s ease, box-shadow .07s ease !important;
}

/* Category / pill buttons */
.pill-btn {
  transition: transform .2s cubic-bezier(.34,1.56,.64,1), background .18s, border-color .18s, color .18s, box-shadow .18s !important;
  will-change: transform;
}
.pill-btn:hover {
  transform: translateY(-1px) scale(1.06) !important;
}
.pill-btn:active {
  transform: scale(0.91) !important;
  transition: transform .07s ease !important;
}
.pill-btn.pill-active:active {
  box-shadow: 0 0 0 4px ${OR}44, 0 0 18px ${OR}55 !important;
}

.social-icon {
  transition: background .2s, border-color .2s, color .2s, transform .22s cubic-bezier(.34,1.56,.64,1), box-shadow .22s !important;
}
.social-icon:hover {
  background: ${OR}22 !important;
  border-color: ${OR}44 !important;
  color: ${OR} !important;
  transform: translateY(-2px) scale(1.1) !important;
  box-shadow: 0 6px 18px ${OR}33 !important;
}
.social-icon:active {
  transform: scale(0.88) !important;
  box-shadow: 0 0 0 4px ${OR}44 !important;
  transition-duration: .07s !important;
}

/* Nav links */
.nav-link {
  transition: color .18s, transform .2s cubic-bezier(.34,1.56,.64,1) !important;
}
.nav-link:hover {
  color: #fff !important;
  transform: translateY(-1px) !important;
}
.nav-link:active {
  transform: scale(0.94) !important;
  transition-duration: .07s !important;
}

/* Carousel arrows — keep translateY(-50%) in all states */
.pf-arrow {
  transition: background .2s, border-color .2s, box-shadow .22s, transform .22s cubic-bezier(.34,1.56,.64,1) !important;
}
.pf-arrow:hover {
  background: ${OR}22 !important;
  border-color: ${OR}55 !important;
  box-shadow: 0 0 0 1px ${OR}44, 0 0 20px ${OR}44 !important;
  transform: translateY(-50%) scale(1.14) !important;
}
.pf-arrow:active {
  transform: translateY(-50%) scale(0.86) !important;
  box-shadow: 0 0 0 4px ${OR}55, 0 0 28px ${OR}77 !important;
  transition: transform .07s ease, box-shadow .07s ease !important;
}

.pf-dot { transition: all .35s cubic-bezier(.16,1,.3,1); }
.pf-dot:hover { transform: scale(1.3) !important; }
.pf-dot:active { transform: scale(0.82) !important; transition-duration: .08s !important; }

.pf-thumb { transition: opacity .25s, border-color .25s, box-shadow .25s, transform .22s cubic-bezier(.34,1.56,.64,1); }
.pf-thumb:hover { opacity: .9 !important; transform: scale(1.07) translateY(-3px) !important; }
.pf-thumb:active { transform: scale(0.94) !important; transition-duration: .07s !important; }

.pf-progress-bar { animation: pf-progress 4.5s linear forwards; }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { scrollbar-width: none; }

/* Glow on click — applied via animation keyframe on .og-btn:active */
@keyframes click-ring { 0%{box-shadow:0 0 0 0 ${OR}66,0 0 0 0 ${OR}44;} 100%{box-shadow:0 0 0 14px ${OR}00,0 0 32px ${OR}00;} }

.mq-inner { animation: marquee 40s linear infinite; }
.mq-inner:hover { animation-play-state: paused; }

.fu { opacity: 0; animation: fadeUp .45s ease forwards; }
.d1{animation-delay:0s;}.d2{animation-delay:.06s;}.d3{animation-delay:.13s;}.d4{animation-delay:.22s;}

.nav-link{font-size:13px;font-weight:600;color:rgba(255,255,255,.5);text-decoration:none;transition:color .2s;letter-spacing:.01em;padding:6px 0;}
.nav-link:hover{color:#fff;}

.svc-card{transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .3s,border-color .25s!important;}
.svc-card:hover img{transform:scale(1.06);transition:transform .5s ease;}

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

.course-card{transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .25s,box-shadow .28s;}
.course-card:active{transform:scale(0.97)!important;transition-duration:.08s!important;}
.course-card:hover{transform:translateY(-5px);}

.asset-card{transition:transform .3s cubic-bezier(.16,1,.3,1),border-color .25s;}
.asset-card:active{transform:scale(0.96)!important;transition-duration:.08s!important;}
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
        {isDirectVideo(url) ? (
          <video src={url} controls autoPlay playsInline style={{ width: "100%", height: "100%", borderRadius: 14, border: "none", background: "#000" }} />
        ) : (
          <iframe src={watchUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 14, border: "none" }} allow="autoplay;fullscreen" allowFullScreen />
        )}
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
  const [btfIndex, setBtfIndex] = useState(0);   // Behind-the-Frame slider index
  const [svcIndex, setSvcIndex] = useState(0);   // Services carousel index
  const bgRef = useRef<HTMLDivElement>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const pfSliderRef = useRef<HTMLDivElement>(null);
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
  const { data: teamMembers = [] } = useQuery<any[]>({ 
    queryKey: ["/api/team"], 
    queryFn: () => fetch("/api/team").then(r => r.ok ? r.json() : []).then((a: any[]) => a.filter((m: any) => (m.isActive !== false) && m.name).sort((a: any, b: any) => (a.orderIndex||0) - (b.orderIndex||0))).catch(() => []) 
  });

  // ── CMS fields ────────────────────────────────────────────────────────────
  const hero = cms?.hero || {};
  const brand = cms?.branding || {};
  const stat = cms?.stats || {};
  const cont = cms?.contact || {};
  const thm = cms?.theme || {};

  const c1 = thm.meshColor1 || OR, c2 = thm.meshColor2 || "#7c3aed", c3 = thm.meshColor3 || "#2563eb";
  const logoUrl = brand.logoUrl || "";
  const brandName = brand.name || "Frameless Creative";
  const activeTeam = teamMembers.filter((m: any) => m.isActive !== false);
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

  const allTags = Array.from(new Set(pfVids.flatMap(v => { try { return JSON.parse(v.tags || "[]"); } catch { return []; } })));
  const pfShown = pfTag === "All" ? pfVids : pfVids.filter(v => { try { return JSON.parse(v.tags || "[]").includes(pfTag); } catch { return false; } });

  // ── Autoplay portfolio slider (SETELAH pfShown dideklarasikan) ─────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pfShown.length <= 1) return;
    const id = setInterval(() => setSlideIndex(prev => (prev + 1) % pfShown.length), 4500);
    return () => clearInterval(id);
  }, [pfShown.length]); // reset interval ketika category filter berubah

  // ── Autoplay Behind-the-Frame slider ────────────────────────────────────────
  const reelVids = vids.filter(v => v.category === "reels" || v.category === "portrait" || v.category === "behind-the-frame" || v.category === "Behind the Frame");
  useEffect(() => {
    if (reelVids.length <= 1) return;
    const id = setInterval(() => setBtfIndex(prev => (prev + 1) % reelVids.length), 5000);
    return () => clearInterval(id);
  }, [reelVids.length]);

  // ── Autoplay Services carousel ──────────────────────────────────────────────
  useEffect(() => {
    if (services.length <= 1) return;
    const id = setInterval(() => setSvcIndex(prev => (prev + 1) % services.length), 4000);
    return () => clearInterval(id);
  }, [services.length]);

  // ── Crew Gallery (Behind-the-Scenes photos) ─────────────────────────────────
  const crewGalleryPhotos = (() => {
    try { return JSON.parse(cms?.crewGallery?.items || "[]") as { id: string; photoUrl: string; productionTitle: string; productionDate: string }[]; } catch { return []; }
  })();

  // FIX FLICKER: lebar random tiap foto dihitung SEKALI lewat useMemo (bergantung jumlah foto),
  // bukan dipanggil ulang di setiap render seperti sebelumnya. Sebelumnya randomWidth() dipanggil
  // langsung di dalam .map() pada body render -- itu artinya SETIAP re-render component (yang sering
  // terjadi karena autoplay carousel lain di halaman ini berjalan setiap beberapa detik) bikin lebar
  // semua card berubah acak lagi di tengah animasi CSS yang sedang berjalan, sehingga track-nya terlihat
  // "patah/flicker". Dengan useMemo, lebar di-generate sekali saat mount dan tetap stabil selamanya.
  const crewGalleryRows = useMemo(() => {
    const rows: { id: string; photoUrl: string; productionTitle: string; productionDate: string; w: number }[][] = [[], [], []];
    const widthChoices = [170, 210, 250, 290, 150, 230];
    crewGalleryPhotos.forEach((p, i) => {
      const w = widthChoices[Math.floor(Math.random() * widthChoices.length)];
      rows[i % 3].push({ ...p, w });
    });
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crewGalleryPhotos.length]);

  const pubCourses = courses.filter(c => c.isPublished !== false && c.packages?.length > 0);
  const pubAssets = assets.filter(a => a.isActive).slice(0, 6);

  const waMsg = "Halo%20Admin%20Frameless%20Creative!%20%F0%9F%91%8B%20Saya%20ingin%20menanyakan%20mengenai%20project%20video.%20Bisa%20dibantu%3F";
  const wa = cont.whatsapp ? `https://wa.me/${cont.whatsapp.replace(/\D/g, "")}?text=${waMsg}` : "#";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: "#0a0a0c", color: "#f0f0f0", fontFamily: FONT, minHeight: "100vh", overflowX: "hidden", position: "relative" }}>
      <style>{CSS}</style>

      {/* ══════ GLOBAL AMBIENT MESH — fixed di belakang SELURUH halaman, tidak ikut scroll ══════
          Ini menggantikan pendekatan lama (tiap section punya radial-gradient sendiri-sendiri di
          atas base warna solid #0a0a0c yang identik). Karena base-nya solid datar, mata menangkap
          tiap "blob" gradient lokal sebagai area terpisah -- itu sebabnya batas antar section dan
          pojok-pojok section (terutama yang sebelumnya punya layer solid tambahan, seperti Crew
          Gallery) terasa kaku/berjahit. Dengan satu mesh lembut yang fixed mengisi seluruh viewport
          di layer paling belakang, semua section -- termasuk yang transparan -- otomatis "melihat"
          warna ambient yang sama mengalir di belakangnya, sehingga transisi antar section menyatu. */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: "70%", height: "60%", top: "-12%", left: "-10%", background: `radial-gradient(ellipse at center,${OR}10 0%,transparent 70%)`, filter: "blur(90px)" }} />
        <div style={{ position: "absolute", width: "65%", height: "55%", top: "20%", right: "-15%", background: `radial-gradient(ellipse at center,${c2}0c 0%,transparent 72%)`, filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: "60%", height: "55%", bottom: "-10%", left: "10%", background: `radial-gradient(ellipse at center,${c3}0a 0%,transparent 74%)`, filter: "blur(100px)" }} />
        <div style={{ position: "absolute", width: "50%", height: "45%", bottom: "20%", right: "5%", background: `radial-gradient(ellipse at center,${OR}08 0%,transparent 70%)`, filter: "blur(90px)" }} />
      </div>

      {/* ══════ MOBILE NAV ══════ */}
      {mobileNav && (
        <div onClick={() => setMobileNav(false)} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(10,10,12,.98)", backdropFilter: "blur(24px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <button onClick={() => setMobileNav(false)} style={{ position: "absolute", top: 22, right: 22, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><X size={20} /></button>
          {[["Services", "#services"], ["Portfolio", "#portfolio"], ["Reels", "#reels"], ["Academy", "#courses"], ["Store", "#store"], ["Contact", "#contact"]].map(([l, h]) => (
            <a key={h} href={h} onClick={() => setMobileNav(false)} style={{ fontSize: 30, fontWeight: 900, color: "rgba(255,255,255,.65)", textDecoration: "none", letterSpacing: "-.03em", padding: "8px 0", transition: "color .2s" }}
              onMouseEnter={e => (e.target as HTMLElement).style.color = "#fff"}
              onMouseLeave={e => (e.target as HTMLElement).style.color = "rgba(255,255,255,.65)"}>{l}</a>
          ))}
          <a href="#courses" onClick={() => setMobileNav(false)} className="og-btn" style={{ marginTop: 16, padding: "14px 40px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 16, fontWeight: 800 }}>Mulai Belajar</a>
        </div>
      )}

      {/* ══════ NAVBAR ══════ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 66, background: "rgba(10,10,12,.72)", backdropFilter: "blur(24px) saturate(180%)", borderBottom: "1px solid rgba(255,255,255,.055)" }}>
        {/* Inner container — properly centered */}
        <div style={{ maxWidth: 1280, margin: "0 auto", height: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>

          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", flexShrink: 0 }}>
            {logoUrl
              ? <img src={logoUrl} alt={brandName} loading="eager" fetchPriority="high" style={{ height: 32, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
              : <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-.02em", lineHeight: 1 }}>{brandName}</div>
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
            <a href="#courses" className="nav-cta-desktop og-btn" style={{ padding: "9px 20px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
              Mulai Belajar
            </a>
            {/* Hamburger */}
            <button className="hamburger outline-btn" onClick={() => setMobileNav(true)}
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
              ? <button onClick={() => setModal(showreel.embedUrl)} className="og-btn" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}><Play style={{ width: 15, height: 15, fill: "#fff" }} /> Tonton Showreel</button>
              : <a href="#services" className="og-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>Lihat Layanan <ArrowRight size={15} /></a>
            }
            <a href="#courses" className="outline-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.78)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}><BookOpen size={15} /> Frameless Academy</a>
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
      <section id="services" className="pxs" style={{ padding: "110px 0", position: "relative", overflow: "hidden" }}>
        <div data-px="0.1" style={{ position: "absolute", top: "5%", right: "-8%", width: "55%", height: "65%", background: `radial-gradient(ellipse at center,${c2}10,transparent 70%)`, filter: "blur(60px)", willChange: "transform" }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 0%,${OR}08,transparent 65%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 48, flexWrap: "wrap", gap: 16 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>LAYANAN KAMI</p>
              <h2 style={{ fontSize: "clamp(28px,4.5vw,52px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", margin: 0, lineHeight: 1.0 }}>
                Produksi Video<br /><span style={{ color: "rgba(255,255,255,.28)" }}>dari Konsep ke Screen</span>
              </h2>
            </div>
            <a href="/services" className="outline-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 12, border: `1px solid ${OR}44`, color: OR, textDecoration: "none", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              Lihat semua layanan <ChevronRight size={14} />
            </a>
          </div>
        </div>

        {/* Auto-sliding services carousel */}
        {services.length > 0 && (() => {
          const total  = services.length;
          const curIdx = svcIndex % total;
          const goTo   = (i: number) => setSvcIndex(((i % total) + total) % total);
          const STEP   = 360; // px offset per step

          return (
            <div style={{ position: "relative" }}>
              <div style={{ maxWidth: 1100, margin: "0 auto", overflow: "hidden", position: "relative" }}>
                {/* Fade masks */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "14%", background: "linear-gradient(to right,#0a0a0c 25%,transparent)", zIndex: 20, pointerEvents: "none" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "14%", background: "linear-gradient(to left,#0a0a0c 25%,transparent)", zIndex: 20, pointerEvents: "none" }} />

                <div style={{ position: "relative", height: "clamp(280px, 36vw, 380px)" }}>
                  {services.map((s, idx) => {
                    let rel = ((idx - curIdx) % total + total) % total;
                    if (rel > total / 2) rel -= total;
                    if (Math.abs(rel) > 2) return null;

                    const isC    = rel === 0;
                    const ab     = Math.abs(rel);
                    const scale  = ([1, 0.84, 0.68] as const)[ab];
                    const opac   = ([1, 0.55, 0.25] as const)[ab];
                    const zIdx   = ([15, 8, 3] as const)[ab];
                    const Icon   = getServiceIcon(s.slug);
                    const hv     = s.highlightVideoUrl;
                    const hvEmbed = isC && hv && !isDirectVideo(hv) ? autoEmbed(hv, true) : "";

                    return (
                      <a
                        key={s.slug || idx}
                        href={isC ? `/services#${s.slug || idx}` : undefined}
                        onClick={e => { if (!isC) { e.preventDefault(); goTo(idx); } }}
                        className="svc-card"
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: `calc(50% + ${rel * STEP}px)`,
                          transform: `translateX(-50%) translateY(-50%) scale(${scale})`,
                          width: "min(78%, 420px)",
                          height: "clamp(260px, 33vw, 340px)",
                          borderRadius: 20,
                          overflow: "hidden",
                          textDecoration: "none",
                          cursor: "pointer",
                          zIndex: zIdx,
                          opacity: opac,
                          display: "block",
                          background: "#101013",
                          boxShadow: isC
                            ? `0 0 0 1px rgba(255,255,255,.09), 0 24px 64px rgba(0,0,0,.65), 0 0 44px ${OR}1c`
                            : "0 12px 36px rgba(0,0,0,.5)",
                        }}
                      >
                        {/* Background priority: highlight video (center, autoplay) > YouTube embed (center) > branded gradient fallback */}
                        {isC && hv && isDirectVideo(hv) ? (
                          <video key={`svc-vid-${s.slug}`} src={hv} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : isC && hvEmbed ? (
                          <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                            <iframe
                              key={`svc-embed-${s.slug}`}
                              src={`${hvEmbed}&controls=0&modestbranding=1&rel=0&disablekb=1`}
                              style={{ position: "absolute", top: "50%", left: "50%", width: "300%", height: "300%", transform: "translate(-50%,-50%)", border: "none", pointerEvents: "none" }}
                              allow="autoplay; muted; loop"
                            />
                          </div>
                        ) : (
                          // Belum ada video highlight di CMS — gradient bermerek + ikon besar transparan (bukan video acak/tebakan)
                          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(150deg,${c1}2c,${c2}1a)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon size={64} color="rgba(255,255,255,.06)" strokeWidth={1.4} />
                          </div>
                        )}
                        <div style={{ position: "absolute", inset: 0, background: isC
                          ? "linear-gradient(to top,rgba(8,8,10,.95) 0%,rgba(8,8,10,.55) 42%,rgba(8,8,10,.18) 100%)"
                          : "rgba(8,8,10,.45)" }} />

                        {isC && <div style={{ position: "absolute", inset: 0, borderRadius: 20, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.1)", pointerEvents: "none" }} />}

                        {/* Icon badge */}
                        <div style={{
                          position: "absolute", top: 22, left: 22,
                          width: 46, height: 46, borderRadius: 13,
                          background: `${OR}1e`, border: `1px solid ${OR}40`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          backdropFilter: "blur(10px)",
                        }}>
                          <Icon size={20} color={OR} strokeWidth={2} />
                        </div>

                        {/* Counter (center) */}
                        {isC && total > 1 && (
                          <div style={{ position: "absolute", top: 22, right: 18, padding: "3px 10px", borderRadius: 100, background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.1)", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.55)", backdropFilter: "blur(8px)" }}>
                            {String(curIdx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                          </div>
                        )}

                        {/* Info */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "clamp(16px,2.4vw,26px)" }}>
                          {isC ? (
                            <motion.div key={`svc-info-${s.slug}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}>
                              <h3 style={{ fontSize: "clamp(16px,2.2vw,22px)", fontWeight: 800, color: "#fff", letterSpacing: "-.02em", marginBottom: 7, lineHeight: 1.15 }}>{s.title}</h3>
                              <p style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)", lineHeight: 1.6, marginBottom: 12, maxWidth: 340 }}>{s.description}</p>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                {(s.tags || []).slice(0, 3).map((t: string) => (
                                  <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 100, background: `${OR}1e`, border: `1px solid ${OR}3c`, color: OR, letterSpacing: ".06em", textTransform: "uppercase" }}>{t}</span>
                                ))}
                              </div>
                            </motion.div>
                          ) : (
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.7)", letterSpacing: "-.01em" }}>{s.title}</h3>
                          )}
                        </div>
                      </a>
                    );
                  })}
                </div>

                {/* Arrows */}
                {total > 1 && (
                  <>
                    <button className="pf-arrow" onClick={() => goTo(curIdx - 1)} style={{
                      position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                      width: 40, height: 40, borderRadius: "50%", zIndex: 30,
                      background: "rgba(10,10,12,.78)", border: "1px solid rgba(255,255,255,.12)",
                      color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      backdropFilter: "blur(10px)", fontSize: 21, fontWeight: 300,
                    }}>‹</button>
                    <button className="pf-arrow" onClick={() => goTo(curIdx + 1)} style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                      width: 40, height: 40, borderRadius: "50%", zIndex: 30,
                      background: "rgba(10,10,12,.78)", border: "1px solid rgba(255,255,255,.12)",
                      color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      backdropFilter: "blur(10px)", fontSize: 21, fontWeight: 300,
                    }}>›</button>
                  </>
                )}
              </div>

              {/* Progress bar */}
              {total > 1 && (
                <div style={{ maxWidth: 280, margin: "22px auto 0", height: 2, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden" }}>
                  <div key={`svc-prog-${curIdx}`} className="pf-progress-bar" style={{ height: "100%", background: OR, width: 0, animationDuration: "4s", borderRadius: 2 }} />
                </div>
              )}

              {/* Dots */}
              {total > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
                  {services.map((_, i) => (
                    <button key={i} className="pf-dot" onClick={() => goTo(i)} style={{
                      width: i === curIdx ? 22 : 6, height: 6, borderRadius: 100, padding: 0, border: "none", cursor: "pointer",
                      background: i === curIdx ? OR : "rgba(255,255,255,.15)",
                      boxShadow: i === curIdx ? `0 0 8px ${OR}55` : "none",
                    }} />
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* ══════ BEHIND THE FRAME — Portrait Auto-Slider ══════ */}
      {(reelVids.length > 0 || true) && (
        <section id="reels" style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 90% 70% at 50% 50%,${OR}07,transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,${OR}28,transparent)` }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,${OR}18,transparent)` }} />

          {/* Header */}
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 48px", textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: OR, textTransform: "uppercase", marginBottom: 10 }}>FILM & REEL</p>
            <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.0, marginBottom: 10 }}>Behind the Frame</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,.38)", lineHeight: 1.65 }}>Cuplikan karya terbaik dari berbagai project yang sudah kami kerjakan.</p>
          </div>

          {/* Portrait Auto-Slider */}
          {(() => {
            const srcList = reelVids.length > 0 ? reelVids : [
              { id: "d1", title: "Wedding Film",    embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", description: "Cinematic Wedding",    tags: "[]", isActive: true, orderIndex: 0 },
              { id: "d2", title: "Commercial TVC",  embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", description: "Brand Video",          tags: "[]", isActive: true, orderIndex: 1 },
              { id: "d3", title: "Music Video",     embedUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ", thumbnailUrl: "", category: "reels", description: "Artist Production",   tags: "[]", isActive: true, orderIndex: 2 },
            ] as SiteVideo[];

            const total  = srcList.length;
            const curIdx = btfIndex % total;
            const goTo   = (i: number) => setBtfIndex(((i % total) + total) % total);
            const STEP   = 300; // px per step (portrait cards, narrower)

            return (
              <div style={{ position: "relative" }}>
                {/* Stage — centered, clips side cards */}
                <div style={{ maxWidth: 960, margin: "0 auto", overflow: "hidden", position: "relative" }}>

                  {/* Fade masks */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "18%", background: "linear-gradient(to right,#0a0a0c 20%,transparent)", zIndex: 20, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "18%", background: "linear-gradient(to left,#0a0a0c 20%,transparent)", zIndex: 20, pointerEvents: "none" }} />

                  {/* Card track */}
                  <div style={{ position: "relative", height: "clamp(340px, 52vw, 560px)" }}>
                    {srcList.map((v, idx) => {
                      let rel = ((idx - curIdx) % total + total) % total;
                      if (rel > total / 2) rel -= total;
                      if (Math.abs(rel) > 2) return null;

                      const isC   = rel === 0;
                      const ab    = Math.abs(rel);
                      const scale = ([1, 0.80, 0.62] as const)[ab];
                      const opac  = ([1, 0.55, 0.25] as const)[ab];
                      const zIdx  = ([15, 8,   3]    as const)[ab];
                      const th    = getThumbnail(v.embedUrl, v.thumbnailUrl);

                      // Auto-embed: autoplay, muted, looped, no controls, no branding
                      const embedSrc = autoEmbed(v.embedUrl, true);

                      return (
                        <div
                          key={v.id}
                          className="pf-3d-card"
                          onClick={() => isC ? setModal(v.embedUrl) : goTo(idx)}
                          style={{
                            position: "absolute",
                            top: "50%",
                            /* Portrait card: 9:16, centered, offset by STEP per slot */
                            left: `calc(50% + ${rel * STEP}px)`,
                            transform: `translateX(-50%) translateY(-50%) scale(${scale})`,
                            /* Width → aspect ratio 9:16 gives ~tall card */
                            width: "clamp(160px, 22vw, 240px)",
                            aspectRatio: "9/16",
                            borderRadius: 18,
                            overflow: "hidden",
                            cursor: "pointer",
                            zIndex: zIdx,
                            opacity: opac,
                            boxShadow: isC
                              ? `0 0 0 1px rgba(255,255,255,.10), 0 20px 60px rgba(0,0,0,.75), 0 0 44px ${OR}1a`
                              : "0 10px 32px rgba(0,0,0,.45)",
                            background: "#0f0f12",
                          }}
                        >
                          {/* CENTER CARD: iframe autoplay (hidden UI via overflow + scale trick) */}
                          {isC && embedSrc ? (
                            <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 18 }}>
                              <iframe
                                key={`btf-${v.id}`}
                                src={`${embedSrc}&controls=0&modestbranding=1&rel=0&disablekb=1`}
                                style={{
                                  position: "absolute",
                                  top: "50%", left: "50%",
                                  /* Scale up to hide YT borders/UI, clip with overflow:hidden */
                                  width: "300%", height: "300%",
                                  transform: "translate(-50%, -50%)",
                                  border: "none",
                                  pointerEvents: "none",
                                }}
                                allow="autoplay; muted; loop"
                              />
                            </div>
                          ) : (
                            /* SIDE CARDS: just thumbnail (no iframe for perf) */
                            th
                              ? <img src={th} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${OR}14,rgba(124,58,237,.14))` }} />
                          )}

                          {/* Gradient overlay */}
                          <div style={{ position: "absolute", inset: 0, background: isC
                            ? "linear-gradient(to top,rgba(0,0,0,.88) 0%,rgba(0,0,0,.1) 40%,transparent 100%)"
                            : "rgba(0,0,0,.22)" }} />

                          {/* Subtle border (center) */}
                          {isC && <div style={{ position: "absolute", inset: 0, borderRadius: 18, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)", pointerEvents: "none" }} />}

                          {/* Play icon (center) */}
                          {isC && (
                            <div style={{
                              position: "absolute", top: "50%", left: "50%",
                              transform: "translate(-50%,-50%)",
                              width: 52, height: 52, borderRadius: "50%",
                              background: `${OR}cc`, cursor: "pointer", zIndex: 5,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              boxShadow: `0 0 0 10px ${OR}18, 0 6px 24px ${OR}44`,
                              pointerEvents: "none",
                            }}>
                              <Play size={18} style={{ fill: "#fff", color: "#fff", marginLeft: 3 }} />
                            </div>
                          )}

                          {/* Info (center only) */}
                          {isC && (
                            <motion.div
                              key={`btf-info-${v.id}`}
                              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35, delay: .1 }}
                              style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "18px 16px" }}
                            >
                              <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-.02em", lineHeight: 1.2 }}>{v.title}</div>
                              {v.description && <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 3 }}>{v.description}</div>}
                            </motion.div>
                          )}

                          {/* Counter badge (center) */}
                          {isC && total > 1 && (
                            <div style={{ position: "absolute", top: 12, right: 12, padding: "2px 8px", borderRadius: 100, background: "rgba(0,0,0,.6)", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.09)" }}>
                              {String(curIdx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Arrow buttons */}
                  {total > 1 && (
                    <>
                      <button className="pf-arrow" onClick={() => goTo(curIdx - 1)} style={{
                        position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                        width: 38, height: 38, borderRadius: "50%", zIndex: 30,
                        background: "rgba(10,10,12,.8)", border: "1px solid rgba(255,255,255,.12)",
                        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(10px)", fontSize: 20, fontWeight: 300,
                      }}>‹</button>
                      <button className="pf-arrow" onClick={() => goTo(curIdx + 1)} style={{
                        position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                        width: 38, height: 38, borderRadius: "50%", zIndex: 30,
                        background: "rgba(10,10,12,.8)", border: "1px solid rgba(255,255,255,.12)",
                        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(10px)", fontSize: 20, fontWeight: 300,
                      }}>›</button>
                    </>
                  )}
                </div>

                {/* Progress bar */}
                {total > 1 && (
                  <div style={{ maxWidth: 280, margin: "18px auto 0", height: 2, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div key={`btf-prog-${curIdx}`} className="pf-progress-bar" style={{ height: "100%", background: OR, width: 0, animationDuration: "5s", borderRadius: 2 }} />
                  </div>
                )}

                {/* Dot indicators */}
                {total > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
                    {srcList.map((_, i) => (
                      <button key={i} className="pf-dot" onClick={() => goTo(i)} style={{
                        width: i === curIdx ? 22 : 6, height: 6, borderRadius: 100, padding: 0, border: "none", cursor: "pointer",
                        background: i === curIdx ? OR : "rgba(255,255,255,.15)",
                        boxShadow: i === curIdx ? `0 0 8px ${OR}55` : "none",
                      }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </section>
      )}

      {/* ══════ PORTFOLIO — Centered Minimal Carousel ══════ */}
      {pfVids.length > 0 && (
        <section id="portfolio" style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
          {/* Subtle bg glow */}
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 45% at 50% 100%,${OR}09,transparent 60%)`, pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(to right,transparent,rgba(255,255,255,.07),transparent)` }} />

          {/* ── Header ── */}
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 44px", position: "relative", zIndex: 2 }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: OR, textTransform: "uppercase", marginBottom: 10 }}>PORTFOLIO</p>
                <h2 style={{ fontSize: "clamp(26px,4vw,46px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.0 }}>Karya Terbaik Kami</h2>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["All", ...allTags].map(cat => (
                  <button key={cat} onClick={() => { setPfTag(cat); setSlideIndex(0); }} className={`pill-btn${pfTag === cat ? " pill-active" : ""}`} style={{
                    padding: "6px 15px", borderRadius: 100, fontSize: 11, fontWeight: 600,
                    cursor: "pointer", fontFamily: FONT,
                    background: pfTag === cat ? OR : "rgba(255,255,255,.05)",
                    border: pfTag === cat ? "none" : "1px solid rgba(255,255,255,.09)",
                    color: pfTag === cat ? "#fff" : "rgba(255,255,255,.42)",
                  }}>{cat}</button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Carousel (contained, centered) ── */}
          {pfShown.length > 0 && (() => {
            const total = pfShown.length;
            const goTo  = (i: number) => setSlideIndex(((i % total) + total) % total);
            const STEP  = 700; // px offset per step — works for 1100px max container

            return (
              <>
                {/* Stage: maxWidth 1100, overflow hidden → side cards clip cleanly */}
                <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", overflow: "hidden" }}>

                  {/* Fade masks — blend clipped cards into bg */}
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "13%", background: "linear-gradient(to right,#0a0a0c 25%,transparent)", zIndex: 20, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "13%", background: "linear-gradient(to left,#0a0a0c 25%,transparent)", zIndex: 20, pointerEvents: "none" }} />

                  {/* Card track */}
                  <div style={{ position: "relative", height: "clamp(180px,31vw,420px)" }}>
                    {pfShown.map((v, idx) => {
                      let rel = ((idx - slideIndex) % total + total) % total;
                      if (rel > total / 2) rel -= total;
                      if (Math.abs(rel) > 2) return null;

                      const isC = rel === 0;
                      const ab  = Math.abs(rel);
                      const scale = ([1, 0.81, 0.63] as const)[ab];
                      const opac  = ([1, 0.60, 0.28] as const)[ab];
                      const zIdx  = ([15, 8,  3]  as const)[ab];
                      const th    = getThumbnail(v.embedUrl, v.thumbnailUrl);

                      return (
                        <div
                          key={v.id}
                          className="pf-3d-card"
                          onClick={() => isC ? setModal(v.embedUrl) : goTo(idx)}
                          style={{
                            position: "absolute",
                            top: "50%",
                            /* KEY FIX: left = center + pixel offset per step */
                            left: `calc(50% + ${rel * STEP}px)`,
                            /* Card centers on its own anchor, then scales */
                            transform: `translateX(-50%) translateY(-50%) scale(${scale})`,
                            width: isC ? "min(70%, 770px)" : "min(52%, 572px)",
                            aspectRatio: "16/9",
                            borderRadius: 14,
                            overflow: "hidden",
                            cursor: "pointer",
                            zIndex: zIdx,
                            opacity: opac,
                            boxShadow: isC
                              ? `0 0 0 1px rgba(255,255,255,.1), 0 20px 60px rgba(0,0,0,.7), 0 0 48px ${OR}1e`
                              : "0 10px 32px rgba(0,0,0,.45)",
                          }}
                        >
                          {/* Thumbnail */}
                          {th
                            ? <img src={th} alt={v.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .6s cubic-bezier(.16,1,.3,1)" }} />
                            : <div style={{ width: "100%", height: "100%", background: "#0f0f12", display: "flex", alignItems: "center", justifyContent: "center" }}><Film size={28} color="rgba(255,255,255,.1)" /></div>
                          }

                          {/* Gradient */}
                          <div style={{ position: "absolute", inset: 0, background: isC
                            ? "linear-gradient(to top,rgba(0,0,0,.92) 0%,rgba(0,0,0,.18) 46%,transparent 100%)"
                            : "rgba(0,0,0,.26)" }} />

                          {/* Subtle border (center) */}
                          {isC && <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.11)", pointerEvents: "none" }} />}

                          {/* Play button */}
                          {isC && (
                            <motion.div
                              whileHover={{ scale: 1.12 }}
                              transition={{ type: "spring", stiffness: 380, damping: 20 }}
                              style={{
                                position: "absolute", top: "50%", left: "50%",
                                transform: "translate(-50%,-50%)",
                                width: 56, height: 56, borderRadius: "50%",
                                background: OR, cursor: "pointer", zIndex: 5,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                boxShadow: `0 0 0 10px ${OR}18, 0 8px 28px ${OR}40`,
                              }}
                            >
                              <Play size={20} style={{ fill: "#fff", color: "#fff", marginLeft: 3 }} />
                            </motion.div>
                          )}

                          {/* Info (center) */}
                          {isC && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "clamp(14px,2.2vw,26px)" }}>
                              <motion.div key={`pf-info-${v.id}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .36, delay: .08 }}>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 8 }}>
                                  {(() => { try { return (JSON.parse(v.tags || "[]") as string[]).slice(0, 2).map((t: string) => (
                                    <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${OR}1e`, border: `1px solid ${OR}40`, color: OR, letterSpacing: ".09em", textTransform: "uppercase" }}>{t}</span>
                                  )); } catch { return null; } })()}
                                </div>
                                <h3 style={{ fontSize: "clamp(14px,2vw,26px)", fontWeight: 900, color: "#fff", letterSpacing: "-.03em", lineHeight: 1.15 }}>{v.title}</h3>
                                {v.description && <p style={{ fontSize: "clamp(10px,.85vw,12px)", color: "rgba(255,255,255,.42)", marginTop: 4, lineHeight: 1.5 }}>{v.description}</p>}
                              </motion.div>
                            </div>
                          )}

                          {/* Counter (center) */}
                          {isC && total > 1 && (
                            <div style={{ position: "absolute", top: 13, right: 14, padding: "3px 9px", borderRadius: 100, background: "rgba(0,0,0,.6)", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.55)", letterSpacing: ".08em", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.09)" }}>
                              {String(slideIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Arrow buttons — inside stage, zIndex above masks */}
                  {total > 1 && (
                    <>
                      <button className="pf-arrow" onClick={() => goTo(slideIndex - 1)} style={{
                        position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                        width: 40, height: 40, borderRadius: "50%", zIndex: 30,
                        background: "rgba(10,10,12,.8)", border: "1px solid rgba(255,255,255,.11)",
                        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(10px)", fontSize: 22, fontWeight: 300, lineHeight: 1,
                      }}>‹</button>
                      <button className="pf-arrow" onClick={() => goTo(slideIndex + 1)} style={{
                        position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                        width: 40, height: 40, borderRadius: "50%", zIndex: 30,
                        background: "rgba(10,10,12,.8)", border: "1px solid rgba(255,255,255,.11)",
                        color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(10px)", fontSize: 22, fontWeight: 300, lineHeight: 1,
                      }}>›</button>
                    </>
                  )}
                </div>

                {/* Progress bar — narrow, centered */}
                {total > 1 && (
                  <div style={{ maxWidth: 360, margin: "18px auto 0", height: 2, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden" }}>
                    <div key={`prog-${slideIndex}`} className="pf-progress-bar" style={{ height: "100%", background: OR, width: 0, borderRadius: 2 }} />
                  </div>
                )}

                {/* Dots */}
                {total > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 14 }}>
                    {pfShown.map((_, i) => (
                      <button key={i} className="pf-dot" onClick={() => goTo(i)} style={{
                        width: i === slideIndex ? 22 : 6, height: 6, borderRadius: 100, padding: 0, border: "none", cursor: "pointer",
                        background: i === slideIndex ? OR : "rgba(255,255,255,.15)",
                        boxShadow: i === slideIndex ? `0 0 8px ${OR}55` : "none",
                      }} />
                    ))}
                  </div>
                )}

                {/* Thumbnail strip — centered within 960px */}
                {total > 1 && (
                  <div style={{ maxWidth: 960, margin: "16px auto 0", padding: "0 32px" }}>
                    <div className="no-scrollbar" style={{ display: "flex", gap: 7, overflowX: "auto", justifyContent: total <= 8 ? "center" : "flex-start" }}>
                      {pfShown.map((vid, i) => {
                        const tn  = getThumbnail(vid.embedUrl, vid.thumbnailUrl);
                        const isA = i === slideIndex;
                        return (
                          <div key={vid.id} className="pf-thumb" onClick={() => goTo(i)} style={{
                            flexShrink: 0, width: "clamp(60px,8vw,108px)", aspectRatio: "16/9",
                            borderRadius: 6, overflow: "hidden", cursor: "pointer", position: "relative",
                            border: isA ? `1.5px solid ${OR}` : "1.5px solid rgba(255,255,255,.07)",
                            boxShadow: isA ? `0 0 10px ${OR}40` : "none",
                            opacity: isA ? 1 : 0.38,
                          }}>
                            {tn
                              ? <img src={tn} alt={vid.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              : <div style={{ width: "100%", height: "100%", background: "#111" }} />
                            }
                            {isA && <div style={{ position: "absolute", inset: 0, background: `${OR}12` }} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
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
              <div
                className="g3"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),380px))",
                  justifyContent: "center",
                  gap: 22,
                  marginBottom: 48,
                }}
              >
                {pubCourses.slice(0, 3).map((c, idx) => {
                  const pkgs = c.packages.filter(p => p.isActive !== false);
                  const trial = pkgs.find(p => p.isTrial), paid = pkgs.filter(p => !p.isTrial);
                  const minPr = paid.length ? Math.min(...paid.map(p => Number(p.price))) : 0;
                  const pop = idx === 0 && pubCourses.length > 1;
                  const highlightUrl = c.highlightVideoUrl || "";
                  const hasHighlight = !!highlightUrl;
                  const directHighlight = isDirectVideo(highlightUrl);
                  const poster = getThumbnail(highlightUrl, c.thumbnail);
                  return (
                    <a key={c.id} href={courseHref(c.slug)} className="course-card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", border: `1.5px solid ${pop ? OR + "55" : "rgba(255,255,255,.08)"}`, background: "rgba(255,255,255,.022)", position: "relative", transition: "all .3s cubic-bezier(0.23, 1, 0.320, 1)" }}>
                      {pop && <div style={{ position: "absolute", top: 14, right: 14, background: OR, color: "#fff", fontSize: 10, padding: "6px 16px", borderRadius: 100, fontWeight: 700, textTransform: "uppercase", zIndex: 2, boxShadow: `0 8px 24px ${OR}33` }}>Popular</div>}
                      <div style={{ aspectRatio: "16/9", background: poster ? `url(${poster}) center/cover` : "linear-gradient(135deg,#1a0800,#3d1500)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", transition: "transform .4s" }}>
                        {directHighlight ? (
                          <video src={highlightUrl} poster={poster || undefined} autoPlay muted loop playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : poster ? (
                          <img src={poster} alt={c.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Film size={40} color="rgba(255,255,255,.28)" />
                        )}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 60%)" }} />
                        <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 6, flexWrap: "wrap", zIndex: 2 }}>
                          <span style={{ background: `${OR}22`, border: `1px solid ${OR}44`, color: OR, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, backdropFilter: "blur(8px)" }}>{c.level}</span>
                          {c.category && <span style={{ background: "rgba(0,0,0,.35)", color: "rgba(255,255,255,.6)", fontSize: 10, padding: "3px 10px", borderRadius: 100, backdropFilter: "blur(8px)" }}>{c.category}</span>}
                        </div>
                        {hasHighlight && <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModal(highlightUrl); }} style={{ position: "absolute", right: 14, bottom: 12, display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 100, border: "1px solid rgba(255,255,255,.16)", background: "rgba(10,10,12,.48)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(10px)", zIndex: 2 }}><Play size={12} fill="#fff" /> Highlight</button>}
                      </div>
                      <div style={{ padding: "22px 20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", color: "rgba(255,255,255,.26)", textTransform: "uppercase", margin: "0 0 10px" }}>Kelas Online Frameless</p>
                        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 0 8px", letterSpacing: "-.025em", lineHeight: 1.15 }}>{c.title}</h3>
                        {c.subtitle && <p style={{ fontSize: 13, color: "rgba(255,255,255,.42)", margin: "0 0 14px", lineHeight: 1.6 }}>{c.subtitle}</p>}
                        {c.instructor && <p style={{ fontSize: 12, color: "rgba(255,255,255,.32)", margin: "0 0 18px" }}>Instruktur: <strong style={{ color: "rgba(255,255,255,.62)" }}>{c.instructor}</strong></p>}
                        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 16, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14 }}>
                          <div>
                            <p style={{ fontSize: 9, color: "rgba(255,255,255,.27)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".08em" }}>Harga mulai</p>
                            <p style={{ fontSize: 22, fontWeight: 900, color: OR, margin: 0 }}>{minPr > 0 ? formatCurrency(minPr) : trial ? "GRATIS" : "Hubungi Kami"}</p>
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,.34)", margin: "6px 0 0" }}>{trial ? "Trial tersedia, detail paket ada di halaman course." : "Detail paket lengkap ada di halaman course."}</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 16px", borderRadius: 100, background: OR, color: "#fff", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>Lihat Detail <ChevronRight size={12} /></div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
              {pubCourses.length > 3 && (
                <div style={{ textAlign: "center", marginBottom: 48 }}>
                  <a href="/courses" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 100, border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.7)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
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
                <a href="/courses" className="og-btn" style={{ padding: "13px 26px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", textAlign: "center" }}>Lihat Semua Kelas →</a>
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
              <a href="/store" className="og-btn" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 22px", borderRadius: 12, background: OR, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Lihat Semua Aset <ArrowRight size={14} /></a>
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
            {cont.whatsapp && <a href={wa} target="_blank" rel="noopener noreferrer" className="wa-btn" style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 26px", borderRadius: 100, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}><MessageCircle size={16} /> WhatsApp</a>}
            {cont.email && <a href={`mailto:${cont.email}`} className="outline-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 26px", borderRadius: 100, border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.78)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}><Mail size={15} />{cont.email}</a>}
            {!cont.whatsapp && !cont.email && <a href="https://wa.me/0859106723181?text=Halo%20Admin%20Frameless%20Creative!%20%F0%9F%91%8B%20Saya%20ingin%20menanyakan%20mengenai%20project%20video.%20Bisa%20dibantu%3F" target="_blank" rel="noopener noreferrer" className="og-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 700 }}>Hubungi Kami <ArrowRight size={15} /></a>}
          </div>
        </div>
      </section>

      {/* ══════ CREW PROFILES (modern glow animated cards) ══════ */}
      {activeTeam.length > 0 && (
        <section id="crew" className="pxs" style={{ padding: "80px 28px 100px", position: "relative", overflow: "hidden" }}>
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".2em", color: OR, textTransform: "uppercase", marginBottom: 8 }}>THE TEAM</div>
              <h2 style={{ fontSize: "clamp(28px, 4.5vw, 46px)", fontWeight: 900, letterSpacing: "-.03em", color: "#fff", margin: 0, lineHeight: 1.05 }}>
                Meet the <span style={{ color: OR }}>Frameless Crew</span>
              </h2>
              <p style={{ color: "rgba(255,255,255,.42)", marginTop: 12, fontSize: 14, maxWidth: 420, margin: "12px auto 0" }}>Para kreator di balik setiap frame yang tak terlupakan.</p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
              {activeTeam.map((member: any, idx: number) => {
                const socials = [
                  member.instagram && { icon: Instagram, label: "Instagram", url: member.instagram.startsWith("http") ? member.instagram : `https://instagram.com/${member.instagram.replace("@","")}` },
                  member.linkedin && { icon: Linkedin, label: "LinkedIn", url: member.linkedin.startsWith("http") ? member.linkedin : `https://linkedin.com/in/${member.linkedin}` },
                  member.twitter && { icon: Twitter, label: "Twitter/X", url: member.twitter.startsWith("http") ? member.twitter : `https://x.com/${member.twitter.replace("@","")}` },
                  member.website && { icon: Globe, label: "Website", url: member.website.startsWith("http") ? member.website : `https://${member.website}` },
                ].filter(Boolean) as any[];

                return (
                  <motion.div
                    key={member.id || idx}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                    whileHover={{ scale: 1.02, y: -4 }}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 16,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                      transition: "box-shadow .3s, border-color .3s",
                      width: "clamp(200px, 22vw, 240px)",
                      flexShrink: 0,
                    }}
                    className="crew-card"
                  >
                    {/* Glow effect */}
                    <div style={{ position: "absolute", inset: -1, background: `radial-gradient(circle at 50% 20%, ${OR}15, transparent 60%)`, pointerEvents: "none", zIndex: 0 }} />

                    <div style={{ position: "relative", zIndex: 1, width: 92, height: 92, borderRadius: "50%", overflow: "hidden", border: `2px solid ${OR}33`, marginBottom: 14, boxShadow: `0 0 0 6px ${OR}08` }}>
                      {member.avatarUrl ? (
                        <img src={member.avatarUrl} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", background: OR, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: "#fff" }}>
                          {member.name?.[0] || "F"}
                        </div>
                      )}
                    </div>

                    <div style={{ position: "relative", zIndex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: OR, fontWeight: 700, marginTop: 3, letterSpacing: ".05em" }}>{member.role || "Crew"}</div>
                      {member.department && <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)", marginTop: 2 }}>{member.department}</div>}

                      {socials.length > 0 && (
                        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
                          {socials.map((s: any, i: number) => {
                            const Icon = s.icon;
                            return (
                              <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" title={s.label} style={{ color: "rgba(255,255,255,.6)", transition: "color .2s, transform .2s" }}
                                onMouseEnter={e => (e.currentTarget.style.color = OR)} onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.6)")}>
                                <Icon size={16} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <a href="#crew" style={{ fontSize: 13, color: OR, textDecoration: "none", fontWeight: 600 }}>Scroll to crew section</a>
            </div>
          </div>
        </section>
      )}

      {/* ══════ CREW GALLERY — Behind the Scenes (3 baris masonry, lebar stabil via useMemo, lebih lambat & seamless) ══════ */}
      {/* Minimal 6 foto agar 3 baris masonry terisi cukup rata (tidak nempel pojok kiri seperti saat foto sedikit) */}
      {crewGalleryPhotos.length >= 6 && (() => {
        const ROW_HEIGHT = 168; // tinggi tetap per baris -- ini yang membuat grid rapi tanpa overlap

        return (
          <section id="crew-gallery" style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
            {/* Tidak ada cover/background lokal di section ini lagi -- sepenuhnya transparan,
                mengandalkan mesh gradient global yang fixed di belakang seluruh halaman.
                Ini yang menghilangkan "pojok kaku/hitam" karena sebelumnya section ini punya
                base layer solid sendiri yang berhenti tegas di tepi section. */}

            <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 32px 44px", textAlign: "center", position: "relative", zIndex: 2 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".22em", color: OR, textTransform: "uppercase", marginBottom: 10 }}>BEHIND THE SCENES</p>

              <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", lineHeight: 1.0, marginBottom: 10 }}>Crew Gallery</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,.38)", lineHeight: 1.65 }}>Momen di balik kamera dari setiap produksi yang kami kerjakan.</p>
            </div>

            {/* Konten dibatasi maxWidth supaya keseluruhan galeri lebih terpusat di tengah halaman */}
            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>
              {/* Feather mask kiri-kanan -- diperhalus dengan lebih banyak color-stop (6 titik, bukan 4)
                  supaya gradasinya benar-benar landai tanpa ada "tepi" yang terasa, dan opacity awal
                  diturunkan sedikit (dari solid 100% jadi mulai ~92%) supaya transisi masuknya juga lembut. */}
              <div style={{ position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", background: "linear-gradient(to right,#0a0a0c 0%,#0a0a0cee 25%,#0a0a0caa 50%,#0a0a0c55 75%,#0a0a0c1a 90%,transparent 100%)", zIndex: 30, pointerEvents: "none" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "30%", background: "linear-gradient(to left,#0a0a0c 0%,#0a0a0cee 25%,#0a0a0caa 50%,#0a0a0c55 75%,#0a0a0c1a 90%,transparent 100%)", zIndex: 30, pointerEvents: "none" }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {crewGalleryRows.map((rowPhotos, rowIdx) => {
                    if (rowPhotos.length === 0) return null;
                    // Baris tengah (index 1) berlawanan arah dari baris atas & bawah -- sesuai permintaan.
                    const reverse = rowIdx === 1;
                    // Durasi diperlambat signifikan (dari *4.5 jadi *8, minimum 36s bukan 22s) supaya
                    // pergerakannya terasa tenang/premium, bukan terburu-buru.
                    const duration = Math.max(36, rowPhotos.length * 8);

                    return (
                      <div key={rowIdx} style={{ overflow: "hidden", height: ROW_HEIGHT }}>
                        <div
                          className={`cg-row-track${reverse ? " cg-row-reverse" : ""}`}
                          style={{ display: "flex", alignItems: "center", gap: 14, width: "max-content", animationDuration: `${duration}s` }}
                        >
                          {/* Foto digandakan 2x supaya loop seamless. Lebar (p.w) sudah FIX dari useMemo,
                              tidak dihitung ulang di sini -- ini yang menghilangkan flicker. */}
                          {[...rowPhotos, ...rowPhotos].map((p, i) => (
                            <div
                              key={`${p.id}-${i}`}
                              className="cg-row-card"
                              style={{
                                flexShrink: 0,
                                width: p.w,
                                height: ROW_HEIGHT,
                                borderRadius: 14,
                                overflow: "hidden",
                                position: "relative",
                                background: "#101013",
                              }}
                            >
                              <img src={p.photoUrl} alt={p.productionTitle} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              <div style={{ position: "absolute", inset: 0, borderRadius: 14, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.08)", pointerEvents: "none" }} />
                              {/* Caption -- hover-only, tetap sesuai keputusan sebelumnya */}
                              <div className="cg-thumb-caption" style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.05) 60%,transparent 100%)", display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "10px 12px", opacity: 0 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productionTitle}</div>
                                {p.productionDate && <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.55)", marginTop: 1 }}>{formatIdDate(p.productionDate)}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ══════ FOOTER ══════ */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,.07)", background: "rgba(0,0,0,.45)", backdropFilter: "blur(24px)" }}>
        <div className="footer-grid pxs" style={{ maxWidth: 1280, margin: "0 auto", padding: "64px 28px 48px", display: "grid", gridTemplateColumns: "2.2fr 1fr 1fr 1.2fr", gap: 44 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              {logoUrl ? <img src={logoUrl} alt={brandName} style={{ height: 32, width: "auto", filter: "brightness(0) invert(1)" }} />
                : <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", letterSpacing: "-.01em" }}>{brandName}</div>}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.4)", lineHeight: 1.72, maxWidth: 280, marginBottom: 24 }}>Video production & media agency profesional berbasis di Wonosobo, Central Java. Mengubah ide menjadi visual sinematik yang tak terlupakan.</p>
            <div style={{ display: "flex", gap: 9 }}>
              {[{ icon: <Instagram size={14} />, href: "https://www.instagram.com/framelesscreative/", label: "IG" }, { icon: <Youtube size={14} />, href: "https://www.youtube.com/@framelesscreativeproject", label: "YT" }, { icon: <MessageCircle size={14} />, href: "https://wa.me/0859106723181?text=Halo%20Admin%20Frameless%20Creative!%20%F0%9F%91%8B%20Saya%20ingin%20menanyakan%20mengenai%20project%20video.%20Bisa%20dibantu%3F", label: "WA" }].map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" title={s.label} className="social-icon" style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.45)", textDecoration: "none" }}>
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
              {/* Google Maps embed */}
              <div style={{ marginTop: 6, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,.09)" }}>
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m28!1m12!1m3!1d1282.932926945778!2d109.9148975916254!3d-7.34204572618802!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!4m13!3e6!4m5!1s0xcfceb45b974374f%3A0xdca036b64eb9f09d!2sFrameless%20Creative%20Agency%2C%20Jl.%20Lurah%20Sudarto%2C%20Rw.%204%2C%20Jlamprang%2C%20Kec.%20Wonosobo%2C%20Kabupaten%20Wonosobo%2C%20Jawa%20Tengah%2056319!3m2!1d-7.3413482!2d109.9147435!4m5!1s0xcfceb45b974374f%3A0xdca036b64eb9f09d!2sFrameless%20Creative%20Agency%2C%20Jl.%20Lurah%20Sudarto%2C%20Rw.%204%2C%20Jlamprang%2C%20Kec.%20Wonosobo%2C%20Kabupaten%20Wonosobo%2C%20Jawa%20Tengah%2056319!3m2!1d-7.3413482!2d109.9147435!5e0!3m2!1sid!2sid!4v1779628893899!5m2!1sid!2sid"
                  width="100%"
                  height="160"
                  style={{ border: 0, display: "block" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
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
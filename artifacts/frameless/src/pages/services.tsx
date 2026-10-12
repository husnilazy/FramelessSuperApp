// artifacts/frameless/src/pages/services.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MessageCircle, Mail, X, Play, ArrowRight, ChevronRight, Sparkles, Loader2, Check, Clock, Award, Target, Zap, Gem } from "lucide-react";
import { ServiceIcon } from "@/lib/service-icons";
import { AiEstimationForm } from "@/components/AiEstimationForm";

import { MotionLayer } from "@/lib/landing-motion";
const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{overflow-x:hidden;}

/* Animations for subtle background blobs */
@keyframes b1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(90px,-70px) scale(1.18);}66%{transform:translate(-50px,90px) scale(0.9);}}
@keyframes b2{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-100px,70px) scale(0.85);}66%{transform:translate(70px,-100px) scale(1.22);}}
@keyframes b3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(60px,80px) scale(1.12);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}

.svc-item{transition:border-color .3s,transform .35s cubic-bezier(.16,1,.3,1),background .3s;}
.svc-item:hover{transform:translateY(-3px);}
.svc-item .svc-title{transition:color .2s;}
.svc-item:hover .svc-title{color:#FF6A20;}
.svc-cta{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s,background .2s;}
.svc-cta:hover{transform:translateY(-1px);box-shadow:0 10px 26px rgba(255,106,32,.32);}
.svc-cta:active{transform:scale(.96);}
.svc-grid{grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr)) !important;}
.clamp3{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}

/* Responsive adjustments */
@media(max-width:1024px){
  .pxs{padding-left:24px!important;padding-right:24px!important;}
}
@media(max-width:700px){
  .svc-grid{grid-template-columns:1fr!important;}
}
@media(max-width:768px){
  .pxs{padding-left:20px!important;padding-right:20px!important;}
  .svc-item{padding:22px!important;}
  .svc-grid{gap:16px!important;}
}
@media(max-width:540px){
  .svc-item{padding:18px!important;}
}
`;

interface CmsData { [s: string]: { [k: string]: string } }
interface SiteVideo { id: string; title: string; description: string; embedUrl: string; thumbnailUrl: string; category: string; isActive: boolean; }
interface ServiceItem { icon: string; title: string; description: string; tags: string[]; slug: string; price?: string; features?: string[]; duration?: string; highlightVideoUrl?: string; }

function ytId(u?: string) { return u?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))([ \w-]{11})/)?.[1] ?? null; }
function watchUrl(u: string) { const id = ytId(u); return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : u; }
function getThumb(u: string, c?: string) { if (c) return c; const id = ytId(u); return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ""; }
function isDirectVideo(u?: string) { return !!u && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(u); }

const DEFAULTS: ServiceItem[] = [
    {
        icon: "🎬", title: "Commercial Video", slug: "commercial-video", price: "Rp 5.000.000+", duration: "3-14 hari",
        description: "Iklan TV, digital ads, dan brand video yang membangun awareness dan konversi tinggi.",
        tags: ["TVC", "Digital Ads", "Brand"],
        features: ["Konsultasi konsep gratis", "Tim produksi lengkap", "Color grading profesional", "Revisi 3x", "File master + sosmed-ready"]
    },
    {
        icon: "🎵", title: "Music Video", slug: "music-video", price: "Rp 8.000.000+", duration: "5-21 hari",
        description: "Visual musik yang berani dan memorable untuk artis lokal dan nasional.",
        tags: ["Concept", "Production", "Grading"],
        features: ["Concept development", "Storyboard & moodboard", "Multi-lokasi shooting", "VFX & color grading", "4K master"]
    },
    {
        icon: "🎞️", title: "Short Film", slug: "short-film", price: "Rp 15.000.000+", duration: "14-45 hari",
        description: "Film pendek naratif dengan sinematografi profesional dan nilai artistik tinggi.",
        tags: ["Script", "Directing", "Post"],
        features: ["Script development", "Casting & art direction", "Sound design", "Festival-ready format", "Distribution support"]
    },
    {
        icon: "📽️", title: "Documentary", slug: "documentary", price: "Rp 10.000.000+", duration: "14-60 hari",
        description: "Dokumenter kisah nyata dengan pendekatan sinematik yang mendalam dan autentik.",
        tags: ["Research", "Interview", "Narasi"],
        features: ["Research mendalam", "Multi-narasumber", "B-roll sinematik", "Voice over pro", "Subtitling"]
    },
    {
        icon: "💍", title: "Wedding Cinema", slug: "wedding-cinema", price: "Rp 7.500.000+", duration: "7-21 hari",
        description: "Cinematic wedding film yang mengabadikan setiap momen spesial hari terbaikmu.",
        tags: ["Pre-wedding", "Ceremony", "Reception"],
        features: ["Pre-wedding session", "Full day coverage", "2-3 kameraman", "Highlight 3-5 min", "Full length SDE"]
    },
    {
        icon: "📱", title: "Social Media Content", slug: "social-media", price: "Rp 2.500.000+", duration: "1-5 hari",
        description: "Konten video viral-ready untuk Instagram Reels, TikTok, dan YouTube Shorts.",
        tags: ["Reels", "TikTok", "YouTube"],
        features: ["Concept & scripting", "Vertical format 9:16", "Text animasi", "Music licensed", "Paket bulanan"]
    },
    {
        icon: "🏢", title: "Corporate Video", slug: "corporate-video", price: "Rp 6.000.000+", duration: "5-14 hari",
        description: "Video profil perusahaan, training, dan komunikasi internal yang profesional.",
        tags: ["Profile", "Training", "Annual Report"],
        features: ["Interview eksekutif", "Footage operasional", "Infografis & animasi", "Dubbing & sub", "Multi-bahasa"]
    },
    {
        icon: "🎪", title: "Event Coverage", slug: "event-coverage", price: "Rp 4.000.000+", duration: "1-7 hari",
        description: "Dokumentasi event, konser, pameran, dan aktivasi brand dengan multi-kamera.",
        tags: ["Multi-cam", "Highlight", "Livestream"],
        features: ["Multi-kamera setup", "Same-day edit", "Highlight 2-5 min", "Full documentation", "Livestream tersedia"]
    },
];

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
    return (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.98)", backdropFilter: "blur(28px)" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><X size={18} /></button>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw,960px)", aspectRatio: "16/9", background: "#000", borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,.5)" }}>
                <iframe src={watchUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 14, border: "none" }} allow="autoplay;fullscreen" allowFullScreen />
            </div>
        </div>
    );
}

export default function ServicesPage() {
    const { toast } = useToast();
    const [modal, setModal] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [aiFormOpen, setAiFormOpen] = useState(false); // New state for AI form
    const [selService, setSelService] = useState<ServiceItem | null>(null);
    const [form, setForm] = useState({ 
      name: "", 
      email: "", 
      phone: "", 
      company: "",
      message: "",
      budget: "",
      timeline: "",
      preferred: "WA"
    });
    const [submitting, setSubmitting] = useState(false);

    const { data: cms } = useQuery<CmsData>({ queryKey: ["public", "/api/cms"], refetchOnMount: "always", queryFn: () => fetch("/api/cms").then(r => r.json()), staleTime: 60_000 });

    const cmsServices = (() => { try { return JSON.parse(cms?.services?.items || "[]") as ServiceItem[]; } catch { return []; } })();
    const services = cmsServices.length > 0 ? cmsServices : DEFAULTS;

    const cont = cms?.contact || {};
    const brand = cms?.branding || {};
    const wa = cont.whatsapp ? `https://wa.me/${cont.whatsapp.replace(/\D/g, "")}#text=Halo, saya tertarik dengan layanan ${selService?.title || ""}` :
        "#";

    function openInquiry(svc: ServiceItem) {
        setSelService(svc);
        setForm({ name: "", email: "", phone: "", company: "", message: `Halo, saya tertarik dengan layanan ${svc.title}.`, budget: "", timeline: "", preferred: "WA" });
        setFormOpen(true);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name || !form.email) return;
        setSubmitting(true);
        try {
            await fetch("/api/cms/inquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, service: selService?.title }) });
            toast({ title: "Pesan terkirim!", description: "Tim kami akan menghubungi kamu segera." });
            setFormOpen(false);
            setForm({ name: "", email: "", phone: "", company: "", message: "", budget: "", timeline: "", preferred: "WA" });
        } catch {
            toast({ variant: "destructive", title: "Gagal kirim", description: "Coba hubungi langsung via WhatsApp." });
        } finally { setSubmitting(false); }
    }

    const ipt = { width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, boxSizing: "border-box" as any };

    return (
        <div style={{ background: "#0a0a0c", color: "#f0f0f0", fontFamily: FONT, minHeight: "100vh", overflowX: "hidden" }}>
            <style>{CSS}</style>
            <MotionLayer />

            {/* BG */}
            <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
                <div style={{ position: "absolute", width: "70%", height: "60%", top: "-12%", left: "-10%", background: `radial-gradient(ellipse at center,${OR}10 0%,transparent 70%)`, filter: "blur(90px)", animation: "b1 20s ease-in-out infinite" }} />
                <div style={{ position: "absolute", width: "65%", height: "55%", top: "20%", right: "-15%", background: "radial-gradient(ellipse at center,rgba(255,255,255,.06) 0%,transparent 72%)", filter: "blur(100px)", animation: "b2 22s ease-in-out infinite reverse" }} />
                <div style={{ position: "absolute", width: "60%", height: "55%", bottom: "-10%", left: "10%", background: "radial-gradient(ellipse at center,rgba(255,255,255,.04) 0%,transparent 74%)", filter: "blur(100px)", animation: "b3 24s ease-in-out infinite" }} />
                <div style={{ position: "absolute", width: "50%", height: "45%", bottom: "20%", right: "5%", background: `radial-gradient(ellipse at center,${OR}08 0%,transparent 70%)`, filter: "blur(90px)", animation: "b1 18s ease-in-out infinite reverse" }} />
            </div>

            {/* NAV */}
            <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 62, background: "rgba(10,10,12,.75)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", height: "100%", padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <a href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
                        {brand.logoUrl
                            ? <img src={brand.logoUrl} alt={brand.name || "Frameless Creative"} style={{ height: 28, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                            : <>
                                <div style={{ width: 30, height: 30, borderRadius: 9, background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>F</span></div>
                                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff", letterSpacing: "-.01em" }}>{brand.name || "Frameless Creative"}</span>
                              </>
                        }
                    </a>
                    <div style={{ display: "flex", gap: 8 }}>
                        <a href="/#portfolio" style={{ fontSize: 13, color: "rgba(255,255,255,.5)", textDecoration: "none", fontWeight: 600, padding: "6px 14px" }}>Portfolio</a>
                        <a href="/#courses" style={{ fontSize: 13, color: "rgba(255,255,255,.5)", textDecoration: "none", fontWeight: 600, padding: "6px 14px" }}>Academy</a>
                        <a href="/#contact" style={{ padding: "8px 18px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>Konsultasi</a>
                    </div>
                </div>
            </nav>

            {/* HERO */}
            <section style={{ paddingTop: 62, position: "relative", zIndex: 1, minHeight: "calc(100vh - 62px)", display: "flex", alignItems: "center" }}>
                <div className="pxs" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 70px", textAlign: "center", width: "100%" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", borderRadius: 100, background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 24 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s ease infinite" }} />
                        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.55)", letterSpacing: ".1em", textTransform: "uppercase" }}>Layanan Frameless Creative</span>
                    </div>
                    <h1 style={{ fontSize: "clamp(40px,7vw,82px)", fontWeight: 900, letterSpacing: "-.045em", color: "#fff", margin: "0 0 20px", lineHeight: 1.0 }}>
                        Kami Wujudkan<br /><span style={{ color: OR }}>Visi Kamu.</span>
                    </h1>
                    <p style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "rgba(255,255,255,.46)", lineHeight: 1.74, maxWidth: 540, margin: "0 auto 36px" }}>
                        Dari commercial TV hingga reels sosial media — kami punya solusi visual untuk setiap kebutuhan komunikasimu.
                    </p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <a href="#service-list" style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 26px", borderRadius: 100, background: OR, color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>Lihat Semua Layanan <ChevronRight size={14} /></a>
                        <a href="/#contact" style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 24px", borderRadius: 100, border: "1px solid rgba(255,255,255,.16)", color: "rgba(255,255,255,.75)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>Konsultasi Gratis</a>
                        <button onClick={() => setAiFormOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 100, border: "1px solid rgba(255,255,255,.08)", color: "#fff", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 700 }}>
                            <Sparkles size={14} /> Coba Estimasi AI
                        </button>
                    </div>
                </div>
            </section>

            {/* SERVICE LIST */}
            <section id="service-list" className="pxs" style={{ padding: "60px 28px 100px", position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 1280, margin: "0 auto" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14, textAlign: "center" }}>WHAT WE DO</p>
                    <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", marginBottom: 56, textAlign: "center", lineHeight: 1.0 }}>
                        Semua Layanan<br /><span style={{ color: "rgba(255,255,255,.3)" }}>dalam Satu Atap</span>
                    </h2>

                    <div className="svc-grid" style={{ display: "grid", gap: 20, alignItems: "stretch" }}>
                        {services.map((s, i) => {
                            const features = s.features || [];
                            const tags = s.tags || [];
                            const hv = s.highlightVideoUrl;
                            const yt = hv && !isDirectVideo(hv) ? ytId(hv) : null;
                            const thumb = hv && !isDirectVideo(hv) ? getThumb(hv) : "";
                            return (
                                <article key={s.slug || i} id={s.slug} className="svc-item" style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 24, padding: 24, scrollMarginTop: 80, display: "flex", flexDirection: "column", minWidth: 0 }}>
                                    {/* Header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                                        <ServiceIcon title={s.title} slug={s.slug} size={46} accent={OR} />
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <h3 className="svc-title" style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-.02em", lineHeight: 1.25, margin: 0 }}>{s.title}</h3>
                                            {s.duration && (
                                                <p style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "rgba(255,255,255,.42)", margin: "5px 0 0", fontWeight: 600 }}>
                                                    <Clock size={12} /> {s.duration}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <p className="clamp3" style={{ fontSize: 13.5, color: "rgba(255,255,255,.52)", lineHeight: 1.68, margin: "0 0 16px" }}>{s.description}</p>

                                    {/* Tags */}
                                    {tags.length > 0 && (
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                                            {tags.slice(0, 4).map(t => <span key={t} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.55)", fontWeight: 600 }}>{t}</span>)}
                                            {tags.length > 4 && <span style={{ fontSize: 11, padding: "3px 8px", color: "rgba(255,255,255,.35)", fontWeight: 600 }}>+{tags.length - 4}</span>}
                                        </div>
                                    )}

                                    {/* Video highlight (hanya jika ada) */}
                                    {hv && (
                                        <div onClick={() => setModal(hv)} style={{ borderRadius: 16, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", background: "#000", position: "relative", marginBottom: 18 }}>
                                            {isDirectVideo(hv)
                                                ? <video src={hv} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                                : yt
                                                    ? <iframe src={`https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&controls=0&rel=0`} title={s.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }} allow="autoplay;encrypted-media" />
                                                    : thumb && <img src={thumb} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt={s.title} />}
                                            <span style={{ position: "absolute", right: 12, bottom: 12, width: 36, height: 36, borderRadius: "50%", background: "rgba(10,10,12,.62)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                                                <Play size={13} style={{ fill: "#fff", marginLeft: 1 }} />
                                            </span>
                                        </div>
                                    )}

                                    {/* Fitur */}
                                    {features.length > 0 && (
                                        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 9, margin: "0 0 20px", padding: 0 }}>
                                            {features.slice(0, 5).map(f => (
                                                <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13, color: "rgba(255,255,255,.62)", lineHeight: 1.45 }}>
                                                    <Check size={14} color={OR} strokeWidth={2.4} style={{ flexShrink: 0, marginTop: 2 }} />{f}
                                                </li>
                                            ))}
                                            {features.length > 5 && (
                                                <li style={{ fontSize: 12, color: "rgba(255,255,255,.35)", paddingLeft: 23 }}>+{features.length - 5} fasilitas lainnya</li>
                                            )}
                                        </ul>
                                    )}

                                    {/* Harga + CTA: selalu menempel di dasar kartu */}
                                    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: "auto", paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                                        <div style={{ minWidth: 0 }}>
                                            {s.price ? (
                                                <>
                                                    <p style={{ fontSize: 10, color: "rgba(255,255,255,.34)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>Mulai dari</p>
                                                    <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-.02em", whiteSpace: "nowrap" }}>{s.price.replace(/\+$/, "")}</p>
                                                </>
                                            ) : (
                                                <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", margin: 0, fontWeight: 600 }}>Harga sesuai brief</p>
                                            )}
                                        </div>
                                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                            {s.slug && (
                                                <a href={`/services/${encodeURIComponent(s.slug)}`} aria-label={`Detail ${s.title}`} className="outline-btn"
                                                    style={{ height: 40, padding: "0 14px", borderRadius: 100, border: "1px solid rgba(255,255,255,.14)", color: "rgba(255,255,255,.75)", textDecoration: "none", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}>
                                                    Detail
                                                </a>
                                            )}
                                            <button onClick={() => openInquiry(s)} className="svc-cta"
                                                style={{ height: 40, display: "inline-flex", alignItems: "center", gap: 8, padding: "0 18px", borderRadius: 100, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, whiteSpace: "nowrap" }}>
                                                Konsultasi <ArrowRight size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* WHY US */}
            <section className="pxs" style={{ padding: "80px 28px", background: "rgba(255,255,255,.01)", borderTop: "1px solid rgba(255,255,255,.05)", borderBottom: "1px solid rgba(255,255,255,.05)", position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>WHY FRAMELESS</p>
                    <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", marginBottom: 48, lineHeight: 1.0 }}>Kenapa Pilih<span style={{ color: OR }}> Frameless?</span></h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20, maxWidth: 960, margin: "0 auto" }}>
                        {[
                            { Icon: Award, title: "Berpengalaman", desc: "8+ tahun di industri dengan 200+ proyek sukses dari berbagai kategori." },
                            { Icon: Target, title: "Tepat Sasaran", desc: "Kami pahami goals bisnismu dan pastikan setiap frame punya tujuan." },
                            { Icon: Zap, title: "Turnaround Cepat", desc: "Jadwal produksi transparan dan delivery tepat waktu sesuai kontrak." },
                            { Icon: Gem, title: "Kualitas Premium", desc: "Equipment profesional, crew terlatih, dan standar produksi tertinggi." },
                        ].map(w => (
                            <div key={w.title} style={{ padding: "28px 24px", borderRadius: 22, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", textAlign: "left" }}>
                                <span style={{ width: 46, height: 46, borderRadius: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16, background: `${OR}14`, color: OR, boxShadow: `inset 0 0 0 1px ${OR}26` }}><w.Icon size={21} strokeWidth={1.6} /></span>
                                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{w.title}</h3>
                                <p style={{ fontSize: 13, color: "rgba(255,255,255,.43)", lineHeight: 1.65 }}>{w.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="pxs" style={{ padding: "80px 28px", position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: "56px 44px", borderRadius: 32, background: `linear-gradient(135deg,${OR}18,rgba(124,58,237,.14))`, border: `1px solid ${OR}33`, boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
                    <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, color: "#fff", letterSpacing: "-.03em", marginBottom: 14 }}>Siap Mulai Proyek?</h2>
                    <p style={{ color: "rgba(255,255,255,.45)", fontSize: 15, lineHeight: 1.65, marginBottom: 32, maxWidth: 440, margin: "0 auto 32px" }}>Konsultasi gratis, tanpa komitmen. Tim kami siap diskusi dan buat proposal sesuai kebutuhanmu.</p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        <a href={`https://wa.me/62859106723181?text=${encodeURIComponent("Halo Frameless, saya ingin konsultasi gratis tentang project video. Bisa bantu?")}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 28px", borderRadius: 20, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 15, fontWeight: 800, boxShadow: "0 12px 30px rgba(37,211,102,.12)" }}><MessageCircle size={18} /> Konsultasi Gratis (WA)</a>
                        {cont.email && <a href={`mailto:${cont.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 22px", borderRadius: 20, border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.9)", textDecoration: "none", fontSize: 14, fontWeight: 700, background: "rgba(255,255,255,.02)" }}><Mail size={15} /> Email Kami</a>}
                    </div>
                </div>
            </section>

            {/* Inquiry Modal */}
            {formOpen && (
                <div onClick={e => { if (e.target === e.currentTarget) { setFormOpen(false); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.12)", borderRadius: 28, padding: "36px 32px", width: "100%", maxWidth: 460, position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,.4)" }}>
                        <button onClick={() => setFormOpen(false)} style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.07)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Kirim Inquiry</h3>
                        {selService && <p style={{ fontSize: 13, color: OR, marginBottom: 20, fontWeight: 600 }}>{selService.title}</p>}
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {[
                              { k: "name", l: "Nama Lengkap *", ph: "Nama kamu" }, 
                              { k: "email", l: "Email *", t: "email", ph: "email@kamu.com" }, 
                              { k: "phone", l: "No. WhatsApp *", t: "tel", ph: "+62 8xx-xxxx-xxxx" },
                              { k: "company", l: "Perusahaan / Brand", ph: "Nama perusahaan kamu" }
                            ].map((f: any) => (
                                <div key={f.k}>
                                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>{f.l}</label>
                                    <input type={f.t || "text"} value={(form as any)[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.ph} required={f.l.includes("*")} style={{ ...ipt }} />
                                </div>
                            ))}
                            
                            <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Estimasi Budget</label>
                                <select value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} style={{ ...ipt, cursor: "pointer" }}>
                                    <option value="">Pilih range</option>
                                    <option value="< 5jt">&lt; Rp 5 Juta</option>
                                    <option value="5-15jt">Rp 5 - 15 Juta</option>
                                    <option value="15-50jt">Rp 15 - 50 Juta</option>
                                    <option value="50jt+">Rp 50 Juta+</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Timeline / Deadline</label>
                                <select value={form.timeline} onChange={e => setForm(p => ({ ...p, timeline: e.target.value }))} style={{ ...ipt, cursor: "pointer" }}>
                                    <option value="">Pilih timeline</option>
                                    <option value="ASAP (1 bulan)">ASAP (dalam 1 bulan)</option>
                                    <option value="2-3 bulan">2-3 bulan</option>
                                    <option value="4+ bulan">4+ bulan</option>
                                    <option value="Flexible">Flexible</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Preferensi Kontak</label>
                                <select value={form.preferred} onChange={e => setForm(p => ({ ...p, preferred: e.target.value }))} style={{ ...ipt, cursor: "pointer" }}>
                                    <option value="WA">WhatsApp</option>
                                    <option value="Email">Email</option>
                                    <option value="Call">Telepon</option>
                                </select>
                            </div>
                            
                            <div>
                                <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Deskripsi Project / Pesan *</label>
                                <textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Ceritakan singkat project kamu, tujuan, target audience, dll..." style={{ ...ipt, resize: "vertical" }} required />
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                                {cont.whatsapp && (
                                    <a href={wa} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "12px", borderRadius: 12, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}><MessageCircle size={14} /> WhatsApp</a>
                                )}
                                <button type="submit" disabled={submitting || !form.name || !form.email || !form.message} style={{ flex: 1, padding: "12px", borderRadius: 12, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: submitting ? 0.7 : 1 }}>{submitting ? "Mengirim..." : "Kirim Inquiry"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modal && <VideoModal url={modal} onClose={() => setModal(null)} />}
            {aiFormOpen && <AiEstimationForm
                initialPrompt={`Layanan: ${selService?.title || ''}
Deskripsi: ${selService?.description || ''}
Estimasi harga saat ini: ${selService?.price || ''}
Durasi tipikal: ${selService?.duration || ''}

Tolong berikan estimasi biaya (dalam Rupiah), durasi (dalam hari/minggu), dan saran gaya produksi dalam poin-poin singkat.`}
                onClose={() => setAiFormOpen(false)}
            />}
        </div>
    );
}
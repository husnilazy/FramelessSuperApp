// artifacts/frameless/src/pages/services.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, MessageCircle, Mail, X, Play, ArrowRight, ChevronRight } from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes b1{0%,100%{transform:translate(0,0);}50%{transform:translate(60px,-40px);}}
.svc-item{transition:border-color .25s,background .25s,transform .25s;}
.svc-item:hover{border-color:#FF6A2055!important;transform:translateY(-2px);}
@media(max-width:768px){
  .svc-grid{grid-template-columns:1fr!important;}
  .pxs{padding-left:20px!important;padding-right:20px!important;}
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
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.95)", backdropFilter: "blur(20px)" }}>
            <button onClick={onClose} style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><X size={18} /></button>
            <div onClick={e => e.stopPropagation()} style={{ width: "min(92vw,960px)", aspectRatio: "16/9" }}>
                <iframe src={watchUrl(url)} style={{ width: "100%", height: "100%", borderRadius: 14, border: "none" }} allow="autoplay;fullscreen" allowFullScreen />
            </div>
        </div>
    );
}

export default function ServicesPage() {
    const { toast } = useToast();
    const [modal, setModal] = useState<string | null>(null);
    const [formOpen, setFormOpen] = useState(false);
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

    const { data: cms } = useQuery<CmsData>({ queryKey: ["/api/cms"], queryFn: () => fetch("/api/cms").then(r => r.json()), staleTime: 60_000 });

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

            {/* BG */}
            <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
                <div style={{ position: "absolute", width: "70%", height: "70%", top: "-20%", left: "-15%", background: `radial-gradient(ellipse at center,${OR}45 0%,transparent 65%)`, filter: "blur(80px)", animation: "b1 20s ease-in-out infinite" }} />
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
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
            <section style={{ paddingTop: 62, position: "relative", zIndex: 1 }}>
                <div className="pxs" style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 70px", textAlign: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 16px", borderRadius: 100, background: "rgba(255,255,255,.055)", border: "1px solid rgba(255,255,255,.1)", marginBottom: 24 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} />
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

                    <div className="svc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 20 }}>
                        {services.map((s, i) => {
                            return (
                                <div key={s.slug || i} id={s.slug} className="svc-item" style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 24, padding: "28px 26px", scrollMarginTop: 80, display: "flex", flexDirection: "column", gap: 0 }}>
                                    {/* Header */}
                                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
                                        <div style={{ width: 50, height: 50, borderRadius: 15, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{s.icon}</div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ fontSize: 19, fontWeight: 800, color: "#fff", margin: "0 0 5px", letterSpacing: "-.02em" }}>{s.title}</h3>
                                            <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.65, margin: 0 }}>{s.description}</p>
                                        </div>
                                    </div>

                                    {/* Tags + duration */}
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                                        {(s.tags || []).map(t => <span key={t} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,.07)", color: "rgba(255,255,255,.45)", fontWeight: 600 }}>{t}</span>)}
                                        {s.duration && <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 100, background: `${OR}18`, color: OR, fontWeight: 700, border: `1px solid ${OR}33` }}>⏱ {s.duration}</span>}
                                    </div>

                                    {/* Features grid */}
                                    {s.features && s.features.length > 0 && (
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
                                            {s.features.map(f => (
                                                <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
                                                    <CheckCircle2 size={11} color={OR} style={{ flexShrink: 0, marginTop: 1 }} />{f}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Video highlight: prioritaskan field highlightVideoUrl dari CMS, fallback ke video portfolio matching */}
                                    {(() => {
                                        const hv = s.highlightVideoUrl;
                                        if (hv && isDirectVideo(hv)) {
                                            // File video langsung (mp4/webm) — autoplay muted loop, tanpa controls/branding
                                            return (
                                                <div onClick={() => setModal(hv)} style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", background: "#000", position: "relative", marginBottom: 18 }}>
                                                    <video src={hv} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                                    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.15)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity .2s" }}
                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "1"}
                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "0"}>
                                                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={16} style={{ fill: "#fff", color: "#fff", marginLeft: 2 }} /></div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (hv) {
                                            // YouTube/Vimeo link — autoplay muted via embed (klik untuk buka modal full dengan suara)
                                            const ytAutoplay = ytId(hv) ? `https://www.youtube.com/embed/${ytId(hv)}?autoplay=1&mute=1&loop=1&playlist=${ytId(hv)}&controls=0&rel=0` : "";
                                            return (
                                                <div onClick={() => setModal(hv)} style={{ borderRadius: 14, overflow: "hidden", cursor: "pointer", aspectRatio: "16/9", background: "#000", position: "relative", marginBottom: 18 }}>
                                                    {ytAutoplay
                                                        ? <iframe src={ytAutoplay} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none", pointerEvents: "none" }} allow="autoplay;encrypted-media" />
                                                        : getThumb(hv) && <img src={getThumb(hv)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} alt={s.title} />
                                                    }
                                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${OR}cc`, display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={16} style={{ fill: "#fff", color: "#fff", marginLeft: 2 }} /></div>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        // Belum ada video highlight di CMS — tampilkan placeholder jelas, JANGAN tebak-tebak dari portfolio
                                        return (
                                            <div style={{ borderRadius: 14, overflow: "hidden", aspectRatio: "16/9", background: "rgba(255,255,255,.025)", border: "1px dashed rgba(255,255,255,.12)", position: "relative", marginBottom: 18, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                                                <Play size={22} color="rgba(255,255,255,.18)" />
                                                <p style={{ fontSize: 11, color: "rgba(255,255,255,.28)", textAlign: "center", margin: 0, padding: "0 20px" }}>Belum ada video highlight<br />Upload di CMS → Layanan</p>
                                            </div>
                                        );
                                    })()}

                                    {/* Price + CTA */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)" }}>
                                        {s.price && (
                                            <div>
                                                <p style={{ fontSize: 9, color: "rgba(255,255,255,.3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".1em" }}>Estimasi harga</p>
                                                <p style={{ fontSize: 17, fontWeight: 800, color: OR, margin: 0 }}>{s.price}</p>
                                            </div>
                                        )}
                                        <button onClick={() => openInquiry(s)}
                                            style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", borderRadius: 100, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, marginLeft: "auto" }}>
                                            Hubungi Kami <ArrowRight size={13} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* WHY US */}
            <section className="pxs" style={{ padding: "80px 28px", background: "rgba(255,255,255,.015)", borderTop: "1px solid rgba(255,255,255,.05)", borderBottom: "1px solid rgba(255,255,255,.05)", position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 1280, margin: "0 auto", textAlign: "center" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".24em", color: OR, textTransform: "uppercase", marginBottom: 14 }}>WHY FRAMELESS</p>
                    <h2 style={{ fontSize: "clamp(28px,4vw,46px)", fontWeight: 900, letterSpacing: "-.04em", color: "#fff", marginBottom: 48, lineHeight: 1.0 }}>Kenapa Pilih<span style={{ color: OR }}> Frameless?</span></h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 20, maxWidth: 960, margin: "0 auto" }}>
                        {[
                            { icon: "🏆", title: "Berpengalaman", desc: "8+ tahun di industri dengan 200+ proyek sukses dari berbagai kategori." },
                            { icon: "🎯", title: "Tepat Sasaran", desc: "Kami pahami goals bisnismu dan pastikan setiap frame punya tujuan." },
                            { icon: "⚡", title: "Turnaround Cepat", desc: "Jadwal produksi transparan dan delivery tepat waktu sesuai kontrak." },
                            { icon: "💎", title: "Kualitas Premium", desc: "Equipment profesional, crew terlatih, dan standar produksi tertinggi." },
                        ].map(w => (
                            <div key={w.title} style={{ padding: "24px 22px", borderRadius: 20, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)" }}>
                                <div style={{ fontSize: 32, marginBottom: 14 }}>{w.icon}</div>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{w.title}</h3>
                                <p style={{ fontSize: 12, color: "rgba(255,255,255,.43)", lineHeight: 1.65 }}>{w.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="pxs" style={{ padding: "80px 28px", position: "relative", zIndex: 1 }}>
                <div style={{ maxWidth: 760, margin: "0 auto", textAlign: "center", padding: "52px 40px", borderRadius: 28, background: `linear-gradient(135deg,${OR}14,rgba(124,58,237,.1))`, border: `1px solid ${OR}28` }}>
                    <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 900, color: "#fff", letterSpacing: "-.03em", marginBottom: 14 }}>Siap Mulai Proyek?</h2>
                    <p style={{ color: "rgba(255,255,255,.45)", fontSize: 15, lineHeight: 1.65, marginBottom: 32, maxWidth: 440, margin: "0 auto 32px" }}>Konsultasi gratis, tanpa komitmen. Tim kami siap diskusi dan buat proposal sesuai kebutuhanmu.</p>
                    <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                        {cont.whatsapp && <a href={`https://wa.me/${cont.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 100, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}><MessageCircle size={16} /> Chat WhatsApp</a>}
                        {cont.email && <a href={`mailto:${cont.email}`} style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 24px", borderRadius: 100, border: "1px solid rgba(255,255,255,.15)", color: "rgba(255,255,255,.75)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}><Mail size={15} /> Email Kami</a>}
                    </div>
                </div>
            </section>

            {/* Inquiry Modal */}
            {formOpen && (
                <div onClick={e => { if (e.target === e.currentTarget) { setFormOpen(false); } }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, padding: "36px 32px", width: "100%", maxWidth: 440, position: "relative" }}>
                        <button onClick={() => setFormOpen(false)} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
                        <h3 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Kirim Inquiry</h3>
                        {selService && <p style={{ fontSize: 13, color: OR, marginBottom: 20, fontWeight: 600 }}>{selService.icon} {selService.title}</p>}
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
        </div>
    );
}
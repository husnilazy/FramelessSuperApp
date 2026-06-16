// artifacts/frameless/src/pages/service-detail.tsx
// Dynamic service detail page — /services/:slug
// Portfolio thumbnails pulled from site_videos by category matching slug
import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, X, CheckCircle2, MessageCircle,
  Mail, ChevronRight, Clock, ArrowRight, Star,
  ExternalLink, ImageIcon, Film,
} from "lucide-react";

interface CmsData { [s:string]:{[k:string]:string} }
interface SiteVideo { id:string;title:string;description:string;embedUrl:string;thumbnailUrl:string;category:string;tags:string;isActive:boolean;orderIndex:number; }
interface ServiceItem { icon:string;title:string;description:string;tags:string[];slug:string;price?:string;features?:string[];duration?:string;longDescription?:string;portfolioCategory?:string;highlightVideoUrl?:string; }

const OR   = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
@keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes b1{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(60px,-40px) scale(1.1);}}
@keyframes b2{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(-50px,60px) scale(0.95);}}
@keyframes spin{to{transform:rotate(360deg);}}
.fu{opacity:0;animation:fadeUp .6s ease forwards;}
.d1{animation-delay:.1s;}.d2{animation-delay:.22s;}.d3{animation-delay:.36s;}
.pf-thumb{transition:transform .4s,box-shadow .3s;cursor:pointer;}
.pf-thumb:hover{transform:translateY(-4px) scale(1.02);box-shadow:0 20px 60px rgba(0,0,0,.5)!important;}
.pf-thumb .ov{opacity:0;transition:opacity .25s;}
.pf-thumb:hover .ov{opacity:1;}
.pf-thumb img{transition:transform .5s;}
.pf-thumb:hover img{transform:scale(1.06);}
.feat-item{transition:background .2s,border-color .2s;}
.feat-item:hover{background:rgba(255,106,32,.04)!important;border-color:rgba(255,106,32,.25)!important;}
@media(max-width:860px){
  .hero-grid{grid-template-columns:1fr!important;}
  .pf-grid{grid-template-columns:repeat(2,1fr)!important;}
  .pxs{padding-left:20px!important;padding-right:20px!important;}
  .cta-row{flex-direction:column!important;align-items:stretch!important;}
}
@media(max-width:500px){
  .pf-grid{grid-template-columns:1fr!important;}
}
`;

const DEFAULT_SERVICES: ServiceItem[] = [
  {icon:"🎬",slug:"commercial-video",title:"Commercial Video",price:"Rp 5.000.000+",duration:"3–14 hari",
   description:"Iklan TV, digital ads, dan brand video yang membangun awareness dan konversi tinggi.",
   longDescription:"Kami menghadirkan commercial video yang tidak hanya indah secara visual, tapi juga efektif secara bisnis. Dari konsep hingga delivery, tim Frameless Creative memastikan setiap frame bercerita dan mendorong audiens untuk take action.\n\nKami telah mengerjakan ratusan project commercial untuk brand lokal maupun nasional, dengan track record yang terbukti meningkatkan awareness dan konversi.",
   tags:["TVC","Digital Ads","Brand Story"],portfolioCategory:"commercial",
   features:["Konsultasi konsep & brief gratis","Storyboard & moodboard profesional","Tim produksi lengkap (sutradara, DP, lighting, audio)","Color grading & sound design premium","Revisi hingga 3 putaran","Master file 4K + format sosmed-ready","Deadline terstruktur & transparan"]},
  {icon:"🎵",slug:"music-video",title:"Music Video",price:"Rp 8.000.000+",duration:"5–21 hari",
   description:"Visual musik yang berani, artistik, dan memorable untuk artis lokal & nasional.",
   longDescription:"Music video adalah kartu nama visual seorang artis. Kami memahami ini — setiap musik video yang kami buat dirancang untuk memperkuat identitas artis sekaligus menjadi konten yang shareable dan memorable.\n\nDari pop mainstream hingga indie experimental, Frameless Creative punya pengalaman mengerjakan berbagai genre musik.",
   tags:["Concept","Production","Grading"],portfolioCategory:"music-video",
   features:["Concept development & treatment","Casting & lokasi scouting","Multi-lokasi shooting","VFX & motion graphics","Color grading sinematik","Deliverable: 4K master + YouTube/IG version","Behind the scenes bonus"]},
  {icon:"🎞️",slug:"short-film",title:"Short Film",price:"Rp 15.000.000+",duration:"14–45 hari",
   description:"Film pendek naratif dengan sinematografi profesional dan nilai artistik tinggi.",
   longDescription:"Short film adalah medium bercerita yang paling powerful. Kami menggarap setiap proyek film pendek dengan dedikasi penuh — dari development script hingga post production.\n\nFrameless Creative telah menghasilkan film pendek yang meraih pengakuan di berbagai festival film nasional dan internasional.",
   tags:["Script","Directing","Post"],portfolioCategory:"short-film",
   features:["Script development & coverage","Pitching & production design","Sinematografi profesional","Casting & rehearsal","Sound recording & mixing","Color grade sinematik","Festival submission support"]},
  {icon:"📽️",slug:"documentary",title:"Documentary",price:"Rp 10.000.000+",duration:"14–60 hari",
   description:"Dokumenter kisah nyata dengan pendekatan sinematik yang mendalam dan autentik.",
   longDescription:"Dokumenter yang baik mengubah cara orang memandang dunia. Kami mendekati setiap proyek dokumenter dengan riset mendalam, pendekatan personal kepada narasumber, dan visual storytelling yang kuat.",
   tags:["Research","Interview","Narasi"],portfolioCategory:"documentary",
   features:["Research & pra-produksi komprehensif","Interview setup profesional","B-roll sinematik","Narasi & voice over","Musik original atau licensed","Subtitling multi-bahasa","Versi pendek untuk sosmed"]},
  {icon:"💍",slug:"wedding-cinema",title:"Wedding Cinema",price:"Rp 7.500.000+",duration:"7–21 hari",
   description:"Cinematic wedding film yang mengabadikan setiap momen hari terbaikmu dengan indah.",
   longDescription:"Pernikahan terjadi sekali seumur hidup. Kami hadir untuk mengabadikannya dengan cara yang paling indah dan emosional — bukan sekadar dokumentasi, tapi sebuah karya sinema yang akan kamu kenang selamanya.\n\nFrameless Creative telah menggarap ratusan wedding film dari Wonosobo hingga berbagai kota besar di Indonesia.",
   tags:["Pre-wedding","Ceremony","Reception"],portfolioCategory:"wedding",
   features:["Pre-wedding session","Full day coverage hari H","2–3 kameraman profesional","Drone aerial coverage","Highlight film 3–5 menit","Full length documentation","Same day edit (SDE) opsional","Teaser 30 detik untuk sosmed"]},
  {icon:"📱",slug:"social-media",title:"Social Media Content",price:"Rp 2.500.000+",duration:"1–5 hari",
   description:"Konten video viral-ready untuk Instagram Reels, TikTok, dan YouTube Shorts.",
   longDescription:"Algoritma sosial media terus berubah, tapi konten yang berkualitas selalu relevan. Kami membantu brand dan individu menghadirkan konten video yang tidak hanya estetis, tapi juga performatif — designed to get views.\n\nPaket bulanan tersedia untuk brand yang butuh konten reguler.",
   tags:["Reels","TikTok","YouTube"],portfolioCategory:"social-media",
   features:["Concept & scripting kreatif","Vertical format 9:16 & 1:1","Text animasi & captions otomatis","Music licensed","Hook yang kuat di 3 detik pertama","Deliverable siap upload","Paket bulanan hemat tersedia"]},
  {icon:"🏢",slug:"corporate-video",title:"Corporate Video",price:"Rp 6.000.000+",duration:"5–14 hari",
   description:"Video profil perusahaan, training material, dan komunikasi internal profesional.",
   longDescription:"Video adalah cara paling efektif untuk mengkomunikasikan identitas dan nilai perusahaan. Dari company profile hingga training video, kami membantu perusahaan hadir secara profesional di dunia visual.",
   tags:["Profile","Training","Annual Report"],portfolioCategory:"corporate",
   features:["Brief & stakeholder interview","Footage operasional & lokasi","Infografis & data visualization","Dubbing & voice over profesional","Subtitling multi-bahasa","Format presentasi & sosmed","Annual report video tersedia"]},
  {icon:"🎪",slug:"event-coverage",title:"Event Coverage",price:"Rp 4.000.000+",duration:"1–7 hari",
   description:"Dokumentasi event, konser, pameran, dan aktivasi brand dengan multi-kamera.",
   longDescription:"Setiap event punya momen-momen berharga yang sayang dilewatkan. Tim Frameless Creative hadir dengan setup multi-kamera untuk memastikan tidak ada satu momen pun yang terlewat, dari opening hingga closing.",
   tags:["Multi-cam","Highlight","Livestream"],portfolioCategory:"event",
   features:["Multi-kamera professional setup","Coverage menyeluruh & dinamis","Same-day edit highlight tersedia","Full documentation video","Livestreaming support","Foto event tersedia","Deliverable cepat dalam 24–48 jam"]},
];

function ytId(url?:string){return url?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/)?.[1]??null;}
function watchUrl(url:string){const id=ytId(url);return id?`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`:url;}
function getThumb(url:string,custom?:string){if(custom)return custom;const id=ytId(url);return id?`https://img.youtube.com/vi/${id}/maxresdefault.jpg`:""; }
function isDirectVideo(u?:string){ return !!u && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(u); }
function ytAutoplayMuted(u?:string){ const id = u ? ytId(u) : null; return id ? `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0` : ""; }

function VideoModal({url,onClose}:{url:string;onClose:()=>void}) {
  useEffect(()=>{const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[onClose]);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.96)",backdropFilter:"blur(20px)"}}>
      <button onClick={onClose} style={{position:"absolute",top:20,right:20,width:44,height:44,borderRadius:"50%",background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><X size={18}/></button>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(92vw,1000px)",aspectRatio:"16/9"}}>
        <iframe src={watchUrl(url)} style={{width:"100%",height:"100%",borderRadius:14,border:"none"}} allow="autoplay;fullscreen" allowFullScreen/>
      </div>
    </div>
  );
}

export default function ServiceDetailPage() {
  const [, params]  = useRoute("/services/:slug");
  const [, navigate] = useLocation();
  const { toast }   = useToast();
  const slug = params?.slug || "";

  const [modal,    setModal]    = useState<string|null>(null);
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [form,     setForm]     = useState({name:"",email:"",phone:"",message:""});
  const [submitting, setSubmitting] = useState(false);

  const {data:cms}     = useQuery<CmsData>({queryKey:["/api/cms"],queryFn:()=>fetch("/api/cms").then(r=>r.json()),staleTime:60_000});
  const {data:vids=[]} = useQuery<SiteVideo[]>({queryKey:["/api/site-videos"],queryFn:()=>fetch("/api/site-videos").then(r=>r.json()).then((a:SiteVideo[])=>a.filter(v=>v.isActive).sort((a,b)=>a.orderIndex-b.orderIndex))});

  const cmsServices = (()=>{try{return JSON.parse(cms?.services?.items||"[]") as ServiceItem[];}catch{return [];}})();
  const services = cmsServices.length>0 ? cmsServices : DEFAULT_SERVICES;
  const service  = services.find(s=>s.slug===slug);

  const brand   = cms?.branding||{};
  const cont    = cms?.contact||{};
  const logoUrl = brand.logoUrl||"";
  const brandName = brand.name||"Frameless Creative";
  const wa = cont.whatsapp?`https://wa.me/${cont.whatsapp.replace(/\D/g,"")}?text=Halo, saya tertarik dengan layanan ${service?.title||""} dari Frameless Creative.`:"#";

  // Portfolio videos for this service
  const portfolioCat = service?.portfolioCategory || slug;
  const portfolioVids = vids.filter(v=>
    v.category===portfolioCat ||
    v.category===slug ||
    v.category==="portfolio" && (()=>{try{return JSON.parse(v.tags||"[]").some((t:string)=>t.toLowerCase().includes(slug.replace("-"," ").split("-")[0]));}catch{return false;}})()
  );

  // Related services (excluding current)
  const related = services.filter(s=>s.slug!==slug).slice(0,3);

  async function handleSubmit(e:React.FormEvent) {
    e.preventDefault();
    if(!form.name||!form.email) return;
    setSubmitting(true);
    try {
      await fetch("/api/cms/inquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,service:service?.title,slug})});
      toast({title:"Pesan terkirim! 🎉",description:"Tim kami akan menghubungi kamu dalam 1x24 jam."});
      setInquiryOpen(false);
      setForm({name:"",email:"",phone:"",message:""});
    } catch {
      // Fallback: open WhatsApp
      if(cont.whatsapp) window.open(wa,"_blank");
      else toast({variant:"destructive",title:"Gagal kirim",description:"Coba via WhatsApp langsung."});
    } finally { setSubmitting(false); }
  }

  // 404 for unknown slug
  if (cms && !service) {
    return (
      <div style={{minHeight:"100vh",background:"#0a0a0c",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16,fontFamily:FONT}}>
        <Film size={52} color="rgba(255,255,255,.12)"/>
        <h2 style={{fontSize:22,fontWeight:800,color:"#fff"}}>Layanan tidak ditemukan</h2>
        <button onClick={()=>navigate("/services")} style={{color:OR,background:"none",border:"none",cursor:"pointer",fontSize:14,fontFamily:FONT,textDecoration:"underline"}}>← Kembali ke semua layanan</button>
      </div>
    );
  }

  if (!service) return (
    <div style={{minHeight:"100vh",background:"#0a0a0c",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT}}>
      <div style={{width:36,height:36,borderRadius:"50%",border:`3px solid ${OR}`,borderTopColor:"transparent",animation:"spin .7s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );

  const ipt = {width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"11px 14px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT,boxSizing:"border-box" as any,transition:"border-color .2s"};

  return (
    <div style={{background:"#0a0a0c",color:"#f0f0f0",fontFamily:FONT,minHeight:"100vh",overflowX:"hidden"}}>
      <style>{CSS}</style>

      {/* Ambient BG */}
      <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
        <div style={{position:"absolute",width:"70%",height:"70%",top:"-20%",left:"-15%",background:`radial-gradient(ellipse at center,${OR}40 0%,transparent 65%)`,filter:"blur(80px)",animation:"b1 22s ease-in-out infinite"}}/>
        <div style={{position:"absolute",width:"55%",height:"55%",bottom:"-20%",right:"-10%",background:"radial-gradient(ellipse at center,#7c3aed30 0%,transparent 70%)",filter:"blur(90px)",animation:"b2 28s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.016) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.016) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
      </div>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,height:62,background:"rgba(10,10,12,.85)",backdropFilter:"blur(24px)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
        <div style={{maxWidth:1200,margin:"0 auto",height:"100%",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <button onClick={()=>navigate("/services")} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",fontSize:13,fontFamily:FONT,transition:"color .2s",padding:0}}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.color="#fff"}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.color="rgba(255,255,255,.5)"}>
              <ArrowLeft size={14}/> Layanan
            </button>
            <span style={{color:"rgba(255,255,255,.2)"}}>›</span>
            <span style={{fontSize:13,color:"rgba(255,255,255,.5)",fontWeight:600}}>{service.title}</span>
          </div>
          <a href="/" style={{display:"flex",alignItems:"center",gap:8,textDecoration:"none"}}>
            {logoUrl
              ? <img src={logoUrl} alt={brandName} style={{height:28,width:"auto",filter:"brightness(0) invert(1)"}}/>
              : <><div style={{width:28,height:28,borderRadius:8,background:OR,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontWeight:900,fontSize:13}}>F</span></div>
                  <span style={{fontSize:13,fontWeight:800,color:"#fff"}}>{brandName}</span></>
            }
          </a>
          <button onClick={()=>setInquiryOpen(true)} style={{padding:"8px 18px",borderRadius:100,background:OR,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>Hubungi Kami</button>
        </div>
      </nav>

      <div style={{position:"relative",zIndex:1}}>

        {/* HERO */}
        <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"60px 24px 56px"}}>
          <div className="hero-grid" style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:56,alignItems:"start"}}>

            {/* Left */}
            <div>
              <div className="fu d1" style={{display:"inline-flex",alignItems:"center",gap:8,padding:"5px 14px",borderRadius:100,background:`${OR}18`,border:`1px solid ${OR}33`,marginBottom:22}}>
                <span style={{fontSize:20}}>{service.icon}</span>
                <span style={{fontSize:10,fontWeight:700,letterSpacing:".18em",color:OR,textTransform:"uppercase"}}>Layanan Frameless Creative</span>
              </div>
              <h1 className="fu d2" style={{fontSize:"clamp(36px,5.5vw,66px)",fontWeight:900,letterSpacing:"-.045em",color:"#fff",marginBottom:18,lineHeight:1.0}}>{service.title}</h1>
              <p className="fu d3" style={{fontSize:"clamp(15px,1.6vw,18px)",color:"rgba(255,255,255,.5)",lineHeight:1.74,marginBottom:28}}>{service.description}</p>

              {/* Highlight Video — autoplay, dari CMS Layanan */}
              {service.highlightVideoUrl && (
                <div className="fu d3" onClick={()=>setModal(service.highlightVideoUrl!)} style={{borderRadius:18,overflow:"hidden",cursor:"pointer",aspectRatio:"16/9",background:"#000",position:"relative",marginBottom:28,border:"1px solid rgba(255,255,255,.08)"}}>
                  {isDirectVideo(service.highlightVideoUrl) ? (
                    <video src={service.highlightVideoUrl} autoPlay muted loop playsInline style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  ) : ytAutoplayMuted(service.highlightVideoUrl) ? (
                    <iframe src={ytAutoplayMuted(service.highlightVideoUrl)} style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none",pointerEvents:"none"}} allow="autoplay;encrypted-media"/>
                  ) : getThumb(service.highlightVideoUrl) ? (
                    <img src={getThumb(service.highlightVideoUrl)} alt={service.title} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  ) : null}
                  <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.5) 0%,transparent 40%)"}}/>
                  <div style={{position:"absolute",top:16,right:16,width:40,height:40,borderRadius:"50%",background:`${OR}cc`,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}>
                    <Play size={14} style={{fill:"#fff",color:"#fff",marginLeft:1}}/>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:32}}>
                {(service.tags||[]).map(t=>(
                  <span key={t} style={{fontSize:12,padding:"5px 14px",borderRadius:100,background:"rgba(255,255,255,.07)",color:"rgba(255,255,255,.55)",fontWeight:600,border:"1px solid rgba(255,255,255,.1)"}}>{t}</span>
                ))}
                {service.duration&&<span style={{fontSize:12,padding:"5px 14px",borderRadius:100,background:`${OR}18`,color:OR,fontWeight:700,border:`1px solid ${OR}33`}}>⏱ {service.duration}</span>}
              </div>

              {/* Social proof */}
              <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
                {[{icon:"⭐",v:"4.9/5",l:"Rating klien"},{icon:"✅",v:"200+",l:"Project selesai"},{icon:"🔄",v:"85%",l:"Repeat order"}].map(s=>(
                  <div key={s.l} style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:15}}>{s.icon}</span>
                    <span style={{fontSize:13,color:"rgba(255,255,255,.45)"}}><strong style={{color:"#fff",fontWeight:800}}>{s.v}</strong> {s.l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Sticky action card */}
            <div style={{position:"sticky",top:80}}>
              <div style={{background:"rgba(255,255,255,.035)",border:`1px solid ${OR}33`,borderRadius:24,padding:"28px 24px",backdropFilter:"blur(16px)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                  <div style={{fontSize:32}}>{service.icon}</div>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>{service.title}</p>
                    {service.duration&&<p style={{fontSize:11,color:"rgba(255,255,255,.4)",margin:"2px 0 0"}}>⏱ {service.duration}</p>}
                  </div>
                </div>
                {service.price&&(
                  <div style={{marginBottom:20}}>
                    <p style={{fontSize:10,color:"rgba(255,255,255,.3)",margin:"0 0 3px",textTransform:"uppercase",letterSpacing:".1em"}}>Estimasi investasi</p>
                    <p style={{fontSize:26,fontWeight:900,color:OR,margin:0,letterSpacing:"-.02em"}}>{service.price}</p>
                    <p style={{fontSize:11,color:"rgba(255,255,255,.3)",margin:"3px 0 0"}}>*Harga final sesuai brief & scope</p>
                  </div>
                )}
                <button onClick={()=>setInquiryOpen(true)} style={{width:"100%",padding:"14px",borderRadius:14,background:OR,border:"none",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:FONT,marginBottom:10}}>
                  Request Penawaran →
                </button>
                {cont.whatsapp&&(
                  <a href={wa} target="_blank" rel="noopener noreferrer" style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",borderRadius:14,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:700}}>
                    <MessageCircle size={15}/> Chat WhatsApp
                  </a>
                )}
                <div style={{marginTop:14,display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                  {["✅ Konsultasi gratis","🔒 No hidden fee","⚡ Respon cepat"].map(t=>(
                    <span key={t} style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT / LONG DESC */}
        {service.longDescription&&(
          <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"0 24px 64px"}}>
            <div style={{maxWidth:720}}>
              <h2 style={{fontSize:"clamp(22px,3vw,32px)",fontWeight:800,color:"#fff",letterSpacing:"-.03em",marginBottom:20}}>Tentang Layanan Ini</h2>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {service.longDescription.split("\n\n").map((para,i)=>(
                  <p key={i} style={{fontSize:15,color:"rgba(255,255,255,.55)",lineHeight:1.78}}>{para}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FEATURES */}
        {service.features&&service.features.length>0&&(
          <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"0 24px 72px"}}>
            <h2 style={{fontSize:"clamp(22px,3vw,32px)",fontWeight:800,color:"#fff",letterSpacing:"-.03em",marginBottom:28}}>
              Yang Kamu Dapat <span style={{color:OR}}>✓</span>
            </h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {service.features.map((feat,i)=>(
                <div key={i} className="feat-item" style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 18px",borderRadius:14,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)"}}>
                  <CheckCircle2 size={16} color={OR} style={{flexShrink:0,marginTop:2}}/>
                  <span style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.5}}>{feat}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* PORTFOLIO */}
        <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"0 24px 80px"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:32,flexWrap:"wrap",gap:12}}>
            <div>
              <p style={{fontSize:10,fontWeight:700,letterSpacing:".22em",color:OR,textTransform:"uppercase",marginBottom:10}}>PORTFOLIO</p>
              <h2 style={{fontSize:"clamp(22px,3vw,36px)",fontWeight:800,color:"#fff",letterSpacing:"-.03em",margin:0}}>
                Karya {service.title}
              </h2>
            </div>
            <p style={{fontSize:12,color:"rgba(255,255,255,.3)"}}>
              {portfolioVids.length>0?`${portfolioVids.length} karya`:"Upload via Admin → Site Videos"}
            </p>
          </div>

          {portfolioVids.length>0?(
            <div className="pf-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:18}}>
              {portfolioVids.map((v,i)=>{
                const th=getThumb(v.embedUrl,v.thumbnailUrl);
                const isFeatured=i===0&&portfolioVids.length>=3;
                return (
                  <div key={v.id} className="pf-thumb"
                    onClick={()=>setModal(v.embedUrl)}
                    style={{borderRadius:18,overflow:"hidden",position:"relative",aspectRatio:isFeatured?"16/9":"4/3",border:"1px solid rgba(255,255,255,.07)",gridColumn:isFeatured?"1/-1":undefined,boxShadow:"0 4px 20px rgba(0,0,0,.3)"}}>
                    {th?<img src={th} style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}} alt={v.title}/>
                       :<div style={{width:"100%",height:"100%",minHeight:200,background:`linear-gradient(135deg,${OR}22,#7c3aed22)`,display:"flex",alignItems:"center",justifyContent:"center"}}><Film size={32} color="rgba(255,255,255,.15)"/></div>}
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,.8) 0%,rgba(0,0,0,.1) 55%,transparent 100%)"}}/>
                    <div className="ov" style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.2)"}}>
                      <div style={{width:54,height:54,borderRadius:"50%",background:OR,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 0 24px ${OR}88`}}>
                        <Play size={20} style={{fill:"#fff",color:"#fff",marginLeft:2}}/>
                      </div>
                    </div>
                    <div style={{position:"absolute",bottom:16,left:20,right:20}}>
                      {isFeatured&&<div style={{fontSize:10,fontWeight:700,letterSpacing:".15em",color:OR,textTransform:"uppercase",marginBottom:5}}>FEATURED</div>}
                      <h3 style={{fontSize:isFeatured?18:14,fontWeight:700,color:"#fff",margin:0}}>{v.title}</h3>
                      {v.description&&<p style={{fontSize:11,color:"rgba(255,255,255,.5)",marginTop:3}}>{v.description}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ):(
            <div style={{padding:"60px 40px",borderRadius:22,border:"2px dashed rgba(255,255,255,.08)",textAlign:"center"}}>
              <ImageIcon size={44} color="rgba(255,255,255,.1)" style={{margin:"0 auto 16px"}}/>
              <p style={{color:"rgba(255,255,255,.35)",fontSize:14,marginBottom:10}}>Belum ada portfolio untuk layanan ini.</p>
              <p style={{color:"rgba(255,255,255,.22)",fontSize:12}}>
                Admin: tambahkan video di <strong style={{color:OR}}>Site Videos</strong> dengan kategori <strong style={{color:OR}}>"{portfolioCat}"</strong>
              </p>
            </div>
          )}
        </section>

        {/* RELATED SERVICES */}
        <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"0 24px 80px"}}>
          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:24,padding:"36px 32px"}}>
            <h3 style={{fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-.02em",marginBottom:24}}>Layanan Lainnya</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
              {related.map(s=>(
                <a key={s.slug} href={`/services/${s.slug}`} style={{textDecoration:"none",padding:"18px 20px",borderRadius:16,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",display:"flex",gap:12,alignItems:"flex-start",transition:"border-color .2s,transform .2s"}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=`${OR}44`;el.style.transform="translateY(-2px)";}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="rgba(255,255,255,.07)";el.style.transform="translateY(0)";}}>
                  <span style={{fontSize:22,flexShrink:0}}>{s.icon}</span>
                  <div>
                    <p style={{fontSize:13,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{s.title}</p>
                    <p style={{fontSize:11,color:"rgba(255,255,255,.4)",lineHeight:1.5}}>{s.description.slice(0,60)}...</p>
                    {s.price&&<p style={{fontSize:12,fontWeight:700,color:OR,margin:"6px 0 0"}}>{s.price}</p>}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="pxs" style={{maxWidth:1200,margin:"0 auto",padding:"0 24px 100px"}}>
          <div style={{textAlign:"center",padding:"60px 40px",borderRadius:28,background:`linear-gradient(135deg,${OR}15,rgba(124,58,237,.1))`,border:`1px solid ${OR}28`,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-60,right:-60,width:220,height:220,borderRadius:"50%",background:`${OR}08`,filter:"blur(50px)"}}/>
            <p style={{fontSize:10,fontWeight:700,letterSpacing:".22em",color:OR,textTransform:"uppercase",marginBottom:14,position:"relative"}}>MULAI SEKARANG</p>
            <h2 style={{fontSize:"clamp(24px,4vw,42px)",fontWeight:900,color:"#fff",letterSpacing:"-.04em",marginBottom:14,position:"relative",lineHeight:1.0}}>
              Siap Garap {service.title}?
            </h2>
            <p style={{color:"rgba(255,255,255,.45)",fontSize:15,lineHeight:1.65,marginBottom:36,maxWidth:480,margin:"0 auto 36px",position:"relative"}}>
              Konsultasi gratis, no commitment. Ceritakan projekmu dan kami siapkan penawaran terbaik.
            </p>
            <div className="cta-row" style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",position:"relative"}}>
              <button onClick={()=>setInquiryOpen(true)} style={{display:"flex",alignItems:"center",gap:8,padding:"14px 28px",borderRadius:100,background:OR,border:"none",color:"#fff",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>
                Request Penawaran →
              </button>
              {cont.whatsapp&&(
                <a href={wa} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"14px 26px",borderRadius:100,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:15,fontWeight:700}}>
                  <MessageCircle size={16}/> WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* INQUIRY MODAL */}
      {inquiryOpen&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setInquiryOpen(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",backdropFilter:"blur(16px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"#111318",border:"1px solid rgba(255,255,255,.1)",borderRadius:24,padding:"36px 30px",width:"100%",maxWidth:440,position:"relative"}}>
            <button onClick={()=>setInquiryOpen(false)} style={{position:"absolute",top:14,right:14,width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.06)",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{fontSize:22}}>{service.icon}</span>
              <h3 style={{fontSize:19,fontWeight:800,color:"#fff",letterSpacing:"-.02em"}}>Request Penawaran</h3>
            </div>
            <p style={{fontSize:12,color:OR,fontWeight:600,marginBottom:22}}>{service.title}</p>
            <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:14}}>
              {[{k:"name",l:"Nama / Brand *",ph:"Nama kamu / perusahaan"},{k:"email",l:"Email *",t:"email",ph:"email@perusahaan.com"},{k:"phone",l:"WhatsApp",t:"tel",ph:"+62 8xx-xxxx-xxxx"}].map((f:any)=>(
                <div key={f.k}>
                  <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>{f.l}</label>
                  <input type={f.t||"text"} value={(form as any)[f.k]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} required={f.l.includes("*")} style={ipt}
                    onFocus={e=>(e.target as HTMLElement).style.borderColor=`${OR}66`}
                    onBlur={e=>(e.target as HTMLElement).style.borderColor="rgba(255,255,255,.1)"}/>
                </div>
              ))}
              <div>
                <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>Ceritakan Kebutuhan Kamu</label>
                <textarea value={form.message} onChange={e=>setForm(p=>({...p,message:e.target.value}))} rows={3} placeholder={`Contoh: Butuh ${service.title.toLowerCase()} untuk peluncuran produk baru kami...`} style={{...ipt,resize:"vertical"}}/>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                {cont.whatsapp&&(
                  <a href={wa} target="_blank" rel="noopener noreferrer" style={{flex:"0 0 auto",display:"flex",alignItems:"center",gap:7,padding:"12px 18px",borderRadius:12,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:700}}>
                    <MessageCircle size={14}/>WA
                  </a>
                )}
                <button type="submit" disabled={submitting||!form.name||!form.email} style={{flex:1,padding:"13px",borderRadius:12,background:OR,border:"none",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:FONT,opacity:submitting?0.7:1}}>
                  {submitting?"Mengirim...":"Kirim Pesan 📩"}
                </button>
              </div>
              <p style={{fontSize:11,color:"rgba(255,255,255,.25)",textAlign:"center"}}>🔒 Data aman. Kami tidak spam.</p>
            </form>
          </div>
        </div>
      )}

      {modal&&<VideoModal url={modal} onClose={()=>setModal(null)}/>}
    </div>
  );
}
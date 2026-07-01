import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Package, Download, Star, ChevronRight, ShoppingCart,
  ArrowLeft, X, Check, Shield, Globe, AlertCircle,
  MessageCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DigitalAsset {
  id: string; title: string; description: string; category: string;
  price: number; fileUrl: string; thumbnailUrl: string;
  isActive: boolean; isFeatured: boolean; downloadCount: number;
}
interface CmsData { branding?: Record<string,string>; }

const OR   = "hsl(11,85%,54%)";
const FONT = "'Plus Jakarta Sans',sans-serif";
const BORDER = "rgba(255,255,255,.08)";
const SURF   = "rgba(255,255,255,.03)";

const CATEGORIES = ["all","preset","luts","template","sfx","music","font","other"];
const CATEGORY_LABELS: Record<string,string> = {
  all:"Semua", preset:"Presets", luts:"LUTs",
  template:"Templates", sfx:"SFX", music:"Music", font:"Fonts", other:"Lainnya",
};

declare global { interface Window { snap: any; } }

function loadSnap(isProduction: boolean, clientKey?: string): Promise<void> {
  return new Promise(resolve => {
    if (window.snap) { resolve(); return; }
    const existing = document.getElementById("mt-snap");
    if (existing) { (existing as any).onload = () => resolve(); return; }
    const s = document.createElement("script");
    s.id  = "mt-snap";
    s.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    if (clientKey) s.setAttribute("data-client-key", clientKey);
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

// ── BuyModal ──────────────────────────────────────────────────────────────────
function BuyModal({ asset, waNumber, onClose }: {
  asset: DigitalAsset;
  waNumber: string;
  onClose: () => void;
}) {
  type Step = "form" | "paying" | "success" | "manual";
  const [step, setStep]   = useState<Step>("form");
  const [form, setForm]   = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileUrl, setFileUrl] = useState<string>("");
  const [errMsg, setErrMsg]  = useState<string>("");

  const price = Number(asset.price);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && step === "form") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [step, onClose]);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Nama wajib diisi";
    if (!form.email.trim()) e.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Format email tidak valid";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function handleBuy() {
    if (price > 0 && !validate()) return;
    setStep("paying");
    setErrMsg("");
    try {
      const res = await fetch(`/api/digital-assets/${asset.id}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:  form.name.trim()  || "Guest",
          email: form.email.trim() || "guest@frameless.id",
          phone: form.phone.trim() || undefined,
        }),
      });
      const data = await res.json();

      // Free
      if (data.free) {
        setFileUrl(data.fileUrl || asset.fileUrl);
        setStep("success");
        return;
      }

      // No gateway
      if (data.noGateway) {
        setStep("manual");
        return;
      }

      // Snap
      if (data.snapToken) {
        await loadSnap(data.isProduction, data.clientKey);
        window.snap.pay(data.snapToken, {
          onSuccess: async () => {
            // Get download URL and increment counter
            const dlRes = await fetch(`/api/digital-assets/${asset.id}/download`, { method: "POST" });
            const dlData = await dlRes.json();
            setFileUrl(dlData.fileUrl || asset.fileUrl);
            setStep("success");
          },
          onPending: () => {
            setErrMsg("Pembayaran masih diproses. Setelah lunas, file tersedia di email.");
            setStep("form");
          },
          onError: () => {
            setErrMsg("Pembayaran gagal. Silakan coba lagi.");
            setStep("form");
          },
          onClose: () => setStep("form"),
        });
        return;
      }

      throw new Error(data.error || "Respons tidak dikenali");
    } catch (err: any) {
      setErrMsg(err.message || "Terjadi kesalahan, coba lagi.");
      setStep("form");
    }
  }

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 12,
    border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.04)",
    color: "#fff", fontSize: 14, fontFamily: FONT, outline: "none", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && step === "form") onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.85)",
        backdropFilter: "blur(18px)", zIndex: 60,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#111315", border: `1px solid ${BORDER}`,
          borderRadius: 26, width: "100%", maxWidth: 440,
          fontFamily: FONT, overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>
              {step === "success" ? "Download Siap" : step === "manual" ? "Konfirmasi Manual" : "Detail Pembelian"}
            </p>
            <h3 style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 900, color: "#fff", letterSpacing: "-.02em", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {asset.title}
            </h3>
          </div>
          {step === "form" && (
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ padding: "20px 24px 26px" }}>

          {/* ── FORM ── */}
          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Thumbnail + price */}
              <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: 16, border: `1px solid rgba(255,180,50,.25)`, background: "rgba(255,180,50,.05)" }}>
                {asset.thumbnailUrl && (
                  <img src={asset.thumbnailUrl} style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 800, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.title}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".1em" }}>{asset.category}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: price === 0 ? "#4ade80" : OR, letterSpacing: "-.03em" }}>
                    {price === 0 ? "GRATIS" : formatCurrency(price)}
                  </p>
                </div>
              </div>

              {/* Error banner */}
              {errMsg && (
                <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)" }}>
                  <AlertCircle size={14} color="#f87171" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{errMsg}</p>
                </div>
              )}

              {/* Form fields — only required for paid */}
              {price > 0 ? (
                <>
                  {[
                    { key: "name",  label: "Nama Lengkap *", type: "text",  ph: "Nama kamu" },
                    { key: "email", label: "Email *",         type: "email", ph: "email@kamu.com" },
                    { key: "phone", label: "WhatsApp (opsional)", type: "tel", ph: "+62 8xx..." },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", marginBottom: 6, fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: errors[f.key] ? "#f87171" : "rgba(255,255,255,.35)" }}>
                        {errors[f.key] || f.label}
                      </label>
                      <input
                        type={f.type}
                        value={form[f.key as keyof typeof form]}
                        onChange={e => { setForm(p => ({ ...p, [f.key]: e.target.value })); setErrors(p => ({ ...p, [f.key]: "" })); }}
                        placeholder={f.ph}
                        style={{ ...inputSt, borderColor: errors[f.key] ? "#f87171" : BORDER }}
                        onFocus={e => (e.currentTarget.style.borderColor = OR)}
                        onBlur={e => (e.currentTarget.style.borderColor = errors[f.key] ? "#f87171" : BORDER)}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.6, textAlign: "center" }}>
                  Aset ini gratis — klik tombol di bawah untuk langsung download.
                </p>
              )}

              <button
                onClick={handleBuy}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 100, border: "none",
                  background: OR, color: "#fff", fontSize: 15, fontWeight: 800,
                  fontFamily: FONT, cursor: "pointer", transition: "opacity .18s",
                  boxShadow: `0 8px 28px hsl(11,85%,54%,0.4)`,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = ".9")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {price === 0 ? <><Download size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Download Gratis</> : <><ShoppingCart size={15} style={{ verticalAlign: "middle", marginRight: 7 }} />Bayar {formatCurrency(price)}</>}
              </button>

              {price > 0 && (
                <p style={{ margin: 0, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <Shield size={10} /> Pembayaran aman via Midtrans
                </p>
              )}
            </div>
          )}

          {/* ── PAYING ── */}
          {step === "paying" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 20px" }}>
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${OR}22` }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .8s linear infinite" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Shield size={22} color={OR} />
                </div>
              </div>
              <p style={{ fontSize: 17, fontWeight: 800, margin: "0 0 8px", color: "#fff" }}>Memproses Pembayaran</p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.4)", lineHeight: 1.7 }}>Menghubungkan ke gateway.<br />Jangan tutup halaman ini.</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {step === "success" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,.12)", border: "2px solid rgba(34,197,94,.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "4px auto 4px" }}>
                <Check size={30} color="#22c55e" strokeWidth={2.5} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-.03em" }}>
                  {price === 0 ? "Selamat, aset gratis!" : "Pembayaran Berhasil!"}
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.45)", lineHeight: 1.7 }}>
                  {price === 0 ? "Langsung download file di bawah." : "Terima kasih! File siap didownload."}
                </p>
              </div>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "14px 0", borderRadius: 100, background: OR, color: "#fff",
                    textDecoration: "none", fontSize: 15, fontWeight: 800, fontFamily: FONT,
                    boxShadow: `0 8px 28px hsl(11,85%,54%,.4)`,
                  }}
                >
                  <Download size={16} /> Download File
                </a>
              ) : (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", margin: 0 }}>
                  Link download dikirim ke email kamu.
                </p>
              )}
              <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                Tutup
              </button>
            </div>
          )}

          {/* ── MANUAL ── */}
          {step === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(240,56,32,.12)", border: `2px solid rgba(240,56,32,.3)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "4px auto" }}>
                <MessageCircle size={26} color={OR} />
              </div>
              <div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#fff", letterSpacing: "-.03em" }}>
                  Konfirmasi via WhatsApp
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.4)", lineHeight: 1.7 }}>
                  Payment gateway belum aktif. Hubungi kami untuk konfirmasi pembelian manual.
                </p>
              </div>
              <div style={{ padding: "14px 16px", borderRadius: 14, border: `1px solid ${BORDER}`, background: SURF }}>
                {[
                  { l: "Aset", v: asset.title },
                  { l: "Harga", v: formatCurrency(price) },
                  { l: "Nama", v: form.name || "—" },
                  { l: "Email", v: form.email || "—" },
                ].map(r => (
                  <div key={r.l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "rgba(255,255,255,.4)" }}>{r.l}</span>
                    <span style={{ color: "#fff", fontWeight: 600 }}>{r.v}</span>
                  </div>
                ))}
              </div>
              <a
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo Frameless Store 👋\n\nSaya ingin membeli:\n• Aset: *${asset.title}*\n• Harga: *${formatCurrency(price)}*\n• Nama: *${form.name}*\n• Email: *${form.email}*\n\nMohon konfirmasinya, terima kasih!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px 0", borderRadius: 100, background: "#25d366", color: "#fff",
                  textDecoration: "none", fontSize: 14, fontWeight: 800, fontFamily: FONT,
                  boxShadow: "0 8px 24px rgba(37,211,102,.3)",
                }}
              >
                <MessageCircle size={16} /> Chat WhatsApp
              </a>
              <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(255,255,255,.35)", fontSize: 13, cursor: "pointer", fontFamily: FONT }}>
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function DigitalAssetsPage() {
  const [filterCat, setFilterCat]     = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<DigitalAsset | null>(null);
  const [waNumber, setWaNumber]       = useState("6281234567890");

  const { data: assets = [], isLoading } = useQuery<DigitalAsset[]>({
    queryKey: ["/api/digital-assets/public"],
    queryFn:  () => fetch("/api/digital-assets").then(r => r.json()).then((a: DigitalAsset[]) => a.filter((x: DigitalAsset) => x.isActive)),
  });

  const { data: cms } = useQuery<CmsData>({
    queryKey:  ["/api/cms"],
    queryFn:   () => fetch("/api/cms").then(r => r.json()),
    staleTime: 60_000,
  });

  // Load WA number from public payment settings
  useEffect(() => {
    fetch("/api/payment-settings/public")
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ provider: string; config: string }>) => {
        const wa = data.find(d => d.provider === "whatsapp" || d.provider === "contact");
        if (wa) {
          try {
            const cfg = JSON.parse(wa.config);
            const num = (cfg.phoneNumber || cfg.whatsapp || "").replace(/\D/g, "");
            if (num) setWaNumber(num);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const brand = cms?.branding || {};
  const logoUrl   = (brand as any).logoUrl   || "";
  const brandName = (brand as any).name      || "Frameless";

  const filtered = filterCat === "all" ? assets : assets.filter(a => a.category === filterCat);
  const featured = assets.filter(a => a.isFeatured);

  return (
    <div style={{ background:"#0a0a0c", color:"#f0f0f0", fontFamily:FONT, minHeight:"100vh", overflowX:"hidden", position:"relative" }}>

      {/* Global ambient mesh — sama persis dengan landing page supaya konsisten */}
      <div style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", width:"70%", height:"60%", top:"-12%", left:"-10%", background:`radial-gradient(ellipse at center,${OR.replace("hsl(11,85%,54%)","rgba(240,56,32,")}0.06) 0%,transparent 70%)`, filter:"blur(90px)" }} />
        <div style={{ position:"absolute", width:"55%", height:"50%", top:"25%", right:"-15%", background:"radial-gradient(ellipse at center,rgba(124,58,237,.05) 0%,transparent 72%)", filter:"blur(100px)" }} />
        <div style={{ position:"absolute", width:"50%", height:"45%", bottom:"-10%", left:"10%", background:"radial-gradient(ellipse at center,rgba(37,99,235,.04) 0%,transparent 74%)", filter:"blur(100px)" }} />
      </div>

      {/* Nav */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:40, borderBottom:"1px solid rgba(255,255,255,.06)", backdropFilter:"blur(24px)", background:"rgba(10,10,12,.8)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 28px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <Link href="/">
            <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", textDecoration:"none" }}>
              <ArrowLeft size={14} color="rgba(255,255,255,.4)" />
              {logoUrl
                ? <img src={logoUrl} alt={brandName} style={{ height:26, width:"auto", objectFit:"contain", filter:"brightness(0) invert(1)" }} />
                : <><div style={{ width:28, height:28, borderRadius:8, background:OR, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:900, fontSize:13 }}>F</div>
                   <span style={{ fontWeight:800, color:"#fff", fontSize:14, letterSpacing:"-.01em" }}>{brandName} Store</span></>
              }
            </div>
          </Link>
          <span style={{ fontSize:12, color:"rgba(255,255,255,.35)", fontWeight:600 }}>{assets.length} Produk</span>
        </div>
      </nav>

      {/* Main content */}
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"100px 28px 80px", position:"relative", zIndex:1 }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:64 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 14px", borderRadius:100, border:"1px solid rgba(255,255,255,.09)", background:"rgba(255,255,255,.04)", fontSize:11, color:"rgba(255,255,255,.45)", fontWeight:600, letterSpacing:".12em", textTransform:"uppercase", marginBottom:20 }}>
            <Package size={12} color={OR} /> Frameless Store
          </div>
          <h1 style={{ fontSize:"clamp(38px,6vw,68px)", fontWeight:900, letterSpacing:"-.045em", color:"#fff", margin:"0 0 14px", lineHeight:1 }}>
            Digital <span style={{ color:OR }}>Assets</span>
          </h1>
          <p style={{ fontSize:15, color:"rgba(255,255,255,.42)", maxWidth:420, margin:"0 auto", lineHeight:1.7 }}>
            Presets, LUTs, templates, dan tools kreatif dari tim Frameless Creative.
          </p>
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section style={{ marginBottom:52 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
              <Star size={14} color={OR} />
              <span style={{ fontSize:10, fontWeight:800, color:"rgba(255,255,255,.5)", letterSpacing:".18em", textTransform:"uppercase" }}>Featured</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
              {featured.slice(0,2).map(a => (
                <div key={a.id} onClick={() => setSelectedAsset(a)} style={{
                  cursor:"pointer", borderRadius:18, overflow:"hidden",
                  border:"1px solid rgba(255,255,255,.07)",
                  background:"rgba(255,255,255,.03)",
                  transition:"border-color .25s,transform .28s,box-shadow .28s",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${OR}44`; (e.currentTarget as HTMLElement).style.transform="translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 12px 36px rgba(0,0,0,.4),0 0 30px ${OR}16`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,.07)"; (e.currentTarget as HTMLElement).style.transform="none"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}>
                  {a.thumbnailUrl && (
                    <div style={{ height:200, overflow:"hidden", position:"relative" }}>
                      <img src={a.thumbnailUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block", transition:"transform .5s ease" }} />
                      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 50%)" }} />
                    </div>
                  )}
                  <div style={{ padding:"18px 20px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                      <h3 style={{ fontWeight:800, color:"#fff", fontSize:16, letterSpacing:"-.02em" }}>{a.title}</h3>
                      <span style={{ fontWeight:900, fontSize:16, color:OR }}>{a.price === 0 ? "Free" : formatCurrency(a.price)}</span>
                    </div>
                    <p style={{ fontSize:12.5, color:"rgba(255,255,255,.42)", lineHeight:1.65, marginBottom:12, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" } as any}>{a.description}</p>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, padding:"3px 8px", borderRadius:6, background:"rgba(255,255,255,.07)", color:"rgba(255,255,255,.4)", fontWeight:600, letterSpacing:".04em", textTransform:"uppercase" }}>{a.category}</span>
                      <span style={{ fontSize:12, color:"rgba(255,255,255,.3)", marginLeft:"auto", display:"flex", alignItems:"center", gap:3 }}>
                        {a.price === 0 ? "Ambil gratis" : "Beli sekarang"} <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category filter */}
        <div style={{ display:"flex", gap:7, flexWrap:"wrap", marginBottom:28 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)} style={{
              padding:"7px 16px", borderRadius:100, fontSize:12, fontWeight:700,
              cursor:"pointer", border:"none", fontFamily:FONT, letterSpacing:".02em",
              transition:"all .2s",
              background: filterCat === c ? OR : "rgba(255,255,255,.06)",
              color: filterCat === c ? "#fff" : "rgba(255,255,255,.45)",
            }}>
              {CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:"80px 0" }}>
            <div style={{ width:36, height:36, borderRadius:"50%", border:`2.5px solid ${OR}`, borderTopColor:"transparent", animation:"spin 1s linear infinite" }} />
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:14 }}>
            {filtered.map(a => (
              <div key={a.id} onClick={() => setSelectedAsset(a)} style={{
                cursor:"pointer", borderRadius:16, overflow:"hidden",
                border:"1px solid rgba(255,255,255,.06)",
                background:"rgba(255,255,255,.03)",
                transition:"border-color .25s,transform .25s,box-shadow .25s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${OR}38`; (e.currentTarget as HTMLElement).style.transform="translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow=`0 8px 24px rgba(0,0,0,.4)`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,.06)"; (e.currentTarget as HTMLElement).style.transform="none"; (e.currentTarget as HTMLElement).style.boxShadow="none"; }}>
                <div style={{ height:140, overflow:"hidden", background:"rgba(255,255,255,.04)", position:"relative" }}>
                  {a.thumbnailUrl
                    ? <img src={a.thumbnailUrl} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
                    : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center" }}><Package size={28} color="rgba(255,255,255,.12)" /></div>
                  }
                </div>
                <div style={{ padding:"14px 16px" }}>
                  <h3 style={{ fontWeight:700, color:"#fff", fontSize:13, marginBottom:8, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", letterSpacing:"-.01em" }}>{a.title}</h3>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:9.5, padding:"2px 7px", borderRadius:5, background:"rgba(255,255,255,.06)", color:"rgba(255,255,255,.35)", fontWeight:600, textTransform:"uppercase", letterSpacing:".06em" }}>{a.category}</span>
                    <span style={{ fontWeight:900, fontSize:13, color: a.price === 0 ? "#4ade80" : OR }}>
                      {a.price === 0 ? "Free" : formatCurrency(a.price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && !isLoading && (
              <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"64px 0", color:"rgba(255,255,255,.22)" }}>
                <Package size={36} color="rgba(255,255,255,.12)" style={{ marginBottom:12 }} />
                <p style={{ fontSize:14, margin:0 }}>Belum ada aset di kategori ini.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAsset && (
        <BuyModal
          asset={selectedAsset}
          waNumber={waNumber}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}
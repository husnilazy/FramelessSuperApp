import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, Download, Star, ChevronRight, ShoppingCart, ArrowLeft, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DigitalAsset {
  id: string; title: string; description: string; category: string;
  price: number; fileUrl: string; thumbnailUrl: string;
  isActive: boolean; isFeatured: boolean; downloadCount: number;
}

interface CmsData { branding?: Record<string,string>; }

const OR = "hsl(11,85%,54%)";
const FONT = "'Plus Jakarta Sans',sans-serif";

const CATEGORIES = ["all","preset","luts","template","sfx","music","font","other"];
const CATEGORY_LABELS: Record<string,string> = {
  all:"All Products", preset:"Presets", luts:"LUTs",
  template:"Templates", sfx:"SFX", music:"Music", font:"Fonts", other:"Other",
};

function BuyModal({ asset, onClose }: { asset: DigitalAsset; onClose: () => void }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", backdropFilter:"blur(14px)", zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:"rgba(16,16,19,1)", border:"1px solid rgba(255,255,255,.1)", borderRadius:22, width:"100%", maxWidth:400, padding:24, fontFamily:FONT }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <h3 style={{ fontWeight:800, color:"#fff", fontSize:18, letterSpacing:"-.02em" }}>{asset.title}</h3>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,.07)", border:"none", borderRadius:8, width:32, height:32, cursor:"pointer", color:"rgba(255,255,255,.5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <X size={15} />
          </button>
        </div>
        {asset.thumbnailUrl && (
          <img src={asset.thumbnailUrl} style={{ width:"100%", height:180, objectFit:"cover", borderRadius:14, display:"block", marginBottom:16 }} />
        )}
        <div style={{ fontSize:30, fontWeight:900, color:OR, marginBottom:16 }}>
          {asset.price === 0 ? "FREE" : formatCurrency(asset.price)}
        </div>
        {asset.price === 0 ? (
          <a href={asset.fileUrl || "#"} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px 20px", background:OR, color:"#fff", fontWeight:700, borderRadius:14, textDecoration:"none", fontSize:15, fontFamily:FONT }}>
            <Download size={16} /> Download Free
          </a>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <p style={{ fontSize:12, color:"rgba(255,255,255,.4)", textAlign:"center", margin:0 }}>Pembayaran via Midtrans</p>
            <button style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"13px 20px", background:OR, color:"#fff", fontWeight:700, borderRadius:14, border:"none", cursor:"pointer", fontSize:15, fontFamily:FONT }}>
              <ShoppingCart size={16} /> Beli Sekarang
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DigitalAssetsPage() {
  const [filterCat, setFilterCat] = useState("all");
  const [selectedAsset, setSelectedAsset] = useState<DigitalAsset | null>(null);

  const { data: assets = [], isLoading } = useQuery<DigitalAsset[]>({
    queryKey: ["/api/digital-assets/public"],
    queryFn: () => fetch("/api/digital-assets").then(r => r.json()).then((a: DigitalAsset[]) => a.filter((x: DigitalAsset) => x.isActive)),
  });

  // CMS branding — load logo same way as landing page
  const { data: cms } = useQuery<CmsData>({
    queryKey: ["/api/cms"],
    queryFn: () => fetch("/api/cms").then(r => r.json()),
    staleTime: 60_000,
  });

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

      {selectedAsset && <BuyModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
    </div>
  );
}
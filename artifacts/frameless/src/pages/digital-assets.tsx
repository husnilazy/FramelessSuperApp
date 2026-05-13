import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Package, Download, Star, ChevronRight, ShoppingCart, ArrowLeft } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DigitalAsset {
  id: string; title: string; description: string; category: string;
  price: number; fileUrl: string; thumbnailUrl: string;
  isActive: boolean; isFeatured: boolean; downloadCount: number;
}

const CATEGORIES = ["all", "preset", "luts", "template", "sfx", "music", "font", "other"];

const CATEGORY_LABELS: Record<string, string> = {
  all: "All Products", preset: "Presets", luts: "LUTs",
  template: "Templates", sfx: "SFX", music: "Music", font: "Fonts", other: "Other",
};

function BuyModal({ asset, onClose }: { asset: DigitalAsset; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-lg">{asset.title}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
        </div>
        {asset.thumbnailUrl && (
          <img src={asset.thumbnailUrl} className="w-full h-40 object-cover rounded-xl" />
        )}
        <div className="flex items-center justify-between">
          <span className="text-3xl font-black text-[hsl(20,100%,58%)]">
            {asset.price === 0 ? "FREE" : formatCurrency(asset.price)}
          </span>
        </div>
        {asset.price === 0 ? (
          <a href={asset.fileUrl || "#"} target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-3 bg-[hsl(20,100%,58%)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
            <Download className="w-4 h-4" /> Download Free
          </a>
        ) : (
          <div className="space-y-2">
            <p className="text-white/60 text-sm text-center">Payment via Midtrans</p>
            <button className="w-full flex items-center justify-center gap-2 py-3 bg-[hsl(20,100%,58%)] text-white font-bold rounded-xl hover:opacity-90 transition-opacity">
              <ShoppingCart className="w-4 h-4" /> Beli Sekarang
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
    queryFn: () => fetch("/api/digital-assets").then(r => r.json()).then((a: DigitalAsset[]) => a.filter(x => x.isActive)),
  });

  const filtered = filterCat === "all" ? assets : assets.filter(a => a.category === filterCat);
  const featured = assets.filter(a => a.isFeatured);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0c", color: "#f5f5f5", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 border-b border-white/8 backdrop-blur-xl" style={{ background: "rgba(10,10,12,0.85)" }}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-4 h-4 text-white/50" />
              <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm" style={{ background: "hsl(20,100%,58%)" }}>F</div>
              <span className="font-black text-white">Frameless Store</span>
            </div>
          </Link>
          <div className="text-sm text-white/50">{assets.length} Products</div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-xs text-white/50 mb-6" style={{ background: "rgba(255,255,255,0.04)" }}>
            <Package className="w-3.5 h-3.5" style={{ color: "hsl(20,100%,58%)" }} />
            Frameless Academy Store
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-4">
            Digital <span style={{ color: "hsl(20,100%,58%)" }}>Assets</span>
          </h1>
          <p className="text-lg text-white/50 max-w-lg mx-auto">
            Presets, LUTs, templates, dan tools kreatif dari tim Frameless Creative.
          </p>
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-2 mb-5">
              <Star className="w-4 h-4" style={{ color: "hsl(20,100%,58%)" }} />
              <span className="text-sm font-bold text-white/80 uppercase tracking-widest">Featured</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {featured.slice(0, 2).map(a => (
                <div key={a.id} onClick={() => setSelectedAsset(a)}
                  className="group relative cursor-pointer rounded-2xl overflow-hidden border border-white/8 hover:border-orange-500/30 transition-all duration-300"
                  style={{ background: "rgba(255,255,255,0.03)" }}>
                  {a.thumbnailUrl && (
                    <div className="h-52 overflow-hidden">
                      <img src={a.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-lg">{a.title}</h3>
                      <span className="font-black text-lg" style={{ color: "hsl(20,100%,58%)" }}>
                        {a.price === 0 ? "Free" : formatCurrency(a.price)}
                      </span>
                    </div>
                    <p className="text-sm text-white/50 line-clamp-2 mb-3">{a.description}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-1 rounded-md capitalize" style={{ background: "rgba(255,255,255,0.08)" }}>{a.category}</span>
                      <span className="text-xs text-white/40 ml-auto flex items-center gap-1">
                        {a.price === 0 ? "Get for free" : "Buy now"} <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
              style={filterCat === c
                ? { background: "hsl(20,100%,58%)", color: "#fff" }
                : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              {CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "hsl(20,100%,58%)", borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map(a => (
              <div key={a.id} onClick={() => setSelectedAsset(a)}
                className="group cursor-pointer rounded-2xl overflow-hidden border border-white/6 hover:border-orange-500/25 transition-all duration-300"
                style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="h-36 overflow-hidden bg-white/5">
                  {a.thumbnailUrl
                    ? <img src={a.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 opacity-20" /></div>
                  }
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-white text-sm mb-1 truncate">{a.title}</h3>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-1.5 py-0.5 rounded capitalize text-white/40" style={{ background: "rgba(255,255,255,0.06)" }}>{a.category}</span>
                    <span className="font-black text-sm" style={{ color: a.price === 0 ? "#4ade80" : "hsl(20,100%,58%)" }}>
                      {a.price === 0 ? "Free" : formatCurrency(a.price)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 text-center py-16 text-white/30">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No assets in this category yet.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAsset && <BuyModal asset={selectedAsset} onClose={() => setSelectedAsset(null)} />}
    </div>
  );
}

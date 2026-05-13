import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit3, Package, Upload, X, Check, Star, Eye } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface DigitalAsset {
  id: string; title: string; description: string; category: string;
  price: number; fileUrl: string; thumbnailUrl: string; previewImages: string;
  isActive: boolean; isFeatured: boolean; downloadCount: number; createdAt: string;
}

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const CATEGORIES = ["preset", "luts", "template", "sfx", "music", "font", "other"];

const CATEGORY_COLORS: Record<string, string> = {
  preset: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  luts: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  template: "bg-green-500/15 text-green-400 border-green-500/25",
  sfx: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  music: "bg-pink-500/15 text-pink-400 border-pink-500/25",
  font: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  other: "bg-muted/30 text-muted-foreground border-muted/40",
};

function UploadImage({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", headers: authHeader() as any, body: form });
      const data = await res.json();
      if (data.url) onChange(data.url);
    } finally { setUploading(false); }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/40 cursor-pointer transition-colors flex items-center justify-center overflow-hidden"
      >
        {value ? (
          <>
            <img src={value} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Upload className="w-5 h-5 text-white" />
            </div>
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            {uploading ? <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto" /> : <Upload className="w-6 h-6 mx-auto mb-1 opacity-40" />}
            <p className="text-[11px]">{uploading ? "Uploading..." : "Click to upload"}</p>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function AssetForm({ initial, onSave, onCancel }: {
  initial?: Partial<DigitalAsset>;
  onSave: (data: Partial<DigitalAsset>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category: initial?.category || "preset",
    price: initial?.price ?? 0,
    fileUrl: initial?.fileUrl || "",
    thumbnailUrl: initial?.thumbnailUrl || "",
    isActive: initial?.isActive ?? true,
    isFeatured: initial?.isFeatured ?? false,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Title</label>
          <Input value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
            className="bg-muted/30 border-border" placeholder="Asset name" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Category</label>
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Price (IDR)</label>
          <Input type="number" value={form.price} onChange={e => setForm(f => ({...f, price: +e.target.value}))}
            className="bg-muted/30 border-border" placeholder="0 = free" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20" placeholder="Asset description..." />
        </div>
      </div>
      <UploadImage label="Thumbnail" value={form.thumbnailUrl} onChange={url => setForm(f => ({...f, thumbnailUrl: url}))} />
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">File URL / Download Link</label>
        <Input value={form.fileUrl} onChange={e => setForm(f => ({...f, fileUrl: e.target.value}))}
          className="bg-muted/30 border-border" placeholder="https://drive.google.com/..." />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({...f, isActive: e.target.checked}))} className="w-4 h-4 accent-primary rounded" />
          <span className="text-sm font-medium text-foreground">Active (visible on store)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isFeatured} onChange={e => setForm(f => ({...f, isFeatured: e.target.checked}))} className="w-4 h-4 accent-primary rounded" />
          <span className="text-sm font-medium text-foreground">Featured</span>
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={() => onSave(form)} className="flex-1 bg-primary hover:bg-primary/90 text-white">
          <Check className="w-4 h-4 mr-2" />{initial?.id ? "Update Asset" : "Create Asset"}
        </Button>
      </div>
    </div>
  );
}

export default function DigitalAssetsAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<DigitalAsset | null>(null);
  const [filterCat, setFilterCat] = useState("all");

  const { data: assets = [], isLoading } = useQuery<DigitalAsset[]>({
    queryKey: ["/api/digital-assets"],
    queryFn: () => fetch("/api/digital-assets", { headers: authHeader() as any }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: Partial<DigitalAsset>) =>
      fetch("/api/digital-assets", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/digital-assets"] }); setShowForm(false); toast({ title: "Asset created" }); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DigitalAsset> }) =>
      fetch(`/api/digital-assets/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/digital-assets"] }); setEditing(null); toast({ title: "Asset updated" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/digital-assets/${id}`, { method: "DELETE", headers: authHeader() as any }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/digital-assets"] }); toast({ title: "Asset deleted" }); },
  });

  const filtered = filterCat === "all" ? assets : assets.filter(a => a.category === filterCat);

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Digital Assets</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage presets, LUTs, templates, and digital products</p>
        </div>
        <div className="flex gap-3">
          <a href="/store" target="_blank" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground border border-border hover:text-foreground hover:bg-muted/50 transition-all">
            <Eye className="w-4 h-4" /> View Store
          </a>
          <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-primary hover:bg-primary/90 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Add Asset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Assets", val: assets.length, color: "text-foreground" },
          { label: "Active", val: assets.filter(a => a.isActive).length, color: "text-green-400" },
          { label: "Featured", val: assets.filter(a => a.isFeatured).length, color: "text-primary" },
          { label: "Free Assets", val: assets.filter(a => a.price === 0).length, color: "text-blue-400" },
        ].map(s => (
          <Card key={s.label} className="glass-panel border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Form */}
      {(showForm || editing) && (
        <Card className="glass-panel border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground">{editing ? `Edit: ${editing.title}` : "New Digital Asset"}</h3>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <AssetForm
              initial={editing || undefined}
              onSave={data => editing ? updateMut.mutate({ id: editing.id, data }) : createMut.mutate(data)}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCat === c ? "bg-primary text-white" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}>
            {c === "all" ? "All" : c.charAt(0).toUpperCase()+c.slice(1)}
            {c !== "all" && <span className="ml-1.5 opacity-60">{assets.filter(a => a.category === c).length}</span>}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(asset => (
            <Card key={asset.id} className={`glass-panel border-border group hover:border-primary/20 transition-all ${!asset.isActive ? "opacity-60" : ""}`}>
              <CardContent className="p-0">
                {asset.thumbnailUrl ? (
                  <div className="relative h-36 overflow-hidden rounded-t-xl">
                    <img src={asset.thumbnailUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {asset.isFeatured && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-primary/90 text-white text-[10px] border-0 gap-1"><Star className="w-2.5 h-2.5" />Featured</Badge>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <Badge className={`text-[10px] border ${CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.other}`}>{asset.category}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="h-24 bg-muted/30 rounded-t-xl flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-foreground text-sm leading-tight">{asset.title}</h3>
                    <span className="text-primary font-black text-sm whitespace-nowrap">
                      {asset.price === 0 ? "Free" : formatCurrency(asset.price)}
                    </span>
                  </div>
                  {asset.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{asset.description}</p>}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${asset.isActive ? "bg-green-400" : "bg-muted-foreground"}`} />
                      <span className="text-[11px] text-muted-foreground">{asset.isActive ? "Active" : "Draft"}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditing(asset); setShowForm(false); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteMut.mutate(asset.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 glass-panel rounded-2xl p-12 text-center">
              <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No assets in this category yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

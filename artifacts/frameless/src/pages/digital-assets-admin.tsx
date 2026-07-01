import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Edit3, Package, Upload, X, Check,
  Star, Eye, EyeOff, Download, FileText, Image, Link,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
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
  preset:   "bg-blue-500/15 text-blue-400 border-blue-500/25",
  luts:     "bg-purple-500/15 text-purple-400 border-purple-500/25",
  template: "bg-green-500/15 text-green-400 border-green-500/25",
  sfx:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  music:    "bg-pink-500/15 text-pink-400 border-pink-500/25",
  font:     "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
  other:    "bg-muted/30 text-muted-foreground border-muted/40",
};

// ── Upload helpers ─────────────────────────────────────────────────────────────
async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res  = await fetch("/api/uploads", { method: "POST", headers: authHeader() as any, body: fd });
  const data = await res.json();
  if (!data.url) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

function UploadField({
  label, value, onChange, accept = "image/*",
  showPreview = true, placeholder = "URL atau upload file...",
}: {
  label: string; value: string; onChange: (url: string) => void;
  accept?: string; showPreview?: boolean; placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try { onChange(await uploadFile(f)); }
    catch (err: any) { alert(err.message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</label>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-muted/30 border-border text-sm flex-1"
        />
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {uploading
            ? <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            : <Upload className="w-3 h-3" />}
          Upload
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
      </div>
      {showPreview && value && value.startsWith("http") && (
        <div className="relative w-full h-24 rounded-xl overflow-hidden border border-border bg-muted/20 mt-1">
          {accept.startsWith("image") ? (
            <img src={value} alt="preview" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
          ) : (
            <div className="w-full h-full flex items-center justify-center gap-2 text-muted-foreground">
              <FileText className="w-5 h-5" />
              <span className="text-xs truncate max-w-45">{value.split("/").pop()}</span>
              <a href={value} target="_blank" rel="noopener noreferrer" className="ml-1"><ExternalLink className="w-3.5 h-3.5" /></a>
            </div>
          )}
          <button
            onClick={() => onChange("")}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-sm hover:bg-red-500/80 transition-colors"
          >×</button>
        </div>
      )}
    </div>
  );
}

// Preview images manager
function PreviewImagesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref      = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const images: string[] = (() => {
    try { const a = JSON.parse(value || "[]"); return Array.isArray(a) ? a.filter(Boolean) : []; }
    catch { return []; }
  })();

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(uploadFile));
      onChange(JSON.stringify([...images, ...urls]));
    } catch (err: any) { alert(err.message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  function remove(idx: number) {
    const next = images.filter((_, i) => i !== idx);
    onChange(JSON.stringify(next));
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
        Preview Images ({images.length})
      </label>
      <div className="grid grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-border group">
            <img src={url} className="w-full h-full object-cover" alt={`Preview ${i + 1}`} />
            <button
              onClick={() => remove(i)}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white hidden group-hover:flex items-center justify-center text-xs hover:bg-red-500/80 transition-colors"
            >×</button>
          </div>
        ))}
        <button
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary disabled:opacity-50 transition-colors"
        >
          {uploading
            ? <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            : <Image className="w-4 h-4" />}
          <span className="text-[10px] font-semibold">Add</span>
        </button>
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
    </div>
  );
}

// ── Asset Form ─────────────────────────────────────────────────────────────────
function AssetForm({ initial, onSave, onCancel }: {
  initial?: Partial<DigitalAsset>;
  onSave: (data: Partial<DigitalAsset>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title:          initial?.title         || "",
    description:    initial?.description   || "",
    category:       initial?.category      || "preset",
    price:          initial?.price         ?? 0,
    fileUrl:        initial?.fileUrl       || "",
    thumbnailUrl:   initial?.thumbnailUrl  || "",
    previewImages:  initial?.previewImages || "[]",
    isActive:       initial?.isActive      ?? true,
    isFeatured:     initial?.isFeatured    ?? false,
  });

  const set = (k: string) => (v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="space-y-5">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Aset *</label>
          <Input value={form.title} onChange={e => set("title")(e.target.value)}
            className="bg-muted/30 border-border" placeholder="Nama aset digital..." />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kategori</label>
          <select value={form.category} onChange={e => set("category")(e.target.value)}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-card">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Harga (IDR)</label>
          <Input type="number" value={form.price} onChange={e => set("price")(+e.target.value)}
            className="bg-muted/30 border-border" placeholder="0 = gratis" min={0} />
          <p className="text-[10px] text-muted-foreground">0 = Gratis (download langsung)</p>
        </div>
        <div className="col-span-2 space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi</label>
          <textarea value={form.description} onChange={e => set("description")(e.target.value)}
            className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20 focus:outline-none focus:border-primary/40 transition-colors"
            placeholder="Jelaskan isi aset, cocok untuk apa, format file, dsb..." />
        </div>
      </div>

      {/* Thumbnail */}
      <UploadField
        label="Thumbnail / Cover Image"
        value={form.thumbnailUrl}
        onChange={set("thumbnailUrl")}
        accept="image/*"
        showPreview
        placeholder="URL gambar atau upload..."
      />

      {/* File aset */}
      <UploadField
        label="File Aset (download link)"
        value={form.fileUrl}
        onChange={set("fileUrl")}
        accept=".zip,.rar,.pdf,.lut,.cube,.xmp,.preset,.png,.jpg,.mp3,.wav,.ttf,.otf,*"
        showPreview
        placeholder="Upload file atau paste Google Drive / Dropbox link..."
      />

      {/* Preview images */}
      <PreviewImagesField
        value={form.previewImages}
        onChange={set("previewImages")}
      />

      {/* Toggles */}
      <div className="flex items-center gap-6 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={e => set("isActive")(e.target.checked)}
            className="w-4 h-4 accent-primary rounded" />
          <span className="text-sm font-semibold text-foreground">Aktif (tampil di store)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isFeatured} onChange={e => set("isFeatured")(e.target.checked)}
            className="w-4 h-4 accent-primary rounded" />
          <span className="text-sm font-semibold text-foreground">Featured ⭐</span>
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="ghost" onClick={onCancel} className="flex-1 rounded-xl">Batal</Button>
        <Button onClick={() => onSave(form)} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
          <Check className="w-4 h-4 mr-2" />
          {initial?.id ? "Simpan Perubahan" : "Tambah Aset"}
        </Button>
      </div>
    </div>
  );
}


export default function DigitalAssetsAdminPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<DigitalAsset | null>(null);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch]       = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: assets = [], isLoading } = useQuery<DigitalAsset[]>({
    queryKey: ["/api/digital-assets"],
    queryFn:  () => fetch("/api/digital-assets", { headers: authHeader() as any }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: Partial<DigitalAsset>) =>
      fetch("/api/digital-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/digital-assets"] });
      setShowForm(false);
      toast({ title: "Aset baru ditambahkan", className: "border-emerald-500/25 bg-[#08150e] text-white" });
    },
    onError: () => toast({ variant: "destructive", title: "Gagal menambah aset" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DigitalAsset> }) =>
      fetch(`/api/digital-assets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/digital-assets"] });
      setEditing(null);
      toast({ title: "Aset diperbarui", className: "border-emerald-500/25 bg-[#08150e] text-white" });
    },
    onError: () => toast({ variant: "destructive", title: "Gagal memperbarui aset" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/digital-assets/${id}`, { method: "DELETE", headers: authHeader() as any }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/digital-assets"] });
      toast({ title: "Aset dihapus" });
    },
  });

  async function toggleActive(asset: DigitalAsset) {
    await fetch(`/api/digital-assets/${asset.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify({ isActive: !asset.isActive }),
    });
    qc.invalidateQueries({ queryKey: ["/api/digital-assets"] });
  }

  const totalRevenue = assets
    .filter(a => a.price > 0 && a.downloadCount > 0)
    .reduce((acc, a) => acc + a.price * a.downloadCount, 0);

  const filtered = assets.filter(a => {
    const matchCat    = filterCat === "all" || a.category === filterCat;
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Digital Assets Store</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola produk digital — preset, LUT, template, dan aset kreatif lainnya</p>
        </div>
        <div className="flex gap-3">
          <a href="/store" target="_blank"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground border border-border hover:text-foreground hover:bg-muted/50 transition-all">
            <Eye className="w-4 h-4" /> Lihat Store
          </a>
          <Button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-primary hover:bg-primary/90 text-white rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Tambah Aset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Aset",   val: assets.length,                             color: "text-foreground" },
          { label: "Aktif",        val: assets.filter(a => a.isActive).length,      color: "text-green-400" },
          { label: "Featured",     val: assets.filter(a => a.isFeatured).length,    color: "text-primary" },
          { label: "Gratis",       val: assets.filter(a => a.price === 0).length,   color: "text-blue-400" },
          { label: "Est. Revenue", val: totalRevenue > 0 ? formatCurrency(totalRevenue) : "—", color: "text-emerald-400" },
        ].map(s => (
          <Card key={s.label} className="glass-panel border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add / Edit Form */}
      {(showForm || editing) && (
        <Card className="glass-panel border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {editing ? `Edit: ${editing.title}` : "Tambah Aset Baru"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {editing ? "Ubah detail aset digital" : "Upload thumbnail, file aset, dan atur harga"}
                </p>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditing(null); }}
                className="text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Filters + Search */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari aset..."
          className="bg-muted/30 border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 transition-colors min-w-48"
        />
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...CATEGORIES].map(c => (
            <button
              key={c}
              onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterCat === c ? "bg-primary/15 text-primary border border-primary/25" : "bg-muted/30 text-muted-foreground hover:text-foreground border border-transparent"
              }`}>
              {c === "all" ? "Semua" : c.charAt(0).toUpperCase() + c.slice(1)}
              {c !== "all" && (
                <span className="ml-1.5 opacity-60">{assets.filter(a => a.category === c).length}</span>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground ml-auto">{filtered.length} aset</p>
      </div>

      {/* Asset grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(asset => {
            const previewImgs: string[] = (() => {
              try { const a = JSON.parse(asset.previewImages || "[]"); return Array.isArray(a) ? a : []; }
              catch { return []; }
            })();
            const isExpanded = expandedId === asset.id;

            return (
              <Card
                key={asset.id}
                className={`glass-panel border-border group transition-all ${!asset.isActive ? "opacity-55" : "hover:border-primary/20"}`}>
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="relative h-40 overflow-hidden rounded-t-xl bg-muted/20">
                    {asset.thumbnailUrl ? (
                      <img src={asset.thumbnailUrl} alt={asset.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-muted-foreground/25" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

                    {/* Badges */}
                    <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                      {asset.isFeatured && (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/90 text-white font-bold">⭐ Featured</span>
                      )}
                      <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${CATEGORY_COLORS[asset.category] || CATEGORY_COLORS.other}`}>
                        {asset.category}
                      </span>
                    </div>

                    {/* Price + status */}
                    <div className="absolute bottom-2 right-2 flex gap-1.5 items-center">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${asset.price === 0 ? "bg-green-500/20 text-green-400" : "bg-primary/20 text-primary"}`}>
                        {asset.price === 0 ? "GRATIS" : formatCurrency(asset.price)}
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2">
                      <div className={`w-2 h-2 rounded-full ${asset.isActive ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,.6)]" : "bg-gray-500"}`} />
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    <h3 className="font-bold text-foreground text-sm mb-1 truncate">{asset.title}</h3>
                    {asset.description && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">{asset.description}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Download className="w-3 h-3" /> {asset.downloadCount || 0} downloads
                      </span>
                      {asset.fileUrl && (
                        <a href={asset.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary/70 hover:text-primary transition-colors">
                          <Link className="w-3 h-3" /> File
                        </a>
                      )}
                      {previewImgs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Image className="w-3 h-3" /> {previewImgs.length} preview
                        </span>
                      )}
                    </div>

                    {/* Preview images strip */}
                    {previewImgs.length > 0 && isExpanded && (
                      <div className="flex gap-1.5 mb-3 flex-wrap">
                        {previewImgs.slice(0, 6).map((url, i) => (
                          <img key={i} src={url} alt={`Preview ${i+1}`}
                            className="w-12 h-12 rounded-lg object-cover border border-border" />
                        ))}
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <button
                        onClick={() => toggleActive(asset)}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors font-semibold ${
                          asset.isActive
                            ? "text-muted-foreground border-border hover:text-foreground bg-muted/20"
                            : "text-green-400 border-green-500/25 bg-green-500/8 hover:bg-green-500/12"
                        }`}>
                        {asset.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {asset.isActive ? "Sembunyikan" : "Aktifkan"}
                      </button>

                      {previewImgs.length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5">
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      )}

                      <div className="ml-auto flex gap-1.5">
                        <button
                          onClick={() => { setEditing(asset); setShowForm(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Hapus "${asset.title}"?`)) deleteMut.mutate(asset.id); }}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add new card placeholder */}
          <button
            onClick={() => { setEditing(null); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/5 hover:bg-primary/4 transition-all flex flex-col items-center justify-center gap-3 p-8 text-muted-foreground hover:text-primary min-h-55">
            <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-sm font-semibold">Tambah Aset Baru</span>
          </button>

          {filtered.length === 0 && !isLoading && (
            <div className="col-span-3 glass-panel rounded-2xl p-14 text-center">
              <Package className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">
                {search ? `Tidak ada aset untuk "${search}"` : "Belum ada aset di kategori ini."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
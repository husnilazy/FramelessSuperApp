import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Upload, Play, Trash2, Plus, X, Image, Video, Globe, Settings2, Tag, Palette, Users2 } from "lucide-react";

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type CmsValue = string | boolean;

/* ─── UPLOAD BUTTON ─── */
function UploadBtn({ value, onChange, label, accept }: { value: string; onChange: (url: string) => void; label?: string; accept?: string }) {
  const ref = useRef<HTMLInputElement>(null);
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
    <div className="flex gap-2 items-start">
      <div className="flex-1">
        <Input value={value} onChange={e => onChange(e.target.value)} className="bg-muted/30 border-border text-sm" placeholder="URL atau upload file..." />
      </div>
      <button type="button" onClick={() => ref.current?.click()}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all whitespace-nowrap">
        {uploading ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {label || "Upload"}
      </button>
      <input ref={ref} type="file" accept={accept || "image/*"} className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ─── CMS CONTENT FIELDS ─── */
const CMS_SECTIONS = [
  {
    id: "branding", label: "Branding & Logo", icon: Globe,
    fields: [
      { key: "logoUrl", label: "Logo (file upload atau URL)", type: "upload" as const },
      { key: "logoSize", label: "Ukuran Logo (px, 20–80)", type: "number" as const },
    ],
  },
  {
    id: "hero", label: "Hero Section", icon: Globe,
    fields: [
      { key: "headline1", label: "Headline Baris 1", type: "text" as const },
      { key: "headline2", label: "Headline Baris 2 (orange)", type: "text" as const },
      { key: "headline3", label: "Headline Baris 3", type: "text" as const },
      { key: "subtitle", label: "Subtitle / Deskripsi", type: "textarea" as const },
      { key: "cta1", label: "CTA Utama", type: "text" as const },
      { key: "cta2", label: "CTA Kedua", type: "text" as const },
      { key: "bannerVideoUrl", label: "URL Banner Video Autoplay (YouTube/MP4, tampil setelah hero)", type: "text" as const },
    ],
  },
  {
    id: "theme", label: "Tema & Animasi", icon: Palette,
    fields: [
      { key: "meshColor1", label: "Warna Mesh 1 (kiri atas, default orange)", type: "color" as const },
      { key: "meshColor2", label: "Warna Mesh 2 (kanan, default ungu)", type: "color" as const },
      { key: "meshColor3", label: "Warna Mesh 3 (bawah, default biru)", type: "color" as const },
    ],
  },
  {
    id: "stats", label: "Statistics", icon: Settings2,
    fields: [
      { key: "projects", label: "Total Projects", type: "text" as const },
      { key: "clients", label: "Total Clients", type: "text" as const },
      { key: "years", label: "Years Active", type: "text" as const },
    ],
  },
  {
    id: "contact", label: "Contact Info", icon: Globe,
    fields: [
      { key: "whatsapp", label: "WhatsApp (tanpa +)", type: "text" as const },
      { key: "email", label: "Email", type: "text" as const },
      { key: "desc", label: "Call to Action Text", type: "textarea" as const },
    ],
  },
  {
    id: "crew", label: "Crew Portal", icon: Users2,
    fields: [
      { key: "logoUrl", label: "Custom Logo untuk Crew Dashboard (opsional, pakai site-logos jika kosong)", type: "upload" as const },
      { key: "welcomeMessage", label: "Pesan Sambutan (muncul di bawah nama crew)", type: "text" as const },
      { key: "footerNote", label: "Footer Note (opsional)", type: "text" as const },
      { key: "allowCrewPhotoUpload", label: "Izinkan crew upload foto profil sendiri", type: "boolean" as const },
      { key: "showProfileInfo", label: "Tampilkan info profil lengkap (email, dept, dll)", type: "boolean" as const },
    ],
  },
];

/* ─── SITE VIDEOS ─── */
interface SiteVideo { id: string; title: string; description: string; embedUrl: string; thumbnailUrl: string; category: string; tags: string; isActive: boolean; orderIndex: number; }

const VIDEO_CATEGORIES = [
  { v: "showreel", l: "Showreel (play button di landing)" },
  { v: "portfolio", l: "Portfolio (grid di landing)" },
  { v: "background", l: "Background (hero bg)" },
  { v: "behind-the-frame", l: "Behind the Frame (Section)" },
];

/* ─── SERVICES ─── */
interface ServiceItem {
  icon: string; title: string; description: string; tags: string[]; slug: string;
  price?: string; duration?: string; features?: string[]; longDescription?: string;
  portfolioCategory?: string; highlightVideoUrl?: string;
}

const EMPTY_SERVICE: ServiceItem = {
  icon: "🎬", title: "", description: "", tags: [], slug: "",
  price: "", duration: "", features: [], longDescription: "",
  portfolioCategory: "", highlightVideoUrl: "",
};

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-");
}

function isDirectVideoFile(url?: string) {
  return !!url && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url);
}

function ServicesTab() {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<ServiceItem>(EMPTY_SERVICE);
  const [tagsInput, setTagsInput] = useState("");
  const [featuresInput, setFeaturesInput] = useState("");

  useEffect(() => {
    fetch("/api/cms").then(r => r.json()).then((data: Record<string, Record<string, string>>) => {
      try { setServices(JSON.parse(data?.services?.items || "[]")); } catch { setServices([]); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function resetForm(svc?: ServiceItem, idx?: number) {
    if (svc) {
      setForm(svc);
      setTagsInput((svc.tags || []).join(", "));
      setFeaturesInput((svc.features || []).join("\n"));
      setEditIdx(idx ?? null);
    } else {
      setForm(EMPTY_SERVICE);
      setTagsInput("");
      setFeaturesInput("");
      setEditIdx(null);
    }
    setShowForm(true);
  }

  async function persist(next: ServiceItem[]) {
    setSaving(true);
    try {
      const res = await fetch("/api/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify([{ section: "services", key: "items", value: JSON.stringify(next) }]),
      });
      if (res.ok) {
        setServices(next);
        toast({ title: "Layanan tersimpan" });
        return true;
      }
      toast({ variant: "destructive", title: "Gagal menyimpan" });
      return false;
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan" });
      return false;
    } finally { setSaving(false); }
  }

  async function handleSave() {
    if (!form.title) { toast({ variant: "destructive", title: "Judul layanan wajib diisi" }); return; }
    const payload: ServiceItem = {
      ...form,
      slug: form.slug || slugify(form.title),
      tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      features: featuresInput.split("\n").map(f => f.trim()).filter(Boolean),
    };
    const next = editIdx !== null
      ? services.map((s, i) => (i === editIdx ? payload : s))
      : [...services, payload];
    const ok = await persist(next);
    if (ok) { setShowForm(false); setEditIdx(null); }
  }

  async function handleDelete(idx: number) {
    const next = services.filter((_, i) => i !== idx);
    await persist(next);
  }

  async function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= services.length) return;
    const next = [...services];
    [next[idx], next[target]] = [next[target], next[idx]];
    await persist(next);
  }

  if (loading) return <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kelola layanan, harga, dan video highlight yang tampil di halaman Layanan & landing page.</p>
        <Button onClick={() => resetForm()} className="bg-primary hover:bg-primary/90 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Tambah Layanan
        </Button>
      </div>

      {showForm && (
        <Card className="glass-panel border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground">{editIdx !== null ? "Edit Layanan" : "Tambah Layanan Baru"}</h4>
              <button onClick={() => { setShowForm(false); setEditIdx(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Layanan</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-muted/30 border-border" placeholder="Commercial Video" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Slug (kosongkan = otomatis)</label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="bg-muted/30 border-border" placeholder="commercial-video" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Icon (emoji)</label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} className="bg-muted/30 border-border" placeholder="🎬" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Estimasi Harga</label>
                <Input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="bg-muted/30 border-border" placeholder="Rp 5.000.000+" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Durasi Pengerjaan</label>
                <Input value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} className="bg-muted/30 border-border" placeholder="3-14 hari" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kategori Portfolio (untuk matching video)</label>
                <Input value={form.portfolioCategory} onChange={e => setForm(f => ({ ...f, portfolioCategory: e.target.value }))} className="bg-muted/30 border-border" placeholder="commercial-video" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Singkat</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-muted/30 border-border" placeholder="Iklan TV, digital ads, dan brand video..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Lengkap (opsional, untuk halaman detail)</label>
                <textarea value={form.longDescription} onChange={e => setForm(f => ({ ...f, longDescription: e.target.value }))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tags (pisah koma)</label>
                <Input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="bg-muted/30 border-border" placeholder="TVC, Digital Ads, Brand Story" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Fitur / Yang Didapat (1 per baris)</label>
                <textarea value={featuresInput} onChange={e => setFeaturesInput(e.target.value)} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none h-24" placeholder={"Konsultasi konsep gratis\nTim produksi lengkap\nRevisi 3x"} />
              </div>

              {/* Highlight Video — upload langsung, autoplay di card layanan */}
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Video Highlight (autoplay di card Layanan)</label>
                <UploadBtn value={form.highlightVideoUrl || ""} onChange={url => setForm(f => ({ ...f, highlightVideoUrl: url }))} label="Upload Video" accept="video/*" />
                <p className="text-[11px] text-muted-foreground">Upload file video (mp4/webm) untuk autoplay muted-loop di card layanan, atau tempel link YouTube sebagai fallback.</p>
                {form.highlightVideoUrl && isDirectVideoFile(form.highlightVideoUrl) && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "16/9", maxWidth: 320 }}>
                    <video src={form.highlightVideoUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditIdx(null); }} className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {saving ? "Saving..." : (editIdx !== null ? "Update Layanan" : "Simpan Layanan")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {services.map((s, idx) => (
          <div key={s.slug || idx} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-all">
            <div className="w-16 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0 flex items-center justify-center relative">
              {s.highlightVideoUrl && isDirectVideoFile(s.highlightVideoUrl) ? (
                <video src={s.highlightVideoUrl} muted loop autoPlay playsInline className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg">{s.icon || "🎬"}</span>
              )}
              {s.highlightVideoUrl && <div className="absolute bottom-0.5 right-0.5 bg-primary rounded-full p-0.5"><Video className="w-2 h-2 text-white" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-foreground truncate">{s.title}</div>
              <div className="text-xs text-muted-foreground truncate">{s.description}</div>
            </div>
            {s.price && <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 whitespace-nowrap shrink-0">{s.price}</span>}
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleMove(idx, -1)} disabled={idx === 0} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-25">↑</button>
              <button onClick={() => handleMove(idx, 1)} disabled={idx === services.length - 1} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-25">↓</button>
              <button onClick={() => resetForm(s, idx)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Settings2 className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleDelete(idx)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
        {services.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Tag className="w-8 h-8 mx-auto mb-2 opacity-25" />
            Belum ada layanan custom. Halaman akan menampilkan layanan default bawaan sistem.
          </div>
        )}
      </div>
    </div>
  );
}

function VideosTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SiteVideo | null>(null);
  const [form, setForm] = useState({ title: "", description: "", embedUrl: "", thumbnailUrl: "", category: "portfolio", tags: "", isActive: true, orderIndex: 0 });

  const { data: videos = [], isLoading } = useQuery<SiteVideo[]>({
    queryKey: ["/api/site-videos"], queryFn: () => fetch("/api/site-videos", { headers: authHeader() as any }).then(r => r.json()),
  });

  function resetForm(v?: SiteVideo) {
    if (v) { setForm({ title: v.title, description: v.description || "", embedUrl: v.embedUrl, thumbnailUrl: v.thumbnailUrl || "", category: v.category, tags: (() => { try { return JSON.parse(v.tags || "[]").join(", "); } catch { return ""; } })(), isActive: v.isActive ?? true, orderIndex: v.orderIndex || 0 }); setEditing(v); }
    else { setForm({ title: "", description: "", embedUrl: "", thumbnailUrl: "", category: "portfolio", tags: "", isActive: true, orderIndex: 0 }); setEditing(null); }
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: async (data: typeof form) => {
      const payload = { ...data, tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [] };
      const url = editing ? `/api/site-videos/${editing.id}` : "/api/site-videos";
      return fetch(url, { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(payload) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/site-videos"] }); setShowForm(false); setEditing(null); toast({ title: editing ? "Video updated" : "Video added" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/site-videos/${id}`, { method: "DELETE", headers: authHeader() as any }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/site-videos"] }); toast({ title: "Video deleted" }); },
  });

  function getYtThumb(url: string) { if (!url) return null; const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/); return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null; }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kelola video untuk showreel, portfolio, background, dan Behind the Frame.</p>
        <Button onClick={() => resetForm()} className="bg-primary hover:bg-primary/90 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Tambah Video
        </Button>
      </div>

      {showForm && (
        <Card className="glass-panel border-border">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground">{editing ? "Edit Video" : "Tambah Video Baru"}</h4>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Title</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="bg-muted/30 border-border" placeholder="Nama video" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kategori</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                  {VIDEO_CATEGORIES.map(c => <option key={c.v} value={c.v} className="bg-card">{c.l}</option>)}
                </select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">YouTube / Vimeo / Video File URL</label>
                <UploadBtn value={form.embedUrl} onChange={url => setForm(f => ({ ...f, embedUrl: url }))} label="Upload Video" accept="video/*" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Thumbnail Video (opsional, otomatis jika YouTube)</label>
                <UploadBtn value={form.thumbnailUrl} onChange={url => setForm(f => ({ ...f, thumbnailUrl: url }))} label="Upload Image" accept="image/*" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tags (pisah koma, untuk filter portfolio)</label>
                <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} className="bg-muted/30 border-border" placeholder="Commercial, Music Video, Short Film" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi (opsional)</label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="bg-muted/30 border-border" placeholder="Deskripsi singkat..." />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="w-4 h-4 accent-primary rounded" />
              <span className="text-sm font-medium text-foreground">Tampilkan di landing page</span>
            </label>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditing(null); }} className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {saveMut.isPending ? "Saving..." : (editing ? "Update Video" : "Simpan Video")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {videos.map(v => {
            const thumb = v.thumbnailUrl || getYtThumb(v.embedUrl) || null;
            const catLabel = VIDEO_CATEGORIES.find(c => c.v === v.category)?.l.split(" (")[0] || v.category;
            return (
              <div key={v.id} className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-all ${!v.isActive ? "opacity-50" : ""}`}>
                <div className="w-16 h-10 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                  {thumb ? <img src={thumb} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Play className="w-4 h-4 text-muted-foreground/30" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{v.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{v.embedUrl}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/30 text-muted-foreground border border-border whitespace-nowrap">{catLabel}</span>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => resetForm(v)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Settings2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteMut.mutate(v.id)} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
          {videos.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Video className="w-8 h-8 mx-auto mb-2 opacity-25" />
              Belum ada video. Tambah video pertamu!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── LOGOS TAB ─── */
interface SiteLogo { id: string; name: string; imageUrl: string; isActive: boolean; orderIndex: number; }

function LogosTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", imageUrl: "", isActive: true });
  const [showForm, setShowForm] = useState(false);

  const { data: logos = [], isLoading } = useQuery<SiteLogo[]>({
    queryKey: ["/api/site-logos"], queryFn: () => fetch("/api/site-logos", { headers: authHeader() as any }).then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => fetch("/api/site-logos", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(data) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/site-logos"] }); setShowForm(false); setForm({ name: "", imageUrl: "", isActive: true }); toast({ title: "Logo added" }); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/site-logos/${id}`, { method: "DELETE", headers: authHeader() as any }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/site-logos"] }); toast({ title: "Logo deleted" }); },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => fetch(`/api/site-logos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify({ isActive }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/site-logos"] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Logo klien yang muncul di marquee berjalan otomatis di landing page.</p>
        <Button onClick={() => setShowForm(s => !s)} className="bg-primary hover:bg-primary/90 text-white rounded-xl text-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Tambah Logo
        </Button>
      </div>

      {showForm && (
        <Card className="glass-panel border-border">
          <CardContent className="p-5 space-y-4">
            <h4 className="font-bold text-foreground">Tambah Logo Klien</h4>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nama Brand/Klien</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="bg-muted/30 border-border" placeholder="Nama perusahaan" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Logo (upload file atau URL)</label>
              <UploadBtn value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} label="Upload Logo" />
            </div>
            {form.imageUrl && (
              <div className="p-3 rounded-xl bg-black border border-border flex items-center justify-center h-16">
                <img src={form.imageUrl} alt="preview" style={{ maxHeight: "100%", maxWidth: "100%", filter: "brightness(0) invert(1)", objectFit: "contain" }} />
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowForm(false)} className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name || !form.imageUrl} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {createMut.isPending ? "Saving..." : "Simpan Logo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {logos.map(logo => (
            <div key={logo.id} className={`group p-4 rounded-xl border border-border bg-card/50 hover:bg-card/80 transition-all ${!logo.isActive ? "opacity-40" : ""}`}>
              <div className="h-12 flex items-center justify-center mb-3 bg-black/30 rounded-lg" style={{ filter: "brightness(0) invert(1)" }}>
                <img src={logo.imageUrl} alt={logo.name} className="max-h-full max-w-full object-contain" />
              </div>
              <p className="text-xs font-semibold text-foreground text-center truncate mb-2">{logo.name}</p>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                <button onClick={() => toggleMut.mutate({ id: logo.id, isActive: !logo.isActive })} className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors ${logo.isActive ? "bg-green-500/15 text-green-400" : "bg-muted/30 text-muted-foreground"}`}>
                  {logo.isActive ? "Aktif" : "Nonaktif"}
                </button>
                <button onClick={() => deleteMut.mutate(logo.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          {logos.length === 0 && (
            <div className="col-span-4 text-center py-10 text-muted-foreground text-sm">
              <Image className="w-8 h-8 mx-auto mb-2 opacity-25" />
              Belum ada logo klien.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── CONTENT TAB ─── */
function ContentTab() {
  const { toast } = useToast();
  const [activeSec, setActiveSec] = useState("branding");
  const [vals, setVals] = useState<Record<string, Record<string, CmsValue>>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cms").then(r => r.json()).then((data: Record<string, Record<string, CmsValue>>) => {
      setVals(data || {});
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  function set(section: string, key: string, value: CmsValue) {
    setVals(prev => ({ ...prev, [section]: { ...(prev[section] || {}), [key]: value } }));
  }

  function valueAsString(value: CmsValue | undefined) {
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }

  function valueAsBoolean(value: CmsValue | undefined) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() !== "false";
    return true;
  }

  async function save() {
    setSaving(true);
    try {
      const updates: { section: string; key: string; value: string }[] = [];
      for (const [section, fields] of Object.entries(vals)) {
        for (const [key, value] of Object.entries(fields)) {
          updates.push({ section, key, value: String(value) });
        }
      }
      const res = await fetch("/api/cms", { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(updates) });
      if (res.ok) toast({ title: "Content saved successfully" });
      else toast({ variant: "destructive", title: "Failed to save" });
    } finally { setSaving(false); }
  }

  const sec = CMS_SECTIONS.find(s => s.id === activeSec);

  if (loading) return <div className="flex items-center justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-3 space-y-1">
        {CMS_SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSec(s.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all ${activeSec === s.id ? "bg-primary/10 border border-primary/20 text-primary" : "text-muted-foreground hover:bg-muted/40 border border-transparent"}`}>
            <s.icon className="w-4 h-4 shrink-0" />
            <span className="text-[13px] font-medium">{s.label}</span>
          </button>
        ))}
      </div>
      <div className="col-span-9">
        {sec && (
          <Card className="glass-panel border-border">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-foreground">{sec.label}</h3>
                <Button onClick={save} disabled={saving} size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-xl">
                  <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Saving..." : "Save"}
                </Button>
              </div>
              {sec.fields.map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{f.label}</label>
                  {f.type === "color" ? (
                    <div className="flex items-center gap-3">
                      <input type="color" value={valueAsString(vals[sec.id]?.[f.key]) || "#ff6b35"} onChange={e => set(sec.id, f.key, e.target.value)}
                        className="w-12 h-10 rounded-lg border border-border cursor-pointer bg-muted/30" />
                      <Input value={valueAsString(vals[sec.id]?.[f.key])} onChange={e => set(sec.id, f.key, e.target.value)} className="bg-muted/30 border-border flex-1" placeholder="#ff6b35" />
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: valueAsString(vals[sec.id]?.[f.key]) || "transparent", border: "1px solid rgba(255,255,255,0.15)", flexShrink: 0 }} />
                    </div>
                  ) : f.type === "upload" ? (
                    <>
                      <UploadBtn value={valueAsString(vals[sec.id]?.[f.key])} onChange={url => set(sec.id, f.key, url)} label="Upload File" />
                      {vals[sec.id]?.[f.key] && f.key === "logoUrl" && (
                        <div className="mt-2 p-4 bg-black/70 rounded-xl flex items-center justify-center h-16 border border-border">
                          <img src={valueAsString(vals[sec.id]?.[f.key])} alt="logo preview" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }} />
                        </div>
                      )}
                    </>
                  ) : f.type === "textarea" ? (
                    <textarea value={valueAsString(vals[sec.id]?.[f.key])} onChange={e => set(sec.id, f.key, e.target.value)}
                      className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none h-20" />
                  ) : f.type === "boolean" ? (
                    <input 
                      type="checkbox" 
                      checked={valueAsBoolean(vals[sec.id]?.[f.key])} 
                      onChange={e => set(sec.id, f.key, e.target.checked)} 
                      className="w-4 h-4 accent-primary rounded" 
                    />
                  ) : (
                    <Input type={f.type === "number" ? "number" : "text"} value={valueAsString(vals[sec.id]?.[f.key])} onChange={e => set(sec.id, f.key, e.target.value)} className="bg-muted/30 border-border" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ─── MAIN ─── */
export default function CmsEditorPage() {
  const [activeTab, setActiveTab] = useState<"content" | "services" | "videos" | "logos">("content");

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">CMS Editor</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola konten, video, dan logo landing page Frameless Creative</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-border w-fit">
        {([["content", "📝 Konten"], ["services", "🛠️ Layanan"], ["videos", "🎬 Videos"], ["logos", "🏢 Logo Klien"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === t ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {activeTab === "content" && <ContentTab />}
      {activeTab === "services" && <ServicesTab />}
      {activeTab === "videos" && <VideosTab />}
      {activeTab === "logos" && <LogosTab />}
    </div>
  );
}
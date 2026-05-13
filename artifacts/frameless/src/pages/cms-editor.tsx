import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Globe, Layout, BookOpen, Phone, FileText, Settings2, Plus, Trash2, RefreshCw } from "lucide-react";

interface CmsSection {
  section: string; label: string; icon: any;
  fields: { key: string; label: string; type: "text" | "textarea" | "url" | "json" }[];
}

const SECTIONS: CmsSection[] = [
  {
    section: "general", label: "Umum", icon: Settings2,
    fields: [
      { key: "siteName", label: "Nama Situs", type: "text" },
      { key: "logoUrl", label: "URL Logo", type: "url" },
    ],
  },
  {
    section: "hero", label: "Hero Section", icon: Layout,
    fields: [
      { key: "tagline", label: "Tagline (badge atas)", type: "text" },
      { key: "heading", label: "Heading Utama (Enter untuk baris baru)", type: "textarea" },
      { key: "subheading", label: "Subheading", type: "textarea" },
      { key: "cta", label: "Teks Tombol Utama", type: "text" },
      { key: "ctaSecondary", label: "Teks Tombol Kedua", type: "text" },
    ],
  },
  {
    section: "about", label: "Tentang Kami", icon: FileText,
    fields: [
      { key: "heading", label: "Judul", type: "text" },
      { key: "body", label: "Deskripsi Perusahaan", type: "textarea" },
      { key: "mission", label: "Pernyataan Misi", type: "textarea" },
    ],
  },
  {
    section: "services", label: "Layanan", icon: Globe,
    fields: [
      { key: "heading", label: "Judul Seksi", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
      { key: "items", label: "Items (JSON array: [{icon,title,desc}])", type: "json" },
    ],
  },
  {
    section: "courses", label: "Course Section", icon: BookOpen,
    fields: [
      { key: "heading", label: "Judul Course Section", type: "text" },
      { key: "subtitle", label: "Subtitle", type: "text" },
    ],
  },
  {
    section: "stats", label: "Statistik", icon: Layout,
    fields: [
      { key: "clients", label: "Jumlah Klien", type: "text" },
      { key: "projects", label: "Jumlah Proyek", type: "text" },
      { key: "years", label: "Tahun Berpengalaman", type: "text" },
      { key: "awards", label: "Penghargaan", type: "text" },
    ],
  },
  {
    section: "contact", label: "Kontak", icon: Phone,
    fields: [
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Telepon", type: "text" },
      { key: "address", label: "Alamat", type: "text" },
      { key: "instagram", label: "Instagram", type: "text" },
      { key: "youtube", label: "YouTube", type: "text" },
    ],
  },
  {
    section: "footer", label: "Footer", icon: FileText,
    fields: [
      { key: "tagline", label: "Tagline Footer", type: "text" },
      { key: "copyright", label: "Teks Copyright", type: "text" },
    ],
  },
];

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CmsEditorPage() {
  const { toast } = useToast();
  const [data, setData] = useState<Record<string, Record<string, string>>>({});
  const [activeSection, setActiveSection] = useState("general");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cms").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const set = (section: string, key: string, value: string) => {
    setData(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any[] = [];
      for (const section in data) {
        for (const key in data[section]) {
          updates.push({ section, key, value: data[section][key] });
        }
      }
      const res = await fetch("/api/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      toast({ title: "CMS tersimpan! Landing page diperbarui." });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan" });
    } finally { setSaving(false); }
  };

  const sec = SECTIONS.find(s => s.section === activeSection)!;
  const secData = data[activeSection] || {};

  return (
    <div className="pb-12 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading tracking-wider text-white">CMS Editor</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">Edit konten landing page secara dinamis</p>
        </div>
        <div className="flex gap-3">
          <a href="/" target="_blank">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              <Globe className="w-4 h-4 mr-2" /> Lihat Landing Page
            </Button>
          </a>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 font-heading tracking-wider">
            <Save className="w-4 h-4 mr-2" />{saving ? "Menyimpan..." : "Simpan Semua"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Section Nav */}
        <div className="glass-panel rounded-xl p-3 border-white/10 space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.section}
              onClick={() => setActiveSection(s.section)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${activeSection === s.section ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-white hover:bg-white/5"}`}
            >
              <s.icon className="w-4 h-4" />{s.label}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="xl:col-span-3 glass-panel rounded-xl p-6 border-white/10 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/10">
            <sec.icon className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-white">{sec.label}</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            sec.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{f.label}</label>
                {f.type === "textarea" || f.type === "json" ? (
                  <Textarea
                    value={secData[f.key] || ""}
                    onChange={e => set(activeSection, f.key, e.target.value)}
                    className={`bg-white/5 border-white/10 text-white resize-none ${f.type === "json" ? "font-mono text-xs" : ""}`}
                    rows={f.type === "json" ? 8 : 3}
                    placeholder={f.type === "json" ? '[{"icon":"Film","title":"...","desc":"..."}]' : ""}
                  />
                ) : (
                  <Input
                    type={f.type}
                    value={secData[f.key] || ""}
                    onChange={e => set(activeSection, f.key, e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                )}
              </div>
            ))
          )}

          <div className="pt-4 border-t border-white/10 flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 font-heading tracking-wider">
              <Save className="w-4 h-4 mr-2" />{saving ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

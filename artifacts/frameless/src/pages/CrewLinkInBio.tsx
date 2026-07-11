// artifacts/frameless/src/pages/CrewLinkInBio.tsx
// Full Link-in-Bio + Sub-Pages management UI for crew dashboard

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Globe, Instagram, Youtube, Twitter, Link2, Plus, Trash2, GripVertical,
  Eye, EyeOff, Copy, Check, Upload, Edit3, ExternalLink, Save, Loader2,
  Smartphone, Palette, LayoutTemplate, ChevronUp, Mail, MessageCircle,
  ShoppingBag, Video, Camera, Music, Coffee, Star, X, FileText, Image,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────
type LinkType = "social" | "affiliate" | "portfolio" | "custom";
type LayoutStyle = "classic" | "minimal" | "card";
type ActiveSection = "identity" | "appearance" | "links" | "pages";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  icon: string;
  type: LinkType;
  isActive: boolean;
  sortOrder: number;
};

type PageItem = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  linkUrl: string;
  linkLabel: string;
  isActive: boolean;
  sortOrder: number;
};

type SubPage = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverUrl: string;
  items: PageItem[];
  isActive: boolean;
};

type Profile = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  accentColor: string;
  bgColor: string;
  layoutStyle: LayoutStyle;
  links: LinkItem[];
  isPublic: boolean;
  updatedAt?: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────
const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans', sans-serif";
const LINE = "rgba(255,255,255,0.10)";
const SURFACE = "rgba(255,255,255,0.055)";

const ICON_OPTIONS = [
  { id: "website",   label: "Website",      icon: <Globe size={16} /> },
  { id: "youtube",   label: "YouTube",      icon: <Youtube size={16} /> },
  { id: "instagram", label: "Instagram",    icon: <Instagram size={16} /> },
  { id: "twitter",   label: "X / Twitter",  icon: <Twitter size={16} /> },
  { id: "tiktok",    label: "TikTok",       icon: <Video size={16} /> },
  { id: "whatsapp",  label: "WhatsApp",     icon: <MessageCircle size={16} /> },
  { id: "email",     label: "Email",        icon: <Mail size={16} /> },
  { id: "shopee",    label: "Shopee",       icon: <ShoppingBag size={16} /> },
  { id: "tokopedia", label: "Tokopedia",    icon: <ShoppingBag size={16} /> },
  { id: "portfolio", label: "Portfolio",    icon: <Camera size={16} /> },
  { id: "music",     label: "Music",        icon: <Music size={16} /> },
  { id: "donation",  label: "Donation",     icon: <Coffee size={16} /> },
  { id: "featured",  label: "Featured",     icon: <Star size={16} /> },
  { id: "custom",    label: "Custom Link",  icon: <Link2 size={16} /> },
];

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  social: "#60a5fa", affiliate: "#34d399", portfolio: "#a78bfa", custom: "#fb923c",
};

const ACCENT_PRESETS = [
  "#FF6A20","#60a5fa","#34d399","#a78bfa","#fb923c",
  "#f472b6","#facc15","#2dd4bf","#e11d48","#7c3aed",
];
const BG_PRESETS = [
  "#050505","#0a0a0a","#0f172a","#111827","#1a0a00",
  "#0a0a1a","#00000f","#0d1117","#181818","#0c0c0c",
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function crewFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("crew_token");
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...opts, headers }).then(async (r) => {
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `Error ${r.status}`); }
    return r.json();
  });
}

function randId() { return Math.random().toString(36).slice(2, 10); }

function slugify(str: string) {
  return str.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 40);
}

function IconForId({ id, size = 18 }: { id: string; size?: number }) {
  const found = ICON_OPTIONS.find((o) => o.id === id);
  return <span style={{ display: "flex", alignItems: "center" }}>{found ? found.icon : <Link2 size={size} />}</span>;
}

function getPlatformColor(iconId: string): string {
  const map: Record<string, string> = {
    youtube: "#ff0000", instagram: "#e1306c", twitter: "#1da1f2",
    tiktok: "#69c9d0", whatsapp: "#25d366", email: "#fb923c",
    shopee: "#ee4d2d", tokopedia: "#03ac0e", website: "#60a5fa",
    portfolio: "#a78bfa", music: "#f472b6", donation: "#f59e0b", featured: "#facc15",
  };
  return map[iconId] || OR;
}

// ── Input styles ───────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.06)", border: `1px solid ${LINE}`,
  borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13,
  fontFamily: FONT, outline: "none", width: "100%",
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: "pointer", appearance: "none" as any };

// ── Live Preview ───────────────────────────────────────────────────────────────
function LivePreview({ profile }: { profile: Profile }) {
  const accent = profile.accentColor || OR;
  const bg = profile.bgColor || "#050505";
  const activeLinks = profile.links.filter((l) => l.isActive);
  return (
    <div style={{ width: 280, background: bg, borderRadius: 24, overflow: "hidden", border: `1.5px solid ${accent}33`, boxShadow: `0 0 60px ${accent}22, 0 24px 64px rgba(0,0,0,.7)`, fontFamily: FONT, flexShrink: 0 }}>
      <div style={{ height: 90, background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${accent}44, ${accent}11, transparent)`, position: "relative" }}>
        <div style={{ position: "absolute", bottom: -30, left: "50%", transform: "translateX(-50%)", width: 64, height: 64, borderRadius: "50%", border: `3px solid ${bg}`, overflow: "hidden", background: `${accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 24, color: accent, fontWeight: 900 }}>{(profile.displayName || "?")[0].toUpperCase()}</span>}
        </div>
      </div>
      <div style={{ padding: "40px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{profile.displayName || "Your Name"}</div>
        <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginBottom: 8, letterSpacing: ".05em" }}>@{profile.username || "username"}</div>
        {profile.bio && <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", lineHeight: 1.6, marginBottom: 16 }}>{profile.bio}</div>}
        <div style={{ display: "grid", gap: 8 }}>
          {activeLinks.length === 0 && <div style={{ color: "rgba(255,255,255,.25)", fontSize: 11, padding: "16px 0" }}>No links yet</div>}
          {activeLinks.slice(0, 6).map((link) => {
            const color = getPlatformColor(link.icon);
            return (
              <div key={link.id} style={{ background: profile.layoutStyle === "card" ? `${color}18` : "rgba(255,255,255,.06)", border: `1px solid ${color}33`, borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ color, flexShrink: 0 }}><IconForId id={link.icon} size={15} /></div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", flex: 1, textAlign: "left" }}>{link.label}</span>
                <ExternalLink size={10} color="rgba(255,255,255,.3)" />
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 20, fontSize: 9, color: "rgba(255,255,255,.18)", letterSpacing: ".08em" }}>FRAMELESS CREATIVE</div>
      </div>
    </div>
  );
}

// ── Link Row ───────────────────────────────────────────────────────────────────
function LinkRow({ link, onUpdate, onDelete }: { link: LinkItem; onUpdate: (id: string, patch: Partial<LinkItem>) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [isMobile] = useState(() => window.innerWidth < 640);
  const color = getPlatformColor(link.icon);
  return (
    <div style={{ border: `1px solid ${link.isActive ? `${color}44` : LINE}`, borderRadius: 12, background: link.isActive ? `${color}0a` : "rgba(255,255,255,.025)", overflow: "hidden", transition: "all .2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <div style={{ cursor: "grab", color: "rgba(255,255,255,.3)", flexShrink: 0 }}><GripVertical size={14} /></div>
        <div style={{ color, flexShrink: 0 }}><IconForId id={link.icon} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.label || "Untitled Link"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.url || "No URL set"}</div>
        </div>
        {!isMobile && <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".06em", color: LINK_TYPE_COLORS[link.type] || OR, background: `${LINK_TYPE_COLORS[link.type] || OR}18`, padding: "3px 7px", borderRadius: 999, flexShrink: 0 }}>{link.type.toUpperCase()}</span>}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onUpdate(link.id, { isActive: !link.isActive })} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: link.isActive ? `${OR}22` : "rgba(255,255,255,.05)", color: link.isActive ? OR : "rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {link.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => setEditing(!editing)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: editing ? `${OR}22` : "rgba(255,255,255,.05)", color: editing ? OR : "rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {editing ? <ChevronUp size={13} /> : <Edit3 size={13} />}
          </button>
          <button onClick={() => onDelete(link.id)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(239,68,68,.08)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} /></button>
        </div>
      </div>
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 12px 14px", display: "grid", gap: 10, borderTop: `1px solid ${LINE}` }}>
              <div style={{ paddingTop: 12 }} />
              <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>LABEL</label><input value={link.label} onChange={(e) => onUpdate(link.id, { label: e.target.value })} placeholder="e.g. My YouTube Channel" style={inputStyle} /></div>
              <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>URL</label><input value={link.url} onChange={(e) => onUpdate(link.id, { url: e.target.value })} placeholder="https://" style={inputStyle} /></div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>ICON</label>
                  <select value={link.icon} onChange={(e) => onUpdate(link.id, { icon: e.target.value })} style={selectStyle}>{ICON_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></div>
                <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>TYPE</label>
                  <select value={link.type} onChange={(e) => onUpdate(link.id, { type: e.target.value as LinkType })} style={selectStyle}><option value="social">Social</option><option value="affiliate">Affiliate</option><option value="portfolio">Portfolio</option><option value="custom">Custom</option></select></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Page Item Row ──────────────────────────────────────────────────────────────
function PageItemRow({ item, onUpdate, onDelete }: { item: PageItem; onUpdate: (id: string, patch: Partial<PageItem>) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [isMobile] = useState(() => window.innerWidth < 640);
  return (
    <div style={{ border: `1px solid ${item.isActive ? `${OR}44` : LINE}`, borderRadius: 12, background: item.isActive ? `${OR}08` : "rgba(255,255,255,.025)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <div style={{ cursor: "grab", color: "rgba(255,255,255,.3)", flexShrink: 0 }}><GripVertical size={14} /></div>
        {item.imageUrl
          ? <img src={item.imageUrl} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
          : <div style={{ width: 36, height: 36, borderRadius: 8, background: `${OR}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Image size={16} color={OR} /></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.title || "Untitled Item"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.linkUrl || "No link"}</div>
        </div>
        <button onClick={() => onUpdate(item.id, { isActive: !item.isActive })} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: item.isActive ? `${OR}22` : "rgba(255,255,255,.05)", color: item.isActive ? OR : "rgba(255,255,255,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {item.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button onClick={() => setEditing(!editing)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: editing ? `${OR}22` : "rgba(255,255,255,.05)", color: editing ? OR : "rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {editing ? <ChevronUp size={13} /> : <Edit3 size={13} />}
        </button>
        <button onClick={() => onDelete(item.id)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "rgba(239,68,68,.08)", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Trash2 size={13} /></button>
      </div>
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            <div style={{ padding: "0 12px 14px", display: "grid", gap: 10, borderTop: `1px solid ${LINE}` }}>
              <div style={{ paddingTop: 12 }} />
              <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>JUDUL ITEM</label><input value={item.title} onChange={(e) => onUpdate(item.id, { title: e.target.value })} placeholder="Sony ZV-E10" style={inputStyle} /></div>
              <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>DESKRIPSI</label><textarea value={item.description} onChange={(e) => onUpdate(item.id, { description: e.target.value })} placeholder="Kamera andalan untuk vlog harian" rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>LINK URL</label><input value={item.linkUrl} onChange={(e) => onUpdate(item.id, { linkUrl: e.target.value })} placeholder="https://shopee.co.id/..." style={inputStyle} /></div>
                <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>LABEL TOMBOL</label><input value={item.linkLabel} onChange={(e) => onUpdate(item.id, { linkLabel: e.target.value })} placeholder="Beli di Shopee" style={inputStyle} /></div>
              </div>
              <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>URL GAMBAR (opsional)</label><input value={item.imageUrl} onChange={(e) => onUpdate(item.id, { imageUrl: e.target.value })} placeholder="https://..." style={inputStyle} /></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-Page Editor ────────────────────────────────────────────────────────────
function SubPageEditor({ page, username, accentColor, onSave, onDelete, onClose }: {
  page: SubPage; username: string; accentColor: string;
  onSave: (p: SubPage) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState<SubPage>(page);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMobile] = useState(() => window.innerWidth < 640);
  const { toast } = useToast();

  const publicUrl = `${window.location.origin}/@${username}/${draft.slug}`;

  function patchPage(u: Partial<SubPage>) { setDraft((p) => ({ ...p, ...u })); }
  function updateItem(id: string, patch: Partial<PageItem>) {
    setDraft((p) => ({ ...p, items: p.items.map((i) => i.id === id ? { ...i, ...patch } : i) }));
  }
  function deleteItem(id: string) { setDraft((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) })); }
  function addItem() {
    const newItem: PageItem = { id: randId(), title: "", description: "", imageUrl: "", linkUrl: "", linkLabel: "Lihat", isActive: true, sortOrder: draft.items.length + 1 };
    setDraft((p) => ({ ...p, items: [...p.items, newItem] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const token = localStorage.getItem("crew_token");
      const isNew = !page.id || page.id === "";
      const url = isNew ? "/api/crew/linkinbio/pages" : `/api/crew/linkinbio/pages/${page.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(draft) });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error);
      onSave(saved);
      toast({ title: "Halaman tersimpan ✓" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function copyUrl() { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, display: "grid", gap: 16 }}>

      {/* Editor header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: "#fff", minWidth: 80 }}>Edit Sub-Page</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={copyUrl} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 5 }}>
            {copied ? <Check size={11} color="#34d399" /> : <Copy size={11} />} URL
          </button>
          {draft.id && <button onClick={() => onDelete(draft.id)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(239,68,68,.3)", background: "rgba(239,68,68,.08)", color: "#f87171", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>Hapus</button>}
          <button onClick={handleSave} disabled={saving} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: saving ? `${OR}66` : OR, color: "#fff", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 5 }}>
            {saving ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} /> : <Save size={11} />} Simpan
          </button>
        </div>
      </div>

      {/* URL preview */}
      <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${LINE}`, borderRadius: 10, padding: "8px 12px", fontSize: 11, color: "rgba(255,255,255,.45)", display: "flex", alignItems: "center", gap: 6 }}>
        <Globe size={11} color={accentColor} />
        <span style={{ color: accentColor, fontWeight: 700 }}>/@{username}/</span>
        <span>{draft.slug || "slug"}</span>
      </div>

      {/* Page meta */}
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>JUDUL HALAMAN</label>
            <input value={draft.title} onChange={(e) => { patchPage({ title: e.target.value, slug: slugify(e.target.value) }); }} placeholder="My Equipment" style={inputStyle} /></div>
          <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>SLUG URL</label>
            <input value={draft.slug} onChange={(e) => patchPage({ slug: slugify(e.target.value) })} placeholder="my-equipment" style={inputStyle} /></div>
        </div>
        <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>DESKRIPSI (opsional)</label>
          <textarea value={draft.description} onChange={(e) => patchPage({ description: e.target.value })} placeholder="Daftar peralatan produksi yang aku pakai sehari-hari." rows={2} style={{ ...inputStyle, resize: "vertical" }} /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => patchPage({ isActive: !draft.isActive })} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${draft.isActive ? "#34d39966" : LINE}`, background: draft.isActive ? "rgba(52,211,153,.1)" : "rgba(255,255,255,.04)", color: draft.isActive ? "#34d399" : "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 5 }}>
            {draft.isActive ? <Eye size={11} /> : <EyeOff size={11} />} {draft.isActive ? "Aktif" : "Nonaktif"}
          </button>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>Halaman harus aktif agar bisa diakses publik</span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", marginBottom: 12 }}>
          ITEMS ({draft.items.length})
        </div>
        <Reorder.Group axis="y" values={draft.items} onReorder={(items) => patchPage({ items })} style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {draft.items.map((item) => (
            <Reorder.Item key={item.id} value={item} style={{ listStyle: "none" }}>
              <PageItemRow item={item} onUpdate={updateItem} onDelete={deleteItem} />
            </Reorder.Item>
          ))}
        </Reorder.Group>
        {draft.items.length === 0 && (
          <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 24, textAlign: "center", color: "rgba(255,255,255,.3)", fontSize: 13 }}>
            Belum ada item. Tambahkan item pertama di bawah.
          </div>
        )}
        <button onClick={addItem} style={{ marginTop: 10, width: "100%", padding: "10px 16px", borderRadius: 12, border: `1.5px dashed ${OR}55`, background: `${OR}08`, color: OR, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={15} /> Tambah Item
        </button>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function CrewLinkInBio() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>("identity");
  const [pages, setPages] = useState<SubPage[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [editingPage, setEditingPage] = useState<SubPage | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 900 : false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const publicUrl = profile ? `${window.location.origin}/${profile.username}` : "";

  // Responsive: track screen width
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Load profile
  useEffect(() => {
    setLoading(true);
    crewFetch<Profile>("/api/crew/linkinbio")
      .then((p) => setProfile(p))
      .catch((e) => toast({ variant: "destructive", title: "Gagal memuat profil", description: e.message }))
      .finally(() => setLoading(false));
  }, []);

  // Load pages when tab active
  useEffect(() => {
    if (activeSection !== "pages") return;
    setLoadingPages(true);
    crewFetch<SubPage[]>("/api/crew/linkinbio/pages")
      .then(setPages)
      .catch((e) => toast({ variant: "destructive", title: "Gagal memuat pages", description: e.message }))
      .finally(() => setLoadingPages(false));
  }, [activeSection]);

  const save = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await crewFetch<Profile>("/api/crew/linkinbio", { method: "PUT", body: JSON.stringify(profile) });
      setProfile(saved);
      toast({ title: "Profil tersimpan ✓" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: e.message });
    } finally { setSaving(false); }
  }, [profile, toast]);

  function patch(updates: Partial<Profile>) { setProfile((prev) => prev ? { ...prev, ...updates } : prev); }
  function updateLink(id: string, updates: Partial<LinkItem>) { setProfile((prev) => prev ? { ...prev, links: prev.links.map((l) => l.id === id ? { ...l, ...updates } : l) } : prev); }
  function deleteLink(id: string) { setProfile((prev) => prev ? { ...prev, links: prev.links.filter((l) => l.id !== id) } : prev); }
  function addLink() {
    const newLink: LinkItem = { id: randId(), label: "", url: "", icon: "custom", type: "custom", isActive: true, sortOrder: (profile?.links.length || 0) + 1 };
    setProfile((prev) => prev ? { ...prev, links: [...prev.links, newLink] } : prev);
    setActiveSection("links");
  }

  async function uploadImage(file: File, endpoint: "avatar" | "banner") {
    const setter = endpoint === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setter(true);
    try {
      const form = new FormData(); form.append("file", file);
      const token = localStorage.getItem("crew_token");
      const res = await fetch(`/api/crew/linkinbio/${endpoint}`, { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal");
      patch(endpoint === "avatar" ? { avatarUrl: data.url } : { bannerUrl: data.url });
      toast({ title: `${endpoint === "avatar" ? "Foto profil" : "Banner"} berhasil diupload` });
    } catch (e: any) { toast({ variant: "destructive", title: "Upload gagal", description: e.message }); }
    finally { setter(false); }
  }

  function copyUrl() { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }

  function newPage(): SubPage {
    return { id: "", slug: "", title: "", description: "", coverUrl: "", items: [], isActive: true };
  }

  async function deletePage(id: string) {
    if (!id) { setEditingPage(null); return; }
    try {
      const token = localStorage.getItem("crew_token");
      await fetch(`/api/crew/linkinbio/pages/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token || ""}` } });
      setPages((prev) => prev.filter((p) => p.id !== id));
      setEditingPage(null);
      toast({ title: "Halaman dihapus" });
    } catch (e: any) { toast({ variant: "destructive", title: "Gagal hapus", description: e.message }); }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, color: "rgba(255,255,255,.5)", fontFamily: FONT }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
      <span style={{ fontSize: 14 }}>Memuat profil...</span>
    </div>
  );
  if (!profile) return null;

  const sectionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: isMobile ? "7px 12px" : "8px 16px",
    borderRadius: 10,
    border: `1px solid ${active ? OR : LINE}`,
    background: active ? `${OR}18` : "rgba(255,255,255,.04)",
    color: active ? OR : "rgba(255,255,255,.55)",
    fontSize: isMobile ? 11 : 12,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: FONT,
    transition: "all .15s",
    letterSpacing: ".03em",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
  });

  return (
    <div style={{ fontFamily: FONT, color: "#fff" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        {/* Baris 1: Title + action icons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.2 }}>Link-in-Bio</div>
            {!isMobile && <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Kelola halaman personal dan semua link kamu di satu tempat.</div>}
          </div>
          {/* Icon-only buttons di mobile, full label di desktop */}
          <button
            onClick={() => patch({ isPublic: !profile.isPublic })}
            title={profile.isPublic ? "Publik" : "Privat"}
            style={{ padding: isMobile ? "8px 10px" : "8px 14px", borderRadius: 10, border: `1px solid ${profile.isPublic ? "#34d39988" : LINE}`, background: profile.isPublic ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.05)", color: profile.isPublic ? "#34d399" : "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {profile.isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
            {!isMobile && (profile.isPublic ? " Publik" : " Privat")}
          </button>
          {profile.isPublic && (
            <button onClick={copyUrl} title="Salin Link" style={{ padding: isMobile ? "8px 10px" : "8px 14px", borderRadius: 10, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.05)", color: copied ? "#34d399" : "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {!isMobile && " Salin Link"}
            </button>
          )}
          {profile.isPublic && profile.username && (
            <a href={`/${profile.username}`} target="_blank" rel="noreferrer" title="Lihat Halaman"
              style={{ padding: isMobile ? "8px 10px" : "8px 14px", borderRadius: 10, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.7)", fontSize: 12, fontWeight: 800, textDecoration: "none", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <ExternalLink size={14} />
              {!isMobile && " Lihat Halaman"}
            </a>
          )}
        </div>

        {/* Baris 2: Preview (mobile) + Simpan — full width di mobile */}
        <div style={{ display: "flex", gap: 8 }}>
          {isMobile && (
            <button
              onClick={() => setShowMobilePreview(v => !v)}
              style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${showMobilePreview ? OR+"66" : LINE}`, background: showMobilePreview ? `${OR}18` : "rgba(255,255,255,.05)", color: showMobilePreview ? OR : "rgba(255,255,255,.6)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Smartphone size={14} /> Preview
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            style={{ flex: isMobile ? 1 : "none", padding: "9px 20px", borderRadius: 10, border: "none", background: saving ? "rgba(255,106,32,.5)" : `linear-gradient(135deg, ${OR}, #e84d00)`, color: "#fff", fontSize: 12, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: FONT, boxShadow: saving ? "none" : `0 4px 20px ${OR}44` }}>
            {saving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Save size={13} />}
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      {/* URL bar */}
      {profile.isPublic && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)", borderRadius: 12, padding: "9px 12px", display: "flex", alignItems: "center", gap: 8, marginBottom: 16, minWidth: 0, overflow: "hidden" }}>
          <Globe size={13} color="#34d399" style={{ flexShrink: 0 }} />
          <a href={publicUrl} target="_blank" rel="noreferrer"
            style={{ color: "#34d399", fontWeight: 700, fontSize: 12, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
            {publicUrl}
          </a>
          <button onClick={copyUrl} style={{ border: "none", background: "none", cursor: "pointer", color: copied ? "#34d399" : "rgba(255,255,255,.4)", padding: 2, flexShrink: 0, display: "flex" }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </motion.div>
      )}

      {/* Mobile Preview Sheet — slide up dari bawah */}
      <AnimatePresence>
        {isMobile && showMobilePreview && (
          <motion.div
            key="mobile-preview-sheet"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowMobilePreview(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,.7)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: 420, padding: "0 16px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
            >
              {/* Pull handle */}
              <div style={{ width: 40, height: 4, borderRadius: 999, background: "rgba(255,255,255,.25)", marginBottom: 4 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.4)", letterSpacing: ".06em" }}>PREVIEW LIVE</span>
                <button onClick={() => setShowMobilePreview(false)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${LINE}`, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <X size={14} />
                </button>
              </div>
              <LivePreview profile={profile} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout — desktop: 2 kolom (form + preview), mobile: 1 kolom penuh */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: isMobile ? 16 : 28, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 16 }}>

          {/* Section tabs — scroll horizontal di mobile dengan fade mask */}
          <div style={{ position: "relative" }}>
          {isMobile && <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 32, background: "linear-gradient(to right, transparent, rgba(8,8,10,0.95))", pointerEvents: "none", zIndex: 2 }} />}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", flexWrap: "nowrap", paddingBottom: 2, scrollbarWidth: "none", msOverflowStyle: "none" }}>
            <button style={sectionBtnStyle(activeSection === "identity")} onClick={() => setActiveSection("identity")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Edit3 size={12} /> Identitas</span>
            </button>
            <button style={sectionBtnStyle(activeSection === "appearance")} onClick={() => setActiveSection("appearance")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Palette size={12} /> Tampilan</span>
            </button>
            <button style={sectionBtnStyle(activeSection === "links")} onClick={() => setActiveSection("links")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link2 size={12} /> Links
                {profile.links.length > 0 && <span style={{ background: OR, color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>{profile.links.length}</span>}
              </span>
            </button>
            <button style={sectionBtnStyle(activeSection === "pages")} onClick={() => setActiveSection("pages")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={12} /> Sub-Pages
                {pages.length > 0 && <span style={{ background: "#a78bfa", color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>{pages.length}</span>}
              </span>
            </button>
          </div>
          </div>

          {/* ── IDENTITY ── */}
          <AnimatePresence mode="wait">
            {activeSection === "identity" && (
              <motion.div key="identity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, display: "grid", gap: 18 }}>
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>FOTO PROFIL & BANNER</div>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <div onClick={() => !uploadingAvatar && avatarInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: "50%", border: `2px dashed ${OR}66`, background: profile.avatarUrl ? "none" : `${OR}11`, overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                        {profile.avatarUrl ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Upload size={20} color={`${OR}88`} />}
                        {uploadingAvatar && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={16} style={{ animation: "spin .7s linear infinite" }} /></div>}
                      </div>
                      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div onClick={() => !uploadingBanner && bannerInputRef.current?.click()} style={{ height: 56, borderRadius: 10, border: `2px dashed rgba(255,255,255,.2)`, background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover no-repeat` : "rgba(255,255,255,.03)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "rgba(255,255,255,.4)", fontSize: 12, position: "relative" }}>
                          {!profile.bannerUrl && <><Upload size={14} /> Upload Banner</>}
                          {uploadingBanner && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={16} style={{ animation: "spin .7s linear infinite" }} /></div>}
                        </div>
                        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
                        {profile.bannerUrl && <button onClick={() => patch({ bannerUrl: "" })} style={{ marginTop: 6, fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}><X size={11} /> Hapus banner</button>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 5 }}><label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>NAMA TAMPIL</label><input value={profile.displayName} onChange={(e) => patch({ displayName: e.target.value })} placeholder="Nama kamu" style={inputStyle} /></div>
                  <div style={{ display: "grid", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>USERNAME</label>
                    <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
                      <span style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${LINE}`, borderRight: "none", borderRadius: "10px 0 0 10px", padding: "9px 12px", fontSize: 13, color: "rgba(255,255,255,.4)", fontFamily: FONT }}>@</span>
                      <input value={profile.username} onChange={(e) => patch({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="username" style={{ ...inputStyle, borderRadius: "0 10px 10px 0", borderLeft: "none" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>URL: {window.location.origin}/<strong>{profile.username || "username"}</strong></span>
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>BIO</label>
                    <textarea value={profile.bio} onChange={(e) => patch({ bio: e.target.value })} placeholder="Ceritakan sedikit tentang dirimu..." rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }} />
                    <span style={{ fontSize: 11, color: profile.bio.length > 150 ? "#fb923c" : "rgba(255,255,255,.3)" }}>{profile.bio.length}/150 karakter</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── APPEARANCE ── */}
            {activeSection === "appearance" && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, display: "grid", gap: 20 }}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>WARNA AKSEN</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {ACCENT_PRESETS.map((c) => <button key={c} onClick={() => patch({ accentColor: c })} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `2px solid ${profile.accentColor === c ? "#fff" : "transparent"}`, cursor: "pointer" }} />)}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="color" value={profile.accentColor} onChange={(e) => patch({ accentColor: e.target.value })} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: "none", cursor: "pointer" }} />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontFamily: FONT }}>{profile.accentColor}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>WARNA LATAR</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {BG_PRESETS.map((c) => <button key={c} onClick={() => patch({ bgColor: c })} style={{ width: 30, height: 30, borderRadius: "50%", background: c, border: `2px solid ${profile.bgColor === c ? "#fff" : "rgba(255,255,255,.2)"}`, cursor: "pointer" }} />)}
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>GAYA LAYOUT</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                      {(["classic", "minimal", "card"] as LayoutStyle[]).map((style) => (
                        <button key={style} onClick={() => patch({ layoutStyle: style })} style={{ padding: "14px 10px", borderRadius: 12, border: `1.5px solid ${profile.layoutStyle === style ? OR : LINE}`, background: profile.layoutStyle === style ? `${OR}14` : "rgba(255,255,255,.03)", color: profile.layoutStyle === style ? OR : "rgba(255,255,255,.55)", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "grid", placeItems: "center", gap: 8 }}>
                          <LayoutTemplate size={18} />{style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── LINKS ── */}
            {activeSection === "links" && (
              <motion.div key="links" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    {(["social","affiliate","portfolio","custom"] as LinkType[]).map((type) => (
                      <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: LINK_TYPE_COLORS[type], flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,.45)", fontWeight: 700 }}>{type}: {profile.links.filter(l => l.type === type).length}</span>
                      </div>
                    ))}
                  </div>
                  {profile.links.length === 0 ? (
                    <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 28, textAlign: "center", color: "rgba(255,255,255,.3)" }}>
                      <Link2 size={24} style={{ margin: "0 auto 8px", display: "block" }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Belum ada link</div>
                    </div>
                  ) : (
                    <Reorder.Group axis="y" values={profile.links} onReorder={(links) => patch({ links })} style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                      {profile.links.map((link) => (
                        <Reorder.Item key={link.id} value={link} style={{ listStyle: "none" }}>
                          <LinkRow link={link} onUpdate={updateLink} onDelete={deleteLink} />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                  <button onClick={addLink} style={{ padding: "11px 16px", borderRadius: 12, border: `1.5px dashed ${OR}55`, background: `${OR}08`, color: OR, fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Plus size={16} /> Tambah Link
                  </button>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 700, letterSpacing: ".04em" }}>QUICK ADD</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["youtube","instagram","tiktok","whatsapp","shopee","tokopedia"].map((iconId) => {
                        const opt = ICON_OPTIONS.find((o) => o.id === iconId);
                        if (!opt) return null;
                        const color = getPlatformColor(iconId);
                        return (
                          <button key={iconId} onClick={() => { const l: LinkItem = { id: randId(), label: opt.label, url: "", icon: iconId, type: ["shopee","tokopedia"].includes(iconId) ? "affiliate" : "social", isActive: true, sortOrder: (profile.links.length || 0) + 1 }; setProfile((prev) => prev ? { ...prev, links: [...prev.links, l] } : prev); }} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${color}44`, background: `${color}11`, color, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 5 }}>
                            {opt.icon}{opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PAGES ── */}
            {activeSection === "pages" && (
              <motion.div key="pages" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <AnimatePresence mode="wait">
                  {editingPage ? (
                    <SubPageEditor
                      key={editingPage.id || "new"}
                      page={editingPage}
                      username={profile.username}
                      accentColor={profile.accentColor}
                      onSave={(saved) => {
                        setPages((prev) => {
                          const exists = prev.find(p => p.id === saved.id);
                          return exists ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
                        });
                        setEditingPage(saved);
                      }}
                      onDelete={deletePage}
                      onClose={() => setEditingPage(null)}
                    />
                  ) : (
                    <motion.div key="page-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      <div style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 16, padding: 20, display: "grid", gap: 12 }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", lineHeight: 1.6 }}>
                          Buat halaman koleksi link (equipment, preset, tools, dll). Setiap halaman punya URL sendiri — tambahkan sebagai 1 link di bio utama.
                        </div>
                        {loadingPages ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.4)", padding: "20px 0" }}>
                            <Loader2 size={16} style={{ animation: "spin .7s linear infinite" }} />
                            <span style={{ fontSize: 13 }}>Memuat pages...</span>
                          </div>
                        ) : pages.length === 0 ? (
                          <div style={{ border: `1px dashed ${LINE}`, borderRadius: 12, padding: 32, textAlign: "center", color: "rgba(255,255,255,.3)" }}>
                            <FileText size={28} style={{ margin: "0 auto 10px", display: "block" }} />
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Belum ada sub-page</div>
                            <div style={{ fontSize: 12 }}>Buat halaman pertama seperti "My Equipment" atau "My Presets"</div>
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            {pages.map((page) => (
                              <button key={page.id} onClick={() => setEditingPage(page)}
                                style={{ border: `1px solid ${page.isActive ? "#a78bfa44" : LINE}`, borderRadius: 12, background: page.isActive ? "rgba(167,139,250,.06)" : "rgba(255,255,255,.025)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", color: "#fff", fontFamily: FONT, transition: "all .15s" }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(167,139,250,.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <FileText size={16} color="#a78bfa" />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700 }}>{page.title}</div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 }}>/@{profile.username}/{page.slug} · {page.items.length} item</div>
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 999, background: page.isActive ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.06)", color: page.isActive ? "#34d399" : "rgba(255,255,255,.3)" }}>
                                  {page.isActive ? "AKTIF" : "NONAKTIF"}
                                </span>
                                <Edit3 size={13} color="rgba(255,255,255,.3)" />
                              </button>
                            ))}
                          </div>
                        )}
                        <button onClick={() => setEditingPage(newPage())} style={{ padding: "11px 16px", borderRadius: 12, border: "1.5px dashed #a78bfa55", background: "rgba(167,139,250,.06)", color: "#a78bfa", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <Plus size={16} /> Buat Sub-Page Baru
                        </button>
                        {pages.length > 0 && (
                          <div style={{ background: "rgba(167,139,250,.06)", border: "1px solid #a78bfa33", borderRadius: 10, padding: "10px 14px", fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.6 }}>
                            💡 <strong style={{ color: "#a78bfa" }}>Tips:</strong> Tambahkan sub-page sebagai link di bio utama. Contoh: label "📦 My Equipment", URL <code style={{ color: "#a78bfa" }}>/@{profile.username || "username"}/equipment</code>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Live Preview — disembunyikan di mobile, tampil di desktop sidebar kanan */}
        {!isMobile && (
          <div style={{ position: "sticky", top: 24 }}>
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em" }}>
              <Smartphone size={12} /> PREVIEW LIVE
            </div>
            <LivePreview profile={profile} />
          </div>
        )}
      </div>
    </div>
  );
}
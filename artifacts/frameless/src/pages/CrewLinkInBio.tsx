// artifacts/frameless/src/components/crew/CrewLinkInBio.tsx
// Full Link-in-Bio management UI for crew dashboard
// Includes: profile editor, link manager (social/affiliate/custom), live preview, public toggle

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Globe,
  Instagram,
  Youtube,
  Twitter,
  Link2,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  EyeOff,
  Copy,
  Check,
  Upload,
  Edit3,
  ExternalLink,
  Save,
  Loader2,
  Smartphone,
  Palette,
  LayoutTemplate,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageCircle,
  ShoppingBag,
  Video,
  Camera,
  Music,
  Coffee,
  Star,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ────────────────────────────────────────────────────────────────────
type LinkType = "social" | "affiliate" | "portfolio" | "custom";
type LayoutStyle = "classic" | "minimal" | "card";

type LinkItem = {
  id: string;
  label: string;
  url: string;
  icon: string;
  type: LinkType;
  isActive: boolean;
  sortOrder: number;
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

// ── Constants ─────────────────────────────────────────────────────────────────
const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans', sans-serif";
const LINE = "rgba(255,255,255,0.10)";
const SURFACE = "rgba(255,255,255,0.055)";

const ICON_OPTIONS = [
  { id: "website", label: "Website", icon: <Globe size={16} /> },
  { id: "youtube", label: "YouTube", icon: <Youtube size={16} /> },
  { id: "instagram", label: "Instagram", icon: <Instagram size={16} /> },
  { id: "twitter", label: "X / Twitter", icon: <Twitter size={16} /> },
  { id: "tiktok", label: "TikTok", icon: <Video size={16} /> },
  { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={16} /> },
  { id: "email", label: "Email", icon: <Mail size={16} /> },
  { id: "shopee", label: "Shopee", icon: <ShoppingBag size={16} /> },
  { id: "tokopedia", label: "Tokopedia", icon: <ShoppingBag size={16} /> },
  { id: "portfolio", label: "Portfolio", icon: <Camera size={16} /> },
  { id: "music", label: "Music", icon: <Music size={16} /> },
  { id: "donation", label: "Donation", icon: <Coffee size={16} /> },
  { id: "featured", label: "Featured", icon: <Star size={16} /> },
  { id: "custom", label: "Custom Link", icon: <Link2 size={16} /> },
];

const LINK_TYPE_COLORS: Record<LinkType, string> = {
  social: "#60a5fa",
  affiliate: "#34d399",
  portfolio: "#a78bfa",
  custom: "#fb923c",
};

const ACCENT_PRESETS = [
  "#FF6A20", "#60a5fa", "#34d399", "#a78bfa", "#fb923c",
  "#f472b6", "#facc15", "#2dd4bf", "#e11d48", "#7c3aed",
];

const BG_PRESETS = [
  "#050505", "#0a0a0a", "#0f172a", "#111827", "#1a0a00",
  "#0a0a1a", "#00000f", "#0d1117", "#181818", "#0c0c0c",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function crewFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("crew_token");
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...opts, headers }).then(async (r) => {
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.error || `Error ${r.status}`);
    }
    return r.json();
  });
}

function randId() {
  return Math.random().toString(36).slice(2, 10);
}

function IconForId({ id, size = 18 }: { id: string; size?: number }) {
  const found = ICON_OPTIONS.find((o) => o.id === id);
  if (found) return <span style={{ display: "flex", alignItems: "center" }}>{found.icon}</span>;
  return <Link2 size={size} />;
}

function getPlatformColor(iconId: string): string {
  const map: Record<string, string> = {
    youtube: "#ff0000",
    instagram: "#e1306c",
    twitter: "#1da1f2",
    tiktok: "#69c9d0",
    whatsapp: "#25d366",
    email: "#fb923c",
    shopee: "#ee4d2d",
    tokopedia: "#03ac0e",
    website: "#60a5fa",
    portfolio: "#a78bfa",
    music: "#f472b6",
    donation: "#f59e0b",
    featured: "#facc15",
  };
  return map[iconId] || OR;
}

// ── Live Preview ──────────────────────────────────────────────────────────────
function LivePreview({ profile }: { profile: Profile }) {
  const accent = profile.accentColor || OR;
  const bg = profile.bgColor || "#050505";
  const activeLinks = profile.links.filter((l) => l.isActive);

  return (
    <div
      style={{
        width: 280,
        background: bg,
        borderRadius: 24,
        overflow: "hidden",
        border: `1.5px solid ${accent}33`,
        boxShadow: `0 0 60px ${accent}22, 0 24px 64px rgba(0,0,0,.7)`,
        fontFamily: FONT,
        flexShrink: 0,
      }}
    >
      {/* Banner */}
      <div
        style={{
          height: 90,
          background: profile.bannerUrl
            ? `url(${profile.bannerUrl}) center/cover no-repeat`
            : `linear-gradient(135deg, ${accent}44, ${accent}11, transparent)`,
          position: "relative",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            position: "absolute",
            bottom: -30,
            left: "50%",
            transform: "translateX(-50%)",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: `3px solid ${bg}`,
            overflow: "hidden",
            background: `${accent}33`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 24, color: accent, fontWeight: 900 }}>
              {(profile.displayName || "?")[0].toUpperCase()}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "40px 20px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
          {profile.displayName || "Your Name"}
        </div>
        <div style={{ fontSize: 11, color: accent, fontWeight: 700, marginBottom: 8, letterSpacing: ".05em" }}>
          @{profile.username || "username"}
        </div>
        {profile.bio && (
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", lineHeight: 1.6, marginBottom: 16, whiteSpace: "pre-wrap" }}>
            {profile.bio}
          </div>
        )}

        {/* Links */}
        <div style={{ display: "grid", gap: 8 }}>
          {activeLinks.length === 0 && (
            <div style={{ color: "rgba(255,255,255,.25)", fontSize: 11, padding: "16px 0" }}>No links yet</div>
          )}
          {activeLinks.slice(0, 8).map((link) => {
            const color = getPlatformColor(link.icon);
            return (
              <div
                key={link.id}
                style={{
                  background: profile.layoutStyle === "minimal"
                    ? "transparent"
                    : profile.layoutStyle === "card"
                    ? `${color}18`
                    : "rgba(255,255,255,.06)",
                  border: profile.layoutStyle === "minimal"
                    ? `1px solid rgba(255,255,255,.1)`
                    : `1px solid ${color}33`,
                  borderRadius: 12,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <div style={{ color, flexShrink: 0 }}>
                  <IconForId id={link.icon} size={15} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", flex: 1, textAlign: "left" }}>
                  {link.label}
                </span>
                <ExternalLink size={10} color="rgba(255,255,255,.3)" />
              </div>
            );
          })}
          {activeLinks.length > 8 && (
            <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", textAlign: "center" }}>
              +{activeLinks.length - 8} more
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 20, fontSize: 9, color: "rgba(255,255,255,.18)", letterSpacing: ".08em" }}>
          FRAMELESS CREATIVE
        </div>
      </div>
    </div>
  );
}

// ── Link Row (draggable) ──────────────────────────────────────────────────────
function LinkRow({
  link,
  onUpdate,
  onDelete,
}: {
  link: LinkItem;
  onUpdate: (id: string, patch: Partial<LinkItem>) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const color = getPlatformColor(link.icon);

  return (
    <div
      style={{
        border: `1px solid ${link.isActive ? `${color}44` : LINE}`,
        borderRadius: 12,
        background: link.isActive ? `${color}0a` : "rgba(255,255,255,.025)",
        overflow: "hidden",
        transition: "all .2s",
      }}
    >
      {/* Row header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        <div style={{ cursor: "grab", color: "rgba(255,255,255,.3)", flexShrink: 0 }}>
          <GripVertical size={14} />
        </div>
        <div style={{ color, flexShrink: 0 }}><IconForId id={link.icon} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {link.label || "Untitled Link"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {link.url || "No URL set"}
          </div>
        </div>

        {/* Type badge */}
        <span style={{
          fontSize: 9, fontWeight: 800, letterSpacing: ".06em",
          color: LINK_TYPE_COLORS[link.type] || OR,
          background: `${LINK_TYPE_COLORS[link.type] || OR}18`,
          padding: "3px 7px", borderRadius: 999,
        }}>
          {link.type.toUpperCase()}
        </span>

        {/* Toggle active */}
        <button
          onClick={() => onUpdate(link.id, { isActive: !link.isActive })}
          title={link.isActive ? "Hide link" : "Show link"}
          style={{
            width: 28, height: 28, borderRadius: 8, border: "none",
            background: link.isActive ? `${OR}22` : "rgba(255,255,255,.05)",
            color: link.isActive ? OR : "rgba(255,255,255,.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all .15s",
          }}
        >
          {link.isActive ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>

        {/* Edit toggle */}
        <button
          onClick={() => setEditing(!editing)}
          style={{
            width: 28, height: 28, borderRadius: 8, border: "none",
            background: editing ? `${OR}22` : "rgba(255,255,255,.05)",
            color: editing ? OR : "rgba(255,255,255,.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {editing ? <ChevronUp size={13} /> : <Edit3 size={13} />}
        </button>

        {/* Delete */}
        <button
          onClick={() => onDelete(link.id)}
          style={{
            width: 28, height: 28, borderRadius: 8, border: "none",
            background: "rgba(239,68,68,.08)", color: "#f87171",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Edit panel */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 12px 14px", display: "grid", gap: 10, borderTop: `1px solid ${LINE}` }}>
              <div style={{ paddingTop: 12 }} />

              {/* Label */}
              <div style={{ display: "grid", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>LABEL</label>
                <input
                  value={link.label}
                  onChange={(e) => onUpdate(link.id, { label: e.target.value })}
                  placeholder="e.g. My YouTube Channel"
                  style={inputStyle}
                />
              </div>

              {/* URL */}
              <div style={{ display: "grid", gap: 5 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>URL</label>
                <input
                  value={link.url}
                  onChange={(e) => onUpdate(link.id, { url: e.target.value })}
                  placeholder="https://"
                  style={inputStyle}
                />
              </div>

              {/* Icon & Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "grid", gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>ICON</label>
                  <select
                    value={link.icon}
                    onChange={(e) => onUpdate(link.id, { icon: e.target.value })}
                    style={selectStyle}
                  >
                    {ICON_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)" }}>TYPE</label>
                  <select
                    value={link.type}
                    onChange={(e) => onUpdate(link.id, { type: e.target.value as LinkType })}
                    style={selectStyle}
                  >
                    <option value="social">Social</option>
                    <option value="affiliate">Affiliate</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  padding: "9px 12px",
  color: "#fff",
  fontSize: 13,
  fontFamily: FONT,
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none" as any,
};

// ── Main Component ────────────────────────────────────────────────────────────
export function CrewLinkInBio() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState<"identity" | "appearance" | "links">("identity");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const publicUrl = profile
    ? `${window.location.origin}/crew/link/${profile.username}`
    : "";

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    crewFetch<Profile>("/api/crew/linkinbio")
      .then((p) => setProfile(p))
      .catch((e) => toast({ variant: "destructive", title: "Gagal memuat profil", description: e.message }))
      .finally(() => setLoading(false));
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const saved = await crewFetch<Profile>("/api/crew/linkinbio", {
        method: "PUT",
        body: JSON.stringify(profile),
      });
      setProfile(saved);
      toast({ title: "Profil tersimpan ✓", description: "Link-in-Bio kamu telah diperbarui." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Gagal menyimpan", description: e.message });
    } finally {
      setSaving(false);
    }
  }, [profile, toast]);

  // ── Field helpers ────────────────────────────────────────────────────────────
  function patch(updates: Partial<Profile>) {
    setProfile((prev) => prev ? { ...prev, ...updates } : prev);
  }

  function updateLink(id: string, updates: Partial<LinkItem>) {
    setProfile((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        links: prev.links.map((l) => (l.id === id ? { ...l, ...updates } : l)),
      };
    });
  }

  function deleteLink(id: string) {
    setProfile((prev) => prev ? { ...prev, links: prev.links.filter((l) => l.id !== id) } : prev);
  }

  function addLink() {
    const newLink: LinkItem = {
      id: randId(),
      label: "",
      url: "",
      icon: "custom",
      type: "custom",
      isActive: true,
      sortOrder: (profile?.links.length || 0) + 1,
    };
    setProfile((prev) => prev ? { ...prev, links: [...prev.links, newLink] } : prev);
    setTimeout(() => setActiveSection("links"), 50);
  }

  // ── Upload ───────────────────────────────────────────────────────────────────
  async function uploadImage(file: File, endpoint: "avatar" | "banner") {
    const setter = endpoint === "avatar" ? setUploadingAvatar : setUploadingBanner;
    setter(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = localStorage.getItem("crew_token");
      const res = await fetch(`/api/crew/linkinbio/${endpoint}`, {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal");
      patch(endpoint === "avatar" ? { avatarUrl: data.url } : { bannerUrl: data.url });
      toast({ title: `${endpoint === "avatar" ? "Foto profil" : "Banner"} berhasil diupload` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Upload gagal", description: e.message });
    } finally {
      setter(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, color: "rgba(255,255,255,.5)", fontFamily: FONT }}>
        <Loader2 size={20} style={{ animation: "spin .7s linear infinite" }} />
        <span style={{ fontSize: 14 }}>Memuat profil...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!profile) return null;

  const sectionBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    borderRadius: 10,
    border: `1px solid ${active ? OR : LINE}`,
    background: active ? `${OR}18` : "rgba(255,255,255,.04)",
    color: active ? OR : "rgba(255,255,255,.55)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: FONT,
    transition: "all .15s",
    letterSpacing: ".04em",
  });

  return (
    <div style={{ fontFamily: FONT, color: "#fff" }}>
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Link-in-Bio</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)" }}>
            Kelola halaman personal dan semua link kamu di satu tempat.
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {/* Public toggle */}
          <button
            onClick={() => patch({ isPublic: !profile.isPublic })}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${profile.isPublic ? "#34d39988" : LINE}`,
              background: profile.isPublic ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.05)",
              color: profile.isPublic ? "#34d399" : "rgba(255,255,255,.5)",
              fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {profile.isPublic ? <Eye size={13} /> : <EyeOff size={13} />}
            {profile.isPublic ? "Publik" : "Privat"}
          </button>

          {/* Copy URL */}
          {profile.isPublic && (
            <button
              onClick={copyUrl}
              style={{
                padding: "8px 14px", borderRadius: 10,
                border: `1px solid ${LINE}`,
                background: "rgba(255,255,255,.05)",
                color: "rgba(255,255,255,.7)",
                fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {copied ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
              Salin Link
            </button>
          )}

          {/* Preview */}
          {profile.isPublic && profile.username && (
            <a
              href={`/crew/link/${profile.username}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 14px", borderRadius: 10,
                border: `1px solid ${LINE}`,
                background: "rgba(255,255,255,.05)",
                color: "rgba(255,255,255,.7)",
                fontSize: 12, fontWeight: 800, textDecoration: "none", fontFamily: FONT,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <ExternalLink size={13} />
              Lihat Halaman
            </a>
          )}

          {/* Save */}
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: "8px 18px", borderRadius: 10,
              border: "none",
              background: saving ? "rgba(255,106,32,.5)" : `linear-gradient(135deg, ${OR}, #e84d00)`,
              color: "#fff",
              fontSize: 12, fontWeight: 800, cursor: saving ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 7, fontFamily: FONT,
              boxShadow: saving ? "none" : `0 4px 20px ${OR}44`,
            }}
          >
            {saving ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Save size={13} />}
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      {/* ── URL bar ───────────────────────────────────────────────────────── */}
      {profile.isPublic && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: "rgba(52,211,153,.08)",
            border: "1px solid rgba(52,211,153,.2)",
            borderRadius: 12,
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 24,
          }}
        >
          <Globe size={14} color="#34d399" />
          <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)", flex: 1 }}>
            Halaman kamu live di:{" "}
            <a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: "#34d399", fontWeight: 700 }}>
              {publicUrl}
            </a>
          </span>
        </motion.div>
      )}

      {/* ── Layout: Editor + Preview ──────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 28, alignItems: "start" }}>

        {/* Editor column */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Section tabs */}
          <div style={{ display: "flex", gap: 8 }}>
            <button style={sectionBtnStyle(activeSection === "identity")} onClick={() => setActiveSection("identity")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Edit3 size={12} /> Identitas</span>
            </button>
            <button style={sectionBtnStyle(activeSection === "appearance")} onClick={() => setActiveSection("appearance")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Palette size={12} /> Tampilan</span>
            </button>
            <button style={sectionBtnStyle(activeSection === "links")} onClick={() => setActiveSection("links")}>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Link2 size={12} /> Links
                {profile.links.length > 0 && (
                  <span style={{ background: OR, color: "#fff", borderRadius: 999, padding: "1px 6px", fontSize: 10 }}>
                    {profile.links.length}
                  </span>
                )}
              </span>
            </button>
          </div>

          {/* ── IDENTITY SECTION ────────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {activeSection === "identity" && (
              <motion.div key="identity" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${LINE}`,
                    borderRadius: 16,
                    padding: 20,
                    display: "grid",
                    gap: 18,
                  }}
                >
                  {/* Avatar & Banner */}
                  <div style={{ display: "grid", gap: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>
                      FOTO PROFIL & BANNER
                    </div>
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      {/* Avatar upload */}
                      <div
                        onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                        style={{
                          width: 80, height: 80, borderRadius: "50%",
                          border: `2px dashed ${OR}66`,
                          background: profile.avatarUrl ? "none" : `${OR}11`,
                          overflow: "hidden", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {profile.avatarUrl ? (
                          <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <Upload size={20} color={`${OR}88`} />
                        )}
                        {uploadingAvatar && (
                          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Loader2 size={16} style={{ animation: "spin .7s linear infinite" }} />
                          </div>
                        )}
                      </div>
                      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "avatar")} />

                      <div style={{ flex: 1, minWidth: 200 }}>
                        {/* Banner upload */}
                        <div
                          onClick={() => !uploadingBanner && bannerInputRef.current?.click()}
                          style={{
                            height: 56, borderRadius: 10,
                            border: `2px dashed rgba(255,255,255,.2)`,
                            background: profile.bannerUrl ? `url(${profile.bannerUrl}) center/cover no-repeat` : "rgba(255,255,255,.03)",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 8, color: "rgba(255,255,255,.4)", fontSize: 12, position: "relative",
                          }}
                        >
                          {!profile.bannerUrl && <><Upload size={14} /> Upload Banner</>}
                          {uploadingBanner && (
                            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Loader2 size={16} style={{ animation: "spin .7s linear infinite" }} />
                            </div>
                          )}
                        </div>
                        <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0], "banner")} />
                        {profile.bannerUrl && (
                          <button onClick={() => patch({ bannerUrl: "" })} style={{ marginTop: 6, fontSize: 11, color: "#f87171", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                            <X size={11} /> Hapus banner
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div style={{ display: "grid", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>NAMA TAMPIL</label>
                    <input
                      value={profile.displayName}
                      onChange={(e) => patch({ displayName: e.target.value })}
                      placeholder="Nama kamu"
                      style={inputStyle}
                    />
                  </div>

                  {/* Username */}
                  <div style={{ display: "grid", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>USERNAME</label>
                    <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
                      <span style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${LINE}`, borderRight: "none", borderRadius: "10px 0 0 10px", padding: "9px 12px", fontSize: 13, color: "rgba(255,255,255,.4)", fontFamily: FONT }}>
                        @
                      </span>
                      <input
                        value={profile.username}
                        onChange={(e) => patch({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                        placeholder="username"
                        style={{ ...inputStyle, borderRadius: "0 10px 10px 0", borderLeft: "none" }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,.3)" }}>
                      URL: {window.location.origin}/crew/link/<strong>{profile.username || "username"}</strong>
                    </span>
                  </div>

                  {/* Bio */}
                  <div style={{ display: "grid", gap: 5 }}>
                    <label style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>BIO</label>
                    <textarea
                      value={profile.bio}
                      onChange={(e) => patch({ bio: e.target.value })}
                      placeholder="Ceritakan sedikit tentang dirimu..."
                      rows={3}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                    />
                    <span style={{ fontSize: 11, color: profile.bio.length > 150 ? "#fb923c" : "rgba(255,255,255,.3)" }}>
                      {profile.bio.length}/150 karakter
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── APPEARANCE SECTION ─────────────────────────────────────── */}
            {activeSection === "appearance" && (
              <motion.div key="appearance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${LINE}`,
                    borderRadius: 16,
                    padding: 20,
                    display: "grid",
                    gap: 20,
                  }}
                >
                  {/* Accent Color */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>WARNA AKSEN</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {ACCENT_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => patch({ accentColor: c })}
                          title={c}
                          style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: c, border: `2px solid ${profile.accentColor === c ? "#fff" : "transparent"}`,
                            cursor: "pointer", transition: "transform .15s",
                          }}
                        />
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="color"
                          value={profile.accentColor}
                          onChange={(e) => patch({ accentColor: e.target.value })}
                          style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${LINE}`, background: "none", cursor: "pointer" }}
                        />
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontFamily: FONT }}>{profile.accentColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Background Color */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>WARNA LATAR</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {BG_PRESETS.map((c) => (
                        <button
                          key={c}
                          onClick={() => patch({ bgColor: c })}
                          title={c}
                          style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: c, border: `2px solid ${profile.bgColor === c ? "#fff" : "rgba(255,255,255,.2)"}`,
                            cursor: "pointer",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Layout Style */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em" }}>GAYA LAYOUT</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                      {(["classic", "minimal", "card"] as LayoutStyle[]).map((style) => (
                        <button
                          key={style}
                          onClick={() => patch({ layoutStyle: style })}
                          style={{
                            padding: "14px 10px",
                            borderRadius: 12,
                            border: `1.5px solid ${profile.layoutStyle === style ? OR : LINE}`,
                            background: profile.layoutStyle === style ? `${OR}14` : "rgba(255,255,255,.03)",
                            color: profile.layoutStyle === style ? OR : "rgba(255,255,255,.55)",
                            fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
                            display: "grid", placeItems: "center", gap: 8, transition: "all .15s",
                          }}
                        >
                          <LayoutTemplate size={18} />
                          {style.charAt(0).toUpperCase() + style.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── LINKS SECTION ──────────────────────────────────────────── */}
            {activeSection === "links" && (
              <motion.div key="links" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div
                  style={{
                    background: SURFACE,
                    border: `1px solid ${LINE}`,
                    borderRadius: 16,
                    padding: 20,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  {/* Stats row */}
                  <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
                    {(["social", "affiliate", "portfolio", "custom"] as LinkType[]).map((type) => {
                      const count = profile.links.filter((l) => l.type === type).length;
                      return (
                        <div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: LINK_TYPE_COLORS[type], flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,.45)", fontWeight: 700 }}>{type}: {count}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Links list (drag-reorder) */}
                  {profile.links.length === 0 ? (
                    <div style={{
                      border: `1px dashed ${LINE}`,
                      borderRadius: 12,
                      padding: 28,
                      textAlign: "center",
                      color: "rgba(255,255,255,.3)",
                    }}>
                      <Link2 size={24} style={{ margin: "0 auto 8px", display: "block" }} />
                      <div style={{ fontSize: 13, fontWeight: 700 }}>Belum ada link</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Tambahkan link sosial, affiliate, atau portofolio kamu.</div>
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={profile.links}
                      onReorder={(links) => patch({ links })}
                      style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}
                    >
                      {profile.links.map((link) => (
                        <Reorder.Item key={link.id} value={link} style={{ listStyle: "none" }}>
                          <LinkRow link={link} onUpdate={updateLink} onDelete={deleteLink} />
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}

                  {/* Add link button */}
                  <button
                    onClick={addLink}
                    style={{
                      padding: "11px 16px",
                      borderRadius: 12,
                      border: `1.5px dashed ${OR}55`,
                      background: `${OR}08`,
                      color: OR,
                      fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: FONT,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      transition: "all .15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `${OR}18`;
                      (e.currentTarget as HTMLElement).style.borderColor = OR;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = `${OR}08`;
                      (e.currentTarget as HTMLElement).style.borderColor = `${OR}55`;
                    }}
                  >
                    <Plus size={16} />
                    Tambah Link
                  </button>

                  {/* Quick-add presets */}
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 700, letterSpacing: ".04em" }}>QUICK ADD</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {["youtube", "instagram", "tiktok", "whatsapp", "shopee", "tokopedia"].map((iconId) => {
                        const opt = ICON_OPTIONS.find((o) => o.id === iconId);
                        if (!opt) return null;
                        const color = getPlatformColor(iconId);
                        return (
                          <button
                            key={iconId}
                            onClick={() => {
                              const newLink: LinkItem = {
                                id: randId(),
                                label: opt.label,
                                url: "",
                                icon: iconId,
                                type: ["shopee", "tokopedia"].includes(iconId) ? "affiliate" : "social",
                                isActive: true,
                                sortOrder: (profile.links.length || 0) + 1,
                              };
                              setProfile((prev) => prev ? { ...prev, links: [...prev.links, newLink] } : prev);
                            }}
                            style={{
                              padding: "6px 10px",
                              borderRadius: 8,
                              border: `1px solid ${color}44`,
                              background: `${color}11`,
                              color,
                              fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                              display: "flex", alignItems: "center", gap: 5,
                            }}
                          >
                            {opt.icon}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Live Preview ──────────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: 24 }}>
          <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.4)", fontSize: 11, fontWeight: 700, letterSpacing: ".06em" }}>
            <Smartphone size={12} />
            PREVIEW LIVE
          </div>
          <LivePreview profile={profile} />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
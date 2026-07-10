// artifacts/frameless/src/pages/crew-link-page.tsx
// Public-facing Link-in-Bio page — accessible at /crew/link/:username
// No auth required. Cinematic dark design, mobile-first.

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Instagram,
  Youtube,
  Twitter,
  Link2,
  Mail,
  MessageCircle,
  ShoppingBag,
  Video,
  Camera,
  Music,
  Coffee,
  Star,
  ExternalLink,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type LinkItem = {
  id: string;
  label: string;
  url: string;
  icon: string;
  type: string;
  isActive: boolean;
};

type PublicProfile = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  accentColor: string;
  bgColor: string;
  layoutStyle: "classic" | "minimal" | "card";
  links: LinkItem[];
  role?: string;
  department?: string;
};

// ── Icon map ──────────────────────────────────────────────────────────────────
function PlatformIcon({ id, size = 20 }: { id: string; size?: number }) {
  const map: Record<string, React.ReactNode> = {
    youtube: <Youtube size={size} />,
    instagram: <Instagram size={size} />,
    twitter: <Twitter size={size} />,
    tiktok: <Video size={size} />,
    whatsapp: <MessageCircle size={size} />,
    email: <Mail size={size} />,
    shopee: <ShoppingBag size={size} />,
    tokopedia: <ShoppingBag size={size} />,
    website: <Globe size={size} />,
    portfolio: <Camera size={size} />,
    music: <Music size={size} />,
    donation: <Coffee size={size} />,
    featured: <Star size={size} />,
  };
  return <span style={{ display: "flex", alignItems: "center" }}>{map[id] || <Link2 size={size} />}</span>;
}

function getPlatformColor(iconId: string, accent: string): string {
  const map: Record<string, string> = {
    youtube: "#ff0000",
    instagram: "#e1306c",
    twitter: "#1da1f2",
    tiktok: "#69c9d0",
    whatsapp: "#25d366",
    email: "#fb923c",
    shopee: "#ee4d2d",
    tokopedia: "#03ac0e",
  };
  return map[iconId] || accent;
}

function getLinkHref(link: LinkItem): string {
  if (!link.url) return "#";
  if (link.icon === "email" && !link.url.startsWith("mailto:")) return `mailto:${link.url}`;
  if (link.icon === "whatsapp" && !link.url.startsWith("http")) return `https://wa.me/${link.url.replace(/\D/g, "")}`;
  return link.url;
}

// ── Link Card ─────────────────────────────────────────────────────────────────
function LinkCard({
  link,
  accent,
  bg,
  layoutStyle,
  index,
}: {
  link: LinkItem;
  accent: string;
  bg: string;
  layoutStyle: "classic" | "minimal" | "card";
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const color = getPlatformColor(link.icon, accent);
  const href = getLinkHref(link);

  const cardBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 18px",
    borderRadius: 16,
    textDecoration: "none",
    cursor: "pointer",
    transition: "all .2s cubic-bezier(.16,1,.3,1)",
    position: "relative",
    overflow: "hidden",
    transform: hovered ? "translateY(-2px) scale(1.012)" : "none",
  };

  const cardStyle: React.CSSProperties =
    layoutStyle === "card"
      ? {
          ...cardBase,
          background: hovered ? `${color}22` : `${color}12`,
          border: `1px solid ${color}${hovered ? "55" : "28"}`,
          boxShadow: hovered ? `0 8px 32px ${color}22, 0 0 0 1px ${color}33` : "none",
        }
      : layoutStyle === "minimal"
      ? {
          ...cardBase,
          background: hovered ? "rgba(255,255,255,.06)" : "transparent",
          border: `1px solid rgba(255,255,255,${hovered ? ".18" : ".08"})`,
        }
      : {
          ...cardBase,
          background: hovered ? "rgba(255,255,255,.09)" : "rgba(255,255,255,.05)",
          border: `1px solid rgba(255,255,255,${hovered ? ".18" : ".08"})`,
          backdropFilter: "blur(12px)",
        };

  return (
    <motion.a
      href={href}
      target={link.icon !== "email" ? "_blank" : undefined}
      rel="noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: `${color}20`,
          color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all .2s",
          boxShadow: hovered ? `0 0 16px ${color}44` : "none",
        }}
      >
        <PlatformIcon id={link.icon} size={20} />
      </div>

      {/* Label */}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: ".01em",
          lineHeight: 1.3,
        }}
      >
        {link.label}
      </span>

      {/* Arrow */}
      <ExternalLink
        size={14}
        color={`rgba(255,255,255,${hovered ? ".6" : ".2"})`}
        style={{ flexShrink: 0, transition: "opacity .2s", transform: hovered ? "translate(2px, -2px)" : "none" }}
      />
    </motion.a>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CrewLinkPage() {
  const params = useParams<{ username: string }>();
  const username = params.username;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/public/crew/${username}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        const data = await r.json();
        setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 14,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: "rgba(255,255,255,.4)",
        }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <Loader2 size={28} color="#FF6A20" style={{ animation: "spin .8s linear infinite" }} />
        <span style={{ fontSize: 13 }}>Memuat profil...</span>
      </div>
    );
  }

  // ── Not Found ──────────────────────────────────────────────────────────────
  if (notFound || !profile) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          color: "rgba(255,255,255,.4)",
          padding: 24,
          textAlign: "center",
        }}
      >
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap');`}</style>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎬</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Profil tidak ditemukan</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,.4)", maxWidth: 300 }}>
          @{username} belum punya halaman publik, atau link sudah tidak aktif.
        </div>
        <a href="/" style={{ marginTop: 12, color: "#FF6A20", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          ← Kembali ke Frameless
        </a>
      </div>
    );
  }

  const accent = profile.accentColor || "#FF6A20";
  const bg = profile.bgColor || "#050505";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: bg,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 999px; }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes gradientShift {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>

      {/* Ambient background glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute",
          top: "-20%", left: "50%", transform: "translateX(-50%)",
          width: "80%", height: "60%",
          background: `radial-gradient(ellipse, ${accent}18 0%, transparent 70%)`,
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute",
          bottom: "-10%", right: "-20%",
          width: "60%", height: "50%",
          background: `radial-gradient(ellipse, ${accent}0e 0%, transparent 70%)`,
          filter: "blur(60px)",
        }} />
      </div>

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          margin: "0 auto",
          padding: "0 16px 60px",
        }}
      >
        {/* Banner */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0.96 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            height: 160,
            background: profile.bannerUrl
              ? `url(${profile.bannerUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${accent}44 0%, ${accent}11 50%, transparent 100%)`,
            borderRadius: "0 0 24px 24px",
            position: "relative",
            marginLeft: -16,
            marginRight: -16,
          }}
        >
          {/* Gradient overlay for readability */}
          <div style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to bottom, transparent 40%, ${bg}cc)`,
            borderRadius: "0 0 24px 24px",
          }} />
        </motion.div>

        {/* Avatar */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: -44, position: "relative", zIndex: 2 }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              border: `3px solid ${bg}`,
              outline: `2px solid ${accent}55`,
              overflow: "hidden",
              background: `${accent}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 40px ${accent}33, 0 8px 32px rgba(0,0,0,.6)`,
            }}
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 36, color: accent, fontWeight: 900 }}>
                {(profile.displayName || "?")[0].toUpperCase()}
              </span>
            )}
          </motion.div>
        </div>

        {/* Name & bio */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
          style={{ textAlign: "center", marginTop: 16, marginBottom: 28 }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 4, lineHeight: 1.2 }}>
            {profile.displayName}
          </h1>
          <div style={{ fontSize: 13, color: accent, fontWeight: 700, marginBottom: profile.bio ? 10 : 0, letterSpacing: ".04em" }}>
            @{profile.username}
          </div>
          {profile.bio && (
            <p style={{
              fontSize: 13,
              color: "rgba(255,255,255,.55)",
              lineHeight: 1.7,
              maxWidth: 340,
              margin: "0 auto",
              whiteSpace: "pre-wrap",
            }}>
              {profile.bio}
            </p>
          )}
        </motion.div>

        {/* Links */}
        <div style={{ display: "grid", gap: 10 }}>
          {profile.links.length === 0 && (
            <div style={{
              textAlign: "center",
              color: "rgba(255,255,255,.3)",
              fontSize: 13,
              padding: "32px 0",
            }}>
              Belum ada link yang ditambahkan.
            </div>
          )}
          {profile.links.map((link, i) => (
            <LinkCard
              key={link.id}
              link={link}
              accent={accent}
              bg={bg}
              layoutStyle={profile.layoutStyle}
              index={i}
            />
          ))}
        </div>

        {/* Footer branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 + profile.links.length * 0.05 }}
          style={{
            marginTop: 48,
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <a
            href="https://framelesscreative.com"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: "rgba(255,255,255,.2)",
              textDecoration: "none",
              letterSpacing: ".08em",
              fontWeight: 700,
              transition: "color .2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.5)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.2)")}
          >
            Powered by{" "}
            <span style={{ color: accent, fontWeight: 900 }}>Frameless Creative</span>
          </a>
        </motion.div>
      </div>
    </div>
  );
}
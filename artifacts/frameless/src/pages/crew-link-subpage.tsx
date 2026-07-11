// artifacts/frameless/src/pages/crew-link-subpage.tsx
// Public sub-page: /@username/slug — grid of items with image, title, desc, buy link
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, ArrowLeft, Share2, Check } from "lucide-react";

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
  slug: string;
  title: string;
  description: string;
  coverUrl: string;
  items: PageItem[];
  accentColor: string;
  bgColor: string;
  ownerName: string;
  ownerUsername: string;
  ownerAvatarUrl: string;
};

const FONT = "'Plus Jakarta Sans', sans-serif";

export default function CrewLinkSubPage() {
  const params = useParams<{ username: string; slug: string }>();
  const { username, slug } = params;

  const [page, setPage] = useState<SubPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (!username || !slug) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/public/crew/${username}/pages/${slug}`)
      .then(async (r) => {
        if (!r.ok) { setNotFound(true); return; }
        setPage(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [username, slug]);

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: page?.title || "Sub-Page", url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  // ── Loading ──
  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: FONT, color: "rgba(255,255,255,.4)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(255,106,32,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={24} color="#FF6A20" style={{ animation: "spin .8s linear infinite" }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Memuat halaman...</span>
    </div>
  );

  // ── Not Found ──
  if (notFound || !page) return (
    <div style={{ minHeight: "100dvh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, fontFamily: FONT, color: "rgba(255,255,255,.4)", padding: 24, textAlign: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap');`}</style>
      <div style={{ fontSize: 52, marginBottom: 4 }}>📂</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Halaman tidak ditemukan</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", maxWidth: 280, lineHeight: 1.6 }}>
        Link ini sudah tidak aktif atau belum pernah dibuat.
      </div>
      <a
        href={`/@${username}`}
        style={{ marginTop: 8, padding: "10px 20px", borderRadius: 12, background: "rgba(255,106,32,.15)", border: "1px solid rgba(255,106,32,.3)", color: "#FF6A20", fontSize: 13, fontWeight: 800, textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}
      >
        <ArrowLeft size={14} /> Profil @{username}
      </a>
    </div>
  );

  const accent = page.accentColor || "#FF6A20";
  const bg = page.bgColor || "#050505";
  const activeItems = page.items.filter(i => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
  const coverH = isMobile ? 160 : 220;

  return (
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: FONT, position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 999px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }
        .item-link:hover { background: ${accent} !important; color: #fff !important; }
      `}</style>

      {/* ── Ambient glow ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", top: "-15%", left: "50%", transform: "translateX(-50%)",
          width: "90%", height: "55%",
          background: `radial-gradient(ellipse, ${accent}18 0%, transparent 68%)`,
          filter: "blur(50px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-10%", right: "-15%",
          width: "60%", height: "45%",
          background: `radial-gradient(ellipse, ${accent}0c 0%, transparent 70%)`,
          filter: "blur(60px)",
        }} />
      </div>

      {/* ── Cover + sticky back bar ── */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Sticky top bar (back + share) */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10,
          background: page.coverUrl ? "transparent" : `${bg}e0`,
          backdropFilter: page.coverUrl ? "none" : "blur(16px)",
          WebkitBackdropFilter: page.coverUrl ? "none" : "blur(16px)",
        }}>
          <a
            href={`/${page.ownerUsername}`}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 999,
              background: "rgba(0,0,0,.45)", backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,.12)",
              color: "rgba(255,255,255,.85)", fontSize: 12, fontWeight: 800,
              textDecoration: "none", transition: "all .15s",
              minHeight: 40,
            }}
          >
            {page.ownerAvatarUrl
              ? <img src={page.ownerAvatarUrl} alt={page.ownerName} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", border: `1.5px solid ${accent}66` }} />
              : <ArrowLeft size={14} />
            }
            <span>@{page.ownerUsername}</span>
          </a>

          <div style={{ flex: 1 }} />

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              width: 40, height: 40, borderRadius: 999,
              background: "rgba(0,0,0,.45)", backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,.12)",
              color: shared ? "#34d399" : "rgba(255,255,255,.8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all .15s", flexShrink: 0,
            }}
          >
            {shared ? <Check size={16} /> : <Share2 size={16} />}
          </button>
        </div>

        {/* Cover image — overlaps under sticky bar */}
        {page.coverUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              height: coverH,
              background: `url(${page.coverUrl}) center/cover no-repeat`,
              marginTop: -64, // pull up behind sticky bar
              position: "relative",
            }}
          >
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(to bottom, rgba(0,0,0,.25) 0%, transparent 40%, ${bg}f0 100%)`,
            }} />
          </motion.div>
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: `${page.coverUrl ? 16 : 0}px 16px 80px` }}>

        {/* Page title + desc */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginBottom: isMobile ? 24 : 32 }}
        >
          <h1 style={{
            fontSize: isMobile ? 24 : 30,
            fontWeight: 900, color: "#fff",
            lineHeight: 1.15, letterSpacing: "-0.02em",
            marginBottom: page.description ? 10 : 0,
          }}>
            {page.title}
          </h1>
          {page.description && (
            <p style={{ fontSize: isMobile ? 13 : 14, color: "rgba(255,255,255,.5)", lineHeight: 1.7 }}>
              {page.description}
            </p>
          )}
          {/* Item count chip */}
          {activeItems.length > 0 && (
            <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: `${accent}18`, border: `1px solid ${accent}33` }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: ".04em" }}>
                {activeItems.length} ITEM
              </span>
            </div>
          )}
        </motion.div>

        {/* ── Items grid ── */}
        {activeItems.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,.25)", padding: "56px 0", fontSize: 14 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            Belum ada item di halaman ini.
          </div>
        ) : (
          <div style={{
            display: "grid",
            // 1 kolom di mobile (<480px), 2 kolom di tablet+, auto-fill di desktop
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
            gap: isMobile ? 12 : 16,
          }}>
            {activeItems.map((item, i) => (
              <ItemCard
                key={item.id}
                item={item}
                accent={accent}
                bg={bg}
                index={i}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ marginTop: 56, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 1, background: "rgba(255,255,255,.08)" }} />
          <a
            href="https://framelesscreative.com"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: 11, color: "rgba(255,255,255,.18)", textDecoration: "none", fontWeight: 700, letterSpacing: ".08em", transition: "color .2s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.5)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.18)"}
          >
            Powered by <span style={{ color: accent }}>Frameless Creative</span>
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Item Card ──────────────────────────────────────────────────────────────────
function ItemCard({
  item, accent, bg, index, isMobile,
}: {
  item: PageItem; accent: string; bg: string; index: number; isMobile: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.055, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.04)",
        border: `1px solid ${hovered ? `${accent}55` : "rgba(255,255,255,.08)"}`,
        borderRadius: isMobile ? 14 : 16,
        overflow: "hidden",
        transition: "all .22s cubic-bezier(.16,1,.3,1)",
        transform: hovered && !isMobile ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,.45), 0 0 0 1px ${accent}22` : "none",
        // Mobile: horizontal card layout
        display: isMobile ? "flex" : "block",
        flexDirection: "row",
      }}
    >
      {/* ── Image ── */}
      {item.imageUrl ? (
        <div style={{
          // Mobile: fixed width thumbnail; Desktop: full-width hero
          width: isMobile ? 100 : "100%",
          height: isMobile ? "100%" : 170,
          minHeight: isMobile ? 100 : undefined,
          flexShrink: 0,
          background: `url(${item.imageUrl}) center/cover no-repeat`,
          position: "relative",
        }}>
          {!isMobile && (
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 45%, ${bg}cc)` }} />
          )}
          {/* Subtle accent overlay on hover */}
          <div style={{
            position: "absolute", inset: 0,
            background: `${accent}00`,
            transition: "background .2s",
            ...(hovered ? { background: `${accent}10` } : {}),
          }} />
        </div>
      ) : (
        <div style={{
          width: isMobile ? 84 : "100%",
          height: isMobile ? "auto" : 110,
          minHeight: isMobile ? 84 : undefined,
          flexShrink: 0,
          background: `${accent}0e`,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative",
        }}>
          <div style={{ fontSize: isMobile ? 28 : 36, opacity: 0.7 }}>📦</div>
          {/* Accent dot top-right */}
          <div style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: "50%", background: accent, opacity: 0.5 }} />
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ padding: isMobile ? "12px 14px" : "14px 16px 16px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: isMobile ? 4 : 6 }}>
        <div style={{
          fontSize: isMobile ? 13 : 14,
          fontWeight: 800, color: "#fff",
          lineHeight: 1.3,
          // Clamp to 2 lines on mobile
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical" as any,
          overflow: "hidden",
        }}>
          {item.title}
        </div>

        {item.description && (
          <div style={{
            fontSize: isMobile ? 11 : 12,
            color: "rgba(255,255,255,.42)",
            lineHeight: 1.55,
            display: "-webkit-box",
            WebkitLineClamp: isMobile ? 2 : 3,
            WebkitBoxOrient: "vertical" as any,
            overflow: "hidden",
          }}>
            {item.description}
          </div>
        )}

        {item.linkUrl && (
          <div style={{ marginTop: "auto", paddingTop: 4 }}>
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="item-link"
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: isMobile ? "6px 11px" : "8px 14px",
                borderRadius: isMobile ? 8 : 10,
                background: `${accent}20`,
                color: accent,
                fontSize: isMobile ? 11 : 12,
                fontWeight: 800, textDecoration: "none",
                transition: "all .18s",
                border: `1px solid ${accent}44`,
                whiteSpace: "nowrap",
              }}
            >
              <ExternalLink size={isMobile ? 11 : 12} />
              {item.linkLabel || "Lihat"}
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}
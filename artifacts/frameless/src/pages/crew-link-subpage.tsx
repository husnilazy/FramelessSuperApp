// artifacts/frameless/src/pages/crew-link-subpage.tsx
// Public sub-page: /@username/slug — grid of items with image, title, desc, buy link
import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, ArrowLeft } from "lucide-react";

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

export default function CrewLinkSubPage() {
  const params = useParams<{ username: string; slug: string }>();
  const { username, slug } = params;

  const [page, setPage] = useState<SubPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", color: "rgba(255,255,255,.4)" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap'); @keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <Loader2 size={28} color="#FF6A20" style={{ animation: "spin .8s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Memuat halaman...</span>
    </div>
  );

  if (notFound || !page) return (
    <div style={{ minHeight: "100dvh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, fontFamily: "'Plus Jakarta Sans',sans-serif", color: "rgba(255,255,255,.4)", padding: 24, textAlign: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800;900&display=swap');`}</style>
      <div style={{ fontSize: 48, marginBottom: 8 }}>📂</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Halaman tidak ditemukan</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,.4)", maxWidth: 300 }}>Link ini sudah tidak aktif atau belum pernah dibuat.</div>
      <a href={`/@${username}`} style={{ marginTop: 12, color: "#FF6A20", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>← Kembali ke profil @{username}</a>
    </div>
  );

  const accent = page.accentColor || "#FF6A20";
  const bg = page.bgColor || "#050505";
  const activeItems = page.items.filter(i => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div style={{ minHeight: "100dvh", background: bg, fontFamily: "'Plus Jakarta Sans',sans-serif", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.15); border-radius: 999px; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "80%", height: "50%", background: `radial-gradient(ellipse, ${accent}14 0%, transparent 70%)`, filter: "blur(40px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto", padding: "0 16px 60px" }}>

        {/* Cover */}
        {page.coverUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ height: 200, background: `url(${page.coverUrl}) center/cover no-repeat`, borderRadius: "0 0 20px 20px", marginLeft: -16, marginRight: -16, position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 30%, ${bg}ee)`, borderRadius: "0 0 20px 20px" }} />
          </motion.div>
        )}

        {/* Back + owner */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 0 8px" }}>
          <a href={`/crew/link/${page.ownerUsername}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.4)", fontSize: 12, fontWeight: 700, textDecoration: "none", transition: "color .15s" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = accent}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.4)"}>
            <ArrowLeft size={14} />
            @{page.ownerUsername}
          </a>
          {page.ownerAvatarUrl && (
            <img src={page.ownerAvatarUrl} alt={page.ownerName} style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", marginLeft: "auto", border: `1.5px solid ${accent}44` }} />
          )}
        </div>

        {/* Page title */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 8 }}>{page.title}</h1>
          {page.description && <p style={{ fontSize: 14, color: "rgba(255,255,255,.5)", lineHeight: 1.7 }}>{page.description}</p>}
        </motion.div>

        {/* Items grid */}
        {activeItems.length === 0 ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,.3)", padding: "48px 0", fontSize: 14 }}>Belum ada item di halaman ini.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {activeItems.map((item, i) => <ItemCard key={item.id} item={item} accent={accent} bg={bg} index={i} />)}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: "center" }}>
          <a href="https://framelesscreative.com" target="_blank" rel="noreferrer"
            style={{ fontSize: 11, color: "rgba(255,255,255,.2)", textDecoration: "none", fontWeight: 700, letterSpacing: ".08em" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.5)"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.2)"}>
            Powered by <span style={{ color: accent }}>Frameless Creative</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, accent, bg, index }: { item: PageItem; accent: string; bg: string; index: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.04)",
        border: `1px solid ${hovered ? `${accent}44` : "rgba(255,255,255,.08)"}`,
        borderRadius: 16,
        overflow: "hidden",
        transition: "all .2s cubic-bezier(.16,1,.3,1)",
        transform: hovered ? "translateY(-3px)" : "none",
        boxShadow: hovered ? `0 12px 40px rgba(0,0,0,.4), 0 0 0 1px ${accent}22` : "none",
      }}
    >
      {/* Image */}
      {item.imageUrl ? (
        <div style={{ height: 180, background: `url(${item.imageUrl}) center/cover no-repeat`, position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 50%, ${bg}dd)` }} />
        </div>
      ) : (
        <div style={{ height: 120, background: `${accent}11`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 36 }}>📦</div>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 6, lineHeight: 1.3 }}>{item.title}</div>
        {item.description && (
          <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", lineHeight: 1.6, marginBottom: 12 }}>{item.description}</div>
        )}
        {item.linkUrl && (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 10,
              background: hovered ? accent : `${accent}22`,
              color: hovered ? "#fff" : accent,
              fontSize: 12, fontWeight: 800, textDecoration: "none",
              transition: "all .2s",
              border: `1px solid ${accent}44`,
            }}
          >
            <ExternalLink size={12} />
            {item.linkLabel || "Lihat"}
          </a>
        )}
      </div>
    </motion.div>
  );
}
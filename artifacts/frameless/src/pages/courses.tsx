import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Film, Play, Search } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const ORANGE       = "hsl(20,100%,58%)";
const ORANGE_DIM   = "rgba(240,56,32,0.12)";
const ORANGE_BORD  = "rgba(240,56,32,0.25)";
const BG           = "#0a0a0c";
const BORDER       = "rgba(255,255,255,0.08)";
const TEXT_DIM     = "rgba(255,255,255,0.45)";
const font         = "'Plus Jakarta Sans', sans-serif";

function courseHref(slug: string) {
  return `/course/${encodeURIComponent(slug)}`;
}

interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
}
interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; highlightVideoUrl?: string; instructor?: string;
  level?: string; category?: string; isPublished?: boolean;
  packages: Package[];
}
interface AcademyStats { alumni: string; rating: string; tagline: string; }

const STATS_DEFAULT: AcademyStats = {
  alumni:  "500+",
  rating:  "4.9/5",
  tagline: "Kuasai videografi dari sineas profesional",
};

const LEVELS = ["Semua", "beginner", "intermediate", "advanced"];

export default function CoursesPage() {
  const [search,       setSearch]       = useState("");
  const [levelFilter,  setLevelFilter]  = useState("Semua");
  const [stats, setStats]               = useState<AcademyStats>(STATS_DEFAULT);

  // Load stats: coba dari API dulu, fallback ke localStorage
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/cms/academy_stats");
        if (res.ok) {
          const d = await res.json();
          const val = typeof d.value === "string" ? JSON.parse(d.value) : d.value;
          if (val && typeof val === "object") { setStats((p) => ({ ...p, ...val })); return; }
        }
      } catch { /* fallback */ }
      try {
        const raw = localStorage.getItem("frameless_academy_stats");
        if (raw) setStats((p) => ({ ...p, ...JSON.parse(raw) }));
      } catch { /* ignore */ }
    }
    fetchStats();
  }, []);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    queryFn:  () => fetch("/api/courses").then(r => r.json()),
  });

  // ── Fix: tampilkan course yang isPublished !== false
  // Sebelumnya filter packages?.length > 0 → tidak tampil kalau belum ada paket
  const pubCourses = courses.filter(c => c.isPublished !== false);

  const filtered = pubCourses.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      c.title.toLowerCase().includes(q) ||
      (c.subtitle || "").toLowerCase().includes(q) ||
      (c.instructor || "").toLowerCase().includes(q) ||
      (c.category  || "").toLowerCase().includes(q);
    const matchLevel = levelFilter === "Semua" || c.level === levelFilter;
    return matchSearch && matchLevel;
  });

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ textAlign: "center" }}>
        {/* Animated film-strip loader */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              style={{
                width: 10, height: 36, borderRadius: 4,
                background: ORANGE,
                opacity: 0.3,
                animation: `barPulse 1s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
        <p style={{ color: TEXT_DIM, fontSize: 13, fontWeight: 600, letterSpacing: ".1em" }}>
          Memuat kelas...
        </p>
      </div>
      <style>{`
        @keyframes barPulse { from { opacity:.15; transform:scaleY(.6); } to { opacity:1; transform:scaleY(1); } }
      `}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: font, paddingBottom: 80 }}>
      <style>{`
        body { background: ${BG}; }
        @keyframes fadeUp    { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin      { to   { transform:rotate(360deg); } }
        @keyframes barPulse  { from { opacity:.15; transform:scaleY(.6); } to { opacity:1; transform:scaleY(1); } }
        @keyframes shimmer   { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
        @keyframes statPop   { from{opacity:0;transform:translateY(10px) scale(.97);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes scanline  { 0%{transform:translateY(-100vh);} 100%{transform:translateY(100vh);} }

        /* Cards */
        .cc {
          animation: fadeUp 0.5s cubic-bezier(.16,1,.3,1) backwards;
          transition: transform .32s cubic-bezier(.16,1,.3,1), box-shadow .28s, border-color .22s;
          will-change: transform;
        }
        .cc:hover {
          transform: translateY(-7px) scale(1.01);
          box-shadow: 0 24px 56px rgba(0,0,0,.5), 0 0 28px ${ORANGE_DIM};
          border-color: ${ORANGE_BORD} !important;
        }
        .cc:hover .cc-cta {
          background: hsl(20,100%,50%) !important;
          box-shadow: 0 6px 20px ${ORANGE_DIM};
        }
        .cc:hover .cc-thumb img { transform: scale(1.06); }

        /* Filter pills */
        .lvl-btn {
          padding: 7px 18px; border-radius: 100px;
          border: 1px solid ${BORDER}; background: transparent;
          color: ${TEXT_DIM}; font-family: ${font};
          font-size: 12px; font-weight: 700; cursor: pointer;
          transition: all .22s cubic-bezier(.16,1,.3,1); white-space: nowrap;
        }
        .lvl-btn:hover   { color: #fff; border-color: rgba(255,255,255,.28); transform: translateY(-1px); }
        .lvl-btn.active  {
          background: ${ORANGE_DIM}; border-color: ${ORANGE_BORD};
          color: ${ORANGE}; box-shadow: 0 0 14px ${ORANGE_DIM};
        }

        /* Stat tiles */
        .stat-tile {
          transition: transform .28s cubic-bezier(.16,1,.3,1), border-color .22s, box-shadow .22s;
          animation: statPop .5s cubic-bezier(.16,1,.3,1) backwards;
        }
        .stat-tile:hover {
          transform: translateY(-3px);
          border-color: ${ORANGE_BORD} !important;
          box-shadow: 0 10px 32px rgba(0,0,0,.4), 0 0 18px ${ORANGE_DIM};
        }

        /* Search */
        .cs-search:focus {
          outline: none;
          border-color: ${ORANGE_BORD} !important;
          box-shadow: 0 0 0 3px ${ORANGE_DIM};
        }

        /* Headline shimmer */
        .heading-shimmer {
          background: linear-gradient(90deg, ${ORANGE} 0%, hsl(30,100%,65%) 40%, ${ORANGE} 80%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 5s linear infinite;
        }

        /* Thumb hover */
        .cc-thumb img { transition: transform .5s cubic-bezier(.16,1,.3,1); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ position: "relative", padding: "72px 24px 48px", textAlign: "center", borderBottom: `1px solid ${BORDER}`, overflow: "hidden" }}>
        {/* Mesh blobs */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", width: "60%", height: "60%", top: "-20%", left: "-10%", background: `radial-gradient(ellipse at center, ${ORANGE}18 0%, transparent 70%)`, filter: "blur(72px)", animation: "none" }} />
          <div style={{ position: "absolute", width: "50%", height: "50%", top: "0%", right: "-15%", background: "radial-gradient(ellipse at center, rgba(124,58,237,.1) 0%, transparent 70%)", filter: "blur(80px)" }} />
          <div style={{ position: "absolute", left: 0, right: 0, height: "1px", bottom: 0, background: `linear-gradient(to right, transparent, ${ORANGE}3c, transparent)` }} />
        </div>

        <div style={{ position: "relative" }}>
          <a
            href="/"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "7px 16px", borderRadius: 100,
              background: "rgba(255,255,255,.04)", border: `1px solid ${BORDER}`,
              color: TEXT_DIM, textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 32,
              transition: "color .18s, border-color .18s",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,.2)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = TEXT_DIM; e.currentTarget.style.borderColor = BORDER; }}
          >
            <ArrowLeft size={13} /> Kembali ke Home
          </a>

          {/* Eyebrow */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 16px", borderRadius: 100,
            background: `${ORANGE}14`, border: `1px solid ${ORANGE}33`,
            fontSize: 10, fontWeight: 700, letterSpacing: ".22em",
            color: ORANGE, textTransform: "uppercase", marginBottom: 18,
          }}>
            <Film size={10} /> Frameless Academy
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: "clamp(38px,5.5vw,68px)", fontWeight: 900, letterSpacing: "-.045em", margin: "0 0 14px", lineHeight: .98 }}>
            Kelas yang <span className="heading-shimmer">Tersedia</span>
          </h1>
          <p style={{ color: TEXT_DIM, fontSize: 15, margin: "0 0 40px", lineHeight: 1.7, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            {stats.tagline}
          </p>

          {/* Stats — premium hover cards */}
          <div style={{ display: "inline-flex", gap: 10, marginBottom: 36, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { val: pubCourses.length, lbl: "Kelas", delay: "0s" },
              { val: stats.alumni,      lbl: "Alumni", delay: ".07s" },
              { val: stats.rating,      lbl: "Rating", delay: ".14s" },
            ].map((s, i) => (
              <div
                key={s.lbl}
                className="stat-tile"
                style={{
                  padding: "16px 28px", textAlign: "center",
                  background: "rgba(255,255,255,.03)",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 18, backdropFilter: "blur(12px)",
                  animationDelay: s.delay,
                }}
              >
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", letterSpacing: "-.04em", lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 10, color: TEXT_DIM, textTransform: "uppercase", letterSpacing: ".14em", marginTop: 6, fontWeight: 700 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative", maxWidth: 440, margin: "0 auto 20px" }}>
            <Search
              size={15} color={TEXT_DIM}
              style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari kelas, instruktur..."
              className="cs-search"
              style={{
                width: "100%", padding: "13px 18px 13px 46px", borderRadius: 100,
                border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.045)",
                color: "#fff", fontSize: 14, fontFamily: font,
                boxSizing: "border-box", transition: "border-color .18s, box-shadow .18s",
              }}
            />
          </div>

          {/* Level filters */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            {LEVELS.map(l => (
              <button key={l} onClick={() => setLevelFilter(l)} className={`lvl-btn${levelFilter === l ? " active" : ""}`}>
                {l === "Semua" ? "Semua Level" : l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "52px 20px 0" }}>

        {/* Result count */}
        {(search || levelFilter !== "Semua") && (
          <p style={{ color: TEXT_DIM, fontSize: 13, marginBottom: 24 }}>
            {filtered.length} kelas ditemukan
            {search && <> untuk "<strong style={{ color: "#fff" }}>{search}</strong>"</>}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 26 }}>
          {filtered.map((course, idx) => {
            const pkgs    = course.packages?.filter(p => p.isActive !== false) ?? [];
            const trial   = pkgs.find(p => p.isTrial);
            const paid    = pkgs.filter(p => !p.isTrial);
            const minPr   = paid.length ? Math.min(...paid.map(p => Number(p.price))) : 0;
            const feats   = (() => {
              const f = paid[0]?.features || trial?.features || "";
              try { const a = JSON.parse(f); return Array.isArray(a) ? a : []; }
              catch { return f.split("\n").filter(Boolean); }
            })();

            return (
              <a
                key={course.id}
                href={courseHref(course.slug)}
                className="cc"
                style={{
                  textDecoration: "none", display: "flex", flexDirection: "column",
                  borderRadius: 24, overflow: "hidden",
                  border: `1.5px solid ${BORDER}`,
                  background: "rgba(255,255,255,.022)",
                  animationDelay: `${idx * 0.06}s`,
                }}
              >
                {/* ── Thumbnail ── */}
                <div
                  className="cc-thumb"
                  style={{
                    aspectRatio: "16/9", position: "relative", overflow: "hidden",
                    background: course.thumbnail
                      ? `url(${course.thumbnail}) center/cover`
                      : "linear-gradient(135deg,#1a0800,#3d1500)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {!course.thumbnail && <Film size={44} color="rgba(255,255,255,.12)" />}

                  {/* Gradient overlay */}
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.78) 0%, rgba(0,0,0,.08) 55%, transparent 100%)" }} />

                  {/* Play button if has video */}
                  {course.highlightVideoUrl && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: "50%",
                        background: "rgba(255,255,255,.12)", backdropFilter: "blur(8px)",
                        border: "2px solid rgba(255,255,255,.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform .25s, background .25s",
                      }}>
                        <Play size={20} fill="#fff" color="#fff" />
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 6, zIndex: 2 }}>
                    {course.level && (
                      <span style={{ background: ORANGE_DIM, border: `1px solid ${ORANGE_BORD}`, color: ORANGE, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, backdropFilter: "blur(8px)" }}>
                        {course.level}
                      </span>
                    )}
                    {course.category && (
                      <span style={{ background: "rgba(0,0,0,.45)", color: "rgba(255,255,255,.6)", fontSize: 10, padding: "3px 10px", borderRadius: 100, backdropFilter: "blur(8px)" }}>
                        {course.category}
                      </span>
                    )}
                    {trial && (
                      <span style={{ background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.3)", color: "#4ade80", fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, backdropFilter: "blur(8px)" }}>
                        Trial
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Content ── */}
                <div style={{ padding: "20px 20px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-.02em", lineHeight: 1.25 }}>
                    {course.title}
                  </h3>
                  {course.subtitle && (
                    <p style={{ fontSize: 13, color: TEXT_DIM, margin: "0 0 10px", lineHeight: 1.55 }}>
                      {course.subtitle}
                    </p>
                  )}
                  {course.instructor && (
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,.27)", margin: "0 0 12px" }}>
                      Instruktur: <strong style={{ color: "rgba(255,255,255,.52)" }}>{course.instructor}</strong>
                    </p>
                  )}

                  {/* Features */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, flex: 1 }}>
                    {(feats.length > 0
                      ? feats.slice(0, 3)
                      : ["Kurikulum terstruktur", "Sertifikat resmi", trial ? "Trial gratis" : "Materi pro"]
                    ).map((f: string) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(255,255,255,.44)" }}>
                        <Check size={11} color={ORANGE} style={{ flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Price + CTA */}
                  <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      {minPr > 0 ? (
                        <>
                          <p style={{ fontSize: 9, color: TEXT_DIM, margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".1em" }}>Mulai dari</p>
                          <p style={{ fontSize: 20, fontWeight: 900, color: ORANGE, margin: 0, letterSpacing: "-.03em" }}>
                            {formatCurrency(minPr)}
                          </p>
                        </>
                      ) : (
                        <p style={{ fontSize: 18, fontWeight: 900, color: ORANGE, margin: 0 }}>GRATIS</p>
                      )}
                    </div>
                    <div
                      className="cc-cta"
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "10px 18px", borderRadius: 100,
                        background: ORANGE, color: "#fff", fontSize: 12, fontWeight: 800,
                        transition: "background .18s, box-shadow .18s",
                        boxShadow: `0 4px 16px ${ORANGE_DIM}`,
                      }}
                    >
                      Daftar <ChevronRight size={13} />
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* ── Empty state ── */}
        {filtered.length === 0 && !isLoading && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: "50%",
                background: ORANGE_DIM, border: `1px solid ${ORANGE_BORD}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Film size={28} color={ORANGE} />
            </div>
            {pubCourses.length === 0 ? (
              <>
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Kelas segera hadir
                </p>
                <p style={{ color: TEXT_DIM, fontSize: 14 }}>
                  Frameless Academy sedang menyiapkan materi terbaik untuk kamu.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                  Tidak ada kelas yang cocok
                </p>
                <p style={{ color: TEXT_DIM, fontSize: 14, marginBottom: 20 }}>
                  Coba ubah kata kunci atau filter level.
                </p>
                <button
                  onClick={() => { setSearch(""); setLevelFilter("Semua"); }}
                  style={{
                    padding: "10px 22px", borderRadius: 100,
                    border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.05)",
                    color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: "pointer", fontFamily: font,
                  }}
                >
                  Reset Filter
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
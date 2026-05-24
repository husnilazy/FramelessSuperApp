import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Play } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

const ORANGE = "hsl(20,100%,58%)";
const BG = "#0a0a0c";
const font = "'Plus Jakarta Sans', sans-serif";

function courseHref(slug: string) {
  return `/course/${encodeURIComponent(slug)}`;
}

interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
}

interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; highlightVideoUrl?: string; instructor?: string; level?: string; category?: string;
  packages: Package[];
}

export default function CoursesPage() {
  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ["/api/courses"],
    queryFn: () => fetch("/api/courses").then(r => r.json())
  });

  const pubCourses = courses.filter(c => c.packages?.length > 0);

  if (isLoading) return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${ORANGE}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: font, paddingBottom: 60 }}>
      <style>{`
        body { background: ${BG}; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .course-card { animation: fadeUp 0.6s ease-out backwards; }
        .course-card:hover { transform: translateY(-8px); }
      `}</style>

      {/* Header */}
      <div style={{ padding: "40px 20px", textAlign: "center", borderBottom: `1px solid rgba(255,255,255,.06)` }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 100, background: "rgba(255,255,255,.05)", color: "rgba(255,255,255,.6)", textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
          <ArrowLeft size={14} /> Kembali
        </a>
        <h1 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, letterSpacing: "-.03em", margin: "0 0 12px", lineHeight: 1.1 }}>
          Frameless <span style={{ color: ORANGE }}>Academy</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,.4)", fontSize: 16, margin: "0 0 20px" }}>Kuasai videografi dari sineas profesional</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap", fontSize: 13, color: "rgba(255,255,255,.6)" }}>
          <div><strong style={{ color: "#fff", fontSize: 18 }}>{pubCourses.length}</strong> Kelas Tersedia</div>
          <div><strong style={{ color: "#fff", fontSize: 18 }}>500+</strong> Alumni</div>
          <div><strong style={{ color: "#fff", fontSize: 18 }}>4.9/5</strong> Rating</div>
        </div>
      </div>

      {/* Courses Grid */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 28 }}>
          {pubCourses.map((course, idx) => {
            const pkgs = course.packages.filter(p => p.isActive !== false);
            const trial = pkgs.find(p => p.isTrial), paid = pkgs.filter(p => !p.isTrial);
            const minPr = paid.length ? Math.min(...paid.map(p => Number(p.price))) : 0;
            const feats = (() => { const f = paid[0]?.features || trial?.features || ""; try { return JSON.parse(f); } catch { return f.split("\n").filter(Boolean).slice(0, 4); } })();

            return (
              <a key={course.id} href={courseHref(course.slug)} className="course-card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", borderRadius: 24, overflow: "hidden", border: `1.5px solid rgba(255,255,255,.08)`, background: "rgba(255,255,255,.022)", transition: "all .28s", cursor: "pointer" }}>
                {/* Video Highlight or Thumbnail */}
                <div style={{ aspectRatio: "16/9", background: course.thumbnail ? `url(${course.thumbnail}) center/cover` : `linear-gradient(135deg,#1a0800,#3d1500)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {course.highlightVideoUrl ? (
                    <>
                      <div style={{ position: "absolute", inset: 0, background: `url(${course.thumbnail}) center/cover` }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <div style={{ width: 60, height: 60, borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .2s" }}>
                          <Play size={24} fill="#fff" color="#fff" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {!course.thumbnail && <span style={{ fontSize: 48 }}>🎬</span>}
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,.65) 0%,transparent 60%)" }} />
                    </>
                  )}
                  <div style={{ position: "absolute", bottom: 12, left: 14, display: "flex", gap: 6, zIndex: 2 }}>
                    <span style={{ background: `${ORANGE}22`, border: `1px solid ${ORANGE}44`, color: ORANGE, fontSize: 10, padding: "3px 10px", borderRadius: 100, fontWeight: 700, backdropFilter: "blur(8px)" }}>{course.level}</span>
                    {course.category && <span style={{ background: "rgba(0,0,0,.35)", color: "rgba(255,255,255,.6)", fontSize: 10, padding: "3px 10px", borderRadius: 100, backdropFilter: "blur(8px)" }}>{course.category}</span>}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: "20px 20px 24px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: "0 0 6px", letterSpacing: "-.02em", lineHeight: 1.2 }}>{course.title}</h3>
                  {course.subtitle && <p style={{ fontSize: 13, color: "rgba(255,255,255,.42)", margin: "0 0 12px", lineHeight: 1.55 }}>{course.subtitle}</p>}
                  {course.instructor && <p style={{ fontSize: 11, color: "rgba(255,255,255,.27)", margin: "0 0 12px" }}>Instruktur: <strong style={{ color: "rgba(255,255,255,.55)" }}>{course.instructor}</strong></p>}

                  {/* Features */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18, flex: 1 }}>
                    {(feats.length > 0 ? feats.slice(0, 3) : ["Kurikulum terstruktur", "Sertifikat resmi", trial ? "Trial gratis" : "Materi pro"]).map((f: string) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,.47)" }}>
                        <Check size={11} color={ORANGE} style={{ flexShrink: 0 }} />
                        {f}
                      </div>
                    ))}
                  </div>

                  {/* Price & CTA */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      {minPr > 0 ? (
                        <>
                          <p style={{ fontSize: 9, color: "rgba(255,255,255,.27)", margin: "0 0 1px", textTransform: "uppercase", letterSpacing: ".08em" }}>Mulai dari</p>
                          <p style={{ fontSize: 20, fontWeight: 900, color: ORANGE, margin: 0 }}>{formatCurrency(minPr)}</p>
                        </>
                      ) : trial && (
                        <p style={{ fontSize: 17, fontWeight: 800, color: ORANGE, margin: 0 }}>GRATIS</p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 16px", borderRadius: 100, background: ORANGE, color: "#fff", fontSize: 12, fontWeight: 700 }}>
                      Lihat <ChevronRight size={12} />
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {pubCourses.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ color: "rgba(255,255,255,.33)", fontSize: 16 }}>Kursus segera hadir...</p>
          </div>
        )}
      </div>
    </div>
  );
}

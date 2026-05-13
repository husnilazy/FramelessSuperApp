import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Save, Film, Package, Users, ChevronDown, ChevronRight, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Package { id: string; name: string; price: string; isTrial: boolean; durationDays?: number; features?: string; description?: string; isActive?: boolean; }
interface Course { id: string; slug: string; title: string; subtitle?: string; description?: string; thumbnail?: string; instructor?: string; level?: string; category?: string; isPublished?: boolean; packages: Package[]; }

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }; }

export default function CoursesAdminPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [editingPkg, setEditingPkg] = useState<{ courseId: string; pkg: Partial<Package> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [tab, setTab] = useState<"courses" | "enrollments">("courses");

  useEffect(() => { loadCourses(); loadEnrollments(); }, []);

  async function loadCourses() {
    const res = await fetch("/api/courses");
    if (res.ok) setCourses(await res.json());
    setLoading(false);
  }

  async function loadEnrollments() {
    const res = await fetch("/api/enrollments", { headers: authHeader() as any });
    if (res.ok) setEnrollments(await res.json());
  }

  async function saveCourse() {
    if (!editingCourse) return;
    const method = editingCourse.id ? "PUT" : "POST";
    const url = editingCourse.id ? `/api/courses/${editingCourse.id}` : "/api/courses";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(editingCourse) });
    if (res.ok) { toast({ title: "Course tersimpan" }); loadCourses(); setEditingCourse(null); }
  }

  async function deleteCourse(id: string) {
    if (!confirm("Hapus course ini?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadCourses();
  }

  async function savePkg() {
    if (!editingPkg) return;
    const { courseId, pkg } = editingPkg;
    const method = pkg.id ? "PUT" : "POST";
    const url = pkg.id ? `/api/course-packages/${pkg.id}` : `/api/courses/${courseId}/packages`;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(pkg) });
    if (res.ok) { toast({ title: "Paket tersimpan" }); loadCourses(); setEditingPkg(null); }
  }

  async function deletePkg(id: string) {
    await fetch(`/api/course-packages/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadCourses();
  }

  async function togglePublish(course: Course) {
    await fetch(`/api/courses/${course.id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify({ isPublished: !course.isPublished }) });
    loadCourses();
  }

  async function updateEnrollment(id: string, status: string) {
    await fetch(`/api/enrollments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify({ status }) });
    loadEnrollments();
    toast({ title: "Status diperbarui" });
  }

  return (
    <div className="pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wider text-white">Videography Courses</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">Kelola course, paket, dan pendaftaran</p>
        </div>
        <Button onClick={() => setEditingCourse({ level: "beginner", category: "videography", isPublished: true, packages: [] })}
          className="bg-primary hover:bg-primary/90 font-heading tracking-wider">
          <Plus className="w-4 h-4 mr-2" />Tambah Course
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-white/10 w-fit">
        {(["courses", "enrollments"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>
            {t === "courses" ? "📽️ Courses" : `📋 Pendaftaran (${enrollments.length})`}
          </button>
        ))}
      </div>

      {tab === "courses" && (
        <div className="space-y-4">
          {courses.map(course => (
            <div key={course.id} className="glass-panel rounded-xl border-white/10 overflow-hidden">
              <div className="p-5 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(expanded === course.id ? null : course.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Film className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{course.title}</div>
                    <div className="text-xs text-muted-foreground">{course.slug} · {course.level} · {course.packages.length} paket</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={e => { e.stopPropagation(); togglePublish(course); }} className={`text-xs px-3 py-1 rounded-full border ${course.isPublished ? "text-green-400 border-green-400/30 bg-green-400/10" : "text-muted-foreground border-white/10 bg-white/5"}`}>
                    {course.isPublished ? <><Eye className="w-3 h-3 inline mr-1" />Publik</> : <><EyeOff className="w-3 h-3 inline mr-1" />Draft</>}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditingCourse(course); }} className="text-xs px-3 py-1 rounded-full border border-white/20 text-white bg-white/5 hover:bg-white/10">Edit</button>
                  <button onClick={e => { e.stopPropagation(); deleteCourse(course.id); }} className="text-xs px-3 py-1 rounded-full border border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20">Hapus</button>
                  {expanded === course.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expanded === course.id && (
                <div className="border-t border-white/10 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Paket Harga</p>
                    <Button size="sm" onClick={() => setEditingPkg({ courseId: course.id, pkg: { isTrial: false, isActive: true } })} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs">
                      <Plus className="w-3 h-3 mr-1" />Tambah Paket
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {course.packages.map(pkg => (
                      <div key={pkg.id} className={`rounded-xl p-4 border ${pkg.isTrial ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/3"}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-sm">{pkg.name}</div>
                          {pkg.isTrial && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Trial</span>}
                        </div>
                        <div className="text-lg font-bold text-primary">{Number(pkg.price) === 0 ? "Gratis" : formatCurrency(Number(pkg.price))}</div>
                        {pkg.durationDays && <div className="text-xs text-muted-foreground mt-1">{pkg.durationDays} hari</div>}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => setEditingPkg({ courseId: course.id, pkg })} className="text-xs text-white/60 hover:text-white">Edit</button>
                          <button onClick={() => deletePkg(pkg.id)} className="text-xs text-red-400 hover:text-red-300">Hapus</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {courses.length === 0 && !loading && (
            <div className="glass-panel rounded-xl p-12 border-white/10 text-center text-muted-foreground">
              <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Belum ada course. Buat course pertama!</p>
            </div>
          )}
        </div>
      )}

      {tab === "enrollments" && (
        <div className="glass-panel rounded-xl border-white/10 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-white/10">
              <tr>
                {["Nama", "Email", "Telepon", "Course", "Paket", "Status", "Tanggal", "Aksi"].map(h => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {enrollments.map(e => (
                <tr key={e.id} className="border-b border-white/5 hover:bg-white/2">
                  <td className="p-4 text-sm font-medium text-white">{e.name}</td>
                  <td className="p-4 text-sm text-muted-foreground">{e.email}</td>
                  <td className="p-4 text-sm text-muted-foreground">{e.phone || "—"}</td>
                  <td className="p-4 text-sm text-muted-foreground">{e.courseId?.slice(0, 8)}...</td>
                  <td className="p-4 text-sm text-muted-foreground">{e.packageId?.slice(0, 8)}...</td>
                  <td className="p-4">
                    <select value={e.status} onChange={ev => updateEnrollment(e.id, ev.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                      <option value="pending">Pending</option><option value="confirmed">Confirmed</option>
                      <option value="active">Active</option><option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="p-4 text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleDateString("id-ID")}</td>
                  <td className="p-4 text-xs">
                    <a href={`mailto:${e.email}`} className="text-primary hover:underline">Kirim Email</a>
                  </td>
                </tr>
              ))}
              {enrollments.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Belum ada pendaftaran</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white">{editingCourse.id ? "Edit Course" : "Tambah Course"}</h3>
            {[["title", "Judul Course", "text"], ["slug", "Slug (URL)", "text"], ["subtitle", "Subtitle", "text"], ["instructor", "Instruktur", "text"], ["thumbnail", "URL Thumbnail", "text"]].map(([k, l, t]) => (
              <div key={k} className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">{l}</label>
                <Input value={(editingCourse as any)[k] || ""} onChange={e => setEditingCourse(p => ({...p!, [k]: e.target.value}))} className="bg-white/5 border-white/10 text-white" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Level</label>
                <select value={editingCourse.level || "beginner"} onChange={e => setEditingCourse(p => ({...p!, level: e.target.value}))} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Kategori</label>
                <Input value={editingCourse.category || ""} onChange={e => setEditingCourse(p => ({...p!, category: e.target.value}))} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Deskripsi Lengkap</label>
              <Textarea value={editingCourse.description || ""} onChange={e => setEditingCourse(p => ({...p!, description: e.target.value}))} className="bg-white/5 border-white/10 text-white" rows={4} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingCourse(null)} variant="ghost" className="flex-1 text-muted-foreground">Batal</Button>
              <Button onClick={saveCourse} className="flex-2 bg-primary hover:bg-primary/90">Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">{editingPkg.pkg.id ? "Edit Paket" : "Tambah Paket"}</h3>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Paket</label>
              <Input value={editingPkg.pkg.name || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, name: e.target.value}}))} className="bg-white/5 border-white/10 text-white" placeholder="Basic, Pro, Premium..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Deskripsi</label>
              <Input value={editingPkg.pkg.description || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, description: e.target.value}}))} className="bg-white/5 border-white/10 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Harga (IDR)</label>
                <Input type="number" value={editingPkg.pkg.price || "0"} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, price: e.target.value}}))} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Durasi (hari)</label>
                <Input type="number" value={editingPkg.pkg.durationDays || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, durationDays: Number(e.target.value)}}))} className="bg-white/5 border-white/10 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Fitur (1 per baris)</label>
              <Textarea
                value={(() => { try { const a = JSON.parse(editingPkg.pkg.features || "[]"); return Array.isArray(a) ? a.join("\n") : editingPkg.pkg.features || ""; } catch { return editingPkg.pkg.features || ""; } })()}
                onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, features: JSON.stringify(e.target.value.split("\n").filter(Boolean))}}))}
                className="bg-white/5 border-white/10 text-white" rows={4} placeholder="Fitur 1&#10;Fitur 2&#10;Fitur 3"
              />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isTrial" checked={editingPkg.pkg.isTrial || false} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, isTrial: e.target.checked}}))} />
              <label htmlFor="isTrial" className="text-sm text-white">Ini adalah paket Trial</label>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingPkg(null)} variant="ghost" className="flex-1 text-muted-foreground">Batal</Button>
              <Button onClick={savePkg} className="flex-2 bg-primary hover:bg-primary/90">Simpan</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

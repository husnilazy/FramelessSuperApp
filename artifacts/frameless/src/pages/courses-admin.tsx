import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Film, Users, Eye, EyeOff, X, Check, Upload, ChevronDown, ChevronRight, ExternalLink, FileText, Video, Link, BookOpen, Edit3 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Package { id: string; name: string; price: string; isTrial: boolean; durationDays?: number; features?: string; description?: string; isActive?: boolean; }
interface Material { id: string; title: string; description: string; url: string; type: string; orderIndex: number; isActive: boolean; }
interface Course { id: string; slug: string; title: string; subtitle?: string; description?: string; thumbnail?: string; highlightVideoUrl?: string; instructor?: string; level?: string; category?: string; isPublished?: boolean; curriculumPdfUrl?: string; packages: Package[]; materials?: Material[]; }
interface Enrollment { id: string; courseId: string; packageId: string; name: string; email: string; phone?: string; status: string; paymentStatus?: string; midtransOrderId?: string; paidAt?: string; notes?: string; createdAt: string; }
type CourseSaveState = { tone: "saving" | "success" | "error"; title: string; message: string; };

function authHeader() { return { Authorization: `Bearer ${localStorage.getItem("token") || ""}` }; }

function slugifyCourseValue(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isUrlLike(value?: string) {
  return !!value && /^https?:\/\//i.test(value.trim());
}

function normalizeCourseSlug(slug?: string, title?: string) {
  const source = isUrlLike(slug) ? (title || "") : (slug || title || "");
  return slugifyCourseValue(source);
}

function courseHref(slug: string) {
  return `/course/${encodeURIComponent(slug)}`;
}

function UploadBtn({
  value,
  onChange,
  label = "Upload",
  accept = "image/*,.pdf",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", f);
      const res = await fetch("/api/uploads", { method: "POST", headers: authHeader() as any, body: fd });
      const d = await res.json(); if (d.url) onChange(d.url);
    } finally { setUploading(false); }
  }
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={e => onChange(e.target.value)} className="bg-muted/30 border-border text-sm flex-1" placeholder="URL atau upload..." />
      <button onClick={() => ref.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all whitespace-nowrap">
        {uploading ? <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Upload className="w-3 h-3" />} {label}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  confirmed: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  active: "bg-green-500/15 text-green-400 border-green-500/25",
  completed: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/25",
};
const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-500/15 text-red-400 border-red-500/25",
  paid: "bg-green-500/15 text-green-400 border-green-500/25",
  failed: "bg-red-500/15 text-red-400 border-red-500/25",
};

export default function CoursesAdminPage() {
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [materials, setMaterials] = useState<Record<string, Material[]>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [editingPkg, setEditingPkg] = useState<{ courseId: string; pkg: Partial<Package> } | null>(null);
  const [editingMat, setEditingMat] = useState<{ courseId: string; mat: Partial<Material> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"courses" | "materials" | "enrollments">("courses");
  const [selectedCourseForMat, setSelectedCourseForMat] = useState<string>("");
  const [enrollmentNote, setEnrollmentNote] = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string>("");
  const [savingCourse, setSavingCourse] = useState(false);
  const [courseSaveState, setCourseSaveState] = useState<CourseSaveState | null>(null);

  useEffect(() => { loadCourses(); loadEnrollments(); }, []);

  function openCourseEditor(course: Partial<Course>) {
    setCourseSaveState(null);
    setEditingCourse({ ...course, slug: normalizeCourseSlug(course.slug, course.title) });
  }

  function closeCourseEditor() {
    if (savingCourse) return;
    setCourseSaveState(null);
    setEditingCourse(null);
  }

  async function loadCourses() {
    const res = await fetch("/api/courses"); if (res.ok) { const data = await res.json(); setCourses(data); if (data[0]) setSelectedCourseForMat(data[0].id); }
    setLoading(false);
  }
  async function loadEnrollments() {
    const res = await fetch("/api/enrollments", { headers: authHeader() as any });
    if (res.ok) { const data: Enrollment[] = await res.json(); setEnrollments(data); const notes: Record<string, string> = {}; data.forEach(e => { notes[e.id] = e.notes || ""; }); setEnrollmentNote(notes); }
  }
  async function loadMaterials(courseId: string) {
    const res = await fetch(`/api/courses/${courseId}/materials`, { headers: authHeader() as any });
    if (res.ok) { const data = await res.json(); setMaterials(prev => ({ ...prev, [courseId]: data })); }
  }

  async function saveCourse() {
    if (!editingCourse) return;
    const title = editingCourse.title?.trim() || "";
    const slug = normalizeCourseSlug(editingCourse.slug, title);

    if (!title || !slug) {
      const message = "Judul course wajib diisi. Slug akan dibuat otomatis dari judul.";
      setCourseSaveState({ tone: "error", title: "Data course belum lengkap", message });
      toast({ variant: "destructive", title: "Data course belum lengkap", description: message });
      return;
    }

    const payload = {
      slug,
      title,
      subtitle: editingCourse.subtitle?.trim() || null,
      description: editingCourse.description?.trim() || null,
      thumbnail: editingCourse.thumbnail?.trim() || null,
      highlightVideoUrl: editingCourse.highlightVideoUrl?.trim() || null,
      instructor: editingCourse.instructor?.trim() || null,
      level: editingCourse.level || "beginner",
      category: editingCourse.category?.trim() || "videography",
      isPublished: editingCourse.isPublished ?? true,
      curriculumPdfUrl: editingCourse.curriculumPdfUrl?.trim() || null,
    };

    const method = editingCourse.id ? "PUT" : "POST";
    const url = editingCourse.id ? `/api/courses/${editingCourse.id}` : "/api/courses";
    const successTitle = editingCourse.id ? "Course berhasil diperbarui" : "Course baru berhasil dibuat";
    setSavingCourse(true);
    setCourseSaveState({
      tone: "saving",
      title: editingCourse.id ? "Menyimpan perubahan course..." : "Membuat course baru...",
      message: "Tunggu sebentar, data course sedang dikirim ke server.",
    });
    setEditingCourse(prev => prev ? ({ ...prev, slug, title }) : prev);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Gagal menyimpan course");
      }
      setCourseSaveState({
        tone: "success",
        title: successTitle,
        message: "Perubahan sudah tersimpan. Landing page dan halaman detail ikut ter-update.",
      });
      toast({
        title: successTitle,
        description: "Data course sudah masuk dan siap tampil di website.",
        className: "border-emerald-500/25 bg-[#08150e] text-white",
      });
      await loadCourses();
      setTimeout(() => {
        setCourseSaveState(null);
        setEditingCourse(null);
      }, 900);
    } catch (err: any) {
      const message = err.message || "Gagal menyimpan course";
      setCourseSaveState({ tone: "error", title: "Simpan course gagal", message });
      toast({ variant: "destructive", title: "Simpan course gagal", description: message });
    } finally {
      setSavingCourse(false);
    }
  }
  async function deleteCourse(id: string) {
    if (!confirm("Hapus course ini?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadCourses();
  }
  async function togglePublish(course: Course) {
    await fetch(`/api/courses/${course.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify({
        slug: course.slug,
        title: course.title,
        subtitle: course.subtitle,
        description: course.description,
        thumbnail: course.thumbnail,
        highlightVideoUrl: course.highlightVideoUrl,
        instructor: course.instructor,
        level: course.level,
        category: course.category,
        curriculumPdfUrl: course.curriculumPdfUrl,
        isPublished: !course.isPublished,
      }),
    });
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
    await fetch(`/api/course-packages/${id}`, { method: "DELETE", headers: authHeader() as any }); loadCourses();
  }
  async function saveMat() {
    if (!editingMat) return;
    const { courseId, mat } = editingMat;
    const method = mat.id ? "PUT" : "POST";
    const url = mat.id ? `/api/course-materials/${mat.id}` : `/api/courses/${courseId}/materials`;
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(mat) });
    if (res.ok) { toast({ title: "Materi tersimpan" }); loadMaterials(courseId); setEditingMat(null); }
  }
  async function deleteMat(id: string, courseId: string) {
    await fetch(`/api/course-materials/${id}`, { method: "DELETE", headers: authHeader() as any }); loadMaterials(courseId);
  }
  async function updateEnrollment(id: string, updates: Partial<Enrollment>) {
    const res = await fetch(`/api/enrollments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", ...authHeader() } as any, body: JSON.stringify(updates) });
    if (res.ok) { loadEnrollments(); toast({ title: "Diperbarui" }); }
  }
  async function saveNote(id: string) {
    setSavingNote(id);
    await updateEnrollment(id, { notes: enrollmentNote[id] || "" });
    setSavingNote("");
  }

  const courseMap: Record<string, string> = {};
  courses.forEach(c => { courseMap[c.id] = c.title; });

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Videography Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola course, materi, dan pendaftaran siswa</p>
        </div>
        <Button onClick={() => openCourseEditor({ level: "beginner", category: "videography", isPublished: true, packages: [] })} className="bg-primary hover:bg-primary/90 text-white rounded-xl">
          <Plus className="w-4 h-4 mr-2" /> Tambah Course
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Total Course", v: courses.length, c: "text-foreground" },
          { l: "Total Siswa", v: enrollments.length, c: "text-primary" },
          { l: "Siswa Aktif", v: enrollments.filter(e => e.status === "active").length, c: "text-green-400" },
          { l: "Pembayaran Lunas", v: enrollments.filter(e => e.paymentStatus === "paid").length, c: "text-blue-400" },
        ].map(s => (
          <Card key={s.l} className="glass-panel border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.l}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-border w-fit flex-wrap">
        {(["courses", "materials", "enrollments"] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === "materials" && selectedCourseForMat) loadMaterials(selectedCourseForMat); }}
            className={`px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${tab === t ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
            {t === "courses" ? "🎬 Courses" : t === "materials" ? "📚 Materi" : `📋 Pendaftaran (${enrollments.length})`}
          </button>
        ))}
      </div>

      {/* ─── COURSES TAB ─── */}
      {tab === "courses" && (
        <div className="space-y-4">
          {courses.map(course => (
            <Card key={course.id} className="glass-panel border-border overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => setExpanded(expanded === course.id ? null : course.id)}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{course.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{course.slug} · {course.level} · {course.packages.length} paket</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={courseHref(course.slug)} target="_blank" className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3 h-3" /> Preview
                    </a>
                    <button onClick={e => { e.stopPropagation(); togglePublish(course); }}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border ${course.isPublished ? "text-green-400 border-green-400/25 bg-green-400/8" : "text-muted-foreground border-border bg-muted/25"}`}>
                      {course.isPublished ? "Publik" : "Draft"}
                    </button>
                    <button onClick={e => { e.stopPropagation(); openCourseEditor(course); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/25">
                      Edit
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteCourse(course.id); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-destructive/25 text-destructive bg-destructive/8">
                      Hapus
                    </button>
                    {expanded === course.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {expanded === course.id && (
                  <div className="border-t border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Paket Harga</p>
                      <Button size="sm" onClick={() => setEditingPkg({ courseId: course.id, pkg: { isTrial: false, isActive: true } })} className="bg-muted/40 text-foreground border border-border hover:bg-muted/60 rounded-xl text-xs">
                        <Plus className="w-3 h-3 mr-1" /> Tambah Paket
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {course.packages.map(pkg => (
                        <div key={pkg.id} className={`rounded-xl p-4 border ${pkg.isTrial ? "border-primary/25 bg-primary/5" : "border-border bg-card/50"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold text-sm text-foreground">{pkg.name}</div>
                            {pkg.isTrial && <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full">Trial</span>}
                          </div>
                          <div className="text-lg font-bold text-primary">{Number(pkg.price) === 0 ? "Gratis" : formatCurrency(Number(pkg.price))}</div>
                          {pkg.durationDays && <div className="text-xs text-muted-foreground mt-1">{pkg.durationDays} hari</div>}
                          <div className="flex gap-3 mt-3">
                            <button onClick={() => setEditingPkg({ courseId: course.id, pkg })} className="text-xs text-muted-foreground hover:text-foreground">Edit</button>
                            <button onClick={() => deletePkg(pkg.id)} className="text-xs text-destructive">Hapus</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {courses.length === 0 && !loading && (
            <Card className="glass-panel border-border">
              <CardContent className="p-12 text-center">
                <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Belum ada course. Buat course pertama!</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── MATERIALS TAB ─── */}
      {tab === "materials" && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Pilih Course</label>
              <select value={selectedCourseForMat} onChange={e => { setSelectedCourseForMat(e.target.value); loadMaterials(e.target.value); }}
                className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground min-w-52">
                {courses.map(c => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
              </select>
            </div>
            {selectedCourseForMat && (
              <Button onClick={() => setEditingMat({ courseId: selectedCourseForMat, mat: { type: "video", isActive: true, orderIndex: (materials[selectedCourseForMat]?.length || 0) * 10 } })}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl self-end">
                <Plus className="w-4 h-4 mr-2" /> Tambah Materi
              </Button>
            )}
          </div>

          {selectedCourseForMat && (
            <div className="space-y-3">
              {(materials[selectedCourseForMat] || []).map((m, i) => {
                const TypeIcon = m.type === "video" ? Video : m.type === "pdf" ? FileText : m.type === "link" ? Link : BookOpen;
                return (
                  <Card key={m.id} className={`glass-panel border-border ${!m.isActive ? "opacity-50" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{i + 1}. {m.title}</p>
                        {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                        {m.url && <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{m.url}</p>}
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-md bg-muted/30 text-muted-foreground border border-border capitalize">{m.type}</span>
                      <div className="flex gap-2 shrink-0">
                        <a href={m.url} target="_blank" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>
                        <button onClick={() => setEditingMat({ courseId: selectedCourseForMat, mat: m })} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteMat(m.id, selectedCourseForMat)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!(materials[selectedCourseForMat]?.length) && (
                <Card className="glass-panel border-border">
                  <CardContent className="p-10 text-center">
                    <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">Belum ada materi untuk course ini.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── ENROLLMENTS TAB ─── */}
      {tab === "enrollments" && (
        <div className="space-y-4">
          {enrollments.map(e => (
            <Card key={e.id} className="glass-panel border-border">
              <CardContent className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-bold text-sm">{e.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="font-bold text-foreground">{e.name}</div>
                      <div className="text-sm text-muted-foreground">{e.email}</div>
                      {e.phone && <div className="text-xs text-muted-foreground">{e.phone}</div>}
                      <div className="text-xs text-muted-foreground/60 mt-1">
                        {courseMap[e.courseId] || e.courseId.slice(0, 8) + "..."} · {new Date(e.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${STATUS_COLORS[e.status] || "bg-muted/30 text-muted-foreground border-border"}`}>
                      {e.status}
                    </span>
                    <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${PAYMENT_COLORS[e.paymentStatus || "unpaid"] || "bg-muted/30 text-muted-foreground border-border"}`}>
                      💰 {e.paymentStatus || "unpaid"}
                    </span>
                    {e.paidAt && <span className="text-[11px] text-muted-foreground">Lunas: {new Date(e.paidAt).toLocaleDateString("id-ID")}</span>}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <select value={e.status} onChange={ev => updateEnrollment(e.id, { status: ev.target.value })}
                      className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground">
                      {["pending", "confirmed", "active", "completed", "cancelled"].map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
                    </select>
                    <select value={e.paymentStatus || "unpaid"} onChange={ev => updateEnrollment(e.id, { paymentStatus: ev.target.value, ...(ev.target.value === "paid" ? { status: "active", paidAt: new Date().toISOString() } : {}) } as any)}
                      className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground">
                      {["unpaid", "paid", "failed"].map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={`mailto:${e.email}?subject=Konfirmasi Kelas Videografi&body=Halo ${e.name},%0A%0ASelamat bergabung di Frameless Academy!`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold">
                      ✉️ Email
                    </a>
                    {e.phone && (
                      <a href={`https://wa.me/${e.phone.replace(/\D/g, "")}`} target="_blank"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-semibold">
                        💬 WhatsApp
                      </a>
                    )}
                    <a href={`/portal/${e.id}`} target="_blank"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold">
                      <ExternalLink className="w-3 h-3" /> Portal
                    </a>
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3 flex items-start gap-2">
                  <textarea value={enrollmentNote[e.id] || ""} onChange={ev => setEnrollmentNote(p => ({...p, [e.id]: ev.target.value}))}
                    className="flex-1 bg-muted/20 border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none h-14"
                    placeholder="Catatan follow-up..." />
                  <button onClick={() => saveNote(e.id)} disabled={savingNote === e.id}
                    className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors">
                    {savingNote === e.id ? "..." : <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          {enrollments.length === 0 && (
            <Card className="glass-panel border-border">
              <CardContent className="p-12 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Belum ada pendaftaran.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{editingCourse.id ? "Edit Course" : "Tambah Course"}</h3>
              <button onClick={closeCourseEditor} disabled={savingCourse} className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"><X className="w-5 h-5" /></button>
            </div>
            {courseSaveState && (
              <div className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${
                courseSaveState.tone === "saving"
                  ? "border-primary/25 bg-primary/10"
                  : courseSaveState.tone === "success"
                    ? "border-emerald-500/25 bg-emerald-500/10"
                    : "border-red-500/25 bg-red-500/10"
              }`}>
                <div className={`absolute inset-y-0 left-0 w-24 blur-3xl opacity-40 ${
                  courseSaveState.tone === "saving"
                    ? "bg-primary animate-pulse"
                    : courseSaveState.tone === "success"
                      ? "bg-emerald-400"
                      : "bg-red-400"
                }`} />
                <div className="relative flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                    courseSaveState.tone === "saving"
                      ? "border-primary/35 bg-primary/15"
                      : courseSaveState.tone === "success"
                        ? "border-emerald-500/35 bg-emerald-500/15"
                        : "border-red-500/35 bg-red-500/15"
                  }`}>
                    {courseSaveState.tone === "saving" ? (
                      <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    ) : courseSaveState.tone === "success" ? (
                      <Check className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <X className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{courseSaveState.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{courseSaveState.message}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Course</label>
              <Input
                value={editingCourse.title || ""}
                onChange={e => setEditingCourse(prev => {
                  if (!prev) return prev;
                  const nextTitle = e.target.value;
                  const shouldFollowTitle = !prev.slug || prev.slug === normalizeCourseSlug(prev.slug, prev.title);
                  return {
                    ...prev,
                    title: nextTitle,
                    ...(shouldFollowTitle ? { slug: normalizeCourseSlug(prev.slug, nextTitle) } : {}),
                  };
                })}
                className="bg-muted/30 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Slug (URL)</label>
              <Input
                value={editingCourse.slug || ""}
                onChange={e => setEditingCourse(prev => prev ? ({ ...prev, slug: normalizeCourseSlug(e.target.value, prev.title) }) : prev)}
                className="bg-muted/30 border-border"
                placeholder="video-editing-basics"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Link course: <span className="text-foreground">/course/{normalizeCourseSlug(editingCourse.slug, editingCourse.title) || "slug-course"}</span>. Slug dibersihkan otomatis saat kamu mengetik.
              </p>
            </div>
            {([["subtitle", "Subtitle"], ["instructor", "Instruktur"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{l}</label>
                <Input value={editingCourse[k] || ""} onChange={e => setEditingCourse(p => ({...p!, [k]: e.target.value}))} className="bg-muted/30 border-border" />
              </div>
            ))}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Thumbnail / Poster Course</label>
              <UploadBtn value={editingCourse.thumbnail || ""} onChange={url => setEditingCourse(p => ({...p!, thumbnail: url}))} label="Upload Gambar" accept="image/*" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Highlight / Banner Video</label>
              <UploadBtn
                value={editingCourse.highlightVideoUrl || ""}
                onChange={url => setEditingCourse(p => ({...p!, highlightVideoUrl: url}))}
                label="Upload Video"
                accept="video/*"
              />
              <p className="text-[11px] text-muted-foreground">Bisa upload MP4/WebM/MOV atau paste URL video YouTube/Vimeo.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kurikulum PDF URL</label>
              <UploadBtn value={editingCourse.curriculumPdfUrl || ""} onChange={url => setEditingCourse(p => ({...p!, curriculumPdfUrl: url}))} label="Upload PDF" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Level</label>
                <select value={editingCourse.level || "beginner"} onChange={e => setEditingCourse(p => ({...p!, level: e.target.value}))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                  {["beginner", "intermediate", "advanced"].map(l => <option key={l} value={l} className="bg-card">{l}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kategori</label>
                <Input value={editingCourse.category || ""} onChange={e => setEditingCourse(p => ({...p!, category: e.target.value}))} className="bg-muted/30 border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi</label>
              <Textarea value={editingCourse.description || ""} onChange={e => setEditingCourse(p => ({...p!, description: e.target.value}))} className="bg-muted/30 border-border" rows={4} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editingCourse.isPublished ?? true} onChange={e => setEditingCourse(p => ({...p!, isPublished: e.target.checked}))} className="w-4 h-4 accent-primary rounded" />
              <span className="text-sm text-foreground">Tampilkan di landing page</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button onClick={closeCourseEditor} variant="ghost" disabled={savingCourse} className="flex-1 rounded-xl disabled:opacity-50">Batal</Button>
              <Button onClick={saveCourse} disabled={savingCourse} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {savingCourse ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                    Menyimpan...
                  </span>
                ) : "Simpan Course"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{editingPkg.pkg.id ? "Edit Paket" : "Tambah Paket"}</h3>
              <button onClick={() => setEditingPkg(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nama Paket</label>
              <Input value={editingPkg.pkg.name || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, name: e.target.value}}))} className="bg-muted/30 border-border" placeholder="Basic, Pro, Premium..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi</label>
              <Input value={editingPkg.pkg.description || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, description: e.target.value}}))} className="bg-muted/30 border-border" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Harga (IDR)</label>
                <Input type="number" value={editingPkg.pkg.price || "0"} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, price: e.target.value}}))} className="bg-muted/30 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Durasi (hari)</label>
                <Input type="number" value={editingPkg.pkg.durationDays || ""} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, durationDays: Number(e.target.value)}}))} className="bg-muted/30 border-border" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Fitur (1 per baris)</label>
              <Textarea
                value={(() => { try { const a = JSON.parse(editingPkg.pkg.features || "[]"); return Array.isArray(a) ? a.join("\n") : editingPkg.pkg.features || ""; } catch { return editingPkg.pkg.features || ""; } })()}
                onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, features: JSON.stringify(e.target.value.split("\n").filter(Boolean))}}))}
                className="bg-muted/30 border-border" rows={4} placeholder={"Fitur 1\nFitur 2\nFitur 3"} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editingPkg.pkg.isTrial || false} onChange={e => setEditingPkg(p => p && ({...p, pkg: {...p.pkg, isTrial: e.target.checked}}))} className="w-4 h-4 accent-primary rounded" />
              <span className="text-sm text-foreground">Ini adalah paket Trial (gratis)</span>
            </label>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingPkg(null)} variant="ghost" className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={savePkg} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">Simpan Paket</Button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{editingMat.mat.id ? "Edit Materi" : "Tambah Materi"}</h3>
              <button onClick={() => setEditingMat(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Materi</label>
              <Input value={editingMat.mat.title || ""} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, title: e.target.value}}))} className="bg-muted/30 border-border" placeholder="Modul 1: Dasar Videografi" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tipe Materi</label>
              <select value={editingMat.mat.type || "video"} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, type: e.target.value}}))} className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {["video", "pdf", "doc", "link"].map(t => <option key={t} value={t} className="bg-card">{t}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">URL Konten</label>
              <Input value={editingMat.mat.url || ""} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, url: e.target.value}}))} className="bg-muted/30 border-border" placeholder="https://youtube.com/... atau link Drive" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi (opsional)</label>
              <Input value={editingMat.mat.description || ""} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, description: e.target.value}}))} className="bg-muted/30 border-border" placeholder="Keterangan singkat..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Urutan</label>
                <Input type="number" value={editingMat.mat.orderIndex ?? 0} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, orderIndex: Number(e.target.value)}}))} className="bg-muted/30 border-border" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={editingMat.mat.isActive ?? true} onChange={e => setEditingMat(p => p && ({...p, mat: {...p.mat, isActive: e.target.checked}}))} className="w-4 h-4 accent-primary rounded" />
                  <span className="text-sm text-foreground">Aktif</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingMat(null)} variant="ghost" className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={saveMat} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">Simpan Materi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

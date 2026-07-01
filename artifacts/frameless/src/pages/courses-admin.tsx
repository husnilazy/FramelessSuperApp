import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, Calendar, Check, ChevronDown, ChevronRight, ChevronUp, Clock,
  Download, Edit3, ExternalLink, Eye, EyeOff, FileText, Film,
  GripVertical, Image, Link, MapPin, MessageSquare, Plus, Save, Search, Settings, Trash2,
  Upload, Users, Video, X,
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Package {
  id: string; name: string; price: string; isTrial: boolean;
  originalPrice?: string;   // Harga asli sebelum diskon (null = tidak ada diskon)
  discountLabel?: string;   // Label diskon custom, e.g. "Promo Ramadan", "Early Bird"
  discountEndDate?: string; // Tanggal berakhir diskon (ISO string)
  durationDays?: number; features?: string; description?: string; isActive?: boolean;
  orderIndex?: number;
}
interface Material {
  id: string; title: string; description: string; url: string;
  type: string; orderIndex: number; isActive: boolean;
  durationMinutes?: number;
}
interface Course {
  id: string; slug: string; title: string; subtitle?: string; description?: string;
  thumbnail?: string; highlightVideoUrl?: string; instructor?: string; level?: string;
  category?: string; isPublished?: boolean; curriculumPdfUrl?: string;
  packages: Package[]; materials?: Material[]; orderIndex?: number;
}
interface Enrollment {
  id: string; courseId: string; packageId: string; name: string;
  email: string; phone?: string; status: string; paymentStatus?: string;
  midtransOrderId?: string; paidAt?: string; notes?: string;
  memberCode?: string; invoiceNumber?: string;
  createdAt: string;
}
interface AcademyStats { alumni: string; rating: string; tagline: string; }

interface Workshop {
  id: string; courseId: string; title: string; description?: string;
  date: string; endDate?: string; location: string; locationUrl?: string;
  price: string; quota: number; registeredCount?: number;
  isActive?: boolean; registrationUrl?: string;
  posterUrl?: string; videoUrl?: string; highlights?: string;
}

interface GalleryPhoto {
  id: string; courseId: string; url: string; caption?: string; orderIndex?: number;
}
type SaveState = { tone: "saving" | "success" | "error"; title: string; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function isUrlLike(v?: string) { return !!v && /^https?:\/\//i.test(v.trim()); }

function normalizeSlug(slug?: string, title?: string) {
  const src = isUrlLike(slug) ? (title || "") : (slug || title || "");
  return slugify(src);
}

function courseHref(slug: string) { return `/course/${encodeURIComponent(slug)}`; }

function exportCsvEnrollments(enrollments: Enrollment[], courseMap: Record<string, string>) {
  const headers = ["Nama", "Email", "WhatsApp", "Course", "Status", "Pembayaran", "Tanggal Daftar"];
  const rows = enrollments.map((e) => [
    e.name, e.email, e.phone || "",
    courseMap[e.courseId] || e.courseId,
    e.status, e.paymentStatus || "unpaid",
    new Date(e.createdAt).toLocaleDateString("id-ID"),
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `enrollments-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ─── Upload Button ────────────────────────────────────────────────────────────
function UploadBtn({
  value, onChange, label = "Upload",
  accept = "image/*,.pdf", showPreview = false,
}: {
  value: string; onChange: (url: string) => void;
  label?: string; accept?: string; showPreview?: boolean;
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
    } finally { setUploading(false); e.target.value = ""; }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-muted/30 border-border text-sm flex-1"
          placeholder="URL atau upload..."
        />
        <button
          onClick={() => ref.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/40 border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
        >
          {uploading
            ? <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            : <Upload className="w-3 h-3" />}
          {label}
        </button>
        <input ref={ref} type="file" accept={accept} className="hidden" onChange={handle} />
      </div>
      {showPreview && value && (value.startsWith("http") || value.startsWith("/")) && (
        <div className="relative w-full h-28 rounded-xl overflow-hidden border border-border bg-muted/20">
          <img src={value} alt="preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <button
            onClick={() => onChange("")}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center text-sm hover:bg-red-500/80 transition-colors"
          >×</button>
        </div>
      )}
    </div>
  );
}

// ─── Status colors ────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-500/12 text-yellow-400 border-yellow-500/25",
  confirmed: "bg-blue-500/12 text-blue-400 border-blue-500/25",
  active:    "bg-green-500/12 text-green-400 border-green-500/25",
  completed: "bg-purple-500/12 text-purple-400 border-purple-500/25",
  cancelled: "bg-red-500/12 text-red-400 border-red-500/25",
};
const PAYMENT_COLORS: Record<string, string> = {
  unpaid: "bg-red-500/12 text-red-400 border-red-500/25",
  paid:   "bg-green-500/12 text-green-400 border-green-500/25",
  failed: "bg-red-500/12 text-red-400 border-red-500/25",
};

// ─── Save Status Banner ───────────────────────────────────────────────────────
function SaveBanner({ state }: { state: SaveState }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border px-4 py-3 ${
        state.tone === "saving"  ? "border-primary/25 bg-primary/8" :
        state.tone === "success" ? "border-emerald-500/25 bg-emerald-500/8" :
                                   "border-red-500/25 bg-red-500/8"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-20 blur-2xl opacity-30 ${
          state.tone === "saving"  ? "bg-primary animate-pulse" :
          state.tone === "success" ? "bg-emerald-400" : "bg-red-400"
        }`}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border ${
            state.tone === "saving"  ? "border-primary/35 bg-primary/12" :
            state.tone === "success" ? "border-emerald-500/35 bg-emerald-500/12" :
                                       "border-red-500/35 bg-red-500/12"
          }`}
        >
          {state.tone === "saving"
            ? <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            : state.tone === "success"
              ? <Check className="h-4 w-4 text-emerald-400" />
              : <X className="h-4 w-4 text-red-400" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{state.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{state.message}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CoursesAdminPage() {
  const { toast } = useToast();

  // Data
  const [courses, setCourses]         = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [materials, setMaterials]     = useState<Record<string, Material[]>>({});
  const [loading, setLoading]         = useState(true);

  // UI state
  const [tab, setTab] = useState<"courses" | "packages" | "materials" | "enrollments" | "workshop" | "gallery" | "settings">("courses");
  const [expanded, setExpanded]           = useState<string | null>(null);
  const [selectedCourseForMat, setSelectedCourseForMat] = useState<string>("");

  // Modals
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null);
  const [editingPkg, setEditingPkg]       = useState<{ courseId: string; pkg: Partial<Package> } | null>(null);
  const [editingMat, setEditingMat]       = useState<{ courseId: string; mat: Partial<Material> } | null>(null);

  // Save state
  const [savingCourse, setSavingCourse]     = useState(false);
  const [courseSaveState, setCourseSaveState] = useState<SaveState | null>(null);
  const [savingNote, setSavingNote]         = useState<string>("");

  // Enrollments UI
  const [enrollmentNote, setEnrollmentNote] = useState<Record<string, string>>({});
  const [enrollSearch, setEnrollSearch]     = useState("");
  const [enrollStatusFilter, setEnrollStatusFilter] = useState("all");
  const [enrollPayFilter, setEnrollPayFilter]       = useState("all");
  const [selectedEnrollments, setSelectedEnrollments] = useState<Set<string>>(new Set());

  // Workshop & Gallery state
  const [workshops, setWorkshops]         = useState<Record<string, Workshop[]>>({});
  const [gallery, setGallery]             = useState<Record<string, GalleryPhoto[]>>({});
  const [selectedCourseForWs, setSelectedCourseForWs] = useState<string>("");
  const [selectedCourseForGal, setSelectedCourseForGal] = useState<string>("");
  const [editingWorkshop, setEditingWorkshop] = useState<{ courseId: string; ws: Partial<Workshop> } | null>(null);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Academy page stats (editable)
  const [academyStats, setAcademyStats] = useState<AcademyStats>({ alumni: "500+", rating: "4.9/5", tagline: "Kuasai videografi dari sineas profesional" });
  const [savingStats, setSavingStats]   = useState(false);
  const [statsSaved,  setStatsSaved]    = useState(false);

  // Revenue derived
  const totalRevenue = enrollments
    .filter((e) => e.paymentStatus === "paid")
    .reduce((acc, e) => {
      const course  = courses.find((c) => c.id === e.courseId);
      const pkg     = course?.packages.find((p) => p.id === e.packageId);
      return acc + (pkg ? Number(pkg.price) : 0);
    }, 0);

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => { loadCourses(); loadEnrollments(); loadStats(); }, []);

  async function loadCourses() {
    const res = await fetch("/api/courses");
    if (res.ok) {
      const data = await res.json();
      setCourses(data);
      if (data[0] && !selectedCourseForMat) setSelectedCourseForMat(data[0].id);
      if (data[0] && !selectedCourseForWs)  setSelectedCourseForWs(data[0].id);
      if (data[0] && !selectedCourseForGal) setSelectedCourseForGal(data[0].id);
    }
    setLoading(false);
  }

  async function loadEnrollments() {
    const res = await fetch("/api/enrollments", { headers: authHeader() as any });
    if (res.ok) {
      const data: Enrollment[] = await res.json();
      setEnrollments(data);
      const notes: Record<string, string> = {};
      data.forEach((e) => { notes[e.id] = e.notes || ""; });
      setEnrollmentNote(notes);
    }
  }

  // Stats disimpan via /api/cms sebagai key-value.
  // Fallback ke localStorage kalau endpoint belum ada.
  async function loadStats() {
    try {
      const res = await fetch("/api/cms/academy_stats", { headers: authHeader() as any });
      if (res.ok) {
        const d = await res.json();
        const val = typeof d.value === "string" ? JSON.parse(d.value) : d.value;
        if (val && typeof val === "object") setAcademyStats((p) => ({ ...p, ...val }));
        return;
      }
    } catch { /* fallback */ }
    // Fallback: localStorage
    try {
      const raw = localStorage.getItem("frameless_academy_stats");
      if (raw) setAcademyStats((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch { /* ignore */ }
  }

  async function saveStats() {
    setSavingStats(true);
    setStatsSaved(false);
    const payload = JSON.stringify(academyStats);
    let saved = false;
    try {
      // Coba simpan via /api/cms
      const res = await fetch("/api/cms/academy_stats", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ key: "academy_stats", value: payload }),
      });
      if (res.ok) saved = true;
    } catch { /* fallback */ }
    // Selalu simpan ke localStorage sebagai backup
    localStorage.setItem("frameless_academy_stats", payload);
    setSavingStats(false);
    setStatsSaved(true);
    toast({ title: "Pengaturan disimpan", description: saved ? "Tersimpan ke server." : "Tersimpan lokal (server CMS belum tersambung).", className: "border-emerald-500/25 bg-[#08150e] text-white" });
    setTimeout(() => setStatsSaved(false), 2500);
  }

  // ── Workshop CRUD ────────────────────────────────────────────────────────────
  async function loadWorkshops(courseId: string) {
    const res = await fetch(`/api/courses/${courseId}/workshops`, { headers: authHeader() as any });
    if (res.ok) {
      const data = await res.json();
      setWorkshops((prev) => ({ ...prev, [courseId]: data }));
    }
  }

  async function saveWorkshop() {
    if (!editingWorkshop) return;
    const { courseId, ws } = editingWorkshop;
    if (!ws.title?.trim() || !ws.date || !ws.location?.trim()) {
      toast({ variant: "destructive", title: "Judul, tanggal, dan lokasi wajib diisi" }); return;
    }
    const method = ws.id ? "PUT" : "POST";
    const url    = ws.id ? `/api/course-workshops/${ws.id}` : `/api/courses/${courseId}/workshops`;
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify(ws),
    });
    if (res.ok) {
      toast({ title: ws.id ? "Workshop diperbarui" : "Workshop ditambahkan" });
      loadWorkshops(courseId);
      setEditingWorkshop(null);
    } else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: d.error || "Gagal menyimpan workshop" });
    }
  }

  async function deleteWorkshop(id: string, courseId: string) {
    if (!confirm("Hapus workshop ini?")) return;
    await fetch(`/api/course-workshops/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadWorkshops(courseId);
  }

  // ── Gallery CRUD ─────────────────────────────────────────────────────────────
  async function loadGallery(courseId: string) {
    const res = await fetch(`/api/courses/${courseId}/gallery`, { headers: authHeader() as any });
    if (res.ok) {
      const data = await res.json();
      setGallery((prev) => ({ ...prev, [courseId]: data }));
    }
  }

  async function uploadGalleryFiles(files: FileList, courseId: string) {
    setUploadingGallery(true);
    let success = 0;
    for (const file of Array.from(files)) {
      try {
        // 1. Upload file ke storage
        const fd = new FormData(); fd.append("file", file);
        const upRes = await fetch("/api/uploads", { method: "POST", headers: authHeader() as any, body: fd });
        if (!upRes.ok) continue;
        const { url } = await upRes.json();
        // 2. Simpan ke gallery table
        const galRes = await fetch(`/api/courses/${courseId}/gallery`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader() } as any,
          body: JSON.stringify({ url, caption: "" }),
        });
        if (galRes.ok) success++;
      } catch { /* skip file */ }
    }
    setUploadingGallery(false);
    if (success > 0) { toast({ title: `${success} foto berhasil diupload` }); loadGallery(courseId); }
    else toast({ variant: "destructive", title: "Upload gagal" });
  }

  async function updateGalleryCaption(id: string, caption: string, courseId: string) {
    await fetch(`/api/course-gallery/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify({ caption }),
    });
    loadGallery(courseId);
  }

  async function deleteGalleryPhoto(id: string, courseId: string) {
    if (!confirm("Hapus foto ini?")) return;
    await fetch(`/api/course-gallery/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadGallery(courseId);
  }

  async function loadMaterials(courseId: string) {
    const res = await fetch(`/api/courses/${courseId}/materials`, { headers: authHeader() as any });
    if (res.ok) {
      const data = await res.json();
      setMaterials((prev) => ({ ...prev, [courseId]: data }));
    }
  }

  // ── Course CRUD ─────────────────────────────────────────────────────────────
  function openCourseEditor(course: Partial<Course>) {
    setCourseSaveState(null);
    setEditingCourse({ ...course, slug: normalizeSlug(course.slug, course.title) });
  }

  function closeCourseEditor() {
    if (savingCourse) return;
    setCourseSaveState(null);
    setEditingCourse(null);
  }

  async function saveCourse() {
    if (!editingCourse) return;
    const title = editingCourse.title?.trim() || "";
    const slug  = normalizeSlug(editingCourse.slug, title);

    if (!title || !slug) {
      const message = "Judul course wajib diisi.";
      setCourseSaveState({ tone: "error", title: "Data belum lengkap", message });
      toast({ variant: "destructive", title: "Data belum lengkap", description: message });
      return;
    }

    const payload = {
      slug, title,
      subtitle:          editingCourse.subtitle?.trim() || null,
      description:       editingCourse.description?.trim() || null,
      thumbnail:         editingCourse.thumbnail?.trim() || null,
      highlightVideoUrl: editingCourse.highlightVideoUrl?.trim() || null,
      instructor:        editingCourse.instructor?.trim() || null,
      level:             editingCourse.level || "beginner",
      category:          editingCourse.category?.trim() || "videography",
      isPublished:       editingCourse.isPublished ?? true,
      curriculumPdfUrl:  editingCourse.curriculumPdfUrl?.trim() || null,
      orderIndex:        editingCourse.orderIndex ?? 0,
    };

    const method = editingCourse.id ? "PUT" : "POST";
    const url    = editingCourse.id ? `/api/courses/${editingCourse.id}` : "/api/courses";
    setSavingCourse(true);
    setCourseSaveState({ tone: "saving", title: editingCourse.id ? "Menyimpan perubahan..." : "Membuat course baru...", message: "Tunggu sebentar..." });
    setEditingCourse((p) => p ? ({ ...p, slug, title }) : p);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan");

      setCourseSaveState({ tone: "success", title: editingCourse.id ? "Course diperbarui!" : "Course baru dibuat!", message: "Landing page dan detail halaman sudah ter-update." });
      toast({ title: editingCourse.id ? "Course diperbarui" : "Course baru dibuat", className: "border-emerald-500/25 bg-[#08150e] text-white" });
      await loadCourses();
      setTimeout(() => { setCourseSaveState(null); setEditingCourse(null); }, 900);
    } catch (err: any) {
      const message = err.message || "Gagal menyimpan";
      setCourseSaveState({ tone: "error", title: "Simpan gagal", message });
      toast({ variant: "destructive", title: "Simpan gagal", description: message });
    } finally {
      setSavingCourse(false);
    }
  }

  async function deleteCourse(id: string) {
    if (!confirm("Hapus course ini beserta semua paket dan materinya?")) return;
    await fetch(`/api/courses/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadCourses();
  }

  async function togglePublish(course: Course) {
    await fetch(`/api/courses/${course.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify({ ...course, packages: undefined, materials: undefined, isPublished: !course.isPublished }),
    });
    loadCourses();
  }

  // ── Package CRUD ─────────────────────────────────────────────────────────────
  async function savePkg() {
    if (!editingPkg) return;
    const { courseId, pkg } = editingPkg;
    const method = pkg.id ? "PUT" : "POST";
    const url    = pkg.id ? `/api/course-packages/${pkg.id}` : `/api/courses/${courseId}/packages`;
    const res    = await fetch(url, {
      method, headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify(pkg),
    });
    if (res.ok) { toast({ title: "Paket tersimpan" }); loadCourses(); setEditingPkg(null); }
    else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: d.error || "Gagal menyimpan paket" });
    }
  }

  async function deletePkg(id: string) {
    if (!confirm("Hapus paket ini?")) return;
    await fetch(`/api/course-packages/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadCourses();
  }

  // ── Material CRUD ────────────────────────────────────────────────────────────
  async function saveMat() {
    if (!editingMat) return;
    const { courseId, mat } = editingMat;
    const method = mat.id ? "PUT" : "POST";
    const url    = mat.id ? `/api/course-materials/${mat.id}` : `/api/courses/${courseId}/materials`;
    const res    = await fetch(url, {
      method, headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify(mat),
    });
    if (res.ok) { toast({ title: "Materi tersimpan" }); loadMaterials(courseId); setEditingMat(null); }
    else {
      const d = await res.json().catch(() => ({}));
      toast({ variant: "destructive", title: d.error || "Gagal menyimpan materi" });
    }
  }

  async function deleteMat(id: string, courseId: string) {
    if (!confirm("Hapus materi ini?")) return;
    await fetch(`/api/course-materials/${id}`, { method: "DELETE", headers: authHeader() as any });
    loadMaterials(courseId);
  }

  async function reorderMat(courseId: string, fromIdx: number, toIdx: number) {
    const list = [...(materials[courseId] || [])];
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    // Optimistic update
    setMaterials((prev) => ({ ...prev, [courseId]: list }));
    // Persist order
    await Promise.all(
      list.map((m, i) =>
        fetch(`/api/course-materials/${m.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() } as any,
          body: JSON.stringify({ ...m, orderIndex: i * 10 }),
        })
      )
    );
  }

  // ── Enrollment CRUD ──────────────────────────────────────────────────────────
  async function updateEnrollment(id: string, updates: Partial<Enrollment>) {
    const res = await fetch(`/api/enrollments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify(updates),
    });
    if (res.ok) { loadEnrollments(); toast({ title: "Diperbarui" }); }
  }

  async function saveNote(id: string) {
    setSavingNote(id);
    await updateEnrollment(id, { notes: enrollmentNote[id] || "" });
    setSavingNote("");
  }

  async function bulkUpdateStatus(status: string) {
    if (selectedEnrollments.size === 0) return;
    await Promise.all(
      [...selectedEnrollments].map((id) => updateEnrollment(id, { status }))
    );
    setSelectedEnrollments(new Set());
  }

  // Manual activation — panggil endpoint yang trigger email + memberCode
  async function activateEnrollment(id: string) {
    if (!confirm("Aktifkan enrollment ini dan kirim email akses ke member?")) return;
    try {
      const res = await fetch(`/api/payments/activate/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Enrollment diaktifkan",
          description: `Kode member: ${data.enrollment?.memberCode || "—"} — Email akses sudah dikirim.`,
          className: "border-emerald-500/25 bg-[#08150e] text-white",
        });
        loadEnrollments();
      } else {
        toast({ variant: "destructive", title: "Gagal aktivasi", description: data.error });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Network error", description: err?.message });
    }
  }

  // Resend access email
  async function resendAccessEmail(email: string) {
    try {
      await fetch("/api/course-members/resend-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      toast({ title: "Email akses dikirim ulang", description: `Ke: ${email}`, className: "border-emerald-500/25 bg-[#08150e] text-white" });
    } catch {
      toast({ variant: "destructive", title: "Gagal kirim email" });
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const courseMap: Record<string, string> = {};
  courses.forEach((c) => { courseMap[c.id] = c.title; });

  const filteredEnrollments = enrollments.filter((e) => {
    const matchSearch = !enrollSearch ||
      e.name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
      e.email.toLowerCase().includes(enrollSearch.toLowerCase()) ||
      (courseMap[e.courseId] || "").toLowerCase().includes(enrollSearch.toLowerCase());
    const matchStatus = enrollStatusFilter === "all" || e.status === enrollStatusFilter;
    const matchPay    = enrollPayFilter === "all" || (e.paymentStatus || "unpaid") === enrollPayFilter;
    return matchSearch && matchStatus && matchPay;
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 pb-16">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Videography Courses</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola course, paket, materi, dan pendaftaran siswa</p>
        </div>
        <Button
          onClick={() => openCourseEditor({ level: "beginner", category: "videography", isPublished: true, packages: [], orderIndex: courses.length * 10 })}
          className="bg-primary hover:bg-primary/90 text-white rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Tambah Course
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "Total Course",      v: courses.length,                                             c: "text-foreground" },
          { l: "Total Siswa",       v: enrollments.length,                                         c: "text-primary" },
          { l: "Siswa Aktif",       v: enrollments.filter((e) => e.status === "active").length,    c: "text-green-400" },
          { l: "Total Revenue",     v: formatCurrency(totalRevenue),                               c: "text-emerald-400" },
        ].map((s) => (
          <Card key={s.l} className="glass-panel border-border">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">{s.l}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-border w-fit flex-wrap">
        {(["courses", "packages", "materials", "enrollments", "workshop", "gallery", "settings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "materials" && selectedCourseForMat) loadMaterials(selectedCourseForMat);
              if (t === "workshop"  && selectedCourseForWs)  loadWorkshops(selectedCourseForWs);
              if (t === "gallery"   && selectedCourseForGal) loadGallery(selectedCourseForGal);
            }}
            className={`px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${
              tab === t ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "courses"     ? `🎬 Courses (${courses.length})` :
             t === "packages"    ? "💳 Paket" :
             t === "materials"   ? "📚 Materi" :
             t === "enrollments" ? `📋 Pendaftaran (${enrollments.length})` :
             t === "workshop"    ? "🎪 Workshop" :
             t === "gallery"     ? "🖼️ Gallery" :
                                   "⚙️ Pengaturan"}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════
          COURSES TAB
      ════════════════════════════════════════════════ */}
      {tab === "courses" && (
        <div className="space-y-4">
          {courses.map((course) => {
            const courseEnrollments = enrollments.filter((e) => e.courseId === course.id);
            const paidCount = courseEnrollments.filter((e) => e.paymentStatus === "paid").length;
            const revenue = courseEnrollments
              .filter((e) => e.paymentStatus === "paid")
              .reduce((acc, e) => {
                const pkg = course.packages.find((p) => p.id === e.packageId);
                return acc + (pkg ? Number(pkg.price) : 0);
              }, 0);

            return (
              <Card key={course.id} className="glass-panel border-border overflow-hidden">
                <CardContent className="p-0">
                  {/* ── Course row ── */}
                  <div
                    className="flex items-center justify-between p-5 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpanded(expanded === course.id ? null : course.id)}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Thumbnail */}
                      <div
                        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted/30 border border-border"
                        style={course.thumbnail ? { backgroundImage: `url(${course.thumbnail})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
                      >
                        {!course.thumbnail && (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-6 h-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{course.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          /{course.slug} · {course.level} · {course.packages.length} paket · {courseEnrollments.length} siswa
                        </div>
                        {revenue > 0 && (
                          <div className="text-xs text-emerald-400 font-semibold mt-0.5">
                            Revenue: {formatCurrency(revenue)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      <a
                        href={courseHref(course.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Preview
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePublish(course); }}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          course.isPublished
                            ? "text-green-400 border-green-400/25 bg-green-400/8 hover:bg-green-400/12"
                            : "text-muted-foreground border-border bg-muted/25 hover:bg-muted/40"
                        }`}
                      >
                        {course.isPublished ? <Eye className="w-3 h-3 inline mr-1" /> : <EyeOff className="w-3 h-3 inline mr-1" />}
                        {course.isPublished ? "Publik" : "Draft"}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openCourseEditor(course); }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/25 transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteCourse(course.id); }}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-destructive/25 text-destructive bg-destructive/6 hover:bg-destructive/12 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {expanded === course.id
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* ── Expanded: packages ── */}
                  {expanded === course.id && (
                    <div className="border-t border-border p-5 space-y-4">
                      {/* Package mini-stats */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { l: "Paket",     v: course.packages.length },
                          { l: "Pendaftar", v: courseEnrollments.length },
                          { l: "Lunas",     v: paidCount },
                        ].map((s) => (
                          <div key={s.l} className="rounded-xl border border-border bg-muted/15 p-3 text-center">
                            <p className="text-lg font-black text-foreground">{s.v}</p>
                            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{s.l}</p>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Paket Harga</p>
                        <Button
                          size="sm"
                          onClick={() => setEditingPkg({ courseId: course.id, pkg: { isTrial: false, isActive: true, orderIndex: course.packages.length * 10 } })}
                          className="bg-muted/40 text-foreground border border-border hover:bg-muted/60 rounded-xl text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Tambah Paket
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {course.packages.map((pkg) => {
                          const pkgEnrolls = courseEnrollments.filter((e) => e.packageId === pkg.id && e.paymentStatus === "paid");
                          return (
                            <div
                              key={pkg.id}
                              className={`rounded-xl p-4 border ${pkg.isTrial ? "border-primary/25 bg-primary/5" : "border-border bg-card/40"}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="font-semibold text-sm text-foreground">{pkg.name}</div>
                                  {pkg.isTrial && (
                                    <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full">Trial</span>
                                  )}
                                </div>
                                {!pkg.isActive && (
                                  <span className="text-[10px] bg-muted/30 text-muted-foreground px-2 py-0.5 rounded-full">Nonaktif</span>
                                )}
                              </div>
                              <div className="text-lg font-bold text-primary">
                                {Number(pkg.price) === 0 ? "Gratis" : formatCurrency(Number(pkg.price))}
                              </div>
                              {pkg.durationDays && (
                                <div className="text-xs text-muted-foreground mt-1">{pkg.durationDays} hari</div>
                              )}
                              <div className="text-xs text-muted-foreground mt-1">
                                {pkgEnrolls.length} pembeli
                              </div>
                              <div className="flex gap-3 mt-3">
                                <button onClick={() => setEditingPkg({ courseId: course.id, pkg })} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Edit</button>
                                <button onClick={() => deletePkg(pkg.id)} className="text-xs text-destructive hover:text-red-400 transition-colors">Hapus</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {course.packages.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Belum ada paket — tambahkan setidaknya 1 paket agar course muncul di halaman publik.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {courses.length === 0 && !loading && (
            <Card className="glass-panel border-border">
              <CardContent className="p-16 text-center">
                <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">Belum ada course. Buat course pertama!</p>
                <Button
                  className="mt-4 bg-primary hover:bg-primary/90 text-white rounded-xl"
                  onClick={() => openCourseEditor({ level: "beginner", category: "videography", isPublished: true, packages: [] })}
                >
                  <Plus className="w-4 h-4 mr-2" /> Buat Course
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          PACKAGES TAB
      ════════════════════════════════════════════════ */}
      {tab === "packages" && (
        <div className="space-y-6">
          {/* Course selector + Add */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Course</label>
              <select
                value={selectedCourseForMat}
                onChange={(e) => setSelectedCourseForMat(e.target.value)}
                className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground min-w-56"
              >
                {courses.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
              </select>
            </div>
            <Button
              onClick={() => setEditingPkg({
                courseId: selectedCourseForMat,
                pkg: { isTrial: false, isActive: true, orderIndex: (courses.find(c => c.id === selectedCourseForMat)?.packages.length ?? 0) * 10 },
              })}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" /> Tambah Paket
            </Button>
          </div>

          {/* Package cards for selected course */}
          {(() => {
            const course = courses.find(c => c.id === selectedCourseForMat);
            if (!course) return null;
            const pkgs = course.packages;

            return (
              <div className="space-y-4">
                {/* Info */}
                <p className="text-xs text-muted-foreground">
                  {pkgs.length} paket · Course ini {pkgs.some(p => p.isTrial) ? "memiliki paket trial" : "tidak memiliki trial"} ·
                  Paket dengan isActive=false tidak tampil di halaman publik
                </p>

                {/* Package cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pkgs.map((pkg, i) => {
                    const pkgPrice    = Number(pkg.price);
                    const pkgFeatures = (() => { try { const a = JSON.parse(pkg.features || "[]"); return Array.isArray(a) ? a : []; } catch { return (pkg.features || "").split("\n").filter(Boolean); } })();
                    const pkgEnrolls  = enrollments.filter(e => e.packageId === pkg.id);
                    const paidEnrolls = pkgEnrolls.filter(e => e.paymentStatus === "paid");
                    const pkgOrigPrice = Number(pkg.originalPrice || pkg.price);
                    const revenue     = paidEnrolls.reduce((a) => a + pkgPrice, 0);
                    const savedAmount = pkg.originalPrice && Number(pkg.originalPrice) > pkgPrice
                      ? paidEnrolls.length * (Number(pkg.originalPrice) - pkgPrice) : 0;

                    return (
                      <div
                        key={pkg.id}
                        className={`relative rounded-2xl border overflow-hidden transition-all ${
                          !pkg.isActive ? "opacity-50 border-border bg-muted/10" :
                          pkg.isTrial   ? "border-yellow-500/30 bg-yellow-500/4" :
                                          "border-border bg-card/30"
                        }`}
                      >
                        {/* Top status bar */}
                        <div className={`h-1 w-full ${
                          !pkg.isActive ? "bg-muted/30" :
                          pkg.isTrial   ? "bg-gradient-to-r from-yellow-400 to-amber-500" :
                                          "bg-gradient-to-r from-primary to-orange-400"
                        }`} />

                        <div className="p-5">
                          {/* Badges */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {pkg.isTrial && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 font-bold uppercase tracking-wide">
                                Trial
                              </span>
                            )}
                            {!pkg.isActive && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 border border-border text-muted-foreground font-bold uppercase tracking-wide">
                                Nonaktif
                              </span>
                            )}
                            {i === Math.floor(pkgs.filter(p => !p.isTrial).length / 2) && !pkg.isTrial && pkgs.filter(p => !p.isTrial).length > 1 && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 text-primary font-bold uppercase tracking-wide">
                                ⭐ Populer
                              </span>
                            )}
                            {pkg.originalPrice && Number(pkg.originalPrice) > pkgPrice && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-black uppercase tracking-wide">
                                🔥 -{Math.round((1 - pkgPrice / Number(pkg.originalPrice)) * 100)}%
                              </span>
                            )}
                            {pkg.discountLabel && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold">
                                {pkg.discountLabel}
                              </span>
                            )}
                          </div>

                          {/* Name + price */}
                          <h3 className="font-black text-foreground text-lg tracking-tight mb-1">{pkg.name}</h3>
                          <div className="mb-2">
                            {/* Diskon: harga asli dicoret */}
                            {pkg.originalPrice && Number(pkg.originalPrice) > pkgPrice && (
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm text-muted-foreground line-through">
                                  {formatCurrency(Number(pkg.originalPrice))}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 font-black uppercase tracking-wide">
                                  -{Math.round((1 - pkgPrice / Number(pkg.originalPrice)) * 100)}%
                                </span>
                                {pkg.discountLabel && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 font-bold">
                                    {pkg.discountLabel}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className={`text-2xl font-black tracking-tight ${pkg.isTrial ? "text-yellow-400" : "text-primary"}`}>
                              {pkgPrice === 0 ? "GRATIS" : formatCurrency(pkgPrice)}
                            </div>
                            {/* Countdown diskon jika ada end date */}
                            {pkg.discountEndDate && (() => {
                              const end  = new Date(pkg.discountEndDate);
                              const diff = end.getTime() - Date.now();
                              if (diff <= 0) return null;
                              const days = Math.floor(diff / 86400000);
                              const hrs  = Math.floor((diff % 86400000) / 3600000);
                              return (
                                <p className="text-[10px] text-orange-400 font-bold mt-0.5 flex items-center gap-1">
                                  ⏳ Berakhir {days > 0 ? `${days}h` : ""} {hrs}j lagi
                                </p>
                              );
                            })()}
                          </div>
                          {pkg.durationDays && (
                            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {pkg.durationDays} hari akses
                            </p>
                          )}

                          {/* Description */}
                          {pkg.description && (
                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{pkg.description}</p>
                          )}

                          {/* Features */}
                          {pkgFeatures.length > 0 && (
                            <div className="space-y-1.5 mb-4">
                              {pkgFeatures.slice(0, 5).map((f: string, fi: number) => (
                                <div key={fi} className="flex items-start gap-2 text-xs text-muted-foreground">
                                  <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                  {f}
                                </div>
                              ))}
                              {pkgFeatures.length > 5 && (
                                <p className="text-xs text-muted-foreground/60 pl-5">+{pkgFeatures.length - 5} fitur lainnya</p>
                              )}
                            </div>
                          )}

                          {/* Stats */}
                          <div className="grid grid-cols-3 gap-2 mb-4 pt-3 border-t border-border">
                            {[
                              { l: "Pendaftar",  v: pkgEnrolls.length },
                              { l: "Lunas",      v: paidEnrolls.length },
                              { l: "Revenue",    v: pkgPrice === 0 ? "—" : formatCurrency(revenue) },
                            ].map(s => (
                              <div key={s.l} className="text-center">
                                <div className="text-sm font-black text-foreground">{s.v}</div>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.l}</div>
                              </div>
                            ))}
                          </div>
                          {savedAmount > 0 && (
                            <div className="text-[10px] text-green-400 font-bold mb-3 flex items-center gap-1">
                              💸 Total hemat member: {formatCurrency(savedAmount)}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingPkg({ courseId: course.id, pkg })}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-xl bg-muted/30 border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors font-semibold"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                            <button
                              onClick={() => {
                                const newActive = !pkg.isActive;
                                fetch(`/api/course-packages/${pkg.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json", ...authHeader() } as any,
                                  body: JSON.stringify({ ...pkg, isActive: newActive }),
                                }).then(() => loadCourses());
                              }}
                              className={`flex items-center justify-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-colors font-semibold ${
                                pkg.isActive
                                  ? "bg-muted/20 border-border text-muted-foreground hover:text-foreground"
                                  : "bg-green-500/10 border-green-500/25 text-green-400 hover:bg-green-500/15"
                              }`}
                            >
                              {pkg.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              {pkg.isActive ? "Hide" : "Show"}
                            </button>
                            <button
                              onClick={() => deletePkg(pkg.id)}
                              className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-xl bg-destructive/6 border border-destructive/20 text-destructive hover:bg-destructive/12 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add package card */}
                  <button
                    onClick={() => setEditingPkg({
                      courseId: selectedCourseForMat,
                      pkg: { isTrial: false, isActive: true, orderIndex: pkgs.length * 10 },
                    })}
                    className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/5 hover:bg-primary/4 transition-all flex flex-col items-center justify-center gap-3 p-8 text-muted-foreground hover:text-primary min-h-[200px]"
                  >
                    <div className="w-10 h-10 rounded-xl border-2 border-dashed border-current flex items-center justify-center">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold">Tambah Paket Baru</span>
                  </button>
                </div>

                {pkgs.length === 0 && (
                  <Card className="glass-panel border-border">
                    <CardContent className="p-14 text-center">
                      <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm mb-1">Belum ada paket untuk course ini.</p>
                      <p className="text-xs text-muted-foreground/60 mb-4">Course tidak akan tampil di halaman publik tanpa paket aktif.</p>
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary/90 text-white rounded-xl"
                        onClick={() => setEditingPkg({ courseId: selectedCourseForMat, pkg: { isTrial: false, isActive: true, orderIndex: 0 } })}
                      >
                        <Plus className="w-3 h-3 mr-1.5" /> Buat Paket Pertama
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MATERIALS TAB
      ════════════════════════════════════════════════ */}
      {tab === "materials" && (
        <div className="space-y-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Pilih Course</label>
              <select
                value={selectedCourseForMat}
                onChange={(e) => { setSelectedCourseForMat(e.target.value); loadMaterials(e.target.value); }}
                className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground min-w-56"
              >
                {courses.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
              </select>
            </div>
            {selectedCourseForMat && (
              <Button
                onClick={() =>
                  setEditingMat({
                    courseId: selectedCourseForMat,
                    mat: {
                      type: "video", isActive: true,
                      orderIndex: (materials[selectedCourseForMat]?.length || 0) * 10,
                    },
                  })
                }
                className="bg-primary hover:bg-primary/90 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Materi
              </Button>
            )}
          </div>

          {selectedCourseForMat && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {(materials[selectedCourseForMat] || []).length} materi · Drag atas/bawah untuk mengubah urutan
              </p>
              {(materials[selectedCourseForMat] || []).map((m, i) => {
                const TypeIcon =
                  m.type === "video" ? Video :
                  m.type === "pdf"   ? FileText :
                  m.type === "link"  ? Link : BookOpen;

                return (
                  <Card key={m.id} className={`glass-panel border-border transition-opacity ${!m.isActive ? "opacity-45" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {/* Drag handle + reorder buttons */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button
                          disabled={i === 0}
                          onClick={() => reorderMat(selectedCourseForMat, i, i - 1)}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Geser ke atas"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <GripVertical className="w-4 h-4 text-muted-foreground/40" />
                        <button
                          disabled={i === (materials[selectedCourseForMat] || []).length - 1}
                          onClick={() => reorderMat(selectedCourseForMat, i, i + 1)}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                          title="Geser ke bawah"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Index */}
                      <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                        {i + 1}
                      </div>

                      {/* Type icon */}
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <TypeIcon className="w-4 h-4 text-primary" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{m.title}</p>
                        {m.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>}
                        {m.url && <p className="text-xs text-muted-foreground/50 truncate mt-0.5">{m.url}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-1 rounded-md bg-muted/30 text-muted-foreground border border-border capitalize">
                          {m.type}
                        </span>
                        {!m.isActive && (
                          <span className="text-[10px] px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-400 border border-yellow-500/25">
                            Draft
                          </span>
                        )}
                        {m.url && (
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => setEditingMat({ courseId: selectedCourseForMat, mat: m })} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMat(m.id, selectedCourseForMat)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {!(materials[selectedCourseForMat]?.length) && (
                <Card className="glass-panel border-border">
                  <CardContent className="p-12 text-center">
                    <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground text-sm">Belum ada materi untuk course ini.</p>
                    <Button
                      size="sm"
                      className="mt-3 bg-primary hover:bg-primary/90 text-white rounded-xl"
                      onClick={() => setEditingMat({ courseId: selectedCourseForMat, mat: { type: "video", isActive: true, orderIndex: 0 } })}
                    >
                      <Plus className="w-3 h-3 mr-1.5" /> Tambah Materi Pertama
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          ENROLLMENTS TAB
      ════════════════════════════════════════════════ */}
      {tab === "enrollments" && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={enrollSearch}
                onChange={(e) => setEnrollSearch(e.target.value)}
                placeholder="Cari nama, email, course..."
                className="pl-9 bg-muted/30 border-border"
              />
            </div>
            <select
              value={enrollStatusFilter}
              onChange={(e) => setEnrollStatusFilter(e.target.value)}
              className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Semua Status</option>
              {["pending","confirmed","active","completed","cancelled"].map((s) => (
                <option key={s} value={s} className="bg-card capitalize">{s}</option>
              ))}
            </select>
            <select
              value={enrollPayFilter}
              onChange={(e) => setEnrollPayFilter(e.target.value)}
              className="bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm text-foreground"
            >
              <option value="all">Semua Bayar</option>
              {["unpaid","paid","failed"].map((s) => (
                <option key={s} value={s} className="bg-card">{s}</option>
              ))}
            </select>
            <button
              onClick={() => exportCsvEnrollments(filteredEnrollments, courseMap)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>

          {/* Bulk action bar */}
          {selectedEnrollments.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/25 bg-primary/8">
              <span className="text-sm font-semibold text-foreground">{selectedEnrollments.size} dipilih</span>
              {["active","completed","cancelled"].map((s) => (
                <button
                  key={s}
                  onClick={() => bulkUpdateStatus(s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground bg-muted/30 transition-colors capitalize"
                >
                  → {s}
                </button>
              ))}
              <button
                onClick={() => setSelectedEnrollments(new Set())}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                Batal
              </button>
            </div>
          )}

          {/* Result count */}
          <p className="text-xs text-muted-foreground">
            Menampilkan {filteredEnrollments.length} dari {enrollments.length} pendaftar
          </p>

          {/* Enrollment cards */}
          {filteredEnrollments.map((e) => (
            <Card key={e.id} className={`glass-panel border-border transition-colors ${selectedEnrollments.has(e.id) ? "border-primary/25 bg-primary/4" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3 flex-wrap">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedEnrollments.has(e.id)}
                    onChange={(ev) =>
                      setSelectedEnrollments((prev) => {
                        const next = new Set(prev);
                        ev.target.checked ? next.add(e.id) : next.delete(e.id);
                        return next;
                      })
                    }
                    className="w-4 h-4 accent-primary mt-1 shrink-0"
                  />

                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-primary">
                    {e.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{e.name}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold ${STATUS_COLORS[e.status] || "bg-muted/30 text-muted-foreground border-border"}`}>
                        {e.status}
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold ${PAYMENT_COLORS[e.paymentStatus || "unpaid"] || ""}`}>
                        {e.paymentStatus || "unpaid"}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{e.email}</div>
                    {e.phone && <div className="text-xs text-muted-foreground">{e.phone}</div>}
                    <div className="text-xs text-muted-foreground/60 mt-1">
                      {courseMap[e.courseId] || "—"} · {new Date(e.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                      {e.paidAt && <> · Lunas: {new Date(e.paidAt).toLocaleDateString("id-ID")}</>}
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={e.status}
                      onChange={(ev) => updateEnrollment(e.id, { status: ev.target.value })}
                      className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                    >
                      {["pending","confirmed","active","completed","cancelled"].map((s) => (
                        <option key={s} value={s} className="bg-card capitalize">{s}</option>
                      ))}
                    </select>
                    <select
                      value={e.paymentStatus || "unpaid"}
                      onChange={(ev) =>
                        updateEnrollment(e.id, {
                          paymentStatus: ev.target.value,
                          ...(ev.target.value === "paid" ? { status: "active", paidAt: new Date().toISOString() } : {}),
                        } as any)
                      }
                      className="flex-1 bg-muted/30 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground"
                    >
                      {["unpaid","paid","failed"].map((s) => (
                        <option key={s} value={s} className="bg-card">{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`mailto:${e.email}?subject=Kelas Videografi Frameless Academy&body=Halo ${e.name},%0A%0A`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold hover:bg-blue-500/15 transition-colors"
                    >
                      ✉️ Email
                    </a>
                    {e.phone && (
                      <a
                        href={`https://wa.me/${e.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Halo ${e.name}, konfirmasi kelas Frameless Academy.`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition-colors"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    <a
                      href={`/portal/${e.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Portal
                    </a>
                    {/* Activate manually — hanya tampil kalau belum paid */}
                    {(e.paymentStatus !== "paid") && (
                      <button
                        onClick={() => activateEnrollment(e.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 transition-colors"
                        title="Aktifkan manual + kirim email kode member"
                      >
                        <Check className="w-3 h-3" /> Aktifkan Manual
                      </button>
                    )}
                    {/* Resend access email — hanya kalau sudah paid */}
                    {(e.paymentStatus === "paid" || e.status === "active") && (
                      <button
                        onClick={() => resendAccessEmail(e.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400 text-xs font-semibold hover:bg-purple-500/15 transition-colors"
                        title="Kirim ulang email kode akses ke member"
                      >
                        📧 Kirim Ulang Email
                      </button>
                    )}
                    {/* Member code badge */}
                    {e.memberCode && (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/30 border border-border text-muted-foreground text-xs font-mono">
                        🔑 {e.memberCode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-3 flex items-start gap-2">
                  <textarea
                    value={enrollmentNote[e.id] || ""}
                    onChange={(ev) => setEnrollmentNote((p) => ({ ...p, [e.id]: ev.target.value }))}
                    className="flex-1 bg-muted/20 border border-border rounded-lg px-3 py-2 text-xs text-foreground resize-none h-14 focus:outline-none focus:border-primary/40 transition-colors"
                    placeholder="Catatan follow-up, progres belajar..."
                  />
                  <button
                    onClick={() => saveNote(e.id)}
                    disabled={savingNote === e.id}
                    className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/25 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors disabled:opacity-50"
                  >
                    {savingNote === e.id ? <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredEnrollments.length === 0 && (
            <Card className="glass-panel border-border">
              <CardContent className="p-14 text-center">
                <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground">
                  {enrollments.length === 0 ? "Belum ada pendaftar." : "Tidak ada yang cocok dengan filter ini."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          WORKSHOP TAB
      ════════════════════════════════════════════════ */}
      {tab === "workshop" && (
        <div className="space-y-6">
          {/* Course selector + Add button */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Course</label>
              <select
                value={selectedCourseForWs}
                onChange={(e) => { setSelectedCourseForWs(e.target.value); loadWorkshops(e.target.value); }}
                className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground min-w-56"
              >
                {courses.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
              </select>
            </div>
            {selectedCourseForWs && (
              <Button
                onClick={() => setEditingWorkshop({
                  courseId: selectedCourseForWs,
                  ws: { isActive: true, price: "0", quota: 20, registeredCount: 0 },
                })}
                className="bg-primary hover:bg-primary/90 text-white rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" /> Tambah Workshop
              </Button>
            )}
          </div>

          {/* Workshop list */}
          <div className="space-y-4">
            {(workshops[selectedCourseForWs] || []).map((ws) => {
              const dateObj    = new Date(ws.date);
              const endDateObj = ws.endDate ? new Date(ws.endDate) : null;
              const spotsLeft  = ws.quota - (ws.registeredCount ?? 0);
              const soldOut    = spotsLeft <= 0;
              return (
                <Card key={ws.id} className={`glass-panel border-border overflow-hidden ${!ws.isActive ? "opacity-50" : ""}`}>
                  <CardContent className="p-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-foreground text-base">{ws.title}</span>
                          {!ws.isActive && <span className="text-[10px] bg-muted/30 text-muted-foreground border border-border px-2 py-0.5 rounded-full">Draft</span>}
                          {soldOut && <span className="text-[10px] bg-red-500/12 text-red-400 border border-red-500/25 px-2 py-0.5 rounded-full">Penuh</span>}
                        </div>
                        {ws.description && <p className="text-xs text-muted-foreground">{ws.description}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-black text-primary">
                          {Number(ws.price) === 0 ? "Gratis" : formatCurrency(Number(ws.price))}
                        </div>
                        <div className="text-xs text-muted-foreground">{ws.registeredCount ?? 0}/{ws.quota} peserta</div>
                      </div>
                    </div>
                    {/* Detail */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 text-sm">
                      {[
                        { icon: <Calendar className="w-3.5 h-3.5 text-primary" />, l: "Tanggal", v: dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + (endDateObj && endDateObj.toDateString() !== dateObj.toDateString() ? ` – ${endDateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" })}` : "") },
                        { icon: <Clock className="w-3.5 h-3.5 text-primary" />,    l: "Waktu",   v: dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + (endDateObj ? ` – ${endDateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : "") },
                        { icon: <MapPin className="w-3.5 h-3.5 text-primary" />,   l: "Lokasi",  v: ws.location },
                        { icon: <Users className="w-3.5 h-3.5 text-primary" />,    l: "Sisa",    v: `${spotsLeft} tempat` },
                      ].map((item, i) => (
                        <div key={item.l} className="px-5 py-3.5" style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,.06)" : "none", borderTop: "1px solid rgba(255,255,255,.06)" }}>
                          <div className="flex items-center gap-1.5 mb-1 text-muted-foreground text-[10px] uppercase tracking-widest font-semibold">
                            {item.icon} {item.l}
                          </div>
                          <div className="font-semibold text-foreground text-xs">{item.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-3 px-5 py-3 border-t border-border">
                      <button
                        onClick={() => setEditingWorkshop({ courseId: selectedCourseForWs, ws })}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/30 border border-border px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      {ws.registrationUrl && (
                        <a href={ws.registrationUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs text-primary bg-primary/8 border border-primary/20 px-3 py-1.5 rounded-lg"
                        >
                          <ExternalLink className="w-3 h-3" /> Link Daftar
                        </a>
                      )}
                      <button
                        onClick={() => deleteWorkshop(ws.id, selectedCourseForWs)}
                        className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/6 border border-destructive/20 px-3 py-1.5 rounded-lg hover:bg-destructive/12 transition-colors ml-auto"
                      >
                        <Trash2 className="w-3 h-3" /> Hapus
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!(workshops[selectedCourseForWs]?.length) && (
              <Card className="glass-panel border-border">
                <CardContent className="p-14 text-center">
                  <Calendar className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-sm mb-3">Belum ada workshop untuk course ini.</p>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white rounded-xl"
                    onClick={() => setEditingWorkshop({ courseId: selectedCourseForWs, ws: { isActive: true, price: "0", quota: 20, registeredCount: 0 } })}
                  >
                    <Plus className="w-3 h-3 mr-1.5" /> Buat Workshop Pertama
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          GALLERY TAB
      ════════════════════════════════════════════════ */}
      {tab === "gallery" && (
        <div className="space-y-6">
          {/* Course selector + Upload */}
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-1">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Course</label>
              <select
                value={selectedCourseForGal}
                onChange={(e) => { setSelectedCourseForGal(e.target.value); loadGallery(e.target.value); }}
                className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground min-w-56"
              >
                {courses.map((c) => <option key={c.id} value={c.id} className="bg-card">{c.title}</option>)}
              </select>
            </div>
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold transition-colors disabled:opacity-60"
            >
              {uploadingGallery
                ? <><span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> Mengupload...</>
                : <><Upload className="w-4 h-4" /> Upload Foto</>
              }
            </button>
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) uploadGalleryFiles(e.target.files, selectedCourseForGal); e.target.value = ""; }}
            />
            <p className="text-xs text-muted-foreground">Bisa upload multiple sekaligus · JPG, PNG, WebP</p>
          </div>

          {/* Photo count */}
          {(gallery[selectedCourseForGal]?.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              {gallery[selectedCourseForGal].length} foto terpublish di halaman course
            </p>
          )}

          {/* Gallery grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(gallery[selectedCourseForGal] || []).map((photo, i) => (
              <div key={photo.id} className="group relative rounded-2xl overflow-hidden border border-border bg-muted/20">
                <div className="aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.caption || `Foto ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                  <button
                    onClick={() => deleteGalleryPhoto(photo.id, selectedCourseForGal)}
                    className="self-end w-7 h-7 rounded-full bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div>
                    <input
                      type="text"
                      defaultValue={photo.caption || ""}
                      onBlur={(e) => { if (e.target.value !== (photo.caption || "")) updateGalleryCaption(photo.id, e.target.value, selectedCourseForGal); }}
                      placeholder="Tambah caption..."
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-primary/60"
                    />
                  </div>
                </div>
                {/* Caption badge */}
                {photo.caption && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 px-3 py-2 group-hover:opacity-0 transition-opacity">
                    <p className="text-[11px] text-white/80 truncate">{photo.caption}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Upload drop zone placeholder */}
            <button
              onClick={() => galleryInputRef.current?.click()}
              disabled={uploadingGallery}
              className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary/40 bg-muted/10 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary disabled:opacity-50"
            >
              <Image className="w-6 h-6" />
              <span className="text-xs font-semibold">Upload foto</span>
            </button>
          </div>

          {(gallery[selectedCourseForGal]?.length ?? 0) === 0 && !uploadingGallery && (
            <Card className="glass-panel border-border">
              <CardContent className="p-14 text-center">
                <Image className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm mb-1">Belum ada foto gallery.</p>
                <p className="text-xs text-muted-foreground/60">Upload foto suasana workshop, kelas, atau behind the scenes.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          SETTINGS TAB
      ════════════════════════════════════════════════ */}
      {tab === "settings" && (
        <div className="max-w-2xl space-y-6">

          {/* Hero Stats */}
          <Card className="glass-panel border-border">
            <CardContent className="p-6 space-y-5">
              <div>
                <h3 className="text-base font-bold text-foreground">Statistik Hero</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Angka yang muncul di header halaman <code className="bg-muted/40 px-1.5 py-0.5 rounded text-primary">/courses</code>.
                  Kelas tersedia dihitung otomatis dari data — dua lainnya bisa kamu atur.
                </p>
              </div>

              {/* Preview strip */}
              <div className="flex gap-0 border border-border rounded-xl overflow-hidden w-fit">
                {[
                  { val: `${courses.length}`, lbl: "Kelas" },
                  { val: academyStats.alumni,  lbl: "Alumni" },
                  { val: academyStats.rating,  lbl: "Rating" },
                ].map((s, i) => (
                  <div
                    key={s.lbl}
                    style={{ borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                    className="px-5 py-3 text-center bg-muted/10"
                  >
                    <div className="text-lg font-black text-foreground">{s.val}</div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">{s.lbl}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground -mt-2">Preview live — berubah saat kamu edit field di bawah.</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Jumlah Alumni
                  </label>
                  <Input
                    value={academyStats.alumni}
                    onChange={(e) => setAcademyStats(p => ({ ...p, alumni: e.target.value }))}
                    className="bg-muted/30 border-border font-bold"
                    placeholder="500+"
                  />
                  <p className="text-[11px] text-muted-foreground">Contoh: 500+, 1.200, 2rb+</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Rating
                  </label>
                  <Input
                    value={academyStats.rating}
                    onChange={(e) => setAcademyStats(p => ({ ...p, rating: e.target.value }))}
                    className="bg-muted/30 border-border font-bold"
                    placeholder="4.9/5"
                  />
                  <p className="text-[11px] text-muted-foreground">Contoh: 4.9/5, ★4.9, 98%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tagline */}
          <Card className="glass-panel border-border">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Tagline Halaman</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Teks deskripsi kecil di bawah judul "Frameless Academy".
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tagline</label>
                <Input
                  value={academyStats.tagline}
                  onChange={(e) => setAcademyStats(p => ({ ...p, tagline: e.target.value }))}
                  className="bg-muted/30 border-border"
                  placeholder="Kuasai videografi dari sineas profesional"
                />
              </div>
              {/* Tagline preview */}
              <div className="rounded-xl border border-border bg-muted/10 px-4 py-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1">Preview</p>
                <p className="text-sm text-muted-foreground/70 italic">{academyStats.tagline || "—"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Info box */}
          <div className="flex gap-3 p-4 rounded-xl border border-primary/20 bg-primary/6">
            <Settings className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
              <p><strong className="text-foreground">Jumlah kelas tersedia</strong> dihitung otomatis dari course yang <code className="bg-muted/40 px-1.5 py-0.5 rounded">isPublished = true</code> — tidak perlu diset manual.</p>
              <p>Data disimpan via <code className="bg-muted/40 px-1.5 py-0.5 rounded">/api/cms/academy_stats</code>. Jika endpoint belum ada, data tersimpan ke <code className="bg-muted/40 px-1.5 py-0.5 rounded">localStorage</code> sementara dan tetap langsung tampil di halaman publik.</p>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={saveStats}
              disabled={savingStats}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl px-6"
            >
              {savingStats ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" />
                  Menyimpan...
                </span>
              ) : statsSaved ? (
                <span className="flex items-center gap-2">
                  <Check className="w-4 h-4" /> Tersimpan!
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" /> Simpan Pengaturan
                </span>
              )}
            </Button>
            <button
              onClick={() => setAcademyStats({ alumni: "500+", rating: "4.9/5", tagline: "Kuasai videografi dari sineas profesional" })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset ke default
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════ */}

      {/* Workshop Modal */}
      {editingWorkshop && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {editingWorkshop.ws.id ? "Edit Workshop" : "Tambah Workshop Offline"}
              </h3>
              <button onClick={() => setEditingWorkshop(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Workshop *</label>
              <Input
                value={editingWorkshop.ws.title || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, title: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="Workshop Sinematografi Dasar"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi</label>
              <Textarea
                value={editingWorkshop.ws.description || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, description: e.target.value } }))}
                className="bg-muted/30 border-border"
                rows={3}
                placeholder="Sesi intensif 1 hari, praktik langsung dengan kamera..."
              />
            </div>

            {/* Date & End Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tanggal & Waktu Mulai *</label>
                <Input
                  type="datetime-local"
                  value={editingWorkshop.ws.date ? new Date(editingWorkshop.ws.date).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, date: e.target.value } }))}
                  className="bg-muted/30 border-border text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tanggal & Waktu Selesai</label>
                <Input
                  type="datetime-local"
                  value={editingWorkshop.ws.endDate ? new Date(editingWorkshop.ws.endDate).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, endDate: e.target.value || undefined } }))}
                  className="bg-muted/30 border-border text-sm"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Lokasi *</label>
              <Input
                value={editingWorkshop.ws.location || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, location: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="Studio Frameless Creative, Wonosobo"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Link Google Maps (opsional)</label>
              <Input
                value={editingWorkshop.ws.locationUrl || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, locationUrl: e.target.value || undefined } }))}
                className="bg-muted/30 border-border"
                placeholder="https://maps.google.com/..."
              />
            </div>

            {/* Price & Quota */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Harga (IDR)</label>
                <Input
                  type="number"
                  value={editingWorkshop.ws.price || "0"}
                  onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, price: e.target.value } }))}
                  className="bg-muted/30 border-border"
                  placeholder="0"
                />
                <p className="text-[11px] text-muted-foreground">0 = Gratis</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kuota Peserta</label>
                <Input
                  type="number"
                  value={editingWorkshop.ws.quota || 20}
                  onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, quota: Number(e.target.value) } }))}
                  className="bg-muted/30 border-border"
                />
              </div>
            </div>

            {/* Registered count (manual override) */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                Jumlah Terdaftar (override manual)
              </label>
              <Input
                type="number"
                value={editingWorkshop.ws.registeredCount ?? 0}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, registeredCount: Number(e.target.value) } }))}
                className="bg-muted/30 border-border w-28"
              />
              <p className="text-[11px] text-muted-foreground">Auto bertambah saat ada yang daftar via sistem. Bisa diset manual jika ada pendaftaran luar.</p>
            </div>

            {/* Registration URL */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Link Pendaftaran (opsional)</label>
              <Input
                value={editingWorkshop.ws.registrationUrl || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, registrationUrl: e.target.value || undefined } }))}
                className="bg-muted/30 border-border"
                placeholder="https://forms.gle/... atau link toko/marketplace"
              />
              <p className="text-[11px] text-muted-foreground">Kosongkan → tombol daftar otomatis ke WhatsApp.</p>
            </div>

            {/* Poster */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Poster / Thumbnail Workshop</label>
              <UploadBtn
                value={editingWorkshop.ws.posterUrl || ""}
                onChange={(url) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, posterUrl: url || undefined } }))}
                label="Upload Poster"
                accept="image/*"
                showPreview
              />
              <p className="text-[11px] text-muted-foreground">Tampil sebagai visual utama card workshop. Rekomendasi: 16:9, min 800×450px.</p>
            </div>

            {/* Video */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Video Teaser (opsional)</label>
              <Input
                value={editingWorkshop.ws.videoUrl || ""}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, videoUrl: e.target.value || undefined } }))}
                className="bg-muted/30 border-border"
                placeholder="https://youtube.com/... atau https://vimeo.com/... atau URL video .mp4"
              />
              <p className="text-[11px] text-muted-foreground">YouTube, Vimeo, atau direct .mp4 — ditampilkan sebagai embed di card workshop.</p>
            </div>

            {/* Highlights */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Yang Peserta Dapatkan (1 per baris)</label>
              <Textarea
                value={(() => {
                  try { const a = JSON.parse(editingWorkshop.ws.highlights || "[]"); return Array.isArray(a) ? a.join("\n") : editingWorkshop.ws.highlights || ""; }
                  catch { return editingWorkshop.ws.highlights || ""; }
                })()}
                onChange={(e) => setEditingWorkshop((p) => p && ({
                  ...p, ws: { ...p.ws, highlights: JSON.stringify(e.target.value.split("\n").filter(Boolean)) }
                }))}
                className="bg-muted/30 border-border"
                rows={4}
                placeholder={"Praktik langsung dengan kamera profesional\nFeedback 1-on-1 dari instruktur\nMakit fisik + digital\nSertifikat kehadiran"}
              />
            </div>

            {/* Active toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingWorkshop.ws.isActive ?? true}
                onChange={(e) => setEditingWorkshop((p) => p && ({ ...p, ws: { ...p.ws, isActive: e.target.checked } }))}
                className="w-4 h-4 accent-primary rounded"
              />
              <span className="text-sm text-foreground">Tampilkan di halaman course (Aktif)</span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingWorkshop(null)} variant="ghost" className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={saveWorkshop} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {editingWorkshop.ws.id ? "Simpan Perubahan" : "Tambah Workshop"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Course Modal */}
      {editingCourse && (
        <div className="fixed inset-0 bg-black/78 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">
                {editingCourse.id ? "Edit Course" : "Tambah Course Baru"}
              </h3>
              <button onClick={closeCourseEditor} disabled={savingCourse} className="text-muted-foreground hover:text-foreground disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            {courseSaveState && <SaveBanner state={courseSaveState} />}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Course *</label>
              <Input
                value={editingCourse.title || ""}
                onChange={(e) =>
                  setEditingCourse((prev) => {
                    if (!prev) return prev;
                    const nextTitle = e.target.value;
                    const shouldFollow = !prev.slug || prev.slug === normalizeSlug(prev.slug, prev.title);
                    return { ...prev, title: nextTitle, ...(shouldFollow ? { slug: normalizeSlug(prev.slug, nextTitle) } : {}) };
                  })
                }
                className="bg-muted/30 border-border"
                placeholder="Dasar Videografi Sinematik"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Slug (URL)</label>
              <Input
                value={editingCourse.slug || ""}
                onChange={(e) => setEditingCourse((p) => p ? ({ ...p, slug: normalizeSlug(e.target.value, p.title) }) : p)}
                className="bg-muted/30 border-border font-mono text-sm"
                placeholder="dasar-videografi-sinematik"
              />
              <p className="text-[11px] text-muted-foreground">
                URL: <span className="text-foreground">/course/{normalizeSlug(editingCourse.slug, editingCourse.title) || "slug-course"}</span>
              </p>
            </div>

            {/* Subtitle & Instructor */}
            {([["subtitle", "Subtitle / Tagline"], ["instructor", "Nama Instruktur"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{l}</label>
                <Input
                  value={editingCourse[k] || ""}
                  onChange={(e) => setEditingCourse((p) => ({ ...p!, [k]: e.target.value }))}
                  className="bg-muted/30 border-border"
                />
              </div>
            ))}

            {/* Thumbnail */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Thumbnail / Poster</label>
              <UploadBtn
                value={editingCourse.thumbnail || ""}
                onChange={(url) => setEditingCourse((p) => ({ ...p!, thumbnail: url }))}
                label="Upload"
                accept="image/*"
                showPreview
              />
            </div>

            {/* Highlight video */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Highlight Video</label>
              <UploadBtn
                value={editingCourse.highlightVideoUrl || ""}
                onChange={(url) => setEditingCourse((p) => ({ ...p!, highlightVideoUrl: url }))}
                label="Upload Video"
                accept="video/*"
              />
              <p className="text-[11px] text-muted-foreground">Upload MP4/WebM/MOV atau paste URL YouTube/Vimeo.</p>
            </div>

            {/* Curriculum PDF */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kurikulum PDF</label>
              <UploadBtn
                value={editingCourse.curriculumPdfUrl || ""}
                onChange={(url) => setEditingCourse((p) => ({ ...p!, curriculumPdfUrl: url }))}
                label="Upload PDF"
                accept=".pdf"
              />
            </div>

            {/* Level & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Level</label>
                <select
                  value={editingCourse.level || "beginner"}
                  onChange={(e) => setEditingCourse((p) => ({ ...p!, level: e.target.value }))}
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  {["beginner", "intermediate", "advanced"].map((l) => (
                    <option key={l} value={l} className="bg-card capitalize">{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Kategori</label>
                <Input
                  value={editingCourse.category || ""}
                  onChange={(e) => setEditingCourse((p) => ({ ...p!, category: e.target.value }))}
                  className="bg-muted/30 border-border"
                  placeholder="videography"
                />
              </div>
            </div>

            {/* Order index */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Urutan Tampil</label>
              <Input
                type="number"
                value={editingCourse.orderIndex ?? 0}
                onChange={(e) => setEditingCourse((p) => ({ ...p!, orderIndex: Number(e.target.value) }))}
                className="bg-muted/30 border-border w-28"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Lengkap</label>
              <Textarea
                value={editingCourse.description || ""}
                onChange={(e) => setEditingCourse((p) => ({ ...p!, description: e.target.value }))}
                className="bg-muted/30 border-border"
                rows={5}
                placeholder="Deskripsi course yang muncul di halaman detail..."
              />
            </div>

            {/* Publish toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingCourse.isPublished ?? true}
                onChange={(e) => setEditingCourse((p) => ({ ...p!, isPublished: e.target.checked }))}
                className="w-4 h-4 accent-primary rounded"
              />
              <span className="text-sm text-foreground">Tampilkan di halaman publik (Publik)</span>
            </label>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <Button onClick={closeCourseEditor} variant="ghost" disabled={savingCourse} className="flex-1 rounded-xl disabled:opacity-50">
                Batal
              </Button>
              <Button onClick={saveCourse} disabled={savingCourse} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">
                {savingCourse ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
                    Menyimpan...
                  </span>
                ) : (
                  editingCourse.id ? "Simpan Perubahan" : "Buat Course"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Package Modal */}
      {editingPkg && (
        <div className="fixed inset-0 bg-black/78 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{editingPkg.pkg.id ? "Edit Paket" : "Tambah Paket"}</h3>
              <button onClick={() => setEditingPkg(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nama Paket *</label>
              <Input
                value={editingPkg.pkg.name || ""}
                onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, name: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="Basic, Pro, Masterclass..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Singkat</label>
              <Input
                value={editingPkg.pkg.description || ""}
                onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, description: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="Cocok untuk pemula yang ingin mulai..."
              />
            </div>

            {/* Harga & Durasi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Harga Jual (IDR) *</label>
                <Input
                  type="number"
                  value={editingPkg.pkg.price || "0"}
                  onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, price: e.target.value } }))}
                  className="bg-muted/30 border-border"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Durasi (hari)</label>
                <Input
                  type="number"
                  value={editingPkg.pkg.durationDays || ""}
                  onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, durationDays: Number(e.target.value) || undefined } }))}
                  className="bg-muted/30 border-border"
                  placeholder="365"
                />
              </div>
            </div>

            {/* Diskon Section */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/4 p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-[11px] uppercase tracking-widest text-orange-400 font-bold">Pengaturan Diskon (opsional)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Harga Asli (IDR)
                  </label>
                  <Input
                    type="number"
                    value={editingPkg.pkg.originalPrice || ""}
                    onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, originalPrice: e.target.value || undefined } }))}
                    className="bg-muted/30 border-border"
                    placeholder="Harga sebelum diskon"
                  />
                  {editingPkg.pkg.originalPrice && Number(editingPkg.pkg.originalPrice) > Number(editingPkg.pkg.price || 0) && (
                    <p className="text-[10px] text-green-400 font-bold">
                      Diskon {Math.round((1 - Number(editingPkg.pkg.price || 0) / Number(editingPkg.pkg.originalPrice)) * 100)}% aktif ✓
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                    Label Promo
                  </label>
                  <Input
                    value={editingPkg.pkg.discountLabel || ""}
                    onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, discountLabel: e.target.value || undefined } }))}
                    className="bg-muted/30 border-border"
                    placeholder="Early Bird, Ramadan Sale..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Berlaku Sampai (opsional)
                </label>
                <Input
                  type="datetime-local"
                  value={editingPkg.pkg.discountEndDate ? editingPkg.pkg.discountEndDate.slice(0, 16) : ""}
                  onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, discountEndDate: e.target.value ? new Date(e.target.value).toISOString() : undefined } }))}
                  className="bg-muted/30 border-border"
                />
                {editingPkg.pkg.discountEndDate && (
                  <p className="text-[10px] text-orange-400">
                    ⏳ Diskon berakhir: {new Date(editingPkg.pkg.discountEndDate).toLocaleString("id-ID")}
                  </p>
                )}
              </div>

              {/* Preview diskon */}
              {editingPkg.pkg.originalPrice && Number(editingPkg.pkg.originalPrice) > Number(editingPkg.pkg.price || 0) && (
                <div className="rounded-lg bg-muted/20 border border-border p-3 flex items-center gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">Preview Tampilan</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        Rp {Number(editingPkg.pkg.originalPrice).toLocaleString("id-ID")}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-black">
                        -{Math.round((1 - Number(editingPkg.pkg.price || 0) / Number(editingPkg.pkg.originalPrice)) * 100)}%
                      </span>
                    </div>
                    <div className="text-lg font-black text-primary">
                      Rp {Number(editingPkg.pkg.price || 0).toLocaleString("id-ID")}
                    </div>
                    {editingPkg.pkg.discountLabel && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-bold">
                        {editingPkg.pkg.discountLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Fitur (1 per baris)</label>
              <Textarea
                value={(() => {
                  try {
                    const a = JSON.parse(editingPkg.pkg.features || "[]");
                    return Array.isArray(a) ? a.join("\n") : editingPkg.pkg.features || "";
                  } catch { return editingPkg.pkg.features || ""; }
                })()}
                onChange={(e) =>
                  setEditingPkg((p) => p && ({
                    ...p,
                    pkg: { ...p.pkg, features: JSON.stringify(e.target.value.split("\n").filter(Boolean)) },
                  }))
                }
                className="bg-muted/30 border-border"
                rows={5}
                placeholder={"Akses semua materi video\nSertifikat kelulusan\nGroup diskusi alumni\nQ&A dengan instruktur"}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingPkg.pkg.isTrial || false}
                  onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, isTrial: e.target.checked } }))}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm text-foreground">Paket Trial</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingPkg.pkg.isActive ?? true}
                  onChange={(e) => setEditingPkg((p) => p && ({ ...p, pkg: { ...p.pkg, isActive: e.target.checked } }))}
                  className="w-4 h-4 accent-primary rounded"
                />
                <span className="text-sm text-foreground">Aktif</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={() => setEditingPkg(null)} variant="ghost" className="flex-1 rounded-xl">Batal</Button>
              <Button onClick={savePkg} className="flex-1 bg-primary hover:bg-primary/90 text-white rounded-xl">Simpan Paket</Button>
            </div>
          </div>
        </div>
      )}

      {/* Material Modal */}
      {editingMat && (
        <div className="fixed inset-0 bg-black/78 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">{editingMat.mat.id ? "Edit Materi" : "Tambah Materi"}</h3>
              <button onClick={() => setEditingMat(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Judul Materi *</label>
              <Input
                value={editingMat.mat.title || ""}
                onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, title: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="Modul 1: Dasar Komposisi Visual"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Tipe Materi</label>
              <select
                value={editingMat.mat.type || "video"}
                onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, type: e.target.value } }))}
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {[
                  { v: "video", l: "🎬 Video" },
                  { v: "pdf",   l: "📄 PDF / Dokumen" },
                  { v: "doc",   l: "📝 Google Docs" },
                  { v: "link",  l: "🔗 Link Eksternal" },
                ].map((t) => <option key={t.v} value={t.v} className="bg-card">{t.l}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">URL Konten</label>
              <Input
                value={editingMat.mat.url || ""}
                onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, url: e.target.value } }))}
                className="bg-muted/30 border-border"
                placeholder="https://youtube.com/... atau link Drive"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Deskripsi Singkat</label>
              <Textarea
                value={editingMat.mat.description || ""}
                onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, description: e.target.value } }))}
                className="bg-muted/30 border-border"
                rows={3}
                placeholder="Keterangan singkat tentang isi materi ini..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Durasi (menit)</label>
                <Input
                  type="number"
                  value={editingMat.mat.durationMinutes || ""}
                  onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, durationMinutes: Number(e.target.value) || undefined } }))}
                  className="bg-muted/30 border-border"
                  placeholder="30"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Urutan</label>
                <Input
                  type="number"
                  value={editingMat.mat.orderIndex ?? 0}
                  onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, orderIndex: Number(e.target.value) } }))}
                  className="bg-muted/30 border-border"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editingMat.mat.isActive ?? true}
                onChange={(e) => setEditingMat((p) => p && ({ ...p, mat: { ...p.mat, isActive: e.target.checked } }))}
                className="w-4 h-4 accent-primary rounded"
              />
              <span className="text-sm text-foreground">Tampilkan di halaman course (Aktif)</span>
            </label>

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
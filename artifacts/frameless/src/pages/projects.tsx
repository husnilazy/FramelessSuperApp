// artifacts/frameless/src/pages/projects.tsx
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import {
  Plus, Search, Filter, Film, Clock, Trash2, Edit3,
  ChevronRight, MoreVertical, Calendar, DollarSign,
  Users, Link2, CheckCircle2, Circle, AlertCircle,
  ArrowUpRight, Kanban, List, X, ExternalLink,
  FolderOpen, Tag, TrendingUp, Eye,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Task { id: string; title: string; status: string; priority: string; assignee?: string; dueDate?: string; }
interface Project {
  id: string; title: string; client: string; status: string; progress: number;
  deadline?: string; startDate?: string; description?: string; projectType?: string;
  priority: string; budget?: number; notes?: string; driveUrl?: string;
  createdAt: string; updatedAt: string; tasks?: Task[];
}

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: "Active", color: "#4ade80", bg: "rgba(74,222,128,.1)", dot: "#4ade80" },
  completed: { label: "Completed", color: "#60a5fa", bg: "rgba(96,165,250,.1)", dot: "#60a5fa" },
  on_hold: { label: "On Hold", color: "#fbbf24", bg: "rgba(251,191,36,.1)", dot: "#fbbf24" },
  cancelled: { label: "Cancelled", color: "#f87171", bg: "rgba(248,113,113,.1)", dot: "#f87171" },
  planning: { label: "Planning", color: "#a78bfa", bg: "rgba(167,139,250,.1)", dot: "#a78bfa" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: "High", color: OR },
  medium: { label: "Medium", color: "#fbbf24" },
  low: { label: "Low", color: "rgba(255,255,255,.4)" },
};

const PROJECT_TYPES = ["Commercial", "Music Video", "Short Film", "Documentary", "Wedding", "Social Media", "Corporate", "Event", "Other"];
const STATUSES = Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, ...v }));
const PRIORITIES = ["high", "medium", "low"];

// ── api helper ─────────────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

// ── Status badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "rgba(255,255,255,.5)", bg: "rgba(255,255,255,.07)", dot: "rgba(255,255,255,.4)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: cfg.bg, fontSize: 11, fontWeight: 700, color: cfg.color, letterSpacing: ".04em", whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />
      {cfg.label}
    </span>
  );
}

// ── Priority dot ───────────────────────────────────────────────────────────────
function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || { label: priority, color: "rgba(255,255,255,.4)" };
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: cfg.color, fontWeight: 600 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />{cfg.label}</span>;
}

// ── Progress bar ───────────────────────────────────────────────────────────────
function ProgressBar({ value, color = OR }: { value: number; color?: string }) {
  return (
    <div style={{ width: "100%", height: 4, borderRadius: 100, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`, borderRadius: 100, background: color, transition: "width .5s ease" }} />
    </div>
  );
}

// ── Project Card (Kanban) ──────────────────────────────────────────────────────
function KanbanCard({ project, onEdit, onDelete }: { project: Project; onEdit: (p: Project) => void; onDelete: (id: string) => void }) {
  const daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0;
  return (
    <div style={{ background: "rgba(255,255,255,.04)", border: `1px solid ${isOverdue ? "rgba(248,113,113,.3)" : "rgba(255,255,255,.07)"}`, borderRadius: 16, padding: "16px", marginBottom: 10, cursor: "pointer", transition: "border-color .2s,transform .2s,box-shadow .2s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = OR + "44"; el.style.transform = "translateY(-2px)"; el.style.boxShadow = `0 8px 32px rgba(0,0,0,.3)`; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = isOverdue ? "rgba(248,113,113,.3)" : "rgba(255,255,255,.07)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.title}</h4>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)", margin: "3px 0 0" }}>{project.client || "—"}</p>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onEdit(project); }} style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Edit3 size={11} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(project.id); }} style={{ width: 24, height: 24, borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "rgba(248,113,113,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </div>

      {/* Type + Priority */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {project.projectType && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.45)", fontWeight: 600 }}>{project.projectType}</span>}
        <PriorityDot priority={project.priority} />
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)", fontWeight: 600 }}>Progress</span>
          <span style={{ fontSize: 10, color: project.progress >= 100 ? "#4ade80" : OR, fontWeight: 700 }}>{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={project.progress >= 100 ? "#4ade80" : OR} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {project.budget && <span style={{ fontSize: 11, color: OR, fontWeight: 700 }}>{formatCurrency(project.budget)}</span>}
        {daysLeft !== null && (
          <span style={{ fontSize: 10, fontWeight: 600, color: isOverdue ? "#f87171" : daysLeft <= 7 ? "#fbbf24" : "rgba(255,255,255,.35)" }}>
            {isOverdue ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
          </span>
        )}
        {project.driveUrl && <a href={project.driveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,.3)", display: "flex", alignItems: "center" }}><Link2 size={11} /></a>}
      </div>
    </div>
  );
}

// ── Project Modal ──────────────────────────────────────────────────────────────
function ProjectModal({ project, onClose, onSave }: { project: Project | null; onClose: () => void; onSave: (data: Partial<Project>) => void }) {
  const isEdit = !!project?.id;
  const [form, setForm] = useState<Partial<Project>>(project || { status: "active", priority: "medium", progress: 0 });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof Project, v: any) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.title) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, padding: "36px", width: "100%", maxWidth: 600, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 24, letterSpacing: "-.02em" }}>{isEdit ? "Edit Project" : "New Project"}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {[
            { k: "title", l: "Project Title *", full: true, ph: "e.g. Brand Video — PT ABC" },
            { k: "client", l: "Client", ph: "Nama klien" },
            { k: "projectType", l: "Project Type", type: "select", opts: PROJECT_TYPES },
            { k: "status", l: "Status", type: "select", opts: STATUSES.map(s => s.value) },
            { k: "priority", l: "Priority", type: "select", opts: PRIORITIES },
            { k: "progress", l: "Progress (%)", type: "number", ph: "0-100" },
            { k: "budget", l: "Budget (IDR)", type: "number", ph: "5000000" },
            { k: "startDate", l: "Start Date", type: "date" },
            { k: "deadline", l: "Deadline", type: "date" },
            { k: "driveUrl", l: "Drive/Link URL", full: true, ph: "https://drive.google.com/..." },
            { k: "description", l: "Description", full: true, type: "textarea", ph: "Deskripsi proyek..." },
            { k: "notes", l: "Internal Notes", full: true, type: "textarea", ph: "Catatan internal tim..." },
          ].map((field: any) => (
            <div key={field.k} style={{ gridColumn: field.full ? "1/-1" : "auto" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 7 }}>{field.l}</label>
              {field.type === "select" ? (
                <select value={(form as any)[field.k] || ""} onChange={e => f(field.k as any, e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, cursor: "pointer" }}>
                  <option value="">— Pilih —</option>
                  {field.opts.map((o: string) => <option key={o} value={o} style={{ background: "#111318" }}>{STATUS_CONFIG[o]?.label || PRIORITY_CONFIG[o]?.label || o}</option>)}
                </select>
              ) : field.type === "textarea" ? (
                <textarea value={(form as any)[field.k] || ""} onChange={e => f(field.k as any, e.target.value)} placeholder={field.ph} rows={3}
                  style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", resize: "vertical", fontFamily: FONT }} />
              ) : (
                <input type={field.type || "text"} value={(form as any)[field.k] || ""} onChange={e => f(field.k as any, field.type === "number" ? Number(e.target.value) : e.target.value)} placeholder={field.ph || ""}
                  style={{ width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" as any, fontFamily: FONT }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title}
            style={{ padding: "10px 24px", borderRadius: 10, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : isEdit ? "Update Project" : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [modal, setModal] = useState<Project | null | "new">(null);
  const [detail, setDetail] = useState<Project | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`/api/projects${search ? `?search=${encodeURIComponent(search)}` : ""}`);
      setProjects(Array.isArray(data) ? data : []);
    } catch (e: any) { toast({ variant: "destructive", title: "Failed to load projects", description: e.message }); }
    finally { setLoading(false); }
  }, [search, toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Project>) {
    try {
      if ((modal as Project)?.id) {
        await apiFetch(`/api/projects/${(modal as Project).id}`, { method: "PATCH", body: JSON.stringify(data) });
        toast({ title: "Project updated" });
      } else {
        await apiFetch("/api/projects", { method: "POST", body: JSON.stringify(data) });
        toast({ title: "Project created" });
      }
      setModal(null); load();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus project ini?")) return;
    try {
      await apiFetch(`/api/projects/${id}`, { method: "DELETE" });
      toast({ title: "Project deleted" });
      load();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.client || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Group by status for kanban
  const kanbanCols = [
    { key: "planning", label: "Planning", projects: filtered.filter(p => p.status === "planning") },
    { key: "active", label: "Active", projects: filtered.filter(p => p.status === "active") },
    { key: "on_hold", label: "On Hold", projects: filtered.filter(p => p.status === "on_hold") },
    { key: "completed", label: "Completed", projects: filtered.filter(p => p.status === "completed") },
  ];

  // Stats
  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === "active").length,
    completed: projects.filter(p => p.status === "completed").length,
    totalBudget: projects.reduce((s, p) => s + (p.budget || 0), 0),
  };

  const ipt = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT };

  return (
    <div style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Projects</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 600 }}>Manajemen Proyek Frameless Creative</p>
        </div>
        <button onClick={() => setModal("new")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Total Projects", v: stats.total, icon: <Film size={15} color={OR} />, color: OR },
          { l: "Active", v: stats.active, icon: <TrendingUp size={15} color="#4ade80" />, color: "#4ade80" },
          { l: "Completed", v: stats.completed, icon: <CheckCircle2 size={15} color="#60a5fa" />, color: "#60a5fa" },
          { l: "Total Budget", v: formatCurrency(stats.totalBudget), icon: <DollarSign size={15} color="#fbbf24" />, color: "#fbbf24" },
        ].map(s => (
          <div key={s.l} style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".12em", margin: 0 }}>{s.l}</p>
              {s.icon}
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: 0, letterSpacing: "-.02em" }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.35)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari project atau klien..." style={{ ...ipt, width: "100%", paddingLeft: 36, boxSizing: "border-box" }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...ipt, cursor: "pointer", minWidth: 130 }}>
          <option value="all" style={{ background: "#111318" }}>All Status</option>
          {STATUSES.map(s => <option key={s.value} value={s.value} style={{ background: "#111318" }}>{s.label}</option>)}
        </select>
        {/* View toggle */}
        <div style={{ display: "flex", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, overflow: "hidden" }}>
          {([["kanban", "Kanban", <Kanban size={14} />], ["list", "List", <List size={14} />]] as any[]).map(([v, l, icon]) => (
            <button key={v} onClick={() => setView(v)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: view === v ? OR : "transparent", border: "none", color: view === v ? "#fff" : "rgba(255,255,255,.45)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT, transition: "all .15s" }}>
              {icon}{l}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      )}

      {/* ── KANBAN VIEW ── */}
      {!loading && view === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 20, alignItems: "start" }}>
          {kanbanCols.map(col => {
            const cfg = STATUS_CONFIG[col.key] || { color: "rgba(255,255,255,.5)", bg: "rgba(255,255,255,.07)" };
            return (
              <div key={col.key}>
                {/* Column header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, padding: "10px 14px", borderRadius: 12, background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "inline-block" }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, letterSpacing: ".05em", textTransform: "uppercase" }}>{col.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: cfg.color }}>{col.projects.length}</span>
                </div>
                {/* Cards */}
                {col.projects.map(p => <KanbanCard key={p.id} project={p} onEdit={p => setModal(p)} onDelete={handleDelete} />)}
                {col.projects.length === 0 && <div style={{ padding: "24px", textAlign: "center", borderRadius: 14, border: "2px dashed rgba(255,255,255,.06)" }}>
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,.2)" }}>No projects</p>
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!loading && view === "list" && (
        <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,.07)", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 80px", gap: 12, padding: "12px 20px", background: "rgba(255,255,255,.03)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            {["Project", "Client", "Type", "Status", "Budget", "Deadline", ""].map(h => (
              <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em" }}>{h}</span>
            ))}
          </div>
          {filtered.length === 0 && <div style={{ padding: "40px", textAlign: "center" }}><p style={{ color: "rgba(255,255,255,.3)", fontSize: 14 }}>Tidak ada project ditemukan.</p></div>}
          {filtered.map((p, i) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 120px 100px 80px", gap: 12, padding: "14px 20px", borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,.04)" : "none", alignItems: "center", transition: "background .15s", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.02)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              onClick={() => setDetail(p)}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <ProgressBar value={p.progress} />
                  <span style={{ fontSize: 10, color: OR, fontWeight: 700, flexShrink: 0 }}>{p.progress}%</span>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.client || "—"}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{p.projectType || "—"}</span>
              <StatusBadge status={p.status} />
              <span style={{ fontSize: 12, color: OR, fontWeight: 700 }}>{p.budget ? formatCurrency(p.budget) : "—"}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>{p.deadline ? formatDate(p.deadline) : "—"}</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={e => { e.stopPropagation(); setModal(p); }} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={11} /></button>
                <button onClick={e => { e.stopPropagation(); handleDelete(p.id); }} style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PROJECT DETAIL DRAWER ── */}
      {detail && (
        <div onClick={e => { if (e.target === e.currentTarget) setDetail(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "min(96vw,520px)", background: "#111318", height: "100%", overflowY: "auto", borderLeft: "1px solid rgba(255,255,255,.1)", padding: "32px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-.02em" }}>{detail.title}</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setModal(detail); setDetail(null); }} style={{ width: 32, height: 32, borderRadius: 9, background: `${OR}22`, border: `1px solid ${OR}44`, cursor: "pointer", color: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={13} /></button>
                <button onClick={() => setDetail(null)} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
              </div>
            </div>

            {/* Badges */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              <StatusBadge status={detail.status} />
              <PriorityDot priority={detail.priority} />
              {detail.projectType && <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.5)", fontWeight: 600 }}>{detail.projectType}</span>}
            </div>

            {/* Progress */}
            <div style={{ padding: "18px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>Progress</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: detail.progress >= 100 ? "#4ade80" : OR }}>{detail.progress}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 100, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${detail.progress}%`, borderRadius: 100, background: detail.progress >= 100 ? "#4ade80" : OR, transition: "width .5s" }} />
              </div>
            </div>

            {/* Info grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              {[
                { l: "Client", v: detail.client },
                { l: "Budget", v: detail.budget ? formatCurrency(detail.budget) : null },
                { l: "Start Date", v: detail.startDate ? formatDate(detail.startDate) : null },
                { l: "Deadline", v: detail.deadline ? formatDate(detail.deadline) : null },
              ].filter(r => r.v).map(row => (
                <div key={row.l} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em", margin: "0 0 5px" }}>{row.l}</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{row.v}</p>
                </div>
              ))}
            </div>

            {detail.description && <div style={{ marginBottom: 20 }}><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 }}>Description</p><p style={{ fontSize: 13, color: "rgba(255,255,255,.6)", lineHeight: 1.7 }}>{detail.description}</p></div>}
            {detail.notes && <div style={{ marginBottom: 20 }}><p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 }}>Notes</p><p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.7, padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 10 }}>{detail.notes}</p></div>}
            {detail.driveUrl && <a href={detail.driveUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, background: "rgba(66,133,244,.1)", border: "1px solid rgba(66,133,244,.2)", color: "#60a5fa", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><FolderOpen size={14} /> Open Drive Folder</a>}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && modal !== null && (
        <ProjectModal
          project={modal === "new" ? null : modal as Project}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
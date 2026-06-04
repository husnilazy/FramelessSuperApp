import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AIChat } from "@/components/ai-chat";
import { NotificationBell } from "@/components/notification-bell";
import { FilmmakingTools } from "@/pages/FilmmakingTools";
import { useTheme } from "@/lib/theme";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Activity,
  Archive,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock,
  FileArchive,
  FileCheck2,
  Files,
  Film,
  Grid2X2,
  LayoutList,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Moon,
  Paperclip,
  Play,
  RefreshCw,
  Search,
  Send,
  Sun,
  Upload,
  UserRound,
  Users,
  X,
  PlayCircle,
  StopCircle,
} from "lucide-react";

type CrewUser = {
  id: string;
  name: string;
  role: string;
  email?: string | null;
  department?: string | null;
  avatarUrl?: string | null;
};

type Project = {
  id: string;
  title: string;
  client?: string | null;
  status?: string | null;
  progress?: number | null;
  deadline?: string | null;
  startDate?: string | null;
  priority?: string | null;
  projectType?: string | null;
  description?: string | null;
  notes?: string | null;
  driveUrl?: string | null;
  assignedMemberId?: string | null;
};

type Task = {
  id: string;
  projectId?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  roleLabel?: string | null;
  memberId?: string | null;
  projectTitle?: string | null;
  timeSpent?: number | null;
};

type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  allDay?: boolean | null;
  color?: string | null;
  type?: string | null;
  assignedTo?: string | null;
  projectId?: string | null;
  location?: string | null;
};

type TeamMember = {
  id: string;
  name: string;
  role?: string | null;
  department?: string | null;
  status?: string | null;
  avatarUrl?: string | null;
  isActive?: boolean | null;
};

type Asset = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  fileUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ChatMsg = {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  createdAt: string;
};

type CalendarView = "week" | "month" | "agenda";
type Tab = "overview" | "projects" | "tasks" | "crew" | "files" | "calendar" | "chat" | "brief" | "portfolio" | "filmmaking";

const FONT = "'Plus Jakarta Sans', sans-serif";
const DEFAULT_PRIMARY = "#FF6A20";
const DEFAULT_LINE = "rgba(255,255,255,0.12)";
const DEFAULT_SURFACE = "rgba(255,255,255,0.055)";

// Extra safety: in case any old code still references these
const OR = DEFAULT_PRIMARY;
const LINE = DEFAULT_LINE;
const SURFACE = DEFAULT_SURFACE;

// Dynamic theme-aware glassmorphism helpers (replaces old hardcoded dark values)
function useCrewVisuals() {
  const { theme, appearance } = useTheme();
  const isDark = theme === "dark";
  const primary = appearance.primaryColor || "#FF6A20";

  const glass = isDark
    ? {
        bg: "rgba(255,255,255,0.055)",
        bgStrong: "rgba(255,255,255,0.08)",
        border: "rgba(255,255,255,0.10)",
        borderActive: `${primary}55`,
        text: "#f8fafc",
        muted: "rgba(255,255,255,0.52)",
        surface: "rgba(255,255,255,0.045)",
      }
    : {
        bg: "rgba(255,255,255,0.78)",
        bgStrong: "rgba(255,255,255,0.92)",
        border: "rgba(15,23,42,0.10)",
        borderActive: `${primary}55`,
        text: "#0f172a",
        muted: "rgba(15,23,42,0.55)",
        surface: "rgba(255,255,255,0.65)",
      };

  return {
    isDark,
    primary,
    glass,
    font: FONT,
  };
}

const EVENT_COLORS: Record<string, string> = {
  shoot: "#60a5fa",
  shooting: "#60a5fa",
  editing: "#34d399",
  deadline: "#fb923c",
  meeting: "#a78bfa",
  review: "#facc15",
  task: "#f472b6",
  event: "#94a3b8",
};

const PHASE_COLORS: Record<string, string> = {
  planning: "#a78bfa",
  active: "#60a5fa",
  in_progress: "#60a5fa",
  on_shoot: "#fb923c",
  editing: "#34d399",
  review: "#facc15",
  completed: "#4ade80",
};

function getCrewToken() {
  return localStorage.getItem("crew_token");
}

function getCrewUser(): CrewUser | null {
  try {
    return JSON.parse(localStorage.getItem("crew_user") || "null");
  } catch {
    return null;
  }
}

async function crewFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getCrewToken();
  const headers = new Headers(opts.headers);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path, { ...opts, headers });
  if (!res.ok) {
    if (res.status === 401) {
      // Token invalid/expired after backend restart → clear it so user sees clean login state
      try {
        localStorage.removeItem("crew_token");
        localStorage.removeItem("crew_user");
      } catch {}
      // Throw a specific error the UI can react to
      throw new Error("SESSION_EXPIRED");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value?: string | Date | null, opts?: Intl.DateTimeFormatOptions) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", opts || { day: "numeric", month: "short" });
}

function formatTime(value?: string | null) {
  if (!value) return "All day";
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function daysUntil(value?: string | null) {
  if (!value) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}

function normalizeStatus(status?: string | null) {
  return (status || "TODO").toLowerCase().replace(/\s+/g, "_");
}

function apiTaskStatus(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === "done" || normalized === "completed") return "DONE";
  if (normalized === "in_progress") return "IN_PROGRESS";
  if (normalized === "review") return "REVIEW";
  return "TODO";
}

function taskBadge(task: Task) {
  const status = normalizeStatus(task.status);
  const due = daysUntil(task.dueDate);
  if (status === "done" || status === "completed") return { label: "Selesai", color: "#4ade80", bg: "rgba(74,222,128,.14)" };
  if ((task.priority || "").toLowerCase() === "high" || due < 0) return { label: "Urgent", color: "#fb7185", bg: "rgba(251,113,133,.14)" };
  if (due === 0) return { label: "Hari Ini", color: "#facc15", bg: "rgba(250,204,21,.14)" };
  if (status === "review") return { label: "Review", color: "#c4b5fd", bg: "rgba(196,181,253,.14)" };
  return { label: task.roleLabel || "Task", color: "#93c5fd", bg: "rgba(147,197,253,.12)" };
}

// Parse crew notes appended to description for sub-notes feature
function parseCrewNotes(fullDesc?: string | null) {
  if (!fullDesc) return { brief: "", notes: [] as Array<{ time: string; text: string }> };
  const marker = "[CREW_NOTES]";
  const idx = fullDesc.indexOf(marker);
  if (idx === -1) return { brief: fullDesc.trim(), notes: [] };
  const brief = fullDesc.slice(0, idx).trim();
  const notesPart = fullDesc.slice(idx + marker.length).trim();
  const notes = notesPart
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.match(/^\[([^\]]+)\]\s*(.*)$/);
      return m ? { time: m[1], text: m[2] } : { time: new Date().toISOString(), text: line };
    });
  return { brief, notes };
}

function eventType(event: CalendarEvent) {
  const raw = `${event.type || ""} ${event.title || ""}`.toLowerCase();
  if (raw.includes("shoot")) return "shoot";
  if (raw.includes("edit")) return "editing";
  if (raw.includes("deadline")) return "deadline";
  if (raw.includes("meeting") || raw.includes("meet")) return "meeting";
  if (raw.includes("review")) return "review";
  if (raw.includes("task")) return "task";
  return event.type || "event";
}

function eventColor(event: CalendarEvent) {
  return event.color || EVENT_COLORS[eventType(event)] || EVENT_COLORS.event;
}

function initials(name?: string | null) {
  return (name || "FC")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section
      style={{
        background: "rgba(255,255,255,0.055)",
        border: `1px solid rgba(255,255,255,0.12)`,
        borderRadius: 12,
        padding: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function IconButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 8,
        border: `1px solid ${active ? DEFAULT_PRIMARY : "rgba(255,255,255,0.10)"}`,
        background: active ? `${DEFAULT_PRIMARY}22` : "rgba(255,255,255,.04)",
        color: active ? DEFAULT_PRIMARY : "rgba(255,255,255,.72)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ value, color = DEFAULT_PRIMARY }: { value?: number | null; color?: string }) {
  const pct = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function Pill({ children, color = DEFAULT_PRIMARY }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 9px",
        borderRadius: 999,
        background: `${color}1f`,
        color,
        fontSize: 11,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function CrewLogin({ onLogin }: { onLogin: (token: string, user: CrewUser) => void }) {
  const { toast } = useToast();
  const { isDark, primary, glass } = useCrewVisuals();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<any>({ logoUrl: "", companyName: "Frameless Creative" });

  useEffect(() => {
    fetchCrewBranding().then(b => setBranding({
      logoUrl: b.logoUrl, 
      companyName: b.companyName,
      welcomeMessage: b.welcomeMessage || "",
      logoSize: b.logoSize || 30,
      meshColors: b.meshColors || ["#FF6A20", "#7c3aed", "#2563eb"] as [string, string, string],
      allowCrewPhotoUpload: b.allowCrewPhotoUpload !== false,
      showProfileInfo: b.showProfileInfo !== false,
    }));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/crew/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login gagal");
      const crew = data.member || data.user || data.crew;
      localStorage.setItem("crew_token", data.token);
      localStorage.setItem("crew_user", JSON.stringify(crew));
      onLogin(data.token, crew);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Login gagal", description: err.message });
    } finally {
      setLoading(false);
    }
  }

  const logoEl = branding.logoUrl ? (
    <img src={branding.logoUrl} alt={branding.companyName} style={{ height: branding.logoSize || 30, maxWidth: 160, objectFit: "contain" }} />
  ) : (
    <div style={{ width: 54, height: 54, borderRadius: 16, background: primary, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 22, color: "#fff" }}>F</div>
  );

  return (
    <div style={{
      minHeight: "100dvh",
      background: isDark ? "#050505" : "#f8f9fb",
      display: "grid",
      placeItems: "center",
      padding: 20,
      fontFamily: FONT,
      color: glass.text,
    }}>
      {/* Subtle cinematic background mesh */}
      <div style={{
        position: "absolute", inset: 0,
        background: isDark
          ? `radial-gradient(60% 60% at 50% 20%, ${primary}15 0%, transparent 70%)`
          : `radial-gradient(50% 50% at 50% 30%, ${primary}12 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <motion.form
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.21, 0.92, 0.25, 1] }}
        onSubmit={handleLogin}
        style={{ width: "100%", maxWidth: 410, position: "relative", zIndex: 1 }}
      >
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>{logoEl}</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>Crew Portal</h1>
        </div>

        <div style={{
          background: glass.bg,
          border: `1px solid ${glass.border}`,
          borderRadius: 20,
          padding: 32,
          backdropFilter: "blur(20px)",
          boxShadow: isDark ? "0 10px 40px rgba(0,0,0,0.4)" : "0 10px 30px rgba(15,23,42,0.08)",
        }}>
          <label style={{ ...labelStyle, color: glass.muted }}>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="crew@frameless.id" style={{ ...inputStyle, background: glass.bgStrong, borderColor: glass.border, color: glass.text }} />

          <div style={{ height: 14 }} />

          <label style={{ ...labelStyle, color: glass.muted }}>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required placeholder="Password" style={{ ...inputStyle, background: glass.bgStrong, borderColor: glass.border, color: glass.text }} />

          <button type="submit" disabled={loading} style={{
            ...primaryButton, width: "100%", marginTop: 24, background: primary, color: "#fff",
            boxShadow: `0 4px 14px ${primary}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            opacity: loading ? 0.85 : 1
          }}>
            {loading ? (
              <>
                <div style={{ width: 16, height: 16, border: '2.5px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <span>Masuk...</span>
              </>
            ) : "Masuk ke Dashboard"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <a href="/login" style={{ color: glass.muted, fontSize: 12, textDecoration: "none" }}>Admin Login →</a>
        </div>
      </motion.form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 7,
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  borderRadius: 10,
  border: `1px solid`,
  padding: "0 14px",
  outline: "none",
  fontFamily: FONT,
  fontSize: 14,
};

const primaryButton: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "none",
  fontWeight: 900,
  fontSize: 14,
  fontFamily: FONT,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 18px",
  transition: "all .2s cubic-bezier(0.23,1,0.32,1)",
};

function CrewDashboard({ user, onLogout }: { user: CrewUser; onLogout: () => void }) {
  const { toast } = useToast();
  const { isDark, primary, glass } = useCrewVisuals();
  const { toggleTheme } = useTheme();

  // Make OR / LINE / SURFACE available immediately for all code below (fixes TDZ error)
  const OR = primary || DEFAULT_PRIMARY;
  const LINE = glass?.border || (isDark ? "rgba(255,255,255,0.10)" : "rgba(15,23,42,0.10)");
  const SURFACE = glass?.surface || (isDark ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.65)");

  const [tab, setTab] = useState<Tab>("overview");
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [myPortfolioFiles, setMyPortfolioFiles] = useState<any[]>([]); // My Portfolio feature (internal crew output)
  const [loading, setLoading] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [taskFilter, setTaskFilter] = useState<"open" | "today" | "urgent" | "review" | "done">("open");
  const [assetFilter, setAssetFilter] = useState<"all" | "raw" | "edited" | "review">("all");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadProjectId, setUploadProjectId] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"raw-footage" | "edited-draft" | "final-review">("raw-footage");
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const chatBottom = useRef<HTMLDivElement | null>(null);
  const chatFileInput = useRef<HTMLInputElement | null>(null);

  // Dynamic branding (logo + welcome + mesh for crew)
  const [branding, setBranding] = useState<any>({ 
    logoUrl: "", 
    companyName: "Frameless Creative", 
    welcomeMessage: "", 
    logoSize: 30,
    meshColors: ["#FF6A20", "#7c3aed", "#2563eb"] as [string, string, string],
    allowCrewPhotoUpload: true,
    showProfileInfo: true,
  });
  const [showProfile, setShowProfile] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalNoteInput, setModalNoteInput] = useState("");
  const [modalManualMinutes, setModalManualMinutes] = useState("");
  const [projectFiles, setProjectFiles] = useState<any[]>([]);
  const [uploadingToProject, setUploadingToProject] = useState(false);
  const [addingProjectLink, setAddingProjectLink] = useState(false);

  // Personal drag-reorder order for My Tasks checklist (persisted in localStorage, per crew user)
  const ORDER_LS_KEY = `crew_task_order_${user?.id || "anon"}`;
  const [taskOrder, setTaskOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ORDER_LS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // (order seeding happens on first drag or via displayTasks fallback)

  useEffect(() => {
    fetchCrewBranding().then((b: any) => setBranding({
      logoUrl: b.logoUrl || "",
      companyName: b.companyName || "Frameless Creative",
      welcomeMessage: b.welcomeMessage || "",
      logoSize: b.logoSize || 30,
      meshColors: b.meshColors || ["#FF6A20", "#7c3aed", "#2563eb"],
      allowCrewPhotoUpload: b.allowCrewPhotoUpload !== false,
      showProfileInfo: b.showProfileInfo !== false,
    }));
  }, []);

  // Time Tracking State
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    let interval: any;
    if (activeTimer) {
      interval = setInterval(() => setTimerTick(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRows, taskRows, eventRows, teamRows, assetRows, chatRows, timerRow] = await Promise.all([
        crewFetch<Project[]>("/api/crew/projects").catch(() => []),
        crewFetch<Task[]>("/api/crew/tasks").catch(() => []),
        crewFetch<CalendarEvent[]>("/api/crew/calendar").catch(() => []),
        crewFetch<TeamMember[]>("/api/team").catch(() => []),
        crewFetch<Asset[]>("/api/digital-assets").catch(() => []),
        crewFetch<ChatMsg[]>("/api/chat/messages?limit=50").catch(() => []),
        crewFetch<any>("/api/crew/time/active").catch(() => null),
      ]);
      setProjects(projectRows);
      setTasks(taskRows.map((task) => ({ ...task, projectTitle: projectRows.find((p) => p.id === task.projectId)?.title || task.projectTitle })));
      setEvents(eventRows);
      setTeam(teamRows);
      setAssets(assetRows);
      setMessages(chatRows);
      setActiveTimer(timerRow);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal memuat crew dashboard", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Refetch team list when opening the Crew tab (so avatar updates from admin are visible)
  useEffect(() => {
    if (tab === "crew") {
      crewFetch<TeamMember[]>("/api/team")
        .then(setTeam)
        .catch(() => {});
    }
  }, [tab]);

  // Fetch project files when a project is selected (for crew)
  useEffect(() => {
    if (selectedProject) {
      const token = getCrewToken();
      fetch(`/api/crew/projects/${selectedProject.id}/files`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then(res => res.ok ? res.json() : [])
        .then(setProjectFiles)
        .catch(() => setProjectFiles([]));
    } else {
      setProjectFiles([]);
    }
  }, [selectedProject]);

  // Keep selected task in sync when tasks are refreshed (after status/timer updates)
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find((t) => t.id === selectedTask.id);
      if (fresh) {
        setSelectedTask(fresh);
      }
    }
  }, [tasks]);

  // Clear modal inputs when switching tasks or closing detail
  useEffect(() => {
    if (!selectedTask) {
      setModalNoteInput("");
      setModalManualMinutes("");
    }
  }, [selectedTask?.id]);

  // Auto refresh projects when opening Files tab (to ensure project list is up to date for upload)
  useEffect(() => {
    if (tab === "files" && projects.length === 0) {
      const token = getCrewToken();
      fetch("/api/crew/projects", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then(res => res.ok ? res.json() : [])
        .then(setProjects)
        .catch(() => {});
    }
  }, [tab]);

  // Fetch My Portfolio files when tab is opened
  useEffect(() => {
    if (tab === "portfolio") {
      const token = getCrewToken();
      fetch("/api/crew/my-files", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
        .then(res => res.ok ? res.json() : [])
        .then(setMyPortfolioFiles)
        .catch(() => setMyPortfolioFiles([]));
    }
  }, [tab]);

  useEffect(() => {
    chatBottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, tab]);

  const now = new Date();
  const enrichedEvents = useMemo(() => {
    const fromProjects: CalendarEvent[] = projects
      .filter((project) => project.deadline)
      .map((project) => ({
        id: `deadline-${project.id}`,
        title: `Deadline: ${project.title}`,
        description: project.client || project.description || "",
        startDate: project.deadline as string,
        type: "deadline",
        projectId: project.id,
      }));

    const fromTasks: CalendarEvent[] = tasks
      .filter((task) => task.dueDate)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        description: task.projectTitle || task.roleLabel || "",
        startDate: task.dueDate as string,
        type: normalizeStatus(task.status) === "review" ? "review" : "task",
        projectId: task.projectId || undefined,
      }));

    return [...events, ...fromProjects, ...fromTasks].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }, [events, projects, tasks]);

  const todayEvents = enrichedEvents.filter((event) => sameDay(new Date(event.startDate), now));
  const monthEvents = enrichedEvents.filter((event) => {
    const d = new Date(event.startDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const urgentDeadlines = tasks.filter((task) => {
    const status = normalizeStatus(task.status);
    const due = daysUntil(task.dueDate);
    return status !== "done" && status !== "completed" && due >= 0 && due <= 3;
  });
  const doneCount = tasks.filter((task) => ["done", "completed"].includes(normalizeStatus(task.status))).length;
  const taskProgress = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const onShootCount = todayEvents.filter((event) => eventType(event) === "shoot").length;

  const metrics = [
    { label: "Jadwal bulan ini", value: monthEvents.length, icon: <CalendarDays size={17} />, tone: "#60a5fa", sub: `${todayEvents.length} event hari ini` },
    { label: "Deadline mendesak", value: urgentDeadlines.length, icon: <Bell size={17} />, tone: "#fb923c", sub: "0-3 hari ke depan" },
    { label: "Shoot hari ini", value: onShootCount, icon: <Film size={17} />, tone: DEFAULT_PRIMARY, sub: onShootCount ? "Siapkan call sheet" : "Tidak ada shooting" },
    { label: "Progress task", value: `${taskProgress}%`, icon: <CheckCircle2 size={17} />, tone: "#34d399", sub: `${doneCount}/${tasks.length || 0} selesai` },
  ];

  const filteredTasks = tasks.filter((task) => {
    const status = normalizeStatus(task.status);
    const due = daysUntil(task.dueDate);
    if (taskFilter === "done") return status === "done" || status === "completed";
    if (taskFilter === "today") return due === 0 && status !== "done" && status !== "completed";
    if (taskFilter === "urgent") return ((task.priority || "").toLowerCase() === "high" || due < 0 || due <= 2) && status !== "done" && status !== "completed";
    if (taskFilter === "review") return status === "review";
    return status !== "done" && status !== "completed";
  });

  // Sort checklist: high prio + soonest due on top (more actionable)
  const sortedFilteredTasks = [...filteredTasks].sort((a, b) => {
    const pa = (a.priority || "").toLowerCase() === "high" ? 3 : (a.priority || "").toLowerCase() === "medium" ? 2 : 1;
    const pb = (b.priority || "").toLowerCase() === "high" ? 3 : (b.priority || "").toLowerCase() === "medium" ? 2 : 1;
    if (pa !== pb) return pb - pa;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return da - db;
  });

  // Apply user's personal drag-reorder on top of the smart sort (only for My Tasks view)
  const displayTasks = useMemo(() => {
    if (!taskOrder.length) return sortedFilteredTasks;
    const orderMap = new Map(taskOrder.map((id, idx) => [id, idx]));
    return [...sortedFilteredTasks].sort((a, b) => {
      const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
      const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
      return ia - ib;
    });
  }, [sortedFilteredTasks, taskOrder]);

  // Persist order when changed
  const saveTaskOrder = (ids: string[]) => {
    setTaskOrder(ids);
    try { localStorage.setItem(ORDER_LS_KEY, JSON.stringify(ids)); } catch {}
  };

  const resetTaskOrder = () => {
    setTaskOrder([]);
    try { localStorage.removeItem(ORDER_LS_KEY); } catch {}
  };

  const visibleAssets = assets.filter((asset) => {
    const category = `${asset.category || ""} ${asset.title || ""}`.toLowerCase();
    if (assetFilter === "raw") return category.includes("raw") || category.includes("footage");
    if (assetFilter === "edited") return category.includes("edit") || category.includes("draft");
    if (assetFilter === "review") return category.includes("review") || category.includes("final");
    return true;
  });

  const activeProjects = projects.filter((project) => !["completed", "done", "cancelled"].includes(normalizeStatus(project.status)));
  const assignedProjectIds = new Set(tasks.map((task) => task.projectId).filter(Boolean));
  const myProjects = activeProjects.filter((project) => project.assignedMemberId === user.id || assignedProjectIds.has(project.id));
  const projectsForDisplay = myProjects.length ? myProjects : activeProjects;

  function teamAvailability(member: TeamMember) {
    const status = normalizeStatus(member.status);
    if (!member.isActive) return { label: "Offline", color: "rgba(255,255,255,.35)" };
    const isOnShoot = todayEvents.some((event) => eventType(event) === "shoot" && (event.assignedTo === member.id || event.assignedTo === "all"));
    if (isOnShoot || status.includes("shoot")) return { label: "On-shoot", color: DEFAULT_PRIMARY };
    if (status.includes("offline")) return { label: "Offline", color: "rgba(255,255,255,.35)" };
    return { label: "Available", color: "#34d399" };
  }

  async function updateTask(task: Task, patch: Partial<Task & { timeSpent?: number; description?: string }>) {
    try {
      const body: any = {};
      if (patch.status !== undefined) body.status = apiTaskStatus(patch.status as string);
      if (patch.timeSpent !== undefined) body.timeSpent = patch.timeSpent;
      if (patch.description !== undefined) body.description = patch.description;

      const updated = await crewFetch<Task>(`/api/crew/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, ...updated, ...patch } : item)));
      toast({ title: "Task diperbarui" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal update task", description: err.message });
    }
  }

  // Back-compat wrapper
  async function updateTaskStatus(task: Task, status: string) {
    await updateTask(task, { status });
  }

  async function uploadAsset() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", uploadFile);
      form.append("label", uploadLabel || uploadFile.name);
      form.append("assetStatus", uploadStatus);
      if (uploadProjectId) form.append("projectId", uploadProjectId);
      const token = getCrewToken();
      const res = await fetch("/api/crew/uploads", {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload gagal");

      if (data.projectFile) {
        toast({ 
          title: "File berhasil diupload ke project", 
          description: "File tersimpan di detail project." 
        });
      } else {
        const newAsset = data.asset || {
          id: data.filename || cryptoRandom(),
          title: uploadLabel || uploadFile.name,
          category: uploadStatus,
          fileUrl: data.url,
          createdAt: new Date().toISOString(),
        };
        setAssets((prev) => [newAsset, ...prev]);
        toast({ title: "Asset terupload", description: "Status asset tersimpan untuk admin." });
      }

      setUploadFile(null);
      setUploadLabel("");
      setUploadProjectId("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload gagal", description: err.message });
    } finally {
      setUploading(false);
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() && !chatFile) return;
    setSending(true);
    try {
      let fileUrl: string | undefined;
      let fileName: string | undefined;
      if (chatFile) {
        const form = new FormData();
        form.append("file", chatFile);
        form.append("label", chatFile.name);
        form.append("assetStatus", "brief-attachment");
        const token = getCrewToken();
        const res = await fetch("/api/crew/uploads", {
          method: "POST",
          body: form,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload gagal");
        fileUrl = data.url;
        fileName = chatFile.name;
      }
      const msg = await crewFetch<ChatMsg>("/api/chat/messages", {
        method: "POST",
        body: JSON.stringify({
          content: chatInput.trim() || fileName || "Attachment",
          fileUrl,
          fileName,
          senderId: user.id,
          senderName: user.name,
          senderRole: user.role || "crew",
        }),
      });
      setMessages((prev) => [...prev, msg]);
      setChatInput("");
      setChatFile(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal kirim pesan", description: err.message });
    } finally {
      setSending(false);
    }
  }

  async function toggleTimer(task?: Task) {
    try {
      if (activeTimer) {
        // Stop timer
        await crewFetch("/api/crew/time/stop", { method: "POST" });
        setActiveTimer(null);
        toast({ title: "Timer dihentikan", description: "Waktu kerja telah disimpan." });
        load(); // Reload tasks to get updated timeSpent
      } else if (task) {
        // Start timer
        const newTimer = await crewFetch<any>("/api/crew/time/start", {
          method: "POST",
          body: JSON.stringify({ taskId: task.id, projectId: task.projectId, description: `Working on: ${task.title}` })
        });
        setActiveTimer(newTimer);
        toast({ title: "Timer dimulai", description: `Mengerjakan: ${task.title}` });
        if (normalizeStatus(task.status) === "todo") load(); // Reload to update status to IN_PROGRESS
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Timer gagal", description: err.message });
    }
  }

  const formatActiveTimer = () => {
    if (!activeTimer) return "00:00:00";
    const diff = Math.floor((new Date().getTime() - new Date(activeTimer.startTime).getTime()) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const NAV: Array<{ id: Tab; label: string; icon: React.ReactNode; count?: number }> = [
    { id: "overview", label: "Overview", icon: <Activity size={16} /> },
    { id: "projects", label: "Projects", icon: <Grid2X2 size={16} />, count: projectsForDisplay.length },
    { id: "tasks", label: "My Tasks", icon: <ListChecks size={16} />, count: tasks.filter((task) => !["done", "completed"].includes(normalizeStatus(task.status))).length },
    { id: "crew", label: "Crew", icon: <Users size={16} /> },
    { id: "files", label: "Files", icon: <Files size={16} />, count: assets.length },
    { id: "filmmaking", label: "Filmmaking Tools", icon: <PlayCircle size={16} /> },
    { id: "portfolio", label: "My Portfolio", icon: <Film size={16} /> },
    { id: "calendar", label: "Calendar", icon: <CalendarDays size={16} />, count: monthEvents.length },
    { id: "brief", label: "Daily Brief", icon: <ClipboardList size={16} /> },
    { id: "chat", label: "Team Chat", icon: <MessageSquare size={16} /> },
  ];

  // Dynamic logo element (reused in header)
  const LogoMark = branding.logoUrl ? (
    <img src={branding.logoUrl} alt={branding.companyName} style={{ height: branding.logoSize || 28, maxWidth: 120, objectFit: "contain" }} />
  ) : (
    <div style={{ width: 28, height: 28, borderRadius: 8, background: primary, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 13, color: "#fff" }}>F</div>
  );

  const [m1, m2, m3] = branding.meshColors;

  return (
    <div 
      style={{ 
        minHeight: "100dvh", 
        background: isDark ? "#050505" : "#f1f3f7", 
        color: glass.text, 
        fontFamily: FONT,
        backgroundImage: isDark 
          ? `radial-gradient(40% 40% at 20% 10%, ${m1}18 0%, transparent 65%), radial-gradient(35% 35% at 80% 30%, ${m2}18 0%, transparent 65%), radial-gradient(30% 30% at 40% 85%, ${m3}18 0%, transparent 65%)`
          : `radial-gradient(40% 40% at 20% 10%, ${m1}12 0%, transparent 65%), radial-gradient(35% 35% at 80% 30%, ${m2}12 0%, transparent 65%), radial-gradient(30% 30% at 40% 85%, ${m3}12 0%, transparent 65%)`
      }}
    >
      {/* Full Page Animated Mesh Gradient */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: isDark ? 0.28 : 0.18 }}>
        <div className="global-mesh" style={{ background: m1, top: '5%', left: '-5%', width: '45%', height: '45%', animation: 'meshMove1 28s ease-in-out infinite' }} />
        <div className="global-mesh" style={{ background: m2, top: '20%', right: '-8%', width: '50%', height: '50%', animation: 'meshMove2 35s ease-in-out infinite reverse' }} />
        <div className="global-mesh" style={{ background: m3, bottom: '-10%', left: '15%', width: '40%', height: '40%', animation: 'meshMove3 24s ease-in-out infinite' }} />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${isDark ? "rgba(255,255,255,.18)" : "rgba(15,23,42,.18)"};border-radius:999px}

        .mesh-layer .mesh-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          animation: meshMove 25s ease-in-out infinite;
          transition: transform 0.3s ease;
        }
        @keyframes meshMove {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(8%, -6%) scale(1.08); }
          50% { transform: translate(-5%, 9%) scale(0.95); }
          75% { transform: translate(6%, 4%) scale(1.03); }
        }

        .crew-sidebar {
          position: relative;
          z-index: 1;
        }
        .crew-shell{display:grid;grid-template-columns:248px minmax(0,1fr);min-height:100dvh}
        .crew-main{padding:24px 28px;min-width:0}

        .global-mesh {
          position: absolute;
          border-radius: 50%;
          filter: blur(95px);
          animation: meshMove1 28s ease-in-out infinite;
        }

        @keyframes meshMove1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(15%, -10%) scale(1.1); }
          50% { transform: translate(-8%, 12%) scale(0.92); }
          75% { transform: translate(10%, 5%) scale(1.05); }
        }
        @keyframes meshMove2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-12%, 8%) scale(0.95); }
          50% { transform: translate(9%, -14%) scale(1.08); }
          75% { transform: translate(-7%, 6%) scale(0.97); }
        }
        @keyframes meshMove3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(8%, 11%) scale(1.06); }
          50% { transform: translate(-13%, -6%) scale(0.94); }
          75% { transform: translate(5%, -9%) scale(1.03); }
        }

        .mesh-anim {
          position: absolute;
          border-radius: 50%;
          filter: blur(85px);
          opacity: 0.85;
          animation: meshDrift1 32s ease-in-out infinite;
        }

        @keyframes meshDrift1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(12%, -8%) scale(1.06); }
          66% { transform: translate(-7%, 11%) scale(0.96); }
        }
        @keyframes meshDrift2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-10%, 7%) scale(0.97); }
          66% { transform: translate(9%, -12%) scale(1.05); }
        }
        @keyframes meshDrift3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(6%, 9%) scale(1.04); }
          66% { transform: translate(-11%, -5%) scale(0.95); }
        }
        .nav-item{transition:all .15s cubic-bezier(0.23,1,0.32,1)}
        .nav-item:hover{background:${isDark ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.06)"}!important}
        .glass-card{background:${glass.bg};border:1px solid ${glass.border};border-radius:16px;backdrop-filter:blur(22px);transition:transform .2s cubic-bezier(0.23,1,0.32,1), box-shadow .2s}
        .glass-card:hover{transform:translateY(-1px);box-shadow:0 10px 30px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(15,23,42,0.07)"}}
        .metric-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
        .content-grid{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}
        .cal-cell{transition:all .1s ease}
        .cal-cell:hover{border-color:${primary}55!important}
        @media(max-width:1024px){.crew-shell{grid-template-columns:1fr}.crew-sidebar{display:${mobileMenu ? "block" : "none"};position:fixed;z-index:60;inset:68px auto 0 0;width:268px;box-shadow:0 20px 60px rgba(0,0,0,0.4)}.crew-main{padding:18px 16px}.metric-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.content-grid{grid-template-columns:1fr!important}}
        @media(max-width:640px){.metric-grid{grid-template-columns:1fr 1fr!important}.crew-main{padding:14px 12px}.toolbar-wrap{flex-direction:column;align-items:stretch!important;gap:10px!important}}
        @media(max-width:480px){.metric-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Modern Glass Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50, height: 68,
        background: isDark ? "rgba(5,5,5,0.65)" : "rgba(255,255,255,0.65)",
        borderBottom: `1px solid ${glass.border}`,
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            type="button"
            className="mobile-toggle"
            onClick={() => setMobileMenu(v => !v)}
            style={{ ...resetButton, display: "none", padding: 8, color: glass.text }}
            title="Menu"
          >
            <Menu size={20} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {LogoMark}
            <div>
              <div style={{ 
                fontWeight: 600, 
                fontSize: 12, 
                letterSpacing: "0.12em", 
                textTransform: "uppercase",
                color: isDark ? "#94a3b8" : "#475569",
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
              }}>
                Crew Portal
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Active Timer - beautiful pill */}
          <AnimatePresence>
            {activeTimer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  background: `${primary}18`, border: `1px solid ${primary}40`,
                  padding: "5px 14px 5px 10px", borderRadius: 999, fontSize: 13, fontWeight: 800,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: primary, animation: "pulse 2s infinite" }} />
                <span style={{ color: primary, fontVariantNumeric: "tabular-nums" }}>{formatActiveTimer()}</span>
                <button onClick={() => toggleTimer()} style={{ ...resetButton, color: primary, padding: 2 }} title="Stop Timer">
                  <StopCircle size={15} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Theme Toggle - proper using context */}
          <button
            onClick={toggleTheme}
            style={{ ...resetButton, padding: "8px 10px", borderRadius: 10, background: glass.bg, border: `1px solid ${glass.border}`, color: glass.muted }}
            title="Toggle theme"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* Crew Notifications */}
          <NotificationBell 
            variant="crew" 
            onNotificationClick={(notif) => {
              // When crew clicks a notification
              const isTaskNotif = notif.referenceType === 'task' || notif.category === 'task' ||
                /task/i.test(notif.title || '') || /task/i.test(notif.message || '');
              if (isTaskNotif) {
                setTab('tasks');
                setTaskFilter('open');

                // Force refresh tasks so newly assigned Quick Assign tasks appear immediately
                crewFetch<Task[]>("/api/crew/tasks").then((newTasks) => {
                  setTasks(newTasks.map((task) => ({ 
                    ...task, 
                    projectTitle: projects.find((p) => p.id === task.projectId)?.title || (task as any).projectTitle 
                  })));
                }).catch(() => {});
              } else if (notif.referenceType === 'project') {
                setTab('projects');
              }
              // For other types, just open the bell (already closed in component)
            }}
          />

          <button onClick={load} style={{ ...resetButton, padding: 8, borderRadius: 10, background: glass.bg, border: `1px solid ${glass.border}`, color: glass.muted }} title="Refresh">
            <RefreshCw size={17} />
          </button>

          {/* User pill - klik untuk buka Profile Card */}
          <div 
            onClick={() => setShowProfile(true)}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "5px 12px 5px 6px", borderRadius: 999,
              background: glass.bg, border: `1px solid ${glass.border}`,
              cursor: "pointer",
            }} 
            className="desktop-only"
            title="Klik untuk lihat profil"
          >
            <Avatar member={user} size={26} />
            <div style={{ fontSize: 12.5, fontWeight: 700 }}>{user.name.split(" ")[0]}</div>
          </div>

          <button onClick={onLogout} style={{ ...resetButton, padding: 9, borderRadius: 10, background: glass.bg, border: `1px solid ${glass.border}`, color: glass.muted }} title="Logout">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="crew-shell">
        {/* Glassmorphic Sidebar (animated on mobile) */}
        <AnimatePresence>
          <aside
            className="crew-sidebar"
            style={{
              borderRight: `1px solid ${glass.border}`,
              background: isDark ? "rgba(8,8,10,0.55)" : "rgba(255,255,255,0.55)",
              padding: "18px 14px",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              overflowY: "auto",
              position: "relative",
              zIndex: 1,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              {NAV.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="nav-item"
                    onClick={() => { setTab(item.id); setMobileMenu(false); }}
                    style={{
                      border: `1px solid ${active ? glass.borderActive : "transparent"}`,
                      background: active ? `${primary}15` : "transparent",
                      color: active ? primary : glass.muted,
                      borderRadius: 12,
                      padding: "11px 13px",
                      display: "flex", alignItems: "center", gap: 11,
                      cursor: "pointer", fontFamily: FONT, fontWeight: 700, textAlign: "left",
                      fontSize: 13.5,
                    }}
                  >
                    {item.icon}
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {typeof item.count === "number" && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999,
                        background: active ? primary : "rgba(255,255,255,.1)", color: active ? "#fff" : glass.muted,
                      }}>{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Team availability (condensed) */}
            <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${glass.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", color: glass.muted, marginBottom: 10, paddingLeft: 4 }}>TEAM STATUS</div>
              <div style={{ display: "grid", gap: 7 }}>
                {team.slice(0, 7).map((member) => {
                  const availability = teamAvailability(member);
                  return (
                    <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "3px 4px" }}>
                      <Avatar member={member} size={24} />
                      <div style={{ minWidth: 0, flex: 1, fontSize: 12.5, fontWeight: 600 }}>{member.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: availability.color }}>{availability.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </AnimatePresence>

        {/* Main Content Area */}
        <main className="crew-main">
          {/* Beautiful personalized greeting */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }} className="toolbar-wrap">
            <div>
              <div style={{ fontSize: 13, color: glass.muted, fontWeight: 600, marginBottom: 2 }}>
                {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
              </div>
              <h1 style={{ margin: 0, fontSize: "clamp(26px, 4.2vw, 34px)", lineHeight: 1.05, fontWeight: 900, letterSpacing: "-0.025em" }}>
                Selamat {now.getHours() < 12 ? "pagi" : now.getHours() < 18 ? "siang" : "malam"}, {user.name.split(" ")[0]}
              </h1>
              {branding.welcomeMessage && (
                <p style={{ margin: "6px 0 0", color: primary, fontSize: 13, fontWeight: 600 }}>{branding.welcomeMessage}</p>
              )}
              <p style={{ margin: "4px 0 0", color: glass.muted, fontSize: 13 }}>
                {urgentDeadlines.length} deadline dekat • {todayEvents.length} event hari ini
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" onClick={() => setTab("brief")} style={{ ...secondaryButton, borderColor: glass.border, background: glass.bg }}>
                <Play size={15} /> Brief
              </button>
              <button type="button" onClick={() => setTab("calendar")} style={{ ...primaryButton, background: primary, color: "#fff" }}>
                <CalendarDays size={15} /> Calendar
              </button>
            </div>
          </div>

          {loading && (
            <div className="glass-card" style={{ marginBottom: 16, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: glass.muted, fontWeight: 700 }}>
                <RefreshCw size={16} /> Loading production data...
              </div>
            </div>
          )}

          {/* Animated Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            >
              {tab === "overview" && (
            <>
              <MetricGrid metrics={metrics} />
              <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(320px,.8fr)", gap: 14, marginTop: 14 }}>
                <ProjectsPanel projects={projectsForDisplay.slice(0, 5)} team={team} onOpenProjects={() => setTab("projects")} />
                <WorkloadPanel tasks={tasks} events={enrichedEvents} />
              </div>
              <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14, marginTop: 14 }}>
                <TasksPanel tasks={displayTasks.slice(0, 5)} onDone={updateTaskStatus} onOpen={() => setTab("tasks")} activeTimer={activeTimer} onToggleTimer={toggleTimer} onSelect={setSelectedTask} />
                <ActivityPanel messages={messages.slice(-4)} events={todayEvents.slice(0, 3)} />
              </div>
              <BriefPanel projects={projectsForDisplay.slice(0, 3)} tasks={urgentDeadlines.slice(0, 3)} events={todayEvents.slice(0, 3)} onOpen={() => setTab("brief")} />
            </>
          )}

          {tab === "calendar" && (
            <>
              <MetricGrid metrics={metrics} />
              <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 330px", gap: 14, marginTop: 14 }}>
                <CalendarPanel
                  view={calendarView}
                  setView={setCalendarView}
                  cursorDate={cursorDate}
                  setCursorDate={setCursorDate}
                  events={enrichedEvents}
                  setTab={setTab}
                />
                <SidebarToday events={todayEvents} team={team} availability={teamAvailability} projects={projectsForDisplay.slice(0, 4)} />
              </div>
            </>
          )}

          {tab === "tasks" && (
            <Card>
              <SectionHeader title="My Tasks" subtitle={`${tasks.length} task terhubung ke role ${user.role || "crew"}`}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Segmented
                    value={taskFilter}
                    onChange={(value) => setTaskFilter(value as typeof taskFilter)}
                    options={[
                      ["open", "Open"],
                      ["today", "Hari Ini"],
                      ["urgent", "Urgent"],
                      ["review", "Review"],
                      ["done", "Selesai"],
                    ]}
                  />
                  {taskOrder.length > 0 && (
                    <button onClick={resetTaskOrder} style={{ ...resetButton, fontSize: 11, padding: "4px 10px", border: `1px solid ${DEFAULT_LINE}`, borderRadius: 6, color: glass.muted }} title="Reset ke urutan default (priority + due)">
                      Reset order
                    </button>
                  )}
                </div>
              </SectionHeader>

              {/* Drag-reorderable checklist (personal order persisted locally) */}
              <Reorder.Group
                as="div"
                axis="y"
                values={displayTasks}
                onReorder={(newOrder: Task[]) => {
                  const newIds = newOrder.map((t) => t.id);
                  saveTaskOrder(newIds);
                }}
                style={{ display: "grid", gap: 9 }}
              >
                {displayTasks.map((task) => (
                  <Reorder.Item key={task.id} value={task} style={{ listStyle: "none" }}>
                    <TaskRow task={task} onDone={updateTaskStatus} activeTimer={activeTimer} onToggleTimer={toggleTimer} onSelect={setSelectedTask} />
                  </Reorder.Item>
                ))}
                {!displayTasks.length && <EmptyState icon={<ListChecks size={24} />} title="Tidak ada task di filter ini" />}
              </Reorder.Group>
            </Card>
          )}

          {tab === "projects" && (
            <Card>
              <SectionHeader title="Project Status" subtitle="Progress, fase, PIC, dan deadline per project." />
              <div style={{ display: "grid", gap: 10 }}>
                {projectsForDisplay.map((project) => (
                  <div key={project.id} onClick={() => setSelectedProject(project)} style={{ cursor: 'pointer' }}>
                    <ProjectDetailRow project={project} team={team} tasks={tasks.filter((task) => task.projectId === project.id)} />
                  </div>
                ))}
                {!projectsForDisplay.length && <EmptyState icon={<BriefcaseBusiness size={24} />} title="Belum ada project aktif" />}
              </div>
            </Card>
          )}

          {tab === "crew" && (
            <Card>
              <SectionHeader title="Team Availability" subtitle="Status produksi untuk koordinasi assign job." />
              <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                {team.map((member) => {
                  const availability = teamAvailability(member);
                  return (
                    <div key={member.id} style={{ border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, padding: 13, background: "rgba(255,255,255,.03)", display: "flex", gap: 12 }}>
                      <Avatar member={member} size={44} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{member.name}</div>
                        <div style={{ color: "rgba(255,255,255,.45)", fontSize: 12, marginTop: 3 }}>{member.role || member.department || "Crew"}</div>
                        <div style={{ marginTop: 9 }}>
                          <Pill color={availability.color}>{availability.label}</Pill>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {tab === "files" && (
            <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 360px", gap: 14 }}>
              <Card>
                <SectionHeader title="File and Asset Status" subtitle="RAW, edited draft, dan file review yang bisa dipantau admin.">
                  <Segmented
                    value={assetFilter}
                    onChange={(value) => setAssetFilter(value as typeof assetFilter)}
                    options={[
                      ["all", "All"],
                      ["raw", "RAW"],
                      ["edited", "Edited"],
                      ["review", "Review"],
                    ]}
                  />
                </SectionHeader>
                <div style={{ display: "grid", gap: 9 }}>
                  {visibleAssets.map((asset) => (
                    <AssetRow key={asset.id} asset={asset} />
                  ))}
                  {!visibleAssets.length && <EmptyState icon={<Archive size={24} />} title="Belum ada asset di status ini" />}
                </div>
              </Card>
              <Card>
                <SectionHeader title="Upload Asset" subtitle="Upload otomatis dicatat sebagai asset untuk admin." />
                <div
                  onClick={() => document.getElementById("crew-upload-input")?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setUploadFile(file);
                  }}
                  style={{ border: `1px dashed ${DEFAULT_LINE}`, borderRadius: 8, padding: 18, minHeight: 112, display: "grid", placeItems: "center", cursor: "pointer", background: "rgba(255,255,255,.03)", textAlign: "center" }}
                >
                  <input id="crew-upload-input" type="file" style={{ display: "none" }} onChange={(e) => setUploadFile(e.target.files?.[0] || null)} />
                  <div>
                    <Upload size={24} color={DEFAULT_PRIMARY} style={{ margin: "0 auto 8px" }} />
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{uploadFile ? uploadFile.name : "Drop atau pilih file"}</div>
                    <div style={{ color: "rgba(255,255,255,.42)", fontSize: 11, marginTop: 4 }}>{uploadFile ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : "Footage, preview, PDF, deck, atau final export"}</div>
                  </div>
                </div>
                <div style={{ height: 12 }} />
                <label style={labelStyle}>Label</label>
                <input value={uploadLabel} onChange={(e) => setUploadLabel(e.target.value)} placeholder="RAW Wedding D1 / Edit v3 / Final export" style={inputStyle} />
                <div style={{ height: 12 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={labelStyle}>Project (opsional)</label>
                  <button 
                    type="button" 
                    onClick={async () => {
                      const token = getCrewToken();
                      try {
                        const res = await fetch("/api/crew/projects", {
                          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setProjects(data);
                          toast({ title: "Project list refreshed" });
                        }
                      } catch {}
                    }}
                    style={{ fontSize: 10, color: DEFAULT_PRIMARY, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    Refresh
                  </button>
                </div>
                <select 
                  value={uploadProjectId} 
                  onChange={(e) => setUploadProjectId(e.target.value)} 
                  style={inputStyle}
                  disabled={projects.length === 0}
                >
                  <option value="">Tidak terkait project (upload umum)</option>
                  {projects.length > 0 ? (
                    projects.map((project: any) => (
                      <option key={project.id} value={project.id}>
                        {project.title} {project.client ? `(${project.client})` : ""} {project.hasTask ? "★" : ""}
                      </option>
                    ))
                  ) : (
                    <option disabled>Belum ada project tersedia</option>
                  )}
                </select>
                {projects.length === 0 && (
                  <div style={{ fontSize: 11, color: "#facc15", marginTop: 4 }}>
                    Klik tombol "Refresh" di atas untuk memuat ulang daftar project.
                  </div>
                )}
                <div style={{ height: 12 }} />
                <label style={labelStyle}>Status Asset</label>
                <select value={uploadStatus} onChange={(e) => setUploadStatus(e.target.value as typeof uploadStatus)} style={inputStyle}>
                  <option value="raw-footage">RAW Footage</option>
                  <option value="edited-draft">Edited Draft</option>
                  <option value="final-review">Final Review</option>
                </select>
                <button type="button" onClick={uploadAsset} disabled={!uploadFile || uploading} style={{ ...primaryButton, width: "100%", marginTop: 16, opacity: !uploadFile ? 0.55 : 1 }}>
                  {uploading ? "Uploading..." : "Upload and Track"}
                </button>
              </Card>
            </div>
          )}

          {tab === "portfolio" && (
            <Card>
              <SectionHeader 
                title="My Portfolio / Output Kerjaan" 
                subtitle="Kumpulan hasil kerjaan final yang sudah kamu selesaikan. Bisa digunakan sebagai referensi dan portofolio internal."
              />
              <div style={{ display: "grid", gap: 12 }}>
                {myPortfolioFiles.length > 0 ? (
                  myPortfolioFiles.map((file: any) => (
                    <div 
                      key={file.id} 
                      style={{ 
                        border: `1px solid ${DEFAULT_LINE}`, 
                        borderRadius: 12, 
                        padding: 16, 
                        background: "rgba(255,255,255,0.03)" 
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                            {file.title}
                          </div>
                          <div style={{ fontSize: 13, color: glass.muted, marginBottom: 8 }}>
                            Project: <strong>{file.projectTitle}</strong> {file.client ? `• ${file.client}` : ""}
                          </div>
                          <div style={{ fontSize: 12, color: glass.muted }}>
                            {file.category} • Uploaded on {formatDate(file.createdAt)}
                          </div>
                        </div>
                        <a 
                          href={file.fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            padding: "8px 16px", 
                            background: DEFAULT_PRIMARY, 
                            color: "white", 
                            borderRadius: 8, 
                            fontSize: 12, 
                            fontWeight: 700,
                            textDecoration: "none",
                            whiteSpace: "nowrap"
                          }}
                        >
                          Download / View
                        </a>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState 
                    icon={<Film size={28} />} 
                    title="Belum ada hasil kerjaan yang diupload" 
                  />
                )}
              </div>
            </Card>
          )}

          {tab === "brief" && (
            <BriefPage projects={projectsForDisplay} tasks={urgentDeadlines} events={todayEvents} user={user} />
          )}

          {tab === "chat" && (
            <Card style={{ height: "calc(100dvh - 116px)", display: "flex", flexDirection: "column" }}>
              <SectionHeader title="Team Chat" subtitle="Koordinasi cepat untuk update produksi." />
              <div style={{ flex: 1, overflowY: "auto", display: "grid", alignContent: "start", gap: 10, paddingRight: 4 }}>
                {messages.map((message) => {
                  const mine = message.senderId === user.id;
                  return (
                    <div key={message.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "78%", border: `1px solid ${mine ? "rgba(255,106,32,.35)" : DEFAULT_LINE}`, background: mine ? "rgba(255,106,32,.15)" : "rgba(255,255,255,.04)", borderRadius: 8, padding: 11 }}>
                        <div style={{ fontSize: 11, color: mine ? DEFAULT_PRIMARY : "rgba(255,255,255,.45)", fontWeight: 900, marginBottom: 4 }}>{message.senderName}</div>
                        <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.5 }}>{message.content}</div>
                        {message.fileUrl && (
                          <a href={message.fileUrl} target="_blank" rel="noreferrer" style={{ color: "#93c5fd", fontSize: 12, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                            <Paperclip size={13} /> {message.fileName || "Attachment"}
                          </a>
                        )}
                        <div style={{ color: "rgba(255,255,255,.3)", fontSize: 10, marginTop: 6 }}>{formatTime(message.createdAt)}</div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatBottom} />
              </div>
              {chatFile && (
                <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, color: "rgba(255,255,255,.7)", fontSize: 12 }}>
                  <Paperclip size={14} /> {chatFile.name}
                  <button type="button" onClick={() => setChatFile(null)} style={resetButton} title="Remove attachment">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <input ref={chatFileInput} type="file" style={{ display: "none" }} onChange={(e) => setChatFile(e.target.files?.[0] || null)} />
                <IconButton title="Attach file" onClick={() => chatFileInput.current?.click()}>
                  <Paperclip size={16} />
                </IconButton>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }} placeholder="Ketik update produksi..." style={{ ...inputStyle, flex: 1 }} />
                <button type="button" onClick={sendMessage} disabled={sending} style={{ ...primaryButton, minWidth: 48 }}>
                  <Send size={16} />
                </button>
              </div>
            </Card>
          )}

          {tab === "filmmaking" && (
            <FilmmakingTools />
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <AIChat 
        dark={true} 
        contextData={{
          user: user,
          myProjects: projectsForDisplay?.slice(0, 5),
          urgentTasks: urgentDeadlines?.slice(0, 5),
          todayEvents: todayEvents?.slice(0, 5),
        }} 
      />

      {/* Project Detail Modal - Apple-like with spring animation */}
      <AnimatePresence>
        {selectedProject && (
          <motion.div
            key="project-modal-backdrop"
            onClick={() => {
              setSelectedProject(null);
              setUploadingToProject(false);
              setAddingProjectLink(false);
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.68)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              key="project-modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.965, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{
                type: 'spring',
                stiffness: 420,
                damping: 32,
                mass: 0.9,
              }}
              style={{
                background: glass.bg,
                borderRadius: 20,
                width: '100%',
                maxWidth: 860,
                border: `1px solid ${glass.border}`,
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 25px 70px -15px rgba(0,0,0,0.5)',
              }}
            >
            {/* Header */}
            <div style={{ padding: '22px 28px', borderBottom: `1px solid ${glass.border}`, background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1 }}>{selectedProject.title}</div>
                  <div style={{ color: glass.muted, marginTop: 6, fontSize: 14 }}>{selectedProject.client || 'Internal Project'}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: `${primary}18`, color: primary, padding: '4px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                    {selectedProject.status || 'Active'}
                  </div>
                  <button onClick={() => { setSelectedProject(null); setUploadingToProject(false); setAddingProjectLink(false); }} style={{ ...resetButton, fontSize: 26, lineHeight: 1, padding: '0 6px', color: glass.muted }}>×</button>
                </div>
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', fontSize: 13 }}>
                <div style={{ color: glass.muted }}>
                  Deadline: <span style={{ color: glass.text, fontWeight: 600 }}>{formatDate(selectedProject.deadline)}</span>
                </div>
                <div style={{ color: glass.muted }}>
                  Progress: <span style={{ color: glass.text, fontWeight: 600 }}>{selectedProject.progress || 0}%</span>
                </div>
                {selectedProject.priority && (
                  <div style={{ color: glass.muted }}>
                    Priority: <span style={{ color: glass.text, fontWeight: 600 }}>{selectedProject.priority}</span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: 28, display: 'grid', gap: 28 }}>
              {/* Description */}
              {selectedProject.description && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: glass.muted, marginBottom: 8 }}>PROJECT BRIEF</div>
                  <div style={{ fontSize: 15, lineHeight: 1.65, color: glass.text }}>{selectedProject.description}</div>
                </div>
              )}

              {/* Files + Upload Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Project Files (Internal)</div>
                  <button 
                    onClick={() => {
                      const token = getCrewToken();
                      fetch(`/api/crew/projects/${selectedProject.id}/files`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                        .then(r => r.json()).then(setProjectFiles);
                    }}
                    style={{ fontSize: 12, color: primary, background: 'none', border: 'none', fontWeight: 600 }}
                  >
                    Refresh
                  </button>
                </div>

                {/* Upload Area - File + Link */}
                <div style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: `1px solid ${glass.border}`, 
                  borderRadius: 14, 
                  padding: 16, 
                  marginBottom: 16 
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: glass.muted }}>ADD NEW OUTPUT</div>
                  
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {/* File Upload */}
                    <button
                      disabled={uploadingToProject}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.onchange = async (e: any) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          setUploadingToProject(true);
                          const formData = new FormData();
                          formData.append('file', file);
                          formData.append('label', file.name);
                          formData.append('projectId', selectedProject.id);
                          formData.append('assetStatus', 'work-file');

                          try {
                            const res = await fetch("/api/crew/uploads", {
                              method: "POST",
                              headers: { Authorization: `Bearer ${getCrewToken()}` } as any,
                              body: formData,
                            });
                            const data = await res.json();
                            if (data.url) {
                              toast({ title: "File uploaded to project" });
                              const token = getCrewToken();
                              const refreshed = await fetch(`/api/crew/projects/${selectedProject.id}/files`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r => r.json());
                              setProjectFiles(refreshed);
                            }
                          } catch {
                            toast({ variant: "destructive", title: "Upload failed" });
                          } finally {
                            setUploadingToProject(false);
                          }
                        };
                        input.click();
                      }}
                      style={{ 
                        flex: 1, 
                        minWidth: 180,
                        padding: '14px 18px', 
                        borderRadius: 10, 
                        background: uploadingToProject ? 'rgba(255,106,32,0.5)' : primary, 
                        color: 'white', 
                        border: 'none', 
                        fontWeight: 700, 
                        fontSize: 14,
                        cursor: uploadingToProject ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        opacity: uploadingToProject ? 0.7 : 1
                      }}
                    >
                      {uploadingToProject ? "⏳ Uploading..." : "📁 Upload File"}
                    </button>

                    {/* Link / Google Drive */}
                    <div style={{ flex: 1, minWidth: 260, display: 'flex', gap: 8 }}>
                      <input 
                        id="link-input"
                        placeholder="https://drive.google.com/..." 
                        disabled={addingProjectLink}
                        style={{ 
                          flex: 1, 
                          background: glass.bgStrong, 
                          border: `1px solid ${glass.border}`, 
                          borderRadius: 10, 
                          padding: '0 14px', 
                          fontSize: 13,
                          color: glass.text,
                          opacity: addingProjectLink ? 0.6 : 1
                        }} 
                      />
                      <button
                        disabled={addingProjectLink}
                        onClick={async () => {
                          const inputEl = document.getElementById('link-input') as HTMLInputElement;
                          const url = inputEl?.value?.trim();
                          if (!url) {
                            toast({ title: "Masukkan URL dulu" });
                            return;
                          }

                          setAddingProjectLink(true);
                          try {
                            const token = getCrewToken();
                            const res = await fetch(`/api/crew/projects/${selectedProject.id}/files`, {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                title: url.split('/').pop() || 'Google Drive Link',
                                fileUrl: url,
                                category: 'link',
                              })
                            });
                            if (res.ok) {
                              toast({ title: "Link berhasil ditambahkan ke project" });
                              inputEl.value = '';
                              const refreshed = await fetch(`/api/crew/projects/${selectedProject.id}/files`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }).then(r => r.json());
                              setProjectFiles(refreshed);
                            } else {
                              toast({ variant: "destructive", title: "Gagal menambahkan link" });
                            }
                          } catch {
                            toast({ variant: "destructive", title: "Gagal menambahkan link" });
                          } finally {
                            setAddingProjectLink(false);
                          }
                        }}
                        style={{ 
                          padding: '0 20px', 
                          borderRadius: 10, 
                          background: addingProjectLink ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)', 
                          color: glass.text, 
                          border: `1px solid ${glass.border}`, 
                          fontWeight: 600, 
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          opacity: addingProjectLink ? 0.6 : 1,
                          cursor: addingProjectLink ? 'default' : 'pointer'
                        }}
                      >
                        {addingProjectLink ? "⏳ Adding..." : "+ Add Link"}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: glass.muted, marginTop: 10 }}>
                    File atau link yang diupload di sini hanya terlihat oleh tim internal project ini.
                  </div>
                </div>

                {/* Files List - Improved */}
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: glass.muted }}>FILES &amp; LINKS</div>
                {projectFiles.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {projectFiles.map((file: any) => (
                      <div 
                        key={file.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '12px 16px', 
                          background: 'rgba(255,255,255,0.035)', 
                          borderRadius: 12,
                          border: `1px solid ${glass.border}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            width: 36, height: 36, borderRadius: 8, 
                            background: file.category === 'link' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            {file.category === 'link' ? '🔗' : '📄'}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.title}</div>
                            <div style={{ fontSize: 12, color: glass.muted, marginTop: 2 }}>
                              {file.category} • {formatDate(file.createdAt)}
                            </div>
                          </div>
                        </div>
                        <a 
                          href={file.fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ 
                            padding: '7px 16px', 
                            background: 'rgba(255,255,255,0.06)', 
                            borderRadius: 8, 
                            fontSize: 13,
                            fontWeight: 600,
                            color: primary,
                            textDecoration: 'none',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {file.category === 'link' ? 'Buka Link' : 'View File'}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: glass.muted, fontSize: 13, background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                    Belum ada file atau link di project ini.
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>My Tasks in this Project</div>
                {tasks.filter(t => t.projectId === selectedProject.id).length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {tasks.filter(t => t.projectId === selectedProject.id).map(task => (
                      <div 
                        key={task.id} 
                        onClick={() => setSelectedTask(task)}
                        style={{ padding: '11px 16px', background: glass.bgStrong, borderRadius: 10, fontSize: 14, display: 'flex', justifyContent: 'space-between', cursor: 'pointer', border: `1px solid ${DEFAULT_LINE}` }}
                      >
                        <span style={{ fontWeight: 600 }}>{task.title}</span>
                        <span style={{ color: glass.muted, fontSize: 12 }}>{task.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: glass.muted, fontSize: 13, padding: '12px 0' }}>Kamu belum punya task di project ini.</div>
                )}
              </div>
            </div>

            <div style={{ padding: '18px 28px', borderTop: `1px solid ${glass.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end', background: 'rgba(0,0,0,0.1)' }}>
              <button onClick={() => { setSelectedProject(null); setUploadingToProject(false); setAddingProjectLink(false); }} style={{ ...secondaryButton, borderColor: glass.border, padding: '9px 22px' }}>Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Task Detail Modal - richer checklist + timer + status controls */}
      <AnimatePresence>
        {selectedTask && (
          <motion.div
            key="task-detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTask(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 260, damping: 26 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: glass.bg,
                border: `1px solid ${glass.border}`,
                borderRadius: 18,
                width: "100%",
                maxWidth: 520,
                maxHeight: "92vh",
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5)"
              }}
            >
              {/* Header */}
              <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${glass.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.2, color: "#fff" }}>{selectedTask.title}</div>
                  <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Pill color={taskBadge(selectedTask).color}>{taskBadge(selectedTask).label}</Pill>
                    {selectedTask.priority && <Pill color={(selectedTask.priority||"").toLowerCase()==="high"?"#ef4444":"#f59e0b"}>{selectedTask.priority}</Pill>}
                    {selectedTask.projectTitle && <span style={{ fontSize: 12, color: glass.muted }}>in {selectedTask.projectTitle}</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedTask(null)} style={{ ...resetButton, fontSize: 22, lineHeight: 1, padding: "0 4px", color: glass.muted }}>×</button>
              </div>

              <div style={{ padding: 22, overflowY: "auto", maxHeight: "calc(92vh - 140px)" }}>
                {/* Meta */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: glass.muted, letterSpacing: 1 }}>Due</div>
                    <div style={{ fontWeight: 700, color: selectedTask.dueDate && new Date(selectedTask.dueDate) < new Date() && !["done","completed"].includes(normalizeStatus(selectedTask.status)) ? "#ef4444" : "#fff" }}>
                      {selectedTask.dueDate ? formatDate(selectedTask.dueDate) : "No deadline"}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, textTransform: "uppercase", color: glass.muted, letterSpacing: 1 }}>Time Logged</div>
                    <div style={{ fontWeight: 800, color: DEFAULT_PRIMARY }}>
                      {selectedTask.timeSpent ? `${Math.floor(selectedTask.timeSpent / 60)}h ${selectedTask.timeSpent % 60}m` : "0h 0m"}
                    </div>
                  </div>
                </div>

                {/* Description / details */}
                {selectedTask.description && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, textTransform: "uppercase", color: glass.muted, marginBottom: 6, letterSpacing: 0.5 }}>Details / Brief</div>
                    <div style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-wrap" }}>{selectedTask.description}</div>
                  </div>
                )}

                {/* Live Timer Section */}
                {activeTimer?.taskId === selectedTask.id ? (
                  <div style={{ background: `${DEFAULT_PRIMARY}15`, border: `1px solid ${DEFAULT_PRIMARY}40`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: DEFAULT_PRIMARY, animation: "pulse 1.2s infinite" }} />
                      <span style={{ fontWeight: 800, color: DEFAULT_PRIMARY, fontSize: 12, letterSpacing: 1 }}>TIMER BERJALAN — REALTIME</span>
                    </div>
                    <div style={{ fontSize: 42, fontWeight: 900, fontVariantNumeric: "tabular-nums", color: "#fff", lineHeight: 1 }}>{formatActiveTimer()}</div>
                    <div style={{ marginTop: 12 }}>
                      <button onClick={() => { toggleTimer(); /* modal will sync via effect */ }} style={{ ...resetButton, background: "#fff", color: "#111", padding: "10px 18px", borderRadius: 999, fontWeight: 800, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <StopCircle size={16} /> STOP &amp; LOG TIME
                      </button>
                    </div>
                  </div>
                ) : (
                  !["done", "completed"].includes(normalizeStatus(selectedTask.status)) && toggleTimer && (
                    <div style={{ marginBottom: 18 }}>
                      <button 
                        onClick={() => { toggleTimer(selectedTask); }}
                        style={{ width: "100%", padding: "14px 18px", borderRadius: 12, background: DEFAULT_PRIMARY, color: "#fff", fontWeight: 900, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "none" }}
                      >
                        <PlayCircle size={18} /> MULAI KERJA (START TIMER)
                      </button>
                      <div style={{ textAlign: "center", fontSize: 11, color: glass.muted, marginTop: 6 }}>Timer akan otomatis update status ke IN_PROGRESS</div>
                    </div>
                  )
                )}

                {/* Manual time log (advanced) */}
                <div style={{ marginBottom: 18, padding: 14, border: `1px solid ${glass.border}`, borderRadius: 12, background: glass.bgStrong }}>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: glass.muted, marginBottom: 6, letterSpacing: 0.5 }}>Manual Time Log</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      min={1}
                      value={modalManualMinutes}
                      onChange={(e) => setModalManualMinutes(e.target.value)}
                      placeholder="menit"
                      style={{ width: 90, background: "rgba(0,0,0,0.2)", border: `1px solid ${glass.border}`, color: "#fff", padding: "6px 10px", borderRadius: 8, fontSize: 13 }}
                    />
                    <button
                      onClick={() => {
                        const add = parseInt(modalManualMinutes || "0", 10);
                        if (!add || !selectedTask) return;
                        const newSpent = (selectedTask.timeSpent || 0) + add;
                        updateTask(selectedTask, { timeSpent: newSpent });
                        setModalManualMinutes("");
                        toast({ title: `+${add} menit dicatat` });
                      }}
                      style={{ padding: "6px 14px", borderRadius: 8, background: DEFAULT_PRIMARY, color: "#fff", fontWeight: 700, fontSize: 13 }}
                    >
                      Log waktu
                    </button>
                    <span style={{ fontSize: 11, color: glass.muted }}>menit (akan ditambah ke total)</span>
                  </div>
                </div>

                {/* Sub-notes / progress log per task (advanced) - appended to description */}
                {(() => {
                  const parsed = parseCrewNotes(selectedTask.description);
                  return (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ fontSize: 11, textTransform: "uppercase", color: glass.muted, marginBottom: 6, letterSpacing: 0.5 }}>My Notes / Progress Log (sub-notes)</div>

                      {parsed.notes.length > 0 && (
                        <div style={{ marginBottom: 8, maxHeight: 120, overflow: "auto", padding: "8px 10px", background: "rgba(0,0,0,0.15)", borderRadius: 8, border: `1px solid ${glass.border}` }}>
                          {parsed.notes.slice().reverse().map((n, i) => (
                            <div key={i} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>
                              <span style={{ color: glass.muted, fontSize: 10 }}>[{new Date(n.time).toLocaleString("id-ID", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}]</span> {n.text}
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={modalNoteInput}
                          onChange={(e) => setModalNoteInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && modalNoteInput.trim() && selectedTask) {
                              const parsed = parseCrewNotes(selectedTask.description);
                              const nowIso = new Date().toISOString();
                              const newLine = `[${nowIso}] ${modalNoteInput.trim()}`;
                              const newNotes = [...parsed.notes.map(nn => `[${nn.time}] ${nn.text}`), newLine];
                              const newDesc = (parsed.brief || "") + "\n\n[CREW_NOTES]\n" + newNotes.join("\n");
                              updateTask(selectedTask, { description: newDesc.trim() });
                              setModalNoteInput("");
                            }
                          }}
                          placeholder="Tulis catatan singkat (Enter untuk simpan)"
                          style={{ flex: 1, background: "rgba(0,0,0,0.2)", border: `1px solid ${glass.border}`, color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}
                        />
                        <button
                          onClick={() => {
                            if (!modalNoteInput.trim() || !selectedTask) return;
                            const parsed = parseCrewNotes(selectedTask.description);
                            const nowIso = new Date().toISOString();
                            const newLine = `[${nowIso}] ${modalNoteInput.trim()}`;
                            const newNotes = [...parsed.notes.map(nn => `[${nn.time}] ${nn.text}`), newLine];
                            const newDesc = (parsed.brief || "") + "\n\n[CREW_NOTES]\n" + newNotes.join("\n");
                            updateTask(selectedTask, { description: newDesc.trim() });
                            setModalNoteInput("");
                          }}
                          style={{ padding: "8px 16px", borderRadius: 8, background: "rgba(255,255,255,0.1)", color: "#fff", fontWeight: 600, fontSize: 13, border: `1px solid ${glass.border}` }}
                        >
                          + Note
                        </button>
                      </div>
                      <div style={{ fontSize: 10, color: glass.muted, marginTop: 4 }}>Catatan disimpan ke task (terlihat admin & crew).</div>
                    </div>
                  );
                })()}

                {/* Status controls - better checklist actions */}
                <div>
                  <div style={{ fontSize: 11, textTransform: "uppercase", color: glass.muted, marginBottom: 8, letterSpacing: 0.5 }}>Update Status</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((s) => {
                      const active = normalizeStatus(selectedTask.status) === normalizeStatus(s);
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            const apiS = s === "DONE" ? "done" : s.toLowerCase();
                            updateTaskStatus(selectedTask, apiS);
                            // modal stays open and will sync via the tasks effect
                          }}
                          style={{
                            ...resetButton,
                            padding: "8px 16px",
                            borderRadius: 999,
                            fontSize: 13,
                            fontWeight: 700,
                            border: active ? `2px solid ${DEFAULT_PRIMARY}` : `1px solid ${glass.border}`,
                            background: active ? `${DEFAULT_PRIMARY}15` : glass.bgStrong,
                            color: active ? DEFAULT_PRIMARY : glass.text
                          }}
                        >
                          {s.replace("_", " ")}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 8 }}>Checklist lebih detail: gunakan timer untuk tracking waktu kerja yang realtime ke admin.</div>
                </div>
              </div>

              <div style={{ padding: 16, borderTop: `1px solid ${glass.border}`, display: "flex", gap: 10, justifyContent: "flex-end", background: "rgba(0,0,0,0.2)" }}>
                <button onClick={() => setSelectedTask(null)} style={{ ...secondaryButton, borderColor: glass.border, padding: "10px 18px" }}>Tutup</button>
                {!["done","completed"].includes(normalizeStatus(selectedTask.status)) && toggleTimer && activeTimer?.taskId !== selectedTask.id && (
                  <button onClick={() => { toggleTimer(selectedTask); setSelectedTask(null); }} style={{ padding: "10px 18px", borderRadius: 10, background: DEFAULT_PRIMARY, color: "#fff", fontWeight: 700 }}>Mulai &amp; Tutup</button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Card Modal */}
      {showProfile && (
        <div 
          onClick={() => setShowProfile(false)}
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', 
            zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark ? '#111113' : '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 360,
              border: `1px solid ${glass.border}`,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
            }}
          >
            {/* Header */}
            <div style={{ padding: 20, textAlign: 'center', borderBottom: `1px solid ${glass.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div onClick={() => {
                  if (!branding.allowCrewPhotoUpload) return;
                  const input = document.createElement('input');
                  input.type = 'file'; input.accept = 'image/*';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const fd = new FormData(); fd.append('file', file);
                    try {
                      const res = await fetch("/api/crew/uploads", { 
                        method: "POST", headers: { Authorization: `Bearer ${getCrewToken()}` } as any, body: fd 
                      });
                      const d = await res.json();
                      if (d.url) {
                        const u = { ...user, avatarUrl: d.url };
                        localStorage.setItem("crew_user", JSON.stringify(u));
                        window.location.reload();
                      }
                    } catch {}
                  };
                  input.click();
                }} style={{ cursor: branding.allowCrewPhotoUpload ? 'pointer' : 'default', opacity: branding.allowCrewPhotoUpload ? 1 : 0.6 }}>
                  <Avatar member={user} size={72} />
                  {branding.allowCrewPhotoUpload && <div style={{ fontSize: 10, color: glass.muted, textAlign: 'center', marginTop: 4 }}>klik untuk ubah</div>}
                </div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{user.name}</div>
              <div style={{ color: glass.muted, fontSize: 13, marginTop: 2 }}>
                {user.role} {user.department ? `• ${user.department}` : ''}
              </div>
            </div>

            {/* Info */}
            <div style={{ padding: 20, fontSize: 14 }}>
              {branding.showProfileInfo && user.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: glass.muted }}>Email</span>
                  <span style={{ fontWeight: 600 }}>{user.email}</span>
                </div>
              )}
              {branding.showProfileInfo && user.department && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ color: glass.muted }}>Department</span>
                  <span style={{ fontWeight: 600 }}>{user.department}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: glass.muted }}>Role</span>
                <span style={{ fontWeight: 600 }}>{user.role || '-'}</span>
              </div>
            </div>

            <div style={{ padding: 16, borderTop: `1px solid ${glass.border}` }}>
              {branding.allowCrewPhotoUpload ? (
                <button 
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file'; input.accept = 'image/*';
                    input.onchange = async (e: any) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append('file', file);
                      try {
                        const res = await fetch("/api/crew/uploads", { 
                          method: "POST", headers: { Authorization: `Bearer ${getCrewToken()}` } as any, body: fd 
                        });
                        const d = await res.json();
                        if (d.url) {
                          const u = { ...user, avatarUrl: d.url };
                          localStorage.setItem("crew_user", JSON.stringify(u));
                          window.location.reload();
                        }
                      } catch {}
                    };
                    input.click();
                  }}
                  style={{
                    width: '100%', padding: '10px 0', borderRadius: 12,
                    background: primary, color: '#fff', fontWeight: 700, fontSize: 14,
                    border: 'none', cursor: 'pointer'
                  }}
                >
                  Ubah Foto Profil
                </button>
              ) : (
                <div style={{ fontSize: 12, color: glass.muted, textAlign: 'center' }}>Upload foto profil dinonaktifkan oleh admin</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const secondaryButton: React.CSSProperties = {
  minHeight: 40,
  borderRadius: 10,
  border: `1px solid`,
  background: "transparent",
  fontWeight: 700,
  fontSize: 13,
  fontFamily: FONT,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "0 14px",
  transition: "all .15s ease",
};

const resetButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "inherit",
  cursor: "pointer",
};

function Avatar({ member, size = 32 }: { member: { name?: string | null; avatarUrl?: string | null }; size?: number }) {
  return member.avatarUrl ? (
    <img src={member.avatarUrl} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: `1px solid ${DEFAULT_LINE}` }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#93c5fd,#fca5a5)", color: "#111", display: "grid", placeItems: "center", fontSize: Math.max(10, size * 0.32), fontWeight: 900 }}>
      {initials(member.name)}
    </div>
  );
}

function MetricGrid({ metrics }: { metrics: Array<{ label: string; value: React.ReactNode; icon: React.ReactNode; tone: string; sub: string }> }) {
  return (
    <div className="metric-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ ...labelStyle, marginBottom: 12 }}>{metric.label}</div>
              <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 900 }}>{metric.value}</div>
              <div style={{ marginTop: 8, fontSize: 11, color: metric.tone, fontWeight: 800 }}>{metric.sub}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${metric.tone}20`, color: metric.tone, display: "grid", placeItems: "center" }}>{metric.icon}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 15 }} className="toolbar-wrap">
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>{title}</h2>
        {subtitle && <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,.46)", fontSize: 12 }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, background: "rgba(255,255,255,.035)" }}>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            border: "none",
            background: value === id ? DEFAULT_PRIMARY : "transparent",
            color: value === id ? "#fff" : "rgba(255,255,255,.62)",
            borderRadius: 6,
            padding: "7px 10px",
            fontSize: 11,
            fontWeight: 900,
            cursor: "pointer",
            fontFamily: FONT,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ProjectsPanel({ projects, team, onOpenProjects }: { projects: Project[]; team: TeamMember[]; onOpenProjects: () => void }) {
  return (
    <Card>
      <SectionHeader title="Proyek Aktif" subtitle="Progress dan owner produksi.">
        <button type="button" onClick={onOpenProjects} style={linkButton}>
          Lihat semua <ChevronRight size={14} />
        </button>
      </SectionHeader>
      <div style={{ display: "grid", gap: 11 }}>
        {projects.map((project) => {
          const owner = team.find((member) => member.id === project.assignedMemberId);
          const phase = normalizeStatus(project.status || "active");
          return (
            <div key={project.id} className="project-row" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 170px", gap: 14, alignItems: "center", borderBottom: `1px solid ${DEFAULT_LINE}`, paddingBottom: 11 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.title}</div>
                <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, marginTop: 4 }}>
                  {project.client || "Internal"} - {owner?.name || "Unassigned"} - Deadline {formatDate(project.deadline)}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <Pill color={PHASE_COLORS[phase] || "#93c5fd"}>{(project.status || "Active").replace("_", " ")}</Pill>
                  <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,.7)" }}>{project.progress || 0}%</span>
                </div>
                <ProgressBar value={project.progress} color={PHASE_COLORS[phase] || DEFAULT_PRIMARY} />
              </div>
            </div>
          );
        })}
        {!projects.length && <EmptyState icon={<Film size={24} />} title="Belum ada project aktif" />}
      </div>
    </Card>
  );
}

function ProjectDetailRow({ project, team, tasks }: { project: Project; team: TeamMember[]; tasks: Task[] }) {
  const owner = team.find((member) => member.id === project.assignedMemberId);
  const phase = normalizeStatus(project.status || "active");
  const done = tasks.filter((task) => ["done", "completed"].includes(normalizeStatus(task.status))).length;
  return (
    <div style={{ border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, padding: 15, background: "rgba(255,255,255,.03)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 13 }} className="toolbar-wrap">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{project.title}</h3>
            <Pill color={PHASE_COLORS[phase] || DEFAULT_PRIMARY}>{(project.status || "Active").replace("_", " ")}</Pill>
          </div>
          <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,.46)", fontSize: 12 }}>{project.client || "Internal"} - {project.projectType || "Production"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {owner && <Avatar member={owner} size={28} />}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.45)" }}>PIC</div>
            <div style={{ fontSize: 12, fontWeight: 900 }}>{owner?.name || "Unassigned"}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center" }}>
        <ProgressBar value={project.progress} color={PHASE_COLORS[phase] || DEFAULT_PRIMARY} />
        <span style={{ fontSize: 13, fontWeight: 900 }}>{project.progress || 0}%</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <Pill color="#93c5fd">{tasks.length} task</Pill>
        <Pill color="#34d399">{done} selesai</Pill>
        <Pill color="#fb923c">Deadline {formatDate(project.deadline)}</Pill>
      </div>
      {project.description && <p style={{ margin: "12px 0 0", color: "rgba(255,255,255,.52)", fontSize: 12, lineHeight: 1.55 }}>{project.description}</p>}
    </div>
  );
}

function WorkloadPanel({ tasks, events }: { tasks: Task[]; events: CalendarEvent[] }) {
  const week = Array.from({ length: 6 }, (_, i) => addDays(startOfWeek(new Date()), i));
  return (
    <Card>
      <SectionHeader title="Workload Minggu Ini" subtitle="Shoot, editing, meeting." />
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${week.length},1fr)`, gap: 5, alignItems: "end", minHeight: 142 }}>
        {week.map((day) => {
          const countShoot = events.filter((event) => sameDay(new Date(event.startDate), day) && eventType(event) === "shoot").length;
          const countEdit = tasks.filter((task) => task.dueDate && sameDay(new Date(task.dueDate), day)).length;
          const countMeet = events.filter((event) => sameDay(new Date(event.startDate), day) && ["meeting", "review"].includes(eventType(event))).length;
          return (
            <div key={dateKey(day)} style={{ display: "grid", gap: 4, alignContent: "end" }}>
              <div style={{ height: Math.max(16, countMeet * 18 + 18), background: "#34d399", borderRadius: 3 }} />
              <div style={{ height: Math.max(18, countEdit * 18 + 20), background: "#60a5fa", borderRadius: 3 }} />
              <div style={{ height: Math.max(20, countShoot * 20 + 20), background: DEFAULT_PRIMARY, borderRadius: 3 }} />
              <div style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,.45)", fontWeight: 800 }}>{day.toLocaleDateString("id-ID", { weekday: "short" })}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <Legend color={DEFAULT_PRIMARY} label="Shooting" />
        <Legend color="#60a5fa" label="Editing/Task" />
        <Legend color="#34d399" label="Meeting" />
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 800 }}>
      <span style={{ width: 8, height: 8, background: color, borderRadius: 2 }} /> {label}
    </span>
  );
}

function TasksPanel({ tasks, onDone, onOpen, activeTimer, onToggleTimer, onSelect }: { tasks: Task[]; onDone: (task: Task, status: string) => void; onOpen: () => void; activeTimer?: any; onToggleTimer?: (task: Task) => void; onSelect?: (task: Task) => void }) {
  return (
    <Card>
      <SectionHeader title="Task Hari Ini" subtitle="Checklist cepat.">
        <button type="button" onClick={onOpen} style={linkButton}>
          Semua task <ChevronRight size={14} />
        </button>
      </SectionHeader>
      <div style={{ display: "grid", gap: 9 }}>
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onDone={onDone} compact activeTimer={activeTimer} onToggleTimer={onToggleTimer} onSelect={onSelect} />
        ))}
        {!tasks.length && <EmptyState icon={<CheckCircle2 size={24} />} title="Tidak ada task mendesak" />}
      </div>
    </Card>
  );
}

function TaskRow({ task, onDone, compact, activeTimer, onToggleTimer, onSelect }: { task: Task; onDone: (task: Task, status: string) => void; compact?: boolean; activeTimer?: any; onToggleTimer?: (task: Task) => void; onSelect?: (task: Task) => void }) {
  const status = normalizeStatus(task.status);
  const done = status === "done" || status === "completed";
  const badge = taskBadge(task);
  const isTimerRunning = activeTimer?.taskId === task.id;
  const isOverdue = !done && task.dueDate && new Date(task.dueDate) < new Date();

  // Live elapsed for this task's timer (re-renders every sec via parent timerTick)
  const liveElapsed = (() => {
    if (!isTimerRunning || !activeTimer?.startTime) return null;
    const diff = Math.floor((Date.now() - new Date(activeTimer.startTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  })();

  const priorityColor = (task.priority || '').toLowerCase() === 'high' ? '#ef4444' : (task.priority || '').toLowerCase() === 'medium' ? '#f59e0b' : '#3b82f6';

  const handleSelect = (e?: React.MouseEvent) => {
    if (onSelect) onSelect(task);
  };

  return (
    <div 
      onClick={handleSelect}
      style={{ 
        border: `1px solid ${isTimerRunning ? DEFAULT_PRIMARY : (isOverdue ? '#ef4444' : DEFAULT_LINE)}`, 
        borderRadius: 10, 
        padding: compact ? 10 : 14, 
        background: isTimerRunning ? "rgba(255,106,32,.06)" : (isOverdue ? "rgba(239,68,68,.04)" : "rgba(255,255,255,.025)"), 
        display: "flex", 
        gap: 12, 
        alignItems: "flex-start", 
        transition: "all .2s",
        cursor: onSelect ? "pointer" : "default",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Priority accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 5, background: isTimerRunning ? DEFAULT_PRIMARY : priorityColor, borderTopLeftRadius: 10, borderBottomLeftRadius: 10 }} />

      {/* Checkbox / Checklist */}
      <button 
        type="button" 
        onClick={(e) => { e.stopPropagation(); onDone(task, done ? "todo" : "done"); }} 
        title={done ? "Reopen task" : "Selesaikan task"} 
        style={{ ...resetButton, width: 26, height: 26, borderRadius: 7, border: `2px solid ${done ? "#34d399" : (isOverdue ? "#ef4444" : DEFAULT_LINE)}`, background: done ? "rgba(52,211,153,.15)" : "rgba(255,255,255,.03)", display: "grid", placeItems: "center", color: done ? "#34d399" : "rgba(255,255,255,.35)", flexShrink: 0, marginTop: 2 }}
      >
        {done ? <Check size={15} /> : <Circle size={14} />}
      </button>

      <div style={{ minWidth: 0, flex: 1, paddingLeft: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div 
              style={{ 
                fontSize: compact ? 13 : 14.5, 
                fontWeight: 800, 
                textDecoration: done ? "line-through" : "none", 
                color: done ? "rgba(255,255,255,.4)" : (isTimerRunning ? DEFAULT_PRIMARY : "#fff"),
                lineHeight: 1.25
              }}
            >
              {task.title}
            </div>
            <div style={{ marginTop: 5, color: "rgba(255,255,255,.5)", fontSize: 11, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                {task.projectTitle || task.roleLabel || "General"}
              </span>
              {task.dueDate && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: isOverdue ? "#ef4444" : undefined, fontWeight: isOverdue ? 700 : 400 }}>
                  <Clock size={12} /> Due {formatDate(task.dueDate)}
                  {isOverdue && " (overdue)"}
                </span>
              )}
              {task.timeSpent != null && task.timeSpent > 0 && (
                <span style={{ color: DEFAULT_PRIMARY, fontWeight: 700 }}>• {Math.floor(task.timeSpent / 60)}h {task.timeSpent % 60}m logged</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            {/* Live timer badge when this task is running */}
            {isTimerRunning && liveElapsed && (
              <div style={{ 
                display: "flex", alignItems: "center", gap: 5, 
                background: `${DEFAULT_PRIMARY}22`, border: `1px solid ${DEFAULT_PRIMARY}55`, 
                padding: "2px 9px", borderRadius: 999, fontSize: 12, fontWeight: 800, color: DEFAULT_PRIMARY,
                animation: "pulse 1.5s infinite"
              }}>
                <Clock size={12} />
                {liveElapsed}
              </div>
            )}

            {!done && onToggleTimer && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleTimer(task); }}
                title={isTimerRunning ? "Stop Timer" : "Start Timer & mark in progress"}
                style={{ ...resetButton, display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: isTimerRunning ? DEFAULT_PRIMARY : "rgba(255,255,255,.1)", color: isTimerRunning ? "#fff" : "rgba(255,255,255,.75)", border: isTimerRunning ? "none" : `1px solid ${DEFAULT_LINE}` }}
              >
                {isTimerRunning ? <StopCircle size={13} /> : <PlayCircle size={13} />}
                {isTimerRunning ? "Stop" : "Mulai"}
              </button>
            )}

            <Pill color={badge.color}>{badge.label}</Pill>
          </div>
        </div>

        {!compact && task.description && (
          <p style={{ margin: "7px 0 0", color: "rgba(255,255,255,.48)", fontSize: 12, lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {task.description}
          </p>
        )}

        {/* Click hint for detail */}
        {onSelect && !compact && (
          <div style={{ marginTop: 6, fontSize: 10, color: "rgba(255,255,255,.25)", fontWeight: 600, letterSpacing: "0.5px" }}>
            Klik untuk detail &amp; update
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityPanel({ messages, events }: { messages: ChatMsg[]; events: CalendarEvent[] }) {
  return (
    <Card>
      <SectionHeader title="Aktivitas Terbaru" subtitle="Chat dan event terbaru." />
      <div style={{ display: "grid", gap: 10 }}>
        {events.map((event) => (
          <ActivityItem key={event.id} icon={<CalendarDays size={15} />} color={eventColor(event)} title={event.title} sub={`${formatTime(event.startDate)} - ${eventType(event)}`} />
        ))}
        {messages.map((message) => (
          <ActivityItem key={message.id} icon={<MessageSquare size={15} />} color="#93c5fd" title={`${message.senderName}: ${message.content}`} sub={formatTime(message.createdAt)} />
        ))}
        {!events.length && !messages.length && <EmptyState icon={<Activity size={24} />} title="Belum ada aktivitas" />}
      </div>
    </Card>
  );
}

function ActivityItem({ icon, color, title, sub }: { icon: React.ReactNode; color: string; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", borderBottom: `1px solid ${DEFAULT_LINE}`, paddingBottom: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, lineHeight: 1.35 }}>{title}</div>
        <div style={{ color: "rgba(255,255,255,.42)", fontSize: 11, marginTop: 3 }}>{sub}</div>
      </div>
    </div>
  );
}

function BriefPanel({ projects, tasks, events, onOpen }: { projects: Project[]; tasks: Task[]; events: CalendarEvent[]; onOpen: () => void }) {
  return (
    <Card style={{ marginTop: 14 }}>
      <SectionHeader title="Brief and Job Order Aktif" subtitle="Akses cepat sebelum mulai produksi.">
        <button type="button" onClick={onOpen} style={linkButton}>
          Buka brief <ChevronRight size={14} />
        </button>
      </SectionHeader>
      <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
        {projects.map((project) => (
          <div key={project.id} style={{ border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, padding: 13, background: "rgba(255,255,255,.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 900, lineHeight: 1.25 }}>{project.title}</h3>
              <Pill color={PHASE_COLORS[normalizeStatus(project.status)] || DEFAULT_PRIMARY}>{project.projectType || "Job"}</Pill>
            </div>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: 12, lineHeight: 1.5, margin: "10px 0 0" }}>{project.description || project.notes || project.client || "Brief belum diisi."}</p>
            <div style={{ marginTop: 12, display: "flex", gap: 7, flexWrap: "wrap" }}>
              <Pill color="#93c5fd">{project.client || "Client"}</Pill>
              <Pill color="#fb923c">{formatDate(project.deadline)}</Pill>
            </div>
          </div>
        ))}
        {!projects.length && <EmptyState icon={<ClipboardList size={24} />} title="Belum ada job order" />}
      </div>
      {(tasks.length > 0 || events.length > 0) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {events.map((event) => <Pill key={event.id} color={eventColor(event)}>{event.title}</Pill>)}
          {tasks.map((task) => <Pill key={task.id} color={taskBadge(task).color}>{task.title}</Pill>)}
        </div>
      )}
    </Card>
  );
}

function BriefPage({ projects, tasks, events, user }: { projects: Project[]; tasks: Task[]; events: CalendarEvent[]; user: CrewUser }) {
  return (
    <Card>
      <SectionHeader title="Daily Brief" subtitle={`Ringkasan kerja cepat untuk ${user.role || "crew"}.`} />
      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <h3 style={miniTitle}>Acara Hari Ini</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {events.map((event) => <EventRow key={event.id} event={event} />)}
            {!events.length && <EmptyState icon={<CalendarDays size={24} />} title="Tidak ada event hari ini" />}
          </div>
        </div>
        <div>
          <h3 style={miniTitle}>Deadline and Review</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {tasks.map((task) => <TaskRow key={task.id} task={task} onDone={() => undefined} compact activeTimer={undefined} onSelect={undefined} />)}
            {!tasks.length && <EmptyState icon={<CheckCircle2 size={24} />} title="Tidak ada deadline mendesak" />}
          </div>
        </div>
      </div>
      <h3 style={{ ...miniTitle, marginTop: 18 }}>Job Order Aktif</h3>
      <div style={{ display: "grid", gap: 10 }}>
        {projects.slice(0, 6).map((project) => (
          <ProjectDetailRow key={project.id} project={project} team={[]} tasks={[]} />
        ))}
      </div>
    </Card>
  );
}

const miniTitle: React.CSSProperties = {
  margin: "0 0 10px",
  color: "rgba(255,255,255,.85)",
  fontSize: 13,
  fontWeight: 900,
};

function CalendarPanel({
  view,
  setView,
  cursorDate,
  setCursorDate,
  events,
  setTab,
}: {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  cursorDate: Date;
  setCursorDate: (date: Date) => void;
  events: CalendarEvent[];
  setTab: (tab: Tab) => void;
}) {
  const weekStart = startOfWeek(cursorDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
  const monthGridStart = startOfWeek(monthStart);
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthGridStart, i));
  const days = view === "month" ? monthDays : weekDays;
  const title = view === "month"
    ? cursorDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
    : `${formatDate(weekDays[0], { day: "numeric", month: "short" })} - ${formatDate(weekDays[6], { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <Card>
      <SectionHeader title="Production Calendar" subtitle={title}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Segmented value={view} onChange={(value) => setView(value as CalendarView)} options={[["week", "Minggu"], ["month", "Bulan"], ["agenda", "Agenda"]]} />
          <IconButton title="Previous" onClick={() => setCursorDate(addDays(cursorDate, view === "month" ? -30 : -7))}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton title="Next" onClick={() => setCursorDate(addDays(cursorDate, view === "month" ? 30 : 7))}>
            <ChevronRight size={16} />
          </IconButton>
        </div>
      </SectionHeader>

      {view === "agenda" ? (
        <div style={{ display: "grid", gap: 9 }}>
          {events.slice(0, 40).map((event) => <EventRow key={event.id} event={event} onClick={() => setTab("brief")} />)}
          {!events.length && <EmptyState icon={<CalendarDays size={24} />} title="Belum ada event" />}
        </div>
      ) : (
        <>
          <div className="calendar-day-head" style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
            {weekDays.map((day) => (
              <div key={day.toISOString()} style={{ textAlign: "center", color: "rgba(255,255,255,.42)", fontSize: 11, fontWeight: 900 }}>{day.toLocaleDateString("id-ID", { weekday: "short" })}</div>
            ))}
          </div>
          <div className="calendar-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6 }}>
            {days.map((day) => {
              const dayEvents = events.filter((event) => sameDay(new Date(event.startDate), day)).slice(0, view === "month" ? 3 : 6);
              const muted = view === "month" && day.getMonth() !== cursorDate.getMonth();
              return (
                <div key={day.toISOString()} className="cal-cell" style={{ minHeight: view === "month" ? 112 : 220, border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, padding: 8, background: sameDay(day, new Date()) ? "rgba(255,106,32,.08)" : "rgba(255,255,255,.025)", opacity: muted ? 0.45 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 900 }}>{day.getDate()}</span>
                    {sameDay(day, new Date()) && <span style={{ width: 6, height: 6, borderRadius: "50%", background: DEFAULT_PRIMARY }} />}
                  </div>
                  <div style={{ display: "grid", gap: 5 }}>
                    {dayEvents.map((event) => (
                      <div key={event.id} title={event.title} style={{ borderLeft: `3px solid ${eventColor(event)}`, background: `${eventColor(event)}18`, borderRadius: 5, padding: "5px 6px", minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.title}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,.5)", marginTop: 2 }}>{formatTime(event.startDate)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

function SidebarToday({
  events,
  team,
  availability,
  projects,
}: {
  events: CalendarEvent[];
  team: TeamMember[];
  availability: (member: TeamMember) => { label: string; color: string };
  projects: Project[];
}) {
  return (
    <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
      <Card>
        <SectionHeader title="Acara Hari Ini" subtitle="Jam, lokasi, dan tag." />
        <div style={{ display: "grid", gap: 8 }}>
          {events.map((event) => <EventRow key={event.id} event={event} />)}
          {!events.length && <EmptyState icon={<CalendarDays size={24} />} title="Tidak ada event hari ini" />}
        </div>
      </Card>
      <Card>
        <SectionHeader title="Status Tim" subtitle="Availability produksi." />
        <div style={{ display: "grid", gap: 9 }}>
          {team.slice(0, 8).map((member) => {
            const av = availability(member);
            return (
              <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Avatar member={member} size={30} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 900 }}>{member.name}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.42)" }}>{member.role}</div>
                </div>
                <Pill color={av.color}>{av.label}</Pill>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionHeader title="Proyek Aktif" subtitle="Progress ringkas." />
        <div style={{ display: "grid", gap: 11 }}>
          {projects.map((project) => (
            <div key={project.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{project.title}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: "rgba(255,255,255,.65)" }}>{project.progress || 0}%</span>
              </div>
              <ProgressBar value={project.progress} color={PHASE_COLORS[normalizeStatus(project.status)] || DEFAULT_PRIMARY} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function EventRow({ event, onClick }: { event: CalendarEvent; onClick?: () => void }) {
  const color = eventColor(event);
  return (
    <button type="button" onClick={onClick} style={{ border: `1px solid ${DEFAULT_LINE}`, background: "rgba(255,255,255,.03)", borderRadius: 8, padding: 11, display: "flex", gap: 10, textAlign: "left", cursor: onClick ? "pointer" : "default", color: "#fff", fontFamily: FONT }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}20`, color, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <CalendarDays size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 900 }}>{event.title}</span>
          <Pill color={color}>{eventType(event)}</Pill>
        </div>
        <div style={{ color: "rgba(255,255,255,.48)", fontSize: 11, marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span><Clock size={11} style={{ verticalAlign: -2 }} /> {formatTime(event.startDate)}</span>
          {event.location && <span><MapPin size={11} style={{ verticalAlign: -2 }} /> {event.location}</span>}
          {event.description && <span>{event.description}</span>}
        </div>
      </div>
    </button>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  const category = (asset.category || "asset").toLowerCase();
  const color = category.includes("raw") ? "#60a5fa" : category.includes("edit") ? "#34d399" : category.includes("review") || category.includes("final") ? "#facc15" : DEFAULT_PRIMARY;
  const icon = category.includes("raw") ? <FileArchive size={16} /> : category.includes("edit") ? <FileCheck2 size={16} /> : <Files size={16} />;
  return (
    <a href={asset.fileUrl || "#"} target={asset.fileUrl ? "_blank" : undefined} rel="noreferrer" style={{ textDecoration: "none", color: "#fff", border: `1px solid ${DEFAULT_LINE}`, borderRadius: 8, padding: 12, background: "rgba(255,255,255,.03)", display: "flex", gap: 11, alignItems: "flex-start" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${color}20`, color, display: "grid", placeItems: "center" }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asset.title}</div>
          <Pill color={color}>{asset.category || "asset"}</Pill>
        </div>
        <div style={{ color: "rgba(255,255,255,.45)", fontSize: 11, marginTop: 5 }}>{asset.description || `Updated ${formatDate(asset.updatedAt || asset.createdAt)}`}</div>
      </div>
    </a>
  );
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ border: `1px dashed ${DEFAULT_LINE}`, borderRadius: 8, minHeight: 86, display: "grid", placeItems: "center", textAlign: "center", color: "rgba(255,255,255,.38)", gap: 6, padding: 16 }}>
      {icon}
      <div style={{ fontSize: 12, fontWeight: 800 }}>{title}</div>
    </div>
  );
}

const linkButton: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,.66)",
  fontFamily: FONT,
  fontSize: 12,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  cursor: "pointer",
};

function cryptoRandom() {
  if ("crypto" in window && window.crypto?.randomUUID) return window.crypto.randomUUID();
  return String(Date.now());
}

export default function CrewDashboardPage() {
  const [token, setToken] = useState(getCrewToken());
  const [user, setUser] = useState<CrewUser | null>(getCrewUser());

  function handleLogin(nextToken: string, nextUser: CrewUser) {
    setToken(nextToken);
    setUser(nextUser);
  }

  function handleLogout() {
    localStorage.removeItem("crew_token");
    localStorage.removeItem("crew_user");
    setToken(null);
    setUser(null);
  }

  if (!token || !user) return <CrewLogin onLogin={handleLogin} />;
  return <CrewDashboard user={user} onLogout={handleLogout} />;
}

// --- Logo + CMS fetching (used by both login and dashboard) ---
async function fetchCrewBranding() {
  try {
    const [cmsRes, logosRes] = await Promise.all([
      fetch("/api/cms").then(r => r.json()).catch(() => ({})),
      fetch("/api/site-logos").then(r => r.json()).catch(() => []),
    ]);

    const cms = cmsRes || {};
    const logos: any[] = Array.isArray(logosRes) ? logosRes : [];

    // Priority: explicit crew logo in cms > first active site logo > branding.logoUrl > fallback
    let logoUrl = cms.crew?.logoUrl || cms.branding?.logoUrl || "";

    if (!logoUrl) {
      const active = logos.find((l: any) => l.isActive) || logos[0];
      logoUrl = active?.imageUrl || "";
    }

    const theme = cms.theme || {};

    return {
      logoUrl,
      companyName: cms.branding?.companyName || cms.hero?.headline1 || "Frameless Creative",
      welcomeMessage: cms.crew?.welcomeMessage || "",
      logoSize: cms.branding?.logoSize ? Number(cms.branding.logoSize) : 30,
      meshColors: [
        theme.meshColor1 || "#FF6A20",
        theme.meshColor2 || "#7c3aed",
        theme.meshColor3 || "#2563eb",
      ] as [string, string, string],
      allowCrewPhotoUpload: cms.crew?.allowCrewPhotoUpload !== false, // default allow
      showProfileInfo: cms.crew?.showProfileInfo !== false,
    };
  } catch {
    return { 
      logoUrl: "", 
      companyName: "Frameless Creative", 
      welcomeMessage: "", 
      logoSize: 30,
      meshColors: ["#FF6A20", "#7c3aed", "#2563eb"] as [string, string, string],
      allowCrewPhotoUpload: true,
      showProfileInfo: true,
    };
  }
}

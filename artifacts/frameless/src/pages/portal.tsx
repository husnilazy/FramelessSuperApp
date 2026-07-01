// artifacts/frameless/src/pages/portal.tsx
// COMPREHENSIVE member portal dengan course viewer, progress tracking, settings

import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LogOut, Settings, ChevronLeft, ChevronRight, Clock,
  CheckCircle2, Circle, MessageSquare, Edit2, Eye, EyeOff,
  Download, Mail, Phone, Key, Home, BookOpen, Lock, AlertCircle,
  Zap, Play, Check, Share2, ChevronDown, Menu, X, Moon, Sun,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────────
// TYPES & CONSTANTS
// ──────────────────────────────────────────────────────────────────────────────

const ORANGE       = "hsl(20,100%,58%)";
const ORANGE_DIM   = "rgba(240,56,32,0.12)";
const BORDER       = "rgba(255,255,255,0.08)";
const TEXT_DIM     = "rgba(255,255,255,0.45)";
const TEXT_FAINT   = "rgba(255,255,255,0.28)";
const BG_DARK      = "#0a0a0c";
const BG_LIGHT     = "#ffffff";
const TEXT_DARK    = "#ffffff";
const TEXT_LIGHT   = "#0a0a0c";
const BORDER_LIGHT = "rgba(0,0,0,0.08)";

type Theme = "dark" | "light";
type Tab = "course" | "settings" | "upgrade" | "help";

interface Enrollment {
  id: string;
  courseId: string;
  packageId: string;
  name: string;
  email: string;
  phone?: string;
  status: string;
  paymentStatus: string;
  memberCode: string;
  invoiceNumber?: string;
  paidAt?: string;
  createdAt: string;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  instructor?: string;
  highlightVideoUrl?: string;
}

interface Material {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  url: string;
  type: string;
  durationMinutes?: number;
  orderIndex: number;
  isActive: boolean;
}

interface PortalData {
  enrollment: Enrollment;
  course: Course;
  materials: Material[];
  accessibleMaterialIds?: string[];
  progress?: {
    completedCount: number;
    totalCount: number;
    percentage: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const { id: enrollmentId } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [theme, setTheme] = useState<Theme>("dark");
  const [activeTab, setActiveTab] = useState<Tab>("course");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showPaymentStatus, setShowPaymentStatus] = useState(true);

  // Fetch portal data
  const { data: portal, isLoading, error } = useQuery<PortalData>({
    queryKey: [`/api/portal/${enrollmentId}`],
    queryFn: () => fetch(`/api/portal/${enrollmentId}`).then(r => {
      if (!r.ok) throw new Error("Gagal memuat portal");
      return r.json();
    }),
    retry: 2,
    staleTime: 30_000,
  });

  useEffect(() => {
    // Load theme from localStorage
    const saved = localStorage.getItem("frameless_portal_theme");
    if (saved) setTheme(saved as Theme);
  }, []);

  useEffect(() => {
    localStorage.setItem("frameless_portal_theme", theme);
  }, [theme]);

  if (!enrollmentId) return <ErrorPage msg="Invalid enrollment ID" />;

  if (error) {
    return <ErrorPage msg={`Gagal memuat portal: ${(error as Error).message}`} />;
  }

  if (isLoading) {
    return <LoadingPage theme={theme} />;
  }

  if (!portal) {
    return <ErrorPage msg="Portal tidak ditemukan" />;
  }

  const isDark = theme === "dark";
  const bgColor = isDark ? BG_DARK : BG_LIGHT;
  const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;
  const borderColor = isDark ? BORDER : BORDER_LIGHT;

  return (
    <div style={{
      minHeight: "100vh",
      background: bgColor,
      color: textColor,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      flexDirection: "column",
      transition: "background .3s, color .3s",
    }}>
      {/* Header */}
      <Header
        portal={portal}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === "dark" ? "light" : "dark")}
        onLogout={() => navigate("/academy/login")}
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen(s => !s)}
        isDark={isDark}
      />

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Sidebar */}
        {sidebarOpen && (
          <Sidebar
            portal={portal}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            selectedMaterial={selectedMaterial}
            onMaterialSelect={setSelectedMaterial}
            isDark={isDark}
            borderColor={borderColor}
          />
        )}

        {/* Main panel */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Payment status banner */}
          {showPaymentStatus && portal.enrollment.paymentStatus !== "paid" && (
            <PaymentStatusBanner
              enrollment={portal.enrollment}
              isDark={isDark}
              onClose={() => setShowPaymentStatus(false)}
            />
          )}

          {/* Content */}
          <div style={{ flex: 1, padding: "32px 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
            {activeTab === "course" && (
              <CourseView
                portal={portal}
                selectedMaterial={selectedMaterial}
                onMaterialSelect={setSelectedMaterial}
                isDark={isDark}
              />
            )}
            {activeTab === "settings" && (
              <SettingsView
                enrollment={portal.enrollment}
                isDark={isDark}
              />
            )}
            {activeTab === "upgrade" && (
              <UpgradeView
                course={portal.course}
                enrollment={portal.enrollment}
                isDark={isDark}
              />
            )}
            {activeTab === "help" && (
              <HelpView isDark={isDark} waNumber={portal.enrollment.phone} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HEADER COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

function Header({
  portal,
  theme,
  onThemeToggle,
  onLogout,
  sidebarOpen,
  onSidebarToggle,
  isDark,
}: {
  portal: PortalData;
  theme: Theme;
  onThemeToggle: () => void;
  onLogout: () => void;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
  isDark: boolean;
}) {
  const bgColor = isDark ? "rgba(10,10,12,0.8)" : "rgba(255,255,255,0.95)";
  const borderColor = isDark ? BORDER : "rgba(0,0,0,0.08)";

  return (
    <div style={{
      background: bgColor,
      borderBottom: `1px solid ${borderColor}`,
      padding: "16px 24px",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      transition: "background .3s",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onSidebarToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isDark ? TEXT_DIM : TEXT_LIGHT,
            padding: 8,
          }}
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: ORANGE_DIM,
            border: `1.5px solid ${ORANGE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <BookOpen size={20} color={ORANGE} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {portal.course.title}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: TEXT_DIM }}>
              {portal.enrollment.name}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onThemeToggle}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isDark ? TEXT_DIM : TEXT_LIGHT,
            padding: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "color .2s",
          }}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <button
          onClick={onLogout}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: isDark ? TEXT_DIM : TEXT_LIGHT,
            padding: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            transition: "color .2s",
          }}
          title="Logout"
        >
          <LogOut size={16} /> Logout
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SIDEBAR COMPONENT
// ──────────────────────────────────────────────────────────────────────────────

function Sidebar({
  portal,
  activeTab,
  onTabChange,
  selectedMaterial,
  onMaterialSelect,
  isDark,
  borderColor,
}: {
  portal: PortalData;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedMaterial: Material | null;
  onMaterialSelect: (mat: Material | null) => void;
  isDark: boolean;
  borderColor: string;
}) {
  const bgColor = isDark ? "rgba(17,19,21,0.5)" : "rgba(245,245,247,0.5)";
  const textColor = isDark ? TEXT_DIM : TEXT_LIGHT;

  const progress = portal.progress || { completedCount: 0, totalCount: portal.materials.length, percentage: 0 };

  return (
    <div style={{
      width: 300,
      borderRight: `1px solid ${borderColor}`,
      overflowY: "auto",
      padding: "20px",
      background: bgColor,
      display: "flex",
      flexDirection: "column",
      gap: 20,
    }}>
      {/* Progress overview */}
      <div>
        <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: TEXT_FAINT }}>
          Progress
        </h3>
        <div style={{
          padding: 12,
          borderRadius: 12,
          background: ORANGE_DIM,
          border: `1px solid ${BORDER}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Zap size={14} color={ORANGE} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{progress.percentage}%</span>
          </div>
          <div style={{
            width: "100%",
            height: 6,
            borderRadius: 3,
            background: "rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${progress.percentage}%`,
              height: "100%",
              background: ORANGE,
              transition: "width .3s ease-out",
            }} />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: TEXT_DIM }}>
            {progress.completedCount} dari {progress.totalCount} materi selesai
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { id: "course" as Tab, label: "Materi Kelas", icon: BookOpen },
          { id: "settings" as Tab, label: "Pengaturan", icon: Settings },
          { id: "upgrade" as Tab, label: "Upgrade Paket", icon: Zap },
          { id: "help" as Tab, label: "Bantuan", icon: MessageSquare },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "none",
                background: activeTab === tab.id ? ORANGE_DIM : "transparent",
                borderLeft: activeTab === tab.id ? `3px solid ${ORANGE}` : "3px solid transparent",
                color: activeTab === tab.id ? ORANGE : textColor,
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "all .2s",
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Materials list (only show when on course tab) */}
      {activeTab === "course" && (
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: TEXT_FAINT }}>
            Daftar Materi
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "calc(100vh - 400px)", overflowY: "auto" }}>
            {portal.materials.map((mat, idx) => {
              const isAccessible = !portal.accessibleMaterialIds || portal.accessibleMaterialIds.includes(mat.id);
              const isSelected = selectedMaterial?.id === mat.id;
              return (
                <button
                  key={mat.id}
                  onClick={() => isAccessible && onMaterialSelect(mat)}
                  disabled={!isAccessible}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: isSelected ? `1px solid ${ORANGE}` : `1px solid ${BORDER}`,
                    background: isSelected ? ORANGE_DIM : "transparent",
                    color: isAccessible ? textColor : TEXT_FAINT,
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 600,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                    cursor: isAccessible ? "pointer" : "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    opacity: isAccessible ? 1 : 0.5,
                    transition: "all .2s",
                  }}
                >
                  {isAccessible ? (
                    <CheckCircle2 size={14} color={ORANGE} />
                  ) : (
                    <Lock size={14} />
                  )}
                  <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {idx + 1}. {mat.title}
                  </span>
                  {mat.durationMinutes && (
                    <span style={{ fontSize: 10, opacity: 0.6 }}>{mat.durationMinutes}m</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// COURSE VIEW (Main content)
// ──────────────────────────────────────────────────────────────────────────────

function CourseView({
  portal,
  selectedMaterial,
  onMaterialSelect,
  isDark,
}: {
  portal: PortalData;
  selectedMaterial: Material | null;
  onMaterialSelect: (mat: Material) => void;
  isDark: boolean;
}) {
  const material = selectedMaterial || portal.materials[0];
  if (!material) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <AlertCircle size={48} color={TEXT_DIM} style={{ opacity: 0.5, margin: "0 auto 16px" }} />
        <p>Tidak ada materi yang tersedia.</p>
      </div>
    );
  }

  // Detect video type from URL
  const isYouTube = material.url.includes("youtube.com") || material.url.includes("youtu.be");
  const videoId = isYouTube ? extractYouTubeId(material.url) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Video player */}
      <div>
        <div style={{
          borderRadius: 16,
          border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
          overflow: "hidden",
          background: isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {videoId ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 0 }}
            />
          ) : (
            <video
              src={material.url}
              controls
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          )}
        </div>
      </div>

      {/* Material info */}
      <div>
        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{material.title}</h2>
        <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
          {material.durationMinutes && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: TEXT_DIM, fontSize: 13 }}>
              <Clock size={14} />
              {material.durationMinutes} menit
            </div>
          )}
          <button
            style={{
              background: ORANGE,
              color: "#fff",
              border: "none",
              padding: "8px 16px",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckCircle2 size={14} />
            Tandai Selesai
          </button>
        </div>
        {material.description && (
          <p style={{ marginTop: 16, lineHeight: 1.6, color: TEXT_DIM }}>
            {material.description}
          </p>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        display: "flex",
        gap: 12,
        marginTop: 16,
      }}>
        {portal.materials.map((mat, idx) => (
          <button
            key={mat.id}
            onClick={() => onMaterialSelect(mat)}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: material.id === mat.id
                ? `2px solid ${ORANGE}`
                : `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
              background: material.id === mat.id ? ORANGE_DIM : "transparent",
              color: material.id === mat.id ? ORANGE : TEXT_DIM,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              transition: "all .2s",
            }}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW
// ──────────────────────────────────────────────────────────────────────────────

function SettingsView({ enrollment, isDark }: { enrollment: Enrollment; isDark: boolean }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(enrollment.name);
  const [email, setEmail] = useState(enrollment.email);
  const [phone, setPhone] = useState(enrollment.phone || "");

  const inputStyle: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
    background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    color: isDark ? TEXT_DARK : TEXT_LIGHT,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    fontSize: 13,
    outline: "none",
    transition: "border-color .2s",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800 }}>Pengaturan Profil</h2>

      <div style={{
        borderRadius: 16,
        border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
        padding: 24,
        background: isDark ? "rgba(17,19,21,0.5)" : "rgba(245,245,247,0.5)",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Member info card */}
          <div>
            <h3 style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: TEXT_FAINT }}>
              Informasi Member
            </h3>
            <div style={{
              padding: 16,
              borderRadius: 12,
              background: ORANGE_DIM,
              border: `1px solid ${BORDER}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".1em" }}>Kode Member</p>
                <p style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 800, fontFamily: "monospace", letterSpacing: ".1em" }}>
                  {enrollment.memberCode}
                </p>
              </div>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: ORANGE,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Salin
              </button>
            </div>
          </div>

          {/* Profile fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: TEXT_FAINT }}>
                Nama
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={!editing}
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: TEXT_FAINT }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={!editing}
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 700, color: TEXT_FAINT }}>
                WhatsApp
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                disabled={!editing}
                style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
              />
            </div>
          </div>

          {/* Action buttons */}
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: "12px 18px",
                borderRadius: 10,
                border: "none",
                background: ORANGE,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Edit2 size={14} />
              Edit Profil
            </button>
          ) : (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setEditing(false)}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
                  background: "transparent",
                  color: TEXT_DIM,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Batal
              </button>
              <button
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: ORANGE,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Simpan
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800, color: "#f87171" }}>
          Lupa Kode?
        </h3>
        <div style={{
          padding: 20,
          borderRadius: 12,
          border: "1px solid rgba(239,68,68,0.25)",
          background: "rgba(239,68,68,0.08)",
        }}>
          <p style={{ margin: 0, fontSize: 13, color: "#fca5a5", lineHeight: 1.6 }}>
            Jika lupa kode member, silakan hubungi admin melalui WhatsApp untuk direset.
          </p>
          <button
            style={{
              marginTop: 12,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#f87171",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MessageSquare size={12} />
            Hubungi Admin
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HELP VIEW
// ──────────────────────────────────────────────────────────────────────────────


// ─── UPGRADE VIEW ────────────────────────────────────────────────────────────

function UpgradeView({ course, enrollment, isDark }: {
  course: { id: string; slug: string; title: string };
  enrollment: { id: string; email: string; phone?: string; [k: string]: any };
  isDark: boolean;
}) {
  const ORANGE      = "hsl(20,100%,58%)";
  const ORANGE_DIM  = "rgba(240,56,32,0.12)";
  const ORANGE_BRD  = "rgba(240,56,32,0.28)";
  const TEXT_DIM    = isDark ? "rgba(255,255,255,.45)" : "rgba(0,0,0,.45)";
  const TEXT_FAINT  = isDark ? "rgba(255,255,255,.28)" : "rgba(0,0,0,.28)";
  const BORDER      = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.08)";
  const SURFACE     = isDark ? "rgba(17,19,21,.5)"     : "rgba(245,245,247,.5)";
  const courseUrl   = `/course/${course.slug}`;

  const benefits = [
    "Akses semua video materi tanpa batas",
    "Progress tracking & sertifikat completion",
    "Update materi seumur hidup (lifetime access)",
    "Support langsung dari instruktur via WhatsApp",
    "Download resource & template eksklusif",
  ];

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 800 }}>Upgrade Paket</h2>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: TEXT_DIM }}>
        Akses lebih banyak materi dan fitur dengan upgrade ke paket penuh.
      </p>

      {/* Current package badge */}
      <div style={{
        padding: 18, borderRadius: 14,
        border: "1px solid rgba(250,204,21,.25)",
        background: "rgba(250,204,21,.06)",
        marginBottom: 20,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(250,204,21,.6)" }}>
          Paket Saat Ini
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color="#fbbf24" />
          <span style={{ fontWeight: 800, fontSize: 14, color: "#fbbf24" }}>Trial Gratis</span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "rgba(250,204,21,.5)" }}>
          Akses terbatas — beberapa materi mungkin belum tersedia.
        </p>
      </div>

      {/* Upgrade CTA */}
      <div style={{
        padding: 24, borderRadius: 16,
        border: `1.5px solid ${ORANGE_BRD}`,
        background: ORANGE_DIM,
        marginBottom: 20,
      }}>
        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(240,56,32,.6)" }}>
          Unlock Akses Penuh
        </p>
        <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900 }}>
          🚀 Akses Semua Materi {course.title}
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: 13, color: TEXT_DIM, lineHeight: 1.6 }}>
          Dengan upgrade, kamu bisa akses seluruh video materi, progress tracking lengkap,
          dan support dari instruktur.
        </p>
        <a
          href={`${courseUrl}#packages`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "13px 22px", borderRadius: 100,
            background: ORANGE, color: "#fff",
            textDecoration: "none", fontWeight: 800, fontSize: 14,
            fontFamily: "'Plus Jakarta Sans',sans-serif",
            boxShadow: "0 8px 24px rgba(240,56,32,.35)",
          }}
        >
          <Zap size={15} /> Lihat Paket & Harga
        </a>
      </div>

      {/* Benefits */}
      <div style={{
        padding: 20, borderRadius: 14,
        border: `1px solid ${BORDER}`,
        background: SURFACE,
      }}>
        <p style={{ margin: "0 0 14px", fontSize: 12, fontWeight: 800, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".1em" }}>
          Yang kamu dapatkan dengan upgrade
        </p>
        {benefits.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < benefits.length - 1 ? 10 : 0 }}>
            <CheckCircle2 size={14} color={ORANGE} style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: TEXT_DIM, lineHeight: 1.5 }}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HelpView({ isDark, waNumber }: { isDark: boolean; waNumber?: string }) {
  return (
    <div style={{ maxWidth: 600 }}>
      <h2 style={{ margin: "0 0 24px", fontSize: 24, fontWeight: 800 }}>Bantuan & Dukungan</h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Contact admin */}
        <div style={{
          padding: 24,
          borderRadius: 16,
          border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
          background: isDark ? "rgba(17,19,21,0.5)" : "rgba(245,245,247,0.5)",
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Hubungi Admin</h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: TEXT_DIM }}>
            Ada pertanyaan atau masalah teknis? Hubungi tim admin kami melalui WhatsApp.
          </p>
          <a
            href={`https://wa.me/${waNumber || "6281234567890"}?text=Halo, saya butuh bantuan dengan akses kelas saya.`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              borderRadius: 10,
              background: "#25D366",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              cursor: "pointer",
            }}
          >
            <MessageSquare size={14} />
            Buka WhatsApp
          </a>
        </div>

        {/* FAQ */}
        <div style={{
          padding: 24,
          borderRadius: 16,
          border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
          background: isDark ? "rgba(17,19,21,0.5)" : "rgba(245,245,247,0.5)",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 800 }}>FAQ</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                q: "Bagaimana cara download video materi?",
                a: "Sayangnya video tidak bisa didownload, tapi bisa di-stream kapan saja. Pastikan koneksi internet stabil saat menontonnya.",
              },
              {
                q: "Berapa lama akses kelas saya berlaku?",
                a: "Akses berlaku seumur hidup untuk paket yang Anda beli, kecuali ada syarat khusus di paket trial.",
              },
              {
                q: "Bisakah saya transfer akses ke orang lain?",
                a: "Tidak, akses bersifat personal dan tidak bisa ditransfer. Setiap orang harus mendaftar sendiri.",
              },
            ].map((faq, idx) => (
              <details
                key={idx}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: `1px solid ${isDark ? BORDER : "rgba(0,0,0,0.08)"}`,
                  cursor: "pointer",
                }}
              >
                <summary style={{
                  fontWeight: 700,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <ChevronRight size={14} />
                  {faq.q}
                </summary>
                <p style={{ margin: "8px 0 0 24px", fontSize: 12, color: TEXT_DIM }}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// PAYMENT STATUS BANNER
// ──────────────────────────────────────────────────────────────────────────────

function PaymentStatusBanner({
  enrollment,
  isDark,
  onClose,
}: {
  enrollment: Enrollment;
  isDark: boolean;
  onClose: () => void;
}) {
  if (enrollment.paymentStatus === "paid") return null;

  const isProcessing = enrollment.paymentStatus === "unpaid" && enrollment.status === "pending";

  return (
    <div style={{
      padding: "16px 24px",
      background: isProcessing
        ? "rgba(59,130,246,0.1)"
        : "rgba(239,68,68,0.1)",
      borderBottom: `1px solid ${isProcessing ? "rgba(59,130,246,0.25)" : "rgba(239,68,68,0.25)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <AlertCircle size={16} color={isProcessing ? "#3b82f6" : "#ef4444"} />
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: isProcessing ? "#93c5fd" : "#fca5a5",
        }}>
          {isProcessing
            ? "Pembayaran sedang diproses..."
            : "Pembayaran belum berhasil. Cek email Anda atau hubungi admin."}
        </span>
      </div>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: TEXT_DIM,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// ERROR & LOADING PAGES
// ──────────────────────────────────────────────────────────────────────────────

function ErrorPage({ msg }: { msg: string }) {
  return (
    <div style={{
      minHeight: "100vh",
      background: BG_DARK,
      color: TEXT_DARK,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <AlertCircle size={48} color={TEXT_DIM} style={{ margin: "0 auto 16px", opacity: 0.5 }} />
        <h1 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 800 }}>Error</h1>
        <p style={{ margin: 0, fontSize: 14, color: TEXT_DIM }}>{msg}</p>
        <a
          href="/academy/login"
          style={{
            display: "inline-block",
            marginTop: 20,
            padding: "12px 24px",
            borderRadius: 10,
            background: ORANGE,
            color: "#fff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          Kembali ke Login
        </a>
      </div>
    </div>
  );
}

function LoadingPage({ theme }: { theme: Theme }) {
  const isDark = theme === "dark";
  const bgColor = isDark ? BG_DARK : BG_LIGHT;
  const textColor = isDark ? TEXT_DARK : TEXT_LIGHT;

  return (
    <div style={{
      minHeight: "100vh",
      background: bgColor,
      color: textColor,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `3px solid ${isDark ? BORDER : BORDER_LIGHT}`,
          borderTopColor: ORANGE,
          animation: "spin .8s linear infinite",
          margin: "0 auto 16px",
        }} />
        <p style={{ fontSize: 14, color: TEXT_DIM }}>Memuat portal...</p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────────────────────

function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}
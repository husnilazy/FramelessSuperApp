import React, { useEffect, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Film,
  Globe,
  Image,
  Lock,
  MapPin,
  MessageCircle,
  Play,
  Shield,
  Smartphone,
  Star,
  Users,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Package {
  id: string;
  name: string;
  price: string;
  isTrial: boolean;
  originalPrice?: string;   // Harga asli sebelum diskon
  discountLabel?: string;   // Label promo e.g. "Early Bird"
  discountEndDate?: string; // ISO date string kapan diskon berakhir
  durationDays?: number;
  features?: string;
  description?: string;
  isActive?: boolean;
}

interface Material {
  id: string;
  title: string;
  type: string;
  description?: string;
  orderIndex?: number;
}

interface Workshop {
  id: string;
  title: string;
  description?: string;
  date: string;
  endDate?: string;
  location: string;
  locationUrl?: string;
  price: string;
  quota: number;
  registeredCount?: number;
  isActive?: boolean;
  registrationUrl?: string;
  posterUrl?: string;
  videoUrl?: string;
  highlights?: string;
}

interface GalleryPhoto {
  id: string;
  url: string;
  caption?: string;
  orderIndex?: number;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  thumbnail?: string;
  highlightVideoUrl?: string;
  instructor?: string;
  level?: string;
  category?: string;
  curriculumPdfUrl?: string;
  packages: Package[];
  materials: Material[];
  workshops?: Workshop[];
  gallery?: GalleryPhoto[];
}

declare global {
  interface Window { snap: any; }
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const ORANGE = "hsl(20,100%,58%)";
const ORANGE_DIM = "rgba(240,56,32,0.12)";
const ORANGE_BORDER = "rgba(240,56,32,0.25)";
const BG = "#0a0a0c";
const SURFACE = "rgba(255,255,255,0.035)";
const SURFACE_HVR = "rgba(255,255,255,0.055)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_DIM = "rgba(255,255,255,0.45)";
const TEXT_FAINT = "rgba(255,255,255,0.28)";
const font = "'Plus Jakarta Sans', sans-serif";

// ─── Utilities ────────────────────────────────────────────────────────────────
function ytId(url?: string) {
  if (!url) return null;
  return (
    url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    )?.[1] ?? null
  );
}

function watchUrl(url: string) {
  const id = ytId(url);
  if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return url;
}

function getThumb(url?: string, custom?: string) {
  if (custom) return custom;
  const id = ytId(url);
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "";
}

function isDirectVideo(url?: string) {
  return !!url && /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i.test(url);
}

function parseFeatures(features?: string): string[] {
  if (!features) return [];
  try {
    const parsed = JSON.parse(features);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return features.split("\n").map((s) => s.trim()).filter(Boolean);
  }
}

function loadSnapScript(isProduction: boolean, clientKey?: string): Promise<void> {
  return new Promise((resolve) => {
    if (window.snap) { resolve(); return; }
    const existing = document.getElementById("midtrans-snap");
    if (existing) {
      if (clientKey) existing.setAttribute("data-client-key", clientKey);
      (existing as any).onload = () => resolve();
      if ((existing as any).readyState === "complete") resolve();
      return;
    }
    const script = document.createElement("script");
    script.id  = "midtrans-snap";
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    if (clientKey) script.setAttribute("data-client-key", clientKey);
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 210,
        background: "rgba(0,0,0,0.93)", backdropFilter: "blur(18px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: "absolute", top: 18, right: 18,
          width: 44, height: 44, borderRadius: "50%",
          border: `1px solid ${BORDER}`, background: "rgba(255,255,255,0.08)",
          color: "#fff", cursor: "pointer", fontSize: 20, lineHeight: 1,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        ×
      </button>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(94vw,1120px)", aspectRatio: "16 / 9" }}>
        {isDirectVideo(url) ? (
          <video
            src={url} controls autoPlay playsInline
            style={{ width: "100%", height: "100%", borderRadius: 20, background: "#000" }}
          />
        ) : (
          <iframe
            src={watchUrl(url)}
            style={{ width: "100%", height: "100%", borderRadius: 20, border: "none" }}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}

// Enroll modal
interface EnrollModalProps {
  selectedPkg: Package;
  allPkgs: Package[];
  courseName: string;
  courseId: string;
  waNumber: string;
  onClose: () => void;
  onSuccess: (enrollmentId: string) => void;
  onChangePkg: (pkg: Package) => void;
}

function EnrollModal({ selectedPkg, allPkgs, courseName, courseId, waNumber, onClose, onSuccess, onChangePkg }: EnrollModalProps) {
  const { toast } = useToast();
  // Trial: langsung ke form (skip review), berbayar: mulai dari review
  const isTrial = selectedPkg.isTrial || Number(selectedPkg.price) === 0;
  const [step, setStep]   = useState<"review" | "form" | "paying" | "pending" | "success" | "manual">(isTrial ? "form" : "review");
  const [form, setForm]   = useState({ name: "", email: "", phone: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [enrollId, setEnrollId] = useState<string>("");
  const [paymentNote, setPaymentNote] = useState("");
  const [waOverride, setWaOverride] = useState<string>("");  // from API noGateway response

  const effectiveWa = waOverride || waNumber;

  const price = Number(selectedPkg.price);
  const paidPkgs = allPkgs.filter(p => !p.isTrial);
  const trialPkg = allPkgs.find(p => p.isTrial);

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim())  e.name  = "Nama wajib diisi";
    if (!form.email.trim()) e.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Format email tidak valid";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleEnroll() {
    if (!validate()) return;
    setStep("paying");
    try {
      const res = await fetch("/api/payments/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          packageId: selectedPkg.id,
          name:  form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Server error"); }
      const data = await res.json();

      // Trial / gratis — langsung aktif, redirect ke portal
      if (data.free || price === 0 || isTrial) {
        setEnrollId(data.enrollmentId);
        setStep("success");
        setTimeout(() => onSuccess(data.enrollmentId), 1500);
        return;
      }
      if (data.noGateway) {
        // Use WA number from API response if provided, else use prop
        if (data.waNumber) setWaOverride(data.waNumber);
        setStep("manual");
        return;
      }
      if (data.snapToken) {
        await loadSnapScript(data.isProduction, data.clientKey);
        // Set clientKey on the script element if provided
        if (data.clientKey) {
          const snapEl = document.getElementById("midtrans-snap");
          if (snapEl) snapEl.setAttribute("data-client-key", data.clientKey);
        }
        window.snap.pay(data.snapToken, {
          onSuccess: (result: any) => {
            void finalizePayment(data.enrollmentId, result);
          },
          onPending: (result: any) => {
            toast({ title: "Pembayaran sedang diproses — cek email untuk konfirmasi." });
            setEnrollId(data.enrollmentId);
            setPaymentNote("Pembayaran sudah dibuat dan sedang menunggu konfirmasi dari payment channel.");
            setStep("pending");
            void finalizePayment(data.enrollmentId, result, false);
          },
          onError: () => {
            toast({ variant: "destructive", title: "Pembayaran gagal. Silakan coba lagi." });
            setStep("form");
          },
          onClose: () => setStep("form"),
        });
        return;
      }
      throw new Error("Respons pembayaran tidak dikenali");
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Terjadi kesalahan." });
      setStep("form");
    }
  }

  async function finalizePayment(enrollmentId: string, _snapResult?: unknown, redirectWhenPaid = true, attempt = 0) {
    setEnrollId(enrollmentId);
    if (attempt === 0) {
      setStep("paying");
      setPaymentNote("Memverifikasi pembayaran ke Midtrans...");
    }
    try {
      const res = await fetch(`/api/payments/enrollment/${enrollmentId}/check-status`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengecek pembayaran");

      if (data.status === "paid") {
        setPaymentNote("Pembayaran berhasil! Invoice dan kode member dikirim ke email kamu.");
        setStep("success");
        if (redirectWhenPaid) setTimeout(() => onSuccess(enrollmentId), 1500);
        return;
      }

      if (data.status === "failed") {
        toast({ variant: "destructive", title: "Pembayaran gagal atau kedaluwarsa." });
        setPaymentNote("Transaksi gagal. Silakan buat transaksi baru.");
        setStep("form");
        return;
      }

      // Masih pending — retry dengan backoff (max 8x, ~30 detik total)
      if (attempt < 8) {
        const delay = attempt < 3 ? 2000 : attempt < 6 ? 4000 : 6000;
        setPaymentNote(`Menunggu konfirmasi pembayaran... (${attempt + 1}/8)`);
        setStep("pending");
        setTimeout(() => void finalizePayment(enrollmentId, undefined, redirectWhenPaid, attempt + 1), delay);
      } else {
        setPaymentNote("Pembayaran belum terkonfirmasi otomatis. Klik Cek Status untuk coba lagi, atau cek email kamu.");
        setStep("pending");
      }
    } catch (err: any) {
      if (attempt < 3) {
        setTimeout(() => void finalizePayment(enrollmentId, undefined, redirectWhenPaid, attempt + 1), 3000);
      } else {
        setPaymentNote("Koneksi bermasalah. Klik Cek Status untuk coba lagi.");
        setStep("pending");
      }
    }
  }

  // Step indicators
  const steps = ["Pilih Paket", "Data Diri", "Pembayaran"];
  const stepIdx = step === "review" ? 0 : step === "form" ? 1 : 2;

  const iStyle: React.CSSProperties = {
    width: "100%", padding: "11px 14px", borderRadius: 12,
    border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.04)",
    color: "#fff", fontSize: 14, fontFamily: font, outline: "none", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && step !== "paying") onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 220,
        background: "rgba(0,0,0,.88)", backdropFilter: "blur(18px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, borderRadius: 28,
          border: `1px solid ${BORDER}`, background: "#111315",
          overflow: "hidden", position: "relative",
          animation: "scaleIn .25s ease",
        }}
      >
        {/* ── Top bar ── */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>
              {courseName}
            </p>
            <h3 style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 900, letterSpacing: "-0.03em" }}>
              {step === "review" ? "Pilih Paket" : step === "form" ? "Data Pendaftaran" : step === "paying" ? "Memproses..." : step === "pending" ? "Menunggu Pembayaran" : step === "success" ? "Akses Kelas Aktif!" : "Konfirmasi Manual"}
            </h3>
          </div>
          {step !== "paying" && step !== "success" && (
            <button
              onClick={onClose}
              style={{
                width: 36, height: 36, borderRadius: "50%", border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.6)",
                cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          )}
        </div>

        {/* ── Progress stepper ── */}
        {(step === "review" || step === "form" || step === "paying") && (
          <div style={{ padding: "14px 24px 0", display: "flex", gap: 8, alignItems: "center" }}>
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800,
                    background: i < stepIdx ? ORANGE : i === stepIdx ? ORANGE : "rgba(255,255,255,.08)",
                    border: `2px solid ${i <= stepIdx ? ORANGE : BORDER}`,
                    color: i <= stepIdx ? "#fff" : TEXT_FAINT,
                    transition: "all .3s",
                  }}>
                    {i < stepIdx ? <Check size={11} strokeWidth={3} /> : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: i === stepIdx ? "#fff" : TEXT_FAINT, whiteSpace: "nowrap" }}>
                    {s}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, borderRadius: 1, background: i < stepIdx ? ORANGE : BORDER, transition: "background .3s" }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ padding: "20px 24px 28px" }}>

          {/* ════ STEP 1: Package selection ════ */}
          {step === "review" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* All packages */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allPkgs.map((pkg) => {
                  const isActive  = pkg.id === selectedPkg.id;
                  const pkgPrice     = Number(pkg.price);
                const pkgOrigPrice = pkg.originalPrice ? Number(pkg.originalPrice) : null;
                const pkgDiscExpired = pkg.discountEndDate ? new Date(pkg.discountEndDate).getTime() < Date.now() : false;
                const pkgHasDisc   = pkgOrigPrice && pkgOrigPrice > pkgPrice && !pkgDiscExpired;
                  const pkgFeatures = parseFeatures(pkg.features);
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => onChangePkg(pkg)}
                      style={{
                        width: "100%", textAlign: "left", cursor: "pointer",
                        padding: "16px 18px", borderRadius: 18,
                        border: `2px solid ${isActive ? ORANGE : BORDER}`,
                        background: isActive ? ORANGE_DIM : "rgba(255,255,255,.025)",
                        fontFamily: font, color: "#fff",
                        transition: "all .2s",
                        position: "relative",
                      }}
                    >
                      {/* Radio dot */}
                      <div style={{
                        position: "absolute", top: 18, right: 18,
                        width: 20, height: 20, borderRadius: "50%",
                        border: `2px solid ${isActive ? ORANGE : BORDER}`,
                        background: isActive ? ORANGE : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all .2s",
                      }}>
                        {isActive && <Check size={11} color="#fff" strokeWidth={3} />}
                      </div>

                      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, paddingRight: 32 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 13, flexShrink: 0,
                          background: pkg.isTrial ? "rgba(250,204,21,.12)" : ORANGE_DIM,
                          border: `1px solid ${pkg.isTrial ? "rgba(250,204,21,.3)" : ORANGE_BORDER}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {pkg.isTrial ? <Zap size={18} color="#fbbf24" /> : <BookOpen size={18} color={ORANGE} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 15, fontWeight: 800 }}>{pkg.name}</span>
                            {pkg.isTrial && (
                              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 100, background: "rgba(250,204,21,.15)", border: "1px solid rgba(250,204,21,.3)", color: "#fbbf24", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>
                                Trial
                              </span>
                            )}
                          </div>
                          {pkg.description && (
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: TEXT_DIM, lineHeight: 1.5 }}>{pkg.description}</p>
                          )}
                          {/* Features mini */}
                          {pkgFeatures.slice(0, 3).map((f, fi) => (
                            <div key={fi} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 2 }}>
                              <Check size={9} color={pkg.isTrial ? "#fbbf24" : ORANGE} strokeWidth={3} /> {f}
                            </div>
                          ))}
                          {pkgFeatures.length > 3 && (
                            <p style={{ margin: "4px 0 0", fontSize: 11, color: TEXT_FAINT }}>+{pkgFeatures.length - 3} lainnya</p>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: pkg.isTrial ? "#fbbf24" : ORANGE, letterSpacing: "-0.03em" }}>
                            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              {pkgHasDisc && (
                                <span style={{ fontSize: 10, textDecoration: "line-through", color: "rgba(255,255,255,.3)", fontWeight: 600 }}>
                                  {formatCurrency(pkgOrigPrice!)}
                                </span>
                              )}
                              <span>
                                {pkgPrice === 0 ? "GRATIS" : formatCurrency(pkgPrice)}
                              </span>
                              {pkgHasDisc && (
                                <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 100, background: "rgba(239,68,68,.2)", color: "#f87171", fontWeight: 900 }}>
                                  -{Math.round((1 - pkgPrice/pkgOrigPrice!)*100)}%
                                </span>
                              )}
                            </span>
                          </p>
                          {pkg.durationDays && (
                            <p style={{ margin: "3px 0 0", fontSize: 10, color: TEXT_FAINT }}>{pkg.durationDays}h akses</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setStep("form")}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 100,
                  border: "none", background: ORANGE, color: "#fff",
                  fontSize: 15, fontWeight: 800, fontFamily: font, cursor: "pointer",
                  transition: "opacity .18s",
                  boxShadow: `0 8px 28px ${ORANGE}44`,
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = ".9")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
              >
                Lanjut dengan {selectedPkg.name} →
              </button>
            </div>
          )}

          {/* ════ STEP 2: Form data diri ════ */}
          {step === "form" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Selected pkg recap */}
              <div style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                borderRadius: 16, border: `1px solid ${ORANGE_BORDER}`, background: ORANGE_DIM,
              }}>
                <BookOpen size={16} color={ORANGE} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedPkg.name}</span>
                  <span style={{ fontSize: 12, color: TEXT_DIM, marginLeft: 8 }}>
                    {price === 0 ? "Gratis" : formatCurrency(price)}
                  </span>
                </div>
                <button
                  onClick={() => setStep("review")}
                  style={{ background: "none", border: "none", color: ORANGE, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: font }}
                >
                  Ganti
                </button>
              </div>

              {/* Fields */}
              {[
                { key: "name",  label: "Nama Lengkap *",          type: "text",  placeholder: "Nama lengkap kamu" },
                { key: "email", label: "Email *",                  type: "email", placeholder: "email@kamu.com" },
                { key: "phone", label: "No. WhatsApp (opsional)",  type: "tel",   placeholder: "+62 8xx xxxx xxxx" },
              ].map((field) => (
                <div key={field.key}>
                  <label style={{
                    display: "block", marginBottom: 7,
                    fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                    color: errors[field.key] ? "#f87171" : TEXT_FAINT,
                  }}>
                    {errors[field.key] || field.label}
                  </label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={(e) => { setForm(p => ({ ...p, [field.key]: e.target.value })); setErrors(p => ({ ...p, [field.key]: "" })); }}
                    placeholder={field.placeholder}
                    style={{ ...iStyle, borderColor: errors[field.key] ? "#f87171" : BORDER }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = errors[field.key] ? "#f87171" : BORDER)}
                  />
                </div>
              ))}

              {/* Order summary */}
              <div style={{
                borderRadius: 16, border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,.03)", overflow: "hidden",
              }}>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}` }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".1em" }}>
                    Ringkasan Order
                  </p>
                </div>
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: TEXT_DIM }}>
                    <span>{selectedPkg.name}</span>
                    <span>{price === 0 ? "Gratis" : formatCurrency(price)}</span>
                  </div>
                  {selectedPkg.durationDays && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TEXT_FAINT }}>
                      <span>Durasi akses</span>
                      <span>{selectedPkg.durationDays} hari</span>
                    </div>
                  )}
                  <div style={{ height: 1, background: BORDER, margin: "4px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 900 }}>
                    <span>Total</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {selectedPkg.originalPrice && Number(selectedPkg.originalPrice) > price && (
                        (() => {
                          const expired = selectedPkg.discountEndDate ? new Date(selectedPkg.discountEndDate).getTime() < Date.now() : false;
                          return !expired ? (
                            <span style={{ fontSize: "0.8em", textDecoration: "line-through", color: "rgba(255,255,255,.35)", fontWeight: 600 }}>
                              {formatCurrency(Number(selectedPkg.originalPrice))}
                            </span>
                          ) : null;
                        })()
                      )}
                      <span style={{ color: ORANGE }}>{price === 0 ? "Gratis" : formatCurrency(price)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setStep("review")}
                  style={{
                    flex: 1, padding: "13px 0", borderRadius: 100,
                    border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.04)",
                    color: TEXT_DIM, fontSize: 14, fontWeight: 700, fontFamily: font, cursor: "pointer",
                  }}
                >
                  ← Kembali
                </button>
                <button
                  onClick={handleEnroll}
                  style={{
                    flex: 2, padding: "13px 0", borderRadius: 100,
                    border: "none", background: ORANGE, color: "#fff",
                    fontSize: 15, fontWeight: 800, fontFamily: font, cursor: "pointer",
                    boxShadow: `0 8px 24px ${ORANGE}44`,
                    transition: "opacity .18s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = ".9")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.opacity = "1")}
                >
                  {isTrial || price === 0 ? "✓ Mulai Trial Gratis — Langsung Akses" : "Lanjut ke Pembayaran →"}
                </button>
              </div>

              <p style={{ textAlign: "center", margin: 0, fontSize: 11, color: TEXT_FAINT, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Shield size={10} /> Pembayaran aman & terenkripsi via Midtrans
              </p>
            </div>
          )}

          {/* ════ STEP: Paying ════ */}
          {step === "paying" && (
            <div style={{ textAlign: "center", padding: "20px 0 8px" }}>
              <div style={{ position: "relative", width: 72, height: 72, margin: "0 auto 22px" }}>
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `3px solid ${ORANGE}20`, position: "absolute",
                }} />
                <div style={{
                  width: 72, height: 72, borderRadius: "50%",
                  border: `3px solid ${ORANGE}`, borderTopColor: "transparent",
                  animation: "spin .8s linear infinite", position: "absolute",
                }} />
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Shield size={24} color={ORANGE} />
                </div>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Memproses Pembayaran</p>
              <p style={{ fontSize: 13, color: TEXT_DIM, margin: 0, lineHeight: 1.7 }}>
                Menghubungkan ke payment gateway.<br />Jangan tutup halaman ini.
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* ════ STEP: Success ════ */}
          {step === "success" && (
            <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(34,197,94,.12)", border: "2px solid rgba(34,197,94,.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
                animation: "scaleIn .4s ease",
              }}>
                <Check size={32} color="#22c55e" strokeWidth={2.5} />
              </div>
              <h3 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900, letterSpacing: "-0.04em", color: "#fff" }}>
                Pendaftaran Berhasil!
              </h3>
              <p style={{ fontSize: 14, color: TEXT_DIM, margin: "0 0 20px", lineHeight: 1.7 }}>
                Kamu sudah terdaftar di paket <strong style={{ color: "#fff" }}>{selectedPkg.name}</strong>.<br />
                Cek email untuk detail akses. Mengalihkan ke portal...
              </p>
              <div style={{
                display: "flex", gap: 8, justifyContent: "center",
                padding: "12px 20px", borderRadius: 16,
                background: "rgba(34,197,94,.06)", border: "1px solid rgba(34,197,94,.2)",
              }}>
                <Globe size={14} color="#4ade80" />
                <span style={{ fontSize: 12, color: "#4ade80", fontWeight: 700 }}>
                  Akses langsung tersedia di portal belajar kamu
                </span>
              </div>
            </div>
          )}

          {/* ════ STEP: Pending — menunggu konfirmasi ════ */}
          {step === "pending" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0" }}>
              {/* Icon animasi */}
              <div style={{ textAlign: "center" }}>
                <div style={{
                  position: "relative", width: 72, height: 72, margin: "0 auto 20px",
                }}>
                  <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid rgba(250,204,21,.15)", position: "absolute" }} />
                  <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid #fbbf24", borderTopColor: "transparent", animation: "spin .8s linear infinite", position: "absolute" }} />
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={26} color="#fbbf24" />
                  </div>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em" }}>
                  Menunggu Konfirmasi
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_DIM, lineHeight: 1.7, maxWidth: 340, marginLeft: "auto", marginRight: "auto" }}>
                  {paymentNote || "Pembayaran sedang diproses. Mohon tunggu konfirmasi dari payment gateway."}
                </p>
              </div>

              {/* Info box */}
              <div style={{
                padding: "14px 18px", borderRadius: 16,
                border: "1px solid rgba(250,204,21,.2)", background: "rgba(250,204,21,.06)",
              }}>
                <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>
                  ⏳ Apa yang terjadi sekarang?
                </p>
                <p style={{ margin: 0, fontSize: 12, color: TEXT_DIM, lineHeight: 1.6 }}>
                  Sistem sedang mengecek status pembayaran kamu ke Midtrans secara otomatis setiap beberapa detik.
                  Setelah terkonfirmasi, akses kelas langsung aktif dan kode member akan dikirim ke email kamu.
                </p>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => void finalizePayment(enrollId, undefined, true, 0)}
                  style={{
                    width: "100%", padding: "13px 0", borderRadius: 100,
                    border: "none", background: ORANGE, color: "#fff",
                    fontSize: 14, fontWeight: 800, fontFamily: font, cursor: "pointer",
                    boxShadow: `0 8px 24px ${ORANGE}44`,
                  }}
                >
                  🔄 Cek Status Pembayaran
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: "100%", padding: "11px 0", borderRadius: 100,
                    border: `1px solid ${BORDER}`, background: "transparent", color: TEXT_DIM,
                    fontSize: 13, fontWeight: 700, fontFamily: font, cursor: "pointer",
                  }}
                >
                  Tutup — Cek Email untuk Akses
                </button>
              </div>

              {/* Note */}
              <p style={{ margin: 0, textAlign: "center", fontSize: 11, color: TEXT_FAINT }}>
                Sudah bayar tapi belum dapat akses? Email kami atau hubungi admin via WhatsApp.
              </p>
            </div>
          )}

          {/* ════ STEP: Manual (no gateway) ════ */}
          {step === "manual" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: ORANGE_DIM, border: `2px solid ${ORANGE_BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <MessageCircle size={26} color={ORANGE} />
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em" }}>
                  Konfirmasi via WhatsApp
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: TEXT_DIM, lineHeight: 1.7 }}>
                  Payment gateway belum aktif. Hubungi kami untuk konfirmasi pendaftaran manual.
                </p>
              </div>

              {/* Order recap */}
              <div style={{ padding: "14px 18px", borderRadius: 16, border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: TEXT_DIM }}>Nama</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{form.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: TEXT_DIM }}>Paket</span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{selectedPkg.name}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: TEXT_DIM }}>Total</span>
                  <span style={{ color: ORANGE, fontWeight: 800 }}>{price === 0 ? "Gratis" : formatCurrency(price)}</span>
                </div>
              </div>

              <a
                href={`https://wa.me/${effectiveWa}?text=${encodeURIComponent(`Halo Frameless Academy 👋\n\nSaya ingin mendaftar:\n• Kelas: *${courseName}*\n• Paket: *${selectedPkg.name}*\n• Harga: *${price === 0 ? "Gratis" : formatCurrency(price)}*\n• Nama: *${form.name}*\n• Email: *${form.email}*\n\nMohon konfirmasinya, terima kasih!`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "14px 0", borderRadius: 100,
                  background: "#25d366", color: "#fff",
                  fontSize: 15, fontWeight: 800, textDecoration: "none", fontFamily: font,
                  boxShadow: "0 8px 24px rgba(37,211,102,.3)",
                }}
              >
                <MessageCircle size={17} /> Konfirmasi via WhatsApp
              </a>
              <button
                onClick={onClose}
                style={{ background: "none", border: "none", color: TEXT_FAINT, fontSize: 13, cursor: "pointer", fontFamily: font }}
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderRadius: 18, border: `1px solid ${open ? ORANGE_BORDER : BORDER}`,
        background: open ? ORANGE_DIM : SURFACE,
        transition: "all .22s",
      }}
    >
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "18px 22px", background: "none", border: "none",
          color: "#fff", cursor: "pointer", fontFamily: font, textAlign: "left", gap: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{q}</span>
        {open ? <ChevronUp size={16} color={ORANGE} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color={TEXT_DIM} style={{ flexShrink: 0 }} />}
      </button>
      {open && (
        <div style={{ padding: "0 22px 20px", fontSize: 13, color: TEXT_DIM, lineHeight: 1.75 }}>
          {a}
        </div>
      )}
    </div>
  );
}

// ─── Testimonial Card ─────────────────────────────────────────────────────────
function TestiCard({ name, role, text, stars = 5 }: { name: string; role: string; text: string; stars?: number }) {
  return (
    <div
      style={{
        borderRadius: 22, border: `1px solid ${BORDER}`, background: SURFACE,
        padding: "24px 22px", display: "flex", flexDirection: "column", gap: 14,
      }}
    >
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: stars }).map((_, i) => (
          <Star key={i} size={13} fill={ORANGE} color={ORANGE} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.62)", lineHeight: 1.75, fontStyle: "italic" }}>
        "{text}"
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%",
            background: `linear-gradient(135deg, ${ORANGE}, #ff6d40)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0,
          }}
        >
          {name[0]}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 11, color: TEXT_FAINT, marginTop: 2 }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CoursePage() {
  const [, params] = useRoute("/course/:slug");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showEnroll, setShowEnroll] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [expandedMaterials, setExpandedMaterials] = useState(false);
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState("6281234567890"); // fallback, overridden by settings

  // Fetch WhatsApp / contact number from payment settings (public endpoint, no auth)
  useEffect(() => {
    fetch("/api/payment-settings/public")
      .then(r => r.ok ? r.json() : [])
      .then((data: Array<{ provider: string; config: string }>) => {
        const wa = data.find(d => d.provider === "whatsapp" || d.provider === "contact");
        if (wa) {
          try {
            const cfg = JSON.parse(wa.config);
            const num = (cfg.phoneNumber || cfg.whatsapp || "").replace(/\D/g, "");
            if (num) setWaNumber(num);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Sticky sidebar scroll tracking
  const sidebarRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [sidebarSticky, setSidebarSticky] = useState(false);

  useEffect(() => {
    const slug = params?.slug;
    if (!slug) { setError("Course tidak ditemukan."); setLoading(false); return; }
    fetch(`/api/courses/${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else {
          setCourse(data);
          // Pre-select paket populer atau yang pertama
          const pkgs = (data.packages ?? []).filter((p: Package) => p.isActive !== false);
          const popular = pkgs.find((_: Package, i: number) => pkgs.length > 1 && i === Math.floor(pkgs.length / 2));
          const trial   = pkgs.find((p: Package) => p.isTrial);
          setSelectedPkgId((popular || pkgs[0])?.id ?? null);
        }
      })
      .catch(() => setError("Gagal memuat course."))
      .finally(() => setLoading(false));
  }, [params?.slug]);

  useEffect(() => {
    if (!heroRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSidebarSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-80px 0px 0px 0px" }
    );
    observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [course]);

  // Jika trial: langsung minta nama+email lalu daftar tanpa payment
  // Jika berbayar: buka modal enrollment normal
  function openEnroll(pkg: Package) {
    setSelectedPkg(pkg);
    setShowEnroll(true);
  }

  // Direct trial enroll: skip payment, langsung aktivasi
  async function handleTrialDirect(pkg: Package, name: string, email: string, phone?: string) {
    try {
      const res = await fetch("/api/payments/midtrans/snap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course!.id,
          packageId: pkg.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || undefined,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Server error"); }
      const data = await res.json();
      // Backend sudah auto-aktivasi jika free/trial (price=0)
      if (data.free || data.status === "paid") {
        navigate(`/portal/${data.enrollmentId}`);
        return;
      }
      // Fallback jika trial tapi ada harga
      if (data.snapToken) {
        openEnroll(pkg);
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Gagal mendaftar trial." });
    }
  }

  if (loading) return (
    <div
      style={{
        minHeight: "100vh", background: BG,
        display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font,
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: "50%",
          border: `3px solid ${ORANGE}`, borderTopColor: "transparent",
          animation: "spin .8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !course) return (
    <div
      style={{
        minHeight: "100vh", background: BG, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", fontFamily: font, gap: 16, padding: 20,
      }}
    >
      <AlertCircle size={40} color={ORANGE} />
      <p style={{ color: "rgba(255,255,255,.55)", fontSize: 16, textAlign: "center" }}>
        {error || "Course tidak ditemukan."}
      </p>
      <button
        onClick={() => navigate("/courses")}
        style={{
          padding: "10px 22px", borderRadius: 100, border: `1px solid ${BORDER}`,
          background: SURFACE, color: "#fff", cursor: "pointer", fontSize: 14, fontFamily: font,
        }}
      >
        Kembali ke Daftar Kelas
      </button>
    </div>
  );

  // Derived data
  const activePkgs = course.packages.filter((p) => p.isActive !== false);
  const trialPkg = activePkgs.find((p) => p.isTrial);
  const paidPkgs = activePkgs.filter((p) => !p.isTrial);
  const minPrice = paidPkgs.length ? Math.min(...paidPkgs.map((p) => Number(p.price))) : 0;
  const featuredPkg = trialPkg || paidPkgs[0];
  const poster = getThumb(course.highlightVideoUrl, course.thumbnail);

  // Grouped materials for curriculum display
  const visibleMaterials = expandedMaterials
    ? course.materials
    : course.materials.slice(0, 6);

  const globalStyles = `
    body { background: ${BG}; margin: 0; }
    * { box-sizing: border-box; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes scaleIn { from { opacity:0; transform:scale(.96); } to { opacity:1; transform:scale(1); } }
    @keyframes ping { 0% { transform:scale(1); opacity:.8; } 100% { transform:scale(2.2); opacity:0; } }

    .cp-hero { display: grid; grid-template-columns: 1fr 380px; gap: 48px; max-width: 1240px; margin: 0 auto; padding: 52px 28px 40px; align-items: start; }
    .cp-sidebar { position: sticky; top: 24px; }
    .cp-shell { max-width: 1240px; margin: 0 auto; padding: 0 28px; }
    .cp-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .cp-pkg-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; }
    .cp-why-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .cp-testi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 18px; }
    .cp-badge { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: 100px; font-size: 10px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; }
    .cp-surface { border-radius: 22px; border: 1px solid ${BORDER}; background: ${SURFACE}; }
    .cp-btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 13px 24px; border-radius: 100px; background: ${ORANGE}; color: #fff; border: none; font-family: ${font}; font-size: 14px; font-weight: 800; cursor: pointer; transition: opacity .18s; white-space: nowrap; }
    .cp-btn-primary:hover { opacity: .88; }
    .cp-btn-ghost { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 100px; background: none; color: #fff; border: 1px solid ${BORDER}; font-family: ${font}; font-size: 14px; font-weight: 700; cursor: pointer; transition: background .18s; }
    .cp-btn-ghost:hover { background: rgba(255,255,255,.06); }
    .pkg-card { border-radius: 22px; border: 1px solid ${BORDER}; background: ${SURFACE}; padding: 28px 24px 24px; text-align: left; cursor: pointer; width: 100%; font-family: ${font}; color: #fff; transition: all .22s; }
    .pkg-card:hover { background: ${SURFACE_HVR}; transform: translateY(-4px); border-color: ${ORANGE_BORDER}; }
    .pkg-card.popular { border-color: rgba(240,56,32,0.45); background: rgba(240,56,32,0.06); }
    .material-row { display: flex; align-items: flex-start; gap: 14px; padding: 14px 16px; border-radius: 16px; border: 1px solid ${BORDER}; background: rgba(255,255,255,.025); transition: background .18s; }
    .material-row:hover { background: rgba(255,255,255,.04); }
    .pkg-compare { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap: 20px; align-items: start; }
    .pkg-card-v2 { border-radius: 28px; border: 1.5px solid ${BORDER}; background: rgba(255,255,255,.028); padding: 32px 26px 26px; cursor: pointer; font-family: ${font}; color: #fff; transition: all .28s cubic-bezier(.4,0,.2,1); position: relative; overflow: hidden; text-align: left; width: 100%; }
    .pkg-card-v2::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,.04) 0%, transparent 60%); pointer-events: none; }
    .pkg-card-v2:hover { border-color: ${ORANGE_BORDER}; transform: translateY(-6px); box-shadow: 0 28px 56px rgba(0,0,0,.5), 0 0 0 1px rgba(240,56,32,.15); }
    .pkg-card-v2.selected { border-color: ${ORANGE}; background: rgba(240,56,32,.09); box-shadow: 0 0 0 1px ${ORANGE}55, 0 28px 56px rgba(240,56,32,.2); transform: translateY(-8px); }
    .pkg-card-v2.selected::before { background: linear-gradient(135deg, rgba(240,56,32,.12) 0%, transparent 60%); }
    .pkg-card-v2.has-discount { border-color: rgba(239,68,68,.35); }
    .pkg-card-v2.has-discount.selected { border-color: #ef4444; box-shadow: 0 0 0 1px rgba(239,68,68,.5), 0 28px 56px rgba(239,68,68,.18); }
    .pkg-card-v2.trial { border-color: rgba(250,204,21,.3); background: rgba(250,204,21,.04); }
    .pkg-card-v2.trial.selected { border-color: rgba(250,204,21,.7); background: rgba(250,204,21,.08); box-shadow: 0 0 0 1px rgba(250,204,21,.4), 0 28px 56px rgba(250,204,21,.12); }
    .discount-ribbon { position: absolute; top: 0; right: 0; background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; font-size: 11px; font-weight: 900; padding: 6px 16px 6px 24px; border-radius: 0 28px 0 20px; letter-spacing: .04em; }
    .price-original { font-size: 15px; font-weight: 700; color: rgba(255,255,255,.32); text-decoration: line-through; line-height: 1; }
    .price-badge-pct { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 100px; background: rgba(239,68,68,.18); border: 1px solid rgba(239,68,68,.3); color: #f87171; font-size: 11px; font-weight: 900; letter-spacing: .04em; }
    .price-badge-label { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 100px; background: rgba(251,146,60,.12); border: 1px solid rgba(251,146,60,.25); color: #fb923c; font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .price-save { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 100px; background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.2); color: #4ade80; font-size: 11px; font-weight: 800; margin-top: 6px; }
    .countdown-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 11px; border-radius: 100px; background: rgba(251,146,60,.08); border: 1px solid rgba(251,146,60,.2); color: #fb923c; font-size: 10px; font-weight: 800; margin-bottom: 6px; }
    .sticky-cta { display: none; }
    @media (max-width: 640px) {
      .pkg-compare { grid-template-columns: 1fr; gap: 12px; }
      .sticky-cta { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 90; padding: 12px 16px 20px; background: linear-gradient(to top, rgba(10,10,12,1) 60%, transparent); gap: 10px; align-items: center; }
    }

    @media (max-width: 880px) {
      .cp-hero { grid-template-columns: 1fr; gap: 32px; padding: 32px 18px 28px; }
      .cp-sidebar { position: static; }
      .cp-grid2 { grid-template-columns: 1fr; }
      .cp-shell { padding: 0 18px; }
      .cp-pkg-grid { grid-template-columns: 1fr; }
      .ws-grid { grid-template-columns: 1fr !important; }
    }
    @media (max-width: 600px) {
      .cp-hero { padding: 24px 14px 20px; }
      .cp-shell { padding: 0 14px; }
      .cp-testi-grid { grid-template-columns: 1fr; }
    }
  `;

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#fff", fontFamily: font }}>
      <style>{globalStyles}</style>

      {/* ── Top navigation ── */}
      <div
        style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: "14px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "rgba(10,10,12,.88)", backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 100,
        }}
      >
        <a
          href="/courses"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            color: "rgba(255,255,255,.55)", textDecoration: "none", fontSize: 14, fontWeight: 600,
            transition: "color .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,.55)")}
        >
          <ArrowLeft size={16} /> Kembali
        </a>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {course.level && (
            <span className="cp-badge" style={{ background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`, color: ORANGE }}>
              {course.level}
            </span>
          )}
          {course.category && (
            <span className="cp-badge" style={{ background: "rgba(255,255,255,.06)", border: `1px solid ${BORDER}`, color: TEXT_DIM }}>
              {course.category}
            </span>
          )}
          {/* Member login link */}
          <a
            href="/academy/login"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 100,
              border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,.04)",
              color: TEXT_DIM, textDecoration: "none",
              fontSize: 12, fontWeight: 700,
              transition: "all .15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = ORANGE_BORDER; (e.currentTarget as HTMLAnchorElement).style.color = ORANGE; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = BORDER; (e.currentTarget as HTMLAnchorElement).style.color = TEXT_DIM; }}
          >
            <BookOpen size={12} /> Sudah daftar? Masuk
          </a>
        </div>
      </div>

      {/* ── Hero: two-column layout ── */}
      <div className="cp-hero" ref={heroRef}>
        {/* Left: course info */}
        <div style={{ animation: "fadeUp .5s ease both" }}>
          <p
            style={{
              margin: "0 0 14px", fontSize: 10, fontWeight: 700,
              letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE,
            }}
          >
            Frameless Academy
          </p>
          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "clamp(30px, 4.5vw, 52px)",
              fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.08,
            }}
          >
            {course.title}
          </h1>

          {course.subtitle && (
            <p
              style={{
                margin: "0 0 22px", fontSize: 16,
                color: "rgba(255,255,255,.48)", lineHeight: 1.7,
              }}
            >
              {course.subtitle}
            </p>
          )}

          {/* Stats strip */}
          <div
            style={{
              display: "flex", gap: 0, flexWrap: "wrap",
              border: `1px solid ${BORDER}`, borderRadius: 18, overflow: "hidden",
              marginBottom: 28, width: "fit-content",
            }}
          >
            {[
              { icon: <Star size={13} fill={ORANGE} color={ORANGE} />, val: "4.9/5", lbl: "Rating" },
              { icon: <Users size={13} color={ORANGE} />, val: "500+", lbl: "Alumni" },
              { icon: <BookOpen size={13} color={ORANGE} />, val: `${course.materials?.length || 0}`, lbl: "Materi" },
              { icon: <Award size={13} color={ORANGE} />, val: "Sertifikat", lbl: "Included" },
            ].map((s, i) => (
              <div
                key={s.lbl}
                style={{
                  padding: "14px 20px",
                  borderLeft: i > 0 ? `1px solid ${BORDER}` : "none",
                  display: "flex", flexDirection: "column", gap: 5,
                  background: i % 2 === 0 ? SURFACE : "rgba(255,255,255,.018)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {s.icon}
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{s.val}</span>
                </div>
                <span style={{ fontSize: 10, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".1em" }}>
                  {s.lbl}
                </span>
              </div>
            ))}
          </div>

          {/* Instructor card */}
          {course.instructor && (
            <div
              className="cp-surface"
              style={{ padding: "16px 20px", display: "inline-flex", alignItems: "center", gap: 14, marginBottom: 28 }}
            >
              <div
                style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${ORANGE}, #ff6d40)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, fontWeight: 800, flexShrink: 0,
                }}
              >
                {course.instructor[0]}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 10, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>
                  Instruktur
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 800 }}>{course.instructor}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: TEXT_DIM }}>
                  Sineas & Videografer Profesional · Frameless Creative
                </p>
              </div>
            </div>
          )}

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {featuredPkg && (
              <button className="cp-btn-primary" onClick={() => openEnroll(featuredPkg)}>
                {featuredPkg.isTrial ? "Mulai Trial Gratis" : "Daftar Sekarang"}
                <ChevronRight size={15} />
              </button>
            )}
            {course.highlightVideoUrl && (
              <button className="cp-btn-ghost" onClick={() => setPreviewUrl(course.highlightVideoUrl || null)}>
                <Play size={14} fill="#fff" /> Tonton Preview
              </button>
            )}
          </div>
        </div>

        {/* Right: sticky sidebar card */}
        <div className="cp-sidebar" ref={sidebarRef} style={{ animation: "scaleIn .5s ease both .1s" }}>
          <div className="cp-surface" style={{ overflow: "hidden" }}>
            {/* Video / thumbnail */}
            <div
              style={{
                aspectRatio: "16/9", position: "relative",
                background: poster
                  ? `url(${poster}) center/cover no-repeat`
                  : "linear-gradient(135deg,#1a0800,#3d1500)",
                overflow: "hidden",
              }}
            >
              {course.highlightVideoUrl && isDirectVideo(course.highlightVideoUrl) && (
                <video
                  src={course.highlightVideoUrl}
                  poster={poster || undefined}
                  autoPlay muted loop playsInline
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
              {!poster && !isDirectVideo(course.highlightVideoUrl) && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Film size={56} color="rgba(255,255,255,.12)" />
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(10,10,12,.82) 0%, transparent 55%)" }} />

              {course.highlightVideoUrl && (
                <button
                  onClick={() => setPreviewUrl(course.highlightVideoUrl || null)}
                  style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    width: 56, height: 56, borderRadius: "50%",
                    background: "rgba(255,255,255,.12)", backdropFilter: "blur(6px)",
                    border: `2px solid rgba(255,255,255,.25)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all .2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ORANGE; e.currentTarget.style.borderColor = ORANGE; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,.12)"; e.currentTarget.style.borderColor = "rgba(255,255,255,.25)"; }}
                >
                  <Play size={22} fill="#fff" color="#fff" />
                </button>
              )}
            </div>

            {/* Quick stats */}
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {[
                  { lbl: "Paket", val: activePkgs.length },
                  { lbl: "Materi", val: course.materials?.length || 0 },
                  { lbl: "Trial", val: trialPkg ? "Ada" : "—" },
                ].map((item) => (
                  <div
                    key={item.lbl}
                    style={{
                      borderRadius: 14, border: `1px solid ${BORDER}`,
                      background: "rgba(255,255,255,.025)", padding: "12px 10px",
                    }}
                  >
                    <div style={{ fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>
                      {item.lbl}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{item.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div style={{ padding: 20 }}>
              {featuredPkg && (
                <button
                  className="cp-btn-primary"
                  onClick={() => openEnroll(featuredPkg)}
                  style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                >
                  {featuredPkg.isTrial ? "Mulai Trial Gratis" : "Daftar Sekarang"}
                </button>
              )}
              {trialPkg && paidPkgs.length > 0 && (
                <a
                  href="#paket"
                  style={{
                    display: "block", textAlign: "center", fontSize: 12,
                    color: TEXT_DIM, textDecoration: "none", fontWeight: 600,
                  }}
                >
                  Lihat semua paket ↓
                </a>
              )}

              {/* Trust badges */}
              <div
                style={{
                  display: "flex", flexWrap: "wrap", gap: "8px 16px",
                  justifyContent: "center", marginTop: 14,
                  paddingTop: 14, borderTop: `1px solid ${BORDER}`,
                  fontSize: 11, color: TEXT_FAINT,
                }}
              >
                {[
                  { icon: <Shield size={11} />, txt: "Pembayaran aman" },
                  { icon: <Smartphone size={11} />, txt: "Mobile friendly" },
                  { icon: <Globe size={11} />, txt: "Akses lifetime" },
                ].map((b) => (
                  <div key={b.txt} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    {b.icon} {b.txt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Description + Quick Summary ── */}
      {course.description && (
        <div className="cp-shell" style={{ paddingBottom: 32 }}>
          <div className="cp-grid2">
            <div className="cp-surface" style={{ padding: "30px 28px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
                Tentang Course
              </p>
              <h2 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em" }}>
                Belajar lebih terarah & praktis
              </h2>
              <p
                style={{
                  margin: 0, color: "rgba(255,255,255,.55)",
                  fontSize: 14, lineHeight: 1.9, whiteSpace: "pre-line",
                }}
              >
                {course.description}
              </p>
            </div>

            <div className="cp-surface" style={{ padding: "30px 26px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
                Sebelum Daftar
              </p>
              <h2 style={{ margin: "0 0 18px", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
                Yang perlu kamu tahu
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {[
                  `${activePkgs.length} paket tersedia — pilih sesuai kebutuhanmu.`,
                  `${course.materials?.length || 0}+ materi tersusun dari pondasi sampai praktik.`,
                  trialPkg ? "Ada opsi trial untuk mulai tanpa komitmen penuh." : "Langsung ambil paket untuk akses materi lengkap.",
                  course.curriculumPdfUrl ? "Kurikulum PDF tersedia untuk diunduh sebelum daftar." : "Struktur materi dirancang bertahap dan terukur.",
                  "Bisa diakses dari desktop maupun mobile kapan saja.",
                ].map((item) => (
                  <div
                    key={item}
                    style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 13, color: "rgba(255,255,255,.58)", lineHeight: 1.65 }}
                  >
                    <Check size={14} color={ORANGE} style={{ flexShrink: 0, marginTop: 3 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              {course.curriculumPdfUrl && (
                <a
                  href={course.curriculumPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    marginTop: 20, display: "inline-flex", alignItems: "center", gap: 8,
                    textDecoration: "none", color: ORANGE, fontSize: 13, fontWeight: 700,
                  }}
                >
                  <Download size={14} /> Download Kurikulum PDF
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Curriculum / Materials ── */}
      {course.materials?.length > 0 && (
        <div className="cp-shell" style={{ paddingBottom: 36 }}>
          <div style={{ marginBottom: 20 }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
              Kurikulum
            </p>
            <h2 style={{ margin: "0 0 6px", fontSize: "clamp(24px,3vw,36px)", fontWeight: 900, letterSpacing: "-0.04em" }}>
              Apa yang kamu pelajari
            </h2>
            <p style={{ margin: 0, color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>
              {course.materials.length} materi disusun dari pondasi sampai praktik langsung.
            </p>
          </div>

          {/* Material grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px,1fr))", gap: 10 }}>
            {visibleMaterials.map((m, i) => {
              const locked = i >= 2 && !trialPkg;
              const typeIcon =
                m.type === "video" ? <Film size={14} color={ORANGE} /> :
                m.type === "pdf"   ? <FileText size={14} color={ORANGE} /> :
                <BookOpen size={14} color={ORANGE} />;

              return (
                <div key={m.id} className="material-row">
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 11,
                      background: ORANGE_DIM, display: "flex",
                      alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    {typeIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 12, color: TEXT_FAINT, fontWeight: 700,
                          minWidth: 22,
                        }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{m.title}</span>
                      <span
                        style={{
                          padding: "2px 8px", borderRadius: 100,
                          background: "rgba(255,255,255,.05)", border: `1px solid ${BORDER}`,
                          color: TEXT_FAINT, fontSize: 9, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: ".08em",
                        }}
                      >
                        {m.type}
                      </span>
                    </div>
                    {m.description && (
                      <p style={{ margin: "4px 0 0 30px", fontSize: 12, color: TEXT_FAINT, lineHeight: 1.6 }}>
                        {m.description}
                      </p>
                    )}
                  </div>
                  {locked && <Lock size={13} color={TEXT_FAINT} style={{ flexShrink: 0, marginTop: 2 }} />}
                </div>
              );
            })}
          </div>

          {course.materials.length > 6 && (
            <button
              onClick={() => setExpandedMaterials((p) => !p)}
              style={{
                marginTop: 16, display: "flex", alignItems: "center", gap: 8,
                background: "none", border: `1px solid ${BORDER}`, borderRadius: 100,
                color: TEXT_DIM, fontSize: 13, fontWeight: 700,
                padding: "10px 20px", cursor: "pointer", fontFamily: font,
                transition: "all .18s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = ORANGE_BORDER; e.currentTarget.style.color = ORANGE; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_DIM; }}
            >
              {expandedMaterials ? (
                <><ChevronUp size={14} /> Sembunyikan</>
              ) : (
                <><ChevronDown size={14} /> Lihat {course.materials.length - 6} materi lagi</>
              )}
            </button>
          )}
        </div>
      )}

      {/* ── Packages section ── */}
      {activePkgs.length > 0 && (() => {
        const activePkg = activePkgs.find(p => p.id === selectedPkgId) ?? activePkgs[0];

        return (
          <div id="paket" className="cp-shell" style={{ paddingBottom: 48 }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", color: ORANGE }}>
                Paket Kelas
              </p>
              <h2 style={{ margin: "0 0 8px", fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                Pilih paket yang pas buatmu
              </h2>
              <p style={{ margin: 0, color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>
                {trialPkg ? "Mulai dari trial gratis, atau langsung ambil akses penuh." : "Pilih paket sesuai kebutuhan dan komitmen belajarmu."}
              </p>
            </div>

            {/* Package cards grid */}
            <div className="pkg-compare" style={{ marginBottom: 28 }}>
              {activePkgs.map((pkg, i) => {
                const features  = parseFeatures(pkg.features);
                const isSelected = pkg.id === selectedPkgId;
                const isPopular  = !pkg.isTrial && paidPkgs.length > 1 && paidPkgs.indexOf(pkg) === Math.floor(paidPkgs.length / 2);
                const price      = Number(pkg.price);
                const origP      = pkg.originalPrice ? Number(pkg.originalPrice) : null;
                const hasDisc    = !!(origP && origP > price);
                const discExp    = pkg.discountEndDate ? new Date(pkg.discountEndDate).getTime() < Date.now() : false;
                const showDisc   = hasDisc && !discExp;
                const discPct    = showDisc ? Math.round((1 - price / origP!) * 100) : 0;
                const endDate    = pkg.discountEndDate ? new Date(pkg.discountEndDate) : null;
                let countdown    = "";
                if (endDate && !discExp) {
                  const diff = endDate.getTime() - Date.now();
                  const d = Math.floor(diff / 86400000);
                  const h = Math.floor((diff % 86400000) / 3600000);
                  const m = Math.floor((diff % 3600000) / 60000);
                  countdown = d > 0 ? `${d} hari ${h}j` : h > 0 ? `${h}j ${m}m` : `${m}m`;
                }

                return (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkgId(pkg.id)}
                    className={`pkg-card-v2${isSelected ? " selected" : ""}${pkg.isTrial ? " trial" : ""}${showDisc ? " has-discount" : ""}`}
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {/* Discount ribbon corner */}
                    {showDisc && (
                      <div className="discount-ribbon">
                        -{discPct}% OFF
                      </div>
                    )}

                    {/* Popular badge */}
                    {isPopular && !showDisc && (
                      <div style={{
                        position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                        padding: "4px 16px", borderRadius: "0 0 14px 14px",
                        background: ORANGE, color: "#fff", fontSize: 10, fontWeight: 800,
                        letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap",
                      }}>
                        ⭐ Paling Populer
                      </div>
                    )}
                    {isPopular && showDisc && (
                      <div style={{
                        position: "absolute", top: -1, left: "50%", transform: "translateX(-50%)",
                        padding: "4px 16px", borderRadius: "0 0 14px 14px",
                        background: ORANGE, color: "#fff", fontSize: 10, fontWeight: 800,
                        letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap",
                      }}>
                        🔥 Promo Terbaik
                      </div>
                    )}

                    {/* Selected checkmark */}
                    <div style={{
                      position: "absolute", top: 16, right: showDisc ? 80 : 16,
                      width: 24, height: 24, borderRadius: "50%",
                      border: `2px solid ${isSelected ? ORANGE : BORDER}`,
                      background: isSelected ? ORANGE : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .2s",
                    }}>
                      {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                    </div>

                    {/* Trial badge */}
                    {pkg.isTrial && (
                      <div style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        marginBottom: 14, padding: "4px 12px", borderRadius: 100,
                        background: "rgba(250,204,21,.12)", border: "1px solid rgba(250,204,21,.3)",
                        color: "#fbbf24", fontSize: 10, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase",
                      }}>
                        <Zap size={10} fill="#fbbf24" /> Trial Gratis
                      </div>
                    )}

                    {/* Package name */}
                    <h3 style={{
                      margin: isPopular ? "18px 0 6px" : "0 0 6px",
                      fontSize: 20, fontWeight: 900, letterSpacing: "-0.03em",
                      color: isSelected ? "#fff" : "rgba(255,255,255,.9)",
                      paddingRight: 32,
                    }}>
                      {pkg.name}
                    </h3>

                    {/* Description */}
                    {pkg.description && (
                      <p style={{ margin: "0 0 18px", fontSize: 13, color: TEXT_DIM, lineHeight: 1.6 }}>
                        {pkg.description}
                      </p>
                    )}

                    {/* Price block — pakai vars dari wrapper IIFE di atas */}
                    <div style={{ marginBottom: 22 }}>
                      {showDisc && (
                        <div style={{ marginBottom: 10 }}>
                          {/* Harga asli dicoret + badge % */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                            <span className="price-original">{formatCurrency(origP!)}</span>
                            <span className="price-badge-pct">Hemat {discPct}%</span>
                            {pkg.discountLabel && (
                              <span className="price-badge-label">{pkg.discountLabel}</span>
                            )}
                          </div>
                          {/* Countdown */}
                          {countdown && (
                            <div className="countdown-badge">
                              ⏳ Berakhir dalam {countdown}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Harga jual utama */}
                      <div style={{
                        fontSize: showDisc ? 44 : 38, fontWeight: 900, letterSpacing: "-0.05em",
                        color: pkg.isTrial ? "#fbbf24" : showDisc ? "#fff" : ORANGE,
                        lineHeight: 1, transition: "font-size .2s",
                      }}>
                        {price === 0 ? "GRATIS" : formatCurrency(price)}
                      </div>

                      {/* Hemat */}
                      {showDisc && price > 0 && (
                        <div className="price-save">
                          💰 Hemat {formatCurrency(origP! - price)}
                        </div>
                      )}

                      {/* Durasi */}
                      {pkg.durationDays && (
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          marginTop: 8, color: TEXT_FAINT, fontSize: 12, fontWeight: 600,
                        }}>
                          <Clock size={12} /> {pkg.durationDays} hari akses
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div style={{ height: 1, background: isSelected ? `${ORANGE}40` : BORDER, marginBottom: 18 }} />

                    {/* Features list */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {(features.length > 0
                        ? features.slice(0, 6)
                        : pkg.isTrial
                          ? ["Akses materi terbatas", "Preview konten", "Tanpa syarat"]
                          : ["Akses materi utama", "Sertifikat resmi", "Support pembelajaran"]
                      ).map((f, fi) => (
                        <div key={fi} style={{
                          display: "flex", alignItems: "flex-start", gap: 9,
                          fontSize: 13, color: isSelected ? "rgba(255,255,255,.75)" : TEXT_DIM, lineHeight: 1.5,
                        }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: 7, flexShrink: 0, marginTop: 1,
                            background: pkg.isTrial
                              ? isSelected ? "rgba(250,204,21,.2)" : "rgba(250,204,21,.08)"
                              : isSelected ? ORANGE_DIM : "rgba(255,255,255,.04)",
                            border: `1px solid ${pkg.isTrial ? "rgba(250,204,21,.3)" : isSelected ? ORANGE_BORDER : BORDER}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            <Check size={11} color={pkg.isTrial ? "#fbbf24" : ORANGE} strokeWidth={2.5} />
                          </div>
                          {f}
                        </div>
                      ))}
                    </div>

                    {/* CTA hint */}
                    <div style={{
                      marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between",
                      fontSize: 13, fontWeight: 800,
                      color: isSelected
                        ? (pkg.isTrial ? "#fbbf24" : showDisc ? "#f87171" : ORANGE)
                        : TEXT_DIM,
                    }}>
                      <span>{isSelected ? (showDisc ? "🔥 Paket dipilih ✓" : "Paket dipilih ✓") : "Pilih paket ini"}</span>
                      <ChevronRight size={15} />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Selected package summary + CTA ── */}
            {activePkg && (
              <div style={{
                borderRadius: 24, border: `1.5px solid ${ORANGE_BORDER}`,
                background: "linear-gradient(135deg, rgba(240,56,32,.1) 0%, rgba(255,255,255,.02) 100%)",
                padding: "24px 28px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 20, flexWrap: "wrap",
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                    background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {activePkg.isTrial ? <Zap size={22} color={ORANGE} /> : <BookOpen size={22} color={ORANGE} />}
                  </div>
                  <div>
                    <p style={{ margin: "0 0 3px", fontSize: 10, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>
                      Paket terpilih
                    </p>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                      {activePkg.name}
                      {activePkg.durationDays && (
                        <span style={{ marginLeft: 10, fontSize: 12, color: TEXT_DIM, fontWeight: 600 }}>
                          · {activePkg.durationDays} hari
                        </span>
                      )}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 13, color: TEXT_DIM }}>
                      {activePkg.description || "Akses materi sesuai paket"}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, flexShrink: 0, flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: "0 0 2px", fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".12em" }}>Total</p>
                    <p style={{ margin: 0, fontSize: 28, fontWeight: 900, color: ORANGE, letterSpacing: "-0.04em" }}>
                      {(() => {
                        const p = Number(activePkg.price);
                        const op = activePkg.originalPrice ? Number(activePkg.originalPrice) : null;
                        const expired = activePkg.discountEndDate ? new Date(activePkg.discountEndDate).getTime() < Date.now() : false;
                        return (
                          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {op && op > p && !expired && (
                              <span style={{ fontSize: "0.7em", textDecoration: "line-through", color: "rgba(255,255,255,.35)", fontWeight: 600 }}>
                                {formatCurrency(op)}
                              </span>
                            )}
                            {p === 0 ? "GRATIS" : formatCurrency(p)}
                            {op && op > p && !expired && (
                              <span style={{ fontSize: "0.55em", padding: "2px 7px", borderRadius: 100, background: "rgba(239,68,68,.2)", color: "#f87171", fontWeight: 900 }}>
                                -{Math.round((1 - p/op)*100)}%
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={() => openEnroll(activePkg)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "14px 28px", borderRadius: 100,
                      border: "none", background: ORANGE, color: "#fff",
                      fontSize: 15, fontWeight: 800, fontFamily: font, cursor: "pointer",
                      transition: "opacity .18s, transform .18s",
                      boxShadow: `0 8px 32px ${ORANGE}44`,
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = ".9"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
                  >
                    {Number(activePkg.price) === 0 ? "Mulai Gratis" : "Daftar & Bayar"}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Trust strip */}
            <div style={{
              display: "flex", gap: "10px 28px", flexWrap: "wrap", justifyContent: "center",
              marginTop: 20, paddingTop: 20, borderTop: `1px solid ${BORDER}`,
              fontSize: 12, color: TEXT_FAINT,
            }}>
              {[
                { icon: <Shield size={12} />, txt: "Pembayaran aman via Midtrans" },
                { icon: <Clock size={12} />,  txt: "Akses langsung setelah pembayaran" },
                { icon: <Globe size={12} />,  txt: "Bisa akses dari mana saja" },
                { icon: <Award size={12} />,  txt: "Sertifikat resmi" },
              ].map(b => (
                <div key={b.txt} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {b.icon} {b.txt}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Mobile sticky CTA */}
      {activePkgs.length > 0 && (() => {
        const activePkg = activePkgs.find(p => p.id === selectedPkgId) ?? activePkgs[0];
        return activePkg ? (
          <div className="sticky-cta">
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, color: TEXT_DIM, fontWeight: 600 }}>Paket: {activePkg.name}</p>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: ORANGE }}>
                {Number(activePkg.price) === 0 ? "GRATIS" : formatCurrency(Number(activePkg.price))}
              </p>
            </div>
            <button
              onClick={() => openEnroll(activePkg)}
              style={{
                flexShrink: 0, padding: "12px 22px", borderRadius: 100,
                border: "none", background: ORANGE, color: "#fff",
                fontSize: 14, fontWeight: 800, fontFamily: font, cursor: "pointer",
              }}
            >
              {Number(activePkg.price) === 0 ? "Mulai Gratis" : "Daftar Sekarang"}
            </button>
          </div>
        ) : null;
      })()}

      {/* ── Workshop Offline ── */}
      {(course.workshops ?? []).filter(w => w.isActive !== false).length > 0 && (() => {
        const workshops = (course.workshops ?? []).filter(w => w.isActive !== false);
        return (
          <div id="workshop" className="cp-shell" style={{ paddingBottom: 56 }}>
            {/* Section header */}
            <div style={{ marginBottom: 32 }}>
              <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".22em", textTransform: "uppercase", color: ORANGE }}>
                Workshop Offline
              </p>
              <h2 style={{ margin: "0 0 10px", fontSize: "clamp(26px,3.5vw,42px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.05 }}>
                Belajar langsung tatap muka
              </h2>
              <p style={{ margin: 0, color: TEXT_DIM, fontSize: 15, lineHeight: 1.7, maxWidth: 560 }}>
                Sesi intensif offline — praktik nyata, feedback real-time, dan networking dengan sesama filmmaker.
              </p>
            </div>

            {/* Workshop cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {workshops.map((ws, wsIdx) => {
                const dateObj    = new Date(ws.date);
                const endDateObj = ws.endDate ? new Date(ws.endDate) : null;
                const isSameDay  = endDateObj ? dateObj.toDateString() === endDateObj.toDateString() : true;
                const spotsLeft  = ws.quota - (ws.registeredCount ?? 0);
                const soldOut    = spotsLeft <= 0;
                const almostFull = !soldOut && spotsLeft <= Math.ceil(ws.quota * 0.2);
                const pct        = Math.min(100, Math.round(((ws.registeredCount ?? 0) / ws.quota) * 100));

                const dateLabel = dateObj.toLocaleDateString("id-ID", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                });
                const endDateLabel = endDateObj && !isSameDay
                  ? endDateObj.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })
                  : null;
                const timeLabel = endDateObj && isSameDay
                  ? `${dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} – ${endDateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`
                  : `${dateObj.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;

                const hasMedia  = !!(ws.posterUrl || ws.videoUrl);
                const ytId      = ws.videoUrl?.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([\w-]{11})/)?.[1];
                const vmId      = ws.videoUrl?.match(/vimeo\.com\/(\d+)/)?.[1];
                const isDirectV = !!(ws.videoUrl && /\.(mp4|webm|mov)(?:\?|#|$)/i.test(ws.videoUrl));
                const embedSrc  = ytId ? `https://www.youtube.com/embed/${ytId}?rel=0`
                                : vmId ? `https://player.vimeo.com/video/${vmId}`
                                : null;

                const hlItems: string[] = (() => {
                  if (!ws.highlights) return [];
                  try { const a = JSON.parse(ws.highlights); return Array.isArray(a) ? a : []; }
                  catch { return ws.highlights.split("\n").filter(Boolean); }
                })();

                return (
                  <div
                    key={ws.id}
                    style={{
                      borderRadius: 28,
                      border: `1.5px solid ${soldOut ? BORDER : ORANGE_BORDER}`,
                      background: "rgba(255,255,255,.022)",
                      overflow: "hidden",
                      opacity: soldOut ? 0.65 : 1,
                      animation: `fadeUp .5s ease ${wsIdx * 0.12}s both`,
                      transition: "box-shadow .3s, border-color .3s",
                    }}
                    onMouseEnter={(e) => {
                      if (!soldOut) {
                        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 1px ${ORANGE_BORDER}, 0 32px 64px rgba(0,0,0,.55)`;
                        (e.currentTarget as HTMLDivElement).style.borderColor = `rgba(240,56,32,.45)`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                      (e.currentTarget as HTMLDivElement).style.borderColor = soldOut ? BORDER : ORANGE_BORDER;
                    }}
                  >
                    {/* ── Media: poster + video embed ── */}
                    {hasMedia && (
                      <div style={{ position: "relative", width: "100%", aspectRatio: "16/6", minHeight: 220, overflow: "hidden", background: "#0d0d10" }}>
                        {/* Poster bg */}
                        {ws.posterUrl && (
                          <div
                            style={{
                              position: "absolute", inset: 0,
                              backgroundImage: `url(${ws.posterUrl})`,
                              backgroundSize: "cover", backgroundPosition: "center",
                              filter: ws.videoUrl ? "blur(2px) brightness(.45)" : "brightness(.7)",
                              transform: "scale(1.04)",
                              transition: "transform .6s ease",
                            }}
                          />
                        )}
                        {/* Gradient overlay */}
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,.1) 0%, rgba(10,10,12,.85) 100%)" }} />

                        {/* Inline video embed — only shown when no poster / or as overlay */}
                        {ws.videoUrl && embedSrc && !ws.posterUrl && (
                          <iframe
                            src={embedSrc}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                            allow="autoplay; fullscreen"
                            allowFullScreen
                          />
                        )}
                        {ws.videoUrl && isDirectV && !ws.posterUrl && (
                          <video
                            src={ws.videoUrl}
                            autoPlay muted loop playsInline
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        )}

                        {/* Play-over-poster: click opens video in modal */}
                        {ws.videoUrl && ws.posterUrl && (() => {
                          const [showVideo, setShowVideo] = useState(false);
                          return showVideo ? (
                            <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 5 }}>
                              {embedSrc ? (
                                <iframe
                                  src={`${embedSrc}&autoplay=1`}
                                  style={{ width: "100%", height: "100%", border: "none" }}
                                  allow="autoplay; fullscreen"
                                  allowFullScreen
                                />
                              ) : isDirectV ? (
                                <video
                                  src={ws.videoUrl}
                                  autoPlay controls playsInline
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : null}
                              <button
                                onClick={() => setShowVideo(false)}
                                style={{
                                  position: "absolute", top: 12, right: 12,
                                  width: 36, height: 36, borderRadius: "50%",
                                  background: "rgba(0,0,0,.6)", backdropFilter: "blur(8px)",
                                  border: `1px solid ${BORDER}`, color: "#fff",
                                  cursor: "pointer", fontSize: 18, zIndex: 6,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >×</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowVideo(true)}
                              style={{
                                position: "absolute", inset: 0, width: "100%", height: "100%",
                                background: "transparent", border: "none", cursor: "pointer",
                                display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4,
                              }}
                            >
                              <div
                                style={{
                                  width: 68, height: 68, borderRadius: "50%",
                                  background: "rgba(255,255,255,.12)",
                                  backdropFilter: "blur(10px)",
                                  border: "2.5px solid rgba(255,255,255,.3)",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  transition: "all .22s",
                                  boxShadow: `0 0 0 0 ${ORANGE_DIM}`,
                                }}
                                onMouseEnter={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = ORANGE;
                                  (e.currentTarget as HTMLElement).style.borderColor = ORANGE;
                                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 32px ${ORANGE}55`;
                                  (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
                                }}
                                onMouseLeave={(e) => {
                                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.12)";
                                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.3)";
                                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 0 ${ORANGE_DIM}`;
                                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                                }}
                              >
                                <Play size={26} fill="#fff" color="#fff" />
                              </div>
                            </button>
                          );
                        })()}

                        {/* Overlaid badges */}
                        <div style={{ position: "absolute", top: 16, left: 20, display: "flex", gap: 8, zIndex: 3 }}>
                          {soldOut && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 12px", borderRadius: 100, background: "rgba(239,68,68,.2)", border: "1px solid rgba(239,68,68,.4)", color: "#f87171", backdropFilter: "blur(8px)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                              Penuh
                            </span>
                          )}
                          {almostFull && !soldOut && (
                            <span style={{ fontSize: 10, fontWeight: 800, padding: "4px 12px", borderRadius: 100, background: "rgba(251,146,60,.2)", border: "1px solid rgba(251,146,60,.4)", color: "#fb923c", backdropFilter: "blur(8px)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                              🔥 Hampir penuh
                            </span>
                          )}
                          {ws.videoUrl && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "4px 12px", borderRadius: 100, background: "rgba(0,0,0,.5)", border: `1px solid ${BORDER}`, color: "rgba(255,255,255,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", gap: 4 }}>
                              <Play size={9} fill="currentColor" /> Video tersedia
                            </span>
                          )}
                        </div>

                        {/* Price badge top-right */}
                        <div style={{ position: "absolute", top: 16, right: 20, zIndex: 3, textAlign: "right" }}>
                          <div
                            style={{
                              padding: "6px 16px", borderRadius: 100,
                              background: Number(ws.price) === 0 ? "rgba(34,197,94,.18)" : "rgba(10,10,12,.75)",
                              border: Number(ws.price) === 0 ? "1px solid rgba(34,197,94,.35)" : `1px solid ${ORANGE_BORDER}`,
                              backdropFilter: "blur(12px)",
                            }}
                          >
                            <span style={{ fontSize: 16, fontWeight: 900, color: Number(ws.price) === 0 ? "#4ade80" : ORANGE, letterSpacing: "-0.02em" }}>
                              {Number(ws.price) === 0 ? "GRATIS" : formatCurrency(Number(ws.price))}
                            </span>
                          </div>
                        </div>

                        {/* Title overlay bottom */}
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "28px 28px 24px", zIndex: 3 }}>
                          <h3 style={{ margin: "0 0 6px", fontSize: "clamp(20px,2.5vw,30px)", fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1, textShadow: "0 2px 16px rgba(0,0,0,.6)" }}>
                            {ws.title}
                          </h3>
                          {ws.description && (
                            <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,.62)", lineHeight: 1.6, maxWidth: 600 }}>
                              {ws.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Content area ── */}
                    <div style={{ padding: hasMedia ? "24px 28px 0" : "28px 28px 0" }}>
                      {/* Title (if no media) */}
                      {!hasMedia && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                            <h3 style={{ margin: 0, fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 900, letterSpacing: "-0.04em" }}>{ws.title}</h3>
                            {soldOut && <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 100, background: "rgba(239,68,68,.15)", border: "1px solid rgba(239,68,68,.3)", color: "#f87171", textTransform: "uppercase", letterSpacing: ".08em" }}>Penuh</span>}
                            {almostFull && !soldOut && <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 100, background: "rgba(251,146,60,.15)", border: "1px solid rgba(251,146,60,.3)", color: "#fb923c", textTransform: "uppercase", letterSpacing: ".08em" }}>🔥 Hampir penuh</span>}
                          </div>
                          {ws.description && <p style={{ margin: 0, color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>{ws.description}</p>}
                        </div>
                      )}

                      {/* ── Two-col: detail + highlights ── */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: hlItems.length > 0 ? "1fr 1fr" : "1fr",
                          gap: 24,
                          marginBottom: 20,
                        }}
                        className="ws-grid"
                      >
                        {/* Left: date/location/quota */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                          {[
                            {
                              icon: <Calendar size={15} color={ORANGE} />,
                              label: "Tanggal",
                              value: endDateLabel ? `${dateLabel} – ${endDateLabel}` : dateLabel,
                            },
                            {
                              icon: <Clock size={15} color={ORANGE} />,
                              label: "Waktu",
                              value: timeLabel,
                            },
                            {
                              icon: <MapPin size={15} color={ORANGE} />,
                              label: "Lokasi",
                              value: ws.location,
                              href: ws.locationUrl,
                            },
                          ].map((item) => (
                            <div key={item.label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                              <div
                                style={{
                                  width: 34, height: 34, borderRadius: 11,
                                  background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`,
                                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                                }}
                              >
                                {item.icon}
                              </div>
                              <div>
                                <p style={{ margin: "0 0 2px", fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>
                                  {item.label}
                                </p>
                                {item.href ? (
                                  <a
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: ORANGE, fontSize: 13, fontWeight: 600, textDecoration: "none", lineHeight: 1.5 }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                  >
                                    {item.value} ↗
                                  </a>
                                ) : (
                                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.5 }}>{item.value}</p>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Quota bar */}
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            <div
                              style={{
                                width: 34, height: 34, borderRadius: 11,
                                background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`,
                                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
                              }}
                            >
                              <Users size={15} color={ORANGE} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                <p style={{ margin: 0, fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700 }}>Kuota</p>
                                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: soldOut ? "#f87171" : almostFull ? "#fb923c" : "#4ade80" }}>
                                  {ws.registeredCount ?? 0}/{ws.quota}
                                </p>
                              </div>
                              {/* Progress bar */}
                              <div style={{ height: 5, borderRadius: 100, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    borderRadius: 100,
                                    background: soldOut
                                      ? "linear-gradient(90deg, #ef4444, #f87171)"
                                      : almostFull
                                        ? "linear-gradient(90deg, #f97316, #fb923c)"
                                        : `linear-gradient(90deg, ${ORANGE}, #ff6d40)`,
                                    transition: "width 1.2s ease",
                                  }}
                                />
                              </div>
                              <p style={{ margin: "5px 0 0", fontSize: 11, color: TEXT_DIM }}>
                                {soldOut ? "Penuh — daftar tunggu" : `Sisa ${spotsLeft} tempat`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Right: highlights */}
                        {hlItems.length > 0 && (
                          <div>
                            <p style={{ margin: "0 0 12px", fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 700 }}>
                              Yang Kamu Dapatkan
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {hlItems.map((h, i) => (
                                <div
                                  key={i}
                                  style={{
                                    display: "flex", alignItems: "flex-start", gap: 10,
                                    animation: `fadeUp .4s ease ${i * 0.07}s both`,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 22, height: 22, borderRadius: 8,
                                      background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      flexShrink: 0, marginTop: 1,
                                    }}
                                  >
                                    <Check size={11} color={ORANGE} />
                                  </div>
                                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.65)", lineHeight: 1.6 }}>{h}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── CTA footer ── */}
                    <div
                      style={{
                        margin: "0 28px",
                        padding: "18px 0",
                        borderTop: `1px solid ${BORDER}`,
                        display: "flex", alignItems: "center",
                        justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                        marginBottom: 24,
                      }}
                    >
                      {/* Live status dot */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ position: "relative", width: 10, height: 10 }}>
                          <div
                            style={{
                              position: "absolute", inset: 0, borderRadius: "50%",
                              background: soldOut ? "#6b7280" : almostFull ? "#fb923c" : "#22c55e",
                            }}
                          />
                          {!soldOut && (
                            <div
                              style={{
                                position: "absolute", inset: 0, borderRadius: "50%",
                                background: almostFull ? "#fb923c" : "#22c55e",
                                animation: "ping 1.5s ease infinite",
                              }}
                            />
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: TEXT_DIM, fontWeight: 600 }}>
                          {soldOut ? "Pendaftaran ditutup" : almostFull ? `🔥 Sisa ${spotsLeft} tempat — segera daftar` : `${spotsLeft} tempat tersisa`}
                        </span>
                      </div>

                      {/* Price (no media) + CTA */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {!hasMedia && (
                          <div style={{ textAlign: "right" }}>
                            <p style={{ margin: 0, fontSize: 9, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: ".12em" }}>Investasi</p>
                            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: ORANGE, letterSpacing: "-0.03em" }}>
                              {Number(ws.price) === 0 ? "GRATIS" : formatCurrency(Number(ws.price))}
                            </p>
                          </div>
                        )}
                        {!soldOut ? (
                          ws.registrationUrl ? (
                            <a
                              href={ws.registrationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "12px 26px", borderRadius: 100,
                                background: ORANGE, color: "#fff",
                                fontSize: 14, fontWeight: 800, textDecoration: "none", fontFamily: font,
                                transition: "opacity .18s, transform .18s",
                                boxShadow: `0 8px 28px ${ORANGE}44`,
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = ".88"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)"; }}
                            >
                              Daftar Workshop <ChevronRight size={15} />
                            </a>
                          ) : (
                            <a
                              href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ingin daftar workshop *${ws.title}* — ${dateLabel}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "inline-flex", alignItems: "center", gap: 8,
                                padding: "12px 26px", borderRadius: 100,
                                background: "#25d366", color: "#fff",
                                fontSize: 14, fontWeight: 800, textDecoration: "none", fontFamily: font,
                                boxShadow: "0 8px 24px rgba(37,211,102,.3)",
                                transition: "opacity .18s",
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = ".88")}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
                            >
                              <MessageCircle size={15} /> Daftar via WhatsApp
                            </a>
                          )
                        ) : (
                          <a
                            href={`https://wa.me/${waNumber}?text=${encodeURIComponent(`Halo, saya ingin masuk daftar tunggu workshop *${ws.title}*`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 8,
                              padding: "12px 22px", borderRadius: 100,
                              background: "rgba(255,255,255,.06)", border: `1px solid ${BORDER}`,
                              color: TEXT_DIM, fontSize: 13, fontWeight: 700, textDecoration: "none", fontFamily: font,
                            }}
                          >
                            <MessageCircle size={14} /> Daftar Tunggu
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Gallery ── */}
      {(course.gallery ?? []).length > 0 && (() => {
        const photos = course.gallery ?? [];
        const [lightbox, setLightbox] = useState<string | null>(null);
        return (
          <div className="cp-shell" style={{ paddingBottom: 40 }}>
            <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
              Gallery
            </p>
            <h2 style={{ margin: "0 0 20px", fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, letterSpacing: "-0.04em" }}>
              Suasana belajar langsung
            </h2>

            {/* Masonry-style grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  onClick={() => setLightbox(photo.url)}
                  style={{
                    borderRadius: 16, overflow: "hidden",
                    border: `1px solid ${BORDER}`,
                    aspectRatio: i % 5 === 0 ? "4/3" : i % 3 === 0 ? "1/1" : "16/9",
                    position: "relative", cursor: "zoom-in",
                    background: "#111",
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.caption || `Gallery ${i + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .3s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  />
                  {photo.caption && (
                    <div
                      style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(to top, rgba(0,0,0,.75) 0%, transparent 55%)",
                        display: "flex", alignItems: "flex-end", padding: "12px 14px",
                        opacity: 0, transition: "opacity .2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <p style={{ margin: 0, fontSize: 12, color: "#fff", lineHeight: 1.4 }}>{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Lightbox */}
            {lightbox && (
              <div
                onClick={() => setLightbox(null)}
                style={{
                  position: "fixed", inset: 0, zIndex: 300,
                  background: "rgba(0,0,0,.94)", backdropFilter: "blur(18px)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                }}
              >
                <button
                  onClick={() => setLightbox(null)}
                  style={{
                    position: "absolute", top: 18, right: 18,
                    width: 44, height: 44, borderRadius: "50%",
                    border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.08)",
                    color: "#fff", cursor: "pointer", fontSize: 20,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >×</button>
                <img
                  src={lightbox}
                  alt="Gallery"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    maxWidth: "92vw", maxHeight: "88vh",
                    objectFit: "contain", borderRadius: 16,
                    boxShadow: "0 40px 80px rgba(0,0,0,.8)",
                  }}
                />
              </div>
            )}
          </div>
        );
      })()}

      {/* ── What you'll get (why section) ── */}
      <div className="cp-shell" style={{ paddingBottom: 40 }}>
        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
          Kenapa Course Ini
        </p>
        <h2 style={{ margin: "0 0 20px", fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, letterSpacing: "-0.04em" }}>
          Dirancang buat yang serius belajar
        </h2>
        <div className="cp-why-grid">
          {[
            { icon: <Zap size={20} color={ORANGE} />, title: "Praktikal", body: "Lebih banyak fokus ke hasil dan workflow nyata, bukan teori berputar-putar." },
            { icon: <Film size={20} color={ORANGE} />, title: "Sineas Berpengalaman", body: "Diajarkan langsung oleh praktisi aktif di industri videografi Indonesia." },
            { icon: <BookOpen size={20} color={ORANGE} />, title: "Kurikulum Terstruktur", body: "Dari pondasi hingga teknik lanjutan — progres belajar yang jelas dan terukur." },
            { icon: <Award size={20} color={ORANGE} />, title: "Sertifikat Resmi", body: "Sertifikat penyelesaian yang bisa kamu cantumkan di portfolio atau LinkedIn." },
            { icon: <Smartphone size={20} color={ORANGE} />, title: "Akses Fleksibel", body: "Bisa belajar dari mana saja — desktop, tablet, maupun mobile." },
            { icon: <Shield size={20} color={ORANGE} />, title: "Dukungan Penuh", body: "Ada sesi tanya-jawab dan komunitas alumni untuk saling support." },
          ].map((item) => (
            <div
              key={item.title}
              className="cp-surface"
              style={{ padding: "24px 22px" }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: ORANGE_DIM, border: `1px solid ${ORANGE_BORDER}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                {item.icon}
              </div>
              <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {item.title}
              </h3>
              <p style={{ margin: 0, color: TEXT_DIM, fontSize: 13, lineHeight: 1.7 }}>{item.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Testimonials ── */}
      <div className="cp-shell" style={{ paddingBottom: 40 }}>
        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
          Testimoni Alumni
        </p>
        <h2 style={{ margin: "0 0 20px", fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, letterSpacing: "-0.04em" }}>
          Kata mereka yang sudah belajar
        </h2>
        <div className="cp-testi-grid">
          <TestiCard
            name="Rizky Pratama"
            role="Videografer Freelance, Yogyakarta"
            text="Materi disusun rapi banget, dari teknik dasar sampai color grading. Langsung bisa dipraktikkan buat klien setelah selesai kelas."
          />
          <TestiCard
            name="Sari Dewi"
            role="Content Creator, Jakarta"
            text="Instrukturnya sabar dan penjelasannya nyambung. Saya yang sebelumnya cuma megang HP sekarang udah bisa bikin video wedding yang layak dijual."
          />
          <TestiCard
            name="Budi Santoso"
            role="Fotografer yang Diversifikasi, Semarang"
            text="Worth banget. Investasi terbaik buat upgrade skill. Dalam 2 bulan sudah ada project pertama dari klien baru."
          />
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="cp-shell" style={{ paddingBottom: 48 }}>
        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
          FAQ
        </p>
        <h2 style={{ margin: "0 0 20px", fontSize: "clamp(22px,3vw,34px)", fontWeight: 900, letterSpacing: "-0.04em" }}>
          Pertanyaan yang sering ditanya
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 820 }}>
          {[
            {
              q: "Apakah saya perlu pengalaman sebelumnya?",
              a: `Course ini dirancang untuk semua level. ${course.level === "beginner" ? "Khususnya pemula — kamu tidak perlu pengalaman apapun untuk mulai." : "Ada materi pondasi yang memastikan kamu bisa mengikuti walau belum pernah pegang kamera profesional."}`,
            },
            {
              q: "Berapa lama saya punya akses ke materi?",
              a: paidPkgs[0]?.durationDays
                ? `Untuk paket berbayar, akses berlaku selama ${paidPkgs[0].durationDays} hari sejak pendaftaran. Untuk trial, durasi lebih terbatas.`
                : "Detail durasi akses tersedia di masing-masing paket. Silakan cek di bagian Paket Kelas di atas.",
            },
            {
              q: "Bagaimana cara pembayarannya?",
              a: "Kami menerima pembayaran melalui transfer bank, kartu kredit, dan dompet digital melalui Midtrans. Semua transaksi dienkripsi dan aman.",
            },
            {
              q: "Apakah ada sesi live atau hanya rekaman?",
              a: "Materi utama berupa video rekaman yang bisa diakses kapan saja. Beberapa paket juga termasuk sesi Q&A live dengan instruktur.",
            },
            {
              q: "Bagaimana jika tidak puas dengan kursusnya?",
              a: "Kami menyediakan garansi refund untuk 7 hari pertama, selama kamu belum mengakses lebih dari 20% materi. Hubungi kami melalui WhatsApp untuk proses lebih lanjut.",
            },
            {
              q: "Sertifikat apa yang saya dapatkan?",
              a: "Setelah menyelesaikan semua materi, kamu akan mendapat sertifikat kelulusan dari Frameless Academy yang bisa diunduh dan dibagikan ke LinkedIn atau portfolio.",
            },
          ].map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>
      </div>

      {/* ── Final CTA banner ── */}
      <div className="cp-shell" style={{ paddingBottom: 80 }}>
        <div
          className="cp-surface"
          style={{
            padding: "44px 40px",
            background: `linear-gradient(135deg, rgba(240,56,32,.14) 0%, rgba(255,255,255,.02) 100%)`,
            position: "relative", overflow: "hidden",
          }}
        >
          {/* Decorative glow */}
          <div
            style={{
              position: "absolute", top: -60, right: -60,
              width: 300, height: 300, borderRadius: "50%",
              background: `radial-gradient(circle, ${ORANGE_DIM} 0%, transparent 70%)`,
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", gap: 20, flexWrap: "wrap",
              position: "relative",
            }}
          >
            <div>
              <p style={{ margin: "0 0 10px", fontSize: 10, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: ORANGE }}>
                Siap Mulai
              </p>
              <h2
                style={{
                  margin: "0 0 10px",
                  fontSize: "clamp(24px,3.5vw,38px)",
                  fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 1.1,
                }}
              >
                Mulai belajar videografi<br />bersama sineas profesional
              </h2>
              <p style={{ margin: 0, color: TEXT_DIM, fontSize: 14, lineHeight: 1.7 }}>
                Preview highlight ada di atas, detail paket ada di sana, dan daftar tinggal satu langkah.
              </p>
            </div>
            {featuredPkg && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
                <button
                  className="cp-btn-primary"
                  onClick={() => openEnroll(featuredPkg)}
                  style={{ fontSize: 15, padding: "14px 28px" }}
                >
                  {featuredPkg.isTrial ? "Coba Trial Gratis" : "Daftar Sekarang"}
                  <ChevronRight size={16} />
                </button>
                <p style={{ margin: 0, fontSize: 11, color: TEXT_FAINT, textAlign: "center", width: "100%" }}>
                  Tidak ada komitmen — bisa cancel kapan saja.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {previewUrl && <PreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
      {showEnroll && selectedPkg && (
        <EnrollModal
          selectedPkg={selectedPkg}
          allPkgs={activePkgs}
          courseName={course.title}
          courseId={course.id}
          waNumber={waNumber}
          onClose={() => { setShowEnroll(false); setSelectedPkg(null); }}
          onSuccess={(id) => navigate(`/portal/${id}`)}
          onChangePkg={(pkg) => { setSelectedPkg(pkg); setSelectedPkgId(pkg.id); }}
        />
      )}
    </div>
  );
}
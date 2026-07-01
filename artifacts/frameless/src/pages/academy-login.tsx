// src/pages/academy-login.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Eye, EyeOff,
  Key, Lock, Mail, RefreshCw, Shield,
} from "lucide-react";

const ORANGE     = "#F03820";
const ORANGE_DIM = "rgba(240,56,32,.12)";
const ORANGE_BRD = "rgba(240,56,32,.25)";
const BG         = "#0a0a0c";
const BORDER     = "rgba(255,255,255,.08)";
const TEXT_DIM   = "rgba(255,255,255,.45)";
const TEXT_FAINT = "rgba(255,255,255,.28)";
const FONT       = "'Plus Jakarta Sans',sans-serif";

type Mode = "login" | "resend";

export default function AcademyLoginPage() {
  const [, navigate] = useLocation();
  const [mode, setMode]           = useState<Mode>("login");
  const [email, setEmail]         = useState("");
  const [code, setCode]           = useState("");
  const [showCode, setShowCode]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [resendSent, setResendSent] = useState(false);

  const inputSt: React.CSSProperties = {
    width: "100%", padding: "13px 16px 13px 44px",
    borderRadius: 14, border: `1px solid ${BORDER}`,
    background: "rgba(255,255,255,.04)", color: "#fff",
    fontSize: 14, fontFamily: FONT, outline: "none",
    boxSizing: "border-box", transition: "border-color .15s",
  };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !code.trim()) { setError("Email dan kode member wajib diisi."); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/academy/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login gagal. Periksa email dan kode member kamu."); return; }
      // Redirect to portal
      navigate(`/portal/${data.enrollmentId}`);
    } catch { setError("Koneksi bermasalah. Coba lagi."); }
    finally { setLoading(false); }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email wajib diisi."); return; }
    setLoading(true);
    setError("");
    try {
      await fetch("/api/course-members/resend-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendSent(true);
    } catch { setError("Gagal mengirim. Coba lagi."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh", background: BG, color: "#fff", fontFamily: FONT,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", position: "relative", overflow: "hidden",
    }}>
      {/* Background glows */}
      <div style={{ position: "fixed", top: "-10%", left: "-10%", width: "60%", height: "60%", background: `radial-gradient(ellipse at center,${ORANGE}12,transparent 65%)`, filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "-10%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(ellipse at center,rgba(124,58,237,.1),transparent 65%)", filter: "blur(100px)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 1 }}>
        {/* Back */}
        <a href="/courses" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: TEXT_DIM, textDecoration: "none", fontSize: 13, fontWeight: 600, marginBottom: 32 }}>
          <ArrowLeft size={14} /> Kembali ke Kelas
        </a>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: ORANGE_DIM, border: `1.5px solid ${ORANGE_BRD}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: `0 0 40px ${ORANGE}22`,
          }}>
            <BookOpen size={28} color={ORANGE} />
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "clamp(24px,5vw,32px)", fontWeight: 900, letterSpacing: "-.045em" }}>
            {mode === "login" ? "Masuk ke Kelas" : "Kirim Ulang Akses"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: TEXT_DIM, lineHeight: 1.7 }}>
            {mode === "login"
              ? "Gunakan email dan kode member yang dikirim ke email kamu."
              : "Masukkan email pendaftaran untuk menerima ulang kode member."}
          </p>
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 24, border: `1px solid ${BORDER}`,
          background: "#111315", padding: "32px 28px",
        }}>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 14, background: "rgba(255,255,255,.04)", border: `1px solid ${BORDER}`, marginBottom: 28 }}>
            {(["login", "resend"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); setResendSent(false); }}
                style={{
                  flex: 1, padding: "9px 0", borderRadius: 10, border: "none",
                  background: mode === m ? ORANGE : "transparent",
                  color: mode === m ? "#fff" : TEXT_DIM,
                  fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
                  transition: "all .2s",
                }}
              >
                {m === "login" ? "Login Member" : "Kirim Ulang Kode"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(239,68,68,.25)", background: "rgba(239,68,68,.08)", marginBottom: 20 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#f87171" }}>{error}</p>
            </div>
          )}

          {/* Resend success */}
          {resendSent && (
            <div style={{ padding: "16px 18px", borderRadius: 16, border: "1px solid rgba(34,197,94,.25)", background: "rgba(34,197,94,.08)", marginBottom: 20 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(34,197,94,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={16} color="#22c55e" />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#4ade80" }}>Email terkirim!</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(74,222,128,.6)" }}>Cek inbox dan folder spam kamu.</p>
                </div>
              </div>
            </div>
          )}

          {/* Login form */}
          {mode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* Email field */}
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: TEXT_FAINT }}>
                  Email Pendaftaran
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} color={TEXT_FAINT} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@kamu.com"
                    autoComplete="email"
                    style={inputSt}
                    onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
              </div>

              {/* Member code field */}
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: TEXT_FAINT }}>
                  Kode Member
                </label>
                <div style={{ position: "relative" }}>
                  <Key size={15} color={TEXT_FAINT} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="FRM-XXXXXX"
                    autoComplete="off"
                    style={{ ...inputSt, paddingRight: 44, letterSpacing: ".1em", fontWeight: 700 }}
                    onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(p => !p)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: TEXT_DIM, padding: 4 }}
                  >
                    {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p style={{ margin: "7px 0 0", fontSize: 11, color: TEXT_FAINT }}>
                  Kode dikirim ke email saat pendaftaran berhasil. Format: FRM-XXXXXX
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px 0", borderRadius: 100, border: "none",
                  background: ORANGE, color: "#fff", fontSize: 15, fontWeight: 800,
                  fontFamily: FONT, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1, transition: "opacity .18s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: `0 8px 28px ${ORANGE}44`,
                }}
              >
                {loading ? (
                  <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.5)", borderTopColor: "#fff", animation: "spin .8s linear infinite" }} /> Masuk...</>
                ) : (
                  <><Lock size={15} /> Masuk ke Kelas <ChevronRight size={15} /></>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode("resend"); setError(""); }}
                style={{ background: "none", border: "none", color: TEXT_DIM, fontSize: 13, cursor: "pointer", fontFamily: FONT, textAlign: "center" }}
              >
                Tidak ingat kode? <span style={{ color: ORANGE, fontWeight: 700 }}>Kirim ulang →</span>
              </button>
            </form>
          )}

          {/* Resend form */}
          {mode === "resend" && !resendSent && (
            <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: TEXT_FAINT }}>
                  Email Pendaftaran
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} color={TEXT_FAINT} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="email@kamu.com"
                    autoComplete="email"
                    style={inputSt}
                    onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                    onBlur={e => (e.currentTarget.style.borderColor = BORDER)}
                  />
                </div>
                <p style={{ margin: "7px 0 0", fontSize: 11, color: TEXT_FAINT }}>
                  Kami akan kirim ulang kode member ke email ini jika terdaftar dan pembayaran sudah aktif.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "14px 0", borderRadius: 100, border: "none",
                  background: ORANGE, color: "#fff", fontSize: 15, fontWeight: 800,
                  fontFamily: FONT, cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1, transition: "opacity .18s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  boxShadow: `0 8px 28px ${ORANGE}44`,
                }}
              >
                {loading ? (
                  <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,.5)", borderTopColor: "#fff", animation: "spin .8s linear infinite" }} /> Mengirim...</>
                ) : (
                  <><RefreshCw size={15} /> Kirim Ulang Kode</>
                )}
              </button>

              <button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: TEXT_DIM, fontSize: 13, cursor: "pointer", fontFamily: FONT, textAlign: "center" }}>
                ← Kembali ke login
              </button>
            </form>
          )}

          {resendSent && (
            <button
              onClick={() => { setMode("login"); setResendSent(false); }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 100, border: `1px solid ${BORDER}`,
                background: "rgba(255,255,255,.04)", color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              }}
            >
              ← Kembali ke Login
            </button>
          )}
        </div>

        {/* Trust row */}
        <div style={{ display: "flex", gap: "8px 24px", justifyContent: "center", flexWrap: "wrap", marginTop: 24, fontSize: 11, color: TEXT_FAINT }}>
          {[
            { icon: <Shield size={11} />, txt: "Data aman & terenkripsi" },
            { icon: <Lock size={11} />,   txt: "Tidak tersimpan di browser" },
          ].map(b => (
            <div key={b.txt} style={{ display: "flex", alignItems: "center", gap: 5 }}>{b.icon} {b.txt}</div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: ${BG}; }
      `}</style>
    </div>
  );
}
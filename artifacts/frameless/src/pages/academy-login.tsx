// src/pages/academy-login.tsx
// ── Premium Visual Upgrade ─────────────────────────────────────────────────────
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Eye, EyeOff,
  Key, Lock, Mail, RefreshCw, Shield, Sparkles, GraduationCap,
} from "lucide-react";

const OR       = "#F03820";
const OR_DIM   = "rgba(240,56,32,.12)";
const OR_BRD   = "rgba(240,56,32,.25)";
const BG       = "#08080a";
const FONT     = "'Plus Jakarta Sans',sans-serif";

type Mode = "login" | "resend";

// ── Animated Mesh Background ──────────────────────────────────────────────────
function AcademyMesh() {
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* Primary orange blob */}
      <div style={{
        position: "absolute", width: "75%", height: "75%",
        top: "-25%", left: "-15%",
        background: `radial-gradient(ellipse at center, ${OR}28 0%, ${OR}0e 42%, transparent 70%)`,
        filter: "blur(80px)",
        animation: "acMesh1 20s ease-in-out infinite",
      }} />
      {/* Purple secondary */}
      <div style={{
        position: "absolute", width: "65%", height: "65%",
        top: "5%", right: "-20%",
        background: "radial-gradient(ellipse at center, rgba(124,58,237,.18) 0%, rgba(124,58,237,.06) 48%, transparent 72%)",
        filter: "blur(90px)",
        animation: "acMesh2 26s ease-in-out infinite",
      }} />
      {/* Bottom blue accent */}
      <div style={{
        position: "absolute", width: "55%", height: "55%",
        bottom: "-20%", left: "20%",
        background: "radial-gradient(ellipse at center, rgba(37,99,235,.12) 0%, transparent 70%)",
        filter: "blur(100px)",
        animation: "acMesh3 30s ease-in-out infinite",
      }} />
      {/* Subtle grid */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />
      {/* Scanline sweep */}
      <div style={{
        position: "absolute", left: 0, right: 0,
        height: "2px",
        background: `linear-gradient(to right, transparent, ${OR}20, transparent)`,
        animation: "acScanline 9s linear infinite",
        pointerEvents: "none",
      }} />
      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 38%, rgba(8,8,10,.88) 100%)",
      }} />
    </div>
  );
}

// ── Feature Badge ─────────────────────────────────────────────────────────────
function FeatureBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: "6px 14px", borderRadius: 100,
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(255,255,255,.08)",
      fontSize: 11, color: "rgba(255,255,255,.42)", fontWeight: 600,
      whiteSpace: "nowrap",
    }}>
      {icon}
      {label}
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

@keyframes acMesh1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(100px,-80px) scale(1.14);}66%{transform:translate(-50px,100px) scale(0.9);}}
@keyframes acMesh2{0%,100%{transform:translate(0,0) scale(1);}40%{transform:translate(-120px,80px) scale(0.87);}70%{transform:translate(80px,-110px) scale(1.18);}}
@keyframes acMesh3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(50px,70px) scale(1.1);}}
@keyframes acScanline{0%{transform:translateY(-100vh);}100%{transform:translateY(100vh);}}
@keyframes acFadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
@keyframes acSpin{to{transform:rotate(360deg);}}
@keyframes acPulse{0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.15);}}
@keyframes acGlow{0%,100%{box-shadow:0 0 24px ${OR}30;}50%{box-shadow:0 0 52px ${OR}60, 0 0 80px ${OR}22;}}
@keyframes acFloat{0%,100%{transform:translateY(0px);}50%{transform:translateY(-5px);}}
@keyframes acShimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
@keyframes acBadgePop{from{opacity:0;transform:scale(0.8) translateY(6px);}to{opacity:1;transform:scale(1) translateY(0);}}

.ac-card{
  animation: acFadeUp .65s cubic-bezier(.16,1,.3,1) both;
}
.ac-icon-wrap{
  animation: acGlow 3.5s ease-in-out infinite, acFloat 4s ease-in-out infinite;
}
.ac-input{
  width:100%; padding:13px 16px 13px 46px;
  border-radius:14px; border:1px solid rgba(255,255,255,.09);
  background:rgba(255,255,255,.038); color:#fff;
  font-size:14px; font-family:${FONT}; outline:none;
  box-sizing:border-box;
  transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.ac-input:focus{
  border-color:${OR}66;
  background:rgba(240,56,32,.05);
  box-shadow:0 0 0 3px ${OR}14;
}
.ac-input::placeholder{color:rgba(255,255,255,.2);}
.ac-btn-primary{
  width:100%; padding:14px 0; border-radius:14px; border:none;
  background:linear-gradient(135deg, ${OR}, #c42b10);
  color:#fff; font-size:14px; font-weight:800; letter-spacing:.04em;
  font-family:${FONT}; cursor:pointer;
  display:flex; align-items:center; justify-content:center; gap:8px;
  position:relative; overflow:hidden;
  transition:opacity .2s, transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
  box-shadow:0 8px 32px ${OR}40;
}
.ac-btn-primary::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(to right, transparent 0%, rgba(255,255,255,.12) 50%, transparent 100%);
  background-size:200% 100%;
  animation:acShimmer 2.8s ease infinite;
  pointer-events:none;
}
.ac-btn-primary:hover:not(:disabled){
  opacity:.93;
  transform:translateY(-1px) scale(1.01);
  box-shadow:0 14px 44px ${OR}55, 0 0 28px ${OR}30;
}
.ac-btn-primary:active:not(:disabled){
  transform:scale(0.97);
  transition-duration:.08s;
}
.ac-btn-primary:disabled{opacity:.5;cursor:not-allowed;}
.ac-tab{
  flex:1; padding:9px 0; border-radius:10px; border:none;
  font-size:12px; font-weight:700; cursor:pointer; font-family:${FONT};
  transition:all .22s cubic-bezier(.16,1,.3,1);
  position:relative; letter-spacing:.03em;
}
.ac-tab-active{
  background:linear-gradient(135deg,${OR},#c42b10);
  color:#fff;
  box-shadow:0 4px 18px ${OR}44;
}
.ac-tab-inactive{
  background:transparent; color:rgba(255,255,255,.35);
}
.ac-tab-inactive:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.06);}
.ac-social-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:20px;}
.ac-badge{animation:acBadgePop .4s cubic-bezier(.34,1.56,.64,1) both;}
.ac-badge:nth-child(1){animation-delay:.05s;}
.ac-badge:nth-child(2){animation-delay:.12s;}
.ac-badge:nth-child(3){animation-delay:.19s;}
`;

// ── Main Component ────────────────────────────────────────────────────────────
export default function AcademyLoginPage() {
  const [, navigate]  = useLocation();
  const [mode, setMode]             = useState<Mode>("login");
  const [email, setEmail]           = useState("");
  const [code, setCode]             = useState("");
  const [showCode, setShowCode]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [resendSent, setResendSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !code.trim()) { setError("Email dan kode member wajib diisi."); return; }
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/academy/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Login gagal. Periksa email dan kode member kamu."); return; }
      navigate(`/portal/${data.enrollmentId}`);
    } catch { setError("Koneksi bermasalah. Coba lagi."); }
    finally { setLoading(false); }
  }

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email wajib diisi."); return; }
    setLoading(true); setError("");
    try {
      await fetch("/api/course-members/resend-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendSent(true);
    } catch { setError("Gagal mengirim. Coba lagi."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100dvh", background: BG, color: "#fff",
      fontFamily: FONT, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "28px 16px", position: "relative", overflowX: "hidden",
    }}>
      <style>{CSS}</style>
      <AcademyMesh />

      {/* Top accent line */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 10,
        background: `linear-gradient(to right, transparent, ${OR}, transparent)`,
      }} />

      {/* ── Wrapper ── */}
      <div className="ac-card" style={{ width: "100%", maxWidth: 440, position: "relative", zIndex: 1 }}>

        {/* Back link */}
        <a href="/courses" style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          color: "rgba(255,255,255,.4)", textDecoration: "none",
          fontSize: 13, fontWeight: 600, marginBottom: 36,
          transition: "color .18s",
        }}
          onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.75)")}
          onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.4)")}
        >
          <ArrowLeft size={14} /> Kembali ke Kelas
        </a>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          {/* Animated icon */}
          <div className="ac-icon-wrap" style={{
            width: 72, height: 72, borderRadius: 22,
            background: `linear-gradient(135deg, ${OR_DIM}, rgba(240,56,32,.06))`,
            border: `1.5px solid ${OR_BRD}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 22px",
            position: "relative",
          }}>
            <GraduationCap size={30} color={OR} strokeWidth={1.8} />
            {/* Sparkle corner */}
            <div style={{
              position: "absolute", top: -6, right: -6,
              width: 18, height: 18, borderRadius: "50%",
              background: OR, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 12px ${OR}88`,
            }}>
              <Sparkles size={9} color="#fff" />
            </div>
          </div>

          {/* Brand + title */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "3px 14px", borderRadius: 100,
            background: `${OR}12`, border: `1px solid ${OR}2c`,
            marginBottom: 14,
          }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".2em", color: OR, textTransform: "uppercase" }}>
              Frameless Academy
            </span>
          </div>

          <h1 style={{
            margin: "0 0 10px", fontSize: "clamp(24px,5vw,32px)",
            fontWeight: 900, letterSpacing: "-.045em", color: "#fff", lineHeight: 1.1,
          }}>
            {mode === "login" ? "Masuk ke Kelas" : "Kirim Ulang Akses"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "rgba(255,255,255,.38)", lineHeight: 1.72 }}>
            {mode === "login"
              ? "Gunakan email & kode member yang dikirim saat pendaftaran."
              : "Kami akan kirim ulang kode ke email yang terdaftar."}
          </p>
        </div>

        {/* ── Card ── */}
        <div style={{
          borderRadius: 26, padding: "32px 30px",
          background: "rgba(255,255,255,.028)",
          border: "1px solid rgba(255,255,255,.075)",
          borderTop: `1px solid ${OR}22`,
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: "0 32px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset",
        }}>

          {/* Mode toggle */}
          <div style={{
            display: "flex", gap: 3, padding: "4px",
            borderRadius: 14, background: "rgba(255,255,255,.04)",
            border: "1px solid rgba(255,255,255,.07)", marginBottom: 28,
          }}>
            {(["login", "resend"] as Mode[]).map(m => (
              <button
                key={m}
                className={`ac-tab ${mode === m ? "ac-tab-active" : "ac-tab-inactive"}`}
                onClick={() => { setMode(m); setError(""); setResendSent(false); }}
              >
                {m === "login" ? "Login Member" : "Kirim Ulang Kode"}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 12,
              border: "1px solid rgba(239,68,68,.22)",
              background: "rgba(239,68,68,.07)", marginBottom: 20,
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠</span>
              <p style={{ margin: 0, fontSize: 13, color: "#f87171", lineHeight: 1.5 }}>{error}</p>
            </div>
          )}

          {/* Resend success */}
          {resendSent && (
            <div style={{
              padding: "16px 18px", borderRadius: 16,
              border: "1px solid rgba(34,197,94,.2)",
              background: "rgba(34,197,94,.06)", marginBottom: 22,
              display: "flex", gap: 12, alignItems: "center",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "rgba(34,197,94,.14)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 18px rgba(34,197,94,.3)",
              }}>
                <Check size={17} color="#22c55e" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#4ade80" }}>Email terkirim!</p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(74,222,128,.55)" }}>Cek inbox dan folder spam kamu.</p>
              </div>
            </div>
          )}

          {/* ── Login Form ── */}
          {mode === "login" && (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Email */}
              <div>
                <label style={{
                  display: "block", marginBottom: 8,
                  fontSize: 10, fontWeight: 700, letterSpacing: ".16em",
                  textTransform: "uppercase", color: "rgba(255,255,255,.3)",
                }}>
                  Email Pendaftaran
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} color="rgba(255,255,255,.25)"
                    style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    ref={emailRef}
                    className="ac-input"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(""); }}
                    placeholder="email@kamu.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Kode member */}
              <div>
                <label style={{
                  display: "block", marginBottom: 8,
                  fontSize: 10, fontWeight: 700, letterSpacing: ".16em",
                  textTransform: "uppercase", color: "rgba(255,255,255,.3)",
                }}>
                  Kode Member
                </label>
                <div style={{ position: "relative" }}>
                  <Key size={15} color="rgba(255,255,255,.25)"
                    style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    className="ac-input"
                    type={showCode ? "text" : "password"}
                    value={code}
                    onChange={e => { setCode(e.target.value.toUpperCase()); if (error) setError(""); }}
                    placeholder="FRM-XXXXXX"
                    autoComplete="off"
                    style={{ paddingRight: 48, letterSpacing: ".1em", fontWeight: 700 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCode(p => !p)}
                    style={{
                      position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(255,255,255,.3)", padding: "4px", transition: "color .18s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.7)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.3)")}
                  >
                    {showCode ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,255,255,.22)" }}>
                  Format: <span style={{ fontFamily: "monospace", color: OR + "bb", fontWeight: 700 }}>FRM-XXXXXX</span>
                  {" "}— dikirim ke email saat pendaftaran berhasil.
                </p>
              </div>

              {/* Submit */}
              <button type="submit" className="ac-btn-primary" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? (
                  <>
                    <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "acSpin .75s linear infinite" }} />
                    Memverifikasi...
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Masuk ke Kelas
                    <ChevronRight size={14} />
                  </>
                )}
              </button>

              {/* Forgot code link */}
              <button
                type="button"
                onClick={() => { setMode("resend"); setError(""); }}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,255,255,.32)", fontSize: 13,
                  cursor: "pointer", fontFamily: FONT, textAlign: "center",
                  transition: "color .18s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.6)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.32)")}
              >
                Tidak ingat kode?{" "}
                <span style={{ color: OR, fontWeight: 700 }}>Kirim ulang →</span>
              </button>
            </form>
          )}

          {/* ── Resend Form ── */}
          {mode === "resend" && !resendSent && (
            <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label style={{
                  display: "block", marginBottom: 8,
                  fontSize: 10, fontWeight: 700, letterSpacing: ".16em",
                  textTransform: "uppercase", color: "rgba(255,255,255,.3)",
                }}>
                  Email Pendaftaran
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={15} color="rgba(255,255,255,.25)"
                    style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    className="ac-input"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(""); }}
                    placeholder="email@kamu.com"
                    autoComplete="email"
                  />
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "rgba(255,255,255,.22)", lineHeight: 1.55 }}>
                  Kami akan kirim ulang kode member jika email terdaftar dan pembayaran sudah aktif.
                </p>
              </div>

              <button type="submit" className="ac-btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <div style={{ width: 15, height: 15, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "acSpin .75s linear infinite" }} />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Kirim Ulang Kode
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); }}
                style={{
                  background: "none", border: "none",
                  color: "rgba(255,255,255,.32)", fontSize: 13,
                  cursor: "pointer", fontFamily: FONT, textAlign: "center",
                  transition: "color .18s",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,.6)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,.32)")}
              >
                ← Kembali ke login
              </button>
            </form>
          )}

          {/* After resend: back to login */}
          {resendSent && (
            <button
              onClick={() => { setMode("login"); setResendSent(false); }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 14,
                border: "1px solid rgba(255,255,255,.09)",
                background: "rgba(255,255,255,.04)",
                color: "rgba(255,255,255,.75)", fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: FONT,
                transition: "background .18s, border-color .18s",
              }}
              onMouseEnter={e => { (e.currentTarget.style.background = "rgba(255,255,255,.07)"); (e.currentTarget.style.borderColor = "rgba(255,255,255,.16)"); }}
              onMouseLeave={e => { (e.currentTarget.style.background = "rgba(255,255,255,.04)"); (e.currentTarget.style.borderColor = "rgba(255,255,255,.09)"); }}
            >
              ← Kembali ke Login
            </button>
          )}
        </div>

        {/* ── Feature badges ── */}
        <div className="ac-social-row">
          <div className="ac-badge">
            <FeatureBadge icon={<Shield size={11} color="rgba(255,255,255,.4)" />} label="Data Aman & Terenkripsi" />
          </div>
          <div className="ac-badge">
            <FeatureBadge icon={<Lock size={11} color="rgba(255,255,255,.4)" />} label="Tidak Disimpan Browser" />
          </div>
          <div className="ac-badge">
            <FeatureBadge icon={<BookOpen size={11} color="rgba(255,255,255,.4)" />} label="Akses Seumur Hidup" />
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: "center", marginTop: 24,
          fontSize: 10, letterSpacing: ".14em",
          color: "rgba(255,255,255,.12)", textTransform: "uppercase",
        }}>
          Frameless Academy · {new Date().getFullYear()} · Belajar dari Sineas Aktif
        </p>
      </div>
    </div>
  );
}
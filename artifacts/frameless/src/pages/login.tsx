import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const OR   = "#FF6A20";
const FONT = "'Plus Jakarta Sans', sans-serif";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

@keyframes lgMesh1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(80px,-65px) scale(1.16);}66%{transform:translate(-40px,80px) scale(0.9);}}
@keyframes lgMesh2{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-90px,60px) scale(0.88);}66%{transform:translate(60px,-90px) scale(1.2);}}
@keyframes lgMesh3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,60px) scale(1.12);}}
@keyframes lgFadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes lgSpin{to{transform:rotate(360deg);}}
@keyframes lgPulse{0%,100%{opacity:.55;transform:scale(1);}50%{opacity:1;transform:scale(1.2);}}
@keyframes lgScanline{0%{transform:translateY(-100vh);}100%{transform:translateY(100vh);}}
@keyframes lgGlow{0%,100%{box-shadow:0 0 28px ${OR}30,0 0 0 1px ${OR}20;}50%{box-shadow:0 0 56px ${OR}66,0 0 80px ${OR}22,0 0 0 1px ${OR}44;}}
@keyframes lgShimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
@keyframes lgCornerSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}

.lg-card{animation:lgFadeUp .7s cubic-bezier(.16,1,.3,1) both;}
.lg-icon{animation:lgGlow 3.8s ease-in-out infinite;}

.lg-input{
  width:100%; padding:13px 16px;
  background:rgba(255,255,255,.038);
  border:1px solid rgba(255,255,255,.09);
  border-radius:13px; color:#fff; font-size:14px;
  font-family:${FONT}; outline:none;
  transition:border-color .18s ease, background .18s ease, box-shadow .18s ease;
}
.lg-input:focus{
  border-color:${OR}55;
  background:rgba(255,106,32,.04);
  box-shadow:0 0 0 3px ${OR}12;
}
.lg-input::placeholder{color:rgba(255,255,255,.18);}

.lg-btn{
  width:100%; padding:14px; border-radius:13px;
  background:linear-gradient(135deg, ${OR} 0%, #e04010 100%);
  border:none; color:#fff; font-size:14px; font-weight:800;
  letter-spacing:.055em; font-family:${FONT};
  cursor:pointer; position:relative; overflow:hidden;
  transition:opacity .18s, transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s;
  text-transform:uppercase; box-shadow:0 8px 30px ${OR}3c;
}
.lg-btn::after{
  content:''; position:absolute; inset:0;
  background:linear-gradient(to right, transparent, rgba(255,255,255,.1) 50%, transparent);
  background-size:200% 100%;
  animation:lgShimmer 3s ease infinite;
  pointer-events:none;
}
.lg-btn:hover:not(:disabled){
  opacity:.93;
  transform:translateY(-1px) scale(1.01);
  box-shadow:0 14px 44px ${OR}55,0 0 28px ${OR}28;
}
.lg-btn:active:not(:disabled){transform:scale(0.97);transition-duration:.08s;}
.lg-btn:disabled{opacity:.5;cursor:not-allowed;}

.lg-show-btn{
  position:absolute; right:14px; top:50%; transform:translateY(-50%);
  background:none; border:none; cursor:pointer;
  color:rgba(255,255,255,.28); font-size:14px; padding:4px 6px;
  transition:color .18s; line-height:1;
}
.lg-show-btn:hover{color:rgba(255,255,255,.65);}

/* ── Animated corner ring behind icon ── */
.lg-corner-ring{
  position:absolute; inset:-6px;
  border-radius:22px;
  border:1px solid transparent;
  background:conic-gradient(from 0deg, ${OR}00 0%, ${OR}55 30%, ${OR}00 60%) border-box;
  -webkit-mask:linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite:destination-out;
  mask-composite:exclude;
  animation:lgCornerSpin 4s linear infinite;
  pointer-events:none;
}
`;

// ── Mesh Background ───────────────────────────────────────────────────────────
function Mesh() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: "72%", height: "72%", top: "-22%", left: "-14%", background: `radial-gradient(ellipse at center, ${OR}44 0%, ${OR}1c 42%, transparent 70%)`, filter: "blur(65px)", animation: "lgMesh1 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "66%", height: "66%", top: "4%", right: "-20%", background: "radial-gradient(ellipse at center, rgba(124,58,237,.38) 0%, rgba(124,58,237,.14) 50%, transparent 74%)", filter: "blur(72px)", animation: "lgMesh2 23s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "56%", height: "56%", bottom: "-22%", left: "20%", background: "radial-gradient(ellipse at center, rgba(37,99,235,.28) 0%, transparent 72%)", filter: "blur(82px)", animation: "lgMesh3 28s ease-in-out infinite" }} />
      {/* Grid overlay */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.016) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.016) 1px, transparent 1px)", backgroundSize: "58px 58px" }} />
      {/* Scanline */}
      <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${OR}18, transparent)`, animation: "lgScanline 9s linear infinite", pointerEvents: "none" }} />
      {/* Vignette */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 36%, rgba(10,10,12,.88) 100%)" }} />
    </div>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast }    = useToast();
  const { login }    = useAuth();

  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors]   = useState<{ email?: string; password?: string }>({});
  const [showPass, setShowPass] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  function validate() {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Operator ID wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Format email tidak valid";
    if (!password.trim()) e.password = "Clearance Code wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const text = await res.text();
      let data: any = null;
      if (text) { try { data = JSON.parse(text); } catch { throw new Error(text || `Login failed with status ${res.status}`); } }
      if (!res.ok) throw new Error(data?.error || data?.message || text || "Invalid credentials");
      if (data?.token && data?.user) { login(data.token, data.user); }
      else if (data?.token) { localStorage.setItem("token", data.token); }
      else throw new Error("Token tidak ditemukan dari server");
      toast({ title: "Access Granted", description: "Welcome to Frameless Control." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Access Denied", description: err.message || "Invalid credentials" });
      setErrors({ password: err.message || "Invalid credentials" });
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100dvh", width: "100%", background: "#09090b",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden", fontFamily: FONT,
    }}>
      <style>{CSS}</style>
      <Mesh />

      {/* Top accent line */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 10, background: `linear-gradient(to right, transparent, ${OR}, transparent)` }} />

      {/* ── Card wrapper ── */}
      <div className="lg-card" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420, margin: "0 20px" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          {/* Icon with animated ring */}
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", marginBottom: 22 }}>
            <div className="lg-icon" style={{
              width: 60, height: 60, borderRadius: 18,
              background: `linear-gradient(135deg, ${OR}22, ${OR}0e)`,
              border: `1.5px solid ${OR}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", zIndex: 1,
            }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 24, letterSpacing: "-.03em" }}>F</span>
              <div className="lg-corner-ring" />
            </div>
          </div>

          <h1 style={{
            fontSize: 38, fontWeight: 900, color: "#fff",
            letterSpacing: ".16em", textTransform: "uppercase", marginBottom: 6,
            lineHeight: 1,
          }}>
            FRAMELESS
            <span style={{ color: OR, fontSize: 22, verticalAlign: "super", letterSpacing: "normal" }}>™</span>
          </h1>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".24em", color: "rgba(255,255,255,.28)", textTransform: "uppercase", marginBottom: 16 }}>
            Operational Control
          </p>

          {/* Status badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "5px 14px", borderRadius: 100,
            background: "rgba(74,222,128,.06)",
            border: "1px solid rgba(74,222,128,.14)",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "lgPulse 2s ease infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "rgba(74,222,128,.65)", textTransform: "uppercase" }}>All Systems Nominal</span>
          </div>
        </div>

        {/* ── Form card ── */}
        <div style={{
          background: "rgba(255,255,255,.028)",
          border: "1px solid rgba(255,255,255,.075)",
          borderTop: `1px solid ${OR}22`,
          borderRadius: 26,
          padding: "36px 32px",
          backdropFilter: "blur(28px)",
          WebkitBackdropFilter: "blur(28px)",
          boxShadow: "0 32px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04) inset",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* Email field */}
            <div>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                letterSpacing: ".18em", textTransform: "uppercase",
                color: errors.email ? "#f87171" : "rgba(255,255,255,.28)",
                marginBottom: 9,
              }}>
                Operator ID
              </label>
              <input
                ref={emailRef}
                className="lg-input"
                type="email"
                placeholder="admin@frameless.com"
                value={email}
                onChange={e => { setEmail(e.target.value); if (errors.email) setErrors(p => ({ ...p, email: undefined })); }}
                autoComplete="email"
                style={errors.email ? { borderColor: "rgba(248,113,113,.45)", background: "rgba(248,113,113,.05)" } : {}}
              />
              {errors.email && (
                <p style={{ fontSize: 11, color: "#f87171", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                  ⚠ {errors.email}
                </p>
              )}
            </div>

            {/* Password field */}
            <div>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                letterSpacing: ".18em", textTransform: "uppercase",
                color: errors.password ? "#f87171" : "rgba(255,255,255,.28)",
                marginBottom: 9,
              }}>
                Clearance Code
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="lg-input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
                  autoComplete="current-password"
                  style={{
                    paddingRight: 50,
                    ...(errors.password ? { borderColor: "rgba(248,113,113,.45)", background: "rgba(248,113,113,.05)" } : {}),
                  }}
                />
                <button type="button" className="lg-show-btn" onClick={() => setShowPass(p => !p)}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 11, color: "#f87171", marginTop: 6 }}>⚠ {errors.password}</p>}
            </div>

            {/* Submit */}
            <button type="submit" className="lg-btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "lgSpin .7s linear infinite", display: "inline-block" }} />
                  Authenticating...
                </span>
              ) : (
                "Initialize Session →"
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.065)", margin: "26px 0 22px" }} />

          {/* Security notice */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 15px", borderRadius: 12,
            background: "rgba(255,255,255,.025)",
            border: "1px solid rgba(255,255,255,.055)",
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>🔒</span>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.22)", lineHeight: 1.55, margin: 0 }}>
              Akses terbatas untuk operator resmi Frameless Creative. Semua sesi akan dicatat.
            </p>
          </div>

          {/* Crew link */}
          <p style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "rgba(255,255,255,.24)" }}>
            Anggota kru?{" "}
            <a href="/crew/login" style={{ color: OR, textDecoration: "none", fontWeight: 700, transition: "opacity .18s" }}
              onMouseEnter={e => (e.currentTarget.style.opacity = ".75")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Crew Login →
            </a>
          </p>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 26, fontSize: 10,
          letterSpacing: ".14em", color: "rgba(255,255,255,.1)", textTransform: "uppercase",
        }}>
          Frameless Creative · {new Date().getFullYear()} · Secured Access
        </p>
      </div>
    </div>
  );
}
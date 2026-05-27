import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@keyframes b1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(80px,-60px) scale(1.15);}66%{transform:translate(-40px,80px) scale(0.9);}}
@keyframes b2{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(-90px,60px) scale(0.88);}66%{transform:translate(60px,-90px) scale(1.2);}}
@keyframes b3{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(40px,60px) scale(1.12);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}
@keyframes scanline{0%{transform:translateY(-100%);}100%{transform:translateY(100vh);}}
.login-card{animation:fadeUp .7s cubic-bezier(.16,1,.3,1) both;}
.login-input{
  width:100%; padding:13px 16px;
  background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.1);
  border-radius:12px; color:#fff; font-size:14px;
  font-family:'Plus Jakarta Sans',sans-serif;
  outline:none; transition:border-color .2s, background .2s;
}
.login-input:focus{border-color:#FF6A2066; background:rgba(255,106,32,.05);}
.login-input::placeholder{color:rgba(255,255,255,.2);}
.login-btn{
  width:100%; padding:14px; border-radius:12px;
  background:#FF6A20; border:none; color:#fff;
  font-size:14px; font-weight:800; letter-spacing:.06em;
  font-family:'Plus Jakarta Sans',sans-serif;
  cursor:pointer; transition:opacity .2s, transform .15s;
  text-transform:uppercase;
}
.login-btn:hover:not(:disabled){opacity:.9; transform:translateY(-1px);}
.login-btn:active{transform:translateY(0);}
.login-btn:disabled{opacity:.55; cursor:not-allowed;}
`;

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans', sans-serif";

function Mesh() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", width: "70%", height: "70%", top: "-20%", left: "-15%", background: `radial-gradient(ellipse at center, ${OR}50 0%, ${OR}22 45%, transparent 68%)`, filter: "blur(60px)", animation: "b1 18s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "65%", height: "65%", top: "5%", right: "-20%", background: "radial-gradient(ellipse at center, #7c3aed44 0%, #7c3aed18 50%, transparent 72%)", filter: "blur(70px)", animation: "b2 22s ease-in-out infinite" }} />
      <div style={{ position: "absolute", width: "55%", height: "55%", bottom: "-20%", left: "22%", background: "radial-gradient(ellipse at center, #2563eb35 0%, transparent 70%)", filter: "blur(80px)", animation: "b3 26s ease-in-out infinite" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.018) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(to right,transparent,rgba(255,106,32,.15),transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 100% 100% at 50% 50%,transparent 40%,rgba(10,10,12,.85) 100%)" }} />
    </div>
  );
}

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPass, setShowPass] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

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
      const baseUrl = "";

console.log("API BASE:", baseUrl);
console.log("LOGIN URL:", `${baseUrl}/api/auth/login`);


      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const text = await res.text();
      let data: any = null;

      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(text || `Login failed with status ${res.status}`);
        }
      }

      if (!res.ok) {
        throw new Error(data?.error || data?.message || text || "Invalid credentials");
      }

      if (data?.token && data?.user) {
        login(data.token, data.user);
      } else if (data?.token) {
        localStorage.setItem("token", data.token);
      } else {
        throw new Error("Token tidak ditemukan dari server");
      }

      toast({ title: "Access Granted", description: "Welcome to Frameless Control." });
      navigate("/dashboard");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Access Denied",
        description: err.message || "Invalid credentials",
      });
      setErrors({ password: err.message || "Invalid credentials" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", width: "100%",
      background: "#0a0a0c",
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: FONT,
    }}>
      <style>{CSS}</style>
      <Mesh />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${OR}, transparent)` }} />
      <div className="login-card" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 420, margin: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${OR}, #e84d00)`, marginBottom: 20, boxShadow: `0 0 40px ${OR}55` }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 22, letterSpacing: "-.02em" }}>F</span>
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 900, color: "#fff",
            letterSpacing: ".18em", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            FRAMELESS
            <span style={{ color: OR, fontSize: 22, verticalAlign: "super", letterSpacing: "normal" }}>™</span>
          </h1>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".22em", color: "rgba(255,255,255,.35)", textTransform: "uppercase" }}>
            Operational Control
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14, padding: "4px 12px", borderRadius: 100, background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.15)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", animation: "pulse 2s ease infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", color: "rgba(74,222,128,.7)", textTransform: "uppercase" }}>System Online</span>
          </div>
        </div>

        <div style={{
          background: "rgba(255,255,255,.032)",
          border: "1px solid rgba(255,255,255,.08)",
          borderTop: `1px solid ${OR}28`,
          borderRadius: 24,
          padding: "36px 32px",
          backdropFilter: "blur(24px)",
          boxShadow: "0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                letterSpacing: ".18em", textTransform: "uppercase",
                color: errors.email ? "#f87171" : "rgba(255,255,255,.35)",
                marginBottom: 8,
              }}>
                Operator ID
              </label>
              <input
                ref={emailRef}
                className="login-input"
                type="email"
                placeholder="admin@frameless.com"
                value={email}
                onChange={e => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors(p => ({ ...p, email: undefined }));
                }}
                autoComplete="email"
                style={errors.email ? { borderColor: "rgba(248,113,113,.5)", background: "rgba(248,113,113,.06)" } : {}}
              />
              {errors.email && (
                <p style={{ fontSize: 11, color: "#f87171", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                  ⚠ {errors.email}
                </p>
              )}
            </div>

            <div>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 700,
                letterSpacing: ".18em", textTransform: "uppercase",
                color: errors.password ? "#f87171" : "rgba(255,255,255,.35)",
                marginBottom: 8,
              }}>
                Clearance Code
              </label>
              <div style={{ position: "relative" }}>
                <input
                  className="login-input"
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors(p => ({ ...p, password: undefined }));
                  }}
                  autoComplete="current-password"
                  style={{
                    paddingRight: 48,
                    ...(errors.password ? { borderColor: "rgba(248,113,113,.5)", background: "rgba(248,113,113,.06)" } : {}),
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{
                    position: "absolute", right: 14, top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,.3)", fontSize: 13, padding: "2px 4px",
                    transition: "color .2s",
                  }}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
              {errors.password && <p style={{ fontSize: 11, color: "#f87171", marginTop: 5 }}>⚠ {errors.password}</p>}
            </div>

            <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: 4 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", animation: "spin .7s linear infinite", display: "inline-block" }} />
                  Authenticating...
                </span>
              ) : (
                "Initialize Session →"
              )}
            </button>
          </form>

          <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", margin: "24px 0 20px" }} />

          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: 10,
            background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
          }}>
            <span style={{ fontSize: 13 }}>🔒</span>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.25)", lineHeight: 1.5 }}>
              Akses terbatas untuk operator resmi Frameless Creative. Semua sesi akan dicatat.
            </p>
          </div>

          <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "rgba(255,255,255,.25)" }}>
            Anggota kru?{" "}
            <a href="/crew/login" style={{ color: OR, textDecoration: "none", fontWeight: 700 }}>
              Crew Login →
            </a>
          </p>
        </div>

        <p style={{
          textAlign: "center", marginTop: 24, fontSize: 10,
          letterSpacing: ".14em", color: "rgba(255,255,255,.12)", textTransform: "uppercase",
        }}>
          Frameless Creative · {new Date().getFullYear()} · All Systems Nominal
        </p>
      </div>
    </div>
  );
}
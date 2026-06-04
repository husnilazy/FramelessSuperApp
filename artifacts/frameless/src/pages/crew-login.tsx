import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";

async function fetchCrewBranding() {
  try {
    const [cmsRes, logosRes] = await Promise.all([
      fetch("/api/cms").then(r => r.json()).catch(() => ({})),
      fetch("/api/site-logos").then(r => r.json()).catch(() => []),
    ]);
    const cms = cmsRes || {};
    const logos = Array.isArray(logosRes) ? logosRes : [];
    let logoUrl = cms.crew?.logoUrl || cms.branding?.logoUrl || "";
    if (!logoUrl) {
      const active = logos.find((l: any) => l.isActive) || logos[0];
      logoUrl = active?.imageUrl || "";
    }
    return {
      logoUrl,
      companyName: cms.branding?.companyName || cms.hero?.headline1 || "Frameless Creative",
    };
  } catch {
    return { logoUrl: "", companyName: "Frameless Creative" };
  }
}

export default function CrewLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [branding, setBranding] = useState({ logoUrl: "", companyName: "Frameless Creative" });
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    fetchCrewBranding().then(setBranding);
    const saved = localStorage.getItem("theme");
    if (saved) setIsDark(saved === "dark");
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/crew/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      localStorage.setItem("crew_token", data.token);
      localStorage.setItem("crew_user", JSON.stringify(data.member || data.user || data.crew));
      navigate("/crew/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Login gagal" });
    } finally { setLoading(false); }
  };

  const glass = isDark
    ? { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)", text: "#f8fafc", muted: "rgba(255,255,255,0.55)" }
    : { bg: "rgba(255,255,255,0.85)", border: "rgba(15,23,42,0.12)", text: "#0f172a", muted: "rgba(15,23,42,0.6)" };

  const primary = "#FF6A20";

  const logoEl = branding.logoUrl ? (
    <img src={branding.logoUrl} alt={branding.companyName} style={{ maxHeight: 48, maxWidth: 150, objectFit: "contain" }} />
  ) : (
    <div style={{ width: 52, height: 52, borderRadius: 14, background: primary, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 20, color: "#fff" }}>F</div>
  );

  return (
    <div style={{
      minHeight: "100dvh",
      background: isDark ? "#050505" : "#f1f3f7",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Plus Jakarta Sans', sans-serif", color: glass.text, padding: 20,
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: isDark
          ? `radial-gradient(55% 55% at 50% 25%, ${primary}18 0%, transparent 70%)`
          : `radial-gradient(50% 50% at 50% 30%, ${primary}12 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ position: "relative", width: "100%", maxWidth: 420, zIndex: 1 }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>{logoEl}</div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: "-0.02em" }}>Crew Portal</h1>
          <p style={{ margin: "6px 0 0", color: glass.muted, fontSize: 14 }}>{branding.companyName}</p>
        </div>

        <div style={{
          background: glass.bg,
          border: `1px solid ${glass.border}`,
          borderRadius: 20,
          padding: 32,
          backdropFilter: "blur(20px)",
          boxShadow: isDark ? "0 10px 40px rgba(0,0,0,0.35)" : "0 10px 30px rgba(15,23,42,0.08)",
        }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button onClick={toggleTheme} style={{ background: "transparent", border: "none", color: glass.muted, cursor: "pointer", padding: 4 }}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: glass.muted, display: "block", marginBottom: 6 }}>Email</label>
              <input
                type="email" required value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                style={{ width: "100%", background: isDark ? "rgba(0,0,0,0.25)" : "#fff", border: `1px solid ${glass.border}`, borderRadius: 10, padding: "12px 14px", color: glass.text, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                placeholder="crew@frameless.id"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: glass.muted, display: "block", marginBottom: 6 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPw ? "text" : "password"} required value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ width: "100%", background: isDark ? "rgba(0,0,0,0.25)" : "#fff", border: `1px solid ${glass.border}`, borderRadius: 10, padding: "12px 44px 12px 14px", color: glass.text, fontSize: 15, outline: "none", boxSizing: "border-box" }}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: glass.muted, cursor: "pointer" }}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} style={{
              width: "100%", background: primary, border: "none", borderRadius: 12, padding: "14px 0",
              color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
              boxShadow: `0 4px 14px ${primary}40`,
            }}>
              {loading ? "Masuk..." : "Masuk ke Dashboard"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 18 }}>
          <a href="/login" style={{ color: glass.muted, fontSize: 12, textDecoration: "none" }}>Admin Login →</a>
        </div>
      </motion.div>
    </div>
  );
}


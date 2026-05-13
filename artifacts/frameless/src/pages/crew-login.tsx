import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Film, Eye, EyeOff } from "lucide-react";

export default function CrewLoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
      localStorage.setItem("crew_member", JSON.stringify(data.member));
      navigate("/crew/dashboard");
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message || "Login gagal" });
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(255,107,53,0.08) 0%, transparent 70%)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: "400px", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{ width: "56px", height: "56px", background: "rgba(255,107,53,0.1)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Film size={24} color="#ff6b35" />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", color: "#fff", letterSpacing: "-0.5px" }}>Crew Portal</h1>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginTop: "6px" }}>FRAMELESS CREATIVE</p>
        </div>

        <form onSubmit={handleLogin} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "20px", padding: "32px" }}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "8px" }}>Email</label>
            <input
              type="email" required value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 16px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
              placeholder="email@crew.com"
            />
          </div>
          <div style={{ marginBottom: "28px" }}>
            <label style={{ fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", display: "block", marginBottom: "8px" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} required value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "12px 44px 12px 16px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" }}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", background: "#ff6b35", border: "none", borderRadius: "10px", padding: "14px", color: "#fff", fontWeight: "700", fontSize: "15px", cursor: "pointer", letterSpacing: "0.5px" }}>
            {loading ? "Masuk..." : "Masuk ke Dashboard"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <a href="/login" style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", textDecoration: "none" }}>Admin Login →</a>
        </div>
      </div>
    </div>
  );
}

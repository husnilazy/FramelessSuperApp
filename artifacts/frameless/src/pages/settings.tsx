import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Settings, User, Building2, Shield, Database,
  Globe, Clock, Lock, ChevronRight,
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();

  const initial = user?.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <div className="space-y-8 pb-10 max-w-2xl">

      {/* ── Page Header ── */}
      <div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold mt-1.5">
          System Configuration
        </p>
      </div>

      {/* ── OPERATOR PROFILE ── */}
      <Card className="glass-panel border-white/8 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-primary" /> Operator Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className="w-16 h-16 rounded-2xl border-2 border-primary/35 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(var(--primary)/.2), hsl(var(--primary)/.08))" }}
              >
                <span className="text-primary font-black text-2xl">{initial}</span>
              </div>
              {/* Online dot */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 border-2 border-card" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-foreground truncate">{user?.name || "Admin"}</h3>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="text-xs bg-primary/15 text-primary border-primary/25 uppercase tracking-wider font-bold">
                  {user?.role || "Admin"}
                </Badge>
                <span className="text-xs text-green-500 flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" style={{ animation: "pulse 2s ease infinite" }} />
                  Online
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── COMPANY ── */}
      <Card className="glass-panel border-white/8 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-primary" /> Company
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={<Building2 className="w-3 h-3" />} label="Company Name"  value="Frameless Creative" />
          <InfoRow icon={<Globe     className="w-3 h-3" />} label="Sub-brands"    value="STUDIODO · ZENSVISUAL" />
          <InfoRow icon={<Settings  className="w-3 h-3" />} label="Industry"      value="Video Production" />
          <InfoRow icon={<Database  className="w-3 h-3" />} label="Base Currency" value="IDR (Indonesian Rupiah)" />
          <InfoRow icon={<ChevronRight className="w-3 h-3" />} label="Tax Rate"   value="11% (PPN)" />
        </CardContent>
      </Card>

      {/* ── SECURITY ── */}
      <Card className="glass-panel border-white/8 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={<Shield className="w-3 h-3" />} label="Authentication" value="Token-based" />
          <InfoRow icon={<Clock  className="w-3 h-3" />} label="Session Type"   value="In-memory (expires on restart)" />
          <InfoRow icon={<Lock   className="w-3 h-3" />} label="Access Level"   value="Role-based (Admin / Manager / Member)" />
        </CardContent>
      </Card>

      {/* ── SYSTEM ── */}
      <Card className="glass-panel border-white/8 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-primary" /> System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow icon={<Database className="w-3 h-3" />} label="Stack"   value="React + Vite · Express · Drizzle ORM · PostgreSQL" />
          <InfoRow icon={<Settings className="w-3 h-3" />} label="Design"  value="Glassmorphism · Dark Theme · Plus Jakarta Sans" />
          <InfoRow icon={<Globe    className="w-3 h-3" />} label="Hosting" value="Vercel + Supabase (Singapore)" />
          <InfoRow icon={<ChevronRight className="w-3 h-3" />} label="Version" value="1.0.0-alpha" />
        </CardContent>
      </Card>

      {/* ── Danger zone ── */}
      <Card className="border-red-500/18 bg-red-500/4 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-widest text-red-400/70 font-semibold flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-red-400/70" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Logout dari semua sesi</p>
              <p className="text-xs text-muted-foreground mt-0.5">Hapus token dan keluar dari platform.</p>
            </div>
            <a
              href="/login"
              onClick={() => { localStorage.removeItem("token"); }}
              className="px-4 py-2 rounded-xl border border-red-500/25 text-red-400 text-xs font-bold bg-red-500/8 hover:bg-red-500/14 hover:border-red-500/4 transition-all"
            >
              Logout
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-component: info row ───────────────────────────────────────────────────
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/4 last:border-0 group">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground/50 group-hover:text-primary/60 transition-colors">{icon}</span>
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <span className="text-sm text-foreground font-semibold text-right max-w-[55%] truncate">{value}</span>
    </div>
  );
}
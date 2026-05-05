import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, User, Building2, Shield, Database } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 pb-8 max-w-2xl">
      <div>
        <h1 className="text-4xl font-heading tracking-wider text-white">Settings</h1>
        <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">System Configuration</p>
      </div>

      {/* Profile */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Operator Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/40 flex items-center justify-center">
              <span className="text-primary font-heading text-2xl">{user?.name?.charAt(0) || "A"}</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-white">{user?.name || "Admin"}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <Badge className="mt-1 text-xs border bg-primary/20 text-primary border-primary/30 uppercase tracking-wider">
                {user?.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Company
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Company Name" value="Frameless Creative" />
          <InfoRow label="Sub-brands" value="STUDIODO · ZENSVISUAL" />
          <InfoRow label="Industry" value="Video Production" />
          <InfoRow label="Base Currency" value="IDR (Indonesian Rupiah)" />
          <InfoRow label="Tax Rate" value="11% (PPN)" />
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Authentication" value="Token-based" />
          <InfoRow label="Session Type" value="In-memory (expires on restart)" />
          <InfoRow label="Access Level" value="Role-based (Admin / Manager / Member)" />
        </CardContent>
      </Card>

      {/* System */}
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="Stack" value="React + Vite · Express · Drizzle ORM · PostgreSQL" />
          <InfoRow label="Design" value="Glassmorphism · Dark Theme · Bebas Neue" />
          <InfoRow label="Version" value="1.0.0-alpha" />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-sm text-white font-medium">{value}</span>
    </div>
  );
}

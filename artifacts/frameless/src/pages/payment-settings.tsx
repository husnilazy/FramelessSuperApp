import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Building2, Smartphone, CreditCard, Key, Globe, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

interface PaymentSetting { id?: string; provider: string; label: string; isEnabled: boolean; config: string; }

const BANK_PROVIDERS = [
  { provider: "bca", label: "Bank BCA", icon: Building2, config: { accountNumber: "", accountName: "", bankName: "Bank Central Asia" } },
  { provider: "mandiri", label: "Bank Mandiri", icon: Building2, config: { accountNumber: "", accountName: "", bankName: "Bank Mandiri" } },
  { provider: "bni", label: "Bank BNI", icon: Building2, config: { accountNumber: "", accountName: "", bankName: "Bank BNI" } },
  { provider: "bri", label: "Bank BRI", icon: Building2, config: { accountNumber: "", accountName: "", bankName: "Bank BRI" } },
];
const EWALLET_PROVIDERS = [
  { provider: "gopay", label: "GoPay", icon: Smartphone, config: { phoneNumber: "", name: "" } },
  { provider: "ovo", label: "OVO", icon: Smartphone, config: { phoneNumber: "", name: "" } },
  { provider: "dana", label: "DANA", icon: Smartphone, config: { phoneNumber: "", name: "" } },
  { provider: "qris", label: "QRIS", icon: CreditCard, config: { merchantName: "", qrImageUrl: "" } },
];
const ALL_PROVIDERS = [...BANK_PROVIDERS, ...EWALLET_PROVIDERS];

const MIDTRANS_DEFAULTS = { serverKey: "", clientKey: "", isProduction: "false" };

function authHeader() {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function ConfigFields({ provider, config, onChange }: { provider: string; config: Record<string, string>; onChange: (k: string, v: string) => void }) {
  if (["bca", "mandiri", "bni", "bri"].includes(provider)) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nomor Rekening</label>
          <Input value={config.accountNumber || ""} onChange={e => onChange("accountNumber", e.target.value)} className="bg-muted/30 border-border" placeholder="1234-567-890" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nama Pemilik</label>
          <Input value={config.accountName || ""} onChange={e => onChange("accountName", e.target.value)} className="bg-muted/30 border-border" placeholder="PT Frameless Creative" />
        </div>
      </div>
    );
  }
  if (provider === "qris") {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Merchant Name</label>
          <Input value={config.merchantName || ""} onChange={e => onChange("merchantName", e.target.value)} className="bg-muted/30 border-border" placeholder="Frameless Creative" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">QR Code Image URL</label>
          <Input value={config.qrImageUrl || ""} onChange={e => onChange("qrImageUrl", e.target.value)} className="bg-muted/30 border-border" placeholder="https://..." />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nomor HP / Akun</label>
        <Input value={config.phoneNumber || ""} onChange={e => onChange("phoneNumber", e.target.value)} className="bg-muted/30 border-border" placeholder="08xxxxxxxxxx" />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Nama Akun</label>
        <Input value={config.name || ""} onChange={e => onChange("name", e.target.value)} className="bg-muted/30 border-border" placeholder="Frameless Creative" />
      </div>
    </div>
  );
}

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PaymentSetting[]>(ALL_PROVIDERS.map(p => ({ provider: p.provider, label: p.label, isEnabled: false, config: JSON.stringify(p.config) })));
  const [selected, setSelected] = useState("bca");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"manual" | "midtrans">("manual");
  const [midtrans, setMidtrans] = useState(MIDTRANS_DEFAULTS);
  const [midtransSaving, setMidtransSaving] = useState(false);

  useEffect(() => {
    fetch("/api/payment-settings", { headers: authHeader() as any })
      .then(r => r.json()).then((data: PaymentSetting[]) => {
        if (data?.length > 0) {
          const merged = ALL_PROVIDERS.map(def => {
            const found = data.find(d => d.provider === def.provider);
            return found || { provider: def.provider, label: def.label, isEnabled: false, config: JSON.stringify(def.config) };
          });
          setSettings(merged);
          const mt = data.find(d => d.provider === "midtrans");
          if (mt) { try { setMidtrans({ ...MIDTRANS_DEFAULTS, ...JSON.parse(mt.config) }); } catch {} }
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const current = settings.find(s => s.provider === selected);
  const sel = settings.find(s => s.provider === selected);
  const selConfig = sel ? (() => { try { return JSON.parse(sel.config); } catch { return {}; } })() : {};

  function updateConfig(k: string, v: string) {
    setSettings(prev => prev.map(s => s.provider === selected ? { ...s, config: JSON.stringify({ ...JSON.parse(s.config || "{}"), [k]: v }) } : s));
  }
  function toggleEnabled() {
    setSettings(prev => prev.map(s => s.provider === selected ? { ...s, isEnabled: !s.isEnabled } : s));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify(settings.map(s => ({ ...s, isEnabled: !!s.isEnabled }))),
      });
      if (res.ok) toast({ title: "Payment settings saved" });
      else toast({ variant: "destructive", title: "Failed to save" });
    } finally { setSaving(false); }
  }

  async function saveMidtrans() {
    setMidtransSaving(true);
    try {
      const res = await fetch("/api/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify([{ provider: "midtrans", label: "Midtrans", isEnabled: true, config: JSON.stringify(midtrans) }]),
      });
      if (res.ok) toast({ title: "Midtrans settings saved" });
      else toast({ variant: "destructive", title: "Failed to save Midtrans" });
    } finally { setMidtransSaving(false); }
  }

  const enabledCount = settings.filter(s => s.isEnabled).length;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Payment Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Kelola metode pembayaran dan integrasi payment gateway</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>{enabledCount} metode aktif</span>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-border w-fit">
        {([["manual", "💳 Manual Transfer"], ["midtrans", "🔒 Midtrans Gateway"]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all ${activeTab === t ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* MANUAL TRANSFER TAB */}
      {activeTab === "manual" && (
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Provider List */}
          <div className="col-span-4 space-y-3">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1">Bank Transfer</p>
              {BANK_PROVIDERS.map(p => {
                const s = settings.find(x => x.provider === p.provider);
                return (
                  <button key={p.provider} onClick={() => setSelected(p.provider)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${selected === p.provider ? "bg-primary/10 border border-primary/25 text-primary" : "bg-card/60 border border-border text-foreground hover:bg-muted/40"}`}>
                    <p.icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{p.label}</div>
                    </div>
                    {s?.isEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-1">E-Wallet & QRIS</p>
              {EWALLET_PROVIDERS.map(p => {
                const s = settings.find(x => x.provider === p.provider);
                return (
                  <button key={p.provider} onClick={() => setSelected(p.provider)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${selected === p.provider ? "bg-primary/10 border border-primary/25 text-primary" : "bg-card/60 border border-border text-foreground hover:bg-muted/40"}`}>
                    <p.icon className="w-4 h-4 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold truncate">{p.label}</div>
                    </div>
                    {s?.isEnabled ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Config */}
          <div className="col-span-8">
            {sel && (
              <Card className="glass-panel border-border">
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{sel.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Konfigurasi {sel.label}</p>
                    </div>
                    <button onClick={toggleEnabled}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${sel.isEnabled ? "bg-green-500/10 border-green-500/25 text-green-400" : "bg-muted/30 border-border text-muted-foreground"}`}>
                      {sel.isEnabled ? <><CheckCircle2 className="w-4 h-4" /> Aktif</> : <><XCircle className="w-4 h-4" /> Nonaktif</>}
                    </button>
                  </div>
                  <ConfigFields provider={selected} config={selConfig} onChange={updateConfig} />
                  <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl">
                    <Save className="w-4 h-4 mr-2" />{saving ? "Menyimpan..." : "Simpan Semua Settings"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* MIDTRANS TAB */}
      {activeTab === "midtrans" && (
        <div className="max-w-2xl space-y-5">
          <Card className="glass-panel border-border">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/8 border border-primary/20">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Midtrans Payment Gateway</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Mendukung QRIS, Transfer Bank, GoPay, OVO, ShopeePay, Kartu Kredit, dan lebih dari 20 metode pembayaran.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Environment</label>
                <div className="flex gap-3">
                  {[["false", "Sandbox (Testing)"], ["true", "Production"]].map(([v, l]) => (
                    <button key={v} onClick={() => setMidtrans(m => ({...m, isProduction: v}))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${midtrans.isProduction === v ? "bg-primary/12 border-primary/25 text-primary" : "bg-muted/25 border-border text-muted-foreground"}`}>
                      {midtrans.isProduction === v && "✓ "}{l}
                    </button>
                  ))}
                </div>
                {midtrans.isProduction === "true" && (
                  <p className="text-xs text-amber-400/80 flex items-center gap-1.5 mt-1">
                    ⚠️ Production mode aktif — transaksi nyata akan diproses
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Key className="w-3 h-3" /> Server Key
                </label>
                <Input
                  type="password"
                  value={midtrans.serverKey}
                  onChange={e => setMidtrans(m => ({...m, serverKey: e.target.value}))}
                  className="bg-muted/30 border-border font-mono text-sm"
                  placeholder={midtrans.isProduction === "true" ? "Mid-server-xxxxxxxxxxxxxxxx" : "SB-Mid-server-xxxxxxxxxxxxxxxx"}
                />
                <p className="text-[11px] text-muted-foreground">Digunakan di backend untuk memproses transaksi. Jangan share ke siapapun.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Globe className="w-3 h-3" /> Client Key
                </label>
                <Input
                  value={midtrans.clientKey}
                  onChange={e => setMidtrans(m => ({...m, clientKey: e.target.value}))}
                  className="bg-muted/30 border-border font-mono text-sm"
                  placeholder={midtrans.isProduction === "true" ? "Mid-client-xxxxxxxxxxxxxxxx" : "SB-Mid-client-xxxxxxxxxxxxxxxx"}
                />
                <p className="text-[11px] text-muted-foreground">Digunakan di frontend Midtrans Snap. Aman untuk di-expose ke client.</p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2">
                <p className="text-xs font-semibold text-foreground">Cara mendapatkan API Keys:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Login ke <span className="text-primary">dashboard.midtrans.com</span></li>
                  <li>Buka Settings → Access Keys</li>
                  <li>Copy Server Key dan Client Key sesuai environment</li>
                </ol>
              </div>

              <Button onClick={saveMidtrans} disabled={midtransSaving} className="w-full bg-primary hover:bg-primary/90 text-white rounded-xl">
                <Save className="w-4 h-4 mr-2" />{midtransSaving ? "Menyimpan..." : "Simpan Midtrans Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel border-border">
            <CardContent className="p-5">
              <h3 className="font-bold text-foreground mb-3 text-sm">Metode Pembayaran yang Didukung Midtrans</h3>
              <div className="flex flex-wrap gap-2">
                {["QRIS", "GoPay", "OVO", "Dana", "ShopeePay", "BCA", "Mandiri", "BNI", "BRI", "Permata", "CIMB", "Kartu Kredit/Debit", "Alfamart", "Indomaret"].map(m => (
                  <span key={m} className="px-2.5 py-1 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground border border-border">{m}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

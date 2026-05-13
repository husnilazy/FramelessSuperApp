import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, CreditCard, Building2, Smartphone, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface PaymentSetting {
  id?: string; provider: string; label: string; isEnabled: boolean; config: string;
}

const DEFAULT_PROVIDERS: PaymentSetting[] = [
  { provider: "bca", label: "Bank BCA", isEnabled: true, config: JSON.stringify({ accountNumber: "239-0777895", accountName: "FRAMELESS CREATIVE PROJECT PT", bankName: "Bank Central Asia" }) },
  { provider: "mandiri", label: "Bank Mandiri", isEnabled: false, config: JSON.stringify({ accountNumber: "", accountName: "", bankName: "Bank Mandiri" }) },
  { provider: "bni", label: "Bank BNI", isEnabled: false, config: JSON.stringify({ accountNumber: "", accountName: "", bankName: "Bank BNI" }) },
  { provider: "bri", label: "Bank BRI", isEnabled: false, config: JSON.stringify({ accountNumber: "", accountName: "", bankName: "Bank BRI" }) },
  { provider: "gopay", label: "GoPay", isEnabled: false, config: JSON.stringify({ phoneNumber: "", name: "" }) },
  { provider: "ovo", label: "OVO", isEnabled: false, config: JSON.stringify({ phoneNumber: "", name: "" }) },
  { provider: "dana", label: "DANA", isEnabled: false, config: JSON.stringify({ phoneNumber: "", name: "" }) },
  { provider: "qris", label: "QRIS", isEnabled: false, config: JSON.stringify({ merchantName: "", qrImageUrl: "" }) },
];

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ICONS: Record<string, any> = {
  bca: Building2, mandiri: Building2, bni: Building2, bri: Building2,
  gopay: Smartphone, ovo: Smartphone, dana: Smartphone, qris: CreditCard,
};

export default function PaymentSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<PaymentSetting[]>(DEFAULT_PROVIDERS);
  const [selected, setSelected] = useState("bca");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payment-settings", { headers: authHeader() as any })
      .then(r => r.json()).then((data: PaymentSetting[]) => {
        if (data && data.length > 0) {
          const merged = DEFAULT_PROVIDERS.map(def => {
            const found = data.find(d => d.provider === def.provider);
            return found || def;
          });
          setSettings(merged);
        }
      }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const current = settings.find(s => s.provider === selected)!;
  const configObj = (() => { try { return JSON.parse(current?.config || "{}"); } catch { return {}; } })();

  const updateConfig = (key: string, val: string) => {
    setSettings(prev => prev.map(s => s.provider === selected
      ? { ...s, config: JSON.stringify({ ...JSON.parse(s.config || "{}"), [key]: val }) }
      : s
    ));
  };

  const toggleEnabled = (provider: string) => {
    setSettings(prev => prev.map(s => s.provider === provider ? { ...s, isEnabled: !s.isEnabled } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(settings.map(s =>
        fetch(`/api/payment-settings/${s.provider}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeader() } as any,
          body: JSON.stringify({ label: s.label, isEnabled: s.isEnabled, config: s.config }),
        })
      ));
      toast({ title: "Payment settings tersimpan" });
    } catch {
      toast({ variant: "destructive", title: "Gagal menyimpan" });
    } finally { setSaving(false); }
  };

  const isBankTransfer = ["bca", "mandiri", "bni", "bri"].includes(selected);
  const isEwallet = ["gopay", "ovo", "dana"].includes(selected);

  return (
    <div className="pb-12 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wider text-white">Payment Gateway</h1>
          <p className="text-muted-foreground text-xs uppercase tracking-widest mt-1">Konfigurasi metode pembayaran</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 font-heading tracking-wider">
          <Save className="w-4 h-4 mr-2" />{saving ? "Menyimpan..." : "Simpan Semua"}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Provider List */}
        <div className="glass-panel rounded-xl p-4 border-white/10 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Metode Pembayaran</p>
          {settings.map(s => {
            const Icon = ICONS[s.provider] || CreditCard;
            return (
              <div key={s.provider}
                onClick={() => setSelected(s.provider)}
                className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${selected === s.provider ? "bg-primary/15 border border-primary/30" : "hover:bg-white/5 border border-transparent"}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.isEnabled ? "bg-primary/15" : "bg-white/5"}`}>
                    <Icon className={`w-4 h-4 ${s.isEnabled ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className="text-sm font-medium text-white">{s.label}</span>
                </div>
                {s.isEnabled
                  ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                  : <XCircle className="w-4 h-4 text-muted-foreground/40" />}
              </div>
            );
          })}
        </div>

        {/* Config Panel */}
        <div className="xl:col-span-2 glass-panel rounded-xl p-6 border-white/10 space-y-5">
          {current && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-white font-semibold text-lg">{current.label}</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <button
                    onClick={() => toggleEnabled(selected)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${current.isEnabled ? "bg-green-400/10 border-green-400/30 text-green-400" : "bg-white/5 border-white/10 text-muted-foreground"}`}
                  >
                    {current.isEnabled ? "Aktif" : "Nonaktif"}
                  </button>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              {isBankTransfer && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Bank</label>
                    <Input value={configObj.bankName || ""} onChange={e => updateConfig("bankName", e.target.value)} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nomor Rekening</label>
                    <Input value={configObj.accountNumber || ""} onChange={e => updateConfig("accountNumber", e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="xxx-xxxxxxx" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Pemilik Rekening</label>
                    <Input value={configObj.accountName || ""} onChange={e => updateConfig("accountName", e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="NAMA PERUSAHAAN" />
                  </div>
                </div>
              )}

              {isEwallet && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nomor HP / {current.label}</label>
                    <Input value={configObj.phoneNumber || ""} onChange={e => updateConfig("phoneNumber", e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="+62 xxx" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Akun</label>
                    <Input value={configObj.name || ""} onChange={e => updateConfig("name", e.target.value)} className="bg-white/5 border-white/10 text-white" />
                  </div>
                </div>
              )}

              {selected === "qris" && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">Nama Merchant</label>
                    <Input value={configObj.merchantName || ""} onChange={e => updateConfig("merchantName", e.target.value)} className="bg-white/5 border-white/10 text-white" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs uppercase tracking-wider text-muted-foreground">URL Gambar QR Code</label>
                    <Input value={configObj.qrImageUrl || ""} onChange={e => updateConfig("qrImageUrl", e.target.value)} className="bg-white/5 border-white/10 text-white" placeholder="https://..." />
                  </div>
                  {configObj.qrImageUrl && (
                    <div className="mt-2">
                      <img src={configObj.qrImageUrl} alt="QR" className="max-w-[200px] rounded-lg border border-white/10" />
                    </div>
                  )}
                </div>
              )}

              {current.isEnabled && (
                <div className="mt-4 p-4 rounded-xl bg-green-400/5 border border-green-400/15">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-semibold mb-1">
                    <CheckCircle2 className="w-4 h-4" /> Metode ini aktif di invoice
                  </div>
                  <p className="text-xs text-muted-foreground">Informasi pembayaran ini akan tampil di invoice yang dikirimkan ke klien.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Active Summary */}
      <div className="glass-panel rounded-xl p-5 border-white/10">
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-4">Metode Aktif</p>
        <div className="flex gap-3 flex-wrap">
          {settings.filter(s => s.isEnabled).map(s => {
            const Icon = ICONS[s.provider] || CreditCard;
            const cfg = (() => { try { return JSON.parse(s.config); } catch { return {}; } })();
            return (
              <div key={s.provider} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
                <Icon className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold text-white">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{cfg.accountNumber || cfg.phoneNumber || cfg.merchantName || "—"}</div>
                </div>
              </div>
            );
          })}
          {settings.every(s => !s.isEnabled) && <p className="text-sm text-muted-foreground">Belum ada metode pembayaran yang aktif</p>}
        </div>
      </div>
    </div>
  );
}

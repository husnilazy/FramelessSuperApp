import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { invalidateBrand } from "@/lib/brand";
import { ImageIcon, Loader2, Moon, Save, Sun, Upload } from "lucide-react";

interface Profile {
  companyName: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  logoUrl: string;
  logoDarkUrl: string;
  bankName: string;
  bankNumber: string;
  bankHolder: string;
  signerName: string;
}

const EMPTY: Profile = { companyName: "", address: "", email: "", phone: "", website: "", logoUrl: "", logoDarkUrl: "", bankName: "", bankNumber: "", bankHolder: "", signerName: "" };

function headers(): Record<string, string> {
  let t: string | null = null;
  try { t = localStorage.getItem("token"); } catch {}
  return { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

/** Pengaturan kop surat & rekening yang dipakai di Invoice, Kwitansi, dan Penawaran. */
export function CompanyProfileDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved?: () => void }) {
  const { toast } = useToast();
  const [p, setP] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const lightRef = useRef<HTMLInputElement>(null);
  const darkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/company-profile", { headers: headers() })
      .then((r) => r.json())
      .then((d) => setP({ ...EMPTY, ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v ?? ""])) } as Profile))
      .catch(() => toast({ variant: "destructive", title: "Gagal memuat profil perusahaan" }))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (k: keyof Profile, v: string) => setP((prev) => ({ ...prev, [k]: v }));

  const onLogo = (key: "logoUrl" | "logoDarkUrl") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // boleh pilih file yang sama lagi
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast({ variant: "destructive", title: "File harus berupa gambar" }); return; }
    if (f.size > 1.5 * 1024 * 1024) { toast({ variant: "destructive", title: "Logo maksimal 1,5 MB" }); return; }
    const r = new FileReader();
    r.onload = (ev) => ev.target?.result && set(key, ev.target.result as string);
    r.readAsDataURL(f);
  };

  const save = async () => {
    if (!p.companyName.trim()) { toast({ variant: "destructive", title: "Nama perusahaan wajib diisi" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/company-profile", { method: "PUT", headers: headers(), body: JSON.stringify(p) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Gagal menyimpan");
      toast({ title: "Pengaturan dokumen tersimpan" });
      invalidateBrand(); // logo & nama di sidebar/login ikut diperbarui
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: e.message });
    } finally {
      setSaving(false);
    }
  };

  const f = "bg-foreground/5 border-foreground/10 text-foreground";
  const l = "text-xs uppercase tracking-wider text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto bg-card border-foreground/10">
        <DialogHeader>
          <DialogTitle className="font-heading tracking-wider text-foreground text-xl">Pengaturan Dokumen</DialogTitle>
          <DialogDescription>Kop surat dan rekening ini dipakai di Invoice, Kwitansi, dan Penawaran.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className={l}>Logo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { key: "logoUrl", ref: lightRef, label: "Mode terang", hint: "Dipakai di tampilan terang, invoice, kwitansi & laporan. Pakai logo berwarna gelap.", bg: "#ffffff", icon: Sun },
                  { key: "logoDarkUrl", ref: darkRef, label: "Mode gelap", hint: "Dipakai di tampilan gelap. Pakai logo berwarna terang.", bg: "#0b0d12", icon: Moon },
                ] as const).map((slot) => (
                  <div key={slot.key} className="rounded-xl border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold flex items-center gap-1.5"><slot.icon className="w-3.5 h-3.5 text-primary" />{slot.label}</p>
                      {p[slot.key] && <button type="button" className="text-[11px] text-muted-foreground hover:text-destructive" onClick={() => set(slot.key, "")}>Hapus</button>}
                    </div>
                    <div className="h-20 rounded-lg grid place-items-center overflow-hidden border border-border" style={{ background: slot.bg }}>
                      {p[slot.key] ? <img src={p[slot.key]} alt={slot.label} className="max-h-14 max-w-[85%] object-contain" /> : <ImageIcon className="w-7 h-7 text-[#9ca3af]" />}
                    </div>
                    <input ref={slot.ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onLogo(slot.key)} />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => slot.ref.current?.click()}>
                      <Upload className="w-3.5 h-3.5 mr-2" /> {p[slot.key] ? "Ganti" : "Unggah"} logo
                    </Button>
                    <p className="text-[11px] text-muted-foreground leading-snug">{slot.hint}</p>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">PNG / SVG / JPG, maks 1,5 MB per file. Bila hanya satu yang diunggah, logo itu dipakai di kedua tema.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <label className={l}>Nama perusahaan *</label>
                <Input value={p.companyName} onChange={(e) => set("companyName", e.target.value)} className={f} placeholder="Frameless Creative Project PT" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={l}>Alamat</label>
                <Textarea value={p.address} onChange={(e) => set("address", e.target.value)} rows={2} className={`${f} resize-none`} />
              </div>
              <div className="space-y-1"><label className={l}>Email</label><Input value={p.email} onChange={(e) => set("email", e.target.value)} className={f} /></div>
              <div className="space-y-1"><label className={l}>Telepon / WA</label><Input value={p.phone} onChange={(e) => set("phone", e.target.value)} className={f} /></div>
              <div className="space-y-1 sm:col-span-2"><label className={l}>Website</label><Input value={p.website} onChange={(e) => set("website", e.target.value)} className={f} /></div>
            </div>

            <div className="rounded-lg border border-foreground/10 p-3 space-y-3">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Rekening pembayaran</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1"><label className={l}>Bank</label><Input value={p.bankName} onChange={(e) => set("bankName", e.target.value)} className={f} placeholder="Bank Central Asia (BCA)" /></div>
                <div className="space-y-1"><label className={l}>No. rekening</label><Input value={p.bankNumber} onChange={(e) => set("bankNumber", e.target.value)} className={f} placeholder="239-0777895" /></div>
                <div className="space-y-1"><label className={l}>Atas nama</label><Input value={p.bankHolder} onChange={(e) => set("bankHolder", e.target.value)} className={f} /></div>
              </div>
              <p className="text-[11px] text-muted-foreground">Kosongkan nomor rekening untuk memakai rekening bawaan.</p>
            </div>

            <div className="space-y-1">
              <label className={l}>Nama penerima di kwitansi (opsional)</label>
              <Input value={p.signerName} onChange={(e) => set("signerName", e.target.value)} className={f} placeholder="Mis. nama pemilik / bendahara" />
            </div>

            <Button onClick={save} disabled={saving} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider h-11">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Simpan Pengaturan
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

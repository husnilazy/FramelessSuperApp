import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Paintbrush, Palette, Layout, Sparkles, Check,
  Moon, Sun, Image as ImageIcon, Layers, Eye,
} from "lucide-react";

const PRESET_COLORS = [
  { name: "Frameless Orange", value: "#FF6A20", emoji: "🔥" },
  { name: "Electric Blue",    value: "#3b82f6", emoji: "⚡" },
  { name: "Amethyst Purple",  value: "#8b5cf6", emoji: "💜" },
  { name: "Emerald Green",    value: "#10b981", emoji: "🌿" },
  { name: "Rose Pink",        value: "#f43f5e", emoji: "🌸" },
  { name: "Golden Yellow",    value: "#f59e0b", emoji: "✨" },
];

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: "rgba(var(--primary-rgb, 255,106,32),.12)",
        border: "1px solid rgba(var(--primary-rgb, 255,106,32),.2)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 48, height: 26, borderRadius: 100, padding: "3px",
        border: "none", cursor: "pointer", flexShrink: 0,
        background: on ? "hsl(var(--primary))" : "hsl(var(--muted))",
        transition: "background .22s cubic-bezier(.16,1,.3,1)",
        boxShadow: on ? "0 0 14px hsl(var(--primary)/.35)" : "none",
        position: "relative",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transform: on ? "translateX(22px)" : "translateX(0)",
        transition: "transform .22s cubic-bezier(.34,1.56,.64,1)",
        boxShadow: "0 1px 4px rgba(0,0,0,.25)",
      }} />
    </button>
  );
}

export default function AppearanceSettingsPage() {
  const { theme, toggleTheme, appearance, updateAppearance } = useTheme();
  const { toast } = useToast();
  const [customColor, setCustomColor] = useState(appearance?.primaryColor || "#FF6A20");

  const dark = theme === "dark";

  function handleColorChange(color: string) {
    updateAppearance({ primaryColor: color });
    setCustomColor(color);
  }

  function toggleGlassmorphism() { updateAppearance({ glassmorphism: !appearance?.glassmorphism }); }
  function toggleMeshGradients()  { updateAppearance({ meshGradients:  !appearance?.meshGradients  }); }

  return (
    <div className="space-y-8 pb-14">
      {/* ── Page Header ── */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Paintbrush className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Appearance</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sesuaikan tema, warna, dan efek visual platform admin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── LEFT: Settings ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* THEME MODE */}
          <Card className="glass-panel border-border overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={<Layout className="w-4 h-4 text-primary" />}
                title="Mode Tampilan"
                subtitle="Pilih antara tema gelap atau terang"
              />
              <div className="flex gap-3">
                {[
                  { id: "light", label: "Light Mode", Icon: Sun,  active: !dark },
                  { id: "dark",  label: "Dark Mode",  Icon: Moon, active: dark  },
                ].map(({ id, label, Icon, active }) => (
                  <button
                    key={id}
                    onClick={() => theme !== id && toggleTheme()}
                    className={`flex-1 flex flex-col items-center gap-3 py-5 px-4 rounded-2xl border transition-all duration-200 ${
                      active
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card/40 border-border text-muted-foreground hover:bg-card/70 hover:border-border/80"
                    }`}
                    style={active ? { boxShadow: "0 0 24px hsl(var(--primary)/.18)" } : {}}
                  >
                    <Icon className="w-7 h-7" />
                    <span className="text-sm font-semibold">{label}</span>
                    {active && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/20 border border-primary/30 font-medium">
                        Aktif
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ACCENT COLOR */}
          <Card className="glass-panel border-border overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={<Palette className="w-4 h-4 text-primary" />}
                title="Warna Aksen"
                subtitle="Primary color untuk seluruh antarmuka"
              />

              {/* Preset grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-5">
                {PRESET_COLORS.map(color => {
                  const isActive = appearance?.primaryColor === color.value;
                  return (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                        isActive
                          ? "border-primary bg-primary/8"
                          : "border-border bg-card/40 hover:bg-card/70"
                      }`}
                      style={isActive ? { boxShadow: `0 0 16px ${color.value}28` } : {}}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-inner"
                        style={{ backgroundColor: color.value }}
                      >
                        {isActive
                          ? <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          : <span style={{ fontSize: 12 }}>{color.emoji}</span>
                        }
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">{color.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom color picker */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border">
                <div className="relative">
                  <input
                    type="color"
                    value={customColor}
                    onChange={e => handleColorChange(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                    style={{ padding: 2 }}
                  />
                  <div className="absolute inset-0 rounded-lg ring-1 ring-white/10 pointer-events-none" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Warna Kustom</p>
                  <p className="text-xs font-mono text-muted-foreground uppercase mt-0.5">{customColor}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* EFFECTS */}
          <Card className="glass-panel border-border overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={<Sparkles className="w-4 h-4 text-primary" />}
                title="Efek Visual"
                subtitle="Glassmorphism dan animasi latar belakang"
              />

              <div className="space-y-3">
                {[
                  {
                    label: "Glassmorphism UI",
                    desc: "Aktifkan efek transparansi dan blur pada sidebar, header, dan kartu.",
                    active: !!appearance?.glassmorphism,
                    toggle: toggleGlassmorphism,
                  },
                  {
                    label: "Animated Mesh Background",
                    desc: "Latar belakang gradasi warna bergerak yang indah di seluruh aplikasi.",
                    active: !!appearance?.meshGradients,
                    toggle: toggleMeshGradients,
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    onClick={item.toggle}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card/35 hover:bg-card/60 transition-all cursor-pointer group"
                  >
                    <div>
                      <p className="text-sm font-bold text-foreground group-hover:text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                    </div>
                    <Toggle on={item.active} onClick={item.toggle} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* BRANDING */}
          <Card className="glass-panel border-border overflow-hidden">
            <CardContent className="p-6">
              <SectionHeader
                icon={<ImageIcon className="w-4 h-4 text-primary" />}
                title="Branding & Logo"
                subtitle="Kustomisasi nama dan logo perusahaan"
              />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nama Perusahaan
                  </label>
                  <input
                    type="text"
                    value={appearance?.companyName || ""}
                    onChange={e => updateAppearance({ companyName: e.target.value })}
                    className="w-full bg-card/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    placeholder="Frameless Creative"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Logo URL
                  </label>
                  <input
                    type="url"
                    value={appearance?.logoUrl || ""}
                    onChange={e => updateAppearance({ logoUrl: e.target.value })}
                    className="w-full bg-card/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan logo huruf default.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── RIGHT: Live Preview ── */}
        <div>
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Preview Live</h3>
            </div>

            {/* Preview Card */}
            <div
              className={`rounded-2xl border overflow-hidden shadow-2xl transition-all duration-300 relative ${
                appearance?.glassmorphism
                  ? "bg-card/25 backdrop-blur-xl border-white/8"
                  : "bg-card border-border"
              }`}
            >
              {/* Fake BG mesh */}
              {appearance?.meshGradients && (
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-50">
                  <div
                    className="absolute w-[150%] h-[150%] -top-[25%] -left-[25%] opacity-25"
                    style={{ background: `radial-gradient(ellipse at center, ${appearance?.primaryColor || "#FF6A20"} 0%, transparent 55%)` }}
                  />
                </div>
              )}

              <div className="relative z-10 p-5">
                {/* Fake topbar */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2.5">
                    {appearance?.logoUrl ? (
                      <img src={appearance.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: appearance?.primaryColor || "#FF6A20" }}
                      >
                        <span className="text-white font-black text-sm">F</span>
                      </div>
                    )}
                    <span className="font-bold text-sm text-foreground truncate max-w-[110px]">
                      {appearance?.companyName || "Frameless"}
                    </span>
                  </div>
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: `${appearance?.primaryColor || "#FF6A20"}22` }}
                  >
                    <span className="font-bold text-xs" style={{ color: appearance?.primaryColor || "#FF6A20" }}>A</span>
                  </div>
                </div>

                {/* Fake stat card */}
                <div
                  className="h-24 rounded-xl p-4 flex flex-col justify-between mb-3"
                  style={{
                    background: `${appearance?.primaryColor || "#FF6A20"}12`,
                    border: `1px solid ${appearance?.primaryColor || "#FF6A20"}28`,
                  }}
                >
                  <div className="w-16 h-2.5 rounded" style={{ background: `${appearance?.primaryColor || "#FF6A20"}44` }} />
                  <div className="flex items-center justify-between">
                    <div className="w-20 h-6 rounded-lg" style={{ background: appearance?.primaryColor || "#FF6A20" }} />
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: `${appearance?.primaryColor || "#FF6A20"}20` }}
                    >
                      <Check className="w-4 h-4" style={{ color: appearance?.primaryColor || "#FF6A20" }} />
                    </div>
                  </div>
                </div>

                {/* Fake rows */}
                {[0, 1].map(i => (
                  <div
                    key={i}
                    className={`h-14 rounded-xl p-3.5 flex items-center gap-3 mb-2.5 ${
                      appearance?.glassmorphism ? "bg-white/5 border border-white/8" : "bg-muted/40 border border-border"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg shrink-0"
                      style={{ background: `${appearance?.primaryColor || "#FF6A20"}18` }}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="h-2 rounded bg-foreground/18" style={{ width: i === 0 ? "65%" : "78%" }} />
                      <div className="h-1.5 rounded bg-foreground/10" style={{ width: i === 0 ? "42%" : "55%" }} />
                    </div>
                  </div>
                ))}

                {/* Fake CTA */}
                <div className="mt-4 flex justify-end">
                  <button
                    className="px-4 py-2 rounded-xl text-white text-xs font-bold"
                    style={{
                      background: appearance?.primaryColor || "#FF6A20",
                      boxShadow: `0 4px 16px ${appearance?.primaryColor || "#FF6A20"}40`,
                    }}
                  >
                    Primary Action
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground/60 mt-4">
              Perubahan diterapkan secara langsung & otomatis.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
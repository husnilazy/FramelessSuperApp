import { useState } from "react";
import { useTheme } from "@/lib/theme";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Paintbrush, Palette, Layout, Sparkles, Check, Moon, Sun, Image as ImageIcon } from "lucide-react";

const PRESET_COLORS = [
  { name: "Frameless Orange", value: "#FF6A20" },
  { name: "Electric Blue", value: "#3b82f6" },
  { name: "Amethyst Purple", value: "#8b5cf6" },
  { name: "Emerald Green", value: "#10b981" },
  { name: "Rose Pink", value: "#f43f5e" },
  { name: "Golden Yellow", value: "#f59e0b" },
];

export default function AppearanceSettingsPage() {
  const { theme, toggleTheme, appearance, updateAppearance } = useTheme();
  const { toast } = useToast();
  const [customColor, setCustomColor] = useState(appearance?.primaryColor || "#FF6A20");

  const dark = theme === "dark";

  function handleColorChange(color: string) {
    updateAppearance({ primaryColor: color });
    setCustomColor(color);
  }

  function toggleGlassmorphism() {
    updateAppearance({ glassmorphism: !appearance?.glassmorphism });
  }

  function toggleMeshGradients() {
    updateAppearance({ meshGradients: !appearance?.meshGradients });
  }

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
          <Paintbrush className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Appearance</h1>
          <p className="text-sm text-muted-foreground mt-1">Sesuaikan tema, warna, dan efek visual platform admin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* THEME MODE */}
          <Card className="glass-panel border-border overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <Layout className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Mode Tampilan</h3>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => theme !== "light" && toggleTheme()}
                  className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all ${
                    !dark ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] text-primary" : "bg-card/40 border-border text-muted-foreground hover:bg-card/80"
                  }`}
                >
                  <Sun className="w-8 h-8" />
                  <span className="font-semibold text-sm">Light Mode</span>
                </button>
                <button
                  onClick={() => theme !== "dark" && toggleTheme()}
                  className={`flex-1 flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all ${
                    dark ? "bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)] text-primary" : "bg-card/40 border-border text-muted-foreground hover:bg-card/80"
                  }`}
                >
                  <Moon className="w-8 h-8" />
                  <span className="font-semibold text-sm">Dark Mode</span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* COLOR THEME */}
          <Card className="glass-panel border-border overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <Palette className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Warna Aksen (Primary Color)</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                {PRESET_COLORS.map(color => {
                  const isActive = appearance?.primaryColor === color.value;
                  return (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value)}
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        isActive ? "bg-primary/10 border-primary" : "bg-card/40 border-border hover:bg-card/80"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 shadow-inner" style={{ backgroundColor: color.value }}>
                        {isActive && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-xs font-semibold text-foreground truncate">{color.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border">
                <span className="text-sm font-medium text-foreground">Warna Kustom:</span>
                <input
                  type="color"
                  value={customColor}
                  onChange={e => handleColorChange(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
                />
                <span className="text-sm font-mono text-muted-foreground uppercase">{customColor}</span>
              </div>
            </CardContent>
          </Card>

          {/* EFFECTS & GLASSMORPHISM */}
          <Card className="glass-panel border-border overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Efek Visual & Glassmorphism</h3>
              </div>

              <div className="space-y-4">
                {/* Toggle 1 */}
                <div 
                  onClick={toggleGlassmorphism}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-colors cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-1">Glassmorphism UI</h4>
                    <p className="text-xs text-muted-foreground">Aktifkan efek transparansi dan blur (backdrop-filter) pada sidebar, header, dan kartu.</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${appearance?.glassmorphism ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${appearance?.glassmorphism ? "translate-x-6" : "translate-x-0"}`} />
                  </div>
                </div>

                {/* Toggle 2 */}
                <div 
                  onClick={toggleMeshGradients}
                  className="flex items-center justify-between p-4 rounded-xl border border-border bg-card/40 hover:bg-card/80 transition-colors cursor-pointer"
                >
                  <div>
                    <h4 className="text-sm font-bold text-foreground mb-1">Animated Mesh Background</h4>
                    <p className="text-xs text-muted-foreground">Tampilkan gradasi warna memutar yang indah sebagai latar belakang aplikasi.</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${appearance?.meshGradients ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${appearance?.meshGradients ? "translate-x-6" : "translate-x-0"}`} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BRANDING & LOGO */}
          <Card className="glass-panel border-border overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-3 mb-5">
                <ImageIcon className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Branding & Logo</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Nama Perusahaan (Brand Name)</label>
                  <input
                    type="text"
                    value={appearance?.companyName || ""}
                    onChange={e => updateAppearance({ companyName: e.target.value })}
                    className="w-full bg-card/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="Frameless Creative"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-foreground">Logo URL (opsional)</label>
                  <input
                    type="url"
                    value={appearance?.logoUrl || ""}
                    onChange={e => updateAppearance({ logoUrl: e.target.value })}
                    className="w-full bg-card/40 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary"
                    placeholder="https://example.com/logo.png"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Kosongkan untuk menggunakan logo huruf default.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Preview */}
        <div className="space-y-6">
          <div className="sticky top-24">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Preview</h3>
            
            <div className={`rounded-2xl border ${appearance?.glassmorphism ? "bg-card/30 backdrop-blur-xl border-white/10" : "bg-card border-border"} overflow-hidden shadow-2xl transition-all duration-300 relative`}>
              {/* Fake Background for Preview */}
              {appearance?.meshGradients && (
                <div className="absolute inset-0 z-0 overflow-hidden opacity-50 pointer-events-none">
                  <div className="absolute w-[150%] h-[150%] -top-[25%] -left-[25%] bg-[radial-gradient(ellipse_at_center,var(--primary-color)_0%,transparent_50%)] opacity-20" />
                </div>
              )}
              
              <div className="relative z-10 p-5">
                {/* Fake Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    {appearance?.logoUrl ? (
                      <img src={appearance.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold text-sm">F</span>
                      </div>
                    )}
                    <span className="font-bold text-sm text-foreground truncate max-w-[120px]">
                      {appearance?.companyName || "Frameless"}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold text-xs">A</span>
                  </div>
                </div>

                {/* Fake Content */}
                <div className="space-y-3">
                  <div className="h-24 rounded-xl bg-primary/10 border border-primary/20 p-4 flex flex-col justify-between">
                    <div className="w-16 h-3 rounded bg-primary/40" />
                    <div className="flex items-center justify-between">
                      <div className="w-24 h-6 rounded bg-primary" />
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center"><Check className="w-4 h-4 text-primary" /></div>
                    </div>
                  </div>
                  <div className={`h-16 rounded-xl ${appearance?.glassmorphism ? "bg-white/5 border border-white/10" : "bg-muted/50 border border-border"} p-4 flex items-center gap-3`}>
                     <div className="w-8 h-8 rounded-lg bg-primary/20" />
                     <div className="flex-1 space-y-2">
                       <div className="w-2/3 h-2 rounded bg-foreground/20" />
                       <div className="w-1/3 h-2 rounded bg-foreground/10" />
                     </div>
                  </div>
                  <div className={`h-16 rounded-xl ${appearance?.glassmorphism ? "bg-white/5 border border-white/10" : "bg-muted/50 border border-border"} p-4 flex items-center gap-3`}>
                     <div className="w-8 h-8 rounded-lg bg-primary/20" />
                     <div className="flex-1 space-y-2">
                       <div className="w-3/4 h-2 rounded bg-foreground/20" />
                       <div className="w-1/2 h-2 rounded bg-foreground/10" />
                     </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity">
                    Primary Action
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-center text-muted-foreground mt-4">
              Perubahan langsung diterapkan secara otomatis.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

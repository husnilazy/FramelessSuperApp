import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

/** Tema yang tampil (hasil akhir) dan preferensi pengguna (boleh "system"). */
type Theme = "dark" | "light";
export type ThemePreference = Theme | "system";

interface Appearance {
  primaryColor: string;
  glassmorphism: boolean;
  meshGradients: boolean;
  logoUrl?: string;
  companyName?: string;
  logoSize?: number;
}

interface ThemeContextValue {
  /** Tema yang sedang aktif (sudah memperhitungkan "system"). */
  theme: Theme;
  /** Pilihan pengguna: dark | light | system. */
  preference: ThemePreference;
  appearance: Appearance;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setPreference: (p: ThemePreference) => void;
  updateAppearance: (app: Partial<Appearance>) => void;
}

const defaultAppearance: Appearance = {
  primaryColor: "#FF6A20",
  glassmorphism: true,
  meshGradients: true,
  logoUrl: "",
  companyName: "",
  logoSize: 30,
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  preference: "dark",
  appearance: defaultAppearance,
  toggleTheme: () => {},
  setTheme: () => {},
  setPreference: () => {},
  updateAppearance: () => {},
});

const systemTheme = (): Theme =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";

function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem("theme");
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {}
  return "dark";
}

/** #rrggbb → [h, s%, l%] */
function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** Terapkan warna primer ke seluruh token (admin, dialog, tombol, ring, sidebar). */
function applyPrimary(hex: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary-color", hex);
  const hsl = hexToHsl(hex);
  if (!hsl) return;
  const [h, s, l] = hsl;
  const base = `${h} ${s}% ${l}%`;
  const strong = `${h} ${s}% ${Math.max(Math.min(l, 52) - 12, 28)}%`; // lebih gelap untuk teks di latar terang
  for (const k of ["--primary", "--ring", "--sidebar-primary", "--sidebar-ring", "--chart-1"]) root.style.setProperty(k, base);
  root.style.setProperty("--primary-strong", strong);
  const n = parseInt(hex.replace("#", ""), 16);
  root.style.setProperty("--primary-rgb", `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [system, setSystem] = useState<Theme>(systemTheme);
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const stored = localStorage.getItem("appearance");
      return stored ? { ...defaultAppearance, ...JSON.parse(stored) } : defaultAppearance;
    } catch { return defaultAppearance; }
  });

  const theme: Theme = preference === "system" ? system : preference;

  // ikuti perubahan tema sistem operasi
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    if (!mq) return;
    const h = () => setSystem(mq.matches ? "light" : "dark");
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    try { localStorage.setItem("theme", preference); } catch {}
  }, [theme, preference]);

  useEffect(() => {
    try { localStorage.setItem("appearance", JSON.stringify(appearance)); } catch {}
    applyPrimary(appearance.primaryColor);
  }, [appearance]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preference,
      appearance,
      setPreference: (p) => setPreferenceState(p),
      setTheme: (t) => setPreferenceState(t),
      toggleTheme: () => setPreferenceState(theme === "dark" ? "light" : "dark"),
      updateAppearance: (updates) => setAppearance((p) => ({ ...p, ...updates })),
    }),
    [theme, preference, appearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() { return useContext(ThemeContext); }

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface Appearance {
  primaryColor: string;
  glassmorphism: boolean;
  meshGradients: boolean;
  logoUrl?: string;
  companyName?: string;
  logoSize?: number;
}

interface ThemeContextValue {
  theme: Theme;
  appearance: Appearance;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  updateAppearance: (app: Partial<Appearance>) => void;
}

const defaultAppearance: Appearance = {
  primaryColor: "#FF6A20",
  glassmorphism: true,
  meshGradients: true,
  logoUrl: "",
  companyName: "Frameless",
  logoSize: 30,
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  appearance: defaultAppearance,
  toggleTheme: () => {},
  setTheme: () => {},
  updateAppearance: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem("theme") as Theme) || "dark"; } catch { return "dark"; }
  });
  const [appearance, setAppearance] = useState<Appearance>(() => {
    try {
      const stored = localStorage.getItem("appearance");
      return stored ? { ...defaultAppearance, ...JSON.parse(stored) } : defaultAppearance;
    } catch { return defaultAppearance; }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("appearance", JSON.stringify(appearance));
    const root = document.documentElement;
    root.style.setProperty("--primary-color", appearance.primaryColor);
    const hex = appearance.primaryColor.replace("#", "");
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      root.style.setProperty("--primary-rgb", `${r}, ${g}, ${b}`);
    }
  }, [appearance]);

  function setTheme(t: Theme) { setThemeState(t); }
  function toggleTheme() { setThemeState(p => p === "dark" ? "light" : "dark"); }
  function updateAppearance(updates: Partial<Appearance>) {
    setAppearance(p => ({ ...p, ...updates }));
  }

  return (
    <ThemeContext.Provider value={{ theme, appearance, toggleTheme, setTheme, updateAppearance }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() { return useContext(ThemeContext); }

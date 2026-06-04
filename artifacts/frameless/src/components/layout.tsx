// artifacts/frameless/src/components/layout.tsx
import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Film, Users, UsersRound, Receipt, PieChart,
  CreditCard, Settings, LogOut, Globe, BookOpen, Banknote,
  Users2, Sun, Moon, Package, ExternalLink, Menu, X,
  MessageSquare, ChevronRight, Paintbrush, Activity
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { AIChat } from "./ai-chat";

// ── Nav items ─────────────────────────────────────────────────────────────────
const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Operations" },
  { href: "/command-center", label: "Command Center", icon: Activity, group: "Operations" },
  { href: "/projects", label: "Projects", icon: Film, group: "Operations" },
  { href: "/team", label: "Crew", icon: Users, group: "Operations" },
  { href: "/clients", label: "Clients", icon: UsersRound, group: "Operations" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "Operations" },
  { href: "/expenses", label: "Expenses", icon: CreditCard, group: "Operations" },
  { href: "/finance", label: "Finance", icon: PieChart, group: "Operations" },
  { href: "/cms", label: "CMS Editor", icon: Globe, group: "Content" },
  { href: "/courses-admin", label: "Courses", icon: BookOpen, group: "Content" },
  { href: "/digital-assets-admin", label: "Digital Assets", icon: Package, group: "Content" },
  { href: "/payment-settings", label: "Payments", icon: Banknote, group: "Content" },
  { href: "/appearance", label: "Appearance", icon: Paintbrush, group: "System" },
  { href: "/settings", label: "Settings", icon: Settings, group: "System" },
];

// ── Theme-aware colors ────────────────────────────────────────────────────────
function useColors(theme: string, appearance: any) {
  const dark = theme === "dark";
  const OR = appearance?.primaryColor || "#FF6A20";
  return {
    OR,
    bg: dark ? "#0e1018" : "#f8f9fb",
    sidebar: appearance?.glassmorphism ? (dark ? "rgba(14,16,24,0.92)" : "rgba(255,255,255,0.92)") : (dark ? "#0e1018" : "#ffffff"),
    border: dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)",
    text: dark ? "#e8eaf0" : "#1a1d2e",
    muted: dark ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.4)",
    hover: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    activeBg: dark ? `${OR}1e` : `${OR}16`,
    mainBg: dark ? "rgba(255,255,255,0.01)" : "rgba(0,0,0,0.01)",
    label: dark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.25)",
  };
}

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ item, active, onClick, c }: { item: typeof NAV[0]; active: boolean; onClick?: () => void; c: ReturnType<typeof useColors> }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 12px", borderRadius: 12,
        background: active ? c.activeBg : "transparent",
        border: `1px solid ${active ? c.OR + "33" : "transparent"}`,
        color: active ? c.OR : c.muted,
        cursor: "pointer", transition: "all .18s",
        marginBottom: 2,
      }}
        onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = c.hover; (e.currentTarget as HTMLElement).style.color = c.text; } }}
        onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = c.muted; } }}
      >
        <Icon size={15} style={{ flexShrink: 0, color: active ? c.OR : "inherit" }} />
        <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, letterSpacing: "-.01em" }}>{item.label}</span>
        {active && <ChevronRight size={12} style={{ marginLeft: "auto", color: c.OR }} />}
      </div>
    </Link>
  );
}

// ── SidebarContent ────────────────────────────────────────────────────────────
function SidebarContent({ pathname, onNav, c, user, logout }: {
  pathname: string; onNav?: () => void;
  c: ReturnType<typeof useColors>;
  user: any; logout: () => void;
}) {
  const { theme, toggleTheme, appearance, updateAppearance } = useTheme();
  const groups = Array.from(new Set(NAV.map(n => n.group)));
  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  // Load logo from CMS (same as crew) so admin dashboard uses uploaded logo from CMS editor
  // Always fetch latest on mount to pick up size changes etc.
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/cms", { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : {})
        .then((data: any) => {
          const b = data?.branding || data || {};
          const updates: any = {};
          if (b.logoUrl) updates.logoUrl = b.logoUrl;
          if (b.logoSize) updates.logoSize = Number(b.logoSize) || 26;
          if (Object.keys(updates).length) {
            updateAppearance(updates);
          }
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      {/* Logo */}
      <div style={{ padding: "8px 16px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {appearance?.logoUrl ? (
            <img 
              src={appearance.logoUrl} 
              alt="Logo" 
              style={{ 
                height: appearance.logoSize || 28, 
                width: 'auto',
                maxWidth: 90,
                objectFit: "contain", 
                flexShrink: 0,
                borderRadius: 3
              }} 
            />
          ) : (
            <div style={{ width: 26, height: 26, borderRadius: 5, background: c.OR, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: c.text, letterSpacing: "-.02em" }}>Admin</span>
        </div>
      </div>

      <div style={{ height: 1, background: c.border, margin: "0 12px 8px" }} />

      {/* Nav groups */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "4px 12px", scrollbarWidth: "none" }}>
        {groups.map(group => (
          <div key={group} style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: c.label, padding: "0 4px", marginBottom: 6 }}>{group}</p>
            {NAV.filter(n => n.group === group).map(item => (
              <NavItem key={item.href} item={item} active={isActive(item.href)} onClick={onNav} c={c} />
            ))}
          </div>
        ))}

        {/* External links */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: c.label, padding: "0 4px", marginBottom: 6 }}>Public</p>
          {[
            { href: "/", label: "Landing Page", icon: ExternalLink, external: true },
            { href: "/crew/login", label: "Crew Portal", icon: Users2, external: true },
          ].map(link => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 12, color: c.muted, textDecoration: "none", transition: "all .18s", marginBottom: 2 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.hover; (e.currentTarget as HTMLElement).style.color = c.text; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = c.muted; }}>
              <link.icon size={15} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{link.label}</span>
              <ExternalLink size={10} style={{ marginLeft: "auto", opacity: .4 }} />
            </a>
          ))}
        </div>
      </nav>

      <div style={{ height: 1, background: c.border, margin: "0 12px" }} />

      {/* User + actions */}
      <div style={{ padding: "12px 12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", marginBottom: 8 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: c.OR + "22", border: `1.5px solid ${c.OR}44`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: c.OR, fontWeight: 800, fontSize: 13 }}>{user?.name?.charAt(0) || "A"}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: c.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name || "Admin"}</p>
            <p style={{ fontSize: 10, color: c.muted, margin: 0, textTransform: "uppercase", letterSpacing: ".08em" }}>{user?.role || "Administrator"}</p>
          </div>
          {/* Theme toggle */}
          <button onClick={toggleTheme}
            style={{ width: 30, height: 30, borderRadius: 8, background: c.hover, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.muted, flexShrink: 0 }}>
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
          </button>
        </div>

        <button onClick={logout}
          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 12, background: "transparent", border: "1px solid transparent", color: c.muted, cursor: "pointer", fontSize: 13, fontWeight: 500, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "all .18s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,.08)"; (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(239,68,68,.2)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = c.muted; (e.currentTarget as HTMLElement).style.borderColor = "transparent"; }}>
          <LogOut size={14} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── AppLayout ─────────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, appearance } = useTheme();
  const c = useColors(theme, appearance);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100dvh", width: "100%", background: c.bg, color: c.text, fontFamily: "'Plus Jakarta Sans',sans-serif", position: "relative" }}>

      {/* ── Mesh BG (subtle) ── */}
      {appearance?.meshGradients && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
          <div style={{ position: "absolute", width: "60%", height: "60%", top: "-10%", left: "-10%", background: `radial-gradient(ellipse at center,${c.OR}18 0%,transparent 65%)`, filter: "blur(80px)", animation: "b1 20s ease-in-out infinite" }} />
          <div style={{ position: "absolute", width: "50%", height: "50%", bottom: "-10%", right: "-10%", background: "radial-gradient(ellipse at center,#7c3aed14 0%,transparent 70%)", filter: "blur(90px)", animation: "b2 25s ease-in-out infinite" }} />
        </div>
      )}

      {/* ── Desktop Sidebar ── */}
      <aside style={{
        width: 232, flexShrink: 0, display: "flex", flexDirection: "column",
        background: c.sidebar, borderRight: `1px solid ${c.border}`,
        backdropFilter: appearance?.glassmorphism ? "blur(24px)" : "none", position: "sticky", top: 0, height: "100dvh",
        zIndex: 30, overflow: "hidden",
      }}
        className="hidden-mobile"
      >
        <SidebarContent pathname={location} c={c} user={user} logout={logout} />
      </aside>

      {/* ── Mobile Overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 40 }}
            />
            <motion.div
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              style={{
                position: "fixed", top: 0, left: 0, bottom: 0, width: 240,
                background: c.sidebar, backdropFilter: appearance?.glassmorphism ? "blur(24px)" : "none",
                borderRight: `1px solid ${c.border}`, zIndex: 50, overflow: "hidden",
              }}
            >
              <SidebarContent pathname={location} onNav={() => setMobileOpen(false)} c={c} user={user} logout={logout} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100dvh", overflow: "hidden", position: "relative", zIndex: 10 }}>

        {/* Mobile Header */}
        <header style={{
          display: "none", alignItems: "center", justifyContent: "space-between",
          padding: "0 18px", height: 58, flexShrink: 0,
          background: c.sidebar, backdropFilter: appearance?.glassmorphism ? "blur(24px)" : "none",
          borderBottom: `1px solid ${c.border}`, zIndex: 20,
        }}
          className="show-mobile"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {appearance?.logoUrl ? (
              <img 
                src={appearance.logoUrl} 
                alt="Logo" 
                style={{ 
                  height: appearance.logoSize || 24, 
                  width: 'auto',
                  maxWidth: 70,
                  objectFit: "contain", 
                  flexShrink: 0,
                  borderRadius: 3
                }} 
              />
            ) : (
              <div style={{ width: 26, height: 26, borderRadius: 6, background: c.OR, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 12 }}>F</span>
              </div>
            )}
            <span style={{ fontWeight: 700, fontSize: 12, color: c.text }}>Admin</span>
          </div>
          <button onClick={() => setMobileOpen(true)}
            style={{ width: 36, height: 36, borderRadius: 10, background: c.hover, border: `1px solid ${c.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: c.text }}>
            <Menu size={18} />
          </button>
        </header>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px" }} className="page-pad">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: .22, ease: "easeOut" }}
            style={{ maxWidth: 1400, margin: "0 auto" }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      <AIChat dark={theme === "dark"} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes b1{0%,100%{transform:translate(0,0);}50%{transform:translate(60px,-40px);}}
        @keyframes b2{0%,100%{transform:translate(0,0);}50%{transform:translate(-50px,60px);}}
        nav::-webkit-scrollbar{display:none;}
        @media(max-width:768px){
          .hidden-mobile{display:none!important;}
          .show-mobile{display:flex!important;}
          .page-pad{padding:18px 16px!important;}
        }
      `}</style>
    </div>
  );
}
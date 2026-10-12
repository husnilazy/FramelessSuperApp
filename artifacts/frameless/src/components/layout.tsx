// Shell admin: sidebar (bisa diciutkan), top bar, menu mobile (drawer + tab bawah), pencarian cepat.
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { ChevronLeft, ExternalLink, Menu, Moon, Search, Sun, LayoutGrid, Users2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { AIChat } from "./ai-chat";
import { PrintHost } from "./print-host";
import { InvoiceNotificationBell } from "./invoice-notifications";
import { BrandMark } from "./shell/brand-mark";
import { CommandMenu } from "./shell/command-menu";
import { UserMenu } from "./shell/user-menu";
import { ALL_NAV, MOBILE_TABS, NAV_GROUPS, crumbsFor, isNavActive, type NavItem } from "./shell/nav";

const COLLAPSE_KEY = "admin_sidebar_collapsed";

// ── Satu item menu ───────────────────────────────────────────────────────────
function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-colors outline-none",
        "focus-visible:ring-2 ring-ring",
        collapsed ? "h-11 w-11 justify-center mx-auto" : "h-10 px-3",
        active
          ? "bg-primary/12 text-primary font-semibold"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
      )}
    >
      {active && !collapsed && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />}
      <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-primary" : "opacity-80 group-hover:opacity-100")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip delayDuration={80}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

// ── Isi sidebar (dipakai desktop & drawer mobile) ────────────────────────────
function SidebarBody({
  pathname, collapsed, onToggle, onNavigate, showToggle,
}: { pathname: string; collapsed: boolean; onToggle?: () => void; onNavigate?: () => void; showToggle?: boolean }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <BrandMark compact={collapsed} />
        {showToggle && !collapsed && (
          <button
            onClick={onToggle}
            aria-label="Ciutkan sidebar"
            className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-5 [scrollbar-width:thin]">
        {NAV_GROUPS.map((g) => (
          <div key={g.id}>
            {collapsed ? (
              <div className="mx-3 mb-2 h-px bg-sidebar-border" />
            ) : (
              <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">{g.label}</p>
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} active={isNavActive(pathname, item.href)} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-sidebar-border p-3 space-y-0.5", collapsed && "flex flex-col items-center")}>
        {collapsed ? (
          <>
            <button onClick={onToggle} aria-label="Lebarkan sidebar" className="h-10 w-10 grid place-items-center rounded-xl text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </>
        ) : (
          <>
            <a href="/" target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
              <ExternalLink className="h-4 w-4" /> Lihat website
            </a>
            <a href="/crew/login" target="_blank" rel="noopener noreferrer" className="flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
              <Users2 className="h-4 w-4" /> Crew portal
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ── Layout utama ─────────────────────────────────────────────────────────────
export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);

  useEffect(() => { try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch {} }, [collapsed]);
  useEffect(() => { setDrawer(false); window.scrollTo({ top: 0 }); }, [location]);

  const crumb = crumbsFor(location);
  const tabs = MOBILE_TABS.map((h) => ALL_NAV.find((n) => n.href === h)!).filter(Boolean);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Latar halus: cahaya primer di sudut atas */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-72 -z-0 opacity-70"
        style={{ background: "radial-gradient(60% 100% at 85% 0%, hsl(var(--primary) / .10), transparent 70%)" }} />

      {/* Sidebar desktop */}
      <aside
        className={cn(
          "hidden lg:block fixed inset-y-0 left-0 z-30 border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out",
          collapsed ? "w-[76px]" : "w-[268px]",
        )}
      >
        <SidebarBody pathname={location} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} showToggle />
      </aside>

      {/* Drawer mobile */}
      <Sheet open={drawer} onOpenChange={setDrawer}>
        <SheetContent side="left" className="w-[290px] p-0 bg-sidebar border-sidebar-border [&>button]:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody pathname={location} collapsed={false} onNavigate={() => setDrawer(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn("relative z-10 transition-[padding] duration-200 ease-out", collapsed ? "lg:pl-[76px]" : "lg:pl-[268px]")}>
        {/* Top bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-full items-center gap-2 sm:gap-3 px-3 sm:px-6 lg:px-8">
            <button
              onClick={() => setDrawer(true)}
              aria-label="Buka menu"
              className="lg:hidden h-10 w-10 grid place-items-center rounded-xl border border-border bg-card text-foreground"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            <div className="lg:hidden min-w-0 flex-1 sm:flex-none"><BrandMark compact className="allow-logo" maxWidth={112} /></div>

            <div className="hidden lg:flex min-w-0 flex-1 items-center gap-2 text-sm">
              {crumb.parent && (
                <>
                  <Link href={crumb.parent.href} className="text-muted-foreground hover:text-foreground">{crumb.parent.label}</Link>
                  <span className="text-muted-foreground/50">/</span>
                </>
              )}
              <span className="font-semibold text-foreground truncate">{crumb.title}</span>
            </div>

            <div className="flex-1 lg:hidden" />

            <button
              onClick={() => setCmd(true)}
              className="hidden md:flex h-10 w-64 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground hover:border-foreground/20 transition-colors"
            >
              <Search className="h-4 w-4" />
              <span className="flex-1 text-left">Cari…</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>
            <button onClick={() => setCmd(true)} aria-label="Cari" className="md:hidden h-10 w-10 grid place-items-center rounded-xl border border-border bg-card">
              <Search className="h-[18px] w-[18px]" />
            </button>

            <button
              onClick={toggleTheme}
              aria-label="Ganti tema"
              className="h-10 w-10 grid place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <InvoiceNotificationBell />
            <UserMenu />
          </div>
        </header>

        {/* Konten */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mx-auto w-full max-w-[1480px]"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Tab bawah (mobile) */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((t) => {
            const active = isNavActive(location, t.href);
            return (
              <Link key={t.href} href={t.href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>
                <t.icon className="h-5 w-5" />
                {t.label}
              </Link>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold text-muted-foreground">
            <LayoutGrid className="h-5 w-5" />
            Menu
          </button>
        </div>
      </nav>

      <CommandMenu open={cmd} onOpenChange={setCmd} />
      <PrintHost />
      <AIChat dark={theme === "dark"} fabClassName="max-lg:bottom-24!" />
    </div>
  );
}

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Film, Users, UsersRound, Receipt, PieChart,
  CreditCard, Settings, LogOut, Menu, Globe, BookOpen, Banknote,
  Users2, Sun, Moon, Package, ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { href: "/projects", label: "Projects", icon: Film, group: "main" },
  { href: "/team", label: "Crew", icon: Users, group: "main" },
  { href: "/clients", label: "Clients", icon: UsersRound, group: "main" },
  { href: "/invoices", label: "Invoices", icon: Receipt, group: "main" },
  { href: "/expenses", label: "Expenses", icon: CreditCard, group: "main" },
  { href: "/finance", label: "Finance", icon: PieChart, group: "main" },
  { href: "/cms", label: "CMS Editor", icon: Globe, group: "content" },
  { href: "/courses-admin", label: "Courses", icon: BookOpen, group: "content" },
  { href: "/digital-assets-admin", label: "Digital Assets", icon: Package, group: "content" },
  { href: "/payment-settings", label: "Payments", icon: Banknote, group: "content" },
  { href: "/settings", label: "Settings", icon: Settings, group: "system" },
];

function Logo() {
  return (
    <div className="px-5 py-5 mb-2">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-black">F</span>
        </div>
        <span className="text-base font-black tracking-tight text-foreground">Frameless</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 ml-9 font-medium tracking-wide">Creative Studio</p>
    </div>
  );
}

function NavItem({ item, isActive, onClick }: { item: typeof navItems[0]; isActive: boolean; onClick?: () => void }) {
  return (
    <Link href={item.href} onClick={onClick}>
      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group ${
        isActive
          ? "bg-primary/12 text-primary border border-primary/20"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
      }`}>
        <item.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
        <span className="text-[13px] font-medium">{item.label}</span>
      </div>
    </Link>
  );
}

function SidebarNav({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  const mainItems = navItems.filter(n => n.group === "main");
  const contentItems = navItems.filter(n => n.group === "content");
  const systemItems = navItems.filter(n => n.group === "system");

  const isActive = (href: string) =>
    pathname === href || (pathname.startsWith(href) && href !== "/dashboard");

  return (
    <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-6">
      <Logo />

      <div className="space-y-0.5">
        <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">Operations</p>
        {mainItems.map(item => <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={onClick} />)}
      </div>

      <div className="space-y-0.5">
        <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">Content</p>
        {contentItems.map(item => <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={onClick} />)}
        <a href="/" target="_blank" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-transparent">
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span className="text-[13px] font-medium">Landing Page</span>
        </a>
        <a href="/crew/login" target="_blank" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-transparent">
          <Users2 className="w-4 h-4 shrink-0" />
          <span className="text-[13px] font-medium">Crew Portal</span>
        </a>
      </div>

      <div className="space-y-0.5">
        <p className="px-3 text-[10px] uppercase tracking-widest text-muted-foreground/50 font-semibold mb-2">System</p>
        {systemItems.map(item => <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={onClick} />)}
      </div>
    </nav>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all border border-transparent hover:border-border"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        localStorage.removeItem("token");
        setLocation("/login");
      }
    }
  });

  return (
    <div className="min-h-[100dvh] w-full flex bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-58 flex-col border-r border-border bg-sidebar/60 backdrop-blur-2xl relative z-20" style={{ width: "228px" }}>
        <SidebarNav pathname={location} />

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-primary text-sm font-bold">{user?.name?.charAt(0) || "A"}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-[13px] font-semibold text-foreground truncate">{user?.name || "Admin"}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.role || "Administrator"}</p>
            </div>
            <ThemeToggle />
          </div>

          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all text-[13px] font-medium group border border-transparent hover:border-destructive/20"
          >
            <LogOut className="w-3.5 h-3.5 group-hover:text-destructive" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[120px] pointer-events-none" />

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between px-5 py-4 border-b border-border bg-sidebar/80 backdrop-blur-xl z-20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <span className="text-white text-xs font-black">F</span>
            </div>
            <span className="text-sm font-black tracking-tight">Frameless</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[228px] p-0 bg-sidebar border-border flex flex-col">
                <SidebarNav pathname={location} />
                <div className="p-4 border-t border-border">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-xl"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    <span className="text-[13px] font-medium">Sign Out</span>
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto z-10 p-5 md:p-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

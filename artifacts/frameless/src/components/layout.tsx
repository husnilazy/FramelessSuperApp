import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { 
  LayoutDashboard, 
  Film, 
  Users, 
  UsersRound, 
  Receipt, 
  PieChart, 
  CreditCard,
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/dashboard", label: "Control Room", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Film },
  { href: "/team", label: "Crew", icon: Users },
  { href: "/clients", label: "Clients", icon: UsersRound },
  { href: "/invoices", label: "Invoices", icon: Receipt },
  { href: "/expenses", label: "Expenses", icon: CreditCard },
  { href: "/finance", label: "Finance", icon: PieChart },
  { href: "/settings", label: "Settings", icon: Settings },
];

function SidebarNav({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
      <div className="mb-8 px-3">
        <h1 className="text-3xl font-heading tracking-widest text-primary mb-1">FRAMELESS™</h1>
        <div className="flex gap-2 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
          <span>STUDIODO</span>
          <span>•</span>
          <span>ZENSVISUAL</span>
        </div>
      </div>
      
      {navItems.map((item) => {
        const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/dashboard');
        return (
          <Link key={item.href} href={item.href} onClick={onClick}>
            <div className={`flex items-center gap-3 px-3 py-3 rounded-md transition-all duration-200 cursor-pointer border border-transparent ${
              isActive 
                ? 'bg-primary/10 text-primary border-primary/20 shadow-[0_0_15px_rgba(255,107,53,0.1)]' 
                : 'text-muted-foreground hover:bg-white/5 hover:text-white'
            }`}>
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary drop-shadow-[0_0_8px_rgba(255,107,53,0.5)]' : ''}`} />
              <span className="font-medium tracking-wide uppercase text-sm">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
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
      <aside className="hidden md:flex w-64 flex-col border-r border-white/10 bg-sidebar/50 backdrop-blur-xl relative z-20">
        <SidebarNav pathname={location} />
        
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
              <span className="text-primary font-heading tracking-wider">{user?.name?.charAt(0) || 'U'}</span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user?.name || 'Operator'}</p>
              <p className="text-xs text-muted-foreground truncate uppercase tracking-wider">{user?.role || 'Admin'}</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 group"
            onClick={() => logoutMutation.mutate()}
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:text-destructive" />
            <span className="uppercase tracking-wider text-xs">Terminate Session</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-white/10 bg-background/80 backdrop-blur-md z-20">
          <h1 className="text-2xl font-heading tracking-widest text-primary">FRAMELESS™</h1>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-white/10 flex flex-col">
              <SidebarNav pathname={location} />
              <div className="p-4 border-t border-white/10">
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="uppercase tracking-wider text-xs">Terminate Session</span>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <div className="flex-1 overflow-y-auto z-10 p-4 md:p-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-7xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}

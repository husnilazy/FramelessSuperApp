import { useLocation } from "wouter";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, ExternalLink, Users2, Monitor, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme, type ThemePreference } from "@/lib/theme";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const [, navigate] = useLocation();
  const name = user?.name || "Admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2.5 rounded-full pl-1 pr-1 sm:pr-3 h-10 border border-border bg-card hover:bg-muted transition-colors outline-none focus-visible:ring-2 ring-ring"
          aria-label="Menu akun"
        >
          <span className="h-8 w-8 rounded-full grid place-items-center bg-primary/15 text-primary font-bold text-sm">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="hidden sm:block text-left leading-tight max-w-[120px]">
            <span className="block text-[13px] font-semibold text-foreground truncate">{name}</span>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{user?.role || "Admin"}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email || user?.role}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light"><Sun className="h-4 w-4 mr-2" /> Terang</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon className="h-4 w-4 mr-2" /> Gelap</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor className="h-4 w-4 mr-2" /> Ikuti sistem</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings")}><Settings className="h-4 w-4 mr-2" /> Pengaturan</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open("/", "_blank")}><ExternalLink className="h-4 w-4 mr-2" /> Lihat website</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => window.open("/crew/login", "_blank")}><Users2 className="h-4 w-4 mr-2" /> Crew portal</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" /> Keluar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { useEffect } from "react";
import { useLocation } from "wouter";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { FilePlus2, FileText, CreditCard, UserPlus, ExternalLink, Sun, Moon } from "lucide-react";
import { NAV_GROUPS } from "./nav";
import { useTheme } from "@/lib/theme";

/** Pencarian cepat & aksi (Ctrl/⌘ + K): lompat ke halaman mana pun tanpa mencari di menu. */
export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    navigate(href);
  };

  const quick = [
    { label: "Invoice baru", href: "/invoices/new", icon: FilePlus2 },
    { label: "Penawaran baru", href: "/quotations/new", icon: FileText },
    { label: "Catat pengeluaran", href: "/expenses", icon: CreditCard },
    { label: "Tambah klien", href: "/clients", icon: UserPlus },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Cari halaman atau aksi…" />
      <CommandList>
        <CommandEmpty>Tidak ada hasil.</CommandEmpty>
        <CommandGroup heading="Aksi cepat">
          {quick.map((q) => (
            <CommandItem key={q.href + q.label} value={`aksi ${q.label}`} onSelect={() => go(q.href)}>
              <q.icon className="mr-2 h-4 w-4 text-primary" /> {q.label}
            </CommandItem>
          ))}
          <CommandItem value="ganti tema terang gelap" onSelect={() => { toggleTheme(); onOpenChange(false); }}>
            {theme === "dark" ? <Sun className="mr-2 h-4 w-4 text-primary" /> : <Moon className="mr-2 h-4 w-4 text-primary" />}
            Ganti ke tema {theme === "dark" ? "terang" : "gelap"}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        {NAV_GROUPS.map((g) => (
          <CommandGroup key={g.id} heading={g.label}>
            {g.items.map((n) => (
              <CommandItem key={n.href} value={`${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n.href)}>
                <n.icon className="mr-2 h-4 w-4 text-muted-foreground" /> {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Publik">
          <CommandItem value="landing page website" onSelect={() => { window.open("/", "_blank"); onOpenChange(false); }}>
            <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" /> Landing page
          </CommandItem>
          <CommandItem value="crew portal" onSelect={() => { window.open("/crew/login", "_blank"); onOpenChange(false); }}>
            <ExternalLink className="mr-2 h-4 w-4 text-muted-foreground" /> Crew portal
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

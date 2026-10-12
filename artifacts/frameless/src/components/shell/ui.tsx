import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Kartu standar: permukaan, garis, bayangan lembut. Pakai di semua halaman admin. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold text-foreground leading-tight">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn("p-5", (title || action) && "pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

type Tone = "primary" | "success" | "danger" | "warning" | "info" | "violet" | "neutral";

const TONE: Record<Tone, { chip: string; text: string }> = {
  primary: { chip: "bg-primary/12 text-primary", text: "text-primary" },
  success: { chip: "bg-success/12 text-success", text: "text-success" },
  danger: { chip: "bg-destructive/12 text-destructive", text: "text-destructive" },
  warning: { chip: "bg-warning/14 text-warning", text: "text-warning" },
  info: { chip: "bg-info/12 text-info", text: "text-info" },
  violet: { chip: "bg-violet/12 text-violet", text: "text-violet" },
  neutral: { chip: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
};

/** Angka utama dengan ikon, label, dan keterangan. */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
  trend,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  /** persen perubahan; positif = naik */
  trend?: number | null;
  onClick?: () => void;
}) {
  const t = TONE[tone];
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5 text-left shadow-sm transition-all min-w-0",
        onClick && "hover:border-foreground/20 hover:shadow-md cursor-pointer",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground leading-tight">{label}</p>
        <span className={cn("h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-xl grid place-items-center", t.chip)}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[18px] min-[420px]:text-[21px] sm:text-[26px] leading-none font-extrabold tracking-tight text-foreground tabular-nums truncate">{value}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground min-h-4">
        {trend !== undefined && trend !== null && (
          <span className={cn("font-bold", trend >= 0 ? "text-success" : "text-destructive")}>
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
        {sub && <span className="truncate">{sub}</span>}
      </div>
    </Tag>
  );
}

/** Lencana status kecil. */
export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", TONE[tone].chip, className)}>
      {children}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, hint, action }: { icon: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <span className="h-12 w-12 rounded-2xl grid place-items-center bg-muted text-muted-foreground mb-3">
        <Icon className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1 max-w-xs">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

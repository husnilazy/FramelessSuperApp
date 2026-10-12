import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SectionTab<T extends string = string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

/**
 * Tab bagian halaman: satu baris yang bisa di-scroll horizontal di layar kecil
 * (tidak pernah melebarkan halaman) dan konsisten di semua menu admin.
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly SectionTab<T>[];
  value: T;
  onChange: (v: NoInfer<T>) => void;
  className?: string;
}) {
  return (
    <div className={cn("-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-none", className)}>
      <div role="tablist" className="inline-flex min-w-full sm:min-w-0 gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {tabs.map(({ value: v, label, icon: Icon, count }) => {
          const active = v === value;
          return (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                active ? "bg-primary/12 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {label}
              {count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-[11px] font-bold tabular-nums", active ? "bg-primary/15" : "bg-muted")}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Judul halaman standar: konsisten di semua menu, rapi di mobile (aksi turun ke bawah). */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground leading-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

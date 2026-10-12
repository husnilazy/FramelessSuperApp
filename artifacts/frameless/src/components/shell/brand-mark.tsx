import { useBrand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Logo polos — tanpa ubin/kotak penutup. Warna logo diatur admin lewat Pengaturan Dokumen
 * (logo mode terang & mode gelap), jadi tampilan mengikuti tema secara otomatis.
 * Saat sidebar diciutkan (ruang sempit) dipakai inisial perusahaan.
 */
export function BrandMark({
  compact = false,
  subtitle = "Admin",
  className,
  maxWidth = 150,
}: { compact?: boolean; subtitle?: string; className?: string; maxWidth?: number }) {
  const { name, logoUrl, invertLogo } = useBrand();
  const initial = (name || "F").trim().charAt(0).toUpperCase();

  // Rel sempit: logo lebar tidak muat → inisial
  if (compact && !className?.includes("allow-logo")) {
    return (
      <div className={cn("h-10 w-10 shrink-0 rounded-xl grid place-items-center bg-primary/12 text-primary font-extrabold text-lg", className)} title={name}>
        {initial}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      {logoUrl ? (
        <img src={logoUrl} alt={name} style={{ maxWidth, ...(invertLogo ? { filter: "brightness(0) invert(1)" } : {}) }} className="h-9 w-auto object-contain object-left shrink-0" />
      ) : (
        <>
          <div className="h-9 w-9 shrink-0 rounded-xl grid place-items-center bg-primary/12 text-primary font-extrabold text-lg">{initial}</div>
          <p className="text-sm font-bold text-foreground truncate">{name}</p>
        </>
      )}
      {!compact && (
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground border border-border rounded-md px-1.5 py-0.5 shrink-0">
          {subtitle}
        </span>
      )}
    </div>
  );
}

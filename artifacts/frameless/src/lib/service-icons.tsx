import {
  Building2, Megaphone, CalendarDays, Wand2, Heart, Music2, Film, Smartphone, Clapperboard,
  Camera, Mic2, Plane, GraduationCap, Palette, Video, type LucideIcon,
} from "lucide-react";

/**
 * Ikon layanan yang minimalis (garis tipis, satu gaya). Menggantikan emoji bawaan CMS
 * ("🎬", "🎵", …) yang tampil beda-beda per perangkat dan tidak cocok dengan desain Frameless.
 * Dipilih dari kata kunci pada judul/slug; jatuh ke Clapperboard bila tidak ada yang cocok.
 */
const RULES: Array<[RegExp, LucideIcon]> = [
  [/wedding|pernikahan|pre-?wedding/i, Heart],
  [/music|musik|\bmv\b/i, Music2],
  [/company|profile|corporate|perusahaan|dokumenter|documentary/i, Building2],
  [/ads|iklan|commercial|brand|campaign|tvc/i, Megaphone],
  [/event|konser|coverage|livestream/i, CalendarDays],
  [/post|vfx|3d|animation|animasi|edit|grading|motion/i, Wand2],
  [/short|film|movie|cinema/i, Film],
  [/social|reels|tiktok|konten|content/i, Smartphone],
  [/photo|foto/i, Camera],
  [/podcast|audio|voice/i, Mic2],
  [/drone|aerial/i, Plane],
  [/training|kursus|course|academy/i, GraduationCap],
  [/design|desain|creative/i, Palette],
  [/video|produksi|production/i, Video],
];

export function serviceIconFor(...hints: Array<string | undefined>): LucideIcon {
  const text = hints.filter(Boolean).join(" ");
  for (const [re, Icon] of RULES) if (re.test(text)) return Icon;
  return Clapperboard;
}

/** Ikon layanan dalam chip persegi membulat bernuansa aksen. */
export function ServiceIcon({
  title, slug, size = 44, accent = "#FF6A20", strokeWidth = 1.6,
}: { title?: string; slug?: string; size?: number; accent?: string; strokeWidth?: number }) {
  const Icon = serviceIconFor(title, slug);
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: `${accent}14`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}26`,
      }}
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={strokeWidth} />
    </span>
  );
}

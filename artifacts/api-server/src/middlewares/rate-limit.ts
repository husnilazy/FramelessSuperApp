import { type Request, type Response, type NextFunction } from "express";

/**
 * Rate limiter in-memory sederhana (tanpa dependency baru).
 * Catatan: di Vercel serverless tiap instance punya memori sendiri, jadi ini
 * membatasi brute-force per-instance — bukan jaminan global. Cukup untuk
 * menahan tebak-password sederhana; untuk jaminan penuh pakai Upstash/Redis.
 */
export function rateLimit(opts: { windowMs: number; max: number; key?: string }) {
  const hits = new Map<string, { count: number; reset: number }>();
  const scope = opts.key ?? "rl";

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // bersihkan entri kadaluarsa agar Map tidak membengkak
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
    }

    const fwd = req.headers["x-forwarded-for"];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd?.split(",")[0])?.trim() || req.socket.remoteAddress || "unknown";
    const id = `${scope}:${ip}`;

    const entry = hits.get(id);
    if (!entry || entry.reset <= now) {
      hits.set(id, { count: 1, reset: now + opts.windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > opts.max) {
      const retry = Math.ceil((entry.reset - now) / 1000);
      res.setHeader("Retry-After", String(retry));
      res.status(429).json({ error: `Terlalu banyak percobaan. Coba lagi dalam ${retry} detik.` });
      return;
    }
    next();
  };
}

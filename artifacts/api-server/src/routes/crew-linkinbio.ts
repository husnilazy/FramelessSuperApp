// artifacts/frameless/server/routes/crew-linkinbio.ts
// Crew Personal Link-in-Bio — CRUD via raw SQL table (no Drizzle schema needed)
// Storage: auto-create `crew_linkinbio` table with UUID primary key matching team_members.id
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { teamMembersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getCrewMemberIdFromToken } from "./crew.js";
import { supabase } from "../lib/supabase.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";

const router: IRouter = Router();

// ── Auto-create table (runs once per cold start) ───────────────────────────────
let tableReady = false;

async function ensureTable() {
  if (tableReady) return;
  try {
    // Drop old TEXT-id version if it exists (one-time migration)
    // Safe: IF EXISTS means no-op if already UUID or doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'crew_linkinbio'
            AND column_name = 'id'
            AND data_type = 'text'
        ) THEN
          DROP TABLE crew_linkinbio;
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS crew_linkinbio (
        id           UUID PRIMARY KEY,
        display_name TEXT NOT NULL DEFAULT '',
        username     TEXT NOT NULL DEFAULT '',
        bio          TEXT NOT NULL DEFAULT '',
        avatar_url   TEXT NOT NULL DEFAULT '',
        banner_url   TEXT NOT NULL DEFAULT '',
        accent_color TEXT NOT NULL DEFAULT '#FF6A20',
        bg_color     TEXT NOT NULL DEFAULT '#050505',
        layout_style TEXT NOT NULL DEFAULT 'classic',
        links        TEXT NOT NULL DEFAULT '[]',
        is_public    BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    tableReady = true;
    console.log("[crew_linkinbio] Table ready (UUID)");
  } catch (err) {
    console.error("[crew_linkinbio] ensureTable FAILED:", err);
    throw err;
  }
}

// ── File upload ────────────────────────────────────────────────────────────────
const tmpDir = process.env.NODE_ENV === "production"
  ? "/tmp/linkinbio-uploads"
  : path.join(os.tmpdir(), "linkinbio-uploads");

try { fs.mkdirSync(tmpDir, { recursive: true }); } catch {}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tmpDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

function cleanupTmp(filePath?: string) {
  if (!filePath) return;
  fs.unlink(filePath, () => {});
}

// ── Auth middleware ────────────────────────────────────────────────────────────
function requireCrewAuth(req: any, res: any, next: any): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "Unauthorized" }); return; }
  const memberId = getCrewMemberIdFromToken(auth.slice(7));
  if (!memberId) { res.status(401).json({ error: "Invalid token" }); return; }
  req.crewMemberId = memberId;
  next();
}

// ── Types ──────────────────────────────────────────────────────────────────────
type LinkItem = {
  id: string;
  label: string;
  url: string;
  icon: string;
  type: "social" | "affiliate" | "portfolio" | "custom";
  isActive: boolean;
  sortOrder: number;
};

type LinkinBioProfile = {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  accentColor: string;
  bgColor: string;
  layoutStyle: "classic" | "minimal" | "card";
  links: LinkItem[];
  isPublic: boolean;
  updatedAt: string;
};

// ── DB helpers ─────────────────────────────────────────────────────────────────
function defaultProfile(member: any): LinkinBioProfile {
  return {
    displayName: member.name || "Crew Member",
    username: (member.name || "crew").toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, ""),
    bio: member.role ? `${member.role} @ Frameless Creative` : "Crew @ Frameless Creative",
    avatarUrl: member.avatarUrl || "",
    bannerUrl: "",
    accentColor: "#FF6A20",
    bgColor: "#050505",
    layoutStyle: "classic",
    links: [],
    isPublic: false,
    updatedAt: new Date().toISOString(),
  };
}

function rowToProfile(row: any, member: any): LinkinBioProfile {
  let links: LinkItem[] = [];
  try { links = JSON.parse(row.links || "[]"); } catch {}
  return {
    displayName: row.display_name || member.name || "",
    username: row.username || "",
    bio: row.bio || "",
    avatarUrl: row.avatar_url || member.avatarUrl || "",
    bannerUrl: row.banner_url || "",
    accentColor: row.accent_color || "#FF6A20",
    bgColor: row.bg_color || "#050505",
    layoutStyle: (row.layout_style as LinkinBioProfile["layoutStyle"]) || "classic",
    links,
    isPublic: row.is_public === true || row.is_public === "true",
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

async function getProfile(memberId: string): Promise<{ member: any; profile: LinkinBioProfile }> {
  await ensureTable();

  const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, memberId)).limit(1);
  if (!member) throw new Error("Member not found");

  // Cast memberId to UUID explicitly to avoid type mismatch
  const rows = await db.execute(sql`SELECT * FROM crew_linkinbio WHERE id = ${memberId}::uuid LIMIT 1`);
  const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);

  if (!row) return { member, profile: defaultProfile(member) };
  return { member, profile: rowToProfile(row, member) };
}

async function upsertProfile(memberId: string, profile: LinkinBioProfile): Promise<void> {
  await ensureTable();
  const linksJson = JSON.stringify(profile.links ?? []);
  // Cast memberId to UUID explicitly
  await db.execute(sql`
    INSERT INTO crew_linkinbio
      (id, display_name, username, bio, avatar_url, banner_url, accent_color, bg_color, layout_style, links, is_public, updated_at)
    VALUES
      (${memberId}::uuid, ${profile.displayName}, ${profile.username}, ${profile.bio},
       ${profile.avatarUrl}, ${profile.bannerUrl}, ${profile.accentColor}, ${profile.bgColor},
       ${profile.layoutStyle}, ${linksJson}, ${profile.isPublic}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      username     = EXCLUDED.username,
      bio          = EXCLUDED.bio,
      avatar_url   = EXCLUDED.avatar_url,
      banner_url   = EXCLUDED.banner_url,
      accent_color = EXCLUDED.accent_color,
      bg_color     = EXCLUDED.bg_color,
      layout_style = EXCLUDED.layout_style,
      links        = EXCLUDED.links,
      is_public    = EXCLUDED.is_public,
      updated_at   = NOW()
  `);
}

async function uploadImageToSupabase(file: Express.Multer.File, fileName: string): Promise<string> {
  const bucket = supabase.storage.from("site-assets");
  const fileStream = fs.createReadStream(file.path);
  const { error } = await bucket.upload(`linkinbio/${fileName}`, fileStream, {
    contentType: file.mimetype,
    upsert: true,
    duplex: "half",
  } as any);
  if (error) throw error;
  const { data } = bucket.getPublicUrl(`linkinbio/${fileName}`);
  return data.publicUrl;
}

// ── GET /api/crew/linkinbio ────────────────────────────────────────────────────
router.get("/crew/linkinbio", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  try {
    const { profile } = await getProfile(req.crewMemberId);
    res.json(profile);
  } catch (err: any) {
    console.error("[crew/linkinbio GET]", err);
    res.status(500).json({ error: err.message || "Failed to load profile" });
  }
});

// ── PUT /api/crew/linkinbio ────────────────────────────────────────────────────
router.put("/crew/linkinbio", requireCrewAuth as any, async (req: any, res): Promise<void> => {
  try {
    const body = req.body as Partial<LinkinBioProfile>;
    const { profile: current } = await getProfile(req.crewMemberId);

    const updated: LinkinBioProfile = {
      ...current,
      ...body,
      username: (body.username || current.username)
        .toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "").slice(0, 32),
      updatedAt: new Date().toISOString(),
    };

    await upsertProfile(req.crewMemberId, updated);
    res.json(updated);
  } catch (err: any) {
    console.error("[crew/linkinbio PUT]", err);
    res.status(500).json({ error: err.message || "Failed to save profile" });
  }
});

// ── POST /api/crew/linkinbio/avatar ───────────────────────────────────────────
router.post("/crew/linkinbio/avatar", requireCrewAuth as any, (req: any, res: any) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    try {
      const ext = path.extname(req.file.originalname);
      const fileName = `avatar-${req.crewMemberId}-${Date.now()}${ext}`;
      const url = await uploadImageToSupabase(req.file, fileName);
      cleanupTmp(req.file.path);

      // Sync avatarUrl to teamMembersTable too
      await db.update(teamMembersTable).set({ avatarUrl: url }).where(eq(teamMembersTable.id, req.crewMemberId));

      const { profile } = await getProfile(req.crewMemberId);
      await upsertProfile(req.crewMemberId, { ...profile, avatarUrl: url });

      res.json({ url });
    } catch (e: any) {
      cleanupTmp(req.file?.path);
      res.status(500).json({ error: e.message });
    }
  });
});

// ── POST /api/crew/linkinbio/banner ───────────────────────────────────────────
router.post("/crew/linkinbio/banner", requireCrewAuth as any, (req: any, res: any) => {
  upload.single("file")(req, res, async (err: any) => {
    if (err) { res.status(400).json({ error: err.message }); return; }
    if (!req.file) { res.status(400).json({ error: "No file" }); return; }
    try {
      const ext = path.extname(req.file.originalname);
      const fileName = `banner-${req.crewMemberId}-${Date.now()}${ext}`;
      const url = await uploadImageToSupabase(req.file, fileName);
      cleanupTmp(req.file.path);

      const { profile } = await getProfile(req.crewMemberId);
      await upsertProfile(req.crewMemberId, { ...profile, bannerUrl: url });

      res.json({ url });
    } catch (e: any) {
      cleanupTmp(req.file?.path);
      res.status(500).json({ error: e.message });
    }
  });
});

// ── GET /api/public/crew/:username — no auth, public page ─────────────────────
router.get("/public/crew/:username", async (req, res): Promise<void> => {
  try {
    await ensureTable();
    const { username } = req.params;

    // Query only crew_linkinbio (no JOIN to avoid table name issues)
    const rows = await db.execute(sql`
      SELECT * FROM crew_linkinbio
      WHERE LOWER(username) = ${username.toLowerCase()}
        AND is_public = TRUE
      LIMIT 1
    `);

    const row = (rows as any).rows?.[0] ?? (Array.isArray(rows) ? rows[0] : null);
    if (!row) { res.status(404).json({ error: "Profile not found or not public" }); return; }

    // Fetch member via Drizzle ORM (correct UUID comparison via schema)
    const [member] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, row.id))
      .limit(1);

    let links: LinkItem[] = [];
    try { links = JSON.parse(row.links || "[]"); } catch {}

    res.json({
      displayName: row.display_name,
      username: row.username,
      bio: row.bio,
      avatarUrl: row.avatar_url || member?.avatarUrl || "",
      bannerUrl: row.banner_url || "",
      accentColor: row.accent_color,
      bgColor: row.bg_color,
      layoutStyle: row.layout_style,
      links: links.filter((l: LinkItem) => l.isActive),
      role: member?.role || "",
      department: member?.department || "",
    });
  } catch (err: any) {
    console.error("[public/crew/:username]", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

export default router;
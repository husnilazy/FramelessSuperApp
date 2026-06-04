import { Router, type IRouter } from "express";
import { db, projectFilesTable, teamMembersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "./middleware.js";
import { crewTokenStore, getCrewMemberIdFromToken } from "./crew.js";

const router: IRouter = Router();

// Helper to get member id from crew token (supports JWT + legacy Map)
function getCrewMemberId(req: any): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return getCrewMemberIdFromToken(token);
}

// === CREW: Upload file to a project ===
router.post("/crew/projects/:projectId/files", async (req, res) => {
  try {
    const memberId = getCrewMemberId(req);
    if (!memberId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // In real implementation, you'd handle multipart upload here (similar to /api/crew/uploads)
    // For now, we assume the file is already uploaded and we receive the URL
    const { title, fileUrl, fileType, fileSize, category, description } = req.body;

    if (!title || !fileUrl) {
      res.status(400).json({ error: "title and fileUrl are required" });
      return;
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    const [file] = await db.insert(projectFilesTable).values({
      projectId,
      uploadedBy: memberId,
      title,
      fileUrl,
      fileType: fileType || null,
      fileSize: fileSize || null,
      category: category || "work-file",
      description: description || null,
    }).returning();

    res.status(201).json(file);
  } catch (err) {
    console.error("[crew project file upload]", err);
    res.status(500).json({ error: "Failed to save file" });
  }
});

// === CREW: Get files for a project ===
router.get("/crew/projects/:projectId/files", async (req, res) => {
  try {
    const memberId = getCrewMemberId(req);
    if (!memberId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    const files = await db
      .select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, projectId))
      .orderBy(projectFilesTable.createdAt);

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

// === ADMIN: Get files for a project ===
router.get("/admin/projects/:projectId/files", requireAuth, async (req, res) => {
  try {
    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    const files = await db
      .select()
      .from(projectFilesTable)
      .where(eq(projectFilesTable.projectId, projectId))
      .orderBy(projectFilesTable.createdAt);

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch project files" });
  }
});

export default router;

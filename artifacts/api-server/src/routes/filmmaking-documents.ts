import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, filmmakingDocumentsTable, filmmakingCollaboratorsTable, filmmakingRevisionsTable, teamMembersTable } from "@workspace/db";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireUniversalAuth } from "./middleware.js";

type AuthedRequest = Request & {
  user?: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    isActive: boolean;
  };
};

const router: IRouter = Router();

// =============================================
// Middleware: Verify document access
// =============================================
async function requireDocumentAccess(documentId: string, userId: string, requiredRole?: "owner" | "editor" | "viewer") {
  try {
    // Get document
    const [document] = await db
      .select()
      .from(filmmakingDocumentsTable)
      .where(and(eq(filmmakingDocumentsTable.id, documentId), isNull(filmmakingDocumentsTable.deletedAt)));

    if (!document) return null;

    // Check owner
    if (document.crewId === userId) {
      return { document, access: "owner" as const };
    }

    // Check collaborators
    const [collaborator] = await db
      .select()
      .from(filmmakingCollaboratorsTable)
      .where(
        and(
          eq(filmmakingCollaboratorsTable.documentId, documentId),
          eq(filmmakingCollaboratorsTable.crewMemberId, userId)
        )
      );

    if (!collaborator) return null;

    // Validate required role if specified
    if (requiredRole && collaborator.role !== requiredRole && requiredRole !== "viewer") {
      return null;
    }

    return { document, access: collaborator.role };
  } catch (err) {
    logger.error({ err, documentId, userId }, "requireDocumentAccess.error");
    return null;
  }
}

// =============================================
// GET /filmmaking-documents
// List crew's documents (optionally filtered by project)
// =============================================
router.get("/filmmaking-documents", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { projectId } = req.query as { projectId?: string };

    const conditions = [
      eq(filmmakingDocumentsTable.crewId, req.user.id),
      isNull(filmmakingDocumentsTable.deletedAt),
    ];

    if (projectId) {
      conditions.push(eq(filmmakingDocumentsTable.projectId, projectId));
    }

    const documents = await db
      .select()
      .from(filmmakingDocumentsTable)
      .where(and(...conditions))
      .orderBy(desc(filmmakingDocumentsTable.updatedAt));

    res.json(documents);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.get.error");
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// =============================================
// POST /filmmaking-documents
// Create new document
// =============================================
router.post("/filmmaking-documents", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { docType, title, projectId, content } = req.body as {
      docType: "concept" | "script" | "shotlist";
      title: string;
      projectId?: string;
      content?: any;
    };

    if (!docType || !title) {
      res.status(400).json({ error: "docType and title are required" });
      return;
    }

    const [document] = await db
      .insert(filmmakingDocumentsTable)
      .values({
        crewId: req.user.id,
        projectId,
        docType,
        title,
        content: content || {},
        isDraft: true,
      })
      .returning();

    res.status(201).json(document);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.post.error");
    res.status(500).json({ error: "Failed to create document" });
  }
});

// =============================================
// GET /filmmaking-documents/:id
// Get document + collaborators + comments
// =============================================
router.get("/filmmaking-documents/:id", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    // Verify access
    const access = await requireDocumentAccess(id, req.user.id);
    if (!access) {
      res.status(404).json({ error: "Document not found or no access" });
      return;
    }

    // Get collaborators
    const collaborators = await db
      .select()
      .from(filmmakingCollaboratorsTable)
      .where(eq(filmmakingCollaboratorsTable.documentId, id));

    res.json({
      ...access.document,
      collaborators,
      userAccess: access.access,
    });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.getById.error");
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// =============================================
// PUT /filmmaking-documents/:id
// Update document content + create revision
// =============================================
router.put("/filmmaking-documents/:id", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { content, title, isDraft, changeSummary } = req.body as {
      content?: any;
      title?: string;
      isDraft?: boolean;
      changeSummary?: string;
    };

    // Verify access (owner or editor)
    const access = await requireDocumentAccess(id, req.user.id, "editor");
    if (!access) {
      res.status(403).json({ error: "No edit access to this document" });
      return;
    }

    // Create revision snapshot before updating
    if (content) {
      await db.insert(filmmakingRevisionsTable).values({
        documentId: id,
        contentSnapshot: access.document.content,
        changedBy: req.user.id,
        changeSummary,
      });
    }

    // Update document
    const updateData: any = {};
    if (content !== undefined) updateData.content = content;
    if (title !== undefined) updateData.title = title;
    if (isDraft !== undefined) updateData.isDraft = isDraft;
    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(filmmakingDocumentsTable)
      .set(updateData)
      .where(eq(filmmakingDocumentsTable.id, id))
      .returning();

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.put.error");
    res.status(500).json({ error: "Failed to update document" });
  }
});

// =============================================
// DELETE /filmmaking-documents/:id
// Soft delete document
// =============================================
router.delete("/filmmaking-documents/:id", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    // Verify owner only
    const access = await requireDocumentAccess(id, req.user.id, "owner");
    if (!access || access.access !== "owner") {
      res.status(403).json({ error: "Only owner can delete document" });
      return;
    }

    await db
      .update(filmmakingDocumentsTable)
      .set({ deletedAt: new Date() })
      .where(eq(filmmakingDocumentsTable.id, id));

    res.status(204).send();
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.delete.error");
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// =============================================
// POST /filmmaking-documents/:id/duplicate
// Clone document
// =============================================
router.post("/filmmaking-documents/:id/duplicate", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    // Verify access
    const access = await requireDocumentAccess(id, req.user.id);
    if (!access) {
      res.status(404).json({ error: "Document not found or no access" });
      return;
    }

    const newTitle = `${access.document.title} (Copy)`;

    const [duplicated] = await db
      .insert(filmmakingDocumentsTable)
      .values({
        crewId: req.user.id,
        projectId: access.document.projectId,
        docType: access.document.docType,
        title: newTitle,
        content: access.document.content,
        isDraft: true,
      })
      .returning();

    res.status(201).json(duplicated);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.duplicate.error");
    res.status(500).json({ error: "Failed to duplicate document" });
  }
});

export default router;

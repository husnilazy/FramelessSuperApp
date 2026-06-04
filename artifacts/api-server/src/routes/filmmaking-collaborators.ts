import { Router, type IRouter, type Request, type Response } from "express";
import { db, filmmakingDocumentsTable, filmmakingCollaboratorsTable, teamMembersTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
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
// Helper: Verify document ownership
// =============================================
async function verifyDocumentOwner(documentId: string, userId: string) {
  const [document] = await db
    .select()
    .from(filmmakingDocumentsTable)
    .where(
      and(
        eq(filmmakingDocumentsTable.id, documentId),
        eq(filmmakingDocumentsTable.crewId, userId),
        isNull(filmmakingDocumentsTable.deletedAt)
      )
    );
  return document;
}

// =============================================
// GET /filmmaking-documents/:id/collaborators
// List collaborators
// =============================================
router.get("/filmmaking-documents/:id/collaborators", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    // Verify user has access to document
    const document = await verifyDocumentOwner(id, req.user.id);
    if (!document) {
      res.status(404).json({ error: "Document not found or no access" });
      return;
    }

    // Get collaborators with member details
    const collaborators = await db
      .select({
        id: filmmakingCollaboratorsTable.id,
        crewMemberId: filmmakingCollaboratorsTable.crewMemberId,
        role: filmmakingCollaboratorsTable.role,
        addedAt: filmmakingCollaboratorsTable.addedAt,
        memberName: teamMembersTable.name,
        memberEmail: teamMembersTable.email,
        memberAvatarUrl: teamMembersTable.avatarUrl,
      })
      .from(filmmakingCollaboratorsTable)
      .leftJoin(teamMembersTable, eq(filmmakingCollaboratorsTable.crewMemberId, teamMembersTable.id))
      .where(eq(filmmakingCollaboratorsTable.documentId, id));

    res.json(collaborators);
  } catch (err) {
    logger.error({ err }, "filmmaking-collaborators.getList.error");
    res.status(500).json({ error: "Failed to fetch collaborators" });
  }
});

// =============================================
// POST /filmmaking-documents/:id/collaborators
// Add collaborator
// =============================================
router.post("/filmmaking-documents/:id/collaborators", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { crewMemberId, role } = req.body as {
      crewMemberId: string;
      role: "editor" | "viewer";
    };

    if (!crewMemberId || !role) {
      res.status(400).json({ error: "crewMemberId and role are required" });
      return;
    }

    // Verify document ownership
    const document = await verifyDocumentOwner(id, req.user.id);
    if (!document) {
      res.status(403).json({ error: "Only owner can add collaborators" });
      return;
    }

    // Check if already a collaborator
    const [existing] = await db
      .select()
      .from(filmmakingCollaboratorsTable)
      .where(
        and(
          eq(filmmakingCollaboratorsTable.documentId, id),
          eq(filmmakingCollaboratorsTable.crewMemberId, crewMemberId)
        )
      );

    if (existing) {
      res.status(400).json({ error: "User is already a collaborator" });
      return;
    }

    // Verify crew member exists
    const [member] = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.id, crewMemberId));

    if (!member) {
      res.status(404).json({ error: "Crew member not found" });
      return;
    }

    const [collaborator] = await db
      .insert(filmmakingCollaboratorsTable)
      .values({
        documentId: id,
        crewMemberId,
        role,
        addedBy: req.user.id,
      })
      .returning();

    res.status(201).json(collaborator);
  } catch (err) {
    logger.error({ err }, "filmmaking-collaborators.post.error");
    res.status(500).json({ error: "Failed to add collaborator" });
  }
});

// =============================================
// PUT /filmmaking-documents/:id/collaborators/:collaboratorId
// Change collaborator role
// =============================================
router.put(
  "/filmmaking-documents/:id/collaborators/:collaboratorId",
  requireUniversalAuth,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id, collaboratorId } = req.params as { id: string; collaboratorId: string };
      const { role } = req.body as { role: "editor" | "viewer" };

      if (!role) {
        res.status(400).json({ error: "role is required" });
        return;
      }

      // Verify document ownership
      const document = await verifyDocumentOwner(id, req.user.id);
      if (!document) {
        res.status(403).json({ error: "Only owner can modify collaborators" });
        return;
      }

      const [updated] = await db
        .update(filmmakingCollaboratorsTable)
        .set({ role })
        .where(eq(filmmakingCollaboratorsTable.id, collaboratorId))
        .returning();

      if (!updated) {
        res.status(404).json({ error: "Collaborator not found" });
        return;
      }

      res.json(updated);
    } catch (err) {
      logger.error({ err }, "filmmaking-collaborators.patch.error");
      res.status(500).json({ error: "Failed to update collaborator" });
    }
  }
);

// =============================================
// DELETE /filmmaking-documents/:id/collaborators/:collaboratorId
// Remove collaborator
// =============================================
router.delete(
  "/filmmaking-documents/:id/collaborators/:collaboratorId",
  requireUniversalAuth,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { id, collaboratorId } = req.params as { id: string; collaboratorId: string };

      // Verify document ownership
      const document = await verifyDocumentOwner(id, req.user.id);
      if (!document) {
        res.status(403).json({ error: "Only owner can remove collaborators" });
        return;
      }

      await db.delete(filmmakingCollaboratorsTable).where(eq(filmmakingCollaboratorsTable.id, collaboratorId));

      res.status(204).send();
    } catch (err) {
      logger.error({ err }, "filmmaking-collaborators.delete.error");
      res.status(500).json({ error: "Failed to remove collaborator" });
    }
  }
);

export default router;

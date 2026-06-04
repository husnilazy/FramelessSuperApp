import { Router, type IRouter, type Request, type Response } from "express";
import { db, filmmakingDocumentsTable, filmmakingSubmissionsTable, filmmakingCollaboratorsTable, teamMembersTable, usersTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
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
// POST /filmmaking-documents/:id/submit
// Crew submits document to admin
// =============================================
router.post("/filmmaking-documents/:id/submit", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    // Verify document exists and user has access
    const [document] = await db
      .select()
      .from(filmmakingDocumentsTable)
      .where(
        and(eq(filmmakingDocumentsTable.id, id), isNull(filmmakingDocumentsTable.deletedAt))
      );

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Only owner can submit
    if (document.crewId !== req.user.id) {
      res.status(403).json({ error: "Only document owner can submit" });
      return;
    }

    // Check if already submitted (active submission)
    const [existingSubmission] = await db
      .select()
      .from(filmmakingSubmissionsTable)
      .where(
        and(
          eq(filmmakingSubmissionsTable.documentId, id),
          isNull(filmmakingSubmissionsTable.approvedAt)
        )
      );

    if (existingSubmission && existingSubmission.status === "pending") {
      res.status(400).json({ error: "Document already submitted pending review" });
      return;
    }

    // Create submission
    const [submission] = await db
      .insert(filmmakingSubmissionsTable)
      .values({
        documentId: id,
        submittedBy: req.user.id,
        status: "pending",
      })
      .returning();

    res.status(201).json(submission);
  } catch (err) {
    logger.error({ err }, "filmmaking-submissions.submit.error");
    res.status(500).json({ error: "Failed to submit document" });
  }
});

// =============================================
// GET /filmmaking-submissions
// List all submissions (admin only)
// =============================================
router.get("/filmmaking-submissions", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if admin (role === "admin")
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Only admins can view submissions" });
      return;
    }

    const { status } = req.query as { status?: string };

    const conditions = [];
    if (status) {
      conditions.push(eq(filmmakingSubmissionsTable.status, status));
    }

    const submissions = await db
      .select({
        id: filmmakingSubmissionsTable.id,
        documentId: filmmakingSubmissionsTable.documentId,
        submittedBy: filmmakingSubmissionsTable.submittedBy,
        submittedAt: filmmakingSubmissionsTable.submittedAt,
        status: filmmakingSubmissionsTable.status,
        adminNotes: filmmakingSubmissionsTable.adminNotes,
        approvedAt: filmmakingSubmissionsTable.approvedAt,
        approvedBy: filmmakingSubmissionsTable.approvedBy,
        documentTitle: filmmakingDocumentsTable.title,
        documentType: filmmakingDocumentsTable.docType,
        crewMemberName: teamMembersTable.name,
        crewMemberEmail: teamMembersTable.email,
      })
      .from(filmmakingSubmissionsTable)
      .leftJoin(filmmakingDocumentsTable, eq(filmmakingSubmissionsTable.documentId, filmmakingDocumentsTable.id))
      .leftJoin(teamMembersTable, eq(filmmakingSubmissionsTable.submittedBy, teamMembersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(filmmakingSubmissionsTable.submittedAt));

    res.json(submissions);
  } catch (err) {
    logger.error({ err }, "filmmaking-submissions.getList.error");
    res.status(500).json({ error: "Failed to fetch submissions" });
  }
});

// =============================================
// GET /filmmaking-submissions/:id
// Get submission details
// =============================================
router.get("/filmmaking-submissions/:id", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };

    const submission = await db
      .select({
        id: filmmakingSubmissionsTable.id,
        documentId: filmmakingSubmissionsTable.documentId,
        submittedBy: filmmakingSubmissionsTable.submittedBy,
        submittedAt: filmmakingSubmissionsTable.submittedAt,
        status: filmmakingSubmissionsTable.status,
        adminNotes: filmmakingSubmissionsTable.adminNotes,
        approvedAt: filmmakingSubmissionsTable.approvedAt,
        approvedBy: filmmakingSubmissionsTable.approvedBy,
        document: {
          id: filmmakingDocumentsTable.id,
          title: filmmakingDocumentsTable.title,
          docType: filmmakingDocumentsTable.docType,
          content: filmmakingDocumentsTable.content,
          projectId: filmmakingDocumentsTable.projectId,
          createdAt: filmmakingDocumentsTable.createdAt,
          updatedAt: filmmakingDocumentsTable.updatedAt,
        },
        crewMember: {
          id: teamMembersTable.id,
          name: teamMembersTable.name,
          email: teamMembersTable.email,
          avatarUrl: teamMembersTable.avatarUrl,
        },
      })
      .from(filmmakingSubmissionsTable)
      .leftJoin(filmmakingDocumentsTable, eq(filmmakingSubmissionsTable.documentId, filmmakingDocumentsTable.id))
      .leftJoin(teamMembersTable, eq(filmmakingSubmissionsTable.submittedBy, teamMembersTable.id))
      .where(eq(filmmakingSubmissionsTable.id, id))
      .then((rows: any[]) => rows[0]);

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    // Check access: admin or submitter
    if (req.user.role !== "admin" && req.user.id !== submission.submittedBy) {
      res.status(403).json({ error: "No access to this submission" });
      return;
    }

    res.json(submission);
  } catch (err) {
    logger.error({ err }, "filmmaking-submissions.getById.error");
    res.status(500).json({ error: "Failed to fetch submission" });
  }
});

// =============================================
// POST /filmmaking-submissions/:id/approve
// Admin approves submission
// =============================================
router.post("/filmmaking-submissions/:id/approve", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Check if admin
    if (req.user.role !== "admin") {
      res.status(403).json({ error: "Only admins can approve submissions" });
      return;
    }

    const { id } = req.params as { id: string };

    const [submission] = await db
      .update(filmmakingSubmissionsTable)
      .set({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: req.user.id,
      })
      .where(eq(filmmakingSubmissionsTable.id, id))
      .returning();

    if (!submission) {
      res.status(404).json({ error: "Submission not found" });
      return;
    }

    res.json(submission);
  } catch (err) {
    logger.error({ err }, "filmmaking-submissions.approve.error");
    res.status(500).json({ error: "Failed to approve submission" });
  }
});

// =============================================
// POST /filmmaking-submissions/:id/request-revision
// Admin requests revision
// =============================================
router.post(
  "/filmmaking-submissions/:id/request-revision",
  requireUniversalAuth,
  async (req: AuthedRequest, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // Check if admin
      if (req.user.role !== "admin") {
        res.status(403).json({ error: "Only admins can request revisions" });
        return;
      }

      const { id } = req.params as { id: string };
      const { adminNotes } = req.body as { adminNotes?: string };

      const [submission] = await db
        .update(filmmakingSubmissionsTable)
        .set({
          status: "revision_requested",
          adminNotes,
        })
        .where(eq(filmmakingSubmissionsTable.id, id))
        .returning();

      if (!submission) {
        res.status(404).json({ error: "Submission not found" });
        return;
      }

      res.json(submission);
    } catch (err) {
      logger.error({ err }, "filmmaking-submissions.requestRevision.error");
      res.status(500).json({ error: "Failed to request revision" });
    }
  }
);

export default router;

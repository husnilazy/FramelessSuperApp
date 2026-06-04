import { Router, type IRouter } from "express";
import { db, filmmakingDocumentsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireUniversalAuth } from "./middleware.js";

const router: IRouter = Router();

// Track active collaborators per document
const activeCollaborators = new Map<
  string,
  Set<{ userId: string; userName: string; timestamp: number }>
>();

// =============================================
// GET /filmmaking-collaboration/active/:documentId
// Get list of active collaborators on a document
// =============================================
router.get(
  "/filmmaking-collaboration/active/:documentId",
  requireUniversalAuth,
  async (req: any, res): Promise<void> => {
    try {
      const { documentId } = req.params;

      // Get active collaborators
      const active = activeCollaborators.get(documentId) || new Set();
      const activeList = Array.from(active).map((col) => ({
        userId: col.userId,
        userName: col.userName,
        lastSeen: new Date(col.timestamp),
      }));

      // Clean up stale entries (older than 2 minutes)
      const now = Date.now();
      const twoMinutes = 2 * 60 * 1000;
      const stillActive = Array.from(active).filter(
        (col) => now - col.timestamp < twoMinutes
      );
      activeCollaborators.set(documentId, new Set(stillActive));

      res.json(activeList);
    } catch (err) {
      logger.error({ err }, "filmmaking-collaboration.active.error");
      res.status(500).json({ error: "Failed to fetch active collaborators" });
    }
  }
);

// =============================================
// POST /filmmaking-collaboration/ping/:documentId
// Update presence - crew member is actively viewing/editing
// =============================================
router.post(
  "/filmmaking-collaboration/ping/:documentId",
  requireUniversalAuth,
  async (req: any, res): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { userId, userName } = req.body as {
        userId: string;
        userName: string;
      };

      if (!userId || !userName) {
        res.status(400).json({ error: "userId and userName required" });
        return;
      }

      // Add or update collaborator
      const active = activeCollaborators.get(documentId) || new Set();
      active.add({
        userId,
        userName,
        timestamp: Date.now(),
      });
      activeCollaborators.set(documentId, active);

      res.json({ status: "ok" });
    } catch (err) {
      logger.error({ err }, "filmmaking-collaboration.ping.error");
      res.status(500).json({ error: "Failed to update presence" });
    }
  }
);

// =============================================
// POST /filmmaking-collaboration/leave/:documentId
// Remove presence when user leaves
// =============================================
router.post(
  "/filmmaking-collaboration/leave/:documentId",
  requireUniversalAuth,
  async (req: any, res): Promise<void> => {
    try {
      const { documentId } = req.params;
      const { userId } = req.body as { userId: string };

      if (!userId) {
        res.status(400).json({ error: "userId required" });
        return;
      }

      const active = activeCollaborators.get(documentId) || new Set();
      const filtered = Array.from(active).filter((col) => col.userId !== userId);
      activeCollaborators.set(documentId, new Set(filtered));

      res.json({ status: "ok" });
    } catch (err) {
      logger.error({ err }, "filmmaking-collaboration.leave.error");
      res.status(500).json({ error: "Failed to remove presence" });
    }
  }
);

export default router;

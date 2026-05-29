import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

type ChatMessageRow = {
  id: string;
  crewId?: string | null;
  senderId?: string | null;
  senderName: string;
  senderRole: string;
  message?: string | null;
  content?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  isRead: boolean;
  createdAt: Date;
};

// GET /chat/messages
router.get("/chat/messages", async (req, res): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query.limit) || 60, 100);

    const msgs = await db
      .select()
      .from(chatMessagesTable)
      .orderBy(desc(chatMessagesTable.createdAt))
      .limit(limit);

    const normalized = (msgs as ChatMessageRow[])
      .reverse()
      .map((m: ChatMessageRow) => ({
        id: m.id,
        senderId: m.senderId || m.crewId || "",
        senderName: m.senderName,
        senderRole: m.senderRole,
        content: m.content || m.message || "",
        fileUrl: m.fileUrl || null,
        fileName: m.fileName || null,
        isRead: m.isRead,
        createdAt: m.createdAt,
      }));

    res.json(normalized);

  } catch (err) {
    console.error("[chat] GET error:", err);

    res.status(500).json({
      error: "Failed to fetch messages",
    });
  }
});

// POST /chat/messages
router.post("/chat/messages", async (req, res): Promise<void> => {
  try {
    const {
      content,
      senderId,
      senderName,
      senderRole,
      fileUrl,
      fileName,
    } = req.body;

    if (!senderName || (!content?.trim() && !fileUrl)) {
      res.status(400).json({
        error: "senderName and content or fileUrl required",
      });
      return;
    }

    const [msg] = await db
      .insert(chatMessagesTable)
      .values({
        crewId: senderId || "admin",
        senderName: senderName || "Unknown",
        senderRole: senderRole || "crew",
        message: content?.trim() || fileName || "File",
        isRead: false,
      })
      .returning();

    const response = msg as ChatMessageRow;

    res.status(201).json({
      id: response.id,
      senderId: response.crewId,
      senderName: response.senderName,
      senderRole: response.senderRole,
      content: response.message,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      isRead: response.isRead,
      createdAt: response.createdAt,
    });

  } catch (err) {
    console.error("[chat] POST error:", err);

    res.status(500).json({
      error: "Failed to send message",
    });
  }
});

// DELETE /chat/messages/:id
router.delete(
  "/chat/messages/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);

      await db
        .delete(chatMessagesTable)
        .where(eq(chatMessagesTable.id, id));

      res.json({
        success: true,
      });

    } catch (err) {
      console.error("[chat] DELETE error:", err);

      res.status(500).json({
        error: "Failed to delete",
      });
    }
  }
);

export default router;
// artifacts/api-server/src/routes/chat.ts
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "./middleware";

const router: IRouter = Router();

// GET /chat/messages
router.get("/chat/messages", async (req, res): Promise<void> => {
    try {
        const limit = Math.min(Number(req.query.limit) || 60, 100);
        const msgs = await db
            .select()
            .from(chatMessagesTable)
            .orderBy(desc(chatMessagesTable.createdAt))
            .limit(limit);

        // Normalize: support both old schema (crewId/message) and any new fields
        const normalized = msgs.reverse().map(m => ({
            id: m.id,
            senderId: (m as any).senderId || (m as any).crewId || "",
            senderName: m.senderName,
            senderRole: m.senderRole,
            content: (m as any).content || (m as any).message || "",
            fileUrl: (m as any).fileUrl || null,
            fileName: (m as any).fileName || null,
            isRead: m.isRead,
            createdAt: m.createdAt,
        }));

        res.json(normalized);
    } catch (err) {
        console.error("[chat] GET error:", err);
        res.status(500).json({ error: "Failed to fetch messages" });
    }
});

// POST /chat/messages
router.post("/chat/messages", async (req, res): Promise<void> => {
    try {
        const { content, senderId, senderName, senderRole, fileUrl, fileName } = req.body;

        if (!senderName || (!content?.trim() && !fileUrl)) {
            res.status(400).json({ error: "senderName and content or fileUrl required" });
            return;
        }

        // Use existing schema fields (crewId = senderId, message = content)
        const [msg] = await db
            .insert(chatMessagesTable)
            .values({
                crewId: senderId || "admin",
                senderName: senderName || "Unknown",
                senderRole: senderRole || "crew",
                message: content?.trim() || fileName || "File",
                isRead: false,
            } as any)
            .returning();

        res.status(201).json({
            id: msg.id,
            senderId: (msg as any).crewId,
            senderName: msg.senderName,
            senderRole: msg.senderRole,
            content: (msg as any).message,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            isRead: msg.isRead,
            createdAt: msg.createdAt,
        });
    } catch (err) {
        console.error("[chat] POST error:", err);
        res.status(500).json({ error: "Failed to send message" });
    }
});

// DELETE /chat/messages/:id
router.delete("/chat/messages/:id", requireAuth, async (req, res): Promise<void> => {
    try {
        await db.delete(chatMessagesTable).where(eq(chatMessagesTable.id, req.params.id as string));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Failed to delete" });
    }
});

export default router;
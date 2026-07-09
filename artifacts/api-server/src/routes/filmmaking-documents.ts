import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, filmmakingDocumentsTable, filmmakingCollaboratorsTable, filmmakingRevisionsTable, teamMembersTable } from "@workspace/db";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { requireUniversalAuth } from "./middleware.js";
import { chatCompletion } from "./ai.js";

type AuthedRequest = Request & {
  user?: {
    id: string;
    name: string;
    email: string | null;
    role: string;
    isActive: boolean;
  };
};

interface PipelineLinks {
  conceptId?: string;
  screenplayId?: string;
  scriptId?: string;
  shotlistId?: string;
}

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
// Helper: bersihkan output AI dari markdown fence / teks liar & parse JSON dengan aman
// =============================================
function parseAiJson<T = any>(raw: string): T {
  let text = (raw || "").trim();

  // Buang markdown code fence kalau ada (```json ... ``` atau ``` ... ```)
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Beberapa model suka nyisipin kalimat pembuka/penutup ("Here is the JSON:", dst)
  // meski sudah diminta return JSON doang. Ambil aja bagian {...} paling luar.
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.substring(firstBrace, lastBrace + 1);
  }

  // Buang trailing comma sebelum } atau ] yang kadang muncul dari output model
  text = text.replace(/,(\s*[}\]])/g, "$1");

  return JSON.parse(text);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// =============================================
// Helper: tag metadata _pipeline ke content sebuah dokumen (merge, bukan overwrite field lain)
// =============================================
async function tagPipeline(documentId: string, currentContent: any, pipeline: PipelineLinks) {
  await db
    .update(filmmakingDocumentsTable)
    .set({ content: { ...(currentContent || {}), _pipeline: pipeline } })
    .where(eq(filmmakingDocumentsTable.id, documentId));
}

// =============================================
// GET /filmmaking-documents
// List crew's documents (optionally filtered by project and/or docType)
// =============================================
router.get("/filmmaking-documents", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { projectId, docType } = req.query as { projectId?: string; docType?: string };

    const conditions = [
      eq(filmmakingDocumentsTable.crewId, req.user.id),
      isNull(filmmakingDocumentsTable.deletedAt),
    ];

    if (projectId) {
      conditions.push(eq(filmmakingDocumentsTable.projectId, projectId));
    }

    if (docType) {
      conditions.push(eq(filmmakingDocumentsTable.docType, docType));
    }

    const documents = await db
      .select()
      .from(filmmakingDocumentsTable)
      .where(and(...conditions))
      .orderBy(desc(filmmakingDocumentsTable.updatedAt));

    res.json(documents);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.get.error");
    res.status(500).json({ error: "Failed to fetch documents", details: err instanceof Error ? err.message : String(err) });
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
    res.status(500).json({ error: "Failed to create document", details: err instanceof Error ? err.message : String(err) });
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

    // Update document. Kalau content dikirim tanpa _pipeline, pertahankan _pipeline lama
    // (biar link antar dokumen pipeline tidak hilang cuma gara-gara auto-save dari editor
    // yang tidak tahu-menahu soal field ini).
    const updateData: any = {};
    if (content !== undefined) {
      const existingPipeline = (access.document.content as any)?._pipeline;
      updateData.content = existingPipeline && content._pipeline === undefined
        ? { ...content, _pipeline: existingPipeline }
        : content;
    }
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
    const { _pipeline, ...restContent } = (access.document.content as any) || {};

    const [duplicated] = await db
      .insert(filmmakingDocumentsTable)
      .values({
        crewId: req.user.id,
        projectId: access.document.projectId,
        docType: access.document.docType,
        title: newTitle,
        content: restContent, // duplikat tidak ikut membawa link pipeline dokumen asal
        isDraft: true,
      })
      .returning();

    res.status(201).json(duplicated);
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.duplicate.error");
    res.status(500).json({ error: "Failed to duplicate document" });
  }
});

// =============================================
// POST /filmmaking-documents/:id/ai-breakdown
// Auto generate Script Breakdown & Shotlist using AI (dari Screenplay)
//
// [BARU] Sekarang mendukung mode RESYNC: kalau body berisi targetScriptId
// dan/atau targetShotlistId, dokumen yang sudah ada itu di-UPDATE in-place
// (bukan bikin dokumen duplikat baru). Dipakai untuk tombol
// "Update Breakdown & Shotlist" di ScreenplayEditor.
// =============================================
router.post("/filmmaking-documents/:id/ai-breakdown", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { targetScriptId, targetShotlistId } = req.body as { targetScriptId?: string; targetShotlistId?: string };

    // Verify access
    const access = await requireDocumentAccess(id, req.user.id);
    if (!access) {
      res.status(404).json({ error: "Document not found or no access" });
      return;
    }

    const contentData = (access.document.content as any) || {};
    const text = contentData?.text;
    if (!text) {
      res.status(400).json({ error: "No text found in this document to breakdown." });
      return;
    }

    const systemPrompt = `You are an expert film producer and director assistant.
You will be given a screenplay/script text.
Your task is to automatically generate a Script Breakdown and a Shotlist from this text.
Output MUST be valid JSON matching exactly this structure (no markdown fences, just the raw JSON object):
{
  "scenes": [
    {
      "id": "unique-string-1",
      "sceneNumber": "Scene 1",
      "description": "Brief description of the scene",
      "location": "INT. LIVING ROOM",
      "timeOfDay": "DAY",
      "duration": "1 min",
      "cast": [],
      "dialogue": "Extracted dialogue snippet or summary"
    }
  ],
  "shots": [
    {
      "id": "unique-string-2",
      "sceneNumber": "Scene 1",
      "shotNumber": "1",
      "description": "Wide shot showing the whole room",
      "cameraAngle": "Wide",
      "duration": "10s",
      "props": "Sofa, TV",
      "talents": "John",
      "notes": "Establish the messy room"
    }
  ]
}
Return ONLY the raw JSON object.

LANGUAGE: Write all text content (description, dialogue, notes, etc.) in the SAME language as the input screenplay text. If it's in Bahasa Indonesia, respond in Bahasa Indonesia. If in English, respond in English. Keep JSON keys in English regardless.`;

    const aiResponse = await chatCompletion([{ role: "user", content: text }], systemPrompt);

    let parsedData: any;
    try {
      parsedData = parseAiJson(aiResponse);
    } catch (parseErr) {
      logger.error({ parseErr, aiResponse }, "ai-breakdown.parse_failed");
      res.status(500).json({ error: "AI returned invalid format. Please try again.", raw: aiResponse.substring(0, 400) });
      return;
    }

    const isResync = !!(targetScriptId || targetShotlistId);
    let scriptDoc: any;
    let shotlistDoc: any;

    if (targetScriptId) {
      const scriptAccess = await requireDocumentAccess(targetScriptId, req.user.id, "editor");
      if (!scriptAccess) {
        res.status(403).json({ error: "No edit access to target script document" });
        return;
      }
      [scriptDoc] = await db
        .update(filmmakingDocumentsTable)
        .set({ content: { ...(scriptAccess.document.content as any), scenes: parsedData.scenes || [] }, updatedAt: new Date() })
        .where(eq(filmmakingDocumentsTable.id, targetScriptId))
        .returning();
    } else {
      [scriptDoc] = await db
        .insert(filmmakingDocumentsTable)
        .values({
          crewId: req.user.id,
          projectId: access.document.projectId,
          docType: "script",
          title: `(AI) Script Breakdown - ${access.document.title}`,
          content: { scenes: parsedData.scenes || [] },
          isDraft: true,
        })
        .returning();
    }

    if (targetShotlistId) {
      const shotlistAccess = await requireDocumentAccess(targetShotlistId, req.user.id, "editor");
      if (!shotlistAccess) {
        res.status(403).json({ error: "No edit access to target shotlist document" });
        return;
      }
      [shotlistDoc] = await db
        .update(filmmakingDocumentsTable)
        .set({ content: { ...(shotlistAccess.document.content as any), shots: parsedData.shots || [] }, updatedAt: new Date() })
        .where(eq(filmmakingDocumentsTable.id, targetShotlistId))
        .returning();
    } else {
      [shotlistDoc] = await db
        .insert(filmmakingDocumentsTable)
        .values({
          crewId: req.user.id,
          projectId: access.document.projectId,
          docType: "shotlist",
          title: `(AI) Shotlist - ${access.document.title}`,
          content: { shots: parsedData.shots || [] },
          isDraft: true,
        })
        .returning();
    }

    // Tag / perbarui metadata pipeline supaya ketiga dokumen saling kenal satu sama lain
    const pipeline: PipelineLinks = {
      ...(contentData._pipeline?.conceptId ? { conceptId: contentData._pipeline.conceptId } : {}),
      screenplayId: id,
      scriptId: scriptDoc.id,
      shotlistId: shotlistDoc.id,
    };

    await tagPipeline(id, contentData, pipeline);
    await tagPipeline(scriptDoc.id, scriptDoc.content, pipeline);
    await tagPipeline(shotlistDoc.id, shotlistDoc.content, pipeline);
    if (pipeline.conceptId) {
      const conceptAccess = await requireDocumentAccess(pipeline.conceptId, req.user.id).catch(() => null);
      if (conceptAccess) {
        await tagPipeline(pipeline.conceptId, conceptAccess.document.content, pipeline);
      }
    }

    res.status(isResync ? 200 : 201).json({
      scriptBreakdownId: scriptDoc.id,
      shotlistId: shotlistDoc.id,
      pipeline,
      updated: isResync,
    });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.ai-breakdown.error");
    res.status(500).json({ error: "Failed to generate AI breakdown", details: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================
// POST /filmmaking-documents/:id/ai-concept-generate
// Auto generate Screenplay + Script Breakdown + Shotlist FROM a Concept document
//
// [BARU] Sekarang mendukung mode RESYNC: kalau body berisi targetScreenplayId /
// targetScriptId / targetShotlistId, dokumen itu di-UPDATE in-place (bukan
// bikin duplikat baru tiap kali tombol "Generate" dipencet ulang).
// =============================================
router.post("/filmmaking-documents/:id/ai-concept-generate", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { targetScreenplayId, targetScriptId, targetShotlistId } = req.body as {
      targetScreenplayId?: string;
      targetScriptId?: string;
      targetShotlistId?: string;
    };

    // Verify access
    const access = await requireDocumentAccess(id, req.user.id);
    if (!access) {
      res.status(404).json({ error: "Document not found or no access" });
      return;
    }

    if (access.document.docType !== "concept") {
      res.status(400).json({ error: "This endpoint only works on Concept documents" });
      return;
    }

    const contentData = (access.document.content as any) || {};
    const notes: string = contentData?.notes || "";
    const ideas: string[] = contentData?.ideas || [];

    if (!notes.trim() && ideas.length === 0) {
      res.status(400).json({ error: "Concept document has no notes or ideas to generate from." });
      return;
    }

    const conceptText = [
      notes.trim() ? `CONCEPT NOTES:\n${notes}` : "",
      ideas.length > 0 ? `QUICK IDEAS:\n${ideas.map((i: string) => `- ${i}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `You are an expert film director and production manager.
You will receive a creative concept brief (notes and ideas) for a video production.
Your job is to generate a detailed Script Breakdown and Shotlist based on this concept.

Output MUST be a single valid JSON object with this exact structure (no markdown fences, no explanation - ONLY the raw JSON):
{
  "screenplay": "A short 2-3 paragraph narrative screenplay written from the concept",
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": "Scene 1",
      "description": "Opening scene description",
      "location": "INT. STUDIO - DAY",
      "timeOfDay": "DAY",
      "duration": "30s",
      "cast": ["Talent Name"],
      "dialogue": "Key dialogue or VO script for this scene"
    }
  ],
  "shots": [
    {
      "id": "shot-1",
      "sceneNumber": "Scene 1",
      "shotNumber": "1",
      "description": "Establishing wide shot",
      "cameraAngle": "Wide",
      "duration": "5s",
      "props": "Product, table",
      "talents": "Talent Name",
      "notes": "Focus on product hero shot"
    }
  ]
}
Generate at least 3-5 scenes and 5-10 shots. Make it professional and production-ready.
Return ONLY the raw JSON object.

LANGUAGE: Write all text content (screenplay, description, dialogue, notes, etc.) in the SAME language as the concept notes/ideas provided by the user. If they wrote in Bahasa Indonesia, respond fully in Bahasa Indonesia. If in English, respond in English. Keep JSON keys in English regardless.`;

    const aiResponse = await chatCompletion([{ role: "user", content: conceptText }], systemPrompt);

    let parsedData: any;
    try {
      parsedData = parseAiJson(aiResponse);
    } catch (parseErr) {
      logger.error({ parseErr, aiResponse }, "ai-concept-generate.parse_failed");
      res.status(500).json({ error: "AI returned invalid format. Please try again.", raw: aiResponse.substring(0, 400) });
      return;
    }

    const projectId = access.document.projectId;
    const docTitle = access.document.title;
    const userId = req.user.id;
    const isResync = !!(targetScreenplayId || targetScriptId || targetShotlistId);

    async function upsertDoc(targetId: string | undefined, docType: string, title: string, newContent: any) {
      if (targetId) {
        const targetAccess = await requireDocumentAccess(targetId, userId, "editor");
        if (!targetAccess) {
          throw new Error(`No edit access to target ${docType} document`);
        }
        const [updated] = await db
          .update(filmmakingDocumentsTable)
          .set({ content: { ...(targetAccess.document.content as any), ...newContent }, updatedAt: new Date() })
          .where(eq(filmmakingDocumentsTable.id, targetId))
          .returning();
        return updated;
      }
      const [created] = await db
        .insert(filmmakingDocumentsTable)
        .values({ crewId: userId, projectId, docType, title, content: newContent, isDraft: true })
        .returning();
      return created;
    }

    let scriptDoc: any, shotlistDoc: any, screenplayDoc: any;
    try {
      scriptDoc = await upsertDoc(targetScriptId, "script", `(AI) Script Breakdown - ${docTitle}`, { scenes: parsedData.scenes || [] });
      shotlistDoc = await upsertDoc(targetShotlistId, "shotlist", `(AI) Shotlist - ${docTitle}`, { shots: parsedData.shots || [] });
      screenplayDoc = await upsertDoc(targetScreenplayId, "screenplay", `(AI) Screenplay - ${docTitle}`, { text: parsedData.screenplay || "" });
    } catch (accessErr) {
      res.status(403).json({ error: accessErr instanceof Error ? accessErr.message : "No access to target document" });
      return;
    }

    const pipeline: PipelineLinks = {
      conceptId: id,
      screenplayId: screenplayDoc.id,
      scriptId: scriptDoc.id,
      shotlistId: shotlistDoc.id,
    };

    await tagPipeline(id, contentData, pipeline);
    await tagPipeline(screenplayDoc.id, screenplayDoc.content, pipeline);
    await tagPipeline(scriptDoc.id, scriptDoc.content, pipeline);
    await tagPipeline(shotlistDoc.id, shotlistDoc.content, pipeline);

    res.status(isResync ? 200 : 201).json({
      scriptBreakdownId: scriptDoc.id,
      shotlistId: shotlistDoc.id,
      screenplayId: screenplayDoc.id,
      scenesCount: (parsedData.scenes || []).length,
      shotsCount: (parsedData.shots || []).length,
      pipeline,
      updated: isResync,
    });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.ai-concept-generate.error");
    res.status(500).json({ error: "Failed to generate from concept", details: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================
// POST /filmmaking-documents/:id/ai-generate-scenes
// Dipakai dari ScriptBreakdownEditor: generate beberapa scene baru
// dari brief singkat, ditambahkan (append) ke scene yang sudah ada.
// =============================================
router.post("/filmmaking-documents/:id/ai-generate-scenes", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { brief, count } = req.body as { brief?: string; count?: number };

    if (!brief || !brief.trim()) {
      res.status(400).json({ error: "brief is required" });
      return;
    }

    const access = await requireDocumentAccess(id, req.user.id, "editor");
    if (!access) {
      res.status(403).json({ error: "No edit access to this document" });
      return;
    }

    if (access.document.docType !== "script") {
      res.status(400).json({ error: "This endpoint only works on Script Breakdown documents" });
      return;
    }

    const existingContent = (access.document.content as any) || {};
    const existingScenes = existingContent.scenes || [];
    const targetCount = Math.min(Math.max(count || 4, 1), 12);

    const systemPrompt = `You are an expert film producer. Generate a scene-by-scene breakdown for a video production based on the brief provided.
Output ONLY a raw JSON object (no markdown fences) with this exact structure:
{
  "scenes": [
    {
      "sceneNumber": "Scene 1",
      "description": "What happens in this scene",
      "location": "INT./EXT. LOCATION",
      "timeOfDay": "DAY",
      "duration": "30s",
      "cast": ["Talent Name"],
      "dialogue": "Key dialogue or VO"
    }
  ]
}
Generate exactly ${targetCount} scenes, numbered continuing from Scene ${existingScenes.length + 1}. Return ONLY the JSON object.

LANGUAGE: Write all text content in the SAME language as the brief provided by the user. If the brief is in Bahasa Indonesia, respond fully in Bahasa Indonesia. If in English, respond in English. Keep JSON keys in English regardless.`;

    const aiResponse = await chatCompletion([{ role: "user", content: brief }], systemPrompt);

    let parsedData: any;
    try {
      parsedData = parseAiJson(aiResponse);
    } catch (parseErr) {
      logger.error({ parseErr, aiResponse }, "ai-generate-scenes.parse_failed");
      res.status(500).json({ error: "AI returned invalid format. Please try again.", raw: aiResponse.substring(0, 400) });
      return;
    }

    const newScenes = (parsedData.scenes || []).map((s: any) => ({
      id: makeId("scene"),
      sceneNumber: s.sceneNumber || "",
      description: s.description || "",
      location: s.location || "",
      timeOfDay: s.timeOfDay || "DAY",
      duration: s.duration || "",
      cast: Array.isArray(s.cast) ? s.cast : (s.cast ? [s.cast] : []),
      dialogue: s.dialogue || "",
    }));

    const updatedScenes = [...existingScenes, ...newScenes];

    const [updated] = await db
      .update(filmmakingDocumentsTable)
      .set({ content: { ...existingContent, scenes: updatedScenes }, updatedAt: new Date() })
      .where(eq(filmmakingDocumentsTable.id, id))
      .returning();

    res.json({ document: updated, addedCount: newScenes.length });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.ai-generate-scenes.error");
    res.status(500).json({ error: "Failed to generate scenes", details: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================
// POST /filmmaking-documents/:id/ai-fill-scene
// Dipakai dari ScriptBreakdownEditor: lengkapi/perkaya satu scene
// tertentu berdasarkan prompt singkat dari user.
// =============================================
router.post("/filmmaking-documents/:id/ai-fill-scene", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { sceneId, prompt } = req.body as { sceneId?: string; prompt?: string };

    if (!sceneId || !prompt || !prompt.trim()) {
      res.status(400).json({ error: "sceneId and prompt are required" });
      return;
    }

    const access = await requireDocumentAccess(id, req.user.id, "editor");
    if (!access) {
      res.status(403).json({ error: "No edit access to this document" });
      return;
    }

    if (access.document.docType !== "script") {
      res.status(400).json({ error: "This endpoint only works on Script Breakdown documents" });
      return;
    }

    const existingContent = (access.document.content as any) || {};
    const scenes = existingContent.scenes || [];
    const sceneIndex = scenes.findIndex((s: any) => s.id === sceneId);
    if (sceneIndex === -1) {
      res.status(404).json({ error: "Scene not found" });
      return;
    }

    const currentScene = scenes[sceneIndex];

    const systemPrompt = `You are an expert film producer helping fill in details for a single scene.
Given the current scene data (may be partially empty) and a user instruction, improve/complete the scene.
Output ONLY a raw JSON object (no markdown fences) with this exact structure:
{
  "description": "...",
  "location": "...",
  "timeOfDay": "DAY",
  "duration": "...",
  "cast": ["..."],
  "dialogue": "..."
}
Keep any good existing content the user already wrote, just improve or fill in the gaps. Return ONLY the JSON object.

LANGUAGE: Write all text content in the SAME language as the existing scene data and/or the user's instruction. If they're in Bahasa Indonesia, respond fully in Bahasa Indonesia. If in English, respond in English. Keep JSON keys in English regardless.`;

    const userMessage = `CURRENT SCENE DATA:\n${JSON.stringify(currentScene, null, 2)}\n\nUSER INSTRUCTION:\n${prompt}`;

    const aiResponse = await chatCompletion([{ role: "user", content: userMessage }], systemPrompt);

    let parsedData: any;
    try {
      parsedData = parseAiJson(aiResponse);
    } catch (parseErr) {
      logger.error({ parseErr, aiResponse }, "ai-fill-scene.parse_failed");
      res.status(500).json({ error: "AI returned invalid format. Please try again.", raw: aiResponse.substring(0, 400) });
      return;
    }

    const updatedScene = {
      ...currentScene,
      description: parsedData.description ?? currentScene.description,
      location: parsedData.location ?? currentScene.location,
      timeOfDay: parsedData.timeOfDay ?? currentScene.timeOfDay,
      duration: parsedData.duration ?? currentScene.duration,
      cast: Array.isArray(parsedData.cast) ? parsedData.cast : currentScene.cast,
      dialogue: parsedData.dialogue ?? currentScene.dialogue,
    };

    const updatedScenes = [...scenes];
    updatedScenes[sceneIndex] = updatedScene;

    const [updated] = await db
      .update(filmmakingDocumentsTable)
      .set({ content: { ...existingContent, scenes: updatedScenes }, updatedAt: new Date() })
      .where(eq(filmmakingDocumentsTable.id, id))
      .returning();

    res.json({ document: updated, scene: updatedScene });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.ai-fill-scene.error");
    res.status(500).json({ error: "Failed to fill scene", details: err instanceof Error ? err.message : String(err) });
  }
});

// =============================================
// POST /filmmaking-documents/:id/ai-generate-shots
// Dipakai dari ShotlistEditor: generate shot baru (append) dari
// brief bebas, dan/atau import otomatis dari dokumen Script Breakdown/Screenplay lain.
// =============================================
router.post("/filmmaking-documents/:id/ai-generate-shots", requireUniversalAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = req.params as { id: string };
    const { brief, sourceDocumentId } = req.body as { brief?: string; sourceDocumentId?: string };

    const access = await requireDocumentAccess(id, req.user.id, "editor");
    if (!access) {
      res.status(403).json({ error: "No edit access to this document" });
      return;
    }

    if (access.document.docType !== "shotlist") {
      res.status(400).json({ error: "This endpoint only works on Shotlist documents" });
      return;
    }

    const contextParts: string[] = [];

    if (brief && brief.trim()) {
      contextParts.push(`BRIEF:\n${brief.trim()}`);
    }

    if (sourceDocumentId) {
      const sourceAccess = await requireDocumentAccess(sourceDocumentId, req.user.id);
      if (!sourceAccess) {
        res.status(404).json({ error: "Source document not found or no access" });
        return;
      }

      const sourceContent = sourceAccess.document.content as any;
      if (sourceAccess.document.docType === "script") {
        const scenesText = (sourceContent?.scenes || [])
          .map((s: any, i: number) =>
            `Scene ${s.sceneNumber || i + 1} (${s.location || "-"}, ${s.timeOfDay || "-"}): ${s.description || ""}${s.dialogue ? ` | Dialogue: ${s.dialogue}` : ""}`
          )
          .join("\n");
        if (scenesText) contextParts.push(`SCRIPT BREAKDOWN:\n${scenesText}`);
      } else if (sourceAccess.document.docType === "screenplay") {
        if (sourceContent?.text) contextParts.push(`SCREENPLAY:\n${sourceContent.text}`);
      } else {
        res.status(400).json({ error: "sourceDocumentId must point to a Script Breakdown or Screenplay document" });
        return;
      }
    }

    if (contextParts.length === 0) {
      res.status(400).json({ error: "Provide a brief and/or sourceDocumentId to generate shots from." });
      return;
    }

    const existingContent = (access.document.content as any) || {};
    const existingShots = existingContent.shots || [];

    const systemPrompt = `You are an expert cinematographer and camera assistant. Based on the context provided (a brief and/or a script breakdown/screenplay), generate a detailed camera shotlist.
Output ONLY a raw JSON object (no markdown fences) with this exact structure:
{
  "shots": [
    {
      "sceneNumber": "Scene 1",
      "description": "Wide establishing shot of the room",
      "cameraAngle": "Wide",
      "duration": "10s",
      "props": "Sofa, TV",
      "talents": "John",
      "notes": "Establish the mood"
    }
  ]
}
cameraAngle must be one of: Wide, Medium, Close-up, Extreme Close-up, POV, Over-the-shoulder, Bird's Eye, Low Angle, Dutch Angle, Tracking.
Generate a practical, production-ready number of shots (aim for good coverage: establishing + medium + close-up per scene where relevant). Return ONLY the JSON object.

LANGUAGE: Write all text content (description, notes, etc.) in the SAME language as the context provided (brief and/or script breakdown/screenplay). If it's in Bahasa Indonesia, respond fully in Bahasa Indonesia. If in English, respond in English. Keep JSON keys in English regardless.`;

    const aiResponse = await chatCompletion([{ role: "user", content: contextParts.join("\n\n") }], systemPrompt);

    let parsedData: any;
    try {
      parsedData = parseAiJson(aiResponse);
    } catch (parseErr) {
      logger.error({ parseErr, aiResponse }, "ai-generate-shots.parse_failed");
      res.status(500).json({ error: "AI returned invalid format. Please try again.", raw: aiResponse.substring(0, 400) });
      return;
    }

    const generatedShots = parsedData.shots || [];
    const newShots = generatedShots.map((s: any, idx: number) => ({
      id: makeId("shot"),
      sceneNumber: s.sceneNumber || "",
      shotNumber: String(existingShots.length + idx + 1),
      description: s.description || "",
      cameraAngle: s.cameraAngle || "Wide",
      duration: s.duration || "",
      props: s.props || "",
      talents: s.talents || "",
      notes: s.notes || "",
    }));

    const updatedShots = [...existingShots, ...newShots];

    const [updated] = await db
      .update(filmmakingDocumentsTable)
      .set({ content: { ...existingContent, shots: updatedShots }, updatedAt: new Date() })
      .where(eq(filmmakingDocumentsTable.id, id))
      .returning();

    res.json({ document: updated, addedCount: newShots.length });
  } catch (err) {
    logger.error({ err }, "filmmaking-documents.ai-generate-shots.error");
    res.status(500).json({ error: "Failed to generate shots", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
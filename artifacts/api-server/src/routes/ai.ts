import { Router, type IRouter } from "express";
import { requireAuth } from "./middleware.js";
import { getCrewMemberIdFromToken } from "./crew.js";
import { db, teamMembersTable, projectsTable, projectTasksTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

const router: IRouter = Router();

// =============================================
// Provider config
// Prioritas: Gemini (kalau GEMINI_API_KEY / GOOGLE_API_KEY ada) -> OpenAI (kalau
// OPENAI_API_KEY ada) -> Mock (kalau dua-duanya kosong, biar dev tetap jalan).
// =============================================
const GEMINI_KEY = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"] ?? "";
const GEMINI_MODEL = process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash";

const OPENAI_BASE = process.env["OPENAI_API_BASE"] ?? "https://api.openai.com/v1";
const OPENAI_KEY = process.env["OPENAI_API_KEY"] ?? "";

let genAiClient: GoogleGenerativeAI | null = null;
function getGenAiClient(): GoogleGenerativeAI {
  if (!genAiClient) genAiClient = new GoogleGenerativeAI(GEMINI_KEY);
  return genAiClient;
}

async function callGemini(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
  const model = getGenAiClient().getGenerativeModel({
    model: GEMINI_MODEL,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  // Gemini pakai role "user"/"model" (bukan "assistant"), dan history harus
  // diawali "user". Pesan terakhir dikirim lewat sendMessage, sisanya jadi history.
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "assistant" || m.role === "model" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return "Maaf, tidak ada pesan untuk diproses.";

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(lastMessage.content);
  return result.response.text();
}

async function callOpenAi(messages: { role: string; content: string }[], systemPrompt?: string): Promise<string> {
  const msgs = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: msgs, max_tokens: 1000 }),
  });
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? "Maaf, terjadi kesalahan dari provider AI.";
}

function mockReply(messages: { role: string; content: string }[]): string {
  const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || "";
  if (lastMsg.includes("halo") || lastMsg.includes("hai")) return "Halo! Saya adalah Frameless AI. Ada yang bisa saya bantu terkait videografi atau manajemen proyek hari ini?";
  if (lastMsg.includes("konsep") || lastMsg.includes("ide")) return "Untuk konsep video yang menarik, coba fokus pada storytelling yang kuat dan hook di 3 detik pertama. Ingin saya buatkan draf script singkat?";
  if (lastMsg.includes("teknis") || lastMsg.includes("kamera") || lastMsg.includes("lensa")) return "Untuk hasil sinematik, gunakan aturan 180 derajat shutter speed, usahakan shoot di frame rate 24fps, dan gunakan lighting dengan kontras (seperti Rembrandt lighting).";
  if (lastMsg.includes("proyek") || lastMsg.includes("jadwal")) return "Pastikan semua anggota tim sudah di-assign pada task masing-masing di dashboard. Komunikasi yang lancar adalah kunci proyek yang sukses!";
  return "Ini adalah respons AI Mode Mock karena belum ada API key AI (Gemini/OpenAI) yang diatur di .env. Tapi secara konseptual, fitur AI sudah terintegrasi penuh!";
}

function friendlyAiError(err: any): Error {
  const status = err?.status || err?.response?.status;
  if (status === 429) {
    return new Error(
      "Provider AI kena rate limit / kuota harian habis (429). Free tier Gemini Flash biasanya reset tengah malam waktu Pasifik (~siang/sore WIB). Coba lagi beberapa saat lagi, atau kurangi frekuensi generate."
    );
  }
  if (status === 401 || status === 403) {
    return new Error("API key AI ditolak provider (401/403). Cek lagi apakah GEMINI_API_KEY di .env valid dan belum di-revoke.");
  }
  if (status === 404) {
    return new Error("Model AI yang diminta tidak ditemukan/sudah tidak didukung provider (404). Cek env GEMINI_MODEL.");
  }
  return new Error(`Provider AI gagal merespons: ${err?.message || "unknown error"}`);
}

export async function chatCompletion(messages: { role: string; content: string }[], systemPrompt?: string) {
  if (GEMINI_KEY.trim()) {
    try {
      return await callGemini(messages, systemPrompt);
    } catch (err) {
      console.error("[AI] Gemini call failed:", err);
      if (OPENAI_KEY.trim()) {
        try {
          return await callOpenAi(messages, systemPrompt);
        } catch (err2) {
          console.error("[AI] OpenAI fallback also failed:", err2);
          throw friendlyAiError(err);
        }
      }
      throw friendlyAiError(err);
    }
  }

  if (OPENAI_KEY.trim()) {
    try {
      return await callOpenAi(messages, systemPrompt);
    } catch (err) {
      console.error("[AI] OpenAI call failed:", err);
      throw friendlyAiError(err);
    }
  }

  // Tidak ada API key AI sama sekali -> mock, biar dev tetap bisa jalan
  await new Promise((r) => setTimeout(r, 800));
  return mockReply(messages);
}

const CREW_SYSTEM = `Kamu adalah asisten AI untuk crew/tim produksi video Frameless Creative. 
Bantu crew dengan pertanyaan seputar videografi, produksi, post-production, alur kerja, dan manajemen proyek.
Jawab dalam Bahasa Indonesia yang ramah dan profesional. Berikan jawaban yang praktis dan berguna.`;

const ADMIN_SYSTEM = `Kamu adalah asisten AI untuk admin Frameless Creative, perusahaan produksi video.
Bantu dengan manajemen bisnis, analisis keuangan, strategi pemasaran, manajemen tim, dan pertanyaan operasional.
Jawab dalam Bahasa Indonesia yang profesional.`;

export { CREW_SYSTEM, ADMIN_SYSTEM };

router.post("/ai/chat", async (req, res): Promise<void> => {
  try {
    const { messages, role } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: "Messages required" }); return; }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const crewMemberId = token ? getCrewMemberIdFromToken(token) : null;
    const isCrew = role === "crew" || !!crewMemberId;

    let systemPrompt = isCrew ? CREW_SYSTEM : ADMIN_SYSTEM;

    // === CREW CONTEXT INJECTION (makes AI truly know the project) ===
    if (crewMemberId) {
      try {
        // Get member info
        const [member] = await db.select().from(teamMembersTable).where(eq(teamMembersTable.id, crewMemberId)).limit(1);

        // Get projects this crew is involved in
        const projects = await db.select().from(projectsTable)
          .where(or(
            eq(projectsTable.assignedMemberId, crewMemberId),
            // Note: for simplicity we also fetch active projects
          ))
          .limit(5);

        // Get their active tasks
        const tasks = await db.select().from(projectTasksTable)
          .where(eq(projectTasksTable.memberId, crewMemberId))
          .limit(8);

        const context = {
          currentUser: member ? { name: member.name, role: member.role, department: member.department } : null,
          myActiveProjects: projects.map((p: any) => ({ id: p.id, title: p.title, client: p.client, status: p.status, deadline: p.deadline })),
          myCurrentTasks: tasks.map((t: any) => ({ title: t.title, status: t.status, dueDate: t.dueDate, priority: t.priority }))
        };

        systemPrompt = `${CREW_SYSTEM}

=== KONTEKS PROJECT SAAT INI ===
Kamu sedang membantu ${member?.name || 'crew'} (${member?.role || ''}).

Proyek aktif yang sedang dikerjakan:
${JSON.stringify(context.myActiveProjects, null, 2)}

Tugas yang sedang ditugaskan kepadanya:
${JSON.stringify(context.myCurrentTasks, null, 2)}

Gunakan konteks di atas untuk memberikan jawaban yang relevan dan membantu pekerjaan sehari-hari.`;
      } catch (ctxErr) {
        console.warn("[AI] Failed to load crew context:", ctxErr);
      }
    }

    const reply = await chatCompletion(messages, systemPrompt);
    res.json({ reply });
  } catch (e) {
    console.error("[AI Chat] Error:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "AI service error" });
  }
});

export default router;
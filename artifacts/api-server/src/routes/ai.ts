import { Router, type IRouter } from "express";
import { requireAuth } from "./middleware";
import { crewTokenStore } from "./crew";

const router: IRouter = Router();

const OPENAI_BASE = process.env["OPENAI_API_BASE"] ?? "https://api.openai.com/v1";
const OPENAI_KEY = process.env["OPENAI_API_KEY"] ?? "";

async function chatCompletion(messages: { role: string; content: string }[], systemPrompt?: string) {
  const msgs = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-5-mini", messages: msgs, max_tokens: 1000 }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? "Maaf, terjadi kesalahan.";
}

const CREW_SYSTEM = `Kamu adalah asisten AI untuk crew/tim produksi video Frameless Creative. 
Bantu crew dengan pertanyaan seputar videografi, produksi, post-production, alur kerja, dan manajemen proyek.
Jawab dalam Bahasa Indonesia yang ramah dan profesional. Berikan jawaban yang praktis dan berguna.`;

const ADMIN_SYSTEM = `Kamu adalah asisten AI untuk admin Frameless Creative, perusahaan produksi video.
Bantu dengan manajemen bisnis, analisis keuangan, strategi pemasaran, manajemen tim, dan pertanyaan operasional.
Jawab dalam Bahasa Indonesia yang profesional.`;

router.post("/ai/chat", async (req, res): Promise<void> => {
  try {
    const { messages, role } = req.body;
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: "Messages required" }); return; }

    const isCrewToken = req.headers.authorization?.startsWith("Bearer ")
      ? crewTokenStore.has(req.headers.authorization.slice(7))
      : false;

    const systemPrompt = (role === "crew" || isCrewToken) ? CREW_SYSTEM : ADMIN_SYSTEM;
    const reply = await chatCompletion(messages, systemPrompt);
    res.json({ reply });
  } catch (e) {
    res.status(500).json({ error: "AI service error" });
  }
});

export default router;

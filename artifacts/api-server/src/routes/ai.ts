import { Router, type IRouter } from "express";
import { requireAuth } from "./middleware";
import { crewTokenStore } from "./crew";

const router: IRouter = Router();

const OPENAI_BASE = process.env["OPENAI_API_BASE"] ?? "https://api.openai.com/v1";
const OPENAI_KEY = process.env["OPENAI_API_KEY"] ?? "";

export async function chatCompletion(messages: { role: string; content: string }[], systemPrompt?: string) {
  const msgs = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  if (!OPENAI_KEY || OPENAI_KEY.trim() === "") {
    // Smart Mock AI response if no API key is provided
    const lastMsg = messages[messages.length - 1]?.content.toLowerCase() || "";
    let reply = "Maaf, saya tidak mengerti. Bisa jelaskan lebih spesifik?";
    if (lastMsg.includes("halo") || lastMsg.includes("hai")) reply = "Halo! Saya adalah Frameless AI. Ada yang bisa saya bantu terkait videografi atau manajemen proyek hari ini?";
    else if (lastMsg.includes("konsep") || lastMsg.includes("ide")) reply = "Untuk konsep video yang menarik, coba fokus pada storytelling yang kuat dan hook di 3 detik pertama. Ingin saya buatkan draf script singkat?";
    else if (lastMsg.includes("teknis") || lastMsg.includes("kamera") || lastMsg.includes("lensa")) reply = "Untuk hasil sinematik, gunakan aturan 180 derajat shutter speed, usahakan shoot di frame rate 24fps, dan gunakan lighting dengan kontras (seperti Rembrandt lighting).";
    else if (lastMsg.includes("proyek") || lastMsg.includes("jadwal")) reply = "Pastikan semua anggota tim sudah di-assign pada task masing-masing di dashboard. Komunikasi yang lancar adalah kunci proyek yang sukses!";
    else reply = "Ini adalah respons AI Mode Mock karena API Key belum diatur di .env. Tapi secara konseptual, fitur AI sudah terintegrasi penuh!";

    // Simulate API delay
    await new Promise(r => setTimeout(r, 1200));
    return reply;
  }

  const res = await fetch(`${OPENAI_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: "gpt-4o-mini", messages: msgs, max_tokens: 1000 }),
  });
  const data = await res.json() as any;
  return data.choices?.[0]?.message?.content ?? "Maaf, terjadi kesalahan dari provider AI.";
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

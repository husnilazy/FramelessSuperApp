import { useState, useCallback, useEffect } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

interface AiEstimationFormProps {
  onClose: () => void;
  initialPrompt?: string;
}

export function AiEstimationForm({ onClose, initialPrompt }: AiEstimationFormProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [adjustedNote, setAdjustedNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: `Berikan estimasi harga dan durasi produksi video berdasarkan deskripsi berikut (sebutkan perkiraan biaya dalam Rupiah dan durasi dalam hari/minggu):\n\n${prompt}\n\nSertakan juga saran gaya video (misalnya, cinematic, vlog, animasi, dll.) dan teknologi yang mungkin digunakan (misalnya, kamera 4K, drone FPV, software VFX). Berikan jawaban yang ringkas dan langsung ke inti, format sebagai poin-poin.` }],
          model: "gemini-2.5-flash", // Ensure this matches a supported model in your backend
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to get AI estimation");
      }

      const data = await response.json();
      // Backend returns { reply } (ai chat) — accept common variants
      const text = (data.reply || data.response || data.result || (typeof data === "string" ? data : null) || JSON.stringify(data)).toString();

      // Clamp any rupiah numbers/ranges to min/max for Frameless
      const min = 5_000_000;
      const max = 50_000_000;

      function parseNum(s: string) {
        const digits = (s || "").replace(/[^0-9]/g, "");
        return digits ? parseInt(digits, 10) : NaN;
      }
      function fmt(n: number) {
        try { return 'Rp' + n.toLocaleString('id-ID'); } catch { return 'Rp' + n; }
      }

      // Range pattern: Rp 5.000.000 - Rp 10.000.000  OR IDR 5,000,000 - 10,000,000
      const rangeRe = /(?:(?:Rp|IDR)\s*)?([0-9][0-9.,]{2,})\s*(?:-|to|–)\s*(?:(?:Rp|IDR)\s*)?([0-9][0-9.,]{2,})/i;
      const singleRe = /(?:(?:Rp|IDR)\s*)?([0-9][0-9.,]{2,})/i;

      let adjustedText = text;
      let note: string | null = null;

      const r = text.match(rangeRe);
      if (r) {
        const a = parseNum(r[1]);
        const b = parseNum(r[2]);
        const low = isNaN(a) ? min : Math.max(min, Math.min(a, max));
        const high = isNaN(b) ? max : Math.max(min, Math.min(b, max));
        adjustedText = text.replace(rangeRe, `${fmt(low)} - ${fmt(high)}`);
        note = `Catatan: rentang harga disesuaikan ke minimal ${fmt(min)} dan maksimal ${fmt(max)}.`;
      } else {
        const s = text.match(singleRe);
        if (s) {
          const v = parseNum(s[1]);
          if (!isNaN(v)) {
            const clamped = Math.max(min, Math.min(v, max));
            adjustedText = text.replace(singleRe, `${fmt(clamped)}`);
            note = `Catatan: jumlah harga disesuaikan ke minimal ${fmt(min)} dan maksimal ${fmt(max)}.`;
          }
        }
      }

      setResult(adjustedText);
      setAdjustedNote(note);
    } catch (err: any) {
      setError(err.message || "An unknown error occurred.");
      toast({ variant: "destructive", title: "AI Error", description: err.message || "Failed to get AI estimation." });
    } finally {
      setLoading(false);
    }
  }, [prompt, toast]);

  useEffect(() => {
    if (initialPrompt && !prompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  const ipt = { width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, boxSizing: "border-box" as any };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.88)", backdropFilter: "blur(16px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,.12)", borderRadius: 28, padding: "24px 20px", width: "100%", maxWidth: 720, maxHeight: '80vh', overflowY: 'auto', position: "relative", boxShadow: "0 24px 80px rgba(0,0,0,.4)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,.07)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8 }}>AI Video Estimator</h3>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,.45)", marginBottom: 20 }}>Dapatkan perkiraan harga & saran gaya produksi video impianmu secara instan!</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Deskripsi Video Anda</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={5}
              placeholder="Misalnya: Video iklan produk skincare untuk Instagram Reels, durasi 30 detik, target audiens remaja putri, ingin gaya ceria dan estetik, ada talent 1 orang, shooting di 2 lokasi (indoor & outdoor)."
              style={{ ...ipt, resize: "vertical" }} required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px 20px", borderRadius: 12, background: OR, border: "none",
              color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              opacity: loading ? 0.7 : 1, transition: "opacity .2s"
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Menganalisis..." : "Dapatkan Estimasi AI"}
          </button>
        </form>

        {error && (
          <div style={{ marginTop: 24, padding: "16px", borderRadius: 12, background: "rgba(255,0,0,.15)", border: "1px solid rgba(255,0,0,.3)", color: "#fff", fontSize: 14 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>Error:</p>
            <p style={{ margin: "8px 0 0", color: "rgba(255,255,255,.7)" }}>{error}</p>
          </div>
        )}

        {result && (
          <div style={{ marginTop: 16, padding: "12px", borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "#fff", fontSize: 14, lineHeight: 1.6, maxHeight: '48vh', overflowY: 'auto', paddingRight: 10 }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: OR, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={16} /> Estimasi AI Anda:
            </h4>
            <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: result.replace(/\n/g, '<br />') }} />
          </div>
        )}
      </div>
    </div>
  );
}

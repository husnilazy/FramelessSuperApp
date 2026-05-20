// artifacts/frameless/src/components/ai-chat.tsx
// Floating AI Chat Widget — can be used in both Admin Layout and Crew Dashboard
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Loader2, Sparkles, ChevronDown, Trash2, Copy, Check } from "lucide-react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    ts: number;
}

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

const SYSTEM_PROMPT = `Kamu adalah AI Assistant untuk Frameless Creative, sebuah perusahaan video production dan media agency profesional yang berlokasi di Wonosobo, Central Java, Indonesia.

Tim yang menggunakan kamu adalah admin dan kru produksi video Frameless Creative.

Kamu bisa membantu dengan:
- Penulisan script dan konsep video
- Ide kreatif untuk konten dan kampanye
- Tips teknis videografi dan sinematografi
- Manajemen proyek dan jadwal produksi
- Copywriting untuk proposal klien
- Analisis tren konten media sosial
- Konsultasi bisnis kreatif
- Menjawab pertanyaan seputar industri film dan video

Gunakan bahasa Indonesia yang santai dan profesional. Jawab dengan ringkas tapi helpful.`;

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.35)", padding: "2px 4px", borderRadius: 4, transition: "color .15s" }}
            title="Copy"
        >
            {copied ? <Check size={11} color="#4ade80" /> : <Copy size={11} />}
        </button>
    );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg, dark }: { msg: Message; dark: boolean }) {
    const isUser = msg.role === "user";
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", marginBottom: 14 }}
        >
            {!isUser && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Bot size={10} color="#fff" />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: OR, letterSpacing: ".06em", textTransform: "uppercase" }}>Frameless AI</span>
                </div>
            )}
            <div style={{
                maxWidth: "88%", padding: "10px 14px", borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                background: isUser ? OR : dark ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.06)",
                color: isUser ? "#fff" : dark ? "rgba(255,255,255,.88)" : "#1a1d2e",
                fontSize: 13, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
                {msg.content}
            </div>
            {!isUser && (
                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                    <CopyBtn text={msg.content} />
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,.2)" }}>
                        {new Date(msg.ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            )}
        </motion.div>
    );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function Typing() {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: OR, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={10} color="#fff" />
            </div>
            <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderRadius: "4px 16px 16px 16px", background: "rgba(255,255,255,.07)" }}>
                {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: OR, animation: `dot .8s ease-in-out ${i * 0.15}s infinite alternate` }} />
                ))}
            </div>
            <style>{`@keyframes dot{from{opacity:.3;transform:translateY(0);}to{opacity:1;transform:translateY(-4px);}}`}</style>
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function AIChat({ dark = true }: { dark?: boolean }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
    useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 300); }, [open]);

    async function send() {
        const text = input.trim();
        if (!text || loading) return;
        setInput("");
        setError(null);

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: text, ts: Date.now() };
        setMessages(p => [...p, userMsg]);
        setLoading(true);

        try {
            const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

            const token = localStorage.getItem("token") || localStorage.getItem("crew_token");
            const headers: any = { "Content-Type": "application/json" };
            if (token) headers["Authorization"] = `Bearer ${token}`;

            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers,
                body: JSON.stringify({
                    messages: history,
                    role: localStorage.getItem("crew_token") ? "crew" : "admin"
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `API Error ${res.status}`);
            }

            const data = await res.json();
            const reply = data.reply || "Maaf, tidak ada respons.";

            setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: reply, ts: Date.now() }]);
        } catch (err: any) {
            setError(err.message || "Gagal menghubungi AI. Coba lagi.");
        } finally {
            setLoading(false);
        }
    }

    function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    }

    const bgPanel = dark ? "rgba(12,14,22,.97)" : "rgba(255,255,255,.97)";
    const borderC = dark ? "rgba(255,255,255,.09)" : "rgba(0,0,0,.1)";

    const STARTERS = [
        "Buat konsep video untuk brand launch",
        "Tips teknis untuk cinematic shot",
        "Bantu tulis script iklan 30 detik",
        "Ide konten Instagram yang viral",
    ];

    return (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 999, fontFamily: FONT }}>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, scale: .9, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: .9, y: 16 }}
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        style={{
                            position: "absolute", bottom: 64, right: 0,
                            width: "min(94vw,380px)",
                            background: bgPanel, border: `1px solid ${borderC}`,
                            borderRadius: 22, overflow: "hidden",
                            boxShadow: "0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset",
                            display: "flex", flexDirection: "column",
                            height: "min(82vh,580px)",
                        }}
                    >
                        {/* Header */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "14px 16px", borderBottom: `1px solid ${borderC}`,
                            background: dark ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.02)",
                            flexShrink: 0,
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg,${OR},#e84d00)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${OR}55` }}>
                                    <Sparkles size={15} color="#fff" />
                                </div>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 800, color: dark ? "#fff" : "#1a1d2e", margin: 0, letterSpacing: "-.01em" }}>Frameless AI</p>
                                    <p style={{ fontSize: 10, color: "rgba(74,222,128,.8)", margin: 0, display: "flex", alignItems: "center", gap: 3 }}>
                                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                                        Online · Claude Sonnet
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                                {messages.length > 0 && (
                                    <button onClick={() => setMessages([])}
                                        title="Clear chat"
                                        style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.4)" }}>
                                        <Trash2 size={12} />
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)}
                                    style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.5)" }}>
                                    <ChevronDown size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 0", scrollbarWidth: "none" }}>
                            {messages.length === 0 ? (
                                <div style={{ textAlign: "center", paddingTop: 28 }}>
                                    <div style={{ width: 52, height: 52, borderRadius: 16, background: `${OR}18`, border: `1.5px solid ${OR}33`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                                        <Sparkles size={22} color={OR} />
                                    </div>
                                    <p style={{ fontSize: 14, fontWeight: 700, color: dark ? "#fff" : "#1a1d2e", marginBottom: 6 }}>Halo! Ada yang bisa dibantu?</p>
                                    <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginBottom: 20, lineHeight: 1.6 }}>AI Assistant siap membantu kamu dengan ide kreatif, script, dan konsultasi produksi video.</p>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                        {STARTERS.map(s => (
                                            <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 100); }}
                                                style={{ padding: "9px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.09)", color: "rgba(255,255,255,.6)", fontSize: 12, cursor: "pointer", textAlign: "left", fontFamily: FONT, transition: "all .15s" }}
                                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = OR + "55"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.09)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.6)"; }}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {messages.map(m => <Bubble key={m.id} msg={m} dark={dark} />)}
                                    {loading && <Typing />}
                                    {error && (
                                        <div style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.2)", color: "#f87171", fontSize: 12, marginBottom: 12 }}>
                                            ⚠ {error}
                                        </div>
                                    )}
                                </>
                            )}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: "12px 12px 14px", borderTop: `1px solid ${borderC}`, flexShrink: 0 }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKey}
                                    placeholder="Ketik pesan... (Enter kirim, Shift+Enter baris baru)"
                                    rows={1}
                                    style={{
                                        flex: 1, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
                                        borderRadius: 12, padding: "10px 12px", color: dark ? "#fff" : "#1a1d2e",
                                        fontSize: 13, resize: "none", outline: "none", fontFamily: FONT,
                                        lineHeight: 1.5, maxHeight: 96, transition: "border-color .2s",
                                        scrollbarWidth: "none",
                                    }}
                                    onFocus={e => (e.target.style.borderColor = OR + "66")}
                                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,.1)")}
                                    onInput={e => {
                                        const t = e.target as HTMLTextAreaElement;
                                        t.style.height = "auto";
                                        t.style.height = Math.min(t.scrollHeight, 96) + "px";
                                    }}
                                />
                                <button
                                    onClick={send}
                                    disabled={!input.trim() || loading}
                                    style={{
                                        width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                                        background: input.trim() && !loading ? OR : "rgba(255,255,255,.08)",
                                        border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        transition: "all .2s",
                                    }}
                                >
                                    {loading
                                        ? <Loader2 size={16} color="rgba(255,255,255,.5)" style={{ animation: "spin .7s linear infinite" }} />
                                        : <Send size={15} color={input.trim() ? "#fff" : "rgba(255,255,255,.3)"} />
                                    }
                                </button>
                            </div>
                            <p style={{ fontSize: 9, color: "rgba(255,255,255,.2)", textAlign: "center", marginTop: 8, letterSpacing: ".04em" }}>
                                Powered by Claude · Frameless Creative Internal Tool
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Button */}
            <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: .95 }}
                onClick={() => setOpen(p => !p)}
                style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: open ? "#333" : `linear-gradient(135deg,${OR},#e84d00)`,
                    border: "none", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: open ? "none" : `0 8px 32px ${OR}66`,
                    transition: "background .2s, box-shadow .2s",
                }}
            >
                <AnimatePresence mode="wait">
                    {open
                        ? <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
                            <X size={20} color="#fff" />
                        </motion.div>
                        : <motion.div key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
                            <Sparkles size={20} color="#fff" />
                        </motion.div>
                    }
                </AnimatePresence>
            </motion.button>

            <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
    );
}
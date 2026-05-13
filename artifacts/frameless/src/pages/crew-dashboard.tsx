import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard, FolderOpen, Calendar, MessageCircle, Cpu, LogOut,
  CheckCircle2, Clock, Circle, ChevronRight, Send, Loader2, Bot, User,
  Film, Zap, AlertCircle, Menu, X
} from "lucide-react";

interface CrewMember { id: string; name: string; role: string; email?: string; department?: string; avatarUrl?: string; }
interface Task { id: string; title: string; status: string; progress?: number; dueDate?: string; projectId?: string; }
interface Project { id: string; title: string; status: string; progress?: number; }
interface ChatMsg { id: string; senderRole: string; senderName: string; message: string; createdAt: string; }
interface CalEvent { id: string; title: string; startDate: string; endDate?: string; color?: string; type?: string; description?: string; }

function authHeader() {
  const token = localStorage.getItem("crew_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getMember(): CrewMember | null {
  try { return JSON.parse(localStorage.getItem("crew_member") || "null"); } catch { return null; }
}

type Tab = "dashboard" | "projects" | "calendar" | "chat" | "ai";

export default function CrewDashboard() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [member, setMember] = useState<CrewMember | null>(getMember());
  const [tab, setTab] = useState<Tab>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: string; content: string }[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem("crew_token")) { navigate("/crew/login"); return; }
    loadData();
    const interval = setInterval(() => { if (tab === "chat") loadChat(); }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);
  useEffect(() => { aiEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages]);

  async function loadData() {
    const headers: any = { ...authHeader() };
    const [tasksRes, projectsRes, chatRes, eventsRes] = await Promise.allSettled([
      fetch("/api/crew/tasks", { headers }).then(r => r.json()),
      fetch("/api/crew/projects", { headers }).then(r => r.json()),
      fetch("/api/crew/chat", { headers }).then(r => r.json()),
      fetch("/api/crew/calendar", { headers }).then(r => r.json()),
    ]);
    if (tasksRes.status === "fulfilled") setTasks(tasksRes.value || []);
    if (projectsRes.status === "fulfilled") setProjects(projectsRes.value || []);
    if (chatRes.status === "fulfilled") setChatMsgs(chatRes.value || []);
    if (eventsRes.status === "fulfilled") setEvents(eventsRes.value || []);
  }

  async function loadChat() {
    const res = await fetch("/api/crew/chat", { headers: authHeader() as any });
    if (res.ok) setChatMsgs(await res.json());
  }

  async function sendChat() {
    if (!chatInput.trim() || !member) return;
    setSendingChat(true);
    try {
      const res = await fetch("/api/crew/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ message: chatInput, senderName: member.name }),
      });
      if (res.ok) { setChatInput(""); loadChat(); }
    } finally { setSendingChat(false); }
  }

  async function sendAiMessage() {
    if (!aiInput.trim()) return;
    const userMsg = { role: "user", content: aiInput };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ messages: updated, role: "crew" }),
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: "assistant", content: data.reply || "Maaf, terjadi kesalahan." }]);
    } catch { setAiMessages(prev => [...prev, { role: "assistant", content: "Tidak dapat terhubung ke AI." }]); }
    finally { setAiLoading(false); }
  }

  async function updateTaskStatus(id: string, status: string) {
    await fetch(`/api/crew/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeader() } as any,
      body: JSON.stringify({ status }),
    });
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    toast({ title: "Status task diperbarui" });
  }

  function logout() {
    localStorage.removeItem("crew_token");
    localStorage.removeItem("crew_member");
    navigate("/crew/login");
  }

  const doneTasks = tasks.filter(t => t.status === "DONE").length;
  const inProgressTasks = tasks.filter(t => t.status === "IN_PROGRESS").length;
  const todoTasks = tasks.filter(t => t.status === "TODO").length;

  const navItems: { id: Tab; icon: any; label: string }[] = [
    { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { id: "projects", icon: FolderOpen, label: "Proyek" },
    { id: "calendar", icon: Calendar, label: "Kalender" },
    { id: "chat", icon: MessageCircle, label: "Chat Admin" },
    { id: "ai", icon: Cpu, label: "AI Assistant" },
  ];

  const S = {
    wrap: { minHeight: "100vh", background: "#0a0a0a", color: "#fff", fontFamily: "'Inter', sans-serif", display: "flex" } as React.CSSProperties,
    sidebar: { width: "220px", background: "rgba(255,255,255,0.02)", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "24px 0", display: "flex", flexDirection: "column" as const },
    logo: { padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "16px" },
    navBtn: (active: boolean) => ({ width: "100%", display: "flex", alignItems: "center", gap: "10px", padding: "10px 20px", background: active ? "rgba(255,107,53,0.12)" : "none", border: "none", borderRight: active ? "2px solid #ff6b35" : "2px solid transparent", color: active ? "#ff6b35" : "rgba(255,255,255,0.6)", fontSize: "13px", fontWeight: active ? "600" : "400", cursor: "pointer", textAlign: "left" as const }),
    main: { flex: 1, overflow: "auto", padding: "32px 36px" },
    card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "16px", padding: "20px" } as React.CSSProperties,
    section: { fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase" as const, color: "rgba(255,255,255,0.4)", marginBottom: "16px" },
  };

  const statusIcon = (s: string) => s === "DONE" ? <CheckCircle2 size={14} color="#22c55e" /> : s === "IN_PROGRESS" ? <Loader2 size={14} color="#ff6b35" /> : <Circle size={14} color="rgba(255,255,255,0.3)" />;

  return (
    <div style={S.wrap}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.logo}>
          <div style={{ fontSize: "13px", fontWeight: "700", letterSpacing: "2px", color: "#fff" }}>FRAMELESS™</div>
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Crew Portal</div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
          {navItems.map(n => (
            <button key={n.id} style={S.navBtn(tab === n.id)} onClick={() => setTab(n.id)}>
              <n.icon size={16} />{n.label}
            </button>
          ))}
        </div>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff", marginBottom: "2px" }}>{member?.name || "Crew"}</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "12px" }}>{member?.role}</div>
          <button onClick={logout} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer" }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={S.main}>
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div>
            <div style={{ marginBottom: "28px" }}>
              <h1 style={{ fontSize: "26px", fontWeight: "800" }}>Selamat datang, {member?.name?.split(" ")[0]}! 👋</h1>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", marginTop: "4px" }}>{member?.department} · {member?.role}</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "28px" }}>
              {[{ label: "Todo", value: todoTasks, color: "rgba(255,255,255,0.3)", icon: Circle }, { label: "In Progress", value: inProgressTasks, color: "#ff6b35", icon: Loader2 }, { label: "Selesai", value: doneTasks, color: "#22c55e", icon: CheckCircle2 }].map(s => (
                <div key={s.label} style={{ ...S.card, display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ width: "44px", height: "44px", background: `${s.color}20`, borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <s.icon size={20} color={s.color} />
                  </div>
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div style={S.card}>
                <div style={S.section}>Task Terbaru</div>
                {tasks.slice(0, 5).map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {statusIcon(t.status)}
                    <span style={{ fontSize: "13px", flex: 1 }}>{t.title}</span>
                    <select value={t.status} onChange={e => updateTaskStatus(t.id, e.target.value)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: "6px", padding: "3px 8px", color: "#fff", fontSize: "11px", cursor: "pointer" }}>
                      <option value="TODO">Todo</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                ))}
                {tasks.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Tidak ada task yang ditugaskan</p>}
              </div>
              <div style={S.card}>
                <div style={S.section}>Upcoming Events</div>
                {events.slice(0, 5).map(e => (
                  <div key={e.id} style={{ display: "flex", gap: "12px", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ width: "4px", borderRadius: "2px", background: e.color || "#ff6b35", flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: "600" }}>{e.title}</div>
                      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{new Date(e.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                ))}
                {events.length === 0 && <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>Tidak ada event mendatang</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── PROJECTS ── */}
        {tab === "projects" && (
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "24px" }}>Proyek Aktif</h2>
            <div style={{ display: "grid", gap: "16px" }}>
              {projects.map(p => (
                <div key={p.id} style={S.card}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "36px", height: "36px", background: "rgba(255,107,53,0.12)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Film size={16} color="#ff6b35" />
                      </div>
                      <div>
                        <div style={{ fontWeight: "700", fontSize: "15px" }}>{p.title}</div>
                        <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>{p.status}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#ff6b35", fontWeight: "700" }}>{p.progress || 0}%</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "100px", height: "6px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #ff6b35, #ff9a35)", width: `${p.progress || 0}%`, borderRadius: "100px", transition: "width 0.3s" }} />
                  </div>
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px" }}>Tasks terkait:</div>
                    {tasks.filter(t => t.projectId === p.id).map(t => (
                      <div key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "rgba(255,255,255,0.6)", padding: "4px 0" }}>
                        {statusIcon(t.status)} {t.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.3)" }}>
                  <FolderOpen size={40} style={{ margin: "0 auto 12px" }} />
                  <p>Tidak ada proyek aktif</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CALENDAR ── */}
        {tab === "calendar" && (
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "24px" }}>Kalender</h2>
            <div style={{ display: "grid", gap: "12px" }}>
              {events.length === 0 && (
                <div style={{ textAlign: "center", padding: "60px", color: "rgba(255,255,255,0.3)" }}>
                  <Calendar size={40} style={{ margin: "0 auto 12px" }} />
                  <p>Tidak ada jadwal</p>
                </div>
              )}
              {events.map(ev => (
                <div key={ev.id} style={{ ...S.card, display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ width: "56px", height: "56px", background: `${ev.color || "#ff6b35"}20`, borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: "18px", fontWeight: "800", color: ev.color || "#ff6b35", lineHeight: "1" }}>
                      {new Date(ev.startDate).getDate()}
                    </div>
                    <div style={{ fontSize: "9px", color: ev.color || "#ff6b35", textTransform: "uppercase" }}>
                      {new Date(ev.startDate).toLocaleString("id-ID", { month: "short" })}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "4px" }}>{ev.title}</div>
                    {ev.description && <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", lineHeight: "1.5" }}>{ev.description}</p>}
                    <div style={{ display: "inline-block", background: `${ev.color || "#ff6b35"}20`, color: ev.color || "#ff6b35", fontSize: "10px", padding: "2px 10px", borderRadius: "100px", marginTop: "8px", letterSpacing: "1px", textTransform: "uppercase" }}>
                      {ev.type || "event"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CHAT ── */}
        {tab === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "20px" }}>Chat dengan Admin</h2>
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px", padding: "4px" }}>
              {chatMsgs.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px", color: "rgba(255,255,255,0.3)" }}>
                  <MessageCircle size={36} style={{ margin: "0 auto 10px" }} />
                  <p>Belum ada pesan. Mulai chat dengan admin!</p>
                </div>
              )}
              {chatMsgs.map(msg => {
                const isMe = msg.senderRole === "crew";
                return (
                  <div key={msg.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                    {!isMe && <div style={{ width: "32px", height: "32px", background: "rgba(255,107,53,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginRight: "8px", flexShrink: 0 }}><User size={14} color="#ff6b35" /></div>}
                    <div style={{ maxWidth: "68%" }}>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", textAlign: isMe ? "right" : "left" }}>{msg.senderName}</div>
                      <div style={{ background: isMe ? "#ff6b35" : "rgba(255,255,255,0.06)", border: isMe ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", fontSize: "14px", lineHeight: "1.5" }}>
                        {msg.message}
                      </div>
                      <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", marginTop: "4px", textAlign: isMe ? "right" : "left" }}>
                        {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", color: "#fff", fontSize: "14px", outline: "none" }}
                placeholder="Ketik pesan..."
              />
              <button onClick={sendChat} disabled={sendingChat || !chatInput.trim()} style={{ background: "#ff6b35", border: "none", borderRadius: "12px", width: "48px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Send size={18} color="#fff" />
              </button>
            </div>
          </div>
        )}

        {/* ── AI ASSISTANT ── */}
        {tab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 96px)" }}>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>AI Assistant</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Tanya apa saja tentang videografi, produksi, dan pekerjaan Anda</p>
            </div>
            {aiMessages.length === 0 && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", color: "rgba(255,255,255,0.3)" }}>
                <div style={{ width: "64px", height: "64px", background: "rgba(255,107,53,0.1)", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Cpu size={28} color="#ff6b35" />
                </div>
                <p style={{ fontSize: "15px" }}>Selamat datang di AI Assistant</p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                  {["Cara shoot scene sinematik?", "Tips color grading cepat", "Teknik audio di lapangan", "Workflow post-production"].map(s => (
                    <button key={s} onClick={() => { setAiInput(s); }} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "100px", padding: "8px 16px", color: "rgba(255,255,255,0.6)", fontSize: "12px", cursor: "pointer" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: "16px", marginBottom: "16px" }}>
              {aiMessages.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "assistant" && (
                    <div style={{ width: "32px", height: "32px", background: "rgba(255,107,53,0.15)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot size={16} color="#ff6b35" />
                    </div>
                  )}
                  <div style={{ maxWidth: "72%", background: m.role === "user" ? "#ff6b35" : "rgba(255,255,255,0.06)", border: m.role === "user" ? "none" : "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "12px 16px", fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ width: "32px", height: "32px", background: "rgba(255,107,53,0.15)", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Bot size={16} color="#ff6b35" />
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "16px", padding: "12px 16px", display: "flex", gap: "4px", alignItems: "center" }}>
                    {[0,1,2].map(i => <div key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff6b35", animation: `bounce 1.2s ${i*0.2}s infinite` }} />)}
                  </div>
                </div>
              )}
              <div ref={aiEndRef} />
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAiMessage()}
                style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "12px 16px", color: "#fff", fontSize: "14px", outline: "none" }}
                placeholder="Tanya sesuatu tentang videografi..."
              />
              <button onClick={sendAiMessage} disabled={aiLoading || !aiInput.trim()} style={{ background: "#ff6b35", border: "none", borderRadius: "12px", width: "48px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Send size={18} color="#fff" />
              </button>
            </div>
            <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(0.7);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
          </div>
        )}
      </div>
    </div>
  );
}

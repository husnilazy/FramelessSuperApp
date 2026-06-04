import { useState, useEffect } from "react";
import { useListTeamMembers, useCreateTeamMember, useDeleteTeamMember, useUpdateTeamMember, type CreateTeamMemberBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Mail, Briefcase, Trash2, Shield, ShieldOff, MessageCircle, Send, Key, X, Edit } from "lucide-react";

const DEPT_COLORS: Record<string, string> = {
  Production: "bg-primary/20 text-primary border-primary/30",
  "Post-Production": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  STUDIODO: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ZENSVISUAL: "bg-green-500/20 text-green-400 border-green-500/30",
  Management: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

function authHeader() {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface ChatMsg { id: string; senderRole: string; senderName: string; message: string; createdAt: string; }

export default function TeamPage() {
  const [open, setOpen] = useState(false);
  const [crewLoginModal, setCrewLoginModal] = useState<{ id: string; name: string; email?: string | null; canLogin?: boolean | null } | null>(null);
  const [chatModal, setChatModal] = useState<{ id: string; name: string } | null>(null);
  const [pwForm, setPwForm] = useState({ password: "", confirm: "" });
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "chat">("members");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useListTeamMembers();
  const [createPending, setCreatePending] = useState(false);
  const [enablePending, setEnablePending] = useState(false);
  const [disablePendingId, setDisablePendingId] = useState<string | null>(null);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [updatePendingId, setUpdatePendingId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    let interval: any;
    if (chatModal) {
      interval = setInterval(async () => {
        const res = await fetch(`/api/admin/chat/${chatModal.id}`, { headers: authHeader() as any });
        if (res.ok) setChatMessages(await res.json());
      }, 2000); // more realtime polling (2s)
    }
    return () => clearInterval(interval);
  }, [chatModal]);

  const createMutation = useCreateTeamMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        setOpen(false);
        toast({ title: "Team member added" });
      },
    },
  });

  async function createMemberSafe(data: CreateTeamMemberBody) {
    setCreatePending(true);
    try {
      let res = await fetch('/api/team-safe', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() } as any, body: JSON.stringify(data) });
      if (res.status === 404) {
        // fallback to minimal debug endpoint when safe endpoint unavailable
        res = await fetch('/api/team-debug', { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() } as any, body: JSON.stringify({ name: data.name, role: data.role }) });
      }
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        setOpen(false);
        toast({ title: 'Team member added' });
      } else {
        const text = await res.text();
        toast({ variant: 'destructive', title: 'Failed to add member', description: text });
      }
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to add member' });
    } finally {
      setCreatePending(false);
    }
  }

  const deleteMutation = useDeleteTeamMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        toast({ title: "Member removed" });
      },
    },
  });

  const updateMutation = useUpdateTeamMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        setOpen(false);
        setEditingMember(null);
        toast({ title: "Team member updated" });
      },
    },
  });

  const departments = [...new Set(members?.map((m) => m.department).filter(Boolean))];

  async function enableCrewLogin() {
    if (!crewLoginModal) return;
    if (pwForm.password !== pwForm.confirm) { toast({ variant: "destructive", title: "Password tidak cocok" }); return; }
    if (pwForm.password.length < 6) { toast({ variant: "destructive", title: "Password minimal 6 karakter" }); return; }
    setEnablePending(true);
    try {
      const res = await fetch(`/api/team/${crewLoginModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ canLogin: true, password: pwForm.password }),
      });
      if (res.ok) {
        toast({ title: `Akses portal aktif untuk ${crewLoginModal.name}` });
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        setCrewLoginModal(null);
        setPwForm({ password: "", confirm: "" });
      } else {
        toast({ variant: "destructive", title: "Gagal mengaktifkan akses" });
      }
    } finally {
      setEnablePending(false);
    }
  }

  async function disableCrewLogin(id: string, name: string) {
    setDisablePendingId(id);
    try {
      const res = await fetch(`/api/team/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ canLogin: false }),
      });
      if (res.ok) {
        toast({ title: `Akses portal dinonaktifkan untuk ${name}` });
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
      }
    } finally {
      setDisablePendingId(null);
    }
  }

  async function openChat(member: { id: string; name: string }) {
    setChatModal(member);
    const res = await fetch(`/api/admin/chat/${member.id}`, { headers: authHeader() as any });
    if (res.ok) setChatMessages(await res.json());
  }

  async function sendAdminChat() {
    if (!chatModal || !chatInput.trim()) return;
    setSendingChat(true);
    try {
      const res = await fetch(`/api/admin/chat/${chatModal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() } as any,
        body: JSON.stringify({ message: chatInput, senderName: "Admin" }),
      });
      if (res.ok) {
        setChatInput("");
        const refreshed = await fetch(`/api/admin/chat/${chatModal.id}`, { headers: authHeader() as any });
        if (refreshed.ok) setChatMessages(await refreshed.json());
      }
    } finally { setSendingChat(false); }
  }

  const membersWithLogin = members?.filter(m => (m as any).canLogin) || [];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Crew</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Team Management</p>
        </div>
        <div className="flex gap-3">
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingMember(null); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
                <Plus className="w-4 h-4 mr-2" /> Add Member
              </Button>
            </DialogTrigger>
                <DialogContent className="bg-card border-white/10 text-white max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading tracking-wider text-2xl">{editingMember ? "Edit Crew Member" : "Add Crew Member"}</DialogTitle>
              </DialogHeader>
                  <NewMemberForm
                    initialData={editingMember || undefined}
                    onSubmit={(data) => {
                      if (editingMember) {
                        setUpdatePendingId(editingMember.id);
                        updateMutation.mutate({ id: editingMember.id, data }, { onSettled: () => setUpdatePendingId(null) });
                      } else createMemberSafe(data as CreateTeamMemberBody);
                    }}
                    isPending={createPending || (editingMember ? updatePendingId === editingMember.id : false)}
                  />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 glass-panel rounded-xl p-1 border-white/10 w-fit">
        {([["members", "👥 Anggota"], ["chat", `💬 Admin Chat (${membersWithLogin.length})`]] as const).map(([t, l]) => (
          <button key={t} onClick={() => setActiveTab(t as any)} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === t ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-heading text-primary">{members?.length || 0}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Crew</p>
          </CardContent>
        </Card>
        <Card className="glass-panel border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-heading text-green-400">{membersWithLogin.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Portal Aktif</p>
          </CardContent>
        </Card>
        {departments.slice(0, 2).map((dept) => (
          <Card key={dept} className="glass-panel border-white/5">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-heading text-white">
                {members?.filter((m) => m.department === dept).length || 0}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1 truncate">{dept}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members Tab */}
      {activeTab === "members" && (
        isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {members?.map((member) => (
              <Card key={member.id} className="glass-panel border-white/5 group hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,106,32,0.1)' }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      {member.avatarUrl ? (
                        <img 
                          src={member.avatarUrl} 
                          alt={member.name} 
                          className="w-12 h-12 rounded-full object-cover border border-primary/30 shadow-sm" 
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                          <span className="text-primary font-heading text-xl">{member.name.charAt(0)}</span>
                        </div>
                      )}
                      {(member as any).canLogin && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-card">
                          <Shield className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { setDeletePendingId(member.id); deleteMutation.mutate({ id: member.id }, { onSettled: () => setDeletePendingId(null) }); }}
                      disabled={deletePendingId !== null}
                    >
                      {deletePendingId === member.id ? <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                      onClick={() => { setEditingMember(member); setOpen(true); }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <Briefcase className="w-3 h-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                  </div>
                  {member.email && (
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="w-3 h-3 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mb-4">
                    {member.department && (
                      <Badge className={`text-xs border uppercase tracking-wider ${DEPT_COLORS[member.department] || "bg-muted/20 text-muted-foreground border-muted/30"}`}>
                        {member.department}
                      </Badge>
                    )}
                    <Badge className={`text-xs border uppercase tracking-wider ${member.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted/20 text-muted-foreground border-muted/30"}`}>
                      {member.status || "active"}
                    </Badge>
                    {(member as any).canLogin && (
                      <Badge className="text-xs border uppercase tracking-wider bg-green-500/10 text-green-400 border-green-500/20">
                        <Shield className="w-2.5 h-2.5 mr-1" />Portal
                      </Badge>
                    )}
                  </div>

                  {/* Crew Portal Actions */}
                  <div className="flex gap-2 border-t border-white/8 pt-3">
                    {(member as any).canLogin ? (
                      <>
                        <button
                          onClick={() => openChat({ id: member.id, name: member.name })}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
                        >
                          <MessageCircle className="w-3 h-3" /> Chat
                        </button>
                        <button
                          onClick={() => disableCrewLogin(member.id, member.name)}
                          className="flex items-center justify-center gap-1 text-xs px-3 py-2 rounded-lg bg-red-500/8 border border-red-500/20 text-red-400 hover:bg-red-500/15 transition-colors"
                          title="Nonaktifkan portal"
                        >
                          {disablePendingId === member.id ? (
                            <div className="w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
                          ) : (
                            <ShieldOff className="w-3 h-3" />
                          )}
                        </button>
                      </>
                    ) : (
                      member.email ? (
                        <button
                          onClick={() => { setCrewLoginModal({ id: member.id, name: member.name, email: member.email }); setPwForm({ password: "", confirm: "" }); }}
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg bg-primary/8 border border-primary/20 text-primary hover:bg-primary/15 transition-colors"
                        >
                          <Key className="w-3 h-3" /> Aktifkan Portal
                        </button>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">Tambah email untuk aktifkan portal</p>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {members?.length === 0 && (
              <div className="col-span-3 glass-panel rounded-xl p-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm uppercase tracking-wider">No team members yet</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Admin Chat Tab */}
      {activeTab === "chat" && (
        <div className="glass-panel rounded-xl border-white/10 overflow-hidden">
          {membersWithLogin.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>Belum ada crew dengan akses portal. Aktifkan portal untuk mulai chat.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {membersWithLogin.map(m => (
                <div key={m.id} className="flex items-center justify-between p-5 hover:bg-white/2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-heading">{m.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.role} · {m.department}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => openChat({ id: m.id, name: m.name })}
                    className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Buka Chat
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enable Crew Login Modal */}
      {crewLoginModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Aktifkan Crew Portal</h3>
              <button onClick={() => setCrewLoginModal(null)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 bg-white/3 rounded-xl border border-white/8">
              <div className="text-sm font-semibold text-white">{crewLoginModal.name}</div>
              <div className="text-xs text-muted-foreground">{crewLoginModal.email}</div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Password</label>
              <Input type="password" value={pwForm.password} onChange={e => setPwForm(p => ({...p, password: e.target.value}))} className="bg-white/5 border-white/10 text-white" placeholder="Min. 6 karakter" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Konfirmasi Password</label>
              <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({...p, confirm: e.target.value}))} className="bg-white/5 border-white/10 text-white" placeholder="Ulangi password" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={() => setCrewLoginModal(null)} variant="ghost" className="flex-1 text-muted-foreground">Batal</Button>
              <Button onClick={enableCrewLogin} className="flex-1 bg-primary hover:bg-primary/90" disabled={enablePending}>
                {enablePending ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2" /> : <Shield className="w-4 h-4 mr-2" />}
                {enablePending ? 'Activating...' : 'Aktifkan'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Chat Modal */}
      {chatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-white/10 rounded-2xl w-full max-w-lg flex flex-col" style={{ height: "560px" }}>
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary text-sm font-heading">{chatModal.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="font-semibold text-white text-sm">{chatModal.name}</div>
                  <div className="text-xs text-muted-foreground">Crew Portal Chat</div>
                </div>
              </div>
              <button onClick={() => { setChatModal(null); setChatMessages([]); }} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {chatMessages.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  Belum ada pesan. Mulai percakapan!
                </div>
              )}
              {chatMessages.map(msg => {
                const isAdmin = msg.senderRole === "admin";
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${isAdmin ? "bg-primary text-white rounded-br-sm" : "bg-white/8 border border-white/10 text-white rounded-bl-sm"}`}>
                      <div className="text-[10px] opacity-60 mb-1">{msg.senderName}</div>
                      {msg.message}
                      <div className="text-[10px] opacity-50 mt-1 text-right">{new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-white/10 flex gap-2">
              <input
                value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendAdminChat()}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-muted-foreground"
                placeholder="Ketik pesan ke crew..."
              />
              <button onClick={sendAdminChat} disabled={sendingChat || !chatInput.trim()} className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NewMemberForm({ onSubmit, isPending, initialData }: { onSubmit: (data: any) => void; isPending: boolean; initialData?: any }) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({
    name: initialData?.name || "",
    role: initialData?.role || "",
    email: initialData?.email || "",
    department: initialData?.department || "Production",
    status: initialData?.status || "active",
    canLogin: initialData?.canLogin || false,
    password: "",
    username: initialData?.username || "",
    whatsapp: initialData?.whatsapp || "",
    instagram: initialData?.instagram || "",
    linkedin: initialData?.linkedin || "",
    twitter: initialData?.twitter || "",
    website: initialData?.website || "",
    avatarUrl: initialData?.avatarUrl || "",
  });

  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", headers: authHeader() as any, body: formData });
        const data = await res.json();
        if (data.url) {
          setForm({ ...form, avatarUrl: data.url });
          toast({ title: "Avatar uploaded" });
        }
      } catch (err) {
        toast({ variant: "destructive", title: "Upload gagal" });
      } finally {
        setAvatarUploading(false);
      }
    };
    input.click();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column: basic info */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name *</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              required className="bg-white/5 border-white/10 text-white" placeholder="Name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Role *</label>
              <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                required className="bg-white/5 border-white/10 text-white" placeholder="e.g. Videographer" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Department</label>
              <Select value={form.department || "Production"} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/10">
                  <SelectItem value="Production">Production</SelectItem>
                  <SelectItem value="Post-Production">Post-Production</SelectItem>
                  <SelectItem value="STUDIODO">STUDIODO</SelectItem>
                  <SelectItem value="ZENSVISUAL">ZENSVISUAL</SelectItem>
                  <SelectItem value="Management">Management</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
            <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-white/5 border-white/10 text-white" placeholder="email@frameless.com" />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Username</label>
            <Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="bg-white/5 border-white/10 text-white" placeholder="username (internal)" />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Phone / WA</label>
            <div className="grid grid-cols-2 gap-2">
              <Input type="text" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="bg-white/5 border-white/10 text-white" placeholder="+62 8..." />
              <Input type="text" value={form.whatsapp || ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="bg-white/5 border-white/10 text-white" placeholder="WA number" />
            </div>
          </div>
        </div>

        {/* Right column: avatar + social + portal */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">Avatar (upload or URL)</label>
            <div className="flex gap-2">
              <Input value={form.avatarUrl || ""} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
                className="bg-white/5 border-white/10 text-white flex-1 text-xs" placeholder="https://... or upload" />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={handleAvatarUpload}
                className="px-3 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-semibold border border-primary/30 disabled:opacity-50 whitespace-nowrap"
              >
                {avatarUploading ? "..." : "Upload"}
              </button>
            </div>
            {form.avatarUrl && (
              <div className="mt-1 flex items-center gap-2">
                <img src={form.avatarUrl} alt="preview" className="w-8 h-8 rounded-full object-cover border border-white/20" />
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{form.avatarUrl}</span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-white/10">
            <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Social (for public crew profile)</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Instagram</label>
                <Input type="text" value={form.instagram || ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-xs h-8" placeholder="@user or url" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">LinkedIn</label>
                <Input type="text" value={form.linkedin || ""} onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-xs h-8" placeholder="url" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Twitter/X</label>
                <Input type="text" value={form.twitter || ""} onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-xs h-8" placeholder="url" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Website</label>
                <Input type="text" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-xs h-8" placeholder="url" />
              </div>
            </div>
          </div>

          <div className="p-2 bg-white/5 border border-white/10 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Beri Akses Portal Crew</div>
              <div className="text-[10px] text-muted-foreground">Bisa login ke crew dashboard</div>
            </div>
            <button type="button" onClick={() => setForm({...form, canLogin: !form.canLogin})} className={`w-9 h-4 rounded-full relative transition-colors ${form.canLogin ? "bg-green-500" : "bg-white/10"}`}>
              <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${form.canLogin ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>
      </div>

      {form.canLogin && (
        <div className="space-y-1 pt-2 border-t border-white/10">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Password Login (untuk crew portal) *</label>
          <Input type="text" value={form.password || ""} onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={form.canLogin} className="bg-white/5 border-white/10 text-white" placeholder="Minimal 6 karakter" minLength={6} />
        </div>
      )}

      <Button type="submit" disabled={isPending || (form.canLogin && (!form.email || !form.password || form.password.length < 6))} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider mt-2">
        {isPending ? (initialData ? "Saving..." : "Adding...") : (initialData ? "Save Changes" : "Add Member")}
      </Button>
    </form>
  );
}

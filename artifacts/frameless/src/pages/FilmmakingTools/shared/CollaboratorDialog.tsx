// PATH SARAN: apps/web/src/components/filmmaking/shared/CollaboratorDialog.tsx
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, X, Loader2, Search } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
}

export interface Collaborator {
  id: string;
  crewMemberId: string;
  role: "editor" | "viewer";
  memberName?: string | null;
  memberEmail?: string | null;
}

interface CollaboratorDialogProps {
  documentId: string;
  collaborators: Collaborator[];
  onChange: (next: Collaborator[]) => void;
  getToken: () => string | null;
  accentColorClass?: string; // contoh: "text-amber-400" biar konsisten sama tema tiap editor
}

export function CollaboratorDialog({
  documentId,
  collaborators,
  onChange,
  getToken,
  accentColorClass = "text-orange-400",
}: CollaboratorDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("viewer");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || members.length > 0) return;
    setLoadingMembers(true);
    fetch("/api/team")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [open]);

  const alreadyAddedIds = new Set(collaborators.map((c) => c.crewMemberId));
  const filteredMembers = members
    .filter((m) => !alreadyAddedIds.has(m.id))
    .filter((m) => (search.trim() ? m.name.toLowerCase().includes(search.toLowerCase()) : true));

  const handleAdd = async () => {
    if (!selectedMemberId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}/collaborators`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ crewMemberId: selectedMemberId, role }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Gagal menambah collaborator");
      const created = await res.json();
      const member = members.find((m) => m.id === selectedMemberId);
      onChange([...collaborators, { ...created, memberName: member?.name, memberEmail: member?.email }]);
      setSelectedMemberId("");
      toast({ title: `${member?.name || "Crew"} ditambahkan sebagai ${role}` });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal menambah collaborator", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (collabId: string, name?: string | null) => {
    setRemovingId(collabId);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}/collaborators/${collabId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error("Gagal menghapus collaborator");
      onChange(collaborators.filter((c) => c.id !== collabId));
      toast({ title: `${name || "Crew"} dihapus dari dokumen` });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal menghapus collaborator" });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-zinc-800 relative" title="Collaborators">
          <Users className="w-4 h-4" />
          {collaborators.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
              {collaborators.length}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 text-zinc-100`}>
            <Users className={`w-4 h-4 ${accentColorClass}`} />
            Kelola Collaborator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tambah collaborator */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari nama crew..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100 pl-8"
              />
            </div>

            <div className="max-h-40 overflow-auto rounded-xl border border-zinc-800 divide-y divide-zinc-800">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-4 text-zinc-500 text-sm gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat daftar crew...
                </div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">Tidak ada crew yang cocok.</p>
              ) : (
                filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-800/60 transition-colors ${
                      selectedMemberId === m.id ? "bg-zinc-800" : ""
                    }`}
                  >
                    <span>
                      <span className="text-zinc-200 font-medium">{m.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">{m.role}</span>
                    </span>
                    {selectedMemberId === m.id && <span className={`text-xs ${accentColorClass}`}>Dipilih</span>}
                  </button>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger className="w-32 bg-zinc-800 border-zinc-700 text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="viewer" className="text-zinc-100">Viewer</SelectItem>
                  <SelectItem value="editor" className="text-zinc-100">Editor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleAdd}
                disabled={!selectedMemberId || adding}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tambahkan"}
              </Button>
            </div>
          </div>

          {/* List collaborator existing */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{c.memberName || c.memberEmail || c.crewMemberId}</p>
                  <p className="text-xs text-zinc-500 capitalize">{c.role}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={removingId === c.id}
                  onClick={() => handleRemove(c.id, c.memberName)}
                  className="hover:bg-red-500/10"
                >
                  {removingId === c.id ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <X className="w-4 h-4 text-red-400" />}
                </Button>
              </div>
            ))}
            {collaborators.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-3">Hanya kamu yang punya akses ke dokumen ini.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
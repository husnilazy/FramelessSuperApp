import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Plus, FileText, Grid3x3, Trash2, Copy, Clapperboard,
  BookOpen, Lightbulb, ChevronRight, Clock, AlertCircle, RefreshCw, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  title: string;
  docType: "concept" | "script" | "shotlist" | "screenplay";
  projectId?: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentListProps {
  onOpenDoc?: (id: string) => void;
}

const DOC_TYPE_CONFIG = {
  concept: {
    label: "Concept",
    Icon: Lightbulb,
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "bg-amber-500/20 text-amber-300",
  },
  screenplay: {
    label: "Screenplay",
    Icon: BookOpen,
    color: "text-purple-400",
    bg: "bg-purple-500/10 border-purple-500/20",
    badge: "bg-purple-500/20 text-purple-300",
  },
  script: {
    label: "Script Breakdown",
    Icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "bg-blue-500/20 text-blue-300",
  },
  shotlist: {
    label: "Shotlist",
    Icon: Grid3x3,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    badge: "bg-emerald-500/20 text-emerald-300",
  },
};

export function DocumentList({ onOpenDoc }: DocumentListProps = {}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDocType, setNewDocType] = useState<"concept" | "script" | "shotlist" | "screenplay">("screenplay");
  const [filter, setFilter] = useState<"all" | "concept" | "script" | "shotlist" | "screenplay">("all");
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [docPendingDelete, setDocPendingDelete] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");

      if (!token) {
        setError("No authentication token found. Please log in again.");
        return;
      }

      const response = await fetch("/api/filmmaking-documents", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch documents:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreateDocument = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);

    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const response = await fetch("/api/filmmaking-documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docType: newDocType,
          title: newTitle,
          content: getDefaultContent(newDocType),
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to create document: ${errorData}`);
      }

      const doc = await response.json();
      setDocuments([doc, ...documents]);
      setCreateDialogOpen(false);
      setNewTitle("");
      if (onOpenDoc) onOpenDoc(doc.id);
      else setLocation(`/filmmaking-tools/documents/${doc.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to create document:", message);
      toast({ variant: "destructive", title: "Gagal membuat dokumen", description: message });
    } finally {
      setCreating(false);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docPendingDelete) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const res = await fetch(`/api/filmmaking-documents/${docPendingDelete.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error("Gagal menghapus dokumen");
      setDocuments(documents.filter((doc) => doc.id !== docPendingDelete.id));
      toast({ title: `"${docPendingDelete.title}" dihapus` });
    } catch (err) {
      console.error("Failed to delete document:", err);
      toast({ variant: "destructive", title: "Gagal menghapus dokumen" });
    } finally {
      setDeleting(false);
      setDocPendingDelete(null);
    }
  };

  const handleDuplicateDocument = async (id: string) => {
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const response = await fetch(`/api/filmmaking-documents/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal menduplikasi dokumen");
      const doc = await response.json();
      setDocuments([doc, ...documents]);
      toast({ title: "Dokumen berhasil diduplikasi" });
    } catch (err) {
      console.error("Failed to duplicate document:", err);
      toast({ variant: "destructive", title: "Gagal menduplikasi dokumen" });
    }
  };

  const filteredDocs = documents
    .filter((d) => filter === "all" || d.docType === filter)
    .filter((d) => (search.trim() ? (d.title || "").toLowerCase().includes(search.toLowerCase()) : true));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-3">
        <Clapperboard className="w-6 h-6 text-orange-500 animate-pulse" />
        <span className="text-sm text-zinc-400">Loading documents...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-400 text-center max-w-md">{error}</p>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchDocuments}>
          <RefreshCw className="w-3 h-3" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/60 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Clapperboard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-100">Filmmaking Tools</h1>
            <p className="text-xs text-zinc-500">{documents.length} document{documents.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-500/20 font-semibold">
              <Plus className="w-4 h-4" />
              New Document
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-zinc-100">
                <Clapperboard className="w-5 h-5 text-orange-400" />
                Create New Document
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Document Title</label>
                <Input
                  placeholder="e.g., Ramadan Campaign 2025"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateDocument()}
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Document Type</label>
                <Select value={newDocType} onValueChange={(val: any) => setNewDocType(val)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="concept" className="text-zinc-100 focus:bg-zinc-700">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-400" />
                        <div>
                          <p className="font-medium">Concept / Idea</p>
                          <p className="text-xs text-zinc-400">Mulai dari sini kalau belum ada naskah — AI bisa generate semuanya</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="screenplay" className="text-zinc-100 focus:bg-zinc-700">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-400" />
                        <div>
                          <p className="font-medium">Screenplay</p>
                          <p className="text-xs text-zinc-400">Write your script, AI will breakdown automatically</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="script" className="text-zinc-100 focus:bg-zinc-700">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <div>
                          <p className="font-medium">Script Breakdown</p>
                          <p className="text-xs text-zinc-400">Scene-by-scene production breakdown, dibantu AI</p>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="shotlist" className="text-zinc-100 focus:bg-zinc-700">
                      <div className="flex items-center gap-2">
                        <Grid3x3 className="w-4 h-4 text-emerald-400" />
                        <div>
                          <p className="font-medium">Shotlist</p>
                          <p className="text-xs text-zinc-400">Camera shot breakdown, dibantu AI</p>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateDocument}
                disabled={!newTitle.trim() || creating}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white gap-2 font-semibold"
              >
                {creating ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Create Document</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-6 py-3 border-b border-zinc-800/60">
        <div className="flex gap-1 overflow-x-auto">
          {(["all", "concept", "screenplay", "script", "shotlist"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filter === type
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              {type === "all" ? "All" : DOC_TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dokumen..."
            className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 pl-8 h-9"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800/80 flex items-center justify-center">
              <Clapperboard className="w-10 h-10 text-zinc-600" />
            </div>
            <div>
              <p className="text-zinc-300 font-semibold text-lg">
                {documents.length === 0 ? "No documents yet" : "Tidak ada dokumen yang cocok"}
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                {documents.length === 0 ? "Create your first filmmaking document to get started" : "Coba ubah filter atau kata kunci pencarian"}
              </p>
            </div>
            {documents.length === 0 && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="gap-2 bg-orange-500 hover:bg-orange-600 text-white mt-2"
              >
                <Plus className="w-4 h-4" />
                New Document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDocs.map((doc) => {
              if (!doc.id) return null;
              const cfg = DOC_TYPE_CONFIG[doc.docType] || DOC_TYPE_CONFIG.concept;
              const { Icon } = cfg;
              return (
                <div
                  key={doc.id}
                  className={`group relative flex flex-col gap-3 p-5 border rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-xl ${cfg.bg} hover:brightness-110`}
                  onClick={() => {
                    if (onOpenDoc) onOpenDoc(doc.id);
                    else setLocation(`/filmmaking-tools/documents/${doc.id}`);
                  }}
                >
                  {/* Type Badge */}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {doc.isDraft && (
                      <span className="text-xs text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-full">
                        Draft
                      </span>
                    )}
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-zinc-100 leading-tight line-clamp-2 group-hover:text-white">
                        {doc.title || "Untitled Document"}
                      </h3>
                      <p className={`text-xs mt-1.5 flex items-center gap-1 text-zinc-500`}>
                        <Clock className="w-3 h-3" />
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-white/10">
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-white/5 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDuplicateDocument(doc.id);
                      }}
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                    <button
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocPendingDelete(doc);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>

                  {/* Arrow hint */}
                  <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!docPendingDelete} onOpenChange={(v) => !v && setDocPendingDelete(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Hapus Dokumen?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Yakin mau hapus <span className="text-zinc-200 font-medium">"{docPendingDelete?.title}"</span>? Aksi ini tidak bisa dibatalkan.
          </p>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={() => setDocPendingDelete(null)}>
              Batal
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white gap-2"
              onClick={confirmDeleteDocument}
              disabled={deleting}
            >
              {deleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Hapus
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getDefaultContent(type: string): any {
  switch (type) {
    case "concept": return { notes: "", ideas: [], moodBoard: null };
    case "script": return { scenes: [] };
    case "shotlist": return { shots: [] };
    case "screenplay": return { text: "" };
    default: return {};
  }
}
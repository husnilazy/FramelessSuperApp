import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, BookOpen, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollaboratorDialog, type Collaborator } from "./shared/CollaboratorDialog";
import { usePresence } from "./shared/usePresence";
import { EditorToolbar } from "./shared/EditorToolbar";
import { PipelineNav, type PipelineLinks } from "./shared/PipelineNav";
import { downloadDocumentPdf } from "./shared/pdfDownload";

const getToken = () => localStorage.getItem("crew_token") || localStorage.getItem("token");

interface ScreenplayEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
  onNavigateDoc?: (id: string) => void;
}

export function ScreenplayEditor({ documentId, onSaved, onBack, onNavigateDoc }: ScreenplayEditorProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [breakingDown, setBreakingDown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [statusBadge, setStatusBadge] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineLinks | null>(null);
  const autoSaveTimerRef = useRef<any>(null);

  const activeUsers = usePresence(documentId, getToken);
  const navigateDoc = onNavigateDoc || ((id: string) => setLocation(`/filmmaking-tools/documents/${id}`));

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  useEffect(() => {
    if (loading || !text) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      saveDocument(true);
    }, 4000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [text, title]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTitle(data.title || "");
      setText((data.content as any)?.text || "");
      setCollaborators(data.collaborators || []);
      setPipeline((data.content as any)?._pipeline || null);
    } catch (err) {
      console.error("Failed to fetch document:", err);
      toast({ variant: "destructive", title: "Gagal memuat dokumen" });
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async (isAutoSave = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: { text }, isDraft: true, changeSummary: isAutoSave ? "Auto-saved" : "Manual save" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLastSaved(new Date());
      if (!isAutoSave) { onSaved(); toast({ title: "Tersimpan" }); }
    } catch (err) {
      console.error("Save failed:", err);
      if (!isAutoSave) toast({ variant: "destructive", title: "Gagal menyimpan" });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      setStatusBadge("pending");
      toast({ title: "Terkirim untuk direview" });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal submit" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      await saveDocument(true);
      await downloadDocumentPdf(documentId, title, getToken());
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal export PDF", description: err instanceof Error ? err.message : undefined });
    } finally {
      setExporting(false);
    }
  };

  // Sudah punya breakdown & shotlist dari sebelumnya? kalau ya, mode "resync" (update in-place)
  const isResync = !!(pipeline?.scriptId || pipeline?.shotlistId);

  const handleAiBreakdown = async () => {
    if (!text.trim()) {
      toast({ variant: "destructive", title: "Tulis dulu naskahnya sebelum generate breakdown." });
      return;
    }
    await saveDocument(true);
    setBreakingDown(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}/ai-breakdown`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(isResync ? {
          targetScriptId: pipeline?.scriptId,
          targetShotlistId: pipeline?.shotlistId,
        } : {}),
      });
      if (!res.ok) {
        const errBody = await res.json();
        const message = errBody.raw
          ? `${errBody.error}\n\nAI response: ${errBody.raw}`
          : (errBody.details || errBody.error || "AI breakdown gagal");
        throw new Error(message);
      }
      const result = await res.json();
      setPipeline(result.pipeline);

      if (isResync) {
        toast({ title: "Breakdown & Shotlist berhasil diperbarui 🔄", description: "Perubahan naskah sudah ikut diterapkan ke dokumen turunannya." });
      } else {
        toast({ title: "AI Breakdown selesai! 🎬", description: "Script Breakdown & Shotlist sudah dibuat." });
      }
    } catch (err) {
      console.error("Breakdown failed:", err);
      toast({ variant: "destructive", title: "AI Breakdown gagal", description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBreakingDown(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <EditorToolbar
        icon={<BookOpen className="w-4 h-4" />}
        accentColorClass="text-purple-400"
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Untitled Screenplay..."
        onBack={() => { if (onBack) onBack(); else setLocation("/filmmaking-tools"); }}
        activeUsers={activeUsers}
        statusBadge={statusBadge}
        saving={saving}
        lastSaved={lastSaved}
        primaryAction={
          <Button
            onClick={handleAiBreakdown}
            disabled={breakingDown || !text.trim()}
            className="relative overflow-hidden gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold shadow-lg shadow-purple-500/20 transition-all duration-200"
          >
            {breakingDown
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isResync ? "Updating..." : "Analyzing..."}</>
              : isResync
                ? <><RefreshCw className="w-4 h-4" /> Update Breakdown & Shotlist</>
                : <><Sparkles className="w-4 h-4" /> AI Breakdown</>
            }
          </Button>
        }
        documentId={documentId}
        collaborators={collaborators}
        onCollaboratorsChange={setCollaborators}
        getToken={getToken}
        exporting={exporting}
        onExportPdf={handleExportPdf}
        submitting={submitting}
        onSubmit={handleSubmit}
        onSave={() => saveDocument(false)}
      />

      <PipelineNav links={pipeline} currentId={documentId} onNavigate={navigateDoc} />

      {/* Editor Canvas */}
      <div className="flex-1 overflow-auto px-4 py-8 bg-zinc-950 flex justify-center">
        <div className="w-full max-w-4xl">
          {/* Paper */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl shadow-2xl min-h-[900px] relative">
            {/* Paper header decoration */}
            <div className="flex items-center justify-between px-8 py-4 border-b border-zinc-800/60">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">Screenplay Draft</span>
              <span className="font-mono text-xs text-zinc-700">{new Date().toLocaleDateString("id-ID")}</span>
            </div>

            <div className="p-8">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"FADE IN:\n\nINT. STUDIO - DAY\n\nStart writing your scene here...\n\nThe camera pans slowly across..."}
                className="w-full min-h-[800px] resize-none outline-none border-none bg-transparent font-mono text-base leading-8 text-zinc-200 placeholder:text-zinc-700 caret-orange-400"
                spellCheck={false}
              />
            </div>

            {/* Word count footer */}
            <div className="absolute bottom-4 right-6 text-xs text-zinc-700 font-mono">
              {text.trim().split(/\s+/).filter(Boolean).length} words
            </div>
          </div>

          {isResync && (
            <p className="text-xs text-zinc-600 text-center mt-3">
              Dokumen ini sudah punya Breakdown & Shotlist turunan. Klik <span className="text-purple-400 font-medium">Update Breakdown & Shotlist</span> di atas kalau naskahnya baru saja diubah.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
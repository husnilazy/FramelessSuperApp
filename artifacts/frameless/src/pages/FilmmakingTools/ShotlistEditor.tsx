import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Grid3x3, Camera, Sparkles, Wand2, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CollaboratorDialog, type Collaborator } from "./shared/CollaboratorDialog";
import { usePresence } from "./shared/usePresence";
import { EditorToolbar } from "./shared/EditorToolbar";
import { PipelineNav, type PipelineLinks } from "./shared/PipelineNav";
import { downloadDocumentPdf } from "./shared/pdfDownload";

const getToken = () => localStorage.getItem("crew_token") || localStorage.getItem("token");

interface ShotlistEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
  onNavigateDoc?: (id: string) => void;
}

interface Shot {
  id: string;
  sceneNumber: string;
  shotNumber: string;
  description: string;
  cameraAngle: string;
  duration: string;
  props: string;
  talents: string;
  notes: string;
}

interface SourceDoc {
  id: string;
  title: string;
  docType: string;
}

const CAMERA_ANGLES = ["Wide", "Medium", "Close-up", "Extreme Close-up", "POV", "Over-the-shoulder", "Bird's Eye", "Low Angle", "Dutch Angle", "Tracking"];

export function ShotlistEditor({ documentId, onSaved, onBack, onNavigateDoc }: ShotlistEditorProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [pipeline, setPipeline] = useState<PipelineLinks | null>(null);
  const autoSaveRef = useRef<any>(null);

  // AI generate shots
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [sourceDocs, setSourceDocs] = useState<SourceDoc[]>([]);
  const [sourceDocsLoading, setSourceDocsLoading] = useState(false);
  const [selectedSourceId, setSelectedSourceId] = useState<string>("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const activeUsers = usePresence(documentId, getToken);
  const navigateDoc = onNavigateDoc || ((id: string) => setLocation(`/filmmaking-tools/documents/${id}`));

  useEffect(() => { fetchDocument(); }, [documentId]);

  useEffect(() => {
    if (loading) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => saveDocument(true), 4000);
    return () => clearTimeout(autoSaveRef.current);
  }, [shots, title]);

  useEffect(() => {
    if (!aiDialogOpen || sourceDocs.length > 0) return;
    setSourceDocsLoading(true);
    Promise.all([
      fetch("/api/filmmaking-documents?docType=script", { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/filmmaking-documents?docType=screenplay", { headers: { Authorization: `Bearer ${getToken()}` } }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([scripts, screenplays]) => {
        setSourceDocs([...(scripts || []), ...(screenplays || [])].filter((d: any) => d.id !== documentId));
      })
      .catch(() => setSourceDocs([]))
      .finally(() => setSourceDocsLoading(false));
  }, [aiDialogOpen]);

  // Kalau shotlist ini bagian dari pipeline, auto-pilih source dari breakdown pasangannya
  useEffect(() => {
    if (aiDialogOpen && pipeline?.scriptId && !selectedSourceId) {
      setSelectedSourceId(pipeline.scriptId);
    }
  }, [aiDialogOpen, pipeline]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTitle(data.title || "");
      setShots((data.content as any)?.shots || []);
      setCollaborators(data.collaborators || []);
      setPipeline((data.content as any)?._pipeline || null);
    } catch (err) {
      console.error("Fetch failed:", err);
      toast({ variant: "destructive", title: "Gagal memuat dokumen" });
    }
    finally { setLoading(false); }
  };

  const saveDocument = async (isAutoSave = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: { shots }, isDraft: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLastSaved(new Date());
      if (!isAutoSave) { onSaved(); toast({ title: "Tersimpan" }); }
    } catch (err) {
      console.error("Save failed:", err);
      if (!isAutoSave) toast({ variant: "destructive", title: "Gagal menyimpan" });
    }
    finally { setSaving(false); }
  };

  const handleAddShot = () => {
    const newShot: Shot = {
      id: Math.random().toString(36).substr(2, 9),
      sceneNumber: "",
      shotNumber: `${shots.length + 1}`,
      description: "",
      cameraAngle: "Wide",
      duration: "",
      props: "",
      talents: "",
      notes: "",
    };
    setShots([...shots, newShot]);
  };

  const updateShot = (id: string, updates: Partial<Shot>) => {
    setShots(shots.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}/submit`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "Terkirim untuk direview" });
    } catch (err) { toast({ variant: "destructive", title: "Gagal submit" }); }
    finally { setSubmitting(false); }
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

  const handleAiGenerateShots = async () => {
    if (!aiBrief.trim() && !selectedSourceId) {
      toast({ variant: "destructive", title: "Isi brief, atau pilih dokumen Script Breakdown/Screenplay sebagai sumber." });
      return;
    }
    setAiGenerating(true);
    try {
      await saveDocument(true);
      const res = await fetch(`/api/filmmaking-documents/${documentId}/ai-generate-shots`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: aiBrief || undefined,
          sourceDocumentId: selectedSourceId || undefined,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json();
        const message = errBody.raw
          ? `${errBody.error}\n\nAI response: ${errBody.raw}`
          : (errBody.details || errBody.error || "Gagal generate shots");
        throw new Error(message);
      }
      const data = await res.json();
      setShots((data.document.content as any)?.shots || []);
      setAiDialogOpen(false);
      setAiBrief("");
      setSelectedSourceId("");
      toast({ title: `${data.addedCount} shot baru ditambahkan oleh AI ✨` });
    } catch (err) {
      toast({ variant: "destructive", title: "AI generate shots gagal", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAiGenerating(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full bg-zinc-950"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <EditorToolbar
        icon={<Grid3x3 className="w-4 h-4" />}
        accentColorClass="text-emerald-400"
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Shotlist Title..."
        onBack={() => { if (onBack) onBack(); else setLocation("/filmmaking-tools"); }}
        activeUsers={activeUsers}
        saving={saving}
        lastSaved={lastSaved}
        primaryAction={
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-4 h-4" />
                AI Generate Shots
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-zinc-100">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  AI Generate Shots
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 uppercase tracking-wider">Import dari Script Breakdown / Screenplay (opsional)</label>
                  <Select value={selectedSourceId} onValueChange={setSelectedSourceId}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue placeholder={sourceDocsLoading ? "Memuat dokumen..." : "Pilih dokumen (opsional)"} />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60">
                      {sourceDocs.length === 0 && !sourceDocsLoading && (
                        <div className="px-3 py-2 text-xs text-zinc-500">Belum ada Script Breakdown/Screenplay lain.</div>
                      )}
                      {sourceDocs.map((d) => (
                        <SelectItem key={d.id} value={d.id} className="text-zinc-100">
                          <span className="text-xs text-zinc-500 uppercase mr-2">{d.docType}</span>{d.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {pipeline?.scriptId && selectedSourceId === pipeline.scriptId && (
                    <p className="text-xs text-emerald-400/80">✓ Otomatis pakai Breakdown pasangan shotlist ini.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-zinc-400 uppercase tracking-wider">Atau tulis brief manual (opsional, bisa dikombinasi)</label>
                  <Textarea
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder="Contoh: 'Fokus ke produk close-up dan suasana kafe yang hangat, butuh banyak b-roll tangan sedang menyeduh kopi.'"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[90px]"
                  />
                </div>

                <Button
                  onClick={handleAiGenerateShots}
                  disabled={aiGenerating || (!aiBrief.trim() && !selectedSourceId)}
                  className="w-full gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold"
                >
                  {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4" /> Generate</>}
                </Button>
                <p className="text-xs text-zinc-500 text-center">Shot baru akan ditambahkan ke daftar, shot yang sudah ada tidak dihapus.</p>
              </div>
            </DialogContent>
          </Dialog>
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-zinc-500">{shots.length} shot{shots.length !== 1 ? "s" : ""}</p>
            <Button onClick={handleAddShot} variant="outline" className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl">
              <Plus className="w-4 h-4" />
              Add Shot Manual
            </Button>
          </div>

          {shots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <Camera className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">No shots yet. Add manually, or let AI generate shots.</p>
              <Button onClick={() => setAiDialogOpen(true)} className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white">
                <Sparkles className="w-4 h-4" /> AI Generate Shots
              </Button>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              {/* Table Header */}
              <div className="grid bg-zinc-800/60 border-b border-zinc-700 px-4 py-2.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider" style={{ gridTemplateColumns: "60px 60px 1fr 140px 80px 120px 120px 160px 50px" }}>
                <span>Scene</span>
                <span>Shot</span>
                <span>Description</span>
                <span>Camera Angle</span>
                <span>Duration</span>
                <span>Props</span>
                <span>Talents</span>
                <span>Notes</span>
                <span></span>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-zinc-800">
                {shots.map((shot, idx) => (
                  <div
                    key={shot.id}
                    className="grid items-center px-4 py-2 hover:bg-zinc-800/30 transition-colors"
                    style={{ gridTemplateColumns: "60px 60px 1fr 140px 80px 120px 120px 160px 50px" }}
                  >
                    <Input
                      value={shot.sceneNumber}
                      onChange={(e) => updateShot(shot.id, { sceneNumber: e.target.value })}
                      placeholder="S1"
                      className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-600 font-mono">#</span>
                      <Input
                        value={shot.shotNumber}
                        onChange={(e) => updateShot(shot.id, { shotNumber: e.target.value })}
                        placeholder={String(idx + 1)}
                        className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                      />
                    </div>
                    <Input
                      value={shot.description}
                      onChange={(e) => updateShot(shot.id, { description: e.target.value })}
                      placeholder="Wide establishing shot..."
                      className="bg-transparent border-none text-sm text-zinc-200 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <Select value={shot.cameraAngle || "Wide"} onValueChange={(v) => updateShot(shot.id, { cameraAngle: v })}>
                      <SelectTrigger className="h-8 bg-transparent border-zinc-700/50 text-zinc-300 text-xs rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700">
                        {CAMERA_ANGLES.map((a) => (
                          <SelectItem key={a} value={a} className="text-zinc-200 text-xs">{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={shot.duration}
                      onChange={(e) => updateShot(shot.id, { duration: e.target.value })}
                      placeholder="10s"
                      className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <Input
                      value={shot.props}
                      onChange={(e) => updateShot(shot.id, { props: e.target.value })}
                      placeholder="Chair, lamp..."
                      className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <Input
                      value={shot.talents}
                      onChange={(e) => updateShot(shot.id, { talents: e.target.value })}
                      placeholder="John, Sarah..."
                      className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <Input
                      value={shot.notes}
                      onChange={(e) => updateShot(shot.id, { notes: e.target.value })}
                      placeholder="Director notes..."
                      className="bg-transparent border-none text-sm text-zinc-300 h-8 px-1 focus-visible:bg-zinc-800 focus-visible:ring-0 rounded-lg"
                    />
                    <button
                      onClick={() => setShots(shots.filter((s) => s.id !== shot.id))}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors mx-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
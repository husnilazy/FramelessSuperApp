import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, FileText, MapPin, Clock, ChevronDown, ChevronUp,
  Sparkles, Wand2, Loader2,
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

interface ScriptBreakdownEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
  onNavigateDoc?: (id: string) => void;
}

interface Scene {
  id: string;
  sceneNumber: string;
  description: string;
  location: string;
  timeOfDay: string;
  duration: string;
  cast: string[];
  dialogue: string;
}

export function ScriptBreakdownEditor({ documentId, onSaved, onBack, onNavigateDoc }: ScriptBreakdownEditorProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [expandedScene, setExpandedScene] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<PipelineLinks | null>(null);
  const autoSaveRef = useRef<any>(null);

  // AI: generate scenes dari brief
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiCount, setAiCount] = useState(4);
  const [aiGenerating, setAiGenerating] = useState(false);

  // AI: fill 1 scene tertentu
  const [aiFillSceneId, setAiFillSceneId] = useState<string | null>(null);
  const [aiFillPrompt, setAiFillPrompt] = useState("");
  const [aiFilling, setAiFilling] = useState(false);

  const activeUsers = usePresence(documentId, getToken);
  const navigateDoc = onNavigateDoc || ((id: string) => setLocation(`/filmmaking-tools/documents/${id}`));

  useEffect(() => { fetchDocument(); }, [documentId]);

  useEffect(() => {
    if (loading) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => saveDocument(true), 4000);
    return () => clearTimeout(autoSaveRef.current);
  }, [scenes, title]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTitle(data.title || "");
      setScenes((data.content as any)?.scenes || []);
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
        body: JSON.stringify({ title, content: { scenes }, isDraft: true }),
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

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Math.random().toString(36).substr(2, 9),
      sceneNumber: `Scene ${scenes.length + 1}`,
      description: "",
      location: "",
      timeOfDay: "DAY",
      duration: "",
      cast: [],
      dialogue: "",
    };
    setScenes([...scenes, newScene]);
    setExpandedScene(newScene.id);
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setScenes(scenes.map((s) => (s.id === id ? { ...s, ...updates } : s)));
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

  // ===== AI: generate beberapa scene baru dari brief singkat =====
  const handleAiGenerateScenes = async () => {
    if (!aiBrief.trim()) {
      toast({ variant: "destructive", title: "Tulis dulu brief-nya (mau cerita/adegan tentang apa)." });
      return;
    }
    setAiGenerating(true);
    try {
      await saveDocument(true);
      const res = await fetch(`/api/filmmaking-documents/${documentId}/ai-generate-scenes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ brief: aiBrief, count: aiCount }),
      });
      if (!res.ok) {
        const errBody = await res.json();
        const message = errBody.raw
          ? `${errBody.error}\n\nAI response: ${errBody.raw}`
          : (errBody.details || errBody.error || "Gagal generate scene");
        throw new Error(message);
      }
      const data = await res.json();
      setScenes((data.document.content as any)?.scenes || []);
      setAiDialogOpen(false);
      setAiBrief("");
      toast({ title: `${data.addedCount} scene baru ditambahkan oleh AI ✨` });
    } catch (err) {
      toast({ variant: "destructive", title: "AI generate scene gagal", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAiGenerating(false);
    }
  };

  // ===== AI: lengkapi 1 scene tertentu berdasarkan instruksi singkat =====
  const openAiFillScene = (sceneId: string) => {
    setAiFillSceneId(sceneId);
    setAiFillPrompt("");
  };

  const handleAiFillScene = async () => {
    if (!aiFillSceneId || !aiFillPrompt.trim()) {
      toast({ variant: "destructive", title: "Tulis instruksi singkat dulu (misal: 'buatkan adegan opening yang hangat')" });
      return;
    }
    setAiFilling(true);
    try {
      await saveDocument(true);
      const res = await fetch(`/api/filmmaking-documents/${documentId}/ai-fill-scene`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId: aiFillSceneId, prompt: aiFillPrompt }),
      });
      if (!res.ok) {
        const errBody = await res.json();
        const message = errBody.raw
          ? `${errBody.error}\n\nAI response: ${errBody.raw}`
          : (errBody.details || errBody.error || "Gagal mengisi scene");
        throw new Error(message);
      }
      const data = await res.json();
      setScenes((data.document.content as any)?.scenes || []);
      setAiFillSceneId(null);
      setAiFillPrompt("");
      toast({ title: "Scene berhasil dilengkapi AI ✨" });
    } catch (err) {
      toast({ variant: "destructive", title: "AI gagal mengisi scene", description: err instanceof Error ? err.message : undefined });
    } finally {
      setAiFilling(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full bg-zinc-950"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <EditorToolbar
        icon={<FileText className="w-4 h-4" />}
        accentColorClass="text-blue-400"
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Script Breakdown Title..."
        onBack={() => { if (onBack) onBack(); else setLocation("/filmmaking-tools"); }}
        activeUsers={activeUsers}
        saving={saving}
        lastSaved={lastSaved}
        primaryAction={
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/20">
                <Sparkles className="w-4 h-4" />
                AI Generate Scene
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-zinc-100">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  AI Generate Scene
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Textarea
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  placeholder="Ceritakan singkat mau bikin adegan tentang apa. Contoh: 'Video promosi kopi, mulai dari proses roasting sampai penyajian di kafe, suasana hangat dan intim.'"
                  className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[100px]"
                />
                <div className="flex items-center gap-3">
                  <label className="text-xs text-zinc-400 uppercase tracking-wider">Jumlah scene</label>
                  <Select value={String(aiCount)} onValueChange={(v) => setAiCount(Number(v))}>
                    <SelectTrigger className="w-24 bg-zinc-800 border-zinc-700 text-zinc-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {[2, 3, 4, 5, 6, 8].map((n) => (
                        <SelectItem key={n} value={String(n)} className="text-zinc-100">{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAiGenerateScenes}
                  disabled={aiGenerating || !aiBrief.trim()}
                  className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold"
                >
                  {aiGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Wand2 className="w-4 h-4" /> Generate</>}
                </Button>
                <p className="text-xs text-zinc-500 text-center">Scene baru akan ditambahkan ke daftar, scene yang sudah ada tidak dihapus.</p>
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
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-500">{scenes.length} scene{scenes.length !== 1 ? "s" : ""}</p>
            <Button onClick={handleAddScene} variant="outline" className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 rounded-xl">
              <Plus className="w-4 h-4" />
              Add Scene Manual
            </Button>
          </div>

          {scenes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                <FileText className="w-8 h-8 text-zinc-600" />
              </div>
              <p className="text-zinc-500">No scenes yet. Add manually, or let AI generate scenes from a brief.</p>
              <Button onClick={() => setAiDialogOpen(true)} className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white">
                <Sparkles className="w-4 h-4" /> AI Generate Scene
              </Button>
            </div>
          )}

          {scenes.map((scene, idx) => (
            <div key={scene.id} className="border border-zinc-800 rounded-2xl bg-zinc-900/40 overflow-hidden">
              {/* Scene Header */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpandedScene(expandedScene === scene.id ? null : scene.id); }}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-lg">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="text-left">
                    <p className="font-semibold text-zinc-100">{scene.sceneNumber || `Scene ${idx + 1}`}</p>
                    <p className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2">
                      {scene.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{scene.location}</span>}
                      {scene.timeOfDay && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{scene.timeOfDay}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); openAiFillScene(scene.id); }}
                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-zinc-600 hover:text-blue-400 transition-colors"
                    title="AI lengkapi scene ini"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setScenes(scenes.filter((s) => s.id !== scene.id)); }}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedScene === scene.id ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
                </div>
              </div>

              {/* Scene Details */}
              {expandedScene === scene.id && (
                <div className="px-5 pb-5 space-y-4 border-t border-zinc-800">
                  <div className="pt-4 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500 uppercase tracking-wider">Scene Name</label>
                      <Input value={scene.sceneNumber} onChange={(e) => updateScene(scene.id, { sceneNumber: e.target.value })} placeholder="Scene 1" className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500 uppercase tracking-wider">Duration</label>
                      <Input value={scene.duration} onChange={(e) => updateScene(scene.id, { duration: e.target.value })} placeholder="2 min" className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500 uppercase tracking-wider">Location</label>
                      <Input value={scene.location} onChange={(e) => updateScene(scene.id, { location: e.target.value })} placeholder="INT. STUDIO" className="bg-zinc-800 border-zinc-700 text-zinc-100" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-zinc-500 uppercase tracking-wider">Time of Day</label>
                      <Select value={scene.timeOfDay || "DAY"} onValueChange={(v) => updateScene(scene.id, { timeOfDay: v })}>
                        <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          {["DAY", "NIGHT", "DAWN", "DUSK", "GOLDEN HOUR"].map((t) => (
                            <SelectItem key={t} value={t} className="text-zinc-100">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">Scene Description</label>
                    <Textarea value={scene.description} onChange={(e) => updateScene(scene.id, { description: e.target.value })} placeholder="Describe what happens in this scene..." className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px]" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-500 uppercase tracking-wider">Dialogue / Script Excerpt</label>
                    <Textarea value={scene.dialogue} onChange={(e) => updateScene(scene.id, { dialogue: e.target.value })} placeholder="Key dialogue or script notes..." className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[80px] font-mono" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Fill Scene Dialog */}
      <Dialog open={!!aiFillSceneId} onOpenChange={(v) => !v && setAiFillSceneId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-100">
              <Sparkles className="w-4 h-4 text-blue-400" />
              AI Lengkapi Scene
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              value={aiFillPrompt}
              onChange={(e) => setAiFillPrompt(e.target.value)}
              placeholder="Instruksi singkat, contoh: 'Buatkan adegan closing yang emosional dengan dialog perpisahan' atau 'lengkapi lokasi dan durasi yang masuk akal'"
              className="bg-zinc-800 border-zinc-700 text-zinc-100 min-h-[90px]"
            />
            <Button
              onClick={handleAiFillScene}
              disabled={aiFilling || !aiFillPrompt.trim()}
              className="w-full gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold"
            >
              {aiFilling ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : <><Wand2 className="w-4 h-4" /> Lengkapi dengan AI</>}
            </Button>
            <p className="text-xs text-zinc-500 text-center">Konten yang sudah bagus akan dipertahankan AI, cuma bagian kosong/kurang yang dilengkapi.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
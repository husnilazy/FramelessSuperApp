import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  X, Plus, Lightbulb, CheckCircle2, Sparkles, Clapperboard, FileText,
  Grid3x3, BookOpen, ChevronRight, AlertCircle, Loader2, FileDown, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollaboratorDialog, type Collaborator } from "./shared/CollaboratorDialog";
import { usePresence } from "./shared/usePresence";
import { EditorToolbar } from "./shared/EditorToolbar";
import { PipelineNav, type PipelineLinks } from "./shared/PipelineNav";
import { downloadDocumentPdf } from "./shared/pdfDownload";

const getToken = () => localStorage.getItem("crew_token") || localStorage.getItem("token");

interface ConceptEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
  onNavigateDoc?: (id: string) => void;
}

interface GenerateResult {
  scriptBreakdownId: string;
  shotlistId: string;
  screenplayId: string;
  scenesCount: number;
  shotsCount: number;
  pipeline: PipelineLinks;
  updated?: boolean;
}

export function ConceptEditor({ documentId, onSaved, onBack, onNavigateDoc }: ConceptEditorProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [newIdea, setNewIdea] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateProgress, setGenerateProgress] = useState("");
  const [pipeline, setPipeline] = useState<PipelineLinks | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const autoSaveRef = useRef<any>(null);

  const activeUsers = usePresence(documentId, getToken);
  const navigateDoc = onNavigateDoc || ((id: string) => setLocation(`/filmmaking-tools/documents/${id}`));

  useEffect(() => { fetchDocument(); }, [documentId]);

  useEffect(() => {
    if (loading) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => saveDocument(true), 4000);
    return () => clearTimeout(autoSaveRef.current);
  }, [notes, title, ideas]);

  const fetchDocument = async () => {
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setTitle(data.title || "");
      setNotes((data.content as any)?.notes || "");
      setIdeas((data.content as any)?.ideas || []);
      setCollaborators(data.collaborators || []);
      setPipeline((data.content as any)?._pipeline || null);
      if ((data.content as any)?._pipeline) {
        setGenerateResult((prev) => prev || {
          scriptBreakdownId: (data.content as any)._pipeline.scriptId,
          shotlistId: (data.content as any)._pipeline.shotlistId,
          screenplayId: (data.content as any)._pipeline.screenplayId,
          scenesCount: 0,
          shotsCount: 0,
          pipeline: (data.content as any)._pipeline,
        });
      }
    } catch (err) {
      console.error("Fetch failed:", err);
      toast({ variant: "destructive", title: "Gagal memuat dokumen" });
    } finally { setLoading(false); }
  };

  const saveDocument = async (isAutoSave = false) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/filmmaking-documents/${documentId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, content: { notes, ideas }, isDraft: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      setLastSaved(new Date());
      if (!isAutoSave) { onSaved(); toast({ title: "Tersimpan" }); }
    } catch (err) {
      console.error("Save failed:", err);
      if (!isAutoSave) toast({ variant: "destructive", title: "Gagal menyimpan" });
    } finally { setSaving(false); }
  };

  const handleAddIdea = () => {
    if (!newIdea.trim()) return;
    setIdeas([...ideas, newIdea.trim()]);
    setNewIdea("");
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
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal submit" });
    } finally { setSubmitting(false); }
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

  const handleDownloadAllPdf = async () => {
    if (!pipeline) return;
    setDownloadingAll(true);
    try {
      const jobs: [string, string][] = [];
      if (pipeline.screenplayId) jobs.push([pipeline.screenplayId, `${title} - Screenplay`]);
      if (pipeline.scriptId) jobs.push([pipeline.scriptId, `${title} - Script Breakdown`]);
      if (pipeline.shotlistId) jobs.push([pipeline.shotlistId, `${title} - Shotlist`]);

      for (const [id, docTitle] of jobs) {
        await downloadDocumentPdf(id, docTitle, getToken());
        await new Promise((r) => setTimeout(r, 400)); // jeda kecil biar browser gak nge-block multi download
      }
      toast({ title: `${jobs.length} PDF berhasil di-download` });
    } catch (err) {
      toast({ variant: "destructive", title: "Gagal download semua PDF", description: err instanceof Error ? err.message : undefined });
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleAiGenerate = async () => {
    const hasContent = notes.trim() || ideas.length > 0;
    if (!hasContent) {
      setGenerateError("Please write some concept notes or add ideas before generating.");
      return;
    }

    setGenerating(true);
    setGenerateError(null);

    const isResync = !!pipeline;
    const steps = isResync
      ? ["Saving concept...", "Reading perubahan konsep...", "AI menulis ulang screenplay...", "Update scene breakdown...", "Update shotlist...", "Menyimpan perubahan..."]
      : ["Saving concept...", "Reading your concept...", "AI is analyzing and writing screenplay...", "Breaking down scenes...", "Generating shotlist...", "Creating documents..."];

    let stepIdx = 0;
    setGenerateProgress(steps[0]);
    const progressInterval = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setGenerateProgress(steps[stepIdx]);
    }, 2000);

    try {
      await saveDocument(true);

      const res = await fetch(`/api/filmmaking-documents/${documentId}/ai-concept-generate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(isResync ? {
          targetScreenplayId: pipeline?.screenplayId,
          targetScriptId: pipeline?.scriptId,
          targetShotlistId: pipeline?.shotlistId,
        } : {}),
      });

      if (!res.ok) {
        const errBody = await res.json();
        const message = errBody.raw
          ? `${errBody.error}\n\nAI response: ${errBody.raw}`
          : (errBody.details || errBody.error || "AI generation failed");
        throw new Error(message);
      }

      const result: GenerateResult = await res.json();
      setGenerateResult(result);
      setPipeline(result.pipeline);
      toast({ title: isResync ? "Pipeline berhasil diperbarui 🔄" : "AI selesai generate dokumen produksi 🎬" });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      clearInterval(progressInterval);
      setGenerateProgress("");
      setGenerating(false);
    }
  };

  const hasContent = notes.trim() || ideas.length > 0;
  const isResync = !!pipeline;

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-zinc-950">
      <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      <EditorToolbar
        icon={<Lightbulb className="w-4 h-4" />}
        accentColorClass="text-amber-400"
        title={title}
        onTitleChange={setTitle}
        titlePlaceholder="Untitled Concept..."
        onBack={() => { if (onBack) onBack(); else setLocation("/filmmaking-tools"); }}
        activeUsers={activeUsers}
        saving={saving}
        lastSaved={lastSaved}
        primaryAction={
          <Button
            onClick={handleAiGenerate}
            disabled={generating || !hasContent}
            className="relative gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/20 transition-all duration-200"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isResync ? "Updating..." : "Generating..."}</>
              : isResync
                ? <><RefreshCw className="w-4 h-4" /> Update Pipeline</>
                : <><Sparkles className="w-4 h-4" /> AI Generate</>
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* AI Generating Progress */}
          {generating && (
            <div className="border border-amber-500/30 bg-amber-500/10 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                <Clapperboard className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-200">{isResync ? "AI sedang memperbarui pipeline produksi..." : "AI is generating your production documents..."}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                  <p className="text-sm text-amber-400/80">{generateProgress}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {generateError && !generating && (
            <div className="border border-red-500/30 bg-red-500/10 rounded-2xl p-5 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-red-300">Generation Failed</p>
                <p className="text-sm text-red-400/80 mt-0.5 whitespace-pre-wrap break-words">{generateError}</p>
              </div>
            </div>
          )}

          {/* Success Result */}
          {generateResult && !generating && (
            <div className="border border-emerald-500/30 bg-emerald-500/10 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-emerald-200">
                      {isResync ? "Pipeline updated! 🔄" : "AI Generation Complete! 🎬"}
                    </p>
                    {generateResult.scenesCount > 0 && (
                      <p className="text-sm text-emerald-400/80">
                        {generateResult.scenesCount} scenes · {generateResult.shotsCount} shots
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadAllPdf}
                  disabled={downloadingAll}
                  className="gap-2 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                >
                  {downloadingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                  Download Semua PDF
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  className="flex items-center gap-3 p-3 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-xl border border-zinc-700 transition-colors text-left group"
                  onClick={() => navigateDoc(generateResult.screenplayId)}
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Narrative</p>
                    <p className="text-sm font-semibold text-zinc-200 truncate">Screenplay</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 ml-auto transition-colors" />
                </button>

                <button
                  className="flex items-center gap-3 p-3 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-xl border border-zinc-700 transition-colors text-left group"
                  onClick={() => navigateDoc(generateResult.scriptBreakdownId)}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Script</p>
                    <p className="text-sm font-semibold text-zinc-200 truncate">Breakdown</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 ml-auto transition-colors" />
                </button>

                <button
                  className="flex items-center gap-3 p-3 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-xl border border-zinc-700 transition-colors text-left group"
                  onClick={() => navigateDoc(generateResult.shotlistId)}
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Grid3x3 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 uppercase tracking-wider">Camera</p>
                    <p className="text-sm font-semibold text-zinc-200 truncate">Shotlist</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 ml-auto transition-colors" />
                </button>
              </div>
              {isResync && (
                <p className="text-xs text-zinc-600 mt-3 text-center">
                  Screenplay, Breakdown, dan Shotlist yang sudah ada tadi ikut diperbarui isinya (bukan bikin dokumen baru).
                </p>
              )}
            </div>
          )}

          {/* AI Hint Banner (show when empty, not generating) */}
          {!hasContent && !generating && !generateResult && (
            <div className="border border-dashed border-amber-500/20 bg-amber-500/5 rounded-2xl p-5 text-center">
              <Sparkles className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
              <p className="text-sm text-zinc-400 font-medium">Write your concept below</p>
              <p className="text-xs text-zinc-600 mt-1">
                Describe your creative vision in the notes section, then click <span className="text-amber-400 font-semibold">✨ AI Generate</span> to automatically create a Screenplay, Script Breakdown, and Shotlist.
              </p>
            </div>
          )}

          {/* Notes */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Concept Notes
            </h2>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={"Describe your creative vision...\n\nExample:\nWe want to create a product launch video for a new coffee brand. The mood should be warm, intimate, and artisanal. Key themes: morning ritual, craftmanship, community. Target audience: urban professionals aged 25-40.\n\nVisual style: Warm tones, shallow depth of field, natural light.\nLocation ideas: Cozy café interior, rooftop at sunrise.\nMusic vibe: Lo-fi jazz, acoustic guitar."}
              className="bg-transparent border-none shadow-none focus-visible:ring-0 text-zinc-200 placeholder:text-zinc-600/60 resize-none min-h-[280px] text-base leading-7 p-0"
            />
          </div>

          {/* Ideas */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
              Quick Ideas
            </h2>
            <div className="space-y-2 mb-3">
              {ideas.map((idea, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-zinc-800/60 rounded-xl group">
                  <span className="text-amber-500 flex-shrink-0 text-lg leading-none">•</span>
                  <span className="text-zinc-200 text-sm flex-1">{idea}</span>
                  <button
                    onClick={() => setIdeas(ideas.filter((_, j) => j !== i))}
                    className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {ideas.length === 0 && (
                <p className="text-zinc-600 text-sm italic">No ideas added yet. Use this for bullet points like scene ideas, references, etc.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddIdea()}
                placeholder="Add an idea (press Enter)..."
                className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-600"
              />
              <Button onClick={handleAddIdea} variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* AI Generate CTA at bottom */}
          {hasContent && (
            <div className="border border-dashed border-amber-500/30 rounded-2xl p-5 flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <p className="font-semibold text-zinc-200">{isResync ? "Sudah ubah konsepnya?" : "Ready to produce?"}</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {isResync
                    ? "Update Screenplay, Breakdown, dan Shotlist yang sudah ada supaya sesuai konsep terbaru."
                    : "Let AI automatically generate a full Screenplay, Script Breakdown, and Shotlist from your concept above."}
                </p>
              </div>
              <Button
                onClick={handleAiGenerate}
                disabled={generating}
                className="flex-shrink-0 gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/20"
              >
                {isResync ? <RefreshCw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                {isResync ? "Update Pipeline" : "Generate Now"}
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
// PATH SARAN: src/pages/FilmmakingTools/shared/EditorToolbar.tsx
//
// Toolbar seragam dipakai oleh SEMUA editor (Concept, Screenplay, Script Breakdown,
// Shotlist) supaya spacing, urutan tombol, dan warna terjamin konsisten satu sama
// lain -- tidak ada lagi copy-paste toolbar manual yang gampang ngedrift.
import React, { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Download, Send, Loader2, CheckCircle2 } from "lucide-react";
import { CollaboratorDialog, type Collaborator } from "./CollaboratorDialog";
import { PresenceAvatars } from "./PresenceAvatars";
import type { ActiveCollaborator } from "./usePresence";

interface EditorToolbarProps {
  icon: ReactNode;
  accentColorClass: string; // contoh: "text-purple-400"
  title: string;
  onTitleChange: (v: string) => void;
  titlePlaceholder: string;
  onBack: () => void;

  activeUsers: ActiveCollaborator[];
  statusBadge?: string | null;
  saving: boolean;
  lastSaved: Date | null;

  /** Slot untuk tombol/aksi khusus tiap editor (AI Generate, AI Breakdown, dst) */
  primaryAction?: ReactNode;

  documentId: string;
  collaborators: Collaborator[];
  onCollaboratorsChange: (c: Collaborator[]) => void;
  getToken: () => string | null;

  exporting: boolean;
  onExportPdf: () => void;

  submitting: boolean;
  onSubmit: () => void;

  onSave: () => void;
}

export function EditorToolbar({
  icon,
  accentColorClass,
  title,
  onTitleChange,
  titlePlaceholder,
  onBack,
  activeUsers,
  statusBadge,
  saving,
  lastSaved,
  primaryAction,
  documentId,
  collaborators,
  onCollaboratorsChange,
  getToken,
  exporting,
  onExportPdf,
  submitting,
  onSubmit,
  onSave,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10 gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Button variant="ghost" size="icon" className="rounded-full hover:bg-zinc-800 flex-shrink-0" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 bg-zinc-800/80 border border-zinc-700 rounded-xl px-3 py-1.5 flex-1 max-w-md">
          <span className={`flex-shrink-0 ${accentColorClass}`}>{icon}</span>
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="border-none shadow-none focus-visible:ring-0 bg-transparent text-sm font-semibold px-0 h-auto py-0 text-zinc-100"
            placeholder={titlePlaceholder}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <PresenceAvatars users={activeUsers} />

        {statusBadge && (
          <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/20 px-3 py-1 rounded-full capitalize">
            {statusBadge.replace("_", " ")}
          </span>
        )}

        {lastSaved && !saving && (
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Saved
          </span>
        )}

        {primaryAction}

        <div className="h-5 w-px bg-zinc-700" />

        <CollaboratorDialog
          documentId={documentId}
          collaborators={collaborators}
          onChange={onCollaboratorsChange}
          getToken={getToken}
          accentColorClass={accentColorClass}
        />

        <Button variant="ghost" size="icon" className="rounded-xl hover:bg-zinc-800" onClick={onExportPdf} disabled={exporting} title="Export PDF">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </Button>

        <Button variant="outline" className="gap-2 rounded-xl border-zinc-700 text-zinc-300 hover:bg-zinc-800" onClick={onSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Submit
        </Button>

        <Button onClick={onSave} disabled={saving} className="gap-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-semibold">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
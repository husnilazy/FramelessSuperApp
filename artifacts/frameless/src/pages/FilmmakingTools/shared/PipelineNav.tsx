// PATH SARAN: src/pages/FilmmakingTools/shared/PipelineNav.tsx
//
// Menampilkan strip navigasi horizontal kalau dokumen yang sedang dibuka adalah
// bagian dari sebuah "pipeline" (hasil AI Generate dari Concept, atau AI Breakdown
// dari Screenplay). User bisa klik loncat ke dokumen sebelah tanpa balik ke
// document list dulu -- ini bagian dari "one-click production pipeline".
import React from "react";
import { Lightbulb, BookOpen, FileText, Grid3x3, ChevronRight } from "lucide-react";

export interface PipelineLinks {
  conceptId?: string;
  screenplayId?: string;
  scriptId?: string;
  shotlistId?: string;
}

interface PipelineNavProps {
  links: PipelineLinks | undefined | null;
  currentId: string;
  onNavigate: (id: string) => void;
}

const STEPS: { key: keyof PipelineLinks; label: string; Icon: any; activeClass: string }[] = [
  { key: "conceptId", label: "Concept", Icon: Lightbulb, activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { key: "screenplayId", label: "Screenplay", Icon: BookOpen, activeClass: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  { key: "scriptId", label: "Breakdown", Icon: FileText, activeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { key: "shotlistId", label: "Shotlist", Icon: Grid3x3, activeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
];

export function PipelineNav({ links, currentId, onNavigate }: PipelineNavProps) {
  if (!links) return null;
  const availableSteps = STEPS.filter((s) => links[s.key]);
  if (availableSteps.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-800/60 bg-zinc-900/30 overflow-x-auto">
      <span className="text-[10px] text-zinc-600 uppercase tracking-wider mr-1 flex-shrink-0 font-semibold">Pipeline</span>
      {availableSteps.map((step, i) => {
        const id = links[step.key] as string;
        const isActive = id === currentId;
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />}
            <button
              onClick={() => !isActive && onNavigate(id)}
              disabled={isActive}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex-shrink-0 ${
                isActive
                  ? step.activeClass
                  : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 cursor-pointer"
              }`}
            >
              <step.Icon className="w-3.5 h-3.5" />
              {step.label}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}
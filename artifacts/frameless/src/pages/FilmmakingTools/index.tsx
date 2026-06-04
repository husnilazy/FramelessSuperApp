import React, { useState, Suspense } from "react";
import { useRoute, useLocation } from "wouter";
import { DocumentList } from "./DocumentList";
import { ConceptEditor } from "./ConceptEditor";
import { ScriptBreakdownEditor } from "./ScriptBreakdownEditor";
import { ShotlistEditor } from "./ShotlistEditor";

/**
 * FilmmakingTools - Main layout for filmmaking tools
 * Routes:
 * - /filmmaking-tools -> Document list
 * - /filmmaking-tools/documents/:id -> Editor based on doc type
 */
export function FilmmakingTools() {
  const [docListKey, setDocListKey] = useState(0);
  const [match, params] = useRoute("/filmmaking-tools/documents/:id");
  const [, setLocation] = useLocation();
  const [localDocId, setLocalDocId] = useState<string | null>(null);

  // Use local state if set, fallback to wouter route params
  const documentId = localDocId || (match ? params?.id : null);

  const handleOpenDoc = (id: string) => {
    if (window.location.pathname.startsWith("/filmmaking-tools")) {
      setLocation(`/filmmaking-tools/documents/${id}`);
    } else {
      setLocalDocId(id);
    }
  };

  const handleBack = () => {
    if (window.location.pathname.startsWith("/filmmaking-tools")) {
      setLocation("/filmmaking-tools");
    } else {
      setLocalDocId(null);
    }
  };

  if (documentId) {
    return (
      <div className="flex flex-col h-full">
        <EditorContainer
          documentId={documentId}
          onDocumentSaved={() => {
            // Refresh list when document is saved
            setDocListKey((prev) => prev + 1);
          }}
          onBack={handleBack}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Suspense fallback={<div className="p-4">Loading...</div>}>
        <DocumentList key={docListKey} onOpenDoc={handleOpenDoc} />
      </Suspense>
    </div>
  );
}

/**
 * EditorContainer - Dynamically loads editor based on document type
 */
interface EditorContainerProps {
  documentId: string;
  onDocumentSaved: () => void;
  onBack: () => void;
}

function EditorContainer({ documentId, onDocumentSaved, onBack }: EditorContainerProps) {
  const [docType, setDocType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    // Fetch document to determine type
    const fetchDocType = async () => {
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch(
          `/api/filmmaking-documents/${documentId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const data = await response.json();
        setDocType(data.docType);
      } catch (err) {
        console.error("Failed to fetch document:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDocType();
  }, [documentId]);

  if (loading) {
    return <div className="p-4">Loading editor...</div>;
  }

  if (!docType) {
    return <div className="p-4 text-red-500">Failed to load document</div>;
  }

  // Route to correct editor based on doc type
  switch (docType) {
    case "concept":
      return (
        <ConceptEditor documentId={documentId} onSaved={onDocumentSaved} onBack={onBack} />
      );
    case "script":
      return (
        <ScriptBreakdownEditor documentId={documentId} onSaved={onDocumentSaved} onBack={onBack} />
      );
    case "shotlist":
      return (
        <ShotlistEditor documentId={documentId} onSaved={onDocumentSaved} onBack={onBack} />
      );
    default:
      return <div className="p-4 text-red-500">Unknown document type</div>;
  }
}

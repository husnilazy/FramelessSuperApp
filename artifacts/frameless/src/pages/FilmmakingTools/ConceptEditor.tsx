import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save } from "lucide-react";

interface ConceptEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
}

interface ConceptContent {
  notes?: string;
  ideas?: string[];
  moodBoard?: string | null;
}

export function ConceptEditor({ documentId, onSaved, onBack }: ConceptEditorProps) {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<ConceptContent>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  const fetchDocument = async () => {
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const response = await fetch(`/api/filmmaking-documents/${documentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setTitle(data.title);
      setContent(data.content || {});
      setNotes(data.content?.notes || "");
    } catch (err) {
      console.error("Failed to fetch document:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      await fetch(`/api/filmmaking-documents/${documentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content: {
            ...content,
            notes,
          },
          isDraft: false,
          changeSummary: "Updated concept notes",
        }),
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save document:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (onBack) onBack();
              else setLocation("/filmmaking-tools");
            }}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold"
            placeholder="Concept title"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4 max-w-4xl">
          <div>
            <label className="block text-sm font-medium mb-2">
              Concept Notes
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your concept ideas, vision, and notes here..."
              className="min-h-[400px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

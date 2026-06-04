import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Plus, Trash2 } from "lucide-react";

interface ScriptBreakdownEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
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

export function ScriptBreakdownEditor({
  documentId,
  onSaved,
  onBack,
}: ScriptBreakdownEditorProps) {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

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
      setScenes(data.content?.scenes || []);
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
          content: { scenes },
          isDraft: false,
          changeSummary: "Updated script breakdown",
        }),
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save document:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Math.random().toString(36),
      sceneNumber: `Scene ${scenes.length + 1}`,
      description: "",
      location: "",
      timeOfDay: "",
      duration: "",
      cast: [],
      dialogue: "",
    };
    setScenes([...scenes, newScene]);
  };

  const handleDeleteScene = (id: string) => {
    setScenes(scenes.filter((s) => s.id !== id));
  };

  const updateScene = (id: string, updates: Partial<Scene>) => {
    setScenes(
      scenes.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
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
            placeholder="Script breakdown title"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4 max-w-6xl">
          <Button onClick={handleAddScene} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Scene
          </Button>

          {scenes.map((scene) => (
            <div key={scene.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={scene.sceneNumber}
                  onChange={(e) =>
                    updateScene(scene.id, { sceneNumber: e.target.value })
                  }
                  placeholder="Scene 1"
                  className="font-semibold w-1/4"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteScene(scene.id)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={scene.location}
                  onChange={(e) =>
                    updateScene(scene.id, { location: e.target.value })
                  }
                  placeholder="Location"
                />
                <Input
                  value={scene.timeOfDay}
                  onChange={(e) =>
                    updateScene(scene.id, { timeOfDay: e.target.value })
                  }
                  placeholder="Time of Day"
                />
              </div>

              <Textarea
                value={scene.description}
                onChange={(e) =>
                  updateScene(scene.id, { description: e.target.value })
                }
                placeholder="Scene description"
                className="min-h-20"
              />

              <Textarea
                value={scene.dialogue}
                onChange={(e) =>
                  updateScene(scene.id, { dialogue: e.target.value })
                }
                placeholder="Dialogue and script"
                className="min-h-20"
              />

              <Input
                value={scene.duration}
                onChange={(e) =>
                  updateScene(scene.id, { duration: e.target.value })
                }
                placeholder="Duration (e.g., 2 min)"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Plus, Trash2, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ShotlistEditorProps {
  documentId: string;
  onSaved: () => void;
  onBack?: () => void;
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

export function ShotlistEditor({
  documentId,
  onSaved,
  onBack,
}: ShotlistEditorProps) {
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
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
      setShots(data.content?.shots || []);
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
          content: { shots },
          isDraft: false,
          changeSummary: "Updated shotlist",
        }),
      });
      onSaved();
    } catch (err) {
      console.error("Failed to save document:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddShot = () => {
    const newShot: Shot = {
      id: Math.random().toString(36),
      sceneNumber: "",
      shotNumber: `${shots.length + 1}`,
      description: "",
      cameraAngle: "",
      duration: "",
      props: "",
      talents: "",
      notes: "",
    };
    setShots([...shots, newShot]);
  };

  const handleDeleteShot = (id: string) => {
    setShots(shots.filter((s) => s.id !== id));
  };

  const updateShot = (id: string, updates: Partial<Shot>) => {
    setShots(shots.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const handleExportPDF = () => {
    // Simple PDF export (placeholder - implement with html2pdf or similar)
    alert("PDF export feature coming soon!");
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
            placeholder="Shotlist title"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4">
          <Button onClick={handleAddShot} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Shot
          </Button>

          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Scene</TableHead>
                  <TableHead className="w-12">Shot</TableHead>
                  <TableHead className="w-40">Description</TableHead>
                  <TableHead className="w-24">Angle</TableHead>
                  <TableHead className="w-20">Duration</TableHead>
                  <TableHead className="w-24">Props</TableHead>
                  <TableHead className="w-24">Talents</TableHead>
                  <TableHead className="w-32">Notes</TableHead>
                  <TableHead className="w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shots.map((shot) => (
                  <TableRow key={shot.id}>
                    <TableCell>
                      <Input
                        value={shot.sceneNumber}
                        onChange={(e) =>
                          updateShot(shot.id, {
                            sceneNumber: e.target.value,
                          })
                        }
                        placeholder="S1"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.shotNumber}
                        onChange={(e) =>
                          updateShot(shot.id, { shotNumber: e.target.value })
                        }
                        placeholder="1"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.description}
                        onChange={(e) =>
                          updateShot(shot.id, {
                            description: e.target.value,
                          })
                        }
                        placeholder="Wide shot..."
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.cameraAngle}
                        onChange={(e) =>
                          updateShot(shot.id, {
                            cameraAngle: e.target.value,
                          })
                        }
                        placeholder="High"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.duration}
                        onChange={(e) =>
                          updateShot(shot.id, { duration: e.target.value })
                        }
                        placeholder="10s"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.props}
                        onChange={(e) =>
                          updateShot(shot.id, { props: e.target.value })
                        }
                        placeholder="Chair..."
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.talents}
                        onChange={(e) =>
                          updateShot(shot.id, { talents: e.target.value })
                        }
                        placeholder="John"
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={shot.notes}
                        onChange={(e) =>
                          updateShot(shot.id, { notes: e.target.value })
                        }
                        placeholder="Notes..."
                        className="text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteShot(shot.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}

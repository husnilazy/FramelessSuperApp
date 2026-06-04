import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Film, Grid3x3, Trash2, Copy } from "lucide-react";

interface Document {
  id: string;
  title: string;
  docType: "concept" | "script" | "shotlist";
  projectId?: string;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentListProps {
  onOpenDoc?: (id: string) => void;
}

export function DocumentList({ onOpenDoc }: DocumentListProps = {}) {
  const [, setLocation] = useLocation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDocType, setNewDocType] = useState<"concept" | "script" | "shotlist">(
    "concept"
  );
  const [filter, setFilter] = useState<"all" | "concept" | "script" | "shotlist">(
    "all"
  );

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      
      if (!token) {
        setError("No authentication token found. Please log in again.");
        return;
      }

      const response = await fetch("/api/filmmaking-documents", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorData}`);
      }

      const data = await response.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Failed to fetch documents:", message);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleCreateDocument = async () => {
    if (!newTitle.trim()) return;

    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const response = await fetch("/api/filmmaking-documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docType: newDocType,
          title: newTitle,
          content: getDefaultContent(newDocType),
        }),
      });

      const doc = await response.json();
      setDocuments([doc, ...documents]);
      setCreateDialogOpen(false);
      setNewTitle("");
      if (onOpenDoc) onOpenDoc(doc.id);
      else setLocation(`/filmmaking-tools/documents/${doc.id}`);
    } catch (err) {
      console.error("Failed to create document:", err);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this document?"))
      return;

    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      await fetch(`/api/filmmaking-documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(documents.filter((doc) => doc.id !== id));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleDuplicateDocument = async (id: string) => {
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const response = await fetch(`/api/filmmaking-documents/${id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const doc = await response.json();
      setDocuments([doc, ...documents]);
    } catch (err) {
      console.error("Failed to duplicate document:", err);
    }
  };

  const filteredDocs =
    filter === "all" ? documents : documents.filter((d) => d.docType === filter);

  const getDocIcon = (type: string) => {
    switch (type) {
      case "concept":
        return <Film className="w-4 h-4" />;
      case "script":
        return <FileText className="w-4 h-4" />;
      case "shotlist":
        return <Grid3x3 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  if (loading) {
    return <div className="p-4">Loading documents...</div>;
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Filmmaking Tools</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Document title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Select
                value={newDocType}
                onValueChange={(val: any) => setNewDocType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="concept">Concept / Idea</SelectItem>
                  <SelectItem value="script">Script Breakdown</SelectItem>
                  <SelectItem value="shotlist">Shotlist</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleCreateDocument} className="w-full">
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["all", "concept", "script", "shotlist"] as const).map((type) => (
          <Button
            key={type}
            variant={filter === type ? "default" : "outline"}
            onClick={() => setFilter(type)}
            className="capitalize"
          >
            {type}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 border rounded-lg hover:shadow-md transition cursor-pointer"
              onClick={() => {
                if (onOpenDoc) onOpenDoc(doc.id);
                else setLocation(`/filmmaking-tools/documents/${doc.id}`);
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getDocIcon(doc.docType)}
                  <div>
                    <h3 className="font-semibold">{doc.title}</h3>
                    <p className="text-xs text-gray-500 capitalize">
                      {doc.docType}
                    </p>
                  </div>
                </div>
                {doc.isDraft && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Draft
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Modified: {new Date(doc.updatedAt).toLocaleDateString()}
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicateDocument(doc.id);
                  }}
                  className="flex-1"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteDocument(doc.id);
                  }}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredDocs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">No documents found. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getDefaultContent(type: string): any {
  switch (type) {
    case "concept":
      return {
        notes: "",
        ideas: [],
        moodBoard: null,
      };
    case "script":
      return {
        scenes: [],
        dialogue: "",
        cast: [],
        locations: [],
      };
    case "shotlist":
      return {
        shots: [],
      };
    default:
      return {};
  }
}

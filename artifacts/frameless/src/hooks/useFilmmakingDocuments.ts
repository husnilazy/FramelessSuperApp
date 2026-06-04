import { useState, useCallback, useEffect } from "react";

interface FilmmakingDocument {
  id: string;
  projectId?: string;
  crewId: string;
  docType: "concept" | "script" | "shotlist";
  title: string;
  content: any;
  isDraft: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useFilmmakingDocuments(projectId?: string) {
  const [documents, setDocuments] = useState<FilmmakingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      const params = projectId ? `?projectId=${projectId}` : "";
      const response = await fetch(`/api/filmmaking-documents${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch documents");
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const createDocument = useCallback(
    async (
      docType: "concept" | "script" | "shotlist",
      title: string,
      content?: any
    ) => {
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch("/api/filmmaking-documents", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ docType, title, content }),
        });

        if (!response.ok) throw new Error("Failed to create document");
        const doc = await response.json();
        setDocuments([doc, ...documents]);
        return doc;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [documents]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch(`/api/filmmaking-documents/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to delete document");
        setDocuments(documents.filter((d) => d.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [documents]
  );

  const duplicateDocument = useCallback(
    async (id: string) => {
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch(
          `/api/filmmaking-documents/${id}/duplicate`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to duplicate document");
        const doc = await response.json();
        setDocuments([doc, ...documents]);
        return doc;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [documents]
  );

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    createDocument,
    deleteDocument,
    duplicateDocument,
  };
}

import { useState, useCallback, useEffect } from "react";

interface FilmmakingCollaborator {
  id: string;
  documentId: string;
  crewMemberId: string;
  role: "owner" | "editor" | "viewer";
  addedBy: string;
  addedAt: string;
  memberName?: string;
  memberEmail?: string;
  memberAvatarUrl?: string;
}

export function useFilmmakingCollaborators(documentId: string) {
  const [collaborators, setCollaborators] = useState<FilmmakingCollaborator[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/filmmaking-documents/${documentId}/collaborators`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch collaborators");
      const data = await response.json();
      setCollaborators(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      fetchCollaborators();
    }
  }, [documentId, fetchCollaborators]);

  const addCollaborator = useCallback(
    async (crewMemberId: string, role: "editor" | "viewer") => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `/api/filmmaking-documents/${documentId}/collaborators`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ crewMemberId, role }),
          }
        );

        if (!response.ok) throw new Error("Failed to add collaborator");
        const collab = await response.json();
        setCollaborators([...collaborators, collab]);
        return collab;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [documentId, collaborators]
  );

  const removeCollaborator = useCallback(
    async (collaboratorId: string) => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          `/api/filmmaking-documents/${documentId}/collaborators/${collaboratorId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!response.ok) throw new Error("Failed to remove collaborator");
        setCollaborators(
          collaborators.filter((c) => c.id !== collaboratorId)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      }
    },
    [documentId, collaborators]
  );

  return {
    collaborators,
    loading,
    error,
    fetchCollaborators,
    addCollaborator,
    removeCollaborator,
  };
}

import { useState, useCallback } from "react";

interface FilmmakingSubmission {
  id: string;
  documentId: string;
  submittedBy: string;
  submittedAt: string;
  status: "pending" | "approved" | "revision_requested";
  adminNotes?: string;
  approvedAt?: string;
  approvedBy?: string;
}

export function useFilmmakingSubmissions(documentId: string) {
  const [submissions, setSubmissions] = useState<FilmmakingSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitDocument = useCallback(
    async (message?: string) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch(
          `/api/filmmaking-documents/${documentId}/submit`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          }
        );

        if (!response.ok) throw new Error("Failed to submit document");
        const submission = await response.json();
        setSubmissions([...submissions, submission]);
        return submission;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [documentId, submissions]
  );

  const getSubmissionStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
      // Get all submissions for this document
      const response = await fetch(`/api/filmmaking-submissions?status=pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch submissions");
      const data = await response.json();
      const docSubmissions = data.filter(
        (s: any) => s.documentId === documentId
      );
      setSubmissions(docSubmissions);
      return docSubmissions;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    }
  }, [documentId]);

  return {
    submissions,
    loading,
    error,
    submitDocument,
    getSubmissionStatus,
  };
}

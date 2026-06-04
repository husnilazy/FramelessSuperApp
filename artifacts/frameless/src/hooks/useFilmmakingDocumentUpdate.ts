import { useState, useCallback, useEffect } from "react";

export function useFilmmakingDocumentUpdate(documentId: string) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const updateDocument = useCallback(
    async (
      title?: string,
      content?: any,
      isDraft?: boolean,
      changeSummary?: string
    ) => {
      setSaving(true);
      setError(null);
      try {
        const token = localStorage.getItem("crew_token") || localStorage.getItem("token");
        const response = await fetch(`/api/filmmaking-documents/${documentId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title,
            content,
            isDraft,
            changeSummary,
          }),
        });

        if (!response.ok) throw new Error("Failed to save document");
        setLastSaved(new Date());
        return await response.json();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [documentId]
  );

  // Auto-save hook
  const useAutoSave = (
    content: any,
    title: string,
    interval: number = 5000
  ) => {
    const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

    const autoSave = useCallback(async () => {
      if (!autoSaveEnabled) return;
      try {
        await updateDocument(title, content, true, "Auto-saved");
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }, [content, title, updateDocument, autoSaveEnabled]);

    // Set up auto-save interval
    useEffect(() => {
      const timer = setInterval(autoSave, interval);
      return () => clearInterval(timer);
    }, [autoSave, interval]);

    return { autoSaveEnabled, setAutoSaveEnabled };
  };

  return {
    saving,
    error,
    lastSaved,
    updateDocument,
    useAutoSave,
  };
}

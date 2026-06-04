import { useState, useCallback } from "react";

export function useFilmmakingPdfExport(documentId: string) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportToPdf = useCallback(async () => {
    try {
      setExporting(true);
      setError(null);

      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/filmmaking-documents/${documentId}/export-pdf`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to export PDF");
      }

      // Get HTML content
      const htmlContent = await response.text();

      // Open in new window for printing/saving
      const printWindow = window.open("", "", "height=600,width=800");
      if (!printWindow) {
        throw new Error("Could not open print window");
      }

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Automatically open print dialog
      printWindow.print();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [documentId]);

  return { exportToPdf, exporting, error };
}

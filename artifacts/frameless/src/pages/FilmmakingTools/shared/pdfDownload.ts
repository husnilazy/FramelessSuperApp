// PATH SARAN: apps/web/src/components/filmmaking/shared/pdfDownload.ts

function slugify(text: string): string {
  return (
    (text || "document")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "document"
  );
}

/**
 * Download PDF ASLI dari server (bukan window.print()).
 * orientation opsional: kalau tidak diisi, server otomatis pilih landscape
 * untuk Shotlist (tabel lebar) dan portrait untuk dokumen lainnya.
 * Melempar Error kalau gagal, supaya bisa ditangkap & ditampilkan lewat toast oleh caller.
 */
export async function downloadDocumentPdf(
  documentId: string,
  title: string,
  token: string | null,
  orientation?: "landscape" | "portrait"
): Promise<void> {
  const query = orientation ? `?orientation=${orientation}` : "";
  const res = await fetch(`/api/filmmaking-documents/${documentId}/export-pdf${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = `Gagal generate PDF (status ${res.status})`;
    try {
      const data = await res.json();
      if (data?.error && data?.detail) {
        message = `${data.error}\n\nDetail: ${data.detail}`;
      } else if (data?.detail) {
        message = data.detail;
      } else if (data?.error) {
        message = data.error;
      }
    } catch {
      // response bukan JSON, biarkan pesan default
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(title)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
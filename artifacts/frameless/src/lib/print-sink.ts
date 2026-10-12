/**
 * Pengganti `window.open() + document.write()` untuk cetak laporan.
 *
 * Pop-up sering diblokir browser sehingga tombol cetak "diam saja". Objek ini meniru API
 * jendela yang dipakai kode lama (`document.write`, `document.close`, `print`) tetapi
 * mengirim HTML ke dialog preview global (<PrintHost /> di layout) — tanpa pop-up.
 */
export const PRINT_PREVIEW_EVENT = "app:print-preview";

export interface PrintPreviewDetail {
  html: string;
  title: string;
}

export function openPrintPreview(html: string, title?: string) {
  const t = title || /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || "Cetak";
  window.dispatchEvent(new CustomEvent<PrintPreviewDetail>(PRINT_PREVIEW_EVENT, { detail: { html, title: t } }));
}

export function createPrintSink() {
  let html = "";
  return {
    document: {
      write: (chunk: string) => { html += chunk; },
      close: () => openPrintPreview(html),
    },
    print: () => {},
    focus: () => {},
  };
}

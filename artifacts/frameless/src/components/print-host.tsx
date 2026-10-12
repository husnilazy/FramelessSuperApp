import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { PRINT_PREVIEW_EVENT, type PrintPreviewDetail } from "@/lib/print-sink";

/** Dialog preview cetak global — dipasang sekali di layout admin. */
export function PrintHost() {
  const [doc, setDoc] = useState<PrintPreviewDetail | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const h = (e: Event) => setDoc((e as CustomEvent<PrintPreviewDetail>).detail);
    window.addEventListener(PRINT_PREVIEW_EVENT, h);
    return () => window.removeEventListener(PRINT_PREVIEW_EVENT, h);
  }, []);

  const print = () => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => { if (!o) setDoc(null); }}>
      <DialogContent className="max-w-5xl w-[calc(100vw-1.5rem)] max-h-[95vh] p-0 gap-0 bg-card border-foreground/10 overflow-hidden flex flex-col">
        <DialogHeader className="px-4 sm:px-5 pt-4 pb-3 border-b border-foreground/10 space-y-1">
          <div className="flex items-center justify-between gap-3 pr-8">
            <DialogTitle className="font-heading tracking-wider text-foreground text-lg truncate">{doc?.title}</DialogTitle>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white shrink-0" onClick={print}>
              <Printer className="w-4 h-4 mr-1.5" /> Cetak / Simpan PDF
            </Button>
          </div>
          <DialogDescription className="text-xs">Pilih “Simpan sebagai PDF” di jendela cetak untuk mengunduh PDF.</DialogDescription>
        </DialogHeader>
        <div className="bg-white flex-1 min-h-[60vh]">
          {doc && <iframe ref={iframeRef} title={doc.title} srcDoc={doc.html} className="w-full h-[72vh] border-0 bg-white" />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

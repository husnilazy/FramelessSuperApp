import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Send, Share2, FileDown, Copy } from "lucide-react";

interface DocumentActionsProps {
  documentId: string;
  isDraft: boolean;
  onSubmit: (message?: string) => void;
  onExportPDF: () => void;
  canEdit: boolean;
}

export function DocumentActions({
  documentId,
  isDraft,
  onSubmit,
  onExportPDF,
  canEdit,
}: DocumentActionsProps) {
  const [submitDialogOpen, setSubmitDialogOpen] = React.useState(false);
  const [submitMessage, setSubmitMessage] = React.useState("");

  const handleSubmit = () => {
    onSubmit(submitMessage);
    setSubmitMessage("");
    setSubmitDialogOpen(false);
  };

  return (
    <div className="flex gap-2">
      {canEdit && isDraft && (
        <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Send className="w-4 h-4" />
              Submit to Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Document to Admin</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Add a message for the admin (optional)"
                value={submitMessage}
                onChange={(e) => setSubmitMessage(e.target.value)}
                className="min-h-20"
              />
              <Button onClick={handleSubmit} className="w-full">
                Submit
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Button
        variant="outline"
        className="gap-2"
        onClick={onExportPDF}
      >
        <FileDown className="w-4 h-4" />
        Export PDF
      </Button>

      <Button
        variant="outline"
        className="gap-2"
        onClick={() => {
          navigator.clipboard.writeText(
            `${window.location.origin}/filmmaking-tools/documents/${documentId}`
          );
        }}
      >
        <Share2 className="w-4 h-4" />
        Share Link
      </Button>
    </div>
  );
}

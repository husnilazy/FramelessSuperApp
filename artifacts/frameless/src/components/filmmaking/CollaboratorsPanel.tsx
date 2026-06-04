import React from "react";
import { Button } from "@/components/ui/button";
import { Users, Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Collaborator {
  id: string;
  memberName: string;
  role: "owner" | "editor" | "viewer";
}

interface CollaboratorsPanelProps {
  collaborators: Collaborator[];
  onAddCollaborator: (crewMemberId: string, role: "editor" | "viewer") => void;
  onRemoveCollaborator: (collaboratorId: string) => void;
  canModify: boolean;
}

export function CollaboratorsPanel({
  collaborators,
  onAddCollaborator,
  onRemoveCollaborator,
  canModify,
}: CollaboratorsPanelProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedCrew, setSelectedCrew] = React.useState("");
  const [selectedRole, setSelectedRole] = React.useState<"editor" | "viewer">(
    "editor"
  );

  const handleAdd = () => {
    if (selectedCrew) {
      onAddCollaborator(selectedCrew, selectedRole);
      setSelectedCrew("");
      setSelectedRole("editor");
      setDialogOpen(false);
    }
  };

  return (
    <div className="border-l p-4 w-64 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" />
          <h3 className="font-semibold">Collaborators</h3>
        </div>
        {canModify && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost">
                <Plus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Collaborator</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Crew member ID or email"
                  value={selectedCrew}
                  onChange={(e) => setSelectedCrew(e.target.value)}
                />
                <Select
                  value={selectedRole}
                  onValueChange={(val: any) => setSelectedRole(val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAdd} className="w-full">
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2 flex-1">
        {collaborators.map((col) => (
          <div
            key={col.id}
            className="flex items-center justify-between p-2 hover:bg-gray-100 rounded"
          >
            <div>
              <p className="text-sm font-medium">{col.memberName}</p>
              <p className="text-xs text-gray-500 capitalize">{col.role}</p>
            </div>
            {canModify && col.role !== "owner" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveCollaborator(col.id)}
                className="text-red-600"
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

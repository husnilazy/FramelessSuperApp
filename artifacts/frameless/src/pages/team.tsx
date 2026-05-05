import { useState } from "react";
import { useListTeamMembers, useCreateTeamMember, useDeleteTeamMember, type CreateTeamMemberBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Mail, Briefcase, Trash2 } from "lucide-react";

const DEPT_COLORS: Record<string, string> = {
  Production: "bg-primary/20 text-primary border-primary/30",
  "Post-Production": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  STUDIODO: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ZENSVISUAL: "bg-green-500/20 text-green-400 border-green-500/30",
  Management: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export default function TeamPage() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useListTeamMembers();

  const createMutation = useCreateTeamMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        setOpen(false);
        toast({ title: "Team member added" });
      },
    },
  });

  const deleteMutation = useDeleteTeamMember({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/team"] });
        toast({ title: "Member removed" });
      },
    },
  });

  const departments = [...new Set(members?.map((m) => m.department).filter(Boolean))];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Crew</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Team Management</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> Add Member
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-2xl">Add Crew Member</DialogTitle>
            </DialogHeader>
            <NewMemberForm
              onSubmit={(data) => createMutation.mutate({ data })}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-panel border-white/5">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-heading text-primary">{members?.length || 0}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Total Crew</p>
          </CardContent>
        </Card>
        {departments.slice(0, 3).map((dept) => (
          <Card key={dept} className="glass-panel border-white/5">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-heading text-white">
                {members?.filter((m) => m.department === dept).length || 0}
              </p>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1 truncate">{dept}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members?.map((member) => (
            <Card key={member.id} className="glass-panel border-white/5 group hover:border-primary/20 transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <span className="text-primary font-heading text-xl">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteMutation.mutate({ id: member.id })}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">{member.name}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <Briefcase className="w-3 h-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{member.role}</p>
                </div>
                {member.email && (
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="w-3 h-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {member.department && (
                    <Badge className={`text-xs border uppercase tracking-wider ${DEPT_COLORS[member.department] || "bg-muted/20 text-muted-foreground border-muted/30"}`}>
                      {member.department}
                    </Badge>
                  )}
                  <Badge className={`text-xs border uppercase tracking-wider ${member.status === "active" ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-muted/20 text-muted-foreground border-muted/30"}`}>
                    {member.status || "active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {members?.length === 0 && (
            <div className="col-span-3 glass-panel rounded-xl p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No team members yet</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewMemberForm({ onSubmit, isPending }: { onSubmit: (data: CreateTeamMemberBody) => void; isPending: boolean }) {
  const [form, setForm] = useState<CreateTeamMemberBody>({
    name: "", role: "", email: "", department: "Production", status: "active",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Full Name</label>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="Name" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Role</label>
        <Input value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="e.g. Videographer" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Email</label>
        <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="bg-white/5 border-white/10 text-white" placeholder="email@frameless.com" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Department</label>
        <Select value={form.department || "Production"} onValueChange={(v) => setForm({ ...form, department: v })}>
          <SelectTrigger className="bg-white/5 border-white/10 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-white/10">
            <SelectItem value="Production">Production</SelectItem>
            <SelectItem value="Post-Production">Post-Production</SelectItem>
            <SelectItem value="STUDIODO">STUDIODO</SelectItem>
            <SelectItem value="ZENSVISUAL">ZENSVISUAL</SelectItem>
            <SelectItem value="Management">Management</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Adding..." : "Add Member"}
      </Button>
    </form>
  );
}

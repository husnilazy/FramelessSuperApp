import { useState } from "react";
import { useLink } from "wouter";
import { useListProjects, useCreateProject, useDeleteProject, type CreateProjectBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Film, Clock, Trash2, ArrowRight, Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  on_hold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-primary/20 text-primary border-primary/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-muted/20 text-muted-foreground border-muted/30",
};

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useListProjects({ search: search || undefined });

  const createMutation = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        setOpen(false);
        toast({ title: "Project created" });
      },
    },
  });

  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        toast({ title: "Project deleted" });
      },
    },
  });

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-heading tracking-wider text-white">Projects</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold mt-1">Production Pipeline</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
              <Plus className="w-4 h-4 mr-2" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading tracking-wider text-2xl">New Project</DialogTitle>
            </DialogHeader>
            <NewProjectForm
              onSubmit={(data) => createMutation.mutate({ data })}
              isPending={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {projects?.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={() => deleteMutation.mutate({ id: project.id })}
            />
          ))}
          {projects?.length === 0 && (
            <div className="glass-panel rounded-xl p-12 text-center">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No projects found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project, onDelete }: { project: any; onDelete: () => void }) {
  const [, navigate] = [null, (href: string) => (window.location.href = href)];
  const href = `/projects/${project.id}`;

  return (
    <Card className="glass-panel border-white/5 group hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h3 className="text-lg font-semibold text-white truncate">{project.title}</h3>
              <Badge className={`text-xs border ${STATUS_COLORS[project.status] || "bg-muted text-muted-foreground"} uppercase tracking-wider`}>
                {project.status.replace("_", " ")}
              </Badge>
              {project.priority && (
                <Badge className={`text-xs border ${PRIORITY_COLORS[project.priority] || ""} uppercase tracking-wider`}>
                  {project.priority}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4 flex-wrap">
              <span>{project.client}</span>
              {project.projectType && <span className="text-primary">{project.projectType}</span>}
              {project.deadline && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDate(project.deadline)}
                </span>
              )}
              {project.budget && (
                <span className="font-medium text-white">{formatCurrency(Number(project.budget))}</span>
              )}
            </div>
            {project.progress !== null && project.progress !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-1.5 bg-white/10" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <a href={href}>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NewProjectForm({ onSubmit, isPending }: { onSubmit: (data: CreateProjectBody) => void; isPending: boolean }) {
  const [form, setForm] = useState<CreateProjectBody>({
    title: "",
    client: "",
    status: "active",
    priority: "medium",
    projectType: "",
    budget: "",
    deadline: "",
    description: "",
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Project Title</label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="e.g. Wedding Documentation" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Client</label>
        <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="Client name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Type</label>
          <Input value={form.projectType} onChange={(e) => setForm({ ...form, projectType: e.target.value })}
            className="bg-white/5 border-white/10 text-white" placeholder="Wedding, Corporate..." />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Priority</label>
          <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Budget (IDR)</label>
          <Input type="number" value={form.budget as string} onChange={(e) => setForm({ ...form, budget: e.target.value })}
            className="bg-white/5 border-white/10 text-white" placeholder="0" />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Deadline</label>
          <Input type="date" value={form.deadline as string} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Creating..." : "Create Project"}
      </Button>
    </form>
  );
}

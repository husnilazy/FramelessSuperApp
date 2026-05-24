import { useState } from "react";
import { useRoute } from "wouter";
import { useGetProject, useListProjectTasks, useCreateProjectTask, useDeleteTask, useUpdateProject, useListTeamMembers, useUpdateTask, type CreateTaskBody } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, CheckSquare, Clock, Film, TrendingUp } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  on_hold: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: "bg-muted/20 text-muted-foreground border-muted/30",
  IN_PROGRESS: "bg-primary/20 text-primary border-primary/30",
  DONE: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function ProjectDetailPage() {
  const [, params] = useRoute("/projects/:id");
  const id = params?.id || "";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [taskOpen, setTaskOpen] = useState(false);

  const { data: project, isLoading } = useGetProject(id);
  const { data: tasks } = useListProjectTasks(id);
  const { data: members } = useListTeamMembers();
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const updateTaskMutation = useUpdateTask({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] }); setEditingTask(null); toast({ title: "Task updated" }); } } });

  const createTask = useCreateProjectTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
        setTaskOpen(false);
        toast({ title: "Task added" });
      },
    },
  });


  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
      },
    },
  });

  const updateProject = useUpdateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}`] });
        toast({ title: "Progress updated" });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-muted-foreground text-center py-20">Project not found</div>;
  }

  const doneTasks = tasks?.filter((t) => t.status === "DONE").length || 0;
  const totalTasks = tasks?.length || 0;

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center gap-4">
        <a href="/projects">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </a>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-4xl font-heading tracking-wider text-white">{project.title}</h1>
            <Badge className={`text-xs border uppercase tracking-wider ${STATUS_COLORS[project.status] || ""}`}>
              {project.status?.replace("_", " ")}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-muted-foreground text-sm">{project.client} · {project.projectType}</p>
            <div className="flex items-center gap-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Assigned</label>
              <select
                value={project.assignedMemberId || ""}
                onChange={(e) => updateProject.mutate({ id, data: { assignedMemberId: e.target.value || null } })}
                className="bg-white/5 border-white/10 text-white text-sm rounded px-2 py-1"
              >
                <option value="">Unassigned</option>
                {members?.map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Film} label="Type" value={project.projectType || "-"} />
        <StatCard icon={TrendingUp} label="Budget" value={project.budget ? formatCurrency(Number(project.budget)) : "-"} />
        <StatCard icon={Clock} label="Deadline" value={formatDate(project.deadline)} />
        <StatCard icon={CheckSquare} label="Tasks Done" value={`${doneTasks}/${totalTasks}`} />
      </div>

      {/* Progress */}
      <Card className="glass-panel border-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Progress</CardTitle>
            <span className="text-2xl font-heading text-primary">{project.progress ?? 0}%</span>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={project.progress ?? 0} className="h-3 bg-white/10 mb-4" />
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="Update progress %"
              className="bg-white/5 border-white/10 text-white w-40"
              id="progress-input"
            />
            <Button
              onClick={() => {
                const val = Number((document.getElementById("progress-input") as HTMLInputElement).value);
                if (val >= 0 && val <= 100) {
                  updateProject.mutate({ id, data: { progress: val } });
                }
              }}
              className="bg-primary/20 text-primary hover:bg-primary hover:text-white border border-primary/30"
            >
              Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-heading tracking-wider text-white">Task List</h2>
          <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary/20 text-primary hover:bg-primary hover:text-white border border-primary/30 font-heading tracking-wider">
                <Plus className="w-4 h-4 mr-1" /> Add Task
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="font-heading tracking-wider">Add Task</DialogTitle>
              </DialogHeader>
                <NewTaskForm
                  members={members}
                  onSubmit={(data) => createTask.mutate({ id, data })}
                  isPending={createTask.isPending}
                />
            </DialogContent>
          </Dialog>
        </div>
        <div className="space-y-3">
          {tasks?.map((task) => (
            <div key={task.id} className="glass-panel border-white/5 rounded-lg p-4 flex items-center justify-between gap-4 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-sm font-medium text-white">{task.title}</p>
                  <Badge className={`text-xs border uppercase tracking-wider ${TASK_STATUS_COLORS[task.status] || ""}`}>
                    {task.status?.replace("_", " ")}
                  </Badge>
                  {task.priority && (
                    <Badge className="text-xs border bg-muted/20 text-muted-foreground border-muted/30 uppercase tracking-wider">
                      {task.priority}
                    </Badge>
                  )}
                </div>
                {task.dueDate && (
                  <p className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</p>
                )}
                {task.memberId && (
                  <p className="text-xs text-muted-foreground">Assigned to: {members?.find(m => m.id === task.memberId)?.name || task.memberId}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => deleteTask.mutate({ id: task.id })}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary shrink-0"
                onClick={() => setEditingTask(task)}
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {(!tasks || tasks.length === 0) && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <p className="text-muted-foreground text-sm uppercase tracking-wider">No tasks yet</p>
            </div>
          )}
        </div>
      </div>

      {project.description && (
        <Card className="glass-panel border-white/10">
          <CardHeader>
            <CardTitle className="uppercase tracking-widest text-sm text-muted-foreground font-semibold">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/80 leading-relaxed">{project.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Edit Task</h3>
              <button onClick={() => setEditingTask(null)} className="text-muted-foreground hover:text-white">Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Title</label>
                <Input value={editingTask.title} onChange={(e) => setEditingTask((t:any)=>({...t,title:e.target.value}))} className="bg-white/5 border-white/10 text-white" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={editingTask.status} onValueChange={(v) => setEditingTask((t:any)=>({...t,status:v}))}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-white/10">
                    <SelectItem value="TODO">To Do</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="DONE">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Assign To</label>
                <select value={editingTask.memberId || ""} onChange={(e)=>setEditingTask((t:any)=>({...t,memberId:e.target.value||undefined}))} className="bg-white/5 border-white/10 text-white w-full p-2 rounded">
                  <option value="">Unassigned</option>
                  {members?.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                </select>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                <Button onClick={() => updateTaskMutation.mutate({ id: editingTask.id, data: { title: editingTask.title, status: editingTask.status, memberId: editingTask.memberId } })} className="bg-primary">Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="glass-panel border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        </div>
        <p className="text-sm font-semibold text-white">{value}</p>
      </CardContent>
    </Card>
  );
}

function NewTaskForm({ onSubmit, isPending, members }: { onSubmit: (data: CreateTaskBody) => void; isPending: boolean; members?: any[] }) {
  const [form, setForm] = useState<CreateTaskBody>({ title: "", status: "TODO", priority: "medium", memberId: undefined as any });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Task</label>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
          required className="bg-white/5 border-white/10 text-white" placeholder="Task description" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Status</label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-white/10">
              <SelectItem value="TODO">To Do</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="DONE">Done</SelectItem>
            </SelectContent>
          </Select>
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
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Due Date</label>
        <Input type="date" value={form.dueDate as string || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          className="bg-white/5 border-white/10 text-white" />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Assign To</label>
        <select value={form.memberId || ""} onChange={(e) => setForm({ ...form, memberId: e.target.value || undefined })} className="bg-white/5 border-white/10 text-white">
          <option value="">Unassigned</option>
          {members?.map(m => (
            <option key={m.id} value={m.id}>{m.name} — {m.role}</option>
          ))}
        </select>
      </div>
      <Button type="submit" disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-heading tracking-wider">
        {isPending ? "Adding..." : "Add Task"}
      </Button>
    </form>
  );
}

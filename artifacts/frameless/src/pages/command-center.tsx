import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Users, Calendar, Layout, TrendingUp, CheckCircle2, 
  Clock, AlertCircle, Plus, Send, MoreHorizontal, Video, Image as ImageIcon,
  MessageSquare, Star
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth, getToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export default function CommandCenterPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Tab Definitions
  const tabs = [
    { id: "overview", label: "Crew Overview", icon: Users },
    { id: "heatmap", label: "Workload Heatmap", icon: Calendar },
    { id: "pipeline", label: "Project Pipeline", icon: Layout },
    { id: "performance", label: "Performance", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Activity className="w-8 h-8 text-primary" />
            Command Center
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Real-time operations, crew workload, and project pipeline monitoring.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <BroadcastButton />
          <QuickAssignButton />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-border/40">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-bold transition-all relative ${
              activeTab === tab.id ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTab" 
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "overview" && <CrewOverviewTab />}
            {activeTab === "heatmap" && <WorkloadHeatmapTab />}
            {activeTab === "pipeline" && <ProjectPipelineTab />}
            {activeTab === "performance" && <PerformanceTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Crew Overview Tab ──────────────────────────────────────────────────────────

function CrewOverviewTab() {
  
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "crew-overview"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/admin/crew-overview", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) return res.json();
      throw new Error("Failed to fetch crew overview");
    },
    refetchInterval: 30000,
  });

  // Supplementary running timers (ensures live "what crew is doing")
  const { data: runningTimersRaw } = useQuery({
    queryKey: ["admin", "running-timers"],
    queryFn: async () => {
      try {
        const token = getToken();
        const res = await fetch("/api/admin/time-entries?limit=100", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return [];
        const all = await res.json();
        return (all || []).filter((e: any) => e.is_running || e.isRunning);
      } catch { return []; }
    },
    refetchInterval: 15000,
  });

  // Live ticking elapsed timers for running work (realtime feel even between 30s refetches) - hooks must be before early returns
  const [liveTick, setLiveTick] = useState(0);
  useEffect(() => {
    const hasAnyRunning = (data?.crew || []).some((m: any) => !!m.runningTimer) || (runningTimersRaw || []).length > 0;
    if (!hasAnyRunning) return;
    const id = setInterval(() => setLiveTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [data?.crew?.length, (runningTimersRaw || []).length]); // re-eval when crew data shape changes

  const formatLiveElapsed = (startTime: string) => {
    if (!startTime) return "00:00";
    const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}` : `${m}:${s.toString().padStart(2,"0")}`;
  };

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!data?.crew) return null;

  // Merge running timers from supplementary query so "what is crew working on now" is always visible (RPC or API)
  const runningTimers = runningTimersRaw || [];
  const crew = (data.crew || []).map((m: any) => {
    if (m.runningTimer && m.runningTimer.startTime) return m; // already enriched
    const rt = runningTimers.find((r: any) => (r.memberId || r.member_id) === m.id);
    if (!rt) return m;
    return {
      ...m,
      runningTimer: {
        taskId: rt.taskId || rt.task_id || null,
        startTime: rt.startTime || rt.start_time,
        description: rt.description || "Working...",
        taskTitle: null, // title enrichment happens server-side in reliable path
      },
    };
  });

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Crew" value={data.summary.totalCrew} subtitle="Active members" icon={Users} />
        <StatCard title="Available" value={data.summary.available} subtitle="Ready for tasks" icon={CheckCircle2} color="text-green-500" />
        <StatCard title="On Shoot" value={data.summary.onShoot} subtitle="Currently on set" icon={Video} color="text-orange-500" />
        <StatCard title="Busy / Editing" value={data.summary.busy} subtitle="In post-production" icon={Layout} color="text-blue-500" />
      </div>

      {/* Crew Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {crew.map((member: any) => (
          <div key={member.id} className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-primary/30 transition-all group shadow-sm hover:shadow-md">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-black text-primary">{member.name.charAt(0)}</span>
                    )}
                  </div>
                  {/* Status Indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background ${
                    member.status === "available" ? "bg-green-500" :
                    member.status === "on_shoot" ? "bg-orange-500" :
                    member.status === "editing" ? "bg-blue-500" :
                    member.status === "busy" ? "bg-red-500" : "bg-gray-400"
                  }`} />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg leading-tight">{member.name}</h3>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{member.role}</p>
                </div>
              </div>
              <div className="bg-primary/5 text-primary text-xs px-2.5 py-1 rounded-full font-bold border border-primary/10">
                {member.stats.completionRate}%
              </div>
            </div>

            {/* Live Status Details - realtime what the crew is working on + timer */}
            {member.runningTimer && (
              <div className="mb-4 bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Working On (LIVE)</p>
                    <span className="font-mono text-xs text-primary/90 font-bold tabular-nums">{formatLiveElapsed(member.runningTimer.startTime)}</span>
                  </div>
                  <p className="text-sm text-foreground font-semibold truncate">{member.runningTimer.taskTitle || member.runningTimer.description || "Task in progress..."}</p>
                  <p className="text-[10px] text-muted-foreground">Started {new Date(member.runningTimer.startTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                </div>
              </div>
            )}

            {member.status === "on_shoot" && (
              <div className="mb-4 bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Video className="w-4 h-4 text-orange-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Currently On Shoot</p>
                  <p className="text-sm text-foreground font-medium truncate">{member.todayEvents[0]?.title || "Production set"}</p>
                </div>
              </div>
            )}

            {/* Task List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Tasks ({member.stats.activeTasks})</span>
                {member.stats.urgentTasks > 0 && (
                  <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {member.stats.urgentTasks} Urgent
                  </span>
                )}
              </div>
              
              <div className="space-y-2">
                {member.activeTasks.length > 0 ? (
                  member.activeTasks.slice(0, 3).map((task: any) => (
                    <div key={task.id} className="bg-muted/30 p-2.5 rounded-lg border border-border/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500'}`} />
                          <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 whitespace-nowrap bg-background px-2 py-0.5 rounded-md border border-border">
                          {task.status}
                        </span>
                      </div>
                      {task.crewNotes && task.crewNotes.length > 0 && (
                        <div className="mt-2 pl-4 text-[11px] text-amber-400 border-l border-amber-500/40">
                          {task.crewNotes.slice(0, 2).map((n: any, i: number) => (
                            <div key={i} className="truncate">📝 {n.text}</div>
                          ))}
                          {task.crewNotes.length > 2 && <div className="text-amber-500/70">+{task.crewNotes.length - 2} more notes</div>}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border/60 rounded-xl">
                    No active tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Workload Heatmap Tab ────────────────────────────────────────────────────────

function WorkloadHeatmapTab() {
  
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "workload-heatmap"],
    queryFn: async () => {
      // Use direct Supabase RPC
      const { data, error } = await supabase.rpc('get_workload_heatmap');
      if (error) {
        console.error('RPC workload-heatmap failed, falling back to API', error);
        const token = getToken();
        const res = await fetch("/api/admin/workload-heatmap", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      }
      return data;
    },
  });

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-primary" /></div>;

  const getIntensityColor = (intensity: number) => {
    switch(intensity) {
      case 0: return "bg-muted/30 border-transparent text-muted-foreground";
      case 1: return "bg-green-500/10 border-green-500/20 text-green-500";
      case 2: return "bg-blue-500/10 border-blue-500/20 text-blue-500";
      case 3: return "bg-orange-500/10 border-orange-500/20 text-orange-500";
      case 4: return "bg-red-500/10 border-red-500/20 text-red-500";
      default: return "bg-muted/30 border-transparent text-muted-foreground";
    }
  };

  return (
    <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className="p-4 border-b border-border/50 bg-muted/20 font-bold text-xs uppercase tracking-wider text-muted-foreground w-64">Crew Member</th>
              {data.days.map((day: string, i: number) => (
                <th key={day} className="p-4 border-b border-border/50 bg-muted/20 font-bold text-xs text-center min-w-[100px]">
                  <div className="text-muted-foreground uppercase tracking-widest text-[10px]">{data.heatmap[0].days[i].dayName}</div>
                  <div className="text-foreground mt-1">{day.slice(5).replace('-', '/')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.heatmap.map((member: any) => (
              <tr key={member.memberId} className="hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {member.avatarUrl ? <img src={member.avatarUrl} className="w-full h-full rounded-full object-cover" /> : <span className="text-xs font-bold text-primary">{member.name.charAt(0)}</span>}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-foreground">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{member.role}</p>
                    </div>
                  </div>
                </td>
                {member.days.map((day: any) => (
                  <td key={day.date} className="p-4 text-center">
                    <div className={`inline-flex flex-col items-center justify-center w-full max-w-[80px] py-2 rounded-xl border transition-all hover:scale-105 cursor-default ${getIntensityColor(day.intensity)}`}>
                      <span className="text-lg font-black leading-none">{day.total}</span>
                      <span className="text-[9px] uppercase tracking-widest mt-1 opacity-80 font-bold">Items</span>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-center gap-6 text-xs font-medium text-muted-foreground">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-muted/30" /> Free</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-green-500/20" /> Light</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500/20" /> Normal</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500/20" /> Heavy</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500/20" /> Overloaded</div>
      </div>
    </div>
  );
}

// ─── Project Pipeline Tab ────────────────────────────────────────────────────────

function ProjectPipelineTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [draggedOverPhase, setDraggedOverPhase] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Record<string, boolean>>({});
  const [, setLocation] = useLocation();
  
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "project-pipeline"],
    queryFn: async () => {
      // Use direct queries (RPC may fail with 400 if not deployed/updated in Supabase)
      return await fetchPipelineFallback();
    },
    staleTime: 10000,
    refetchInterval: false,
  });

  // Fallback in case the SQL function is not created yet
  async function fetchPipelineFallback() {
    const { data: projects } = await supabase.from('projects').select('*').order('updated_at', { ascending: false });
    const { data: tasks } = await supabase.from('project_tasks').select('*');
    const { data: members } = await supabase.from('team_members').select('*');

    // ... (same grouping logic as before)
    const pipeline: Record<string, any[]> = { planning: [], active: [], shooting: [], editing: [], review: [], completed: [] };

    for (const project of projects || []) {
      const status = (project.status || 'active').toLowerCase().replace(/\s+/g, '_');
      const projectTasks = (tasks || []).filter((t: any) => t.project_id === project.id);
      const doneTasks = projectTasks.filter((t: any) => ['done', 'completed'].includes((t.status || '').toLowerCase()));
      const owner = (members || []).find((m: any) => m.id === project.assigned_member_id);

      const entry = {
        id: project.id, title: project.title, client: project.client, status: project.status,
        progress: project.progress || 0, deadline: project.deadline, priority: project.priority,
        projectType: project.project_type, updatedAt: project.updated_at,
        owner: owner ? { id: owner.id, name: owner.name, avatarUrl: owner.avatar_url } : null,
        taskStats: { total: projectTasks.length, done: doneTasks.length, active: projectTasks.length - doneTasks.length },
      };

      if (['planning', 'proposed', 'draft'].includes(status)) pipeline.planning.push(entry);
      else if (['shooting', 'on_shoot'].includes(status)) pipeline.shooting.push(entry);
      else if (['editing', 'post_production'].includes(status)) pipeline.editing.push(entry);
      else if (['review', 'client_review', 'final'].includes(status)) pipeline.review.push(entry);
      else if (['completed', 'done', 'delivered'].includes(status)) pipeline.completed.push(entry);
      else pipeline.active.push(entry);
    }

    return { pipeline, total: projects?.length || 0 };
  }

  // Real-time updates for Project Pipeline (replaces polling)
  useEffect(() => {
    const channel = supabase
      .channel('project-pipeline-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          // Refetch when any project changes
          queryClient.invalidateQueries({ queryKey: ["admin", "project-pipeline"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const phases = [
    { id: "planning", label: "Planning", color: "bg-purple-500", accent: "border-purple-500" },
    { id: "active", label: "Active", color: "bg-blue-500", accent: "border-blue-500" },
    { id: "shooting", label: "Shooting", color: "bg-orange-500", accent: "border-orange-500" },
    { id: "editing", label: "Post Production", color: "bg-yellow-500", accent: "border-yellow-500" },
    { id: "review", label: "Client Review", color: "bg-indigo-500", accent: "border-indigo-500" },
  ];

  const phaseToStatus: Record<string, string> = {
    planning: "planning",
    active: "active",
    shooting: "shooting",
    editing: "post_production",
    review: "client_review",
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    e.dataTransfer.setData("text/plain", projectId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDraggedOverPhase(phaseId);
  };

  const handleDragLeave = () => {
    setDraggedOverPhase(null);
  };

  const handleDrop = async (e: React.DragEvent, targetPhaseId: string) => {
    e.preventDefault();
    setDraggedOverPhase(null);
    const projectId = e.dataTransfer.getData("text/plain");
    if (!projectId) return;

    const newStatus = phaseToStatus[targetPhaseId];
    if (!newStatus) return;

    await updateProjectStatus(projectId, newStatus);
  };

  const handleQuickMove = async (projectId: string, targetPhaseId: string) => {
    const newStatus = phaseToStatus[targetPhaseId];
    if (!newStatus) return;

    await updateProjectStatus(projectId, newStatus);
  };

  const toggleCollapse = (phaseId: string) => {
    setCollapsedPhases(prev => ({
      ...prev,
      [phaseId]: !prev[phaseId]
    }));
  };

  // Filter projects based on search
  const getFilteredProjects = (phaseProjects: any[]) => {
    if (!searchTerm.trim()) return phaseProjects;
    const term = searchTerm.toLowerCase();
    return phaseProjects.filter((p: any) =>
      p.title?.toLowerCase().includes(term) ||
      p.client?.toLowerCase().includes(term)
    );
  };

  // Calculate days until deadline
  const getDueInfo = (deadline: string | null) => {
    if (!deadline) return null;
    const due = new Date(deadline);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: "text-red-500", urgent: true };
    if (diffDays === 0) return { label: "Due today", color: "text-orange-500", urgent: true };
    if (diffDays <= 3) return { label: `${diffDays}d left`, color: "text-yellow-500", urgent: true };
    return { label: `${diffDays}d left`, color: "text-muted-foreground", urgent: false };
  };

  const getRelativeTime = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
  };

  const updateProjectStatus = async (projectId: string, newStatus: string) => {
    const { error } = await supabase
      .from('projects')
      .update({ status: newStatus })
      .eq('id', projectId);

    if (error) {
      console.error(error);
      toast({ title: "Gagal update status", description: error.message, variant: "destructive" });
    } else {
      queryClient.invalidateQueries({ queryKey: ["admin", "project-pipeline"] });
      toast({ title: "Status project berhasil diupdate" });
    }
  };

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-primary" /></div>;

  // Add search input at the top of the pipeline view
  return (
    <div className="space-y-4">
      {/* Pipeline Header with Search */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-black">Project Pipeline</h2>
          <p className="text-sm text-muted-foreground">Drag projects between stages or click to view details</p>
        </div>
        <div className="w-72">
          <input
            type="text"
            placeholder="Search projects or clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50"
          />
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 h-[calc(100vh-280px)] min-h-[500px]">
        {phases.map(phase => {
          const rawProjects = data.pipeline[phase.id] || [];
          const filteredProjects = getFilteredProjects(rawProjects);
          const isDropTarget = draggedOverPhase === phase.id;
          const isCollapsed = collapsedPhases[phase.id];

          return (
            <div 
              key={phase.id} 
              className={`flex-shrink-0 w-80 flex flex-col rounded-2xl overflow-hidden transition-all duration-200 border-2 ${
                isDropTarget 
                  ? 'bg-primary/5 border-primary scale-[1.01] shadow-xl' 
                  : 'bg-muted/20 border-border/40'
              } ${isCollapsed ? 'h-auto' : ''}`}
              onDragOver={(e) => handleDragOver(e, phase.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, phase.id)}
            >
              {/* Column Header - with phase color tint + collapse button */}
              <div className={`p-4 border-b flex items-center justify-between cursor-pointer ${isDropTarget ? 'bg-primary/10' : 'bg-background/80'}`}
                   onClick={() => toggleCollapse(phase.id)}>
                <div className="flex items-center gap-2">
                  <div className={`w-3.5 h-3.5 rounded-full ${phase.color}`} />
                  <h3 className="font-bold text-sm uppercase tracking-widest text-foreground">{phase.label}</h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleCollapse(phase.id); }}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    {isCollapsed ? '▼' : '▲'}
                  </button>
                </div>
                <span className="bg-muted px-2.5 py-0.5 rounded-full text-xs font-bold text-muted-foreground">
                  {filteredProjects.length}
                </span>
              </div>
              
              {/* Cards Area - hidden when collapsed */}
              {!isCollapsed && (
                <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[200px]">
                  {filteredProjects.length > 0 ? (
                    filteredProjects.map((project: any) => {
                      const dueInfo = getDueInfo(project.deadline);
                      
                      return (
                        <div 
                          key={project.id} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, project.id)}
                          onClick={() => setLocation(`/projects/${project.id}`)}
                          className="group relative bg-background border border-border/60 rounded-xl p-4 shadow-sm hover:border-primary/60 hover:shadow-md transition-all cursor-pointer active:scale-[0.985] overflow-hidden"
                        >
                          {/* Phase accent bar */}
                          <div className={`absolute left-0 top-0 bottom-0 w-[5px] ${phase.color}`} />

                          <div className="flex justify-between items-start mb-2 pl-2">
                            <h4 className="font-bold text-sm text-foreground line-clamp-2 leading-tight group-hover:text-primary transition-colors pr-2">
                              {project.title}
                            </h4>
                            {project.priority === 'high' && (
                              <Star className="w-4 h-4 text-orange-500 fill-orange-500 flex-shrink-0 mt-0.5" />
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground mb-3 pl-2 line-clamp-1">{project.client || "No client"}</p>

                          {/* Due Date / Overdue */}
                          {dueInfo && (
                            <div className={`inline-flex ml-2 items-center text-[11px] font-semibold mb-3 px-2 py-0.5 rounded ${dueInfo.urgent ? 'bg-red-500/10 text-red-500' : 'bg-muted/40'}`}>
                              {dueInfo.label}
                            </div>
                          )}

                          {/* Recently moved indicator */}
                          {project.updatedAt && (
                            <div className="ml-2 text-[10px] text-muted-foreground/70 mb-2">
                              Moved {getRelativeTime(project.updatedAt)}
                            </div>
                          )}

                          <div className="flex items-center justify-between mt-auto pl-2">
                            {/* Owner */}
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                                {project.owner?.avatarUrl ? (
                                  <img src={project.owner.avatarUrl} className="w-full h-full object-cover" alt="" />
                                ) : (
                                  <span className="text-[10px] font-bold text-primary">{project.owner?.name?.charAt(0) || '?'}</span>
                                )}
                              </div>
                              <span className="text-xs font-medium text-muted-foreground truncate max-w-[90px]">
                                {project.owner?.name?.split(' ')[0] || 'Unassigned'}
                              </span>
                            </div>
                            
                            {/* Task Stats */}
                            <div className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded text-[10px] font-bold text-foreground">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {project.taskStats.done}/{project.taskStats.total}
                            </div>
                          </div>
                          
                          {/* Progress bar - enhanced with project progress */}
                          <div className="mt-3 h-1.5 w-full bg-muted overflow-hidden rounded-full mx-2">
                            <div 
                              className={`h-full transition-all ${phase.color}`} 
                              style={{ width: `${project.progress || (project.taskStats.total > 0 ? (project.taskStats.done / project.taskStats.total) * 100 : 0)}%` }}
                            />
                          </div>

                          {/* Quick Move Buttons + Status select - appear on hover */}
                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 items-center">
                            <select
                              value={phaseToStatus[phase.id] || project.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateProjectStatus(project.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] bg-background/90 border border-border/50 rounded px-1 py-0.5 text-foreground"
                            >
                              {phases.map(p => (
                                <option key={p.id} value={phaseToStatus[p.id]}>{p.label}</option>
                              ))}
                            </select>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentIndex = phases.findIndex(p => p.id === phase.id);
                                if (currentIndex > 0) {
                                  const prevPhase = phases[currentIndex - 1];
                                  handleQuickMove(project.id, prevPhase.id);
                                }
                              }}
                              className="px-1.5 py-0.5 text-[10px] bg-background/80 hover:bg-background border border-border/50 rounded text-muted-foreground hover:text-foreground"
                              title="Move to previous stage"
                            >
                              ←
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const currentIndex = phases.findIndex(p => p.id === phase.id);
                                if (currentIndex < phases.length - 1) {
                                  const nextPhase = phases[currentIndex + 1];
                                  handleQuickMove(project.id, nextPhase.id);
                                }
                              }}
                              className="px-1.5 py-0.5 text-[10px] bg-background/80 hover:bg-background border border-border/50 rounded text-muted-foreground hover:text-foreground"
                              title="Move to next stage"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/40 rounded-xl">
                      <p className="text-xs text-muted-foreground font-medium">
                        {searchTerm ? "No matching projects" : "No projects"}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isCollapsed && (
                <div className="p-2 text-center text-xs text-muted-foreground">
                  {filteredProjects.length} projects • collapsed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Performance Tab ─────────────────────────────────────────────────────────────

function PerformanceTab() {
  
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "performance"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/admin/performance", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    }
  });

  if (isLoading || !data) return <div className="h-64 flex items-center justify-center"><Activity className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden shadow-sm p-6">
      <h3 className="text-lg font-black mb-6">Crew Performance Metrics</h3>
      
      <div className="space-y-6">
        {data.performance.map((member: any, index: number) => (
          <div key={member.memberId} className="flex items-center gap-6 p-4 rounded-xl border border-border/40 bg-muted/10">
            <div className="flex-shrink-0 w-8 text-center font-black text-2xl text-muted-foreground/30">
              #{index + 1}
            </div>
            
            <div className="flex items-center gap-4 w-64 flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 overflow-hidden">
                {member.avatarUrl ? <img src={member.avatarUrl} className="w-full h-full object-cover" /> : <span className="text-lg font-black text-primary">{member.name.charAt(0)}</span>}
              </div>
              <div>
                <h4 className="font-bold text-foreground">{member.name}</h4>
                <p className="text-xs text-muted-foreground uppercase tracking-widest">{member.role}</p>
              </div>
            </div>
            
            <div className="flex-1 grid grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Completion Rate</p>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black leading-none text-foreground">{member.metrics.completionRate}%</span>
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mb-1.5">
                    <div className="h-full bg-primary" style={{ width: `${member.metrics.completionRate}%` }} />
                  </div>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">On-Time Delivery</p>
                <div className="flex items-end gap-2">
                  <span className={`text-2xl font-black leading-none ${member.metrics.onTimeRate >= 80 ? 'text-green-500' : 'text-orange-500'}`}>{member.metrics.onTimeRate}%</span>
                </div>
              </div>
              
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Tasks Completed</p>
                <span className="text-2xl font-black leading-none text-foreground">{member.metrics.completedTasks} <span className="text-sm text-muted-foreground font-medium">/ {member.metrics.totalTasks}</span></span>
              </div>

              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Overdue</p>
                <span className={`text-2xl font-black leading-none ${member.metrics.overdueTasks > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{member.metrics.overdueTasks}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────────

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary" }: any) {
  return (
    <div className="bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg bg-muted ${color.replace('text-', 'bg-').replace('-500', '-500/10')}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black tracking-tight">{value}</span>
      </div>
      <p className="text-xs font-medium text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}

function QuickAssignButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    title: "",
    memberId: "",
    projectId: "",
    priority: "medium",
    dueDate: "",
  });

  const { data: crew = [] } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/team", { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? res.json() : [];
    }
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: async () => {
      const token = await getToken();
      const res = await fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? res.json() : [];
    }
  });

  const handleAssign = async () => {
    if (!form.title || !form.memberId) {
      toast({ variant: "destructive", title: "Title and Crew required" });
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const res = await fetch("/api/admin/quick-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: form.title,
          memberId: form.memberId,
          projectId: form.projectId || undefined,
          priority: form.priority,
          dueDate: form.dueDate || undefined,
        })
      });

      if (res.ok) {
        toast({ title: "Task assigned successfully", description: "Crew has been notified." });
        setOpen(false);
        setForm({ title: "", memberId: "", projectId: "", priority: "medium", dueDate: "" });
        queryClient.invalidateQueries({ queryKey: ["admin"] });
      } else {
        const err = await res.json();
        throw new Error(err.error || "Failed to assign");
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Assignment failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setOpen(true)} 
        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
      >
        <Plus className="w-4 h-4" />
        Quick Assign
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Quick Assign Task</h3>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Task Title *</label>
                <input 
                  value={form.title} 
                  onChange={e => setForm({ ...form, title: e.target.value })} 
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-sm" 
                  placeholder="Edit highlight video" 
                />
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Assign to Crew *</label>
                <select 
                  value={form.memberId} 
                  onChange={e => setForm({ ...form, memberId: e.target.value })} 
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Select crew member...</option>
                  {crew.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.role}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Project (optional)</label>
                <select 
                  value={form.projectId} 
                  onChange={e => setForm({ ...form, projectId: e.target.value })} 
                  className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">No specific project</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Due Date</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full mt-1 bg-background border border-border rounded-xl px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold">Cancel</button>
              <button 
                onClick={handleAssign} 
                disabled={loading || !form.title || !form.memberId}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
              >
                {loading ? "Assigning..." : "Assign Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function BroadcastButton() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ title: "Coming soon", description: "Broadcast modal will be implemented next." })} className="flex items-center gap-2 bg-background border border-border text-foreground px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-muted/50 transition-all">
      <Send className="w-4 h-4 text-muted-foreground" />
      Broadcast
    </button>
  );
}

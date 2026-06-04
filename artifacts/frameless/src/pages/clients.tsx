// artifacts/frameless/src/pages/clients.tsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, X, Trash2, Phone, Mail, Globe, MapPin, Building2, TrendingUp, DollarSign, Star, Edit3, ChevronRight, ExternalLink, Users, Award, Calendar, MessageSquare, Zap, Repeat, Target } from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

interface Client {
  id:string; name:string; email?:string; phone?:string; company?:string;
  address?:string; website?:string; notes?:string; status?:string;
  totalRevenue?:number; projectCount?:number; tier?:string; createdAt:string;
}
interface Project { 
  id:string; title:string; status:string; budget?:number; deadline?:string; projectType?:string; 
  client?:string; progress?:number; priority?:string; createdAt?:string; updatedAt?:string;
}
interface EnrichedClient extends Client {
  projectCount: number;
  runningProjectCount: number;
  totalBudget: number;
  hasRunning: boolean;
  isRepeat: boolean;
  lastProjectDate?: string;
}

async function api(path:string, opts:RequestInit={}) {
  const token = getToken();
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{}), ...(opts.headers as any||{}) },
  });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.error||"Failed"); }
  return r.json();
}

const TIERS = [
  {k:"vip",l:"VIP",c:"#fbbf24"},
  {k:"regular",l:"Regular",c:"#60a5fa"},
  {k:"new",l:"New",c:"#4ade80"}
];
const STATUSES = [
  {k:"active",l:"Active",c:"#4ade80"},
  {k:"prospect",l:"Prospect / Lead",c:"#a78bfa"},
  {k:"on_hold",l:"On Hold",c:"#fbbf24"},
  {k:"inactive",l:"Inactive",c:"rgba(255,255,255,.35)"},
  {k:"lost",l:"Lost",c:"#f87171"}
];
const STATUS_CLR: Record<string,string> = { active:"#4ade80", prospect:"#a78bfa", on_hold:"#fbbf24", inactive:"rgba(255,255,255,.35)", lost:"#f87171", planning:"#a78bfa", completed:"#60a5fa" };
const CATEGORIES = [
  {k:"all", l:"Semua"},
  {k:"leads", l:"Leads / Inquiry"},
  {k:"prospect", l:"Prospect"},
  {k:"active", l:"Active"},
  {k:"on_hold", l:"On Hold"},
  {k:"vip", l:"VIP"},
  {k:"inactive", l:"Inactive"},
];

// Parse rich inquiry notes for attractive lead cards
function parseInquiryNote(notes?: string) {
  if (!notes) return { service: "", budget: "", timeline: "", preferred: "", message: "" };
  const lines = notes.split("\n");
  let service = "", budget = "", timeline = "", preferred = "", message = "";
  for (const line of lines) {
    if (/Service:/i.test(line)) service = line.split(/Service:/i)[1]?.trim() || "";
    else if (/Budget:/i.test(line)) budget = line.split(/Budget:/i)[1]?.trim() || "";
    else if (/Timeline:/i.test(line)) timeline = line.split(/Timeline:/i)[1]?.trim() || "";
    else if (/Preferred Contact:/i.test(line)) preferred = line.split(/Preferred Contact:/i)[1]?.trim() || "";
    else if (/Message:/i.test(line)) message = line.split(/Message:/i)[1]?.trim() || "";
  }
  return { service, budget, timeline, preferred, message: message || notes };
}

function isRunningProject(p: Project) {
  const s = (p.status || "").toLowerCase();
  const prog = p.progress ?? 0;
  return !["completed","done","delivered","cancelled","closed"].includes(s) && prog < 100;
}

function ClientModal({client,onClose,onSave}:{client:Client|null;onClose:()=>void;onSave:(d:Partial<Client>)=>Promise<void>}) {
  const [form, setForm] = useState<Partial<Client>>(client||{status:"prospect",tier:"new"});
  const [saving, setSaving] = useState(false);
  const f = (k:keyof Client, v:any) => setForm(p=>({...p,[k]:v}));
  const ipt = {width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT,boxSizing:"border-box" as any,transition:"border-color .2s"};
  async function save() { if(!form.name) return; setSaving(true); try { await onSave(form); } finally { setSaving(false); } }
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(12px)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,overflowY:"auto"}}>
      <div style={{background:"#111318",border:"1px solid rgba(255,255,255,.1)",borderRadius:24,padding:"34px 30px",width:"100%",maxWidth:540,position:"relative",maxHeight:"90vh",overflowY:"auto"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,width:30,height:30,borderRadius:"50%",background:"rgba(255,255,255,.06)",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={14}/></button>
        <h3 style={{fontSize:21,fontWeight:800,color:"#fff",marginBottom:24,letterSpacing:"-.02em"}}>{client?"Edit Client":"New Client"}</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          {[
            {k:"name",l:"Nama / Brand *",full:true,ph:"PT Maju Bersama / John Doe"},
            {k:"company",l:"Perusahaan",ph:"Nama perusahaan"},
            {k:"email",l:"Email",t:"email",ph:"kontak@perusahaan.com"},
            {k:"phone",l:"Telepon / WA",t:"tel",ph:"+62 8xx-xxxx-xxxx"},
            {k:"website",l:"Website",ph:"https://perusahaan.com"},
            {k:"address",l:"Kota / Alamat",ph:"Jakarta, Indonesia"},
          ].map((field:any)=>(
            <div key={field.k} style={{gridColumn:field.full?"1/-1":"auto"}}>
              <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>{field.l}</label>
              <input type={field.t||"text"} value={(form as any)[field.k]||""} onChange={e=>f(field.k,e.target.value)} placeholder={field.ph||""} style={ipt}
                onFocus={e=>(e.target as HTMLElement).style.borderColor=`${OR}66`}
                onBlur={e=>(e.target as HTMLElement).style.borderColor="rgba(255,255,255,.1)"}/>
            </div>
          ))}
          <div>
            <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>Tier</label>
            <select value={form.tier||"new"} onChange={e=>f("tier",e.target.value)} style={{...ipt,cursor:"pointer"}}>
              {TIERS.map(o=><option key={o.k} value={o.k} style={{background:"#111318"}}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>Status</label>
            <select value={form.status||"prospect"} onChange={e=>f("status",e.target.value)} style={{...ipt,cursor:"pointer"}}>
              {STATUSES.map(o=><option key={o.k} value={o.k} style={{background:"#111318"}}>{o.l}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:6}}>Catatan Internal</label>
            <textarea value={form.notes||""} onChange={e=>f("notes",e.target.value)} rows={3} placeholder="Preferensi klien, history penting, kontak PIC, dll..." style={{...ipt,resize:"vertical"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10,marginTop:24,justifyContent:"flex-end"}}>
          <button onClick={onClose} style={{padding:"10px 18px",borderRadius:10,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",color:"rgba(255,255,255,.6)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>Cancel</button>
          <button onClick={save} disabled={saving||!form.name} style={{padding:"10px 22px",borderRadius:10,background:OR,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT,opacity:saving?0.7:1}}>
            {saving?"Saving...":(client?"Update":"Add Client")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Client detail drawer - significantly cooler card-like layout
function ClientDrawer({client,projects,onClose,onEdit,onQuickConvert,onRefresh,onDelete}:{client:Client;projects:Project[];onClose:()=>void;onEdit:()=>void; onQuickConvert?: (c:Client, status?:string, tier?:string)=>void; onRefresh?: ()=>void; onDelete?: (c:Client)=>void }) {
  const tier  = TIERS.find(t=>t.k===client.tier)||TIERS[2];
  const stat  = STATUSES.find(s=>s.k===client.status)||STATUSES[0];
  const clientProjects = projects.filter((p: any) => p.client === client.name || p.clientId === client.id);
  const runningProjects = clientProjects.filter(isRunningProject);
  const totalBudget = clientProjects.reduce((s, p: any) => s + (Number(p.budget)||0), 0);
  const isRepeatClient = clientProjects.length >= 2;

  // Quick follow-up note (local state + save)
  const [followNote, setFollowNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  async function saveFollowNote() {
    if (!followNote.trim()) return;
    setSavingNote(true);
    try {
      const ts = new Date().toISOString().slice(0,10);
      const append = `\n\n[Follow-up ${ts}] ${followNote.trim()}`;
      const newNotes = (client.notes || "") + append;
      await api(`/api/clients/${client.id}`, { method: "PUT", body: JSON.stringify({ notes: newNotes }) });
      setFollowNote("");
      if (onRefresh) onRefresh();
      onClose();
    } catch(e:any) {
      alert("Gagal simpan catatan: " + e.message);
    } finally { setSavingNote(false); }
  }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",backdropFilter:"blur(8px)",zIndex:100,display:"flex",justifyContent:"flex-end"}}>
      <div style={{width:"min(96vw,500px)",background:"#111318",height:"100%",overflowY:"auto",borderLeft:"1px solid rgba(255,255,255,.1)",padding:"24px 22px"}}>
        {/* Hero Header - more premium */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:54,height:54,borderRadius:16,background:`linear-gradient(135deg,${OR}22, rgba(255,255,255,.04))`,border:`2px solid ${OR}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:OR}}>
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{fontSize:20,fontWeight:800,color:"#fff",letterSpacing:"-0.02em"}}>{client.name}</div>
              {client.company && <div style={{fontSize:12,color:"rgba(255,255,255,.45)"}}>{client.company}</div>}
            </div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={onEdit} style={{width:34,height:34,borderRadius:10,background:`${OR}22`,border:`1px solid ${OR}44`,cursor:"pointer",color:OR,display:"flex",alignItems:"center",justifyContent:"center"}}><Edit3 size={14}/></button>
            <button 
              onClick={() => { if (onDelete) onDelete(client); onClose(); }} 
              style={{width:34,height:34,borderRadius:10,background:"rgba(248,113,113,.15)",border:"1px solid rgba(248,113,113,.3)",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",justifyContent:"center"}}
              title="Hapus client"
            >
              <Trash2 size={15}/>
            </button>
            <button onClick={onClose} style={{width:34,height:34,borderRadius:10,background:"rgba(255,255,255,.06)",border:"none",cursor:"pointer",color:"rgba(255,255,255,.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={15}/></button>
          </div>
        </div>

        {/* Tier / Status + smart badges */}
        <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
          <span style={{fontSize:11,padding:"4px 13px",borderRadius:999,background:`${tier.c}18`,color:tier.c,fontWeight:700,border:`1px solid ${tier.c}33`}}>⭐ {tier.l}</span>
          <span style={{fontSize:11,padding:"4px 13px",borderRadius:999,background:`${stat.c}18`,color:stat.c,fontWeight:700,border:`1px solid ${stat.c}33`}}>{stat.l}</span>
          {isRepeatClient && <span style={{fontSize:11,padding:"4px 11px",borderRadius:999,background:"rgba(251,191,36,.15)",color:"#fbbf24",fontWeight:700}}><Repeat size={12} style={{marginRight:3,verticalAlign:"-2px"}}/> Repeat • {clientProjects.length} orders</span>}
          {runningProjects.length > 0 && <span style={{fontSize:11,padding:"4px 11px",borderRadius:999,background:"rgba(74,222,128,.15)",color:"#4ade80",fontWeight:700}}><Zap size={12} style={{marginRight:3,verticalAlign:"-1px"}}/> {runningProjects.length} running</span>}
        </div>

        {/* Rich metrics row - card style */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:18}}>
          {[
            {l:"Total Projects", v: clientProjects.length, sub: runningProjects.length + " open", c: OR},
            {l:"Est. Value", v: totalBudget ? formatCurrency(totalBudget) : "—", sub: "from projects", c: "#60a5fa"},
            {l:"Status", v: stat.l, sub: client.status || "prospect", c: stat.c},
            {l:"Tier", v: tier.l, sub: "priority", c: tier.c},
          ].map((m,i)=>(
            <div key={i} style={{padding:"10px 11px",borderRadius:12,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:2}}>{m.l}</div>
              <div style={{fontSize:15,fontWeight:800,color:m.c,marginBottom:1}}>{m.v}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Contact - nicer block */}
        <div style={{background:"rgba(255,255,255,.025)",borderRadius:14,padding:"14px 15px",marginBottom:18,border:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".12em",marginBottom:8}}>Kontak &amp; Akses Cepat</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {client.email && <a href={`mailto:${client.email}`} style={{display:"flex",alignItems:"center",gap:8,color:"rgba(255,255,255,.75)",textDecoration:"none",fontSize:13}}><Mail size={13} color={OR}/> {client.email}</a>}
            {client.phone && <a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener" style={{display:"flex",alignItems:"center",gap:8,color:"#25D366",textDecoration:"none",fontSize:13}}><Phone size={13}/> {client.phone} <span style={{fontSize:10,opacity:.6}}>(WA)</span></a>}
            {client.website && <a href={client.website.startsWith("http")?client.website:`https://${client.website}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:8,color:"#60a5fa",textDecoration:"none",fontSize:13}}><Globe size={13}/> {client.website}</a>}
          </div>
        </div>

        {/* Projects - improved with running highlight + progress hint */}
        <div style={{marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".12em",margin:0}}>Projects ({clientProjects.length})</p>
            {runningProjects.length > 0 && <span style={{fontSize:10,color:"#4ade80"}}>{runningProjects.length} active</span>}
          </div>
          {clientProjects.length === 0 ? (
            <div style={{padding:12,borderRadius:10,background:"rgba(255,255,255,.025)",border:"1px dashed rgba(255,255,255,.1)",fontSize:12,color:"rgba(255,255,255,.35)"}}>Belum ada proyek. Buat project baru dari Command Center / Projects.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:7}}>
              {clientProjects.slice(0,6).map((p: any) => {
                const running = isRunningProject(p);
                const prog = Math.max(0, Math.min(100, p.progress || 0));
                return (
                  <div key={p.id} style={{padding:"9px 11px",borderRadius:10,background: running ? "rgba(74,222,128,.06)" : "rgba(255,255,255,.03)", border: running ? "1px solid rgba(74,222,128,.2)" : "1px solid rgba(255,255,255,.06)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#fff"}}>{p.title}</div>
                      <span style={{fontSize:10,padding:"1px 8px",borderRadius:99,background:`${STATUS_CLR[p.status]||OR}22`,color:STATUS_CLR[p.status]||OR}}>{p.status}</span>
                    </div>
                    <div style={{marginTop:4,display:"flex",alignItems:"center",gap:8}}>
                      {p.deadline && <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>📅 {new Date(p.deadline).toLocaleDateString("id-ID")}</span>}
                      {running && prog > 0 && (
                        <div style={{flex:1,height:3,background:"rgba(255,255,255,.08)",borderRadius:99,overflow:"hidden"}}>
                          <div style={{width:`${prog}%`,height:"100%",background:"#4ade80"}} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {clientProjects.length > 6 && <div style={{fontSize:10,color:"rgba(255,255,255,.35)",textAlign:"center"}}>+{clientProjects.length-6} lainnya</div>}
            </div>
          )}
        </div>

        {/* Notes + Add Follow-up (super useful for "udah difollow up") */}
        <div style={{marginBottom:18}}>
          <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".12em",marginBottom:6}}>Catatan &amp; Follow-up Log</div>
          <div style={{background:"rgba(255,255,255,.025)",borderRadius:12,padding:12,border:"1px solid rgba(255,255,255,.06)",minHeight:62,marginBottom:8,whiteSpace:"pre-wrap",fontSize:12,color:"rgba(255,255,255,.65)",lineHeight:1.45}}>
            {client.notes || "Belum ada catatan internal."}
          </div>

          {/* Quick log follow up */}
          <div style={{display:"flex",gap:6}}>
            <input 
              value={followNote} 
              onChange={e=>setFollowNote(e.target.value)} 
              placeholder="Log follow-up: WA 12 Okt, kirim proposal, budget disetujui..." 
              style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"8px 11px",color:"#fff",fontSize:12,outline:"none"}} 
              onKeyDown={e=>{if(e.key==="Enter" && !savingNote) saveFollowNote();}}
            />
            <button onClick={saveFollowNote} disabled={savingNote || !followNote.trim()} style={{padding:"0 14px",borderRadius:9,background:OR,border:"none",color:"#fff",fontSize:12,fontWeight:700,opacity: savingNote|| !followNote.trim() ? 0.6 : 1, cursor:"pointer"}}>{savingNote ? "..." : "Log"}</button>
          </div>
          <div style={{fontSize:9,color:"rgba(255,255,255,.3)",marginTop:3}}>Catatan akan ditambahkan otomatis dengan tanggal.</div>
        </div>

        {/* Big quick actions */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {client.phone && <a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"11px",borderRadius:11,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:13,fontWeight:700}}>💬 WhatsApp</a>}
          {client.email && <a href={`mailto:${client.email}`} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:7,padding:"11px",borderRadius:11,border:"1px solid rgba(255,255,255,.12)",color:"rgba(255,255,255,.75)",textDecoration:"none",fontSize:13,fontWeight:600}}><Mail size={14}/> Email</a>}
        </div>

        {/* Category quick change (cooler pills) */}
        <div>
          <p style={{fontSize:10,color:"rgba(255,255,255,.3)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>Ubah Kategori Cepat</p>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["active","prospect","on_hold","inactive","lost"].map(s => (
              <button key={s} onClick={()=>{ (onQuickConvert||(()=>{}))(client, s, client.tier||"regular"); onClose(); }} style={{fontSize:10,padding:"5px 11px",borderRadius:999,background: (client.status||'').toLowerCase()===s ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)", color: (client.status||'').toLowerCase()===s ? "#fff" : "rgba(255,255,255,.6)", cursor:"pointer"}}>{s}</button>
            ))}
            <button onClick={()=>{ (onQuickConvert||(()=>{}))(client, "active", "vip"); onClose(); }} style={{fontSize:10,padding:"5px 11px",borderRadius:999,background:"#fbbf2415",border:"1px solid #fbbf2433",color:"#fbbf24",cursor:"pointer",fontWeight:600}}>★ VIP</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients,  setClients]  = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [modal,    setModal]    = useState<Client|null|"new">(null);
  const [detail,   setDetail]   = useState<Client|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client|null>(null);

  const load = useCallback(async()=>{
    setLoading(true);
    try {
      const [cl, pr] = await Promise.all([
        api("/api/clients").catch(()=>[]),
        api("/api/projects").catch(()=>[]),
      ]);
      setClients(Array.isArray(cl)?cl:[]);
      setProjects(Array.isArray(pr)?pr:[]);
    } catch(e:any) { toast({variant:"destructive",title:"Error",description:e.message}); }
    finally { setLoading(false); }
  },[toast]);

  useEffect(()=>{ load(); },[load]);

  async function handleSave(data:Partial<Client>) {
    try {
      if ((modal as Client)?.id) {
        await api(`/api/clients/${(modal as Client).id}`,{method:"PATCH",body:JSON.stringify(data)});
        toast({title:"Client updated"});
      } else {
        await api("/api/clients",{method:"POST",body:JSON.stringify(data)});
        toast({title:"Client added"});
      }
      setModal(null); load();
    } catch(e:any) { toast({variant:"destructive",title:"Error",description:e.message}); }
  }

  async function handleDelete(id:string) {
    try { 
      await api(`/api/clients/${id}`,{method:"DELETE"}); 
      toast({title:"Client deleted"}); 
      load(); 
    }
    catch(e:any) { toast({variant:"destructive",title:"Error",description:e.message}); }
  }

  // === All derived intelligence (must be before any use of enriched/newLeads) ===
  const enriched = useMemo<EnrichedClient[]>(() => {
    return clients.map((c): EnrichedClient => {
      const cps = projects.filter((p: any) => p.client === c.name || p.clientId === c.id);
      const running = cps.filter(isRunningProject);
      const totalB = cps.reduce((sum, p: any) => sum + (Number(p.budget) || 0), 0);
      const last = cps.length ? [...cps].sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] : null;
      return {
        ...c,
        projectCount: cps.length,
        runningProjectCount: running.length,
        totalBudget: totalB,
        hasRunning: running.length > 0,
        isRepeat: cps.length >= 2,
        lastProjectDate: last?.createdAt || undefined,
      };
    });
  }, [clients, projects]);

  const newLeads = useMemo(() => enriched.filter(c => c.status === "prospect" || (c.notes && /Inquiry/i.test(c.notes))), [enriched]);
  const followedUpRunning = useMemo(() => enriched.filter(c => 
    (c.status === "active" || c.status === "on_hold" || (c.notes && /follow|hubungi|diskusi|wa|proposal|konversi/i.test(c.notes))) && c.hasRunning
  ), [enriched]);
  const repeatLoyal = useMemo(() => [...enriched]
    .filter(c => c.isRepeat)
    .sort((a, b) => (b.projectCount || 0) - (a.projectCount || 0))
    .slice(0, 8), [enriched]);

  // Stats (accurate from enriched)
  const leadsCount = newLeads.length;
  const computedRevenue = enriched.reduce((s,c)=> s + (c.totalBudget || c.totalRevenue || 0), 0);
  const stats = {
    total:    enriched.length,
    active:   enriched.filter(c=>c.status==="active").length,
    vip:      enriched.filter(c=>c.tier==="vip").length,
    leads:    leadsCount,
    revenue:  computedRevenue,
  };

  const filteredEnriched = useMemo(() => {
    return enriched.filter(c => {
      const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company||"").toLowerCase().includes(search.toLowerCase()) || (c.email||"").toLowerCase().includes(search.toLowerCase());
      const mt = filterTier==="all" || c.tier===filterTier;
      let mc = true;
      if (filterCategory === "leads") mc = Boolean(c.status === "prospect" || (c.notes && /Inquiry/i.test(c.notes)));
      else if (filterCategory !== "all") mc = Boolean(c.status === filterCategory || (filterCategory==="vip" && c.tier==="vip"));
      return ms && mt && mc;
    });
  }, [enriched, search, filterTier, filterCategory]);

  async function quickConvert(client: Client, toStatus = "active", toTier = "regular") {
    try {
      await api(`/api/clients/${client.id}`, { method: "PUT", body: JSON.stringify({ status: toStatus, tier: toTier }) });
      toast({ title: "Client updated", description: `Moved to ${toStatus}` });
      load();
    } catch(e:any) { toast({variant:"destructive",title:"Error",description:e.message}); }
  }

  function setCategory(k: string) { setFilterCategory(k); }

  const ipt={background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT};

  return (
    <div style={{fontFamily:FONT,color:"#f0f0f0",paddingBottom:60}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:28,flexWrap:"wrap",gap:16}}>
        <div>
          <h1 style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Clients</h1>
          <p style={{fontSize:12,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".14em",fontWeight:600}}>CRM · Manajemen Klien Frameless</p>
        </div>
        <button onClick={()=>setModal("new")} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:12,background:OR,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>
          <Plus size={15}/> New Client
        </button>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:28}}>
        {[
          {l:"Total Clients",v:stats.total,c:OR,icon:<Building2 size={14}/>},
          {l:"Leads / Inquiries",v:stats.leads,c:"#a78bfa",icon:<Star size={14}/>},
          {l:"Active",v:stats.active,c:"#4ade80",icon:<TrendingUp size={14}/>},
          {l:"VIP",v:stats.vip,c:"#fbbf24",icon:<Star size={14}/>},
          {l:"Total Revenue",v:formatCurrency(stats.revenue),c:"#60a5fa",icon:<DollarSign size={14}/>},
        ].map(s=>(
          <div key={s.l} style={{padding:"16px 18px",borderRadius:16,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <p style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".12em",margin:0}}>{s.l}</p>
              <span style={{color:s.c}}>{s.icon}</span>
            </div>
            <p style={{fontSize:22,fontWeight:900,color:s.c,margin:0,letterSpacing:"-.02em"}}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* 🔥 NEW LEADS - much more attractive glass + parsed details */}
      <AnimatePresence>
        {newLeads.length > 0 && (
          <div style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{background:"linear-gradient(90deg,#a78bfa,#c084fc)",color:"#fff",padding:"4px 14px",borderRadius:999,fontSize:11,fontWeight:800,letterSpacing:".08em",display:"flex",alignItems:"center",gap:6,boxShadow:"0 2px 12px rgba(167,139,250,.4)"}}>
                  <Zap size={13}/> NEW LEADS
                </div>
                <p style={{margin:0,fontSize:14,fontWeight:700,color:"#fff"}}>Inquiries dari Website <span style={{color:"#a78bfa"}}>({newLeads.length})</span> — follow up cepat!</p>
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,.4)"}}>Auto dari form layanan</div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:14}}>
              {newLeads.slice(0,6).map((lead, idx) => {
                const cleanPhone = (lead.phone || "").replace(/\D/g,"");
                const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(lead.name)},%20terima%20kasih%20sudah%20mengirim%20inquiry%20di%20Frameless%20Creative.%20Kami%20siap%20diskusi%20project%20Anda.%20Bisa%20dibantu%3F` : null;
                const parsed = parseInquiryNote(lead.notes);
                const snippet = parsed.message || (lead.notes ? lead.notes.split("Inquiry")[1]?.slice(0,110) || lead.notes.slice(0,110) : "");
                return (
                  <motion.div 
                    key={lead.id}
                    initial={{ opacity: 0, y: 12, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.2) }}
                    whileHover={{ y: -3, boxShadow: "0 20px 45px rgba(0,0,0,.45)" }}
                    onClick={() => setDetail(lead)}
                    style={{
                      background: "linear-gradient(145deg, rgba(167,139,250,.08), rgba(255,255,255,.025))",
                      border: "1px solid rgba(167,139,250,.28)",
                      borderRadius: 18,
                      padding: "16px 16px 14px",
                      position: "relative",
                      cursor: "pointer",
                      overflow: "hidden"
                    }}
                  >
                    {/* top accent */}
                    <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(to right,#a78bfa,#c084fc)"}} />

                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:800,color:"#fff",fontSize:15,letterSpacing:"-0.01em"}}>{lead.name}</div>
                        <div style={{fontSize:11,color:"rgba(255,255,255,.55)",marginTop:1}}>{lead.company || lead.email}</div>
                      </div>
                      {parsed.service && (
                        <div style={{fontSize:9,background:"rgba(167,139,250,.2)",color:"#c4b5fd",padding:"1px 7px",borderRadius:6,whiteSpace:"nowrap",alignSelf:"flex-start",marginTop:2}}>{parsed.service.slice(0,18)}</div>
                      )}
                    </div>

                    {/* key meta pills */}
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      {parsed.budget && <span style={{fontSize:10,padding:"1px 8px",borderRadius:999,background:"rgba(255,255,255,.08)",color:"#ddd"}}>💰 {parsed.budget}</span>}
                      {parsed.timeline && <span style={{fontSize:10,padding:"1px 8px",borderRadius:999,background:"rgba(255,255,255,.08)",color:"#ddd"}}>⏱ {parsed.timeline}</span>}
                      {parsed.preferred && <span style={{fontSize:10,padding:"1px 8px",borderRadius:999,background:"rgba(255,255,255,.08)",color:"#ddd"}}>📞 {parsed.preferred}</span>}
                    </div>

                    {snippet && (
                      <div style={{fontSize:11,color:"rgba(167,139,250,.85)",lineHeight:1.35,marginBottom:10,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{snippet}</div>
                    )}

                    <div style={{display:"flex",gap:8,alignItems:"center",marginTop:4}}>
                      {waUrl && (
                        <a href={waUrl} target="_blank" rel="noopener" onClick={e=>e.stopPropagation()}
                           style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"9px 12px",borderRadius:10,background:"#25D366",color:"#fff",textDecoration:"none",fontSize:12,fontWeight:700}}>
                          <Phone size={14}/> WA Sekarang
                        </a>
                      )}
                      <button onClick={e=>{e.stopPropagation(); quickConvert(lead, "active", "regular"); }} 
                        style={{padding:"9px 14px",borderRadius:10,background:"rgba(74,222,128,.18)",color:"#4ade80",border:"1px solid rgba(74,222,128,.3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>Convert</button>
                      <button onClick={e=>{e.stopPropagation(); setDetail(lead);}} 
                        style={{padding:"9px 10px",borderRadius:10,background:"rgba(255,255,255,.06)",color:"rgba(255,255,255,.75)",border:"1px solid rgba(255,255,255,.1)",fontSize:11,fontWeight:600,cursor:"pointer"}}>Detail</button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Category Pills (clickable filters for Leads + other kategories) */}
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {CATEGORIES.map(cat => {
          const active = filterCategory === cat.k;
          const count = cat.k==="all" ? enriched.length :
            cat.k==="leads" ? newLeads.length :
            cat.k==="vip" ? stats.vip :
            enriched.filter(c => (c.status||'').toLowerCase() === cat.k || (cat.k==="active" && c.status==="active")).length;
          return (
            <button key={cat.k}
              onClick={() => setCategory(cat.k)}
              style={{
                fontSize:11, padding:"6px 14px", borderRadius:999,
                background: active ? OR : "rgba(255,255,255,.06)",
                color: active ? "#fff" : "rgba(255,255,255,.7)",
                border: active ? `1px solid ${OR}` : "1px solid rgba(255,255,255,.1)",
                cursor:"pointer", fontWeight:600, fontFamily:FONT
              }}>
              {cat.l} <span style={{opacity:.6}}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Smart Segments: Followed-up + Running + Repeat Loyal */}
      {/* Running / Followed-up Pipeline */}
      {followedUpRunning.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{background:"rgba(74,222,128,.15)",color:"#4ade80",padding:"2px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:".08em",display:"flex",alignItems:"center",gap:5}}><Target size={12}/> ACTIVE PIPELINE</div>
            <p style={{margin:0,fontSize:12,fontWeight:600,color:"#fff"}}>Followed up &amp; projects masih running ({followedUpRunning.length})</p>
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6}}>
            {followedUpRunning.slice(0,5).map((c, i) => (
              <div key={c.id} onClick={()=>setDetail(c)} style={{minWidth:168,background:"rgba(74,222,128,.06)",border:"1px solid rgba(74,222,128,.2)",borderRadius:12,padding:"10px 12px",cursor:"pointer",flexShrink:0}}>
                <div style={{fontWeight:700,fontSize:13,color:"#fff",marginBottom:2}}>{c.name}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>{c.company || c.email}</div>
                <div style={{marginTop:6,display:"flex",gap:4,alignItems:"center"}}>
                  <span style={{fontSize:10,background:"#4ade8018",color:"#4ade80",padding:"0 6px",borderRadius:99}}>{c.runningProjectCount} running</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.4)"}}>· {c.projectCount} total</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Repeat / Loyal Clients */}
      {repeatLoyal.length > 0 && (
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <div style={{background:"rgba(251,191,36,.15)",color:"#fbbf24",padding:"2px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:".08em",display:"flex",alignItems:"center",gap:5}}><Repeat size={12}/> REPEAT &amp; LOYAL</div>
            <p style={{margin:0,fontSize:12,fontWeight:600,color:"#fff"}}>Sering repeat order ({repeatLoyal.length} klien)</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(170px,1fr))",gap:10}}>
            {repeatLoyal.map((c) => (
              <div key={c.id} onClick={()=>setDetail(c)} style={{background:"rgba(251,191,36,.05)",border:"1px solid rgba(251,191,36,.2)",borderRadius:12,padding:"10px 12px",cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <div style={{fontWeight:700,color:"#fff",fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,fontWeight:800,color:"#fbbf24"}}>{c.projectCount}×</div>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,.5)"}}>{c.company}</div>
                <div style={{marginTop:4,fontSize:10,color:"#fbbf24"}}>Loyal customer • Total est. {formatCurrency(c.totalBudget || 0)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{display:"flex",gap:12,marginBottom:22,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{flex:1,minWidth:200,position:"relative"}}>
          <Search size={14} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"rgba(255,255,255,.35)"}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari nama, perusahaan, email..." style={{...ipt,width:"100%",paddingLeft:36,boxSizing:"border-box"}}/>
        </div>
        <select value={filterTier} onChange={e=>setFilterTier(e.target.value)} style={{...ipt,cursor:"pointer"}}>
          <option value="all" style={{background:"#111318"}}>All Tier</option>
          {TIERS.map(t=><option key={t.k} value={t.k} style={{background:"#111318"}}>{t.l}</option>)}
        </select>
        <select value={filterCategory} onChange={e=>setFilterCategory(e.target.value)} style={{...ipt,cursor:"pointer"}}>
          {CATEGORIES.map(c=><option key={c.k} value={c.k} style={{background:"#111318"}}>{c.l}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:"60px 0"}}><div style={{width:32,height:32,borderRadius:"50%",border:`3px solid ${OR}`,borderTopColor:"transparent",animation:"spin .7s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style></div>}

      {/* Grid - improved cards with running / repeat indicators */}
      {!loading&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
          {filteredEnriched.map((c, idx)=>{
            const tier  = TIERS.find(t=>t.k===c.tier)||TIERS[2];
            const stat  = STATUSES.find(s=>s.k===c.status)||STATUSES[0];
            const runningBadge = c.hasRunning ? `${c.runningProjectCount} running` : null;
            return (
              <motion.div 
                key={c.id} 
                onClick={()=>setDetail(c)}
                initial={{opacity:0, y:8}}
                animate={{opacity:1, y:0}}
                transition={{delay: Math.min(idx*0.015, 0.25)}}
                whileHover={{ y:-2 }}
                style={{
                  background:"rgba(255,255,255,.025)",
                  border:`1px solid ${c.tier==="vip"?"rgba(251,191,36,.22)":"rgba(255,255,255,.07)"}`,
                  borderRadius:20,
                  padding:"18px 18px 14px",
                  cursor:"pointer",
                  transition:"border-color .2s, transform .2s, box-shadow .2s",
                  position:"relative"
                }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement; el.style.borderColor = c.tier==="vip"?"rgba(251,191,36,.45)":`${OR}44`; el.style.boxShadow="0 14px 40px rgba(0,0,0,.35)"; }}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement; el.style.borderColor = c.tier==="vip"?"rgba(251,191,36,.22)":"rgba(255,255,255,.07)"; el.style.boxShadow="none"; }}
              >
                {/* Avatar + Name + badges */}
                <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:12}}>
                  <div style={{width:42,height:42,borderRadius:"50%",background:`${OR}22`,border:`2px solid ${OR}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{color:OR,fontWeight:900,fontSize:17}}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <h3 style={{fontSize:15,fontWeight:700,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</h3>
                    {c.company&&<p style={{fontSize:12,color:"rgba(255,255,255,.4)",margin:"1px 0 0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.company}</p>}
                  </div>
                  <div style={{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
                    <span style={{fontSize:10,padding:"2px 9px",borderRadius:100,background:`${tier.c}18`,color:tier.c,fontWeight:700}}>{tier.l}</span>
                    <span style={{fontSize:10,padding:"2px 9px",borderRadius:100,background:`${stat.c}18`,color:stat.c,fontWeight:700,marginTop:2}}>{stat.l}</span>
                  </div>
                </div>

                {/* Smart badges row */}
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {runningBadge && <span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:"rgba(74,222,128,.15)",color:"#4ade80",fontWeight:600}}><Zap size={10} style={{verticalAlign:"-1px"}}/> {runningBadge}</span>}
                  {c.isRepeat && <span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:"rgba(251,191,36,.15)",color:"#fbbf24",fontWeight:600}}><Repeat size={10} style={{verticalAlign:"-1px"}}/> Repeat ({c.projectCount}×)</span>}
                  {c.totalBudget > 0 && <span style={{fontSize:10,padding:"2px 8px",borderRadius:999,background:"rgba(96,165,250,.12)",color:"#60a5fa"}}>Est {formatCurrency(c.totalBudget)}</span>}
                </div>

                {/* Contact */}
                <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                  {c.email&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"rgba(255,255,255,.45)"}}><Mail size={11} color={OR}/>{c.email}</div>}
                  {c.phone&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"rgba(255,255,255,.45)"}}><Phone size={11} color={OR}/>{c.phone}</div>}
                </div>

                {/* Footer */}
                <div style={{borderTop:"1px solid rgba(255,255,255,.07)",paddingTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",gap:12,fontSize:12}}>
                    <div style={{color:"rgba(255,255,255,.35)"}}>Projects <span style={{color:OR,fontWeight:700}}>{c.projectCount}</span></div>
                    {c.runningProjectCount > 0 && <div style={{color:"#4ade80"}}>{c.runningProjectCount} open</div>}
                  </div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={e=>{e.stopPropagation();setModal(c);}} style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.06)",border:"none",cursor:"pointer",color:"rgba(255,255,255,.55)",display:"flex",alignItems:"center",justifyContent:"center"}}><Edit3 size={11}/></button>
                    { (c.status==="prospect" || (c.notes&&/Inquiry/i.test(c.notes))) && <button onClick={e=>{e.stopPropagation(); quickConvert(c,"active","regular");}} style={{fontSize:9,padding:"0 7px",height:26,borderRadius:7,background:"rgba(74,222,128,.12)",border:"none",cursor:"pointer",color:"#4ade80",display:"flex",alignItems:"center"}}>Convert</button> }
                    <button onClick={e=>{e.stopPropagation(); setDeleteTarget(c);}} style={{width:26,height:26,borderRadius:7,background:"rgba(248,113,113,.1)",border:"none",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",justifyContent:"center"}} title="Hapus client"><Trash2 size={11}/></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filteredEnriched.length===0&&!loading&&(
            <div style={{gridColumn:"1/-1",padding:"56px",textAlign:"center",borderRadius:20,border:"2px dashed rgba(255,255,255,.08)"}}>
              <Building2 size={40} color="rgba(255,255,255,.1)" style={{margin:"0 auto 12px"}}/>
              <p style={{color:"rgba(255,255,255,.3)",fontSize:14}}>Tidak ada client ditemukan.</p>
              <button onClick={()=>setModal("new")} style={{marginTop:14,padding:"9px 20px",borderRadius:10,background:OR,border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>+ Tambah Client Baru</button>
            </div>
          )}
        </div>
      )}

      {modal&&<ClientModal client={modal==="new"?null:modal as Client} onClose={()=>setModal(null)} onSave={handleSave}/>}
      {detail&&<ClientDrawer client={detail} projects={projects} onClose={()=>setDetail(null)} onEdit={()=>{setModal(detail);setDetail(null);}} onQuickConvert={quickConvert} onRefresh={load} onDelete={setDeleteTarget} />}

      {/* Nice Delete Confirmation Modal - replaces ugly native confirm */}
      {deleteTarget && (
        <div 
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(14px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{background:"#111318",border:"1px solid rgba(255,255,255,.1)",borderRadius:20,padding:"30px 26px",width:"100%",maxWidth:420,boxShadow:"0 25px 70px rgba(0,0,0,.6)"}}
          >
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
              <div style={{width:48,height:48,borderRadius:12,background:"rgba(248,113,113,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <Trash2 size={24} color="#f87171" />
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:18,fontWeight:800,color:"#fff",letterSpacing:"-0.01em"}}>Hapus Client?</div>
                <div style={{fontSize:14,color:"#f87171",fontWeight:600,marginTop:2}}>{deleteTarget.name}</div>
              </div>
            </div>

            <p style={{fontSize:13,color:"rgba(255,255,255,.65)",lineHeight:1.6,marginBottom:22}}>
              Client ini akan dihapus secara permanen beserta semua catatan dan data terkait. 
              Tindakan ini <strong>tidak bisa dibatalkan</strong>.
            </p>

            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button 
                onClick={() => setDeleteTarget(null)}
                style={{padding:"10px 20px",borderRadius:10,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",color:"rgba(255,255,255,.75)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FONT}}
              >
                Batal
              </button>
              <button 
                onClick={async () => {
                  const idToDelete = deleteTarget.id;
                  setDeleteTarget(null);
                  await handleDelete(idToDelete);
                }}
                style={{padding:"10px 22px",borderRadius:10,background:"#f87171",border:"none",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT}}
              >
                Ya, Hapus Client
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
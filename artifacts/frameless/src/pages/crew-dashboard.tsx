// artifacts/frameless/src/pages/crew-dashboard.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { AIChat } from "@/components/ai-chat";
import {
  Film, CheckCircle2, Clock, Upload, Send, MessageSquare,
  X, Plus, Paperclip, Download, Eye, ChevronRight,
  TrendingUp, Users, Calendar, Star, Zap, LogOut,
  Menu, Bell, RefreshCw, Check, Edit3, FileText,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CrewUser  { id:string; name:string; role:string; email:string; }
interface Project   { id:string; title:string; client:string; status:string; progress:number; deadline?:string; priority:string; projectType?:string; description?:string; driveUrl?:string; }
interface Task      { id:string; title:string; status:string; priority:string; dueDate?:string; projectId:string; projectTitle?:string; assignee?:string; description?:string; }
interface ChatMsg   { id:string; senderId:string; senderName:string; senderRole:string; content:string; fileUrl?:string; fileName?:string; createdAt:string; }

const OR   = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

const STATUS_COLOR: Record<string,string> = {
  active:"#4ade80", completed:"#60a5fa", on_hold:"#fbbf24",
  planning:"#a78bfa", cancelled:"#f87171",
};
const PRIORITY_COLOR: Record<string,string> = { high:OR, medium:"#fbbf24", low:"rgba(255,255,255,.4)" };
const TASK_STATUS: Record<string,{label:string;color:string;bg:string}> = {
  todo:        {label:"To Do",       color:"rgba(255,255,255,.5)",  bg:"rgba(255,255,255,.06)"},
  in_progress: {label:"In Progress", color:OR,                      bg:`${OR}18`},
  review:      {label:"Review",      color:"#a78bfa",               bg:"rgba(167,139,250,.1)"},
  done:        {label:"Done",        color:"#4ade80",               bg:"rgba(74,222,128,.1)"},
};

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getCrewToken() { return localStorage.getItem("crew_token"); }
function getCrewUser():CrewUser|null {
  try { return JSON.parse(localStorage.getItem("crew_user")||"null"); } catch { return null; }
}

async function crewFetch(path:string, opts:RequestInit={}) {
  const token=getCrewToken();
  const r=await fetch(path,{...opts,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}),..."headers" in opts?opts.headers as any:{}}});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||"Request failed");}
  return r.json();
}

// ── Components ─────────────────────────────────────────────────────────────────
function ProgressBar({value,color=OR}:{value:number;color?:string}) {
  return (
    <div style={{width:"100%",height:5,borderRadius:100,background:"rgba(255,255,255,.07)",overflow:"hidden"}}>
      <div style={{height:"100%",width:`${Math.min(100,Math.max(0,value))}%`,borderRadius:100,background:color,transition:"width .5s"}}/>
    </div>
  );
}

// ── LOGIN PAGE ─────────────────────────────────────────────────────────────────
function CrewLogin({onLogin}:{onLogin:(token:string,user:CrewUser)=>void}) {
  const {toast} = useToast();
  const [email,setEmail]       = useState("");
  const [password,setPassword] = useState("");
  const [loading,setLoading]   = useState(false);
  const [showPass,setShowPass] = useState(false);

  async function handleLogin(e:React.FormEvent) {
    e.preventDefault();
    if(!email||!password)return;
    setLoading(true);
    try {
      const res=await fetch("/api/crew/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Email atau password salah");
      if(!data.token) throw new Error("Token tidak ditemukan. Hubungi admin.");
      const crew = data.member||data.crew||data.user;
      if(!crew) throw new Error("Data crew tidak ditemukan. Hubungi admin.");
      localStorage.setItem("crew_token",data.token);
      localStorage.setItem("crew_user",JSON.stringify(crew));
      onLogin(data.token, crew);
    } catch(e:any){toast({variant:"destructive",title:"Login Gagal",description:e.message});}
    finally{setLoading(false);}
  }

  return (
    <div style={{minHeight:"100dvh",background:"#0a0a0c",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT,padding:20,position:"relative",overflow:"hidden"}}>
      {/* Mesh */}
      <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
        <div style={{position:"absolute",width:"70%",height:"70%",top:"-20%",left:"-15%",background:`radial-gradient(ellipse at center,${OR}45 0%,${OR}18 45%,transparent 68%)`,filter:"blur(60px)",animation:"b1 18s ease-in-out infinite"}}/>
        <div style={{position:"absolute",width:"60%",height:"60%",bottom:"-20%",right:"-15%",background:"radial-gradient(ellipse at center,#7c3aed38 0%,transparent 70%)",filter:"blur(70px)",animation:"b2 24s ease-in-out infinite"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)",backgroundSize:"60px 60px"}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(10,10,12,0) 30%,rgba(10,10,12,.8) 100%)"}}/>
      </div>
      <style>{`@keyframes b1{0%,100%{transform:translate(0,0) scale(1);}33%{transform:translate(80px,-60px) scale(1.15);}66%{transform:translate(-40px,80px) scale(0.9);}}@keyframes b2{0%,100%{transform:translate(0,0);}50%{transform:translate(-60px,50px);}}@keyframes spin{to{transform:rotate(360deg);}}`}</style>

      <div style={{position:"relative",zIndex:10,width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:52,height:52,borderRadius:15,background:`linear-gradient(135deg,${OR},#e84d00)`,marginBottom:18,boxShadow:`0 0 40px ${OR}55`}}>
            <span style={{color:"#fff",fontWeight:900,fontSize:20}}>F</span>
          </div>
          <h1 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",marginBottom:6}}>Crew Portal</h1>
          <p style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>Masuk ke akun kru Frameless Creative</p>
        </div>

        <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderTop:`1px solid ${OR}22`,borderRadius:22,padding:"32px 28px"}}>
          <form onSubmit={handleLogin} style={{display:"flex",flexDirection:"column",gap:16}}>
            {[{l:"Email",k:"email",t:"email",v:email,sv:setEmail,ph:"kamu@frameless.id"},
              {l:"Password",k:"pass",t:showPass?"text":"password",v:password,sv:setPassword,ph:"••••••••"}].map(f=>(
              <div key={f.k}>
                <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".16em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:7}}>{f.l}</label>
                <div style={{position:"relative"}}>
                  <input type={f.t} value={f.v} onChange={e=>f.sv(e.target.value)} placeholder={f.ph}
                    style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:`11px ${f.k==="pass"?"42px":14}px 11px 14px`,color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box" as any,fontFamily:FONT,transition:"border-color .2s"}}
                    onFocus={e=>(e.target as HTMLElement).style.borderColor=`${OR}66`}
                    onBlur={e=>(e.target as HTMLElement).style.borderColor="rgba(255,255,255,.1)"}/>
                  {f.k==="pass"&&<button type="button" onClick={()=>setShowPass(p=>!p)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.35)",padding:2,fontSize:13}}>{showPass?"🙈":"👁"}</button>}
                </div>
              </div>
            ))}
            <button type="submit" disabled={loading||!email||!password}
              style={{marginTop:4,padding:"13px",borderRadius:12,background:OR,border:"none",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:loading?0.7:1}}>
              {loading?<><span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite",display:"inline-block"}}/> Masuk...</>:"Masuk ke Portal →"}
            </button>
          </form>
        </div>
        <p style={{textAlign:"center",marginTop:20,fontSize:12,color:"rgba(255,255,255,.2)"}}>
          Admin? <a href="/login" style={{color:OR,textDecoration:"none",fontWeight:700}}>Admin Login →</a>
        </p>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
function CrewDashboard({user,onLogout}:{user:CrewUser;onLogout:()=>void}) {
  const {toast}    = useToast();
  const [tab,setTab] = useState<"overview"|"projects"|"tasks"|"chat"|"upload"|"calendar"|"notes">("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  // Calendar & Notes state
  const [events, setEvents] = useState<Array<{id:string;title:string;date:string;description:string}>>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [notes, setNotes] = useState<Array<{id:string;title:string;content:string}>>([]);
  const [editingNoteId, setEditingNoteId] = useState<string|null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [sending,   setSending]   = useState(false);
  const [file,      setFile]      = useState<File|null>(null);
  const chatBottom  = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);

  // Upload state
  const [uploadFile,   setUploadFile]   = useState<File|null>(null);
  const [uploadLabel,  setUploadLabel]  = useState("");
  const [uploadProjId, setUploadProjId] = useState("");
  const [uploading,    setUploading]    = useState(false);

  const load = useCallback(async()=>{
    try {
      setLoading(true);
      const [proj, tsk, msgs, eventsData, notesData] = await Promise.all([
        crewFetch("/api/projects").catch(()=>[]),
        crewFetch("/api/crew/tasks").catch(()=>[]),
        crewFetch("/api/chat/messages?limit=50").catch(()=>[]),
        // Load events and notes (placeholder data for now)
        crewFetch("/api/crew/events").catch(()=>[]),
        crewFetch("/api/crew/notes").catch(()=>[]),
      ]);
      setProjects(Array.isArray(proj)?proj:[]);
      setTasks(Array.isArray(tsk)?tsk:[]);
      setMessages(Array.isArray(msgs)?msgs:[]);
      setEvents(Array.isArray(eventsData)?eventsData:[]);
      setNotes(Array.isArray(notesData)?notesData:[]);
    } catch(e:any){toast({variant:"destructive",title:"Error",description:e.message});}
    finally{setLoading(false);}
  },[user.id,toast]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{chatBottom.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  // Poll chat every 5 seconds
  useEffect(()=>{
    if(tab!=="chat")return;
    const interval=setInterval(async()=>{
      try{const msgs=await crewFetch("/api/chat/messages?limit=50");if(Array.isArray(msgs))setMessages(msgs);}catch{}
    },5000);
    return()=>clearInterval(interval);
  },[tab]);

  async function updateTaskStatus(taskId:string, status:string) {
    try {
      await crewFetch(`/api/crew/tasks/${taskId}`,{method:"PATCH",body:JSON.stringify({status})});
      setTasks(p=>p.map(t=>t.id===taskId?{...t,status}:t));
      toast({title:`Task updated to ${TASK_STATUS[status]?.label||status}`});
    } catch(e:any){toast({variant:"destructive",title:"Error",description:e.message});}
  }

  async function updateProgress(projectId:string, progress:number) {
    try {
      await crewFetch(`/api/projects/${projectId}`,{method:"PATCH",body:JSON.stringify({progress})});
      setProjects(p=>p.map(pr=>pr.id===projectId?{...pr,progress}:pr));
      toast({title:"Progress updated"});
    } catch(e:any){toast({variant:"destructive",title:"Error",description:e.message});}
  }

  // Handlers for Notes
  function handleAddNote(){
    if(!newNoteTitle.trim() && !newNoteContent.trim()) return;
    const newNote = {id:Date.now().toString(), title:newNoteTitle, content:newNoteContent};
    setNotes([...notes,newNote]);
    setNewNoteTitle("");
    setNewNoteContent("");
    toast({title:"Catatan ditambahkan"});
  }
  function startEdit(note:{id:string;title:string;content:string}){
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  }
  function handleSaveEdit(id:string){
    setNotes(notes.map(n=> n.id===id ? {...n,title:editTitle,content:editContent} : n));
    setEditingNoteId(null);
    setEditTitle("");
    setEditContent("");
    toast({title:"Catatan diperbarui"});
  }
  function handleDeleteNote(id:string){
    setNotes(notes.filter(n=>n.id!==id));
    toast({title:"Catatan dihapus"});
  }

  async function sendMessage() {
    if(!chatInput.trim()&&!file)return;
    setSending(true);
    try {
      let fileUrl:string|undefined,fileName:string|undefined;
      if(file){
        const fd=new FormData();fd.append("file",file);
        const token=getCrewToken();
        const r=await fetch("/api/crew/uploads",{method:"POST",body:fd,headers:token?{Authorization:`Bearer ${token}`}:{} });
        if(!r.ok){const err=await r.json().catch(()=>({error:"Upload gagal"}));throw new Error(err.error||"Upload gagal");}
        const d=await r.json();
        fileUrl=d.url;fileName=file.name;
        setFile(null);
      }
      const msg=await crewFetch("/api/chat/messages",{method:"POST",body:JSON.stringify({content:chatInput.trim()||"",fileUrl,fileName,senderId:user.id,senderName:user.name,senderRole:user.role})});
      setMessages(p=>[...p,msg]);
      setChatInput("");
    } catch(e:any){toast({variant:"destructive",title:"Gagal kirim pesan",description:e.message});}
    finally{setSending(false);}
  }

  async function handleUpload() {
    if(!uploadFile)return;
    setUploading(true);
    try {
      const fd=new FormData();
      fd.append("file",uploadFile);
      fd.append("label",uploadLabel||uploadFile.name);
      if(uploadProjId)fd.append("projectId",uploadProjId);
      const token=getCrewToken();
      const r=await fetch("/api/crew/uploads",{method:"POST",body:fd,headers:token?{Authorization:`Bearer ${token}`}:{} });
      if(!r.ok)throw new Error("Upload gagal");
      const d=await r.json();
      toast({title:"File berhasil diupload",description:d.url||uploadFile.name});
      setUploadFile(null);setUploadLabel("");setUploadProjId("");
    } catch(e:any){toast({variant:"destructive",title:"Upload gagal",description:e.message});}
    finally{setUploading(false);}
  }

  const activeProjects = projects.filter(p=>p.status==="active");
  const myTasks        = tasks.filter(t=>t.status!=="done");
  const doneTasks      = tasks.filter(t=>t.status==="done");
  const overdueTasks   = tasks.filter(t=>t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="done");

  const NAV=[
    {id:"overview",label:"Overview",icon:<TrendingUp size={15}/>},
    {id:"projects",label:"Projects",icon:<Film size={15}/>},
    {id:"tasks",   label:"My Tasks",icon:<CheckCircle2 size={15}/>},
    {id:"chat",    label:"Team Chat",icon:<MessageSquare size={15}/>},
    {id:"upload",  label:"Upload File",icon:<Upload size={15}/>},
    {id:"calendar",label:"Calendar",icon:<Calendar size={15}/>},
    {id:"notes",   label:"Notes",icon:<FileText size={15}/>},
  ] as const;

  return (
    <div style={{minHeight:"100dvh",background:"#0a0a0c",color:"#f0f0f0",fontFamily:FONT,display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:100px;}
        .tab-btn{transition:all .18s;}
        .tab-btn:hover{background:rgba(255,255,255,.06)!important;color:#fff!important;}
        @media(max-width:640px){.desktop-nav{display:none!important;}.mobile-only{display:flex!important;}}
      `}</style>

      {/* ── TOP HEADER ── */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(10,10,12,.88)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,.07)",padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:30,height:30,borderRadius:9,background:OR,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#fff",fontWeight:900,fontSize:14}}>F</span></div>
          <div>
            <p style={{fontSize:13,fontWeight:800,color:"#fff",margin:0,lineHeight:1}}>Crew Portal</p>
            <p style={{fontSize:10,color:"rgba(255,255,255,.35)",margin:0,letterSpacing:".06em"}}>Frameless Creative</p>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="desktop-nav" style={{display:"flex",gap:4}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setTab(n.id as any)} className="tab-btn"
              style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,background:tab===n.id?`${OR}18`:"transparent",border:tab===n.id?`1px solid ${OR}33`:"1px solid transparent",color:tab===n.id?OR:"rgba(255,255,255,.45)",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:FONT}}>
              {n.icon}{n.label}
              {n.id==="tasks"&&myTasks.length>0&&<span style={{background:OR,color:"#fff",fontSize:9,fontWeight:800,width:16,height:16,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{myTasks.length}</span>}
              {n.id==="chat"&&<span style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",display:"inline-block"}}/>}
            </button>
          ))}
        </nav>

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"none",alignItems:"center",gap:8}} className="mobile-only">
            <button onClick={()=>setMobileMenu(p=>!p)} style={{width:34,height:34,borderRadius:9,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",cursor:"pointer",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}><Menu size={16}/></button>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:`${OR}22`,border:`1.5px solid ${OR}44`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:OR,fontWeight:800,fontSize:13}}>{user.name.charAt(0)}</span></div>
            <div className="desktop-nav" style={{display:"flex",flexDirection:"column"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#fff",lineHeight:1}}>{user.name}</span>
              <span style={{fontSize:10,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".06em"}}>{user.role}</span>
            </div>
          </div>
          <button onClick={onLogout} title="Logout" style={{width:32,height:32,borderRadius:9,background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.15)",cursor:"pointer",color:"#f87171",display:"flex",alignItems:"center",justifyContent:"center"}}><LogOut size={13}/></button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {mobileMenu&&(
        <div style={{background:"rgba(14,16,24,.97)",border:"1px solid rgba(255,255,255,.07)",margin:"0 12px",borderRadius:14,padding:"8px",position:"sticky",top:60,zIndex:49,backdropFilter:"blur(20px)"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>{setTab(n.id as any);setMobileMenu(false);}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:tab===n.id?`${OR}18`:"transparent",border:"none",color:tab===n.id?OR:"rgba(255,255,255,.55)",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:FONT,textAlign:"left",marginBottom:3}}>
              {n.icon}{n.label}
            </button>
          ))}
        </div>
      )}

      {/* ── CONTENT ── */}
      <main style={{flex:1,padding:"24px",maxWidth:1200,width:"100%",margin:"0 auto"}}>

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{marginBottom:28}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Halo, {user.name.split(" ")[0]}! 👋</h2>
              <p style={{fontSize:13,color:"rgba(255,255,255,.4)"}}>Berikut update terbaru proyek dan tugasmu.</p>
            </div>

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:28}}>
              {[
                {l:"Active Projects",v:activeProjects.length,c:"#4ade80",icon:<Film size={14}/>},
                {l:"My Tasks",v:myTasks.length,c:OR,icon:<CheckCircle2 size={14}/>},
                {l:"Completed",v:doneTasks.length,c:"#60a5fa",icon:<Check size={14}/>},
                {l:"Overdue",v:overdueTasks.length,c:"#f87171",icon:<Clock size={14}/>},
              ].map(s=>(
                <div key={s.l} style={{padding:"16px",borderRadius:16,background:"rgba(255,255,255,.03)",border:`1px solid ${s.c}22`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".12em"}}>{s.l}</span>
                    <span style={{color:s.c}}>{s.icon}</span>
                  </div>
                  <p style={{fontSize:28,fontWeight:900,color:s.c,margin:0}}>{s.v}</p>
                </div>
              ))}
            </div>

            {/* Active projects */}
            <div style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <h3 style={{fontSize:16,fontWeight:800,color:"#fff",margin:0}}>Proyek Berjalan</h3>
                <button onClick={()=>setTab("projects")} style={{fontSize:12,color:OR,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>Lihat semua <ChevronRight size={13}/></button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                {activeProjects.slice(0,4).map(p=>(
                  <div key={p.id} style={{padding:"18px",borderRadius:16,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                      <div style={{flex:1,minWidth:0,paddingRight:8}}>
                        <h4 style={{fontSize:14,fontWeight:700,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</h4>
                        <p style={{fontSize:11,color:"rgba(255,255,255,.4)",margin:"3px 0 0"}}>{p.client}</p>
                      </div>
                      <span style={{fontSize:10,padding:"3px 9px",borderRadius:100,background:`${STATUS_COLOR[p.status]||OR}18`,color:STATUS_COLOR[p.status]||OR,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}>{p.status}</span>
                    </div>
                    <div style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,.35)",fontWeight:600}}>Progress</span>
                        <span style={{fontSize:11,color:OR,fontWeight:700}}>{p.progress}%</span>
                      </div>
                      <ProgressBar value={p.progress}/>
                    </div>
                    {p.deadline&&<p style={{fontSize:10,color:"rgba(255,255,255,.35)",margin:0}}>📅 {new Date(p.deadline).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</p>}
                  </div>
                ))}
                {activeProjects.length===0&&<div style={{padding:"32px",textAlign:"center",borderRadius:16,border:"2px dashed rgba(255,255,255,.08)",gridColumn:"1/-1"}}><p style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Tidak ada proyek aktif.</p></div>}
              </div>
            </div>

            {/* Urgent tasks */}
            {myTasks.length>0&&(
              <div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                  <h3 style={{fontSize:16,fontWeight:800,color:"#fff",margin:0}}>Tugas Mendesak</h3>
                  <button onClick={()=>setTab("tasks")} style={{fontSize:12,color:OR,background:"none",border:"none",cursor:"pointer",fontFamily:FONT,display:"flex",alignItems:"center",gap:4,fontWeight:600}}>Semua tugas <ChevronRight size={13}/></button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {myTasks.filter(t=>t.priority==="high"||overdueTasks.includes(t)).slice(0,4).map(t=>{
                    const sc=TASK_STATUS[t.status]||TASK_STATUS.todo;
                    const isOverdue=t.dueDate&&new Date(t.dueDate)<new Date();
                    return (
                      <div key={t.id} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:14,background:"rgba(255,255,255,.03)",border:`1px solid ${isOverdue?"rgba(248,113,113,.25)":"rgba(255,255,255,.07)"}`}}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontSize:13,fontWeight:600,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.title}</p>
                          <div style={{display:"flex",gap:8,marginTop:4}}>
                            {t.projectTitle&&<span style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{t.projectTitle}</span>}
                            {isOverdue&&<span style={{fontSize:10,color:"#f87171",fontWeight:600}}>⚠ Overdue</span>}
                          </div>
                        </div>
                        <span style={{fontSize:10,padding:"3px 9px",borderRadius:100,background:sc.bg,color:sc.color,fontWeight:700,flexShrink:0}}>{sc.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {tab==="calendar"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            {/* Simple Calendar Component */}
            <div style={{marginBottom:24}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Kalender Tim</h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Kelola jadwal, meeting, dan deadline.</p>
            </div>
            {/* Calendar UI (using react-calendar) */}
            <div style={{marginBottom:24}}>
              {/* Placeholder for calendar component */}
              <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"24px",textAlign:"center"}}>
                <p style={{color:"rgba(255,255,255,.4)"}}>📅 Calendar component will be placed here.</p>
              </div>
            </div>
            {/* List events for selected date (simplified) */}
            <div style={{marginBottom:24}}>
              <h3 style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:12}}>Acara Hari Ini</h3>
              {events.length===0?
                <p style={{color:"rgba(255,255,255,.3)"}}>Tidak ada acara.</p>
                :
                <ul style={{listStyle:"none",padding:0}}>
                  {events.map(ev=>(
                    <li key={ev.id} style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{color:"#fff",fontWeight:600}}>{ev.title}</span>
                        <span style={{color:"rgba(255,255,255,.6)"}}>{new Date(ev.date).toLocaleDateString("id-ID")}</span>
                      </div>
                      <p style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:4}}>{ev.description}</p>
                    </li>
                  ))}
                </ul>
              }
            </div>
          </div>
        )}
        {/* ── NOTES ── */}
        {tab==="notes"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{marginBottom:24}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Catatan & Rencana Konten</h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Buat, edit, dan hapus catatan untuk tim.</p>
            </div>
            {/* New Note Form */}
            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"20px",marginBottom:24}}>
              <h3 style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:12}}>Tambah Catatan Baru</h3>
              <input value={newNoteTitle} onChange={e=>setNewNoteTitle(e.target.value)} placeholder="Judul" style={{width:"100%",marginBottom:8,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT}}/>
              <textarea value={newNoteContent} onChange={e=>setNewNoteContent(e.target.value)} placeholder="Isi catatan..." rows={3}
                style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"8px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT,resize:"vertical"}}/>
              <button onClick={handleAddNote} disabled={!newNoteTitle.trim() && !newNoteContent.trim()}
                style={{marginTop:12,padding:"10px 16px",borderRadius:10,background:OR,color:"#fff",border:"none",cursor:"pointer",fontWeight:600}}>
                Tambah Catatan
              </button>
            </div>
            {/* Notes List */}
            {notes.length===0?
              <p style={{color:"rgba(255,255,255,.3)"}}>Tidak ada catatan.</p>
              :
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {notes.map(note=>(
                  <div key={note.id} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,padding:"16px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      {editingNoteId===note.id?
                        <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"6px 10px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT}}/>
                        :
                        <h4 style={{fontSize:16,fontWeight:700,color:"#fff",margin:0}}>{note.title}</h4>
                      }
                      <div style={{display:"flex",gap:6}}>
                        {editingNoteId===note.id?
                          <button onClick={()=>handleSaveEdit(note.id)} style={{background:OR,border:"none",color:"#fff",padding:"4px 8px",borderRadius:6,cursor:"pointer"}}>Simpan</button>
                          :
                          <button onClick={()=>startEdit(note)} style={{background:"rgba(255,255,255,.06)",border:"none",color:"rgba(255,255,255,.6)",padding:"4px 8px",borderRadius:6,cursor:"pointer"}}>Edit</button>
                        }
                        <button onClick={()=>handleDeleteNote(note.id)} style={{background:"rgba(248,113,113,.08)",border:"1px solid rgba(248,113,113,.15)",color:"#f87171",padding:"4px 8px",borderRadius:6,cursor:"pointer"}}>Hapus</button>
                      </div>
                    </div>
                    {editingNoteId===note.id?
                      <textarea value={editContent} onChange={e=>setEditContent(e.target.value)} rows={3}
                        style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT,resize:"vertical"}}/>
                      :
                      <p style={{fontSize:13,color:"rgba(255,255,255,.6)",margin:0,whiteSpace:"pre-wrap"}}>{note.content}</p>
                    }
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* ── PROJECTS ── */}
        {tab==="projects"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{marginBottom:24}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>All Projects</h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Semua proyek yang sedang berjalan</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {projects.map(p=>(
                <div key={p.id} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:18,padding:"20px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:10}}>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                        <h3 style={{fontSize:16,fontWeight:800,color:"#fff",margin:0}}>{p.title}</h3>
                        <span style={{fontSize:10,padding:"3px 10px",borderRadius:100,background:`${STATUS_COLOR[p.status]||OR}18`,color:STATUS_COLOR[p.status]||OR,fontWeight:700}}>{p.status}</span>
                        {p.priority==="high"&&<span style={{fontSize:10,color:OR,fontWeight:700}}>🔥 High</span>}
                      </div>
                      <p style={{fontSize:12,color:"rgba(255,255,255,.4)",margin:0}}>{p.client} {p.projectType&&`· ${p.projectType}`}</p>
                    </div>
                    {p.deadline&&<div style={{textAlign:"right"}}>
                      <p style={{fontSize:10,color:"rgba(255,255,255,.3)",margin:"0 0 2px",fontWeight:600}}>DEADLINE</p>
                      <p style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.7)",margin:0}}>{new Date(p.deadline).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</p>
                    </div>}
                  </div>

                  {/* Progress control */}
                  <div style={{marginBottom:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.45)"}}>Progress</span>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="range" min="0" max="100" value={p.progress} onChange={e=>updateProgress(p.id,Number(e.target.value))}
                          style={{width:120,accentColor:OR,cursor:"pointer"}}/>
                        <span style={{fontSize:13,fontWeight:800,color:p.progress>=100?"#4ade80":OR,minWidth:36,textAlign:"right"}}>{p.progress}%</span>
                      </div>
                    </div>
                    <ProgressBar value={p.progress} color={p.progress>=100?"#4ade80":OR}/>
                  </div>

                  {p.description&&<p style={{fontSize:12,color:"rgba(255,255,255,.4)",lineHeight:1.65,marginBottom:12}}>{p.description}</p>}
                  {p.driveUrl&&<a href={p.driveUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:9,background:"rgba(66,133,244,.1)",border:"1px solid rgba(66,133,244,.2)",color:"#60a5fa",textDecoration:"none",fontSize:12,fontWeight:600}}><FileText size={12}/> Open Drive</a>}
                </div>
              ))}
              {projects.length===0&&<div style={{padding:"48px",textAlign:"center",borderRadius:18,border:"2px dashed rgba(255,255,255,.08)"}}><p style={{color:"rgba(255,255,255,.3)",fontSize:14}}>Tidak ada proyek.</p></div>}
            </div>
          </div>
        )}

        {/* ── TASKS ── */}
        {tab==="tasks"&&(
          <div style={{animation:"fadeUp .4s ease"}}>
            <div style={{marginBottom:24}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>My Tasks</h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>{tasks.length} tugas total · {myTasks.length} belum selesai</p>
            </div>
            {Object.entries(TASK_STATUS).map(([statusKey,sc])=>{
              const statusTasks=tasks.filter(t=>t.status===statusKey);
              if(statusTasks.length===0)return null;
              return (
                <div key={statusKey} style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,padding:"8px 14px",borderRadius:10,background:sc.bg,width:"fit-content"}}>
                    <span style={{width:7,height:7,borderRadius:"50%",background:sc.color,display:"inline-block"}}/>
                    <span style={{fontSize:11,fontWeight:700,color:sc.color,letterSpacing:".08em",textTransform:"uppercase"}}>{sc.label}</span>
                    <span style={{fontSize:11,fontWeight:800,color:sc.color}}>{statusTasks.length}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {statusTasks.map(t=>{
                      const isOverdue=t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="done";
                      return (
                        <div key={t.id} style={{display:"flex",gap:14,padding:"14px 16px",borderRadius:14,background:"rgba(255,255,255,.03)",border:`1px solid ${isOverdue?"rgba(248,113,113,.2)":"rgba(255,255,255,.07)"}`,alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <span style={{fontSize:13,fontWeight:700,color:"#fff"}}>{t.title}</span>
                              <span style={{fontSize:9,padding:"2px 8px",borderRadius:100,background:`${PRIORITY_COLOR[t.priority]||OR}18`,color:PRIORITY_COLOR[t.priority]||OR,fontWeight:700}}>{t.priority}</span>
                              {isOverdue&&<span style={{fontSize:10,color:"#f87171",fontWeight:700}}>⚠ OVERDUE</span>}
                            </div>
                            {t.projectTitle&&<p style={{fontSize:11,color:"rgba(255,255,255,.35)",margin:0}}>{t.projectTitle}</p>}
                            {t.description&&<p style={{fontSize:12,color:"rgba(255,255,255,.4)",margin:"6px 0 0",lineHeight:1.5}}>{t.description}</p>}
                            {t.dueDate&&<p style={{fontSize:10,color:"rgba(255,255,255,.35)",margin:"6px 0 0"}}>📅 Due: {new Date(t.dueDate).toLocaleDateString("id-ID")}</p>}
                          </div>
                          {/* Status changer */}
                          <select value={t.status} onChange={e=>updateTaskStatus(t.id,e.target.value)}
                            style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"6px 10px",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FONT,outline:"none",flexShrink:0}}>
                            {Object.entries(TASK_STATUS).map(([k,v])=><option key={k} value={k} style={{background:"#111318"}}>{v.label}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {tasks.length===0&&<div style={{padding:"48px",textAlign:"center",borderRadius:18,border:"2px dashed rgba(255,255,255,.08)"}}><p style={{color:"rgba(255,255,255,.3)",fontSize:14}}>Tidak ada tugas.</p></div>}
          </div>
        )}

        {/* ── CHAT ── */}
        {tab==="chat"&&(
          <div style={{animation:"fadeUp .4s ease",height:"calc(100vh - 160px)",display:"flex",flexDirection:"column"}}>
            <div style={{marginBottom:16}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Team Chat</h2>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{width:7,height:7,borderRadius:"50%",background:"#4ade80",display:"inline-block",animation:"pulse 2s infinite"}}/>
                <p style={{fontSize:12,color:"rgba(255,255,255,.35)",margin:0}}>Live · refresh otomatis setiap 5 detik</p>
              </div>
            </div>
            <style>{`@keyframes pulse{0%,100%{opacity:.6;}50%{opacity:1;}}`}</style>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"4px 0",marginBottom:12}}>
              {messages.length===0&&<div style={{textAlign:"center",padding:"40px 0"}}><MessageSquare size={32} color="rgba(255,255,255,.1)" style={{margin:"0 auto 10px"}}/><p style={{color:"rgba(255,255,255,.3)",fontSize:13}}>Belum ada pesan. Mulai percakapan!</p></div>}
              {messages.map((m,i)=>{
                const isMe=m.senderId===user.id;
                const showDate=i===0||new Date(m.createdAt).toDateString()!==new Date(messages[i-1].createdAt).toDateString();
                return (
                  <div key={m.id}>
                    {showDate&&<div style={{textAlign:"center",margin:"16px 0 10px"}}><span style={{fontSize:10,color:"rgba(255,255,255,.25)",background:"rgba(255,255,255,.05)",padding:"3px 12px",borderRadius:100,fontWeight:600}}>{new Date(m.createdAt).toLocaleDateString("id-ID",{day:"numeric",month:"long"})}</span></div>}
                    <div style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",marginBottom:10}}>
                      {!isMe&&<div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                        <div style={{width:18,height:18,borderRadius:"50%",background:OR+"22",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:OR,fontSize:9,fontWeight:800}}>{m.senderName.charAt(0)}</span></div>
                        <span style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.5)"}}>{m.senderName} · <span style={{color:OR,fontSize:10}}>{m.senderRole}</span></span>
                      </div>}
                      {m.content&&<div style={{maxWidth:"80%",padding:"10px 14px",borderRadius:isMe?"16px 16px 4px 16px":"4px 16px 16px 16px",background:isMe?OR:"rgba(255,255,255,.07)",color:"#fff",fontSize:13,lineHeight:1.6,wordBreak:"break-word"}}>{m.content}</div>}
                      {m.fileUrl&&<a href={m.fileUrl} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:10,background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.2)",color:"#60a5fa",textDecoration:"none",fontSize:12,fontWeight:600,marginTop:4}}><Download size={12}/>{m.fileName||"Download File"}</a>}
                      <span style={{fontSize:9,color:"rgba(255,255,255,.2)",marginTop:3}}>{new Date(m.createdAt).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottom}/>
            </div>

            {/* Input */}
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:16,padding:"12px 14px"}}>
              {file&&<div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 10px",borderRadius:8,background:"rgba(255,255,255,.05)"}}>
                <Paperclip size={11} color={OR}/><span style={{fontSize:11,color:"rgba(255,255,255,.6)",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{file.name}</span>
                <button onClick={()=>setFile(null)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.4)",display:"flex",alignItems:"center"}}><X size={12}/></button>
              </div>}
              <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                <button onClick={()=>fileRef.current?.click()} title="Attach file" style={{width:34,height:34,borderRadius:9,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.09)",cursor:"pointer",color:"rgba(255,255,255,.45)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Paperclip size={14}/></button>
                <input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>setFile(e.target.files?.[0]||null)}/>
                <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Ketik pesan... (Enter kirim)" rows={1}
                  style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.09)",borderRadius:10,padding:"9px 12px",color:"#fff",fontSize:13,resize:"none",outline:"none",fontFamily:FONT,lineHeight:1.5,maxHeight:80,scrollbarWidth:"none" as any}}
                  onInput={e=>{const t=e.target as HTMLTextAreaElement;t.style.height="auto";t.style.height=Math.min(t.scrollHeight,80)+"px";}}/>
                <button onClick={sendMessage} disabled={(!chatInput.trim()&&!file)||sending}
                  style={{width:34,height:34,borderRadius:9,background:chatInput.trim()||file?OR:"rgba(255,255,255,.08)",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {sending?<span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite",display:"inline-block"}}/>:<Send size={14} color={chatInput.trim()||file?"#fff":"rgba(255,255,255,.3)"}/>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── UPLOAD ── */}
        {tab==="upload"&&(
          <div style={{animation:"fadeUp .4s ease",maxWidth:560}}>
            <div style={{marginBottom:28}}>
              <h2 style={{fontSize:28,fontWeight:900,color:"#fff",letterSpacing:"-.03em",margin:"0 0 4px"}}>Upload File</h2>
              <p style={{fontSize:12,color:"rgba(255,255,255,.35)"}}>Upload hasil kerja, referensi, atau asset project</p>
            </div>

            <div style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.09)",borderRadius:22,padding:"32px"}}>
              {/* Drop zone */}
              <div onClick={()=>document.getElementById("crew-file-input")?.click()}
                onDragOver={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor=OR;}}
                onDragLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,.12)";}}
                onDrop={e=>{e.preventDefault();(e.currentTarget as HTMLElement).style.borderColor="rgba(255,255,255,.12)";const f=e.dataTransfer.files[0];if(f)setUploadFile(f);}}
                style={{border:"2px dashed rgba(255,255,255,.12)",borderRadius:16,padding:"40px 24px",textAlign:"center",cursor:"pointer",transition:"border-color .2s",marginBottom:20}}>
                <Upload size={32} color="rgba(255,255,255,.2)" style={{margin:"0 auto 12px"}}/>
                {uploadFile?(
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:"#fff",margin:"0 0 4px"}}>{uploadFile.name}</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.4)",margin:0}}>{(uploadFile.size/1024/1024).toFixed(2)} MB</p>
                  </div>
                ):(
                  <>
                    <p style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,.5)",margin:"0 0 6px"}}>Drop file di sini atau klik untuk pilih</p>
                    <p style={{fontSize:12,color:"rgba(255,255,255,.3)",margin:0}}>Semua format didukung · Max 50MB</p>
                  </>
                )}
                <input id="crew-file-input" type="file" style={{display:"none"}} onChange={e=>setUploadFile(e.target.files?.[0]||null)}/>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:24}}>
                <div>
                  <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:7}}>Label / Deskripsi</label>
                  <input value={uploadLabel} onChange={e=>setUploadLabel(e.target.value)} placeholder="e.g. Raw footage hari 1" style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box" as any,fontFamily:FONT}}/>
                </div>
                <div>
                  <label style={{display:"block",fontSize:10,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.35)",marginBottom:7}}>Project (opsional)</label>
                  <select value={uploadProjId} onChange={e=>setUploadProjId(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",fontFamily:FONT,cursor:"pointer"}}>
                    <option value="" style={{background:"#111318"}}>— Tidak terkait project tertentu —</option>
                    {projects.map(p=><option key={p.id} value={p.id} style={{background:"#111318"}}>{p.title}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={handleUpload} disabled={!uploadFile||uploading}
                style={{width:"100%",padding:"14px",borderRadius:12,background:uploadFile?OR:"rgba(255,255,255,.08)",border:"none",color:"#fff",fontWeight:800,fontSize:14,cursor:uploadFile?"pointer":"not-allowed",fontFamily:FONT,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:uploading?0.7:1}}>
                {uploading?<><span style={{width:14,height:14,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite",display:"inline-block"}}/> Uploading...</>:<><Upload size={15}/> Upload File</>}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Floating AI Chat */}
      <AIChat dark={true}/>
    </div>
  );
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export default function CrewDashboardPage() {
  const [token, setToken] = useState(getCrewToken());
  const [user,  setUser]  = useState<CrewUser|null>(getCrewUser());

  function handleLogin(token:string, user:CrewUser) {
    setToken(token); setUser(user);
  }
  function handleLogout() {
    localStorage.removeItem("crew_token");
    localStorage.removeItem("crew_user");
    setToken(null); setUser(null);
  }

  if(!token||!user) return <CrewLogin onLogin={handleLogin}/>;
  return <CrewDashboard user={user} onLogout={handleLogout}/>;
}
// artifacts/frameless/src/pages/clients.tsx
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { Plus, Search, X, Trash2, Phone, Mail, Globe, MapPin, Building2, TrendingUp, DollarSign, Star, Edit3, ChevronRight, ExternalLink } from "lucide-react";

const OR = "#FF6A20";
const FONT = "'Plus Jakarta Sans',sans-serif";

interface Client {
  id: string; name: string; email?: string; phone?: string; company?: string;
  address?: string; website?: string; notes?: string; status?: string;
  totalRevenue?: number; projectCount?: number; tier?: string; createdAt: string;
}
interface Project { id: string; title: string; status: string; budget?: number; deadline?: string; projectType?: string; }

async function api(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers as any || {}) },
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return r.json();
}

const TIERS = [{ k: "vip", l: "VIP", c: "#fbbf24" }, { k: "regular", l: "Regular", c: "#60a5fa" }, { k: "new", l: "New", c: "#4ade80" }];
const STATUSES = [{ k: "active", l: "Active", c: "#4ade80" }, { k: "inactive", l: "Inactive", c: "rgba(255,255,255,.35)" }, { k: "prospect", l: "Prospect", c: "#a78bfa" }];
const STATUS_CLR: Record<string, string> = { active: "#4ade80", completed: "#60a5fa", on_hold: "#fbbf24", planning: "#a78bfa" };

function ClientModal({ client, onClose, onSave }: { client: Client | null; onClose: () => void; onSave: (d: Partial<Client>) => Promise<void> }) {
  const [form, setForm] = useState<Partial<Client>>(client || { status: "prospect", tier: "new" });
  const [saving, setSaving] = useState(false);
  const f = (k: keyof Client, v: any) => setForm(p => ({ ...p, [k]: v }));
  const ipt = { width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT, boxSizing: "border-box" as any, transition: "border-color .2s" };
  async function save() { if (!form.name) return; setSaving(true); try { await onSave(form); } finally { setSaving(false); } }
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", backdropFilter: "blur(12px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "#111318", border: "1px solid rgba(255,255,255,.1)", borderRadius: 24, padding: "34px 30px", width: "100%", maxWidth: 540, position: "relative", maxHeight: "90vh", overflowY: "auto" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        <h3 style={{ fontSize: 21, fontWeight: 800, color: "#fff", marginBottom: 24, letterSpacing: "-.02em" }}>{client ? "Edit Client" : "New Client"}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {[
            { k: "name", l: "Nama / Brand *", full: true, ph: "PT Maju Bersama / John Doe" },
            { k: "company", l: "Perusahaan", ph: "Nama perusahaan" },
            { k: "email", l: "Email", t: "email", ph: "kontak@perusahaan.com" },
            { k: "phone", l: "Telepon / WA", t: "tel", ph: "+62 8xx-xxxx-xxxx" },
            { k: "website", l: "Website", ph: "https://perusahaan.com" },
            { k: "address", l: "Kota / Alamat", ph: "Jakarta, Indonesia" },
          ].map((field: any) => (
            <div key={field.k} style={{ gridColumn: field.full ? "1/-1" : "auto" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>{field.l}</label>
              <input type={field.t || "text"} value={(form as any)[field.k] || ""} onChange={e => f(field.k, e.target.value)} placeholder={field.ph || ""} style={ipt}
                onFocus={e => (e.target as HTMLElement).style.borderColor = `${OR}66`}
                onBlur={e => (e.target as HTMLElement).style.borderColor = "rgba(255,255,255,.1)"} />
            </div>
          ))}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Tier</label>
            <select value={form.tier || "new"} onChange={e => f("tier", e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
              {TIERS.map(o => <option key={o.k} value={o.k} style={{ background: "#111318" }}>{o.l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Status</label>
            <select value={form.status || "prospect"} onChange={e => f("status", e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
              {STATUSES.map(o => <option key={o.k} value={o.k} style={{ background: "#111318" }}>{o.l}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Catatan Internal</label>
            <textarea value={form.notes || ""} onChange={e => f("notes", e.target.value)} rows={3} placeholder="Preferensi klien, history penting, kontak PIC, dll..." style={{ ...ipt, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Cancel</button>
          <button onClick={save} disabled={saving || !form.name} style={{ padding: "10px 22px", borderRadius: 10, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : (client ? "Update" : "Add Client")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Client detail drawer
function ClientDrawer({ client, projects, onClose, onEdit }: { client: Client; projects: Project[]; onClose: () => void; onEdit: () => void }) {
  const tier = TIERS.find(t => t.k === client.tier) || TIERS[2];
  const stat = STATUSES.find(s => s.k === client.status) || STATUSES[0];
  const clientProjects = projects.filter(p => (p as any).client === client.name || (p as any).clientId === client.id);
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", backdropFilter: "blur(8px)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "min(96vw,480px)", background: "#111318", height: "100%", overflowY: "auto", borderLeft: "1px solid rgba(255,255,255,.1)", padding: "28px 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: `${OR}22`, border: `2px solid ${OR}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: OR, fontWeight: 900, fontSize: 18 }}>{client.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-.02em" }}>{client.name}</h2>
              {client.company && <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", margin: "2px 0 0" }}>{client.company}</p>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={onEdit} style={{ width: 32, height: 32, borderRadius: 9, background: `${OR}22`, border: `1px solid ${OR}44`, cursor: "pointer", color: OR, display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={13} /></button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>
          <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 100, background: `${tier.c}18`, color: tier.c, fontWeight: 700, border: `1px solid ${tier.c}33` }}>⭐ {tier.l}</span>
          <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 100, background: `${stat.c}18`, color: stat.c, fontWeight: 700, border: `1px solid ${stat.c}33` }}>{stat.l}</span>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
          {[
            { l: "Total Revenue", v: client.totalRevenue ? formatCurrency(client.totalRevenue) : "—", c: "#4ade80" },
            { l: "Total Projects", v: (client.projectCount || clientProjects.length || 0).toString(), c: OR },
          ].map(s => (
            <div key={s.l} style={{ padding: "14px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 5px" }}>{s.l}</p>
              <p style={{ fontSize: 20, fontWeight: 900, color: s.c, margin: 0 }}>{s.v}</p>
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div style={{ background: "rgba(255,255,255,.025)", borderRadius: 16, padding: "16px", marginBottom: 22, border: "1px solid rgba(255,255,255,.07)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 12 }}>Kontak</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {client.email && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Mail size={12} color={OR} /><a href={`mailto:${client.email}`} style={{ fontSize: 13, color: "rgba(255,255,255,.65)", textDecoration: "none" }}>{client.email}</a></div>}
            {client.phone && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Phone size={12} color={OR} /><a href={`tel:${client.phone}`} style={{ fontSize: 13, color: "rgba(255,255,255,.65)", textDecoration: "none" }}>{client.phone}</a></div>}
            {client.address && <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}><MapPin size={12} color={OR} style={{ marginTop: 2, flexShrink: 0 }} /><span style={{ fontSize: 13, color: "rgba(255,255,255,.55)" }}>{client.address}</span></div>}
            {client.website && <div style={{ display: "flex", alignItems: "center", gap: 9 }}><Globe size={12} color={OR} /><a href={client.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: "#60a5fa", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>{client.website} <ExternalLink size={10} /></a></div>}
          </div>
        </div>

        {/* Projects */}
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 12 }}>Projects</p>
          {clientProjects.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.25)" }}>Belum ada proyek terdaftar.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {clientProjects.map(p => (
                <div key={p.id} style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{p.title}</p>
                    {p.deadline && <p style={{ fontSize: 11, color: "rgba(255,255,255,.35)", margin: "2px 0 0" }}>📅 {new Date(p.deadline).toLocaleDateString("id-ID")}</p>}
                  </div>
                  <span style={{ fontSize: 10, padding: "3px 9px", borderRadius: 100, background: `${STATUS_CLR[p.status] || OR}18`, color: STATUS_CLR[p.status] || OR, fontWeight: 700 }}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {client.notes && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".14em", marginBottom: 8 }}>Catatan Internal</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,.5)", lineHeight: 1.7, padding: "12px 14px", background: "rgba(255,255,255,.03)", borderRadius: 12 }}>{client.notes}</p>
          </div>
        )}

        {/* Quick actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {client.phone && <a href={`https://wa.me/${client.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 12, background: "#25D366", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>💬 WhatsApp</a>}
          {client.email && <a href={`mailto:${client.email}`} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px", borderRadius: 12, border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.7)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}><Mail size={14} /> Email</a>}
        </div>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTier, setFilterTier] = useState("all");
  const [modal, setModal] = useState<Client | null | "new">(null);
  const [detail, setDetail] = useState<Client | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cl, pr] = await Promise.all([
        api("/api/clients").catch(() => []),
        api("/api/projects").catch(() => []),
      ]);
      setClients(Array.isArray(cl) ? cl : []);
      setProjects(Array.isArray(pr) ? pr : []);
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Partial<Client>) {
    try {
      if ((modal as Client)?.id) {
        await api(`/api/clients/${(modal as Client).id}`, { method: "PATCH", body: JSON.stringify(data) });
        toast({ title: "Client updated" });
      } else {
        await api("/api/clients", { method: "POST", body: JSON.stringify(data) });
        toast({ title: "Client added" });
      }
      setModal(null); load();
    } catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Hapus client ini?")) return;
    try { await api(`/api/clients/${id}`, { method: "DELETE" }); toast({ title: "Client deleted" }); load(); }
    catch (e: any) { toast({ variant: "destructive", title: "Error", description: e.message }); }
  }

  const filtered = clients.filter(c => {
    const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.company || "").toLowerCase().includes(search.toLowerCase()) || (c.email || "").toLowerCase().includes(search.toLowerCase());
    const mt = filterTier === "all" || c.tier === filterTier;
    return ms && mt;
  });

  // Stats
  const stats = {
    total: clients.length,
    active: clients.filter(c => c.status === "active").length,
    vip: clients.filter(c => c.tier === "vip").length,
    revenue: clients.reduce((s, c) => s + (c.totalRevenue || 0), 0),
  };

  const ipt = { background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, outline: "none", fontFamily: FONT };

  return (
    <div style={{ fontFamily: FONT, color: "#f0f0f0", paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-.03em", margin: "0 0 4px" }}>Clients</h1>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".14em", fontWeight: 600 }}>CRM · Manajemen Klien Frameless</p>
        </div>
        <button onClick={() => setModal("new")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 12, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
          <Plus size={15} /> New Client
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { l: "Total Clients", v: stats.total, c: OR, icon: <Building2 size={14} /> },
          { l: "Active", v: stats.active, c: "#4ade80", icon: <TrendingUp size={14} /> },
          { l: "VIP", v: stats.vip, c: "#fbbf24", icon: <Star size={14} /> },
          { l: "Total Revenue", v: formatCurrency(stats.revenue), c: "#60a5fa", icon: <DollarSign size={14} /> },
        ].map(s => (
          <div key={s.l} style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".12em", margin: 0 }}>{s.l}</p>
              <span style={{ color: s.c }}>{s.icon}</span>
            </div>
            <p style={{ fontSize: 22, fontWeight: 900, color: s.c, margin: 0, letterSpacing: "-.02em" }}>{s.v}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 22, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.35)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, perusahaan, email..." style={{ ...ipt, width: "100%", paddingLeft: 36, boxSizing: "border-box" }} />
        </div>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)} style={{ ...ipt, cursor: "pointer" }}>
          <option value="all" style={{ background: "#111318" }}>All Tier</option>
          {TIERS.map(t => <option key={t.k} value={t.k} style={{ background: "#111318" }}>{t.l}</option>)}
        </select>
      </div>

      {/* Loading */}
      {loading && <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><div style={{ width: 32, height: 32, borderRadius: "50%", border: `3px solid ${OR}`, borderTopColor: "transparent", animation: "spin .7s linear infinite" }} /><style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style></div>}

      {/* Grid */}
      {!loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
          {filtered.map(c => {
            const tier = TIERS.find(t => t.k === c.tier) || TIERS[2];
            const stat = STATUSES.find(s => s.k === c.status) || STATUSES[0];
            const cProj = projects.filter(p => (p as any).client === c.name).length;
            return (
              <div key={c.id} onClick={() => setDetail(c)}
                style={{ background: "rgba(255,255,255,.025)", border: `1px solid ${c.tier === "vip" ? "rgba(251,191,36,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 20, padding: "20px", cursor: "pointer", transition: "border-color .2s,transform .2s,box-shadow .2s" }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.tier === "vip" ? "rgba(251,191,36,.4)" : `${OR}44`; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 8px 32px rgba(0,0,0,.3)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = c.tier === "vip" ? "rgba(251,191,36,.2)" : "rgba(255,255,255,.07)"; el.style.transform = "translateY(0)"; el.style.boxShadow = "none"; }}>
                {/* Avatar + Name */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: `${OR}22`, border: `2px solid ${OR}33`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: OR, fontWeight: 900, fontSize: 17 }}>{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</h3>
                    {c.company && <p style={{ fontSize: 12, color: "rgba(255,255,255,.4)", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.company}</p>}
                  </div>
                  <div style={{
                    display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 100, background: `${tier.c}18`, color: tier.c, fontWeight: 700 }}>{tier.l}</span>
                    <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 100, background: `${stat.c}18`, color: stat.c, fontWeight: 700, marginTop: 3 }}>{stat.l}</span>
                  </div>
                </div>

                {/* Contact */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {c.email && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,.45)" }}><Mail size={11} color={OR} />{c.email}</div>}
        {c.phone && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,.45)" }}><Phone size={11} color={OR} />{c.phone}</div>}
        {c.address && <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,.45)" }}><MapPin size={11} color={OR} />{c.address}</div>}
      </div>

      {/* Footer */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 14 }}>
          {c.totalRevenue && <div><p style={{ fontSize: 9, color: "rgba(255,255,255,.3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".1em" }}>Revenue</p><p style={{ fontSize: 13, fontWeight: 700, color: "#4ade80", margin: 0 }}>{formatCurrency(c.totalRevenue)}</p></div>}
          <div><p style={{ fontSize: 9, color: "rgba(255,255,255,.3)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".1em" }}>Projects</p><p style={{ fontSize: 13, fontWeight: 700, color: OR, margin: 0 }}>{cProj || c.projectCount || 0}</p></div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={e => { e.stopPropagation(); setModal(c); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.06)", border: "none", cursor: "pointer", color: "rgba(255,255,255,.5)", display: "flex", alignItems: "center", justifyContent: "center" }}><Edit3 size={12} /></button>
          <button onClick={e => { e.stopPropagation(); handleDelete(c.id); }} style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(248,113,113,.1)", border: "none", cursor: "pointer", color: "#f87171", display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
})}
{
  filtered.length === 0 && !loading && (
    <div style={{ gridColumn: "1/-1", padding: "56px", textAlign: "center", borderRadius: 20, border: "2px dashed rgba(255,255,255,.08)" }}>
      <Building2 size={40} color="rgba(255,255,255,.1)" style={{ margin: "0 auto 12px" }} />
      <p style={{ color: "rgba(255,255,255,.3)", fontSize: 14 }}>Tidak ada client ditemukan.</p>
      <button onClick={() => setModal("new")} style={{ marginTop: 14, padding: "9px 20px", borderRadius: 10, background: OR, border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>+ Tambah Client Baru</button>
    </div>
  )
}
        </div >
      )}

{ modal && <ClientModal client={modal === "new" ? null : modal as Client} onClose={() => setModal(null)} onSave={handleSave} /> }
{ detail && <ClientDrawer client={detail} projects={projects} onClose={() => setDetail(null)} onEdit={() => { setModal(detail); setDetail(null); }} /> }
    </div >
  );
}
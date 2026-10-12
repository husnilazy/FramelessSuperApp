// artifacts/frameless/src/components/invoice-notifications.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { formatCurrency } from "@/lib/formatters";
import { getToken } from "@/lib/auth";
import { Bell, AlertCircle, Clock, X, Receipt } from "lucide-react";

const OR = "hsl(var(--primary))";
const FONT = "'Plus Jakarta Sans',sans-serif";

async function api(path: string) {
  const token = getToken();
  const r = await fetch(path, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!r.ok) throw new Error("Request gagal");
  return r.json();
}

interface NotifInvoice {
  id: string;
  number: string;
  total: number;
  paidAmount: number;
  dueDate: string;
  daysOverdue?: number;
  daysUntilDue?: number;
  type: "overdue" | "due_soon";
}

interface NotifData {
  overdue: NotifInvoice[];
  dueSoon: NotifInvoice[];
  totalOverdueAmount: number;
  totalDueSoonAmount: number;
}

// Poll interval: 5 minutes — frequent enough to feel "live" without hammering the API
const POLL_MS = 5 * 60 * 1000;

export function InvoiceNotificationBell() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifData | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await api("/api/invoices/notifications");
      setData(result);
    } catch {
      // Silent fail — notifications are non-critical; don't disrupt the UI.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const overdueCount = data?.overdue.length || 0;
  const dueSoonCount = data?.dueSoon.length || 0;
  const totalCount = overdueCount + dueSoonCount;

  function goToInvoice(id: string) {
    setOpen(false);
    navigate(`/invoices/${id}`);
  }

  return (
    <div ref={ref} style={{ position: "relative", fontFamily: FONT }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative", width: 38, height: 38, borderRadius: 10,
          background: "rgb(var(--ink) / .06)", border: "1px solid rgb(var(--ink) / .1)",
          cursor: "pointer", color: "rgb(var(--ink) / calc(.6 + var(--ink-boost)))",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Bell size={16} />
        {totalCount > 0 && (
          <span style={{
            position: "absolute", top: -4, right: -4, minWidth: 16, height: 16,
            borderRadius: 8, background: overdueCount > 0 ? "var(--c-red)" : "var(--c-amber)",
            color: "hsl(var(--foreground))", fontSize: 9, fontWeight: 800,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 4px", border: "2px solid #0c0e16",
          }}>
            {totalCount > 9 ? "9+" : totalCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: 46, right: 0, width: 360, maxHeight: 480,
          background: "hsl(var(--card))", border: "1px solid rgb(var(--ink) / .1)",
          borderRadius: 16, boxShadow: "0 20px 50px rgba(0,0,0,.5)",
          zIndex: 100, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid rgb(var(--ink) / .07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "hsl(var(--foreground))", margin: 0 }}>Notifikasi Invoice</p>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "rgb(var(--ink) / calc(.4 + var(--ink-boost)))", cursor: "pointer", padding: 2 }}><X size={14} /></button>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <p style={{ padding: "32px 18px", textAlign: "center", color: "rgb(var(--ink) / calc(.3 + var(--ink-boost)))", fontSize: 12 }}>Memuat...</p>
            ) : totalCount === 0 ? (
              <div style={{ padding: "40px 18px", textAlign: "center" }}>
                <Receipt size={28} color="rgb(var(--ink) / .1)" style={{ margin: "0 auto 10px" }} />
                <p style={{ color: "rgb(var(--ink) / calc(.3 + var(--ink-boost)))", fontSize: 12 }}>Tidak ada invoice jatuh tempo atau terlambat. 👍</p>
              </div>
            ) : (
              <>
                {overdueCount > 0 && (
                  <div>
                    <p style={{ padding: "10px 18px 6px", fontSize: 10, fontWeight: 700, color: "var(--c-red)", textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>
                      Terlambat ({overdueCount}) · {formatCurrency(data!.totalOverdueAmount)}
                    </p>
                    {data!.overdue.map(inv => (
                      <button key={inv.id} onClick={() => goToInvoice(inv.id)}
                        style={{ width: "100%", textAlign: "left", padding: "10px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid rgb(var(--ink) / .04)" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(248,113,113,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <AlertCircle size={13} color="var(--c-red)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", margin: 0 }}>{inv.number}</p>
                          <p style={{ fontSize: 11, color: "var(--c-red)", margin: "2px 0 0" }}>
                            Terlambat {inv.daysOverdue} hari · {formatCurrency(inv.total - inv.paidAmount)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {dueSoonCount > 0 && (
                  <div>
                    <p style={{ padding: "10px 18px 6px", fontSize: 10, fontWeight: 700, color: "var(--c-amber)", textTransform: "uppercase", letterSpacing: ".1em", margin: 0 }}>
                      Segera Jatuh Tempo ({dueSoonCount}) · {formatCurrency(data!.totalDueSoonAmount)}
                    </p>
                    {data!.dueSoon.map(inv => (
                      <button key={inv.id} onClick={() => goToInvoice(inv.id)}
                        style={{ width: "100%", textAlign: "left", padding: "10px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start", borderBottom: "1px solid rgb(var(--ink) / .04)" }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,191,36,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Clock size={13} color="var(--c-amber)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", margin: 0 }}>{inv.number}</p>
                          <p style={{ fontSize: 11, color: "var(--c-amber)", margin: "2px 0 0" }}>
                            {inv.daysUntilDue === 0 ? "Jatuh tempo hari ini" : `${inv.daysUntilDue} hari lagi`} · {formatCurrency(inv.total - inv.paidAmount)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {totalCount > 0 && (
            <button onClick={() => { setOpen(false); navigate("/invoices"); }}
              style={{ padding: "11px 18px", background: `color-mix(in srgb, ${OR} 7%, transparent)`, border: "none", borderTop: "1px solid rgb(var(--ink) / .07)", color: OR, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
              Lihat Semua Invoice →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
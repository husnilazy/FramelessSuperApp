// PATH SARAN: apps/web/src/components/filmmaking/shared/usePresence.ts
import { useEffect, useRef, useState } from "react";

export interface ActiveCollaborator {
  userId: string;
  userName: string;
  lastSeen: string;
}

interface CurrentUser {
  id: string;
  name: string;
}

/**
 * Decode payload JWT tanpa verifikasi (cuma untuk ambil id/name buat presence,
 * BUKAN untuk keperluan auth/security).
 * Kalau format token di project kamu beda, sesuaikan fungsi ini saja.
 */
function decodeCurrentUser(token: string | null): CurrentUser | null {
  if (!token) return null;
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;
    const json = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json);
    const id = payload.id || payload.userId || payload.sub || payload.crewId;
    const name = payload.name || payload.userName || payload.email || "Crew";
    if (!id) return null;
    return { id: String(id), name: String(name) };
  } catch {
    return null;
  }
}

const PING_INTERVAL_MS = 20_000;

/**
 * Hook presence: ping server secara berkala selagi user membuka dokumen,
 * dan poll siapa saja collaborator lain yang sedang aktif.
 * Aman dipakai walau token/format berbeda — kalau user tidak terdeteksi,
 * hook ini diam saja (tidak melempar error, tidak mem-block UI).
 */
export function usePresence(documentId: string | null, getToken: () => string | null) {
  const [activeUsers, setActiveUsers] = useState<ActiveCollaborator[]>([]);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!documentId) return;

    const token = getToken();
    const currentUser = decodeCurrentUser(token);
    if (!currentUser) return; // tidak bisa deteksi identitas user, skip presence diam-diam

    let cancelled = false;

    const ping = async () => {
      try {
        await fetch(`/api/filmmaking-collaboration/ping/${documentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: currentUser.id, userName: currentUser.name }),
        });

        const res = await fetch(`/api/filmmaking-collaboration/active/${documentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const list: ActiveCollaborator[] = await res.json();
          setActiveUsers(list.filter((u) => u.userId !== currentUser.id));
        }
      } catch {
        // Diam-diam gagal — presence bukan fitur kritikal, jangan ganggu UX editor
      }
    };

    ping();
    intervalRef.current = setInterval(ping, PING_INTERVAL_MS);

    const leave = () => {
      const url = `/api/filmmaking-collaboration/leave/${documentId}`;
      const payload = JSON.stringify({ userId: currentUser.id });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", leave);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [documentId]);

  return activeUsers;
}
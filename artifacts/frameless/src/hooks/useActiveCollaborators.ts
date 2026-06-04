import { useState, useEffect, useCallback } from "react";

interface ActiveCollaborator {
  userId: string;
  userName: string;
  lastSeen: Date;
}

export function useActiveCollaborators(documentId: string, userId: string, userName: string) {
  const [activeCollaborators, setActiveCollaborators] = useState<
    ActiveCollaborator[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pingInterval, setPingInterval] = useState<NodeJS.Timeout | null>(null);

  // Fetch active collaborators
  const fetchActive = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/filmmaking-collaboration/active/${documentId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to fetch active collaborators");
      const data = await response.json();
      setActiveCollaborators(
        data.filter((col: any) => col.userId !== userId)
      );
    } catch (err) {
      console.error("Failed to fetch active collaborators:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [documentId, userId]);

  // Send presence ping to server
  const sendPing = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/filmmaking-collaboration/ping/${documentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, userName }),
      });
      // Fetch updated list after ping
      fetchActive();
    } catch (err) {
      console.error("Failed to send presence ping:", err);
    }
  }, [documentId, userId, userName, fetchActive]);

  // Notify server when leaving
  const notifyLeave = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`/api/filmmaking-collaboration/leave/${documentId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });
    } catch (err) {
      console.error("Failed to notify leave:", err);
    }
  }, [documentId, userId]);

  // Set up ping interval and cleanup
  useEffect(() => {
    if (!documentId || !userId) return;

    // Initial fetch
    fetchActive();

    // Ping every 10 seconds to keep presence active
    const interval = setInterval(sendPing, 10000);
    setPingInterval(interval);

    // Notify server when component unmounts
    return () => {
      clearInterval(interval);
      notifyLeave();
    };
  }, [documentId, userId, sendPing, fetchActive, notifyLeave]);

  return {
    activeCollaborators,
    loading,
    error,
    sendPing,
  };
}

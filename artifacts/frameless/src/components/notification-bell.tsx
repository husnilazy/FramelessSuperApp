import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Info, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useAuth, getToken } from "@/lib/auth";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  createdAt: string;
  referenceId?: string | null;
  referenceType?: string | null;
};

export function NotificationBell({ 
  variant = "admin",
  onNotificationClick 
}: { 
  variant?: "admin" | "crew";
  onNotificationClick?: (notif: Notification) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const fetchUrl = variant === "admin" ? "/api/admin/notifications" : "/api/crew/notifications";
  const readUrl = (id: string) => variant === "admin" ? `/api/admin/notifications/${id}/read` : `/api/crew/notifications/${id}/read`;
  const tokenGetter = variant === "admin" ? getToken : () => localStorage.getItem("crew_token");

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", variant],
    queryFn: async () => {
      const token = tokenGetter();
      if (!token) return [];
      const res = await fetch(fetchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        // Bad/expired crew token — stop spamming and let user re-login
        if (variant === "crew") {
          try { localStorage.removeItem("crew_token"); localStorage.removeItem("crew_user"); } catch {}
        }
        return [];
      }
      if (!res.ok) return [];
      return res.json().catch(() => []);
    },
    refetchInterval: 30000, // Poll every 30s (less aggressive)
    retry: false,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const token = tokenGetter();
      if (!token) return;
      await fetch(readUrl(id), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", variant] });
    }
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Play notification sound + optional TTS (Apple-like pleasant experience)
  const prevNotificationsRef = useRef<Notification[]>([]);
  useEffect(() => {
    if (notifications.length === 0) {
      prevNotificationsRef.current = notifications;
      return;
    }

    const prevIds = new Set(prevNotificationsRef.current.map(n => n.id));
    const newNotifs = notifications.filter(n => !prevIds.has(n.id) && !n.isRead);

    if (newNotifs.length > 0 && document.visibilityState === 'visible') {
      // Simple pleasant notification tone (Web Audio API - no external files)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        gain.gain.value = 0.08;

        const duration = 0.18;
        gain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

        oscillator.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + duration + 0.05);
      } catch {}

      // AI Voice - speak the notification (fun feature)
      if ('speechSynthesis' in window) {
        const latest = newNotifs[0];
        const text = `${latest.title}. ${latest.message}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 0.85;
        // Use a nice voice if available
        const voices = window.speechSynthesis.getVoices();
        const idVoice = voices.find(v => v.lang.includes('id') || v.name.toLowerCase().includes('indonesia'));
        if (idVoice) utterance.voice = idVoice;

        // Small delay so the chime plays first
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 220);
      }
    }

    prevNotificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const getTypeIcon = (type: string) => {
    switch(type) {
      case "warning": return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case "success": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "urgent": return <Clock className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch(type) {
      case "warning": return "bg-orange-500/10";
      case "success": return "bg-green-500/10";
      case "urgent": return "bg-red-500/10";
      default: return "bg-blue-500/10";
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-muted/50 transition-colors"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[400px] bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-muted/20">
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center">
                  <Bell className="w-8 h-8 opacity-20 mb-2" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-3 rounded-xl flex gap-3 group relative cursor-pointer hover:bg-muted/30 transition-all ${!notif.isRead ? 'bg-muted/10' : ''}`}
                    onClick={() => {
                      if (!notif.isRead) markAsRead.mutate(notif.id);
                      if (onNotificationClick) {
                        onNotificationClick(notif);
                        setIsOpen(false);
                      }
                    }}
                  >
                    <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeBg(notif.type)}`}>
                      {getTypeIcon(notif.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`text-sm truncate font-bold ${!notif.isRead ? 'text-foreground' : 'text-foreground/70'}`}>
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 line-clamp-2 ${!notif.isRead ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                        {notif.message}
                      </p>
                      
                      {!notif.isRead && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-2 h-2 bg-primary rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// PATH SARAN: apps/web/src/components/filmmaking/shared/PresenceAvatars.tsx
import React from "react";
import type { ActiveCollaborator } from "./usePresence";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}

export function PresenceAvatars({ users }: { users: ActiveCollaborator[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2 mr-1" title={users.map((u) => u.userName).join(", ")}>
      {users.slice(0, 4).map((u) => (
        <div
          key={u.userId}
          className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-white"
        >
          {initials(u.userName) || "?"}
        </div>
      ))}
      {users.length > 4 && (
        <div className="w-7 h-7 rounded-full bg-zinc-700 border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-200">
          +{users.length - 4}
        </div>
      )}
    </div>
  );
}
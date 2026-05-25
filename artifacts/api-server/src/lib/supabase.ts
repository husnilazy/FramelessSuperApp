import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// Paksa suntik WebSocket ke global env agar Supabase tidak crash di Node 20
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket as any;
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("SUPABASE_URL missing");
}

if (!key) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
}

export const supabase = createClient(url, key);
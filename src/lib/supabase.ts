import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type DraftType = "tweet" | "thread";
export type DraftStatus = "draft" | "ready" | "posted";

export interface Draft {
  id: string;
  type: DraftType;
  content: string;
  status: DraftStatus;
  created_at: string;
}

export const THREAD_SEPARATOR = "---TWEET---";

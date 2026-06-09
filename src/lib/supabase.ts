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

// An array of image URLs. Thread drafts store one slot per tweet, using
// `null` for tweets without an image (so indexes line up with tweet position).
export type ImageUrls = (string | null)[];

export interface Draft {
  id: string;
  type: DraftType;
  content: string;
  status: DraftStatus;
  created_at: string;
  image_urls: ImageUrls | null;
}

export const THREAD_SEPARATOR = "---TWEET---";

// Supabase Storage bucket that holds uploaded draft images.
export const DRAFT_IMAGES_BUCKET = "draft-images";

// Reads a draft's images, falling back to the legacy single `image_url`
// column so drafts saved before the multi-image migration still display.
export function resolveImageUrls(draft: Draft): ImageUrls {
  if (draft.image_urls) return draft.image_urls;
  const legacy = (draft as { image_url?: string | null }).image_url;
  return legacy ? [legacy] : [];
}

// Extracts the storage object path from a public URL so we can delete it.
// Public URLs look like: <url>/storage/v1/object/public/draft-images/<path>
export function storagePathFromPublicUrl(url: string): string | null {
  const marker = `/object/public/${DRAFT_IMAGES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

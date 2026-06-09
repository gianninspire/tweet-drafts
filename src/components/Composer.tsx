"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Draft,
  DraftType,
  DRAFT_IMAGES_BUCKET,
  ImageUrls,
  resolveImageUrls,
  storagePathFromPublicUrl,
  supabase,
  THREAD_SEPARATOR,
} from "@/lib/supabase";
import CharCounter from "./CharCounter";

interface ComposerProps {
  editingDraft: Draft | null;
  onSave: (
    type: DraftType,
    content: string,
    imageUrls: ImageUrls | null
  ) => Promise<void>;
  onCancelEdit: () => void;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";
const MAX_TWEET_IMAGES = 4;

function emptyThread() {
  return [""];
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

// Uploads a file to storage and returns its public URL.
async function uploadImage(file: File): Promise<string> {
  const path = `${Date.now()}-${file.name}`;
  const { error } = await supabase.storage
    .from(DRAFT_IMAGES_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(DRAFT_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Best-effort delete of an uploaded image from storage.
async function deleteImage(url: string) {
  const path = storagePathFromPublicUrl(url);
  if (path) {
    await supabase.storage.from(DRAFT_IMAGES_BUCKET).remove([path]);
  }
}

export default function Composer({
  editingDraft,
  onSave,
  onCancelEdit,
}: ComposerProps) {
  const [tab, setTab] = useState<DraftType>("tweet");
  const [tweet, setTweet] = useState("");
  const [thread, setThread] = useState<string[]>(emptyThread());
  const [saving, setSaving] = useState(false);

  // Image state. Tweets: up to 4 URLs. Threads: one slot per tweet (null = none).
  const [tweetImages, setTweetImages] = useState<string[]>([]);
  const [threadImages, setThreadImages] = useState<(string | null)[]>([null]);
  const [tweetUploading, setTweetUploading] = useState(false);
  const [threadUploadingIndex, setThreadUploadingIndex] = useState<number | null>(
    null
  );
  const [imageError, setImageError] = useState<string | null>(null);

  // Tracks consecutive Enter presses per thread card index.
  const enterCounts = useRef<Record<number, number>>({});
  const cardRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Load a draft into the composer when editing begins.
  useEffect(() => {
    if (!editingDraft) return;
    const resolved = resolveImageUrls(editingDraft);
    if (editingDraft.type === "tweet") {
      setTab("tweet");
      setTweet(editingDraft.content);
      setTweetImages(
        resolved.filter((u): u is string => !!u).slice(0, MAX_TWEET_IMAGES)
      );
      setThread(emptyThread());
      setThreadImages([null]);
    } else {
      setTab("thread");
      const parts = editingDraft.content.split(THREAD_SEPARATOR);
      setThread(parts);
      setThreadImages(parts.map((_, i) => resolved[i] ?? null));
      setTweetImages([]);
    }
    setImageError(null);
    // Scroll composer into view so the user sees the loaded draft.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editingDraft]);

  const resetComposer = useCallback(() => {
    setTweet("");
    setThread(emptyThread());
    setTweetImages([]);
    setThreadImages([null]);
    setImageError(null);
    enterCounts.current = {};
  }, []);

  // ---- Tweet image handlers (up to 4) ----
  const handleTweetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    setTweetUploading(true);
    setImageError(null);
    try {
      const slots = MAX_TWEET_IMAGES - tweetImages.length;
      const uploaded: string[] = [];
      for (const file of files.slice(0, slots)) {
        uploaded.push(await uploadImage(file));
      }
      setTweetImages((prev) =>
        [...prev, ...uploaded].slice(0, MAX_TWEET_IMAGES)
      );
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Image upload failed."
      );
    } finally {
      setTweetUploading(false);
    }
  };

  const handleRemoveTweetImage = async (index: number) => {
    const url = tweetImages[index];
    setTweetImages((prev) => prev.filter((_, i) => i !== index));
    if (url) await deleteImage(url);
  };

  // ---- Thread image handlers (one per card) ----
  const handleThreadUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setThreadUploadingIndex(index);
    setImageError(null);
    const previous = threadImages[index];
    try {
      const url = await uploadImage(file);
      setThreadImages((prev) => {
        const copy = [...prev];
        copy[index] = url;
        return copy;
      });
      if (previous) await deleteImage(previous);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Image upload failed."
      );
    } finally {
      setThreadUploadingIndex(null);
    }
  };

  const handleRemoveThreadImage = async (index: number) => {
    const url = threadImages[index];
    setThreadImages((prev) => {
      const copy = [...prev];
      copy[index] = null;
      return copy;
    });
    if (url) await deleteImage(url);
  };

  const handleThreadKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    index: number
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const next = (enterCounts.current[index] ?? 0) + 1;
      enterCounts.current[index] = next;

      if (next >= 3) {
        // Third consecutive Enter: split off a new tweet card.
        e.preventDefault();
        enterCounts.current[index] = 0;
        setThread((prev) => {
          const copy = [...prev];
          // Strip the trailing newlines the first two Enters inserted.
          copy[index] = copy[index].replace(/\n+$/, "");
          copy.splice(index + 1, 0, "");
          return copy;
        });
        setThreadImages((prev) => {
          const copy = [...prev];
          copy.splice(index + 1, 0, null);
          return copy;
        });
        // Focus the freshly created card after it renders.
        requestAnimationFrame(() => cardRefs.current[index + 1]?.focus());
      }
    } else {
      // Any other key breaks the consecutive-Enter streak.
      enterCounts.current[index] = 0;
    }
  };

  const updateThreadTweet = (index: number, value: string) => {
    setThread((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const removeThreadTweet = (index: number) => {
    const orphan = threadImages[index];
    setThread((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
    setThreadImages((prev) => {
      if (prev.length === 1) return [null];
      return prev.filter((_, i) => i !== index);
    });
    if (orphan) deleteImage(orphan);
    enterCounts.current = {};
  };

  const addThreadTweet = () => {
    setThread((prev) => [...prev, ""]);
    setThreadImages((prev) => [...prev, null]);
    requestAnimationFrame(() => cardRefs.current[thread.length]?.focus());
  };

  const canSave =
    tab === "tweet"
      ? tweet.trim().length > 0
      : thread.some((t) => t.trim().length > 0);

  const anyUploading = tweetUploading || threadUploadingIndex !== null;

  const handleSave = async () => {
    if (!canSave || saving || anyUploading) return;
    setSaving(true);
    try {
      if (tab === "tweet") {
        await onSave("tweet", tweet.trim(), tweetImages);
      } else {
        // Keep only non-empty tweets, preserving each tweet's image slot.
        const pairs = thread
          .map((t, i) => ({ text: t.trim(), image: threadImages[i] ?? null }))
          .filter((p) => p.text.length > 0);
        const content = pairs.map((p) => p.text).join(THREAD_SEPARATOR);
        const images = pairs.map((p) => p.image);
        await onSave("thread", content, images);
      }
      resetComposer();
    } finally {
      setSaving(false);
    }
  };

  const switchTab = (next: DraftType) => {
    setTab(next);
  };

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 sm:p-5">
      {/* Tabs */}
      <div className="mb-4 flex w-fit items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        {(["tweet", "thread"] as DraftType[]).map((t) => (
          <button
            key={t}
            onClick={() => switchTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t
                ? "bg-neutral-100 text-neutral-900"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t === "tweet" ? "Tweets" : "Threads"}
          </button>
        ))}
      </div>

      {editingDraft && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
          <span>
            Editing a saved draft — the old version is removed when you save.
          </span>
          <button
            onClick={() => {
              onCancelEdit();
              resetComposer();
            }}
            className="rounded px-2 py-1 text-amber-200 hover:bg-amber-900/40"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Tweet composer */}
      {tab === "tweet" && (
        <div>
          <textarea
            value={tweet}
            onChange={(e) => setTweet(e.target.value)}
            placeholder="What's happening?"
            rows={5}
            className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900/50 p-3 text-[15px] leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-end">
            <CharCounter count={tweet.length} />
          </div>

          {/* Tweet image row (up to 4) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tweetImages.map((url, i) => (
              <div key={url} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Attachment ${i + 1}`}
                  className="h-16 w-16 rounded-md border border-neutral-800 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveTweetImage(i)}
                  aria-label="Remove image"
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-xs text-neutral-300 shadow hover:bg-neutral-800"
                >
                  ×
                </button>
              </div>
            ))}

            {tweetImages.length < MAX_TWEET_IMAGES && (
              <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-md border border-dashed border-neutral-700 text-neutral-500 transition-colors hover:border-neutral-500 hover:text-neutral-300">
                <input
                  type="file"
                  multiple
                  accept={ACCEPTED_IMAGE_TYPES}
                  onChange={handleTweetUpload}
                  className="hidden"
                />
                {tweetUploading ? (
                  <span className="text-[10px]">…</span>
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </label>
            )}
          </div>
        </div>
      )}

      {/* Thread composer */}
      {tab === "thread" && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            Tip: press{" "}
            <kbd className="rounded border border-neutral-700 bg-neutral-800 px-1">
              Enter
            </kbd>{" "}
            three times in a row to start the next tweet.
          </p>
          {thread.map((value, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">
                  Tweet {i + 1}
                </span>
                {thread.length > 1 && (
                  <button
                    onClick={() => removeThreadTweet(i)}
                    className="text-xs text-neutral-500 hover:text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                value={value}
                onChange={(e) => updateThreadTweet(i, e.target.value)}
                onKeyDown={(e) => handleThreadKeyDown(e, i)}
                placeholder={i === 0 ? "Start your thread…" : "Continue…"}
                rows={3}
                className="w-full resize-none rounded-md border border-neutral-800 bg-neutral-900/50 p-2.5 text-[15px] leading-relaxed text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
              />

              {/* Card footer: image control (bottom-left) + counter (bottom-right) */}
              <div className="mt-2 flex items-end justify-between">
                <div>
                  {threadImages[i] ? (
                    <div className="relative h-16 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={threadImages[i] as string}
                        alt={`Tweet ${i + 1} image`}
                        className="h-16 w-16 rounded-md border border-neutral-800 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveThreadImage(i)}
                        aria-label="Remove image"
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-xs text-neutral-300 shadow hover:bg-neutral-800"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <label
                      title="Add image"
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      <input
                        type="file"
                        accept={ACCEPTED_IMAGE_TYPES}
                        onChange={(e) => handleThreadUpload(i, e)}
                        className="hidden"
                      />
                      {threadUploadingIndex === i ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                    </label>
                  )}
                </div>
                <CharCounter count={value.length} />
              </div>
            </div>
          ))}
          <button
            onClick={addThreadTweet}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            + Add tweet
          </button>
        </div>
      )}

      {imageError && (
        <p className="mt-3 text-xs text-red-400">{imageError}</p>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave || saving || anyUploading}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save to Drafts"}
        </button>
      </div>
    </section>
  );
}

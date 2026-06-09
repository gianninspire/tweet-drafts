"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Draft,
  DraftType,
  DRAFT_IMAGES_BUCKET,
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
    imageUrl: string | null
  ) => Promise<void>;
  onCancelEdit: () => void;
}

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";

function emptyThread() {
  return [""];
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

  // Image upload state.
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Tracks consecutive Enter presses per thread card index.
  const enterCounts = useRef<Record<number, number>>({});
  const cardRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Load a draft into the composer when editing begins.
  useEffect(() => {
    if (!editingDraft) return;
    if (editingDraft.type === "tweet") {
      setTab("tweet");
      setTweet(editingDraft.content);
    } else {
      setTab("thread");
      setThread(editingDraft.content.split(THREAD_SEPARATOR));
    }
    setImageUrl(editingDraft.image_url ?? null);
    setImageError(null);
    // Scroll composer into view so the user sees the loaded draft.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editingDraft]);

  const resetComposer = useCallback(() => {
    setTweet("");
    setThread(emptyThread());
    setImageUrl(null);
    setImageError(null);
    enterCounts.current = {};
  }, []);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImageError(null);
    try {
      const path = `${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from(DRAFT_IMAGES_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(DRAFT_IMAGES_BUCKET)
        .getPublicUrl(path);

      // Remove any previously-uploaded-but-unsaved image before replacing it.
      if (imageUrl) {
        const oldPath = storagePathFromPublicUrl(imageUrl);
        if (oldPath) {
          await supabase.storage.from(DRAFT_IMAGES_BUCKET).remove([oldPath]);
        }
      }

      setImageUrl(data.publicUrl);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "Image upload failed."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = async () => {
    if (!imageUrl) return;
    const path = storagePathFromPublicUrl(imageUrl);
    setImageUrl(null);
    setImageError(null);
    if (path) {
      await supabase.storage.from(DRAFT_IMAGES_BUCKET).remove([path]);
    }
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
    setThread((prev) => {
      if (prev.length === 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
    enterCounts.current = {};
  };

  const canSave =
    tab === "tweet"
      ? tweet.trim().length > 0
      : thread.some((t) => t.trim().length > 0);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (tab === "tweet") {
        await onSave("tweet", tweet.trim(), imageUrl);
      } else {
        const cleaned = thread.map((t) => t.trim()).filter((t) => t.length > 0);
        await onSave("thread", cleaned.join(THREAD_SEPARATOR), imageUrl);
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
              <div className="mt-1.5 flex items-center justify-end">
                <CharCounter count={value.length} />
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              setThread((prev) => [...prev, ""]);
              requestAnimationFrame(() =>
                cardRefs.current[thread.length]?.focus()
              );
            }}
            className="text-sm text-neutral-400 hover:text-neutral-200"
          >
            + Add tweet
          </button>
        </div>
      )}

      {/* Image upload — applies to both tweets and threads */}
      <div className="mt-4">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Add image"}
        </button>

        {imageError && (
          <p className="mt-2 text-xs text-red-400">{imageError}</p>
        )}

        {imageUrl && (
          <div className="relative mt-3 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Draft attachment preview"
              className="max-h-[120px] rounded-lg border border-neutral-800 object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 shadow hover:bg-neutral-800"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave || saving || uploading}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save to Drafts"}
        </button>
      </div>
    </section>
  );
}

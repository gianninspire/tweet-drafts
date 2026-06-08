"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Draft, DraftType, THREAD_SEPARATOR } from "@/lib/supabase";
import CharCounter from "./CharCounter";

interface ComposerProps {
  editingDraft: Draft | null;
  onSave: (type: DraftType, content: string) => Promise<void>;
  onCancelEdit: () => void;
}

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
    // Scroll composer into view so the user sees the loaded draft.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editingDraft]);

  const resetComposer = useCallback(() => {
    setTweet("");
    setThread(emptyThread());
    enterCounts.current = {};
  }, []);

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
        await onSave("tweet", tweet.trim());
      } else {
        const cleaned = thread.map((t) => t.trim()).filter((t) => t.length > 0);
        await onSave("thread", cleaned.join(THREAD_SEPARATOR));
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
      <div className="mb-4 flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/60 p-1 w-fit">
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

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save to Drafts"}
        </button>
      </div>
    </section>
  );
}

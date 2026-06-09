"use client";

import { useState } from "react";
import { Draft, THREAD_SEPARATOR } from "@/lib/supabase";

interface DraftCardProps {
  draft: Draft;
  onEdit: (draft: Draft) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DraftCard({ draft, onEdit, onDelete }: DraftCardProps) {
  const [copied, setCopied] = useState(false);

  const isThread = draft.type === "thread";
  const tweets = isThread ? draft.content.split(THREAD_SEPARATOR) : [draft.content];

  // Threads copy with a blank line between tweets; tweets copy verbatim.
  const copyText = isThread ? tweets.join("\n\n") : draft.content;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); fail quietly.
    }
  };

  const handleDelete = () => {
    if (
      window.confirm(
        "Delete this draft? This action cannot be undone."
      )
    ) {
      onDelete(draft.id);
    }
  };

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-neutral-500">{formatDate(draft.created_at)}</span>
        {isThread && (
          <span className="rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-xs text-neutral-400">
            {tweets.length} {tweets.length === 1 ? "tweet" : "tweets"}
          </span>
        )}
      </div>

      {isThread ? (
        <div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-200">
            {tweets[0]}
          </p>
          {tweets.length > 1 && (
            <p className="mt-2 text-xs text-neutral-500">
              + {tweets.length - 1} more {tweets.length - 1 === 1 ? "tweet" : "tweets"}
            </p>
          )}
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-200">
          {draft.content}
        </p>
      )}

      {draft.image_url && (
        <a
          href={draft.image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block w-fit"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.image_url}
            alt="Draft attachment"
            className="max-h-[120px] rounded-lg border border-neutral-800 object-cover"
          />
        </a>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={handleCopy}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={() => onEdit(draft)}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40 hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

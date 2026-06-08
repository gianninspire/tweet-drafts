"use client";

import { useCallback, useEffect, useState } from "react";
import { Draft, DraftType, supabase } from "@/lib/supabase";
import Composer from "./Composer";
import DraftCard from "./DraftCard";

export default function Studio() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("drafts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setError(null);
      setDrafts((data as Draft[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  const handleSave = useCallback(
    async (type: DraftType, content: string) => {
      // When editing, remove the old draft first so we don't duplicate it.
      const editingId = editingDraft?.id;

      const { data, error } = await supabase
        .from("drafts")
        .insert({ type, content, status: "draft" })
        .select()
        .single();

      if (error) {
        setError(error.message);
        return;
      }

      if (editingId) {
        await supabase.from("drafts").delete().eq("id", editingId);
        setEditingDraft(null);
      }

      // Optimistically update the local list (newest first).
      setDrafts((prev) => {
        const without = editingId
          ? prev.filter((d) => d.id !== editingId)
          : prev;
        return [data as Draft, ...without];
      });
      setError(null);
    },
    [editingDraft]
  );

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("drafts").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setEditingDraft((cur) => (cur?.id === id ? null : cur));
  }, []);

  const handleEdit = useCallback((draft: Draft) => {
    setEditingDraft(draft);
  }, []);

  const tweetDrafts = drafts.filter((d) => d.type === "tweet");
  const threadDrafts = drafts.filter((d) => d.type === "thread");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
          Content Studio
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Draft and manage your tweets and threads.
        </p>
      </header>

      <Composer
        editingDraft={editingDraft}
        onSave={handleSave}
        onCancelEdit={() => setEditingDraft(null)}
      />

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-10 space-y-10">
        <DraftGroup
          title="Tweet Drafts"
          drafts={tweetDrafts}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <DraftGroup
          title="Thread Drafts"
          drafts={threadDrafts}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>
    </main>
  );
}

function DraftGroup({
  title,
  drafts,
  loading,
  onEdit,
  onDelete,
}: {
  title: string;
  drafts: Draft[];
  loading: boolean;
  onEdit: (d: Draft) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          {title}
        </h2>
        <span className="text-xs text-neutral-600">({drafts.length})</span>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-600">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-6 text-center text-sm text-neutral-600">
          No drafts yet.
        </p>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => (
            <DraftCard
              key={d.id}
              draft={d}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

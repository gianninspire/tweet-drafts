"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Draft, DraftType, ImageUrls, supabase } from "@/lib/supabase";
import Composer from "./Composer";

export default function Studio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("editId");

  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When ?editId= is present, fetch that draft and preload it into the composer.
  useEffect(() => {
    if (!editId) {
      setEditingDraft(null);
      return;
    }

    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("drafts")
        .select("*")
        .eq("id", editId)
        .single();
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      setError(null);
      setEditingDraft(data as Draft);
    })();

    return () => {
      active = false;
    };
  }, [editId]);

  const handleSave = useCallback(
    async (type: DraftType, content: string, imageUrls: ImageUrls | null) => {
      const editingId = editingDraft?.id;

      const { error } = await supabase
        .from("drafts")
        .insert({ type, content, status: "draft", image_urls: imageUrls });

      if (error) {
        setError(error.message);
        return;
      }

      // When editing, remove the old draft so we don't duplicate it.
      if (editingId) {
        await supabase.from("drafts").delete().eq("id", editingId);
      }

      setError(null);
      setEditingDraft(null);
      // Clear the editId param so a refresh doesn't reload the old draft.
      if (editId) router.replace("/");
    },
    [editingDraft, editId, router]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingDraft(null);
    if (editId) router.replace("/");
  }, [editId, router]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
          Compose
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Draft a tweet or a thread, then save it to your drafts.
        </p>
      </header>

      <Composer
        editingDraft={editingDraft}
        onSave={handleSave}
        onCancelEdit={handleCancelEdit}
      />

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
    </main>
  );
}

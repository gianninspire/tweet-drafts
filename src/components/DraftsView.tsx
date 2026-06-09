"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Draft, DraftType, supabase } from "@/lib/supabase";
import DraftCard from "./DraftCard";

interface DraftsViewProps {
  type: DraftType;
  title: string;
  emptyLabel: string;
  searchPlaceholder: string;
}

export default function DraftsView({
  type,
  title,
  emptyLabel,
  searchPlaceholder,
}: DraftsViewProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("drafts")
        .select("*")
        .eq("type", type)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setError(error.message);
      } else {
        setError(null);
        setDrafts((data as Draft[]) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [type]);

  const trimmedQuery = query.trim();
  const searchActive = trimmedQuery.length > 0;

  const filtered = useMemo(() => {
    if (!searchActive) return drafts;
    const needle = trimmedQuery.toLowerCase();
    return drafts.filter((d) => d.content.toLowerCase().includes(needle));
  }, [drafts, searchActive, trimmedQuery]);

  const handleEdit = useCallback(
    (draft: Draft) => {
      router.push(`/?editId=${draft.id}`);
    },
    [router]
  );

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("drafts").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-neutral-100">
          {title}
        </h1>
      </header>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="w-full rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
      />

      {searchActive && !loading && (
        <p className="mt-3 text-xs text-neutral-500">
          {filtered.length} {filtered.length === 1 ? "result" : "results"} for
          {" "}
          &quot;{trimmedQuery}&quot;
        </p>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-neutral-600">Loading…</p>
        ) : drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-600">
            {emptyLabel}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 px-4 py-10 text-center text-sm text-neutral-600">
            No results
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

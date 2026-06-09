import DraftsView from "@/components/DraftsView";

export default function ThreadsPage() {
  return (
    <DraftsView
      type="thread"
      title="Thread Drafts"
      emptyLabel="No thread drafts yet"
      searchPlaceholder="Search thread drafts…"
    />
  );
}

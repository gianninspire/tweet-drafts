import DraftsView from "@/components/DraftsView";

export default function TweetsPage() {
  return (
    <DraftsView
      type="tweet"
      title="Tweet Drafts"
      emptyLabel="No tweet drafts yet"
      searchPlaceholder="Search tweet drafts…"
    />
  );
}

import { Suspense } from "react";
import Studio from "@/components/Studio";

export default function Home() {
  return (
    <Suspense>
      <Studio />
    </Suspense>
  );
}

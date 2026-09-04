import { Suspense } from "react";
import { SessionView } from "@/components/SessionView";

export default function WritePage() {
  return (
    <Suspense fallback={null}>
      <SessionView />
    </Suspense>
  );
}

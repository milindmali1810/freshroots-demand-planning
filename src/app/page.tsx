import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { Loading } from "@/components/ui";

export default function Home() {
  // Dashboard reads the current date on the client, so it must render behind Suspense.
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}

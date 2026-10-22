import { Suspense } from "react";
import { RunView } from "@/components/RunView";
import { Loading } from "@/components/ui";

async function Inner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunView id={id} />;
}

export default function RunPage(props: PageProps<"/runs/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Inner params={props.params} />
    </Suspense>
  );
}

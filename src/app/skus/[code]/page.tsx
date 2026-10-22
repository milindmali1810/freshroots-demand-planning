import { Suspense } from "react";
import { SkuView } from "@/components/SkuView";
import { Loading } from "@/components/ui";

async function Inner({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SkuView code={code} />;
}

export default function SkuPage(props: PageProps<"/skus/[code]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Inner params={props.params} />
    </Suspense>
  );
}

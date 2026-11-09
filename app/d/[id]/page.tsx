import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedDesignView } from "@/components/community/community-views";

export const metadata: Metadata = { title: "Shared design" };

async function Loader({ params }: { params: PageProps<"/d/[id]">["params"] }) {
  const { id } = await params;
  return <SharedDesignView id={id} />;
}

export default function SharedDesignPage({ params }: PageProps<"/d/[id]">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
      <Suspense>
        <Loader params={params} />
      </Suspense>
    </div>
  );
}

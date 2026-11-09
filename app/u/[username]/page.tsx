import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/community/community-views";

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

async function Loader({ params }: { params: PageProps<"/u/[username]">["params"] }) {
  const { username } = await params;
  return <ProfileView username={decodeURIComponent(username).toLowerCase()} />;
}

export default function ProfilePage({ params }: PageProps<"/u/[username]">) {
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-10">
      <Suspense>
        <Loader params={params} />
      </Suspense>
    </div>
  );
}

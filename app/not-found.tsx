import Link from "next/link";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="bg-grid flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-8 py-12 text-center">
        <Unplug className="size-6 text-status-crit" aria-hidden="true" />
        <h1 className="text-lg font-semibold">No route to this page</h1>
        <p className="text-sm text-muted-foreground">This page could not be found. The link may be wrong, or the challenge may not exist.</p>
        <Button nativeButton={false} render={<Link href="/" />} variant="outline" size="sm">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

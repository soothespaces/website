"use client";

import { useEffect } from "react";
import { ContentPage } from "@/components/content-page";
import { Button } from "@/components/ui/button";

// QA-072: a thrown loader (an admin page's Supabase read, say) shows this
// instead of Next.js's default error screen. One line and Try again (SOS-169).
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ContentPage title="Something went wrong" intro="This page couldn't load.">
      <div>
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </ContentPage>
  );
}

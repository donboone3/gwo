"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function FeedRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const isAdmin = searchParams.get("studio") === "dropship";
    router.replace(isAdmin ? "/admin" : "/shop");
  }, [router, searchParams]);

  return (
    <div className="min-h-[60svh] flex items-center justify-center text-xs font-semibold text-[#686D76]">
      Redirecting to GWO AI Runway...
    </div>
  );
}

export default function FeedPage() {
  return (
    <React.Suspense fallback={null}>
      <FeedRedirectInner />
    </React.Suspense>
  );
}

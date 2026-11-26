import React, { Suspense } from "react";
import { GwoEndlessOutfitFeed } from "@/components/feed/GwoEndlessOutfitFeed";

export default function EndlessFeedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100svh-64px)] bg-[#F3F4F7] flex items-center justify-center text-sm font-semibold text-[#686D76]">
          Loading AI Endless Outfits &amp; Social Style DNA...
        </div>
      }
    >
      <GwoEndlessOutfitFeed />
    </Suspense>
  );
}

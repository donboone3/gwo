"use client";

import React from "react";
import { UnifiedGwoNav } from "./UnifiedGwoNav";

export function AvatarStageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#141518]">
      <UnifiedGwoNav />
      <div className="pt-16">{children}</div>
    </div>
  );
}

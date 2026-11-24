"use client";

import React, { useState } from "react";

interface GwoLogoProps {
  className?: string;
  height?: number;
  replayOnClick?: boolean;
}

/**
 * Pure cursive GWO monogram traced from the original sketch.
 * Animates in exact 4-stroke pen sequence (no border box or text clutter):
 *   1. Cursive W (sharing left stem with G)
 *   2. Horizontal crossbar on the top-left of W
 *   3. Sweeping C arc connecting down into W's lower stem to complete G
 *   4. Elevated cursive o loop off W's right arm
 */
export function GwoLogo({
  className = "",
  height = 54,
  replayOnClick = true,
}: GwoLogoProps) {
  const [animCycle, setAnimCycle] = useState(0);
  const width = Math.round((height * 165) / 108);

  return (
    <button
      type="button"
      onClick={replayOnClick ? () => setAnimCycle((c) => c + 1) : undefined}
      title="GWO — Click to replay cursive stroke animation"
      aria-label="GWO"
      className={`inline-flex items-center justify-center bg-transparent border-0 p-0 focus:outline-none ${
        replayOnClick ? "cursor-pointer" : "cursor-default"
      } ${className}`}
    >
      <svg
        key={animCycle}
        width={width}
        height={height}
        viewBox="34 14 140 104"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible select-none"
      >
        {/* Stroke 1: The cursive W */}
        <path
          d="M 88 56 C 85 74, 83 97, 87 99 C 93 101, 103 78, 108 72 C 109 84, 109 98, 114 98 C 121 98, 130 76, 137 57"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="gwo-stroke-1"
        />

        {/* Stroke 2: The line on the top-left of W */}
        <path
          d="M 71 60 Q 84 57, 96 53"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="gwo-stroke-2"
        />

        {/* Stroke 3: The C arc sweeping around to complete the G */}
        <path
          d="M 99 24 C 71 42, 43 76, 48 96 C 52 109, 72 106, 85 93"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="gwo-stroke-3"
        />

        {/* Stroke 4: Lastly, the cursive o */}
        <path
          d="M 146 33 C 134 39, 131 61, 141 72 C 151 76, 161 60, 155 41 C 151 31, 141 35, 138 46"
          pathLength={1}
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="gwo-stroke-4"
        />
      </svg>
    </button>
  );
}

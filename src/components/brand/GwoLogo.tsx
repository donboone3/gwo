"use client";

import React from "react";

interface GwoLogoProps {
  className?: string;
  height?: number;
  replayOnClick?: boolean;
}

/**
 * Architectural Maison GWO brand lockup:
 * Faceted Botanical Emerald & Champagne Gold crest paired with crisp,
 * geometric-couture GWO letterforms and a terracotta-rose atelier point.
 */
export function GwoLogo({
  className = "",
  height = 28,
}: GwoLogoProps) {
  const width = Math.round((height * 124) / 36);

  return (
    <span
      aria-label="GWO"
      className={`inline-flex items-center justify-center select-none ${className}`}
    >
      <svg
        width={width}
        height={height}
        viewBox="0 0 124 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block overflow-visible"
      >
        <defs>
          <linearGradient id="gwoCrestBg" x1="2" y1="2" x2="32" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#174434" />
            <stop offset="55%" stopColor="#215B46" />
            <stop offset="100%" stopColor="#13382A" />
          </linearGradient>
          <linearGradient id="gwoGoldFoil" x1="6" y1="6" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F4DFB4" />
            <stop offset="50%" stopColor="#D8B474" />
            <stop offset="100%" stopColor="#ECCF96" />
          </linearGradient>
        </defs>

        {/* Luxury Botanical Emerald & Champagne Gold Atelier Seal */}
        <rect
          x="1"
          y="2"
          width="32"
          height="32"
          rx="9"
          fill="url(#gwoCrestBg)"
        />
        <rect
          x="3.2"
          y="4.2"
          width="27.6"
          height="27.6"
          rx="7"
          stroke="url(#gwoGoldFoil)"
          strokeWidth="0.9"
          strokeOpacity="0.65"
        />
        {/* Faceted Couture Diamond Frame + Precision Monogram G inside Crest */}
        <path
          d="M17 7.2 L26.8 18 L17 28.8 L7.2 18 Z"
          stroke="url(#gwoGoldFoil)"
          strokeWidth="1.05"
          strokeOpacity="0.45"
        />
        <path
          d="M21.2 13.6 A 5.6 5.6 0 1 0 22.4 18.4 H 17.2"
          stroke="url(#gwoGoldFoil)"
          strokeWidth="2.1"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* Crisp Geometric-Couture Wordmark: G W O */}
        {/* Letter G */}
        <path
          d="M 57.8 12.2 A 8.8 8.8 0 1 0 59.6 18.3 H 51.8 M 59.6 18.3 V 26.4"
          stroke="#18191C"
          strokeWidth="2.75"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />

        {/* Letter W */}
        <path
          d="M 65.2 9.4 L 71.0 26.4 L 77.6 13.2 L 84.2 26.4 L 90.0 9.4"
          stroke="#18191C"
          strokeWidth="2.7"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          strokeMiterlimit="6"
        />

        {/* Letter O */}
        <circle
          cx="104.2"
          cy="18"
          r="8.6"
          stroke="#18191C"
          strokeWidth="2.75"
        />

        {/* Signature Terracotta-Rose Couture Accent Diamond */}
        <path
          d="M 119.2 22.4 L 122.2 25.4 L 119.2 28.4 L 116.2 25.4 Z"
          fill="#C43D2B"
        />
      </svg>
    </span>
  );
}

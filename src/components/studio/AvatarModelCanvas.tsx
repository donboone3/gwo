"use client";

import React from "react";
import { Product, UserProfile } from "@/lib/types";

interface AvatarModelCanvasProps {
  user: UserProfile;
  top?: Product | null;
  bottom?: Product | null;
  dress?: Product | null;
  outerwear?: Product | null;
  shoes?: Product | null;
  isScanning?: boolean;
  liveRenderUrl?: string | null;
  compact?: boolean;
}

/**
 * Interactive Full-Body Studio Avatar Mirror ("Avatar Always on Screen").
 * Dynamically layers the exact silhouettes, colors, cropped lengths, and shoe styles
 * onto the user's personalized body profile (or displays live FASHN AI photo output).
 */
export function AvatarModelCanvas({
  user,
  top,
  bottom,
  dress,
  outerwear,
  shoes,
  isScanning = false,
  liveRenderUrl,
  compact = false,
}: AvatarModelCanvasProps) {
  const skin = user.skinTone || "#E3B094";
  const hairColor =
    user.hairStyle === "sleek-bun-blonde"
      ? "#C9A66B"
      : user.hairStyle === "straight-auburn"
      ? "#6E3528"
      : "#261C18";

  if (liveRenderUrl && liveRenderUrl.startsWith("http")) {
    return (
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-2xl bg-[#F3EFEA]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={liveRenderUrl}
          alt={`${user.displayName} virtual try-on`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-[#F5F1EB] via-[#EFE9E0] to-[#E6DDD1] border border-[#E3DAD0] ${
        compact ? "h-44" : "h-[330px]"
      }`}
    >
      {/* Subtle studio arch backdrop */}
      <div className="absolute inset-x-5 top-4 bottom-0 rounded-t-full bg-white/45 border border-white/60 pointer-events-none" />

      {/* Scanning shimmer overlay during HD Try-On */}
      {isScanning && (
        <div className="absolute inset-0 z-20 bg-gradient-to-b from-transparent via-white/65 to-transparent animate-pulse flex items-center justify-center">
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-[#181615] text-[#FAF8F5] shadow-md">
            Styling HD Fit...
          </span>
        </div>
      )}

      <svg
        viewBox="0 0 180 340"
        className="relative z-10 h-[95%] w-auto drop-shadow-[0_8px_16px_rgba(24,22,21,0.08)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Floor studio shadow */}
        <ellipse cx="90" cy="322" rx="38" ry="6" fill="#181615" fillOpacity="0.10" />

        {/* Back hair layer */}
        {user.hairStyle !== "sleek-bun-blonde" && (
          <path
            d="M68 32 C58 52, 58 82, 66 96 L114 96 C122 82, 122 52, 112 32 Z"
            fill={hairColor}
          />
        )}
        {user.hairStyle === "sleek-bun-blonde" && (
          <circle cx="90" cy="18" r="10" fill={hairColor} />
        )}

        {/* Neck & Shoulders & Arms (Base Body) */}
        <rect x="84" y="54" width="12" height="18" rx="5" fill={skin} />
        {/* Left & Right Arms */}
        <path
          d="M64 76 C55 106, 51 138, 49 166 C49 171, 55 172, 57 166 C60 140, 65 114, 71 88 Z"
          fill={skin}
        />
        <path
          d="M116 76 C125 106, 129 138, 131 166 C131 171, 125 172, 123 166 C120 140, 115 114, 109 88 Z"
          fill={skin}
        />

        {/* Torso & Waist (Base Skin + Default Neutral Studio Set if empty) */}
        <path
          d="M66 72 C76 68, 104 68, 114 72 L107 124 C106 136, 116 150, 116 170 L64 170 C64 150, 74 136, 73 124 Z"
          fill={skin}
        />

        {/* Legs */}
        <path
          d="M65 166 L88 166 L84 304 L73 304 L70 232 Z"
          fill={skin}
        />
        <path
          d="M92 166 L115 166 L110 232 L107 304 L96 304 Z"
          fill={skin}
        />

        {/* Default minimal studio base set when nothing is selected */}
        {!top && !dress && !outerwear && (
          <path
            d="M71 74 L76 74 C80 86, 100 86, 104 74 L109 74 L107 112 L73 112 Z"
            fill="#EDE6DD"
            stroke="#D5CBBF"
          />
        )}
        {!bottom && !dress && (
          <path
            d="M71 132 L109 132 L115 174 L92 174 L90 158 L88 174 L65 174 Z"
            fill="#E3D9CD"
            stroke="#D5CBBF"
          />
        )}

        {/* ==================== WORN BOTTOMS LAYER ==================== */}
        {!dress && bottom && (
          <g>
            {bottom.silhouette === "leggings" && (
              <path
                d="M71 126 L109 126 L116 168 L108 292 L96 292 L90 176 L84 292 L72 292 L64 168 Z"
                fill={bottom.colorHex}
                stroke="#181615"
                strokeOpacity="0.18"
              />
            )}
            {(bottom.silhouette === "cargo-pants" || bottom.silhouette === "wide-denim") && (
              <g>
                <path
                  d="M70 128 L110 128 L122 302 L94 302 L90 180 L86 302 L58 302 Z"
                  fill={bottom.colorHex}
                  stroke="#181615"
                  strokeOpacity="0.2"
                />
                {bottom.silhouette === "cargo-pants" && (
                  <>
                    <rect x="59" y="206" width="10" height="18" rx="1.5" fill={bottom.colorHex} stroke="#181615" strokeOpacity="0.3" />
                    <rect x="111" y="206" width="10" height="18" rx="1.5" fill={bottom.colorHex} stroke="#181615" strokeOpacity="0.3" />
                  </>
                )}
              </g>
            )}
            {bottom.silhouette === "mini-skirt" && (
              <path
                d="M71 130 L109 130 L119 182 L61 182 Z"
                fill={bottom.colorHex}
                stroke="#181615"
                strokeOpacity="0.2"
              />
            )}
          </g>
        )}

        {/* ==================== WORN TOP LAYER ==================== */}
        {!dress && top && (
          <g>
            {(top.silhouette === "crop-tank" || top.silhouette === "sports-bra") && (
              <path
                d={
                  top.silhouette === "sports-bra"
                    ? "M71 73 L77 73 C81 87, 99 87, 103 73 L109 73 L108 108 L72 108 Z"
                    : "M71 72 L77 72 C81 85, 99 85, 103 72 L109 72 L108 122 L72 122 Z"
                }
                fill={top.colorHex}
                stroke="#181615"
                strokeOpacity="0.2"
              />
            )}
            {(top.silhouette === "baby-tee" || top.silhouette === "cardigan") && (
              <path
                d="M64 72 L78 69 C84 76, 96 76, 102 69 L116 72 L125 96 L113 101 L108 88 L109 126 L71 126 L72 88 L67 101 L55 96 Z"
                fill={top.colorHex}
                stroke="#181615"
                strokeOpacity="0.2"
              />
            )}
            {top.brand.toLowerCase() === "nike" && (
              <path
                d="M84 93 C87 96, 92 95, 97 91 C92 94, 87 94, 85 92 Z"
                fill={top.accentHex}
              />
            )}
          </g>
        )}

        {/* ==================== WORN DRESS LAYER ==================== */}
        {dress && (
          <g>
            <line x1="76" y1="70" x2="77" y2="84" stroke={dress.colorHex} strokeWidth="2.5" />
            <line x1="104" y1="70" x2="103" y2="84" stroke={dress.colorHex} strokeWidth="2.5" />
            <path
              d={
                dress.silhouette === "mini-dress"
                  ? "M72 82 Q90 92, 108 82 L118 192 L62 192 Z"
                  : "M72 82 Q90 92, 108 82 L121 268 Q90 274, 59 268 Z"
              }
              fill={dress.colorHex}
              stroke="#181615"
              strokeOpacity="0.2"
            />
          </g>
        )}

        {/* ==================== WORN OUTERWEAR LAYER ==================== */}
        {outerwear && (
          <g>
            <path
              d="M60 70 L78 66 C84 74, 96 74, 102 66 L120 70 L135 148 L122 152 L112 96 L114 146 L66 146 L68 96 L58 152 L45 148 Z"
              fill={outerwear.colorHex}
              stroke="#181615"
              strokeOpacity="0.22"
            />
            {outerwear.brand.toLowerCase() === "nike" && (
              <path
                d="M78 92 C81 95, 86 94, 92 90 C86 93, 81 93, 79 91 Z"
                fill={outerwear.accentHex}
              />
            )}
          </g>
        )}

        {/* ==================== WORN SHOES LAYER ==================== */}
        {shoes ? (
          <g>
            {/* Left & Right Shoes */}
            <path
              d="M66 302 L85 302 L86 318 L60 318 C60 310, 63 305, 66 302 Z"
              fill={shoes.colorHex}
              stroke="#181615"
              strokeOpacity="0.28"
            />
            <path
              d="M95 302 L114 302 C117 305, 120 310, 120 318 L94 318 Z"
              fill={shoes.colorHex}
              stroke="#181615"
              strokeOpacity="0.28"
            />
            {shoes.silhouette === "sneakers" && (
              <>
                <rect x="59" y="315" width="27" height="4" rx="1.5" fill="#FAF8F5" />
                <rect x="94" y="315" width="27" height="4" rx="1.5" fill="#FAF8F5" />
                <line x1="64" y1="311" x2="80" y2="309" stroke={shoes.accentHex} strokeWidth="2.2" />
                <line x1="100" y1="309" x2="116" y2="311" stroke={shoes.accentHex} strokeWidth="2.2" />
              </>
            )}
          </g>
        ) : (
          <g>
            <ellipse cx="77" cy="312" rx="7" ry="4" fill={skin} />
            <ellipse cx="103" cy="312" rx="7" ry="4" fill={skin} />
          </g>
        )}

        {/* Head & Minimalist Editorial Face */}
        <ellipse cx="90" cy="38" rx="15" ry="18.5" fill={skin} />
        {/* Hair Bangs / Crown */}
        <path
          d="M74 34 C75 18, 105 18, 106 34 C101 26, 79 26, 74 34 Z"
          fill={hairColor}
        />
        {/* Subtle eyes & warm lip */}
        <circle cx="84.5" cy="38" r="1.2" fill="#2A211D" />
        <circle cx="95.5" cy="38" r="1.2" fill="#2A211D" />
        <path d="M87 46 Q90 48, 93 46" stroke="#A66558" strokeWidth="1.4" strokeLinecap="round" />
      </svg>

      {!compact && (
        <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between text-[10px] text-[#5C5550] bg-white/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-[#E6DFD7]">
          <span>
            {Math.floor(user.heightInches / 12)}&apos;{Math.round(user.heightInches % 12)}&quot; • {user.waistInches}&quot;W • {user.hipsInches}&quot;H
          </span>
          <span className="font-semibold text-[#2B5942]">Exact Profile</span>
        </div>
      )}
    </div>
  );
}

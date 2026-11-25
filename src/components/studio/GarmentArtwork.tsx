"use client";

import React, { useState } from "react";
import { Product } from "@/lib/types";

interface GarmentArtworkProps {
  product: Product;
  className?: string;
}

export function GarmentArtwork({ product, className = "" }: GarmentArtworkProps) {
  const [useProxyFallback, setUseProxyFallback] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const isNike = product.brand.toLowerCase() === "nike";

  if (product.imageUrl && !imgFailed) {
    const src =
      useProxyFallback &&
      !product.imageUrl.includes("wsrv.nl") &&
      !product.imageUrl.startsWith("data:")
        ? `https://wsrv.nl/?url=${encodeURIComponent(product.imageUrl)}&w=640&output=webp`
        : product.imageUrl;

    return (
      <div
        className={`relative overflow-hidden bg-[#F6F7F9] flex items-center justify-center ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={product.title}
          onError={() => {
            if (!useProxyFallback && !product.imageUrl?.includes("wsrv.nl")) {
              setUseProxyFallback(true);
            } else {
              setImgFailed(true);
            }
          }}
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    );
  }

  const fill = product.colorHex || "#2B221F";
  const accent = product.accentHex || "#FAF8F5";

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-b from-[#F6F2EC] to-[#ECE5DC] flex items-center justify-center ${className}`}
    >
      <svg
        viewBox="0 0 200 220"
        className="w-4/5 h-4/5 drop-shadow-[0_10px_18px_rgba(24,22,21,0.10)] transition-transform duration-500 group-hover:scale-105"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {product.silhouette === "oversized-hoodie" && (
          <g>
            {/* Hood */}
            <path
              d="M72 42 C72 20, 128 20, 128 42 L118 54 L82 54 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.18"
              strokeWidth="2"
            />
            {/* Drop-shoulder oversized body & sleeves */}
            <path
              d="M58 48 L82 44 L118 44 L142 48 L176 118 L154 128 L138 88 L136 164 L64 164 L62 88 L46 128 L24 118 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.18"
              strokeWidth="2"
            />
            {/* Ribbed hem + kangaroo pocket */}
            <rect x="65" y="154" width="70" height="11" rx="3" fill={fill} stroke="#181615" strokeOpacity="0.2" />
            <path d="M78 126 L122 126 L128 152 L72 152 Z" stroke="#181615" strokeOpacity="0.18" strokeWidth="1.8" />
            {isNike && (
              <path
                d="M84 79 C89 85, 98 83, 112 74 C99 81, 90 81, 86 76 Z"
                fill={accent}
              />
            )}
          </g>
        )}

        {product.silhouette === "crop-tank" && (
          <g>
            <path
              d="M74 42 L84 42 C88 60, 112 60, 116 42 L126 42 L132 134 C112 139, 88 139, 68 134 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            {/* Mini-rib vertical texture lines */}
            <line x1="86" y1="62" x2="84" y2="134" stroke="#181615" strokeOpacity="0.08" strokeWidth="1.5" />
            <line x1="100" y1="64" x2="100" y2="136" stroke="#181615" strokeOpacity="0.08" strokeWidth="1.5" />
            <line x1="114" y1="62" x2="116" y2="134" stroke="#181615" strokeOpacity="0.08" strokeWidth="1.5" />
            {isNike && (
              <path
                d="M93 80 C96 84, 102 83, 110 77 C103 81, 97 81, 94 78 Z"
                fill={accent}
              />
            )}
          </g>
        )}

        {product.silhouette === "sports-bra" && (
          <g>
            <path
              d="M72 48 L83 48 C88 70, 112 70, 117 48 L128 48 L134 114 L66 114 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.2"
              strokeWidth="2"
            />
            <rect x="67" y="104" width="66" height="12" rx="2" fill={fill} stroke={accent} strokeOpacity="0.35" />
            {isNike && (
              <path
                d="M90 84 C95 90, 104 88, 116 79 C104 86, 96 86, 92 81 Z"
                fill={accent}
              />
            )}
          </g>
        )}

        {(product.silhouette === "baby-tee" || product.silhouette === "cardigan" || product.silhouette === "cropped-jacket") && (
          <g>
            <path
              d="M66 48 L84 42 C92 52, 108 52, 116 42 L134 48 L156 80 L138 92 L128 74 L130 138 L70 138 L72 74 L62 92 L44 80 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            {product.silhouette === "cardigan" && (
              <line x1="100" y1="50" x2="100" y2="138" stroke={accent} strokeOpacity="0.5" strokeWidth="2" strokeDasharray="4 5" />
            )}
          </g>
        )}

        {product.silhouette === "leggings" && (
          <g>
            <path
              d="M72 34 L128 34 L134 78 L124 188 L105 188 L100 88 L95 188 L76 188 L66 78 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.2"
              strokeWidth="2"
            />
            {/* High-waisted sculpt yoke */}
            <path d="M71 54 Q100 64, 129 54" stroke={accent} strokeOpacity="0.28" strokeWidth="1.8" />
            {isNike && (
              <path
                d="M78 64 C81 67, 86 66, 92 61 C86 65, 81 65, 79 62 Z"
                fill={accent}
              />
            )}
          </g>
        )}

        {(product.silhouette === "cargo-pants" || product.silhouette === "wide-denim") && (
          <g>
            <path
              d="M70 34 L130 34 L144 186 L108 186 L100 86 L92 186 L56 186 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <line x1="70" y1="46" x2="130" y2="46" stroke="#181615" strokeOpacity="0.18" strokeWidth="1.6" />
            {product.silhouette === "cargo-pants" && (
              <>
                <rect x="60" y="96" width="18" height="24" rx="2" fill={fill} stroke="#181615" strokeOpacity="0.28" strokeWidth="1.6" />
                <rect x="122" y="96" width="18" height="24" rx="2" fill={fill} stroke="#181615" strokeOpacity="0.28" strokeWidth="1.6" />
              </>
            )}
            {isNike && (
              <path
                d="M77 60 C80 63, 85 62, 91 58 C85 61, 80 61, 78 59 Z"
                fill={accent}
              />
            )}
          </g>
        )}

        {product.silhouette === "mini-skirt" && (
          <g>
            <path
              d="M70 58 L130 58 L146 132 L54 132 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <line x1="78" y1="72" x2="70" y2="132" stroke="#181615" strokeOpacity="0.16" strokeWidth="1.5" />
            <line x1="100" y1="72" x2="100" y2="132" stroke="#181615" strokeOpacity="0.16" strokeWidth="1.5" />
            <line x1="122" y1="72" x2="130" y2="132" stroke="#181615" strokeOpacity="0.16" strokeWidth="1.5" />
          </g>
        )}

        {(product.silhouette === "slip-dress" || product.silhouette === "mini-dress") && (
          <g>
            <line x1="80" y1="30" x2="82" y2="52" stroke={fill} strokeWidth="3" />
            <line x1="120" y1="30" x2="118" y2="52" stroke={fill} strokeWidth="3" />
            <path
              d={
                product.silhouette === "mini-dress"
                  ? "M76 50 Q100 62, 124 50 L136 144 L64 144 Z"
                  : "M76 50 Q100 64, 124 50 L140 184 Q100 192, 60 184 Z"
              }
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.2"
              strokeWidth="2"
            />
          </g>
        )}

        {product.silhouette === "sneakers" && (
          <g>
            {/* Retro low-profile sneaker (Cortez / V2K vibe) */}
            <path
              d="M34 132 C36 112, 56 96, 82 96 L108 108 C130 116, 158 118, 166 132 L168 144 L32 144 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.25"
              strokeWidth="2"
            />
            {/* Swoosh / side stripe */}
            <path
              d="M68 122 C78 132, 102 130, 132 118 C105 125, 82 125, 73 116 Z"
              fill={accent}
            />
            {/* Layered foam outsole */}
            <rect x="30" y="142" width="140" height="12" rx="5" fill="#FAF8F5" stroke="#181615" strokeOpacity="0.22" strokeWidth="1.8" />
            <line x1="34" y1="148" x2="166" y2="148" stroke={accent} strokeWidth="2.5" />
          </g>
        )}

        {product.silhouette === "ballet-flats" && (
          <g>
            <path
              d="M36 134 C40 116, 62 114, 76 126 C98 132, 134 130, 152 120 C162 122, 166 132, 164 142 L36 142 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.25"
              strokeWidth="2"
            />
            {/* Delicate buckle strap */}
            <path d="M104 122 L112 142" stroke={fill} strokeWidth="6" />
            <rect x="103" y="127" width="10" height="8" rx="1.5" stroke={accent} strokeWidth="2" fill="none" />
          </g>
        )}

        {product.silhouette === "shoulder-bag" && (
          <g>
            <path
              d="M68 92 C68 48, 132 48, 132 92"
              stroke={fill}
              strokeWidth="6"
              fill="none"
            />
            <path
              d="M54 90 Q100 104, 146 90 L152 142 Q100 154, 48 142 Z"
              fill={fill}
              stroke="#181615"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>

      {/* Subtle brand studio tag */}
      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase bg-white/85 backdrop-blur-sm text-[#181615] border border-[#E6DFD7]">
        {product.brand}
      </span>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import {
  Check,
  ExternalLink,
  Plus,
  RefreshCw,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { FitRating, Product } from "@/lib/types";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { useGwo } from "@/context/GwoAppContext";

interface ProductCardProps {
  product: Product;
  referrerCode?: string;
  friendBadgeText?: string;
  friendNote?: string;
}

export function ProductCard({
  product,
  referrerCode,
  friendBadgeText,
  friendNote,
}: ProductCardProps) {
  const {
    wearProduct,
    activeProductIds,
    myCloset,
    addToMyCloset,
    addToBag,
    getSizeRec,
  } = useGwo();
  const [addingCloset, setAddingCloset] = useState(false);
  const [selectedFit, setSelectedFit] = useState<FitRating>("true_to_size");
  const [note, setNote] = useState("");

  const isWorn = activeProductIds.includes(product.id);
  const isOwned = myCloset.some((c) => c.productId === product.id);
  const sizeRec = getSizeRec(product);

  const daysUntilRefresh = Math.max(
    1,
    Math.ceil(
      (new Date(product.staleAfter).getTime() - Date.now()) /
        (24 * 60 * 60 * 1000)
    )
  );

  const refQuery = referrerCode
    ? `?ref=${encodeURIComponent(referrerCode)}`
    : "";

  return (
    <div className="group rounded-2xl bg-white border border-[#E6DFD7] overflow-hidden flex flex-col justify-between transition hover:shadow-[0_12px_30px_rgba(24,22,21,0.07)]">
      <div>
        <div className="relative">
          <GarmentArtwork product={product} className="h-52 w-full" />

          {/* Top-right source / 3-day sync indicator */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
            {product.sourceType === "scraped_url" ? (
              <span
                title="Stored in GWO Shared Catalog with automatic 3-day stock refresh"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-[#5C5550] border border-[#E6DFD7]"
              >
                <RefreshCw className="w-2.5 h-2.5" /> {daysUntilRefresh}d sync
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#181615]/85 text-[#FAF8F5]">
                Live Feed
              </span>
            )}
          </div>

          {/* Price & Delivery Pill */}
          <div className="absolute bottom-2.5 inset-x-2.5 flex items-center justify-between">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-[#181615] shadow-xs">
              ${product.price}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/90 text-[#5C5550]">
              <Truck className="w-3 h-3" /> {product.estDeliveryDays}d ETA
            </span>
          </div>
        </div>

        <div className="p-3.5 space-y-2">
          <div>
            <p className="text-[11px] text-[#6E6762] font-medium">
              {product.colorName} • {product.storeDomain}
            </p>
            <h4 className="text-sm font-semibold text-[#181615] leading-snug line-clamp-2 mt-0.5">
              {product.title}
            </h4>
          </div>

          {/* Exact-Fit & Body-Twin Recommendation Badge */}
          {sizeRec && (
            <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE3DA] px-2.5 py-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#181615]">
                  Your Fit: Size {sizeRec.recommendedSize}
                </span>
                <span className="text-[10px] font-semibold text-[#2B5942]">
                  {sizeRec.confidence === "high" ? "96% Fit Match" : "Chart Fit"}
                </span>
              </div>
              {(friendBadgeText || sizeRec.bodyTwin) && (
                <p className="text-[11px] text-[#5C5550] flex items-start gap-1 leading-tight">
                  <Users className="w-3 h-3 text-[#2B5942] shrink-0 mt-0.5" />
                  <span>{friendBadgeText || sizeRec.bodyTwin?.summary}</span>
                </p>
              )}
            </div>
          )}

          {friendNote && (
            <p className="text-xs italic text-[#5C5550] bg-[#F6F2EC] px-2.5 py-1.5 rounded-lg">
              &ldquo;{friendNote}&rdquo;
            </p>
          )}
        </div>
      </div>

      {/* Quick Closet Log Drawer */}
      {addingCloset ? (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-[#EFE9E1] bg-[#FAF8F5] space-y-2">
          <p className="text-[11px] font-semibold text-[#181615]">
            Add to Your Public Closet (+3 Free Try-Ons!)
          </p>
          <div className="flex gap-1">
            {(["runs_small", "true_to_size", "runs_large"] as FitRating[]).map(
              (r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedFit(r)}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-semibold border cursor-pointer ${
                    selectedFit === r
                      ? "bg-[#181615] text-white border-[#181615]"
                      : "bg-white text-[#5C5550] border-[#DED6CC]"
                  }`}
                >
                  {r === "runs_small"
                    ? "Runs Small"
                    : r === "true_to_size"
                    ? "True to Size"
                    : "Runs Roomy"}
                </button>
              )
            )}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Fit tip for your friends..."
            className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white border border-[#DED6CC] focus:outline-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={async () => {
                await addToMyCloset({
                  productId: product.id,
                  purchasedSize: sizeRec?.recommendedSize || "S",
                  fitRating: selectedFit,
                  reviewNote:
                    note || "Fits like a dream—borrow or try on anytime!",
                  isPublic: true,
                });
                setAddingCloset(false);
                setNote("");
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#2B5942] text-white cursor-pointer"
            >
              Save (+3 Tries)
            </button>
            <button
              type="button"
              onClick={() => setAddingCloset(false)}
              className="px-2.5 py-1.5 rounded-lg text-xs text-[#6E6762] hover:bg-[#EAE3DA] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              wearProduct(product, referrerCode);
              addToBag({
                brand: product.brand,
                title: product.title,
                price: product.price,
                size: sizeRec?.recommendedSize || "S",
                friendRef: referrerCode,
                storeUrl: product.canonicalUrl,
              });
            }}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-semibold transition cursor-pointer ${
              isWorn
                ? "bg-[#2B5942] text-white"
                : "bg-[#181615] text-[#FAF8F5] hover:bg-[#2E2A28]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isWorn ? "In Outfit Bag" : "Try & + Bag"}
          </button>

          {!isOwned ? (
            <button
              type="button"
              onClick={() => setAddingCloset(true)}
              title="I own this — add to Your Closet (+3 Free Try-Ons)"
              className="p-2 rounded-full border border-[#DED6CC] text-[#181615] hover:bg-[#F3EFEA] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span
              title="In Your Closet"
              className="p-2 rounded-full bg-[#E7F1EC] text-[#2B5942]"
            >
              <Check className="w-3.5 h-3.5" />
            </span>
          )}

          <a
            href={
              process.env.NEXT_PUBLIC_BASE_PATH
                ? product.canonicalUrl
                : `/api/out/${product.id}${refQuery}`
            }
            target="_blank"
            rel="noopener noreferrer"
            title={
              referrerCode
                ? `Shop on ${product.storeDomain} (supports ${referrerCode})`
                : `Shop on ${product.storeDomain}`
            }
            className="p-2 rounded-full border border-[#DED6CC] text-[#181615] hover:bg-[#F3EFEA] transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

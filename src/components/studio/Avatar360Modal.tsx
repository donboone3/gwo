"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { Parametric3DFitMock } from "../product/Parametric3DFitMock";
import { GarmentArtwork } from "./GarmentArtwork";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";

export function Avatar360Modal() {
  const {
    avatar360Target,
    closeAvatar360,
    user,
    customAvatar,
    addToBag,
  } = useGwo();

  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;
  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;

  const primaryProduct = avatar360Target?.primaryProduct || null;

  const baseFit = useMemo(() => {
    if (!primaryProduct) return null;
    return analyzeExactAvatarFit(
      {
        heightInches: activeHeight,
        bustInches: activeBust,
        waistInches: activeWaist,
        hipsInches: activeHips,
        shoeSize: user?.shoeSize || "7.5",
      },
      primaryProduct
    );
  }, [activeBust, activeHeight, activeHips, activeWaist, primaryProduct, user?.shoeSize]);

  const [selectedSize, setSelectedSize] = useState<string>("S");

  useEffect(() => {
    if (baseFit?.recommendedSize) {
      setSelectedSize(baseFit.recommendedSize);
    }
  }, [baseFit?.recommendedSize, primaryProduct?.id]);

  const liveFit = useMemo(() => {
    if (!primaryProduct) return null;
    return analyzeExactAvatarFit(
      {
        heightInches: activeHeight,
        bustInches: activeBust,
        waistInches: activeWaist,
        hipsInches: activeHips,
        shoeSize: user?.shoeSize || "7.5",
      },
      primaryProduct,
      selectedSize
    );
  }, [
    activeBust,
    activeHeight,
    activeHips,
    activeWaist,
    primaryProduct,
    selectedSize,
    user?.shoeSize,
  ]);

  if (!avatar360Target || !primaryProduct || !liveFit) return null;

  const companionProducts = avatar360Target.companionProducts || [];
  const allItems = [primaryProduct, ...companionProducts];
  const totalLookPrice = allItems.reduce((s, p) => s + p.price, 0);
  const sizesToPick =
    primaryProduct.availableSizes && primaryProduct.availableSizes.length > 0
      ? primaryProduct.availableSizes.slice(0, 5)
      : ["XS", "S", "M", "L"];

  const backPhoto = primaryProduct.fitMetadata?.galleryImages?.find((img) =>
    /back/i.test(img.label)
  );
  const frontPhoto =
    primaryProduct.fitMetadata?.galleryImages?.[0]?.url ||
    primaryProduct.imageUrl;

  return (
    <div
      id="gwo-avatar-360-modal"
      className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={closeAvatar360}
    >
      <div
        className="w-full max-w-4xl max-h-[92svh] rounded-3xl bg-white shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-black/[0.07] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
                <Rotate3d className="w-3 h-3" /> 360° Front &amp; Back Avatar Look
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4F5F7] text-[#141518] text-[10.5px] font-semibold">
                <Ruler className="w-3 h-3 text-[#244B3B]" />{" "}
                {Math.floor(activeHeight / 12)}&apos;{Math.round(activeHeight % 12)}&quot; •{" "}
                {activeBust}&quot; B • {activeWaist}&quot; W • {activeHips}&quot; H
              </span>
              {primaryProduct.dropship?.cnSizeTagMap?.[selectedSize] && (
                <span className="px-2.5 py-0.5 rounded-full bg-[#FEF6E6] text-[#8A5808] text-[10.5px] font-bold border border-[#F4DFB4]">
                  US {selectedSize} = Supplier{" "}
                  {primaryProduct.dropship.cnSizeTagMap[selectedSize]}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#141518] truncate mt-1">
              {avatar360Target.title}
            </h3>
          </div>

          <button
            type="button"
            id="gwo-avatar-360-close-btn"
            onClick={closeAvatar360}
            aria-label="Close 360° Avatar Viewer"
            className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left 360° Front + Back Interactive Stage | Right Size, Store Front/Back Photos & Actions */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_300px] gap-4 items-stretch">
          <Parametric3DFitMock
            product={primaryProduct}
            companionProducts={companionProducts}
            selectedSize={selectedSize}
            fitReport={liveFit}
            avatar={{
              heightInches: activeHeight,
              bustInches: activeBust,
              waistInches: activeWaist,
              hipsInches: activeHips,
              skinTone: customAvatar?.skinToneHex || user?.skinTone || "#D9A482",
            }}
            faceBadgeUrl={customAvatar?.badgeDataUrl}
            initialAngleMode={avatar360Target.initialAngleMode || "split"}
            compactHeightClass="h-[430px] sm:h-[490px]"
          />

          <div className="flex flex-col justify-between gap-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] p-4">
            <div className="space-y-3">
              {/* Size Switcher */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#141518]">
                    Select Avatar Size
                  </span>
                  <span className="text-[11px] font-bold text-[#244B3B]">
                    Best: Size {baseFit?.recommendedSize} ({liveFit.confidencePct}%)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {sizesToPick.map((sz) => {
                    const active = selectedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          active
                            ? "bg-[#141518] text-white border-[#141518]"
                            : "bg-white hover:bg-[#EAECEF] text-[#141518] border-black/10"
                        }`}
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fit Verdict & Scraped Product Details */}
              <div className="p-3 rounded-xl bg-white border border-[#CBE2D4] space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[#1D4232] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" /> Exact Fit Verdict
                  </p>
                  <span className="text-xs font-extrabold text-[#141518]">
                    ${primaryProduct.price}
                  </span>
                </div>
                <p className="text-[11px] text-[#4E5A54] leading-snug">
                  {liveFit.headlineVerdict}
                </p>
                {primaryProduct.fitMetadata?.fabricComposition && (
                  <p className="text-[10.5px] font-semibold text-[#141518] pt-0.5">
                    Fabric: {primaryProduct.fitMetadata.fabricComposition}
                  </p>
                )}
                {primaryProduct.fitMetadata?.descriptionSummary && (
                  <p className="text-[10.5px] text-[#5C6068] line-clamp-2 leading-snug">
                    {primaryProduct.fitMetadata.descriptionSummary}
                  </p>
                )}
              </div>

              {/* Store Reference Thumbnail(s) (Front + Back if available) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                  Garment Reference ({allItems.length}{" "}
                  {allItems.length === 1 ? "piece" : "pieces"})
                </span>
                {backPhoto && frontPhoto ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl overflow-hidden bg-white border border-black/[0.06]">
                      <img
                        src={frontPhoto}
                        alt="Store Front"
                        className="w-full h-28 object-cover object-top"
                      />
                      <p className="text-[10px] font-bold text-center py-1 text-[#141518]">
                        Store Front
                      </p>
                    </div>
                    <div className="rounded-xl overflow-hidden bg-white border border-black/[0.06]">
                      <img
                        src={backPhoto.url}
                        alt="Store Back"
                        className="w-full h-28 object-cover object-top"
                      />
                      <p className="text-[10px] font-bold text-center py-1 text-[#244B3B]">
                        {backPhoto.label}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {allItems.map((it) => (
                      <div
                        key={it.id}
                        className="p-2 rounded-xl bg-white border border-black/[0.06] flex items-center gap-2.5"
                      >
                        <div className="w-10 h-12 rounded-lg overflow-hidden bg-[#F6F7F9] shrink-0">
                          <GarmentArtwork product={it} className="w-full h-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase text-[#244B3B] truncate">
                            {it.brand}
                          </p>
                          <p className="text-xs font-bold text-[#141518] truncate">
                            {it.title}
                          </p>
                          <p className="text-[11px] font-semibold text-[#686D76]">
                            ${it.price}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2 pt-2 border-t border-black/[0.07]">
              <button
                type="button"
                id="gwo-modal-360-bag-btn"
                onClick={() => {
                  for (const it of allItems) {
                    const itFit = analyzeExactAvatarFit(
                      {
                        heightInches: activeHeight,
                        bustInches: activeBust,
                        waistInches: activeWaist,
                        hipsInches: activeHips,
                        shoeSize: user?.shoeSize || "7.5",
                      },
                      it
                    );
                    addToBag({
                      productId: it.id,
                      title: it.title,
                      brand: it.brand,
                      price: it.price,
                      size:
                        it.id === primaryProduct.id
                          ? selectedSize
                          : itFit.recommendedSize,
                      imageUrl: it.imageUrl,
                      storeUrl: it.canonicalUrl,
                    });
                  }
                  closeAvatar360();
                }}
                className="w-full py-2.5 px-4 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {allItems.length > 1
                  ? `+ Bag Full Outfit ($${totalLookPrice})`
                  : `+ Add Size ${selectedSize} to Bag ($${primaryProduct.price})`}
              </button>

              <Link
                href={
                  primaryProduct.canonicalUrl.includes("goodwithonline.com/closet")
                    ? `/product?name=${encodeURIComponent(
                        primaryProduct.title
                      )}&price=${encodeURIComponent(
                        `$${primaryProduct.price}`
                      )}&view=3d`
                    : `/product?id=${encodeURIComponent(primaryProduct.id)}&view=3d`
                }
                onClick={closeAvatar360}
                className="w-full py-2 px-4 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
              >
                Full-Screen 3D Fit Inspector <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

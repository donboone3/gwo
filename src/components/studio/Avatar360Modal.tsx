"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Columns2,
  Rotate3d,
  Ruler,
  ShoppingBag,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "./GarmentArtwork";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";

export function Avatar360Modal() {
  const { avatar360Target, closeAvatar360, user, addToBag } = useGwo();

  const activeHeight =
    user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;
  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist =
    user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
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
  }, [
    activeBust,
    activeHeight,
    activeHips,
    activeWaist,
    primaryProduct,
    user?.shoeSize,
  ]);

  const [selectedSize, setSelectedSize] = useState<string>("S");
  const [angleView, setAngleView] = useState<"split" | "front" | "back">(
    "split"
  );

  useEffect(() => {
    if (baseFit?.recommendedSize) {
      setSelectedSize(baseFit.recommendedSize);
    }
    if (avatar360Target?.initialAngleMode === "front") setAngleView("front");
    else if (avatar360Target?.initialAngleMode === "back") setAngleView("back");
    else setAngleView("split");
  }, [
    avatar360Target?.initialAngleMode,
    baseFit?.recommendedSize,
    primaryProduct?.id,
  ]);

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

  const photoSet = useMemo(() => {
    if (!primaryProduct) return null;
    return resolveLifelikeAvatarPhotos({
      product: primaryProduct,
      explicitFrontUrl: avatar360Target?.avatarFrontUrl,
      explicitBackUrl: avatar360Target?.avatarBackUrl,
      explicitSideUrl: avatar360Target?.avatarSideUrl,
    });
  }, [
    avatar360Target?.avatarBackUrl,
    avatar360Target?.avatarFrontUrl,
    avatar360Target?.avatarSideUrl,
    primaryProduct,
  ]);

  if (!avatar360Target || !primaryProduct || !liveFit || !photoSet) return null;

  const companionProducts = avatar360Target.companionProducts || [];
  const allItems = [primaryProduct, ...companionProducts];
  const totalLookPrice = allItems.reduce((s, p) => s + p.price, 0);
  const sizesToPick =
    primaryProduct.availableSizes && primaryProduct.availableSizes.length > 0
      ? primaryProduct.availableSizes.slice(0, 5)
      : ["XS", "S", "M", "L"];

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
        {/* Clean Customer Header (Lifelike Avatar Pictures + Exact Measurements) */}
        <div className="shrink-0 px-5 py-3.5 border-b border-black/[0.07] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
                <Rotate3d className="w-3 h-3" /> 360° Avatar Fit Preview
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4F5F7] text-[#141518] text-[10.5px] font-semibold">
                <Ruler className="w-3 h-3 text-[#244B3B]" />{" "}
                {Math.floor(activeHeight / 12)}&apos;{Math.round(activeHeight % 12)}&quot; •{" "}
                {activeBust}&quot; B • {activeWaist}&quot; W • {activeHips}&quot; H
              </span>
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

        {/* Body: Left = Lifelike Front & Back Avatar Photos | Right = Exact Measurements & Size to Buy */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-4">
          {/* Left: Lifelike Studio Avatar Pictures Only */}
          <div className="rounded-2xl bg-[#F7F8FA] border border-black/[0.06] p-3 flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center p-1 rounded-full bg-white border border-black/[0.07]">
                <button
                  type="button"
                  onClick={() => setAngleView("split")}
                  className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                    angleView === "split"
                      ? "bg-[#141518] text-white"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  <Columns2 className="w-3 h-3" /> Front + Back
                </button>
                <button
                  type="button"
                  onClick={() => setAngleView("front")}
                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition ${
                    angleView === "front"
                      ? "bg-[#141518] text-white"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  Front 0°
                </button>
                <button
                  type="button"
                  onClick={() => setAngleView("back")}
                  className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition ${
                    angleView === "back"
                      ? "bg-[#141518] text-white"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  Back 180°
                </button>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold">
                Recommended: Size {baseFit?.recommendedSize}
              </span>
            </div>

            {angleView === "split" ? (
              <div className="grid grid-cols-2 gap-2.5 h-[360px] sm:h-[420px]">
                <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center py-1 bg-[#F4F5F7] text-[#5C6068]">
                    Front View (0°)
                  </span>
                  <img
                    src={photoSet.frontUrl}
                    alt={`${primaryProduct.title} Front Avatar`}
                    className="w-full flex-1 min-h-0 object-contain bg-white"
                  />
                </div>
                <div className="rounded-2xl bg-white border border-black/[0.06] overflow-hidden flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-center py-1 bg-[#F4F5F7] text-[#5C6068]">
                    Back View (180°)
                  </span>
                  <img
                    src={photoSet.backUrl}
                    alt={`${primaryProduct.title} Back Avatar`}
                    className="w-full flex-1 min-h-0 object-contain bg-white"
                  />
                </div>
              </div>
            ) : (
              <div className="h-[360px] sm:h-[420px] rounded-2xl bg-white border border-black/[0.06] overflow-hidden flex items-center justify-center">
                <img
                  src={angleView === "front" ? photoSet.frontUrl : photoSet.backUrl}
                  alt={primaryProduct.title}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <p className="text-[11px] text-[#5C6068] text-center">
              Lifelike 5&apos;2&quot; avatar preview •{" "}
              <strong className="text-[#141518]">
                {liveFit.lengthComparison.proportionNote}
              </strong>
            </p>
          </div>

          {/* Right: Where It Fits, Where It Doesn't & Which Size to Buy */}
          <div className="flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141518]">
                    Test Sizes on Your Body
                  </span>
                  <span className="text-[11px] font-bold text-[#244B3B]">
                    Buy Size {baseFit?.recommendedSize} ({baseFit?.confidencePct}% Fit)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {sizesToPick.map((sz) => {
                    const active = selectedSize === sz;
                    const isBest = baseFit?.recommendedSize === sz;
                    return (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          active
                            ? "bg-[#141518] text-white border-[#141518]"
                            : "bg-white hover:bg-[#ECEEF2] text-[#141518] border-black/10"
                        }`}
                      >
                        {sz}
                        {isBest ? " ★" : ""}
                      </button>
                    );
                  })}
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-[#CBE2D4] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1D4232] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Exact Fit Verdict (Size {selectedSize})
                    </span>
                    <span className="text-xs font-extrabold text-[#141518]">
                      ${primaryProduct.price}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4E5A54] leading-snug">
                    {liveFit.headlineVerdict}
                  </p>
                </div>

                {/* Zone-by-Zone Breakdown: Where It Fits vs Where It Doesn't */}
                {liveFit.zones.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#686D76]">
                      Measurement Breakdown (Your Body vs. Size {selectedSize})
                    </span>
                    {liveFit.zones.map((z) => {
                      const isWarn = z.feel === "too_tight";
                      return (
                        <div
                          key={z.zone}
                          className={`p-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${
                            isWarn
                              ? "bg-[#FDECEB] border-[#F5C6C2] text-[#9E2A22]"
                              : "bg-white border-black/[0.06] text-[#141518]"
                          }`}
                        >
                          <div>
                            <strong>{z.zone}:</strong> You {z.avatarInches}&quot; vs Item{" "}
                            {z.garmentRange}
                          </div>
                          <span className="font-bold shrink-0">{z.feelLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Included Pieces */}
              <div className="space-y-1.5">
                {allItems.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl bg-[#F7F8FA] border border-black/[0.06] flex items-center gap-2.5"
                  >
                    <div className="w-10 h-12 rounded-lg overflow-hidden bg-white border border-black/[0.06] shrink-0">
                      <GarmentArtwork product={item} className="w-full h-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#141518] truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-[#686D76]">
                        ${item.price} • {item.fitMetadata?.fabricComposition || "Tailored"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-black/[0.07]">
              <button
                type="button"
                onClick={() => {
                  for (const item of allItems) {
                    const itemFit = analyzeExactAvatarFit(
                      {
                        heightInches: activeHeight,
                        bustInches: activeBust,
                        waistInches: activeWaist,
                        hipsInches: activeHips,
                        shoeSize: user?.shoeSize || "7.5",
                      },
                      item
                    );
                    const sz =
                      item.id === primaryProduct.id
                        ? selectedSize
                        : itemFit.recommendedSize;
                    addToBag({
                      productId: item.id,
                      title: item.title,
                      brand: item.brand,
                      price: item.price,
                      size: sz,
                      imageUrl: item.imageUrl,
                      avatarFrontUrl: photoSet.frontUrl,
                      avatarBackUrl: photoSet.backUrl,
                    });
                  }
                  closeAvatar360();
                }}
                className="w-full py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {allItems.length > 1
                  ? `Add Full Outfit to Cart ($${totalLookPrice})`
                  : `Add Size ${selectedSize} to Cart ($${primaryProduct.price})`}
              </button>

              <Link
                href={`/product?id=${encodeURIComponent(primaryProduct.id)}`}
                onClick={closeAvatar360}
                className="w-full py-2.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition"
              >
                Open Full 360° Try-On View <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

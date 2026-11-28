"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Check,
  Columns2,
  Rotate3d,
  Ruler,
  ShoppingBag,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { formatCompactProductTitle } from "@/lib/catalog/compact-title";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { deriveFullBodyDimensionsFromProfile } from "@/lib/three/body-scan-analyzer";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";

export function Avatar360Modal() {
  const {
    avatar360Target,
    closeAvatar360,
    user,
    customAvatar,
    addToBag,
  } = useGwo();

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );

  const primaryProduct = avatar360Target?.primaryProduct || null;

  const baseFit = useMemo(() => {
    if (!primaryProduct) return null;
    return analyzeExactAvatarFit(
      {
        heightInches: bodyDims.heightInches,
        bustInches: bodyDims.bustInches,
        waistInches: bodyDims.waistInches,
        hipsInches: bodyDims.hipsInches,
        shoeSize: bodyDims.shoeSize,
      },
      primaryProduct
    );
  }, [bodyDims, primaryProduct]);

  const [selectedSize, setSelectedSize] = useState<string>("S");
  const [viewMode, setViewMode] = useState<"avatar3d" | "product3d" | "photos">(
    "avatar3d"
  );
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (baseFit?.recommendedSize) {
      setSelectedSize(baseFit.recommendedSize);
    }
    setViewMode("avatar3d");
  }, [baseFit?.recommendedSize, primaryProduct?.id]);

  const liveFit = useMemo(() => {
    if (!primaryProduct) return null;
    return analyzeExactAvatarFit(
      {
        heightInches: bodyDims.heightInches,
        bustInches: bodyDims.bustInches,
        waistInches: bodyDims.waistInches,
        hipsInches: bodyDims.hipsInches,
        shoeSize: bodyDims.shoeSize,
      },
      primaryProduct,
      selectedSize
    );
  }, [bodyDims, primaryProduct, selectedSize]);

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

  const wornSpecs = allItems.map((p, idx) => ({
    product: p,
    selectedSize: idx === 0 ? selectedSize : undefined,
  }));

  return (
    <div
      className="fixed inset-0 z-[135] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={closeAvatar360}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-black/[0.08] overflow-hidden max-h-[92svh] flex flex-col"
      >
        {/* Header — Clean Simple Product Name Only */}
        <div className="px-5 py-3.5 border-b border-black/[0.07] flex items-center justify-between gap-3 shrink-0">
          <h3 className="text-base font-bold text-[#141518] truncate">
            {formatCompactProductTitle(primaryProduct, 42)}
          </h3>

          <button
            type="button"
            onClick={closeAvatar360}
            aria-label="Close"
            className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-4">
          {/* Left: Interactive 3D Avatar / 3D Standalone Garment Object / Studio Photos */}
          <div className="flex flex-col gap-2.5">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06] self-start max-w-full overflow-x-auto">
              <button
                type="button"
                onClick={() => setViewMode("avatar3d")}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition ${
                  viewMode === "avatar3d"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                <Rotate3d className="w-3.5 h-3.5 shrink-0" /> 3D Character
              </button>
              <button
                type="button"
                onClick={() => setViewMode("product3d")}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition ${
                  viewMode === "product3d"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                <Box className="w-3.5 h-3.5 shrink-0" /> Item 360°
              </button>
              <button
                type="button"
                onClick={() => setViewMode("photos")}
                className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition ${
                  viewMode === "photos"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                <Columns2 className="w-3.5 h-3.5 shrink-0" /> Front + Back
              </button>
            </div>

            {viewMode === "avatar3d" && (
              <div className="h-[360px] sm:h-[420px] rounded-2xl bg-white border border-black/[0.08] overflow-hidden">
                <Interactive3DAvatarStage
                  mode="avatar"
                  dimensions={bodyDims}
                  wornPieces={wornSpecs}
                  selectedSize={selectedSize}
                  focusProductId={primaryProduct.id}
                  seamlessStage={false}
                  faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                  customAvatarTurntableMp4Url={customAvatar?.turntableMp4Url}
                  customAvatarTurntablePosterUrl={customAvatar?.turntablePosterUrl}
                  initialYawDeg={0}
                  showHud={false}
                />
              </div>
            )}

            {viewMode === "product3d" && (
              <div className="h-[360px] sm:h-[420px] rounded-2xl gwo-couture-stage-bg border border-[#E5D7CA] overflow-hidden">
                <Interactive3DAvatarStage
                  mode="product"
                  dimensions={bodyDims}
                  singleProduct={primaryProduct}
                  selectedSize={selectedSize}
                  autoSpinDefault={false}
                  initialYawDeg={0}
                  inertiaSpin={true}
                  showHud={false}
                />
              </div>
            )}

            {viewMode === "photos" && (
              <div className="h-[360px] sm:h-[420px] rounded-2xl bg-[#F4F6F9] border border-black/[0.08] p-2.5 grid grid-cols-2 gap-2">
                <div className="relative rounded-xl bg-white overflow-hidden flex items-end justify-center pt-6">
                  <img
                    src={photoSet.frontUrl}
                    alt="Front 0°"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-bold">
                    Front 0°
                  </span>
                </div>
                <div className="relative rounded-xl bg-white overflow-hidden flex items-end justify-center pt-6">
                  <img
                    src={photoSet.backUrl}
                    alt="Back 180°"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-bold">
                    Back 180°
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Exact-Fit Simulator & Checkout */}
          <div className="flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[#141518]">
                    Simulate Size on Your Body
                  </span>
                  <span className="text-[#244B3B]">
                    Best Match: Size {liveFit.recommendedSize} (
                    {liveFit.confidencePct}%)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {sizesToPick.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        selectedSize === sz
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-white text-[#141518] border-black/10 hover:bg-[#EAECEF]"
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-white border border-black/[0.06] space-y-1">
                  <p className="text-xs font-bold text-[#141518] flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5 text-[#244B3B]" />{" "}
                    {liveFit.headlineVerdict}
                  </p>
                  <p className="text-[11px] text-[#5C6068] leading-relaxed">
                    {liveFit.fabricSummary}
                  </p>
                </div>
              </div>

              {/* Zone Breakdown */}
              <div className="space-y-1.5">
                {liveFit.zones.map((z) => (
                  <div
                    key={z.zone}
                    className="px-3 py-2 rounded-xl bg-[#FAFBFD] border border-black/[0.06] flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#141518]">{z.zone}:</span>{" "}
                      <span className="text-[#686D76]">
                        You {z.avatarInches}&quot; vs Garment {z.garmentRange}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold shrink-0">
                      {z.feelLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-black/[0.07]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJustAdded(true);
                    setTimeout(() => setJustAdded(false), 1400);
                    addToBag({
                      productId: primaryProduct.id,
                      title: primaryProduct.title,
                      brand: primaryProduct.brand,
                      price: primaryProduct.price,
                      size: selectedSize,
                      imageUrl: primaryProduct.imageUrl,
                      avatarFrontUrl: photoSet.frontUrl,
                      avatarBackUrl: photoSet.backUrl,
                    });
                  }}
                  className="flex-1 py-2.5 px-4 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {justAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Added Size {selectedSize}!
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-3.5 h-3.5" /> + Bag Piece ($
                      {primaryProduct.price})
                    </>
                  )}
                </button>

                {companionProducts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      allItems.forEach((p) =>
                        addToBag({
                          productId: p.id,
                          title: p.title,
                          brand: p.brand,
                          price: p.price,
                          size: selectedSize,
                          imageUrl: p.imageUrl,
                        })
                      );
                      closeAvatar360();
                    }}
                    className="py-2.5 px-4 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold cursor-pointer"
                  >
                    + Full Outfit (${totalLookPrice})
                  </button>
                )}
              </div>

              <Link
                href={`/product/${encodeURIComponent(primaryProduct.id)}`}
                onClick={closeAvatar360}
                className="w-full py-2 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EF] text-xs font-bold text-[#141518] inline-flex items-center justify-center gap-1"
              >
                Open Full 3D Fit Studio <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

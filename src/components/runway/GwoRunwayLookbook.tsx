"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { buildAiRunwayOutfits } from "@/lib/stylist/runway-ai-outfits";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";

const OCCASION_FILTERS = [
  { id: "all", label: "All AI Outfits" },
  { id: "Date Night", label: "Date Night" },
  { id: "Brunch", label: "Brunch / Chic" },
  { id: "Party", label: "Party / Cocktail" },
  { id: "Work", label: "Work / Tailored" },
  { id: "Weekend", label: "Weekend" },
];

export function GwoRunwayLookbook() {
  const {
    user,
    products,
    addToBag,
    openDropshipCheckout,
    openAvatar360,
    socialDna,
    setSocialModalOpen,
    customAvatar,
  } = useGwo();

  const swipeStartXRef = useRef<number | null>(null);

  const [occasionFilter, setOccasionFilter] = useState("all");
  const [vibeDraft, setVibeDraft] = useState("");
  const [activeVibePrompt, setActiveVibePrompt] = useState("");
  const [extraCount, setExtraCount] = useState(0);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [runwayAngle, setRunwayAngle] = useState<"front" | "back">("front");

  const activeAvatar = useMemo(
    () => ({
      heightInches: user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches,
      bustInches: user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches,
      waistInches: user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches,
      hipsInches: user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches,
      shoeSize: user?.shoeSize || "7.5",
    }),
    [user]
  );

  const runwayOutfits = useMemo(
    () =>
      buildAiRunwayOutfits({
        catalog: products,
        avatar: activeAvatar,
        socialDna,
        occasionFilter,
        vibePrompt: activeVibePrompt,
        extraGeneratedCount: extraCount,
      }),
    [activeAvatar, activeVibePrompt, extraCount, occasionFilter, products, socialDna]
  );

  const safeIdx =
    runwayOutfits.length > 0
      ? ((activeSlideIdx % runwayOutfits.length) + runwayOutfits.length) %
        runwayOutfits.length
      : 0;
  const activeOutfit = runwayOutfits[safeIdx] || null;
  const prevOutfit =
    runwayOutfits.length > 1
      ? runwayOutfits[
          (safeIdx - 1 + runwayOutfits.length) % runwayOutfits.length
        ]
      : null;
  const nextOutfit =
    runwayOutfits.length > 1
      ? runwayOutfits[(safeIdx + 1) % runwayOutfits.length]
      : null;

  const stepRunway = (delta: number) => {
    if (runwayOutfits.length === 0) return;
    setActiveSlideIdx(
      (prev) => (prev + delta + runwayOutfits.length) % runwayOutfits.length
    );
  };

  const handleAddFullOutfitToCart = (openCheckoutAfter = false) => {
    if (!activeOutfit) return;
    for (const piece of activeOutfit.pieces) {
      addToBag({
        productId: piece.product.id,
        title: piece.product.title,
        brand: piece.product.brand,
        price: piece.product.price,
        size: piece.recommendedSize,
        imageUrl: piece.product.imageUrl,
        avatarFrontUrl: activeOutfit.frontAvatarUrl,
        avatarBackUrl: activeOutfit.backAvatarUrl,
      });
    }
    if (openCheckoutAfter) {
      openDropshipCheckout("checkout");
    }
  };

  if (!activeOutfit) return null;

  return (
    <div className="min-h-[calc(100svh-64px)] bg-[#F5F6F8] pb-14">
      <div className="max-w-[1420px] mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* ==================== TOP AI RUNWAY HEADER + INSTAGRAM / PINTEREST SYNC ==================== */}
        <section className="rounded-3xl bg-white border border-black/[0.07] shadow-[0_8px_24px_rgba(20,21,24,0.04)] p-4 sm:p-5 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" /> AI-Curated Full Outfits
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4F5F7] text-[#141518] text-[11px] font-semibold">
                  <Ruler className="w-3 h-3 text-[#244B3B]" />
                  {Math.floor(activeAvatar.heightInches / 12)}&apos;
                  {Math.round(activeAvatar.heightInches % 12)}&quot; •{" "}
                  {activeAvatar.bustInches}&quot; • {activeAvatar.waistInches}&quot; •{" "}
                  {activeAvatar.hipsInches}&quot;
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#141518]">
                For You Runway • Slide to Shop Single Pieces or Full Outfits
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="gwo-runway-link-socials-btn"
                onClick={() => setSocialModalOpen(true)}
                className="px-4 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Instagram className="w-3.5 h-3.5 text-[#F9A8D4]" />
                {socialDna.instagramHandle
                  ? `Synced: ${socialDna.instagramHandle} & Pinterest`
                  : "Link Instagram & Pinterest"}
              </button>

              <button
                type="button"
                id="gwo-runway-more-ai-looks-btn"
                onClick={() => {
                  const nextExtra = extraCount + 2;
                  setExtraCount(nextExtra);
                  setActiveSlideIdx(runwayOutfits.length);
                }}
                className="px-3.5 py-2 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" /> New AI Outfit Ideas
              </button>
            </div>
          </div>

          {/* Occasion Pills + Optional AI Clothing Idea Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2 border-t border-black/[0.06]">
            <div className="flex flex-wrap items-center gap-1.5">
              {OCCASION_FILTERS.map((occ) => {
                const active = occasionFilter === occ.id;
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => {
                      setOccasionFilter(occ.id);
                      setActiveSlideIdx(0);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                      active
                        ? "bg-[#141518] text-white"
                        : "bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    {occ.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <input
                id="gwo-runway-ai-prompt"
                type="text"
                value={vibeDraft}
                onChange={(e) => setVibeDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setActiveVibePrompt(vibeDraft.trim());
                    setActiveSlideIdx(0);
                  }
                }}
                placeholder="Ask AI for ideas (e.g. Paris brunch, silk dress)..."
                className="w-full md:w-64 px-3.5 py-1.5 rounded-full bg-[#F4F5F7] border border-black/10 text-xs text-[#141518]"
              />
              <button
                type="button"
                onClick={() => {
                  setActiveVibePrompt(vibeDraft.trim());
                  setActiveSlideIdx(0);
                }}
                className="px-3.5 py-1.5 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold cursor-pointer shrink-0"
              >
                Ask AI
              </button>
              {activeVibePrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setVibeDraft("");
                    setActiveVibePrompt("");
                  }}
                  aria-label="Reset AI Idea Filter"
                  className="p-1.5 rounded-full bg-[#F1F2F5] text-[#141518] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ==================== SLIDING LIFELIKE AVATAR RUNWAY STAGE ==================== */}
        <section className="rounded-3xl bg-white border border-black/[0.07] shadow-[0_12px_32px_rgba(20,21,24,0.05)] p-4 sm:p-6 space-y-4">
          {/* Stage Top Controls: Outfit Counter + Front / Back / 360° Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#141518] text-white text-xs font-bold">
                Runway Look {String(safeIdx + 1).padStart(2, "0")} /{" "}
                {String(runwayOutfits.length).padStart(2, "0")}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#E7F3EE] text-[#1D4232] text-xs font-bold">
                {activeOutfit.matchScorePct}% Match • {activeOutfit.occasion}
              </span>
            </div>

            <div className="inline-flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
              <button
                type="button"
                id="gwo-runway-angle-front"
                onClick={() => setRunwayAngle("front")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  runwayAngle === "front"
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Front Look
              </button>
              <button
                type="button"
                id="gwo-runway-angle-back"
                onClick={() => setRunwayAngle("back")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  runwayAngle === "back"
                    ? "bg-white text-[#141518] shadow-xs"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                Back Look (180°)
              </button>
              <button
                type="button"
                id="gwo-runway-open-360-btn"
                onClick={() => {
                  const hero = activeOutfit.pieces[0]?.product;
                  if (!hero) return;
                  openAvatar360({
                    title: `${activeOutfit.title} (${activeOutfit.pieces.length}-Piece Outfit)`,
                    primaryProduct: hero,
                    companionProducts: activeOutfit.pieces
                      .slice(1)
                      .map((p) => p.product),
                    avatarFrontUrl: activeOutfit.frontAvatarUrl,
                    avatarBackUrl: activeOutfit.backAvatarUrl,
                    initialAngleMode: "split",
                  });
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold text-[#1D4232] hover:bg-white inline-flex items-center gap-1 cursor-pointer transition"
              >
                <Rotate3d className="w-3.5 h-3.5 text-[#244B3B]" /> 360° Fit
              </button>
            </div>
          </div>

          {/* 3-Model Runway Carousel Stage (Prev Blurred | Active Lifelike Avatar | Next Blurred) */}
          <div
            onTouchStart={(e) => {
              swipeStartXRef.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const startX = swipeStartXRef.current;
              const endX = e.changedTouches[0]?.clientX ?? null;
              swipeStartXRef.current = null;
              if (startX !== null && endX !== null && Math.abs(endX - startX) > 36) {
                stepRunway(endX < startX ? 1 : -1);
              }
            }}
            className="grid grid-cols-[44px_1fr_44px] sm:grid-cols-[56px_1fr_56px] items-center gap-2 rounded-3xl bg-gradient-to-b from-[#FAFBFD] to-[#EEF0F5] border border-black/[0.06] px-2 py-4 min-h-[420px] sm:min-h-[490px]"
          >
            <button
              type="button"
              id="gwo-runway-prev-btn"
              onClick={() => stepRunway(-1)}
              aria-label="Previous Runway Outfit"
              className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 shadow-xs flex items-center justify-center text-[#141518] cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr] items-center gap-3 h-[390px] sm:h-[460px]">
              {/* Left Flanking Previous Runway Model (Desktop) */}
              <div
                onClick={() => stepRunway(-1)}
                className="hidden md:flex h-[340px] items-center justify-center opacity-40 hover:opacity-70 scale-90 blur-[1px] hover:blur-none transition cursor-pointer overflow-hidden"
              >
                {prevOutfit && (
                  <img
                    src={
                      runwayAngle === "front"
                        ? prevOutfit.frontAvatarUrl
                        : prevOutfit.backAvatarUrl
                    }
                    alt={prevOutfit.title}
                    className="h-full w-auto object-contain select-none pointer-events-none"
                  />
                )}
              </div>

              {/* Center Hero Lifelike Avatar Outfit */}
              <div className="relative h-[390px] sm:h-[450px] flex items-center justify-center rounded-2xl bg-white/80 border border-black/[0.05] shadow-xs overflow-hidden">
                <img
                  src={
                    runwayAngle === "front"
                      ? activeOutfit.frontAvatarUrl
                      : activeOutfit.backAvatarUrl
                  }
                  alt={activeOutfit.title}
                  className="mv-m h-full w-auto object-contain select-none pointer-events-none"
                />
                {customAvatar && runwayAngle === "front" && (
                  <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-white/95 border border-black/10 flex items-center gap-1.5 pointer-events-none">
                    <img
                      src={customAvatar.badgeDataUrl}
                      alt="Your Face"
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-[10px] font-bold text-[#141518]">
                      Your Avatar
                    </span>
                  </div>
                )}
              </div>

              {/* Right Flanking Next Runway Model (Desktop) */}
              <div
                onClick={() => stepRunway(1)}
                className="hidden md:flex h-[340px] items-center justify-center opacity-40 hover:opacity-70 scale-90 blur-[1px] hover:blur-none transition cursor-pointer overflow-hidden"
              >
                {nextOutfit && (
                  <img
                    src={
                      runwayAngle === "front"
                        ? nextOutfit.frontAvatarUrl
                        : nextOutfit.backAvatarUrl
                    }
                    alt={nextOutfit.title}
                    className="h-full w-auto object-contain select-none pointer-events-none"
                  />
                )}
              </div>
            </div>

            <button
              type="button"
              id="gwo-runway-next-btn"
              onClick={() => stepRunway(1)}
              aria-label="Next Runway Outfit"
              className="w-10 h-10 sm:w-12 sm:h-12 mx-auto rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 shadow-xs flex items-center justify-center text-[#141518] cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Active Outfit Summary + Buy Full Outfit at Once CTA */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-[#141518]">
                {activeOutfit.title}
              </h2>
              <p className="text-xs text-[#5C6068]">
                {activeOutfit.aiReason} •{" "}
                <strong className="text-[#244B3B]">{activeOutfit.fitHeadline}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                id="gwo-buy-full-outfit-btn"
                onClick={() => handleAddFullOutfitToCart(true)}
                className="px-5 py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition shadow-sm"
              >
                <ShoppingBag className="w-4 h-4 text-[#A7D7C5]" />
                Buy Full Outfit (${activeOutfit.totalPriceUsd})
              </button>

              <button
                type="button"
                id="gwo-cart-full-outfit-btn"
                onClick={() => handleAddFullOutfitToCart(false)}
                className="px-4 py-3 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Full Outfit to Cart
              </button>
            </div>
          </div>
        </section>

        {/* ==================== BUY SINGLE PIECES IN THIS OUTFIT ==================== */}
        <section
          id="gwo-runway-outfit-pieces"
          className="rounded-3xl bg-white border border-black/[0.07] p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#141518]">
                Or Shop Single Pieces from This Outfit ({activeOutfit.pieces.length} Pieces)
              </h3>
              <p className="text-xs text-[#686D76]">
                Every piece includes exact measurement matching for your avatar and 360° Front &amp; Back photos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {activeOutfit.pieces.map((piece) => {
              const prod = piece.product;
              return (
                <article
                  key={prod.id}
                  data-runway-piece-card="true"
                  className="rounded-2xl bg-[#F8F9FB] border border-black/[0.07] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="h-52 bg-white border-b border-black/[0.05] overflow-hidden">
                      <GarmentArtwork product={prod} className="w-full h-full" />
                    </div>

                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Size {piece.recommendedSize} ({piece.confidencePct}% Fit)
                        </span>
                        <span className="text-sm font-extrabold text-[#141518]">
                          ${prod.price}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-[#141518] line-clamp-2 leading-snug">
                        {prod.title}
                      </h4>

                      <p className="text-[11px] text-[#5C6068] line-clamp-2 leading-snug">
                        {prod.fitMetadata?.fabricComposition ||
                          prod.fitMetadata?.descriptionSummary}
                      </p>
                    </div>
                  </div>

                  <div className="px-3 pb-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        addToBag({
                          productId: prod.id,
                          title: prod.title,
                          brand: prod.brand,
                          price: prod.price,
                          size: piece.recommendedSize,
                          imageUrl: prod.imageUrl,
                          avatarFrontUrl: activeOutfit.frontAvatarUrl,
                          avatarBackUrl: activeOutfit.backAvatarUrl,
                        });
                        openDropshipCheckout("checkout");
                      }}
                      className="flex-1 py-2 px-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold cursor-pointer transition"
                    >
                      Buy (${prod.price})
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        addToBag({
                          productId: prod.id,
                          title: prod.title,
                          brand: prod.brand,
                          price: prod.price,
                          size: piece.recommendedSize,
                          imageUrl: prod.imageUrl,
                          avatarFrontUrl: activeOutfit.frontAvatarUrl,
                          avatarBackUrl: activeOutfit.backAvatarUrl,
                        })
                      }
                      className="py-2 px-2.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[11px] font-bold text-[#141518] cursor-pointer transition"
                    >
                      + Cart
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openAvatar360({
                          title: prod.title,
                          primaryProduct: prod,
                          avatarFrontUrl: activeOutfit.frontAvatarUrl,
                          avatarBackUrl: activeOutfit.backAvatarUrl,
                          initialAngleMode: "split",
                        })
                      }
                      aria-label={`360 Fit for ${prod.title}`}
                      className="py-2 px-2.5 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Rotate3d className="w-3 h-3" /> 360°
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

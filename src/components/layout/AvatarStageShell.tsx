"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronUp,
  Compass,
  Home,
  Maximize2,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { GwoLogo } from "../brand/GwoLogo";
import { AvatarModelCanvas } from "../studio/AvatarModelCanvas";
import { useGwo } from "@/context/GwoAppContext";
import { OutfitCheckoutModal } from "../shop/OutfitCheckoutModal";

const NAV_ITEMS = [
  { href: "/", label: "Home & Drops", mobileLabel: "Home", icon: Home },
  { href: "/closet", label: "Your Closet", mobileLabel: "Closet", icon: Shirt },
  { href: "/shop", label: "Go Shopping", mobileLabel: "Shop", icon: Compass },
  { href: "/friends", label: "Socials & Friends", mobileLabel: "Friends", icon: Users },
];

export function AvatarStageShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreenStudio =
    pathname === "/" ||
    pathname === "/closet" ||
    pathname === "/shop" ||
    pathname === "/recommended" ||
    pathname.startsWith("/product");
  const {
    user,
    quota,
    wornProducts,
    activeProductIds,
    isTryingOn,
    liveRenderUrl,
    toastMessage,
    removeWornSlot,
    runHdTryOn,
    setCheckoutModalOpen,
    shareMyClosetAndClaimBonus,
    myCloset,
  } = useGwo();

  const [mobilePipExpanded, setMobilePipExpanded] = useState(false);
  const [mobilePipMinimized, setMobilePipMinimized] = useState(false);

  if (isFullScreenStudio) {
    return <>{children}</>;
  }

  const activeList = [
    { slot: "outerwearId" as const, item: wornProducts.outerwear },
    { slot: "dressId" as const, item: wornProducts.dress },
    { slot: "topId" as const, item: wornProducts.top },
    { slot: "bottomId" as const, item: wornProducts.bottom },
    { slot: "shoesId" as const, item: wornProducts.shoes },
  ].filter((entry) => Boolean(entry.item));

  const ownedSet = new Set(myCloset.map((c) => c.productId));
  const netOutfitPrice = activeList
    .map((e) => e.item!)
    .filter((i) => !ownedSet.has(i.id))
    .reduce((sum, i) => sum + i.price, 0);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF8F5] text-[#181615]">
      {/* ==================== DESKTOP LEFT RAIL ("AVATAR ALWAYS ON SCREEN") ==================== */}
      <aside className="hidden lg:flex lg:w-[356px] lg:shrink-0 lg:flex-col lg:justify-between lg:sticky lg:top-0 lg:h-screen bg-white border-r border-[#E6DFD7] px-5 py-4 overflow-y-auto">
        <div className="space-y-3.5">
          {/* Top Brand Header: Pure 4-Stroke Cursive GWO + Free Try-On Pill */}
          <div className="flex items-center justify-between">
            <GwoLogo height={48} className="text-[#181615]" />
            {quota && (
              <div className="text-right">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3EFEA] text-[#181615] border border-[#E6DFD7]">
                  <Sparkles className="w-3 h-3 text-[#2B5942]" />
                  {quota.totalAvailableToday} Free Tries
                </span>
              </div>
            )}
          </div>

          {/* Persistent Full-Body Avatar Mirror */}
          {user ? (
            <AvatarModelCanvas
              user={user}
              top={wornProducts.top}
              bottom={wornProducts.bottom}
              dress={wornProducts.dress}
              outerwear={wornProducts.outerwear}
              shoes={wornProducts.shoes}
              isScanning={isTryingOn}
              liveRenderUrl={liveRenderUrl}
            />
          ) : (
            <div className="h-[330px] rounded-2xl bg-[#F3EFEA] animate-pulse" />
          )}

          {/* Currently Worn Garment Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-[#6E6762]">
              <span className="font-semibold uppercase tracking-wider">
                Worn on Avatar ({activeProductIds.length})
              </span>
              <button
                type="button"
                onClick={shareMyClosetAndClaimBonus}
                className="inline-flex items-center gap-1 text-[#2B5942] font-semibold hover:underline cursor-pointer"
              >
                <Share2 className="w-3 h-3" /> Share Closet (+3)
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {activeList.map(({ slot, item }) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#FAF8F5] border border-[#E3DAD0] text-[#181615] max-w-full"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: item!.colorHex }}
                  />
                  <span className="truncate max-w-[165px]">
                    {item!.brand} {item!.title.split(" ").slice(0, 3).join(" ")}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeWornSlot(slot)}
                    className="text-[#8C837B] hover:text-[#181615] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Try-On + Multi-Store Outfit Checkout CTA Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={runHdTryOn}
              disabled={isTryingOn}
              className="py-2.5 px-3 rounded-full text-xs font-semibold bg-[#181615] text-[#FAF8F5] hover:bg-[#2F2B29] transition inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              HD Fit Check
            </button>
            <button
              type="button"
              onClick={() => setCheckoutModalOpen(true)}
              className="py-2.5 px-3 rounded-full text-xs font-semibold bg-[#E7F1EC] text-[#2B5942] hover:bg-[#D8EAE1] transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Buy Look (${netOutfitPrice})
            </button>
          </div>
        </div>

        {/* Bottom-Left Navigation Stack (Matches Page 1 Wireframe!) */}
        <nav className="pt-3 mt-3 border-t border-[#EFE9E1] space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  active
                    ? "bg-[#181615] text-[#FAF8F5]"
                    : "text-[#5C5550] hover:bg-[#F3EFEA] hover:text-[#181615]"
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {label}
                </span>
                {href === "/closet" && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-[#EFE9E1] text-[#5C5550]"
                    }`}
                  >
                    {myCloset.length}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ==================== MOBILE TOP HEADER ==================== */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-[#E6DFD7] px-4 py-2.5 flex items-center justify-between">
        <GwoLogo height={40} className="text-[#181615]" />
        <div className="flex items-center gap-2">
          {quota && (
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3EFEA] text-[#181615]">
              {quota.totalAvailableToday} Free Tries
            </span>
          )}
          <button
            type="button"
            onClick={() => setCheckoutModalOpen(true)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#181615] text-white inline-flex items-center gap-1 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" /> ${netOutfitPrice}
          </button>
        </div>
      </header>

      {/* ==================== DYNAMIC RIGHT CONTENT PANE ==================== */}
      <main className="flex-1 min-w-0 pb-28 lg:pb-12">{children}</main>

      {/* ==================== MOBILE FLOATING PiP AVATAR ("ALWAYS ON SCREEN") ==================== */}
      {user && (
        <div className="lg:hidden fixed bottom-16 left-3 z-40">
          {mobilePipMinimized ? (
            <button
              type="button"
              onClick={() => setMobilePipMinimized(false)}
              className="px-3.5 py-2 rounded-full bg-[#181615] text-[#FAF8F5] shadow-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronUp className="w-3.5 h-3.5" /> Avatar ({activeProductIds.length})
            </button>
          ) : (
            <div
              className={`rounded-2xl bg-white border border-[#DED6CC] shadow-2xl overflow-hidden transition-all ${
                mobilePipExpanded ? "w-64 p-3" : "w-32 p-1.5"
              }`}
            >
              <div className="flex items-center justify-between mb-1 px-1">
                <button
                  type="button"
                  onClick={() => setMobilePipExpanded((v) => !v)}
                  className="text-[10px] font-semibold text-[#181615] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Maximize2 className="w-2.5 h-2.5" />
                  {mobilePipExpanded ? "Compact" : "Expand"}
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePipMinimized(true)}
                  aria-label="Minimize avatar panel"
                  className="p-0.5 rounded bg-[#F3EFEA] text-[#5C5550] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div onClick={() => setMobilePipExpanded((v) => !v)} className="cursor-pointer">
                <AvatarModelCanvas
                  user={user}
                  top={wornProducts.top}
                  bottom={wornProducts.bottom}
                  dress={wornProducts.dress}
                  outerwear={wornProducts.outerwear}
                  shoes={wornProducts.shoes}
                  isScanning={isTryingOn}
                  liveRenderUrl={liveRenderUrl}
                  compact={!mobilePipExpanded}
                />
              </div>

              {mobilePipExpanded && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={runHdTryOn}
                    className="flex-1 py-1.5 rounded-full text-[11px] font-semibold bg-[#181615] text-white cursor-pointer"
                  >
                    HD Fit Check
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckoutModalOpen(true)}
                    className="flex-1 py-1.5 rounded-full text-[11px] font-semibold bg-[#E7F1EC] text-[#2B5942] cursor-pointer"
                  >
                    Buy (${netOutfitPrice})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================== MOBILE BOTTOM TAB BAR ==================== */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E6DFD7] grid grid-cols-4 py-1.5 px-2">
        {NAV_ITEMS.map(({ href, mobileLabel, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center py-1 rounded-xl text-[10px] font-semibold ${
                active ? "text-[#181615]" : "text-[#8C837B]"
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{mobileLabel}</span>
            </Link>
          );
        })}
      </nav>

      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm px-4 py-3 rounded-2xl bg-[#181615] text-[#FAF8F5] text-xs font-medium shadow-2xl border border-white/10 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#DFC1B8] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <OutfitCheckoutModal />
    </div>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Database,
  DollarSign,
  HeartHandshake,
  Share2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { calculateBodyTwinSimilarity } from "@/lib/catalog/sizing";

export default function FriendsAndTelemetryPage() {
  const {
    user,
    friends,
    friendFeed,
    telemetry,
    shareMyClosetAndClaimBonus,
    wearProduct,
  } = useGwo();

  const ledger = telemetry?.ledger;
  const pctUsed = ledger
    ? Math.min(100, (ledger.spentUsd / ledger.capUsd) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-10">
      {/* ==================== GIRLS' STYLE CIRCLE ==================== */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#2B5942]">
              Social Closet Network
            </p>
            <h1 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#181615]">
              Your Girls &amp; Body-Twin Closets
            </h1>
            <p className="text-xs sm:text-sm text-[#5C5550] mt-1">
              Compare exact measurements with friends so you always order the right size—and earn referral credit when friends shop your closet.
            </p>
          </div>
          <button
            type="button"
            onClick={shareMyClosetAndClaimBonus}
            className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#181615] text-white inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" /> Invite Girl Group (+3 Free Tries)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {friends.map((friend) => {
            const twinPct = user
              ? calculateBodyTwinSimilarity(user, friend)
              : 90;
            const herItems = friendFeed.filter((i) => i.userId === friend.id);

            return (
              <div
                key={friend.id}
                className="rounded-3xl bg-white border border-[#E6DFD7] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-11 h-11 rounded-full border border-[#D8CFC5] flex items-center justify-center text-sm font-bold text-[#181615]"
                        style={{ backgroundColor: friend.skinTone }}
                      >
                        {friend.displayName[0]}
                      </span>
                      <div>
                        <h3 className="text-sm font-bold text-[#181615]">
                          {friend.displayName}
                        </h3>
                        <p className="text-xs text-[#6E6762]">
                          @{friend.username} • {friend.pinterestVibe}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#E7F1EC] text-[#2B5942]">
                      <HeartHandshake className="w-3 h-3" /> {twinPct}% Twin
                    </span>
                  </div>

                  <p className="text-xs text-[#5C5550]">{friend.bio}</p>

                  <div className="rounded-xl bg-[#FAF8F5] border border-[#EAE3DA] px-3 py-2 text-[11px] text-[#5C5550] flex items-center justify-between">
                    <span>
                      {Math.floor(friend.heightInches / 12)}&apos;
                      {Math.round(friend.heightInches % 12)}&quot; •{" "}
                      {friend.bustInches}&quot;B / {friend.waistInches}&quot;W /{" "}
                      {friend.hipsInches}&quot;H
                    </span>
                    <span className="font-semibold text-[#181615]">
                      Shoe {friend.shoeSize}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6762]">
                      Recent Closet Favorites ({herItems.length})
                    </p>
                    {herItems.slice(0, 2).map((ci) => (
                      <div
                        key={ci.id}
                        className="flex items-center justify-between text-xs bg-[#FAF8F5] px-2.5 py-1.5 rounded-lg"
                      >
                        <span className="truncate pr-2 text-[#181615] font-medium">
                          {ci.product.brand} {ci.product.title} ({ci.purchasedSize})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            wearProduct(ci.product, friend.referralCode)
                          }
                          className="text-[11px] font-semibold text-[#2B5942] hover:underline shrink-0 cursor-pointer"
                        >
                          Try On
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={`/u/${friend.username}`}
                  className="w-full py-2.5 rounded-full text-xs font-semibold bg-[#F3EFEA] hover:bg-[#E7E0D6] text-[#181615] flex items-center justify-center gap-1.5 transition"
                >
                  Open @{friend.username}&apos;s Full Closet{" "}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ==================== FOUNDER $100/MO COMPUTE GUARDRAIL TELEMETRY ==================== */}
      {telemetry && ledger && (
        <section className="rounded-3xl bg-[#181615] text-[#FAF8F5] p-6 sm:p-7 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#DFC1B8] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Founder Free-Beta Guardrail • goodwithonline.com
              </p>
              <h2 className="font-editorial text-2xl sm:text-3xl font-semibold mt-0.5">
                Monthly AI Compute Budget &amp; Shared Catalog Telemetry
              </h2>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-[#E7F1EC]">
              Month: {ledger.monthKey} • Hard Cap Active
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/80">
                Metered Try-On Spend:{" "}
                <strong className="text-white">
                  ${ledger.spentUsd.toFixed(3)}
                </strong>{" "}
                of <strong>${ledger.capUsd.toFixed(2)}</strong> monthly limit
              </span>
              <span className="text-[#DFC1B8] font-semibold">
                {Math.floor((ledger.capUsd - ledger.spentUsd) / 0.075)} HD renders remaining
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#DFC1B8] transition-all duration-500"
                style={{ width: `${Math.max(1.5, pctUsed)}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/65 text-[11px]">
                <DollarSign className="w-3.5 h-3.5 text-[#DFC1B8]" /> Metered Renders
              </div>
              <p className="text-xl font-bold mt-1">{ledger.paidRenders}</p>
              <p className="text-[10px] text-white/55">$0.075 / new combo</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/65 text-[11px]">
                <Zap className="w-3.5 h-3.5 text-[#8CD9B3]" /> $0.00 Cache Hits
              </div>
              <p className="text-xl font-bold mt-1">{ledger.cacheHits}</p>
              <p className="text-[10px] text-white/55">
                Saved ${(ledger.cacheHits * 0.075).toFixed(2)} in GPU cost
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/65 text-[11px]">
                <Database className="w-3.5 h-3.5 text-[#DFC1B8]" /> Shared DB SKUs
              </div>
              <p className="text-xl font-bold mt-1">{telemetry.sharedSkuCount}</p>
              <p className="text-[10px] text-white/55">
                {telemetry.scrapedUrlCount} community-scraped URLs
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-1.5 text-white/65 text-[11px]">
                <Activity className="w-3.5 h-3.5 text-[#8CD9B3]" /> Affiliate Clicks
              </div>
              <p className="text-xl font-bold mt-1">
                {telemetry.totalAffiliateClicks}
              </p>
              <p className="text-[10px] text-white/55">
                {telemetry.friendReferredClicks} via friend closet codes
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

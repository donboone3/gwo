"use client";

import React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HeartHandshake, Lock, Sparkles } from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { ProductCard } from "@/components/shop/ProductCard";
import { calculateBodyTwinSimilarity } from "@/lib/catalog/sizing";

export default function PublicFriendClosetClient() {
  const params = useParams<{ username: string }>();
  const targetHandle = String(params?.username || "maya").toLowerCase();

  const { user, friends, myCloset, friendFeed, wearOutfitSet } = useGwo();

  const isSelf = user?.username.toLowerCase() === targetHandle;
  const owner = isSelf
    ? user
    : friends.find((f) => f.username.toLowerCase() === targetHandle) || null;

  if (!owner) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-4">
        <p className="text-sm text-[#6E6762]">Closet @{targetHandle} not found.</p>
        <Link href="/friends" className="text-xs font-semibold underline">
          Back to Friends
        </Link>
      </div>
    );
  }

  const items = isSelf
    ? myCloset
    : friendFeed.filter((i) => i.userId === owner.id);

  const twinScore =
    user && !isSelf ? calculateBodyTwinSimilarity(user, owner) : 100;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-8">
      <Link
        href="/friends"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6E6762] hover:text-[#181615]"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Girls&apos; Closets
      </Link>

      <section className="rounded-3xl bg-white border border-[#E6DFD7] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <span
            className="w-14 h-14 rounded-full border border-[#D8CFC5] flex items-center justify-center text-lg font-bold text-[#181615] shrink-0"
            style={{ backgroundColor: owner.skinTone }}
          >
            {owner.displayName[0]}
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-editorial text-3xl font-semibold text-[#181615]">
                {owner.displayName}&apos;s Closet
              </h1>
              {!isSelf && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E7F1EC] text-[#2B5942]">
                  <HeartHandshake className="w-3.5 h-3.5" /> {twinScore}% Body Twin to You
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-[#5C5550]">{owner.bio}</p>
            <p className="text-xs text-[#6E6762]">
              Measurements: {Math.floor(owner.heightInches / 12)}&apos;
              {Math.round(owner.heightInches % 12)}&quot; • {owner.bustInches}&quot; Bust •{" "}
              {owner.waistInches}&quot; Waist • {owner.hipsInches}&quot; Hips • Shoe{" "}
              {owner.shoeSize} • Built-in Code: <strong>{owner.referralCode}</strong>
            </p>
          </div>
        </div>

        {owner.isClosetPublic && items.length > 0 && (
          <button
            type="button"
            onClick={() =>
              wearOutfitSet(
                items.map((i) => i.product),
                owner.referralCode
              )
            }
            className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[#181615] text-[#FAF8F5] hover:bg-[#2F2B29] inline-flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" /> Try Her Closet Outfit On Me
          </button>
        )}
      </section>

      {!owner.isClosetPublic && !isSelf ? (
        <div className="rounded-2xl bg-white border border-[#E6DFD7] p-10 text-center space-y-2">
          <Lock className="w-6 h-6 mx-auto text-[#8C837B]" />
          <p className="text-sm font-semibold text-[#181615]">
            @{owner.username}&apos;s closet is currently set to Private.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {items.map((entry) => (
            <ProductCard
              key={entry.id}
              product={entry.product}
              referrerCode={owner.referralCode}
              friendBadgeText={`@${owner.username} wears Size ${entry.purchasedSize} (Worn ${entry.timesWorn}x)`}
              friendNote={entry.reviewNote}
            />
          ))}
        </div>
      )}
    </div>
  );
}

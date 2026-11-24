"use client";

import React from "react";
import { Check, ExternalLink, Sparkles, Truck, X } from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";

export function OutfitCheckoutModal() {
  const {
    checkoutModalOpen,
    setCheckoutModalOpen,
    wornProducts,
    wornOutfit,
    myCloset,
    getSizeRec,
  } = useGwo();

  if (!checkoutModalOpen) return null;

  const activeItems = [
    wornProducts.outerwear,
    wornProducts.dress,
    wornProducts.top,
    wornProducts.bottom,
    wornProducts.shoes,
    wornProducts.accessory,
  ].filter((p): p is NonNullable<typeof p> => Boolean(p));

  const ownedSet = new Set(myCloset.map((c) => c.productId));
  const itemsToBuy = activeItems.filter((i) => !ownedSet.has(i.id));
  const totalToBuy = itemsToBuy.reduce((s, i) => s + i.price, 0);
  const fullOutfitValue = activeItems.reduce((s, i) => s + i.price, 0);
  const slowestEta = itemsToBuy.reduce(
    (max, i) => Math.max(max, i.estDeliveryDays),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#FAF8F5] border border-[#E6DFD7] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E6DFD7] flex items-center justify-between bg-white">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-[#6E6762] font-semibold">
              Multi-Store Outfit Funnel
            </p>
            <h3 className="font-editorial text-2xl font-semibold text-[#181615]">
              Complete Worn Outfit Summary
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutModalOpen(false)}
            className="p-2 rounded-full hover:bg-[#F3EFEA] text-[#6E6762] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-[68vh] overflow-y-auto space-y-3">
          {wornOutfit.referrerCode && (
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E7F1EC] text-[#2B5942] text-xs font-medium">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                Friend Closet Referral Active (<strong>{wornOutfit.referrerCode}</strong>) — supports your friend&apos;s closet automatically at zero extra cost.
              </span>
            </div>
          )}

          {activeItems.map((item) => {
            const isOwned = ownedSet.has(item.id);
            const sizeRec = getSizeRec(item);
            const refParam = wornOutfit.referrerCode
              ? `?ref=${encodeURIComponent(wornOutfit.referrerCode)}`
              : "";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-[#E6DFD7]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6762]">
                      {item.brand} • {item.storeDomain}
                    </span>
                    {isOwned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E7F1EC] text-[#2B5942]">
                        <Check className="w-3 h-3" /> In Your Closet ($0)
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#181615] truncate mt-0.5">
                    {item.title}
                  </p>
                  <p className="text-xs text-[#6E6762] mt-0.5">
                    Size <strong>{sizeRec?.recommendedSize || "S"}</strong> •{" "}
                    {isOwned
                      ? "Ready to wear today"
                      : `Est. ${item.estDeliveryDays}-day delivery`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#181615]">
                    {isOwned ? "$0" : `$${item.price}`}
                  </p>
                  {!isOwned && (
                    <a
                      href={`/api/out/${item.id}${refParam}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-[#181615] text-[#FAF8F5] hover:bg-[#2F2B29] transition"
                    >
                      Checkout <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-white border-t border-[#E6DFD7] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-[#2B5942] font-medium">
              <Truck className="w-4 h-4" />
              <span>
                {itemsToBuy.length === 0
                  ? "100% owned in Your Closet!"
                  : `Full outfit arrives within ${slowestEta} business days`}
              </span>
            </div>
            <p className="text-xs text-[#6E6762] mt-0.5">
              Total Outfit Value: ${fullOutfitValue} • Net to Buy:{" "}
              <strong className="text-[#181615]">${totalToBuy}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCheckoutModalOpen(false)}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-[#D8CFC5] text-[#181615] hover:bg-[#F3EFEA] cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

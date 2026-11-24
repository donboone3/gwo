"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ComputeBudgetLedger,
  EnrichedClosetItem,
  FitRating,
  Product,
  UserProfile,
  WornOutfitState,
} from "@/lib/types";
import { UserQuotaStatus } from "@/lib/tryon/budget-guard";
import { recommendSizeForUser } from "@/lib/catalog/sizing";

interface TelemetryData {
  ledger: ComputeBudgetLedger;
  sharedSkuCount: number;
  scrapedUrlCount: number;
  publicClosetItemCount: number;
  totalAffiliateClicks: number;
  friendReferredClicks: number;
}

interface GwoContextValue {
  loading: boolean;
  user: UserProfile | null;
  quota: UserQuotaStatus | null;
  products: Product[];
  myCloset: EnrichedClosetItem[];
  friends: UserProfile[];
  friendFeed: EnrichedClosetItem[];
  telemetry: TelemetryData | null;
  wornOutfit: WornOutfitState;
  wornProducts: {
    top: Product | null;
    bottom: Product | null;
    dress: Product | null;
    outerwear: Product | null;
    shoes: Product | null;
    accessory: Product | null;
  };
  activeProductIds: string[];
  isTryingOn: boolean;
  liveRenderUrl: string | null;
  toastMessage: string | null;
  checkoutModalOpen: boolean;
  setCheckoutModalOpen: (open: boolean) => void;
  wearProduct: (product: Product, referrerCode?: string) => void;
  wearOutfitSet: (items: Product[], referrerCode?: string) => void;
  removeWornSlot: (slot: keyof WornOutfitState) => void;
  runHdTryOn: () => Promise<void>;
  ingestUrlToSharedCatalog: (url: string) => Promise<{ product: Product; status: string } | null>;
  addToMyCloset: (params: {
    productId: string;
    purchasedSize: string;
    fitRating: FitRating;
    reviewNote: string;
    isPublic?: boolean;
  }) => Promise<void>;
  updateProfilePatch: (patch: Partial<UserProfile>) => Promise<void>;
  shareMyClosetAndClaimBonus: () => Promise<string>;
  getSizeRec: (product: Product) => ReturnType<typeof recommendSizeForUser> | null;
  refreshState: () => Promise<void>;
}

const GwoContext = createContext<GwoContextValue | null>(null);

export function GwoProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [quota, setQuota] = useState<UserQuotaStatus | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [myCloset, setMyCloset] = useState<EnrichedClosetItem[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendFeed, setFriendFeed] = useState<EnrichedClosetItem[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  const [wornOutfit, setWornOutfit] = useState<WornOutfitState>({
    topId: "prod-nike-chill-tank",
    bottomId: "prod-nike-zenvy-leggings",
    outerwearId: "prod-nike-phoenix-hoodie",
    shoesId: "prod-nike-cortez",
  });
  const [isTryingOn, setIsTryingOn] = useState(false);
  const [liveRenderUrl, setLiveRenderUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4200);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.user);
      setQuota(data.quota);
      setProducts(data.products);
      setMyCloset(data.myCloset);
      setFriends(data.friends);
      setFriendFeed(data.friendFeed);
      setTelemetry(data.telemetry);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  const productMap = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const wornProducts = useMemo(
    () => ({
      top: wornOutfit.topId ? productMap.get(wornOutfit.topId) || null : null,
      bottom: wornOutfit.bottomId ? productMap.get(wornOutfit.bottomId) || null : null,
      dress: wornOutfit.dressId ? productMap.get(wornOutfit.dressId) || null : null,
      outerwear: wornOutfit.outerwearId
        ? productMap.get(wornOutfit.outerwearId) || null
        : null,
      shoes: wornOutfit.shoesId ? productMap.get(wornOutfit.shoesId) || null : null,
      accessory: wornOutfit.accessoryId
        ? productMap.get(wornOutfit.accessoryId) || null
        : null,
    }),
    [productMap, wornOutfit]
  );

  const activeProductIds = useMemo(
    () =>
      [
        wornOutfit.outerwearId,
        wornOutfit.dressId,
        wornOutfit.topId,
        wornOutfit.bottomId,
        wornOutfit.shoesId,
        wornOutfit.accessoryId,
      ].filter((id): id is string => Boolean(id)),
    [wornOutfit]
  );

  const wearProduct = useCallback(
    (product: Product, referrerCode?: string) => {
      setLiveRenderUrl(null);
      setWornOutfit((prev) => {
        const next = { ...prev, referrerCode: referrerCode || prev.referrerCode };
        if (product.category === "dress") {
          next.dressId = product.id;
          next.topId = undefined;
          next.bottomId = undefined;
        } else if (product.category === "top") {
          next.topId = product.id;
          next.dressId = undefined;
        } else if (product.category === "bottom") {
          next.bottomId = product.id;
          next.dressId = undefined;
        } else if (product.category === "outerwear") {
          next.outerwearId =
            prev.outerwearId === product.id ? undefined : product.id;
        } else if (product.category === "shoes") {
          next.shoesId = product.id;
        } else if (product.category === "accessory") {
          next.accessoryId = product.id;
        }
        return next;
      });
      showToast(
        referrerCode
          ? `Trying ${product.title} on your Avatar (credits ${referrerCode})`
          : `Layered ${product.title} onto your Avatar`
      );
    },
    [showToast]
  );

  const wearOutfitSet = useCallback(
    (items: Product[], referrerCode?: string) => {
      setLiveRenderUrl(null);
      const next: WornOutfitState = { referrerCode };
      for (const p of items) {
        if (p.category === "dress") next.dressId = p.id;
        else if (p.category === "top") next.topId = p.id;
        else if (p.category === "bottom") next.bottomId = p.id;
        else if (p.category === "outerwear") next.outerwearId = p.id;
        else if (p.category === "shoes") next.shoesId = p.id;
        else if (p.category === "accessory") next.accessoryId = p.id;
      }
      setWornOutfit(next);
      showToast(`Applied ${items.length}-piece complete outfit to your Avatar!`);
    },
    [showToast]
  );

  const removeWornSlot = useCallback((slot: keyof WornOutfitState) => {
    setLiveRenderUrl(null);
    setWornOutfit((prev) => ({ ...prev, [slot]: undefined }));
  }, []);

  const runHdTryOn = useCallback(async () => {
    if (activeProductIds.length === 0) {
      showToast("Pick at least one garment first!");
      return;
    }
    setIsTryingOn(true);
    try {
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: user?.username || "mila",
          productIds: activeProductIds,
        }),
      });
      const data = await res.json();
      if (data.quota) setQuota(data.quota);
      if (data.render?.renderedImageUrl?.startsWith("http")) {
        setLiveRenderUrl(data.render.renderedImageUrl);
      }
      await refreshState();
      showToast(data.message || "HD Studio Fit ready!");
    } finally {
      setTimeout(() => setIsTryingOn(false), 550);
    }
  }, [activeProductIds, refreshState, showToast, user?.username]);

  const ingestUrlToSharedCatalog = useCallback(
    async (url: string) => {
      const res = await fetch("/api/catalog/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, username: user?.username || "mila" }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to import URL");
        return null;
      }
      await refreshState();
      const label =
        data.status === "shared_cache_hit"
          ? "Instant Shared-DB Hit ($0 scrape cost)!"
          : data.status === "refreshed_after_3_days"
          ? "Refreshed stale (>3d) catalog item for all girls!"
          : `Saved ${data.product.brand} piece to GWO Shared Database for everyone!`;
      showToast(label);
      return data as { product: Product; status: string };
    },
    [refreshState, showToast, user?.username]
  );

  const addToMyCloset = useCallback(
    async (params: {
      productId: string;
      purchasedSize: string;
      fitRating: FitRating;
      reviewNote: string;
      isPublic?: boolean;
    }) => {
      const res = await fetch("/api/closet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (res.ok) {
        await refreshState();
        showToast(
          data.bonusGranted > 0
            ? `Added to Your Closet + unlocked +${data.bonusGranted} Free HD Try-Ons!`
            : "Saved to Your Private Closet!"
        );
      }
    },
    [refreshState, showToast]
  );

  const updateProfilePatch = useCallback(
    async (patch: Partial<UserProfile>) => {
      const res = await fetch("/api/state", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      if (res.ok) {
        await refreshState();
        showToast("Updated your profile & exact measurements!");
      }
    },
    [refreshState, showToast]
  );

  const shareMyClosetAndClaimBonus = useCallback(async () => {
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/u/${user?.username || "mila"}`
        : `https://goodwithonline.com/u/${user?.username || "mila"}`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    }

    const res = await fetch("/api/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim_invite_bonus" }),
    });
    const data = await res.json();
    await refreshState();
    showToast(
      data.message || `Copied ${shareUrl} (+3 Bonus Try-Ons unlocked!)`
    );
    return shareUrl;
  }, [refreshState, showToast, user?.username]);

  const getSizeRec = useCallback(
    (product: Product) => {
      if (!user) return null;
      return recommendSizeForUser(user, product, friendFeed);
    },
    [friendFeed, user]
  );

  return (
    <GwoContext.Provider
      value={{
        loading,
        user,
        quota,
        products,
        myCloset,
        friends,
        friendFeed,
        telemetry,
        wornOutfit,
        wornProducts,
        activeProductIds,
        isTryingOn,
        liveRenderUrl,
        toastMessage,
        checkoutModalOpen,
        setCheckoutModalOpen,
        wearProduct,
        wearOutfitSet,
        removeWornSlot,
        runHdTryOn,
        ingestUrlToSharedCatalog,
        addToMyCloset,
        updateProfilePatch,
        shareMyClosetAndClaimBonus,
        getSizeRec,
        refreshState,
      }}
    >
      {children}
    </GwoContext.Provider>
  );
}

export function useGwo() {
  const ctx = useContext(GwoContext);
  if (!ctx) throw new Error("useGwo must be used inside GwoProvider");
  return ctx;
}

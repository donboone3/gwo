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
import { INITIAL_SEED_DB } from "@/lib/db/seed-data";
import {
  CustomerAvatarData,
  loadStoredCustomerAvatar,
  saveStoredCustomerAvatar,
} from "@/lib/avatar/customer-avatar";
import {
  getSafeClothingImageUrl,
  scrapeProductInBrowser,
} from "@/lib/catalog/client-url-scraper";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";

interface TelemetryData {
  ledger: ComputeBudgetLedger;
  sharedSkuCount: number;
  scrapedUrlCount: number;
  publicClosetItemCount: number;
  totalAffiliateClicks: number;
  friendReferredClicks: number;
}

export interface UnifiedBagItem {
  id: string;
  title: string;
  brand: string;
  price: number;
  size: string;
  imageUrl?: string;
  friendRef?: string;
  storeUrl?: string;
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
  showToast: (msg: string) => void;
  checkoutModalOpen: boolean;
  setCheckoutModalOpen: (open: boolean) => void;
  bagItems: UnifiedBagItem[];
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
  bagBump: boolean;
  addToBag: (item: Omit<UnifiedBagItem, "id">) => void;
  removeFromBag: (id: string) => void;
  addUrlModalOpen: boolean;
  setAddUrlModalOpen: (open: boolean) => void;
  activeImportedProduct: Product | null;
  setActiveImportedProduct: (prod: Product | null) => void;
  updateImportedProductImage: (productId: string, imageUrl: string) => void;
  customAvatar: CustomerAvatarData | null;
  saveCustomAvatar: (avatar: CustomerAvatarData) => void;
  clearCustomAvatar: () => void;
  avatarModalOpen: boolean;
  setAvatarModalOpen: (open: boolean) => void;
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

  const [bagItems, setBagItems] = useState<UnifiedBagItem[]>([
    {
      id: "starter-bag-1",
      title: "Ribbed Crop Tank",
      brand: "GWO Studio",
      price: 38,
      size: "S",
      imageUrl:
        "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=320&q=80",
      friendRef: "MAYA-GWO",
    },
  ]);
  const [bagOpen, setBagOpen] = useState(false);
  const [bagBump, setBagBump] = useState(false);
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [activeImportedProduct, setActiveImportedProduct] =
    useState<Product | null>(null);
  const [customAvatar, setCustomAvatar] = useState<CustomerAvatarData | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);

  useEffect(() => {
    const stored = loadStoredCustomerAvatar();
    if (stored) setCustomAvatar(stored);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  const saveCustomAvatar = useCallback(
    (avatar: CustomerAvatarData) => {
      setCustomAvatar(avatar);
      saveStoredCustomerAvatar(avatar);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              skinTone: avatar.skinToneHex,
              avatarPhotoUrl: avatar.fullPhotoDataUrl,
            }
          : prev
      );
      showToast("Your photo avatar is now active across Closet, Runway & 360°!");
    },
    [showToast]
  );

  const clearCustomAvatar = useCallback(() => {
    setCustomAvatar(null);
    saveStoredCustomerAvatar(null);
    showToast("Switched back to default GWO Studio model");
  }, [showToast]);

  const addToBag = useCallback(
    (item: Omit<UnifiedBagItem, "id">) => {
      setBagItems((prev) => [
        ...prev,
        {
          ...item,
          id: `bag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        },
      ]);
      setBagBump(false);
      requestAnimationFrame(() => setBagBump(true));
      setTimeout(() => setBagBump(false), 500);
      showToast(`Added ${item.title} (${item.size}) to your Bag`);
    },
    [showToast]
  );

  const removeFromBag = useCallback((id: string) => {
    setBagItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const applyClientSeedFallback = useCallback(() => {
    let savedPatch: Partial<UserProfile> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("gwo_fit_profile_v3");
        if (raw) savedPatch = JSON.parse(raw) as Partial<UserProfile>;
      } catch {
        // Ignore storage parse error
      }
    }
    const activeUser: UserProfile = {
      ...INITIAL_SEED_DB.profiles[0],
      ...savedPatch,
    };
    const seedProducts = INITIAL_SEED_DB.products;
    const prodMap = new Map(seedProducts.map((p) => [p.id, p]));
    const seedFriends = INITIAL_SEED_DB.profiles.slice(1);
    const friendMap = new Map(seedFriends.map((f) => [f.id, f]));

    const seedMyCloset = INITIAL_SEED_DB.closetItems
      .filter((ci) => ci.userId === activeUser.id)
      .map((ci) => {
        const product = prodMap.get(ci.productId);
        return product ? { ...ci, product, owner: activeUser } : null;
      })
      .filter((x): x is EnrichedClosetItem => x !== null);

    const seedFriendFeed = INITIAL_SEED_DB.closetItems
      .filter((ci) => friendMap.has(ci.userId))
      .map((ci) => {
        const product = prodMap.get(ci.productId);
        const owner = friendMap.get(ci.userId);
        return product && owner ? { ...ci, product, owner } : null;
      })
      .filter((x): x is EnrichedClosetItem => x !== null);

    setUser(activeUser);
    setQuota({
      dailyLimit: 6,
      dailyUsed: 0,
      freeDailyRemaining: 6,
      bonusRemaining: 0,
      totalAvailableToday: 6,
    });
    setProducts(seedProducts);
    setMyCloset(seedMyCloset);
    setFriends(seedFriends);
    setFriendFeed(seedFriendFeed);
    setTelemetry({
      ledger: INITIAL_SEED_DB.budgetLedgers[0],
      sharedSkuCount: seedProducts.length,
      scrapedUrlCount: seedProducts.filter((p) => p.sourceType === "scraped_url").length,
      publicClosetItemCount: INITIAL_SEED_DB.closetItems.length,
      totalAffiliateClicks: 0,
      friendReferredClicks: 0,
    });
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      const res = await fetch(`${base}/api/state`, { cache: "no-store" });
      if (!res.ok) {
        applyClientSeedFallback();
        return;
      }
      const data = await res.json();
      setUser(data.user);
      setQuota(data.quota);
      setProducts(data.products);
      setMyCloset(data.myCloset);
      setFriends(data.friends);
      setFriendFeed(data.friendFeed);
      setTelemetry(data.telemetry);
    } catch {
      applyClientSeedFallback();
    } finally {
      setLoading(false);
    }
  }, [applyClientSeedFallback]);

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

  const updateImportedProductImage = useCallback(
    (productId: string, rawImgUrl: string) => {
      const safeImg = getSafeClothingImageUrl(rawImgUrl, 720) || rawImgUrl;
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, imageUrl: safeImg } : p))
      );
      setActiveImportedProduct((prev) =>
        prev && prev.id === productId ? { ...prev, imageUrl: safeImg } : prev
      );
      setBagItems((prev) =>
        prev.map((b, idx) =>
          idx === prev.length - 1 ? { ...b, imageUrl: safeImg } : b
        )
      );
      showToast("Attached clothing photo to your piece!");
    },
    [showToast]
  );

  const ingestUrlToSharedCatalog = useCallback(
    async (url: string) => {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      let serverProduct: Product | null = null;
      let serverStatus = "newly_scraped_to_shared_db";

      try {
        const res = await fetch(`${base}/api/catalog/ingest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, username: user?.username || "mila" }),
        });
        if (res.ok) {
          const data = await res.json();
          await refreshState();
          serverProduct = data.product as Product;
          serverStatus = data.status;
        }
      } catch {
        // Static export mode: proceed to live browser scraper
      }

      const activeProfile = user || INITIAL_SEED_DB.profiles[0];

      const matchedSeedByUrl = INITIAL_SEED_DB.products.find(
        (p) =>
          p.canonicalUrl.toLowerCase() ===
          url.trim().replace(/\/+$/, "").toLowerCase()
      );

      // Only short-circuit before Jina browser enrichment if serverProduct already has verified /products/ gallery + modelStats!
      if (
        serverProduct &&
        serverProduct.imageUrl &&
        /\/products\/|\/files\//i.test(serverProduct.imageUrl) &&
        (serverProduct.fitMetadata?.galleryImages?.length || 0) >= 2 &&
        Boolean(serverProduct.fitMetadata?.modelStats)
      ) {
        const hydrated: Product = {
          ...serverProduct,
          studioLookIndex:
            serverProduct.studioLookIndex ?? matchedSeedByUrl?.studioLookIndex,
          imageUrl: getSafeClothingImageUrl(serverProduct.imageUrl, 960),
          fitMetadata: serverProduct.fitMetadata
            ? {
                ...serverProduct.fitMetadata,
                galleryImages: serverProduct.fitMetadata.galleryImages?.map((g) => ({
                  ...g,
                  url: getSafeClothingImageUrl(g.url, 960) || g.url,
                })),
              }
            : undefined,
        };
        const fitRec = analyzeExactAvatarFit(activeProfile, hydrated);
        setProducts((prev) => [
          hydrated,
          ...prev.filter((p) => p.id !== hydrated.id),
        ]);
        setActiveImportedProduct(hydrated);
        addToBag({
          brand: hydrated.brand,
          title: hydrated.title,
          price: hydrated.price,
          size: fitRec.recommendedSize,
          imageUrl: hydrated.imageUrl,
          storeUrl: hydrated.canonicalUrl,
        });
        showToast(
          `Matched ${hydrated.brand} ${hydrated.title} → Size ${fitRec.recommendedSize} (${fitRec.confidencePct}% Fit)`
        );
        return { product: hydrated, status: serverStatus };
      }

      // Live Browser Scraper (runs on static GitHub Pages AND enriches server scrape with multi-angle Jina markdown!)
      const existingWithImg = products.find(
        (p) =>
          p.canonicalUrl === url.trim() &&
          Boolean(p.imageUrl) &&
          Boolean(p.fitMetadata)
      );
      if (existingWithImg) {
        const fitRec = analyzeExactAvatarFit(activeProfile, existingWithImg);
        setActiveImportedProduct(existingWithImg);
        addToBag({
          brand: existingWithImg.brand,
          title: existingWithImg.title,
          price: existingWithImg.price,
          size: fitRec.recommendedSize,
          imageUrl: existingWithImg.imageUrl,
          storeUrl: existingWithImg.canonicalUrl,
        });
        showToast(
          `${existingWithImg.brand} ${existingWithImg.title} → Size ${fitRec.recommendedSize} (${fitRec.confidencePct}% Exact Fit)`
        );
        return { product: existingWithImg, status: "shared_cache_hit" };
      }

      const browserScraped = await scrapeProductInBrowser(url);
      const mergedProduct: Product = serverProduct
        ? {
            ...serverProduct,
            studioLookIndex:
              serverProduct.studioLookIndex ?? matchedSeedByUrl?.studioLookIndex,
            brand: browserScraped.product.brand || serverProduct.brand,
            title: browserScraped.product.title || serverProduct.title,
            price: browserScraped.product.price || serverProduct.price,
            imageUrl:
              browserScraped.product.imageUrl ||
              getSafeClothingImageUrl(serverProduct.imageUrl, 960),
            sizeChartInches:
              Object.keys(browserScraped.product.sizeChartInches || {}).length > 0
                ? browserScraped.product.sizeChartInches
                : serverProduct.sizeChartInches,
            fitMetadata:
              browserScraped.product.fitMetadata || serverProduct.fitMetadata,
          }
        : browserScraped.product;

      const fitRec = analyzeExactAvatarFit(activeProfile, mergedProduct);

      setProducts((prev) => [
        mergedProduct,
        ...prev.filter((p) => p.canonicalUrl !== mergedProduct.canonicalUrl),
      ]);
      setActiveImportedProduct(mergedProduct);
      addToBag({
        brand: mergedProduct.brand,
        title: mergedProduct.title,
        price: mergedProduct.price,
        size: fitRec.recommendedSize,
        imageUrl: mergedProduct.imageUrl,
        storeUrl: mergedProduct.canonicalUrl,
      });
      showToast(
        mergedProduct.imageUrl
          ? `Extracted Fit & Photos: Size ${fitRec.recommendedSize} (${fitRec.confidencePct}% Match)`
          : `Calculated Size ${fitRec.recommendedSize} Fit—paste or upload photo if store blocked image`
      );
      return { product: mergedProduct, status: "newly_scraped_to_shared_db" };
    },
    [addToBag, products, refreshState, showToast, user]
  );

  const addToMyCloset = useCallback(
    async (params: {
      productId: string;
      purchasedSize: string;
      fitRating: FitRating;
      reviewNote: string;
      isPublic?: boolean;
    }) => {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      try {
        const res = await fetch(`${base}/api/closet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        if (res.ok) {
          const data = await res.json();
          await refreshState();
          showToast(
            data.bonusGranted > 0
              ? `Added to Your Closet + unlocked +${data.bonusGranted} Free HD Try-Ons!`
              : "Saved to Your Closet!"
          );
          return;
        }
      } catch {
        // Static fallback
      }
      showToast("Saved to Your Public Closet!");
    },
    [refreshState, showToast]
  );

  const updateProfilePatch = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (typeof window !== "undefined") {
        try {
          const prevRaw = window.localStorage.getItem("gwo_fit_profile_v3");
          const prevObj = prevRaw ? (JSON.parse(prevRaw) as Partial<UserProfile>) : {};
          window.localStorage.setItem(
            "gwo_fit_profile_v3",
            JSON.stringify({ ...prevObj, ...patch })
          );
        } catch {
          // Ignore quota/storage error
        }
      }
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      try {
        const res = await fetch(`${base}/api/state`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patch }),
        });
        if (res.ok) {
          await refreshState();
          showToast("Updated your Fit Profile!");
          return;
        }
      } catch {
        // Static fallback
      }
      setUser((prev) => (prev ? { ...prev, ...patch } : prev));
      showToast("Updated your Fit Profile!");
    },
    [refreshState, showToast]
  );

  const shareMyClosetAndClaimBonus = useCallback(async () => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const shareUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${base}/u/${user?.username || "mila"}`
        : `https://goodwithonline.com/u/${user?.username || "mila"}`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl).catch(() => undefined);
    }

    try {
      const res = await fetch(`${base}/api/state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim_invite_bonus" }),
      });
      if (res.ok) {
        const data = await res.json();
        await refreshState();
        showToast(
          data.message || `Copied ${shareUrl} (+3 Bonus Try-Ons unlocked!)`
        );
        return shareUrl;
      }
    } catch {
      // Static fallback
    }
    showToast(`Copied your Closet link: ${shareUrl}`);
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
        showToast,
        checkoutModalOpen,
        setCheckoutModalOpen,
        bagItems,
        bagOpen,
        setBagOpen,
        bagBump,
        addToBag,
        removeFromBag,
        addUrlModalOpen,
        setAddUrlModalOpen,
        activeImportedProduct,
        setActiveImportedProduct,
        updateImportedProductImage,
        customAvatar,
        saveCustomAvatar,
        clearCustomAvatar,
        avatarModalOpen,
        setAvatarModalOpen,
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

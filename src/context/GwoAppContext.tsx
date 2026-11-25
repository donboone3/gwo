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
    const activeUser = INITIAL_SEED_DB.profiles[0];
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

      if (serverProduct && serverProduct.imageUrl) {
        const hydrated: Product = {
          ...serverProduct,
          imageUrl: getSafeClothingImageUrl(serverProduct.imageUrl, 720),
        };
        setProducts((prev) => [
          hydrated,
          ...prev.filter((p) => p.id !== hydrated.id),
        ]);
        setActiveImportedProduct(hydrated);
        addToBag({
          brand: hydrated.brand,
          title: hydrated.title,
          price: hydrated.price,
          size: "S",
          imageUrl: hydrated.imageUrl,
          storeUrl: hydrated.canonicalUrl,
        });
        showToast(`Imported ${hydrated.brand} ${hydrated.title} with photo!`);
        return { product: hydrated, status: serverStatus };
      }

      // Live Browser Scraper (works on static GitHub Pages AND when server lacked image!)
      const existingWithImg = products.find(
        (p) => p.canonicalUrl === url.trim() && Boolean(p.imageUrl)
      );
      if (existingWithImg) {
        setActiveImportedProduct(existingWithImg);
        addToBag({
          brand: existingWithImg.brand,
          title: existingWithImg.title,
          price: existingWithImg.price,
          size: "S",
          imageUrl: existingWithImg.imageUrl,
          storeUrl: existingWithImg.canonicalUrl,
        });
        showToast(
          `Shared-Closet Hit: ${existingWithImg.brand} ${existingWithImg.title}!`
        );
        return { product: existingWithImg, status: "shared_cache_hit" };
      }

      const browserScraped = await scrapeProductInBrowser(url);
      const mergedProduct: Product = serverProduct
        ? {
            ...serverProduct,
            title:
              browserScraped.product.title || serverProduct.title,
            price:
              browserScraped.product.price || serverProduct.price,
            imageUrl:
              browserScraped.product.imageUrl || serverProduct.imageUrl,
          }
        : browserScraped.product;

      setProducts((prev) => [
        mergedProduct,
        ...prev.filter((p) => p.canonicalUrl !== mergedProduct.canonicalUrl),
      ]);
      setActiveImportedProduct(mergedProduct);
      addToBag({
        brand: mergedProduct.brand,
        title: mergedProduct.title,
        price: mergedProduct.price,
        size: "S",
        imageUrl: mergedProduct.imageUrl,
        storeUrl: mergedProduct.canonicalUrl,
      });
      showToast(
        mergedProduct.imageUrl
          ? `Imported ${mergedProduct.brand} ${mergedProduct.title}!`
          : `Added ${mergedProduct.brand} piece—paste or upload its photo if blocked by store`
      );
      return { product: mergedProduct, status: "newly_scraped_to_shared_db" };
    },
    [addToBag, products, refreshState, showToast, user?.username]
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

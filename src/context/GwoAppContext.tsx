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
  EndlessAiOutfit,
  EnrichedClosetItem,
  FitRating,
  Product,
  SocialStyleDNA,
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
  pullLiveShopifyStoreRack,
  scrapeProductInBrowser,
} from "@/lib/catalog/client-url-scraper";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  ARCHETYPE_META,
  getDefaultSocialStyleDNA,
  loadStoredSocialStyleDNA,
  reinforceSocialDnaFromOutfit,
  saveStoredSocialStyleDNA,
} from "@/lib/social/social-style-dna";
import { calculateDropshipEconomics } from "@/lib/dropship/aliexpress-dropship";
import {
  buildDropshipOrderFromBag,
  DropshipFulfillmentOrder,
  getStarterSampleDropshipOrders,
  loadStoredDropshipOrders,
  saveStoredDropshipOrders,
} from "@/lib/dropship/dropship-fulfillment";

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
  avatarFrontUrl?: string;
  avatarBackUrl?: string;
  slot?: "top" | "pants" | "full" | "shoes" | "accessory";
  friendRef?: string;
  storeUrl?: string;
  productId?: string;
}

export interface UploadedClosetPiece {
  id: string;
  title: string;
  slot: "top" | "pants" | "full";
  imageUrl: string;
  colorName?: string;
  createdAt: string;
}

export interface PurchasedClosetEntry {
  id: string;
  productId?: string;
  title: string;
  brand: string;
  price: number;
  size: string;
  imageUrl?: string;
  avatarFrontUrl?: string;
  avatarBackUrl?: string;
  lookIndex?: number;
  slot: "top" | "pants" | "full" | "shoes" | "accessory";
  purchasedAt: string;
}

export interface Avatar360Target {
  title: string;
  primaryProduct: Product;
  companionProducts?: Product[];
  avatarFrontUrl?: string;
  avatarBackUrl?: string;
  avatarSideUrl?: string;
  initialAngleMode?: "front" | "back" | "split" | "spin";
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
  purchasedItems: PurchasedClosetEntry[];
  uploadedClosetPieces: UploadedClosetPiece[];
  addUploadedClosetPiece: (piece: Omit<UploadedClosetPiece, "id" | "createdAt">) => void;
  removeUploadedClosetPiece: (id: string) => void;
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
  socialDna: SocialStyleDNA;
  updateSocialDna: (dna: SocialStyleDNA) => void;
  toggleLikeAiOutfit: (outfit: EndlessAiOutfit) => void;
  socialModalOpen: boolean;
  setSocialModalOpen: (open: boolean) => void;
  dropshipMarkup: number;
  setDropshipMarkup: (multiplier: number) => void;
  importDropshipProductToStore: (product: Product) => Promise<void>;
  dropshipCheckoutOpen: boolean;
  dropshipCheckoutTab: "checkout" | "fulfillment";
  setDropshipCheckoutTab: (tab: "checkout" | "fulfillment") => void;
  openDropshipCheckout: (tab?: "checkout" | "fulfillment") => void;
  closeDropshipCheckout: () => void;
  dropshipOrders: DropshipFulfillmentOrder[];
  placeDropshipOrder: (customer: {
    customerName: string;
    customerEmail: string;
    shippingAddress: string;
    cityPostal: string;
  }) => DropshipFulfillmentOrder | null;
  dispatchDropshipOrder: (orderId: string) => void;
  avatar360Target: Avatar360Target | null;
  openAvatar360: (target: Avatar360Target) => void;
  closeAvatar360: () => void;
  wearProduct: (product: Product, referrerCode?: string) => void;
  wearOutfitSet: (items: Product[], referrerCode?: string) => void;
  removeWornSlot: (slot: keyof WornOutfitState) => void;
  runHdTryOn: () => Promise<void>;
  ingestUrlToSharedCatalog: (url: string) => Promise<{ product: Product; status: string } | null>;
  pullStoreRackToCatalog: (domainOrUrl: string, limit?: number) => Promise<Product[]>;
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

const ASSET_BASE_CTX = process.env.NEXT_PUBLIC_BASE_PATH || "";

const DEFAULT_PURCHASED_CLOSET: PurchasedClosetEntry[] = [
  {
    id: "bought-look-0-top",
    title: "Charcoal Ribbed Crop Tank",
    brand: "Bought • My Closet",
    price: 38,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_0_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_0.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_0_back.webp`,
    lookIndex: 0,
    slot: "top",
    purchasedAt: "2026-11-10T12:00:00Z",
  },
  {
    id: "bought-look-0-pants",
    title: "Washed Denim Maxi Skirt",
    brand: "Bought • My Closet",
    price: 96,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_0_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_0.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_0_back.webp`,
    lookIndex: 0,
    slot: "pants",
    purchasedAt: "2026-11-10T12:00:00Z",
  },
  {
    id: "bought-look-1-top",
    title: "Oat Half-Zip Sweatshirt",
    brand: "Bought • My Closet",
    price: 74,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_1_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_1.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_1_back.webp`,
    lookIndex: 1,
    slot: "top",
    purchasedAt: "2026-11-12T12:00:00Z",
  },
  {
    id: "bought-look-1-pants",
    title: "Oat Wide Sweatpants",
    brand: "Bought • My Closet",
    price: 68,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_1_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_1.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_1_back.webp`,
    lookIndex: 1,
    slot: "pants",
    purchasedAt: "2026-11-12T12:00:00Z",
  },
  {
    id: "bought-look-2-top",
    title: "Cream Cable-Knit Cardigan & Tee",
    brand: "Bought • My Closet",
    price: 112,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_2_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_2.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_2_back.webp`,
    lookIndex: 2,
    slot: "top",
    purchasedAt: "2026-11-14T12:00:00Z",
  },
  {
    id: "bought-look-2-pants",
    title: "Heather Grey Pleated Trousers",
    brand: "Bought • My Closet",
    price: 98,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_2_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_2.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_2_back.webp`,
    lookIndex: 2,
    slot: "pants",
    purchasedAt: "2026-11-14T12:00:00Z",
  },
  {
    id: "bought-look-7-top",
    title: "Black Bomber & White Crop Tee",
    brand: "Bought • My Closet",
    price: 148,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_7_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_7.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_7_back.webp`,
    lookIndex: 7,
    slot: "top",
    purchasedAt: "2026-11-16T12:00:00Z",
  },
  {
    id: "bought-look-7-pants",
    title: "Khaki Parachute Cargo Pants",
    brand: "Bought • My Closet",
    price: 94,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/signature/look_7_thumb.webp`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_7.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_7_back.webp`,
    lookIndex: 7,
    slot: "pants",
    purchasedAt: "2026-11-16T12:00:00Z",
  },
  {
    id: "bought-look-8-dress",
    productId: "prod-babyboo-cornelia-red",
    title: "Cornelia Mini Dress - Red",
    brand: "Bought • Babyboo",
    price: 132,
    size: "S",
    imageUrl: `${ASSET_BASE_CTX}/models/catalog/cornelia_2.webp?v=prod1`,
    avatarFrontUrl: `${ASSET_BASE_CTX}/models/signature/look_8.webp`,
    avatarBackUrl: `${ASSET_BASE_CTX}/models/signature/look_8_back.webp`,
    lookIndex: 8,
    slot: "full",
    purchasedAt: "2026-11-20T12:00:00Z",
  },
];

function inferClosetSlotFromTitle(
  title: string,
  explicit?: "top" | "pants" | "full" | "shoes" | "accessory"
): "top" | "pants" | "full" | "shoes" | "accessory" {
  if (explicit) return explicit;
  const t = title.toLowerCase();
  if (/(dress|gown|slip|romper)/.test(t)) return "full";
  if (/(trouser|pant|jean|denim|skirt|cargo|legging)/.test(t)) return "pants";
  if (/(heel|stiletto|slingback|boot|sneaker|shoe|flat)/.test(t)) return "shoes";
  if (/(bag|tote|purse|belt)/.test(t)) return "accessory";
  return "top";
}

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
      productId: "prod-ae-espresso-corset",
      title: "Sculpted Espresso Boned Satin Basque Corset Top",
      brand: "GWO × Atelier",
      price: 52,
      size: "S",
      imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/dropship/ds_espresso_corset_top.webp`,
      avatarFrontUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/runway_ai/ae_outfit_0_front.webp`,
      avatarBackUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/runway_ai/ae_outfit_0_back.webp`,
      slot: "top",
    },
    {
      id: "starter-bag-2",
      productId: "prod-ae-champagne-trousers",
      title: "High-Waist Champagne Pleated Fluid Wide-Leg Trousers",
      brand: "GWO × Atelier",
      price: 54,
      size: "S",
      imageUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/dropship/ds_champagne_wide_trousers.webp`,
      avatarFrontUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/runway_ai/ae_outfit_0_front.webp`,
      avatarBackUrl: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/models/runway_ai/ae_outfit_0_back.webp`,
      slot: "pants",
    },
  ]);
  const [purchasedItems, setPurchasedItems] = useState<PurchasedClosetEntry[]>(
    DEFAULT_PURCHASED_CLOSET
  );
  const [uploadedClosetPieces, setUploadedClosetPieces] = useState<
    UploadedClosetPiece[]
  >([]);
  const [bagOpen, setBagOpen] = useState(false);
  const [bagBump, setBagBump] = useState(false);
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [activeImportedProduct, setActiveImportedProduct] =
    useState<Product | null>(null);
  const [customAvatar, setCustomAvatar] = useState<CustomerAvatarData | null>(null);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [socialDna, setSocialDna] = useState<SocialStyleDNA>(() =>
    getDefaultSocialStyleDNA()
  );
  const [socialModalOpen, setSocialModalOpen] = useState(false);
  const [dropshipMarkup, setDropshipMarkupState] = useState<number>(2.85);
  const [dropshipCheckoutOpen, setDropshipCheckoutOpen] = useState(false);
  const [dropshipCheckoutTab, setDropshipCheckoutTab] = useState<
    "checkout" | "fulfillment"
  >("checkout");
  const [dropshipOrders, setDropshipOrders] = useState<
    DropshipFulfillmentOrder[]
  >(() => getStarterSampleDropshipOrders(INITIAL_SEED_DB.products));
  const [avatar360Target, setAvatar360Target] =
    useState<Avatar360Target | null>(null);

  const openDropshipCheckout = useCallback(
    (tab: "checkout" | "fulfillment" = "checkout") => {
      setDropshipCheckoutTab(tab);
      setDropshipCheckoutOpen(true);
    },
    []
  );

  const closeDropshipCheckout = useCallback(() => {
    setDropshipCheckoutOpen(false);
  }, []);

  const openAvatar360 = useCallback((target: Avatar360Target) => {
    setAvatar360Target(target);
  }, []);

  const closeAvatar360 = useCallback(() => {
    setAvatar360Target(null);
  }, []);

  useEffect(() => {
    const stored = loadStoredCustomerAvatar();
    if (stored) setCustomAvatar(stored);
    const storedSocial = loadStoredSocialStyleDNA();
    if (storedSocial) setSocialDna(storedSocial);
    const storedOrders = loadStoredDropshipOrders();
    if (storedOrders && storedOrders.length > 0) {
      setDropshipOrders(storedOrders);
    }
    try {
      const rawBought = window.localStorage.getItem("gwo_purchased_closet_v1");
      if (rawBought) {
        const parsed = JSON.parse(rawBought) as PurchasedClosetEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPurchasedItems(parsed);
        }
      }
      const rawUp = window.localStorage.getItem("gwo_uploaded_closet_v1");
      if (rawUp) {
        const parsedUp = JSON.parse(rawUp) as UploadedClosetPiece[];
        if (Array.isArray(parsedUp)) {
          setUploadedClosetPieces(parsedUp);
        }
      }
    } catch {
      // Ignore storage error
    }
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

  const updateSocialDna = useCallback(
    (dna: SocialStyleDNA) => {
      setSocialDna(dna);
      saveStoredSocialStyleDNA(dna);
      showToast(
        `Synced Social DNA (${dna.instagramHandle || "Your Aesthetic"}) → AI Outfit Feed calibrated!`
      );
    },
    [showToast]
  );

  const toggleLikeAiOutfit = useCallback(
    (outfit: EndlessAiOutfit) => {
      setSocialDna((prev) => {
        const alreadyLiked = prev.likedOutfitIds.includes(outfit.id);
        const next = reinforceSocialDnaFromOutfit(
          prev,
          outfit.id,
          outfit.items,
          outfit.matchedArchetype
        );
        saveStoredSocialStyleDNA(next);
        const archLabel = ARCHETYPE_META[outfit.matchedArchetype].label;
        showToast(
          alreadyLiked
            ? `Removed ${outfit.title} from liked looks`
            : `AI Stylist learned "${outfit.title}" → boosting ${archLabel} looks!`
        );
        return next;
      });
    },
    [showToast]
  );

  const setDropshipMarkup = useCallback(
    (multiplier: number) => {
      const clamped = Math.max(1.5, Math.min(4.5, Number(multiplier.toFixed(2))));
      setDropshipMarkupState(clamped);
      setProducts((prev) =>
        prev.map((p) => {
          if (!p.dropship) return p;
          const econ = calculateDropshipEconomics(
            p.dropship.wholesaleCostUsd,
            p.dropship.shippingCostUsd,
            clamped
          );
          return {
            ...p,
            price: econ.retailPriceUsd,
            dropship: {
              ...p.dropship,
              profitMarginUsd: econ.profitMarginUsd,
              marginPct: econ.marginPct,
            },
          };
        })
      );
      showToast(`Store Dropship Markup set to ${clamped}x — live margins recalculated`);
    },
    [showToast]
  );

  const importDropshipProductToStore = useCallback(
    async (product: Product) => {
      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      setProducts((prev) => [
        product,
        ...prev.filter(
          (p) => p.id !== product.id && p.canonicalUrl !== product.canonicalUrl
        ),
      ]);
      setActiveImportedProduct(product);
      try {
        await fetch(`${base}/api/dropship/aliexpress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: product.canonicalUrl,
            markupMultiplier: dropshipMarkup,
            customTitle: product.title,
            customWholesaleUsd: product.dropship?.wholesaleCostUsd,
            customImageUrl: product.imageUrl,
            persistToStore: true,
          }),
          signal: AbortSignal.timeout(2500),
        });
      } catch {
        // Static export mode uses local state seamlessly
      }
      showToast(
        `Imported "${product.title}" to GWO Dropship Store ($${product.price} retail • +$${product.dropship?.profitMarginUsd.toFixed(2) || "0"} profit)`
      );
    },
    [dropshipMarkup, showToast]
  );

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

  const addUploadedClosetPiece = useCallback(
    (piece: Omit<UploadedClosetPiece, "id" | "createdAt">) => {
      const entry: UploadedClosetPiece = {
        ...piece,
        id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      setUploadedClosetPieces((prev) => {
        const next = [entry, ...prev];
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              "gwo_uploaded_closet_v1",
              JSON.stringify(next)
            );
          } catch {
            // Ignore quota
          }
        }
        return next;
      });
      showToast(`Uploaded "${piece.title}" to your Closet!`);
    },
    [showToast]
  );

  const removeUploadedClosetPiece = useCallback((id: string) => {
    setUploadedClosetPieces((prev) => {
      const next = prev.filter((x) => x.id !== id);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "gwo_uploaded_closet_v1",
            JSON.stringify(next)
          );
        } catch {
          // Ignore quota
        }
      }
      return next;
    });
  }, []);

  const placeDropshipOrder = useCallback(
    (customer: {
      customerName: string;
      customerEmail: string;
      shippingAddress: string;
      cityPostal: string;
    }) => {
      if (bagItems.length === 0) return null;
      const created = buildDropshipOrderFromBag({
        bagItems,
        catalog: products.length > 0 ? products : INITIAL_SEED_DB.products,
        ...customer,
      });
      setDropshipOrders((prev) => {
        const next = [created, ...prev];
        saveStoredDropshipOrders(next);
        return next;
      });

      // Automatically unlock all newly purchased items inside the customer's Closet!
      const nowIso = new Date().toISOString();
      const newPurchased: PurchasedClosetEntry[] = bagItems.map((b, idx) => ({
        id: `bought-${Date.now()}-${idx}`,
        productId: b.productId,
        title: b.title,
        brand: "Bought • GWO",
        price: b.price,
        size: b.size,
        imageUrl: b.imageUrl,
        avatarFrontUrl: b.avatarFrontUrl,
        avatarBackUrl: b.avatarBackUrl,
        slot: inferClosetSlotFromTitle(b.title, b.slot),
        purchasedAt: nowIso,
      }));
      setPurchasedItems((prev) => {
        const next = [...newPurchased, ...prev];
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              "gwo_purchased_closet_v1",
              JSON.stringify(next)
            );
          } catch {
            // Ignore quota
          }
        }
        return next;
      });

      setBagItems([]);
      showToast(
        `Order ${created.orderId} confirmed — new items added to your Closet!`
      );
      return created;
    },
    [bagItems, products, showToast]
  );

  const dispatchDropshipOrder = useCallback(
    (orderId: string) => {
      const tracking = `AE-CHOICE-${String(Math.floor(100000 + (Date.now() % 900000)))}`;
      setDropshipOrders((prev) => {
        const next = prev.map((o) =>
          o.orderId === orderId
            ? {
                ...o,
                status: "dispatched_choice_air" as const,
                trackingNumber: tracking,
              }
            : o
        );
        saveStoredDropshipOrders(next);
        return next;
      });
      showToast(`Dispatched ${orderId} via AliExpress Choice Direct Air (${tracking})!`);
    },
    [showToast]
  );

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
      const activeProfile = user || INITIAL_SEED_DB.profiles[0];
      const normalizedTarget = url.trim().replace(/\/+$/, "").toLowerCase();

      // Instant <5ms cache hit if this exact URL is already hydrated in memory with gallery & fitMetadata!
      const existingWithImg = products.find(
        (p) =>
          p.canonicalUrl.replace(/\/+$/, "").toLowerCase() === normalizedTarget &&
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

      const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
      let serverProduct: Product | null = null;
      let serverStatus = "newly_scraped_to_shared_db";

      // Run browser Tier-0 / Jina scrape in parallel with optional server DB write so static & dev are both <200ms!
      const [browserScraped] = await Promise.all([
        scrapeProductInBrowser(url),
        (async () => {
          try {
            const res = await fetch(`${base}/api/catalog/ingest`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url, username: user?.username || "mila" }),
              signal: AbortSignal.timeout(3500),
            });
            if (res.ok) {
              const data = await res.json();
              serverProduct = data.product as Product;
              serverStatus = data.status;
            }
          } catch {
            // Static export mode: browserScraped handles everything cleanly
          }
        })(),
      ]);

      const matchedSeedByUrl = INITIAL_SEED_DB.products.find(
        (p) => p.canonicalUrl.replace(/\/+$/, "").toLowerCase() === normalizedTarget
      );

      const mergedProduct: Product = serverProduct
        ? {
            ...(serverProduct as Product),
            studioLookIndex:
              (serverProduct as Product).studioLookIndex ??
              matchedSeedByUrl?.studioLookIndex,
            brand: browserScraped.product.brand || (serverProduct as Product).brand,
            title: browserScraped.product.title || (serverProduct as Product).title,
            price: browserScraped.product.price || (serverProduct as Product).price,
            colorHex:
              browserScraped.product.colorHex || (serverProduct as Product).colorHex,
            colorName:
              browserScraped.product.colorName || (serverProduct as Product).colorName,
            imageUrl:
              browserScraped.product.imageUrl ||
              getSafeClothingImageUrl((serverProduct as Product).imageUrl, 960),
            sizeChartInches:
              Object.keys(browserScraped.product.sizeChartInches || {}).length > 0
                ? browserScraped.product.sizeChartInches
                : (serverProduct as Product).sizeChartInches,
            fitMetadata:
              browserScraped.product.fitMetadata ||
              (serverProduct as Product).fitMetadata,
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
          ? `Extracted Fit & 3D Mock: Size ${fitRec.recommendedSize} (${fitRec.confidencePct}% Match)`
          : `Calculated Size ${fitRec.recommendedSize} Fit—paste or upload photo if store blocked image`
      );
      return { product: mergedProduct, status: serverStatus };
    },
    [addToBag, products, showToast, user]
  );

  const pullStoreRackToCatalog = useCallback(
    async (domainOrUrl: string, limit = 6): Promise<Product[]> => {
      const pulled = await pullLiveShopifyStoreRack(domainOrUrl, limit);
      if (pulled.length > 0) {
        setProducts((prev) => {
          const pulledUrls = new Set(
            pulled.map((x) => x.canonicalUrl.replace(/\/+$/, "").toLowerCase())
          );
          const remaining = prev.filter(
            (x) => !pulledUrls.has(x.canonicalUrl.replace(/\/+$/, "").toLowerCase())
          );
          return [...pulled, ...remaining];
        });
        showToast(
          `Pulled ${pulled.length} live garments from ${pulled[0].brand} with 3D Exact-Fit Sizing!`
        );
      }
      return pulled;
    },
    [showToast]
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
        purchasedItems,
        uploadedClosetPieces,
        addUploadedClosetPiece,
        removeUploadedClosetPiece,
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
        socialDna,
        updateSocialDna,
        toggleLikeAiOutfit,
        socialModalOpen,
        setSocialModalOpen,
        dropshipMarkup,
        setDropshipMarkup,
        importDropshipProductToStore,
        dropshipCheckoutOpen,
        dropshipCheckoutTab,
        setDropshipCheckoutTab,
        openDropshipCheckout,
        closeDropshipCheckout,
        dropshipOrders,
        placeDropshipOrder,
        dispatchDropshipOrder,
        avatar360Target,
        openAvatar360,
        closeAvatar360,
        wearProduct,
        wearOutfitSet,
        removeWornSlot,
        runHdTryOn,
        ingestUrlToSharedCatalog,
        pullStoreRackToCatalog,
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

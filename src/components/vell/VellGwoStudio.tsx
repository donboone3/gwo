"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  Dices,
  ImagePlus,
  Instagram,
  Layers,
  Rotate3d,
  Ruler,
  ScanLine,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import {
  H,
  H_BACK,
  LOFT_BG_URL,
  SIGNATURE_BADGE_URL,
  STUDIO_LOOKS,
} from "./vell-data";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { useGwo, UploadedClosetPiece } from "@/context/GwoAppContext";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { buildSynthetic3DProductFromPiece } from "@/lib/catalog/closet-look-3d-mapper";
import { deriveStandardApparelSize } from "@/lib/catalog/sizing";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { ARCHETYPE_META } from "@/lib/social/social-style-dna";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import { Worn3DPieceSpec } from "@/lib/three/parametric-3d-engine";
import { Product } from "@/lib/types";

type WardrobeTab =
  | "mix"
  | "outfits"
  | "bought"
  | "store"
  | "uploaded"
  | "saved";

type DressSlotKey = "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "belt";

interface DressedOutfitSlots {
  topId: string | null;
  bottomId: string | null;
  dressId: string | null;
  outerwearId: string | null;
  shoesId: string | null;
  bagId: string | null;
  beltId: string | null;
}

interface SavedCustom3DOutfit {
  id: string;
  name: string;
  slots: DressedOutfitSlots;
  createdAt: string;
}

const CUSTOM_OUTFITS_KEY = "gwo_saved_custom_outfits_v3";

function classifyProductSlot(p: Product): DressSlotKey {
  if (p.category === "dress") return "dress";
  if (p.category === "outerwear") return "outerwear";
  if (p.category === "bottom") return "bottom";
  if (p.category === "shoes") return "shoes";
  if (p.category === "accessory") {
    return /belt/i.test(p.title) ? "belt" : "bag";
  }
  return "top";
}

function slotsFromProductIds(
  ids: string[],
  byId: Map<string, Product>
): DressedOutfitSlots {
  const next: DressedOutfitSlots = {
    topId: null,
    bottomId: null,
    dressId: null,
    outerwearId: null,
    shoesId: null,
    bagId: null,
    beltId: null,
  };
  for (const id of ids) {
    const prod = byId.get(id);
    if (!prod) continue;
    const slot = classifyProductSlot(prod);
    if (slot === "dress") next.dressId = prod.id;
    else if (slot === "top") next.topId = prod.id;
    else if (slot === "bottom") next.bottomId = prod.id;
    else if (slot === "outerwear") next.outerwearId = prod.id;
    else if (slot === "shoes") next.shoesId = prod.id;
    else if (slot === "bag") next.bagId = prod.id;
    else if (slot === "belt") next.beltId = prod.id;
  }
  return next;
}

export function VellGwoStudio() {
  const router = useRouter();
  const {
    user,
    products,
    addToBag,
    bagItems,
    purchasedItems,
    uploadedClosetPieces,
    addUploadedClosetPiece,
    removeUploadedClosetPiece,
    shareMyClosetAndClaimBonus,
    setAddUrlModalOpen,
    activeImportedProduct,
    setActiveImportedProduct,
    customAvatar,
    setAvatarModalOpen,
    socialDna,
    setSocialModalOpen,
    openAvatar360,
    openDropshipCheckout,
    showToast,
  } = useGwo();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const centerStageRef = useRef<HTMLDivElement | null>(null);
  const dragPillRef = useRef<HTMLDivElement | null>(null);

  // Laser Scan-Beam Sweep & Drag-to-Wear (Original Loft Closet Properties!)
  const [scanPulseKey, setScanPulseKey] = useState(0);
  const [dragProduct, setDragProduct] = useState<Product | null>(null);
  const [overAvatar, setOverAvatar] = useState(false);

  const triggerScanBeam = useCallback(() => {
    setScanPulseKey((k) => k + 1);
  }, []);

  // Full store catalog (always immediately available even before async state hydration)
  const storeCatalog = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of buildTopLineAliExpressDropshipCatalog()) {
      map.set(p.id, p);
    }
    for (const p of products) {
      map.set(p.id, p);
    }
    return Array.from(map.values());
  }, [products]);

  const productById = useMemo(
    () => new Map(storeCatalog.map((p) => [p.id, p])),
    [storeCatalog]
  );

  // Convert customer-uploaded closet photos into real 3D-wearable Product objects!
  const uploadedAsProducts = useMemo(() => {
    return uploadedClosetPieces.map((up) =>
      buildSynthetic3DProductFromPiece({
        id: `uploaded-3d-${up.id}`,
        name: up.title,
        brand: "My Closet Photo",
        colorName: up.colorName || "My Closet",
        price: 0,
        imageUrl: up.imageUrl,
        hintGroup:
          up.slot === "full"
            ? "full"
            : up.slot === "pants"
            ? "bottoms"
            : "tops",
      })
    );
  }, [uploadedClosetPieces]);

  const allWearableById = useMemo(() => {
    const m = new Map(productById);
    for (const up of uploadedAsProducts) {
      m.set(up.id, up);
    }
    if (activeImportedProduct) {
      m.set(activeImportedProduct.id, activeImportedProduct);
    }
    return m;
  }, [activeImportedProduct, productById, uploadedAsProducts]);

  // Owned Product IDs (starter owned pieces + anything bought at checkout + uploaded clothes)
  const ownedProductIds = useMemo(() => {
    const set = new Set<string>([
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-noir-pleated-mini",
      "prod-ae-crimson-corset-mini",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ]);
    for (const p of purchasedItems) {
      if (p.productId) set.add(p.productId);
    }
    for (const up of uploadedAsProducts) {
      set.add(up.id);
    }
    return set;
  }, [purchasedItems, uploadedAsProducts]);

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );
  const recSize = useMemo(
    () =>
      deriveStandardApparelSize({
        bustInches: bodyDims.bustInches,
        waistInches: bodyDims.waistInches,
        hipsInches: bodyDims.hipsInches,
      }),
    [bodyDims.bustInches, bodyDims.hipsInches, bodyDims.waistInches]
  );

  // Active 3D Dress-Up Slots (initialized to Outfit #01: Espresso Corset + Champagne Trousers + Gold Heels + Merlot Bag)
  const [lookIdx, setLookIdx] = useState<number>(0);
  const [dressedSlots, setDressedSlots] = useState<DressedOutfitSlots>(() => ({
    topId: "prod-ae-espresso-corset",
    bottomId: "prod-ae-champagne-trousers",
    dressId: null,
    outerwearId: null,
    shoesId: "prod-ae-gold-strappy-heels",
    bagId: "prod-ae-burgundy-crescent-bag",
    beltId: null,
  }));

  const [stageMode, setStageMode] = useState<"3d" | "lookbook">("3d");
  const [activeWardrobeTab, setActiveWardrobeTab] =
    useState<WardrobeTab>("mix");
  const [activeSlotFilter, setActiveSlotFilter] = useState<
    "all" | DressSlotKey
  >("all");
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [aiSuggestionNote, setAiSuggestionNote] = useState<string | null>(
    "Tap any piece to dress your 3D scanned body, or use AI Hybrid Stylist to pair your owned closet clothes with 1 new store piece!"
  );
  const [hybridCycleIdx, setHybridCycleIdx] = useState(0);
  const [savedOutfits, setSavedOutfits] = useState<SavedCustom3DOutfit[]>([]);
  const [copiedCloset, setCopiedCloset] = useState(false);

  // Photo upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState<string>("");
  const [pendingUploadTitle, setPendingUploadTitle] = useState<string>("");
  const [pendingUploadSlot, setPendingUploadSlot] = useState<
    "full" | "top" | "pants"
  >("top");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_OUTFITS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedOutfits(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistSavedOutfits = useCallback((next: SavedCustom3DOutfit[]) => {
    setSavedOutfits(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CUSTOM_OUTFITS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  }, []);

  // Equip an entire preset StudioLook onto the Lifelike Avatar
  const applyPresetLook = useCallback(
    (idx: number) => {
      const normalized =
        ((idx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) %
        STUDIO_LOOKS.length;
      setLookIdx(normalized);
      const lk = STUDIO_LOOKS[normalized];
      const ids = (lk.relatedProductIds || [lk.productId]).filter(
        (id): id is string => Boolean(id)
      );
      setDressedSlots(slotsFromProductIds(ids, allWearableById));
      triggerScanBeam();
    },
    [allWearableById, triggerScanBeam]
  );

  // Deep-link `/?try=<productId>` from Runway or URL importer
  const appliedTryRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tryId = new URLSearchParams(window.location.search).get("try");
    if (!tryId || appliedTryRef.current === tryId) return;
    const prod = allWearableById.get(tryId);
    if (prod) {
      appliedTryRef.current = tryId;
      const matchedLook = STUDIO_LOOKS.find(
        (l) => l.productId === prod.id || l.relatedProductIds?.includes(prod.id)
      );
      if (matchedLook) {
        applyPresetLook(matchedLook.index);
      } else {
        equipProductPiece(prod);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWearableById, applyPresetLook]);

  // Equip or toggle a single garment/shoe/bag/belt on the 3D Dress-Up Avatar!
  const equipProductPiece = useCallback(
    (prod: Product) => {
      const slot = classifyProductSlot(prod);
      setDressedSlots((prev) => {
        const next = { ...prev };
        if (slot === "dress") {
          if (prev.dressId === prod.id) {
            next.dressId = null;
            next.topId = "prod-ae-espresso-corset";
            next.bottomId = "prod-ae-champagne-trousers";
          } else {
            next.dressId = prod.id;
            next.topId = null;
            next.bottomId = null;
          }
        } else if (slot === "top") {
          next.topId = prod.id;
          next.dressId = null;
          if (!next.bottomId) next.bottomId = "prod-ae-champagne-trousers";
        } else if (slot === "bottom") {
          next.bottomId = prod.id;
          next.dressId = null;
          if (!next.topId) next.topId = "prod-ae-espresso-corset";
        } else if (slot === "outerwear") {
          next.outerwearId = prev.outerwearId === prod.id ? null : prod.id;
        } else if (slot === "shoes") {
          next.shoesId = prod.id;
        } else if (slot === "bag") {
          next.bagId = prev.bagId === prod.id ? null : prod.id;
        } else if (slot === "belt") {
          next.beltId = prev.beltId === prod.id ? null : prod.id;
        }
        return next;
      });
      setSelectedPieceId(prod.id);
      setStageMode("3d");
      triggerScanBeam();
    },
    [triggerScanBeam]
  );

  // If user imports a store link via "+ Link", put it right onto her 3D Avatar!
  useEffect(() => {
    if (activeImportedProduct) {
      equipProductPiece(activeImportedProduct);
    }
  }, [activeImportedProduct, equipProductPiece]);

  // Pools by slot for game-style ◀ Slot ▶ cycling
  const poolsBySlot = useMemo(() => {
    const allItems = [...storeCatalog, ...uploadedAsProducts];
    return {
      top: allItems.filter((p) => classifyProductSlot(p) === "top"),
      bottom: allItems.filter((p) => classifyProductSlot(p) === "bottom"),
      dress: allItems.filter((p) => classifyProductSlot(p) === "dress"),
      outerwear: allItems.filter((p) => classifyProductSlot(p) === "outerwear"),
      shoes: allItems.filter((p) => classifyProductSlot(p) === "shoes"),
      bag: allItems.filter((p) => classifyProductSlot(p) === "bag"),
      belt: allItems.filter((p) => classifyProductSlot(p) === "belt"),
    };
  }, [storeCatalog, uploadedAsProducts]);

  const cycleSlot = useCallback(
    (slot: DressSlotKey, dir: 1 | -1) => {
      const pool = poolsBySlot[slot];
      if (!pool || pool.length === 0) return;

      const currentId =
        slot === "top"
          ? dressedSlots.topId
          : slot === "bottom"
          ? dressedSlots.bottomId
          : slot === "dress"
          ? dressedSlots.dressId
          : slot === "outerwear"
          ? dressedSlots.outerwearId
          : slot === "shoes"
          ? dressedSlots.shoesId
          : slot === "bag"
          ? dressedSlots.bagId
          : dressedSlots.beltId;

      if ((slot === "outerwear" || slot === "bag") && currentId === null && dir === 1) {
        equipProductPiece(pool[0]);
        showToast(`Styled ${pool[0].title}`);
        return;
      }

      const idx = pool.findIndex((p) => p.id === currentId);
      const nextIdx =
        idx === -1 ? 0 : (idx + dir + pool.length) % pool.length;
      const nextProd = pool[nextIdx];
      equipProductPiece(nextProd);
      showToast(`Swapped ${slot} → ${nextProd.title}`);
    },
    [dressedSlots, equipProductPiece, poolsBySlot, showToast]
  );

  // 1) AI HYBRID STYLIST: Pairs her OWNED Closet Clothes with 1 NEW Store Piece she can buy!
  const handleAiClosetPlusOneStorePiece = useCallback(() => {
    const recipes: Array<{
      slots: DressedOutfitSlots;
      note: string;
    }> = [
      {
        slots: {
          topId: "prod-ae-acetate-beaded-tank", // NEW STORE TOP ($48)
          bottomId: "prod-ae-champagne-trousers", // OWNED
          dressId: null,
          outerwearId: "prod-ae-ivory-tweed-blazer", // OWNED
          shoesId: "prod-ae-noir-slingbacks", // OWNED
          bagId: "prod-ae-burgundy-crescent-bag", // OWNED
          beltId: null,
        },
        note: `AI Hybrid Edit (${ARCHETYPE_META[socialDna.primaryArchetype].shortTag}): Paired your owned Ivory Tweed Blazer & Champagne Trousers with our Beaded Lyocell Tank ($48) — complete a brand-new outfit by adding just 1 top!`,
      },
      {
        slots: {
          topId: "prod-ae-espresso-corset", // OWNED
          bottomId: "prod-ae-vintage-wide-denim", // NEW STORE JEANS ($58)
          dressId: null,
          outerwearId: null,
          shoesId: "prod-ae-noir-slingbacks", // OWNED
          bagId: "prod-ae-burgundy-crescent-bag", // OWNED
          beltId: null,
        },
        note: `AI Hybrid Edit: Styled your owned Espresso Satin Corset & Merlot Crescent Bag with our High-Rise Vintage Indigo Jeans ($58) — effortless date-night denim upgrade!`,
      },
      {
        slots: {
          topId: "prod-ae-espresso-corset", // OWNED
          bottomId: "prod-ae-noir-pleated-mini", // OWNED
          dressId: null,
          outerwearId: "prod-ae-noir-tailored-blazer", // NEW STORE BLAZER ($74)
          shoesId: "prod-ae-noir-slingbacks", // OWNED
          bagId: "prod-ae-burgundy-crescent-bag", // OWNED
          beltId: null,
        },
        note: `AI Hybrid Edit: Layered our Double-Breasted Noir Blazer ($74) over your owned Espresso Corset & Noir Pleated Mini — 1 tailored piece transforms your closet!`,
      },
      {
        slots: {
          topId: "prod-ae-espresso-corset", // OWNED
          bottomId: "prod-ae-champagne-trousers", // OWNED
          dressId: null,
          outerwearId: "prod-ae-camel-silk-wool-coat", // NEW STORE COAT ($118)
          shoesId: "prod-ae-noir-slingbacks", // OWNED
          bagId: "prod-ae-burgundy-crescent-bag", // OWNED
          beltId: null,
        },
        note: `AI Hybrid Edit: Added our Double-Faced Camel Silk-Wool Coat ($118) onto your owned Corset + Champagne Trousers for an instant Old-Money silhouette!`,
      },
    ];

    const pick = recipes[hybridCycleIdx % recipes.length];
    setHybridCycleIdx((n) => n + 1);
    setDressedSlots(pick.slots);
    setStageMode("3d");
    setAiSuggestionNote(pick.note);
    triggerScanBeam();
    showToast("AI paired your Closet clothes with 1 new Store piece!");
  }, [hybridCycleIdx, showToast, socialDna.primaryArchetype, triggerScanBeam]);

  // 2) AI DAILY CLOSET STYLIST: $0 Outfit built 100% from Owned Closet Pieces!
  const handleAiOwnedClosetToday = useCallback(() => {
    const ownedCombos: Array<{ slots: DressedOutfitSlots; note: string }> = [
      {
        slots: {
          topId: "prod-ae-espresso-corset",
          bottomId: "prod-ae-noir-pleated-mini",
          dressId: null,
          outerwearId: "prod-ae-ivory-tweed-blazer",
          shoesId: "prod-ae-noir-slingbacks",
          bagId: "prod-ae-burgundy-crescent-bag",
          beltId: null,
        },
        note: "Daily Wardrobe AI ($0 Owned): Mixed your Ivory Bouclé Blazer over your Espresso Corset & Noir Pleated Mini — 100% from your Closet!",
      },
      {
        slots: {
          topId: null,
          bottomId: null,
          dressId: "prod-ae-crimson-corset-mini",
          outerwearId: "prod-ae-ivory-tweed-blazer",
          shoesId: "prod-ae-noir-slingbacks",
          bagId: "prod-ae-burgundy-crescent-bag",
          beltId: null,
        },
        note: "Daily Wardrobe AI ($0 Owned): Styled your Crimson Corset Mini under your Ivory Tweed Blazer with Merlot Crescent Bag!",
      },
    ];
    const pick = ownedCombos[hybridCycleIdx % ownedCombos.length];
    setHybridCycleIdx((n) => n + 1);
    setDressedSlots(pick.slots);
    setStageMode("3d");
    setAiSuggestionNote(pick.note);
    triggerScanBeam();
    showToast("AI styled today's outfit from your Owned Closet!");
  }, [hybridCycleIdx, showToast, triggerScanBeam]);

  // 3) AI FULL NEW STORE OUTFIT SPINNER
  const handleSpinFullStoreOutfit = useCallback(() => {
    const nextIdx = (lookIdx + 1) % STUDIO_LOOKS.length;
    applyPresetLook(nextIdx);
    setStageMode("3d");
    const lk = STUDIO_LOOKS[nextIdx];
    setAiSuggestionNote(
      `Full Store Outfit #0${nextIdx + 1}: ${lk.name} — drag in 3D to check exact fit on your ${formatHeightFeetInches(
        bodyDims.heightInches
      )} body, swap any piece, or order the full set!`
    );
    showToast(`Styled Full Outfit: ${lk.name}`);
  }, [applyPresetLook, bodyDims.heightInches, lookIdx, showToast]);

  // Resolve active Worn3DPieceSpec[] for the 3D Avatar + Checkout Dock
  const activeWornSpecs: Worn3DPieceSpec[] = useMemo(() => {
    const activeIds = [
      dressedSlots.dressId,
      dressedSlots.topId,
      dressedSlots.bottomId,
      dressedSlots.outerwearId,
      dressedSlots.beltId,
      dressedSlots.shoesId,
      dressedSlots.bagId,
    ].filter((id): id is string => Boolean(id));

    return activeIds
      .map((id): Worn3DPieceSpec | null => {
        const product = allWearableById.get(id);
        if (!product) return null;
        return {
          product,
          selectedSize: recSize,
          isOwnedInCloset: ownedProductIds.has(product.id),
        };
      })
      .filter((x): x is Worn3DPieceSpec => x !== null);
  }, [allWearableById, dressedSlots, ownedProductIds, recSize]);

  const unownedStorePieces = useMemo(
    () => activeWornSpecs.filter((w) => !w.isOwnedInCloset && w.product.price > 0),
    [activeWornSpecs]
  );
  const ownedWornCount = activeWornSpecs.length - unownedStorePieces.length;
  const missingUpgradeCost = unownedStorePieces.reduce(
    (s, w) => s + w.product.price,
    0
  );
  const totalFullLookCost = activeWornSpecs.reduce(
    (s, w) => s + w.product.price,
    0
  );

  // Filtered rack items for the Right Dress-Up Drawer
  const filteredWardrobeItems = useMemo(() => {
    const allItems = [...uploadedAsProducts, ...storeCatalog];
    let list = allItems;
    if (activeWardrobeTab === "bought") {
      list = allItems.filter((p) => ownedProductIds.has(p.id));
    } else if (activeWardrobeTab === "store") {
      list = storeCatalog.filter((p) => !ownedProductIds.has(p.id));
    }
    if (activeSlotFilter !== "all") {
      list = list.filter((p) => classifyProductSlot(p) === activeSlotFilter);
    }
    return list;
  }, [
    activeSlotFilter,
    activeWardrobeTab,
    ownedProductIds,
    storeCatalog,
    uploadedAsProducts,
  ]);

  const activeIdsSet = useMemo(
    () => new Set(activeWornSpecs.map((w) => w.product.id)),
    [activeWornSpecs]
  );

  const handleSaveCustomOutfit = () => {
    const primary = activeWornSpecs[0]?.product.title.split(" ").slice(0, 3).join(" ") || "Custom";
    const name = `${primary} 3D Mix #${savedOutfits.length + 1}`;
    const entry: SavedCustom3DOutfit = {
      id: `saved-3d-${Date.now()}`,
      name,
      slots: { ...dressedSlots },
      createdAt: new Date().toISOString(),
    };
    persistSavedOutfits([entry, ...savedOutfits]);
    showToast(`Saved "${name}" to your Closet!`);
  };

  const handleAddPiecesToBag = (
    items: Worn3DPieceSpec[],
    openCheckoutNow: boolean
  ) => {
    const targetList = items.length > 0 ? items : activeWornSpecs;
    targetList.forEach((w) => {
      if (w.product.price <= 0) return;
      addToBag({
        productId: w.product.id,
        title: w.product.title,
        brand: w.product.brand || "GWO Boutique",
        price: w.product.price,
        size: w.selectedSize || recSize,
        imageUrl: w.product.imageUrl,
        avatarFrontUrl: H(STUDIO_LOOKS[lookIdx].file, 900),
        avatarBackUrl: H_BACK(STUDIO_LOOKS[lookIdx].file),
        storeUrl: w.product.canonicalUrl,
      });
    });
    if (openCheckoutNow) {
      openDropshipCheckout("checkout");
    } else {
      showToast(
        `Added ${targetList.length} ${
          targetList.length === 1 ? "piece" : "pieces"
        } to your Bag!`
      );
    }
  };

  // Handle customer uploading a photo of her own closet clothing
  const handleSelectUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const defaultTitle = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const reader = new FileReader();
    reader.onload = () => {
      const rawUrl = String(reader.result || "");
      if (!rawUrl) return;
      const img = new Image();
      img.onload = () => {
        const maxDim = 720;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setPendingUploadDataUrl(canvas.toDataURL("image/webp", 0.84));
        } else {
          setPendingUploadDataUrl(rawUrl);
        }
        setPendingUploadTitle(defaultTitle || "My Closet Top");
        setUploadModalOpen(true);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConfirmUploadPiece = () => {
    if (!pendingUploadDataUrl) return;
    const finalTitle = pendingUploadTitle.trim() || "My Uploaded Piece";
    addUploadedClosetPiece({
      title: finalTitle,
      slot: pendingUploadSlot,
      imageUrl: pendingUploadDataUrl,
      colorName: "My Closet",
    });
    setUploadModalOpen(false);
    setPendingUploadDataUrl("");
    setPendingUploadTitle("");
    setActiveWardrobeTab("uploaded");
  };

  const currentLook = STUDIO_LOOKS[lookIdx] || STUDIO_LOOKS[0];

  // Pointer Parallax on Sunlit NYC Loft Studio Backdrop (Original Prompt Property!)
  const handleLoftPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "mouse" && backdropRef.current) {
        const nx = e.clientX / Math.max(1, window.innerWidth) - 0.5;
        const ny = e.clientY / Math.max(1, window.innerHeight) - 0.5;
        backdropRef.current.style.transform = `translate3d(${(
          -nx * 14
        ).toFixed(1)}px, ${(-ny * 9).toFixed(1)}px, 0) scale(1.035)`;
      }
      if (dragProduct && dragPillRef.current) {
        dragPillRef.current.style.transform = `translate3d(${e.clientX + 12}px, ${
          e.clientY - 18
        }px, 0)`;
        if (centerStageRef.current) {
          const r = centerStageRef.current.getBoundingClientRect();
          const inside =
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom;
          setOverAvatar(inside);
        }
      }
    },
    [dragProduct]
  );

  // Pointer Drag-and-Drop Any Wardrobe Piece Directly Onto the Lifelike Avatar!
  const handlePiecePointerDown = useCallback(
    (e: React.PointerEvent, prod: Product) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if ((e.target as HTMLElement)?.closest("button")) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let started = false;

      const onMove = (ev: PointerEvent) => {
        if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) {
          started = true;
          setDragProduct(prod);
        }
        if (started && dragPillRef.current) {
          dragPillRef.current.style.transform = `translate3d(${
            ev.clientX + 12
          }px, ${ev.clientY - 18}px, 0)`;
          if (centerStageRef.current) {
            const r = centerStageRef.current.getBoundingClientRect();
            setOverAvatar(
              ev.clientX >= r.left &&
                ev.clientX <= r.right &&
                ev.clientY >= r.top &&
                ev.clientY <= r.bottom
            );
          }
        }
      };

      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        if (started) {
          if (centerStageRef.current) {
            const r = centerStageRef.current.getBoundingClientRect();
            const droppedOnAvatar =
              ev.clientX >= r.left &&
              ev.clientX <= r.right &&
              ev.clientY >= r.top &&
              ev.clientY <= r.bottom;
            if (droppedOnAvatar) {
              equipProductPiece(prod);
              showToast(`Dressed ${prod.title} onto your Avatar!`);
            }
          }
          setDragProduct(null);
          setOverAvatar(false);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [equipProductPiece, showToast]
  );

  return (
    <div
      onPointerMove={handleLoftPointerMove}
      className="relative min-h-[calc(100svh-64px)] lg:h-[calc(100svh-64px)] w-full overflow-x-hidden lg:overflow-hidden select-none bg-white"
    >
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelectUploadFile}
      />

      {/* Floating Drag-to-Wear Garment Pill */}
      {dragProduct && (
        <div
          ref={dragPillRef}
          className="fixed left-0 top-0 z-[150] pointer-events-none px-3 py-1.5 rounded-full bg-[#141518] text-white text-xs font-bold shadow-xl flex items-center gap-2"
        >
          <span>Drop on Avatar: {dragProduct.title}</span>
        </div>
      )}

      {/* Pure Clean White Studio Background Behind Closet Avatar */}
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-white pointer-events-none"
      />

      {/* 3-ZONE INTERACTIVE 3D DRESS-UP STUDIO */}
      <div className="relative z-10 min-h-[calc(100svh-64px)] lg:h-full max-w-[1560px] mx-auto px-3 sm:px-5 py-3 sm:py-3.5 flex flex-col lg:flex-row items-stretch justify-between gap-3.5">
        {/* ==================== LEFT PANEL (DESKTOP): 3D BODY SCANNER & DAILY AI STYLING ==================== */}
        <aside className="hidden lg:flex lg:w-[300px] xl:w-[316px] lg:h-full shrink-0 flex-col justify-between rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 overflow-y-auto">
          <div className="space-y-3">
            {/* 3D Scanned Body Twin Card */}
            <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-[#C6E0D0] space-y-2.5">
              <div className="flex items-center gap-2.5">
                <img
                  src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                  alt="Your 3D Twin"
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#244B3B] shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#141518] truncate">
                    Your 3D Scanned Body Twin ✓
                  </p>
                  <p className="text-[11px] text-[#244B3B] font-semibold">
                    Exact {formatHeightFeetInches(bodyDims.heightInches)} • US Size{" "}
                    {recSize}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1 text-center">
                {[
                  ["Height", formatHeightFeetInches(bodyDims.heightInches)],
                  ["Bust", `${bodyDims.bustInches}"`],
                  ["Waist", `${bodyDims.waistInches}"`],
                  ["Hips", `${bodyDims.hipsInches}"`],
                ].map(([lbl, val]) => (
                  <div
                    key={lbl}
                    className="py-1 px-1 rounded-xl bg-white border border-black/[0.06]"
                  >
                    <p className="text-[9px] font-bold uppercase text-[#686D76]">
                      {lbl}
                    </p>
                    <p className="text-xs font-bold text-[#141518]">{val}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                id="gwo-open-body-scanner-btn"
                onClick={() => setAvatarModalOpen(true)}
                className="w-full py-2 px-3 rounded-full text-xs font-bold bg-[#141518] hover:bg-[#27292E] text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition shadow-xs"
              >
                <ScanLine className="w-3.5 h-3.5 text-[#A7D7C5]" />
                Scan My Body / Edit 3D Inches
              </button>
            </div>

            {/* Daily AI Stylist Modes (Closet + 1 Store Upgrade, Owned Closet, or Full Store Set) */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B] flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> AI Daily Dress-Up Modes
              </p>

              <button
                type="button"
                id="gwo-ai-hybrid-upgrade-btn"
                onClick={handleAiClosetPlusOneStorePiece}
                className="w-full p-2.5 rounded-2xl bg-[#141518] hover:bg-[#27292E] text-white text-left transition cursor-pointer space-y-0.5 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold inline-flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-[#A7D7C5]" /> Closet + 1 Store Piece
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#244B3B] text-[#C8F0DF] text-[9.5px] font-bold">
                    AI Hybrid
                  </span>
                </div>
                <p className="text-[10.5px] text-white/75 leading-snug">
                  Builds an outfit from your Closet &amp; adds 1 new top, blazer, or jean to buy!
                </p>
              </button>

              <button
                type="button"
                onClick={handleAiOwnedClosetToday}
                className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#EFF3F0] border border-black/[0.07] text-left transition cursor-pointer space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141518]">
                    Style My Owned Closet
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[9.5px] font-bold">
                    $0 Today
                  </span>
                </div>
                <p className="text-[10.5px] text-[#686D76]">
                  Fresh daily combo using only clothes you already own
                </p>
              </button>

              <button
                type="button"
                onClick={handleSpinFullStoreOutfit}
                className="w-full p-2.5 rounded-2xl bg-white hover:bg-[#F3F4F7] border border-black/[0.07] text-left transition cursor-pointer space-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141518] inline-flex items-center gap-1">
                    <Dices className="w-3.5 h-3.5 text-[#C80815]" /> Spin Full Store Outfit
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#FDECEB] text-[#9E2A22] text-[9.5px] font-bold">
                    New Set
                  </span>
                </div>
                <p className="text-[10.5px] text-[#686D76]">
                  Try head-to-toe boutique outfits on your 3D body
                </p>
              </button>
            </div>

            {/* Social Style DNA + Upload Own Clothes */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setSocialModalOpen(true)}
                className="w-full py-2 px-3 rounded-2xl bg-[#FDEEF4] hover:bg-[#FADCE8] border border-[#F5C5D8] text-[11px] font-bold text-[#9D174D] flex items-center justify-between gap-1.5 cursor-pointer transition"
              >
                <span className="inline-flex items-center gap-1.5 truncate">
                  <Instagram className="w-3.5 h-3.5 shrink-0" />
                  {socialDna.instagramHandle || "@mila.nyc"} •{" "}
                  {ARCHETYPE_META[socialDna.primaryArchetype].shortTag}
                </span>
                <span className="underline shrink-0">Edit Vibe</span>
              </button>

              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                className="w-full py-2 px-3 rounded-2xl bg-white hover:bg-[#F4F5F7] border border-black/[0.08] text-xs font-bold text-[#141518] flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <ImagePlus className="w-3.5 h-3.5 text-[#244B3B]" /> Upload My Own Clothes Photo
              </button>
            </div>
          </div>

          {/* Share Closet CTA */}
          <button
            type="button"
            onClick={async () => {
              await shareMyClosetAndClaimBonus();
              setCopiedCloset(true);
              setTimeout(() => setCopiedCloset(false), 2200);
            }}
            className="w-full py-2 px-3 rounded-2xl bg-[#EEF5F1] hover:bg-[#E2EFE8] text-[#1D4232] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer mt-2"
          >
            {copiedCloset ? (
              <>
                <Check className="w-3.5 h-3.5" /> Closet Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Share My 3D Closet
              </>
            )}
          </button>
        </aside>

        {/* ==================== CENTER STAGE: SEAMLESS LOFT LIFELIKE AVATAR ==================== */}
        <div
          ref={centerStageRef}
          className="relative shrink-0 h-[500px] lg:shrink lg:flex-1 min-w-0 flex flex-col items-center justify-between lg:h-full lg:min-h-0"
        >
          {/* Top Stage Bar */}
          <div className="shrink-0 z-20 flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs inline-flex items-center gap-1.5 text-xs font-bold text-[#141518] hover:bg-[#F4F8F5] cursor-pointer"
            >
              <ScanLine className="w-3.5 h-3.5 text-[#244B3B]" />
              <span>
                Body Scan ({formatHeightFeetInches(bodyDims.heightInches)} • Size{" "}
                {recSize})
              </span>
            </button>

            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs">
              <button
                type="button"
                id="gwo-stage-mode-3d"
                onClick={() => setStageMode("3d")}
                className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                  stageMode === "3d"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                <Rotate3d className="w-3 h-3 text-[#A7D7C5]" /> Lifelike 360°
              </button>
              <button
                type="button"
                id="gwo-stage-mode-lookbook"
                onClick={() => setStageMode("lookbook")}
                className={`px-3 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                  stageMode === "lookbook"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                <Columns2 className="w-3 h-3" /> Front + Back
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveCustomOutfit}
              className="px-3 py-1.5 rounded-full bg-white/95 hover:bg-[#F4F8F5] border border-black/[0.08] text-[11px] font-bold text-[#244B3B] inline-flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <BookmarkPlus className="w-3.5 h-3.5" /> Save Look
            </button>
          </div>

          {/* Seamless NYC Loft Floor Lifelike Stage (No Card Box — Standing Directly in the Sunlit Loft!) */}
          <div
            className={`relative flex-1 w-full min-h-0 my-1 overflow-hidden transition-all ${
              overAvatar
                ? "rounded-3xl ring-2 ring-[#244B3B] bg-[#244B3B]/10"
                : ""
            }`}
          >
            {scanPulseKey > 0 && (
              <div key={scanPulseKey} className="gwo-scan-beam" />
            )}

            {stageMode === "3d" ? (
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={bodyDims}
                wornPieces={activeWornSpecs}
                faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                initialYawDeg={0}
                seamlessStage={true}
                inertiaSpin={true}
                selectedProductId={selectedPieceId}
                onSelectProduct={(prod) => {
                  setSelectedPieceId(prod.id);
                  setActiveSlotFilter(classifyProductSlot(prod));
                }}
                showHud={true}
              />
            ) : (
              <div className="h-full w-full grid grid-cols-2 gap-2 p-2">
                <div className="relative rounded-2xl bg-white/75 backdrop-blur-xs flex items-end justify-center overflow-hidden pt-6">
                  <img
                    src={H(currentLook.file, 900)}
                    alt={`${currentLook.name} Front`}
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-bold">
                    Front 0°
                  </span>
                </div>
                <div className="relative rounded-2xl bg-white/75 backdrop-blur-xs flex items-end justify-center overflow-hidden pt-6">
                  <img
                    src={H_BACK(currentLook.file)}
                    alt={`${currentLook.name} Back`}
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/75 text-white text-[10px] font-bold">
                    Back 180°
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Game-Style Slot Cyclers Dock Below 3D Stage */}
          <div className="shrink-0 z-20 flex flex-wrap items-center justify-center gap-1.5">
            {(
              [
                ["top", "Top"],
                ["bottom", "Pants/Skirt"],
                ["outerwear", "Jacket"],
                ["shoes", "Shoes"],
                ["bag", "Bag"],
              ] as const
            ).map(([slotKey, label]) => (
              <div
                key={slotKey}
                className="inline-flex items-center rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs px-1 py-0.5"
              >
                <button
                  type="button"
                  onClick={() => cycleSlot(slotKey, -1)}
                  aria-label={`Previous ${label}`}
                  className="p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] inline-flex items-center justify-center"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveWardrobeTab("mix");
                    setActiveSlotFilter(slotKey);
                  }}
                  className="px-1.5 text-[11px] font-bold text-[#141518] cursor-pointer min-h-[24px]"
                >
                  {label}
                </button>
                <button
                  type="button"
                  onClick={() => cycleSlot(slotKey, 1)}
                  aria-label={`Next ${label}`}
                  className="p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] inline-flex items-center justify-center"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ==================== RIGHT PANEL: 3D DRESS-UP WARDROBE, AI HYBRID & STORE RACK ==================== */}
        <aside className="w-full lg:w-[390px] xl:w-[424px] lg:h-full shrink-0 rounded-3xl bg-white/96 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.08)] p-4 flex flex-col justify-between gap-2.5 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-2.5">
            {/* Header + Quick Actions */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h1 className="text-base font-bold text-[#141518]">
                  Closet &amp; Dress-Up Studio
                </h1>
                <p className="text-[11px] text-[#686D76]">
                  Tap or drag any piece onto your lifelike avatar
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleAiClosetPlusOneStorePiece}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#141518] hover:bg-[#27292E] text-white inline-flex items-center gap-1 cursor-pointer"
                  title="Have AI build an outfit from your Closet + 1 new Store piece"
                >
                  <Wand2 className="w-3 h-3 text-[#A7D7C5]" /> AI +1 Piece
                </button>
                <button
                  type="button"
                  onClick={() => setAddUrlModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#F1F2F5] hover:bg-[#E4E7EC] text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3 h-3 text-[#244B3B]" /> + URL
                </button>
              </div>
            </div>

            {/* AI Suggestion Banner */}
            {aiSuggestionNote && (
              <div className="px-3 py-2 rounded-2xl bg-[#EBF3EE] border border-[#C5DFD0] flex items-start justify-between gap-2">
                <p className="text-[10.5px] font-semibold text-[#1D4232] leading-snug">
                  {aiSuggestionNote}
                </p>
                <button
                  type="button"
                  onClick={() => setAiSuggestionNote(null)}
                  aria-label="Dismiss AI suggestion"
                  className="p-1 rounded-full hover:bg-black/5 text-[#1D4232] shrink-0 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* Wardrobe Source Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {(
                [
                  ["mix", `All Pieces (${storeCatalog.length + uploadedAsProducts.length})`],
                  ["bought", `My Closet (${ownedProductIds.size})`],
                  ["store", "Add Store Piece"],
                  ["outfits", `Full Outfits (${STUDIO_LOOKS.length})`],
                  ["uploaded", `Uploaded (${uploadedAsProducts.length})`],
                  ["saved", `Saved (${savedOutfits.length})`],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveWardrobeTab(tabId)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                    activeWardrobeTab === tabId
                      ? "bg-[#141518] text-white"
                      : "bg-[#F4F5F7] text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Category Slot Filter Pills (when browsing pieces) */}
            {(activeWardrobeTab === "mix" ||
              activeWardrobeTab === "bought" ||
              activeWardrobeTab === "store") && (
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {(
                  [
                    ["all", "All Slots"],
                    ["top", "Tops"],
                    ["bottom", "Bottoms"],
                    ["dress", "Dresses"],
                    ["outerwear", "Jackets/Coats"],
                    ["shoes", "Shoes"],
                    ["bag", "Bags"],
                    ["belt", "Belts"],
                  ] as const
                ).map(([slotId, label]) => (
                  <button
                    key={slotId}
                    type="button"
                    onClick={() => setActiveSlotFilter(slotId)}
                    className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold whitespace-nowrap border transition cursor-pointer ${
                      activeSlotFilter === slotId
                        ? "bg-[#244B3B] text-white border-[#244B3B]"
                        : "bg-white text-[#686D76] border-black/[0.08] hover:text-[#141518]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* VIEW A: FULL OUTFIT PRESETS (10 AliExpress Full Outfits) */}
            {activeWardrobeTab === "outfits" && (
              <div className="grid grid-cols-2 gap-2">
                {STUDIO_LOOKS.map((lk) => {
                  const isCurrent = lookIdx === lk.index;
                  const ids = (lk.relatedProductIds || [lk.productId]).filter(
                    (id): id is string => Boolean(id)
                  );
                  const sumPrice = ids.reduce(
                    (s, id) => s + (allWearableById.get(id)?.price || 0),
                    0
                  );
                  return (
                    <button
                      key={lk.index}
                      type="button"
                      onClick={() => applyPresetLook(lk.index)}
                      className={`rounded-2xl p-2 border text-left transition cursor-pointer ${
                        isCurrent
                          ? "border-[#141518] ring-2 ring-[#141518]/15 bg-[#F4F8F5]"
                          : "border-black/[0.08] bg-[#FAFBFD] hover:bg-white"
                      }`}
                    >
                      <div className="h-28 rounded-xl bg-white overflow-hidden flex items-end justify-center mb-1.5">
                        <img
                          src={H(lk.file, 260)}
                          alt={lk.name}
                          className="h-full object-contain object-bottom"
                        />
                      </div>
                      <p className="text-[11px] font-bold text-[#141518] truncate">
                        {lk.name}
                      </p>
                      <p className="text-[10px] font-semibold text-[#244B3B]">
                        {ids.length} Pieces • ${sumPrice} Full Set
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* VIEW B: UPLOADED CLOSET CLOTHES */}
            {activeWardrobeTab === "uploaded" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="w-full py-2.5 rounded-2xl bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Upload Clothing Photo to Dress in 3D
                </button>
                {uploadedClosetPieces.length === 0 ? (
                  <p className="text-xs text-center text-[#686D76] py-4">
                    Upload a photo of any shirt, pants, or dress from your real closet to map &amp; style it on your 3D body!
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {uploadedAsProducts.map((upProd, idx) => {
                      const rawPiece = uploadedClosetPieces[idx];
                      const worn = activeIdsSet.has(upProd.id);
                      return (
                        <div
                          key={upProd.id}
                          onClick={() => equipProductPiece(upProd)}
                          className={`relative rounded-2xl p-2 border cursor-pointer ${
                            worn
                              ? "border-[#244B3B] bg-[#F4F8F5]"
                              : "border-black/[0.08] bg-white"
                          }`}
                        >
                          <div className="h-24 rounded-xl overflow-hidden bg-[#F7F8FA] mb-1">
                            <img
                              src={upProd.imageUrl}
                              alt={upProd.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[11px] font-bold text-[#141518] truncate">
                            {upProd.title}
                          </p>
                          {rawPiece && (
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation();
                                removeUploadedClosetPiece(rawPiece.id);
                              }}
                              aria-label={`Remove ${upProd.title}`}
                              className="absolute top-2 right-2 p-1 rounded-full bg-black/65 text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW C: SAVED 3D CUSTOM OUTFITS */}
            {activeWardrobeTab === "saved" && (
              <div className="space-y-2">
                {savedOutfits.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-dashed border-black/15 text-center space-y-1.5">
                    <p className="text-xs font-bold text-[#141518]">
                      No saved custom 3D outfits yet
                    </p>
                    <p className="text-[11px] text-[#686D76]">
                      Mix pieces on your 3D avatar, then tap <strong>Save Look</strong>!
                    </p>
                  </div>
                ) : (
                  savedOutfits.map((so) => (
                    <div
                      key={so.id}
                      className="p-2.5 rounded-2xl bg-[#F4F8F5] border border-[#C6E0D0] flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDressedSlots(so.slots);
                          setStageMode("3d");
                        }}
                        className="flex-1 text-left cursor-pointer"
                      >
                        <p className="text-xs font-bold text-[#141518]">
                          {so.name}
                        </p>
                        <p className="text-[10.5px] font-semibold text-[#244B3B]">
                          Tap to wear on your 3D Twin
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          persistSavedOutfits(
                            savedOutfits.filter((x) => x.id !== so.id)
                          )
                        }
                        aria-label={`Delete ${so.name}`}
                        className="p-1.5 rounded-full hover:bg-black/5 text-[#686D76] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* VIEW D: INTERACTIVE 3D MIX & MATCH PIECE GRID (OWNED CLOSET + STORE ADD-ONS) */}
            {(activeWardrobeTab === "mix" ||
              activeWardrobeTab === "bought" ||
              activeWardrobeTab === "store") && (
              <div className="grid grid-cols-2 gap-2">
                {filteredWardrobeItems.map((prod) => {
                  const isWorn = activeIdsSet.has(prod.id);
                  const isOwned = ownedProductIds.has(prod.id);
                  const fit = analyzeExactAvatarFit(
                    {
                      heightInches: bodyDims.heightInches,
                      bustInches: bodyDims.bustInches,
                      waistInches: bodyDims.waistInches,
                      hipsInches: bodyDims.hipsInches,
                      shoeSize: bodyDims.shoeSize,
                    },
                    prod
                  );

                  return (
                    <div
                      key={prod.id}
                      onPointerDown={(ev) => handlePiecePointerDown(ev, prod)}
                      onClick={() => equipProductPiece(prod)}
                      className={`group relative rounded-2xl p-2 border transition cursor-pointer flex flex-col justify-between ${
                        isWorn
                          ? "border-[#141518] ring-2 ring-[#141518]/15 bg-[#F4F8F5]"
                          : "border-black/[0.08] bg-white hover:bg-[#FAFBFD]"
                      }`}
                    >
                      <div>
                        <div className="relative h-24 rounded-xl bg-white border border-black/[0.04] overflow-hidden mb-1.5">
                          <GarmentArtwork
                            product={prod}
                            className="w-full h-full"
                          />
                          <span
                            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold uppercase tracking-wider ${
                              isOwned
                                ? "bg-[#244B3B] text-white"
                                : "bg-[#C80815] text-white"
                            }`}
                          >
                            {isOwned ? "Owned" : `$${prod.price}`}
                          </span>
                          {isWorn && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#141518] text-white text-[8.5px] font-bold">
                              Wearing ✓
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] font-bold text-[#141518] line-clamp-1">
                          {prod.title}
                        </p>
                        <p className="text-[10px] font-semibold text-[#244B3B]">
                          Size {fit.recommendedSize} • {fit.confidencePct}% Fit
                        </p>
                      </div>

                      <div className="mt-1.5 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            openAvatar360({
                              title: `${prod.brand} — ${prod.title}`,
                              primaryProduct: prod,
                              companionProducts: activeWornSpecs
                                .map((w) => w.product)
                                .filter((x) => x.id !== prod.id),
                            });
                          }}
                          className="flex-1 py-1 px-2 rounded-full bg-[#F1F2F5] hover:bg-[#E2E5EC] text-[10px] font-bold text-[#141518] inline-flex items-center justify-center gap-1 cursor-pointer min-h-[24px]"
                          title="Inspect lifelike 360° fit on your body"
                        >
                          <Rotate3d className="w-2.5 h-2.5 text-[#244B3B]" /> 360° Fit
                        </button>
                        {!isOwned && (
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              addToBag({
                                productId: prod.id,
                                title: prod.title,
                                brand: prod.brand,
                                price: prod.price,
                                size: fit.recommendedSize,
                                imageUrl: prod.imageUrl,
                              });
                            }}
                            className="py-1 px-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-[10px] font-bold text-white cursor-pointer min-h-[24px]"
                          >
                            + Bag
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ==================== BOTTOM WORN OUTFIT & SMART HYBRID CHECKOUT DOCK ==================== */}
          <div className="shrink-0 pt-2.5 border-t border-black/[0.08] space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold uppercase tracking-wider text-[#141518] inline-flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#244B3B]" /> Wearing ({activeWornSpecs.length} Pieces)
              </span>
              <span className="font-bold text-[#244B3B]">
                {ownedWornCount} Owned • {unownedStorePieces.length} Store Add-On
                {unownedStorePieces.length === 1 ? "" : "s"}
              </span>
            </div>

            {/* Compact Worn Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {activeWornSpecs.map((w) => (
                <button
                  key={w.product.id}
                  type="button"
                  onClick={() =>
                    openAvatar360({
                      title: `${w.product.brand} — ${w.product.title}`,
                      primaryProduct: w.product,
                      companionProducts: activeWornSpecs
                        .map((x) => x.product)
                        .filter((p) => p.id !== w.product.id),
                    })
                  }
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                    w.isOwnedInCloset
                      ? "bg-[#E7F3EE] border-[#C5DFD0] text-[#1D4232]"
                      : "bg-[#FDECEB] border-[#F5C6C2] text-[#9E2A22]"
                  }`}
                >
                  <Shirt className="w-2.5 h-2.5" />
                  <span className="max-w-[110px] truncate">{w.product.title}</span>
                  <span>
                    {w.isOwnedInCloset ? "✓" : `$${w.product.price}`}
                  </span>
                </button>
              ))}
            </div>

            {/* Smart Buy Buttons: Buy Missing Store Pieces OR Full Set */}
            <div className="flex items-center gap-2">
              {unownedStorePieces.length > 0 ? (
                <>
                  <button
                    type="button"
                    id="gwo-buy-missing-pieces-btn"
                    onClick={() => handleAddPiecesToBag(unownedStorePieces, true)}
                    className="flex-1 py-2.5 px-3 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {unownedStorePieces.length === 1
                      ? `Buy New Piece ($${missingUpgradeCost})`
                      : `Buy ${unownedStorePieces.length} New Pieces ($${missingUpgradeCost})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPiecesToBag(activeWornSpecs, false)}
                    className="py-2.5 px-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    + Full (${totalFullLookCost})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleAiClosetPlusOneStorePiece}
                    className="flex-1 py-2.5 px-3 rounded-full bg-[#244B3B] hover:bg-[#1C3B2E] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" /> Add 1 New Store Piece with AI
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/shop")}
                    className="py-2.5 px-3.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold cursor-pointer shrink-0"
                  >
                    Shop Runway →
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Upload Own Clothing Photo Modal */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-[140] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setUploadModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#141518]">
                Add Photo to Your 3D Closet
              </h3>
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingUploadDataUrl && (
              <div className="h-44 rounded-2xl bg-[#F4F5F7] overflow-hidden flex items-center justify-center">
                <img
                  src={pendingUploadDataUrl}
                  alt="Preview"
                  className="h-full object-contain"
                />
              </div>
            )}

            <input
              type="text"
              value={pendingUploadTitle}
              onChange={(e) => setPendingUploadTitle(e.target.value)}
              placeholder="Piece Name (e.g., My Black Silk Blouse)"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs text-[#141518]"
            />

            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["top", "Top / Jacket"],
                  ["pants", "Pants / Skirt"],
                  ["full", "Full Dress"],
                ] as const
              ).map(([sl, lbl]) => (
                <button
                  key={sl}
                  type="button"
                  onClick={() => setPendingUploadSlot(sl)}
                  className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                    pendingUploadSlot === sl
                      ? "bg-[#141518] text-white border-[#141518]"
                      : "bg-white text-[#141518] border-black/10"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirmUploadPiece}
              className="w-full py-2.5 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold cursor-pointer"
            >
              Add to Closet &amp; Dress 3D Twin →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

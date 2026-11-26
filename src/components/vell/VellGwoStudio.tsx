"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookmarkPlus,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Copy,
  ImagePlus,
  Instagram,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  Store,
  Trash2,
  Wand2,
  X,
  ZoomIn,
} from "lucide-react";
import {
  ACCESSORY_CATALOG,
  H,
  H_BACK,
  LOFT_BG_URL,
  SIGNATURE_BADGE_URL,
  STUDIO_LOOKS,
} from "./vell-data";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { useGwo, UploadedClosetPiece } from "@/context/GwoAppContext";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  buildSynthetic3DProductFromPiece,
} from "@/lib/catalog/closet-look-3d-mapper";
import {
  DEFAULT_AVATAR_MEASUREMENTS,
  deriveStandardApparelSize,
} from "@/lib/catalog/sizing";
import { ARCHETYPE_META } from "@/lib/social/social-style-dna";
import { Product } from "@/lib/types";

type ClosetFilterTab =
  | "all"
  | "bought"
  | "cart"
  | "uploaded"
  | "saved"
  | "accessories";

interface SavedCustomOutfit {
  id: string;
  name: string;
  topLookIdx: number;
  bottomLookIdx: number;
  createdAt: string;
}

interface DragPayload {
  kind: "look" | "accessory" | "scraped" | "uploaded";
  label: string;
  price: number;
  lookIndex?: number;
  accessoryName?: string;
  product?: Product;
  uploadedPiece?: UploadedClosetPiece;
}

const CUSTOM_OUTFITS_KEY = "gwo_saved_custom_outfits_v1";

// Indices of STUDIO_LOOKS that have distinct separate tops & bottoms for Mix & Match
const TWO_PIECE_LOOK_INDICES = STUDIO_LOOKS.filter(
  (lk) => lk.pieces.tops.length > 0 && lk.pieces.bottoms.length > 0
).map((lk) => lk.index);

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
    updateProfilePatch,
    shareMyClosetAndClaimBonus,
    setAddUrlModalOpen,
    activeImportedProduct,
    setActiveImportedProduct,
    customAvatar,
    setAvatarModalOpen,
    socialDna,
    setSocialModalOpen,
    openAvatar360,
    showToast,
  } = useGwo();

  const backdropRef = useRef<HTMLDivElement | null>(null);
  const figsRef = useRef<HTMLDivElement | null>(null);
  const scanRef = useRef<HTMLDivElement | null>(null);
  const modelBoxRef = useRef<HTMLDivElement | null>(null);
  const dragPillRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const preloadedImgsRef = useRef<Array<HTMLImageElement | null>>([]);
  const swapTokenRef = useRef(0);
  const swipeStartXRef = useRef<number | null>(null);

  const [lookIdx, setLookIdx] = useState(0);
  const [bottomLookIdx, setBottomLookIdx] = useState<number | null>(null);
  const [activeUploadedPiece, setActiveUploadedPiece] =
    useState<UploadedClosetPiece | null>(null);
  const [savedOutfits, setSavedOutfits] = useState<SavedCustomOutfit[]>([]);

  const [category, setCategory] = useState<ClosetFilterTab>("all");
  const [zoomed, setZoomed] = useState(false);
  const [closetStageAngle, setClosetStageAngle] = useState<
    "studio" | "back" | "split"
  >("studio");
  const [equippedAccessories, setEquippedAccessories] = useState<string[]>([
    "Gold hoops",
  ]);
  const [editingFit, setEditingFit] = useState(false);
  const [copiedCloset, setCopiedCloset] = useState(false);
  const [aiSuggestionNote, setAiSuggestionNote] = useState<string | null>(null);

  // Quick Photo Upload Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState<string>("");
  const [pendingUploadTitle, setPendingUploadTitle] = useState<string>("");
  const [pendingUploadSlot, setPendingUploadSlot] = useState<
    "full" | "top" | "pants"
  >("full");

  const [dragItem, setDragItem] = useState<DragPayload | null>(null);
  const [overAvatar, setOverAvatar] = useState(false);
  const [drapeFlatLay, setDrapeFlatLay] = useState(false);

  // Load saved custom mixed outfits
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_OUTFITS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedOutfits(parsed);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistSavedOutfits = useCallback((next: SavedCustomOutfit[]) => {
    setSavedOutfits(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(CUSTOM_OUTFITS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    setDrapeFlatLay(
      Boolean(
        activeImportedProduct?.studioLookIndex === undefined &&
          activeImportedProduct?.imageUrl
      )
    );
  }, [activeImportedProduct]);

  // Measurement inputs
  const [bustIn, setBustIn] = useState<number | null>(null);
  const [waistIn, setWaistIn] = useState<number | null>(null);
  const [hipsIn, setHipsIn] = useState<number | null>(null);
  const [heightIn, setHeightIn] = useState<number | null>(null);

  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;
  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;
  const recSize = deriveStandardApparelSize({
    bustInches: activeBust,
    waistInches: activeWaist,
    hipsInches: activeHips,
  });

  const activeImportedFit = useMemo(() => {
    if (!activeImportedProduct) return null;
    return analyzeExactAvatarFit(
      {
        bustInches: activeBust,
        waistInches: activeWaist,
        hipsInches: activeHips,
        heightInches: activeHeight,
        shoeSize: user?.shoeSize || "7.5",
      },
      activeImportedProduct
    );
  }, [
    activeBust,
    activeHeight,
    activeHips,
    activeImportedProduct,
    activeWaist,
    user?.shoeSize,
  ]);

  const preloadLookByIndex = useCallback((idx: number) => {
    const normalized =
      ((idx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
    if (preloadedImgsRef.current[normalized]) return;
    const im = new Image();
    im.decoding = "async";
    im.src = H(STUDIO_LOOKS[normalized].file, 900);
    preloadedImgsRef.current[normalized] = im;
  }, []);

  // Fast first paint ONLY for initial active look
  useEffect(() => {
    const cache: Array<HTMLImageElement | null> = new Array(
      STUDIO_LOOKS.length
    ).fill(null);
    preloadedImgsRef.current = cache;

    let initialIdx = 0;
    if (typeof window !== "undefined") {
      const tryParam = new URLSearchParams(window.location.search).get("try");
      if (tryParam) {
        const matchedLook = STUDIO_LOOKS.find(
          (l) =>
            l.productId === tryParam || l.relatedProductIds?.includes(tryParam)
        );
        if (matchedLook) {
          initialIdx = matchedLook.index;
          setLookIdx(initialIdx);
        }
      }
    }

    const first = new Image();
    first.decoding = "async";
    first.src = H(STUDIO_LOOKS[initialIdx].file, 900);
    cache[initialIdx] = first;

    if (figsRef.current) {
      figsRef.current.innerHTML = "";
      const base = document.createElement("div");
      base.className = "gwo-fig-layer";
      base.style.backgroundImage = `url("${H(
        STUDIO_LOOKS[initialIdx].file,
        900
      )}")`;
      figsRef.current.appendChild(base);
    }
  }, []);

  // Deep-link handler for /?try=<productId> from Runway or Store Rack
  const appliedTryQueryRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || products.length === 0) return;
    const tryId = new URLSearchParams(window.location.search).get("try");
    if (!tryId || appliedTryQueryRef.current === tryId) return;
    const found = products.find((p) => p.id === tryId);
    if (found) {
      appliedTryQueryRef.current = tryId;
      const matchedLook = STUDIO_LOOKS.find(
        (l) => l.productId === found.id || l.relatedProductIds?.includes(found.id)
      );
      if (matchedLook) {
        setLookIdx(matchedLook.index);
      } else {
        setActiveImportedProduct(found);
      }
    }
  }, [products, setActiveImportedProduct]);

  const triggerScanLine = useCallback(() => {
    const el = scanRef.current;
    if (!el) return;
    el.classList.remove("active");
    void el.offsetWidth;
    el.classList.add("active");
  }, []);

  const swapToLook = useCallback(
    async (idx: number, keepBottomMix = false) => {
      const normalized =
        ((idx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
      setLookIdx(normalized);
      if (!keepBottomMix) {
        setBottomLookIdx(null);
      }
      setActiveUploadedPiece(null);
      const token = ++swapTokenRef.current;

      let preload = preloadedImgsRef.current[normalized];
      if (!preload) {
        preload = new Image();
        preload.decoding = "async";
        preload.src = H(STUDIO_LOOKS[normalized].file, 900);
        preloadedImgsRef.current[normalized] = preload;
      }
      try {
        await preload.decode();
      } catch {
        // Continue immediately
      }
      if (token !== swapTokenRef.current) return;

      const container = figsRef.current;
      if (!container) return;

      const nextLayer = document.createElement("div");
      nextLayer.className = "gwo-fig-layer wipe-in";
      nextLayer.style.backgroundImage = `url("${H(
        STUDIO_LOOKS[normalized].file,
        900
      )}")`;
      container.appendChild(nextLayer);

      triggerScanLine();

      nextLayer.addEventListener(
        "animationend",
        () => {
          Array.from(container.children).forEach((ch) => {
            if (ch !== nextLayer) ch.remove();
          });
          nextLayer.classList.remove("wipe-in");
        },
        { once: true }
      );
    },
    [triggerScanLine]
  );

  // Cycle Top independently while preserving chosen Pants/Skirt
  const handleCycleTop = useCallback(
    (dir: 1 | -1) => {
      const currentPos = TWO_PIECE_LOOK_INDICES.indexOf(lookIdx);
      const nextPos =
        currentPos === -1
          ? 0
          : (currentPos + dir + TWO_PIECE_LOOK_INDICES.length) %
            TWO_PIECE_LOOK_INDICES.length;
      const nextTopIdx = TWO_PIECE_LOOK_INDICES[nextPos];
      const preservedBottom =
        bottomLookIdx !== null
          ? bottomLookIdx
          : TWO_PIECE_LOOK_INDICES.includes(lookIdx)
          ? lookIdx
          : TWO_PIECE_LOOK_INDICES[0];
      setBottomLookIdx(preservedBottom === nextTopIdx ? null : preservedBottom);
      void swapToLook(nextTopIdx, true);
      const topName = STUDIO_LOOKS[nextTopIdx].pieces.tops[0]?.name || "Top";
      showToast(`Changed Top → ${topName}`);
    },
    [bottomLookIdx, lookIdx, showToast, swapToLook]
  );

  // Cycle Pants/Skirt independently while keeping current Top
  const handleCyclePants = useCallback(
    (dir: 1 | -1) => {
      const ensuredTopIdx = TWO_PIECE_LOOK_INDICES.includes(lookIdx)
        ? lookIdx
        : TWO_PIECE_LOOK_INDICES[0];
      if (ensuredTopIdx !== lookIdx) {
        void swapToLook(ensuredTopIdx, true);
      }
      const activeBottom = bottomLookIdx ?? ensuredTopIdx;
      const currentPos = TWO_PIECE_LOOK_INDICES.indexOf(activeBottom);
      const nextPos =
        currentPos === -1
          ? 0
          : (currentPos + dir + TWO_PIECE_LOOK_INDICES.length) %
            TWO_PIECE_LOOK_INDICES.length;
      const nextBottomIdx = TWO_PIECE_LOOK_INDICES[nextPos];
      setBottomLookIdx(nextBottomIdx === ensuredTopIdx ? null : nextBottomIdx);
      setActiveUploadedPiece(null);
      triggerScanLine();
      const pantName =
        STUDIO_LOOKS[nextBottomIdx].pieces.bottoms[0]?.name || "Bottoms";
      showToast(`Changed Pants → ${pantName}`);
    },
    [bottomLookIdx, lookIdx, showToast, swapToLook, triggerScanLine]
  );

  // Ask AI Stylist for an instant outfit recommendation from Closet
  const handleAskAiCloset = useCallback(() => {
    const combos: Array<{
      topIdx: number;
      bottomIdx: number | null;
      note: string;
    }> = [
      {
        topIdx: 9,
        bottomIdx: 0,
        note: `AI Stylist (${ARCHETYPE_META[socialDna.primaryArchetype].shortTag}): Boned Espresso Corset + Washed Denim Maxi elongates your 5'2" frame.`,
      },
      {
        topIdx: 10,
        bottomIdx: 9,
        note: `AI Stylist: Ivory Bouclé Blazer + High-Waist Champagne Trousers hits your exact 27" waist.`,
      },
      {
        topIdx: 5,
        bottomIdx: 2,
        note: `AI Stylist: Oversized Black Blazer + Pleated Grey Trousers creates an effortless tailored silhouette.`,
      },
      {
        topIdx: 11,
        bottomIdx: null,
        note: `AI Stylist: Bias-Cut Emerald Silk Midi drapes cleanly across your 32.25" bust and 34" hips in Size ${recSize}.`,
      },
      {
        topIdx: 0,
        bottomIdx: 7,
        note: `AI Stylist: Charcoal Ribbed Tank + Khaki Parachute Cargo balances relaxed volume with a fitted upper torso.`,
      },
    ];
    const nextCombo =
      combos[(lookIdx + (bottomLookIdx ?? 1)) % combos.length];
    setBottomLookIdx(nextCombo.bottomIdx);
    void swapToLook(nextCombo.topIdx, nextCombo.bottomIdx !== null);
    setAiSuggestionNote(nextCombo.note);
    showToast("AI Stylist styled a fresh outfit for your 5'2\" avatar!");
  }, [bottomLookIdx, lookIdx, recSize, showToast, socialDna.primaryArchetype, swapToLook]);

  // Save current mixed Top + Pants (or current look) as a custom outfit in Closet
  const handleSaveCustomOutfit = useCallback(() => {
    const bIdx = bottomLookIdx ?? lookIdx;
    const topLook = STUDIO_LOOKS[lookIdx];
    const botLook = STUDIO_LOOKS[bIdx];
    const label =
      bIdx === lookIdx
        ? `${topLook.name} Edit`
        : `${topLook.pieces.tops[0]?.name.split(" ")[0] || topLook.name} + ${
            botLook.pieces.bottoms[0]?.name.split(" ").slice(-1)[0] ||
            botLook.name
          }`;
    const created: SavedCustomOutfit = {
      id: `custom-outfit-${Date.now()}`,
      name: label,
      topLookIdx: lookIdx,
      bottomLookIdx: bIdx,
      createdAt: new Date().toISOString(),
    };
    persistSavedOutfits([created, ...savedOutfits]);
    showToast(`Saved "${label}" to your Closet outfits!`);
  }, [bottomLookIdx, lookIdx, persistSavedOutfits, savedOutfits, showToast]);

  // Handle customer photo upload for own closet garments / outfits
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
        const maxDim = 900;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressed = canvas.toDataURL("image/webp", 0.84);
          setPendingUploadDataUrl(compressed);
        } else {
          setPendingUploadDataUrl(rawUrl);
        }
        setPendingUploadTitle(defaultTitle || "My Closet Piece");
        setUploadModalOpen(true);
      };
      img.src = rawUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConfirmUploadPiece = () => {
    if (!pendingUploadDataUrl) return;
    const finalTitle = pendingUploadTitle.trim() || "My Uploaded Outfit";
    addUploadedClosetPiece({
      title: finalTitle,
      slot: pendingUploadSlot,
      imageUrl: pendingUploadDataUrl,
      colorName: "My Closet",
    });
    const immediatePiece: UploadedClosetPiece = {
      id: `temp-${Date.now()}`,
      title: finalTitle,
      slot: pendingUploadSlot,
      imageUrl: pendingUploadDataUrl,
      colorName: "My Closet",
      createdAt: new Date().toISOString(),
    };
    setActiveUploadedPiece(immediatePiece);
    setUploadModalOpen(false);
    setPendingUploadDataUrl("");
    setPendingUploadTitle("");
    triggerScanLine();
  };

  useEffect(() => {
    if (
      activeImportedProduct?.studioLookIndex !== undefined &&
      activeImportedProduct.studioLookIndex !== lookIdx
    ) {
      void swapToLook(activeImportedProduct.studioLookIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeImportedProduct?.id, activeImportedProduct?.studioLookIndex, swapToLook]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void swapToLook(lookIdx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        void swapToLook(lookIdx - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lookIdx, swapToLook]);

  const isOverModel = useCallback((cx: number, cy: number) => {
    const box = modelBoxRef.current?.getBoundingClientRect();
    if (!box) return false;
    return (
      cx >= box.left - 40 &&
      cx <= box.right + 40 &&
      cy >= box.top - 20 &&
      cy <= box.bottom + 20
    );
  }, []);

  // Zero-React-Rerender Pointer Parallax & Drag Pill Tracking
  useEffect(() => {
    let rafPending = false;
    let latestX = 0;
    let latestY = 0;

    const onMove = (e: PointerEvent) => {
      latestX = e.clientX;
      latestY = e.clientY;

      if (dragItem && dragPillRef.current) {
        dragPillRef.current.style.transform = `translate3d(${latestX + 14}px, ${
          latestY - 18
        }px, 0)`;
        const over = isOverModel(latestX, latestY);
        setOverAvatar((prev) => (prev === over ? prev : over));
      }

      if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
          rafPending = false;
          if (backdropRef.current) {
            const px = (latestX / window.innerWidth - 0.5) * -14;
            const py = (latestY / window.innerHeight - 0.5) * -7;
            backdropRef.current.style.transform = `translate3d(${px.toFixed(
              1
            )}px, ${py.toFixed(1)}px, 0) scale(1.03)`;
          }
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragItem) return;
      if (isOverModel(e.clientX, e.clientY)) {
        if (dragItem.kind === "look" && dragItem.lookIndex !== undefined) {
          void swapToLook(dragItem.lookIndex);
          showToast(`Trying on ${dragItem.label}`);
        } else if (dragItem.kind === "accessory" && dragItem.accessoryName) {
          const accName = dragItem.accessoryName;
          setEquippedAccessories((prev) =>
            prev.includes(accName) ? prev : [...prev, accName]
          );
          triggerScanLine();
          showToast(`Added ${accName} to your look`);
        } else if (dragItem.kind === "scraped" && dragItem.product) {
          setActiveImportedProduct(dragItem.product);
          triggerScanLine();
          showToast(`Styled ${dragItem.label} onto your avatar`);
        } else if (dragItem.kind === "uploaded" && dragItem.uploadedPiece) {
          setActiveUploadedPiece(dragItem.uploadedPiece);
          triggerScanLine();
          showToast(`Wearing ${dragItem.label} on your avatar`);
        }
      }
      setDragItem(null);
      setOverAvatar(false);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragItem, isOverModel, setActiveImportedProduct, showToast, swapToLook, triggerScanLine]);

  const startDrag = useCallback((e: React.PointerEvent, payload: DragPayload) => {
    setDragItem(payload);
    requestAnimationFrame(() => {
      if (dragPillRef.current) {
        dragPillRef.current.style.transform = `translate3d(${e.clientX + 14}px, ${
          e.clientY - 18
        }px, 0)`;
      }
    });
  }, []);

  const currentLook = STUDIO_LOOKS[lookIdx];
  const activeBottomLook =
    bottomLookIdx !== null ? STUDIO_LOOKS[bottomLookIdx] : null;
  const isMixedTopPants =
    activeBottomLook !== null && activeBottomLook.index !== currentLook.index;

  // Determine which STUDIO_LOOKS are "Bought" vs "In Cart"
  const boughtLookIndices = useMemo(() => {
    const set = new Set<number>([0, 1, 2, 8]); // Starter closet pieces owned by customer
    for (const p of purchasedItems) {
      if (typeof p.lookIndex === "number") set.add(p.lookIndex);
      if (p.productId) {
        for (const lk of STUDIO_LOOKS) {
          if (
            lk.productId === p.productId ||
            lk.relatedProductIds?.includes(p.productId)
          ) {
            set.add(lk.index);
          }
        }
      }
      const lowerTitle = p.title.toLowerCase();
      for (const lk of STUDIO_LOOKS) {
        const allNames = [
          ...lk.pieces.tops,
          ...lk.pieces.bottoms,
          ...lk.pieces.full,
        ].map((x) => x.name.toLowerCase());
        if (allNames.some((n) => lowerTitle.includes(n) || n.includes(lowerTitle))) {
          set.add(lk.index);
        }
      }
    }
    return set;
  }, [purchasedItems]);

  const inCartLookIndices = useMemo(() => {
    const set = new Set<number>();
    for (const b of bagItems) {
      if (b.productId) {
        for (const lk of STUDIO_LOOKS) {
          if (
            lk.productId === b.productId ||
            lk.relatedProductIds?.includes(b.productId)
          ) {
            set.add(lk.index);
          }
        }
      }
      const lowerTitle = b.title.toLowerCase();
      for (const lk of STUDIO_LOOKS) {
        const allNames = [
          ...lk.pieces.tops,
          ...lk.pieces.bottoms,
          ...lk.pieces.full,
        ].map((x) => x.name.toLowerCase());
        if (allNames.some((n) => lowerTitle.includes(n) || n.includes(lowerTitle))) {
          set.add(lk.index);
        }
      }
    }
    return set;
  }, [bagItems]);

  const filteredLooks = useMemo(() => {
    if (category === "bought") {
      return STUDIO_LOOKS.filter((lk) => boughtLookIndices.has(lk.index));
    }
    if (category === "cart") {
      return STUDIO_LOOKS.filter((lk) => inCartLookIndices.has(lk.index));
    }
    if (category === "uploaded" || category === "saved" || category === "accessories") {
      return [];
    }
    return STUDIO_LOOKS;
  }, [boughtLookIndices, category, inCartLookIndices]);

  const currentPieces = useMemo(() => {
    const p = currentLook.pieces;
    const base = isMixedTopPants
      ? [
          ...p.tops,
          ...activeBottomLook.pieces.bottoms,
          ...activeBottomLook.pieces.shoes,
          ...p.acc,
        ]
      : [...p.tops, ...p.bottoms, ...p.full, ...p.shoes, ...p.acc];

    const extraAcc = ACCESSORY_CATALOG.filter(
      (a) =>
        equippedAccessories.includes(a.name) &&
        !base.some((existing) => existing.name === a.name)
    ).map((a) => ({ name: a.name, color: a.color, price: a.price }));
    return [...base, ...extraAcc];
  }, [activeBottomLook, currentLook, equippedAccessories, isMixedTopPants]);

  const totalLookPrice = currentPieces.reduce((s, p) => s + p.price, 0);

  const stageTitle = useMemo(() => {
    if (activeUploadedPiece) return activeUploadedPiece.title;
    if (isMixedTopPants) {
      const t = currentLook.pieces.tops[0]?.name.split(" ").slice(0, 2).join(" ");
      const b = activeBottomLook.pieces.bottoms[0]?.name
        .split(" ")
        .slice(-2)
        .join(" ");
      return `${t || currentLook.name} + ${b || activeBottomLook.name}`;
    }
    return currentLook.name;
  }, [activeBottomLook, activeUploadedPiece, currentLook, isMixedTopPants]);

  const handleAddFullLook = () => {
    currentPieces.forEach((piece) => {
      addToBag({
        title: piece.name,
        brand: "GWO Boutique",
        price: piece.price,
        size: recSize,
        avatarFrontUrl: H(currentLook.file, 900),
        avatarBackUrl: H_BACK(currentLook.file),
        productId: currentLook.productId,
      });
    });
  };

  const scrapedSavedItems = useMemo(
    () => products.filter((p) => p.sourceType === "scraped_url").slice(0, 6),
    [products]
  );

  const renderAvatarComposite = (angle: "front" | "back") => {
    const topSrc =
      angle === "front"
        ? H(currentLook.file, 900)
        : H_BACK(currentLook.file);
    const botSrc = activeBottomLook
      ? angle === "front"
        ? H(activeBottomLook.file, 900)
        : H_BACK(activeBottomLook.file)
      : topSrc;

    if (!isMixedTopPants) {
      return (
        <img
          src={topSrc}
          alt={`${currentLook.name} ${angle}`}
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none"
        />
      );
    }

    return (
      <>
        <img
          src={botSrc}
          alt={`${activeBottomLook.name} pants ${angle}`}
          decoding="async"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, transparent 43%, #000 49%, #000 100%)",
            maskImage:
              "linear-gradient(to bottom, transparent 0%, transparent 43%, #000 49%, #000 100%)",
          }}
          className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none"
        />
        <img
          src={topSrc}
          alt={`${currentLook.name} top ${angle}`}
          decoding="async"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 0%, #000 44%, transparent 50%, transparent 100%)",
            maskImage:
              "linear-gradient(to bottom, #000 0%, #000 44%, transparent 50%, transparent 100%)",
          }}
          className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none"
        />
      </>
    );
  };

  return (
    <div className="relative min-h-[calc(100svh-64px)] lg:h-[calc(100svh-64px)] w-full overflow-x-hidden lg:overflow-hidden select-none bg-[#E7EAEF]">
      <style>{`
        .gwo-fig-layer {
          position: absolute;
          inset: 0;
          background-position: center bottom;
          background-size: 100% 100%;
          background-repeat: no-repeat;
          will-change: clip-path;
        }
        .gwo-fig-layer.wipe-in {
          clip-path: inset(0 0 100% 0);
          animation: gwoCleanWipe 0.72s cubic-bezier(0.65, 0, 0.25, 1) forwards;
        }
        @keyframes gwoCleanWipe {
          0% { clip-path: inset(0 0 100% 0); }
          100% { clip-path: inset(0 0 0 0); }
        }
        .gwo-scan-beam {
          position: absolute;
          left: -8%;
          right: -8%;
          top: 0;
          height: 2px;
          opacity: 0;
          pointer-events: none;
          z-index: 25;
          background: linear-gradient(90deg, transparent, #ffffff 25%, #ffffff 75%, transparent);
          box-shadow: 0 0 18px 4px rgba(255, 255, 255, 0.7);
          will-change: top, opacity;
        }
        .gwo-scan-beam.active {
          animation: gwoBeamSweep 0.72s cubic-bezier(0.65, 0, 0.25, 1) forwards;
        }
        @keyframes gwoBeamSweep {
          0% { top: 0%; opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

      {/* Hidden Photo Upload Input for Customer Closet Clothes */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelectUploadFile}
      />

      {/* ==================== PHOTOREAL DAYLIGHT STUDIO BACKDROP ==================== */}
      <div
        ref={backdropRef}
        className="absolute inset-[-3%] bg-cover bg-center will-change-transform"
        style={{
          backgroundImage: `url("${LOFT_BG_URL}")`,
          transform: "translate3d(0, 0, 0) scale(1.03)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/18 pointer-events-none" />

      {/* ==================== RESPONSIVE 3-ZONE STUDIO GRID ==================== */}
      <div className="relative z-10 min-h-[calc(100svh-64px)] lg:h-full max-w-[1520px] mx-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col lg:flex-row items-stretch justify-between gap-3 sm:gap-4">
        {/* ==================== LEFT PANEL: MY AVATAR, MY CLOSET SOURCES & MEASUREMENTS ==================== */}
        <aside className="hidden lg:flex lg:w-[304px] xl:w-[314px] lg:h-full shrink-0 flex-col justify-between rounded-3xl bg-white/94 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 xl:p-5 overflow-y-auto">
          <div className="space-y-3.5">
            {/* Customer Photo Avatar Card */}
            <div className="p-3.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                    alt="Your Avatar"
                    className="w-10 h-10 rounded-full object-cover border-2 border-[#244B3B] shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#141518] truncate">
                      Your Lifelike Studio Avatar ✓
                    </p>
                    <p className="text-[11px] text-[#4E5A54] leading-tight">
                      Active across Closet, Runway &amp; 360°
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="w-full py-2 rounded-full text-xs font-semibold bg-[#141518] hover:bg-[#27292E] text-white inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <Camera className="w-3.5 h-3.5" />
                Upload Different Selfie
              </button>
            </div>

            {/* Closet Header + Add Outfit Actions */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                  Personal Wardrobe
                </p>
                <h1 className="text-base font-bold text-[#141518]">
                  My Closet &amp; Outfits
                </h1>
              </div>
              <button
                type="button"
                id="gwo-left-upload-outfit-btn"
                onClick={() => uploadInputRef.current?.click()}
                className="px-2.5 py-1.5 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition shrink-0"
              >
                <ImagePlus className="w-3.5 h-3.5" /> + Upload
              </button>
            </div>

            {/* 1-Tap Personal Closet Source Switcher */}
            <div className="space-y-1.5">
              {(
                [
                  {
                    id: "all" as ClosetFilterTab,
                    title: "All My Closet",
                    sub: `${STUDIO_LOOKS.length + uploadedClosetPieces.length + savedOutfits.length} outfits & pieces ready`,
                    badge: `${STUDIO_LOOKS.length + uploadedClosetPieces.length}`,
                  },
                  {
                    id: "bought" as ClosetFilterTab,
                    title: "Bought & Owned",
                    sub: "Items you bought or unlocked at checkout",
                    badge: `${boughtLookIndices.size}`,
                  },
                  {
                    id: "cart" as ClosetFilterTab,
                    title: "In My Cart / Bag",
                    sub:
                      bagItems.length > 0
                        ? `${bagItems.length} pieces currently in your Bag`
                        : "Add Runway pieces to try them here",
                    badge: `${bagItems.length}`,
                  },
                  {
                    id: "uploaded" as ClosetFilterTab,
                    title: "Uploaded Clothes Photos",
                    sub: "Your own clothes uploaded via camera/photo",
                    badge: `${uploadedClosetPieces.length}`,
                  },
                ] as const
              ).map((src) => {
                const active = category === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setCategory(src.id)}
                    className={`w-full p-2.5 rounded-2xl text-left transition flex items-center justify-between border cursor-pointer ${
                      active
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.05]"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold truncate">{src.title}</p>
                      <p
                        className={`text-[11px] truncate ${
                          active ? "text-white/75" : "text-[#686D76]"
                        }`}
                      >
                        {src.sub}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        active
                          ? "bg-[#244B3B] text-[#C8F0DF]"
                          : "bg-[#E7F3EE] text-[#244B3B]"
                      }`}
                    >
                      {src.badge}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Simple Fit Profile Measurements */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#686D76]" /> Avatar Measurements
                </span>
                <button
                  type="button"
                  onClick={() => setEditingFit((v) => !v)}
                  className="px-2.5 py-1 rounded-full bg-white border border-black/[0.08] text-[11px] font-bold text-[#244B3B] hover:bg-[#EBF3EE] cursor-pointer"
                >
                  {editingFit ? "Done" : "Edit"}
                </button>
              </div>

              {!editingFit ? (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-4 gap-1.5 text-center">
                    <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                        Height
                      </p>
                      <p className="text-xs font-bold text-[#141518]">
                        {Math.floor(activeHeight / 12)}&apos;{Math.round(activeHeight % 12)}&quot;
                      </p>
                    </div>
                    <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                        Bust
                      </p>
                      <p className="text-xs font-bold text-[#141518]">
                        {activeBust}&quot;
                      </p>
                    </div>
                    <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                        Waist
                      </p>
                      <p className="text-xs font-bold text-[#141518]">
                        {activeWaist}&quot;
                      </p>
                    </div>
                    <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                        Hips
                      </p>
                      <p className="text-xs font-bold text-[#141518]">
                        {activeHips}&quot;
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#686D76]">
                    Petite Frame ({activeHeight}&quot;) • Shoe {user?.shoeSize || "7.5"} • Best Fit:{" "}
                    <strong className="text-[#244B3B]">Size {recSize}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSocialModalOpen(true)}
                    className="w-full py-1.5 px-2.5 rounded-xl bg-[#FDEEF4] hover:bg-[#FADCE8] border border-[#F5C5D8] text-[10.5px] font-bold text-[#9D174D] flex items-center justify-between gap-1.5 cursor-pointer transition"
                  >
                    <span className="inline-flex items-center gap-1 truncate">
                      <Instagram className="w-3 h-3 shrink-0" />
                      {socialDna.instagramHandle || "@mila.nyc"} •{" "}
                      {ARCHETYPE_META[socialDna.primaryArchetype].shortTag} DNA
                    </span>
                    <span className="underline shrink-0">Link IG / Pin</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Bust (in)
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeBust}
                      onChange={(e) => setBustIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Waist (in)
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeWaist}
                      onChange={(e) => setWaistIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Hips (in)
                    <input
                      type="number"
                      step="0.25"
                      defaultValue={activeHips}
                      onChange={(e) => setHipsIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <label className="text-[10px] text-[#686D76] font-semibold">
                    Height (in)
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={activeHeight}
                      onChange={(e) => setHeightIn(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-black/10 text-xs text-[#141518]"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateProfilePatch({
                        ...(bustIn ? { bustInches: bustIn } : {}),
                        ...(waistIn ? { waistInches: waistIn } : {}),
                        ...(hipsIn ? { hipsInches: hipsIn } : {}),
                        ...(heightIn ? { heightInches: heightIn } : {}),
                      });
                      setEditingFit(false);
                    }}
                    className="col-span-2 py-1.5 rounded-xl bg-[#141518] text-white text-xs font-semibold cursor-pointer"
                  >
                    Save Measurements
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Share Closet CTA */}
          <button
            type="button"
            onClick={async () => {
              await shareMyClosetAndClaimBonus();
              setCopiedCloset(true);
              setTimeout(() => setCopiedCloset(false), 2200);
            }}
            className="w-full py-2.5 px-4 rounded-2xl bg-[#EEF5F1] hover:bg-[#E2EFE8] text-[#1D4232] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer mt-2"
          >
            {copiedCloset ? (
              <>
                <Check className="w-3.5 h-3.5" /> Closet Link Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Share My Closet Link
              </>
            )}
          </button>
        </aside>

        {/* ==================== CENTER STAGE: UNOBSTRUCTED LIFELIKE STUDIO AVATAR ==================== */}
        <div className="relative flex-1 min-w-0 flex flex-col items-center justify-between h-[56svh] min-h-[400px] lg:h-full lg:min-h-0">
          {/* Clean Top Bar (Never Overlaps Avatar Head!) */}
          <div className="shrink-0 z-20 flex flex-wrap items-center justify-center gap-1.5">
            <div className="px-3.5 py-1.5 rounded-full bg-white/94 backdrop-blur-md border border-black/[0.07] shadow-xs flex items-center gap-2 text-xs max-w-[260px] sm:max-w-none">
              {customAvatar && (
                <img
                  src={customAvatar.badgeDataUrl}
                  alt="You"
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              )}
              <span className="font-bold text-[#141518] truncate">{stageTitle}</span>
              <span className="text-[#244B3B] font-semibold shrink-0">
                • {boughtLookIndices.has(lookIdx) ? "Owned" : `Size ${recSize}`}
              </span>
            </div>

            {/* Compact Mobile Fit Summary Pill */}
            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="lg:hidden px-3 py-1.5 rounded-full bg-[#EBF3EE] border border-[#C5DFD0] text-[11px] font-bold text-[#1D4232] inline-flex items-center gap-1 cursor-pointer"
            >
              <Ruler className="w-3 h-3" />
              {Math.floor(activeHeight / 12)}&apos;{Math.round(activeHeight % 12)}&quot; • Size{" "}
              {recSize}
            </button>

            {/* Lifelike Studio Avatar Angle Switcher (100% Real Photos — Zero Wireframes!) */}
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs">
              {(
                [
                  ["studio", "Front"],
                  ["back", "Back 180°"],
                  ["split", "Front + Back"],
                ] as const
              ).map(([modeId, modeLabel]) => {
                const active = closetStageAngle === modeId;
                return (
                  <button
                    key={modeId}
                    type="button"
                    id={`gwo-closet-angle-${modeId}`}
                    onClick={() => setClosetStageAngle(modeId)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap ${
                      active
                        ? "bg-[#141518] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    {modeId === "split" && <Columns2 className="w-3 h-3" />}
                    {modeLabel}
                  </button>
                );
              })}
              <button
                type="button"
                id="gwo-closet-angle-360"
                onClick={() => router.push(`/product?look=${lookIdx}`)}
                className="px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition whitespace-nowrap text-[#244B3B] hover:bg-[#EBF3EE]"
              >
                <Rotate3d className="w-3 h-3" />
                360° Fit
              </button>
            </div>
          </div>

          {/* Contained Interactive Lifelike Avatar Viewport */}
          <div className="relative flex-1 w-full min-h-0 my-1.5 overflow-hidden">
            <div className="absolute inset-0 flex items-end justify-center">
              {/* Side-by-Side Front + Back Lifelike Studio Photos on NYC Loft Floor */}
            {closetStageAngle === "split" && (
              <div
                onPointerDown={(e) => {
                  swipeStartXRef.current = e.clientX;
                }}
                onPointerUp={(e) => {
                  if (swipeStartXRef.current === null) return;
                  const dx = e.clientX - swipeStartXRef.current;
                  swipeStartXRef.current = null;
                  if (Math.abs(dx) > 40 && !dragItem) {
                    void swapToLook(lookIdx + (dx < 0 ? 1 : -1));
                  }
                }}
                className="relative h-full w-full max-w-[640px] flex items-end justify-center gap-2 sm:gap-5 px-2 cursor-grab active:cursor-grabbing"
              >
                {(["front", "back"] as const).map((ang) => (
                  <div
                    key={ang}
                    className="relative h-full aspect-[1360/2048] flex items-end justify-center"
                  >
                    <div
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-6 rounded-full pointer-events-none"
                      style={{
                        background:
                          "radial-gradient(closest-side, rgba(25,26,30,0.42), transparent)",
                      }}
                    />
                    {renderAvatarComposite(ang)}
                    {ang === "front" && customAvatar && (
                      <img
                        src={customAvatar.faceOvalDataUrl}
                        alt="Your uploaded avatar face"
                        decoding="async"
                        style={{
                          left: "49.95%",
                          top: "13.2%",
                          width: "12.9%",
                          height: "9.7%",
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none z-15"
                      />
                    )}
                    <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-bold whitespace-nowrap pointer-events-none">
                      {ang === "front" ? "Front 0°" : "Back 180°"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Single Full-Height Lifelike Avatar (Front 0° OR Back 180°) */}
            <div
              ref={modelBoxRef}
              onPointerDown={(e) => {
                swipeStartXRef.current = e.clientX;
              }}
              onPointerUp={(e) => {
                if (swipeStartXRef.current === null) return;
                const dx = e.clientX - swipeStartXRef.current;
                swipeStartXRef.current = null;
                if (Math.abs(dx) > 40 && !dragItem) {
                  void swapToLook(lookIdx + (dx < 0 ? 1 : -1));
                }
              }}
              className={`${
                closetStageAngle !== "split" ? "flex" : "hidden"
              } relative h-full items-end justify-center cursor-grab active:cursor-grabbing transition-transform duration-500 will-change-transform ${
                zoomed ? "scale-[1.35] translate-y-20" : "scale-100"
              }`}
            >
              <div className="relative h-full aspect-[1360/2048]">
                {overAvatar && (
                  <div className="absolute inset-x-2 inset-y-2 rounded-3xl border-2 border-dashed border-white bg-white/20 z-30 flex items-start justify-center pt-4 pointer-events-none">
                    <span className="px-3 py-1 rounded-full bg-[#141518] text-white text-[11px] font-bold shadow-lg">
                      Drop to Try On Avatar
                    </span>
                  </div>
                )}

                {/* Floor Shadow */}
                <div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-7 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(25,26,30,0.42), transparent)",
                  }}
                />

                {/* Smooth Wipe Front Layer (hidden when in Back 180° or Mix-and-Match composite mode) */}
                <div
                  ref={figsRef}
                  className={`absolute inset-0 pointer-events-none ${
                    closetStageAngle === "studio" && !isMixedTopPants
                      ? "block"
                      : "hidden"
                  }`}
                />

                {/* Lifelike Back 180° Photo OR Seamless Waist-Feathered Mix-and-Match Layer */}
                {(closetStageAngle === "back" || isMixedTopPants) &&
                  renderAvatarComposite(
                    closetStageAngle === "back" ? "back" : "front"
                  )}

                {/* Customer-Uploaded Closet Clothing Photo Draped on Avatar */}
                {activeUploadedPiece && closetStageAngle === "studio" && (
                  <div className="absolute inset-0 pointer-events-none z-16 flex items-center justify-center">
                    <img
                      src={activeUploadedPiece.imageUrl}
                      alt={activeUploadedPiece.title}
                      style={{
                        left: "50%",
                        top:
                          activeUploadedPiece.slot === "pants"
                            ? "60%"
                            : activeUploadedPiece.slot === "top"
                            ? "34%"
                            : "47%",
                        width:
                          activeUploadedPiece.slot === "full" ? "52%" : "44%",
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl shadow-xl object-contain bg-white/90 p-1 border border-black/10"
                    />
                  </div>
                )}

                {/* Imported Store Garment Draped when Flat-Lay Mode Active */}
                {activeImportedProduct?.imageUrl &&
                  drapeFlatLay &&
                  closetStageAngle === "studio" && (
                    <img
                      src={activeImportedProduct.imageUrl}
                      alt={activeImportedProduct.title}
                      style={{
                        left: "50%",
                        top:
                          activeImportedProduct.category === "bottom"
                            ? "58%"
                            : activeImportedProduct.category === "dress"
                            ? "46%"
                            : activeImportedProduct.category === "shoes"
                            ? "88%"
                            : "34%",
                        width:
                          activeImportedProduct.category === "shoes"
                            ? "32%"
                            : activeImportedProduct.category === "dress"
                            ? "48%"
                            : "44%",
                      }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 object-contain mix-blend-multiply pointer-events-none z-14"
                    />
                  )}

                {/* Customer Uploaded Photo Avatar Face Overlay (Front Only!) */}
                {customAvatar && closetStageAngle === "studio" && (
                  <img
                    src={customAvatar.faceOvalDataUrl}
                    alt="Your uploaded avatar face"
                    decoding="async"
                    style={{
                      left: "49.95%",
                      top: "13.2%",
                      width: "12.9%",
                      height: "9.7%",
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none z-15"
                  />
                )}

                <div ref={scanRef} className="gwo-scan-beam" />
              </div>
            </div>
            </div>
          </div>

          {/* Clean Minimal Bottom Stage Controls (Dedicated Dock Below Avatar!) */}
          <div className="shrink-0 flex items-center gap-1 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-white/94 backdrop-blur-md border border-black/[0.08] shadow-lg z-20">
            <button
              type="button"
              onClick={() => void swapToLook(lookIdx - 1)}
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
              title="Previous Outfit"
              aria-label="Previous Outfit"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#F1F2F5] text-[#141518] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {zoomed ? "Full Body" : "Zoom Fit"}
              </span>
              <span className="sm:hidden">{zoomed ? "Full" : "Zoom"}</span>
            </button>

            <button
              type="button"
              id="gwo-closet-save-outfit-btn"
              onClick={handleSaveCustomOutfit}
              className="px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold bg-[#EBF3EE] hover:bg-[#DCECE3] text-[#1D4232] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              title="Save this outfit combo to your Closet"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Save Outfit</span>
            </button>

            <button
              type="button"
              onClick={handleAddFullLook}
              className="px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Bag (${totalLookPrice})
            </button>

            <button
              type="button"
              onClick={() => void swapToLook(lookIdx + 1)}
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
              title="Next Outfit"
              aria-label="Next Outfit"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ==================== RIGHT PANEL: ADD OUTFIT, CHANGE TOP/PANTS, AI & WARDROBE GRID ==================== */}
        <aside className="w-full lg:w-[376px] xl:w-[392px] lg:h-full shrink-0 rounded-3xl bg-white/94 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 xl:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3">
            {/* Active Uploaded Photo Banner */}
            {activeUploadedPiece && (
              <div className="rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] p-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={activeUploadedPiece.imageUrl}
                    alt={activeUploadedPiece.title}
                    className="w-10 h-12 rounded-lg object-cover border border-black/10 shrink-0 bg-white"
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#244B3B]">
                      Your Uploaded Piece • Active
                    </p>
                    <p className="text-xs font-bold text-[#141518] truncate">
                      {activeUploadedPiece.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveUploadedPiece(null)}
                  className="p-1.5 rounded-full hover:bg-black/[0.06] text-[#686D76] cursor-pointer"
                  aria-label="Clear uploaded piece"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Docked Active Imported Store Piece Banner */}
            {activeImportedProduct && (
              <div
                id="gwo-stage-imported-card"
                className="rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] p-2.5 space-y-2"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-14 rounded-xl overflow-hidden bg-white border border-black/[0.06] shrink-0">
                    <GarmentArtwork
                      product={activeImportedProduct}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#244B3B] truncate">
                        {activeImportedProduct.brand} • Active Fit
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveImportedProduct(null)}
                        className="p-1.5 rounded-full hover:bg-black/[0.06] text-[#686D76] cursor-pointer"
                        title="Clear active store piece"
                        aria-label="Clear active store piece"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs font-bold text-[#141518] truncate">
                      {activeImportedProduct.title}
                    </p>
                    <p className="text-[11px] font-semibold text-[#1D4232]">
                      ${activeImportedProduct.price} • Size{" "}
                      {activeImportedFit?.recommendedSize || recSize} (
                      {activeImportedFit?.confidencePct || 94}% Match)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      openAvatar360({
                        title: `${activeImportedProduct.brand} — ${activeImportedProduct.title}`,
                        primaryProduct: activeImportedProduct,
                        initialAngleMode: "split",
                      })
                    }
                    className="flex-1 py-1.5 px-2.5 rounded-full text-[11px] font-bold bg-[#141518] hover:bg-[#27292E] text-white inline-flex items-center justify-center gap-1 cursor-pointer transition"
                  >
                    <Rotate3d className="w-3 h-3 text-[#A7D7C5]" /> Front + Back 360°
                  </button>
                </div>
              </div>
            )}

            {/* Header + Add Photo / Add Link Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#141518]">
                  My Closet Outfits
                </h2>
                <p className="text-xs text-[#686D76]">
                  Swipe outfits, swap tops &amp; pants, or upload photos
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  id="gwo-closet-upload-photo-btn"
                  onClick={() => uploadInputRef.current?.click()}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#244B3B] hover:bg-[#1D3E30] text-white inline-flex items-center gap-1 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Upload
                </button>
                <button
                  type="button"
                  id="gwo-closet-add-store-btn"
                  onClick={() => setAddUrlModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#244B3B]" /> + Link
                </button>
              </div>
            </div>

            {/* Mix & Match Top / Pants + Ask AI Stylist Control Strip */}
            <div className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div className="flex items-center justify-between rounded-xl bg-white border border-black/[0.07] px-1.5 py-1">
                  <button
                    type="button"
                    id="gwo-prev-top-btn"
                    onClick={() => handleCycleTop(-1)}
                    aria-label="Previous Top"
                    className="p-1 rounded-lg hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-[#141518]">
                    Top
                  </span>
                  <button
                    type="button"
                    id="gwo-next-top-btn"
                    onClick={() => handleCycleTop(1)}
                    aria-label="Next Top"
                    className="p-1 rounded-lg hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white border border-black/[0.07] px-1.5 py-1">
                  <button
                    type="button"
                    id="gwo-prev-pants-btn"
                    onClick={() => handleCyclePants(-1)}
                    aria-label="Previous Pants"
                    className="p-1 rounded-lg hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-bold text-[#141518]">
                    Pants
                  </span>
                  <button
                    type="button"
                    id="gwo-next-pants-btn"
                    onClick={() => handleCyclePants(1)}
                    aria-label="Next Pants"
                    className="p-1 rounded-lg hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  id="gwo-closet-ask-ai-btn"
                  onClick={handleAskAiCloset}
                  className="rounded-xl bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 py-1.5 px-2 cursor-pointer transition"
                >
                  <Wand2 className="w-3.5 h-3.5 text-[#A7D7C5]" /> Ask AI
                </button>
              </div>

              {aiSuggestionNote && (
                <div className="px-2.5 py-1.5 rounded-xl bg-[#EBF3EE] border border-[#C5DFD0] flex items-start justify-between gap-2">
                  <p className="text-[10.5px] font-semibold text-[#1D4232] leading-snug">
                    {aiSuggestionNote}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiSuggestionNote(null)}
                    aria-label="Dismiss AI note"
                    className="p-1 rounded-full hover:bg-black/5 text-[#1D4232] shrink-0 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Closet Filter Pills */}
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["all", "All"],
                  ["bought", `Bought (${boughtLookIndices.size})`],
                  ["cart", `In Cart (${bagItems.length})`],
                  ["uploaded", `Uploaded (${uploadedClosetPieces.length})`],
                  ["saved", `Saved (${savedOutfits.length})`],
                  ["accessories", "Accessories"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                    category === id
                      ? "bg-[#141518] text-white"
                      : "bg-[#F4F5F7] text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Accessories Grid */}
            {category === "accessories" && (
              <div className="grid grid-cols-2 gap-2.5">
                {ACCESSORY_CATALOG.map((acc) => {
                  const on = equippedAccessories.includes(acc.name);
                  return (
                    <div
                      key={acc.id}
                      onPointerDown={(e) =>
                        startDrag(e, {
                          kind: "accessory",
                          label: acc.name,
                          price: acc.price,
                          accessoryName: acc.name,
                        })
                      }
                      onClick={() => {
                        setEquippedAccessories((prev) =>
                          prev.includes(acc.name)
                            ? prev.filter((x) => x !== acc.name)
                            : [...prev, acc.name]
                        );
                        triggerScanLine();
                      }}
                      className={`p-3 rounded-2xl border cursor-grab transition ${
                        on
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-[#F7F8FA] hover:bg-[#EFF1F5] text-[#141518] border-black/[0.06]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{acc.name}</span>
                        <span className="text-xs font-semibold">${acc.price}</span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          on ? "text-white/70" : "text-[#686D76]"
                        }`}
                      >
                        {acc.color} • {on ? "Worn" : "Tap to wear"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Saved Custom Mixed Outfits */}
            {(category === "saved" ||
              (category === "all" && savedOutfits.length > 0)) && (
              <div className="space-y-1.5">
                {category === "all" && (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                    Saved Custom Outfits ({savedOutfits.length})
                  </p>
                )}
                {savedOutfits.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-dashed border-black/15 text-center space-y-2">
                    <p className="text-xs font-semibold text-[#141518]">
                      No custom saved outfits yet
                    </p>
                    <p className="text-[11px] text-[#686D76]">
                      Use <strong>Top</strong> &amp; <strong>Pants</strong> arrows above, then tap <strong>Save Outfit</strong>!
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {savedOutfits.map((so) => (
                      <div
                        key={so.id}
                        className="p-2.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setBottomLookIdx(
                              so.bottomLookIdx === so.topLookIdx
                                ? null
                                : so.bottomLookIdx
                            );
                            void swapToLook(
                              so.topLookIdx,
                              so.bottomLookIdx !== so.topLookIdx
                            );
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          <p className="text-xs font-bold text-[#141518] truncate">
                            {so.name}
                          </p>
                          <p className="text-[10px] text-[#244B3B] font-semibold">
                            Tap to wear outfit
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            persistSavedOutfits(
                              savedOutfits.filter((x) => x.id !== so.id)
                            )
                          }
                          aria-label={`Remove ${so.name}`}
                          className="p-1.5 rounded-full hover:bg-black/5 text-[#686D76] cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Customer Uploaded Closet Photos */}
            {(category === "uploaded" ||
              (category === "all" && uploadedClosetPieces.length > 0)) && (
              <div className="space-y-1.5">
                {category === "all" && (
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                    My Uploaded Clothes ({uploadedClosetPieces.length})
                  </p>
                )}
                {uploadedClosetPieces.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-dashed border-black/15 text-center space-y-2">
                    <p className="text-xs font-semibold text-[#141518]">
                      Upload pictures of clothes you already own
                    </p>
                    <button
                      type="button"
                      onClick={() => uploadInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-full bg-[#244B3B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ImagePlus className="w-3.5 h-3.5" /> Upload Clothing Photo
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {uploadedClosetPieces.map((up) => {
                      const active = activeUploadedPiece?.id === up.id;
                      return (
                        <div
                          key={up.id}
                          onPointerDown={(e) =>
                            startDrag(e, {
                              kind: "uploaded",
                              label: up.title,
                              price: 0,
                              uploadedPiece: up,
                            })
                          }
                          onClick={() => {
                            setActiveUploadedPiece(active ? null : up);
                            triggerScanLine();
                          }}
                          className={`relative h-28 rounded-2xl overflow-hidden border cursor-pointer transition bg-white ${
                            active
                              ? "border-[#244B3B] ring-2 ring-[#244B3B]/25"
                              : "border-black/[0.08]"
                          }`}
                        >
                          <img
                            src={up.imageUrl}
                            alt={up.title}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              if (activeUploadedPiece?.id === up.id) {
                                setActiveUploadedPiece(null);
                              }
                              removeUploadedClosetPiece(up.id);
                            }}
                            aria-label={`Delete ${up.title}`}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/65 text-white hover:bg-black cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute inset-x-1 bottom-1 px-1.5 py-0.5 rounded-lg bg-white/92 text-[9.5px] font-bold text-[#141518] truncate text-center">
                            {up.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Main Lifelike Avatar Closet Outfit Grid */}
            {category !== "accessories" &&
              category !== "uploaded" &&
              category !== "saved" && (
                <>
                  {filteredLooks.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-dashed border-black/15 text-center space-y-2">
                      <p className="text-xs font-semibold text-[#141518]">
                        No outfits in your bag yet
                      </p>
                      <button
                        type="button"
                        onClick={() => router.push("/shop")}
                        className="px-3.5 py-2 rounded-full bg-[#141518] text-white text-xs font-bold cursor-pointer"
                      >
                        Browse AI Runway →
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2">
                      {filteredLooks.map((lk) => {
                        const active =
                          lookIdx === lk.index && bottomLookIdx === null;
                        const isOwned = boughtLookIndices.has(lk.index);
                        const isInCart = inCartLookIndices.has(lk.index);
                        return (
                          <div
                            key={lk.index}
                            onPointerEnter={() => preloadLookByIndex(lk.index)}
                            onClick={() => void swapToLook(lk.index)}
                            onPointerDown={(e) =>
                              startDrag(e, {
                                kind: "look",
                                label: lk.name,
                                price: 140,
                                lookIndex: lk.index,
                              })
                            }
                            className={`group relative h-32 rounded-2xl overflow-hidden border cursor-grab transition ${
                              active
                                ? "border-[#141518] ring-2 ring-[#141518]/20 bg-[#EAECEF]"
                                : "border-black/[0.08] bg-[#F4F5F7] hover:-translate-y-0.5"
                            }`}
                          >
                            <div className="absolute inset-x-0 top-0 flex justify-center pointer-events-none transition-transform duration-300 group-hover:scale-105">
                              <div className="relative w-[88px] aspect-[1360/2048]">
                                <img
                                  src={H(lk.file, 260, 78)}
                                  alt={lk.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="w-full h-full object-contain"
                                />
                                {customAvatar && (
                                  <img
                                    src={customAvatar.faceOvalDataUrl}
                                    alt=""
                                    decoding="async"
                                    style={{
                                      left: "49.95%",
                                      top: "13.2%",
                                      width: "12.9%",
                                      height: "9.7%",
                                    }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 object-fill"
                                  />
                                )}
                              </div>
                            </div>
                            <div className="absolute inset-x-1 bottom-1 px-1.5 py-0.5 rounded-lg bg-white/92 text-[10px] font-bold text-[#141518] truncate text-center">
                              {lk.name}
                            </div>
                            {(isOwned || isInCart) && (
                              <span
                                className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-white text-[8px] font-bold uppercase tracking-wider ${
                                  isOwned ? "bg-[#244B3B]" : "bg-[#141518]"
                                }`}
                              >
                                {isOwned ? "Bought" : "Cart"}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

            {/* Saved Store Links */}
            {scrapedSavedItems.length > 0 && category === "all" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                    Added Store Pieces ({scrapedSavedItems.length})
                  </p>
                  <span className="text-[10px] text-[#244B3B] font-semibold">
                    Tap to wear
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {scrapedSavedItems.slice(0, 4).map((prod) => {
                    const isWornUrl = activeImportedProduct?.id === prod.id;
                    return (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          if (prod.studioLookIndex !== undefined && !isWornUrl) {
                            void swapToLook(prod.studioLookIndex);
                          }
                          setActiveImportedProduct(isWornUrl ? null : prod);
                          triggerScanLine();
                        }}
                        className={`group rounded-2xl overflow-hidden border text-left cursor-pointer transition bg-white ${
                          isWornUrl
                            ? "border-[#141518] ring-2 ring-[#141518]/20"
                            : "border-black/[0.08] hover:-translate-y-0.5"
                        }`}
                      >
                        <div className="h-20 w-full bg-[#F6F7F9] border-b border-black/[0.05] overflow-hidden">
                          <GarmentArtwork
                            product={prod}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="p-2 space-y-0.5">
                          <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                            <span className="text-[#244B3B] truncate">
                              {prod.brand}
                            </span>
                            <span className="text-[#141518] shrink-0">
                              ${prod.price}
                            </span>
                          </div>
                          <p className="text-[11px] font-bold text-[#141518] truncate">
                            {prod.title}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ==================== CURRENTLY WORN PIECES ==================== */}
          <div className="shrink-0 pt-2.5 border-t border-black/[0.08] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#686D76]">
                In This Outfit ({currentPieces.length})
              </span>
              <span className="text-[11px] font-semibold text-[#244B3B]">
                {activeBust}&quot; • {activeWaist}&quot; • {activeHips}&quot; (Size {recSize})
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {currentPieces.map((piece, idx) => {
                const alreadyInBag = bagItems.some(
                  (b) => b.title === piece.name
                );
                return (
                  <div
                    key={`${piece.name}-${idx}`}
                    className="p-2.5 rounded-xl bg-[#F7F8FA] border border-black/[0.05] flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#141518] truncate">
                        {piece.name}
                      </p>
                      <p className="text-[11px] text-[#686D76]">
                        {piece.color} • <strong>${piece.price}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const matchedCatalog = currentLook.productId
                            ? products.find((p) => p.id === currentLook.productId)
                            : null;
                          const targetProd =
                            matchedCatalog ||
                            buildSynthetic3DProductFromPiece({
                              id: `closet-piece-${lookIdx}-${piece.name}`,
                              name: piece.name,
                              colorName: piece.color,
                              price: piece.price,
                              brand: "GWO Closet",
                            });
                          openAvatar360({
                            title: `${piece.name} (${piece.color})`,
                            primaryProduct: targetProd,
                            avatarFrontUrl: H(currentLook.file, 900),
                            avatarBackUrl: H_BACK(currentLook.file),
                            initialAngleMode: "split",
                          });
                        }}
                        title="See Front & Back 360° Avatar Look"
                        className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-black/[0.09] text-[#141518] hover:bg-[#EFF1F5] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Rotate3d className="w-3 h-3 text-[#244B3B]" /> 360°
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          addToBag({
                            title: piece.name,
                            brand: "GWO Boutique",
                            price: piece.price,
                            size: recSize,
                            avatarFrontUrl: H(currentLook.file, 900),
                            avatarBackUrl: H_BACK(currentLook.file),
                            productId: currentLook.productId,
                          })
                        }
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1 ${
                          alreadyInBag
                            ? "bg-[#244B3B] text-white"
                            : "bg-[#141518] text-white hover:bg-[#27292E]"
                        }`}
                      >
                        {alreadyInBag ? (
                          <>
                            <Check className="w-3 h-3" /> In Bag
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" /> Bag
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ==================== UPLOAD CLOSET PHOTO MODAL ==================== */}
      {uploadModalOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setUploadModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#141518]">
                Add Clothing Photo to My Closet
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
              <div className="h-48 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] overflow-hidden flex items-center justify-center">
                <img
                  src={pendingUploadDataUrl}
                  alt="Preview"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#141518]">
                Item or Outfit Name
                <input
                  type="text"
                  value={pendingUploadTitle}
                  onChange={(e) => setPendingUploadTitle(e.target.value)}
                  placeholder="e.g., Vintage Silk Slip or Favorite Jeans"
                  className="mt-1 w-full px-3.5 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs text-[#141518]"
                />
              </label>

              <div>
                <p className="text-xs font-bold text-[#141518] mb-1">
                  Clothing Type
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["full", "Full Outfit / Dress"],
                      ["top", "Top / Jacket"],
                      ["pants", "Pants / Skirt"],
                    ] as const
                  ).map(([slotId, slotLabel]) => (
                    <button
                      key={slotId}
                      type="button"
                      onClick={() => setPendingUploadSlot(slotId)}
                      className={`py-2 px-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                        pendingUploadSlot === slotId
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-[#F7F8FA] text-[#141518] border-black/10"
                      }`}
                    >
                      {slotLabel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirmUploadPiece}
              className="w-full py-3 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold cursor-pointer"
            >
              Save &amp; Try On Avatar
            </button>
          </div>
        </div>
      )}

      {/* ==================== ZERO-LAG FLOATING DRAG PILL ==================== */}
      {dragItem && (
        <div
          ref={dragPillRef}
          style={{
            position: "fixed",
            left: 0,
            top: 0,
            zIndex: 9999,
            pointerEvents: "none",
            willChange: "transform",
          }}
          className="px-3.5 py-2 rounded-2xl bg-[#141518] text-white shadow-2xl flex items-center gap-2 text-xs font-semibold"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
          <span>
            {overAvatar
              ? `Drop to wear ${dragItem.label}`
              : `${dragItem.label}${dragItem.price ? ` ($${dragItem.price})` : ""}`}
          </span>
        </div>
      )}
    </div>
  );
}

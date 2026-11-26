"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Images,
  Instagram,
  Layers,
  Plus,
  RefreshCw,
  Rotate3d,
  ScanLine,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Wand2,
  X,
} from "lucide-react";
import "./runway-lookbook.css";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { deriveStandardApparelSize } from "@/lib/catalog/sizing";
import {
  AiRunwayOutfit,
  BAG_RGBA_OVERLAY_BY_ID,
  buildAiRunwayOutfits,
  buildSinglePieceRunwayLineup,
} from "@/lib/stylist/runway-ai-outfits";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { ARCHETYPE_META } from "@/lib/social/social-style-dna";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CUSTOM_RUNWAY_KEY = "gwo_custom_runway_outfits_v2";

interface CustomRunwayOutfitSaved {
  id: string;
  title: string;
  productIds: string[];
  frontAvatarUrl: string;
  backAvatarUrl: string;
  bottomFrontAvatarUrl?: string;
  bottomBackAvatarUrl?: string;
  bagOverlayUrl?: string;
  bagOverlayPos?: "hand" | "shoulder";
}

// Larger foreground scale (`KH[1] = 0.99`, `KF[1] = 0.99`) so Runway Avatar fills stage height cleanly!
const KX = [1.22, 0.68, 0.44, 0.29, 0.19, 0.12, 0.06];
const KF = [1.06, 0.99, 0.87, 0.78, 0.72, 0.67, 0.62];
const KH = [1.14, 0.99, 0.72, 0.54, 0.41, 0.31, 0.23];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

const UPPER_LOOK_HELD_BAG: Record<number, string> = {
  0: "prod-ae-burgundy-crescent-bag",
  1: "prod-ae-camel-turnlock-tote",
  2: "prod-ae-burgundy-crescent-bag",
  3: "prod-ae-ivory-mini-bag",
  4: "prod-ae-camel-turnlock-tote",
  5: "prod-ae-camel-turnlock-tote",
  6: "prod-ae-noir-quilted-bag",
  7: "prod-ae-burgundy-crescent-bag",
  8: "prod-ae-ivory-mini-bag",
  9: "prod-ae-noir-quilted-bag",
};

export function GwoRunwayLookbook() {
  const {
    user,
    products,
    purchasedItems,
    addToBag,
    customAvatar,
    setAvatarModalOpen,
    setAddUrlModalOpen,
    socialDna,
    setSocialModalOpen,
    openAvatar360,
    openDropshipCheckout,
    showToast,
  } = useGwo();

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );
  const activeHeightStr = formatHeightFeetInches(bodyDims.heightInches);
  const recSize = useMemo(
    () =>
      deriveStandardApparelSize({
        bustInches: bodyDims.bustInches,
        waistInches: bodyDims.waistInches,
        hipsInches: bodyDims.hipsInches,
      }),
    [bodyDims.bustInches, bodyDims.hipsInches, bodyDims.waistInches]
  );

  const [stageRenderMode, setStageRenderMode] = useState<"3d" | "lookbook">(
    "3d"
  );
  const [browseMode, setBrowseMode] = useState<"outfits" | "pieces">("outfits");
  const [vibeInput, setVibeInput] = useState("");
  const [appliedVibe, setAppliedVibe] = useState("");
  const [extraAiCount, setExtraAiCount] = useState(4);
  const [runwayAngle, setRunwayAngle] = useState<"front" | "back">("front");
  const [activeLookIdx, setActiveLookIdx] = useState(0);

  // Per-outfit piece swap overrides so shoppers can customize any AI outfit live like a dressing game!
  const [swappedPieceBySlot, setSwappedPieceBySlot] = useState<
    Record<string, Product>
  >({});

  // Which piece card in the right rail is currently showing live draggable 3D Product Object mode
  const [active3DCardId, setActive3DCardId] = useState<string | null>(null);

  // Custom Outfit Builder Modal state
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([
    "prod-ae-espresso-corset",
    "prod-ae-champagne-trousers",
    "prod-ae-gold-strappy-heels",
    "prod-ae-burgundy-crescent-bag",
  ]);
  const [savedCustomOutfits, setSavedCustomOutfits] = useState<
    CustomRunwayOutfitSaved[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_RUNWAY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedCustomOutfits(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistCustomRunway = useCallback(
    (next: CustomRunwayOutfitSaved[]) => {
      setSavedCustomOutfits(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(CUSTOM_RUNWAY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    },
    []
  );

  const boutiqueCatalog = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of buildTopLineAliExpressDropshipCatalog()) {
      map.set(p.id, p);
    }
    for (const p of products) {
      if (
        p.sourceType === "aliexpress_dropship" ||
        p.sourceType === "scraped_url"
      ) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [products]);

  const ownedIds = useMemo(() => {
    const set = new Set<string>([
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-noir-pleated-mini",
      "prod-ae-crimson-corset-mini",
    ]);
    for (const p of purchasedItems) {
      if (p.productId) set.add(p.productId);
    }
    return set;
  }, [purchasedItems]);

  const avatarStats = useMemo(
    () => ({
      heightInches: bodyDims.heightInches,
      bustInches: bodyDims.bustInches,
      waistInches: bodyDims.waistInches,
      hipsInches: bodyDims.hipsInches,
      shoeSize: bodyDims.shoeSize,
    }),
    [bodyDims]
  );

  // Full Pure-AliExpress Outfits & Single Pieces Lineup
  const runwayOutfits: AiRunwayOutfit[] = useMemo(() => {
    if (browseMode === "pieces") {
      return buildSinglePieceRunwayLineup({
        catalog: boutiqueCatalog,
        avatar: avatarStats,
        socialDna,
      });
    }

    const baseAi = buildAiRunwayOutfits({
      catalog: boutiqueCatalog,
      avatar: avatarStats,
      socialDna,
      vibePrompt: appliedVibe,
      extraGeneratedCount: extraAiCount,
    });

    const byId = new Map<string, Product>(
      boutiqueCatalog.map((p) => [p.id, p])
    );
    const customHydrated: AiRunwayOutfit[] = savedCustomOutfits
      .map((co, idx): AiRunwayOutfit | null => {
        const resolved = co.productIds
          .map((id) => byId.get(id))
          .filter((p): p is Product => Boolean(p));
        if (resolved.length === 0) return null;
        const pieces = resolved.map((prod) => {
          const fit = analyzeExactAvatarFit(avatarStats, prod);
          return {
            product: prod,
            recommendedSize: fit.recommendedSize,
            confidencePct: fit.confidencePct,
            fitVerdict: fit.headlineVerdict,
          };
        });
        return {
          id: co.id,
          outfitNumber: idx + 1,
          mode: "outfit" as const,
          title: co.title,
          occasion: "Custom Outfit",
          archetype: socialDna.primaryArchetype,
          archetypeLabel: "Custom Built",
          aiReason: `Custom ${pieces.length}-piece outfit styled onto your ${activeHeightStr} 3D Runway body.`,
          fitHeadline: `Exact ${activeHeightStr} Fit`,
          matchScorePct: 98,
          frontAvatarUrl: co.frontAvatarUrl,
          backAvatarUrl: co.backAvatarUrl,
          bottomFrontAvatarUrl: co.bottomFrontAvatarUrl,
          bottomBackAvatarUrl: co.bottomBackAvatarUrl,
          bagOverlayUrl: co.bagOverlayUrl,
          bagOverlayPos: co.bagOverlayPos,
          pieces,
          totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
        } satisfies AiRunwayOutfit;
      })
      .filter((x): x is AiRunwayOutfit => x !== null);

    const combined = [...customHydrated, ...baseAi];
    return combined.map((o, idx) => ({ ...o, outfitNumber: idx + 1 }));
  }, [
    activeHeightStr,
    appliedVibe,
    avatarStats,
    boutiqueCatalog,
    browseMode,
    extraAiCount,
    savedCustomOutfits,
    socialDna,
  ]);

  // Endless AI Auto-Styling expansion near tail
  const autoExpandCooldownRef = useRef(false);
  useEffect(() => {
    if (browseMode !== "outfits") return;
    if (
      activeLookIdx >= runwayOutfits.length - 2 &&
      extraAiCount < 24 &&
      !autoExpandCooldownRef.current
    ) {
      autoExpandCooldownRef.current = true;
      setExtraAiCount((prev) => Math.min(24, prev + 4));
      setTimeout(() => {
        autoExpandCooldownRef.current = false;
      }, 600);
    }
  }, [activeLookIdx, browseMode, extraAiCount, runwayOutfits.length]);

  const safeActiveIdx =
    runwayOutfits.length > 0
      ? ((activeLookIdx % runwayOutfits.length) + runwayOutfits.length) %
        runwayOutfits.length
      : 0;
  const rawActiveOutfit = runwayOutfits[safeActiveIdx] || runwayOutfits[0];

  // Apply any live dressing-game swaps onto the active Runway outfit!
  const activeOutfit = useMemo(() => {
    if (!rawActiveOutfit) return rawActiveOutfit;
    const pieces = rawActiveOutfit.pieces.map((p, slotIdx) => {
      const swapKey = `${rawActiveOutfit.id}:${slotIdx}`;
      const override = swappedPieceBySlot[swapKey];
      if (!override) return p;
      const fit = analyzeExactAvatarFit(avatarStats, override);
      return {
        product: override,
        recommendedSize: fit.recommendedSize,
        confidencePct: fit.confidencePct,
        fitVerdict: fit.headlineVerdict,
      };
    });
    return {
      ...rawActiveOutfit,
      pieces,
      totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
    };
  }, [avatarStats, rawActiveOutfit, swappedPieceBySlot]);

  // Default hero piece card to live 3D Object view on desktop (`> 820px`) when switching outfits
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth > 820 && activeOutfit?.pieces[0]) {
      setActive3DCardId(activeOutfit.pieces[0].product.id);
    } else {
      setActive3DCardId(null);
    }
  }, [activeOutfit?.id, activeOutfit?.pieces]);

  // Diagonal Lookbook Stage Engine (active when user toggles `Lookbook Lineup`)
  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const jumpLookRef = useRef<((lookIndex: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const selectOutfitIndex = useCallback(
    (idx: number) => {
      if (runwayOutfits.length === 0) return;
      const wrapped =
        ((idx % runwayOutfits.length) + runwayOutfits.length) %
        runwayOutfits.length;
      setActiveLookIdx(wrapped);
      currentPosRef.current = wrapped;
      jumpLookRef.current?.(wrapped);
    },
    [runwayOutfits.length]
  );

  useEffect(() => {
    if (stageRenderMode !== "lookbook") return;
    const stage = stageRef.current;
    const line = lineRef.current;
    if (!stage || !line) return;

    line.innerHTML = "";
    const N = runwayOutfits.length;
    if (N === 0) return;

    const people = runwayOutfits.map((outfit, i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);

      const hasMixedBottom = Boolean(outfit.bottomFrontAvatarUrl);
      if (hasMixedBottom) {
        const botImg = document.createElement("img");
        botImg.className = "mv-avatar-bot";
        botImg.src =
          runwayAngle === "back"
            ? outfit.bottomBackAvatarUrl || outfit.backAvatarUrl
            : outfit.bottomFrontAvatarUrl || outfit.frontAvatarUrl;
        botImg.alt = "";
        botImg.decoding = "async";
        e.append(botImg);
      }

      const img = document.createElement("img");
      img.className = hasMixedBottom ? "mv-avatar-top" : "mv-avatar-img";
      img.src =
        runwayAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl;
      img.alt = outfit.title;
      img.decoding = "async";
      e.append(img);

      // Render held RGBA Bag Overlay whenever AI/Custom look carries an extra bag!
      if (outfit.bagOverlayUrl) {
        const bagImg = document.createElement("img");
        bagImg.className = "mv-bag-overlay";
        bagImg.src = outfit.bagOverlayUrl;
        bagImg.alt = "Held boutique bag";
        const isShoulder = outfit.bagOverlayPos === "shoulder";
        bagImg.style.left = isShoulder ? "55%" : "58%";
        bagImg.style.top = isShoulder ? "28%" : "44%";
        bagImg.style.width = "22%";
        e.append(bagImg);
      }

      if (customAvatar?.faceOvalDataUrl && runwayAngle === "front") {
        const faceImg = document.createElement("img");
        faceImg.className = "mv-face-oval";
        faceImg.src = customAvatar.faceOvalDataUrl;
        faceImg.alt = "";
        e.append(faceImg);
      }

      line.append(e);
      return { e, r: 900 / 1355, f: "", o: "", cx: 0, sc: 1, vis: true };
    });

    let W = 0;
    let H = 0;
    let base = 0;
    let dirty = true;
    let p = clamp(activeLookIdx, 0, Math.max(0, N - 1));
    let target = p;
    let last = 0;
    let lastReported = Math.round(wrap(p, N)) % N;

    jumpLookRef.current = (lookIndex: number) => {
      const currMod = wrap(Math.round(target), N);
      let delta = lookIndex - currMod;
      if (delta < 0) delta += N;
      target = Math.round(target) + delta;
    };

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 0.98;
      people.forEach((m) => {
        m.e.style.width = `${base * m.r}px`;
        m.e.style.height = `${base}px`;
      });
      dirty = true;
    };

    const paint = () => {
      currentPosRef.current = p;
      const roundedIdx = Math.round(wrap(p, N)) % N;
      if (roundedIdx !== lastReported) {
        lastReported = roundedIdx;
        setActiveLookIdx(roundedIdx);
      }

      people.forEach((m, i) => {
        let d = wrap(i - p, N);
        if (d > N - 1) d -= N;
        const k = clamp(d + 1, 0, 6);
        const a = Math.floor(k);
        const t = k - a;
        const L = (v: number[]) => v[a] + (v[Math.min(a + 1, 6)] - v[a]) * t;

        const sc = L(KH);
        const centerX = W * L(KX);
        const x = centerX - base * m.r * sc * 0.5;
        const y = H * L(KF) - base * sc;
        const bl = L(KB);
        const op = d < -0.5 ? Math.max(0, 1 + (d + 0.5) * 2.2) : L(KO);
        const f = bl > 0.25 ? `blur(${bl.toFixed(1)}px)` : "none";
        const o = op.toFixed(3);

        m.cx = centerX;
        m.sc = sc;
        m.vis = op > 0.12;
        m.e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(
          1
        )}px,0) scale(${sc.toFixed(4)})`;
        m.e.style.zIndex = String(Math.round((6 - k) * 10));
        if (m.f !== f) {
          m.f = f;
          m.e.style.filter = f;
        }
        if (m.o !== o) {
          m.o = o;
          m.e.style.opacity = o;
        }
      });
      dirty = false;
    };

    let drag = false;
    let sx = 0;
    let s0 = 0;
    let moved = false;

    const onDown = (e: PointerEvent) => {
      drag = true;
      moved = false;
      sx = e.clientX;
      s0 = target;
      stage.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 6) moved = true;
      target = s0 + dx / Math.max(200, W * 0.34);
    };
    const onUp = () => {
      if (!drag) return;
      drag = false;
      target = moved ? Math.round(target) : Math.round(target) + 1;
    };

    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", size);

    let rafId = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (last || now));
      last = now;
      const diff = target - p;
      if (Math.abs(diff) > 0.0004) {
        p += diff * (1 - Math.pow(0.0012, dt / 1000));
        dirty = true;
      } else if (p !== target) {
        p = target;
        dirty = true;
      }
      if (dirty) paint();
      rafId = requestAnimationFrame(frame);
    };

    size();
    paint();
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", size);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customAvatar, runwayAngle, runwayOutfits, stageRenderMode]);

  // Swap an individual piece right inside the active Runway outfit (Dressing Game on Runway!)
  const handleSwapPieceInOutfit = useCallback(
    (slotIdx: number, currentProduct: Product) => {
      if (!rawActiveOutfit) return;
      const sameCategoryPool = boutiqueCatalog.filter((p) => {
        if (currentProduct.category === "accessory") {
          const curIsBelt = /belt/i.test(currentProduct.title);
          return (
            p.category === "accessory" &&
            (/belt/i.test(p.title) === curIsBelt) &&
            p.id !== currentProduct.id
          );
        }
        return (
          p.category === currentProduct.category && p.id !== currentProduct.id
        );
      });
      if (sameCategoryPool.length === 0) return;
      const curPoolIdx = sameCategoryPool.findIndex(
        (x) => x.id === currentProduct.id
      );
      const nextProd =
        sameCategoryPool[(curPoolIdx + 1) % sameCategoryPool.length];
      const swapKey = `${rawActiveOutfit.id}:${slotIdx}`;
      setSwappedPieceBySlot((prev) => ({ ...prev, [swapKey]: nextProd }));
      showToast(`Swapped in "${nextProd.title}" on your 3D Runway Avatar!`);
    },
    [boutiqueCatalog, rawActiveOutfit, showToast]
  );

  const handleAddOrBuyCurrentEntry = useCallback(
    (onlyMissingFromCloset: boolean, openCheckoutImmediately: boolean) => {
      if (!activeOutfit) return;
      const targetPieces = onlyMissingFromCloset
        ? activeOutfit.pieces.filter((p) => !ownedIds.has(p.product.id))
        : activeOutfit.pieces;
      const list =
        targetPieces.length > 0 ? targetPieces : activeOutfit.pieces;
      list.forEach((p) => {
        addToBag({
          productId: p.product.id,
          title: p.product.title,
          brand: p.product.brand || "GWO Boutique",
          price: p.product.price,
          size: p.recommendedSize || recSize,
          imageUrl: p.product.imageUrl,
          avatarFrontUrl: activeOutfit.frontAvatarUrl,
          avatarBackUrl: activeOutfit.backAvatarUrl,
          storeUrl: p.product.canonicalUrl,
        });
      });
      if (openCheckoutImmediately) {
        openDropshipCheckout("checkout");
      } else {
        showToast(
          `Added ${list.length} ${list.length === 1 ? "piece" : "pieces"} to Bag!`
        );
      }
    },
    [activeOutfit, addToBag, openDropshipCheckout, ownedIds, recSize, showToast]
  );

  const handleApplyAiPrompt = (e?: React.FormEvent) => {
    e?.preventDefault();
    setBrowseMode("outfits");
    if (!vibeInput.trim()) {
      const targetIdx = runwayOutfits.length;
      setExtraAiCount((prev) => prev + 2);
      showToast("AI Stylist created fresh outfits on your 3D Runway Avatar!");
      setTimeout(() => selectOutfitIndex(targetIdx), 60);
      return;
    }
    setAppliedVibe(vibeInput.trim());
    selectOutfitIndex(0);
    showToast(`AI Runway styled outfits around "${vibeInput.trim()}"!`);
  };

  const handleCreateCustomRunwayOutfit = () => {
    if (selectedCustomIds.length === 0) return;

    let topAvatarIdx = 0;
    if (selectedCustomIds.includes("prod-ae-ivory-tweed-blazer"))
      topAvatarIdx = 1;
    else if (selectedCustomIds.includes("prod-ae-emerald-satin-midi"))
      topAvatarIdx = 2;
    else if (selectedCustomIds.includes("prod-ae-champagne-blazer-dress"))
      topAvatarIdx = 3;
    else if (selectedCustomIds.includes("prod-ae-camel-silk-wool-coat"))
      topAvatarIdx = 4;
    else if (selectedCustomIds.includes("prod-ae-linen-cinch-cardigan"))
      topAvatarIdx = 5;
    else if (selectedCustomIds.includes("prod-ae-crimson-corset-mini"))
      topAvatarIdx = 6;
    else if (selectedCustomIds.includes("prod-ae-noir-tailored-blazer"))
      topAvatarIdx = 7;
    else if (selectedCustomIds.includes("prod-ae-sage-zip-jacket"))
      topAvatarIdx = 8;

    let botAvatarIdx = topAvatarIdx;
    const isFullDress =
      selectedCustomIds.includes("prod-ae-emerald-satin-midi") ||
      selectedCustomIds.includes("prod-ae-champagne-blazer-dress") ||
      selectedCustomIds.includes("prod-ae-crimson-corset-mini");
    if (!isFullDress) {
      if (selectedCustomIds.includes("prod-ae-champagne-trousers"))
        botAvatarIdx = 0;
      else if (selectedCustomIds.includes("prod-ae-noir-pleated-mini"))
        botAvatarIdx = 1;
      else if (selectedCustomIds.includes("prod-ae-vintage-wide-denim"))
        botAvatarIdx = 7;
      else if (selectedCustomIds.includes("prod-ae-sage-flare-leggings"))
        botAvatarIdx = 8;
    }

    const selectedBagId = selectedCustomIds.find((id) => id in BAG_RGBA_OVERLAY_BY_ID);
    const bagOverlay =
      selectedBagId && UPPER_LOOK_HELD_BAG[topAvatarIdx] !== selectedBagId
        ? BAG_RGBA_OVERLAY_BY_ID[selectedBagId]
        : undefined;

    const title =
      customTitle.trim() ||
      `Custom Boutique Edit #0${savedCustomOutfits.length + 1}`;
    const created: CustomRunwayOutfitSaved = {
      id: `custom-runway-${Date.now()}`,
      title,
      productIds: selectedCustomIds,
      frontAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_${topAvatarIdx}_front.webp?v=ae2`,
      backAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_${topAvatarIdx}_back.webp?v=ae2`,
      bottomFrontAvatarUrl:
        botAvatarIdx !== topAvatarIdx
          ? `${BASE_PATH}/models/runway_ai/ae_outfit_${botAvatarIdx}_front.webp?v=ae2`
          : undefined,
      bottomBackAvatarUrl:
        botAvatarIdx !== topAvatarIdx
          ? `${BASE_PATH}/models/runway_ai/ae_outfit_${botAvatarIdx}_back.webp?v=ae2`
          : undefined,
      bagOverlayUrl: bagOverlay?.url,
      bagOverlayPos: bagOverlay?.pos,
    };
    persistCustomRunway([created, ...savedCustomOutfits]);
    setBrowseMode("outfits");
    setBuildModalOpen(false);
    setCustomTitle("");
    selectOutfitIndex(0);
    showToast(`Added "${title}" onto your 3D Runway!`);
  };

  const heroPiece = activeOutfit?.pieces[0]?.product;
  const worn3DPieces = useMemo(
    () =>
      (activeOutfit?.pieces || []).map((p) => ({
        product: p.product,
        selectedSize: p.recommendedSize,
        isOwnedInCloset: ownedIds.has(p.product.id),
      })),
    [activeOutfit?.pieces, ownedIds]
  );

  return (
    <div className="mv-page">
      <main className="mv-main">
        <div className="mv-left-col">
          {/* ==================== COMPACT 2-ROW TOP BAR ==================== */}
          <div className="mv-top-bar space-y-1.5">
            <div className="mv-pill-scroll justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <h1 className="text-sm sm:text-lg font-bold tracking-tight text-[#141518] whitespace-nowrap">
                  3D Runway
                </h1>

                {/* 3D Interactive Stage vs Diagonal Lookbook Lineup */}
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#F1F2F5] border border-black/[0.07]">
                  <button
                    type="button"
                    id="gwo-runway-view-3d"
                    onClick={() => setStageRenderMode("3d")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[26px] ${
                      stageRenderMode === "3d"
                        ? "bg-[#141518] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    <Rotate3d className="w-3 h-3 text-[#A7D7C5]" /> 360° Lifelike
                  </button>
                  <button
                    type="button"
                    id="gwo-runway-view-lookbook"
                    onClick={() => setStageRenderMode("lookbook")}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[26px] ${
                      stageRenderMode === "lookbook"
                        ? "bg-[#141518] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    <Images className="w-3 h-3" /> Runway Lineup
                  </button>
                </div>

                {/* Full Outfits vs Single Pieces */}
                <div className="inline-flex items-center p-0.5 rounded-full bg-[#F1F2F5] border border-black/[0.07]">
                  <button
                    type="button"
                    id="gwo-runway-mode-outfits"
                    onClick={() => {
                      setBrowseMode("outfits");
                      selectOutfitIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[26px] ${
                      browseMode === "outfits"
                        ? "bg-[#244B3B] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    <Layers className="w-3 h-3" /> Outfits
                  </button>
                  <button
                    type="button"
                    id="gwo-runway-mode-pieces"
                    onClick={() => {
                      setBrowseMode("pieces");
                      selectOutfitIndex(0);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[26px] ${
                      browseMode === "pieces"
                        ? "bg-[#244B3B] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    <Shirt className="w-3 h-3" /> Pieces
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {stageRenderMode === "lookbook" && (
                  <div className="inline-flex items-center p-0.5 rounded-full bg-white border border-black/[0.08]">
                    {(
                      [
                        ["front", "Front 0°"],
                        ["back", "Back 180°"],
                      ] as const
                    ).map(([ang, lbl]) => (
                      <button
                        key={ang}
                        type="button"
                        onClick={() => setRunwayAngle(ang)}
                        className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold cursor-pointer min-h-[26px] ${
                          runwayAngle === ang
                            ? "bg-[#141518] text-white"
                            : "text-[#686D76]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#E7F3EE] hover:bg-[#D5EAE0] border border-[#C5DFD0] text-[11px] font-bold text-[#1D4232] cursor-pointer min-h-[28px]"
                >
                  <ScanLine className="w-3 h-3" />
                  <span>
                    Body Scan ({activeHeightStr} • {recSize})
                  </span>
                </button>

                <button
                  type="button"
                  id="gwo-runway-social-dna-btn"
                  onClick={() => setSocialModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FDEEF4] hover:bg-[#FADCE8] border border-[#F5C5D8] text-[11px] font-bold text-[#9D174D] cursor-pointer min-h-[28px]"
                >
                  <Instagram className="w-3 h-3" />
                  <span>
                    {ARCHETYPE_META[socialDna.primaryArchetype].shortTag}
                  </span>
                </button>

                <button
                  type="button"
                  id="gwo-runway-add-ai-outfit-btn"
                  onClick={() => {
                    setBrowseMode("outfits");
                    const jumpIdx = runwayOutfits.length;
                    setExtraAiCount((prev) => prev + 1);
                    showToast("AI built a new outfit on your 3D Runway!");
                    setTimeout(() => selectOutfitIndex(jumpIdx), 60);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-[11px] font-bold cursor-pointer min-h-[28px]"
                >
                  <Sparkles className="w-3 h-3" /> + AI Outfit
                </button>

                <button
                  type="button"
                  id="gwo-runway-build-outfit-btn"
                  onClick={() => setBuildModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold cursor-pointer min-h-[28px]"
                >
                  <Plus className="w-3 h-3" /> Build Outfit
                </button>
              </div>
            </div>

            {/* Row 2: Single-Line Horizontal Scroll Outfit Strip + AI Prompt */}
            <div className="flex items-center justify-between gap-2">
              <div className="mv-pill-scroll flex-1 min-w-0">
                {runwayOutfits.slice(0, 12).map((outfit, idx) => {
                  const active = safeActiveIdx === idx;
                  const numStr = idx + 1 < 10 ? `0${idx + 1}` : String(idx + 1);
                  return (
                    <button
                      key={outfit.id}
                      type="button"
                      onClick={() => selectOutfitIndex(idx)}
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer min-h-[26px] ${
                        active
                          ? "bg-[#141518] text-white shadow-xs"
                          : "bg-white hover:bg-[#F4F5F7] text-[#686D76] hover:text-[#141518] border border-black/[0.07]"
                      }`}
                    >
                      {numStr} • {outfit.occasion}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleApplyAiPrompt}
                className="hidden xl:flex items-center gap-1.5 shrink-0"
              >
                <input
                  type="text"
                  value={vibeInput}
                  onChange={(e) => setVibeInput(e.target.value)}
                  placeholder="Ask AI for an occasion (e.g., rooftop dinner)..."
                  className="w-56 px-3 py-1 rounded-full bg-white border border-black/10 text-[11px] text-[#141518] focus:outline-none focus:border-[#141518]"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer min-h-[26px]"
                >
                  <Wand2 className="w-3 h-3" /> Style
                </button>
              </form>
            </div>
          </div>

          {/* ==================== COMMANDING 3D OR LOOKBOOK RUNWAY STAGE ==================== */}
          <section
            className="mv-stage"
            ref={stageRef}
            aria-label="Interactive 3D Runway Avatar Stage"
          >
            {stageRenderMode === "3d" ? (
              <div className="relative w-full h-full">
                <Interactive3DAvatarStage
                  mode="avatar"
                  dimensions={bodyDims}
                  wornPieces={worn3DPieces}
                  faceOvalDataUrl={customAvatar?.faceOvalDataUrl}
                  externalYawDeg={runwayAngle === "back" ? 180 : undefined}
                  initialYawDeg={16}
                  onSelectProduct={(prod) => setActive3DCardId(prod.id)}
                  showHud={true}
                />

                {/* Flanking Prev / Next Runway Outfit Stepper Buttons */}
                <button
                  type="button"
                  onClick={() => selectOutfitIndex(safeActiveIdx - 1)}
                  aria-label="Previous Runway Outfit"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/92 hover:bg-white border border-black/[0.09] shadow-md flex items-center justify-center text-[#141518] cursor-pointer transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => selectOutfitIndex(safeActiveIdx + 1)}
                  aria-label="Next Runway Outfit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/92 hover:bg-white border border-black/[0.09] shadow-md flex items-center justify-center text-[#141518] cursor-pointer transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="mv-line" ref={lineRef} />
            )}
          </section>

          {/* ==================== BOTTOM FULL-OUTFIT CHECKOUT DOCK ==================== */}
          <div className="mv-bottom-bar">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="px-2.5 py-1 rounded-xl bg-[#141518] text-white text-sm font-extrabold shrink-0">
                {browseMode === "pieces" ? "Piece" : "Outfit"}{" "}
                {safeActiveIdx + 1 < 10
                  ? `0${safeActiveIdx + 1}`
                  : safeActiveIdx + 1}
              </span>
              {activeOutfit && (
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#141518] truncate max-w-[230px] sm:max-w-[380px]">
                    {activeOutfit.title}
                  </p>
                  <p className="text-[10.5px] font-semibold text-[#244B3B] truncate max-w-[230px] sm:max-w-[400px]">
                    {activeOutfit.pieces.length} Pieces Included •{" "}
                    {activeOutfit.aiReason}
                  </p>
                </div>
              )}
            </div>

            <div className="mv-pill-scroll gap-1.5">
              {activeOutfit && (
                <>
                  <button
                    type="button"
                    id="gwo-runway-buy-full-outfit-btn"
                    onClick={() => handleAddOrBuyCurrentEntry(false, true)}
                    className="shrink-0 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer whitespace-nowrap"
                  >
                    {browseMode === "pieces"
                      ? `Buy Piece ($${activeOutfit.totalPriceUsd})`
                      : `Buy Full Outfit ($${activeOutfit.totalPriceUsd})`}
                  </button>

                  <button
                    type="button"
                    id="gwo-runway-bag-full-outfit-btn"
                    onClick={() => handleAddOrBuyCurrentEntry(false, false)}
                    className="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-1 shadow-sm cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> + Bag ($
                    {activeOutfit.totalPriceUsd})
                  </button>

                  {heroPiece && (
                    <Link
                      href={`/?try=${encodeURIComponent(heroPiece.id)}`}
                      id="gwo-runway-try-closet-btn"
                      className="shrink-0 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/[0.08] text-[#244B3B] text-xs font-bold inline-flex items-center gap-1 shadow-xs whitespace-nowrap"
                    >
                      Mix in 3D Closet →
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ==================== RIGHT / BOTTOM FULL-VISIBILITY OUTFIT PIECES GRID ==================== */}
        <aside
          className="mv-rail"
          aria-label="All products in this Runway outfit"
        >
          {activeOutfit && (
            <>
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-black/[0.07] shrink-0">
                <div>
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#141518]">
                    {browseMode === "pieces"
                      ? "Active Runway Piece"
                      : `All ${activeOutfit.pieces.length} Pieces in Outfit #${
                          safeActiveIdx + 1 < 10
                            ? `0${safeActiveIdx + 1}`
                            : safeActiveIdx + 1
                        }`}
                  </h2>
                  <p className="text-[10.5px] font-semibold text-[#244B3B]">
                    Tap 3D on any item to spin the garment object, Swap, or Buy single piece
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#141518] text-white text-[11px] font-bold shrink-0">
                  ${activeOutfit.totalPriceUsd} Set
                </span>
              </div>

              <div className="mv-pieces-grid">
                {activeOutfit.pieces.map((spec, slotIdx) => {
                  const prod = spec.product;
                  const isOwned = ownedIds.has(prod.id);
                  const is3DCard = active3DCardId === prod.id;
                  const pdpHref = `/product?id=${encodeURIComponent(prod.id)}`;
                  const denseGrid = activeOutfit.pieces.length >= 5;

                  return (
                    <article
                      key={`${prod.id}-${slotIdx}`}
                      data-outfit-piece-card="true"
                      className={`rounded-2xl bg-white border border-black/[0.08] ${
                        denseGrid ? "p-2 gap-1" : "p-2.5 gap-2"
                      } flex flex-col justify-between shadow-[0_4px_14px_rgba(20,21,24,0.04)]`}
                    >
                      <div className="space-y-1">
                        {/* Top Fit / Owned Badge + 3D Object Toggle */}
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold uppercase tracking-wide truncate ${
                              isOwned
                                ? "bg-[#E7F3EE] text-[#1D4232]"
                                : "bg-[#C80815] text-white"
                            }`}
                          >
                            {isOwned
                              ? "In Closet ✓"
                              : `Size ${spec.recommendedSize} • ${spec.confidencePct}%`}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              setActive3DCardId(is3DCard ? null : prod.id)
                            }
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold inline-flex items-center gap-0.5 cursor-pointer transition min-h-[22px] shrink-0 ${
                              is3DCard
                                ? "bg-[#141518] text-white"
                                : "bg-[#F1F2F5] text-[#141518] hover:bg-[#E2E5EC]"
                            }`}
                            title="Toggle interactive 3D product object spin"
                          >
                            <Box className="w-2.5 h-2.5" />
                            {is3DCard ? "Photo" : "3D"}
                          </button>
                        </div>

                        {/* Live Draggable 3D Product Object OR Pure Isolated Ghost-Mannequin Photo */}
                        <div
                          className={`relative ${
                            denseGrid ? "h-24 sm:h-[82px]" : "h-28 sm:h-32"
                          } rounded-xl bg-[#F4F6F9] border border-black/[0.05] overflow-hidden flex items-center justify-center`}
                        >
                          {is3DCard ? (
                            <Interactive3DAvatarStage
                              mode="product"
                              dimensions={bodyDims}
                              singleProduct={prod}
                              selectedSize={spec.recommendedSize}
                              autoSpinDefault={true}
                              showHud={false}
                              compactHud={true}
                            />
                          ) : (
                            <GarmentArtwork
                              product={prod}
                              className="w-full h-full"
                            />
                          )}
                        </div>

                        {/* Title & Retail Price */}
                        <div className="min-w-0">
                          <Link
                            href={pdpHref}
                            className="block text-xs font-bold text-[#141518] hover:underline truncate"
                          >
                            {prod.title}
                          </Link>
                          <p className="text-[11px] font-bold text-[#244B3B] truncate">
                            ${prod.price} • {prod.colorName}
                          </p>
                        </div>
                      </div>

                      {/* Unclipped Action Pills */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              addToBag({
                                productId: prod.id,
                                title: prod.title,
                                brand: prod.brand,
                                price: prod.price,
                                size: spec.recommendedSize || recSize,
                                imageUrl: prod.imageUrl,
                                avatarFrontUrl: activeOutfit.frontAvatarUrl,
                                avatarBackUrl: activeOutfit.backAvatarUrl,
                                storeUrl: prod.canonicalUrl,
                              });
                              openDropshipCheckout("checkout");
                            }}
                            className="flex-1 py-1.5 px-2 rounded-full bg-[#FDECEB] hover:bg-[#F9DAD7] text-[#9E2A22] text-[10.5px] font-bold cursor-pointer min-h-[26px]"
                          >
                            Buy (${prod.price})
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              addToBag({
                                productId: prod.id,
                                title: prod.title,
                                brand: prod.brand,
                                price: prod.price,
                                size: spec.recommendedSize || recSize,
                                imageUrl: prod.imageUrl,
                                avatarFrontUrl: activeOutfit.frontAvatarUrl,
                                avatarBackUrl: activeOutfit.backAvatarUrl,
                                storeUrl: prod.canonicalUrl,
                              })
                            }
                            className="py-1.5 px-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[10.5px] font-bold cursor-pointer min-h-[26px]"
                          >
                            + Bag
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {browseMode === "outfits" && (
                            <button
                              type="button"
                              onClick={() =>
                                handleSwapPieceInOutfit(slotIdx, prod)
                              }
                              className="flex-1 py-1 px-2 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EE] text-[#141518] text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer min-h-[24px]"
                              title="Swap this piece on the 3D Runway Avatar"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Swap
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openAvatar360({
                                title: `${prod.brand} — ${prod.title}`,
                                primaryProduct: prod,
                                companionProducts: activeOutfit.pieces
                                  .map((x) => x.product)
                                  .filter((x) => x.id !== prod.id),
                                avatarFrontUrl: activeOutfit.frontAvatarUrl,
                                avatarBackUrl: activeOutfit.backAvatarUrl,
                              })
                            }
                            className="flex-1 py-1 px-2 rounded-full bg-[#E7F3EE] hover:bg-[#D5EAE0] text-[#1D4232] text-[10px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer min-h-[24px]"
                          >
                            <Rotate3d className="w-2.5 h-2.5" /> 3D Fit
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </main>

      {/* ==================== BUILD CUSTOM OUTFIT ON 3D RUNWAY MODAL ==================== */}
      {buildModalOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setBuildModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4 max-h-[88svh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#141518]">
                  Build Custom 3D Outfit for Your Runway
                </h3>
                <p className="text-xs text-[#686D76] mt-0.5">
                  Select boutique clothes, shoes, belts, and handbags below to dress your 3D Runway Twin.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBuildModalOpen(false);
                    setAddUrlModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E6EC] text-xs font-bold text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#244B3B]" /> Paste URL
                </button>
                <button
                  type="button"
                  onClick={() => setBuildModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Outfit Name (e.g., My Friday Cocktail Look)"
              className="w-full px-4 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs text-[#141518] shrink-0"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto pr-1 flex-1 min-h-0">
              {boutiqueCatalog.map((prod) => {
                const selected = selectedCustomIds.includes(prod.id);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() =>
                      setSelectedCustomIds((prev) =>
                        prev.includes(prod.id)
                          ? prev.filter((x) => x !== prod.id)
                          : [...prev, prod.id]
                      )
                    }
                    className={`rounded-2xl p-2 border text-left transition cursor-pointer flex flex-col justify-between ${
                      selected
                        ? "border-[#244B3B] ring-2 ring-[#244B3B]/20 bg-[#F4F8F5]"
                        : "border-black/[0.08] bg-white hover:bg-[#FAFBFD]"
                    }`}
                  >
                    <div>
                      <div className="h-28 rounded-xl bg-[#F7F8FA] overflow-hidden mb-1.5 relative">
                        <GarmentArtwork product={prod} className="w-full h-full" />
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#244B3B] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[#141518] line-clamp-1">
                        {prod.title}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[#244B3B]">
                        ${prod.price} • {prod.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/[0.08] shrink-0">
              <span className="text-xs font-semibold text-[#686D76]">
                {selectedCustomIds.length} pieces selected
              </span>
              <button
                type="button"
                disabled={selectedCustomIds.length === 0}
                onClick={handleCreateCustomRunwayOutfit}
                className="px-5 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Add Outfit to 3D Runway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

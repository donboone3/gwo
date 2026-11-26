"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Rotate3d,
  ShoppingBag,
  Sparkles,
  Store,
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
  buildAiRunwayOutfits,
  buildSinglePieceRunwayLineup,
} from "@/lib/stylist/runway-ai-outfits";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import {
  preloadCoreModularLayers,
  renderModularOutfitDataUrlAsync,
} from "@/lib/three/modular-outfit-compositor";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CUSTOM_RUNWAY_KEY = "gwo_custom_runway_outfits_v3";

interface CustomRunwayOutfitSaved {
  id: string;
  title: string;
  productIds: string[];
  frontAvatarUrl: string;
  backAvatarUrl: string;
}

// Original Diagonal Depth-of-Field Runway Curves with Commanding Foreground Avatar (`KH[1] = 0.99`)
const KX = [1.22, 0.7, 0.45, 0.3, 0.19, 0.12, 0.06];
const KF = [1.06, 0.99, 0.87, 0.78, 0.72, 0.67, 0.62];
const KH = [1.14, 0.99, 0.72, 0.54, 0.41, 0.31, 0.23];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function GwoRunwayLookbook() {
  const {
    user,
    products,
    purchasedItems,
    addToBag,
    customAvatar,
    setAddUrlModalOpen,
    socialDna,
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

  const [browseMode, setBrowseMode] = useState<"outfits" | "pieces">("outfits");
  const [extraAiCount, setExtraAiCount] = useState(4);
  const [runwayYawDeg, setRunwayYawDeg] = useState<number>(0);
  const runwayAngle: "front" | "back" =
    runwayYawDeg >= 110 && runwayYawDeg <= 250 ? "back" : "front";
  const [activeLookIdx, setActiveLookIdx] = useState(0);

  // Per-outfit piece swap overrides so shoppers can swap pieces live on the Runway!
  const [swappedPieceBySlot, setSwappedPieceBySlot] = useState<
    Record<string, Product>
  >({});

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
    preloadCoreModularLayers();
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

  // Full AliExpress Outfits & Single Pieces Lineup on the Lifelike Diagonal Runway
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
          aiReason: `Custom ${pieces.length}-piece outfit styled for your ${activeHeightStr} frame.`,
          fitHeadline: `Exact ${activeHeightStr} Fit`,
          matchScorePct: 98,
          frontAvatarUrl: co.frontAvatarUrl,
          backAvatarUrl: co.backAvatarUrl,
          isModularRemix: true,
          pieces,
          totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
        } satisfies AiRunwayOutfit;
      })
      .filter((x): x is AiRunwayOutfit => x !== null);

    const combined = [...customHydrated, ...baseAi];
    return combined.map((o, idx) => ({ ...o, outfitNumber: idx + 1 }));
  }, [
    activeHeightStr,
    avatarStats,
    boutiqueCatalog,
    browseMode,
    extraAiCount,
    savedCustomOutfits,
    socialDna,
  ]);

  // Endless AI Auto-Styling as user scrolls through Runway looks
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

  // Refs for Original Iconic Diagonal Multi-Model Runway Engine
  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const modelTopImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const faceImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const modularDataUrlCacheRef = useRef<Record<string, string>>({});
  const runwayAngleRef = useRef<"front" | "back">(runwayAngle);
  runwayAngleRef.current = runwayAngle;
  const jumpLookRef = useRef<((lookIndex: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const resolveEffectiveOutfitProducts = useCallback(
    (outfit: AiRunwayOutfit): { products: Product[]; hasSwap: boolean } => {
      let hasSwap = false;
      const products = outfit.pieces.map((p, slotIdx) => {
        const override = swappedPieceBySlot[`${outfit.id}:${slotIdx}`];
        if (override) {
          hasSwap = true;
          return override;
        }
        return p.product;
      });
      return { products, hasSwap };
    },
    [swappedPieceBySlot]
  );

  // Sync Front 0° / Back 180° + Live Modular Piece Swaps & AI Remixes seamlessly!
  useEffect(() => {
    const targetAngle = runwayAngle;
    modelTopImgElsRef.current.forEach((imgEl, i) => {
      const outfit = runwayOutfits[i];
      if (!imgEl || !outfit) return;

      const { products: effProducts, hasSwap } =
        resolveEffectiveOutfitProducts(outfit);
      const needsModular =
        Boolean(outfit.isModularRemix) ||
        outfit.id.startsWith("custom-runway-") ||
        hasSwap;

      if (!needsModular) {
        imgEl.src =
          targetAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl;
        return;
      }

      const cacheKey = `${targetAngle}:${effProducts
        .map((p) => p.id)
        .join("|")}`;
      const cached = modularDataUrlCacheRef.current[cacheKey];
      if (cached) {
        imgEl.src = cached;
        return;
      }

      void renderModularOutfitDataUrlAsync(effProducts, targetAngle).then(
        (dataUrl) => {
          if (!dataUrl) return;
          modularDataUrlCacheRef.current[cacheKey] = dataUrl;
          const latestEl = modelTopImgElsRef.current[i];
          if (latestEl && runwayAngleRef.current === targetAngle) {
            latestEl.src = dataUrl;
          }
        }
      );
    });

    faceImgElsRef.current.forEach((faceEl) => {
      if (!faceEl) return;
      if (customAvatar?.faceOvalDataUrl && runwayAngle === "front") {
        faceEl.src = customAvatar.faceOvalDataUrl;
        faceEl.style.display = "block";
      } else {
        faceEl.removeAttribute("src");
        faceEl.style.display = "none";
      }
    });
  }, [
    customAvatar,
    resolveEffectiveOutfitProducts,
    runwayAngle,
    runwayOutfits,
  ]);

  // Iconic Diagonal Depth-of-Field Multi-Model Lifelike Runway Physics (Original Prompt Properties!)
  useEffect(() => {
    const stage = stageRef.current;
    const line = lineRef.current;
    const ring = ringRef.current;
    const roll = rollRef.current;
    if (!stage || !line || !ring || !roll) return;

    line.innerHTML = "";
    roll.innerHTML = "";

    const N = runwayOutfits.length;
    if (N === 0) return;

    const calm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const createdTopImgs: Array<HTMLImageElement | null> = [];
    const createdFaceImgs: Array<HTMLImageElement | null> = [];

    // Body-scan proportion subtle width factor so scanned curves reflect gently on the lifelike figure
    const hipRatio = clamp(bodyDims.hipsInches / 34.0, 0.9, 1.16);

    const people = runwayOutfits.map((outfit, i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);

      const { products: effProducts, hasSwap } =
        resolveEffectiveOutfitProducts(outfit);
      const needsModular =
        Boolean(outfit.isModularRemix) ||
        outfit.id.startsWith("custom-runway-") ||
        hasSwap;
      const cacheKey = `${runwayAngle}:${effProducts
        .map((p) => p.id)
        .join("|")}`;
      const cachedMod = needsModular
        ? modularDataUrlCacheRef.current[cacheKey]
        : undefined;

      const img = document.createElement("img");
      img.className = "mv-avatar-img";
      img.src =
        cachedMod ||
        (runwayAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl);
      img.alt = outfit.title;
      img.decoding = "async";
      e.append(img);
      createdTopImgs.push(img);

      if (needsModular && !cachedMod) {
        const reqAngle = runwayAngle;
        void renderModularOutfitDataUrlAsync(effProducts, reqAngle).then(
          (dataUrl) => {
            if (!dataUrl) return;
            modularDataUrlCacheRef.current[cacheKey] = dataUrl;
            if (runwayAngleRef.current === reqAngle) {
              img.src = dataUrl;
            }
          }
        );
      }

      const faceImg = document.createElement("img");
      faceImg.className = "mv-face-oval";
      faceImg.alt = "";
      if (customAvatar?.faceOvalDataUrl && runwayAngle === "front") {
        faceImg.src = customAvatar.faceOvalDataUrl;
        faceImg.style.display = "block";
      } else {
        faceImg.style.display = "none";
      }
      e.append(faceImg);
      createdFaceImgs.push(faceImg);

      line.append(e);
      return {
        e,
        r: (900 / 1355) * hipRatio,
        f: "",
        o: "",
        cx: 0,
        sc: 1,
        vis: true,
      };
    });

    modelTopImgElsRef.current = createdTopImgs;
    faceImgElsRef.current = createdFaceImgs;

    for (let i = 0; i <= N; i++) {
      const b = document.createElement("b");
      const num = 1 + (i % N);
      b.textContent = num < 10 ? `0${num}` : String(num);
      roll.append(b);
    }

    let W = 0;
    let H = 0;
    let base = 0;
    let mobile = false;
    let dirty = true;
    let p = clamp(currentPosRef.current, 0, Math.max(0, N - 1));
    let target = p;
    let last = 0;
    let lastReportedIdx = Math.round(wrap(p, N)) % N;

    jumpLookRef.current = (lookIndex: number) => {
      const currMod = wrap(Math.round(target), N);
      let delta = lookIndex - currMod;
      if (delta < 0) delta += N;
      target = Math.round(target) + delta;
    };

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 0.97;
      mobile = window.innerWidth <= 820;
      people.forEach((m) => {
        m.e.style.width = `${base * m.r}px`;
        m.e.style.height = `${base}px`;
      });
      dirty = true;
    };

    const paint = () => {
      currentPosRef.current = p;
      const roundedIdx = Math.round(wrap(p, N)) % N;
      if (roundedIdx !== lastReportedIdx) {
        lastReportedIdx = roundedIdx;
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
        const rawOp = d < -0.5 ? Math.max(0, 1 + (d + 0.5) * 2.2) : L(KO);
        // Smoothly hand off foreground slot (|d| < 0.45) to the live WebGL 3D Character stage!
        const heroFade = Math.min(1, Math.max(0, (Math.abs(d) - 0.14) / 0.34));
        const op = rawOp * heroFade;
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

      const r = wrap(p, N);
      const rollH = mobile ? 24 : 30;
      roll.style.transform = `translate3d(0,${(
        -(r > N - 1 ? r : Math.round(r)) * rollH
      ).toFixed(1)}px,0)`;
      dirty = false;
    };

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
    let drag = false;
    let sx = 0;
    let sy = 0;
    let s0 = 0;
    let moved = false;

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      cx = mx = e.clientX - r.left;
      cy = my = e.clientY - r.top;
      ring.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      ring.classList.add("show");
    };

    const onLeave = () => ring.classList.remove("show", "drag");

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!drag) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 6) moved = true;
      target = s0 + dx / Math.max(200, W * 0.34);
    };

    const onDown = (e: PointerEvent) => {
      if (
        (e.target as HTMLElement)?.closest(
          "button, [data-runway-3d-hero='true']"
        )
      ) {
        return;
      }
      drag = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      s0 = target;
      ring.classList.add("drag");
      stage.setPointerCapture(e.pointerId);
    };

    const onRelease = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      ring.classList.remove("drag");
      if (!moved) {
        const rect = stage.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let tappedIdx = -1;
        let bestDist = Infinity;
        people.forEach((m, idx) => {
          if (!m.vis) return;
          const dist = Math.abs(clickX - m.cx);
          if (dist < base * 0.2 * m.sc && dist < bestDist) {
            bestDist = dist;
            tappedIdx = idx;
          }
        });
        const d =
          tappedIdx >= 0 ? wrap(tappedIdx - Math.round(target), N) : 0;
        target = Math.round(target) + (d && d < N - 1 ? d : 1);
      } else {
        target = Math.round(target);
      }
    };

    let wheelAcc = 0;
    let wheelT: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelAcc += d * (e.deltaMode === 1 ? 32 : 1);
      if (Math.abs(wheelAcc) > 55) {
        target = Math.round(target) + Math.sign(wheelAcc);
        wheelAcc = 0;
      }
      if (wheelT) clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        wheelAcc = 0;
      }, 160);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const step =
        e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
      if (step) {
        e.preventDefault();
        target = Math.round(target) + step;
      }
    };

    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointerup", onRelease);
    stage.addEventListener("pointercancel", onRelease);
    stage.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", size);
    window.addEventListener("keydown", onKeyDown);

    let rafId = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - (last || now));
      last = now;
      const diff = target - p;
      if (Math.abs(diff) > 0.0004) {
        p = calm ? target : p + diff * (1 - Math.pow(0.0012, dt / 1000));
        dirty = true;
      } else if (p !== target) {
        p = target;
        dirty = true;
      }
      if (dirty) paint();
      if (Math.abs(mx - cx) > 0.25 || Math.abs(my - cy) > 0.25) {
        cx += (mx - cx) * 0.35;
        cy += (my - cy) * 0.35;
        ring.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(
          1
        )}px,0)`;
      }
      rafId = requestAnimationFrame(frame);
    };

    size();
    paint();
    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      if (wheelT) clearTimeout(wheelT);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointerup", onRelease);
      stage.removeEventListener("pointercancel", onRelease);
      stage.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", size);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyDims.hipsInches, runwayOutfits]);

  const handleSwapPieceInOutfit = useCallback(
    (slotIdx: number, currentProduct: Product) => {
      if (!rawActiveOutfit) return;
      const sameCategoryPool = boutiqueCatalog.filter((p) => {
        if (currentProduct.category === "accessory") {
          const curIsBelt = /belt/i.test(currentProduct.title);
          return (
            p.category === "accessory" &&
            /belt/i.test(p.title) === curIsBelt &&
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
      showToast(`Swapped in "${nextProd.title}"!`);
    },
    [boutiqueCatalog, rawActiveOutfit, showToast]
  );

  const handleAddOrBuyCurrentEntry = useCallback(
    (openCheckoutImmediately: boolean) => {
      if (!activeOutfit) return;
      activeOutfit.pieces.forEach((p) => {
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
          `Added all ${activeOutfit.pieces.length} pieces of "${activeOutfit.title}" to Bag!`
        );
      }
    },
    [activeOutfit, addToBag, openDropshipCheckout, recSize, showToast]
  );

  const handleCreateCustomRunwayOutfit = () => {
    if (selectedCustomIds.length === 0) return;

    const title =
      customTitle.trim() ||
      `Custom Boutique Edit #0${savedCustomOutfits.length + 1}`;
    const created: CustomRunwayOutfitSaved = {
      id: `custom-runway-${Date.now()}`,
      title,
      productIds: selectedCustomIds,
      frontAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_0_front.webp?v=mod7`,
      backAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_0_back.webp?v=mod7`,
    };
    persistCustomRunway([created, ...savedCustomOutfits]);
    setBrowseMode("outfits");
    setBuildModalOpen(false);
    setCustomTitle("");
    currentPosRef.current = 0;
    setActiveLookIdx(0);
    setTimeout(() => jumpLookRef.current?.(0), 40);
    showToast(`Added "${title}" onto your Runway!`);
  };

  return (
    <div className="mv-page">
      <main className="mv-main">
        {/* ==================== HALF 1 (50% SCREEN): UNOBSTRUCTED LIFELIKE DIAGONAL RUNWAY STAGE ==================== */}
        <section
          className="mv-stage"
          ref={stageRef}
          aria-label="Slide Runway to shop outfits on your lifelike avatar"
          tabIndex={0}
        >
          <div className="mv-line" ref={lineRef} />
          <div className="mv-ring" ref={ringRef} />

          {/* Foreground Live WebGL 3D Character Wearing Equipped 3D Garments! */}
          {activeOutfit && (
            <div
              data-runway-3d-hero="true"
              className="absolute inset-y-0 right-0 w-[62%] sm:w-[58%] z-[25]"
              title="Drag to spin your 3D Character 360°"
            >
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={bodyDims}
                wornPieces={activeOutfit.pieces.map((p) => ({
                  product: p.product,
                  selectedSize: p.recommendedSize,
                }))}
                faceOvalDataUrl={customAvatar?.faceOvalDataUrl || null}
                externalYawDeg={runwayYawDeg}
                showHud={false}
                seamlessStage
              />
            </div>
          )}

          {/* Minimal Corner 3D Angle Selector Pill inside Stage (No Top Header Bar!) */}
          <div className="absolute top-2.5 left-2.5 z-30 inline-flex items-center p-0.5 rounded-full bg-white/88 backdrop-blur-md border border-black/[0.08] shadow-xs">
            {(
              [
                [0, "Front 0°"],
                [32, "3/4 32°"],
                [90, "Side 90°"],
                [180, "Back 180°"],
              ] as const
            ).map(([deg, lbl]) => (
              <button
                key={deg}
                type="button"
                onClick={() => setRunwayYawDeg(deg)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold cursor-pointer transition min-h-[24px] ${
                  runwayYawDeg === deg
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Iconic Rolling Odometer Counter + Prev/Next Runway Stepper in Bottom-Left Corner */}
          <div className="mv-look flex items-center gap-1.5" aria-live="polite">
            <button
              type="button"
              onClick={() => {
                const N = Math.max(1, runwayOutfits.length);
                jumpLookRef.current?.((safeActiveIdx - 1 + N) % N);
              }}
              aria-label="Previous outfit"
              className="w-5 h-5 rounded-full bg-[#F1F2F5] hover:bg-[#E2E5EC] text-[#141518] inline-flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span>{browseMode === "pieces" ? "3D Item" : "Outfit"}</span>
            <span className="mv-win">
              <span className="mv-roll" ref={rollRef} />
            </span>
            <button
              type="button"
              onClick={() => {
                const N = Math.max(1, runwayOutfits.length);
                jumpLookRef.current?.((safeActiveIdx + 1) % N);
              }}
              aria-label="Next outfit"
              className="w-5 h-5 rounded-full bg-[#F1F2F5] hover:bg-[#E2E5EC] text-[#141518] inline-flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>

        {/* ==================== HALF 2 (50% SCREEN): ALL CLOTHES IN THIS OUTFIT ==================== */}
        <aside
          className="mv-rail"
          aria-label="Clothes in this Runway outfit"
        >
          {activeOutfit && (
            <>
              {/* Clean Outfit Summary & Full-Outfit Buy Row at Top of Clothes Half */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/[0.08] shrink-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-xs sm:text-sm font-extrabold text-[#141518] truncate">
                      {activeOutfit.title}
                    </h1>
                  </div>
                  <p className="text-[10.5px] font-semibold text-[#244B3B] truncate">
                    {browseMode === "pieces"
                      ? `Single Piece • Calibrated for ${activeHeightStr} (Size ${recSize})`
                      : `${activeOutfit.pieces.length} Pieces • Calibrated for ${activeHeightStr} (Size ${recSize})`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <div className="inline-flex items-center p-0.5 rounded-full bg-white border border-black/[0.08]">
                    {(
                      [
                        ["outfits", "Outfits"],
                        ["pieces", "Pieces"],
                      ] as const
                    ).map(([modeKey, lbl]) => (
                      <button
                        key={modeKey}
                        type="button"
                        onClick={() => {
                          setBrowseMode(modeKey);
                          currentPosRef.current = 0;
                          setActiveLookIdx(0);
                          setTimeout(() => jumpLookRef.current?.(0), 30);
                        }}
                        className={`px-2 py-1 rounded-full text-[10px] font-bold cursor-pointer transition min-h-[24px] ${
                          browseMode === modeKey
                            ? "bg-[#141518] text-white"
                            : "text-[#686D76] hover:text-[#141518]"
                        }`}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    id="gwo-runway-buy-full-outfit-btn"
                    onClick={() => handleAddOrBuyCurrentEntry(true)}
                    className="px-3 py-1.5 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer min-h-[28px]"
                  >
                    {browseMode === "pieces"
                      ? `Buy Piece ($${activeOutfit.totalPriceUsd})`
                      : `Buy Outfit ($${activeOutfit.totalPriceUsd})`}
                  </button>
                  <button
                    type="button"
                    id="gwo-runway-bag-full-outfit-btn"
                    onClick={() => handleAddOrBuyCurrentEntry(false)}
                    className="px-2.5 py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer min-h-[28px]"
                  >
                    <ShoppingBag className="w-3 h-3" />{" "}
                    {browseMode === "pieces" ? "+ Bag" : "+ Set"}
                  </button>
                  <button
                    type="button"
                    id="gwo-runway-add-ai-outfit-btn"
                    onClick={() => {
                      setBrowseMode("outfits");
                      const jumpIdx = runwayOutfits.length;
                      setExtraAiCount((prev) => prev + 1);
                      showToast("AI styled a fresh outfit onto your Runway!");
                      setTimeout(() => jumpLookRef.current?.(jumpIdx), 60);
                    }}
                    className="p-1.5 rounded-full bg-[#E7F3EE] hover:bg-[#D5EAE0] text-[#1D4232] cursor-pointer min-w-[28px] min-h-[28px] inline-flex items-center justify-center"
                    title="Generate new AI outfit on Runway"
                    aria-label="Generate new AI outfit"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    id="gwo-runway-build-outfit-btn"
                    onClick={() => setBuildModalOpen(true)}
                    className="p-1.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] cursor-pointer min-w-[28px] min-h-[28px] inline-flex items-center justify-center"
                    title="Build custom outfit"
                    aria-label="Build custom outfit"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* All Pieces Grid */}
              <div
                className={`mv-pieces-grid ${
                  activeOutfit.pieces.length >= 5 ? "dense-six" : ""
                }`}
              >
                {activeOutfit.pieces.map((spec, slotIdx) => {
                  const prod = spec.product;
                  const isOwned = ownedIds.has(prod.id);
                  const pdpHref = `/product?id=${encodeURIComponent(prod.id)}`;

                  return (
                    <article
                      key={`${prod.id}-${slotIdx}`}
                      data-outfit-piece-card="true"
                      className="rounded-2xl bg-white border border-black/[0.07] p-2.5 flex flex-col justify-between gap-1.5 shadow-[0_2px_10px_rgba(20,21,24,0.04)]"
                    >
                      <div className="space-y-1.5">
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
                            className="px-2 py-0.5 rounded-full bg-[#F1F2F5] hover:bg-[#E2E5EC] text-[#141518] text-[9.5px] font-bold inline-flex items-center gap-0.5 cursor-pointer min-h-[22px] shrink-0"
                            title="Spin 360° Front, Side & Back"
                          >
                            <Rotate3d className="w-2.5 h-2.5 text-[#244B3B]" /> 360°
                          </button>
                        </div>

                        <Link
                          href={pdpHref}
                          className="relative h-28 sm:h-32 rounded-xl bg-white border border-black/[0.04] overflow-hidden flex items-center justify-center block"
                        >
                          <GarmentArtwork
                            product={prod}
                            className="w-full h-full"
                          />
                        </Link>

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

                      <div className="flex items-center gap-1 pt-0.5">
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
                        <button
                          type="button"
                          onClick={() => handleSwapPieceInOutfit(slotIdx, prod)}
                          className="p-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EE] text-[#141518] cursor-pointer min-w-[26px] min-h-[26px] inline-flex items-center justify-center"
                          title="Swap piece"
                          aria-label={`Swap ${prod.title}`}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </aside>
      </main>

      {/* ==================== BUILD CUSTOM OUTFIT MODAL ==================== */}
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
                  Build Custom Runway Outfit
                </h3>
                <p className="text-xs text-[#686D76] mt-0.5">
                  Select boutique pieces below to add a custom outfit onto your Runway avatar.
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
              placeholder="Outfit Name (e.g., Friday Cocktail Edit)"
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
                      <div className="h-28 rounded-xl bg-white border border-black/[0.05] overflow-hidden mb-1.5 relative">
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
                Add Outfit to Runway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

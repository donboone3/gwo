"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Rotate3d,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import "./runway-lookbook.css";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { MotionSitesBoutiqueStorefront } from "../shop/MotionSitesBoutiqueStorefront";
import { launchFlyToBag } from "@/lib/motion/fly-to-bag";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  formatCompactOutfitTitle,
  formatCompactProductTitle,
} from "@/lib/catalog/compact-title";
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
import { prefetchTurntableBundle } from "@/lib/three/higgsfield-turntable-engine";
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

// Clean-Separated Diagonal Runway Curves: Full-Stage 360° Hero (`KH = 1.00`, `KX = 0.66/0.68`)
// with generous open air gap from `d = 1` (`KX = 0.25/0.215`, `KH = 0.64/0.62`) even on wide tote bags!
const KX = [1.42, 0.66, 0.25, 0.145, 0.08, 0.035, 0.00];
const KX_MOBILE = [1.46, 0.68, 0.215, 0.11, 0.045, 0.00, -0.04];
const KF = [1.00, 0.922, 0.845, 0.775, 0.715, 0.665, 0.625];
const KH = [1.08, 1.00, 0.64, 0.48, 0.36, 0.27, 0.20];
const KH_MOBILE = [1.08, 1.00, 0.62, 0.46, 0.35, 0.26, 0.19];
const KB = [0, 0, 2.4, 5.2, 9.0, 13.0, 17.5];
const KO = [1, 1, 0.86, 0.72, 0.54, 0.34, 0];

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
  const [occasionFilter, setOccasionFilter] = useState<string>("all");
  const [extraAiCount, setExtraAiCount] = useState(0);
  const [runwayYawDeg] = useState<number>(0);
  const runwayAngle: "front" | "back" =
    runwayYawDeg >= 110 && runwayYawDeg <= 250 ? "back" : "front";
  const [activeLookIdx, setActiveLookIdx] = useState(0);
  const [isMobileStage, setIsMobileStage] = useState(false);

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
      occasionFilter,
      extraGeneratedCount: extraAiCount,
    });

    const byId = new Map<string, Product>(
      boutiqueCatalog.map((p) => [p.id, p])
    );
    const customHydrated: AiRunwayOutfit[] = savedCustomOutfits
      .map((co, idx): AiRunwayOutfit | null => {
        if (!co || !Array.isArray(co.productIds)) return null;
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
    occasionFilter,
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

  // Background pre-warm adjacent Runway outfits' Higgsfield 360° turntables in RAM for 0ms stepping!
  useEffect(() => {
    const N = runwayOutfits.length;
    if (N < 2) return;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 860;
    const t1 = setTimeout(() => {
      const next1 = runwayOutfits[(safeActiveIdx + 1) % N];
      if (next1) {
        prefetchTurntableBundle(
          next1.pieces.map((p) => p.product),
          true
        );
      }
    }, 220);
    const t2 = isMobile
      ? null
      : setTimeout(() => {
          const next2 = runwayOutfits[(safeActiveIdx + 2) % N];
          const prev1 = runwayOutfits[(safeActiveIdx - 1 + N) % N];
          if (next2) {
            prefetchTurntableBundle(
              next2.pieces.map((p) => p.product),
              true
            );
          }
          if (prev1) {
            prefetchTurntableBundle(
              prev1.pieces.map((p) => p.product),
              true
            );
          }
        }, 700);
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [runwayOutfits, safeActiveIdx]);

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
  const heroWrapRef = useRef<HTMLDivElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const modelTopImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const faceImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const modularDataUrlCacheRef = useRef<Record<string, string>>({});
  const runwayAngleRef = useRef<"front" | "back">(runwayAngle);
  runwayAngleRef.current = runwayAngle;
  const jumpLookRef = useRef<((lookIndex: number) => void) | null>(null);
  const stepLookRef = useRef<((delta: number) => void) | null>(null);
  const footerScrubRef = useRef<{
    start: () => void;
    move: (dx: number) => void;
    end: (wasDragging: boolean) => void;
  } | null>(null);
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

  // Sync Front 0° / Back 180° + Live Modular Piece Swaps & AI Remixes lazily for near-stage window!
  const hydrateNearWindowModular = useCallback(
    (centerIdx: number, targetAngle: "front" | "back") => {
      const N = runwayOutfits.length;
      if (N === 0) return;
      for (let offset = -2; offset <= 6; offset++) {
        const i = ((centerIdx + offset) % N + N) % N;
        const imgEl = modelTopImgElsRef.current[i];
        const outfit = runwayOutfits[i];
        if (!imgEl || !outfit) continue;

        const { products: effProducts, hasSwap } =
          resolveEffectiveOutfitProducts(outfit);
        const needsModular =
          Boolean(outfit.isModularRemix) ||
          outfit.id.startsWith("custom-runway-") ||
          hasSwap;

        if (!needsModular) {
          const want =
            targetAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl;
          if (imgEl.getAttribute("src") !== want) imgEl.src = want;
          continue;
        }

        const cacheKey = `${targetAngle}:${effProducts
          .map((p) => p.id)
          .join("|")}`;
        const cached = modularDataUrlCacheRef.current[cacheKey];
        if (cached) {
          if (imgEl.getAttribute("src") !== cached) imgEl.src = cached;
          continue;
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
      }
    },
    [resolveEffectiveOutfitProducts, runwayOutfits]
  );

  useEffect(() => {
    hydrateNearWindowModular(safeActiveIdx, runwayAngle);
    faceImgElsRef.current.forEach((faceEl) => {
      if (faceEl) faceEl.style.display = "none";
    });
  }, [
    customAvatar,
    hydrateNearWindowModular,
    runwayAngle,
    safeActiveIdx,
  ]);

  // Iconic Diagonal Depth-of-Field Multi-Model Lifelike Runway Physics (Original Prompt Properties!)
  useEffect(() => {
    const stage = stageRef.current;
    const line = lineRef.current;
    const ring = ringRef.current;
    const roll = rollRef.current;
    if (!stage || !line || !ring) return;

    line.innerHTML = "";
    if (roll) roll.innerHTML = "";

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

      const isInitialNear = i <= 6 || i >= N - 1;
      const defaultSrc =
        cachedMod ||
        (runwayAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl);

      const img = document.createElement("img");
      img.className = "mv-avatar-img";
      img.alt = outfit.title;
      img.decoding = "async";
      img.loading = isInitialNear ? "eager" : "lazy";
      // Only attach `img.src` for visible near-stage models so iOS Safari never decodes all 100 900x1355 images at once!
      if (isInitialNear) {
        img.src = defaultSrc;
      } else {
        e.style.display = "none";
        e.style.opacity = "0";
      }
      e.append(img);
      createdTopImgs.push(img);

      if (needsModular && !cachedMod && i <= 5) {
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
      faceImg.style.display = "none";
      e.append(faceImg);
      createdFaceImgs.push(faceImg);

      line.append(e);
      return {
        e,
        img,
        outfit,
        r: (900 / 1355) * hipRatio,
        f: "",
        o: isInitialNear ? "" : "0",
        cx: 0,
        sc: 1,
        vis: isInitialNear,
      };
    });

    modelTopImgElsRef.current = createdTopImgs;
    faceImgElsRef.current = createdFaceImgs;

    if (roll) {
      for (let i = 0; i <= N; i++) {
        const b = document.createElement("b");
        const num = 1 + (i % N);
        b.textContent = num < 10 ? `0${num}` : String(num);
        roll.append(b);
      }
    }

    let W = 0;
    let H = 0;
    let base = 0;
    let mobile = false;
    let dirty = true;
    let drag = false;
    let footerDragging = false;
    let p = clamp(currentPosRef.current, 0, Math.max(0, N - 1));
    let target = p;
    let last = 0;
    let lastReportedIdx = Math.round(wrap(p, N)) % N;

    let rafId = 0;
    const kickRunway = () => {
      if (!rafId) {
        last = performance.now();
        rafId = requestAnimationFrame((ts) => frame(ts));
      }
    };

    jumpLookRef.current = (lookIndex: number) => {
      const currMod = wrap(Math.round(target), N);
      let delta = lookIndex - currMod;
      if (delta > N * 0.5) delta -= N;
      if (delta < -N * 0.5) delta += N;
      target = Math.round(target) + delta;
      dirty = true;
      kickRunway();
    };

    stepLookRef.current = (delta: number) => {
      target = Math.round(target) + delta;
      dirty = true;
      kickRunway();
    };

    let footerStartTarget = 0;
    footerScrubRef.current = {
      start: () => {
        footerStartTarget = target;
      },
      move: (dx: number) => {
        footerDragging = true;
        target = footerStartTarget - dx / Math.max(110, W * 0.28);
        dirty = true;
        kickRunway();
      },
      end: (wasDragging: boolean) => {
        const hadDrag = footerDragging || wasDragging;
        footerDragging = false;
        if (hadDrag) {
          target = Math.round(target);
        }
        dirty = true;
        kickRunway();
      },
    };

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      mobile = window.innerWidth <= 820;
      setIsMobileStage(mobile);
      base = mobile ? Math.min(H * 0.90, W * 1.88) : H * 0.92;
      people.forEach((m) => {
        m.e.style.width = `${base * m.r}px`;
        m.e.style.height = `${base}px`;
      });
      dirty = true;
      kickRunway();
    };

    const paint = () => {
      currentPosRef.current = p;
      const roundedIdx = Math.round(wrap(p, N)) % N;
      if (roundedIdx !== lastReportedIdx) {
        lastReportedIdx = roundedIdx;
        setActiveLookIdx(roundedIdx);
      }

      const heroReady = Boolean(
        stage.querySelector('[data-frames-ready="true"]')
      );
      const distFromSlot = Math.abs(p - Math.round(p));
      const isSettled =
        !drag &&
        !footerDragging &&
        Math.abs(target - p) <= 0.028 &&
        distFromSlot <= 0.028;
      const showLiveHero = isSettled && heroReady;
      const heroWrapEl = heroWrapRef.current;
      if (heroWrapEl) {
        const wantHeroOp = showLiveHero ? "1" : "0";
        if (heroWrapEl.style.opacity !== wantHeroOp) {
          heroWrapEl.style.opacity = wantHeroOp;
          heroWrapEl.style.pointerEvents = showLiveHero ? "auto" : "none";
        }
      }

      people.forEach((m, i) => {
        let d = wrap(i - p, N);
        if (d > N * 0.5) d -= N;
        if (d < -1.35 || d > 5.85) {
          if (m.o !== "0") {
            m.o = "0";
            m.e.style.opacity = "0";
            m.e.style.display = "none";
          }
          m.vis = false;
          return;
        }
        if (m.e.style.display === "none") {
          m.e.style.display = "block";
        }
        if (!m.img.getAttribute("src")) {
          m.img.src =
            runwayAngleRef.current === "back"
              ? m.outfit.backAvatarUrl
              : m.outfit.frontAvatarUrl;
        }
        const k = clamp(d + 1, 0, 6);
        const a = Math.floor(k);
        const t = k - a;
        const L = (v: number[]) => v[a] + (v[Math.min(a + 1, 6)] - v[a]) * t;

        const sc = L(mobile ? KH_MOBILE : KH);
        const centerX = W * L(mobile ? KX_MOBILE : KX);
        const x = centerX - base * m.r * sc * 0.5;
        const y = H * L(KF) - base * sc;
        const bl = L(KB);
        const rawOp = d < -0.35 ? Math.max(0, 1 + (d + 0.35) * 2.4) : L(KO);
        // Atomic 1-frame handoff: NEVER show both the Runway sprite and the live 360° hero simultaneously!
        const heroFade = showLiveHero && i === roundedIdx ? 0 : 1;
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

      if (roll) {
        const r = wrap(p, N);
        const rollH = mobile ? 24 : 30;
        roll.style.transform = `translate3d(0,${(
          -(r > N - 1 ? r : Math.round(r)) * rollH
        ).toFixed(1)}px,0)`;
      }
      dirty = false;
    };

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
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
      kickRunway();
    };

    const onLeave = () => ring.classList.remove("show", "drag");

    let horizLocked = false;

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (e.pointerType === "mouse") kickRunway();
      if (!drag) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      const dist = Math.hypot(dx, dy);
      if (!horizLocked) {
        if (dist < 6) return;
        if (Math.abs(dy) >= Math.abs(dx) * 0.95) {
          drag = false;
          ring.classList.remove("drag");
          return;
        }
        horizLocked = true;
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      if (dist > 6) moved = true;
      target = s0 + dx / Math.max(200, W * 0.34);
      kickRunway();
    };

    const onDown = (e: PointerEvent) => {
      if (
        (e.target as HTMLElement)?.closest("button, [data-runway-footer='true']")
      ) {
        return;
      }
      const stRect = stage.getBoundingClientRect();
      if ((e.clientX - stRect.left) / Math.max(1, stRect.width) >= 0.39) {
        return;
      }
      drag = true;
      dirty = true;
      moved = false;
      horizLocked = e.pointerType === "mouse";
      sx = e.clientX;
      sy = e.clientY;
      s0 = target;
      ring.classList.add("drag");
      if (e.pointerType === "mouse") {
        try {
          stage.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      kickRunway();
    };

    const onRelease = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      dirty = true;
      ring.classList.remove("drag");
      try {
        if (stage.hasPointerCapture(e.pointerId)) {
          stage.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
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
      kickRunway();
    };

    let wheelAcc = 0;
    let wheelT: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.15) {
        return;
      }
      e.preventDefault();
      const d = e.deltaX;
      wheelAcc += d * (e.deltaMode === 1 ? 32 : 1);
      if (Math.abs(wheelAcc) > 55) {
        target = Math.round(target) + Math.sign(wheelAcc);
        wheelAcc = 0;
        kickRunway();
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
        kickRunway();
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

    let lastHeroReady = Boolean(
      stage.querySelector('[data-frames-ready="true"]')
    );
    const heroObs = new MutationObserver(() => {
      const heroNow = Boolean(
        stage.querySelector('[data-frames-ready="true"]')
      );
      if (heroNow !== lastHeroReady) {
        lastHeroReady = heroNow;
        dirty = true;
        kickRunway();
      }
    });
    heroObs.observe(stage, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-frames-ready"],
    });

    const frame = (now: number) => {
      rafId = 0;
      const dt = Math.min(50, Math.max(1, now - (last || now)));
      last = now;
      const diff = target - p;
      if (Math.abs(diff) > 0.0004) {
        p = calm ? target : p + diff * (1 - Math.pow(0.0012, dt / 1000));
        dirty = true;
      } else if (p !== target) {
        p = target;
        dirty = true;
      }
      if (dirty) {
        try {
          paint();
        } catch {
          dirty = false;
        }
      }
      const ringMoving =
        ring.classList.contains("show") &&
        (Math.abs(mx - cx) > 0.25 || Math.abs(my - cy) > 0.25);
      if (ringMoving) {
        cx += (mx - cx) * 0.35;
        cy += (my - cy) * 0.35;
        ring.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(
          1
        )}px,0)`;
      }
      // Event-driven sleep: 0.0% idle CPU while stationary so 360° spin gets 100% GPU/CPU!
      if (Math.abs(target - p) > 0.0004 || dirty || ringMoving) {
        rafId = requestAnimationFrame(frame);
      }
    };

    size();
    paint();
    kickRunway();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      heroObs.disconnect();
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
      frontAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_0_front.webp?v=mod28`,
      backAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_0_back.webp?v=mod28`,
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

          {/* Foreground Live WebGL 3D Character — Exact Same Full-Stage Scale as 360°! */}
          {activeOutfit && (
            <div
              ref={heroWrapRef}
              data-runway-3d-hero="true"
              className="absolute inset-0 w-full h-full z-[25]"
              title="Drag horizontally to spin your 3D Character 360°"
            >
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={bodyDims}
                wornPieces={activeOutfit.pieces.map((p) => ({
                  product: p.product,
                  selectedSize: p.recommendedSize,
                }))}
                faceOvalDataUrl={customAvatar?.faceOvalDataUrl || null}
                customAvatarTurntableMp4Url={customAvatar?.turntableMp4Url}
                customAvatarTurntablePosterUrl={customAvatar?.turntablePosterUrl}
                externalYawDeg={0}
                externalYawSeq={safeActiveIdx}
                centerXFrac={isMobileStage ? 0.68 : 0.66}
                bottomReservePx={42}
                ignoreLeftFraction={0.39}
                showHud={false}
                seamlessStage
              />
            </div>
          )}

          {/* Centered Outfit Name Footer Bar — Tap Arrows, Tap Name, or Swipe Across Bar to Cycle Outfits! */}
          {activeOutfit && (
            <div
              data-runway-footer="true"
              className="absolute inset-x-3 bottom-2 z-[35] flex items-center justify-center pointer-events-none"
            >
              <div
                style={{ touchAction: "pan-y" }}
                onPointerDown={(ev) => {
                  const el = ev.currentTarget as HTMLElement;
                  el.dataset.sx = String(ev.clientX);
                  el.dataset.dragging = "0";
                  footerScrubRef.current?.start();
                }}
                onPointerMove={(ev) => {
                  if (!(ev.buttons & 1) && ev.pointerType === "mouse") return;
                  const el = ev.currentTarget as HTMLElement;
                  if (!el.dataset.sx) return;
                  const dx = ev.clientX - Number(el.dataset.sx);
                  if (Math.abs(dx) > 8) {
                    if (el.dataset.dragging !== "1") {
                      el.dataset.dragging = "1";
                      try {
                        el.setPointerCapture(ev.pointerId);
                      } catch {
                        // ignore
                      }
                    }
                    footerScrubRef.current?.move(dx);
                  }
                }}
                onPointerUp={(ev) => {
                  const el = ev.currentTarget as HTMLElement;
                  const wasDragging = el.dataset.dragging === "1";
                  delete el.dataset.sx;
                  delete el.dataset.dragging;
                  if (wasDragging) {
                    try {
                      if (el.hasPointerCapture(ev.pointerId)) {
                        el.releasePointerCapture(ev.pointerId);
                      }
                    } catch {
                      // ignore
                    }
                  }
                  footerScrubRef.current?.end(wasDragging);
                }}
                onPointerCancel={(ev) => {
                  const el = ev.currentTarget as HTMLElement;
                  const wasDragging = el.dataset.dragging === "1";
                  delete el.dataset.sx;
                  delete el.dataset.dragging;
                  footerScrubRef.current?.end(wasDragging);
                  try {
                    if (el.hasPointerCapture(ev.pointerId)) {
                      el.releasePointerCapture(ev.pointerId);
                    }
                  } catch {
                    // ignore
                  }
                }}
                className="pointer-events-auto h-9 max-w-[94%] sm:max-w-[420px] inline-flex items-center justify-between gap-1.5 px-1.5 rounded-full bg-white/95 backdrop-blur-md border border-[#EBD2DE] shadow-[0_10px_26px_rgba(150,41,83,0.14)] select-none"
              >
                <button
                  type="button"
                  onClick={(ev) => {
                    if (
                      (ev.currentTarget.parentElement as HTMLElement)?.dataset
                        .dragging === "1"
                    ) {
                      return;
                    }
                    stepLookRef.current?.(-1);
                  }}
                  aria-label="Previous outfit"
                  className="w-7 h-7 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-[#962953] inline-flex items-center justify-center shrink-0 cursor-pointer transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={(ev) => {
                    if (
                      (ev.currentTarget.parentElement as HTMLElement)?.dataset
                        .dragging === "1"
                    ) {
                      return;
                    }
                    stepLookRef.current?.(1);
                  }}
                  title="Tap or swipe to step through outfits"
                  className="px-2 min-w-0 flex items-center gap-1.5 cursor-pointer text-center"
                >
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#962953] text-white text-[10px] font-extrabold shrink-0">
                    {String(activeOutfit.outfitNumber).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-extrabold text-[#22131A] truncate">
                    {browseMode === "pieces"
                      ? formatCompactProductTitle(
                          activeOutfit.pieces[0]?.product || activeOutfit.title,
                          24
                        )
                      : formatCompactOutfitTitle(activeOutfit.title, 26)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={(ev) => {
                    if (
                      (ev.currentTarget.parentElement as HTMLElement)?.dataset
                        .dragging === "1"
                    ) {
                      return;
                    }
                    stepLookRef.current?.(1);
                  }}
                  aria-label="Next outfit"
                  className="w-7 h-7 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-[#962953] inline-flex items-center justify-center shrink-0 cursor-pointer transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ==================== HALF 2 (50% DESKTOP / SCROLL DOWN ON MOBILE): "IN THIS LOOK" EDITORIAL RAIL ==================== */}
        <aside
          id="gwo-runway-products-rail"
          className="mv-rail scroll-mt-16"
          aria-label="Clothes in this Runway outfit"
        >
          {activeOutfit && (
            <>
              <div className="space-y-3">
                {/* Editorial "In This Look" Header & Action Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#ECD7E1] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      id="gwo-runway-buy-full-outfit-btn"
                      onClick={() => handleAddOrBuyCurrentEntry(true)}
                      className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#962953] hover:brightness-105 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-[0_4px_12px_rgba(184,59,106,0.25)] cursor-pointer min-h-[30px] whitespace-nowrap"
                    >
                      {browseMode === "pieces"
                        ? `Buy ($${activeOutfit.totalPriceUsd})`
                        : `Shop Full Outfit ($${activeOutfit.totalPriceUsd})`}
                    </button>
                    <button
                      type="button"
                      id="gwo-runway-bag-full-outfit-btn"
                      onClick={() => handleAddOrBuyCurrentEntry(false)}
                      className="px-3 py-1.5 rounded-full bg-[#22131A] hover:bg-[#381F2B] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer min-h-[30px] whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3 h-3 text-[#F9CFE0]" />{" "}
                      {browseMode === "pieces" ? "+ Bag" : "+ Set"}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    {browseMode === "outfits" && (
                      <select
                        aria-label="Filter 100 outfits by occasion"
                        value={occasionFilter}
                        onChange={(e) => {
                          setOccasionFilter(e.target.value);
                          currentPosRef.current = 0;
                          setActiveLookIdx(0);
                          setTimeout(() => jumpLookRef.current?.(0), 30);
                        }}
                        className="px-2.5 py-1 rounded-full bg-white border border-[#EBD2DE] text-[10.5px] font-bold text-[#962953] min-h-[28px] cursor-pointer"
                      >
                        <option value="all">All 100 Outfits</option>
                        <option value="Date Night">Date Night</option>
                        <option value="Cocktail">Cocktail &amp; Gala</option>
                        <option value="Party">Party &amp; Night Out</option>
                        <option value="Work">Work &amp; Executive</option>
                        <option value="Brunch">Brunch &amp; Chic</option>
                        <option value="Street">Street &amp; Off-Duty</option>
                        <option value="Pilates">Pilates &amp; Travel</option>
                      </select>
                    )}

                    <div className="inline-flex items-center p-0.5 rounded-full bg-white/95 border border-[#EBD2DE]">
                      {(
                        [
                          [
                            "outfits",
                            `Outfits (${
                              browseMode === "outfits" ? runwayOutfits.length : 100
                            })`,
                          ],
                          ["pieces", `Pieces (${boutiqueCatalog.length})`],
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
                          className={`px-2 py-1 rounded-full text-[10px] font-bold cursor-pointer transition min-h-[24px] whitespace-nowrap ${
                            browseMode === modeKey
                              ? "bg-[#B83B6A] text-white"
                              : "text-[#6E5360] hover:text-[#962953]"
                          }`}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      id="gwo-runway-build-outfit-btn"
                      onClick={() => setBuildModalOpen(true)}
                      className="p-1.5 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] border border-[#F0C5D7] text-[#962953] cursor-pointer min-w-[28px] min-h-[28px] inline-flex items-center justify-center"
                      title="Build custom outfit"
                      aria-label="Build custom outfit"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Editorial Subhead for Pieces in Current Runway Outfit */}
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#962953]">
                    In This Look • {activeOutfit.pieces.length} Pieces
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      document
                        .getElementById("gwo-ecomm-storefront")
                        ?.scrollIntoView({ behavior: "smooth" })
                    }
                    className="text-[11px] font-bold text-[#B83B6A] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    Shop All {boutiqueCatalog.length} Pieces{" "}
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>

                {/* All Pieces in Current Runway Outfit Grid */}
                <div
                  className={`mv-pieces-grid ${
                    activeOutfit.pieces.length >= 5 ? "dense-six" : ""
                  }`}
                >
                  {activeOutfit.pieces.map((spec, slotIdx) => {
                    const prod = spec.product;
                    const isOwned = ownedIds.has(prod.id);
                    const pdpHref = `/product/${encodeURIComponent(prod.id)}`;

                    return (
                      <article
                        key={`${prod.id}-${slotIdx}`}
                        data-outfit-piece-card="true"
                        className="group rounded-2xl bg-white border border-[#ECD7E1] hover:border-[#D99BB4] p-2.5 flex flex-col justify-between gap-2 shadow-[0_6px_18px_rgba(150,41,83,0.05)] transition"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wide truncate ${
                                isOwned
                                  ? "bg-[#FCECF3] text-[#8A244C]"
                                  : "bg-[#F9EFF4] text-[#962953]"
                              }`}
                            >
                              {isOwned
                                ? "In Closet ✓"
                                : spec.recommendedSize === "ONE SIZE"
                                ? `One Size • ${spec.confidencePct}%`
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
                              className="px-2 py-0.5 rounded-full bg-[#FDF6F9] hover:bg-[#FCECF3] border border-[#ECD7E1] text-[#22131A] text-[9.5px] font-bold inline-flex items-center gap-0.5 cursor-pointer min-h-[22px] shrink-0"
                              title="Spin 360° Front, Side & Back"
                            >
                              <Rotate3d className="w-2.5 h-2.5 text-[#B83B6A]" /> 360°
                            </button>
                          </div>

                          <Link
                            href={pdpHref}
                            className="relative h-28 sm:h-32 rounded-xl bg-gradient-to-b from-[#FFFDFE] to-[#FCF3F7] border border-[#F2E2EA] overflow-hidden flex items-center justify-center p-2 block"
                          >
                            <GarmentArtwork
                              product={prod}
                              className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                            />
                          </Link>

                          <div className="min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                              <Link
                                href={pdpHref}
                                className="text-[11.5px] leading-snug font-bold text-[#22131A] hover:text-[#B83B6A] truncate"
                              >
                                {formatCompactProductTitle(prod, 22)}
                              </Link>
                              <span className="font-editorial text-sm font-bold text-[#22131A] shrink-0">
                                ${prod.price}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-1 mt-0.5">
                              <span className="text-[10px] font-medium text-[#745C67] truncate">
                                {prod.colorName}
                              </span>
                              <Link
                                href={pdpHref}
                                className="text-[9.5px] font-bold text-[#B83B6A] hover:underline shrink-0"
                              >
                                Page →
                              </Link>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 pt-0.5">
                          <button
                            type="button"
                            onClick={(ev) => {
                              const cardEl = ev.currentTarget.closest("article");
                              launchFlyToBag(cardEl, prod.imageUrl);
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
                            }}
                            className="flex-1 py-1.5 px-2.5 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#962953] hover:brightness-105 text-white text-[10.5px] font-bold cursor-pointer min-h-[28px]"
                          >
                            + Add to Bag
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSwapPieceInOutfit(slotIdx, prod)}
                            className="p-1.5 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-[#962953] cursor-pointer min-w-[28px] min-h-[28px] inline-flex items-center justify-center"
                            title="Swap piece on avatar"
                            aria-label={`Swap ${prod.title}`}
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Scroll-to-Full-Boutique Storefront Cue */}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("gwo-ecomm-storefront")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="w-full py-2.5 px-4 rounded-2xl bg-white hover:bg-[#FCECF3] border border-[#EBD2DE] text-xs font-bold text-[#962953] flex items-center justify-between transition cursor-pointer shrink-0 shadow-xs"
              >
                <span>
                  Browse Full Boutique Store ({boutiqueCatalog.length} Dresses, Tops, Skirts &amp; Heels)
                </span>
                <span className="inline-flex items-center gap-1 text-[#B83B6A]">
                  Shop Below <ArrowDown className="w-3.5 h-3.5" />
                </span>
              </button>
            </>
          )}
        </aside>
      </main>

      {/* ==================== FULL E-COMMERCE CLOTHING STOREFRONT + 1-FOR-1 SPIN-PRODUCT SHOWCASE ==================== */}
      <MotionSitesBoutiqueStorefront
        catalog={boutiqueCatalog}
        outfits={runwayOutfits}
        ownedIds={ownedIds}
        onTryPieceOnRunway={(prod) => {
          const matchOutfitIdx = runwayOutfits.findIndex((o) =>
            o.pieces.some((p) => p.product.id === prod.id)
          );
          if (matchOutfitIdx >= 0) {
            jumpLookRef.current?.(matchOutfitIdx);
            showToast(`Trying "${prod.title}" on your Runway!`);
          } else if (rawActiveOutfit) {
            const slotIdx = Math.max(
              0,
              rawActiveOutfit.pieces.findIndex(
                (p) => p.product.category === prod.category
              )
            );
            setSwappedPieceBySlot((prev) => ({
              ...prev,
              [`${rawActiveOutfit.id}:${slotIdx}`]: prod,
            }));
            showToast(`Styled "${prod.title}" onto your Runway Avatar!`);
          }
        }}
        onJumpToOutfitOnRunway={(outfitIdx) => {
          if (browseMode !== "outfits") {
            setBrowseMode("outfits");
            setTimeout(() => jumpLookRef.current?.(outfitIdx), 40);
          } else {
            jumpLookRef.current?.(outfitIdx);
          }
        }}
      />

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
                  className="px-3 py-1.5 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-xs font-bold text-[#962953] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#B83B6A]" /> Paste URL
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
                        ? "border-[#B83B6A] ring-2 ring-[#B83B6A]/20 bg-[#FDF2F7]"
                        : "border-[#ECD7E1] bg-white hover:bg-[#FFFBFD]"
                    }`}
                  >
                    <div>
                      <div className="h-28 rounded-xl bg-white border border-black/[0.05] overflow-hidden mb-1.5 relative">
                        <GarmentArtwork product={prod} className="w-full h-full" />
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#B83B6A] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-snug font-bold text-[#22131A] line-clamp-2">
                        {formatCompactProductTitle(prod, 24)}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[#962953]">
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

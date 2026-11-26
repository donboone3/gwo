"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Columns2,
  Images,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import "./spin-product.css";
import { H, SIGNATURE_BADGE_URL, STUDIO_LOOKS } from "../vell/vell-data";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { useGwo } from "@/context/GwoAppContext";
import {
  analyzeExactAvatarFit,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import { build3DOutfitForClosetLook } from "@/lib/catalog/closet-look-3d-mapper";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const STAGE_W = 540;
const STAGE_H = 900;

const BITMAP_CACHE = new Map<string, ImageBitmap>();

const HOTSPOTS = [
  {
    x: 0.5,
    y: 0.31,
    title: "Two-way zip collar",
    text: "Sculpted two-way zip up to a cozy stand collar that blocks wind without feeling stiff.",
  },
  {
    x: 0.37,
    y: 0.37,
    title: "Contour finish",
    text: "Subtle tonal topographic weave with soft matte-silver sheen.",
  },
  {
    x: 0.63,
    y: 0.44,
    title: "Fleece pockets",
    text: "Deep fleece-lined pockets angled naturally at waist height.",
  },
];

const SIZES = ["XS", "S", "M", "L"] as const;

const wrap1 = (a: number) => ((a % 1) + 1) % 1;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function buildDefaultTurntableProduct(name: string, price: number): Product {
  return {
    id: "studio-contour-puffer",
    canonicalUrl: "https://goodwithonline.com/product",
    brand: "GWO Studio",
    storeDomain: "goodwithonline.com",
    title: name,
    category: "outerwear",
    silhouette: "cropped-jacket",
    colorName: "Metallic Silver",
    colorHex: "#C9CED6",
    accentHex: "#141518",
    price,
    currency: "USD",
    imageUrl: `${BASE_PATH}/models/signature/spin_0.webp`,
    fitMetadata: {
      descriptionSummary:
        "Relaxed, slightly cropped metallic puffer designed to hit cleanly right at high-waisted denim or leggings with a sculpted stand collar and two-way zip.",
      fitNotes: [
        "Boxy cropped outerwear cut—hits right at natural waist",
        "Elasticated hem seals warmth without riding up",
        "Fits true to size with room to layer hoodies underneath",
      ],
      fabricComposition: "100% Recycled Ripstop Nylon • 80/20 Down Fill",
      stretchLevel: "rigid",
      cutType: "oversized",
      storeFitTendency: "true_to_size",
      hemLanding: "cropped",
      modelStats: {
        rawText:
          "Studio 360° Avatar is 5'2\" wearing Size S (32.25\" B • 27\" W • 34\" H)",
        heightInches: 62,
        heightDisplay: "5'2\"",
        wornSize: "S",
        bustInches: 32.25,
        waistInches: 27,
        hipsInches: 34,
      },
    },
    occasions: ["Everyday", "Outerwear"],
    vibes: ["Model Off-Duty"],
    availableSizes: ["XS", "S", "M", "L"],
    sizeChartInches: {
      XS: {
        bustMin: 31,
        bustMax: 33,
        waistMin: 24.5,
        waistMax: 26,
        hipsMin: 34,
        hipsMax: 36,
      },
      S: {
        bustMin: 33,
        bustMax: 35.5,
        waistMin: 26,
        waistMax: 28.5,
        hipsMin: 36,
        hipsMax: 38.5,
      },
      M: {
        bustMin: 35.5,
        bustMax: 38,
        waistMin: 28.5,
        waistMax: 31,
        hipsMin: 38.5,
        hipsMax: 41,
      },
      L: {
        bustMin: 38,
        bustMax: 41,
        waistMin: 31,
        waistMax: 34,
        hipsMin: 41,
        hipsMax: 44,
      },
    },
    estDeliveryDays: 3,
    inStock: true,
    sourceType: "affiliate_feed",
    lastScrapedAt: "",
    staleAfter: "",
  };
}

function getZoneBadgeStyle(feel: ZoneFeel): string {
  if (feel === "too_tight") {
    return "bg-[#FDECEB] text-[#9E2A22] border-[#F5C6C2]";
  }
  if (feel === "sculpted_snug") {
    return "bg-[#FEF6E6] text-[#8A5808] border-[#F4DFB4]";
  }
  if (feel === "tailored_ideal") {
    return "bg-[#E7F3EE] text-[#1D4232] border-[#C1DFD0]";
  }
  if (feel === "relaxed_skim") {
    return "bg-[#EEF2F7] text-[#263445] border-[#D5DFEC]";
  }
  return "bg-[#F1EFFA] text-[#45357A] border-[#DCD6F2]";
}

function getZoneBarColor(feel: ZoneFeel): string {
  if (feel === "too_tight") return "#D94336";
  if (feel === "sculpted_snug") return "#D98A1C";
  if (feel === "tailored_ideal") return "#244B3B";
  if (feel === "relaxed_skim") return "#355C7D";
  return "#5E4B9E";
}

function drawBitmapContainedBottom(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap
) {
  if (bmp.width === STAGE_W && bmp.height === STAGE_H) {
    ctx.drawImage(bmp, 0, 0, STAGE_W, STAGE_H);
    return;
  }
  const scale = Math.min(STAGE_W / bmp.width, (STAGE_H * 0.96) / bmp.height);
  const dw = bmp.width * scale;
  const dh = bmp.height * scale;
  const dx = (STAGE_W - dw) / 2;
  const dy = STAGE_H - dh - 8;
  ctx.drawImage(bmp, dx, dy, dw, dh);
}

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const lookParam = searchParams.get("look");
  const rawName = searchParams.get("name") || "Contour Metallic Cropped Puffer";
  const rawPriceStr = searchParams.get("price") || "$168";
  const parsedPrice = Number(rawPriceStr.replace(/[^0-9.]/g, "")) || 168;

  const {
    user,
    products,
    activeImportedProduct,
    setAddUrlModalOpen,
    addToBag,
    openDropshipCheckout,
    showToast,
    customAvatar,
    setAvatarModalOpen,
  } = useGwo();

  const [selectedPickerVal, setSelectedPickerVal] = useState<string>(
    "studio-contour-puffer"
  );
  const [selectedQuickProduct, setSelectedQuickProduct] =
    useState<Product | null>(null);
  const [outfitPieces, setOutfitPieces] = useState<Product[]>([]);
  const [selectedLookIdx, setSelectedLookIdx] = useState<number | undefined>(
    undefined
  );

  const resolveOutfitProducts = useCallback(
    (lkIdx: number) => {
      const lk = STUDIO_LOOKS[lkIdx] || STUDIO_LOOKS[0];
      if (lk.relatedProductIds && lk.relatedProductIds.length > 0) {
        const matched = lk.relatedProductIds
          .map((id) => products.find((p) => p.id === id))
          .filter((p): p is Product => Boolean(p));
        if (matched.length > 0) {
          return { primary: matched[0], allPieces: matched, index: lk.index };
        }
      }
      const mapped = build3DOutfitForClosetLook(lk, products);
      return {
        primary: mapped.primaryProduct,
        allPieces: [mapped.primaryProduct, ...mapped.companionProducts],
        index: lk.index,
      };
    },
    [products]
  );

  // Sync URL query (?id=... or ?look=...) into outfit picker
  useEffect(() => {
    if (lookParam !== null) {
      const resolved = resolveOutfitProducts(Number(lookParam));
      setSelectedPickerVal(`closet-look:${resolved.index}`);
      setSelectedLookIdx(resolved.index);
      setSelectedQuickProduct(resolved.primary);
      setOutfitPieces(resolved.allPieces);
      return;
    }
    if (queryId) {
      const found =
        (activeImportedProduct?.id === queryId ? activeImportedProduct : null) ||
        products.find((p) => p.id === queryId) ||
        null;
      if (found) {
        setSelectedPickerVal(found.id);
        setSelectedLookIdx(found.studioLookIndex);
        setSelectedQuickProduct(found);
        setOutfitPieces([found]);
        return;
      }
    }
    setSelectedPickerVal("studio-contour-puffer");
    setSelectedLookIdx(undefined);
    setSelectedQuickProduct(null);
    setOutfitPieces([]);
  }, [activeImportedProduct, lookParam, products, queryId, resolveOutfitProducts]);

  const selectOutfitOrProduct = useCallback(
    (val: string) => {
      setSelectedPickerVal(val);
      if (val === "studio-contour-puffer") {
        setSelectedQuickProduct(null);
        setOutfitPieces([]);
        setSelectedLookIdx(undefined);
        return;
      }
      if (val.startsWith("closet-look:")) {
        const lkIdx = Number(val.split(":")[1] || 0);
        const resolved = resolveOutfitProducts(lkIdx);
        setSelectedLookIdx(resolved.index);
        setSelectedQuickProduct(resolved.primary);
        setOutfitPieces(resolved.allPieces);
        return;
      }
      const found = products.find((p) => p.id === val);
      if (found) {
        setSelectedLookIdx(found.studioLookIndex);
        setSelectedQuickProduct(found);
        setOutfitPieces([found]);
      }
    },
    [products, resolveOutfitProducts]
  );

  const activeProduct: Product = useMemo(
    () =>
      selectedQuickProduct ||
      buildDefaultTurntableProduct(rawName, parsedPrice),
    [parsedPrice, rawName, selectedQuickProduct]
  );

  // Resolve 100% lifelike studio avatar photos (Front 0°, Side 90°, Back 180°, Spin Frames) — ZERO wireframes!
  const lifelikePhotos = useMemo(
    () =>
      resolveLifelikeAvatarPhotos({
        product: activeProduct,
        lookIndex: selectedLookIdx,
      }),
    [activeProduct, selectedLookIdx]
  );

  const spinFrameUrls = useMemo(() => {
    if (activeProduct.id === "studio-contour-puffer") {
      return Array.from(
        { length: 8 },
        (_, i) => `${BASE_PATH}/models/signature/spin_${i}.webp`
      );
    }
    const f = lifelikePhotos.frontUrl;
    const s = lifelikePhotos.sideUrl || f;
    const b = lifelikePhotos.backUrl || f;
    // 8-slot smooth turnaround cycle: Front -> 45° -> Side -> 135° -> Back 180° -> 225° -> Side -> 315°
    return [f, f, s, b, b, b, s, f];
  }, [activeProduct.id, lifelikePhotos]);

  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;
  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;

  const baseFitReport = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          bustInches: activeBust,
          waistInches: activeWaist,
          hipsInches: activeHips,
          heightInches: activeHeight,
          shoeSize: user?.shoeSize || "7.5",
        },
        activeProduct
      ),
    [
      activeBust,
      activeHeight,
      activeHips,
      activeProduct,
      activeWaist,
      user?.shoeSize,
    ]
  );

  const [selectedSize, setSelectedSize] = useState<string>(
    baseFitReport.recommendedSize
  );

  useEffect(() => {
    setSelectedSize(baseFitReport.recommendedSize);
  }, [baseFitReport.recommendedSize, activeProduct.id]);

  const liveFitReport = useMemo(
    () =>
      analyzeExactAvatarFit(
        {
          bustInches: activeBust,
          waistInches: activeWaist,
          hipsInches: activeHips,
          heightInches: activeHeight,
          shoeSize: user?.shoeSize || "7.5",
        },
        activeProduct,
        selectedSize
      ),
    [
      activeBust,
      activeHeight,
      activeHips,
      activeProduct,
      activeWaist,
      selectedSize,
      user?.shoeSize,
    ]
  );

  const [stageDisplayMode, setStageDisplayMode] = useState<
    "spin" | "split" | "photo"
  >("spin");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const userFaceRef = useRef<HTMLImageElement | null>(null);
  const degDotRef = useRef<HTMLSpanElement | null>(null);
  const degNumRef = useRef<HTMLSpanElement | null>(null);
  const addBagBtnRef = useRef<HTMLButtonElement | null>(null);
  const spinToFnRef = useRef<((targetAng: number) => void) | null>(null);

  const [openSection, setOpenSection] = useState<string>("Fit & Description");
  const [savedToCloset, setSavedToCloset] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const [facingFront, setFacingFront] = useState(true);
  const [activeAngleTab, setActiveAngleTab] = useState<"front" | "side" | "back">(
    "front"
  );
  const [isDraggingUi, setIsDraggingUi] = useState(false);

  // Universal Lifelike Avatar 360° Drag-to-Spin Turntable Engine
  useEffect(() => {
    if (stageDisplayMode !== "spin") return;
    const cv = cvRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!cv || !stage || !root) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const N = spinFrameUrls.length;
    const frames: Array<ImageBitmap | null> = new Array(N).fill(null);

    let ang = 0;
    let vel = 0;
    let idle = 0;
    let dragging = false;
    let lastX = 0;
    let lastMoveTime = 0;
    let estV = 0;

    let tween: {
      startAng: number;
      delta: number;
      startTime: number;
      duration: number;
    } | null = null;

    let lastPaintedKey = "";

    const updateFaceOverlayTransform = (norm: number) => {
      const faceEl = userFaceRef.current;
      if (!faceEl) return;
      const signedTurn = norm > 0.5 ? norm - 1 : norm;
      const absTurn = Math.abs(signedTurn);
      if (absTurn > 0.11) {
        faceEl.style.opacity = "0";
        return;
      }
      const theta = signedTurn * Math.PI * 2;
      const cosT = Math.max(0.25, Math.cos(theta));
      const shiftPx = -Math.sin(theta) * 14;
      const fade = Math.pow(Math.max(0, 1 - absTurn / 0.11), 1.4);
      faceEl.style.opacity = fade.toFixed(3);
      faceEl.style.transform = `translate3d(calc(-50% + ${shiftPx.toFixed(
        1
      )}px), -50%, 0) scaleX(${cosT.toFixed(3)})`;
    };

    const showFrame = (a: number) => {
      const norm = wrap1(a);
      updateFaceOverlayTransform(norm);

      const exactPos = norm * N;
      const i0 = Math.floor(exactPos) % N;
      const i1 = (i0 + 1) % N;
      const frac = exactPos - Math.floor(exactPos);

      const bmp0 = frames[i0] || frames[0];
      const bmp1 = frames[i1] || bmp0;
      if (!bmp0) return;

      const qFrac = Math.round(frac * 12) / 12;
      const key = `${spinFrameUrls[0]}:${i0}:${i1}:${qFrac}`;
      if (key === lastPaintedKey) return;
      lastPaintedKey = key;

      ctx.clearRect(0, 0, STAGE_W, STAGE_H);

      // Subtle floor shadow under transparent RGBA cutouts
      if (bmp0.width !== STAGE_W) {
        const grad = ctx.createRadialGradient(
          STAGE_W / 2,
          STAGE_H - 18,
          12,
          STAGE_W / 2,
          STAGE_H - 18,
          135
        );
        grad.addColorStop(0, "rgba(25, 26, 30, 0.28)");
        grad.addColorStop(1, "rgba(25, 26, 30, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(STAGE_W / 2, STAGE_H - 16, 135, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (bmp1 && bmp1 !== bmp0 && qFrac > 0.04) {
        ctx.globalAlpha = 1 - qFrac;
        drawBitmapContainedBottom(ctx, bmp0);
        ctx.globalAlpha = qFrac;
        drawBitmapContainedBottom(ctx, bmp1);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 1;
        drawBitmapContainedBottom(ctx, bmp0);
      }
    };

    const loadSpinFrames = async () => {
      const loadIndex = async (idx: number) => {
        const url = spinFrameUrls[idx];
        const cached = BITMAP_CACHE.get(url);
        if (cached) {
          frames[idx] = cached;
          return;
        }
        const im = new Image();
        im.decoding = "async";
        im.src = url;
        await im.decode();
        if (cancelled) return;
        const bmp = await createImageBitmap(im);
        BITMAP_CACHE.set(url, bmp);
        frames[idx] = bmp;
      };

      try {
        await loadIndex(0);
        if (cancelled) return;
        lastPaintedKey = "";
        showFrame(ang);

        const restIndices = Array.from({ length: N - 1 }, (_, k) => k + 1);
        void Promise.all(restIndices.map((idx) => loadIndex(idx))).then(() => {
          if (cancelled) return;
          lastPaintedKey = "";
          showFrame(ang);
        });
      } catch {
        // Ignore transient decode error
      }
    };

    void loadSpinFrames();

    const spinTo = (targetA: number) => {
      const curr = wrap1(ang);
      let delta = wrap1(targetA) - curr;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      vel = 0;
      idle = 0;
      tween = {
        startAng: curr,
        delta,
        startTime: performance.now(),
        duration: 620 + Math.abs(delta) * 620,
      };
    };
    spinToFnRef.current = spinTo;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".sp-hs")) return;
      dragging = true;
      setIsDraggingUi(true);
      tween = null;
      vel = 0;
      estV = 0;
      idle = 0;
      lastX = e.clientX;
      lastMoveTime = performance.now();
      stage.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      idle = 0;
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dtMs = Math.max(8, now - lastMoveTime);
      lastX = e.clientX;
      lastMoveTime = now;

      const dAng = -dx / 520;
      ang = wrap1(ang + dAng);
      estV = ((dAng / dtMs) * 1000) * 0.6 + estV * 0.4;
      showFrame(ang);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDraggingUi(false);
      vel = clamp(estV, -2.0, 2.0);
      idle = 0;
    };

    const resetIdle = () => {
      if (!dragging) idle = 0;
    };

    stage.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("pointermove", resetIdle, { passive: true });

    let lastTick = performance.now();
    let rafId = 0;
    let prevFront = true;
    let prevDeg = -1;
    let prevTab: "front" | "side" | "back" = "front";

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      if (tween) {
        const t = clamp((now - tween.startTime) / tween.duration, 0, 1);
        ang = wrap1(tween.startAng + tween.delta * easeInOutCubic(t));
        if (t >= 1) tween = null;
        showFrame(ang);
      } else if (!dragging) {
        idle += dtSec;
        const targetSpeed = idle > 3.5 ? 0.042 : 0;
        const easeRate = idle > 3.5 ? dtSec * 0.8 : dtSec * 3.2;
        vel += (targetSpeed - vel) * Math.min(1, easeRate);
        if (Math.abs(vel) > 0.00005) {
          ang = wrap1(ang + vel * dtSec);
          showFrame(ang);
        }
      }

      const norm = wrap1(ang);
      const deg = Math.round(norm * 360) % 360;
      if (deg !== prevDeg) {
        prevDeg = deg;
        if (degNumRef.current) {
          degNumRef.current.textContent = `${String(deg).padStart(3, "0")}°`;
        }
        if (degDotRef.current) {
          degDotRef.current.style.left = `${(norm * 100).toFixed(1)}%`;
        }
      }

      const nextFront =
        (norm <= 0.05 || norm >= 0.95) &&
        !dragging &&
        !tween &&
        Math.abs(vel) < 0.02;
      if (nextFront !== prevFront) {
        prevFront = nextFront;
        setFacingFront(nextFront);
      }

      const nextTab: "front" | "side" | "back" =
        norm < 0.16 || norm >= 0.84
          ? "front"
          : norm >= 0.36 && norm <= 0.64
          ? "back"
          : "side";
      if (nextTab !== prevTab) {
        prevTab = nextTab;
        setActiveAngleTab(nextTab);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stage.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("pointermove", resetIdle);
    };
  }, [spinFrameUrls, stageDisplayMode]);

  const handleAddToBag = useCallback(
    (buyNow = false) => {
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1600);

      addToBag({
        productId: activeProduct.id,
        title: activeProduct.title,
        brand: activeProduct.brand || "GWO Boutique",
        price: activeProduct.price,
        size: selectedSize,
        imageUrl: activeProduct.imageUrl || lifelikePhotos.frontUrl,
        avatarFrontUrl: lifelikePhotos.frontUrl,
        avatarBackUrl: lifelikePhotos.backUrl,
      });

      if (buyNow) {
        openDropshipCheckout("checkout");
      }
    },
    [
      activeProduct,
      addToBag,
      lifelikePhotos.backUrl,
      lifelikePhotos.frontUrl,
      openDropshipCheckout,
      selectedSize,
    ]
  );

  const avatarHeightDisp = `${Math.floor(activeHeight / 12)}'${Math.round(
    activeHeight % 12
  )}"`;

  return (
    <div className="sp-root" ref={rootRef}>
      <div className="max-w-[1520px] mx-auto min-h-[calc(100svh-64px)] lg:h-full px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-[356px_minmax(0,1fr)_356px] xl:grid-cols-[406px_minmax(0,1fr)_406px] gap-3.5 sm:gap-4 items-stretch">
        {/* ==================== LEFT CARD: OUTFIT PICKER, FIT NOTES & ANGLE TABS ==================== */}
        <section className="order-3 lg:order-1 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-xs font-semibold text-[#141518]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Closet
              </Link>

              <button
                type="button"
                onClick={() => setAddUrlModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EC] text-xs font-bold text-[#141518] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Outfit / Link
              </button>
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7F3EE] text-[#244B3B]">
                <Sparkles className="w-3 h-3" /> {activeProduct.brand} •{" "}
                {liveFitReport.confidencePct}% Fit Confidence
              </span>

              <h1 className="text-lg sm:text-xl font-bold text-[#141518] mt-2 leading-snug">
                {activeProduct.title}
              </h1>
              <p className="text-base sm:text-lg font-bold text-[#141518] mt-0.5">
                ${activeProduct.price}
              </p>
            </div>

            {/* Visual Outfit Picker Strip + Full Dropdown (Pick Any Outfit to View in 360°!) */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <label
                htmlFor="gwo-product-360-picker"
                className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B] flex items-center gap-1.5"
              >
                <Rotate3d className="w-3.5 h-3.5" /> Pick Any Outfit to View in 360°
              </label>

              {/* Quick Visual Avatar Thumbnail Carousel */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => selectOutfitOrProduct("studio-contour-puffer")}
                  className={`shrink-0 w-12 h-16 rounded-xl overflow-hidden border transition cursor-pointer bg-white ${
                    selectedPickerVal === "studio-contour-puffer"
                      ? "border-[#141518] ring-2 ring-[#141518]/20"
                      : "border-black/10 opacity-85 hover:opacity-100"
                  }`}
                  title="Contour Metallic Cropped Puffer (8-Angle Spin)"
                >
                  <img
                    src={`${BASE_PATH}/models/signature/spin_0.webp`}
                    alt="Puffer"
                    className="w-full h-full object-cover object-top"
                  />
                </button>
                {STUDIO_LOOKS.map((lk) => {
                  const key = `closet-look:${lk.index}`;
                  const active = selectedPickerVal === key;
                  return (
                    <button
                      key={lk.index}
                      type="button"
                      onClick={() => selectOutfitOrProduct(key)}
                      className={`shrink-0 w-12 h-16 rounded-xl overflow-hidden border transition cursor-pointer bg-white ${
                        active
                          ? "border-[#141518] ring-2 ring-[#141518]/20"
                          : "border-black/10 opacity-85 hover:opacity-100"
                      }`}
                      title={lk.name}
                    >
                      <img
                        src={H(lk.file, 260)}
                        alt={lk.name}
                        className="w-full h-full object-contain object-bottom"
                      />
                    </button>
                  );
                })}
              </div>

              <select
                id="gwo-product-360-picker"
                value={selectedPickerVal}
                onChange={(e) => selectOutfitOrProduct(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold text-[#141518] focus:outline-none focus:border-[#141518]"
              >
                <option value="studio-contour-puffer">
                  Studio 360° Turntable: Contour Metallic Cropped Puffer
                </option>
                <optgroup label="Closet & AI Runway Outfits (Lifelike 360°)">
                  {STUDIO_LOOKS.map((lk) => (
                    <option key={lk.index} value={`closet-look:${lk.index}`}>
                      Outfit #{lk.index + 1}: {lk.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Single Boutique Pieces">
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.brand} — {prod.title} (${prod.price})
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Multi-Piece Selector when inspecting a multi-piece Outfit */}
              {outfitPieces.length > 1 && (
                <div className="pt-1 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#686D76]">
                    Inspect Piece Measurements in This Outfit:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {outfitPieces.map((piece) => {
                      const active = activeProduct.id === piece.id;
                      return (
                        <button
                          key={piece.id}
                          type="button"
                          onClick={() => setSelectedQuickProduct(piece)}
                          className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border cursor-pointer transition ${
                            active
                              ? "bg-[#141518] text-white border-[#141518]"
                              : "bg-white text-[#141518] border-black/10 hover:bg-[#EAECEF]"
                          }`}
                        >
                          {piece.title} (${piece.price})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Store Model vs Your Avatar Proportion Box */}
            <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" /> Garment vs Your{" "}
                  {avatarHeightDisp} Frame
                </span>
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-black/[0.08] text-[11px] font-bold text-[#244B3B] hover:bg-[#EBF3EE] cursor-pointer"
                >
                  <img
                    src={
                      customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL
                    }
                    alt=""
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                  {avatarHeightDisp} Avatar
                </button>
              </div>
              <p className="text-xs font-semibold text-[#141518]">
                {liveFitReport.lengthComparison.modelSummary}
              </p>
              <p className="text-xs text-[#686D76] leading-relaxed">
                {liveFitReport.lengthComparison.proportionNote}
              </p>
            </div>

            {/* Fit & Fabric Accordion */}
            <div className="divide-y divide-black/[0.07] border-t border-b border-black/[0.07]">
              {[
                {
                  id: "Fit & Description",
                  body: (
                    <div className="space-y-2">
                      {activeProduct.fitMetadata?.descriptionSummary && (
                        <p className="text-xs text-[#5C6068] leading-relaxed">
                          {activeProduct.fitMetadata.descriptionSummary}
                        </p>
                      )}
                      {(activeProduct.fitMetadata?.fitNotes?.length || 0) > 0 && (
                        <ul className="space-y-1">
                          {activeProduct.fitMetadata!.fitNotes.map((note) => (
                            <li
                              key={note}
                              className="text-[11px] text-[#141518] flex items-start gap-1.5"
                            >
                              <span className="text-[#244B3B] font-bold">•</span>
                              <span>{note}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ),
                },
                {
                  id: "Fabric & Stretch Physics",
                  body: (
                    <p className="text-xs text-[#5C6068] leading-relaxed">
                      {liveFitReport.fabricSummary}
                    </p>
                  ),
                },
              ].map((row) => {
                const open = openSection === row.id;
                return (
                  <div key={row.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSection(open ? "" : row.id)}
                      className="w-full py-2.5 flex items-center justify-between text-xs font-bold text-[#141518] cursor-pointer"
                    >
                      <span>{row.id}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#686D76] transition-transform ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {open && <div className="pb-3">{row.body}</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pinned Quick 360° Lifelike Angle Buttons */}
          <div className="shrink-0 flex items-center gap-1.5 pt-2 border-t border-black/[0.06]">
            <button
              type="button"
              onClick={() => {
                setStageDisplayMode("spin");
                setActiveAngleTab("front");
                setTimeout(() => spinToFnRef.current?.(0), 20);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                stageDisplayMode === "spin" && activeAngleTab === "front"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={lifelikePhotos.frontUrl}
                alt="Front"
                className="w-5 h-5 rounded-md object-cover object-top"
              />
              Front
            </button>

            <button
              type="button"
              onClick={() => {
                setStageDisplayMode("spin");
                setActiveAngleTab("side");
                setTimeout(() => spinToFnRef.current?.(0.25), 20);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                stageDisplayMode === "spin" && activeAngleTab === "side"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={lifelikePhotos.sideUrl}
                alt="Side"
                className="w-5 h-5 rounded-md object-cover object-top"
              />
              Side
            </button>

            <button
              type="button"
              onClick={() => {
                setStageDisplayMode("spin");
                setActiveAngleTab("back");
                setTimeout(() => spinToFnRef.current?.(0.5), 20);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                stageDisplayMode === "spin" && activeAngleTab === "back"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={lifelikePhotos.backUrl}
                alt="Back"
                className="w-5 h-5 rounded-md object-cover object-top"
              />
              Back
            </button>
          </div>
        </section>

        {/* ==================== CENTER COLUMN: LIFELIKE 360° TURNTABLE & FRONT+BACK STAGE ==================== */}
        <div className="order-1 lg:order-2 min-w-0 h-auto lg:h-full lg:min-h-0 flex flex-col items-center justify-between gap-2">
          {/* Top Lifelike Mode Switcher Pill (100% Real Avatar Photos — Zero Wireframes!) */}
          <div className="shrink-0 flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs z-20">
            <button
              type="button"
              id="gwo-stage-tab-spin"
              onClick={() => setStageDisplayMode("spin")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "spin"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Rotate3d className="w-3.5 h-3.5 text-[#A7D7C5]" /> 360° Spin
            </button>
            <button
              type="button"
              id="gwo-stage-tab-split"
              onClick={() => setStageDisplayMode("split")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "split"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" /> Front + Back
            </button>
            <button
              type="button"
              id="gwo-stage-tab-photo"
              onClick={() => setStageDisplayMode("photo")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                stageDisplayMode === "photo"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
            >
              <Images className="w-3.5 h-3.5" /> Garment Detail
            </button>
          </div>

          {/* MODE 1: ICONIC 360° DRAG-TO-SPIN LIFELIKE AVATAR TURNTABLE */}
          {stageDisplayMode === "spin" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 flex flex-col items-center justify-between gap-2">
              <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
                <div
                  id="sp-stage"
                  ref={stageRef}
                  className={isDraggingUi ? "dragging" : ""}
                >
                  <canvas
                    id="sp-cv"
                    ref={cvRef}
                    width={STAGE_W}
                    height={STAGE_H}
                  />

                  {customAvatar && (
                    <img
                      ref={userFaceRef}
                      src={customAvatar.faceOvalDataUrl}
                      alt="Your photo avatar"
                      decoding="async"
                      style={{
                        position: "absolute",
                        left: "50.0%",
                        top: "12.4%",
                        width: "13.0%",
                        height: "9.8%",
                        transform: "translate3d(-50%, -50%, 0)",
                        willChange: "transform, opacity",
                        pointerEvents: "none",
                        zIndex: 18,
                      }}
                    />
                  )}

                  {activeProduct.id === "studio-contour-puffer" &&
                    HOTSPOTS.map((hs, idx) => (
                      <button
                        key={hs.title}
                        type="button"
                        className={`sp-hs ${facingFront ? "show" : ""}`}
                        style={{
                          left: `${hs.x * 100}%`,
                          top: `${hs.y * 100}%`,
                          transitionDelay: facingFront ? `${idx * 0.08}s` : "0s",
                        }}
                        aria-label={hs.title}
                      >
                        <span>+</span>
                        <span
                          className={`sp-tip ${hs.x > 0.5 ? "right" : "left"}`}
                        >
                          <span className="sp-tip-title">{hs.title}</span>
                          {hs.text}
                        </span>
                      </button>
                    ))}
                </div>
              </div>

              <div id="sp-deg" className="shrink-0">
                <span>DRAG MODEL TO SPIN 360°</span>
                <span className="sp-deg-bar">
                  <span
                    ref={degDotRef}
                    className="sp-deg-dot"
                    style={{ left: "0%" }}
                  />
                </span>
                <span ref={degNumRef} className="sp-deg-num">
                  000°
                </span>
              </div>
            </div>
          )}

          {/* MODE 2: SIDE-BY-SIDE LIFELIKE FRONT 0° + BACK 180° STUDIO PHOTOS */}
          {stageDisplayMode === "split" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 rounded-3xl bg-white/85 backdrop-blur-md border border-black/[0.08] p-3 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 min-h-0 grid grid-cols-2 gap-2.5">
                <div className="relative h-full rounded-2xl bg-gradient-to-b from-[#F5F6F9] to-[#E6E9EF] flex items-center justify-center overflow-hidden pt-6 pb-1 px-1">
                  <img
                    src={lifelikePhotos.frontUrl}
                    alt="Front 0° Avatar Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10.5px] font-bold">
                    Front 0°
                  </span>
                </div>
                <div className="relative h-full rounded-2xl bg-gradient-to-b from-[#F5F6F9] to-[#E6E9EF] flex items-center justify-center overflow-hidden pt-6 pb-1 px-1">
                  <img
                    src={lifelikePhotos.backUrl}
                    alt="Back 180° Avatar Look"
                    className="h-full w-full object-contain object-bottom"
                  />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10.5px] font-bold">
                    Back 180°
                  </span>
                </div>
              </div>
              <div className="shrink-0 pt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#141518]">
                  {avatarHeightDisp} Lifelike Avatar • Simulating Size{" "}
                  {selectedSize}
                </span>
                <div className="flex flex-wrap gap-1">
                  {liveFitReport.zones.map((z) => (
                    <span
                      key={z.zone}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getZoneBadgeStyle(
                        z.feel
                      )}`}
                    >
                      {z.zone}: {z.feelLabel}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MODE 3: GARMENT PRODUCT PHOTO */}
          {stageDisplayMode === "photo" && (
            <div className="w-full h-[460px] lg:flex-1 lg:min-h-0 rounded-3xl bg-white border border-black/[0.08] overflow-hidden flex flex-col justify-between">
              <div className="flex-1 min-h-0 bg-[#F6F7F9] flex items-center justify-center overflow-hidden p-4">
                <GarmentArtwork product={activeProduct} className="w-full h-full" />
              </div>
              <div className="shrink-0 px-4 py-2.5 bg-white border-t border-black/[0.06] flex items-center justify-between text-xs font-bold text-[#141518]">
                <span>{activeProduct.title}</span>
                <span className="text-[#244B3B]">
                  Recommended: Size {liveFitReport.recommendedSize}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ==================== RIGHT CARD: EXACT-FIT ZONE SIMULATOR & RETAIL CHECKOUT ==================== */}
        <section className="order-2 lg:order-3 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3">
            {/* Avatar Measurements Header */}
            <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#141518] inline-flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" /> Avatar Measurements
                </span>
                <span className="text-[11px] font-bold text-[#244B3B]">
                  Best Match: Size {liveFitReport.recommendedSize}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                    Height
                  </p>
                  <p className="text-xs font-bold text-[#141518]">{avatarHeightDisp}</p>
                </div>
                <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                    Bust
                  </p>
                  <p className="text-xs font-bold text-[#141518]">{activeBust}&quot;</p>
                </div>
                <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                    Waist
                  </p>
                  <p className="text-xs font-bold text-[#141518]">{activeWaist}&quot;</p>
                </div>
                <div className="py-1.5 px-1.5 rounded-xl bg-white border border-black/[0.06]">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-[#686D76]">
                    Hips
                  </p>
                  <p className="text-xs font-bold text-[#141518]">{activeHips}&quot;</p>
                </div>
              </div>
            </div>

            {/* Interactive Size Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#141518]">
                  Simulate Size on You
                </span>
                <span className="text-[11px] font-semibold text-[#686D76]">
                  See where it fits or pinches
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {SIZES.map((sz) => {
                  const active = selectedSize === sz;
                  const isBest = liveFitReport.recommendedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`relative py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        active
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#141518] border-black/[0.06]"
                      }`}
                    >
                      {sz}
                      {isBest && (
                        <span
                          className={`block text-[9px] font-bold leading-none mt-0.5 ${
                            active ? "text-[#A7D7C5]" : "text-[#244B3B]"
                          }`}
                        >
                          Best Fit
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Zone-by-Zone Ease & Tension Meters */}
            {liveFitReport.zones.length > 0 && (
              <div className="space-y-2">
                {liveFitReport.zones.map((z) => (
                  <div
                    key={z.zone}
                    className="p-2.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.05] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#141518]">
                        {z.zone}{" "}
                        <span className="text-[11px] font-normal text-[#686D76]">
                          ({z.avatarInches}&quot; vs {z.garmentRange})
                        </span>
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getZoneBadgeStyle(
                          z.feel
                        )}`}
                      >
                        {z.feelLabel}
                      </span>
                    </div>

                    <div className="relative h-2 rounded-full bg-[#E5E8EE] overflow-hidden">
                      <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black/20" />
                      <div
                        style={{
                          width: `${z.meterPct}%`,
                          backgroundColor: getZoneBarColor(z.feel),
                        }}
                        className="h-full rounded-full transition-all duration-300"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-[#8A9099]">
                      <span>Snug / Tight</span>
                      <span>Tailored Match</span>
                      <span>Roomy Drape</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dynamic Tailor Verdict Callout */}
            <div className="p-2.5 rounded-2xl bg-[#F4F8F5] border border-[#CBE2D4] space-y-1">
              <p className="text-xs font-semibold text-[#1D4232] leading-snug">
                {liveFitReport.headlineVerdict}
              </p>
              {liveFitReport.alternateOption &&
                selectedSize === liveFitReport.recommendedSize && (
                  <p className="text-[11px] text-[#4E5A54]">
                    Tip: {liveFitReport.alternateOption.note}.
                  </p>
                )}
            </div>
          </div>

          {/* Pinned Customer Retail Checkout & Closet Actions */}
          <div className="shrink-0 space-y-2 pt-2.5 border-t border-black/[0.07]">
            <button
              type="button"
              id="sp-buy-now"
              onClick={() => handleAddToBag(true)}
              className="w-full py-3 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              Buy Size {selectedSize} Now • ${activeProduct.price}
            </button>

            <button
              type="button"
              id="sp-buy"
              ref={addBagBtnRef}
              onClick={() => handleAddToBag(false)}
              className="w-full py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-[#A7D7C5]" /> Added Size{" "}
                  {selectedSize} to Bag!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add Size {selectedSize} to Bag
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSavedToCloset(true);
                showToast(
                  `Saved ${activeProduct.title} (${selectedSize}) to My Closet!`
                );
              }}
              className={`w-full py-2 rounded-full text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                savedToCloset
                  ? "bg-[#E7F3EE] border-[#244B3B]/20 text-[#244B3B]"
                  : "bg-white hover:bg-[#F7F8FA] border-black/10 text-[#141518]"
              }`}
            >
              {savedToCloset ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved in My Closet
                </>
              ) : (
                "Save to My Closet"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

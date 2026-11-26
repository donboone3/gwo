"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  Columns2,
  ExternalLink,
  HeartHandshake,
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
import { Parametric3DFitMock } from "./Parametric3DFitMock";
import { useGwo } from "@/context/GwoAppContext";
import {
  analyzeExactAvatarFit,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const SPIN_FRAME_COUNT = 8;
const STAGE_W = 540;
const STAGE_H = 900;

let SESSION_SPIN_BITMAPS: Array<ImageBitmap | null> | null = null;

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
        rawText: "Studio 360° Avatar is 5'2\" wearing Size S (32.25\" B • 27\" W • 34\" H)",
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
      XS: { bustMin: 31, bustMax: 33, waistMin: 24.5, waistMax: 26, hipsMin: 34, hipsMax: 36 },
      S: { bustMin: 33, bustMax: 35.5, waistMin: 26, waistMax: 28.5, hipsMin: 36, hipsMax: 38.5 },
      M: { bustMin: 35.5, bustMax: 38, waistMin: 28.5, waistMax: 31, hipsMin: 38.5, hipsMax: 41 },
      L: { bustMin: 38, bustMax: 41, waistMin: 31, waistMax: 34, hipsMin: 41, hipsMax: 44 },
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

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const queryId = searchParams.get("id");
  const viewParam = searchParams.get("view");
  const rawName = searchParams.get("name") || "Contour Metallic Cropped Puffer";
  const rawPriceStr = searchParams.get("price") || "$168";
  const parsedPrice = Number(rawPriceStr.replace(/[^0-9.]/g, "")) || 168;

  const {
    user,
    products,
    activeImportedProduct,
    setAddUrlModalOpen,
    addToBag,
    showToast,
    customAvatar,
    setAvatarModalOpen,
  } = useGwo();

  // Resolve inspected product if ?id=... was passed or user toggled to activeImportedProduct
  const matchedCatalogProduct = useMemo(() => {
    if (queryId) {
      if (activeImportedProduct?.id === queryId) return activeImportedProduct;
      return products.find((p) => p.id === queryId) || null;
    }
    return null;
  }, [activeImportedProduct, products, queryId]);

  const [forceTurntableMode, setForceTurntableMode] = useState(false);
  const [turntable3dMode, setTurntable3dMode] = useState(viewParam === "3d");

  useEffect(() => {
    setForceTurntableMode(false);
    setTurntable3dMode(viewParam === "3d");
  }, [queryId, viewParam]);

  const inspectedExternalProduct = !forceTurntableMode
    ? matchedCatalogProduct
    : null;
  const isStoreUrlMode = Boolean(inspectedExternalProduct);
  const showRichFitStage = isStoreUrlMode || turntable3dMode;

  const activeProduct: Product = useMemo(
    () =>
      inspectedExternalProduct ||
      buildDefaultTurntableProduct(rawName, parsedPrice),
    [inspectedExternalProduct, parsedPrice, rawName]
  );

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
    [activeBust, activeHeight, activeHips, activeProduct, activeWaist, user?.shoeSize]
  );

  const [selectedSize, setSelectedSize] = useState<string>(
    baseFitReport.recommendedSize
  );

  useEffect(() => {
    setSelectedSize(baseFitReport.recommendedSize);
  }, [baseFitReport.recommendedSize, activeProduct.id]);

  // Live Zone-by-Zone Fit Report recalculated whenever user clicks XS / S / M / L!
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

  const [storeAngleIdx, setStoreAngleIdx] = useState(0);
  const [stageViewMode, setStageViewMode] = useState<
    "3d" | "avatar" | "store" | "compare"
  >(
    viewParam === "3d"
      ? "3d"
      : activeProduct.studioLookIndex !== undefined
      ? "avatar"
      : "3d"
  );

  useEffect(() => {
    setStoreAngleIdx(0);
    setStageViewMode(
      viewParam === "3d"
        ? "3d"
        : activeProduct.studioLookIndex !== undefined
        ? "avatar"
        : "3d"
    );
  }, [activeProduct.id, activeProduct.studioLookIndex, viewParam]);

  const avatarRenderLook =
    activeProduct.studioLookIndex !== undefined
      ? STUDIO_LOOKS[activeProduct.studioLookIndex] || STUDIO_LOOKS[0]
      : STUDIO_LOOKS[0];

  const galleryAngles = useMemo(() => {
    const raw = activeProduct.fitMetadata?.galleryImages || [];
    if (raw.length > 0) return raw;
    if (activeProduct.imageUrl) {
      return [{ url: activeProduct.imageUrl, label: "Model Front" }];
    }
    return [];
  }, [activeProduct]);

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
  const [activeAngleTab, setActiveAngleTab] = useState<"front" | "side" | "back">("front");
  const [isDraggingUi, setIsDraggingUi] = useState(false);

  // Instant 8-Angle Signature Avatar Turnaround Engine (only decodes/runs when 360° turntable is visible!)
  useEffect(() => {
    if (showRichFitStage) return;
    const cv = cvRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!cv || !stage || !root) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const frames: Array<ImageBitmap | null> =
      SESSION_SPIN_BITMAPS || new Array(SPIN_FRAME_COUNT).fill(null);
    SESSION_SPIN_BITMAPS = frames;

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

      const exactPos = norm * SPIN_FRAME_COUNT;
      const i0 = Math.floor(exactPos) % SPIN_FRAME_COUNT;
      const i1 = (i0 + 1) % SPIN_FRAME_COUNT;
      const frac = exactPos - Math.floor(exactPos);

      const bmp0 = frames[i0] || frames[0];
      const bmp1 = frames[i1] || bmp0;
      if (!bmp0) return;

      const qFrac = Math.round(frac * 12) / 12;
      const key = `${i0}:${i1}:${qFrac}`;
      if (key === lastPaintedKey) return;
      lastPaintedKey = key;

      ctx.globalAlpha = 1;
      ctx.drawImage(bmp0, 0, 0, STAGE_W, STAGE_H);
      if (bmp1 && bmp1 !== bmp0 && qFrac > 0.04) {
        ctx.globalAlpha = qFrac;
        ctx.drawImage(bmp1, 0, 0, STAGE_W, STAGE_H);
        ctx.globalAlpha = 1;
      }
    };

    const loadSpinFrames = async () => {
      const loadIndex = async (idx: number) => {
        if (frames[idx]) return;
        const im = new Image();
        im.decoding = "async";
        im.src = `${BASE_PATH}/models/signature/spin_${idx}.webp`;
        await im.decode();
        if (cancelled) return;
        frames[idx] = await createImageBitmap(im);
      };

      try {
        await loadIndex(0);
        if (cancelled) return;
        lastPaintedKey = "";
        showFrame(ang);

        // Defer angles 1..7 slightly so initial paint & page load complete instantaneously
        const deferFn =
          typeof window !== "undefined" && "requestIdleCallback" in window
            ? (cb: () => void) =>
                (window as Window & { requestIdleCallback: (fn: () => void) => void }).requestIdleCallback(cb)
            : (cb: () => void) => setTimeout(cb, 260);
        deferFn(() => {
          if (cancelled) return;
          void Promise.all([1, 2, 3, 4, 5, 6, 7].map((idx) => loadIndex(idx))).then(
            () => {
              if (cancelled) return;
              lastPaintedKey = "";
              showFrame(ang);
            }
          );
        });
      } catch {
        // Ignore transient decode error
      }
    };

    if (frames[0]) {
      showFrame(0);
    }
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
        duration: 680 + Math.abs(delta) * 680,
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

      const dAng = -dx / 560;
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
  }, [showRichFitStage]);

  const handleAddToBag = useCallback(() => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);

    const btn = addBagBtnRef.current;
    const bagBtn = document.getElementById("gwo-unified-bag-btn");
    const thumbSrc =
      activeProduct.imageUrl ||
      customAvatar?.badgeDataUrl ||
      `${BASE_PATH}/models/signature/spin_0.webp`;

    if (btn && bagBtn) {
      const bRect = btn.getBoundingClientRect();
      const bagRect = bagBtn.getBoundingClientRect();

      const startX = bRect.left + bRect.width / 2 - 28;
      const startY = bRect.top + bRect.height / 2 - 36;
      const endX = bagRect.left + bagRect.width / 2 - 28;
      const endY = bagRect.top + bagRect.height / 2 - 36;
      const midX = (startX + endX) / 2 - 35;
      const midY = Math.min(startY, endY) - 110;

      const flyer = document.createElement("div");
      flyer.style.position = "fixed";
      flyer.style.left = "0px";
      flyer.style.top = "0px";
      flyer.style.width = "56px";
      flyer.style.height = "72px";
      flyer.style.borderRadius = "12px";
      flyer.style.background = "#ffffff";
      flyer.style.padding = "3px";
      flyer.style.boxShadow = "0 12px 28px rgba(0,0,0,0.18)";
      flyer.style.zIndex = "9999";
      flyer.style.pointerEvents = "none";

      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      inner.style.borderRadius = "9px";
      inner.style.background = `url("${thumbSrc}") center top / cover no-repeat`;
      flyer.appendChild(inner);

      document.body.appendChild(flyer);
      flyer.animate(
        [
          {
            transform: `translate(${startX}px, ${startY}px) scale(1) rotate(0deg)`,
            opacity: 1,
          },
          {
            transform: `translate(${midX}px, ${midY}px) scale(0.8) rotate(-8deg)`,
            opacity: 1,
            offset: 0.5,
          },
          {
            transform: `translate(${endX}px, ${endY}px) scale(0.2) rotate(-14deg)`,
            opacity: 0.7,
          },
        ],
        {
          duration: 780,
          easing: "cubic-bezier(0.5, 0, 0.3, 1)",
          fill: "forwards",
        }
      );

      setTimeout(() => flyer.remove(), 800);
    }

    addToBag({
      title: activeProduct.title,
      brand: activeProduct.brand,
      price: activeProduct.price,
      size: selectedSize,
      imageUrl: activeProduct.imageUrl || `${BASE_PATH}/models/signature/spin_0.webp`,
      storeUrl: isStoreUrlMode ? activeProduct.canonicalUrl : undefined,
      friendRef: "MAYA-GWO",
    });
  }, [
    activeProduct,
    addToBag,
    customAvatar?.badgeDataUrl,
    isStoreUrlMode,
    selectedSize,
  ]);

  const modelHeightIn =
    activeProduct.fitMetadata?.modelStats?.heightInches || 69;
  const modelHeightDisp = `${Math.floor(modelHeightIn / 12)}'${
    modelHeightIn % 12
  }"`;
  const avatarHeightDisp = `${Math.floor(activeHeight / 12)}'${Math.round(
    activeHeight % 12
  )}"`;

  const avatarScaleRatio = clamp(activeHeight / Math.max(modelHeightIn, activeHeight), 0.78, 1);
  const modelScaleRatio = clamp(modelHeightIn / Math.max(modelHeightIn, activeHeight), 0.78, 1);

  return (
    <div className="sp-root" ref={rootRef}>
      <div className="max-w-[1520px] mx-auto min-h-[calc(100svh-64px)] lg:h-full px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-1 lg:grid-cols-[356px_minmax(0,1fr)_356px] xl:grid-cols-[406px_minmax(0,1fr)_406px] gap-3.5 sm:gap-4 items-stretch">
        {/* ==================== LEFT CARD: EXTRACTED STORE DESCRIPTION, MODEL & FABRIC ==================== */}
        <section className="order-3 lg:order-1 lg:h-full lg:min-h-0 rounded-3xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-5 flex flex-col justify-between gap-3 lg:overflow-hidden">
          <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-xs font-semibold text-[#141518]"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Closet
              </Link>

              {matchedCatalogProduct ? (
                <button
                  type="button"
                  onClick={() => setForceTurntableMode((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EC] text-xs font-bold text-[#141518] cursor-pointer"
                >
                  <Rotate3d className="w-3.5 h-3.5" />
                  {isStoreUrlMode
                    ? "360° Studio Demo"
                    : `Back to ${matchedCatalogProduct.brand}`}
                </button>
              ) : activeImportedProduct ? (
                <Link
                  href={`/product?id=${encodeURIComponent(activeImportedProduct.id)}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#E7F3EE] hover:bg-[#D8ECE3] text-xs font-bold text-[#1D4232]"
                >
                  <Sparkles className="w-3.5 h-3.5" /> {activeImportedProduct.brand} Fit
                </Link>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTurntable3dMode((v) => !v);
                      setStageViewMode("3d");
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E7F3EE] hover:bg-[#D5EAE0] text-xs font-bold text-[#1D4232] cursor-pointer"
                  >
                    <Box className="w-3.5 h-3.5" />
                    {turntable3dMode ? "360° Spin" : "3D Fit Mock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddUrlModalOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E7EC] text-xs font-bold text-[#141518] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Pull Store
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#E7F3EE] text-[#244B3B]">
                  <Sparkles className="w-3 h-3" /> {activeProduct.brand} •{" "}
                  {liveFitReport.confidencePct}% Fit Confidence
                </span>
                {isStoreUrlMode && (
                  <a
                    href={activeProduct.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F4F5F7] hover:bg-[#E8EAEE] text-[#141518]"
                  >
                    Store Page <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-[#141518] mt-2 leading-snug">
                {activeProduct.title}
              </h1>
              <p className="text-base sm:text-lg font-bold text-[#141518] mt-0.5">
                ${activeProduct.price}
              </p>
            </div>

            {/* Store Model & Proportion Intelligence Box */}
            <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#244B3B]" /> Store Model vs You
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

            {/* Extracted Store Description, Fabric & Body-Twin Accordion */}
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
                {
                  id: "98% Body-Twin Friend Check",
                  body: (
                    <p className="text-xs text-[#5C6068] leading-relaxed">
                      <HeartHandshake className="w-3.5 h-3.5 text-[#244B3B] inline mr-1" />
                      <strong>@maya</strong> (32.5&quot; B • 27&quot; W • 34.5&quot; H) matches{" "}
                      <strong>Size {liveFitReport.recommendedSize}</strong> for clean waist comfort without pulling.
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

          {/* Pinned Quick 360° Angle Buttons when in Turntable Mode */}
          {!showRichFitStage && (
            <div className="shrink-0 flex items-center gap-2 pt-2 border-t border-black/[0.06]">
              <button
                type="button"
                onClick={() => {
                  setActiveAngleTab("front");
                  spinToFnRef.current?.(0);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                  activeAngleTab === "front"
                    ? "border-[#141518] bg-[#141518] text-white"
                    : "border-black/10 bg-white text-[#686D76]"
                }`}
              >
                <img
                  src={`${BASE_PATH}/models/signature/spin_0.webp`}
                  alt="Front"
                  className="w-5 h-5 rounded-md object-cover object-top"
                />
                Front
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAngleTab("side");
                  spinToFnRef.current?.(0.25);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                  activeAngleTab === "side"
                    ? "border-[#141518] bg-[#141518] text-white"
                    : "border-black/10 bg-white text-[#686D76]"
                }`}
              >
                <img
                  src={`${BASE_PATH}/models/signature/spin_2.webp`}
                  alt="Side"
                  className="w-5 h-5 rounded-md object-cover object-top"
                />
                Side
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveAngleTab("back");
                  spinToFnRef.current?.(0.5);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                  activeAngleTab === "back"
                    ? "border-[#141518] bg-[#141518] text-white"
                    : "border-black/10 bg-white text-[#686D76]"
                }`}
              >
                <img
                  src={`${BASE_PATH}/models/signature/spin_4.webp`}
                  alt="Back"
                  className="w-5 h-5 rounded-md object-cover object-top"
                />
                Back
              </button>
            </div>
          )}
        </section>

        {/* ==================== CENTER COLUMN: UNOBSTRUCTED 360° / 3D FIT / AVATAR STAGE ==================== */}
        <div className="order-1 lg:order-2 min-w-0 h-auto lg:h-full lg:min-h-0 flex flex-col items-center justify-between gap-2.5">
          {/* CENTER STAGE A: 360° TURNTABLE */}
          <div
            style={{ display: showRichFitStage ? "none" : "flex" }}
            className="w-full h-[480px] lg:h-full flex-col items-center justify-between gap-2"
          >
            <div className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden">
              <div
                id="sp-stage"
                ref={stageRef}
                className={isDraggingUi ? "dragging" : ""}
              >
                <canvas id="sp-cv" ref={cvRef} width={STAGE_W} height={STAGE_H} />

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

                {HOTSPOTS.map((hs, idx) => (
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
                    <span className={`sp-tip ${hs.x > 0.5 ? "right" : "left"}`}>
                      <span className="sp-tip-title">{hs.title}</span>
                      {hs.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dedicated Bottom Degree Readout (Never Overlaps Boots!) */}
            <div id="sp-deg" className="shrink-0">
              <span>DRAG MODEL TO SPIN 360°</span>
              <span className="sp-deg-bar">
                <span ref={degDotRef} className="sp-deg-dot" style={{ left: "0%" }} />
              </span>
              <span ref={degNumRef} className="sp-deg-num">
                000°
              </span>
            </div>
          </div>

          {/* CENTER STAGE B: 3D PARAMETRIC MOCK, MULTI-ANGLE & AVATAR PROPORTION VIEW */}
          {showRichFitStage && (
            <div className="w-full h-full flex flex-col items-center justify-between gap-2.5 min-h-0">
              {/* Stage Mode Switcher Pill (Dedicated Top Strip Outside Visual Frame) */}
              <div className="shrink-0 flex flex-wrap items-center justify-center gap-1 p-1 rounded-full bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs">
                <button
                  type="button"
                  id="gwo-stage-tab-3d"
                  onClick={() => setStageViewMode("3d")}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                    stageViewMode === "3d"
                      ? "bg-[#141518] text-white"
                      : "text-[#686D76] hover:text-[#141518]"
                  }`}
                >
                  <Box className="w-3.5 h-3.5 text-[#A7D7C5]" /> 3D Fit Mock
                </button>
                {activeProduct.studioLookIndex !== undefined && (
                  <button
                    type="button"
                    id="gwo-stage-tab-avatar"
                    onClick={() => setStageViewMode("avatar")}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                      stageViewMode === "avatar"
                        ? "bg-[#141518] text-white"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" /> Your Avatar
                  </button>
                )}
                {isStoreUrlMode ? (
                  <>
                    <button
                      type="button"
                      id="gwo-stage-tab-compare"
                      onClick={() => setStageViewMode("compare")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                        stageViewMode === "compare"
                          ? "bg-[#141518] text-white"
                          : "text-[#686D76] hover:text-[#141518]"
                      }`}
                    >
                      <Columns2 className="w-3.5 h-3.5" /> Model vs You ({avatarHeightDisp})
                    </button>
                    <button
                      type="button"
                      id="gwo-stage-tab-store"
                      onClick={() => setStageViewMode("store")}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
                        stageViewMode === "store"
                          ? "bg-[#141518] text-white"
                          : "text-[#686D76] hover:text-[#141518]"
                      }`}
                    >
                      <Images className="w-3.5 h-3.5" /> Store Photos
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTurntable3dMode(false)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 text-[#686D76] hover:text-[#141518] cursor-pointer transition"
                  >
                    <Rotate3d className="w-3.5 h-3.5" /> 360° Studio Spin
                  </button>
                )}
              </div>

              {/* Main Visual Frame */}
              {stageViewMode === "3d" ? (
                <Parametric3DFitMock
                  product={activeProduct}
                  selectedSize={selectedSize}
                  fitReport={liveFitReport}
                  avatar={{
                    heightInches: activeHeight,
                    bustInches: activeBust,
                    waistInches: activeWaist,
                    hipsInches: activeHips,
                    skinTone:
                      customAvatar?.skinToneHex || user?.skinTone || "#D9A482",
                  }}
                  faceBadgeUrl={customAvatar?.badgeDataUrl}
                />
              ) : stageViewMode === "avatar" &&
                activeProduct.studioLookIndex !== undefined ? (
                <div className="w-full h-[460px] lg:h-auto lg:flex-1 min-h-0 rounded-3xl bg-white border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.08)] overflow-hidden flex flex-col justify-between">
                  {/* Unobstructed Full-Body Avatar Viewport */}
                  <div className="relative flex-1 min-h-0 bg-gradient-to-b from-[#F5F6F9] to-[#E8EBF0] flex items-end justify-center pt-3 overflow-hidden">
                    <div className="relative h-full aspect-[1360/2048] flex items-end justify-center">
                      <div
                        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-56 h-7 rounded-full pointer-events-none"
                        style={{
                          background:
                            "radial-gradient(closest-side, rgba(25,26,30,0.34), transparent)",
                        }}
                      />
                      <img
                        src={H(avatarRenderLook.file, 900)}
                        alt={`${activeProduct.title} on Your Avatar`}
                        className="w-full h-full object-contain"
                      />
                      {customAvatar && (
                        <img
                          src={customAvatar.faceOvalDataUrl}
                          alt="Your face"
                          style={{
                            left: "49.95%",
                            top: "13.2%",
                            width: "12.9%",
                            height: "9.7%",
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none"
                        />
                      )}
                    </div>
                  </div>

                  {/* Dedicated Footer Strip Below Avatar (Zero Image Overlap!) */}
                  <div className="shrink-0 px-3.5 py-2.5 bg-white border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#141518]">
                      Your {avatarHeightDisp} Avatar • Size {selectedSize}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
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
              ) : stageViewMode === "store" ? (
                <div className="w-full h-[460px] lg:h-auto lg:flex-1 min-h-0 rounded-3xl bg-white border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.08)] overflow-hidden flex flex-col justify-between">
                  {/* Unobstructed Store Model Photo Viewport */}
                  <div className="relative flex-1 min-h-0 bg-[#F6F7F9] flex items-center justify-center overflow-hidden">
                    <GarmentArtwork
                      product={{
                        ...activeProduct,
                        imageUrl:
                          galleryAngles[storeAngleIdx]?.url ||
                          activeProduct.imageUrl,
                      }}
                      className="w-full h-full"
                    />
                  </div>

                  {/* Dedicated Footer Strip Below Photo (Zero Image Overlap!) */}
                  <div className="shrink-0 px-3.5 py-2.5 bg-white border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-bold text-[#141518]">
                      {galleryAngles[storeAngleIdx]?.label || "Store Photo"} • Size{" "}
                      {selectedSize}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
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
              ) : (
                /* Side-by-Side Proportional Height & Zone Comparison */
                <div className="relative w-full h-[440px] lg:h-auto lg:flex-1 min-h-0 rounded-3xl bg-white/95 border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.08)] p-4 flex flex-col justify-between overflow-hidden">
                  <div className="grid grid-cols-2 gap-3 flex-1 items-end min-h-0 pt-1">
                    <div className="h-full flex flex-col items-center justify-end gap-1.5 min-h-0">
                      <div
                        style={{ height: `${Math.round(modelScaleRatio * 90)}%` }}
                        className="w-full rounded-2xl overflow-hidden bg-[#F4F5F7] border border-black/[0.07] shadow-xs"
                      >
                        <GarmentArtwork
                          product={{
                            ...activeProduct,
                            imageUrl:
                              galleryAngles[0]?.url || activeProduct.imageUrl,
                          }}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-[#141518]">
                          Store Model ({modelHeightDisp})
                        </p>
                        <p className="text-[11px] text-[#686D76]">
                          Wears Size{" "}
                          {activeProduct.fitMetadata?.modelStats?.wornSize || "S"}
                          {activeProduct.fitMetadata?.modelStats?.waistInches
                            ? ` (${activeProduct.fitMetadata.modelStats.waistInches}"W)`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="h-full flex flex-col items-center justify-end gap-1.5 min-h-0">
                      <div
                        style={{ height: `${Math.round(avatarScaleRatio * 90)}%` }}
                        className="relative aspect-[1360/2048] flex items-end justify-center"
                      >
                        <img
                          src={H(avatarRenderLook.file, 900)}
                          alt="Your Signature Avatar"
                          className="w-full h-full object-contain"
                        />
                        {customAvatar && (
                          <img
                            src={customAvatar.faceOvalDataUrl}
                            alt="Your face"
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
                      <div className="text-center">
                        <p className="text-xs font-bold text-[#244B3B]">
                          Your Avatar ({avatarHeightDisp})
                        </p>
                        <p className="text-[11px] text-[#686D76]">
                          {activeBust}&quot; • {activeWaist}&quot; • {activeHips}&quot; (Rec:{" "}
                          {liveFitReport.recommendedSize})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 mt-2.5 p-2 rounded-xl bg-[#F6F8F7] border border-[#CBE2D4] text-[11px] text-[#1D4232] font-medium text-center line-clamp-2">
                    {liveFitReport.lengthComparison.proportionNote}
                  </div>
                </div>
              )}

              {/* Multi-Angle Store Gallery Selector */}
              {isStoreUrlMode && galleryAngles.length > 1 && (
                <div className="shrink-0 flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.08] shadow-xs">
                  {galleryAngles.map((ang, idx) => (
                    <button
                      key={ang.url}
                      type="button"
                      onClick={() => {
                        setStoreAngleIdx(idx);
                        setStageViewMode("store");
                      }}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold cursor-pointer transition ${
                        storeAngleIdx === idx && stageViewMode === "store"
                          ? "bg-[#141518] text-white border-[#141518]"
                          : "bg-white text-[#686D76] border-black/10 hover:text-[#141518]"
                      }`}
                    >
                      <img
                        src={ang.url}
                        alt={ang.label}
                        className="w-5 h-6 rounded object-cover object-top"
                      />
                      <span>{ang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ==================== RIGHT CARD: INTERACTIVE EXACT-FIT ZONE SIMULATOR & Pinned Checkout ==================== */}
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
                  Tap size to preview tension
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

          {/* Pinned Checkout & Closet Actions (Always Visible Without Scrolling!) */}
          <div className="shrink-0 space-y-2 pt-2.5 border-t border-black/[0.07]">
            <button
              type="button"
              id="sp-buy"
              ref={addBagBtnRef}
              onClick={handleAddToBag}
              className="w-full py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-[#A7D7C5]" /> Added Size{" "}
                  {selectedSize} to Bag!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add Size {selectedSize} to Bag • $
                  {activeProduct.price}
                </>
              )}
            </button>

            {isStoreUrlMode && (
              <a
                href={activeProduct.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                Purchase on {activeProduct.brand} (${activeProduct.price}){" "}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            <button
              type="button"
              onClick={() => {
                setSavedToCloset(true);
                showToast(
                  `Saved ${activeProduct.title} (${selectedSize}) to Your Closet!`
                );
              }}
              className={`w-full py-2.5 rounded-full text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
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
                "Save to My Public Closet"
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

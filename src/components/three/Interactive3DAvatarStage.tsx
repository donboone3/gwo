"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Product } from "@/lib/types";
import {
  BodyScanDimensions,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import {
  Render3DVisualMode,
  Worn3DPieceSpec,
} from "@/lib/three/parametric-3d-engine";
import {
  analyzeExactAvatarFit,
  AvatarExactFitReport,
  ZoneFeel,
} from "@/lib/catalog/fit-intelligence";
import { BAG_RGBA_OVERLAY_BY_ID } from "@/lib/stylist/runway-ai-outfits";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export interface Interactive3DAvatarStageProps {
  mode?: "avatar" | "product";
  dimensions: BodyScanDimensions;
  wornPieces?: Worn3DPieceSpec[];
  singleProduct?: Product;
  selectedSize?: string;
  visualMode?: Render3DVisualMode;
  onVisualModeChange?: (mode: Render3DVisualMode) => void;
  showMeasurementRings?: boolean;
  faceOvalDataUrl?: string | null;
  autoSpinDefault?: boolean;
  initialYawDeg?: number;
  externalYawDeg?: number;
  seamlessStage?: boolean;
  inertiaSpin?: boolean;
  onYawChange?: (deg: number) => void;
  showHud?: boolean;
  compactHud?: boolean;
  selectedProductId?: string | null;
  onSelectProduct?: (product: Product, fit?: AvatarExactFitReport) => void;
  className?: string;
}

const IMG_CACHE = new Map<string, HTMLImageElement>();

function loadCachedImage(
  url: string,
  onReady: () => void
): HTMLImageElement | null {
  if (!url || typeof Image === "undefined") return null;
  const hit = IMG_CACHE.get(url);
  if (hit && hit.complete && hit.naturalWidth > 0) return hit;
  if (hit) {
    hit.addEventListener("load", onReady, { once: true });
    return null;
  }

  const im = new Image();
  if (!url.startsWith("data:") && !url.startsWith("/")) {
    im.crossOrigin = "anonymous";
  }
  im.decoding = "async";
  IMG_CACHE.set(url, im);
  im.addEventListener("load", onReady, { once: true });
  im.addEventListener(
    "error",
    () => {
      IMG_CACHE.delete(url);
    },
    { once: true }
  );
  im.src = url;
  return null;
}

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

function resolvePhotorealLookIndices(wornPieces: Worn3DPieceSpec[]): {
  topIdx: number;
  botIdx: number;
  isSinglePieceDressOrCoat: boolean;
  bagOverlay: { url: string; pos: "hand" | "shoulder" } | null;
} {
  const ids = new Set(wornPieces.map((w) => w.product.id));

  // Native full-combo shortcut: Espresso Corset + Vintage Jeans -> Outfit 9!
  if (
    ids.has("prod-ae-espresso-corset") &&
    ids.has("prod-ae-vintage-wide-denim") &&
    !wornPieces.some((w) => w.product.category === "outerwear")
  ) {
    const activeBag = wornPieces.find(
      (w) => w.product.id in BAG_RGBA_OVERLAY_BY_ID
    )?.product.id;
    const bagOverlay =
      activeBag && activeBag !== UPPER_LOOK_HELD_BAG[9]
        ? BAG_RGBA_OVERLAY_BY_ID[activeBag]
        : null;
    return {
      topIdx: 9,
      botIdx: 9,
      isSinglePieceDressOrCoat: false,
      bagOverlay,
    };
  }

  // 1. Resolve Upper Photorealistic Cutout (Outerwear takes visual layer priority, then Dress, then Top)
  let topIdx = 0;
  let isSinglePieceDressOrCoat = false;

  if (ids.has("prod-ae-camel-silk-wool-coat")) {
    topIdx = 4;
    isSinglePieceDressOrCoat = true;
  } else if (ids.has("prod-ae-ivory-tweed-blazer")) {
    topIdx = 1;
  } else if (ids.has("prod-ae-linen-cinch-cardigan")) {
    topIdx = 5;
  } else if (ids.has("prod-ae-noir-tailored-blazer")) {
    topIdx = 7;
  } else if (ids.has("prod-ae-sage-zip-jacket")) {
    topIdx = 8;
  } else if (ids.has("prod-ae-emerald-satin-midi")) {
    topIdx = 2;
    isSinglePieceDressOrCoat = true;
  } else if (ids.has("prod-ae-champagne-blazer-dress")) {
    topIdx = 3;
    isSinglePieceDressOrCoat = true;
  } else if (ids.has("prod-ae-crimson-corset-mini")) {
    topIdx = 6;
    isSinglePieceDressOrCoat = true;
  } else if (ids.has("prod-ae-acetate-beaded-tank")) {
    topIdx = 5;
  } else if (ids.has("prod-ae-espresso-corset")) {
    topIdx = 0;
  } else if (wornPieces.length === 1) {
    // Single-piece inspection fallback
    const p = wornPieces[0].product;
    const low = p.title.toLowerCase();
    if (/crimson|scarlet/.test(low)) {
      topIdx = 6;
      isSinglePieceDressOrCoat = true;
    } else if (/emerald|midi/.test(low)) {
      topIdx = 2;
      isSinglePieceDressOrCoat = true;
    } else if (/blazer dress/.test(low)) {
      topIdx = 3;
      isSinglePieceDressOrCoat = true;
    } else if (/sage|legging|sneaker/.test(low)) {
      topIdx = 8;
    } else if (/jean|denim|belt/.test(low)) {
      topIdx = 7;
    } else if (/pleat|boot|tweed/.test(low)) {
      topIdx = 1;
    }
  }

  // 2. Resolve Lower Photorealistic Cutout (Matches exact trousers/skirt/jeans/leggings + footwear!)
  let botIdx = topIdx;
  const hasBoots = ids.has("prod-ae-meotina-leather-boots");
  if (!isSinglePieceDressOrCoat) {
    if (ids.has("prod-ae-champagne-trousers")) {
      botIdx = 0;
    } else if (ids.has("prod-ae-noir-pleated-mini")) {
      botIdx = hasBoots ? 1 : 5;
    } else if (ids.has("prod-ae-vintage-wide-denim")) {
      botIdx = hasBoots ? 9 : 7;
    } else if (ids.has("prod-ae-sage-flare-leggings")) {
      botIdx = 8;
    }
  }

  // 3. Resolve Held Bag RGBA Overlay if customer equipped a different bag than the upper cutout's native held bag
  const activeBagId = wornPieces.find(
    (w) => w.product.id in BAG_RGBA_OVERLAY_BY_ID
  )?.product.id;
  const bagOverlay =
    activeBagId && UPPER_LOOK_HELD_BAG[topIdx] !== activeBagId
      ? BAG_RGBA_OVERLAY_BY_ID[activeBagId]
      : null;

  return { topIdx, botIdx, isSinglePieceDressOrCoat, bagOverlay };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / Math.max(1e-5, e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function feelColorRgba(feel: ZoneFeel, alpha = 0.34): string {
  switch (feel) {
    case "too_tight":
      return `rgba(239, 68, 68, ${alpha})`;
    case "sculpted_snug":
      return `rgba(245, 158, 11, ${alpha})`;
    case "tailored_ideal":
      return `rgba(16, 185, 129, ${alpha})`;
    case "relaxed_skim":
      return `rgba(6, 182, 212, ${alpha})`;
    case "oversized_roomy":
    default:
      return `rgba(99, 102, 241, ${alpha})`;
  }
}

/**
 * 100% PHOTOREALISTIC LIFELIKE 360° BODY-MORPHING AVATAR & 3D PRODUCT TURNTABLE
 * Zero wooden/plastic mannequins — renders real studio human photography with:
 * - Smooth 360° drag-to-spin (Front 0° -> 45° -> Side 90° -> 135° -> Back 180° -> 270°)
 * - Real-time exact-inch anatomical scanline warping (Bust, Waist, Hips, Shoulders, Height)
 * - Seamless multi-slot Top + Bottom + Held Handbag mix-and-match compositing
 * - 3D occluded glowing Body-Scan Tape Rings & Garment-Masked Fit Heatmap!
 */
export function Interactive3DAvatarStage({
  mode = "avatar",
  dimensions,
  wornPieces = [],
  singleProduct,
  selectedSize,
  visualMode: controlledVisualMode,
  onVisualModeChange,
  showMeasurementRings: propShowRings,
  faceOvalDataUrl,
  autoSpinDefault = false,
  initialYawDeg = 0,
  externalYawDeg,
  seamlessStage = false,
  inertiaSpin = true,
  onYawChange,
  showHud = true,
  compactHud = false,
  selectedProductId,
  onSelectProduct,
  className = "",
}: Interactive3DAvatarStageProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenCompRef = useRef<HTMLCanvasElement | null>(null);
  const needsPaintRef = useRef<boolean>(true);
  const onYawChangeRef = useRef(onYawChange);
  onYawChangeRef.current = onYawChange;
  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;

  // Interactive 360° yaw, inertia velocity, 3D tilt pitch, and zoom state refs
  const yawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const targetYawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const velYawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0);
  const targetPitchRef = useRef<number>(0);
  const zoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);

  // Remember painted bounding box for accurate click-on-garment hit testing
  const paintedAvatarBoxRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  }>({ x: 0, y: 0, w: 1, h: 1 });

  const [internalVisualMode, setInternalVisualMode] =
    useState<Render3DVisualMode>("studio");
  const activeVisualMode = controlledVisualMode ?? internalVisualMode;

  const [autoSpin, setAutoSpin] = useState<boolean>(autoSpinDefault);
  const autoSpinRef = useRef<boolean>(autoSpinDefault);
  autoSpinRef.current = autoSpin;

  const [showRings, setShowRings] = useState<boolean>(Boolean(propShowRings));
  const effectiveShowRings = propShowRings ?? showRings;

  const [liveDeg, setLiveDeg] = useState<number>(
    ((Math.round(initialYawDeg) % 360) + 360) % 360
  );
  const [tappedInfo, setTappedInfo] = useState<{
    product: Product;
    fit?: AvatarExactFitReport;
  } | null>(null);

  const setVisualMode = useCallback(
    (m: Render3DVisualMode) => {
      setInternalVisualMode(m);
      onVisualModeChange?.(m);
      needsPaintRef.current = true;
    },
    [onVisualModeChange]
  );

  useEffect(() => {
    if (typeof externalYawDeg === "number") {
      setAutoSpin(false);
      velYawRef.current = 0;
      targetYawRef.current = (externalYawDeg * Math.PI) / 180;
      needsPaintRef.current = true;
    }
  }, [externalYawDeg]);

  // Compute exact fit reports for all worn pieces against the customer's scanned body
  const fitByProductId = useMemo(() => {
    const map = new Map<string, AvatarExactFitReport>();
    const list =
      mode === "product" && singleProduct
        ? [{ product: singleProduct, selectedSize }]
        : wornPieces;
    for (const item of list) {
      map.set(
        item.product.id,
        analyzeExactAvatarFit(
          {
            heightInches: dimensions.heightInches,
            bustInches: dimensions.bustInches,
            waistInches: dimensions.waistInches,
            hipsInches: dimensions.hipsInches,
            shoeSize: dimensions.shoeSize,
          },
          item.product,
          item.selectedSize || selectedSize
        )
      );
    }
    return map;
  }, [dimensions, mode, selectedSize, singleProduct, wornPieces]);

  useEffect(() => {
    if (selectedProductId) {
      const found = wornPieces.find((w) => w.product.id === selectedProductId);
      if (found) {
        setTappedInfo({
          product: found.product,
          fit: fitByProductId.get(found.product.id),
        });
      }
    }
  }, [fitByProductId, selectedProductId, wornPieces]);

  const lookSpec = useMemo(
    () => resolvePhotorealLookIndices(wornPieces),
    [wornPieces]
  );

  // Trigger repaint whenever props change
  useEffect(() => {
    needsPaintRef.current = true;
  }, [
    activeVisualMode,
    dimensions,
    effectiveShowRings,
    faceOvalDataUrl,
    fitByProductId,
    lookSpec,
    mode,
    selectedSize,
    singleProduct,
    wornPieces,
  ]);

  // Main High-DPI 60fps Photorealistic Turnaround + Body-Scan Mesh-Warp Renderer
  useEffect(() => {
    const wrapEl = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrapEl || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    if (!offscreenCompRef.current) {
      offscreenCompRef.current = document.createElement("canvas");
      offscreenCompRef.current.width = 900;
      offscreenCompRef.current.height = 1355;
    }
    const compCv = offscreenCompRef.current;
    const compCtx = compCv.getContext("2d")!;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let viewW = 400;
    let viewH = 560;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewW = Math.max(120, wrapEl.clientWidth);
      viewH = Math.max(140, wrapEl.clientHeight);
      const nextW = Math.round(viewW * dpr);
      const nextH = Math.round(viewH * dpr);
      if (cv.width !== nextW || cv.height !== nextH) {
        cv.width = nextW;
        cv.height = nextH;
      }
      needsPaintRef.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapEl);

    // Pointer Drag (360° Spin + Inertia + Tilt) + Click-on-Garment Selection
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let lastMoveX = 0;
    let lastMoveTs = 0;
    let startYaw = 0;
    let startPitch = 0;
    let movedDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      movedDist = 0;
      startX = e.clientX;
      startY = e.clientY;
      lastMoveX = e.clientX;
      lastMoveTs = performance.now();
      velYawRef.current = 0;
      startYaw = targetYawRef.current;
      startPitch = targetPitchRef.current;
      cv.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const nowTs = performance.now();
      const dtMove = Math.max(8, nowTs - lastMoveTs) / 1000;
      const stepDx = e.clientX - lastMoveX;
      lastMoveX = e.clientX;
      lastMoveTs = nowTs;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDist = Math.hypot(dx, dy);
      if (movedDist > 4 && autoSpinRef.current) {
        setAutoSpin(false);
      }
      if (inertiaSpin) {
        const instV = (stepDx * 0.014) / dtMove;
        velYawRef.current = velYawRef.current * 0.55 + clamp(instV, -9, 9) * 0.45;
      }
      targetYawRef.current = startYaw + dx * 0.014;
      targetPitchRef.current = clamp(startPitch + dy * 0.004, -0.22, 0.28);
      needsPaintRef.current = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (performance.now() - lastMoveTs > 90) {
        velYawRef.current = 0;
      }
      try {
        cv.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (movedDist < 6 && mode === "avatar" && wornPieces.length > 0) {
        const rect = cv.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const box = paintedAvatarBoxRef.current;
        if (
          px >= box.x &&
          px <= box.x + box.w &&
          py >= box.y &&
          py <= box.y + box.h
        ) {
          const u = (px - box.x) / box.w;
          const v = (py - box.y) / box.h;

          const bagSpec = wornPieces.find(
            (w) =>
              w.product.category === "accessory" &&
              /bag|tote|crescent|purse/i.test(w.product.title)
          );
          const shoeSpec = wornPieces.find((w) => w.product.category === "shoes");
          const beltSpec = wornPieces.find(
            (w) =>
              w.product.category === "accessory" && /belt/i.test(w.product.title)
          );
          const outerSpec = wornPieces.find(
            (w) => w.product.category === "outerwear"
          );
          const topOrDress = wornPieces.find(
            (w) => w.product.category === "top" || w.product.category === "dress"
          );
          const botSpec = wornPieces.find(
            (w) => w.product.category === "bottom" || w.product.category === "dress"
          );

          let picked: Worn3DPieceSpec | undefined;
          if (bagSpec && u > 0.56 && v > 0.24 && v < 0.62) {
            picked = bagSpec;
          } else if (shoeSpec && v >= 0.86) {
            picked = shoeSpec;
          } else if (beltSpec && v >= 0.35 && v <= 0.42) {
            picked = beltSpec;
          } else if (v < 0.43) {
            picked = outerSpec || topOrDress || wornPieces[0];
          } else {
            picked = botSpec || topOrDress || wornPieces[0];
          }

          if (picked) {
            const fit = fitByProductId.get(picked.product.id);
            setTappedInfo({ product: picked.product, fit });
            onSelectProductRef.current?.(picked.product, fit);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0 && (window.innerWidth > 820 || e.ctrlKey)) {
        e.preventDefault();
        targetZoomRef.current = clamp(
          targetZoomRef.current - Math.sign(e.deltaY) * 0.08,
          0.78,
          1.55
        );
        needsPaintRef.current = true;
      }
    };

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", onPointerUp);
    cv.addEventListener("wheel", onWheel, { passive: false });

    const requestRepaint = () => {
      needsPaintRef.current = true;
    };

    // Compose a single angle ("front" | "side" | "back") onto compCv (900x1355)
    const composeAngleLayer = (
      angleKind: "front" | "side" | "back",
      mirrorSide: boolean
    ): boolean => {
      const { topIdx, botIdx, isSinglePieceDressOrCoat, bagOverlay } = lookSpec;

      const urlFor = (idx: number, kind: "front" | "side" | "back") => {
        return `${BASE}/models/runway_ai/ae_outfit_${idx}_${kind}.webp?v=life4`;
      };

      let topImg = loadCachedImage(urlFor(topIdx, angleKind), requestRepaint);
      // Graceful fallback to front/back if side-profile asset is still decoding
      if (!topImg && angleKind === "side") {
        topImg = loadCachedImage(urlFor(topIdx, "front"), requestRepaint);
      }
      if (!topImg) return false;

      compCtx.clearRect(0, 0, 900, 1355);
      compCtx.save();
      if (mirrorSide) {
        compCtx.translate(900, 0);
        compCtx.scale(-1, 1);
      }

      const mixedBottom = !isSinglePieceDressOrCoat && botIdx !== topIdx;
      let botImg = mixedBottom
        ? loadCachedImage(urlFor(botIdx, angleKind), requestRepaint) ||
          (angleKind === "side"
            ? loadCachedImage(urlFor(botIdx, "front"), requestRepaint)
            : null)
        : null;

      if (mixedBottom && botImg) {
        // Draw lower body (waist v=0.41 down to shoes v=1.0)
        compCtx.drawImage(
          botImg,
          0,
          Math.round(1355 * 0.425),
          900,
          Math.round(1355 * 0.575),
          0,
          Math.round(1355 * 0.425),
          900,
          Math.round(1355 * 0.575)
        );
        // Draw upper body (head v=0.0 down to waist v=0.445) with soft overlap blend
        compCtx.drawImage(
          topImg,
          0,
          0,
          900,
          Math.round(1355 * 0.435),
          0,
          0,
          900,
          Math.round(1355 * 0.435)
        );
        // Feather seam across v = 0.425..0.448
        for (let s = 0; s < 8; s++) {
          const t = s / 8;
          const ySlice = Math.round(1355 * (0.432 + t * 0.018));
          compCtx.globalAlpha = 1 - t;
          compCtx.drawImage(topImg, 0, ySlice, 900, 4, 0, ySlice, 900, 4);
        }
        compCtx.globalAlpha = 1;
      } else {
        compCtx.drawImage(topImg, 0, 0, 900, 1355);
      }

      // Composite Held RGBA Bag Overlay when custom bag differs from upper cutout's native bag
      if (bagOverlay && angleKind !== "side") {
        const bagImg = loadCachedImage(bagOverlay.url, requestRepaint);
        if (bagImg) {
          const isShoulder = bagOverlay.pos === "shoulder";
          const bx = isShoulder ? 900 * 0.545 : 900 * 0.575;
          const by = isShoulder ? 1355 * 0.255 : 1355 * 0.435;
          const bw = isShoulder ? 900 * 0.165 : 900 * 0.195;
          const bh = bw * (bagImg.naturalHeight / Math.max(1, bagImg.naturalWidth));
          compCtx.save();
          compCtx.shadowColor = "rgba(20, 21, 24, 0.24)";
          compCtx.shadowBlur = 14;
          compCtx.shadowOffsetY = 6;
          compCtx.drawImage(bagImg, bx, by, bw, bh);
          compCtx.restore();
        }
      }

      // Project customer's scanned selfie onto front face when provided
      if (faceOvalDataUrl && angleKind === "front") {
        const faceIm = loadCachedImage(faceOvalDataUrl, requestRepaint);
        if (faceIm) {
          const fw = 900 * 0.129;
          const fh = 1355 * 0.097;
          const fx = 900 * 0.4995 - fw / 2;
          const fy = 1355 * 0.132 - fh / 2;
          compCtx.drawImage(faceIm, fx, fy, fw, fh);
        }
      }

      // Garment-Masked Fit Heatmap Tint (keeps real photorealistic face, hair, skin & folds 100% lifelike!)
      if (activeVisualMode === "heatmap") {
        const primarySpec = wornPieces[0];
        const fit = primarySpec ? fitByProductId.get(primarySpec.product.id) : undefined;
        const bFeel = fit?.zones.find((z) => z.zone === "Bust")?.feel || "tailored_ideal";
        const wFeel = fit?.zones.find((z) => z.zone === "Waist")?.feel || "tailored_ideal";
        const hFeel = fit?.zones.find((z) => z.zone === "Hips")?.feel || "tailored_ideal";

        compCtx.save();
        compCtx.globalCompositeOperation = "source-atop";
        const grad = compCtx.createLinearGradient(0, 1355 * 0.22, 0, 1355 * 0.86);
        grad.addColorStop(0.0, "rgba(16, 185, 129, 0)");
        grad.addColorStop(0.08, feelColorRgba(bFeel, 0.34));
        grad.addColorStop(0.26, feelColorRgba(wFeel, 0.38));
        grad.addColorStop(0.48, feelColorRgba(hFeel, 0.34));
        grad.addColorStop(0.92, feelColorRgba(hFeel, 0.22));
        grad.addColorStop(1.0, "rgba(16, 185, 129, 0)");
        compCtx.fillStyle = grad;
        compCtx.fillRect(900 * 0.22, 1355 * 0.22, 900 * 0.56, 1355 * 0.68);
        compCtx.restore();
      }

      compCtx.restore();
      return true;
    };

    const paintProduct3D = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, viewW, viewH);

      const prod = singleProduct || wornPieces[0]?.product;
      if (!prod || !prod.imageUrl) {
        ctx.restore();
        return;
      }

      const im = loadCachedImage(prod.imageUrl, requestRepaint);
      if (!im) {
        ctx.restore();
        return;
      }

      const yaw = yawRef.current;
      const pitch = pitchRef.current;
      const zoom = zoomRef.current;

      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const absCos = Math.abs(cosY);
      const perspX = (0.28 + 0.72 * absCos) * (cosY >= 0 ? 1 : -1);
      const perspY = 1 - Math.abs(pitch) * 0.14;

      const maxBoxW = viewW * 0.76 * zoom;
      const maxBoxH = viewH * 0.76 * zoom;
      const imgAspect = im.naturalWidth / Math.max(1, im.naturalHeight);
      let drawW = maxBoxW;
      let drawH = drawW / imgAspect;
      if (drawH > maxBoxH) {
        drawH = maxBoxH;
        drawW = drawH * imgAspect;
      }

      const cx = viewW / 2;
      const cy = viewH * 0.48 + pitch * 26;

      // Studio Floating Pedestal Shadow
      const shadowGrad = ctx.createRadialGradient(
        cx,
        viewH * 0.88,
        6,
        cx,
        viewH * 0.88,
        drawW * 0.55
      );
      shadowGrad.addColorStop(0, "rgba(20, 21, 24, 0.20)");
      shadowGrad.addColorStop(1, "rgba(20, 21, 24, 0)");
      ctx.fillStyle = shadowGrad;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        viewH * 0.88,
        Math.max(28, drawW * 0.46 * (0.45 + 0.55 * absCos)),
        11,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 12-Layer 3D Fabric Volume Extrusion Stack + Real Ghost-Mannequin Photo!
      const thicknessPx = 14 * Math.abs(sinY) * zoom;
      const layers = 10;
      for (let l = layers; l >= 0; l--) {
        const depthOffset = (l / layers - 0.5) * thicknessPx * (sinY >= 0 ? 1 : -1);
        ctx.save();
        ctx.translate(cx + depthOffset, cy);
        ctx.scale(perspX, perspY);
        if (l > 0) {
          ctx.filter = "brightness(0.86) contrast(1.04)";
          ctx.globalAlpha = 0.45;
        } else {
          ctx.filter = "none";
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(im, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
      }

      // Dynamic Sweeping Studio Rim Specular Sheen as product rotates in 3D
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(Math.abs(perspX), perspY);
      ctx.globalCompositeOperation = "source-atop";
      const sheenX = sinY * drawW * 0.45;
      const sheen = ctx.createLinearGradient(
        sheenX - drawW * 0.25,
        -drawH / 2,
        sheenX + drawW * 0.25,
        drawH / 2
      );
      sheen.addColorStop(0, "rgba(255,255,255,0)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0.16)");
      sheen.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = sheen;
      ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      ctx.restore();
    };

    const paintAvatar = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, viewW, viewH);

      const normDeg =
        ((((yawRef.current * 180) / Math.PI) % 360) + 360) % 360;
      const pitch = pitchRef.current;
      const zoom = zoomRef.current;

      // Determine primary & secondary quadrant angles for silky 360° turnaround
      // 0° = front, 90° = right side, 180° = back, 270° = left side (mirrored)
      let primaryKind: "front" | "side" | "back" = "front";
      let mirrorSide = false;
      let foreshorten = 1.0;

      // Check if side image is already decoded for current topIdx
      const sideTestUrl = `${BASE}/models/runway_ai/ae_outfit_${lookSpec.topIdx}_side.webp?v=life4`;
      const hasSideDecoded = Boolean(
        IMG_CACHE.get(sideTestUrl)?.complete &&
          (IMG_CACHE.get(sideTestUrl)?.naturalWidth || 0) > 0
      );
      // Trigger background preload of side view
      loadCachedImage(sideTestUrl, requestRepaint);

      if (hasSideDecoded) {
        if (normDeg >= 52 && normDeg < 128) {
          primaryKind = "side";
          mirrorSide = false;
          const dist90 = Math.abs(normDeg - 90) / 38;
          foreshorten = lerp(1.0, 0.9, dist90);
        } else if (normDeg >= 128 && normDeg < 232) {
          primaryKind = "back";
          const dist180 = Math.abs(normDeg - 180) / 52;
          foreshorten = lerp(1.0, 0.88, dist180);
        } else if (normDeg >= 232 && normDeg < 308) {
          primaryKind = "side";
          mirrorSide = true;
          const dist270 = Math.abs(normDeg - 270) / 38;
          foreshorten = lerp(1.0, 0.9, dist270);
        } else {
          primaryKind = "front";
          const dist0 = Math.min(normDeg, 360 - normDeg) / 52;
          foreshorten = lerp(1.0, 0.88, dist0);
        }
      } else {
        // Smooth Front <-> Back 3D turnaround while side asset streams in
        const rad = (normDeg * Math.PI) / 180;
        const cosA = Math.cos(rad);
        primaryKind = cosA >= 0 ? "front" : "back";
        foreshorten = 0.72 + 0.28 * Math.abs(cosA);
      }

      const ready = composeAngleLayer(primaryKind, mirrorSide);
      if (!ready) {
        ctx.restore();
        return;
      }

      // Compute Photorealistic Body-Scan Proportions relative to baseline 5'2" (32.25 / 27 / 34)
      const heightScale = clamp(dimensions.heightInches / 62, 0.92, 1.10);
      const sShoulder = clamp(dimensions.shoulderInches / 15.0, 0.88, 1.20);
      const sBust = clamp(dimensions.bustInches / 32.25, 0.86, 1.34);
      const sWaist = clamp(dimensions.waistInches / 27.0, 0.80, 1.34);
      const sHips = clamp(dimensions.hipsInches / 34.0, 0.86, 1.36);

      const widthWarpAtV = (v: number): number => {
        if (v < 0.175) return 1.0; // Never distort head/face!
        if (v < 0.215) return lerp(1.0, sShoulder, smoothstep(0.175, 0.215, v));
        if (v < 0.285) return lerp(sShoulder, sBust, smoothstep(0.215, 0.285, v));
        if (v < 0.37) return lerp(sBust, sWaist, smoothstep(0.285, 0.37, v));
        if (v < 0.485) return lerp(sWaist, sHips, smoothstep(0.37, 0.485, v));
        if (v < 0.66) return lerp(sHips, lerp(sHips, 1.0, 0.55), smoothstep(0.485, 0.66, v));
        if (v < 0.86) return lerp(lerp(sHips, 1.0, 0.55), 1.0, smoothstep(0.66, 0.86, v));
        return 1.0;
      };

      // Commanding Stage Framing (fills ~92% of stage height cleanly above bottom HUD!)
      const bottomMargin = showHud ? (compactHud ? 34 : 44) : 10;
      const topMargin = showHud ? (compactHud ? 26 : 34) : 8;
      const availH = Math.max(120, viewH - topMargin - bottomMargin);
      const baseH = Math.min(availH * 0.98 * heightScale, viewW * 1.42) * zoom;
      const baseW = baseH * (900 / 1355);

      const centerX = viewW / 2;
      const bottomY = viewH - bottomMargin + pitch * 16;
      const topY = bottomY - baseH;

      paintedAvatarBoxRef.current = {
        x: centerX - baseW / 2,
        y: topY,
        w: baseW,
        h: baseH,
      };

      // 1. Floor Contact Shadow (Seamless on NYC Loft floor when `seamlessStage` is true!)
      const podiumRx = Math.max(64, baseW * 0.42);
      const podiumRy = Math.max(10, podiumRx * (0.15 + Math.max(0, pitch) * 0.18));
      const podiumGrad = ctx.createRadialGradient(
        centerX,
        bottomY - 4,
        8,
        centerX,
        bottomY - 4,
        podiumRx * 1.15
      );
      podiumGrad.addColorStop(0, seamlessStage ? "rgba(24, 22, 21, 0.28)" : "rgba(25, 28, 34, 0.22)");
      podiumGrad.addColorStop(0.75, seamlessStage ? "rgba(24, 22, 21, 0.08)" : "rgba(25, 28, 34, 0.06)");
      podiumGrad.addColorStop(1, "rgba(25, 28, 34, 0)");
      ctx.fillStyle = podiumGrad;
      ctx.beginPath();
      ctx.ellipse(centerX, bottomY - 3, podiumRx * 1.06, podiumRy, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!seamlessStage) {
        ctx.strokeStyle = "rgba(36, 75, 59, 0.20)";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.ellipse(centerX, bottomY - 3, podiumRx * 0.88, podiumRy * 0.82, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Helper for 3D Occluded Body-Scan Tape Rings (back half behind body, front half in front!)
      const tapeRings = [
        {
          v: 0.285,
          color: "#10B981",
          label: `${dimensions.bustInches}" B`,
          rxFactor: 0.21 * sBust,
        },
        {
          v: 0.372,
          color: "#244B3B",
          label: `${dimensions.waistInches}" W`,
          rxFactor: 0.175 * sWaist,
        },
        {
          v: 0.482,
          color: "#0EA5E9",
          label: `${dimensions.hipsInches}" H`,
          rxFactor: 0.235 * sHips,
        },
      ];

      if (effectiveShowRings || activeVisualMode === "xray") {
        // Draw BACK half of 3D tape ellipses BEFORE drawing the human cutout!
        for (const ring of tapeRings) {
          const ry = topY + baseH * ring.v;
          const rx = baseW * ring.rxFactor * foreshorten;
          ctx.save();
          ctx.strokeStyle = ring.color;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rx, Math.max(5, rx * 0.2), 0, Math.PI, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 2. Render 96-Slice Scanline-Warped Photorealistic Human Avatar!
      const SLICES = 96;
      const srcSliceH = 1355 / SLICES;
      const dstSliceH = baseH / SLICES;

      for (let i = 0; i < SLICES; i++) {
        const v = (i + 0.5) / SLICES;
        const wScale = widthWarpAtV(v) * foreshorten;
        const dw = baseW * wScale;
        const dx = centerX - dw / 2;
        const dy = topY + i * dstSliceH;
        // 0.8px overlap prevents subpixel horizontal hairlines on fractional DPRs
        ctx.drawImage(
          compCv,
          0,
          Math.max(0, i * srcSliceH - 0.4),
          900,
          Math.min(1355 - i * srcSliceH, srcSliceH + 0.9),
          dx,
          dy - 0.35,
          dw,
          dstSliceH + 0.75
        );
      }

      // 3. Draw FRONT half of 3D Body-Scan Tape Ellipses + Exact Inch Callouts OVER her front!
      if (effectiveShowRings || activeVisualMode === "xray") {
        const primarySpec = wornPieces[0];
        const fit = primarySpec ? fitByProductId.get(primarySpec.product.id) : undefined;

        tapeRings.forEach((ring, idx) => {
          const ry = topY + baseH * ring.v;
          const rx = baseW * ring.rxFactor * foreshorten;
          ctx.save();
          ctx.strokeStyle = ring.color;
          ctx.lineWidth = 2.4;
          ctx.shadowColor = "rgba(255,255,255,0.7)";
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rx, Math.max(5, rx * 0.2), 0, 0, Math.PI);
          ctx.stroke();

          // Callout pill beside ring
          if (!compactHud || idx === 1) {
            const zoneName = idx === 0 ? "Bust" : idx === 1 ? "Waist" : "Hips";
            const zInfo = fit?.zones.find((z) => z.zone === zoneName);
            const pillTxt =
              activeVisualMode === "xray" && zInfo
                ? `${zoneName}: ${zInfo.easeInches >= 0 ? "+" : ""}${zInfo.easeInches.toFixed(
                    1
                  )}" (${zInfo.feelLabel})`
                : ring.label;

            ctx.font = "700 10px system-ui, -apple-system, sans-serif";
            const tw = ctx.measureText(pillTxt).width;
            const px =
              idx % 2 === 0
                ? Math.min(viewW - tw - 18, centerX + rx + 8)
                : Math.max(8, centerX - rx - tw - 20);
            const py = ry - 9;

            ctx.shadowBlur = 6;
            ctx.shadowColor = "rgba(20,21,24,0.12)";
            ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
            ctx.beginPath();
            ctx.roundRect(px, py, tw + 12, 18, 9);
            ctx.fill();

            ctx.shadowBlur = 0;
            ctx.fillStyle = "#141518";
            ctx.fillText(pillTxt, px + 6, py + 12.5);
          }
          ctx.restore();
        });
      }

      ctx.restore();
    };

    let rafId = 0;
    let lastTime = performance.now();
    let frameTick = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoSpinRef.current && !dragging) {
        targetYawRef.current += dt * 0.72;
        needsPaintRef.current = true;
      } else if (inertiaSpin && !dragging && Math.abs(velYawRef.current) > 0.02) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.6 * dt);
        if (Math.abs(velYawRef.current) <= 0.02) {
          velYawRef.current = 0;
        }
        needsPaintRef.current = true;
      }

      const dYaw = targetYawRef.current - yawRef.current;
      const dPitch = targetPitchRef.current - pitchRef.current;
      const dZoom = targetZoomRef.current - zoomRef.current;

      if (
        Math.abs(dYaw) > 0.0004 ||
        Math.abs(dPitch) > 0.0004 ||
        Math.abs(dZoom) > 0.0004
      ) {
        const damp = 1 - Math.exp(-12 * dt);
        yawRef.current += dYaw * damp;
        pitchRef.current += dPitch * damp;
        zoomRef.current += dZoom * damp;
        needsPaintRef.current = true;
      }

      if (needsPaintRef.current) {
        if (mode === "product") {
          paintProduct3D();
        } else {
          paintAvatar();
        }
        needsPaintRef.current = false;

        frameTick++;
        if (frameTick % 3 === 0) {
          const deg =
            (((Math.round((yawRef.current * 180) / Math.PI) % 360) + 360) %
              360);
          setLiveDeg(deg);
          onYawChangeRef.current?.(deg);
        }
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("pointercancel", onPointerUp);
      cv.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeVisualMode,
    compactHud,
    dimensions,
    effectiveShowRings,
    faceOvalDataUrl,
    fitByProductId,
    inertiaSpin,
    lookSpec,
    mode,
    seamlessStage,
    showHud,
    singleProduct,
    wornPieces,
  ]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    targetYawRef.current = (deg * Math.PI) / 180;
    targetPitchRef.current = 0;
    needsPaintRef.current = true;
  };

  return (
    <div
      data-3d-engine="lifelike-360"
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : wornPieces.length}
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
    >
      {/* Interactive High-DPI Lifelike Canvas */}
      <div
        ref={wrapRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ touchAction: "pan-y" }}
        />
      </div>

      {/* Top-Left Scanned Body Twin Live Badge (sm+ screens) */}
      {showHud && mode === "avatar" && !compactHud && (
        <div className="pointer-events-none hidden sm:flex absolute top-2.5 left-2.5 z-10 flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1">
            <Ruler className="w-3 h-3 text-[#244B3B]" />
            {formatHeightFeetInches(dimensions.heightInches)} •{" "}
            {dimensions.bustInches}&quot; B • {dimensions.waistInches}&quot; W •{" "}
            {dimensions.hipsInches}&quot; H
          </span>
          <span className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold">
            {liveDeg}°
          </span>
        </div>
      )}

      {/* Top-Right Lifelike Fit Mode Switcher (Lifelike | Fit Map | Ease X-Ray) */}
      {showHud && (
        <div
          className={`absolute ${
            compactHud ? "top-1.5 left-1.5" : "top-2.5 right-2.5"
          } z-10 inline-flex items-center gap-0.5 p-0.5 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs`}
        >
          <button
            type="button"
            onClick={() => setVisualMode("studio")}
            className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              activeVisualMode === "studio"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
          >
            <Sparkles className="w-2.5 h-2.5" /> Lifelike
          </button>
          {mode === "avatar" && (
            <>
              <button
                type="button"
                onClick={() => setVisualMode("heatmap")}
                className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                  activeVisualMode === "heatmap"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
                title="Highlight exact garment fit zones over your lifelike avatar"
              >
                <Flame className="w-2.5 h-2.5 text-[#F59E0B]" /> Fit Map
              </button>
              <button
                type="button"
                onClick={() => setVisualMode("xray")}
                className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                  activeVisualMode === "xray"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
                title="Show exact inch ease callouts across Bust, Waist & Hips"
              >
                <Eye className="w-2.5 h-2.5 text-[#0EA5E9]" /> Ease
              </button>
            </>
          )}
        </div>
      )}

      {/* Tapped Garment Callout Pill */}
      {showHud && tappedInfo && !compactHud && (
        <div className="absolute left-2.5 bottom-12 z-10 max-w-[260px] px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.09] shadow-md flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold text-[#141518] truncate">
              {tappedInfo.product.title}
            </p>
            {tappedInfo.fit && (
              <p className="text-[10px] font-semibold text-[#244B3B] truncate">
                Size {tappedInfo.fit.recommendedSize} •{" "}
                {tappedInfo.fit.confidencePct}% Safe Fit
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTappedInfo(null)}
            className="text-[10px] font-bold text-[#686D76] hover:text-[#141518] px-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Heatmap Legend Pill */}
      {showHud && activeVisualMode === "heatmap" && !compactHud && (
        <div className="pointer-events-none absolute right-2.5 bottom-12 z-10 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs flex items-center gap-2 text-[9.5px] font-bold text-[#141518]">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" /> Exact Fit
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" /> Snug
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#EF4444]" /> Tight
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#06B6D4]" /> Roomy
          </span>
        </div>
      )}

      {/* Bottom Interactive 360° Spin & Zoom Bar */}
      {showHud && (
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-sm">
            {(
              [
                [0, "Front 0°"],
                [90, "Side 90°"],
                [180, "Back 180°"],
              ] as const
            ).map(([deg, label]) => (
              <button
                key={deg}
                type="button"
                onClick={() => snapAngle(deg)}
                className="px-2 py-1 rounded-full text-[10px] font-bold text-[#141518] hover:bg-[#EAECEF] cursor-pointer transition min-h-[24px]"
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAutoSpin((s) => !s)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[24px] ${
                autoSpin
                  ? "bg-[#244B3B] text-white"
                  : "bg-[#F1F3F6] text-[#141518] hover:bg-[#E2E6EC]"
              }`}
            >
              {autoSpin ? (
                <>
                  <Pause className="w-2.5 h-2.5" /> Spinning
                </>
              ) : (
                <>
                  <Play className="w-2.5 h-2.5" /> 360° Spin
                </>
              )}
            </button>

            {!compactHud && mode === "avatar" && (
              <button
                type="button"
                onClick={() => setShowRings((r) => !r)}
                className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[24px] ${
                  effectiveShowRings
                    ? "bg-[#E7F3EE] text-[#1D4232]"
                    : "text-[#686D76] hover:bg-[#EAECEF]"
                }`}
                title="Show 3D Bust / Waist / Hip body-scan tape rings"
              >
                <Ruler className="w-2.5 h-2.5" /> Tape
              </button>
            )}

            {!compactHud && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    targetZoomRef.current = Math.min(
                      1.55,
                      targetZoomRef.current + 0.14
                    );
                    needsPaintRef.current = true;
                  }}
                  aria-label="Zoom in"
                  className="hidden sm:inline-flex p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] items-center justify-center"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    targetZoomRef.current = Math.max(
                      0.78,
                      targetZoomRef.current - 0.14
                    );
                    needsPaintRef.current = true;
                  }}
                  aria-label="Zoom out"
                  className="hidden sm:inline-flex p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] items-center justify-center"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    targetYawRef.current = 0;
                    targetPitchRef.current = 0;
                    targetZoomRef.current = 1.0;
                    needsPaintRef.current = true;
                  }}
                  aria-label="Reset view"
                  className="hidden sm:inline-flex p-1 rounded-full hover:bg-[#EAECEF] text-[#686D76] hover:text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] items-center justify-center"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

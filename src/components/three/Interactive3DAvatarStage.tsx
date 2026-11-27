"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  Box,
  Eye,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Sparkles,
  Sun,
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
import { classifyWearableSlotAndAnchors } from "@/lib/three/avatar-ready-pipeline";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { loadStandalone3DItemInstance } from "@/lib/three/glb-character-engine";
import {
  extractProcessedPosterBitmap,
  extractTurntableBitmapBundle,
  getCachedTurntableBundleSync,
  resolveTurntableSpecForOutfit,
} from "@/lib/three/higgsfield-turntable-engine";
import {
  ImmersiveLightingPresetId,
  MASTER_IMMERSIVE_LIGHTING_PRESETS,
  MASTER_LIGHTING_PRESET_ORDER,
  MASTER_REALISM_SPEC_VERSION,
  enforceRealisticAvatarAnatomy,
} from "@/lib/realism/master-avatar-clothing-realism";

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
  externalSpinActive?: boolean;
  onAutoSpinChange?: (spinning: boolean) => void;
  initialYawDeg?: number;
  externalYawDeg?: number;
  externalYawSeq?: number;
  seamlessStage?: boolean;
  inertiaSpin?: boolean;
  onYawChange?: (deg: number) => void;
  showHud?: boolean;
  compactHud?: boolean;
  selectedProductId?: string | null;
  onSelectProduct?: (product: Product, fit?: AvatarExactFitReport) => void;
  className?: string;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function shortestAngleDeltaRad(fromRad: number, toRad: number): number {
  return Math.atan2(Math.sin(toRad - fromRad), Math.cos(toRad - fromRad));
}

function feelToRgba(feel: ZoneFeel | undefined, alpha: number): string {
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

const LIGHT_MOOD_FILTERS: Record<ImmersiveLightingPresetId, string> = {
  editorial_daylight: "none",
  golden_atelier: "sepia(0.08) saturate(1.06) brightness(1.01)",
  runway_spotlight: "contrast(1.04) brightness(1.02)",
  evening_soiree: "sepia(0.12) saturate(1.08) contrast(1.03)",
};

let cachedCompanionDefaults: {
  top?: Product;
  bottom?: Product;
  shoes?: Product;
} | null = null;

function getNeutralCompanionDefaults() {
  if (!cachedCompanionDefaults) {
    const cat = buildTopLineAliExpressDropshipCatalog();
    cachedCompanionDefaults = {
      top: cat.find((p) => p.id === "prod-ae-acetate-beaded-tank"),
      bottom: cat.find((p) => p.id === "prod-ae-champagne-trousers"),
      shoes: cat.find((p) => p.id === "prod-ae-noir-slingbacks"),
    };
  }
  return cachedCompanionDefaults;
}

/**
 * HIGGSFIELD 360° ALL-INTRA MP4 -> IMAGEBITMAP[] 60FPS INERTIA TURNTABLE STAGE
 * - Restores the Original-Prompt (`commit 5d13ab5`) `ImageBitmap[]` 60fps inertia turntable scrubber!
 * - Scrubs 96 real studio frames (`0° -> 45° -> 90° -> 135° -> 180° -> 225° -> 270° -> 315° -> 360°`)
 *   generated via Higgsfield Kling 3.0 Omni (`kling_o3_flf`) and All-Intra (`-g 1`) encoded.
 * - Strictly locks camera level (`0°` pitch) with horizontal-only touch gesture detection so mobile
 *   iPhone vertical scrolling is 100% smooth and NEVER tilts under her chin!
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
  externalSpinActive,
  onAutoSpinChange,
  initialYawDeg = 0,
  externalYawDeg,
  externalYawSeq,
  seamlessStage = false,
  inertiaSpin = true,
  onYawChange,
  showHud = true,
  compactHud = false,
  selectedProductId,
  onSelectProduct,
  className = "",
}: Interactive3DAvatarStageProps) {
  const avatarStageRef = useRef<HTMLDivElement | null>(null);
  const scrubCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const posterImgRef = useRef<HTMLImageElement | null>(null);
  const prodWrapRef = useRef<HTMLDivElement | null>(null);

  const onYawChangeRef = useRef(onYawChange);
  onYawChangeRef.current = onYawChange;
  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;
  const onAutoSpinChangeRef = useRef(onAutoSpinChange);
  onAutoSpinChangeRef.current = onAutoSpinChange;

  const yawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const targetYawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const velYawRef = useRef<number>(0);
  const zoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);

  const [internalVisualMode, setInternalVisualMode] =
    useState<Render3DVisualMode>("studio");
  const activeVisualMode = controlledVisualMode ?? internalVisualMode;
  const visualModeRef = useRef(activeVisualMode);
  visualModeRef.current = activeVisualMode;

  const [autoSpin, setAutoSpinState] = useState<boolean>(autoSpinDefault);
  const setAutoSpin = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      setAutoSpinState((prev) => {
        const next = typeof val === "function" ? val(prev) : val;
        if (next !== prev) {
          onAutoSpinChangeRef.current?.(next);
        }
        return next;
      });
    },
    []
  );
  const autoSpinRef = useRef<boolean>(autoSpinDefault);
  autoSpinRef.current = autoSpin;

  useEffect(() => {
    if (typeof externalSpinActive === "boolean") {
      setAutoSpinState(externalSpinActive);
    }
  }, [externalSpinActive]);

  const [showRings, setShowRings] = useState<boolean>(Boolean(propShowRings));
  const effectiveShowRings = propShowRings ?? showRings;
  const showRingsRef = useRef(effectiveShowRings);
  showRingsRef.current = effectiveShowRings;

  const [lightingPresetId, setLightingPresetId] =
    useState<ImmersiveLightingPresetId>("editorial_daylight");
  const activeLightingPreset =
    MASTER_IMMERSIVE_LIGHTING_PRESETS[lightingPresetId];
  const cycleLightingPreset = useCallback(() => {
    setLightingPresetId((prev) => {
      const idx = MASTER_LIGHTING_PRESET_ORDER.indexOf(prev);
      return MASTER_LIGHTING_PRESET_ORDER[
        (idx + 1) % MASTER_LIGHTING_PRESET_ORDER.length
      ];
    });
  }, []);

  const safeDimensions = useMemo(
    () => enforceRealisticAvatarAnatomy(dimensions),
    [dimensions]
  );
  const dimsRef = useRef(safeDimensions);
  dimsRef.current = safeDimensions;

  const [liveDeg, setLiveDeg] = useState<number>(
    ((Math.round(initialYawDeg) % 360) + 360) % 360
  );
  const [tappedInfo, setTappedInfo] = useState<{
    product: Product;
    fit?: AvatarExactFitReport;
  } | null>(null);
  const [framesReady, setFramesReady] = useState<boolean>(false);
  const [isLoadingFrames, setIsLoadingFrames] = useState<boolean>(false);

  const framesRef = useRef<ImageBitmap[]>([]);
  const frameKindRef = useRef<"higgsfield_mp4" | "unwarped_modular_quad">(
    "higgsfield_mp4"
  );
  const posterBitmapRef = useRef<ImageBitmap | null>(null);
  const faceOvalImgRef = useRef<HTMLImageElement | null>(null);

  const setVisualMode = useCallback(
    (m: Render3DVisualMode) => {
      setInternalVisualMode(m);
      onVisualModeChange?.(m);
    },
    [onVisualModeChange]
  );

  useEffect(() => {
    if (typeof externalYawDeg === "number") {
      setAutoSpin(false);
      velYawRef.current = 0;
      const desiredRad = (externalYawDeg * Math.PI) / 180;
      targetYawRef.current =
        yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
    }
  }, [externalYawDeg, externalYawSeq, setAutoSpin]);

  useEffect(() => {
    if (!faceOvalDataUrl) {
      faceOvalImgRef.current = null;
      return;
    }
    const im = new Image();
    im.onload = () => {
      faceOvalImgRef.current = im;
    };
    im.src = faceOvalDataUrl;
  }, [faceOvalDataUrl]);

  const { userSelectedProducts, effectiveEquippedProducts } = useMemo(() => {
    const chosen = new Map<string, Product>();
    let hasDress = false;
    for (const w of wornPieces) {
      const slot = classifyWearableSlotAndAnchors(w.product).slot;
      if (slot === "dress" && !hasDress) {
        hasDress = true;
        chosen.set("dress", w.product);
      } else if ((slot === "top" || slot === "bottom") && hasDress) {
        continue;
      } else if (!chosen.has(slot)) {
        chosen.set(slot, w.product);
      }
    }
    if (hasDress) {
      chosen.delete("top");
      chosen.delete("bottom");
    }
    const userList = Array.from(chosen.values());
    if (userList.length === 0) {
      return { userSelectedProducts: [], effectiveEquippedProducts: [] };
    }

    const fullMap = new Map(chosen);
    const companions = getNeutralCompanionDefaults();
    if (!hasDress) {
      if (!fullMap.has("top") && companions.top) {
        fullMap.set("top", companions.top);
      }
      if (!fullMap.has("bottom") && companions.bottom) {
        fullMap.set("bottom", companions.bottom);
      }
    }
    if (!fullMap.has("shoes") && companions.shoes) {
      fullMap.set("shoes", companions.shoes);
    }
    return {
      userSelectedProducts: userList,
      effectiveEquippedProducts: Array.from(fullMap.values()),
    };
  }, [wornPieces]);

  const equippedRef = useRef(effectiveEquippedProducts);
  equippedRef.current = effectiveEquippedProducts;

  const fitByProductId = useMemo(() => {
    const map = new Map<string, AvatarExactFitReport>();
    const list =
      mode === "product" && singleProduct
        ? [{ product: singleProduct, selectedSize }]
        : [
            ...wornPieces,
            ...effectiveEquippedProducts.map((product) => ({
              product,
              selectedSize,
            })),
          ];
    for (const item of list) {
      if (map.has(item.product.id)) continue;
      map.set(
        item.product.id,
        analyzeExactAvatarFit(
          {
            heightInches: safeDimensions.heightInches,
            bustInches: safeDimensions.bustInches,
            waistInches: safeDimensions.waistInches,
            hipsInches: safeDimensions.hipsInches,
            shoeSize: safeDimensions.shoeSize,
          },
          item.product,
          item.selectedSize || selectedSize
        )
      );
    }
    return map;
  }, [
    effectiveEquippedProducts,
    mode,
    safeDimensions,
    selectedSize,
    singleProduct,
    wornPieces,
  ]);

  const fitByProductIdRef = useRef(fitByProductId);
  fitByProductIdRef.current = fitByProductId;

  useEffect(() => {
    if (selectedProductId) {
      const found =
        wornPieces.find((w) => w.product.id === selectedProductId)?.product ||
        effectiveEquippedProducts.find((p) => p.id === selectedProductId);
      if (found) {
        setTappedInfo({
          product: found,
          fit: fitByProductId.get(found.id),
        });
      }
    }
  }, [effectiveEquippedProducts, fitByProductId, selectedProductId, wornPieces]);

  const turntableSpec = useMemo(
    () =>
      resolveTurntableSpecForOutfit(
        userSelectedProducts,
        effectiveEquippedProducts
      ),
    [effectiveEquippedProducts, userSelectedProducts]
  );

  // Load Poster + Decode 96 `ImageBitmap` Frames from Higgsfield All-Intra MP4!
  useEffect(() => {
    if (mode !== "avatar") return;
    let cancelled = false;
    frameKindRef.current = turntableSpec.kind;

    // 1. Instant 0ms synchronous LRU hit if already decoded in RAM!
    const syncHit = getCachedTurntableBundleSync(turntableSpec, seamlessStage);
    if (syncHit && syncHit.frames.length > 0) {
      framesRef.current = syncHit.frames;
      setFramesReady(true);
      setIsLoadingFrames(false);
      return;
    }

    // 2. Otherwise clear stale outfit frames immediately and paint the new outfit's processed poster (<25ms)!
    framesRef.current = [];
    posterBitmapRef.current = null;
    setFramesReady(false);

    void extractProcessedPosterBitmap(turntableSpec, seamlessStage).then(
      (pBmp) => {
        if (!cancelled && pBmp) {
          posterBitmapRef.current = pBmp;
        }
      }
    );

    const spinnerTimer = setTimeout(() => {
      if (!cancelled && framesRef.current.length === 0) {
        setIsLoadingFrames(true);
      }
    }, 260);

    void extractTurntableBitmapBundle(turntableSpec, seamlessStage)
      .then((bundle) => {
        clearTimeout(spinnerTimer);
        if (cancelled) return;
        framesRef.current = bundle.frames;
        setFramesReady(bundle.frames.length > 0);
        setIsLoadingFrames(false);
      })
      .catch(() => {
        clearTimeout(spinnerTimer);
        if (!cancelled) setIsLoadingFrames(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(spinnerTimer);
    };
  }, [mode, seamlessStage, turntableSpec]);

  // 60FPS `ImageBitmap[]` Scrubber + Inertia Physics + Horizontal-Only Touch Lock!
  useEffect(() => {
    if (mode !== "avatar") return;
    const stageEl = avatarStageRef.current;
    const canvas = scrubCanvasRef.current;
    if (!stageEl || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cw = 432;
    let ch = 768;
    let dpr = 1;

    const updateCanvasSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.max(160, stageEl.clientWidth);
      ch = Math.max(200, stageEl.clientHeight);
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    };
    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(stageEl);

    let pointerDown = false;
    let horizontalLocked = false;
    let startX = 0;
    let startY = 0;
    let lastMoveX = 0;
    let lastMoveTs = 0;
    let startYaw = 0;
    let movedDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest("button")) return;
      pointerDown = true;
      horizontalLocked = e.pointerType !== "touch";
      movedDist = 0;
      startX = e.clientX;
      startY = e.clientY;
      lastMoveX = e.clientX;
      lastMoveTs = performance.now();
      velYawRef.current = 0;
      startYaw = targetYawRef.current;
      if (e.pointerType !== "touch") {
        try {
          stageEl.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDist = Math.hypot(dx, dy);

      // On mobile touch: allow native vertical page scroll whenever vertical movement dominates!
      if (!horizontalLocked) {
        if (movedDist < 6) return;
        if (Math.abs(dy) >= Math.abs(dx) * 0.95) {
          pointerDown = false;
          return;
        }
        horizontalLocked = true;
        try {
          stageEl.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }

      const nowTs = performance.now();
      const dtMove = Math.max(8, nowTs - lastMoveTs) / 1000;
      const stepDx = e.clientX - lastMoveX;
      lastMoveX = e.clientX;
      lastMoveTs = nowTs;

      if (movedDist > 4 && autoSpinRef.current) {
        setAutoSpin(false);
      }

      // Drag right (+dx) spins her clockwise through 0° -> 90° -> 180° -> 270° -> 360°!
      const radPerPx = (Math.PI * 2) / Math.max(240, cw * 0.72);
      if (inertiaSpin) {
        const instV = (stepDx * radPerPx) / dtMove;
        velYawRef.current =
          velYawRef.current * 0.55 + clamp(instV, -11, 11) * 0.45;
      }
      targetYawRef.current = startYaw + dx * radPerPx;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      if (performance.now() - lastMoveTs > 90) {
        velYawRef.current = 0;
      }
      try {
        if (stageEl.hasPointerCapture(e.pointerId)) {
          stageEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }

      // Tap-to-inspect equipped garments/bags!
      if (movedDist < 6 && equippedRef.current.length > 0) {
        const rect = stageEl.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / Math.max(1, rect.width);
        const ry = (e.clientY - rect.top) / Math.max(1, rect.height);
        if (rx > 0.24 && rx < 0.76 && ry > 0.12 && ry < 0.92) {
          const items = equippedRef.current;
          let picked: Product | undefined;
          const bagProd = items.find(
            (p) => classifyWearableSlotAndAnchors(p).slot === "bag"
          );
          if (bagProd && (rx < 0.42 || rx > 0.58) && ry > 0.25 && ry < 0.62) {
            picked = bagProd;
          } else if (ry > 0.78) {
            picked = items.find(
              (p) => classifyWearableSlotAndAnchors(p).slot === "shoes"
            );
          } else if (ry > 0.46) {
            picked = items.find((p) => {
              const s = classifyWearableSlotAndAnchors(p).slot;
              return s === "bottom" || s === "dress";
            });
          } else {
            picked = items.find((p) => {
              const s = classifyWearableSlotAndAnchors(p).slot;
              return s === "outerwear" || s === "top" || s === "dress";
            });
          }
          if (picked) {
            const fit = fitByProductIdRef.current.get(picked.id);
            setTappedInfo({ product: picked, fit });
            onSelectProductRef.current?.(picked, fit);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0 && (window.innerWidth > 820 || e.ctrlKey)) {
        e.preventDefault();
        targetZoomRef.current = clamp(
          targetZoomRef.current - Math.sign(e.deltaY) * 0.08,
          0.82,
          1.52
        );
      }
    };

    stageEl.addEventListener("pointerdown", onPointerDown);
    stageEl.addEventListener("pointermove", onPointerMove);
    stageEl.addEventListener("pointerup", onPointerUp);
    stageEl.addEventListener("pointercancel", onPointerUp);
    stageEl.addEventListener("wheel", onWheel, { passive: false });

    let rafId = 0;
    let lastTime = performance.now();
    let frameTick = 0;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoSpinRef.current && !pointerDown) {
        targetYawRef.current += dt * 0.92;
      } else if (
        inertiaSpin &&
        !pointerDown &&
        Math.abs(velYawRef.current) > 0.02
      ) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.4 * dt);
        if (Math.abs(velYawRef.current) <= 0.02) velYawRef.current = 0;
      }

      const damp = 1 - Math.exp(-14 * dt);
      yawRef.current += (targetYawRef.current - yawRef.current) * damp;
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * damp;

      const normProgress =
        (((yawRef.current / (Math.PI * 2)) % 1) + 1) % 1;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cw, ch);
      if (!seamlessStage) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cw, ch);
      }

      const frames = framesRef.current;
      const dims = dimsRef.current;
      const zoom = zoomRef.current;

      // Frame geometry inside stage (leaves clean headroom below top edge / HUD pills on mobile & desktop!)
      const isNarrowMobile = cw < 430;
      const topPad = showHud
        ? compactHud
          ? 40
          : 50
        : Math.round(ch * 0.045);
      const botPad = showHud
        ? isNarrowMobile
          ? 70
          : compactHud
          ? 44
          : 50
        : Math.round(ch * 0.025);
      const availH = Math.max(120, ch - topPad - botPad);

      // Source keyframes have crown at y=250/1920 (0.130) and sole at y=1700/1920 (0.885 -> body span 0.755 of frame height)
      const hScale = clamp(dims.heightInches / 64.0, 0.95, 1.04);
      const drawH = (availH / 0.81) * zoom * hScale;
      const drawW = drawH * (9 / 16);
      const centerX = cw * 0.5;
      // Anchor shoe soles cleanly above bottom HUD pill!
      const soleScreenY = topPad + availH * 0.975;
      const drawY = soleScreenY - drawH * 0.888;

      const cosInterp = (a: number, b: number, t: number) => {
        const u = clamp(t, 0, 1);
        const w = (1 - Math.cos(u * Math.PI)) * 0.5;
        return a + (b - a) * w;
      };

      const drawSlicedPortrait = (
        source: CanvasImageSource,
        srcW: number,
        srcH: number,
        alpha = 1.0
      ) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        // Craniofacially-locked C1-continuous body-scan curve (0px step seams, head/face 100% locked 1:1!)
        const shS = clamp(1 + (dims.shoulderInches / 15.2 - 1) * 0.22, 0.96, 1.05);
        const buS = clamp(1 + (dims.bustInches / 36.0 - 1) * 0.22, 0.95, 1.06);
        const waS = clamp(1 + (dims.waistInches / 27.5 - 1) * 0.24, 0.94, 1.06);
        const hiS = clamp(1 + (dims.hipsInches / 38.5 - 1) * 0.25, 0.95, 1.07);

        const isIdentityScale =
          Math.abs(shS - 1) < 0.008 &&
          Math.abs(buS - 1) < 0.008 &&
          Math.abs(waS - 1) < 0.008 &&
          Math.abs(hiS - 1) < 0.008;

        if (isIdentityScale) {
          ctx.drawImage(source, centerX - drawW * 0.5, drawY, drawW, drawH);
        } else {
          const BANDS = 48;
          for (let b = 0; b < BANDS; b++) {
            const f0 = b / BANDS;
            const f1 = (b + 1) / BANDS;
            const fm = (f0 + f1) * 0.5;
            let sxBand = 1.0;
            if (fm < 0.23) {
              sxBand = 1.0; // Head & face strictly locked 1:1!
            } else if (fm < 0.31) {
              sxBand = cosInterp(1.0, shS, (fm - 0.23) / 0.08);
            } else if (fm < 0.39) {
              sxBand = cosInterp(shS, buS, (fm - 0.31) / 0.08);
            } else if (fm < 0.47) {
              sxBand = cosInterp(buS, waS, (fm - 0.39) / 0.08);
            } else if (fm < 0.58) {
              sxBand = cosInterp(waS, hiS, (fm - 0.47) / 0.11);
            } else if (fm < 0.78) {
              sxBand = cosInterp(hiS, 1.0, (fm - 0.58) / 0.20);
            }

            const sy = Math.floor(f0 * srcH);
            const sh = Math.max(1, Math.ceil(f1 * srcH) - sy);
            const dy = drawY + f0 * drawH;
            const dh = (sh / srcH) * drawH + 0.45;
            const bw = drawW * sxBand;
            ctx.drawImage(
              source,
              0,
              sy,
              srcW,
              sh,
              centerX - bw * 0.5,
              dy,
              bw,
              dh
            );
          }
        }
        ctx.restore();
      };

      if (frames.length > 0) {
        if (posterImgRef.current) {
          posterImgRef.current.style.opacity = "0";
        }
        if (frameKindRef.current === "unwarped_modular_quad" && frames.length === 4) {
          const exactQ = normProgress * 4;
          const idx0 = Math.floor(exactQ) % 4;
          const idx1 = (idx0 + 1) % 4;
          const frac = exactQ - Math.floor(exactQ);
          // Hold crisp view across 76% of quadrant, smooth cross-dissolve across transition
          const blend = clamp((frac - 0.78) / 0.22, 0, 1);
          const fA = frames[idx0];
          drawSlicedPortrait(fA, fA.width, fA.height, 1.0);
          if (blend > 0.01) {
            const fB = frames[idx1];
            drawSlicedPortrait(fB, fB.width, fB.height, blend);
          }
        } else {
          const idx = Math.floor(normProgress * frames.length) % frames.length;
          const bmp = frames[idx];
          drawSlicedPortrait(bmp, bmp.width, bmp.height, 1.0);
        }
      } else if (posterBitmapRef.current) {
        const pBmp = posterBitmapRef.current;
        drawSlicedPortrait(pBmp, pBmp.width, pBmp.height, 1.0);
      }

      // Optional Customer Scanned Face Oval Overlay near 0° Front
      if (faceOvalImgRef.current && (normProgress < 0.09 || normProgress > 0.91)) {
        const fade =
          normProgress < 0.09
            ? 1 - normProgress / 0.09
            : (normProgress - 0.91) / 0.09;
        const fw = drawW * 0.135;
        const fh = fw * 1.24;
        ctx.save();
        ctx.globalAlpha = fade * 0.94;
        ctx.drawImage(
          faceOvalImgRef.current,
          centerX - fw * 0.5,
          drawY + drawH * 0.148,
          fw,
          fh
        );
        ctx.restore();
      }

      // Optional Fit Heatmap Zone Wash (`Fit Map` mode)
      if (
        visualModeRef.current === "heatmap" &&
        equippedRef.current.length > 0
      ) {
        const primary = equippedRef.current.find(
          (p) => classifyWearableSlotAndAnchors(p).slot !== "bag"
        );
        const fit = primary
          ? fitByProductIdRef.current.get(primary.id)
          : undefined;
        const bFeel = fit?.zones.find((z) => z.zone === "Bust")?.feel;
        const wFeel = fit?.zones.find((z) => z.zone === "Waist")?.feel;
        const hFeel = fit?.zones.find((z) => z.zone === "Hips")?.feel;

        const zones: Array<[number, number, ZoneFeel | undefined]> = [
          [0.34, drawW * 0.16, bFeel],
          [0.44, drawW * 0.135, wFeel],
          [0.54, drawW * 0.175, hFeel],
        ];
        for (const [yFrac, rxZone, feel] of zones) {
          const zy = drawY + drawH * yFrac;
          const rg = ctx.createRadialGradient(
            centerX,
            zy,
            4,
            centerX,
            zy,
            rxZone * 1.25
          );
          rg.addColorStop(0, feelToRgba(feel, 0.34));
          rg.addColorStop(1, feelToRgba(feel, 0.0));
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.ellipse(centerX, zy, rxZone * 1.25, drawH * 0.055, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Optional 3D Measurement Tape Rings (`3D Rings` / `Tape` mode)
      if (showRingsRef.current || visualModeRef.current === "xray") {
        const ringSpecs: Array<[number, number, string, string]> = [
          [0.345, drawW * 0.155, "#10B981", `${dims.bustInches}" B`],
          [0.442, drawW * 0.132, "#244B3B", `${dims.waistInches}" W`],
          [0.542, drawW * 0.172, "#0EA5E9", `${dims.hipsInches}" H`],
        ];
        ctx.save();
        for (const [yFrac, rxRing, hex, lbl] of ringSpecs) {
          const ry = drawY + drawH * yFrac;
          ctx.strokeStyle = hex;
          ctx.lineWidth = 1.75;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.ellipse(centerX, ry, rxRing, rxRing * 0.22, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.font = "700 9.5px system-ui, -apple-system, sans-serif";
          ctx.fillStyle = hex;
          ctx.fillText(lbl, centerX + rxRing + 6, ry + 3);
        }
        ctx.restore();
      }

      ctx.restore();

      frameTick++;
      if (frameTick % 4 === 0) {
        const deg = Math.round(normProgress * 360) % 360;
        setLiveDeg(deg);
        onYawChangeRef.current?.(deg);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      stageEl.removeEventListener("pointerdown", onPointerDown);
      stageEl.removeEventListener("pointermove", onPointerMove);
      stageEl.removeEventListener("pointerup", onPointerUp);
      stageEl.removeEventListener("pointercancel", onPointerUp);
      stageEl.removeEventListener("wheel", onWheel);
    };
  }, [compactHud, inertiaSpin, mode, seamlessStage, showHud]);

  // Standalone 3D Product Turntable (`mode === "product"`)
  useEffect(() => {
    if (mode !== "product") return;
    const wrapEl = prodWrapRef.current;
    if (!wrapEl) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    wrapEl.innerHTML = "";
    wrapEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(27, 1, 0.08, 25);
    const productTurntable = new THREE.Group();
    scene.add(productTurntable);

    const prod = singleProduct || wornPieces[0]?.product;
    let disposed = false;
    if (prod) {
      void loadStandalone3DItemInstance(prod).then((itemSculpture) => {
        if (disposed) return;
        const holder = new THREE.Group();
        holder.position.y = 0.42;
        holder.add(itemSculpture);
        productTurntable.add(holder);
      });
    }

    const updateSize = () => {
      const w = Math.max(120, wrapEl.clientWidth);
      const h = Math.max(140, wrapEl.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(wrapEl);

    const dom = renderer.domElement;
    let dragging = false;
    let horizLocked = false;
    let sx = 0;
    let sy = 0;
    let startYaw = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      horizLocked = e.pointerType !== "touch";
      sx = e.clientX;
      sy = e.clientY;
      startYaw = targetYawRef.current;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (!horizLocked) {
        if (Math.hypot(dx, dy) < 6) return;
        if (Math.abs(dy) >= Math.abs(dx)) {
          dragging = false;
          return;
        }
        horizLocked = true;
      }
      targetYawRef.current = startYaw + dx * 0.016;
    };
    const onUp = () => {
      dragging = false;
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);

    let rafId = 0;
    let lastT = performance.now();
    const animateProd = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      if (autoSpinRef.current && !dragging) {
        targetYawRef.current += dt * 0.85;
      }
      yawRef.current += (targetYawRef.current - yawRef.current) * (1 - Math.exp(-13 * dt));
      productTurntable.rotation.y = yawRef.current;
      camera.position.set(0, 0.42, 1.52 / zoomRef.current);
      camera.lookAt(0, 0.42, 0);
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animateProd);
    };
    rafId = requestAnimationFrame(animateProd);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
      renderer.dispose();
    };
  }, [mode, singleProduct, wornPieces]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    const desiredRad = (deg * Math.PI) / 180;
    targetYawRef.current =
      yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
  };

  return (
    <div
      data-3d-engine="higgsfield-imagebitmap-turntable"
      data-3d-topology="higgsfield-360-turntable"
      data-frames-ready={framesReady ? "true" : "false"}
      data-realism-spec={MASTER_REALISM_SPEC_VERSION}
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : userSelectedProducts.length}
      className={`relative w-full h-full select-none overflow-hidden ${
        seamlessStage ? "bg-transparent" : "bg-white"
      } ${className}`}
    >
      {mode === "avatar" ? (
        <div
          ref={avatarStageRef}
          style={{
            touchAction: "pan-y",
            filter: LIGHT_MOOD_FILTERS[lightingPresetId],
          }}
          className="relative w-full h-full cursor-grab active:cursor-grabbing"
        >
          {!seamlessStage && !framesReady && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              ref={posterImgRef}
              src={turntableSpec.posterUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full object-contain transition-opacity duration-150"
            />
          )}
          <canvas
            ref={scrubCanvasRef}
            className="block w-full h-full"
          />
        </div>
      ) : (
        <div
          ref={prodWrapRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
      )}

      {isLoadingFrames && mode === "avatar" && (
        <div className="pointer-events-none absolute top-11 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full bg-white/95 border border-black/[0.08] shadow-xs text-[10px] font-bold text-[#244B3B] inline-flex items-center gap-1">
          <Box className="w-3 h-3 animate-pulse" /> Loading 360° Studio Frames…
        </div>
      )}

      {showHud && mode === "avatar" && !compactHud && (
        <div className="pointer-events-none hidden sm:flex absolute top-2.5 left-2.5 z-10 flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1">
            <Ruler className="w-3 h-3 text-[#244B3B]" />
            360° Studio Twin • {formatHeightFeetInches(safeDimensions.heightInches)} •{" "}
            {safeDimensions.bustInches}&quot; B • {safeDimensions.waistInches}&quot; W •{" "}
            {safeDimensions.hipsInches}&quot; H
          </span>
          <span className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold">
            {liveDeg}° 360°
          </span>
        </div>
      )}

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
            <Sparkles className="w-2.5 h-2.5" /> 360° Studio
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
                title="Highlight exact garment fit zones"
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
                title="Show Bust / Waist / Hip measurement rings"
              >
                <Eye className="w-2.5 h-2.5 text-[#0EA5E9]" /> Rings
              </button>
            </>
          )}
          <button
            type="button"
            onClick={cycleLightingPreset}
            className="px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 text-[#686D76] hover:text-[#141518] cursor-pointer transition"
            title={`Boutique Lighting: ${activeLightingPreset.label} (tap to cycle)`}
          >
            <Sun className="w-2.5 h-2.5 text-[#D97706]" />{" "}
            {activeLightingPreset.shortLabel}
          </button>
        </div>
      )}

      {showHud && tappedInfo && !compactHud && (
        <div className="absolute left-2.5 bottom-12 z-10 max-w-[295px] px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.09] shadow-md flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold text-[#141518] truncate">
              {tappedInfo.product.title}
            </p>
            {tappedInfo.fit && (
              <p className="text-[10px] font-semibold text-[#244B3B] truncate">
                Size {tappedInfo.fit.recommendedSize} •{" "}
                {tappedInfo.fit.confidencePct}% Fit Match
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

      {showHud && (
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-sm">
            {(
              [
                [0, "Front 0°"],
                [45, "3/4 45°"],
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
                title="Show Bust / Waist / Hip body-scan rings"
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
                      1.52,
                      targetZoomRef.current + 0.12
                    );
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
                      0.82,
                      targetZoomRef.current - 0.12
                    );
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
                    targetZoomRef.current = 1.0;
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

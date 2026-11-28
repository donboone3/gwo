"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  ATLAS_CELL_H,
  ATLAS_CELL_W,
  ATLAS_COLS,
  ATLAS_FRAMES_PER_SHEET,
  ATLAS_ROI_H,
  ATLAS_ROI_W,
  ATLAS_ROI_X0,
  ATLAS_ROI_Y0,
  ATLAS_ROWS,
  CachedFrameBundle,
  ColorwayShiftSpec,
  DEFAULT_MASK_NATIVE_HEX,
  DONOR_MASK_TO_GL_ID,
  extractProcessedPosterBitmap,
  extractTurntableBitmapBundle,
  getCachedFastBundleSync,
  getCachedTurntableBundleSync,
  hexToRgb01,
  NUM_TURNTABLE_FRAMES,
  ResolvedTurntableSpec,
  resolveHydratedShiftsAsync,
  resolveTurntableSpecForOutfit,
} from "@/lib/three/higgsfield-turntable-engine";
import {
  composeModularOutfitToCanvas,
  getCachedOrLoadImage,
} from "@/lib/three/modular-outfit-compositor";
import {
  computeVisualSizeFitMorph,
  deriveRecommendedApparelLetter,
} from "@/lib/three/size-fit-morph";
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
  customAvatarTurntableMp4Url?: string | null;
  customAvatarTurntablePosterUrl?: string | null;
  autoSpinDefault?: boolean;
  externalSpinActive?: boolean;
  onAutoSpinChange?: (spinning: boolean) => void;
  initialYawDeg?: number;
  externalYawDeg?: number;
  externalYawSeq?: number;
  seamlessStage?: boolean;
  centerXFrac?: number;
  bottomReservePx?: number;
  ignoreLeftFraction?: number;
  inertiaSpin?: boolean;
  onYawChange?: (deg: number) => void;
  showHud?: boolean;
  compactHud?: boolean;
  focusProductId?: string | null;
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

interface ProductMacroFraming {
  cropY0: number;
  cropY1: number;
  featherTop: number;
  featherBot: number;
  widthFrac: number;
}

/**
 * Computes photorealistic close-up macro camera framing (`[cropY0, cropY1]` in virtual 1600p coords)
 * for `mode === "product"` (`Item 360°`), replacing distorted 2.5D silhouette inflation with
 * razor-sharp 72-frame real studio photography of the exact item across all 360° angles!
 */
function computeProductMacroFraming(product?: Product | null): ProductMacroFraming {
  if (!product) {
    return {
      cropY0: 0.17,
      cropY1: 0.62,
      featherTop: 0.04,
      featherBot: 0.05,
      widthFrac: 0.50,
    };
  }
  const slot = classifyWearableSlotAndAnchors(product).slot;
  const t = `${product.title} ${product.category || ""}`.toLowerCase();

  if (slot === "shoes") {
    if (/\bboot\b/.test(t)) {
      return {
        cropY0: 0.53,
        cropY1: 0.935,
        featherTop: 0.055,
        featherBot: 0.0,
        widthFrac: 0.38,
      };
    }
    return {
      cropY0: 0.72,
      cropY1: 0.935,
      featherTop: 0.055,
      featherBot: 0.0,
      widthFrac: 0.32,
    };
  }

  if (slot === "bag") {
    const isLowHandCarry =
      /\b(tote|mini bag|top-handle|clutch)\b/.test(t) &&
      !/\b(shoulder|crescent|crossbody)\b/.test(t);
    if (isLowHandCarry) {
      return {
        cropY0: 0.38,
        cropY1: 0.76,
        featherTop: 0.05,
        featherBot: 0.05,
        widthFrac: 0.50,
      };
    }
    return {
      cropY0: 0.115,
      cropY1: 0.54,
      featherTop: 0.0,
      featherBot: 0.055,
      widthFrac: 0.50,
    };
  }

  if (slot === "belt") {
    return {
      cropY0: 0.31,
      cropY1: 0.55,
      featherTop: 0.045,
      featherBot: 0.045,
      widthFrac: 0.44,
    };
  }

  if (slot === "dress") {
    if (/\b(mini|blazer dress)\b/.test(t)) {
      return {
        cropY0: 0.115,
        cropY1: 0.65,
        featherTop: 0.0,
        featherBot: 0.05,
        widthFrac: 0.48,
      };
    }
    return {
      cropY0: 0.115,
      cropY1: 0.85,
      featherTop: 0.0,
      featherBot: 0.04,
      widthFrac: 0.48,
    };
  }

  if (slot === "bottom") {
    if (/\b(mini|short)\b/.test(t)) {
      return {
        cropY0: 0.35,
        cropY1: 0.65,
        featherTop: 0.045,
        featherBot: 0.05,
        widthFrac: 0.46,
      };
    }
    return {
      cropY0: 0.35,
      cropY1: 0.935,
      featherTop: 0.045,
      featherBot: 0.0,
      widthFrac: 0.46,
    };
  }

  // `top` or `outerwear` — natural upper-body portrait zoomed onto garment
  if (/\b(coat|trench)\b/.test(t)) {
    return {
      cropY0: 0.115,
      cropY1: 0.80,
      featherTop: 0.0,
      featherBot: 0.05,
      widthFrac: 0.50,
    };
  }
  return {
    cropY0: 0.115,
    cropY1: 0.54,
    featherTop: 0.0,
    featherBot: 0.055,
    widthFrac: 0.48,
  };
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
  customAvatarTurntableMp4Url,
  customAvatarTurntablePosterUrl,
  autoSpinDefault = false,
  externalSpinActive,
  onAutoSpinChange,
  initialYawDeg = 0,
  externalYawDeg,
  externalYawSeq,
  seamlessStage = false,
  centerXFrac = 0.5,
  bottomReservePx = 0,
  ignoreLeftFraction = 0,
  inertiaSpin = true,
  onYawChange,
  showHud = false,
  compactHud = false,
  focusProductId,
  selectedProductId,
  onSelectProduct,
  className = "",
}: Interactive3DAvatarStageProps) {
  const avatarStageRef = useRef<HTMLDivElement | null>(null);
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrubCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const posterImgRef = useRef<HTMLImageElement | null>(null);

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
  const lightingPresetRef = useRef<ImmersiveLightingPresetId>(lightingPresetId);
  lightingPresetRef.current = lightingPresetId;
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

  const kickRenderRef = useRef<(() => void) | null>(null);

  const safeDimensions = useMemo(
    () => enforceRealisticAvatarAnatomy(dimensions),
    [dimensions]
  );
  const dimsRef = useRef(safeDimensions);
  dimsRef.current = safeDimensions;

  const initialDeg = ((Math.round(initialYawDeg) % 360) + 360) % 360;
  const degBadgeRef = useRef<HTMLSpanElement | null>(null);
  const [tappedInfo, setTappedInfo] = useState<{
    product: Product;
    fit?: AvatarExactFitReport;
  } | null>(null);
  const [framesReady, setFramesReady] = useState<boolean>(false);
  const [isLoadingFrames, setIsLoadingFrames] = useState<boolean>(false);

  const bundleRef = useRef<CachedFrameBundle | null>(null);
  const upperBundleRef = useRef<CachedFrameBundle | null>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const posterBitmapRef = useRef<ImageBitmap | null>(null);
  const studioFrontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioSideRCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioBackCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioSideLCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studioFrontVerRef = useRef<number>(0);
  const studioSideRVerRef = useRef<number>(0);
  const studioBackVerRef = useRef<number>(0);
  const studioSideLVerRef = useRef<number>(0);
  const studioPreColoredRef = useRef<boolean>(false);
  const paintVersionRef = useRef<number>(0);
  const faceOvalImgRef = useRef<HTMLImageElement | null>(null);
  const activeShiftsRef = useRef<ColorwayShiftSpec[]>([]);
  const activeUpperShiftsRef = useRef<ColorwayShiftSpec[]>([]);
  const skinToneHexRef = useRef<string | undefined>(undefined);

  const setVisualMode = useCallback(
    (m: Render3DVisualMode) => {
      setInternalVisualMode(m);
      onVisualModeChange?.(m);
    },
    [onVisualModeChange]
  );

  const prevYawSeqRef = useRef<number | undefined>(externalYawSeq);
  useEffect(() => {
    if (typeof externalYawDeg === "number") {
      setAutoSpin(false);
      velYawRef.current = 0;
      const desiredRad = (externalYawDeg * Math.PI) / 180;
      const seqChanged = externalYawSeq !== prevYawSeqRef.current;
      prevYawSeqRef.current = externalYawSeq;
      if (seamlessStage && seqChanged) {
        yawRef.current = desiredRad;
        targetYawRef.current = desiredRad;
      } else {
        targetYawRef.current =
          yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
      }
      kickRenderRef.current?.();
    }
  }, [externalYawDeg, externalYawSeq, seamlessStage, setAutoSpin]);

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

  const targetSingleProd = singleProduct || wornPieces[0]?.product || null;
  const macroFraming = useMemo(
    () => (mode === "product" ? computeProductMacroFraming(targetSingleProd) : null),
    [mode, targetSingleProd]
  );
  const macroRef = useRef(macroFraming);
  macroRef.current = macroFraming;
  const centerXFracRef = useRef(centerXFrac);
  centerXFracRef.current = centerXFrac;

  useEffect(() => {
    kickRenderRef.current?.();
  }, [
    activeVisualMode,
    autoSpin,
    centerXFrac,
    effectiveShowRings,
    lightingPresetId,
    macroFraming,
    safeDimensions,
  ]);

  const { userSelectedProducts, effectiveEquippedProducts } = useMemo(() => {
    if (mode === "product" && targetSingleProd) {
      return {
        userSelectedProducts: [targetSingleProd],
        effectiveEquippedProducts: [targetSingleProd],
      };
    }
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
    const outerChosen = fullMap.get("outerwear");
    const hasClosedOuter = Boolean(
      outerChosen &&
        (outerChosen.id === "prod-ae-linen-cinch-cardigan" ||
          outerChosen.id === "prod-ae-sage-zip-jacket")
    );
    if (!hasDress) {
      if (!fullMap.has("top") && !hasClosedOuter && companions.top) {
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
  }, [mode, targetSingleProd, wornPieces]);

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

  // Live Physical Size-Fit Morphing (`XS` / `S` / `M` / `L` / `XL` visibly loosens/tightens & lengthens/shortens garment on her body!)
  const { visualSizeMorph, hasExplicitSizeControl } = useMemo(() => {
    const bodyRecLetter = deriveRecommendedApparelLetter(safeDimensions);
    if (mode === "product" && targetSingleProd) {
      const rep = fitByProductId.get(targetSingleProd.id);
      return {
        visualSizeMorph: computeVisualSizeFitMorph({
          product: targetSingleProd,
          selectedSize: selectedSize || rep?.recommendedSize || bodyRecLetter,
          recommendedSize: rep?.recommendedSize || bodyRecLetter,
          dimensions: safeDimensions,
        }),
        hasExplicitSizeControl: Boolean(selectedSize),
      };
    }

    // Find explicit size selection from top-level `selectedSize` or per-piece `wornPieces`
    const sizedEntry =
      (focusProductId
        ? wornPieces.find(
            (w) => w.product.id === focusProductId && Boolean(w.selectedSize)
          )
        : undefined) ||
      wornPieces.find((w) => {
        if (!w.selectedSize) return false;
        const s = classifyWearableSlotAndAnchors(w.product).slot;
        return s === "dress" || s === "top" || s === "bottom" || s === "outerwear";
      }) ||
      wornPieces.find((w) => Boolean(w.selectedSize));

    // If top-level `selectedSize` is passed in Closet (applying to the whole worn outfit), use `product: null` (`slotCode = 0`)
    if (selectedSize && wornPieces.length > 1) {
      return {
        visualSizeMorph: computeVisualSizeFitMorph({
          product: null,
          selectedSize,
          recommendedSize: bodyRecLetter,
          dimensions: safeDimensions,
        }),
        hasExplicitSizeControl: true,
      };
    }

    const morphProd = sizedEntry?.product || (wornPieces.length === 1 ? wornPieces[0]?.product : null);
    const activeSz = selectedSize || sizedEntry?.selectedSize;
    const rep = morphProd ? fitByProductId.get(morphProd.id) : undefined;
    return {
      visualSizeMorph: computeVisualSizeFitMorph({
        product: morphProd,
        selectedSize: activeSz || rep?.recommendedSize || bodyRecLetter,
        recommendedSize: rep?.recommendedSize || bodyRecLetter,
        dimensions: safeDimensions,
      }),
      hasExplicitSizeControl: Boolean(selectedSize || sizedEntry?.selectedSize),
    };
  }, [
    fitByProductId,
    focusProductId,
    mode,
    safeDimensions,
    selectedSize,
    targetSingleProd,
    wornPieces,
  ]);

  const sizeMorphRef = useRef(visualSizeMorph);
  sizeMorphRef.current = visualSizeMorph;
  const animSizeStepRef = useRef<number>(visualSizeMorph.sizeStep);
  const animHemDropRef = useRef<number>(visualSizeMorph.hemDropLocal);

  useEffect(() => {
    paintVersionRef.current++;
    kickRenderRef.current?.();
  }, [visualSizeMorph]);

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
        effectiveEquippedProducts,
        {
          skinToneHex: safeDimensions.skinToneHex,
          customTurntableMp4Url: customAvatarTurntableMp4Url || undefined,
          customTurntablePosterUrl: customAvatarTurntablePosterUrl || undefined,
          focusProductId:
            (mode === "product" ? targetSingleProd?.id : undefined) ||
            focusProductId ||
            selectedProductId ||
            undefined,
        }
      ),
    [
      customAvatarTurntableMp4Url,
      customAvatarTurntablePosterUrl,
      effectiveEquippedProducts,
      focusProductId,
      mode,
      safeDimensions.skinToneHex,
      selectedProductId,
      targetSingleProd?.id,
      userSelectedProducts,
    ]
  );

  const turntableSpecRef = useRef(turntableSpec);
  turntableSpecRef.current = turntableSpec;

  // Hydrate colorway & skin-tone shader uniforms asynchronously (0ms for explicit colors, ~2ms for custom photo sampling)
  useEffect(() => {
    let cancelled = false;
    skinToneHexRef.current = turntableSpec.skinToneTargetHex;
    const immediate =
      turntableSpec.colorwayShifts ||
      (turntableSpec.colorwayShift ? [turntableSpec.colorwayShift] : []);
    activeShiftsRef.current = immediate;
    activeUpperShiftsRef.current = turntableSpec.upperOverlay?.colorwayShifts || [];
    paintVersionRef.current++;
    kickRenderRef.current?.();

    if (immediate.some((s) => Boolean(s.sampleFromImageUrl))) {
      void resolveHydratedShiftsAsync(turntableSpec).then((hydrated) => {
        if (cancelled) return;
        activeShiftsRef.current = hydrated;
        paintVersionRef.current++;
        kickRenderRef.current?.();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [turntableSpec]);

  // 4K Studio Master Texture Synthesizer (1350x2032 = 9.2x higher pixel area than video cells!)
  // - Canonical capsules: uses the razor-sharp 1350x2032 studio master (`runway_ai/ae_outfit_X_front/back.webp`)
  // - Custom Closet mixes: uses atomic 900x1355 modular studio layers (`composeModularOutfitToCanvas`) with ONLY selected clothes!
  useEffect(() => {
    if (typeof document === "undefined" || mode !== "avatar") {
      studioFrontVerRef.current = 0;
      studioBackVerRef.current = 0;
      paintVersionRef.current++;
      kickRenderRef.current?.();
      return;
    }

    let cancelled = false;
    const ensureCanvas = (
      ref: React.MutableRefObject<HTMLCanvasElement | null>,
      w: number,
      h: number
    ): HTMLCanvasElement => {
      if (!ref.current) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        ref.current = c;
      } else if (ref.current.width !== w || ref.current.height !== h) {
        ref.current.width = w;
        ref.current.height = h;
      }
      return ref.current;
    };

    const basePrefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const isCanonicalNumber =
      !turntableSpec.isCustomMix && typeof turntableSpec.lookIdx === "number";

    const paintCanonicalAngle = (angle: "front" | "back") => {
      if (cancelled || typeof turntableSpec.lookIdx !== "number") return;
      const idx = turntableSpec.lookIdx;
      const url = `${basePrefix}/models/runway_ai/ae_outfit_${idx}_${angle}.webp?v=rw4k3`;
      const im = getCachedOrLoadImage(url, () => {
        if (!cancelled) paintCanonicalAngle(angle);
      });
      if (!im) return;
      const W = 1350;
      const H = 2032;
      const cv = ensureCanvas(
        angle === "front" ? studioFrontCanvasRef : studioBackCanvasRef,
        W,
        H
      );
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.clearRect(0, 0, W, H);
      if (idx >= 10) {
        const sc = 1.095;
        ctx.drawImage(
          im,
          W * 0.5 * (1 - sc),
          H * (0.020664 - 0.069373 * sc),
          W * sc,
          H * sc
        );
      } else {
        ctx.drawImage(im, 0, 0, W, H);
      }
      if (faceOvalImgRef.current && angle === "front") {
        const fw = W * 0.129;
        const fh = H * 0.097;
        ctx.drawImage(
          faceOvalImgRef.current,
          W * 0.4995 - fw / 2,
          H * 0.132 - fh / 2,
          fw,
          fh
        );
      }
      studioPreColoredRef.current = false;
      if (angle === "front") {
        studioFrontVerRef.current++;
        setFramesReady(true);
      } else {
        studioBackVerRef.current++;
      }
      paintVersionRef.current++;
      kickRenderRef.current?.();
    };

    const paintModularAngle = (
      viewId: "front" | "sideR" | "back" | "sideL"
    ) => {
      if (cancelled) return;
      const targetRef =
        viewId === "front"
          ? studioFrontCanvasRef
          : viewId === "sideR"
          ? studioSideRCanvasRef
          : viewId === "back"
          ? studioBackCanvasRef
          : studioSideLCanvasRef;
      const cv = ensureCanvas(targetRef, 900, 1355);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const status = composeModularOutfitToCanvas({
        ctx,
        products: effectiveEquippedProducts,
        angle:
          viewId === "front"
            ? "front"
            : viewId === "back"
            ? "back"
            : "side",
        mirrorHorizontal: viewId === "sideL",
        includeBag: Boolean(turntableSpec.hasBagEquipped),
        faceOvalDataUrl,
        onAssetReady: () => {
          if (!cancelled) paintModularAngle(viewId);
        },
      });
      if (status === "ready") {
        studioPreColoredRef.current = true;
        if (viewId === "front") {
          studioFrontVerRef.current++;
          setFramesReady(true);
        } else if (viewId === "sideR") {
          studioSideRVerRef.current++;
        } else if (viewId === "back") {
          studioBackVerRef.current++;
        } else {
          studioSideLVerRef.current++;
        }
        paintVersionRef.current++;
        kickRenderRef.current?.();
      }
    };

    studioFrontVerRef.current = 0;
    studioSideRVerRef.current = 0;
    studioBackVerRef.current = 0;
    studioSideLVerRef.current = 0;

    if (isCanonicalNumber) {
      paintCanonicalAngle("front");
      const backTimer = setTimeout(() => {
        if (!cancelled) paintCanonicalAngle("back");
      }, 140);
      return () => {
        cancelled = true;
        clearTimeout(backTimer);
      };
    }

    if (effectiveEquippedProducts.length > 0 || turntableSpec.lookIdx === "base") {
      paintModularAngle("front");
      const sideTimer = setTimeout(() => {
        if (!cancelled) {
          paintModularAngle("sideR");
          paintModularAngle("back");
          paintModularAngle("sideL");
        }
      }, 60);
      return () => {
        cancelled = true;
        clearTimeout(sideTimer);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [
    effectiveEquippedProducts,
    faceOvalDataUrl,
    mode,
    turntableSpec.hasBagEquipped,
    turntableSpec.isCustomMix,
    turntableSpec.lookIdx,
  ]);

  // Multi-Slot Upper Turntable Loader (for custom Closet mixes like Shirt Swap or Jacket OVER Dress!)
  useEffect(() => {
    const up = turntableSpec.upperOverlay;
    if (!up) {
      upperBundleRef.current = null;
      paintVersionRef.current++;
      kickRenderRef.current?.();
      return;
    }

    let cancelled = false;
    const upSpec: ResolvedTurntableSpec = {
      cacheKey: `hf:${up.lookIdx}`,
      kind: "higgsfield_mp4",
      lookIdx: up.lookIdx,
      mp4Url: "",
      fastAtlasUrl: up.fastAtlasUrl,
      atlasUrl: up.atlasUrl,
      posterUrl: "",
      products: [],
    };

    const syncHit = getCachedTurntableBundleSync(upSpec, seamlessStage);
    if (syncHit && syncHit.atlasBitmap) {
      upperBundleRef.current = syncHit;
      paintVersionRef.current++;
      kickRenderRef.current?.();
      return;
    }

    const syncFast = getCachedFastBundleSync(upSpec);
    if (syncFast && syncFast.atlasBitmap) {
      upperBundleRef.current = syncFast;
      paintVersionRef.current++;
      kickRenderRef.current?.();
    } else {
      upperBundleRef.current = null;
    }

    void extractTurntableBitmapBundle(
      upSpec,
      seamlessStage,
      undefined,
      undefined,
      (fastB) => {
        if (cancelled || !fastB.atlasBitmap) return;
        if (!upperBundleRef.current || upperBundleRef.current.isFastTier) {
          upperBundleRef.current = fastB;
          paintVersionRef.current++;
          kickRenderRef.current?.();
        }
      }
    )
      .then((qhdB) => {
        if (cancelled || !qhdB.atlasBitmap) return;
        upperBundleRef.current = qhdB;
        paintVersionRef.current++;
        kickRenderRef.current?.();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [seamlessStage, turntableSpec.upperOverlay]);

  // Parallel Zero-Main-Thread-CPU Loader: Fast Tier (32f) + Full QHD (72f, 4080x4092)!
  useEffect(() => {
    // Custom multi-slot Closet mixes use our instant 4-Angle 4K Modular Studio Cylindrical Engine (0KB video download, 100% exact selected clothes!)
    if (mode === "avatar" && turntableSpec.isCustomMix) {
      setIsLoadingFrames(false);
      paintVersionRef.current++;
      kickRenderRef.current?.();
      return;
    }

    let cancelled = false;

    // 1. Instant 0ms synchronous QHD LRU hit if already decoded in RAM!
    const syncHit = getCachedTurntableBundleSync(turntableSpec, seamlessStage);
    if (syncHit && (syncHit.atlasBitmap || syncHit.frames.length > 0)) {
      bundleRef.current = syncHit;
      framesRef.current = syncHit.frames;
      paintVersionRef.current++;
      setFramesReady(true);
      setIsLoadingFrames(false);
      kickRenderRef.current?.();
      return;
    }

    // 1b. Instant 0ms synchronous Fast-Tier hit if Tier-0 is already in RAM while QHD finishes!
    const syncFast = getCachedFastBundleSync(turntableSpec);
    let receivedBundle = false;
    if (syncFast && syncFast.atlasBitmap) {
      receivedBundle = true;
      bundleRef.current = syncFast;
      framesRef.current = [];
      paintVersionRef.current++;
      setFramesReady(true);
      setIsLoadingFrames(false);
      kickRenderRef.current?.();
    } else {
      setFramesReady(false);
      if (seamlessStage) {
        bundleRef.current = null;
        framesRef.current = [];
        posterBitmapRef.current = null;
        paintVersionRef.current++;
        kickRenderRef.current?.();
      }
    }

    // Only run 2D poster canvas fallback for custom `.mp4` customer turntables lacking `_fast.webp`!
    if (!turntableSpec.fastAtlasUrl) {
      void extractProcessedPosterBitmap(turntableSpec, seamlessStage).then(
        (pBmp) => {
          if (!cancelled && pBmp && !receivedBundle) {
            posterBitmapRef.current = pBmp;
            bundleRef.current = null;
            framesRef.current = [];
            paintVersionRef.current++;
            kickRenderRef.current?.();
          }
        }
      );
    }

    const spinnerTimer = setTimeout(() => {
      if (!cancelled && !receivedBundle) {
        setIsLoadingFrames(true);
      }
    }, 450);

    void extractTurntableBitmapBundle(
      turntableSpec,
      seamlessStage,
      undefined,
      (progFrames) => {
        if (cancelled || progFrames.length === 0) return;
        receivedBundle = true;
        clearTimeout(spinnerTimer);
        framesRef.current = progFrames;
        paintVersionRef.current++;
        setFramesReady(true);
        setIsLoadingFrames(false);
        kickRenderRef.current?.();
      },
      (fastBundle) => {
        if (cancelled || !fastBundle.atlasBitmap) return;
        // Only apply Tier-0 fast bundle if full 72-frame QHD hasn't already landed
        if (!bundleRef.current || bundleRef.current.isFastTier || !receivedBundle) {
          receivedBundle = true;
          clearTimeout(spinnerTimer);
          bundleRef.current = fastBundle;
          framesRef.current = [];
          paintVersionRef.current++;
          setFramesReady(true);
          setIsLoadingFrames(false);
          kickRenderRef.current?.();
        }
      }
    )
      .then((bundle) => {
        clearTimeout(spinnerTimer);
        if (cancelled) return;
        if (bundle.atlasBitmap || bundle.frames.length > 0) {
          receivedBundle = true;
          bundleRef.current = bundle;
          framesRef.current = bundle.frames;
          paintVersionRef.current++;
          setFramesReady(true);
          kickRenderRef.current?.();
        }
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

  // ZERO-COPY SINGLE-TEXTURE WEBGL RENDERER + 120Hz NATIVE TOUCH LOCK + EVENT-DRIVEN SLEEP!
  useEffect(() => {
    const stageEl = avatarStageRef.current;
    const glCanvas = glCanvasRef.current;
    const canvas2d = scrubCanvasRef.current;
    if (!stageEl || !glCanvas || !canvas2d) return;

    const ctx2d = canvas2d.getContext("2d");

    const gl = (glCanvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
    }) ||
      glCanvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
      })) as WebGLRenderingContext | null;

    let glProg: WebGLProgram | null = null;
    let glQuadBuf: WebGLBuffer | null = null;
    let glDummyTex: WebGLTexture | null = null;
    let glTexA: WebGLTexture | null = null;
    let glTexB: WebGLTexture | null = null;
    let glTexUpper: WebGLTexture | null = null;
    let glTexStudioFront: WebGLTexture | null = null;
    let glTexStudioSideR: WebGLTexture | null = null;
    let glTexStudioBack: WebGLTexture | null = null;
    let glTexStudioSideL: WebGLTexture | null = null;
    let uploadedBundleRef: CachedFrameBundle | null = null;
    let uploadedUpperBundleRef: CachedFrameBundle | null = null;
    let uploadedStudioFrontVer = 0;
    let uploadedStudioSideRVer = 0;
    let uploadedStudioBackVer = 0;
    let uploadedStudioSideLVer = 0;
    let uRectLoc: WebGLUniformLocation | null = null;
    let uUvRectLoc: WebGLUniformLocation | null = null;
    let uCropYLoc: WebGLUniformLocation | null = null;
    let uMoodLoc: WebGLUniformLocation | null = null;
    let uTexelLoc: WebGLUniformLocation | null = null;
    let uCellBoundsLoc: WebGLUniformLocation | null = null;
    let uSeamlessLoc: WebGLUniformLocation | null = null;
    let uSharpAmtLoc: WebGLUniformLocation | null = null;
    let uShiftCountLoc: WebGLUniformLocation | null = null;
    let uShiftMetaLoc: WebGLUniformLocation | null = null;
    let uShiftTargetLoc: WebGLUniformLocation | null = null;
    let uShiftBoundsLoc: WebGLUniformLocation | null = null;
    let uSkinMulLoc: WebGLUniformLocation | null = null;
    let uTexLoc: WebGLUniformLocation | null = null;
    let uTexUpperLoc: WebGLUniformLocation | null = null;
    let uTexStudioLoc: WebGLUniformLocation | null = null;
    let uTexStudioNextLoc: WebGLUniformLocation | null = null;
    let uHasBaseTexLoc: WebGLUniformLocation | null = null;
    let uHasUpperLoc: WebGLUniformLocation | null = null;
    let uUpperUvRectLoc: WebGLUniformLocation | null = null;
    let uUpperSpliceLoc: WebGLUniformLocation | null = null;
    let uUpperShiftCountLoc: WebGLUniformLocation | null = null;
    let uUpperShiftMetaLoc: WebGLUniformLocation | null = null;
    let uUpperShiftTargetLoc: WebGLUniformLocation | null = null;
    let uUpperShiftBoundsLoc: WebGLUniformLocation | null = null;
    let uStudioMixLoc: WebGLUniformLocation | null = null;
    let uStudioCylLoc: WebGLUniformLocation | null = null;
    let uStudioPreColoredLoc: WebGLUniformLocation | null = null;
    let uSizeFitLoc: WebGLUniformLocation | null = null;
    let uSizeMetaLoc: WebGLUniformLocation | null = null;

    if (gl) {
      glDummyTex = gl.createTexture();
      if (glDummyTex) {
        gl.bindTexture(gl.TEXTURE_2D, glDummyTex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array([0, 0, 0, 0])
        );
      }

      const compileShader = (type: number, src: string) => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          gl.deleteShader(s);
          return null;
        }
        return s;
      };
      const vs = compileShader(
        gl.VERTEX_SHADER,
        `attribute vec2 aPos;
         uniform vec4 uRect;
         varying vec2 vLocal;
         void main() {
           vec2 p = uRect.xy + aPos * uRect.zw;
           gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
           vLocal = aPos;
         }`
      );
      const fs = compileShader(
        gl.FRAGMENT_SHADER,
        `precision highp float;
         varying vec2 vLocal;
         uniform sampler2D uTex;
         uniform sampler2D uTexUpper;
         uniform sampler2D uTexStudio;
         uniform sampler2D uTexStudioNext;
         uniform vec4 uUvRect;
         uniform vec4 uCropY;
         uniform vec3 uMood;
         uniform vec2 uTexel;
         uniform vec4 uCellBounds;
         uniform float uSeamless;
         uniform float uSharpAmt;
         uniform int uShiftCount;
         uniform vec4 uShiftMeta[4];
         uniform vec3 uShiftTarget[4];
         uniform vec4 uShiftBounds[4];
         uniform vec4 uSkinMul;

         uniform float uHasBaseTex;
         uniform float uHasUpper;
         uniform vec4 uUpperUvRect;
         uniform vec4 uUpperSplice;
         uniform int uUpperShiftCount;
         uniform vec4 uUpperShiftMeta[2];
         uniform vec3 uUpperShiftTarget[2];
         uniform vec4 uUpperShiftBounds[2];

         uniform float uStudioMix;
         uniform vec2 uStudioCyl;
         uniform float uStudioPreColored;
         uniform vec4 uSizeFit;
         uniform vec2 uSizeMeta;

         vec3 sampleStraightSafe(vec2 uv, vec3 fallbackRgb) {
           vec4 s = texture2D(uTex, uv);
           if (s.a < 0.35) return fallbackRgb;
           return clamp(s.rgb / s.a, 0.0, 1.0);
         }

         vec3 sampleStudioSafe(vec2 uv, vec3 fallbackRgb) {
           if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return fallbackRgb;
           vec4 s = texture2D(uTexStudio, uv);
           if (s.a < 0.45) return fallbackRgb;
           return clamp(s.rgb / s.a, 0.0, 1.0);
         }

         float evalMaskWeight(int maskId, vec3 c, float lum, float chroma) {
           float r = c.r;
           float g = c.g;
           float b = c.b;
           if (maskId == 1) {
             return clamp((g - r - 0.003) / 0.028, 0.0, 1.0)
               * clamp((chroma - 0.016) / 0.036, 0.0, 1.0)
               * clamp((0.92 - lum) / 0.10, 0.0, 1.0);
           }
           if (maskId == 2) {
             return clamp((r - g - 0.19) / 0.09, 0.0, 1.0)
               * clamp((r - b - 0.20) / 0.09, 0.0, 1.0);
           }
           if (maskId == 3) {
             return clamp((b - r - 0.08) / 0.06, 0.0, 1.0)
               * clamp((b - g * 0.85 - 0.04) / 0.06, 0.0, 1.0)
               * clamp((0.90 - lum) / 0.10, 0.0, 1.0);
           }
           if (maskId == 4) {
             float skinWarmth = max(0.0, r - b);
             return clamp((lum - 0.36) / 0.10, 0.0, 1.0)
               * clamp((0.945 - lum) / 0.05, 0.0, 1.0)
               * clamp((0.145 - skinWarmth) / 0.055, 0.0, 1.0);
           }
           if (maskId == 5) {
             if (r > 0.42 && (r - b) > 0.155) return 0.0;
             return clamp((lum - 0.09) / 0.06, 0.0, 1.0)
               * clamp((0.41 - lum) / 0.08, 0.0, 1.0)
               * clamp((r - b - 0.018) / 0.05, 0.0, 1.0)
               * clamp((0.135 - (r - g)) / 0.05, 0.0, 1.0);
           }
           if (maskId == 6) {
             return clamp((0.27 - lum) / 0.08, 0.0, 1.0)
               * clamp((0.085 - chroma) / 0.05, 0.0, 1.0);
           }
           if (maskId == 7) {
             return clamp((lum - 0.10) / 0.06, 0.0, 1.0)
               * clamp((0.40 - lum) / 0.08, 0.0, 1.0)
               * clamp((0.09 - chroma) / 0.05, 0.0, 1.0);
           }
           if (maskId == 8) {
             return clamp((b - r - 0.025) / 0.045, 0.0, 1.0)
               * clamp((0.70 - lum) / 0.12, 0.0, 1.0)
               * clamp((lum - 0.10) / 0.06, 0.0, 1.0);
           }
           if (maskId == 9) {
             return clamp((g - r + 0.015) / 0.045, 0.0, 1.0)
               * clamp((g - b - 0.005) / 0.045, 0.0, 1.0)
               * clamp((0.68 - lum) / 0.12, 0.0, 1.0)
               * clamp((lum - 0.14) / 0.06, 0.0, 1.0);
           }
           if (maskId == 10) {
             if (g > b + 0.055 && (r - g) < 0.145) return 0.0;
             return clamp((r - g - 0.045) / 0.055, 0.0, 1.0)
               * clamp((lum - 0.44) / 0.10, 0.0, 1.0)
               * clamp((0.92 - lum) / 0.06, 0.0, 1.0);
           }
           if (maskId == 11) {
             if (g > b + 0.065 && lum > 0.35) return 0.0;
             return clamp((r - g - 0.092) / 0.055, 0.0, 1.0)
               * clamp((0.44 - lum) / 0.10, 0.0, 1.0);
           }
           if (maskId == 12) {
             return clamp((r - b - 0.15) / 0.08, 0.0, 1.0)
               * clamp((g - b - 0.07) / 0.06, 0.0, 1.0)
               * clamp((lum - 0.24) / 0.10, 0.0, 1.0)
               * clamp((0.78 - lum) / 0.10, 0.0, 1.0);
           }
           if (maskId == 13) {
             return clamp((lum - 0.38) / 0.08, 0.0, 1.0)
               * clamp((0.945 - lum) / 0.045, 0.0, 1.0)
               * clamp((0.085 - chroma) / 0.04, 0.0, 1.0);
           }
           if (maskId == 14) {
             if (lum > 0.91 || (lum > 0.76 && chroma < 0.05)) return 0.0;
             if (r > g + 0.05 && g > b + 0.025 && (r - b) > 0.105 && lum > 0.30 && lum < 0.80) return 0.0;
             return clamp((0.88 - lum) / 0.08, 0.0, 1.0);
           }
           return 0.0;
         }

         vec3 applyPrimaryShifts(vec3 sRgb, vec2 loc) {
           if (uShiftCount <= 0) return sRgb;
           for (int i = 0; i < 4; i++) {
             if (i >= uShiftCount) break;
             vec4 bnd = uShiftBounds[i];
             if (loc.y >= bnd.x && loc.y <= bnd.y && loc.x >= bnd.z && loc.x <= bnd.w) {
               float mxC = max(sRgb.r, max(sRgb.g, sRgb.b));
               float mnC = min(sRgb.r, min(sRgb.g, sRgb.b));
               float chr = mxC - mnC;
               float lum = 0.299 * sRgb.r + 0.587 * sRgb.g + 0.114 * sRgb.b;
               int mId = int(uShiftMeta[i].x + 0.5);
               float w = evalMaskWeight(mId, sRgb, lum, chr);
               if (w > 0.008) {
                 float foldRatio = clamp(lum / max(uShiftMeta[i].y, 0.08), 0.32, 1.68);
                 float shaped = max(0.18, 1.0 + (foldRatio - 1.0) * 0.86);
                 float spec = foldRatio > 1.06 ? (foldRatio - 1.06) * uShiftMeta[i].z : 0.0;
                 vec3 nextRgb = clamp(uShiftTarget[i] * shaped + vec3(spec), 0.0, 1.0);
                 sRgb = mix(sRgb, nextRgb, w);
               }
             }
           }
           return sRgb;
         }

         vec3 applyUpperShifts(vec3 sRgb, vec2 loc) {
           if (uUpperShiftCount <= 0) return sRgb;
           for (int i = 0; i < 2; i++) {
             if (i >= uUpperShiftCount) break;
             vec4 bnd = uUpperShiftBounds[i];
             if (loc.y >= bnd.x && loc.y <= bnd.y && loc.x >= bnd.z && loc.x <= bnd.w) {
               float mxC = max(sRgb.r, max(sRgb.g, sRgb.b));
               float mnC = min(sRgb.r, min(sRgb.g, sRgb.b));
               float chr = mxC - mnC;
               float lum = 0.299 * sRgb.r + 0.587 * sRgb.g + 0.114 * sRgb.b;
               int mId = int(uUpperShiftMeta[i].x + 0.5);
               float w = evalMaskWeight(mId, sRgb, lum, chr);
               if (w > 0.008) {
                 float foldRatio = clamp(lum / max(uUpperShiftMeta[i].y, 0.08), 0.32, 1.68);
                 float shaped = max(0.18, 1.0 + (foldRatio - 1.0) * 0.86);
                 float spec = foldRatio > 1.06 ? (foldRatio - 1.06) * uUpperShiftMeta[i].z : 0.0;
                 vec3 nextRgb = clamp(uUpperShiftTarget[i] * shaped + vec3(spec), 0.0, 1.0);
                 sRgb = mix(sRgb, nextRgb, w);
               }
             }
           }
           return sRgb;
         }

         void main() {
           float vLocalY = vLocal.y;
           if (vLocalY < uCropY.x || vLocalY > uCropY.y) {
             gl_FragColor = vec4(0.0);
             return;
           }

           float mTop = uCropY.z > 0.0001
             ? smoothstep(uCropY.x, uCropY.x + uCropY.z, vLocalY)
             : 1.0;
           float mBot = uCropY.w > 0.0001
             ? 1.0 - smoothstep(uCropY.y - uCropY.w, uCropY.y, vLocalY)
             : 1.0;
           float cropMask = mTop * mBot;

           // 1. Live Physical Size-Fit Garment Morph (XS / S / M / L / XL):
           //    Expands/tightens ONLY the garment silhouette & shifts garment hem length while
           //    keeping head/face (y < y0) and ankles/shoes (y > y1) 100% anatomically locked!
           vec2 sLoc = vLocal;
           float szStep = uSizeFit.x;
           float szEaseProfile = 0.0;
           if (abs(szStep) > 0.015) {
             float y0 = uSizeFit.y;
             float y1 = uSizeFit.z;
             float yPeak = uSizeFit.w;
             float hemDrop = uSizeMeta.x;

             float envUp = smoothstep(y0, min(yPeak, y0 + 0.095), vLocal.y);
             float envDn = 1.0 - smoothstep(max(yPeak, y1 - 0.13), y1 + 0.045, vLocal.y);
             float yEnv = envUp * envDn;

             float wDist = (vLocal.y - yPeak) / 0.135;
             float wBell = exp(-wDist * wDist * 0.5);
             szEaseProfile = yEnv * (0.56 + 0.54 * wBell);
             float easeAmt = szStep * 0.075 * szEaseProfile;

             float cx = 0.4765;
             float dx = vLocal.x - cx;
             float radEnv = exp(-(dx * dx) / (2.0 * 0.21 * 0.21));
             float scaleX = max(0.76, 1.0 + easeAmt * radEnv);
             sLoc.x = cx + dx / scaleX;

             float hemEnv = smoothstep(y0 + 0.05, min(y1, y0 + 0.22), vLocal.y)
               * (1.0 - smoothstep(y1 - 0.015, y1 + 0.085, vLocal.y));
             sLoc.y = vLocal.y - hemDrop * hemEnv;
           }

           vec3 finalRgb = vec3(1.0);
           float finalA = 0.0;

           // 2. Sample 72-frame 360° Turntable (plus Multi-Slot Upper Splicing when custom Closet mix!)
           if (uHasBaseTex > 0.5 && uStudioMix < 0.5) {
             vec2 rawUvBase = clamp(uUvRect.xy + sLoc * uUvRect.zw, uCellBounds.xy, uCellBounds.zw);
             vec2 texCoord = rawUvBase / uTexel - 0.5;
             vec2 flTc = floor(texCoord);
             vec2 frTc = texCoord - flTc;
             vec2 sharpFr = mix(frTc, frTc * frTc * (3.0 - 2.0 * frTc), 0.28);
             vec2 uvSharp = clamp((flTc + sharpFr + 0.5) * uTexel, uCellBounds.xy, uCellBounds.zw);
             vec4 cEdge = texture2D(uTex, rawUvBase);
             vec2 uvBase = cEdge.a > 0.72 ? uvSharp : rawUvBase;
             vec4 cBase = cEdge.a > 0.72 ? texture2D(uTex, uvBase) : cEdge;
             vec3 bRgb = cBase.a > 0.008 ? clamp(cBase.rgb / max(cBase.a, 0.004), 0.0, 1.0) : vec3(1.0);

             if (uSharpAmt > 0.01 && cBase.a > 0.55) {
               vec3 nRgb = sampleStraightSafe(vec2(uvBase.x, max(uCellBounds.y, uvBase.y - uTexel.y)), bRgb);
               vec3 s2Rgb = sampleStraightSafe(vec2(uvBase.x, min(uCellBounds.w, uvBase.y + uTexel.y)), bRgb);
               vec3 wRgb = sampleStraightSafe(vec2(max(uCellBounds.x, uvBase.x - uTexel.x), uvBase.y), bRgb);
               vec3 eRgb = sampleStraightSafe(vec2(min(uCellBounds.z, uvBase.x + uTexel.x), uvBase.y), bRgb);
               vec3 mnRgb = min(bRgb, min(min(nRgb, s2Rgb), min(wRgb, eRgb)));
               vec3 mxRgb = max(bRgb, max(max(nRgb, s2Rgb), max(wRgb, eRgb)));
               vec3 amp = sqrt(clamp(min(mnRgb, 1.0 - mxRgb) / max(mxRgb, vec3(0.004)), 0.0, 1.0)) * (-0.195 * uSharpAmt);
               bRgb = clamp((bRgb + (nRgb + s2Rgb + wRgb + eRgb) * amp) / (vec3(1.0) + 4.0 * amp), 0.0, 1.0);
             }

             bRgb = applyPrimaryShifts(bRgb, sLoc);
             float bA = cBase.a;

             if (uHasUpper > 0.5) {
               vec2 uvUp = uUpperUvRect.xy + sLoc * uUpperUvRect.zw;
               vec4 cUp = texture2D(uTexUpper, uvUp);
               vec3 uRgb = cUp.a > 0.008 ? clamp(cUp.rgb / max(cUp.a, 0.004), 0.0, 1.0) : vec3(1.0);
               uRgb = applyUpperShifts(uRgb, sLoc);

               float spY = uUpperSplice.x;
               float spF = uUpperSplice.y;
               float modeId = uUpperSplice.z;
               float frontFac = uUpperSplice.w;

               if (modeId < 1.5) {
                 // Mode 1: Separates Top / Jacket above Bottom (clean horizontal waist splice)
                 float upZone = 1.0 - smoothstep(spY - spF, spY + spF, sLoc.y);
                 float outA = mix(bA, cUp.a, upZone);
                 bRgb = mix(bRgb, uRgb, clamp(upZone, 0.0, 1.0));
                 bA = outA;
               } else {
                 // Mode 2 & 3: Jacket / Blazer / Coat layered OVER a Dress!
                 // Preserves head (y < 0.16) and full dress skirt below jacket hem (y > spY)!
                 float vertW = smoothstep(0.145, 0.178, sLoc.y)
                   * (1.0 - smoothstep(spY - spF, spY + spF, sLoc.y));
                 float jacketKeep = 1.0;
                 if (modeId < 2.5 && frontFac > 0.02) {
                   // Open Blazer/Coat: let the customer's actual Dress bodice show right through the open center lapels!
                   float centerBand = 1.0 - smoothstep(0.052, 0.095, abs(sLoc.x - 0.4765));
                   if (centerBand > 0.01) {
                     float mxU = max(uRgb.r, max(uRgb.g, uRgb.b));
                     float mnU = min(uRgb.r, min(uRgb.g, uRgb.b));
                     float lumU = 0.299 * uRgb.r + 0.587 * uRgb.g + 0.114 * uRgb.b;
                     float innerTankW = evalMaskWeight(4, uRgb, lumU, mxU - mnU);
                     float chestSkinW = clamp((uRgb.r - uRgb.g - 0.055) / 0.05, 0.0, 1.0)
                       * clamp((uRgb.g - uRgb.b - 0.035) / 0.05, 0.0, 1.0)
                       * clamp((lumU - 0.28) / 0.10, 0.0, 1.0);
                     float openHole = clamp(max(innerTankW, chestSkinW), 0.0, 1.0) * centerBand * frontFac;
                     jacketKeep = 1.0 - openHole;
                   }
                 }
                 float jW = vertW * jacketKeep * cUp.a;
                 float combA = max(bA, vertW * cUp.a);
                 bRgb = mix(bRgb, uRgb, clamp(jW, 0.0, 1.0));
                 bA = combA;
               }
             }

             finalRgb = bRgb;
             finalA = bA;
           }

           // 3. True 4K Studio Master (1350x2032 native + 5-tap CAS, strictly binary single-source — ZERO double-image ghosting!)
           if (uStudioMix > 0.5) {
             float cylScale = max(0.76, uStudioCyl.y);
             float stLocalX = 0.4765 + (sLoc.x - 0.4765) / cylScale;
             vec2 uvSt = vec2(
               0.5028 + (stLocalX - 0.4765) * 0.6755,
               0.0009 + sLoc.y * 0.9981
             );
             vec4 cSt = (uvSt.x >= 0.0 && uvSt.x <= 1.0 && uvSt.y >= 0.0 && uvSt.y <= 1.0)
               ? texture2D(uTexStudio, uvSt)
               : vec4(0.0);
             vec3 stRgb = cSt.a > 0.008 ? clamp(cSt.rgb / max(cSt.a, 0.004), 0.0, 1.0) : vec3(1.0);
             if (cSt.a > 0.55) {
               float stStepX = uStudioCyl.x > 0.0001 ? uStudioCyl.x : (1.0 / 1350.0);
               vec2 stStep = vec2(stStepX, stStepX * 0.66437);
               vec3 stN = sampleStudioSafe(vec2(uvSt.x, uvSt.y - stStep.y), stRgb);
               vec3 stS = sampleStudioSafe(vec2(uvSt.x, uvSt.y + stStep.y), stRgb);
               vec3 stW = sampleStudioSafe(vec2(uvSt.x - stStep.x, uvSt.y), stRgb);
               vec3 stE = sampleStudioSafe(vec2(uvSt.x + stStep.x, uvSt.y), stRgb);
               vec3 stMn = min(stRgb, min(min(stN, stS), min(stW, stE)));
               vec3 stMx = max(stRgb, max(max(stN, stS), max(stW, stE)));
               vec3 stAmp = sqrt(clamp(min(stMn, 1.0 - stMx) / max(stMx, vec3(0.004)), 0.0, 1.0)) * (-0.16);
               stRgb = clamp((stRgb + (stN + stS + stW + stE) * stAmp) / (vec3(1.0) + 4.0 * stAmp), 0.0, 1.0);
             }
             if (uStudioPreColored < 0.5) {
               stRgb = applyPrimaryShifts(stRgb, sLoc);
             }
             finalRgb = stRgb;
             finalA = cSt.a;
           }

           if (finalA < 0.008) {
             if (uSeamless < 0.5) {
               gl_FragColor = vec4(cropMask, cropMask, cropMask, cropMask);
             } else {
               gl_FragColor = vec4(0.0);
             }
             return;
           }

           // Subtle physical fabric tension highlight on snug/tight sizes vs softer drape on loose sizes
           if (abs(szStep) > 0.25 && szEaseProfile > 0.15) {
             float tensionShade = clamp(-szStep * 0.014 * szEaseProfile, -0.03, 0.03);
             finalRgb = clamp(finalRgb + vec3(tensionShade), 0.0, 1.0);
           }

           // Optional Customer Skin-Tone Harmonization in GPU
           if (uSkinMul.w > 0.5 && vLocalY < 0.96) {
             float lumS = 0.299 * finalRgb.r + 0.587 * finalRgb.g + 0.114 * finalRgb.b;
             float sw = clamp((finalRgb.r - finalRgb.g - 0.065) / 0.05, 0.0, 1.0)
               * clamp((0.24 - (finalRgb.r - finalRgb.g)) / 0.06, 0.0, 1.0)
               * clamp((finalRgb.g - finalRgb.b - 0.045) / 0.045, 0.0, 1.0)
               * clamp((lumS - 0.28) / 0.10, 0.0, 1.0)
               * clamp((0.82 - lumS) / 0.08, 0.0, 1.0) * 0.62;
             if (sw > 0.01) {
               finalRgb = clamp(mix(finalRgb, finalRgb * uSkinMul.rgb, sw), 0.0, 1.0);
             }
           }

           vec3 moodRgb = clamp(finalRgb * uMood, 0.0, 1.0);

           if (uSeamless < 0.5) {
             vec3 whiteComp = mix(vec3(1.0), moodRgb, finalA);
             gl_FragColor = vec4(whiteComp * cropMask, cropMask);
           } else {
             vec3 deSpill = clamp((moodRgb - vec3(1.0 - finalA) * 0.68) / max(finalA, 0.32), 0.0, 1.0);
             vec3 cleanRgb = mix(moodRgb, deSpill, clamp(1.0 - finalA, 0.0, 0.85));
             float outA = finalA * cropMask;
             gl_FragColor = vec4(cleanRgb * outA, outA);
           }
         }`
      );
      if (vs && fs) {
        const p = gl.createProgram();
        if (p) {
          gl.attachShader(p, vs);
          gl.attachShader(p, fs);
          gl.linkProgram(p);
          if (gl.getProgramParameter(p, gl.LINK_STATUS)) {
            glProg = p;
            gl.useProgram(p);
            const aPosLoc = gl.getAttribLocation(p, "aPos");
            uRectLoc = gl.getUniformLocation(p, "uRect");
            uUvRectLoc = gl.getUniformLocation(p, "uUvRect");
            uCropYLoc = gl.getUniformLocation(p, "uCropY");
            uMoodLoc = gl.getUniformLocation(p, "uMood");
            uTexelLoc = gl.getUniformLocation(p, "uTexel");
            uCellBoundsLoc = gl.getUniformLocation(p, "uCellBounds");
            uSeamlessLoc = gl.getUniformLocation(p, "uSeamless");
            uSharpAmtLoc = gl.getUniformLocation(p, "uSharpAmt");
            uShiftCountLoc = gl.getUniformLocation(p, "uShiftCount");
            uShiftMetaLoc = gl.getUniformLocation(p, "uShiftMeta[0]");
            uShiftTargetLoc = gl.getUniformLocation(p, "uShiftTarget[0]");
            uShiftBoundsLoc = gl.getUniformLocation(p, "uShiftBounds[0]");
            uSkinMulLoc = gl.getUniformLocation(p, "uSkinMul");

            uTexLoc = gl.getUniformLocation(p, "uTex");
            uTexUpperLoc = gl.getUniformLocation(p, "uTexUpper");
            uTexStudioLoc = gl.getUniformLocation(p, "uTexStudio");
            uTexStudioNextLoc = gl.getUniformLocation(p, "uTexStudioNext");
            uHasBaseTexLoc = gl.getUniformLocation(p, "uHasBaseTex");
            uHasUpperLoc = gl.getUniformLocation(p, "uHasUpper");
            uUpperUvRectLoc = gl.getUniformLocation(p, "uUpperUvRect");
            uUpperSpliceLoc = gl.getUniformLocation(p, "uUpperSplice");
            uUpperShiftCountLoc = gl.getUniformLocation(p, "uUpperShiftCount");
            uUpperShiftMetaLoc = gl.getUniformLocation(p, "uUpperShiftMeta[0]");
            uUpperShiftTargetLoc = gl.getUniformLocation(p, "uUpperShiftTarget[0]");
            uUpperShiftBoundsLoc = gl.getUniformLocation(p, "uUpperShiftBounds[0]");
            uStudioMixLoc = gl.getUniformLocation(p, "uStudioMix");
            uStudioCylLoc = gl.getUniformLocation(p, "uStudioCyl");
            uStudioPreColoredLoc = gl.getUniformLocation(p, "uStudioPreColored");
            uSizeFitLoc = gl.getUniformLocation(p, "uSizeFit");
            uSizeMetaLoc = gl.getUniformLocation(p, "uSizeMeta");

            gl.uniform1i(uTexLoc, 0);
            gl.uniform1i(uTexUpperLoc, 1);
            gl.uniform1i(uTexStudioLoc, 2);
            gl.uniform1i(uTexStudioNextLoc, 3);

            glQuadBuf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, glQuadBuf);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
              gl.STATIC_DRAW
            );
            gl.enableVertexAttribArray(aPosLoc);
            gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);
          }
        }
      }
    }

    const uploadGpuTexture = (
      bmp: ImageBitmap | HTMLCanvasElement,
      isPremultiplied?: boolean
    ): WebGLTexture | null => {
      if (!gl) return null;
      const tex = gl.createTexture();
      if (!tex) return null;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
        isPremultiplied ? 0 : 1
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      return tex;
    };

    let cw = 432;
    let ch = 768;
    let dpr = 1;
    let dpr2d = 1;
    let rafId = 0;
    let lastTime = performance.now();

    const kickRender = () => {
      if (!rafId) {
        lastTime = performance.now();
        rafId = requestAnimationFrame((ts) => renderFrame(ts));
      }
    };
    kickRenderRef.current = kickRender;

    const updateCanvasSize = () => {
      // Full 3.0x Super-Retina physical pixel density delivers 1:1 native OLED sharpness with zero browser upscaling blur!
      dpr = Math.min(window.devicePixelRatio || 1, 3);
      dpr2d = Math.min(window.devicePixelRatio || 1, 2.5);
      cw = Math.max(160, stageEl.clientWidth);
      ch = Math.max(200, stageEl.clientHeight);
      const nextW = Math.round(cw * dpr);
      const nextH = Math.round(ch * dpr);
      if (glCanvas.width !== nextW || glCanvas.height !== nextH) {
        glCanvas.width = nextW;
        glCanvas.height = nextH;
      }
      const next2W = Math.round(cw * dpr2d);
      const next2H = Math.round(ch * dpr2d);
      if (canvas2d.width !== next2W || canvas2d.height !== next2H) {
        canvas2d.width = next2W;
        canvas2d.height = next2H;
      }
      kickRender();
    };
    updateCanvasSize();
    const ro = new ResizeObserver(updateCanvasSize);
    ro.observe(stageEl);

    // ========================================================================
    // NATIVE 120Hz TOUCH + MOUSE INPUT ENGINE (ZERO iOS SCROLL INTERFERENCE!)
    // ========================================================================
    let activeDrag = false;
    let gestureMode: "undecided" | "spin" | "scroll" = "undecided";
    let startX = 0;
    let startY = 0;
    let lastMoveX = 0;
    let lastMoveTs = 0;
    let movedDist = 0;

    const beginDrag = (clientX: number, clientY: number, isTouch: boolean, target: EventTarget | null) => {
      if ((target as HTMLElement)?.closest("button")) return false;
      if (ignoreLeftFraction > 0) {
        const rect = stageEl.getBoundingClientRect();
        const rx = (clientX - rect.left) / Math.max(1, rect.width);
        if (rx < ignoreLeftFraction) {
          return false;
        }
      }
      activeDrag = true;
      gestureMode = isTouch ? "undecided" : "spin";
      movedDist = 0;
      startX = clientX;
      startY = clientY;
      lastMoveX = clientX;
      lastMoveTs = performance.now();
      velYawRef.current = 0;
      targetYawRef.current = yawRef.current;
      return true;
    };

    const updateDrag = (clientX: number, clientY: number): boolean => {
      if (!activeDrag || gestureMode === "scroll") return false;
      const dx = clientX - startX;
      const dy = clientY - startY;
      movedDist = Math.hypot(dx, dy);

      if (gestureMode === "undecided") {
        if (movedDist < 3) return false;
        if (Math.abs(dy) > Math.abs(dx) * 1.15) {
          gestureMode = "scroll";
          activeDrag = false;
          return false;
        }
        gestureMode = "spin";
      }

      const nowTs = performance.now();
      const dtMove = Math.max(4, nowTs - lastMoveTs) / 1000;
      const stepDx = clientX - lastMoveX;
      lastMoveX = clientX;
      lastMoveTs = nowTs;

      if (movedDist > 4 && autoSpinRef.current) {
        setAutoSpin(false);
      }

      const radPerPx = (Math.PI * 2) / Math.max(210, cw * 0.66);
      const deltaYaw = -stepDx * radPerPx;
      if (inertiaSpin) {
        const instV = deltaYaw / dtMove;
        velYawRef.current =
          velYawRef.current * 0.38 + clamp(instV, -15, 15) * 0.62;
      }
      targetYawRef.current += deltaYaw;
      yawRef.current = targetYawRef.current;
      kickRender();
      return true;
    };

    const finishDrag = (clientX: number, clientY: number) => {
      if (!activeDrag) return;
      activeDrag = false;
      if (performance.now() - lastMoveTs > 65) {
        velYawRef.current = 0;
      }
      kickRender();

      if (movedDist < 6 && equippedRef.current.length > 0 && mode === "avatar") {
        const rect = stageEl.getBoundingClientRect();
        const rx =
          (clientX - rect.left) / Math.max(1, rect.width) -
          (centerXFracRef.current - 0.5);
        const ry = (clientY - rect.top) / Math.max(1, rect.height);
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

    // Dedicated `{ passive: false }` touch listeners so iOS Safari delivers raw 120Hz spin events!
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      beginDrag(t.clientX, t.clientY, true, e.target);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!activeDrag || e.touches.length !== 1) return;
      const t = e.touches[0];
      const spinning = updateDrag(t.clientX, t.clientY);
      if (spinning) {
        e.stopPropagation();
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      finishDrag(t ? t.clientX : lastMoveX, t ? t.clientY : startY);
    };

    // Desktop / Playwright mouse pointer handlers (`pointerType !== "touch"`)
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (beginDrag(e.clientX, e.clientY, false, e.target)) {
        try {
          stageEl.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || !activeDrag) return;
      if (updateDrag(e.clientX, e.clientY)) {
        e.stopPropagation();
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      try {
        if (stageEl.hasPointerCapture(e.pointerId)) {
          stageEl.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      finishDrag(e.clientX, e.clientY);
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0 && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        targetZoomRef.current = clamp(
          targetZoomRef.current - Math.sign(e.deltaY) * 0.08,
          0.82,
          1.52
        );
        kickRender();
      }
    };

    stageEl.addEventListener("touchstart", onTouchStart, { passive: true });
    stageEl.addEventListener("touchmove", onTouchMove, { passive: false });
    stageEl.addEventListener("touchend", onTouchEnd, { passive: true });
    stageEl.addEventListener("touchcancel", onTouchEnd, { passive: true });
    stageEl.addEventListener("pointerdown", onPointerDown);
    stageEl.addEventListener("pointermove", onPointerMove, { passive: true });
    stageEl.addEventListener("pointerup", onPointerUp);
    stageEl.addEventListener("pointercancel", onPointerUp);
    stageEl.addEventListener("wheel", onWheel, { passive: false });

    let lastFrameIdx = -2;
    let lastZoom = -1;
    let lastCw = -1;
    let lastCh = -1;
    let lastPaintVer = -1;
    let lastVisMode: Render3DVisualMode | "" = "";
    let lastShowRings: boolean | null = null;
    let lastMoodId = "";
    let lastDimsSig = "";
    let lastSizeStepDrawn = -999;
    let lastStudioMixDrawn = -999;
    let lastCylBucketDrawn = -999;
    let lastDomDeg = -1;
    let lastCbDeg = -999;
    let overlayWasDirty = false;
    let deferredUploadTimer = 0;

    const scheduleDeferredUpload = () => {
      if (deferredUploadTimer) return;
      deferredUploadTimer = window.setTimeout(() => {
        deferredUploadTimer = 0;
        kickRender();
      }, 95);
    };

    const renderFrame = (now: number) => {
      rafId = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const isSpinningFinger = activeDrag && gestureMode === "spin";

      if (autoSpinRef.current && !isSpinningFinger) {
        targetYawRef.current += dt * 0.92;
      } else if (
        inertiaSpin &&
        !isSpinningFinger &&
        Math.abs(velYawRef.current) > 0.014
      ) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.6 * dt);
        if (Math.abs(velYawRef.current) <= 0.014) velYawRef.current = 0;
      }

      // Gentle cardinal magnet-settle when released within ±13.5° of Front (0°) or Back (180°)
      // so the avatar never rests at an awkward half-rotated angle and cleanly upgrades to 4K Studio Master!
      if (
        mode === "avatar" &&
        !autoSpinRef.current &&
        !isSpinningFinger &&
        Math.abs(velYawRef.current) < 0.28
      ) {
        const dFrontRad = shortestAngleDeltaRad(targetYawRef.current, 0);
        const dBackRad = shortestAngleDeltaRad(targetYawRef.current, Math.PI);
        if (
          Math.abs(dFrontRad) > 0.002 &&
          Math.abs(dFrontRad) < (13.5 * Math.PI) / 180
        ) {
          velYawRef.current = 0;
          targetYawRef.current += dFrontRad;
        } else if (
          Math.abs(dBackRad) > 0.002 &&
          Math.abs(dBackRad) < (13.5 * Math.PI) / 180
        ) {
          velYawRef.current = 0;
          targetYawRef.current += dBackRad;
        }
      }

      if (isSpinningFinger) {
        yawRef.current = targetYawRef.current;
      } else {
        const yawDiff = targetYawRef.current - yawRef.current;
        if (Math.abs(yawDiff) > 0.0004) {
          yawRef.current += yawDiff * (1 - Math.exp(-20 * dt));
        } else {
          yawRef.current = targetYawRef.current;
        }
      }

      const zoomDiff = targetZoomRef.current - zoomRef.current;
      if (Math.abs(zoomDiff) > 0.0005) {
        zoomRef.current += zoomDiff * (1 - Math.exp(-16 * dt));
      } else {
        zoomRef.current = targetZoomRef.current;
      }

      // Smooth 120Hz spring animation when customer clicks XS / S / M / L / XL!
      const targetMorph = sizeMorphRef.current;
      const szDiff = targetMorph.sizeStep - animSizeStepRef.current;
      if (Math.abs(szDiff) > 0.003) {
        animSizeStepRef.current += szDiff * (1 - Math.exp(-18 * dt));
      } else {
        animSizeStepRef.current = targetMorph.sizeStep;
      }
      const hemDiff = targetMorph.hemDropLocal - animHemDropRef.current;
      if (Math.abs(hemDiff) > 0.0002) {
        animHemDropRef.current += hemDiff * (1 - Math.exp(-18 * dt));
      } else {
        animHemDropRef.current = targetMorph.hemDropLocal;
      }

      const normProgress =
        (((yawRef.current / (Math.PI * 2)) % 1) + 1) % 1;
      const exactDeg = normProgress * 360;

      const activeBundle = bundleRef.current;
      const activeUpperBundle = upperBundleRef.current;
      const frames = framesRef.current;
      const hasAtlas = Boolean(activeBundle?.atlasBitmap);
      const totalFrames = hasAtlas
        ? activeBundle?.totalFrames ||
          (activeBundle?.atlasBitmapB
            ? NUM_TURNTABLE_FRAMES
            : activeBundle?.framesPerSheet || ATLAS_FRAMES_PER_SHEET)
        : frames.length;
      const frameIdx =
        totalFrames > 0
          ? Math.floor(normProgress * totalFrames) % totalFrames
          : -1;

      const dims = dimsRef.current;
      const zoom = zoomRef.current;
      const curVisMode = visualModeRef.current;
      const curRings = showRingsRef.current;
      const curMood = lightingPresetRef.current;
      const macro = macroRef.current;
      const macroKey = macro
        ? `${macro.cropY0}:${macro.cropY1}:${macro.widthFrac}`
        : "full";
      const curCxFrac = centerXFracRef.current;
      const dimsSig = `${dims.heightInches}:${dims.bustInches}:${dims.waistInches}:${dims.hipsInches}:${macroKey}:${curCxFrac}`;

      const deg = Math.round(exactDeg) % 360;
      if (deg !== lastDomDeg) {
        lastDomDeg = deg;
        if (degBadgeRef.current) {
          degBadgeRef.current.textContent = `${deg}° 360°`;
        }
        if (Math.abs(deg - lastCbDeg) >= 4 || (deg === 0 && lastCbDeg !== 0)) {
          lastCbDeg = deg;
          onYawChangeRef.current?.(deg);
        }
      }

      // Defer 66.8MB QHD GPU upload if customer's finger is actively spinning on Fast Tier -> 0ms hitch!
      const isActivelyMovingFast =
        isSpinningFinger || Math.abs(velYawRef.current) > 0.45;

      if (gl && glProg) {
        // Upload 4K Studio Master canvases (~4.8MB -> <2ms upload!)
        if (
          studioFrontVerRef.current > 0 &&
          studioFrontVerRef.current !== uploadedStudioFrontVer &&
          studioFrontCanvasRef.current
        ) {
          if (glTexStudioFront) gl.deleteTexture(glTexStudioFront);
          glTexStudioFront = uploadGpuTexture(studioFrontCanvasRef.current, false);
          uploadedStudioFrontVer = studioFrontVerRef.current;
          lastFrameIdx = -2;
        } else if (studioFrontVerRef.current === 0 && glTexStudioFront) {
          gl.deleteTexture(glTexStudioFront);
          glTexStudioFront = null;
          uploadedStudioFrontVer = 0;
        }

        if (
          studioSideRVerRef.current > 0 &&
          studioSideRVerRef.current !== uploadedStudioSideRVer &&
          studioSideRCanvasRef.current
        ) {
          if (glTexStudioSideR) gl.deleteTexture(glTexStudioSideR);
          glTexStudioSideR = uploadGpuTexture(studioSideRCanvasRef.current, false);
          uploadedStudioSideRVer = studioSideRVerRef.current;
          lastFrameIdx = -2;
        } else if (studioSideRVerRef.current === 0 && glTexStudioSideR) {
          gl.deleteTexture(glTexStudioSideR);
          glTexStudioSideR = null;
          uploadedStudioSideRVer = 0;
        }

        if (
          studioBackVerRef.current > 0 &&
          studioBackVerRef.current !== uploadedStudioBackVer &&
          studioBackCanvasRef.current
        ) {
          if (glTexStudioBack) gl.deleteTexture(glTexStudioBack);
          glTexStudioBack = uploadGpuTexture(studioBackCanvasRef.current, false);
          uploadedStudioBackVer = studioBackVerRef.current;
          lastFrameIdx = -2;
        } else if (studioBackVerRef.current === 0 && glTexStudioBack) {
          gl.deleteTexture(glTexStudioBack);
          glTexStudioBack = null;
          uploadedStudioBackVer = 0;
        }

        if (
          studioSideLVerRef.current > 0 &&
          studioSideLVerRef.current !== uploadedStudioSideLVer &&
          studioSideLCanvasRef.current
        ) {
          if (glTexStudioSideL) gl.deleteTexture(glTexStudioSideL);
          glTexStudioSideL = uploadGpuTexture(studioSideLCanvasRef.current, false);
          uploadedStudioSideLVer = studioSideLVerRef.current;
          lastFrameIdx = -2;
        } else if (studioSideLVerRef.current === 0 && glTexStudioSideL) {
          gl.deleteTexture(glTexStudioSideL);
          glTexStudioSideL = null;
          uploadedStudioSideLVer = 0;
        }

        // Primary Turntable Sheet upload
        if (
          activeBundle &&
          activeBundle !== uploadedBundleRef &&
          activeBundle.atlasBitmap
        ) {
          const canDeferUpgrade =
            isActivelyMovingFast &&
            Boolean(glTexA) &&
            uploadedBundleRef?.isFastTier &&
            !activeBundle.isFastTier;
          if (canDeferUpgrade) {
            scheduleDeferredUpload();
          } else {
            try {
              if (glTexA) gl.deleteTexture(glTexA);
              if (glTexB) {
                gl.deleteTexture(glTexB);
                glTexB = null;
              }
              glTexA = uploadGpuTexture(
                activeBundle.atlasBitmap,
                activeBundle.isPremultiplied
              );
              if (activeBundle.atlasBitmapB) {
                glTexB = uploadGpuTexture(
                  activeBundle.atlasBitmapB,
                  activeBundle.isPremultiplied
                );
              }
              uploadedBundleRef = activeBundle;
              lastFrameIdx = -2;
            } catch {
              // fallback cleanly if bitmap was disposed
            }
          }
        }

        // Optional Upper Turntable Sheet upload (for Multi-Slot Closet Splicing!)
        if (!activeUpperBundle) {
          if (glTexUpper) {
            gl.deleteTexture(glTexUpper);
            glTexUpper = null;
          }
          uploadedUpperBundleRef = null;
        } else if (
          activeUpperBundle !== uploadedUpperBundleRef &&
          activeUpperBundle.atlasBitmap
        ) {
          const canDeferUpper =
            isActivelyMovingFast &&
            Boolean(glTexUpper) &&
            uploadedUpperBundleRef?.isFastTier &&
            !activeUpperBundle.isFastTier;
          if (canDeferUpper) {
            scheduleDeferredUpload();
          } else {
            try {
              if (glTexUpper) gl.deleteTexture(glTexUpper);
              glTexUpper = uploadGpuTexture(
                activeUpperBundle.atlasBitmap,
                activeUpperBundle.isPremultiplied
              );
              uploadedUpperBundleRef = activeUpperBundle;
              lastFrameIdx = -2;
            } catch {
              // ignore
            }
          }
        }
      }

      // Compute 4K Studio Master state (STRICTLY BINARY 0.0 or 1.0 — NEVER partial blend two poses!)
      const distFront = Math.min(exactDeg, 360 - exactDeg);
      const distBack = Math.abs(exactDeg - 180);
      let studioMix = 0.0;
      const studioNextMix = 0.0;
      let studioCylScale = 1.0;
      let primaryStudioTex: WebGLTexture | null = glTexStudioFront;
      const nextStudioTex: WebGLTexture | null = null;
      const isCustom4K = Boolean(
        mode === "avatar" && turntableSpecRef.current.isCustomMix && glTexStudioFront
      );
      const studioTexStepX = isCustom4K ? 1.0 / 900.0 : 1.0 / 1350.0;

      if (isCustom4K) {
        studioMix = 1.0;
        const viewTex = (q: number): WebGLTexture | null => {
          const m = ((q % 4) + 4) % 4;
          if (m === 0) return glTexStudioFront;
          if (m === 1) return glTexStudioSideR || glTexStudioFront;
          if (m === 2) return glTexStudioBack || glTexStudioFront;
          return glTexStudioSideL || glTexStudioSideR || glTexStudioFront;
        };
        const qIdx = Math.floor(((exactDeg + 45) % 360) / 90);
        const qCenter = qIdx * 90;
        let offsetDeg = exactDeg - qCenter;
        if (offsetDeg > 180) offsetDeg -= 360;
        if (offsetDeg < -180) offsetDeg += 360;

        primaryStudioTex = viewTex(qIdx);
        // Subtle 3D cylindrical foreshortening across each 90° quadrant — zero cross-fade ghosting!
        const normOff = Math.abs(offsetDeg) / 45;
        studioCylScale = 1.0 - 0.12 * normOff * normOff;
      } else if (mode === "avatar") {
        const isSettledIdle =
          !isSpinningFinger &&
          !autoSpinRef.current &&
          Math.abs(velYawRef.current) < 0.08;
        if (
          glTexStudioFront &&
          ((isSettledIdle && distFront <= 2.6) || (!glTexA && distFront < 45))
        ) {
          studioMix = 1.0;
          primaryStudioTex = glTexStudioFront;
        } else if (glTexStudioBack && isSettledIdle && distBack <= 2.6) {
          studioMix = 1.0;
          primaryStudioTex = glTexStudioBack;
        } else {
          studioMix = 0.0;
        }
      }

      const cylBucket = isCustom4K ? Math.round(exactDeg * 2) : -1;

      const needsMotionFrame =
        autoSpinRef.current ||
        isSpinningFinger ||
        Math.abs(velYawRef.current) > 0.014 ||
        Math.abs(targetYawRef.current - yawRef.current) > 0.0004 ||
        Math.abs(targetZoomRef.current - zoomRef.current) > 0.0005 ||
        Math.abs(targetMorph.sizeStep - animSizeStepRef.current) > 0.003 ||
        Math.abs(targetMorph.hemDropLocal - animHemDropRef.current) > 0.0002;

      if (
        frameIdx === lastFrameIdx &&
        cylBucket === lastCylBucketDrawn &&
        Math.abs(zoom - lastZoom) < 0.0006 &&
        cw === lastCw &&
        ch === lastCh &&
        paintVersionRef.current === lastPaintVer &&
        curVisMode === lastVisMode &&
        curRings === lastShowRings &&
        curMood === lastMoodId &&
        dimsSig === lastDimsSig &&
        Math.abs(animSizeStepRef.current - lastSizeStepDrawn) < 0.002 &&
        Math.abs(studioMix - lastStudioMixDrawn) < 0.004
      ) {
        if (needsMotionFrame) {
          rafId = requestAnimationFrame(renderFrame);
        }
        return;
      }

      lastFrameIdx = frameIdx;
      lastCylBucketDrawn = cylBucket;
      lastZoom = zoom;
      lastCw = cw;
      lastCh = ch;
      lastPaintVer = paintVersionRef.current;
      lastVisMode = curVisMode;
      lastShowRings = curRings;
      lastMoodId = curMood;
      lastDimsSig = dimsSig;
      lastSizeStepDrawn = animSizeStepRef.current;
      lastStudioMixDrawn = studioMix;

      // Frame geometry inside stage (maximizes clean full-screen avatar height with minimal studio margin!)
      const isNarrowMobile = cw < 460;
      const topPad = showHud
        ? compactHud
          ? 36
          : isNarrowMobile
          ? 38
          : 50
        : Math.round(ch * 0.022);
      const baseBotPad = showHud
        ? isNarrowMobile
          ? 44
          : compactHud
          ? 44
          : 50
        : Math.round(ch * 0.022);
      const botPad = baseBotPad + bottomReservePx;
      const scaleAvailH = Math.max(120, ch - topPad - baseBotPad);
      const availH = Math.max(120, ch - topPad - botPad);

      const hScale = clamp(dims.heightInches / 64.0, 0.95, 1.04);
      const shS = clamp(1 + (dims.shoulderInches / 15.2 - 1) * 0.22, 0.96, 1.05);
      const buS = clamp(1 + (dims.bustInches / 36.0 - 1) * 0.22, 0.95, 1.06);
      const waS = clamp(1 + (dims.waistInches / 27.5 - 1) * 0.24, 0.94, 1.06);
      const hiS = clamp(1 + (dims.hipsInches / 38.5 - 1) * 0.25, 0.95, 1.07);
      const bodyWidthScale = clamp((shS + buS + waS + hiS) * 0.25, 0.95, 1.06);

      let drawH: number;
      let scaledW: number;
      let centerX: number;
      let drawY: number;
      let cropLocalMinY = -0.1;
      let cropLocalMaxY = 1.1;
      let cropFeatherTop = 0.0;
      let cropFeatherBot = 0.0;

      if (macro) {
        // Photorealistic Close-Up Item 360° Macro Framing (`mode === "product"`)
        const spanY = Math.max(0.18, macro.cropY1 - macro.cropY0);
        const maxDrawHBySharpness = 1780 / ATLAS_ROI_H;
        const maxDrawHByMacroW = ((cw * 0.90) / macro.widthFrac) * (16 / 9);
        const macroBaseH = Math.min(
          (ch * 0.78) / spanY,
          maxDrawHByMacroW,
          maxDrawHBySharpness
        );
        drawH = macroBaseH * zoom;
        const drawW = drawH * (9 / 16);
        scaledW = drawW * bodyWidthScale;
        centerX = cw * 0.5;
        const midY = (macro.cropY0 + macro.cropY1) * 0.5;
        drawY = ch * 0.53 - midY * drawH;

        cropLocalMinY = (macro.cropY0 - ATLAS_ROI_Y0) / ATLAS_ROI_H;
        cropLocalMaxY = (macro.cropY1 - ATLAS_ROI_Y0) / ATLAS_ROI_H;
        cropFeatherTop = macro.featherTop / ATLAS_ROI_H;
        cropFeatherBot = macro.featherBot / ATLAS_ROI_H;
      } else {
        const maxDrawHByWidth = (cw / 0.58) * (16 / 9);
        const baseDrawH = Math.min(scaleAvailH / 0.79, maxDrawHByWidth);
        const maxDrawHByClearance =
          bottomReservePx > 0 ? (availH * 0.985) / 0.758 : Infinity;
        drawH = Math.min(baseDrawH * hScale, maxDrawHByClearance) * zoom;
        const drawW = drawH * (9 / 16);
        scaledW = drawW * bodyWidthScale;
        centerX = cw * curCxFrac;
        if (curCxFrac > 0.52) {
          centerX = Math.min(centerX, cw - scaledW * 0.275);
        }

        const figSpanH = drawH * 0.758;
        const soleScreenY =
          figSpanH < availH * 0.90
            ? topPad + (availH + figSpanH) * 0.5
            : topPad + availH * 0.978;
        drawY = soleScreenY - drawH * 0.888;
      }

      const dstW = ATLAS_ROI_W * scaledW;
      const dstH = ATLAS_ROI_H * drawH;
      const dstX = centerX + (ATLAS_ROI_X0 - 0.5) * scaledW;
      const dstY = drawY + ATLAS_ROI_Y0 * drawH;

      let renderedViaWebGL = false;

      const hasUploadedBase = Boolean(
        !isCustom4K && hasAtlas && glTexA && frameIdx >= 0 && uploadedBundleRef
      );
      const canRenderStudioOnly = Boolean(
        studioMix > 0.99 && primaryStudioTex
      );

      // ULTRA-FAST HARDWARE WEBGL 4K STUDIO + 72-FRAME QHD + MULTI-SLOT SPLICING + LIVE SIZE-FIT MORPH!
      if (gl && glProg && (hasUploadedBase || canRenderStudioOnly)) {
        const curShifts = activeShiftsRef.current;
        const curUpShifts = activeUpperShiftsRef.current;
        const curSkinHex = skinToneHexRef.current;
        const specNow = turntableSpecRef.current;

        if (posterImgRef.current) {
          posterImgRef.current.style.opacity = "0";
        }

        let u0 = 0;
        let v0 = 0;
        let uw = 1;
        let vh = 1;
        let sheetW = 4080;
        let sheetH = 4092;
        let useB = false;
        const baseB = uploadedBundleRef;

        if (hasUploadedBase && baseB) {
          const cols = baseB.cols || ATLAS_COLS;
          const rows = baseB.rows || ATLAS_ROWS;
          const perSheet = baseB.framesPerSheet || ATLAS_FRAMES_PER_SHEET;
          const cwCell = baseB.cellW || ATLAS_CELL_W;
          const chCell = baseB.cellH || ATLAS_CELL_H;
          const bTotal = baseB.totalFrames || perSheet;
          const bFrameIdx = Math.floor(normProgress * bTotal) % bTotal;
          useB = bFrameIdx >= perSheet && Boolean(glTexB);
          const localIdx = useB ? bFrameIdx - perSheet : bFrameIdx % perSheet;
          const col = localIdx % cols;
          const row = (localIdx / cols) | 0;
          sheetW = cols * cwCell;
          sheetH = rows * chCell;
          const padU = 0.5 / sheetW;
          const padV = 0.5 / sheetH;
          u0 = col / cols + padU;
          v0 = row / rows + padV;
          uw = 1 / cols - 2 * padU;
          vh = 1 / rows - 2 * padV;
        }

        const moodGain =
          curMood === "golden_atelier"
            ? [1.05, 1.01, 0.94]
            : curMood === "runway_spotlight"
            ? [1.03, 1.03, 1.04]
            : curMood === "evening_soiree"
            ? [1.06, 0.99, 0.92]
            : [1.0, 1.0, 1.0];

        const shiftCount = Math.min(4, curShifts.length);
        const metaArr = new Float32Array(16);
        const targetArr = new Float32Array(12);
        const boundsArr = new Float32Array(16);
        for (let si = 0; si < shiftCount; si++) {
          const sh = curShifts[si];
          const [tr, tg, tb] = hexToRgb01(sh.targetHex);
          const nativeHex =
            sh.nativeHex || DEFAULT_MASK_NATIVE_HEX[sh.sourceMask];
          const [dr, dg, db] = hexToRgb01(nativeHex);
          const donorLum = clamp(0.299 * dr + 0.587 * dg + 0.114 * db, 0.11, 0.85);
          metaArr[si * 4] = DONOR_MASK_TO_GL_ID[sh.sourceMask] || 0;
          metaArr[si * 4 + 1] = donorLum;
          metaArr[si * 4 + 2] = sh.isMetallic ? 0.30 : 0.14;
          metaArr[si * 4 + 3] = 0;

          targetArr[si * 3] = tr;
          targetArr[si * 3 + 1] = tg;
          targetArr[si * 3 + 2] = tb;

          boundsArr[si * 4] = clamp(
            (sh.yRange[0] - ATLAS_ROI_Y0) / ATLAS_ROI_H,
            0,
            1
          );
          boundsArr[si * 4 + 1] = clamp(
            (sh.yRange[1] - ATLAS_ROI_Y0) / ATLAS_ROI_H,
            0,
            1
          );
          boundsArr[si * 4 + 2] = sh.xRange
            ? clamp((sh.xRange[0] - ATLAS_ROI_X0) / ATLAS_ROI_W, 0, 1)
            : 0;
          boundsArr[si * 4 + 3] = sh.xRange
            ? clamp((sh.xRange[1] - ATLAS_ROI_X0) / ATLAS_ROI_W, 0, 1)
            : 1;
        }

        // Upper Overlay Uniforms (Multi-Slot Closet Splicing!)
        const upSpec = specNow.upperOverlay;
        const upB = uploadedUpperBundleRef;
        const hasValidUpper = Boolean(upSpec && glTexUpper && upB);
        let upU0 = 0;
        let upV0 = 0;
        let upUw = 1;
        let upVh = 1;
        let spliceLocalY = 0.4;
        let spliceLocalF = 0.03;
        let upperModeId = 1;
        let frontFacingW = 0;

        if (hasValidUpper && upSpec && upB) {
          const uCols = upB.cols || ATLAS_COLS;
          const uRows = upB.rows || ATLAS_ROWS;
          const uPerSheet = upB.framesPerSheet || ATLAS_FRAMES_PER_SHEET;
          const uCwCell = upB.cellW || ATLAS_CELL_W;
          const uChCell = upB.cellH || ATLAS_CELL_H;
          const uTotal = upB.totalFrames || uPerSheet;
          const uFrameIdx = Math.floor(normProgress * uTotal) % uTotal;
          const uLocal = uFrameIdx % uPerSheet;
          const uCol = uLocal % uCols;
          const uRow = (uLocal / uCols) | 0;
          const uPadU = 0.5 / (uCols * uCwCell);
          const uPadV = 0.5 / (uRows * uChCell);
          upU0 = uCol / uCols + uPadU;
          upV0 = uRow / uRows + uPadV;
          upUw = 1 / uCols - 2 * uPadU;
          upVh = 1 / uRows - 2 * uPadV;

          spliceLocalY = clamp(
            (upSpec.spliceYVirtual - ATLAS_ROI_Y0) / ATLAS_ROI_H,
            0.18,
            0.92
          );
          spliceLocalF = Math.max(0.015, upSpec.featherVirtual / ATLAS_ROI_H);
          upperModeId =
            upSpec.blendMode === "open_outer_over_dress"
              ? 2
              : upSpec.blendMode === "closed_outer_over_dress"
              ? 3
              : 1;
          frontFacingW =
            distFront < 82
              ? 1 - clamp((distFront - 48) / 34, 0, 1)
              : 0;
        }

        const upShiftCount = hasValidUpper ? Math.min(2, curUpShifts.length) : 0;
        const upMetaArr = new Float32Array(8);
        const upTargetArr = new Float32Array(6);
        const upBoundsArr = new Float32Array(8);
        for (let ui = 0; ui < upShiftCount; ui++) {
          const sh = curUpShifts[ui];
          const [tr, tg, tb] = hexToRgb01(sh.targetHex);
          const nativeHex =
            sh.nativeHex || DEFAULT_MASK_NATIVE_HEX[sh.sourceMask];
          const [dr, dg, db] = hexToRgb01(nativeHex);
          const donorLum = clamp(0.299 * dr + 0.587 * dg + 0.114 * db, 0.11, 0.85);
          upMetaArr[ui * 4] = DONOR_MASK_TO_GL_ID[sh.sourceMask] || 0;
          upMetaArr[ui * 4 + 1] = donorLum;
          upMetaArr[ui * 4 + 2] = sh.isMetallic ? 0.30 : 0.14;
          upMetaArr[ui * 4 + 3] = 0;

          upTargetArr[ui * 3] = tr;
          upTargetArr[ui * 3 + 1] = tg;
          upTargetArr[ui * 3 + 2] = tb;

          upBoundsArr[ui * 4] = clamp(
            (sh.yRange[0] - ATLAS_ROI_Y0) / ATLAS_ROI_H,
            0,
            1
          );
          upBoundsArr[ui * 4 + 1] = clamp(
            (sh.yRange[1] - ATLAS_ROI_Y0) / ATLAS_ROI_H,
            0,
            1
          );
          upBoundsArr[ui * 4 + 2] = sh.xRange
            ? clamp((sh.xRange[0] - ATLAS_ROI_X0) / ATLAS_ROI_W, 0, 1)
            : 0;
          upBoundsArr[ui * 4 + 3] = sh.xRange
            ? clamp((sh.xRange[1] - ATLAS_ROI_X0) / ATLAS_ROI_W, 0, 1)
            : 1;
        }

        let skinMulVec: [number, number, number, number] = [1, 1, 1, 0];
        if (curSkinHex) {
          const [sr, sg, sb] = hexToRgb01(curSkinHex);
          skinMulVec = [
            clamp((sr / 0.78) * 0.5, 0, 1) * 2,
            clamp((sg / 0.57) * 0.5, 0, 1) * 2,
            clamp((sb / 0.45) * 0.5, 0, 1) * 2,
            1,
          ];
        }

        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        if (seamlessStage) {
          gl.clearColor(0, 0, 0, 0);
        } else {
          gl.clearColor(1, 1, 1, 1);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(glProg);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(
          gl.TEXTURE_2D,
          hasUploadedBase ? (useB ? glTexB : glTexA) : glDummyTex
        );
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(
          gl.TEXTURE_2D,
          hasValidUpper ? glTexUpper : glDummyTex
        );
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(
          gl.TEXTURE_2D,
          studioMix > 0.004 && primaryStudioTex ? primaryStudioTex : glDummyTex
        );
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(
          gl.TEXTURE_2D,
          studioNextMix > 0.004 && nextStudioTex ? nextStudioTex : glDummyTex
        );
        gl.activeTexture(gl.TEXTURE0);

        gl.uniform4f(uRectLoc, dstX / cw, dstY / ch, dstW / cw, dstH / ch);
        gl.uniform4f(uUvRectLoc, u0, v0, uw, vh);
        gl.uniform2f(uTexelLoc, 1 / sheetW, 1 / sheetH);
        gl.uniform4f(uCellBoundsLoc, u0, v0, u0 + uw, v0 + vh);
        gl.uniform4f(
          uCropYLoc,
          cropLocalMinY,
          cropLocalMaxY,
          cropFeatherTop,
          cropFeatherBot
        );
        gl.uniform3f(uMoodLoc, moodGain[0], moodGain[1], moodGain[2]);
        gl.uniform1f(uSeamlessLoc, seamlessStage ? 1.0 : 0.0);
        gl.uniform1f(
          uSharpAmtLoc,
          baseB?.isFastTier ? 1.05 : 0.98
        );
        gl.uniform1i(uShiftCountLoc, shiftCount);
        if (shiftCount > 0) {
          gl.uniform4fv(uShiftMetaLoc, metaArr);
          gl.uniform3fv(uShiftTargetLoc, targetArr);
          gl.uniform4fv(uShiftBoundsLoc, boundsArr);
        }

        gl.uniform1f(uHasBaseTexLoc, hasUploadedBase ? 1.0 : 0.0);
        gl.uniform1f(uHasUpperLoc, hasValidUpper ? 1.0 : 0.0);
        if (hasValidUpper) {
          gl.uniform4f(uUpperUvRectLoc, upU0, upV0, upUw, upVh);
          gl.uniform4f(
            uUpperSpliceLoc,
            spliceLocalY,
            spliceLocalF,
            upperModeId,
            frontFacingW
          );
        }
        gl.uniform1i(uUpperShiftCountLoc, upShiftCount);
        if (upShiftCount > 0) {
          gl.uniform4fv(uUpperShiftMetaLoc, upMetaArr);
          gl.uniform3fv(uUpperShiftTargetLoc, upTargetArr);
          gl.uniform4fv(uUpperShiftBoundsLoc, upBoundsArr);
        }

        gl.uniform1f(
          uStudioMixLoc,
          primaryStudioTex ? studioMix : 0.0
        );
        gl.uniform2f(
          uStudioCylLoc,
          studioTexStepX,
          studioCylScale
        );
        gl.uniform1f(
          uStudioPreColoredLoc,
          studioPreColoredRef.current ? 1.0 : 0.0
        );
        gl.uniform4f(
          uSizeFitLoc,
          animSizeStepRef.current,
          targetMorph.yStartLocal,
          targetMorph.yEndLocal,
          targetMorph.yWaistPeakLocal
        );
        gl.uniform2f(
          uSizeMetaLoc,
          animHemDropRef.current,
          targetMorph.slotCode
        );

        gl.uniform4f(
          uSkinMulLoc,
          skinMulVec[0],
          skinMulVec[1],
          skinMulVec[2],
          skinMulVec[3]
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        renderedViaWebGL = true;
      } else if (gl && !hasAtlas) {
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        if (seamlessStage) {
          gl.clearColor(0, 0, 0, 0);
        } else {
          gl.clearColor(1, 1, 1, 1);
        }
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      // 2D Canvas path: used ONLY when Heatmap / Scan Rings overlays are active OR as fallback for custom MP4 frames!
      const needsOverlay =
        mode === "avatar" &&
        ((curVisMode === "heatmap" && equippedRef.current.length > 0) ||
          curRings ||
          curVisMode === "xray");

      if (ctx2d && (!renderedViaWebGL || needsOverlay || overlayWasDirty)) {
        ctx2d.save();
        ctx2d.scale(dpr2d, dpr2d);
        ctx2d.clearRect(0, 0, cw, ch);

        if (!renderedViaWebGL) {
          if (macro) {
            ctx2d.beginPath();
            ctx2d.rect(
              0,
              drawY + macro.cropY0 * drawH,
              cw,
              (macro.cropY1 - macro.cropY0) * drawH
            );
            ctx2d.clip();
          }
          try {
            if (hasAtlas && activeBundle?.atlasBitmap && frameIdx >= 0) {
              if (posterImgRef.current) {
                posterImgRef.current.style.opacity = "0";
              }
              const cols = activeBundle.cols || ATLAS_COLS;
              const perSheet =
                activeBundle.framesPerSheet || ATLAS_FRAMES_PER_SHEET;
              const cwCell = activeBundle.cellW || 448;
              const chCell = activeBundle.cellH || 1024;
              const useB =
                frameIdx >= perSheet && Boolean(activeBundle.atlasBitmapB);
              const sheetBmp = useB
                ? activeBundle.atlasBitmapB!
                : activeBundle.atlasBitmap;
              const localIdx = useB ? frameIdx - perSheet : frameIdx % perSheet;
              const col = localIdx % cols;
              const row = (localIdx / cols) | 0;
              ctx2d.drawImage(
                sheetBmp,
                col * cwCell,
                row * chCell,
                cwCell,
                chCell,
                dstX,
                dstY,
                dstW,
                dstH
              );
            } else if (frames.length > 0 && frameIdx >= 0) {
              if (posterImgRef.current) {
                posterImgRef.current.style.opacity = "0";
              }
              const bmp = frames[frameIdx];
              ctx2d.drawImage(bmp, centerX - scaledW * 0.5, drawY, scaledW, drawH);
            } else if (posterBitmapRef.current) {
              const pBmp = posterBitmapRef.current;
              ctx2d.drawImage(pBmp, centerX - scaledW * 0.5, drawY, scaledW, drawH);
            }
          } catch {
            // Safely skip frame if GPU texture was reclaimed mid-transition
          }
        }

        if (curVisMode === "heatmap" && equippedRef.current.length > 0) {
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
            [0.34, scaledW * 0.16, bFeel],
            [0.44, scaledW * 0.135, wFeel],
            [0.54, scaledW * 0.175, hFeel],
          ];
          for (const [yFrac, rxZone, feel] of zones) {
            const zy = drawY + drawH * yFrac;
            const rg = ctx2d.createRadialGradient(
              centerX,
              zy,
              4,
              centerX,
              zy,
              rxZone * 1.25
            );
            rg.addColorStop(0, feelToRgba(feel, 0.34));
            rg.addColorStop(1, feelToRgba(feel, 0.0));
            ctx2d.fillStyle = rg;
            ctx2d.beginPath();
            ctx2d.ellipse(
              centerX,
              zy,
              rxZone * 1.25,
              drawH * 0.055,
              0,
              0,
              Math.PI * 2
            );
            ctx2d.fill();
          }
        }

        if (curRings || curVisMode === "xray") {
          const ringSpecs: Array<[number, number, string, string]> = [
            [0.345, scaledW * 0.155, "#10B981", `${dims.bustInches}" B`],
            [0.442, scaledW * 0.132, "#244B3B", `${dims.waistInches}" W`],
            [0.542, scaledW * 0.172, "#0EA5E9", `${dims.hipsInches}" H`],
          ];
          ctx2d.save();
          for (const [yFrac, rxRing, hex, lbl] of ringSpecs) {
            const ry = drawY + drawH * yFrac;
            ctx2d.strokeStyle = hex;
            ctx2d.lineWidth = 1.75;
            ctx2d.setLineDash([4, 3]);
            ctx2d.beginPath();
            ctx2d.ellipse(centerX, ry, rxRing, rxRing * 0.22, 0, 0, Math.PI * 2);
            ctx2d.stroke();
            ctx2d.setLineDash([]);
            ctx2d.font = "700 9.5px system-ui, -apple-system, sans-serif";
            ctx2d.fillStyle = hex;
            ctx2d.fillText(lbl, centerX + rxRing + 6, ry + 3);
          }
          ctx2d.restore();
        }

        ctx2d.restore();
        overlayWasDirty = needsOverlay || !renderedViaWebGL;
      }

      if (needsMotionFrame) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    kickRender();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (deferredUploadTimer) clearTimeout(deferredUploadTimer);
      kickRenderRef.current = null;
      ro.disconnect();
      stageEl.removeEventListener("touchstart", onTouchStart);
      stageEl.removeEventListener("touchmove", onTouchMove);
      stageEl.removeEventListener("touchend", onTouchEnd);
      stageEl.removeEventListener("touchcancel", onTouchEnd);
      stageEl.removeEventListener("pointerdown", onPointerDown);
      stageEl.removeEventListener("pointermove", onPointerMove);
      stageEl.removeEventListener("pointerup", onPointerUp);
      stageEl.removeEventListener("pointercancel", onPointerUp);
      stageEl.removeEventListener("wheel", onWheel);
      if (gl) {
        if (glDummyTex) gl.deleteTexture(glDummyTex);
        if (glTexA) gl.deleteTexture(glTexA);
        if (glTexB) gl.deleteTexture(glTexB);
        if (glTexUpper) gl.deleteTexture(glTexUpper);
        if (glTexStudioFront) gl.deleteTexture(glTexStudioFront);
        if (glTexStudioSideR) gl.deleteTexture(glTexStudioSideR);
        if (glTexStudioBack) gl.deleteTexture(glTexStudioBack);
        if (glTexStudioSideL) gl.deleteTexture(glTexStudioSideL);
        if (glQuadBuf) gl.deleteBuffer(glQuadBuf);
        if (glProg) gl.deleteProgram(glProg);
      }
    };
  }, [
    bottomReservePx,
    compactHud,
    ignoreLeftFraction,
    inertiaSpin,
    mode,
    seamlessStage,
    showHud,
  ]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    const desiredRad = (deg * Math.PI) / 180;
    targetYawRef.current =
      yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
    kickRenderRef.current?.();
  };

  return (
    <div
      data-3d-engine="higgsfield-imagebitmap-turntable"
      data-3d-topology="higgsfield-360-turntable"
      data-frames-ready={framesReady ? "true" : "false"}
      data-realism-spec={MASTER_REALISM_SPEC_VERSION}
      data-3d-mode={mode}
      data-active-size={visualSizeMorph.activeSize}
      data-size-step={visualSizeMorph.sizeStep.toFixed(2)}
      data-worn-count={mode === "product" ? 1 : userSelectedProducts.length}
      className={`relative w-full h-full select-none overflow-hidden ${
        seamlessStage ? "bg-transparent" : "bg-white"
      } ${className}`}
    >
      <div
        ref={avatarStageRef}
        style={{ touchAction: "pan-y" }}
        className="relative w-full h-full cursor-grab active:cursor-grabbing"
      >
        <canvas
          ref={glCanvasRef}
          className="block w-full h-full"
        />
        {mode === "avatar" && !seamlessStage && !turntableSpec.isCustomMix && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            ref={posterImgRef}
            src={turntableSpec.posterUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 w-full h-full object-contain bg-white transition-opacity duration-100"
          />
        )}
        <canvas
          ref={scrubCanvasRef}
          className="pointer-events-none absolute inset-0 w-full h-full"
        />
      </div>

      {/* Live Physical Size-Fit Indicator when inspecting XS / S / M / L / XL on Body */}
      {hasExplicitSizeControl &&
        !seamlessStage &&
        visualSizeMorph.slotCode !== 5 &&
        Math.abs(visualSizeMorph.sizeStep) > 0.05 && (
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-white/94 backdrop-blur-md border border-[#ECD7E1] shadow-sm flex items-center gap-1.5 whitespace-nowrap">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                visualSizeMorph.tone === "tight" || visualSizeMorph.tone === "snug"
                  ? "bg-[#D97706]"
                  : visualSizeMorph.tone === "ideal"
                  ? "bg-[#10B981]"
                  : "bg-[#B83B6A]"
              }`}
            />
            <span className="text-[10.5px] font-bold text-[#22131A]">
              {visualSizeMorph.badgeTitle}
            </span>
            <span className="hidden sm:inline text-[10px] font-semibold text-[#962953]">
              • {visualSizeMorph.badgeDetail}
            </span>
          </div>
        )}

      {showHud && isLoadingFrames && mode === "avatar" && (
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
          <span
            ref={degBadgeRef}
            className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold"
          >
            {initialDeg}° 360°
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
        <div className="absolute inset-x-1.5 bottom-1.5 z-10 flex items-center justify-center">
          <div className="inline-flex flex-nowrap items-center justify-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-sm max-w-full overflow-x-auto">
            {(
              [
                [0, "Front 0°", "0°"],
                [45, "3/4 45°", "45°"],
                [90, "Side 90°", "90°"],
                [180, "Back 180°", "180°"],
              ] as const
            ).map(([deg, fullLabel, shortLabel]) => (
              <button
                key={deg}
                type="button"
                onClick={() => snapAngle(deg)}
                className="px-2 py-1 rounded-full text-[10px] font-bold text-[#141518] hover:bg-[#EAECEF] cursor-pointer transition min-h-[24px] whitespace-nowrap shrink-0"
              >
                <span className="sm:hidden">{shortLabel}</span>
                <span className="hidden sm:inline">{fullLabel}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setAutoSpin((s) => !s)}
              className={`px-2 sm:px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[24px] whitespace-nowrap shrink-0 ${
                autoSpin
                  ? "bg-[#244B3B] text-white"
                  : "bg-[#F1F3F6] text-[#141518] hover:bg-[#E2E6EC]"
              }`}
            >
              {autoSpin ? (
                <>
                  <Pause className="w-2.5 h-2.5" /> Spin
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
                className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition min-h-[24px] whitespace-nowrap shrink-0 ${
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
                    kickRenderRef.current?.();
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
                    kickRenderRef.current?.();
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
                    kickRenderRef.current?.();
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

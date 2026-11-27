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
  ATLAS_COLS,
  ATLAS_FRAMES_PER_SHEET,
  ATLAS_ROI_H,
  ATLAS_ROI_W,
  ATLAS_ROI_X0,
  ATLAS_ROI_Y0,
  ATLAS_ROWS,
  CachedFrameBundle,
  extractProcessedPosterBitmap,
  extractTurntableBitmapBundle,
  getCachedTurntableBundleSync,
  NUM_TURNTABLE_FRAMES,
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

  const initialDeg = ((Math.round(initialYawDeg) % 360) + 360) % 360;
  const degBadgeRef = useRef<HTMLSpanElement | null>(null);
  const [tappedInfo, setTappedInfo] = useState<{
    product: Product;
    fit?: AvatarExactFitReport;
  } | null>(null);
  const [framesReady, setFramesReady] = useState<boolean>(false);
  const [isLoadingFrames, setIsLoadingFrames] = useState<boolean>(false);

  const bundleRef = useRef<CachedFrameBundle | null>(null);
  const framesRef = useRef<ImageBitmap[]>([]);
  const posterBitmapRef = useRef<ImageBitmap | null>(null);
  const paintVersionRef = useRef<number>(0);
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
        effectiveEquippedProducts,
        {
          skinToneHex: safeDimensions.skinToneHex,
          customTurntableMp4Url: customAvatarTurntableMp4Url || undefined,
          customTurntablePosterUrl: customAvatarTurntablePosterUrl || undefined,
          focusProductId: focusProductId || selectedProductId || undefined,
        }
      ),
    [
      customAvatarTurntableMp4Url,
      customAvatarTurntablePosterUrl,
      effectiveEquippedProducts,
      focusProductId,
      safeDimensions.skinToneHex,
      selectedProductId,
      userSelectedProducts,
    ]
  );

  // Load Off-Thread 96-Frame Pre-Matted RGBA WebP Atlas (or Custom MP4 Stream)
  useEffect(() => {
    if (mode !== "avatar") return;
    let cancelled = false;

    // 1. Instant 0ms synchronous LRU hit if already decoded in RAM!
    const syncHit = getCachedTurntableBundleSync(turntableSpec, seamlessStage);
    if (syncHit && (syncHit.atlasBitmap || syncHit.frames.length > 0)) {
      bundleRef.current = syncHit;
      framesRef.current = syncHit.frames;
      paintVersionRef.current++;
      setFramesReady(true);
      setIsLoadingFrames(false);
      return;
    }

    // 2. Zero-flash transition: on opaque stages keep current frame painted until new atlas arrives;
    // on seamless Runway stage, hand display back cleanly to the matching Runway sprite until ready!
    setFramesReady(false);
    if (seamlessStage) {
      bundleRef.current = null;
      framesRef.current = [];
      posterBitmapRef.current = null;
      paintVersionRef.current++;
    }
    let receivedBundle = false;

    void extractProcessedPosterBitmap(turntableSpec, seamlessStage).then(
      (pBmp) => {
        if (!cancelled && pBmp && !receivedBundle) {
          posterBitmapRef.current = pBmp;
          bundleRef.current = null;
          framesRef.current = [];
          paintVersionRef.current++;
        }
      }
    );

    const spinnerTimer = setTimeout(() => {
      if (!cancelled && !receivedBundle) {
        setIsLoadingFrames(true);
      }
    }, 420);

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

  // HARDWARE WEBGL DUAL-SHEET 1024p RENDERER + 0ms 1:1 BIDIRECTIONAL TOUCH PHYSICS!
  useEffect(() => {
    if (mode !== "avatar") return;
    const stageEl = avatarStageRef.current;
    const glCanvas = glCanvasRef.current;
    const canvas2d = scrubCanvasRef.current;
    if (!stageEl || !glCanvas || !canvas2d) return;

    const ctx2d = canvas2d.getContext("2d");

    // Initialize ultra-fast hardware WebGL context (0.02ms/frame GPU quad blitting at full 3x Retina DPR!)
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
    let glTexA: WebGLTexture | null = null;
    let glTexB: WebGLTexture | null = null;
    let uploadedBundleRef: CachedFrameBundle | null = null;
    let uRectLoc: WebGLUniformLocation | null = null;
    let uUvRectLoc: WebGLUniformLocation | null = null;
    let uWhiteBgLoc: WebGLUniformLocation | null = null;

    if (gl) {
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
         uniform vec4 uUvRect;
         varying vec2 vUv;
         void main() {
           vec2 p = uRect.xy + aPos * uRect.zw;
           gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
           vUv = uUvRect.xy + aPos * uUvRect.zw;
         }`
      );
      const fs = compileShader(
        gl.FRAGMENT_SHADER,
        `precision highp float;
         varying vec2 vUv;
         uniform sampler2D uTex;
         uniform float uWhiteBg;
         void main() {
           vec4 c = texture2D(uTex, vUv);
           if (uWhiteBg > 0.5) {
             gl_FragColor = vec4(c.rgb + (1.0 - c.a), 1.0);
           } else {
             gl_FragColor = c;
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
            uWhiteBgLoc = gl.getUniformLocation(p, "uWhiteBg");
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

    const uploadGpuTexture = (bmp: ImageBitmap): WebGLTexture | null => {
      if (!gl) return null;
      const tex = gl.createTexture();
      if (!tex) return null;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
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

    const updateCanvasSize = () => {
      // Full 3x Super Retina DPR for crisp 1024p WebGL avatar; 2x cap for lightweight 2D overlay
      dpr = Math.min(window.devicePixelRatio || 1, glProg ? 3 : 2);
      dpr2d = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.max(160, stageEl.clientWidth);
      ch = Math.max(200, stageEl.clientHeight);
      glCanvas.width = Math.round(cw * dpr);
      glCanvas.height = Math.round(ch * dpr);
      canvas2d.width = Math.round(cw * dpr2d);
      canvas2d.height = Math.round(ch * dpr2d);
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
    let movedDist = 0;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest("button")) return;
      if (ignoreLeftFraction > 0) {
        const rect = stageEl.getBoundingClientRect();
        const rx = (e.clientX - rect.left) / Math.max(1, rect.width);
        if (rx < ignoreLeftFraction) {
          return;
        }
      }
      pointerDown = true;
      horizontalLocked = e.pointerType !== "touch";
      movedDist = 0;
      startX = e.clientX;
      startY = e.clientY;
      lastMoveX = e.clientX;
      lastMoveTs = performance.now();
      velYawRef.current = 0;
      targetYawRef.current = yawRef.current;
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
        if (movedDist < 5) return;
        if (Math.abs(dy) >= Math.abs(dx) * 0.95) {
          pointerDown = false;
          return;
        }
        horizontalLocked = true;
        lastMoveX = e.clientX;
        lastMoveTs = performance.now();
        try {
          stageEl.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        return;
      }

      const nowTs = performance.now();
      const dtMove = Math.max(6, nowTs - lastMoveTs) / 1000;
      const stepDx = e.clientX - lastMoveX;
      lastMoveX = e.clientX;
      lastMoveTs = nowTs;

      if (movedDist > 4 && autoSpinRef.current) {
        setAutoSpin(false);
      }

      // True 1:1 physical turntable polarity:
      // - Dragging RIGHT-TO-LEFT (stepDx < 0) turns her front to the LEFT (0° -> 90° -> 180° -> 270° -> 360°)!
      // - Dragging LEFT-TO-RIGHT (stepDx > 0) turns her front to the RIGHT (360° -> 270° -> 180° -> 90° -> 0°)!
      const radPerPx = (Math.PI * 2) / Math.max(220, cw * 0.68);
      const deltaYaw = -stepDx * radPerPx;
      if (inertiaSpin) {
        const instV = deltaYaw / dtMove;
        velYawRef.current =
          velYawRef.current * 0.42 + clamp(instV, -14, 14) * 0.58;
      }
      targetYawRef.current += deltaYaw;
      // Zero-lag 1:1 finger lock: update yawRef on the exact input event with 0ms filter delay!
      yawRef.current = targetYawRef.current;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false;
      if (performance.now() - lastMoveTs > 75) {
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
    stageEl.addEventListener("pointermove", onPointerMove, { passive: true });
    stageEl.addEventListener("pointerup", onPointerUp);
    stageEl.addEventListener("pointercancel", onPointerUp);
    stageEl.addEventListener("wheel", onWheel, { passive: false });

    let rafId = 0;
    let lastTime = performance.now();
    let lastFrameIdx = -2;
    let lastZoom = -1;
    let lastCw = -1;
    let lastCh = -1;
    let lastPaintVer = -1;
    let lastVisMode: Render3DVisualMode | "" = "";
    let lastShowRings: boolean | null = null;
    let lastDimsSig = "";
    let lastDomDeg = -1;
    let lastCbDeg = -999;
    let overlayWasDirty = false;

    const renderFrame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoSpinRef.current && !pointerDown) {
        targetYawRef.current += dt * 0.92;
      } else if (
        inertiaSpin &&
        !pointerDown &&
        Math.abs(velYawRef.current) > 0.015
      ) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.2 * dt);
        if (Math.abs(velYawRef.current) <= 0.015) velYawRef.current = 0;
      }

      if (pointerDown && horizontalLocked) {
        yawRef.current = targetYawRef.current;
      } else {
        const yawDamp = 1 - Math.exp(-18 * dt);
        yawRef.current += (targetYawRef.current - yawRef.current) * yawDamp;
      }
      const zoomDamp = 1 - Math.exp(-16 * dt);
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * zoomDamp;

      const normProgress =
        (((yawRef.current / (Math.PI * 2)) % 1) + 1) % 1;

      const activeBundle = bundleRef.current;
      const frames = framesRef.current;
      const hasAtlas = Boolean(activeBundle?.atlasBitmap);
      const totalFrames = hasAtlas
        ? activeBundle?.atlasBitmapB
          ? NUM_TURNTABLE_FRAMES
          : activeBundle?.framesPerSheet || ATLAS_FRAMES_PER_SHEET
        : frames.length;
      const frameIdx =
        totalFrames > 0
          ? Math.floor(normProgress * totalFrames) % totalFrames
          : -1;

      const dims = dimsRef.current;
      const zoom = zoomRef.current;
      const curVisMode = visualModeRef.current;
      const curRings = showRingsRef.current;
      const dimsSig = `${dims.heightInches}:${dims.bustInches}:${dims.waistInches}:${dims.hipsInches}`;

      const deg = Math.round(normProgress * 360) % 360;
      if (deg !== lastDomDeg) {
        lastDomDeg = deg;
        if (degBadgeRef.current) {
          degBadgeRef.current.textContent = `${deg}° 360°`;
        }
        if (Math.abs(deg - lastCbDeg) >= 3 || (deg === 0 && lastCbDeg !== 0)) {
          lastCbDeg = deg;
          onYawChangeRef.current?.(deg);
        }
      }

      // Upload new outfit bundle textures once to GPU VRAM when outfit changes
      if (gl && glProg && activeBundle && activeBundle !== uploadedBundleRef && activeBundle.atlasBitmap) {
        try {
          if (glTexA) gl.deleteTexture(glTexA);
          if (glTexB) gl.deleteTexture(glTexB);
          glTexA = uploadGpuTexture(activeBundle.atlasBitmap);
          glTexB = activeBundle.atlasBitmapB
            ? uploadGpuTexture(activeBundle.atlasBitmapB)
            : null;
          uploadedBundleRef = activeBundle;
          lastFrameIdx = -2;
        } catch {
          // fallback cleanly if bitmap was disposed
        }
      }

      // Dirty-flag idle sleep: 0.00ms GPU/CPU cost when frame index and viewport haven't changed!
      if (
        frameIdx === lastFrameIdx &&
        Math.abs(zoom - lastZoom) < 0.0006 &&
        cw === lastCw &&
        ch === lastCh &&
        paintVersionRef.current === lastPaintVer &&
        curVisMode === lastVisMode &&
        curRings === lastShowRings &&
        dimsSig === lastDimsSig
      ) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      lastFrameIdx = frameIdx;
      lastZoom = zoom;
      lastCw = cw;
      lastCh = ch;
      lastPaintVer = paintVersionRef.current;
      lastVisMode = curVisMode;
      lastShowRings = curRings;
      lastDimsSig = dimsSig;

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

      const maxDrawHByWidth = (cw / 0.58) * (16 / 9);
      const baseDrawH = Math.min(scaleAvailH / 0.79, maxDrawHByWidth);
      const maxDrawHByClearance =
        bottomReservePx > 0 ? (availH * 0.985) / 0.758 : Infinity;
      const drawH = Math.min(baseDrawH * hScale, maxDrawHByClearance) * zoom;
      const drawW = drawH * (9 / 16);
      const scaledW = drawW * bodyWidthScale;
      const centerX = cw * centerXFrac;

      const figSpanH = drawH * 0.758;
      const soleScreenY =
        figSpanH < availH * 0.90
          ? topPad + (availH + figSpanH) * 0.5
          : topPad + availH * 0.978;
      const drawY = soleScreenY - drawH * 0.888;

      const dstW = ATLAS_ROI_W * scaledW;
      const dstH = ATLAS_ROI_H * drawH;
      const dstX = centerX + (ATLAS_ROI_X0 - 0.5) * scaledW;
      const dstY = drawY + ATLAS_ROI_Y0 * drawH;

      let renderedViaWebGL = false;

      // ULTRA-FAST 0.02ms HARDWARE WEBGL DUAL-ATLAS DRAW!
      if (gl && glProg && hasAtlas && glTexA && frameIdx >= 0 && activeBundle) {
        if (posterImgRef.current) {
          posterImgRef.current.style.opacity = "0";
        }
        const cols = activeBundle.cols || ATLAS_COLS;
        const rows = activeBundle.rows || ATLAS_ROWS;
        const perSheet = activeBundle.framesPerSheet || ATLAS_FRAMES_PER_SHEET;
        const cwCell = activeBundle.cellW || 448;
        const chCell = activeBundle.cellH || 1024;
        const useB = frameIdx >= perSheet && Boolean(glTexB);
        const localIdx = useB ? frameIdx - perSheet : frameIdx % perSheet;
        const col = localIdx % cols;
        const row = (localIdx / cols) | 0;

        const sheetW = cols * cwCell;
        const sheetH = rows * chCell;
        const padU = 0.5 / sheetW;
        const padV = 0.5 / sheetH;

        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(glProg);
        gl.bindTexture(gl.TEXTURE_2D, useB ? glTexB : glTexA);
        gl.uniform4f(uRectLoc, dstX / cw, dstY / ch, dstW / cw, dstH / ch);
        gl.uniform4f(
          uUvRectLoc,
          col / cols + padU,
          row / rows + padV,
          1 / cols - 2 * padU,
          1 / rows - 2 * padV
        );
        gl.uniform1f(uWhiteBgLoc, 0.0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        renderedViaWebGL = true;
      } else if (gl && seamlessStage && !hasAtlas) {
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }

      // 2D Canvas path: used ONLY when Heatmap / Scan Rings overlays are active OR as fallback for custom MP4 frames!
      const needsOverlay =
        (curVisMode === "heatmap" && equippedRef.current.length > 0) ||
        curRings ||
        curVisMode === "xray";

      if (ctx2d && (!renderedViaWebGL || needsOverlay || overlayWasDirty)) {
        ctx2d.save();
        ctx2d.scale(dpr2d, dpr2d);
        ctx2d.clearRect(0, 0, cw, ch);

        if (!renderedViaWebGL) {
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
      if (gl) {
        if (glTexA) gl.deleteTexture(glTexA);
        if (glTexB) gl.deleteTexture(glTexB);
        if (glQuadBuf) gl.deleteBuffer(glQuadBuf);
        if (glProg) gl.deleteProgram(glProg);
      }
    };
  }, [
    bottomReservePx,
    centerXFrac,
    compactHud,
    ignoreLeftFraction,
    inertiaSpin,
    mode,
    seamlessStage,
    showHud,
  ]);

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
        seamlessStage ? "bg-transparent" : "gwo-couture-stage-bg"
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
              className="pointer-events-none absolute inset-0 w-full h-full object-contain mix-blend-multiply transition-opacity duration-150"
            />
          )}
          <canvas
            ref={glCanvasRef}
            className="block w-full h-full"
          />
          <canvas
            ref={scrubCanvasRef}
            className="pointer-events-none absolute inset-0 w-full h-full"
          />
        </div>
      ) : (
        <div
          ref={prodWrapRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
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

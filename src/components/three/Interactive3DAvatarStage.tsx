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
} from "@/lib/catalog/fit-intelligence";
import { classifyWearableSlotAndAnchors } from "@/lib/three/avatar-ready-pipeline";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import {
  Character3DRig,
  Wearable3DItemRig,
  loadCharacter3DRig,
  loadStandalone3DItemInstance,
  loadWearable3DItemRig,
  preloadCore3DGlbs,
  syncBodyMorphUniforms,
} from "@/lib/three/glb-character-engine";
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

function createFloorTurntableTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, "rgba(20, 22, 28, 0.16)");
  grad.addColorStop(0.56, "rgba(20, 22, 28, 0.048)");
  grad.addColorStop(1.0, "rgba(20, 22, 28, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.strokeStyle = "rgba(20, 22, 28, 0.11)";
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(0, 0, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r0 = i % 6 === 0 ? S * 0.37 : S * 0.398;
    const r1 = S * 0.432;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

function create3DTapeRing(
  rx: number,
  rz: number,
  y: number,
  hexColor: string
): THREE.Line {
  const segs = 72;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * rx, y, Math.sin(a) * rz));
  }
  const geom = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({
    color: new THREE.Color(hexColor),
    transparent: true,
    opacity: 0.88,
  });
  return new THREE.Line(geom, mat);
}

const LIGHT_MOOD_TINTS: Record<ImmersiveLightingPresetId, string> = {
  editorial_daylight: "#FFFFFF",
  golden_atelier: "#FFF1DF",
  runway_spotlight: "#F8FAFF",
  evening_soiree: "#FFE9CF",
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

function applyCharacter3DOcclusion(
  charRig: Character3DRig,
  rigs: Wearable3DItemRig[]
) {
  const dressRig = rigs.find((r) => r.slot === "dress");
  const bottomRig = rigs.find((r) => r.slot === "bottom");
  const hasShinCoveringPants = Boolean(
    bottomRig &&
      bottomRig.minYn < 0.14 &&
      !bottomRig.product.id.includes("midi") &&
      !bottomRig.product.id.includes("mini") &&
      !bottomRig.product.silhouette.includes("skirt")
  );
  const hasLongSleeves = rigs.some((r) => r.hasLongSleeves);
  const hasShoes = rigs.some((r) => r.slot === "shoes");
  const hasTallBoots = rigs.some((r) => r.isTallBoot);
  charRig.applyOcclusionState({
    hasClothes: rigs.some((r) => r.slot !== "bag"),
    hasBottom: Boolean(bottomRig),
    bottomMinYn: bottomRig ? bottomRig.minYn : 0.45,
    hasDress: Boolean(dressRig),
    dressMinYn: dressRig ? dressRig.minYn : 0.3,
    hasShinCoveringPants,
    hasLongSleeves,
    hasShoes,
    hasTallBoots,
  });
}

/**
 * WATERTIGHT 360° VOLUMETRIC 3D CHARACTER & INDIVIDUAL 3D GARMENT STAGE (`THREE.WebGLRenderer`)
 * - Renders solid, closed 360° 3D body limbs (`HeadAndNeck3D`, `HairCanopy3D`, `TorsoPelvis3D`,
 *   `RightArm3D`, `LeftArm3D`, `RightLeg3D`, `LeftLeg3D`) + independent 3D garment/shoe/belt/bag meshes!
 * - Zero flat 2D planes, zero `cos(θ)` card-squashing, and zero cross-fades — every 3D mesh stays
 *   permanently visible across all `0°..360°` yaw + spherical 3D pitch (`-20°..+26°`) + zoom!
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const onYawChangeRef = useRef(onYawChange);
  onYawChangeRef.current = onYawChange;
  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;
  const onAutoSpinChangeRef = useRef(onAutoSpinChange);
  onAutoSpinChangeRef.current = onAutoSpinChange;

  const yawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const targetYawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const velYawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0.025);
  const targetPitchRef = useRef<number>(0.025);
  const zoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);

  const [internalVisualMode, setInternalVisualMode] =
    useState<Render3DVisualMode>("studio");
  const activeVisualMode = controlledVisualMode ?? internalVisualMode;

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

  const [liveDeg, setLiveDeg] = useState<number>(
    ((Math.round(initialYawDeg) % 360) + 360) % 360
  );
  const [tappedInfo, setTappedInfo] = useState<{
    product: Product;
    fit?: AvatarExactFitReport;
  } | null>(null);
  const [isLoading3D, setIsLoading3D] = useState<boolean>(false);

  const threeCtxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    stageRoot: THREE.Group;
    avatarTurntable: THREE.Group;
    charGroup: THREE.Group;
    equippedGroup: THREE.Group;
    productTurntable: THREE.Group;
    ringsGroup: THREE.Group;
    faceDecalGroup: THREE.Group;
    shadowPlane: THREE.Mesh;
    charRig: Character3DRig | null;
    itemRigs: Wearable3DItemRig[];
  } | null>(null);

  const equipReqIdRef = useRef<number>(0);

  const setVisualMode = useCallback(
    (m: Render3DVisualMode) => {
      setInternalVisualMode(m);
      onVisualModeChange?.(m);
    },
    [onVisualModeChange]
  );

  useEffect(() => {
    preloadCore3DGlbs();
  }, []);

  useEffect(() => {
    if (typeof externalYawDeg === "number") {
      setAutoSpin(false);
      velYawRef.current = 0;
      const desiredRad = (externalYawDeg * Math.PI) / 180;
      targetYawRef.current =
        yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
    }
  }, [externalYawDeg, externalYawSeq, setAutoSpin]);

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

    // Ensure complete, tasteful 3D boutique styling when inspecting a single separate/bag/blazer on PDP!
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

  const equippedSignature = useMemo(
    () =>
      mode === "product"
        ? `product:${singleProduct?.id || wornPieces[0]?.product.id || "none"}:${
            singleProduct?.imageUrl || ""
          }`
        : `avatar:${effectiveEquippedProducts
            .map((p) => `${p.id}:${p.imageUrl || ""}`)
            .join("|")}`,
    [effectiveEquippedProducts, mode, singleProduct, wornPieces]
  );

  // 1. Mount WebGL Three.js Renderer & Watertight 360° Volumetric 3D Turntable!
  useEffect(() => {
    const wrapEl = wrapRef.current;
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

    const stageRoot = new THREE.Group();
    scene.add(stageRoot);

    const shadowTex = createFloorTurntableTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.76, 0.76),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.002;
    shadowPlane.renderOrder = 1;
    stageRoot.add(shadowPlane);

    const avatarTurntable = new THREE.Group();
    const charGroup = new THREE.Group();
    const equippedGroup = new THREE.Group();
    const productTurntable = new THREE.Group();
    const ringsGroup = new THREE.Group();
    const faceDecalGroup = new THREE.Group();

    avatarTurntable.add(charGroup);
    avatarTurntable.add(equippedGroup);
    avatarTurntable.add(faceDecalGroup);
    avatarTurntable.add(ringsGroup);

    stageRoot.add(avatarTurntable);
    stageRoot.add(productTurntable);

    threeCtxRef.current = {
      renderer,
      scene,
      camera,
      stageRoot,
      avatarTurntable,
      charGroup,
      equippedGroup,
      productTurntable,
      ringsGroup,
      faceDecalGroup,
      shadowPlane,
      charRig: null,
      itemRigs: [],
    };

    let disposed = false;
    void loadCharacter3DRig().then((charRig) => {
      if (disposed || !threeCtxRef.current) return;
      const cRef = threeCtxRef.current;
      cRef.charRig = charRig;
      charGroup.add(charRig.rootGroup);

      const tintHex = LIGHT_MOOD_TINTS[lightingPresetId];
      for (const u of charRig.uniformsList) {
        u.uLightMoodTint.value.set(tintHex);
        syncBodyMorphUniforms(u, safeDimensions, activeVisualMode, false, false);
      }
      applyCharacter3DOcclusion(charRig, cRef.itemRigs);
    });

    const updateLayout = () => {
      const w = Math.max(120, wrapEl.clientWidth);
      const h = Math.max(140, wrapEl.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    updateLayout();
    const ro = new ResizeObserver(updateLayout);
    ro.observe(wrapEl);

    const dom = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
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
      dom.setPointerCapture(e.pointerId);
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
        const instV = (stepDx * 0.016) / dtMove;
        velYawRef.current =
          velYawRef.current * 0.55 + clamp(instV, -10, 10) * 0.45;
      }
      targetYawRef.current = startYaw + dx * 0.016;
      targetPitchRef.current = clamp(startPitch + dy * 0.0052, -0.35, 0.46);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (performance.now() - lastMoveTs > 90) {
        velYawRef.current = 0;
      }
      try {
        dom.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      const cRef = threeCtxRef.current;
      if (movedDist < 6 && cRef && !productTurntable.visible) {
        const rect = dom.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);

        const hits = raycaster.intersectObjects(equippedGroup.children, true);
        const hitProd = hits.find((h) => h.object.userData?.product)?.object
          .userData?.product as Product | undefined;
        if (hitProd) {
          const fit = fitByProductIdRef.current.get(hitProd.id);
          setTappedInfo({ product: hitProd, fit });
          onSelectProductRef.current?.(hitProd, fit);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0 && (window.innerWidth > 820 || e.ctrlKey)) {
        e.preventDefault();
        targetZoomRef.current = clamp(
          targetZoomRef.current - Math.sign(e.deltaY) * 0.08,
          0.76,
          1.62
        );
      }
    };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });

    let rafId = 0;
    let lastTime = performance.now();
    let frameTick = 0;

    const animate = (now: number) => {
      if (disposed) return;
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoSpinRef.current && !dragging) {
        targetYawRef.current += dt * 0.85;
      } else if (
        inertiaSpin &&
        !dragging &&
        Math.abs(velYawRef.current) > 0.02
      ) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.4 * dt);
        if (Math.abs(velYawRef.current) <= 0.02) velYawRef.current = 0;
      }

      const damp = 1 - Math.exp(-13 * dt);
      yawRef.current += (targetYawRef.current - yawRef.current) * damp;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * damp;
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * damp;

      const breath = 1.0 + Math.sin(now * 0.0021) * 0.002;
      const pitch = pitchRef.current;

      const isProdMode = productTurntable.visible;
      if (isProdMode) {
        productTurntable.rotation.y = yawRef.current;
        shadowPlane.rotation.z = -yawRef.current;
        const dist = 1.52 / zoomRef.current;
        const lookY = 0.42;
        camera.position.set(
          0,
          lookY + Math.sin(pitch) * dist,
          Math.cos(pitch) * dist
        );
        camera.lookAt(0, lookY, 0);
        shadowPlane.position.y = 0.04;
        shadowPlane.scale.setScalar(0.68);
      } else {
        // SOLID 360° 3D TURNTABLE ROTATION + SPHERICAL 3D CAMERA PITCH ORBIT!
        avatarTurntable.rotation.y = yawRef.current;
        avatarTurntable.scale.y = breath;
        shadowPlane.rotation.z = -yawRef.current;
        shadowPlane.position.y = 0.002;
        shadowPlane.scale.setScalar(0.96);

        const cRef = threeCtxRef.current;
        if (cRef) {
          const cosFront = Math.cos(yawRef.current);
          cRef.faceDecalGroup.visible =
            Boolean(faceOvalDataUrl) && cosFront > 0.45;

          const hScale =
            cRef.charRig?.uniformsList[0]?.uHeightScale.value ?? 1.0;
          const charTop = 1.58 * hScale;
          const isNarrowMobile = dom.clientWidth < 460;
          const hudPadFactor = showHud
            ? isNarrowMobile
              ? 1.48
              : dom.clientHeight < 440 || camera.aspect < 0.85
              ? 1.28
              : compactHud
              ? 1.12
              : 1.14
            : 1.015;
          const halfFovRad = (camera.fov * Math.PI) / 360;
          const reqDistH =
            (charTop * hudPadFactor * 0.5) / Math.tan(halfFovRad);
          const reqDistW =
            (0.285 / Math.max(0.32, camera.aspect)) / Math.tan(halfFovRad);
          const dist = Math.max(reqDistH, reqDistW) / zoomRef.current;
          const lookY = charTop * (showHud ? (isNarrowMobile ? 0.435 : 0.488) : 0.5);
          camera.position.set(
            0,
            lookY + Math.sin(pitch) * dist,
            Math.cos(pitch) * dist
          );
          camera.lookAt(0, lookY, 0);
        }
      }

      frameTick++;
      if (frameTick % 4 === 0) {
        const deg =
          ((Math.round((yawRef.current * 180) / Math.PI) % 360) + 360) % 360;
        setLiveDeg(deg);
        onYawChangeRef.current?.(deg);
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      threeCtxRef.current?.itemRigs.forEach((r) => r.dispose());
      shadowTex.dispose();
      renderer.dispose();
      threeCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactHud, inertiaSpin, seamlessStage, showHud]);

  // 2. Equip / Swap Individual Watertight 3D Garment & 3D Purse Meshes Atomically!
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;

    const reqId = ++equipReqIdRef.current;

    if (mode === "product") {
      ctx.avatarTurntable.visible = false;
      ctx.productTurntable.visible = true;

      const prod = singleProduct || wornPieces[0]?.product;
      if (!prod) {
        ctx.productTurntable.clear();
        return;
      }

      setIsLoading3D(true);
      void loadStandalone3DItemInstance(prod)
        .then((itemSculpture) => {
          if (equipReqIdRef.current !== reqId) return;
          const holder = new THREE.Group();
          holder.position.y = 0.42;
          holder.add(itemSculpture);
          ctx.productTurntable.clear();
          ctx.productTurntable.add(holder);
          setIsLoading3D(false);
        })
        .catch(() => {
          if (equipReqIdRef.current === reqId) setIsLoading3D(false);
        });
      return;
    }

    ctx.productTurntable.visible = false;
    ctx.avatarTurntable.visible = true;

    const tintHex = LIGHT_MOOD_TINTS[lightingPresetId];

    if (effectiveEquippedProducts.length === 0) {
      ctx.equippedGroup.clear();
      ctx.itemRigs.forEach((r) => r.dispose());
      ctx.itemRigs = [];
      if (ctx.charRig) {
        applyCharacter3DOcclusion(ctx.charRig, []);
      }
      setIsLoading3D(false);
      return;
    }

    const loadTimer = setTimeout(() => {
      if (equipReqIdRef.current === reqId) setIsLoading3D(true);
    }, 140);

    // Pre-detect full-length pants so boots/shoes pick their under-trouser vs full-shaft 3D variant!
    const bottomCandidate = effectiveEquippedProducts.find(
      (p) => classifyWearableSlotAndAnchors(p).slot === "bottom"
    );
    const preHasLongPants = Boolean(
      bottomCandidate &&
        !bottomCandidate.id.includes("mini") &&
        !bottomCandidate.id.includes("midi") &&
        !bottomCandidate.id.includes("shorts") &&
        !bottomCandidate.silhouette.includes("skirt")
    );

    void Promise.all(
      effectiveEquippedProducts.map((p) =>
        loadWearable3DItemRig(p, preHasLongPants)
      )
    )
      .then((newRigs) => {
        clearTimeout(loadTimer);
        if (equipReqIdRef.current !== reqId) {
          newRigs.forEach((r) => r.dispose());
          return;
        }

        const prevRigs = ctx.itemRigs;
        ctx.equippedGroup.clear();
        ctx.itemRigs = newRigs;

        for (const rig of newRigs) {
          const fit = fitByProductIdRef.current.get(rig.product.id);
          for (const u of rig.uniformsList) {
            u.uLightMoodTint.value.set(tintHex);
            syncBodyMorphUniforms(
              u,
              safeDimensions,
              activeVisualMode,
              true,
              rig.isRigidBag,
              fit,
              rig.fabric
            );
          }
          ctx.equippedGroup.add(rig.group);
        }

        if (ctx.charRig) {
          applyCharacter3DOcclusion(ctx.charRig, newRigs);
        }
        prevRigs.forEach((r) => r.dispose());
        setIsLoading3D(false);
      })
      .catch(() => {
        clearTimeout(loadTimer);
        if (equipReqIdRef.current === reqId) setIsLoading3D(false);
      });

    return () => {
      clearTimeout(loadTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equippedSignature, mode]);

  // 2b. Live Boutique Lighting Mood Tint
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    const tintHex = LIGHT_MOOD_TINTS[lightingPresetId];
    if (ctx.charRig) {
      for (const u of ctx.charRig.uniformsList) {
        u.uLightMoodTint.value.set(tintHex);
      }
    }
    for (const rig of ctx.itemRigs) {
      for (const u of rig.uniformsList) {
        u.uLightMoodTint.value.set(tintHex);
      }
    }
  }, [lightingPresetId]);

  // 3. Sync Real-Time GPU Body-Scan Inch Morphing, Physical Fabric Ease, Fit Heatmap & 3D Tape Rings!
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;

    if (ctx.charRig) {
      for (const u of ctx.charRig.uniformsList) {
        syncBodyMorphUniforms(u, safeDimensions, activeVisualMode, false, false);
      }
    }

    for (const rig of ctx.itemRigs) {
      const fit = fitByProductId.get(rig.product.id);
      for (const u of rig.uniformsList) {
        syncBodyMorphUniforms(
          u,
          safeDimensions,
          activeVisualMode,
          true,
          rig.isRigidBag,
          fit,
          rig.fabric
        );
      }
    }

    ctx.ringsGroup.clear();
    const show3DRings =
      mode === "avatar" && (effectiveShowRings || activeVisualMode === "xray");
    ctx.ringsGroup.visible = show3DRings;
    if (show3DRings) {
      const hs = clamp(safeDimensions.heightInches / 62.0, 0.92, 1.15);
      const by = clamp(safeDimensions.bustInches / 32.25, 0.88, 1.28);
      const bz = clamp(safeDimensions.waistInches / 27.0, 0.82, 1.28);
      const bw = clamp(safeDimensions.hipsInches / 34.0, 0.88, 1.3);
      ctx.ringsGroup.add(
        create3DTapeRing(0.126 * by, 0.098 * by, 1.14 * hs, "#10B981")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.116 * bz, 0.088 * bz, 0.98 * hs, "#244B3B")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.146 * bw, 0.104 * bw, 0.81 * hs, "#0EA5E9")
      );
    }
  }, [
    activeVisualMode,
    effectiveShowRings,
    fitByProductId,
    mode,
    safeDimensions,
  ]);

  // 4. Optional Scanned Customer Face 3D Decal Projection
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    ctx.faceDecalGroup.clear();
    if (!faceOvalDataUrl || mode !== "avatar") return;

    const tex = new THREE.TextureLoader().load(faceOvalDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.105, 0.125, 12, 12),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      })
    );
    plane.renderOrder = 80;
    const hs = clamp(safeDimensions.heightInches / 62.0, 0.92, 1.15);
    const chinM = 1.58 * 0.848;
    plane.position.set(0, chinM * hs + (1.43 - chinM), 0.116);
    ctx.faceDecalGroup.add(plane);
  }, [faceOvalDataUrl, mode, safeDimensions.heightInches]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    const desiredRad = (deg * Math.PI) / 180;
    targetYawRef.current =
      yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
    targetPitchRef.current = 0.025;
  };

  return (
    <div
      data-3d-engine="webgl-glb-character"
      data-3d-topology="watertight-volumetric-3d"
      data-realism-spec={MASTER_REALISM_SPEC_VERSION}
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : userSelectedProducts.length}
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
    >
      <div
        ref={wrapRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {isLoading3D && (
        <div className="pointer-events-none absolute top-11 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full bg-white/95 border border-black/[0.08] shadow-xs text-[10px] font-bold text-[#244B3B] inline-flex items-center gap-1">
          <Box className="w-3 h-3 animate-pulse" /> Equipping 3D Item…
        </div>
      )}

      {showHud && mode === "avatar" && !compactHud && (
        <div className="pointer-events-none hidden sm:flex absolute top-2.5 left-2.5 z-10 flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1">
            <Ruler className="w-3 h-3 text-[#244B3B]" />
            360° 3D Twin • {formatHeightFeetInches(safeDimensions.heightInches)} •{" "}
            {safeDimensions.bustInches}&quot; B • {safeDimensions.waistInches}&quot; W •{" "}
            {safeDimensions.hipsInches}&quot; H
          </span>
          <span className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold">
            {liveDeg}° 3D
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
            <Sparkles className="w-2.5 h-2.5" /> 3D Studio
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
                title="Highlight exact garment fit zones across 3D meshes"
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
                title="Show 3D Bust / Waist / Hip measurement rings"
              >
                <Eye className="w-2.5 h-2.5 text-[#0EA5E9]" /> 3D Rings
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
                3D Item • Size {tappedInfo.fit.recommendedSize} •{" "}
                {tappedInfo.fit.confidencePct}% Fit
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
                [35, "3/4 35°"],
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
                title="Show 3D Bust / Waist / Hip body-scan rings"
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
                      1.62,
                      targetZoomRef.current + 0.14
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
                      0.76,
                      targetZoomRef.current - 0.14
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
                    targetPitchRef.current = 0.025;
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

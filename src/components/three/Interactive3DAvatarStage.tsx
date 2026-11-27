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
import { MOD_BOT_SLUG } from "@/lib/three/modular-outfit-compositor";
import {
  Character3DRig,
  SideOutfit3DRig,
  Wearable3DItemRig,
  loadCharacter3DRig,
  loadMatchedSideOutfit3DRig,
  loadStandalone3DItemInstance,
  loadWearable3DItemRig,
  preloadCore3DGlbs,
  sampleMeshAlphaAtUv,
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

function angDistRad(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
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
  grad.addColorStop(0.0, "rgba(20, 22, 28, 0.17)");
  grad.addColorStop(0.56, "rgba(20, 22, 28, 0.05)");
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

/**
 * ORTHOGONAL 4-QUADRANT TRUE-3D INTERACTIVE CHARACTER & GARMENT TURNTABLE (`THREE.WebGLRenderer`)
 * - Rotates `avatarTurntable.rotation.y = yawRef.current` continuously at true 1:1 3D angular velocity
 *   around the Y-axis (`0° -> 90° -> 180° -> 270° -> 360°`) + vertical 3D pitch + wheel/pinch zoom!
 * - Zero 2D card rock-and-snap; every garment mounts as its own physical 3D depth shell (`+5mm..+54mm`).
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
  const pitchRef = useRef<number>(0.015);
  const targetPitchRef = useRef<number>(0.015);
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
    equippedFrontGroup: THREE.Group;
    equippedBackGroup: THREE.Group;
    sideOutfitGroup: THREE.Group;
    productTurntable: THREE.Group;
    ringsGroup: THREE.Group;
    faceDecalGroup: THREE.Group;
    shadowPlane: THREE.Mesh;
    charRig: Character3DRig | null;
    sideOutfitRig: SideOutfit3DRig | null;
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
  }, [mode, safeDimensions, selectedSize, singleProduct, wornPieces]);

  const fitByProductIdRef = useRef(fitByProductId);
  fitByProductIdRef.current = fitByProductId;

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

  const slotEquippedProducts = useMemo(() => {
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
    return Array.from(chosen.values());
  }, [wornPieces]);

  const equippedSignature = useMemo(
    () =>
      mode === "product"
        ? `product:${singleProduct?.id || wornPieces[0]?.product.id || "none"}:${
            singleProduct?.imageUrl || ""
          }`
        : `avatar:${slotEquippedProducts
            .map((p) => `${p.id}:${p.imageUrl || ""}`)
            .join("|")}`,
    [mode, singleProduct, slotEquippedProducts, wornPieces]
  );

  // 1. Mount WebGL Three.js Renderer & True 360° Orthogonal 3D Turntable!
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
    const equippedFrontGroup = new THREE.Group();
    const equippedBackGroup = new THREE.Group();
    const sideOutfitGroup = new THREE.Group();
    const productTurntable = new THREE.Group();
    const ringsGroup = new THREE.Group();
    const faceDecalGroup = new THREE.Group();

    avatarTurntable.add(charGroup);
    avatarTurntable.add(equippedFrontGroup);
    avatarTurntable.add(equippedBackGroup);
    avatarTurntable.add(sideOutfitGroup);
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
      equippedFrontGroup,
      equippedBackGroup,
      sideOutfitGroup,
      productTurntable,
      ringsGroup,
      faceDecalGroup,
      shadowPlane,
      charRig: null,
      sideOutfitRig: null,
      itemRigs: [],
    };

    let disposed = false;
    void loadCharacter3DRig().then((charRig) => {
      if (disposed || !threeCtxRef.current) return;
      threeCtxRef.current.charRig = charRig;
      charGroup.add(
        charRig.frontMesh,
        charRig.rightSideMesh,
        charRig.backMesh,
        charRig.leftSideMesh
      );

      const rigs = threeCtxRef.current.itemRigs;
      const hasShoes = rigs.some((r) => r.slot === "shoes");
      const hasDress = rigs.some((r) => r.slot === "dress");
      const hasBottom = rigs.some((r) => r.slot === "bottom");
      const hasTop = rigs.some((r) => r.slot === "top");
      const hasShinPants =
        !hasDress &&
        rigs.some(
          (r) =>
            Boolean(MOD_BOT_SLUG[r.product.id]?.coversShins) ||
            (r.slot === "bottom" && r.product.silhouette !== "mini-skirt")
        );
      const heelMaskVal = hasShoes ? (hasShinPants ? 2.0 : 1.0) : 0.0;
      charRig.frontUniforms.uMaskBaseHeels.value = heelMaskVal;
      charRig.backUniforms.uMaskBaseHeels.value = heelMaskVal;
      charRig.frontUniforms.uMaskDressUpper.value = hasDress ? 1.0 : 0.0;
      charRig.backUniforms.uMaskDressUpper.value = hasDress ? 1.0 : 0.0;
      charRig.frontUniforms.uHasBottom.value = hasBottom ? 1.0 : 0.0;
      charRig.backUniforms.uHasBottom.value = hasBottom ? 1.0 : 0.0;
      charRig.frontUniforms.uHasTop.value = hasTop ? 1.0 : 0.0;
      charRig.backUniforms.uHasTop.value = hasTop ? 1.0 : 0.0;
      for (const u of [
        charRig.frontUniforms,
        charRig.rightSideUniforms,
        charRig.backUniforms,
        charRig.leftSideUniforms,
      ]) {
        syncBodyMorphUniforms(u, safeDimensions, activeVisualMode, false, false);
      }
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
      targetPitchRef.current = clamp(startPitch + dy * 0.0042, -0.24, 0.28);
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

      if (movedDist < 6 && !productTurntable.visible) {
        const normRad =
          ((yawRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const isBack = angDistRad(normRad, Math.PI) < Math.PI * 0.5;
        const activeGroup = isBack ? equippedBackGroup : equippedFrontGroup;
        if (activeGroup.children.length > 0) {
          const rect = dom.getBoundingClientRect();
          ndc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
          ndc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
          raycaster.setFromCamera(ndc, camera);
          const hits = raycaster.intersectObjects(activeGroup.children, true);
          hits.sort(
            (a, b) => (b.object.renderOrder || 0) - (a.object.renderOrder || 0)
          );
          const hitMesh = hits.find(
            (h) =>
              h.object.userData?.product &&
              sampleMeshAlphaAtUv(h.object, h.uv) > 65
          );
          if (hitMesh) {
            const prod = hitMesh.object.userData.product as Product;
            const fit = fitByProductIdRef.current.get(prod.id);
            setTappedInfo({ product: prod, fit });
            onSelectProductRef.current?.(prod, fit);
          }
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

      const breath = 1.0 + Math.sin(now * 0.0021) * 0.0022;
      stageRoot.rotation.x = pitchRef.current;

      const isProdMode = productTurntable.visible;
      if (isProdMode) {
        productTurntable.rotation.y = yawRef.current;
        shadowPlane.rotation.z = -yawRef.current;
        const dist = 1.52 / zoomRef.current;
        camera.position.set(0, 0.42, dist);
        camera.lookAt(0, 0.42, 0);
        shadowPlane.position.y = 0.04;
        shadowPlane.scale.setScalar(0.68);
      } else {
        // TRUE 1:1 360° 3D TURNTABLE ROTATION (`avatarTurntable.rotation.y = yawRef.current`)!
        avatarTurntable.rotation.y = yawRef.current;
        avatarTurntable.scale.y = breath;
        shadowPlane.rotation.z = -yawRef.current;
        shadowPlane.position.y = 0.002;
        shadowPlane.scale.setScalar(0.96);

        const normRad =
          ((yawRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const dFront = (angDistRad(normRad, 0) * 180) / Math.PI;
        const dRight = (angDistRad(normRad, Math.PI * 0.5) * 180) / Math.PI;
        const dBack = (angDistRad(normRad, Math.PI) * 180) / Math.PI;
        const dLeft = (angDistRad(normRad, Math.PI * 1.5) * 180) / Math.PI;

        // Orthogonal 3D Quadrant Visibility Weights (each shell is ALREADY rotating in 3D inside avatarTurntable!)
        let wFront = 0;
        let wRight = 0;
        let wBack = 0;
        let wLeft = 0;

        if (dFront <= 58) {
          wFront = 1.0;
        } else if (dFront < 74) {
          const t = (74 - dFront) / 16;
          wFront = Math.sqrt(t);
          if (dRight < dLeft) wRight = Math.sqrt(1 - t);
          else wLeft = Math.sqrt(1 - t);
        } else if (dRight <= 16) {
          wRight = 1.0;
        } else if (dLeft <= 16) {
          wLeft = 1.0;
        } else if (dBack < 74 && dBack > 58) {
          const t = (74 - dBack) / 16;
          wBack = Math.sqrt(t);
          if (dRight < dLeft) wRight = Math.sqrt(1 - t);
          else wLeft = Math.sqrt(1 - t);
        } else {
          wBack = 1.0;
        }

        const cRef = threeCtxRef.current;
        if (cRef) {
          const hasWorn = cRef.itemRigs.length > 0;
          if (cRef.charRig) {
            cRef.charRig.frontMesh.visible = wFront > 0.01;
            cRef.charRig.frontUniforms.uViewOpacity.value = wFront;
            cRef.charRig.frontUniforms.uYawAngle.value = normRad;

            cRef.charRig.backMesh.visible = wBack > 0.01;
            cRef.charRig.backUniforms.uViewOpacity.value = wBack;
            cRef.charRig.backUniforms.uYawAngle.value = normRad;

            cRef.charRig.rightSideMesh.visible = !hasWorn && wRight > 0.01;
            cRef.charRig.rightSideUniforms.uViewOpacity.value = wRight;
            cRef.charRig.rightSideUniforms.uYawAngle.value = normRad;

            cRef.charRig.leftSideMesh.visible = !hasWorn && wLeft > 0.01;
            cRef.charRig.leftSideUniforms.uViewOpacity.value = wLeft;
            cRef.charRig.leftSideUniforms.uYawAngle.value = normRad;
          }

          cRef.equippedFrontGroup.visible = wFront > 0.01;
          cRef.equippedBackGroup.visible = wBack > 0.01;
          cRef.faceDecalGroup.visible = Boolean(faceOvalDataUrl) && wFront > 0.25;

          cRef.sideOutfitGroup.visible =
            hasWorn && (wRight > 0.01 || wLeft > 0.01);
          if (cRef.sideOutfitRig) {
            cRef.sideOutfitRig.rightMesh.visible = hasWorn && wRight > 0.01;
            cRef.sideOutfitRig.rightUniforms.uViewOpacity.value = wRight;
            cRef.sideOutfitRig.rightUniforms.uYawAngle.value = normRad;

            cRef.sideOutfitRig.leftMesh.visible = hasWorn && wLeft > 0.01;
            cRef.sideOutfitRig.leftUniforms.uViewOpacity.value = wLeft;
            cRef.sideOutfitRig.leftUniforms.uYawAngle.value = normRad;
          }

          for (const rig of cRef.itemRigs) {
            rig.frontUniforms.uViewOpacity.value = wFront;
            rig.frontUniforms.uYawAngle.value = normRad;
            rig.backUniforms.uViewOpacity.value = wBack;
            rig.backUniforms.uYawAngle.value = normRad;
          }

          const hScale = cRef.charRig?.frontUniforms.uHeightScale.value ?? 1.0;
          const charTop = 1.58 * hScale;
          const hudPadFactor = showHud ? (compactHud ? 1.11 : 1.13) : 1.015;
          const halfFovRad = (camera.fov * Math.PI) / 360;
          const reqDistH =
            (charTop * hudPadFactor * 0.5) / Math.tan(halfFovRad);
          const reqDistW =
            (0.28 / Math.max(0.32, camera.aspect)) / Math.tan(halfFovRad);
          const dist = Math.max(reqDistH, reqDistW) / zoomRef.current;
          const lookY = charTop * (showHud ? 0.488 : 0.5);
          camera.position.set(0, lookY + 0.02, dist);
          camera.lookAt(0, lookY, 0);
        }
      }

      frameTick++;
      if (frameTick % 4 === 0) {
        const deg =
          (((Math.round((yawRef.current * 180) / Math.PI) % 360) + 360) % 360);
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
      shadowTex.dispose();
      renderer.dispose();
      threeCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactHud, inertiaSpin, seamlessStage, showHud]);

  // 2. Equip / Swap Individual 3D Garment Meshes Atomically onto the 3D Turntable!
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

    if (slotEquippedProducts.length === 0) {
      ctx.equippedFrontGroup.clear();
      ctx.equippedBackGroup.clear();
      ctx.sideOutfitGroup.clear();
      ctx.sideOutfitRig = null;
      ctx.itemRigs = [];
      if (ctx.charRig) {
        ctx.charRig.frontUniforms.uMaskBaseHeels.value = 0.0;
        ctx.charRig.backUniforms.uMaskBaseHeels.value = 0.0;
        ctx.charRig.frontUniforms.uMaskDressUpper.value = 0.0;
        ctx.charRig.backUniforms.uMaskDressUpper.value = 0.0;
        ctx.charRig.frontUniforms.uHasBottom.value = 0.0;
        ctx.charRig.backUniforms.uHasBottom.value = 0.0;
        ctx.charRig.frontUniforms.uHasTop.value = 0.0;
        ctx.charRig.backUniforms.uHasTop.value = 0.0;
      }
      setIsLoading3D(false);
      return;
    }

    const loadTimer = setTimeout(() => {
      if (equipReqIdRef.current === reqId) setIsLoading3D(true);
    }, 140);

    const hasDress = slotEquippedProducts.some(
      (p) => classifyWearableSlotAndAnchors(p).slot === "dress"
    );
    const hasShinCoveringPants =
      !hasDress &&
      slotEquippedProducts.some(
        (p) =>
          Boolean(MOD_BOT_SLUG[p.id]?.coversShins) ||
          (classifyWearableSlotAndAnchors(p).slot === "bottom" &&
            p.silhouette !== "mini-skirt")
      );

    const tintHex = LIGHT_MOOD_TINTS[lightingPresetId];
    const itemPromises = slotEquippedProducts.map(async (prod) => {
      const rig = await loadWearable3DItemRig(prod, hasShinCoveringPants);
      const fit = fitByProductIdRef.current.get(prod.id);
      rig.frontUniforms.uLightMoodTint.value.set(tintHex);
      rig.backUniforms.uLightMoodTint.value.set(tintHex);
      syncBodyMorphUniforms(
        rig.frontUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        rig.isRigidBag,
        fit,
        rig.fabric
      );
      syncBodyMorphUniforms(
        rig.backUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        rig.isRigidBag,
        fit,
        rig.fabric
      );
      return rig;
    });

    const sidePromise = loadMatchedSideOutfit3DRig(slotEquippedProducts);

    void Promise.all([Promise.all(itemPromises), sidePromise])
      .then(([loadedRigs, sideRig]) => {
        clearTimeout(loadTimer);
        if (equipReqIdRef.current !== reqId) return;

        ctx.equippedFrontGroup.clear();
        ctx.equippedBackGroup.clear();
        ctx.sideOutfitGroup.clear();

        for (const rig of loadedRigs) {
          ctx.equippedFrontGroup.add(rig.frontMesh);
          ctx.equippedBackGroup.add(rig.backMesh);
        }

        sideRig.rightUniforms.uLightMoodTint.value.set(tintHex);
        sideRig.leftUniforms.uLightMoodTint.value.set(tintHex);
        syncBodyMorphUniforms(
          sideRig.rightUniforms,
          safeDimensions,
          activeVisualMode,
          true,
          false
        );
        syncBodyMorphUniforms(
          sideRig.leftUniforms,
          safeDimensions,
          activeVisualMode,
          true,
          false
        );
        ctx.sideOutfitGroup.add(sideRig.rightMesh, sideRig.leftMesh);
        ctx.sideOutfitRig = sideRig;
        ctx.itemRigs = loadedRigs;

        const hasShoes = loadedRigs.some((r) => r.slot === "shoes");
        const hasBottom = loadedRigs.some((r) => r.slot === "bottom");
        const hasTop = loadedRigs.some((r) => r.slot === "top");
        const heelMaskVal = hasShoes
          ? hasShinCoveringPants
            ? 2.0
            : 1.0
          : 0.0;
        if (ctx.charRig) {
          ctx.charRig.frontUniforms.uMaskBaseHeels.value = heelMaskVal;
          ctx.charRig.backUniforms.uMaskBaseHeels.value = heelMaskVal;
          ctx.charRig.frontUniforms.uMaskDressUpper.value = hasDress ? 1.0 : 0.0;
          ctx.charRig.backUniforms.uMaskDressUpper.value = hasDress ? 1.0 : 0.0;
          ctx.charRig.frontUniforms.uHasBottom.value = hasBottom ? 1.0 : 0.0;
          ctx.charRig.backUniforms.uHasBottom.value = hasBottom ? 1.0 : 0.0;
          ctx.charRig.frontUniforms.uHasTop.value = hasTop ? 1.0 : 0.0;
          ctx.charRig.backUniforms.uHasTop.value = hasTop ? 1.0 : 0.0;
        }
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
      ctx.charRig.frontUniforms.uLightMoodTint.value.set(tintHex);
      ctx.charRig.rightSideUniforms.uLightMoodTint.value.set(tintHex);
      ctx.charRig.backUniforms.uLightMoodTint.value.set(tintHex);
      ctx.charRig.leftSideUniforms.uLightMoodTint.value.set(tintHex);
    }
    if (ctx.sideOutfitRig) {
      ctx.sideOutfitRig.rightUniforms.uLightMoodTint.value.set(tintHex);
      ctx.sideOutfitRig.leftUniforms.uLightMoodTint.value.set(tintHex);
    }
    for (const rig of ctx.itemRigs) {
      rig.frontUniforms.uLightMoodTint.value.set(tintHex);
      rig.backUniforms.uLightMoodTint.value.set(tintHex);
    }
  }, [lightingPresetId]);

  // 3. Sync Real-Time GPU Body-Scan Inch Morphing, Physical Fabric Ease, Fit Heatmap & 3D Tape Rings!
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;

    if (ctx.charRig) {
      for (const u of [
        ctx.charRig.frontUniforms,
        ctx.charRig.rightSideUniforms,
        ctx.charRig.backUniforms,
        ctx.charRig.leftSideUniforms,
      ]) {
        syncBodyMorphUniforms(u, safeDimensions, activeVisualMode, false, false);
      }
    }
    if (ctx.sideOutfitRig) {
      syncBodyMorphUniforms(
        ctx.sideOutfitRig.rightUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        false
      );
      syncBodyMorphUniforms(
        ctx.sideOutfitRig.leftUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        false
      );
    }
    for (const rig of ctx.itemRigs) {
      const fit = fitByProductId.get(rig.product.id);
      syncBodyMorphUniforms(
        rig.frontUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        rig.isRigidBag,
        fit,
        rig.fabric
      );
      syncBodyMorphUniforms(
        rig.backUniforms,
        safeDimensions,
        activeVisualMode,
        true,
        rig.isRigidBag,
        fit,
        rig.fabric
      );
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
        create3DTapeRing(0.118 * by, 0.092 * by, 1.14 * hs, "#10B981")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.098 * bz, 0.076 * bz, 0.98 * hs, "#244B3B")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.128 * bw, 0.098 * bw, 0.81 * hs, "#0EA5E9")
      );
    }
  }, [activeVisualMode, effectiveShowRings, fitByProductId, mode, safeDimensions]);

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
    plane.position.set(0, chinM * hs + (1.43 - chinM), 0.075);
    ctx.faceDecalGroup.add(plane);
  }, [faceOvalDataUrl, mode, safeDimensions.heightInches]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    const desiredRad = (deg * Math.PI) / 180;
    targetYawRef.current =
      yawRef.current + shortestAngleDeltaRad(yawRef.current, desiredRad);
    targetPitchRef.current = 0.015;
  };

  return (
    <div
      data-3d-engine="webgl-glb-character"
      data-3d-topology="orthogonal-360-turntable"
      data-realism-spec={MASTER_REALISM_SPEC_VERSION}
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : slotEquippedProducts.length}
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
                    targetPitchRef.current = 0.015;
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

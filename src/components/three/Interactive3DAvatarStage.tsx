"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Box,
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
} from "@/lib/catalog/fit-intelligence";
import { classifyWearableSlotAndAnchors } from "@/lib/three/avatar-ready-pipeline";
import {
  BodyMorphUniforms,
  createBodyMorphUniforms,
  loadCharacterGlbInstance,
  loadStandalone3DItemInstance,
  loadWearable3DItemInstance,
  preloadCore3DGlbs,
  syncBodyMorphUniforms,
} from "@/lib/three/glb-character-engine";

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

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function createFloorShadowTexture(): THREE.CanvasTexture {
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  const grad = ctx.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, "rgba(20, 22, 28, 0.24)");
  grad.addColorStop(0.55, "rgba(20, 22, 28, 0.08)");
  grad.addColorStop(1.0, "rgba(20, 22, 28, 0.0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

function create3DTapeRing(rx: number, rz: number, y: number, hexColor: string): THREE.Line {
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

/**
 * REAL-TIME WEBGL THREE.JS 3D CHARACTER AVATAR & 3D IN-APP GARMENT ENGINE
 * - Loads the persistent 3D Character (`avatar_character.glb`) into WebGL
 * - Equips each individual clothing piece, shoe, belt, and bag as its OWN 3D `.glb` mesh (`items/<sku>.glb`)
 * - Morphs the 3D Character + all equipped 3D Garments in real time on the GPU to match scanned Height, Bust, Waist & Hips
 * - Supports continuous 0°..360° 3D orbit, raycast tap-on-3D-garment selection, 3D tape rings, and standalone 3D item spin!
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
  const onYawChangeRef = useRef(onYawChange);
  onYawChangeRef.current = onYawChange;
  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;

  const yawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const targetYawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const velYawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0.02);
  const targetPitchRef = useRef<number>(0.02);
  const zoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);

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
  const [isLoading3D, setIsLoading3D] = useState<boolean>(false);

  // Persistent Three.js scene graph refs
  const threeCtxRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    turntable: THREE.Group;
    characterGroup: THREE.Group;
    equippedGroup: THREE.Group;
    productGroup: THREE.Group;
    ringsGroup: THREE.Group;
    faceDecalGroup: THREE.Group;
    charUniforms: BodyMorphUniforms;
    itemUniformsList: Array<{
      uniforms: BodyMorphUniforms;
      product: Product;
      isRigidBag: boolean;
    }>;
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
      targetYawRef.current = (externalYawDeg * Math.PI) / 180;
    }
  }, [externalYawDeg]);

  // Fit reports per worn piece
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

  // Partition wornPieces into unique wearable 3D slots (ONLY equipping items present in wornPieces!)
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

  // 1. Mount WebGL Three.js Renderer, Studio Lighting, Floor Shadow & Persistent 3D Character!
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";
    wrapEl.innerHTML = "";
    wrapEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.52;

    const hemi = new THREE.HemisphereLight(0xffffff, 0xece8e2, 1.38);
    scene.add(hemi);
    const keyLight = new THREE.DirectionalLight(0xfffdf9, 1.42);
    keyLight.position.set(1.8, 2.5, 2.9);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xf3f6ff, 0.72);
    fillLight.position.set(-2.0, 1.6, 1.9);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.62);
    rimLight.position.set(0.0, 2.2, -2.6);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(28, 1, 0.08, 25);

    const turntable = new THREE.Group();
    scene.add(turntable);

    // Soft radial floor contact shadow disc
    const shadowTex = createFloorShadowTexture();
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.68),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
      })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.002;
    scene.add(shadowPlane);

    const characterGroup = new THREE.Group();
    const equippedGroup = new THREE.Group();
    const productGroup = new THREE.Group();
    const ringsGroup = new THREE.Group();
    const faceDecalGroup = new THREE.Group();

    turntable.add(characterGroup);
    turntable.add(equippedGroup);
    turntable.add(productGroup);
    turntable.add(ringsGroup);
    turntable.add(faceDecalGroup);

    const charUniforms = createBodyMorphUniforms();

    threeCtxRef.current = {
      renderer,
      scene,
      camera,
      turntable,
      characterGroup,
      equippedGroup,
      productGroup,
      ringsGroup,
      faceDecalGroup,
      charUniforms,
      itemUniformsList: [],
    };

    // Load Persistent Lifelike 3D Character (`avatar_character.glb`)
    let disposed = false;
    void loadCharacterGlbInstance(charUniforms).then((charMesh) => {
      if (disposed) return;
      characterGroup.clear();
      characterGroup.add(charMesh);
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

    // Interactive 360° Orbit, Pitch, Zoom & Raycast Garment Picking
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
        const instV = (stepDx * 0.015) / dtMove;
        velYawRef.current = velYawRef.current * 0.55 + clamp(instV, -9, 9) * 0.45;
      }
      targetYawRef.current = startYaw + dx * 0.015;
      targetPitchRef.current = clamp(startPitch + dy * 0.004, -0.22, 0.28);
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

      // True 3D Raycast Tap-on-Garment Selection!
      if (movedDist < 6 && equippedGroup.children.length > 0) {
        const rect = dom.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(equippedGroup.children, true);
        const hitMesh = hits.find((h) => h.object.userData?.product);
        if (hitMesh) {
          const prod = hitMesh.object.userData.product as Product;
          const fit = fitByProductIdRef.current.get(prod.id);
          setTappedInfo({ product: prod, fit });
          onSelectProductRef.current?.(prod, fit);
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
        targetYawRef.current += dt * 0.78;
      } else if (inertiaSpin && !dragging && Math.abs(velYawRef.current) > 0.02) {
        targetYawRef.current += velYawRef.current * dt;
        velYawRef.current *= Math.exp(-3.6 * dt);
        if (Math.abs(velYawRef.current) <= 0.02) velYawRef.current = 0;
      }

      const damp = 1 - Math.exp(-12 * dt);
      yawRef.current += (targetYawRef.current - yawRef.current) * damp;
      pitchRef.current += (targetPitchRef.current - pitchRef.current) * damp;
      zoomRef.current += (targetZoomRef.current - zoomRef.current) * damp;

      // Subtle lifelike 3D character breathing poise!
      const breath = 1.0 + Math.sin(now * 0.0021) * 0.0028;
      turntable.rotation.y = yawRef.current;
      turntable.rotation.x = pitchRef.current;
      characterGroup.scale.y = breath;
      equippedGroup.scale.y = breath;

      // Frame camera cleanly for either 3D Character (`avatar`) or Standalone 3D Item (`product`)
      const isProdMode = productGroup.visible;
      if (isProdMode) {
        const dist = 1.65 / zoomRef.current;
        camera.position.set(0, 0.42, dist);
        camera.lookAt(0, 0.40, 0);
        shadowPlane.position.y = 0.02;
        shadowPlane.scale.setScalar(0.68);
      } else {
        const hScale = charUniforms.uHeightScale.value;
        const charTop = 1.58 * hScale;
        const hudPadFactor = showHud ? (compactHud ? 1.12 : 1.15) : 1.04;
        const halfFovRad = (camera.fov * Math.PI) / 360;
        const reqDistH = ((charTop * hudPadFactor) * 0.5) / Math.tan(halfFovRad);
        const reqDistW = (0.64 / Math.max(0.42, camera.aspect)) / Math.tan(halfFovRad);
        const dist = Math.max(reqDistH, reqDistW) / zoomRef.current;
        const lookY = charTop * (showHud ? 0.485 : 0.50);
        camera.position.set(0, lookY + 0.03, dist);
        camera.lookAt(0, lookY, 0);
        shadowPlane.position.y = 0.002;
        shadowPlane.scale.setScalar(1.0);
      }

      renderer.render(scene, camera);

      frameTick++;
      if (frameTick % 4 === 0) {
        const deg =
          (((Math.round((yawRef.current * 180) / Math.PI) % 360) + 360) % 360);
        setLiveDeg(deg);
        onYawChangeRef.current?.(deg);
      }

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
      envTex.dispose();
      pmrem.dispose();
      shadowTex.dispose();
      renderer.dispose();
      threeCtxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compactHud, inertiaSpin, seamlessStage, showHud]);

  // 2. Equip / Swap Individual 3D `.glb` Clothing Items Atomically onto the 3D Character (or Standalone 3D Item Mode)!
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;

    const reqId = ++equipReqIdRef.current;

    if (mode === "product") {
      ctx.characterGroup.visible = false;
      ctx.equippedGroup.visible = false;
      ctx.faceDecalGroup.visible = false;
      ctx.ringsGroup.visible = false;
      ctx.productGroup.visible = true;

      const prod = singleProduct || wornPieces[0]?.product;
      if (!prod) {
        ctx.productGroup.clear();
        return;
      }

      setIsLoading3D(true);
      void loadStandalone3DItemInstance(prod)
        .then((itemGroup) => {
          if (equipReqIdRef.current !== reqId) return;
          const box = new THREE.Box3().setFromObject(itemGroup);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          itemGroup.position.sub(center);
          const maxDim = Math.max(size.x, size.y, size.z, 0.12);
          const normScale = 0.68 / maxDim;
          const holder = new THREE.Group();
          holder.scale.setScalar(normScale);
          holder.position.y = 0.42;
          holder.add(itemGroup);

          ctx.productGroup.clear();
          ctx.productGroup.add(holder);
          setIsLoading3D(false);
        })
        .catch(() => {
          if (equipReqIdRef.current === reqId) setIsLoading3D(false);
        });
      return;
    }

    // `mode === "avatar"` — 3D Character + Equipped 3D Garment Items!
    ctx.productGroup.visible = false;
    ctx.characterGroup.visible = true;
    ctx.equippedGroup.visible = true;
    ctx.faceDecalGroup.visible = Boolean(faceOvalDataUrl);

    if (slotEquippedProducts.length === 0) {
      ctx.equippedGroup.clear();
      ctx.itemUniformsList = [];
      setIsLoading3D(false);
      return;
    }

    const loadTimer = setTimeout(() => {
      if (equipReqIdRef.current === reqId) setIsLoading3D(true);
    }, 140);

    const tasks = slotEquippedProducts.map(async (prod) => {
      const slot = classifyWearableSlotAndAnchors(prod).slot;
      const isRigidBag = slot === "bag";
      const uniforms = createBodyMorphUniforms();
      syncBodyMorphUniforms(
        uniforms,
        dimensions,
        activeVisualMode,
        true,
        isRigidBag,
        fitByProductIdRef.current.get(prod.id)
      );
      const group = await loadWearable3DItemInstance(prod, uniforms);
      return { prod, uniforms, isRigidBag, group };
    });

    void Promise.all(tasks)
      .then((loadedItems) => {
        clearTimeout(loadTimer);
        if (equipReqIdRef.current !== reqId) return;

        // ATOMIC SWAP: replace all equipped 3D garment meshes in a single synchronous frame!
        ctx.equippedGroup.clear();
        ctx.itemUniformsList = [];
        for (const item of loadedItems) {
          ctx.equippedGroup.add(item.group);
          ctx.itemUniformsList.push({
            uniforms: item.uniforms,
            product: item.prod,
            isRigidBag: item.isRigidBag,
          });
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

  // 3. Sync Real-Time GPU Body-Scan Inch Morphing, Fit Heatmap & 3D Tape Rings!
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;

    syncBodyMorphUniforms(
      ctx.charUniforms,
      dimensions,
      activeVisualMode,
      false,
      false
    );
    for (const entry of ctx.itemUniformsList) {
      syncBodyMorphUniforms(
        entry.uniforms,
        dimensions,
        activeVisualMode,
        true,
        entry.isRigidBag,
        fitByProductId.get(entry.product.id)
      );
    }

    // Update real 3D WebGL Body-Scan Measurement Rings around Bust, Waist & Hips!
    ctx.ringsGroup.clear();
    const show3DRings =
      mode === "avatar" && (effectiveShowRings || activeVisualMode === "xray");
    ctx.ringsGroup.visible = show3DRings;
    if (show3DRings) {
      const hs = ctx.charUniforms.uHeightScale.value;
      const bs = ctx.charUniforms.uBodyScales.value;
      ctx.ringsGroup.add(
        create3DTapeRing(0.098 * bs.y, 0.088 * bs.y, 1.14 * hs, "#10B981")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.084 * bs.z, 0.072 * bs.z, 0.98 * hs, "#244B3B")
      );
      ctx.ringsGroup.add(
        create3DTapeRing(0.108 * bs.w, 0.094 * bs.w, 0.81 * hs, "#0EA5E9")
      );
    }
  }, [activeVisualMode, dimensions, effectiveShowRings, fitByProductId, mode]);

  // 4. Optional Scanned Customer Face 3D Decal Projection
  useEffect(() => {
    const ctx = threeCtxRef.current;
    if (!ctx) return;
    ctx.faceDecalGroup.clear();
    if (!faceOvalDataUrl || mode !== "avatar") return;

    const tex = new THREE.TextureLoader().load(faceOvalDataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.115, 0.135, 12, 12),
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
      })
    );
    // Curve slightly around facial front contour
    const pos = plane.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      pos.setZ(i, -px * px * 2.2);
    }
    pos.needsUpdate = true;
    plane.position.set(0, 1.405 * ctx.charUniforms.uHeightScale.value, 0.074);
    ctx.faceDecalGroup.add(plane);
  }, [dimensions.heightInches, faceOvalDataUrl, mode]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    velYawRef.current = 0;
    targetYawRef.current = (deg * Math.PI) / 180;
    targetPitchRef.current = 0.02;
  };

  return (
    <div
      data-3d-engine="webgl-glb-character"
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : slotEquippedProducts.length}
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
    >
      {/* Interactive WebGL Three.js Viewport */}
      <div
        ref={wrapRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Non-blanking 3D GLB equip indicator if network takes >140ms */}
      {isLoading3D && (
        <div className="pointer-events-none absolute top-11 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full bg-white/95 border border-black/[0.08] shadow-xs text-[10px] font-bold text-[#244B3B] inline-flex items-center gap-1">
          <Box className="w-3 h-3 animate-pulse" /> Equipping 3D Item…
        </div>
      )}

      {/* Top-Left Scanned 3D Character Live Badge */}
      {showHud && mode === "avatar" && !compactHud && (
        <div className="pointer-events-none hidden sm:flex absolute top-2.5 left-2.5 z-10 flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1">
            <Ruler className="w-3 h-3 text-[#244B3B]" />
            3D Character • {formatHeightFeetInches(dimensions.heightInches)} •{" "}
            {dimensions.bustInches}&quot; B • {dimensions.waistInches}&quot; W •{" "}
            {dimensions.hipsInches}&quot; H
          </span>
          <span className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold">
            {liveDeg}°
          </span>
        </div>
      )}

      {/* Top-Right 3D Visual Mode Switcher */}
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
        </div>
      )}

      {/* Tapped 3D Garment Raycast Callout Pill */}
      {showHud && tappedInfo && !compactHud && (
        <div className="absolute left-2.5 bottom-12 z-10 max-w-[260px] px-3 py-1.5 rounded-2xl bg-white/95 backdrop-blur-md border border-black/[0.09] shadow-md flex items-center justify-between gap-2">
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

      {/* Bottom Interactive 360° 3D Orbit & Zoom Bar */}
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
                      1.55,
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
                      0.78,
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
                    targetPitchRef.current = 0.02;
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

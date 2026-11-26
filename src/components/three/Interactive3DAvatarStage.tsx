"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import {
  Eye,
  Flame,
  Play,
  Pause,
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
  buildInteractive3DAvatarScene,
  buildStandalone3DProductScene,
  Render3DVisualMode,
  Worn3DPieceSpec,
} from "@/lib/three/parametric-3d-engine";
import { AvatarExactFitReport } from "@/lib/catalog/fit-intelligence";

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
  showHud?: boolean;
  compactHud?: boolean;
  selectedProductId?: string | null;
  onSelectProduct?: (product: Product, fit?: AvatarExactFitReport) => void;
  className?: string;
}

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
  initialYawDeg = 14,
  externalYawDeg,
  showHud = true,
  compactHud = false,
  selectedProductId,
  onSelectProduct,
  className = "",
}: Interactive3DAvatarStageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const contentGroupRef = useRef<THREE.Group | null>(null);
  const interactiveMeshesRef = useRef<THREE.Object3D[]>([]);
  const fitMapRef = useRef<Map<string, AvatarExactFitReport>>(new Map());
  const needsRenderRef = useRef<boolean>(true);

  // Orbit state refs for 60fps zero-rerender pointer dragging
  const yawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const targetYawRef = useRef<number>((initialYawDeg * Math.PI) / 180);
  const pitchRef = useRef<number>(0.08);
  const targetPitchRef = useRef<number>(0.08);
  const zoomRef = useRef<number>(1.0);
  const targetZoomRef = useRef<number>(1.0);
  const baseCamDistRef = useRef<number>(8.4);
  const lookCenterYRef = useRef<number>(3.35);

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
  const [webglReady, setWebglReady] = useState<boolean>(true);

  const setVisualMode = useCallback(
    (m: Render3DVisualMode) => {
      setInternalVisualMode(m);
      onVisualModeChange?.(m);
    },
    [onVisualModeChange]
  );

  // Sync externalYawDeg (e.g., Front 0° / Back 180° button from parent)
  useEffect(() => {
    if (typeof externalYawDeg === "number") {
      targetYawRef.current = (externalYawDeg * Math.PI) / 180;
      needsRenderRef.current = true;
    }
  }, [externalYawDeg]);

  // Initialize WebGLRenderer, Studio Scene, Softbox Lights & Animation Loop once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglReady(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "pan-y";

    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Studio PBR environment reflections for satin, leather & 14k gold hardware
    let envRT: THREE.WebGLRenderTarget | null = null;
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.55;
      pmrem.dispose();
    } catch {
      // Fallback to multi-light studio rig
    }

    // 3-Point Fashion Editorial Softbox Lighting
    const hemi = new THREE.HemisphereLight("#FFFFFF", "#DCE3EE", 0.95);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight("#FFFBF6", 1.55);
    keyLight.position.set(3.8, 7.5, 5.6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#EEF4FF", 0.78);
    fillLight.position.set(-4.2, 4.8, 3.8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#FFFFFF", 0.92);
    rimLight.position.set(0, 6.2, -5.5);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    cameraRef.current = camera;

    const contentHolder = new THREE.Group();
    scene.add(contentHolder);
    contentGroupRef.current = contentHolder;

    const updateSize = () => {
      const w = Math.max(120, container.clientWidth);
      const h = Math.max(140, container.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      needsRenderRef.current = true;
    };
    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    // Pointer Orbit + Raycast Click Selection
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startYaw = 0;
    let startPitch = 0;
    let movedDist = 0;

    const canvas = renderer.domElement;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      movedDist = 0;
      startX = e.clientX;
      startY = e.clientY;
      startYaw = targetYawRef.current;
      startPitch = targetPitchRef.current;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      movedDist = Math.hypot(dx, dy);
      if (movedDist > 4 && autoSpinRef.current) {
        setAutoSpin(false);
      }
      targetYawRef.current = startYaw + dx * 0.0125;
      targetPitchRef.current = Math.max(
        -0.28,
        Math.min(0.55, startPitch + dy * 0.006)
      );
      needsRenderRef.current = true;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (movedDist < 6 && interactiveMeshesRef.current.length > 0) {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, camera);
        const hits = raycaster.intersectObjects(
          interactiveMeshesRef.current,
          false
        );
        if (hits.length > 0) {
          const hitProd = hits[0].object.userData.product as Product | undefined;
          if (hitProd) {
            const fit = fitMapRef.current.get(hitProd.id);
            setTappedInfo({ product: hitProd, fit });
            onSelectProduct?.(hitProd, fit);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl/pinch or hovering directly over 3D canvas on desktop
      if (Math.abs(e.deltaY) > 0 && (window.innerWidth > 820 || e.ctrlKey)) {
        e.preventDefault();
        targetZoomRef.current = Math.max(
          0.62,
          Math.min(1.65, targetZoomRef.current + Math.sign(e.deltaY) * 0.08)
        );
        needsRenderRef.current = true;
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    let rafId = 0;
    let lastTime = performance.now();
    let frameCounter = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (autoSpinRef.current && !dragging) {
        targetYawRef.current += dt * 0.68;
        needsRenderRef.current = true;
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
        needsRenderRef.current = true;
      }

      if (needsRenderRef.current) {
        const holder = contentGroupRef.current;
        if (holder) {
          holder.rotation.y = yawRef.current;
        }
        // Adjust camera distance automatically for narrow aspect viewports so full avatar head-to-toe NEVER clips!
        const aspectBoost = camera.aspect < 0.72 ? (0.72 / Math.max(0.4, camera.aspect)) * 0.92 : 1.0;
        const dist = baseCamDistRef.current * zoomRef.current * aspectBoost;
        const cy = lookCenterYRef.current;
        camera.position.set(
          0,
          cy + Math.sin(pitchRef.current) * dist * 0.72,
          Math.cos(pitchRef.current) * dist
        );
        camera.lookAt(0, cy, 0);

        renderer.render(scene, camera);
        needsRenderRef.current = false;

        frameCounter++;
        if (frameCounter % 4 === 0) {
          const deg =
            (((Math.round((yawRef.current * 180) / Math.PI) % 360) + 360) %
              360);
          setLiveDeg(deg);
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      envRT?.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild Parametric 3D Body + 3D Garments / Standalone 3D Product whenever dimensions, pieces, or visualMode change!
  const piecesKey = useMemo(
    () =>
      wornPieces
        .map((w) => `${w.product.id}:${w.selectedSize || ""}`)
        .join("|"),
    [wornPieces]
  );

  useEffect(() => {
    const holder = contentGroupRef.current;
    if (!holder) return;

    // Cleanly dispose previous geometries
    holder.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        mesh.geometry.dispose();
      }
    });
    holder.clear();

    const triggerRepaint = () => {
      needsRenderRef.current = true;
    };

    if (mode === "product" && singleProduct) {
      const built = buildStandalone3DProductScene({
        product: singleProduct,
        dimensions,
        selectedSize,
        visualMode: activeVisualMode,
        onTextureReady: triggerRepaint,
      });
      holder.add(built.root);
      lookCenterYRef.current = built.centerY;
      baseCamDistRef.current = built.cameraDistance;
      interactiveMeshesRef.current = [];
      fitMapRef.current = new Map();
    } else {
      const built = buildInteractive3DAvatarScene({
        dimensions,
        wornPieces,
        visualMode: activeVisualMode,
        showMeasurementRings: effectiveShowRings,
        faceOvalDataUrl,
        onTextureReady: triggerRepaint,
      });
      holder.add(built.root);
      lookCenterYRef.current = built.totalHeightUnits * 0.485;
      // Commanding full-body framing from hair crown to stiletto podium
      baseCamDistRef.current = built.totalHeightUnits * 1.74;
      interactiveMeshesRef.current = built.interactiveMeshes;
      fitMapRef.current = built.fitByProductId;

      if (selectedProductId) {
        const matched = wornPieces.find((w) => w.product.id === selectedProductId);
        if (matched) {
          setTappedInfo({
            product: matched.product,
            fit: built.fitByProductId.get(matched.product.id),
          });
        }
      }
    }

    needsRenderRef.current = true;
  }, [
    activeVisualMode,
    dimensions,
    effectiveShowRings,
    faceOvalDataUrl,
    mode,
    piecesKey,
    selectedProductId,
    selectedSize,
    singleProduct,
    wornPieces,
  ]);

  const snapAngle = (deg: number) => {
    setAutoSpin(false);
    targetYawRef.current = (deg * Math.PI) / 180;
    targetPitchRef.current = 0.08;
    needsRenderRef.current = true;
  };

  if (!webglReady) {
    return (
      <div
        className={`relative flex items-center justify-center rounded-2xl bg-[#EEF1F6] p-4 text-xs font-semibold text-[#686D76] ${className}`}
      >
        Interactive 3D Stage Ready
      </div>
    );
  }

  return (
    <div
      data-3d-engine="three-webgl"
      data-3d-mode={mode}
      data-worn-count={mode === "product" ? 1 : wornPieces.length}
      className={`relative w-full h-full select-none overflow-hidden ${className}`}
    >
      {/* WebGL 3D Canvas Mount */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left Scanned Body Twin Live Badge (Avatar Mode on sm+ screens) */}
      {showHud && mode === "avatar" && !compactHud && (
        <div className="pointer-events-none hidden sm:flex absolute top-2.5 left-2.5 z-10 flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md border border-black/[0.08] shadow-xs text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1">
            <Ruler className="w-3 h-3 text-[#244B3B]" />
            {formatHeightFeetInches(dimensions.heightInches)} •{" "}
            {dimensions.bustInches}&quot; B • {dimensions.waistInches}&quot; W •{" "}
            {dimensions.hipsInches}&quot; H
          </span>
          <span className="px-2 py-1 rounded-full bg-[#141518]/85 text-white text-[10px] font-bold">
            3D {liveDeg}°
          </span>
        </div>
      )}

      {/* Top-Right 3D Fit Physics Switcher (3D Studio | Fit Heatmap | X-Ray Ease) */}
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
            <Sparkles className="w-2.5 h-2.5" /> 3D
          </button>
          <button
            type="button"
            onClick={() => setVisualMode("heatmap")}
            className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              activeVisualMode === "heatmap"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
            title="Color-code garment tension vs your exact scanned body"
          >
            <Flame className="w-2.5 h-2.5 text-[#F59E0B]" /> Fit Map
          </button>
          {mode === "avatar" && (
            <button
              type="button"
              onClick={() => setVisualMode("xray")}
              className={`px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                activeVisualMode === "xray"
                  ? "bg-[#141518] text-white"
                  : "text-[#686D76] hover:text-[#141518]"
              }`}
              title="See garment ease clearance over your scanned 3D body"
            >
              <Eye className="w-2.5 h-2.5 text-[#0EA5E9]" /> X-Ray
            </button>
          )}
        </div>
      )}

      {/* Tapped 3D Garment Exact-Fit Callout Pill */}
      {showHud && tappedInfo && !compactHud && (
        <div className="absolute left-2.5 bottom-12 z-10 max-w-[260px] px-3 py-1.5 rounded-2xl bg-white/94 backdrop-blur-md border border-black/[0.09] shadow-md flex items-center justify-between gap-2">
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

      {/* Heatmap Legend Pill when Heatmap is active */}
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

      {/* Bottom Interactive 360° Orbit & Zoom Control Strip */}
      {showHud && (
        <div className="absolute inset-x-2 bottom-2 z-10 flex items-center justify-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-1 px-2 py-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-sm">
            {(
              [
                [0, "Front 0°"],
                [40, "3/4"],
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
                title="Show 3D Bust / Waist / Hip measurement tape rings"
              >
                <Ruler className="w-2.5 h-2.5" /> Tape
              </button>
            )}

            {!compactHud && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    targetZoomRef.current = Math.max(
                      0.62,
                      targetZoomRef.current - 0.14
                    );
                    needsRenderRef.current = true;
                  }}
                  aria-label="Zoom in 3D"
                  className="hidden sm:inline-flex p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] items-center justify-center"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    targetZoomRef.current = Math.min(
                      1.65,
                      targetZoomRef.current + 0.14
                    );
                    needsRenderRef.current = true;
                  }}
                  aria-label="Zoom out 3D"
                  className="hidden sm:inline-flex p-1 rounded-full hover:bg-[#EAECEF] text-[#141518] cursor-pointer min-w-[24px] min-h-[24px] items-center justify-center"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    targetYawRef.current = (initialYawDeg * Math.PI) / 180;
                    targetPitchRef.current = 0.08;
                    targetZoomRef.current = 1.0;
                    needsRenderRef.current = true;
                  }}
                  aria-label="Reset 3D camera"
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

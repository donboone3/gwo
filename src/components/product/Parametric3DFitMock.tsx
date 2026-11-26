"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Flame, Play, Pause, RotateCcw, Sparkles, ZoomIn, ZoomOut } from "lucide-react";
import {
  buildParametric3DFitScene,
  MeshZoneStatus,
  Point3D,
} from "@/lib/catalog/parametric-3d-garment";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { Product } from "@/lib/types";

export type MockRenderMode = "fabric" | "heatmap" | "xray";

interface Parametric3DFitMockProps {
  product: Product;
  selectedSize: string;
  fitReport: ReturnType<typeof analyzeExactAvatarFit>;
  avatar: {
    heightInches: number;
    bustInches: number;
    waistInches: number;
    hipsInches: number;
    skinTone?: string;
  };
  faceBadgeUrl?: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const num = parseInt(full.slice(0, 6), 16) || 0xc80815;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function statusToHeatmapHex(status: MeshZoneStatus): string {
  if (status === "too_tight") return "#DC2626"; // Crimson pinch alert
  if (status === "sculpted_snug") return "#D97706"; // Amber stretch hug
  if (status === "tailored_ideal") return "#15803D"; // Emerald exact fit
  return "#2563EB"; // Cobalt fluid drape ease
}

function statusLabelShort(status: MeshZoneStatus, ease: number): string {
  const sign = ease >= 0 ? "+" : "";
  if (status === "too_tight") return `${sign}${ease}" PINCH`;
  if (status === "sculpted_snug") return `${sign}${ease}" Snug`;
  if (status === "tailored_ideal") return `${sign}${ease}" Exact`;
  return `${sign}${ease}" Drape`;
}

export function Parametric3DFitMock({
  product,
  selectedSize,
  fitReport,
  avatar,
}: Parametric3DFitMockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [renderMode, setRenderMode] = useState<MockRenderMode>("fabric");
  const [autoSpin, setAutoSpin] = useState(false);
  const [yawDegDisplay, setYawDegDisplay] = useState(18);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Mutable camera state for zero-React-rerender 120fps drag rotation
  const camRef = useRef({
    yaw: (18 * Math.PI) / 180,
    pitch: 0.07,
    zoom: 1.0,
    targetYaw: null as number | null,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  const scene = useMemo(
    () =>
      buildParametric3DFitScene({
        avatar: {
          heightInches: avatar.heightInches,
          bustInches: avatar.bustInches,
          waistInches: avatar.waistInches,
          hipsInches: avatar.hipsInches,
          skinTone: avatar.skinTone || "#D9A482",
        },
        product,
        selectedSize,
      }),
    [
      avatar.bustInches,
      avatar.heightInches,
      avatar.hipsInches,
      avatar.skinTone,
      avatar.waistInches,
      product,
      selectedSize,
    ]
  );

  const isGlossyFabric = useMemo(() => {
    const f = `${product.title} ${product.fitMetadata?.fabricComposition || ""}`.toLowerCase();
    return /silk|satin|metallic|silver|crystal|leather|vinyl/.test(f);
  }, [product]);

  const paintRef = useRef<(() => void) | null>(null);

  const jumpToAngle = useCallback((deg: number) => {
    setAutoSpin(false);
    camRef.current.targetYaw = (deg * Math.PI) / 180;
    paintRef.current?.();
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    const next = Math.max(0.78, Math.min(1.65, Number((camRef.current.zoom + delta).toFixed(2))));
    camRef.current.zoom = next;
    setZoomLevel(next);
    paintRef.current?.();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = 540;
    const H_PX = 680;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    if (cv.width !== W * dpr || cv.height !== H_PX * dpr) {
      cv.width = W * dpr;
      cv.height = H_PX * dpr;
    }

    const bodyCenterY = scene.totalHeightInches * 0.515;
    const cameraDist = 112;
    const baseFocal = 940;

    // Normalized studio lights in camera space
    const kLen = Math.hypot(0.42, 0.55, 0.72);
    const Lx = 0.42 / kLen;
    const Ly = 0.55 / kLen;
    const Lz = 0.72 / kLen;

    const projectPoint = (
      p: Point3D,
      cosY: number,
      sinY: number,
      cosP: number,
      sinP: number,
      focal: number
    ) => {
      const yc = p.y - bodyCenterY;
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = yc * cosP - z1 * sinP;
      const z2 = yc * sinP + z1 * cosP;
      const s = focal / Math.max(24, cameraDist - z2);
      return {
        x1,
        y2,
        z2,
        sx: W * 0.48 + x1 * s,
        sy: H_PX * 0.515 - y2 * s,
      };
    };

    let lastYawBadge = -999;

    const drawScene = () => {
      const { yaw, pitch, zoom } = camRef.current;
      const cosY = Math.cos(yaw);
      const sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const focal = baseFocal * zoom;

      const normDeg = (((Math.round((yaw * 180) / Math.PI) % 360) + 360) % 360);
      if (Math.abs(normDeg - lastYawBadge) >= 2) {
        lastYawBadge = normDeg;
        setYawDegDisplay(normDeg);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Clean Studio Cyclorama Backdrop + 3D Floor Turntable Grid
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H_PX);
      bgGrad.addColorStop(0, "#F8F9FB");
      bgGrad.addColorStop(0.68, "#EEF1F6");
      bgGrad.addColorStop(1, "#E3E7EF");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H_PX);

      // Subtle 3D floor pedestal rings at y = 2.8" (ankle/floor base)
      for (const rIn of [7.5, 11.5]) {
        ctx.beginPath();
        for (let j = 0; j <= 40; j++) {
          const u = (j / 40) * Math.PI * 2;
          const pt = projectPoint(
            { x: Math.cos(u) * rIn, y: 2.6, z: Math.sin(u) * rIn },
            cosY,
            sinY,
            cosP,
            sinP,
            focal
          );
          if (j === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.strokeStyle = rIn < 9 ? "rgba(20,21,24,0.14)" : "rgba(20,21,24,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Soft ambient ground shadow
      const floorOrigin = projectPoint(
        { x: 0, y: 2.6, z: 0 },
        cosY,
        sinY,
        cosP,
        sinP,
        focal
      );
      const shGrad = ctx.createRadialGradient(
        floorOrigin.sx,
        floorOrigin.sy,
        6,
        floorOrigin.sx,
        floorOrigin.sy,
        82 * zoom
      );
      shGrad.addColorStop(0, "rgba(20,24,32,0.22)");
      shGrad.addColorStop(1, "rgba(20,24,32,0)");
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(
        floorOrigin.sx,
        floorOrigin.sy,
        82 * zoom,
        20 * zoom,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 2. Project & Shade Quads
      interface ProjectedQuad {
        q0: ReturnType<typeof projectPoint>;
        q1: ReturnType<typeof projectPoint>;
        q2: ReturnType<typeof projectPoint>;
        q3: ReturnType<typeof projectPoint>;
        depthZ: number;
        fillStyle: string;
        strokeStyle: string | null;
        alpha: number;
        layer: "body" | "garment" | "detail";
      }

      const drawList: ProjectedQuad[] = [];

      for (let i = 0; i < scene.quads.length; i++) {
        const q = scene.quads[i];
        const q0 = projectPoint(q.p0, cosY, sinY, cosP, sinP, focal);
        const q1 = projectPoint(q.p1, cosY, sinY, cosP, sinP, focal);
        const q2 = projectPoint(q.p2, cosY, sinY, cosP, sinP, focal);
        const q3 = projectPoint(q.p3, cosY, sinY, cosP, sinP, focal);

        // Compute camera-space normal (v x u points outward)
        const ux = q1.x1 - q0.x1;
        const uy = q1.y2 - q0.y2;
        const uz = q1.z2 - q0.z2;
        const vx = q3.x1 - q0.x1;
        const vy = q3.y2 - q0.y2;
        const vz = q3.z2 - q0.z2;

        let nx = vy * uz - vz * uy;
        let ny = vz * ux - vx * uz;
        let nz = vx * uy - vy * ux;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;

        // Backface cull closed body shell for crisp silhouette & 2x raster speed
        if (q.layer === "body" && nz < -0.15) continue;

        // Two-sided shading for open garment shells (square neckline, corset back window)
        if (q.layer !== "body" && nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        const ndotl = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        const rim = Math.pow(1 - Math.max(0, nz), 2.4) * 0.18;
        const specPower = isGlossyFabric && q.layer !== "body" ? 22 : 12;
        const specStrength = isGlossyFabric && q.layer !== "body" ? 0.26 : 0.09;
        // Half-vector between L and View (0,0,1)
        const hx = Lx;
        const hy = Ly;
        const hz = Lz + 1;
        const hLen = Math.hypot(hx, hy, hz) || 1;
        const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
        const spec = Math.pow(ndoth, specPower) * specStrength;

        let baseHex = q.baseHex;
        if (renderMode === "heatmap") {
          baseHex =
            q.layer === "body" ? "#DDE2EA" : statusToHeatmapHex(q.status);
        }

        const [r0, g0, b0] = hexToRgb(baseHex);
        const shade = 0.44 + ndotl * 0.52 + rim;
        const rr = Math.min(255, Math.round(r0 * shade + spec * 255));
        const gg = Math.min(255, Math.round(g0 * shade + spec * 255));
        const bb = Math.min(255, Math.round(b0 * shade + spec * 255));

        const zAvg = (q0.z2 + q1.z2 + q2.z2 + q3.z2) * 0.25;
        // Slight layer bias so tight garment quads always win tie-breakers over skin underneath
        const layerBias =
          q.layer === "detail" ? 0.35 : q.layer === "garment" ? 0.18 : 0;

        const isXrayGarment = renderMode === "xray" && q.layer !== "body";

        drawList.push({
          q0,
          q1,
          q2,
          q3,
          depthZ: zAvg + layerBias,
          fillStyle: `rgb(${rr},${gg},${bb})`,
          strokeStyle: isXrayGarment
            ? `rgba(${rr},${gg},${bb},0.72)`
            : renderMode === "heatmap" && q.layer !== "body"
            ? "rgba(255,255,255,0.16)"
            : `rgb(${rr},${gg},${bb})`,
          alpha: isXrayGarment ? 0.42 : 1,
          layer: q.layer,
        });
      }

      // In X-Ray mode, draw opaque inner body completely first, then depth-sorted translucent garment shell!
      if (renderMode === "xray") {
        drawList.sort((a, b) => {
          const aGroup = a.layer === "body" ? 0 : 1;
          const bGroup = b.layer === "body" ? 0 : 1;
          if (aGroup !== bGroup) return aGroup - bGroup;
          return a.depthZ - b.depthZ;
        });
      } else {
        drawList.sort((a, b) => a.depthZ - b.depthZ);
      }

      // 3. Draw Back Half of Caliper Rings (z2 < 0)
      const drawCaliperHalf = (frontHalf: boolean) => {
        for (const ring of scene.caliperRings) {
          const ringColor =
            ring.status === "too_tight"
              ? "#DC2626"
              : ring.status === "sculpted_snug"
              ? "#D97706"
              : "#1D4232";
          ctx.save();
          ctx.strokeStyle = ringColor;
          ctx.lineWidth = frontHalf ? 2.0 : 1.1;
          ctx.globalAlpha = frontHalf ? 0.92 : 0.25;
          if (!frontHalf) ctx.setLineDash([4, 4]);

          for (let j = 0; j < ring.points.length - 1; j++) {
            const a = projectPoint(ring.points[j], cosY, sinY, cosP, sinP, focal);
            const b = projectPoint(ring.points[j + 1], cosY, sinY, cosP, sinP, focal);
            const isFront = (a.z2 + b.z2) * 0.5 >= 0;
            if (isFront !== frontHalf) continue;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
          ctx.restore();
        }
      };

      drawCaliperHalf(false);

      // 4. Rasterize 3D Body + Garment Mesh
      for (let i = 0; i < drawList.length; i++) {
        const d = drawList[i];
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.fillStyle;
        ctx.beginPath();
        ctx.moveTo(d.q0.sx, d.q0.sy);
        ctx.lineTo(d.q1.sx, d.q1.sy);
        ctx.lineTo(d.q2.sx, d.q2.sy);
        ctx.lineTo(d.q3.sx, d.q3.sy);
        ctx.closePath();
        ctx.fill();
        if (d.strokeStyle) {
          ctx.strokeStyle = d.strokeStyle;
          ctx.lineWidth = d.alpha < 1 ? 0.65 : 0.45;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // 5. Draw Front Half of Caliper Rings + Live Measurement Callout Pills
      drawCaliperHalf(true);

      ctx.font = "700 10.5px 'Plus Jakarta Sans', system-ui, sans-serif";
      for (const ring of scene.caliperRings) {
        // Find rightmost projected point on this ring to anchor a clean horizontal leader line
        let bestPt = projectPoint(ring.points[0], cosY, sinY, cosP, sinP, focal);
        for (let j = 1; j < ring.points.length; j++) {
          const cand = projectPoint(ring.points[j], cosY, sinY, cosP, sinP, focal);
          if (cand.sx > bestPt.sx) bestPt = cand;
        }

        const pillBg =
          ring.status === "too_tight"
            ? "#FDECEB"
            : ring.status === "sculpted_snug"
            ? "#FEF6E6"
            : "#E7F3EE";
        const pillFg =
          ring.status === "too_tight"
            ? "#9E2A22"
            : ring.status === "sculpted_snug"
            ? "#8A5808"
            : "#1D4232";

        const labelText = `${ring.label} ${ring.bodyCircInches}" (${statusLabelShort(
          ring.status,
          ring.easeInches
        )})`;
        const tw = ctx.measureText(labelText).width;
        const px = Math.min(W - tw - 18, bestPt.sx + 16);
        const py = bestPt.sy;

        ctx.strokeStyle = pillFg;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(bestPt.sx + 2, bestPt.sy);
        ctx.lineTo(px - 4, py);
        ctx.stroke();

        ctx.fillStyle = pillBg;
        ctx.beginPath();
        ctx.roundRect(px - 6, py - 10, tw + 12, 20, 10);
        ctx.fill();
        ctx.strokeStyle = "rgba(20,21,24,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = pillFg;
        ctx.fillText(labelText, px, py + 3.5);
      }

      // 6. Draw Store Model Relative Hem Line vs Customer 5'2" Hem Line (Left Side)
      if (scene.storeModelRelativeHemYInches !== undefined) {
        const modelHemPt = projectPoint(
          { x: -6.2, y: scene.storeModelRelativeHemYInches, z: 0 },
          cosY,
          sinY,
          cosP,
          sinP,
          focal
        );
        const custHemPt = projectPoint(
          { x: -6.2, y: scene.customerHemYInches, z: 0 },
          cosY,
          sinY,
          cosP,
          sinP,
          focal
        );

        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#686D76";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(18, modelHemPt.sy);
        ctx.lineTo(Math.max(96, modelHemPt.sx + 24), modelHemPt.sy);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.beginPath();
        ctx.roundRect(14, modelHemPt.sy - 18, 122, 17, 8);
        ctx.fill();
        ctx.fillStyle = "#5C6068";
        ctx.font = "600 9.5px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(
          `Store Model Hem (${product.fitMetadata?.modelStats?.wornSize || "XS"})`,
          20,
          modelHemPt.sy - 6
        );

        ctx.setLineDash([]);
        ctx.strokeStyle = "#244B3B";
        ctx.beginPath();
        ctx.moveTo(18, custHemPt.sy);
        ctx.lineTo(Math.max(96, custHemPt.sx + 24), custHemPt.sy);
        ctx.stroke();

        const ft = Math.floor(avatar.heightInches / 12);
        const inch = Math.round(avatar.heightInches % 12);
        ctx.fillStyle = "#141518";
        ctx.beginPath();
        ctx.roundRect(14, custHemPt.sy + 2, 118, 18, 8);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 9.5px 'Plus Jakarta Sans', system-ui, sans-serif";
        ctx.fillText(`Your ${ft}'${inch}" Hem Landing`, 20, custHemPt.sy + 14);
        ctx.restore();
      }

      ctx.restore();
    };

    paintRef.current = drawScene;
    drawScene();

    // Demand-driven animation loop: ONLY ticks when autoSpin or smooth angle tween is active (0% idle CPU!)
    let rafId = 0;
    let lastNow = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      let needsMore = false;

      if (camRef.current.targetYaw !== null) {
        const diff = camRef.current.targetYaw - camRef.current.yaw;
        // Shortest angular path
        const wrappedDiff = Math.atan2(Math.sin(diff), Math.cos(diff));
        if (Math.abs(wrappedDiff) < 0.008) {
          camRef.current.yaw = camRef.current.targetYaw;
          camRef.current.targetYaw = null;
        } else {
          camRef.current.yaw += wrappedDiff * Math.min(1, dt * 9.5);
          needsMore = true;
        }
        drawScene();
      } else if (autoSpin && !camRef.current.dragging) {
        camRef.current.yaw += dt * 0.65;
        drawScene();
        needsMore = true;
      }

      if (needsMore) {
        rafId = requestAnimationFrame(step);
      }
    };

    if (autoSpin || camRef.current.targetYaw !== null) {
      rafId = requestAnimationFrame(step);
    }

    // Also hook jumpToAngle triggers cleanly
    const origPaint = paintRef.current;
    paintRef.current = () => {
      origPaint?.();
      if (camRef.current.targetYaw !== null) {
        cancelAnimationFrame(rafId);
        lastNow = performance.now();
        rafId = requestAnimationFrame(step);
      }
    };

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [autoSpin, avatar.heightInches, isGlossyFabric, product, renderMode, scene]);

  return (
    <div className="relative w-full flex-1 rounded-3xl bg-[#F4F6FA] border border-black/[0.08] shadow-[0_18px_42px_rgba(20,21,24,0.09)] overflow-hidden flex flex-col justify-between select-none">
      {/* Top Floating Render Sub-Mode Bar */}
      <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-xs pointer-events-auto">
          <button
            type="button"
            id="gwo-3d-mode-fabric"
            onClick={() => setRenderMode("fabric")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              renderMode === "fabric"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
          >
            <Sparkles className="w-3 h-3 text-[#A7D7C5]" /> 3D Garment
          </button>
          <button
            type="button"
            id="gwo-3d-mode-heatmap"
            onClick={() => setRenderMode("heatmap")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              renderMode === "heatmap"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
          >
            <Flame className="w-3 h-3 text-[#F59E0B]" /> Fit Heatmap
          </button>
          <button
            type="button"
            id="gwo-3d-mode-xray"
            onClick={() => setRenderMode("xray")}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              renderMode === "xray"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
          >
            <Eye className="w-3 h-3 text-[#60A5FA]" /> X-Ray Ease
          </button>
        </div>

        <div className="px-2.5 py-1 rounded-full bg-[#141518]/88 text-white text-[10.5px] font-bold backdrop-blur-xs">
          Size {selectedSize} • {String(yawDegDisplay).padStart(3, "0")}°
        </div>
      </div>

      {/* Interactive 3D Parametric Canvas */}
      <canvas
        ref={canvasRef}
        id="gwo-parametric-3d-canvas"
        onPointerDown={(e) => {
          camRef.current.dragging = true;
          camRef.current.targetYaw = null;
          camRef.current.lastX = e.clientX;
          camRef.current.lastY = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!camRef.current.dragging) return;
          const dx = e.clientX - camRef.current.lastX;
          const dy = e.clientY - camRef.current.lastY;
          camRef.current.lastX = e.clientX;
          camRef.current.lastY = e.clientY;
          camRef.current.yaw += dx * 0.011;
          camRef.current.pitch = Math.max(
            -0.28,
            Math.min(0.42, camRef.current.pitch + dy * 0.006)
          );
          paintRef.current?.();
        }}
        onPointerUp={() => {
          camRef.current.dragging = false;
        }}
        onPointerCancel={() => {
          camRef.current.dragging = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          adjustZoom(e.deltaY < 0 ? 0.08 : -0.08);
        }}
        className="w-full h-full object-contain cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Heatmap Legend Strip when Heatmap Active */}
      {renderMode === "heatmap" && (
        <div className="absolute left-3 bottom-14 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/94 border border-black/[0.08] text-[10px] font-bold shadow-xs pointer-events-none">
          <span className="inline-flex items-center gap-1 text-[#DC2626]">
            <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Pinch
          </span>
          <span className="inline-flex items-center gap-1 text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706]" /> Stretch Hug
          </span>
          <span className="inline-flex items-center gap-1 text-[#15803D]">
            <span className="w-2 h-2 rounded-full bg-[#15803D]" /> Exact Fit
          </span>
          <span className="inline-flex items-center gap-1 text-[#2563EB]">
            <span className="w-2 h-2 rounded-full bg-[#2563EB]" /> Drape Ease
          </span>
        </div>
      )}

      {/* Bottom Camera Angle Presets + Turntable & Zoom Controls */}
      <div className="absolute bottom-3 inset-x-3 z-10 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/94 backdrop-blur-md border border-black/[0.08] shadow-xs">
          <button
            type="button"
            id="gwo-3d-angle-front"
            onClick={() => jumpToAngle(15)}
            className="px-2.5 py-1 rounded-full text-[10.5px] font-bold text-[#141518] hover:bg-[#F1F2F5] cursor-pointer"
          >
            Front
          </button>
          <button
            type="button"
            id="gwo-3d-angle-side"
            onClick={() => jumpToAngle(90)}
            className="px-2.5 py-1 rounded-full text-[10.5px] font-bold text-[#141518] hover:bg-[#F1F2F5] cursor-pointer"
          >
            Profile 90°
          </button>
          <button
            type="button"
            id="gwo-3d-angle-back"
            onClick={() => jumpToAngle(180)}
            className="px-2.5 py-1 rounded-full text-[10.5px] font-bold text-[#141518] hover:bg-[#F1F2F5] cursor-pointer"
          >
            {scene.hasCorsetBack ? "Corset Back 180°" : "Back 180°"}
          </button>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/94 backdrop-blur-md border border-black/[0.08] shadow-xs">
          <button
            type="button"
            onClick={() => setAutoSpin((s) => !s)}
            title={autoSpin ? "Pause 360° spin" : "Auto-spin 360°"}
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer ${
              autoSpin
                ? "bg-[#244B3B] text-white"
                : "text-[#141518] hover:bg-[#F1F2F5]"
            }`}
          >
            {autoSpin ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            Spin
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(0.14)}
            title={`Zoom in (${Math.round(zoomLevel * 100)}%)`}
            className="p-1 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => adjustZoom(-0.14)}
            title="Zoom out"
            className="p-1 rounded-full hover:bg-[#F1F2F5] text-[#141518] cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              camRef.current.pitch = 0.07;
              camRef.current.zoom = 1.0;
              setZoomLevel(1.0);
              jumpToAngle(18);
            }}
            title="Reset 3D camera"
            className="p-1 rounded-full hover:bg-[#F1F2F5] text-[#686D76] hover:text-[#141518] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Subtle Fit Confidence Pill when not overlapping legend */}
      {renderMode !== "heatmap" && (
        <div className="sr-only">
          {fitReport.headlineVerdict}
        </div>
      )}
    </div>
  );
}

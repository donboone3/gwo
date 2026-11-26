"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Columns2,
  Eye,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
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
  companionProducts?: Product[];
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
  initialAngleMode?: "front" | "back" | "split" | "spin";
  compactHeightClass?: string;
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
  if (status === "too_tight") return "#DC2626";
  if (status === "sculpted_snug") return "#D97706";
  if (status === "tailored_ideal") return "#15803D";
  return "#2563EB";
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
  companionProducts,
  selectedSize,
  fitReport,
  avatar,
  initialAngleMode = "front",
  compactHeightClass,
}: Parametric3DFitMockProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [renderMode, setRenderMode] = useState<MockRenderMode>("fabric");
  const [splitFrontBack, setSplitFrontBack] = useState<boolean>(
    initialAngleMode === "split"
  );
  const [autoSpin, setAutoSpin] = useState<boolean>(
    initialAngleMode === "spin"
  );
  const [yawDegDisplay, setYawDegDisplay] = useState<number>(
    initialAngleMode === "back" ? 180 : initialAngleMode === "split" ? 0 : 14
  );
  const [zoomLevel, setZoomLevel] = useState(1.0);

  const camRef = useRef({
    yaw:
      initialAngleMode === "back"
        ? Math.PI
        : initialAngleMode === "split"
        ? 0
        : (14 * Math.PI) / 180,
    pitch: 0.06,
    zoom: 1.0,
    targetYaw: null as number | null,
    dragging: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    if (initialAngleMode === "split") {
      setSplitFrontBack(true);
      setAutoSpin(false);
      camRef.current.yaw = 0;
      camRef.current.targetYaw = null;
    } else if (initialAngleMode === "back") {
      setSplitFrontBack(false);
      setAutoSpin(false);
      camRef.current.targetYaw = Math.PI;
    } else if (initialAngleMode === "spin") {
      setSplitFrontBack(false);
      setAutoSpin(true);
    } else {
      setSplitFrontBack(false);
      setAutoSpin(false);
      camRef.current.targetYaw = (14 * Math.PI) / 180;
    }
    paintRef.current?.();
  }, [initialAngleMode, product.id]);

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
        companionProducts,
      }),
    [
      avatar.bustInches,
      avatar.heightInches,
      avatar.hipsInches,
      avatar.skinTone,
      avatar.waistInches,
      companionProducts,
      product,
      selectedSize,
    ]
  );

  const isGlossyFabric = useMemo(() => {
    const f = `${product.title} ${product.fitMetadata?.fabricComposition || ""}`.toLowerCase();
    return /silk|satin|metallic|silver|crystal|leather|vinyl|patent/.test(f);
  }, [product]);

  const paintRef = useRef<(() => void) | null>(null);

  const jumpToAngle = useCallback((deg: number) => {
    setSplitFrontBack(false);
    setAutoSpin(false);
    camRef.current.targetYaw = (deg * Math.PI) / 180;
    paintRef.current?.();
  }, []);

  const activateFrontAndBackSplit = useCallback(() => {
    setAutoSpin(false);
    setSplitFrontBack(true);
    camRef.current.yaw = 0;
    camRef.current.targetYaw = null;
    paintRef.current?.();
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    const next = Math.max(
      0.78,
      Math.min(1.5, Number((camRef.current.zoom + delta).toFixed(2)))
    );
    camRef.current.zoom = next;
    setZoomLevel(next);
    paintRef.current?.();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = 560;
    const H_PX = 580;
    const dpr = Math.min(
      2,
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
    );
    if (cv.width !== W * dpr || cv.height !== H_PX * dpr) {
      cv.width = W * dpr;
      cv.height = H_PX * dpr;
    }

    const bodyCenterY = scene.totalHeightInches * 0.515;
    const cameraDist = 114;
    const baseFocal = 880;

    const kLen = Math.hypot(0.42, 0.55, 0.72);
    const Lx = 0.42 / kLen;
    const Ly = 0.55 / kLen;
    const Lz = 0.72 / kLen;

    const projectPointAt = (
      p: Point3D,
      cxScreen: number,
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
        sx: cxScreen + x1 * s,
        sy: H_PX * 0.525 - y2 * s,
      };
    };

    let lastYawBadge = -999;

    const renderAvatarPass = (
      cxScreen: number,
      yawRad: number,
      focalScale: number,
      showSideCallouts: boolean,
      pedestalBanner?: string
    ) => {
      const { pitch, zoom } = camRef.current;
      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const cosP = Math.cos(pitch);
      const sinP = Math.sin(pitch);
      const focal = baseFocal * zoom * focalScale;

      // Pedestal Rings & Soft Shadow
      for (const rIn of [7.2, 10.8]) {
        ctx.beginPath();
        for (let j = 0; j <= 36; j++) {
          const u = (j / 36) * Math.PI * 2;
          const pt = projectPointAt(
            { x: Math.cos(u) * rIn, y: 2.6, z: Math.sin(u) * rIn },
            cxScreen,
            cosY,
            sinY,
            cosP,
            sinP,
            focal
          );
          if (j === 0) ctx.moveTo(pt.sx, pt.sy);
          else ctx.lineTo(pt.sx, pt.sy);
        }
        ctx.strokeStyle =
          rIn < 9 ? "rgba(20,21,24,0.14)" : "rgba(20,21,24,0.07)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      const floorOrigin = projectPointAt(
        { x: 0, y: 2.6, z: 0 },
        cxScreen,
        cosY,
        sinY,
        cosP,
        sinP,
        focal
      );
      const shRad = 74 * zoom * focalScale;
      const shGrad = ctx.createRadialGradient(
        floorOrigin.sx,
        floorOrigin.sy,
        5,
        floorOrigin.sx,
        floorOrigin.sy,
        shRad
      );
      shGrad.addColorStop(0, "rgba(20,24,32,0.22)");
      shGrad.addColorStop(1, "rgba(20,24,32,0)");
      ctx.fillStyle = shGrad;
      ctx.beginPath();
      ctx.ellipse(
        floorOrigin.sx,
        floorOrigin.sy,
        shRad,
        17 * zoom * focalScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      interface ProjectedQuad {
        q0: ReturnType<typeof projectPointAt>;
        q1: ReturnType<typeof projectPointAt>;
        q2: ReturnType<typeof projectPointAt>;
        q3: ReturnType<typeof projectPointAt>;
        depthZ: number;
        fillStyle: string;
        strokeStyle: string | null;
        alpha: number;
        layer: "body" | "garment" | "detail";
      }

      const drawList: ProjectedQuad[] = [];
      let bodyMaxRightSx = cxScreen + 44 * focalScale;
      let bodyMinLeftSx = cxScreen - 44 * focalScale;

      for (let i = 0; i < scene.quads.length; i++) {
        const q = scene.quads[i];
        const q0 = projectPointAt(q.p0, cxScreen, cosY, sinY, cosP, sinP, focal);
        const q1 = projectPointAt(q.p1, cxScreen, cosY, sinY, cosP, sinP, focal);
        const q2 = projectPointAt(q.p2, cxScreen, cosY, sinY, cosP, sinP, focal);
        const q3 = projectPointAt(q.p3, cxScreen, cosY, sinY, cosP, sinP, focal);

        const maxQx = Math.max(q0.sx, q1.sx, q2.sx, q3.sx);
        const minQx = Math.min(q0.sx, q1.sx, q2.sx, q3.sx);
        if (maxQx > bodyMaxRightSx) bodyMaxRightSx = maxQx;
        if (minQx < bodyMinLeftSx) bodyMinLeftSx = minQx;

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

        if (q.layer === "body" && nz < -0.15) continue;
        if (q.layer !== "body" && nz < 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        const ndotl = Math.max(0, nx * Lx + ny * Ly + nz * Lz);
        const rim = Math.pow(1 - Math.max(0, nz), 2.4) * 0.18;
        const specPower = isGlossyFabric && q.layer !== "body" ? 22 : 12;
        const specStrength =
          isGlossyFabric && q.layer !== "body" ? 0.26 : 0.09;
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
          ctx.lineWidth = frontHalf ? 1.8 : 1.0;
          ctx.globalAlpha = frontHalf ? 0.9 : 0.24;
          if (!frontHalf) ctx.setLineDash([4, 4]);

          for (let j = 0; j < ring.points.length - 1; j++) {
            const a = projectPointAt(
              ring.points[j],
              cxScreen,
              cosY,
              sinY,
              cosP,
              sinP,
              focal
            );
            const b = projectPointAt(
              ring.points[j + 1],
              cxScreen,
              cosY,
              sinY,
              cosP,
              sinP,
              focal
            );
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

      drawCaliperHalf(true);

      if (pedestalBanner) {
        ctx.save();
        ctx.font = "700 10.5px 'Plus Jakarta Sans', system-ui, sans-serif";
        const tw = ctx.measureText(pedestalBanner).width;
        const bx = cxScreen - (tw + 20) / 2;
        const by = 14;
        ctx.fillStyle = "rgba(20, 21, 24, 0.88)";
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 20, 22, 11);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(pedestalBanner, bx + 10, by + 14.5);
        ctx.restore();
      }

      if (showSideCallouts) {
        ctx.font = "700 10px 'Plus Jakarta Sans', system-ui, sans-serif";
        for (const ring of scene.caliperRings) {
          let bestPt = projectPointAt(
            ring.points[0],
            cxScreen,
            cosY,
            sinY,
            cosP,
            sinP,
            focal
          );
          for (let j = 1; j < ring.points.length; j++) {
            const cand = projectPointAt(
              ring.points[j],
              cxScreen,
              cosY,
              sinY,
              cosP,
              sinP,
              focal
            );
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
          const safeLeft = Math.max(bestPt.sx + 14, bodyMaxRightSx + 10);
          const px = Math.min(W - tw - 12, safeLeft);
          const py = Math.max(20, Math.min(H_PX - 20, bestPt.sy));

          ctx.strokeStyle = pillFg;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(bestPt.sx + 2, bestPt.sy);
          ctx.lineTo(px - 6, py);
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

        if (scene.storeModelRelativeHemYInches !== undefined) {
          const modelHemPt = projectPointAt(
            { x: -5.8, y: scene.storeModelRelativeHemYInches, z: 0 },
            cxScreen,
            cosY,
            sinY,
            cosP,
            sinP,
            focal
          );
          const custHemPt = projectPointAt(
            { x: -5.8, y: scene.customerHemYInches, z: 0 },
            cxScreen,
            cosY,
            sinY,
            cosP,
            sinP,
            focal
          );

          const lineEnd = Math.max(
            126,
            Math.min(bodyMinLeftSx - 4, modelHemPt.sx)
          );

          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = "#686D76";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(12, modelHemPt.sy);
          ctx.lineTo(lineEnd, modelHemPt.sy);
          ctx.stroke();

          ctx.fillStyle = "rgba(255,255,255,0.94)";
          ctx.beginPath();
          ctx.roundRect(10, modelHemPt.sy - 19, 118, 17, 8);
          ctx.fill();
          ctx.fillStyle = "#5C6068";
          ctx.font = "600 9.5px 'Plus Jakarta Sans', system-ui, sans-serif";
          ctx.fillText(
            `Model Hem (${product.fitMetadata?.modelStats?.wornSize || "XS"})`,
            16,
            modelHemPt.sy - 7
          );

          ctx.setLineDash([]);
          ctx.strokeStyle = "#244B3B";
          ctx.beginPath();
          ctx.moveTo(12, custHemPt.sy);
          ctx.lineTo(lineEnd, custHemPt.sy);
          ctx.stroke();

          const ft = Math.floor(avatar.heightInches / 12);
          const inch = Math.round(avatar.heightInches % 12);
          ctx.fillStyle = "#141518";
          ctx.beginPath();
          ctx.roundRect(10, custHemPt.sy + 2, 114, 18, 8);
          ctx.fill();
          ctx.fillStyle = "#FFFFFF";
          ctx.font = "700 9.5px 'Plus Jakarta Sans', system-ui, sans-serif";
          ctx.fillText(`Your ${ft}'${inch}" Hem`, 16, custHemPt.sy + 14);
          ctx.restore();
        }
      }
    };

    const drawScene = () => {
      const { yaw } = camRef.current;
      const normDeg = ((Math.round((yaw * 180) / Math.PI) % 360) + 360) % 360;
      if (Math.abs(normDeg - lastYawBadge) >= 2) {
        lastYawBadge = normDeg;
        setYawDegDisplay(normDeg);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, H_PX);
      bgGrad.addColorStop(0, "#F8F9FB");
      bgGrad.addColorStop(0.68, "#EEF1F6");
      bgGrad.addColorStop(1, "#E3E7EF");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H_PX);

      if (splitFrontBack) {
        const frontDeg = normDeg;
        const backDeg = (normDeg + 180) % 360;
        renderAvatarPass(
          W * 0.265,
          yaw,
          0.86,
          false,
          `FRONT LOOK (${String(frontDeg).padStart(3, "0")}°)`
        );

        // Clean center studio divider
        ctx.save();
        ctx.strokeStyle = "rgba(20, 21, 24, 0.09)";
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(W * 0.5, 16);
        ctx.lineTo(W * 0.5, H_PX - 16);
        ctx.stroke();
        ctx.restore();

        renderAvatarPass(
          W * 0.735,
          yaw + Math.PI,
          0.86,
          false,
          `BACK LOOK (${String(backDeg).padStart(3, "0")}°)`
        );
      } else {
        const angleTag =
          normDeg >= 135 && normDeg <= 225
            ? `BACK LOOK (${String(normDeg).padStart(3, "0")}°)`
            : normDeg <= 45 || normDeg >= 315
            ? `FRONT LOOK (${String(normDeg).padStart(3, "0")}°)`
            : `SIDE PROFILE (${String(normDeg).padStart(3, "0")}°)`;
        renderAvatarPass(W * 0.46, yaw, 1.0, true, angleTag);
      }

      ctx.restore();
    };

    paintRef.current = drawScene;
    drawScene();

    let rafId = 0;
    let lastNow = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastNow) / 1000);
      lastNow = now;
      let needsMore = false;

      if (camRef.current.targetYaw !== null) {
        const diff = camRef.current.targetYaw - camRef.current.yaw;
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
  }, [
    autoSpin,
    avatar.heightInches,
    isGlossyFabric,
    product,
    renderMode,
    scene,
    splitFrontBack,
  ]);

  const isBackActive =
    !splitFrontBack && yawDegDisplay >= 135 && yawDegDisplay <= 225;
  const isFrontActive =
    !splitFrontBack && (yawDegDisplay <= 45 || yawDegDisplay >= 315);
  const isSideActive = !splitFrontBack && !isFrontActive && !isBackActive;

  return (
    <div
      className={`w-full ${
        compactHeightClass || "h-[460px] lg:h-auto lg:flex-1 lg:min-h-0"
      } rounded-3xl bg-white border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.08)] overflow-hidden flex flex-col justify-between select-none`}
    >
      {/* Dedicated Top Bar OUTSIDE Canvas (Zero Model-Head Overlap!) */}
      <div className="shrink-0 px-3 py-2 bg-white border-b border-black/[0.06] flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1 p-0.5 rounded-full bg-[#F1F2F5] border border-black/[0.05]">
          <button
            type="button"
            id="gwo-3d-mode-fabric"
            onClick={() => setRenderMode("fabric")}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
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
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
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
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
              renderMode === "xray"
                ? "bg-[#141518] text-white"
                : "text-[#686D76] hover:text-[#141518]"
            }`}
          >
            <Eye className="w-3 h-3 text-[#60A5FA]" /> X-Ray Ease
          </button>
        </div>

        <span className="px-2.5 py-1 rounded-full bg-[#141518] text-white text-[11px] font-bold">
          {splitFrontBack
            ? `Size ${selectedSize} • Front 0° + Back 180°`
            : `Size ${selectedSize} • ${String(yawDegDisplay).padStart(3, "0")}°`}
        </span>
      </div>

      {/* Pure Unobstructed Middle 3D Canvas */}
      <div className="relative flex-1 min-h-0 w-full bg-[#EEF1F6] flex items-center justify-center overflow-hidden">
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
      </div>

      {/* Dedicated Bottom Dock OUTSIDE Canvas (Always-Visible Front, Back, Front+Back, & 360° Spin!) */}
      <div className="shrink-0 px-3 py-2 bg-white border-t border-black/[0.06] space-y-1.5">
        {renderMode === "heatmap" ? (
          <div className="flex flex-wrap items-center justify-center gap-3 pb-1 border-b border-black/[0.05] text-[10.5px] font-bold">
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
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-black/[0.05] text-[10.5px] text-[#5C6068]">
            <span className="truncate">
              <strong className="text-[#141518]">Front:</strong>{" "}
              {scene.frontFeatureSummary}
            </span>
            <span className="truncate">
              <strong className="text-[#244B3B]">Back:</strong>{" "}
              {scene.backFeatureSummary}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              id="gwo-3d-angle-front"
              onClick={() => jumpToAngle(0)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition ${
                isFrontActive
                  ? "bg-[#141518] text-white"
                  : "bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518]"
              }`}
            >
              Front 0°
            </button>
            <button
              type="button"
              id="gwo-3d-angle-back"
              onClick={() => jumpToAngle(180)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition ${
                isBackActive
                  ? "bg-[#141518] text-white"
                  : "bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518]"
              }`}
            >
              {scene.hasCorsetBack ? "Corset Back 180°" : "Back 180°"}
            </button>
            <button
              type="button"
              id="gwo-3d-angle-split"
              onClick={activateFrontAndBackSplit}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition ${
                splitFrontBack
                  ? "bg-[#244B3B] text-white"
                  : "bg-[#EBF3EE] hover:bg-[#DCECE3] text-[#1D4232]"
              }`}
            >
              <Columns2 className="w-3 h-3" /> Front + Back
            </button>
            <button
              type="button"
              id="gwo-3d-angle-side"
              onClick={() => jumpToAngle(90)}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold cursor-pointer transition ${
                isSideActive
                  ? "bg-[#141518] text-white"
                  : "bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518]"
              }`}
            >
              Side 90°
            </button>
          </div>

          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              id="gwo-3d-spin-toggle"
              onClick={() => {
                setSplitFrontBack(false);
                setAutoSpin((s) => !s);
              }}
              title={autoSpin ? "Pause 360° spin" : "Auto-spin 360°"}
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                autoSpin
                  ? "bg-[#244B3B] text-white"
                  : "bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518]"
              }`}
            >
              {autoSpin ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              360° Spin
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(0.12)}
              title={`Zoom in (${Math.round(zoomLevel * 100)}%)`}
              aria-label="Zoom in"
              className="p-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518] cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => adjustZoom(-0.12)}
              title="Zoom out"
              aria-label="Zoom out"
              className="p-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#141518] cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                camRef.current.pitch = 0.06;
                camRef.current.zoom = 1.0;
                setZoomLevel(1.0);
                jumpToAngle(14);
              }}
              title="Reset 3D camera"
              aria-label="Reset 3D camera"
              className="p-1.5 rounded-full bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#686D76] hover:text-[#141518] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <span className="sr-only">{fitReport.headlineVerdict}</span>
    </div>
  );
}

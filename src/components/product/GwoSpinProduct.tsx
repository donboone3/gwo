"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  HeartHandshake,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import "./spin-product.css";
import { useGwo } from "@/context/GwoAppContext";

const TURNTABLE_MP4 =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261107_112151_ae5c9a8f-07da-4b83-8dd8-47c762a5dfc0.mp4";

const FRAME_COUNT = 64;
const STAGE_W = 540;
const STAGE_H = 900;

// Session-persistent cache so revisiting /product is 0ms instant with zero re-decode!
let SESSION_FRAMES: Array<ImageBitmap | null> | null = null;
let SESSION_BG_RGB: string | null = null;
let SESSION_FRONT_DATA_URL = "";
let SESSION_BACK_READY = false;

const HOTSPOTS = [
  {
    x: 0.47,
    y: 0.22,
    title: "Two-way zip collar",
    text: "Sculpted two-way zip up to a cozy stand collar that blocks wind without feeling stiff.",
  },
  {
    x: 0.38,
    y: 0.29,
    title: "Contour finish",
    text: "Subtle tonal topographic weave with soft matte-silver sheen.",
  },
  {
    x: 0.63,
    y: 0.39,
    title: "Fleece pockets",
    text: "Deep fleece-lined pockets angled naturally at waist height.",
  },
];

const DETAILS_ACCORDION = [
  {
    id: "Fit & Details",
    text: "Relaxed, slightly cropped silhouette designed to hit cleanly at high-waisted jeans or leggings. Stand collar, two-way zip, and fleece-lined pockets.",
  },
  {
    id: "Materials & Care",
    text: "100% recycled ripstop shell with lightweight 80/20 recycled down fill. Machine wash cold, tumble dry low.",
  },
  {
    id: "Shipping & Free Returns",
    text: "Arrives in 3–4 business days. Free 30-day exchanges and returns.",
  },
];

const SIZES = ["XS", "S", "M", "L"] as const;

const wrap1 = (a: number) => ((a % 1) + 1) % 1;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const rawName = searchParams.get("name") || "Contour Metallic Cropped Puffer";
  const rawPriceStr = searchParams.get("price") || "$168";
  const parsedPrice = Number(rawPriceStr.replace(/[^0-9.]/g, "")) || 168;

  const { addToBag, showToast, customAvatar, setAvatarModalOpen } = useGwo();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const vidPosterRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const userFaceRef = useRef<HTMLImageElement | null>(null);
  const degDotRef = useRef<HTMLSpanElement | null>(null);
  const degNumRef = useRef<HTMLSpanElement | null>(null);
  const frontThumbRef = useRef<HTMLCanvasElement | null>(null);
  const backThumbRef = useRef<HTMLCanvasElement | null>(null);
  const addBagBtnRef = useRef<HTMLButtonElement | null>(null);

  const kScaleRef = useRef(1);
  const spinToFnRef = useRef<((targetAng: number) => void) | null>(null);

  const [openSection, setOpenSection] = useState<string>("Fit & Details");
  const [selectedSize, setSelectedSize] = useState<(typeof SIZES)[number]>("S");
  const [savedToCloset, setSavedToCloset] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const [facingFront, setFacingFront] = useState(true);
  const [activeThumb, setActiveThumb] = useState<"front" | "back">("front");
  const [isDraggingUi, setIsDraggingUi] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(Boolean(SESSION_FRAMES?.[0]));

  // Auto-scale 1500x920 board inside calc(100svh - 64px)
  useEffect(() => {
    const applyBoardScale = () => {
      const art = artRef.current;
      const root = rootRef.current;
      if (!art || !root) return;
      const rw = root.clientWidth || window.innerWidth;
      const rh = root.clientHeight || window.innerHeight - 64;
      const K = Math.min(rw / 1500, rh / 920);
      kScaleRef.current = K;
      art.style.left = `${rw / 2}px`;
      art.style.top = `${rh / 2}px`;
      art.style.transform = `scale(${K}) translate(-750px, -460px)`;
    };
    applyBoardScale();
    window.addEventListener("resize", applyBoardScale);
    return () => window.removeEventListener("resize", applyBoardScale);
  }, []);

  // Zero-Lag 64-Frame Session-Cached ImageBitmap Turntable + Drag-Priority Yielding
  useEffect(() => {
    const cv = cvRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!cv || !stage || !root) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    let frames: Array<ImageBitmap | null> =
      SESSION_FRAMES || new Array(FRAME_COUNT).fill(null);
    SESSION_FRAMES = frames;

    let ang = 0;
    let vel = 0;
    let idle = 0;
    let dragging = false;
    let lastX = 0;
    let lastMoveTime = 0;
    let estV = 0;

    let tween: {
      startAng: number;
      delta: number;
      startTime: number;
      duration: number;
    } | null = null;

    let paintedFrame = -1;

    const drawLookThumbnail = (
      thumbCanvas: HTMLCanvasElement | null,
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      captureDataUrl = false
    ) => {
      if (!thumbCanvas) return;
      const tctx = thumbCanvas.getContext("2d");
      if (!tctx) return;
      const side = srcW * 0.62;
      const sx = (srcW - side) / 2;
      const sy = srcH * 0.06;
      tctx.clearRect(0, 0, 96, 96);
      tctx.drawImage(source, sx, sy, side, side, 0, 0, 96, 96);
      if (captureDataUrl) {
        try {
          SESSION_FRONT_DATA_URL = thumbCanvas.toDataURL("image/jpeg", 0.85);
        } catch {
          // Ignore
        }
      }
    };

    const findNearestBitmap = (
      targetIdx: number
    ): { idx: number; bmp: ImageBitmap } | null => {
      if (frames[targetIdx]) return { idx: targetIdx, bmp: frames[targetIdx]! };
      for (let dist = 1; dist <= FRAME_COUNT / 2; dist++) {
        const fwd = (targetIdx + dist) % FRAME_COUNT;
        if (frames[fwd]) return { idx: fwd, bmp: frames[fwd]! };
        const bwd = (targetIdx - dist + FRAME_COUNT) % FRAME_COUNT;
        if (frames[bwd]) return { idx: bwd, bmp: frames[bwd]! };
      }
      return null;
    };

    const updateFaceOverlayTransform = (norm: number) => {
      const faceEl = userFaceRef.current;
      if (!faceEl) return;
      // Signed turn in [-0.5 .. +0.5] around front 0°
      const signedTurn = norm > 0.5 ? norm - 1 : norm;
      const absTurn = Math.abs(signedTurn);
      if (absTurn > 0.13) {
        faceEl.style.opacity = "0";
        return;
      }
      const theta = signedTurn * Math.PI * 2;
      const cosT = Math.max(0.25, Math.cos(theta));
      const shiftPx = -Math.sin(theta) * 16;
      const fade = Math.pow(Math.max(0, 1 - absTurn / 0.13), 1.35);
      faceEl.style.opacity = fade.toFixed(3);
      faceEl.style.transform = `translate3d(calc(-50% + ${shiftPx.toFixed(
        1
      )}px), -50%, 0) scaleX(${cosT.toFixed(3)})`;
    };

    const showFrame = (a: number) => {
      const norm = wrap1(a);
      updateFaceOverlayTransform(norm);

      const targetIdx = ((Math.round(norm * FRAME_COUNT) % FRAME_COUNT) + FRAME_COUNT) % FRAME_COUNT;
      const hit = findNearestBitmap(targetIdx);
      if (!hit || hit.idx === paintedFrame) return;
      ctx.drawImage(hit.bmp, 0, 0, STAGE_W, STAGE_H);
      paintedFrame = hit.idx;
    };

    // Restore cached background + thumbnails immediately if returning to /product
    if (SESSION_BG_RGB) {
      root.style.setProperty("--bg", SESSION_BG_RGB);
    }
    if (frames[0]) {
      drawLookThumbnail(frontThumbRef.current, frames[0], STAGE_W, STAGE_H, false);
      showFrame(0);
    }
    if (frames[FRAME_COUNT / 2] && SESSION_BACK_READY) {
      drawLookThumbnail(
        backThumbRef.current,
        frames[FRAME_COUNT / 2]!,
        STAGE_W,
        STAGE_H,
        false
      );
    }

    const buildFrameCache = async () => {
      // Skip network fetch if all frames are already cached in memory
      if (frames.every(Boolean)) return;

      let objectUrl = "";
      try {
        const resp = await fetch(TURNTABLE_MP4, { mode: "cors" });
        const mp4Blob = await resp.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(mp4Blob);

        const extractor = document.createElement("video");
        extractor.muted = true;
        extractor.playsInline = true;
        extractor.preload = "auto";
        extractor.src = objectUrl;

        await new Promise<void>((resolve, reject) => {
          extractor.addEventListener("loadeddata", () => resolve(), { once: true });
          extractor.addEventListener("error", () => reject(new Error("video error")), {
            once: true,
          });
        });
        if (cancelled) return;

        // Pre-crop directly into exact 540x900 stage dimensions once so drawImage is 1:1 ultra-fast!
        const offCv = document.createElement("canvas");
        offCv.width = STAGE_W;
        offCv.height = STAGE_H;
        const offCtx = offCv.getContext("2d", { alpha: false });
        if (!offCtx) return;

        const vw = extractor.videoWidth || 732;
        const vh = extractor.videoHeight || 1296;
        const coverScale = Math.max(STAGE_W / vw, STAGE_H / vh);
        const drawW = vw * coverScale;
        const drawH = vh * coverScale;
        const drawX = (STAGE_W - drawW) / 2;
        const drawY = (STAGE_H - drawH) / 2;

        const seekAndGrab = async (index: number) => {
          if (frames[index]) return;
          const t =
            (index / FRAME_COUNT) * Math.max(0.1, extractor.duration - 0.04);
          extractor.currentTime = t;
          await new Promise<void>((res) => {
            extractor.addEventListener("seeked", () => res(), { once: true });
          });
          offCtx.drawImage(extractor, drawX, drawY, drawW, drawH);
          frames[index] = await createImageBitmap(offCv);
        };

        // 1. Grab Front (0°) immediately
        if (!frames[0]) {
          await seekAndGrab(0);
          if (cancelled) return;
          const px = offCtx.getImageData(6, 6, 1, 1).data;
          SESSION_BG_RGB = `rgb(${px[0]}, ${px[1]}, ${px[2]})`;
          root.style.setProperty("--bg", SESSION_BG_RGB);
          drawLookThumbnail(frontThumbRef.current, offCv, STAGE_W, STAGE_H, true);
          paintedFrame = -1;
          showFrame(ang);
          setFirstFrameReady(true);
          if (vidPosterRef.current) {
            vidPosterRef.current.style.display = "none";
          }
        }

        // 2. Grab Back (180°) second
        const midIdx = FRAME_COUNT / 2;
        if (!frames[midIdx]) {
          await seekAndGrab(midIdx);
          if (cancelled) return;
          SESSION_BACK_READY = true;
          drawLookThumbnail(backThumbRef.current, offCv, STAGE_W, STAGE_H, false);
          paintedFrame = -1;
          showFrame(ang);
        }

        // 3. Coarse-to-fine remaining frames, yielding whenever user drags so UI is 100% lag-free!
        const order: number[] = [
          16, 48, 8, 24, 40, 56, 4, 12, 20, 28, 36, 44, 52, 60,
        ];
        for (let i = 1; i < FRAME_COUNT; i++) {
          if (!order.includes(i) && i !== midIdx) order.push(i);
        }

        for (const idx of order) {
          if (cancelled) return;
          // Pause background decode while user is actively dragging or coasting fast!
          while (!cancelled && (dragging || Math.abs(vel) > 0.12)) {
            await new Promise((r) => setTimeout(r, 60));
          }
          if (cancelled) return;
          if (!frames[idx]) {
            await seekAndGrab(idx);
            paintedFrame = -1;
            showFrame(ang);
            // Yield main thread between decodes for silky 60/120fps responsiveness
            await new Promise((r) => setTimeout(r, 22));
          }
        }
      } catch {
        // Ignore network interruption
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    };

    void buildFrameCache();

    const spinTo = (targetA: number) => {
      const curr = wrap1(ang);
      let delta = wrap1(targetA) - curr;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      vel = 0;
      idle = 0;
      tween = {
        startAng: curr,
        delta,
        startTime: performance.now(),
        duration: 750 + Math.abs(delta) * 750,
      };
    };
    spinToFnRef.current = spinTo;

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest(".sp-hs")) return;
      dragging = true;
      setIsDraggingUi(true);
      tween = null;
      vel = 0;
      estV = 0;
      idle = 0;
      lastX = e.clientX;
      lastMoveTime = performance.now();
      stage.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      idle = 0;
      if (!dragging) return;
      const now = performance.now();
      const dx = e.clientX - lastX;
      const dtMs = Math.max(8, now - lastMoveTime);
      lastX = e.clientX;
      lastMoveTime = now;

      const dAng = -dx / kScaleRef.current / 820;
      ang = wrap1(ang + dAng);
      estV = ((dAng / dtMs) * 1000) * 0.6 + estV * 0.4;
      showFrame(ang);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDraggingUi(false);
      vel = clamp(estV, -2.2, 2.2);
      idle = 0;
    };

    const resetIdle = () => {
      if (!dragging) idle = 0;
    };

    stage.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("pointermove", resetIdle, { passive: true });

    let lastTick = performance.now();
    let rafId = 0;
    let prevFront = true;
    let prevDeg = -1;
    let prevThumb: "front" | "back" = "front";

    const tick = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      if (tween) {
        const t = clamp((now - tween.startTime) / tween.duration, 0, 1);
        ang = wrap1(tween.startAng + tween.delta * easeInOutCubic(t));
        if (t >= 1) tween = null;
        showFrame(ang);
      } else if (!dragging) {
        idle += dtSec;
        const targetSpeed = idle > 3.2 ? 0.04 : 0;
        const easeRate = idle > 3.2 ? dtSec * 0.8 : dtSec * 2.4;
        vel += (targetSpeed - vel) * Math.min(1, easeRate);
        if (Math.abs(vel) > 0.00005) {
          ang = wrap1(ang + vel * dtSec);
          showFrame(ang);
        }
      }

      const norm = wrap1(ang);
      const deg = Math.round(norm * 360) % 360;
      // Direct DOM update (ZERO React re-renders during spin/drag!)
      if (deg !== prevDeg) {
        prevDeg = deg;
        if (degNumRef.current) {
          degNumRef.current.textContent = `${String(deg).padStart(3, "0")}°`;
        }
        if (degDotRef.current) {
          degDotRef.current.style.left = `${(norm * 100).toFixed(1)}%`;
        }
      }

      const nextFront =
        (norm <= 0.035 || norm >= 0.965) &&
        !dragging &&
        !tween &&
        Math.abs(vel) < 0.02;
      if (nextFront !== prevFront) {
        prevFront = nextFront;
        setFacingFront(nextFront);
      }

      const nextThumb: "front" | "back" =
        norm < 0.25 || norm >= 0.75 ? "front" : "back";
      if (nextThumb !== prevThumb) {
        prevThumb = nextThumb;
        setActiveThumb(nextThumb);
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stage.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("pointermove", resetIdle);
    };
  }, []);

  // Fly thumbnail arc directly into the Unified GWO Top-Right Bag button!
  const handleAddToBag = useCallback(() => {
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1600);

    const btn = addBagBtnRef.current;
    const bagBtn = document.getElementById("gwo-unified-bag-btn");
    if (btn && bagBtn) {
      const bRect = btn.getBoundingClientRect();
      const bagRect = bagBtn.getBoundingClientRect();

      const startX = bRect.left + bRect.width / 2 - 28;
      const startY = bRect.top + bRect.height / 2 - 36;
      const endX = bagRect.left + bagRect.width / 2 - 28;
      const endY = bagRect.top + bagRect.height / 2 - 36;
      const midX = (startX + endX) / 2 - 35;
      const midY = Math.min(startY, endY) - 110;

      const flyer = document.createElement("div");
      flyer.style.position = "fixed";
      flyer.style.left = "0px";
      flyer.style.top = "0px";
      flyer.style.width = "56px";
      flyer.style.height = "72px";
      flyer.style.borderRadius = "12px";
      flyer.style.background = "#ffffff";
      flyer.style.padding = "3px";
      flyer.style.boxShadow = "0 12px 28px rgba(0,0,0,0.18)";
      flyer.style.zIndex = "9999";
      flyer.style.pointerEvents = "none";

      const thumbSrc = customAvatar?.badgeDataUrl || SESSION_FRONT_DATA_URL;
      if (thumbSrc) {
        const inner = document.createElement("div");
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.borderRadius = "9px";
        inner.style.background = `url("${thumbSrc}") center / cover no-repeat`;
        flyer.appendChild(inner);
      }

      document.body.appendChild(flyer);
      flyer.animate(
        [
          {
            transform: `translate(${startX}px, ${startY}px) scale(1) rotate(0deg)`,
            opacity: 1,
          },
          {
            transform: `translate(${midX}px, ${midY}px) scale(0.8) rotate(-8deg)`,
            opacity: 1,
            offset: 0.5,
          },
          {
            transform: `translate(${endX}px, ${endY}px) scale(0.2) rotate(-14deg)`,
            opacity: 0.7,
          },
        ],
        {
          duration: 780,
          easing: "cubic-bezier(0.5, 0, 0.3, 1)",
          fill: "forwards",
        }
      );

      setTimeout(() => flyer.remove(), 800);
    }

    addToBag({
      title: rawName,
      brand: "GWO Studio",
      price: parsedPrice,
      size: selectedSize,
      friendRef: "MAYA-GWO",
    });
  }, [addToBag, customAvatar?.badgeDataUrl, parsedPrice, rawName, selectedSize]);

  return (
    <div className="sp-root" ref={rootRef}>
      <div id="sp-art" ref={artRef}>
        {/* Subtle White Connector Lines when facing front */}
        <svg id="sp-connectors" viewBox="0 0 1500 920">
          <path
            d="M442 350H562L592 318H618"
            stroke="#ffffff"
            strokeWidth="2"
            fill="none"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: facingFront ? 0 : 1,
              transition: facingFront
                ? "stroke-dashoffset 0.7s ease"
                : "stroke-dashoffset 0.35s ease",
            }}
          />
          <path
            d="M1070 520H962L937 428H900"
            stroke="#ffffff"
            strokeWidth="2"
            fill="none"
            pathLength={1}
            style={{
              strokeDasharray: 1,
              strokeDashoffset: facingFront ? 0 : 1,
              transition: facingFront
                ? "stroke-dashoffset 0.7s ease"
                : "stroke-dashoffset 0.35s ease",
            }}
          />
        </svg>

        {/* ==================== CENTER 360° TURNTABLE STAGE ==================== */}
        <div
          id="sp-stage"
          ref={stageRef}
          className={isDraggingUi ? "dragging" : ""}
        >
          {!SESSION_FRAMES?.[0] && (
            <video
              id="sp-vid"
              ref={vidPosterRef}
              src={`${TURNTABLE_MP4}#t=0.01`}
              muted
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              onLoadedData={() => setFirstFrameReady(true)}
            />
          )}
          <canvas id="sp-cv" ref={cvRef} width={STAGE_W} height={STAGE_H} />

          {/* Customer Uploaded Photo Avatar Face Overlay (Foreshortens & Fades Smoothly as 360° Turns!) */}
          {customAvatar && firstFrameReady && (
            <img
              ref={userFaceRef}
              src={customAvatar.faceOvalDataUrl}
              alt="Your photo avatar"
              decoding="async"
              style={{
                position: "absolute",
                left: "51.1%",
                top: "11.35%",
                width: "13.2%",
                height: "9.8%",
                transform: "translate3d(-50%, -50%, 0)",
                willChange: "transform, opacity",
                pointerEvents: "none",
                zIndex: 18,
              }}
            />
          )}

          {/* Front-Facing Tailoring Callout Pins */}
          {HOTSPOTS.map((hs, idx) => (
            <button
              key={hs.title}
              type="button"
              className={`sp-hs ${facingFront ? "show" : ""}`}
              style={{
                left: `${hs.x * 100}%`,
                top: `${hs.y * 100}%`,
                transitionDelay: facingFront ? `${idx * 0.08}s` : "0s",
              }}
              aria-label={hs.title}
            >
              <span>+</span>
              <span className={`sp-tip ${hs.x > 0.5 ? "right" : "left"}`}>
                <span className="sp-tip-title">{hs.title}</span>
                {hs.text}
              </span>
            </button>
          ))}
        </div>

        {/* Bottom 360° Degree Pill (Direct DOM Ref Updates -> Zero React Re-render Lag!) */}
        <div id="sp-deg">
          <span>DRAG MODEL TO SPIN 360°</span>
          <span className="sp-deg-bar">
            <span ref={degDotRef} className="sp-deg-dot" style={{ left: "0%" }} />
          </span>
          <span ref={degNumRef} className="sp-deg-num">
            000°
          </span>
        </div>

        {/* ==================== LEFT CLEAN GWO PRODUCT DETAILS CARD ==================== */}
        <section
          style={{
            position: "absolute",
            left: 28,
            top: 84,
            width: 414,
            zIndex: 20,
          }}
          className="rounded-3xl bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#686D76] hover:text-[#141518]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Closet
            </Link>

            <button
              type="button"
              onClick={() => setAvatarModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F4F8F5] hover:bg-[#E7F1EB] border border-[#CBE2D4] text-[11px] font-bold text-[#1D4232] cursor-pointer"
            >
              {customAvatar ? (
                <>
                  <img
                    src={customAvatar.badgeDataUrl}
                    alt="You"
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                  Viewing as You ✓
                </>
              ) : (
                <>
                  <Camera className="w-3 h-3" /> Use My Photo
                </>
              )}
            </button>
          </div>

          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#E7F3EE] text-[#244B3B]">
              <Sparkles className="w-3 h-3" /> 360° Real-Fit Inspection
            </span>
            <h1 className="text-xl font-bold text-[#141518] mt-2 leading-snug">
              {rawName}
            </h1>
            <p className="text-lg font-bold text-[#141518] mt-1">
              ${parsedPrice}
            </p>
          </div>

          {/* Body-Twin Friend Verdict */}
          <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                <HeartHandshake className="w-3.5 h-3.5 text-[#244B3B]" /> Friend Fit Note
              </span>
              <span className="text-[11px] font-bold text-[#244B3B]">
                97% Body Twin
              </span>
            </div>
            <p className="text-xs text-[#686D76] leading-relaxed">
              <strong>@maya</strong> (5&apos;5&quot;, 26.5&quot; waist) owns{" "}
              <strong>Size S</strong>: &ldquo;Boxy cropped drape—take your normal size S so it layers cleanly over hoodies.&rdquo;
            </p>
          </div>

          {/* Clean Collapsible Details */}
          <div className="divide-y divide-black/[0.07] border-t border-b border-black/[0.07]">
            {DETAILS_ACCORDION.map((row) => {
              const open = openSection === row.id;
              return (
                <div key={row.id}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(open ? "" : row.id)}
                    className="w-full py-3 flex items-center justify-between text-xs font-bold text-[#141518] cursor-pointer"
                  >
                    <span>{row.id}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#686D76] transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {open && (
                    <p className="pb-3.5 text-xs text-[#686D76] leading-relaxed">
                      {row.text}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Front / Back Quick Angle Switcher */}
          <div className="flex items-center gap-3 pt-1">
            <span className="text-xs font-semibold text-[#686D76]">
              Quick Angle:
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveThumb("front");
                spinToFnRef.current?.(0);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                activeThumb === "front"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              {customAvatar ? (
                <img
                  src={customAvatar.badgeDataUrl}
                  alt="Front"
                  className="w-7 h-7 rounded-lg object-cover"
                />
              ) : (
                <canvas
                  ref={frontThumbRef}
                  width={96}
                  height={96}
                  className="w-7 h-7 rounded-lg bg-[#E4E6EA]"
                />
              )}
              Front (0°)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveThumb("back");
                spinToFnRef.current?.(0.5);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                activeThumb === "back"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <canvas
                ref={backThumbRef}
                width={96}
                height={96}
                className="w-7 h-7 rounded-lg bg-[#E4E6EA]"
              />
              Back (180°)
            </button>
          </div>
        </section>

        {/* ==================== RIGHT CLEAN GWO SIZE & BAG CARD ==================== */}
        <section
          style={{
            position: "absolute",
            left: 1070,
            top: 250,
            width: 396,
            zIndex: 20,
          }}
          className="rounded-3xl bg-white/92 backdrop-blur-md border border-black/[0.08] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-6 space-y-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#141518]">
              Select Size
            </span>
            <span className="text-xs font-semibold text-[#244B3B]">
              Recommended: Size S
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {SIZES.map((sz) => {
              const active = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSelectedSize(sz)}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    active
                      ? "bg-[#141518] text-white border-[#141518]"
                      : "bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#141518] border-black/[0.06]"
                  }`}
                >
                  {sz}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              id="sp-buy"
              ref={addBagBtnRef}
              onClick={handleAddToBag}
              className="w-full py-3.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              {justAdded ? (
                <>
                  <Check className="w-4 h-4 text-[#A7D7C5]" /> Added to Your Bag!
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" /> Add to Bag • ${parsedPrice}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setSavedToCloset(true);
                showToast(`Saved ${rawName} to Your Closet!`);
              }}
              className={`w-full py-3 rounded-full text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                savedToCloset
                  ? "bg-[#E7F3EE] border-[#244B3B]/20 text-[#244B3B]"
                  : "bg-white hover:bg-[#F7F8FA] border-black/10 text-[#141518]"
              }`}
            >
              {savedToCloset ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved in My Closet
                </>
              ) : (
                "Save to My Public Closet"
              )}
            </button>
          </div>

          <p className="text-[11px] text-[#686D76] text-center">
            Sharing from your closet automatically credits your GWO referral code.
          </p>
        </section>
      </div>
    </div>
  );
}

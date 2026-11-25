"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
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
  const parsedPrice =
    Number(rawPriceStr.replace(/[^0-9.]/g, "")) || 168;

  const { addToBag, showToast } = useGwo();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const frontThumbRef = useRef<HTMLCanvasElement | null>(null);
  const backThumbRef = useRef<HTMLCanvasElement | null>(null);
  const addBagBtnRef = useRef<HTMLButtonElement | null>(null);

  const kScaleRef = useRef(1);
  const spinToFnRef = useRef<((targetAng: number) => void) | null>(null);
  const frontThumbDataUrlRef = useRef<string>("");

  const [openSection, setOpenSection] = useState<string>("Fit & Details");
  const [selectedSize, setSelectedSize] = useState<(typeof SIZES)[number]>("S");
  const [savedToCloset, setSavedToCloset] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const [facingFront, setFacingFront] = useState(true);
  const [activeThumb, setActiveThumb] = useState<"front" | "back">("front");
  const [degDisplay, setDegDisplay] = useState(0);
  const [dotPct, setDotPct] = useState(0);
  const [isDraggingUi, setIsDraggingUi] = useState(false);

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

  // Progressive 360° ImageBitmap Cache + Inertia Physics
  useEffect(() => {
    const vid = vidRef.current;
    const cv = cvRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!vid || !cv || !stage || !root) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    let frames: Array<ImageBitmap | null> = [];
    let NF = 0;
    let framesReady = false;

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

    const drawCover = (
      targetCtx: CanvasRenderingContext2D,
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      dstW: number,
      dstH: number
    ) => {
      const scale = Math.max(dstW / srcW, dstH / srcH);
      const w = srcW * scale;
      const h = srcH * scale;
      const x = (dstW - w) / 2;
      const y = (dstH - h) / 2;
      targetCtx.clearRect(0, 0, dstW, dstH);
      targetCtx.drawImage(source, x, y, w, h);
    };

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
      const sy = srcH * 0.07;
      tctx.clearRect(0, 0, 96, 96);
      tctx.drawImage(source, sx, sy, side, side, 0, 0, 96, 96);
      if (captureDataUrl) {
        try {
          frontThumbDataUrlRef.current = thumbCanvas.toDataURL("image/jpeg", 0.85);
        } catch {
          // Ignore
        }
      }
    };

    const findNearestBitmap = (
      targetIdx: number
    ): { idx: number; bmp: ImageBitmap } | null => {
      if (NF <= 0) return null;
      if (frames[targetIdx]) return { idx: targetIdx, bmp: frames[targetIdx]! };
      for (let dist = 1; dist <= NF / 2; dist++) {
        const fwd = (targetIdx + dist) % NF;
        if (frames[fwd]) return { idx: fwd, bmp: frames[fwd]! };
        const bwd = (targetIdx - dist + NF) % NF;
        if (frames[bwd]) return { idx: bwd, bmp: frames[bwd]! };
      }
      return null;
    };

    const showFrame = (a: number) => {
      if (!framesReady || NF <= 0) return;
      const targetIdx = ((Math.round(a * NF) % NF) + NF) % NF;
      const hit = findNearestBitmap(targetIdx);
      if (!hit || hit.idx === paintedFrame) return;
      drawCover(ctx, hit.bmp, hit.bmp.width, hit.bmp.height, cv.width, cv.height);
      paintedFrame = hit.idx;
    };

    const buildFrameCache = async () => {
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

        const activeCount = 120;
        const offW = Math.min(720, extractor.videoWidth);
        const offH = Math.round((offW * extractor.videoHeight) / extractor.videoWidth);
        const offCv = document.createElement("canvas");
        offCv.width = offW;
        offCv.height = offH;
        const offCtx = offCv.getContext("2d");
        if (!offCtx) return;

        frames = new Array(activeCount).fill(null);
        NF = activeCount;

        const seekAndGrab = async (index: number) => {
          if (frames[index]) return;
          const t =
            (index / activeCount) * Math.max(0.1, extractor.duration - 0.04);
          extractor.currentTime = t;
          await new Promise<void>((res) => {
            extractor.addEventListener("seeked", () => res(), { once: true });
          });
          offCtx.drawImage(extractor, 0, 0, offW, offH);
          frames[index] = await createImageBitmap(offCv);
        };

        await seekAndGrab(0);
        if (cancelled) return;
        const px = offCtx.getImageData(6, 6, 1, 1).data;
        if (px[3] > 0) {
          root.style.setProperty("--bg", `rgb(${px[0]}, ${px[1]}, ${px[2]})`);
        }
        drawLookThumbnail(frontThumbRef.current, offCv, offW, offH, true);
        vid.pause();
        vid.style.display = "none";
        framesReady = true;
        showFrame(ang);

        const midIdx = 60;
        await seekAndGrab(midIdx);
        if (cancelled) return;
        drawLookThumbnail(backThumbRef.current, offCv, offW, offH, false);
        paintedFrame = -1;
        showFrame(ang);

        const priority = [30, 90, 15, 45, 75, 105, 10, 20, 40, 50, 70, 80, 100, 110];
        for (const idx of priority) {
          if (cancelled) return;
          await seekAndGrab(idx);
          paintedFrame = -1;
          showFrame(ang);
        }

        for (let i = 1; i < activeCount; i++) {
          if (cancelled) return;
          if (!frames[i]) await seekAndGrab(i);
        }
        paintedFrame = -1;
        showFrame(ang);
      } catch {
        vid.style.display = "block";
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
        duration: 900 + Math.abs(delta) * 900,
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

      const dAng = -dx / kScaleRef.current / 900;
      ang = wrap1(ang + dAng);
      estV = ((dAng / dtMs) * 1000) * 0.6 + estV * 0.4;
      showFrame(ang);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDraggingUi(false);
      vel = clamp(estV, -2.5, 2.5);
      idle = 0;
    };

    const resetIdle = () => {
      if (!dragging) idle = 0;
    };

    stage.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("pointermove", resetIdle);

    let lastTick = performance.now();
    let rafId = 0;
    let prevFront = true;
    let prevDeg = 0;
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
        const targetSpeed = idle > 3 ? 0.045 : 0;
        const easeRate = idle > 3 ? dtSec * 0.8 : dtSec * 2.2;
        vel += (targetSpeed - vel) * Math.min(1, easeRate);
        if (Math.abs(vel) > 0.00005) {
          ang = wrap1(ang + vel * dtSec);
          showFrame(ang);
        }
      }

      const norm = wrap1(ang);
      const deg = Math.round(norm * 360) % 360;
      if (deg !== prevDeg) {
        prevDeg = deg;
        setDegDisplay(deg);
        setDotPct(norm * 100);
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

      if (frontThumbDataUrlRef.current) {
        const inner = document.createElement("div");
        inner.style.width = "100%";
        inner.style.height = "100%";
        inner.style.borderRadius = "9px";
        inner.style.background = `url("${frontThumbDataUrlRef.current}") center / cover no-repeat`;
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
          duration: 820,
          easing: "cubic-bezier(0.5, 0, 0.3, 1)",
          fill: "forwards",
        }
      );

      setTimeout(() => flyer.remove(), 840);
    }

    addToBag({
      title: rawName,
      brand: "GWO Studio",
      price: parsedPrice,
      size: selectedSize,
      friendRef: "MAYA-GWO",
    });
  }, [addToBag, parsedPrice, rawName, selectedSize]);

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
          <video
            id="sp-vid"
            ref={vidRef}
            src={TURNTABLE_MP4}
            muted
            playsInline
            loop
            autoPlay
            preload="auto"
            crossOrigin="anonymous"
          />
          <canvas id="sp-cv" ref={cvRef} width={1080} height={1920} />

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

        {/* Bottom 360° Degree Pill */}
        <div id="sp-deg">
          <span>DRAG MODEL TO SPIN 360°</span>
          <span className="sp-deg-bar">
            <span className="sp-deg-dot" style={{ left: `${dotPct}%` }} />
          </span>
          <span className="sp-deg-num">
            {String(degDisplay).padStart(3, "0")}°
          </span>
        </div>

        {/* ==================== LEFT CLEAN GWO PRODUCT DETAILS CARD ==================== */}
        <section
          style={{
            position: "absolute",
            left: 28,
            top: 90,
            width: 414,
            zIndex: 20,
          }}
          className="rounded-3xl bg-white/88 backdrop-blur-xl border border-black/[0.08] shadow-[0_18px_45px_rgba(20,21,24,0.08)] p-6 space-y-5"
        >
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#686D76] hover:text-[#141518]"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Closet &amp; Try-On
          </Link>

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
              <canvas
                ref={frontThumbRef}
                width={96}
                height={96}
                className="w-7 h-7 rounded-lg bg-[#E4E6EA]"
              />
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
          className="rounded-3xl bg-white/88 backdrop-blur-xl border border-black/[0.08] shadow-[0_18px_45px_rgba(20,21,24,0.08)] p-6 space-y-5"
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

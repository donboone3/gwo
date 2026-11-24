"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import "./spin-product.css";
import { GwoLogo } from "../brand/GwoLogo";

const TURNTABLE_MP4 =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261107_112151_ae5c9a8f-07da-4b83-8dd8-47c762a5dfc0.mp4";

const HOTSPOTS = [
  {
    x: 0.47,
    y: 0.22,
    title: "Two-way zip",
    text: "Silver two-way zip with a sculpted pull, up to a tall stand collar.",
  },
  {
    x: 0.38,
    y: 0.285,
    title: "Contour print",
    text: "A topographic map printed edge to edge, so every panel shows a different ridge.",
  },
  {
    x: 0.63,
    y: 0.385,
    title: "Hand-warmer pockets",
    text: "Deep fleece-lined pockets set high for hands-in-pockets wear.",
  },
];

const ACCORDION_ROWS = [
  {
    id: "Description",
    text: "Oversized puffer jacket in a liquid-silver ripstop, printed all over with a topographic contour map. Stand collar, two-way zip and deep hand-warmer pockets. Boxy, cropped fit.",
  },
  {
    id: "Materials",
    text: "Shell: 100% recycled nylon with a metallic coating. Fill: 80/20 recycled down. Lining: 100% recycled polyester.",
  },
  {
    id: "Size guide",
    text: "XS/S: chest 124 cm. M/L: chest 132 cm. XL/2XL: chest 140 cm. Cut wide; take your usual size for the intended volume.",
  },
  {
    id: "Packaging",
    text: "Folded into a reusable drawstring sack and shipped in a recycled card box. No plastic.",
  },
  {
    id: "Shipping & returns",
    text: "Pre-orders ship in 4–6 weeks. Free returns within 30 days of delivery.",
  },
];

const SIZES = ["XS/S", "M/L", "XL/2XL"] as const;

const wrap1 = (a: number) => ((a % 1) + 1) % 1;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function GwoSpinProduct() {
  const searchParams = useSearchParams();
  const customTitle = searchParams.get("name");
  const customPrice = searchParams.get("price");

  const rootRef = useRef<HTMLDivElement | null>(null);
  const artRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const vidRef = useRef<HTMLVideoElement | null>(null);
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const frontThumbRef = useRef<HTMLCanvasElement | null>(null);
  const backThumbRef = useRef<HTMLCanvasElement | null>(null);
  const bagPillRef = useRef<HTMLButtonElement | null>(null);
  const preOrderBtnRef = useRef<HTMLButtonElement | null>(null);

  const kScaleRef = useRef(1);
  const spinToFnRef = useRef<((targetAng: number) => void) | null>(null);
  const frontThumbDataUrlRef = useRef<string>("");

  const [openRow, setOpenRow] = useState<string>("Description");
  const [selectedSizeIdx, setSelectedSizeIdx] = useState(1); // M/L default
  const [saved, setSaved] = useState(false);
  const [addedRolling, setAddedRolling] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  const [bagBump, setBagBump] = useState(false);

  const [facingFront, setFacingFront] = useState(true);
  const [activeThumb, setActiveThumb] = useState<"front" | "back">("front");
  const [degDisplay, setDegDisplay] = useState(0);
  const [dotPct, setDotPct] = useState(0);
  const [isDraggingUi, setIsDraggingUi] = useState(false);

  // ==================== 1500x1000 ARTBOARD SCALE ====================
  useEffect(() => {
    const applyBoardScale = () => {
      const art = artRef.current;
      if (!art) return;
      const K = Math.min(window.innerWidth / 1500, window.innerHeight / 1000);
      kScaleRef.current = K;
      art.style.left = `${window.innerWidth / 2}px`;
      art.style.top = `${window.innerHeight / 2}px`;
      art.style.transform = `scale(${K}) translate(-750px, -500px)`;
    };
    applyBoardScale();
    window.addEventListener("resize", applyBoardScale);
    return () => window.removeEventListener("resize", applyBoardScale);
  }, []);

  // ==================== 360° FRAME CACHE & INERTIA PHYSICS ====================
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
          // Ignore if unavailable
        }
      }
    };

    const findNearestBitmap = (targetIdx: number): { idx: number; bmp: ImageBitmap } | null => {
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

    // Progressive Coarse-to-Fine 360° ImageBitmap Cache (0° & 180° live in <0.25s!)
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

        // 120 seamless frames around 360° (dropping duplicate final frame 120 == frame 0)
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
          const t = (index / activeCount) * Math.max(0.1, extractor.duration - 0.04);
          extractor.currentTime = t;
          await new Promise<void>((res) => {
            extractor.addEventListener("seeked", () => res(), { once: true });
          });
          offCtx.drawImage(extractor, 0, 0, offW, offH);
          frames[index] = await createImageBitmap(offCv);
        };

        // 1. Grab Front (0°) & Back (180° = index 60) FIRST so turntable is immediately interactive!
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

        // 2. Coarse-to-fine stride order (30, 90, 15, 45, 75, 105, then remaining)
        const priority = [30, 90, 15, 45, 75, 105, 10, 20, 40, 50, 70, 80, 100, 110];
        for (const idx of priority) {
          if (cancelled) return;
          await seekAndGrab(idx);
          paintedFrame = -1;
          showFrame(ang);
        }

        for (let i = 1; i < activeCount; i++) {
          if (cancelled) return;
          if (!frames[i]) {
            await seekAndGrab(i);
          }
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

    // spinTo(a): shortest angular path, easeInOutCubic over 900 + |Δ|*900 ms
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

    // Pointer rotation handlers on #sp-stage
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

      if (framesReady) showFrame(ang);
      else if (vid.duration) vid.currentTime = wrap1(ang) * vid.duration;
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

    // Main 60fps Physics & UI Readout Loop
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
        if (framesReady) showFrame(ang);
        else if (vid.duration) vid.currentTime = ang * vid.duration;
      } else if (!dragging) {
        idle += dtSec;
        const targetSpeed = idle > 3 ? 0.045 : 0;
        const easeRate = idle > 3 ? dtSec * 0.8 : dtSec * 2.2;
        vel += (targetSpeed - vel) * Math.min(1, easeRate);
        if (Math.abs(vel) > 0.00005) {
          ang = wrap1(ang + vel * dtSec);
          if (framesReady) showFrame(ang);
          else if (vid.duration) vid.currentTime = ang * vid.duration;
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

  // ==================== PARABOLIC WAAPI ADD-TO-BAG ARC ====================
  const handlePreOrder = useCallback(() => {
    setAddedRolling(true);
    setTimeout(() => setAddedRolling(false), 1800);

    const btn = preOrderBtnRef.current;
    const bag = bagPillRef.current;
    if (btn && bag) {
      const bRect = btn.getBoundingClientRect();
      const bagRect = bag.getBoundingClientRect();

      const startX = bRect.left + bRect.width / 2 - 30;
      const startY = bRect.top + bRect.height / 2 - 40;
      const endX = bagRect.left + bagRect.width / 2 - 30;
      const endY = bagRect.top + bagRect.height / 2 - 40;
      const midX = (startX + endX) / 2 - 40;
      const midY = Math.min(startY, endY) - 130;

      const flyer = document.createElement("div");
      flyer.style.position = "fixed";
      flyer.style.left = "0px";
      flyer.style.top = "0px";
      flyer.style.width = "60px";
      flyer.style.height = "80px";
      flyer.style.background = "#ffffff";
      flyer.style.padding = "4px";
      flyer.style.boxShadow = "0 12px 28px rgba(0,0,0,0.18)";
      flyer.style.zIndex = "9999";
      flyer.style.pointerEvents = "none";

      if (frontThumbDataUrlRef.current) {
        const inner = document.createElement("div");
        inner.style.width = "100%";
        inner.style.height = "100%";
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
            transform: `translate(${endX}px, ${endY}px) scale(0.18) rotate(-14deg)`,
            opacity: 0.75,
          },
        ],
        {
          duration: 900,
          easing: "cubic-bezier(0.5, 0, 0.3, 1)",
          fill: "forwards",
        }
      );

      setTimeout(() => {
        flyer.remove();
        setBagCount((c) => c + 1);
        setBagBump(false);
        requestAnimationFrame(() => setBagBump(true));
      }, 900);
    } else {
      setBagCount((c) => c + 1);
    }
  }, []);

  return (
    <div className="sp-root" ref={rootRef}>
      <div id="sp-art" ref={artRef}>
        {/* ==================== 3. HEADER ==================== */}
        <div id="sp-logo">
          <GwoLogo height={32} className="text-[#111111]" />
          <span>OKTA/9</span>
        </div>

        <div id="sp-crumb">
          <Link href="/closet">HOME</Link> &gt;{" "}
          <Link href="/shop">SHOP</Link> &gt; COATS &amp; JACKETS
        </div>

        <nav id="sp-nav" aria-label="Primary Navigation">
          <Link href="/shop" className="sp-pill">
            Shop Runway
          </Link>
          <Link href="/closet" className="sp-pill">
            Your Closet
          </Link>
          <Link href="/friends" className="sp-pill">
            Friends
          </Link>
        </nav>

        <div id="sp-acct">
          <Link href="/shop" className="sp-pill" aria-label="Search Catalog">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="7" stroke="#111" strokeWidth="2.6" />
              <line
                x1="13.8"
                y1="13.8"
                x2="18.5"
                y2="18.5"
                stroke="#111"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </Link>
          <Link href="/closet" className="sp-pill">
            Try on Avatar
          </Link>
          <button type="button" className="sp-pill" ref={bagPillRef}>
            <span>
              Bag/<b id="sp-count" className={bagBump ? "bump" : ""}>{bagCount}</b>
            </span>
          </button>
        </div>

        {/* ==================== 5. WHITE SVG CONNECTOR LINES ==================== */}
        <svg id="sp-connectors" viewBox="0 0 1500 1000">
          <path
            d="M438 395H562L592 362H618"
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
            d="M1105 600H962L937 478H900"
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

        {/* ==================== 4. 360° TURNTABLE STAGE ==================== */}
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

          {/* Three Front-Facing Pulsing "+" Hotspots */}
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

        {/* Readout #deg */}
        <div id="sp-deg">
          <span>DRAG TO ROTATE</span>
          <span className="sp-deg-bar">
            <span className="sp-deg-dot" style={{ left: `${dotPct}%` }} />
          </span>
          <span className="sp-deg-num">
            {String(degDisplay).padStart(3, "0")}°
          </span>
        </div>

        {/* ==================== 6A. LEFT NOTCHED INFO CARD (#info) ==================== */}
        <section id="sp-info" aria-label="Product Information">
          <h1
            style={{
              fontSize: 13,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              lineHeight: 1.45,
            }}
          >
            {customTitle ? (
              customTitle
            ) : (
              <>
                The contour lines
                <br />
                metallic puffer
              </>
            )}
          </h1>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {customPrice || "€ 1.120"}
            </span>
            <span
              style={{
                fontSize: 11,
                background: "var(--chip)",
                padding: "2px 4px",
                letterSpacing: "0.04em",
              }}
            >
              PRE-ORDER
            </span>
          </div>

          <div style={{ marginTop: 22, borderTop: "1px solid #eceef1" }}>
            {ACCORDION_ROWS.map((row) => {
              const isOpen = openRow === row.id;
              return (
                <div
                  key={row.id}
                  style={{ borderBottom: "1px solid #eceef1" }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenRow(isOpen ? "" : row.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 13,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      padding: "8px 0",
                    }}
                  >
                    <span>{row.id}</span>
                    <span>{isOpen ? "[−]" : "[+]"}</span>
                  </button>
                  <div className={`sp-acc-body ${isOpen ? "open" : ""}`}>
                    <div className="sp-acc-inner">
                      <p style={{ padding: "4px 0 12px" }}>{row.text}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ==================== 6B. RIGHT NOTCHED SIZE & BUY CARD (#buy) ==================== */}
        <section id="sp-buy" aria-label="Select Size and Pre-order">
          <div
            style={{
              fontSize: 13,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            SIZE
          </div>

          {/* 3-Column Sliding Highlight Size Selector */}
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
            }}
          >
            {/* Base --chip tiles at zIndex 0 */}
            {SIZES.map((sz) => (
              <div
                key={`bg-${sz}`}
                style={{
                  height: 36,
                  background: "var(--chip)",
                  pointerEvents: "none",
                }}
              />
            ))}
            {/* Sliding black #hl at zIndex 1 */}
            <div
              id="sp-hl"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                width: "calc((100% - 12px) / 3)",
                left: `calc(${selectedSizeIdx} * ((100% - 12px) / 3 + 6px))`,
                background: "#111111",
                transition:
                  "left 0.45s cubic-bezier(0.65, 0, 0.25, 1), width 0.45s cubic-bezier(0.65, 0, 0.25, 1)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
            {/* Interactive size buttons at zIndex 2 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                zIndex: 2,
              }}
            >
              {SIZES.map((sz, idx) => {
                const sel = selectedSizeIdx === idx;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setSelectedSizeIdx(idx)}
                    style={{
                      height: 36,
                      fontSize: 13,
                      color: sel ? "#ffffff" : "#111111",
                      transition: "color 0.25s ease",
                    }}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>

          <p
            style={{
              marginTop: 12,
              fontSize: 10.5,
              textTransform: "uppercase",
              color: "var(--mute)",
              lineHeight: 1.5,
            }}
          >
            Model is 172 cm &amp; wears size M/L.{" "}
            <button
              type="button"
              onClick={() => setOpenRow("Size guide")}
              style={{
                color: "var(--ink)",
                textDecoration: "underline",
                textTransform: "uppercase",
                fontSize: 10.5,
              }}
            >
              Size guide
            </button>
          </p>

          {/* SAVE + PRE-ORDER Action Row */}
          <div style={{ display: "flex", gap: 6, marginTop: 22 }}>
            <button
              type="button"
              onClick={() => setSaved((s) => !s)}
              style={{
                width: 62,
                height: 36,
                background: saved ? "#3a3d44" : "#111111",
                color: "#ffffff",
                fontSize: 13,
                textTransform: "uppercase",
                flexShrink: 0,
                transition: "background-color 0.2s ease",
              }}
            >
              {saved ? "Saved" : "SAVE"}
            </button>

            <button
              type="button"
              ref={preOrderBtnRef}
              onClick={handlePreOrder}
              style={{
                flex: 1,
                height: 36,
                background: "#111111",
                color: "#ffffff",
                fontSize: 13,
                textTransform: "uppercase",
                overflow: "hidden",
              }}
            >
              <div className="sp-roll-wrap">
                <div className={`sp-roll-track ${addedRolling ? "added" : ""}`}>
                  <span>PRE-ORDER</span>
                  <span>Added to bag</span>
                </div>
              </div>
            </button>
          </div>

          <p
            style={{
              marginTop: 12,
              fontSize: 10.5,
              color: "var(--mute)",
              lineHeight: 1.45,
            }}
          >
            Pay in 3 instalments at checkout.{" "}
            <span style={{ color: "var(--ink)", textDecoration: "underline" }}>
              Learn more
            </span>
          </p>
        </section>

        {/* ==================== 7. FRONT / BACK THUMBNAILS (#looks) ==================== */}
        <div id="sp-looks">
          <button
            type="button"
            className={`sp-look-btn ${activeThumb === "front" ? "on" : ""}`}
            onClick={() => {
              setActiveThumb("front");
              spinToFnRef.current?.(0);
            }}
            aria-label="Spin to front view"
          >
            <span className="sp-bracket tl" />
            <span className="sp-bracket tr" />
            <span className="sp-bracket bl" />
            <span className="sp-bracket br" />
            <canvas ref={frontThumbRef} width={96} height={96} />
          </button>

          <button
            type="button"
            className={`sp-look-btn ${activeThumb === "back" ? "on" : ""}`}
            onClick={() => {
              setActiveThumb("back");
              spinToFnRef.current?.(0.5);
            }}
            aria-label="Spin to back view"
          >
            <span className="sp-bracket tl" />
            <span className="sp-bracket tr" />
            <span className="sp-bracket bl" />
            <span className="sp-bracket br" />
            <canvas ref={backThumbRef} width={96} height={96} />
          </button>
        </div>
      </div>
    </div>
  );
}

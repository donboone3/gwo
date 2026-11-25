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
import { SIGNATURE_BADGE_URL } from "../vell/vell-data";
import { useGwo } from "@/context/GwoAppContext";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const SPIN_FRAME_COUNT = 8;
const STAGE_W = 540;
const STAGE_H = 900;

let SESSION_SPIN_BITMAPS: Array<ImageBitmap | null> | null = null;

const HOTSPOTS = [
  {
    x: 0.5,
    y: 0.31,
    title: "Two-way zip collar",
    text: "Sculpted two-way zip up to a cozy stand collar that blocks wind without feeling stiff.",
  },
  {
    x: 0.37,
    y: 0.37,
    title: "Contour finish",
    text: "Subtle tonal topographic weave with soft matte-silver sheen.",
  },
  {
    x: 0.63,
    y: 0.44,
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
  const cvRef = useRef<HTMLCanvasElement | null>(null);
  const userFaceRef = useRef<HTMLImageElement | null>(null);
  const degDotRef = useRef<HTMLSpanElement | null>(null);
  const degNumRef = useRef<HTMLSpanElement | null>(null);
  const addBagBtnRef = useRef<HTMLButtonElement | null>(null);

  const kScaleRef = useRef(1);
  const spinToFnRef = useRef<((targetAng: number) => void) | null>(null);

  const [openSection, setOpenSection] = useState<string>("Fit & Details");
  const [selectedSize, setSelectedSize] = useState<(typeof SIZES)[number]>("S");
  const [savedToCloset, setSavedToCloset] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const [facingFront, setFacingFront] = useState(true);
  const [activeAngleTab, setActiveAngleTab] = useState<"front" | "side" | "back">("front");
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

  // Instant 8-Angle Signature Avatar Turnaround Engine (203 KB total -> <50ms load, ~145 FPS!)
  useEffect(() => {
    const cv = cvRef.current;
    const stage = stageRef.current;
    const root = rootRef.current;
    if (!cv || !stage || !root) return;

    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    const frames: Array<ImageBitmap | null> =
      SESSION_SPIN_BITMAPS || new Array(SPIN_FRAME_COUNT).fill(null);
    SESSION_SPIN_BITMAPS = frames;

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

    let lastPaintedKey = "";

    const updateFaceOverlayTransform = (norm: number) => {
      const faceEl = userFaceRef.current;
      if (!faceEl) return;
      const signedTurn = norm > 0.5 ? norm - 1 : norm;
      const absTurn = Math.abs(signedTurn);
      if (absTurn > 0.11) {
        faceEl.style.opacity = "0";
        return;
      }
      const theta = signedTurn * Math.PI * 2;
      const cosT = Math.max(0.25, Math.cos(theta));
      const shiftPx = -Math.sin(theta) * 14;
      const fade = Math.pow(Math.max(0, 1 - absTurn / 0.11), 1.4);
      faceEl.style.opacity = fade.toFixed(3);
      faceEl.style.transform = `translate3d(calc(-50% + ${shiftPx.toFixed(
        1
      )}px), -50%, 0) scaleX(${cosT.toFixed(3)})`;
    };

    const showFrame = (a: number) => {
      const norm = wrap1(a);
      updateFaceOverlayTransform(norm);

      const exactPos = norm * SPIN_FRAME_COUNT;
      const i0 = Math.floor(exactPos) % SPIN_FRAME_COUNT;
      const i1 = (i0 + 1) % SPIN_FRAME_COUNT;
      const frac = exactPos - Math.floor(exactPos);

      const bmp0 = frames[i0] || frames[0];
      const bmp1 = frames[i1] || bmp0;
      if (!bmp0) return;

      // Quantize blend fraction to 1/12th step so stationary frames cost 0 GPU redraws
      const qFrac = Math.round(frac * 12) / 12;
      const key = `${i0}:${i1}:${qFrac}`;
      if (key === lastPaintedKey) return;
      lastPaintedKey = key;

      ctx.globalAlpha = 1;
      ctx.drawImage(bmp0, 0, 0, STAGE_W, STAGE_H);
      if (bmp1 && bmp1 !== bmp0 && qFrac > 0.04) {
        ctx.globalAlpha = qFrac;
        ctx.drawImage(bmp1, 0, 0, STAGE_W, STAGE_H);
        ctx.globalAlpha = 1;
      }
    };

    const loadSpinFrames = async () => {
      // Load 0° Front and 180° Back first for instant <40ms first paint, then remaining angles in parallel
      const loadIndex = async (idx: number) => {
        if (frames[idx]) return;
        const im = new Image();
        im.decoding = "async";
        im.src = `${BASE_PATH}/models/signature/spin_${idx}.webp`;
        await im.decode();
        if (cancelled) return;
        frames[idx] = await createImageBitmap(im);
      };

      try {
        await loadIndex(0);
        if (cancelled) return;
        lastPaintedKey = "";
        showFrame(ang);

        await Promise.all([1, 2, 3, 4, 5, 6, 7].map((idx) => loadIndex(idx)));
        if (cancelled) return;
        lastPaintedKey = "";
        showFrame(ang);
      } catch {
        // Ignore transient decode error
      }
    };

    if (frames[0]) {
      showFrame(0);
    }
    void loadSpinFrames();

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
        duration: 680 + Math.abs(delta) * 680,
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

      const dAng = -dx / kScaleRef.current / 760;
      ang = wrap1(ang + dAng);
      estV = ((dAng / dtMs) * 1000) * 0.6 + estV * 0.4;
      showFrame(ang);
    };

    const onPointerUp = () => {
      if (!dragging) return;
      dragging = false;
      setIsDraggingUi(false);
      vel = clamp(estV, -2.0, 2.0);
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
    let prevTab: "front" | "side" | "back" = "front";

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
        const targetSpeed = idle > 3.5 ? 0.042 : 0;
        const easeRate = idle > 3.5 ? dtSec * 0.8 : dtSec * 3.2;
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
        if (degNumRef.current) {
          degNumRef.current.textContent = `${String(deg).padStart(3, "0")}°`;
        }
        if (degDotRef.current) {
          degDotRef.current.style.left = `${(norm * 100).toFixed(1)}%`;
        }
      }

      const nextFront =
        (norm <= 0.05 || norm >= 0.95) &&
        !dragging &&
        !tween &&
        Math.abs(vel) < 0.02;
      if (nextFront !== prevFront) {
        prevFront = nextFront;
        setFacingFront(nextFront);
      }

      const nextTab: "front" | "side" | "back" =
        norm < 0.16 || norm >= 0.84
          ? "front"
          : norm >= 0.36 && norm <= 0.64
          ? "back"
          : "side";
      if (nextTab !== prevTab) {
        prevTab = nextTab;
        setActiveAngleTab(nextTab);
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
    const thumbSrc =
      customAvatar?.badgeDataUrl || `${BASE_PATH}/models/signature/spin_0.webp`;

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

      const inner = document.createElement("div");
      inner.style.width = "100%";
      inner.style.height = "100%";
      inner.style.borderRadius = "9px";
      inner.style.background = `url("${thumbSrc}") center top / cover no-repeat`;
      flyer.appendChild(inner);

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
      imageUrl: `${BASE_PATH}/models/signature/spin_0.webp`,
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
          <canvas id="sp-cv" ref={cvRef} width={STAGE_W} height={STAGE_H} />

          {/* Optional Custom Selfie Override if another shopper uploads their photo */}
          {customAvatar && (
            <img
              ref={userFaceRef}
              src={customAvatar.faceOvalDataUrl}
              alt="Your photo avatar"
              decoding="async"
              style={{
                position: "absolute",
                left: "50.0%",
                top: "12.4%",
                width: "13.0%",
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

        {/* Bottom 360° Degree Pill */}
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
              <img
                src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                alt="Avatar"
                className="w-3.5 h-3.5 rounded-full object-cover"
              />
              Your Avatar ✓
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

          {/* Front / Side / Back Quick Angle Switcher */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveAngleTab("front");
                spinToFnRef.current?.(0);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                activeAngleTab === "front"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={`${BASE_PATH}/models/signature/spin_0.webp`}
                alt="Front"
                className="w-6 h-6 rounded-md object-cover object-top"
              />
              Front (0°)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveAngleTab("side");
                spinToFnRef.current?.(0.25);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                activeAngleTab === "side"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={`${BASE_PATH}/models/signature/spin_2.webp`}
                alt="Side"
                className="w-6 h-6 rounded-md object-cover object-top"
              />
              Side (90°)
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveAngleTab("back");
                spinToFnRef.current?.(0.5);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                activeAngleTab === "back"
                  ? "border-[#141518] bg-[#141518] text-white"
                  : "border-black/10 bg-white text-[#686D76]"
              }`}
            >
              <img
                src={`${BASE_PATH}/models/signature/spin_4.webp`}
                alt="Back"
                className="w-6 h-6 rounded-md object-cover object-top"
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

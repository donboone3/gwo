"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Rotate3d, ShoppingBag, Sparkles } from "lucide-react";
import "./runway-lookbook.css";
import { useGwo } from "@/context/GwoAppContext";

const MODELS_SHEET =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042056_1a704ff7-b0e5-4a9f-bbda-62392b819fb6.png&w=3840&q=85";
const PIECES_SHEET =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=2400&q=85";

const LOOKS: Array<[number, number]> = [
  [12, 176],
  [178, 330],
  [331, 470],
  [476, 633],
  [634, 767],
  [767, 956],
];
const Y0 = 48;
const Y1 = 496;

// Cohesive everyday GWO pieces: [x0, x1, y0, y1, name, priceDisplay, priceNum, brand, friendOwner]
const ITEMS: Array<
  [number, number, number, number, string, string, number, string, string]
> = [
  [26, 224, 28, 214, "Blush Faux-Feather Cropped Jacket", "$148", 148, "Reformation", "MAYA-GWO"],
  [304, 412, 22, 236, "Satin Wide-Leg Lounge Trousers", "$92", 92, "Aritzia", "MAYA-GWO"],
  [530, 666, 12, 242, "Sage Pleated Maxi Dress", "$168", 168, "Reformation", "CHLOE-GWO"],
  [752, 922, 100, 146, "Sculpted Gold Waist Belt", "$48", 48, "GWO Studio", "CHLOE-GWO"],
  [70, 176, 246, 466, "Champagne Belted Trench Dress", "$154", 154, "Princess Polly", "MAYA-GWO"],
  [294, 422, 294, 432, "Structured Cream Mini Bag", "$78", 78, "GWO Studio", "MAYA-GWO"],
  [508, 688, 240, 452, "Soft Blush Billow Blouse", "$74", 74, "Aritzia", "SOFIA-GWO"],
  [780, 890, 252, 466, "Relaxed Tie-Waist Trousers", "$86", 86, "Aritzia", "SOFIA-GWO"],
  [64, 178, 484, 698, "Powder Blue Wool Overcoat", "$198", 198, "Aritzia", "CHLOE-GWO"],
  [316, 396, 482, 698, "Ivory Straight Tailored Pants", "$88", 88, "Princess Polly", "CHLOE-GWO"],
  [530, 672, 508, 682, "Ivory Ruffle Knit Top", "$68", 68, "SKIMS", "SOFIA-GWO"],
  [754, 916, 484, 700, "Flowy Pleated Maxi Skirt", "$96", 96, "Reformation", "SOFIA-GWO"],
];

const OCCASION_PILLS = [
  { label: "Brunch", lookIdx: 0 },
  { label: "Evening", lookIdx: 1 },
  { label: "Date Night", lookIdx: 2 },
  { label: "Work / Chic", lookIdx: 3 },
  { label: "Outerwear", lookIdx: 4 },
  { label: "Weekend", lookIdx: 5 },
];

const KX = [1.2, 0.744, 0.496, 0.346, 0.235, 0.15, 0.085];
const KF = [1.14, 0.89, 0.777, 0.704, 0.651, 0.616, 0.59];
const KH = [1.18, 0.832, 0.574, 0.436, 0.334, 0.258, 0.19];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const NS = "http://www.w3.org/2000/svg";
const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function createNestedSvgCrop(
  href: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  sheetW: number,
  sheetH: number
): SVGSVGElement {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);
  s.setAttribute("aria-hidden", "true");

  const f = document.createElementNS(NS, "svg");
  f.setAttribute("x", String(x0));
  f.setAttribute("y", String(y0));
  f.setAttribute("width", String(w));
  f.setAttribute("height", String(h));
  f.setAttribute("viewBox", `${x0} ${y0} ${w} ${h}`);

  const img = document.createElementNS(NS, "image");
  img.setAttribute("href", href);
  img.setAttribute("width", String(sheetW));
  img.setAttribute("height", String(sheetH));

  f.append(img);
  s.append(f);
  return s;
}

export function GwoRunwayLookbook() {
  const { addToBag } = useGwo();

  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const jumpLookRef = useRef<((lookOffset: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [activeLookIdx, setActiveLookIdx] = useState(0);

  const addItemIndexToUnifiedBag = useCallback(
    (idx: number) => {
      const item = ITEMS[idx];
      if (!item) return;
      addToBag({
        title: item[4],
        brand: item[7],
        price: item[6],
        size: "S",
        friendRef: item[8],
      });
    },
    [addToBag]
  );

  const handleBagCurrentOutfit = useCallback(() => {
    const idx = Math.round(wrap(currentPosRef.current, LOOKS.length)) % LOOKS.length;
    addItemIndexToUnifiedBag(idx * 2);
    addItemIndexToUnifiedBag(idx * 2 + 1);
  }, [addItemIndexToUnifiedBag]);

  useEffect(() => {
    const stage = stageRef.current;
    const line = lineRef.current;
    const rail = railRef.current;
    const ring = ringRef.current;
    const roll = rollRef.current;
    if (!stage || !line || !rail || !ring || !roll) return;

    line.innerHTML = "";
    rail.innerHTML = "";
    roll.innerHTML = "";

    const N = LOOKS.length;
    const calm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    const people = LOOKS.map(([a, b], i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);
      e.append(createNestedSvgCrop(MODELS_SHEET, a, Y0, b - a, Y1 - Y0, 960, 540));
      line.append(e);
      return { e, r: (b - a) / (Y1 - Y0), f: "", o: "" };
    });

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const cards = ITEMS.map(([a, b, c, d, name, price, , brand], i) => {
      const pdpHref = `${basePath}/product?name=${encodeURIComponent(
        name
      )}&price=${encodeURIComponent(price)}`;
      const e = document.createElement("article");
      e.className = "mv-card" + (i % 2 ? " alt" : "");
      e.dataset.idx = String(i);
      e.innerHTML = `<button class="mv-fav" type="button" aria-pressed="false" aria-label="Save ${name}"><svg viewBox="0 0 24 24"><path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z"/></svg></button><a class="mv-shot" href="${pdpHref}" title="Open 360° Fit View"></a><div class="mv-meta"><div><h3><a href="${pdpHref}">${name}</a></h3><span>${brand} • ${price}</span></div><button class="mv-add" type="button" data-idx="${i}">+ Bag</button></div>`;
      const shot = e.querySelector(".mv-shot");
      shot?.append(createNestedSvgCrop(PIECES_SHEET, a, c, b - a, d - c, 960, 720));
      rail.append(e);
      return e;
    });

    for (let i = 0; i <= N; i++) {
      const b = document.createElement("b");
      b.textContent = `0${1 + (i % N)}`;
      roll.append(b);
    }

    const onRailClick = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement;
      const favBtn = targetEl.closest(".mv-fav");
      if (favBtn) {
        favBtn.setAttribute(
          "aria-pressed",
          favBtn.getAttribute("aria-pressed") !== "true" ? "true" : "false"
        );
      }
      const addBtn = targetEl.closest(".mv-add") as HTMLElement | null;
      if (addBtn) {
        addItemIndexToUnifiedBag(Number(addBtn.dataset.idx || 0));
      }
    };
    rail.addEventListener("click", onRailClick);

    let W = 0;
    let H = 0;
    let base = 0;
    let cardS = 0;
    let side = false;
    let dirty = true;
    let p = 0;
    let target = 0;
    let last = 0;
    let lastReportedIdx = 0;

    jumpLookRef.current = (lookIndex: number) => {
      const currMod = wrap(Math.round(target), N);
      let delta = lookIndex - currMod;
      if (delta < 0) delta += N;
      target = Math.round(target) + delta;
    };

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 1.2;
      side = window.innerWidth <= 820;
      people.forEach((m) => {
        m.e.style.width = `${base * m.r}px`;
        m.e.style.height = `${base}px`;
      });
      cardS = side ? 170 : rail.clientHeight / 3;
      cards.forEach((c) => {
        c.style.height = side ? "100%" : `${cardS}px`;
      });
      dirty = true;
    };

    const paint = () => {
      currentPosRef.current = p;
      const roundedIdx = Math.round(wrap(p, N)) % N;
      if (roundedIdx !== lastReportedIdx) {
        lastReportedIdx = roundedIdx;
        setActiveLookIdx(roundedIdx);
      }

      people.forEach((m, i) => {
        let d = wrap(i - p, N);
        if (d > N - 1) d -= N;
        const k = clamp(d + 1, 0, 6);
        const a = Math.floor(k);
        const b = Math.min(6, a + 1);
        const t = k - a;
        const mix = (A: number[]) => A[a] + (A[b] - A[a]) * t;

        const h = mix(KH) * H;
        const s = h / base;
        const w = h * m.r;
        const x = mix(KX) * W - w / 2;
        const y = mix(KF) * H - h;

        m.e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(
          1
        )}px,0) scale(${s.toFixed(4)})`;

        const f = mix(KB) / s;
        const fs = f < 0.2 ? "none" : `blur(${f.toFixed(1)}px)`;
        const o = mix(KO).toFixed(3);
        if (fs !== m.f) {
          m.f = fs;
          m.e.style.filter = fs;
        }
        if (o !== m.o) {
          m.o = o;
          m.e.style.opacity = o;
        }
        m.e.style.zIndex = String(100 - Math.round(d * 10));
      });

      const all = cardS * ITEMS.length;
      cards.forEach((c, i) => {
        let y = wrap(i * cardS - p * 2 * cardS, all);
        if (y > all - cardS) y -= all;
        c.style.transform = side
          ? `translate3d(${y.toFixed(1)}px,0,0)`
          : `translate3d(0,${y.toFixed(1)}px,0)`;
      });

      const firstRollChild = roll.firstElementChild as HTMLElement | null;
      const lineH = firstRollChild ? firstRollChild.offsetHeight : 36;
      roll.style.transform = `translate3d(0,${(-wrap(p, N) * lineH).toFixed(
        1
      )}px,0)`;
    };

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
    let down = false;
    let sx = 0;
    let st = 0;
    let moved = 0;
    let wheelT: ReturnType<typeof setTimeout> | undefined;

    const PULL = () => Math.max(150, W * 0.2);

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") ring.classList.add("show");
    };
    const onLeave = () => ring.classList.remove("show");
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      target = st + dx / PULL();
    };
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest("a, button")) return;
      down = true;
      sx = e.clientX;
      st = target;
      moved = 0;
      stage.setPointerCapture(e.pointerId);
      ring.classList.add("drag");
    };
    const onRelease = (e: PointerEvent) => {
      if (!down) return;
      down = false;
      ring.classList.remove("drag");
      if (moved < 6) {
        const hit = document
          .elementsFromPoint(e.clientX, e.clientY)
          .find((x) => x.classList && x.classList.contains("mv-m")) as
          | HTMLElement
          | undefined;
        if (hit && hit.dataset.i !== undefined) {
          let d = wrap(Number(hit.dataset.i) - target, N);
          d = Math.round(d);
          if (d > 0 && d < N) target = Math.round(target) + d;
        }
      } else {
        target = Math.round(target);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target += clamp(e.deltaY + e.deltaX, -120, 120) / 420;
      if (wheelT) clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        target = Math.round(target);
      }, 150);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (["ArrowRight", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        target = Math.round(target) + 1;
      }
      if (["ArrowLeft", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        target = Math.round(target) - 1;
      }
    };

    stage.addEventListener("pointerenter", onEnter);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointerup", onRelease);
    stage.addEventListener("pointercancel", onRelease);
    stage.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", size);
    window.addEventListener("keydown", onKeyDown);

    let rafId = 0;
    const frame = (now: number) => {
      const dt = Math.min(50, now - last) || 16;
      last = now;
      const was = p;
      if (calm) p = target;
      else p += (target - p) * (1 - Math.exp(-dt * 0.0072));
      if (Math.abs(target - p) < 0.0004) p = target;
      if (p !== was || dirty) {
        dirty = false;
        paint();
      }
      cx += (mx - cx) * 0.32;
      cy += (my - cy) * 0.32;
      ring.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(
        1
      )}px,0)`;
      rafId = requestAnimationFrame(frame);
    };

    size();
    paint();
    rafId = requestAnimationFrame(frame);

    let cancelled = false;
    Promise.all(
      [MODELS_SHEET, PIECES_SHEET].map((u) => {
        const im = new Image();
        im.src = u;
        return im.decode().catch(() => undefined);
      })
    )
      .then(() => document.fonts?.ready)
      .then(() => {
        if (cancelled) return;
        size();
        paint();
        setReady(true);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (wheelT) clearTimeout(wheelT);
      rail.removeEventListener("click", onRailClick);
      stage.removeEventListener("pointerenter", onEnter);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointerup", onRelease);
      stage.removeEventListener("pointercancel", onRelease);
      stage.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", size);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [addItemIndexToUnifiedBag]);

  const currentOutfitPrice =
    (ITEMS[activeLookIdx * 2]?.[6] || 0) +
    (ITEMS[activeLookIdx * 2 + 1]?.[6] || 0);
  const currentHeroName = ITEMS[activeLookIdx * 2]?.[4] || "Metallic Puffer";
  const currentHeroPrice = ITEMS[activeLookIdx * 2]?.[5] || "$168";

  return (
    <div className="mv-page">
      <main className="mv-main">
        <section
          className="mv-stage"
          ref={stageRef}
          aria-label="Recommended outfits. Drag, scroll or use arrow keys."
          tabIndex={0}
        >
          <div className="mv-line" ref={lineRef} />

          {/* Clean Top-Left Occasion Card */}
          <div className="mv-intro space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/85 backdrop-blur-md border border-black/[0.06] text-[11px] font-bold text-[#244B3B]">
              <Sparkles className="w-3 h-3" /> Picked for Your Fit &amp; Vibe
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141518]">
              For You Runway
            </h1>
            <p className="hidden sm:block text-xs sm:text-sm text-[#686D76] leading-relaxed">
              Drag, scroll, or tap an occasion below to walk recommended outfits forward.
            </p>

            {/* 1-Tap Occasion Filter Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {OCCASION_PILLS.map((pill) => {
                const active = activeLookIdx === pill.lookIdx;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => jumpLookRef.current?.(pill.lookIdx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                      active
                        ? "bg-[#141518] text-white shadow-xs"
                        : "bg-white/85 hover:bg-white text-[#686D76] hover:text-[#141518] border border-black/[0.06]"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clean Bottom-Left Outfit Counter + Unified Actions */}
          <div className="mv-tag space-y-3">
            <div className="mv-look" aria-live="polite">
              <span>Outfit</span>
              <span className="mv-win">
                <span className="mv-roll" ref={rollRef} />
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBagCurrentOutfit}
                className="px-4 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-md"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Bag Full Outfit ($
                {currentOutfitPrice})
              </button>

              <Link
                href={`/product?name=${encodeURIComponent(
                  currentHeroName
                )}&price=${encodeURIComponent(currentHeroPrice)}`}
                className="px-3.5 py-2.5 rounded-full bg-white/90 hover:bg-white border border-black/[0.08] text-[#141518] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Rotate3d className="w-3.5 h-3.5" /> 360° Fit View
              </Link>

              <Link
                href="/"
                className="px-3.5 py-2.5 rounded-full bg-white/90 hover:bg-white border border-black/[0.08] text-[#244B3B] text-xs font-semibold"
              >
                Try in Closet →
              </Link>
            </div>
          </div>

          <div className="mv-ring" ref={ringRef} />
        </section>

        <aside
          className="mv-rail"
          ref={railRef}
          aria-label="Pieces in this outfit"
        />
      </main>

      <div className={`mv-wait ${ready ? "gone" : ""}`} />
    </div>
  );
}

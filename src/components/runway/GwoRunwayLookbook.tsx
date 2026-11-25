"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./runway-lookbook.css";
import { GwoLogo } from "../brand/GwoLogo";
import { useGwo } from "@/context/GwoAppContext";

const MODELS_SHEET =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042056_1a704ff7-b0e5-4a9f-bbda-62392b819fb6.png&w=3840&q=85";
const PIECES_SHEET =
  "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20261102_042057_080e85b0-b4aa-4072-8eb9-2304c7baf42b.png&w=2400&q=85";

// Each model's box on the 960 x 540 sheet: [x0, x1]
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
const FIRST_LOOK = 15;

// Each piece's box on the 960 x 720 sheet: [x0, x1, y0, y1, name, price, numericPrice]
const ITEMS: Array<[number, number, number, number, string, string, number]> = [
  [26, 224, 28, 214, "Feather Jacket", "$2,900", 2900],
  [304, 412, 22, 236, "Satin Wide Leg Trousers", "$1,450", 1450],
  [530, 666, 12, 242, "Pleated Dress", "$2,200", 2200],
  [752, 922, 100, 146, "Gold Waist Belt", "$420", 420],
  [70, 176, 246, 466, "Satin Trench Dress", "$2,350", 2350],
  [294, 422, 294, 432, "Top Handle Bag", "$980", 980],
  [508, 688, 240, 452, "Billow Sleeve Blouse", "$860", 860],
  [780, 890, 252, 466, "Tie Waist Trousers", "$740", 740],
  [64, 178, 484, 698, "Powder Long Coat", "$1,980", 1980],
  [316, 396, 482, 698, "Ivory Straight Trousers", "$690", 690],
  [530, 672, 508, 682, "Sculpted Ruffle Top", "$1,120", 1120],
  [754, 916, 484, 700, "Pleated Maxi Skirt", "$1,340", 1340],
];

// Depth stops from d = -1 (leaving past the rail) to d = 5 (arriving out of the haze)
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

interface CartEntry {
  id: string;
  name: string;
  priceLabel: string;
  priceNum: number;
  lookNum: number;
}

export function GwoRunwayLookbook() {
  const { ingestUrlToSharedCatalog, products } = useGwo();

  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const jumpLookRef = useRef<((lookOffset: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [cartItems, setCartItems] = useState<CartEntry[]>([]);
  const [drawerMode, setDrawerMode] = useState<"none" | "cart" | "import">("none");
  const [pasteUrl, setPasteUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const addPieceIndexToCart = useCallback((idx: number) => {
    const item = ITEMS[idx];
    if (!item) return;
    const lookNum = FIRST_LOOK + Math.floor(idx / 2);
    setCartItems((prev) => [
      ...prev,
      {
        id: `${idx}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: item[4],
        priceLabel: item[5],
        priceNum: item[6],
        lookNum,
      },
    ]);
  }, []);

  const handleShopCurrentLook = useCallback(() => {
    const activeIdx = Math.round(wrap(currentPosRef.current, LOOKS.length)) % LOOKS.length;
    addPieceIndexToCart(activeIdx * 2);
    addPieceIndexToCart(activeIdx * 2 + 1);
    setDrawerMode("cart");
  }, [addPieceIndexToCart]);

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

    // 1. Mount 6 SVG-cropped Runway Models
    const people = LOOKS.map(([a, b], i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);
      e.append(createNestedSvgCrop(MODELS_SHEET, a, Y0, b - a, Y1 - Y0, 960, 540));
      line.append(e);
      return { e, r: (b - a) / (Y1 - Y0), f: "", o: "" };
    });

    // 2. Mount 12 SVG-cropped Looping Product Cards (clicking shot/title opens 360° Spin PDP!)
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const cards = ITEMS.map(([a, b, c, d, name, price], i) => {
      const pdpHref = `${basePath}/product?name=${encodeURIComponent(
        name
      )}&price=${encodeURIComponent(price)}`;
      const e = document.createElement("article");
      e.className = "mv-card" + (i % 2 ? " alt" : "");
      e.dataset.idx = String(i);
      e.innerHTML = `<button class="mv-fav" type="button" aria-pressed="false" aria-label="Save ${name}"><svg viewBox="0 0 24 24"><path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z"/></svg></button><a class="mv-shot" href="${pdpHref}" title="View 360° Product Details for ${name}"></a><div class="mv-meta"><h3 class="mv-wide"><a href="${pdpHref}">${name}</a></h3><span>${price}</span><button class="mv-add" type="button" data-idx="${i}" aria-label="Add ${name} to cart"></button></div>`;
      const shot = e.querySelector(".mv-shot");
      shot?.append(createNestedSvgCrop(PIECES_SHEET, a, c, b - a, d - c, 960, 720));
      rail.append(e);
      return e;
    });

    // 3. Mount Rolling Look Numbers (15..20, 15)
    for (let i = 0; i <= N; i++) {
      const b = document.createElement("b");
      b.textContent = String(FIRST_LOOK + (i % N));
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
        const idx = Number(addBtn.dataset.idx || 0);
        addPieceIndexToCart(idx);
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
      cardS = side ? 160 : rail.clientHeight / 3;
      cards.forEach((c) => {
        c.style.height = side ? "100%" : `${cardS}px`;
      });
      dirty = true;
    };

    const paint = () => {
      currentPosRef.current = p;
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
      const lineH = firstRollChild ? firstRollChild.offsetHeight : 38;
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
  }, [addPieceIndexToCart]);

  const cartTotal = cartItems.reduce((s, c) => s + c.priceNum, 0);

  return (
    <div className="mv-page">
      <header className="mv-header">
        <div className="mv-r1">
          <div className="mv-brand-wrap">
            <GwoLogo height={34} className="text-[#16191f]" />
            <span className="mv-brand mv-wide">Maison GWO</span>
          </div>

          <nav className="mv-tabs mv-wide" aria-label="Sections">
            <Link className="on" href="/shop" aria-current="page">
              Recommended
            </Link>
            <Link href="/closet">Your Closet</Link>
            <Link href="/friends">Girls&apos; Closets</Link>
            <button type="button" onClick={() => setDrawerMode("import")}>
              Import URL
            </button>
          </nav>

          <div className="mv-acct mv-wide">
            <Link href="/closet">Avatar Studio</Link>
            <button
              type="button"
              onClick={() => setDrawerMode("import")}
              aria-label="Import Store URL via Firecrawl"
            >
              <svg viewBox="0 0 24 24">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m15.5 15.5 5 5" />
              </svg>
            </button>
            <Link href="/friends" aria-label="Friends & Body Twins">
              <svg viewBox="0 0 24 24">
                <path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => setDrawerMode("cart")}
              aria-label="Bag"
            >
              <svg viewBox="0 0 24 24">
                <path d="M5 8h14l1 13H4Z" />
                <path d="M9 10V6a3 3 0 0 1 6 0v4" />
              </svg>
            </button>
            <button type="button" onClick={() => setDrawerMode("cart")}>
              Cart (<span>{cartItems.length}</span>)
            </button>
          </div>
        </div>

        <nav className="mv-r2 mv-wide" aria-label="Recommended Occasions">
          <button type="button" onClick={() => jumpLookRef.current?.(0)}>
            Collections
          </button>
          <button type="button" onClick={() => jumpLookRef.current?.(1)}>
            Evening
          </button>
          <button type="button" onClick={() => jumpLookRef.current?.(2)}>
            Trench Edit
          </button>
          <button type="button" onClick={() => jumpLookRef.current?.(3)}>
            Day Tailoring
          </button>
          <button type="button" onClick={() => jumpLookRef.current?.(4)}>
            Outerwear
          </button>
          <button type="button" onClick={() => jumpLookRef.current?.(5)}>
            Gala Lookbook
          </button>
        </nav>
      </header>

      <main className="mv-main">
        <section
          className="mv-stage"
          ref={stageRef}
          aria-label="Runway looks. Drag, scroll or use the arrow keys to change look."
          tabIndex={0}
        >
          <div className="mv-line" ref={lineRef} />

          <div className="mv-intro">
            <h2 className="mv-wide">Recommended Runway</h2>
            <p>
              A study in softness and strength. Drag, scroll, or use arrow keys
              to walk six recommended full outfits forward out of the haze,
              calibrated to your closet and Body-Twin circle.
            </p>
          </div>

          <div className="mv-tag">
            <div className="mv-look mv-wide" aria-live="polite">
              <span>Look</span>
              <span className="mv-win">
                <span className="mv-roll" ref={rollRef} />
              </span>
            </div>
            <div className="mv-actions">
              <button
                type="button"
                onClick={handleShopCurrentLook}
                className="mv-shop mv-wide"
              >
                Shop the look
              </button>
              <Link href="/product" className="mv-shop mv-shop-muted mv-wide">
                360° Details →
              </Link>
              <Link href="/closet" className="mv-shop mv-shop-muted mv-wide">
                Try on Avatar →
              </Link>
            </div>
          </div>

          <div className="mv-ring" ref={ringRef} />
        </section>

        <aside
          className="mv-rail"
          ref={railRef}
          aria-label="Pieces in this look"
        />
      </main>

      {/* ==================== MINIMALIST RUNWAY CART / FIRECRAWL OVERLAY ==================== */}
      {drawerMode !== "none" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(22, 25, 31, 0.24)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "flex-end",
          }}
          onClick={() => setDrawerMode("none")}
        >
          <div
            style={{
              width: "min(420px, 100vw)",
              height: "100%",
              background: "#ffffff",
              borderLeft: "1px solid #e6ebf0",
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e6ebf0",
                paddingBottom: 16,
              }}
            >
              <span
                className="mv-wide"
                style={{ fontSize: 12, letterSpacing: "0.16em" }}
              >
                {drawerMode === "cart"
                  ? `Runway Bag (${cartItems.length})`
                  : "Firecrawl Store Import"}
              </span>
              <button
                type="button"
                className="mv-wide"
                style={{ fontSize: 10, letterSpacing: "0.14em", color: "#737b86" }}
                onClick={() => setDrawerMode("none")}
              >
                Close
              </button>
            </div>

            {drawerMode === "cart" ? (
              <>
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {cartItems.length === 0 ? (
                    <p style={{ fontSize: 13, color: "#737b86", lineHeight: 1.6 }}>
                      Click the <strong>+</strong> button on any piece in the
                      right rail or <strong>Shop the look</strong> at bottom-left
                      to add pieces to your bag.
                    </p>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          padding: "14px 16px",
                          background: "#f3f6fa",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div
                            className="mv-wide"
                            style={{ fontSize: 10, letterSpacing: "0.12em" }}
                          >
                            {item.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#737b86",
                              marginTop: 4,
                            }}
                          >
                            Look {item.lookNum} · {item.priceLabel}
                          </div>
                        </div>
                        <button
                          type="button"
                          style={{ fontSize: 11, color: "#737b86" }}
                          onClick={() =>
                            setCartItems((p) =>
                              p.filter((x) => x.id !== item.id)
                            )
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div
                  style={{
                    borderTop: "1px solid #e6ebf0",
                    paddingTop: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#737b86" }}>Estimated Total</span>
                    <strong>${cartTotal.toLocaleString()}</strong>
                  </div>
                  <Link
                    href="/closet"
                    className="mv-wide"
                    style={{
                      padding: "14px 18px",
                      background: "#16191f",
                      color: "#ffffff",
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      textAlign: "center",
                    }}
                  >
                    Try Pieces in Avatar Studio →
                  </Link>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 13, color: "#737b86", lineHeight: 1.6 }}>
                  Paste any Nike, Skims, Reformation, or boutique URL. Your
                  authenticated <strong>Firecrawl</strong> engine scrapes it once
                  into GWO&apos;s shared 3-day-refresh catalog ({products.length}{" "}
                  SKUs live).
                </p>
                <input
                  type="url"
                  value={pasteUrl}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  placeholder="https://www.nike.com/t/..."
                  style={{
                    padding: "12px 14px",
                    border: "1px solid #d5dde6",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  disabled={importing || !pasteUrl.trim()}
                  onClick={async () => {
                    setImporting(true);
                    const res = await ingestUrlToSharedCatalog(pasteUrl);
                    setImporting(false);
                    if (res?.product) {
                      setPasteUrl("");
                      setImportNotice(
                        `Saved ${res.product.brand} — ${res.product.title} ($${res.product.price}) to shared catalog!`
                      );
                    }
                  }}
                  className="mv-wide"
                  style={{
                    padding: "14px 18px",
                    background: "#16191f",
                    color: "#ffffff",
                    fontSize: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  {importing ? "Scraping via Firecrawl..." : "Import to Shared DB"}
                </button>
                {importNotice && (
                  <p style={{ fontSize: 12.5, color: "#2b5942", lineHeight: 1.5 }}>
                    {importNotice}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className={`mv-wait ${ready ? "gone" : ""}`} />
    </div>
  );
}

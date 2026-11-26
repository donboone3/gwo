"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  ExternalLink,
  Images,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import "./runway-lookbook.css";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { buildSynthetic3DProductFromPiece } from "@/lib/catalog/closet-look-3d-mapper";
import {
  DEFAULT_AVATAR_MEASUREMENTS,
  deriveStandardApparelSize,
} from "@/lib/catalog/sizing";
import { SIGNATURE_BADGE_URL } from "../vell/vell-data";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Signature Avatar Runway Sprite Sheets (100% localized WebP for sub-100ms instant load!)
const MODELS_SHEET = `${BASE_PATH}/models/signature/runway_models_sheet.webp`;
const PIECES_SHEET = `${BASE_PATH}/models/signature/runway_pieces_sheet.webp`;

const LOOKS: Array<[number, number]> = [
  [12, 176],
  [178, 330],
  [331, 470],
  [476, 633],
  [634, 767],
  [767, 956],
];

const RUNWAY_FACE_COORDS: Array<[number, number, number, number]> = [
  [94, 96.5, 34, 41],
  [254.5, 99, 33, 40],
  [400, 96, 34, 41],
  [553, 96, 31, 38],
  [703.5, 95, 33, 40],
  [859, 97, 33, 40],
];

const Y0 = 48;
const Y1 = 496;

interface RunwayPieceSpec {
  crop: [number, number, number, number];
  name: string;
  priceDisplay: string;
  priceNum: number;
  brand: string;
  detailSummary: string;
  friendOwner: string;
  productId?: string;
  storeUrl?: string;
  imageUrl?: string;
  recSizeOverride?: string;
}

const BASE_RUNWAY_ITEMS: RunwayPieceSpec[] = [
  {
    crop: [26, 224, 24, 218],
    name: "Cornelia Mini Dress - Red",
    priceDisplay: "$132",
    priceNum: 132,
    brand: "Babyboo Fashion",
    detailSummary: "100% Non-Stretch Crepe • Boned Corset • Lace-Up Back",
    friendOwner: "MAYA-GWO",
    productId: "prod-babyboo-cornelia-red",
    storeUrl:
      "https://babyboofashion-com-au.myshopify.com/products/cornelia-mini-dress-red",
    imageUrl: `${BASE_PATH}/models/catalog/cornelia_2.webp`,
    recSizeOverride: "S",
  },
  {
    crop: [304, 412, 22, 236],
    name: "Satin Afterparty Lounge Pants",
    priceDisplay: "$92",
    priceNum: 92,
    brand: "Aritzia",
    detailSummary: "Fluid Acetate Satin • High-Rise Wide Leg",
    friendOwner: "MAYA-GWO",
  },
  {
    crop: [530, 666, 12, 242],
    name: "Sage Pleated Maxi Dress",
    priceDisplay: "$168",
    priceNum: 168,
    brand: "Reformation",
    detailSummary: "Lightweight Georgette • Knife-Pleat Skirt",
    friendOwner: "CHLOE-GWO",
  },
  {
    crop: [752, 922, 100, 146],
    name: "Sculpted Gold Waist Belt",
    priceDisplay: "$48",
    priceNum: 48,
    brand: "GWO Studio",
    detailSummary: "18k Gold-Plated Clasp • Adjustable Cincher",
    friendOwner: "CHLOE-GWO",
  },
  {
    crop: [70, 176, 246, 466],
    name: "Champagne Belted Trench Dress",
    priceDisplay: "$154",
    priceNum: 154,
    brand: "Princess Polly",
    detailSummary: "Structured Satin Twill • Tie-Waist Lapel",
    friendOwner: "MAYA-GWO",
  },
  {
    crop: [294, 422, 294, 432],
    name: "Structured Cream Mini Bag",
    priceDisplay: "$78",
    priceNum: 78,
    brand: "GWO Studio",
    detailSummary: "Smooth Vegan Calfskin • Top-Handle Lock",
    friendOwner: "MAYA-GWO",
  },
  {
    crop: [508, 688, 240, 452],
    name: "Soft Blush Billow Blouse",
    priceDisplay: "$74",
    priceNum: 74,
    brand: "Aritzia",
    detailSummary: "Sheer Chiffon Drape • Mock-Neck Cuff",
    friendOwner: "SOFIA-GWO",
  },
  {
    crop: [780, 890, 252, 466],
    name: "Relaxed Tie-Waist Trousers",
    priceDisplay: "$86",
    priceNum: 86,
    brand: "Aritzia",
    detailSummary: "Crepette Drape Suiting • Relaxed Taper",
    friendOwner: "SOFIA-GWO",
  },
  {
    crop: [64, 178, 484, 698],
    name: "Powder Blue Wool Overcoat",
    priceDisplay: "$198",
    priceNum: 198,
    brand: "Aritzia",
    detailSummary: "Double-Faced Merino Wool • Tailored Lapel",
    friendOwner: "CHLOE-GWO",
  },
  {
    crop: [316, 396, 482, 698],
    name: "Ivory Straight Tailored Pants",
    priceDisplay: "$88",
    priceNum: 88,
    brand: "Princess Polly",
    detailSummary: "High-Waist Suiting • Petite-Friendly Straight Leg",
    friendOwner: "CHLOE-GWO",
  },
  {
    crop: [530, 672, 508, 682],
    name: "Ivory Ruffle Knit Top",
    priceDisplay: "$68",
    priceNum: 68,
    brand: "SKIMS",
    detailSummary: "Stretch Ribbed Jersey • Asymmetric Ruffle Trim",
    friendOwner: "SOFIA-GWO",
  },
  {
    crop: [754, 916, 484, 700],
    name: "Flowy Pleated Maxi Skirt",
    priceDisplay: "$96",
    priceNum: 96,
    brand: "Reformation",
    detailSummary: "Sunburst Accordion Pleats • Elasticized Waist",
    friendOwner: "SOFIA-GWO",
  },
];

const OCCASION_PILLS = [
  { label: "Party • Red Mini", lookIdx: 0 },
  { label: "Evening", lookIdx: 1 },
  { label: "Date Night", lookIdx: 2 },
  { label: "Work / Chic", lookIdx: 3 },
  { label: "Outerwear", lookIdx: 4 },
  { label: "Weekend", lookIdx: 5 },
];

const KX = [1.22, 0.72, 0.48, 0.33, 0.22, 0.14, 0.08];
const KF = [1.08, 0.96, 0.85, 0.77, 0.71, 0.66, 0.62];
const KH = [1.1, 0.91, 0.68, 0.52, 0.4, 0.31, 0.23];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const NS = "http://www.w3.org/2000/svg";
const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function createNestedSvgCrop(
  href: string,
  x0: number,
  y0: number,
  w: number,
  h: number,
  sheetW: number,
  sheetH: number,
  faceSpec?: { cx: number; cy: number; fw: number; fh: number }
): { root: SVGSVGElement; faceEl: SVGImageElement | null } {
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

  let faceEl: SVGImageElement | null = null;
  if (faceSpec) {
    faceEl = document.createElementNS(NS, "image");
    faceEl.setAttribute("x", String(faceSpec.cx - faceSpec.fw / 2));
    faceEl.setAttribute("y", String(faceSpec.cy - faceSpec.fh / 2));
    faceEl.setAttribute("width", String(faceSpec.fw));
    faceEl.setAttribute("height", String(faceSpec.fh));
    faceEl.setAttribute("preserveAspectRatio", "none");
    faceEl.style.display = "none";
    f.append(faceEl);
  }

  s.append(f);
  return { root: s, faceEl };
}

export function GwoRunwayLookbook() {
  const {
    user,
    products,
    addToBag,
    customAvatar,
    setAvatarModalOpen,
    setAddUrlModalOpen,
    openAvatar360,
  } = useGwo();

  const activeBust = user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches;
  const activeWaist = user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches;
  const activeHips = user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches;
  const activeHeight = user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches;
  const activeHeightStr = `${Math.floor(activeHeight / 12)}'${Math.round(
    activeHeight % 12
  )}"`;
  const recSize = deriveStandardApparelSize({
    bustInches: activeBust,
    waistInches: activeWaist,
    hipsInches: activeHips,
  });

  // Live-hydrate Runway items from shared catalog `products` so scraped pictures, pricing, and details are ALWAYS live!
  const hydratedItems: RunwayPieceSpec[] = useMemo(() => {
    const byId = new Map<string, Product>(products.map((p) => [p.id, p]));
    return BASE_RUNWAY_ITEMS.map((base) => {
      if (!base.productId) return base;
      const liveProd = byId.get(base.productId);
      if (!liveProd) return base;
      const fit = analyzeExactAvatarFit(
        {
          bustInches: activeBust,
          waistInches: activeWaist,
          hipsInches: activeHips,
          heightInches: activeHeight,
          shoeSize: user?.shoeSize || "7.5",
        },
        liveProd
      );
      const detail =
        liveProd.fitMetadata?.fabricComposition ||
        liveProd.fitMetadata?.descriptionSummary ||
        base.detailSummary;
      return {
        ...base,
        name: liveProd.title || base.name,
        brand: liveProd.brand || base.brand,
        priceNum: liveProd.price || base.priceNum,
        priceDisplay: `$${liveProd.price || base.priceNum}`,
        imageUrl: liveProd.imageUrl || base.imageUrl,
        storeUrl: liveProd.canonicalUrl || base.storeUrl,
        recSizeOverride: fit.recommendedSize || base.recSizeOverride,
        detailSummary: detail,
      };
    });
  }, [activeBust, activeHeight, activeHips, activeWaist, products, user?.shoeSize]);

  // All scraped & pulled store products (including newly imported URLs!) with full photos, prices & details
  const scrapedStoreCatalog = useMemo(
    () => products.filter((p) => p.sourceType === "scraped_url"),
    [products]
  );

  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const faceElsRef = useRef<Array<SVGImageElement | null>>([]);
  const jumpLookRef = useRef<((lookOffset: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const [activeLookIdx, setActiveLookIdx] = useState(0);

  const hydratedItemsRef = useRef<RunwayPieceSpec[]>(hydratedItems);
  hydratedItemsRef.current = hydratedItems;

  const addItemIndexToUnifiedBag = useCallback(
    (idx: number) => {
      const item = hydratedItemsRef.current[idx];
      if (!item) return;
      addToBag({
        productId: item.productId,
        title: item.name,
        brand: item.brand,
        price: item.priceNum,
        size: item.recSizeOverride || recSize,
        imageUrl: item.imageUrl,
        storeUrl: item.storeUrl,
        friendRef: item.friendOwner,
      });
    },
    [addToBag, recSize]
  );

  const handleBagCurrentOutfit = useCallback(() => {
    const idx = Math.round(wrap(currentPosRef.current, LOOKS.length)) % LOOKS.length;
    addItemIndexToUnifiedBag(idx * 2);
    addItemIndexToUnifiedBag(idx * 2 + 1);
  }, [addItemIndexToUnifiedBag]);

  const openRunwayItem360Ref = useRef<(idx: number) => void>(() => {});
  openRunwayItem360Ref.current = (idx: number) => {
    const item = hydratedItemsRef.current[idx];
    if (!item) return;
    const matched = item.productId
      ? products.find((p) => p.id === item.productId)
      : null;
    const prod =
      matched ||
      buildSynthetic3DProductFromPiece({
        id: `runway-piece-${idx}`,
        name: item.name,
        brand: item.brand,
        price: item.priceNum,
        imageUrl: item.imageUrl,
        storeUrl: item.storeUrl,
      });
    openAvatar360({
      title: `${item.brand} — ${item.name}`,
      primaryProduct: prod,
      initialAngleMode: "split",
    });
  };

  useEffect(() => {
    faceElsRef.current.forEach((el) => {
      if (!el) return;
      if (customAvatar?.faceOvalDataUrl) {
        el.setAttribute("href", customAvatar.faceOvalDataUrl);
        el.style.display = "block";
      } else {
        el.removeAttribute("href");
        el.style.display = "none";
      }
    });
  }, [customAvatar]);

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
    const createdFaceEls: Array<SVGImageElement | null> = [];

    const people = LOOKS.map(([a, b], i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);
      const [cx, cy, fw, fh] = RUNWAY_FACE_COORDS[i];
      const { root, faceEl } = createNestedSvgCrop(
        MODELS_SHEET,
        a,
        Y0,
        b - a,
        Y1 - Y0,
        960,
        540,
        { cx, cy, fw, fh }
      );
      createdFaceEls.push(faceEl);
      e.append(root);
      line.append(e);
      return { e, r: (b - a) / (Y1 - Y0), f: "", o: "" };
    });
    faceElsRef.current = createdFaceEls;

    if (customAvatar?.faceOvalDataUrl) {
      createdFaceEls.forEach((el) => {
        if (!el) return;
        el.setAttribute("href", customAvatar.faceOvalDataUrl);
        el.style.display = "block";
      });
    }

    const cards = hydratedItemsRef.current.map((item, i) => {
      const [a, b, c, d] = item.crop;
      const pdpHref = item.productId
        ? `${BASE_PATH}/product?id=${encodeURIComponent(item.productId)}&view=3d`
        : `${BASE_PATH}/product?name=${encodeURIComponent(
            item.name
          )}&price=${encodeURIComponent(item.priceDisplay)}&view=3d`;
      const tryHref = item.productId
        ? `${BASE_PATH}/?try=${encodeURIComponent(item.productId)}`
        : `${BASE_PATH}/`;
      const sizeTag = item.recSizeOverride || recSize;

      const e = document.createElement("article");
      e.className = "mv-card" + (i % 2 ? " alt" : "");
      e.dataset.idx = String(i);
      e.innerHTML = `<div class="mv-card-top"><button class="mv-fav" type="button" aria-pressed="false" aria-label="Save ${escapeHtml(
        item.name
      )}"><svg viewBox="0 0 24 24"><path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z"/></svg></button>${
        item.productId
          ? `<span class="mv-store-inline-badge">Size ${escapeHtml(
              sizeTag
            )} • Exact Fit</span>`
          : `<span class="text-[10px] font-bold text-[#686D76]">Fit: ${escapeHtml(
              sizeTag
            )}</span>`
      }</div><a class="mv-shot" href="${pdpHref}" title="Open Full Product Details & 3D Fit"></a><div class="mv-meta"><div class="min-w-0 flex-1"><h3><a class="mv-title-link" href="${pdpHref}">${escapeHtml(
        item.name
      )}</a></h3><span class="mv-price-line">${escapeHtml(
        item.brand
      )} • ${escapeHtml(item.priceDisplay)} • Size ${escapeHtml(
        sizeTag
      )}</span><span class="mv-detail-line">${escapeHtml(
        item.detailSummary
      )}</span></div><button class="mv-add" type="button" data-idx="${i}">+ Bag</button></div><div class="mv-card-actions"><button class="mv-pill-link fit mv-open-360" type="button" data-idx="${i}">360° F/B</button><a class="mv-pill-link" href="${pdpHref}">Details</a>${
        item.storeUrl
          ? `<a class="mv-pill-link buy" href="${escapeHtml(
              item.storeUrl
            )}" target="_blank" rel="noopener noreferrer">Buy ↗</a>`
          : `<a class="mv-pill-link" href="${tryHref}">Try On</a>`
      }</div>`;

      const shot = e.querySelector(".mv-shot");
      if (shot) {
        if (item.imageUrl) {
          const realImg = document.createElement("img");
          realImg.className = "mv-real-photo";
          realImg.src = item.imageUrl;
          realImg.alt = item.name;
          realImg.decoding = "async";
          realImg.onerror = () => {
            realImg.remove();
            const { root } = createNestedSvgCrop(
              PIECES_SHEET,
              a,
              c,
              b - a,
              d - c,
              960,
              720
            );
            shot.append(root);
          };
          shot.append(realImg);
        } else {
          const { root } = createNestedSvgCrop(
            PIECES_SHEET,
            a,
            c,
            b - a,
            d - c,
            960,
            720
          );
          shot.append(root);
        }
      }
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
      const spinBtn = targetEl.closest(".mv-open-360") as HTMLElement | null;
      if (spinBtn) {
        openRunwayItem360Ref.current(Number(spinBtn.dataset.idx || 0));
      }
    };
    rail.addEventListener("click", onRailClick);

    let W = 0;
    let H = 0;
    let base = 0;
    let cardS = 0;
    let side = false;
    let dirty = true;
    let p = currentPosRef.current;
    let target = currentPosRef.current;
    let last = 0;
    let lastReportedIdx = Math.round(wrap(p, N)) % N;

    jumpLookRef.current = (lookIndex: number) => {
      const currMod = wrap(Math.round(target), N);
      let delta = lookIndex - currMod;
      if (delta < 0) delta += N;
      target = Math.round(target) + delta;
    };

    const size = () => {
      W = stage.clientWidth;
      H = stage.clientHeight;
      base = H * 0.94;
      side = window.innerWidth <= 820;
      people.forEach((m) => {
        m.e.style.width = `${base * m.r}px`;
        m.e.style.height = `${base}px`;
      });
      cardS = side ? 232 : rail.clientHeight / 3;
      cards.forEach((c) => {
        c.style.height = side ? "258px" : `${cardS}px`;
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
        const t = k - a;
        const L = (v: number[]) => v[a] + (v[Math.min(a + 1, 6)] - v[a]) * t;

        const sc = L(KH);
        const x = W * L(KX) - base * m.r * sc * 0.5;
        const y = H * L(KF) - base * sc;
        const bl = L(KB);
        const op = d < -0.5 ? Math.max(0, 1 + (d + 0.5) * 2.2) : L(KO);
        const f = bl > 0.25 ? `blur(${bl.toFixed(1)}px)` : "none";
        const o = op.toFixed(3);

        m.e.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(
          1
        )}px,0) scale(${sc.toFixed(4)})`;
        m.e.style.zIndex = String(Math.round((6 - k) * 10));
        if (m.f !== f) {
          m.f = f;
          m.e.style.filter = f;
        }
        if (m.o !== o) {
          m.o = o;
          m.e.style.opacity = o;
        }
      });

      const M = cards.length;
      const q = wrap(p * 2, M);
      cards.forEach((c, i) => {
        let d = wrap(i - q, M);
        if (d > M - 3) d -= M;
        const pos = (d * cardS).toFixed(1);
        c.style.transform = side
          ? `translate3d(${pos}px,0,0)`
          : `translate3d(0,${pos}px,0)`;
      });

      const r = wrap(p, N);
      const rollH = side ? 26 : 32;
      roll.style.transform = `translate3d(0,${(
        -(r > N - 1 ? r : Math.round(r)) * rollH
      ).toFixed(1)}px,0)`;
      dirty = false;
    };

    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;
    let drag = false;
    let sx = 0;
    let sy = 0;
    let s0 = 0;
    let moved = false;

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      cx = mx = e.clientX - r.left;
      cy = my = e.clientY - r.top;
      ring.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      ring.classList.add("show");
    };

    const onLeave = () => ring.classList.remove("show", "drag");

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      if (!drag) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.hypot(dx, dy) > 6) moved = true;
      target = s0 + dx / Math.max(220, W * 0.34);
    };

    const onDown = (e: PointerEvent) => {
      drag = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      s0 = target;
      ring.classList.add("drag");
      stage.setPointerCapture(e.pointerId);
    };

    const onRelease = (e: PointerEvent) => {
      if (!drag) return;
      drag = false;
      ring.classList.remove("drag");
      if (!moved) {
        const card = (
          document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        )?.closest(".mv-m") as HTMLElement | null;
        const d = card
          ? wrap(Number(card.dataset.i) - Math.round(target), N)
          : 0;
        target = Math.round(target) + (d && d < N - 1 ? d : 1);
      } else {
        target = Math.round(target);
      }
    };

    let wheelAcc = 0;
    let wheelT: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (side) return;
      e.preventDefault();
      const d =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      wheelAcc += d * (e.deltaMode === 1 ? 32 : 1);
      if (Math.abs(wheelAcc) > 55) {
        target = Math.round(target) + Math.sign(wheelAcc);
        wheelAcc = 0;
      }
      if (wheelT) clearTimeout(wheelT);
      wheelT = setTimeout(() => {
        wheelAcc = 0;
      }, 160);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      const step =
        e.key === "ArrowRight" || e.key === "ArrowDown"
          ? 1
          : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0;
      if (step) {
        e.preventDefault();
        target = Math.round(target) + step;
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
      const dt = Math.min(50, now - (last || now));
      last = now;
      const diff = target - p;
      if (Math.abs(diff) > 0.0004) {
        p = calm ? target : p + diff * (1 - Math.pow(0.0012, dt / 1000));
        dirty = true;
      } else if (p !== target) {
        p = target;
        dirty = true;
      }
      if (dirty) {
        paint();
      }
      if (Math.abs(mx - cx) > 0.25 || Math.abs(my - cy) > 0.25) {
        cx += (mx - cx) * 0.35;
        cy += (my - cy) * 0.35;
        ring.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(
          1
        )}px,0)`;
      }
      rafId = requestAnimationFrame(frame);
    };

    size();
    paint();
    rafId = requestAnimationFrame(frame);

    return () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addItemIndexToUnifiedBag, hydratedItems]);

  const currentHero = hydratedItems[activeLookIdx * 2] || hydratedItems[0];
  const currentOutfitPrice =
    (hydratedItems[activeLookIdx * 2]?.priceNum || 0) +
    (hydratedItems[activeLookIdx * 2 + 1]?.priceNum || 0);
  const current3dHref = currentHero.productId
    ? `/product?id=${encodeURIComponent(currentHero.productId)}&view=3d`
    : `/product?name=${encodeURIComponent(
        currentHero.name
      )}&price=${encodeURIComponent(currentHero.priceDisplay)}&view=3d`;
  const currentTryHref = currentHero.productId
    ? `/?try=${encodeURIComponent(currentHero.productId)}`
    : "/";

  return (
    <div className="mv-page">
      <main className="mv-main">
        <div className="mv-left-col">
          {/* Dedicated Top Control Bar (Never Overlaps Runway Models!) */}
          <div className="mv-top-bar space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141518] mr-1">
                  For You Runway
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/[0.07] text-[11px] font-bold text-[#244B3B]">
                  <Ruler className="w-3 h-3" /> {activeHeightStr} • {activeBust}&quot; B •{" "}
                  {activeWaist}&quot; W • {activeHips}&quot; H (Size {recSize})
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#F7F8FA] border border-black/[0.08] text-[11px] font-bold text-[#141518] cursor-pointer"
                >
                  <img
                    src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                    alt="Avatar"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  {customAvatar ? "Featuring You ✓" : "Your Avatar"}
                </button>
                <Link
                  href="/feed"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-[11px] font-bold"
                >
                  <Sparkles className="w-3 h-3" /> AI Endless Feed →
                </Link>
                <button
                  type="button"
                  onClick={() => setAddUrlModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Pull Store Clothing
                </button>
              </div>
            </div>

            {/* 1-Tap Occasion Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {OCCASION_PILLS.map((pill) => {
                const active = activeLookIdx === pill.lookIdx;
                return (
                  <button
                    key={pill.label}
                    type="button"
                    onClick={() => jumpLookRef.current?.(pill.lookIdx)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                      active
                        ? "bg-[#141518] text-white shadow-xs"
                        : "bg-white hover:bg-[#F4F5F7] text-[#686D76] hover:text-[#141518] border border-black/[0.07]"
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pure Unobstructed Center Runway Stage */}
          <section
            className="mv-stage"
            ref={stageRef}
            aria-label="Recommended outfits. Drag, scroll or use arrow keys."
            tabIndex={0}
          >
            <div className="mv-line" ref={lineRef} />
            <div className="mv-ring" ref={ringRef} />
          </section>

          {/* Dedicated Bottom Checkout & Fit Action Dock (Never Overlaps Model Feet!) */}
          <div className="mv-bottom-bar">
            <div className="flex flex-wrap items-center gap-2">
              <div className="mv-look" aria-live="polite">
                <span>Outfit</span>
                <span className="mv-win">
                  <span className="mv-roll" ref={rollRef} />
                </span>
              </div>
              {currentHero.productId && (
                <span className="px-2.5 py-1 rounded-full bg-[#C80815] text-white text-[11px] font-bold shadow-xs">
                  {currentHero.brand} • Size {currentHero.recSizeOverride || recSize} Exact Fit
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {currentHero.storeUrl && (
                <a
                  href={currentHero.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  id="gwo-runway-buy-hero-btn"
                  className="px-3.5 py-2 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  Buy {currentHero.name.split(" - ")[0]} ({currentHero.priceDisplay}){" "}
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={handleBagCurrentOutfit}
                className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5" /> + Bag Outfit ($
                {currentOutfitPrice})
              </button>

              <button
                type="button"
                id="gwo-runway-360-btn"
                onClick={() => {
                  const p0 = hydratedItems[activeLookIdx * 2];
                  const p1 = hydratedItems[activeLookIdx * 2 + 1];
                  const m0 = p0?.productId
                    ? products.find((p) => p.id === p0.productId)
                    : null;
                  const primary =
                    m0 ||
                    buildSynthetic3DProductFromPiece({
                      id: `runway-look-${activeLookIdx}-0`,
                      name: p0?.name || "Runway Look",
                      brand: p0?.brand,
                      price: p0?.priceNum || 120,
                      imageUrl: p0?.imageUrl,
                      storeUrl: p0?.storeUrl,
                    });
                  const comps = p1
                    ? [
                        buildSynthetic3DProductFromPiece({
                          id: `runway-look-${activeLookIdx}-1`,
                          name: p1.name,
                          brand: p1.brand,
                          price: p1.priceNum,
                        }),
                      ]
                    : [];
                  openAvatar360({
                    title: `Runway Outfit 0${activeLookIdx + 1}: ${primary.title}`,
                    primaryProduct: primary,
                    companionProducts: comps,
                    initialAngleMode: "split",
                  });
                }}
                className="px-3 py-2 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer"
              >
                <Rotate3d className="w-3.5 h-3.5" /> 360° Front &amp; Back
              </button>

              <Link
                href={current3dHref}
                id="gwo-runway-3d-fit-btn"
                className="px-3 py-2 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/[0.08] text-[#141518] text-xs font-bold inline-flex items-center gap-1 shadow-xs"
              >
                <Box className="w-3.5 h-3.5 text-[#244B3B]" /> 3D Fit →
              </Link>

              <Link
                href={currentTryHref}
                id="gwo-runway-try-closet-btn"
                className="px-3 py-2 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/[0.08] text-[#244B3B] text-xs font-bold inline-flex items-center gap-1 shadow-xs"
              >
                <Rotate3d className="w-3.5 h-3.5" /> Closet →
              </Link>
            </div>
          </div>
        </div>

        <aside
          className="mv-rail"
          ref={railRef}
          aria-label="Pieces in this outfit"
        />
      </main>

      {/* ==================== SCRAPED & PULLED STORE PRODUCTS RACK (FULL PHOTOS, PRICING & EXTRACTED DETAILS) ==================== */}
      {scrapedStoreCatalog.length > 0 && (
        <section
          id="gwo-runway-scraped-rack"
          className="max-w-[1520px] w-full mx-auto px-4 sm:px-6 py-6 space-y-3 border-t border-black/[0.07] bg-[#F4F5F7]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#244B3B]">
                Live Scraped Store Clothing ({scrapedStoreCatalog.length} Verified Pieces)
              </p>
              <h2 className="text-base sm:text-lg font-bold text-[#141518]">
                Pulled Store Garments — Full Photos, Exact Pricing &amp; Extracted Fit Details
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setAddUrlModalOpen(true)}
              className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Paste Any Store URL
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {scrapedStoreCatalog.map((prod) => {
              const fit = analyzeExactAvatarFit(
                {
                  bustInches: activeBust,
                  waistInches: activeWaist,
                  hipsInches: activeHips,
                  heightInches: activeHeight,
                  shoeSize: user?.shoeSize || "7.5",
                },
                prod
              );
              const photoCount = prod.fitMetadata?.galleryImages?.length || (prod.imageUrl ? 1 : 0);
              return (
                <article
                  key={prod.id}
                  data-scraped-card="true"
                  className="rounded-2xl bg-white border border-black/[0.08] shadow-xs overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* Pure Unobstructed Store Product Photo */}
                    <div className="h-52 bg-[#F7F8FA] border-b border-black/[0.06] overflow-hidden">
                      <GarmentArtwork product={prod} className="w-full h-full" />
                    </div>

                    <div className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-bold">
                        <span className="text-[#244B3B] truncate">{prod.brand}</span>
                        <span className="text-sm font-extrabold text-[#141518] shrink-0">
                          ${prod.price}
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-[#141518] line-clamp-1">
                        {prod.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-1 text-[10.5px] font-bold">
                        <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232]">
                          Size {fit.recommendedSize} ({fit.confidencePct}% Fit)
                        </span>
                        {photoCount > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#F1F2F5] text-[#5C6068] inline-flex items-center gap-1">
                            <Images className="w-2.5 h-2.5" /> {photoCount} Angles
                          </span>
                        )}
                      </div>

                      {/* Extracted Fabric, Model & Description Details */}
                      {prod.fitMetadata?.fabricComposition && (
                        <p className="text-[11px] font-semibold text-[#141518] truncate">
                          {prod.fitMetadata.fabricComposition}
                        </p>
                      )}
                      {prod.fitMetadata?.descriptionSummary && (
                        <p className="text-[11px] text-[#5C6068] line-clamp-2 leading-snug">
                          {prod.fitMetadata.descriptionSummary}
                        </p>
                      )}
                      {prod.fitMetadata?.modelStats?.rawText && (
                        <p className="text-[10.5px] font-medium text-[#244B3B] truncate">
                          {prod.fitMetadata.modelStats.rawText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-3.5 pb-3.5 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        openAvatar360({
                          title: `${prod.brand} — ${prod.title}`,
                          primaryProduct: prod,
                          initialAngleMode: "split",
                        })
                      }
                      className="flex-1 py-2 px-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Rotate3d className="w-3 h-3 text-[#A7D7C5]" /> 360° F/B
                    </button>

                    <Link
                      href={`/product?id=${encodeURIComponent(prod.id)}&view=3d`}
                      className="py-2 px-2.5 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] text-[#1D4232] text-[11px] font-bold inline-flex items-center gap-1"
                    >
                      Details
                    </Link>

                    <button
                      type="button"
                      onClick={() =>
                        addToBag({
                          productId: prod.id,
                          title: prod.title,
                          brand: prod.brand,
                          price: prod.price,
                          size: fit.recommendedSize,
                          imageUrl: prod.imageUrl,
                          storeUrl: prod.canonicalUrl,
                        })
                      }
                      className="py-2 px-2.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[11px] font-bold text-[#141518] cursor-pointer"
                    >
                      + Bag
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

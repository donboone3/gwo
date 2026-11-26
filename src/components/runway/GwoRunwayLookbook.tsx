"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Instagram,
  Plus,
  Rotate3d,
  Ruler,
  ShoppingBag,
  Sparkles,
  Store,
  Wand2,
  X,
} from "lucide-react";
import "./runway-lookbook.css";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  DEFAULT_AVATAR_MEASUREMENTS,
  deriveStandardApparelSize,
} from "@/lib/catalog/sizing";
import {
  AiRunwayOutfit,
  buildAiRunwayOutfits,
} from "@/lib/stylist/runway-ai-outfits";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { ARCHETYPE_META } from "@/lib/social/social-style-dna";
import { SIGNATURE_BADGE_URL } from "../vell/vell-data";
import { Product } from "@/lib/types";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const CUSTOM_RUNWAY_KEY = "gwo_custom_runway_outfits_v1";

interface CustomRunwayOutfitSaved {
  id: string;
  title: string;
  productIds: string[];
  frontAvatarUrl: string;
  backAvatarUrl: string;
}

interface RailCardSpec {
  outfitIndex: number;
  product: Product;
  recommendedSize: string;
  confidencePct: number;
  frontAvatarUrl: string;
  backAvatarUrl: string;
}

const KX = [1.22, 0.72, 0.48, 0.33, 0.22, 0.14, 0.08];
const KF = [1.08, 0.96, 0.85, 0.77, 0.71, 0.66, 0.62];
const KH = [1.1, 0.91, 0.68, 0.52, 0.4, 0.31, 0.23];
const KB = [0, 0, 1.5, 4, 8, 12, 17];
const KO = [1, 1, 1, 1, 0.86, 0.5, 0];

const wrap = (x: number, n: number) => ((x % n) + n) % n;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function GwoRunwayLookbook() {
  const {
    user,
    products,
    addToBag,
    customAvatar,
    setAvatarModalOpen,
    setAddUrlModalOpen,
    socialDna,
    setSocialModalOpen,
    openAvatar360,
    openDropshipCheckout,
    showToast,
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

  const [vibeInput, setVibeInput] = useState("");
  const [appliedVibe, setAppliedVibe] = useState("");
  const [extraAiCount, setExtraAiCount] = useState(0);
  const [runwayAngle, setRunwayAngle] = useState<"front" | "back">("front");
  const [activeLookIdx, setActiveLookIdx] = useState(0);

  // Custom Outfit Builder Modal state
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [selectedCustomIds, setSelectedCustomIds] = useState<string[]>([
    "prod-ae-espresso-corset",
    "prod-ae-champagne-trousers",
    "prod-ae-gold-strappy-heels",
  ]);
  const [savedCustomOutfits, setSavedCustomOutfits] = useState<
    CustomRunwayOutfitSaved[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(CUSTOM_RUNWAY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedCustomOutfits(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistCustomRunway = useCallback(
    (next: CustomRunwayOutfitSaved[]) => {
      setSavedCustomOutfits(next);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(CUSTOM_RUNWAY_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
    },
    []
  );

  // Boutique catalog for building outfits (14 verified AliExpress SKUs + scraped store pieces)
  const boutiqueCatalog = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of buildTopLineAliExpressDropshipCatalog()) {
      map.set(p.id, p);
    }
    for (const p of products) {
      if (
        p.sourceType === "aliexpress_dropship" ||
        p.sourceType === "scraped_url"
      ) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [products]);

  const avatarStats = useMemo(
    () => ({
      heightInches: activeHeight,
      bustInches: activeBust,
      waistInches: activeWaist,
      hipsInches: activeHips,
      shoeSize: user?.shoeSize || "7.5",
    }),
    [activeBust, activeHeight, activeHips, activeWaist, user?.shoeSize]
  );

  // Build full Runway lineup: AI-Recommended AliExpress Outfits + User-Added Outfits
  const runwayOutfits: AiRunwayOutfit[] = useMemo(() => {
    const baseAi = buildAiRunwayOutfits({
      catalog: products,
      avatar: avatarStats,
      socialDna,
      vibePrompt: appliedVibe,
      extraGeneratedCount: extraAiCount,
    });

    const byId = new Map<string, Product>(boutiqueCatalog.map((p) => [p.id, p]));
    const customHydrated: AiRunwayOutfit[] = savedCustomOutfits
      .map((co, idx) => {
        const resolved = co.productIds
          .map((id) => byId.get(id))
          .filter((p): p is Product => Boolean(p));
        if (resolved.length === 0) return null;
        const pieces = resolved.map((prod) => {
          const fit = analyzeExactAvatarFit(avatarStats, prod);
          return {
            product: prod,
            recommendedSize: fit.recommendedSize,
            confidencePct: fit.confidencePct,
            fitVerdict: fit.headlineVerdict,
          };
        });
        return {
          id: co.id,
          outfitNumber: baseAi.length + idx + 1,
          title: co.title,
          occasion: "Added Outfit",
          archetype: socialDna.primaryArchetype,
          archetypeLabel: "Custom Added",
          aiReason: `Custom outfit added to your Runway (${pieces.length} pieces).`,
          fitHeadline: `Exact ${activeHeightStr} Fit`,
          matchScorePct: 98,
          frontAvatarUrl: co.frontAvatarUrl,
          backAvatarUrl: co.backAvatarUrl,
          pieces,
          totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
        } satisfies AiRunwayOutfit;
      })
      .filter((x): x is AiRunwayOutfit => x !== null);

    // Also include Babyboo Cornelia Red Mini Dress look so existing store favorites stay right on the Runway!
    const corneliaProd = products.find(
      (p) => p.id === "prod-babyboo-cornelia-red"
    );
    const goldHeels = byId.get("prod-ae-gold-strappy-heels");
    const crescentBag = byId.get("prod-ae-burgundy-crescent-bag");
    const corneliaOutfit: AiRunwayOutfit[] = corneliaProd
      ? [
          {
            id: "runway-babyboo-cornelia",
            outfitNumber: baseAi.length + customHydrated.length + 1,
            title: "Cornelia Crimson Mini & 14k Gold Stilettos",
            occasion: "Party • Red Mini",
            archetype: "siren_glam",
            archetypeLabel: "Boutique Featured",
            aiReason:
              "Boned corset crimson mini paired with metallic 14k strappy heels.",
            fitHeadline: `Exact ${activeHeightStr} Petite Fit`,
            matchScorePct: 96,
            frontAvatarUrl: `${BASE_PATH}/models/signature/look_8.webp`,
            backAvatarUrl: `${BASE_PATH}/models/signature/look_8_back.webp`,
            pieces: [corneliaProd, goldHeels, crescentBag]
              .filter((p): p is Product => Boolean(p))
              .map((prod) => {
                const fit = analyzeExactAvatarFit(avatarStats, prod);
                return {
                  product: prod,
                  recommendedSize: fit.recommendedSize,
                  confidencePct: fit.confidencePct,
                  fitVerdict: fit.headlineVerdict,
                };
              }),
            totalPriceUsd: [corneliaProd, goldHeels, crescentBag]
              .filter((p): p is Product => Boolean(p))
              .reduce((s, p) => s + p.price, 0),
          },
        ]
      : [];

    const combined = [...customHydrated, ...baseAi, ...corneliaOutfit];
    return combined.map((o, idx) => ({ ...o, outfitNumber: idx + 1 }));
  }, [
    activeHeightStr,
    appliedVibe,
    avatarStats,
    boutiqueCatalog,
    extraAiCount,
    products,
    savedCustomOutfits,
    socialDna,
  ]);

  // Synchronized 3-piece-per-outfit rail cards (so all 3 visible slots in .mv-rail show the active outfit's pieces!)
  const railCards: RailCardSpec[] = useMemo(() => {
    const list: RailCardSpec[] = [];
    runwayOutfits.forEach((outfit, oIdx) => {
      const basePieces = outfit.pieces;
      if (basePieces.length === 0) return;
      for (let slot = 0; slot < 3; slot++) {
        const entry = basePieces[slot % basePieces.length];
        list.push({
          outfitIndex: oIdx,
          product: entry.product,
          recommendedSize: entry.recommendedSize,
          confidencePct: entry.confidencePct,
          frontAvatarUrl: outfit.frontAvatarUrl,
          backAvatarUrl: outfit.backAvatarUrl,
        });
      }
    });
    return list;
  }, [runwayOutfits]);

  const stageRef = useRef<HTMLElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLSpanElement | null>(null);
  const modelImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const faceImgElsRef = useRef<Array<HTMLImageElement | null>>([]);
  const jumpLookRef = useRef<((lookIndex: number) => void) | null>(null);
  const currentPosRef = useRef(0);

  const railCardsRef = useRef<RailCardSpec[]>(railCards);
  railCardsRef.current = railCards;

  const addSinglePieceToBag = useCallback(
    (cardIdx: number, openCheckoutImmediately = false) => {
      const spec = railCardsRef.current[cardIdx];
      if (!spec) return;
      addToBag({
        productId: spec.product.id,
        title: spec.product.title,
        brand: spec.product.brand || "GWO Boutique",
        price: spec.product.price,
        size: spec.recommendedSize || recSize,
        imageUrl: spec.product.imageUrl,
        avatarFrontUrl: spec.frontAvatarUrl,
        avatarBackUrl: spec.backAvatarUrl,
        storeUrl: spec.product.canonicalUrl,
      });
      if (openCheckoutImmediately) {
        openDropshipCheckout("checkout");
      }
    },
    [addToBag, openDropshipCheckout, recSize]
  );

  const handleAddOrBuyFullOutfit = useCallback(
    (openCheckoutImmediately: boolean) => {
      const N = runwayOutfits.length;
      if (N === 0) return;
      const idx = Math.round(wrap(currentPosRef.current, N)) % N;
      const outfit = runwayOutfits[idx];
      if (!outfit) return;
      outfit.pieces.forEach((p) => {
        addToBag({
          productId: p.product.id,
          title: p.product.title,
          brand: p.product.brand || "GWO Boutique",
          price: p.product.price,
          size: p.recommendedSize || recSize,
          imageUrl: p.product.imageUrl,
          avatarFrontUrl: outfit.frontAvatarUrl,
          avatarBackUrl: outfit.backAvatarUrl,
          storeUrl: p.product.canonicalUrl,
        });
      });
      if (openCheckoutImmediately) {
        openDropshipCheckout("checkout");
      } else {
        showToast(
          `Added all ${outfit.pieces.length} pieces of "${outfit.title}" to Bag!`
        );
      }
    },
    [addToBag, openDropshipCheckout, recSize, runwayOutfits, showToast]
  );

  const openRailCard360Ref = useRef<(cardIdx: number) => void>(() => {});
  openRailCard360Ref.current = (cardIdx: number) => {
    const spec = railCardsRef.current[cardIdx];
    if (!spec) return;
    openAvatar360({
      title: `${spec.product.brand} — ${spec.product.title}`,
      primaryProduct: spec.product,
      avatarFrontUrl: spec.frontAvatarUrl,
      avatarBackUrl: spec.backAvatarUrl,
      initialAngleMode: "split",
    });
  };

  // Flip all diagonal runway models seamlessly between Front 0° and Back 180° without resetting scroll position!
  useEffect(() => {
    modelImgElsRef.current.forEach((imgEl, i) => {
      const outfit = runwayOutfits[i];
      if (!imgEl || !outfit) return;
      imgEl.src =
        runwayAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl;
    });
    faceImgElsRef.current.forEach((faceEl) => {
      if (!faceEl) return;
      if (customAvatar?.faceOvalDataUrl && runwayAngle === "front") {
        faceEl.src = customAvatar.faceOvalDataUrl;
        faceEl.style.display = "block";
      } else {
        faceEl.style.display = "none";
      }
    });
  }, [customAvatar, runwayAngle, runwayOutfits]);

  // Build & animate the Diagonal Depth-of-Field Multi-Model Runway + Synchronized 3-Slot Piece Rail
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

    const N = runwayOutfits.length;
    if (N === 0) return;

    const calm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const createdModelImgs: Array<HTMLImageElement | null> = [];
    const createdFaceImgs: Array<HTMLImageElement | null> = [];

    const people = runwayOutfits.map((outfit, i) => {
      const e = document.createElement("div");
      e.className = "mv-m";
      e.dataset.i = String(i);

      const img = document.createElement("img");
      img.className = "mv-avatar-img";
      img.src =
        runwayAngle === "back" ? outfit.backAvatarUrl : outfit.frontAvatarUrl;
      img.alt = outfit.title;
      img.decoding = "async";
      e.append(img);
      createdModelImgs.push(img);

      const faceImg = document.createElement("img");
      faceImg.className = "mv-face-oval";
      faceImg.alt = "";
      if (customAvatar?.faceOvalDataUrl && runwayAngle === "front") {
        faceImg.src = customAvatar.faceOvalDataUrl;
        faceImg.style.display = "block";
      } else {
        faceImg.style.display = "none";
      }
      e.append(faceImg);
      createdFaceImgs.push(faceImg);

      line.append(e);
      return {
        e,
        r: 900 / 1355,
        f: "",
        o: "",
        cx: 0,
        sc: 1,
        vis: true,
      };
    });

    modelImgElsRef.current = createdModelImgs;
    faceImgElsRef.current = createdFaceImgs;

    const cards = railCardsRef.current.map((spec, i) => {
      const prod = spec.product;
      const pdpHref = `${BASE_PATH}/product?id=${encodeURIComponent(prod.id)}`;
      const detail =
        prod.fitMetadata?.fabricComposition ||
        prod.fitMetadata?.descriptionSummary ||
        `${prod.colorName} • ${spec.confidencePct}% Avatar Match`;

      const e = document.createElement("article");
      e.className = "mv-card" + (i % 2 ? " alt" : "");
      e.dataset.idx = String(i);
      e.innerHTML = `<div class="mv-card-top"><button class="mv-fav" type="button" aria-pressed="false" aria-label="Save ${escapeHtml(
        prod.title
      )}"><svg viewBox="0 0 24 24"><path d="M12 20S3.5 15 3.5 9A4.6 4.6 0 0 1 12 6.6 4.6 4.6 0 0 1 20.5 9C20.5 15 12 20 12 20Z"/></svg></button><span class="mv-store-inline-badge">Size ${escapeHtml(
        spec.recommendedSize
      )} • ${spec.confidencePct}% Fit</span></div><a class="mv-shot" href="${pdpHref}" title="Inspect ${escapeHtml(
        prod.title
      )} in 360° Fit"></a><div class="mv-meta"><div class="min-w-0 flex-1"><h3><a class="mv-title-link" href="${pdpHref}">${escapeHtml(
        prod.title
      )}</a></h3><span class="mv-price-line">${escapeHtml(
        prod.brand || "GWO Boutique"
      )} • $${prod.price} • Size ${escapeHtml(
        spec.recommendedSize
      )}</span><span class="mv-detail-line">${escapeHtml(
        detail
      )}</span></div><button class="mv-add" type="button" data-idx="${i}">+ Bag</button></div><div class="mv-card-actions"><button class="mv-pill-link buy mv-buy-single" type="button" data-idx="${i}">Buy ($${
        prod.price
      })</button><button class="mv-pill-link fit mv-open-360" type="button" data-idx="${i}">360° F/B</button><a class="mv-pill-link" href="${pdpHref}">360° Fit</a></div>`;

      const shot = e.querySelector(".mv-shot");
      if (shot && prod.imageUrl) {
        const realImg = document.createElement("img");
        realImg.className = "mv-real-photo";
        realImg.src = prod.imageUrl;
        realImg.alt = prod.title;
        realImg.decoding = "async";
        shot.append(realImg);
      }
      rail.append(e);
      return e;
    });

    for (let i = 0; i <= N; i++) {
      const b = document.createElement("b");
      const num = 1 + (i % N);
      b.textContent = num < 10 ? `0${num}` : String(num);
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
        addSinglePieceToBag(Number(addBtn.dataset.idx || 0), false);
      }
      const buyBtn = targetEl.closest(".mv-buy-single") as HTMLElement | null;
      if (buyBtn) {
        addSinglePieceToBag(Number(buyBtn.dataset.idx || 0), true);
      }
      const spinBtn = targetEl.closest(".mv-open-360") as HTMLElement | null;
      if (spinBtn) {
        openRailCard360Ref.current(Number(spinBtn.dataset.idx || 0));
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
        const centerX = W * L(KX);
        const x = centerX - base * m.r * sc * 0.5;
        const y = H * L(KF) - base * sc;
        const bl = L(KB);
        const op = d < -0.5 ? Math.max(0, 1 + (d + 0.5) * 2.2) : L(KO);
        const f = bl > 0.25 ? `blur(${bl.toFixed(1)}px)` : "none";
        const o = op.toFixed(3);

        m.cx = centerX;
        m.sc = sc;
        m.vis = op > 0.12;

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
      if (M > 0) {
        const q = wrap(p * 3, M);
        cards.forEach((c, i) => {
          let d = wrap(i - q, M);
          if (d > M - 4) d -= M;
          const pos = (d * cardS).toFixed(1);
          c.style.transform = side
            ? `translate3d(${pos}px,0,0)`
            : `translate3d(0,${pos}px,0)`;
        });
      }

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
        const rect = stage.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        let tappedIdx = -1;
        let bestDist = Infinity;
        people.forEach((m, idx) => {
          if (!m.vis) return;
          const dist = Math.abs(clickX - m.cx);
          if (dist < base * 0.2 * m.sc && dist < bestDist) {
            bestDist = dist;
            tappedIdx = idx;
          }
        });
        const d =
          tappedIdx >= 0 ? wrap(tappedIdx - Math.round(target), N) : 0;
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
  }, [addSinglePieceToBag, runwayOutfits]);

  const safeActiveIdx =
    runwayOutfits.length > 0 ? activeLookIdx % runwayOutfits.length : 0;
  const activeOutfit = runwayOutfits[safeActiveIdx] || runwayOutfits[0];
  const heroPiece = activeOutfit?.pieces[0]?.product;

  const handleApplyAiPrompt = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!vibeInput.trim()) {
      const nextCount = extraAiCount + 1;
      setExtraAiCount(nextCount);
      showToast("AI Stylist added a fresh boutique outfit to your Runway!");
      setTimeout(() => {
        jumpLookRef.current?.(runwayOutfits.length);
      }, 60);
      return;
    }
    setAppliedVibe(vibeInput.trim());
    currentPosRef.current = 0;
    setActiveLookIdx(0);
    setTimeout(() => jumpLookRef.current?.(0), 40);
    showToast(`AI Runway styled around "${vibeInput.trim()}"!`);
  };

  const handleCreateCustomRunwayOutfit = () => {
    if (selectedCustomIds.length === 0) return;
    // Choose closest matching lifelike studio avatar render
    let avatarIdx = 0;
    if (selectedCustomIds.includes("prod-ae-ivory-tweed-blazer")) avatarIdx = 1;
    else if (selectedCustomIds.includes("prod-ae-emerald-satin-midi")) avatarIdx = 2;
    else if (selectedCustomIds.includes("prod-ae-champagne-blazer-dress")) avatarIdx = 3;
    else if (selectedCustomIds.includes("prod-ae-camel-silk-wool-coat")) avatarIdx = 4;
    else if (selectedCustomIds.includes("prod-ae-linen-cinch-cardigan")) avatarIdx = 5;

    const title =
      customTitle.trim() ||
      `My Custom Boutique Outfit #0${savedCustomOutfits.length + 1}`;
    const created: CustomRunwayOutfitSaved = {
      id: `custom-runway-${Date.now()}`,
      title,
      productIds: selectedCustomIds,
      frontAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_${avatarIdx}_front.webp`,
      backAvatarUrl: `${BASE_PATH}/models/runway_ai/ae_outfit_${avatarIdx}_back.webp`,
    };
    persistCustomRunway([created, ...savedCustomOutfits]);
    setBuildModalOpen(false);
    setCustomTitle("");
    currentPosRef.current = 0;
    setActiveLookIdx(0);
    setTimeout(() => jumpLookRef.current?.(0), 50);
    showToast(`Added "${title}" onto the Runway!`);
  };

  return (
    <div className="mv-page">
      <main className="mv-main">
        <div className="mv-left-col">
          {/* ==================== DEDICATED TOP CONTROL BAR ==================== */}
          <div className="mv-top-bar space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141518]">
                  For You Runway
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-black/[0.07] text-[11px] font-bold text-[#244B3B]">
                  <Ruler className="w-3 h-3" /> {activeHeightStr} • {activeBust}&quot; B •{" "}
                  {activeWaist}&quot; W • {activeHips}&quot; H (Size {recSize})
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {/* Front 0° / Back 180° Runway Flip */}
                <div className="inline-flex items-center p-0.5 rounded-full bg-white border border-black/[0.08]">
                  {(
                    [
                      ["front", "Front 0°"],
                      ["back", "Back 180°"],
                    ] as const
                  ).map(([ang, label]) => (
                    <button
                      key={ang}
                      type="button"
                      id={`gwo-runway-angle-${ang}`}
                      onClick={() => setRunwayAngle(ang)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                        runwayAngle === ang
                          ? "bg-[#141518] text-white"
                          : "text-[#686D76] hover:text-[#141518]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Link Instagram & Pinterest Style DNA */}
                <button
                  type="button"
                  id="gwo-runway-social-dna-btn"
                  onClick={() => setSocialModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FDEEF4] hover:bg-[#FADCE8] border border-[#F5C5D8] text-[11px] font-bold text-[#9D174D] cursor-pointer"
                >
                  <Instagram className="w-3 h-3" />
                  <span>
                    {socialDna.instagramHandle || "Link IG / Pinterest"} •{" "}
                    {ARCHETYPE_META[socialDna.primaryArchetype].shortTag}
                  </span>
                </button>

                {/* Avatar Badge */}
                <button
                  type="button"
                  onClick={() => setAvatarModalOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#F7F8FA] border border-black/[0.08] text-[11px] font-bold text-[#141518] cursor-pointer"
                >
                  <img
                    src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
                    alt="Avatar"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  {customAvatar ? "You ✓" : "Avatar"}
                </button>

                {/* + AI Outfit Generator */}
                <button
                  type="button"
                  id="gwo-runway-add-ai-outfit-btn"
                  onClick={() => {
                    const next = extraAiCount + 1;
                    setExtraAiCount(next);
                    showToast("AI Stylist added a new full outfit to the Runway!");
                    setTimeout(
                      () => jumpLookRef.current?.(runwayOutfits.length),
                      80
                    );
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-[11px] font-bold shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" /> + AI Outfit
                </button>

                {/* + Build / Add Custom Outfit */}
                <button
                  type="button"
                  id="gwo-runway-build-outfit-btn"
                  onClick={() => setBuildModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold shadow-xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Add Outfit
                </button>
              </div>
            </div>

            {/* Row 2: Quick Outfit Jump Pills + AI Vibe Prompt */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {runwayOutfits.slice(0, 7).map((outfit, idx) => {
                  const active = safeActiveIdx === idx;
                  return (
                    <button
                      key={outfit.id}
                      type="button"
                      onClick={() => jumpLookRef.current?.(idx)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                        active
                          ? "bg-[#141518] text-white shadow-xs"
                          : "bg-white hover:bg-[#F4F5F7] text-[#686D76] hover:text-[#141518] border border-black/[0.07]"
                      }`}
                    >
                      0{idx + 1} • {outfit.occasion}
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleApplyAiPrompt}
                className="hidden md:flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={vibeInput}
                  onChange={(e) => setVibeInput(e.target.value)}
                  placeholder="Ask AI for Runway ideas (e.g., Paris brunch, date night)..."
                  className="w-64 px-3 py-1 rounded-full bg-white border border-black/[0.09] text-[11px] text-[#141518] focus:outline-none focus:border-[#141518]"
                />
                <button
                  type="submit"
                  className="px-3 py-1 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" /> Style
                </button>
              </form>
            </div>
          </div>

          {/* ==================== DIAGONAL MULTI-MODEL PARALLAX RUNWAY STAGE ==================== */}
          <section
            className="mv-stage"
            ref={stageRef}
            aria-label="AI Recommended Boutique Outfits. Drag, scroll or use arrow keys."
            tabIndex={0}
          >
            <div className="mv-line" ref={lineRef} />
            <div className="mv-ring" ref={ringRef} />
          </section>

          {/* ==================== DEDICATED BOTTOM FULL-OUTFIT & SINGLE-PIECE DOCK ==================== */}
          <div className="mv-bottom-bar">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="mv-look" aria-live="polite">
                <span>Outfit</span>
                <span className="mv-win">
                  <span className="mv-roll" ref={rollRef} />
                </span>
              </div>
              {activeOutfit && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#141518] truncate max-w-[260px] sm:max-w-[360px]">
                    {activeOutfit.title}
                  </p>
                  <p className="text-[10.5px] font-semibold text-[#244B3B] truncate max-w-[260px] sm:max-w-[380px]">
                    {activeOutfit.aiReason}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {activeOutfit && (
                <>
                  <button
                    type="button"
                    id="gwo-runway-buy-full-outfit-btn"
                    onClick={() => handleAddOrBuyFullOutfit(true)}
                    className="px-3.5 py-2 rounded-full bg-[#C80815] hover:bg-[#A60611] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                  >
                    Buy Full Outfit (${activeOutfit.totalPriceUsd})
                  </button>

                  <button
                    type="button"
                    id="gwo-runway-bag-full-outfit-btn"
                    onClick={() => handleAddOrBuyFullOutfit(false)}
                    className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" /> + Bag Outfit ($
                    {activeOutfit.totalPriceUsd})
                  </button>

                  {heroPiece && (
                    <button
                      type="button"
                      id="gwo-runway-360-btn"
                      onClick={() =>
                        openAvatar360({
                          title: `Outfit 0${safeActiveIdx + 1}: ${activeOutfit.title}`,
                          primaryProduct: heroPiece,
                          companionProducts: activeOutfit.pieces
                            .slice(1)
                            .map((x) => x.product),
                          avatarFrontUrl: activeOutfit.frontAvatarUrl,
                          avatarBackUrl: activeOutfit.backAvatarUrl,
                          initialAngleMode: "split",
                        })
                      }
                      className="px-3 py-2 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Rotate3d className="w-3.5 h-3.5" /> 360° Front &amp; Back
                    </button>
                  )}

                  {heroPiece && (
                    <Link
                      href={`/?try=${encodeURIComponent(heroPiece.id)}`}
                      id="gwo-runway-try-closet-btn"
                      className="px-3 py-2 rounded-full bg-white hover:bg-[#F4F5F7] border border-black/[0.08] text-[#244B3B] text-xs font-bold inline-flex items-center gap-1 shadow-xs"
                    >
                      Try in Closet →
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ==================== RIGHT / BOTTOM SYNCHRONIZED SINGLE-PIECES RAIL ==================== */}
        <aside
          className="mv-rail"
          ref={railRef}
          aria-label="Single pieces in this Runway outfit"
        />
      </main>

      {/* ==================== ADD / BUILD CUSTOM OUTFIT ON RUNWAY MODAL ==================== */}
      {buildModalOpen && (
        <div
          className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setBuildModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-black/[0.08] space-y-4 max-h-[88svh] flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-[#141518]">
                  Add Full Outfit to Runway
                </h3>
                <p className="text-xs text-[#686D76] mt-0.5">
                  Select boutique pieces below to assemble a custom Runway outfit—or pull a new store link first.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setBuildModalOpen(false);
                    setAddUrlModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E4E6EC] text-xs font-bold text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#244B3B]" /> Paste Store URL
                </button>
                <button
                  type="button"
                  onClick={() => setBuildModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Outfit Name (e.g., Rooftop Cocktail Edit)"
              className="w-full px-4 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs text-[#141518] shrink-0"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 overflow-y-auto pr-1 flex-1 min-h-0">
              {boutiqueCatalog.map((prod) => {
                const selected = selectedCustomIds.includes(prod.id);
                return (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() =>
                      setSelectedCustomIds((prev) =>
                        prev.includes(prod.id)
                          ? prev.filter((x) => x !== prod.id)
                          : [...prev, prod.id]
                      )
                    }
                    className={`rounded-2xl p-2 border text-left transition cursor-pointer flex flex-col justify-between ${
                      selected
                        ? "border-[#244B3B] ring-2 ring-[#244B3B]/20 bg-[#F4F8F5]"
                        : "border-black/[0.08] bg-white hover:bg-[#FAFBFD]"
                    }`}
                  >
                    <div>
                      <div className="h-28 rounded-xl bg-[#F7F8FA] overflow-hidden mb-1.5 relative">
                        <GarmentArtwork product={prod} className="w-full h-full" />
                        {selected && (
                          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#244B3B] text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-[#141518] line-clamp-1">
                        {prod.title}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[#244B3B]">
                        ${prod.price} • {prod.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/[0.08] shrink-0">
              <span className="text-xs font-semibold text-[#686D76]">
                {selectedCustomIds.length} pieces selected
              </span>
              <button
                type="button"
                disabled={selectedCustomIds.length === 0}
                onClick={handleCreateCustomRunwayOutfit}
                className="px-5 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] disabled:opacity-40 text-white text-xs font-bold cursor-pointer"
              >
                Add Outfit to Runway →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

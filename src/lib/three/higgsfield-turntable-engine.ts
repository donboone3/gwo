/**
 * ============================================================================
 * GWO HIGGSFIELD 360° ALL-INTRA MP4 -> IMAGEBITMAP[] TURNTABLE SCRUBBER ENGINE
 * File: src/lib/three/higgsfield-turntable-engine.ts
 * ============================================================================
 *
 * Restores and upgrades the Original-Prompt (`commit 5d13ab5`) photorealistic
 * Higgsfield 360° `.mp4` -> `ImageBitmap[]` 60fps inertia turntable architecture:
 *
 * - Zero procedural `TubeGeometry` cylinder warping and zero flat-card `cos(θ)` squashing.
 * - Uses 17 pre-rendered, height-locked (`crown=250..sole=1700, axis=540`) Higgsfield
 *   Kling 3.0 Omni (`kling_o3_flf`) 360° `.mp4` turntables transcoded with `ffmpeg -g 1`
 *   All-Intra H.264 keyframes (`/models/turntables/ae_outfit_{0..15}_360.mp4` + `ae_base_360.mp4`).
 * - Supports hue-accurate colorway transforms for colorway variants across all 54 SKUs,
 *   plus unwarped multi-angle studio compositing when mixing custom cross-capsule separates.
 */

import { Product } from "../types";
import { classifyWearableSlotAndAnchors } from "./avatar-ready-pipeline";
import {
  renderModularOutfitDataUrlAsync,
  resolveSideOutfitFallbackIndex,
} from "./modular-outfit-compositor";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const TURNTABLE_VER = "hf360v1";
export const NUM_TURNTABLE_FRAMES = 96;

export interface ColorwayShiftSpec {
  /** Target product hex color */
  targetHex: string;
  /** Source garment family in the donor Higgsfield turntable */
  sourceMask:
    | "emerald_green"
    | "crimson_red"
    | "champagne_ivory"
    | "espresso_brown"
    | "noir_dark"
    | "merlot_bag";
  /** Normalized vertical window [y0Frac, y1Frac] from top of frame (0..1) */
  yRange: [number, number];
}

export interface ResolvedTurntableSpec {
  cacheKey: string;
  kind: "higgsfield_mp4" | "unwarped_modular_quad";
  lookIdx: number | "base";
  mp4Url: string;
  posterUrl: string;
  colorwayShift?: ColorwayShiftSpec;
  products: Product[];
}

/**
 * Exact canonical product sets for `ae_outfit_0` .. `ae_outfit_15`
 * (from `CURATED_100_OUTFIT_DESIGNS` #001..#016).
 */
const CANONICAL_16_CAPSULES: Array<{
  lookIdx: number;
  coreSlots: Record<string, string>;
  optionalBag?: string;
}> = [
  {
    lookIdx: 0,
    coreSlots: {
      top: "prod-ae-espresso-corset",
      bottom: "prod-ae-champagne-trousers",
    },
    optionalBag: "prod-ae-burgundy-crescent-bag",
  },
  {
    lookIdx: 1,
    coreSlots: {
      outerwear: "prod-ae-ivory-tweed-blazer",
      bottom: "prod-ae-noir-pleated-mini",
    },
    optionalBag: "prod-ae-camel-turnlock-tote",
  },
  {
    lookIdx: 2,
    coreSlots: { dress: "prod-ae-emerald-satin-midi" },
    optionalBag: "prod-ae-burgundy-crescent-bag",
  },
  {
    lookIdx: 3,
    coreSlots: { dress: "prod-ae-champagne-blazer-dress" },
    optionalBag: "prod-ae-ivory-mini-bag",
  },
  {
    lookIdx: 4,
    coreSlots: {
      outerwear: "prod-ae-camel-silk-wool-coat",
      bottom: "prod-ae-champagne-trousers",
    },
    optionalBag: "prod-ae-camel-turnlock-tote",
  },
  {
    lookIdx: 5,
    coreSlots: {
      outerwear: "prod-ae-linen-cinch-cardigan",
      bottom: "prod-ae-noir-pleated-mini",
    },
    optionalBag: "prod-ae-camel-turnlock-tote",
  },
  {
    lookIdx: 6,
    coreSlots: { dress: "prod-ae-crimson-corset-mini" },
    optionalBag: "prod-ae-noir-quilted-bag",
  },
  {
    lookIdx: 7,
    coreSlots: {
      outerwear: "prod-ae-noir-tailored-blazer",
      bottom: "prod-ae-vintage-wide-denim",
    },
    optionalBag: "prod-ae-burgundy-crescent-bag",
  },
  {
    lookIdx: 8,
    coreSlots: {
      outerwear: "prod-ae-sage-zip-jacket",
      bottom: "prod-ae-sage-flare-leggings",
    },
    optionalBag: "prod-ae-ivory-mini-bag",
  },
  {
    lookIdx: 9,
    coreSlots: {
      top: "prod-ae-espresso-corset",
      bottom: "prod-ae-vintage-wide-denim",
    },
    optionalBag: "prod-ae-noir-quilted-bag",
  },
  {
    lookIdx: 10,
    coreSlots: {
      top: "prod-ae-blush-ruched-offshoulder",
      bottom: "prod-ae-ivory-satin-bias-midi",
    },
    optionalBag: "prod-ae-ivory-mini-bag",
  },
  {
    lookIdx: 11,
    coreSlots: {
      top: "prod-ae-noir-halter-vest",
      bottom: "prod-ae-charcoal-pinstripe-trousers",
    },
    optionalBag: "prod-ae-noir-quilted-bag",
  },
  {
    lookIdx: 12,
    coreSlots: { dress: "prod-ae-cobalt-draped-mini" },
    optionalBag: "prod-ae-silver-metallic-shoulder-bag",
  },
  {
    lookIdx: 13,
    coreSlots: {
      outerwear: "prod-ae-burgundy-leather-trench",
      bottom: "prod-ae-vintage-wide-denim",
    },
    optionalBag: "prod-ae-burgundy-crescent-bag",
  },
  {
    lookIdx: 14,
    coreSlots: {
      outerwear: "prod-ae-cream-cropped-fur-jacket",
      dress: "prod-ae-butter-lace-slip-midi",
    },
    optionalBag: "prod-ae-camel-turnlock-tote",
  },
  {
    lookIdx: 15,
    coreSlots: {
      top: "prod-ae-butter-silk-cami",
      bottom: "prod-ae-espresso-tailored-shorts",
    },
    optionalBag: "prod-ae-burgundy-crescent-bag",
  },
];

/**
 * Authoritative mapping for every single store SKU (bags, heels, boots, sneakers, belts,
 * dresses, blazers, coats, tops, trousers, skirts, and colorway editions) to the exact
 * Higgsfield 360° `.mp4` turntable where she wears that exact silhouette!
 */
const SINGLE_SKU_TURNTABLE_MAP: Record<
  string,
  { lookIdx: number; shift?: ColorwayShiftSpec }
> = {
  // Core 36 SKUs -> exact turntable where worn!
  "prod-ae-espresso-corset": { lookIdx: 0 },
  "prod-ae-champagne-trousers": { lookIdx: 0 },
  "prod-ae-noir-slingbacks": { lookIdx: 0 },
  "prod-ae-burgundy-crescent-bag": { lookIdx: 0 },
  "prod-ae-ivory-tweed-blazer": { lookIdx: 1 },
  "prod-ae-noir-pleated-mini": { lookIdx: 1 },
  "prod-ae-meotina-leather-boots": { lookIdx: 1 },
  "prod-ae-camel-turnlock-tote": { lookIdx: 1 },
  "prod-ae-emerald-satin-midi": { lookIdx: 2 },
  "prod-ae-gold-strappy-heels": { lookIdx: 2 },
  "prod-ae-champagne-blazer-dress": { lookIdx: 3 },
  "prod-ae-ivory-mini-bag": { lookIdx: 3 },
  "prod-ae-camel-silk-wool-coat": { lookIdx: 4 },
  "prod-ae-acetate-beaded-tank": { lookIdx: 4 },
  "prod-ae-linen-cinch-cardigan": { lookIdx: 5 },
  "prod-ae-crimson-corset-mini": { lookIdx: 6 },
  "prod-ae-noir-tailored-blazer": { lookIdx: 7 },
  "prod-ae-sage-zip-jacket": { lookIdx: 8 },
  "prod-ae-sage-flare-leggings": { lookIdx: 8 },
  "prod-ae-cloud-platform-sneakers": { lookIdx: 8 },
  "prod-ae-vintage-wide-denim": { lookIdx: 9 },
  "prod-ae-noir-quilted-bag": { lookIdx: 9 },
  "prod-ae-gold-sculpted-belt": { lookIdx: 9 },
  "prod-ae-blush-ruched-offshoulder": { lookIdx: 10 },
  "prod-ae-ivory-satin-bias-midi": { lookIdx: 10 },
  "prod-ae-ivory-patent-slingbacks": { lookIdx: 10 },
  "prod-ae-noir-halter-vest": { lookIdx: 11 },
  "prod-ae-charcoal-pinstripe-trousers": { lookIdx: 11 },
  "prod-ae-silver-sculpted-belt": { lookIdx: 11 },
  "prod-ae-cobalt-draped-mini": { lookIdx: 12 },
  "prod-ae-silver-crystal-heels": { lookIdx: 12 },
  "prod-ae-silver-metallic-shoulder-bag": { lookIdx: 12 },
  "prod-ae-burgundy-leather-trench": { lookIdx: 13 },
  "prod-ae-burgundy-patent-heels": { lookIdx: 13 },
  "prod-ae-butter-lace-slip-midi": { lookIdx: 14 },
  "prod-ae-cream-cropped-fur-jacket": { lookIdx: 14 },
  "prod-ae-butter-silk-cami": { lookIdx: 15 },
  "prod-ae-espresso-tailored-shorts": { lookIdx: 15 },

  // Colorway-edition SKUs -> exact matching silhouette turntable + smooth continuous fabric shader!
  "prod-ae-sapphire-satin-midi": {
    lookIdx: 2,
    shift: {
      targetHex: "#1A3359",
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-onyx-satin-midi": {
    lookIdx: 2,
    shift: {
      targetHex: "#1B1C20",
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-rosewood-corset-mini": {
    lookIdx: 6,
    shift: {
      targetHex: "#8C4C58",
      sourceMask: "crimson_red",
      yRange: [0.22, 0.59],
    },
  },
  "prod-ae-noir-tuxedo-blazer-dress": {
    lookIdx: 3,
    shift: {
      targetHex: "#1D1E23",
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.58],
    },
  },
  "prod-ae-ivory-pearl-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#EFE9DF",
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-noir-satin-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#1D1E22",
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-emerald-silk-cami": {
    lookIdx: 15,
    shift: {
      targetHex: "#1B5240",
      sourceMask: "champagne_ivory",
      yRange: [0.23, 0.44],
    },
  },
  "prod-ae-camel-tailored-vest": {
    lookIdx: 11,
    shift: {
      targetHex: "#B99976",
      sourceMask: "noir_dark",
      yRange: [0.22, 0.44],
    },
  },
  "prod-ae-obsidian-wide-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#1E2024",
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.87],
    },
  },
  "prod-ae-olive-pleated-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#4B5343",
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.87],
    },
  },
  "prod-ae-burgundy-pleated-mini": {
    lookIdx: 1,
    shift: {
      targetHex: "#581F29",
      sourceMask: "noir_dark",
      yRange: [0.42, 0.57],
    },
  },
  "prod-ae-chocolate-satin-midi": {
    lookIdx: 10,
    shift: {
      targetHex: "#432D27",
      sourceMask: "champagne_ivory",
      yRange: [0.41, 0.79],
    },
  },
  "prod-ae-emerald-tweed-blazer": {
    lookIdx: 1,
    shift: {
      targetHex: "#21493B",
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.44],
    },
  },
  "prod-ae-espresso-tailored-blazer": {
    lookIdx: 7,
    shift: {
      targetHex: "#422E28",
      sourceMask: "noir_dark",
      yRange: [0.20, 0.51],
    },
  },
  "prod-ae-charcoal-wool-coat": {
    lookIdx: 4,
    shift: {
      targetHex: "#33363B",
      sourceMask: "espresso_brown",
      yRange: [0.20, 0.76],
    },
  },
  "prod-ae-espresso-suede-crescent-bag": {
    lookIdx: 0,
    shift: {
      targetHex: "#3B2822",
      sourceMask: "merlot_bag",
      yRange: [0.22, 0.46],
    },
  },
};

const COLORWAY_DRESS_TURNTABLE_MAP: Record<
  string,
  { lookIdx: number; shift: ColorwayShiftSpec }
> = {
  "prod-ae-sapphire-satin-midi": {
    lookIdx: 2,
    shift: SINGLE_SKU_TURNTABLE_MAP["prod-ae-sapphire-satin-midi"].shift!,
  },
  "prod-ae-onyx-satin-midi": {
    lookIdx: 2,
    shift: SINGLE_SKU_TURNTABLE_MAP["prod-ae-onyx-satin-midi"].shift!,
  },
  "prod-ae-rosewood-corset-mini": {
    lookIdx: 6,
    shift: SINGLE_SKU_TURNTABLE_MAP["prod-ae-rosewood-corset-mini"].shift!,
  },
  "prod-ae-noir-tuxedo-blazer-dress": {
    lookIdx: 3,
    shift: SINGLE_SKU_TURNTABLE_MAP["prod-ae-noir-tuxedo-blazer-dress"].shift!,
  },
};

export function turntableUrlsForIndex(lookIdx: number | "base"): {
  mp4Url: string;
  posterUrl: string;
} {
  const slug = lookIdx === "base" ? "ae_base" : `ae_outfit_${lookIdx}`;
  return {
    mp4Url: `${BASE}/models/turntables/${slug}_360.mp4?v=${TURNTABLE_VER}`,
    posterUrl: `${BASE}/models/turntables/${slug}_poster.webp?v=${TURNTABLE_VER}`,
  };
}

/**
 * Resolves whether an equipped product set matches a Higgsfield 360° `.mp4` turntable
 * (exact capsule, base character, single-item PDP, or colorway dress) vs a custom Closet mix.
 */
export function resolveTurntableSpecForOutfit(
  userSelectedProducts: Product[],
  effectiveProducts: Product[]
): ResolvedTurntableSpec {
  if (userSelectedProducts.length === 0) {
    const urls = turntableUrlsForIndex("base");
    return {
      cacheKey: "hf:base",
      kind: "higgsfield_mp4",
      lookIdx: "base",
      ...urls,
      products: [],
    };
  }

  // 1. Single-product inspection (e.g. PDP `/product/[id]` or `/product?id=...`):
  if (userSelectedProducts.length === 1) {
    const single = userSelectedProducts[0];
    const mapped = SINGLE_SKU_TURNTABLE_MAP[single.id];
    if (mapped) {
      const urls = turntableUrlsForIndex(mapped.lookIdx);
      return {
        cacheKey: mapped.shift
          ? `hf:${mapped.lookIdx}:cw:${single.id}`
          : `hf:${mapped.lookIdx}`,
        kind: "higgsfield_mp4",
        lookIdx: mapped.lookIdx,
        ...urls,
        colorwayShift: mapped.shift,
        products: effectiveProducts,
      };
    }
    const donorIdx =
      typeof single.studioLookIndex === "number"
        ? single.studioLookIndex % 16
        : resolveSideOutfitFallbackIndex([single]);
    const urls = turntableUrlsForIndex(donorIdx);
    return {
      cacheKey: `hf:${donorIdx}`,
      kind: "higgsfield_mp4",
      lookIdx: donorIdx,
      ...urls,
      products: effectiveProducts,
    };
  }

  // 2. Check if equipped outfit matches one of the 16 canonical Higgsfield capsules (or colorway dress capsule)
  const bySlot = new Map<string, Product>();
  for (const p of effectiveProducts) {
    bySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }

  const dressProd = bySlot.get("dress");
  if (dressProd && !bySlot.has("outerwear")) {
    if (dressProd.id === "prod-ae-emerald-satin-midi") {
      const urls = turntableUrlsForIndex(2);
      return {
        cacheKey: "hf:2",
        kind: "higgsfield_mp4",
        lookIdx: 2,
        ...urls,
        products: effectiveProducts,
      };
    }
    if (dressProd.id === "prod-ae-champagne-blazer-dress") {
      const urls = turntableUrlsForIndex(3);
      return {
        cacheKey: "hf:3",
        kind: "higgsfield_mp4",
        lookIdx: 3,
        ...urls,
        products: effectiveProducts,
      };
    }
    if (dressProd.id === "prod-ae-crimson-corset-mini") {
      const urls = turntableUrlsForIndex(6);
      return {
        cacheKey: "hf:6",
        kind: "higgsfield_mp4",
        lookIdx: 6,
        ...urls,
        products: effectiveProducts,
      };
    }
    if (dressProd.id === "prod-ae-cobalt-draped-mini") {
      const urls = turntableUrlsForIndex(12);
      return {
        cacheKey: "hf:12",
        kind: "higgsfield_mp4",
        lookIdx: 12,
        ...urls,
        products: effectiveProducts,
      };
    }
    if (dressProd.id === "prod-ae-butter-lace-slip-midi") {
      const urls = turntableUrlsForIndex(14);
      return {
        cacheKey: "hf:14",
        kind: "higgsfield_mp4",
        lookIdx: 14,
        ...urls,
        products: effectiveProducts,
      };
    }
    const cw = COLORWAY_DRESS_TURNTABLE_MAP[dressProd.id];
    if (cw) {
      const urls = turntableUrlsForIndex(cw.lookIdx);
      return {
        cacheKey: `hf:${cw.lookIdx}:cw:${dressProd.id}`,
        kind: "higgsfield_mp4",
        lookIdx: cw.lookIdx,
        ...urls,
        colorwayShift: cw.shift,
        products: effectiveProducts,
      };
    }
  }

  for (const cap of CANONICAL_16_CAPSULES) {
    let allCoreMatch = true;
    for (const [slot, reqId] of Object.entries(cap.coreSlots)) {
      if (bySlot.get(slot)?.id !== reqId) {
        allCoreMatch = false;
        break;
      }
    }
    // Ensure no extra outerwear was layered over a non-outerwear capsule
    if (allCoreMatch && !("outerwear" in cap.coreSlots) && bySlot.has("outerwear")) {
      allCoreMatch = false;
    }
    // Ensure bag matches if user explicitly equipped a different bag
    const wornBag = bySlot.get("bag");
    if (allCoreMatch && wornBag && cap.optionalBag && wornBag.id !== cap.optionalBag) {
      allCoreMatch = false;
    }
    if (allCoreMatch) {
      const urls = turntableUrlsForIndex(cap.lookIdx);
      return {
        cacheKey: `hf:${cap.lookIdx}`,
        kind: "higgsfield_mp4",
        lookIdx: cap.lookIdx,
        ...urls,
        products: effectiveProducts,
      };
    }
  }

  // 3. Cross-capsule custom mix-and-match in Closet: use unwarped 1:1 studio modular views (zero cylinder distortion!)
  const sig = effectiveProducts.map((p) => p.id).join("|");
  const fallbackUrls = turntableUrlsForIndex(0);
  return {
    cacheKey: `modquad:${sig}`,
    kind: "unwarped_modular_quad",
    lookIdx: 0,
    ...fallbackUrls,
    products: effectiveProducts,
  };
}

// ============================================================================
// OFFSCREEN ALL-INTRA MP4 -> IMAGEBITMAP[] FRAME CACHE (LRU-BOUNDED)
// ============================================================================

export interface CachedFrameBundle {
  frames: ImageBitmap[];
  width: number;
  height: number;
}

const BITMAP_LRU = new Map<string, CachedFrameBundle>();
const INFLIGHT_EXTRACTIONS = new Map<string, Promise<CachedFrameBundle>>();
const MAX_LRU_BUNDLES = 5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.padEnd(6, "0").slice(0, 6), 16) || 0x18191e;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Post-processes a decoded video frame on a 2D canvas before `createImageBitmap`:
 * 1. Optional continuous smooth colorway garment shader (zero hard threshold blotches!)
 * 2. Optional seamless outer `#FFFFFF` cyclorama border-scan keying (for Runway `/shop` queue transparency!)
 */
export function postProcessFrameCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  seamlessKeying: boolean,
  shift?: ColorwayShiftSpec
): void {
  if (!seamlessKeying && !shift) return;
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  if (shift) {
    const [tr, tg, tb] = hexToRgb01(shift.targetHex);
    const tLum = Math.max(0.06, 0.299 * tr + 0.587 * tg + 0.114 * tb);
    const y0 = Math.max(0, Math.floor(shift.yRange[0] * H));
    const y1 = Math.min(H, Math.ceil(shift.yRange[1] * H));

    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        const r = d[k] / 255;
        const g = d[k + 1] / 255;
        const b = d[k + 2] / 255;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        let w = 0;
        if (shift.sourceMask === "emerald_green") {
          // Smoothly captures 100% of emerald & teal-satin highlights while rejecting warm skin, hair, and merlot bag!
          w =
            clamp01((g - r - 0.012) / 0.036) *
            clamp01((chroma - 0.022) / 0.042) *
            clamp01((0.92 - lum) / 0.10);
        } else if (shift.sourceMask === "crimson_red") {
          // Separates vivid crimson dress (r - g > 0.24) from warm tan skin (r - g ≈ 0.08..0.15)
          w =
            clamp01((r - g - 0.19) / 0.09) *
            clamp01((r - b - 0.20) / 0.09);
        } else if (shift.sourceMask === "champagne_ivory") {
          const skinWarmth = Math.max(0, r - b);
          w =
            clamp01((lum - 0.55) / 0.09) *
            clamp01((0.94 - lum) / 0.06) *
            clamp01((0.15 - skinWarmth) / 0.06);
        } else if (shift.sourceMask === "espresso_brown") {
          // Dark warm espresso fabric (lum 0.12..0.38, moderate warmth, excluding hair above y0 & brighter tan skin)
          const skinLike = r > 0.42 && r - b > 0.16 ? 1 : 0;
          if (!skinLike) {
            w =
              clamp01((lum - 0.09) / 0.06) *
              clamp01((0.40 - lum) / 0.08) *
              clamp01((r - b - 0.02) / 0.05);
          }
        } else if (shift.sourceMask === "noir_dark") {
          w =
            clamp01((0.26 - lum) / 0.08) *
            clamp01((0.08 - chroma) / 0.05);
        } else if (shift.sourceMask === "merlot_bag") {
          w =
            clamp01((r - g - 0.08) / 0.06) *
            clamp01((0.38 - lum) / 0.10);
        }

        if (w > 0.005) {
          // Continuous luminance-preserving silk/suiting color transfer with natural specular sheen
          const srcLum = Math.max(0.03, 0.26 * r + 0.61 * g + 0.13 * b);
          const normShade = clamp01(srcLum / 0.34);
          const spec = Math.pow(Math.max(0, srcLum - 0.36) / 0.64, 1.55) * 0.24;
          const scale = (0.32 + normShade * 1.15) * clamp01(tLum / 0.22 + 0.38);
          const nr = clamp01((tr / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tr * 0.35 + spec);
          const ng = clamp01((tg / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tg * 0.35 + spec);
          const nb = clamp01((tb / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tb * 0.35 + spec);
          d[k] = Math.round((r * (1 - w) + nr * w) * 255);
          d[k + 1] = Math.round((g * (1 - w) + ng * w) * 255);
          d[k + 2] = Math.round((b * (1 - w) + nb * w) * 255);
        }
      }
    }
  }

  if (seamlessKeying) {
    // Border-connected inward scanline keyer: removes ONLY exterior #FFFFFF studio cyclorama
    // on the left & right margins without ever touching white/ivory garments inside the figure!
    const isStudioWhiteAt = (idx4: number, isFloorZone: boolean) => {
      const r = d[idx4];
      const g = d[idx4 + 1];
      const b = d[idx4 + 2];
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (isFloorZone) {
        return r >= 205 && g >= 205 && b >= 205 && spread <= 14;
      }
      return r >= 242 && g >= 242 && b >= 242 && spread <= 14;
    };

    for (let y = 0; y < H; y++) {
      const isFloor = y > H * 0.87;
      let lx = 0;
      while (lx < W && isStudioWhiteAt((y * W + lx) * 4, isFloor)) {
        d[(y * W + lx) * 4 + 3] = 0;
        lx++;
      }
      // 2px soft feather at left silhouette contact
      if (lx < W) d[(y * W + lx) * 4 + 3] = Math.min(d[(y * W + lx) * 4 + 3], 150);

      let rx = W - 1;
      while (rx > lx && isStudioWhiteAt((y * W + rx) * 4, isFloor)) {
        d[(y * W + rx) * 4 + 3] = 0;
        rx--;
      }
      if (rx > lx) d[(y * W + rx) * 4 + 3] = Math.min(d[(y * W + rx) * 4 + 3], 150);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

export function getCachedTurntableBundleSync(
  spec: ResolvedTurntableSpec,
  seamlessKeying: boolean
): CachedFrameBundle | null {
  const fullKey = `${spec.cacheKey}|seamless=${seamlessKeying}`;
  return BITMAP_LRU.get(fullKey) || null;
}

export async function extractProcessedPosterBitmap(
  spec: ResolvedTurntableSpec,
  seamlessKeying: boolean
): Promise<ImageBitmap | null> {
  if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
    return null;
  }
  const srcUrl =
    spec.kind === "unwarped_modular_quad"
      ? (await renderModularOutfitDataUrlAsync(spec.products, "front")) ||
        spec.posterUrl
      : spec.posterUrl;

  const im = await new Promise<HTMLImageElement | null>((res) => {
    const img = new Image();
    if (!srcUrl.startsWith("data:") && !srcUrl.startsWith("/")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = srcUrl;
  });
  if (!im) return null;

  const W = 432;
  const H = 768;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", {
    willReadFrequently: Boolean(seamlessKeying || spec.colorwayShift),
  })!;
  ctx.clearRect(0, 0, W, H);
  if (spec.kind === "unwarped_modular_quad") {
    if (!seamlessKeying) {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, W, H);
    }
    const dh = H * 0.78;
    const dw = dh * (900 / 1355);
    ctx.drawImage(im, (W - dw) * 0.5, (H - dh) * 0.5, dw, dh);
  } else {
    ctx.drawImage(im, 0, 0, W, H);
    postProcessFrameCanvas(ctx, W, H, seamlessKeying, spec.colorwayShift);
  }
  return createImageBitmap(cv);
}

export function prefetchTurntableBundle(
  products: Product[],
  seamlessKeying: boolean
): void {
  if (typeof window === "undefined") return;
  const spec = resolveTurntableSpecForOutfit(products, products);
  const fullKey = `${spec.cacheKey}|seamless=${seamlessKeying}`;
  if (BITMAP_LRU.has(fullKey) || INFLIGHT_EXTRACTIONS.has(fullKey)) return;
  void extractTurntableBitmapBundle(spec, seamlessKeying).catch(() => {
    // ignore background prefetch error
  });
}

export function extractTurntableBitmapBundle(
  spec: ResolvedTurntableSpec,
  seamlessKeying: boolean,
  onProgress?: (loadedFrames: number, totalFrames: number) => void
): Promise<CachedFrameBundle> {
  const fullKey = `${spec.cacheKey}|seamless=${seamlessKeying}`;
  const hit = BITMAP_LRU.get(fullKey);
  if (hit) {
    // Refresh LRU order
    BITMAP_LRU.delete(fullKey);
    BITMAP_LRU.set(fullKey, hit);
    return Promise.resolve(hit);
  }

  const inflight = INFLIGHT_EXTRACTIONS.get(fullKey);
  if (inflight) return inflight;

  const p = (async (): Promise<CachedFrameBundle> => {
    if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
      return { frames: [], width: 432, height: 768 };
    }

    if (spec.kind === "unwarped_modular_quad") {
      // Unwarped 1:1 studio modular views (Front 0°, Side 90°, Back 180°, Left Side 270°)
      const [frontUrl, sideUrl, backUrl] = await Promise.all([
        renderModularOutfitDataUrlAsync(spec.products, "front"),
        renderModularOutfitDataUrlAsync(spec.products, "side"),
        renderModularOutfitDataUrlAsync(spec.products, "back"),
      ]);

      const loadImg = (u: string) =>
        new Promise<HTMLImageElement>((res, rej) => {
          const im = new Image();
          if (!u.startsWith("data:") && !u.startsWith("/")) im.crossOrigin = "anonymous";
          im.onload = () => res(im);
          im.onerror = rej;
          im.src = u;
        });

      const [imF, imS, imB] = await Promise.all([
        loadImg(frontUrl || spec.posterUrl),
        loadImg(sideUrl || frontUrl || spec.posterUrl),
        loadImg(backUrl || frontUrl || spec.posterUrl),
      ]);

      const W = 432;
      const H = 768;
      const cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      const ctx = cv.getContext("2d", { willReadFrequently: true })!;

      const makeViewBitmap = async (im: HTMLImageElement, flipX: boolean) => {
        ctx.clearRect(0, 0, W, H);
        if (!seamlessKeying) {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, W, H);
        }
        ctx.save();
        const dh = H * 0.78;
        const dw = dh * (900 / 1355);
        const dx = (W - dw) * 0.5;
        const dy = (H - dh) * 0.5;
        if (flipX) {
          ctx.translate(W, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(im, dx, dy, dw, dh);
        ctx.restore();
        return createImageBitmap(cv);
      };

      const [bmp0, bmp90, bmp180, bmp270] = await Promise.all([
        makeViewBitmap(imF, false),
        makeViewBitmap(imS, true),
        makeViewBitmap(imB, false),
        makeViewBitmap(imS, false),
      ]);
      const quadFrames = [bmp0, bmp90, bmp180, bmp270];
      return { frames: quadFrames, width: W, height: H };
    }

    // Standard Higgsfield 360° All-Intra MP4 -> 96 `ImageBitmap` frames!
    const vid = document.createElement("video");
    vid.muted = true;
    vid.playsInline = true;
    vid.preload = "auto";
    if (!spec.mp4Url.startsWith("/")) {
      vid.crossOrigin = "anonymous";
    }
    vid.src = spec.mp4Url;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new Error(`Failed to load turntable video: ${spec.mp4Url}`));
      };
      const cleanup = () => {
        vid.removeEventListener("loadeddata", onLoaded);
        vid.removeEventListener("error", onErr);
      };
      vid.addEventListener("loadeddata", onLoaded);
      vid.addEventListener("error", onErr);
      vid.load();
    });

    const dur = Math.max(0.5, vid.duration || 9.9);
    const W = 432;
    const H = 768;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d", { willReadFrequently: Boolean(seamlessKeying || spec.colorwayShift) })!;

    const frames: ImageBitmap[] = [];
    const N = NUM_TURNTABLE_FRAMES;

    for (let i = 0; i < N; i++) {
      const targetTime = Math.min(dur - 0.02, (i / N) * dur);
      if (Math.abs(vid.currentTime - targetTime) > 0.005) {
        await new Promise<void>((res) => {
          const onSeeked = () => {
            vid.removeEventListener("seeked", onSeeked);
            res();
          };
          vid.addEventListener("seeked", onSeeked);
          vid.currentTime = targetTime;
        });
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(vid, 0, 0, W, H);
      postProcessFrameCanvas(ctx, W, H, seamlessKeying, spec.colorwayShift);
      const bmp = await createImageBitmap(cv);
      frames.push(bmp);
      onProgress?.(i + 1, N);
    }

    vid.pause();
    vid.removeAttribute("src");
    vid.load();

    // Evict oldest LRU entry if over cap
    if (BITMAP_LRU.size >= MAX_LRU_BUNDLES) {
      const oldestKey = BITMAP_LRU.keys().next().value;
      if (oldestKey) {
        const old = BITMAP_LRU.get(oldestKey);
        old?.frames.forEach((b) => {
          try {
            b.close();
          } catch {
            // ignore
          }
        });
        BITMAP_LRU.delete(oldestKey);
      }
    }

    const bundle = { frames, width: W, height: H };
    BITMAP_LRU.set(fullKey, bundle);
    return bundle;
  })();

  INFLIGHT_EXTRACTIONS.set(fullKey, p);
  p.finally(() => {
    INFLIGHT_EXTRACTIONS.delete(fullKey);
  });
  return p;
}

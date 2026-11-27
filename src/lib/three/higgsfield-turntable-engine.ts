/**
 * ============================================================================
 * GWO UNIVERSAL HIGGSFIELD 360° ALL-INTRA MP4 -> IMAGEBITMAP[] TURNTABLE ENGINE
 * File: src/lib/three/higgsfield-turntable-engine.ts
 * ============================================================================
 *
 * Powers 100% studio-photorealistic 96-frame / 60fps `ImageBitmap[]` 360° inertia
 * turntables across:
 *   1. All 16 canonical capsules & 54 verified boutique SKUs
 *   2. Live Shopify & AliExpress store rack pulls (`pullStoreRackToCatalog`)
 *   3. Single customer product URL submits (`ingestUrlToSharedCatalog`)
 *   4. Customer-uploaded closet photos (`uploaded-3d-*`) & cross-capsule mixes
 *   5. Custom customer avatars (360° skin-tone harmonization + dedicated MP4s)
 *
 * Zero procedural `TubeGeometry` cylinder distortion and zero 4-frame snaps.
 */

import { Product } from "../types";
import {
  classifyWearableSlotAndAnchors,
  isolateProductBackgroundClient,
} from "./avatar-ready-pipeline";
import { resolveSideOutfitFallbackIndex } from "./modular-outfit-compositor";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const TURNTABLE_VER = "hf360v2";
export const NUM_TURNTABLE_FRAMES = 96;

export type DonorFabricMaskId =
  | "emerald_green"
  | "crimson_red"
  | "cobalt_blue"
  | "champagne_ivory"
  | "espresso_brown"
  | "noir_dark"
  | "charcoal_dark"
  | "indigo_denim"
  | "sage_green"
  | "blush_rose"
  | "merlot_bag"
  | "camel_tan";

export interface ColorwayShiftSpec {
  /** Target product hex color (or "auto_sample" before async image sampling) */
  targetHex: string;
  /** Optional product photo URL to auto-sample true garment color & subtle print texture */
  sampleFromImageUrl?: string;
  /** Whether title/colorName explicitly named a color (prevents overriding explicit "Noir/Black") */
  hasExplicitColorName?: boolean;
  /** Source garment family in the donor Higgsfield turntable */
  sourceMask: DonorFabricMaskId;
  /** Normalized vertical window [y0Frac, y1Frac] from top of frame (0..1) */
  yRange: [number, number];
  /** Optional normalized horizontal window [x0Frac, x1Frac] (defaults to [0, 1]) */
  xRange?: [number, number];
}

export interface TurntableAvatarOptions {
  /** Customer's scanned or selected skin tone hex */
  skinToneHex?: string;
  /** Optional dedicated Higgsfield 360° MP4 URL generated for this customer's avatar */
  customTurntableMp4Url?: string;
  customTurntablePosterUrl?: string;
}

export interface ResolvedTurntableSpec {
  cacheKey: string;
  kind: "higgsfield_mp4";
  lookIdx: number | "base" | "custom";
  mp4Url: string;
  posterUrl: string;
  colorwayShift?: ColorwayShiftSpec;
  colorwayShifts?: ColorwayShiftSpec[];
  skinToneTargetHex?: string;
  products: Product[];
}

interface CanonicalCapsuleRule {
  lookIdx: number;
  coreSlots: Record<string, string>;
  optionalBag?: string;
}

const CANONICAL_16_CAPSULES: CanonicalCapsuleRule[] = [
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

  "prod-ae-sapphire-satin-midi": {
    lookIdx: 2,
    shift: {
      targetHex: "#1A3359",
      hasExplicitColorName: true,
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-onyx-satin-midi": {
    lookIdx: 2,
    shift: {
      targetHex: "#1B1C20",
      hasExplicitColorName: true,
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-rosewood-corset-mini": {
    lookIdx: 6,
    shift: {
      targetHex: "#8C4C58",
      hasExplicitColorName: true,
      sourceMask: "crimson_red",
      yRange: [0.22, 0.59],
    },
  },
  "prod-ae-noir-tuxedo-blazer-dress": {
    lookIdx: 3,
    shift: {
      targetHex: "#1D1E23",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.58],
    },
  },
  "prod-ae-ivory-pearl-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#EFE9DF",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-noir-satin-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#1D1E22",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-emerald-silk-cami": {
    lookIdx: 15,
    shift: {
      targetHex: "#1B5240",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.23, 0.44],
    },
  },
  "prod-ae-camel-tailored-vest": {
    lookIdx: 11,
    shift: {
      targetHex: "#B99976",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.22, 0.44],
    },
  },
  "prod-ae-obsidian-wide-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#1E2024",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.87],
    },
  },
  "prod-ae-olive-pleated-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#4B5343",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.87],
    },
  },
  "prod-ae-burgundy-pleated-mini": {
    lookIdx: 1,
    shift: {
      targetHex: "#581F29",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.42, 0.57],
    },
  },
  "prod-ae-chocolate-satin-midi": {
    lookIdx: 10,
    shift: {
      targetHex: "#432D27",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.41, 0.79],
    },
  },
  "prod-ae-emerald-tweed-blazer": {
    lookIdx: 1,
    shift: {
      targetHex: "#21493B",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.44],
    },
  },
  "prod-ae-espresso-tailored-blazer": {
    lookIdx: 7,
    shift: {
      targetHex: "#422E28",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.20, 0.51],
    },
  },
  "prod-ae-charcoal-wool-coat": {
    lookIdx: 4,
    shift: {
      targetHex: "#33363B",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.20, 0.76],
    },
  },
  "prod-ae-espresso-suede-crescent-bag": {
    lookIdx: 0,
    shift: {
      targetHex: "#3B2822",
      hasExplicitColorName: true,
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

/**
 * Garment zone descriptors for each of the 16 Higgsfield 360° donor turntables (`ae_outfit_0..15`),
 * enabling ANY external store pull, customer URL submit, uploaded photo, or cross-capsule mix
 * to map onto an anatomically matching 96-frame 360° video with multi-slot fabric recoloring!
 */
interface DonorZoneDef {
  mask: DonorFabricMaskId;
  nativeHex: string;
  yRange: [number, number];
  xRange?: [number, number];
}

interface DonorTurntableAnatomy {
  lookIdx: number;
  dress?: DonorZoneDef;
  outerwear?: DonorZoneDef;
  top?: DonorZoneDef;
  bottom?: DonorZoneDef;
  bag?: DonorZoneDef;
}

const DONOR_ANATOMY_BY_LOOK: Record<number, DonorTurntableAnatomy> = {
  0: {
    lookIdx: 0,
    top: { mask: "espresso_brown", nativeHex: "#4B3531", yRange: [0.24, 0.43] },
    bottom: { mask: "champagne_ivory", nativeHex: "#D9CEBE", yRange: [0.40, 0.87] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.46] },
  },
  1: {
    lookIdx: 1,
    outerwear: { mask: "champagne_ivory", nativeHex: "#EFECE6", yRange: [0.20, 0.44] },
    bottom: { mask: "noir_dark", nativeHex: "#1D1E22", yRange: [0.42, 0.57] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
  },
  2: {
    lookIdx: 2,
    dress: { mask: "emerald_green", nativeHex: "#1F5441", yRange: [0.20, 0.78] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.45] },
  },
  3: {
    lookIdx: 3,
    dress: { mask: "champagne_ivory", nativeHex: "#E6CFC5", yRange: [0.20, 0.58] },
  },
  4: {
    lookIdx: 4,
    outerwear: { mask: "espresso_brown", nativeHex: "#4A3B31", yRange: [0.20, 0.76] },
    bottom: { mask: "champagne_ivory", nativeHex: "#D9CEBE", yRange: [0.42, 0.87] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
  },
  5: {
    lookIdx: 5,
    outerwear: { mask: "champagne_ivory", nativeHex: "#D8CEBE", yRange: [0.21, 0.50] },
    bottom: { mask: "noir_dark", nativeHex: "#1D1E22", yRange: [0.44, 0.58] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
  },
  6: {
    lookIdx: 6,
    dress: { mask: "crimson_red", nativeHex: "#C80815", yRange: [0.22, 0.59] },
    bag: { mask: "noir_dark", nativeHex: "#18181B", yRange: [0.30, 0.50] },
  },
  7: {
    lookIdx: 7,
    outerwear: { mask: "noir_dark", nativeHex: "#18191D", yRange: [0.20, 0.51] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.43, 0.87] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.24, 0.48] },
  },
  8: {
    lookIdx: 8,
    outerwear: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.20, 0.43] },
    top: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.20, 0.43] },
    bottom: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.43, 0.88] },
  },
  9: {
    lookIdx: 9,
    top: { mask: "espresso_brown", nativeHex: "#4B3531", yRange: [0.24, 0.43] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.41, 0.87] },
    bag: { mask: "noir_dark", nativeHex: "#18181B", yRange: [0.38, 0.58] },
  },
  10: {
    lookIdx: 10,
    top: { mask: "blush_rose", nativeHex: "#DFB8BE", yRange: [0.25, 0.42] },
    bottom: { mask: "champagne_ivory", nativeHex: "#F0EDE6", yRange: [0.41, 0.79] },
  },
  11: {
    lookIdx: 11,
    top: { mask: "noir_dark", nativeHex: "#17181C", yRange: [0.22, 0.43] },
    bottom: { mask: "charcoal_dark", nativeHex: "#36393F", yRange: [0.42, 0.87] },
  },
  12: {
    lookIdx: 12,
    dress: { mask: "cobalt_blue", nativeHex: "#18367A", yRange: [0.23, 0.58] },
  },
  13: {
    lookIdx: 13,
    outerwear: { mask: "merlot_bag", nativeHex: "#5C1622", yRange: [0.20, 0.49] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.45, 0.87] },
  },
  14: {
    lookIdx: 14,
    outerwear: { mask: "champagne_ivory", nativeHex: "#F2EFE9", yRange: [0.20, 0.39] },
    dress: { mask: "champagne_ivory", nativeHex: "#F1E5C6", yRange: [0.39, 0.78] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
  },
  15: {
    lookIdx: 15,
    top: { mask: "champagne_ivory", nativeHex: "#F2E6C9", yRange: [0.23, 0.43] },
    bottom: { mask: "espresso_brown", nativeHex: "#44312C", yRange: [0.42, 0.55] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.46] },
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

function hasExplicitColorKeyword(p: Product): boolean {
  const genericNames = new Set([
    "studio noir",
    "boutique edition",
    "studio tone",
    "my closet",
    "",
  ]);
  const cname = (p.colorName || "").trim().toLowerCase();
  if (!genericNames.has(cname)) return true;
  const hay = `${p.title} ${p.colorName}`.toLowerCase();
  return /\b(black|noir|obsidian|onyx|jet|white|ivory|cream|pearl|red|crimson|scarlet|cherry|burgundy|merlot|wine|pink|blush|rose|coral|emerald|green|sage|olive|blue|cobalt|sapphire|navy|indigo|denim|camel|tan|beige|champagne|oat|brown|espresso|chocolate|mocha|silver|gold|lilac|lavender|purple|yellow|butter)\b/.test(
    hay
  );
}

function hexDistance01(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb01(hexA);
  const [r2, g2, b2] = hexToRgb01(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function normalizeSkinToneShift(skinToneHex?: string): string | undefined {
  if (!skinToneHex) return undefined;
  // Default avatar baseline warm medium-tan is ~#C68E6E / #D4A383; skip shift if already close!
  if (hexDistance01(skinToneHex, "#C89272") < 0.14) return undefined;
  return skinToneHex;
}

/**
 * Selects the anatomically closest 96-frame Higgsfield 360° `.mp4` donor turntable (`0..15`)
 * and builds continuous per-slot fabric color shifts for ANY external store pull, URL submit,
 * uploaded closet photo, or cross-capsule mix!
 */
function synthesizeUniversalHiggsfieldSpec(
  primaryFocusProducts: Product[],
  effectiveProducts: Product[],
  skinToneTargetHex?: string
): ResolvedTurntableSpec {
  const bySlot = new Map<string, Product>();
  for (const p of effectiveProducts) {
    bySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }
  const focusBySlot = new Map<string, Product>();
  for (const p of primaryFocusProducts) {
    focusBySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }

  // Choose optimal donor lookIdx based on primary focus item(s) first, then full outfit!
  let lookIdx = 0;
  const dress = focusBySlot.get("dress") || bySlot.get("dress");
  const outer = focusBySlot.get("outerwear") || bySlot.get("outerwear");
  const top = focusBySlot.get("top") || bySlot.get("top");
  const bot = focusBySlot.get("bottom") || bySlot.get("bottom");
  const bag = focusBySlot.get("bag") || bySlot.get("bag");
  const shoes = focusBySlot.get("shoes") || bySlot.get("shoes");

  if (dress) {
    const t = `${dress.title} ${dress.silhouette} ${dress.fitMetadata?.hemLanding || ""}`.toLowerCase();
    if (outer) {
      lookIdx = 14;
    } else if (/blazer|tuxedo|lapel|romper|suit/.test(t)) {
      lookIdx = 3;
    } else if (/midi|maxi|slip|gown|column|bias|cowl/.test(t) && !/mini/.test(t)) {
      lookIdx = 2;
    } else if (/asymmetric|draped|satin|cobalt|blue|silver/.test(t) && !/corset/.test(t)) {
      lookIdx = 12;
    } else {
      lookIdx = 6;
    }
  } else if (outer && (focusBySlot.has("outerwear") || !focusBySlot.size || primaryFocusProducts.length > 1)) {
    const t = `${outer.title} ${outer.silhouette} ${outer.fitMetadata?.hemLanding || ""}`.toLowerCase();
    if (/coat|maxi|long|wool|cashmere/.test(t) && !/cropped/.test(t)) {
      lookIdx = 4;
    } else if (/leather|moto|trench|biker|suede/.test(t)) {
      lookIdx = 13;
    } else if (/zip|hoodie|sweatshirt|active|sculpt|yoga|fleece|pullover/.test(t)) {
      lookIdx = 8;
    } else if (/cardigan|knit|sweater|shawl/.test(t)) {
      lookIdx = 5;
    } else if (/fur|plush|mink|bolero|sherpa/.test(t)) {
      lookIdx = 14;
    } else if (/oversized|boyfriend|double-breasted/.test(t)) {
      lookIdx = 7;
    } else {
      lookIdx = bot && /denim|jean|trouser|pant/.test(`${bot.title} ${bot.silhouette}`.toLowerCase()) ? 7 : 1;
    }
  } else if (focusBySlot.size === 1 && focusBySlot.has("bag") && bag) {
    const t = `${bag.title} ${bag.silhouette}`.toLowerCase();
    if (/tote|satchel|work|trapezium|shopper/.test(t)) {
      lookIdx = 1;
    } else if (/quilted|chain|flap|crossbody/.test(t)) {
      lookIdx = 9;
    } else if (/mini|top-handle|clutch|pearl/.test(t)) {
      lookIdx = 3;
    } else if (/silver|metallic|chrome|crystal/.test(t)) {
      lookIdx = 12;
    } else {
      lookIdx = 0;
    }
  } else if (focusBySlot.size === 1 && focusBySlot.has("shoes") && shoes) {
    const t = `${shoes.title} ${shoes.silhouette}`.toLowerCase();
    if (/sneaker|trainer|runner|platform|court/.test(t)) {
      lookIdx = 8;
    } else if (/boot|knee/.test(t)) {
      lookIdx = 1;
    } else if (/silver|crystal/.test(t)) {
      lookIdx = 12;
    } else if (/strappy|sandal|gold|stiletto/.test(t)) {
      lookIdx = 2;
    } else {
      lookIdx = 0;
    }
  } else {
    // Top + Bottom separates (store pulls, URL submits, uploaded tops/bottoms, or custom mixes!)
    const bt = bot ? `${bot.title} ${bot.silhouette} ${bot.fitMetadata?.hemLanding || ""}`.toLowerCase() : "";
    const tt = top ? `${top.title} ${top.silhouette}`.toLowerCase() : "";

    if (/legging|yoga|tight|flare|jogger|sweatpant/.test(bt) || /sports-bra|active|sculpt/.test(tt)) {
      lookIdx = 8;
    } else if (/short|skort/.test(bt)) {
      lookIdx = 15;
    } else if (/midi|maxi|bias|slip|long|asymmetrical/.test(bt) && /skirt/.test(bt)) {
      lookIdx = 10;
    } else if (/mini-skirt|pleat|mini/.test(bt) && !/midi|maxi|long/.test(bt)) {
      lookIdx = outer ? 1 : 5;
    } else if (/midi|bias|slip|skirt/.test(bt)) {
      lookIdx = 10;
    } else if (/denim|jean|indigo/.test(bt)) {
      lookIdx = 9;
    } else if (/pinstripe|charcoal|tailored|cargo/.test(bt) || /vest|waistcoat|halter/.test(tt)) {
      lookIdx = 11;
    } else if (/off-shoulder|ruched|mesh|long-sleeve/.test(tt)) {
      lookIdx = 10;
    } else if (/cami|silk|baby-tee|tee|tank/.test(tt) && !/corset|bustier/.test(tt)) {
      lookIdx = /trouser|pant|wide/.test(bt) ? 0 : 15;
    } else {
      lookIdx = resolveSideOutfitFallbackIndex(effectiveProducts);
    }
  }

  const donor = DONOR_ANATOMY_BY_LOOK[lookIdx] || DONOR_ANATOMY_BY_LOOK[0];
  const shifts: ColorwayShiftSpec[] = [];

  const maybeAddSlotShift = (prod: Product | undefined, zone: DonorZoneDef | undefined) => {
    if (!prod || !zone) return;
    // If this exact catalog SKU is the native piece worn in `lookIdx`, no color shift needed!
    const mappedSku = SINGLE_SKU_TURNTABLE_MAP[prod.id];
    if (mappedSku && mappedSku.lookIdx === lookIdx && !mappedSku.shift) {
      return;
    }
    if (mappedSku?.shift && mappedSku.lookIdx === lookIdx) {
      shifts.push(mappedSku.shift);
      return;
    }

    const explicitColor = hasExplicitColorKeyword(prod);
    const needsPhotoSample =
      Boolean(prod.imageUrl) &&
      (!explicitColor ||
        prod.sourceType === "scraped_url" ||
        prod.id.startsWith("uploaded-3d-"));

    if (
      needsPhotoSample ||
      hexDistance01(prod.colorHex || zone.nativeHex, zone.nativeHex) > 0.11
    ) {
      shifts.push({
        targetHex: prod.colorHex || zone.nativeHex,
        sampleFromImageUrl: needsPhotoSample ? prod.imageUrl : undefined,
        hasExplicitColorName: explicitColor,
        sourceMask: zone.mask,
        yRange: zone.yRange,
        xRange: zone.xRange,
      });
    }
  };

  // When inspecting a single URL/store item (`primaryFocusProducts.length === 1`), shift that item's slot;
  // when wearing a multi-piece outfit, shift every slot in the outfit to match!
  if (primaryFocusProducts.length === 1) {
    const single = primaryFocusProducts[0];
    const slot = classifyWearableSlotAndAnchors(single).slot;
    if (slot === "dress") maybeAddSlotShift(single, donor.dress);
    else if (slot === "outerwear") maybeAddSlotShift(single, donor.outerwear);
    else if (slot === "top") maybeAddSlotShift(single, donor.top || donor.outerwear);
    else if (slot === "bottom") maybeAddSlotShift(single, donor.bottom);
    else if (slot === "bag") maybeAddSlotShift(single, donor.bag);
  } else {
    if (dress && donor.dress) maybeAddSlotShift(dress, donor.dress);
    if (outer && donor.outerwear) maybeAddSlotShift(outer, donor.outerwear);
    if (top && donor.top) maybeAddSlotShift(top, donor.top);
    if (bot && donor.bottom) maybeAddSlotShift(bot, donor.bottom);
    if (bag && donor.bag) maybeAddSlotShift(bag, donor.bag);
  }

  const urls = turntableUrlsForIndex(lookIdx);
  const shiftSig = shifts
    .map(
      (s) =>
        `${s.sourceMask}:${s.targetHex}:${s.sampleFromImageUrl ? s.sampleFromImageUrl.slice(-28) : ""}`
    )
    .join("|");

  return {
    cacheKey: `hf:${lookIdx}:univ:${shiftSig}|sk:${skinToneTargetHex || "def"}`,
    kind: "higgsfield_mp4",
    lookIdx,
    ...urls,
    colorwayShifts: shifts.length > 0 ? shifts : undefined,
    skinToneTargetHex,
    products: effectiveProducts,
  };
}

/**
 * Resolves ANY equipped product set (canonical capsule, single SKU, live Shopify/AliExpress
 * store pull, customer URL submit, uploaded photo, or custom avatar) into a 96-frame
 * Higgsfield 360° `.mp4` turntable specification!
 */
export function resolveTurntableSpecForOutfit(
  userSelectedProducts: Product[],
  effectiveProducts: Product[],
  avatarOptions?: TurntableAvatarOptions
): ResolvedTurntableSpec {
  const skinToneTargetHex = normalizeSkinToneShift(avatarOptions?.skinToneHex);

  // 0. Base Character (or Customer's Dedicated 360° Avatar Turntable!)
  if (userSelectedProducts.length === 0) {
    if (avatarOptions?.customTurntableMp4Url) {
      return {
        cacheKey: `hf:custom_avatar:${avatarOptions.customTurntableMp4Url}`,
        kind: "higgsfield_mp4",
        lookIdx: "custom",
        mp4Url: avatarOptions.customTurntableMp4Url,
        posterUrl:
          avatarOptions.customTurntablePosterUrl ||
          turntableUrlsForIndex("base").posterUrl,
        products: [],
      };
    }
    const urls = turntableUrlsForIndex("base");
    return {
      cacheKey: `hf:base|sk:${skinToneTargetHex || "def"}`,
      kind: "higgsfield_mp4",
      lookIdx: "base",
      ...urls,
      skinToneTargetHex,
      products: [],
    };
  }

  // 0b. Dedicated Product `.mp4` Turntable (e.g. generated via `/api/higgsfield`!)
  const customMp4Prod = userSelectedProducts.find((p) => Boolean(p.turntableMp4Url));
  if (customMp4Prod && customMp4Prod.turntableMp4Url) {
    return {
      cacheKey: `hf:custom_prod:${customMp4Prod.id}:${customMp4Prod.turntableMp4Url}|sk:${skinToneTargetHex || "def"}`,
      kind: "higgsfield_mp4",
      lookIdx: "custom",
      mp4Url: customMp4Prod.turntableMp4Url,
      posterUrl:
        customMp4Prod.turntablePosterUrl ||
        customMp4Prod.imageUrl ||
        turntableUrlsForIndex(0).posterUrl,
      skinToneTargetHex,
      products: effectiveProducts,
    };
  }

  // 1. Single-product inspection (PDP `/product/[id]`, `/product?id=...`, URL submit preview, or Store Rack 360°):
  if (userSelectedProducts.length === 1) {
    const single = userSelectedProducts[0];
    const mapped = SINGLE_SKU_TURNTABLE_MAP[single.id];
    if (mapped) {
      const urls = turntableUrlsForIndex(mapped.lookIdx);
      return {
        cacheKey: `${
          mapped.shift
            ? `hf:${mapped.lookIdx}:cw:${single.id}`
            : `hf:${mapped.lookIdx}`
        }|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: mapped.lookIdx,
        ...urls,
        colorwayShift: mapped.shift,
        colorwayShifts: mapped.shift ? [mapped.shift] : undefined,
        skinToneTargetHex,
        products: effectiveProducts,
      };
    }
    // External store pull, customer URL submit, or uploaded closet photo -> universal 96-frame synthesis!
    return synthesizeUniversalHiggsfieldSpec(
      userSelectedProducts,
      effectiveProducts,
      skinToneTargetHex
    );
  }

  // 2. Check if equipped outfit matches one of the 16 canonical Higgsfield capsules (or colorway dress capsule)
  const bySlot = new Map<string, Product>();
  for (const p of effectiveProducts) {
    bySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }

  const dressProd = bySlot.get("dress");
  if (dressProd && !bySlot.has("outerwear")) {
    const canonicalDressIdx: Record<string, number> = {
      "prod-ae-emerald-satin-midi": 2,
      "prod-ae-champagne-blazer-dress": 3,
      "prod-ae-crimson-corset-mini": 6,
      "prod-ae-cobalt-draped-mini": 12,
      "prod-ae-butter-lace-slip-midi": 14,
    };
    if (dressProd.id in canonicalDressIdx) {
      const idx = canonicalDressIdx[dressProd.id];
      const urls = turntableUrlsForIndex(idx);
      return {
        cacheKey: `hf:${idx}|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: idx,
        ...urls,
        skinToneTargetHex,
        products: effectiveProducts,
      };
    }
    const cw = COLORWAY_DRESS_TURNTABLE_MAP[dressProd.id];
    if (cw) {
      const urls = turntableUrlsForIndex(cw.lookIdx);
      return {
        cacheKey: `hf:${cw.lookIdx}:cw:${dressProd.id}|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: cw.lookIdx,
        ...urls,
        colorwayShift: cw.shift,
        colorwayShifts: [cw.shift],
        skinToneTargetHex,
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
    if (allCoreMatch && !("outerwear" in cap.coreSlots) && bySlot.has("outerwear")) {
      allCoreMatch = false;
    }
    const wornBag = bySlot.get("bag");
    if (allCoreMatch && wornBag && cap.optionalBag && wornBag.id !== cap.optionalBag) {
      allCoreMatch = false;
    }
    if (allCoreMatch) {
      const urls = turntableUrlsForIndex(cap.lookIdx);
      return {
        cacheKey: `hf:${cap.lookIdx}|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: cap.lookIdx,
        ...urls,
        skinToneTargetHex,
        products: effectiveProducts,
      };
    }
  }

  // 3. Any multi-piece outfit with store-pulled / URL-submitted / uploaded / cross-capsule pieces:
  //    Full 96-frame Higgsfield 360° turntable with multi-slot continuous fabric synthesis!
  return synthesizeUniversalHiggsfieldSpec(
    userSelectedProducts,
    effectiveProducts,
    skinToneTargetHex
  );
}

// ============================================================================
// AUTOMATIC GARMENT PHOTO DOMINANT FABRIC COLOR SAMPLER
// ============================================================================

const SAMPLED_HEX_CACHE = new Map<string, string>();

export async function sampleDominantFabricHexFromImageAsync(
  imageUrl: string,
  fallbackHex: string
): Promise<string> {
  if (!imageUrl || typeof document === "undefined") return fallbackHex;
  const hit = SAMPLED_HEX_CACHE.get(imageUrl);
  if (hit) return hit;

  try {
    const isolatedUrl = await isolateProductBackgroundClient(imageUrl);
    const im = await new Promise<HTMLImageElement | null>((res) => {
      const img = new Image();
      if (!isolatedUrl.startsWith("data:") && !isolatedUrl.startsWith("/")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = isolatedUrl;
    });
    if (!im) return fallbackHex;

    const S = 56;
    const cv = document.createElement("canvas");
    cv.width = S;
    cv.height = S;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fallbackHex;
    ctx.drawImage(im, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;

    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];

    // Sample central garment core [18%..82%] rejecting transparent/white cyclorama & exposed skin
    for (let y = Math.floor(S * 0.18); y < Math.ceil(S * 0.82); y++) {
      for (let x = Math.floor(S * 0.22); x < Math.ceil(S * 0.78); x++) {
        const k = (y * S + x) * 4;
        if (d[k + 3] < 140) continue;
        const r = d[k];
        const g = d[k + 1];
        const b = d[k + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        // Skip studio white/near-white background
        if (maxC > 240 && maxC - minC < 16) continue;
        // Skip likely warm human skin pixels if photo was on-model (unless near center chest)
        const isCore = x > S * 0.34 && x < S * 0.66 && y > S * 0.32 && y < S * 0.68;
        const looksLikeSkin =
          !isCore &&
          r > 135 &&
          r < 235 &&
          g > 95 &&
          b > 72 &&
          r - g > 18 &&
          r - g < 55 &&
          g - b > 10 &&
          r - b < 95;
        if (looksLikeSkin) continue;

        rs.push(r);
        gs.push(g);
        bs.push(b);
      }
    }

    if (rs.length < 18) return fallbackHex;
    rs.sort((a, b) => a - b);
    gs.sort((a, b) => a - b);
    bs.sort((a, b) => a - b);
    const mid = Math.floor(rs.length * 0.5);
    const to2 = (v: number) =>
      Math.min(255, Math.max(0, Math.round(v)))
        .toString(16)
        .padStart(2, "0");
    const sampled = `#${to2(rs[mid])}${to2(gs[mid])}${to2(bs[mid])}`;
    SAMPLED_HEX_CACHE.set(imageUrl, sampled);
    return sampled;
  } catch {
    return fallbackHex;
  }
}

async function resolveHydratedShiftsAsync(
  spec: ResolvedTurntableSpec
): Promise<ColorwayShiftSpec[]> {
  const rawList =
    spec.colorwayShifts || (spec.colorwayShift ? [spec.colorwayShift] : []);
  if (rawList.length === 0) return [];

  return Promise.all(
    rawList.map(async (s) => {
      if (!s.sampleFromImageUrl) return s;
      const sampledHex = await sampleDominantFabricHexFromImageAsync(
        s.sampleFromImageUrl,
        s.targetHex
      );
      // If product had an explicit color word (e.g. "Crimson" or "Black"), blend gently 65% explicit + 35% photo;
      // if generic ("Juliette Dress"), use 100% of the real sampled garment photo color!
      if (s.hasExplicitColorName) {
        const [er, eg, eb] = hexToRgb01(s.targetHex);
        const [sr, sg, sb] = hexToRgb01(sampledHex);
        const mixTo2 = (a: number, b: number) =>
          Math.round((a * 0.65 + b * 0.35) * 255)
            .toString(16)
            .padStart(2, "0");
        return {
          ...s,
          targetHex: `#${mixTo2(er, sr)}${mixTo2(eg, sg)}${mixTo2(eb, sb)}`,
        };
      }
      return { ...s, targetHex: sampledHex };
    })
  );
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
  const clean = (hex || "").replace("#", "");
  const n = parseInt(clean.padEnd(6, "0").slice(0, 6), 16) || 0x18191e;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function evaluateMaskWeight(
  mask: DonorFabricMaskId,
  r: number,
  g: number,
  b: number,
  lum: number,
  chroma: number
): number {
  switch (mask) {
    case "emerald_green":
      return (
        clamp01((g - r - 0.003) / 0.028) *
        clamp01((chroma - 0.016) / 0.036) *
        clamp01((0.92 - lum) / 0.10)
      );
    case "crimson_red":
      return (
        clamp01((r - g - 0.19) / 0.09) *
        clamp01((r - b - 0.20) / 0.09)
      );
    case "cobalt_blue":
      return (
        clamp01((b - r - 0.08) / 0.06) *
        clamp01((b - g * 0.85 - 0.04) / 0.06) *
        clamp01((0.90 - lum) / 0.10)
      );
    case "champagne_ivory": {
      const skinWarmth = Math.max(0, r - b);
      return (
        clamp01((lum - 0.55) / 0.09) *
        clamp01((0.94 - lum) / 0.06) *
        clamp01((0.15 - skinWarmth) / 0.06)
      );
    }
    case "espresso_brown": {
      const skinLike = r > 0.42 && r - b > 0.16;
      if (skinLike) return 0;
      return (
        clamp01((lum - 0.09) / 0.06) *
        clamp01((0.40 - lum) / 0.08) *
        clamp01((r - b - 0.02) / 0.05)
      );
    }
    case "noir_dark":
      return (
        clamp01((0.26 - lum) / 0.08) *
        clamp01((0.085 - chroma) / 0.05)
      );
    case "charcoal_dark":
      return (
        clamp01((lum - 0.10) / 0.06) *
        clamp01((0.36 - lum) / 0.08) *
        clamp01((0.09 - chroma) / 0.05)
      );
    case "indigo_denim":
      return (
        clamp01((b - r - 0.025) / 0.045) *
        clamp01((0.68 - lum) / 0.12) *
        clamp01((lum - 0.10) / 0.06)
      );
    case "sage_green":
      return (
        clamp01((g - r + 0.015) / 0.045) *
        clamp01((g - b - 0.005) / 0.045) *
        clamp01((0.65 - lum) / 0.12) *
        clamp01((lum - 0.14) / 0.06)
      );
    case "blush_rose": {
      const isTanSkin = g > b + 0.06 && r - g < 0.14;
      if (isTanSkin) return 0;
      return (
        clamp01((r - g - 0.045) / 0.055) *
        clamp01((lum - 0.48) / 0.10) *
        clamp01((0.92 - lum) / 0.06)
      );
    }
    case "merlot_bag":
      return (
        clamp01((r - g - 0.08) / 0.06) *
        clamp01((0.39 - lum) / 0.10)
      );
    case "camel_tan": {
      // Structured camel tote (warmer golden-ochre than forearm skin, positioned in lower hand zone)
      return (
        clamp01((r - b - 0.16) / 0.08) *
        clamp01((g - b - 0.08) / 0.06) *
        clamp01((lum - 0.25) / 0.10) *
        clamp01((0.76 - lum) / 0.10)
      );
    }
  }
}

/**
 * Post-processes a decoded video frame on a 2D canvas before `createImageBitmap`:
 * 1. Multi-slot continuous smooth colorway garment shader (supports store pulls & URL submits!)
 * 2. Optional 360° customer skin-tone harmonization across exposed skin (`y > 0.06`)
 * 3. Optional seamless outer `#FFFFFF` cyclorama border-scan keying (for Runway `/shop`)
 */
export function postProcessFrameCanvas(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  seamlessKeying: boolean,
  shifts?: ColorwayShiftSpec[],
  skinToneTargetHex?: string
): void {
  const hasShifts = Boolean(shifts && shifts.length > 0);
  if (!seamlessKeying && !hasShifts && !skinToneTargetHex) return;

  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;

  if (hasShifts && shifts) {
    for (const shift of shifts) {
      const [tr, tg, tb] = hexToRgb01(shift.targetHex);
      const tLum = Math.max(0.06, 0.299 * tr + 0.587 * tg + 0.114 * tb);
      const y0 = Math.max(0, Math.floor(shift.yRange[0] * H));
      const y1 = Math.min(H, Math.ceil(shift.yRange[1] * H));
      const x0 = shift.xRange ? Math.max(0, Math.floor(shift.xRange[0] * W)) : 0;
      const x1 = shift.xRange ? Math.min(W, Math.ceil(shift.xRange[1] * W)) : W;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const k = (y * W + x) * 4;
          const r = d[k] / 255;
          const g = d[k + 1] / 255;
          const b = d[k + 2] / 255;
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          const chroma = maxC - minC;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          const w = evaluateMaskWeight(shift.sourceMask, r, g, b, lum, chroma);
          if (w > 0.005) {
            const srcLum = Math.max(0.03, 0.26 * r + 0.61 * g + 0.13 * b);
            const normShade = clamp01(srcLum / 0.36);
            const spec = Math.pow(Math.max(0, srcLum - 0.36) / 0.64, 1.55) * 0.23;
            const scale = (0.34 + normShade * 1.12) * clamp01(tLum / 0.22 + 0.42);
            const nr = clamp01(
              (tr / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tr * 0.36 + spec
            );
            const ng = clamp01(
              (tg / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tg * 0.36 + spec
            );
            const nb = clamp01(
              (tb / Math.max(0.14, tLum)) * srcLum * scale * 0.52 + tb * 0.36 + spec
            );
            d[k] = Math.round((r * (1 - w) + nr * w) * 255);
            d[k + 1] = Math.round((g * (1 - w) + ng * w) * 255);
            d[k + 2] = Math.round((b * (1 - w) + nb * w) * 255);
          }
        }
      }
    }
  }

  if (skinToneTargetHex) {
    const [sr, sg, sb] = hexToRgb01(skinToneTargetHex);
    const baseR = 0.78;
    const baseG = 0.57;
    const baseB = 0.45;
    const mulR = clamp01((sr / baseR) * 0.5) * 2;
    const mulG = clamp01((sg / baseG) * 0.5) * 2;
    const mulB = clamp01((sb / baseB) * 0.5) * 2;
    const yStart = Math.floor(H * 0.07);
    const yEnd = Math.ceil(H * 0.89);

    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        const r = d[k] / 255;
        const g = d[k + 1] / 255;
        const b = d[k + 2] / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // Detect natural warm medium-tan skin while rejecting dark hair, eyes, white bg, and garments
        const sw =
          clamp01((r - g - 0.065) / 0.05) *
          clamp01((0.24 - (r - g)) / 0.06) *
          clamp01((g - b - 0.045) / 0.045) *
          clamp01((lum - 0.28) / 0.10) *
          clamp01((0.82 - lum) / 0.08) *
          0.62;
        if (sw > 0.01) {
          d[k] = Math.round(clamp01(r * (1 - sw) + r * mulR * sw) * 255);
          d[k + 1] = Math.round(clamp01(g * (1 - sw) + g * mulG * sw) * 255);
          d[k + 2] = Math.round(clamp01(b * (1 - sw) + b * mulB * sw) * 255);
        }
      }
    }
  }

  if (seamlessKeying) {
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
  const [im, hydratedShifts] = await Promise.all([
    new Promise<HTMLImageElement | null>((res) => {
      const img = new Image();
      if (!spec.posterUrl.startsWith("data:") && !spec.posterUrl.startsWith("/")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = spec.posterUrl;
    }),
    resolveHydratedShiftsAsync(spec),
  ]);
  if (!im) return null;

  const W = 432;
  const H = 768;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", {
    willReadFrequently: Boolean(
      seamlessKeying || hydratedShifts.length > 0 || spec.skinToneTargetHex
    ),
  })!;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(im, 0, 0, W, H);
  postProcessFrameCanvas(
    ctx,
    W,
    H,
    seamlessKeying,
    hydratedShifts,
    spec.skinToneTargetHex
  );
  return createImageBitmap(cv);
}

export function prefetchTurntableBundle(
  products: Product[],
  seamlessKeying: boolean,
  avatarOptions?: TurntableAvatarOptions
): void {
  if (typeof window === "undefined") return;
  const spec = resolveTurntableSpecForOutfit(products, products, avatarOptions);
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

    const hydratedShiftsPromise = resolveHydratedShiftsAsync(spec);

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

    const hydratedShifts = await hydratedShiftsPromise;
    const dur = Math.max(0.5, vid.duration || 9.9);
    const W = 432;
    const H = 768;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d", {
      willReadFrequently: Boolean(
        seamlessKeying || hydratedShifts.length > 0 || spec.skinToneTargetHex
      ),
    })!;

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
      postProcessFrameCanvas(
        ctx,
        W,
        H,
        seamlessKeying,
        hydratedShifts,
        spec.skinToneTargetHex
      );
      const bmp = await createImageBitmap(cv);
      frames.push(bmp);
      onProgress?.(i + 1, N);
    }

    vid.pause();
    vid.removeAttribute("src");
    vid.load();

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

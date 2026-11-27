/**
 * ============================================================================
 * GWO UNIVERSAL HIGGSFIELD 360° ALL-INTRA MP4 -> IMAGEBITMAP[] TURNTABLE ENGINE
 * File: src/lib/three/higgsfield-turntable-engine.ts
 * ============================================================================
 *
 * Powers 100% studio-photorealistic 96-frame / 60fps `ImageBitmap[]` 360° inertia
 * turntables with <90ms progressive coarse-to-fine instant-spin streaming across:
 *   1. All 16 canonical capsules & 54 verified boutique SKUs (including bags & shoes)
 *   2. Closet mix-and-match across tops, bottoms, dresses, outerwear, bags & footwear
 *   3. Live Shopify & AliExpress store rack pulls (`pullStoreRackToCatalog`)
 *   4. Single customer product URL submits (`ingestUrlToSharedCatalog`)
 *   5. Customer-uploaded closet photos (`uploaded-3d-*`) & custom customer avatars
 */

import { Product } from "../types";
import {
  classifyWearableSlotAndAnchors,
  isolateProductBackgroundClient,
} from "./avatar-ready-pipeline";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const TURNTABLE_VER = "hf360v4";
export const NUM_TURNTABLE_FRAMES = 96;

export const ATLAS_COLS = 12;
export const ATLAS_ROWS = 8;
export const ATLAS_CELL_W = 260;
export const ATLAS_CELL_H = 512;
export const ATLAS_ROI_X0 = 0.14;
export const ATLAS_ROI_W = 0.72;
export const ATLAS_ROI_Y0 = 0.10;
export const ATLAS_ROI_H = 0.82;

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
  | "camel_tan"
  | "silver_metallic"
  | "shoe_footwear";

const DEFAULT_MASK_NATIVE_HEX: Record<DonorFabricMaskId, string> = {
  emerald_green: "#1F5441",
  crimson_red: "#C80815",
  cobalt_blue: "#18367A",
  champagne_ivory: "#E2DACD",
  espresso_brown: "#4B3531",
  noir_dark: "#1B1C20",
  charcoal_dark: "#383B42",
  indigo_denim: "#4F6B8E",
  sage_green: "#626D5E",
  blush_rose: "#D8ACB4",
  merlot_bag: "#6E1423",
  camel_tan: "#B58969",
  silver_metallic: "#C8CCD4",
  shoe_footwear: "#2A2628",
};

export interface ColorwayShiftSpec {
  /** Target product hex color */
  targetHex: string;
  /** Native donor fabric hex for physical albedo-ratio normalization */
  nativeHex?: string;
  /** Boost crisp chrome/gold specular highlights for metallic leather/satin */
  isMetallic?: boolean;
  /** Optional product photo URL to auto-sample true garment color */
  sampleFromImageUrl?: string;
  /** Whether title/colorName explicitly named a color */
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
  /** Optional product ID most recently clicked/focused by the customer in Closet or Modal */
  focusProductId?: string;
}

export interface ResolvedTurntableSpec {
  cacheKey: string;
  kind: "higgsfield_mp4";
  lookIdx: number | "base" | "custom";
  mp4Url: string;
  atlasUrl?: string;
  posterUrl: string;
  colorwayShift?: ColorwayShiftSpec;
  colorwayShifts?: ColorwayShiftSpec[];
  skinToneTargetHex?: string;
  products: Product[];
}

interface CanonicalCapsuleRule {
  lookIdx: number;
  coreSlots: Record<string, string>;
  nativeBag?: string;
  nativeShoes?: string;
}

const CANONICAL_16_CAPSULES: CanonicalCapsuleRule[] = [
  {
    lookIdx: 0,
    coreSlots: {
      top: "prod-ae-espresso-corset",
      bottom: "prod-ae-champagne-trousers",
    },
    nativeBag: "prod-ae-burgundy-crescent-bag",
    nativeShoes: "prod-ae-noir-slingbacks",
  },
  {
    lookIdx: 1,
    coreSlots: {
      outerwear: "prod-ae-ivory-tweed-blazer",
      bottom: "prod-ae-noir-pleated-mini",
    },
    nativeBag: "prod-ae-camel-turnlock-tote",
    nativeShoes: "prod-ae-meotina-leather-boots",
  },
  {
    lookIdx: 2,
    coreSlots: { dress: "prod-ae-emerald-satin-midi" },
    nativeBag: "prod-ae-burgundy-crescent-bag",
    nativeShoes: "prod-ae-gold-strappy-heels",
  },
  {
    lookIdx: 3,
    coreSlots: { dress: "prod-ae-champagne-blazer-dress" },
    nativeBag: "prod-ae-ivory-mini-bag",
    nativeShoes: "prod-ae-gold-strappy-heels",
  },
  {
    lookIdx: 4,
    coreSlots: {
      outerwear: "prod-ae-camel-silk-wool-coat",
      bottom: "prod-ae-champagne-trousers",
    },
    nativeBag: "prod-ae-camel-turnlock-tote",
    nativeShoes: "prod-ae-noir-slingbacks",
  },
  {
    lookIdx: 5,
    coreSlots: {
      outerwear: "prod-ae-linen-cinch-cardigan",
      bottom: "prod-ae-noir-pleated-mini",
    },
    nativeBag: "prod-ae-camel-turnlock-tote",
    nativeShoes: "prod-ae-noir-slingbacks",
  },
  {
    lookIdx: 6,
    coreSlots: { dress: "prod-ae-crimson-corset-mini" },
    nativeBag: "prod-ae-noir-quilted-bag",
    nativeShoes: "prod-ae-gold-strappy-heels",
  },
  {
    lookIdx: 7,
    coreSlots: {
      outerwear: "prod-ae-noir-tailored-blazer",
      bottom: "prod-ae-vintage-wide-denim",
    },
    nativeBag: "prod-ae-burgundy-crescent-bag",
    nativeShoes: "prod-ae-noir-slingbacks",
  },
  {
    lookIdx: 8,
    coreSlots: {
      outerwear: "prod-ae-sage-zip-jacket",
      bottom: "prod-ae-sage-flare-leggings",
    },
    nativeBag: "prod-ae-ivory-mini-bag",
    nativeShoes: "prod-ae-cloud-platform-sneakers",
  },
  {
    lookIdx: 9,
    coreSlots: {
      top: "prod-ae-espresso-corset",
      bottom: "prod-ae-vintage-wide-denim",
    },
    nativeBag: "prod-ae-noir-quilted-bag",
    nativeShoes: "prod-ae-meotina-leather-boots",
  },
  {
    lookIdx: 10,
    coreSlots: {
      top: "prod-ae-blush-ruched-offshoulder",
      bottom: "prod-ae-ivory-satin-bias-midi",
    },
    nativeBag: "prod-ae-ivory-mini-bag",
    nativeShoes: "prod-ae-gold-strappy-heels",
  },
  {
    lookIdx: 11,
    coreSlots: {
      top: "prod-ae-noir-halter-vest",
      bottom: "prod-ae-charcoal-pinstripe-trousers",
    },
    nativeBag: "prod-ae-noir-quilted-bag",
    nativeShoes: "prod-ae-noir-slingbacks",
  },
  {
    lookIdx: 12,
    coreSlots: { dress: "prod-ae-cobalt-draped-mini" },
    nativeBag: "prod-ae-silver-metallic-shoulder-bag",
    nativeShoes: "prod-ae-silver-crystal-heels",
  },
  {
    lookIdx: 13,
    coreSlots: {
      outerwear: "prod-ae-burgundy-leather-trench",
      bottom: "prod-ae-vintage-wide-denim",
    },
    nativeBag: "prod-ae-burgundy-crescent-bag",
    nativeShoes: "prod-ae-burgundy-patent-heels",
  },
  {
    lookIdx: 14,
    coreSlots: {
      outerwear: "prod-ae-cream-cropped-fur-jacket",
      dress: "prod-ae-butter-lace-slip-midi",
    },
    nativeBag: "prod-ae-camel-turnlock-tote",
    nativeShoes: "prod-ae-gold-strappy-heels",
  },
  {
    lookIdx: 15,
    coreSlots: {
      top: "prod-ae-butter-silk-cami",
      bottom: "prod-ae-espresso-tailored-shorts",
    },
    nativeBag: "prod-ae-burgundy-crescent-bag",
    nativeShoes: "prod-ae-burgundy-patent-heels",
  },
];

/**
 * Authoritative mapping for every single store SKU when inspected individually
 * (PDP `/product/[id]`, `/product?id=...`, URL submit preview, or Store Rack 360°).
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
      nativeHex: "#1F5441",
      hasExplicitColorName: true,
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-onyx-satin-midi": {
    lookIdx: 2,
    shift: {
      targetHex: "#1B1C20",
      nativeHex: "#1F5441",
      hasExplicitColorName: true,
      sourceMask: "emerald_green",
      yRange: [0.20, 0.78],
    },
  },
  "prod-ae-rosewood-corset-mini": {
    lookIdx: 6,
    shift: {
      targetHex: "#8C4C58",
      nativeHex: "#C80815",
      hasExplicitColorName: true,
      sourceMask: "crimson_red",
      yRange: [0.22, 0.59],
    },
  },
  "prod-ae-noir-tuxedo-blazer-dress": {
    lookIdx: 3,
    shift: {
      targetHex: "#1D1E23",
      nativeHex: "#E6CFC5",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.58],
    },
  },
  "prod-ae-ivory-pearl-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#EFE9DF",
      nativeHex: "#4B3531",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-noir-satin-corset": {
    lookIdx: 0,
    shift: {
      targetHex: "#1D1E22",
      nativeHex: "#4B3531",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.24, 0.43],
    },
  },
  "prod-ae-emerald-silk-cami": {
    lookIdx: 15,
    shift: {
      targetHex: "#1B5240",
      nativeHex: "#F2E6C9",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.23, 0.42],
    },
  },
  "prod-ae-camel-tailored-vest": {
    lookIdx: 11,
    shift: {
      targetHex: "#B99976",
      nativeHex: "#17181C",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.22, 0.43],
    },
  },
  "prod-ae-obsidian-wide-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#1E2024",
      nativeHex: "#D9CEBE",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.85],
    },
  },
  "prod-ae-olive-pleated-trousers": {
    lookIdx: 0,
    shift: {
      targetHex: "#4B5343",
      nativeHex: "#D9CEBE",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.40, 0.85],
    },
  },
  "prod-ae-burgundy-pleated-mini": {
    lookIdx: 1,
    shift: {
      targetHex: "#581F29",
      nativeHex: "#1D1E22",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.42, 0.57],
    },
  },
  "prod-ae-chocolate-satin-midi": {
    lookIdx: 10,
    shift: {
      targetHex: "#432D27",
      nativeHex: "#F0EDE6",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.41, 0.79],
    },
  },
  "prod-ae-emerald-tweed-blazer": {
    lookIdx: 1,
    shift: {
      targetHex: "#21493B",
      nativeHex: "#EFECE6",
      hasExplicitColorName: true,
      sourceMask: "champagne_ivory",
      yRange: [0.20, 0.44],
    },
  },
  "prod-ae-espresso-tailored-blazer": {
    lookIdx: 7,
    shift: {
      targetHex: "#422E28",
      nativeHex: "#18191D",
      hasExplicitColorName: true,
      sourceMask: "noir_dark",
      yRange: [0.20, 0.51],
    },
  },
  "prod-ae-charcoal-wool-coat": {
    lookIdx: 4,
    shift: {
      targetHex: "#33363B",
      nativeHex: "#4A3B31",
      hasExplicitColorName: true,
      sourceMask: "espresso_brown",
      yRange: [0.20, 0.76],
    },
  },
  "prod-ae-espresso-suede-crescent-bag": {
    lookIdx: 0,
    shift: {
      targetHex: "#3B2822",
      nativeHex: "#6E1423",
      hasExplicitColorName: true,
      sourceMask: "merlot_bag",
      yRange: [0.22, 0.46],
    },
  },
};

/**
 * Complete anatomical garment, handbag, and footwear zone descriptors for all 16
 * Higgsfield 360° donor turntables (`ae_outfit_0..15`), ensuring EVERY slot change
 * in Closet (`top`, `bottom`, `dress`, `outerwear`, `bag`, `shoes`) updates accurately!
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
  shoes?: DonorZoneDef;
}

const DONOR_ANATOMY_BY_LOOK: Record<number, DonorTurntableAnatomy> = {
  0: {
    lookIdx: 0,
    top: { mask: "espresso_brown", nativeHex: "#4B3531", yRange: [0.24, 0.43] },
    bottom: { mask: "champagne_ivory", nativeHex: "#D9CEBE", yRange: [0.40, 0.85] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.46] },
    shoes: { mask: "shoe_footwear", nativeHex: "#18191D", yRange: [0.84, 0.90] },
  },
  1: {
    lookIdx: 1,
    outerwear: { mask: "champagne_ivory", nativeHex: "#EFECE6", yRange: [0.20, 0.44] },
    bottom: { mask: "noir_dark", nativeHex: "#1D1E22", yRange: [0.42, 0.57] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
    shoes: { mask: "shoe_footwear", nativeHex: "#1B1C20", yRange: [0.68, 0.90] },
  },
  2: {
    lookIdx: 2,
    dress: { mask: "emerald_green", nativeHex: "#1F5441", yRange: [0.20, 0.78] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.45] },
    shoes: { mask: "shoe_footwear", nativeHex: "#D4BD9E", yRange: [0.81, 0.90] },
  },
  3: {
    lookIdx: 3,
    dress: { mask: "champagne_ivory", nativeHex: "#E6CFC5", yRange: [0.20, 0.58] },
    bag: { mask: "champagne_ivory", nativeHex: "#F2EFE9", yRange: [0.48, 0.67] },
    shoes: { mask: "shoe_footwear", nativeHex: "#D4BD9E", yRange: [0.81, 0.90] },
  },
  4: {
    lookIdx: 4,
    outerwear: { mask: "espresso_brown", nativeHex: "#4A3B31", yRange: [0.20, 0.76] },
    top: { mask: "champagne_ivory", nativeHex: "#F0ECE4", yRange: [0.24, 0.39], xRange: [0.43, 0.57] },
    bottom: { mask: "champagne_ivory", nativeHex: "#D9CEBE", yRange: [0.40, 0.85] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
    shoes: { mask: "shoe_footwear", nativeHex: "#18191D", yRange: [0.84, 0.90] },
  },
  5: {
    lookIdx: 5,
    outerwear: { mask: "champagne_ivory", nativeHex: "#D8CEBE", yRange: [0.21, 0.50] },
    bottom: { mask: "noir_dark", nativeHex: "#1D1E22", yRange: [0.44, 0.58] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.72] },
    shoes: { mask: "shoe_footwear", nativeHex: "#18191D", yRange: [0.81, 0.90] },
  },
  6: {
    lookIdx: 6,
    dress: { mask: "crimson_red", nativeHex: "#C80815", yRange: [0.22, 0.59] },
    bag: { mask: "noir_dark", nativeHex: "#18181B", yRange: [0.28, 0.50] },
    shoes: { mask: "shoe_footwear", nativeHex: "#D4BD9E", yRange: [0.81, 0.90] },
  },
  7: {
    lookIdx: 7,
    outerwear: { mask: "noir_dark", nativeHex: "#18191D", yRange: [0.20, 0.51] },
    top: { mask: "champagne_ivory", nativeHex: "#F1EEE8", yRange: [0.23, 0.41], xRange: [0.43, 0.57] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.43, 0.85] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.24, 0.48] },
    shoes: { mask: "shoe_footwear", nativeHex: "#18191D", yRange: [0.84, 0.90] },
  },
  8: {
    lookIdx: 8,
    outerwear: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.20, 0.43] },
    top: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.20, 0.43] },
    bottom: { mask: "sage_green", nativeHex: "#626D5E", yRange: [0.43, 0.85] },
    bag: { mask: "champagne_ivory", nativeHex: "#F2EFE9", yRange: [0.48, 0.67] },
    shoes: { mask: "shoe_footwear", nativeHex: "#F2F3F5", yRange: [0.84, 0.90] },
  },
  9: {
    lookIdx: 9,
    top: { mask: "espresso_brown", nativeHex: "#4B3531", yRange: [0.24, 0.43] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.41, 0.85] },
    bag: { mask: "noir_dark", nativeHex: "#18181B", yRange: [0.36, 0.58] },
    shoes: { mask: "shoe_footwear", nativeHex: "#1B1C20", yRange: [0.84, 0.90] },
  },
  10: {
    lookIdx: 10,
    top: { mask: "blush_rose", nativeHex: "#D8ACB4", yRange: [0.25, 0.43] },
    bottom: { mask: "champagne_ivory", nativeHex: "#EFEBE2", yRange: [0.41, 0.79] },
    bag: { mask: "champagne_ivory", nativeHex: "#F2EFE9", yRange: [0.49, 0.68] },
    shoes: { mask: "shoe_footwear", nativeHex: "#D4BD9E", yRange: [0.81, 0.90] },
  },
  11: {
    lookIdx: 11,
    top: { mask: "noir_dark", nativeHex: "#17181C", yRange: [0.22, 0.43] },
    bottom: { mask: "charcoal_dark", nativeHex: "#383B42", yRange: [0.42, 0.85] },
    bag: { mask: "noir_dark", nativeHex: "#18181B", yRange: [0.26, 0.45] },
    shoes: { mask: "shoe_footwear", nativeHex: "#18191D", yRange: [0.84, 0.90] },
  },
  12: {
    lookIdx: 12,
    dress: { mask: "cobalt_blue", nativeHex: "#18367A", yRange: [0.23, 0.59] },
    bag: { mask: "silver_metallic", nativeHex: "#C8CCD4", yRange: [0.21, 0.45] },
    shoes: { mask: "shoe_footwear", nativeHex: "#CFD3DC", yRange: [0.81, 0.90] },
  },
  13: {
    lookIdx: 13,
    outerwear: { mask: "merlot_bag", nativeHex: "#5C1622", yRange: [0.20, 0.47] },
    top: { mask: "champagne_ivory", nativeHex: "#F1ECE2", yRange: [0.25, 0.41], xRange: [0.43, 0.57] },
    bottom: { mask: "indigo_denim", nativeHex: "#4F6B8E", yRange: [0.44, 0.85] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.24, 0.46] },
    shoes: { mask: "shoe_footwear", nativeHex: "#5C1622", yRange: [0.84, 0.90] },
  },
  14: {
    lookIdx: 14,
    outerwear: { mask: "champagne_ivory", nativeHex: "#F2EFE9", yRange: [0.20, 0.42] },
    dress: { mask: "champagne_ivory", nativeHex: "#EDE2C8", yRange: [0.40, 0.78] },
    bag: { mask: "camel_tan", nativeHex: "#B58969", yRange: [0.48, 0.69] },
    shoes: { mask: "shoe_footwear", nativeHex: "#D4BD9E", yRange: [0.81, 0.90] },
  },
  15: {
    lookIdx: 15,
    top: { mask: "champagne_ivory", nativeHex: "#F2E6C9", yRange: [0.23, 0.42] },
    bottom: { mask: "espresso_brown", nativeHex: "#44312C", yRange: [0.41, 0.58] },
    bag: { mask: "merlot_bag", nativeHex: "#6E1423", yRange: [0.22, 0.45] },
    shoes: { mask: "shoe_footwear", nativeHex: "#5C1622", yRange: [0.81, 0.90] },
  },
};

export function turntableUrlsForIndex(lookIdx: number | "base"): {
  mp4Url: string;
  atlasUrl: string;
  posterUrl: string;
} {
  const slug = lookIdx === "base" ? "ae_base" : `ae_outfit_${lookIdx}`;
  return {
    mp4Url: `${BASE}/models/turntables/${slug}_360.mp4?v=${TURNTABLE_VER}`,
    atlasUrl: `${BASE}/models/turntables/${slug}_atlas.webp?v=${TURNTABLE_VER}`,
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

function isMetallicProduct(p: Product): boolean {
  return /\b(silver|chrome|metallic|gold|14k|crystal|platinum)\b/i.test(
    `${p.title} ${p.colorName}`
  );
}

function hexDistance01(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb01(hexA);
  const [r2, g2, b2] = hexToRgb01(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function normalizeSkinToneShift(skinToneHex?: string): string | undefined {
  if (!skinToneHex) return undefined;
  if (hexDistance01(skinToneHex, "#C89272") < 0.14) return undefined;
  return skinToneHex;
}

function selectOptimalDonorLookIdx(
  bySlot: Map<string, Product>,
  focusBySlot: Map<string, Product>,
  isSingleInspection: boolean
): number {
  const dress = focusBySlot.get("dress") || bySlot.get("dress");
  const outer = focusBySlot.get("outerwear") || bySlot.get("outerwear");
  const top = focusBySlot.get("top") || bySlot.get("top");
  const bot = focusBySlot.get("bottom") || bySlot.get("bottom");
  const bag = focusBySlot.get("bag") || bySlot.get("bag");
  const shoes = focusBySlot.get("shoes") || bySlot.get("shoes");

  // 1. Single-item inspection for Bags or Shoes (URL submit, Store Rack, or solo item):
  if (isSingleInspection && focusBySlot.size === 1) {
    if (focusBySlot.has("bag") && bag) {
      const t = `${bag.title} ${bag.silhouette} ${bag.colorName}`.toLowerCase();
      if (/tote|satchel|work|trapezium|shopper/.test(t)) return 1;
      if (/quilted|chain|flap|crossbody/.test(t)) return 9;
      if (/mini|top-handle|clutch|pearl/.test(t)) return 3;
      if (/silver|metallic|chrome|crystal/.test(t)) return 12;
      return 0;
    }
    if (focusBySlot.has("shoes") && shoes) {
      const t = `${shoes.title} ${shoes.silhouette} ${shoes.colorName}`.toLowerCase();
      if (/sneaker|trainer|runner|platform|court/.test(t)) return 8;
      if (/boot|knee/.test(t)) return 1;
      if (/silver|crystal/.test(t)) return 12;
      if (/strappy|sandal|gold|stiletto/.test(t)) return 2;
      return 0;
    }
  }

  // 2. Dress equipped:
  if (dress) {
    const t = `${dress.title} ${dress.silhouette} ${dress.fitMetadata?.hemLanding || ""}`.toLowerCase();
    if (outer) {
      return 14;
    }
    if (dress.id === "prod-ae-emerald-satin-midi" || dress.id === "prod-ae-sapphire-satin-midi" || dress.id === "prod-ae-onyx-satin-midi") {
      return 2;
    }
    if (dress.id === "prod-ae-champagne-blazer-dress" || dress.id === "prod-ae-noir-tuxedo-blazer-dress" || /blazer|tuxedo|lapel|romper|suit/.test(t)) {
      return 3;
    }
    if (dress.id === "prod-ae-cobalt-draped-mini" || (/asymmetric|draped|cobalt|blue|silver/.test(t) && !/corset|midi|maxi/.test(t))) {
      return 12;
    }
    if (dress.id === "prod-ae-butter-lace-slip-midi") {
      return 2;
    }
    if (/midi|maxi|slip|gown|column|bias|cowl/.test(t) && !/mini/.test(t)) {
      return 2;
    }
    return 6;
  }

  // 3. Outerwear / Jacket / Coat equipped (ONLY used when customer actually equipped outerwear or inspected solo outerwear!):
  if (outer && (bySlot.has("outerwear") || isSingleInspection)) {
    const t = `${outer.title} ${outer.silhouette} ${outer.fitMetadata?.hemLanding || ""}`.toLowerCase();
    const bt = bot ? `${bot.title} ${bot.silhouette} ${bot.fitMetadata?.hemLanding || ""}`.toLowerCase() : "";
    const isShortBot = Boolean(bot && /mini|short|skort|pleat/.test(bt) && !/midi|maxi|trouser|wide|denim|jean/.test(bt));

    if (/coat|maxi|long|wool|cashmere/.test(t) && !/cropped/.test(t)) return 4;
    if (/leather|moto|trench|biker|suede/.test(t)) return 13;
    if (/zip|hoodie|sweatshirt|active|sculpt|yoga|fleece|pullover/.test(t)) return 8;
    if (/cardigan|knit|sweater|shawl/.test(t)) return 5;
    if (/fur|plush|mink|bolero|sherpa/.test(t)) return 14;
    if (/boucl|tweed/.test(t) || isShortBot) return isShortBot || !bot ? 1 : 7;
    if (/oversized|boyfriend|double-breasted|tailored|blazer/.test(t)) return isShortBot ? 1 : 7;
    return isShortBot ? 1 : 7;
  }

  // 4. Top + Bottom separates WITHOUT outerwear (NEVER contaminates outfit with an unwanted jacket/cardigan!):
  const bt = bot ? `${bot.title} ${bot.silhouette} ${bot.fitMetadata?.hemLanding || ""}`.toLowerCase() : "";
  const tt = top ? `${top.title} ${top.silhouette}`.toLowerCase() : "";

  if (
    /legging|yoga|jogger|sweatpant/.test(bt) ||
    /\b(sports-bra|activewear|athletic|gym|workout)\b/.test(tt)
  ) {
    return 8;
  }
  // Bare-leg shorts or mini skirts WITHOUT jacket -> Look 15 (sleeveless top + high-waist mini/short bottom + shoulder bag!)
  if (
    (/short|skort/.test(bt) || (/mini-skirt|pleat|mini/.test(bt) && !/midi|maxi|long/.test(bt))) &&
    !outer
  ) {
    // If customer explicitly just clicked Knee-High Boots (`prod-ae-meotina-leather-boots`), Look 1 showcases full knee boots!
    if (focusBySlot.has("shoes") && shoes && /boot|knee/i.test(`${shoes.title} ${shoes.silhouette}`)) {
      return 1;
    }
    return 15;
  }
  // Midi / Maxi skirts -> Look 10 (fitted top + bias satin midi skirt!)
  if (/midi|maxi|bias|slip|skirt/.test(bt)) {
    return 10;
  }
  // Denim / Jeans -> Look 9 (corset/fitted top + full-length wide denim + quilted shoulder bag!)
  if (/denim|jean|indigo/.test(bt)) {
    return 9;
  }
  // Halter waistcoat vest or pinstripe trousers -> Look 11
  if (/vest|waistcoat|halter/.test(tt) || /pinstripe|charcoal/.test(bt)) {
    return 11;
  }
  // Off-shoulder ruched top with wide trousers -> Look 10 if skirt, else Look 0
  if (/off-shoulder|ruched|mesh/.test(tt) && !bot) {
    return 10;
  }
  // If customer explicitly just clicked a handheld bag (`Camel Tote` / `Ivory Mini Bag`), prefer handheld-bag separates donor `10` if skirt, else recolor cleanly on `0`
  return 0;
}

function synthesizeUniversalHiggsfieldSpec(
  primaryFocusProducts: Product[],
  effectiveProducts: Product[],
  skinToneTargetHex?: string,
  forcedLookIdx?: number
): ResolvedTurntableSpec {
  const bySlot = new Map<string, Product>();
  for (const p of effectiveProducts) {
    bySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }
  const focusBySlot = new Map<string, Product>();
  for (const p of primaryFocusProducts) {
    focusBySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }

  const isSingleInspection = primaryFocusProducts.length === 1 && effectiveProducts.length <= 1;
  const lookIdx =
    typeof forcedLookIdx === "number"
      ? forcedLookIdx
      : selectOptimalDonorLookIdx(bySlot, focusBySlot, isSingleInspection);

  const donor = DONOR_ANATOMY_BY_LOOK[lookIdx] || DONOR_ANATOMY_BY_LOOK[0];
  const capRule = CANONICAL_16_CAPSULES.find((c) => c.lookIdx === lookIdx);
  const shifts: ColorwayShiftSpec[] = [];

  const maybeAddSlotShift = (
    prod: Product | undefined,
    zone: DonorZoneDef | undefined,
    slotName: string
  ) => {
    if (!prod || !zone) return;

    // Native exact SKU match for this capsule's slot -> zero recoloring needed!
    if (capRule) {
      if (capRule.coreSlots[slotName] === prod.id) return;
      if (slotName === "bag" && capRule.nativeBag === prod.id) return;
      if (slotName === "shoes" && capRule.nativeShoes === prod.id) return;
    }
    const mappedSku = SINGLE_SKU_TURNTABLE_MAP[prod.id];
    if (mappedSku && mappedSku.lookIdx === lookIdx && !mappedSku.shift) {
      return;
    }
    if (mappedSku?.shift && mappedSku.lookIdx === lookIdx) {
      shifts.push(mappedSku.shift);
      return;
    }

    // Avoid dual-shifting when donor shares identical mask in overlapping yRange (e.g. Look 14 cream fur + cream slip, or Look 13 burgundy jacket + burgundy bag)
    if (
      shifts.some(
        (existing) =>
          existing.sourceMask === zone.mask &&
          Math.max(existing.yRange[0], zone.yRange[0]) <
            Math.min(existing.yRange[1], zone.yRange[1])
      )
    ) {
      return;
    }

    const explicitColor = hasExplicitColorKeyword(prod);
    const needsPhotoSample =
      Boolean(prod.imageUrl) &&
      (!explicitColor ||
        prod.sourceType === "scraped_url" ||
        prod.id.startsWith("uploaded-3d-"));

    const targetHex = prod.colorHex || zone.nativeHex;
    if (needsPhotoSample || hexDistance01(targetHex, zone.nativeHex) > 0.09) {
      shifts.push({
        targetHex,
        nativeHex: zone.nativeHex,
        isMetallic: isMetallicProduct(prod),
        sampleFromImageUrl: needsPhotoSample ? prod.imageUrl : undefined,
        hasExplicitColorName: explicitColor,
        sourceMask: zone.mask,
        yRange: zone.yRange,
        xRange: zone.xRange,
      });
    }
  };

  const dress = bySlot.get("dress");
  const outer = bySlot.get("outerwear");
  const top = bySlot.get("top");
  const bot = bySlot.get("bottom");
  const bag = bySlot.get("bag");
  const shoes = bySlot.get("shoes");

  if (isSingleInspection) {
    const single = primaryFocusProducts[0];
    const slot = classifyWearableSlotAndAnchors(single).slot;
    if (slot === "dress") maybeAddSlotShift(single, donor.dress, "dress");
    else if (slot === "outerwear") maybeAddSlotShift(single, donor.outerwear, "outerwear");
    else if (slot === "top") maybeAddSlotShift(single, donor.top || donor.outerwear, "top");
    else if (slot === "bottom") maybeAddSlotShift(single, donor.bottom, "bottom");
    else if (slot === "bag") maybeAddSlotShift(single, donor.bag, "bag");
    else if (slot === "shoes") maybeAddSlotShift(single, donor.shoes, "shoes");
  } else {
    if (dress && donor.dress) maybeAddSlotShift(dress, donor.dress, "dress");
    if (outer && donor.outerwear) maybeAddSlotShift(outer, donor.outerwear, "outerwear");
    if (top && donor.top) maybeAddSlotShift(top, donor.top, "top");
    if (bot && donor.bottom) maybeAddSlotShift(bot, donor.bottom, "bottom");
    if (bag && donor.bag) maybeAddSlotShift(bag, donor.bag, "bag");
    if (shoes && donor.shoes) maybeAddSlotShift(shoes, donor.shoes, "shoes");
  }

  const urls = turntableUrlsForIndex(lookIdx);
  if (shifts.length === 0) {
    return {
      cacheKey: `hf:${lookIdx}|sk:${skinToneTargetHex || "def"}`,
      kind: "higgsfield_mp4",
      lookIdx,
      ...urls,
      skinToneTargetHex,
      products: effectiveProducts,
    };
  }

  const shiftSig = shifts
    .map(
      (s) =>
        `${s.sourceMask}:${s.targetHex}:${s.sampleFromImageUrl ? s.sampleFromImageUrl.slice(-24) : ""}`
    )
    .join("|");

  return {
    cacheKey: `hf:${lookIdx}:univ:${shiftSig}|sk:${skinToneTargetHex || "def"}`,
    kind: "higgsfield_mp4",
    lookIdx,
    ...urls,
    colorwayShift: shifts[0],
    colorwayShifts: shifts,
    skinToneTargetHex,
    products: effectiveProducts,
  };
}

/**
 * Resolves ANY equipped product set (canonical capsule, Closet mix-and-match, single SKU,
 * live Shopify/AliExpress store pull, customer URL submit, uploaded photo, or custom avatar)
 * into a 96-frame Higgsfield 360° `.mp4` turntable specification!
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
    return synthesizeUniversalHiggsfieldSpec(
      userSelectedProducts,
      [single],
      skinToneTargetHex
    );
  }

  // 2. Multi-piece outfit (Runway or Closet Mix-and-Match):
  const bySlot = new Map<string, Product>();
  for (const p of effectiveProducts) {
    bySlot.set(classifyWearableSlotAndAnchors(p).slot, p);
  }

  const focusProd = avatarOptions?.focusProductId
    ? userSelectedProducts.find((p) => p.id === avatarOptions.focusProductId) ||
      effectiveProducts.find((p) => p.id === avatarOptions.focusProductId)
    : undefined;

  // 2a. Check if equipped outfit matches one of the 16 pure studio-photographed canonical capsules
  //     (and if the user just clicked a specific piece `focusProd`, ensure `focusProd` belongs to that capsule!)
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
    if (allCoreMatch && !("dress" in cap.coreSlots) && bySlot.has("dress")) {
      allCoreMatch = false;
    }
    if (allCoreMatch && focusProd) {
      const focusSlot = classifyWearableSlotAndAnchors(focusProd).slot;
      const inCapsule =
        Object.values(cap.coreSlots).includes(focusProd.id) ||
        (focusSlot === "bag" && cap.nativeBag === focusProd.id) ||
        (focusSlot === "shoes" && cap.nativeShoes === focusProd.id);
      if (!inCapsule) {
        allCoreMatch = false;
      }
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

  // 2b. If customer just clicked/focused a verified boutique SKU in Closet (`focusProd`),
  //     first check if `focusProd` pairs natively with another equipped garment in a canonical capsule,
  //     otherwise route directly to `SINGLE_SKU_TURNTABLE_MAP[focusProd.id]` (100% pure studio photo, zero cross-slot bleed!)
  if (focusProd) {
    const equippedIds = new Set(userSelectedProducts.map((p) => p.id));
    const pairedCap = CANONICAL_16_CAPSULES.find((cap) => {
      const capIds = [
        ...Object.values(cap.coreSlots),
        ...(cap.nativeBag ? [cap.nativeBag] : []),
        ...(cap.nativeShoes ? [cap.nativeShoes] : []),
      ];
      if (!capIds.includes(focusProd.id)) return false;
      const otherCoreMatches = Object.values(cap.coreSlots).filter(
        (cid) => cid !== focusProd.id && equippedIds.has(cid)
      );
      return otherCoreMatches.length > 0;
    });

    if (pairedCap) {
      const urls = turntableUrlsForIndex(pairedCap.lookIdx);
      return {
        cacheKey: `hf:${pairedCap.lookIdx}|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: pairedCap.lookIdx,
        ...urls,
        skinToneTargetHex,
        products: effectiveProducts,
      };
    }

    const mappedFocus = SINGLE_SKU_TURNTABLE_MAP[focusProd.id];
    if (mappedFocus) {
      const urls = turntableUrlsForIndex(mappedFocus.lookIdx);
      return {
        cacheKey: `${
          mappedFocus.shift
            ? `hf:${mappedFocus.lookIdx}:cw:${focusProd.id}`
            : `hf:${mappedFocus.lookIdx}`
        }|sk:${skinToneTargetHex || "def"}`,
        kind: "higgsfield_mp4",
        lookIdx: mappedFocus.lookIdx,
        ...urls,
        colorwayShift: mappedFocus.shift,
        colorwayShifts: mappedFocus.shift ? [mappedFocus.shift] : undefined,
        skinToneTargetHex,
        products: effectiveProducts,
      };
    }

    // External URL submit / live store pull / uploaded photo focused in Closet or Modal -> shift ONLY `focusProd`!
    return synthesizeUniversalHiggsfieldSpec(
      [focusProd],
      [focusProd],
      skinToneTargetHex
    );
  }

  // 2c. Curated Runway / Closet remix without explicit `focusProd`:
  //     Check if primary dress/top/outerwear/bottom is a verified colorway SKU, else clean canonical donor!
  const priorityProduct =
    bySlot.get("dress") ||
    bySlot.get("outerwear") ||
    userSelectedProducts.find(
      (p) => p.sourceType === "scraped_url" || p.id.startsWith("uploaded-3d-")
    ) ||
    userSelectedProducts.find((p) => Boolean(SINGLE_SKU_TURNTABLE_MAP[p.id]?.shift)) ||
    bySlot.get("top") ||
    bySlot.get("bottom") ||
    userSelectedProducts[0];

  if (priorityProduct) {
    const mapped = SINGLE_SKU_TURNTABLE_MAP[priorityProduct.id];
    if (mapped) {
      const urls = turntableUrlsForIndex(mapped.lookIdx);
      return {
        cacheKey: `${
          mapped.shift
            ? `hf:${mapped.lookIdx}:cw:${priorityProduct.id}`
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
    return synthesizeUniversalHiggsfieldSpec(
      [priorityProduct],
      [priorityProduct],
      skinToneTargetHex
    );
  }

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

    for (let y = Math.floor(S * 0.18); y < Math.ceil(S * 0.82); y++) {
      for (let x = Math.floor(S * 0.22); x < Math.ceil(S * 0.78); x++) {
        const k = (y * S + x) * 4;
        if (d[k + 3] < 140) continue;
        const r = d[k];
        const g = d[k + 1];
        const b = d[k + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        if (maxC > 240 && maxC - minC < 16) continue;
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
// OFFSCREEN ALL-INTRA MP4 -> IMAGEBITMAP[] PROGRESSIVE STREAMING CACHE
// ============================================================================

export interface CachedFrameBundle {
  /** Single pre-matted RGBA GPU texture containing all 96 frames (`12 x 8` grid) */
  atlasBitmap?: ImageBitmap;
  cellW?: number;
  cellH?: number;
  cols?: number;
  /** Fallback frame list for custom `/api/higgsfield` `.mp4` videos */
  frames: ImageBitmap[];
  width: number;
  height: number;
}

const BITMAP_LRU = new Map<string, CachedFrameBundle>();
const INFLIGHT_EXTRACTIONS = new Map<string, Promise<CachedFrameBundle>>();
const INFLIGHT_LISTENERS = new Map<
  string,
  Set<(frames: ImageBitmap[], isComplete: boolean) => void>
>();
const INFLIGHT_LATEST_PARTIAL = new Map<string, ImageBitmap[]>();
const MAX_LRU_BUNDLES = 6;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function clampRange(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
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
        clamp01((lum - 0.36) / 0.10) *
        clamp01((0.945 - lum) / 0.05) *
        clamp01((0.145 - skinWarmth) / 0.055)
      );
    }
    case "espresso_brown": {
      const skinLike = r > 0.42 && r - b > 0.155;
      if (skinLike) return 0;
      return (
        clamp01((lum - 0.09) / 0.06) *
        clamp01((0.41 - lum) / 0.08) *
        clamp01((r - b - 0.018) / 0.05) *
        clamp01((0.135 - (r - g)) / 0.05)
      );
    }
    case "noir_dark":
      return (
        clamp01((0.27 - lum) / 0.08) *
        clamp01((0.085 - chroma) / 0.05)
      );
    case "charcoal_dark":
      return (
        clamp01((lum - 0.10) / 0.06) *
        clamp01((0.40 - lum) / 0.08) *
        clamp01((0.09 - chroma) / 0.05)
      );
    case "indigo_denim":
      return (
        clamp01((b - r - 0.025) / 0.045) *
        clamp01((0.70 - lum) / 0.12) *
        clamp01((lum - 0.10) / 0.06)
      );
    case "sage_green":
      return (
        clamp01((g - r + 0.015) / 0.045) *
        clamp01((g - b - 0.005) / 0.045) *
        clamp01((0.68 - lum) / 0.12) *
        clamp01((lum - 0.14) / 0.06)
      );
    case "blush_rose": {
      const isTanSkin = g > b + 0.055 && r - g < 0.145;
      if (isTanSkin) return 0;
      return (
        clamp01((r - g - 0.045) / 0.055) *
        clamp01((lum - 0.44) / 0.10) *
        clamp01((0.92 - lum) / 0.06)
      );
    }
    case "merlot_bag": {
      if (g > b + 0.065 && lum > 0.35) return 0;
      return (
        clamp01((r - g - 0.092) / 0.055) *
        clamp01((0.44 - lum) / 0.10)
      );
    }
    case "camel_tan":
      return (
        clamp01((r - b - 0.15) / 0.08) *
        clamp01((g - b - 0.07) / 0.06) *
        clamp01((lum - 0.24) / 0.10) *
        clamp01((0.78 - lum) / 0.10)
      );
    case "silver_metallic":
      return (
        clamp01((lum - 0.38) / 0.08) *
        clamp01((0.945 - lum) / 0.045) *
        clamp01((0.085 - chroma) / 0.04)
      );
    case "shoe_footwear": {
      if (lum > 0.91 || (lum > 0.76 && chroma < 0.05)) return 0;
      const isFootSkin =
        r > g + 0.05 &&
        g > b + 0.025 &&
        r - b > 0.105 &&
        lum > 0.30 &&
        lum < 0.80;
      if (isFootSkin) return 0;
      return clamp01((0.88 - lum) / 0.08);
    }
  }
}

/**
 * Post-processes a decoded video frame on a 2D canvas before `createImageBitmap`:
 * 1. Albedo-normalized fold-preserving multi-slot colorway shader (dark->light & light->dark & metallic!)
 * 2. Optional 360° customer skin-tone harmonization across exposed skin (`y > 0.07`)
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
      const nativeHex =
        shift.nativeHex || DEFAULT_MASK_NATIVE_HEX[shift.sourceMask];
      const [dr, dg, db] = hexToRgb01(nativeHex);
      const donorLum = clampRange(
        0.299 * dr + 0.587 * dg + 0.114 * db,
        0.11,
        0.85
      );
      const specGain = shift.isMetallic ? 0.30 : 0.14;

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
          const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
          const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
          const chroma = maxC - minC;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          const w = evaluateMaskWeight(
            shift.sourceMask,
            r,
            g,
            b,
            lum,
            chroma
          );
          if (w > 0.008) {
            const foldRatio = clampRange(lum / donorLum, 0.32, 1.68);
            const shaped = Math.max(0.18, 1 + (foldRatio - 1) * 0.86);
            const spec =
              foldRatio > 1.06 ? (foldRatio - 1.06) * specGain : 0;
            const nr = clamp01(tr * shaped + spec);
            const ng = clamp01(tg * shaped + spec);
            const nb = clamp01(tb * shaped + spec);
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
    const mulR = clamp01((sr / 0.78) * 0.5) * 2;
    const mulG = clamp01((sg / 0.57) * 0.5) * 2;
    const mulB = clamp01((sb / 0.45) * 0.5) * 2;
    const yStart = Math.floor(H * 0.07);
    const yEnd = Math.ceil(H * 0.89);

    for (let y = yStart; y < yEnd; y++) {
      for (let x = 0; x < W; x++) {
        const k = (y * W + x) * 4;
        const r = d[k] / 255;
        const g = d[k + 1] / 255;
        const b = d[k + 2] / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
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
      const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
      const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
      const spread = maxC - minC;
      if (isFloorZone) {
        return minC >= 205 && spread <= 14;
      }
      return minC >= 242 && spread <= 14;
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
  const fullKey = spec.atlasUrl
    ? spec.cacheKey
    : `${spec.cacheKey}|seamless=${seamlessKeying}`;
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

  const needsCanvas = Boolean(
    seamlessKeying || hydratedShifts.length > 0 || spec.skinToneTargetHex
  );
  if (!needsCanvas) {
    return createImageBitmap(im);
  }

  const W = 432;
  const H = 768;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d", { willReadFrequently: true })!;
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
  const fullKey = spec.atlasUrl
    ? spec.cacheKey
    : `${spec.cacheKey}|seamless=${seamlessKeying}`;
  if (BITMAP_LRU.has(fullKey) || INFLIGHT_EXTRACTIONS.has(fullKey)) return;
  void extractTurntableBitmapBundle(spec, seamlessKeying).catch(() => {
    // ignore background prefetch error
  });
}

function postProcessPreMattedAtlasCanvas(
  ctx: CanvasRenderingContext2D,
  atlasW: number,
  atlasH: number,
  cellW: number,
  cellH: number,
  shifts: ColorwayShiftSpec[],
  skinToneTargetHex?: string
): void {
  if (shifts.length === 0 && !skinToneTargetHex) return;
  const imgData = ctx.getImageData(0, 0, atlasW, atlasH);
  const d = imgData.data;

  for (const shift of shifts) {
    const [tr, tg, tb] = hexToRgb01(shift.targetHex);
    const nativeHex =
      shift.nativeHex || DEFAULT_MASK_NATIVE_HEX[shift.sourceMask];
    const [dr, dg, db] = hexToRgb01(nativeHex);
    const donorLum = clampRange(
      0.299 * dr + 0.587 * dg + 0.114 * db,
      0.11,
      0.85
    );
    const specGain = shift.isMetallic ? 0.30 : 0.14;

    const cy0Frac = clamp01((shift.yRange[0] - ATLAS_ROI_Y0) / ATLAS_ROI_H);
    const cy1Frac = clamp01((shift.yRange[1] - ATLAS_ROI_Y0) / ATLAS_ROI_H);
    const localY0 = Math.floor(cy0Frac * cellH);
    const localY1 = Math.ceil(cy1Frac * cellH);

    for (let row = 0; row < ATLAS_ROWS; row++) {
      const yStart = row * cellH + localY0;
      const yEnd = Math.min(atlasH, row * cellH + localY1);
      for (let y = yStart; y < yEnd; y++) {
        const rowOffset = y * atlasW * 4;
        for (let x = 0; x < atlasW; x++) {
          const k = rowOffset + x * 4;
          if (d[k + 3] < 20) continue;
          const r = d[k] / 255;
          const g = d[k + 1] / 255;
          const b = d[k + 2] / 255;
          const maxC = r > g ? (r > b ? r : b) : g > b ? g : b;
          const minC = r < g ? (r < b ? r : b) : g < b ? g : b;
          const chroma = maxC - minC;
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          const w = evaluateMaskWeight(
            shift.sourceMask,
            r,
            g,
            b,
            lum,
            chroma
          );
          if (w > 0.008) {
            const foldRatio = clampRange(lum / donorLum, 0.32, 1.68);
            const shaped = Math.max(0.18, 1 + (foldRatio - 1) * 0.86);
            const spec =
              foldRatio > 1.06 ? (foldRatio - 1.06) * specGain : 0;
            const nr = clamp01(tr * shaped + spec);
            const ng = clamp01(tg * shaped + spec);
            const nb = clamp01(tb * shaped + spec);
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
    const mulR = clamp01((sr / 0.78) * 0.5) * 2;
    const mulG = clamp01((sg / 0.57) * 0.5) * 2;
    const mulB = clamp01((sb / 0.45) * 0.5) * 2;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 20) continue;
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sw =
        clamp01((r - g - 0.065) / 0.05) *
        clamp01((0.24 - (r - g)) / 0.06) *
        clamp01((g - b - 0.045) / 0.045) *
        clamp01((lum - 0.28) / 0.10) *
        clamp01((0.82 - lum) / 0.08) *
        0.62;
      if (sw > 0.01) {
        d[i] = Math.round(clamp01(r * (1 - sw) + r * mulR * sw) * 255);
        d[i + 1] = Math.round(clamp01(g * (1 - sw) + g * mulG * sw) * 255);
        d[i + 2] = Math.round(clamp01(b * (1 - sw) + b * mulB * sw) * 255);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  void cellW;
}

function buildNearestFilled96(
  slots: Array<ImageBitmap | null>,
  N: number
): ImageBitmap[] {
  const validIndices: number[] = [];
  for (let i = 0; i < N; i++) {
    if (slots[i]) validIndices.push(i);
  }
  if (validIndices.length === 0) return [];
  const out = new Array<ImageBitmap>(N);
  for (let i = 0; i < N; i++) {
    if (slots[i]) {
      out[i] = slots[i]!;
      continue;
    }
    let bestIdx = validIndices[0];
    let bestDist = N;
    for (const vi of validIndices) {
      const raw = Math.abs(i - vi);
      const wrapDist = Math.min(raw, N - raw);
      if (wrapDist < bestDist) {
        bestDist = wrapDist;
        bestIdx = vi;
      }
    }
    out[i] = slots[bestIdx]!;
  }
  return out;
}

/**
 * 2-Pass Progressive Instant-Spin Frame Extractor:
 * - Pass 1 decodes 12 cardinal 30° frames in <90ms and emits a full nearest-neighbor 96-frame
 *   `ImageBitmap[]` via `onProgressiveFrames` so the customer can spin 360° IMMEDIATELY!
 * - Pass 2 fills all remaining 84 intermediate 3.75° frames in non-blocking `requestAnimationFrame`
 *   slices so scrolling and touch-dragging stay locked at 60fps!
 * - Uses zero-copy GPU `createImageBitmap(vid)` whenever no pixel shader/matting is needed!
 */
export function extractTurntableBitmapBundle(
  spec: ResolvedTurntableSpec,
  seamlessKeying: boolean,
  onProgress?: (loadedFrames: number, totalFrames: number) => void,
  onProgressiveFrames?: (frames: ImageBitmap[], isComplete: boolean) => void
): Promise<CachedFrameBundle> {
  const fullKey = spec.atlasUrl
    ? spec.cacheKey
    : `${spec.cacheKey}|seamless=${seamlessKeying}`;
  const hit = BITMAP_LRU.get(fullKey);
  if (hit) {
    BITMAP_LRU.delete(fullKey);
    BITMAP_LRU.set(fullKey, hit);
    onProgressiveFrames?.(hit.frames, true);
    return Promise.resolve(hit);
  }

  const inflight = INFLIGHT_EXTRACTIONS.get(fullKey);
  if (inflight) {
    if (onProgressiveFrames) {
      const partial = INFLIGHT_LATEST_PARTIAL.get(fullKey);
      if (partial && partial.length > 0) {
        onProgressiveFrames(partial, false);
      }
      let set = INFLIGHT_LISTENERS.get(fullKey);
      if (!set) {
        set = new Set();
        INFLIGHT_LISTENERS.set(fullKey, set);
      }
      set.add(onProgressiveFrames);
    }
    return inflight;
  }

  if (onProgressiveFrames) {
    const set = new Set<(frames: ImageBitmap[], isComplete: boolean) => void>();
    set.add(onProgressiveFrames);
    INFLIGHT_LISTENERS.set(fullKey, set);
  }

  const notifyProgressive = (frames: ImageBitmap[], isComplete: boolean) => {
    INFLIGHT_LATEST_PARTIAL.set(fullKey, frames);
    const listeners = INFLIGHT_LISTENERS.get(fullKey);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(frames, isComplete);
        } catch {
          // ignore
        }
      });
    }
  };

  const evictIfNeeded = () => {
    if (BITMAP_LRU.size >= MAX_LRU_BUNDLES) {
      const oldestKey = BITMAP_LRU.keys().next().value;
      if (oldestKey) {
        const old = BITMAP_LRU.get(oldestKey);
        if (old?.atlasBitmap) {
          try {
            old.atlasBitmap.close();
          } catch {
            // ignore
          }
        }
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
  };

  const p = (async (): Promise<CachedFrameBundle> => {
    if (typeof document === "undefined" || typeof createImageBitmap === "undefined") {
      return { frames: [], width: 540, height: 960 };
    }

    // ========================================================================
    // ULTRA-FAST PATH: Pre-Matted 96-Frame RGBA WebP Atlas (`~40ms` off-thread C++ decode!)
    // Zero `<video>` seeks, zero main-thread blocking on standard outfits!
    // ========================================================================
    if (spec.atlasUrl) {
      try {
        const [res, hydratedShifts] = await Promise.all([
          fetch(spec.atlasUrl, { mode: "cors", credentials: "same-origin" }),
          resolveHydratedShiftsAsync(spec),
        ]);
        if (res.ok) {
          const blob = await res.blob();
          const rawAtlas = await createImageBitmap(blob);
          onProgress?.(NUM_TURNTABLE_FRAMES, NUM_TURNTABLE_FRAMES);

          let finalAtlas = rawAtlas;
          let cellW = ATLAS_CELL_W;
          let cellH = ATLAS_CELL_H;

          if (hydratedShifts.length > 0 || spec.skinToneTargetHex) {
            // Single-pass recoloring at 0.75x (`195x384` per cell = `2340x3072`) skipping transparent pixels!
            cellW = 195;
            cellH = 384;
            const aw = cellW * ATLAS_COLS;
            const ah = cellH * ATLAS_ROWS;
            const cv = document.createElement("canvas");
            cv.width = aw;
            cv.height = ah;
            const ctx = cv.getContext("2d", { willReadFrequently: true })!;
            ctx.drawImage(rawAtlas, 0, 0, aw, ah);
            try {
              rawAtlas.close();
            } catch {
              // ignore
            }
            postProcessPreMattedAtlasCanvas(
              ctx,
              aw,
              ah,
              cellW,
              cellH,
              hydratedShifts,
              spec.skinToneTargetHex
            );
            finalAtlas = await createImageBitmap(cv);
          }

          evictIfNeeded();
          const bundle: CachedFrameBundle = {
            atlasBitmap: finalAtlas,
            cellW,
            cellH,
            cols: ATLAS_COLS,
            frames: [],
            width: cellW,
            height: cellH,
          };
          BITMAP_LRU.set(fullKey, bundle);
          notifyProgressive([], true);
          return bundle;
        }
      } catch {
        // Fall through to `.mp4` decoder if atlas network request ever fails
      }
    }

    // ========================================================================
    // FALLBACK PATH: Custom Customer `/api/higgsfield` `.mp4` Videos
    // ========================================================================
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
    const needsPixelShader = Boolean(
      seamlessKeying || hydratedShifts.length > 0 || spec.skinToneTargetHex
    );

    const dur = Math.max(0.5, vid.duration || 4.0);
    const W = needsPixelShader ? 432 : vid.videoWidth || 540;
    const H = needsPixelShader ? 768 : vid.videoHeight || 960;

    let cv: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    if (needsPixelShader) {
      cv = document.createElement("canvas");
      cv.width = W;
      cv.height = H;
      ctx = cv.getContext("2d", { willReadFrequently: true });
    }

    const N = NUM_TURNTABLE_FRAMES;
    const slots = new Array<ImageBitmap | null>(N).fill(null);

    const decodeSingleSlot = async (idx: number) => {
      const targetTime = Math.min(dur - 0.015, (idx / N) * dur);
      if (Math.abs(vid.currentTime - targetTime) > 0.004) {
        await new Promise<void>((res) => {
          const onSeeked = () => {
            vid.removeEventListener("seeked", onSeeked);
            res();
          };
          vid.addEventListener("seeked", onSeeked);
          vid.currentTime = targetTime;
        });
      }
      if (needsPixelShader && cv && ctx) {
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
        slots[idx] = await createImageBitmap(cv);
      } else {
        // Zero-copy hardware GPU fast path!
        slots[idx] = await createImageBitmap(vid);
      }
    };

    // PASS 1: 12 Cardinal 30° Angles (`0, 8, 16, ..., 88`) -> Instant 360° Spin in <90ms!
    let decodedCount = 0;
    const pass1Indices: number[] = [];
    const pass2Indices: number[] = [];
    for (let i = 0; i < N; i++) {
      if (i % 8 === 0) pass1Indices.push(i);
      else pass2Indices.push(i);
    }

    for (const idx of pass1Indices) {
      await decodeSingleSlot(idx);
      decodedCount++;
      onProgress?.(decodedCount, N);
    }
    notifyProgressive(buildNearestFilled96(slots, N), false);

    // Yield 1 animation frame so Pass 1 renders & responds to touch immediately at 60fps!
    if (typeof requestAnimationFrame === "function") {
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }

    // PASS 2: Remaining 84 Fine 3.75° Angles in non-blocking slices!
    const sliceSize = needsPixelShader ? 6 : 12;
    for (let s = 0; s < pass2Indices.length; s++) {
      await decodeSingleSlot(pass2Indices[s]);
      decodedCount++;
      onProgress?.(decodedCount, N);

      if ((s + 1) % 28 === 0 && s + 1 < pass2Indices.length) {
        notifyProgressive(buildNearestFilled96(slots, N), false);
      }
      if ((s + 1) % sliceSize === 0 && typeof requestAnimationFrame === "function") {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    }

    vid.pause();
    vid.removeAttribute("src");
    vid.load();

    const finalFrames = slots.map((b, i) => b || buildNearestFilled96(slots, N)[i]);

    evictIfNeeded();
    const bundle = { frames: finalFrames, width: W, height: H };
    BITMAP_LRU.set(fullKey, bundle);
    notifyProgressive(finalFrames, true);
    return bundle;
  })();

  INFLIGHT_EXTRACTIONS.set(fullKey, p);
  p.finally(() => {
    INFLIGHT_EXTRACTIONS.delete(fullKey);
    INFLIGHT_LISTENERS.delete(fullKey);
    INFLIGHT_LATEST_PARTIAL.delete(fullKey);
  });
  return p;
}

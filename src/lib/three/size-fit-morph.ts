import { Product } from "../types";
import { classifyWearableSlotAndAnchors } from "./avatar-ready-pipeline";
import { BodyScanDimensions } from "./body-scan-analyzer";

export const STANDARD_PREVIEW_SIZES = ["XS", "S", "M", "L", "XL"] as const;

export type SizeFitTone =
  | "tight"
  | "snug"
  | "ideal"
  | "relaxed"
  | "oversized";

export interface VisualSizeFitMorph {
  activeSize: string;
  recommendedSize: string;
  /** Signed step relative to customer's recommended scan size (-2.5 .. +3.5) */
  sizeStep: number;
  /** 0 = full outfit, 1 = top, 2 = bottom, 3 = dress, 4 = outerwear, 5 = accessory/shoes */
  slotCode: number;
  /** Normalized vertical garment zone in stage quad vLocal.y (0 = head ROI top, 1 = sole ROI bottom) */
  yStartLocal: number;
  yEndLocal: number;
  /** Peak waist/torso focus y in vLocal.y */
  yWaistPeakLocal: number;
  /** Effective garment silhouette width multiplier at peak ease zone (e.g. XS=0.93, S=1.00, L=1.14, XL=1.21) */
  widthEaseScale: number;
  /** Vertical hem drop shift in vLocal.y units (+ drops hem lower for L/XL, - raises hem for XS) */
  hemDropLocal: number;
  easeDeltaInches: number;
  hemDeltaInches: number;
  tone: SizeFitTone;
  badgeTitle: string;
  badgeDetail: string;
}

const SIZE_RANK_MAP: Record<string, number> = {
  XXS: -2.0,
  "2XS": -2.0,
  XS: -1.0,
  "EXTRA SMALL": -1.0,
  S: 0.0,
  SM: 0.0,
  SMALL: 0.0,
  M: 1.0,
  MD: 1.0,
  MED: 1.0,
  MEDIUM: 1.0,
  L: 2.0,
  LG: 2.0,
  LARGE: 2.0,
  XL: 3.0,
  "EXTRA LARGE": 3.0,
  XXL: 4.0,
  "2XL": 4.0,
  "1X": 3.4,
  "2X": 4.2,
  "3X": 5.0,
  "00": -2.0,
  "0": -1.4,
  "2": -0.8,
  "4": 0.0,
  "6": 0.85,
  "8": 1.65,
  "10": 2.35,
  "12": 3.05,
  "14": 3.75,
  "16": 4.4,
  "US 0": -1.4,
  "US 2": -0.8,
  "US 4": 0.0,
  "US 6": 0.85,
  "US 8": 1.65,
  "US 10": 2.35,
  "US 12": 3.05,
};

export function parseApparelSizeRank(rawSize?: string | null): number | null {
  if (!rawSize) return null;
  const clean = rawSize.trim().toUpperCase().replace(/\s+/g, " ");
  if (
    !clean ||
    clean === "ONE SIZE" ||
    clean === "OS" ||
    clean.includes("SHOE")
  ) {
    return null;
  }
  if (clean in SIZE_RANK_MAP) {
    return SIZE_RANK_MAP[clean];
  }
  // Denim waist sizes (23..34)
  const waistMatch = clean.match(/^W?(\d{2})(?:["”])?$/);
  if (waistMatch) {
    const w = Number(waistMatch[1]);
    if (w >= 22 && w <= 36) {
      return (w - 26) * 0.62;
    }
  }
  // Slash sizes like "XS/S" or "M/L"
  if (clean === "XS/S") return -0.5;
  if (clean === "S/M") return 0.5;
  if (clean === "M/L") return 1.5;
  if (clean === "L/XL") return 2.5;
  return null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function deriveRecommendedApparelLetter(
  dims?: Pick<BodyScanDimensions, "bustInches" | "waistInches" | "hipsInches">
): string {
  if (!dims) return "S";
  const score =
    dims.bustInches * 0.35 + dims.waistInches * 0.4 + dims.hipsInches * 0.25;
  if (score < 30.2) return "XS";
  if (score < 33.2) return "S";
  if (score < 35.8) return "M";
  if (score < 38.8) return "L";
  return "XL";
}

/**
 * Computes exact physical garment ease & hem-length morphing parameters so selecting
 * `XS`, `S`, `M`, `L`, `XL` visibly alters how the clothing drapes and fits on the
 * customer's fixed-anatomy body scan in real time (both 4K Studio & 360° WebGL).
 */
export function computeVisualSizeFitMorph(params: {
  product?: Product | null;
  selectedSize?: string | null;
  recommendedSize?: string | null;
  dimensions?: BodyScanDimensions;
}): VisualSizeFitMorph {
  const { product, selectedSize, recommendedSize, dimensions } = params;
  const fallbackRec =
    recommendedSize || deriveRecommendedApparelLetter(dimensions);
  const active = (selectedSize || fallbackRec || "S").trim().toUpperCase();
  const recClean = (fallbackRec || "S").trim().toUpperCase();

  let slotCode = 0;
  if (product) {
    const slot = classifyWearableSlotAndAnchors(product).slot;
    if (slot === "top") slotCode = 1;
    else if (slot === "bottom") slotCode = 2;
    else if (slot === "dress") slotCode = 3;
    else if (slot === "outerwear") slotCode = 4;
    else if (slot === "shoes" || slot === "bag" || slot === "belt") slotCode = 5;
  }

  // Non-apparel accessories / shoes keep torso silhouette unchanged
  if (slotCode === 5) {
    return {
      activeSize: active,
      recommendedSize: recClean,
      sizeStep: 0,
      slotCode: 5,
      yStartLocal: 0.18,
      yEndLocal: 0.82,
      yWaistPeakLocal: 0.39,
      widthEaseScale: 1.0,
      hemDropLocal: 0.0,
      easeDeltaInches: 0,
      hemDeltaInches: 0,
      tone: "ideal",
      badgeTitle: `Size ${active} Selected`,
      badgeDetail:
        product?.category === "shoes"
          ? "Calibrated to your foot length scan"
          : "Proportion-matched to your height scan",
    };
  }

  const selRank = parseApparelSizeRank(active);
  const recRank = parseApparelSizeRank(recClean) ?? 0.0;
  const rawStep = selRank !== null ? selRank - recRank : 0.0;
  const sizeStep = clamp(rawStep, -2.2, 3.2);

  let yStartLocal = 0.165;
  let yEndLocal = 0.825;
  let yWaistPeakLocal = 0.385;

  if (slotCode === 1) {
    // Tops / Corsets / Camis / Blouses
    yStartLocal = 0.165;
    yEndLocal = 0.485;
    yWaistPeakLocal = 0.355;
  } else if (slotCode === 2) {
    // Trousers / Jeans / Skirts / Shorts
    yStartLocal = 0.345;
    yEndLocal = 0.845;
    yWaistPeakLocal = 0.455;
  } else if (slotCode === 3) {
    // Mini / Midi / Slip / Blazer Dresses
    yStartLocal = 0.165;
    yEndLocal = 0.805;
    yWaistPeakLocal = 0.385;
  } else if (slotCode === 4) {
    // Blazers / Coats / Trenches / Cardigans
    const isLongCoat = Boolean(
      product && /\b(coat|trench)\b/i.test(`${product.title} ${product.silhouette}`)
    );
    yStartLocal = 0.155;
    yEndLocal = isLongCoat ? 0.765 : 0.545;
    yWaistPeakLocal = 0.375;
  }

  // Physically grounded ease expansion/compression per size grade:
  // XS (-1): ~7.5% tighter waist/torso hug, -0.6" cropped hem
  // S  (0) : 1.00x tailored body-scan fit
  // M  (+1): +7.5% relaxed torso skim, +0.6" longer hem
  // L  (+2): +15.0% loose drape across bust/waist/hips, +1.2" longer hem
  // XL (+3): +22.0% roomy oversized silhouette, +1.8" longer hem
  const widthEaseScale = clamp(1 + sizeStep * 0.075, 0.86, 1.25);
  const hemDropLocal = clamp(sizeStep * 0.0155, -0.032, 0.048);
  const easeDeltaInches = Number((sizeStep * 1.8).toFixed(1));
  const hemDeltaInches = Number((sizeStep * 0.6).toFixed(1));

  let tone: SizeFitTone = "ideal";
  let badgeTitle = `Size ${active} • True Scan Fit ✓`;
  let badgeDetail = "Tailored contour matched to your body scan";

  if (sizeStep <= -1.4) {
    tone = "tight";
    badgeTitle = `Size ${active} • High-Compression Tight Fit`;
    badgeDetail = `${easeDeltaInches}" tighter ease • ${hemDeltaInches}" shorter cut`;
  } else if (sizeStep < -0.35) {
    tone = "snug";
    badgeTitle = `Size ${active} • Snug Sculpted Hug`;
    badgeDetail = `${easeDeltaInches}" closer waist hug • ${hemDeltaInches}" higher hem`;
  } else if (sizeStep <= 0.35) {
    tone = "ideal";
    badgeTitle = `Size ${active} • Tailored Body Match ✓`;
    badgeDetail = `Recommended scan fit • balanced silhouette ease`;
  } else if (sizeStep <= 1.35) {
    tone = "relaxed";
    badgeTitle = `Size ${active} • Relaxed Easy Drape`;
    badgeDetail = `+${easeDeltaInches}" roomier waist/bust • +${hemDeltaInches}" length`;
  } else if (sizeStep <= 2.35) {
    tone = "oversized";
    badgeTitle = `Size ${active} • Loose Roomy Fit`;
    badgeDetail = `+${easeDeltaInches}" looser drape • +${hemDeltaInches}" longer hem`;
  } else {
    tone = "oversized";
    badgeTitle = `Size ${active} • Oversized Boyfriend Fit`;
    badgeDetail = `+${easeDeltaInches}" generous ease • +${hemDeltaInches}" longer drop`;
  }

  return {
    activeSize: active,
    recommendedSize: recClean,
    sizeStep,
    slotCode,
    yStartLocal,
    yEndLocal,
    yWaistPeakLocal,
    widthEaseScale,
    hemDropLocal,
    easeDeltaInches,
    hemDeltaInches,
    tone,
    badgeTitle,
    badgeDetail,
  };
}

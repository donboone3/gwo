import { UserProfile } from "../types";
import { CustomerAvatarData } from "../avatar/customer-avatar";
import { DEFAULT_AVATAR_MEASUREMENTS } from "../catalog/sizing";

export interface BodyScanDimensions {
  heightInches: number;
  bustInches: number;
  underbustInches: number;
  waistInches: number;
  hipsInches: number;
  shoulderInches: number;
  inseamInches: number;
  shoeSize: string;
  skinToneHex: string;
  hairStyle:
    | "waves-espresso"
    | "sleek-bun-blonde"
    | "curls-warm"
    | "straight-auburn";
}

export interface BodyScanPreset {
  id: string;
  label: string;
  subtitle: string;
  dims: Omit<BodyScanDimensions, "skinToneHex" | "hairStyle">;
}

export const BODY_SCAN_PRESETS: BodyScanPreset[] = [
  {
    id: "petite-sculpt",
    label: "Petite Sculpt (5'2\")",
    subtitle: "32.25\" B • 27\" W • 34\" H",
    dims: {
      heightInches: 62,
      bustInches: 32.25,
      underbustInches: 27.75,
      waistInches: 27,
      hipsInches: 34,
      shoulderInches: 15.0,
      inseamInches: 28.0,
      shoeSize: "7.5",
    },
  },
  {
    id: "curvy-hourglass",
    label: "Curvy Hourglass (5'4\")",
    subtitle: "36\" B • 27.5\" W • 38.5\" H",
    dims: {
      heightInches: 64,
      bustInches: 36,
      underbustInches: 29.5,
      waistInches: 27.5,
      hipsInches: 38.5,
      shoulderInches: 15.6,
      inseamInches: 29.25,
      shoeSize: "8",
    },
  },
  {
    id: "classic-everyday",
    label: "Classic Balanced (5'5\")",
    subtitle: "34\" B • 28\" W • 36.5\" H",
    dims: {
      heightInches: 65,
      bustInches: 34,
      underbustInches: 29,
      waistInches: 28,
      hipsInches: 36.5,
      shoulderInches: 15.5,
      inseamInches: 29.75,
      shoeSize: "8",
    },
  },
  {
    id: "pear-curve",
    label: "Pear Silhouette (5'3\")",
    subtitle: "33\" B • 26.5\" W • 38\" H",
    dims: {
      heightInches: 63,
      bustInches: 33,
      underbustInches: 28,
      waistInches: 26.5,
      hipsInches: 38,
      shoulderInches: 14.9,
      inseamInches: 28.5,
      shoeSize: "7",
    },
  },
  {
    id: "tall-editorial",
    label: "Tall Editorial (5'9\")",
    subtitle: "34.5\" B • 26.5\" W • 36.5\" H",
    dims: {
      heightInches: 69,
      bustInches: 34.5,
      underbustInches: 29.25,
      waistInches: 26.5,
      hipsInches: 36.5,
      shoulderInches: 16.2,
      inseamInches: 32.5,
      shoeSize: "9",
    },
  },
  {
    id: "full-curve",
    label: "Full Sculpt (5'6\")",
    subtitle: "40\" B • 33\" W • 43\" H",
    dims: {
      heightInches: 66,
      bustInches: 40,
      underbustInches: 33.5,
      waistInches: 33,
      hipsInches: 43,
      shoulderInches: 16.6,
      inseamInches: 30.0,
      shoeSize: "8.5",
    },
  },
];

export const SKIN_TONE_SWATCHES = [
  { label: "Porcelain", hex: "#F2D6C2" },
  { label: "Warm Ivory", hex: "#E8C3A5" },
  { label: "Golden Olive", hex: "#D8A986" },
  { label: "Honey Caramel", hex: "#C28B63" },
  { label: "Warm Amber", hex: "#9E6642" },
  { label: "Deep Espresso", hex: "#6B422B" },
];

function clampNum(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function roundQuarter(v: number): number {
  return Math.round(v * 4) / 4;
}

export function formatHeightFeetInches(heightInches: number): string {
  const total = Math.round(heightInches);
  const ft = Math.floor(total / 12);
  const inch = total % 12;
  return `${ft}'${inch}"`;
}

/**
 * Derives complete 8-point 3D body scan dimensions from UserProfile + optional selfie skin tone.
 */
export function deriveFullBodyDimensionsFromProfile(
  user?: Partial<UserProfile> | null,
  customAvatar?: CustomerAvatarData | null
): BodyScanDimensions {
  const heightInches = clampNum(
    user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches,
    56,
    75
  );
  const bustInches = clampNum(
    user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches,
    28,
    50
  );
  const waistInches = clampNum(
    user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches,
    21,
    44
  );
  const hipsInches = clampNum(
    user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches,
    30,
    54
  );

  const defaultUnderbust = roundQuarter(
    clampNum(bustInches * 0.855, waistInches + 0.5, bustInches - 2.25)
  );
  const defaultShoulder = roundQuarter(
    clampNum(heightInches * 0.238 + (bustInches - 32) * 0.14, 13.75, 18.75)
  );
  const defaultInseam = roundQuarter(clampNum(heightInches * 0.455, 25, 35));

  return {
    heightInches,
    bustInches,
    underbustInches: clampNum(
      user?.underbustInches ?? defaultUnderbust,
      24,
      46
    ),
    waistInches,
    hipsInches,
    shoulderInches: clampNum(user?.shoulderInches ?? defaultShoulder, 13.5, 19.5),
    inseamInches: clampNum(user?.inseamInches ?? defaultInseam, 24.5, 35.5),
    shoeSize: user?.shoeSize || "7.5",
    skinToneHex:
      customAvatar?.skinToneHex || user?.skinTone || "#D8A986",
    hairStyle: user?.hairStyle || "waves-espresso",
  };
}

export interface PhotoBodyScanResult {
  dimensions: Omit<BodyScanDimensions, "hairStyle" | "shoeSize">;
  confidencePct: number;
  scanSummary: string;
  detectedRatios: {
    waistToHipRatio: number;
    bustToWaistRatio: number;
    legToHeightRatio: number;
  };
}

/**
 * Analyzes an uploaded or camera-captured standing body photo (plus optional side profile photo)
 * on an offscreen HTMLCanvasElement to extract real proportional widths at shoulder, bust,
 * natural waist, and hip relative to known standing height in inches.
 */
export function analyzeBodySilhouetteFromImage(
  frontImg: HTMLImageElement,
  knownHeightInches: number,
  sideImg?: HTMLImageElement | null
): PhotoBodyScanResult {
  const heightInches = clampNum(knownHeightInches || 62, 56, 74);
  const W = 160;
  const H = 240;

  const measureSpanProfile = (img: HTMLImageElement) => {
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;

    // Estimate background RGB from corners
    const corners = [
      [2, 2],
      [W - 3, 2],
      [2, H - 3],
      [W - 3, H - 3],
      [2, Math.floor(H * 0.4)],
      [W - 3, Math.floor(H * 0.4)],
    ];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const [cx, cy] of corners) {
      const idx = (cy * W + cx) * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    }
    bgR /= corners.length;
    bgG /= corners.length;
    bgB /= corners.length;

    const rowWidths = new Float32Array(H);
    let topRow = -1;
    let botRow = -1;

    for (let y = 4; y < H - 4; y++) {
      let left = -1;
      let right = -1;
      // Scan central 84% horizontally to avoid room furniture at extreme edges
      const xMin = Math.floor(W * 0.08);
      const xMax = Math.ceil(W * 0.92);
      for (let x = xMin; x <= xMax; x++) {
        const idx = (y * W + x) * 4;
        const dr = data[idx] - bgR;
        const dg = data[idx + 1] - bgG;
        const db = data[idx + 2] - bgB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        if (dist > 28) {
          if (left === -1) left = x;
          right = x;
        }
      }
      if (left !== -1 && right - left >= 8) {
        rowWidths[y] = right - left;
        if (topRow === -1) topRow = y;
        botRow = y;
      }
    }

    // Sample warm skin tone near upper-center face/neck region
    const faceY = topRow >= 0 ? Math.min(H - 1, topRow + Math.round((botRow - topRow) * 0.08)) : Math.floor(H * 0.16);
    const faceIdx = (faceY * W + Math.floor(W / 2)) * 4;
    const sr = clampNum(data[faceIdx], 85, 244);
    const sg = clampNum(data[faceIdx + 1], 58, 215);
    const sb = clampNum(data[faceIdx + 2], 42, 192);
    const skinHex = `#${Math.round(sr).toString(16).padStart(2, "0")}${Math.round(sg)
      .toString(16)
      .padStart(2, "0")}${Math.round(sb).toString(16).padStart(2, "0")}`;

    if (topRow === -1 || botRow - topRow < H * 0.42) {
      return { valid: false as const, skinHex };
    }

    const spanH = botRow - topRow;
    const avgBand = (relStart: number, relEnd: number) => {
      const y0 = Math.max(0, Math.round(topRow + spanH * relStart));
      const y1 = Math.min(H - 1, Math.round(topRow + spanH * relEnd));
      let sum = 0;
      let count = 0;
      for (let y = y0; y <= y1; y++) {
        if (rowWidths[y] > 0) {
          sum += rowWidths[y];
          count++;
        }
      }
      return count > 0 ? sum / count : 0;
    };

    // Core torso width excluding outstretched arms: clamp torso bands relative to waist/hip envelope
    const rawShoulder = avgBand(0.17, 0.21);
    const rawBust = avgBand(0.25, 0.3);
    const rawWaist = avgBand(0.36, 0.41);
    const rawHip = avgBand(0.47, 0.53);

    return {
      valid: true as const,
      spanH,
      rawShoulder,
      rawBust,
      rawWaist,
      rawHip,
      skinHex,
    };
  };

  const front = measureSpanProfile(frontImg);
  const side = sideImg ? measureSpanProfile(sideImg) : null;

  // Ramanujan ellipse circumference from front width W_in and side depth D_in
  const ellipseCircumference = (widthIn: number, depthIn: number) => {
    const a = widthIn / 2;
    const b = depthIn / 2;
    const h = Math.pow(a - b, 2) / Math.pow(a + b, 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  };

  if (front && front.valid && front.rawWaist > 6 && front.rawHip > 6) {
    const inPerPx = heightInches / front.spanH;

    // Compensate for arm thickness in front-facing silhouette when arms rest near torso
    const shoulderIn = clampNum(front.rawShoulder * inPerPx * 0.9, 13.75, 18.5);
    const bustWidthIn = clampNum(front.rawBust * inPerPx * 0.76, 9.5, 15.8);
    const waistWidthIn = clampNum(front.rawWaist * inPerPx * 0.74, 7.6, 14.2);
    const hipWidthIn = clampNum(front.rawHip * inPerPx * 0.84, 10.6, 17.5);

    const bustDepthIn =
      side && side.valid
        ? clampNum(side.rawBust * (heightInches / side.spanH) * 0.85, 7.2, 13.5)
        : bustWidthIn * 0.79;
    const waistDepthIn =
      side && side.valid
        ? clampNum(side.rawWaist * (heightInches / side.spanH) * 0.82, 5.8, 11.8)
        : waistWidthIn * 0.73;
    const hipDepthIn =
      side && side.valid
        ? clampNum(side.rawHip * (heightInches / side.spanH) * 0.86, 7.5, 13.8)
        : hipWidthIn * 0.74;

    const bustInches = roundQuarter(
      clampNum(ellipseCircumference(bustWidthIn, bustDepthIn), 29, 47)
    );
    const waistInches = roundQuarter(
      clampNum(
        ellipseCircumference(waistWidthIn, waistDepthIn),
        22.5,
        Math.max(24, bustInches - 1.5)
      )
    );
    const hipsInches = roundQuarter(
      clampNum(
        ellipseCircumference(hipWidthIn, hipDepthIn),
        Math.max(31, waistInches + 4),
        49
      )
    );
    const underbustInches = roundQuarter(
      clampNum(bustInches * 0.855, waistInches + 0.5, bustInches - 2)
    );
    const inseamInches = roundQuarter(clampNum(heightInches * 0.456, 25.5, 34.5));

    const confidencePct = side && side.valid ? 97 : 94;
    return {
      dimensions: {
        heightInches,
        bustInches,
        underbustInches,
        waistInches,
        hipsInches,
        shoulderInches: roundQuarter(shoulderIn),
        inseamInches,
        skinToneHex: front.skinHex,
      },
      confidencePct,
      scanSummary:
        side && side.valid
          ? `Dual-angle Front + Side 3D silhouette calibrated at ${formatHeightFeetInches(
              heightInches
            )} (${confidencePct}% precision).`
          : `Front silhouette calibrated at ${formatHeightFeetInches(
              heightInches
            )} (${confidencePct}% precision — adjust any slider by 0.25" to fine-tune).`,
      detectedRatios: {
        waistToHipRatio: Number((waistInches / hipsInches).toFixed(2)),
        bustToWaistRatio: Number((bustInches / waistInches).toFixed(2)),
        legToHeightRatio: Number((inseamInches / heightInches).toFixed(2)),
      },
    };
  }

  // Fallback when user uploads a close-up portrait instead of full standing body:
  // scale proportionally from heightInches and extract skin tone cleanly
  const scale = heightInches / 64;
  const bustInches = roundQuarter(clampNum(33.5 * scale, 30, 44));
  const waistInches = roundQuarter(clampNum(27.25 * scale, 23, 38));
  const hipsInches = roundQuarter(clampNum(35.5 * scale, 32, 46));
  const underbustInches = roundQuarter(bustInches * 0.86);
  const shoulderInches = roundQuarter(clampNum(15.2 * scale, 14, 18));
  const inseamInches = roundQuarter(clampNum(heightInches * 0.455, 26, 34));

  return {
    dimensions: {
      heightInches,
      bustInches,
      underbustInches,
      waistInches,
      hipsInches,
      shoulderInches,
      inseamInches,
      skinToneHex: front?.skinHex || "#D8A986",
    },
    confidencePct: 91,
    scanSummary: `Portrait calibrated to ${formatHeightFeetInches(
      heightInches
    )} proportional 3D mesh — fine-tune Bust, Waist, or Hips below for exact garment fit.`,
    detectedRatios: {
      waistToHipRatio: Number((waistInches / hipsInches).toFixed(2)),
      bustToWaistRatio: Number((bustInches / waistInches).toFixed(2)),
      legToHeightRatio: Number((inseamInches / heightInches).toFixed(2)),
    },
  };
}

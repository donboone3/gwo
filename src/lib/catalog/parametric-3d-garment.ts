import {
  FabricStretchLevel,
  GarmentCutType,
  Product,
  SizeMeasurementSpec,
  UserProfile,
} from "../types";
import { buildBrandCalibratedSizeChart, extractProductFitProfile } from "./fit-intelligence";

export type MeshZoneStatus =
  | "too_tight"
  | "sculpted_snug"
  | "tailored_ideal"
  | "drape_ease";

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Quad3D {
  p0: Point3D;
  p1: Point3D;
  p2: Point3D;
  p3: Point3D;
  layer: "body" | "garment" | "detail";
  easeInches: number;
  status: MeshZoneStatus;
  baseHex: string;
  vNorm: number; // 0 = hem, 1 = neckline
  uAngle: number; // 0..2pi
}

export interface CaliperRing3D {
  label: string;
  yInches: number;
  bodyCircInches: number;
  garmentCircInches: number;
  easeInches: number;
  status: MeshZoneStatus;
  points: Point3D[];
}

export interface Parametric3DMockScene {
  quads: Quad3D[];
  caliperRings: CaliperRing3D[];
  storeModelRelativeHemYInches?: number;
  customerHemYInches: number;
  totalHeightInches: number;
  garmentColorHex: string;
  hasCorsetBack: boolean;
  stretchGiveInches: number;
}

/**
 * Given desired perimeter C (in inches) and depth-to-width ratio k = b / a,
 * solves Ramanujan's ellipse perimeter C ≈ 2π * sqrt((a^2 + b^2) / 2) for semi-axes (a, b).
 */
export function ellipseAxesFromCircumference(
  circumferenceInches: number,
  depthToWidthRatio: number
): { a: number; b: number } {
  const safeC = Math.max(4, circumferenceInches);
  const k = Math.max(0.35, Math.min(1.2, depthToWidthRatio));
  const h = Math.pow(1 - k, 2) / Math.pow(1 + k, 2);
  const ramanujanFactor = 1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h));
  const denom = Math.PI * (1 + k) * ramanujanFactor;
  const a = safeC / denom;
  const b = a * k;
  return { a, b };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

/**
 * Computes anatomical cross-section circumference & depth/width ratio at normalized height t = y / H.
 */
function sampleBodyStation(
  t: number,
  avatar: Pick<UserProfile, "bustInches" | "waistInches" | "hipsInches">
): { circ: number; k: number; zShift: number } {
  const bust = avatar.bustInches;
  const waist = avatar.waistInches;
  const hips = avatar.hipsInches;
  const underbust = Math.max(waist + 1.2, bust - 3.2);
  const highHip = lerp(waist, hips, 0.68);
  const shoulders = bust + 4.4;
  const neck = 12.6;

  const stops: Array<[number, number, number, number]> = [
    // [tHeight, circumference, depthRatioK, zAnteriorShift]
    [0.05, 8.4, 0.92, 0.0], // ankle
    [0.16, 13.4, 0.94, -0.1], // calf
    [0.27, 13.8, 0.9, 0.0], // knee
    [0.39, 19.8, 0.88, 0.05], // mid-thigh
    [0.47, Math.max(30, hips * 0.93), 0.76, -0.25], // low hip / glute base
    [0.525, hips, 0.73, -0.32], // full hips
    [0.58, highHip, 0.7, -0.12], // high hip
    [0.635, waist, 0.68, 0.05], // natural waist
    [0.695, underbust, 0.71, 0.14], // underbust ribcage
    [0.745, bust, 0.79, 0.42], // bust apex
    [0.795, bust * 0.96, 0.66, 0.18], // upper chest
    [0.835, shoulders, 0.46, 0.0], // shoulders
    [0.865, neck, 0.88, 0.05], // neck base
    [0.91, 12.2, 0.9, 0.08], // mid neck
  ];

  if (t <= stops[0][0]) {
    return { circ: stops[0][1], k: stops[0][2], zShift: stops[0][3] };
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0, k0, z0] = stops[i];
    const [t1, c1, k1, z1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const s = smoothstep(t0, t1, t);
      return {
        circ: lerp(c0, c1, s),
        k: lerp(k0, k1, s),
        zShift: lerp(z0, z1, s),
      };
    }
  }
  const last = stops[stops.length - 1];
  return { circ: last[1], k: last[2], zShift: last[3] };
}

function classifyEaseStatus(
  easeInches: number,
  stretchGive: number
): MeshZoneStatus {
  if (easeInches < -stretchGive - 0.15) return "too_tight";
  if (easeInches < -0.15) return "sculpted_snug";
  if (easeInches <= 2.1) return "tailored_ideal";
  return "drape_ease";
}

/**
 * Generates a full 3D parametric body + garment fit scene in real inches
 * for interactive 360° yaw/pitch/zoom studio inspection.
 */
export function buildParametric3DFitScene(params: {
  avatar: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches" | "skinTone"
  >;
  product: Product;
  selectedSize: string;
}): Parametric3DMockScene {
  const { avatar, product, selectedSize } = params;
  const H = Math.max(56, Math.min(74, avatar.heightInches || 62));
  const skinHex = avatar.skinTone || "#D9A482";
  const garmentHex =
    product.colorHex && product.colorHex.startsWith("#")
      ? product.colorHex
      : "#C80815";

  const meta =
    product.fitMetadata ||
    extractProductFitProfile({
      rawText: product.title,
      title: product.title,
      brand: product.brand,
      category: product.category,
      silhouette: product.silhouette,
    }).fitMetadata;

  const stretchLevel: FabricStretchLevel = meta.stretchLevel || "medium";
  const cutType: GarmentCutType = meta.cutType || "fitted";
  const stretchGive =
    stretchLevel === "high"
      ? 2.25
      : stretchLevel === "medium"
      ? 1.15
      : stretchLevel === "low"
      ? 0.45
      : 0;

  const chart: Record<string, SizeMeasurementSpec> =
    product.sizeChartInches && Object.keys(product.sizeChartInches).length > 0
      ? product.sizeChartInches
      : buildBrandCalibratedSizeChart(
          product.brand,
          cutType,
          meta.storeFitTendency || "true_to_size"
        );

  const spec = chart[selectedSize] || chart.S || {
    bustMin: 33,
    bustMax: 35,
    waistMin: 26,
    waistMax: 27.5,
    hipsMin: 36,
    hipsMax: 38,
  };

  // Size chart [min, max] specifies the body range the garment pattern accommodates cleanly;
  // garment pattern circumference equals the upper accommodation limit (spec.max)
  const rawSpecBust =
    spec.bustMax !== undefined
      ? spec.bustMax
      : spec.bustMin !== undefined
      ? spec.bustMin + 1.5
      : avatar.bustInches + 1;
  // Corset lace-up back cinches excess upper-bust room smoothly down toward avatar bust
  const gBust =
    meta.hasAdjustableBack && rawSpecBust > avatar.bustInches
      ? Math.max(avatar.bustInches + 0.45, rawSpecBust - 1.8)
      : rawSpecBust;
  const gWaist =
    spec.waistMax !== undefined
      ? spec.waistMax
      : spec.waistMin !== undefined
      ? spec.waistMin + 1.5
      : avatar.waistInches + 0.5;
  const gHips =
    spec.hipsMax !== undefined
      ? spec.hipsMax
      : spec.hipsMin !== undefined
      ? spec.hipsMin + 1.5
      : avatar.hipsInches + 1.5;

  // Determine vertical span [tBottom .. tTop] of the garment on the customer's H-inch body
  let tTop = 0.805;
  let tBottom = 0.41;

  if (product.category === "dress") {
    tTop = 0.795;
    const cfLen = meta.garmentLengthBySizeInches?.[selectedSize];
    if (cfLen) {
      const yTop = tTop * H;
      tBottom = Math.max(0.1, Math.min(0.5, (yTop - cfLen) / H));
    } else if (meta.hemLanding === "maxi") {
      tBottom = 0.08;
    } else if (meta.hemLanding === "midi") {
      tBottom = 0.23;
    } else {
      tBottom = 0.385; // mini
    }
  } else if (product.category === "top" || product.category === "outerwear") {
    tTop = 0.825;
    if (meta.hemLanding === "cropped" || product.silhouette === "crop-tank" || product.silhouette === "sports-bra") {
      tBottom = 0.655;
    } else if (meta.hemLanding === "natural-waist" || product.silhouette === "baby-tee") {
      tBottom = 0.615;
    } else {
      tBottom = 0.545; // hip length
    }
  } else if (product.category === "bottom") {
    tTop = 0.635; // natural waist high-rise
    if (product.silhouette === "mini-skirt" || meta.hemLanding === "mini") {
      tBottom = 0.405;
    } else if (meta.hemLanding === "ankle" || product.silhouette === "leggings") {
      tBottom = 0.09;
    } else {
      tBottom = 0.06; // full length trousers/denim
    }
  }

  const quads: Quad3D[] = [];
  const N_ANG = 40; // silky-smooth studio radial resolution

  // ==================== 1. BUILD 3D ANATOMICAL BODY MANNEQUIN ====================
  // Dual legs from ankle (0.05) to crotch (0.455), unified torso/neck from 0.455 to 0.90, sculpted head ellipsoid 0.90..0.985
  const legStations = 11;
  for (let side of [-1, 1]) {
    for (let i = 0; i < legStations; i++) {
      const t0 = lerp(0.05, 0.455, i / legStations);
      const t1 = lerp(0.05, 0.455, (i + 1) / legStations);
      const s0 = sampleBodyStation(t0, avatar);
      const s1 = sampleBodyStation(t1, avatar);
      // Single leg circumference -> radius
      const r0 = (s0.circ * 0.54) / (2 * Math.PI);
      const r1 = (s1.circ * 0.54) / (2 * Math.PI);
      const xOff0 = side * lerp(2.15, 2.55, i / legStations);
      const xOff1 = side * lerp(2.15, 2.55, (i + 1) / legStations);
      const legAngs = 14;
      for (let j = 0; j < legAngs; j++) {
        const u0 = (j / legAngs) * Math.PI * 2;
        const u1 = ((j + 1) / legAngs) * Math.PI * 2;
        quads.push({
          p0: { x: xOff0 + Math.cos(u0) * r0, y: t0 * H, z: Math.sin(u0) * r0 * 1.06 },
          p1: { x: xOff0 + Math.cos(u1) * r0, y: t0 * H, z: Math.sin(u1) * r0 * 1.06 },
          p2: { x: xOff1 + Math.cos(u1) * r1, y: t1 * H, z: Math.sin(u1) * r1 * 1.06 },
          p3: { x: xOff1 + Math.cos(u0) * r1, y: t1 * H, z: Math.sin(u0) * r1 * 1.06 },
          layer: "body",
          easeInches: 0,
          status: "tailored_ideal",
          baseHex: skinHex,
          vNorm: t0,
          uAngle: u0,
        });
      }
    }
  }

  const torsoStations = 26;
  for (let i = 0; i < torsoStations; i++) {
    const t0 = lerp(0.455, 0.905, i / torsoStations);
    const t1 = lerp(0.455, 0.905, (i + 1) / torsoStations);
    const b0 = sampleBodyStation(t0, avatar);
    const b1 = sampleBodyStation(t1, avatar);
    const ax0 = ellipseAxesFromCircumference(b0.circ, b0.k);
    const ax1 = ellipseAxesFromCircumference(b1.circ, b1.k);

    for (let j = 0; j < N_ANG; j++) {
      const u0 = (j / N_ANG) * Math.PI * 2;
      const u1 = ((j + 1) / N_ANG) * Math.PI * 2;
      quads.push({
        p0: { x: Math.cos(u0) * ax0.a, y: t0 * H, z: Math.sin(u0) * ax0.b + b0.zShift },
        p1: { x: Math.cos(u1) * ax0.a, y: t0 * H, z: Math.sin(u1) * ax0.b + b0.zShift },
        p2: { x: Math.cos(u1) * ax1.a, y: t1 * H, z: Math.sin(u1) * ax1.b + b1.zShift },
        p3: { x: Math.cos(u0) * ax1.a, y: t1 * H, z: Math.sin(u0) * ax1.b + b1.zShift },
        layer: "body",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: skinHex,
        vNorm: t0,
        uAngle: u0,
      });
    }
  }

  // Sculpted Studio Mannequin Head Egg (0.905 .. 0.99)
  const headRings = 12;
  for (let i = 0; i < headRings; i++) {
    const s0 = i / headRings;
    const s1 = (i + 1) / headRings;
    const t0 = lerp(0.905, 0.99, s0);
    const t1 = lerp(0.905, 0.99, s1);
    const prof0 = Math.sin(Math.max(0.08, s0 * Math.PI));
    const prof1 = Math.sin(Math.max(0.08, s1 * Math.PI));
    const rx0 = 2.65 * prof0;
    const rz0 = 3.15 * prof0;
    const rx1 = 2.65 * prof1;
    const rz1 = 3.15 * prof1;
    for (let j = 0; j < 18; j++) {
      const u0 = (j / 18) * Math.PI * 2;
      const u1 = ((j + 1) / 18) * Math.PI * 2;
      quads.push({
        p0: { x: Math.cos(u0) * rx0, y: t0 * H, z: Math.sin(u0) * rz0 + 0.15 },
        p1: { x: Math.cos(u1) * rx0, y: t0 * H, z: Math.sin(u1) * rz0 + 0.15 },
        p2: { x: Math.cos(u1) * rx1, y: t1 * H, z: Math.sin(u1) * rz1 + 0.15 },
        p3: { x: Math.cos(u0) * rx1, y: t1 * H, z: Math.sin(u0) * rz1 + 0.15 },
        layer: "body",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: skinHex,
        vNorm: t0,
        uAngle: u0,
      });
    }
  }

  // ==================== 2. BUILD PRODUCT-DRIVEN 3D GARMENT SHELL ====================
  const sampleGarmentSpecCirc = (t: number): number => {
    if (t >= 0.745) {
      return lerp(gBust, gBust + 1.4, (t - 0.745) / 0.08);
    }
    if (t >= 0.635) {
      return lerp(gWaist, gBust, smoothstep(0.635, 0.745, t));
    }
    if (t >= 0.525) {
      return lerp(gHips, gWaist, smoothstep(0.525, 0.635, t));
    }
    // Skirt flare or trouser taper below full hip
    if (product.category === "dress" || product.silhouette === "mini-skirt") {
      const flare =
        meta.hemLanding === "maxi" || meta.hemLanding === "midi"
          ? 7.5
          : cutType === "fitted"
          ? 0.8
          : 3.5;
      return gHips + flare * (1 - smoothstep(tBottom, 0.525, t));
    }
    return gHips;
  };

  const isPants =
    product.category === "bottom" && product.silhouette !== "mini-skirt";

  const gRings = 26;
  for (let i = 0; i < gRings; i++) {
    const v0 = i / gRings;
    const v1 = (i + 1) / gRings;
    const t0 = lerp(tBottom, tTop, v0);
    const t1 = lerp(tBottom, tTop, v1);

    // Split pants into dual trouser/legging legs below crotch (0.455)
    if (isPants && t1 <= 0.46) {
      const b0 = sampleBodyStation(t0, avatar);
      const b1 = sampleBodyStation(t1, avatar);
      const bodyLegR0 = (b0.circ * 0.54) / (2 * Math.PI);
      const bodyLegR1 = (b1.circ * 0.54) / (2 * Math.PI);
      const extraLegRoom =
        product.silhouette === "leggings"
          ? 0.08
          : product.silhouette === "wide-denim" || product.silhouette === "cargo-pants"
          ? 0.95
          : 0.45;
      const gr0 = bodyLegR0 + extraLegRoom;
      const gr1 = bodyLegR1 + extraLegRoom;
      const easeVal = Number(((gWaist - avatar.waistInches + (gHips - avatar.hipsInches)) / 2).toFixed(2));
      const status = classifyEaseStatus(easeVal, stretchGive);

      for (const side of [-1, 1]) {
        const xOff0 = side * lerp(2.2, 2.55, t0 / 0.46);
        const xOff1 = side * lerp(2.2, 2.55, t1 / 0.46);
        for (let j = 0; j < 16; j++) {
          const u0 = (j / 16) * Math.PI * 2;
          const u1 = ((j + 1) / 16) * Math.PI * 2;
          quads.push({
            p0: { x: xOff0 + Math.cos(u0) * gr0, y: t0 * H, z: Math.sin(u0) * gr0 * 1.06 },
            p1: { x: xOff0 + Math.cos(u1) * gr0, y: t0 * H, z: Math.sin(u1) * gr0 * 1.06 },
            p2: { x: xOff1 + Math.cos(u1) * gr1, y: t1 * H, z: Math.sin(u1) * gr1 * 1.06 },
            p3: { x: xOff1 + Math.cos(u0) * gr1, y: t1 * H, z: Math.sin(u0) * gr1 * 1.06 },
            layer: "garment",
            easeInches: easeVal,
            status,
            baseHex: garmentHex,
            vNorm: v0,
            uAngle: u0,
          });
        }
      }
      continue;
    }

    const body0 = sampleBodyStation(t0, avatar);
    const body1 = sampleBodyStation(t1, avatar);
    const specC0 = sampleGarmentSpecCirc(t0);
    const specC1 = sampleGarmentSpecCirc(t1);

    const ease0 = Number((specC0 - body0.circ).toFixed(2));
    const ease1 = Number((specC1 - body1.circ).toFixed(2));
    // Garment cannot pass inside solid body; when ease < 0 it hugs body skin (+fabric shell clearance)
    const renderedCirc0 = Math.max(body0.circ + 0.75, specC0 + 0.55);
    const renderedCirc1 = Math.max(body1.circ + 0.75, specC1 + 0.55);

    const gAx0 = ellipseAxesFromCircumference(renderedCirc0, body0.k);
    const gAx1 = ellipseAxesFromCircumference(renderedCirc1, body1.k);

    const status = classifyEaseStatus((ease0 + ease1) / 2, stretchGive);

    // Sculptural outward cowl-pleat waves on dropped-waist / pleated skirts (strictly >= 1.0 so body never pokes through!)
    const hasCowlDrape =
      product.category === "dress" || product.silhouette === "mini-skirt";
    const pleatAmp0 =
      hasCowlDrape && t0 >= 0.43 && t0 <= 0.61
        ? 0.16 * Math.sin(((t0 - 0.43) / 0.18) * Math.PI)
        : 0;
    const pleatAmp1 =
      hasCowlDrape && t1 >= 0.43 && t1 <= 0.61
        ? 0.16 * Math.sin(((t1 - 0.43) / 0.18) * Math.PI)
        : 0;

    for (let j = 0; j < N_ANG; j++) {
      const u0 = (j / N_ANG) * Math.PI * 2;
      const u1 = ((j + 1) / N_ANG) * Math.PI * 2;
      const uMid = (u0 + u1) / 2;

      // Open corset lace-up back window on adjustable-back dresses (back = sin(u) < -0.78 in upper bodice)
      if (
        meta.hasAdjustableBack &&
        t0 >= 0.64 &&
        Math.sin(uMid) < -0.78
      ) {
        continue;
      }

      // Square neckline scoop at very top front of dresses/tanks (meets straps seamlessly at |cos(u)| = 0.46)
      if (
        (product.category === "dress" || product.silhouette === "crop-tank") &&
        v0 >= 0.88 &&
        Math.sin(uMid) > 0.68 &&
        Math.abs(Math.cos(uMid)) < 0.46
      ) {
        continue;
      }

      const w0 = 1 + pleatAmp0 * (0.5 + 0.5 * Math.cos(u0 * 5));
      const w1 = 1 + pleatAmp0 * (0.5 + 0.5 * Math.cos(u1 * 5));
      const w2 = 1 + pleatAmp1 * (0.5 + 0.5 * Math.cos(u1 * 5));
      const w3 = 1 + pleatAmp1 * (0.5 + 0.5 * Math.cos(u0 * 5));

      quads.push({
        p0: {
          x: Math.cos(u0) * gAx0.a * w0,
          y: t0 * H,
          z: Math.sin(u0) * gAx0.b * w0 + body0.zShift,
        },
        p1: {
          x: Math.cos(u1) * gAx0.a * w1,
          y: t0 * H,
          z: Math.sin(u1) * gAx0.b * w1 + body0.zShift,
        },
        p2: {
          x: Math.cos(u1) * gAx1.a * w2,
          y: t1 * H,
          z: Math.sin(u1) * gAx1.b * w2 + body1.zShift,
        },
        p3: {
          x: Math.cos(u0) * gAx1.a * w3,
          y: t1 * H,
          z: Math.sin(u0) * gAx1.b * w3 + body1.zShift,
        },
        layer: "garment",
        easeInches: ease0,
        status,
        baseHex: garmentHex,
        vNorm: v0,
        uAngle: u0,
      });
    }
  }

  // ==================== 3. SHOULDER STRAPS / SLEEVES & LACE-UP CORSET DETAILS ====================
  if (product.category === "dress" || product.silhouette === "crop-tank" || product.silhouette === "sports-bra") {
    // Tapered left & right shoulder straps bridging front chest (tTop) over shoulder (0.842 H) to upper back
    const topBody = sampleBodyStation(tTop, avatar);
    const topAx = ellipseAxesFromCircumference(Math.max(topBody.circ + 0.8, gBust), topBody.k);
    const strapZRadius = Math.max(3.45, topAx.b * 0.92);
    for (const side of [-1, 1]) {
      const strapSteps = 12;
      const xStrap = side * Math.min(3.05, topAx.a * 0.52);
      const strapW = 0.58;
      for (let s = 0; s < strapSteps; s++) {
        const a0 = (s / strapSteps) * Math.PI;
        const a1 = ((s + 1) / strapSteps) * Math.PI;
        const y0 = (tTop - 0.015) * H + Math.sin(a0) * (0.852 * H - (tTop - 0.015) * H);
        const y1 = (tTop - 0.015) * H + Math.sin(a1) * (0.852 * H - (tTop - 0.015) * H);
        const z0 = Math.cos(a0) * strapZRadius + topBody.zShift * 0.7;
        const z1 = Math.cos(a1) * strapZRadius + topBody.zShift * 0.7;
        quads.push({
          p0: { x: xStrap - strapW / 2, y: y0, z: z0 },
          p1: { x: xStrap + strapW / 2, y: y0, z: z0 },
          p2: { x: xStrap + strapW / 2, y: y1, z: z1 },
          p3: { x: xStrap - strapW / 2, y: y1, z: z1 },
          layer: "detail",
          easeInches: 0.5,
          status: "tailored_ideal",
          baseHex: garmentHex,
          vNorm: 1,
          uAngle: 0,
        });
      }
    }
  } else if (product.category === "top" || product.category === "outerwear") {
    // Sculpted 3D sleeves (short sleeves for baby-tee, full sleeves for outerwear/cardigan)
    const isLongSleeve =
      product.category === "outerwear" || product.silhouette === "cardigan";
    const sleeveLen = isLongSleeve ? 16.5 : 5.2;
    const sleeveR0 = cutType === "oversized" ? 2.45 : 1.85;
    const sleeveR1 = cutType === "oversized" ? 1.95 : 1.45;
    const shoulderY = 0.815 * H;
    for (const side of [-1, 1]) {
      const segs = isLongSleeve ? 8 : 4;
      for (let s = 0; s < segs; s++) {
        const f0 = s / segs;
        const f1 = (s + 1) / segs;
        const cx0 = side * (6.1 + f0 * 2.4);
        const cx1 = side * (6.1 + f1 * 2.4);
        const cy0 = shoulderY - f0 * sleeveLen;
        const cy1 = shoulderY - f1 * sleeveLen;
        const r0 = lerp(sleeveR0, sleeveR1, f0);
        const r1 = lerp(sleeveR0, sleeveR1, f1);
        for (let j = 0; j < 12; j++) {
          const u0 = (j / 12) * Math.PI * 2;
          const u1 = ((j + 1) / 12) * Math.PI * 2;
          quads.push({
            p0: { x: cx0 + Math.cos(u0) * r0 * 0.75, y: cy0, z: Math.sin(u0) * r0 },
            p1: { x: cx0 + Math.cos(u1) * r0 * 0.75, y: cy0, z: Math.sin(u1) * r0 },
            p2: { x: cx1 + Math.cos(u1) * r1 * 0.75, y: cy1, z: Math.sin(u1) * r1 },
            p3: { x: cx1 + Math.cos(u0) * r1 * 0.75, y: cy1, z: Math.sin(u0) * r1 },
            layer: "garment",
            easeInches: 1.2,
            status: "tailored_ideal",
            baseHex: garmentHex,
            vNorm: 0.9,
            uAngle: u0,
          });
        }
      }
    }
  }

  // Criss-cross 3D corset laces across open back if hasAdjustableBack
  if (meta.hasAdjustableBack) {
    for (let k = 0; k < 5; k++) {
      const tLow = lerp(0.65, 0.76, k / 5);
      const tHigh = lerp(0.65, 0.76, (k + 0.85) / 5);
      const bMid = sampleBodyStation((tLow + tHigh) / 2, avatar);
      const ax = ellipseAxesFromCircumference(bMid.circ + 0.55, bMid.k);
      const zBack = -ax.b + bMid.zShift - 0.08;
      const xSpan = ax.a * 0.46;
      // Diagonal X-cord pair
      quads.push({
        p0: { x: -xSpan, y: tLow * H, z: zBack },
        p1: { x: -xSpan, y: tLow * H + 0.22, z: zBack },
        p2: { x: xSpan, y: tHigh * H + 0.22, z: zBack },
        p3: { x: xSpan, y: tHigh * H, z: zBack },
        layer: "detail",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: garmentHex,
        vNorm: 0.8,
        uAngle: Math.PI * 1.5,
      });
      quads.push({
        p0: { x: xSpan, y: tLow * H, z: zBack },
        p1: { x: xSpan, y: tLow * H + 0.22, z: zBack },
        p2: { x: -xSpan, y: tHigh * H + 0.22, z: zBack },
        p3: { x: -xSpan, y: tHigh * H, z: zBack },
        layer: "detail",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: garmentHex,
        vNorm: 0.8,
        uAngle: Math.PI * 1.5,
      });
    }
  }

  // ==================== 4. BUILD 3D MEASUREMENT CALIPER RINGS ====================
  const ringDefs: Array<{ label: string; t: number; bodyC: number; gC: number }> = [
    { label: "Bust", t: 0.745, bodyC: avatar.bustInches, gC: gBust },
    { label: "Waist", t: 0.635, bodyC: avatar.waistInches, gC: gWaist },
    { label: "Hips", t: 0.525, bodyC: avatar.hipsInches, gC: gHips },
  ];

  const caliperRings: CaliperRing3D[] = ringDefs
    .filter((rd) => rd.t >= tBottom - 0.04 && rd.t <= tTop + 0.04)
    .map((rd) => {
      const bSt = sampleBodyStation(rd.t, avatar);
      const ringCirc = Math.max(rd.bodyC, rd.gC) + 1.15;
      const ax = ellipseAxesFromCircumference(ringCirc, bSt.k);
      const pts: Point3D[] = [];
      for (let j = 0; j <= 36; j++) {
        const u = (j / 36) * Math.PI * 2;
        pts.push({
          x: Math.cos(u) * ax.a,
          y: rd.t * H,
          z: Math.sin(u) * ax.b + bSt.zShift,
        });
      }
      const easeVal = Number((rd.gC - rd.bodyC).toFixed(2));
      return {
        label: rd.label,
        yInches: Number((rd.t * H).toFixed(1)),
        bodyCircInches: rd.bodyC,
        garmentCircInches: Number(rd.gC.toFixed(2)),
        easeInches: easeVal,
        status: classifyEaseStatus(easeVal, stretchGive),
        points: pts,
      };
    });

  // Relative store model hem position on the customer's body (shows how much shorter/higher it looked on the tall store model!)
  const modelH = meta.modelStats?.heightInches || 68;
  const heightDiff = modelH - H;
  const storeModelRelativeHemYInches =
    Math.abs(heightDiff) >= 1.5
      ? Number((tBottom * H + heightDiff * 0.58).toFixed(1))
      : undefined;

  return {
    quads,
    caliperRings,
    storeModelRelativeHemYInches,
    customerHemYInches: Number((tBottom * H).toFixed(1)),
    totalHeightInches: H,
    garmentColorHex: garmentHex,
    hasCorsetBack: Boolean(meta.hasAdjustableBack),
    stretchGiveInches: stretchGive,
  };
}

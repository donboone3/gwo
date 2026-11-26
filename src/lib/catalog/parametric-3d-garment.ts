import {
  FabricStretchLevel,
  GarmentCutType,
  Product,
  SizeMeasurementSpec,
  UserProfile,
} from "../types";
import {
  buildBrandCalibratedSizeChart,
  extractProductFitProfile,
} from "./fit-intelligence";

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
  frontFeatureSummary: string;
  backFeatureSummary: string;
}

/**
 * Given desired perimeter C (in inches) and depth-to-width ratio k = b / a,
 * solves Ramanujan's 2nd ellipse perimeter formula for semi-axes (a, b).
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

function darkenHex(hex: string, factor = 0.72): string {
  const clean = (hex || "#232428").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16) || 0x232428;
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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

function appendShoeMesh(
  quads: Quad3D[],
  H: number,
  shoeProduct: Product
): { front: string; back: string } {
  const hex =
    shoeProduct.colorHex && shoeProduct.colorHex.startsWith("#")
      ? shoeProduct.colorHex
      : "#18181B";
  const accent =
    shoeProduct.accentHex && shoeProduct.accentHex.startsWith("#")
      ? shoeProduct.accentHex
      : darkenHex(hex, 0.6);
  const titleL = `${shoeProduct.title} ${shoeProduct.silhouette}`.toLowerCase();
  const isBoot = /boot/.test(titleL);
  const isHeel = /heel|stiletto|slingback|sandal/.test(titleL);
  const isSneaker = shoeProduct.silhouette === "sneakers" || /sneaker|runner/.test(titleL);

  for (const side of [-1, 1]) {
    const xFoot = side * 2.18;
    // Footbed / upper vamp extending forward (+z) and heel cup (-z)
    const yBase = 0.042 * H;
    const yTopShoe = isBoot ? 0.22 * H : 0.072 * H;
    const steps = isBoot ? 7 : 3;

    for (let s = 0; s < steps; s++) {
      const f0 = s / steps;
      const f1 = (s + 1) / steps;
      const y0 = lerp(yBase, yTopShoe, f0);
      const y1 = lerp(yBase, yTopShoe, f1);
      const rx = isBoot ? lerp(1.58, 1.82, f0) : 1.56;
      const rzFront0 = f0 < 0.45 ? lerp(3.15, 1.75, f0 / 0.45) : 1.65;
      const rzFront1 = f1 < 0.45 ? lerp(3.15, 1.75, f1 / 0.45) : 1.65;
      const rzBack = 1.65;

      for (let j = 0; j < 14; j++) {
        const u0 = (j / 14) * Math.PI * 2;
        const u1 = ((j + 1) / 14) * Math.PI * 2;
        const zRad0 = Math.sin(u0) >= 0 ? rzFront0 : rzBack;
        const zRad1 = Math.sin(u1) >= 0 ? rzFront0 : rzBack;
        const zRad0Top = Math.sin(u0) >= 0 ? rzFront1 : rzBack;
        const zRad1Top = Math.sin(u1) >= 0 ? rzFront1 : rzBack;

        // Open-toe / strappy cutout on stiletto sandals
        if (isHeel && !isBoot && s === 1 && Math.sin((u0 + u1) / 2) > 0.35) {
          continue;
        }

        quads.push({
          p0: { x: xFoot + Math.cos(u0) * rx, y: y0, z: Math.sin(u0) * zRad0 + 0.35 },
          p1: { x: xFoot + Math.cos(u1) * rx, y: y0, z: Math.sin(u1) * zRad1 + 0.35 },
          p2: { x: xFoot + Math.cos(u1) * rx, y: y1, z: Math.sin(u1) * zRad1Top + 0.35 },
          p3: { x: xFoot + Math.cos(u0) * rx, y: y1, z: Math.sin(u0) * zRad0Top + 0.35 },
          layer: "garment",
          easeInches: 0.4,
          status: "tailored_ideal",
          baseHex: hex,
          vNorm: f0,
          uAngle: u0,
        });
      }
    }

    // Back Stiletto Heel Pin OR Chunky Sneaker Outsole
    if (isHeel) {
      const zHeel = -1.18;
      const hw = 0.24;
      const yFloor = 0.038 * H;
      const yCup = 0.088 * H;
      for (let j = 0; j < 8; j++) {
        const u0 = (j / 8) * Math.PI * 2;
        const u1 = ((j + 1) / 8) * Math.PI * 2;
        quads.push({
          p0: { x: xFoot + Math.cos(u0) * hw, y: yFloor, z: zHeel + Math.sin(u0) * hw },
          p1: { x: xFoot + Math.cos(u1) * hw, y: yFloor, z: zHeel + Math.sin(u1) * hw },
          p2: { x: xFoot + Math.cos(u1) * (hw * 1.4), y: yCup, z: zHeel + Math.sin(u1) * (hw * 1.4) },
          p3: { x: xFoot + Math.cos(u0) * (hw * 1.4), y: yCup, z: zHeel + Math.sin(u0) * (hw * 1.4) },
          layer: "detail",
          easeInches: 0.2,
          status: "tailored_ideal",
          baseHex: accent,
          vNorm: 0.1,
          uAngle: Math.PI * 1.5,
        });
      }
    } else if (isSneaker) {
      // Contrasting back heel tab
      quads.push({
        p0: { x: xFoot - 0.55, y: 0.055 * H, z: -1.36 },
        p1: { x: xFoot + 0.55, y: 0.055 * H, z: -1.36 },
        p2: { x: xFoot + 0.55, y: 0.078 * H, z: -1.36 },
        p3: { x: xFoot - 0.55, y: 0.078 * H, z: -1.36 },
        layer: "detail",
        easeInches: 0.4,
        status: "tailored_ideal",
        baseHex: accent,
        vNorm: 0.5,
        uAngle: Math.PI * 1.5,
      });
    }
  }

  return {
    front: isBoot
      ? "Sculpted knee/ankle boot vamp & toe profile"
      : isHeel
      ? "Pointed/strappy front vamp & ankle strap"
      : "Cushioned sneaker vamp & contrast swoosh",
    back: isHeel
      ? "Sculpted stiletto heel pin & back ankle counter"
      : isSneaker
      ? "Contrast sneaker heel tab & sculpted sole"
      : "Structured leather back heel counter",
  };
}

function appendBagMesh(
  quads: Quad3D[],
  H: number,
  avatar: Pick<UserProfile, "bustInches" | "waistInches" | "hipsInches">,
  bagProduct: Product
): { front: string; back: string } {
  const hex =
    bagProduct.colorHex && bagProduct.colorHex.startsWith("#")
      ? bagProduct.colorHex
      : "#5A1925";
  const hardwareHex =
    bagProduct.accentHex && bagProduct.accentHex.startsWith("#")
      ? bagProduct.accentHex
      : "#D4AF37";

  const waistSt = sampleBodyStation(0.64, avatar);
  const waistAx = ellipseAxesFromCircumference(waistSt.circ + 2.2, waistSt.k);
  const bagCx = waistAx.a + 1.55;
  const bagCy = 0.635 * H;
  const bagRx = 1.05;
  const bagRy = 2.65;
  const bagRz = 3.45;

  // Sculpted 3D Crescent Shoulder Bag Body at right rib/waist
  const rings = 8;
  for (let i = 0; i < rings; i++) {
    const s0 = i / rings;
    const s1 = (i + 1) / rings;
    const p0 = Math.sin(Math.max(0.12, s0 * Math.PI));
    const p1 = Math.sin(Math.max(0.12, s1 * Math.PI));
    const z0 = lerp(-bagRz, bagRz, s0);
    const z1 = lerp(-bagRz, bagRz, s1);
    const arch0 = -Math.sin(s0 * Math.PI) * 0.65;
    const arch1 = -Math.sin(s1 * Math.PI) * 0.65;

    for (let j = 0; j < 12; j++) {
      const u0 = (j / 12) * Math.PI * 2;
      const u1 = ((j + 1) / 12) * Math.PI * 2;
      quads.push({
        p0: {
          x: bagCx + Math.cos(u0) * bagRx * p0,
          y: bagCy + arch0 + Math.sin(u0) * bagRy * p0,
          z: z0,
        },
        p1: {
          x: bagCx + Math.cos(u1) * bagRx * p0,
          y: bagCy + arch0 + Math.sin(u1) * bagRy * p0,
          z: z0,
        },
        p2: {
          x: bagCx + Math.cos(u1) * bagRx * p1,
          y: bagCy + arch1 + Math.sin(u1) * bagRy * p1,
          z: z1,
        },
        p3: {
          x: bagCx + Math.cos(u0) * bagRx * p1,
          y: bagCy + arch1 + Math.sin(u0) * bagRy * p1,
          z: z1,
        },
        layer: "detail",
        easeInches: 1.0,
        status: "tailored_ideal",
        baseHex: i === 1 || i === rings - 2 ? hardwareHex : hex,
        vNorm: s0,
        uAngle: u0,
      });
    }
  }

  // Full 360° Shoulder Strap looping from front bag buckle over right shoulder (0.848 H) to back bag buckle
  const strapSegs = 16;
  for (let s = 0; s < strapSegs; s++) {
    const a0 = (s / strapSegs) * Math.PI;
    const a1 = ((s + 1) / strapSegs) * Math.PI;
    const x0 = lerp(bagCx - 0.3, 3.4, Math.sin(a0));
    const x1 = lerp(bagCx - 0.3, 3.4, Math.sin(a1));
    const y0 = bagCy + 1.8 + Math.sin(a0) * (0.848 * H - (bagCy + 1.8));
    const y1 = bagCy + 1.8 + Math.sin(a1) * (0.848 * H - (bagCy + 1.8));
    const z0 = Math.cos(a0) * 2.95;
    const z1 = Math.cos(a1) * 2.95;
    quads.push({
      p0: { x: x0 - 0.28, y: y0, z: z0 },
      p1: { x: x0 + 0.28, y: y0, z: z0 },
      p2: { x: x1 + 0.28, y: y1, z: z1 },
      p3: { x: x1 - 0.28, y: y1, z: z1 },
      layer: "detail",
      easeInches: 1.0,
      status: "tailored_ideal",
      baseHex: hex,
      vNorm: 1,
      uAngle: 0,
    });
  }

  return {
    front: "Crescent leather silhouette & gold front clasp",
    back: "360° over-the-shoulder strap drop & back gusset",
  };
}

function appendApparelGarmentShell(params: {
  quads: Quad3D[];
  H: number;
  avatar: Pick<UserProfile, "bustInches" | "waistInches" | "hipsInches">;
  product: Product;
  selectedSize: string;
  radialOffsetInches?: number;
  isNeutralBaseLayer?: boolean;
}): {
  tBottom: number;
  tTop: number;
  gBust: number;
  gWaist: number;
  gHips: number;
  stretchGive: number;
  hasCorsetBack: boolean;
  frontSummary: string;
  backSummary: string;
} {
  const {
    quads,
    H,
    avatar,
    product,
    selectedSize,
    radialOffsetInches = 0,
    isNeutralBaseLayer = false,
  } = params;

  const garmentHex =
    product.colorHex && product.colorHex.startsWith("#")
      ? product.colorHex
      : "#C80815";
  const seamHex = darkenHex(garmentHex, 0.68);

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

  const rawSpecBust =
    spec.bustMax !== undefined
      ? spec.bustMax
      : spec.bustMin !== undefined
      ? spec.bustMin + 1.5
      : avatar.bustInches + 1;
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

  let tTop = 0.805;
  let tBottom = 0.41;

  const isSkirt =
    product.silhouette === "mini-skirt" || /skirt|skort/i.test(product.title);
  const isPants = product.category === "bottom" && !isSkirt;

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
      tBottom = 0.385;
    }
  } else if (product.category === "top" || product.category === "outerwear") {
    tTop = product.category === "outerwear" ? 0.832 : 0.822;
    if (
      meta.hemLanding === "cropped" ||
      product.silhouette === "crop-tank" ||
      product.silhouette === "sports-bra"
    ) {
      tBottom = 0.655;
    } else if (
      meta.hemLanding === "natural-waist" ||
      product.silhouette === "baby-tee" ||
      product.silhouette === "cropped-jacket"
    ) {
      tBottom = 0.605;
    } else {
      tBottom = 0.535;
    }
  } else if (product.category === "bottom") {
    tTop = 0.635;
    if (product.silhouette === "mini-skirt" || meta.hemLanding === "mini") {
      tBottom = 0.405;
    } else if (isSkirt && meta.hemLanding === "midi") {
      tBottom = 0.24;
    } else if (isSkirt && meta.hemLanding === "maxi") {
      tBottom = 0.11;
    } else if (meta.hemLanding === "ankle" || product.silhouette === "leggings") {
      tBottom = 0.09;
    } else {
      tBottom = 0.06;
    }
  }

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
    if (product.category === "dress" || isSkirt) {
      const flare =
        meta.hemLanding === "maxi" || meta.hemLanding === "midi"
          ? 6.2
          : cutType === "fitted"
          ? 0.8
          : 3.5;
      return gHips + flare * (1 - smoothstep(tBottom, 0.525, t));
    }
    return gHips;
  };

  const isOpenFrontOuterwear =
    product.category === "outerwear" &&
    /blazer|cardigan|jacket|coat|bomber/i.test(product.title);
  const isHoodie =
    product.silhouette === "oversized-hoodie" || /hoodie/i.test(product.title);

  const N_ANG = isNeutralBaseLayer ? 28 : 40;
  const gRings = isNeutralBaseLayer ? 12 : 26;

  for (let i = 0; i < gRings; i++) {
    const v0 = i / gRings;
    const v1 = (i + 1) / gRings;
    const t0 = lerp(tBottom, tTop, v0);
    const t1 = lerp(tBottom, tTop, v1);

    if (isPants && t1 <= 0.46) {
      const b0 = sampleBodyStation(t0, avatar);
      const b1 = sampleBodyStation(t1, avatar);
      const bodyLegR0 = (b0.circ * 0.54) / (2 * Math.PI);
      const bodyLegR1 = (b1.circ * 0.54) / (2 * Math.PI);
      const extraLegRoom =
        product.silhouette === "leggings"
          ? 0.08
          : product.silhouette === "wide-denim" ||
            product.silhouette === "cargo-pants"
          ? 0.95
          : 0.45;
      const gr0 = bodyLegR0 + extraLegRoom + radialOffsetInches * 0.2;
      const gr1 = bodyLegR1 + extraLegRoom + radialOffsetInches * 0.2;
      const easeVal = Number(
        (
          (gWaist - avatar.waistInches + (gHips - avatar.hipsInches)) /
          2
        ).toFixed(2)
      );
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
    const specC0 = sampleGarmentSpecCirc(t0) + radialOffsetInches * 3.2;
    const specC1 = sampleGarmentSpecCirc(t1) + radialOffsetInches * 3.2;

    const ease0 = Number((specC0 - body0.circ).toFixed(2));
    const ease1 = Number((specC1 - body1.circ).toFixed(2));
    const minShell = 0.72 + radialOffsetInches * 1.8;
    const renderedCirc0 = Math.max(body0.circ + minShell, specC0 + 0.55);
    const renderedCirc1 = Math.max(body1.circ + minShell, specC1 + 0.55);

    const gAx0 = ellipseAxesFromCircumference(renderedCirc0, body0.k);
    const gAx1 = ellipseAxesFromCircumference(renderedCirc1, body1.k);

    const status = classifyEaseStatus((ease0 + ease1) / 2, stretchGive);

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

      // Open corset lace-up back window on adjustable-back dresses/corsets (180° back = sin(u) < -0.78)
      if (meta.hasAdjustableBack && t0 >= 0.64 && Math.sin(uMid) < -0.78) {
        continue;
      }

      // Open lapel front slit on tailored outerwear when layered over a top/dress
      if (
        isOpenFrontOuterwear &&
        radialOffsetInches > 0.05 &&
        Math.sin(uMid) > 0.88 &&
        Math.abs(Math.cos(uMid)) < 0.24
      ) {
        continue;
      }

      // Tailored center-back vent slit at bottom of blazers/coats (180° back)
      if (
        isOpenFrontOuterwear &&
        v0 < 0.22 &&
        Math.sin(uMid) < -0.96 &&
        Math.abs(Math.cos(uMid)) < 0.12
      ) {
        continue;
      }

      // Square / scoop front & back neckline on dresses/tanks
      if (
        (product.category === "dress" || product.silhouette === "crop-tank") &&
        v0 >= 0.88 &&
        Math.abs(Math.sin(uMid)) > 0.68 &&
        Math.abs(Math.cos(uMid)) < 0.46
      ) {
        continue;
      }

      const w0 = 1 + pleatAmp0 * (0.5 + 0.5 * Math.cos(u0 * 5));
      const w1 = 1 + pleatAmp0 * (0.5 + 0.5 * Math.cos(u1 * 5));
      const w2 = 1 + pleatAmp1 * (0.5 + 0.5 * Math.cos(u1 * 5));
      const w3 = 1 + pleatAmp1 * (0.5 + 0.5 * Math.cos(u0 * 5));

      // Subtle center-back seam / zipper line & back pocket shading at 180°!
      let quadHex = garmentHex;
      if (!isNeutralBaseLayer) {
        const isCenterBackSpine =
          Math.sin(uMid) < -0.985 && !meta.hasAdjustableBack;
        const isBackPocketPatch =
          isPants &&
          product.silhouette !== "leggings" &&
          t0 >= 0.5 &&
          t0 <= 0.565 &&
          Math.sin(uMid) < -0.76 &&
          Math.abs(Math.cos(uMid)) >= 0.22 &&
          Math.abs(Math.cos(uMid)) <= 0.58;
        if (isCenterBackSpine || isBackPocketPatch) {
          quadHex = seamHex;
        }
      }

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
        baseHex: quadHex,
        vNorm: v0,
        uAngle: u0,
      });
    }
  }

  // Straps / Sleeves / Back Hood / Corset Laces
  if (!isNeutralBaseLayer) {
    if (
      product.category === "dress" ||
      product.silhouette === "crop-tank" ||
      product.silhouette === "sports-bra"
    ) {
      const topBody = sampleBodyStation(tTop, avatar);
      const topAx = ellipseAxesFromCircumference(
        Math.max(topBody.circ + 0.8, gBust),
        topBody.k
      );
      const strapZRadius = Math.max(3.45, topAx.b * 0.92);
      for (const side of [-1, 1]) {
        const strapSteps = 12;
        const xStrap = side * Math.min(3.05, topAx.a * 0.52);
        const strapW = 0.58;
        for (let s = 0; s < strapSteps; s++) {
          const a0 = (s / strapSteps) * Math.PI;
          const a1 = ((s + 1) / strapSteps) * Math.PI;
          const y0 =
            (tTop - 0.015) * H +
            Math.sin(a0) * (0.852 * H - (tTop - 0.015) * H);
          const y1 =
            (tTop - 0.015) * H +
            Math.sin(a1) * (0.852 * H - (tTop - 0.015) * H);
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
      const isLongSleeve =
        product.category === "outerwear" || product.silhouette === "cardigan";
      const sleeveLen = isLongSleeve ? 16.5 : 5.2;
      const sleeveR0 =
        (cutType === "oversized" ? 2.45 : 1.85) + radialOffsetInches * 0.35;
      const sleeveR1 =
        (cutType === "oversized" ? 1.95 : 1.45) + radialOffsetInches * 0.35;
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

      // Sculpted 3D Draped Back Hood on Hoodies (visible clearly at 90° & 180° Back!)
      if (isHoodie) {
        for (let hr = 0; hr < 5; hr++) {
          const hf0 = hr / 5;
          const hf1 = (hr + 1) / 5;
          const hy0 = lerp(0.77 * H, 0.875 * H, hf0);
          const hy1 = lerp(0.77 * H, 0.875 * H, hf1);
          const hoodW0 = lerp(2.2, 4.4, Math.sin(hf0 * Math.PI * 0.85 + 0.2));
          const hoodW1 = lerp(2.2, 4.4, Math.sin(hf1 * Math.PI * 0.85 + 0.2));
          const hz0 = -lerp(3.1, 4.7, Math.sin(hf0 * Math.PI));
          const hz1 = -lerp(3.1, 4.7, Math.sin(hf1 * Math.PI));
          for (let j = 0; j < 8; j++) {
            const a0 = Math.PI + (j / 8) * Math.PI;
            const a1 = Math.PI + ((j + 1) / 8) * Math.PI;
            quads.push({
              p0: { x: Math.cos(a0) * hoodW0, y: hy0, z: Math.sin(a0) * 1.4 + hz0 * 0.62 },
              p1: { x: Math.cos(a1) * hoodW0, y: hy0, z: Math.sin(a1) * 1.4 + hz0 * 0.62 },
              p2: { x: Math.cos(a1) * hoodW1, y: hy1, z: Math.sin(a1) * 1.4 + hz1 * 0.62 },
              p3: { x: Math.cos(a0) * hoodW1, y: hy1, z: Math.sin(a0) * 1.4 + hz1 * 0.62 },
              layer: "detail",
              easeInches: 2.0,
              status: "drape_ease",
              baseHex: seamHex,
              vNorm: 0.95,
              uAngle: Math.PI * 1.5,
            });
          }
        }
      }
    }

    if (meta.hasAdjustableBack) {
      for (let k = 0; k < 5; k++) {
        const tLow = lerp(0.65, 0.76, k / 5);
        const tHigh = lerp(0.65, 0.76, (k + 0.85) / 5);
        const bMid = sampleBodyStation((tLow + tHigh) / 2, avatar);
        const ax = ellipseAxesFromCircumference(bMid.circ + 0.55, bMid.k);
        const zBack = -ax.b + bMid.zShift - 0.08;
        const xSpan = ax.a * 0.46;
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
  }

  const frontSummary =
    product.category === "dress"
      ? "Square/scoop front bodice & sculpted skirt drape"
      : product.category === "bottom"
      ? "High-waist front rise & tailored leg silhouette"
      : product.category === "outerwear"
      ? "Tailored front lapel/collar & cropped waist line"
      : "Contoured bust & natural waist front cut";

  const backSummary = meta.hasAdjustableBack
    ? "Open lace-up corset back & lower invisible zip"
    : isHoodie
    ? "Draped 3D fleece hood & relaxed drop-shoulder back"
    : isOpenFrontOuterwear
    ? "Tailored center-back vent & structured shoulder yoke"
    : isPants && product.silhouette !== "leggings"
    ? "Sculpted dual back pockets & contoured seat seam"
    : product.category === "dress" || product.silhouette === "mini-skirt"
    ? "Center-back invisible zipper & full 180° hem drape"
    : "Contoured upper-back scoop & spine seam";

  return {
    tBottom,
    tTop,
    gBust,
    gWaist,
    gHips,
    stretchGive,
    hasCorsetBack: Boolean(meta.hasAdjustableBack),
    frontSummary,
    backSummary,
  };
}

/**
 * Generates a full 360° Front & Back 3D parametric body + garment fit scene in real inches
 * for ANY item (top, bottom, dress, outerwear, shoes, accessory) or complete multi-piece outfit!
 */
export function buildParametric3DFitScene(params: {
  avatar: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches" | "skinTone"
  >;
  product: Product;
  selectedSize: string;
  companionProducts?: Product[];
}): Parametric3DMockScene {
  const { avatar, product, selectedSize, companionProducts = [] } = params;
  const H = Math.max(56, Math.min(74, avatar.heightInches || 62));
  const skinHex = avatar.skinTone || "#D9A482";
  const garmentHex =
    product.colorHex && product.colorHex.startsWith("#")
      ? product.colorHex
      : "#C80815";

  const quads: Quad3D[] = [];
  const N_ANG = 40;

  // ==================== 1. BUILD 3D ANATOMICAL BODY + ARMS + ESPRESSO HAIR ====================
  const legStations = 11;
  for (const side of [-1, 1]) {
    for (let i = 0; i < legStations; i++) {
      const t0 = lerp(0.05, 0.455, i / legStations);
      const t1 = lerp(0.05, 0.455, (i + 1) / legStations);
      const s0 = sampleBodyStation(t0, avatar);
      const s1 = sampleBodyStation(t1, avatar);
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

    // Sculpted Bare Arms (so sleeveless dresses, tanks, & corsets look lifelike 360°!)
    const armSegs = 7;
    const shY = 0.818 * H;
    for (let s = 0; s < armSegs; s++) {
      const f0 = s / armSegs;
      const f1 = (s + 1) / armSegs;
      const cx0 = side * (6.15 + f0 * 2.45);
      const cx1 = side * (6.15 + f1 * 2.45);
      const cy0 = shY - f0 * 16.8;
      const cy1 = shY - f1 * 16.8;
      const ar0 = lerp(1.52, 1.05, f0);
      const ar1 = lerp(1.52, 1.05, f1);
      for (let j = 0; j < 10; j++) {
        const u0 = (j / 10) * Math.PI * 2;
        const u1 = ((j + 1) / 10) * Math.PI * 2;
        quads.push({
          p0: { x: cx0 + Math.cos(u0) * ar0 * 0.78, y: cy0, z: Math.sin(u0) * ar0 },
          p1: { x: cx0 + Math.cos(u1) * ar0 * 0.78, y: cy0, z: Math.sin(u1) * ar0 },
          p2: { x: cx1 + Math.cos(u1) * ar1 * 0.78, y: cy1, z: Math.sin(u1) * ar1 },
          p3: { x: cx1 + Math.cos(u0) * ar1 * 0.78, y: cy1, z: Math.sin(u0) * ar1 },
          layer: "body",
          easeInches: 0,
          status: "tailored_ideal",
          baseHex: skinHex,
          vNorm: 0.7,
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

  // Sculpted Head + Flowing Espresso Hair on Crown & Back (so 0° Front AND 180° Back look lifelike!)
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
      const uMid = (u0 + u1) / 2;
      const isCrownOrBackHair = s0 >= 0.72 || Math.sin(uMid) < -0.05;
      const hBoost = isCrownOrBackHair ? 1.07 : 1.0;
      quads.push({
        p0: { x: Math.cos(u0) * rx0 * hBoost, y: t0 * H, z: Math.sin(u0) * rz0 * hBoost + 0.15 },
        p1: { x: Math.cos(u1) * rx0 * hBoost, y: t0 * H, z: Math.sin(u1) * rz0 * hBoost + 0.15 },
        p2: { x: Math.cos(u1) * rx1 * hBoost, y: t1 * H, z: Math.sin(u1) * rz1 * hBoost + 0.15 },
        p3: { x: Math.cos(u0) * rx1 * hBoost, y: t1 * H, z: Math.sin(u0) * rz1 * hBoost + 0.15 },
        layer: "body",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: isCrownOrBackHair ? "#201715" : skinHex,
        vNorm: t0,
        uAngle: u0,
      });
    }
  }

  // Cascading Back & Side-Framing Espresso Hair Waves (frames face/shoulders at 0° Front AND cascades cleanly at 180° Back!)
  for (let hr = 0; hr < 6; hr++) {
    const hf0 = hr / 6;
    const hf1 = (hr + 1) / 6;
    const hy0 = lerp(0.805 * H, 0.945 * H, hf0);
    const hy1 = lerp(0.805 * H, 0.945 * H, hf1);
    const hw0 = lerp(3.55, 2.85, hf0);
    const hw1 = lerp(3.55, 2.85, hf1);
    const hz0 = -lerp(2.55, 3.05, hf0);
    const hz1 = -lerp(2.55, 3.05, hf1);
    for (let j = 0; j < 12; j++) {
      // Spans from right temple (0.88π) around back (1.5π) to left temple (2.12π) so hair frames neck & shoulders from Front 0° too!
      const a0 = Math.PI * 0.88 + (j / 12) * Math.PI * 1.24;
      const a1 = Math.PI * 0.88 + ((j + 1) / 12) * Math.PI * 1.24;
      const wave = 0.14 * Math.sin(j * 1.8 + hr);
      quads.push({
        p0: { x: Math.cos(a0) * hw0, y: hy0, z: Math.sin(a0) * 1.35 + hz0 * 0.52 + wave },
        p1: { x: Math.cos(a1) * hw0, y: hy0, z: Math.sin(a1) * 1.35 + hz0 * 0.52 + wave },
        p2: { x: Math.cos(a1) * hw1, y: hy1, z: Math.sin(a1) * 1.35 + hz1 * 0.52 + wave },
        p3: { x: Math.cos(a0) * hw1, y: hy1, z: Math.sin(a0) * 1.35 + hz1 * 0.52 + wave },
        layer: "body",
        easeInches: 0,
        status: "tailored_ideal",
        baseHex: "#201715",
        vNorm: 0.9,
        uAngle: Math.PI * 1.5,
      });
    }
  }

  // ==================== 2. ASSEMBLE COMPLETE OUTFIT LAYERS ====================
  const allItems = [product, ...companionProducts.filter((c) => c.id !== product.id)];
  const hasDress = allItems.some((i) => i.category === "dress");
  const hasTop = allItems.some((i) => i.category === "top");
  const hasOuterwear = allItems.some((i) => i.category === "outerwear");
  const hasBottom = allItems.some((i) => i.category === "bottom");
  const shoeItem = allItems.find((i) => i.category === "shoes");
  const bagItem = allItems.find((i) => i.category === "accessory");

  // Add subtle neutral studio base shorts/bandeau if customer is inspecting a standalone top, bottom, shoe, or bag
  if (!hasDress && !hasBottom) {
    appendApparelGarmentShell({
      quads,
      H,
      avatar,
      product: {
        ...product,
        id: "studio-base-shorts",
        title: "Studio High-Waist Bike Shorts",
        category: "bottom",
        silhouette: "mini-skirt",
        colorHex: "#232428",
        fitMetadata: {
          descriptionSummary: "Studio base shorts",
          fitNotes: [],
          stretchLevel: "high",
          cutType: "fitted",
          storeFitTendency: "true_to_size",
          hemLanding: "mini",
        },
        sizeChartInches: {},
      },
      selectedSize: "S",
      isNeutralBaseLayer: true,
    });
  }
  if (!hasDress && !hasTop && !hasOuterwear) {
    appendApparelGarmentShell({
      quads,
      H,
      avatar,
      product: {
        ...product,
        id: "studio-base-bandeau",
        title: "Studio Seamless Bandeau Tank",
        category: "top",
        silhouette: "crop-tank",
        colorHex: "#232428",
        fitMetadata: {
          descriptionSummary: "Studio base tank",
          fitNotes: [],
          stretchLevel: "high",
          cutType: "fitted",
          storeFitTendency: "true_to_size",
          hemLanding: "cropped",
        },
        sizeChartInches: {},
      },
      selectedSize: "S",
      isNeutralBaseLayer: true,
    });
  }

  // Render companion apparel pieces first, then primary product (with outer radial offset for outerwear)
  let primaryStats = {
    tBottom: 0.385,
    tTop: 0.795,
    gBust: avatar.bustInches + 1,
    gWaist: avatar.waistInches + 0.8,
    gHips: avatar.hipsInches + 1.4,
    stretchGive: 1.15,
    hasCorsetBack: false,
    frontSummary: "Front 0° Avatar Fit",
    backSummary: "Back 180° Avatar Fit",
  };

  for (const comp of companionProducts) {
    if (comp.id === product.id) continue;
    if (
      comp.category === "dress" ||
      comp.category === "top" ||
      comp.category === "bottom" ||
      comp.category === "outerwear"
    ) {
      appendApparelGarmentShell({
        quads,
        H,
        avatar,
        product: comp,
        selectedSize,
        radialOffsetInches: comp.category === "outerwear" ? 0.24 : 0,
      });
    }
  }

  if (
    product.category === "dress" ||
    product.category === "top" ||
    product.category === "bottom" ||
    product.category === "outerwear"
  ) {
    primaryStats = appendApparelGarmentShell({
      quads,
      H,
      avatar,
      product,
      selectedSize,
      radialOffsetInches:
        product.category === "outerwear" && (hasTop || hasDress) ? 0.24 : 0,
    });
  }

  // Footwear (either explicit shoe item or clean studio heels/flats)
  if (shoeItem) {
    const shoeNotes = appendShoeMesh(quads, H, shoeItem);
    if (product.category === "shoes") {
      primaryStats = {
        ...primaryStats,
        tBottom: 0.04,
        tTop: 0.22,
        frontSummary: shoeNotes.front,
        backSummary: shoeNotes.back,
      };
    }
  } else {
    appendShoeMesh(quads, H, {
      ...product,
      id: "studio-neutral-heel",
      title: "Studio Minimalist Ankle-Strap Heels",
      category: "shoes",
      silhouette: "ballet-flats",
      colorHex: "#1E1F23",
      accentHex: "#D4AF37",
    });
  }

  if (bagItem) {
    const bagNotes = appendBagMesh(quads, H, avatar, bagItem);
    if (product.category === "accessory") {
      primaryStats = {
        ...primaryStats,
        tBottom: 0.56,
        tTop: 0.85,
        frontSummary: bagNotes.front,
        backSummary: bagNotes.back,
      };
    }
  }

  // ==================== 3. BUILD 3D MEASUREMENT CALIPER RINGS ====================
  const ringDefs: Array<{ label: string; t: number; bodyC: number; gC: number }> = [
    { label: "Bust", t: 0.745, bodyC: avatar.bustInches, gC: primaryStats.gBust },
    { label: "Waist", t: 0.635, bodyC: avatar.waistInches, gC: primaryStats.gWaist },
    { label: "Hips", t: 0.525, bodyC: avatar.hipsInches, gC: primaryStats.gHips },
  ];

  const caliperRings: CaliperRing3D[] = ringDefs
    .filter(
      (rd) =>
        product.category === "shoes" ||
        product.category === "accessory" ||
        (rd.t >= primaryStats.tBottom - 0.04 && rd.t <= primaryStats.tTop + 0.04)
    )
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
        status: classifyEaseStatus(easeVal, primaryStats.stretchGive),
        points: pts,
      };
    });

  const modelH = product.fitMetadata?.modelStats?.heightInches || 68;
  const heightDiff = modelH - H;
  const storeModelRelativeHemYInches =
    product.category !== "shoes" &&
    product.category !== "accessory" &&
    Math.abs(heightDiff) >= 1.5
      ? Number((primaryStats.tBottom * H + heightDiff * 0.58).toFixed(1))
      : undefined;

  return {
    quads,
    caliperRings,
    storeModelRelativeHemYInches,
    customerHemYInches: Number((primaryStats.tBottom * H).toFixed(1)),
    totalHeightInches: H,
    garmentColorHex: garmentHex,
    hasCorsetBack: primaryStats.hasCorsetBack,
    stretchGiveInches: primaryStats.stretchGive,
    frontFeatureSummary: primaryStats.frontSummary,
    backFeatureSummary: primaryStats.backSummary,
  };
}

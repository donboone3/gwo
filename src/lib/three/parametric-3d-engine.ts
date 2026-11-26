import * as THREE from "three";
import { Product } from "../types";
import { analyzeExactAvatarFit, AvatarExactFitReport, ZoneFeel } from "../catalog/fit-intelligence";
import { BodyScanDimensions } from "./body-scan-analyzer";

export type Render3DVisualMode = "studio" | "heatmap" | "xray";

export interface Worn3DPieceSpec {
  product: Product;
  selectedSize?: string;
  isOwnedInCloset?: boolean;
}

export interface Avatar3DBuildResult {
  root: THREE.Group;
  totalHeightUnits: number;
  hipCenterY: number;
  bustY: number;
  waistY: number;
  hipsY: number;
  fitByProductId: Map<string, AvatarExactFitReport>;
  interactiveMeshes: THREE.Object3D[];
}

// 1 Three.js world unit = 10 real inches (e.g., 62" = 6.20 units)
const IN_TO_UNIT = 0.1;

const TEXTURE_CACHE = new Map<string, THREE.CanvasTexture>();
const NORMAL_MAP_CACHE = new Map<string, THREE.DataTexture>();

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Closed-form inverse Ramanujan ellipse solver:
 * Given exact circumference C (in inches) and width-to-depth ratio k = rx / rz,
 * returns exact semi-axes (rx, rz) in Three.js world units so the 3D cross-section
 * perimeter matches C inches to within 0.02"!
 */
export function solveEllipseSemiAxesUnits(
  circumferenceInches: number,
  widthToDepthRatio: number
): { rx: number; rz: number } {
  const k = clamp(widthToDepthRatio, 0.65, 2.2);
  const h = Math.pow(k - 1, 2) / Math.pow(k + 1, 2);
  const ramanujanFactor =
    Math.PI * (k + 1) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  const rzInches = circumferenceInches / ramanujanFactor;
  const rxInches = rzInches * k;
  return {
    rx: rxInches * IN_TO_UNIT,
    rz: rzInches * IN_TO_UNIT,
  };
}

/**
 * Generates procedural fabric micro-weave normal/bump texture so satin, bouclé tweed,
 * ribbed knit, denim twill, and calfskin leather catch 3D studio lights realistically.
 */
function getFabricNormalMap(
  style: "satin" | "tweed" | "rib" | "denim" | "leather" | "suiting"
): THREE.DataTexture {
  const cached = NORMAL_MAP_CACHE.get(style);
  if (cached) return cached;

  const size = 128;
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let nx = 128;
      let ny = 128;
      if (style === "tweed") {
        const wx = Math.sin((x / size) * Math.PI * 32) * 26;
        const wy = Math.cos((y / size) * Math.PI * 32) * 26;
        const nub = (((x * 17 + y * 31) % 19) - 9) * 1.4;
        nx = clamp(128 + wx + nub, 60, 195);
        ny = clamp(128 + wy - nub, 60, 195);
      } else if (style === "rib") {
        nx = clamp(128 + Math.sin((x / size) * Math.PI * 48) * 32, 55, 200);
        ny = 128;
      } else if (style === "denim") {
        const diag = Math.sin(((x + y) / size) * Math.PI * 44) * 20;
        nx = clamp(128 + diag, 75, 180);
        ny = clamp(128 - diag * 0.7, 75, 180);
      } else if (style === "leather") {
        const grain =
          Math.sin(x * 0.65) * Math.cos(y * 0.65) * 14 +
          Math.sin((x + y) * 1.3) * 7;
        nx = clamp(128 + grain, 85, 172);
        ny = clamp(128 - grain, 85, 172);
      } else if (style === "suiting") {
        nx = clamp(128 + Math.sin(x * 1.4) * 8, 105, 150);
        ny = clamp(128 + Math.cos(y * 1.4) * 8, 105, 150);
      } else {
        nx = clamp(128 + Math.sin(x * 0.5 + y * 0.25) * 4, 118, 138);
        ny = 128;
      }
      const i = (y * size + x) * 4;
      d[i] = nx;
      d[i + 1] = ny;
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(d, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 5);
  tex.needsUpdate = true;
  NORMAL_MAP_CACHE.set(style, tex);
  return tex;
}

/**
 * Asynchronously loads a product's real isolated garment photo, removes white studio borders,
 * blends seamlessly into the garment base colorHex so 360° UV seams never show white edges,
 * and updates any subscribed MeshPhysicalMaterials on decode!
 */
export function bindRealProductTexture(
  product: Product,
  material: THREE.MeshPhysicalMaterial,
  onUpdated?: () => void
): void {
  if (typeof document === "undefined" || !product.imageUrl) return;
  const key = `${product.id}:${product.imageUrl}`;
  const existing = TEXTURE_CACHE.get(key);
  if (existing) {
    material.map = existing;
    material.color.set("#ffffff");
    material.needsUpdate = true;
    onUpdated?.();
    return;
  }

  const img = new Image();
  if (!product.imageUrl.startsWith("data:") && !product.imageUrl.startsWith("/")) {
    img.crossOrigin = "anonymous";
  }
  img.decoding = "async";
  img.onload = () => {
    const S = 256;
    const tmp = document.createElement("canvas");
    tmp.width = S;
    tmp.height = S;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(img, 0, 0, S, S);
    const src = tctx.getImageData(0, 0, S, S);
    const sd = src.data;

    // Detect non-white garment bounding box
    let x0 = S;
    let x1 = 0;
    let y0 = S;
    let y1 = 0;
    for (let y = 4; y < S - 4; y++) {
      for (let x = 4; x < S - 4; x++) {
        const i = (y * S + x) * 4;
        const r = sd[i];
        const g = sd[i + 1];
        const b = sd[i + 2];
        const a = sd[i + 3];
        if (a > 40 && !(r > 236 && g > 236 && b > 236)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }

    const baseCol = new THREE.Color(product.colorHex || "#2A2C32");
    const br = Math.round(baseCol.r * 255);
    const bg = Math.round(baseCol.g * 255);
    const bb = Math.round(baseCol.b * 255);

    const out = document.createElement("canvas");
    out.width = S;
    out.height = S;
    const octx = out.getContext("2d");
    if (!octx) return;

    // Fill background with rich garment colorHex
    octx.fillStyle = `rgb(${br},${bg},${bb})`;
    octx.fillRect(0, 0, S, S);

    if (x1 - x0 > 24 && y1 - y0 > 24) {
      // Sample center swatch of the real garment fabric so wrap-around sides match real fabric tone!
      const cx0 = Math.floor(x0 + (x1 - x0) * 0.25);
      const cx1 = Math.ceil(x0 + (x1 - x0) * 0.75);
      const cy0 = Math.floor(y0 + (y1 - y0) * 0.25);
      const cy1 = Math.ceil(y0 + (y1 - y0) * 0.75);

      // Tile the inner garment fabric softly across background first, then draw front/back panels
      octx.drawImage(
        tmp,
        cx0,
        cy0,
        Math.max(8, cx1 - cx0),
        Math.max(8, cy1 - cy0),
        0,
        0,
        S,
        S
      );

      // Replace any near-white studio pixels with garment base color so zero white halo appears
      const outData = octx.getImageData(0, 0, S, S);
      const od = outData.data;
      for (let p = 0; p < od.length; p += 4) {
        const lum = (od[p] + od[p + 1] + od[p + 2]) / 3;
        const sat =
          Math.max(od[p], od[p + 1], od[p + 2]) -
          Math.min(od[p], od[p + 1], od[p + 2]);
        // Only replace bright studio white background when garment itself isn't ivory/white
        const garmentIsLight = (br + bg + bb) / 3 > 210;
        if (!garmentIsLight && lum > 228 && sat < 18) {
          od[p] = br;
          od[p + 1] = bg;
          od[p + 2] = bb;
        }
      }
      octx.putImageData(outData, 0, 0);
    }

    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    TEXTURE_CACHE.set(key, tex);

    material.map = tex;
    material.color.set("#ffffff");
    material.needsUpdate = true;
    onUpdated?.();
  };
  img.src = product.imageUrl;
}

function feelToHeatmapRgb(feel: ZoneFeel): THREE.Color {
  switch (feel) {
    case "too_tight":
      return new THREE.Color("#EF4444"); // Coral Red warning
    case "sculpted_snug":
      return new THREE.Color("#F59E0B"); // Warm Gold sculpted hold
    case "tailored_ideal":
      return new THREE.Color("#10B981"); // Emerald Safe Fit
    case "relaxed_skim":
      return new THREE.Color("#06B6D4"); // Teal Relaxed Skim
    case "oversized_roomy":
    default:
      return new THREE.Color("#6366F1"); // Indigo Roomy Drape
  }
}

function detectFabricStyle(
  product: Product
): "satin" | "tweed" | "rib" | "denim" | "leather" | "suiting" {
  const txt = `${product.title} ${product.fitMetadata?.fabricComposition || ""}`.toLowerCase();
  if (/tweed|boucl/.test(txt)) return "tweed";
  if (/denim|jean/.test(txt)) return "denim";
  if (/leather|calfskin|boot|bag|tote|belt|slingback/.test(txt)) return "leather";
  if (/rib|knit|cardigan|legging|tank|nylon/.test(txt)) return "rib";
  if (/satin|silk|corset/.test(txt)) return "satin";
  return "suiting";
}

function createGarmentPhysicalMaterial(
  product: Product,
  visualMode: Render3DVisualMode,
  onTextureReady?: () => void
): THREE.MeshPhysicalMaterial {
  const style = detectFabricStyle(product);
  const normalMap = getFabricNormalMap(style);

  if (visualMode === "heatmap") {
    return new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.05,
      clearcoat: 0.15,
      normalMap,
      normalScale: new THREE.Vector2(0.18, 0.18),
      side: THREE.DoubleSide,
    });
  }

  const isSatin = style === "satin";
  const isLeather = style === "leather";
  const isTweedOrKnit = style === "tweed" || style === "rib";

  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(product.colorHex || "#2A2C32"),
    roughness: isSatin ? 0.27 : isLeather ? 0.32 : isTweedOrKnit ? 0.72 : 0.52,
    metalness: /gold|14k/i.test(product.colorName + " " + product.title) ? 0.78 : 0.04,
    sheen: isSatin ? 0.85 : isTweedOrKnit ? 0.45 : 0.25,
    sheenRoughness: isSatin ? 0.25 : 0.6,
    sheenColor: new THREE.Color("#ffffff"),
    clearcoat: isLeather ? 0.38 : isSatin ? 0.18 : 0.04,
    clearcoatRoughness: 0.28,
    normalMap,
    normalScale: new THREE.Vector2(
      isTweedOrKnit ? 0.42 : isLeather ? 0.26 : 0.16,
      isTweedOrKnit ? 0.42 : isLeather ? 0.26 : 0.16
    ),
    transparent: visualMode === "xray",
    opacity: visualMode === "xray" ? 0.56 : 1,
    depthWrite: visualMode !== "xray",
    side: THREE.DoubleSide,
  });

  if (visualMode === "studio") {
    bindRealProductTexture(product, mat, onTextureReady);
  }
  return mat;
}

interface BodyCrossSectionFn {
  (y: number, theta: number): { x: number; z: number; rx: number; rz: number };
}

/**
 * Builds the continuous parametric female body evaluator from exact scanned inches.
 */
function createAnatomicalProfileEvaluator(dims: BodyScanDimensions, heelLiftUnits: number) {
  const totalBodyH = dims.heightInches * IN_TO_UNIT;
  const footBaseY = heelLiftUnits;
  const inseamU = clamp(dims.inseamInches * IN_TO_UNIT, totalBodyH * 0.41, totalBodyH * 0.51);
  const crotchY = footBaseY + inseamU;
  const neckTopY = footBaseY + totalBodyH * 0.855;
  const torsoSpan = neckTopY - crotchY;

  const hipY = crotchY + torsoSpan * 0.14;
  const waistY = crotchY + torsoSpan * 0.45;
  const underbustY = crotchY + torsoSpan * 0.61;
  const bustY = crotchY + torsoSpan * 0.71;
  const shoulderY = crotchY + torsoSpan * 0.855;
  const neckBaseY = crotchY + torsoSpan * 0.915;

  const hipAxes = solveEllipseSemiAxesUnits(dims.hipsInches, 1.36);
  const waistAxes = solveEllipseSemiAxesUnits(dims.waistInches, 1.32);
  const underbustAxes = solveEllipseSemiAxesUnits(dims.underbustInches, 1.34);
  const bustAxes = solveEllipseSemiAxesUnits(dims.bustInches, 1.24);
  const shoulderHalfW = (dims.shoulderInches * IN_TO_UNIT) * 0.5;

  // Extra anterior bust cup projection proportional to cup fullness (bust - underbust)
  const cupDiffIn = clamp(dims.bustInches - dims.underbustInches, 2.0, 10.5);
  const cupProjectionU = (0.048 + (cupDiffIn - 2.0) * 0.014);

  const keyY = [
    crotchY - 0.08,
    crotchY,
    hipY,
    lerp(hipY, waistY, 0.55),
    waistY,
    underbustY,
    bustY,
    shoulderY,
    neckBaseY,
    neckTopY,
  ];
  const keyRx = [
    hipAxes.rx * 0.84,
    hipAxes.rx * 0.93,
    hipAxes.rx,
    lerp(hipAxes.rx, waistAxes.rx, 0.42),
    waistAxes.rx,
    underbustAxes.rx,
    bustAxes.rx * 0.96,
    shoulderHalfW,
    0.205,
    0.182,
  ];
  const keyRz = [
    hipAxes.rz * 0.82,
    hipAxes.rz * 0.92,
    hipAxes.rz,
    lerp(hipAxes.rz, waistAxes.rz, 0.48),
    waistAxes.rz,
    underbustAxes.rz,
    underbustAxes.rz * 1.03,
    underbustAxes.rz * 0.76,
    0.205,
    0.185,
  ];

  const sampleBaseAxes = (y: number): { rx: number; rz: number } => {
    if (y <= keyY[0]) return { rx: keyRx[0], rz: keyRz[0] };
    const last = keyY.length - 1;
    if (y >= keyY[last]) return { rx: keyRx[last], rz: keyRz[last] };
    for (let i = 0; i < last; i++) {
      if (y >= keyY[i] && y <= keyY[i + 1]) {
        const t = smoothstep(keyY[i], keyY[i + 1], y);
        return {
          rx: lerp(keyRx[i], keyRx[i + 1], t),
          rz: lerp(keyRz[i], keyRz[i + 1], t),
        };
      }
    }
    return { rx: waistAxes.rx, rz: waistAxes.rz };
  };

  const evalTorsoSection: BodyCrossSectionFn = (y: number, theta: number) => {
    const { rx, rz } = sampleBaseAxes(y);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta); // +1 = front (+z), -1 = back (-z)

    let x = rx * cosT;
    let z = rz * sinT;

    // 1. Sculpted anterior dual bust contour around bustY (front +z)
    const bustBand =
      smoothstep(underbustY - 0.04, bustY, y) *
      (1 - smoothstep(bustY, shoulderY - 0.02, y));
    if (bustBand > 0.001 && sinT > 0.05) {
      // Left & right natural bust mounds centered at cosT = ±0.48
      const lobeL = Math.exp(-Math.pow((cosT - 0.46) / 0.36, 2));
      const lobeR = Math.exp(-Math.pow((cosT + 0.46) / 0.36, 2));
      const centerBridge = Math.exp(-Math.pow(cosT / 0.22, 2)) * 0.28;
      const cup = (lobeL + lobeR + centerBridge) * Math.pow(sinT, 1.15);
      z += cupProjectionU * bustBand * cup;
    }

    // 2. Sculpted posterior glute contour around hipY (back -z)
    const gluteBand =
      smoothstep(crotchY - 0.06, hipY, y) *
      (1 - smoothstep(hipY + 0.04, waistY - 0.04, y));
    if (gluteBand > 0.001 && sinT < -0.05) {
      const gluteL = Math.exp(-Math.pow((cosT - 0.42) / 0.38, 2));
      const gluteR = Math.exp(-Math.pow((cosT + 0.42) / 0.38, 2));
      z -= 0.068 * gluteBand * (gluteL + gluteR) * Math.abs(sinT);
    }

    // 3. Subtle natural spine indentation along upper/mid back
    const spineBand =
      smoothstep(waistY - 0.08, waistY + 0.1, y) *
      (1 - smoothstep(bustY + 0.08, neckBaseY, y));
    if (spineBand > 0.01 && sinT < -0.75) {
      const groove = Math.exp(-Math.pow(cosT / 0.14, 2));
      z += 0.018 * spineBand * groove;
    }

    return { x, z, rx, rz };
  };

  return {
    totalBodyH,
    footBaseY,
    crotchY,
    hipY,
    waistY,
    underbustY,
    bustY,
    shoulderY,
    neckBaseY,
    neckTopY,
    hipAxes,
    waistAxes,
    bustAxes,
    shoulderHalfW,
    evalTorsoSection,
  };
}

function buildLoftedSurface(
  yMin: number,
  yMax: number,
  rings: number,
  radialSegs: number,
  pointAt: (y: number, u: number, v: number) => { x: number; y: number; z: number },
  colorAt?: (y: number, u: number, v: number) => THREE.Color
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  for (let iy = 0; iy <= rings; iy++) {
    const v = iy / rings;
    const y = lerp(yMin, yMax, v);
    for (let ix = 0; ix <= radialSegs; ix++) {
      const u = ix / radialSegs;
      const p = pointAt(y, u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      if (colorAt) {
        const c = colorAt(y, u, v);
        colors.push(c.r, c.g, c.b);
      }
    }
  }

  const stride = radialSegs + 1;
  for (let iy = 0; iy < rings; iy++) {
    for (let ix = 0; ix < radialSegs; ix++) {
      const a = iy * stride + ix;
      const b = a + 1;
      const c = (iy + 1) * stride + ix;
      const d = c + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  if (colorAt) {
    geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  }
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

/**
 * Builds sculpted anatomical leg + foot geometry for side = -1 (right of viewer / left leg) or +1.
 */
function buildAnatomicalLeg(
  side: -1 | 1,
  footBaseY: number,
  crotchY: number,
  hipAxes: { rx: number; rz: number },
  skinMat: THREE.Material
): { group: THREE.Group; anklePos: THREE.Vector3; hipX: number } {
  const group = new THREE.Group();
  const hipX = side * hipAxes.rx * 0.48;
  const ankleX = side * hipAxes.rx * 0.34;
  const ankleY = footBaseY + 0.32;
  const kneeY = lerp(ankleY, crotchY, 0.52);

  const thighTopR = hipAxes.rx * 0.48;
  const kneeR = thighTopR * 0.62;
  const calfR = thighTopR * 0.66;
  const ankleR = thighTopR * 0.39;

  const legGeom = buildLoftedSurface(
    ankleY,
    crotchY + 0.12,
    46,
    36,
    (y, u) => {
      const theta = u * Math.PI * 2;
      const t = clamp((y - ankleY) / Math.max(0.1, crotchY + 0.12 - ankleY), 0, 1);

      const cx = lerp(ankleX, hipX, smoothstep(0, 1, t));
      let cz = 0;
      let rX = ankleR;
      let rZ = ankleR * 1.06;

      if (y < kneeY) {
        const kt = (y - ankleY) / Math.max(0.05, kneeY - ankleY);
        // Sculpted gastrocnemius calf curve peaking at kt ~ 0.62
        const calfSwelling = Math.sin(Math.pow(kt, 0.85) * Math.PI);
        rX = lerp(ankleR, kneeR, kt) + calfSwelling * (calfR - kneeR) * 0.9;
        rZ = rX * 1.08;
        cz = -calfSwelling * 0.032; // natural calf curve backward
      } else {
        const tt = (y - kneeY) / Math.max(0.05, crotchY + 0.12 - kneeY);
        rX = lerp(kneeR, thighTopR, Math.pow(tt, 0.88));
        rZ = lerp(kneeR * 1.05, hipAxes.rz * 0.72, Math.pow(tt, 0.88));
        cz = Math.sin(tt * Math.PI) * 0.018;
      }

      return {
        x: cx + rX * Math.cos(theta),
        y,
        z: cz + rZ * Math.sin(theta),
      };
    }
  );
  group.add(new THREE.Mesh(legGeom, skinMat));

  // Sculpted Foot
  const footGroup = new THREE.Group();
  footGroup.position.set(ankleX, footBaseY + 0.12, 0.14);
  const footGeom = new THREE.SphereGeometry(0.15, 24, 18);
  footGeom.scale(0.76, 0.68, 1.85);
  const footMesh = new THREE.Mesh(footGeom, skinMat);
  footGroup.add(footMesh);
  group.add(footGroup);

  return {
    group,
    anklePos: new THREE.Vector3(ankleX, footBaseY, 0),
    hipX,
  };
}

/**
 * Builds posed sculpted arm + hand, returning wrist/hand & shoulder anchors for 3D Handbag attachment!
 */
function buildPosedArm(
  side: -1 | 1,
  shoulderY: number,
  shoulderHalfW: number,
  torsoSpan: number,
  holdingBagMode: "none" | "hand-tote" | "shoulder-bag",
  skinMat: THREE.Material
): {
  group: THREE.Group;
  handWorldPos: THREE.Vector3;
  shoulderWorldPos: THREE.Vector3;
} {
  const group = new THREE.Group();
  const sx = side * Math.max(0.42, shoulderHalfW - 0.045);
  const sy = shoulderY - 0.055;
  const armLen = torsoSpan * 0.85;

  const p0 = new THREE.Vector3(sx, sy, 0.0);
  let p1: THREE.Vector3;
  let p2: THREE.Vector3;

  if (holdingBagMode === "hand-tote") {
    // Graceful bent forearm carrying a 3D Tote / Mini Top-Handle Bag!
    p1 = new THREE.Vector3(
      sx + side * 0.14,
      sy - armLen * 0.48,
      -0.03
    );
    p2 = new THREE.Vector3(
      sx + side * 0.16,
      sy - armLen * 0.68,
      0.34
    );
  } else if (holdingBagMode === "shoulder-bag") {
    // Chic runway pose with hand resting lightly near shoulder-bag front!
    p1 = new THREE.Vector3(
      sx + side * 0.19,
      sy - armLen * 0.46,
      -0.04
    );
    p2 = new THREE.Vector3(
      sx + side * 0.11,
      sy - armLen * 0.76,
      0.24
    );
  } else {
    // Relaxed editorial runway arm pose
    p1 = new THREE.Vector3(
      sx + side * 0.13,
      sy - armLen * 0.48,
      -0.02
    );
    p2 = new THREE.Vector3(
      sx + side * 0.15,
      sy - armLen * 0.95,
      0.08
    );
  }

  const curve = new THREE.CatmullRomCurve3([p0, p1, p2]);
  const segs = 36;
  const radSegs = 22;
  const frames = curve.computeFrenetFrames(segs, false);

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    // Taper from deltoid (0.145) -> elbow (0.105) -> wrist (0.072)
    const r = lerp(0.142, 0.072, Math.pow(t, 0.78));
    for (let j = 0; j <= radSegs; j++) {
      const ang = (j / radSegs) * Math.PI * 2;
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);
      positions.push(
        pt.x + r * (cosA * N.x + sinA * B.x),
        pt.y + r * (cosA * N.y + sinA * B.y),
        pt.z + r * (cosA * N.z + sinA * B.z)
      );
      uvs.push(j / radSegs, t);
    }
  }

  const stride = radSegs + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radSegs; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = (i + 1) * stride + j;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const armGeom = new THREE.BufferGeometry();
  armGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  armGeom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  armGeom.setIndex(indices);
  armGeom.computeVertexNormals();
  group.add(new THREE.Mesh(armGeom, skinMat));

  // Smooth organic deltoid blend
  const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.132, 20, 16), skinMat);
  shoulderCap.scale.set(0.88, 0.95, 0.85);
  shoulderCap.position.copy(p0);
  group.add(shoulderCap);

  // Sculpted hand
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), skinMat);
  hand.scale.set(0.75, 1.35, 0.55);
  hand.position.copy(p2).add(new THREE.Vector3(0, -0.05, 0.02));
  group.add(hand);

  return {
    group,
    handWorldPos: p2.clone(),
    shoulderWorldPos: new THREE.Vector3(sx * 0.76, shoulderY + 0.03, 0.02),
  };
}

/**
 * Builds sculpted feminine head, expressive facial features, optional selfie portrait projection,
 * and luxurious 3D hairstyle so all 360° angles look lifelike and stylish.
 */
function buildFeminineHeadAndHair(
  neckTopY: number,
  dims: BodyScanDimensions,
  skinMat: THREE.Material,
  faceOvalDataUrl?: string | null,
  onTextureReady?: () => void
): THREE.Group {
  const headGroup = new THREE.Group();
  const headCenterY = neckTopY + 0.37;
  headGroup.position.set(0, headCenterY, 0.02);

  // Sculpted feminine oval head with tapered jawline & subtle cheekbones
  const headGeom = new THREE.SphereGeometry(0.36, 42, 36);
  const pos = headGeom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    y *= 1.24; // Vertical oval proportion
    x *= 0.92;
    z *= 1.02;

    // Taper lower jaw & chin smoothly for feminine V-oval face
    if (y < 0) {
      const jt = clamp(-y / 0.44, 0, 1);
      x *= lerp(1.0, 0.62, Math.pow(jt, 1.25));
      z *= lerp(1.0, 0.78, Math.pow(jt, 1.35));
      if (z > 0) z += Math.pow(jt, 1.6) * 0.035; // Delicate chin projection
    }

    // Subtle nose bridge on front centerline
    if (z > 0.22 && Math.abs(x) < 0.075 && y > -0.14 && y < 0.08) {
      const nx = 1 - Math.abs(x) / 0.075;
      const ny = Math.sin(((y + 0.14) / 0.22) * Math.PI);
      z += nx * ny * 0.055;
    }

    pos.setXYZ(i, x, y, z);
  }
  headGeom.computeVertexNormals();
  headGroup.add(new THREE.Mesh(headGeom, skinMat));

  // Optional mapped selfie face decal on front face when user scanned a selfie
  if (faceOvalDataUrl && typeof document !== "undefined") {
    const facePlaneGeom = new THREE.SphereGeometry(
      0.366,
      28,
      24,
      Math.PI * 0.27,
      Math.PI * 0.46,
      Math.PI * 0.32,
      Math.PI * 0.46
    );
    facePlaneGeom.scale(0.9, 1.2, 1.03);
    facePlaneGeom.rotateY(-Math.PI * 0.5);
    const faceMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      faceMat.map = tex;
      faceMat.needsUpdate = true;
      onTextureReady?.();
    };
    img.src = faceOvalDataUrl;
    const faceMesh = new THREE.Mesh(facePlaneGeom, faceMat);
    faceMesh.position.set(0, -0.02, 0.03);
    headGroup.add(faceMesh);
  } else {
    // Expressive sculpted studio eyes, lashes, brows & soft rose lips
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: "#FAF8F6", roughness: 0.25 });
    const irisMat = new THREE.MeshStandardMaterial({ color: "#3A261B", roughness: 0.15 });
    const lashMat = new THREE.MeshStandardMaterial({ color: "#1C1614", roughness: 0.5 });
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: "#B96A6E",
      roughness: 0.32,
      clearcoat: 0.35,
    });

    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), eyeWhiteMat);
      eye.scale.set(1.35, 0.82, 0.55);
      eye.position.set(s * 0.115, 0.035, 0.335);
      headGroup.add(eye);

      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.023, 14, 12), irisMat);
      iris.scale.set(1.0, 1.0, 0.5);
      iris.position.set(s * 0.115, 0.035, 0.353);
      headGroup.add(iris);

      // Upper lash / liner arc
      const lash = new THREE.Mesh(
        new THREE.TorusGeometry(0.044, 0.0065, 8, 16, Math.PI * 0.85),
        lashMat
      );
      lash.position.set(s * 0.115, 0.038, 0.348);
      lash.rotation.z = Math.PI * 0.08;
      headGroup.add(lash);

      // Arched brow
      const brow = new THREE.Mesh(
        new THREE.TorusGeometry(0.062, 0.0085, 8, 16, Math.PI * 0.72),
        lashMat
      );
      brow.position.set(s * 0.12, 0.078, 0.334);
      brow.rotation.z = s > 0 ? 0.12 : 0.24;
      headGroup.add(brow);
    }

    // Soft sculpted lips
    const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), lipMat);
    upperLip.scale.set(1.55, 0.38, 0.55);
    upperLip.position.set(0, -0.155, 0.332);
    headGroup.add(upperLip);

    const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.048, 18, 12), lipMat);
    lowerLip.scale.set(1.42, 0.45, 0.58);
    lowerLip.position.set(0, -0.178, 0.33);
    headGroup.add(lowerLip);
  }

  // Luxurious 3D Hair Volume
  const hairHex =
    dims.hairStyle === "sleek-bun-blonde"
      ? "#D8BA8C"
      : dims.hairStyle === "straight-auburn"
      ? "#6E3021"
      : dims.hairStyle === "curls-warm"
      ? "#3B2418"
      : "#1E1817";

  const hairMat = new THREE.MeshPhysicalMaterial({
    color: hairHex,
    roughness: 0.44,
    sheen: 0.65,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color("#8B6E5B"),
  });

  // Crown & back cranial hair shell (tilted backward so forehead, brows & eyes stay 100% open!)
  const crownGeom = new THREE.SphereGeometry(
    0.382,
    36,
    28,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.48
  );
  crownGeom.scale(1.0, 1.24, 1.08);
  const crown = new THREE.Mesh(crownGeom, hairMat);
  crown.position.set(0, 0.06, -0.04);
  crown.rotation.x = -0.48;
  headGroup.add(crown);

  if (dims.hairStyle === "sleek-bun-blonde") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 20), hairMat);
    bun.position.set(0, 0.05, -0.42);
    headGroup.add(bun);
  } else {
    // Flowing layered waves cascading down back & framing shoulders
    const backHairGeom = buildLoftedSurface(-0.78, 0.16, 28, 24, (y, u) => {
      const ang = lerp(Math.PI * 1.08, Math.PI * 1.92, u); // Back arc (-z)
      const t = (0.16 - y) / 0.94;
      const wave = Math.sin(t * Math.PI * 3.2 + u * 5) * 0.024;
      const rx = lerp(0.35, 0.46, smoothstep(0, 0.7, t));
      const rz = lerp(0.36, 0.28, t);
      return {
        x: rx * Math.cos(ang),
        y,
        z: rz * Math.sin(ang) - t * 0.06 + wave,
      };
    });
    headGroup.add(new THREE.Mesh(backHairGeom, hairMat));

    // Face-framing front side tresses
    for (const s of [-1, 1]) {
      const strandCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.12, 0.42, 0.22),
        new THREE.Vector3(s * 0.33, 0.14, 0.18),
        new THREE.Vector3(s * 0.36, -0.22, 0.14),
        new THREE.Vector3(s * 0.32, -0.58, 0.16),
      ]);
      const strandGeom = new THREE.TubeGeometry(strandCurve, 24, 0.068, 12, false);
      strandGeom.scale(0.85, 1, 0.55);
      headGroup.add(new THREE.Mesh(strandGeom, hairMat));
    }
  }

  return headGroup;
}

/**
 * Builds a real 3D Handbag mesh (Crescent Bag, Structured Turnlock Tote, Quilted Chain Bag, or Pearl Mini Bag)
 * positioned accurately in her posed hand or over her right shoulder!
 */
function build3DHandbagAccessory(
  product: Product,
  handPos: THREE.Vector3,
  shoulderPos: THREE.Vector3,
  visualMode: Render3DVisualMode,
  onTextureReady?: () => void
): THREE.Group {
  const bagGroup = new THREE.Group();
  bagGroup.userData.product = product;

  const leatherMat = createGarmentPhysicalMaterial(product, visualMode, onTextureReady);
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: "#DFBD69",
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.4,
  });
  const pearlMat = new THREE.MeshPhysicalMaterial({
    color: "#FAF6EE",
    roughness: 0.16,
    clearcoat: 0.85,
  });

  const low = product.title.toLowerCase();
  const isTote = /tote/.test(low);
  const isCrescent = /crescent|hobo/.test(low);
  const isQuilted = /quilted|chain/.test(low);

  if (isTote) {
    // Structured Camel Turnlock Tote hanging from her right wrist/hand!
    const bodyGroup = new THREE.Group();
    bodyGroup.position.set(handPos.x + 0.05, handPos.y - 0.58, handPos.z + 0.03);
    bodyGroup.rotation.y = -0.22;
    bodyGroup.scale.setScalar(1.14);

    // Trapezoid leather tote body
    const toteGeom = buildLoftedSurface(-0.34, 0.34, 16, 32, (y, u) => {
      const ang = u * Math.PI * 2;
      const t = (y + 0.34) / 0.68;
      const halfW = lerp(0.42, 0.37, t);
      const halfD = lerp(0.16, 0.12, t);
      // Rounded-rectangle superellipse
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const pow = 0.42;
      const sx = Math.sign(c) * Math.pow(Math.abs(c), pow) * halfW;
      const sz = Math.sign(s) * Math.pow(Math.abs(s), pow) * halfD;
      return { x: sx, y, z: sz };
    });
    bodyGroup.add(new THREE.Mesh(toteGeom, leatherMat));

    // Top closure flap + gold turnlock hardware
    const baseCap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.28), leatherMat);
    baseCap.position.y = -0.33;
    bodyGroup.add(baseCap);

    const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.04), goldMat);
    clasp.position.set(0, 0.16, 0.14);
    bodyGroup.add(clasp);

    // Dual rolled leather handles looping up over her wrist!
    for (const zOff of [-0.08, 0.08]) {
      const hCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.16, 0.32, zOff),
        new THREE.Vector3(-0.13, 0.6, zOff * 0.6),
        new THREE.Vector3(0, 0.66, 0),
        new THREE.Vector3(0.13, 0.6, zOff * 0.6),
        new THREE.Vector3(0.16, 0.32, zOff),
      ]);
      bodyGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(hCurve, 24, 0.022, 10, false), leatherMat)
      );
    }

    bagGroup.add(bodyGroup);
  } else if (isCrescent || isQuilted) {
    // Shoulder Crescent or Quilted Chain Bag tucked chicly under her right arm with strap over shoulder!
    const bagCenter = new THREE.Vector3(
      shoulderPos.x + 0.18,
      shoulderPos.y - 0.96,
      0.16
    );
    const bodyGroup = new THREE.Group();
    bodyGroup.position.copy(bagCenter);
    bodyGroup.rotation.y = -0.26;
    bodyGroup.scale.setScalar(1.15);

    if (isCrescent) {
      // Sculpted half-moon crescent hobo body
      const crescentCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.28, 0.16, 0),
        new THREE.Vector3(-0.18, -0.12, 0),
        new THREE.Vector3(0, -0.2, 0),
        new THREE.Vector3(0.18, -0.12, 0),
        new THREE.Vector3(0.28, 0.16, 0),
      ]);
      const cGeom = new THREE.TubeGeometry(crescentCurve, 28, 0.12, 16, false);
      cGeom.scale(1.0, 1.15, 0.72);
      bodyGroup.add(new THREE.Mesh(cGeom, leatherMat));

      const goldRingL = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 10, 18), goldMat);
      goldRingL.position.set(-0.27, 0.18, 0);
      bodyGroup.add(goldRingL);
      const goldRingR = goldRingL.clone();
      goldRingR.position.set(0.27, 0.18, 0);
      bodyGroup.add(goldRingR);

      const frontClasp = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 18), goldMat);
      frontClasp.rotation.x = Math.PI / 2;
      frontClasp.position.set(0, -0.05, 0.095);
      bodyGroup.add(frontClasp);
    } else {
      // Quilted Chain Flap Bag
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.17), leatherMat);
      bodyGroup.add(box);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.185), leatherMat);
      flap.position.set(0, 0.08, 0.005);
      bodyGroup.add(flap);
      const turnLock = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.011, 10, 20), goldMat);
      turnLock.position.set(0, 0.0, 0.1);
      bodyGroup.add(turnLock);
    }
    bagGroup.add(bodyGroup);

    // 3D Shoulder Strap looping from bag corners cleanly over her right shoulder!
    const strapCurve = new THREE.CatmullRomCurve3([
      bagCenter.clone().add(new THREE.Vector3(-0.18, 0.16, 0.05)),
      shoulderPos.clone().add(new THREE.Vector3(0.04, 0.05, 0.12)),
      shoulderPos.clone().add(new THREE.Vector3(0.02, 0.07, -0.02)),
      shoulderPos.clone().add(new THREE.Vector3(0.06, 0.03, -0.14)),
      bagCenter.clone().add(new THREE.Vector3(0.16, 0.16, -0.05)),
    ]);
    const strapMat = isQuilted ? goldMat : leatherMat;
    bagGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 32, 0.016, 10, false), strapMat)
    );
  } else {
    // Pearl Ivory Mini Top-Handle Bag held daintily in her right hand!
    const bodyGroup = new THREE.Group();
    bodyGroup.position.set(handPos.x + 0.03, handPos.y - 0.36, handPos.z + 0.04);
    bodyGroup.rotation.y = -0.25;
    bodyGroup.scale.setScalar(1.16);

    const miniBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.16), leatherMat);
    bodyGroup.add(miniBox);

    const handleArc = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.12, 0.15, 0),
      new THREE.Vector3(0, 0.34, 0),
      new THREE.Vector3(0.12, 0.15, 0),
    ]);
    bodyGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(handleArc, 20, 0.018, 10, false), leatherMat)
    );

    const pearlClasp = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 14), pearlMat);
    pearlClasp.position.set(0, 0.03, 0.09);
    bodyGroup.add(pearlClasp);

    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.022, 0.17), goldMat);
    goldTrim.position.set(0, 0.04, 0);
    bodyGroup.add(goldTrim);

    bagGroup.add(bodyGroup);
  }

  return bagGroup;
}

/**
 * Builds 3D Footwear (Stiletto Heels, Slingbacks, Knee-High Boots, or Cloud Platform Sneakers) on both feet.
 */
function build3DFootwear(
  product: Product,
  leftAnkle: THREE.Vector3,
  rightAnkle: THREE.Vector3,
  crotchY: number,
  hipAxes: { rx: number; rz: number },
  visualMode: Render3DVisualMode,
  onTextureReady?: () => void
): THREE.Group {
  const shoesGroup = new THREE.Group();
  shoesGroup.userData.product = product;
  const mat = createGarmentPhysicalMaterial(product, visualMode, onTextureReady);
  const low = product.title.toLowerCase();

  const isBoot = /boot/.test(low);
  const isSneaker = /sneaker|trainer|runner/.test(low);
  const soleMat = new THREE.MeshPhysicalMaterial({
    color: isSneaker ? "#F7F5F0" : "#1B1918",
    roughness: 0.45,
  });

  for (const [idx, ankle] of [leftAnkle, rightAnkle].entries()) {
    const side = idx === 0 ? -1 : 1;
    const g = new THREE.Group();

    if (isSneaker) {
      // Sculpted Cloud Platform Sneaker
      const platform = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.11, 0.58), soleMat);
      platform.position.set(ankle.x, 0.055, 0.14);
      g.add(platform);

      const upper = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), mat);
      upper.scale.set(0.85, 0.85, 1.75);
      upper.position.set(ankle.x, 0.16, 0.15);
      g.add(upper);
    } else if (isBoot) {
      // Tall Knee-High Meotina Leather Boots!
      const kneeTopY = lerp(ankle.y + 0.32, crotchY, 0.48);
      const bootShaft = buildLoftedSurface(ankle.y + 0.12, kneeTopY, 26, 26, (y, u) => {
        const theta = u * Math.PI * 2;
        const kt = (y - (ankle.y + 0.12)) / Math.max(0.1, kneeTopY - (ankle.y + 0.12));
        const cx = lerp(ankle.x, side * hipAxes.rx * 0.41, kt * 0.45);
        const r = lerp(0.155, 0.225, Math.pow(kt, 0.75));
        return {
          x: cx + r * Math.cos(theta),
          y,
          z: r * 1.06 * Math.sin(theta) - Math.sin(kt * Math.PI) * 0.02,
        };
      });
      g.add(new THREE.Mesh(bootShaft, mat));

      const blockHeel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.24, 16), soleMat);
      blockHeel.position.set(ankle.x, 0.12, -0.05);
      g.add(blockHeel);

      const bootToe = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 14), mat);
      bootToe.scale.set(0.78, 0.72, 1.9);
      bootToe.position.set(ankle.x, 0.11, 0.16);
      g.add(bootToe);
    } else {
      // Stiletto Strappy Heels or Pointed Slingbacks!
      const stiletto = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.014, 0.27, 12), mat);
      stiletto.position.set(ankle.x, 0.135, -0.06);
      g.add(stiletto);

      // Arched sole
      const soleCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ankle.x, 0.26, -0.06),
        new THREE.Vector3(ankle.x, 0.12, 0.08),
        new THREE.Vector3(ankle.x, 0.03, 0.34),
      ]);
      const soleGeom = new THREE.TubeGeometry(soleCurve, 16, 0.055, 10, false);
      soleGeom.scale(1.6, 0.32, 1.0);
      g.add(new THREE.Mesh(soleGeom, soleMat));

      if (/slingback/.test(low)) {
        // Pointed-toe vamp
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.28, 18), mat);
        cone.rotation.x = Math.PI / 2;
        cone.scale.set(1.0, 1.0, 0.58);
        cone.position.set(ankle.x, 0.06, 0.28);
        g.add(cone);
      } else {
        // Delicate metallic toe & ankle straps
        const toeStrap = new THREE.Mesh(
          new THREE.TorusGeometry(0.095, 0.016, 10, 20, Math.PI),
          mat
        );
        toeStrap.position.set(ankle.x, 0.055, 0.26);
        g.add(toeStrap);
      }

      const ankleStrap = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.015, 10, 22), mat);
      ankleStrap.rotation.x = Math.PI / 2;
      ankleStrap.position.set(ankle.x, 0.34, 0.0);
      g.add(ankleStrap);
    }

    shoesGroup.add(g);
  }
  return shoesGroup;
}

/**
 * Builds a 3D Garment Mesh (Top, Outerwear/Blazer/Coat/Cardigan, Bottom/Skirt/Trousers/Jeans, or Dress)
 * deformed dynamically around the customer's exact scanned 3D body using real fit ease!
 */
function build3DGarmentForSlot(
  product: Product,
  fit: AvatarExactFitReport,
  body: ReturnType<typeof createAnatomicalProfileEvaluator>,
  layerOrder: number,
  holdingBagMode: "none" | "hand-tote" | "shoulder-bag",
  visualMode: Render3DVisualMode,
  onTextureReady?: () => void
): THREE.Group {
  const group = new THREE.Group();
  group.userData.product = product;
  const mat = createGarmentPhysicalMaterial(product, visualMode, onTextureReady);
  const low = product.title.toLowerCase();

  // Extract zone feels & ease inches from ExactFitAnalysis
  const bustZone = fit.zones.find((z) => z.zone === "Bust");
  const waistZone = fit.zones.find((z) => z.zone === "Waist");
  const hipsZone = fit.zones.find((z) => z.zone === "Hips");

  const easeOffsetAtY = (y: number): number => {
    const baseLayer = 0.026 + layerOrder * 0.026;
    const zoneEase =
      y > lerp(body.waistY, body.bustY, 0.45)
        ? bustZone?.easeInches ?? 1.0
        : y > lerp(body.hipY, body.waistY, 0.5)
        ? waistZone?.easeInches ?? 0.8
        : hipsZone?.easeInches ?? 1.2;
    const clampedEase = clamp(zoneEase, -1.5, 6.0);
    // Negative ease hugs tightly; positive ease creates visible tailored/oversized drape air-gap!
    return baseLayer + Math.max(-0.008, clampedEase * 0.014);
  };

  const heatmapColorAt = (y: number): THREE.Color => {
    const bCol = feelToHeatmapRgb(bustZone?.feel || "tailored_ideal");
    const wCol = feelToHeatmapRgb(waistZone?.feel || "tailored_ideal");
    const hCol = feelToHeatmapRgb(hipsZone?.feel || "tailored_ideal");
    if (y >= body.waistY) {
      const t = smoothstep(body.waistY, body.bustY, y);
      return wCol.clone().lerp(bCol, t);
    }
    const t = smoothstep(body.hipY, body.waistY, y);
    return hCol.clone().lerp(wCol, t);
  };

  const colorCallback =
    visualMode === "heatmap" ? (y: number) => heatmapColorAt(y) : undefined;

  // Petite / Tall Hemline Shift based on store model height vs customer height
  const modelH = product.fitMetadata?.modelStats?.heightInches || 66;
  const heightDiffUnits = (modelH - body.totalBodyH / IN_TO_UNIT) * 0.035;

  if (product.category === "accessory" && /belt/.test(low)) {
    // 3D Sculpted Calfskin Waist Belt + 14k Gold Buckle
    const beltGeom = buildLoftedSurface(
      body.waistY - 0.075,
      body.waistY + 0.075,
      8,
      48,
      (y, u) => {
        const theta = u * Math.PI * 2;
        const sec = body.evalTorsoSection(y, theta);
        const scale = 1.06;
        return { x: sec.x * scale, y, z: sec.z * scale };
      },
      colorCallback
    );
    group.add(new THREE.Mesh(beltGeom, mat));

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: "#DFBD69",
      metalness: 0.94,
      roughness: 0.16,
    });
    const frontSec = body.evalTorsoSection(body.waistY, Math.PI * 0.5);
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.022, 12, 24), goldMat);
    buckle.scale.set(1.35, 0.95, 0.6);
    buckle.position.set(0, body.waistY, frontSec.z * 1.09);
    group.add(buckle);
    return group;
  }

  if (product.category === "bottom") {
    const isSkirt = /skirt/.test(low);
    const isPleated = /pleat/.test(low);
    const isWide = /wide|fluid|trouser/.test(low);
    const isFlare = /flare/.test(low);

    if (isSkirt) {
      const hemY = clamp(
        body.crotchY - 0.42 - heightDiffUnits,
        body.footBaseY + 0.55,
        body.crotchY - 0.12
      );
      const topY = body.waistY + 0.06;
      const skirtGeom = buildLoftedSurface(
        hemY,
        topY,
        36,
        64,
        (y, u) => {
          const theta = u * Math.PI * 2;
          const flareT = clamp((topY - y) / Math.max(0.1, topY - hemY), 0, 1);
          const refY = Math.max(y, body.crotchY);
          const sec = body.evalTorsoSection(refY, theta);
          const ease = easeOffsetAtY(refY);
          const flare = Math.pow(flareT, 1.15) * 0.24;
          const pleat = isPleated ? Math.cos(theta * 24) * 0.022 * flareT : 0;
          const radScale = 1 + (ease + flare + pleat) / Math.max(0.25, sec.rx);
          return {
            x: sec.x * radScale,
            y,
            z: sec.z * radScale,
          };
        },
        colorCallback
      );
      group.add(new THREE.Mesh(skirtGeom, mat));
      return group;
    }

    // Tailored Trousers / Vintage Straight Jeans / Sculpt Flare Leggings:
    // 1) Seamless High-Waist Pelvic Yoke (Waist -> Crotch)
    const yokeTopY = body.waistY + 0.06;
    const yokeBotY = body.crotchY - 0.04;
    const yokeGeom = buildLoftedSurface(
      yokeBotY,
      yokeTopY,
      24,
      48,
      (y, u) => {
        const theta = u * Math.PI * 2;
        const sec = body.evalTorsoSection(Math.max(y, body.crotchY), theta);
        const ease = easeOffsetAtY(y);
        return {
          x: sec.x * (1 + ease / Math.max(0.25, sec.rx)),
          y,
          z: sec.z * (1 + ease / Math.max(0.25, sec.rz)),
        };
      },
      colorCallback
    );
    group.add(new THREE.Mesh(yokeGeom, mat));

    // 2) Left & Right 3D Pant Legs (Seamless join with pelvic yoke -> Ankle/Floor)
    const pantHemY = clamp(
      body.footBaseY + (isWide ? 0.12 : 0.26) - heightDiffUnits * 0.4,
      body.footBaseY + 0.05,
      body.footBaseY + 0.55
    );
    for (const side of [-1, 1] as const) {
      const hipX = side * body.hipAxes.rx * 0.47;
      const ankleX = side * body.hipAxes.rx * (isWide ? 0.45 : 0.35);
      const thighR = body.hipAxes.rx * 0.54 + (isWide ? 0.025 : 0.01);

      const legPantGeom = buildLoftedSurface(
        pantHemY,
        body.crotchY + 0.15,
        36,
        32,
        (y, u) => {
          const theta = u * Math.PI * 2;
          const downT = clamp(
            (body.crotchY + 0.15 - y) / Math.max(0.2, body.crotchY + 0.15 - pantHemY),
            0,
            1
          );
          const cx = lerp(hipX, ankleX, downT);
          let rx = thighR;
          let rz = body.hipAxes.rz * 0.76;

          if (isWide) {
            rx = lerp(thighR, thighR * 1.12, downT) + Math.cos(theta * 4) * 0.014 * downT;
            rz = lerp(rz, thighR * 1.05, downT);
          } else if (isFlare) {
            const kneeDip = Math.sin(Math.min(1, downT * 1.65) * Math.PI) * 0.09;
            const bottomFlare = smoothstep(0.55, 1.0, downT) * 0.12;
            rx = thighR * 0.92 - kneeDip + bottomFlare;
            rz = rx * 1.06;
          } else {
            // Vintage straight-leg denim taper
            rx = lerp(thighR * 0.98, thighR * 0.72, downT);
            rz = lerp(rz * 0.96, thighR * 0.74, downT);
          }

          return {
            x: cx + rx * Math.cos(theta),
            y,
            z: rz * Math.sin(theta),
          };
        },
        colorCallback
      );
      group.add(new THREE.Mesh(legPantGeom, mat));
    }
    return group;
  }

  // DRESS, TOP, OR OUTERWEAR
  const isDress = product.category === "dress";
  const isOuter = product.category === "outerwear";
  const isCorset = /corset/.test(low);
  const isMidi = /midi|maxi/.test(low);
  const isCoat = /coat/.test(low);
  const hasSleeves =
    isOuter || /blazer/.test(low) || /cardigan/.test(low) || /jacket/.test(low);

  let yBottom = body.waistY - 0.14;
  if (isDress) {
    yBottom = isMidi
      ? clamp(body.footBaseY + 0.95 - heightDiffUnits, body.footBaseY + 0.5, body.crotchY - 0.5)
      : clamp(body.crotchY - 0.44 - heightDiffUnits, body.footBaseY + 0.7, body.crotchY - 0.15);
  } else if (isOuter) {
    yBottom = isCoat
      ? clamp(body.footBaseY + 1.15 - heightDiffUnits, body.footBaseY + 0.65, body.crotchY - 0.4)
      : /cropped|tweed/.test(low)
      ? body.waistY - 0.08
      : body.hipY - 0.18;
  } else if (isCorset) {
    yBottom = body.waistY - 0.18;
  } else {
    yBottom = body.waistY - 0.12;
  }

  const yTop = isCorset && !hasSleeves ? body.bustY + 0.18 : body.shoulderY + 0.02;

  const torsoGarmentGeom = buildLoftedSurface(
    yBottom,
    yTop,
    52,
    64,
    (y, u) => {
      const theta = u * Math.PI * 2;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      // Basque V-point hem on corsets
      let adjustedY = y;
      if (isCorset && !isDress && y < body.waistY) {
        const frontPoint = Math.max(0, sinT) * Math.exp(-Math.pow(cosT / 0.45, 2));
        adjustedY = y - frontPoint * 0.14 * (1 - (y - yBottom) / Math.max(0.08, body.waistY - yBottom));
      }

      const sampleY = clamp(adjustedY, body.crotchY - 0.05, body.neckBaseY);
      const sec = body.evalTorsoSection(sampleY, theta);
      const ease = easeOffsetAtY(sampleY);

      let skirtFlare = 0;
      if (adjustedY < body.hipY) {
        const drop = (body.hipY - adjustedY) / Math.max(0.2, body.hipY - yBottom);
        skirtFlare =
          (isMidi ? 0.34 : isCoat ? 0.28 : 0.14) * Math.pow(clamp(drop, 0, 1), 1.2) +
          (isMidi ? Math.cos(theta * 8) * 0.022 * drop : 0);
      }

      // Open-front lapel split subtle relief for blazers/coats/cardigans
      const openFrontChannel =
        isOuter && sinT > 0.85 && Math.abs(cosT) < 0.14 ? -0.015 : 0;

      const scaleX = 1 + (ease + skirtFlare + openFrontChannel) / Math.max(0.24, sec.rx);
      const scaleZ = 1 + (ease + skirtFlare + openFrontChannel) / Math.max(0.22, sec.rz);

      return {
        x: sec.x * scaleX,
        y: adjustedY,
        z: sec.z * scaleZ,
      };
    },
    colorCallback
  );
  group.add(new THREE.Mesh(torsoGarmentGeom, mat));

  // Delicate 3D Straps for Corset Dresses & Satin Midi
  if ((isDress && !hasSleeves) || (!hasSleeves && !isCorset)) {
    for (const s of [-1, 1]) {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * body.bustAxes.rx * 0.55, body.bustY + 0.16, body.bustAxes.rz * 0.86),
        new THREE.Vector3(s * body.shoulderHalfW * 0.68, body.shoulderY + 0.05, 0.02),
        new THREE.Vector3(s * body.bustAxes.rx * 0.55, body.bustY + 0.16, -body.bustAxes.rz * 0.84),
      ]);
      group.add(
        new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 20, 0.022, 8, false), mat)
      );
    }
  }

  // Full 3D Tailored Sleeves + Lapels + Gold/Horn Buttons for Outerwear & Blazer Dress!
  if (hasSleeves) {
    const torsoSpan = body.neckTopY - body.crotchY;
    const armLen = torsoSpan * 0.84;

    for (const side of [-1, 1] as const) {
      const sx = side * Math.max(0.42, body.shoulderHalfW - 0.045);
      const sy = body.shoulderY - 0.05;
      const rightMode = side === 1 ? holdingBagMode : "none";

      const p0 = new THREE.Vector3(sx, sy, 0);
      const p1 =
        rightMode === "hand-tote"
          ? new THREE.Vector3(sx + side * 0.14, sy - armLen * 0.48, -0.03)
          : rightMode === "shoulder-bag"
          ? new THREE.Vector3(sx + side * 0.19, sy - armLen * 0.46, -0.04)
          : new THREE.Vector3(sx + side * 0.13, sy - armLen * 0.48, -0.02);
      const p2 =
        rightMode === "hand-tote"
          ? new THREE.Vector3(sx + side * 0.16, sy - armLen * 0.66, 0.31)
          : rightMode === "shoulder-bag"
          ? new THREE.Vector3(sx + side * 0.11, sy - armLen * 0.72, 0.21)
          : new THREE.Vector3(sx + side * 0.15, sy - armLen * 0.88, 0.07);

      const sleeveCurve = new THREE.CatmullRomCurve3([p0, p1, p2]);
      const sleeveGeom = new THREE.TubeGeometry(sleeveCurve, 24, 0.148, 16, false);
      group.add(new THREE.Mesh(sleeveGeom, mat));

      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.165, 18, 14), mat);
      puff.position.copy(p0);
      group.add(puff);
    }

    // Sculpted 3D Notched Lapels or Belted Tie Sash or Gold Buttons!
    const buttonMat = new THREE.MeshPhysicalMaterial({
      color: /gold|ivory|champagne|noir/i.test(product.title) ? "#DFBD69" : "#3A2C24",
      metalness: 0.85,
      roughness: 0.22,
    });

    if (/cardigan|coat/.test(low)) {
      // 3D Belted Waist Tie Sash
      const sashGeom = buildLoftedSurface(
        body.waistY - 0.06,
        body.waistY + 0.06,
        6,
        40,
        (y, u) => {
          const theta = u * Math.PI * 2;
          const sec = body.evalTorsoSection(y, theta);
          return { x: sec.x * 1.15, y, z: sec.z * 1.15 };
        }
      );
      group.add(new THREE.Mesh(sashGeom, mat));
    }

    if (/blazer|tweed/.test(low)) {
      for (const row of [0, 1, 2]) {
        const by = body.bustY - 0.08 - row * 0.18;
        if (by < yBottom + 0.06) continue;
        const sec = body.evalTorsoSection(by, Math.PI * 0.5);
        for (const bx of [-0.11, 0.11]) {
          const btn = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.026, 0.018, 14),
            buttonMat
          );
          btn.rotation.x = Math.PI / 2;
          btn.position.set(bx, by, sec.z * 1.14 + 0.02);
          group.add(btn);
        }
      }
    }
  }

  return group;
}

/**
 * Builds floating glowing 3D Measurement Tape Rings around Bust, Waist, and Hips
 * so online shoppers see their exact scanned body dimensions right in 3D space!
 */
function build3DMeasurementRings(
  body: ReturnType<typeof createAnatomicalProfileEvaluator>
): THREE.Group {
  const group = new THREE.Group();
  const rings: Array<{ y: number; color: string }> = [
    { y: body.bustY, color: "#10B981" },
    { y: body.waistY, color: "#244B3B" },
    { y: body.hipY, color: "#0EA5E9" },
  ];

  for (const spec of rings) {
    const pts: THREE.Vector3[] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * Math.PI * 2;
      const sec = body.evalTorsoSection(spec.y, theta);
      pts.push(new THREE.Vector3(sec.x * 1.14, spec.y, sec.z * 1.14));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.013, 8, true),
      new THREE.MeshBasicMaterial({ color: spec.color })
    );
    group.add(tube);
  }
  return group;
}

/**
 * Builds the complete Interactive 3D Scanned Avatar + Multi-Slot Worn 3D Outfit + Held 3D Handbag!
 */
export function buildInteractive3DAvatarScene(params: {
  dimensions: BodyScanDimensions;
  wornPieces: Worn3DPieceSpec[];
  visualMode?: Render3DVisualMode;
  showMeasurementRings?: boolean;
  faceOvalDataUrl?: string | null;
  onTextureReady?: () => void;
}): Avatar3DBuildResult {
  const {
    dimensions,
    wornPieces,
    visualMode = "studio",
    showMeasurementRings = false,
    faceOvalDataUrl,
    onTextureReady,
  } = params;

  const root = new THREE.Group();
  const fitByProductId = new Map<string, AvatarExactFitReport>();
  const interactiveMeshes: THREE.Object3D[] = [];

  // Identify shoe heel lift & held bag mode first so body posture adapts naturally!
  const shoeSpec = wornPieces.find((w) => w.product.category === "shoes");
  const bagSpec = wornPieces.find(
    (w) =>
      w.product.category === "accessory" &&
      /bag|tote|clutch|crescent|purse/i.test(w.product.title)
  );

  const isStilettoOrBoot =
    shoeSpec && !/sneaker|flat/i.test(shoeSpec.product.title);
  const heelLiftUnits = shoeSpec ? (isStilettoOrBoot ? 0.24 : 0.11) : 0.04;

  const bagLow = bagSpec?.product.title.toLowerCase() || "";
  const holdingBagMode: "none" | "hand-tote" | "shoulder-bag" = !bagSpec
    ? "none"
    : /crescent|quilted|chain|shoulder/.test(bagLow)
    ? "shoulder-bag"
    : "hand-tote";

  const body = createAnatomicalProfileEvaluator(dimensions, heelLiftUnits);

  // Studio Turntable Podium Disc
  const podiumGroup = new THREE.Group();
  const podiumDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.62, 0.08, 64),
    new THREE.MeshPhysicalMaterial({
      color: "#F3F5F8",
      roughness: 0.35,
      metalness: 0.05,
      clearcoat: 0.25,
    })
  );
  podiumDisc.position.y = -0.04;
  podiumGroup.add(podiumDisc);

  const podiumRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.48, 0.014, 10, 72),
    new THREE.MeshBasicMaterial({ color: "#CBD5E1" })
  );
  podiumRing.rotation.x = Math.PI / 2;
  podiumRing.position.y = 0.004;
  podiumGroup.add(podiumRing);
  root.add(podiumGroup);

  // Warm Lifelike Skin Material
  const skinMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(dimensions.skinToneHex || "#D8A986"),
    roughness: 0.52,
    metalness: 0.02,
    sheen: 0.28,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color("#F4C9B2"),
    clearcoat: 0.06,
    clearcoatRoughness: 0.45,
  });

  // Neutral studio seamless base brief & bandeau when no garment covers torso/hips (e.g. Body Scanner preview)
  const hasUpperGarment = wornPieces.some(
    (w) =>
      w.product.category === "top" ||
      w.product.category === "dress" ||
      w.product.category === "outerwear"
  );
  const hasLowerGarment = wornPieces.some(
    (w) => w.product.category === "bottom" || w.product.category === "dress"
  );

  // 1. Torso & Neck Mesh
  const torsoGeom = buildLoftedSurface(
    body.crotchY - 0.06,
    body.neckTopY,
    84,
    72,
    (y, u) => {
      const theta = u * Math.PI * 2;
      const sec = body.evalTorsoSection(y, theta);
      return { x: sec.x, y, z: sec.z };
    }
  );
  root.add(new THREE.Mesh(torsoGeom, skinMat));

  // Studio Second-Skin Bodysuit / Bandeau+Brief in Body Scanner mode when unclothed
  if (!hasUpperGarment || !hasLowerGarment) {
    const baseSuitMat = new THREE.MeshPhysicalMaterial({
      color: "#22252A",
      roughness: 0.58,
      sheen: 0.3,
    });
    if (!hasUpperGarment) {
      const bandeau = buildLoftedSurface(
        body.underbustY - 0.02,
        body.bustY + 0.12,
        16,
        56,
        (y, u) => {
          const sec = body.evalTorsoSection(y, u * Math.PI * 2);
          return { x: sec.x * 1.022, y, z: sec.z * 1.022 };
        }
      );
      root.add(new THREE.Mesh(bandeau, baseSuitMat));
    }
    if (!hasLowerGarment) {
      const brief = buildLoftedSurface(
        body.crotchY - 0.03,
        body.hipY + 0.16,
        18,
        56,
        (y, u) => {
          const sec = body.evalTorsoSection(y, u * Math.PI * 2);
          return { x: sec.x * 1.024, y, z: sec.z * 1.024 };
        }
      );
      root.add(new THREE.Mesh(brief, baseSuitMat));
    }
  }

  // 2. Sculpted Left & Right Legs
  const leftLeg = buildAnatomicalLeg(
    -1,
    body.footBaseY,
    body.crotchY,
    body.hipAxes,
    skinMat
  );
  const rightLeg = buildAnatomicalLeg(
    1,
    body.footBaseY,
    body.crotchY,
    body.hipAxes,
    skinMat
  );
  root.add(leftLeg.group, rightLeg.group);

  // 3. Sculpted Posed Arms (Right arm `side = 1` poses dynamically to hold 3D Handbag!)
  const torsoSpan = body.neckTopY - body.crotchY;
  const leftArm = buildPosedArm(
    -1,
    body.shoulderY,
    body.shoulderHalfW,
    torsoSpan,
    "none",
    skinMat
  );
  const rightArm = buildPosedArm(
    1,
    body.shoulderY,
    body.shoulderHalfW,
    torsoSpan,
    holdingBagMode,
    skinMat
  );
  root.add(leftArm.group, rightArm.group);

  // 4. Sculpted Head, Facial Features & Layered Hair
  const headGroup = buildFeminineHeadAndHair(
    body.neckTopY,
    dimensions,
    skinMat,
    faceOvalDataUrl,
    onTextureReady
  );
  root.add(headGroup);

  // 5. Render All Worn 3D Garments, Belts, Shoes & Held 3D Handbags in Layer Order!
  const ordered = [...wornPieces].sort((a, b) => {
    const rank = (cat: Product["category"]) =>
      cat === "top"
        ? 1
        : cat === "bottom"
        ? 2
        : cat === "dress"
        ? 2
        : cat === "accessory"
        ? 3
        : cat === "outerwear"
        ? 4
        : 5;
    return rank(a.product.category) - rank(b.product.category);
  });

  ordered.forEach((item) => {
    const fit = analyzeExactAvatarFit(
      {
        heightInches: dimensions.heightInches,
        bustInches: dimensions.bustInches,
        waistInches: dimensions.waistInches,
        hipsInches: dimensions.hipsInches,
        shoeSize: dimensions.shoeSize,
      },
      item.product,
      item.selectedSize
    );
    fitByProductId.set(item.product.id, fit);

    let meshGroup: THREE.Group | null = null;
    const low = item.product.title.toLowerCase();

    if (item.product.category === "shoes") {
      meshGroup = build3DFootwear(
        item.product,
        leftLeg.anklePos,
        rightLeg.anklePos,
        body.crotchY,
        body.hipAxes,
        visualMode,
        onTextureReady
      );
    } else if (
      item.product.category === "accessory" &&
      /bag|tote|clutch|crescent|purse/.test(low)
    ) {
      meshGroup = build3DHandbagAccessory(
        item.product,
        rightArm.handWorldPos,
        rightArm.shoulderWorldPos,
        visualMode,
        onTextureReady
      );
    } else {
      const layerOrder =
        item.product.category === "outerwear"
          ? 2
          : item.product.category === "bottom" || item.product.category === "accessory"
          ? 1
          : 0;
      meshGroup = build3DGarmentForSlot(
        item.product,
        fit,
        body,
        layerOrder,
        holdingBagMode,
        visualMode,
        onTextureReady
      );
    }

    if (meshGroup) {
      meshGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.userData.product = item.product;
          interactiveMeshes.push(child);
        }
      });
      root.add(meshGroup);
    }
  });

  if (showMeasurementRings || visualMode === "xray") {
    root.add(build3DMeasurementRings(body));
  }

  const totalHeightUnits = body.neckTopY + 0.85;
  return {
    root,
    totalHeightUnits,
    hipCenterY: totalHeightUnits * 0.5,
    bustY: body.bustY,
    waistY: body.waistY,
    hipsY: body.hipY,
    fitByProductId,
    interactiveMeshes,
  };
}

/**
 * Builds a Standalone Interactive 3D Product Object on a Studio Pedestal
 * so ANY shirt, blazer, dress, trousers, heels, belt, or handbag can be rotated & inspected in 3D!
 */
export function buildStandalone3DProductScene(params: {
  product: Product;
  dimensions: BodyScanDimensions;
  selectedSize?: string;
  visualMode?: Render3DVisualMode;
  onTextureReady?: () => void;
}): { root: THREE.Group; centerY: number; cameraDistance: number } {
  const {
    product,
    dimensions,
    selectedSize,
    visualMode = "studio",
    onTextureReady,
  } = params;

  const root = new THREE.Group();
  const fit = analyzeExactAvatarFit(
    {
      heightInches: dimensions.heightInches,
      bustInches: dimensions.bustInches,
      waistInches: dimensions.waistInches,
      hipsInches: dimensions.hipsInches,
      shoeSize: dimensions.shoeSize,
    },
    product,
    selectedSize
  );

  const body = createAnatomicalProfileEvaluator(dimensions, 0.15);
  const low = product.title.toLowerCase();

  if (product.category === "shoes") {
    const shoes = build3DFootwear(
      product,
      new THREE.Vector3(-0.24, 0.1, 0),
      new THREE.Vector3(0.24, 0.1, 0),
      body.crotchY,
      body.hipAxes,
      visualMode,
      onTextureReady
    );
    root.add(shoes);
    const centerY = /boot/.test(low) ? 0.85 : 0.25;
    return { root, centerY, cameraDistance: /boot/.test(low) ? 3.2 : 1.9 };
  }

  if (product.category === "accessory" && /bag|tote|clutch|crescent|purse/.test(low)) {
    const bag = build3DHandbagAccessory(
      product,
      new THREE.Vector3(0, 0.45, 0),
      new THREE.Vector3(-0.18, 1.05, 0),
      visualMode,
      onTextureReady
    );
    root.add(bag);
    return { root, centerY: 0.18, cameraDistance: 1.95 };
  }

  const garment = build3DGarmentForSlot(
    product,
    fit,
    body,
    0,
    "none",
    visualMode,
    onTextureReady
  );
  root.add(garment);

  // Compute bounding box so camera centers right on the floating 3D garment!
  const box = new THREE.Box3().setFromObject(garment);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxSpan = Math.max(size.x, size.y, size.z, 0.8);
  return {
    root,
    centerY: center.y,
    cameraDistance: clamp(maxSpan * 2.55, 2.55, 6.2),
  };
}

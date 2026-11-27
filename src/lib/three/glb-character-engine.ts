/**
 * ============================================================================
 * GWO WATERTIGHT 360° VOLUMETRIC 3D CHARACTER & INDIVIDUAL 3D GARMENT ENGINE
 * File: src/lib/three/glb-character-engine.ts
 * ============================================================================
 *
 * Renders TRUE CLOSED, SEAMLESS 360° 3D MESH VOLUMES in Three.js (`WebGLRenderer`):
 *
 * 1. Seamless Watertight 3D Human Character Rig (`loadCharacter3DRig`):
 *    - `HeadAndNeck3D`: clean craniofacial 3D oval + localized 3D nasal bridge & lip sculpt
 *    - `HairCanopy3D`: 360° volumetric wavy hair dome & shoulder tresses (`hair_over_front` + `hair_over_back`)
 *    - `TorsoPelvis3D`: continuous trapezius -> clavicle -> shoulder crown -> bust -> waist -> hip -> pelvis
 *    - `RightArm3D` & `LeftArm3D`: cylindrical 3D arms with rounded deltoid caps & tapered fingertips
 *    - `RightLeg3D` & `LeftLeg3D`: sculpted 3D thighs, knees, calves & arched feet
 *
 * 2. Individual Watertight 3D Wearable Garment & Purse Meshes (`loadWearable3DItemRig`):
 *    - `top`: 360° sculpted 3D bodice with crisp sweetheart/halter necklines & Basque V-hems
 *    - `bottom`: C¹-continuous silhouette-lofted 3D palazzo trousers / denim / leggings / 360° skirts
 *    - `dress`: 360° sculpted 3D satin/velvet/tuxedo dresses
 *    - `outerwear`: open-lapel 3D jackets/coats + paired 360° cylindrical 3D sleeves
 *    - `belt`: 360° contoured waist belt ring
 *    - `shoes`: sculpted 3D stilettos, slingbacks, platform sneakers & knee-high boots
 *    - `bag`: tangent-mounted 3D leather handbag cushion + 5.6cm 3D gusset + `THREE.TubeGeometry` 3D arched straps
 */

import * as THREE from "three";
import { Product } from "../types";
import { BodyScanDimensions } from "./body-scan-analyzer";
import { Render3DVisualMode } from "./parametric-3d-engine";
import {
  classifyWearableSlotAndAnchors,
  isolateProductBackgroundClient,
  WearableSlotType,
} from "./avatar-ready-pipeline";
import {
  ALL_CERTIFIED_MODULAR_SKU_IDS,
  MOD_BAG_SLUG,
  MOD_BELT_SLUG,
  MOD_BOT_SLUG,
  MOD_DRESS_SLUG,
  MOD_OUTER_SLUG,
  MOD_SHOE_SLUG,
  MOD_TOP_SLUG,
  modLayerUrl,
} from "./modular-outfit-compositor";
export { ALL_CERTIFIED_MODULAR_SKU_IDS };
import {
  ARMS_3D_RINGS,
  HAIR_CANOPY_3D_RINGS,
  HEAD_NECK_3D_RINGS,
  LEGS_FEET_3D_RINGS,
  PairedLimbRing,
  SagittalTubeRing,
  TORSO_PELVIS_3D_RINGS,
} from "./anatomical-3d-profiles";
import { AvatarExactFitReport, ZoneFeel } from "../catalog/fit-intelligence";
import {
  MASTER_AVATAR_ANATOMY_STANDARD,
  FabricPhysicsProfile,
  computePhysicalEaseExpansionMeters,
  enforceRealisticAvatarAnatomy,
  resolveGarmentFabricPhysics,
} from "../realism/master-avatar-clothing-realism";

export const GLB_ASSET_VER = "volumetric3d11";
export const BASE_CHAR_HEIGHT_M =
  MASTER_AVATAR_ANATOMY_STANDARD.canonicalHeightMeters;
export const BASE_CHAR_WIDTH_M = BASE_CHAR_HEIGHT_M * (900 / 1355);

const ALPHA_GRID_W = 90;
const ALPHA_GRID_H = 135;

export type BledAlphaMode = "solid" | "exact_mask" | "garment_hem_cutout";

export interface Bled3DViewTexture {
  texture: THREE.Texture;
  alphaGrid: Uint8Array;
  rawImage: HTMLImageElement | null;
  minYn: number;
  maxYn: number;
}

const BLED_TEX_CACHE = new Map<string, Promise<Bled3DViewTexture>>();

function smoothstepJS(e0: number, e1: number, x: number): number {
  const t = Math.min(1.0, Math.max(0.0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3.0 - 2.0 * t);
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.padEnd(6, "0").slice(0, 6), 16) || 0x222222;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Loads a view texture, extracts its 90x135 `alphaGrid` & `[minYn, maxYn]`,
 * dilates interior RGB 26 passes outward so curved 3D grazing seams NEVER halo,
 * and constructs the requested alpha channel (`solid`, `exact_mask`, or `garment_hem_cutout`).
 */
function loadBled3DViewTexture(
  url: string,
  opts?: {
    stripBaseShapewear?: boolean;
    isolateDarkHairSide?: boolean;
    sealHairCrownFront?: boolean;
    sealHairCrownBack?: boolean;
    torsoHemFloorYn?: number;
    tintHex?: string | null;
    tintYRange?: [number, number];
    alphaMode?: BledAlphaMode;
  }
): Promise<Bled3DViewTexture> {
  const alphaMode: BledAlphaMode = opts?.alphaMode || "solid";
  const cacheKey = `${url}|sw=${Boolean(opts?.stripBaseShapewear)}|hs=${Boolean(
    opts?.isolateDarkHairSide
  )}|hcf=${Boolean(opts?.sealHairCrownFront)}|hcb=${Boolean(
    opts?.sealHairCrownBack
  )}|thf=${opts?.torsoHemFloorYn?.toFixed(3) || ""}|t=${
    opts?.tintHex || ""
  }|yr=${opts?.tintYRange?.join("-") || ""}|am=${alphaMode}`;
  const hit = BLED_TEX_CACHE.get(cacheKey);
  if (hit) return hit;

  const p = new Promise<Bled3DViewTexture>((resolve, reject) => {
    if (typeof Image === "undefined" || typeof document === "undefined") {
      resolve({
        texture: new THREE.Texture(),
        alphaGrid: new Uint8Array(ALPHA_GRID_W * ALPHA_GRID_H),
        rawImage: null,
        minYn: 0.05,
        maxYn: 0.95,
      });
      return;
    }

    const im = new Image();
    if (!url.startsWith("data:") && !url.startsWith("/")) {
      im.crossOrigin = "anonymous";
    }
    im.decoding = "async";
    im.onload = () => {
      // 1. Extract 90x135 silhouette alphaGrid from raw image
      const gCv = document.createElement("canvas");
      gCv.width = ALPHA_GRID_W;
      gCv.height = ALPHA_GRID_H;
      const gCtx = gCv.getContext("2d")!;
      gCtx.drawImage(im, 0, 0, ALPHA_GRID_W, ALPHA_GRID_H);
      const gd = gCtx.getImageData(0, 0, ALPHA_GRID_W, ALPHA_GRID_H).data;
      const alphaGrid = new Uint8Array(ALPHA_GRID_W * ALPHA_GRID_H);
      let minRow = ALPHA_GRID_H - 1;
      let maxRow = 0;
      for (let r = 0; r < ALPHA_GRID_H; r++) {
        let rowHas = false;
        for (let c = 0; c < ALPHA_GRID_W; c++) {
          const a = gd[(r * ALPHA_GRID_W + c) * 4 + 3];
          alphaGrid[r * ALPHA_GRID_W + c] = a;
          if (a > 70) rowHas = true;
        }
        if (rowHas) {
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
        }
      }
      const maxYn = minRow <= maxRow ? 1.0 - minRow / ALPHA_GRID_H : 0.82;
      const minYn =
        minRow <= maxRow ? 1.0 - (maxRow + 1) / ALPHA_GRID_H : 0.12;

      // 2. Build 540x813 high-res RGB-dilated texture
      const TW = 540;
      const TH = 813;
      const cv = document.createElement("canvas");
      cv.width = TW;
      cv.height = TH;
      const ctx = cv.getContext("2d")!;
      ctx.drawImage(im, 0, 0, TW, TH);
      const imgData = ctx.getImageData(0, 0, TW, TH);
      const d = imgData.data;

      if (opts?.isolateDarkHairSide) {
        // Keep ONLY dark wavy hair pixels on `base_side` (crown + back/temple cascade, excluding face & torso!)
        const maxFaceX = Math.round((492 / 900) * TW);
        const maxHairY = Math.round((525 / 1355) * TH);
        for (let y = 0; y < TH; y++) {
          for (let x = 0; x < TW; x++) {
            const k = (y * TW + x) * 4;
            if (y > maxHairY || x > maxFaceX || d[k + 3] < 90) {
              d[k + 3] = 0;
              continue;
            }
            const r = d[k];
            const g = d[k + 1];
            const b = d[k + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const isWarmSkin = r > 88 && r - b > 20 && lum > 68;
            if (isWarmSkin || lum > 92) {
              d[k + 3] = 0;
            }
          }
        }
      }

      if (opts?.sealHairCrownFront || opts?.sealHairCrownBack) {
        // Seal top cranial crown dome (`yn >= 0.905`, `y <= 0.095 * TH`) with rich espresso hair so zero white crown gaps appear!
        const crownEndRow = Math.round(0.095 * TH);
        for (let y = 0; y <= crownEndRow; y++) {
          const ynRow = 1.0 - y / TH;
          for (let x = 0; x < TW; x++) {
            const k = (y * TW + x) * 4;
            if (d[k + 3] > 180) continue;
            const dxNorm = Math.abs(x - TW * 0.5) / TW;
            const inForeheadWindow =
              Boolean(opts?.sealHairCrownFront) &&
              ynRow < 0.952 &&
              dxNorm < (0.954 - ynRow) * 1.12;
            if (!inForeheadWindow && dxNorm < 0.145) {
              d[k] = 24;
              d[k + 1] = 22;
              d[k + 2] = 25;
              d[k + 3] = 255;
            }
          }
        }
      }

      // Snapshot original alpha before RGB dilation
      const origA = new Uint8Array(TW * TH);
      for (let i = 0; i < TW * TH; i++) origA[i] = d[i * 4 + 3];

      if (opts?.stripBaseShapewear) {
        const y0 = Math.round((295 / 1355) * TH);
        const y1 = Math.round((785 / 1355) * TH);
        for (let y = y0; y < y1; y++) {
          for (let x = 0; x < TW; x++) {
            const k = (y * TW + x) * 4;
            if (d[k + 3] < 40) continue;
            const r = d[k];
            const b = d[k + 2];
            if (b > 112 && r - b < 44) {
              const lum =
                (0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]) / 255;
              const sh = 0.72 + lum * 0.34;
              d[k] = Math.min(255, Math.round(208 * sh));
              d[k + 1] = Math.min(255, Math.round(154 * sh));
              d[k + 2] = Math.min(255, Math.round(118 * sh));
            }
          }
        }
      }

      if (opts?.tintHex) {
        const [tr, tg, tb] = hexToRgb01(opts.tintHex);
        const yr0 = opts.tintYRange
          ? Math.round((opts.tintYRange[0] / 1355) * TH)
          : 0;
        const yr1 = opts.tintYRange
          ? Math.round((opts.tintYRange[1] / 1355) * TH)
          : TH;
        for (let y = yr0; y < yr1; y++) {
          for (let x = 0; x < TW; x++) {
            const k = (y * TW + x) * 4;
            if (d[k + 3] < 50) continue;
            const r = d[k] / 255;
            const g = d[k + 1] / 255;
            const b = d[k + 2] / 255;
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const sat = Math.max(r, g, b) - Math.min(r, g, b);
            const isSkin =
              r > g + 0.04 &&
              g > b + 0.02 &&
              r - b > 0.095 &&
              r > 0.22 &&
              r < 0.92;
            const isHair = lum < 0.22 && sat < 0.14 && y < TH * 0.42;
            if (isSkin || isHair) continue;
            const shade = 0.44 + lum * 0.96;
            const targetLum = 0.299 * tr + 0.587 * tg + 0.114 * tb;
            const spec =
              Math.max(0, (lum - 0.78) * 1.2) * (0.04 + targetLum * 0.22);
            d[k] = Math.min(
              255,
              Math.max(0, Math.round((tr * shade + spec) * 255))
            );
            d[k + 1] = Math.min(
              255,
              Math.max(0, Math.round((tg * shade + spec) * 255))
            );
            d[k + 2] = Math.min(
              255,
              Math.max(0, Math.round((tb * shade + spec) * 255))
            );
          }
        }
      }

      // Erode 1px inward from alpha boundary, then dilate interior RGB 28 passes outward
      const solid = new Uint8Array(TW * TH);
      for (let y = 1; y < TH - 1; y++) {
        for (let x = 1; x < TW - 1; x++) {
          const i = y * TW + x;
          if (
            origA[i] > 205 &&
            origA[i - 1] > 165 &&
            origA[i + 1] > 165 &&
            origA[i - TW] > 165 &&
            origA[i + TW] > 165
          ) {
            solid[i] = 1;
          }
        }
      }
      for (let pass = 0; pass < 28; pass++) {
        for (let y = 1; y < TH - 1; y++) {
          for (let x = 1; x < TW - 1; x++) {
            const k = y * TW + x;
            if (solid[k]) continue;
            const nb =
              solid[k - 1] === 1
                ? k - 1
                : solid[k + 1] === 1
                ? k + 1
                : solid[k - TW] === 1
                ? k - TW
                : solid[k + TW] === 1
                ? k + TW
                : -1;
            if (nb >= 0) {
              d[k * 4] = d[nb * 4];
              d[k * 4 + 1] = d[nb * 4 + 1];
              d[k * 4 + 2] = d[nb * 4 + 2];
              solid[k] = 2;
            }
          }
        }
        for (let i = 0; i < TW * TH; i++) {
          if (solid[i] === 2) solid[i] = 1;
        }
      }

      // Write final alpha channel according to `alphaMode`
      if (alphaMode === "solid") {
        for (let i = 0; i < TW * TH; i++) d[i * 4 + 3] = 255;
      } else if (alphaMode === "exact_mask" || opts?.isolateDarkHairSide) {
        for (let i = 0; i < TW * TH; i++) d[i * 4 + 3] = origA[i];
      } else {
        // `garment_hem_cutout`: preserves exact necklines, Basque V-points & lapel openings in the interior
        // while extending each row's outer left/right garment silhouette horizontally so curved 3D sides stay 100% solid!
        for (let y = 0; y < TH; y++) {
          let rowLeft = -1;
          let rowRight = -1;
          for (let x = 0; x < TW; x++) {
            if (origA[y * TW + x] > 120) {
              if (rowLeft < 0) rowLeft = x;
              rowRight = x;
            }
          }
          if (rowLeft < 0) {
            for (let x = 0; x < TW; x++) d[(y * TW + x) * 4 + 3] = 0;
            continue;
          }
          const ynRow = 1.0 - y / TH;
          if (
            opts?.torsoHemFloorYn !== undefined &&
            ynRow < opts.torsoHemFloorYn
          ) {
            // Below cropped jacket's torso waist hem: keep ONLY sleeve pixels at sleeve X, zeroing central torso!
            for (let x = 0; x < TW; x++) {
              const isTorsoCol = x > TW * 0.36 && x < TW * 0.64;
              d[(y * TW + x) * 4 + 3] = isTorsoCol ? 0 : origA[y * TW + x];
            }
            continue;
          }
          // Only extend laterally when the garment spans across the ribcage/hips/shoulders (width > 12% of frame),
          // NOT on narrow central Basque V-tips (`width < 12%`) so V-tips stay razor-sharp!
          const spanFrac = (rowRight - rowLeft) / TW;
          if (spanFrac > 0.13 && ynRow > minYn + 0.028) {
            for (let x = 0; x < rowLeft; x++) d[(y * TW + x) * 4 + 3] = 255;
            for (let x = rowLeft; x <= rowRight; x++) {
              d[(y * TW + x) * 4 + 3] = origA[y * TW + x];
            }
            for (let x = rowRight + 1; x < TW; x++) {
              d[(y * TW + x) * 4 + 3] = 255;
            }
          } else {
            for (let x = 0; x < TW; x++) {
              d[(y * TW + x) * 4 + 3] = origA[y * TW + x];
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);

      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;

      resolve({
        texture: tex,
        alphaGrid,
        rawImage: im,
        minYn,
        maxYn,
      });
    };
    im.onerror = (err) => {
      BLED_TEX_CACHE.delete(cacheKey);
      reject(err);
    };
    im.src = url;
  });

  BLED_TEX_CACHE.set(cacheKey, p);
  return p;
}

export function sampleMeshAlphaAtUv(
  mesh: THREE.Object3D,
  _uv?: THREE.Vector2
): number {
  void _uv;
  return mesh ? 255 : 0;
}

// ============================================================================
// INTERPOLATION OF ANATOMICAL 3D CROSS-SECTION PROFILES
// ============================================================================

function sampleSagittalRing(
  table: readonly SagittalTubeRing[],
  yn: number
): { xc: number; rx: number; zBack: number; zFront: number } {
  if (yn <= table[0][0]) {
    return {
      xc: table[0][1],
      rx: table[0][2],
      zBack: table[0][3],
      zFront: table[0][4],
    };
  }
  const last = table[table.length - 1];
  if (yn >= last[0]) {
    return { xc: last[1], rx: last[2], zBack: last[3], zFront: last[4] };
  }
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (yn >= a[0] && yn <= b[0]) {
      const t = (yn - a[0]) / Math.max(1e-6, b[0] - a[0]);
      return {
        xc: a[1] + (b[1] - a[1]) * t,
        rx: a[2] + (b[2] - a[2]) * t,
        zBack: a[3] + (b[3] - a[3]) * t,
        zFront: a[4] + (b[4] - a[4]) * t,
      };
    }
  }
  return { xc: last[1], rx: last[2], zBack: last[3], zFront: last[4] };
}

function samplePairedLimbRing(
  table: readonly PairedLimbRing[],
  yn: number,
  side: "right" | "left"
): { xc: number; rx: number; zBack: number; zFront: number } {
  const pick = (row: PairedLimbRing) =>
    side === "right"
      ? { xc: row[1], rx: row[2], zBack: row[5], zFront: row[6] }
      : { xc: row[3], rx: row[4], zBack: row[5], zFront: row[6] };

  if (yn <= table[0][0]) return pick(table[0]);
  const last = table[table.length - 1];
  if (yn >= last[0]) return pick(last);
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i];
    const b = table[i + 1];
    if (yn >= a[0] && yn <= b[0]) {
      const t = (yn - a[0]) / Math.max(1e-6, b[0] - a[0]);
      const pa = pick(a);
      const pb = pick(b);
      return {
        xc: pa.xc + (pb.xc - pa.xc) * t,
        rx: pa.rx + (pb.rx - pa.rx) * t,
        zBack: pa.zBack + (pb.zBack - pa.zBack) * t,
        zFront: pa.zFront + (pb.zFront - pa.zFront) * t,
      };
    }
  }
  return pick(last);
}

interface TubeSliceSpec {
  yn: number;
  xc: number;
  rx: number;
  zBack: number;
  zFront: number;
}

/**
 * Builds a closed, watertight 360° 3D hull `THREE.BufferGeometry` using unit vector `aAzDir = (sin θ, cos θ)`
 * so there is ZERO `±π` angle-wrap interpolation seam anywhere on closed or open-front meshes!
 */
function buildWatertight3DTubeGeometry(params: {
  slices: TubeSliceSpec[];
  radialSegs?: number;
  radialOffsetM?: number;
  superEllipseExp?: number;
  capBottom?: boolean;
  capTop?: boolean;
  isCraniofacial?: boolean;
  isPelvicYoke?: boolean;
  openFrontHalfAngleFn?: (yn: number) => number;
}): THREE.BufferGeometry {
  const {
    slices,
    radialSegs = 64,
    radialOffsetM = 0.0,
    superEllipseExp = 1.9,
    capBottom = true,
    capTop = true,
    isCraniofacial = false,
    isPelvicYoke = false,
    openFrontHalfAngleFn,
  } = params;

  const R = slices.length;
  const S = radialSegs;
  const positions: number[] = [];
  const restAttr: number[] = [];
  const azDirAttr: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const sPow = 2.0 / superEllipseExp;
  const signedPow = (val: number, exp: number) =>
    Math.sign(val) * Math.pow(Math.abs(val), exp);

  const hasOpenFront = Boolean(openFrontHalfAngleFn);

  for (let i = 0; i < R; i++) {
    const sl = slices[i];
    const openHalf = openFrontHalfAngleFn ? openFrontHalfAngleFn(sl.yn) : 0.0;

    for (let j = 0; j <= S; j++) {
      const frac = j / S;
      let theta: number;
      if (hasOpenFront && openHalf > 0.01) {
        const span = Math.PI * 2 - 2.0 * openHalf;
        const rawT = openHalf + frac * span;
        theta = rawT > Math.PI ? rawT - Math.PI * 2 : rawT;
      } else {
        theta = -Math.PI + frac * Math.PI * 2;
      }

      const sinRaw = Math.sin(theta);
      const cosRaw = Math.cos(theta);
      const sinT = signedPow(sinRaw, sPow);
      const cosT = signedPow(cosRaw, sPow);

      const zc = 0.5 * (sl.zFront + sl.zBack);
      const rzBase = Math.max(0.008, 0.5 * (sl.zFront - sl.zBack));
      const rxEff = Math.max(0.004, sl.rx + radialOffsetM);
      const rzEff = Math.max(0.004, rzBase + radialOffsetM);

      let lapelTurnIn = 0.0;
      if (hasOpenFront && openHalf > 0.01) {
        if (j === 0 || j === S) lapelTurnIn = -0.0045;
        else if (j === 1 || j === S - 1) lapelTurnIn = -0.0015;
      }

      // Localized central 3D nose bridge, nose tip & lips relief on `HeadAndNeck3D` (zero cheek shelf!)
      let facialZRelief = 0.0;
      if (isCraniofacial && cosRaw > 0.0) {
        const noseBell =
          Math.exp(-Math.pow(theta / 0.23, 2.0)) *
          Math.exp(-Math.pow((sl.yn - 0.885) / 0.015, 2.0)) *
          0.021;
        const bridgeBell =
          Math.exp(-Math.pow(theta / 0.20, 2.0)) *
          Math.exp(-Math.pow((sl.yn - 0.903) / 0.012, 2.0)) *
          0.008;
        const lipBell =
          Math.exp(-Math.pow(theta / 0.30, 2.0)) *
          Math.exp(-Math.pow((sl.yn - 0.861) / 0.008, 2.0)) *
          0.0055;
        facialZRelief = noseBell + bridgeBell + lipBell;
      }

      // Tailored central fly/glute crease inward tuck at bottom of `PelvicYoke` so zero crotch notch appears at 35°!
      let crotchCreaseZ = 1.0;
      if (isPelvicYoke) {
        const yBot = slices[0].yn;
        const lowT = 1.0 - smoothstepJS(yBot, yBot + 0.068, sl.yn);
        const centerAlign = Math.exp(-Math.pow(sinRaw / 0.28, 2.0));
        crotchCreaseZ = 1.0 - 0.58 * lowT * centerAlign;
      }

      const x = sl.xc + (rxEff + lapelTurnIn) * sinT;
      const z =
        (zc + (rzEff + lapelTurnIn) * cosT) * crotchCreaseZ + facialZRelief;
      const y = sl.yn * BASE_CHAR_HEIGHT_M;

      positions.push(x, y, z);
      restAttr.push(x, y, z, 1.0);
      azDirAttr.push(sinRaw, cosRaw);
      uvs.push(frac, sl.yn);
    }
  }

  const stride = S + 1;
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, c, a, c, b);
    }
  }

  if (!hasOpenFront && capBottom && R > 0) {
    const sl0 = slices[0];
    const cIdx = positions.length / 3;
    const zc0 = 0.5 * (sl0.zFront + sl0.zBack);
    const y0 = sl0.yn * BASE_CHAR_HEIGHT_M;
    positions.push(sl0.xc, y0, zc0);
    restAttr.push(sl0.xc, y0, zc0, 1.0);
    azDirAttr.push(0.0, 1.0);
    uvs.push(0.5, sl0.yn);
    for (let j = 0; j < S; j++) {
      indices.push(cIdx, j + 1, j);
    }
  }

  if (!hasOpenFront && capTop && R > 0) {
    const slTop = slices[R - 1];
    const baseRow = (R - 1) * stride;
    const cIdx = positions.length / 3;
    const zcT = 0.5 * (slTop.zFront + slTop.zBack);
    const yT = slTop.yn * BASE_CHAR_HEIGHT_M;
    positions.push(slTop.xc, yT, zcT);
    restAttr.push(slTop.xc, yT, zcT, 1.0);
    azDirAttr.push(0.0, -1.0);
    uvs.push(0.5, slTop.yn);
    for (let j = 0; j < S; j++) {
      indices.push(cIdx, baseRow + j, baseRow + j + 1);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute(
    "aModelRest",
    new THREE.Float32BufferAttribute(restAttr, 4)
  );
  geom.setAttribute(
    "aAzDir",
    new THREE.Float32BufferAttribute(azDirAttr, 2)
  );
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

// ============================================================================
// VOLUMETRIC 3D TRI-VIEW SHADER & BODY-SCAN INCH MORPHING
// ============================================================================

export interface BodyMorphUniforms {
  uFrontMap: { value: THREE.Texture | null };
  uBackMap: { value: THREE.Texture | null };
  uSideMap: { value: THREE.Texture | null };
  uHeightScale: { value: number };
  uBodyScales: { value: THREE.Vector4 };
  uIsRigidBag: { value: number };
  uEaseOffsetM: { value: number };
  uLightMoodTint: { value: THREE.Color };
  uFresnelSheen: { value: number };
  uSheenColor: { value: THREE.Color };
  uClipMinYn: { value: number };
  uClipMaxYn: { value: number };
  uSideMinYn: { value: number };
  uSideMaxYn: { value: number };
  uAlphaCutout: { value: number };
  uLimbFrontBackOnly: { value: number };
  uHeatmapMix: { value: number };
  uBustColor: { value: THREE.Color };
  uWaistColor: { value: THREE.Color };
  uHipColor: { value: THREE.Color };
}

export function createBodyMorphUniforms(): BodyMorphUniforms {
  return {
    uFrontMap: { value: null },
    uBackMap: { value: null },
    uSideMap: { value: null },
    uHeightScale: { value: 1.0 },
    uBodyScales: { value: new THREE.Vector4(1, 1, 1, 1) },
    uIsRigidBag: { value: 0.0 },
    uEaseOffsetM: { value: 0.0 },
    uLightMoodTint: { value: new THREE.Color("#FFFFFF") },
    uFresnelSheen: { value: 0.12 },
    uSheenColor: { value: new THREE.Color("#FFFFFF") },
    uClipMinYn: { value: -0.05 },
    uClipMaxYn: { value: 1.05 },
    uSideMinYn: { value: -0.05 },
    uSideMaxYn: { value: 1.05 },
    uAlphaCutout: { value: 0.0 },
    uLimbFrontBackOnly: { value: 0.0 },
    uHeatmapMix: { value: 0.0 },
    uBustColor: { value: new THREE.Color("#10B981") },
    uWaistColor: { value: new THREE.Color("#10B981") },
    uHipColor: { value: new THREE.Color("#10B981") },
  };
}

function feelToHex(feel?: ZoneFeel): string {
  switch (feel) {
    case "too_tight":
      return "#EF4444";
    case "sculpted_snug":
      return "#F59E0B";
    case "tailored_ideal":
      return "#10B981";
    case "relaxed_skim":
      return "#06B6D4";
    case "oversized_roomy":
    default:
      return "#6366F1";
  }
}

export function syncBodyMorphUniforms(
  uniforms: BodyMorphUniforms,
  rawDims: BodyScanDimensions,
  visualMode: Render3DVisualMode,
  isGarment: boolean,
  isRigidBag: boolean,
  fit?: AvatarExactFitReport,
  fabricProfile?: FabricPhysicsProfile
): void {
  const dims = enforceRealisticAvatarAnatomy(rawDims);
  const std = MASTER_AVATAR_ANATOMY_STANDARD;
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));

  uniforms.uHeightScale.value = clamp(
    dims.heightInches / std.canonicalHeightInches,
    0.92,
    1.15
  );
  uniforms.uBodyScales.value.set(
    clamp(dims.shoulderInches / std.canonicalShoulderInches, 0.9, 1.18),
    clamp(dims.bustInches / std.canonicalBustInches, 0.88, 1.28),
    clamp(dims.waistInches / std.canonicalWaistInches, 0.82, 1.28),
    clamp(dims.hipsInches / std.canonicalHipsInches, 0.88, 1.3)
  );
  uniforms.uIsRigidBag.value = isRigidBag ? 1.0 : 0.0;
  uniforms.uHeatmapMix.value =
    isGarment && !isRigidBag && visualMode === "heatmap" ? 0.36 : 0.0;

  if (!isGarment) {
    uniforms.uFresnelSheen.value = 0.085;
    uniforms.uSheenColor.value.set("#FFF7F0");
    uniforms.uEaseOffsetM.value = 0.0;
  } else if (fabricProfile) {
    uniforms.uFresnelSheen.value = fabricProfile.fresnelSheen;
    uniforms.uSheenColor.value.set(fabricProfile.sheenTintHex);
    uniforms.uEaseOffsetM.value = isRigidBag
      ? 0.0
      : computePhysicalEaseExpansionMeters(fit, fabricProfile, false);
  }

  if (fit) {
    const bFeel = fit.zones.find((z) => z.zone === "Bust")?.feel;
    const wFeel = fit.zones.find((z) => z.zone === "Waist")?.feel;
    const hFeel = fit.zones.find((z) => z.zone === "Hips")?.feel;
    uniforms.uBustColor.value.set(feelToHex(bFeel || "tailored_ideal"));
    uniforms.uWaistColor.value.set(feelToHex(wFeel || "tailored_ideal"));
    uniforms.uHipColor.value.set(feelToHex(hFeel || "tailored_ideal"));
  }
}

export function createVolumetric3DHullMaterial(
  uniforms: BodyMorphUniforms,
  doubleSided = false
): THREE.ShaderMaterial {
  const lockY = MASTER_AVATAR_ANATOMY_STANDARD.craniofacialLockNormY.toFixed(4);
  const wMeters = BASE_CHAR_WIDTH_M.toFixed(5);

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: false,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexShader: `
      attribute vec4 aModelRest;
      attribute vec2 aAzDir;
      uniform float uHeightScale;
      uniform vec4 uBodyScales;
      uniform float uIsRigidBag;
      uniform float uEaseOffsetM;
      varying vec4 vRest;
      varying vec2 vAzDir;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vRest = aModelRest;
        vAzDir = aAzDir;
        vec3 p = position;
        float yn = clamp(aModelRest.y / 1.58, 0.0, 1.0);

        if (uIsRigidBag > 0.5) {
          float anchorScale = yn > 0.56 ? uBodyScales.x : uBodyScales.w;
          p.x += (anchorScale - 1.0) * sign(p.x) * 0.125;
          p.y *= uHeightScale;
        } else {
          float wScale = 1.0;
          if (yn > ${lockY}) {
            wScale = 1.0;
          } else if (yn > 0.805) {
            wScale = mix(uBodyScales.x, 1.0, smoothstep(0.805, ${lockY}, yn));
          } else if (yn > 0.725) {
            wScale = mix(uBodyScales.y, uBodyScales.x, smoothstep(0.725, 0.805, yn));
          } else if (yn > 0.605) {
            wScale = mix(uBodyScales.z, uBodyScales.y, smoothstep(0.605, 0.725, yn));
          } else if (yn > 0.465) {
            wScale = mix(uBodyScales.w, uBodyScales.z, smoothstep(0.465, 0.605, yn));
          } else if (yn > 0.12) {
            wScale = mix(1.0, uBodyScales.w, smoothstep(0.12, 0.465, yn));
          }

          float zScale = mix(1.0, wScale, 0.78);
          p.x *= wScale;
          p.z *= zScale;

          if (abs(uEaseOffsetM) > 0.00005 && yn < 0.80 && yn > 0.12) {
            vec2 radDir = normalize(vec2(normal.x, normal.z) + vec2(0.0001));
            p.x += radDir.x * uEaseOffsetM;
            p.z += radDir.y * uEaseOffsetM;
          }

          float chinM = 1.58 * ${lockY};
          if (p.y > chinM) {
            p.y = chinM * uHeightScale + (p.y - chinM);
          } else {
            p.y *= uHeightScale;
          }
        }

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uFrontMap;
      uniform sampler2D uBackMap;
      uniform sampler2D uSideMap;
      uniform vec3 uLightMoodTint;
      uniform float uFresnelSheen;
      uniform vec3 uSheenColor;
      uniform float uClipMinYn;
      uniform float uClipMaxYn;
      uniform float uSideMinYn;
      uniform float uSideMaxYn;
      uniform float uAlphaCutout;
      uniform float uLimbFrontBackOnly;
      uniform float uHeatmapMix;
      uniform vec3 uBustColor;
      uniform vec3 uWaistColor;
      uniform vec3 uHipColor;
      varying vec4 vRest;
      varying vec2 vAzDir;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        float yn = clamp(vRest.y / 1.58, 0.002, 0.998);
        if (yn < uClipMinYn || yn > uClipMaxYn) {
          discard;
        }

        float uFront = clamp(0.5 + vRest.x / ${wMeters}, 0.004, 0.996);
        float uBack  = clamp(0.5 - vRest.x / ${wMeters}, 0.004, 0.996);
        float uSide  = clamp(0.5 + vRest.z / ${wMeters}, 0.004, 0.996);

        vec4 sFront = texture2D(uFrontMap, vec2(uFront, yn));
        vec4 sBack  = texture2D(uBackMap,  vec2(uBack,  yn));
        vec4 sSide  = texture2D(uSideMap,  vec2(uSide,  yn));

        // Mask side donor vertical range so top/skirt/corset hems cut cleanly at ±90° too!
        float sideBandMask = step(uSideMinYn, yn) * (1.0 - step(uSideMaxYn, yn));
        float aSideEff = sSide.a * sideBandMask;

        vec2 az = normalize(vAzDir + vec2(0.0, 0.00001));
        float absAz = acos(clamp(az.y, -1.0, 1.0));

        float wF;
        float wB;
        float wS;
        if (uLimbFrontBackOnly > 0.5) {
          wF = smoothstep(-0.42, 0.42, az.y);
          wB = 1.0 - wF;
          wS = 0.0;
        } else {
          wF = 1.0 - smoothstep(0.88, 1.32, absAz);
          wB = smoothstep(1.82, 2.26, absAz);
          wS = max(0.0, 1.0 - wF - wB);
        }

        if (uAlphaCutout > 0.01) {
          float effAlpha = sFront.a * wF + aSideEff * wS + sBack.a * wB;
          if (effAlpha < uAlphaCutout) {
            discard;
          }
        }

        vec3 baseRgb = sFront.rgb * wF + sSide.rgb * wS + sBack.rgb * wB;

        vec3 n = normalize(vNormalView);
        if (!gl_FrontFacing) n = -n;
        vec3 v = normalize(vViewDir);

        vec3 keyLight  = normalize(vec3(0.38, 0.46, 0.80));
        vec3 fillLight = normalize(vec3(-0.52, 0.18, 0.62));
        vec3 rimLight  = normalize(vec3(0.0, 0.35, -0.94));

        float ndlKey  = max(dot(n, keyLight), 0.0);
        float ndlFill = max(dot(n, fillLight), 0.0);
        float ndlRim  = max(dot(n, rimLight), 0.0);

        float formLight = 0.89 + 0.11 * ndlKey + 0.045 * ndlFill + 0.035 * ndlRim;
        vec3 col = baseRgb * formLight * mix(vec3(1.0), uLightMoodTint, 0.15);

        float ndv = clamp(dot(n, v), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 2.6);
        vec3 halfVec = normalize(keyLight + v);
        float spec = pow(max(dot(n, halfVec), 0.0), 22.0);
        col += uSheenColor * (spec * 0.075 + fresnel * 0.13) * uFresnelSheen;

        if (uHeatmapMix > 0.01 && yn < 0.78 && yn > 0.13) {
          vec3 zoneCol = uHipColor;
          if (yn > 0.68) {
            zoneCol = mix(uWaistColor, uBustColor, smoothstep(0.68, 0.76, yn));
          } else if (yn > 0.56) {
            zoneCol = mix(uHipColor, uWaistColor, smoothstep(0.56, 0.64, yn));
          }
          col = mix(col, zoneCol, uHeatmapMix);
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

// ============================================================================
// 1. SEAMLESS WATERTIGHT 360° 3D CHARACTER RIG (`loadCharacter3DRig`)
// ============================================================================

export interface Character3DRig {
  rootGroup: THREE.Group;
  headMesh: THREE.Mesh;
  hairMesh: THREE.Mesh;
  torsoMesh: THREE.Mesh;
  rightArmMesh: THREE.Mesh;
  leftArmMesh: THREE.Mesh;
  rightLegMesh: THREE.Mesh;
  leftLegMesh: THREE.Mesh;
  uniformsList: BodyMorphUniforms[];
  applyOcclusionState: (opts: {
    hasClothes: boolean;
    hasBottom: boolean;
    bottomMinYn: number;
    hasDress: boolean;
    dressMinYn: number;
    hasShinCoveringPants: boolean;
    hasLongSleeves: boolean;
    hasShoes: boolean;
    hasTallBoots: boolean;
  }) => void;
}

export async function loadCharacter3DRig(): Promise<Character3DRig> {
  const [fClean, bClean, sClean, fSkin, bSkin, hFront, hBack, hSide] =
    await Promise.all([
      loadBled3DViewTexture(modLayerUrl("base_front")),
      loadBled3DViewTexture(modLayerUrl("base_back")),
      loadBled3DViewTexture(modLayerUrl("base_side")),
      loadBled3DViewTexture(modLayerUrl("base_front"), {
        stripBaseShapewear: true,
      }),
      loadBled3DViewTexture(modLayerUrl("base_back"), {
        stripBaseShapewear: true,
      }),
      loadBled3DViewTexture(modLayerUrl("hair_over_front"), {
        alphaMode: "exact_mask",
        sealHairCrownFront: true,
      }),
      loadBled3DViewTexture(modLayerUrl("hair_over_back"), {
        alphaMode: "exact_mask",
        sealHairCrownBack: true,
      }),
      loadBled3DViewTexture(modLayerUrl("base_side"), {
        isolateDarkHairSide: true,
        sealHairCrownBack: true,
      }),
    ]);

  const rootGroup = new THREE.Group();
  rootGroup.name = "Watertight3DCharacterRig";
  const uniformsList: BodyMorphUniforms[] = [];

  const makePartUniforms = (useSkinTorso = false) => {
    const u = createBodyMorphUniforms();
    u.uFrontMap.value = useSkinTorso ? fSkin.texture : fClean.texture;
    u.uBackMap.value = useSkinTorso ? bSkin.texture : bClean.texture;
    u.uSideMap.value = sClean.texture;
    uniformsList.push(u);
    return u;
  };

  // A. 3D Head & Neck Hull (clean facial skin + localized 3D nose & lip relief)
  const headSlices: TubeSliceSpec[] = HEAD_NECK_3D_RINGS.map((r) => ({
    yn: r[0],
    xc: r[1],
    rx: r[2],
    zBack: r[3],
    zFront: r[4],
  }));
  const headU = makePartUniforms(false);
  const headMesh = new THREE.Mesh(
    buildWatertight3DTubeGeometry({
      slices: headSlices,
      radialSegs: 72,
      superEllipseExp: 2.0,
      isCraniofacial: true,
    }),
    createVolumetric3DHullMaterial(headU)
  );
  headMesh.name = "HeadAndNeck3D";

  // B. 360° Volumetric Wavy Hair Canopy (`hair_over_front` + `hair_over_back` + isolated dark side hair — zero shapewear bleed!)
  const hairSlices: TubeSliceSpec[] = HAIR_CANOPY_3D_RINGS.map((r) => ({
    yn: r[0],
    xc: r[1],
    rx: r[2],
    zBack: r[3],
    zFront: r[4],
  }));
  const hairU = createBodyMorphUniforms();
  hairU.uFrontMap.value = hFront.texture;
  hairU.uBackMap.value = hBack.texture;
  hairU.uSideMap.value = hSide.texture;
  hairU.uAlphaCutout.value = 0.36;
  uniformsList.push(hairU);

  const hairMesh = new THREE.Mesh(
    buildWatertight3DTubeGeometry({
      slices: hairSlices,
      radialSegs: 72,
      radialOffsetM: 0.0025,
      superEllipseExp: 1.95,
      capBottom: false,
      capTop: true,
    }),
    createVolumetric3DHullMaterial(hairU, true)
  );
  hairMesh.name = "HairCanopy3D";

  // C. Continuous Shoulder-Girdle, Bust, Waist & Pelvis 3D Hull
  const torsoSlices: TubeSliceSpec[] = TORSO_PELVIS_3D_RINGS.map((r) => ({
    yn: r[0],
    xc: r[1],
    rx: r[2],
    zBack: r[3],
    zFront: r[4],
  }));
  const torsoU = makePartUniforms(true);
  const torsoMesh = new THREE.Mesh(
    buildWatertight3DTubeGeometry({
      slices: torsoSlices,
      radialSegs: 72,
      superEllipseExp: 1.82,
    }),
    createVolumetric3DHullMaterial(torsoU)
  );
  torsoMesh.name = "TorsoPelvis3D";

  // D. Paired Cylindrical 3D Arms & Tapered Hands (`uLimbFrontBackOnly = 1.0` for 100% clean skin all 360° around!)
  const buildArm = (side: "right" | "left") => {
    const slices: TubeSliceSpec[] = ARMS_3D_RINGS.map((r) => ({
      yn: r[0],
      ...samplePairedLimbRing([r], r[0], side),
    }));
    const u = makePartUniforms(true);
    u.uLimbFrontBackOnly.value = 1.0;
    const mesh = new THREE.Mesh(
      buildWatertight3DTubeGeometry({
        slices,
        radialSegs: 40,
        superEllipseExp: 2.0,
      }),
      createVolumetric3DHullMaterial(u)
    );
    mesh.name = side === "right" ? "RightArm3D" : "LeftArm3D";
    return { mesh, u };
  };
  const rightArm = buildArm("right");
  const leftArm = buildArm("left");

  // E. Paired Sculpted 3D Legs & Feet
  const buildLeg = (side: "right" | "left") => {
    const slices: TubeSliceSpec[] = LEGS_FEET_3D_RINGS.map((r) => ({
      yn: r[0],
      ...samplePairedLimbRing([r], r[0], side),
    }));
    const u = makePartUniforms(true);
    const mesh = new THREE.Mesh(
      buildWatertight3DTubeGeometry({
        slices,
        radialSegs: 48,
        superEllipseExp: 1.95,
      }),
      createVolumetric3DHullMaterial(u)
    );
    mesh.name = side === "right" ? "RightLeg3D" : "LeftLeg3D";
    return { mesh, u };
  };
  const rightLeg = buildLeg("right");
  const leftLeg = buildLeg("left");

  rootGroup.add(
    headMesh,
    hairMesh,
    torsoMesh,
    rightArm.mesh,
    leftArm.mesh,
    rightLeg.mesh,
    leftLeg.mesh
  );

  const applyOcclusionState: Character3DRig["applyOcclusionState"] = ({
    hasClothes,
    hasBottom,
    bottomMinYn,
    hasDress,
    dressMinYn,
    hasShinCoveringPants,
    hasLongSleeves,
    hasShoes,
    hasTallBoots,
  }) => {
    torsoU.uFrontMap.value = hasClothes ? fSkin.texture : fClean.texture;
    torsoU.uBackMap.value = hasClothes ? bSkin.texture : bClean.texture;

    torsoU.uClipMinYn.value = hasDress
      ? 0.735
      : hasBottom
      ? 0.565
      : -0.05;
    torsoU.uClipMaxYn.value = 1.05;

    rightArm.u.uClipMaxYn.value = hasLongSleeves ? 0.502 : 1.05;
    leftArm.u.uClipMaxYn.value = hasLongSleeves ? 0.502 : 1.05;

    if (hasShinCoveringPants) {
      rightLeg.u.uClipMinYn.value = hasShoes ? 0.088 : -0.05;
      rightLeg.u.uClipMaxYn.value = hasShoes ? 0.075 : 0.085;
      leftLeg.u.uClipMinYn.value = hasShoes ? 0.088 : -0.05;
      leftLeg.u.uClipMaxYn.value = hasShoes ? 0.075 : 0.085;
    } else {
      const skirtUpperClip = hasBottom
        ? Math.min(0.51, bottomMinYn + 0.035)
        : 1.05;
      rightLeg.u.uClipMinYn.value = hasTallBoots
        ? 0.255
        : hasShoes
        ? 0.086
        : -0.05;
      rightLeg.u.uClipMaxYn.value = hasDress
        ? Math.max(0.28, dressMinYn + 0.025)
        : skirtUpperClip;
      leftLeg.u.uClipMinYn.value = hasTallBoots
        ? 0.255
        : hasShoes
        ? 0.086
        : -0.05;
      leftLeg.u.uClipMaxYn.value = hasDress
        ? Math.max(0.28, dressMinYn + 0.025)
        : skirtUpperClip;
    }
  };

  return {
    rootGroup,
    headMesh,
    hairMesh,
    torsoMesh,
    rightArmMesh: rightArm.mesh,
    leftArmMesh: leftArm.mesh,
    rightLegMesh: rightLeg.mesh,
    leftLegMesh: leftLeg.mesh,
    uniformsList,
    applyOcclusionState,
  };
}

// ============================================================================
// 2. INDIVIDUAL WATERTIGHT 3D WEARABLE GARMENTS & 3D PURSES (`loadWearable3DItemRig`)
// ============================================================================

export interface Wearable3DItemRig {
  product: Product;
  slot: WearableSlotType;
  isRigidBag: boolean;
  hasLongSleeves: boolean;
  isTallBoot: boolean;
  minYn: number;
  maxYn: number;
  fabric: FabricPhysicsProfile;
  group: THREE.Group;
  uniformsList: BodyMorphUniforms[];
  dispose: () => void;
}

function resolveSideDonorSpec(
  product: Product,
  slot: WearableSlotType
): { sideSlug: string; tintHex: string | null; tintYRange?: [number, number] } {
  const id = product.id;

  if (slot === "top") {
    if (id === "prod-ae-blush-ruched-offshoulder")
      return { sideSlug: "side_clean_10", tintHex: null };
    if (id === "prod-ae-butter-silk-cami")
      return { sideSlug: "side_clean_15", tintHex: null };
    if (id === "prod-ae-emerald-silk-cami")
      return {
        sideSlug: "side_clean_15",
        tintHex: product.colorHex,
        tintYRange: [250, 540],
      };
    if (id === "prod-ae-noir-halter-vest" || id === "prod-ae-noir-satin-corset")
      return { sideSlug: "side_clean_11", tintHex: null };
    return {
      sideSlug: "side_clean_11",
      tintHex: product.colorHex,
      tintYRange: [250, 545],
    };
  }

  if (slot === "bottom") {
    if (id === "prod-ae-champagne-trousers")
      return { sideSlug: "side_clean_0", tintHex: null };
    if (id === "prod-ae-vintage-wide-denim")
      return { sideSlug: "side_clean_9", tintHex: null };
    if (id === "prod-ae-charcoal-pinstripe-trousers")
      return { sideSlug: "side_clean_11", tintHex: null };
    if (
      id === "prod-ae-obsidian-wide-trousers" ||
      id === "prod-ae-olive-pleated-trousers"
    )
      return {
        sideSlug: "side_clean_11",
        tintHex: product.colorHex,
        tintYRange: [510, 1265],
      };
    if (id === "prod-ae-sage-flare-leggings")
      return { sideSlug: "side_clean_8", tintHex: null };
    if (id === "prod-ae-espresso-tailored-shorts")
      return { sideSlug: "side_clean_15", tintHex: null };
    if (id === "prod-ae-ivory-satin-bias-midi")
      return { sideSlug: "side_clean_10", tintHex: null };
    if (id === "prod-ae-chocolate-satin-midi")
      return {
        sideSlug: "side_clean_10",
        tintHex: product.colorHex,
        tintYRange: [505, 1175],
      };
    if (id === "prod-ae-noir-pleated-mini")
      return {
        sideSlug: "side_clean_1",
        tintHex: "#18191E",
        tintYRange: [500, 775],
      };
    if (id === "prod-ae-burgundy-pleated-mini")
      return {
        sideSlug: "side_clean_1",
        tintHex: product.colorHex,
        tintYRange: [500, 775],
      };
    return {
      sideSlug: "side_clean_0",
      tintHex: product.colorHex,
      tintYRange: [505, 1265],
    };
  }

  if (slot === "dress") {
    const dm = MOD_DRESS_SLUG[id];
    const sideIdx = dm ? dm.sideOutfitIdx : 2;
    const needsTint =
      id === "prod-ae-sapphire-satin-midi" ||
      id === "prod-ae-onyx-satin-midi" ||
      id === "prod-ae-rosewood-corset-mini" ||
      id === "prod-ae-noir-tuxedo-blazer-dress" ||
      !dm;
    return {
      sideSlug: `side_clean_${sideIdx}`,
      tintHex: needsTint ? product.colorHex : null,
      tintYRange: [240, 1165],
    };
  }

  if (slot === "outerwear") {
    const om = MOD_OUTER_SLUG[id];
    const sideIdx = om ? om.sideOutfitIdx : 7;
    const needsTint =
      id === "prod-ae-emerald-tweed-blazer" ||
      id === "prod-ae-espresso-tailored-blazer" ||
      id === "prod-ae-charcoal-wool-coat" ||
      !om;
    return {
      sideSlug: `side_clean_${sideIdx}`,
      tintHex: needsTint ? product.colorHex : null,
      tintYRange: [235, 960],
    };
  }

  if (slot === "shoes") {
    if (id === "prod-ae-meotina-leather-boots")
      return { sideSlug: "side_clean_13", tintHex: null };
    if (id === "prod-ae-cloud-platform-sneakers")
      return { sideSlug: "side_clean_8", tintHex: null };
    if (id === "prod-ae-gold-strappy-heels")
      return { sideSlug: "side_clean_10", tintHex: null };
    if (id === "prod-ae-silver-crystal-heels")
      return { sideSlug: "side_clean_12", tintHex: null };
    if (id === "prod-ae-burgundy-patent-heels")
      return { sideSlug: "side_clean_15", tintHex: null };
    if (id === "prod-ae-ivory-patent-slingbacks")
      return {
        sideSlug: "side_clean_11",
        tintHex: "#EDEAE2",
        tintYRange: [1220, 1345],
      };
    return { sideSlug: "side_clean_11", tintHex: null };
  }

  return {
    sideSlug: "side_clean_11",
    tintHex: product.colorHex,
    tintYRange: [500, 580],
  };
}

function measureGarmentHalfWidthAtYn(
  grid: Uint8Array,
  yn: number,
  maxHalfPx = 148
): number | null {
  const r = Math.min(
    ALPHA_GRID_H - 1,
    Math.max(0, Math.round((1.0 - yn) * (ALPHA_GRID_H - 1)))
  );
  const centerC = ALPHA_GRID_W * 0.5;
  const limitC = (maxHalfPx / 900) * ALPHA_GRID_W;
  let minC = ALPHA_GRID_W;
  let maxC = -1;
  for (let c = 0; c < ALPHA_GRID_W; c++) {
    if (Math.abs(c - centerC) > limitC) continue;
    if (grid[r * ALPHA_GRID_W + c] > 80) {
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (maxC < minC) return null;
  return ((maxC - minC + 1) / ALPHA_GRID_W) * BASE_CHAR_WIDTH_M * 0.5;
}

function measureSideSagittalSpanAtYn(
  sideGrid: Uint8Array,
  yn: number
): { zBack: number; zFront: number } | null {
  const r = Math.min(
    ALPHA_GRID_H - 1,
    Math.max(0, Math.round((1.0 - yn) * (ALPHA_GRID_H - 1)))
  );
  let minC = ALPHA_GRID_W;
  let maxC = -1;
  for (let c = 0; c < ALPHA_GRID_W; c++) {
    if (sideGrid[r * ALPHA_GRID_W + c] > 80) {
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
  }
  if (maxC < minC) return null;
  return {
    zBack: (minC / ALPHA_GRID_W - 0.5) * BASE_CHAR_WIDTH_M,
    zFront: ((maxC + 1) / ALPHA_GRID_W - 0.5) * BASE_CHAR_WIDTH_M,
  };
}

function measureOuterSideHemSpanYn(grid: Uint8Array): [number, number] {
  // Measures the vertical span near the ribcage/waist sides (|c - 45| in 7..12) so side profile cuts at side hem, not central Basque V-tip!
  let minR = ALPHA_GRID_H - 1;
  let maxR = 0;
  for (let r = 0; r < ALPHA_GRID_H; r++) {
    let hitSide = false;
    for (const c of [35, 36, 37, 38, 52, 53, 54, 55]) {
      if (grid[r * ALPHA_GRID_W + c] > 90) {
        hitSide = true;
        break;
      }
    }
    if (hitSide) {
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }
  if (minR > maxR) return [0.58, 0.76];
  return [1.0 - (maxR + 1) / ALPHA_GRID_H, 1.0 - minR / ALPHA_GRID_H];
}

const SHOULDER_BAG_IDS = new Set<string>([
  "prod-ae-burgundy-crescent-bag",
  "prod-ae-noir-quilted-bag",
  "prod-ae-silver-metallic-shoulder-bag",
  "prod-ae-espresso-suede-crescent-bag",
]);

async function buildWatertight3DPurseRig(
  product: Product,
  fabric: FabricPhysicsProfile
): Promise<Wearable3DItemRig> {
  const slug = MOD_BAG_SLUG[product.id];
  const titleL = `${product.title} ${product.silhouette}`.toLowerCase();
  const isShoulder =
    SHOULDER_BAG_IDS.has(product.id) ||
    (!slug &&
      (titleL.includes("shoulder") ||
        titleL.includes("crescent") ||
        titleL.includes("quilted") ||
        titleL.includes("hobo")));
  const isQuilted = product.id === "prod-ae-noir-quilted-bag";

  const rawBagUrl = slug
    ? modLayerUrl(`${slug}_front`)
    : await isolateProductBackgroundClient(product.imageUrl || "");
  const backBagUrl = slug ? modLayerUrl(`${slug}_back`) : rawBagUrl;

  const [fBag, bBag] = await Promise.all([
    loadBled3DViewTexture(rawBagUrl),
    loadBled3DViewTexture(backBagUrl),
  ]);

  const group = new THREE.Group();
  group.name = `Purse3D_${product.id}`;
  const geomsToDispose: THREE.BufferGeometry[] = [];
  const matsToDispose: THREE.Material[] = [];

  let bodyTexFront = fBag.texture;
  let bodyTexBack = bBag.texture;
  let gussetHex = product.colorHex || "#4A1822";

  if (typeof document !== "undefined" && fBag.rawImage) {
    const imF = fBag.rawImage;
    const imB = bBag.rawImage || imF;
    const tmp = document.createElement("canvas");
    tmp.width = 900;
    tmp.height = 1355;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(imF, 0, 0, 900, 1355);
    const td = tctx.getImageData(0, 0, 900, 1355).data;

    let x0 = 900,
      x1 = 0,
      y0 = 1355,
      y1 = 0;
    for (let y = 0; y < 1355; y++) {
      for (let x = 0; x < 900; x++) {
        if (td[(y * 900 + x) * 4 + 3] > 60) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const fullH = Math.max(40, y1 - y0);
    const xm = Math.round((x0 + x1) * 0.5);
    let pouchY0 = y0;
    for (let y = y1 - 8; y >= y0; y--) {
      let sumA = 0;
      let cntA = 0;
      for (let x = Math.max(0, xm - 6); x <= Math.min(899, xm + 6); x++) {
        sumA += td[(y * 900 + x) * 4 + 3];
        cntA++;
      }
      if (cntA > 0 && sumA / cntA < 90) {
        pouchY0 = y + 1;
        break;
      }
    }
    if (pouchY0 <= y0 + 4 && fullH > 120) {
      pouchY0 = Math.round(y0 + fullH * (isShoulder ? 0.44 : 0.34));
    }
    const pouchH = Math.max(30, y1 - pouchY0);
    const pouchW = Math.max(40, x1 - x0);

    const makePouchTex = (srcIm: HTMLImageElement, flipSrc: boolean) => {
      const S = 256;
      const pCv = document.createElement("canvas");
      pCv.width = S;
      pCv.height = S;
      const pCtx = pCv.getContext("2d")!;
      const sx = flipSrc ? 900 - x1 : x0;
      pCtx.drawImage(srcIm, sx, pouchY0, pouchW, pouchH, 8, 8, S - 16, S - 16);
      const pd = pCtx.getImageData(0, 0, S, S);
      const dd = pd.data;
      const sol = new Uint8Array(S * S);
      for (let i = 0; i < S * S; i++) {
        if (dd[i * 4 + 3] > 200) sol[i] = 1;
      }
      let rSum = 0,
        gSum = 0,
        bSum = 0,
        cnt = 0;
      for (let i = 0; i < S * S; i++) {
        if (sol[i]) {
          rSum += dd[i * 4];
          gSum += dd[i * 4 + 1];
          bSum += dd[i * 4 + 2];
          cnt++;
        }
      }
      if (cnt > 20 && !flipSrc) {
        const rr = Math.round(rSum / cnt)
          .toString(16)
          .padStart(2, "0");
        const gg = Math.round(gSum / cnt)
          .toString(16)
          .padStart(2, "0");
        const bb = Math.round(bSum / cnt)
          .toString(16)
          .padStart(2, "0");
        gussetHex = `#${rr}${gg}${bb}`;
      }
      for (let pass = 0; pass < 18; pass++) {
        for (let y = 1; y < S - 1; y++) {
          for (let x = 1; x < S - 1; x++) {
            const k = y * S + x;
            if (sol[k]) continue;
            const nb =
              sol[k - 1] === 1
                ? k - 1
                : sol[k + 1] === 1
                ? k + 1
                : sol[k - S] === 1
                ? k - S
                : sol[k + S] === 1
                ? k + S
                : -1;
            if (nb >= 0) {
              dd[k * 4] = dd[nb * 4];
              dd[k * 4 + 1] = dd[nb * 4 + 1];
              dd[k * 4 + 2] = dd[nb * 4 + 2];
              sol[k] = 2;
            }
          }
        }
        for (let i = 0; i < S * S; i++) if (sol[i] === 2) sol[i] = 1;
      }
      for (let i = 0; i < S * S; i++) dd[i * 4 + 3] = 255;
      pCtx.putImageData(pd, 0, 0);
      const tex = new THREE.CanvasTexture(pCv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    };

    bodyTexFront = makePouchTex(imF, false);
    bodyTexBack = makePouchTex(imB, Boolean(slug));
  }

  const bagW = isShoulder
    ? 0.144
    : product.id === "prod-ae-ivory-mini-bag"
    ? 0.146
    : 0.166;
  const bagH = isShoulder
    ? product.id === "prod-ae-silver-metallic-shoulder-bag"
      ? 0.088
      : isQuilted
      ? 0.114
      : 0.108
    : product.id === "prod-ae-ivory-mini-bag"
    ? 0.116
    : 0.132;
  const bagD = isShoulder ? 0.056 : 0.064;

  const pouchCenterX = isShoulder ? 0.138 : -0.196;
  const pouchCenterY = isShoulder ? 1.055 : 0.596;
  const pouchCenterZ = isShoulder ? 0.090 : 0.044;
  const bagYawRad = isShoulder ? 0.46 : -0.24;
  const cosYaw = Math.cos(bagYawRad);
  const sinYaw = Math.sin(bagYawRad);

  const rotBagOffset = (lx: number, lz: number): [number, number] => [
    pouchCenterX + lx * cosYaw + lz * sinYaw,
    pouchCenterZ - lx * sinYaw + lz * cosYaw,
  ];

  const pSegU = 56;
  const pSegV = 32;
  const pPos: number[] = [];
  const pRest: number[] = [];
  const pAz: number[] = [];
  const pUv: number[] = [];
  const pIdx: number[] = [];

  for (let iv = 0; iv <= pSegV; iv++) {
    const vFrac = iv / pSegV;
    const phi = (vFrac - 0.5) * Math.PI;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const yLocal =
      0.5 * bagH * Math.sign(sinPhi) * Math.pow(Math.abs(sinPhi), 0.62);
    const ringScale = Math.pow(Math.max(0.0, cosPhi), 0.28);
    const crescentLift =
      isShoulder && !isQuilted ? 0.018 * Math.pow(ringScale, 2.0) : 0.0;

    for (let iu = 0; iu <= pSegU; iu++) {
      const uFrac = iu / pSegU;
      const theta = -Math.PI + uFrac * Math.PI * 2;
      const sx =
        Math.sign(Math.sin(theta)) * Math.pow(Math.abs(Math.sin(theta)), 0.58);
      const sz =
        Math.sign(Math.cos(theta)) * Math.pow(Math.abs(Math.cos(theta)), 0.65);

      const lx = 0.5 * bagW * sx * ringScale;
      const lz = 0.5 * bagD * sz * ringScale;
      const ly = yLocal + crescentLift * (sx * sx - 0.35);

      const [wx, wz] = rotBagOffset(lx, lz);
      const wy = pouchCenterY + ly;

      pPos.push(wx, wy, wz);
      pRest.push(wx, wy, wz, 1.0);
      pAz.push(Math.sin(theta), Math.cos(theta));
      pUv.push(
        0.5 + sx * 0.48 * ringScale,
        0.5 + (yLocal / Math.max(0.01, bagH)) * 0.94
      );
    }
  }

  for (let iv = 0; iv < pSegV; iv++) {
    for (let iu = 0; iu < pSegU; iu++) {
      const a = iv * (pSegU + 1) + iu;
      const b = (iv + 1) * (pSegU + 1) + iu;
      const c = (iv + 1) * (pSegU + 1) + (iu + 1);
      const d = iv * (pSegU + 1) + (iu + 1);
      pIdx.push(a, d, c, a, c, b);
    }
  }

  const pouchGeom = new THREE.BufferGeometry();
  pouchGeom.setAttribute("position", new THREE.Float32BufferAttribute(pPos, 3));
  pouchGeom.setAttribute(
    "aModelRest",
    new THREE.Float32BufferAttribute(pRest, 4)
  );
  pouchGeom.setAttribute("aAzDir", new THREE.Float32BufferAttribute(pAz, 2));
  pouchGeom.setAttribute("uv", new THREE.Float32BufferAttribute(pUv, 2));
  pouchGeom.setIndex(pIdx);
  pouchGeom.computeVertexNormals();
  geomsToDispose.push(pouchGeom);

  const bagUniforms = createBodyMorphUniforms();
  bagUniforms.uIsRigidBag.value = 1.0;
  bagUniforms.uFresnelSheen.value = Math.max(0.18, fabric.fresnelSheen);
  bagUniforms.uSheenColor.value.set(fabric.sheenTintHex);

  const gussetCol = new THREE.Color(gussetHex);
  const pouchMat = new THREE.ShaderMaterial({
    uniforms: {
      ...(bagUniforms as unknown as Record<string, THREE.IUniform>),
      uPouchFront: { value: bodyTexFront },
      uPouchBack: { value: bodyTexBack },
      uGussetColor: { value: gussetCol },
    },
    transparent: false,
    depthWrite: true,
    depthTest: true,
    toneMapped: false,
    vertexShader: `
      attribute vec4 aModelRest;
      attribute vec2 aAzDir;
      uniform float uHeightScale;
      uniform vec4 uBodyScales;
      varying vec2 vAzDir;
      varying vec2 vPouchUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vAzDir = aAzDir;
        vPouchUv = uv;
        vec3 p = position;
        float yn = clamp(aModelRest.y / 1.58, 0.0, 1.0);
        float anchorScale = yn > 0.56 ? uBodyScales.x : uBodyScales.w;
        p.x += (anchorScale - 1.0) * sign(p.x) * 0.125;
        p.y *= uHeightScale;

        vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uPouchFront;
      uniform sampler2D uPouchBack;
      uniform vec3 uGussetColor;
      uniform vec3 uLightMoodTint;
      uniform float uFresnelSheen;
      uniform vec3 uSheenColor;
      varying vec2 vAzDir;
      varying vec2 vPouchUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;

      void main() {
        vec2 uvF = clamp(vPouchUv, 0.02, 0.98);
        vec2 uvB = vec2(1.0 - uvF.x, uvF.y);
        vec3 cF = texture2D(uPouchFront, uvF).rgb;
        vec3 cB = texture2D(uPouchBack,  uvB).rgb;

        vec2 az = normalize(vAzDir + vec2(0.0, 0.00001));
        float absAz = acos(clamp(az.y, -1.0, 1.0));
        float wF = 1.0 - smoothstep(0.75, 1.25, absAz);
        float wB = smoothstep(1.89, 2.39, absAz);
        float wG = max(0.0, 1.0 - wF - wB);
        vec3 gussetShade = uGussetColor * (0.84 + 0.05 * sin(vPouchUv.y * 26.0));
        vec3 baseRgb = cF * wF + gussetShade * wG + cB * wB;

        vec3 n = normalize(vNormalView);
        vec3 v = normalize(vViewDir);
        vec3 keyLight = normalize(vec3(0.38, 0.48, 0.80));
        float ndl = max(dot(n, keyLight), 0.0);
        vec3 halfV = normalize(keyLight + v);
        float spec = pow(max(dot(n, halfV), 0.0), 28.0);
        float fresnel = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);

        vec3 col = baseRgb * (0.86 + 0.18 * ndl) * mix(vec3(1.0), uLightMoodTint, 0.15);
        col += uSheenColor * (spec * 0.18 + fresnel * 0.16) * uFresnelSheen;

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  matsToDispose.push(pouchMat);

  const pouchMesh = new THREE.Mesh(pouchGeom, pouchMat);
  pouchMesh.userData = { product, productId: product.id, slot: "bag" };
  group.add(pouchMesh);

  const makeStrapMesh = (
    pts: THREE.Vector3[],
    radius: number,
    strapHex: string
  ) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const tGeom = new THREE.TubeGeometry(curve, 48, radius, 12, false);
    const posA = tGeom.attributes.position;
    const restArr = new Float32Array(posA.count * 4);
    const azArr = new Float32Array(posA.count * 2);
    for (let i = 0; i < posA.count; i++) {
      restArr[i * 4] = posA.getX(i);
      restArr[i * 4 + 1] = posA.getY(i);
      restArr[i * 4 + 2] = posA.getZ(i);
      restArr[i * 4 + 3] = 1.0;
      azArr[i * 2] = 1.0;
      azArr[i * 2 + 1] = 0.0;
    }
    tGeom.setAttribute("aModelRest", new THREE.BufferAttribute(restArr, 4));
    tGeom.setAttribute("aAzDir", new THREE.BufferAttribute(azArr, 2));
    geomsToDispose.push(tGeom);

    const sMat = pouchMat.clone();
    sMat.uniforms = {
      ...(bagUniforms as unknown as Record<string, THREE.IUniform>),
      uPouchFront: { value: bodyTexFront },
      uPouchBack: { value: bodyTexBack },
      uGussetColor: { value: new THREE.Color(strapHex) },
    };
    matsToDispose.push(sMat);
    const m = new THREE.Mesh(tGeom, sMat);
    m.userData = { product, productId: product.id, slot: "bag" };
    return m;
  };

  if (isShoulder) {
    const topPouchY = pouchCenterY + bagH * 0.44;
    if (isQuilted) {
      for (const sIdx of [-1, 1]) {
        const [fGx, fGz] = rotBagOffset(-0.032 + sIdx * 0.012, 0.01);
        const [bGx, bGz] = rotBagOffset(0.036 + sIdx * 0.012, -0.012);
        group.add(
          makeStrapMesh(
            [
              new THREE.Vector3(fGx, topPouchY, fGz),
              new THREE.Vector3(0.118 + sIdx * 0.006, 1.175, 0.068),
              new THREE.Vector3(0.108 + sIdx * 0.006, 1.272, 0.008),
              new THREE.Vector3(0.118 + sIdx * 0.006, 1.245, -0.068),
              new THREE.Vector3(0.136 + sIdx * 0.006, 1.135, -0.072),
              new THREE.Vector3(0.155 + sIdx * 0.005, 1.088, 0.022),
              new THREE.Vector3(bGx, topPouchY, bGz),
            ],
            0.0038,
            "#C6A355"
          )
        );
      }
    } else {
      const [fGx, fGz] = rotBagOffset(-0.052, 0.008);
      const [bGx, bGz] = rotBagOffset(0.052, -0.01);
      group.add(
        makeStrapMesh(
          [
            new THREE.Vector3(fGx, topPouchY + 0.008, fGz),
            new THREE.Vector3(0.114, 1.182, 0.072),
            new THREE.Vector3(0.108, 1.272, 0.006),
            new THREE.Vector3(0.118, 1.242, -0.068),
            new THREE.Vector3(0.138, 1.135, -0.072),
            new THREE.Vector3(0.162, 1.09, 0.02),
            new THREE.Vector3(bGx, topPouchY + 0.008, bGz),
          ],
          0.0064,
          gussetHex
        )
      );
    }
  } else {
    const topToteY = pouchCenterY + bagH * 0.46;
    const [hLx, hLz] = rotBagOffset(-0.038, 0.004);
    const [hRx, hRz] = rotBagOffset(0.038, -0.004);
    group.add(
      makeStrapMesh(
        [
          new THREE.Vector3(hLx, topToteY, hLz),
          new THREE.Vector3(hLx * 0.92 - 0.012, 0.688, hLz * 0.75 + 0.008),
          new THREE.Vector3(-0.163, 0.708, 0.024),
          new THREE.Vector3(hRx * 0.92 - 0.012, 0.688, hRz * 0.75 + 0.006),
          new THREE.Vector3(hRx, topToteY, hRz),
        ],
        0.0052,
        gussetHex
      )
    );
  }

  return {
    product,
    slot: "bag",
    isRigidBag: true,
    hasLongSleeves: false,
    isTallBoot: false,
    minYn: 0.45,
    maxYn: 0.82,
    fabric,
    group,
    uniformsList: [bagUniforms],
    dispose: () => {
      geomsToDispose.forEach((g) => g.dispose());
      matsToDispose.forEach((m) => m.dispose());
    },
  };
}

/**
 * Builds an independent, watertight 360° 3D Wearable Garment or Purse Mesh (`THREE.Group`).
 */
export async function loadWearable3DItemRig(
  product: Product,
  hasShinCoveringPants: boolean
): Promise<Wearable3DItemRig> {
  const anc = classifyWearableSlotAndAnchors(product);
  const slot = anc.slot;
  const fabric = resolveGarmentFabricPhysics(product);

  if (slot === "bag") {
    return buildWatertight3DPurseRig(product, fabric);
  }

  const id = product.id;
  let frontUrl: string;
  let backUrl: string;

  if (id in MOD_TOP_SLUG) {
    const s = MOD_TOP_SLUG[id].slug;
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else if (id in MOD_BOT_SLUG) {
    const s = MOD_BOT_SLUG[id].slug;
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else if (id in MOD_DRESS_SLUG) {
    const s = MOD_DRESS_SLUG[id].slug;
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else if (id in MOD_OUTER_SLUG) {
    const s = MOD_OUTER_SLUG[id].slug;
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else if (id in MOD_SHOE_SLUG) {
    const base = MOD_SHOE_SLUG[id];
    const s = hasShinCoveringPants ? `${base}_under` : base;
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else if (id in MOD_BELT_SLUG) {
    const s = MOD_BELT_SLUG[id];
    frontUrl = modLayerUrl(`${s}_front`);
    backUrl = modLayerUrl(`${s}_back`);
  } else {
    const cleanCustom = await isolateProductBackgroundClient(
      product.imageUrl || ""
    );
    frontUrl = cleanCustom;
    backUrl = cleanCustom;
  }

  const sideSpec = resolveSideDonorSpec(product, slot);
  const sideUrl = modLayerUrl(sideSpec.sideSlug);

  // Use `garment_hem_cutout` on upper/skirt/dress/belt garments so Basque V-corsets, sweetheart necklines & mini hems cut razor-sharp!
  const isSkirtPre =
    slot === "bottom" &&
    (id.includes("mini") ||
      id.includes("midi") ||
      product.silhouette.includes("skirt"));
  const useHemCutout =
    slot === "top" ||
    slot === "dress" ||
    slot === "outerwear" ||
    slot === "belt" ||
    isSkirtPre;
  const sideAlphaMode: BledAlphaMode =
    slot === "shoes" ? "exact_mask" : "solid";

  const [fTex, bTex, sTex] = await Promise.all([
    loadBled3DViewTexture(frontUrl, {
      alphaMode: useHemCutout ? "garment_hem_cutout" : "solid",
    }),
    loadBled3DViewTexture(backUrl, {
      alphaMode: useHemCutout ? "garment_hem_cutout" : "solid",
    }),
    loadBled3DViewTexture(sideUrl, {
      tintHex: sideSpec.tintHex,
      tintYRange: sideSpec.tintYRange,
      alphaMode: sideAlphaMode,
    }),
  ]);

  const group = new THREE.Group();
  group.name = `Garment3D_${product.id}`;
  const geoms: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const uniformsList: BodyMorphUniforms[] = [];

  const makeGarmentMesh = (
    geom: THREE.BufferGeometry,
    opts?: {
      doubleSided?: boolean;
      alphaCutout?: number;
      sideSpan?: [number, number];
      limbFrontBackOnly?: boolean;
    }
  ): THREE.Mesh => {
    geoms.push(geom);
    const u = createBodyMorphUniforms();
    u.uFrontMap.value = fTex.texture;
    u.uBackMap.value = bTex.texture;
    u.uSideMap.value = sTex.texture;
    if (opts?.alphaCutout !== undefined) {
      u.uAlphaCutout.value = opts.alphaCutout;
    }
    if (opts?.sideSpan) {
      u.uSideMinYn.value = opts.sideSpan[0];
      u.uSideMaxYn.value = opts.sideSpan[1];
    }
    if (opts?.limbFrontBackOnly) {
      u.uLimbFrontBackOnly.value = 1.0;
    }
    uniformsList.push(u);
    const mat = createVolumetric3DHullMaterial(u, Boolean(opts?.doubleSided));
    mats.push(mat);
    const m = new THREE.Mesh(geom, mat);
    m.userData = {
      product,
      productId: product.id,
      slot,
      fabricProfile: fabric,
    };
    return m;
  };

  let hasLongSleeves = false;
  let isTallBoot = false;
  let minYn = fTex.minYn;
  let maxYn = fTex.maxYn;

  if (slot === "top") {
    const overWaist = Boolean(MOD_TOP_SLUG[id]?.overWaist);
    const yLo = Math.max(0.525, fTex.minYn - 0.008);
    const yHi = Math.min(0.812, Math.max(fTex.maxYn, bTex.maxYn) + 0.006);
    const [sideLo, sideHi] = measureOuterSideHemSpanYn(fTex.alphaGrid);
    minYn = yLo;
    maxYn = yHi;

    const slices: TubeSliceSpec[] = [];
    const N = 38;
    for (let i = 0; i < N; i++) {
      const yn = yLo + (i / (N - 1)) * (yHi - yLo);
      slices.push({
        yn,
        ...sampleSagittalRing(TORSO_PELVIS_3D_RINGS, yn),
      });
    }

    group.add(
      makeGarmentMesh(
        buildWatertight3DTubeGeometry({
          slices,
          radialSegs: 72,
          radialOffsetM: overWaist ? 0.0065 : 0.0035,
          superEllipseExp: 1.82,
          capBottom: false,
          capTop: false,
        }),
        {
          doubleSided: true,
          alphaCutout: 0.42,
          sideSpan: [sideLo, Math.min(0.805, sideHi)],
        }
      )
    );

    if (id === "prod-ae-blush-ruched-offshoulder") {
      for (const side of ["right", "left"] as const) {
        const armSlices: TubeSliceSpec[] = [];
        for (let k = 0; k < 10; k++) {
          const yn = 0.695 + (k / 9) * 0.055;
          armSlices.push({
            yn,
            ...samplePairedLimbRing(ARMS_3D_RINGS, yn, side),
          });
        }
        group.add(
          makeGarmentMesh(
            buildWatertight3DTubeGeometry({
              slices: armSlices,
              radialSegs: 34,
              radialOffsetM: 0.0048,
              capBottom: false,
              capTop: false,
            }),
            { doubleSided: true, limbFrontBackOnly: true }
          )
        );
      }
    }
  } else if (slot === "bottom") {
    const isSkirt =
      id.includes("mini") ||
      id.includes("midi") ||
      product.silhouette.includes("skirt");

    const yWaist = Math.min(0.642, Math.max(0.588, fTex.maxYn));
    const yHem = Math.max(0.052, fTex.minYn);
    minYn = yHem;
    maxYn = yWaist;

    // Build smooth continuous silhouette curves `(outerRx(yn), zBack(yn), zFront(yn))` from `fTex` & `sTex`!
    const SN = 64;
    const rawRx: number[] = [];
    const rawZb: number[] = [];
    const rawZf: number[] = [];
    for (let i = 0; i < SN; i++) {
      const yn = yHem + (i / (SN - 1)) * (yWaist - yHem);
      const bodyRef =
        yn >= 0.45
          ? sampleSagittalRing(TORSO_PELVIS_3D_RINGS, yn)
          : samplePairedLimbRing(LEGS_FEET_3D_RINGS, yn, "left");
      const defaultOuter =
        yn >= 0.45 ? bodyRef.rx : Math.abs(bodyRef.xc) + bodyRef.rx;
      const mRxRaw =
        measureGarmentHalfWidthAtYn(fTex.alphaGrid, yn, 152) ?? defaultOuter;
      const mRx = isSkirt ? mRxRaw : Math.max(0.042, mRxRaw - 0.003);
      const mZ = measureSideSagittalSpanAtYn(sTex.alphaGrid, yn);
      rawRx.push(Math.max(defaultOuter * (isSkirt ? 0.94 : 0.88), mRx));
      rawZb.push(mZ ? Math.max(-0.115, mZ.zBack) : bodyRef.zBack);
      rawZf.push(mZ ? Math.min(0.118, mZ.zFront) : bodyRef.zFront);
    }

    const smoothCurve = (arr: number[], yn: number) => {
      const f =
        ((yn - yHem) / Math.max(1e-5, yWaist - yHem)) * (arr.length - 1);
      const idx = Math.min(arr.length - 1, Math.max(0, Math.round(f)));
      let sum = 0,
        wSum = 0;
      for (let d = -3; d <= 3; d++) {
        const k = Math.min(arr.length - 1, Math.max(0, idx + d));
        const w = 4 - Math.abs(d);
        sum += arr[k] * w;
        wSum += w;
      }
      return sum / wSum;
    };

    if (isSkirt) {
      const N = 42;
      const slices: TubeSliceSpec[] = [];
      for (let i = 0; i < N; i++) {
        const yn = yHem + (i / (N - 1)) * (yWaist - yHem);
        slices.push({
          yn,
          xc: 0.0,
          rx: smoothCurve(rawRx, yn),
          zBack: smoothCurve(rawZb, yn),
          zFront: smoothCurve(rawZf, yn),
        });
      }
      group.add(
        makeGarmentMesh(
          buildWatertight3DTubeGeometry({
            slices,
            radialSegs: 72,
            radialOffsetM: 0.0052,
            superEllipseExp: 1.84,
            capBottom: false,
            capTop: false,
          }),
          {
            doubleSided: true,
            alphaCutout: 0.42,
            sideSpan: [yHem, yWaist],
          }
        )
      );
    } else {
      // C¹-CONTINUOUS BIFURCATED 3D TROUSERS / JEANS / LEGGINGS / SHORTS (ZERO mid-thigh cliff!):
      const isShorts = id.includes("shorts");
      const isLeggings = id.includes("leggings");
      const crotchYn = isShorts ? Math.max(yHem + 0.04, 0.445) : 0.448;

      // 1. 360° Pelvic High-Waist Yoke (`crotchYn .. yWaist`, uncapped bottom merging seamlessly into both leg tubes!)
      const yokeSlices: TubeSliceSpec[] = [];
      for (let i = 0; i < 24; i++) {
        const yn = crotchYn + (i / 23) * (yWaist - crotchYn);
        yokeSlices.push({
          yn,
          xc: 0.0,
          rx: smoothCurve(rawRx, yn),
          zBack: smoothCurve(rawZb, yn),
          zFront: smoothCurve(rawZf, yn),
        });
      }
      group.add(
        makeGarmentMesh(
          buildWatertight3DTubeGeometry({
            slices: yokeSlices,
            radialSegs: 72,
            radialOffsetM: 0.005,
            superEllipseExp: 1.84,
            capBottom: false,
            capTop: false,
            isPelvicYoke: true,
          }),
          { doubleSided: true }
        )
      );

      // 2. Paired Cylindrical 3D Trouser Legs (`yHem .. crotchYn + 0.045`), sharing the EXACT SAME outer contour & sagittal Z!
      const legTopYn = Math.min(yWaist - 0.01, crotchYn + 0.045);
      for (const side of ["right", "left"] as const) {
        const sgn = side === "right" ? -1.0 : 1.0;
        const legSlices: TubeSliceSpec[] = [];
        const LN = 42;
        for (let i = 0; i < LN; i++) {
          const yn = yHem + (i / (LN - 1)) * (legTopYn - yHem);
          const outerX = smoothCurve(rawRx, yn);
          const zBack = smoothCurve(rawZb, yn);
          const zFront = smoothCurve(rawZf, yn);

          // Inner thigh seam merges smoothly to `0.001m` at `crotchYn` so zero gap & zero cliff!
          const mergeT = smoothstepJS(crotchYn - 0.045, crotchYn + 0.015, yn);
          let baseInnerGap = 0.007;
          if (isLeggings || isShorts) {
            const limb = samplePairedLimbRing(LEGS_FEET_3D_RINGS, yn, side);
            baseInnerGap = Math.max(0.006, Math.abs(limb.xc) - limb.rx);
          } else {
            // Wide-leg fluid tailored column: subtle natural separation between ankles (`~8mm` each side) tapering to 0 at crotch!
            baseInnerGap = 0.008 * (1.0 - smoothstepJS(0.10, 0.43, yn)) + 0.002;
          }
          const innerX = baseInnerGap * (1.0 - mergeT);
          const tuckT = smoothstepJS(crotchYn - 0.06, legTopYn, yn);
          const legRx =
            Math.max(0.022, 0.5 * (outerX - innerX)) * (1.0 - 0.055 * tuckT);
          const legXc = sgn * (innerX + legRx);
          const zTuck = 1.0 - 0.25 * tuckT;

          legSlices.push({
            yn,
            xc: legXc,
            rx: legRx,
            zBack: zBack * zTuck,
            zFront: zFront * zTuck,
          });
        }

        group.add(
          makeGarmentMesh(
            buildWatertight3DTubeGeometry({
              slices: legSlices,
              radialSegs: 48,
              radialOffsetM: 0.0046,
              superEllipseExp: 1.84,
              capBottom: !isShorts && !isLeggings ? true : false,
              capTop: false,
            }),
            { doubleSided: true }
          )
        );
      }
    }
  } else if (slot === "dress") {
    const isBlazerDress = id.includes("blazer");
    hasLongSleeves = isBlazerDress;
    const yHem = Math.max(0.13, fTex.minYn);
    const yTop = isBlazerDress ? 0.808 : Math.min(0.79, fTex.maxYn + 0.006);
    minYn = yHem;
    maxYn = yTop;

    const N = 56;
    const slices: TubeSliceSpec[] = [];
    for (let i = 0; i < N; i++) {
      const yn = yHem + (i / (N - 1)) * (yTop - yHem);
      const bodyRef =
        yn >= 0.45
          ? sampleSagittalRing(TORSO_PELVIS_3D_RINGS, yn)
          : { xc: 0, rx: 0.128, zBack: -0.088, zFront: 0.086 };
      const measuredRx =
        measureGarmentHalfWidthAtYn(fTex.alphaGrid, yn, 145) ?? bodyRef.rx;
      const mZ = measureSideSagittalSpanAtYn(sTex.alphaGrid, yn);
      slices.push({
        yn,
        xc: 0,
        rx: Math.max(bodyRef.rx * 0.96, Math.min(0.152, measuredRx)),
        zBack: mZ && yn < 0.65 ? Math.max(-0.115, mZ.zBack) : bodyRef.zBack,
        zFront: mZ && yn < 0.65 ? Math.min(0.115, mZ.zFront) : bodyRef.zFront,
      });
    }
    group.add(
      makeGarmentMesh(
        buildWatertight3DTubeGeometry({
          slices,
          radialSegs: 72,
          radialOffsetM: 0.0055,
          superEllipseExp: 1.82,
          capBottom: true,
          capTop: false,
        }),
        {
          doubleSided: true,
          alphaCutout: 0.4,
          sideSpan: [yHem, yTop],
        }
      )
    );

    if (isBlazerDress) {
      for (const side of ["right", "left"] as const) {
        const sSlices: TubeSliceSpec[] = ARMS_3D_RINGS.filter(
          (r) => r[0] >= 0.485
        ).map((r) => ({
          yn: r[0],
          ...samplePairedLimbRing([r], r[0], side),
        }));
        group.add(
          makeGarmentMesh(
            buildWatertight3DTubeGeometry({
              slices: sSlices,
              radialSegs: 38,
              radialOffsetM: 0.0072,
              capBottom: false,
              capTop: true,
            }),
            { doubleSided: true, limbFrontBackOnly: true }
          )
        );
      }
    }
  } else if (slot === "outerwear") {
    hasLongSleeves = true;
    const om = MOD_OUTER_SLUG[id];
    const isClosed = Boolean(om?.isClosed);
    // Measure torso-only hem (`c in 37..53`, excluding long sleeves!) so cropped blazers stop cleanly at the waist!
    let maxTorsoRow = 0;
    for (let r = 0; r < ALPHA_GRID_H; r++) {
      for (let c = 37; c <= 53; c++) {
        if (
          fTex.alphaGrid[r * ALPHA_GRID_W + c] > 90 ||
          bTex.alphaGrid[r * ALPHA_GRID_W + c] > 90
        ) {
          if (r > maxTorsoRow) maxTorsoRow = r;
        }
      }
    }
    const torsoOnlyMinYn =
      maxTorsoRow > 0 ? 1.0 - (maxTorsoRow + 1) / ALPHA_GRID_H : fTex.minYn;
    const yHem = Math.max(0.28, torsoOnlyMinYn);
    const yTop = 0.808;
    minYn = yHem;
    maxYn = yTop;

    const N = 46;
    const bodySlices: TubeSliceSpec[] = [];
    for (let i = 0; i < N; i++) {
      const yn = yHem + (i / (N - 1)) * (yTop - yHem);
      const bodyRef =
        yn >= 0.45
          ? sampleSagittalRing(TORSO_PELVIS_3D_RINGS, yn)
          : { xc: 0, rx: 0.142, zBack: -0.098, zFront: 0.095 };
      bodySlices.push({
        yn,
        xc: 0,
        rx: Math.max(bodyRef.rx, yn < 0.48 ? 0.142 : bodyRef.rx),
        zBack: bodyRef.zBack,
        zFront: bodyRef.zFront,
      });
    }

    group.add(
      makeGarmentMesh(
        buildWatertight3DTubeGeometry({
          slices: bodySlices,
          radialSegs: 72,
          radialOffsetM: 0.0098,
          superEllipseExp: 1.78,
          capBottom: false,
          capTop: false,
          openFrontHalfAngleFn: isClosed
            ? undefined
            : (yn) => (yn > 0.72 ? 0.25 + (yn - 0.72) * 1.15 : 0.23),
        }),
        {
          doubleSided: true,
          alphaCutout: 0.38,
          sideSpan: [yHem, yTop],
        }
      )
    );

    for (const side of ["right", "left"] as const) {
      const sSlices: TubeSliceSpec[] = ARMS_3D_RINGS.filter(
        (r) => r[0] >= 0.478
      ).map((r) => ({
        yn: r[0],
        ...samplePairedLimbRing([r], r[0], side),
      }));
      group.add(
        makeGarmentMesh(
          buildWatertight3DTubeGeometry({
            slices: sSlices,
            radialSegs: 38,
            radialOffsetM: 0.0085,
            superEllipseExp: 1.95,
            capBottom: false,
            capTop: true,
          }),
          { doubleSided: true, limbFrontBackOnly: true }
        )
      );
    }
  } else if (slot === "belt") {
    minYn = 0.606;
    maxYn = 0.634;
    const beltSlices: TubeSliceSpec[] = [];
    for (let i = 0; i < 8; i++) {
      const yn = minYn + (i / 7) * (maxYn - minYn);
      beltSlices.push({
        yn,
        ...sampleSagittalRing(TORSO_PELVIS_3D_RINGS, yn),
      });
    }
    group.add(
      makeGarmentMesh(
        buildWatertight3DTubeGeometry({
          slices: beltSlices,
          radialSegs: 64,
          radialOffsetM: 0.0074,
          superEllipseExp: 1.8,
          capBottom: true,
          capTop: true,
        }),
        { sideSpan: [minYn, maxYn] }
      )
    );
  } else if (slot === "shoes") {
    isTallBoot =
      id === "prod-ae-meotina-leather-boots" && !hasShinCoveringPants;
    const topShoeYn = isTallBoot
      ? 0.282
      : hasShinCoveringPants
      ? 0.072
      : 0.098;
    minYn = 0.02;
    maxYn = topShoeYn;

    for (const side of ["right", "left"] as const) {
      const shoeSlices: TubeSliceSpec[] = LEGS_FEET_3D_RINGS.filter(
        (r) => r[0] <= topShoeYn + 0.008
      ).map((r) => ({
        yn: r[0],
        ...samplePairedLimbRing([r], r[0], side),
      }));
      group.add(
        makeGarmentMesh(
          buildWatertight3DTubeGeometry({
            slices: shoeSlices,
            radialSegs: 42,
            radialOffsetM: isTallBoot ? 0.0052 : 0.0036,
            superEllipseExp: 1.9,
            capBottom: true,
            capTop: !isTallBoot,
          }),
          {
            doubleSided: true,
            // Carves real architectural stiletto arch space on ±90° side views!
            alphaCutout: 0.38,
            sideSpan: [0.015, topShoeYn + 0.008],
          }
        )
      );
    }
  }

  return {
    product,
    slot,
    isRigidBag: false,
    hasLongSleeves,
    isTallBoot,
    minYn,
    maxYn,
    fabric,
    group,
    uniformsList,
    dispose: () => {
      geoms.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}

// ============================================================================
// 3. WATERTIGHT 360° STANDALONE 3D ITEM VOLUME (`mode="product"`)
// ============================================================================

export async function loadStandalone3DItemInstance(
  product: Product
): Promise<THREE.Group> {
  const group = new THREE.Group();
  if (!product.imageUrl || typeof document === "undefined") return group;

  const cleanUrl = await isolateProductBackgroundClient(product.imageUrl);
  const bled = await loadBled3DViewTexture(cleanUrl);
  const fabric = resolveGarmentFabricPhysics(product);
  const img = bled.rawImage;
  if (!img) return group;

  const G = 120;
  const gCv = document.createElement("canvas");
  gCv.width = G;
  gCv.height = G;
  const gCtx = gCv.getContext("2d")!;
  gCtx.drawImage(img, 0, 0, G, G);
  const gd = gCtx.getImageData(0, 0, G, G).data;

  const aFloat = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) aFloat[i] = gd[i * 4 + 3] / 255.0;
  const tmpA = new Float32Array(G * G);
  for (let pass = 0; pass < 5; pass++) {
    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        tmpA[r * G + c] =
          0.25 * aFloat[r * G + Math.max(0, c - 1)] +
          0.5 * aFloat[r * G + c] +
          0.25 * aFloat[r * G + Math.min(G - 1, c + 1)];
      }
    }
    for (let r = 0; r < G; r++) {
      const r0 = Math.max(0, r - 1) * G;
      const r2 = Math.min(G - 1, r + 1) * G;
      for (let c = 0; c < G; c++) {
        aFloat[r * G + c] =
          0.25 * tmpA[r0 + c] + 0.5 * tmpA[r * G + c] + 0.25 * tmpA[r2 + c];
      }
    }
  }

  const aspect =
    (img.naturalWidth || 1) / Math.max(1, img.naturalHeight || 1);
  const boxH = 0.64;
  const boxW = Math.min(0.66, boxH * aspect);
  const halfThick =
    product.category === "accessory"
      ? 0.042
      : product.category === "shoes"
      ? 0.036
      : 0.028;

  const positions: number[] = [];
  const uvs: number[] = [];
  const vertSoftWeight: number[] = [];
  const vertSignZ: number[] = [];
  const idxF = new Int32Array(G * G).fill(-1);
  const idxB = new Int32Array(G * G).fill(-1);

  const iso = 0.46;
  const insideAt = (r: number, c: number) =>
    r >= 0 && r < G && c >= 0 && c < G && aFloat[r * G + c] >= iso;

  for (let r = 0; r < G; r++) {
    for (let c = 0; c < G; c++) {
      const inside = insideAt(r, c);
      let cEff = c;
      let rEff = r;

      if (!inside) {
        const hasNbr =
          insideAt(r - 1, c) ||
          insideAt(r + 1, c) ||
          insideAt(r, c - 1) ||
          insideAt(r, c + 1) ||
          insideAt(r - 1, c - 1) ||
          insideAt(r - 1, c + 1) ||
          insideAt(r + 1, c - 1) ||
          insideAt(r + 1, c + 1);
        if (!hasNbr) continue;

        const gx =
          0.5 *
          (aFloat[r * G + Math.min(G - 1, c + 1)] -
            aFloat[r * G + Math.max(0, c - 1)]);
        const gy =
          0.5 *
          (aFloat[Math.min(G - 1, r + 1) * G + c] -
            aFloat[Math.max(0, r - 1) * G + c]);
        const g2 = gx * gx + gy * gy;
        if (g2 > 1e-5) {
          const step = (iso - aFloat[r * G + c]) / g2;
          let dc = gx * step;
          let dr = gy * step;
          const mag = Math.hypot(dc, dr);
          if (mag > 0.92) {
            dc *= 0.92 / mag;
            dr *= 0.92 / mag;
          }
          cEff += dc;
          rEff += dr;
        }
      }

      const u = Math.min(0.995, Math.max(0.005, (cEff + 0.5) / G));
      const vTop = Math.min(0.995, Math.max(0.005, (rEff + 0.5) / G));
      const uvY = 1.0 - vTop;
      const lx = (u - 0.5) * boxW;
      const ly = (0.5 - vTop) * boxH;

      const edgeSoft = inside ? smoothstepJS(iso, 0.88, aFloat[r * G + c]) : 0.0;
      const arch =
        Math.cos((u - 0.5) * Math.PI * 0.9) * Math.sin(uvY * Math.PI) * 0.022;
      const lz = inside ? halfThick * Math.max(0.08, edgeSoft) : 0.0;

      const k = r * G + c;
      idxF[k] = positions.length / 3;
      positions.push(lx, ly, arch + lz);
      uvs.push(u, uvY);
      vertSoftWeight.push(edgeSoft);
      vertSignZ.push(1.0);

      if (lz > 1e-5) {
        idxB[k] = positions.length / 3;
        positions.push(lx, ly, arch - lz);
        uvs.push(u, uvY);
        vertSoftWeight.push(edgeSoft);
        vertSignZ.push(-1.0);
      } else {
        idxB[k] = idxF[k];
      }
    }
  }

  const indices: number[] = [];
  for (let r = 0; r < G - 1; r++) {
    for (let c = 0; c < G - 1; c++) {
      const k00 = r * G + c;
      const k10 = (r + 1) * G + c;
      const k11 = (r + 1) * G + (c + 1);
      const k01 = r * G + (c + 1);
      if (idxF[k00] >= 0 && idxF[k10] >= 0 && idxF[k11] >= 0 && idxF[k01] >= 0) {
        indices.push(
          idxF[k00],
          idxF[k10],
          idxF[k11],
          idxF[k00],
          idxF[k11],
          idxF[k01]
        );
      }
      if (idxB[k00] >= 0 && idxB[k10] >= 0 && idxB[k11] >= 0 && idxB[k01] >= 0) {
        indices.push(
          idxB[k00],
          idxB[k11],
          idxB[k10],
          idxB[k00],
          idxB[k01],
          idxB[k11]
        );
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const nAttr = geom.attributes.normal;
  for (let i = 0; i < nAttr.count; i++) {
    const w = vertSoftWeight[i];
    const sz = vertSignZ[i];
    const nx = nAttr.getX(i) * w;
    const ny = nAttr.getY(i) * w;
    const nz = nAttr.getZ(i) * w + sz * (1.0 - w * 0.65);
    const len = Math.hypot(nx, ny, nz) || 1.0;
    nAttr.setXYZ(i, nx / len, ny / len, nz / len);
  }
  nAttr.needsUpdate = true;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: bled.texture },
      uSheenColor: { value: new THREE.Color(fabric.sheenTintHex) },
      uSheen: { value: fabric.fresnelSheen * 0.85 },
    },
    transparent: false,
    depthWrite: true,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uSheenColor;
      uniform float uSheen;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec3 base = texture2D(uMap, vUv).rgb;
        vec3 n = normalize(vNormalView);
        vec3 v = normalize(vViewDir);
        vec3 key = normalize(vec3(0.35, 0.45, 0.82));
        float ndl = max(dot(n, key), 0.0);
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
        vec3 col = base * (0.88 + 0.16 * ndl) + uSheenColor * fres * 0.16 * uSheen;
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  group.add(new THREE.Mesh(geom, mat));
  return group;
}

export function getInApp3DRenderedItemUrl(product: Product): string | undefined {
  return product.imageUrl;
}

let preloaded3D = false;
export function preloadCore3DGlbs(): void {
  if (preloaded3D || typeof window === "undefined") return;
  preloaded3D = true;
  const starter = [
    modLayerUrl("base_front"),
    modLayerUrl("base_back"),
    modLayerUrl("base_side"),
    modLayerUrl("hair_over_front"),
    modLayerUrl("hair_over_back"),
    modLayerUrl("top_espresso_corset_front"),
    modLayerUrl("bot_champagne_trousers_front"),
    modLayerUrl("side_clean_0"),
    modLayerUrl("bag_merlot_crescent_front"),
  ];
  starter.forEach((u, idx) => {
    setTimeout(() => {
      void loadBled3DViewTexture(u).catch(() => {});
    }, idx * 35);
  });
}

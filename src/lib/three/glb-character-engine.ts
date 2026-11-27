/**
 * ============================================================================
 * GWO ORTHOGONAL 4-QUADRANT TRUE-3D TURNTABLE ENGINE
 * File: src/lib/three/glb-character-engine.ts
 * ============================================================================
 *
 * Combines 100% TRUE 360° 3D Y-axis turntable rotation (`avatarTurntable.rotation.y = yaw`,
 * vertical 3D pitch, zoom, and multi-shell Z-depth parallax) with 100% distortion-free
 * studio human & garment photorealism across all 360° (`0° -> 45° -> 90° -> 135° -> 180° -> 270° -> 360°`):
 *
 * 1. Persistent 4-Quadrant 3D Character Rig (`loadCharacter3DRig`):
 *    - `frontMesh` (`rotY = 0`), `rightSideMesh` (`rotY = +π/2`), `backMesh` (`rotY = π`),
 *      and `leftSideMesh` (`rotY = -π/2`), each built on a `76 × 114` (`17,328`-triangle)
 *      smooth C² anatomical 3D relief surface (`0 .. +7.6cm` 3D depth) rotating at true 1:1
 *      3D angular velocity inside `avatarTurntable`!
 * 2. Individual 3D Wearable Garment Meshes (`loadWearable3DItemRig`):
 *    - Every clothing, dress, blazer, trouser, skirt, shoe, belt, and 3D handbag item mounts
 *      as its OWN physical 3D relief shell (`+5mm` shoes up to `+54mm` 3D sculpted bags) on
 *      both Front (`0°`) and Back (`180°`) quadrants, plus matched 3D Side Profile shells at `±90°`!
 * 3. Watertight 360° Standalone 3D Item Volume (`loadStandalone3DItemInstance`):
 *    - Every product in the catalog spins 360° as a closed, solid 3D item sculpture (`mode="product"`).
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
  LAYER_VER,
  MOD_BAG_SLUG,
  MOD_BELT_SLUG,
  MOD_BOT_SLUG,
  MOD_DRESS_SLUG,
  MOD_OUTER_SLUG,
  MOD_SHOE_SLUG,
  MOD_TOP_SLUG,
  modLayerUrl,
  resolveSideOutfitFallbackIndex,
} from "./modular-outfit-compositor";
export { ALL_CERTIFIED_MODULAR_SKU_IDS };
import { AvatarExactFitReport, ZoneFeel } from "../catalog/fit-intelligence";
import {
  MASTER_AVATAR_ANATOMY_STANDARD,
  FabricPhysicsProfile,
  computePhysicalEaseExpansionMeters,
  enforceRealisticAvatarAnatomy,
  resolveGarmentFabricPhysics,
} from "../realism/master-avatar-clothing-realism";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const GLB_ASSET_VER = "ortho3d7";
export const BASE_CHAR_HEIGHT_M =
  MASTER_AVATAR_ANATOMY_STANDARD.canonicalHeightMeters;
export const BASE_CHAR_WIDTH_M = BASE_CHAR_HEIGHT_M * (900 / 1355);

const ALPHA_GRID_W = 90;
const ALPHA_GRID_H = 135;

export interface DecodedLayerTexture {
  texture: THREE.Texture;
  alphaGrid: Uint8Array;
  rawImage: HTMLImageElement | null;
  width: number;
  height: number;
}

const TEXTURE_CACHE = new Map<string, Promise<DecodedLayerTexture>>();

function smoothstepJS(e0: number, e1: number, x: number): number {
  const t = Math.min(1.0, Math.max(0.0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3.0 - 2.0 * t);
}

function loadDecodedLayerTexture(url: string): Promise<DecodedLayerTexture> {
  const hit = TEXTURE_CACHE.get(url);
  if (hit) return hit;

  const p = new Promise<DecodedLayerTexture>((resolve, reject) => {
    if (typeof Image === "undefined" || typeof document === "undefined") {
      resolve({
        texture: new THREE.Texture(),
        alphaGrid: new Uint8Array(ALPHA_GRID_W * ALPHA_GRID_H),
        rawImage: null,
        width: 900,
        height: 1355,
      });
      return;
    }

    const im = new Image();
    if (!url.startsWith("data:") && !url.startsWith("/")) {
      im.crossOrigin = "anonymous";
    }
    im.decoding = "async";
    im.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = ALPHA_GRID_W;
      cv.height = ALPHA_GRID_H;
      const ctx = cv.getContext("2d");
      const alphaGrid = new Uint8Array(ALPHA_GRID_W * ALPHA_GRID_H);
      if (ctx) {
        ctx.drawImage(im, 0, 0, ALPHA_GRID_W, ALPHA_GRID_H);
        const data = ctx.getImageData(0, 0, ALPHA_GRID_W, ALPHA_GRID_H).data;
        for (let i = 0; i < ALPHA_GRID_W * ALPHA_GRID_H; i++) {
          alphaGrid[i] = data[i * 4 + 3];
        }
      }

      const tex = new THREE.Texture(im);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;

      resolve({
        texture: tex,
        alphaGrid,
        rawImage: im,
        width: im.naturalWidth || 900,
        height: im.naturalHeight || 1355,
      });
    };
    im.onerror = (err) => {
      TEXTURE_CACHE.delete(url);
      reject(err);
    };
    im.src = url;
  });

  TEXTURE_CACHE.set(url, p);
  return p;
}

export function sampleMeshAlphaAtUv(
  mesh: THREE.Object3D,
  uv?: THREE.Vector2
): number {
  if (!uv) return 0;
  const grid = mesh.userData?.alphaGrid as Uint8Array | undefined;
  if (!grid) return 255;
  const gx = Math.min(
    ALPHA_GRID_W - 1,
    Math.max(0, Math.floor(uv.x * ALPHA_GRID_W))
  );
  const gy = Math.min(
    ALPHA_GRID_H - 1,
    Math.max(0, Math.floor((1.0 - uv.y) * ALPHA_GRID_H))
  );
  return grid[gy * ALPHA_GRID_W + gx];
}

/**
 * Rich 3D Anatomical Depth-Relief Field `Z(u, v)` in meters (`0 .. +0.078m`)
 * for Front/Back shells so rotating `0° -> 68°` in real 3D perspective exhibits
 * unmistakable 3D facial, bust, torso, leg, and arm curvature with zero cliff stretching!
 */
function computeFrontBack3DReliefMeters(u: number, v: number): number {
  const dx = (u - 0.5) / 0.19;
  const bodyDome = Math.max(0, 1.0 - dx * dx);

  let headZ = 0;
  if (v >= 0.83 && v <= 0.985) {
    const hv = (v - 0.83) / 0.155;
    const hdx = (u - 0.5) / 0.088;
    const hDome = Math.max(0, 1.0 - hdx * hdx) * Math.sin(hv * Math.PI);
    const nose =
      0.015 *
      Math.exp(-Math.pow((u - 0.5) / 0.016, 2)) *
      Math.exp(-Math.pow((v - 0.905) / 0.024, 2));
    headZ = 0.056 * hDome + nose;
  }

  let torsoZ = 0;
  if (v >= 0.44 && v <= 0.845) {
    const tv = (v - 0.44) / 0.405;
    const env = Math.sin(Math.min(1, Math.max(0, tv)) * Math.PI);
    const bust =
      0.024 *
      Math.exp(-Math.pow((Math.abs(u - 0.5) - 0.043) / 0.036, 2)) *
      Math.exp(-Math.pow((v - 0.722) / 0.048, 2));
    const hip =
      0.018 * Math.exp(-Math.pow((v - 0.518) / 0.065, 2)) * bodyDome;
    torsoZ = 0.064 * bodyDome * (0.45 + 0.55 * env) + bust + hip;
  }

  let legZ = 0;
  if (v >= 0.015 && v <= 0.49) {
    const rLegDx = (u - 0.455) / 0.05;
    const lLegDx = (u - 0.545) / 0.05;
    const legCol = Math.max(
      Math.max(0, 1.0 - rLegDx * rLegDx),
      Math.max(0, 1.0 - lLegDx * lLegDx)
    );
    const fadeTop = v > 0.42 ? (0.49 - v) / 0.07 : 1.0;
    legZ = 0.048 * legCol * fadeTop;
  }

  let armZ = 0;
  if (v >= 0.41 && v <= 0.81) {
    const rArmDx = (u - 0.365) / 0.038;
    const lArmDx = (u - 0.635) / 0.038;
    const armCol = Math.max(
      Math.max(0, 1.0 - rArmDx * rArmDx),
      Math.max(0, 1.0 - lArmDx * lArmDx)
    );
    armZ = 0.036 * armCol;
  }

  return Math.max(headZ, torsoZ, legZ, armZ);
}

/**
 * Lateral 3D Depth-Relief Field for the perpendicular `±90°` Side Profile shells
 * (`0 .. +0.072m` lateral shoulder, deltoid, hip, and cranial curvature!).
 */
function computeSideProfile3DReliefMeters(u: number, v: number): number {
  const dx = (u - 0.5) / 0.145;
  const col = Math.max(0, 1.0 - dx * dx);
  const shoulderArm =
    0.032 *
    Math.exp(-Math.pow((u - 0.49) / 0.065, 2)) *
    Math.exp(-Math.pow((v - 0.66) / 0.14, 2));
  const hipThigh =
    0.026 *
    Math.exp(-Math.pow((u - 0.49) / 0.075, 2)) *
    Math.exp(-Math.pow((v - 0.48) / 0.13, 2));
  return 0.046 * col + shoulderArm + hipThigh;
}

let sharedFrontBackGeom: THREE.BufferGeometry | null = null;
let sharedSideGeom: THREE.BufferGeometry | null = null;

function getSharedFrontBack3DGeometry(): THREE.BufferGeometry {
  if (sharedFrontBackGeom) return sharedFrontBackGeom;
  const geom = new THREE.PlaneGeometry(
    BASE_CHAR_WIDTH_M,
    BASE_CHAR_HEIGHT_M,
    76,
    114
  );
  geom.translate(0, BASE_CHAR_HEIGHT_M * 0.5, 0);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, computeFrontBack3DReliefMeters(uv.getX(i), uv.getY(i)));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  sharedFrontBackGeom = geom;
  return geom;
}

function getSharedSide3DGeometry(): THREE.BufferGeometry {
  if (sharedSideGeom) return sharedSideGeom;
  const geom = new THREE.PlaneGeometry(
    BASE_CHAR_WIDTH_M,
    BASE_CHAR_HEIGHT_M,
    72,
    108
  );
  geom.translate(0, BASE_CHAR_HEIGHT_M * 0.5, 0);
  const pos = geom.attributes.position;
  const uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, computeSideProfile3DReliefMeters(uv.getX(i), uv.getY(i)));
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  sharedSideGeom = geom;
  return geom;
}

export interface BodyMorphUniforms {
  uMap: { value: THREE.Texture | null };
  uHeightScale: { value: number };
  uBodyScales: { value: THREE.Vector4 };
  uIsRigidBag: { value: number };
  uIsSideShell: { value: number };
  uShellZOffset: { value: number };
  uEaseOffsetM: { value: number };
  uMirrorX: { value: number };
  uViewOpacity: { value: number };
  uYawAngle: { value: number };
  uLightMoodTint: { value: THREE.Color };
  uFresnelSheen: { value: number };
  uSheenColor: { value: THREE.Color };
  uMaskBaseHeels: { value: number };
  uMaskDressUpper: { value: number };
  uHasBottom: { value: number };
  uHasTop: { value: number };
  uHeatmapMix: { value: number };
  uBustColor: { value: THREE.Color };
  uWaistColor: { value: THREE.Color };
  uHipColor: { value: THREE.Color };
}

export function createBodyMorphUniforms(
  shellZOffset = 0.0,
  isSideShell = false
): BodyMorphUniforms {
  return {
    uMap: { value: null },
    uHeightScale: { value: 1.0 },
    uBodyScales: { value: new THREE.Vector4(1, 1, 1, 1) },
    uIsRigidBag: { value: 0.0 },
    uIsSideShell: { value: isSideShell ? 1.0 : 0.0 },
    uShellZOffset: { value: shellZOffset },
    uEaseOffsetM: { value: 0.0 },
    uMirrorX: { value: 1.0 },
    uViewOpacity: { value: 1.0 },
    uYawAngle: { value: 0.0 },
    uLightMoodTint: { value: new THREE.Color("#FFFFFF") },
    uFresnelSheen: { value: 0.11 },
    uSheenColor: { value: new THREE.Color("#FFFFFF") },
    uMaskBaseHeels: { value: 0.0 },
    uMaskDressUpper: { value: 0.0 },
    uHasBottom: { value: 0.0 },
    uHasTop: { value: 0.0 },
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
    clamp(dims.shoulderInches / std.canonicalShoulderInches, 0.90, 1.18),
    clamp(dims.bustInches / std.canonicalBustInches, 0.88, 1.28),
    clamp(dims.waistInches / std.canonicalWaistInches, 0.82, 1.28),
    clamp(dims.hipsInches / std.canonicalHipsInches, 0.88, 1.30)
  );
  uniforms.uIsRigidBag.value = isRigidBag ? 1.0 : 0.0;
  uniforms.uHeatmapMix.value =
    isGarment && !isRigidBag && visualMode === "heatmap" ? 0.35 : 0.0;

  if (!isGarment) {
    uniforms.uFresnelSheen.value = 0.07;
    uniforms.uSheenColor.value.set("#FFF7F0");
    uniforms.uEaseOffsetM.value = 0.0;
  } else if (fabricProfile) {
    uniforms.uFresnelSheen.value = fabricProfile.fresnelSheen;
    uniforms.uSheenColor.value.set(fabricProfile.sheenTintHex);
    uniforms.uEaseOffsetM.value = computePhysicalEaseExpansionMeters(
      fit,
      fabricProfile,
      isRigidBag
    );
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

export function createPhotorealReliefMaterial(
  uniforms: BodyMorphUniforms
): THREE.ShaderMaterial {
  const lockY = MASTER_AVATAR_ANATOMY_STANDARD.craniofacialLockNormY.toFixed(4);

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uHeightScale;
      uniform vec4 uBodyScales;
      uniform float uIsRigidBag;
      uniform float uIsSideShell;
      uniform float uShellZOffset;
      uniform float uEaseOffsetM;
      uniform float uMirrorX;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying float vNormY;

      void main() {
        vUv = uv;
        vec3 p = position;
        p.x *= uMirrorX;
        float yn = clamp(p.y / 1.58, 0.0, 1.0);
        vNormY = yn;

        if (uIsRigidBag > 0.5) {
          float bagShift = (uBodyScales.w - 1.0) * sign(p.x) * 0.078;
          p.x += bagShift;
          p.z += uShellZOffset;
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
          } else if (yn > 0.475) {
            wScale = mix(uBodyScales.w, uBodyScales.z, smoothstep(0.475, 0.605, yn));
          } else if (yn > 0.14) {
            wScale = mix(1.0, uBodyScales.w, smoothstep(0.14, 0.475, yn));
          }
          // On Side shells (rotated ±90°), local X is anatomical front-to-back depth!
          float effLatScale = uIsSideShell > 0.5 ? mix(1.0, wScale, 0.72) : wScale;
          p.x *= effLatScale;
          if (abs(uEaseOffsetM) > 0.00005 && yn < 0.80 && yn > 0.14) {
            p.x += sign(p.x) * uEaseOffsetM * 1.35;
          }
          p.z = p.z * mix(1.0, wScale, 0.65) + uShellZOffset;

          float chinM = 1.58 * ${lockY};
          if (p.y > chinM) {
            p.y = chinM * uHeightScale + (p.y - chinM);
          } else {
            p.y *= uHeightScale;
          }
        }

        vNormalView = normalize(normalMatrix * vec3(normal.x * uMirrorX, normal.y, normal.z));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform float uViewOpacity;
      uniform float uYawAngle;
      uniform float uIsSideShell;
      uniform vec3 uLightMoodTint;
      uniform float uFresnelSheen;
      uniform vec3 uSheenColor;
      uniform float uMaskBaseHeels;
      uniform float uMaskDressUpper;
      uniform float uHasBottom;
      uniform float uHasTop;
      uniform float uHeatmapMix;
      uniform vec3 uBustColor;
      uniform vec3 uWaistColor;
      uniform vec3 uHipColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying float vNormY;

      void main() {
        if (uViewOpacity < 0.01) {
          discard;
        }
        if (uIsSideShell < 0.5) {
          if (uMaskBaseHeels > 1.5 && (vUv.y < 0.435 || (vUv.y < 0.615 && abs(vUv.x - 0.5) < 0.134))) {
            discard;
          }
          if (uMaskBaseHeels > 0.5 && vUv.y < 0.088) {
            discard;
          }
          if (uMaskDressUpper > 0.5 && vUv.y > 0.322) {
            discard;
          }
        }

        vec4 texel = texture2D(uMap, vUv);
        float alpha = texel.a * uViewOpacity;
        if (alpha < 0.015) {
          discard;
        }

        if (uIsSideShell < 0.5) {
          bool isCreamShapewear = texel.b > 0.28 && (texel.r - texel.b) < 0.23;
          if (uHasBottom > 0.5 && vUv.y >= 0.43 && vUv.y < 0.642 && abs(vUv.x - 0.5) < 0.148 && isCreamShapewear) {
            discard;
          }
          if (uHasTop > 0.5 && vUv.y >= 0.642 && vUv.y < 0.785 && abs(vUv.x - 0.5) < 0.134 && isCreamShapewear) {
            discard;
          }
        }

        vec3 n = normalize(vNormalView);
        if (!gl_FrontFacing) n = -n;
        vec3 keyDir = normalize(vec3(sin(uYawAngle * 1.2) * 0.55 + 0.30, 0.40, 0.84));
        float ndl = max(dot(n, keyDir), 0.0);
        float formShade = mix(0.955, 1.028, ndl);
        vec3 col = texel.rgb * formShade * mix(vec3(1.0), uLightMoodTint, 0.14);

        float spec = pow(ndl, 16.0);
        float rim = pow(1.0 - clamp(abs(n.z), 0.0, 1.0), 2.4);
        col += uSheenColor * (spec * 0.075 + rim * 0.05) * uFresnelSheen;

        if (uHeatmapMix > 0.01 && vNormY < 0.77 && vNormY > 0.14) {
          vec3 zoneCol = uHipColor;
          if (vNormY > 0.68) {
            zoneCol = mix(uWaistColor, uBustColor, smoothstep(0.68, 0.76, vNormY));
          } else if (vNormY > 0.56) {
            zoneCol = mix(uHipColor, uWaistColor, smoothstep(0.56, 0.64, vNormY));
          }
          col = mix(col, zoneCol, uHeatmapMix);
        }

        gl_FragColor = vec4(clamp(col, 0.0, 1.0), alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

export interface Character3DRig {
  frontMesh: THREE.Mesh;
  rightSideMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  leftSideMesh: THREE.Mesh;
  frontUniforms: BodyMorphUniforms;
  rightSideUniforms: BodyMorphUniforms;
  backUniforms: BodyMorphUniforms;
  leftSideUniforms: BodyMorphUniforms;
}

export async function loadCharacter3DRig(): Promise<Character3DRig> {
  const [fDec, sDec, bDec] = await Promise.all([
    loadDecodedLayerTexture(modLayerUrl("base_front")),
    loadDecodedLayerTexture(modLayerUrl("base_side")),
    loadDecodedLayerTexture(modLayerUrl("base_back")),
  ]);

  const fbGeom = getSharedFrontBack3DGeometry();
  const sideGeom = getSharedSide3DGeometry();

  // 1. Front 0° Shell (faces +Z in avatarTurntable)
  const frontUniforms = createBodyMorphUniforms(0.0, false);
  frontUniforms.uMap.value = fDec.texture;
  const frontMesh = new THREE.Mesh(
    fbGeom,
    createPhotorealReliefMaterial(frontUniforms)
  );
  frontMesh.name = "CharacterFront3D";
  frontMesh.renderOrder = 10;
  frontMesh.userData = { viewRole: "front", alphaGrid: fDec.alphaGrid };

  // 2. Right-Orbit +90° Shell (`rotY = -π/2` so when avatarTurntable.rotation.y = +π/2, it faces +Z camera!)
  // base_side.webp faces RIGHT, which matches yaw = +90° (face pointing right)!
  const rightSideUniforms = createBodyMorphUniforms(0.0, true);
  rightSideUniforms.uMap.value = sDec.texture;
  rightSideUniforms.uMirrorX.value = 1.0;
  const rightSideMesh = new THREE.Mesh(
    sideGeom,
    createPhotorealReliefMaterial(rightSideUniforms)
  );
  rightSideMesh.rotation.y = -Math.PI * 0.5;
  rightSideMesh.name = "CharacterRightSide3D";
  rightSideMesh.renderOrder = 10;
  rightSideMesh.userData = { viewRole: "sideR", alphaGrid: sDec.alphaGrid };

  // 3. Back 180° Shell (`rotY = π` so when avatarTurntable.rotation.y = π, it faces +Z camera!)
  const backUniforms = createBodyMorphUniforms(0.0, false);
  backUniforms.uMap.value = bDec.texture;
  const backMesh = new THREE.Mesh(
    fbGeom,
    createPhotorealReliefMaterial(backUniforms)
  );
  backMesh.rotation.y = Math.PI;
  backMesh.name = "CharacterBack3D";
  backMesh.renderOrder = 10;
  backMesh.userData = { viewRole: "back", alphaGrid: bDec.alphaGrid };

  // 4. Left-Orbit 270° Shell (`rotY = +π/2` so when avatarTurntable.rotation.y = 3π/2 (-90°), it faces +Z camera!)
  // At yaw = -90°, her face points LEFT, so mirror base_side.webp horizontally (`uMirrorX = -1`)!
  const leftSideUniforms = createBodyMorphUniforms(0.0, true);
  leftSideUniforms.uMap.value = sDec.texture;
  leftSideUniforms.uMirrorX.value = -1.0;
  const leftSideMesh = new THREE.Mesh(
    sideGeom,
    createPhotorealReliefMaterial(leftSideUniforms)
  );
  leftSideMesh.rotation.y = Math.PI * 0.5;
  leftSideMesh.name = "CharacterLeftSide3D";
  leftSideMesh.renderOrder = 10;
  leftSideMesh.userData = { viewRole: "sideL", alphaGrid: sDec.alphaGrid };

  return {
    frontMesh,
    rightSideMesh,
    backMesh,
    leftSideMesh,
    frontUniforms,
    rightSideUniforms,
    backUniforms,
    leftSideUniforms,
  };
}

export interface Wearable3DItemRig {
  product: Product;
  slot: WearableSlotType;
  isRigidBag: boolean;
  fabric: FabricPhysicsProfile;
  frontMesh: THREE.Mesh;
  backMesh: THREE.Mesh;
  frontUniforms: BodyMorphUniforms;
  backUniforms: BodyMorphUniforms;
}

function resolveModularSlugsForProduct(
  product: Product,
  hasShinCoveringPants: boolean
): {
  slot: WearableSlotType;
  frontUrl: string | null;
  backUrl: string | null;
  shellZ: number;
  renderOrder: number;
  isCustomCutout: boolean;
} {
  const id = product.id;
  if (id in MOD_SHOE_SLUG) {
    const baseSlug = MOD_SHOE_SLUG[id];
    const slug = hasShinCoveringPants ? `${baseSlug}_under` : baseSlug;
    return {
      slot: "shoes",
      frontUrl: modLayerUrl(`${slug}_front`),
      backUrl: modLayerUrl(`${slug}_back`),
      shellZ: 0.005,
      renderOrder: 20,
      isCustomCutout: false,
    };
  }
  if (id in MOD_DRESS_SLUG) {
    const slug = MOD_DRESS_SLUG[id].slug;
    return {
      slot: "dress",
      frontUrl: modLayerUrl(`${slug}_front`),
      backUrl: modLayerUrl(`${slug}_back`),
      shellZ: 0.015,
      renderOrder: 35,
      isCustomCutout: false,
    };
  }
  if (id in MOD_TOP_SLUG) {
    const tm = MOD_TOP_SLUG[id];
    return {
      slot: "top",
      frontUrl: modLayerUrl(`${tm.slug}_front`),
      backUrl: modLayerUrl(`${tm.slug}_back`),
      shellZ: tm.overWaist ? 0.019 : 0.009,
      renderOrder: tm.overWaist ? 40 : 25,
      isCustomCutout: false,
    };
  }
  if (id in MOD_BOT_SLUG) {
    const bm = MOD_BOT_SLUG[id];
    return {
      slot: "bottom",
      frontUrl: modLayerUrl(`${bm.slug}_front`),
      backUrl: modLayerUrl(`${bm.slug}_back`),
      shellZ: 0.013,
      renderOrder: 30,
      isCustomCutout: false,
    };
  }
  if (id in MOD_BELT_SLUG) {
    const slug = MOD_BELT_SLUG[id];
    return {
      slot: "belt",
      frontUrl: modLayerUrl(`${slug}_front`),
      backUrl: modLayerUrl(`${slug}_back`),
      shellZ: 0.024,
      renderOrder: 50,
      isCustomCutout: false,
    };
  }
  if (id in MOD_OUTER_SLUG) {
    const om = MOD_OUTER_SLUG[id];
    return {
      slot: "outerwear",
      frontUrl: modLayerUrl(`${om.slug}_front`),
      backUrl: modLayerUrl(`${om.slug}_back`),
      shellZ: 0.031,
      renderOrder: 60,
      isCustomCutout: false,
    };
  }
  if (id in MOD_BAG_SLUG) {
    const slug = MOD_BAG_SLUG[id];
    return {
      slot: "bag",
      frontUrl: modLayerUrl(`${slug}_front`),
      backUrl: modLayerUrl(`${slug}_back`),
      shellZ: 0.052,
      renderOrder: 70,
      isCustomCutout: false,
    };
  }

  const anc = classifyWearableSlotAndAnchors(product);
  const slotZMap: Record<WearableSlotType, [number, number]> = {
    shoes: [0.006, 21],
    top: [0.019, 41],
    bottom: [0.014, 31],
    dress: [0.016, 36],
    belt: [0.025, 51],
    outerwear: [0.032, 61],
    bag: [0.054, 71],
  };
  const [shellZ, renderOrder] = slotZMap[anc.slot];
  return {
    slot: anc.slot,
    frontUrl: product.imageUrl || null,
    backUrl: product.imageUrl || null,
    shellZ,
    renderOrder,
    isCustomCutout: true,
  };
}

async function buildAnchoredCustomLayerTextures(
  product: Product
): Promise<{ fDec: DecodedLayerTexture; bDec: DecodedLayerTexture }> {
  const cleanUrl = await isolateProductBackgroundClient(product.imageUrl || "");
  const rawDec = await loadDecodedLayerTexture(cleanUrl);
  if (typeof document === "undefined" || !rawDec.rawImage) {
    return { fDec: rawDec, bDec: rawDec };
  }

  const anc = classifyWearableSlotAndAnchors(product);
  const img = rawDec.rawImage;
  const aspect = (img.naturalWidth || 1) / Math.max(1, img.naturalHeight || 1);
  const boxW = anc.normW * 900;
  const boxH = anc.normH * 1355;
  const cx = anc.normX * 900;
  const cy = anc.normY * 1355;
  let drawW = boxW;
  let drawH = drawW / Math.max(0.25, aspect);
  if (drawH > boxH * 1.18) {
    drawH = boxH * 1.18;
    drawW = drawH * aspect;
  }

  const fCv = document.createElement("canvas");
  fCv.width = 900;
  fCv.height = 1355;
  fCv.getContext("2d")!.drawImage(img, cx - drawW * 0.5, cy - drawH * 0.5, drawW, drawH);

  const bCv = document.createElement("canvas");
  bCv.width = 900;
  bCv.height = 1355;
  const bCtx = bCv.getContext("2d")!;
  bCtx.translate(900, 0);
  bCtx.scale(-1, 1);
  bCtx.drawImage(img, cx - drawW * 0.5, cy - drawH * 0.5, drawW, drawH);

  const [fDec, bDec] = await Promise.all([
    loadDecodedLayerTexture(fCv.toDataURL("image/png")),
    loadDecodedLayerTexture(bCv.toDataURL("image/png")),
  ]);
  return { fDec, bDec };
}

export async function loadWearable3DItemRig(
  product: Product,
  hasShinCoveringPants: boolean
): Promise<Wearable3DItemRig> {
  const meta = resolveModularSlugsForProduct(product, hasShinCoveringPants);
  const fabric = resolveGarmentFabricPhysics(product);
  const isRigidBag = meta.slot === "bag";

  let fDec: DecodedLayerTexture;
  let bDec: DecodedLayerTexture;

  if (!meta.isCustomCutout && meta.frontUrl && meta.backUrl) {
    [fDec, bDec] = await Promise.all([
      loadDecodedLayerTexture(meta.frontUrl),
      loadDecodedLayerTexture(meta.backUrl),
    ]);
  } else {
    const pair = await buildAnchoredCustomLayerTextures(product);
    fDec = pair.fDec;
    bDec = pair.bDec;
  }

  const geom = getSharedFrontBack3DGeometry();

  const frontUniforms = createBodyMorphUniforms(meta.shellZ, false);
  frontUniforms.uMap.value = fDec.texture;
  const frontMesh = new THREE.Mesh(
    geom,
    createPhotorealReliefMaterial(frontUniforms)
  );
  frontMesh.name = `${product.id}_front_3d`;
  frontMesh.renderOrder = meta.renderOrder;
  frontMesh.userData = {
    viewRole: "front",
    productId: product.id,
    product,
    slot: meta.slot,
    fabricProfile: fabric,
    alphaGrid: fDec.alphaGrid,
  };

  // Mounted at rotation.y = Math.PI inside avatarTurntable so it rotates in true 3D opposite Front!
  const backUniforms = createBodyMorphUniforms(meta.shellZ, false);
  backUniforms.uMap.value = bDec.texture;
  const backMesh = new THREE.Mesh(
    geom,
    createPhotorealReliefMaterial(backUniforms)
  );
  backMesh.rotation.y = Math.PI;
  backMesh.name = `${product.id}_back_3d`;
  backMesh.renderOrder = meta.renderOrder;
  backMesh.userData = {
    viewRole: "back",
    productId: product.id,
    product,
    slot: meta.slot,
    fabricProfile: fabric,
    alphaGrid: bDec.alphaGrid,
  };

  return {
    product,
    slot: meta.slot,
    isRigidBag,
    fabric,
    frontMesh,
    backMesh,
    frontUniforms,
    backUniforms,
  };
}

export interface SideOutfit3DRig {
  rightMesh: THREE.Mesh;
  leftMesh: THREE.Mesh;
  rightUniforms: BodyMorphUniforms;
  leftUniforms: BodyMorphUniforms;
}

export async function loadMatchedSideOutfit3DRig(
  products: Product[]
): Promise<SideOutfit3DRig> {
  const sideIdx = resolveSideOutfitFallbackIndex(products);
  const url = `${BASE}/models/runway_ai/ae_outfit_${sideIdx}_side.webp?v=${LAYER_VER}`;
  const sDec = await loadDecodedLayerTexture(url);
  const sideGeom = getSharedSide3DGeometry();

  // ae_outfit_*_side.webp faces LEFT:
  // - At yaw = +90° (rotY = -π/2), face should point RIGHT -> uMirrorX = -1.0!
  // - At yaw = 270° (rotY = +π/2), face should point LEFT  -> uMirrorX = +1.0!
  const rightUniforms = createBodyMorphUniforms(0.008, true);
  rightUniforms.uMap.value = sDec.texture;
  rightUniforms.uMirrorX.value = -1.0;
  const rightMesh = new THREE.Mesh(
    sideGeom,
    createPhotorealReliefMaterial(rightUniforms)
  );
  rightMesh.rotation.y = -Math.PI * 0.5;
  rightMesh.renderOrder = 25;
  rightMesh.userData = { viewRole: "sideR", alphaGrid: sDec.alphaGrid };

  const leftUniforms = createBodyMorphUniforms(0.008, true);
  leftUniforms.uMap.value = sDec.texture;
  leftUniforms.uMirrorX.value = 1.0;
  const leftMesh = new THREE.Mesh(
    sideGeom,
    createPhotorealReliefMaterial(leftUniforms)
  );
  leftMesh.rotation.y = Math.PI * 0.5;
  leftMesh.renderOrder = 25;
  leftMesh.userData = { viewRole: "sideL", alphaGrid: sDec.alphaGrid };

  return { rightMesh, leftMesh, rightUniforms, leftUniforms };
}

/**
 * Watertight 360° Standalone 3D Item Volume (`mode="product"`):
 * Erodes 3px inward, bleeds pure interior RGB 24 passes outward, and sculpts a closed
 * front+back C²-cushioned 3D garment/bag/shoe mesh that spins continuously 360°!
 */
export async function loadStandalone3DItemInstance(
  product: Product
): Promise<THREE.Group> {
  const group = new THREE.Group();
  if (!product.imageUrl || typeof document === "undefined") return group;

  const cleanUrl = await isolateProductBackgroundClient(product.imageUrl);
  const rawDec = await loadDecodedLayerTexture(cleanUrl);
  const fabric = resolveGarmentFabricPhysics(product);
  const img = rawDec.rawImage;
  if (!img) return group;

  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, S, S);
  const imgData = ctx.getImageData(0, 0, S, S);
  const d = imgData.data;

  const rawOpaque = new Uint8Array(S * S);
  for (let i = 0; i < S * S; i++) {
    const a = d[i * 4 + 3];
    const minC = Math.min(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    rawOpaque[i] = a > 238 && minC < 236 ? 1 : 0;
  }
  const solid = new Uint8Array(S * S);
  for (let y = 3; y < S - 3; y++) {
    for (let x = 3; x < S - 3; x++) {
      let ok = 1;
      for (let dy = -3; dy <= 3 && ok; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          if (!rawOpaque[(y + dy) * S + (x + dx)]) {
            ok = 0;
            break;
          }
        }
      }
      solid[y * S + x] = ok;
    }
  }
  let seedCnt = 0;
  for (let i = 0; i < S * S; i++) seedCnt += solid[i];
  if (seedCnt < 24) {
    for (let i = 0; i < S * S; i++) solid[i] = rawOpaque[i];
  }

  for (let pass = 0; pass < 24; pass++) {
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const k = y * S + x;
        if (solid[k]) continue;
        const nbrs = [k - 1, k + 1, k - S, k + S];
        for (const nb of nbrs) {
          if (solid[nb] === 1) {
            d[k * 4] = d[nb * 4];
            d[k * 4 + 1] = d[nb * 4 + 1];
            d[k * 4 + 2] = d[nb * 4 + 2];
            solid[k] = 2;
            break;
          }
        }
      }
    }
    for (let i = 0; i < S * S; i++) {
      if (solid[i] === 2) solid[i] = 1;
    }
  }
  for (let i = 0; i < S * S; i++) d[i * 4 + 3] = 255;
  ctx.putImageData(imgData, 0, 0);

  const bledTex = new THREE.CanvasTexture(cv);
  bledTex.colorSpace = THREE.SRGBColorSpace;
  bledTex.needsUpdate = true;

  const G = 120;
  const gCv = document.createElement("canvas");
  gCv.width = G;
  gCv.height = G;
  const gCtx = gCv.getContext("2d")!;
  gCtx.drawImage(img, 0, 0, G, G);
  const gd = gCtx.getImageData(0, 0, G, G).data;

  const aFloat = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) {
    aFloat[i] = gd[i * 4 + 3] / 255.0;
  }
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

  const aspect = rawDec.width / Math.max(1, rawDec.height);
  const boxH = 0.64;
  const boxW = Math.min(0.66, boxH * aspect);
  const halfThick =
    product.category === "accessory"
      ? 0.032
      : product.category === "shoes"
      ? 0.028
      : 0.020;

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
        Math.cos((u - 0.5) * Math.PI * 0.9) * Math.sin(uvY * Math.PI) * 0.018;
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

  for (let pass = 0; pass < 3; pass++) {
    const nextX = new Float32Array(positions.length / 3);
    const nextY = new Float32Array(positions.length / 3);
    for (let i = 0; i < nextX.length; i++) {
      nextX[i] = positions[i * 3];
      nextY[i] = positions[i * 3 + 1];
    }
    for (let r = 1; r < G - 1; r++) {
      for (let c = 1; c < G - 1; c++) {
        const k = r * G + c;
        const vi = idxF[k];
        if (vi < 0 || idxB[k] !== vi) continue;
        let sx = 0;
        let sy = 0;
        let cnt = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nk = (r + dr) * G + (c + dc);
            const nvi = idxF[nk];
            if (nvi >= 0 && idxB[nk] === nvi) {
              sx += positions[nvi * 3];
              sy += positions[nvi * 3 + 1];
              cnt++;
            }
          }
        }
        if (cnt >= 2) {
          nextX[vi] = 0.5 * positions[vi * 3] + 0.5 * (sx / cnt);
          nextY[vi] = 0.5 * positions[vi * 3 + 1] + 0.5 * (sy / cnt);
        }
      }
    }
    for (let i = 0; i < nextX.length; i++) {
      positions[i * 3] = nextX[i];
      positions[i * 3 + 1] = nextY[i];
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
        indices.push(idxF[k00], idxF[k10], idxF[k11], idxF[k00], idxF[k11], idxF[k01]);
      }
      if (idxB[k00] >= 0 && idxB[k10] >= 0 && idxB[k11] >= 0 && idxB[k01] >= 0) {
        indices.push(idxB[k00], idxB[k11], idxB[k10], idxB[k00], idxB[k01], idxB[k11]);
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

  const u = createBodyMorphUniforms(0.0, false);
  u.uMap.value = bledTex;
  u.uFresnelSheen.value = fabric.fresnelSheen * 0.72;
  u.uSheenColor.value.set(fabric.sheenTintHex);

  const mat = createPhotorealReliefMaterial(u);
  mat.transparent = false;
  mat.depthWrite = true;

  const mesh = new THREE.Mesh(geom, mat);
  group.add(mesh);
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
    modLayerUrl("top_espresso_corset_front"),
    modLayerUrl("bot_champagne_trousers_front"),
    modLayerUrl("shoe_noir_slingbacks_under_front"),
    modLayerUrl("bag_merlot_crescent_front"),
  ];
  starter.forEach((u, idx) => {
    setTimeout(() => {
      void loadDecodedLayerTexture(u).catch(() => {});
    }, idx * 35);
  });
}

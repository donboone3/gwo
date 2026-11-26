import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Product } from "../types";
import { BodyScanDimensions } from "./body-scan-analyzer";
import { Render3DVisualMode } from "./parametric-3d-engine";
import {
  classifyWearableSlotAndAnchors,
  isolateProductBackgroundClient,
  WearableSlotType,
} from "./avatar-ready-pipeline";
import { ALL_CERTIFIED_MODULAR_SKU_IDS } from "./modular-outfit-compositor";
export { ALL_CERTIFIED_MODULAR_SKU_IDS };
import { AvatarExactFitReport, ZoneFeel } from "../catalog/fit-intelligence";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const GLB_ASSET_VER = "glb5";
export const BASE_CHAR_HEIGHT_M = 1.58; // 5'2" (62") baseline in Three.js meters

let sharedGltfLoader: GLTFLoader | null = null;
const GLB_PROMISE_CACHE = new Map<string, Promise<THREE.Group>>();
const RUNTIME_MESH_CACHE = new Map<string, Promise<THREE.Group>>();

function getLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
  }
  return sharedGltfLoader;
}

export interface BodyMorphUniforms {
  uHeightScale: { value: number };
  uBodyScales: { value: THREE.Vector4 }; // x=shoulder, y=bust, z=waist, w=hips
  uIsRigidBag: { value: number };
  uHeatmapMix: { value: number };
  uBustColor: { value: THREE.Color };
  uWaistColor: { value: THREE.Color };
  uHipColor: { value: THREE.Color };
}

export function createBodyMorphUniforms(): BodyMorphUniforms {
  return {
    uHeightScale: { value: 1.0 },
    uBodyScales: { value: new THREE.Vector4(1, 1, 1, 1) },
    uIsRigidBag: { value: 0.0 },
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
  dims: BodyScanDimensions,
  visualMode: Render3DVisualMode,
  isGarment: boolean,
  isRigidBag: boolean,
  fit?: AvatarExactFitReport
): void {
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  uniforms.uHeightScale.value = clamp(dims.heightInches / 62.0, 0.92, 1.12);
  uniforms.uBodyScales.value.set(
    clamp(dims.shoulderInches / 15.0, 0.88, 1.22),
    clamp(dims.bustInches / 32.25, 0.86, 1.34),
    clamp(dims.waistInches / 27.0, 0.80, 1.34),
    clamp(dims.hipsInches / 34.0, 0.86, 1.36)
  );
  uniforms.uIsRigidBag.value = isRigidBag ? 1.0 : 0.0;
  uniforms.uHeatmapMix.value =
    isGarment && !isRigidBag && visualMode === "heatmap" ? 0.38 : 0.0;

  if (fit) {
    const bFeel = fit.zones.find((z) => z.zone === "Bust")?.feel;
    const wFeel = fit.zones.find((z) => z.zone === "Waist")?.feel;
    const hFeel = fit.zones.find((z) => z.zone === "Hips")?.feel;
    uniforms.uBustColor.value.set(feelToHex(bFeel || "tailored_ideal"));
    uniforms.uWaistColor.value.set(feelToHex(wFeel || "tailored_ideal"));
    uniforms.uHipColor.value.set(feelToHex(hFeel || "tailored_ideal"));
  }
}

export function attachBodyMorphShader(
  material: THREE.MeshStandardMaterial,
  uniforms: BodyMorphUniforms
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHeightScale = uniforms.uHeightScale;
    shader.uniforms.uBodyScales = uniforms.uBodyScales;
    shader.uniforms.uIsRigidBag = uniforms.uIsRigidBag;
    shader.uniforms.uHeatmapMix = uniforms.uHeatmapMix;
    shader.uniforms.uBustColor = uniforms.uBustColor;
    shader.uniforms.uWaistColor = uniforms.uWaistColor;
    shader.uniforms.uHipColor = uniforms.uHipColor;

    shader.vertexShader =
      `
      uniform float uHeightScale;
      uniform vec4 uBodyScales;
      uniform float uIsRigidBag;
      varying float vNormY;
      ` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float yn = clamp(transformed.y / 1.58, 0.0, 1.0);
        vNormY = yn;
        if (uIsRigidBag > 0.5) {
          float bagShift = (uBodyScales.w - 1.0) * sign(transformed.x) * 0.085;
          transformed.x += bagShift;
          transformed.y *= uHeightScale;
        } else {
          float wScale = 1.0;
          if (yn > 0.855) {
            wScale = 1.0;
          } else if (yn > 0.805) {
            wScale = mix(uBodyScales.x, 1.0, smoothstep(0.805, 0.855, yn));
          } else if (yn > 0.725) {
            wScale = mix(uBodyScales.y, uBodyScales.x, smoothstep(0.725, 0.805, yn));
          } else if (yn > 0.605) {
            wScale = mix(uBodyScales.z, uBodyScales.y, smoothstep(0.605, 0.725, yn));
          } else if (yn > 0.475) {
            wScale = mix(uBodyScales.w, uBodyScales.z, smoothstep(0.475, 0.605, yn));
          } else if (yn > 0.14) {
            wScale = mix(1.0, uBodyScales.w, smoothstep(0.14, 0.475, yn));
          }
          float zScale = mix(1.0, wScale, 0.82);
          transformed.x *= wScale;
          transformed.z *= zScale;
          transformed.y *= uHeightScale;
        }
        `
      );

    shader.fragmentShader =
      `
      uniform float uHeatmapMix;
      uniform vec3 uBustColor;
      uniform vec3 uWaistColor;
      uniform vec3 uHipColor;
      varying float vNormY;
      ` +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        if (uHeatmapMix > 0.01) {
          vec3 zoneCol = uHipColor;
          if (vNormY > 0.68) {
            zoneCol = mix(uWaistColor, uBustColor, smoothstep(0.68, 0.76, vNormY));
          } else if (vNormY > 0.56) {
            zoneCol = mix(uHipColor, uWaistColor, smoothstep(0.56, 0.64, vNormY));
          }
          gl_FragColor.rgb = mix(gl_FragColor.rgb, zoneCol, uHeatmapMix);
        }
        #include <dithering_fragment>
        `
      );
  };
  material.customProgramCacheKey = () => "gwo-body-morph-v3";
  material.needsUpdate = true;
}

function loadRawGlbPrototype(url: string): Promise<THREE.Group> {
  const existing = GLB_PROMISE_CACHE.get(url);
  if (existing) return existing;
  const p = getLoader()
    .loadAsync(url)
    .then((gltf) => gltf.scene);
  p.catch(() => {
    GLB_PROMISE_CACHE.delete(url);
  });
  GLB_PROMISE_CACHE.set(url, p);
  return p;
}

function cloneGroupWithMorphMaterials(
  proto: THREE.Group,
  uniforms: BodyMorphUniforms,
  productMeta?: { product: Product; slot: WearableSlotType }
): THREE.Group {
  const clone = proto.clone(true);
  clone.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      if (productMeta) {
        mesh.userData.productId = productMeta.product.id;
        mesh.userData.product = productMeta.product;
        mesh.userData.slot = productMeta.slot;
      }
      const origMat = mesh.material;
      const cloneSingle = (m: THREE.Material) => {
        const cm = m.clone() as THREE.MeshStandardMaterial;
        if (cm.isMeshStandardMaterial) {
          attachBodyMorphShader(cm, uniforms);
        }
        return cm;
      };
      mesh.material = Array.isArray(origMat)
        ? origMat.map(cloneSingle)
        : cloneSingle(origMat);
    }
  });
  return clone;
}

export async function loadCharacterGlbInstance(
  uniforms: BodyMorphUniforms
): Promise<THREE.Group> {
  const url = `${BASE}/models/glb/avatar_character.glb?v=${GLB_ASSET_VER}`;
  const proto = await loadRawGlbPrototype(url);
  return cloneGroupWithMorphMaterials(proto, uniforms);
}

/**
 * Runtime 3D Volumetric Mesh Builder for ANY newly imported URL or uploaded photo!
 * Traces the alpha-isolated garment silhouette on an offscreen canvas and builds a smooth
 * closed 3D mesh positioned either at `(0,0,0)` (standalone 3D item) or anchored onto the 3D Character!
 */
async function buildRuntime3DItemPrototype(
  product: Product,
  standalone: boolean
): Promise<THREE.Group> {
  const cacheKey = `${standalone ? "st" : "wear"}:${product.id}:${product.imageUrl || ""}`;
  const hit = RUNTIME_MESH_CACHE.get(cacheKey);
  if (hit) return hit;

  const promise = (async () => {
    const group = new THREE.Group();
    if (typeof document === "undefined" || !product.imageUrl) return group;

    const cleanUrl = await isolateProductBackgroundClient(product.imageUrl);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      if (!cleanUrl.startsWith("data:") && !cleanUrl.startsWith("/")) {
        im.crossOrigin = "anonymous";
      }
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = cleanUrl;
    });

    const G = 52;
    const cv = document.createElement("canvas");
    cv.width = G;
    cv.height = G;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, G, G);
    const imgData = ctx.getImageData(0, 0, G, G).data;

    const anc = classifyWearableSlotAndAnchors(product);
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);

    let boxW = 0.44;
    let boxH = boxW / Math.max(0.35, aspect);
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let halfThick = 0.048;

    if (!standalone) {
      boxH = BASE_CHAR_HEIGHT_M * anc.normH;
      boxW = Math.min(0.48, boxH * aspect);
      cx = (anc.normX - 0.5) * (BASE_CHAR_HEIGHT_M * (900 / 1355));
      cy = (1.0 - anc.normY) * BASE_CHAR_HEIGHT_M;
      cz = 0.085 + anc.zOrder * 0.0006;
      halfThick = anc.slot === "bag" ? 0.042 : 0.055;
    }

    const alphaGrid = new Uint8Array(G * G);
    for (let i = 0; i < G * G; i++) {
      alphaGrid[i] = imgData[i * 4 + 3] > 45 ? 1 : 0;
    }

    const positions: number[] = [];
    const uvs: number[] = [];
    const idxF = new Int32Array(G * G).fill(-1);
    const idxB = new Int32Array(G * G).fill(-1);

    for (let r = 0; r < G; r++) {
      for (let c = 0; c < G; c++) {
        const k = r * G + c;
        const inside = alphaGrid[k] === 1;
        const nbr =
          (r > 0 && alphaGrid[(r - 1) * G + c] === 1) ||
          (r + 1 < G && alphaGrid[(r + 1) * G + c] === 1) ||
          (c > 0 && alphaGrid[r * G + (c - 1)] === 1) ||
          (c + 1 < G && alphaGrid[r * G + (c + 1)] === 1);
        if (!inside && !nbr) continue;

        const u = (c + 0.5) / G;
        const v = (r + 0.5) / G;
        const lx = (u - 0.5) * boxW;
        const ly = (0.5 - v) * boxH;
        const archZ = !standalone && anc.slot !== "bag"
          ? Math.cos((u - 0.5) * Math.PI) * 0.045
          : 0;
        const lz = inside ? halfThick : 0;

        idxF[k] = positions.length / 3;
        positions.push(cx + lx, cy + ly, cz + archZ + lz);
        uvs.push(u, 1 - v);

        if (inside) {
          idxB[k] = positions.length / 3;
          positions.push(cx + lx, cy + ly, cz + archZ - lz);
          uvs.push(u, 1 - v);
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

    const tex = new THREE.TextureLoader().load(cleanUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.56,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    group.add(mesh);
    return group;
  })();

  RUNTIME_MESH_CACHE.set(cacheKey, promise);
  return promise;
}

export async function loadWearable3DItemInstance(
  product: Product,
  uniforms: BodyMorphUniforms
): Promise<THREE.Group> {
  const slot = classifyWearableSlotAndAnchors(product).slot;
  const proto = ALL_CERTIFIED_MODULAR_SKU_IDS.has(product.id)
    ? await loadRawGlbPrototype(
        `${BASE}/models/glb/items/${product.id}.glb?v=${GLB_ASSET_VER}`
      )
    : await buildRuntime3DItemPrototype(product, false);

  return cloneGroupWithMorphMaterials(proto, uniforms, { product, slot });
}

export async function loadStandalone3DItemInstance(
  product: Product
): Promise<THREE.Group> {
  const proto = ALL_CERTIFIED_MODULAR_SKU_IDS.has(product.id)
    ? await loadRawGlbPrototype(
        `${BASE}/models/glb/standalone/${product.id}.glb?v=${GLB_ASSET_VER}`
      )
    : await buildRuntime3DItemPrototype(product, true);

  return proto.clone(true);
}

/**
 * Resolves the clean 3D-rendered in-app item image URL (`public/models/items_3d/<sku>.webp`)
 * for all 36 catalog SKUs, falling back to `product.imageUrl` for external URL imports!
 */
export function getInApp3DRenderedItemUrl(product: Product): string | undefined {
  if (ALL_CERTIFIED_MODULAR_SKU_IDS.has(product.id)) {
    return `${BASE}/models/items_3d/${product.id}.webp?v=${GLB_ASSET_VER}`;
  }
  return product.imageUrl;
}

let preloaded3D = false;
export function preloadCore3DGlbs(): void {
  if (preloaded3D || typeof window === "undefined") return;
  preloaded3D = true;
  const starter = [
    `${BASE}/models/glb/avatar_character.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-espresso-corset.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-champagne-trousers.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-noir-slingbacks.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-burgundy-crescent-bag.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-ivory-tweed-blazer.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-acetate-beaded-tank.glb?v=${GLB_ASSET_VER}`,
    `${BASE}/models/glb/items/prod-ae-vintage-wide-denim.glb?v=${GLB_ASSET_VER}`,
  ];
  starter.forEach((u, idx) => {
    setTimeout(() => {
      void loadRawGlbPrototype(u);
    }, idx * 45);
  });
}

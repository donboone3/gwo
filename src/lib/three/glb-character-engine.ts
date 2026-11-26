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
import {
  MASTER_AVATAR_ANATOMY_STANDARD,
  FabricPhysicsProfile,
  computePhysicalEaseExpansionMeters,
  enforceRealisticAvatarAnatomy,
  resolveGarmentFabricPhysics,
} from "../realism/master-avatar-clothing-realism";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const GLB_ASSET_VER = "glb7";
export const BASE_CHAR_HEIGHT_M = MASTER_AVATAR_ANATOMY_STANDARD.canonicalHeightMeters;

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
  uEaseOffsetM: { value: number };
  uSubsurfaceWrap: { value: number };
  uSubsurfaceColor: { value: THREE.Color };
  uFresnelSheen: { value: number };
  uSheenColor: { value: THREE.Color };
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
    uEaseOffsetM: { value: 0.0 },
    uSubsurfaceWrap: { value: 0.0 },
    uSubsurfaceColor: {
      value: new THREE.Color(
        MASTER_AVATAR_ANATOMY_STANDARD.skinOptics.subsurfaceWarmTintHex
      ),
    },
    uFresnelSheen: { value: 0.12 },
    uSheenColor: { value: new THREE.Color("#FFFFFF") },
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
    1.14
  );
  uniforms.uBodyScales.value.set(
    clamp(dims.shoulderInches / std.canonicalShoulderInches, 0.88, 1.22),
    clamp(dims.bustInches / std.canonicalBustInches, 0.86, 1.34),
    clamp(dims.waistInches / std.canonicalWaistInches, 0.80, 1.34),
    clamp(dims.hipsInches / std.canonicalHipsInches, 0.86, 1.36)
  );
  uniforms.uIsRigidBag.value = isRigidBag ? 1.0 : 0.0;
  uniforms.uHeatmapMix.value =
    isGarment && !isRigidBag && visualMode === "heatmap" ? 0.38 : 0.0;

  if (!isGarment) {
    uniforms.uSubsurfaceWrap.value = std.skinOptics.subsurfaceWrap;
    uniforms.uFresnelSheen.value = std.skinOptics.fresnelRimStrength;
    uniforms.uSheenColor.value.set(std.skinOptics.subsurfaceWarmTintHex);
    uniforms.uEaseOffsetM.value = 0.0;
  } else if (fabricProfile) {
    uniforms.uSubsurfaceWrap.value = 0.0;
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

export function attachBodyMorphShader(
  material: THREE.MeshStandardMaterial,
  uniforms: BodyMorphUniforms
): void {
  const lockY = MASTER_AVATAR_ANATOMY_STANDARD.craniofacialLockNormY.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHeightScale = uniforms.uHeightScale;
    shader.uniforms.uBodyScales = uniforms.uBodyScales;
    shader.uniforms.uIsRigidBag = uniforms.uIsRigidBag;
    shader.uniforms.uEaseOffsetM = uniforms.uEaseOffsetM;
    shader.uniforms.uSubsurfaceWrap = uniforms.uSubsurfaceWrap;
    shader.uniforms.uSubsurfaceColor = uniforms.uSubsurfaceColor;
    shader.uniforms.uFresnelSheen = uniforms.uFresnelSheen;
    shader.uniforms.uSheenColor = uniforms.uSheenColor;
    shader.uniforms.uHeatmapMix = uniforms.uHeatmapMix;
    shader.uniforms.uBustColor = uniforms.uBustColor;
    shader.uniforms.uWaistColor = uniforms.uWaistColor;
    shader.uniforms.uHipColor = uniforms.uHipColor;

    shader.vertexShader =
      `
      uniform float uHeightScale;
      uniform vec4 uBodyScales;
      uniform float uIsRigidBag;
      uniform float uEaseOffsetM;
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
          // Strict 1:1 Craniofacial Lock above chin so face never stretches when height/bust morphs!
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
          float zScale = mix(1.0, wScale, 0.82);
          transformed.x *= wScale;
          transformed.z *= zScale;
          if (abs(uEaseOffsetM) > 0.00005 && yn < 0.82 && yn > 0.12) {
            vec2 radialDir = normalize(vec2(transformed.x, transformed.z) + vec2(0.0001));
            transformed.xz += radialDir * uEaseOffsetM;
          }
          // Preserve 1:1 head height ratio while scaling body height below chin
          float chinM = 1.58 * ${lockY};
          if (transformed.y > chinM) {
            transformed.y = chinM * uHeightScale + (transformed.y - chinM);
          } else {
            transformed.y *= uHeightScale;
          }
        }
        `
      );

    shader.fragmentShader =
      `
      uniform float uSubsurfaceWrap;
      uniform vec3 uSubsurfaceColor;
      uniform float uFresnelSheen;
      uniform vec3 uSheenColor;
      uniform float uHeatmapMix;
      uniform vec3 uBustColor;
      uniform vec3 uWaistColor;
      uniform vec3 uHipColor;
      varying float vNormY;
      ` +
      shader.fragmentShader.replace(
        "#include <dithering_fragment>",
        `
        vec3 nView = normalize(vNormal);
        vec3 vDir = normalize(vViewPosition);
        float ndv = clamp(dot(nView, vDir), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 2.6);
        if (uSubsurfaceWrap > 0.01) {
          // Soft dermal warm subsurface scattering in shadow terminators
          float wrapGlow = (1.0 - ndv) * uSubsurfaceWrap * 0.22;
          gl_FragColor.rgb += uSubsurfaceColor * wrapGlow * gl_FragColor.rgb;
        }
        if (uFresnelSheen > 0.01) {
          // Silk / satin / calfskin grazing sheen
          gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb + uSheenColor * 0.24, fresnel * uFresnelSheen);
        }
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
  material.customProgramCacheKey = () => "gwo-master-realism-v6";
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
  productMeta?: {
    product: Product;
    slot: WearableSlotType;
    fabric: FabricPhysicsProfile;
  }
): THREE.Group {
  const clone = proto.clone(true);
  const std = MASTER_AVATAR_ANATOMY_STANDARD;

  clone.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      const isHairMesh = mesh.name.toLowerCase().includes("hair");

      if (productMeta) {
        mesh.userData.productId = productMeta.product.id;
        mesh.userData.product = productMeta.product;
        mesh.userData.slot = productMeta.slot;
        mesh.userData.fabricProfile = productMeta.fabric;
      }

      const origMat = mesh.material;
      const cloneSingle = (m: THREE.Material) => {
        const cm = m.clone() as THREE.MeshStandardMaterial;
        if (cm.isMeshStandardMaterial) {
          if (productMeta) {
            // Preserve metallic gold hardware submeshes (buckles/chains) while calibrating fabric meshes
            const isGoldHardware =
              mesh.name.includes("gold_") || cm.metalness > 0.8;
            if (!isGoldHardware) {
              cm.roughness = productMeta.fabric.roughness;
              cm.metalness = productMeta.fabric.metalness;
              cm.envMapIntensity = productMeta.fabric.envMapIntensity;
            }
            attachBodyMorphShader(cm, uniforms);
          } else if (isHairMesh) {
            const hairUniforms: BodyMorphUniforms = {
              ...uniforms,
              uSubsurfaceWrap: { value: 0.0 },
              uFresnelSheen: { value: std.hairOptics.anisotropicSheen },
              uSheenColor: {
                value: new THREE.Color(std.hairOptics.sheenTintHex),
              },
            };
            cm.roughness = std.hairOptics.roughness;
            cm.metalness = std.hairOptics.metalness;
            attachBodyMorphShader(cm, hairUniforms);
          } else {
            cm.roughness = std.skinOptics.roughness;
            cm.metalness = std.skinOptics.metalness;
            attachBodyMorphShader(cm, uniforms);
          }
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
 * Runtime 3D Volumetric Mesh Builder for ANY newly imported URL or uploaded photo,
 * governed by `resolveGarmentFabricPhysics` from `master-avatar-clothing-realism.ts`.
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

    const G = 56;
    const cv = document.createElement("canvas");
    cv.width = G;
    cv.height = G;
    const ctx = cv.getContext("2d")!;
    ctx.drawImage(img, 0, 0, G, G);
    const imgData = ctx.getImageData(0, 0, G, G).data;

    const anc = classifyWearableSlotAndAnchors(product);
    const fabric = resolveGarmentFabricPhysics(product);
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
        const archZ =
          !standalone && anc.slot !== "bag"
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
        if (
          idxF[k00] >= 0 &&
          idxF[k10] >= 0 &&
          idxF[k11] >= 0 &&
          idxF[k01] >= 0
        ) {
          indices.push(
            idxF[k00],
            idxF[k10],
            idxF[k11],
            idxF[k00],
            idxF[k11],
            idxF[k01]
          );
        }
        if (
          idxB[k00] >= 0 &&
          idxB[k10] >= 0 &&
          idxB[k11] >= 0 &&
          idxB[k01] >= 0
        ) {
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
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const tex = new THREE.TextureLoader().load(cleanUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: fabric.roughness,
      metalness: fabric.metalness,
      envMapIntensity: fabric.envMapIntensity,
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
  const fabric = resolveGarmentFabricPhysics(product);
  const proto = ALL_CERTIFIED_MODULAR_SKU_IDS.has(product.id)
    ? await loadRawGlbPrototype(
        `${BASE}/models/glb/items/${product.id}.glb?v=${GLB_ASSET_VER}`
      )
    : await buildRuntime3DItemPrototype(product, false);

  return cloneGroupWithMorphMaterials(proto, uniforms, {
    product,
    slot,
    fabric,
  });
}

export async function loadStandalone3DItemInstance(
  product: Product
): Promise<THREE.Group> {
  const fabric = resolveGarmentFabricPhysics(product);
  const proto = ALL_CERTIFIED_MODULAR_SKU_IDS.has(product.id)
    ? await loadRawGlbPrototype(
        `${BASE}/models/glb/standalone/${product.id}.glb?v=${GLB_ASSET_VER}`
      )
    : await buildRuntime3DItemPrototype(product, true);

  const clone = proto.clone(true);
  clone.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m?.isMeshStandardMaterial && m.metalness < 0.8) {
        const cm = m.clone();
        cm.roughness = fabric.roughness;
        cm.metalness = fabric.metalness;
        cm.envMapIntensity = fabric.envMapIntensity;
        (obj as THREE.Mesh).material = cm;
      }
    }
  });
  return clone;
}

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

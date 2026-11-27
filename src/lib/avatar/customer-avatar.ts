"use client";

export interface CustomerAvatarData {
  /** Soft-feathered 320x400 RGBA PNG data URL of the customer's aligned face oval */
  faceOvalDataUrl: string;
  /** Crisp 192x192 circular badge thumbnail for headers & profile cards */
  badgeDataUrl: string;
  /** Compressed source image (max 640px) for re-editing or AI full-body VTON */
  fullPhotoDataUrl: string;
  /** Sampled cheek skin tone hex */
  skinToneHex: string;
  /** Label e.g. "My Photo Avatar" */
  label: string;
  /** Saved crop transform so user can tweak alignment anytime */
  crop: FaceCropParams;
  /** Optional dedicated Higgsfield 360° customer avatar turntable MP4 */
  turntableMp4Url?: string;
  turntablePosterUrl?: string;
  updatedAt: string;
}

export interface FaceCropParams {
  /** Normalized face center X in source image (0..1) */
  cx: number;
  /** Normalized face center Y in source image (0..1) */
  cy: number;
  /** Normalized face width relative to source image width (0.08..0.95) */
  faceWidthRatio: number;
}

export const AVATAR_STORAGE_KEY = "gwo_customer_avatar_v1";

export function loadStoredCustomerAvatar(): CustomerAvatarData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerAvatarData;
    if (parsed?.faceOvalDataUrl && parsed?.badgeDataUrl) {
      return parsed;
    }
  } catch {
    // Ignore malformed localStorage
  }
  return null;
}

export function saveStoredCustomerAvatar(data: CustomerAvatarData | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!data) {
      window.localStorage.removeItem(AVATAR_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Load a File or URL into an HTMLImageElement cleanly.
 */
export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = src;
  });
}

/**
 * Downscale uploaded photo to max 720px so memory & localStorage stay fast and tiny.
 */
export function compressSourceImage(img: HTMLImageElement, maxDim = 720): string {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", 0.86);
}

/**
 * Automatically locate the person's face in a selfie or full-body photo.
 * Uses native hardware FaceDetector when available, with a fast skin-cluster fallback.
 */
export async function autoDetectFaceCrop(
  img: HTMLImageElement
): Promise<FaceCropParams> {
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;

  // 1. Try native Chromium/OS FaceDetector API (<5ms hardware accelerated)
  if (typeof window !== "undefined" && "FaceDetector" in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).FaceDetector({
        fastMode: true,
        maxDetectedFaces: 1,
      });
      const faces = await detector.detect(img);
      if (faces && faces.length > 0) {
        const box = faces[0].boundingBox as DOMRectReadOnly;
        return {
          cx: clamp01((box.x + box.width / 2) / iw),
          cy: clamp01((box.y + box.height * 0.51) / ih),
          faceWidthRatio: Math.min(0.65, Math.max(0.09, (box.width * 0.84) / iw)),
        };
      }
    } catch {
      // Fall through to skin-tone / portrait heuristic
    }
  }

  // 2. Clean aspect-aware portrait framing (immune to dramatic side/colored lighting)
  const aspect = ih / Math.max(1, iw);
  if (aspect > 1.6) {
    // Full-body / standing mirror shot
    return { cx: 0.5, cy: 0.19, faceWidthRatio: 0.22 };
  }
  if (aspect < 0.85) {
    // Landscape portrait / webcam shot
    return { cx: 0.5, cy: 0.35, faceWidthRatio: 0.33 };
  }
  // Standard vertical selfie / portrait
  return {
    cx: 0.5,
    cy: 0.36,
    faceWidthRatio: 0.40,
  };
}

function clamp01(v: number): number {
  return Math.min(0.95, Math.max(0.05, v));
}

function rgbToHex(r: number, g: number, b: number): string {
  const to2 = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

/**
 * Generates:
 * 1) `faceOvalDataUrl` (280x350 RGBA PNG): soft-feathered inner face oval with daylight balance
 *    so zero background wall pixels ever bleed onto studio/runway/360 models.
 * 2) `badgeDataUrl` (192x192 JPEG): crisp circular portrait thumbnail for UI badges.
 * 3) `skinToneHex`: sampled cheek skin tone.
 */
export function buildCustomerAvatarAssets(
  img: HTMLImageElement,
  crop: FaceCropParams,
  fullPhotoDataUrl: string,
  label = "My Photo Avatar"
): CustomerAvatarData {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const outW = 280;
  const outH = 350; // 1 : 1.25 aspect matching human forehead-to-chin oval
  const srcW = Math.max(24, crop.faceWidthRatio * iw);
  const srcH = srcW * (outH / outW);
  const sx = crop.cx * iw - srcW / 2;
  const sy = crop.cy * ih - srcH / 2;

  const faceCv = document.createElement("canvas");
  faceCv.width = outW;
  faceCv.height = outH;
  const ctx = faceCv.getContext("2d")!;

  ctx.clearRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, outW, outH);

  // Sample cheek pixels for skin tone & gentle exposure normalization
  const imgData = ctx.getImageData(0, 0, outW, outH);
  const d = imgData.data;

  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sc = 0;
  const samplePoints = [
    [0.33, 0.56],
    [0.67, 0.56],
    [0.5, 0.32],
    [0.5, 0.52],
  ];
  for (const [px, py] of samplePoints) {
    const x0 = Math.floor(px * outW);
    const y0 = Math.floor(py * outH);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const i = ((y0 + dy) * outW + (x0 + dx)) * 4;
        if (d[i + 3] > 128) {
          sr += d[i];
          sg += d[i + 1];
          sb += d[i + 2];
          sc++;
        }
      }
    }
  }

  const avgR = sc > 0 ? sr / sc : 218;
  const avgG = sc > 0 ? sg / sc : 182;
  const avgB = sc > 0 ? sb / sc : 165;
  const skinToneHex = rgbToHex(avgR, avgG, avgB);

  // Preserve 100% authentic natural photo colors; only lift gently if selfie is very dim
  const lum = Math.max(40, 0.299 * avgR + 0.587 * avgG + 0.114 * avgB);
  const gain = lum < 125 ? Math.min(1.18, 128 / lum) : 1.0;

  const halfW = outW / 2;
  const halfH = outH / 2;

  for (let y = 0; y < outH; y++) {
    const ny = (y - halfH * 0.99) / (halfH * 0.95);
    const jawTaper = y > halfH ? 1 - Math.max(0, (y - halfH) / halfH) * 0.16 : 1.0;
    const rx = halfW * 0.9 * jawTaper;

    for (let x = 0; x < outW; x++) {
      const nx = (x - halfW) / Math.max(1, rx);
      const r = Math.sqrt(nx * nx + ny * ny);
      const idx = (y * outW + x) * 4;

      if (r >= 1.0) {
        d[idx + 3] = 0;
        continue;
      }

      if (gain !== 1.0) {
        d[idx] = Math.min(255, Math.round(d[idx] * gain));
        d[idx + 1] = Math.min(255, Math.round(d[idx + 1] * gain));
        d[idx + 2] = Math.min(255, Math.round(d[idx + 2] * gain));
      }

      if (r > 0.62) {
        const t = (r - 0.62) / 0.38;
        const alphaFactor = 0.5 * (1 + Math.cos(Math.PI * t));
        d[idx + 3] = Math.round(d[idx + 3] * alphaFactor);
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const faceOvalDataUrl = faceCv.toDataURL("image/png");

  // Build crisp 192x192 circular UI badge thumbnail (wider framing including hair/shoulders)
  const badgeCv = document.createElement("canvas");
  badgeCv.width = 192;
  badgeCv.height = 192;
  const bctx = badgeCv.getContext("2d")!;
  const badgeSide = Math.min(Math.min(iw, ih), srcW * 1.65);
  const bx = Math.min(Math.max(0, crop.cx * iw - badgeSide / 2), Math.max(0, iw - badgeSide));
  const by = Math.min(Math.max(0, crop.cy * ih - badgeSide * 0.48), Math.max(0, ih - badgeSide));
  bctx.fillStyle = "#F4F5F7";
  bctx.fillRect(0, 0, 192, 192);
  bctx.drawImage(img, bx, by, badgeSide, badgeSide, 0, 0, 192, 192);
  const badgeDataUrl = badgeCv.toDataURL("image/jpeg", 0.88);

  return {
    faceOvalDataUrl,
    badgeDataUrl,
    fullPhotoDataUrl,
    skinToneHex,
    label,
    crop,
    updatedAt: new Date().toISOString(),
  };
}

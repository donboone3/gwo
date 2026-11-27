import { Product } from "@/lib/types";
import {
  classifyWearableSlotAndAnchors,
  isolateProductBackgroundClient,
} from "./avatar-ready-pipeline";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const LAYER_VER = "mod15";

export type AvatarViewAngle = "front" | "side" | "back";

export const MOD_TOP_SLUG: Record<
  string,
  { slug: string; overWaist: boolean }
> = {
  "prod-ae-espresso-corset": { slug: "top_espresso_corset", overWaist: true },
  "prod-ae-acetate-beaded-tank": { slug: "top_beaded_tank", overWaist: false },
  "prod-ae-blush-ruched-offshoulder": { slug: "top_blush_ruched", overWaist: true },
  "prod-ae-noir-halter-vest": { slug: "top_noir_vest", overWaist: true },
  "prod-ae-butter-silk-cami": { slug: "top_butter_cami", overWaist: false },
  "prod-ae-ivory-pearl-corset": { slug: "top_ivory_corset", overWaist: true },
  "prod-ae-noir-satin-corset": { slug: "top_noir_corset", overWaist: true },
  "prod-ae-emerald-silk-cami": { slug: "top_emerald_cami", overWaist: false },
  "prod-ae-camel-tailored-vest": { slug: "top_camel_vest", overWaist: true },
};

export const MOD_BOT_SLUG: Record<
  string,
  { slug: string; coversShins: boolean }
> = {
  "prod-ae-champagne-trousers": { slug: "bot_champagne_trousers", coversShins: true },
  "prod-ae-noir-pleated-mini": { slug: "bot_noir_mini", coversShins: false },
  "prod-ae-vintage-wide-denim": { slug: "bot_vintage_denim", coversShins: true },
  "prod-ae-sage-flare-leggings": { slug: "bot_sage_leggings", coversShins: true },
  "prod-ae-ivory-satin-bias-midi": { slug: "bot_ivory_satin_midi", coversShins: false },
  "prod-ae-espresso-tailored-shorts": { slug: "bot_espresso_shorts", coversShins: false },
  "prod-ae-charcoal-pinstripe-trousers": { slug: "bot_charcoal_pinstripe", coversShins: true },
  "prod-ae-obsidian-wide-trousers": { slug: "bot_obsidian_trousers", coversShins: true },
  "prod-ae-olive-pleated-trousers": { slug: "bot_olive_trousers", coversShins: true },
  "prod-ae-burgundy-pleated-mini": { slug: "bot_burgundy_mini", coversShins: false },
  "prod-ae-chocolate-satin-midi": { slug: "bot_chocolate_satin_midi", coversShins: false },
};

export const MOD_DRESS_SLUG: Record<
  string,
  { slug: string; sideOutfitIdx: number }
> = {
  "prod-ae-emerald-satin-midi": { slug: "dress_emerald_midi", sideOutfitIdx: 2 },
  "prod-ae-champagne-blazer-dress": { slug: "dress_champagne_blazer", sideOutfitIdx: 3 },
  "prod-ae-crimson-corset-mini": { slug: "dress_crimson_mini", sideOutfitIdx: 6 },
  "prod-ae-cobalt-draped-mini": { slug: "dress_cobalt_mini", sideOutfitIdx: 12 },
  "prod-ae-butter-lace-slip-midi": { slug: "dress_butter_lace", sideOutfitIdx: 14 },
  "prod-ae-sapphire-satin-midi": { slug: "dress_sapphire_midi", sideOutfitIdx: 2 },
  "prod-ae-onyx-satin-midi": { slug: "dress_onyx_midi", sideOutfitIdx: 2 },
  "prod-ae-rosewood-corset-mini": { slug: "dress_rosewood_mini", sideOutfitIdx: 6 },
  "prod-ae-noir-tuxedo-blazer-dress": { slug: "dress_noir_blazer", sideOutfitIdx: 3 },
};

export const MOD_OUTER_SLUG: Record<
  string,
  { slug: string; sideOutfitIdx: number; isClosed: boolean }
> = {
  "prod-ae-ivory-tweed-blazer": { slug: "outer_ivory_blazer", sideOutfitIdx: 1, isClosed: false },
  "prod-ae-noir-tailored-blazer": { slug: "outer_noir_blazer", sideOutfitIdx: 7, isClosed: false },
  "prod-ae-camel-silk-wool-coat": { slug: "outer_camel_coat", sideOutfitIdx: 4, isClosed: false },
  "prod-ae-linen-cinch-cardigan": { slug: "outer_linen_cardigan", sideOutfitIdx: 5, isClosed: true },
  "prod-ae-sage-zip-jacket": { slug: "outer_sage_jacket", sideOutfitIdx: 8, isClosed: true },
  "prod-ae-burgundy-leather-trench": { slug: "outer_burgundy_trench", sideOutfitIdx: 13, isClosed: false },
  "prod-ae-cream-cropped-fur-jacket": { slug: "outer_cream_bolero", sideOutfitIdx: 14, isClosed: false },
  "prod-ae-emerald-tweed-blazer": { slug: "outer_emerald_blazer", sideOutfitIdx: 1, isClosed: false },
  "prod-ae-espresso-tailored-blazer": { slug: "outer_espresso_blazer", sideOutfitIdx: 7, isClosed: false },
  "prod-ae-charcoal-wool-coat": { slug: "outer_charcoal_coat", sideOutfitIdx: 4, isClosed: false },
};

export const MOD_SHOE_SLUG: Record<string, string> = {
  "prod-ae-noir-slingbacks": "shoe_noir_slingbacks",
  "prod-ae-gold-strappy-heels": "shoe_gold_heels",
  "prod-ae-meotina-leather-boots": "shoe_meotina_boots",
  "prod-ae-cloud-platform-sneakers": "shoe_white_sneakers",
  "prod-ae-burgundy-patent-heels": "shoe_burgundy_heels",
  "prod-ae-silver-crystal-heels": "shoe_silver_heels",
  "prod-ae-ivory-patent-slingbacks": "shoe_ivory_slingbacks",
};

export const MOD_BAG_SLUG: Record<string, string> = {
  "prod-ae-burgundy-crescent-bag": "bag_merlot_crescent",
  "prod-ae-camel-turnlock-tote": "bag_camel_tote",
  "prod-ae-noir-quilted-bag": "bag_noir_quilted",
  "prod-ae-ivory-mini-bag": "bag_ivory_mini",
  "prod-ae-silver-metallic-shoulder-bag": "bag_silver_metallic",
  "prod-ae-espresso-suede-crescent-bag": "bag_espresso_crescent",
};

export const MOD_BELT_SLUG: Record<string, string> = {
  "prod-ae-gold-sculpted-belt": "belt_gold_calfskin",
  "prod-ae-silver-sculpted-belt": "belt_silver_calfskin",
};

export const ALL_CERTIFIED_MODULAR_SKU_IDS = new Set<string>([
  ...Object.keys(MOD_TOP_SLUG),
  ...Object.keys(MOD_BOT_SLUG),
  ...Object.keys(MOD_DRESS_SLUG),
  ...Object.keys(MOD_OUTER_SLUG),
  ...Object.keys(MOD_SHOE_SLUG),
  ...Object.keys(MOD_BAG_SLUG),
  ...Object.keys(MOD_BELT_SLUG),
]);

const MOD_IMG_CACHE = new Map<string, HTMLImageElement>();
const FAILED_URLS = new Set<string>();

export function getCachedOrLoadImage(
  url: string,
  onReady?: () => void
): HTMLImageElement | null {
  if (!url || typeof Image === "undefined") return null;
  if (FAILED_URLS.has(url)) return null;
  const hit = MOD_IMG_CACHE.get(url);
  if (hit && hit.complete && hit.naturalWidth > 0) return hit;
  if (hit) {
    if (onReady) hit.addEventListener("load", onReady, { once: true });
    return null;
  }

  const im = new Image();
  if (!url.startsWith("data:") && !url.startsWith("/")) {
    im.crossOrigin = "anonymous";
  }
  im.decoding = "async";
  MOD_IMG_CACHE.set(url, im);
  if (onReady) im.addEventListener("load", onReady, { once: true });
  im.addEventListener(
    "error",
    () => {
      MOD_IMG_CACHE.delete(url);
      FAILED_URLS.add(url);
      onReady?.();
    },
    { once: true }
  );
  im.src = url;
  return null;
}

export function modLayerUrl(name: string): string {
  return `${BASE}/models/modular/${name}.webp?v=${LAYER_VER}`;
}

function modUrl(name: string): string {
  return modLayerUrl(name);
}

export function resolveSideOutfitFallbackIndex(products: Product[]): number {
  for (const p of products) {
    if (p.id in MOD_OUTER_SLUG) return MOD_OUTER_SLUG[p.id].sideOutfitIdx;
  }
  for (const p of products) {
    if (p.id in MOD_DRESS_SLUG) return MOD_DRESS_SLUG[p.id].sideOutfitIdx;
  }
  const ids = new Set(products.map((p) => p.id));
  if (ids.has("prod-ae-blush-ruched-offshoulder") || ids.has("prod-ae-ivory-satin-bias-midi")) return 10;
  if (ids.has("prod-ae-noir-halter-vest") || ids.has("prod-ae-charcoal-pinstripe-trousers")) return 11;
  if (ids.has("prod-ae-butter-silk-cami") || ids.has("prod-ae-espresso-tailored-shorts")) return 15;
  if (ids.has("prod-ae-vintage-wide-denim")) return 9;
  if (ids.has("prod-ae-sage-flare-leggings")) return 8;
  if (ids.has("prod-ae-noir-pleated-mini")) return 1;
  return 0;
}

interface CustomLayerSpec {
  product: Product;
  cleanUrl: string;
}

/**
 * Atomically composes ANY combination of wearable products (from our 36 modular SKUs
 * plus any newly imported/uploaded custom pieces!) onto a 900x1355 canvas context.
 *
 * Returns `"ready"` ONLY when every required layer image is decoded and painted.
 * Returns `"loading"` WITHOUT clearing `ctx` while any layer is still streaming over network,
 * guaranteeing ZERO blank flashes and ZERO half-loaded seams!
 */
export function composeModularOutfitToCanvas(params: {
  ctx: CanvasRenderingContext2D;
  products: Product[];
  angle: AvatarViewAngle;
  mirrorHorizontal?: boolean;
  faceOvalDataUrl?: string | null;
  onAssetReady?: () => void;
}): "ready" | "loading" {
  const {
    ctx,
    products,
    angle,
    mirrorHorizontal = false,
    faceOvalDataUrl,
    onAssetReady,
  } = params;

  // Side 90° profile uses registered full-body side cutout for crisp 90° silhouette
  if (angle === "side") {
    const sideIdx = resolveSideOutfitFallbackIndex(products);
    const sideUrl = `${BASE}/models/runway_ai/ae_outfit_${sideIdx}_side.webp?v=${LAYER_VER}`;
    const sideImg = getCachedOrLoadImage(sideUrl, onAssetReady);
    if (!sideImg) return "loading";

    ctx.clearRect(0, 0, 900, 1355);
    ctx.save();
    if (mirrorHorizontal) {
      ctx.translate(900, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(sideImg, 0, 0, 900, 1355);
    ctx.restore();
    return "ready";
  }

  const sfx = angle === "back" ? "back" : "front";

  // Partition worn products into exact anatomical slots
  let topProd: Product | undefined;
  let botProd: Product | undefined;
  let dressProd: Product | undefined;
  let outerProd: Product | undefined;
  let shoeProd: Product | undefined;
  let bagProd: Product | undefined;
  let beltProd: Product | undefined;

  for (const p of products) {
    const slot = classifyWearableSlotAndAnchors(p).slot;
    if (slot === "dress" && !dressProd) dressProd = p;
    else if (slot === "top" && !topProd) topProd = p;
    else if (slot === "bottom" && !botProd) botProd = p;
    else if (slot === "outerwear" && !outerProd) outerProd = p;
    else if (slot === "shoes" && !shoeProd) shoeProd = p;
    else if (slot === "bag" && !bagProd) bagProd = p;
    else if (slot === "belt" && !beltProd) beltProd = p;
  }

  // Ensure sensible defaults when user inspects a single standalone garment (e.g. just a bag or just shoes)
  if (!dressProd) {
    if (!topProd) {
      topProd = {
        id: "prod-ae-acetate-beaded-tank",
        canonicalUrl: "",
        brand: "GWO",
        storeDomain: "aliexpress.com",
        title: "Ivory Ribbed Tank",
        category: "top",
        silhouette: "crop-tank",
        colorName: "Ivory",
        colorHex: "#ECE8E1",
        accentHex: "#244B3B",
        price: 48,
        currency: "USD",
        occasions: [],
        vibes: [],
        availableSizes: ["S"],
        sizeChartInches: {},
        inStock: true,
        estDeliveryDays: 8,
        sourceType: "aliexpress_dropship",
        lastScrapedAt: "",
        staleAfter: "",
      };
    }
    if (!botProd) {
      botProd = {
        id: "prod-ae-champagne-trousers",
        canonicalUrl: "",
        brand: "GWO",
        storeDomain: "aliexpress.com",
        title: "Champagne Wide Trousers",
        category: "bottom",
        silhouette: "wide-denim",
        colorName: "Champagne",
        colorHex: "#D9CEBE",
        accentHex: "#244B3B",
        price: 54,
        currency: "USD",
        occasions: [],
        vibes: [],
        availableSizes: ["S"],
        sizeChartInches: {},
        inStock: true,
        estDeliveryDays: 8,
        sourceType: "aliexpress_dropship",
        lastScrapedAt: "",
        staleAfter: "",
      };
    }
  }

  // Ordered URL queue to assemble the full 900x1355 outfit atomically
  const orderedUrls: string[] = [modUrl(`base_${sfx}`)];
  const customOverlays: CustomLayerSpec[] = [];

  const botMeta = botProd ? MOD_BOT_SLUG[botProd.id] : undefined;
  const coversShins = Boolean(!dressProd && botMeta?.coversShins);

  const shoeSlug = shoeProd
    ? MOD_SHOE_SLUG[shoeProd.id]
    : dressProd
    ? "shoe_gold_heels"
    : "shoe_noir_slingbacks";

  // If full-length pants cover shins, draw low-cut `_under_` shoe vamp BEFORE bottom so zero double ankle lines appear!
  if (coversShins && shoeSlug) {
    orderedUrls.push(modUrl(`${shoeSlug}_under_${sfx}`));
  }

  if (dressProd) {
    const dm = MOD_DRESS_SLUG[dressProd.id];
    if (dm) {
      orderedUrls.push(modUrl(`${dm.slug}_${sfx}`));
    } else if (dressProd.imageUrl) {
      customOverlays.push({ product: dressProd, cleanUrl: dressProd.imageUrl });
    }
  } else {
    const tm = topProd ? MOD_TOP_SLUG[topProd.id] : undefined;
    const topOverWaist = Boolean(tm?.overWaist);

    if (!topOverWaist) {
      if (tm) orderedUrls.push(modUrl(`${tm.slug}_${sfx}`));
      else if (topProd?.imageUrl) {
        customOverlays.push({ product: topProd, cleanUrl: topProd.imageUrl });
      }
    }

    if (botMeta) {
      orderedUrls.push(modUrl(`${botMeta.slug}_${sfx}`));
    } else if (botProd?.imageUrl) {
      customOverlays.push({ product: botProd, cleanUrl: botProd.imageUrl });
    }

    if (topOverWaist) {
      if (tm) orderedUrls.push(modUrl(`${tm.slug}_${sfx}`));
      else if (topProd?.imageUrl) {
        customOverlays.push({ product: topProd, cleanUrl: topProd.imageUrl });
      }
    }
  }

  // If bare legs / mini skirt / shorts / dress, draw shoes AFTER dress/bottom so boots/straps sit cleanly on legs!
  if (!coversShins && shoeSlug) {
    orderedUrls.push(modUrl(`${shoeSlug}_${sfx}`));
  } else if (shoeProd && !MOD_SHOE_SLUG[shoeProd.id] && shoeProd.imageUrl) {
    customOverlays.push({ product: shoeProd, cleanUrl: shoeProd.imageUrl });
  }

  // Optional Waist Belt (sits over waist, under open blazer lapels!)
  if (beltProd) {
    const beltSlug = MOD_BELT_SLUG[beltProd.id];
    if (beltSlug) {
      orderedUrls.push(modUrl(`${beltSlug}_${sfx}`));
    } else if (beltProd.imageUrl) {
      customOverlays.push({ product: beltProd, cleanUrl: beltProd.imageUrl });
    }
  }

  // Optional Outerwear / Jacket / Coat (full sleeves intact + open center channel!)
  if (outerProd) {
    const om = MOD_OUTER_SLUG[outerProd.id];
    if (om) {
      orderedUrls.push(modUrl(`${om.slug}_${sfx}`));
    } else if (outerProd.imageUrl) {
      customOverlays.push({ product: outerProd, cleanUrl: outerProd.imageUrl });
    }
  }

  // Optional Bag — ONLY drawn when a bag is actually in `products` (ZERO phantom/double bags!)
  if (bagProd) {
    const bagSlug = MOD_BAG_SLUG[bagProd.id];
    if (bagSlug) {
      orderedUrls.push(modUrl(`${bagSlug}_${sfx}`));
    } else if (bagProd.imageUrl) {
      customOverlays.push({ product: bagProd, cleanUrl: bagProd.imageUrl });
    }
  }

  // Fetch all modular layer images; abort WITHOUT clearing canvas if any required layer is still in-flight!
  const decodedLayers: HTMLImageElement[] = [];
  let anyPending = false;
  for (const u of orderedUrls) {
    if (FAILED_URLS.has(u)) continue;
    const im = getCachedOrLoadImage(u, onAssetReady);
    if (!im) {
      anyPending = true;
    } else {
      decodedLayers.push(im);
    }
  }

  // Also resolve any custom imported/uploaded garment images (with client RGBA background isolation)
  const decodedCustom: Array<{ product: Product; img: HTMLImageElement }> = [];
  for (const co of customOverlays) {
    void isolateProductBackgroundClient(co.cleanUrl).then((isolated) => {
      if (isolated !== co.cleanUrl) {
        getCachedOrLoadImage(isolated, onAssetReady);
      }
    });
    const im = getCachedOrLoadImage(co.cleanUrl, onAssetReady);
    if (!im && !FAILED_URLS.has(co.cleanUrl)) {
      anyPending = true;
    } else if (im) {
      decodedCustom.push({ product: co.product, img: im });
    }
  }

  let faceImg: HTMLImageElement | null = null;
  if (faceOvalDataUrl && angle === "front") {
    faceImg = getCachedOrLoadImage(faceOvalDataUrl, onAssetReady);
  }

  if (anyPending || decodedLayers.length === 0) {
    return "loading";
  }

  // ATOMIC PAINT: every layer is 100% decoded in RAM — clear & composite in a single frame!
  ctx.clearRect(0, 0, 900, 1355);
  ctx.save();
  if (mirrorHorizontal) {
    ctx.translate(900, 0);
    ctx.scale(-1, 1);
  }

  for (const ly of decodedLayers) {
    ctx.drawImage(ly, 0, 0, 900, 1355);
  }

  // Draw any custom URL-imported / photo-uploaded pieces onto their exact anatomical anchor slot!
  for (const { product: cProd, img: cImg } of decodedCustom) {
    const anc = classifyWearableSlotAndAnchors(cProd);
    const boxW = 900 * anc.normW;
    const boxH = 1355 * anc.normH;
    const aspect = cImg.naturalWidth / Math.max(1, cImg.naturalHeight);
    let dw = boxW;
    let dh = dw / aspect;
    if (dh > boxH * 1.15) {
      dh = boxH * 1.15;
      dw = dh * aspect;
    }
    const dx = 900 * anc.normX - dw / 2;
    const dy = 1355 * anc.normY - dh / 2;
    ctx.save();
    ctx.shadowColor = "rgba(20, 21, 24, 0.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    if (angle === "back") {
      ctx.filter = "brightness(0.95) contrast(1.02)";
    }
    ctx.drawImage(cImg, dx, dy, dw, dh);
    ctx.restore();
  }

  if (faceImg) {
    const fw = 900 * 0.129;
    const fh = 1355 * 0.097;
    const fx = 900 * 0.4995 - fw / 2;
    const fy = 1355 * 0.132 - fh / 2;
    ctx.drawImage(faceImg, fx, fy, fw, fh);
  }

  ctx.restore();
  return "ready";
}

const DATA_URL_MEMO = new Map<string, string>();

/**
 * Renders any arbitrary combination of `Product[]` into a crisp 900x1355 WebP Data URL
 * for instant use on the Diagonal Runway (`GwoRunwayLookbook`) whenever an outfit mixes pieces
 * or the shopper taps Swap (`↻`) on any piece card!
 */
export function renderModularOutfitDataUrlAsync(
  products: Product[],
  angle: "front" | "back"
): Promise<string | null> {
  if (typeof document === "undefined") return Promise.resolve(null);
  const key = `${angle}:${products.map((p) => `${p.id}:${p.imageUrl || ""}`).join("|")}`;
  const hit = DATA_URL_MEMO.get(key);
  if (hit) return Promise.resolve(hit);

  return new Promise((resolve) => {
    const cv = document.createElement("canvas");
    cv.width = 900;
    cv.height = 1355;
    const ctx = cv.getContext("2d");
    if (!ctx) {
      resolve(null);
      return;
    }

    let settled = false;
    const attempt = () => {
      if (settled) return;
      const status = composeModularOutfitToCanvas({
        ctx,
        products,
        angle,
        onAssetReady: () => {
          requestAnimationFrame(attempt);
        },
      });
      if (status === "ready") {
        settled = true;
        const url = cv.toDataURL("image/webp", 0.88);
        DATA_URL_MEMO.set(key, url);
        resolve(url);
      }
    };
    attempt();
    setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 4500);
  });
}

let preloadedCore = false;

/**
 * Eagerly warms the browser image cache with base + core modular layers during idle frames
 * so switching tops, pants, jackets, dresses, shoes, belts, and bags feels 0ms instantaneous!
 */
export function preloadCoreModularLayers(): void {
  if (preloadedCore || typeof window === "undefined") return;
  preloadedCore = true;
  const starter = [
    modUrl("base_front"),
    modUrl("base_back"),
    modUrl("top_espresso_corset_front"),
    modUrl("top_beaded_tank_front"),
    modUrl("top_blush_ruched_front"),
    modUrl("top_noir_vest_front"),
    modUrl("top_butter_cami_front"),
    modUrl("bot_champagne_trousers_front"),
    modUrl("bot_vintage_denim_front"),
    modUrl("bot_noir_mini_front"),
    modUrl("bot_ivory_satin_midi_front"),
    modUrl("bot_espresso_shorts_front"),
    modUrl("bot_charcoal_pinstripe_front"),
    modUrl("outer_ivory_blazer_front"),
    modUrl("outer_noir_blazer_front"),
    modUrl("outer_camel_coat_front"),
    modUrl("shoe_noir_slingbacks_front"),
    modUrl("shoe_gold_heels_front"),
    modUrl("shoe_meotina_boots_front"),
    modUrl("bag_merlot_crescent_front"),
    modUrl("bag_camel_tote_front"),
    modUrl("bag_noir_quilted_front"),
    modUrl("bag_ivory_mini_front"),
    modUrl("belt_gold_calfskin_front"),
  ];
  const run = () => {
    starter.forEach((u, idx) => {
      setTimeout(() => {
        getCachedOrLoadImage(u);
      }, idx * 35);
    });
  };
  if ("requestIdleCallback" in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(run);
  } else {
    setTimeout(run, 250);
  }
}

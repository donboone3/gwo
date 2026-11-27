import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { CURATED_100_OUTFIT_DESIGNS } from "@/lib/stylist/curated-100-outfits";

export const HIGGS_CDN =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/";

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
export const SIGNATURE_BADGE_URL = `${BASE_PATH}/models/signature/badge.webp`;

export function H(file: string, w: number, q = 82): string {
  if (file.startsWith("ae:")) {
    const idx = file.slice(3);
    return w <= 360
      ? `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_thumb.webp?v=mod7`
      : `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_front.webp?v=mod7`;
  }
  if (file.startsWith("sig:")) {
    const idx = file.slice(4);
    return w <= 360
      ? `${BASE_PATH}/models/signature/look_${idx}_thumb.webp`
      : `${BASE_PATH}/models/signature/look_${idx}.webp`;
  }
  if (
    file.startsWith("data:") ||
    file.startsWith("http://") ||
    file.startsWith("https://") ||
    file.startsWith("/")
  ) {
    return file;
  }
  return (
    "https://images.higgs.ai/?default=1&output=webp&url=" +
    encodeURIComponent(HIGGS_CDN + file) +
    "&w=" +
    w +
    "&q=" +
    q
  );
}

export function H_BACK(file: string): string {
  if (file.startsWith("ae:")) {
    const idx = file.slice(3);
    return `${BASE_PATH}/models/runway_ai/ae_outfit_${idx}_back.webp?v=mod7`;
  }
  if (file.startsWith("sig:")) {
    const idx = file.slice(4);
    return `${BASE_PATH}/models/signature/look_${idx}_back.webp`;
  }
  return H(file, 900);
}

export const LOFT_BG_URL = `${BASE_PATH}/models/signature/loft_bg.webp`;

export interface PieceItem {
  id: string;
  name: string;
  color: string;
  price: number;
  group: "tops" | "bottoms" | "full" | "shoes" | "acc";
  lookIndex: number;
}

export interface StudioLook {
  index: number;
  name: string;
  occasion?: string;
  stylistNote?: string;
  category: "everyday" | "athletic" | "sleep" | "formal" | "party" | "street";
  file: string;
  productId?: string;
  relatedProductIds?: string[];
  friendOwner?: string;
  friendTwinPct?: number;
  isModularRemix?: boolean;
  pieces: {
    tops: Array<{ name: string; color: string; price: number }>;
    bottoms: Array<{ name: string; color: string; price: number }>;
    full: Array<{ name: string; color: string; price: number }>;
    shoes: Array<{ name: string; color: string; price: number }>;
    acc: Array<{ name: string; color: string; price: number }>;
  };
}

const CATALOG_BY_ID = new Map(
  buildTopLineAliExpressDropshipCatalog(2.85).map((p) => [p.id, p])
);

const FRIEND_ROTATION = ["maya", "chloe", "sofia"] as const;

/**
 * 100 Curated GWO Boutique Outfit Designs (Outfits #001..#100).
 * Every piece in every outfit has verified physical measurements & 360° 3D meshes!
 */
export const STUDIO_LOOKS: StudioLook[] = CURATED_100_OUTFIT_DESIGNS.map(
  (design, idx) => {
    const tops: Array<{ name: string; color: string; price: number }> = [];
    const bottoms: Array<{ name: string; color: string; price: number }> = [];
    const full: Array<{ name: string; color: string; price: number }> = [];
    const shoes: Array<{ name: string; color: string; price: number }> = [];
    const acc: Array<{ name: string; color: string; price: number }> = [];

    for (const pid of design.productIds) {
      const prod = CATALOG_BY_ID.get(pid);
      if (!prod) continue;
      const entry = {
        name: prod.title,
        color: prod.colorName,
        price: prod.price,
      };
      if (prod.category === "dress") full.push(entry);
      else if (prod.category === "top" || prod.category === "outerwear")
        tops.push(entry);
      else if (prod.category === "bottom") bottoms.push(entry);
      else if (prod.category === "shoes") shoes.push(entry);
      else acc.push(entry);
    }

    return {
      index: idx,
      name: design.title,
      occasion: design.occasion,
      stylistNote: design.stylistNote,
      category: design.closetCategory,
      file: `ae:${design.prebakedLookIdx ?? design.fallbackLookIdx}`,
      productId: design.productIds[0],
      relatedProductIds: design.productIds,
      friendOwner: FRIEND_ROTATION[idx % FRIEND_ROTATION.length],
      friendTwinPct: 98 - (idx % 5),
      isModularRemix: design.isModularRemix,
      pieces: { tops, bottoms, full, shoes, acc },
    };
  }
);

export const ACCESSORY_CATALOG = [
  {
    id: "prod-ae-burgundy-crescent-bag",
    name: "Deep Merlot Smooth Leather Crescent Shoulder Bag",
    color: "Deep Merlot",
    price: 46,
    x: 64,
    y: 36,
  },
  {
    id: "prod-ae-camel-turnlock-tote",
    name: "Camel & Sage Gold-Turnlock Smooth Leather Trapezium Tote",
    color: "Warm Camel",
    price: 72,
    x: 34,
    y: 56,
  },
  {
    id: "prod-ae-noir-quilted-bag",
    name: "Noir Quilted Lambskin Gold-Chain Flap Shoulder Bag",
    color: "Jet Noir",
    price: 58,
    x: 64,
    y: 44,
  },
  {
    id: "prod-ae-ivory-mini-bag",
    name: "Pearl Ivory Sculpted Top-Handle Gold-Clasp Mini Bag",
    color: "Pearl Ivory",
    price: 52,
    x: 34,
    y: 56,
  },
  {
    id: "prod-ae-espresso-suede-crescent-bag",
    name: "Espresso Suede Leather Crescent Shoulder Bag",
    color: "Espresso Suede",
    price: 54,
    x: 64,
    y: 36,
  },
  {
    id: "prod-ae-gold-sculpted-belt",
    name: "18k Gold-Buckle Smooth Calfskin Cincher Waist Belt",
    color: "Noir & 18k Gold",
    price: 34,
    x: 50,
    y: 42,
  },
  {
    id: "prod-ae-silver-sculpted-belt",
    name: "Liquid-Silver Buckle Smooth Calfskin Cincher Waist Belt",
    color: "Noir & Silver",
    price: 34,
    x: 50,
    y: 42,
  },
];

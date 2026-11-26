import {
  GarmentCategory,
  GarmentSilhouette,
  Product,
} from "../types";
import { StudioLook } from "@/components/vell/vell-data";

const COLOR_NAME_TO_HEX: Record<string, string> = {
  charcoal: "#2F3238",
  "light wash": "#86A8C9",
  black: "#1A1B1E",
  "14k": "#D4AF37",
  "14k gold": "#D4AF37",
  oat: "#DFD5C5",
  white: "#F5F6F8",
  cream: "#F2ECE1",
  "heather grey": "#8E939C",
  brown: "#5C3D2E",
  lilac: "#B79CED",
  "powder blue": "#A8C6DF",
  ivory: "#F6F2EA",
  sage: "#9AB09C",
  silver: "#C9CED6",
  khaki: "#B6A68E",
  "crimson red": "#C80815",
  espresso: "#3C2822",
  gold: "#D4AF37",
  burgundy: "#5C1624",
};

function resolveColorHex(colorName: string, titleFallback = ""): string {
  const key = colorName.trim().toLowerCase();
  if (COLOR_NAME_TO_HEX[key]) return COLOR_NAME_TO_HEX[key];
  const combined = `${key} ${titleFallback.toLowerCase()}`;
  if (/red|crimson|scarlet/.test(combined)) return "#C80815";
  if (/lilac|lavender|violet/.test(combined)) return "#B79CED";
  if (/sage|emerald|olive|green/.test(combined)) return "#5E8C6A";
  if (/blue|denim|wash/.test(combined)) return "#7C9EC0";
  if (/pink|blush|rose/.test(combined)) return "#E4B7BE";
  if (/oat|champagne|beige|cream|ivory|stone/.test(combined)) return "#EAE2D3";
  if (/brown|espresso|cacao/.test(combined)) return "#463029";
  if (/silver|metallic|grey|gray/.test(combined)) return "#B8BEC7";
  if (/gold/.test(combined)) return "#D4AF37";
  return "#222428";
}

export function inferCategoryAndSilhouetteFromName(
  name: string,
  hintGroup?: "tops" | "bottoms" | "full" | "shoes" | "acc"
): { category: GarmentCategory; silhouette: GarmentSilhouette } {
  const low = name.toLowerCase();
  if (hintGroup === "shoes" || /boot|heel|sneaker|loafer|sandal|slipper|flat/.test(low)) {
    return {
      category: "shoes",
      silhouette: /sneaker|runner/.test(low) ? "sneakers" : "ballet-flats",
    };
  }
  if (hintGroup === "acc" || /bag|belt|hoop|necklace|tote|clutch|crescent/.test(low)) {
    return {
      category: "accessory",
      silhouette: "shoulder-bag",
    };
  }
  if (hintGroup === "full" || /dress|gown|romper|jumpsuit/.test(low)) {
    return {
      category: "dress",
      silhouette: /maxi|midi|slip|trench/.test(low) ? "slip-dress" : "mini-dress",
    };
  }
  if (/blazer|jacket|coat|puffer|bomber|cardigan|hoodie|sweatshirt/.test(low)) {
    return {
      category: "outerwear",
      silhouette: /hoodie|sweatshirt/.test(low)
        ? "oversized-hoodie"
        : /cardigan/.test(low)
        ? "cardigan"
        : "cropped-jacket",
    };
  }
  if (
    hintGroup === "bottoms" ||
    /skirt|pant|trouser|jean|denim|legging|cargo|sweatpant|short/.test(low)
  ) {
    if (/skirt/.test(low)) {
      return {
        category: "bottom",
        silhouette: /maxi|midi/.test(low) ? "wide-denim" : "mini-skirt",
      };
    }
    if (/legging/.test(low)) {
      return { category: "bottom", silhouette: "leggings" };
    }
    if (/cargo/.test(low)) {
      return { category: "bottom", silhouette: "cargo-pants" };
    }
    return { category: "bottom", silhouette: "wide-denim" };
  }
  return {
    category: "top",
    silhouette: /bra/.test(low)
      ? "sports-bra"
      : /crop|tank|camisole/.test(low)
      ? "crop-tank"
      : "baby-tee",
  };
}

/**
 * Synthesizes a 3D-ready GWO Product for any Closet piece, Runway piece, or Bag item
 * that doesn't already point to a full catalog Product ID.
 */
export function buildSynthetic3DProductFromPiece(params: {
  id: string;
  name: string;
  brand?: string;
  colorName?: string;
  price: number;
  imageUrl?: string;
  storeUrl?: string;
  hintGroup?: "tops" | "bottoms" | "full" | "shoes" | "acc";
}): Product {
  const { category, silhouette } = inferCategoryAndSilhouetteFromName(
    params.name,
    params.hintGroup
  );
  const colorName = params.colorName || "Studio Tone";
  const colorHex = resolveColorHex(colorName, params.name);
  const low = params.name.toLowerCase();
  const isMaxiOrMidi = /maxi|midi|slip/.test(low);
  const hasCorset = /corset|cornelia|lace-up/.test(low);

  return {
    id: params.id,
    canonicalUrl: params.storeUrl || "https://goodwithonline.com/closet",
    brand: params.brand || "GWO Closet",
    storeDomain: "goodwithonline.com",
    title: params.name,
    category,
    silhouette,
    colorName,
    colorHex,
    accentHex: "#141518",
    price: params.price,
    currency: "USD",
    imageUrl: params.imageUrl,
    fitMetadata: {
      descriptionSummary: `${params.name} (${colorName}) tailored for 360° Front & Back Avatar preview.`,
      fitNotes: [
        "Calibrated to your 5'2\" • 32.25\" B • 27\" W • 34\" H Avatar",
        "Full 360° Front (0°), Side (90°), and Back (180°) silhouette inspection",
      ],
      stretchLevel: /legging|knit|rib|jersey|sweat/.test(low) ? "high" : "medium",
      cutType: /oversized|wide|cargo|bomber|sweat/.test(low) ? "oversized" : "fitted",
      storeFitTendency: "true_to_size",
      hemLanding: isMaxiOrMidi
        ? /maxi/.test(low)
          ? "maxi"
          : "midi"
        : /crop/.test(low)
        ? "cropped"
        : undefined,
      hasAdjustableBack: hasCorset,
    },
    occasions: ["Everyday", "Going Out"],
    vibes: ["Model Off-Duty"],
    availableSizes: ["XS", "S", "M", "L"],
    sizeChartInches: {},
    estDeliveryDays: 3,
    inStock: true,
    sourceType: "affiliate_feed",
    lastScrapedAt: "",
    staleAfter: "",
  };
}

/**
 * Converts ANY Closet StudioLook (Looks 0..8) into a complete multi-piece 3D outfit
 * `(primaryProduct, companionProducts)` so the customer can view Front, Back, and 360°
 * of every Closet outfit right on their Avatar!
 */
export function build3DOutfitForClosetLook(
  look: StudioLook,
  catalogProducts: Product[]
): { primaryProduct: Product; companionProducts: Product[] } {
  if (look.productId) {
    const matched = catalogProducts.find((p) => p.id === look.productId);
    if (matched) {
      const companions: Product[] = look.pieces.shoes.map((sh, i) =>
        buildSynthetic3DProductFromPiece({
          id: `closet-${look.index}-shoe-${i}`,
          name: sh.name,
          colorName: sh.color,
          price: sh.price,
          brand: look.friendOwner ? `@${look.friendOwner}'s Closet` : "GWO Closet",
          hintGroup: "shoes",
        })
      );
      return { primaryProduct: matched, companionProducts: companions };
    }
  }

  const built: Product[] = [];
  const ownerBrand = look.friendOwner
    ? `@${look.friendOwner}'s Closet`
    : "GWO Closet";

  look.pieces.full.forEach((p, i) => {
    built.push(
      buildSynthetic3DProductFromPiece({
        id: `closet-${look.index}-full-${i}`,
        name: p.name,
        colorName: p.color,
        price: p.price,
        brand: ownerBrand,
        hintGroup: "full",
      })
    );
  });

  // Note: in multi-top looks like "Oversized blazer + Silk camisole", first top is often outerwear
  look.pieces.tops.forEach((p, i) => {
    built.push(
      buildSynthetic3DProductFromPiece({
        id: `closet-${look.index}-top-${i}`,
        name: p.name,
        colorName: p.color,
        price: p.price,
        brand: ownerBrand,
        hintGroup: "tops",
      })
    );
  });

  look.pieces.bottoms.forEach((p, i) => {
    built.push(
      buildSynthetic3DProductFromPiece({
        id: `closet-${look.index}-bottom-${i}`,
        name: p.name,
        colorName: p.color,
        price: p.price,
        brand: ownerBrand,
        hintGroup: "bottoms",
      })
    );
  });

  look.pieces.shoes.forEach((p, i) => {
    built.push(
      buildSynthetic3DProductFromPiece({
        id: `closet-${look.index}-shoe-${i}`,
        name: p.name,
        colorName: p.color,
        price: p.price,
        brand: ownerBrand,
        hintGroup: "shoes",
      })
    );
  });

  const bagPiece = look.pieces.acc.find((a) => /bag|tote|clutch/i.test(a.name));
  if (bagPiece) {
    built.push(
      buildSynthetic3DProductFromPiece({
        id: `closet-${look.index}-acc-bag`,
        name: bagPiece.name,
        colorName: bagPiece.color,
        price: bagPiece.price,
        brand: ownerBrand,
        hintGroup: "acc",
      })
    );
  }

  const primary = built[0] ||
    buildSynthetic3DProductFromPiece({
      id: `closet-${look.index}-fallback`,
      name: look.name,
      price: 120,
      brand: ownerBrand,
    });

  return {
    primaryProduct: primary,
    companionProducts: built.slice(1),
  };
}

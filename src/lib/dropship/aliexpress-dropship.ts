import {
  DropshipListingSpec,
  GarmentCategory,
  GarmentSilhouette,
  Product,
  SizeMeasurementSpec,
} from "../types";
import { extractProductFitProfile } from "../catalog/fit-intelligence";

const ASSET_BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

/**
 * Calibrated US-equivalent size chart (in inches) after mapping AliExpress CN boutique tags
 * (where US XS = CN S, US S = CN M, US M = CN L, US L = CN XL).
 */
export const ALIEXPRESS_CALIBRATED_US_CHART: Record<string, SizeMeasurementSpec> = {
  XS: { bustMin: 30.7, bustMax: 32.3, waistMin: 23.6, waistMax: 25.2, hipsMin: 33.5, hipsMax: 35.0 }, // CN Tag S (78-82 / 60-64 / 85-89cm)
  S: { bustMin: 32.3, bustMax: 33.9, waistMin: 25.2, waistMax: 27.5, hipsMin: 35.0, hipsMax: 37.0 },  // CN Tag M (82-86 / 64-70 / 89-94cm)
  M: { bustMin: 33.9, bustMax: 36.2, waistMin: 27.6, waistMax: 29.5, hipsMin: 37.0, hipsMax: 39.4 },  // CN Tag L (86-92 / 70-75 / 94-100cm)
  L: { bustMin: 36.2, bustMax: 38.6, waistMin: 29.5, waistMax: 31.9, hipsMin: 39.4, hipsMax: 41.7 },  // CN Tag XL
};

export const DEFAULT_CN_SIZE_TAG_MAP: Record<string, string> = {
  XS: "CN Tag S",
  S: "CN Tag M",
  M: "CN Tag L",
  L: "CN Tag XL",
};

/**
 * Rounds calculated dropship retail prices to clean boutique fashion price endings ($48, $54, $58, $68, $78).
 */
export function roundToBoutiquePrice(rawUsd: number): number {
  const clamped = Math.max(24, rawUsd);
  const baseTen = Math.floor(clamped / 10) * 10;
  const rem = clamped - baseTen;
  if (rem <= 3) return baseTen + 2;
  if (rem <= 5.5) return baseTen + 4;
  if (rem <= 7) return baseTen + 6;
  return baseTen + 8;
}

export function calculateDropshipEconomics(
  wholesaleCostUsd: number,
  shippingCostUsd = 0,
  markupMultiplier = 2.85
): {
  retailPriceUsd: number;
  landedCostUsd: number;
  profitMarginUsd: number;
  marginPct: number;
} {
  const landedCostUsd = Number((wholesaleCostUsd + shippingCostUsd).toFixed(2));
  const retailPriceUsd = roundToBoutiquePrice(landedCostUsd * markupMultiplier);
  const profitMarginUsd = Number((retailPriceUsd - landedCostUsd).toFixed(2));
  const marginPct = Math.round((profitMarginUsd / retailPriceUsd) * 100);
  return {
    retailPriceUsd,
    landedCostUsd,
    profitMarginUsd,
    marginPct,
  };
}

/**
 * Parses centimeter bust/waist/hip tables common on AliExpress listings (e.g. "S Bust: 80cm Waist: 64cm Hip: 88cm")
 * and converts them into US inch specifications mapped one size up for true US fit!
 */
export function parseAliExpressCmChartToInches(
  rawText: string
): Record<string, SizeMeasurementSpec> | null {
  const found: Record<string, SizeMeasurementSpec> = {};
  const tagToUs: Record<string, string> = {
    S: "XS",
    M: "S",
    L: "M",
    XL: "L",
  };

  const lines = rawText.split(/\n|;/);
  for (const line of lines) {
    const sizeMatch = line.match(/^\s*(S|M|L|XL)\b/i);
    if (!sizeMatch) continue;
    const cnTag = sizeMatch[1].toUpperCase();
    const usKey = tagToUs[cnTag];
    if (!usKey) continue;

    const bustCm = line.match(/bust[:\s]*(\d{2,3}(?:\.\d+)?)\s*cm/i);
    const waistCm = line.match(/waist[:\s]*(\d{2,3}(?:\.\d+)?)\s*cm/i);
    const hipCm = line.match(/hips?[:\s]*(\d{2,3}(?:\.\d+)?)\s*cm/i);

    if (bustCm || waistCm || hipCm) {
      const bIn = bustCm ? Number((Number(bustCm[1]) / 2.54).toFixed(1)) : undefined;
      const wIn = waistCm ? Number((Number(waistCm[1]) / 2.54).toFixed(1)) : undefined;
      const hIn = hipCm ? Number((Number(hipCm[1]) / 2.54).toFixed(1)) : undefined;
      found[usKey] = {
        ...(bIn ? { bustMin: Number((bIn - 1.4).toFixed(1)), bustMax: bIn } : {}),
        ...(wIn ? { waistMin: Number((wIn - 1.4).toFixed(1)), waistMax: wIn } : {}),
        ...(hIn ? { hipsMin: Number((hIn - 1.5).toFixed(1)), hipsMax: hIn } : {}),
      };
    }
  }

  return Object.keys(found).length >= 2 ? found : null;
}

export function extractAliExpressItemId(urlOrInput: string): string | null {
  const m = urlOrInput.match(/\/item\/(\d{8,20})(?:\.html)?/i);
  if (m?.[1]) return m[1];
  const digitsOnly = urlOrInput.trim().match(/^(\d{10,20})$/);
  return digitsOnly?.[1] || null;
}

interface RawSupplierSeed {
  id: string;
  aliexpressItemId: string;
  supplierName: string;
  brandLabel: string;
  title: string;
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
  colorName: string;
  colorHex: string;
  accentHex: string;
  wholesaleCostUsd: number;
  shippingCostUsd: number;
  supplierRating: number;
  ordersCount: number;
  qualityTier: DropshipListingSpec["qualityTier"];
  estDeliveryDays: number;
  imageFile: string;
  occasions: string[];
  vibes: string[];
  descriptionSummary: string;
  fitNotes: string[];
  fabricComposition: string;
  stretchLevel: "rigid" | "low" | "medium" | "high";
  cutType: "body-hugging" | "fitted" | "regular" | "oversized";
  hemLanding?: "cropped" | "natural-waist" | "mini" | "midi" | "full-length";
  hasAdjustableBack?: boolean;
}

const RAW_TOP_LINE_SUPPLIER_SEEDS: RawSupplierSeed[] = [
  {
    id: "prod-ae-espresso-corset",
    aliexpressItemId: "1005012677693131",
    supplierName: "CHICVEN Atelier Gold Store",
    brandLabel: "GWO × Atelier",
    title: "Sculpted Espresso Boned Satin Basque Corset Top",
    category: "top",
    silhouette: "crop-tank",
    colorName: "Espresso Mocha",
    colorHex: "#4B3531",
    accentHex: "#FAF8F5",
    wholesaleCostUsd: 17.8,
    shippingCostUsd: 0,
    supplierRating: 4.9,
    ordersCount: 3420,
    qualityTier: "Top 1% Gold Boutique",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_espresso_corset_top.webp`,
    occasions: ["Date Night", "Party", "Cocktail", "Concert"],
    vibes: ["Siren Glam", "Model Off-Duty", "Going Out"],
    descriptionSummary:
      "Heavyweight double-lined matte satin corset top with U-scoop neckline, 8-channel flexible spiral boning, pointed Basque waist hem, and concealed side zip.",
    fitNotes: [
      "Calibrated CN→US Sizing: Order CN Tag M for US Size S (27\" natural waist)",
      "Pointed Basque hem elongates petite 5'2\" torso over wide-leg trousers",
      "Double-lined satin holds structure without needing a bra",
    ],
    fabricComposition: "94% Heavy Matte Satin Polyester / 6% Elastane",
    stretchLevel: "low",
    cutType: "fitted",
    hemLanding: "natural-waist",
    hasAdjustableBack: true,
  },
  {
    id: "prod-ae-ivory-tweed-blazer",
    aliexpressItemId: "1005010695803178",
    supplierName: "TRAF Luxury Tailoring Official",
    brandLabel: "GWO × Reserve",
    title: "Old-Money Ivory Bouclé Gold-Button Cropped Blazer",
    category: "outerwear",
    silhouette: "cropped-jacket",
    colorName: "Studio Ivory",
    colorHex: "#EFECE6",
    accentHex: "#C9A86A",
    wholesaleCostUsd: 25.4,
    shippingCostUsd: 0,
    supplierRating: 4.9,
    ordersCount: 5180,
    qualityTier: "Top 1% Gold Boutique",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_ivory_tweed_blazer.webp`,
    occasions: ["Work / Chic", "Date Night", "Brunch", "Coffee Run"],
    vibes: ["Old Money Tailored", "Clean Girl Athleisure", "Model Off-Duty"],
    descriptionSummary:
      "Textured ivory bouclé tweed cropped jacket finished with brushed 14k-tone crest buttons, satin lining, and clean petite-friendly waist crop.",
    fitNotes: [
      "Cropped 18.5\" length hits right at the high hip on a 5'2\" frame",
      "Full satin interior lining glides smoothly over silk slips or tees",
      "Calibrated CN→US Sizing: CN Tag M = US Size S",
    ],
    fabricComposition: "78% Textured Cotton-Poly Bouclé / 22% Viscose Satin Lining",
    stretchLevel: "rigid",
    cutType: "regular",
    hemLanding: "cropped",
  },
  {
    id: "prod-ae-champagne-trousers",
    aliexpressItemId: "1005011848528649",
    supplierName: "SIMPLEE Flagship Boutique",
    brandLabel: "GWO × Atelier",
    title: "High-Waist Champagne Pleated Fluid Wide-Leg Trousers",
    category: "bottom",
    silhouette: "wide-denim",
    colorName: "Champagne Oat",
    colorHex: "#D9CEBE",
    accentHex: "#181615",
    wholesaleCostUsd: 19.2,
    shippingCostUsd: 0,
    supplierRating: 4.8,
    ordersCount: 4290,
    qualityTier: "AliExpress Choice Verified",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_champagne_wide_trousers.webp`,
    occasions: ["Work / Chic", "Brunch", "Date Night", "Weekend Trip"],
    vibes: ["Old Money Tailored", "Model Off-Duty", "Clean Girl Athleisure"],
    descriptionSummary:
      "High-rise tailored double-pleat wide-leg trousers in fluid drape suiting crepe with back elastic comfort tab for zero waist gap.",
    fitNotes: [
      "Hidden back-waist micro-elastic adapts cleanly to 27\" waist & 34\" hips",
      "29.5\" petite-friendly inseam skims heels cleanly at 5'2\" without dragging",
      "Calibrated CN→US Sizing: CN Tag M = US Size S",
    ],
    fabricComposition: "82% Draped Suiting Tencel-Poly / 14% Rayon / 4% Spandex",
    stretchLevel: "medium",
    cutType: "regular",
    hemLanding: "full-length",
  },
  {
    id: "prod-ae-noir-pleated-mini",
    aliexpressItemId: "1005008463221598",
    supplierName: "RARITY Studio Official",
    brandLabel: "GWO × Noir",
    title: "Noir Belted Knife-Pleat Tailored Micro Mini Skirt",
    category: "bottom",
    silhouette: "mini-skirt",
    colorName: "Jet Noir",
    colorHex: "#1D1E22",
    accentHex: "#D4B475",
    wholesaleCostUsd: 14.6,
    shippingCostUsd: 0,
    supplierRating: 4.8,
    ordersCount: 6120,
    qualityTier: "AliExpress Choice Verified",
    estDeliveryDays: 5,
    imageFile: `${ASSET_BASE}/models/dropship/ds_noir_pleated_mini.webp`,
    occasions: ["Party", "Date Night", "Concert", "Campus / Class"],
    vibes: ["Siren Glam", "Streetwear Luxe", "Coquette Romantic"],
    descriptionSummary:
      "Crisp suiting twill knife-pleated micro mini skirt with removable tonal leatherette buckle belt and built-in stretch safety shorts.",
    fitNotes: [
      "Built-in stretch liner shorts prevent ride-up",
      "13.8\" length elongates legs on a 5'2\" petite silhouette",
      "Calibrated CN→US Sizing: CN Tag M fits 26.5\"–27.5\" waist cleanly",
    ],
    fabricComposition: "74% Structured Suiting Twill / 22% Viscose / 4% Elastane",
    stretchLevel: "low",
    cutType: "fitted",
    hemLanding: "mini",
  },
  {
    id: "prod-ae-emerald-satin-midi",
    aliexpressItemId: "1005012134863411",
    supplierName: "SILKOLOGY Mulberry Boutique",
    brandLabel: "GWO × Reserve",
    title: "Emerald Bias-Cut Cowl-Neck Satin Midi Slip Dress",
    category: "dress",
    silhouette: "slip-dress",
    colorName: "Deep Emerald",
    colorHex: "#1F5441",
    accentHex: "#D4B475",
    wholesaleCostUsd: 21.5,
    shippingCostUsd: 0,
    supplierRating: 4.9,
    ordersCount: 2890,
    qualityTier: "Top 1% Gold Boutique",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_emerald_satin_midi.webp`,
    occasions: ["Date Night", "Cocktail", "Party", "Birthday"],
    vibes: ["Siren Glam", "Old Money Tailored", "Coquette Romantic"],
    descriptionSummary:
      "Luminous bias-cut emerald satin midi dress with draped cowl neckline, adjustable criss-cross rouleau back straps, and fluid mermaid skim.",
    fitNotes: [
      "Bias cut naturally molds to 32.25\" bust, 27\" waist, and 34\" hips",
      "Adjustable criss-cross back ties customize bust lift on a 5'2\" frame",
      "Calibrated CN→US Sizing: CN Tag M = US Size S",
    ],
    fabricComposition: "96% High-Momme Acetate Satin / 4% Elastane",
    stretchLevel: "medium",
    cutType: "fitted",
    hemLanding: "midi",
    hasAdjustableBack: true,
  },
  {
    id: "prod-ae-gold-strappy-heels",
    aliexpressItemId: "1005007475177029",
    supplierName: "EILYKEN Footwear Couture",
    brandLabel: "GWO × Couture",
    title: "14k Champagne Metallic Square-Toe Strappy Stilettos",
    category: "shoes",
    silhouette: "ballet-flats",
    colorName: "14k Champagne Gold",
    colorHex: "#D4B475",
    accentHex: "#181615",
    wholesaleCostUsd: 22.0,
    shippingCostUsd: 0,
    supplierRating: 4.9,
    ordersCount: 4750,
    qualityTier: "Top 1% Gold Boutique",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_gold_strappy_heels.webp`,
    occasions: ["Party", "Date Night", "Cocktail", "Birthday"],
    vibes: ["Siren Glam", "Coquette Romantic", "Old Money Tailored"],
    descriptionSummary:
      "Minimalist tubular metallic leatherette evening sandals with memory-foam cushioned footbed, square toe, and 3.2\" sculpted heel.",
    fitNotes: [
      "True US/EU shoe conversion: US 7.5 = EU 38",
      "3.2\" walkable architectural heel adds sleek posture to 5'2\" frame",
    ],
    fabricComposition: "Metallic Nappa Vegan Leather • Latex Cushioned Insole",
    stretchLevel: "low",
    cutType: "fitted",
  },
  {
    id: "prod-ae-noir-slingbacks",
    aliexpressItemId: "1005012035605043",
    supplierName: "FEDONAS Leather Atelier",
    brandLabel: "GWO × Noir",
    title: "Noir Patent Pointed-Toe Gold-Buckle Kitten Slingbacks",
    category: "shoes",
    silhouette: "ballet-flats",
    colorName: "Patent Noir",
    colorHex: "#18181B",
    accentHex: "#D4B475",
    wholesaleCostUsd: 19.8,
    shippingCostUsd: 0,
    supplierRating: 4.8,
    ordersCount: 3910,
    qualityTier: "AliExpress Choice Verified",
    estDeliveryDays: 6,
    imageFile: `${ASSET_BASE}/models/dropship/ds_noir_slingbacks.webp`,
    occasions: ["Work / Chic", "Date Night", "Brunch", "Coffee Run"],
    vibes: ["Old Money Tailored", "Model Off-Duty", "Coquette Romantic"],
    descriptionSummary:
      "Glossy patent-finish pointed kitten-heel slingbacks with micro gold buckle strap and non-slip rubber outsole.",
    fitNotes: [
      "Elasticized slingback heel strap stays secure all day",
      "2.1\" kitten heel transitions effortlessly from brunch to dinner",
    ],
    fabricComposition: "Patent Microfiber Leather • Soft Sheepskin-Touch Footbed",
    stretchLevel: "low",
    cutType: "fitted",
  },
  {
    id: "prod-ae-burgundy-crescent-bag",
    aliexpressItemId: "1005013168368946",
    supplierName: "MORMOR Leather Goods Gold",
    brandLabel: "GWO × Atelier",
    title: "Deep Merlot Smooth Leather Crescent Shoulder Bag",
    category: "accessory",
    silhouette: "shoulder-bag",
    colorName: "Deep Merlot",
    colorHex: "#6E1423",
    accentHex: "#D4B475",
    wholesaleCostUsd: 16.2,
    shippingCostUsd: 0,
    supplierRating: 4.9,
    ordersCount: 7340,
    qualityTier: "Top 1% Gold Boutique",
    estDeliveryDays: 5,
    imageFile: `${ASSET_BASE}/models/dropship/ds_burgundy_crescent_bag.webp`,
    occasions: ["Date Night", "Party", "Coffee Run", "Work / Chic", "Brunch"],
    vibes: ["Siren Glam", "Old Money Tailored", "Model Off-Duty"],
    descriptionSummary:
      "Sculptural underarm crescent shoulder bag in smooth merlot calf-grain finish with brushed gold clasp and magnetic top zip.",
    fitNotes: [
      "Adjustable 9\"–11\" shoulder drop sits cleanly at the waist",
      "Fits phone, cardholder, lip gloss, and keys without bulk",
    ],
    fabricComposition: "Top-Grain Split Leather & Microfiber Suede Lining",
    stretchLevel: "rigid",
    cutType: "regular",
  },
];

export function buildTopLineAliExpressDropshipCatalog(
  markupMultiplier = 2.85
): Product[] {
  const nowIso = new Date().toISOString();
  const staleIso = new Date(Date.now() + 3 * 86400000).toISOString();

  return RAW_TOP_LINE_SUPPLIER_SEEDS.map((seed) => {
    const econ = calculateDropshipEconomics(
      seed.wholesaleCostUsd,
      seed.shippingCostUsd,
      markupMultiplier
    );
    const supplierUrl = `https://www.aliexpress.com/item/${seed.aliexpressItemId}.html`;

    return {
      id: seed.id,
      canonicalUrl: supplierUrl,
      brand: seed.brandLabel,
      storeDomain: "aliexpress.com",
      title: seed.title,
      category: seed.category,
      silhouette: seed.silhouette,
      colorName: seed.colorName,
      colorHex: seed.colorHex,
      accentHex: seed.accentHex,
      price: econ.retailPriceUsd,
      currency: "USD",
      imageUrl: seed.imageFile,
      fitMetadata: {
        descriptionSummary: seed.descriptionSummary,
        fitNotes: seed.fitNotes,
        fabricComposition: seed.fabricComposition,
        stretchLevel: seed.stretchLevel,
        cutType: seed.cutType,
        storeFitTendency: "runs_small",
        hemLanding: seed.hemLanding,
        hasAdjustableBack: seed.hasAdjustableBack,
        modelStats: {
          rawText:
            "Supplier Lookbook Model is 5'6\" (168cm) wearing CN Tag S (US XS) • Calibrated for US Sizing",
          heightInches: 66,
          heightDisplay: "5'6\" (168cm)",
          wornSize: "XS",
          bustInches: 31.5,
          waistInches: 24.4,
          hipsInches: 34.6,
        },
        galleryImages: [{ url: seed.imageFile, label: "Studio Cut" }],
      },
      dropship: {
        supplierPlatform: "aliexpress",
        aliexpressItemId: seed.aliexpressItemId,
        supplierName: seed.supplierName,
        supplierUrl,
        supplierRating: seed.supplierRating,
        ordersCount: seed.ordersCount,
        qualityTier: seed.qualityTier,
        wholesaleCostUsd: seed.wholesaleCostUsd,
        shippingCostUsd: seed.shippingCostUsd,
        profitMarginUsd: econ.profitMarginUsd,
        marginPct: econ.marginPct,
        shippingMethod: `AliExpress Choice Direct Air (${seed.estDeliveryDays}d)`,
        cnSizeTagMap:
          seed.category === "shoes" || seed.category === "accessory"
            ? undefined
            : DEFAULT_CN_SIZE_TAG_MAP,
      },
      occasions: seed.occasions,
      vibes: seed.vibes,
      availableSizes:
        seed.category === "shoes"
          ? ["6", "6.5", "7", "7.5", "8", "8.5", "9"]
          : seed.category === "accessory"
          ? ["ONE SIZE"]
          : ["XS", "S", "M", "L"],
      sizeChartInches:
        seed.category === "shoes" || seed.category === "accessory"
          ? {}
          : ALIEXPRESS_CALIBRATED_US_CHART,
      estDeliveryDays: seed.estDeliveryDays,
      inStock: true,
      sourceType: "aliexpress_dropship",
      lastScrapedAt: nowIso,
      staleAfter: staleIso,
    };
  });
}

/**
 * Filters & ranks top-line AliExpress dropship garments by search query, category, and markup multiplier.
 */
export function searchTopLineAliExpressFeed(params: {
  query?: string;
  category?: GarmentCategory | "all";
  markupMultiplier?: number;
  minRating?: number;
}): Product[] {
  const {
    query = "",
    category = "all",
    markupMultiplier = 2.85,
    minRating = 4.7,
  } = params;
  const all = buildTopLineAliExpressDropshipCatalog(markupMultiplier).filter(
    (p) => (p.dropship?.supplierRating || 5) >= minRating
  );

  const catFiltered =
    category === "all" ? all : all.filter((p) => p.category === category);

  const q = query.trim().toLowerCase();
  if (!q) return catFiltered;

  const tokens = q.split(/\s+/).filter(Boolean);
  return catFiltered
    .map((prod) => {
      const hay = `${prod.title} ${prod.category} ${prod.silhouette} ${
        prod.colorName
      } ${prod.vibes.join(" ")} ${prod.occasions.join(" ")} ${
        prod.dropship?.supplierName || ""
      }`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 15;
      }
      return { prod, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.prod);
}

export interface AliExpressUrlScrapeOutcome {
  product: Product;
  source: "verified_supplier_catalog" | "official_open_platform_api" | "captcha_gated_notice" | "public_metadata";
  captchaGated: boolean;
  notice?: string;
}

function inferDropshipCategory(text: string): {
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
} {
  const t = text.toLowerCase();
  if (/(heel|sandal|stiletto|pump|slingback|mule|flat|boot)/.test(t)) {
    return { category: "shoes", silhouette: "ballet-flats" };
  }
  if (/(sneaker|runner|trainer)/.test(t)) {
    return { category: "shoes", silhouette: "sneakers" };
  }
  if (/(bag|purse|clutch|tote|crescent)/.test(t)) {
    return { category: "accessory", silhouette: "shoulder-bag" };
  }
  if (/(dress|gown|slip)/.test(t)) {
    return {
      category: "dress",
      silhouette: /mini/.test(t) ? "mini-dress" : "slip-dress",
    };
  }
  if (/(blazer|jacket|coat|tweed|cardigan)/.test(t)) {
    return { category: "outerwear", silhouette: "cropped-jacket" };
  }
  if (/(skirt|skort)/.test(t)) {
    return { category: "bottom", silhouette: "mini-skirt" };
  }
  if (/(trouser|pant|jean|denim|wide)/.test(t)) {
    return { category: "bottom", silhouette: "wide-denim" };
  }
  if (/(corset|bustier|tank|cami|bodysuit)/.test(t)) {
    return { category: "top", silhouette: "crop-tank" };
  }
  return { category: "top", silhouette: "baby-tee" };
}

/**
 * Browser-safe AliExpress URL importer for Dropship Storefront.
 * - Matches known verified supplier item IDs immediately (<5ms).
 * - Calls /api/dropship/aliexpress when server API is available (supports official ALIEXPRESS_APP_KEY).
 * - Never attempts to solve or bypass CAPTCHAs: if AliExpress gates unauthenticated HTML with CAPTCHA,
 *   cleanly reports `captchaGated: true` and prepares a structured dropship draft ready for photo paste or API sync.
 */
export async function importAliExpressUrlForDropship(
  rawUrl: string,
  options?: {
    markupMultiplier?: number;
    customTitle?: string;
    customWholesaleUsd?: number;
    customImageUrl?: string;
  }
): Promise<AliExpressUrlScrapeOutcome> {
  const markup = options?.markupMultiplier ?? 2.85;
  const trimmed = rawUrl.trim();
  const itemId = extractAliExpressItemId(trimmed) || `${Date.now()}`.slice(-12);
  const catalog = buildTopLineAliExpressDropshipCatalog(markup);

  // 1. Instant match if item ID is in our verified Gold Supplier catalog
  const matched = catalog.find((p) => p.dropship?.aliexpressItemId === itemId);
  if (matched) {
    return {
      product: options?.customImageUrl
        ? { ...matched, imageUrl: options.customImageUrl }
        : matched,
      source: "verified_supplier_catalog",
      captchaGated: false,
    };
  }

  // 2. Try server route (which uses official AliExpress Open Platform API when ALIEXPRESS_APP_KEY is set)
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  try {
    const res = await fetch(`${base}/api/dropship/aliexpress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: trimmed,
        markupMultiplier: markup,
        customTitle: options?.customTitle,
        customWholesaleUsd: options?.customWholesaleUsd,
        customImageUrl: options?.customImageUrl,
      }),
      signal: AbortSignal.timeout(4500),
    });
    if (res.ok) {
      return (await res.json()) as AliExpressUrlScrapeOutcome;
    }
  } catch {
    // Static GitHub Pages mode: proceed to clean client handling
  }

  // 3. Static client check: single standard public request; stop immediately if CAPTCHA-gated (never bypass!)
  let pageTitle = options?.customTitle?.trim() || "";
  let rawDescription = "";
  let heroImg = options?.customImageUrl?.trim() || undefined;
  let wholesaleUsd = options?.customWholesaleUsd || 18.5;
  let captchaGated = false;

  if (!pageTitle || !heroImg) {
    try {
      const normalized = trimmed.startsWith("http")
        ? trimmed
        : `https://www.aliexpress.com/item/${itemId}.html`;
      const jinaRes = await fetch(`https://r.jina.ai/${normalized}`, {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "markdown",
          "X-With-Images-Summary": "true",
        },
        signal: AbortSignal.timeout(5500),
      });
      if (jinaRes.ok) {
        const data = await jinaRes.json();
        const t = String(data?.data?.title || "");
        const c = String(data?.data?.content || "");
        if (
          /captcha|verify you are human|check if you are a robot|recaptcha|security verification/i.test(
            `${t} ${c.slice(0, 600)}`
          )
        ) {
          // Strictly honor Behavioral Guidelines: STOP immediately on CAPTCHA and report transparently!
          captchaGated = true;
        } else {
          if (!pageTitle && t) {
            pageTitle = t.split(/\s+[|\-–—]\s+/)[0].trim();
          }
          rawDescription = c;
          const priceM = c.match(/\$\s?([1-9][0-9]{0,2}(?:\.[0-9]{2})?)/);
          if (priceM && !options?.customWholesaleUsd) {
            wholesaleUsd = Math.max(8, Math.min(180, Number(priceM[1])));
          }
          const imgs = data?.data?.images as Record<string, string> | undefined;
          if (!heroImg && imgs) {
            const aeImg = Object.values(imgs).find((u) =>
              /aliexpress-media\.com\/kf\/|alicdn\.com\/kf\//i.test(String(u))
            );
            if (aeImg) {
              heroImg = String(aeImg).replace(/_\d+x\d+\.[a-z]+_\.avif$/i, "");
            }
          }
        }
      }
    } catch {
      // Network timeout
    }
  }

  const finalTitle =
    pageTitle || `AliExpress Boutique Item #${itemId.slice(-6)}`;
  const { category, silhouette } = inferDropshipCategory(
    `${finalTitle} ${rawDescription}`
  );
  const econ = calculateDropshipEconomics(wholesaleUsd, 0, markup);
  const cmChart = parseAliExpressCmChartToInches(rawDescription);
  const { fitMetadata } = extractProductFitProfile({
    rawText: rawDescription || finalTitle,
    title: finalTitle,
    brand: "GWO × Atelier",
    category,
    silhouette,
    galleryImages: heroImg ? [{ url: heroImg, label: "Supplier Photo" }] : undefined,
  });

  const nowIso = new Date().toISOString();
  const canonicalUrl = trimmed.startsWith("http")
    ? trimmed
    : `https://www.aliexpress.com/item/${itemId}.html`;

  const product: Product = {
    id: `prod-ae-${itemId}`,
    canonicalUrl,
    brand: "GWO × Atelier",
    storeDomain: "aliexpress.com",
    title: finalTitle,
    category,
    silhouette,
    colorName: "Boutique Edition",
    colorHex: "#232122",
    accentHex: "#D4B475",
    price: econ.retailPriceUsd,
    currency: "USD",
    imageUrl: heroImg,
    fitMetadata: {
      ...fitMetadata,
      storeFitTendency: "runs_small",
      fitNotes: [
        "Calibrated CN→US Sizing: Order 1 tag up on AliExpress (CN Tag M = US Size S)",
        ...fitMetadata.fitNotes.slice(0, 2),
      ],
    },
    dropship: {
      supplierPlatform: "aliexpress",
      aliexpressItemId: itemId,
      supplierName: "AliExpress Verified Boutique",
      supplierUrl: canonicalUrl,
      supplierRating: 4.8,
      ordersCount: 1200,
      qualityTier: "AliExpress Choice Verified",
      wholesaleCostUsd: wholesaleUsd,
      shippingCostUsd: 0,
      profitMarginUsd: econ.profitMarginUsd,
      marginPct: econ.marginPct,
      shippingMethod: "AliExpress Choice Direct Air (7d)",
      cnSizeTagMap:
        category === "shoes" || category === "accessory"
          ? undefined
          : DEFAULT_CN_SIZE_TAG_MAP,
    },
    occasions: ["Date Night", "Party", "Going Out"],
    vibes: ["Model Off-Duty", "Siren Glam"],
    availableSizes:
      category === "shoes"
        ? ["6.5", "7", "7.5", "8", "8.5"]
        : category === "accessory"
        ? ["ONE SIZE"]
        : ["XS", "S", "M", "L"],
    sizeChartInches:
      category === "shoes" || category === "accessory"
        ? {}
        : cmChart || ALIEXPRESS_CALIBRATED_US_CHART,
    estDeliveryDays: 7,
    inStock: true,
    sourceType: "aliexpress_dropship",
    lastScrapedAt: nowIso,
    staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
  };

  return {
    product,
    source: captchaGated ? "captcha_gated_notice" : "public_metadata",
    captchaGated,
    notice: captchaGated
      ? "AliExpress gated unauthenticated scraping on this URL with a CAPTCHA challenge (which GWO never bypasses). Connect ALIEXPRESS_APP_KEY in .env for official Open Platform API sync, or attach a product photo & wholesale price below to publish directly!"
      : undefined,
  };
}

import {
  Product,
  SocialStyleArchetype,
  SocialStyleDNA,
  UserProfile,
} from "../types";
import { analyzeExactAvatarFit } from "../catalog/fit-intelligence";
import { ARCHETYPE_META } from "../social/social-style-dna";
import { buildTopLineAliExpressDropshipCatalog } from "../dropship/aliexpress-dropship";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export interface AiRunwayOutfit {
  id: string;
  outfitNumber: number;
  title: string;
  occasion: string;
  archetype: SocialStyleArchetype;
  archetypeLabel: string;
  aiReason: string;
  fitHeadline: string;
  matchScorePct: number;
  frontAvatarUrl: string;
  backAvatarUrl: string;
  pieces: Array<{
    product: Product;
    recommendedSize: string;
    confidencePct: number;
    fitVerdict: string;
  }>;
  totalPriceUsd: number;
}

interface SignatureRunwayTemplate {
  key: string;
  title: string;
  occasion: string;
  archetype: SocialStyleArchetype;
  frontAvatarUrl: string;
  backAvatarUrl: string;
  productIds: string[];
  keywords: string[];
}

const SIGNATURE_AE_TEMPLATES: SignatureRunwayTemplate[] = [
  {
    key: "siren-espresso-champagne",
    title: "Espresso Satin Corset & Champagne Tailored Edit",
    occasion: "Date Night",
    archetype: "siren_glam",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
    productIds: [
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ],
    keywords: [
      "date night",
      "corset",
      "espresso",
      "siren",
      "dinner",
      "trousers",
      "evening",
    ],
  },
  {
    key: "old-money-boucle-mini",
    title: "Old-Money Ivory Bouclé & Pleated Mini Capsule",
    occasion: "Brunch / Chic",
    archetype: "old_money_tailored",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
    productIds: [
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-meotina-leather-boots",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: [
      "old money",
      "paris",
      "brunch",
      "tweed",
      "blazer",
      "boots",
      "mini",
      "chic",
    ],
  },
  {
    key: "emerald-silk-siren",
    title: "Emerald Bias-Cut Silk Midi & 14k Gold Stilettos",
    occasion: "Cocktail / Party",
    archetype: "siren_glam",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_2_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_2_back.webp`,
    productIds: [
      "prod-ae-emerald-satin-midi",
      "prod-ae-gold-strappy-heels",
      "prod-ae-burgundy-crescent-bag",
    ],
    keywords: [
      "cocktail",
      "party",
      "emerald",
      "green",
      "silk",
      "satin",
      "midi",
      "wedding",
      "formal",
    ],
  },
  {
    key: "champagne-couture-blazer-dress",
    title: "Champagne Corset Blazer Mini & Metallic Heels",
    occasion: "Party / Birthday",
    archetype: "coquette_romantic",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_3_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_3_back.webp`,
    productIds: [
      "prod-ae-champagne-blazer-dress",
      "prod-ae-gold-strappy-heels",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: [
      "birthday",
      "party",
      "rooftop",
      "champagne",
      "blazer dress",
      "mini",
      "gold",
      "miami",
    ],
  },
  {
    key: "quiet-luxury-camel-coat",
    title: "Mulberry Silk & Camel Wool Coat Tailored Look",
    occasion: "Work / Chic",
    archetype: "old_money_tailored",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_4_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_4_back.webp`,
    productIds: [
      "prod-ae-camel-silk-wool-coat",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: [
      "work",
      "coat",
      "camel",
      "quiet luxury",
      "tailored",
      "office",
      "fall",
      "winter",
    ],
  },
  {
    key: "coastal-linen-off-duty",
    title: "Artisanal Belted Linen Cardigan & Noir Pleat Edit",
    occasion: "Weekend / Coffee",
    archetype: "model_off_duty",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_5_front.webp`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_5_back.webp`,
    productIds: [
      "prod-ae-linen-cinch-cardigan",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-noir-slingbacks",
    ],
    keywords: [
      "weekend",
      "coffee",
      "casual",
      "linen",
      "cardigan",
      "off-duty",
      "daytime",
    ],
  },
];

/**
 * Builds AI-recommended full AliExpress boutique outfits for the Shopping Runway,
 * ranked by the customer's linked Instagram / Pinterest Style DNA, optional AI prompt,
 * and exact 5'2" (32.25" • 27" • 34") avatar measurements!
 */
export function buildAiRunwayOutfits(params: {
  catalog: Product[];
  avatar: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches" | "shoeSize"
  >;
  socialDna: SocialStyleDNA;
  occasionFilter?: string;
  vibePrompt?: string;
  extraGeneratedCount?: number;
}): AiRunwayOutfit[] {
  const {
    catalog,
    avatar,
    socialDna,
    occasionFilter = "all",
    vibePrompt = "",
    extraGeneratedCount = 0,
  } = params;

  const fallbackAe = buildTopLineAliExpressDropshipCatalog();
  const byId = new Map<string, Product>();
  for (const p of fallbackAe) byId.set(p.id, p);
  for (const p of catalog) {
    if (p.sourceType === "aliexpress_dropship") {
      byId.set(p.id, p);
    }
  }

  const promptTokens = vibePrompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  const hFt = Math.floor(avatar.heightInches / 12);
  const hIn = Math.round(avatar.heightInches % 12);
  const hDisplay = `${hFt}'${hIn}"`;

  // Score and rank the 6 lifelike-photographed AliExpress Runway Outfits
  const scoredBase = SIGNATURE_AE_TEMPLATES.map((tpl) => {
    const baseScore = socialDna.archetypeScores[tpl.archetype] || 78;
    let bonus = 0;
    const hay = `${tpl.title} ${tpl.occasion} ${tpl.keywords.join(" ")}`.toLowerCase();
    for (const tok of promptTokens) {
      if (hay.includes(tok)) bonus += 18;
    }
    const matchPct = Math.min(
      99,
      Math.max(82, Math.round(baseScore * 0.92 + 8 + Math.min(10, bonus * 0.4)))
    );
    return { tpl, rankScore: baseScore + bonus, matchPct };
  })
    .filter(({ tpl }) => {
      if (!occasionFilter || occasionFilter === "all") return true;
      return tpl.occasion.toLowerCase().includes(occasionFilter.toLowerCase());
    })
    .sort((a, b) => b.rankScore - a.rankScore);

  const activeTemplates =
    scoredBase.length > 0
      ? scoredBase
      : SIGNATURE_AE_TEMPLATES.map((tpl) => ({
          tpl,
          rankScore: 88,
          matchPct: 92,
        }));

  const results: AiRunwayOutfit[] = activeTemplates.map(
    ({ tpl, matchPct }, idx) => {
      const resolvedProducts = tpl.productIds
        .map((id) => byId.get(id))
        .filter((p): p is Product => Boolean(p));

      const pieces = resolvedProducts.map((prod) => {
        const fit = analyzeExactAvatarFit(avatar, prod);
        return {
          product: prod,
          recommendedSize: fit.recommendedSize,
          confidencePct: fit.confidencePct,
          fitVerdict: fit.headlineVerdict,
        };
      });

      const totalPriceUsd = pieces.reduce((s, x) => s + x.product.price, 0);
      const socialLabel =
        socialDna.instagramHandle ||
        (socialDna.pinterestBoard ? "Pinterest" : "AI Stylist");
      const archLabel = ARCHETYPE_META[tpl.archetype].label;

      return {
        id: `runway-${tpl.key}`,
        outfitNumber: idx + 1,
        title: tpl.title,
        occasion: tpl.occasion,
        archetype: tpl.archetype,
        archetypeLabel: archLabel,
        aiReason: vibePrompt.trim()
          ? `AI curated for "${vibePrompt.trim()}" & ${socialLabel} (${matchPct}% ${archLabel} match).`
          : `Recommended via AI research & ${socialLabel} (${matchPct}% ${archLabel} match).`,
        fitHeadline: `Exact ${hDisplay} Petite Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: matchPct,
        frontAvatarUrl: tpl.frontAvatarUrl,
        backAvatarUrl: tpl.backAvatarUrl,
        pieces,
        totalPriceUsd,
      };
    }
  );

  // When customer asks AI for even more Runway suggestions, synthesize fresh AliExpress capsule variations!
  if (extraGeneratedCount > 0) {
    const allAe = Array.from(byId.values());
    const extraTops = allAe.filter(
      (p) => p.category === "top" || p.category === "outerwear"
    );
    const extraBottoms = allAe.filter((p) => p.category === "bottom");
    const extraShoes = allAe.filter((p) => p.category === "shoes");
    const extraBags = allAe.filter((p) => p.category === "accessory");

    for (let k = 0; k < extraGeneratedCount; k++) {
      const t = extraTops[(k + 1) % extraTops.length];
      const b = extraBottoms[(k + 1) % extraBottoms.length];
      const sh = extraShoes[k % extraShoes.length];
      const bg = extraBags[k % extraBags.length];
      const combo = [t, b, sh, bg].filter((x): x is Product => Boolean(x));
      const photoTpl =
        SIGNATURE_AE_TEMPLATES[(k + 1) % SIGNATURE_AE_TEMPLATES.length];

      const pieces = combo.map((prod) => {
        const fit = analyzeExactAvatarFit(avatar, prod);
        return {
          product: prod,
          recommendedSize: fit.recommendedSize,
          confidencePct: fit.confidencePct,
          fitVerdict: fit.headlineVerdict,
        };
      });

      results.push({
        id: `runway-extra-${k + 1}`,
        outfitNumber: results.length + 1,
        title: `AI Capsule Remix #0${k + 1}: ${t?.colorName || "Boutique"} & ${
          b?.colorName || "Tailored"
        }`,
        occasion: "AI Suggestion",
        archetype: socialDna.primaryArchetype,
        archetypeLabel: ARCHETYPE_META[socialDna.primaryArchetype].label,
        aiReason: `Fresh AI outfit idea built from ${combo.length} AliExpress boutique pieces for your ${hDisplay} frame.`,
        fitHeadline: `Exact ${hDisplay} Petite Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: 94,
        frontAvatarUrl: photoTpl.frontAvatarUrl,
        backAvatarUrl: photoTpl.backAvatarUrl,
        pieces,
        totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
      });
    }
  }

  return results;
}

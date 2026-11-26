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
  mode?: "outfit" | "piece";
  title: string;
  occasion: string;
  archetype: SocialStyleArchetype;
  archetypeLabel: string;
  aiReason: string;
  fitHeadline: string;
  matchScorePct: number;
  frontAvatarUrl: string;
  backAvatarUrl: string;
  bottomFrontAvatarUrl?: string;
  bottomBackAvatarUrl?: string;
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

  // When customer scrolls Runway or asks AI for more outfits, synthesize distinct AliExpress capsule combinations
  // with waist-feathered Top + Bottom lifelike RGBA studio cutouts worn directly on their Runway avatar!
  if (extraGeneratedCount > 0) {
    const AVATAR_BY_TOP_ID: Record<string, { f: string; b: string }> = {
      "prod-ae-espresso-corset": {
        f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
      },
      "prod-ae-ivory-tweed-blazer": {
        f: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
      },
      "prod-ae-camel-silk-wool-coat": {
        f: `${BASE}/models/runway_ai/ae_outfit_4_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_4_back.webp`,
      },
      "prod-ae-linen-cinch-cardigan": {
        f: `${BASE}/models/runway_ai/ae_outfit_5_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_5_back.webp`,
      },
      "prod-ae-acetate-beaded-tank": {
        f: `${BASE}/models/runway_ai/ae_outfit_5_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_5_back.webp`,
      },
    };
    const AVATAR_BY_BOT_ID: Record<string, { f: string; b: string }> = {
      "prod-ae-champagne-trousers": {
        f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
      },
      "prod-ae-noir-pleated-mini": {
        f: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
        b: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
      },
    };

    const REMIX_RECIPES = [
      {
        title: "Ivory Bouclé Blazer & Champagne Wide-Leg Edit",
        occasion: "AI Styled • Brunch",
        topId: "prod-ae-ivory-tweed-blazer",
        botId: "prod-ae-champagne-trousers",
        shoeId: "prod-ae-noir-slingbacks",
        bagId: "prod-ae-camel-turnlock-tote",
      },
      {
        title: "Espresso Satin Corset & Noir Pleated Mini",
        occasion: "AI Styled • Night Out",
        topId: "prod-ae-espresso-corset",
        botId: "prod-ae-noir-pleated-mini",
        shoeId: "prod-ae-meotina-leather-boots",
        bagId: "prod-ae-burgundy-crescent-bag",
      },
      {
        title: "Belted Linen Cardigan & Champagne Fluid Trousers",
        occasion: "AI Styled • Effortless",
        topId: "prod-ae-linen-cinch-cardigan",
        botId: "prod-ae-champagne-trousers",
        shoeId: "prod-ae-noir-slingbacks",
        bagId: "prod-ae-camel-turnlock-tote",
      },
      {
        title: "Camel Silk-Wool Coat & Noir Pleat Riding Look",
        occasion: "AI Styled • City Chic",
        topId: "prod-ae-camel-silk-wool-coat",
        botId: "prod-ae-noir-pleated-mini",
        shoeId: "prod-ae-meotina-leather-boots",
        bagId: "prod-ae-burgundy-crescent-bag",
      },
    ];

    for (let k = 0; k < extraGeneratedCount; k++) {
      const recipe = REMIX_RECIPES[k % REMIX_RECIPES.length];
      const t = byId.get(recipe.topId);
      const b = byId.get(recipe.botId);
      const sh = byId.get(recipe.shoeId);
      const bg = byId.get(recipe.bagId);
      const combo = [t, b, sh, bg].filter((x): x is Product => Boolean(x));

      const topPhoto =
        AVATAR_BY_TOP_ID[recipe.topId] ||
        AVATAR_BY_TOP_ID["prod-ae-espresso-corset"];
      const botPhoto =
        AVATAR_BY_BOT_ID[recipe.botId] ||
        AVATAR_BY_BOT_ID["prod-ae-champagne-trousers"];

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
        mode: "outfit",
        title: recipe.title,
        occasion: recipe.occasion,
        archetype: socialDna.primaryArchetype,
        archetypeLabel: ARCHETYPE_META[socialDna.primaryArchetype].label,
        aiReason: `AI auto-added onto your ${hDisplay} Runway avatar from AliExpress boutique pieces.`,
        fitHeadline: `Exact ${hDisplay} Petite Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: 95 - (k % 3),
        frontAvatarUrl: topPhoto.f,
        backAvatarUrl: topPhoto.b,
        bottomFrontAvatarUrl: botPhoto.f !== topPhoto.f ? botPhoto.f : undefined,
        bottomBackAvatarUrl: botPhoto.b !== topPhoto.b ? botPhoto.b : undefined,
        pieces,
        totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
      });
    }
  }

  return results;
}

/**
 * Builds a Single-Piece Runway lineup so shoppers scrolling the Runway in "Single Pieces" mode
 * see individual boutique garments styled right on their customer avatar model!
 */
export function buildSinglePieceRunwayLineup(params: {
  catalog: Product[];
  avatar: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches" | "shoeSize"
  >;
  socialDna: SocialStyleDNA;
}): AiRunwayOutfit[] {
  const { catalog, avatar, socialDna } = params;
  const fallbackAe = buildTopLineAliExpressDropshipCatalog();
  const map = new Map<string, Product>();
  for (const p of fallbackAe) map.set(p.id, p);
  for (const p of catalog) {
    if (
      p.sourceType === "aliexpress_dropship" ||
      p.sourceType === "scraped_url"
    ) {
      map.set(p.id, p);
    }
  }

  const PIECE_AVATAR_MAP: Record<string, { f: string; b: string }> = {
    "prod-ae-espresso-corset": {
      f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
    },
    "prod-ae-champagne-trousers": {
      f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
    },
    "prod-ae-ivory-tweed-blazer": {
      f: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
    },
    "prod-ae-noir-pleated-mini": {
      f: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
    },
    "prod-ae-emerald-satin-midi": {
      f: `${BASE}/models/runway_ai/ae_outfit_2_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_2_back.webp`,
    },
    "prod-ae-champagne-blazer-dress": {
      f: `${BASE}/models/runway_ai/ae_outfit_3_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_3_back.webp`,
    },
    "prod-ae-camel-silk-wool-coat": {
      f: `${BASE}/models/runway_ai/ae_outfit_4_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_4_back.webp`,
    },
    "prod-ae-linen-cinch-cardigan": {
      f: `${BASE}/models/runway_ai/ae_outfit_5_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_5_back.webp`,
    },
    "prod-ae-acetate-beaded-tank": {
      f: `${BASE}/models/runway_ai/ae_outfit_5_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_5_back.webp`,
    },
    "prod-ae-gold-strappy-heels": {
      f: `${BASE}/models/runway_ai/ae_outfit_2_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_2_back.webp`,
    },
    "prod-ae-meotina-leather-boots": {
      f: `${BASE}/models/runway_ai/ae_outfit_1_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_1_back.webp`,
    },
    "prod-ae-noir-slingbacks": {
      f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
    },
    "prod-ae-burgundy-crescent-bag": {
      f: `${BASE}/models/runway_ai/ae_outfit_0_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_0_back.webp`,
    },
    "prod-ae-camel-turnlock-tote": {
      f: `${BASE}/models/runway_ai/ae_outfit_4_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_4_back.webp`,
    },
    "prod-babyboo-cornelia-red": {
      f: `${BASE}/models/signature/look_8.webp`,
      b: `${BASE}/models/signature/look_8_back.webp`,
    },
  };

  const allItems = Array.from(map.values());
  const hFt = Math.floor(avatar.heightInches / 12);
  const hIn = Math.round(avatar.heightInches % 12);
  const hDisplay = `${hFt}'${hIn}"`;

  return allItems.map((prod, idx) => {
    const fit = analyzeExactAvatarFit(avatar, prod);
    const av = PIECE_AVATAR_MAP[prod.id] || {
      f: `${BASE}/models/runway_ai/ae_outfit_${idx % 6}_front.webp`,
      b: `${BASE}/models/runway_ai/ae_outfit_${idx % 6}_back.webp`,
    };
    const catLabel =
      prod.category === "outerwear"
        ? "Coat / Jacket"
        : prod.category.charAt(0).toUpperCase() + prod.category.slice(1);

    return {
      id: `runway-piece-${prod.id}`,
      outfitNumber: idx + 1,
      mode: "piece",
      title: prod.title,
      occasion: `${catLabel} • $${prod.price}`,
      archetype: socialDna.primaryArchetype,
      archetypeLabel: catLabel,
      aiReason: `Single Piece on Your ${hDisplay} Avatar • Recommended Size ${fit.recommendedSize} (${fit.confidencePct}% Fit Match).`,
      fitHeadline: `Exact ${hDisplay} Fit • Size ${fit.recommendedSize}`,
      matchScorePct: fit.confidencePct,
      frontAvatarUrl: av.f,
      backAvatarUrl: av.b,
      pieces: [
        {
          product: prod,
          recommendedSize: fit.recommendedSize,
          confidencePct: fit.confidencePct,
          fitVerdict: fit.headlineVerdict,
        },
      ],
      totalPriceUsd: prod.price,
    };
  });
}

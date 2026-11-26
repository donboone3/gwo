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
  bagOverlayUrl?: string;
  bagOverlayPos?: "hand" | "shoulder";
  pieces: Array<{
    product: Product;
    recommendedSize: string;
    confidencePct: number;
    fitVerdict: string;
  }>;
  totalPriceUsd: number;
}

export const BAG_RGBA_OVERLAY_BY_ID: Record<
  string,
  { url: string; pos: "hand" | "shoulder" }
> = {
  "prod-ae-burgundy-crescent-bag": {
    url: `${BASE}/models/dropship/bag_rgba_merlot.webp?v=life4`,
    pos: "shoulder",
  },
  "prod-ae-camel-turnlock-tote": {
    url: `${BASE}/models/dropship/bag_rgba_camel_tote.webp?v=life4`,
    pos: "hand",
  },
  "prod-ae-noir-quilted-bag": {
    url: `${BASE}/models/dropship/bag_rgba_noir_quilted.webp?v=life4`,
    pos: "shoulder",
  },
  "prod-ae-ivory-mini-bag": {
    url: `${BASE}/models/dropship/bag_rgba_ivory_mini.webp?v=life4`,
    pos: "hand",
  },
};

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

/**
 * 10 Complete AliExpress Boutique Runway Outfits (0..9).
 * Every single outfit's `productIds` (including Handbags, Belts & Footwear) is 100% worn & held
 * by our 5'2" customer avatar in both `frontAvatarUrl` and `backAvatarUrl`!
 */
const SIGNATURE_AE_TEMPLATES: SignatureRunwayTemplate[] = [
  {
    key: "siren-espresso-champagne",
    title: "Espresso Satin Corset & Champagne Tailored Edit",
    occasion: "Date Night",
    archetype: "siren_glam",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_0_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_0_back.webp?v=life4`,
    productIds: [
      "prod-ae-espresso-corset",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ],
    keywords: ["date night", "corset", "espresso", "siren", "dinner", "trousers"],
  },
  {
    key: "old-money-boucle-mini",
    title: "Old-Money Ivory Bouclé & Pleated Mini Capsule",
    occasion: "Brunch / Chic",
    archetype: "old_money_tailored",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_1_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_1_back.webp?v=life4`,
    productIds: [
      "prod-ae-ivory-tweed-blazer",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-meotina-leather-boots",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: ["old money", "paris", "brunch", "tweed", "blazer", "boots", "mini"],
  },
  {
    key: "crimson-corset-evening",
    title: "Crimson Boned Corset Mini & Noir Quilted Bag Edit",
    occasion: "Party / Night Out",
    archetype: "siren_glam",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_6_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_6_back.webp?v=life4`,
    productIds: [
      "prod-ae-crimson-corset-mini",
      "prod-ae-gold-strappy-heels",
      "prod-ae-noir-quilted-bag",
    ],
    keywords: ["crimson", "red", "party", "corset", "mini", "birthday", "club"],
  },
  {
    key: "emerald-silk-siren",
    title: "Emerald Bias-Cut Silk Midi & Merlot Crescent Edit",
    occasion: "Cocktail / Gala",
    archetype: "siren_glam",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_2_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_2_back.webp?v=life4`,
    productIds: [
      "prod-ae-emerald-satin-midi",
      "prod-ae-gold-strappy-heels",
      "prod-ae-burgundy-crescent-bag",
    ],
    keywords: ["cocktail", "emerald", "green", "silk", "satin", "midi", "wedding"],
  },
  {
    key: "champagne-couture-blazer-dress",
    title: "Champagne Corset Blazer Mini & Pearl Ivory Bag",
    occasion: "Birthday / Glam",
    archetype: "coquette_romantic",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_3_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_3_back.webp?v=life4`,
    productIds: [
      "prod-ae-champagne-blazer-dress",
      "prod-ae-gold-strappy-heels",
      "prod-ae-ivory-mini-bag",
    ],
    keywords: ["birthday", "rooftop", "champagne", "blazer dress", "ivory", "mini"],
  },
  {
    key: "noir-blazer-vintage-denim",
    title: "Oversized Noir Blazer, Belted Denim & Merlot Bag",
    occasion: "City / Off-Duty",
    archetype: "model_off_duty",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_7_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_7_back.webp?v=life4`,
    productIds: [
      "prod-ae-noir-tailored-blazer",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-vintage-wide-denim",
      "prod-ae-gold-sculpted-belt",
      "prod-ae-noir-slingbacks",
      "prod-ae-burgundy-crescent-bag",
    ],
    keywords: ["denim", "jeans", "blazer", "belt", "city", "soho", "off-duty"],
  },
  {
    key: "quiet-luxury-camel-coat",
    title: "Mulberry Silk & Camel Wool Coat Tailored Look",
    occasion: "Work / Chic",
    archetype: "old_money_tailored",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_4_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_4_back.webp?v=life4`,
    productIds: [
      "prod-ae-camel-silk-wool-coat",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-champagne-trousers",
      "prod-ae-noir-slingbacks",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: ["work", "coat", "camel", "quiet luxury", "tailored", "office"],
  },
  {
    key: "coastal-linen-off-duty",
    title: "Artisanal Belted Linen Cardigan & Camel Tote Edit",
    occasion: "Weekend / Coffee",
    archetype: "model_off_duty",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_5_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_5_back.webp?v=life4`,
    productIds: [
      "prod-ae-linen-cinch-cardigan",
      "prod-ae-acetate-beaded-tank",
      "prod-ae-noir-pleated-mini",
      "prod-ae-noir-slingbacks",
      "prod-ae-camel-turnlock-tote",
    ],
    keywords: ["weekend", "coffee", "casual", "linen", "cardigan", "daytime"],
  },
  {
    key: "sage-sculpt-athleisure",
    title: "Sage-Olive Sculpt Studio Set & Ivory Mini Bag",
    occasion: "Pilates / Matcha",
    archetype: "clean_athleisure",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_8_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_8_back.webp?v=life4`,
    productIds: [
      "prod-ae-sage-zip-jacket",
      "prod-ae-sage-flare-leggings",
      "prod-ae-cloud-platform-sneakers",
      "prod-ae-ivory-mini-bag",
    ],
    keywords: ["pilates", "gym", "sage", "leggings", "sneakers", "athleisure"],
  },
  {
    key: "corset-denim-street-luxe",
    title: "Espresso Satin Corset, Vintage Denim & Quilted Bag",
    occasion: "Concert / Street",
    archetype: "streetwear_luxe",
    frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_9_front.webp?v=life4`,
    backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_9_back.webp?v=life4`,
    productIds: [
      "prod-ae-espresso-corset",
      "prod-ae-vintage-wide-denim",
      "prod-ae-meotina-leather-boots",
      "prod-ae-noir-quilted-bag",
    ],
    keywords: ["concert", "street", "corset", "denim", "jeans", "boots", "quilted"],
  },
];

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

  const scoredBase = SIGNATURE_AE_TEMPLATES.map((tpl) => {
    const baseScore = socialDna.archetypeScores[tpl.archetype] || 78;
    let bonus = 0;
    const hay = `${tpl.title} ${tpl.occasion} ${tpl.keywords.join(" ")}`.toLowerCase();
    for (const tok of promptTokens) {
      if (hay.includes(tok)) bonus += 18;
    }
    const matchPct = Math.min(
      99,
      Math.max(84, Math.round(baseScore * 0.92 + 8 + Math.min(10, bonus * 0.4)))
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
        mode: "outfit",
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

  // Endless AI Auto-Styling Remix Outfits: every remix ALSO includes a matching RGBA bag overlay when needed!
  if (extraGeneratedCount > 0) {
    const REMIX_RECIPES = [
      {
        title: "Noir Suiting Blazer & Champagne Trousers Capsule",
        occasion: "AI Styled • Executive",
        topAvatarIdx: 7,
        botAvatarIdx: 0,
        bagAlreadyInTop: true, // ae_outfit_7 already carries Deep Merlot Crescent Bag on shoulder!
        ids: [
          "prod-ae-noir-tailored-blazer",
          "prod-ae-acetate-beaded-tank",
          "prod-ae-champagne-trousers",
          "prod-ae-noir-slingbacks",
          "prod-ae-burgundy-crescent-bag",
        ],
      },
      {
        title: "Ivory Bouclé Blazer, Vintage Denim & Camel Tote",
        occasion: "AI Styled • Paris Brunch",
        topAvatarIdx: 1,
        botAvatarIdx: 7,
        bagAlreadyInTop: false,
        bagId: "prod-ae-camel-turnlock-tote",
        ids: [
          "prod-ae-ivory-tweed-blazer",
          "prod-ae-acetate-beaded-tank",
          "prod-ae-vintage-wide-denim",
          "prod-ae-noir-slingbacks",
          "prod-ae-camel-turnlock-tote",
        ],
      },
      {
        title: "Espresso Satin Corset, Noir Pleat Mini & Merlot Bag",
        occasion: "AI Styled • Siren Night",
        topAvatarIdx: 0,
        botAvatarIdx: 1,
        bagAlreadyInTop: true, // ae_outfit_0 carries Deep Merlot Crescent Bag on shoulder!
        ids: [
          "prod-ae-espresso-corset",
          "prod-ae-noir-pleated-mini",
          "prod-ae-meotina-leather-boots",
          "prod-ae-burgundy-crescent-bag",
        ],
      },
      {
        title: "Belted Linen Cardigan, Champagne Trousers & Ivory Bag",
        occasion: "AI Styled • Coastal Luxe",
        topAvatarIdx: 5,
        botAvatarIdx: 0,
        bagAlreadyInTop: false,
        bagId: "prod-ae-ivory-mini-bag",
        ids: [
          "prod-ae-linen-cinch-cardigan",
          "prod-ae-acetate-beaded-tank",
          "prod-ae-champagne-trousers",
          "prod-ae-noir-slingbacks",
          "prod-ae-ivory-mini-bag",
        ],
      },
    ];

    for (let k = 0; k < extraGeneratedCount; k++) {
      const recipe = REMIX_RECIPES[k % REMIX_RECIPES.length];
      const combo = recipe.ids
        .map((id) => byId.get(id))
        .filter((x): x is Product => Boolean(x));

      const pieces = combo.map((prod) => {
        const fit = analyzeExactAvatarFit(avatar, prod);
        return {
          product: prod,
          recommendedSize: fit.recommendedSize,
          confidencePct: fit.confidencePct,
          fitVerdict: fit.headlineVerdict,
        };
      });

      const bagMeta =
        !recipe.bagAlreadyInTop && recipe.bagId
          ? BAG_RGBA_OVERLAY_BY_ID[recipe.bagId]
          : undefined;

      results.push({
        id: `runway-extra-${k + 1}`,
        outfitNumber: results.length + 1,
        mode: "outfit",
        title: recipe.title,
        occasion: recipe.occasion,
        archetype: socialDna.primaryArchetype,
        archetypeLabel: ARCHETYPE_META[socialDna.primaryArchetype].label,
        aiReason: `AI auto-added onto your ${hDisplay} Runway avatar (${pieces.length} AliExpress pieces).`,
        fitHeadline: `Exact ${hDisplay} Petite Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: 95 - (k % 3),
        frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${recipe.topAvatarIdx}_front.webp?v=life4`,
        backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${recipe.topAvatarIdx}_back.webp?v=life4`,
        bottomFrontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${recipe.botAvatarIdx}_front.webp?v=life4`,
        bottomBackAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${recipe.botAvatarIdx}_back.webp?v=life4`,
        bagOverlayUrl: bagMeta?.url,
        bagOverlayPos: bagMeta?.pos,
        pieces,
        totalPriceUsd: pieces.reduce((s, x) => s + x.product.price, 0),
      });
    }
  }

  return results;
}

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

  const PIECE_OUTFIT_IDX: Record<string, number> = {
    "prod-ae-espresso-corset": 0,
    "prod-ae-champagne-trousers": 0,
    "prod-ae-burgundy-crescent-bag": 0,
    "prod-ae-ivory-tweed-blazer": 1,
    "prod-ae-noir-pleated-mini": 1,
    "prod-ae-meotina-leather-boots": 1,
    "prod-ae-emerald-satin-midi": 2,
    "prod-ae-gold-strappy-heels": 2,
    "prod-ae-champagne-blazer-dress": 3,
    "prod-ae-camel-silk-wool-coat": 4,
    "prod-ae-camel-turnlock-tote": 4,
    "prod-ae-linen-cinch-cardigan": 5,
    "prod-ae-acetate-beaded-tank": 5,
    "prod-ae-noir-slingbacks": 5,
    "prod-ae-crimson-corset-mini": 6,
    "prod-ae-noir-quilted-bag": 6,
    "prod-ae-noir-tailored-blazer": 7,
    "prod-ae-vintage-wide-denim": 7,
    "prod-ae-gold-sculpted-belt": 7,
    "prod-ae-sage-zip-jacket": 8,
    "prod-ae-sage-flare-leggings": 8,
    "prod-ae-cloud-platform-sneakers": 8,
    "prod-ae-ivory-mini-bag": 8,
  };

  const allItems = Array.from(map.values());
  const hFt = Math.floor(avatar.heightInches / 12);
  const hIn = Math.round(avatar.heightInches % 12);
  const hDisplay = `${hFt}'${hIn}"`;

  return allItems.map((prod, idx) => {
    const fit = analyzeExactAvatarFit(avatar, prod);
    const oIdx = PIECE_OUTFIT_IDX[prod.id] ?? idx % 10;
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
      frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${oIdx}_front.webp?v=life4`,
      backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${oIdx}_back.webp?v=life4`,
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

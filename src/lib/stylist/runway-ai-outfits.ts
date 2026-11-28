import {
  Product,
  SocialStyleArchetype,
  SocialStyleDNA,
  UserProfile,
} from "../types";
import { analyzeExactAvatarFit } from "../catalog/fit-intelligence";
import { ARCHETYPE_META } from "../social/social-style-dna";
import { buildTopLineAliExpressDropshipCatalog } from "../dropship/aliexpress-dropship";
import { CURATED_100_OUTFIT_DESIGNS } from "./curated-100-outfits";

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
  isModularRemix?: boolean;
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
    url: `${BASE}/models/dropship/bag_rgba_merlot.webp?v=rgba5`,
    pos: "shoulder",
  },
  "prod-ae-camel-turnlock-tote": {
    url: `${BASE}/models/dropship/bag_rgba_camel_tote.webp?v=rgba5`,
    pos: "hand",
  },
  "prod-ae-noir-quilted-bag": {
    url: `${BASE}/models/dropship/bag_rgba_noir_quilted.webp?v=rgba5`,
    pos: "shoulder",
  },
  "prod-ae-ivory-mini-bag": {
    url: `${BASE}/models/dropship/bag_rgba_ivory_mini.webp?v=rgba5`,
    pos: "hand",
  },
  "prod-ae-silver-metallic-shoulder-bag": {
    url: `${BASE}/models/dropship/bag_rgba_silver_metallic.webp?v=rgba5`,
    pos: "shoulder",
  },
  "prod-ae-espresso-suede-crescent-bag": {
    url: `${BASE}/models/dropship/ds_espresso_suede_crescent_bag.webp?v=rgba5`,
    pos: "shoulder",
  },
};

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
    if (p.sourceType === "aliexpress_dropship" || p.sourceType === "scraped_url") {
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

  const scoredBase = CURATED_100_OUTFIT_DESIGNS.map((tpl) => {
    const baseScore = socialDna?.archetypeScores?.[tpl.archetype] || 78;
    let bonus = 0;
    const hay = `${tpl.title} ${tpl.occasion} ${tpl.stylistNote} ${tpl.keywords.join(" ")}`.toLowerCase();
    for (const tok of promptTokens) {
      if (hay.includes(tok)) bonus += 18;
    }
    // Keep signature 001-016 boosted so prebaked studio looks lead their archetype while ranking by Social DNA
    const signatureBoost = !tpl.isModularRemix ? 12 : 0;
    const matchPct = Math.min(
      99,
      Math.max(85, Math.round(baseScore * 0.92 + 8 + Math.min(10, bonus * 0.4)))
    );
    return { tpl, rankScore: baseScore + bonus + signatureBoost, matchPct };
  })
    .filter(({ tpl }) => {
      if (!occasionFilter || occasionFilter === "all") return true;
      return tpl.occasion.toLowerCase().includes(occasionFilter.toLowerCase());
    })
    .sort((a, b) => b.rankScore - a.rankScore);

  const activeTemplates =
    scoredBase.length > 0
      ? scoredBase
      : CURATED_100_OUTFIT_DESIGNS.map((tpl) => ({
          tpl,
          rankScore: 90,
          matchPct: 93,
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

      const totalPriceUsd = pieces.reduce((s, x) => s + (x.product?.price || 0), 0);
      const socialLabel =
        socialDna?.instagramHandle ||
        (socialDna?.pinterestBoard ? "Pinterest" : "AI Stylist");
      const archLabel = ARCHETYPE_META[tpl.archetype]?.label || "Boutique";

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
          : `${tpl.stylistNote} (${matchPct}% ${archLabel} match via ${socialLabel}).`,
        fitHeadline: `Exact ${hDisplay} Scan Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: matchPct,
        frontAvatarUrl: tpl.frontAvatarUrl,
        backAvatarUrl: tpl.backAvatarUrl,
        isModularRemix: tpl.isModularRemix,
        pieces,
        totalPriceUsd,
      };
    }
  );

  // Optional user-triggered extra AI remixes beyond the 100 curated looks
  if (extraGeneratedCount > 0) {
    const tops = Array.from(byId.values()).filter((p) => p.category === "top");
    const bottoms = Array.from(byId.values()).filter((p) => p.category === "bottom");
    const outers = Array.from(byId.values()).filter((p) => p.category === "outerwear");
    const shoes = Array.from(byId.values()).filter((p) => p.category === "shoes");
    const bags = Array.from(byId.values()).filter(
      (p) => p.category === "accessory" && !/belt/i.test(p.title)
    );

    for (let k = 0; k < extraGeneratedCount; k++) {
      const t = tops[k % tops.length];
      const b = bottoms[(k * 3 + 1) % bottoms.length];
      const o = outers[(k * 2) % outers.length];
      const s = shoes[(k * 5) % shoes.length];
      const bg = bags[(k * 3) % bags.length];
      const combo = [o, t, b, s, bg].filter((x): x is Product => Boolean(x));

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
        title: `AI Bespoke Capsule #${100 + k + 1}: ${t?.colorName || "Atelier"} & ${b?.colorName || "Tailored"}`,
        occasion: "AI Bespoke Remix",
        archetype: socialDna?.primaryArchetype || "siren_glam",
        archetypeLabel:
          ARCHETYPE_META[socialDna?.primaryArchetype || "siren_glam"]?.label ||
          "Siren Going-Out",
        aiReason: `Live 3D modular capsule synthesized onto your ${hDisplay} body scan.`,
        fitHeadline: `Exact ${hDisplay} Scan Fit (${avatar.bustInches}" B • ${avatar.waistInches}" W • ${avatar.hipsInches}" H)`,
        matchScorePct: 96 - (k % 3),
        frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${k % 16}_front.webp?v=rw4k3`,
        backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${k % 16}_back.webp?v=rw4k3`,
        isModularRemix: true,
        pieces,
        totalPriceUsd: pieces.reduce((sum, x) => sum + x.product.price, 0),
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

  const allItems = Array.from(map.values());
  const hFt = Math.floor(avatar.heightInches / 12);
  const hIn = Math.round(avatar.heightInches % 12);
  const hDisplay = `${hFt}'${hIn}"`;

  return allItems.map((prod, idx) => {
    const fit = analyzeExactAvatarFit(avatar, prod);
    const matchingOutfit = CURATED_100_OUTFIT_DESIGNS.find((o) =>
      o.productIds.includes(prod.id)
    );
    const oIdx = matchingOutfit?.fallbackLookIdx ?? idx % 16;
    const rawCat = String(prod.category || "top");
    const catLabel =
      rawCat === "outerwear"
        ? "Coat / Jacket"
        : rawCat.charAt(0).toUpperCase() + rawCat.slice(1);

    return {
      id: `runway-piece-${prod.id}`,
      outfitNumber: idx + 1,
      mode: "piece",
      title: prod.title || "Boutique Piece",
      occasion: `${catLabel} • $${prod.price || 0}`,
      archetype: socialDna?.primaryArchetype || "siren_glam",
      archetypeLabel: catLabel,
      aiReason: `Single 360° 3D Piece on Your ${hDisplay} Body Scan • Recommended Size ${fit.recommendedSize} (${fit.confidencePct}% Fit Match).`,
      fitHeadline: `Exact ${hDisplay} Fit • Size ${fit.recommendedSize}`,
      matchScorePct: fit.confidencePct,
      frontAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${oIdx}_front.webp?v=rw4k3`,
      backAvatarUrl: `${BASE}/models/runway_ai/ae_outfit_${oIdx}_back.webp?v=rw4k3`,
      isModularRemix: matchingOutfit?.prebakedLookIdx === undefined,
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

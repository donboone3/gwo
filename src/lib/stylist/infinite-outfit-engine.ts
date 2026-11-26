import {
  EndlessAiOutfit,
  Product,
  SocialStyleArchetype,
  SocialStyleDNA,
  UserProfile,
} from "../types";
import { analyzeExactAvatarFit } from "../catalog/fit-intelligence";
import { ARCHETYPE_META } from "../social/social-style-dna";

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = (hex || "#232122").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0");
  const n = parseInt(full.slice(0, 6), 16) || 0x232122;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgbTuple(a);
  const [r2, g2, b2] = hexToRgbTuple(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function isNeutralHex(hex: string): boolean {
  const [r, g, b] = hexToRgbTuple(hex);
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  return spread < 38;
}

/**
 * Computes editorial color harmony (0..100) across a 2-to-5 piece outfit:
 * rewards monochrome/tonal dressing, crisp neutral anchors + single statement pop,
 * and gold/silver hardware coordination.
 */
export function computeOutfitColorHarmony(items: Product[]): number {
  if (items.length <= 1) return 92;
  const hexes = items.map((i) => i.colorHex || "#232122");
  const nonNeutrals = hexes.filter((h) => !isNeutralHex(h));

  // All neutrals (ivory, champagne, noir, espresso, silver) = classic quiet luxury
  if (nonNeutrals.length === 0) return 96;
  // Single statement color anchored by neutrals (e.g. Crimson dress + Champagne Gold heels + Merlot bag)
  if (nonNeutrals.length === 1) return 97;

  // Check pairwise closeness among statement colors (tonal red + merlot = high harmony; clashing hues = lower)
  let minPairDist = 999;
  for (let i = 0; i < nonNeutrals.length; i++) {
    for (let j = i + 1; j < nonNeutrals.length; j++) {
      minPairDist = Math.min(minPairDist, rgbDistance(nonNeutrals[i], nonNeutrals[j]));
    }
  }
  if (minPairDist < 95) return 95; // Tonal jewel pairing (e.g. Crimson + Deep Merlot)
  if (minPairDist < 155) return 88;
  return 79;
}

function inferBestArchetypeForItems(
  items: Product[],
  dna: SocialStyleDNA
): SocialStyleArchetype {
  const text = items
    .map((i) => `${i.title} ${i.vibes.join(" ")} ${i.occasions.join(" ")} ${i.silhouette}`)
    .join(" ")
    .toLowerCase();

  let bestArch: SocialStyleArchetype = dna.primaryArchetype;
  let bestScore = -1;

  (Object.keys(ARCHETYPE_META) as SocialStyleArchetype[]).forEach((arch) => {
    let s = dna.archetypeScores[arch] * 0.55;
    for (const kw of ARCHETYPE_META[arch].vibeKeywords) {
      if (text.includes(kw)) s += 18;
    }
    if (arch === "siren_glam" && /(corset|mini-dress|crimson|merlot|stiletto)/.test(text)) {
      s += 22;
    }
    if (arch === "old_money_tailored" && /(tweed|blazer|champagne|emerald|slingback)/.test(text)) {
      s += 24;
    }
    if (arch === "clean_athleisure" && /(leggings|hoodie|sports-bra|sneakers)/.test(text)) {
      s += 26;
    }
    if (arch === "streetwear_luxe" && /(cargo|pleat|puffer|denim)/.test(text)) {
      s += 20;
    }
    if (s > bestScore) {
      bestScore = s;
      bestArch = arch;
    }
  });

  return bestArch;
}

function buildPetiteProportionNote(
  items: Product[],
  heightInches: number,
  waistInches: number
): string {
  const ft = Math.floor(heightInches / 12);
  const inch = Math.round(heightInches % 12);
  const hDisp = `${ft}'${inch}"`;

  const hasDress = items.some((i) => i.category === "dress");
  const hasCroppedOuter = items.some(
    (i) => i.category === "outerwear" && i.silhouette === "cropped-jacket"
  );
  const hasWideBottom = items.some(
    (i) => i.silhouette === "wide-denim" || i.silhouette === "cargo-pants"
  );
  const hasMini = items.some(
    (i) => i.silhouette === "mini-dress" || i.silhouette === "mini-skirt"
  );

  if (hasDress && hasCroppedOuter) {
    return `Cropped waist-skimming jacket frames your ${waistInches}" waist without overwhelming a ${hDisp} silhouette.`;
  }
  if (hasMini) {
    return `High-cut mini hemline + sculpted waist elongates your ${hDisp} leg line while honoring your ${waistInches}" natural waist.`;
  }
  if (hasWideBottom) {
    return `Fitted upper bodice paired with high-rise full-length drape creates an unbroken vertical column on a ${hDisp} frame.`;
  }
  return `Balanced rule-of-thirds proportion tailored to ${hDisp} height and ${waistInches}" waist.`;
}

const EDITORIAL_MOOD_PREFIXES = [
  "SoHo Golden Hour",
  "Rooftop Espresso Martini",
  "West Village Gallery",
  "Midnight Siren",
  "Quiet Luxury Atelier",
  "Off-Duty Model Capsule",
  "Downtown Late Dinner",
  "Parisian Balcony",
  "Sunday Matcha Club",
  "Velvet Rope Edit",
  "Clean Studio Monochrome",
  " Tribeca Lofts",
];

export interface EndlessBatchRequest {
  catalog: Product[];
  avatar: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches" | "shoeSize"
  >;
  socialDna: SocialStyleDNA;
  batchIndex: number;
  batchSize?: number;
  occasionFilter?: string; // "all" | "Date Night" | "Party" | "Work / Chic" | "Coffee Run"
  sourceFilter?: "all" | "aliexpress_dropship";
  customVibePrompt?: string;
  maxBudget?: number;
  ownedProductIds?: string[];
  seenSignatures?: Set<string>;
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "in",
  "on",
  "at",
  "to",
  "my",
  "me",
  "a",
  "an",
  "of",
  "look",
  "outfit",
]);

function expandPromptSynonyms(rawPrompt: string): string[] {
  const lower = rawPrompt.toLowerCase();
  const baseTokens = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const expanded = new Set<string>(baseTokens);
  if (/red|crimson|cherry|scarlet|miami|birthday/.test(lower)) {
    ["crimson", "red", "merlot", "burgundy", "party", "birthday", "mini"].forEach((t) =>
      expanded.add(t)
    );
  }
  if (/gold|champagne|glam|rooftop|cocktail/.test(lower)) {
    ["champagne", "14k", "gold", "satin", "stiletto", "corset", "cocktail"].forEach(
      (t) => expanded.add(t)
    );
  }
  if (/paris|old\s*money|brunch|quiet|tailored|chic|work/.test(lower)) {
    [
      "ivory",
      "tweed",
      "blazer",
      "trousers",
      "camel",
      "silk",
      "linen",
      "slingback",
      "brunch",
    ].forEach((t) => expanded.add(t));
  }
  if (/soho|leather|boot|edgy|noir|night|street/.test(lower)) {
    ["leather", "boots", "noir", "pleat", "mini-skirt", "obsidian", "corset"].forEach(
      (t) => expanded.add(t)
    );
  }
  if (/pilates|clean|matcha|gym|coffee|morning|casual/.test(lower)) {
    ["leggings", "fleece", "hoodie", "sneakers", "cortez", "tank", "athletic"].forEach(
      (t) => expanded.add(t)
    );
  }
  return Array.from(expanded);
}

/**
 * Generates a fresh, non-repeating batch of AI-curated head-to-toe outfits
 * weighted by the customer's Instagram / TikTok / Pinterest Style DNA, color harmony,
 * AliExpress top-line dropship pieces, and exact 5'2" (32.25" • 27" • 34") fit sizing!
 */
export function generateEndlessOutfitBatch(
  req: EndlessBatchRequest
): EndlessAiOutfit[] {
  const {
    catalog,
    avatar,
    socialDna,
    batchIndex,
    batchSize = 6,
    occasionFilter = "all",
    sourceFilter = "all",
    customVibePrompt = "",
    maxBudget = 650,
    ownedProductIds = [],
  } = req;

  const promptKeywords = customVibePrompt.trim()
    ? expandPromptSynonyms(customVibePrompt)
    : [];

  const ownedSet = new Set(ownedProductIds);
  const likedProdSet = new Set(socialDna.likedProductIds);

  const pool = catalog.filter((p) => p.inStock);
  const tops = pool.filter((p) => p.category === "top");
  const bottoms = pool.filter((p) => p.category === "bottom");
  const dresses = pool.filter((p) => p.category === "dress");
  const outerwear = pool.filter((p) => p.category === "outerwear");
  const shoes = pool.filter((p) => p.category === "shoes");
  const bags = pool.filter((p) => p.category === "accessory");

  interface CandidateCombo {
    items: Product[];
    occasion: string;
  }

  const rawCandidates: CandidateCombo[] = [];

  // 1. Build Statement Dress Combos (Dress + Heel/Shoe + Optional Bag + Optional Cropped Layer)
  for (const dress of dresses) {
    const isEveningDress =
      /cornelia|satin|silk|embellished|aluma|party|cocktail/i.test(
        `${dress.title} ${dress.occasions.join(" ")}`
      );
    for (const shoe of shoes) {
      if (isEveningDress && shoe.silhouette === "sneakers") continue;
      const base = [dress, shoe];
      if (bags.length > 0) {
        rawCandidates.push({
          items: [...base, bags[0]],
          occasion: dress.occasions[0] || "Date Night",
        });
      }
      rawCandidates.push({
        items: base,
        occasion: dress.occasions[1] || dress.occasions[0] || "Party",
      });
      for (const layer of outerwear.slice(0, 2)) {
        if (layer.silhouette === "cropped-jacket") {
          rawCandidates.push({
            items: [dress, layer, shoe, ...(bags[0] ? [bags[0]] : [])],
            occasion: "Cocktail",
          });
        }
      }
    }
  }

  // 2. Build Sculpted Separates Combos (Top + Bottom + Shoe + Optional Outerwear / Bag)
  for (const top of tops) {
    for (const bottom of bottoms) {
      // Avoid pairing athletic leggings with formal satin corsets
      const isAthleticBottom = bottom.silhouette === "leggings";
      const isGlamTop = /corset|satin/i.test(top.title);
      if (isAthleticBottom && isGlamTop) continue;

      for (const shoe of shoes) {
        const isSneaker = shoe.silhouette === "sneakers";
        if (isGlamTop && isSneaker) continue;
        if (isAthleticBottom && !isSneaker) continue;

        const base = [top, bottom, shoe];
        const sharedOcc =
          top.occasions.find((o) => bottom.occasions.includes(o)) ||
          top.occasions[0] ||
          "Going Out";

        rawCandidates.push({ items: base, occasion: sharedOcc });

        if (bags[0] && !isAthleticBottom) {
          rawCandidates.push({
            items: [...base, bags[0]],
            occasion: sharedOcc,
          });
        }

        for (const layer of outerwear) {
          const isAthleticLayer = layer.silhouette === "oversized-hoodie";
          if (isAthleticLayer !== isAthleticBottom && isGlamTop) continue;
          rawCandidates.push({
            items: [layer, ...base, ...(bags[0] && !isAthleticLayer ? [bags[0]] : [])],
            occasion: layer.occasions[0] || sharedOcc,
          });
        }
      }
    }
  }

  // Filter by requested occasion, dropship source filter, and maxBudget
  const filtered = rawCandidates.filter((cand) => {
    if (sourceFilter === "aliexpress_dropship") {
      const hasDropship = cand.items.some(
        (i) => i.sourceType === "aliexpress_dropship"
      );
      if (!hasDropship) return false;
    }
    if (occasionFilter && occasionFilter !== "all") {
      const matchesOcc =
        cand.occasion.toLowerCase() === occasionFilter.toLowerCase() ||
        cand.items.some((i) =>
          i.occasions.some(
            (o) => o.toLowerCase() === occasionFilter.toLowerCase()
          )
        );
      if (!matchesOcc) return false;
    }
    const netCost = cand.items
      .filter((i) => !ownedSet.has(i.id))
      .reduce((s, i) => s + i.price, 0);
    return netCost <= maxBudget;
  });

  const workingList = filtered.length > 0 ? filtered : rawCandidates;

  // Score every candidate against Social Style DNA + Color Harmony + Dropship Quality
  const scored = workingList.map((cand, idx) => {
    const harmony = computeOutfitColorHarmony(cand.items);
    const arch = inferBestArchetypeForItems(cand.items, socialDna);
    const archWeight = socialDna.archetypeScores[arch] || 75;

    // Palette match bonus against customer's extracted IG grid swatches
    let paletteBonus = 0;
    for (const item of cand.items) {
      for (const sw of socialDna.extractedPaletteHex) {
        if (rgbDistance(item.colorHex, sw) < 68) {
          paletteBonus += 5;
          break;
        }
      }
      if (likedProdSet.has(item.id)) {
        paletteBonus += 9;
      }
      if (item.sourceType === "aliexpress_dropship") {
        paletteBonus += 4; // Highlight high-margin boutique dropship stars
      }
      if (item.imageUrl) {
        paletteBonus += 5; // Prefer studio photographed garments at top of feed
      }
    }

    // Glam slider alignment
    const hasEveningPiece = cand.items.some((i) =>
      /corset|satin|silk|mini-dress|stiletto|metallic/i.test(
        `${i.title} ${i.silhouette}`
      )
    );
    const glamAlignment = hasEveningPiece
      ? socialDna.glamSlider * 0.14
      : (100 - socialDna.glamSlider) * 0.14;

    const allPhotographedBonus = cand.items.every((i) => Boolean(i.imageUrl))
      ? 18
      : 0;

    // Natural-Language AI Vibe Collaborator Prompt Bonus
    let vibePromptBonus = 0;
    if (promptKeywords.length > 0) {
      const candHay = cand.items
        .map(
          (it) =>
            `${it.title} ${it.colorName} ${it.category} ${it.silhouette} ${it.vibes.join(
              " "
            )} ${it.occasions.join(" ")} ${it.fitMetadata?.fabricComposition || ""}`
        )
        .join(" ")
        .toLowerCase();
      for (const kw of promptKeywords) {
        if (candHay.includes(kw)) {
          vibePromptBonus += 16;
        }
      }
    }

    const unclampedScore =
      archWeight * 0.52 +
      harmony * 0.32 +
      paletteBonus +
      glamAlignment * 0.4 +
      allPhotographedBonus +
      vibePromptBonus;

    const rawMatch = Math.min(
      99,
      Math.max(
        76,
        Math.round(unclampedScore - vibePromptBonus * 0.72)
      )
    );

    const sig = cand.items
      .map((i) => i.id)
      .sort()
      .join("|");

    return {
      cand,
      harmony,
      arch,
      unclampedScore,
      dnaMatchPct: rawMatch,
      sig,
      tieBreak: ((idx * 37 + batchIndex * 17) % 29) * 0.1,
    };
  });

  scored.sort(
    (a, b) => b.unclampedScore + b.tieBreak - (a.unclampedScore + a.tieBreak)
  );

  // Deduplicate & select diverse consecutive heroes for this batch
  const localSeen = req.seenSignatures || new Set<string>();
  const picked: typeof scored = [];
  const recentHeroIds = new Set<string>();

  for (const entry of scored) {
    if (localSeen.has(entry.sig)) continue;
    const heroId = entry.cand.items[0]?.id || "";
    // Encourage consecutive outfit variety so scrolling never feels repetitive
    if (recentHeroIds.has(heroId) && scored.length > batchSize * 2) {
      continue;
    }
    localSeen.add(entry.sig);
    recentHeroIds.add(heroId);
    if (recentHeroIds.size >= 3) {
      recentHeroIds.clear();
    }
    picked.push(entry);
    if (picked.length >= batchSize) break;
  }

  // Infinite fallback: if user scrolled past every unique subset in the universe, cycle with fresh editorial mood styling
  if (picked.length < batchSize && scored.length > 0) {
    let cursor = (batchIndex * batchSize) % scored.length;
    while (picked.length < batchSize) {
      picked.push(scored[cursor % scored.length]);
      cursor++;
    }
  }

  return picked.map((entry, i) => {
    const seqNum = batchIndex * batchSize + i + 1;
    const items = entry.cand.items;
    const ownedItemIds = items
      .filter((it) => ownedSet.has(it.id))
      .map((it) => it.id);
    const netCostToBuy = items
      .filter((it) => !ownedSet.has(it.id))
      .reduce((s, it) => s + it.price, 0);
    const totalValue = items.reduce((s, it) => s + it.price, 0);
    const maxDeliveryDays = items.reduce(
      (m, it) => Math.max(m, it.estDeliveryDays || 4),
      0
    );

    const perItemSizes: Record<string, { usSize: string; supplierTag?: string }> =
      {};
    for (const it of items) {
      const fit = analyzeExactAvatarFit(avatar, it);
      perItemSizes[it.id] = {
        usSize: fit.recommendedSize,
        supplierTag: it.dropship?.cnSizeTagMap?.[fit.recommendedSize],
      };
    }

    const dropshipItems = items.filter(
      (it) => it.sourceType === "aliexpress_dropship" && it.dropship
    );
    const totalWholesaleCostUsd = Number(
      dropshipItems
        .reduce((s, it) => s + (it.dropship?.wholesaleCostUsd || 0), 0)
        .toFixed(2)
    );
    const totalStoreProfitUsd = Number(
      dropshipItems
        .reduce((s, it) => s + (it.dropship?.profitMarginUsd || 0), 0)
        .toFixed(2)
    );

    const cleanPrompt = customVibePrompt.trim();
    const moodPrefix = cleanPrompt
      ? cleanPrompt.slice(0, 26).replace(/\b\w/g, (c) => c.toUpperCase())
      : EDITORIAL_MOOD_PREFIXES[
          (seqNum - 1) % EDITORIAL_MOOD_PREFIXES.length
        ].trim();
    const archLabel = ARCHETYPE_META[entry.arch].shortTag;
    const socialHandle = socialDna.instagramHandle || "Your Socials";

    return {
      id: `ai-look-${batchIndex}-${i}-${items[0]?.id.slice(-5) || seqNum}`,
      sequenceNumber: seqNum,
      title: `${moodPrefix} • ${archLabel} #${String(seqNum).padStart(2, "0")}`,
      occasion: entry.cand.occasion,
      vibe: ARCHETYPE_META[entry.arch].label,
      items,
      ownedItemIds,
      netCostToBuy,
      totalValue,
      maxDeliveryDays,
      socialDnaMatchPct: entry.dnaMatchPct,
      colorHarmonyScore: entry.harmony,
      matchedArchetype: entry.arch,
      petiteProportionNote: buildPetiteProportionNote(
        items,
        avatar.heightInches,
        avatar.waistInches
      ),
      perItemSizes,
      dropshipPieceCount: dropshipItems.length,
      totalWholesaleCostUsd,
      totalStoreProfitUsd,
      stylistRationale: cleanPrompt
        ? `Styled for "${cleanPrompt}" × ${socialHandle} (${entry.dnaMatchPct}% ${archLabel} DNA): pairs ${items[0]?.title} with ${
            items[1]?.title || "studio accents"
          } (${entry.harmony}% color harmony).`
        : `Curated for ${socialHandle} (${entry.dnaMatchPct}% ${archLabel} DNA): pairs ${items[0]?.title} with ${
            items[1]?.title || "studio accents"
          } (${entry.harmony}% color harmony).`,
    };
  });
}

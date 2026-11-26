import { Product, SocialStyleArchetype, SocialStyleDNA } from "../types";

export interface ArchetypeMetadata {
  id: SocialStyleArchetype;
  label: string;
  shortTag: string;
  description: string;
  signatureColors: string[];
  vibeKeywords: string[];
}

export const ARCHETYPE_META: Record<SocialStyleArchetype, ArchetypeMetadata> = {
  siren_glam: {
    id: "siren_glam",
    label: "Siren Going-Out",
    shortTag: "Siren Glam",
    description:
      "Sculpted boned corsets, bias-cut crimson & emerald satin, lace-up backs, and metallic stilettos.",
    signatureColors: ["#C80815", "#4B3531", "#18181B", "#D4B475"],
    vibeKeywords: ["siren glam", "going out", "romantic", "party", "sparkle"],
  },
  model_off_duty: {
    id: "model_off_duty",
    label: "Model Off-Duty",
    shortTag: "Off-Duty",
    description:
      "Effortless SoHo street polish—fitted baby tees, vintage wide denim, sleek leather bags, and slingbacks.",
    signatureColors: ["#242325", "#6D8299", "#ECEAE4", "#6E1423"],
    vibeKeywords: ["model off-duty", "clean girl", "curated closet"],
  },
  old_money_tailored: {
    id: "old_money_tailored",
    label: "Old-Money Tailored",
    shortTag: "Old Money",
    description:
      "Ivory bouclé gold-button blazers, champagne pleated wide-leg trousers, and luminous silk midis.",
    signatureColors: ["#EFECE6", "#D9CEBE", "#1F5441", "#38241E"],
    vibeKeywords: ["old money tailored", "formal", "chic"],
  },
  clean_athleisure: {
    id: "clean_athleisure",
    label: "Clean Girl Active",
    shortTag: "Clean Girl",
    description:
      "Pilates-to-matcha monochrome sets, cropped fleeces, high-rise sculpt leggings, and retro runners.",
    signatureColors: ["#F4EFE6", "#DFC1B8", "#2B221F", "#EAECEF"],
    vibeKeywords: ["clean girl athleisure", "athletic", "active"],
  },
  coquette_romantic: {
    id: "coquette_romantic",
    label: "Coquette Romantic",
    shortTag: "Romantic",
    description:
      "Draped cowl necklines, champagne truffle silk, soft blush tones, and feminine mini silhouettes.",
    signatureColors: ["#C9B1A0", "#DFC1B8", "#C80815", "#ECEAE4"],
    vibeKeywords: ["coquette romantic", "soft romantic", "romantic"],
  },
  streetwear_luxe: {
    id: "streetwear_luxe",
    label: "Streetwear Luxe",
    shortTag: "Street Luxe",
    description:
      "Cropped metallic puffers, parachute cargos, belted knife-pleat micro minis, and high-contrast layering.",
    signatureColors: ["#1D1E22", "#C7CDD6", "#D8CFC2", "#555350"],
    vibeKeywords: ["streetwear luxe", "street"],
  },
};

export interface SocialPresetPersona {
  label: string;
  instagramHandle: string;
  tiktokHandle?: string;
  pinterestBoard?: string;
  bioCaptionSample: string;
  glamSlider: number;
  edgeSlider: number;
  palette: string[];
}

export const SAMPLE_SOCIAL_PERSONAS: SocialPresetPersona[] = [
  {
    label: "@mila.nyc (Siren × Off-Duty)",
    instagramHandle: "@mila.nyc",
    tiktokHandle: "@milastudio",
    pinterestBoard: "pinterest.com/mila/nyc-date-night-edits",
    bioCaptionSample:
      "NYC rooftop dinners, crimson corset minis, espresso satin, vintage denim & espresso martinis #sirenglam #modeloffduty #datenight",
    glamSlider: 76,
    edgeSlider: 72,
    palette: ["#C80815", "#4B3531", "#18181B", "#D9CEBE"],
  },
  {
    label: "@chloe.atelier (Old Money)",
    instagramHandle: "@chloe.atelier",
    tiktokHandle: "@chloewestvillage",
    pinterestBoard: "pinterest.com/chloe/old-money-capsule",
    bioCaptionSample:
      "Ivory tweed blazers, champagne tailored wide-leg trousers, emerald silk midi & gold hardware #oldmoney #quietluxury #tailored",
    glamSlider: 68,
    edgeSlider: 34,
    palette: ["#EFECE6", "#D9CEBE", "#1F5441", "#D4B475"],
  },
  {
    label: "@pilatesmatcha (Clean Girl)",
    instagramHandle: "@pilatesmatcha",
    tiktokHandle: "@cleanpilatesgirl",
    pinterestBoard: "pinterest.com/mila/clean-girl-morning",
    bioCaptionSample:
      "7am reformer pilates, iced oat matcha, cream cropped fleece, sculpt leggings & effortless off-duty layers #cleangirl #pilates #athleisure",
    glamSlider: 28,
    edgeSlider: 30,
    palette: ["#F4EFE6", "#DFC1B8", "#2B221F", "#6D8299"],
  },
  {
    label: "@sofiastreet (Street × Party)",
    instagramHandle: "@sofiastreet",
    tiktokHandle: "@sofiafits",
    pinterestBoard: "pinterest.com/sofia/downtown-street-luxe",
    bioCaptionSample:
      "SoHo late nights, pleated micro minis, silver metallic puffers, corset tops & cargo streetwear #streetwear #edgy #nightout",
    glamSlider: 64,
    edgeSlider: 88,
    palette: ["#1D1E22", "#C7CDD6", "#6E1423", "#D8CFC2"],
  },
];

const STORAGE_KEY = "gwo_social_style_dna_v1";

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/**
 * Extracts dominant aesthetic color swatches & brightness/saturation signals directly in the browser
 * from 1–4 uploaded Instagram grid screenshots or outfit inspiration photos using an offscreen canvas!
 */
export async function extractPaletteFromSocialPhotos(
  dataUrls: string[]
): Promise<{
  swatchesHex: string[];
  avgBrightness: number;
  warmRatio: number;
  vividRatio: number;
}> {
  if (typeof document === "undefined" || dataUrls.length === 0) {
    return {
      swatchesHex: ["#C80815", "#4B3531", "#EFECE6", "#18181B"],
      avgBrightness: 0.5,
      warmRatio: 0.55,
      vividRatio: 0.4,
    };
  }

  const buckets = new Map<
    string,
    { count: number; rSum: number; gSum: number; bSum: number }
  >();
  let totalPixels = 0;
  let lumSum = 0;
  let warmCount = 0;
  let vividCount = 0;

  for (const url of dataUrls.slice(0, 4)) {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
      await img.decode();

      const cv = document.createElement("canvas");
      cv.width = 48;
      cv.height = 48;
      const ctx = cv.getContext("2d");
      if (!ctx) continue;
      ctx.drawImage(img, 0, 0, 48, 48);
      const { data } = ctx.getImageData(0, 0, 48, 48);

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

        totalPixels++;
        lumSum += lum;
        if (r > b + 18) warmCount++;
        if (sat > 0.38) vividCount++;

        // Ignore pure white UI bars from IG screenshots
        if (lum > 0.95 && sat < 0.06) continue;

        const qr = Math.round(r / 42) * 42;
        const qg = Math.round(g / 42) * 42;
        const qb = Math.round(b / 42) * 42;
        const key = `${qr}:${qg}:${qb}`;
        const prev = buckets.get(key) || { count: 0, rSum: 0, gSum: 0, bSum: 0 };
        prev.count += 1;
        prev.rSum += r;
        prev.gSum += g;
        prev.bSum += b;
        buckets.set(key, prev);
      }
    } catch {
      // Skip unreadable image
    }
  }

  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((b) => rgbToHex(b.rSum / b.count, b.gSum / b.count, b.bSum / b.count));

  return {
    swatchesHex:
      sorted.length >= 3
        ? sorted
        : ["#C80815", "#4B3531", "#EFECE6", "#18181B"],
    avgBrightness: totalPixels > 0 ? lumSum / totalPixels : 0.5,
    warmRatio: totalPixels > 0 ? warmCount / totalPixels : 0.5,
    vividRatio: totalPixels > 0 ? vividCount / totalPixels : 0.35,
  };
}

/**
 * Synthesizes a complete 6-Archetype SocialStyleDNA profile from Instagram / TikTok / Pinterest handles,
 * bio/board keywords, interactive glam/edge sliders, and optional extracted IG grid photo palettes.
 */
export function buildSocialStyleDNA(params: {
  instagramHandle?: string;
  tiktokHandle?: string;
  pinterestBoard?: string;
  bioOrCaptionText?: string;
  glamSlider?: number;
  edgeSlider?: number;
  extractedPaletteHex?: string[];
  uploadedGridThumbs?: string[];
  likedProductIds?: string[];
  likedOutfitIds?: string[];
  photoSignals?: {
    avgBrightness: number;
    warmRatio: number;
    vividRatio: number;
  };
}): SocialStyleDNA {
  const ig = params.instagramHandle?.trim() || "@mila.nyc";
  const tt = params.tiktokHandle?.trim() || "";
  const pin = params.pinterestBoard?.trim() || "";
  const glam = Math.max(0, Math.min(100, params.glamSlider ?? 72));
  const edge = Math.max(0, Math.min(100, params.edgeSlider ?? 66));
  const text = `${ig} ${tt} ${pin} ${params.bioOrCaptionText || ""}`.toLowerCase();

  const scores: Record<SocialStyleArchetype, number> = {
    siren_glam: Math.round(35 + glam * 0.42 + edge * 0.25),
    model_off_duty: Math.round(58 + (100 - Math.abs(glam - 55)) * 0.22 + edge * 0.12),
    old_money_tailored: Math.round(42 + glam * 0.28 + (100 - edge) * 0.28),
    clean_athleisure: Math.round(30 + (100 - glam) * 0.52 + (100 - edge) * 0.18),
    coquette_romantic: Math.round(34 + glam * 0.24 + (100 - edge) * 0.42),
    streetwear_luxe: Math.round(32 + (100 - glam) * 0.22 + edge * 0.48),
  };

  // Keyword boosts from Instagram / TikTok / Pinterest handles & captions
  if (/(siren|corset|party|datenight|date-night|crimson|red|mini|club|glam|cocktail)/.test(text)) {
    scores.siren_glam += 24;
  }
  if (/(oldmoney|old-money|quietluxury|tweed|blazer|atelier|tailored|trouser|silk|reserve)/.test(text)) {
    scores.old_money_tailored += 26;
  }
  if (/(clean|pilates|matcha|gym|active|yoga|athleisure|morning|wellness)/.test(text)) {
    scores.clean_athleisure += 28;
  }
  if (/(coquette|romantic|blush|lace|floral|soft|slip|ribbon|brunch)/.test(text)) {
    scores.coquette_romantic += 24;
  }
  if (/(street|cargo|puffer|downtown|edgy|skate|sneaker|oversized|noir)/.test(text)) {
    scores.streetwear_luxe += 26;
  }
  if (/(nyc|soho|offduty|off-duty|model|denim|capsule|minimal)/.test(text)) {
    scores.model_off_duty += 20;
  }

  // Photo vision signal boosts when customer uploads IG grid screenshots
  if (params.photoSignals) {
    const { avgBrightness, vividRatio } = params.photoSignals;
    if (avgBrightness < 0.42) {
      scores.siren_glam += 12;
      scores.streetwear_luxe += 10;
    } else if (avgBrightness > 0.68) {
      scores.old_money_tailored += 12;
      scores.clean_athleisure += 10;
    }
    if (vividRatio > 0.45) {
      scores.siren_glam += 10;
    }
  }

  // Normalize to 25..99%
  const maxRaw = Math.max(...Object.values(scores), 1);
  (Object.keys(scores) as SocialStyleArchetype[]).forEach((k) => {
    scores[k] = Math.max(24, Math.min(99, Math.round((scores[k] / maxRaw) * 97)));
  });

  const ordered = (Object.keys(scores) as SocialStyleArchetype[]).sort(
    (a, b) => scores[b] - scores[a]
  );
  const primary = ordered[0];
  const secondary = ordered[1];

  const palette =
    params.extractedPaletteHex && params.extractedPaletteHex.length >= 3
      ? params.extractedPaletteHex.slice(0, 4)
      : [
          ...ARCHETYPE_META[primary].signatureColors.slice(0, 2),
          ...ARCHETYPE_META[secondary].signatureColors.slice(0, 2),
        ];

  const socialTagList = [ig, tt, pin ? "Pinterest" : ""]
    .filter(Boolean)
    .join(" + ");

  const styleSummary = `Synced with ${socialTagList}: ${scores[primary]}% ${ARCHETYPE_META[primary].label} × ${scores[secondary]}% ${ARCHETYPE_META[secondary].label} — tailored for your 5'2" petite proportions.`;

  return {
    instagramHandle: ig || undefined,
    tiktokHandle: tt || undefined,
    pinterestBoard: pin || undefined,
    archetypeScores: scores,
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    extractedPaletteHex: palette,
    glamSlider: glam,
    edgeSlider: edge,
    likedProductIds: params.likedProductIds || [],
    likedOutfitIds: params.likedOutfitIds || [],
    uploadedGridThumbs: params.uploadedGridThumbs,
    styleSummary,
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultSocialStyleDNA(): SocialStyleDNA {
  const preset = SAMPLE_SOCIAL_PERSONAS[0];
  return buildSocialStyleDNA({
    instagramHandle: preset.instagramHandle,
    tiktokHandle: preset.tiktokHandle,
    pinterestBoard: preset.pinterestBoard,
    bioOrCaptionText: preset.bioCaptionSample,
    glamSlider: preset.glamSlider,
    edgeSlider: preset.edgeSlider,
    extractedPaletteHex: preset.palette,
  });
}

/**
 * Real-time reinforcement learning step when a customer taps "♥ Love This Vibe" on any AI outfit!
 */
export function reinforceSocialDnaFromOutfit(
  current: SocialStyleDNA,
  outfitId: string,
  items: Product[],
  matchedArchetype: SocialStyleArchetype
): SocialStyleDNA {
  const alreadyLiked = current.likedOutfitIds.includes(outfitId);
  const nextLikedOutfits = alreadyLiked
    ? current.likedOutfitIds.filter((id) => id !== outfitId)
    : [...current.likedOutfitIds, outfitId];

  const nextLikedProducts = alreadyLiked
    ? current.likedProductIds
    : Array.from(
        new Set([...current.likedProductIds, ...items.map((i) => i.id)])
      );

  const nextScores = { ...current.archetypeScores };
  if (!alreadyLiked) {
    nextScores[matchedArchetype] = Math.min(99, nextScores[matchedArchetype] + 6);
  }

  const ordered = (Object.keys(nextScores) as SocialStyleArchetype[]).sort(
    (a, b) => nextScores[b] - nextScores[a]
  );
  const primary = ordered[0];
  const secondary = ordered[1];

  const newColors = items
    .map((i) => i.colorHex)
    .filter((c) => c && c.startsWith("#"));
  const mergedPalette = Array.from(
    new Set([...newColors.slice(0, 2), ...current.extractedPaletteHex])
  ).slice(0, 4);

  return {
    ...current,
    archetypeScores: nextScores,
    primaryArchetype: primary,
    secondaryArchetype: secondary,
    extractedPaletteHex: mergedPalette,
    likedProductIds: nextLikedProducts,
    likedOutfitIds: nextLikedOutfits,
    styleSummary: `AI adapted to ${nextLikedOutfits.length} liked look${
      nextLikedOutfits.length === 1 ? "" : "s"
    } (${current.instagramHandle || "Your Socials"}): ${
      ARCHETYPE_META[primary].label
    } × ${ARCHETYPE_META[secondary].label}.`,
    updatedAt: new Date().toISOString(),
  };
}

export function loadStoredSocialStyleDNA(): SocialStyleDNA | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SocialStyleDNA;
  } catch {
    return null;
  }
}

export function saveStoredSocialStyleDNA(dna: SocialStyleDNA): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dna));
  } catch {
    // Ignore storage quota error
  }
}

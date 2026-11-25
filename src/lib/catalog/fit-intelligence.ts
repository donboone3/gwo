import {
  FabricStretchLevel,
  FitRating,
  GarmentCategory,
  GarmentCutType,
  GarmentSilhouette,
  HemLandingType,
  Product,
  ProductFitMetadata,
  ProductGalleryAngle,
  SizeMeasurementSpec,
  StoreModelStats,
  UserProfile,
} from "../types";

export type ZoneFeel =
  | "too_tight"
  | "sculpted_snug"
  | "tailored_ideal"
  | "relaxed_skim"
  | "oversized_roomy";

export interface ZoneFitDetail {
  zone: "Bust" | "Waist" | "Hips";
  avatarInches: number;
  garmentRange: string;
  easeInches: number;
  feel: ZoneFeel;
  feelLabel: string;
  /** 0 = tightest left, 50 = spot-on center, 100 = roomiest right */
  meterPct: number;
  detailNote: string;
}

export interface AvatarExactFitReport {
  recommendedSize: string;
  inspectedSize: string;
  confidencePct: number;
  headlineVerdict: string;
  alternateOption?: {
    size: string;
    note: string;
  };
  zones: ZoneFitDetail[];
  lengthComparison: {
    modelSummary: string;
    proportionNote: string;
    heightDiffInches: number;
  };
  fabricSummary: string;
  extractedFactsCount: number;
}

/**
 * Upgrades thumbnail query params on Shopify, Imgix, Demandware, and Sanity CDNs
 * so scraped gallery images render in crisp 1000-1200px HD rather than 100px icons.
 */
export function upgradeCdnImageResolution(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  let upgraded = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;

  // Upgrade Shopify filename suffixes like _100x100.jpg or _small.jpg -> _1200x.jpg
  upgraded = upgraded.replace(
    /_(\d{2,3}x\d{0,3}|small|compact|medium|thumb|grande)\.(jpe?g|png|webp)/i,
    "_1200x.$2"
  );

  try {
    const u = new URL(upgraded);
    if (
      /shopify\.com|imgix\.net|vuoriclothing|outdoorvoices|reformation|princesspolly|aritzia/i.test(
        u.hostname
      )
    ) {
      if (u.searchParams.has("width")) {
        const w = Number(u.searchParams.get("width") || 0);
        if (w > 0 && w < 960) u.searchParams.set("width", "1200");
        u.searchParams.delete("height");
        u.searchParams.delete("crop");
      }
      if (u.searchParams.has("w")) {
        const w = Number(u.searchParams.get("w") || 0);
        if (w > 0 && w < 960) u.searchParams.set("w", "1200");
        u.searchParams.delete("h");
      }
      if (u.searchParams.has("h") && !u.searchParams.has("w")) {
        const h = Number(u.searchParams.get("h") || 0);
        if (h > 0 && h < 960) {
          u.searchParams.delete("h");
          u.searchParams.set("w", "1200");
        }
      }
      upgraded = u.toString();
    }
  } catch {
    // Keep regex-upgraded URL if URL constructor fails
  }

  return upgraded;
}

/**
 * Isolates the primary PDP description & fit block from full-page scraped markdown
 * so footer cross-sells ("Complete the Look", "You May Also Like") don't pollute fit notes.
 */
export function isolatePrimaryPdpText(fullText: string, title = ""): string {
  if (!fullText) return "";
  let text = fullText.replace(/\r\n/g, "\n");

  // Jump near main product heading if huge mega-menu precedes it
  const skipGalleryIdx = text.search(/skip past product gallery/i);
  if (skipGalleryIdx >= 0) {
    text = text.slice(skipGalleryIdx);
  } else if (title.length >= 5) {
    const firstWord = title.split(/\s+/)[0];
    const h1Idx = text.search(new RegExp(`#\\s+.*${firstWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
    if (h1Idx > 400) {
      text = text.slice(Math.max(0, h1Idx - 120));
    }
  }

  // Cut off before cross-sell carousels / review widgets
  const cutoffMatch = text.search(
    /\n(?:#+\s*)?(?:complete the look|you may also like|customers also bought|recently viewed|pair it with|wear it with|customer reviews|write a review|similar styles)/i
  );
  if (cutoffMatch > 220) {
    text = text.slice(0, cutoffMatch);
  }

  return text.slice(0, 9000);
}

export function parseStoreModelStats(pdpText: string): StoreModelStats | undefined {
  const clean = pdpText.replace(/\*\*/g, "");

  // Split by newlines AND sentence boundaries before normalizing spaces so markdown headings don't merge
  const sentences = clean.split(/\n+|(?<=[.!•])\s+|\s+\|\s+/);
  let matchedLine = "";
  let heightInches: number | undefined;
  let heightDisplay: string | undefined;
  let wornSize: string | undefined;
  let bustInches: number | undefined;
  let waistInches: number | undefined;
  let hipsInches: number | undefined;

  for (const rawLine of sentences) {
    const line = rawLine.trim();
    if (line.length < 8 || line.length > 260) continue;
    if (!/\bmodel\b|\bwearing\s+(?:a\s+)?size\b|\bwears\s+(?:a\s+)?size\b/i.test(line)) {
      continue;
    }

    // Height in feet/inches: 5'8", 5' 9", 5ft 8in
    const ftIn = line.match(/\b([456])\s*(?:'|’|ft\.?)\s*(\d{1,2})\s*(?:"|”|''|in\.?)?/i);
    if (ftIn) {
      const ft = Number(ftIn[1]);
      const inch = Number(ftIn[2]);
      if (inch <= 11) {
        heightInches = ft * 12 + inch;
        heightDisplay = `${ft}'${inch}"`;
      }
    } else {
      const cmMatch = line.match(/\b(1[5-8]\d)\s*cm\b/i);
      if (cmMatch) {
        const cm = Number(cmMatch[1]);
        heightInches = Math.round(cm / 2.54);
        heightDisplay = `${Math.floor(heightInches / 12)}'${heightInches % 12}" (${cm}cm)`;
      }
    }

    // Size worn by model
    const szMatch = line.match(
      /(?:wears?|wearing|\/|,)\s*(?:a\s+)?(?:size\s+)?\b(XXS|XS|S|M|L|XL|XXL|Small|Medium|Large|Extra\s+Small|US\s*\d{1,2})\b/i
    );
    if (szMatch) {
      const rawSz = szMatch[1].toUpperCase().replace(/\s+/g, " ");
      const mapWord: Record<string, string> = {
        "EXTRA SMALL": "XS",
        SMALL: "S",
        MEDIUM: "M",
        LARGE: "L",
        "US 0": "XS",
        "US 2": "XS",
        "US 4": "S",
        "US 6": "M",
        "US 8": "M",
        "US 10": "L",
      };
      wornSize = mapWord[rawSz] || rawSz;
    }

    // Optional model bust/waist/hips if explicitly stated
    const bMatch = line.match(/(?:bust[:\s]*(\d{2}(?:\.\d+)?)|(\d{2}(?:\.\d+)?)["”]?\s*bust)/i);
    const wMatch = line.match(/(?:waist[:\s]*(\d{2}(?:\.\d+)?)|(\d{2}(?:\.\d+)?)["”]?\s*waist)/i);
    const hMatch = line.match(/(?:hips?[:\s]*(\d{2}(?:\.\d+)?)|(\d{2}(?:\.\d+)?)["”]?\s*hips?)/i);

    if (bMatch) bustInches = Number(bMatch[1] || bMatch[2]);
    if (wMatch) waistInches = Number(wMatch[1] || wMatch[2]);
    if (hMatch) hipsInches = Number(hMatch[1] || hMatch[2]);

    if (heightInches || wornSize) {
      matchedLine = line
        .replace(/\s*#+.*$/, "")
        .replace(/^[*•\-–\s]+/, "")
        .replace(/[*•\-–\s]+$/, "")
        .slice(0, 140);
      break;
    }
  }

  if (!heightInches && !wornSize && !bustInches && !waistInches) {
    return undefined;
  }

  return {
    rawText: matchedLine || undefined,
    heightInches,
    heightDisplay,
    wornSize,
    bustInches,
    waistInches,
    hipsInches,
  };
}

export function parseFabricAndStretch(
  pdpText: string,
  silhouette: GarmentSilhouette
): {
  fabricComposition?: string;
  elastanePct?: number;
  stretchLevel: FabricStretchLevel;
} {
  const clean = pdpText.replace(/\*\*/g, "");

  // Match exact fiber composition tokens like "90% Cotton / 10% Elastane" or "89% Recycled Polyester, 11% Elastane"
  const fiberUnit =
    "\\d{1,3}%\\s*(?:recycled\\s+|organic\\s+|pima\\s+|supima\\s+|merino\\s+|mulberry\\s+)?(?:cotton|polyester|nylon|elastane|spandex|lycra|silk|linen|wool|cashmere|viscose|rayon|modal|tencel|polyamide|acrylic|leather|denim)";
  const fiberRegex = new RegExp(
    `\\b(${fiberUnit}(?:(?:\\s*[,/|•]\\s*|\\s+and\\s+)${fiberUnit})*)\\b`,
    "gi"
  );

  let fabricComposition: string | undefined;
  let elastanePct: number | undefined;

  const m = fiberRegex.exec(clean);
  if (m) {
    fabricComposition = m[1].trim().replace(/\s+/g, " ");
    const stretchFiber = fabricComposition.match(
      /(\d{1,2}(?:\.\d+)?)%\s*(?:elastane|spandex|lycra)/i
    );
    if (stretchFiber) {
      elastanePct = Number(stretchFiber[1]);
    }
  }

  let stretchLevel: FabricStretchLevel = "medium";

  if (
    (elastanePct !== undefined && elastanePct >= 8) ||
    /\b(4-way stretch|four-way stretch|high stretch|super stretchy|ultra-stretch|fits everybody|second-skin stretch)\b/i.test(
      clean
    )
  ) {
    stretchLevel = "high";
  } else if (
    (elastanePct !== undefined && elastanePct >= 3) ||
    /\b(stretchy|medium stretch|added stretch|ribbed knit|cotton jersey|jersey knit|modal|french terry)\b/i.test(
      clean
    )
  ) {
    stretchLevel = "medium";
  } else if (
    (elastanePct !== undefined && elastanePct >= 1) ||
    /\b(comfort stretch|slight stretch|hint of stretch|low stretch)\b/i.test(clean)
  ) {
    stretchLevel = "low";
  } else if (
    /\b(non-stretch|no stretch|rigid denim|zero stretch)\b/i.test(clean) ||
    (fabricComposition &&
      /^100%\s*(cotton|linen|silk|wool|leather|polyester|viscose|rayon|tencel)/i.test(
        fabricComposition
      ) &&
      !/jersey|knit|rib/i.test(clean))
  ) {
    stretchLevel = "rigid";
  } else {
    // Intelligent silhouette fallback when fabric percentages aren't printed
    if (silhouette === "leggings" || silhouette === "sports-bra") {
      stretchLevel = "high";
    } else if (
      silhouette === "baby-tee" ||
      silhouette === "crop-tank" ||
      silhouette === "cardigan" ||
      silhouette === "oversized-hoodie"
    ) {
      stretchLevel = "medium";
    } else if (silhouette === "wide-denim" || silhouette === "cropped-jacket") {
      stretchLevel = "rigid";
    } else {
      stretchLevel = "low";
    }
  }

  return { fabricComposition, elastanePct, stretchLevel };
}

export function buildBrandCalibratedSizeChart(
  brand: string,
  cutType: GarmentCutType,
  storeFitTendency: FitRating
): Record<string, SizeMeasurementSpec> {
  const b = brand.toLowerCase();

  // Base chart selection by brand family
  let base: Record<string, SizeMeasurementSpec>;

  if (/skims|alo|lululemon|gymshark|outdoor voices/.test(b)) {
    // Sculpting / activewear chart
    base = {
      XS: { bustMin: 30.5, bustMax: 32.5, waistMin: 24, waistMax: 25.5, hipsMin: 34, hipsMax: 35.5 },
      S: { bustMin: 32.5, bustMax: 34.5, waistMin: 25.5, waistMax: 27.5, hipsMin: 36, hipsMax: 37.5 },
      M: { bustMin: 34.5, bustMax: 36.5, waistMin: 27.5, waistMax: 29.5, hipsMin: 38, hipsMax: 39.5 },
      L: { bustMin: 37, bustMax: 39.5, waistMin: 30, waistMax: 32.5, hipsMin: 40, hipsMax: 42.5 },
      XL: { bustMin: 40, bustMax: 43, waistMin: 33, waistMax: 36, hipsMin: 43, hipsMax: 46 },
    };
  } else if (/princess polly|zara|bershka|revolve|meshki|oh polly|shein/.test(b)) {
    // Junior-contemporary / boutique chart (runs ~0.5" narrower in waist & hips)
    base = {
      XS: { bustMin: 30.5, bustMax: 32, waistMin: 23.5, waistMax: 24.75, hipsMin: 33.5, hipsMax: 35 },
      S: { bustMin: 32, bustMax: 33.75, waistMin: 25, waistMax: 26.5, hipsMin: 35, hipsMax: 36.75 },
      M: { bustMin: 34, bustMax: 35.75, waistMin: 26.75, waistMax: 28.25, hipsMin: 37, hipsMax: 38.75 },
      L: { bustMin: 36, bustMax: 38.5, waistMin: 28.5, waistMax: 31, hipsMin: 39, hipsMax: 41.5 },
      XL: { bustMin: 38.5, bustMax: 41.5, waistMin: 31.5, waistMax: 34, hipsMin: 41.5, hipsMax: 44.5 },
    };
  } else if (/reformation|aritzia|realisation|anthropologie|abercrombie/.test(b)) {
    // Contemporary tailored chart
    base = {
      XS: { bustMin: 31, bustMax: 32.5, waistMin: 24, waistMax: 25.25, hipsMin: 34.5, hipsMax: 35.75 },
      S: { bustMin: 32.75, bustMax: 34.5, waistMin: 25.75, waistMax: 27.25, hipsMin: 36.25, hipsMax: 37.75 },
      M: { bustMin: 35, bustMax: 36.75, waistMin: 28, waistMax: 29.75, hipsMin: 38.5, hipsMax: 40.25 },
      L: { bustMin: 37.5, bustMax: 40, waistMin: 30.5, waistMax: 33, hipsMin: 41, hipsMax: 43.5 },
      XL: { bustMin: 40.5, bustMax: 43.5, waistMin: 33.5, waistMax: 36.5, hipsMin: 44, hipsMax: 47 },
    };
  } else {
    // Standard athletic / everyday US women's chart (Nike, Vuori, Levi's, etc.)
    base = {
      XS: { bustMin: 30.5, bustMax: 32.5, waistMin: 24, waistMax: 25.5, hipsMin: 34, hipsMax: 35.5 },
      S: { bustMin: 32.75, bustMax: 35, waistMin: 26, waistMax: 28, hipsMin: 36, hipsMax: 38 },
      M: { bustMin: 35.25, bustMax: 37.5, waistMin: 28.25, waistMax: 30.5, hipsMin: 38.25, hipsMax: 40.5 },
      L: { bustMin: 38, bustMax: 40.5, waistMin: 31, waistMax: 33.5, hipsMin: 41, hipsMax: 43.5 },
      XL: { bustMin: 41, bustMax: 44, waistMin: 34, waistMax: 37, hipsMin: 44, hipsMax: 47 },
    };
  }

  // Adjust actual garment ease if store explicitly flags runs_small / runs_large or oversized cut
  const delta =
    storeFitTendency === "runs_small"
      ? -0.75
      : storeFitTendency === "runs_large"
      ? 1.0
      : cutType === "oversized"
      ? 0.75
      : 0;

  if (delta === 0) return base;

  const adjusted: Record<string, SizeMeasurementSpec> = {};
  for (const [sz, spec] of Object.entries(base)) {
    adjusted[sz] = {
      bustMin: spec.bustMin !== undefined ? Number((spec.bustMin + delta).toFixed(2)) : undefined,
      bustMax: spec.bustMax !== undefined ? Number((spec.bustMax + delta).toFixed(2)) : undefined,
      waistMin: spec.waistMin !== undefined ? Number((spec.waistMin + delta).toFixed(2)) : undefined,
      waistMax: spec.waistMax !== undefined ? Number((spec.waistMax + delta).toFixed(2)) : undefined,
      hipsMin: spec.hipsMin !== undefined ? Number((spec.hipsMin + delta).toFixed(2)) : undefined,
      hipsMax: spec.hipsMax !== undefined ? Number((spec.hipsMax + delta).toFixed(2)) : undefined,
    };
  }
  return adjusted;
}

export function extractProductFitProfile(params: {
  rawText: string;
  title: string;
  brand: string;
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
  galleryImages?: ProductGalleryAngle[];
}): {
  fitMetadata: ProductFitMetadata;
  calibratedChart: Record<string, SizeMeasurementSpec>;
} {
  const { rawText, title, brand, silhouette, galleryImages } = params;
  const primaryText = isolatePrimaryPdpText(rawText, title);
  const combined = `${title}\n${primaryText}`;

  const modelStats = parseStoreModelStats(primaryText);
  const { fabricComposition, elastanePct, stretchLevel } = parseFabricAndStretch(
    combined,
    silhouette
  );

  // Store fit tendency
  let storeFitTendency: FitRating = "true_to_size";
  if (
    /\b(runs?\s+small|size\s+up|fits?\s+small|order\s+one\s+size\s+up|we\s+recommend\s+sizing\s+up)\b/i.test(
      primaryText
    )
  ) {
    storeFitTendency = "runs_small";
  } else if (
    /\b(runs?\s+(?:large|big)|size\s+down|fits?\s+large|generous\s+fit|we\s+recommend\s+sizing\s+down)\b/i.test(
      primaryText
    )
  ) {
    storeFitTendency = "runs_large";
  }

  // Garment cut
  let cutType: GarmentCutType = "regular";
  if (
    /\b(body-hugging|second-skin|bodycon|compression|sculpting|form-fitting|tight\s+fit|skin-tight)\b/i.test(
      combined
    ) ||
    silhouette === "leggings" ||
    silhouette === "sports-bra"
  ) {
    cutType = "body-hugging";
  } else if (
    /\b(oversized|boyfriend|slouchy|boxy|baggy|roomy\s+fit|drop[\s-]shoulder)\b/i.test(
      combined
    ) ||
    silhouette === "oversized-hoodie"
  ) {
    cutType = "oversized";
  } else if (
    /\b(fitted|slim\s+fit|tailored|baby\s+tee|shrunken|skims\s+the\s+body|close\s+fit)\b/i.test(
      combined
    ) ||
    silhouette === "baby-tee" ||
    silhouette === "crop-tank"
  ) {
    cutType = "fitted";
  }

  // Hem landing
  let hemLanding: HemLandingType | undefined;
  if (/\b(cropped|crop\s+length|above\s+the\s+waist|midriff)\b/i.test(combined)) {
    hemLanding = "cropped";
  } else if (
    /\b(hits?\s+(?:(?:right|just)\s+)?(?:at|below)\s+(?:the\s+)?natural\s+waist|waist[\s-]length|at\s+(?:the\s+)?natural\s+waist)\b/i.test(
      combined
    )
  ) {
    hemLanding = "natural-waist";
  } else if (/\b(hits?\s+(?:at|below)\s+(?:the\s+)?hip|hip[\s-]length)\b/i.test(combined)) {
    hemLanding = "hip";
  } else if (/\b(maxi|floor[\s-]length)\b/i.test(combined)) {
    hemLanding = "maxi";
  } else if (/\b(midi|mid[\s-]calf)\b/i.test(combined)) {
    hemLanding = "midi";
  } else if (/\b(mini|micro[\s-]mini|mid[\s-]thigh)\b/i.test(combined)) {
    hemLanding = "mini";
  } else if (/\b(7\/8|ankle[\s-]length|hits?\s+above\s+ankle)\b/i.test(combined)) {
    hemLanding = "ankle";
  } else if (/\b(full[\s-]length|puddle\s+hem)\b/i.test(combined)) {
    hemLanding = "full-length";
  }

  // Inseam extraction
  let inseamInches: number | undefined;
  const inseamMatch = primaryText.match(
    /(?:(\d{2}(?:\.\d+)?)\s*(?:"|”|''|in(?:ch(?:es)?)?)\s+inseam|inseam[:\s]+(\d{2}(?:\.\d+)?)\s*(?:"|”|in)?)/i
  );
  if (inseamMatch) {
    const val = Number(inseamMatch[1] || inseamMatch[2]);
    if (val >= 20 && val <= 37) inseamInches = val;
  }

  // Clean description summary & fit bullet notes (strictly reject nav links, prices, and cross-sell cards)
  const lines = primaryText
    .split(/\n+/)
    .map((l) =>
      l
        .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/\\+/g, "")
        .replace(/^[*•\-–#>\s]+/, "")
        .trim()
    )
    .filter(
      (l) =>
        l.length >= 16 &&
        l.length <= 320 &&
        !/https?:\/\/|\]\(|refslotid|original price|sale price|\$\d+|skip to|select a? size|size guide|waitlist|add to bag|sign in|shipping & returns|sort by|details fit|how was the fit|out of 5/i.test(
          l
        )
    );

  const descriptionSummary = lines.find(
    (l) =>
      l.length >= 48 &&
      /[a-z]{4,}.*\./.test(l) &&
      !/^model is/i.test(l)
  );

  const fitNotes: string[] = [];
  for (const l of lines) {
    if (
      l !== descriptionSummary &&
      l.length <= 120 &&
      /\b(fits?\s+true|true\s+to\s+size|runs?\s+small|runs?\s+large|hits?\s+(?:right\s+|just\s+)?(?:at|below|above)|natural\s+waist|cropped|relaxed\s+fit|slim\s+fit|fitted\s+crew|body-hugging|4-way\s+stretch|moisture[\s-]wicking|inseam|high-rise|mid-rise|low-rise|built-in|adjustable\s+straps)\b/i.test(
        l
      ) &&
      !fitNotes.includes(l)
    ) {
      fitNotes.push(l);
      if (fitNotes.length >= 4) break;
    }
  }

  const calibratedChart = buildBrandCalibratedSizeChart(
    brand,
    cutType,
    storeFitTendency
  );

  return {
    fitMetadata: {
      descriptionSummary,
      fitNotes,
      fabricComposition,
      elastanePct,
      stretchLevel,
      cutType,
      storeFitTendency,
      hemLanding,
      inseamInches,
      modelStats,
      galleryImages,
    },
    calibratedChart,
  };
}

function evaluateSingleZone(params: {
  zone: "Bust" | "Waist" | "Hips";
  avatarVal: number;
  min?: number;
  max?: number;
  stretchLevel: FabricStretchLevel;
  cutType: GarmentCutType;
}): ZoneFitDetail {
  const { zone, avatarVal, min = avatarVal - 1, max = avatarVal + 1, stretchLevel, cutType } = params;
  const mid = (min + max) / 2;

  // Stretch allowance: high-stretch knits comfortably expand +2.2" past unstretched spec
  const stretchGive =
    stretchLevel === "high"
      ? 2.25
      : stretchLevel === "medium"
      ? 1.15
      : stretchLevel === "low"
      ? 0.45
      : 0;

  // Signed ease relative to spec midpoint (positive = roomier than midpoint, negative = body larger than midpoint)
  const rawEase = Number((mid - avatarVal).toFixed(2));
  const rangeStr = `${min}"–${max}"`;

  let feel: ZoneFeel;
  let feelLabel: string;
  let detailNote: string;

  if (avatarVal > max + stretchGive) {
    feel = "too_tight";
    const deficit = (avatarVal - max).toFixed(2).replace(/\.00$/, "");
    feelLabel =
      stretchLevel === "rigid"
        ? `Too Tight (-${deficit}" Rigid)`
        : `Pulls Tight (-${deficit}")`;
    detailNote =
      stretchLevel === "rigid"
        ? `Non-stretch fabric maxes at ${max}"—will pinch your ${avatarVal}" ${zone.toLowerCase()}. Size up.`
        : `Exceeds comfortable stretch range (${rangeStr}) at your ${avatarVal}" ${zone.toLowerCase()}.`;
  } else if (avatarVal > max) {
    feel = "sculpted_snug";
    feelLabel = "Sculpted Stretch Hug";
    detailNote = `Snug contour fit—${stretchLevel} stretch expands smoothly from ${max}" to hug your ${avatarVal}" ${zone.toLowerCase()}.`;
  } else if (avatarVal >= min - 0.5 && avatarVal <= max) {
    feel = "tailored_ideal";
    feelLabel =
      Math.abs(rawEase) <= 0.6 ? `Exact ${avatarVal}" Match` : "Spot-On Tailored";
    detailNote =
      cutType === "body-hugging"
        ? `Clean second-skin contour right inside the ${rangeStr} ${zone.toLowerCase()} spec.`
        : `Sits naturally at your ${avatarVal}" ${zone.toLowerCase()} (${rangeStr} spec) with zero pulling.`;
  } else if (min - avatarVal <= 2.25) {
    feel = "relaxed_skim";
    const room = (mid - avatarVal).toFixed(1);
    feelLabel = `Easy Skim (+${room}")`;
    detailNote = `Gives ~${room}" of effortless drape and layering ease across your ${avatarVal}" ${zone.toLowerCase()}.`;
  } else {
    feel = "oversized_roomy";
    const room = (mid - avatarVal).toFixed(1);
    feelLabel = `Roomy Drape (+${room}")`;
    detailNote = `Generous +${room}" slouchy volume at your ${avatarVal}" ${zone.toLowerCase()} (${rangeStr} spec).`;
  }

  // Map rawEase (-4" tight .. +4.5" roomy) onto 8..94% meter
  const normalized = Math.max(6, Math.min(94, Math.round(50 + rawEase * 10.5)));

  return {
    zone,
    avatarInches: avatarVal,
    garmentRange: rangeStr,
    easeInches: rawEase,
    feel,
    feelLabel,
    meterPct: normalized,
    detailNote,
  };
}

/**
 * Computes an exact, zone-by-zone (Bust / Waist / Hips + Model Height Proportion) fit report
 * comparing the customer's exact avatar measurements against the scraped product & store model.
 */
export function analyzeExactAvatarFit(
  avatar: Pick<
    UserProfile,
    "bustInches" | "waistInches" | "hipsInches" | "heightInches" | "shoeSize"
  >,
  product: Product,
  inspectedSizeOverride?: string
): AvatarExactFitReport {
  const meta: ProductFitMetadata =
    product.fitMetadata ||
    extractProductFitProfile({
      rawText: product.title,
      title: product.title,
      brand: product.brand,
      category: product.category,
      silhouette: product.silhouette,
    }).fitMetadata;

  const sizes =
    product.availableSizes && product.availableSizes.length > 0
      ? product.availableSizes
      : ["XS", "S", "M", "L"];

  if (product.category === "shoes") {
    const recShoe = sizes.includes(avatar.shoeSize) ? avatar.shoeSize : sizes[2] || "7.5";
    const inspected = inspectedSizeOverride || recShoe;
    return {
      recommendedSize: recShoe,
      inspectedSize: inspected,
      confidencePct: 95,
      headlineVerdict:
        inspected === recShoe
          ? `Exact match for your saved US ${avatar.shoeSize} foot profile.`
          : `US ${inspected} is ${Number(inspected) > Number(recShoe) ? "roomier" : "snugger"} than your US ${avatar.shoeSize} profile.`,
      zones: [],
      lengthComparison: {
        modelSummary: `True-to-size footwear last for ${product.brand}.`,
        proportionNote: `Matched directly to US ${avatar.shoeSize}.`,
        heightDiffInches: 0,
      },
      fabricSummary: meta.fabricComposition || "Standard footwear upper & cushioned sole",
      extractedFactsCount: 2,
    };
  }

  const chart =
    product.sizeChartInches && Object.keys(product.sizeChartInches).length > 0
      ? product.sizeChartInches
      : buildBrandCalibratedSizeChart(
          product.brand,
          meta.cutType,
          meta.storeFitTendency
        );

  const relevantZones: Array<"Bust" | "Waist" | "Hips"> =
    product.category === "top" || product.category === "outerwear"
      ? ["Bust", "Waist"]
      : product.category === "bottom"
      ? ["Waist", "Hips"]
      : ["Bust", "Waist", "Hips"];

  // Score every available size for this exact avatar!
  const scoredSizes = sizes
    .filter((sz) => Boolean(chart[sz]))
    .map((sz) => {
      const spec = chart[sz];
      const zoneDetails = relevantZones.map((z) =>
        evaluateSingleZone({
          zone: z,
          avatarVal:
            z === "Bust"
              ? avatar.bustInches
              : z === "Waist"
              ? avatar.waistInches
              : avatar.hipsInches,
          min:
            z === "Bust"
              ? spec.bustMin
              : z === "Waist"
              ? spec.waistMin
              : spec.hipsMin,
          max:
            z === "Bust"
              ? spec.bustMax
              : z === "Waist"
              ? spec.waistMax
              : spec.hipsMax,
          stretchLevel: meta.stretchLevel,
          cutType: meta.cutType,
        })
      );

      let penalty = 0;
      for (const zd of zoneDetails) {
        const w = zd.zone === "Waist" ? 2.1 : zd.zone === "Bust" ? 1.5 : 1.6;
        if (zd.feel === "too_tight") {
          penalty += 35 + Math.abs(zd.easeInches) * 8 * w;
        } else if (zd.feel === "sculpted_snug") {
          penalty += meta.cutType === "body-hugging" ? 1.5 : 5.5;
        } else if (zd.feel === "tailored_ideal") {
          penalty += Math.abs(zd.easeInches) * 1.2 * w;
        } else if (zd.feel === "relaxed_skim") {
          penalty +=
            meta.cutType === "oversized"
              ? Math.abs(zd.easeInches - 1.5) * 1.1
              : Math.abs(zd.easeInches) * 1.9;
        } else {
          penalty += 14 + Math.abs(zd.easeInches) * 3.2;
        }
      }

      return { size: sz, penalty, zoneDetails };
    });

  scoredSizes.sort((a, b) => a.penalty - b.penalty);
  const best = scoredSizes[0] || {
    size: "S",
    penalty: 0,
    zoneDetails: [],
  };
  const second = scoredSizes[1];

  const recommendedSize = best.size;
  const inspectedSize =
    inspectedSizeOverride && chart[inspectedSizeOverride]
      ? inspectedSizeOverride
      : recommendedSize;

  const inspectedEntry =
    scoredSizes.find((s) => s.size === inspectedSize) || best;

  // Build dynamic tailor headline for whichever size the shopper is currently clicking!
  const hasTooTight = inspectedEntry.zoneDetails.some((z) => z.feel === "too_tight");
  const allRoomy = inspectedEntry.zoneDetails.every(
    (z) => z.feel === "oversized_roomy" || z.feel === "relaxed_skim"
  );

  let headlineVerdict: string;
  if (inspectedSize === recommendedSize) {
    const waistZone = inspectedEntry.zoneDetails.find((z) => z.zone === "Waist");
    const bustZone = inspectedEntry.zoneDetails.find((z) => z.zone === "Bust");
    const hipsZone = inspectedEntry.zoneDetails.find((z) => z.zone === "Hips");
    if (waistZone && bustZone) {
      headlineVerdict = `Best Fit (Size ${recommendedSize}): ${waistZone.feelLabel.toLowerCase()} at your ${avatar.waistInches}" waist & ${bustZone.feelLabel.toLowerCase()} across your ${avatar.bustInches}" bust.`;
    } else if (waistZone && hipsZone) {
      headlineVerdict = `Best Fit (Size ${recommendedSize}): ${waistZone.feelLabel.toLowerCase()} at your ${avatar.waistInches}" waist & ${hipsZone.feelLabel.toLowerCase()} over your ${avatar.hipsInches}" hips.`;
    } else {
      headlineVerdict = `Size ${recommendedSize} is your highest-accuracy match for ${avatar.bustInches}" • ${avatar.waistInches}" • ${avatar.hipsInches}".`;
    }
  } else if (hasTooTight) {
    const tightZone = inspectedEntry.zoneDetails.find((z) => z.feel === "too_tight")!;
    headlineVerdict = `Caution on Size ${inspectedSize}: ${tightZone.detailNote} Recommended: Size ${recommendedSize}.`;
  } else if (allRoomy) {
    headlineVerdict = `Size ${inspectedSize} gives an intentionally looser, oversized drape compared to your tailored Size ${recommendedSize} match.`;
  } else {
    headlineVerdict = `Size ${inspectedSize} offers a closer sculpted fit (${meta.stretchLevel} stretch); Size ${recommendedSize} is your balanced everyday fit.`;
  }

  // Model Height & Hem Landing Comparison
  const modelHeight = meta.modelStats?.heightInches || 69; // 5'9" standard e-comm studio model if unlisted
  const modelHeightLabel =
    meta.modelStats?.heightDisplay ||
    `${Math.floor(modelHeight / 12)}'${modelHeight % 12}"`;
  const modelWornLabel = meta.modelStats?.wornSize || "S";
  const heightDiff = avatar.heightInches - modelHeight; // negative when customer is shorter than studio model
  const avatarHeightStr = `${Math.floor(avatar.heightInches / 12)}'${Math.round(
    avatar.heightInches % 12
  )}"`;

  const modelSummary = meta.modelStats?.rawText
    ? `Store Model: ${meta.modelStats.rawText}`
    : `Studio Ref Model: ~${modelHeightLabel} wearing Size ${modelWornLabel}`;

  let proportionNote: string;
  if (Math.abs(heightDiff) <= 1) {
    proportionNote = `Your ${avatarHeightStr} height matches the ${modelHeightLabel} model closely—hem length will land almost identically to the store photos.`;
  } else {
    const torsoShift = Math.abs(heightDiff * 0.36).toFixed(1);
    const legShift = Math.abs(heightDiff * 0.62).toFixed(1);
    const lowerOrHigher = heightDiff < 0 ? "lower / longer" : "higher / shorter";
    if (product.category === "top" || product.category === "outerwear") {
      proportionNote = `At ${avatarHeightStr} vs the ${modelHeightLabel} model, expect the hem to land ~${torsoShift}" ${
        heightDiff < 0 ? "lower on your waist/hip" : "higher/more cropped"
      } than shown on the model.`;
    } else if (meta.inseamInches) {
      proportionNote = `${meta.inseamInches}" inseam: at ${avatarHeightStr} (vs ${modelHeightLabel} model), hem falls ~${legShift}" ${lowerOrHigher} at the ankle/shoe.`;
    } else {
      proportionNote = `At ${avatarHeightStr} vs the ${modelHeightLabel} model, expect the skirt/pant hem to drape ~${legShift}" ${lowerOrHigher} than on the store model.`;
    }
  }

  const stretchLabels: Record<FabricStretchLevel, string> = {
    high: "High 4-Way Stretch (+2.2\" contour give)",
    medium: "Comfort Stretch Knit (+1.1\" give)",
    low: "Slight Comfort Give (+0.5\")",
    rigid: "Non-Stretch / Rigid Weave (0\" give)",
  };

  const fabricSummary = meta.fabricComposition
    ? `${meta.fabricComposition} • ${stretchLabels[meta.stretchLevel]}`
    : `${stretchLabels[meta.stretchLevel]} • ${meta.cutType} cut`;

  let extractedFactsCount = 1;
  if (meta.fabricComposition) extractedFactsCount++;
  if (meta.modelStats) extractedFactsCount++;
  if (meta.descriptionSummary) extractedFactsCount++;
  if (meta.fitNotes.length > 0) extractedFactsCount++;
  if ((meta.galleryImages?.length || 0) > 1) extractedFactsCount++;

  const confidencePct = Math.min(98, 86 + extractedFactsCount * 2);

  return {
    recommendedSize,
    inspectedSize,
    confidencePct,
    headlineVerdict,
    alternateOption: second
      ? {
          size: second.size,
          note:
            sizes.indexOf(second.size) < sizes.indexOf(recommendedSize)
              ? `Try ${second.size} only if you want a tighter ${meta.stretchLevel === "rigid" ? "structured" : "compression"} fit`
              : `Size up to ${second.size} for a looser, more relaxed drape`,
        }
      : undefined,
    zones: inspectedEntry.zoneDetails,
    lengthComparison: {
      modelSummary,
      proportionNote,
      heightDiffInches: heightDiff,
    },
    fabricSummary,
    extractedFactsCount,
  };
}

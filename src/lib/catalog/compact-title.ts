import { Product } from "../types";

/**
 * Hand-curated boutique card titles (<= 24 chars) for all 54 verified studio SKUs
 * so every product card displays both its colorway/material AND garment noun cleanly
 * inside mobile & desktop cards without mid-word `...` truncation.
 */
const COMPACT_TITLE_BY_ID: Record<string, string> = {
  "prod-ae-espresso-corset": "Espresso Satin Corset",
  "prod-ae-ivory-tweed-blazer": "Ivory Tweed Blazer",
  "prod-ae-champagne-trousers": "Champagne Pleated Pants",
  "prod-ae-noir-pleated-mini": "Noir Pleated Mini Skirt",
  "prod-ae-emerald-satin-midi": "Emerald Silk Midi Dress",
  "prod-ae-gold-strappy-heels": "Gold Strappy Heels",
  "prod-ae-noir-slingbacks": "Noir Patent Slingbacks",
  "prod-ae-burgundy-crescent-bag": "Merlot Crescent Bag",
  "prod-ae-champagne-blazer-dress": "Champagne Blazer Dress",
  "prod-ae-camel-silk-wool-coat": "Taupe Silk Belted Coat",
  "prod-ae-acetate-beaded-tank": "Ivory Ribbed Tank Top",
  "prod-ae-linen-cinch-cardigan": "Oatmeal Belted Cardigan",
  "prod-ae-meotina-leather-boots": "Noir Leather Knee Boots",
  "prod-ae-camel-turnlock-tote": "Camel Leather Tote",
  "prod-ae-crimson-corset-mini": "Crimson Satin Mini Dress",
  "prod-ae-vintage-wide-denim": "Vintage Straight Jeans",
  "prod-ae-noir-tailored-blazer": "Noir Tailored Blazer",
  "prod-ae-noir-quilted-bag": "Noir Quilted Chain Bag",
  "prod-ae-ivory-mini-bag": "Pearl Ivory Mini Bag",
  "prod-ae-sage-zip-jacket": "Sage Contour Zip Jacket",
  "prod-ae-sage-flare-leggings": "Sage Flare Leggings",
  "prod-ae-cloud-platform-sneakers": "White Platform Sneakers",
  "prod-ae-gold-sculpted-belt": "Gold Calfskin Belt",
  "prod-ae-blush-ruched-offshoulder": "Blush Off-Shoulder Top",
  "prod-ae-noir-halter-vest": "Noir Tailored Vest",
  "prod-ae-butter-silk-cami": "Butter Silk Camisole",
  "prod-ae-ivory-satin-bias-midi": "Ivory Satin Midi Skirt",
  "prod-ae-espresso-tailored-shorts": "Espresso Pleated Shorts",
  "prod-ae-charcoal-pinstripe-trousers": "Charcoal Pinstripe Pants",
  "prod-ae-cobalt-draped-mini": "Cobalt Satin Mini Dress",
  "prod-ae-butter-lace-slip-midi": "Cream Lace Slip Dress",
  "prod-ae-burgundy-leather-trench": "Merlot Leather Jacket",
  "prod-ae-cream-cropped-fur-jacket": "Cream Faux-Fur Bolero",
  "prod-ae-burgundy-patent-heels": "Merlot Patent Heels",
  "prod-ae-silver-crystal-heels": "Silver Crystal Heels",
  "prod-ae-silver-metallic-shoulder-bag": "Silver Ruched Bag",
  "prod-ae-ivory-pearl-corset": "Pearl Ivory Corset Top",
  "prod-ae-noir-satin-corset": "Noir Satin Corset Top",
  "prod-ae-emerald-silk-cami": "Emerald Silk Camisole",
  "prod-ae-camel-tailored-vest": "Camel Halter Vest",
  "prod-ae-obsidian-wide-trousers": "Noir Wide-Leg Pants",
  "prod-ae-olive-pleated-trousers": "Olive Pleated Pants",
  "prod-ae-burgundy-pleated-mini": "Merlot Pleated Mini",
  "prod-ae-chocolate-satin-midi": "Espresso Satin Midi",
  "prod-ae-sapphire-satin-midi": "Sapphire Silk Midi Dress",
  "prod-ae-onyx-satin-midi": "Onyx Satin Midi Dress",
  "prod-ae-rosewood-corset-mini": "Rosewood Corset Mini",
  "prod-ae-noir-tuxedo-blazer-dress": "Noir Blazer Mini Dress",
  "prod-ae-emerald-tweed-blazer": "Emerald Tweed Blazer",
  "prod-ae-espresso-tailored-blazer": "Espresso Tailored Blazer",
  "prod-ae-charcoal-wool-coat": "Charcoal Belted Coat",
  "prod-ae-ivory-patent-slingbacks": "Ivory Patent Slingbacks",
  "prod-ae-espresso-suede-crescent-bag": "Espresso Crescent Bag",
  "prod-ae-silver-sculpted-belt": "Silver Calfskin Belt",
};

const FILLER_WORDS = new Set([
  "womens",
  "women",
  "ladies",
  "2024",
  "2025",
  "2026",
  "summer",
  "spring",
  "autumn",
  "winter",
  "sculpted",
  "boned",
  "basque",
  "high-waist",
  "high-rise",
  "fluid",
  "wide-leg",
  "bias-cut",
  "cowl-neck",
  "square-toe",
  "pointed-toe",
  "gold-buckle",
  "gold-button",
  "gold-clasp",
  "gold-turnlock",
  "gold-chain",
  "double-breasted",
  "single-breasted",
  "double-pleat",
  "knife-pleat",
  "built-in-shorts",
  "oversized",
  "genuine",
  "authentic",
  "old-money",
  "parisian",
  "atelier",
  "savile-weave",
  "lyocell-acetate",
  "mulberry",
  "duchesse",
  "chantilly-lace",
  "faux-mink",
  "double-faced",
  "merino-blend",
  "minimalist",
  "smooth",
  "glossy",
  "liquid",
  "liquid-satin",
  "liquid-silver",
  "midnight-cobalt",
  "midnight-sapphire",
  "botanical-emerald",
  "pearl-ivory",
  "pearl-cream",
  "blush-rose",
  "deep",
  "warm",
  "dark-espresso",
  "espresso-chocolate",
  "espresso-taupe",
  "rosewood-blush",
  "slate-charcoal",
  "cloud-white",
  "palladium-silver",
  "14k",
  "18k",
  "petite",
  "crossover",
  "contour",
  "seam",
  "mock-neck",
  "open-weave",
  "open-back",
  "split-toe",
  "block-heel",
  "ankle-strap",
  "crystal-collar",
  "satin-lapel",
  "draped-skirt",
  "boyfriend",
  "trapezium",
  "cincher",
]);

/**
 * Formats any product (seed SKU, live Shopify/AliExpress store pull, customer URL submit, or upload)
 * into a clean, readable boutique title that fits inside narrow mobile/desktop cards while keeping
 * the core garment noun intact!
 */
export function formatCompactProductTitle(
  productOrTitle: Pick<Product, "id" | "title" | "colorName"> | string,
  maxChars = 24
): string {
  if (typeof productOrTitle !== "string") {
    const mapped = COMPACT_TITLE_BY_ID[productOrTitle.id];
    if (mapped && mapped.length <= maxChars + 2) return mapped;
  }

  const raw = (
    typeof productOrTitle === "string"
      ? productOrTitle
      : productOrTitle.title || ""
  )
    .replace(/\s+/g, " ")
    .trim();

  if (!raw) return "Boutique Piece";
  if (raw.length <= maxChars) return raw;

  // Clean common compound prefixes
  const normalized = raw
    .replace(/Trousers\b/gi, "Pants")
    .replace(/Stilettos\b/gi, "Heels")
    .replace(/Camisole Top\b/gi, "Camisole")
    .replace(/Shoulder Bag\b/gi, "Bag")
    .replace(/Waist Belt\b/gi, "Belt")
    .replace(/Mini Slip Dress\b/gi, "Mini Dress")
    .replace(/Midi Slip Dress\b/gi, "Midi Dress")
    .replace(/Midi Slip Gown\b/gi, "Midi Dress")
    .replace(/Cocktail Mini Dress\b/gi, "Mini Dress");

  if (normalized.length <= maxChars) return normalized;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length <= 3) return normalized.slice(0, maxChars).trim();

  // Keep the trailing 1–2 garment nouns (e.g. "Mini Dress", "Midi Skirt", "Tank Top", "Bag")
  const twoWordEndings = new Set([
    "mini dress",
    "midi dress",
    "maxi dress",
    "slip dress",
    "blazer dress",
    "mini skirt",
    "midi skirt",
    "corset top",
    "tank top",
    "knee boots",
    "wide pants",
    "zip jacket",
  ]);
  const lastTwo = tokens.slice(-2).join(" ").toLowerCase();
  const tailCount = twoWordEndings.has(lastTwo) ? 2 : 1;
  const tail = tokens.slice(-tailCount);
  const headCandidates = tokens
    .slice(0, -tailCount)
    .filter((w) => !FILLER_WORDS.has(w.toLowerCase().replace(/[^a-z0-9-]/g, "")));

  const chosenHead: string[] = [];
  for (const w of headCandidates) {
    const candidate = [...chosenHead, w, ...tail].join(" ");
    if (candidate.length <= maxChars) {
      chosenHead.push(w);
      if (chosenHead.length >= 2) break;
    }
  }

  if (chosenHead.length === 0 && tokens.length > tailCount) {
    const firstClean = tokens[0].split("-").pop() || tokens[0];
    const fallback = [firstClean, ...tail].join(" ");
    if (fallback.length <= maxChars) return fallback;
  }

  const built = [...chosenHead, ...tail].join(" ").trim();
  if (built && built.length <= maxChars) return built;
  return built ? built.slice(0, maxChars).trim() : raw.slice(0, maxChars).trim();
}

/**
 * Formats Runway & Closet outfit titles into crisp editorial capsule names (<= 28 chars)
 * so they fit cleanly inside the centered Runway footer bar and 2-column outfit cards!
 */
export function formatCompactOutfitTitle(
  rawTitle: string,
  maxChars = 28
): string {
  const clean = (rawTitle || "")
    .replace(/^AI Bespoke Capsule #\d+:\s*/i, "")
    .replace(/\bChampagne Tailored Edit\b/gi, "Champagne Pants")
    .replace(/\bChampagne Tailored\b/gi, "Champagne Pants")
    .replace(/\bMerlot Crescent\b/gi, "Merlot Bag")
    .replace(/\b(Tailored Edit|Capsule|Tailored Look|Look|Edit|Outfit|Set)\b/gi, "")
    .replace(/\bOld-Money\s+/gi, "")
    .replace(/\bQuiet-Luxury\s+/gi, "")
    .replace(/\bMidnight[\s-]+/gi, "")
    .replace(/\bBias-Cut\s+/gi, "")
    .replace(/\bSatin Corset\b/gi, "Corset")
    .replace(/\bDraped Satin\b/gi, "Satin")
    .replace(/\bBouclé\b/gi, "Tweed")
    .replace(/\s+&\s+/g, " & ")
    .replace(/\s{2,}/g, " ")
    .replace(/[&\s]+$/, "")
    .trim();

  if (!clean) return "Signature Edit";
  if (clean.length <= maxChars) return clean;

  // If formatted as "Part A & Part B", condense each side cleanly
  if (clean.includes(" & ")) {
    const [left, right] = clean.split(" & ").map((s) => s.trim());
    const shortSide = (s: string) => {
      const ws = s.split(" ").filter(Boolean);
      return ws.length <= 2 ? s : `${ws[0]} ${ws[ws.length - 1]}`;
    };
    const joined = `${shortSide(left)} & ${shortSide(right)}`;
    if (joined.length <= maxChars) return joined;
    const ultraShort = `${left.split(" ")[0]} & ${shortSide(right)}`;
    if (ultraShort.length <= maxChars) return ultraShort;
  }

  const words = clean.split(" ");
  let acc = "";
  for (const w of words) {
    const next = acc ? `${acc} ${w}` : w;
    if (next.length > maxChars) break;
    acc = next;
  }
  return acc || clean.slice(0, maxChars).trim();
}

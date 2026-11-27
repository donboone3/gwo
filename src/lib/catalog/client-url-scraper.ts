"use client";

import {
  GarmentCategory,
  GarmentSilhouette,
  Product,
  ProductGalleryAngle,
} from "../types";
import {
  extractProductFitProfile,
  upgradeCdnImageResolution,
} from "./fit-intelligence";

/**
 * Upgrades CDN thumbnail parameters to HD and proxies external e-commerce images
 * through wsrv.nl so hotlink-protected stores always render cleanly with CORS.
 */
export function getSafeClothingImageUrl(
  rawImgUrl?: string,
  width = 880
): string | undefined {
  if (!rawImgUrl) return undefined;
  let trimmed = rawImgUrl.trim();
  if (!trimmed) return undefined;
  // Normalize protocol-relative CDN URLs (e.g. //cdn.shopify.com/...) BEFORE checking local "/" paths!
  if (trimmed.startsWith("//")) {
    trimmed = `https:${trimmed}`;
  }
  // Strip AliExpress / Alibaba CDN double-extension .avif thumbnails so wsrv.nl fetches crisp original JPG/PNG
  if (/aliexpress-media\.com|alicdn\.com/i.test(trimmed)) {
    trimmed = trimmed.replace(/_\d+x\d+[a-z0-9.]*_\.avif$/i, "");
  }
  if (
    trimmed.startsWith("/") ||
    trimmed.includes("/models/") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (trimmed.includes("images.higgs.ai") || trimmed.includes("wsrv.nl")) {
    return trimmed;
  }
  // Shopify's global edge CDN supports direct fast resizing without hotlink blocks
  if (/cdn\.shopify\.com/i.test(trimmed)) {
    const cleanShopify = trimmed.replace(/([?&])width=\d+&?/gi, "$1").replace(/[?&]$/, "");
    const sep = cleanShopify.includes("?") ? "&" : "?";
    return `${cleanShopify}${sep}width=${width}`;
  }
  const upgraded = upgradeCdnImageResolution(trimmed);
  return `https://wsrv.nl/?url=${encodeURIComponent(
    upgraded
  )}&w=${width}&output=webp&q=86`;
}

export function isDirectImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|avif)(\?.*)?$/i.test(url.trim());
}

export function isJunkIconOrLogo(imgUrl: string, alt = ""): boolean {
  const s = `${imgUrl} ${alt}`.toLowerCase();
  if (
    imgUrl.startsWith("data:") ||
    imgUrl.startsWith("blob:") ||
    /\.svg(\?|$)/i.test(imgUrl) ||
    /\.ico(\?|$)/i.test(imgUrl) ||
    /favicon|android-chrome|apple-touch-icon|logo|sprite|flags\/|flag\.vercel|badge|pixel|1x1|blank\.gif|kustomer|okendo|moisture_wicking|4-way_stretch|recycled_materials|335x184/i.test(
      s
    )
  ) {
    return true;
  }
  return false;
}

function inferClientCategory(text: string): {
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
} {
  const t = text.toLowerCase();
  if (/(shoe|sneaker|cortez|dunk|runner|jordan|trainer|loafer)/.test(t)) {
    return { category: "shoes", silhouette: "sneakers" };
  }
  if (/(flat|heel|sandal|boot|mule)/.test(t)) {
    return { category: "shoes", silhouette: "ballet-flats" };
  }
  if (/(dress|gown|romper|jumpsuit)/.test(t)) {
    return {
      category: "dress",
      silhouette: /mini|exercise/.test(t) ? "mini-dress" : "slip-dress",
    };
  }
  if (/(hoodie|sweatshirt|fleece|pullover)/.test(t)) {
    return { category: "outerwear", silhouette: "oversized-hoodie" };
  }
  if (/(jacket|coat|blazer|trench|puffer)/.test(t)) {
    return { category: "outerwear", silhouette: "cropped-jacket" };
  }
  if (/(cardigan|sweater|knit)/.test(t) && !/(tank|skirt|pant)/.test(t)) {
    return { category: "top", silhouette: "cardigan" };
  }
  if (/(legging|tight|yoga)/.test(t)) {
    return { category: "bottom", silhouette: "leggings" };
  }
  if (/(cargo|parachute|jogger|sweatpant|trouser)/.test(t)) {
    return { category: "bottom", silhouette: "cargo-pants" };
  }
  if (/(skirt|skort)/.test(t)) {
    return { category: "bottom", silhouette: "mini-skirt" };
  }
  if (/(jean|denim|pant|short)/.test(t)) {
    return { category: "bottom", silhouette: "wide-denim" };
  }
  if (/(bag|tote|purse|clutch)/.test(t)) {
    return { category: "accessory", silhouette: "shoulder-bag" };
  }
  if (/(bra|bralette|corset)/.test(t)) {
    return { category: "top", silhouette: "sports-bra" };
  }
  if (/(tank|cami|halter|tube|bodysuit)/.test(t)) {
    return { category: "top", silhouette: "crop-tank" };
  }
  return { category: "top", silhouette: "baby-tee" };
}

function inferClientColor(text: string): {
  colorName: string;
  colorHex: string;
  accentHex: string;
} {
  const t = text.toLowerCase();
  if (/(burgundy|merlot|wine|maroon|oxblood)/.test(t)) {
    return { colorName: "Deep Burgundy", colorHex: "#6E1423", accentHex: "#FAF8F5" };
  }
  if (/(red|crimson|scarlet|cherry|ruby|rouge)/.test(t)) {
    return { colorName: "Crimson Red", colorHex: "#C80815", accentHex: "#FAF8F5" };
  }
  if (/(silver|chrome|metallic|platinum|crystal|rhinestone)/.test(t)) {
    return { colorName: "Crystal Silver", colorHex: "#C7CDD6", accentHex: "#141518" };
  }
  if (/(gold|gilded|amber)/.test(t)) {
    return { colorName: "Champagne Gold", colorHex: "#D4B475", accentHex: "#181615" };
  }
  if (/(pink|blush|rose|coral|berry)/.test(t)) {
    return { colorName: "Soft Blush", colorHex: "#DFC1B8", accentHex: "#181615" };
  }
  if (/(brown|espresso|cacao|chocolate|mocha|truffle)/.test(t)) {
    return { colorName: "Espresso", colorHex: "#3C2A24", accentHex: "#FAF8F5" };
  }
  if (/(white|cream|ivory|sail|alabaster|bone|pale grey|heather)/.test(t)) {
    return { colorName: "Studio Cream", colorHex: "#ECEAE4", accentHex: "#181615" };
  }
  if (/(green|sage|olive|matcha|emerald)/.test(t)) {
    return { colorName: "Sage Olive", colorHex: "#4E6B58", accentHex: "#FAF8F5" };
  }
  if (/(blue|indigo|denim|navy|cobalt)/.test(t)) {
    return { colorName: "Vintage Indigo", colorHex: "#5B748F", accentHex: "#FAF8F5" };
  }
  if (/(tan|beige|stone|oat|sand|khaki|champagne)/.test(t)) {
    return { colorName: "Warm Stone", colorHex: "#D4C6B6", accentHex: "#181615" };
  }
  return { colorName: "Studio Noir", colorHex: "#232122", accentHex: "#FAF8F5" };
}

function stripHtmlToReadableText(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function formatBrand(hostname: string): string {
  const clean = hostname
    .replace(/\.myshopify\.com$/i, "")
    .replace(/^(www\.|us\.|au\.|uk\.|m\.|shop\.|store\.)/i, "")
    .split(".")[0];
  const lower = clean.toLowerCase();
  if (lower.includes("babyboo")) return "Babyboo Fashion";
  if (lower.includes("houseofcb")) return "House of CB";
  if (lower.includes("ohpolly")) return "Oh Polly";
  if (lower.includes("meshki")) return "MESHKI";
  const map: Record<string, string> = {
    thereformation: "Reformation",
    princesspolly: "Princess Polly",
    skims: "SKIMS",
    nike: "Nike",
    aloyoga: "Alo Yoga",
    shein: "SHEIN",
    aritzia: "Aritzia",
    lululemon: "Lululemon",
    vuoriclothing: "Vuori",
    outdoorvoices: "Outdoor Voices",
    zara: "Zara",
    revolve: "Revolve",
    gymshark: "Gymshark",
  };
  return map[lower] || clean.charAt(0).toUpperCase() + clean.slice(1);
}

function isProductOnlyImageSignal(alt: string, url: string): boolean {
  const s = `${alt} ${url}`.toLowerCase();
  if (/on[\s_-]?a?[\s_-]?model|lookbook|lifestyle|street[\s_-]?style/.test(s)) {
    return false;
  }
  return /flat|-flt\b|_flt\b|laydown|packshot|ghost|mannequin|isolated|product[\s_-]?only|still[\s_-]?life|_prod\b|-prod\b|cutout|white[\s_-]?bg/.test(
    s
  );
}

function labelAngleFromText(alt: string, url: string, idx: number): string {
  const s = `${alt} ${url}`.toLowerCase();
  if (isProductOnlyImageSignal(alt, url)) return "Flat-Lay Cut";
  if (/back view|-bk\b|_back|rear/.test(s)) return "Model Back";
  if (/side view|-sd\b|_side|profile/.test(s)) return "Model Side";
  if (/detail|close[\s-]?up|fabric|zoom/.test(s)) return "Fabric Detail";
  if (/front view|-fr\b|_front/.test(s) || idx === 0) return "Product Front";
  return `Angle ${idx + 1}`;
}

/**
 * Extracts up to 5 deduplicated, high-res multi-angle photos belonging to the main product
 * (filtering out cross-sell footer recommendations).
 */
export function extractProductGalleryAngles(
  candidates: Array<{ alt: string; url: string }>,
  titleKeywords: string[]
): ProductGalleryAngle[] {
  const scored: Array<{ alt: string; url: string; baseKey: string; score: number }> = [];

  for (const { alt, url } of candidates) {
    if (!url || isJunkIconOrLogo(url, alt)) continue;
    const upgraded = upgradeCdnImageResolution(url);
    const lowerAlt = alt.toLowerCase();
    const lowerUrl = upgraded.toLowerCase();

    // Reject obvious cross-sell men's/kids items when scraping women's product
    if (/\bmens\b|\bkids\b|boxer brief/.test(lowerAlt)) continue;

    let score = 0;
    let keywordHits = 0;
    for (const kw of titleKeywords) {
      if (kw.length >= 3 && (lowerAlt.includes(kw) || lowerUrl.includes(kw))) {
        score += 20;
        keywordHits++;
      }
    }

    if (
      /\/products\/|\/files\/|pdp|front|-flt|-fr\.|-bk\.|revolveassets|scene7|cloudinary|demandware|zara\.net|asos-media|nordstrommedia|princesspolly|babyboo|houseofcb|ohpolly|meshki|thereformation|aritzia|lululemon|skims|nike\.com\/a\/images/i.test(
        upgraded
      )
    ) {
      score += 26;
    }
    // Strongly prioritize isolated product-only / flat-lay / ghost-mannequin shots over full-model photos!
    if (isProductOnlyImageSignal(alt, upgraded)) {
      score += 55;
    } else if (/on a model|model wears|lookbook/i.test(lowerAlt)) {
      score -= 8;
    } else if (/front view|back view|image \d|product/i.test(lowerAlt)) {
      score += 18;
    }
    // Penalize cross-sell tiny cards on SKIMS (w=1&h=1 or h=205) and generic CMS hero banners (contentstack/sanity)
    if (
      /[?&]w=1(&|$)|[?&]h=205(&|$)|skims-sanity\.imgix\.net|images\.contentstack\.io|100x100|50x50|avatar|review/i.test(
        url
      )
    ) {
      score -= 55;
    }
    if (keywordHits === 0 && titleKeywords.length >= 2 && score === 0) {
      score -= 5;
    }

    const baseKey = upgraded.split("?")[0].replace(/_\d+x\d*\./, ".");
    scored.push({ alt, url: upgraded, baseKey, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const seenBase = new Set<string>();
  const angles: ProductGalleryAngle[] = [];

  for (const item of scored) {
    if (item.score < -10 && angles.length > 0) break;
    if (seenBase.has(item.baseKey)) continue;
    seenBase.add(item.baseKey);

    const safeUrl = getSafeClothingImageUrl(item.url, 960);
    if (!safeUrl) continue;

    angles.push({
      url: safeUrl,
      label: labelAngleFromText(item.alt, item.url, angles.length),
    });
    if (angles.length >= 5) break;
  }

  return angles;
}

export function pickBestHeroProductImage(
  candidates: Array<{ alt: string; url: string }>,
  titleKeywords: string[]
): string | undefined {
  const gallery = extractProductGalleryAngles(candidates, titleKeywords);
  return gallery[0]?.url;
}

export function convertStoreCurrencyToUsd(
  rawAmount: number,
  currencyOrHost = ""
): number {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return 0;
  const s = currencyOrHost.toUpperCase();
  if (s === "AUD" || /(?:\.COM\.AU|-AU\b|^AU\.)/i.test(currencyOrHost)) {
    return Math.max(8, Math.round(rawAmount * 0.66));
  }
  if (s === "CAD" || /(?:\.CA$|^CA\.)/i.test(currencyOrHost)) {
    return Math.max(8, Math.round(rawAmount * 0.73));
  }
  if (s === "GBP" || s === "£" || /(?:\.CO\.UK$|^UK\.)/i.test(currencyOrHost)) {
    return Math.max(8, Math.round(rawAmount * 1.27));
  }
  if (s === "EUR" || s === "€" || /(?:\.EU$|\.FR$|\.DE$|\.IT$)/i.test(currencyOrHost)) {
    return Math.max(8, Math.round(rawAmount * 1.08));
  }
  if (s === "NZD" || /\.CO\.NZ$/i.test(currencyOrHost)) {
    return Math.max(8, Math.round(rawAmount * 0.6));
  }
  return Math.round(rawAmount);
}

/**
 * Extracts the true product retail price from PDP markdown/text while ignoring
 * header promo banners ("Free Shipping on Orders Over $100") and BNPL installments ("4 payments of $33").
 */
export function extractAccurateProductPrice(
  rawText: string,
  hostname = "",
  productTitle = ""
): number | null {
  if (!rawText) return null;

  const promoNoiseRe =
    /free\s+(?:express\s+|standard\s+)?shipping|orders?\s+over|spend\s+\$|off\s+your\s+first|afterpay|klarna|clearpay|sezzle|zip\s+pay|4\s+interest|installments?|payments?\s+of|gift\s+card|refer\s+a\s+friend/i;

  // Focus search window starting near the product H1/title if present so header banners are skipped
  let working = rawText;
  if (productTitle.length >= 5) {
    const firstWord = productTitle.split(/\s+/)[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hIdx = working.search(new RegExp(`(?:#\\s+|\\b)${firstWord}`, "i"));
    if (hIdx > 80 && hIdx < working.length - 40) {
      working = working.slice(Math.max(0, hIdx - 40));
    }
  }

  const cleanLines = working
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !promoNoiseRe.test(l));

  const joined = cleanLines.slice(0, 120).join("\n");

  const patterns: Array<{ re: RegExp; curr?: string }> = [
    { re: /\b(?:USD|US\$)\s*([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, curr: "USD" },
    { re: /\b(?:AUD|AU\$|A\$)\s*([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, curr: "AUD" },
    { re: /\b(?:CAD|CA\$|C\$)\s*([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, curr: "CAD" },
    { re: /(?:£|GBP\s*)([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, curr: "GBP" },
    { re: /(?:€|EUR\s*)([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{1,2})?)/i, curr: "EUR" },
    { re: /\$\s*([1-9]\d{0,3}(?:,\d{3})*(?:\.\d{2})?)/ },
  ];

  for (const { re, curr } of patterns) {
    const m = joined.match(re);
    if (m?.[1]) {
      const val = Number(m[1].replace(/,/g, ""));
      if (val >= 6 && val <= 4500) {
        return convertStoreCurrencyToUsd(val, curr || hostname);
      }
    }
  }
  return null;
}

/**
 * Browser-safe Schema.org Product JSON-LD + OpenGraph meta parser.
 * Extracts exact product title, full image array, exact offer price + currency, brand, and description!
 */
export function extractStructuredHtmlProductData(
  html: string,
  hostname = ""
): {
  title?: string;
  brand?: string;
  priceUsd?: number;
  description?: string;
  images: string[];
  sizes: string[];
} {
  const images: string[] = [];
  const sizes: string[] = [];
  let title: string | undefined;
  let brand: string | undefined;
  let priceUsd: number | undefined;
  let description: string | undefined;

  if (!html) return { images, sizes };

  const readMeta = (attrVal: string): string | undefined => {
    const escaped = attrVal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m1 = html.match(
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
        "i"
      )
    );
    if (m1?.[1]) return stripHtmlToReadableText(m1[1]);
    const m2 = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`,
        "i"
      )
    );
    return m2?.[1] ? stripHtmlToReadableText(m2[1]) : undefined;
  };

  const ogTitle = readMeta("og:title") || readMeta("twitter:title");
  if (ogTitle) title = ogTitle.split(/\s+\|\s+/)[0].trim();

  const ogDesc = readMeta("og:description") || readMeta("description");
  if (ogDesc) description = ogDesc;

  const ogImg = readMeta("og:image:secure_url") || readMeta("og:image");
  if (ogImg && !isJunkIconOrLogo(ogImg)) images.push(ogImg);

  const metaPriceRaw =
    readMeta("product:price:amount") || readMeta("og:price:amount");
  const metaCurr =
    readMeta("product:price:currency") || readMeta("og:price:currency") || hostname;
  if (metaPriceRaw) {
    const pNum = Number(metaPriceRaw.replace(/[^0-9.]/g, ""));
    if (pNum > 0) priceUsd = convertStoreCurrencyToUsd(pNum, metaCurr);
  }

  // Parse all <script type="application/ld+json"> blocks
  const ldRegex =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length > 0) {
        const node = queue.shift() as Record<string, unknown> | null;
        if (!node || typeof node !== "object") continue;
        if (Array.isArray(node["@graph"])) {
          queue.push(...(node["@graph"] as unknown[]));
        }
        const tRaw = node["@type"];
        const tStr = Array.isArray(tRaw) ? tRaw.join(",") : String(tRaw || "");
        if (!/Product/i.test(tStr)) continue;

        if (typeof node.name === "string" && node.name.trim()) {
          title = node.name.split(/\s+\|\s+/)[0].trim();
        }
        if (typeof node.description === "string" && node.description.trim()) {
          description = stripHtmlToReadableText(node.description);
        }
        if (node.brand) {
          if (typeof node.brand === "string") brand = node.brand.trim();
          else if (
            typeof (node.brand as Record<string, unknown>).name === "string"
          ) {
            brand = String((node.brand as Record<string, unknown>).name).trim();
          }
        }

        const rawImgs = Array.isArray(node.image)
          ? node.image
          : node.image
          ? [node.image]
          : [];
        for (const im of rawImgs) {
          const u =
            typeof im === "string"
              ? im
              : typeof (im as Record<string, unknown>)?.url === "string"
              ? String((im as Record<string, unknown>).url)
              : "";
          if (u && !isJunkIconOrLogo(u) && !images.includes(u)) {
            images.push(u);
          }
        }

        const rawOffers = node.offers;
        const offerList = Array.isArray(rawOffers)
          ? rawOffers
          : rawOffers && typeof rawOffers === "object" && Array.isArray((rawOffers as Record<string, unknown>).offers)
          ? ((rawOffers as Record<string, unknown>).offers as unknown[])
          : rawOffers
          ? [rawOffers]
          : [];

        for (const off of offerList) {
          const o = off as Record<string, unknown>;
          const pVal = Number(o?.price ?? o?.lowPrice ?? 0);
          const curr = String(o?.priceCurrency || metaCurr || hostname);
          if (pVal > 0 && !priceUsd) {
            priceUsd = convertStoreCurrencyToUsd(pVal, curr);
          }
          if (typeof o?.name === "string") {
            const sz = o.name.trim().toUpperCase();
            if (/^(XXS|XS|S|M|L|XL|XXL)$/.test(sz) && !sizes.includes(sz)) {
              sizes.push(sz);
            }
          }
        }

        if (Array.isArray(node.hasVariant)) {
          queue.push(...(node.hasVariant as unknown[]));
        }
      }
    } catch {
      // Ignore malformed JSON-LD block
    }
  }

  return { title, brand, priceUsd, description, images, sizes };
}

export interface BrowserScrapeResult {
  product: Product;
  needsManualPhotoHint: boolean;
}

/**
 * Browser-side live product + fit intelligence extractor for static deployments (GitHub Pages).
 * Pulls multi-angle photos, store model height/size, fabric composition, stretch, and fit notes!
 */
export async function scrapeProductInBrowser(
  rawUrl: string
): Promise<BrowserScrapeResult> {
  const trimmed = rawUrl.trim();
  const normalizedUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    parsedUrl = new URL("https://store.com/piece");
  }

  const host = parsedUrl.hostname.replace(/^www\./, "");
  const brand = formatBrand(host);

  const rawSlug =
    parsedUrl.pathname
      .split("/")
      .filter((s) => s && !/^(t|p|products|product|us|en)$/i.test(s))
      .pop() || "Imported Piece";
  const cleanSlugTitle = rawSlug
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (isDirectImageUrl(normalizedUrl)) {
    const { category, silhouette } = inferClientCategory(cleanSlugTitle);
    const { colorName, colorHex, accentHex } = inferClientColor(cleanSlugTitle);
    const heroImg = getSafeClothingImageUrl(normalizedUrl, 960);
    const { fitMetadata, calibratedChart } = extractProductFitProfile({
      rawText: cleanSlugTitle,
      title: cleanSlugTitle,
      brand,
      category,
      silhouette,
      galleryImages: heroImg ? [{ url: heroImg, label: "Product Photo" }] : undefined,
    });
    const nowIso = new Date().toISOString();
    return {
      needsManualPhotoHint: false,
      product: {
        id: `prod_img_${Date.now()}`,
        canonicalUrl: normalizedUrl,
        brand,
        storeDomain: host,
        title: cleanSlugTitle.length > 4 ? cleanSlugTitle : `${brand} Imported Piece`,
        category,
        silhouette,
        colorName,
        colorHex,
        accentHex,
        price: 58,
        currency: "USD",
        imageUrl: heroImg,
        fitMetadata,
        occasions: ["Everyday", "Going Out"],
        vibes: ["Curated Closet"],
        availableSizes:
          category === "shoes"
            ? ["6.5", "7", "7.5", "8", "8.5"]
            : ["XS", "S", "M", "L", "XL"],
        sizeChartInches: category === "shoes" ? {} : calibratedChart,
        estDeliveryDays: 4,
        inStock: true,
        sourceType: "scraped_url",
        lastScrapedAt: nowIso,
        staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
      },
    };
  }

  let extractedTitle = "";
  let extractedPrice = 0;
  let pdpMarkdown = "";
  let galleryAngles: ProductGalleryAngle[] = [];

  // Tier 0: Direct Sub-200ms Browser CORS Fetch for Shopify /products/<handle>.json!
  const shopifyMatch = parsedUrl.pathname.match(/\/products\/([^/?#]+)/i);
  if (shopifyMatch?.[1]) {
    try {
      const handle = shopifyMatch[1].replace(/\.json$/i, "");
      const directJsonRes = await fetch(
        `${parsedUrl.origin}/products/${handle}.json`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(3400),
        }
      );
      if (directJsonRes.ok) {
        const payload = await directJsonRes.json();
        if (payload?.product) {
          const parsedProd = parseShopifyJsonProduct(
            payload.product,
            host,
            parsedUrl.origin,
            normalizedUrl
          );
          return {
            needsManualPhotoHint: !parsedProd.imageUrl,
            product: parsedProd,
          };
        }
      }
    } catch {
      // Non-Shopify or CORS-restricted storefront: fall through cleanly to Tier 1
    }
  }

  // Tier 1: Parallel Jina Markdown + Structured HTML JSON-LD / OpenGraph Extraction
  try {
    const [jinaMdRes, jinaHtmlRes] = await Promise.allSettled([
      fetch(`https://r.jina.ai/${normalizedUrl}`, {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "markdown",
          "X-With-Images-Summary": "true",
        },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`https://r.jina.ai/${normalizedUrl}`, {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "html",
        },
        signal: AbortSignal.timeout(7000),
      }),
    ]);

    if (jinaHtmlRes.status === "fulfilled" && jinaHtmlRes.value.ok) {
      const htmlJson = await jinaHtmlRes.value.json();
      const rawHtml = String(htmlJson?.data?.html || htmlJson?.data?.content || "");
      if (
        rawHtml &&
        !/verify you are human|captcha|access denied/i.test(rawHtml.slice(0, 600))
      ) {
        const ld = extractStructuredHtmlProductData(rawHtml, host);
        if (ld.title) extractedTitle = ld.title;
        if (ld.priceUsd && ld.priceUsd > 0) extractedPrice = ld.priceUsd;
        if (ld.description) pdpMarkdown = ld.description;
        if (ld.images.length > 0) {
          galleryAngles = ld.images
            .slice(0, 5)
            .map((u, idx) => {
              const safe = getSafeClothingImageUrl(u, 960);
              return safe
                ? { url: safe, label: labelAngleFromText("", u, idx) }
                : null;
            })
            .filter((g): g is ProductGalleryAngle => g !== null);
        }
      }
    }

    if (jinaMdRes.status === "fulfilled" && jinaMdRes.value.ok) {
      const json = await jinaMdRes.value.json();
      const pageTitle = String(json?.data?.title || "").trim();
      const content = String(json?.data?.content || "");
      const blocked =
        /404 not found|verify you are human|access denied|robot|just a moment/i.test(
          `${pageTitle} ${content.slice(0, 300)}`
        );

      if (!blocked) {
        pdpMarkdown = pdpMarkdown ? `${pdpMarkdown}\n${content}` : content;
        if (
          !extractedTitle &&
          pageTitle &&
          !/^nike store\.|^gymshark$/i.test(pageTitle)
        ) {
          extractedTitle = pageTitle.split(/\s+[|\-–—]\s+/)[0].trim();
        }
        if (!extractedPrice) {
          const smartPrice = extractAccurateProductPrice(
            content,
            host,
            extractedTitle || cleanSlugTitle
          );
          if (smartPrice) extractedPrice = smartPrice;
        }

        const imgsObj = json?.data?.images as Record<string, string> | undefined;
        if (galleryAngles.length === 0 && imgsObj && typeof imgsObj === "object") {
          const candidates = Object.entries(imgsObj).map(([alt, url]) => ({
            alt,
            url: String(url),
          }));
          const kwSource = `${extractedTitle || cleanSlugTitle}`
            .toLowerCase()
            .split(/\s+/)
            .filter(
              (w) => w.length >= 3 && !/^(the|and|for|with|womens|women)$/.test(w)
            );
          galleryAngles = extractProductGalleryAngles(candidates, kwSource);
        }
      }
    }
  } catch {
    // Fall through to Microlink backup
  }

  // Tier 2: Microlink OpenGraph + Price Metadata backup if Jina didn't find image or price
  if (galleryAngles.length === 0 || !extractedPrice) {
    try {
      const mlRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(normalizedUrl)}&meta=true`,
        { signal: AbortSignal.timeout(6500) }
      );
      if (mlRes.ok) {
        const ml = await mlRes.json();
        const mlTitle = String(ml?.data?.title || "");
        const mlDesc = String(ml?.data?.description || "");
        const mlImg = String(ml?.data?.image?.url || "");
        const mlRawPrice = Number(
          String(ml?.data?.price?.amount || ml?.data?.price || "").replace(
            /[^0-9.]/g,
            ""
          )
        );
        if (
          !/404 not found|just a moment|verify you are human/i.test(mlTitle)
        ) {
          if (galleryAngles.length === 0 && mlImg && !isJunkIconOrLogo(mlImg, mlTitle)) {
            const safeHero = getSafeClothingImageUrl(mlImg, 960);
            if (safeHero) {
              galleryAngles = [{ url: safeHero, label: "Model Front" }];
            }
          }
          if (!extractedTitle && mlTitle) {
            extractedTitle = mlTitle.split(/\s+[|\-–—]\s+/)[0].trim();
          }
          if (!extractedPrice && mlRawPrice > 0) {
            extractedPrice = convertStoreCurrencyToUsd(mlRawPrice, host);
          } else if (!extractedPrice && mlDesc) {
            const descPrice = extractAccurateProductPrice(mlDesc, host, extractedTitle);
            if (descPrice) extractedPrice = descPrice;
          }
          if (!pdpMarkdown && mlDesc) {
            pdpMarkdown = mlDesc;
          }
        }
      }
    } catch {
      // Ignore rate limit / network error
    }
  }

  if (
    /^sites-[a-z0-9_-]+-site$/i.test(extractedTitle) ||
    /^(just a moment|attention required|access denied|404|page not found|pardon our interruption|robot or human)/i.test(
      extractedTitle
    )
  ) {
    extractedTitle = "";
  }
  const finalTitle = extractedTitle || cleanSlugTitle;
  const { category, silhouette } = inferClientCategory(
    `${finalTitle} ${parsedUrl.pathname}`
  );
  const { colorName, colorHex, accentHex } = inferClientColor(
    `${finalTitle} ${parsedUrl.pathname}`
  );
  const { fitMetadata, calibratedChart } = extractProductFitProfile({
    rawText: pdpMarkdown || finalTitle,
    title: finalTitle,
    brand,
    category,
    silhouette,
    galleryImages: galleryAngles.length > 0 ? galleryAngles : undefined,
  });

  const nowIso = new Date().toISOString();

  return {
    needsManualPhotoHint: galleryAngles.length === 0,
    product: {
      id: `prod_url_${Date.now()}`,
      canonicalUrl: normalizedUrl,
      brand,
      storeDomain: host,
      title: finalTitle,
      category,
      silhouette,
      colorName,
      colorHex,
      accentHex,
      price: extractedPrice || 68,
      currency: "USD",
      imageUrl: galleryAngles[0]?.url,
      fitMetadata,
      occasions: ["Everyday", "Going Out", "Weekend"],
      vibes: ["Model Off-Duty", "Clean Girl"],
      availableSizes:
        category === "shoes"
          ? ["6.5", "7", "7.5", "8", "8.5"]
          : ["XS", "S", "M", "L", "XL"],
      sizeChartInches: category === "shoes" ? {} : calibratedChart,
      estDeliveryDays: 4,
      inStock: true,
      sourceType: "scraped_url",
      lastScrapedAt: nowIso,
      staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
  };
}

interface RawShopifyVariant {
  id?: number | string;
  title?: string;
  price?: string | number;
  available?: boolean;
}

interface RawShopifyImage {
  src?: string;
  alt?: string | null;
}

interface RawShopifyProduct {
  id?: number | string;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  body_html?: string;
  tags?: string[] | string;
  variants?: RawShopifyVariant[];
  images?: RawShopifyImage[];
}

export function parseShopifyJsonProduct(
  sp: RawShopifyProduct,
  host: string,
  origin: string,
  canonicalOverride?: string
): Product {
  const brand = formatBrand(host);
  const title = String(sp.title || "Store Garment").trim();
  const handle = String(sp.handle || "item").trim();
  const canonicalUrl = canonicalOverride || `${origin}/products/${handle}`;
  const rawBodyText = stripHtmlToReadableText(String(sp.body_html || ""));
  const tagsStr = Array.isArray(sp.tags)
    ? sp.tags.join(", ")
    : String(sp.tags || "");
  const combinedText = `${title}\n${sp.product_type || ""}\n${tagsStr}\n${rawBodyText}`;

  const rawPriceNum = Number(sp.variants?.[0]?.price || 68) || 68;
  const isAudStore = /(^|\.)au\.|-au\b|\.com\.au$/i.test(host);
  const usdPrice = isAudStore
    ? Math.max(12, Math.round(rawPriceNum * 0.66))
    : Math.round(rawPriceNum);

  const { category, silhouette } = inferClientCategory(
    `${title} ${sp.product_type || ""} ${handle}`
  );
  const { colorName, colorHex, accentHex } = inferClientColor(
    `${title} ${handle} ${tagsStr}`
  );

  const rawImages = sp.images || [];
  // Sort raw Shopify images so flat-lay / ghost-mannequin / product-only shots come FIRST!
  const sortedRawImages = [...rawImages].sort((a, b) => {
    const aProd = isProductOnlyImageSignal(
      String(a?.alt || ""),
      String(a?.src || "")
    )
      ? 1
      : 0;
    const bProd = isProductOnlyImageSignal(
      String(b?.alt || ""),
      String(b?.src || "")
    )
      ? 1
      : 0;
    return bProd - aProd;
  });

  const galleryAngles: ProductGalleryAngle[] = sortedRawImages
    .slice(0, 5)
    .map((img, idx) => {
      const safe = getSafeClothingImageUrl(String(img?.src || ""), 880);
      if (!safe) return null;
      return {
        url: safe,
        label: labelAngleFromText(
          String(img?.alt || ""),
          String(img?.src || ""),
          idx
        ),
      };
    })
    .filter((g): g is ProductGalleryAngle => g !== null);

  const variantSizes = (sp.variants || [])
    .filter((v) => v?.available !== false)
    .map((v) =>
      String(v?.title || "")
        .split("/")[0]
        .trim()
        .toUpperCase()
    )
    .filter((sz) =>
      /^(XXS|XS|S|M|L|XL|XXL|0|2|4|6|8|10|12|[5-9](?:\.5)?)$/.test(sz)
    );
  const dedupedSizes = Array.from(new Set(variantSizes));

  const { fitMetadata, calibratedChart } = extractProductFitProfile({
    rawText: combinedText,
    title,
    brand,
    category,
    silhouette,
    galleryImages: galleryAngles.length > 0 ? galleryAngles : undefined,
  });

  const nowIso = new Date().toISOString();
  const safeIdSlug = `${brand.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${handle
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 38)}`;

  return {
    id: `prod-live-${safeIdSlug}`,
    canonicalUrl,
    brand,
    storeDomain: host,
    title,
    category,
    silhouette,
    colorName,
    colorHex,
    accentHex,
    price: usdPrice,
    currency: "USD",
    imageUrl: galleryAngles[0]?.url,
    fitMetadata,
    occasions: ["Party", "Date Night", "Going Out"],
    vibes: ["Store Live Feed", "Exact Fit"],
    availableSizes:
      dedupedSizes.length > 0
        ? dedupedSizes
        : category === "shoes"
        ? ["6.5", "7", "7.5", "8", "8.5"]
        : ["XS", "S", "M", "L", "XL"],
    sizeChartInches: category === "shoes" ? {} : calibratedChart,
    estDeliveryDays: 4,
    inStock: true,
    sourceType: "scraped_url",
    lastScrapedAt: nowIso,
    staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
  };
}

export const VERIFIED_LIVE_STORE_RACKS = [
  {
    label: "Princess Polly Live",
    domain: "us.princesspolly.com",
    badge: "Live Shopify Feed",
  },
  {
    label: "Babyboo Couture",
    domain: "babyboofashion.com",
    badge: "Live Dresses & Corsets",
  },
  {
    label: "AliExpress Evening",
    domain: "aliexpress:satin",
    badge: "Corsets & Satin Dresses",
  },
  {
    label: "AliExpress Tailoring",
    domain: "aliexpress:blazer",
    badge: "Blazers, Coats & Trousers",
  },
  {
    label: "AliExpress Bags & Heels",
    domain: "aliexpress:leather",
    badge: "Handbags, Belts & Boots",
  },
] as const;

/**
 * Pulls a live rack of clothing items directly from any public Shopify store domain
 * in <250ms via CORS-enabled /products.json and runs each garment through GWO's
 * Exact Fit & 3D Parametric Sizing Engine!
 */
export async function pullLiveShopifyStoreRack(
  domainOrUrl: string,
  limit = 6
): Promise<Product[]> {
  const raw = domainOrUrl.trim();
  if (!raw) return [];
  const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withProto);
  } catch {
    return [];
  }

  const host = parsed.hostname.replace(/^www\./i, "");
  const origin = parsed.origin;

  // Support collection URLs (/collections/<slug>) as well as root store domains!
  const collMatch = parsed.pathname.match(/\/collections\/([^/?#]+)/i);
  const endpoint = collMatch?.[1]
    ? `${origin}/collections/${collMatch[1]}/products.json?limit=18`
    : `${origin}/products.json?limit=18`;

  const res = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5500),
  });
  if (!res.ok) {
    throw new Error(`Store feed returned HTTP ${res.status}`);
  }
  const data = await res.json();
  const rawList: RawShopifyProduct[] = Array.isArray(data?.products)
    ? data.products
    : [];

  // Prioritize wearable apparel (dresses, tops, bottoms, outerwear) over gift cards or jewelry
  const apparelSorted = [...rawList].sort((a, b) => {
    const score = (p: RawShopifyProduct) => {
      const s = `${p.title || ""} ${p.product_type || ""}`.toLowerCase();
      if (/gift card|shipping|protection|warranty/.test(s)) return -50;
      if (/necklace|earring|ring|bracelet|anklet|clip|sock/.test(s)) return -10;
      if (/dress|gown|romper|corset|skirt|top|pant|jean|jacket/.test(s)) return 20;
      return 5;
    };
    return score(b) - score(a);
  });

  const parsedProducts: Product[] = [];
  for (const rawProd of apparelSorted) {
    const titleStr = String(rawProd?.title || "");
    if (/gift card|shipping protection/i.test(titleStr)) continue;
    const prod = parseShopifyJsonProduct(
      rawProd,
      parsed.hostname,
      origin
    );
    if (prod.imageUrl) {
      parsedProducts.push(prod);
    }
    if (parsedProducts.length >= limit) break;
  }

  return parsedProducts;
}

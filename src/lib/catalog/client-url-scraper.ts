"use client";

import { GarmentCategory, GarmentSilhouette, Product, SizeMeasurementSpec } from "../types";

const DEFAULT_CHART: Record<string, SizeMeasurementSpec> = {
  XS: { bustMin: 30, bustMax: 32.5, waistMin: 23.5, waistMax: 25.5, hipsMin: 33.5, hipsMax: 35.5 },
  S: { bustMin: 32.5, bustMax: 35, waistMin: 25.5, waistMax: 28, hipsMin: 35.5, hipsMax: 38 },
  M: { bustMin: 35, bustMax: 37.5, waistMin: 28, waistMax: 30.5, hipsMin: 38, hipsMax: 40.5 },
  L: { bustMin: 37.5, bustMax: 40.5, waistMin: 30.5, waistMax: 33.5, hipsMin: 40.5, hipsMax: 43.5 },
  XL: { bustMin: 40.5, bustMax: 44, waistMin: 33.5, waistMax: 37, hipsMin: 43.5, hipsMax: 47 },
};

/**
 * Proxies external e-commerce CDN images through wsrv.nl when needed so hotlink-protected
 * stores (SHEIN, Zara, Revolve, Shopify imgix, etc.) always render cleanly with CORS.
 */
export function getSafeClothingImageUrl(rawImgUrl?: string, width = 640): string | undefined {
  if (!rawImgUrl) return undefined;
  const trimmed = rawImgUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  if (trimmed.includes("images.higgs.ai") || trimmed.includes("wsrv.nl")) return trimmed;
  const normalized = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
  return `https://wsrv.nl/?url=${encodeURIComponent(normalized)}&w=${width}&output=webp&q=85`;
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
    /favicon|android-chrome|apple-touch-icon|logo|sprite|flags\/|flag\.vercel|badge|pixel|1x1|blank\.gif|okendo.*200x200/i.test(
      s
    ) ||
    /[?&]w=1(&|$)/i.test(imgUrl) ||
    /[?&]h=10(&|$)/i.test(imgUrl)
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
    return { category: "dress", silhouette: /mini/.test(t) ? "mini-dress" : "slip-dress" };
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
  if (/(pink|blush|rose|coral|berry)/.test(t)) {
    return { colorName: "Soft Blush", colorHex: "#DFC1B8", accentHex: "#181615" };
  }
  if (/(brown|espresso|cacao|chocolate|mocha|truffle)/.test(t)) {
    return { colorName: "Espresso", colorHex: "#3C2A24", accentHex: "#FAF8F5" };
  }
  if (/(white|cream|ivory|sail|alabaster|bone)/.test(t)) {
    return { colorName: "Studio Cream", colorHex: "#F4EFE6", accentHex: "#181615" };
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

function formatBrand(hostname: string): string {
  const clean = hostname
    .replace(/^(www\.|us\.|m\.|shop\.|store\.)/i, "")
    .split(".")[0];
  const map: Record<string, string> = {
    thereformation: "Reformation",
    princesspolly: "Princess Polly",
    skims: "SKIMS",
    nike: "Nike",
    aloyoga: "Alo Yoga",
    shein: "SHEIN",
    aritzia: "Aritzia",
    lululemon: "Lululemon",
    zara: "Zara",
    revolve: "Revolve",
    gymshark: "Gymshark",
  };
  return map[clean.toLowerCase()] || clean.charAt(0).toUpperCase() + clean.slice(1);
}

/**
 * Ranks all candidate images from a scraped product page to pick the main hero clothing image.
 */
export function pickBestHeroProductImage(
  candidates: Array<{ alt: string; url: string }>,
  titleKeywords: string[]
): string | undefined {
  let bestUrl: string | undefined;
  let bestScore = -999;

  for (const { alt, url } of candidates) {
    if (!url || isJunkIconOrLogo(url, alt)) continue;
    let score = 0;
    const lowerAlt = alt.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Match title/slug words
    for (const kw of titleKeywords) {
      if (kw.length >= 3 && (lowerAlt.includes(kw) || lowerUrl.includes(kw))) {
        score += 18;
      }
    }

    // Prefer high-resolution PDP images
    if (/w=(1[0-9]{3}|2[0-9]{3})|t_pdp_1728|t_pdp_1280|t_pdp_864|_grande|2000x|1200x/i.test(url)) {
      score += 35;
    }
    if (/\/products\/|\/files\/|pdp|front|-flt|-fr\./i.test(url)) {
      score += 20;
    }
    if (/front view|flat|on a model/i.test(lowerAlt)) {
      score += 25;
    }

    // Penalize tiny nav/recommendation thumbnails
    if (/[?&](w|h)=(87|100|160|176|200|205)(&|$)|100x100|335x184/i.test(url)) {
      score -= 35;
    }

    if (score > bestScore) {
      bestScore = score;
      bestUrl = url;
    }
  }

  return bestUrl;
}

export interface BrowserScrapeResult {
  product: Product;
  /** True if the store gated automated scraping behind a bot wall so user can optionally paste/drop an image */
  needsManualPhotoHint: boolean;
}

/**
 * Browser-side live product extractor for static deployments (GitHub Pages).
 * Uses Jina Reader CORS JSON + Microlink fallback + direct image URL support.
 */
export async function scrapeProductInBrowser(rawUrl: string): Promise<BrowserScrapeResult> {
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

  // Extract readable slug fallback from URL path
  const rawSlug =
    parsedUrl.pathname
      .split("/")
      .filter((s) => s && !/^(t|p|products|product|us|en)$/i.test(s))
      .pop() || "Imported Piece";
  const cleanSlugTitle = rawSlug
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  // Case 1: User pasted a direct clothing image URL (e.g. Copy Image Address from SHEIN/Zara/etc.)
  if (isDirectImageUrl(normalizedUrl)) {
    const { category, silhouette } = inferClientCategory(cleanSlugTitle);
    const { colorName, colorHex, accentHex } = inferClientColor(cleanSlugTitle);
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
        imageUrl: getSafeClothingImageUrl(normalizedUrl, 720),
        occasions: ["Everyday", "Going Out"],
        vibes: ["Curated Closet"],
        availableSizes: category === "shoes" ? ["6.5", "7", "7.5", "8", "8.5"] : ["XS", "S", "M", "L"],
        sizeChartInches: category === "shoes" ? {} : DEFAULT_CHART,
        estDeliveryDays: 4,
        inStock: true,
        sourceType: "scraped_url",
        lastScrapedAt: nowIso,
        staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
      },
    };
  }

  let extractedTitle = "";
  let extractedImage: string | undefined;
  let extractedPrice = 0;

  // Case 2: Jina Reader CORS JSON with Images Summary (works directly from GitHub Pages with ACAO!)
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "markdown",
        "X-With-Images-Summary": "true",
      },
      signal: AbortSignal.timeout(9500),
    });
    if (jinaRes.ok) {
      const json = await jinaRes.json();
      const pageTitle = String(json?.data?.title || "").trim();
      const content = String(json?.data?.content || "");
      const blocked =
        /404 not found|verify you are human|access denied|robot|just a moment/i.test(
          `${pageTitle} ${content.slice(0, 300)}`
        );

      if (!blocked) {
        if (pageTitle && !/^nike store\.|^gymshark$/i.test(pageTitle)) {
          extractedTitle = pageTitle.split(/\s+[|\-–—]\s+/)[0].trim();
        }
        // Extract price like $48 or $128.00 from markdown content
        const priceMatch = content.match(/\$\s?([1-9][0-9]{1,3}(?:\.[0-9]{2})?)/);
        if (priceMatch) {
          const p = Number(priceMatch[1]);
          if (p >= 8 && p <= 2500) extractedPrice = p;
        }

        const imgsObj = json?.data?.images as Record<string, string> | undefined;
        if (imgsObj && typeof imgsObj === "object") {
          const candidates = Object.entries(imgsObj).map(([alt, url]) => ({
            alt,
            url: String(url),
          }));
          const kwSource = `${extractedTitle || cleanSlugTitle}`
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length >= 3);
          extractedImage = pickBestHeroProductImage(candidates, kwSource);
        }
      }
    }
  } catch {
    // Fall through to Microlink backup
  }

  // Case 3: Microlink OpenGraph backup if Jina didn't find an image
  if (!extractedImage) {
    try {
      const mlRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(normalizedUrl)}`,
        { signal: AbortSignal.timeout(6500) }
      );
      if (mlRes.ok) {
        const ml = await mlRes.json();
        const mlTitle = String(ml?.data?.title || "");
        const mlImg = String(ml?.data?.image?.url || "");
        if (
          mlImg &&
          !/404 not found|just a moment|verify you are human/i.test(mlTitle) &&
          !isJunkIconOrLogo(mlImg, mlTitle)
        ) {
          extractedImage = mlImg;
          if (!extractedTitle && mlTitle) {
            extractedTitle = mlTitle.split(/\s+[|\-–—]\s+/)[0].trim();
          }
        }
      }
    } catch {
      // Ignore rate limit / network error
    }
  }

  const finalTitle = extractedTitle || cleanSlugTitle;
  const { category, silhouette } = inferClientCategory(`${finalTitle} ${parsedUrl.pathname}`);
  const { colorName, colorHex, accentHex } = inferClientColor(`${finalTitle} ${parsedUrl.pathname}`);
  const nowIso = new Date().toISOString();

  return {
    needsManualPhotoHint: !extractedImage,
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
      imageUrl: extractedImage ? getSafeClothingImageUrl(extractedImage, 720) : undefined,
      occasions: ["Everyday", "Going Out", "Weekend"],
      vibes: ["Model Off-Duty", "Clean Girl"],
      availableSizes: category === "shoes" ? ["6.5", "7", "7.5", "8", "8.5"] : ["XS", "S", "M", "L"],
      sizeChartInches: category === "shoes" ? {} : DEFAULT_CHART,
      estDeliveryDays: 4,
      inStock: true,
      sourceType: "scraped_url",
      lastScrapedAt: nowIso,
      staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
    },
  };
}

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
  const trimmed = rawImgUrl.trim();
  if (!trimmed) return undefined;
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

function labelAngleFromText(alt: string, url: string, idx: number): string {
  const s = `${alt} ${url}`.toLowerCase();
  if (/flat|-flt\b|laydown|packshot/.test(s)) return "Flat-Lay Cut";
  if (/back view|-bk\b|_back|rear/.test(s)) return "Model Back";
  if (/side view|-sd\b|_side|profile/.test(s)) return "Model Side";
  if (/detail|close[\s-]?up|fabric|zoom/.test(s)) return "Fabric Detail";
  if (/front view|-fr\b|_front/.test(s) || idx === 0) return "Model Front";
  return `Model Angle ${idx + 1}`;
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

    if (/\/products\/|\/files\/|pdp|front|-flt|-fr\.|-bk\./i.test(upgraded)) {
      score += 24;
    }
    if (/on a model|front view|back view|image \d/i.test(lowerAlt)) {
      score += 22;
    }
    // Penalize cross-sell tiny cards on SKIMS (w=1&h=1 or h=205) and generic CMS hero banners (contentstack/sanity)
    if (
      /[?&]w=1(&|$)|[?&]h=205(&|$)|skims-sanity\.imgix\.net|images\.contentstack\.io/i.test(
        url
      )
    ) {
      score -= 55;
    }
    if (keywordHits === 0 && titleKeywords.length >= 2) {
      score -= 15;
    }

    const baseKey = upgraded.split("?")[0].replace(/_\d+x\d*\./, ".");
    scored.push({ alt, url: upgraded, baseKey, score });
  }

  scored.sort((a, b) => b.score - a.score);

  const seenBase = new Set<string>();
  const angles: ProductGalleryAngle[] = [];

  for (const item of scored) {
    if (item.score < 5 && angles.length > 0) break;
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

  // Tier 1: Jina Reader CORS JSON with full Markdown + Images Summary
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${normalizedUrl}`, {
      headers: {
        Accept: "application/json",
        "X-Return-Format": "markdown",
        "X-With-Images-Summary": "true",
      },
      signal: AbortSignal.timeout(8000),
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
        pdpMarkdown = content;
        if (pageTitle && !/^nike store\.|^gymshark$/i.test(pageTitle)) {
          extractedTitle = pageTitle.split(/\s+[|\-–—]\s+/)[0].trim();
        }
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
            .filter((w) => w.length >= 3 && !/^(the|and|for|with|womens|women)$/.test(w));
          galleryAngles = extractProductGalleryAngles(candidates, kwSource);
        }
      }
    }
  } catch {
    // Fall through to Microlink backup
  }

  // Tier 2: Microlink OpenGraph backup if Jina didn't find an image
  if (galleryAngles.length === 0) {
    try {
      const mlRes = await fetch(
        `https://api.microlink.io/?url=${encodeURIComponent(normalizedUrl)}`,
        { signal: AbortSignal.timeout(6500) }
      );
      if (mlRes.ok) {
        const ml = await mlRes.json();
        const mlTitle = String(ml?.data?.title || "");
        const mlDesc = String(ml?.data?.description || "");
        const mlImg = String(ml?.data?.image?.url || "");
        if (
          mlImg &&
          !/404 not found|just a moment|verify you are human/i.test(mlTitle) &&
          !isJunkIconOrLogo(mlImg, mlTitle)
        ) {
          const safeHero = getSafeClothingImageUrl(mlImg, 960);
          if (safeHero) {
            galleryAngles = [{ url: safeHero, label: "Model Front" }];
          }
          if (!extractedTitle && mlTitle) {
            extractedTitle = mlTitle.split(/\s+[|\-–—]\s+/)[0].trim();
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

  const galleryAngles: ProductGalleryAngle[] = (sp.images || [])
    .slice(0, 5)
    .map((img, idx) => {
      const safe = getSafeClothingImageUrl(String(img?.src || ""), 880);
      if (!safe) return null;
      return {
        url: safe,
        label: labelAngleFromText(String(img?.alt || ""), String(img?.src || ""), idx),
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
    label: "Babyboo Fashion",
    domain: "babyboofashion-com-au.myshopify.com",
    badge: "Corset & Mini Dresses",
  },
  {
    label: "Princess Polly",
    domain: "us.princesspolly.com",
    badge: "Petite & Going Out",
  },
  {
    label: "EDIKTED",
    domain: "edikted.com",
    badge: "Street & Party",
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

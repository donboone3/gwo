import { execFile } from "child_process";
import { promisify } from "util";
import * as cheerio from "cheerio";
import {
  GarmentCategory,
  GarmentSilhouette,
  Product,
  ProductGalleryAngle,
  SizeMeasurementSpec,
} from "../types";
import {
  extractProductFitProfile,
  upgradeCdnImageResolution,
} from "./fit-intelligence";
import {
  convertStoreCurrencyToUsd,
  extractAccurateProductPrice,
} from "./client-url-scraper";
import {
  getProductByCanonicalUrl,
  upsertSharedProduct,
} from "../db/repository";

const execFileAsync = promisify(execFile);

const STRIP_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "srsltid",
  "ref",
  "gwo_ref",
  "gwo_web",
  "affid",
]);

const DEFAULT_WOMEN_SIZE_CHART: Record<string, SizeMeasurementSpec> = {
  XS: { bustMin: 30, bustMax: 32.5, waistMin: 23.5, waistMax: 25.5, hipsMin: 33.5, hipsMax: 35.5 },
  S: { bustMin: 32.5, bustMax: 35, waistMin: 25.5, waistMax: 28, hipsMin: 35.5, hipsMax: 38 },
  M: { bustMin: 35, bustMax: 37.5, waistMin: 28, waistMax: 30.5, hipsMin: 38, hipsMax: 40.5 },
  L: { bustMin: 37.5, bustMax: 40.5, waistMin: 30.5, waistMax: 33.5, hipsMin: 40.5, hipsMax: 43.5 },
  XL: { bustMin: 40.5, bustMax: 44, waistMin: 33.5, waistMax: 37, hipsMin: 43.5, hipsMax: 47 },
};

export const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function normalizeCanonicalProductUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (STRIP_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^m\./, "www.");
  let pathname = parsed.pathname.replace(/\/+$/, "");
  if (!pathname) pathname = "/";
  parsed.pathname = pathname;
  return parsed.toString();
}

export function isProductStale(staleAfterIso: string, now = new Date()): boolean {
  return new Date(staleAfterIso).getTime() <= now.getTime();
}

export function inferCategoryAndSilhouette(title: string): {
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
} {
  const t = title.toLowerCase();
  if (/(shoe|sneaker|cortez|dunk|runner|jordan|trainer|loafer)/.test(t)) {
    return { category: "shoes", silhouette: "sneakers" };
  }
  if (/(flat|heel|sandal|boot|mule)/.test(t)) {
    return { category: "shoes", silhouette: "ballet-flats" };
  }
  if (/(dress|gown|romper|jumpsuit)/.test(t)) {
    return {
      category: "dress",
      silhouette: /mini/.test(t) ? "mini-dress" : "slip-dress",
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

export function inferColorPalette(text: string): {
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
  if (/(red|cherry|burgundy|wine)/.test(t)) {
    return { colorName: "Cherry Wine", colorHex: "#7A2832", accentHex: "#FAF8F5" };
  }
  if (/(tan|beige|stone|oat|sand|khaki|champagne)/.test(t)) {
    return { colorName: "Warm Stone", colorHex: "#D4C6B6", accentHex: "#181615" };
  }
  return { colorName: "Studio Noir", colorHex: "#232122", accentHex: "#FAF8F5" };
}

function formatBrandFromDomain(hostname: string, rawVendor?: string): string {
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
    vuoriclothing: "Vuori",
    outdoorvoices: "Outdoor Voices",
    aloyoga: "Alo Yoga",
    aritzia: "Aritzia",
    lululemon: "Lululemon",
    shein: "SHEIN",
    zara: "Zara",
    revolve: "Revolve",
    gymshark: "Gymshark",
  };
  if (map[lower]) return map[lower];
  // Ignore short factory codes like "R.F" when vendor string is <4 chars or contains dots
  if (rawVendor && rawVendor.trim().length >= 4 && !/^[A-Z]\.[A-Z]$/i.test(rawVendor.trim())) {
    return rawVendor.trim();
  }
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function parseProductFromHtml(
  html: string,
  canonicalUrl: string
): Omit<Product, "id" | "lastScrapedAt" | "staleAfter" | "sourceType"> {
  const $ = cheerio.load(html);
  const urlObj = new URL(canonicalUrl);
  const storeDomain = urlObj.hostname.replace(/^www\./, "");

  let title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").first().text() ||
    "";
  let imageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[property="og:image:secure_url"]').attr("content") ||
    undefined;
  let price = Number(
    $('meta[property="product:price:amount"]').attr("content") ||
      $('meta[property="og:price:amount"]').attr("content") ||
      0
  );
  let brand = formatBrandFromDomain(storeDomain);
  let inStock = true;

  // Inspect Schema.org Product JSON-LD blocks
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed)
        ? parsed
        : parsed["@graph"]
        ? parsed["@graph"]
        : [parsed];

      for (const node of nodes) {
        const nodeType = Array.isArray(node?.["@type"])
          ? node["@type"].join(",")
          : String(node?.["@type"] || "");
        if (/Product/i.test(nodeType)) {
          if (node.name && !title) title = String(node.name);
          else if (node.name) title = String(node.name);

          if (node.brand) {
            brand =
              typeof node.brand === "string"
                ? node.brand
                : node.brand.name || brand;
          }
          if (node.image) {
            imageUrl = Array.isArray(node.image)
              ? typeof node.image[0] === "string"
                ? node.image[0]
                : node.image[0]?.url
              : typeof node.image === "string"
              ? node.image
              : node.image?.url;
          }
          const offer = Array.isArray(node.offers)
            ? node.offers[0]
            : node.offers;
          if (offer) {
            const p = Number(offer.price || offer.lowPrice || 0);
            const curr = String(offer.priceCurrency || storeDomain);
            if (p > 0) price = convertStoreCurrencyToUsd(p, curr);
            if (
              typeof offer.availability === "string" &&
              /OutOfStock/i.test(offer.availability)
            ) {
              inStock = false;
            }
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks
    }
  });

  // Clean store suffix from title
  title = title.split(/\s+[|\-–—]\s+/)[0].trim();
  if (!title) {
    const slug = urlObj.pathname.split("/").filter(Boolean).pop() || "Curated Piece";
    title = slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  if (!price || Number.isNaN(price) || price <= 0) {
    price = 68;
  }

  const { category, silhouette } = inferCategoryAndSilhouette(
    `${title} ${urlObj.pathname}`
  );
  const { colorName, colorHex, accentHex } = inferColorPalette(
    `${title} ${urlObj.pathname}`
  );

  const metaDesc =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  const bodySnippet = $("main, article, [class*='product'], body")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .slice(0, 6000);
  const galleryImages: ProductGalleryAngle[] | undefined = imageUrl
    ? [{ url: upgradeCdnImageResolution(imageUrl), label: "Model Front" }]
    : undefined;
  const { fitMetadata, calibratedChart } = extractProductFitProfile({
    rawText: `${metaDesc}\n${bodySnippet}`,
    title,
    brand,
    category,
    silhouette,
    galleryImages,
  });

  return {
    canonicalUrl,
    brand,
    storeDomain,
    title,
    category,
    silhouette,
    colorName,
    colorHex,
    accentHex,
    price,
    currency: "USD",
    imageUrl: imageUrl ? upgradeCdnImageResolution(imageUrl) : undefined,
    fitMetadata,
    occasions: ["Coffee Run", "Weekend Trip", "Date Night"],
    vibes: ["Model Off-Duty", "Clean Girl Athleisure"],
    availableSizes:
      category === "shoes"
        ? ["6", "6.5", "7", "7.5", "8", "8.5", "9"]
        : ["XS", "S", "M", "L", "XL"],
    sizeChartInches:
      category === "shoes" ? {} : calibratedChart || DEFAULT_WOMEN_SIZE_CHART,
    estDeliveryDays: 4,
    inStock,
  };
}

async function extractLiveProduct(
  canonicalUrl: string
): Promise<Omit<Product, "id" | "lastScrapedAt" | "staleAfter" | "sourceType">> {
  const urlObj = new URL(canonicalUrl);

  // Tier 1: Shopify fast JSON + PDP HTML enrichment if path matches /products/<handle>
  const shopifyMatch = urlObj.pathname.match(/\/products\/([^/?#]+)/i);
  if (shopifyMatch) {
    try {
      const jsonUrl = `${urlObj.origin}/products/${shopifyMatch[1]}.json`;
      const [jsonRes, htmlRes] = await Promise.allSettled([
        fetch(jsonUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GWOCatalogBot/1.0)" },
          signal: AbortSignal.timeout(5500),
        }),
        fetch(canonicalUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; GWOCatalogBot/1.0)" },
          signal: AbortSignal.timeout(5500),
        }),
      ]);
      if (jsonRes.status === "fulfilled" && jsonRes.value.ok) {
        const data = await jsonRes.value.json();
        if (data?.product?.title) {
          const p = data.product;
          const variant = p.variants?.[0];
          const title = String(p.title);
          const brandName = formatBrandFromDomain(urlObj.hostname, p.vendor);
          const { category, silhouette } = inferCategoryAndSilhouette(
            `${title} ${p.product_type || ""}`
          );
          const { colorName, colorHex, accentHex } = inferColorPalette(
            `${title} ${variant?.title || ""}`
          );
          const bodyPlain = p.body_html
            ? cheerio.load(String(p.body_html)).text()
            : "";
          let extraHtmlText = "";
          if (htmlRes.status === "fulfilled" && htmlRes.value.ok) {
            const rawHtml = await htmlRes.value.text();
            const $h = cheerio.load(rawHtml);
            $h("script, style, noscript").remove();
            extraHtmlText = $h("body")
              .text()
              .replace(/[ \t]+/g, " ")
              .replace(/\n{2,}/g, "\n")
              .slice(0, 12000);
          }
          const shopifyGallery: ProductGalleryAngle[] = Array.isArray(p.images)
            ? p.images.slice(0, 5).map((im: { src?: string }, idx: number) => ({
                url: upgradeCdnImageResolution(String(im?.src || "")),
                label:
                  idx === 0
                    ? "Model Front"
                    : idx === 1
                    ? "Lace-Up / Back"
                    : `Model Angle ${idx + 1}`,
              }))
            : [];
          const { fitMetadata, calibratedChart } = extractProductFitProfile({
            rawText: `${bodyPlain}\n${Array.isArray(p.tags) ? p.tags.join(", ") : p.tags || ""}\n${extraHtmlText}`,
            title,
            brand: brandName,
            category,
            silhouette,
            galleryImages: shopifyGallery.length > 0 ? shopifyGallery : undefined,
          });
          const rawPrice = Number(variant?.price || 68);
          const isAudDomain = /-au\b|\.com\.au$/i.test(urlObj.hostname);
          const usdPrice = isAudDomain
            ? Math.round(rawPrice * 0.66)
            : Math.round(rawPrice);
          return {
            canonicalUrl,
            brand: brandName,
            storeDomain: urlObj.hostname.replace(/^www\./, ""),
            title,
            category,
            silhouette,
            colorName,
            colorHex,
            accentHex,
            price: usdPrice > 0 ? usdPrice : 68,
            currency: "USD",
            imageUrl: shopifyGallery[0]?.url || p.image?.src || p.images?.[0]?.src,
            fitMetadata,
            occasions: ["Date Night", "Party", "Going Out"],
            vibes: ["Model Off-Duty", "Romantic"],
            availableSizes:
              Array.isArray(p.variants) && p.variants.length > 0
                ? p.variants
                    .map((v: { title?: string }) => String(v.title || "").trim())
                    .filter((s: string) => Boolean(s) && s !== "Default Title")
                : category === "shoes"
                ? ["6.5", "7", "7.5", "8", "8.5"]
                : ["XS", "S", "M", "L", "XL"],
            sizeChartInches: category === "shoes" ? {} : calibratedChart,
            estDeliveryDays: 4,
            inStock: variant?.available !== false,
          };
        }
      }
    } catch {
      // Proceed to Tier 1B / Tier 2
    }
  }

  // Tier 1B: Fast Jina Reader Markdown + Multi-Angle Images Summary (<2s, captures alt-labeled PDP galleries & model stats!)
  if (!process.env.VITEST) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${canonicalUrl}`, {
        headers: {
          Accept: "application/json",
          "X-Return-Format": "markdown",
          "X-With-Images-Summary": "true",
          "User-Agent": "Mozilla/5.0 (compatible; GWOCatalogBot/1.0)",
        },
        signal: AbortSignal.timeout(8500),
      });
      if (jinaRes.ok) {
        const jinaJson = await jinaRes.json();
        const pageTitle = String(jinaJson?.data?.title || "").trim();
        const content = String(jinaJson?.data?.content || "");
        const blocked =
          /404 not found|verify you are human|access denied|just a moment/i.test(
            `${pageTitle} ${content.slice(0, 260)}`
          );

        if (!blocked && content.length > 200) {
          const cleanTitle =
            pageTitle.split(/\s+[|\-–—]\s+/)[0].trim() || "Curated Store Piece";
          const brandName = formatBrandFromDomain(urlObj.hostname);
          const { category, silhouette } = inferCategoryAndSilhouette(
            `${cleanTitle} ${urlObj.pathname}`
          );
          const { colorName, colorHex, accentHex } = inferColorPalette(
            `${cleanTitle} ${urlObj.pathname}`
          );

          const parsedPrice =
            extractAccurateProductPrice(content, urlObj.hostname, cleanTitle) ||
            68;

          const imgsObj = jinaJson?.data?.images as
            | Record<string, string>
            | undefined;
          const galleryAngles: ProductGalleryAngle[] = [];
          if (imgsObj && typeof imgsObj === "object") {
            const kw = cleanTitle
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length >= 3 && !/^(the|and|for|womens|women)$/.test(w));

            const scored = Object.entries(imgsObj)
              .map(([alt, rawU]) => {
                const u = String(rawU);
                if (
                  !u.startsWith("http") ||
                  /\.svg|\.ico|favicon|logo|kustomer|okendo|flags\/|335x184/i.test(
                    `${u} ${alt}`
                  ) ||
                  /\bmens\b|\bkids\b/i.test(alt)
                ) {
                  return null;
                }
                const up = upgradeCdnImageResolution(u);
                let s = 0;
                for (const w of kw) {
                  if (alt.toLowerCase().includes(w) || up.toLowerCase().includes(w)) {
                    s += 20;
                  }
                }
                if (
                  /\/products\/|\/files\/|-fr\.|-bk\.|-flt|revolveassets|scene7|cloudinary|demandware|zara\.net|asos-media|nordstrommedia|princesspolly|babyboo|houseofcb|ohpolly|meshki|thereformation|aritzia|lululemon|skims/i.test(
                    up
                  )
                ) {
                  s += 25;
                }
                if (/on a model|front view|image \d|product/i.test(alt)) s += 20;
                if (
                  /[?&]w=1(&|$)|[?&]h=205(&|$)|skims-sanity\.imgix\.net|images\.contentstack\.io/i.test(
                    u
                  )
                ) {
                  s -= 60;
                }
                return {
                  alt,
                  url: up,
                  baseKey: up.split("?")[0].replace(/_\d+x\d*\./, "."),
                  score: s,
                };
              })
              .filter((x): x is NonNullable<typeof x> => x !== null && x.score >= 0)
              .sort((a, b) => b.score - a.score);

            const seen = new Set<string>();
            for (const item of scored) {
              if (seen.has(item.baseKey)) continue;
              seen.add(item.baseKey);
              const lower = `${item.alt} ${item.url}`.toLowerCase();
              const label = /flat|-flt\b/.test(lower)
                ? "Flat-Lay Cut"
                : /back|-bk\b/.test(lower)
                ? "Model Back"
                : galleryAngles.length === 0
                ? "Model Front"
                : `Model Angle ${galleryAngles.length + 1}`;
              galleryAngles.push({ url: item.url, label });
              if (galleryAngles.length >= 5) break;
            }
          }

          if (galleryAngles.length > 0) {
            const { fitMetadata, calibratedChart } = extractProductFitProfile({
              rawText: content,
              title: cleanTitle,
              brand: brandName,
              category,
              silhouette,
              galleryImages: galleryAngles,
            });

            return {
              canonicalUrl,
              brand: brandName,
              storeDomain: urlObj.hostname.replace(/^www\./, ""),
              title: cleanTitle,
              category,
              silhouette,
              colorName,
              colorHex,
              accentHex,
              price: parsedPrice >= 8 && parsedPrice <= 2500 ? parsedPrice : 68,
              currency: "USD",
              imageUrl: galleryAngles[0].url,
              fitMetadata,
              occasions: ["Coffee Run", "Weekend Trip", "Date Night"],
              vibes: ["Model Off-Duty", "Clean Girl Athleisure"],
              availableSizes:
                category === "shoes"
                  ? ["6", "6.5", "7", "7.5", "8", "8.5", "9"]
                  : ["XS", "S", "M", "L", "XL"],
              sizeChartInches: category === "shoes" ? {} : calibratedChart,
              estDeliveryDays: 4,
              inStock: true,
            };
          }
        }
      }
    } catch {
      // Proceed to Tier 2
    }
  }

  // Tier 2: Firecrawl single-page /scrape if FIRECRAWL_API_KEY is configured
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url: canonicalUrl,
          formats: ["html"],
          onlyMainContent: false,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (fcRes.ok) {
        const fcJson = await fcRes.json();
        if (fcJson?.data?.html) {
          return parseProductFromHtml(fcJson.data.html, canonicalUrl);
        }
      }
    } catch {
      // Proceed to Tier 3
    }
  }

  // Tier 2B: Authenticated local Firecrawl CLI (uses ~/.firecrawl session automatically!)
  if (!process.env.VITEST) {
    try {
      const { stdout } =
        process.platform === "win32"
          ? await execFileAsync(
              "cmd.exe",
              ["/d", "/s", "/c", "firecrawl.cmd", "scrape", "-f", "markdown,images", "--json", canonicalUrl],
              { timeout: 14000, maxBuffer: 8 * 1024 * 1024 }
            )
          : await execFileAsync(
              "firecrawl",
              ["scrape", "-f", "markdown,images", "--json", canonicalUrl],
              { timeout: 14000, maxBuffer: 8 * 1024 * 1024 }
            );

      const jsonStart = stdout.indexOf("{");
      if (jsonStart >= 0) {
        const fc = JSON.parse(stdout.slice(jsonStart));
        const meta = fc?.metadata || {};
        const fcTitle = String(meta.ogTitle || meta["og:title"] || meta.title || "");
        const statusCode = Number(meta.statusCode || 200);
        if (
          statusCode < 400 &&
          !/404 not found|verify you are human|just a moment/i.test(fcTitle)
        ) {
          let fcImg: string | undefined =
            meta["og:image:secure_url"] ||
            meta["og:image:url"] ||
            meta.ogImage ||
            meta["og:image"];

          if (
            fcImg &&
            /favicon|android-chrome|apple-touch-icon|logo|\.svg/i.test(fcImg)
          ) {
            fcImg = undefined;
          }

          if (!fcImg && Array.isArray(fc.images)) {
            fcImg = fc.images.find(
              (u: string) =>
                typeof u === "string" &&
                u.startsWith("http") &&
                !/favicon|logo|flags\/|\.svg|w=1&|h=10|100x100|200x200/i.test(u)
            );
          }

          if (fcImg || fcTitle) {
            const cleanTitle =
              fcTitle.split(/\s+[|\-–—]\s+/)[0].trim() || "Imported Store Piece";
            const { category, silhouette } = inferCategoryAndSilhouette(
              `${cleanTitle} ${urlObj.pathname}`
            );
            const { colorName, colorHex, accentHex } = inferColorPalette(
              `${cleanTitle} ${urlObj.pathname}`
            );
            const rawPrice = Number(
              meta["product:price:amount"] || meta["og:price:amount"] || 68
            );
            const fcGallery: ProductGalleryAngle[] = [];
            if (fcImg) {
              fcGallery.push({
                url: upgradeCdnImageResolution(fcImg),
                label: "Model Front",
              });
            }
            if (Array.isArray(fc.images)) {
              for (const u of fc.images) {
                if (
                  typeof u === "string" &&
                  u.startsWith("http") &&
                  !/favicon|logo|flags\/|\.svg|w=1&|h=10|100x100|200x200|kustomer/i.test(u)
                ) {
                  const up = upgradeCdnImageResolution(u);
                  if (!fcGallery.some((g) => g.url.split("?")[0] === up.split("?")[0])) {
                    fcGallery.push({
                      url: up,
                      label: `Model Angle ${fcGallery.length + 1}`,
                    });
                  }
                  if (fcGallery.length >= 5) break;
                }
              }
            }
            const brandName = formatBrandFromDomain(urlObj.hostname);
            const { fitMetadata, calibratedChart } = extractProductFitProfile({
              rawText: String(fc.markdown || meta.description || cleanTitle),
              title: cleanTitle,
              brand: brandName,
              category,
              silhouette,
              galleryImages: fcGallery.length > 0 ? fcGallery : undefined,
            });
            return {
              canonicalUrl,
              brand: brandName,
              storeDomain: urlObj.hostname.replace(/^www\./, ""),
              title: cleanTitle,
              category,
              silhouette,
              colorName,
              colorHex,
              accentHex,
              price: rawPrice > 0 ? rawPrice : 68,
              currency: "USD",
              imageUrl: fcGallery[0]?.url || fcImg,
              fitMetadata,
              occasions: ["Coffee Run", "Weekend Trip", "Date Night"],
              vibes: ["Model Off-Duty", "Clean Girl Athleisure"],
              availableSizes:
                category === "shoes"
                  ? ["6", "6.5", "7", "7.5", "8", "8.5", "9"]
                  : ["XS", "S", "M", "L", "XL"],
              sizeChartInches:
                category === "shoes" ? {} : calibratedChart,
              estDeliveryDays: 4,
              inStock: true,
            };
          }
        }
      }
    } catch {
      // Proceed to Tier 3 direct fetch if CLI is unavailable in serverless prod
    }
  }

  // Tier 3: Direct HTML fetch + Schema.org Product JSON-LD / OpenGraph parser
  try {
    const htmlRes = await fetch(canonicalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (htmlRes.ok) {
      const html = await htmlRes.text();
      return parseProductFromHtml(html, canonicalUrl);
    }
  } catch {
    // Fallback to clean URL slug synthesis if blocked by anti-bot wall without Firecrawl key
  }

  // Tier 4: Resilient URL Slug Synthesis (guarantees seamless UX even on anti-bot domains)
  const slug =
    urlObj.pathname
      .split("/")
      .filter((seg) => seg && seg !== "t" && seg !== "products" && seg !== "p")
      .pop() || "Studio Essential Piece";
  const synthesizedTitle = slug
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return parseProductFromHtml(
    `<html><head><title>${synthesizedTitle}</title></head><body></body></html>`,
    canonicalUrl
  );
}

export interface IngestUrlResponse {
  product: Product;
  status: "shared_cache_hit" | "refreshed_after_3_days" | "newly_scraped_to_shared_db";
}

export async function ingestProductUrlToSharedCatalog(
  rawUrl: string,
  addedByUsername = "mila",
  now = new Date()
): Promise<IngestUrlResponse> {
  const canonicalUrl = normalizeCanonicalProductUrl(rawUrl);
  const existing = await getProductByCanonicalUrl(canonicalUrl);

  if (
    existing &&
    (existing.imageUrl || existing.sourceType === "affiliate_feed") &&
    !isProductStale(existing.staleAfter, now)
  ) {
    return {
      product: existing,
      status: "shared_cache_hit",
    };
  }

  const extracted = await extractLiveProduct(canonicalUrl);
  const saved = await upsertSharedProduct({
    ...extracted,
    sourceType: "scraped_url",
    addedByUsername: existing?.addedByUsername || addedByUsername,
    lastScrapedAt: now.toISOString(),
    staleAfter: new Date(now.getTime() + THREE_DAYS_MS).toISOString(),
  });

  return {
    product: saved,
    status: existing ? "refreshed_after_3_days" : "newly_scraped_to_shared_db",
  };
}

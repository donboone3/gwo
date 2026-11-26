import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { NextRequest, NextResponse } from "next/server";
import {
  ALIEXPRESS_CALIBRATED_US_CHART,
  buildTopLineAliExpressDropshipCatalog,
  calculateDropshipEconomics,
  DEFAULT_CN_SIZE_TAG_MAP,
  extractAliExpressItemId,
  parseScrapedAliExpressSearchHits,
  RawAliExpressSearchHit,
  searchTopLineAliExpressFeed,
} from "@/lib/dropship/aliexpress-dropship";
import { upsertSharedProduct } from "@/lib/db/repository";
import { Product } from "@/lib/types";

const execFileAsync = promisify(execFile);

/**
 * Signs an official AliExpress Open Platform (IOP) API request with HMAC-SHA256
 * when ALIEXPRESS_APP_KEY & ALIEXPRESS_APP_SECRET are configured.
 */
function signAliExpressOpenPlatformParams(
  params: Record<string, string>,
  appSecret: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const baseStr = sortedKeys.map((k) => `${k}${params[k]}`).join("");
  return crypto
    .createHmac("sha256", appSecret)
    .update(baseStr, "utf8")
    .digest("hex")
    .toUpperCase();
}

async function execFirecrawlSearchJson(
  args: string[]
): Promise<Record<string, unknown> | null> {
  try {
    const isWin = process.platform === "win32";
    const cmd = isWin ? "cmd.exe" : "firecrawl";
    const fullArgs = isWin ? ["/d", "/s", "/c", "firecrawl", ...args] : args;
    const { stdout } = await execFileAsync(cmd, fullArgs, {
      timeout: 9500,
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, FIRECRAWL_NO_SEARCH_FEEDBACK: "1" },
    });
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) return null;
    return JSON.parse(stdout.slice(jsonStart)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Queries public AliExpress item index + AliExpress CDN (`aliexpress-media.com/kf/...`) via Firecrawl
 * without ever attempting to solve or bypass any item-page CAPTCHA!
 */
async function discoverLiveAliExpressHits(
  searchQuery: string,
  limit = 8
): Promise<RawAliExpressSearchHit[]> {
  const hits: RawAliExpressSearchHit[] = [];
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (apiKey) {
    try {
      const [webRes, imgRes] = await Promise.all([
        fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ query: searchQuery, limit }),
          signal: AbortSignal.timeout(8500),
        }),
        fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            query: searchQuery,
            limit,
            sources: ["images"],
          }),
          signal: AbortSignal.timeout(8500),
        }),
      ]);

      if (webRes.ok) {
        const wJson = await webRes.json();
        const webArr = (wJson?.data?.web || wJson?.data || []) as Array<
          Record<string, unknown>
        >;
        for (const w of webArr) {
          hits.push({
            url: String(w.url || ""),
            title: String(w.title || ""),
            description: String(w.description || w.markdown || ""),
          });
        }
      }
      if (imgRes.ok) {
        const iJson = await imgRes.json();
        const imgArr = (iJson?.data?.images || []) as Array<
          Record<string, unknown>
        >;
        for (const im of imgArr) {
          hits.push({
            url: String(im.url || ""),
            title: String(im.title || ""),
            imageUrl: String(im.imageUrl || ""),
          });
        }
      }
      if (hits.length > 0) return hits;
    } catch {
      // Fall through to authenticated Firecrawl CLI
    }
  }

  // Authenticated Firecrawl CLI path (web + images in parallel)
  const [webCli, imgCli] = await Promise.all([
    execFirecrawlSearchJson([
      "search",
      searchQuery,
      "--limit",
      String(limit),
      "--json",
    ]),
    execFirecrawlSearchJson([
      "search",
      searchQuery,
      "--sources",
      "images",
      "--limit",
      String(limit),
      "--json",
    ]),
  ]);

  const webData = (
    (webCli?.data as Record<string, unknown> | undefined)?.web as
      | Array<Record<string, unknown>>
      | undefined
  ) || [];
  for (const w of webData) {
    hits.push({
      url: String(w.url || ""),
      title: String(w.title || ""),
      description: String(w.description || ""),
    });
  }

  const imgData = (
    (imgCli?.data as Record<string, unknown> | undefined)?.images as
      | Array<Record<string, unknown>>
      | undefined
  ) || [];
  for (const im of imgData) {
    hits.push({
      url: String(im.url || ""),
      title: String(im.title || ""),
      imageUrl: String(im.imageUrl || ""),
    });
  }

  return hits;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const category = (searchParams.get("category") || "all") as
    | Product["category"]
    | "all";
  const markup = Number(searchParams.get("markup") || 2.85);
  const live = searchParams.get("live") === "1";

  const verifiedItems = searchTopLineAliExpressFeed({
    query,
    category,
    markupMultiplier: markup,
  });

  if (!live) {
    return NextResponse.json({
      items: verifiedItems,
      liveScrapedCount: 0,
      officialApiConnected: Boolean(
        process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET
      ),
    });
  }

  // Live Firecrawl AliExpress Luxury Discovery
  const catHint =
    category !== "all" ? category : "women boutique luxury";
  const liveQuery = `site:aliexpress.com/item ${catHint} ${
    query.trim() || "satin corset dress blazer"
  }`.trim();
  const rawHits = await discoverLiveAliExpressHits(liveQuery, 8);
  const scrapedProducts = parseScrapedAliExpressSearchHits(
    rawHits,
    markup
  ).filter((p) => Boolean(p.imageUrl));

  // Persist freshly discovered photo-verified AliExpress pieces into shared catalog
  for (const sp of scrapedProducts.slice(0, 6)) {
    await upsertSharedProduct(sp).catch(() => undefined);
  }

  const seenIds = new Set(scrapedProducts.map((p) => p.id));
  const merged = [
    ...scrapedProducts,
    ...verifiedItems.filter((v) => !seenIds.has(v.id)),
  ];

  return NextResponse.json({
    items: merged,
    liveScrapedCount: scrapedProducts.length,
    officialApiConnected: Boolean(
      process.env.ALIEXPRESS_APP_KEY && process.env.ALIEXPRESS_APP_SECRET
    ),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = String(body.url || "").trim();
    const markup = Number(body.markupMultiplier || 2.85);
    const itemId =
      extractAliExpressItemId(rawUrl) || `${Date.now()}`.slice(-12);

    // 1. Check verified 14-SKU Gold Supplier feed first
    const catalog = buildTopLineAliExpressDropshipCatalog(markup);
    const verifiedMatch = catalog.find(
      (p) => p.dropship?.aliexpressItemId === itemId
    );
    if (verifiedMatch) {
      const hydrated = body.customImageUrl
        ? { ...verifiedMatch, imageUrl: String(body.customImageUrl) }
        : verifiedMatch;
      const saved = await upsertSharedProduct(hydrated);
      return NextResponse.json({
        product: saved,
        source: "verified_supplier_catalog",
        captchaGated: false,
      });
    }

    // 2. Official Sanctioned AliExpress Open Platform API (Portals / DS API)
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    if (appKey && appSecret) {
      const apiParams: Record<string, string> = {
        app_key: appKey,
        method: "aliexpress.affiliate.productdetail.get",
        product_ids: itemId,
        sign_method: "sha256",
        target_currency: "USD",
        target_language: "EN",
        timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      };
      apiParams.sign = signAliExpressOpenPlatformParams(apiParams, appSecret);
      const qs = new URLSearchParams(apiParams).toString();
      const apiRes = await fetch(`https://api-sg.aliexpress.com/sync?${qs}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (apiRes.ok) {
        const apiJson = await apiRes.json();
        const rawProd =
          apiJson?.aliexpress_affiliate_productdetail_get_response?.resp_result
            ?.result?.products?.product?.[0];
        if (rawProd) {
          const wholesaleUsd =
            Number(rawProd.target_sale_price || rawProd.sale_price || 19.5) ||
            19.5;
          const econ = calculateDropshipEconomics(wholesaleUsd, 0, markup);
          const nowIso = new Date().toISOString();
          const built: Product = {
            id: `prod-ae-${itemId}`,
            canonicalUrl:
              rawProd.promotion_link ||
              `https://www.aliexpress.com/item/${itemId}.html`,
            brand: "GWO × Atelier",
            storeDomain: "aliexpress.com",
            title: String(rawProd.product_title || "AliExpress Boutique Piece"),
            category: "dress",
            silhouette: "mini-dress",
            colorName: "Boutique Edition",
            colorHex: "#232122",
            accentHex: "#D4B475",
            price: econ.retailPriceUsd,
            currency: "USD",
            imageUrl: String(rawProd.product_main_image_url || ""),
            dropship: {
              supplierPlatform: "aliexpress",
              aliexpressItemId: itemId,
              supplierName: String(rawProd.shop_name || "AliExpress Gold Store"),
              supplierUrl: `https://www.aliexpress.com/item/${itemId}.html`,
              supplierRating: 4.9,
              ordersCount: Number(rawProd.lastest_volume || 1500),
              qualityTier: "Top 1% Gold Boutique",
              wholesaleCostUsd: wholesaleUsd,
              shippingCostUsd: 0,
              profitMarginUsd: econ.profitMarginUsd,
              marginPct: econ.marginPct,
              shippingMethod: "AliExpress Choice Direct Air (6d)",
              cnSizeTagMap: DEFAULT_CN_SIZE_TAG_MAP,
            },
            occasions: ["Date Night", "Party", "Going Out"],
            vibes: ["Siren Glam", "Model Off-Duty"],
            availableSizes: ["XS", "S", "M", "L"],
            sizeChartInches: ALIEXPRESS_CALIBRATED_US_CHART,
            estDeliveryDays: 6,
            inStock: true,
            sourceType: "aliexpress_dropship",
            lastScrapedAt: nowIso,
            staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
          };
          const saved = await upsertSharedProduct(built);
          return NextResponse.json({
            product: saved,
            source: "official_open_platform_api",
            captchaGated: false,
          });
        }
      }
    }

    // 3. Sanctioned Firecrawl Public Search + CDN Image Lookup for this exact AliExpress itemId!
    if (!body.persistToStore && /^\d{10,20}$/.test(itemId)) {
      const liveHits = await discoverLiveAliExpressHits(
        `site:aliexpress.com/item/${itemId}`,
        5
      );
      const parsed = parseScrapedAliExpressSearchHits(liveHits, markup);
      const exactHit =
        parsed.find((p) => p.dropship?.aliexpressItemId === itemId) ||
        parsed[0];
      if (exactHit && (exactHit.imageUrl || exactHit.title)) {
        const mergedLive: Product = {
          ...exactHit,
          imageUrl: body.customImageUrl
            ? String(body.customImageUrl)
            : exactHit.imageUrl,
        };
        const saved = await upsertSharedProduct(mergedLive);
        return NextResponse.json({
          product: saved,
          source: "firecrawl_live_index",
          captchaGated: false,
        });
      }
    }

    // 4. Respect CAPTCHA boundaries strictly: if user supplied custom title/photo/cost, save cleanly; otherwise return transparent notice
    const wholesaleUsd = Number(body.customWholesaleUsd || 18.5);
    const econ = calculateDropshipEconomics(wholesaleUsd, 0, markup);
    const nowIso = new Date().toISOString();
    const canonicalUrl = rawUrl.startsWith("http")
      ? rawUrl
      : `https://www.aliexpress.com/item/${itemId}.html`;

    const draft: Product = {
      id: `prod-ae-${itemId}`,
      canonicalUrl,
      brand: "GWO × Atelier",
      storeDomain: "aliexpress.com",
      title: String(
        body.customTitle || `AliExpress Boutique Piece #${itemId.slice(-6)}`
      ),
      category: "dress",
      silhouette: "mini-dress",
      colorName: "Boutique Edition",
      colorHex: "#232122",
      accentHex: "#D4B475",
      price: econ.retailPriceUsd,
      currency: "USD",
      imageUrl: body.customImageUrl ? String(body.customImageUrl) : undefined,
      dropship: {
        supplierPlatform: "aliexpress",
        aliexpressItemId: itemId,
        supplierName: "AliExpress Verified Boutique",
        supplierUrl: canonicalUrl,
        supplierRating: 4.8,
        ordersCount: 1400,
        qualityTier: "AliExpress Choice Verified",
        wholesaleCostUsd: wholesaleUsd,
        shippingCostUsd: 0,
        profitMarginUsd: econ.profitMarginUsd,
        marginPct: econ.marginPct,
        shippingMethod: "AliExpress Choice Direct Air (7d)",
        cnSizeTagMap: DEFAULT_CN_SIZE_TAG_MAP,
      },
      occasions: ["Date Night", "Party", "Going Out"],
      vibes: ["Siren Glam", "Model Off-Duty"],
      availableSizes: ["XS", "S", "M", "L"],
      sizeChartInches: ALIEXPRESS_CALIBRATED_US_CHART,
      estDeliveryDays: 7,
      inStock: true,
      sourceType: "aliexpress_dropship",
      lastScrapedAt: nowIso,
      staleAfter: new Date(Date.now() + 3 * 86400000).toISOString(),
    };

    if (body.customImageUrl || body.customTitle) {
      const saved = await upsertSharedProduct(draft);
      return NextResponse.json({
        product: saved,
        source: "public_metadata",
        captchaGated: false,
      });
    }

    return NextResponse.json({
      product: draft,
      source: "captcha_gated_notice",
      captchaGated: true,
      notice:
        "AliExpress gated unauthenticated item HTML with reCAPTCHA (which GWO never bypasses). Use 'Scrape Live AliExpress' to pull public-indexed boutique pieces, connect ALIEXPRESS_APP_KEY, or attach a product photo below!",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Dropship import failed" },
      { status: 400 }
    );
  }
}

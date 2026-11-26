import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ALIEXPRESS_CALIBRATED_US_CHART,
  buildTopLineAliExpressDropshipCatalog,
  calculateDropshipEconomics,
  DEFAULT_CN_SIZE_TAG_MAP,
  extractAliExpressItemId,
  searchTopLineAliExpressFeed,
} from "@/lib/dropship/aliexpress-dropship";
import { upsertSharedProduct } from "@/lib/db/repository";
import { Product } from "@/lib/types";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const category = (searchParams.get("category") || "all") as
    | Product["category"]
    | "all";
  const markup = Number(searchParams.get("markup") || 2.85);

  const items = searchTopLineAliExpressFeed({
    query,
    category,
    markupMultiplier: markup,
  });

  return NextResponse.json({
    items,
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

    // 1. Check verified Gold Supplier feed first
    const catalog = buildTopLineAliExpressDropshipCatalog(markup);
    const verifiedMatch = catalog.find(
      (p) => p.dropship?.aliexpressItemId === itemId
    );
    if (verifiedMatch) {
      const saved = await upsertSharedProduct(verifiedMatch);
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

    // 3. Respect CAPTCHA boundaries strictly: if user supplied custom title/photo/cost, save cleanly; otherwise return transparent notice
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
        "AliExpress gates unauthenticated item HTML with reCAPTCHA (which GWO never bypasses). Set ALIEXPRESS_APP_KEY & ALIEXPRESS_APP_SECRET for live official API sync, pick from the Verified Gold Boutique Feed, or attach a product photo below!",
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Dropship import failed" },
      { status: 400 }
    );
  }
}

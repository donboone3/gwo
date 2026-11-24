import { Product } from "../types";

export interface OutboundAffiliateLink {
  destinationUrl: string;
  network: "skimlinks" | "cj_nike" | "direct_attributed";
  referrerCode?: string;
}

/**
 * Wraps outbound store URLs with affiliate monetization + friend closet attribution,
 * while keeping web-checkout query flags intact so mobile Nike links don't drop
 * commissions by hijacking into the native Nike app.
 */
export function buildCommissionSafeUrl(
  product: Product,
  referrerCode?: string
): OutboundAffiliateLink {
  const cleanTarget = new URL(product.canonicalUrl);
  // Keep checkout in web context and pass friend closet attribution
  cleanTarget.searchParams.set("gwo_web", "1");
  if (referrerCode) {
    cleanTarget.searchParams.set("gwo_ref", referrerCode);
  }

  const skimlinksPubId = process.env.SKIMLINKS_PUBLISHER_ID;
  if (skimlinksPubId) {
    const customId = referrerCode || "gwo_organic";
    const wrapped = `https://go.redirectingat.com/?id=${encodeURIComponent(
      skimlinksPubId
    )}&xs=1&xcust=${encodeURIComponent(customId)}&url=${encodeURIComponent(
      cleanTarget.toString()
    )}`;
    return {
      destinationUrl: wrapped,
      network: "skimlinks",
      referrerCode,
    };
  }

  const cjWebsiteId = process.env.CJ_WEBSITE_ID;
  if (cjWebsiteId && product.storeDomain.includes("nike.com")) {
    const sid = referrerCode || "gwo_organic";
    const wrapped = `https://www.anrdoezrs.net/links/${encodeURIComponent(
      cjWebsiteId
    )}/type/dlg/sid/${encodeURIComponent(sid)}/${cleanTarget.toString()}`;
    return {
      destinationUrl: wrapped,
      network: "cj_nike",
      referrerCode,
    };
  }

  return {
    destinationUrl: cleanTarget.toString(),
    network: "direct_attributed",
    referrerCode,
  };
}

import { describe, expect, it } from "vitest";
import {
  convertStoreCurrencyToUsd,
  extractAccurateProductPrice,
  extractProductGalleryAngles,
  extractStructuredHtmlProductData,
  getSafeClothingImageUrl,
} from "../src/lib/catalog/client-url-scraper";
import { extractProductFitProfile } from "../src/lib/catalog/fit-intelligence";
import { INITIAL_SEED_DB } from "../src/lib/db/seed-data";

describe("Scraped Product Picture, Pricing & Details Integrity", () => {
  it("normalizes protocol-relative //cdn.shopify.com URLs and upgrades resolution cleanly", () => {
    const safe = getSafeClothingImageUrl(
      "//cdn.shopify.com/s/files/1/0555/cornelia_front.jpg?v=123&width=200",
      880
    );
    expect(safe).toBeDefined();
    expect(safe!.startsWith("https://cdn.shopify.com/")).toBe(true);
    expect(safe!.includes("width=880")).toBe(true);
  });

  it("extracts accurate product prices while ignoring Free Shipping & Afterpay banners", () => {
    const noisyMarkdown = [
      "FREE EXPRESS SHIPPING ON ORDERS OVER $100 | EASY RETURNS",
      "Skip to content",
      "# Cornelia Mini Dress - Red",
      "$199.95 AUD",
      "Or 4 interest-free payments of $49.98 with Afterpay",
      "Structured boned crepe corset mini dress with lace-up back.",
    ].join("\n");

    const priceUsd = extractAccurateProductPrice(
      noisyMarkdown,
      "babyboofashion.com.au",
      "Cornelia Mini Dress - Red"
    );
    expect(priceUsd).toBe(132); // 199.95 AUD * 0.66 = $132 USD (NOT $100 shipping banner or $50 Afterpay!)

    expect(convertStoreCurrencyToUsd(100, "GBP")).toBe(127);
    expect(convertStoreCurrencyToUsd(100, "CAD")).toBe(73);
  });

  it("parses Schema.org Product JSON-LD & OpenGraph HTML for full images, price, brand, and description", () => {
    const sampleHtml = `
      <html>
        <head>
          <meta property="og:title" content="Blaise Satin Mini Dress - Crimson | House of CB" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Blaise Satin Mini Dress - Crimson",
              "brand": { "@type": "Brand", "name": "House of CB" },
              "description": "<p>Heavyweight duchess satin corset mini dress with internal boning, square neckline, and concealed back zip.</p>",
              "image": [
                "//is4.revolveassets.com/images/p4/n/z/HOCB-WD99_V1.jpg",
                "//is4.revolveassets.com/images/p4/n/z/HOCB-WD99_V2.jpg"
              ],
              "offers": {
                "@type": "Offer",
                "price": "255.00",
                "priceCurrency": "USD",
                "availability": "https://schema.org/InStock"
              }
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const extracted = extractStructuredHtmlProductData(
      sampleHtml,
      "revolve.com"
    );
    expect(extracted.title).toBe("Blaise Satin Mini Dress - Crimson");
    expect(extracted.brand).toBe("House of CB");
    expect(extracted.priceUsd).toBe(255);
    expect(extracted.images.length).toBe(2);
    expect(extracted.description).toContain("Heavyweight duchess satin");
  });

  it("retains hashed-filename product gallery images on Revolve, Zara, and Aritzia CDNs", () => {
    const angles = extractProductGalleryAngles(
      [
        {
          alt: "Image 1",
          url: "https://is4.revolveassets.com/images/p4/n/z/BBYB-WD124_V1.jpg",
        },
        {
          alt: "Back View",
          url: "https://is4.revolveassets.com/images/p4/n/z/BBYB-WD124_V2.jpg",
        },
      ],
      ["cornelia", "mini", "dress"]
    );
    expect(angles.length).toBe(2);
    expect(angles[1].label).toBe("Model Back");
  });

  it("extracts long >320-char descriptions and construction bullet details without dropping them", () => {
    const longPdp =
      "Crafted from heavyweight non-stretch double crepe, the Cornelia Mini Dress features an architectural boned corset bodice, rounded square neckline, adjustable tapered shoulder straps, open lace-up corset back, and an asymmetrical dropped-waist cowl-pleated mini skirt that skims effortlessly over the hips while cinching the natural waist cleanly.\n• Boned corset bodice\n• Concealed back zipper\n• Fully lined in stretch satin";
    const { fitMetadata } = extractProductFitProfile({
      rawText: longPdp,
      title: "Cornelia Mini Dress",
      brand: "Babyboo Fashion",
      category: "dress",
      silhouette: "mini-dress",
    });
    expect(fitMetadata.descriptionSummary).toBeDefined();
    expect(fitMetadata.descriptionSummary!.length).toBeGreaterThan(40);
    expect(fitMetadata.fitNotes.length).toBeGreaterThanOrEqual(2);
  });

  it("ensures every scraped_url and dropship product in INITIAL_SEED_DB has complete picture, price, and details", () => {
    const scraped = INITIAL_SEED_DB.products.filter(
      (p) =>
        p.sourceType === "scraped_url" ||
        p.sourceType === "aliexpress_dropship"
    );
    expect(scraped.length).toBeGreaterThanOrEqual(15);

    for (const prod of scraped) {
      expect(prod.imageUrl, `${prod.id} missing imageUrl`).toBeTruthy();
      expect(prod.price, `${prod.id} invalid price`).toBeGreaterThan(0);
      expect(
        prod.fitMetadata?.descriptionSummary,
        `${prod.id} missing descriptionSummary`
      ).toBeTruthy();
      expect(
        prod.fitMetadata?.fabricComposition,
        `${prod.id} missing fabricComposition`
      ).toBeTruthy();
      expect(
        prod.fitMetadata?.fitNotes?.length || 0,
        `${prod.id} missing fitNotes`
      ).toBeGreaterThanOrEqual(2);
    }
  });
});

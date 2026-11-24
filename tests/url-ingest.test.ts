import { beforeEach, describe, expect, it } from "vitest";
import {
  ingestProductUrlToSharedCatalog,
  isProductStale,
  normalizeCanonicalProductUrl,
  parseProductFromHtml,
  THREE_DAYS_MS,
} from "@/lib/catalog/url-ingest";
import { resetTestMemoryDb } from "@/lib/db/repository";

describe("Shared URL Catalog Ingestion & 3-Day Refresh", () => {
  beforeEach(() => {
    resetTestMemoryDb();
  });

  it("strips tracking parameters so duplicate pasted links share one DB row", () => {
    const rawA =
      "https://m.nike.com/t/cortez-womens-shoes-vintage-sail/?utm_source=ig&fbclid=12345#details";
    const rawB = "https://www.nike.com/t/cortez-womens-shoes-vintage-sail";
    expect(normalizeCanonicalProductUrl(rawA)).toBe(
      normalizeCanonicalProductUrl(rawB)
    );
  });

  it("extracts Schema.org Product JSON-LD price, brand, and silhouette", () => {
    const html = `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Product",
              "name": "Airlift High-Waist Blush Legging",
              "brand": { "@type": "Brand", "name": "Alo Yoga" },
              "image": "https://cdn.example.com/legging.jpg",
              "offers": {
                "@type": "Offer",
                "price": "128.00",
                "availability": "https://schema.org/InStock"
              }
            }
          </script>
        </head>
      </html>
    `;
    const parsed = parseProductFromHtml(
      html,
      "https://www.aloyoga.com/products/airlift-legging"
    );
    expect(parsed.brand).toBe("Alo Yoga");
    expect(parsed.price).toBe(128);
    expect(parsed.category).toBe("bottom");
    expect(parsed.silhouette).toBe("leggings");
    expect(parsed.colorName).toBe("Soft Blush");
  });

  it("returns shared_cache_hit inside 3 days and refreshes after 72 hours", async () => {
    const seededUrl =
      "https://www.nike.com/t/cortez-womens-shoes-vintage-sail?utm_medium=social";
    const hit = await ingestProductUrlToSharedCatalog(seededUrl, "maya");
    expect(hit.status).toBe("shared_cache_hit");

    const fourDaysLater = new Date(Date.now() + THREE_DAYS_MS + 60_000);
    expect(isProductStale(hit.product.staleAfter, fourDaysLater)).toBe(true);
  });
});

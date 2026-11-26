import { Product } from "../types";
import { DEFAULT_CN_SIZE_TAG_MAP } from "./aliexpress-dropship";

export interface DropshipOrderLineItem {
  lineId: string;
  productId?: string;
  title: string;
  brand: string;
  imageUrl?: string;
  customerUsSize: string;
  supplierFulfillmentTag: string;
  retailPriceUsd: number;
  wholesaleCostUsd: number;
  netProfitUsd: number;
  isDropship: boolean;
  aliexpressItemId?: string;
  supplierName?: string;
  supplierUrl?: string;
  partnerStoreUrl?: string;
  shippingMethod: string;
}

export interface DropshipFulfillmentOrder {
  orderId: string;
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cityPostal: string;
  status: "awaiting_supplier_dispatch" | "dispatched_choice_air";
  trackingNumber?: string;
  lines: DropshipOrderLineItem[];
  totalRetailCollectedUsd: number;
  totalSupplierWholesaleUsd: number;
  totalNetStoreProfitUsd: number;
  createdAt: string;
}

const ORDERS_STORAGE_KEY = "gwo_dropship_orders_v1";

function mapUsShoeToEuTag(usSize: string): string {
  const table: Record<string, string> = {
    "6": "EU 36",
    "6.5": "EU 37",
    "7": "EU 37.5",
    "7.5": "EU 38",
    "8": "EU 39",
    "8.5": "EU 39.5",
    "9": "EU 40",
  };
  return table[usSize.trim()] || `EU (${usSize})`;
}

/**
 * Resolves the exact supplier fulfillment tag (e.g., Customer US "S" -> "CN Tag M", Shoe "7.5" -> "EU 38")
 * so the GWO merchant fulfills the calibrated Asian boutique tag without sizing returns!
 */
export function resolveSupplierFulfillmentTag(
  usSize: string,
  product?: Product
): string {
  const clean = (usSize || "S").trim().toUpperCase();
  if (product?.category === "accessory" || clean === "ONE SIZE") {
    return "ONE SIZE";
  }
  if (product?.category === "shoes" || /^\d+(\.\d+)?$/.test(clean)) {
    return mapUsShoeToEuTag(clean);
  }
  const map = product?.dropship?.cnSizeTagMap || DEFAULT_CN_SIZE_TAG_MAP;
  return map[clean] || `CN Tag ${clean}`;
}

export interface BagLineInput {
  id: string;
  productId?: string;
  title: string;
  brand: string;
  price: number;
  size: string;
  imageUrl?: string;
  storeUrl?: string;
}

/**
 * Builds a complete retail-to-supplier dropship fulfillment manifest from Unified Bag items,
 * separating GWO Dropship SKUs (hidden wholesale cost + CN tag mapping) from external partner links.
 */
export function buildDropshipOrderFromBag(params: {
  bagItems: BagLineInput[];
  catalog: Product[];
  customerName: string;
  customerEmail: string;
  shippingAddress: string;
  cityPostal: string;
}): DropshipFulfillmentOrder {
  const {
    bagItems,
    catalog,
    customerName,
    customerEmail,
    shippingAddress,
    cityPostal,
  } = params;

  const byId = new Map(catalog.map((p) => [p.id, p]));
  const byTitle = new Map(
    catalog.map((p) => [p.title.trim().toLowerCase(), p])
  );

  const lines: DropshipOrderLineItem[] = bagItems.map((b, idx) => {
    const matched =
      (b.productId ? byId.get(b.productId) : undefined) ||
      byTitle.get(b.title.trim().toLowerCase());

    const isDropship = Boolean(
      matched?.sourceType === "aliexpress_dropship" ||
        matched?.dropship ||
        /aliexpress\.com/i.test(b.storeUrl || "") ||
        /^GWO\s*×/i.test(b.brand)
    );

    const wholesaleCostUsd = isDropship
      ? Number(
          (
            matched?.dropship?.wholesaleCostUsd ??
            Math.max(12, Number((b.price / 2.85).toFixed(2)))
          ).toFixed(2)
        )
      : 0;

    const netProfitUsd = isDropship
      ? Number((b.price - wholesaleCostUsd).toFixed(2))
      : 0;

    const supplierFulfillmentTag = isDropship
      ? resolveSupplierFulfillmentTag(b.size, matched)
      : `Partner US ${b.size}`;

    const itemId = matched?.dropship?.aliexpressItemId;
    const supplierUrl =
      matched?.dropship?.supplierUrl ||
      (isDropship && b.storeUrl ? b.storeUrl : undefined);

    return {
      lineId: `line-${Date.now()}-${idx}`,
      productId: matched?.id || b.productId,
      title: b.title,
      brand: b.brand,
      imageUrl: b.imageUrl || matched?.imageUrl,
      customerUsSize: b.size || "S",
      supplierFulfillmentTag,
      retailPriceUsd: b.price,
      wholesaleCostUsd,
      netProfitUsd,
      isDropship,
      aliexpressItemId: itemId,
      supplierName:
        matched?.dropship?.supplierName ||
        (isDropship ? "AliExpress Gold Boutique" : undefined),
      supplierUrl,
      partnerStoreUrl: !isDropship ? b.storeUrl || matched?.canonicalUrl : undefined,
      shippingMethod:
        matched?.dropship?.shippingMethod ||
        (isDropship
          ? "AliExpress Choice Direct Air (6d)"
          : "Partner Brand Direct"),
    };
  });

  const totalRetailCollectedUsd = Number(
    lines.reduce((s, l) => s + l.retailPriceUsd, 0).toFixed(2)
  );
  const totalSupplierWholesaleUsd = Number(
    lines
      .filter((l) => l.isDropship)
      .reduce((s, l) => s + l.wholesaleCostUsd, 0)
      .toFixed(2)
  );
  const totalNetStoreProfitUsd = Number(
    lines
      .filter((l) => l.isDropship)
      .reduce((s, l) => s + l.netProfitUsd, 0)
      .toFixed(2)
  );

  const shortCode = String(Math.floor(1000 + (Date.now() % 9000)));
  return {
    orderId: `GWO-DS-${shortCode}`,
    customerName: customerName.trim() || "Mila Vance",
    customerEmail: customerEmail.trim() || "mila@goodwithonline.com",
    shippingAddress: shippingAddress.trim() || "458 Mercer St, Apt 4B",
    cityPostal: cityPostal.trim() || "New York, NY 10013",
    status: "awaiting_supplier_dispatch",
    lines,
    totalRetailCollectedUsd,
    totalSupplierWholesaleUsd,
    totalNetStoreProfitUsd,
    createdAt: new Date().toISOString(),
  };
}

export function getStarterSampleDropshipOrders(
  catalog: Product[]
): DropshipFulfillmentOrder[] {
  const corset = catalog.find((p) => p.id === "prod-ae-espresso-corset");
  const trousers = catalog.find((p) => p.id === "prod-ae-champagne-trousers");
  if (!corset || !trousers) return [];

  const sample = buildDropshipOrderFromBag({
    bagItems: [
      {
        id: "seed-1",
        productId: corset.id,
        title: corset.title,
        brand: corset.brand,
        price: corset.price,
        size: "S",
        imageUrl: corset.imageUrl,
        storeUrl: corset.canonicalUrl,
      },
      {
        id: "seed-2",
        productId: trousers.id,
        title: trousers.title,
        brand: trousers.brand,
        price: trousers.price,
        size: "S",
        imageUrl: trousers.imageUrl,
        storeUrl: trousers.canonicalUrl,
      },
    ],
    catalog,
    customerName: "Maya Lin",
    customerEmail: "maya.lin@nycstyle.co",
    shippingAddress: "214 Crosby St, Loft 3",
    cityPostal: "New York, NY 10012",
  });

  return [
    {
      ...sample,
      orderId: "GWO-DS-7410",
    },
  ];
}

export function loadStoredDropshipOrders(): DropshipFulfillmentOrder[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DropshipFulfillmentOrder[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredDropshipOrders(
  orders: DropshipFulfillmentOrder[]
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota error
  }
}

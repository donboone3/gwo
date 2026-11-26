"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  DollarSign,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  PackageCheck,
  Plus,
  Rotate3d,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import {
  AliExpressUrlScrapeOutcome,
  importAliExpressUrlForDropship,
  scrapeLiveAliExpressNicheClient,
  searchTopLineAliExpressFeed,
} from "@/lib/dropship/aliexpress-dropship";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";
import {
  certifyProductAvatarReadiness,
  isolateProductBackgroundClient,
} from "@/lib/three/avatar-ready-pipeline";
import {
  MASTER_REALISM_SPEC_VERSION,
  auditMasterCatalogRealism,
} from "@/lib/realism/master-avatar-clothing-realism";
import { GarmentCategory, Product } from "@/lib/types";

const MARKUP_TIERS = [
  { mult: 2.2, label: "2.2x Value" },
  { mult: 2.85, label: "2.85x Boutique" },
  { mult: 3.4, label: "3.4x Luxury" },
];

export function GwoMerchantAdmin() {
  const {
    user,
    products,
    dropshipMarkup,
    setDropshipMarkup,
    importDropshipProductToStore,
    dropshipOrders,
    dispatchDropshipOrder,
    openAvatar360,
    showToast,
  } = useGwo();

  const activeAvatar = useMemo(
    () => ({
      heightInches: user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches,
      bustInches: user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches,
      waistInches: user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches,
      hipsInches: user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches,
      shoeSize: user?.shoeSize || "7.5",
    }),
    [user]
  );

  const [aeSearchQuery, setAeSearchQuery] = useState("");
  const [aeCategory, setAeCategory] = useState<GarmentCategory | "all">("all");
  const [aeUrlInput, setAeUrlInput] = useState("");
  const [aeWholesaleInput, setAeWholesaleInput] = useState("19.50");
  const [aeImportingUrl, setAeImportingUrl] = useState(false);
  const [aeLiveScraping, setAeLiveScraping] = useState(false);
  const [aeLiveItems, setAeLiveItems] = useState<Product[]>([]);
  const [aeOutcome, setAeOutcome] =
    useState<AliExpressUrlScrapeOutcome | null>(null);
  const aePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const aeFeedItems = useMemo(() => {
    const base = searchTopLineAliExpressFeed({
      query: aeSearchQuery,
      category: aeCategory,
      markupMultiplier: dropshipMarkup,
    });
    if (aeLiveItems.length === 0) return base;
    const seen = new Set(aeLiveItems.map((p) => p.id));
    return [...aeLiveItems, ...base.filter((b) => !seen.has(b.id))];
  }, [aeCategory, aeLiveItems, aeSearchQuery, dropshipMarkup]);

  const storeIdsSet = useMemo(
    () => new Set(products.map((p) => p.id)),
    [products]
  );

  const totalPendingProfit = useMemo(
    () =>
      dropshipOrders.reduce((s, o) => s + o.totalNetStoreProfitUsd, 0),
    [dropshipOrders]
  );

  const masterRealismAudit = useMemo(
    () =>
      auditMasterCatalogRealism(products, {
        heightInches: activeAvatar.heightInches,
        shoulderInches: 15.0,
        bustInches: activeAvatar.bustInches,
        waistInches: activeAvatar.waistInches,
        hipsInches: activeAvatar.hipsInches,
        shoeSize: activeAvatar.shoeSize,
      }),
    [activeAvatar, products]
  );

  const handleImportAliExpressUrl = async () => {
    if (!aeUrlInput.trim()) return;
    setAeImportingUrl(true);
    try {
      const res = await importAliExpressUrlForDropship(aeUrlInput.trim(), {
        markupMultiplier: dropshipMarkup,
        customWholesaleUsd: Number(aeWholesaleInput) || 19.5,
      });
      setAeOutcome(res);
      await importDropshipProductToStore(res.product);
      setAeUrlInput("");
    } finally {
      setAeImportingUrl(false);
    }
  };

  const handleLiveScrapeAliExpress = async () => {
    setAeLiveScraping(true);
    try {
      const res = await scrapeLiveAliExpressNicheClient({
        query: aeSearchQuery,
        category: aeCategory,
        markupMultiplier: dropshipMarkup,
      });
      if (res.liveScrapedCount > 0) {
        setAeLiveItems(res.items.slice(0, res.liveScrapedCount));
        for (const p of res.items.slice(0, Math.min(4, res.liveScrapedCount))) {
          await importDropshipProductToStore(p);
        }
        showToast(
          `Live-scraped ${res.liveScrapedCount} AliExpress luxury pieces into your Runway store!`
        );
      } else {
        showToast(
          `Synced ${res.items.length} verified Top-1% AliExpress Gold Boutique pieces!`
        );
      }
    } finally {
      setAeLiveScraping(false);
    }
  };

  const handleAttachDraftPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !aeOutcome) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rawUrl = String(reader.result || "");
      if (rawUrl) {
        const cleanRgba = await isolateProductBackgroundClient(rawUrl);
        const updated: Product = { ...aeOutcome.product, imageUrl: cleanRgba };
        setAeOutcome({ ...aeOutcome, product: updated });
        await importDropshipProductToStore(updated);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="min-h-[calc(100svh-64px)] bg-[#F3F4F7] pb-16">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-5 space-y-5">
        {/* Back-Office Header */}
        <section className="rounded-3xl bg-white border border-black/[0.08] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FEF6E6] text-[#8A5808] text-[11px] font-bold border border-[#F4DFB4]">
                <TrendingUp className="w-3.5 h-3.5" /> Merchant Back-Office (Hidden from Customer Front End)
              </span>
              <Link
                href="/shop"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> View Customer Runway
              </Link>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#141518]">
              GWO Store Pricing vs. AliExpress Wholesale Pricing &amp; Auto-Fulfillment
            </h1>
            <p className="text-xs text-[#686D76]">
              Manage retail markup multipliers, scrape AliExpress top-of-the-line pieces onto the Runway, and dispatch customer orders with automatic CN→US size tag conversion.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
              {MARKUP_TIERS.map((tier) => {
                const active = Math.abs(dropshipMarkup - tier.mult) < 0.08;
                return (
                  <button
                    key={tier.label}
                    type="button"
                    id={`gwo-admin-markup-${tier.mult}`}
                    onClick={() => setDropshipMarkup(tier.mult)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                      active
                        ? "bg-[#141518] text-white shadow-xs"
                        : "text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>

            <div className="px-3.5 py-2 rounded-full bg-[#E7F3EE] text-[#1D4232] text-xs font-bold border border-[#C5DFD0]">
              Orders Profit: +${totalPendingProfit.toFixed(2)}
            </div>
          </div>
        </section>

        {/* Master Avatar & Clothing Realism Authority Live Audit */}
        <section
          id="gwo-admin-master-realism"
          className="rounded-3xl bg-white border border-[#C5DFD0] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
        >
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" /> Master Realism Spec{" "}
                {MASTER_REALISM_SPEC_VERSION}
              </span>
              <span className="text-[11px] font-semibold text-[#5C6068]">
                src/lib/realism/master-avatar-clothing-realism.ts
              </span>
            </div>
            <p className="text-xs font-semibold text-[#141518]">
              1:1 Craniofacial Lock • Dual Body+Hair 3D Character • 10 PBR Fabric
              Profiles • Anti-Clipping Z-Clearance Shells
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-full bg-[#F4F8F6] text-[#1D4232] border border-[#C5DFD0]">
              Avatar Realism:{" "}
              {masterRealismAudit.avatarCertification.realismScorePct}%
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[#141518] text-white">
              {masterRealismAudit.certifiedCount}/{masterRealismAudit.totalItems}{" "}
              SKUs • {masterRealismAudit.averageRealismPct}% Certified
            </span>
          </div>
        </section>

        {/* 1. Supplier Order Fulfillment Queue */}
        <section
          id="gwo-admin-fulfillment-queue"
          className="rounded-3xl bg-white border border-black/[0.08] p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#141518]">
                1. Customer Orders &amp; AliExpress Auto-Fulfillment Queue ({dropshipOrders.length})
              </h2>
              <p className="text-xs text-[#686D76]">
                Shoppers pay Our Retail Price on the Runway; fulfill on AliExpress at Wholesale Cost using the calibrated supplier tag.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            {dropshipOrders.map((ord) => {
              const isDispatched = ord.status === "dispatched_choice_air";
              return (
                <div
                  key={ord.orderId}
                  className="rounded-2xl bg-[#F8F9FB] border border-black/[0.07] p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-black/[0.06]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-[#141518]">
                          {ord.orderId}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                            isDispatched
                              ? "bg-[#E7F3EE] text-[#1D4232]"
                              : "bg-[#FEF6E6] text-[#8A5808]"
                          }`}
                        >
                          {isDispatched
                            ? `Dispatched (${ord.trackingNumber})`
                            : "Awaiting Supplier Dispatch"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#686D76] mt-0.5">
                        {ord.customerName} • {ord.shippingAddress}, {ord.cityPostal}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="px-2.5 py-1 rounded-xl bg-white border border-black/[0.07] text-[11px]">
                        <span>Our Price: </span>
                        <strong>${ord.totalRetailCollectedUsd.toFixed(0)}</strong>
                        <span className="mx-1 text-black/25">|</span>
                        <span>AliExpress: </span>
                        <strong>${ord.totalSupplierWholesaleUsd.toFixed(2)}</strong>
                        <span className="mx-1 text-black/25">|</span>
                        <strong className="text-[#15803D]">
                          +${ord.totalNetStoreProfitUsd.toFixed(2)}
                        </strong>
                      </div>
                      {!isDispatched && (
                        <button
                          type="button"
                          onClick={() => dispatchDropshipOrder(ord.orderId)}
                          className="px-3 py-1.5 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <PackageCheck className="w-3.5 h-3.5" /> Dispatch
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {ord.lines.map((ln) => (
                      <div
                        key={ln.lineId}
                        className="p-2 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#141518] truncate">
                            {ln.title}
                          </p>
                          <p className="text-[11px] text-[#5C6068]">
                            Customer US <strong>{ln.customerUsSize}</strong> →{" "}
                            <strong className="text-[#244B3B]">
                              {ln.supplierFulfillmentTag}
                            </strong>{" "}
                            • Our Price <strong>${ln.retailPriceUsd}</strong> vs AliExpress{" "}
                            <strong>${ln.wholesaleCostUsd.toFixed(2)}</strong>
                          </p>
                        </div>
                        {ln.supplierUrl && (
                          <a
                            href={ln.supplierUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 rounded-full bg-[#141518] text-white text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0"
                          >
                            AliExpress SKU <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Live AliExpress Scraper & Our Pricing vs. AliExpress Pricing Matrix */}
        <section
          id="gwo-admin-aliexpress-catalog"
          className="rounded-3xl bg-white border border-black/[0.08] p-5 space-y-4"
        >
          <div>
            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[10.5px] font-bold">
              <Star className="w-3 h-3 fill-current" /> Top 1% Gold Boutique Feed ({aeFeedItems.length} SKUs)
            </div>
            <h2 className="text-base font-bold text-[#141518] mt-1">
              2. AliExpress Scraper &amp; Price Margin Matrix (Our Price vs. AliExpress Cost)
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Link2 className="w-4 h-4 text-[#8A9099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="gwo-ae-url-input"
                  type="url"
                  value={aeUrlInput}
                  onChange={(e) => setAeUrlInput(e.target.value)}
                  placeholder="Paste https://www.aliexpress.com/item/... URL"
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs text-[#141518]"
                />
              </div>
              <div className="relative w-24 shrink-0">
                <DollarSign className="w-3.5 h-3.5 text-[#8A9099] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.5"
                  value={aeWholesaleInput}
                  onChange={(e) => setAeWholesaleInput(e.target.value)}
                  aria-label="AliExpress Wholesale USD"
                  className="w-full pl-7 pr-2 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs font-bold text-[#141518]"
                />
              </div>
              <button
                type="button"
                id="gwo-ae-import-url-btn"
                disabled={aeImportingUrl || !aeUrlInput.trim()}
                onClick={() => void handleImportAliExpressUrl()}
                className="px-4 py-2 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {aeImportingUrl ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Pulling...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Pull to Runway
                  </>
                )}
              </button>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-[#8A9099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="gwo-ae-search-input"
                  type="text"
                  value={aeSearchQuery}
                  onChange={(e) => setAeSearchQuery(e.target.value)}
                  placeholder="Search or live-scrape AliExpress niche (silk dress, blazer)..."
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs text-[#141518]"
                />
              </div>
              <select
                aria-label="Filter AliExpress Category"
                value={aeCategory}
                onChange={(e) =>
                  setAeCategory(e.target.value as GarmentCategory | "all")
                }
                className="px-3 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs font-bold text-[#141518]"
              >
                <option value="all">All Categories</option>
                <option value="top">Tops &amp; Corsets</option>
                <option value="outerwear">Blazers &amp; Coats</option>
                <option value="dress">Dresses</option>
                <option value="bottom">Trousers &amp; Skirts</option>
                <option value="shoes">Heels &amp; Boots</option>
                <option value="accessory">Leather Bags</option>
              </select>
              <button
                type="button"
                id="gwo-ae-live-scrape-btn"
                disabled={aeLiveScraping}
                onClick={() => void handleLiveScrapeAliExpress()}
                className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {aeLiveScraping ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scraping...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" /> Scrape Live
                  </>
                )}
              </button>
            </div>
          </div>

          {aeOutcome?.captchaGated && (
            <div className="p-3.5 rounded-2xl bg-[#FEF6E6] border border-[#F4DFB4] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#7C4D06]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                <p className="leading-relaxed">{aeOutcome.notice}</p>
              </div>
              <div className="shrink-0">
                <input
                  ref={aePhotoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAttachDraftPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => aePhotoInputRef.current?.click()}
                  className="px-3.5 py-2 rounded-full bg-[#141518] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Attach Photo
                </button>
              </div>
            </div>
          )}

          {/* Guaranteed 4-Stage Product -> 360° & Avatar-Ready System Pipeline Banner */}
          <div
            id="gwo-guaranteed-360-pipeline"
            className="p-4 rounded-2xl bg-[#F4F8F5] border border-[#C6E0D0] space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-[#1D4232] inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#244B3B]" /> Guaranteed 4-Stage Product-to-360° &amp; Avatar-Ready Pipeline (Active on Every Import)
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#244B3B] text-white text-[10.5px] font-bold">
                100% Certified ({aeFeedItems.length}/{aeFeedItems.length} SKUs Ready)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
              {[
                [
                  "1. RGBA Background Strip",
                  "Auto flood-fill + alpha matting removes white/studio backgrounds so only the isolated garment remains.",
                ],
                [
                  "2. Anatomical Slot Anchor",
                  "Locks exact 900×1355 coordinates & layer z-order (Top, Bottom, Dress, Open Jacket, Shoe, Belt, or Bag).",
                ],
                [
                  "3. 360° Multi-Angle Synthesis",
                  "Generates Front 0°, Side 90°, and Back 180° cylindrical drape views ready for inertia spin.",
                ],
                [
                  "4. CN→US Size Calibration",
                  "Maps supplier centimeter charts one tag up (CN M → US S) for exact Bust/Waist/Hip inch matching.",
                ],
              ].map(([stepTitle, stepDesc]) => (
                <div
                  key={stepTitle}
                  className="p-2.5 rounded-xl bg-white border border-[#D4E8DC] space-y-0.5"
                >
                  <p className="font-bold text-[#141518]">{stepTitle}</p>
                  <p className="text-[10.5px] text-[#5C6068] leading-snug">
                    {stepDesc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {aeFeedItems.map((item) => {
              const fit = analyzeExactAvatarFit(activeAvatar, item);
              const readiness = certifyProductAvatarReadiness(item);
              const cnTag = item.dropship?.cnSizeTagMap?.[fit.recommendedSize];
              const inStore = storeIdsSet.has(item.id);
              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-[#F8F9FB] border border-black/[0.07] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-52 bg-white border-b border-black/[0.05] overflow-hidden">
                      <GarmentArtwork product={item} className="w-full h-full" />
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[9.5px] font-extrabold border border-[#C5DFD0]">
                        360° • {readiness.slot.toUpperCase()} ✓
                      </span>
                    </div>
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px] font-bold">
                        <span className="text-[#1D4232]">
                          {item.dropship?.supplierRating}★ ({item.dropship?.ordersCount.toLocaleString()})
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232]">
                          {item.estDeliveryDays}d Air
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-[#141518] line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      <div className="p-2 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-[#686D76]">AliExpress: </span>
                          <strong>${item.dropship?.wholesaleCostUsd.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[#686D76]">Our Price: </span>
                          <strong>${item.price}</strong>
                        </div>
                        <span className="font-bold text-[#15803D]">
                          +${item.dropship?.profitMarginUsd.toFixed(0)}
                        </span>
                      </div>
                      <p className="text-[10.5px] font-semibold text-[#5C6068]">
                        5&apos;2&quot; Avatar: <strong>US {fit.recommendedSize}</strong>
                        {cnTag ? ` ← ${cnTag}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="px-3 pb-3 flex items-center justify-between gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        openAvatar360({
                          title: `${item.brand} — ${item.title}`,
                          primaryProduct: item,
                        })
                      }
                      className="px-2.5 py-1.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Rotate3d className="w-3 h-3 text-[#244B3B]" /> Test 360°
                    </button>
                    <button
                      type="button"
                      onClick={() => void importDropshipProductToStore(item)}
                      className={`flex-1 py-1.5 px-3 rounded-full text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${
                        inStore
                          ? "bg-[#E7F3EE] text-[#1D4232]"
                          : "bg-[#244B3B] text-white"
                      }`}
                    >
                      {inStore ? (
                        <>
                          <Check className="w-3 h-3" /> On Runway
                        </>
                      ) : (
                        "Add to Runway"
                      )}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

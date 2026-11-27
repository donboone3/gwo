"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  DollarSign,
  Heart,
  ImagePlus,
  Instagram,
  Link2,
  Loader2,
  PackageCheck,
  Plus,
  Rotate3d,
  Search,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { IgStoryLookbookModal } from "../social/IgStoryLookbookModal";
import { generateEndlessOutfitBatch } from "@/lib/stylist/infinite-outfit-engine";
import { ARCHETYPE_META } from "@/lib/social/social-style-dna";
import {
  AliExpressUrlScrapeOutcome,
  importAliExpressUrlForDropship,
  scrapeLiveAliExpressNicheClient,
  searchTopLineAliExpressFeed,
} from "@/lib/dropship/aliexpress-dropship";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import { DEFAULT_AVATAR_MEASUREMENTS } from "@/lib/catalog/sizing";
import { EndlessAiOutfit, GarmentCategory, Product } from "@/lib/types";

const FEED_OCCASIONS = [
  { id: "all", label: "All Vibes" },
  { id: "Date Night", label: "Date Night" },
  { id: "Party", label: "Party / Club" },
  { id: "Work / Chic", label: "Work / Tailored" },
  { id: "Coffee Run", label: "Coffee & Off-Duty" },
];

const MARKUP_TIERS = [
  { mult: 2.2, label: "2.2x Value" },
  { mult: 2.85, label: "2.85x Boutique" },
  { mult: 3.4, label: "3.4x Luxury" },
];

const QUICK_VIBE_PROMPTS = [
  "Miami Rooftop Birthday Red & Gold",
  "Old Money Paris Brunch",
  "SoHo Leather Boots & Mini",
  "Clean Girl Pilates Matcha",
];

export function GwoEndlessOutfitFeed() {
  const searchParams = useSearchParams();
  const initialStudioOpen = searchParams.get("studio") === "dropship";

  const {
    user,
    products,
    myCloset,
    socialDna,
    toggleLikeAiOutfit,
    setSocialModalOpen,
    dropshipMarkup,
    setDropshipMarkup,
    importDropshipProductToStore,
    dropshipOrders,
    openDropshipCheckout,
    addToBag,
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

  const ownedIds = useMemo(
    () => myCloset.map((c) => c.productId),
    [myCloset]
  );

  const [occasionFilter, setOccasionFilter] = useState<string>("all");
  const [onlyDropshipOutfits, setOnlyDropshipOutfits] = useState<boolean>(false);
  const [showMerchantMargins, setShowMerchantMargins] = useState<boolean>(true);
  const [dropshipStudioOpen, setDropshipStudioOpen] =
    useState<boolean>(initialStudioOpen);
  const [vibeInputDraft, setVibeInputDraft] = useState<string>("");
  const [activeVibePrompt, setActiveVibePrompt] = useState<string>("");
  const [activeStoryOutfit, setActiveStoryOutfit] =
    useState<EndlessAiOutfit | null>(null);

  // AliExpress Dropship Sourcing Studio state
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

  // Endless AI Outfit Infinite Scroll State
  const seenSigsRef = useRef<Set<string>>(new Set());
  const batchIndexRef = useRef<number>(0);
  const [batchIndex, setBatchIndex] = useState<number>(0);
  const [outfits, setOutfits] = useState<EndlessAiOutfit[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Rebuild Batch 0 whenever Social Style DNA, catalog, vibe prompt, or filters update
  useEffect(() => {
    if (products.length === 0) return;
    const freshSeen = new Set<string>();
    const initial = generateEndlessOutfitBatch({
      catalog: products,
      avatar: activeAvatar,
      socialDna,
      batchIndex: 0,
      batchSize: 6,
      occasionFilter,
      sourceFilter: onlyDropshipOutfits ? "aliexpress_dropship" : "all",
      customVibePrompt: activeVibePrompt,
      ownedProductIds: ownedIds,
      seenSignatures: freshSeen,
    });
    seenSigsRef.current = freshSeen;
    batchIndexRef.current = 0;
    setBatchIndex(0);
    setOutfits(initial);
  }, [
    activeAvatar,
    activeVibePrompt,
    occasionFilter,
    onlyDropshipOutfits,
    ownedIds,
    products,
    socialDna,
  ]);

  const loadNextBatch = useCallback(() => {
    if (products.length === 0) return;
    const nextIdx = batchIndexRef.current + 1;
    batchIndexRef.current = nextIdx;
    const more = generateEndlessOutfitBatch({
      catalog: products,
      avatar: activeAvatar,
      socialDna,
      batchIndex: nextIdx,
      batchSize: 6,
      occasionFilter,
      sourceFilter: onlyDropshipOutfits ? "aliexpress_dropship" : "all",
      customVibePrompt: activeVibePrompt,
      ownedProductIds: ownedIds,
      seenSignatures: seenSigsRef.current,
    });
    setBatchIndex(nextIdx);
    setOutfits((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      return [...prev, ...more.filter((o) => !existingIds.has(o.id))];
    });
  }, [
    activeAvatar,
    activeVibePrompt,
    occasionFilter,
    onlyDropshipOutfits,
    ownedIds,
    products,
    socialDna,
  ]);

  // IntersectionObserver for seamless endless scrolling
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && outfits.length > 0 && outfits.length < 72) {
          loadNextBatch();
        }
      },
      { rootMargin: "420px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadNextBatch, outfits.length]);

  const handleImportAliExpressUrl = async (sampleUrl?: string) => {
    const targetUrl = (sampleUrl ?? aeUrlInput).trim();
    if (!targetUrl) return;
    setAeImportingUrl(true);
    try {
      const res = await importAliExpressUrlForDropship(targetUrl, {
        markupMultiplier: dropshipMarkup,
        customWholesaleUsd: Number(aeWholesaleInput) || 19.5,
      });
      setAeOutcome(res);
      await importDropshipProductToStore(res.product);
      if (!sampleUrl) setAeUrlInput("");
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
          `Live-scraped ${res.liveScrapedCount} AliExpress luxury pieces into your store!`
        );
      } else {
        showToast(
          `Loaded ${res.items.length} verified Top-1% AliExpress Gold Boutique pieces!`
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
      const dataUrl = String(reader.result || "");
      if (dataUrl) {
        const updated: Product = { ...aeOutcome.product, imageUrl: dataUrl };
        setAeOutcome({ ...aeOutcome, product: updated });
        await importDropshipProductToStore(updated);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const primaryMeta = ARCHETYPE_META[socialDna.primaryArchetype];
  const secondaryMeta = ARCHETYPE_META[socialDna.secondaryArchetype];
  const dropshipCatalogCount = products.filter(
    (p) => p.sourceType === "aliexpress_dropship"
  ).length;

  return (
    <div className="min-h-[calc(100svh-64px)] bg-[#F3F4F7] pb-16">
      <div className="max-w-[1520px] mx-auto px-3 sm:px-6 pt-4 space-y-4">
        {/* ==================== TOP COLLABORATION & DROPSHIP COMMAND BAR ==================== */}
        <section className="rounded-3xl bg-white border border-black/[0.08] shadow-[0_10px_28px_rgba(20,21,24,0.05)] p-4 sm:p-5 space-y-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Left: Social Style DNA Identity */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FDEEF4] text-[#9D174D] text-[11px] font-bold">
                  <Instagram className="w-3.5 h-3.5" />
                  Synced: {socialDna.instagramHandle || "@mila.nyc"}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold">
                  <Sparkles className="w-3.5 h-3.5" />
                  {primaryMeta.shortTag} × {secondaryMeta.shortTag} DNA
                </span>
                <div
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#F4F5F7] border border-black/[0.06]"
                  title="Extracted Instagram Palette"
                >
                  {socialDna.extractedPaletteHex.map((hex, i) => (
                    <span
                      key={`${hex}-${i}`}
                      style={{ backgroundColor: hex }}
                      className="w-3.5 h-3.5 rounded-full border border-black/15"
                    />
                  ))}
                </div>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#141518]">
                Endless AI Outfit Scroll • Tailored to Your Socials &amp;{" "}
                {Math.floor(activeAvatar.heightInches / 12)}&apos;
                {Math.round(activeAvatar.heightInches % 12)}&quot; Avatar
              </h1>
            </div>

            {/* Right: Social Sync + AliExpress Dropship Studio Toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="gwo-open-social-sync-btn"
                onClick={() => setSocialModalOpen(true)}
                className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Instagram className="w-3.5 h-3.5 text-[#F9A8D4]" />
                Sync Instagram / Socials
              </button>

              <button
                type="button"
                id="gwo-toggle-dropship-studio-btn"
                onClick={() => setDropshipStudioOpen((v) => !v)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1.5 border cursor-pointer transition ${
                  dropshipStudioOpen
                    ? "bg-[#244B3B] text-white border-[#244B3B]"
                    : "bg-[#EBF3EE] hover:bg-[#DCECE3] text-[#1D4232] border-[#C5DFD0]"
                }`}
              >
                <PackageCheck className="w-3.5 h-3.5" />
                AliExpress Dropship ({dropshipCatalogCount})
              </button>

              <button
                type="button"
                id="gwo-toggle-margin-view-btn"
                onClick={() => setShowMerchantMargins((v) => !v)}
                className={`px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1 border cursor-pointer transition ${
                  showMerchantMargins
                    ? "bg-[#FEF6E6] text-[#8A5808] border-[#F4DFB4]"
                    : "bg-[#F4F5F7] text-[#686D76] border-black/[0.07]"
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                {showMerchantMargins ? "Margins On" : "Margins Off"}
              </button>
            </div>
          </div>

          {/* Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-black/[0.06]">
            <div className="flex flex-wrap items-center gap-1.5">
              {FEED_OCCASIONS.map((occ) => {
                const active = occasionFilter === occ.id;
                return (
                  <button
                    key={occ.id}
                    type="button"
                    onClick={() => setOccasionFilter(occ.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                      active
                        ? "bg-[#141518] text-white"
                        : "bg-[#F4F5F7] hover:bg-[#E7E9EE] text-[#686D76] hover:text-[#141518]"
                    }`}
                  >
                    {occ.label}
                  </button>
                );
              })}

              <button
                type="button"
                id="gwo-filter-dropship-stars"
                onClick={() => setOnlyDropshipOutfits((v) => !v)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1 cursor-pointer border transition ${
                  onlyDropshipOutfits
                    ? "bg-[#244B3B] text-white border-[#244B3B]"
                    : "bg-white hover:bg-[#F4F5F7] text-[#1D4232] border-[#C5DFD0]"
                }`}
              >
                <Star className="w-3 h-3 fill-current" /> Dropship Feature Looks
              </button>
            </div>

            <span className="text-xs font-semibold text-[#686D76]">
              Showing <strong className="text-[#141518]">{outfits.length}</strong>{" "}
              AI-built outfits (Batch #{batchIndex + 1}) • Every item has{" "}
              <strong className="text-[#244B3B]">360° Front &amp; Back</strong>
            </span>
          </div>

          {/* Interactive AI Stylist Vibe Collaborator Prompt Bar */}
          <div className="pt-2 border-t border-black/[0.06] space-y-2">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Sparkles className="w-3.5 h-3.5 text-[#244B3B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="gwo-ai-vibe-prompt-input"
                  type="text"
                  value={vibeInputDraft}
                  onChange={(e) => setVibeInputDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setActiveVibePrompt(vibeInputDraft.trim());
                    }
                  }}
                  placeholder="Collaborate with AI Stylist: e.g. Miami rooftop birthday in red & gold, Paris brunch..."
                  className="w-full pl-9 pr-3 py-2 rounded-full bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                />
              </div>

              <button
                type="button"
                id="gwo-ai-vibe-apply-btn"
                onClick={() => setActiveVibePrompt(vibeInputDraft.trim())}
                className="px-4 py-2 rounded-full bg-[#244B3B] hover:bg-[#1D3E30] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" /> Style My Vibe
              </button>

              {activeVibePrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setVibeInputDraft("");
                    setActiveVibePrompt("");
                  }}
                  aria-label="Clear Vibe Prompt"
                  className="px-3 py-2 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EB] text-[#141518] text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" /> Reset
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-[#686D76]">
                Quick Vibes:
              </span>
              {QUICK_VIBE_PROMPTS.map((vp) => {
                const isCurr =
                  activeVibePrompt.toLowerCase() === vp.toLowerCase();
                return (
                  <button
                    key={vp}
                    type="button"
                    onClick={() => {
                      setVibeInputDraft(vp);
                      setActiveVibePrompt(vp);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-pointer transition ${
                      isCurr
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-white hover:bg-[#F4F5F7] text-[#5C6068] border-black/[0.08]"
                    }`}
                  >
                    {vp}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ==================== ALIEXPRESS TOP-LINE DROPSHIP SOURCING STUDIO ==================== */}
        {dropshipStudioOpen && (
          <section
            id="gwo-aliexpress-dropship-studio"
            className="rounded-3xl bg-white border border-[#CBE2D4] shadow-[0_14px_34px_rgba(20,21,24,0.07)] p-4 sm:p-6 space-y-4"
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold">
                  <Star className="w-3 h-3 fill-current" /> Top 1% Gold Boutique &amp; AliExpress Choice Direct Air (5–7d)
                </div>
                <h2 className="text-base sm:text-lg font-bold text-[#141518] mt-1">
                  AliExpress Top-of-the-Line Clothes Dropship Engine
                </h2>
                <p className="text-xs text-[#686D76]">
                  Pull 4.8★–4.9★ luxury boutique pieces into GWO with automatic{" "}
                  <strong>CN→US Size Calibration</strong> (CN Tag M = US Size S for{" "}
                  {activeAvatar.waistInches}&quot; waist) and live retail profit margins.
                </p>
              </div>

              {/* Store Markup Tier Selector + Supplier Fulfillment Queue */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-[#F1F2F5] border border-black/[0.06]">
                  {MARKUP_TIERS.map((tier) => {
                    const active = Math.abs(dropshipMarkup - tier.mult) < 0.08;
                    return (
                      <button
                        key={tier.label}
                        type="button"
                        id={`gwo-markup-${tier.mult}`}
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

                <button
                  type="button"
                  id="gwo-open-fulfillment-queue-btn"
                  onClick={() => openDropshipCheckout("fulfillment")}
                  className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Truck className="w-3.5 h-3.5 text-[#A7D7C5]" />
                  Supplier Queue ({dropshipOrders.length})
                </button>
              </div>
            </div>

            {/* Direct AliExpress Item URL Importer + Search Bar */}
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
                    title="Supplier Wholesale Cost (USD)"
                    aria-label="Supplier Wholesale Cost USD"
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
                      <Plus className="w-3.5 h-3.5" /> Pull to Store
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
                    placeholder="Search Gold Boutique feed (corset, tweed, satin, heels)..."
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
                  className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition"
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

            {/* Transparent CAPTCHA Boundary Banner if an unauthenticated AliExpress URL hit reCAPTCHA */}
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
                    <ImagePlus className="w-3.5 h-3.5" /> Attach Supplier Photo
                  </button>
                </div>
              </div>
            )}

            {/* Verified Top-Line AliExpress Boutique Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {aeFeedItems.map((item) => {
                const fit = analyzeExactAvatarFit(activeAvatar, item);
                const cnTag = item.dropship?.cnSizeTagMap?.[fit.recommendedSize];
                const inStore = storeIdsSet.has(item.id);
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl bg-[#F8F9FB] border border-black/[0.07] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Pure Garment Studio Image (Zero Text Overlap!) */}
                      <div className="h-52 bg-[#F4F5F7] border-b border-black/[0.05] overflow-hidden">
                        <GarmentArtwork
                          product={item}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-1.5 text-[10.5px] font-bold">
                          <span className="text-[#1D4232] truncate">
                            {item.dropship?.supplierRating}★ (
                            {item.dropship?.ordersCount.toLocaleString()} orders)
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-[#E7F3EE] text-[#1D4232] shrink-0">
                            {item.estDeliveryDays}d Air
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-[#141518] line-clamp-2 leading-snug">
                          {item.title}
                        </h3>

                        {/* Wholesale -> Store Retail -> Net Margin Breakdown */}
                        <div className="p-2 rounded-xl bg-white border border-black/[0.06] flex items-center justify-between text-[11px]">
                          <div>
                            <span className="text-[#686D76]">Cost: </span>
                            <strong className="text-[#141518]">
                              ${item.dropship?.wholesaleCostUsd.toFixed(2)}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[#686D76]">Retail: </span>
                            <strong className="text-[#141518]">
                              ${item.price}
                            </strong>
                          </div>
                          <span className="font-bold text-[#15803D]">
                            +${item.dropship?.profitMarginUsd.toFixed(0)} (
                            {item.dropship?.marginPct}%)
                          </span>
                        </div>

                        {/* CN-to-US Avatar Size Calibration */}
                        <p className="text-[10.5px] font-semibold text-[#5C6068]">
                          Avatar Fit:{" "}
                          <strong className="text-[#141518]">
                            US {fit.recommendedSize}
                          </strong>
                          {cnTag ? ` ← Fulfill ${cnTag}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="px-3 pb-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          openAvatar360({
                            title: `${item.brand} — ${item.title}`,
                            primaryProduct: item,
                            initialAngleMode: "split",
                          })
                        }
                        className="flex-1 py-2 px-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Rotate3d className="w-3 h-3 text-[#A7D7C5]" /> 360° F/B
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          addToBag({
                            productId: item.id,
                            title: item.title,
                            brand: item.brand,
                            price: item.price,
                            size: fit.recommendedSize,
                            imageUrl: item.imageUrl,
                            storeUrl: item.canonicalUrl,
                          })
                        }
                        className="py-2 px-2.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[11px] font-bold text-[#141518] cursor-pointer"
                      >
                        + Bag
                      </button>

                      <button
                        type="button"
                        onClick={() => void importDropshipProductToStore(item)}
                        className={`py-2 px-2.5 rounded-full text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                          inStore
                            ? "bg-[#E7F3EE] text-[#1D4232]"
                            : "bg-[#244B3B] text-white"
                        }`}
                      >
                        {inStore ? (
                          <>
                            <Check className="w-3 h-3" /> Live
                          </>
                        ) : (
                          "Import"
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* ==================== ENDLESS AI OUTFIT SCROLL GRID ==================== */}
        <section
          id="gwo-endless-outfit-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {outfits.map((outfit) => {
            const hero = outfit.items[0];
            const companions = outfit.items.slice(1, 4);
            const liked = socialDna.likedOutfitIds.includes(outfit.id);

            return (
              <article
                key={outfit.id}
                data-outfit-card="true"
                className="rounded-3xl bg-white border border-black/[0.08] shadow-[0_10px_28px_rgba(20,21,24,0.05)] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Top Metadata Header (Dedicated Row Above Images — Zero Overlap!) */}
                  <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#686D76] truncate">
                        {outfit.occasion} • {outfit.vibe}
                      </p>
                      <h2 className="text-sm font-bold text-[#141518] truncate">
                        {outfit.title}
                      </h2>
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-[#E7F3EE] text-[#1D4232] text-[11px] font-bold shrink-0">
                      {outfit.socialDnaMatchPct}% Social Match
                    </span>
                  </div>

                  {/* Multi-Piece Studio Moodboard (Pure Unobstructed Garment Cells!) */}
                  <div className="grid grid-cols-[1.25fr_1fr] gap-1.5 p-2.5 bg-[#F6F7F9] border-b border-black/[0.06] h-60">
                    <div className="h-full rounded-2xl overflow-hidden bg-white border border-black/[0.05]">
                      {hero && (
                        <GarmentArtwork
                          product={hero}
                          className="w-full h-full"
                        />
                      )}
                    </div>

                    <div className="h-full flex flex-col gap-1.5 min-h-0">
                      {companions.map((comp) => (
                        <div
                          key={comp.id}
                          className="flex-1 min-h-0 rounded-xl overflow-hidden bg-white border border-black/[0.05]"
                        >
                          <GarmentArtwork
                            product={comp}
                            className="w-full h-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stylist Rationale + Petite Note + Merchant Profit Strip */}
                  <div className="px-4 pt-3 pb-2 space-y-2">
                    <p className="text-xs text-[#4E535B] leading-relaxed">
                      {outfit.stylistRationale}
                    </p>
                    <p className="text-[11px] font-semibold text-[#1D4232] bg-[#F4F8F5] border border-[#D4E8DC] rounded-xl px-2.5 py-1.5">
                      {outfit.petiteProportionNote}
                    </p>

                    {showMerchantMargins && outfit.dropshipPieceCount > 0 && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-[#FEF6E6] border border-[#F4DFB4] flex items-center justify-between text-[11px] font-bold text-[#8A5808]">
                        <span>
                          {outfit.dropshipPieceCount} AliExpress Dropship Piece
                          {outfit.dropshipPieceCount > 1 ? "s" : ""} (Cost $
                          {outfit.totalWholesaleCostUsd.toFixed(2)})
                        </span>
                        <span className="text-[#15803D]">
                          +${outfit.totalStoreProfitUsd.toFixed(2)} Store Profit
                        </span>
                      </div>
                    )}

                    {/* Per-Piece Interactive Breakdown (Every Piece Has 360° Front & Back!) */}
                    <div className="space-y-1.5 pt-1">
                      {outfit.items.map((item) => {
                        const szInfo = outfit.perItemSizes[item.id];
                        const isDropship =
                          item.sourceType === "aliexpress_dropship";
                        return (
                          <div
                            key={item.id}
                            className="p-2 rounded-xl bg-[#F8F9FB] border border-black/[0.05] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <Link
                                href={`/product/${encodeURIComponent(item.id)}`}
                                className="block text-xs font-bold text-[#141518] hover:underline truncate"
                              >
                                {item.title}
                              </Link>
                              <p className="text-[10.5px] text-[#686D76] truncate">
                                {item.brand} • <strong>${item.price}</strong> •
                                Size {szInfo?.usSize || "S"}
                                {szInfo?.supplierTag
                                  ? ` (${szInfo.supplierTag})`
                                  : ""}
                                {isDropship ? " • Choice Air" : ""}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <Link
                                href={`/product/${encodeURIComponent(item.id)}`}
                                className="px-2 py-1.5 rounded-full bg-[#E7F3EE] hover:bg-[#D5E9DE] text-[10px] font-bold text-[#1D4232]"
                              >
                                Page →
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  openAvatar360({
                                    title: `${item.brand} — ${item.title}`,
                                    primaryProduct: item,
                                    initialAngleMode: "split",
                                  })
                                }
                                title="Inspect Front & Back 360° Look"
                                className="px-2.5 py-1.5 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[10.5px] font-bold text-[#141518] inline-flex items-center gap-1 cursor-pointer shrink-0"
                              >
                                <Rotate3d className="w-3 h-3 text-[#244B3B]" /> 360°
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Action Bar (Zero Crowding, Clean Hit Targets) */}
                <div className="px-4 py-3 border-t border-black/[0.06] bg-[#FAFAFC] flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        for (const item of outfit.items) {
                          const sz =
                            outfit.perItemSizes[item.id]?.usSize || "S";
                          addToBag({
                            productId: item.id,
                            title: item.title,
                            brand: item.brand,
                            price: item.price,
                            size: sz,
                            imageUrl: item.imageUrl,
                            storeUrl: item.canonicalUrl,
                          });
                        }
                      }}
                      className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" /> + Bag ($
                      {outfit.totalValue})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!hero) return;
                        openAvatar360({
                          title: `${outfit.title} (${outfit.items.length}-Piece Look)`,
                          primaryProduct: hero,
                          companionProducts: outfit.items.slice(1),
                          initialAngleMode: "split",
                        });
                      }}
                      className="px-3 py-2 rounded-full bg-[#EBF3EE] hover:bg-[#DCECE3] border border-[#C5DFD0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Rotate3d className="w-3.5 h-3.5" /> 360° Front/Back
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleLikeAiOutfit(outfit)}
                      aria-label={`Like ${outfit.title}`}
                      className={`px-3 py-2 rounded-full text-xs font-bold inline-flex items-center gap-1 border cursor-pointer transition ${
                        liked
                          ? "bg-[#FDEEF4] text-[#9D174D] border-[#F9A8D4]"
                          : "bg-white hover:bg-[#F4F5F7] text-[#141518] border-black/10"
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          liked ? "fill-[#9D174D] text-[#9D174D]" : ""
                        }`}
                      />
                      {liked ? "Saved" : "Vibe"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveStoryOutfit(outfit)}
                      title="Generate 1080×1920 Instagram Story Poll Card"
                      aria-label={`Share ${outfit.title} to Instagram Story`}
                      className="px-2.5 py-2 rounded-full bg-[#FDEEF4] hover:bg-[#FADCE8] border border-[#F5C5D8] text-[#9D174D] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition"
                    >
                      <Instagram className="w-3.5 h-3.5" /> IG Story
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <IgStoryLookbookModal
          outfit={activeStoryOutfit}
          socialDna={socialDna}
          avatarHeightDisplay={`${Math.floor(activeAvatar.heightInches / 12)}'${Math.round(
            activeAvatar.heightInches % 12
          )}"`}
          onClose={() => setActiveStoryOutfit(null)}
          onToast={showToast}
        />

        {/* Infinite Scroll Sentinel + Manual Load More Button */}
        <div
          ref={sentinelRef}
          className="pt-4 flex flex-col items-center justify-center gap-2"
        >
          <button
            type="button"
            id="gwo-load-more-outfits-btn"
            onClick={loadNextBatch}
            className="px-6 py-3 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer transition"
          >
            <Sparkles className="w-4 h-4 text-[#A7D7C5]" />
            Generate 6 More AI Outfits (Currently {outfits.length} Looks)
          </button>
          <p className="text-xs text-[#686D76]">
            Scroll down anytime — AI Stylist builds fresh head-to-toe looks automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

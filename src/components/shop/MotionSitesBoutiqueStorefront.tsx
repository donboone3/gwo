"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  Heart,
  Minus,
  Plus,
  Rotate3d,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  User,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import "../product/spin-product.css";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  formatCompactOutfitTitle,
  formatCompactProductTitle,
} from "@/lib/catalog/compact-title";
import { resolveLifelikeAvatarPhotos } from "@/lib/catalog/avatar-photo-resolver";
import {
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
} from "@/lib/three/body-scan-analyzer";
import { certifyClothingItemRealism } from "@/lib/realism/master-avatar-clothing-realism";
import { launchFlyToBag } from "@/lib/motion/fly-to-bag";
import { AiRunwayOutfit } from "@/lib/stylist/runway-ai-outfits";
import { Product } from "@/lib/types";

const WISHLIST_STORAGE_KEY = "gwo_boutique_wishlist_v1";

type StoreCategoryKey =
  | "all"
  | "dress"
  | "top"
  | "bottom"
  | "outerwear"
  | "shoes"
  | "accessory"
  | "saved"
  | "sets";

type SortMode = "featured" | "best_fit" | "price_asc" | "price_desc";

interface MotionSitesBoutiqueStorefrontProps {
  catalog: Product[];
  outfits: AiRunwayOutfit[];
  ownedIds: Set<string>;
  onTryPieceOnRunway?: (product: Product) => void;
  onJumpToOutfitOnRunway?: (outfitIdx: number) => void;
}

function getSizeOptionsForProduct(prod: Product): string[] {
  const chartKeys = Object.keys(prod.sizeChartInches || {});
  if (chartKeys.length > 0) return chartKeys.slice(0, 5);
  if (prod.availableSizes && prod.availableSizes.length > 0) {
    return prod.availableSizes.slice(0, 5);
  }
  if (prod.category === "shoes") return ["6.5", "7", "7.5", "8", "8.5"];
  if (prod.category === "accessory") return ["ONE SIZE"];
  return ["XS", "S", "M", "L"];
}

export function MotionSitesBoutiqueStorefront({
  catalog,
  outfits,
  ownedIds,
  onTryPieceOnRunway,
  onJumpToOutfitOnRunway,
}: MotionSitesBoutiqueStorefrontProps) {
  const {
    user,
    customAvatar,
    addToBag,
    openDropshipCheckout,
    setAvatarModalOpen,
    showToast,
  } = useGwo();

  const bodyDims = useMemo(
    () => deriveFullBodyDimensionsFromProfile(user, customAvatar),
    [customAvatar, user]
  );
  const avatarHeightStr = formatHeightFeetInches(bodyDims.heightInches);

  const avatarStats = useMemo(
    () => ({
      heightInches: bodyDims.heightInches,
      bustInches: bodyDims.bustInches,
      waistInches: bodyDims.waistInches,
      hipsInches: bodyDims.hipsInches,
      shoeSize: bodyDims.shoeSize,
    }),
    [bodyDims]
  );

  // Wishlist state persisted in localStorage
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setWishlistIds(new Set(parsed));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleWishlist = useCallback(
    (productId: string, title: string) => {
      setWishlistIds((prev) => {
        const next = new Set(prev);
        const added = !next.has(productId);
        if (added) next.add(productId);
        else next.delete(productId);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(
              WISHLIST_STORAGE_KEY,
              JSON.stringify(Array.from(next))
            );
          } catch {
            // ignore
          }
        }
        showToast(
          added ? `Saved "${title}" to Loves ♡` : `Removed "${title}" from Loves`
        );
        return next;
      });
    },
    [showToast]
  );

  // Category, Search & Sort
  const [activeCategory, setActiveCategory] = useState<StoreCategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("featured");

  // Per-card size overrides + rolling "Added ✓" feedback
  const [sizeByProductId, setSizeByProductId] = useState<Record<string, string>>(
    {}
  );
  const [justAddedIds, setJustAddedIds] = useState<Record<string, boolean>>({});
  const cardImgRefs = useRef<Record<string, HTMLElement | null>>({});

  // Featured 1-for-1 MotionSites Spin-Product Showcase State
  const [spotlightProductId, setSpotlightProductId] = useState<string>(
    () => catalog[0]?.id || "prod-ae-espresso-corset"
  );
  const spotlightRef = useRef<HTMLElement | null>(null);

  const spotlightProduct = useMemo(
    () =>
      catalog.find((p) => p.id === spotlightProductId) ||
      catalog[0] ||
      null,
    [catalog, spotlightProductId]
  );

  const [spotlightMode, setSpotlightMode] = useState<"avatar" | "product">(
    "avatar"
  );
  const [spotlightYaw, setSpotlightYaw] = useState<number | undefined>(0);
  const [spotlightYawSeq, setSpotlightYawSeq] = useState(0);
  const [liveDeg, setLiveDeg] = useState(0);
  const [openAcc, setOpenAcc] = useState<string>("details");
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);
  const spotlightStageRef = useRef<HTMLDivElement | null>(null);

  const handleSpotlightYawChange = useCallback((deg: number) => {
    setLiveDeg(((Math.round(deg) % 360) + 360) % 360);
  }, []);

  const counts = useMemo(() => {
    const c = {
      all: catalog.length,
      dress: 0,
      top: 0,
      bottom: 0,
      outerwear: 0,
      shoes: 0,
      accessory: 0,
    };
    for (const p of catalog) {
      if (p.category in c) {
        c[p.category as keyof typeof c] += 1;
      }
    }
    return c;
  }, [catalog]);

  const enrichedProducts = useMemo(() => {
    return catalog.map((prod, index) => {
      const fit = analyzeExactAvatarFit(avatarStats, prod);
      return {
        prod,
        index,
        fit,
        sizeOptions: getSizeOptionsForProduct(prod),
      };
    });
  }, [avatarStats, catalog]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === "sets") return [];
    let list = enrichedProducts;

    if (activeCategory === "saved") {
      list = list.filter((item) => wishlistIds.has(item.prod.id));
    } else if (activeCategory !== "all") {
      list = list.filter((item) => item.prod.category === activeCategory);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(({ prod }) =>
        `${prod.title} ${prod.brand} ${prod.colorName} ${prod.category}`
          .toLowerCase()
          .includes(q)
      );
    }

    if (sortMode === "price_asc") {
      list = [...list].sort((a, b) => a.prod.price - b.prod.price);
    } else if (sortMode === "price_desc") {
      list = [...list].sort((a, b) => b.prod.price - a.prod.price);
    } else if (sortMode === "best_fit") {
      list = [...list].sort((a, b) => b.fit.confidencePct - a.fit.confidencePct);
    }
    return list;
  }, [activeCategory, enrichedProducts, searchQuery, sortMode, wishlistIds]);

  // IntersectionObserver staggered card reveal
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = gridRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>(".gwo-ecomm-card")
    );
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            obs.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "80px 0px", threshold: 0.06 }
    );
    cards.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [filteredProducts, activeCategory]);

  const triggerCardAddToBag = useCallback(
    (
      prod: Product,
      chosenSize: string,
      sourceEl: HTMLElement | null | undefined,
      buyNow = false
    ) => {
      const photos = resolveLifelikeAvatarPhotos({
        product: prod,
        lookIndex: prod.studioLookIndex,
      });

      if (!buyNow) {
        launchFlyToBag(sourceEl, prod.imageUrl);
        setJustAddedIds((prev) => ({ ...prev, [prod.id]: true }));
        setTimeout(() => {
          setJustAddedIds((prev) => ({ ...prev, [prod.id]: false }));
        }, 1500);
      }

      addToBag({
        productId: prod.id,
        title: prod.title,
        brand: prod.brand || "GWO Boutique",
        price: prod.price,
        size: chosenSize,
        imageUrl: prod.imageUrl,
        avatarFrontUrl: photos.frontUrl,
        avatarBackUrl: photos.backUrl,
        storeUrl: prod.canonicalUrl,
      });

      if (buyNow) {
        openDropshipCheckout("checkout");
      }
    },
    [addToBag, openDropshipCheckout]
  );

  const openProductInSpotlight = useCallback((prod: Product) => {
    setSpotlightProductId(prod.id);
    setSpotlightMode(
      prod.category === "shoes" || prod.category === "accessory"
        ? "product"
        : "avatar"
    );
    setSpotlightYaw(0);
    setSpotlightYawSeq((s) => s + 1);
    setActiveHotspot(null);
    setTimeout(() => {
      spotlightRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 30);
  }, []);

  const spotlightFit = useMemo(
    () =>
      spotlightProduct
        ? analyzeExactAvatarFit(
            avatarStats,
            spotlightProduct,
            sizeByProductId[spotlightProduct.id]
          )
        : null,
    [avatarStats, sizeByProductId, spotlightProduct]
  );

  const spotlightSizes = useMemo(
    () => (spotlightProduct ? getSizeOptionsForProduct(spotlightProduct) : ["S"]),
    [spotlightProduct]
  );

  const activeSpotlightSize =
    (spotlightProduct && sizeByProductId[spotlightProduct.id]) ||
    spotlightFit?.recommendedSize ||
    spotlightSizes[0] ||
    "S";

  const activeSpotlightSizeIdx = Math.max(
    0,
    spotlightSizes.indexOf(activeSpotlightSize)
  );

  const spotlightRealism = useMemo(
    () =>
      spotlightProduct
        ? certifyClothingItemRealism(
            spotlightProduct,
            bodyDims,
            activeSpotlightSize
          )
        : null,
    [activeSpotlightSize, bodyDims, spotlightProduct]
  );

  const showFrontHotspots =
    spotlightMode === "avatar" && (liveDeg <= 24 || liveDeg >= 336);

  return (
    <section
      id="gwo-ecomm-storefront"
      aria-label="Shop All Girls Boutique Clothing"
      className="scroll-mt-16 w-full bg-[#FDF8FA] text-[#22131A] pb-24"
    >
      {/* ==================== STICKY BOUTIQUE HEADER & DEPARTMENT FILTER BAR ==================== */}
      <div className="max-w-[1480px] mx-auto px-3.5 sm:px-6 pt-8 sm:pt-12 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[#ECD7E1]">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B83B6A]">
              GWO Girls&apos; Boutique • New Season Edit
            </p>
            <h2 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#22131A] leading-none">
              Shop the Collection
            </h2>
            <p className="text-xs sm:text-sm text-[#745C67]">
              Every dress, corset, skirt, heel &amp; bag calibrated to your{" "}
              <strong className="text-[#22131A]">{avatarHeightStr}</strong> body
              scan — shop solo pieces or full runway sets.
            </p>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#9E8490] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="gwo-store-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dresses, satin, heels..."
                className="w-full pl-9 pr-3.5 py-2 rounded-full bg-white border border-[#EBD2DE] text-xs text-[#22131A] placeholder:text-[#9E8490] focus:outline-none focus:border-[#B83B6A]"
              />
            </div>

            <div className="relative inline-flex items-center">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#962953] absolute left-3 pointer-events-none" />
              <select
                aria-label="Sort boutique products"
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="pl-8 pr-3.5 py-2 rounded-full bg-white border border-[#EBD2DE] text-xs font-bold text-[#22131A] cursor-pointer focus:outline-none focus:border-[#B83B6A]"
              >
                <option value="featured">Sort: Featured</option>
                <option value="best_fit">Sort: Best Scan Fit</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Category Strip */}
      <div className="sticky top-16 z-30 bg-[#FDF8FA]/94 backdrop-blur-md border-b border-[#ECD7E1]">
        <div className="max-w-[1480px] mx-auto px-3.5 sm:px-6 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {(
              [
                ["all", `All Clothing (${counts.all})`],
                ["dress", `Dresses (${counts.dress})`],
                ["top", `Tops & Corsets (${counts.top})`],
                ["bottom", `Skirts & Pants (${counts.bottom})`],
                ["outerwear", `Jackets & Coats (${counts.outerwear})`],
                ["shoes", `Heels & Boots (${counts.shoes})`],
                ["accessory", `Bags & Belts (${counts.accessory})`],
                ["sets", `100 Outfit Sets`],
                ["saved", `♡ Loves (${wishlistIds.size})`],
              ] as const
            ).map(([key, label]) => {
              const active = activeCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 transition cursor-pointer border ${
                    active
                      ? "bg-[#22131A] text-white border-[#22131A] shadow-[0_4px_12px_rgba(34,19,26,0.16)]"
                      : "bg-white hover:bg-[#FCECF3] text-[#6E5360] border-[#ECD7E1] hover:text-[#962953]"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full bg-[#F49AC1] transition-transform duration-200 ${
                      active ? "scale-100" : "scale-0 w-0"
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:inline text-xs font-semibold text-[#745C67] shrink-0">
            {activeCategory === "sets"
              ? `${outfits.length} Runway Sets`
              : `${filteredProducts.length} Pieces`}
          </span>
        </div>
      </div>

      {/* ==================== MAIN E-COMMERCE PRODUCT GRID (OR 100 SETS GRID) ==================== */}
      <div className="max-w-[1480px] mx-auto px-3.5 sm:px-6 pt-6">
        {activeCategory === "sets" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {outfits.slice(0, 24).map((outfit, idx) => (
              <article
                key={outfit.id}
                className="rounded-[24px] bg-white border border-[#ECD7E1] hover:border-[#D7A2B8] overflow-hidden flex flex-col justify-between shadow-[0_8px_24px_rgba(150,41,83,0.05)] transition"
              >
                <div>
                  <div className="relative aspect-[3/4] bg-gradient-to-b from-[#FFFBFD] to-[#FAECF2] overflow-hidden flex items-end justify-center pt-3">
                    <img
                      src={outfit.frontAvatarUrl}
                      alt={outfit.title}
                      loading="lazy"
                      className="h-full w-full object-contain object-bottom hover:scale-[1.03] transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/92 backdrop-blur-md border border-[#ECD7E1] text-[10px] font-bold text-[#962953]">
                      Look #{String(outfit.outfitNumber).padStart(2, "0")} •{" "}
                      {outfit.occasion}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-1">
                    <h3 className="text-xs sm:text-sm font-bold text-[#22131A] line-clamp-1">
                      {formatCompactOutfitTitle(outfit.title, 30)}
                    </h3>
                    <p className="text-[11px] text-[#745C67]">
                      {outfit.pieces.length} Coordinated Pieces •{" "}
                      <strong className="text-[#962953]">
                        ${outfit.totalPriceUsd}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="px-3.5 pb-3.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToOutfitOnRunway?.(idx);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex-1 py-2 px-2.5 rounded-full bg-[#FCECF3] hover:bg-[#F8DCE8] text-[#962953] text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowUp className="w-3 h-3" /> Try on Runway
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      outfit.pieces.forEach((p) => {
                        addToBag({
                          productId: p.product.id,
                          title: p.product.title,
                          brand: p.product.brand,
                          price: p.product.price,
                          size: p.recommendedSize,
                          imageUrl: p.product.imageUrl,
                          avatarFrontUrl: outfit.frontAvatarUrl,
                          avatarBackUrl: outfit.backAvatarUrl,
                          storeUrl: p.product.canonicalUrl,
                        });
                      });
                      showToast(
                        `Added all ${outfit.pieces.length} pieces of "${outfit.title}" to Bag!`
                      );
                    }}
                    className="py-2 px-3 rounded-full bg-[#B83B6A] hover:bg-[#962953] text-white text-[11px] font-bold cursor-pointer"
                  >
                    + Set
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl bg-white border border-[#ECD7E1] p-12 text-center space-y-3">
            <p className="font-editorial text-2xl text-[#22131A]">
              {activeCategory === "saved"
                ? "Your Loves list is waiting for your first crush ♡"
                : "No boutique pieces matched that filter"}
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveCategory("all");
                setSearchQuery("");
              }}
              className="px-5 py-2.5 rounded-full bg-[#B83B6A] text-white text-xs font-bold cursor-pointer"
            >
              View All {counts.all} Clothing Pieces
            </button>
          </div>
        ) : (
          <div
            ref={gridRef}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
          >
            {filteredProducts.map(({ prod, index, fit, sizeOptions }) => {
              const isLoved = wishlistIds.has(prod.id);
              const isOwned = ownedIds.has(prod.id);
              const chosenSize =
                sizeByProductId[prod.id] ||
                fit.recommendedSize ||
                sizeOptions[0] ||
                "S";
              const justAdded = Boolean(justAddedIds[prod.id]);
              const pdpHref = `/product/${encodeURIComponent(prod.id)}`;

              return (
                <article
                  key={prod.id}
                  data-ecomm-product-card="true"
                  style={{ transitionDelay: `${(index % 4) * 45}ms` }}
                  className="gwo-ecomm-card group rounded-[22px] sm:rounded-[26px] bg-white border border-[#ECD7E1] hover:border-[#D99BB4] hover:shadow-[0_18px_40px_rgba(150,41,83,0.09)] overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    {/* 3:4 Portrait Boutique Studio Frame */}
                    <div
                      ref={(el) => {
                        cardImgRefs.current[prod.id] = el;
                      }}
                      className="relative aspect-[3/4] bg-gradient-to-b from-[#FFFDFE] via-[#FCF5F8] to-[#F9ECF2] border-b border-[#F2E2EA] overflow-hidden"
                    >
                      <Link
                        href={pdpHref}
                        className="block w-full h-full p-3 sm:p-5 pb-11 sm:pb-12"
                      >
                        <GarmentArtwork
                          product={prod}
                          cleanCard
                          className="w-full h-full transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                        />
                      </Link>

                      {/* Top-Left Editorial Badge */}
                      <span
                        className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold tracking-wide backdrop-blur-md border ${
                          isOwned
                            ? "bg-[#FCECF3]/95 border-[#F0C5D7] text-[#8A244C]"
                            : "bg-white/92 border-[#ECD7E1] text-[#22131A]"
                        }`}
                      >
                        {isOwned
                          ? "In Closet ✓"
                          : chosenSize === "ONE SIZE"
                          ? `${fit.confidencePct}% Fit`
                          : `Size ${fit.recommendedSize} • ${fit.confidencePct}%`}
                      </span>

                      {/* Top-Right Wishlist Heart */}
                      <button
                        type="button"
                        aria-label={`Save ${prod.title} to Loves`}
                        aria-pressed={isLoved}
                        onClick={() => toggleWishlist(prod.id, prod.title)}
                        className="gwo-heart-btn absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/92 hover:bg-white backdrop-blur-md border border-[#ECD7E1] flex items-center justify-center shadow-xs cursor-pointer"
                      >
                        <Heart
                          className={`w-3.5 h-3.5 transition-colors ${
                            isLoved
                              ? "fill-[#B83B6A] text-[#B83B6A]"
                              : "text-[#6E5360]"
                          }`}
                        />
                      </button>

                      {/* Quick-Action Pill Strip on Bottom of Portrait Frame */}
                      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => openProductInSpotlight(prod)}
                          className="px-2.5 py-1 rounded-full bg-white/94 hover:bg-[#22131A] hover:text-white backdrop-blur-md border border-[#ECD7E1] text-[10px] font-bold text-[#22131A] inline-flex items-center gap-1 shadow-xs transition cursor-pointer"
                        >
                          <Rotate3d className="w-3 h-3 text-[#B83B6A]" /> 360° Spin
                        </button>

                        {onTryPieceOnRunway && (
                          <button
                            type="button"
                            onClick={() => {
                              onTryPieceOnRunway(prod);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-2.5 py-1 rounded-full bg-[#FCECF3]/95 hover:bg-[#B83B6A] hover:text-white backdrop-blur-md border border-[#F0C5D7] text-[10px] font-bold text-[#962953] inline-flex items-center gap-0.5 shadow-xs transition cursor-pointer"
                          >
                            Try ↑
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Editorial Product Metadata + Inline Size Pills */}
                    <div className="p-3 sm:p-4 space-y-2">
                      <div className="flex items-center justify-between gap-1.5 text-[10.5px] text-[#745C67]">
                        <span className="inline-flex items-center gap-1.5 truncate font-semibold">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: prod.colorHex }}
                          />
                          <span className="truncate">{prod.colorName}</span>
                        </span>
                        <span className="font-editorial text-sm sm:text-base font-bold text-[#22131A] shrink-0">
                          ${prod.price}
                        </span>
                      </div>

                      <Link
                        href={pdpHref}
                        className="block text-xs sm:text-[13px] font-bold text-[#22131A] hover:text-[#B83B6A] leading-snug line-clamp-1 transition-colors"
                      >
                        {formatCompactProductTitle(prod, 28)}
                      </Link>

                      {/* Inline Size Selector Pills (Single Crisp Row on Mobile & Desktop) */}
                      <div
                        role="radiogroup"
                        aria-label={`Select size for ${prod.title}`}
                        className="flex items-center gap-1 flex-nowrap pt-0.5 overflow-x-auto"
                      >
                        {sizeOptions.slice(0, 4).map((sz) => {
                          const activeSz = chosenSize === sz;
                          return (
                            <button
                              key={sz}
                              type="button"
                              role="radio"
                              aria-checked={activeSz}
                              onClick={() =>
                                setSizeByProductId((prev) => ({
                                  ...prev,
                                  [prod.id]: sz,
                                }))
                              }
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer min-w-[26px] shrink-0 ${
                                activeSz
                                  ? "bg-[#22131A] text-white border-[#22131A]"
                                  : "bg-[#FDF7FA] hover:bg-[#FCECF3] text-[#6E5360] border-[#ECD7E1]"
                              }`}
                            >
                              {sz === "ONE SIZE" ? "One Size" : sz}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Rolling Add-to-Bag + Quick Buy Row */}
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        triggerCardAddToBag(
                          prod,
                          chosenSize,
                          cardImgRefs.current[prod.id],
                          false
                        )
                      }
                      className="flex-1 py-2 px-2.5 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#962953] hover:brightness-105 text-white text-[11px] font-bold flex items-center justify-center shadow-[0_4px_12px_rgba(184,59,106,0.22)] cursor-pointer transition"
                    >
                      <span className="gwo-roll-track">
                        <span
                          className={`gwo-roll-inner ${
                            justAdded ? "rolled" : ""
                          }`}
                        >
                          <span>
                            <ShoppingBag className="w-3 h-3 shrink-0" />
                            Add to Bag
                          </span>
                          <span>
                            <Check className="w-3 h-3 shrink-0" />
                            Added ✓
                          </span>
                        </span>
                      </span>
                    </button>

                    <Link
                      href={pdpHref}
                      className="py-2 px-2.5 rounded-full bg-[#FCECF3] hover:bg-[#F7D7E5] text-[#962953] text-[10.5px] font-bold whitespace-nowrap transition"
                      title="Open full 360° clothing product page"
                    >
                      Page →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================== 1-FOR-1 MOTIONSITES "SPIN PRODUCT" CLOTHING PRODUCT SHOWCASE ==================== */}
      {spotlightProduct && spotlightFit && (
        <section
          ref={spotlightRef}
          id="gwo-motionsites-spin-pdp"
          className="scroll-mt-20 max-w-[1480px] mx-auto px-3.5 sm:px-6 pt-14 sm:pt-20"
        >
          <div className="rounded-[30px] sm:rounded-[36px] bg-gradient-to-br from-[#FFFDFE] via-[#FCF2F7] to-[#FDF6F3] border border-[#EBD2DE] shadow-[0_24px_60px_rgba(150,41,83,0.08)] overflow-hidden p-4 sm:p-8 lg:p-10 space-y-6">
            {/* Breadcrumb + Quick Piece Switcher Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#ECD7E1]">
              <nav
                aria-label="Product breadcrumb"
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#745C67]"
              >
                <span>GWO Boutique</span>
                <span className="text-[#D4A6B8]">/</span>
                <span>{spotlightProduct.category}</span>
                <span className="text-[#D4A6B8]">/</span>
                <span className="text-[#B83B6A] truncate max-w-[180px] sm:max-w-none">
                  {formatCompactProductTitle(spotlightProduct, 30)}
                </span>
              </nav>

              <Link
                href={`/product/${encodeURIComponent(spotlightProduct.id)}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#FCECF3] border border-[#EBD2DE] text-xs font-bold text-[#962953] transition"
              >
                Open Full-Screen Measurement Chart{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* 3-Column 1-for-1 MotionSites Spin-Product Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* LEFT COLUMN (4 COLS): Editorial Title, Price, Fit Summary & [+]/[-] 0fr->1fr Accordion */}
              <div className="lg:col-span-4 space-y-5 order-2 lg:order-1">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCECF3] border border-[#F0C5D7] text-[11px] font-bold text-[#962953]">
                    <Sparkles className="w-3 h-3 text-[#B83B6A]" />
                    {spotlightProduct.brand} • {spotlightFit.confidencePct}% Body-Scan Match
                  </span>

                  <h3 className="font-editorial text-3xl sm:text-4xl font-semibold text-[#22131A] leading-[1.08]">
                    {spotlightProduct.title}
                  </h3>

                  <div className="flex items-baseline gap-3 pt-1">
                    <span className="font-editorial text-3xl font-bold text-[#22131A]">
                      ${spotlightProduct.price}
                    </span>
                    <span className="text-xs font-semibold text-[#745C67]">
                      Color: <strong className="text-[#22131A]">{spotlightProduct.colorName}</strong> • Free Boutique Returns
                    </span>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#634B56] leading-relaxed">
                  {spotlightProduct.fitMetadata?.descriptionSummary ||
                    spotlightFit.headlineVerdict}
                </p>

                {/* [+]/[-] Animated 0fr -> 1fr Editorial Details Accordion */}
                <div className="border-t border-b border-[#ECD7E1] divide-y divide-[#ECD7E1]">
                  {[
                    {
                      id: "details",
                      title: "Tailored Fit & Silhouette",
                      content: (
                        <div className="space-y-1.5 text-xs text-[#634B56] leading-relaxed">
                          <p className="font-semibold text-[#22131A]">
                            {spotlightFit.headlineVerdict}
                          </p>
                          <p>{spotlightFit.lengthComparison.proportionNote}</p>
                        </div>
                      ),
                    },
                    {
                      id: "fabric",
                      title: "Fabric Drape & Care",
                      content: (
                        <div className="space-y-1 text-xs text-[#634B56] leading-relaxed">
                          <p>
                            <strong className="text-[#22131A]">
                              {spotlightRealism?.fabricProfile.displayName || "Atelier Weave"}:
                            </strong>{" "}
                            {spotlightFit.fabricSummary}
                          </p>
                          <p>{spotlightRealism?.fabricProfile.handfeelNote}</p>
                        </div>
                      ),
                    },
                    {
                      id: "shipping",
                      title: "Complimentary Shipping & Exchanges",
                      content: (
                        <p className="text-xs text-[#634B56] leading-relaxed">
                          Express tracked boutique air delivery in{" "}
                          {spotlightProduct.estDeliveryDays || 6} business days,
                          with instant size exchanges backed by your 3D scan.
                        </p>
                      ),
                    },
                  ].map((item) => {
                    const isOpen = openAcc === item.id;
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() => setOpenAcc(isOpen ? "" : item.id)}
                          className="w-full py-3.5 flex items-center justify-between text-xs sm:text-[13px] font-bold text-[#22131A] hover:text-[#B83B6A] cursor-pointer transition-colors"
                        >
                          <span>{item.title}</span>
                          {isOpen ? (
                            <Minus className="w-4 h-4 text-[#B83B6A]" />
                          ) : (
                            <Plus className="w-4 h-4 text-[#745C67]" />
                          )}
                        </button>
                        <div className={`gwo-acc-grid ${isOpen ? "open" : ""}`}>
                          <div className="gwo-acc-inner">
                            <div className="pb-3.5">{item.content}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CENTER COLUMN (4 COLS): Interactive 360° Spin Stage + Pulsing Hotspots + Degree Scrubber */}
              <div className="lg:col-span-4 flex flex-col items-center gap-3 order-1 lg:order-2">
                <div
                  ref={spotlightStageRef}
                  className="relative w-full h-[430px] sm:h-[500px] rounded-[28px] gwo-couture-stage-bg border border-[#ECD7E1] shadow-[0_14px_36px_rgba(150,41,83,0.08)] overflow-hidden"
                >
                  {spotlightMode === "avatar" ? (
                    <Interactive3DAvatarStage
                      mode="avatar"
                      dimensions={bodyDims}
                      wornPieces={[
                        {
                          product: spotlightProduct,
                          selectedSize: activeSpotlightSize,
                        },
                      ]}
                      faceOvalDataUrl={customAvatar?.faceOvalDataUrl || null}
                      customAvatarTurntableMp4Url={customAvatar?.turntableMp4Url}
                      customAvatarTurntablePosterUrl={
                        customAvatar?.turntablePosterUrl
                      }
                      externalYawDeg={spotlightYaw}
                      externalYawSeq={spotlightYawSeq}
                      initialYawDeg={0}
                      inertiaSpin={true}
                      onYawChange={handleSpotlightYawChange}
                      showHud={false}
                    />
                  ) : (
                    <Interactive3DAvatarStage
                      mode="product"
                      dimensions={bodyDims}
                      singleProduct={spotlightProduct}
                      selectedSize={activeSpotlightSize}
                      externalYawDeg={spotlightYaw}
                      externalYawSeq={spotlightYawSeq}
                      initialYawDeg={0}
                      inertiaSpin={true}
                      onYawChange={handleSpotlightYawChange}
                      showHud={false}
                    />
                  )}

                  {/* Pulsing Garment Construction Hotspots when facing Front 0° */}
                  {[
                    {
                      left: "56%",
                      top: "34%",
                      title: spotlightRealism?.fabricProfile.displayName || "Couture Weave",
                      note: spotlightRealism?.fabricProfile.drapeBehavior || "Fluid studio drape calibrated to your scan.",
                    },
                    {
                      left: "44%",
                      top: "49%",
                      title: `Size ${activeSpotlightSize} Waist Fit`,
                      note: spotlightFit.headlineVerdict,
                    },
                  ].map((hs, idx) => {
                    const isOpenHs = activeHotspot === idx;
                    return (
                      <button
                        key={hs.title}
                        type="button"
                        onClick={() =>
                          setActiveHotspot(isOpenHs ? null : idx)
                        }
                        aria-label={hs.title}
                        style={{ left: hs.left, top: hs.top }}
                        className={`sp-hs ${showFrontHotspots ? "show" : ""}`}
                      >
                        <span>{isOpenHs ? "−" : "+"}</span>
                        <span
                          style={
                            isOpenHs
                              ? { clipPath: "inset(0 0 0 0 round 14px)" }
                              : undefined
                          }
                          className={`sp-tip ${idx === 0 ? "left" : "right"}`}
                        >
                          <span className="sp-tip-title text-[#962953]">
                            {hs.title}
                          </span>
                          {hs.note}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Degree Progress Scrubber Readout */}
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 border border-[#ECD7E1] shadow-xs text-[10.5px] font-bold tracking-wider uppercase text-[#745C67]">
                  <span>Drag to Rotate</span>
                  <span className="relative w-20 h-[2px] rounded-full bg-[#ECD7E1]">
                    <span
                      style={{ left: `${((liveDeg / 360) * 100).toFixed(1)}%` }}
                      className="absolute top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 rounded-full bg-[#B83B6A]"
                    />
                  </span>
                  <span className="text-[#22131A] min-w-[34px] text-right">
                    {String(liveDeg).padStart(3, "0")}°
                  </span>
                </div>
              </div>

              {/* RIGHT COLUMN (4 COLS): Mode/Angle Brackets, Sliding Pill Size Selector & Fly-to-Bag */}
              <div className="lg:col-span-4 space-y-4 order-3">
                {/* Body 360° vs Item 360° + Angle Preset Strip */}
                <div className="p-3.5 rounded-3xl bg-white border border-[#ECD7E1] space-y-3">
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F9EEF3]">
                    <button
                      type="button"
                      onClick={() => setSpotlightMode("avatar")}
                      className={`py-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        spotlightMode === "avatar"
                          ? "bg-[#22131A] text-white shadow-xs"
                          : "text-[#6E5360] hover:text-[#22131A]"
                      }`}
                    >
                      <User className="w-3.5 h-3.5 text-[#F6B8D0]" /> On Your Body
                    </button>
                    <button
                      type="button"
                      onClick={() => setSpotlightMode("product")}
                      className={`py-1.5 rounded-full text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition ${
                        spotlightMode === "product"
                          ? "bg-[#22131A] text-white shadow-xs"
                          : "text-[#6E5360] hover:text-[#22131A]"
                      }`}
                    >
                      <Box className="w-3.5 h-3.5 text-[#F6B8D0]" /> Item 360°
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        [0, "Front 0°"],
                        [45, "3/4 45°"],
                        [90, "Side 90°"],
                        [180, "Back 180°"],
                      ] as const
                    ).map(([deg, lbl]) => {
                      const activeAng = Math.abs(liveDeg - deg) <= 15;
                      return (
                        <button
                          key={deg}
                          type="button"
                          onClick={() => {
                            setSpotlightYaw(deg);
                            setSpotlightYawSeq((s) => s + 1);
                            setLiveDeg(deg);
                          }}
                          className={`py-2 px-1.5 rounded-2xl text-[11px] font-bold border transition cursor-pointer ${
                            activeAng
                              ? "bg-[#FCECF3] border-[#B83B6A] text-[#962953]"
                              : "bg-[#FDF9FB] hover:bg-[#FCECF3] border-[#ECD7E1] text-[#6E5360]"
                          }`}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sliding Pill Size Selector */}
                <div className="p-4 rounded-3xl bg-white border border-[#ECD7E1] space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold uppercase tracking-wider text-[#22131A]">
                      Select Size
                    </span>
                    <button
                      type="button"
                      onClick={() => setAvatarModalOpen(true)}
                      className="font-bold text-[#B83B6A] hover:underline cursor-pointer"
                    >
                      Your {avatarHeightStr} Scan: {spotlightFit.recommendedSize}
                    </button>
                  </div>

                  <div
                    style={{
                      gridTemplateColumns: `repeat(${spotlightSizes.length}, minmax(0, 1fr))`,
                    }}
                    className="relative grid p-1 rounded-2xl bg-[#F8EAF0] border border-[#EBD2DE]"
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: `calc((100% - 8px) / ${spotlightSizes.length})`,
                        transform: `translateX(${activeSpotlightSizeIdx * 100}%)`,
                      }}
                      className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#22131A] shadow-sm transition-transform duration-300 ease-out pointer-events-none"
                    />
                    {spotlightSizes.map((sz) => {
                      const active = activeSpotlightSize === sz;
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() =>
                            setSizeByProductId((prev) => ({
                              ...prev,
                              [spotlightProduct.id]: sz,
                            }))
                          }
                          className={`relative z-10 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            active ? "text-white" : "text-[#6E5360] hover:text-[#22131A]"
                          }`}
                        >
                          {sz}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Fly-to-Bag Primary CTA + Wishlist Save */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        triggerCardAddToBag(
                          spotlightProduct,
                          activeSpotlightSize,
                          spotlightStageRef.current,
                          false
                        )
                      }
                      className="flex-1 py-3.5 px-5 rounded-full bg-gradient-to-r from-[#B83B6A] to-[#91244E] hover:brightness-105 text-white text-xs font-bold shadow-[0_8px_22px_rgba(184,59,106,0.28)] flex items-center justify-center gap-2 cursor-pointer transition"
                    >
                      <span className="gwo-roll-track">
                        <span
                          className={`gwo-roll-inner ${
                            justAddedIds[spotlightProduct.id] ? "rolled" : ""
                          }`}
                        >
                          <span>
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Add Size {activeSpotlightSize} to Bag — $
                            {spotlightProduct.price}
                          </span>
                          <span>
                            <Check className="w-3.5 h-3.5" />
                            Added Size {activeSpotlightSize} to Bag ✓
                          </span>
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      aria-label="Save to Loves"
                      aria-pressed={wishlistIds.has(spotlightProduct.id)}
                      onClick={() =>
                        toggleWishlist(spotlightProduct.id, spotlightProduct.title)
                      }
                      className="gwo-heart-btn w-12 h-12 rounded-full bg-white hover:bg-[#FCECF3] border border-[#EBD2DE] flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          wishlistIds.has(spotlightProduct.id)
                            ? "fill-[#B83B6A] text-[#B83B6A]"
                            : "text-[#6E5360]"
                        }`}
                      />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      triggerCardAddToBag(
                        spotlightProduct,
                        activeSpotlightSize,
                        spotlightStageRef.current,
                        true
                      )
                    }
                    className="w-full py-3 rounded-full bg-[#22131A] hover:bg-[#381F2B] text-white text-xs font-bold cursor-pointer transition"
                  >
                    Instant Boutique Checkout • ${spotlightProduct.price}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

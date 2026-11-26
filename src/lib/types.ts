export type GarmentCategory =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "accessory";

export type GarmentSilhouette =
  | "crop-tank"
  | "sports-bra"
  | "oversized-hoodie"
  | "baby-tee"
  | "cardigan"
  | "leggings"
  | "cargo-pants"
  | "mini-skirt"
  | "wide-denim"
  | "slip-dress"
  | "mini-dress"
  | "cropped-jacket"
  | "sneakers"
  | "ballet-flats"
  | "shoulder-bag";

export type FitRating = "runs_small" | "true_to_size" | "runs_large";

export type FabricStretchLevel = "rigid" | "low" | "medium" | "high";

export type GarmentCutType = "body-hugging" | "fitted" | "regular" | "oversized";

export type HemLandingType =
  | "cropped"
  | "natural-waist"
  | "hip"
  | "mini"
  | "midi"
  | "maxi"
  | "ankle"
  | "full-length";

export interface StoreModelStats {
  rawText?: string;
  heightInches?: number;
  heightDisplay?: string;
  wornSize?: string;
  bustInches?: number;
  waistInches?: number;
  hipsInches?: number;
}

export interface ProductGalleryAngle {
  url: string;
  label: string;
}

export interface ProductFitMetadata {
  descriptionSummary?: string;
  fitNotes: string[];
  fabricComposition?: string;
  elastanePct?: number;
  stretchLevel: FabricStretchLevel;
  cutType: GarmentCutType;
  storeFitTendency: FitRating;
  hemLanding?: HemLandingType;
  inseamInches?: number;
  hasAdjustableBack?: boolean;
  garmentLengthBySizeInches?: Record<string, number>;
  modelStats?: StoreModelStats;
  galleryImages?: ProductGalleryAngle[];
}

export interface SizeMeasurementSpec {
  bustMin?: number;
  bustMax?: number;
  waistMin?: number;
  waistMax?: number;
  hipsMin?: number;
  hipsMax?: number;
}

export interface DropshipListingSpec {
  supplierPlatform: "aliexpress";
  aliexpressItemId: string;
  supplierName: string;
  supplierUrl: string;
  supplierRating: number; // e.g. 4.9
  ordersCount: number; // e.g. 2450
  qualityTier: "Top 1% Gold Boutique" | "AliExpress Choice Verified";
  wholesaleCostUsd: number;
  shippingCostUsd: number;
  profitMarginUsd: number;
  marginPct: number;
  shippingMethod: string;
  /** Maps Customer US Size (e.g. "S") -> AliExpress Supplier Tag (e.g. "M") when boutique uses Asian sizing */
  cnSizeTagMap?: Record<string, string>;
}

export interface Product {
  id: string;
  canonicalUrl: string;
  brand: string;
  storeDomain: string;
  title: string;
  category: GarmentCategory;
  silhouette: GarmentSilhouette;
  colorName: string;
  colorHex: string;
  accentHex: string;
  price: number;
  currency: string;
  imageUrl?: string;
  studioLookIndex?: number;
  fitMetadata?: ProductFitMetadata;
  dropship?: DropshipListingSpec;
  occasions: string[];
  vibes: string[];
  availableSizes: string[];
  sizeChartInches: Record<string, SizeMeasurementSpec>;
  estDeliveryDays: number;
  inStock: boolean;
  sourceType: "affiliate_feed" | "scraped_url" | "aliexpress_dropship";
  addedByUsername?: string;
  lastScrapedAt: string;
  staleAfter: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarPhotoUrl?: string;
  skinTone: string;
  hairStyle: "waves-espresso" | "sleek-bun-blonde" | "curls-warm" | "straight-auburn";
  heightInches: number;
  bustInches: number;
  waistInches: number;
  hipsInches: number;
  shoeSize: string;
  pinterestVibe: string;
  isClosetPublic: boolean;
  referralCode: string;
  dailyTryonsUsed: number;
  bonusTryons: number;
  quotaResetDate: string;
}

export interface ClosetItem {
  id: string;
  userId: string;
  productId: string;
  purchasedSize: string;
  fitRating: FitRating;
  reviewNote: string;
  isPublic: boolean;
  timesWorn: number;
  createdAt: string;
}

export interface EnrichedClosetItem extends ClosetItem {
  product: Product;
  owner: UserProfile;
}

export interface BodyTwinMatch {
  friend: UserProfile;
  similarityScore: number; // 0-100
  closetItem?: ClosetItem;
  summary: string;
}

export interface SizeRecommendation {
  recommendedSize: string;
  confidence: "high" | "medium";
  chartNote: string;
  bodyTwin?: BodyTwinMatch;
}

export interface WornOutfitState {
  topId?: string;
  bottomId?: string;
  dressId?: string;
  outerwearId?: string;
  shoesId?: string;
  accessoryId?: string;
  referrerCode?: string;
}

export interface TryOnRender {
  id: string;
  cacheKey: string;
  userId: string;
  productIds: string[];
  renderedImageUrl?: string;
  fitPromptUsed?: string;
  provider: "fashn_fal" | "studio_composite";
  costUsd: number;
  cached: boolean;
  createdAt: string;
}

export interface ComputeBudgetLedger {
  monthKey: string;
  capUsd: number;
  spentUsd: number;
  paidRenders: number;
  cacheHits: number;
  updatedAt: string;
}

export interface AffiliateClick {
  id: string;
  productId: string;
  referrerCode?: string;
  clickedByUserId?: string;
  destinationUrl: string;
  createdAt: string;
}

export interface OutfitSuggestion {
  id: string;
  title: string;
  occasion: string;
  vibe: string;
  items: Product[];
  ownedItemIds: string[];
  netCostToBuy: number;
  totalValue: number;
  maxDeliveryDays: number;
  stylistRationale: string;
}

export type SocialStyleArchetype =
  | "siren_glam"
  | "model_off_duty"
  | "old_money_tailored"
  | "clean_athleisure"
  | "coquette_romantic"
  | "streetwear_luxe";

export interface SocialStyleDNA {
  instagramHandle?: string;
  tiktokHandle?: string;
  pinterestBoard?: string;
  archetypeScores: Record<SocialStyleArchetype, number>;
  primaryArchetype: SocialStyleArchetype;
  secondaryArchetype: SocialStyleArchetype;
  extractedPaletteHex: string[];
  glamSlider: number; // 0 = Daylight Casual, 100 = Night-Out Glam
  edgeSlider: number; // 0 = Soft Romantic, 100 = Sculpted Siren/Edge
  likedProductIds: string[];
  likedOutfitIds: string[];
  uploadedGridThumbs?: string[];
  styleSummary: string;
  updatedAt: string;
}

export interface EndlessAiOutfit extends OutfitSuggestion {
  sequenceNumber: number;
  socialDnaMatchPct: number;
  colorHarmonyScore: number;
  matchedArchetype: SocialStyleArchetype;
  petiteProportionNote: string;
  perItemSizes: Record<string, { usSize: string; supplierTag?: string }>;
  dropshipPieceCount: number;
  totalWholesaleCostUsd: number;
  totalStoreProfitUsd: number;
}

export interface LocalDatabaseSchema {
  profiles: UserProfile[];
  friendships: Array<{ userId: string; friendId: string }>;
  products: Product[];
  closetItems: ClosetItem[];
  tryonRenders: TryOnRender[];
  budgetLedgers: ComputeBudgetLedger[];
  affiliateClicks: AffiliateClick[];
}

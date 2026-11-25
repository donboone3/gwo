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
  fitMetadata?: ProductFitMetadata;
  occasions: string[];
  vibes: string[];
  availableSizes: string[];
  sizeChartInches: Record<string, SizeMeasurementSpec>;
  estDeliveryDays: number;
  inStock: boolean;
  sourceType: "affiliate_feed" | "scraped_url";
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

export interface LocalDatabaseSchema {
  profiles: UserProfile[];
  friendships: Array<{ userId: string; friendId: string }>;
  products: Product[];
  closetItems: ClosetItem[];
  tryonRenders: TryOnRender[];
  budgetLedgers: ComputeBudgetLedger[];
  affiliateClicks: AffiliateClick[];
}

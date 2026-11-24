import {
  BodyTwinMatch,
  EnrichedClosetItem,
  Product,
  SizeRecommendation,
  UserProfile,
} from "../types";

/**
 * Calculates a 0-100% body-measurement similarity score between two girls
 * so GWO can tell a user what size her closest "Body Twin" friend wears.
 */
export function calculateBodyTwinSimilarity(
  viewer: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches"
  >,
  friend: Pick<
    UserProfile,
    "heightInches" | "bustInches" | "waistInches" | "hipsInches"
  >
): number {
  const waistDiff = Math.abs(viewer.waistInches - friend.waistInches);
  const hipsDiff = Math.abs(viewer.hipsInches - friend.hipsInches);
  const bustDiff = Math.abs(viewer.bustInches - friend.bustInches);
  const heightDiff = Math.abs(viewer.heightInches - friend.heightInches);

  // Weighted penalty: waist & hips dominate bottom/dress fit; bust & height affect tops/length
  const penalty =
    waistDiff * 4.5 + hipsDiff * 3.5 + bustDiff * 3.0 + heightDiff * 1.8;

  return Math.max(0, Math.min(99, Math.round(100 - penalty)));
}

function shiftSize(
  sizes: string[],
  currentSize: string,
  direction: -1 | 1
): string {
  const idx = sizes.indexOf(currentSize);
  if (idx === -1) return currentSize;
  const nextIdx = Math.max(0, Math.min(sizes.length - 1, idx + direction));
  return sizes[nextIdx];
}

export function recommendSizeForUser(
  viewer: UserProfile,
  product: Product,
  friendClosetItems: EnrichedClosetItem[]
): SizeRecommendation {
  // Find best Body-Twin friend who owns this exact item (or same brand & category)
  let bestTwin: BodyTwinMatch | undefined;

  const exactOwners = friendClosetItems.filter(
    (ci) => ci.productId === product.id && ci.userId !== viewer.id
  );
  const brandCategoryOwners = friendClosetItems.filter(
    (ci) =>
      ci.product.brand.toLowerCase() === product.brand.toLowerCase() &&
      ci.product.category === product.category &&
      ci.userId !== viewer.id
  );

  const candidatePool = exactOwners.length > 0 ? exactOwners : brandCategoryOwners;
  for (const item of candidatePool) {
    const score = calculateBodyTwinSimilarity(viewer, item.owner);
    if (!bestTwin || score > bestTwin.similarityScore) {
      const fitLabel =
        item.fitRating === "runs_small"
          ? "says it runs snug"
          : item.fitRating === "runs_large"
          ? "says it runs roomy"
          : "says it's true to size";
      bestTwin = {
        friend: item.owner,
        similarityScore: score,
        closetItem: item,
        summary: `@${item.owner.username} (${score}% Body Twin) wears ${item.purchasedSize} & ${fitLabel}`,
      };
    }
  }

  // Footwear sizing
  if (product.category === "shoes") {
    const recShoe = product.availableSizes.includes(viewer.shoeSize)
      ? viewer.shoeSize
      : product.availableSizes[Math.floor(product.availableSizes.length / 2)] || "7.5";
    return {
      recommendedSize: recShoe,
      confidence: "high",
      chartNote: `Matched to your saved US ${viewer.shoeSize} shoe profile`,
      bodyTwin: bestTwin,
    };
  }

  // Apparel inch size-chart matching
  const chartEntries = Object.entries(product.sizeChartInches || {});
  let baseSize = "S";

  if (chartEntries.length > 0) {
    let lowestError = Number.POSITIVE_INFINITY;
    for (const [sizeLabel, spec] of chartEntries) {
      if (!product.availableSizes.includes(sizeLabel)) continue;
      let err = 0;

      if (
        (product.category === "top" ||
          product.category === "outerwear" ||
          product.category === "dress") &&
        spec.bustMin !== undefined &&
        spec.bustMax !== undefined
      ) {
        const mid = (spec.bustMin + spec.bustMax) / 2;
        err += Math.abs(viewer.bustInches - mid) * 1.4;
      }

      if (spec.waistMin !== undefined && spec.waistMax !== undefined) {
        const mid = (spec.waistMin + spec.waistMax) / 2;
        err += Math.abs(viewer.waistInches - mid) * 1.8;
      }

      if (
        (product.category === "bottom" || product.category === "dress") &&
        spec.hipsMin !== undefined &&
        spec.hipsMax !== undefined
      ) {
        const mid = (spec.hipsMin + spec.hipsMax) / 2;
        err += Math.abs(viewer.hipsInches - mid) * 1.6;
      }

      if (err < lowestError) {
        lowestError = err;
        baseSize = sizeLabel;
      }
    }
  }

  // If a very close Body-Twin (>85% match) owns this exact SKU and flagged runs_small / runs_large, refine!
  let finalSize = baseSize;
  let chartNote = `Fits ${viewer.waistInches}" waist / ${viewer.bustInches}" bust on ${product.brand}'s chart`;

  if (
    bestTwin &&
    bestTwin.similarityScore >= 85 &&
    bestTwin.closetItem?.productId === product.id
  ) {
    if (bestTwin.closetItem.fitRating === "runs_small") {
      finalSize = shiftSize(product.availableSizes, baseSize, 1);
      chartNote = `Sized up to ${finalSize} based on @${bestTwin.friend.username}'s real-life fit note`;
    } else if (bestTwin.closetItem.fitRating === "runs_large") {
      finalSize = shiftSize(product.availableSizes, baseSize, -1);
      chartNote = `Sized down to ${finalSize} based on @${bestTwin.friend.username}'s real-life fit note`;
    }
  }

  return {
    recommendedSize: finalSize,
    confidence: bestTwin && bestTwin.similarityScore >= 82 ? "high" : "medium",
    chartNote,
    bodyTwin: bestTwin,
  };
}

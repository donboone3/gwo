import { OutfitSuggestion, Product } from "../types";

export interface OutfitBuildQuery {
  occasion: string;
  maxBudget: number;
  maxDeliveryDays: number;
  storeFilter?: string; // "all" | "nike.com" | etc.
  vibe?: string;
  ownedProductIds?: string[];
  includeClosetPieces?: boolean;
}

function scoreProductForQuery(
  product: Product,
  query: OutfitBuildQuery,
  ownedSet: Set<string>
): number {
  let score = 10;
  if (
    query.occasion &&
    query.occasion !== "Any" &&
    product.occasions.some(
      (o) => o.toLowerCase() === query.occasion.toLowerCase()
    )
  ) {
    score += 25;
  }
  if (
    query.vibe &&
    product.vibes.some((v) => v.toLowerCase() === query.vibe?.toLowerCase())
  ) {
    score += 18;
  }
  if (query.includeClosetPieces && ownedSet.has(product.id)) {
    score += 15; // Favor remixing owned closet staples to stretch her budget!
  }
  if (product.brand.toLowerCase() === "nike") {
    score += 4;
  }
  return score;
}

export function buildCuratedOutfits(
  catalog: Product[],
  query: OutfitBuildQuery
): OutfitSuggestion[] {
  const ownedSet = new Set(query.ownedProductIds || []);

  const eligible = catalog.filter((p) => {
    if (!p.inStock) return false;
    const isOwned = query.includeClosetPieces && ownedSet.has(p.id);
    if (!isOwned && p.estDeliveryDays > query.maxDeliveryDays) return false;
    if (
      query.storeFilter &&
      query.storeFilter !== "all" &&
      !isOwned &&
      p.storeDomain.toLowerCase() !== query.storeFilter.toLowerCase()
    ) {
      return false;
    }
    return true;
  });

  const tops = eligible
    .filter((p) => p.category === "top")
    .sort((a, b) => scoreProductForQuery(b, query, ownedSet) - scoreProductForQuery(a, query, ownedSet));
  const bottoms = eligible
    .filter((p) => p.category === "bottom")
    .sort((a, b) => scoreProductForQuery(b, query, ownedSet) - scoreProductForQuery(a, query, ownedSet));
  const dresses = eligible
    .filter((p) => p.category === "dress")
    .sort((a, b) => scoreProductForQuery(b, query, ownedSet) - scoreProductForQuery(a, query, ownedSet));
  const outerwear = eligible
    .filter((p) => p.category === "outerwear")
    .sort((a, b) => scoreProductForQuery(b, query, ownedSet) - scoreProductForQuery(a, query, ownedSet));
  const shoes = eligible
    .filter((p) => p.category === "shoes")
    .sort((a, b) => scoreProductForQuery(b, query, ownedSet) - scoreProductForQuery(a, query, ownedSet));

  const results: OutfitSuggestion[] = [];
  const seenCombos = new Set<string>();

  const calcMetrics = (items: Product[]) => {
    const ownedItemIds = items
      .filter((i) => query.includeClosetPieces && ownedSet.has(i.id))
      .map((i) => i.id);
    const netCostToBuy = items
      .filter((i) => !ownedItemIds.includes(i.id))
      .reduce((sum, i) => sum + i.price, 0);
    const totalValue = items.reduce((sum, i) => sum + i.price, 0);
    const maxDeliveryDays = items
      .filter((i) => !ownedItemIds.includes(i.id))
      .reduce((max, i) => Math.max(max, i.estDeliveryDays), 0);
    return { ownedItemIds, netCostToBuy, totalValue, maxDeliveryDays };
  };

  // Candidate Separates Combinations (Top + Bottom + Shoes + optional Layer)
  for (const top of tops.slice(0, 4)) {
    for (const bottom of bottoms.slice(0, 4)) {
      for (const shoe of shoes.slice(0, 3)) {
        const baseItems = [top, bottom, shoe];
        let metrics = calcMetrics(baseItems);

        // Try adding a cozy Nike fleece/jacket layer if budget allows!
        let finalItems = baseItems;
        if (outerwear.length > 0) {
          const layer = outerwear[0];
          const withLayer = [layer, ...baseItems];
          const layerMetrics = calcMetrics(withLayer);
          if (
            layerMetrics.netCostToBuy <= query.maxBudget &&
            (query.occasion === "Coffee Run" ||
              query.occasion === "Campus / Class" ||
              query.occasion === "Gym / Pilates" ||
              query.occasion === "Weekend Trip")
          ) {
            finalItems = withLayer;
            metrics = layerMetrics;
          }
        }

        if (metrics.netCostToBuy <= query.maxBudget) {
          const sig = finalItems.map((i) => i.id).sort().join("|");
          if (!seenCombos.has(sig)) {
            seenCombos.add(sig);
            const brands = [...new Set(finalItems.map((i) => i.brand))].join(" × ");
            const ownedNote =
              metrics.ownedItemIds.length > 0
                ? `Re-wears ${metrics.ownedItemIds.length} piece(s) from Your Closet to keep spend at $${metrics.netCostToBuy}.`
                : `Complete ${brands} head-to-toe look arriving within ${metrics.maxDeliveryDays || 2} days.`;

            results.push({
              id: `fit-${results.length + 1}`,
              title: `${brands} ${query.occasion === "Any" ? "Capsule" : query.occasion} Edit`,
              occasion: query.occasion,
              vibe: query.vibe || "Clean Girl Athleisure",
              items: finalItems,
              ...metrics,
              stylistRationale: `Balances ${top.colorName} & ${bottom.colorName} proportions with ${shoe.title}. ${ownedNote}`,
            });
          }
        }
      }
    }
  }

  // Candidate Dress + Shoe Combinations
  for (const dress of dresses.slice(0, 3)) {
    for (const shoe of shoes.slice(0, 3)) {
      const items = [dress, shoe];
      const metrics = calcMetrics(items);
      if (metrics.netCostToBuy <= query.maxBudget) {
        const sig = items.map((i) => i.id).sort().join("|");
        if (!seenCombos.has(sig)) {
          seenCombos.add(sig);
          const brands = [...new Set(items.map((i) => i.brand))].join(" × ");
          results.push({
            id: `fit-dress-${results.length + 1}`,
            title: `${brands} Effortless One-Piece Look`,
            occasion: query.occasion,
            vibe: query.vibe || "Model Off-Duty",
            items,
            ...metrics,
            stylistRationale: `Pairs ${dress.title} (${dress.colorName}) with ${shoe.title} under your $${query.maxBudget} budget.`,
          });
        }
      }
    }
  }

  return results
    .sort((a, b) => {
      // Prioritize occasion match + multi-piece completeness
      const occScoreA = a.items.filter((i) =>
        i.occasions.includes(query.occasion)
      ).length;
      const occScoreB = b.items.filter((i) =>
        i.occasions.includes(query.occasion)
      ).length;
      if (occScoreB !== occScoreA) return occScoreB - occScoreA;
      return b.items.length - a.items.length;
    })
    .slice(0, 6);
}

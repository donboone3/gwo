import React from "react";
import { Metadata } from "next";
import { buildTopLineAliExpressDropshipCatalog } from "@/lib/dropship/aliexpress-dropship";
import { MotionSitesProductShowroom } from "@/components/product/MotionSitesProductShowroom";

export function generateStaticParams(): Array<{ id: string }> {
  return buildTopLineAliExpressDropshipCatalog(2.85).map((p) => ({
    id: p.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const catalog = buildTopLineAliExpressDropshipCatalog(2.85);
  const found = catalog.find((p) => p.id === id);
  if (!found) {
    return {
      title: "360° 3D Product Showroom | GoodWithOnline",
    };
  }
  return {
    title: `${found.title} — 360° 3D Fit & Measurements | ${found.brand}`,
    description: `${found.fitMetadata?.descriptionSummary || found.title} — Interactive 360° 3D body-scan fit prediction & exact garment measurements.`,
  };
}

export default async function DedicatedProductShowroomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MotionSitesProductShowroom productId={id} />;
}

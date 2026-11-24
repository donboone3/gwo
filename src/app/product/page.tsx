import React, { Suspense } from "react";
import { GwoSpinProduct } from "@/components/product/GwoSpinProduct";

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#e2e4e8" }} />}>
      <GwoSpinProduct />
    </Suspense>
  );
}

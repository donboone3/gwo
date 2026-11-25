"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  Check,
  ExternalLink,
  ImagePlus,
  Link2,
  Loader2,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { GwoLogo } from "../brand/GwoLogo";
import { CustomerAvatarModal } from "../avatar/CustomerAvatarModal";
import { GarmentArtwork } from "../studio/GarmentArtwork";
import { SIGNATURE_BADGE_URL } from "../vell/vell-data";
import { useGwo } from "@/context/GwoAppContext";
import { analyzeExactAvatarFit } from "@/lib/catalog/fit-intelligence";
import {
  DEFAULT_AVATAR_MEASUREMENTS,
} from "@/lib/catalog/sizing";
import { Product } from "@/lib/types";

const STEPS = [
  { href: "/", match: ["/", "/closet"], label: "Closet & Try-On" },
  { href: "/shop", match: ["/shop", "/recommended"], label: "For You Runway" },
  { href: "/product", match: ["/product"], label: "360° Fit View" },
];

const QUICK_SAMPLE_LINKS = [
  {
    label: "Babyboo Cornelia Red",
    url: "https://babyboofashion-com-au.myshopify.com/products/cornelia-mini-dress-red",
  },
  {
    label: "SKIMS Cotton Tee",
    url: "https://skims.com/products/cotton-jersey-t-shirt-soot",
  },
  {
    label: "Vuori Halo Hoodie",
    url: "https://www.vuoriclothing.com/products/womens-halo-performance-hoodie-pale-grey-heather",
  },
];

export function UnifiedGwoNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const cleanPath = pathname.replace(/\/+$/, "") || "/";

  const {
    user,
    bagItems,
    bagOpen,
    setBagOpen,
    bagBump,
    removeFromBag,
    addUrlModalOpen,
    setAddUrlModalOpen,
    setActiveImportedProduct,
    updateImportedProductImage,
    customAvatar,
    setAvatarModalOpen,
    ingestUrlToSharedCatalog,
    shareMyClosetAndClaimBonus,
    toastMessage,
  } = useGwo();

  const photoFileRef = useRef<HTMLInputElement | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewAngleIdx, setPreviewAngleIdx] = useState(0);
  const [manualImgUrl, setManualImgUrl] = useState("");

  const bagTotal = bagItems.reduce((sum, item) => sum + item.price, 0);

  const activeAvatarStats = {
    bustInches: user?.bustInches ?? DEFAULT_AVATAR_MEASUREMENTS.bustInches,
    waistInches: user?.waistInches ?? DEFAULT_AVATAR_MEASUREMENTS.waistInches,
    hipsInches: user?.hipsInches ?? DEFAULT_AVATAR_MEASUREMENTS.hipsInches,
    heightInches: user?.heightInches ?? DEFAULT_AVATAR_MEASUREMENTS.heightInches,
    shoeSize: user?.shoeSize || "7.5",
  };

  const previewFitReport = previewProduct
    ? analyzeExactAvatarFit(activeAvatarStats, previewProduct)
    : null;

  const handleImportSubmit = async (sample?: string) => {
    const target = (sample ?? urlInput).trim();
    if (!target) return;
    setImporting(true);
    setPreviewProduct(null);
    setPreviewAngleIdx(0);
    try {
      const res = await ingestUrlToSharedCatalog(target);
      if (res?.product) {
        setPreviewProduct(res.product);
        setUrlInput("");
      }
    } finally {
      setImporting(false);
    }
  };

  const handleManualPhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !previewProduct) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl) {
        updateImportedProductImage(previewProduct.id, dataUrl);
        setPreviewProduct((prev) =>
          prev ? { ...prev, imageUrl: dataUrl } : null
        );
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handlePasteClipboardImage = (e: React.ClipboardEvent) => {
    if (!previewProduct) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const blob = items[i].getAsFile();
        if (!blob) continue;
        e.preventDefault();
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || "");
          if (dataUrl) {
            updateImportedProductImage(previewProduct.id, dataUrl);
            setPreviewProduct((prev) =>
              prev ? { ...prev, imageUrl: dataUrl } : null
            );
          }
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  return (
    <>
      {/* ==================== UNIFIED PERSISTENT GWO HEADER ==================== */}
      <header className="fixed top-0 inset-x-0 z-50 h-16 px-4 sm:px-7 bg-white/92 backdrop-blur-md border-b border-black/[0.07] flex items-center justify-between gap-3">
        {/* Left: Pure 4-Stroke Cursive GWO Brand Mark */}
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="inline-flex items-center">
            <GwoLogo height={38} replayOnClick={false} className="text-[#141518]" />
          </Link>
        </div>

        {/* Center: Clean 3-Step Customer Flow */}
        <nav
          aria-label="GWO Steps"
          className="flex items-center p-1 rounded-full bg-[#F1F2F5] border border-black/[0.05]"
        >
          {STEPS.map((step) => {
            const active =
              step.href === "/"
                ? cleanPath === "/" || cleanPath === "/closet"
                : step.match.some((m) => cleanPath.startsWith(m));
            return (
              <Link
                key={step.href}
                href={step.href}
                className={`px-3 sm:px-5 py-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition-all whitespace-nowrap ${
                  active
                    ? "bg-white text-[#141518] shadow-[0_2px_8px_rgba(20,21,24,0.08)]"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                {step.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: My Photo Avatar, + Add Store Link, Share Closet, Unified Bag */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="gwo-my-avatar-btn"
            onClick={() => setAvatarModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer border bg-[#EBF3EE] border-[#C5DFD0] text-[#1D4232]"
          >
            <img
              src={customAvatar ? customAvatar.badgeDataUrl : SIGNATURE_BADGE_URL}
              alt="My Avatar"
              className="w-5 h-5 rounded-full object-cover border border-[#244B3B]/30"
            />
            <span className="hidden md:inline">My Avatar ✓</span>
          </button>

          <button
            type="button"
            id="gwo-add-url-btn"
            onClick={() => {
              setPreviewProduct(null);
              setAddUrlModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-full text-xs font-semibold bg-[#F1F2F5] hover:bg-[#E6E8ED] text-[#141518] transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Store Link</span>
            <span className="sm:hidden">URL</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              await shareMyClosetAndClaimBonus();
              setCopiedLink(true);
              setTimeout(() => setCopiedLink(false), 2200);
            }}
            title="Share your closet link with friends"
            className="hidden xl:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold border border-black/[0.1] bg-white hover:bg-[#F7F8FA] text-[#141518] transition cursor-pointer"
          >
            {copiedLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#244B3B]" /> Copied!
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" /> Share Closet
              </>
            )}
          </button>

          <button
            type="button"
            id="gwo-unified-bag-btn"
            onClick={() => setBagOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] transition cursor-pointer ${
              bagBump ? "scale-110" : "scale-100"
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bag ({bagItems.length})</span>
          </button>
        </div>
      </header>

      {/* ==================== UNIFIED SLIDE-OVER BAG DRAWER (WITH GARMENT THUMBNAILS) ==================== */}
      {bagOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/30 backdrop-blur-xs flex justify-end"
          onClick={() => setBagOpen(false)}
        >
          <div
            className="w-full max-w-md h-full bg-white shadow-2xl border-l border-black/[0.08] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-black/[0.08] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#141518]">
                  Your Outfit Bag ({bagItems.length})
                </h2>
                <p className="text-xs text-[#686D76] mt-0.5">
                  One unified bag across your Closet, Runway &amp; 360° View
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBagOpen(false)}
                className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {bagItems.length === 0 ? (
                <div className="text-center py-14 space-y-2">
                  <ShoppingBag className="w-7 h-7 mx-auto text-[#A0A5AE]" />
                  <p className="text-sm font-semibold text-[#141518]">
                    Your bag is empty
                  </p>
                  <p className="text-xs text-[#686D76]">
                    Tap + Bag on any outfit piece or paste a store URL.
                  </p>
                </div>
              ) : (
                bagItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-14 h-16 rounded-xl object-cover bg-white border border-black/[0.06] shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-16 rounded-xl bg-[#EAECEF] flex items-center justify-center text-[10px] font-bold text-[#686D76] shrink-0">
                          {item.brand.slice(0, 4).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#686D76]">
                          {item.brand} • Size {item.size}
                        </p>
                        <p className="text-sm font-semibold text-[#141518] truncate mt-0.5">
                          {item.title}
                        </p>
                        {item.friendRef && (
                          <p className="text-[11px] text-[#244B3B] font-medium mt-0.5">
                            Friend Closet Credit: {item.friendRef}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-sm font-bold text-[#141518]">
                        ${item.price}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFromBag(item.id)}
                        className="p-1.5 rounded-full hover:bg-black/[0.06] text-[#686D76] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {bagItems.length > 0 && (
              <div className="p-6 border-t border-black/[0.08] bg-[#FAFBFD] space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#686D76] font-medium">
                    Outfit Total ({bagItems.length} items)
                  </span>
                  <span className="text-lg font-bold text-[#141518]">
                    ${bagTotal.toLocaleString()}
                  </span>
                </div>
                <a
                  href={bagItems[bagItems.length - 1]?.storeUrl || "https://skims.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  Continue to Store Checkout <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== "ADD STORE LINK" MODAL WITH LIVE CLOTHING IMAGE PREVIEW ==================== */}
      {addUrlModalOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setAddUrlModalOpen(false)}
          onPaste={handlePasteClipboardImage}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white p-6 sm:p-7 shadow-2xl border border-black/[0.08] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#141518]">
                  Add Any Store Piece to GWO
                </h3>
                <p className="text-xs text-[#686D76] mt-1">
                  Paste a product link (or direct clothing image link) from SKIMS, Reformation, Princess Polly, Nike, or any store to pull its photo into your Closet &amp; Avatar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddUrlModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 text-[#8A9099] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="gwo-url-input"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && urlInput.trim() && !importing) {
                      void handleImportSubmit();
                    }
                  }}
                  placeholder="Paste product URL or image URL..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-full text-xs sm:text-sm bg-[#F4F5F7] border border-black/[0.08] focus:outline-none focus:border-[#141518]"
                />
              </div>
              <button
                type="button"
                id="gwo-url-submit-btn"
                disabled={importing || !urlInput.trim()}
                onClick={() => void handleImportSubmit()}
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#141518] text-white hover:bg-[#27292E] disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching Photo...
                  </>
                ) : (
                  "Import Piece"
                )}
              </button>
            </div>

            {/* Quick Verified Sample Store Links */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#686D76]">
              <span>Try a live store link:</span>
              {QUICK_SAMPLE_LINKS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={importing}
                  onClick={() => void handleImportSubmit(s.url)}
                  className="px-2.5 py-1 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] font-semibold cursor-pointer"
                >
                  + {s.label}
                </button>
              ))}
            </div>

            {/* ==================== IMPORTED CLOTHING PHOTO + EXACT FIT PREVIEW CARD ==================== */}
            {previewProduct && previewFitReport && (
              <div
                id="gwo-imported-preview-card"
                className="rounded-2xl bg-[#F6F7F9] border border-black/[0.08] p-4 space-y-3.5 max-h-[62vh] overflow-y-auto"
              >
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* Left: Hero + Multi-Angle Thumbnail Strip */}
                  <div className="w-full sm:w-36 shrink-0 space-y-2">
                    <div className="w-full h-44 rounded-2xl overflow-hidden bg-white border border-black/[0.07] shadow-xs">
                      <GarmentArtwork
                        product={{
                          ...previewProduct,
                          imageUrl:
                            previewProduct.fitMetadata?.galleryImages?.[
                              previewAngleIdx
                            ]?.url || previewProduct.imageUrl,
                        }}
                        className="w-full h-full"
                      />
                    </div>

                    {(previewProduct.fitMetadata?.galleryImages?.length || 0) > 1 && (
                      <div className="grid grid-cols-4 gap-1">
                        {previewProduct.fitMetadata!.galleryImages!
                          .slice(0, 4)
                          .map((ang, idx) => (
                            <button
                              key={ang.url}
                              type="button"
                              onClick={() => setPreviewAngleIdx(idx)}
                              title={ang.label}
                              className={`h-11 rounded-lg overflow-hidden border bg-white cursor-pointer ${
                                previewAngleIdx === idx
                                  ? "border-[#141518] ring-1 ring-[#141518]"
                                  : "border-black/10 opacity-75 hover:opacity-100"
                              }`}
                            >
                              <img
                                src={ang.url}
                                alt={ang.label}
                                className="w-full h-full object-cover object-top"
                              />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Extracted Fit, Model Sizing & Avatar Match */}
                  <div className="flex-1 min-w-0 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#E7F3EE] text-[#244B3B]">
                        {previewProduct.brand} • {previewFitReport.confidencePct}% Fit Match
                      </span>
                      <span className="text-sm font-bold text-[#141518]">
                        ${previewProduct.price}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#141518] leading-snug">
                      {previewProduct.title}
                    </h4>

                    {/* Exact Avatar Size Verdict Banner */}
                    <div className="p-2.5 rounded-xl bg-white border border-[#CBE2D4] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-[#1D4232]">
                          Recommended for Your Avatar: Size{" "}
                          {previewFitReport.recommendedSize}
                        </span>
                        <span className="text-[10px] font-semibold text-[#686D76]">
                          {activeAvatarStats.bustInches}&quot; •{" "}
                          {activeAvatarStats.waistInches}&quot; •{" "}
                          {activeAvatarStats.hipsInches}&quot;
                        </span>
                      </div>
                      <p className="text-[11px] text-[#4E5A54] leading-snug">
                        {previewFitReport.headlineVerdict}
                      </p>
                      {previewFitReport.zones.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {previewFitReport.zones.map((z) => (
                            <span
                              key={z.zone}
                              className="px-2 py-0.5 rounded-md bg-[#F4F8F5] text-[10px] font-semibold text-[#141518] border border-black/[0.05]"
                            >
                              {z.zone}: {z.feelLabel}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Extracted Store Model + Fabric Proof */}
                    <div className="text-[11px] text-[#5C6068] space-y-1">
                      <p>
                        <strong className="text-[#141518]">
                          {previewFitReport.lengthComparison.modelSummary}
                        </strong>{" "}
                        — {previewFitReport.lengthComparison.proportionNote}
                      </p>
                      <p>
                        <strong className="text-[#141518]">Fabric &amp; Cut:</strong>{" "}
                        {previewFitReport.fabricSummary}
                      </p>
                    </div>

                    {/* Optional 1-Click Photo Override if a bot-protected site hid its og:image */}
                    {!previewProduct.imageUrl && (
                      <div className="p-2.5 rounded-xl bg-white border border-black/[0.08] space-y-2">
                        <p className="text-[11px] text-[#5C5550] leading-snug">
                          <strong>{previewProduct.brand}</strong> blocked auto-photo scraping—paste{" "}
                          <kbd className="px-1 py-0.5 rounded bg-[#F1F2F5] text-[10px]">Ctrl+V</kbd>{" "}
                          a screenshot, upload a photo, or paste the image address:
                        </p>
                        <div className="flex items-center gap-1.5">
                          <input
                            ref={photoFileRef}
                            type="file"
                            accept="image/*"
                            onChange={handleManualPhotoFile}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => photoFileRef.current?.click()}
                            className="px-2.5 py-1.5 rounded-lg bg-[#141518] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <ImagePlus className="w-3 h-3" /> Upload Photo
                          </button>
                          <input
                            type="url"
                            value={manualImgUrl}
                            onChange={(e) => setManualImgUrl(e.target.value)}
                            placeholder="Or paste image address..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#F4F5F7] border border-black/10 text-[11px]"
                          />
                          {manualImgUrl.trim() && (
                            <button
                              type="button"
                              onClick={() => {
                                updateImportedProductImage(
                                  previewProduct.id,
                                  manualImgUrl.trim()
                                );
                                setPreviewProduct((prev) =>
                                  prev
                                    ? { ...prev, imageUrl: manualImgUrl.trim() }
                                    : null
                                );
                                setManualImgUrl("");
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#244B3B] text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        id="gwo-open-fit-inspector-btn"
                        onClick={() => {
                          setActiveImportedProduct(previewProduct);
                          setAddUrlModalOpen(false);
                          router.push(
                            `/product?id=${encodeURIComponent(previewProduct.id)}`
                          );
                        }}
                        className="px-4 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
                        Inspect Exact Fit &amp; Angles{" "}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        id="gwo-try-imported-on-avatar-btn"
                        onClick={() => {
                          setActiveImportedProduct(previewProduct);
                          setAddUrlModalOpen(false);
                          if (cleanPath !== "/" && cleanPath !== "/closet") {
                            router.push("/");
                          }
                        }}
                        className="px-3.5 py-2 rounded-full bg-white hover:bg-[#ECEEF2] border border-black/10 text-xs font-semibold text-[#141518] cursor-pointer"
                      >
                        Pin in Closet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CustomerAvatarModal />

      {/* ==================== UNIFIED SUBTLE TOAST ==================== */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-full bg-[#141518] text-white text-xs font-medium shadow-xl flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-3.5 h-3.5 text-[#A7D7C5]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}

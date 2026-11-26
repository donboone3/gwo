"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ImagePlus,
  Instagram,
  Link2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import {
  ARCHETYPE_META,
  buildSocialStyleDNA,
  extractPaletteFromSocialPhotos,
  fetchPublicSocialAestheticClient,
  SAMPLE_SOCIAL_PERSONAS,
} from "@/lib/social/social-style-dna";
import { SocialStyleArchetype } from "@/lib/types";

export function SocialStyleDnaModal() {
  const { socialDna, updateSocialDna, socialModalOpen, setSocialModalOpen } =
    useGwo();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [igHandle, setIgHandle] = useState(
    socialDna.instagramHandle || "@mila.nyc"
  );
  const [ttHandle, setTtHandle] = useState(
    socialDna.tiktokHandle || "@mila.fits"
  );
  const [pinBoard, setPinBoard] = useState(
    socialDna.pinterestBoard || "SoHo Siren & Capsule Layering"
  );
  const [bioKeywords, setBioKeywords] = useState(
    "#datenight #corset #offduty #tailored"
  );
  const [glamSlider, setGlamSlider] = useState<number>(socialDna.glamSlider);
  const [edgeSlider, setEdgeSlider] = useState<number>(socialDna.edgeSlider);
  const [paletteHex, setPaletteHex] = useState<string[]>(
    socialDna.extractedPaletteHex
  );
  const [thumbs, setThumbs] = useState<string[]>(
    socialDna.uploadedGridThumbs || []
  );
  const [photoSignals, setPhotoSignals] = useState<
    | {
        avgBrightness: number;
        warmRatio: number;
        vividRatio: number;
      }
    | undefined
  >(undefined);
  const [extractingPhotos, setExtractingPhotos] = useState(false);
  const [socialUrlInput, setSocialUrlInput] = useState("");
  const [pullingSocialUrl, setPullingSocialUrl] = useState(false);
  const [socialUrlStatus, setSocialUrlStatus] = useState<string | null>(null);

  const previewDna = useMemo(
    () =>
      buildSocialStyleDNA({
        instagramHandle: igHandle,
        tiktokHandle: ttHandle,
        pinterestBoard: pinBoard,
        bioOrCaptionText: bioKeywords,
        glamSlider,
        edgeSlider,
        extractedPaletteHex: paletteHex,
        uploadedGridThumbs: thumbs,
        likedProductIds: socialDna.likedProductIds,
        likedOutfitIds: socialDna.likedOutfitIds,
        photoSignals,
      }),
    [
      bioKeywords,
      edgeSlider,
      glamSlider,
      igHandle,
      paletteHex,
      photoSignals,
      pinBoard,
      socialDna.likedOutfitIds,
      socialDna.likedProductIds,
      thumbs,
      ttHandle,
    ]
  );

  if (!socialModalOpen) return null;

  const handleUploadIgGrid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4);
    if (files.length === 0) return;
    setExtractingPhotos(true);
    try {
      const readUrls = await Promise.all(
        files.map(
          (f) =>
            new Promise<string>((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(String(r.result || ""));
              r.onerror = () => resolve("");
              r.readAsDataURL(f);
            })
        )
      );
      const valid = readUrls.filter(Boolean);
      if (valid.length > 0) {
        setThumbs(valid);
        const extracted = await extractPaletteFromSocialPhotos(valid);
        setPaletteHex(extracted.swatchesHex);
        setPhotoSignals({
          avgBrightness: extracted.avgBrightness,
          warmRatio: extracted.warmRatio,
          vividRatio: extracted.vividRatio,
        });
      }
    } finally {
      setExtractingPhotos(false);
      e.target.value = "";
    }
  };

  const applySamplePersona = (
    persona: (typeof SAMPLE_SOCIAL_PERSONAS)[number]
  ) => {
    setIgHandle(persona.instagramHandle);
    setTtHandle(persona.tiktokHandle || "");
    setPinBoard(persona.pinterestBoard || "");
    setBioKeywords(persona.bioCaptionSample);
    setGlamSlider(persona.glamSlider);
    setEdgeSlider(persona.edgeSlider);
    setPaletteHex(persona.palette);
    setSocialUrlStatus(null);
  };

  const handleFetchSocialUrl = async () => {
    if (!socialUrlInput.trim()) return;
    setPullingSocialUrl(true);
    setSocialUrlStatus(null);
    try {
      const res = await fetchPublicSocialAestheticClient(socialUrlInput.trim());
      if (res.platform === "instagram") setIgHandle(res.handle);
      if (res.platform === "tiktok") setTtHandle(res.handle);
      if (res.platform === "pinterest") {
        setPinBoard(res.boardTitle || socialUrlInput.trim());
      }
      setBioKeywords(res.extractedKeywords);
      setGlamSlider(res.suggestedGlam);
      setEdgeSlider(res.suggestedEdge);
      setPaletteHex(res.suggestedPalette);
      setSocialUrlStatus(
        res.liveIndexed
          ? `Pulled live public aesthetic from ${res.handle} (${res.platform})!`
          : `Calibrated ${res.handle} (${res.platform}) aesthetic signals!`
      );
      setSocialUrlInput("");
    } finally {
      setPullingSocialUrl(false);
    }
  };

  return (
    <div
      id="gwo-social-dna-modal"
      className="fixed inset-0 z-[135] bg-black/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={() => setSocialModalOpen(false)}
    >
      <div
        className="w-full max-w-3xl max-h-[92svh] rounded-3xl bg-white shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 py-4 border-b border-black/[0.07] flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDEEF4] text-[#9D174D] text-[10.5px] font-bold">
              <Instagram className="w-3 h-3" /> Social Style DNA Collaborator
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#141518] mt-1">
              Collaborate with Your Instagram, TikTok &amp; Pinterest Aesthetic
            </h3>
            <p className="text-xs text-[#686D76] mt-0.5">
              Connect handles, drop IG grid screenshots for instant color-palette vision analysis, and calibrate your endless AI lookbook.
            </p>
          </div>
          <button
            type="button"
            id="gwo-social-dna-close"
            onClick={() => setSocialModalOpen(false)}
            aria-label="Close Social Style Collaborator"
            className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Live Public Social Profile / Moodboard URL Collaborator */}
          <div className="p-3 rounded-2xl bg-[#FAF6F8] border border-[#F2D5E3] space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#9D174D]">
              Paste Public Instagram, TikTok or Pinterest Board URL
            </span>
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Link2 className="w-3.5 h-3.5 text-[#9D174D] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="gwo-social-live-url-input"
                  type="url"
                  value={socialUrlInput}
                  onChange={(e) => setSocialUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      socialUrlInput.trim() &&
                      !pullingSocialUrl
                    ) {
                      e.preventDefault();
                      void handleFetchSocialUrl();
                    }
                  }}
                  placeholder="https://www.instagram.com/haileybieber or pinterest.com/chloe/old-money..."
                  className="w-full pl-8 pr-3 py-2 rounded-full bg-white border border-black/10 text-xs text-[#141518]"
                />
              </div>
              <button
                type="button"
                id="gwo-social-pull-url-btn"
                disabled={pullingSocialUrl || !socialUrlInput.trim()}
                onClick={() => void handleFetchSocialUrl()}
                className="px-4 py-2 rounded-full bg-[#9D174D] hover:bg-[#831843] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {pullingSocialUrl ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...
                  </>
                ) : (
                  "Pull Aesthetic"
                )}
              </button>
            </div>
            {socialUrlStatus && (
              <p className="text-[11px] font-semibold text-[#1D4232]">
                ✓ {socialUrlStatus}
              </p>
            )}
          </div>

          {/* 1-Tap Sample Social Personas */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
              Quick-Try Creator Personas (or enter your own below)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_SOCIAL_PERSONAS.map((p) => {
                const active =
                  igHandle.toLowerCase() === p.instagramHandle.toLowerCase();
                return (
                  <button
                    key={p.instagramHandle}
                    type="button"
                    id={`gwo-persona-${p.instagramHandle.replace(/[^a-z0-9]/gi, "")}`}
                    onClick={() => applySamplePersona(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                      active
                        ? "bg-[#141518] text-white border-[#141518]"
                        : "bg-[#F4F5F7] hover:bg-[#EAECEF] text-[#141518] border-black/[0.06]"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Social Handles + IG Grid Photo Vision Extractor */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="text-[11px] font-bold text-[#141518]">
                  Instagram @Handle
                  <input
                    id="gwo-ig-handle-input"
                    type="text"
                    value={igHandle}
                    onChange={(e) => setIgHandle(e.target.value)}
                    placeholder="@yourhandle"
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                  />
                </label>
                <label className="text-[11px] font-bold text-[#141518]">
                  TikTok @Handle
                  <input
                    id="gwo-tt-handle-input"
                    type="text"
                    value={ttHandle}
                    onChange={(e) => setTtHandle(e.target.value)}
                    placeholder="@yourtiktok"
                    className="mt-1 w-full px-3 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                  />
                </label>
              </div>

              <label className="block text-[11px] font-bold text-[#141518]">
                Pinterest Moodboard / Saved Vibe
                <input
                  type="text"
                  value={pinBoard}
                  onChange={(e) => setPinBoard(e.target.value)}
                  placeholder="e.g. Old Money Tailored, Date Night Siren..."
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                />
              </label>

              <label className="block text-[11px] font-bold text-[#141518]">
                Recent IG Captions / Aesthetic Tags
                <input
                  id="gwo-social-tags-input"
                  type="text"
                  value={bioKeywords}
                  onChange={(e) => setBioKeywords(e.target.value)}
                  placeholder="#oldmoney #sirenglam #pilates #streetwear"
                  className="mt-1 w-full px-3 py-2 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-medium text-[#141518]"
                />
              </label>

              {/* Upload IG Grid Screenshots for Client-Side Vision Palette Extraction */}
              <div className="p-3 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#9D174D]" /> IG Grid Color Vision
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadIgGrid}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={extractingPhotos}
                    className="px-2.5 py-1.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <ImagePlus className="w-3 h-3" />
                    {extractingPhotos ? "Scanning..." : "Upload IG Grid"}
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#686D76]">
                    Extracted Feed Palette:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {paletteHex.map((hex, i) => (
                      <span
                        key={`${hex}-${i}`}
                        title={hex}
                        style={{ backgroundColor: hex }}
                        className="w-5 h-5 rounded-full border border-black/15 shadow-xs"
                      />
                    ))}
                  </div>
                </div>

                {thumbs.length > 0 && (
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    {thumbs.map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt={`IG Post ${idx + 1}`}
                        className="w-full h-14 rounded-lg object-cover border border-black/10"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Sliders + Live 6-Archetype DNA Readout */}
            <div className="p-4 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] flex flex-col justify-between gap-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#141518]">
                    <span>Daylight Casual ↔ Night-Out Glam</span>
                    <span className="text-[#244B3B]">{glamSlider}% Glam</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={glamSlider}
                    onChange={(e) => setGlamSlider(Number(e.target.value))}
                    className="w-full accent-[#141518] cursor-pointer"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#141518]">
                    <span>Soft Romantic ↔ Sculpted Siren Edge</span>
                    <span className="text-[#244B3B]">{edgeSlider}% Edge</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={edgeSlider}
                    onChange={(e) => setEdgeSlider(Number(e.target.value))}
                    className="w-full accent-[#141518] cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                    Live Computed Social Style DNA
                  </span>
                  {(Object.keys(ARCHETYPE_META) as SocialStyleArchetype[]).map(
                    (arch) => {
                      const pct = previewDna.archetypeScores[arch];
                      const isPrimary = previewDna.primaryArchetype === arch;
                      return (
                        <div key={arch} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span
                              className={
                                isPrimary
                                  ? "font-bold text-[#141518]"
                                  : "font-medium text-[#5C6068]"
                              }
                            >
                              {ARCHETYPE_META[arch].label}
                              {isPrimary ? " ★" : ""}
                            </span>
                            <span className="font-bold text-[#141518]">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-black/[0.08] overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full transition-all ${
                                isPrimary ? "bg-[#244B3B]" : "bg-[#141518]/65"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white border border-[#CBE2D4] text-[11px] text-[#1D4232] font-medium leading-snug">
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#244B3B]" />
                {previewDna.styleSummary}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 py-3.5 border-t border-black/[0.07] bg-[#F9FAFB] flex items-center justify-between gap-3">
          <span className="text-xs text-[#686D76]">
            Curates full AliExpress outfits directly on your Runway
          </span>
          <button
            type="button"
            id="gwo-apply-social-dna-btn"
            onClick={() => {
              updateSocialDna(previewDna);
              setSocialModalOpen(false);
            }}
            className="px-5 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
          >
            <Check className="w-3.5 h-3.5 text-[#A7D7C5]" /> Sync Links &amp; Update My Runway
          </button>
        </div>
      </div>
    </div>
  );
}

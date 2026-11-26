"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Instagram, Loader2, Share2, X } from "lucide-react";
import {
  buildIgStoryCardSpec,
  renderIgStoryLookbookPngDataUrl,
} from "@/lib/social/ig-story-card";
import { EndlessAiOutfit, SocialStyleDNA } from "@/lib/types";

interface IgStoryLookbookModalProps {
  outfit: EndlessAiOutfit | null;
  socialDna: SocialStyleDNA;
  avatarHeightDisplay: string;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export function IgStoryLookbookModal({
  outfit,
  socialDna,
  avatarHeightDisplay,
  onClose,
  onToast,
}: IgStoryLookbookModalProps) {
  const [pngDataUrl, setPngDataUrl] = useState<string>("");
  const [rendering, setRendering] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);

  const spec = useMemo(
    () =>
      outfit
        ? buildIgStoryCardSpec(outfit, socialDna, avatarHeightDisplay)
        : null,
    [avatarHeightDisplay, outfit, socialDna]
  );

  useEffect(() => {
    if (!spec) {
      setPngDataUrl("");
      return;
    }
    let cancelled = false;
    setRendering(true);
    renderIgStoryLookbookPngDataUrl(spec)
      .then((url) => {
        if (!cancelled) setPngDataUrl(url);
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spec]);

  if (!outfit || !spec) return null;

  const handleDownloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `gwo-ig-story-look-${outfit.sequenceNumber}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    onToast("Downloaded 1080×1920 Instagram Story Lookbook PNG!");
  };

  const handleNativeShare = async () => {
    if (pngDataUrl && typeof navigator !== "undefined" && navigator.share) {
      try {
        const blob = await (await fetch(pngDataUrl)).blob();
        const file = new File(
          [blob],
          `gwo-story-look-${outfit.sequenceNumber}.png`,
          { type: "image/png" }
        );
        await navigator.share({
          title: outfit.title,
          text: spec.shareCaption,
          files: [file],
        });
        onToast("Shared Story Lookbook card to your socials!");
        return;
      } catch {
        // Fall back to download + clipboard copy
      }
    }
    handleDownloadPng();
  };

  const handleCopyCaption = async () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(spec.shareCaption).catch(() => undefined);
    }
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
    onToast("Copied Instagram / TikTok outfit caption & size tags!");
  };

  return (
    <div
      id="gwo-ig-story-modal"
      className="fixed inset-0 z-[145] bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92svh] rounded-3xl bg-white shadow-2xl border border-black/[0.08] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 py-4 border-b border-black/[0.07] flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FDEEF4] text-[#9D174D] text-[10.5px] font-bold">
              <Instagram className="w-3.5 h-3.5" /> 1080×1920 IG / TikTok Story Collaborator
            </div>
            <h3 className="text-base sm:text-lg font-bold text-[#141518] mt-1">
              Share Look &amp; Poll Your Followers to Define Your Vibe
            </h3>
          </div>
          <button
            type="button"
            id="gwo-ig-story-close"
            onClick={onClose}
            aria-label="Close IG Story Modal"
            className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-5 items-start">
          {/* Left: Live Rendered 9:16 Story PNG Preview */}
          <div className="mx-auto w-[220px] sm:w-[240px] aspect-[9/16] rounded-2xl overflow-hidden bg-[#F3EFE9] border border-black/10 shadow-md flex items-center justify-center">
            {rendering ? (
              <div className="text-center space-y-2 p-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#244B3B]" />
                <p className="text-xs font-semibold text-[#5C6068]">
                  Rendering 1080×1920 Story Card...
                </p>
              </div>
            ) : pngDataUrl ? (
              <img
                src={pngDataUrl}
                alt={`${outfit.title} Instagram Story Card`}
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-xs text-[#686D76] p-4 text-center">
                Story preview ready
              </p>
            )}
          </div>

          {/* Right: Collaboration Controls & Caption */}
          <div className="space-y-3.5">
            <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.06] space-y-1.5">
              <p className="text-xs font-bold text-[#141518]">
                Ready for Instagram Stories, Close Friends &amp; TikTok Photo Mode
              </p>
              <p className="text-[11px] text-[#5C6068] leading-relaxed">
                Includes your synced <strong>{spec.handleBadge}</strong> header,{" "}
                <strong>{spec.matchBadge}</strong>, extracted color swatches, exact{" "}
                <strong>{avatarHeightDisplay}</strong> US garment sizes, and a{" "}
                <strong>&ldquo;{spec.pollQuestion}&rdquo;</strong> poll card.
              </p>
            </div>

            <label className="block text-[11px] font-bold text-[#141518]">
              Auto-Generated Story / Post Caption
              <textarea
                readOnly
                rows={5}
                value={spec.shareCaption}
                className="mt-1 w-full p-3 rounded-2xl bg-[#F4F5F7] border border-black/10 text-[11px] font-medium text-[#141518] resize-none"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                id="gwo-download-ig-story-png-btn"
                disabled={!pngDataUrl || rendering}
                onClick={handleDownloadPng}
                className="px-4 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Download className="w-3.5 h-3.5 text-[#A7D7C5]" />
                Download Story PNG
              </button>

              <button
                type="button"
                onClick={() => void handleNativeShare()}
                disabled={!pngDataUrl || rendering}
                className="px-4 py-2.5 rounded-full bg-[#9D174D] hover:bg-[#831843] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share to IG / TikTok
              </button>

              <button
                type="button"
                onClick={() => void handleCopyCaption()}
                className="px-3.5 py-2.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EB] text-[#141518] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition"
              >
                {copiedCaption ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#244B3B]" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copy Caption
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

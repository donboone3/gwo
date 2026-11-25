"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Move,
  RotateCcw,
  Sparkles,
  Upload,
  UserCircle2,
  X,
  ZoomIn,
} from "lucide-react";
import { useGwo } from "@/context/GwoAppContext";
import {
  autoDetectFaceCrop,
  buildCustomerAvatarAssets,
  compressSourceImage,
  FaceCropParams,
  loadImageElement,
} from "@/lib/avatar/customer-avatar";
import { H, STUDIO_LOOKS } from "../vell/vell-data";

/**
 * Generates a clean photorealistic sample customer portrait on an offscreen canvas
 * or loads a CORS-safe portrait URL so users can also test in 1 click.
 */
const DEMO_CUSTOMER_SELFIES = [
  {
    label: "Demo: Sophia",
    url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=85",
  },
  {
    label: "Demo: Zara",
    url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=640&q=85",
  },
  {
    label: "Demo: Claire",
    url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=640&q=85",
  },
];

export function CustomerAvatarModal() {
  const {
    avatarModalOpen,
    setAvatarModalOpen,
    customAvatar,
    saveCustomAvatar,
    clearCustomAvatar,
  } = useGwo();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startCx: number; startCy: number } | null>(null);

  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [label, setLabel] = useState<string>("My Photo Avatar");
  const [crop, setCrop] = useState<FaceCropParams>({
    cx: 0.5,
    cy: 0.38,
    faceWidthRatio: 0.42,
  });
  const [previewOvalUrl, setPreviewOvalUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Load existing avatar into editor when modal opens
  useEffect(() => {
    if (!avatarModalOpen) {
      stopCamera();
      return;
    }
    if (customAvatar && !sourceDataUrl) {
      setSourceDataUrl(customAvatar.fullPhotoDataUrl);
      setCrop(customAvatar.crop);
      setPreviewOvalUrl(customAvatar.faceOvalDataUrl);
      setLabel(customAvatar.label || "My Photo Avatar");
      void loadImageElement(customAvatar.fullPhotoDataUrl)
        .then((im) => {
          loadedImgRef.current = im;
        })
        .catch(() => undefined);
    }
  }, [avatarModalOpen, customAvatar, sourceDataUrl, stopCamera]);

  // Recompute feathered oval preview whenever crop changes
  useEffect(() => {
    const img = loadedImgRef.current;
    if (!img || !sourceDataUrl || !avatarModalOpen) return;
    const id = requestAnimationFrame(() => {
      try {
        const built = buildCustomerAvatarAssets(img, crop, sourceDataUrl, label);
        setPreviewOvalUrl(built.faceOvalDataUrl);
      } catch {
        // Ignore transient render error
      }
    });
    return () => cancelAnimationFrame(id);
  }, [avatarModalOpen, crop, label, sourceDataUrl]);

  const ingestImageSource = useCallback(async (rawUrl: string, nextLabel: string) => {
    setBusy(true);
    setCameraError(null);
    try {
      const img = await loadImageElement(rawUrl);
      const compressed = compressSourceImage(img, 720);
      const cleanImg = await loadImageElement(compressed);
      loadedImgRef.current = cleanImg;
      const detected = await autoDetectFaceCrop(cleanImg);
      setLabel(nextLabel);
      setSourceDataUrl(compressed);
      setCrop(detected);
      const built = buildCustomerAvatarAssets(cleanImg, detected, compressed, nextLabel);
      setPreviewOvalUrl(built.faceOvalDataUrl);
    } catch {
      setCameraError("Could not load that image. Please try another photo file.");
    } finally {
      setBusy(false);
    }
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const objUrl = URL.createObjectURL(file);
    try {
      await ingestImageSource(objUrl, "My Photo Avatar");
    } finally {
      URL.revokeObjectURL(objUrl);
      e.target.value = "";
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError("Camera permission denied or no webcam found—use Upload Photo instead.");
    }
  };

  const snapCameraSelfie = async () => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;
    const cv = document.createElement("canvas");
    cv.width = vid.videoWidth;
    cv.height = vid.videoHeight;
    const ctx = cv.getContext("2d")!;
    // Mirror selfie horizontally so it matches natural mirror view
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(vid, 0, 0);
    const snapped = cv.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await ingestImageSource(snapped, "My Selfie Avatar");
  };

  const handleSave = () => {
    const img = loadedImgRef.current;
    if (!img || !sourceDataUrl) return;
    const finalAvatar = buildCustomerAvatarAssets(img, crop, sourceDataUrl, label);
    saveCustomAvatar(finalAvatar);
    setAvatarModalOpen(false);
  };

  if (!avatarModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/45 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={() => setAvatarModalOpen(false)}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-black/[0.08] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EBF3EE] text-[#244B3B] flex items-center justify-center">
              <UserCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#141518]">
                Your Personal Photo Avatar
              </h2>
              <p className="text-xs text-[#686D76]">
                Upload a selfie once—every outfit in Closet, Runway &amp; 360° updates to you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAvatarModalOpen(false)}
            className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Action Buttons: Upload File | Live Camera | Quick Demo Selfies */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Your Photo
            </button>

            {!cameraActive ? (
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2.5 rounded-full bg-[#F1F2F5] hover:bg-[#E5E7EC] text-[#141518] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Take Live Selfie
              </button>
            ) : (
              <button
                type="button"
                onClick={snapCameraSelfie}
                className="px-4 py-2.5 rounded-full bg-[#244B3B] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> Snap Photo Now
              </button>
            )}

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-[11px] text-[#686D76] hidden sm:inline">
                Or test instant demo:
              </span>
              {DEMO_CUSTOMER_SELFIES.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  disabled={busy}
                  onClick={() => void ingestImageSource(demo.url, demo.label)}
                  className="px-2.5 py-1.5 rounded-full bg-[#F6F7F9] hover:bg-[#EAECEF] border border-black/[0.06] text-[11px] font-semibold text-[#141518] cursor-pointer"
                >
                  {demo.label.replace("Demo: ", "")}
                </button>
              ))}
            </div>
          </div>

          {cameraError && (
            <p className="text-xs text-[#9E3B33] bg-[#FDF2F1] border border-[#F3D3D0] rounded-xl px-3.5 py-2">
              {cameraError}
            </p>
          )}

          {/* Live Camera Stream View */}
          {cameraActive && (
            <div className="rounded-2xl overflow-hidden bg-black relative aspect-video max-h-[260px] mx-auto flex items-center justify-center">
              <video
                ref={videoRef}
                muted
                playsInline
                className="h-full w-auto object-cover -scale-x-100"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-40 rounded-full border-2 border-dashed border-white/80" />
              </div>
            </div>
          )}

          {/* Dual Interactive Crop + Live Outfit Try-On Preview */}
          {sourceDataUrl && !cameraActive ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
              {/* Left: Drag & Zoom Face Alignment */}
              <div className="rounded-2xl bg-[#F6F7F9] border border-black/[0.07] p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141518] inline-flex items-center gap-1.5">
                    <Move className="w-3.5 h-3.5 text-[#686D76]" /> 1. Align Your Face
                  </span>
                  <span className="text-[11px] text-[#686D76]">
                    Drag photo to center
                  </span>
                </div>

                <div
                  onPointerDown={(e) => {
                    dragRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      startCx: crop.cx,
                      startCy: crop.cy,
                    };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragRef.current) return;
                    const dx = (e.clientX - dragRef.current.startX) / 220;
                    const dy = (e.clientY - dragRef.current.startY) / 220;
                    setCrop((prev) => ({
                      ...prev,
                      cx: Math.min(0.92, Math.max(0.08, dragRef.current!.startCx - dx * prev.faceWidthRatio)),
                      cy: Math.min(0.92, Math.max(0.08, dragRef.current!.startCy - dy * prev.faceWidthRatio)),
                    }));
                  }}
                  onPointerUp={() => {
                    dragRef.current = null;
                  }}
                  className="relative w-44 h-52 mx-auto rounded-2xl overflow-hidden bg-[#E5E8EE] cursor-grab active:cursor-grabbing select-none shadow-inner"
                >
                  {previewOvalUrl && (
                    <img
                      src={previewOvalUrl}
                      alt="Aligned face oval"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                  )}
                  <div className="absolute inset-3 rounded-[50%] border-2 border-dashed border-[#244B3B]/55 pointer-events-none" />
                </div>

                {/* Zoom Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-[#686D76]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[#141518]">
                      <ZoomIn className="w-3 h-3" /> Face Scale
                    </span>
                    <span>{Math.round((0.42 / crop.faceWidthRatio) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={75}
                    value={Math.round((1 - crop.faceWidthRatio) * 100)}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCrop((prev) => ({
                        ...prev,
                        faceWidthRatio: Math.min(0.88, Math.max(0.12, 1 - val / 100)),
                      }));
                    }}
                    className="w-full accent-[#141518] cursor-pointer"
                  />
                </div>
              </div>

              {/* Right: Live Full-Body Outfit Preview */}
              <div className="rounded-2xl bg-[#EEF1F6] border border-black/[0.07] p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141518] inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#244B3B]" /> 2. Live Studio Preview
                  </span>
                  <span className="text-[11px] font-semibold text-[#244B3B]">
                    Synced to all outfits
                  </span>
                </div>

                <div className="relative h-60 flex items-center justify-center overflow-hidden">
                  {/* Zoomed upper-body crop of Studio Look 0 (w=900 already preloaded!) with live customer face */}
                  <div className="relative h-[420px] aspect-[1360/2048] translate-y-24">
                    <img
                      src={H(STUDIO_LOOKS[0].file, 900)}
                      alt="Studio preview body"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    {previewOvalUrl && (
                      <img
                        src={previewOvalUrl}
                        alt="Your avatar face"
                        style={{
                          left: "49.95%",
                          top: "13.2%",
                          width: "12.9%",
                          height: "9.7%",
                        }}
                        className="absolute -translate-x-1/2 -translate-y-1/2 object-fill pointer-events-none"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            !cameraActive && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-black/[0.12] hover:border-[#141518] bg-[#FAFBFD] p-8 text-center space-y-2 cursor-pointer transition"
              >
                <Upload className="w-7 h-7 mx-auto text-[#686D76]" />
                <p className="text-sm font-bold text-[#141518]">
                  Drop a selfie or full-body photo here, or click to upload
                </p>
                <p className="text-xs text-[#686D76]">
                  Processed privately in your browser in under 1 second—updates Closet, Runway &amp; 360° Fit View.
                </p>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#FAFBFD] border-t border-black/[0.07] flex items-center justify-between gap-3">
          {customAvatar ? (
            <button
              type="button"
              onClick={() => {
                clearCustomAvatar();
                setSourceDataUrl(null);
                setPreviewOvalUrl(null);
                setAvatarModalOpen(false);
              }}
              className="px-3.5 py-2 rounded-full text-xs font-semibold text-[#686D76] hover:text-[#141518] hover:bg-[#ECEEF2] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset to Studio Model
            </button>
          ) : (
            <span className="text-[11px] text-[#686D76]">
              Tip: Front-facing lighting gives the most lifelike blend.
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setAvatarModalOpen(false)}
              className="px-4 py-2.5 rounded-full text-xs font-semibold text-[#686D76] hover:bg-[#ECEEF2] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="gwo-save-avatar-btn"
              disabled={!sourceDataUrl || busy}
              onClick={handleSave}
              className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[#141518] hover:bg-[#27292E] text-white disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Apply My Avatar Everywhere
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

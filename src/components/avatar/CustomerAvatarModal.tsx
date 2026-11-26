"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  Move,
  RotateCcw,
  Ruler,
  ScanLine,
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
import {
  analyzeBodySilhouetteFromImage,
  BODY_SCAN_PRESETS,
  BodyScanDimensions,
  deriveFullBodyDimensionsFromProfile,
  formatHeightFeetInches,
  SKIN_TONE_SWATCHES,
} from "@/lib/three/body-scan-analyzer";
import { deriveStandardApparelSize } from "@/lib/catalog/sizing";
import { Interactive3DAvatarStage } from "../three/Interactive3DAvatarStage";
import { H, STUDIO_LOOKS } from "../vell/vell-data";

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
    user,
    products,
    avatarModalOpen,
    setAvatarModalOpen,
    customAvatar,
    saveCustomAvatar,
    clearCustomAvatar,
    updateProfilePatch,
    showToast,
  } = useGwo();

  const [activeTab, setActiveTab] = useState<"body3d" | "selfie">("body3d");

  // 3D Body Scan Dimensions state (initialized from active UserProfile)
  const [dims, setDims] = useState<BodyScanDimensions>(() =>
    deriveFullBodyDimensionsFromProfile(user, customAvatar)
  );
  const [scanStatusMsg, setScanStatusMsg] = useState<string | null>(null);
  const [scanningBody, setScanningBody] = useState(false);
  const [previewSampleFit, setPreviewSampleFit] = useState(true);

  const frontScanInputRef = useRef<HTMLInputElement | null>(null);
  const sideScanInputRef = useRef<HTMLInputElement | null>(null);
  const frontScanImgRef = useRef<HTMLImageElement | null>(null);

  // Face Selfie crop state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startCx: number;
    startCy: number;
  } | null>(null);

  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null);
  const [label, setLabel] = useState<string>("My 3D Body & Face Twin");
  const [crop, setCrop] = useState<FaceCropParams>({
    cx: 0.5,
    cy: 0.38,
    faceWidthRatio: 0.42,
  });
  const [previewOvalUrl, setPreviewOvalUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<"body" | "selfie">("body");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!avatarModalOpen) {
      stopCamera();
      return;
    }
    setDims(deriveFullBodyDimensionsFromProfile(user, customAvatar));
    if (customAvatar && !sourceDataUrl) {
      setSourceDataUrl(customAvatar.fullPhotoDataUrl);
      setCrop(customAvatar.crop);
      setPreviewOvalUrl(customAvatar.faceOvalDataUrl);
      setLabel(customAvatar.label || "My 3D Body & Face Twin");
      void loadImageElement(customAvatar.fullPhotoDataUrl)
        .then((im) => {
          loadedImgRef.current = im;
        })
        .catch(() => undefined);
    }
  }, [avatarModalOpen, customAvatar, sourceDataUrl, stopCamera, user]);

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

  // Sample outfit pieces to preview how store clothing fits the scanned 3D body live!
  const sampleWornPieces = useMemo(() => {
    if (!previewSampleFit || products.length === 0) return [];
    const top = products.find((p) => p.id === "prod-ae-espresso-corset") || products[0];
    const bot = products.find((p) => p.id === "prod-ae-champagne-trousers");
    const heels = products.find((p) => p.id === "prod-ae-gold-strappy-heels");
    return [top, bot, heels]
      .filter((Boolean as unknown) as <T>(x: T | undefined) => x is T)
      .map((product) => ({ product }));
  }, [previewSampleFit, products]);

  const recommendedUsSize = useMemo(
    () =>
      deriveStandardApparelSize({
        bustInches: dims.bustInches,
        waistInches: dims.waistInches,
        hipsInches: dims.hipsInches,
      }),
    [dims.bustInches, dims.hipsInches, dims.waistInches]
  );

  // Handle Standing Body Scan Photo (Front or Side)
  const handleBodyScanPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    angle: "front" | "side"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningBody(true);
    setCameraError(null);
    const objUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageElement(objUrl);
      if (angle === "front") {
        frontScanImgRef.current = img;
        const scan = analyzeBodySilhouetteFromImage(img, dims.heightInches, null);
        setDims((prev) => ({
          ...prev,
          ...scan.dimensions,
        }));
        setScanStatusMsg(scan.scanSummary);
      } else {
        const frontImg = frontScanImgRef.current || img;
        const scan = analyzeBodySilhouetteFromImage(
          frontImg,
          dims.heightInches,
          img
        );
        setDims((prev) => ({
          ...prev,
          ...scan.dimensions,
        }));
        setScanStatusMsg(scan.scanSummary);
      }
    } catch {
      setCameraError("Could not read body scan image — try another photo or adjust sliders below.");
    } finally {
      URL.revokeObjectURL(objUrl);
      e.target.value = "";
      setScanningBody(false);
    }
  };

  const ingestImageSource = useCallback(
    async (rawUrl: string, nextLabel: string) => {
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
        const built = buildCustomerAvatarAssets(
          cleanImg,
          detected,
          compressed,
          nextLabel
        );
        setPreviewOvalUrl(built.faceOvalDataUrl);
        setDims((prev) => ({
          ...prev,
          skinToneHex: built.skinToneHex || prev.skinToneHex,
        }));
      } catch {
        setCameraError("Could not load that image. Please try another photo.");
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const handleSelfieFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const objUrl = URL.createObjectURL(file);
    try {
      await ingestImageSource(objUrl, "My 3D Body & Face Twin");
    } finally {
      URL.revokeObjectURL(objUrl);
      e.target.value = "";
    }
  };

  const startCamera = async (mode: "body" | "selfie") => {
    setCameraError(null);
    setCameraMode(mode);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
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
      setCameraError(
        "Camera permission unavailable here — upload a standing photo or use precision body sliders below."
      );
    }
  };

  const snapCameraCapture = async () => {
    const vid = videoRef.current;
    if (!vid || !vid.videoWidth) return;
    const cv = document.createElement("canvas");
    cv.width = vid.videoWidth;
    cv.height = vid.videoHeight;
    const ctx = cv.getContext("2d")!;
    ctx.translate(cv.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(vid, 0, 0);
    const snapped = cv.toDataURL("image/jpeg", 0.9);
    stopCamera();

    if (cameraMode === "body") {
      const img = await loadImageElement(snapped);
      frontScanImgRef.current = img;
      const scan = analyzeBodySilhouetteFromImage(img, dims.heightInches, null);
      setDims((prev) => ({ ...prev, ...scan.dimensions }));
      setScanStatusMsg(scan.scanSummary);
    } else {
      await ingestImageSource(snapped, "My 3D Body & Face Twin");
    }
  };

  const handleSaveAll = async () => {
    await updateProfilePatch({
      heightInches: dims.heightInches,
      bustInches: dims.bustInches,
      underbustInches: dims.underbustInches,
      waistInches: dims.waistInches,
      hipsInches: dims.hipsInches,
      shoulderInches: dims.shoulderInches,
      inseamInches: dims.inseamInches,
      shoeSize: dims.shoeSize,
      skinTone: dims.skinToneHex,
      hairStyle: dims.hairStyle,
    });

    const img = loadedImgRef.current;
    if (img && sourceDataUrl) {
      const finalAvatar = buildCustomerAvatarAssets(
        img,
        crop,
        sourceDataUrl,
        label
      );
      saveCustomAvatar(finalAvatar);
    }

    showToast(
      `3D Body Twin saved (${formatHeightFeetInches(dims.heightInches)} • ${dims.bustInches}" B • ${dims.waistInches}" W • ${dims.hipsInches}" H → Size ${recommendedUsSize})!`
    );
    setAvatarModalOpen(false);
  };

  if (!avatarModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[125] bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={() => setAvatarModalOpen(false)}
    >
      <div
        className="w-full max-w-5xl rounded-3xl bg-white shadow-2xl border border-black/[0.08] overflow-hidden max-h-[92svh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-black/[0.07] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#EBF3EE] text-[#244B3B] flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#141518]">
                3D Body Scanner &amp; Exact-Fit Twin
              </h2>
              <p className="text-xs text-[#686D76]">
                Scan your body or dial exact inches so every online garment renders &amp; fits accurately on you in 3D.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-full bg-[#F1F2F5] border border-black/[0.07]">
              <button
                type="button"
                onClick={() => setActiveTab("body3d")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  activeTab === "body3d"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                1. 3D Body Scan
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("selfie")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer transition ${
                  activeTab === "selfie"
                    ? "bg-[#141518] text-white"
                    : "text-[#686D76] hover:text-[#141518]"
                }`}
              >
                2. Face Selfie
              </button>
            </div>

            <button
              type="button"
              onClick={() => setAvatarModalOpen(false)}
              className="p-2 rounded-full hover:bg-[#F1F2F5] text-[#686D76] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Body: Live Morphing 3D Body Twin + Controls */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)] gap-5">
          {/* LEFT: LIVE INTERACTIVE 3D BODY TWIN STAGE */}
          <div className="flex flex-col gap-2.5">
            <div className="relative h-[370px] sm:h-[430px] rounded-2xl bg-gradient-to-b from-[#EEF1F6] via-[#E7ECF4] to-[#F5F7FA] border border-black/[0.08] overflow-hidden">
              <Interactive3DAvatarStage
                mode="avatar"
                dimensions={dims}
                wornPieces={sampleWornPieces}
                showMeasurementRings={true}
                faceOvalDataUrl={previewOvalUrl || customAvatar?.faceOvalDataUrl}
                autoSpinDefault={false}
                initialYawDeg={18}
                compactHud={true}
                showHud={true}
              />
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl bg-[#F4F8F5] border border-[#C6E0D0]">
              <div className="text-xs">
                <p className="font-bold text-[#141518]">
                  Exact Safe-Fit Match: US Size {recommendedUsSize}
                </p>
                <p className="text-[11px] text-[#244B3B] font-semibold">
                  {formatHeightFeetInches(dims.heightInches)} •{" "}
                  {dims.bustInches}&quot; B • {dims.waistInches}&quot; W •{" "}
                  {dims.hipsInches}&quot; H • {dims.inseamInches}&quot; Inseam
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSampleFit((v) => !v)}
                className="px-2.5 py-1.5 rounded-full bg-white border border-black/10 text-[11px] font-bold text-[#141518] hover:bg-[#EAECEF] cursor-pointer shrink-0"
              >
                {previewSampleFit ? "Show Base Body" : "Test Store Outfit"}
              </button>
            </div>
          </div>

          {/* RIGHT: BODY SCANNER OR FACE SELFIE CONTROLS */}
          {activeTab === "body3d" ? (
            <div className="space-y-4">
              {/* Photo / Camera Silhouette Scan Bar */}
              <div className="p-3.5 rounded-2xl bg-[#F7F8FA] border border-black/[0.07] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#141518] flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-[#244B3B]" /> AI Camera / Photo Silhouette Body Scan
                    </p>
                    <p className="text-[11px] text-[#686D76]">
                      Set your height first, then scan a front standing photo (plus optional side profile) to extract your exact 3D proportions.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={frontScanInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBodyScanPhotoUpload(e, "front")}
                    className="hidden"
                  />
                  <input
                    ref={sideScanInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBodyScanPhotoUpload(e, "side")}
                    className="hidden"
                  />

                  <button
                    type="button"
                    disabled={scanningBody}
                    onClick={() => frontScanInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" /> Scan Front Body Photo
                  </button>

                  <button
                    type="button"
                    disabled={scanningBody}
                    onClick={() => sideScanInputRef.current?.click()}
                    className="px-3 py-2 rounded-full bg-white hover:bg-[#EAECEF] border border-black/10 text-[#141518] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    + Optional Side Photo
                  </button>

                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={() => startCamera("body")}
                      className="px-3 py-2 rounded-full bg-[#E7F3EE] hover:bg-[#D5EAE0] text-[#1D4232] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ScanLine className="w-3.5 h-3.5" /> Live Camera Scan
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={snapCameraCapture}
                      className="px-3.5 py-2 rounded-full bg-[#244B3B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" /> Capture Body Silhouette
                    </button>
                  )}
                </div>

                {cameraActive && cameraMode === "body" && (
                  <div className="relative h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="h-full w-full object-contain -scale-x-100"
                    />
                    <div className="pointer-events-none absolute inset-y-3 w-28 border-2 border-dashed border-emerald-400/85 rounded-full flex items-end justify-center pb-2">
                      <span className="px-2 py-0.5 rounded-full bg-black/70 text-[10px] font-bold text-white">
                        Align Full Silhouette
                      </span>
                    </div>
                  </div>
                )}

                {scanStatusMsg && (
                  <p className="text-[11px] font-semibold text-[#1D4232] bg-[#E7F3EE] px-3 py-1.5 rounded-xl">
                    ✓ {scanStatusMsg}
                  </p>
                )}
                {cameraError && (
                  <p className="text-[11px] font-semibold text-[#9E2A22] bg-[#FDECEB] px-3 py-1.5 rounded-xl">
                    {cameraError}
                  </p>
                )}
              </div>

              {/* Quick Real-Body Archetype Presets */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#686D76]">
                  Quick Real-Body Starting Presets
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {BODY_SCAN_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setDims((prev) => ({ ...prev, ...preset.dims }));
                        setScanStatusMsg(
                          `Applied ${preset.label} (${preset.subtitle}) — drag any slider to customize.`
                        );
                      }}
                      className="p-2 rounded-xl border border-black/[0.08] bg-white hover:bg-[#F4F8F5] hover:border-[#244B3B] text-left transition cursor-pointer"
                    >
                      <p className="text-[11px] font-bold text-[#141518]">
                        {preset.label}
                      </p>
                      <p className="text-[10px] text-[#686D76]">
                        {preset.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Precision 0.25" Morphing Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#FAFBFD] p-3.5 rounded-2xl border border-black/[0.06]">
                {(
                  [
                    {
                      key: "heightInches" as const,
                      label: "Standing Height",
                      min: 58,
                      max: 73,
                      step: 0.5,
                      fmt: (v: number) =>
                        `${formatHeightFeetInches(v)} (${v}")`,
                    },
                    {
                      key: "bustInches" as const,
                      label: "Full Bust",
                      min: 29,
                      max: 47,
                      step: 0.25,
                      fmt: (v: number) => `${v}"`,
                    },
                    {
                      key: "waistInches" as const,
                      label: "Natural Waist",
                      min: 22,
                      max: 40,
                      step: 0.25,
                      fmt: (v: number) => `${v}"`,
                    },
                    {
                      key: "hipsInches" as const,
                      label: "Widest Hips",
                      min: 31,
                      max: 49,
                      step: 0.25,
                      fmt: (v: number) => `${v}"`,
                    },
                    {
                      key: "shoulderInches" as const,
                      label: "Shoulder Width",
                      min: 13.75,
                      max: 18.5,
                      step: 0.25,
                      fmt: (v: number) => `${v}"`,
                    },
                    {
                      key: "inseamInches" as const,
                      label: "Leg Inseam",
                      min: 25.5,
                      max: 34.5,
                      step: 0.25,
                      fmt: (v: number) => `${v}"`,
                    },
                  ] as const
                ).map((s) => (
                  <label key={s.key} className="space-y-1 block">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#141518]">{s.label}</span>
                      <span className="font-bold text-[#244B3B]">
                        {s.fmt(dims[s.key])}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={dims[s.key]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDims((prev) => ({
                          ...prev,
                          [s.key]: val,
                          underbustInches:
                            s.key === "bustInches"
                              ? Math.round(val * 0.855 * 4) / 4
                              : prev.underbustInches,
                        }));
                      }}
                      className="w-full accent-[#244B3B] cursor-pointer"
                    />
                  </label>
                ))}
              </div>

              {/* Skin Tone, Hair & Shoe Size */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[#686D76]">
                    3D Skin Tone
                  </p>
                  <div className="flex items-center gap-1.5">
                    {SKIN_TONE_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        onClick={() =>
                          setDims((prev) => ({ ...prev, skinToneHex: sw.hex }))
                        }
                        title={sw.label}
                        style={{ backgroundColor: sw.hex }}
                        className={`w-6 h-6 rounded-full border cursor-pointer transition ${
                          dims.skinToneHex.toLowerCase() === sw.hex.toLowerCase()
                            ? "ring-2 ring-[#141518] ring-offset-1 border-white scale-110"
                            : "border-black/15"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[#686D76]">
                    3D Hairstyle
                  </p>
                  <select
                    value={dims.hairStyle}
                    onChange={(e) =>
                      setDims((prev) => ({
                        ...prev,
                        hairStyle: e.target.value as BodyScanDimensions["hairStyle"],
                      }))
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-bold text-[#141518]"
                  >
                    <option value="waves-espresso">Espresso Layered Waves</option>
                    <option value="sleek-bun-blonde">Sleek Honey Bun</option>
                    <option value="curls-warm">Warm Sculpted Curls</option>
                    <option value="straight-auburn">Auburn Silk Straight</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-[#686D76]">
                    US Shoe Size
                  </p>
                  <select
                    value={dims.shoeSize}
                    onChange={(e) =>
                      setDims((prev) => ({ ...prev, shoeSize: e.target.value }))
                    }
                    className="px-3 py-1.5 rounded-xl bg-[#F4F5F7] border border-black/10 text-xs font-bold text-[#141518]"
                  >
                    {["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10"].map(
                      (sz) => (
                        <option key={sz} value={sz}>
                          US {sz}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: FACE SELFIE CROP & PROJECTION */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSelfieFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-full bg-[#141518] hover:bg-[#27292E] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Selfie
                </button>
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={() => startCamera("selfie")}
                    className="px-3.5 py-2 rounded-full bg-[#F1F2F5] hover:bg-[#E4E6EC] text-xs font-bold text-[#141518] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> Take Live Selfie
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={snapCameraCapture}
                    className="px-3.5 py-2 rounded-full bg-[#244B3B] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" /> Snap Selfie
                  </button>
                )}

                {DEMO_CUSTOMER_SELFIES.map((demo) => (
                  <button
                    key={demo.label}
                    type="button"
                    disabled={busy}
                    onClick={() => ingestImageSource(demo.url, demo.label)}
                    className="px-3 py-1.5 rounded-full bg-[#F4F8F5] hover:bg-[#E4F0E8] border border-[#C6E0D0] text-[11px] font-bold text-[#1D4232] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> {demo.label}
                  </button>
                ))}
              </div>

              {cameraActive && cameraMode === "selfie" && (
                <div className="relative h-56 rounded-2xl overflow-hidden bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="h-full w-full object-cover -scale-x-100"
                  />
                </div>
              )}

              {sourceDataUrl ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div
                    onPointerDown={(e) => {
                      dragRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        startCx: crop.cx,
                        startCy: crop.cy,
                      };
                      (e.currentTarget as HTMLElement).setPointerCapture(
                        e.pointerId
                      );
                    }}
                    onPointerMove={(e) => {
                      if (!dragRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dx = (e.clientX - dragRef.current.startX) / rect.width;
                      const dy = (e.clientY - dragRef.current.startY) / rect.height;
                      setCrop((prev) => ({
                        ...prev,
                        cx: Math.min(0.9, Math.max(0.1, dragRef.current!.startCx - dx)),
                        cy: Math.min(0.9, Math.max(0.1, dragRef.current!.startCy - dy)),
                      }));
                    }}
                    onPointerUp={() => {
                      dragRef.current = null;
                    }}
                    className="relative h-60 rounded-2xl overflow-hidden bg-[#F1F2F5] border border-black/10 cursor-move select-none"
                  >
                    <img
                      src={sourceDataUrl}
                      alt="Selfie source"
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <div className="absolute bottom-2 inset-x-2 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10.5px] font-semibold flex items-center justify-center gap-1">
                      <Move className="w-3 h-3" /> Drag to center face
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-[#141518] flex items-center gap-1">
                        <ZoomIn className="w-3.5 h-3.5" /> Face Scale
                      </span>
                      <input
                        type="range"
                        min={0.14}
                        max={0.7}
                        step={0.01}
                        value={crop.faceWidthRatio}
                        onChange={(e) =>
                          setCrop((prev) => ({
                            ...prev,
                            faceWidthRatio: Number(e.target.value),
                          }))
                        }
                        className="w-full accent-[#141518]"
                      />
                    </label>

                    <div className="relative h-44 rounded-2xl bg-[#EEF1F5] border border-black/[0.06] flex items-end justify-center overflow-hidden">
                      <img
                        src={H(STUDIO_LOOKS[0].file, 540)}
                        alt="Studio composite preview"
                        className="h-full object-contain"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[#F7F8FA] border border-dashed border-black/15 text-center space-y-2">
                  <UserCircle2 className="w-8 h-8 text-[#244B3B] mx-auto" />
                  <p className="text-xs font-bold text-[#141518]">
                    Optional: Add a Selfie to Project Your Face onto Your 3D Twin
                  </p>
                  <p className="text-[11px] text-[#686D76]">
                    Your 3D Body Scan dimensions on Tab 1 work immediately even without a selfie!
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-[#F8F9FB] border-t border-black/[0.07] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {customAvatar && (
              <button
                type="button"
                onClick={() => {
                  clearCustomAvatar();
                  setSourceDataUrl(null);
                  setPreviewOvalUrl(null);
                }}
                className="px-3 py-2 rounded-full text-xs font-bold text-[#686D76] hover:text-[#141518] inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Clear Selfie
              </button>
            )}
            <span className="text-xs font-semibold text-[#686D76]">
              Matches all online garments to your exact{" "}
              <strong className="text-[#141518]">
                {formatHeightFeetInches(dims.heightInches)} • Size{" "}
                {recommendedUsSize}
              </strong>{" "}
              3D body
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAvatarModalOpen(false)}
              className="px-4 py-2 rounded-full bg-white border border-black/10 text-xs font-bold text-[#686D76] hover:text-[#141518] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="gwo-save-3d-body-btn"
              onClick={handleSaveAll}
              className="px-5 py-2.5 rounded-full bg-[#244B3B] hover:bg-[#1C3B2E] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save My 3D Body Twin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

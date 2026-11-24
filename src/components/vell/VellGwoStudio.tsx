"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Copy,
  ExternalLink,
  Heart,
  Layers,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  ShoppingBag,
  Shuffle,
  Sliders,
  Sparkles,
  Trash2,
  Undo2,
  Users,
  X,
} from "lucide-react";
import "./vell-studio.css";
import { GwoLogo } from "../brand/GwoLogo";
import {
  ACCESSORY_CATALOG,
  H,
  IDENTITIES,
  LOFT_BG_URL,
  PERSONALITY_TRAITS,
  SCENE_FILTERS,
  STUDIO_LOOKS,
} from "./vell-data";
import { useGwo } from "@/context/GwoAppContext";

type TopTab = "DNA" | "BODY" | "STYLE" | "PERSONALITY" | "STORY";
type SideMenuKey =
  | "Face"
  | "Hair"
  | "Makeup"
  | "Body"
  | "Outfits"
  | "Accessories"
  | "Tattoos"
  | "Details";
type FramingMode = "full" | "mid" | "portrait";
type CategoryFilter =
  | "all"
  | "everyday"
  | "athletic"
  | "sleep"
  | "formal"
  | "party"
  | "street";

interface HistorySnapshot {
  look: number;
  grade: number;
  real: number;
  height: number;
  build: number;
  accessories: string[];
}

interface DragPayload {
  kind: "look" | "accessory" | "scraped";
  label: string;
  sublabel: string;
  lookIndex?: number;
  accessoryName?: string;
  scrapedImageUrl?: string;
  x: number;
  y: number;
}

const TOP_TABS: TopTab[] = ["DNA", "BODY", "STYLE", "PERSONALITY", "STORY"];

const SIDE_ITEMS: SideMenuKey[] = [
  "Face",
  "Hair",
  "Makeup",
  "Body",
  "Outfits",
  "Accessories",
  "Tattoos",
  "Details",
];

const CATEGORY_CHIPS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "everyday", label: "Everyday" },
  { id: "athletic", label: "Athletic" },
  { id: "sleep", label: "Sleep" },
  { id: "formal", label: "Formal" },
  { id: "party", label: "Party" },
  { id: "street", label: "Street" },
];

const HAIR_SWATCHES = ["#14110f", "#3b2a20", "#6b4a35", "#a07c5a", "#d9c3a1"];
const MAKEUP_SWATCHES = ["#e8b4a8", "#d98c8c", "#b5525e", "#8e3c4a"];

const TUNE_CONFIG: Record<
  Exclude<SideMenuKey, "Body" | "Outfits">,
  {
    swatches?: string[];
    presets: string[];
    multiSelect?: boolean;
    sliders: Array<{ name: string; defaultVal: number }>;
  }
> = {
  Face: {
    presets: ["Soft", "Defined", "Natural", "Sculpted"],
    sliders: [
      { name: "Smile", defaultVal: 35 },
      { name: "Jawline", defaultVal: 50 },
      { name: "Freckles", defaultVal: 10 },
    ],
  },
  Hair: {
    swatches: HAIR_SWATCHES,
    presets: ["High bun", "Low bun", "Long straight", "Bob", "Ponytail"],
    sliders: [
      { name: "Volume", defaultVal: 60 },
      { name: "Shine", defaultVal: 70 },
    ],
  },
  Makeup: {
    swatches: MAKEUP_SWATCHES,
    presets: ["No-makeup", "Glass skin", "Soft glam", "Editorial"],
    sliders: [
      { name: "Blush", defaultVal: 30 },
      { name: "Lip tint", defaultVal: 45 },
      { name: "Glow", defaultVal: 55 },
    ],
  },
  Accessories: {
    presets: [
      "Gold hoops",
      "Silver chain",
      "Shoulder bag",
      "Sunglasses",
      "Watch",
      "Hair clip",
    ],
    multiSelect: true,
    sliders: [],
  },
  Tattoos: {
    presets: ["None", "Fine line", "Floral", "Script", "Minimal dots"],
    sliders: [{ name: "Opacity", defaultVal: 40 }],
  },
  Details: {
    presets: ["Studio", "Natural", "Cinematic"],
    sliders: [
      { name: "Skin texture", defaultVal: 70 },
      { name: "Fabric detail", defaultVal: 80 },
      { name: "Lighting softness", defaultVal: 60 },
    ],
  },
};

export function VellGwoStudio() {
  const {
    friends,
    telemetry,
    ingestUrlToSharedCatalog,
    shareMyClosetAndClaimBonus,
    products,
  } = useGwo();

  // ==================== STAGE SCALE & PARALLAX REFS ====================
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const figsRef = useRef<HTMLDivElement | null>(null);
  const scanRef = useRef<HTMLDivElement | null>(null);
  const libRowRef = useRef<HTMLDivElement | null>(null);
  const nameEditableRef = useRef<HTMLSpanElement | null>(null);

  const preloadedImgsRef = useRef<HTMLImageElement[]>([]);
  const swapTokenRef = useRef(0);
  const stageScaleRef = useRef(1);

  // ==================== CORE STUDIO STATE ====================
  const [activeTab, setActiveTab] = useState<TopTab>("STYLE");
  const [sideKey, setSideKey] = useState<SideMenuKey>("Outfits");
  const [lookIdx, setLookIdx] = useState(0);
  const [gradeIdx, setGradeIdx] = useState(0);
  const [realism, setRealism] = useState(75);
  const [heightCm, setHeightCm] = useState(168);
  const [buildVal, setBuildVal] = useState(50);
  const [posture, setPosture] = useState("Relaxed");
  const [framing, setFraming] = useState<FramingMode>("full");

  // Undo / Redo History Stack
  const [history, setHistory] = useState<HistorySnapshot[]>([
    {
      look: 0,
      grade: 0,
      real: 75,
      height: 168,
      build: 50,
      accessories: ["Gold hoops"],
    },
  ]);
  const [histPtr, setHistPtr] = useState(0);

  // Identity / Profile Card
  const [identityIdx, setIdentityIdx] = useState(0);
  const [charName, setCharName] = useState(IDENTITIES[0].name);
  const [editingName, setEditingName] = useState(false);
  const [shuffleRot, setShuffleRot] = useState(0);
  const [weatherHover, setWeatherHover] = useState(false);

  // Outfits Grid, Filter & Accordion
  const [catFilter, setCatFilter] = useState<CategoryFilter>("all");
  const [hiddenCards, setHiddenCards] = useState<Set<number>>(new Set());
  const [openAccordion, setOpenAccordion] = useState<
    "tops" | "bottoms" | "full" | "shoes" | "acc"
  >("tops");
  const [rouletteIdx, setRouletteIdx] = useState<number | null>(null);
  const [randSpin, setRandSpin] = useState(0);

  // Cart, Favourites, Saved Closet Library
  const [cartPieces, setCartPieces] = useState<
    Array<{ key: string; name: string; color: string; price: number; friendRef?: string }>
  >([]);
  const [favLooks, setFavLooks] = useState<Set<number>>(new Set());
  const [savedLibrary, setSavedLibrary] = useState<
    Array<{ id: string; look: number; grade: number }>
  >([]);
  const [cartBump, setCartBump] = useState(false);
  const [favBump, setFavBump] = useState(false);
  const [libBump, setLibBump] = useState(false);

  // Drawers & Dropdowns
  const [libOpen, setLibOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [gwoDrawer, setGwoDrawer] = useState<"none" | "friends" | "firecrawl">("none");
  const [swipeRackOpen, setSwipeRackOpen] = useState(true);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterOffset, setFilterOffset] = useState(0);
  const [filterNudge, setFilterNudge] = useState(false);
  const [saveShine, setSaveShine] = useState(false);

  // Tune View States
  const [equippedAccessories, setEquippedAccessories] = useState<string[]>([
    "Gold hoops",
  ]);
  const [tunePresets, setTunePresets] = useState<Record<string, string>>({
    Face: "Natural",
    Hair: "High bun",
    Makeup: "Glass skin",
    Tattoos: "None",
    Details: "Studio",
  });
  const [tuneSwatches, setTuneSwatches] = useState<Record<string, string>>({
    Hair: HAIR_SWATCHES[0],
    Makeup: MAKEUP_SWATCHES[0],
  });
  const [tuneSliders, setTuneSliders] = useState<Record<string, number>>({
    "Face:Smile": 35,
    "Face:Jawline": 50,
    "Face:Freckles": 10,
    "Hair:Volume": 60,
    "Hair:Shine": 70,
    "Makeup:Blush": 30,
    "Makeup:Lip tint": 45,
    "Makeup:Glow": 55,
    "Tattoos:Opacity": 40,
    "Details:Skin texture": 70,
    "Details:Fabric detail": 80,
    "Details:Lighting softness": 60,
  });

  // Personality & Story
  const [traits, setTraits] = useState<string[]>(["Curious", "Creative", "Gentle"]);
  const [customOpenness, setCustomOpenness] = useState<number | null>(null);
  const [customEnergy, setCustomEnergy] = useState<number | null>(null);
  const [typedStory, setTypedStory] = useState("");

  // DNA Helix Animation Phase
  const [helixPhase, setHelixPhase] = useState(0);

  // Toast
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Swipe & Drag-Onto-Avatar State
  const [dragItem, setDragItem] = useState<DragPayload | null>(null);
  const [overAvatarDropZone, setOverAvatarDropZone] = useState(false);
  const avatarSwipeStartXRef = useRef<number | null>(null);

  // Firecrawl URL Import State
  const [scrapeInput, setScrapeInput] = useState("");
  const [scrapingNow, setScrapingNow] = useState(false);
  const [activeFriendCloset, setActiveFriendCloset] = useState<string | null>(null);

  const triggerToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 1850);
  }, []);

  // ==================== STAGE AUTO-SCALING & PARALLAX ====================
  useEffect(() => {
    const updateScale = () => {
      const s = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
      stageScaleRef.current = s;
      if (rootRef.current) {
        rootRef.current.style.setProperty("--s", String(s));
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Preload all 8 w=1000 cut-outs and mount Look 0 immediately without animation
  useEffect(() => {
    const imgs = STUDIO_LOOKS.map((l) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.src = H(l.file, 1000);
      return im;
    });
    preloadedImgsRef.current = imgs;

    if (figsRef.current) {
      figsRef.current.innerHTML = "";
      const baseFig = document.createElement("div");
      baseFig.className = "vell-fig";
      baseFig.style.backgroundImage = `url("${H(STUDIO_LOOKS[0].file, 1000)}")`;
      figsRef.current.appendChild(baseFig);
    }
  }, []);

  // DNA Double Helix RAF only when DNA tab is open
  useEffect(() => {
    if (activeTab !== "DNA") return;
    let rafId = 0;
    const step = () => {
      setHelixPhase((t) => t + 0.03);
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [activeTab]);

  // ==================== SCAN LINE & SIGNATURE WIPE ====================
  const rescan = useCallback(() => {
    const scanEl = scanRef.current;
    if (!scanEl) return;
    scanEl.classList.remove("go");
    void scanEl.offsetWidth;
    scanEl.classList.add("go");
  }, []);

  const showLook = useCallback(
    async (targetIdx: number, customImgUrl?: string) => {
      const idx = ((targetIdx % STUDIO_LOOKS.length) + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
      setLookIdx(idx);
      const myToken = ++swapTokenRef.current;

      const targetUrl = customImgUrl || H(STUDIO_LOOKS[idx].file, 1000);
      const preload = preloadedImgsRef.current[idx];
      try {
        if (!customImgUrl && preload) {
          await preload.decode();
        } else {
          const temp = new Image();
          temp.src = targetUrl;
          await temp.decode();
        }
      } catch {
        // Proceed even if browser decode resolves immediately
      }

      if (myToken !== swapTokenRef.current) return;
      const container = figsRef.current;
      if (!container) return;

      const nextFig = document.createElement("div");
      nextFig.className = "vell-fig in";
      nextFig.style.backgroundImage = `url("${targetUrl}")`;
      container.appendChild(nextFig);

      rescan();

      nextFig.addEventListener(
        "animationend",
        () => {
          const children = Array.from(container.children);
          for (const ch of children) {
            if (ch !== nextFig) ch.remove();
          }
          nextFig.classList.remove("in");
        },
        { once: true }
      );
    },
    [rescan]
  );

  // Commit snapshot to Undo/Redo stack
  const commitSnapshot = useCallback(
    (patch: Partial<HistorySnapshot>) => {
      setHistory((prev) => {
        const curr = prev[histPtr] || prev[prev.length - 1];
        const nextSnap: HistorySnapshot = {
          look: patch.look ?? lookIdx,
          grade: patch.grade ?? gradeIdx,
          real: patch.real ?? realism,
          height: patch.height ?? heightCm,
          build: patch.build ?? buildVal,
          accessories: patch.accessories ?? equippedAccessories,
        };
        if (
          curr &&
          curr.look === nextSnap.look &&
          curr.grade === nextSnap.grade &&
          curr.real === nextSnap.real &&
          curr.height === nextSnap.height &&
          curr.build === nextSnap.build &&
          curr.accessories.join(",") === nextSnap.accessories.join(",")
        ) {
          return prev;
        }
        const sliced = prev.slice(0, histPtr + 1);
        const updated = [...sliced, nextSnap];
        setHistPtr(updated.length - 1);
        return updated;
      });
    },
    [buildVal, equippedAccessories, gradeIdx, heightCm, histPtr, lookIdx, realism]
  );

  const pickLook = useCallback(
    (idx: number, force = false) => {
      if (!force && idx === lookIdx) return;
      void showLook(idx);
      commitSnapshot({ look: idx });
    },
    [commitSnapshot, lookIdx, showLook]
  );

  const applySnapshot = useCallback(
    (snap: HistorySnapshot) => {
      if (snap.look !== lookIdx) {
        void showLook(snap.look);
      } else {
        rescan();
      }
      setGradeIdx(snap.grade);
      setRealism(snap.real);
      setHeightCm(snap.height);
      setBuildVal(snap.build);
      setEquippedAccessories(snap.accessories);
    },
    [lookIdx, rescan, showLook]
  );

  const handleUndo = useCallback(() => {
    if (histPtr <= 0) return;
    const nextPtr = histPtr - 1;
    setHistPtr(nextPtr);
    applySnapshot(history[nextPtr]);
  }, [applySnapshot, histPtr, history]);

  const handleRedo = useCallback(() => {
    if (histPtr >= history.length - 1) return;
    const nextPtr = histPtr + 1;
    setHistPtr(nextPtr);
    applySnapshot(history[nextPtr]);
  }, [applySnapshot, histPtr, history]);

  const handleReset = useCallback(() => {
    setFraming("full");
    const def: HistorySnapshot = {
      look: 0,
      grade: 0,
      real: 75,
      height: 168,
      build: 50,
      accessories: ["Gold hoops"],
    };
    applySnapshot(def);
    commitSnapshot(def);
    triggerToast("Reset to default");
  }, [applySnapshot, commitSnapshot, triggerToast]);

  // Keyboard shortcuts: Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, ArrowLeft, ArrowRight
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingName || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        pickLook((lookIdx - 1 + STUDIO_LOOKS.length) % STUDIO_LOOKS.length, true);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        pickLook((lookIdx + 1) % STUDIO_LOOKS.length, true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingName, handleRedo, handleUndo, lookIdx, pickLook]);

  // ==================== POINTER PARALLAX + DRAG-ONTO-AVATAR ====================
  const isPointOverModel = useCallback((clientX: number, clientY: number) => {
    const el = modelWrapRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const padX = 48;
    return (
      clientX >= rect.left - padX &&
      clientX <= rect.right + padX &&
      clientY >= rect.top - 20 &&
      clientY <= rect.bottom + 20
    );
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      if (rootRef.current) {
        rootRef.current.style.setProperty("--bx", `${(-x * 22).toFixed(2)}px`);
        rootRef.current.style.setProperty("--by", `${(-y * 12).toFixed(2)}px`);
        rootRef.current.style.setProperty("--mx", `${(x * 10).toFixed(2)}px`);
      }
      if (dragItem) {
        setDragItem((prev) =>
          prev ? { ...prev, x: e.clientX, y: e.clientY } : null
        );
        setOverAvatarDropZone(isPointOverModel(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!dragItem) return;
      const droppedOnAvatar = isPointOverModel(e.clientX, e.clientY);
      if (droppedOnAvatar) {
        if (dragItem.kind === "look" && dragItem.lookIndex !== undefined) {
          pickLook(dragItem.lookIndex, true);
          triggerToast(`Swiped onto avatar: ${dragItem.label}`);
        } else if (dragItem.kind === "accessory" && dragItem.accessoryName) {
          const name = dragItem.accessoryName;
          setEquippedAccessories((prev) => {
            const exists = prev.includes(name);
            const next = exists ? prev : [...prev, name];
            commitSnapshot({ accessories: next });
            return next;
          });
          rescan();
          triggerToast(`Equipped accessory: ${name}`);
        } else if (dragItem.kind === "scraped") {
          rescan();
          void fetch("/api/higgsfield", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "soul_tryon",
              modelImageUrl: H(STUDIO_LOOKS[lookIdx].file, 1000),
              garmentImageUrl: dragItem.scrapedImageUrl,
              prompt: `Photoreal virtual try-on of ${dragItem.label}`,
            }),
          })
            .then((r) => r.json())
            .then((res) => {
              triggerToast(res.message || `Applied ${dragItem.label} to avatar`);
            })
            .catch(() => {
              triggerToast(`Styled ${dragItem.label} onto avatar`);
            });
        }
      }
      setDragItem(null);
      setOverAvatarDropZone(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    commitSnapshot,
    dragItem,
    isPointOverModel,
    lookIdx,
    pickLook,
    rescan,
    triggerToast,
  ]);

  // ==================== CATEGORY FILTER STAGGER ====================
  const selectCategory = (cat: CategoryFilter) => {
    setCatFilter(cat);
    const nonMatching = new Set<number>();
    STUDIO_LOOKS.forEach((l) => {
      const friendPass =
        !activeFriendCloset || l.friendOwner === activeFriendCloset;
      const catPass = cat === "all" || l.category === cat;
      if (!catPass || !friendPass) nonMatching.add(l.index);
    });
    setHiddenCards(nonMatching);
  };

  useEffect(() => {
    selectCategory(catFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFriendCloset]);

  // ==================== IDENTITY SHUFFLE SCRAMBLE ====================
  const shuffleIdentity = useCallback(() => {
    setShuffleRot((r) => r + 180);
    const nextIdx = (identityIdx + 1) % IDENTITIES.length;
    setIdentityIdx(nextIdx);
    const target = IDENTITIES[nextIdx].name;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ";
    let frame = 0;
    const timer = setInterval(() => {
      frame++;
      if (frame >= 14) {
        clearInterval(timer);
        setCharName(target);
      } else {
        const scrambled = target
          .split("")
          .map((ch, idx) =>
            ch === " " || ch === "-"
              ? ch
              : idx < (frame / 14) * target.length
              ? ch
              : chars[Math.floor(Math.random() * chars.length)]
          )
          .join("");
        setCharName(scrambled);
      }
    }, 32);
  }, [identityIdx]);

  // ==================== RANDOMIZE ROULETTE ====================
  const handleRandomize = () => {
    setRandSpin((s) => s + 360);
    const visibleIndices = STUDIO_LOOKS.map((l) => l.index).filter(
      (idx) => !hiddenCards.has(idx)
    );
    const pool = visibleIndices.length > 0 ? visibleIndices : [0, 1, 2, 3, 4, 5, 6, 7];
    let step = 0;
    let delay = 50;

    const tick = () => {
      const candidate = pool[step % pool.length];
      setRouletteIdx(candidate);
      step++;
      if (step < 12) {
        delay += 8;
        setTimeout(tick, delay);
      } else {
        setTimeout(() => {
          setRouletteIdx(null);
          const others = STUDIO_LOOKS.map((l) => l.index).filter(
            (i) => i !== lookIdx
          );
          const chosen = others[Math.floor(Math.random() * others.length)];
          const nextGrade = Math.floor(Math.random() * 4);
          const nextReal = 55 + Math.floor(Math.random() * 45);
          setGradeIdx(nextGrade);
          setRealism(nextReal);
          void showLook(chosen);
          commitSnapshot({ look: chosen, grade: nextGrade, real: nextReal });
          triggerToast(`Randomized: ${STUDIO_LOOKS[chosen].name}`);
        }, 90);
      }
    };
    tick();
  };

  // ==================== SAVE TO LIBRARY FLYER ANIMATION ====================
  const handleSaveToLibrary = () => {
    setSaveShine(false);
    setTimeout(() => setSaveShine(true), 10);
    setLibOpen(true);

    const modelEl = modelWrapRef.current;
    const libRowEl = libRowRef.current;
    if (modelEl && libRowEl) {
      const mRect = modelEl.getBoundingClientRect();
      const lRect = libRowEl.getBoundingClientRect();
      const flyer = document.createElement("div");
      const startW = mRect.width * 0.5;
      const startH = mRect.height * 0.62;
      const startLeft = mRect.left + mRect.width * 0.25;
      const startTop = mRect.top + mRect.height * 0.14;

      const slotX = lRect.left + savedLibrary.length * 80 + 8;
      const slotY = lRect.top + 8;

      flyer.style.position = "fixed";
      flyer.style.left = `${startLeft}px`;
      flyer.style.top = `${startTop}px`;
      flyer.style.width = `${startW}px`;
      flyer.style.height = `${startH}px`;
      flyer.style.borderRadius = "14px";
      flyer.style.border = "1.5px solid rgba(255,255,255,0.85)";
      flyer.style.background = `rgba(38,36,40,0.45) url("${H(
        STUDIO_LOOKS[lookIdx].file,
        360
      )}") center top / cover no-repeat`;
      flyer.style.filter = SCENE_FILTERS[gradeIdx].grade;
      flyer.style.zIndex = "9999";
      flyer.style.pointerEvents = "none";
      flyer.style.transition = "all 0.8s cubic-bezier(0.7, 0, 0.2, 1)";
      document.body.appendChild(flyer);

      requestAnimationFrame(() => {
        flyer.style.left = `${slotX}px`;
        flyer.style.top = `${slotY}px`;
        flyer.style.width = `${72 * stageScaleRef.current}px`;
        flyer.style.height = `${104 * stageScaleRef.current}px`;
      });

      setTimeout(() => {
        flyer.remove();
        setSavedLibrary((prev) => [
          ...prev,
          { id: `lib-${Date.now()}`, look: lookIdx, grade: gradeIdx },
        ]);
        setLibBump(true);
        setTimeout(() => setLibBump(false), 400);
        triggerToast("Saved to library");
      }, 860);
    }
  };

  // ==================== STORY TYPEWRITER ====================
  const currentIdentity = IDENTITIES[identityIdx];
  const currentLook = STUDIO_LOOKS[lookIdx];

  const fullStoryText = useMemo(() => {
    const t1 = (traits[0] || "curious").toLowerCase();
    const t2 = (traits[1] || "creative").toLowerCase();
    const t3 = (traits[2] || "gentle").toLowerCase();
    return `${charName} is ${heightCm} cm of ${t1} energy from ${
      currentIdentity.city
    }. Mornings start with a long walk along the river in her ${currentLook.name.toLowerCase()} look; friends call her ${t2} and a little ${t3}. She collects film cameras, keeps a sketchbook of strangers' outfits, and is saving for a studio of her own.`;
  }, [charName, currentIdentity.city, currentLook.name, heightCm, traits]);

  useEffect(() => {
    if (activeTab !== "STORY") return;
    setTypedStory("");
    let idx = 0;
    const timer = setInterval(() => {
      idx += 2;
      setTypedStory(fullStoryText.slice(0, idx));
      if (idx >= fullStoryText.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [activeTab, fullStoryText]);

  // ==================== REALISM & BODY CSS VARIABLES ====================
  const kReal = Math.max(0, (80 - realism) / 80);
  const modelRealFilter = `saturate(${(1 + kReal * 0.9).toFixed(
    3
  )}) contrast(${(1 + kReal * 0.25).toFixed(3)}) blur(${(
    kReal * 1.4
  ).toFixed(2)}px) brightness(${(1 + kReal * 0.05).toFixed(3)})`;
  const bgRealFilter = `blur(${(kReal * 5).toFixed(2)}px) saturate(${(
    1 +
    kReal * 0.5
  ).toFixed(3)})`;

  const heightScale = 1 + ((heightCm - 168) / 168) * 0.9;
  const buildScale = 1 + ((buildVal - 50) / 50) * 0.07;

  // Face-crop helper (360x360 window of 1360x2048 at (500, 46))
  const getFaceCropStyle = (boxSize: number, lookFile: string) => {
    const k = boxSize / 360;
    return {
      backgroundImage: `url("${H(lookFile, 1000)}")`,
      backgroundSize: `${(1360 * k).toFixed(1)}px ${(2048 * k).toFixed(1)}px`,
      backgroundPosition: `${(-500 * k).toFixed(1)}px ${(-46 * k).toFixed(1)}px`,
      backgroundRepeat: "no-repeat",
    };
  };

  // Deterministic 5-axis Personality Radar (30..94)
  const radarValues = useMemo(() => {
    const seedStr = traits.join("|");
    const hashAt = (axis: number) => {
      let h = 2166136261 + axis * 97;
      for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return 30 + (Math.abs(h) % 65);
    };
    return [
      customOpenness ?? hashAt(0),
      customEnergy ?? hashAt(1),
      hashAt(2),
      hashAt(3),
      hashAt(4),
    ];
  }, [customEnergy, customOpenness, traits]);

  // Active Right-Panel View Resolver
  const activeRightView:
    | "Outfits"
    | "Tune"
    | "DNA"
    | "Body"
    | "Personality"
    | "Story" =
    activeTab === "DNA"
      ? "DNA"
      : activeTab === "BODY"
      ? "Body"
      : activeTab === "PERSONALITY"
      ? "Personality"
      : activeTab === "STORY"
      ? "Story"
      : sideKey === "Outfits"
      ? "Outfits"
      : sideKey === "Body"
      ? "Body"
      : "Tune";

  // Hotspots for current look + swiped accessories
  const hotspots = useMemo(() => {
    const p = currentLook.pieces;
    const pts: Array<{
      key: "tops" | "bottoms" | "full" | "shoes" | "acc";
      x: number;
      y: number;
      label: string;
    }> = [];
    if (p.tops.length > 0) {
      pts.push({
        key: "tops",
        x: 60,
        y: 24,
        label: `${p.tops[0].name} · ${p.tops[0].color} · $${p.tops[0].price}`,
      });
    }
    if (p.full.length > 0) {
      pts.push({
        key: "full",
        x: 60,
        y: 38,
        label: `${p.full[0].name} · ${p.full[0].color} · $${p.full[0].price}`,
      });
    }
    if (p.bottoms.length > 0) {
      pts.push({
        key: "bottoms",
        x: 38,
        y: 47,
        label: `${p.bottoms[0].name} · ${p.bottoms[0].color} · $${p.bottoms[0].price}`,
      });
    }
    if (p.shoes.length > 0) {
      pts.push({
        key: "shoes",
        x: 40,
        y: 95,
        label: `${p.shoes[0].name} · ${p.shoes[0].color} · $${p.shoes[0].price}`,
      });
    }
    const combinedAcc = [
      ...p.acc,
      ...ACCESSORY_CATALOG.filter(
        (ac) =>
          equippedAccessories.includes(ac.name) &&
          !p.acc.some((existing) => existing.name === ac.name)
      ),
    ];
    if (combinedAcc.length > 0) {
      pts.push({
        key: "acc",
        x: 56,
        y: 14,
        label: `${combinedAcc[0].name} · ${combinedAcc[0].color} · $${combinedAcc[0].price}`,
      });
    }
    return pts;
  }, [currentLook, equippedAccessories]);

  const toggleCartPiece = (piece: {
    name: string;
    color: string;
    price: number;
  }) => {
    const key = `${currentLook.index}:${piece.name}`;
    setCartPieces((prev) => {
      const exists = prev.some((p) => p.key === key);
      if (exists) {
        return prev.filter((p) => p.key !== key);
      }
      setCartBump(true);
      setTimeout(() => setCartBump(false), 400);
      triggerToast("Added to cart");
      return [
        ...prev,
        {
          key,
          ...piece,
          friendRef: currentLook.friendOwner
            ? `${currentLook.friendOwner.toUpperCase()}-GWO`
            : undefined,
        },
      ];
    });
  };

  const toggleFavLook = (idx: number) => {
    setFavLooks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      setFavBump(true);
      setTimeout(() => setFavBump(false), 400);
      return next;
    });
  };

  const startDrag = (
    e: React.PointerEvent,
    payload: Omit<DragPayload, "x" | "y">
  ) => {
    setDragItem({ ...payload, x: e.clientX, y: e.clientY });
  };

  const visibleLookCount = STUDIO_LOOKS.filter(
    (l) => !hiddenCards.has(l.index)
  ).length;

  const dnaSeed = `VL-0${423 + identityIdx * 37}-KR`;

  return (
    <div
      ref={rootRef}
      className="vell-root"
      style={
        {
          "--real": modelRealFilter,
          "--height": heightScale.toFixed(4),
          "--build": buildScale.toFixed(4),
        } as React.CSSProperties
      }
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("#vell-more-wrap")) setMoreOpen(false);
        if (!target.closest("#vell-filt-drop")) setFilterMenuOpen(false);
      }}
    >
      {/* ==================== SCENE LAYERS ==================== */}
      <div id="vell-scene">
        <div
          id="vell-grade"
          style={{ filter: SCENE_FILTERS[gradeIdx].grade }}
        >
          <div
            id="vell-bg"
            style={{
              backgroundImage: `url("${LOFT_BG_URL}")`,
              filter: bgRealFilter,
            }}
          />
          <div
            id="vell-tint"
            style={{ background: SCENE_FILTERS[gradeIdx].tint }}
          />
        </div>
        <div id="vell-vignette" />
      </div>

      {/* ==================== 1600x900 DESIGN STAGE ==================== */}
      <div id="vell-stage" ref={stageRef}>
        {/* ==================== 6. CENTER PHOTOREAL MODEL ==================== */}
        <div
          id="vell-modelWrap"
          ref={modelWrapRef}
          className={`${framing} ${overAvatarDropZone ? "drop-ready" : ""}`}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest(".vell-hotspot")) return;
            avatarSwipeStartXRef.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (avatarSwipeStartXRef.current === null) return;
            const dx = e.clientX - avatarSwipeStartXRef.current;
            avatarSwipeStartXRef.current = null;
            if (Math.abs(dx) > 42 && !dragItem) {
              const dir = dx < 0 ? 1 : -1;
              const next =
                (lookIdx + dir + STUDIO_LOOKS.length) % STUDIO_LOOKS.length;
              pickLook(next, true);
              triggerToast(`Swiped to ${STUDIO_LOOKS[next].name}`);
            }
          }}
        >
          <div id="vell-shadow" />
          <div id="vell-modelInner">
            <div id="vell-breath">
              <div id="vell-figs" ref={figsRef} />
              <div id="vell-scan" ref={scanRef} />

              {/* Hotspots (full framing only) */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: framing === "full" ? 1 : 0,
                  pointerEvents: framing === "full" ? "auto" : "none",
                  transition: "opacity 0.35s ease",
                }}
              >
                {hotspots.map((hs) => (
                  <button
                    key={hs.key}
                    type="button"
                    className="vell-hotspot"
                    style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                    onClick={() => {
                      setActiveTab("STYLE");
                      setSideKey("Outfits");
                      setOpenAccordion(hs.key);
                    }}
                  >
                    <span className="vell-hotspot-dot" />
                    <span className="vell-hotspot-tip">
                      <strong>{hs.label.split(" · ")[0]}</strong> ·{" "}
                      {hs.label.split(" · ").slice(1).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtle Worn Accessory Badges & Swipe Hint on Full Screen */}
          {framing === "full" && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                bottom: -30,
                display: "flex",
                gap: 6,
                alignItems: "center",
                whiteSpace: "nowrap",
                fontSize: 11,
                color: "rgba(255,255,255,0.72)",
                pointerEvents: "none",
              }}
            >
              <span>‹ Swipe avatar or drag clothes &amp; accessories here ›</span>
            </div>
          )}
        </div>

        {/* ==================== 7. TOP BAR ==================== */}
        {/* 4-Stroke Cursive GWO Logo + Baseline Subtitle at (30, 22) */}
        <div
          style={{
            position: "absolute",
            left: 30,
            top: 16,
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            zIndex: 40,
          }}
        >
          <GwoLogo
            height={54}
            className="text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.35)]"
          />
          <span
            style={{
              fontSize: 14,
              letterSpacing: "0.08em",
              color: "var(--ink-2)",
              fontWeight: 500,
              textTransform: "uppercase",
            }}
          >
            {activeFriendCloset
              ? `@${activeFriendCloset.toUpperCase()}'S CLOSET`
              : "VIRTUAL CLOSET STUDIO"}
          </span>
        </div>

        {/* Clean Top-Bar Bridge to Recommended Runway Lookbook */}
        <Link
          href="/shop"
          className="vell-glass hover:bg-white/20 transition"
          style={{
            left: 1146,
            top: 28,
            height: 42,
            padding: "0 16px",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: "#fff",
            textDecoration: "none",
            zIndex: 40,
          }}
        >
          Runway →
        </Link>

        {/* Top Sliding Tabs #tabs.glass (left: 410, top: 22, 720x54) */}
        <div
          className="vell-glass"
          style={{
            left: 410,
            top: 22,
            width: 720,
            height: 54,
            borderRadius: 30,
            padding: 4,
            display: "flex",
            alignItems: "center",
            zIndex: 40,
          }}
        >
          <div
            className="vell-pill-on"
            style={{
              position: "absolute",
              top: 4,
              height: 44,
              width: (720 - 8) / 5,
              left: 4 + TOP_TABS.indexOf(activeTab) * ((720 - 8) / 5),
              borderRadius: 24,
              transition:
                "left 0.55s cubic-bezier(0.7, 0, 0.2, 1), width 0.55s cubic-bezier(0.7, 0, 0.2, 1)",
              pointerEvents: "none",
            }}
          />
          {TOP_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                position: "relative",
                zIndex: 2,
                flex: 1,
                height: 44,
                borderRadius: 24,
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "0.05em",
                color: activeTab === tab ? "#fff" : "var(--ink-2)",
                transition: "color 0.25s ease",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Top-Right 4 Round 50px Glass Icon Buttons (right: 28, top: 24, gap: 12) */}
        <div
          id="vell-more-wrap"
          style={{
            position: "absolute",
            right: 28,
            top: 24,
            display: "flex",
            gap: 12,
            zIndex: 50,
          }}
        >
          {/* Cart */}
          <button
            type="button"
            onClick={() => setCartDrawerOpen((v) => !v)}
            className="vell-glass"
            style={{
              position: "relative",
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Outfit Cart & Friend Checkout"
          >
            <ShoppingBag className="w-[21px] h-[21px]" />
            <span
              className={`vell-badge ${cartPieces.length === 0 ? "zero" : ""} ${
                cartBump ? "bump" : ""
              }`}
            >
              {cartPieces.length}
            </span>
          </button>

          {/* Heart / Favourites */}
          <button
            type="button"
            onClick={() => toggleFavLook(lookIdx)}
            className="vell-glass"
            style={{
              position: "relative",
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Favourite Current Look"
          >
            <Heart
              className="w-[21px] h-[21px]"
              fill={favLooks.has(lookIdx) ? "#ffffff" : "none"}
            />
            <span
              className={`vell-badge ${favLooks.size === 0 ? "zero" : ""} ${
                favBump ? "bump" : ""
              }`}
            >
              {favLooks.size}
            </span>
          </button>

          {/* Bag / Library */}
          <button
            type="button"
            onClick={() => setLibOpen((v) => !v)}
            className="vell-glass"
            style={{
              position: "relative",
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Saved Closet Library"
          >
            <Layers className="w-[21px] h-[21px]" />
            <span
              className={`vell-badge ${savedLibrary.length === 0 ? "zero" : ""} ${
                libBump ? "bump" : ""
              }`}
            >
              {savedLibrary.length}
            </span>
          </button>

          {/* More (•••) */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="vell-glass"
            style={{
              position: "relative",
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Friend Closets, Firecrawl URL Import & Studio Actions"
          >
            <MoreHorizontal className="w-[22px] h-[22px]" />
          </button>

          {/* More Dropdown Menu */}
          <div
            className="vell-glass"
            style={{
              right: 0,
              top: 60,
              width: 235,
              padding: 8,
              borderRadius: 18,
              transformOrigin: "top right",
              transform: moreOpen ? "scale(1)" : "scale(0.9)",
              opacity: moreOpen ? 1 : 0,
              pointerEvents: moreOpen ? "auto" : "none",
              transition: "transform 0.22s ease, opacity 0.22s ease",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setGwoDrawer("friends");
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                textAlign: "left",
                fontSize: 13.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              className="hover:bg-white/15"
            >
              <Users className="w-4 h-4" /> Girls&apos; Shared Closets
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setGwoDrawer("firecrawl");
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                textAlign: "left",
                fontSize: 13.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              className="hover:bg-white/15"
            >
              <Link2 className="w-4 h-4" /> Import URL (Firecrawl)
            </button>
            <button
              type="button"
              onClick={async () => {
                setMoreOpen(false);
                rescan();
                const res = await fetch("/api/higgsfield", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    mode: "orbit_360",
                    modelImageUrl: H(currentLook.file, 1000),
                  }),
                }).then((r) => r.json());
                triggerToast(res.message || "360° Higgsfield Orbit triggered");
              }}
              style={{
                padding: "9px 12px",
                borderRadius: 12,
                textAlign: "left",
                fontSize: 13.5,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              className="hover:bg-white/15"
            >
              <Sparkles className="w-4 h-4" /> Higgsfield 360° Orbit
            </button>
            <div style={{ height: 1, background: "rgba(255,255,255,0.18)", margin: "3px 6px" }} />
            <button
              type="button"
              onClick={async () => {
                setMoreOpen(false);
                await shareMyClosetAndClaimBonus();
                triggerToast("Share link copied (+3 free tries)");
              }}
              style={{ padding: "8px 12px", borderRadius: 12, textAlign: "left", fontSize: 13.5 }}
              className="hover:bg-white/15"
            >
              Share look &amp; closet
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                triggerToast("Exported 4K render");
              }}
              style={{ padding: "8px 12px", borderRadius: 12, textAlign: "left", fontSize: 13.5 }}
              className="hover:bg-white/15"
            >
              Export render
            </button>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                triggerToast("Duplicated as new GWO look");
              }}
              style={{ padding: "8px 12px", borderRadius: 12, textAlign: "left", fontSize: 13.5 }}
              className="hover:bg-white/15"
            >
              Duplicate
            </button>
            <Link
              href="/friends"
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                textAlign: "left",
                fontSize: 13,
                color: "var(--ink-2)",
              }}
              className="hover:bg-white/15"
            >
              $100/mo Guardrail Telemetry →
            </Link>
          </div>
        </div>

        {/* ==================== 8. PROFILE CARD (#profile.glass: 24, 96, 476x124) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 24,
            top: 96,
            width: 476,
            height: 124,
            display: "flex",
            alignItems: "center",
            gap: 20,
            padding: "0 16px",
            zIndex: 30,
          }}
        >
          {/* 98x98 Live Face Crop of Current Look */}
          <div
            style={{
              width: 98,
              height: 98,
              borderRadius: 18,
              border: "1.5px solid rgba(255,255,255,0.85)",
              boxShadow: "0 0 18px rgba(255,255,255,0.28)",
              flexShrink: 0,
              ...getFaceCropStyle(98, currentLook.file),
            }}
          />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                ref={nameEditableRef}
                contentEditable={editingName}
                suppressContentEditableWarning
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    setEditingName(false);
                    setCharName(e.currentTarget.textContent?.trim() || charName);
                    triggerToast("Name updated");
                  }
                }}
                style={{
                  fontSize: 26,
                  fontWeight: 400,
                  lineHeight: 1.15,
                  padding: editingName ? "2px 8px" : "2px 0",
                  borderRadius: 8,
                  outline: "none",
                  border: editingName ? "1px solid #fff" : "1px solid transparent",
                  background: editingName ? "rgba(255,255,255,0.14)" : "transparent",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {charName}
              </span>

              <button
                type="button"
                onClick={() => {
                  if (editingName) {
                    setEditingName(false);
                    if (nameEditableRef.current?.textContent) {
                      setCharName(nameEditableRef.current.textContent.trim());
                    }
                    triggerToast("Name updated");
                  } else {
                    setEditingName(true);
                    setTimeout(() => {
                      const el = nameEditableRef.current;
                      if (!el) return;
                      el.focus();
                      const range = document.createRange();
                      range.selectNodeContents(el);
                      const sel = window.getSelection();
                      sel?.removeAllRanges();
                      sel?.addRange(range);
                    }, 20);
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--glass-2)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                title="Edit Name"
              >
                <Pencil className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={shuffleIdentity}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--glass-2)",
                  border: "1px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transform: `rotate(${shuffleRot}deg)`,
                  transition: "transform 0.5s cubic-bezier(0.3, 0.8, 0.2, 1)",
                }}
                title="Shuffle Studio Identity"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            </div>

            {/* Meta Row + Quick Girls' Closet Pill */}
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 11,
                fontSize: 15,
                color: "var(--ink-2)",
                position: "relative",
              }}
            >
              <span>{currentIdentity.age}</span>
              <span style={{ width: 1, height: 15, background: "var(--line)" }} />
              <span>{currentIdentity.city}</span>
              <span style={{ width: 1, height: 15, background: "var(--line)" }} />
              <span
                onMouseEnter={() => setWeatherHover(true)}
                onMouseLeave={() => setWeatherHover(false)}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "default" }}
              >
                <Cloud className="w-4 h-4" /> {currentIdentity.temp}
              </span>
              <button
                type="button"
                onClick={() => setGwoDrawer("friends")}
                style={{
                  marginLeft: "auto",
                  padding: "3px 9px",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  color: "#fff",
                }}
              >
                {activeFriendCloset ? `@${activeFriendCloset} ✓` : "Friends"}
              </button>

              {weatherHover && (
                <div
                  style={{
                    position: "absolute",
                    left: 150,
                    top: 28,
                    padding: "5px 10px",
                    borderRadius: 10,
                    fontSize: 12,
                    background: "rgba(24,24,28,0.82)",
                    border: "1px solid var(--line)",
                    color: "#fff",
                    whiteSpace: "nowrap",
                    zIndex: 50,
                  }}
                >
                  Overcast · soft daylight
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ==================== 9. STYLE MENU (#side.glass: 24, 236, 172x470) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 24,
            top: 236,
            width: 172,
            height: 470,
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            zIndex: 30,
            transform: activeTab === "STYLE" ? "translateX(0)" : "translateX(-240px)",
            transition: "transform 0.6s cubic-bezier(0.7, 0, 0.2, 1)",
          }}
        >
          <div
            className="vell-pill-on"
            style={{
              position: "absolute",
              left: 10,
              width: 152,
              height: 54,
              borderRadius: 16,
              top: 10 + SIDE_ITEMS.indexOf(sideKey) * 56,
              transition: "top 0.45s cubic-bezier(0.7, 0, 0.2, 1)",
              pointerEvents: "none",
            }}
          />
          {SIDE_ITEMS.map((item) => {
            const active = sideKey === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setSideKey(item)}
                style={{
                  position: "relative",
                  zIndex: 2,
                  height: 54,
                  borderRadius: 16,
                  padding: "0 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 15.5,
                  fontWeight: active ? 500 : 400,
                  color: active ? "#fff" : "var(--ink-2)",
                }}
              >
                <Sliders className="w-[18px] h-[18px] opacity-85" />
                <span>{item}</span>
              </button>
            );
          })}
        </div>

        {/* Randomize Button (#rand.glass: 24, 722, 220x52) */}
        <button
          type="button"
          onClick={handleRandomize}
          className="vell-glass"
          style={{
            left: 24,
            top: 722,
            width: 220,
            height: 52,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 15,
            fontWeight: 500,
            zIndex: 30,
            transform: activeTab === "STYLE" ? "translateX(0)" : "translateX(-280px)",
            transition: "transform 0.6s cubic-bezier(0.7, 0, 0.2, 1)",
          }}
        >
          <RefreshIcon deg={randSpin} />
          <span>Randomize GWO</span>
        </button>

        {/* ==================== 10. RIGHT PANEL (#panel.glass: 1112, 96, 464x680) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 1112,
            top: 96,
            width: 464,
            height: 680,
            padding: "22px 18px 18px",
            overflow: "hidden",
            zIndex: 30,
          }}
        >
          {/* ---------- 10.1 OUTFITS VIEW ---------- */}
          <PanelView active={activeRightView === "Outfits"}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                OUTFITS
              </h3>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {visibleLookCount} {visibleLookCount === 1 ? "look" : "looks"} · drag to avatar
              </span>
            </div>

            {/* 7 Category Chips */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
              {CATEGORY_CHIPS.map((c) => {
                const on = catFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCategory(c.id)}
                    style={{
                      width: 58,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: "var(--glass-2)",
                        border: "1px solid var(--line)",
                        boxShadow: on ? "var(--glow)" : "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {c.label.slice(0, 2).toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: on ? "#fff" : "var(--ink-2)" }}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 4x2 Draggable Outfit Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 9,
                height: 284,
                marginTop: 12,
                alignContent: "start",
              }}
            >
              {STUDIO_LOOKS.map((look) => {
                if (hiddenCards.has(look.index)) return null;
                const isOn = lookIdx === look.index;
                const isFav = favLooks.has(look.index);
                const isRoulette = rouletteIdx === look.index;

                return (
                  <div
                    key={look.index}
                    className={`vell-look-card ${isOn ? "on" : ""} ${
                      isRoulette ? "roulette" : ""
                    }`}
                    onClick={() => pickLook(look.index)}
                    onDoubleClick={() => toggleFavLook(look.index)}
                    onPointerDown={(e) =>
                      startDrag(e, {
                        kind: "look",
                        label: look.name,
                        sublabel: `@${look.friendOwner}'s Closet`,
                        lookIndex: look.index,
                      })
                    }
                  >
                    <div
                      className="vell-look-im"
                      style={{ backgroundImage: `url("${H(look.file, 360)}")` }}
                    />
                    {/* Top-left friend badge */}
                    {look.friendOwner && (
                      <span
                        style={{
                          position: "absolute",
                          top: 6,
                          left: 6,
                          padding: "2px 6px",
                          borderRadius: 999,
                          fontSize: 9.5,
                          fontWeight: 600,
                          background: "rgba(24,23,28,0.55)",
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        @{look.friendOwner}
                      </span>
                    )}
                    {/* Top-right heart badge */}
                    <span
                      style={{
                        position: "absolute",
                        top: 6,
                        right: 6,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.28)",
                        backdropFilter: "blur(8px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transform: isFav ? "scale(1)" : "scale(0)",
                        transition: "transform 0.3s cubic-bezier(0.3, 1.8, 0.5, 1)",
                      }}
                    >
                      <Heart className="w-3 h-3" fill="#fff" />
                    </span>
                    <span className="vell-look-tag">{look.name}</span>
                  </div>
                );
              })}
            </div>

            {/* 5-Row Piece Accordion (margin-top: auto) */}
            <div
              style={{
                marginTop: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              {(
                [
                  { key: "tops", title: "TOPS", list: currentLook.pieces.tops },
                  { key: "bottoms", title: "BOTTOMS", list: currentLook.pieces.bottoms },
                  { key: "full", title: "FULL BODY", list: currentLook.pieces.full },
                  { key: "shoes", title: "SHOES", list: currentLook.pieces.shoes },
                  {
                    key: "acc",
                    title: "ACCESSORIES",
                    list: [
                      ...currentLook.pieces.acc,
                      ...ACCESSORY_CATALOG.filter(
                        (a) =>
                          equippedAccessories.includes(a.name) &&
                          !currentLook.pieces.acc.some((x) => x.name === a.name)
                      ).map((a) => ({ name: a.name, color: a.color, price: a.price })),
                    ],
                  },
                ] as const
              ).map((row) => {
                const isOpen = openAccordion === row.key;
                return (
                  <div
                    key={row.key}
                    style={{
                      borderRadius: 12,
                      background: "var(--glass-2)",
                      border: "1px solid var(--line)",
                      overflow: "hidden",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenAccordion(row.key)}
                      style={{
                        width: "100%",
                        height: 33,
                        padding: "0 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: 13,
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span>
                        {row.title}{" "}
                        <span style={{ color: "var(--ink-3)", fontSize: 12 }}>
                          · {row.list.length}
                        </span>
                      </span>
                      <ChevronDown
                        className="w-4 h-4"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.35s ease",
                        }}
                      />
                    </button>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateRows: isOpen ? "1fr" : "0fr",
                        transition:
                          "grid-template-rows 0.4s cubic-bezier(0.7, 0, 0.2, 1)",
                      }}
                    >
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ padding: "0 12px 9px", display: "flex", flexDirection: "column", gap: 6 }}>
                          {row.list.length === 0 ? (
                            <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>
                              Nothing in this look
                            </span>
                          ) : (
                            row.list.map((piece) => {
                              const inCart = cartPieces.some(
                                (c) => c.key === `${currentLook.index}:${piece.name}`
                              );
                              return (
                                <div
                                  key={piece.name}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    fontSize: 13,
                                    cursor: "grab",
                                  }}
                                  onPointerDown={(e) =>
                                    startDrag(e, {
                                      kind: row.key === "acc" ? "accessory" : "look",
                                      label: piece.name,
                                      sublabel: `${piece.color} · $${piece.price}`,
                                      lookIndex: currentLook.index,
                                      accessoryName:
                                        row.key === "acc" ? piece.name : undefined,
                                    })
                                  }
                                >
                                  <Link
                                    href={`/product?name=${encodeURIComponent(
                                      piece.name
                                    )}&price=${encodeURIComponent(
                                      `$${piece.price}`
                                    )}`}
                                    onPointerDown={(e) => e.stopPropagation()}
                                    title="Open 360° Spin Product Details"
                                    style={{
                                      flex: 1,
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      color: "inherit",
                                      textDecoration: "none",
                                    }}
                                    className="hover:underline"
                                  >
                                    {piece.name}{" "}
                                    <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                                      {piece.color}
                                    </span>
                                  </Link>
                                  <span style={{ fontWeight: 600 }}>${piece.price}</span>
                                  <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={() => toggleCartPiece(piece)}
                                    style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: "50%",
                                      background: inCart ? "#fff" : "rgba(255,255,255,0.14)",
                                      color: inCart ? "#18171c" : "#fff",
                                      border: "1px solid var(--line)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    {inCart ? (
                                      <Check className="w-3.5 h-3.5" />
                                    ) : (
                                      <Plus className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelView>

          {/* ---------- 10.2 TUNE VIEW (Face, Hair, Makeup, Accessories, Tattoos, Details) ---------- */}
          <PanelView active={activeRightView === "Tune"}>
            {sideKey !== "Outfits" && sideKey !== "Body" && (
              <>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                  <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {sideKey}
                  </h3>
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {sideKey === "Accessories"
                      ? "drag or tap to equip on avatar"
                      : "changes re-render the model"}
                  </span>
                </div>

                {/* Optional Swatches */}
                {TUNE_CONFIG[sideKey].swatches && (
                  <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                    {TUNE_CONFIG[sideKey].swatches!.map((hex) => {
                      const active = tuneSwatches[sideKey] === hex;
                      return (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setTuneSwatches((p) => ({ ...p, [sideKey]: hex }));
                            rescan();
                          }}
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: "50%",
                            background: hex,
                            border: active
                              ? "3px solid #ffffff"
                              : "1px solid rgba(255,255,255,0.4)",
                          }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Preset Chips (Draggable when Accessories!) */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 18 }}>
                  {TUNE_CONFIG[sideKey].presets.map((preset) => {
                    const isMulti = TUNE_CONFIG[sideKey].multiSelect;
                    const on = isMulti
                      ? equippedAccessories.includes(preset)
                      : tunePresets[sideKey] === preset;

                    return (
                      <button
                        key={preset}
                        type="button"
                        onPointerDown={
                          isMulti
                            ? (e) =>
                                startDrag(e, {
                                  kind: "accessory",
                                  label: preset,
                                  sublabel: "Drag onto avatar",
                                  accessoryName: preset,
                                })
                            : undefined
                        }
                        onClick={() => {
                          if (isMulti) {
                            setEquippedAccessories((prev) => {
                              const next = prev.includes(preset)
                                ? prev.filter((x) => x !== preset)
                                : [...prev, preset];
                              commitSnapshot({ accessories: next });
                              return next;
                            });
                          } else {
                            setTunePresets((p) => ({ ...p, [sideKey]: preset }));
                          }
                          rescan();
                          triggerToast(`${sideKey}: ${preset}`);
                        }}
                        style={{
                          borderRadius: 12,
                          padding: "9px 14px",
                          fontSize: 14,
                          background: "var(--glass-2)",
                          border: "1px solid var(--line)",
                          boxShadow: on ? "var(--glow)" : "none",
                        }}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                {/* Sliders */}
                <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 24 }}>
                  {TUNE_CONFIG[sideKey].sliders.map((sl) => {
                    const k = `${sideKey}:${sl.name}`;
                    const val = tuneSliders[k] ?? sl.defaultVal;
                    return (
                      <StudioSlider
                        key={k}
                        label={sl.name}
                        value={val}
                        min={0}
                        max={100}
                        suffix="%"
                        onChange={(v) => setTuneSliders((p) => ({ ...p, [k]: v }))}
                        onRelease={() => rescan()}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </PanelView>

          {/* ---------- 10.3 DNA VIEW ---------- */}
          <PanelView active={activeRightView === "DNA"}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em" }}>DNA</h3>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>identity seed</span>
            </div>

            {/* 300x120 Animated 26-Rung Double Helix SVG */}
            <div style={{ display: "flex", justifyContent: "center", margin: "18px 0" }}>
              <svg width={300} height={120} viewBox="0 0 300 120">
                {Array.from({ length: 26 }).map((_, i) => {
                  const x = 12 + i * 11;
                  const s = Math.sin(i * 0.42 + helixPhase);
                  const depth = (Math.cos(i * 0.42 + helixPhase) + 1) / 2;
                  const y1 = 60 + s * 38;
                  const y2 = 60 - s * 38;
                  const r1 = 2 + depth * 2.4;
                  const r2 = 2 + (1 - depth) * 2.4;
                  return (
                    <g key={i}>
                      <line
                        x1={x}
                        y1={y1}
                        x2={x}
                        y2={y2}
                        stroke={`rgba(255,255,255,${(0.15 + depth * 0.25).toFixed(2)})`}
                        strokeWidth={1.2}
                      />
                      <circle
                        cx={x}
                        cy={y1}
                        r={r1}
                        fill={`rgba(255,255,255,${(0.4 + depth * 0.6).toFixed(2)})`}
                      />
                      <circle
                        cx={x}
                        cy={y2}
                        r={r2}
                        fill={`rgba(255,255,255,${(0.4 + (1 - depth) * 0.6).toFixed(2)})`}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div style={{ display: "flex", flexDirection: "column", fontSize: 15 }}>
              {[
                ["Seed", dnaSeed],
                ["Heritage", "Korean"],
                ["Age", String(currentIdentity.age)],
                ["Eye colour", "Dark brown"],
                ["Hair", "Black · high bun"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "13px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.18)",
                  }}
                >
                  <span style={{ color: "var(--ink-2)" }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                shuffleIdentity();
                rescan();
              }}
              style={{
                marginTop: "auto",
                height: 46,
                borderRadius: 14,
                border: "1.5px solid #fff",
                fontSize: 15,
                fontWeight: 500,
              }}
              className="hover:bg-white hover:text-[#18171c] transition"
            >
              Re-seed identity
            </button>
          </PanelView>

          {/* ---------- 10.4 BODY VIEW ---------- */}
          <PanelView active={activeRightView === "Body"}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em" }}>BODY</h3>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>proportions &amp; camera</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 22 }}>
              <StudioSlider
                label="Height (cm)"
                value={heightCm}
                min={150}
                max={185}
                suffix=" cm"
                onChange={setHeightCm}
                onRelease={() => commitSnapshot({ height: heightCm })}
              />
              <StudioSlider
                label="Build"
                value={buildVal}
                min={0}
                max={100}
                suffix="%"
                onChange={setBuildVal}
                onRelease={() => commitSnapshot({ build: buildVal })}
              />

              <div>
                <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                  Posture
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Relaxed", "Confident", "Editorial"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPosture(p);
                        rescan();
                      }}
                      style={{
                        flex: 1,
                        padding: "9px 10px",
                        borderRadius: 12,
                        fontSize: 13.5,
                        background: "var(--glass-2)",
                        border: "1px solid var(--line)",
                        boxShadow: posture === p ? "var(--glow)" : "none",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
                  Framing
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {(
                    [
                      ["full", "Full body"],
                      ["mid", "Mid shot"],
                      ["portrait", "Portrait"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFraming(id)}
                      style={{
                        flex: 1,
                        padding: "9px 10px",
                        borderRadius: 12,
                        fontSize: 13.5,
                        background: "var(--glass-2)",
                        border: "1px solid var(--line)",
                        boxShadow: framing === id ? "var(--glow)" : "none",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PanelView>

          {/* ---------- 10.5 PERSONALITY VIEW ---------- */}
          <PanelView active={activeRightView === "Personality"}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em" }}>
                PERSONALITY
              </h3>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>pick up to 3</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              {PERSONALITY_TRAITS.map((tr) => {
                const on = traits.includes(tr);
                return (
                  <button
                    key={tr}
                    type="button"
                    onClick={() => {
                      setCustomOpenness(null);
                      setCustomEnergy(null);
                      setTraits((prev) => {
                        if (prev.includes(tr)) {
                          return prev.length > 1 ? prev.filter((x) => x !== tr) : prev;
                        }
                        if (prev.length >= 3) {
                          return [...prev.slice(1), tr];
                        }
                        return [...prev, tr];
                      });
                    }}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 12,
                      fontSize: 13.5,
                      background: "var(--glass-2)",
                      border: "1px solid var(--line)",
                      boxShadow: on ? "var(--glow)" : "none",
                    }}
                  >
                    {tr}
                  </button>
                );
              })}
            </div>

            {/* 250x210 Pentagon Radar SVG */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <PersonalityRadar values={radarValues} />
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <StudioSlider
                label="Openness"
                value={radarValues[0]}
                min={30}
                max={94}
                suffix=""
                onChange={setCustomOpenness}
              />
              <StudioSlider
                label="Energy"
                value={radarValues[1]}
                min={30}
                max={94}
                suffix=""
                onChange={setCustomEnergy}
              />
            </div>
          </PanelView>

          {/* ---------- 10.6 STORY VIEW ---------- */}
          <PanelView active={activeRightView === "Story"}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <h3 style={{ fontSize: 17, fontWeight: 400, letterSpacing: "0.06em" }}>STORY</h3>
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                auto-written from your choices
              </span>
            </div>

            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 16,
                background: "var(--glass-2)",
                border: "1px solid var(--line)",
                fontSize: 16,
                lineHeight: 1.6,
                minHeight: 240,
              }}
            >
              {typedStory}
              <span className="vell-caret" />
            </div>

            <button
              type="button"
              onClick={() => {
                const shuffled = [...PERSONALITY_TRAITS].sort(
                  () => Math.random() - 0.5
                );
                setTraits(shuffled.slice(0, 3));
              }}
              style={{
                marginTop: "auto",
                height: 46,
                borderRadius: 14,
                border: "1.5px solid #fff",
                fontSize: 15,
                fontWeight: 500,
              }}
              className="hover:bg-white hover:text-[#18171c] transition"
            >
              Rewrite story
            </button>
          </PanelView>
        </div>

        {/* ==================== FULL-STAGE SWIPEABLE WARDROBE & ACCESSORY RACK ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 504,
            top: 618,
            width: 592,
            height: 114,
            padding: "10px 14px",
            borderRadius: 20,
            zIndex: 34,
            transform:
              swipeRackOpen && !libOpen
                ? "translateY(0) scale(1)"
                : "translateY(18px) scale(0.97)",
            opacity: swipeRackOpen && !libOpen ? 1 : 0,
            pointerEvents: swipeRackOpen && !libOpen ? "auto" : "none",
            transition: "transform 0.38s ease, opacity 0.35s ease",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--ink-2)",
                fontWeight: 600,
              }}
            >
              SWIPE &amp; DRAG RACK · DRAG CLOTHES OR ACCESSORIES UP ONTO AVATAR
            </span>
            <button
              type="button"
              onClick={() => setSwipeRackOpen(false)}
              style={{ fontSize: 11, color: "var(--ink-3)" }}
            >
              Hide
            </button>
          </div>

          <div className="vell-swipe-track">
            {/* Accessories first so users can swipe/drag accessories directly onto avatar */}
            {ACCESSORY_CATALOG.map((acc) => {
              const eq = equippedAccessories.includes(acc.name);
              return (
                <div
                  key={acc.id}
                  className={`vell-swipe-item ${eq ? "equipped" : ""}`}
                  onPointerDown={(e) =>
                    startDrag(e, {
                      kind: "accessory",
                      label: acc.name,
                      sublabel: `$${acc.price} · ${acc.color}`,
                      accessoryName: acc.name,
                    })
                  }
                  onClick={() => {
                    setEquippedAccessories((prev) => {
                      const next = prev.includes(acc.name)
                        ? prev.filter((x) => x !== acc.name)
                        : [...prev, acc.name];
                      commitSnapshot({ accessories: next });
                      return next;
                    });
                    rescan();
                    triggerToast(`Swiped ${acc.name} onto avatar`);
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>
                    Accessory · ${acc.price}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {acc.name}
                  </div>
                </div>
              );
            })}

            {/* Outfits & Scraped Store Pieces */}
            {STUDIO_LOOKS.map((lk) => (
              <div
                key={`swipe-lk-${lk.index}`}
                className={`vell-swipe-item ${lookIdx === lk.index ? "equipped" : ""}`}
                onPointerDown={(e) =>
                  startDrag(e, {
                    kind: "look",
                    label: lk.name,
                    sublabel: `@${lk.friendOwner} · ${lk.category}`,
                    lookIndex: lk.index,
                  })
                }
                onClick={() => pickLook(lk.index)}
              >
                <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>
                  @{lk.friendOwner} · {lk.category}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lk.name}
                </div>
              </div>
            ))}

            {/* Community Firecrawl Scraped Store Items */}
            {products
              .filter((p) => p.sourceType === "scraped_url")
              .slice(0, 6)
              .map((prod) => (
                <div
                  key={prod.id}
                  className="vell-swipe-item"
                  onPointerDown={(e) =>
                    startDrag(e, {
                      kind: "scraped",
                      label: prod.title,
                      sublabel: `${prod.brand} · $${prod.price}`,
                      scrapedImageUrl: prod.imageUrl,
                    })
                  }
                  onClick={() => {
                    rescan();
                    triggerToast(`Tried on ${prod.brand} ${prod.title}`);
                  }}
                >
                  <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase" }}>
                    {prod.brand} · ${prod.price}
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {prod.title}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* ==================== 11.5 LIBRARY DRAWER (#lib.glass: 504, 560, 592x170) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 504,
            top: 560,
            width: 592,
            height: 170,
            padding: "14px 18px",
            zIndex: 38,
            transform: libOpen
              ? "translateY(0) scale(1)"
              : "translateY(20px) scale(0.97)",
            opacity: libOpen ? 1 : 0,
            pointerEvents: libOpen ? "auto" : "none",
            transition: "transform 0.4s ease, opacity 0.4s ease",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ fontSize: 15, letterSpacing: "0.06em" }}>LIBRARY</h3>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {savedLibrary.length} saved
            </span>
          </div>

          <div
            ref={libRowRef}
            style={{
              marginTop: 10,
              display: "flex",
              gap: 8,
              overflowX: "auto",
              minHeight: 108,
              alignItems: "center",
            }}
          >
            {savedLibrary.length === 0 ? (
              <span style={{ fontSize: 13.5, color: "var(--ink-3)" }}>
                Save a look to start your library.
              </span>
            ) : (
              savedLibrary.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setGradeIdx(entry.grade);
                    pickLook(entry.look, true);
                  }}
                  style={{
                    width: 72,
                    height: 104,
                    borderRadius: 12,
                    border: "1px solid var(--line-strong)",
                    background: `rgba(255,255,255,0.14) url("${H(
                      STUDIO_LOOKS[entry.look].file,
                      360
                    )}") center top / cover no-repeat`,
                    filter: SCENE_FILTERS[entry.grade].grade,
                    flexShrink: 0,
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* ==================== 11.1 CONTROL BAR (#ctrl.glass: 504, 742, 592x54) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 504,
            top: 742,
            width: 592,
            height: 54,
            borderRadius: 18,
            padding: 5,
            display: "flex",
            gap: 6,
            zIndex: 35,
          }}
        >
          <button
            type="button"
            disabled={histPtr <= 0}
            onClick={handleUndo}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontSize: 15.5,
            }}
          >
            <Undo2 className="w-4 h-4" /> Undo
          </button>

          <button
            type="button"
            disabled={histPtr >= history.length - 1}
            onClick={handleRedo}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 9,
              fontSize: 15.5,
            }}
          >
            <Redo2 className="w-4 h-4" /> Redo
          </button>

          <button
            type="button"
            onClick={() =>
              setFraming((f) =>
                f === "full" ? "mid" : f === "mid" ? "portrait" : "full"
              )
            }
            style={{
              flex: 1,
              height: 44,
              borderRadius: 13,
              boxShadow: "var(--glow)",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 15.5,
            }}
          >
            Pose:{" "}
            {framing === "full" ? "Full" : framing === "mid" ? "Mid" : "Portrait"}
          </button>

          <button
            type="button"
            onClick={() => setSwipeRackOpen((v) => !v)}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 13,
              boxShadow: swipeRackOpen ? "var(--glow)" : "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontSize: 15,
            }}
          >
            Swipe Rack
          </button>

          <button
            type="button"
            onClick={handleReset}
            style={{
              flex: 0.85,
              height: 44,
              borderRadius: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              fontSize: 15,
            }}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>

        {/* ==================== 11.2 REALISM (#real.glass: 24, 796, 452x88) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 24,
            top: 796,
            width: 452,
            height: 88,
            padding: "14px 20px",
            zIndex: 35,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, marginBottom: 8 }}>
            <span>Realism</span>
            <span style={{ fontWeight: 600 }}>{realism}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={realism}
            onChange={(e) => setRealism(Number(e.target.value))}
            onPointerUp={() => commitSnapshot({ real: realism })}
            className="vell-slider"
            style={{ "--p": `${realism}%` } as React.CSSProperties}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12.5,
              color: "var(--ink-3)",
              marginTop: 5,
            }}
          >
            <span>Stylized</span>
            <span>Hyper Realistic</span>
          </div>
        </div>

        {/* ==================== 11.3 FILTER (#filt.glass: 494, 796, 640x88) ==================== */}
        <div
          id="vell-filt-drop"
          className="vell-glass"
          style={{
            left: 494,
            top: 796,
            width: 640,
            height: 88,
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            zIndex: 35,
          }}
        >
          <div style={{ position: "relative", width: 156, flexShrink: 0 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginBottom: 4 }}>
              Filter
            </div>
            <button
              type="button"
              onClick={() => setFilterMenuOpen((v) => !v)}
              style={{
                width: 156,
                height: 38,
                padding: "0 12px",
                borderRadius: 12,
                background: "var(--glass-2)",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 14,
              }}
            >
              <span>{SCENE_FILTERS[gradeIdx].name}</span>
              <ChevronDown
                className="w-4 h-4"
                style={{
                  transform: filterMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.25s ease",
                }}
              />
            </button>

            {filterMenuOpen && (
              <div
                className="vell-glass"
                style={{
                  left: 0,
                  bottom: 46,
                  width: 170,
                  padding: 6,
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  zIndex: 60,
                }}
              >
                {SCENE_FILTERS.map((f, idx) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => {
                      setGradeIdx(idx);
                      setFilterMenuOpen(false);
                      commitSnapshot({ grade: idx });
                    }}
                    style={{
                      padding: "7px 11px",
                      borderRadius: 10,
                      textAlign: "left",
                      fontSize: 13.5,
                      background:
                        gradeIdx === idx ? "rgba(255,255,255,0.18)" : "transparent",
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 5 Live 64x64 Face-Crop Filter Thumbnails */}
          <div
            style={{
              display: "flex",
              gap: 10,
              transform: filterNudge ? "translateX(-14px)" : "translateX(0)",
              transition: filterNudge ? "none" : "transform 0.35s ease",
            }}
          >
            {Array.from({ length: 5 }).map((_, slot) => {
              const fIdx = (filterOffset + slot) % SCENE_FILTERS.length;
              const f = SCENE_FILTERS[fIdx];
              const on = gradeIdx === fIdx;
              return (
                <button
                  key={`${f.name}-${slot}`}
                  type="button"
                  onClick={() => {
                    setGradeIdx(fIdx);
                    commitSnapshot({ grade: fIdx });
                  }}
                  title={f.name}
                  style={{
                    position: "relative",
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--line)",
                    boxShadow: on ? "var(--glow)" : "none",
                    filter: f.grade,
                    ...getFaceCropStyle(64, currentLook.file),
                  }}
                  className="hover:-translate-y-[3px] transition-transform"
                >
                  <i
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: f.tint,
                      mixBlendMode: "soft-light",
                      pointerEvents: "none",
                    }}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              setFilterOffset((o) => (o + 1) % SCENE_FILTERS.length);
              setFilterNudge(true);
              requestAnimationFrame(() => {
                requestAnimationFrame(() => setFilterNudge(false));
              });
            }}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--glass-2)",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: "auto",
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ==================== 11.4 SAVE (#save.glass: 1302, 796, 274x88) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: 1302,
            top: 796,
            width: 274,
            height: 88,
            padding: 14,
            zIndex: 35,
          }}
        >
          <button
            type="button"
            onClick={handleSaveToLibrary}
            className="vell-save-btn"
          >
            <span className={`vell-save-shine ${saveShine ? "go" : ""}`} />
            SAVE TO LIBRARY
          </button>
        </div>

        {/* ==================== GWO CART & FRIEND REFERRAL DRAWER ==================== */}
        {cartDrawerOpen && (
          <div
            className="vell-glass"
            style={{
              right: 28,
              top: 90,
              width: 380,
              maxHeight: 520,
              padding: 18,
              zIndex: 65,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 15, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                GWO OUTFIT BAG ({cartPieces.length})
              </span>
              <button type="button" onClick={() => setCartDrawerOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: 330 }}>
              {cartPieces.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  Click + next to any piece in the Outfits accordion to add to your multi-store bag.
                </p>
              ) : (
                cartPieces.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "var(--glass-2)",
                      border: "1px solid var(--line)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 500 }}>{item.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                        {item.color} {item.friendRef ? `· Credits ${item.friendRef}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontWeight: 600 }}>${item.price}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setCartPieces((p) => p.filter((x) => x.key !== item.key))
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5 opacity-70" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartPieces.length > 0 && (
              <div style={{ paddingTop: 10, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Total Look</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    ${cartPieces.reduce((s, i) => s + i.price, 0)}
                  </div>
                </div>
                <Link
                  href="/shop"
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    background: "#fff",
                    color: "#18171c",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Multi-Store Checkout <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ==================== GWO GIRLS' SHARED CLOSETS & FIRECRAWL DRAWER ==================== */}
        {gwoDrawer !== "none" && (
          <div
            className="vell-glass"
            style={{
              left: 520,
              top: 110,
              width: 560,
              padding: 22,
              zIndex: 70,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setGwoDrawer("friends")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background:
                      gwoDrawer === "friends" ? "rgba(255,255,255,0.22)" : "var(--glass-2)",
                    boxShadow: gwoDrawer === "friends" ? "var(--glow)" : "none",
                  }}
                >
                  Girls&apos; Closets (Body Twins)
                </button>
                <button
                  type="button"
                  onClick={() => setGwoDrawer("firecrawl")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    fontWeight: 600,
                    background:
                      gwoDrawer === "firecrawl" ? "rgba(255,255,255,0.22)" : "var(--glass-2)",
                    boxShadow: gwoDrawer === "firecrawl" ? "var(--glow)" : "none",
                  }}
                >
                  Firecrawl Store URL Import
                </button>
              </div>
              <button type="button" onClick={() => setGwoDrawer("none")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {gwoDrawer === "friends" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  Filter the studio looks by a friend&apos;s public closet (automatically embeds her referral code if you buy) or copy your closet link:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFriendCloset(null);
                      setGwoDrawer("none");
                      triggerToast("Showing all shared closets");
                    }}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: "var(--glass-2)",
                      border: "1px solid var(--line)",
                      boxShadow: !activeFriendCloset ? "var(--glow)" : "none",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 14 }}>All Girls&apos; Closets</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>8 full studio looks</div>
                  </button>

                  {friends.map((fr) => (
                    <button
                      key={fr.id}
                      type="button"
                      onClick={() => {
                        setActiveFriendCloset(fr.username);
                        setGwoDrawer("none");
                        triggerToast(`Raiding @${fr.username}'s closet (${fr.referralCode})`);
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        background: "var(--glass-2)",
                        border: "1px solid var(--line)",
                        boxShadow:
                          activeFriendCloset === fr.username ? "var(--glow)" : "none",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        @{fr.username} · {fr.displayName}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {fr.waistInches}&quot;W · Code: {fr.referralCode}
                      </div>
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await shareMyClosetAndClaimBonus();
                      triggerToast("Closet link copied (+3 free tries)");
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.16)",
                      border: "1px solid var(--line)",
                      fontSize: 12.5,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy My Shareable Link
                  </button>
                  <Link
                    href="/u/maya"
                    style={{ fontSize: 12.5, color: "#fff", textDecoration: "underline", alignSelf: "center" }}
                  >
                    Open @maya&apos;s public web page →
                  </Link>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  Paste any Nike, Skims, Reformation, or Alo product URL. Firecrawl scrapes it once into GWO&apos;s shared 3-day-refresh database and adds it to your Swipe Rack!
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="url"
                    value={scrapeInput}
                    onChange={(e) => setScrapeInput(e.target.value)}
                    placeholder="https://www.nike.com/t/..."
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "rgba(0,0,0,0.28)",
                      border: "1px solid var(--line)",
                      color: "#fff",
                      fontSize: 13,
                      outline: "none",
                    }}
                  />
                  <button
                    type="button"
                    disabled={scrapingNow || !scrapeInput.trim()}
                    onClick={async () => {
                      setScrapingNow(true);
                      const res = await ingestUrlToSharedCatalog(scrapeInput);
                      setScrapingNow(false);
                      if (res?.product) {
                        setScrapeInput("");
                        setSwipeRackOpen(true);
                        setGwoDrawer("none");
                        rescan();
                        triggerToast(`Scraped ${res.product.brand} to Swipe Rack!`);
                      }
                    }}
                    style={{
                      padding: "0 18px",
                      borderRadius: 12,
                      background: "#fff",
                      color: "#18171c",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {scrapingNow ? "Scraping..." : "Firecrawl Import"}
                  </button>
                </div>
                {telemetry && (
                  <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", justifyContent: "space-between" }}>
                    <span>Shared Catalog: {telemetry.sharedSkuCount} SKUs</span>
                    <span>
                      Beta AI Spend: ${telemetry.ledger.spentUsd.toFixed(3)} / $
                      {telemetry.ledger.capUsd.toFixed(2)} cap
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== 13. TOAST (top: 96, centred) ==================== */}
        <div
          className="vell-glass"
          style={{
            left: "50%",
            top: 96,
            padding: "9px 18px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 15,
            zIndex: 80,
            transform: toast
              ? "translate(-50%, 0)"
              : "translate(-50%, -20px)",
            opacity: toast ? 1 : 0,
            pointerEvents: "none",
            transition:
              "transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1), opacity 0.25s ease",
          }}
        >
          <Check className="w-4 h-4" />
          <span>{toast}</span>
        </div>
      </div>

      {/* ==================== FLOATING POINTER DRAG GHOST ==================== */}
      {dragItem && (
        <div
          style={{
            position: "fixed",
            left: dragItem.x + 14,
            top: dragItem.y - 18,
            padding: "8px 14px",
            borderRadius: 14,
            background: "rgba(30, 28, 34, 0.82)",
            backdropFilter: "blur(16px)",
            border: "1.5px solid #fff",
            boxShadow: "0 12px 30px rgba(0,0,0,0.45), 0 0 18px rgba(255,255,255,0.35)",
            pointerEvents: "none",
            zIndex: 9999,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>{dragItem.label}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
            {overAvatarDropZone ? "Release to swipe onto avatar!" : dragItem.sublabel}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== HELPER SUB-COMPONENTS ==================== */

function PanelView({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: "22px 18px 18px",
        display: "flex",
        flexDirection: "column",
        opacity: active ? 1 : 0,
        transform: active ? "translateX(0)" : "translateX(30px)",
        pointerEvents: active ? "auto" : "none",
        transition: "transform 0.55s cubic-bezier(0.2, 0.7, 0.2, 1), opacity 0.4s ease",
      }}
    >
      {children}
    </div>
  );
}

function StudioSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 8 }}>
        <span style={{ color: "var(--ink-2)" }}>{label}</span>
        <span style={{ fontWeight: 600 }}>
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        className="vell-slider"
        style={{ "--p": `${pct}%` } as React.CSSProperties}
      />
    </div>
  );
}

function RefreshIcon({ deg }: { deg: number }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: `rotate(${deg}deg)`,
        transition: "transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)",
      }}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function PersonalityRadar({ values }: { values: number[] }) {
  const labels = ["Openness", "Energy", "Warmth", "Focus", "Humour"];
  const cx = 125;
  const cy = 108;
  const R = 78;

  const pt = (axis: number, ratio: number) => {
    const angle = -Math.PI / 2 + (axis * 2 * Math.PI) / 5;
    return [cx + Math.cos(angle) * R * ratio, cy + Math.sin(angle) * R * ratio];
  };

  const polyPoints = values
    .map((v, idx) => pt(idx, v / 100).map((n) => n.toFixed(1)).join(","))
    .join(" ");

  return (
    <svg width={250} height={210} viewBox="0 0 250 210">
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={[0, 1, 2, 3, 4]
            .map((i) => pt(i, ring).map((n) => n.toFixed(1)).join(","))
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth={1}
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => {
        const [x, y] = pt(i, 1);
        const [lx, ly] = pt(i, 1.22);
        return (
          <g key={i}>
            <line
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.78)"
              fontSize={11}
            >
              {labels[i]}
            </text>
          </g>
        );
      })}
      <polygon
        points={polyPoints}
        fill="rgba(255,255,255,0.28)"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </svg>
  );
}

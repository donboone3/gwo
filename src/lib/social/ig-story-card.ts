import { EndlessAiOutfit, SocialStyleDNA } from "../types";
import { ARCHETYPE_META } from "./social-style-dna";

export interface IgStoryCardSpec {
  width: number;
  height: number;
  handleBadge: string;
  archetypeBadge: string;
  matchBadge: string;
  headlineTitle: string;
  occasionSubhead: string;
  avatarBadge: string;
  paletteHex: string[];
  pieces: Array<{
    title: string;
    brand: string;
    priceUsd: number;
    usSize: string;
    colorHex: string;
    imageUrl?: string;
  }>;
  totalOutfitUsd: number;
  pollQuestion: string;
  pollLeftOption: string;
  pollRightOption: string;
  shareCaption: string;
}

/**
 * Builds deterministic metadata for a 1080×1920 (9:16) Instagram / TikTok Story Lookbook Card
 * so customers can poll followers to collaborate on their outfit!
 */
export function buildIgStoryCardSpec(
  outfit: EndlessAiOutfit,
  socialDna: SocialStyleDNA,
  avatarHeightDisplay = "5'2\""
): IgStoryCardSpec {
  const handle = socialDna.instagramHandle || "@mila.nyc";
  const archMeta = ARCHETYPE_META[outfit.matchedArchetype];
  const pieces = outfit.items.slice(0, 4).map((it) => ({
    title: it.title,
    brand: it.brand,
    priceUsd: it.price,
    usSize: outfit.perItemSizes[it.id]?.usSize || "S",
    colorHex: it.colorHex || "#232122",
    imageUrl: it.imageUrl,
  }));

  const shareCaption = `${outfit.title} (${outfit.socialDnaMatchPct}% ${archMeta.shortTag} DNA Match for ${handle}) ✨\n${pieces
    .map((p) => `• ${p.title} — US ${p.usSize} ($${p.priceUsd})`)
    .join("\n")}\nStyled in 360° Front & Back on GWO (${avatarHeightDisplay} Exact Fit) #GWOLookbook #${archMeta.shortTag.replace(
    /\s+/g,
    ""
  )}`;

  return {
    width: 1080,
    height: 1920,
    handleBadge: `GWO × ${handle}`,
    archetypeBadge: `${archMeta.label.toUpperCase()}`,
    matchBadge: `${outfit.socialDnaMatchPct}% SOCIAL DNA MATCH`,
    headlineTitle: outfit.title,
    occasionSubhead: `${outfit.occasion} • ${outfit.colorHarmonyScore}% Color Harmony`,
    avatarBadge: `${avatarHeightDisplay} Exact-Fit Avatar Verified`,
    paletteHex: socialDna.extractedPaletteHex.slice(0, 4),
    pieces,
    totalOutfitUsd: outfit.totalValue,
    pollQuestion: "WEAR THIS LOOK TONIGHT?",
    pollLeftOption: "🔥 100% WEAR IT",
    pollRightOption: "🤍 SAVE FOR WKND",
    shareCaption,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function loadStoryImageSafe(url?: string): Promise<HTMLImageElement | null> {
  if (!url || typeof Image === "undefined") return null;
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) * 0.15;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Renders a crisp, downloadable 1080×1920 (9:16) Instagram / TikTok Story Lookbook PNG data URL!
 */
export async function renderIgStoryLookbookPngDataUrl(
  spec: IgStoryCardSpec
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Editorial warm ivory gradient background
  const grad = ctx.createLinearGradient(0, 0, 0, spec.height);
  grad.addColorStop(0, "#FAF8F5");
  grad.addColorStop(0.55, "#F3EFE9");
  grad.addColorStop(1, "#EAE4DC");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, spec.width, spec.height);

  // Top Pill Bar: GWO x @handle + Match %
  drawRoundedRect(ctx, 64, 68, 430, 62, 31);
  ctx.fillStyle = "#141518";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 25px system-ui, -apple-system, sans-serif";
  ctx.fillText(spec.handleBadge.slice(0, 26), 96, 108);

  drawRoundedRect(ctx, 620, 68, 396, 62, 31);
  ctx.fillStyle = "#244B3B";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 23px system-ui, -apple-system, sans-serif";
  ctx.fillText(spec.matchBadge, 652, 107);

  // Headline & Occasion
  ctx.fillStyle = "#141518";
  ctx.font = "800 46px system-ui, -apple-system, sans-serif";
  ctx.fillText(spec.headlineTitle.slice(0, 34), 64, 206);

  ctx.fillStyle = "#5C6068";
  ctx.font = "600 27px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${spec.occasionSubhead} • ${spec.avatarBadge}`, 64, 254);

  // Extracted Social Palette Swatches
  spec.paletteHex.forEach((hex, idx) => {
    ctx.beginPath();
    ctx.arc(900 + idx * 42, 244, 15, 0, Math.PI * 2);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(20,21,24,0.18)";
    ctx.stroke();
  });

  // Load piece images concurrently
  const loadedImgs = await Promise.all(
    spec.pieces.map((p) => loadStoryImageSafe(p.imageUrl))
  );

  // Editorial Moodboard Frame (Hero Left 540x820, Stack Right 386x820)
  const heroX = 64;
  const heroY = 300;
  const heroW = 546;
  const heroH = 820;

  ctx.save();
  drawRoundedRect(ctx, heroX, heroY, heroW, heroH, 36);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.clip();
  if (loadedImgs[0]) {
    drawCoverImage(ctx, loadedImgs[0], heroX, heroY, heroW, heroH);
  } else {
    ctx.fillStyle = spec.pieces[0]?.colorHex || "#232122";
    ctx.fillRect(heroX, heroY, heroW, heroH);
  }
  ctx.restore();

  const rightPieces = spec.pieces.slice(1, 4);
  const rightCount = Math.max(1, rightPieces.length);
  const gap = 18;
  const cellH = Math.floor((heroH - gap * (rightCount - 1)) / rightCount);
  const rightX = heroX + heroW + 22;
  const rightW = 384;

  rightPieces.forEach((p, idx) => {
    const cy = heroY + idx * (cellH + gap);
    ctx.save();
    drawRoundedRect(ctx, rightX, cy, rightW, cellH, 28);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.clip();
    const im = loadedImgs[idx + 1];
    if (im) {
      drawCoverImage(ctx, im, rightX, cy, rightW, cellH);
    } else {
      ctx.fillStyle = p.colorHex || "#D9CEBE";
      ctx.fillRect(rightX, cy, rightW, cellH);
    }
    ctx.restore();
  });

  // Per-Piece Exact-Fit Spec List (y = 1160..1545)
  let rowY = 1158;
  spec.pieces.forEach((p) => {
    drawRoundedRect(ctx, 64, rowY, 952, 84, 22);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(104, rowY + 42, 14, 0, Math.PI * 2);
    ctx.fillStyle = p.colorHex;
    ctx.fill();

    ctx.fillStyle = "#141518";
    ctx.font = "700 25px system-ui, -apple-system, sans-serif";
    ctx.fillText(p.title.slice(0, 40), 136, rowY + 38);

    ctx.fillStyle = "#244B3B";
    ctx.font = "600 21px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${p.brand} • Exact Fit US ${p.usSize}`, 136, rowY + 68);

    ctx.fillStyle = "#141518";
    ctx.font = "800 27px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`$${p.priceUsd}`, 984, rowY + 52);
    ctx.textAlign = "left";

    rowY += 96;
  });

  // Interactive IG Story Follower Poll Sticker Card at Bottom (y = 1568..1846)
  drawRoundedRect(ctx, 110, 1576, 860, 260, 40);
  ctx.fillStyle = "#141518";
  ctx.fill();

  ctx.fillStyle = "#A7D7C5";
  ctx.font = "700 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `COMPLETE ${spec.pieces.length}-PIECE LOOK • $${spec.totalOutfitUsd} ON GWO`,
    540,
    1626
  );

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 34px system-ui, -apple-system, sans-serif";
  ctx.fillText(spec.pollQuestion, 540, 1678);

  // Left & Right Poll Buttons
  drawRoundedRect(ctx, 152, 1712, 372, 92, 26);
  ctx.fillStyle = "#244B3B";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(spec.pollLeftOption, 338, 1768);

  drawRoundedRect(ctx, 556, 1712, 372, 92, 26);
  ctx.fillStyle = "#2C2E35";
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(spec.pollRightOption, 742, 1768);
  ctx.textAlign = "left";

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return "";
  }
}

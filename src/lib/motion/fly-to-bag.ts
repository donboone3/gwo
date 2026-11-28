"use client";

/**
 * Parabolic WAAPI fly-to-bag choreography:
 * Launches a miniature garment card from `sourceEl` along a lifted gravity arc
 * directly into `#gwo-unified-bag-btn` and springs the bag pill on arrival.
 */
export function launchFlyToBag(
  sourceEl: HTMLElement | null | undefined,
  imageUrl?: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const bagBtn = document.getElementById("gwo-unified-bag-btn");
  if (!bagBtn || !sourceEl) return;

  const srcRect = sourceEl.getBoundingClientRect();
  const dstRect = bagBtn.getBoundingClientRect();
  if (srcRect.width < 4 || dstRect.width < 4) return;

  const startX = srcRect.left + srcRect.width * 0.5 - 28;
  const startY = srcRect.top + srcRect.height * 0.42 - 36;
  const dx = dstRect.left + dstRect.width * 0.5 - (startX + 28);
  const dy = dstRect.top + dstRect.height * 0.5 - (startY + 36);
  const peakY = Math.min(dy * 0.36, -42) - 38;

  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  Object.assign(ghost.style, {
    position: "fixed",
    left: `${startX.toFixed(1)}px`,
    top: `${startY.toFixed(1)}px`,
    width: "56px",
    height: "72px",
    borderRadius: "14px",
    overflow: "hidden",
    background: "#FFF9FB",
    border: "1.5px solid rgba(184, 59, 106, 0.32)",
    boxShadow: "0 16px 34px rgba(34, 19, 26, 0.22)",
    pointerEvents: "none",
    zIndex: "9999",
    willChange: "transform, opacity",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  });

  const existingImg =
    sourceEl instanceof HTMLImageElement
      ? sourceEl.currentSrc || sourceEl.src
      : sourceEl.querySelector("img")?.currentSrc ||
        sourceEl.querySelector("img")?.src;
  const resolvedSrc = imageUrl || existingImg;

  if (resolvedSrc) {
    const img = document.createElement("img");
    img.src = resolvedSrc;
    img.alt = "";
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "contain",
      padding: "4px",
    });
    ghost.appendChild(img);
  } else {
    ghost.style.background = "linear-gradient(135deg, #FCEBF2, #F5C6DA)";
  }

  document.body.appendChild(ghost);

  const anim = ghost.animate(
    [
      {
        transform: "translate3d(0, 0, 0) scale(1) rotate(0deg)",
        opacity: 0.98,
      },
      {
        transform: `translate3d(${(dx * 0.44).toFixed(1)}px, ${peakY.toFixed(
          1
        )}px, 0) scale(0.76) rotate(-7deg)`,
        opacity: 0.96,
        offset: 0.44,
      },
      {
        transform: `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(
          1
        )}px, 0) scale(0.16) rotate(9deg)`,
        opacity: 0.18,
      },
    ],
    {
      duration: 640,
      easing: "cubic-bezier(0.22, 0.72, 0.32, 1)",
      fill: "forwards",
    }
  );

  const cleanup = () => {
    ghost.remove();
  };

  anim.onfinish = () => {
    cleanup();
    bagBtn.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.18)" },
        { transform: "scale(0.95)" },
        { transform: "scale(1)" },
      ],
      { duration: 360, easing: "cubic-bezier(0.22, 1.35, 0.36, 1)" }
    );
  };
  anim.oncancel = cleanup;
}

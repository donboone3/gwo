"use client";

import React, { useId, useState } from "react";

interface GwoLogoProps {
  className?: string;
  height?: number;
  replayOnClick?: boolean;
}

const W_CENTER = "M 87.8 55.8 C 84.8 71.8, 82.6 89.2, 86.8 97.6 C 88.8 101.2, 94.8 99.0, 101.2 85.0 C 104.2 78.4, 106.6 72.8, 108.2 70.2 C 109.0 80.5, 109.2 95.8, 114.6 97.6 C 119.8 99.2, 128.4 80.5, 136.0 56.8";
const BAR_CENTER = "M 70.2 60.2 C 78.8 58.0, 88.4 55.2, 97.5 52.4";
const G_CENTER = "M 102.2 24.4 C 92.8 25.8, 72.0 41.2, 56.2 63.8 C 45.6 79.2, 44.8 94.8, 52.4 102.2 C 60.0 109.2, 75.2 103.2, 85.6 90.8";
const O_CENTER = "M 149.2 32.8 C 138.2 35.0, 132.2 49.5, 134.8 63.2 C 136.6 72.0, 144.6 74.6, 151.8 68.4 C 159.0 62.0, 160.8 46.8, 154.6 36.4 C 150.6 29.8, 142.2 34.0, 139.2 46.2";

const W1_RIBBON = "M 85.3 55.3 L 84.8 58.4 L 84.2 61.4 L 83.7 64.5 L 83.3 67.5 L 82.8 70.6 L 82.5 73.6 L 82.2 76.5 L 81.9 79.4 L 81.8 82.2 L 81.8 84.9 L 81.8 87.6 L 82.0 90.1 L 82.2 92.5 L 82.7 94.8 L 83.3 96.9 L 84.1 99.1 L 84.9 100.2 L 86.1 101.1 L 87.4 101.5 L 88.8 101.5 L 90.0 101.1 L 91.1 100.5 L 92.2 99.9 L 93.2 99.1 L 94.4 98.3 L 95.6 97.3 L 96.8 96.0 L 98.1 94.5 L 99.3 92.7 L 100.6 90.7 L 101.9 88.4 L 103.2 85.9 L 103.7 84.7 L 104.3 83.5 L 104.8 82.3 L 105.3 81.2 L 105.8 80.1 L 106.3 79.0 L 106.7 78.0 L 107.2 77.0 L 107.6 76.1 L 108.0 75.2 L 108.4 74.4 L 108.7 73.6 L 109.0 72.9 L 109.1 72.2 L 109.1 71.4 L 109.0 70.7 L 109.1 70.2 L 109.0 69.8 L 108.7 69.4 L 108.2 69.3 L 107.8 69.4 L 107.4 69.7 L 106.7 70.0 L 106.0 70.5 L 105.4 71.0 L 105.0 71.7 L 104.6 72.5 L 104.1 73.4 L 103.7 74.3 L 103.3 75.2 L 102.8 76.2 L 102.3 77.2 L 101.9 78.3 L 101.4 79.4 L 100.8 80.5 L 100.3 81.7 L 99.8 82.9 L 99.2 84.1 L 98.1 86.5 L 97.0 88.7 L 96.0 90.6 L 95.0 92.3 L 94.0 93.7 L 93.1 94.9 L 92.2 95.9 L 91.5 96.7 L 90.7 97.1 L 90.0 97.2 L 89.4 97.1 L 89.2 96.8 L 89.2 96.5 L 89.4 96.3 L 89.5 96.2 L 89.5 96.1 L 88.9 94.9 L 88.4 93.3 L 87.9 91.5 L 87.6 89.5 L 87.3 87.2 L 87.2 84.9 L 87.2 82.3 L 87.3 79.7 L 87.4 76.9 L 87.6 74.1 L 87.9 71.2 L 88.3 68.3 L 88.7 65.3 L 89.2 62.3 L 89.7 59.3 L 90.3 56.3 L 85.9 54.2 L 87.0 53.4 L 88.3 53.3 L 89.4 53.9 L 90.2 55.0 Z";
const W2_RIBBON = "M 107.0 70.3 L 106.0 72.3 L 105.8 74.4 L 105.9 76.6 L 106.0 78.8 L 106.2 81.0 L 106.4 83.2 L 106.6 85.4 L 106.9 87.5 L 107.2 89.6 L 107.6 91.5 L 108.1 93.4 L 108.7 95.2 L 109.5 96.8 L 110.5 98.3 L 112.0 99.4 L 113.8 100.1 L 115.9 99.6 L 117.4 98.6 L 118.9 97.6 L 120.4 96.4 L 121.8 94.7 L 123.3 92.7 L 124.8 90.3 L 126.3 87.6 L 127.7 84.6 L 129.2 81.4 L 130.7 77.9 L 132.2 74.2 L 133.6 70.2 L 134.9 66.0 L 136.0 61.7 L 137.1 57.2 L 137.2 56.5 L 136.9 56.0 L 136.4 55.7 L 135.7 55.6 L 135.2 55.9 L 134.9 56.4 L 133.1 60.7 L 131.3 64.8 L 129.7 68.8 L 128.1 72.6 L 126.7 76.3 L 125.3 79.7 L 123.9 82.9 L 122.5 85.8 L 121.2 88.3 L 120.0 90.6 L 118.8 92.5 L 117.8 94.1 L 116.8 95.3 L 116.0 95.9 L 115.3 95.7 L 115.4 95.1 L 115.3 94.8 L 115.1 94.4 L 114.7 93.8 L 114.2 92.8 L 113.7 91.6 L 113.2 90.2 L 112.8 88.5 L 112.5 86.7 L 112.2 84.7 L 111.9 82.6 L 111.7 80.5 L 111.5 78.4 L 111.4 76.2 L 111.2 74.1 L 110.7 72.0 L 109.4 70.1 L 107.1 69.7 L 107.5 69.2 L 108.1 69.0 L 108.7 69.1 L 109.2 69.5 Z";
const BAR_RIBBON = "M 70.4 61.1 L 72.0 61.2 L 73.5 61.1 L 75.0 60.7 L 76.5 60.3 L 78.0 59.9 L 79.5 59.5 L 81.1 59.1 L 82.6 58.6 L 84.1 58.2 L 85.7 57.7 L 87.2 57.3 L 88.8 56.8 L 90.3 56.4 L 91.9 55.9 L 93.4 55.4 L 94.9 54.9 L 96.4 54.2 L 97.8 53.3 L 98.2 53.1 L 98.4 52.6 L 98.4 52.1 L 98.2 51.7 L 97.7 51.5 L 97.2 51.5 L 95.6 51.6 L 94.0 51.8 L 92.4 52.2 L 90.9 52.6 L 89.3 53.1 L 87.8 53.5 L 86.3 54.0 L 84.7 54.4 L 83.2 54.9 L 81.7 55.3 L 80.1 55.7 L 78.6 56.2 L 77.1 56.6 L 75.6 57.0 L 74.1 57.4 L 72.7 57.8 L 71.3 58.5 L 70.0 59.3 L 69.9 61.1 L 69.5 60.9 L 69.3 60.4 L 69.3 59.9 L 69.5 59.5 Z";
const G_RIBBON = "M 102.0 23.3 L 100.2 23.6 L 98.2 24.2 L 96.1 25.0 L 93.7 26.1 L 91.3 27.4 L 88.8 28.9 L 86.1 30.7 L 83.4 32.7 L 80.6 34.9 L 77.7 37.3 L 74.8 39.9 L 71.9 42.7 L 68.9 45.6 L 66.0 48.7 L 63.1 52.0 L 60.2 55.4 L 57.4 59.0 L 54.6 62.7 L 52.8 65.3 L 51.2 67.9 L 49.8 70.5 L 48.5 73.1 L 47.4 75.7 L 46.5 78.3 L 45.7 80.8 L 45.2 83.3 L 44.8 85.8 L 44.5 88.2 L 44.5 90.5 L 44.7 92.8 L 45.0 95.1 L 45.6 97.2 L 46.4 99.2 L 47.4 101.2 L 48.7 102.9 L 50.2 104.6 L 52.0 105.8 L 54.0 106.8 L 56.0 107.3 L 58.1 107.6 L 60.2 107.6 L 62.3 107.4 L 64.4 106.9 L 66.5 106.3 L 68.6 105.5 L 70.7 104.6 L 72.8 103.4 L 74.9 102.2 L 76.9 100.7 L 79.0 99.2 L 81.0 97.5 L 82.9 95.6 L 84.7 93.6 L 86.4 91.5 L 86.6 91.0 L 86.6 90.4 L 86.3 90.0 L 85.8 89.8 L 85.2 89.8 L 84.8 90.1 L 83.0 92.0 L 81.1 93.8 L 79.2 95.4 L 77.2 96.9 L 75.2 98.3 L 73.2 99.5 L 71.2 100.5 L 69.3 101.4 L 67.3 102.0 L 65.4 102.5 L 63.6 102.8 L 61.9 102.9 L 60.3 102.7 L 58.8 102.4 L 57.6 102.0 L 56.4 101.4 L 55.5 100.7 L 54.6 99.8 L 53.7 98.9 L 52.9 97.7 L 52.2 96.5 L 51.6 95.1 L 51.0 93.6 L 50.6 91.9 L 50.3 90.1 L 50.2 88.2 L 50.2 86.2 L 50.3 84.1 L 50.7 81.9 L 51.2 79.6 L 51.8 77.3 L 52.7 74.9 L 53.7 72.4 L 54.9 69.9 L 56.2 67.4 L 57.8 64.9 L 60.4 61.2 L 63.1 57.7 L 65.8 54.3 L 68.6 51.0 L 71.4 48.0 L 74.2 45.0 L 77.0 42.3 L 79.8 39.7 L 82.6 37.4 L 85.3 35.2 L 87.9 33.2 L 90.4 31.5 L 92.8 29.9 L 95.1 28.6 L 97.2 27.5 L 99.1 26.6 L 100.8 25.9 L 102.4 25.5 L 102.6 23.4 L 103.0 23.7 L 103.3 24.2 L 103.2 24.8 L 102.9 25.2 Z";
const O1_RIBBON = "M 149.0 32.0 L 146.8 32.4 L 144.8 33.1 L 142.8 34.2 L 140.9 35.4 L 139.2 37.0 L 137.7 38.7 L 136.3 40.7 L 135.0 42.8 L 134.0 45.1 L 133.1 47.6 L 132.5 50.1 L 132.0 52.7 L 131.7 55.4 L 131.6 58.1 L 131.8 60.9 L 132.1 63.7 L 132.6 65.6 L 133.2 67.4 L 134.0 69.0 L 135.0 70.4 L 136.2 71.6 L 137.5 72.6 L 139.0 73.3 L 140.5 73.8 L 142.1 74.0 L 143.7 73.9 L 145.3 73.6 L 146.8 73.1 L 148.3 72.5 L 149.8 71.6 L 151.3 70.6 L 152.8 69.5 L 154.3 68.2 L 155.7 66.6 L 157.0 64.9 L 158.0 63.0 L 158.9 60.9 L 159.7 58.8 L 160.3 56.5 L 160.7 54.1 L 160.9 51.7 L 160.9 49.3 L 160.8 46.8 L 160.4 44.4 L 159.9 41.9 L 159.2 39.5 L 158.2 37.2 L 157.0 34.9 L 156.0 33.9 L 154.6 33.6 L 153.1 34.0 L 152.1 35.0 L 151.8 36.4 L 152.2 37.9 L 153.1 39.6 L 153.9 41.5 L 154.6 43.4 L 155.1 45.4 L 155.5 47.5 L 155.8 49.5 L 155.8 51.6 L 155.8 53.7 L 155.6 55.7 L 155.3 57.7 L 154.8 59.5 L 154.3 61.3 L 153.6 63.0 L 152.8 64.6 L 151.8 66.0 L 150.8 67.3 L 149.6 68.3 L 148.4 69.0 L 147.1 69.5 L 145.9 69.8 L 144.8 69.8 L 143.7 69.7 L 142.8 69.4 L 142.0 69.1 L 141.3 68.6 L 140.6 68.1 L 140.0 67.5 L 139.4 66.8 L 138.9 66.0 L 138.3 65.0 L 137.9 63.9 L 137.5 62.7 L 137.0 60.3 L 136.8 58.0 L 136.7 55.6 L 136.8 53.2 L 137.1 51.0 L 137.5 48.7 L 138.0 46.6 L 138.8 44.5 L 139.6 42.6 L 140.6 40.8 L 141.7 39.2 L 143.0 37.7 L 144.3 36.3 L 145.9 35.2 L 147.5 34.3 L 149.4 33.6 L 149.5 32.0 L 149.8 32.3 L 150.0 32.6 L 150.0 33.1 L 149.7 33.4 Z";
const O2_RIBBON = "M 156.6 35.2 L 155.6 33.8 L 154.3 32.6 L 152.9 31.9 L 151.4 31.5 L 149.9 31.5 L 148.5 31.8 L 147.1 32.4 L 145.9 33.1 L 144.6 34.0 L 143.3 35.0 L 142.1 36.3 L 140.9 37.7 L 140.0 39.5 L 139.2 41.4 L 138.7 43.6 L 138.4 46.0 L 138.4 46.4 L 138.6 46.8 L 139.0 47.0 L 139.4 47.0 L 139.8 46.8 L 140.0 46.4 L 141.0 44.4 L 141.9 42.6 L 142.8 40.9 L 143.7 39.5 L 144.5 38.1 L 145.4 37.0 L 146.3 36.1 L 147.2 35.4 L 148.2 35.1 L 149.1 35.0 L 149.8 35.1 L 150.4 35.4 L 151.0 35.8 L 151.5 36.2 L 152.0 36.8 L 152.6 37.6 L 156.9 36.4 L 156.7 37.5 L 155.8 38.4 L 154.6 38.7 L 153.5 38.5 Z";

/**
 * Couture-calligraphic vector refinement of the original interlocking cursive GWO monogram:
 *   1. Cursive W (sharing left stem with G, sculpted 34° nib contrast)
 *   2. Tapered horizontal crossbar capping W's left stem
 *   3. Sweeping G2-continuous C-arc completing the G
 *   4. Elevated cursive o loop perched off W's right arm
 */
export function GwoLogo({
  className = "",
  height = 36,
  replayOnClick = false,
}: GwoLogoProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [animCycle, setAnimCycle] = useState(0);
  const width = Math.round((height * 132) / 96);

  const gradId = `gwoInk-${uid}`;
  const m1 = `gwoM1-${uid}-${animCycle}`;
  const m2 = `gwoM2-${uid}-${animCycle}`;
  const m3 = `gwoM3-${uid}-${animCycle}`;
  const m4 = `gwoM4-${uid}-${animCycle}`;

  return (
    <span
      onClick={replayOnClick ? () => setAnimCycle((c) => c + 1) : undefined}
      aria-label="GWO"
      className={`inline-flex items-center justify-center select-none ${
        replayOnClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      <svg
        key={animCycle}
        width={width}
        height={height}
        viewBox="40 18 126 92"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="block overflow-visible select-none"
      >
        <defs>
          <linearGradient
            id={gradId}
            x1="44"
            y1="22"
            x2="162"
            y2="104"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#26121B" />
            <stop offset="62%" stopColor="#3B1627" />
            <stop offset="100%" stopColor="#8F2852" />
          </linearGradient>

          <mask id={m1} maskUnits="userSpaceOnUse" x="34" y="12" width="142" height="106">
            <path
              d={W_CENTER}
              pathLength={1}
              stroke="#ffffff"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="gwo-stroke-1"
            />
          </mask>
          <mask id={m2} maskUnits="userSpaceOnUse" x="34" y="12" width="142" height="106">
            <path
              d={BAR_CENTER}
              pathLength={1}
              stroke="#ffffff"
              strokeWidth="12"
              strokeLinecap="round"
              className="gwo-stroke-2"
            />
          </mask>
          <mask id={m3} maskUnits="userSpaceOnUse" x="34" y="12" width="142" height="106">
            <path
              d={G_CENTER}
              pathLength={1}
              stroke="#ffffff"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="gwo-stroke-3"
            />
          </mask>
          <mask id={m4} maskUnits="userSpaceOnUse" x="34" y="12" width="142" height="106">
            <path
              d={O_CENTER}
              pathLength={1}
              stroke="#ffffff"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="gwo-stroke-4"
            />
          </mask>
        </defs>

        {/* Stroke 1: Calligraphic W */}
        <g mask={`url(#${m1})`} fill={`url(#${gradId})`}>
          <path d={W1_RIBBON} />
          <path d={W2_RIBBON} />
        </g>

        {/* Stroke 2: Couture Crossbar */}
        <g mask={`url(#${m2})`} fill={`url(#${gradId})`}>
          <path d={BAR_RIBBON} />
        </g>

        {/* Stroke 3: Sweeping G C-Arc */}
        <g mask={`url(#${m3})`} fill={`url(#${gradId})`}>
          <path d={G_RIBBON} />
        </g>

        {/* Stroke 4: Elevated Cursive o */}
        <g mask={`url(#${m4})`} fill={`url(#${gradId})`}>
          <path d={O1_RIBBON} />
          <path d={O2_RIBBON} />
        </g>
      </svg>
    </span>
  );
}

import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { GwoProvider } from "@/context/GwoAppContext";
import { AvatarStageShell } from "@/components/layout/AvatarStageShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GWO — Girls' Wardrobe Online | Closet, Runway & 360° Fit",
  description:
    "Try on outfits from your closet and your friends' closets on a photoreal avatar, walk your personalized For You Runway, and inspect every fit in 360°.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} ${cormorant.variable}`}>
      <body>
        <GwoProvider>
          <AvatarStageShell>{children}</AvatarStageShell>
        </GwoProvider>
      </body>
    </html>
  );
}

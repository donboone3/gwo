import type { Metadata } from "next";
import "./globals.css";
import { GwoProvider } from "@/context/GwoAppContext";
import { AvatarStageShell } from "@/components/layout/AvatarStageShell";

export const metadata: Metadata = {
  title: "GWO — Girls' Wardrobe Online | Closet, Runway & 360° Fit",
  description:
    "Try on outfits from your closet and your friends' closets on your own photo avatar, walk your personalized For You Runway, and inspect every fit in 360°.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <GwoProvider>
          <AvatarStageShell>{children}</AvatarStageShell>
        </GwoProvider>
      </body>
    </html>
  );
}

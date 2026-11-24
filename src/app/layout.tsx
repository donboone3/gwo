import type { Metadata } from "next";
import {
  Cormorant_Garamond,
  Figtree,
  IBM_Plex_Mono,
  Inter,
  Inter_Tight,
  Michroma,
  Plus_Jakarta_Sans,
  Syne,
  Tinos,
} from "next/font/google";
import "./globals.css";
import { GwoProvider } from "@/context/GwoAppContext";
import { AvatarStageShell } from "@/components/layout/AvatarStageShell";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const michroma = Michroma({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-michroma",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-inter-tight",
  display: "swap",
});

const tinos = Tinos({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-tinos",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
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
  title: "GWO — Virtual Closet Studio, Runway Lookbook & 360° Product Spin",
  description:
    "Full-screen virtual styling studio, 6-model infinite runway depth lookbook, and interactive 360° drag-to-rotate product detail experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${syne.variable} ${michroma.variable} ${inter.variable} ${ibmPlexMono.variable} ${interTight.variable} ${tinos.variable} ${jakarta.variable} ${cormorant.variable}`}
    >
      <body>
        <GwoProvider>
          <AvatarStageShell>{children}</AvatarStageShell>
        </GwoProvider>
      </body>
    </html>
  );
}

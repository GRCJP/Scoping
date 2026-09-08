import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Barlow, Public_Sans } from "next/font/google";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { brandTitle } from "@/lib/brand";
import { resolveBrandIcons } from "@/lib/brand-icon";
import { loadBrand } from "@/lib/load-brand";
import "./globals.css";

const display = Barlow({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await loadBrand();
  return {
    title: brandTitle(brand),
    description: `Environment intake for ${brand.displayName}. Identifies what is being assessed — not a certification, not an identifier lookup. Do not enter CUI, UIDs, or SPRS scores.`,
    icons: resolveBrandIcons(brand),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const brand = await loadBrand();
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <BrandProvider value={brand}>{children}</BrandProvider>
      </body>
    </html>
  );
}

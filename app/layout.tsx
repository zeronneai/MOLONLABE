import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { LOGO_URL, SHOP_NAME, SITE_URL } from "@/lib/brand";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

// metadataBase makes every relative canonical and OG image in the tree
// resolve to an absolute URL; without it Next warns and social scrapers
// get relative paths they can't fetch.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Molon Labe Firearms x SunCity Outdoors — El Paso, TX",
    template: "%s — Molon Labe Firearms x SunCity Outdoors",
  },
  description:
    "Digital showroom for Molon Labe Firearms x SunCity Outdoors. See what is on hand, what is currently featured, and visit us at 10024 Montana Ave, El Paso, TX.",
  applicationName: SHOP_NAME,
  icons: { icon: LOGO_URL },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SHOP_NAME,
    locale: "en_US",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="bg-ink text-bone min-h-dvh">{children}</body>
    </html>
  );
}

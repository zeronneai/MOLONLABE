import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import IntroGame from "@/components/intro/IntroGame";
import { LOGO_URL } from "@/lib/brand";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Molon Labe Firearms x SunCity Outdoors — El Paso, TX",
  description:
    "Digital showroom for Molon Labe Firearms x SunCity Outdoors. See what is on hand, what is currently featured, and visit us at 10024 Montana Ave, El Paso, TX.",
  icons: { icon: LOGO_URL },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="bg-ink text-bone min-h-dvh flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <IntroGame />
      </body>
    </html>
  );
}

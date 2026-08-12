import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import IntroGame from "@/components/intro/IntroGame";
import Analytics from "@/components/analytics/Analytics";
import { LocalBusinessJsonLd } from "@/components/seo/StructuredData";
import { getGameSettings } from "@/lib/game/settings";

// Public site chrome. The admin route group renders without any of this —
// including analytics, so the owner working the shop never shows up in the
// client's traffic.
// Game settings come from the owner-controlled settings table; when the
// offer is disabled its code is never part of the payload.
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gameSettings = await getGameSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <LocalBusinessJsonLd />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <IntroGame settings={gameSettings} />
      <Analytics />
    </div>
  );
}

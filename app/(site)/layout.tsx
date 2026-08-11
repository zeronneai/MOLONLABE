import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import IntroGame from "@/components/intro/IntroGame";
import { getGameSettings } from "@/lib/game/settings";

// Public site chrome. The admin route group renders without any of this.
// Game settings come from the owner-controlled settings table; when the
// offer is disabled its code is never part of the payload.
export default async function SiteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gameSettings = await getGameSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <IntroGame settings={gameSettings} />
    </div>
  );
}

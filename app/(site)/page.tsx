export const dynamic = "force-dynamic";

import HeroScrub from "@/components/home/HeroScrub";
import { getClipDurations } from "@/lib/hero/duration";
import Featured from "@/components/home/Featured";
import FreshArrivals from "@/components/home/FreshArrivals";
import CaseSection from "@/components/home/CaseSection";
import PastGames from "@/components/home/PastGames";
import ShopStory from "@/components/home/ShopStory";
import BrandsMarquee from "@/components/home/BrandsMarquee";
import VisitSection from "@/components/home/VisitSection";

/**
 * Three surfaces, three grounds, in that order.
 *
 * A visitor should be able to tell — before reading a word — that buying
 * a shirt, taking a spot in a game and asking about a rifle are different
 * actions. So each gets its own ground and they alternate: ink for the
 * shop, a dark neutral for the case, acid as a field for the game.
 *
 * Past games sits directly under the open game because it is the same
 * surface, and it is the strongest thing on the page: a filled pool with
 * a date on it says the draws are real in a way no sentence does.
 */
export default async function Home() {
  // Measured once per hour on the server, so the client never pays for it.
  const durations = await getClipDurations();
  return (
    <>
      <HeroScrub durations={durations} />
      <FreshArrivals />
      <CaseSection />
      <Featured />
      <PastGames />
      <ShopStory />
      <BrandsMarquee />
      <VisitSection />
    </>
  );
}

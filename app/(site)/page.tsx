export const dynamic = "force-dynamic";

import HeroScrub from "@/components/home/HeroScrub";
import { getClipDurations } from "@/lib/hero/duration";
import Featured from "@/components/home/Featured";
import FreshArrivals from "@/components/home/FreshArrivals";
import ShopStory from "@/components/home/ShopStory";
import BrandsMarquee from "@/components/home/BrandsMarquee";
import VisitSection from "@/components/home/VisitSection";

export default async function Home() {
  // Measured once per hour on the server, so the client never pays for it.
  const durations = await getClipDurations();
  return (
    <>
      <HeroScrub durations={durations} />
      <Featured />
      <FreshArrivals />
      <ShopStory />
      <BrandsMarquee />
      <VisitSection />
    </>
  );
}

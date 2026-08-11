export const dynamic = "force-dynamic";

import HeroScrub from "@/components/home/HeroScrub";
import Featured from "@/components/home/Featured";
import FreshArrivals from "@/components/home/FreshArrivals";
import ShopStory from "@/components/home/ShopStory";
import BrandsMarquee from "@/components/home/BrandsMarquee";
import VisitSection from "@/components/home/VisitSection";

export default function Home() {
  return (
    <>
      <HeroScrub />
      <Featured />
      <FreshArrivals />
      <ShopStory />
      <BrandsMarquee />
      <VisitSection />
    </>
  );
}

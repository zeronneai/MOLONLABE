export const dynamic = "force-dynamic";

import Hero from "@/components/home/Hero";
import Featured from "@/components/home/Featured";
import FreshArrivals from "@/components/home/FreshArrivals";
import ShopStory from "@/components/home/ShopStory";
import BrandsMarquee from "@/components/home/BrandsMarquee";
import VisitSection from "@/components/home/VisitSection";

export default function Home() {
  return (
    <>
      <Hero />
      <Featured />
      <FreshArrivals />
      <ShopStory />
      <BrandsMarquee />
      <VisitSection />
    </>
  );
}

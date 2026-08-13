import type { Metadata } from "next";
import { SHOP_ADDRESS } from "@/lib/brand";
import VisitSection from "@/components/home/VisitSection";

export const metadata: Metadata = {
  alternates: { canonical: "/visit" },
  title: "Visit",
  description:
    `${SHOP_ADDRESS.street}, ${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.region}. Hours, directions, and contact for Molon Labe Firearms x SunCity Outdoors.`,
};

export default function VisitPage() {
  return (
    <div className="pt-[72px]">
      <VisitSection primary />
    </div>
  );
}

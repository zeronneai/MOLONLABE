import type { Metadata } from "next";
import VisitSection from "@/components/home/VisitSection";

export const metadata: Metadata = {
  title: "Visit — Molon Labe Firearms x SunCity Outdoors",
  description:
    "10024 Montana Ave, El Paso, TX. Hours, directions, and contact for Molon Labe Firearms x SunCity Outdoors.",
};

export default function VisitPage() {
  return (
    <div className="pt-[72px]">
      <VisitSection />
    </div>
  );
}

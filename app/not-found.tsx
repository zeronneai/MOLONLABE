import type { Metadata } from "next";
import ErrorScreen from "@/components/ui/ErrorScreen";

export const metadata: Metadata = {
  title: "Not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      headline={
        <>
          NOT IN
          <br />
          THE CASE.
        </>
      }
      body="Whatever was here is gone, sold, or never existed. Inventory moves fast around here — the case is the best place to start again."
      primary={{ href: "/inventory", text: "View inventory" }}
    />
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { SHOP_PHONE_HREF } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Services — Molon Labe Firearms x SunCity Outdoors",
  description:
    "FFL transfers, special orders, and in-store services at Molon Labe Firearms x SunCity Outdoors, El Paso, TX.",
};

// Placeholder service list — client to confirm the final lineup.
const services: { title: string; body: string }[] = [
  {
    title: "FFL TRANSFERS",
    body: "Buy anywhere, ship it to us, pick it up at the counter. Standard fee, fast turnaround.",
  },
  {
    title: "SPECIAL ORDERS",
    body: "If we don't have it in the case, we can usually get it. Distributor network across the majors.",
  },
  {
    title: "CONSIGNMENT",
    body: "Selling? We'll photograph it, list it, and put it in front of the right buyers.",
  },
  {
    title: "ADVICE, FREE",
    body: "First firearm or fiftieth — come talk it through with people who shoot what they sell.",
  },
];

export default function ServicesPage() {
  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Services</p>
      <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
        MORE THAN
        <br />
        THE CASE.
      </h1>

      <Reveal className="mt-14">
        <ol className="border-t hairline">
          {services.map((s, i) => (
            <li
              key={s.title}
              className="grid gap-2 border-b hairline py-8 md:grid-cols-[48px_280px_1fr] md:items-baseline md:gap-4"
            >
              <span className="label text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="display text-2xl">{s.title}</span>
              <p className="max-w-[52ch] text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4">
        <Link href="/transfers" className="cta-primary control-go">
          Start a transfer
        </Link>
        <a href={SHOP_PHONE_HREF} className="cta-primary">
          Call the shop
        </a>
      </div>
    </div>
  );
}

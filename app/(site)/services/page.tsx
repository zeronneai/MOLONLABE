import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import { SHOP_PHONE_HREF } from "@/lib/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/services" },
  title: "Services",
  description:
    "FFL transfers, special orders, and in-store services at Molon Labe Firearms x SunCity Outdoors, El Paso, TX.",
};

// Only what the build actually evidences. FFL transfers are real — the
// brief specifies a /transfers route with an intake form, and it exists.
// Special orders, consignment and "advice" were my inventions and are
// gone; the client is supplying the real lineup, which likely includes
// range and classes that I had no basis to claim either way.
const services: { title: string; body: string }[] = [
  {
    title: "FFL TRANSFERS",
    body: "Buy anywhere, ship it to us, pick it up at the counter. Start it online and we'll take it from there.",
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
        <p className="mt-8 max-w-[52ch] text-sm leading-relaxed text-muted">
          More than this happens at the counter — if you need something and
          you don&apos;t see it here, call and ask. It&apos;s a short
          conversation.
        </p>
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

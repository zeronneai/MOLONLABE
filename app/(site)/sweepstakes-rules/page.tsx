import type { Metadata } from "next";
import Link from "next/link";
import { SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/sweepstakes-rules" },
  title: "Sweepstakes Rules",
  description:
    "Official rules for the Molon Labe Firearms x SunCity Outdoors sweepstakes. No purchase necessary.",
  // Placeholder copy must never be indexed as if it were the real terms.
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------------------
// PLACEHOLDER — NOT LEGAL COPY.
//
// Everything below is scaffolding so the route, the layout and the link
// from the featured page are real. It must be replaced wholesale by the
// client's attorney before the sweepstakes opens to the public. The
// headings are the sections such rules normally carry, as a checklist for
// whoever drafts them; the body text under each is deliberately not
// written as operative terms.
// ---------------------------------------------------------------------------

const SECTIONS = [
  ["Eligibility", "Who may enter: minimum age, residency, exclusions for employees and their households, and any state-level restrictions on firearm sweepstakes."],
  ["Entry period", "Exact open and close date and time, including time zone, and how the clock is determined."],
  ["How to enter", "The paid entry method and the free method, stated as equivalent. The free method must be described in the same detail and with the same prominence as the paid one."],
  ["Free entry (no purchase necessary)", "The complete no-purchase method, including any mail-in alternative, entry limits per person per period, and confirmation that free entries carry the same weight as purchased entries."],
  ["Odds of winning", "How odds are determined by the total number of entries received, and a statement that a purchase does not improve chances of winning."],
  ["Prize", "Description and approximate retail value of the prize, and a statement that it may not be substituted or transferred except as the sponsor allows."],
  ["Drawing and notification", "How and when the winner is drawn, how they are contacted, the deadline to respond, and what happens if they do not."],
  ["Firearm transfer conditions", "That the prize is transferred through a licensed dealer, subject to a background check and all federal, state and local law, and what happens if the winner cannot lawfully take possession."],
  ["Taxes", "Who is responsible for taxes on the prize and any reporting obligations."],
  ["Publicity", "Whether accepting the prize permits use of the winner's name or likeness, and any state carve-outs."],
  ["Limitation of liability", "Standard limitations, and the sponsor's remedies for tampering, fraud, or technical failure."],
  ["Disputes and governing law", "Governing law, venue, and any arbitration or class-action terms."],
  ["Sponsor", "Full legal entity name and address of the sponsor, and a contact route for questions about these rules."],
];

export default function SweepstakesRulesPage() {
  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Legal</p>
      <h1 className="display mt-6 max-w-3xl text-[clamp(2.25rem,5vw,4rem)]">
        OFFICIAL SWEEPSTAKES RULES.
      </h1>

      <div className="mt-10 max-w-[68ch] border border-amber p-6">
        <p className="label text-amber">Placeholder — for the client&apos;s attorney</p>
        <p className="mt-4 text-sm leading-relaxed">
          This page is scaffolding, not legal copy. The sections below are a
          checklist of what these rules normally have to cover; none of it
          is drafted as operative terms and none of it has been reviewed by
          a lawyer. It must be replaced in full before the sweepstakes
          opens to the public. The page is set to noindex until it is.
        </p>
      </div>

      <p className="mt-10 max-w-[60ch] text-sm leading-relaxed text-muted">
        No purchase necessary to enter or win. A purchase does not improve
        your chances of winning. Void where prohibited. Open only to legal
        residents who may lawfully take possession of a firearm under
        federal, state and local law.
      </p>

      <div className="mt-14 border-t hairline">
        {SECTIONS.map(([heading, note], i) => (
          <section key={heading} className="border-b hairline py-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-10">
              <span className="label shrink-0 text-muted sm:w-12">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h2 className="display text-xl">{heading.toUpperCase()}</h2>
                <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-muted">
                  {note}
                </p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Link href="/featured" className="cta-primary">
          Back to the feature
        </Link>
        <a href={SHOP_PHONE_HREF} className="cta-primary">
          Call {SHOP_PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}

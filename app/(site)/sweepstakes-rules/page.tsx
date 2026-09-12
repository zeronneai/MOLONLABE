import type { Metadata } from "next";
import Link from "next/link";
import { RULES } from "@/lib/games/rules";
import { SHOP_NAME, SHOP_PHONE_DISPLAY, SHOP_PHONE_HREF } from "@/lib/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/sweepstakes-rules" },
  title: "Sweepstakes Rules",
  description: `Official sweepstakes rules for ${SHOP_NAME}, El Paso, TX.`,
  // Stays noindex until the shop launches. Nothing about the copy is
  // provisional; this is a launch switch, not a disclaimer.
  robots: { index: false, follow: false },
};

/**
 * The rules, set like any other page on the site.
 *
 * Deliberately not a wall of small print. Legal copy nobody reads
 * protects nobody, and this shop's whole pitch is that the draws are
 * real and checkable — so the terms are set at reading size in the same
 * type system as the rest of the site, numbered so a clause can be
 * pointed at over the phone.
 *
 * The content is in lib/games/rules.ts, with every clause traced to the
 * behaviour it describes.
 */
export default function SweepstakesRulesPage() {
  // Numbered continuously across sections, so "clause 12" is unambiguous
  // without anyone needing to say which section it is in.
  let n = 0;

  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Legal</p>
      <h1 className="display mt-6 max-w-3xl text-[clamp(2.25rem,5vw,4rem)]">
        OFFICIAL SWEEPSTAKES RULES.
      </h1>

      <p className="mt-8 max-w-[58ch] leading-relaxed text-muted">
        These rules apply to every game run by {SHOP_NAME} in El Paso,
        Texas. They describe exactly how a game works, how the winner is
        picked, and what happens next. Read them before you buy a spot.
      </p>

      <div className="mt-14 border-t hairline">
        {RULES.map((section) => (
          <section key={section.heading} className="border-b hairline py-10">
            <h2 className="display text-xl">
              {section.heading.toUpperCase()}
            </h2>

            <ol className="mt-6 space-y-5">
              {section.clauses.map((clause, i) => {
                n += 1;
                return (
                  <li
                    key={i}
                    className="flex flex-col gap-2 sm:flex-row sm:gap-6"
                  >
                    <span className="label shrink-0 tabular-nums text-muted sm:w-10 sm:pt-[2px]">
                      {String(n).padStart(2, "0")}
                    </span>

                    <div className="max-w-[62ch]">
                      {clause.text && (
                        <p
                          className={
                            clause.verbatim
                              ? // The attorney's wording. Given its own
                                // rule so it reads as quoted rather than
                                // paraphrased, and never reflowed.
                                "border-l-2 border-acid pl-5 leading-relaxed"
                              : "leading-relaxed"
                          }
                        >
                          {clause.text}
                        </p>
                      )}

                      {clause.pending && (
                        /* An answer only the shop can give. Marked in
                           place rather than as a banner at the top: the
                           rest of the page is finished, and a reader
                           should meet the gap in the clause it belongs
                           to rather than be warned about the whole
                           document. */
                        <p
                          className={`text-amber ${clause.text ? "mt-3" : ""}`}
                        >
                          <span className="label">To be confirmed · </span>
                          <span className="leading-relaxed">
                            {clause.pending}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-12 max-w-[62ch]">
        <h2 className="display text-xl">QUESTIONS</h2>
        <p className="mt-4 leading-relaxed text-muted">
          Ask before you buy, not after. Call the shop on{" "}
          <a href={SHOP_PHONE_HREF} className="text-bone underline">
            {SHOP_PHONE_DISPLAY}
          </a>{" "}
          and someone will talk you through any clause on this page.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Link href="/games" className="cta-primary">
          See the games
        </Link>
        <a href={SHOP_PHONE_HREF} className="cta-secondary">
          Call {SHOP_PHONE_DISPLAY}
        </a>
      </div>
    </div>
  );
}

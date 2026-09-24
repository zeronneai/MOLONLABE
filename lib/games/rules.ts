// The official sweepstakes rules.
//
// One source of truth. The rules page renders this; the short eligibility
// line under every "Official rules" link comes from here too, so the
// summary on a game page and the terms themselves cannot drift apart.
// That is the same reasoning as lib/legal.ts, and it exists because the
// eligibility sentence was already duplicated verbatim in two files.
//
// WHAT THESE ARE AND ARE NOT
//
// Every clause below describes something the system actually does. They
// were written against the code, not against a template of what rules
// usually say, and each one can be pointed at its implementation:
//
//   fixed spots, fixed price   games.total_spots, games.spot_price_cents
//   sales tax                  lib/cart/pricing.ts, settings.commerce
//   final sale                 lib/games/terms.ts, lib/legal.ts
//   no per-order limit         removed; the bound is what is left
//   numbers assigned           claim_game_spots, lowest open first
//   spots held then released   claim_game_spots / release_game_spots
//   runs until it fills        games.status open -> full
//   early drawing              winners.drawn_early, winners.unsold_spots
//   one entry per sold spot    lib/draw/select.ts, weight 1 per spot
//   recorded seed              winners.seed / ticket / entry_total / pool
//   names on the board         game_spots.show_name, opt-in, off by default
//   winner shown redacted      redactName in lib/draw/select.ts
//
// Nothing here promises a thing that is not built. There is no clause
// about limitation of liability, arbitration, publicity rights or prize
// substitution, because none of those is a behaviour of this system and
// inventing them would be writing law rather than describing a service.
// If the shop's attorney wants them, they are additions, not corrections.
//
// THE FIREARM CLAUSE IS THE ATTORNEY'S, VERBATIM. It is imported from
// lib/legal.ts rather than retyped, so there is exactly one copy of it in
// the repository and no way for this page to carry a reworded variant.

import { FIREARM_DISCLAIMER, PICKUP_NOTICE } from "@/lib/legal";

/**
 * Three things only the shop can decide. They are rendered in place,
 * inside the clause they belong to, rather than collected in a warning
 * box at the top — a reader meets each one exactly where it matters, and
 * the rest of the page reads as finished because it is.
 *
 * Listed in docs/content-needed.md as well, so they are visible to
 * whoever is chasing the shop rather than only to whoever opens the page.
 */
export const RULES_NEEDS_SHOP = {
  claimWindow: "How long the winner has to respond — the shop to confirm.",
  unclaimed: "What happens to an unclaimed prize — the shop to confirm.",
  eligibility:
    "Any limit by state or residency beyond the age requirement — the shop to confirm.",
} as const;

/**
 * Clauses waiting on the attorney since the terminology ruling.
 *
 * The ruling: what a customer buys is a guide to the featured piece, and
 * entry into the drawing comes with it. Every clause below that used one
 * of the old words ("spot", "ticket") was legal wording, frozen until the
 * attorney returns it, so it has NOT been reworded here. Each is replaced
 * by a line saying what the clause covers and that its wording is
 * awaited. Nothing on this list is a statement of the rules.
 *
 * The previous text of each, for the attorney to work from, is in
 * docs/wording.md. It is not kept here because it is exactly the wording
 * that may no longer be shown, and scripts/check-copy.mjs would rightly
 * refuse it.
 */
export const RULES_NEEDS_ATTORNEY = {
  age: "Minimum age to buy a guide and to win.",
  fixedPool: "How many guides a drop offers and at what price, and that neither changes while it runs.",
  purchase: "That buying a guide is a purchase, and how sales tax applies to it.",
  finalSale: "Refunds, exchanges and transfers.",
  limits: "Limits on how many guides one person or one order may buy.",
  numbering: "How guide numbers are assigned.",
  cartMerge: "Adding more guides to a cart that already holds some from the same drop.",
  holds: "Guide numbers held during checkout, and released if the payment does not complete.",
  noFreeRoute: "Whether there is any way to enter the drawing without buying a guide.",
  duration: "How long a drop runs.",
  earlyDraw: "Holding the drawing before every guide is sold.",
  pool: "Which guides are in the drawing.",
  odds: "Each guide's chance of winning.",
  seed: "The recorded random seed, and how a drawing can be checked afterwards.",
  contact: "How the shop contacts the winner, and keeping contact details current.",
  publicNames: "Whether buyers' names appear anywhere public.",
  summaryFinalSale: "Final-sale sentence",
} as const;

export type RuleClause = {
  text: string;
  /** Rendered inline, marked as outstanding. */
  pending?: string;
  /** Rendered inline, marked as waiting on the attorney's wording. */
  attorney?: string;
  /** Set for the attorney's wording, which is never reflowed or edited. */
  verbatim?: boolean;
};

export type RuleSection = {
  heading: string;
  clauses: RuleClause[];
};

/**
 * The current sales tax rate, written as a figure rather than read from
 * the database.
 *
 * It IS configurable — settings.commerce.tax_rate_bps, default 825 — so
 * reading it live looks like the more honest choice. It is not. The
 * settings table lets the anonymous role read two keys, `game_difficulty`
 * and an enabled offer, and `commerce` is not one of them. A public page
 * asking for it gets an empty result and falls back to the default,
 * silently, whatever the owner has set. That is the same empty-set trap
 * that made every completed game render "0 / 5", and a page that looks
 * live while always printing the default is worse than one that states a
 * figure plainly.
 *
 * So the clause names the rate and says the checkout total governs, which
 * is true no matter what the setting says.
 */
export const SALES_TAX_DISPLAY = "8.25%";

export const RULES: RuleSection[] = [
  {
    heading: "Who can take part",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.age },
      {
        text: "You must be able to receive a firearm lawfully under federal, state and local law. If you cannot, you cannot take part.",
      },
      {
        text: "",
        pending: RULES_NEEDS_SHOP.eligibility,
      },
    ],
  },
  {
    heading: "How guides work",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.fixedPool },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.purchase },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.finalSale },
      {
        // Fact for the attorney: there is no limit per person or per
        // order. The only bound is how many guides are left.
        text: "",
        attorney: RULES_NEEDS_ATTORNEY.limits,
      },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.numbering },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.cartMerge },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.holds },
      {
        // Fact for the attorney: there is no free or alternative route.
        // The shop decided that deliberately; see lib/legal.ts.
        text: "",
        attorney: RULES_NEEDS_ATTORNEY.noFreeRoute,
      },
    ],
  },
  {
    heading: "When a game closes",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.duration },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.earlyDraw },
    ],
  },
  {
    heading: "How the winner is chosen",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.pool },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.odds },
      { text: "", attorney: RULES_NEEDS_ATTORNEY.seed },
      {
        text: "A game is drawn once. A game that already has a winner cannot be drawn again.",
      },
    ],
  },
  {
    heading: "Claiming a prize",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.contact },
      {
        text: "",
        pending: RULES_NEEDS_SHOP.claimWindow,
      },
      {
        text: "",
        pending: RULES_NEEDS_SHOP.unclaimed,
      },
    ],
  },
  {
    heading: "Firearm prizes",
    clauses: [
      {
        text: FIREARM_DISCLAIMER,
        verbatim: true,
      },
      {
        text: PICKUP_NOTICE,
      },
      {
        text: "If the background check does not clear, or the transfer would be unlawful where you are, the shop cannot release the firearm to you.",
      },
    ],
  },
  {
    heading: "Your name and details",
    clauses: [
      { text: "", attorney: RULES_NEEDS_ATTORNEY.publicNames },
      {
        text: "A winner is published the same way — first name and last initial, nothing more.",
      },
    ],
  },
];

/**
 * The one-line summary printed under every "Official rules" link.
 *
 * It was duplicated word for word in two page files, which is how a
 * summary ends up saying something the rules no longer do. It now says
 * the same two things the eligibility section says — the age and the
 * lawful-possession requirement — and there is one copy of it.
 */
export const ELIGIBILITY_SUMMARY =
  "Open to entrants 21 or older who may lawfully take possession of a firearm under federal, state and local law. [Final-sale sentence: awaiting the attorney's wording.] Void where prohibited.";

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
 * Clauses whose wording is still being settled.
 *
 * Since the terminology ruling, a clause that used one of the old words
 * ("spot", "ticket") is not reworded here. It shows a line saying what
 * it covers and that its wording is to be confirmed. The client returned
 * wording for most of them on 2026-09-25 (applied below); these are the
 * ones still open. Their previous text is in docs/wording.md.
 *
 * `seed` is held on purpose. The client's draft said names go on a wheel
 * that is spun and picked by hand, which is not how the drawing works:
 * one guide number is picked by a recorded random seed. Publishing that
 * would describe a drawing that does not happen.
 */
export const RULES_PENDING_WORDING = {
  fixedPool: "How many guides a drop offers and at what price, and that neither changes while it runs.",
  numbering: "How guide numbers are assigned.",
  cartMerge: "Adding more guides to a cart that already holds some from the same drop.",
  holds: "Guide numbers held during checkout, and released if the payment does not complete.",
  pool: "Which guides are in the drawing.",
  odds: "Each guide's chance of winning.",
  seed: "How the winner is picked, and how a drawing can be checked afterwards.",
  publicNames: "Whether buyers' names appear anywhere public.",
} as const;

/**
 * The client's eligibility paragraph, verbatim (2026-09-25). Never
 * reflowed or edited; tests/browser/rules.mjs checks it character for
 * character.
 */
export const CLIENT_ELIGIBILITY =
  "Prize eligibility and transfer are subject to all applicable federal, state, and local laws. The potential winner must be legally eligible to receive and possess the firearm in their jurisdiction. Any required firearm transfer will be completed through a Federal Firearms Licensee (FFL) in accordance with applicable law. No firearm will be transferred or delivered where prohibited by law.";

/** The Drops page's description. The client's wording, 2026-09-25, verbatim. */
export const DROPS_INTRO =
  "Every drop sells a set number of guides to its featured piece, at a set price, and each guide comes with entry into the drawing. When the last guide goes, the winner is drawn. No end date, no countdown. It runs until all guides are out.";

/** Stated plainly and prominently, at the client's instruction. */
export const NO_REFUNDS = "No refunds or exchanges.";

export type RuleClause = {
  text: string;
  /** Rendered inline, marked as wording still to be confirmed. */
  pending?: string;
  /** Set for wording that is quoted exactly and never reflowed or edited. */
  verbatim?: boolean;
  /** Set it apart at display size rather than as body copy. */
  prominent?: boolean;
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
      { text: "You must be 21 years or older to buy a guide and to win." },
      {
        text: "You must be able to receive a firearm lawfully under federal, state and local law. If you cannot, you cannot take part.",
      },
      { text: CLIENT_ELIGIBILITY, verbatim: true },
    ],
  },
  {
    heading: "How guides work",
    clauses: [
      { text: "", pending: RULES_PENDING_WORDING.fixedPool },
      { text: `All purchases are subject to Texas sales tax at ${SALES_TAX_DISPLAY}.` },
      { text: NO_REFUNDS, prominent: true },
      {
        // The system's only bound is how many guides are left, which is
        // never more than the drop's total.
        text: "A person may buy as many guides as they want, up to the total offered in that drop.",
      },
      { text: "", pending: RULES_PENDING_WORDING.numbering },
      { text: "", pending: RULES_PENDING_WORDING.cartMerge },
      { text: "", pending: RULES_PENDING_WORDING.holds },
      { text: "Entry requires purchasing a guide. There are no free entries." },
    ],
  },
  {
    heading: "When a game closes",
    clauses: [
      { text: "A drop runs until every guide is purchased." },
    ],
  },
  {
    heading: "How the winner is chosen",
    clauses: [
      { text: "", pending: RULES_PENDING_WORDING.pool },
      { text: "", pending: RULES_PENDING_WORDING.odds },
      { text: "", pending: RULES_PENDING_WORDING.seed },
      {
        text: "A game is drawn once. A game that already has a winner cannot be drawn again.",
      },
    ],
  },
  {
    heading: "Claiming a prize",
    clauses: [
      {
        text: "By purchasing a guide, the buyer agrees to provide their full name, email and phone number so the shop can contact them if they win.",
      },
      {
        text: "The winner has one week from being contacted to confirm and claim the prize. If they do not, the prize returns to the shop.",
      },
      {
        // Enforced, not just stated: a drawn featured piece never returns
        // to the website (getPrizeItemStates in lib/games/queries.ts).
        text: "Unclaimed prizes are sold in store only and are not listed on the website again.",
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
      { text: "", pending: RULES_PENDING_WORDING.publicNames },
      {
        text: "A winner is published the same way: first name and last initial, nothing more.",
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
  `Open to entrants 21 or older who may lawfully take possession of a firearm under federal, state and local law. ${NO_REFUNDS} Void where prohibited.`;

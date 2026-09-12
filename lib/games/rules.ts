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
//   25 per order               MAX_SPOTS_PER_ORDER in lib/games/types.ts
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
import { MAX_SPOTS_PER_ORDER } from "./types";

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

export type RuleClause = {
  text: string;
  /** Rendered inline, marked as outstanding. */
  pending?: string;
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
      {
        text: "You must be 21 or older to buy a spot or to win a prize.",
      },
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
    heading: "How spots work",
    clauses: [
      {
        text: "Each game offers a fixed number of spots at a fixed price. Both are set when the game opens and neither changes while it runs.",
      },
      {
        text: `Buying a spot is a purchase, not an entry fee. Texas sales tax is added at checkout at the rate in force at the time — currently ${SALES_TAX_DISPLAY}. The total shown at checkout is the amount you pay.`,
      },
      {
        text: "Spot purchases are final. No refunds, no exchanges, no transfers. This applies whether or not you win.",
      },
      {
        text: `You may buy as many spots as you like while spots remain, up to ${MAX_SPOTS_PER_ORDER} in a single order. To take more than that, place another order.`,
      },
      {
        text: "Your spots are held while you check out and are released back to the game if the payment does not complete. A spot is only yours once payment succeeds.",
      },
      {
        // Stated as fact rather than left out. A rules page that simply
        // says nothing about a free route reads as an oversight; the
        // shop made this decision deliberately and the terms should show
        // that it was made. See the note in lib/legal.ts.
        text: "A spot can only be bought. There is no free or alternative way to get one.",
      },
    ],
  },
  {
    heading: "When a game closes",
    clauses: [
      {
        text: "A game runs until every spot is sold. There is no end date and no countdown.",
      },
      {
        text: "The shop may hold the drawing before every spot is sold, at its sole discretion. Where that happens, the number of spots left unsold is recorded and shown on the game.",
      },
    ],
  },
  {
    heading: "How the winner is chosen",
    clauses: [
      {
        text: "One spot is drawn at random from the spots that have sold. Unsold spots are not in the drawing.",
      },
      {
        text: "Every sold spot has the same chance. Someone holding five spots therefore has five times the chance of someone holding one.",
      },
      {
        text: "The drawing uses a recorded random seed. The shop keeps that seed, the winning spot number and the number of spots sold, so the drawing can be run again from the record and checked against the result that was announced.",
      },
      {
        text: "A game is drawn once. A game that already has a winner cannot be drawn again.",
      },
    ],
  },
  {
    heading: "Claiming a prize",
    clauses: [
      {
        text: "The shop contacts the winner directly, using the name, email address and phone number given when the spots were bought. Keep those details current — they are the only way the shop has to reach you.",
      },
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
      {
        text: "Spots are anonymous on the public board by default. A first name and last initial appear only if you ticked the box at checkout asking for that. Your email address and phone number are never shown.",
      },
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
  "Open to entrants 21 or older who may lawfully take possession of a firearm under federal, state and local law. Spot purchases are final. Void where prohibited.";

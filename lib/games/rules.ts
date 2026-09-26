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
//   fixed count, fixed price   games.total_spots, games.spot_price_cents,
//                              locked by refuse_pool_change
//   sales tax                  lib/cart/pricing.ts, settings.commerce
//   final sale                 lib/games/terms.ts, lib/legal.ts
//   no per-order limit         removed; the bound is what is left
//   numbers assigned           claim_game_spots, lowest open first
//   one drop per cart, merged  lib/cart/store.tsx addSpots, lib/cart/pricing.ts
//   held then released         claim_game_spots / release_game_spots, and
//                              stale holds after 15 minutes
//   runs until it fills        games.status open -> full
//   no early draw              commitDraw, and refuse_early_draw on winners
//   one entry per sold guide   lib/draw/select.ts, weight 1 per guide
//   the wheel and the roster   components/draw/DrawStage.tsx, lib/draw/roster.ts
//   names on the broadcast     BROADCAST_NOTICE at checkout, stored on the
//                              order; no acknowledgement, no name
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
 * Clauses drafted by the agency on 2026-09-26 from how the system
 * actually behaves, for the client to confirm as one set.
 *
 * Each was a placeholder since the terminology ruling. They describe
 * mechanics, not legal judgments, and each can be pointed at the code
 * listed at the top of this file. They are published with a "Wording to
 * be confirmed" marker until the client approves them; approving one
 * means removing `pending` from its clause below, nothing else.
 *
 * 12 and 13 are written to agree with the client's clause 14 (the wheel):
 * every sold guide is one entry, and a person's share of the wheel is the
 * number of guides they hold.
 */
export const RULES_DRAFTS = {
  fixedPool:
    "Each drop offers a set number of guides at a set price per guide. Both are fixed when the drop is created and do not change while it runs.",
  numbering:
    "Each guide in a drop has a number, from 1 up to the number of guides offered. Numbers are assigned automatically at checkout from those still available, lowest first. A buyer cannot choose them, and a buyer who gets several may not get consecutive numbers.",
  cartMerge:
    "Adding more guides from the same drop to a cart adds them to the guides already there, and the cart shows the running total before payment. A cart holds guides from one drop at a time. If fewer guides are left than the cart holds, the cart is reduced to the number left before payment.",
  holds:
    "Guide numbers are set aside when the buyer submits payment and are held while the payment is processed. If the payment does not go through, they are released at once. If the payment is interrupted, they are released after 15 minutes. A guide belongs to the buyer only once payment succeeds.",
  pool:
    "A drop is drawn only after every guide has been sold, and every guide sold is in the drawing.",
  odds:
    "Each guide is one entry, and every entry has the same chance of winning. A person holding five guides has five times the chance of a person holding one, and five times the share of the wheel.",
  publicNames:
    "This website shows how many guides a drop has left, never who bought them. During the drawing, each buyer's first name and last initial appear on screen, as stated at checkout. A buyer who bought before checkout stated this appears by guide number instead. Email addresses, phone numbers and full surnames are never shown.",
} as const;

/**
 * The client's eligibility paragraph, verbatim (2026-09-25). Never
 * reflowed or edited; tests/browser/rules.mjs checks it character for
 * character.
 */
export const CLIENT_ELIGIBILITY =
  "Prize eligibility and transfer are subject to all applicable federal, state, and local laws. The potential winner must be legally eligible to receive and possess the firearm in their jurisdiction. Any required firearm transfer will be completed through a Federal Firearms Licensee (FFL) in accordance with applicable law. No firearm will be transferred or delivered where prohibited by law.";

/**
 * How the winner is picked. The client's wording, 2026-09-25, verbatim.
 *
 * Every sentence is a behaviour of the draw presentation, and the last
 * one before "The result is recorded" is a promise it keeps by
 * construction: the roster screen shows every buyer and their guide count
 * before the wheel can be spun, and the draw refuses to run if the guides
 * sold changed after the roster was shown (components/draw/DrawStage.tsx,
 * commitDraw). The wheel's wedges are sized by guides held, which is the
 * weighting; the pick itself is the seeded selection, recorded before the
 * wheel turns, and the wheel is steered to it.
 */
export const CLIENT_DRAW_METHOD =
  "The winner is selected by an electronic name wheel, weighted by the number of guides each person holds. The drawing is run at the shop, broadcast live on our Instagram, @molonlabe.fa, and saved as a reel. Before the wheel is spun, every entry is shown on screen so viewers can confirm all buyers were included. The result is recorded.";

/** The Drops page's description. The client's wording, 2026-09-25, verbatim. */
export const DROPS_INTRO =
  "Every drop sells a set number of guides to its featured piece, at a set price, and each guide comes with entry into the drawing. When the last guide goes, the winner is drawn. No end date, no countdown. It runs until all guides are out.";

/** Stated plainly and prominently, at the client's instruction. */
export const NO_REFUNDS = "No refunds or exchanges.";

export type RuleClause = {
  text: string;
  /** A draft, published with a "Wording to be confirmed" marker. */
  pending?: boolean;
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
      // The lawful-possession clause that stood here was cut on 2026-09-26
      // at the client's instruction: it repeated this paragraph.
      { text: CLIENT_ELIGIBILITY, verbatim: true },
    ],
  },
  {
    heading: "How guides work",
    clauses: [
      { text: RULES_DRAFTS.fixedPool, pending: true },
      { text: `All purchases are subject to Texas sales tax at ${SALES_TAX_DISPLAY}.` },
      { text: NO_REFUNDS, prominent: true },
      {
        // The system's only bound is how many guides are left, which is
        // never more than the drop's total.
        text: "A person may buy as many guides as they want, up to the total offered in that drop.",
      },
      { text: RULES_DRAFTS.numbering, pending: true },
      { text: RULES_DRAFTS.cartMerge, pending: true },
      { text: RULES_DRAFTS.holds, pending: true },
      { text: "Entry requires purchasing a guide. There are no free entries." },
    ],
  },
  {
    heading: "When a drop closes",
    clauses: [
      { text: "A drop runs until every guide is purchased." },
    ],
  },
  {
    heading: "How the winner is chosen",
    clauses: [
      { text: RULES_DRAFTS.pool, pending: true },
      { text: RULES_DRAFTS.odds, pending: true },
      { text: CLIENT_DRAW_METHOD, verbatim: true },
      {
        text: "A drop is drawn once. A drop that already has a winner cannot be drawn again.",
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
      { text: RULES_DRAFTS.publicNames, pending: true },
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

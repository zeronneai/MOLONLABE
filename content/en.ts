// Site copy. Bilingual-ready: es.ts mirrors this shape when Spanish ships.

// The deliberate echo: this string is the hero's payoff line AND the
// /inventory page headline. One constant so they can never drift apart.
export const IN_THE_CASE = "IN THE CASE.";

export const heroCopy = {
  // scroll-progress windows for the scrub lines; one visible at a time
  lines: [
    { from: 0.1, to: 0.3, text: "GOOD AIM IS HALF OF IT." },
    {
      from: 0.35,
      to: 0.55,
      text: `THE OTHER HALF IS ${IN_THE_CASE}`,
      mobileText: `THE REST IS ${IN_THE_CASE}`,
    },
    { from: 0.6, to: 0.8, text: "COME GET YOURS." },
  ],
  label: "Molon Labe Firearms × SunCity Outdoors — El Paso, TX",
  headline: [IN_THE_CASE, "ON THE SITE.", "RIGHT NOW."],
  primaryCta: "View Inventory",
  secondaryCta: "Current Feature",
};

// The three things only the owner knows.
//
// Everything else in the guide is assembled from the item that is already
// in the catalogue. These three are the reason the guide is worth what
// somebody pays for it, and they are the whole difference between a guide
// and the product page with a border round it.
//
// One definition, used by four things that must not drift apart: the
// admin form, the server action that refuses to save without them, the
// PDF that prints them, and the test that checks all three.

export type GuideFieldKey = "guide_why" | "guide_care" | "guide_pairs";

/**
 * How much text counts as filled in.
 *
 * Not a style rule — a floor under "n/a". Forty characters is one plain
 * sentence, which is the least that can honestly answer any of the three
 * questions below. The form shows the count as it is typed rather than
 * failing on submit, so nobody meets it by accident or misses it by one.
 */
export const GUIDE_MIN_CHARS = 40;

export type GuideField = {
  key: GuideFieldKey;
  /** The admin form's label. */
  label: string;
  /** The question being asked, in the owner's terms. */
  prompt: string;
  /** An example, in the voice a gun shop owner actually writes in. */
  placeholder: string;
  /** The heading this becomes in the PDF. */
  heading: string;
};

export const GUIDE_FIELDS: readonly GuideField[] = [
  {
    key: "guide_why",
    label: "Why you chose this piece",
    prompt:
      "What made this one worth putting up. What it does well, who it suits, what you would tell somebody across the counter.",
    placeholder:
      "I have carried one of these for six years. The trigger is better than anything else at the price and the thing has never once choked on cheap ammunition…",
    heading: "WHY THIS ONE",
  },
  {
    key: "guide_care",
    label: "Maintenance and handling",
    prompt:
      "How to look after it. Cleaning interval, what to use, what to leave alone, anything about this model that catches people out.",
    placeholder:
      "Strip it every five hundred rounds. A light oil on the rails and nothing at all in the firing pin channel. It collects and it will slow the pin down in the cold…",
    heading: "LOOKING AFTER IT",
  },
  {
    key: "guide_pairs",
    label: "What you would pair with it",
    prompt:
      "The optic, the holster, the sling, the ammunition. What you would send somebody out of the door with.",
    placeholder:
      "A Holosun 507C sits right on it with no adapter. If it is going in a truck, a padded case rather than a soft sleeve…",
    heading: "WHAT WE WOULD PAIR WITH IT",
  },
] as const;

export type GuideValues = Record<GuideFieldKey, string | null | undefined>;

/**
 * What is wrong with each field, keyed by field, empty when nothing is.
 *
 * Deliberately returns a map rather than a boolean: the admin marks the
 * offending field, and a single "fill in the guide" message would make
 * the owner hunt for which one.
 */
export function guideFieldErrors(values: GuideValues): Partial<Record<GuideFieldKey, string>> {
  const errors: Partial<Record<GuideFieldKey, string>> = {};
  for (const field of GUIDE_FIELDS) {
    const text = (values[field.key] ?? "").trim();
    if (text.length === 0) {
      errors[field.key] = `${field.label} is empty. This is what the customer is paying for.`;
    } else if (text.length < GUIDE_MIN_CHARS) {
      errors[field.key] =
        `${field.label} is ${text.length} characters. It needs at least ${GUIDE_MIN_CHARS}: a sentence, not a note to yourself.`;
    }
  }
  return errors;
}

export function isGuideComplete(values: GuideValues): boolean {
  return Object.keys(guideFieldErrors(values)).length === 0;
}

/** The first complaint, for a form that shows one message at a time. */
export function firstGuideError(values: GuideValues): string | null {
  const errors = guideFieldErrors(values);
  for (const field of GUIDE_FIELDS) {
    const message = errors[field.key];
    if (message) return message;
  }
  return null;
}

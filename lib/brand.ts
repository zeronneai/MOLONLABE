// Brand assets and shop contact details — reference from here, never
// inline. See DESIGN.md section 0.

export const LOGO_URL =
  "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786206690/molon-labe-logo-transparent_fvttuz.png";

// The shop's public line. One source of truth: display form for humans,
// E.164 for tel: hrefs and structured data. Never write either inline.
export const SHOP_PHONE_DISPLAY = "(915) 497-0541";
export const SHOP_PHONE_E164 = "+19154970541";
export const SHOP_PHONE_HREF = `tel:${SHOP_PHONE_E164}`;

/**
 * WhatsApp is off until the shop confirms the line actually has it — a
 * wa.me link to a number without WhatsApp opens an error page, which is
 * worse than no button at all. Flip this to true to bring every WhatsApp
 * CTA back; the code paths are intact behind it.
 */
export const WHATSAPP_ENABLED = false;

export function whatsappUrl(message: string): string {
  return `https://wa.me/${SHOP_PHONE_E164.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

export const SHOP_NAME = "Molon Labe Firearms x SunCity Outdoors";
export const SHOP_SHORT_NAME = "MLF x SCO";

// Confirmed with the shop, not inferred. The suite designation is part
// of the address and belongs in the markup as well as on the page.
export const SHOP_ADDRESS = {
  street: "10024 Montana Ave Ste A",
  city: "El Paso",
  region: "TX",
  postalCode: "79925",
  country: "US",
};

export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${SHOP_ADDRESS.street}, ${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.region}`,
)}`;

/**
 * Opening hours in one place, confirmed with the shop. `opens`/`closes`
 * are 24-hour because schema.org requires that format; `display` is
 * derived from them, so a time can only be changed in one place and the
 * page, the footer and the JSON-LD all move together.
 */
function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

const HOURS = [
  { label: "Mon – Fri", days: ["Mo", "Tu", "We", "Th", "Fr"], opens: "11:00", closes: "19:00" },
  { label: "Saturday", days: ["Sa"], opens: "11:00", closes: "18:00" },
  { label: "Sunday", days: ["Su"], opens: "11:00", closes: "17:00" },
];

export const SHOP_HOURS = HOURS.map((h) => ({
  ...h,
  display: `${to12Hour(h.opens)} – ${to12Hour(h.closes)}`,
}));

/**
 * Who the shop calls when the site does something it should not.
 *
 * PLACEHOLDER — the agency's real number has not been supplied. It is
 * printed in the one email where the owner needs a person rather than a
 * page: the card-charged-but-order-not-saved alert. Tracked in
 * docs/content-needed.md.
 */
export const AGENCY_NAME = "Purple Roots";
export const AGENCY_CONTACT = "(number to be supplied)";

export const INSTAGRAM_HANDLE = "@molonlabe.fa";
export const INSTAGRAM_URL = "https://instagram.com/molonlabe.fa";

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL per environment. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://molonlabefirearms.com"
).replace(/\/$/, "");

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

export const SHOP_ADDRESS = {
  street: "10024 Montana Ave",
  city: "El Paso",
  region: "TX",
  postalCode: "79925",
  country: "US",
};

export const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  `${SHOP_ADDRESS.street}, ${SHOP_ADDRESS.city}, ${SHOP_ADDRESS.region}`,
)}`;

/**
 * Opening hours in one place. `days` uses schema.org's two-letter codes so
 * the JSON-LD and the rendered table can never disagree — change a time
 * here and both move.
 */
export const SHOP_HOURS = [
  { label: "Mon – Fri", days: ["Mo", "Tu", "We", "Th", "Fr"], opens: "11:00", closes: "19:00" },
  { label: "Saturday", days: ["Sa"], opens: "11:00", closes: "18:00" },
  { label: "Sunday", days: ["Su"], opens: "11:00", closes: "17:00" },
];

export const INSTAGRAM_HANDLE = "@molonlabe.fa";
export const INSTAGRAM_URL = "https://instagram.com/molonlabe.fa";

/** Canonical origin. Set NEXT_PUBLIC_SITE_URL per environment. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://molonlabefirearms.com"
).replace(/\/$/, "");

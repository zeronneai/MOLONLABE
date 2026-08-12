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

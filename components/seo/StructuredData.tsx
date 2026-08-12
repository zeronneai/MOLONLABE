// Structured data. Every value comes from lib/brand or the database row —
// nothing here is retyped, so the markup cannot drift from what the page
// actually says.

import {
  LOGO_URL,
  SHOP_ADDRESS,
  SHOP_HOURS,
  SHOP_NAME,
  SHOP_PHONE_E164,
  SITE_URL,
  INSTAGRAM_URL,
} from "@/lib/brand";
import type { ItemRow } from "@/lib/database.types";

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // The payload is ours, not user input; escape the one sequence that
      // could close the tag early anyway.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export function LocalBusinessJsonLd() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "GunStore",
        "@id": `${SITE_URL}/#business`,
        name: SHOP_NAME,
        url: SITE_URL,
        image: LOGO_URL,
        logo: LOGO_URL,
        telephone: SHOP_PHONE_E164,
        priceRange: "$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: SHOP_ADDRESS.street,
          addressLocality: SHOP_ADDRESS.city,
          addressRegion: SHOP_ADDRESS.region,
          postalCode: SHOP_ADDRESS.postalCode,
          addressCountry: SHOP_ADDRESS.country,
        },
        openingHoursSpecification: SHOP_HOURS.map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: h.days,
          opens: h.opens,
          closes: h.closes,
        })),
        sameAs: [INSTAGRAM_URL],
      }}
    />
  );
}

export function ProductJsonLd({
  item,
  image,
}: {
  item: ItemRow;
  image?: string;
}) {
  // Prices are "Call for price" in this shop, so there is no numeric offer
  // to publish. Availability is still meaningful and honest.
  const availability =
    item.status === "available"
      ? "https://schema.org/InStock"
      : item.status === "reserved"
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/OutOfStock";

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: item.name,
        description: item.short_desc ?? item.long_desc ?? undefined,
        category: item.category,
        ...(item.brand ? { brand: { "@type": "Brand", name: item.brand } } : {}),
        ...(image ? { image: [image] } : {}),
        url: `${SITE_URL}/inventory/${item.slug}`,
        offers: {
          "@type": "Offer",
          availability,
          priceCurrency: "USD",
          url: `${SITE_URL}/inventory/${item.slug}`,
          seller: { "@id": `${SITE_URL}/#business` },
          // No price is published: everything here is sold in person.
          priceSpecification: {
            "@type": "PriceSpecification",
            valueAddedTaxIncluded: false,
          },
        },
      }}
    />
  );
}

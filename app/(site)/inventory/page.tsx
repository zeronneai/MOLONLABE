import { permanentRedirect } from "next/navigation";

/**
 * /inventory was the firearms index before the site split into three
 * surfaces. It is now /in-the-case.
 *
 * Kept as a permanent redirect rather than deleted: the URL is on printed
 * cards and in whatever anyone has already shared, and a 404 is a worse
 * answer than the right page. The product pages under /inventory/[slug]
 * are untouched — one product has one URL whichever surface links to it.
 */
export default function InventoryIndexRedirect(): never {
  permanentRedirect("/in-the-case");
}

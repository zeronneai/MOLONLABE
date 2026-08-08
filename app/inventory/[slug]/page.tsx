import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getItemBySlug,
  getRelatedItems,
  itemImages,
  itemSpecs,
  itemStatus,
  toIndexItem,
} from "@/lib/db/items";
import Gallery from "@/components/inventory/Gallery";
import VideoBlock from "@/components/inventory/VideoBlock";
import EditorialIndex from "@/components/inventory/EditorialIndex";

export const dynamic = "force-dynamic";

const SHOP_PHONE = "+19150000000"; // TODO: confirm the shop's public number
const STATUS_COLOR = {
  available: "text-acid",
  reserved: "text-muted",
  sold: "text-danger",
} as const;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) return { title: "Not found" };
  return {
    title: `${item.name} — Molon Labe Firearms x SunCity Outdoors`,
    description: item.short_desc ?? undefined,
  };
}

export default async function ItemPage({ params }: Params) {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) notFound();

  const images = itemImages(item);
  const specs = itemSpecs(item);
  const status = itemStatus(item);
  const related = (await getRelatedItems(item.category, item.slug)).map(toIndexItem);
  const whatsapp = `https://wa.me/${SHOP_PHONE.replace("+", "")}?text=${encodeURIComponent(
    `Inquiring about the ${item.name} (${item.slug})`,
  )}`;

  return (
    <div className="lg:flex">
      {/* Left half: sticky gallery, full viewport height, true 50vw */}
      <div className="lg:sticky lg:top-0 lg:h-svh lg:w-1/2 lg:self-start">
        <Gallery images={images} alt={item.name} />
      </div>

      {/* Right half: everything else, scrolling */}
      <div className="px-page pb-28 pt-8 lg:w-1/2 lg:px-12 lg:pb-0 lg:pt-28">
        <nav aria-label="Breadcrumb" className="label text-muted">
          <Link href="/inventory" className="transition-colors hover:text-bone">
            Inventory
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-acid">{item.category.toUpperCase()}</span>
        </nav>

        <h1 className="display mt-6 text-[clamp(2rem,3vw,2.75rem)]">
          {item.name.toUpperCase()}
        </h1>

        <div className="mt-5 flex items-center gap-5">
          <span className={`chip ${STATUS_COLOR[status]}`}>{status}</span>
          {item.brand && <span className="label text-muted">{item.brand}</span>}
        </div>

        <p className="mt-8 text-2xl font-extrabold tracking-[-0.02em]">
          {(item.price_display ?? "Call for price").toUpperCase()}
        </p>

        {item.short_desc && (
          <p className="mt-6 max-w-[60ch] text-muted">{item.short_desc}</p>
        )}

        {/* Video sits high, above the specs — deliberate */}
        {item.video_url && (
          <div className="mt-10">
            <VideoBlock src={item.video_url} poster={images[0]} name={item.name} />
          </div>
        )}

        {specs.length > 0 && (
          <section className="mt-12">
            <h2 className="label text-acid">Specifications</h2>
            <dl className="mt-6">
              {specs.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-8 border-b hairline py-3"
                >
                  <dt className="label text-muted">{label}</dt>
                  <dd className="text-right text-sm">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {item.long_desc && (
          <p className="mt-10 max-w-[60ch] text-sm leading-relaxed text-muted">
            {item.long_desc}
          </p>
        )}

        {/* CTA block: sticks to the viewport bottom once scrolled past.
            TODO step 5: INQUIRE opens the inquiry form drawer instead. */}
        <div className="sticky bottom-0 mt-12 hidden items-center gap-8 border-t hairline bg-ink py-5 lg:flex">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="cta-primary">
            Inquire about this
          </a>
          <a href={`tel:${SHOP_PHONE}`} className="cta-secondary">
            Call
          </a>
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="cta-secondary"
          >
            WhatsApp
          </a>
        </div>

        {related.length > 0 && (
          <section className="mt-16 pb-16">
            <h2 className="label text-acid">More like this</h2>
            <div className="mt-6">
              <EditorialIndex items={related} />
            </div>
          </section>
        )}
      </div>

      {/* Mobile: fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-3 border-t hairline bg-ink p-3 lg:hidden">
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-primary h-12 flex-1"
        >
          Inquire about this
        </a>
        <a
          href={`tel:${SHOP_PHONE}`}
          aria-label="Call the shop"
          className="flex w-12 items-center justify-center border border-bone transition-colors hover:border-acid"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-bone" aria-hidden="true">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
          </svg>
        </a>
      </div>
    </div>
  );
}

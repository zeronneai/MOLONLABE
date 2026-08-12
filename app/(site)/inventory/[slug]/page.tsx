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
import ItemCtas from "@/components/inventory/ItemCtas";
import { ProductJsonLd } from "@/components/seo/StructuredData";
import TrackView from "@/components/analytics/TrackView";

export const dynamic = "force-dynamic";

const STATUS_COLOR = {
  available: "text-acid",
  reserved: "text-amber",
  sold: "text-danger",
} as const;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const item = await getItemBySlug(slug);
  if (!item) return { title: "Not found" };
  return {
    title: item.name,
    description: item.short_desc ?? undefined,
    alternates: { canonical: `/inventory/${item.slug}` },
    openGraph: {
      type: "website",
      title: item.name,
      description: item.short_desc ?? undefined,
      url: `/inventory/${item.slug}`,
    },
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

  return (
    <div className="lg:flex">
      <ProductJsonLd item={item} image={images[0]} />
      <TrackView slug={item.slug} name={item.name} category={item.category} />
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
            <VideoBlock
              src={item.video_url}
              poster={images[0]}
              name={item.name}
              slug={item.slug}
            />
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

        <ItemCtas
          itemId={item.id}
          itemName={item.name}
          itemSlug={item.slug}
                  />

        {related.length > 0 && (
          <section className="mt-16 pb-16">
            <h2 className="label text-acid">More like this</h2>
            <div className="mt-6">
              <EditorialIndex items={related} />
            </div>
          </section>
        )}
      </div>

    </div>
  );
}

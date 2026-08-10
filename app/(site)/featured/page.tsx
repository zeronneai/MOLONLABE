import type { Metadata } from "next";
import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import Countdown from "@/components/home/Countdown";
import { getEntryCount, getLiveCampaign } from "@/lib/db/campaigns";
import { itemImages } from "@/lib/db/items";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Current Feature — Molon Labe Firearms x SunCity Outdoors",
  description:
    "The current sweepstakes feature at Molon Labe Firearms x SunCity Outdoors, El Paso, TX.",
};

// Placeholder page: the full fight-card layout with the entry form and
// rules lands in step 7. This keeps the route real in the meantime.
export default async function FeaturedPage() {
  const campaign = await getLiveCampaign();

  if (!campaign) {
    return (
      <div className="px-page pb-24 pt-[calc(72px+4rem)]">
        <p className="label text-acid">Featured</p>
        <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
          NOTHING ON
          <br />
          THE BLOCK.
        </h1>
        <p className="mt-6 max-w-md text-muted">
          The next feature is announced on Instagram first — @molonlabe.fa.
        </p>
      </div>
    );
  }

  const entries = await getEntryCount(campaign.id);
  const image = campaign.item ? itemImages(campaign.item)[0] : undefined;
  const name = campaign.item?.name ?? campaign.title;

  return (
    <div className="pb-24">
      {/* Prize, full bleed */}
      <section className="relative flex min-h-[70vh] items-end">
        {image && (
          <Image
            src={image}
            alt={name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(11,10,12,0.7) 0%, rgba(11,10,12,0.15) 35%, rgba(11,10,12,0.9) 100%)",
          }}
        />
        <div className="px-page relative flex w-full flex-wrap items-end justify-between gap-8 pb-12 pt-40">
          <div>
            <p className="label text-acid">Currently Featured</p>
            <h1 className="display mt-4 max-w-3xl text-[clamp(2.25rem,5vw,4.5rem)]">
              {name.toUpperCase()}
            </h1>
          </div>
          <div className="text-right">
            <div className="display text-[clamp(3rem,7vw,5.5rem)] leading-none tabular-nums">
              {entries}
            </div>
            <div className="label mt-2 text-muted">Entries claimed</div>
          </div>
        </div>
      </section>

      <section className="px-page mt-14">
        <Reveal>
          {campaign.description && (
            <p className="max-w-lg text-muted">{campaign.description}</p>
          )}
          {campaign.closes_at && (
            <div className="mt-10">
              <Countdown closesAt={campaign.closes_at} />
            </div>
          )}
          <div className="mt-12 border-t hairline pt-8">
            <p className="label text-muted">
              Entries open online soon — for now, enter in person at the shop.
              No purchase necessary.
            </p>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

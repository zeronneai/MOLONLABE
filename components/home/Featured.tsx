import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Countdown from "./Countdown";
import { getEntryCount, getLiveCampaign } from "@/lib/db/campaigns";
import { itemImages } from "@/lib/db/items";

export default async function Featured() {
  const campaign = await getLiveCampaign();

  if (!campaign) {
    return (
      <section className="px-page flex min-h-[40vh] flex-col justify-center py-20">
        <Reveal>
          <p className="label text-acid">Currently Featured</p>
          <h2 className="display mt-6 max-w-2xl text-[clamp(2rem,4vw,3.5rem)]">
            NOTHING ON THE BLOCK RIGHT NOW.
          </h2>
          <p className="mt-6 max-w-md text-muted">
            The next feature is announced on Instagram first. Follow
            @molonlabe.fa or check back.
          </p>
        </Reveal>
      </section>
    );
  }

  const entries = await getEntryCount(campaign.id);
  const image = campaign.item ? itemImages(campaign.item)[0] : undefined;
  const name = campaign.item?.name ?? campaign.title;

  return (
    <section className="grid min-h-[85vh] lg:grid-cols-[3fr_2fr]">
      {/* Left 60%: the pitch */}
      <div className="pl-page order-2 flex flex-col justify-center py-16 pr-8 lg:order-1 lg:py-24">
        <Reveal>
          <p className="label text-acid">Currently Featured</p>
          <h2 className="display mt-6 text-[clamp(2.25rem,4.5vw,4.5rem)]">
            {name.toUpperCase()}
          </h2>
          {campaign.description && (
            <p className="mt-6 max-w-md text-muted">{campaign.description}</p>
          )}
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-12 flex flex-wrap items-end gap-x-16 gap-y-8">
            <div>
              <div className="display text-[72px] leading-none tabular-nums">
                {entries}
              </div>
              <div className="label mt-2 text-muted">Entries claimed</div>
            </div>
            {campaign.closes_at && <Countdown closesAt={campaign.closes_at} />}
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-12">
            <Link href="/featured" className="cta-primary">
              See the feature
            </Link>
          </div>
        </Reveal>
      </div>

      {/* Right 40%: image bleeds off the right edge, full section height */}
      <div className="relative order-1 min-h-[50vh] bg-surface lg:order-2 lg:min-h-0">
        {image && (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        )}
      </div>
    </section>
  );
}

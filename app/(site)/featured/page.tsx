import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Countdown from "@/components/home/Countdown";
import EntryPacks from "@/components/entry/EntryPacks";
import FreeEntry from "@/components/entry/FreeEntry";
import { getLiveCampaign } from "@/lib/db/campaigns";
import { getEntrantTotal, getEntryTotal, getWinners } from "@/lib/db/entries";
import { itemImages } from "@/lib/db/items";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Current Feature — Molon Labe Firearms x SunCity Outdoors",
  description:
    "The current sweepstakes feature at Molon Labe Firearms x SunCity Outdoors, El Paso, TX. No purchase necessary to enter.",
};

const STEPS = [
  {
    n: "01",
    title: "Pick your entries",
    body: "Buy a pack, or take the free entry. A free entry is worth exactly what a purchased one is worth.",
  },
  {
    n: "02",
    title: "We draw at close",
    body: "When the clock runs out, one entry is drawn at random from every entry in the pot.",
  },
  {
    n: "03",
    title: "Collect in person",
    body: "The winner is contacted by email, and the transfer happens at the shop like any other sale.",
  },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default async function FeaturedPage() {
  const campaign = await getLiveCampaign();
  const winners = await getWinners();

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
        {winners.length > 0 && <PastWinners winners={winners} />}
        <RulesLink />
      </div>
    );
  }

  const [entries, entrants] = await Promise.all([
    getEntryTotal(campaign.id),
    getEntrantTotal(campaign.id),
  ]);
  const image = campaign.item ? itemImages(campaign.item)[0] : undefined;
  const name = campaign.item?.name ?? campaign.title;

  return (
    <div className="pb-24">
      {/* The prize. Name bottom left, counter bottom right. */}
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
            <div className="display text-[clamp(3rem,7vw,90px)] leading-none tabular-nums">
              {entries}
            </div>
            <div className="label mt-2 text-muted">Entries claimed</div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="px-page mt-14">
        <dl className="grid grid-cols-1 border-y hairline sm:grid-cols-3">
          <div className="border-b hairline py-8 sm:border-b-0 sm:border-r sm:pr-8">
            <dd className="display text-4xl tabular-nums">{entries}</dd>
            <dt className="label mt-2 text-muted">Entries claimed</dt>
          </div>
          <div className="border-b hairline py-8 sm:border-b-0 sm:border-r sm:px-8">
            {campaign.closes_at ? (
              <Countdown closesAt={campaign.closes_at} />
            ) : (
              <dd className="display text-4xl">OPEN</dd>
            )}
            <dt className="label mt-2 text-muted">Time remaining</dt>
          </div>
          <div className="py-8 sm:pl-8">
            <dd className="display text-4xl tabular-nums">{entrants}</dd>
            <dt className="label mt-2 text-muted">Entrants</dt>
          </div>
        </dl>
      </section>

      {campaign.description && (
        <section className="px-page mt-14">
          <p className="max-w-xl text-lg text-muted">{campaign.description}</p>
        </section>
      )}

      {/* How it works */}
      <section className="px-page mt-20">
        <Reveal>
          <h2 className="label text-acid">How it works</h2>
          <div className="mt-8 border-t hairline">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="flex flex-col gap-2 border-b hairline py-8 sm:flex-row sm:items-baseline sm:gap-10"
              >
                <span className="label shrink-0 text-muted sm:w-16">{step.n}</span>
                <h3 className="display w-full text-2xl sm:w-72 sm:shrink-0">
                  {step.title.toUpperCase()}
                </h3>
                <p className="max-w-[52ch] text-sm leading-relaxed text-muted">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Entry packs — the paid route, pending checkout */}
      <section className="px-page mt-20">
        <Reveal>
          <h2 className="label text-acid">Entry packs</h2>
          <div className="mt-8">
            <EntryPacks />
          </div>
        </Reveal>
      </section>

      {/* The free method — same page, same weight, its own box */}
      <section className="px-page mt-16">
        <Reveal>
          <FreeEntry campaignId={campaign.id} />
        </Reveal>
      </section>

      {winners.length > 0 && (
        <div className="px-page">
          <PastWinners winners={winners} />
        </div>
      )}

      <div className="px-page">
        <RulesLink />
      </div>
    </div>
  );
}

function PastWinners({
  winners,
}: {
  winners: { id: string; display_name: string; photo_url: string | null; drawn_at: string }[];
}) {
  return (
    <section className="mt-24">
      <h2 className="label text-acid">Past winners</h2>
      <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
        {winners.map((w) => (
          <li key={w.id}>
            <div className="aspect-square bg-surface-2">
              {w.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.photo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <p className="mt-3 font-extrabold tracking-[-0.02em]">{w.display_name}</p>
            <p className="label mt-1 text-muted">{fmtDate(w.drawn_at)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RulesLink() {
  return (
    <div className="mt-20 border-t hairline pt-8">
      <Link href="/sweepstakes-rules" className="cta-secondary">
        Official sweepstakes rules
      </Link>
      <p className="mt-2 max-w-[60ch] text-xs text-muted">
        No purchase necessary. A purchase does not improve your chances of
        winning. Void where prohibited.
      </p>
    </div>
  );
}

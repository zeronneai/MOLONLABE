import Image from "next/image";
import Reveal from "@/components/motion/Reveal";
import { SHOP_ADDRESS } from "@/lib/brand";

// The brief asks for the storefront and the ceiling install. Until that
// is shot, this frame stays empty rather than borrowing a product photo:
// a picture of a pistol under a heading about the counter says the wrong
// thing, and a neutral frame reads as deliberate. Set SHOP_IMAGE to the
// real photograph and it fills in with no other change.
const SHOP_IMAGE: string | null = null;

export default function ShopStory() {
  return (
    <section className="grid min-h-[70vh] lg:grid-cols-[2fr_3fr]">
      {/* Image bleeds off the LEFT edge — deliberate reversal of section B */}
      <div className="relative min-h-[45vh] bg-surface lg:min-h-0">
        {SHOP_IMAGE ? (
          <Image
            src={SHOP_IMAGE}
            alt="Inside the shop"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        ) : (
          // A held frame, not a broken one: the hairline and the label read
          // as composition rather than as a missing asset.
          <div className="absolute inset-0 flex items-end border-r hairline p-8">
            <p className="label text-muted">{SHOP_ADDRESS.street}</p>
          </div>
        )}
      </div>

      <div className="pr-page flex flex-col justify-center py-16 pl-8 lg:py-24">
        <Reveal>
          <p className="label text-acid">The Shop</p>
          <h2 className="display mt-6 max-w-xl text-[clamp(2rem,4vw,3.5rem)]">
            A COUNTER,
            <br />
            NOT A CHECKOUT.
          </h2>
          <p className="mt-6 max-w-lg text-muted">
            Molon Labe Firearms runs out of SunCity Outdoors on Montana Avenue.
            Everything on this site sits in the case behind the counter. Come
            handle it, ask questions, and if it&apos;s the one, it goes home
            with you the legal way — in person, through a licensed dealer.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-12 grid max-w-lg gap-10 sm:grid-cols-2">
            <div>
              <h3 className="label text-muted">Address</h3>
              <address className="mt-4 text-sm not-italic leading-relaxed">
                {SHOP_ADDRESS.street}
                <br />
                El Paso, TX
              </address>
            </div>
            <div>
              <h3 className="label text-muted">Hours</h3>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b hairline pb-1.5">
                  <dt className="text-muted">Mon – Fri</dt>
                  <dd>11 – 19</dd>
                </div>
                <div className="flex justify-between gap-4 border-b hairline pb-1.5">
                  <dt className="text-muted">Sat</dt>
                  <dd>11 – 18</dd>
                </div>
                <div className="flex justify-between gap-4 border-b hairline pb-1.5">
                  <dt className="text-muted">Sun</dt>
                  <dd>11 – 17</dd>
                </div>
              </dl>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

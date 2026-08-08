import Image from "next/image";
import Link from "next/link";

// Placeholder hero still until the shop's video loop is delivered.
const HERO_IMAGE =
  "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Revolver_on_black_velvet_2K_202608061301_boa0qr.jpg";

export default function Hero() {
  return (
    <section className="relative h-svh">
      <Image
        src={HERO_IMAGE}
        alt="Custom revolver on black velvet"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,10,12,0.7) 0%, rgba(11,10,12,0.15) 35%, rgba(11,10,12,0.9) 100%)",
        }}
      />

      {/* Content hangs bottom left. The right side stays empty. */}
      <div className="px-page absolute inset-x-0 bottom-0 pb-14 sm:pb-20">
        <p className="label text-acid">
          Molon Labe Firearms × SunCity Outdoors — El Paso, TX
        </p>
        <h1 className="display mt-6 max-w-4xl text-[clamp(2.5rem,6vw,5.5rem)]">
          IN THE CASE.
          <br />
          ON THE SITE.
          <br />
          RIGHT NOW.
        </h1>
        <div className="mt-10 flex flex-wrap items-center gap-x-10 gap-y-4">
          <Link href="/inventory" className="cta-primary">
            View Inventory
          </Link>
          <Link href="/featured" className="cta-secondary">
            Current Feature
          </Link>
        </div>
      </div>

      <div className="pr-page absolute bottom-14 right-0 hidden sm:block">
        <div className="scroll-rule" aria-hidden="true" />
      </div>
    </section>
  );
}

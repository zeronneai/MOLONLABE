import Image from "next/image";
import Link from "next/link";
import Reveal from "@/components/motion/Reveal";
import Countdown from "./Countdown";

// Hardcoded placeholder feature — becomes DB-driven in a later step.
const FEATURE_IMAGE =
  "https://res.cloudinary.com/dsprn0ew4/image/upload/v1786043151/Firearm_on_textured_surface_2K_202608061302_ln1qnw.jpg";

export default function Featured() {
  return (
    <section className="grid min-h-[85vh] lg:grid-cols-[3fr_2fr]">
      {/* Left 60%: the pitch */}
      <div className="pl-page order-2 flex flex-col justify-center py-16 pr-8 lg:order-1 lg:py-24">
        <Reveal>
          <p className="label text-acid">Currently Featured</p>
          <h2 className="display mt-6 text-[clamp(2.25rem,4.5vw,4.5rem)]">
            SIG MPX,
            <br />
            CARBON HANDGUARD
          </h2>
          <p className="mt-6 max-w-md text-muted">
            Folding brace, carbon fiber handguard, enclosed red dot. One will go
            home with somebody. Entries close soon.
          </p>
        </Reveal>

        <Reveal delay={60}>
          <div className="mt-12 flex flex-wrap items-end gap-x-16 gap-y-8">
            <div>
              <div className="display text-[72px] leading-none tabular-nums">
                312
              </div>
              <div className="label mt-2 text-muted">Entries claimed</div>
            </div>
            <Countdown closesAt="2026-09-01T00:00:00-06:00" />
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
      <div className="relative order-1 min-h-[50vh] lg:order-2 lg:min-h-0">
        <Image
          src={FEATURE_IMAGE}
          alt="SIG MPX with carbon fiber handguard"
          fill
          sizes="(min-width: 1024px) 40vw, 100vw"
          className="object-cover"
        />
      </div>
    </section>
  );
}

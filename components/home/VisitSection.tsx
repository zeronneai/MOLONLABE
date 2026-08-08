import Reveal from "@/components/motion/Reveal";

const DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=10024+Montana+Ave,+El+Paso,+TX";

export default function VisitSection() {
  return (
    <section className="grid min-h-[80vh] lg:grid-cols-2">
      {/* Contact hangs from the left rule */}
      <div className="pl-page flex flex-col justify-center py-16 pr-8 lg:py-24">
        <Reveal>
          <p className="label text-acid">Visit</p>
          <h2 className="display mt-6 text-[clamp(2rem,4vw,3.5rem)]">
            MONTANA AVE,
            <br />
            EL PASO.
          </h2>
          <address className="mt-6 max-w-md text-lg not-italic text-muted">
            10024 Montana Ave, El Paso, TX
          </address>
        </Reveal>

        <Reveal delay={60}>
          <dl className="mt-10 max-w-md space-y-2 text-sm">
            <div className="flex justify-between gap-6 border-b hairline pb-2">
              <dt className="text-muted">Mon – Fri</dt>
              <dd>11:00 – 19:00</dd>
            </div>
            <div className="flex justify-between gap-6 border-b hairline pb-2">
              <dt className="text-muted">Saturday</dt>
              <dd>11:00 – 18:00</dd>
            </div>
            <div className="flex justify-between gap-6 border-b hairline pb-2">
              <dt className="text-muted">Sunday</dt>
              <dd>11:00 – 17:00</dd>
            </div>
          </dl>
          <div className="mt-12 flex flex-wrap items-center gap-x-10 gap-y-4">
            <a href="tel:+19150000000" className="cta-primary">
              Call the shop
            </a>
            <a
              href={DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="cta-secondary"
            >
              Get directions →
            </a>
          </div>
        </Reveal>
      </div>

      {/* Dark stylized map, bleeding off the right edge. Hand-drawn street
          grid — never a default Google embed. */}
      <div className="relative min-h-[50vh] bg-surface lg:min-h-0">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <rect width="800" height="800" fill="#131417" />
          <g stroke="#1b1d21" strokeWidth="2">
            {Array.from({ length: 15 }, (_, i) => (
              <line key={`v${i}`} x1={i * 60 - 20} y1="0" x2={i * 60 - 60} y2="800" />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 70 - 20} x2="800" y2={i * 70 + 10} />
            ))}
          </g>
          {/* Montana Ave — the artery */}
          <line x1="-40" y1="480" x2="840" y2="360" stroke="#2a2c31" strokeWidth="14" />
          <line x1="-40" y1="480" x2="840" y2="360" stroke="#0b0a0c" strokeWidth="2" strokeDasharray="14 18" />
          {/* Cross streets */}
          <line x1="240" y1="0" x2="300" y2="800" stroke="#232529" strokeWidth="8" />
          <line x1="540" y1="0" x2="580" y2="800" stroke="#232529" strokeWidth="8" />
          {/* The shop */}
          <g>
            <circle cx="470" cy="415" r="26" fill="none" stroke="#57b94a" strokeWidth="1.5" opacity="0.5" />
            <circle cx="470" cy="415" r="7" fill="#57b94a" />
          </g>
          <text
            x="470"
            y="368"
            textAnchor="middle"
            fill="#8a8b8f"
            fontSize="12"
            fontFamily="var(--font-archivo), sans-serif"
            fontWeight="600"
            letterSpacing="3.5"
          >
            10024 MONTANA AVE
          </text>
        </svg>
        <a
          href={DIRECTIONS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="cta-primary absolute bottom-8 left-8 bg-ink/70 backdrop-blur-sm"
        >
          Open in maps
        </a>
      </div>
    </section>
  );
}

const BRANDS = ["TARAN TACTICAL", "RETRORIFLE", "SAVIOR"];

// A breath between two heavy sections: type only, slow marquee.
export default function BrandsMarquee() {
  const line = (
    <>
      {BRANDS.map((brand) => (
        <span key={brand} className="mx-8 inline-flex items-baseline gap-16">
          <span>{brand}</span>
          <span aria-hidden="true" className="text-[0.5em]">
            ·
          </span>
        </span>
      ))}
    </>
  );

  return (
    <section
      className="flex min-h-[30vh] items-center overflow-hidden border-y hairline"
      aria-label="Brands carried"
    >
      <div className="marquee w-full">
        <div className="marquee-track display text-[40px] text-muted/40">
          {line}
          <span aria-hidden="true">{line}</span>
        </div>
      </div>
    </section>
  );
}

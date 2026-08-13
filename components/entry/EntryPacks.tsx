// Paid entries. Only rendered when a payment provider is configured —
// see the guard in app/(site)/featured/page.tsx. While checkout is
// unresolved the whole tier is absent from the page rather than shown
// disabled, because the prices here are placeholders and placeholder
// money in front of a customer is worse than no tier at all.
//
// The prices in ENTRY_PACKS must be confirmed by the client before this
// ever renders. See docs/content-needed.md.

import { ENTRY_PACKS } from "@/lib/payments";

export default function EntryPacks() {
  return (
    <div className="grid gap-px border hairline bg-[color-mix(in_srgb,var(--color-muted)_22%,transparent)] sm:grid-cols-3">
      {ENTRY_PACKS.map((pack) => (
        <div key={pack.id} className="bg-ink p-8">
          <p className="display text-4xl">{pack.entries}</p>
          <p className="label mt-2 text-muted">Entries</p>
          <p className="mt-6 text-lg">${pack.priceUsd}</p>
          <button type="button" className="control control-sm mt-6 w-full">
            Buy
          </button>
        </div>
      ))}
    </div>
  );
}

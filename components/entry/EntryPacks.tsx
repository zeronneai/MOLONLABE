// Paid entries — buying entries outright rather than earning them by
// spending. ENTRY_PACKS is empty and this renders nothing.
//
// Under the model we ship, entries come from purchases, so packs may
// never be needed at all. The type and the order model's second line
// type stay defined so adding them later is an implementation rather than
// a migration; the client decides whether they exist. The page gates on
// the list being non-empty, not on a gateway being configured — a live
// gateway says nothing about whether the shop sells packs.

import { ENTRY_PACKS } from "@/lib/payments";
import { formatUsd } from "@/lib/money";

export default function EntryPacks() {
  return (
    <div className="grid gap-px border hairline bg-[color-mix(in_srgb,var(--color-muted)_22%,transparent)] sm:grid-cols-3">
      {ENTRY_PACKS.map((pack) => (
        <div key={pack.id} className="bg-ink p-8">
          <p className="display text-4xl">{pack.entries}</p>
          <p className="label mt-2 text-muted">Entries</p>
          <p className="mt-6 text-lg">{formatUsd(pack.priceCents)}</p>
          <button type="button" className="control control-sm mt-6 w-full">
            Buy
          </button>
        </div>
      ))}
    </div>
  );
}

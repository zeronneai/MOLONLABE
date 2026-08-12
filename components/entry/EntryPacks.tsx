// Paid entries. Checkout is blocked on the payment provider, so the packs
// are shown but not purchasable — the state comes from the provider
// itself (lib/payments), never from a hardcoded flag here. The free
// method below is unaffected and is always live.

import { ENTRY_PACKS, getPaymentProvider } from "@/lib/payments";

export default function EntryPacks() {
  const provider = getPaymentProvider();

  return (
    <div>
      <div className="grid gap-px border hairline bg-[color-mix(in_srgb,var(--color-muted)_22%,transparent)] sm:grid-cols-3">
        {ENTRY_PACKS.map((pack) => (
          <div key={pack.id} className="bg-ink p-8">
            <p className="display text-4xl">{pack.entries}</p>
            <p className="label mt-2 text-muted">Entries</p>
            <p className="mt-6 text-lg">${pack.priceUsd}</p>
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="control control-sm mt-6 w-full"
            >
              {provider.configured ? "Buy" : "Opens soon"}
            </button>
          </div>
        ))}
      </div>

      {!provider.configured && (
        <p className="mt-6 max-w-[60ch] text-sm text-muted">
          Entry packs are not on sale yet — card processing is still being
          set up. The free entry below is open now and carries the same
          weight per entry, so nobody has to wait.
        </p>
      )}
    </div>
  );
}

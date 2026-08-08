"use client";

// Detail-page CTAs: desktop sticky block, mobile fixed bar, and the
// inquiry drawer both of them open. The drawer posts to `inquiries`
// with item_id prefilled — PROJECT_BRIEF.md section 9.

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import InquiryForm from "@/components/forms/InquiryForm";
import { track } from "@/lib/analytics";

export default function ItemCtas({
  itemId,
  itemName,
  itemSlug,
  phone,
}: {
  itemId: string;
  itemName: string;
  itemSlug: string;
  phone: string;
}) {
  const [open, setOpen] = useState(false);
  const whatsapp = `https://wa.me/${phone.replace("+", "")}?text=${encodeURIComponent(
    `Inquiring about the ${itemName} (${itemSlug})`,
  )}`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const callProps = {
    href: `tel:${phone}`,
    onClick: () => track("click_to_call", { source: "detail" as const }),
  };
  const waProps = {
    href: whatsapp,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: () => track("whatsapp_click", { source: "detail" as const }),
  };

  return (
    <>
      {/* Desktop: sticks to the viewport bottom once scrolled past */}
      <div className="sticky bottom-0 mt-12 hidden items-center gap-8 border-t hairline bg-ink py-5 lg:flex">
        <button type="button" onClick={() => setOpen(true)} className="cta-primary">
          Inquire about this
        </button>
        <a {...callProps} className="cta-secondary">
          Call
        </a>
        <a {...waProps} className="cta-secondary">
          WhatsApp
        </a>
      </div>

      {/* Mobile: fixed bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-stretch gap-3 border-t hairline bg-ink p-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="cta-primary h-12 flex-1"
        >
          Inquire about this
        </button>
        <a
          {...callProps}
          aria-label="Call the shop"
          className="flex w-12 items-center justify-center border border-bone transition-colors hover:border-acid"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-bone" aria-hidden="true">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
          </svg>
        </a>
      </div>

      {/* Inquiry drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-[60] bg-ink/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label={`Inquire about ${itemName}`}
              className="fixed inset-y-0 right-0 z-[70] w-full max-w-md overflow-y-auto border-l hairline bg-surface"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between border-b hairline px-8 py-5">
                <p className="label text-acid">Inquire</p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="label flex h-11 items-center text-muted transition-colors hover:text-bone"
                >
                  Close
                </button>
              </div>
              <div className="px-8 py-8">
                <p className="display text-2xl">{itemName.toUpperCase()}</p>
                <p className="mt-3 max-w-[44ch] text-sm text-muted">
                  Tell us how to reach you. We&apos;ll confirm it&apos;s still in
                  the case and hold it for you to come see.
                </p>
                <div className="mt-8">
                  <InquiryForm
                    type="item"
                    itemId={itemId}
                    itemSlug={itemSlug}
                    messageLabel="Anything we should know"
                    messagePlaceholder="Timing, trade-in, questions…"
                    submitLabel="Send inquiry"
                    successNote="Received. We'll confirm it's in the case and get back to you — usually same day during shop hours."
                  />
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

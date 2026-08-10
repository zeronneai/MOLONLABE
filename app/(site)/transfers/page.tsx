import type { Metadata } from "next";
import InquiryForm from "@/components/forms/InquiryForm";
import Reveal from "@/components/motion/Reveal";

export const metadata: Metadata = {
  title: "FFL Transfers — Molon Labe Firearms x SunCity Outdoors",
  description:
    "Buy anywhere, ship it to us, pick it up at the counter in El Paso. FFL transfer intake for Molon Labe Firearms x SunCity Outdoors.",
};

const steps: { title: string; body: string }[] = [
  {
    title: "BUY IT ANYWHERE",
    body: "Online retailer, auction site, private seller with an FFL — doesn't matter. You buy it, we receive it.",
  },
  {
    title: "SEND US THE DETAILS",
    body: "Use the form below. We'll email a copy of our FFL to your seller the same day and confirm when it ships.",
  },
  {
    title: "PICK IT UP AT THE COUNTER",
    body: "We'll message you when it arrives. Background check and paperwork happen in person, and it goes home with you.",
  },
];

export default function TransfersPage() {
  return (
    <div className="pb-24 pt-[calc(72px+4rem)]">
      <div className="px-page">
        <p className="label text-acid">Transfers</p>
        <h1 className="display mt-6 text-[clamp(2.5rem,6vw,5.5rem)]">
          BUY ANYWHERE.
          <br />
          PICK UP HERE.
        </h1>
        <p className="mt-6 max-w-md text-muted">
          We take FFL transfers daily. Standard transfer fee applies — call for
          current pricing.
        </p>
      </div>

      <div className="px-page mt-16">
        <Reveal>
          <ol className="border-t hairline">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="grid gap-2 border-b hairline py-8 md:grid-cols-[48px_280px_1fr] md:items-baseline md:gap-4"
              >
                <span className="label text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="display text-2xl">{step.title}</span>
                <p className="max-w-[52ch] text-sm text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>

      <div className="mt-16 bg-surface">
        <div className="px-page py-16">
          <Reveal>
            <p className="label text-acid">Start a transfer</p>
            <h2 className="display mt-4 text-[clamp(1.75rem,3vw,2.5rem)]">
              SEND US THE DETAILS
            </h2>
            <div className="mt-10 max-w-2xl">
              <InquiryForm
                type="transfer"
                messageLabel="What's coming"
                messagePlaceholder="What it is, who's sending it, order number if you have one…"
                submitLabel="Start the transfer"
                successNote="Received. We'll send our FFL to your seller and let you know the moment it arrives."
              />
            </div>
          </Reveal>
        </div>
      </div>

      <div className="px-page mt-12">
        <p className="max-w-3xl text-[11px] leading-relaxed text-muted">
          All transfers are subject to federal, state, and local law, including
          all required background checks and waiting periods. Firearms are
          released in person only.
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import {
  SHOP_ADDRESS,
  SHOP_NAME,
  SHOP_PHONE_DISPLAY,
  SHOP_PHONE_HREF,
} from "@/lib/brand";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
  title: "Privacy Policy",
  description:
    "How Molon Labe Firearms x SunCity Outdoors collects, uses and stores the information you give us.",
  // Draft copy must never be indexed as if it were the reviewed policy.
  robots: { index: false, follow: false },
};

// ---------------------------------------------------------------------------
// DRAFT — NOT REVIEWED BY A LAWYER.
//
// Unlike the sweepstakes rules, this is written as real operative copy
// rather than a checklist, because it describes things the site actually
// does and those facts are ours to state accurately. It still needs an
// attorney to check it against Texas law and the client's own practices —
// particularly retention periods and anything the shop does with the data
// offline, which I cannot know. The page is noindex until it is signed off.
//
// The technical claims below are accurate as built. If the site changes,
// this has to change with it:
//   - forms write to Supabase (Postgres, hosted in the US)
//   - submissions are also POSTed to a Google Apps Script endpoint that
//     appends a sheet row and emails the owner (GOOGLE_SCRIPT_URL)
//   - GA4 runs on the public site only, never on /admin
//   - localStorage holds three flags: mlf_intro_seen, mlf_age_ok,
//     mlf_admin_lock. None identify a person.
// ---------------------------------------------------------------------------

const UPDATED = "August 2026";

export default function PrivacyPage() {
  return (
    <div className="px-page pb-24 pt-[calc(72px+4rem)]">
      <p className="label text-acid">Legal</p>
      <h1 className="display mt-6 max-w-3xl text-[clamp(2.25rem,5vw,4rem)]">
        PRIVACY POLICY.
      </h1>

      <div className="mt-10 max-w-[68ch] border border-amber p-6">
        <p className="label text-amber">Draft — for the client&apos;s attorney</p>
        <p className="mt-4 text-sm leading-relaxed">
          This describes what the site actually does, accurately, but it has
          not been reviewed by a lawyer. Retention periods and anything the
          shop does with this information offline need confirming before it
          is signed off. The page is set to noindex until then.
        </p>
      </div>

      <p className="mt-10 max-w-[60ch] text-sm text-muted">Last updated: {UPDATED}</p>

      <div className="mt-12 max-w-[68ch] space-y-12">
        <Section title="Who we are">
          <p>
            {SHOP_NAME}, {SHOP_ADDRESS.street}, {SHOP_ADDRESS.city},{" "}
            {SHOP_ADDRESS.region} {SHOP_ADDRESS.postalCode}. You can reach us
            at{" "}
            <a href={SHOP_PHONE_HREF} className="text-bone underline underline-offset-4 hover:text-acid">
              {SHOP_PHONE_DISPLAY}
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect, and when">
          <p>We only collect what you type into a form. Specifically:</p>
          <ul className="mt-4 space-y-3">
            <Bullet>
              <strong className="text-bone">Item inquiries and transfer
              requests:</strong> your name, email address, phone number if you
              give one, and your message. If you inquired about a specific
              item, we record which one.
            </Bullet>
            <Bullet>
              <strong className="text-bone">Sweepstakes entries:</strong> your
              first and last name, email address, and phone number if you give
              one.
            </Bullet>
            <Bullet>
              <strong className="text-bone">Nothing else.</strong> We do not
              ask for an address, a date of birth, or any payment details, and
              there is no account to create.
            </Bullet>
          </ul>
        </Section>

        <Section title="Why we collect it">
          <p>
            To answer you, to hold an item you asked about, and to contact the
            winner of a sweepstakes. We do not sell it, rent it, or trade it,
            and we do not send marketing email unless you have separately
            asked us to.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            Form submissions are stored in a Supabase database (Postgres,
            hosted in the United States) and are also sent to a Google
            Workspace account belonging to the shop, where they appear as a
            spreadsheet row and an email to the owner. Only the shop owner has
            access to either.
          </p>
        </Section>

        <Section title="Analytics and cookies">
          <p>
            We use Google Analytics 4 to understand which pages people visit
            and which actions they take — viewing an item, tapping the phone
            number, submitting a form. Google sets cookies to do this. We send
            Google no names, emails or phone numbers: analytics events carry
            only page paths, item identifiers and counts.
          </p>
          <p className="mt-4">
            Analytics does not run on the shop&apos;s own admin pages.
          </p>
          <p className="mt-4">
            The site also stores three small flags in your browser&apos;s local
            storage: whether you have seen the intro, whether you have
            confirmed your age, and a counter that slows down repeated failed
            admin logins. None of them identify you, and clearing your browser
            data removes them.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Inquiries and entries are kept for as long as they are useful to
            the shop and then deleted.{" "}
            <span className="text-amber">
              [Attorney: confirm a specific retention period here.]
            </span>
          </p>
        </Section>

        <Section title="Asking us to delete your information">
          <p>
            Call the shop at{" "}
            <a href={SHOP_PHONE_HREF} className="text-bone underline underline-offset-4 hover:text-acid">
              {SHOP_PHONE_DISPLAY}
            </a>{" "}
            and ask, or reply to any email we have sent you. Tell us the name
            and email address you used and we will delete the record. We will
            confirm once it is done.
          </p>
          <p className="mt-4">
            You can also ask us what we hold about you, and we will tell you.
          </p>
        </Section>

        <Section title="Children">
          <p>
            This site is not intended for anyone under 21, and we ask your age
            before you browse.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            If we change what we collect or what we do with it, we will update
            this page and change the date at the top.
          </p>
        </Section>
      </div>

      <div className="mt-16 flex flex-wrap items-center gap-4">
        <Link href="/" className="cta-primary">
          Back home
        </Link>
        <Link href="/sweepstakes-rules" className="cta-primary">
          Sweepstakes rules
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t hairline pt-8">
      <h2 className="display text-xl">{title.toUpperCase()}</h2>
      <div className="mt-4 text-sm leading-relaxed text-muted">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-muted" />
      <span>{children}</span>
    </li>
  );
}

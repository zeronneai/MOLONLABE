"use client";

// The only screen a first sign-in sees.
//
// The account was set up with a temporary password that the person who
// created it knows. Until its holder chooses one only they know, the
// admin shows nothing else, every action refuses them, and the database
// treats them as not staff (supabase/migrations/20261001100000_own_passwords.sql).

import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { LOGO_URL } from "@/lib/brand";
import PasswordForm from "@/components/admin/PasswordForm";

export default function ForcedPassword({ name }: { name: string }) {
  const router = useRouter();
  const signOut = async () => {
    await getBrowserSupabase()?.auth.signOut();
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="px-page flex min-h-svh flex-col py-10" data-forced-password>
      <div className="flex items-center justify-between">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="" className="h-8 w-auto" />
        <button type="button" onClick={signOut} className="label flex h-11 items-center text-muted hover:text-bone">
          Sign out
        </button>
      </div>
      <div className="mx-auto mt-12 w-full max-w-md">
        <p className="label text-amber">Before you go on</p>
        <h1 className="display mt-4 text-3xl">CHOOSE YOUR OWN PASSWORD</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {name}, your account was set up with a temporary password that someone else knows.
          Choose one only you know. The admin opens as soon as it&apos;s saved, and anywhere
          else this account was signed in is signed out.
        </p>
        <div className="mt-10">
          <PasswordForm first />
        </div>
      </div>
    </div>
  );
}

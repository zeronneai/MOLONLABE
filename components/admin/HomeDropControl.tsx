"use client";

// Which drop the home page features: the owner's choice, one at a time.
//
// Shown on each running drop in the drops list and on the drop's own
// admin page. A manager sees which drop is featured and that choosing is
// the owner's; the database refuses the change for anyone else as well.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setHomeDrop } from "@/app/admin/actions";
import { useIsOwner } from "@/components/admin/Role";
import { OWNER_ONLY } from "@/lib/admin/constants";

export default function HomeDropControl({
  gameId,
  featured,
  running,
}: {
  gameId: string;
  featured: boolean;
  /** Open or sold out and waiting for its draw. A drawn drop cannot be chosen. */
  running: boolean;
}) {
  const owner = useIsOwner();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  if (!running && !featured) return null;

  const act = (next: string | null) =>
    start(async () => {
      const r = await setHomeDrop(next);
      setMessage({ tone: r.status === "error" ? "error" : "ok", text: r.message ?? "" });
      if (r.status !== "error") router.refresh();
    });

  return (
    <div className="flex flex-wrap items-center gap-2" data-home-drop-control={gameId}>
      {featured && (
        <span className="label text-acid" data-home-drop-badge>
          On the home page
        </span>
      )}
      {owner ? (
        featured ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(null)}
            className="label flex h-11 items-center px-3 text-muted hover:text-bone disabled:opacity-50"
          >
            Take off the home page
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => act(gameId)}
            className="control control-sm disabled:opacity-50"
            data-feature-on-home
          >
            {pending ? "Saving…" : "Feature on the home page"}
          </button>
        )
      ) : (
        !featured && (
          <span
            aria-disabled="true"
            title={OWNER_ONLY}
            className="label flex h-11 cursor-not-allowed items-center px-3 text-muted opacity-50"
          >
            Home page · owner only
          </span>
        )
      )}
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={`w-full text-sm ${message.tone === "error" ? "text-danger" : "text-acid"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

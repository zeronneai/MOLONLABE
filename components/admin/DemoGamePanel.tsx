"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDemoGame, seedDemoGame } from "@/app/admin/actions";

/**
 * Creates or removes one clearly-labelled demonstration game.
 *
 * For showing the client what a populated Past games section looks like
 * before a real one exists. The four firearms in the catalogue are items,
 * not games — they were never in a game and have no spots or winner — so
 * there is nothing to move across, and the section is genuinely empty
 * until the first real game is drawn.
 *
 * Deliberately easy to find and easy to undo, because the thing that
 * matters is that it does not quietly survive into launch.
 */
export default function DemoGamePanel({ exists }: { exists: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const run = (fn: () => Promise<{ status: string; message?: string }>) =>
    start(async () => {
      const result = await fn();
      setMessage(result.message ?? null);
      router.refresh();
    });

  return (
    <section className="mt-12 border border-amber p-6">
      <p className="label text-amber">Demo</p>
      <h2 className="display mt-3 text-lg">SHOW THE CLIENT A FINISHED GAME</h2>
      <p className="mt-3 max-w-[58ch] text-sm leading-relaxed text-muted">
        {exists
          ? "A demo game exists. It is marked DEMO everywhere it appears, on the site and in here. Remove it before you go live."
          : "Creates one completed game so Past games has something in it. Every spot is sold to “Demo Buyer”, it is titled [DEMO], and it carries a badge on every card a customer would see. Remove it whenever you like — nothing else is touched."}
      </p>

      {message && (
        <p role="status" className="label mt-4 text-acid">
          {message}
        </p>
      )}

      <div className="mt-6">
        {exists ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(deleteDemoGame)}
            className="control control-caution"
          >
            {pending ? "Removing…" : "Remove the demo game"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(seedDemoGame)}
            className="control"
          >
            {pending ? "Creating…" : "Create a demo game"}
          </button>
        )}
      </div>
    </section>
  );
}

"use client";

// Current password, new password, the new one again. Used on the
// "Change password" page and on the screen a first sign-in is held at.
//
// Submitted without a page load, so a refusal keeps what was typed and
// says which box it is about. The rules are checked as you type, from the
// same function the server checks with.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, type PasswordState } from "@/app/admin/password";
import { PASSWORD_MIN, passwordProblem } from "@/lib/admin/password";

const idle: PasswordState = { status: "idle" };

export default function PasswordForm({ first = false }: { first?: boolean }) {
  const [state, setState] = useState<PasswordState>(idle);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const sending = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const hint = next ? passwordProblem(next) : null;
  const mismatch = confirm.length > 0 && confirm !== next;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true;
    const data = new FormData(event.currentTarget);
    start(async () => {
      try {
        const result = await changePassword(idle, data);
        setState(result);
        if (result.status === "success") {
          formRef.current?.reset();
          setNext("");
          setConfirm("");
          // The admin was waiting behind this; show it.
          if (result.unlocked) router.refresh();
        }
      } catch {
        setState({ status: "error", message: "The password could not be changed. Try again." });
      } finally {
        sending.current = false;
      }
    });
  };

  const type = show ? "text" : "password";
  const error = (field: PasswordState["field"]) =>
    state.status === "error" && state.field === field ? (
      <p role="alert" className="mt-2 text-sm text-danger" data-password-error={field}>
        {state.message}
      </p>
    ) : null;

  return (
    <form ref={formRef} onSubmit={submit} className="max-w-md space-y-6" data-password-form>
      <label className="block">
        <span className="label text-muted">{first ? "Temporary password" : "Current password"}</span>
        <input
          name="current"
          type={type}
          autoComplete="current-password"
          required
          className="field-input mt-2 w-full"
        />
        {error("current")}
      </label>

      <label className="block">
        <span className="label text-muted">New password</span>
        <input
          name="next"
          type={type}
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="field-input mt-2 w-full"
        />
        {error("next") ?? (
          <p className={`mt-2 text-sm ${hint ? "text-amber" : next ? "text-acid" : "text-muted"}`} data-password-hint>
            {hint ?? (next ? "Good." : `At least ${PASSWORD_MIN} characters. A few ordinary words together work well.`)}
          </p>
        )}
      </label>

      <label className="block">
        <span className="label text-muted">New password again</span>
        <input
          name="confirm"
          type={type}
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="field-input mt-2 w-full"
        />
        {error("confirm") ??
          (mismatch && <p className="mt-2 text-sm text-amber">Doesn&apos;t match yet.</p>)}
      </label>

      <label className="flex items-center gap-3 text-sm text-muted">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-5 w-5" />
        Show passwords
      </label>

      {state.status === "error" && !state.field && state.message && (
        <p role="alert" className="text-sm text-danger" data-password-error="general">{state.message}</p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-sm text-acid" data-password-done>{state.message}</p>
      )}

      <button type="submit" disabled={pending} className="cta-primary control-go w-full sm:w-auto">
        {pending ? "Saving…" : first ? "Set my password" : "Change password"}
      </button>
    </form>
  );
}

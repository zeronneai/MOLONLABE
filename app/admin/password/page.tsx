import PasswordForm from "@/components/admin/PasswordForm";

export const dynamic = "force-dynamic";

export default function ChangePasswordPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-2xl">CHANGE PASSWORD</h1>
      <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-muted">
        Only you should know your password. Nobody else, including the shop or
        the agency, can see it or look it up. When you change it, anywhere else
        you are signed in is signed out.
      </p>
      <div className="mt-10">
        <PasswordForm />
      </div>
    </div>
  );
}

# Passwords

Nobody should know anyone else's password. Accounts are created with a
temporary password, and the first time a person signs in they must
choose their own before the admin shows them anything.

Migration: `supabase/migrations/20261001100000_own_passwords.sql`.
Tests: `tests/db/passwords.mjs` (the database), `tests/browser/passwords.mjs`
(the screens).

## How it works

- `public.staff.must_change_password` is **true by default**. Every
  account that existed when the migration ran was flagged by it (the
  owner and the manager), and every account added later is flagged
  without anybody having to remember.
- A flagged account can sign in and do one thing: choose a password.
  Every admin page shows only that screen, the draw presentation sends
  them back to it, the guide download refuses, every action refuses,
  and the **database** treats them as not staff (`is_staff()` and
  `is_owner()` answer no), so a direct call with their session gets
  nothing either.
- The change goes through Supabase's own password update for the
  signed-in user, after the current (or temporary) password has been
  checked. Every other session that account had is then signed out.
- The flag clears only when the password has really changed. When an
  account is flagged, a fingerprint of its password hash at that moment
  is kept in `staff_password_marks`, a table no signed-in user can read;
  `record_password_change()` refuses to clear the flag while the hash is
  still the same. So nobody can clear the flag and carry on with the
  temporary password.
- Rules: at least 12 characters, and not built from the person's name,
  email, the shop's name or the word "password", not one character
  repeated, not a straight run of keys or digits. Supabase's own rules
  apply on top (its minimum length, and its leaked-password check if it
  is switched on), and the form reports those in words too.
- The activity log records "set their own password for the first time"
  or "changed their password", by name. The database writes the line;
  no password or hash is ever passed to it, logged, or stored by the
  admin.
- Anyone can change their own password at any time: **Password** in the
  admin header.

## Creating an account

1. Supabase dashboard, **Authentication, Users, Add user, Create new
   user**: their email and a temporary password. Tick auto-confirm. Give
   them the password privately, by phone or in person.
2. SQL editor:

   ```sql
   insert into public.staff (user_id, role, display_name)
   select id, 'manager', 'Their Name'
   from auth.users
   where email = 'their@email.com';
   ```

   **Nothing else is needed to force the change.** The flag defaults to
   true, and the migration's trigger remembers the temporary password's
   fingerprint as the row is inserted. That is also why the order
   matters: create the user with its temporary password first, then the
   staff row.
3. Check it is flagged:

   ```sql
   select s.display_name, s.role, s.must_change_password
   from public.staff s join auth.users u on u.id = s.user_id
   where u.email = 'their@email.com';
   ```

   `must_change_password` should be `true`.
4. Do **not** sign in as them to try it: the first sign-in asks for a
   new password, and whoever answers it is the person who knows it.

## Forcing a change again (a password someone else learned, or a reset)

**Set the temporary password first, then the flag.** The flag remembers
the password as it is at the moment it is set; set it first and the
temporary password would count as "changed".

1. Supabase dashboard, **Authentication, Users**, the person, **Reset
   password** (or set a new one), and give it to them privately.
2. Then, in the SQL editor:

   ```sql
   update public.staff set must_change_password = true
   where user_id = (select id from auth.users where email = 'their@email.com');
   ```

Their next sign-in asks them to choose their own.

## If someone forgets their password

Today, the only way back in is step 1 and 2 just above, done by someone
with access to the Supabase dashboard: the agency, or the owner if they
have a Supabase login. There is no "Forgot password?" link on the admin
sign-in.

## A "Forgot password?" email: is it safe to add now?

**Yes, with four conditions met first.** The reason it was left out was
the redirect: Supabase's reset email sends the person to a URL, and on
preview deployments those URLs changed with every build and were not on
Supabase's allow list, so the link either failed or pointed somewhere
it should not. A stable production domain removes that problem, provided
it is configured as the only place a reset link may go.

What has to be true before it is added:

1. **One host, not two.** molonlabeguns.com currently redirects to
   www.molonlabeguns.com. The reset flow stores a one-time code
   verifier in a cookie on the host where "Forgot password?" was
   pressed, and the email link must land on that same host or the reset
   fails. Make the bare domain primary in Vercel (or use www everywhere,
   including `NEXT_PUBLIC_SITE_URL`), so there is one.
2. **Supabase, Authentication, URL Configuration:**
   - **Site URL:** `https://molonlabeguns.com` (the one host from 1).
   - **Redirect URLs:** exactly `https://molonlabeguns.com/admin/reset`,
     and nothing with a wildcard. Remove any `*.vercel.app` or
     `localhost` entries from the production project, so a reset link
     can only ever bring someone back to the live admin.
3. **Email that actually arrives.** Supabase's built-in email sender is
   for testing: it sends only a few messages an hour, and on current
   projects it only delivers to members of the Supabase project's team.
   The manager is not one, so the email would never reach him. Configure
   custom SMTP under **Authentication, Emails, SMTP Settings** with a
   real provider (Resend, Postmark, SES or the shop's email host),
   sending from an address on molonlabeguns.com with the domain's SPF
   and DKIM records set, so the message is not filed as spam. Then edit
   the "Reset password" template so it says it is from the shop's admin.
4. **The inbox is now the key.** Anyone who can read the manager's email
   can reset his admin password. His email account should have its own
   strong password and two-step verification. Keep the reset link's
   expiry short (Authentication, Emails: one hour or less).

What building it involves, once those are set (about half a day):

- A "Forgot password?" link on the admin sign-in, asking for the email
  and always answering "If that address has an account, a link is on
  its way" (so it never reveals who has an account).
- `/admin/reset`, which exchanges the link's code for a session and
  shows the same new-password form, with the same rules. It would record
  the change and clear the forced-change flag, since the person chose
  the password themselves.
- A test that walks it end to end against the test double.

For the month the manager runs the site alone, this is what stops a
forgotten password from locking him out until someone with dashboard
access can be reached.

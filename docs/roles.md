# Roles: owner and manager

Two roles. Access comes from a row in `public.staff`, not from being able
to sign in. An account with no row can sign in and sees a "No access"
screen, nothing more.

| | Owner | Manager |
| --- | --- | --- |
| Items: add, edit, photos, descriptions, prices, sizes, stock, status, archive | yes | yes |
| Remove a size from an item | yes | yes (the one permanent delete a manager can make) |
| Delete an item permanently | yes | no |
| Games: create, set spots and price, write the guide sections, rebuild the guide | yes | yes |
| Run the draw, including the presentation | yes | yes |
| See the winner's name, email and phone | yes | yes |
| See orders, inquiries, transfer requests; mark inquiries handled | yes | yes |
| Download the spot list as a spreadsheet | yes | no |
| Tax rate, shipping prices | yes | no (sees them, cannot change) |
| Discount code, offer on or off, arcade difficulty | yes | no (sees them, cannot change) |
| Create or remove the demo game | yes | no |
| Activity log | yes, filterable by person | no |
| Team & alerts: who gets which alert, send a test | yes | no (sees the lists, cannot change) |
| Create accounts or change anyone's role | Supabase dashboard only | no |

Anything a manager cannot do is shown to him **disabled, with the line
"Owner only. Ask the owner if this needs changing."** The server refuses
with the same words if the request reaches it anyway.

## Where it is enforced

Three places, and the first is the one that counts.

1. **The database.** Row level security, in
   `supabase/migrations/20260928100000_staff_roles.sql`. A manager's
   session is refused on every restricted write whatever sends it,
   including a hand-made request with his token. Proven in
   `tests/db/roles.mjs`, which acts as the manager against the real
   policies and tries each forbidden thing.
2. **The server actions.** Each owner-only action checks the role first
   and answers in words. Proven in `tests/browser/roles.mjs`, against a
   test double that has no row level security, so the server's check is
   the only thing that can stop the request there.
3. **The screens.** Disabled controls with the owner-only line.

**The one thing only the server enforces: bulk export.** A manager can
read orders and the spot ledger, because he needs them to run the draw
and contact the winner. A person who can read a list can copy it by
hand. What he cannot do is download the whole list as a file; that
refusal is the server's, because the database cannot tell a download
from a page view.

## Applying it

1. Open the Supabase SQL editor and run
   `supabase/migrations/20260928100000_staff_roles.sql`, the whole file.
   It is one transaction. It checks itself at the end and refuses to
   finish, changing nothing, if any policy would still let an account
   through without a role. It is safe to run twice.
2. Every account that exists at that moment becomes an **owner**, named
   from its metadata or `Owner (set a name)`. That keeps today's access
   exactly as it is. Nothing else changes for the owner.
3. Deploy the code. If the code is live before the migration, the admin
   shows a red line at the top of every page naming the missing
   migration, and behaves exactly as it did before roles.

Check it worked:

```sql
select s.display_name, s.role, u.email
from public.staff s join auth.users u on u.id = s.user_id
order by s.role, s.display_name;
```

Fix a placeholder name:

```sql
update public.staff set display_name = 'Rey Marquez'
where user_id = (select id from auth.users where email = 'owner@example.com');
```

## Creating the manager's account

Do this **after** the migration has been applied. An account that
already exists when the migration runs is made an owner.

1. Supabase dashboard, **Authentication, Users, Add user, Create new
   user.** His email and a password. Tick auto-confirm, so he does not
   need to click a link first. Give him the password in person or by
   phone, not in the same message as the address of the admin.
2. **SQL editor.** Replace the name and email:

   ```sql
   insert into public.staff (user_id, role, display_name)
   select id, 'manager', 'Luis Ortega'
   from auth.users
   where email = 'manager@example.com';
   ```

   It should say `INSERT 0 1`. `INSERT 0 0` means the email did not
   match an account: check the spelling in Authentication, Users.
3. **Check:**

   ```sql
   select s.display_name, s.role from public.staff s
   join auth.users u on u.id = s.user_id
   where u.email = 'manager@example.com';
   ```

   One row, `manager`.
4. **Sign in as him once**, in a private window. The header reads
   "Luis Ortega · Manager", Tax & Shipping shows the owner-only line,
   and Delete on an item is greyed out. Sign out.

The name in `display_name` is the one on every line of the activity log
and on every record he touches. It is not the name in his Supabase
metadata, which he could change himself.

**If he was created before the migration**, he is an owner now. Make
him a manager:

```sql
update public.staff set role = 'manager', display_name = 'Luis Ortega'
where user_id = (select id from auth.users where email = 'manager@example.com');
```

## When the month is over

Take his access away without deleting his account, so the log keeps
his name against what he did:

```sql
delete from public.staff
where user_id = (select id from auth.users where email = 'manager@example.com');
```

He can still sign in and sees "No access". Deleting the account itself
in Authentication, Users also removes the staff row. The log lines keep
his name either way; they store it as text.

## Turn off open signups

Before roles, anyone who could create an account with the site's public
key became a full admin, if email signups were enabled on the Supabase
project. After roles they get "No access", so this is no longer a hole,
but there is no reason to leave the door open. **Authentication, Sign
In / Providers: turn off "Allow new users to sign up".** Accounts can
still be created from the dashboard.

## Alerts

Who receives which alert is set under **Team & alerts**, owner only.
The problems list gets every `order_error`, the routine list gets
orders, inquiries and sold-out games. Empty means the Apps Script's
usual address, which is how it worked before.

**The Apps Script has to be updated** to use the lists; until then it
ignores them. The change and the reason for it are in
[docs/email.md, "Who receives an alert"](email.md#who-receives-an-alert).
After changing the script, press **Send a test** for both lists. The
admin reports who the script says it delivered to, or says plainly that
the script has not been updated.

For the manager's month, put his address in the problems list alongside
the owner's.

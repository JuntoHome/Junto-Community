# Admin operations

Tasks that are done by hand in the Supabase or Vercel dashboards because the app has no screen for them. You need dashboard access. Remember there is one database: these change production.

## Add an admin

Only people in the `admins` table can use `/admin`. Public sign-up is turned off in Supabase.

1. Supabase → Authentication → Users → Add user → Send invitation, with their email.
2. In the SQL editor:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'name@example.com';
   ```
3. They follow the email link to `/admin/set-password`, choose a password, and land on `/admin`.

## Remove an admin

```sql
delete from public.admins where email = 'name@example.com';
```

This takes effect on their next request. Deleting the user under Authentication → Users also removes their `admins` row.

## Update the invite and reset emails

The HTML lives in [supabase/templates/](../../supabase/templates/). Editing the files changes nothing until you paste them:

1. Supabase → Authentication → Emails → Templates.
2. Paste `invite.html` into "Invite user" and `recovery.html` into "Reset password", each with the subject from the file's first comment.
3. Send yourself a test.

The links lead to `/admin/set-password` with a one-time code that is only used when the form is submitted, so email scanners that open links can't use it up. They are built from the Site URL, so they always open the live site. Images in the emails come from `public/email/`; don't rename those files.

## Restore a deleted profile

Deleting a profile in the admin only sets `deleted_at`. It disappears from the admin and the public site but stays in the database, and its page address becomes free.

```sql
-- Deleted profiles, most recent first, with the admin who deleted them.
select p.id, p.name, p.slug, p.status, p.deleted_at, a.email as deleted_by
from public.profiles p left join public.admins a on a.user_id = p.updated_by
where p.deleted_at is not null
order by p.deleted_at desc;

-- Bring it back as a draft, so an admin can check it before publishing it again.
update public.profiles set deleted_at = null, status = 'draft' where id = '<id>';
```

If another profile now uses the same address, the update fails on `profiles_slug_key`. Give the restored one a new address in the same statement (`..., slug = 'new-address'`).

## Read or export subscribers

Supabase → Table Editor → `subscribers`, or in the SQL editor:

```sql
select first_name, email, zip, created_at from public.subscribers order by created_at desc;
```

This is personal data. Export only what you need and don't share it outside JCA. To remove someone on request, delete their row; the app has no unsubscribe path.

## Check the keep-alive

- Vercel → Settings → Cron Jobs for run history.
- `select * from public.keep_alive order by pinged_at desc limit 5;` for the database's view.
- By hand: [API-DOCUMENTATION.md](../API-DOCUMENTATION.md#get-apicronkeep-alive).

## Check the Supabase dashboard settings

After any change to Supabase, confirm the settings listed in [ENVIRONMENT-CONFIGURATION.md](ENVIRONMENT-CONFIGURATION.md#settings-outside-environment-variables) are still as expected.

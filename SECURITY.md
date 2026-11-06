# Security checklist

Checked on 6 November 2026. Each line marked "tested" was proven by `sec.js` / `e2e.js` against the running apps, not just read in the code.

| # | Check | Status | How |
|---|---|---|---|
| 1 | No API key in browser code | Done, tested | The Resend key and database address exist only on the server. The page and `bet.js` were scanned for keys. |
| 2 | `.env` not on the live site | Done, tested | `/.env`, `/.env.local`, `/package.json` and the config return 404 on both apps. `.env*` is in `.gitignore`. |
| 3 | Login not just checked in the browser | Done, tested | Every dashboard page, action and the CSV export checks the session on the server. |
| 4 | Changing a number in the address shows someone else's data | Done | Clients have no accounts, so there is nothing of theirs to reach. Enquiry and visit ids are random, and only signed-in staff can open any of them. The public APIs only accept new data and never return anyone's records. |
| 5 | Row level security | Done, tested | RLS is on for every table, and the public Supabase roles (`anon`, `authenticated`) have no access at all. Both apps connect on the server only. |
| 6 | Admin page hidden, not locked | Done, tested | Every dashboard address sends signed-out people to the login. `/setup` closes for good once an owner exists, and needs the private `SETUP_KEY` before that. |
| 7 | HTTPS | Done, tested | Vercel serves HTTPS only. Both apps send `Strict-Transport-Security`, and the sign-in cookie is `Secure` and `HttpOnly`. |
| 8 | Password reset link expires | Handled differently | There are no emailed reset links to steal. The owner resets a teammate's password from Team, which signs that person out on every device. Keep two owners so one can reset the other. |
| 9 | One email, one account | Done, tested | Enforced by the database, ignoring capitals (`ALLAN@…` = `allan@…`). |
| 10 | Sessions expire, sign-out really signs out | Done, tested | Sessions are stored in the database: 7 days at most, 48 hours if unused. Signing out deletes the session, so a copied cookie stops working. |
| 11 | Many wrong passwords slow the attacker | Done, tested | Stored in the database, so it holds across all servers. 8 wrong tries on one account or 30 from one network locks sign-in for 15 minutes. Same for the setup key and the change-password form. |
| 12 | Email confirmed before important actions | Not needed | Nobody can sign themselves up. Only the owner creates accounts, by hand. |
| 13 | Removing a user cuts access immediately | Done, tested | Their sessions are deleted at once. Their next click goes to the login, and they can't sign back in. |
| 14 | Errors don't reveal which emails exist | Done, tested | Same message and same timing for an unknown email and a wrong password. Lockout happens for unknown emails too. |
| 15 | Backups run on their own | Ready, needs 2 secrets | `.github/workflows/backup.yml` makes an encrypted copy every night at 2:00 IST and keeps 30 days. Add `DATABASE_URL` (Session pooler) and `BACKUP_PASSPHRASE` as GitHub secrets. |
| 16 | A backup has been restored as a test | Done locally, repeat once live | Backed up, restored into a fresh database, counts matched. A wrong passphrase is refused. Repeat once with the live database (README, step 7). |
| 17 | Deleting asks first, and can be undone | Done, tested | Removing a teammate asks first and can be undone with Restore access. Enquiries can't be deleted at all; stages can always be changed back. |
| 18 | Two people editing don't overwrite each other | Done, tested | If a teammate changed an enquiry while you had it open, your save is stopped and you see the latest version. Notes only ever add, never replace. |
| 19 | Times stored in one zone, shown in the user's | Done | Stored as UTC (`timestamptz`). Shown in India time; change with `DASHBOARD_TZ`. |
| 20 | Upload size and type checks | Not needed | There are no uploads. Enquiries over 20 KB and tracking messages over 4 KB are rejected. One email can send at most 3 enquiries an hour. |
| 21 | You know where the data is stored | Done | Database: Supabase Mumbai (`ap-south-1`). Server code: Vercel Mumbai (`bom1`, set in `vercel.json`). Backups: GitHub, encrypted. The public page itself is cached worldwide but holds no personal data. |

Run the checks again: start both apps against a fresh database, then `node e2e.js && node sec.js`.

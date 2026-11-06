# BeT Agency Co. — website + team dashboard

Two separate apps that share one database:

| Folder | What it is | Who uses it | Suggested address |
|---|---|---|---|
| `web/` | The public website, the enquiry form, visit tracking and the cookie banner | Everyone | `betagency.co` |
| `dashboard/` | Enquiries inbox, traffic stats, visitor journeys, team accounts | Only BeT staff (login required) | `team.betagency.co` |
| `db/schema.sql` | The database tables | — | Supabase |

The website never links to the dashboard, and the dashboard is hidden from Google (`noindex`). Clients can't get in without a staff account.

---

## What the dashboard shows

- **Overview:** people on the site right now, visitors, visits, enquiries, conversion rate and average time on site, compared with the previous period. A daily traffic chart. Top traffic sources (Google, Instagram, ChatGPT, Direct…), countries, cities, devices and browsers. An enquiry funnel (visited → saw services → opened form → halfway → sent). Which services people are most interested in, and which sections they reach.
- **Enquiries:** every form submission with name, phone, email, brand, services, budget, timeline, location and traffic source. Filter by stage (New, Contacted, In talks, Won, Lost) and search. Each enquiry has one-tap WhatsApp / Call / Email, assignment to a teammate, team notes, and the person's full click-by-click visit before they enquired. CSV download.
- **Visitors:** every visit with location, source, device, time on site and actions. Live-now and returning-visitor filters. Open a visit to see its timeline and the person's other visits.
- **Team:** the owner adds or removes staff and resets passwords. Everyone can change their own password.

## Privacy and cookies

- First-party only. No Google Analytics, no Meta pixel.
- Location (city, region, country) comes from Vercel's edge headers. IP addresses are **never stored**.
- A cookie banner asks first. **Accept** sets `bet_consent` and a random `bet_vid` id, so returning visitors are recognised. **Only essentials** counts the visit anonymously with no id.
- A plain-language privacy page lives at `/privacy`. Footer links let visitors change their choice at any time.

---

## Going live (about 20 minutes, free tiers)

### 1. Database (Supabase)
1. Create a free project at <https://supabase.com> (region: Mumbai `ap-south-1`).
2. Open **SQL Editor → New query**, paste everything from `db/schema.sql`, and press **Run**.
3. Open **Project Settings → Database → Connection string → URI**, choose **Transaction pooler** (port 6543), and copy it. Put your database password in place of `[YOUR-PASSWORD]`. This is your `DATABASE_URL`.

### 2. Website (Vercel project #1)
1. On <https://vercel.com>: **Add New → Project**, then import this GitHub repo.
2. Set **Root Directory** to `web`.
3. Add the environment variables `DATABASE_URL` (from step 1) and `SITE_URL` (your address, e.g. `https://betagency.co`).
4. Press **Deploy**. Then in **Settings → Domains**, add your domain (for example `betagency.co`).

### 3. Dashboard (Vercel project #2)
1. **Add New → Project** again, and import the **same** repo.
2. Set **Root Directory** to `dashboard`.
3. Add these environment variables:
   - `DATABASE_URL` — same as above
   - `SESSION_SECRET` — 32+ random characters (generate one at <https://generate-secret.vercel.app/32>)
   - `SETUP_KEY` — any private phrase. You'll use it once to create the owner account.
   - `DASHBOARD_TZ` — optional, defaults to `Asia/Kolkata`
4. Press **Deploy**. Then add a domain such as `team.betagency.co`.
5. Open `https://team.betagency.co/setup`, enter the `SETUP_KEY`, and create the owner account. This page switches itself off once an account exists.
6. Add teammates from **Team**.

### 4. Optional: email alert for every new enquiry
1. Create a free account at <https://resend.com> and get an API key.
2. In the **website** project, add `RESEND_API_KEY` and `NOTIFY_EMAIL=bet.agency01@gmail.com`.
3. Optionally add `DASHBOARD_URL=https://team.betagency.co` so the email links to the dashboard.
4. Once your domain is verified in Resend, set `NOTIFY_FROM` (for example `BeT Website <hello@betagency.co>`).

### 5. Get found on Google and AI search
The site already ships a sitemap (`/sitemap.xml`), robots rules that welcome AI crawlers (`/robots.txt`), an AI summary (`/llms.txt`), structured data and an FAQ.
1. Verify the site in Google Search Console (<https://search.google.com/search-console>) and submit `https://betagency.co/sitemap.xml`.
2. Do the same in Bing Webmaster Tools (<https://www.bing.com/webmasters>). ChatGPT search uses Bing's index.
3. If your domain is not `betagency.co`, rebuild the page with `python3 build_site.py <preview index.html> web/public/index.html https://your-domain` so the canonical address matches.

### 6. Tracking campaigns
Add UTM tags to links you share, and the dashboard will show them as sources:
`https://betagency.co/?utm_source=instagram&utm_medium=bio&utm_campaign=nov-launch`

---

### 7. Nightly backups (after the code is on GitHub)
Supabase's free plan doesn't give you backups you can restore yourself, so the repo backs itself up.
1. In Supabase, copy the **Session pooler** connection string (port 5432). Backups don't work through the Transaction pooler.
2. On GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add `DATABASE_URL` (that string) and `BACKUP_PASSPHRASE` (a long private phrase). Keep a copy of the phrase somewhere safe: without it a backup can't be opened.
3. Open **Actions → Database backup → Run workflow** once to check it. After that it runs every night at 2:00 IST, and keeps 30 days.
4. Test a restore once: download a backup from that run, create a spare Supabase project (or a local Postgres), then run
   `TARGET_DATABASE_URL=<spare database> BACKUP_PASSPHRASE=... scripts/restore.sh bet-....dump.gpg`.
   It prints the number of enquiries, staff and visits so you can compare.

### Security
See `SECURITY.md` for the full checklist and how each point is handled. Both apps run in Vercel's Mumbai region (`vercel.json`), next to the Supabase database.

---

## Run it on your computer

Requirements: Node 20+ and a Postgres database (a free Supabase project works).

```bash
psql "$DATABASE_URL" -f db/schema.sql

cd web && npm install && DATABASE_URL=... npm run dev          # http://localhost:3000
cd dashboard && npm install && DATABASE_URL=... SESSION_SECRET=... SETUP_KEY=... npm run dev   # http://localhost:3001
```

On your own computer, location shows as "Unknown". It fills in once the site is deployed on Vercel.

## Editing the website

The whole designed page is `web/public/index.html`, and the cookie banner and tracker are in `web/public/bet.js`. To track a new interaction, call `betTrack('name', { any: 'data' })` and add the name to `EVENTS` in `web/app/api/track/route.js`.

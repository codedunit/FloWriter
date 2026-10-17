# FloWriter pilot: technical setup

The step-by-step launch plan is in the **FloWriter Pilot Launch Guide** doc.
This file is the technical reference.

The pilot is one web page (`dist/index.html`) plus a free Supabase project for
accounts and data. Without `config.js` it runs on demo data kept in the browser.

## What the pilot build does

**Teachers**
- Dashboard with week-over-week KPIs, a practice chart, live activity (updates
  as students write), awards, "could use a hand", and the hardest letters.
- Classes: join code and invite link, class message, lessons that can open one
  at a time in order, archive.
- Students: self-join with a code, or teacher bulk-add with printable
  **login cards** (QR code + username + password). Teachers can set new
  passwords, move a student to another class, remove them, or permanently
  delete them and all their work.
- Student pages: activity calendar, performance vs class, every practice run
  and test as a picture, letters to work on.
- Lessons: write, generate, or start from the 13-lesson Zaner-Bloser sequence.
  Pick a song, tempo multiplier (no cap), theme and margin. Once students start
  a lesson its words lock (copy it to change them).
- **Handwriting checks**: the test alone, with no demo and no music, taken once.
  Give one at the start and one at the end; the Checks tab shows the change.
- CSV export of every student's results; account settings; a Feedback button.

**Students**
- Only what the teacher assigns. Lessons are demo, then practice with music,
  then a one-try test. Checks are the test only.
- Music, click and volume controls; a left-handed setting.
- Signed out after 10 minutes without writing (shared classroom tablets);
  a "Switch student" button.
- Runs are saved on the device first and retried until the server has them,
  so a dropped connection never loses a test or lets it be taken twice.

**Pilot team (admins)**
- A Pilot admin page across every school: activity, completion, test averages,
  first-vs-latest handwriting checks, teacher feedback, full CSV export.

## Supabase settings

1. New project → **SQL Editor** → run all of `schema.sql`. It's safe to run
   again after updates.
2. **Authentication → Sign In / Providers → Email:** turn **Confirm email off.**
3. **Authentication → Rate Limits:** raise **sign-ups and sign-ins** from 30 to
   at least 300 per 5 minutes. A whole school usually shares one IP address,
   so the default blocks a second class signing in at the same time.
4. **Authentication → URL Configuration:** set **Site URL** to your hosted
   address, and add it under **Redirect URLs** (needed for password resets).
5. **Authentication → SMTP:** connect an email provider (Resend, Brevo,
   Postmark, SendGrid, AWS SES or ZeptoMail). Without it, Supabase's built-in
   email only reaches your own team's addresses, at 2 per hour, so teachers'
   password-reset emails won't arrive.
6. **SQL Editor:** add the pilot team so they get the Pilot admin page:
   ```sql
   insert into pilot_admins values ('you@yourdomain.org');
   ```
   Optional, to limit who can create teacher accounts:
   ```sql
   insert into teacher_allowlist values ('teacher1@school.org'), ('teacher2@school.org');
   ```
7. **Project Settings → API:** copy the Project URL and the **anon public** key
   into `config.js` (copy it from `config.example.js`). Never use the
   `service_role` key in the site.

If a teacher's reset email doesn't arrive, set a password for them in the SQL
editor, then have them change it under My account:

```sql
update auth.users set encrypted_password = extensions.crypt('TempPass2026', extensions.gen_salt('bf'))
where email = 'teacher@school.org';
```

## Build and host

```
cp config.example.js config.js   # fill in url, anonKey, studentEmailDomain
python3 build.py                 # writes dist/ (index.html + config.js)
```

Upload the `dist/` folder to any static host (Netlify drop, Vercel, GitHub
Pages, Cloudflare Pages). Use HTTPS. The login-card QR codes point at the
address the cards were printed from, so print cards from the real site.

### Netlify, one file

The build also writes `netlify-drop.zip`: only what the live site needs
(`index.html`, `config.js`, `photos/`), without these notes or the schema.

1. **First time:** log in to Netlify, open app.netlify.com/drop and drop
   `netlify-drop.zip` on it. You get a site at `something.netlify.app`.
2. **Your domain:** that site → Domain management → Add a domain. Netlify
   lists the DNS records to add at your registrar and turns on HTTPS by itself
   once they resolve.
3. **Every update:** rebuild, then open the site's **Deploys** tab and drop the
   new zip there. Don't use the /drop page again: it makes a new site, without
   your domain.

If Netlify ever refuses the zip, unzip it and drop the folder instead.

`studentEmailDomain` is the domain behind student logins
(`username@that-domain`). Those addresses never receive mail. Use a domain you own.

## Homepage content

`src/site.js`: the video (`.mp4` or YouTube link), team, about, the states
statistic and its source, contact email, privacy-page retention text. Team
photos and the group photo live in `src/photos/` (the build copies them to
`dist/photos/`). Rebuild after editing.

## Data

- Free Supabase projects include a 500 MB database. Each practice picture is
  about 10 KB and each test picture about 30 KB, so 30 students doing 3 runs a
  day for 10 weeks is roughly 70 MB. Watch **Reports → Database** size.
- Free projects pause after about a week with no activity. Open the site or
  dashboard before school breaks end, or move to a paid plan for the pilot.
- Export: Pilot admin → Export all results, or the SQL in the launch guide.

## Tests

```
python3 tools/test_engine.py      # tracing engine (22 checks)
python3 tools/test_app.py         # teacher -> student -> teacher flow (23)
python3 tools/test_pilot.py       # pilot features (29)
python3 tools/test_backend.py     # Supabase adapter against a fake client (18)
node tools/test_schema.mjs        # database rules on PGlite (48; npm i @electric-sql/pglite)
python3 tools/test_a11y.py axe.min.js   # WCAG 2.1 AA audit, 21 pages (npm i axe-core)
python3 tools/shot.py out.png     # letter sheet for reviewing the letterforms
```

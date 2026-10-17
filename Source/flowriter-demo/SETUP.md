# FloWriter: running the demo, and connecting a real backend

## What changed in this build

**New: "On your own" mode.** A fourth mode next to Demo, Practice and Test. No
music, no beat, no pacing dot: the child writes the whole word at their own
pace and taps **Score my writing**. It is scored on shape alone (ink inside the
margin, stroke covered) with the timing rule dropped, because there is no beat
to be on. This is the measurement that tells you whether the music is teaching
handwriting or just making practice fun: compare these scores over time, not
the scores the child gets while the music is running.

**New: practice help that fades.** Setup now has a **Practice help** control:

| Setting | What the music does when the pen leaves the path |
| --- | --- |
| Waits | Stops and holds until the pen is back (the original behaviour) |
| Quiets | Keeps playing but thins out to about a fifth of its volume |
| None | Keeps playing, no reaction |

**Fade the help** (on by default) steps through them as the same word is
practised: waits, waits, quiets, quiets, none. This is deliberate. Motor
learning research on the "guidance hypothesis" finds that constant, immediate
feedback improves performance while it is switched on and can weaken what the
learner retains once it is gone. Fading is the standard mitigation. Every
attempt records which level it ran at, so you can check whether it matters.

**New: real attempt records.** Every finished run is stored with its `mode`
(`practice`, `test`, `check`) and, for practice, its `gate` (`hold`, `duck`,
`off`). Check runs store no BPM, because they have none.

**New: writing-surface themes.** A picker in the write bar puts the writing
surface in a room: a chalkboard in a classroom, a holo panel on a space
station, a slate in a treehouse, and four more, or plain paper. It is cosmetic
only. Nothing about scoring, timing or the music changes, the rest of the page
keeps its normal light/dark styling, and the choice is remembered per device.

**Fixed: ink landed to the right of the pointer.** `layout()` sized the canvas
from `stage.clientWidth`, which counts padding. Any padding on the stage made
the backing store wider than the box it renders in, the browser scaled it to
fit, and every point landed short of the pointer by a margin that grew left to
right, about 30px at the right edge. It now measures the canvas's own content
box (`fix_canvas_width.py`). This was a latent bug in the engine; adding a
framed surface is simply what exposed it.

---

## Running the demo (no setup)

Open `dist/flowriter.html`. Everything runs in the browser against seeded
demo data in `localStorage`: test accounts, classes, assignments and a year of
invented history. Nothing leaves the machine. This is the build to use for a
walkthrough, a pitch, or showing a teacher what it does.

Test accounts are listed on the login page. Rebuild after any source change:

```
python3 build.py
```

---

## Connecting a real backend (needed for a pilot)

The demo keeps everything in one browser. A teacher on a laptop and a child on
an iPad will not see each other. To fix that:

### 1. Create the project

1. Make a free project at supabase.com.
2. Dashboard → SQL Editor → New query → paste all of `schema.sql` → Run.
3. Dashboard → Project Settings → API. Copy the **Project URL** and the
   **anon public** key.

### 2. Point the app at it

```
cp config.example.js config.js     # then fill in the two values
python3 build.py
```

The build only includes `config.js` when the file exists, so the demo build
stays offline by default. The anon key is browser-safe: what each account can
read and write is decided by the row level security policies in `schema.sql`,
not by the key. Never put the `service_role` key in `config.js`.

### 3. For a pilot, turn off email confirmation

Dashboard → Authentication → Providers → Email → turn **Confirm email** off.
Children will not be checking an inbox. Turn it back on for anything public.

### 4. Make the first teacher and class

Sign up in the app with the Teacher role. A class is created automatically;
its 6-letter code is on the Classes page. Students sign up with that code.

---

## Getting the pilot data out

Supabase → Table Editor → `attempts` → Export as CSV. Or, for the comparison
that matters, run this and export the result:

```sql
select p.username,
       a.mode,
       a.gate,
       date_trunc('day', a.created) as day,
       count(*)                                   as runs,
       round(avg(a.valid::numeric / a.total), 3)  as accuracy
from attempts a
join profiles p on p.id = a.user_id
where a.total > 0
group by 1, 2, 3, 4
order by p.username, day;
```

The question to ask of it: **do `check` scores climb over the weeks?** Practice
and test scores climbing only tells you they are getting better at the game.
Also worth a look: whether `practice` runs at `gate = 'off'` hold up as well as
runs at `gate = 'hold'`, which is the fading question.

---

## Before any real child uses this

These are decisions, not code, and none of them are handled for you.

- **Parental consent.** Collecting names, ages and work from children under 13
  puts you under COPPA. Get written parental consent before the pilot, and if a
  school is involved, ask how they want FERPA handled.
- **The app stores a birth year, not a birth date.** The signup form still asks
  for a date, but the backend keeps only the year. Do not widen this without a
  reason.
- **Leaderboards show usernames to other children.** Have children pick
  nicknames, or remove the leaderboard for the pilot.
- **Class leaderboards are computed in the browser**, which means the policy
  `attempts_classmates` in `schema.sql` lets a child's device read classmates'
  attempt rows. Drop that policy and compute the board in a view if that is
  more exposure than you want.
- **Two placeholder team bios** are still on the cover page. Replace or remove
  them before showing it to anyone outside the team.

---

## Themes and the artwork

Seven surfaces ship: Classroom, Space station, Treehouse, Submarine, Wizard
study, Art studio, Night camp. Five are dark surfaces with chalk-style ink, two
(study, studio) are light surfaces with dark ink.

```
python3 artwork/gen_art.py     # redraw the backgrounds
python3 skin_themes.py         # re-apply to both engines (re-runnable)
python3 check_contrast.py      # assert every theme stays legible
python3 build.py
```

To add or change one, edit the `THEMES` dict in `skin_themes.py` and re-run
those four. `skin_themes.py` strips its own previous output first, so it is
safe to run repeatedly.

Two things worth knowing:

- **Where the art came from matters.** The six generated backgrounds are drawn
  in code by `artwork/gen_art.py`, so they are original and carry no licence
  question. The classroom image is the one that was supplied; confirm you own
  it before showing this to a school or an investor, or regenerate it the same
  way as the others.
- **`check_contrast.py` is a real gate, not decoration.** `ok` and `bad` are
  what tell a child their stroke was on or off the path. It holds every theme
  to WCAG's 3:1 for non-text contrast, 4.5:1 for the child's own ink, and
  requires every theme to separate `ok` from `bad` under simulated red-green
  colour blindness *better than the app's own plain-paper palette does*. The
  plain palette is weak on that last axis, which is worth fixing properly one
  day: off-path strokes should carry a second cue (dashes, weight, a marker)
  rather than relying on colour. Roughly one boy in twelve is affected.

## Known limits of this build

- **Sync happens on load, not live.** Rows are pulled into memory at login and
  written back as they change. A teacher sees new submissions on refresh, not
  instantly. Fine for a classroom pilot, wrong for a product at scale.
- **Starter songs are generated in the browser**, so there are no audio files
  to host and nothing to license. Uploaded MP3s stay on the device that
  uploaded them; only the song's name and BPM reach the database.
- **The engines are still two separate pages** (`FinalFWAssignment.html`,
  `FinalFWFreePlay.html`) embedded in the shell and driven through
  `src/bridge.js`. Patches usually need applying to both.

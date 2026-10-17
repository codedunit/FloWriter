-- =====================================================================
-- FloWriter pilot: database schema for Supabase.
-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Safe to re-run: it drops and recreates its own policies and functions.
--
-- What is stored about a student: a display name (first name + last
-- initial), a username, the class they joined, and their writing attempts.
-- No email address and no birth date. Teachers sign up with an email and
-- confirm their school allows students to use FloWriter.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- profiles
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  username   text unique not null,
  role       text not null check (role in ('student','teacher')),
  name       text not null,
  school     text,
  class_id   uuid,
  attested   timestamptz,               -- teacher confirmed school authorization (COPPA/FERPA)
  joined     timestamptz not null default now(),
  last_seen  timestamptz
);

-- ---------------------------------------------------------------- classes
create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  name       text not null,
  code       text unique not null,
  school     text,
  archived   boolean not null default false,
  message    text,                       -- shown to students on their lessons page
  created    timestamptz not null default now()
);
alter table classes add column if not exists message text;
alter table classes add column if not exists sequential boolean not null default false;  -- lessons open one at a time, in order
alter table profiles add column if not exists handed text check (handed in ('right','left'));
alter table profiles drop constraint if exists profiles_class_id_fkey;
alter table profiles add constraint profiles_class_id_fkey foreign key (class_id) references classes on delete set null;

-- ---------------------------------------------------------------- songs
-- The shared song library. Starter songs are built into the app; uploads are
-- MP3 files in the "songs" storage bucket, at <teacher id>/<song id>.mp3.
create table if not exists songs (
  id        text primary key,
  owner_id  uuid references profiles on delete cascade,
  title     text not null,
  artist    text,
  bpm       numeric not null check (bpm > 0),
  "offset"  numeric,                    -- seconds to the first beat; null = detect when played
  duration  numeric,
  path      text,
  kind      text not null default 'upload' check (kind in ('starter','upload')),
  created   timestamptz not null default now()
);

-- ---------------------------------------------------------------- lessons
-- A lesson is assigned to one class: text, song, tempo multiplier, theme.
create table if not exists lessons (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes on delete cascade,
  title       text not null,
  preset      text,                      -- curriculum lesson it started from, if any
  text        text not null,
  song_id     text,
  mult        numeric not null default 1 check (mult > 0),   -- stroke tempo = song BPM x mult (no upper limit)
  bps         int not null default 1 check (bps in (1,2)),   -- beats per stroke
  rest        int not null default 1,                        -- rest beats for each space
  difficulty  text not null default 'standard' check (difficulty in ('easy','standard','challenge')),
  theme       text not null default '',
  due         timestamptz,
  student_ids uuid[],                    -- null = the whole class
  created     timestamptz not null default now()
);
-- kind: 'lesson' = demo, practice, test.  'check' = a handwriting check: the test only, no music
-- (give one at the start of the pilot and the same one at the end to measure progress).
alter table lessons add column if not exists kind text not null default 'lesson' check (kind in ('lesson','check'));

-- ---------------------------------------------------------------- attempts
-- One row per finished run. A lesson is complete once a student has a demo,
-- a practice and a test row for it. The test can only be taken once.
create table if not exists attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles on delete cascade,
  lesson_id  uuid not null references lessons on delete cascade,
  mode       text not null check (mode in ('demo','practice','test')),
  score      numeric,                    -- 0..1, null for demo
  valid      int not null default 0,     -- strokes on the line
  total      int not null default 0,
  reversed   int not null default 0,     -- strokes drawn in the wrong direction
  gate       text check (gate in ('hold','duck','off')),
  bpm        numeric,                    -- null for the test: it has no music
  seconds    int not null default 0,
  letters    jsonb,                      -- [{ch, score, n, rev}] per letter
  trace      text,                       -- small JPEG data URL of the run (tests and practice), for the teacher
  created    timestamptz not null default now()
);
create index if not exists attempts_user on attempts (user_id, created);
create index if not exists attempts_lesson on attempts (lesson_id);
create unique index if not exists attempts_one_test on attempts (user_id, lesson_id) where mode = 'test';

-- ---------------------------------------------------------------- teacher allowlist
-- Optional. Leave empty and anyone can sign up as a teacher. Add the pilot
-- teachers' emails and only they can:  insert into teacher_allowlist values ('name@school.org');
create table if not exists teacher_allowlist (email text primary key);
alter table teacher_allowlist enable row level security;   -- no policies: not readable from the app

-- ---------------------------------------------------------------- pilot team
-- Emails of the FloWriter team. They sign up as teachers and also see every
-- school, class and result in the Pilot admin page:  insert into pilot_admins values ('you@flowriter.org');
create table if not exists pilot_admins (email text primary key);
alter table pilot_admins enable row level security;

-- ---------------------------------------------------------------- feedback
create table if not exists feedback (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references profiles on delete set null,
  role     text,
  rating   int check (rating between 1 and 5),
  body     text,
  page     text,
  created  timestamptz not null default now()
);

-- ================================================================ helpers
create or replace function my_role() returns text language sql stable security definer
  set search_path = public as $$ select role from profiles where id = auth.uid() $$;
create or replace function my_class() returns uuid language sql stable security definer
  set search_path = public as $$ select class_id from profiles where id = auth.uid() $$;
create or replace function teaches(cid uuid) returns boolean language sql stable security definer
  set search_path = public as $$ select exists (select 1 from classes where id = cid and teacher_id = auth.uid()) $$;

-- Username login: the email behind a username (students have a generated one).
create or replace function email_for_username(u text) returns text language sql stable security definer
  set search_path = public, auth as $$
    select au.email from profiles p join auth.users au on au.id = p.id where lower(p.username) = lower(u) limit 1 $$;
-- Join page: what a class code points to, before the student has an account.
create or replace function class_for_code(c text) returns table (id uuid, name text, teacher text) language sql stable security definer
  set search_path = public as $$
    select cl.id, cl.name, p.name from classes cl join profiles p on p.id = cl.teacher_id
    where upper(cl.code) = upper(c) and not cl.archived limit 1 $$;
create or replace function username_taken(u text) returns boolean language sql stable security definer
  set search_path = public as $$ select exists (select 1 from profiles where lower(username) = lower(u)) $$;
-- A teacher sets a new password for a student in one of their classes.
create or replace function reset_student_password(student uuid, new_password text) returns void language plpgsql security definer
  set search_path = public, auth, extensions as $$
begin
  if not exists (select 1 from profiles p where p.id = student and p.role = 'student' and teaches(p.class_id)) then
    raise exception 'That student is not in one of your classes.';
  end if;
  if length(new_password) < 6 then raise exception 'Passwords need at least 6 characters.'; end if;
  update auth.users set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')) where id = student;
end $$;
create or replace function is_admin() returns boolean language sql stable security definer
  set search_path = public as $$ select exists (select 1 from pilot_admins where lower(email) = lower(auth.jwt() ->> 'email')) $$;
-- A teacher permanently deletes a student's account and all of their work (a family's deletion request).
create or replace function delete_student(student uuid) returns void language plpgsql security definer
  set search_path = public, auth as $$
begin
  if not exists (select 1 from profiles p where p.id = student and p.role = 'student' and teaches(p.class_id)) then
    raise exception 'That student is not in one of your classes.';
  end if;
  delete from auth.users where id = student;   -- cascades to the profile and every attempt
end $$;
grant execute on function email_for_username(text), class_for_code(text), username_taken(text) to anon, authenticated;
grant execute on function reset_student_password(uuid, text), delete_student(uuid), is_admin() to authenticated;

-- ================================================================ row level security
alter table profiles enable row level security;
alter table classes  enable row level security;
alter table songs    enable row level security;
alter table lessons  enable row level security;
alter table attempts enable row level security;
alter table feedback enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('profiles','classes','songs','lessons','attempts','feedback') loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: yourself; teachers see their students; students see their own teacher (for the name)
create policy profiles_self        on profiles for select using (id = auth.uid());
create policy profiles_my_students on profiles for select using (teaches(class_id));
create policy profiles_my_teacher  on profiles for select using (id in (select teacher_id from classes where id = my_class()));
create or replace function may_teach() returns boolean language sql stable security definer
  set search_path = public as $$
    select not exists (select 1 from teacher_allowlist)
        or exists (select 1 from teacher_allowlist where lower(email) = lower(auth.jwt() ->> 'email')) $$;
create policy profiles_insert_self on profiles for insert with check (id = auth.uid() and (role = 'student' or may_teach()));
create policy profiles_update_self on profiles for update using (id = auth.uid())
  with check (id = auth.uid() and role = my_role());           -- nobody can change their own role
create policy profiles_teacher_update on profiles for update using (teaches(class_id)); -- remove from class

-- classes
create policy classes_teacher on classes for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid() and my_role() = 'teacher');
create policy classes_student on classes for select using (id = my_class());

-- songs: one shared library, readable by every signed-in user, written by teachers
create policy songs_read   on songs for select using (auth.role() = 'authenticated');
create policy songs_write  on songs for insert with check (owner_id = auth.uid() and my_role() = 'teacher');
create policy songs_update on songs for update using (owner_id = auth.uid());
create policy songs_delete on songs for delete using (owner_id = auth.uid());

-- lessons
create policy lessons_teacher on lessons for all using (teaches(class_id)) with check (teaches(class_id));
create policy lessons_student on lessons for select
  using (class_id = my_class() and (student_ids is null or auth.uid() = any(student_ids)));

-- attempts: students write and read their own; teachers read their students'
create policy attempts_own_read   on attempts for select using (user_id = auth.uid());
create policy attempts_own_insert on attempts for insert with check (user_id = auth.uid()
  and exists (select 1 from lessons l where l.id = lesson_id and l.class_id = my_class()));
create policy attempts_own_update on attempts for update using (user_id = auth.uid() and mode <> 'test');
create policy attempts_teacher    on attempts for select
  using (exists (select 1 from profiles p where p.id = attempts.user_id and teaches(p.class_id))
      or exists (select 1 from lessons l where l.id = attempts.lesson_id and teaches(l.class_id)));

-- the pilot team reads everything
create policy profiles_admin on profiles for select using (is_admin());
create policy classes_admin  on classes  for select using (is_admin());
create policy lessons_admin  on lessons  for select using (is_admin());
create policy attempts_admin on attempts for select using (is_admin());

-- feedback: anyone signed in can send it; the pilot team reads it
create policy feedback_insert on feedback for insert with check (user_id = auth.uid());
create policy feedback_own    on feedback for select using (user_id = auth.uid() or is_admin());

-- live updates for teacher dashboards (Supabase Realtime respects the policies above)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'attempts') then
    execute 'alter publication supabase_realtime add table attempts';
  end if;
end $$;

-- ================================================================ storage: the MP3 library
insert into storage.buckets (id, name, public) values ('songs', 'songs', false) on conflict (id) do nothing;
drop policy if exists "songs read"   on storage.objects;
drop policy if exists "songs upload" on storage.objects;
drop policy if exists "songs delete" on storage.objects;
create policy "songs read"   on storage.objects for select using (bucket_id = 'songs' and auth.role() = 'authenticated');
create policy "songs upload" on storage.objects for insert with check (bucket_id = 'songs' and public.my_role() = 'teacher'
  and (storage.foldername(name))[1] = auth.uid()::text);
create policy "songs delete" on storage.objects for delete using (bucket_id = 'songs' and (storage.foldername(name))[1] = auth.uid()::text);

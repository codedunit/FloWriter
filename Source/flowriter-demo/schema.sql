-- FloWriter: Postgres schema for Supabase.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
--
-- Data minimisation note: this stores a birth YEAR, not a full date of birth.
-- The age check the app needs ("is this child under 13") only needs the year,
-- and storing less about a child is the right default. See SETUP.md.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
-- One row per account. The id matches the Supabase Auth user id.
create table if not exists profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  role        text not null check (role in ('student','teacher','general')),
  name        text not null,
  birth_year  int,
  class_id    uuid,
  school      text,
  prog        int not null default 0,
  joined      timestamptz not null default now()
);

-- ---------------------------------------------------------------- classes
create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles on delete cascade,
  name       text not null,
  code       text unique not null,
  school     text,
  archived   boolean not null default false,
  created    timestamptz not null default now()
);
alter table profiles
  drop constraint if exists profiles_class_id_fkey,
  add constraint profiles_class_id_fkey foreign key (class_id) references classes on delete set null;

-- ---------------------------------------------------------------- assignments
create table if not exists assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references classes on delete cascade,
  title       text not null,
  module      text,
  lesson_id   text,
  kind        text not null default 'practice' check (kind in ('practice','test')),
  text        text not null,
  due         timestamptz not null,
  song_id     text,
  bpm         numeric,
  difficulty  text not null default 'standard',
  student_ids uuid[],                      -- null = the whole class
  created     timestamptz not null default now()
);

-- ---------------------------------------------------------------- attempts
-- One row per finished run. `mode` is the thing the pilot turns on:
--   practice = music follows the pen   (gate says how much help: hold/duck/off)
--   test     = pen follows the music
--   check    = no music at all, the unaided measurement
create table if not exists attempts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles on delete cascade,
  source        text not null,             -- lesson | assignment | free
  assignment_id uuid references assignments on delete set null,
  lesson_id     text,
  module        text,
  mode          text not null check (mode in ('practice','test','check','demo')),
  gate          text check (gate in ('hold','duck','off')),
  text          text not null,
  valid         int  not null,
  total         int  not null,
  bpm           numeric,                   -- null for check runs: they have no tempo
  seconds       int  not null default 0,
  created       timestamptz not null default now()
);
create index if not exists attempts_user_created on attempts (user_id, created desc);
create index if not exists attempts_mode on attempts (mode);

-- ---------------------------------------------------------------- songs
create table if not exists songs (
  id       text primary key,
  owner_id uuid references profiles on delete cascade,
  title    text not null,
  artist   text,
  bpm      numeric not null,
  style    text,
  mood     text,
  hue      int,
  kind     text not null default 'starter' -- starter | upload
);

-- ================================================================ RLS
alter table profiles    enable row level security;
alter table classes     enable row level security;
alter table assignments enable row level security;
alter table attempts    enable row level security;
alter table songs       enable row level security;

-- Helper: the caller's own profile row, without recursing through RLS.
create or replace function me() returns profiles language sql stable security definer
  set search_path = public as $$ select * from profiles where id = auth.uid() $$;

-- Helper: does the caller teach this class?
create or replace function teaches(cid uuid) returns boolean language sql stable security definer
  set search_path = public as $$ select exists (select 1 from classes where id = cid and teacher_id = auth.uid()) $$;

-- Logging in with a username needs the email behind it before any session
-- exists, so that lookup also goes through a function. It returns only the
-- email for an exact username match and nothing else.
create or replace function email_for_username(u text) returns text language sql stable security definer
  set search_path = public, auth as $$
    select au.email from profiles p join auth.users au on au.id = p.id
    where lower(p.username) = lower(u) limit 1 $$;

-- Sign-up needs to turn a class code into a class id before the student has a
-- profile, so that one lookup goes through a function instead of a table policy.
create or replace function class_id_for_code(c text) returns uuid language sql stable security definer
  set search_path = public as $$ select id from classes where upper(code) = upper(c) and not archived limit 1 $$;

-- ---- profiles
create policy profiles_self on profiles for select using (id = auth.uid());
create policy profiles_classmates on profiles for select
  using (class_id is not null and class_id = (select class_id from me()));
create policy profiles_my_students on profiles for select using (teaches(class_id));
create policy profiles_global_board on profiles for select using (role = 'general');
create policy profiles_insert_self on profiles for insert with check (id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid());
-- a teacher may remove a student from their class
create policy profiles_teacher_update on profiles for update using (teaches(class_id));

-- ---- classes
create policy classes_mine on classes for select using (teacher_id = auth.uid());
create policy classes_my_class on classes for select using (id = (select class_id from me()));
create policy classes_write on classes for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ---- assignments
create policy assignments_for_class on assignments for select
  using (class_id = (select class_id from me()) or teaches(class_id));
create policy assignments_write on assignments for all using (teaches(class_id)) with check (teaches(class_id));

-- ---- attempts
create policy attempts_own on attempts for select using (user_id = auth.uid());
create policy attempts_insert_own on attempts for insert with check (user_id = auth.uid());
create policy attempts_update_own on attempts for update using (user_id = auth.uid());
create policy attempts_teacher on attempts for select
  using (exists (select 1 from profiles p where p.id = attempts.user_id and teaches(p.class_id)));
-- Class leaderboards are computed in the browser from classmates' rows.
-- If you would rather not expose row-level detail between children, drop this
-- policy and build a leaderboard view instead. See SETUP.md.
create policy attempts_classmates on attempts for select
  using (exists (select 1 from profiles p
                 where p.id = attempts.user_id
                   and p.class_id is not null
                   and p.class_id = (select class_id from me())));

-- ---- songs
create policy songs_readable on songs for select using (kind = 'starter' or owner_id = auth.uid());
create policy songs_write_own on songs for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

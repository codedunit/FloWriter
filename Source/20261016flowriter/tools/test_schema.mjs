// Runs schema.sql on PGlite with stand-ins for Supabase's auth and storage schemas,
// then checks the row level security rules as different users.
// Usage: node tools/test_schema.mjs (needs @electric-sql/pglite installed nearby)
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const schema = fs.readFileSync(process.argv[2] || new URL('../schema.sql', import.meta.url), 'utf8')
  .replace(/create extension if not exists pgcrypto[^;]*;/, '');
const db = new PGlite();
let pass = 0, fail = 0;
const ok = (name, cond, info = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  [' + info + ']' : '')); };
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (id uuid primary key, email text, encrypted_password text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
  create function extensions.gen_salt(t text) returns text language sql as $$ select 'salt' $$;
  create function extensions.crypt(p text, s text) returns text language sql as $$ select 'hash:' || p $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id serial primary key, bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  grant usage on schema auth, storage, extensions, public to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);
await db.exec(schema);
ok('schema.sql runs', true);
await db.exec(schema); ok('schema.sql runs a second time (safe to re-run)', true);
await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated; grant select, insert, delete on storage.objects to authenticated; grant usage on all sequences in schema storage to authenticated;`);

const T1 = '00000000-0000-0000-0000-0000000000a1', T2 = '00000000-0000-0000-0000-0000000000a2', S1 = '00000000-0000-0000-0000-0000000000b1', S2 = '00000000-0000-0000-0000-0000000000b2';
await db.exec(`insert into auth.users values ('${T1}','t1@school.org','x'),('${T2}','t2@school.org','x'),('${S1}','sam@students.flowriter.app','x'),('${S2}','ana@students.flowriter.app','x')`);
async function as(uid, email, sql, params){
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false), set_config('request.jwt.claim.role', '${uid ? 'authenticated' : 'anon'}', false), set_config('request.jwt.claim.email', '${email || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { const r = await db.query(sql, params); return { rows: r.rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
}
let r;
r = await as(T1, 't1@school.org', `insert into profiles (id, username, role, name, attested) values ($1,'murry','teacher','Mr. Murry', now())`, [T1]); ok('teacher creates their profile', !r.error, r.error);
r = await as(T1, 't1@school.org', `insert into classes (teacher_id, name, code) values ($1,'Period 2','MURRY2') returning id`, [T1]); ok('teacher creates a class', !r.error, r.error);
const C1 = r.rows[0].id;
await as(T2, 't2@school.org', `insert into profiles (id, username, role, name) values ($1,'rivera','teacher','Ms. Rivera')`, [T2]);
r = await as(T2, 't2@school.org', `insert into classes (teacher_id, name, code) values ($1,'Room 12','RIVR12') returning id`, [T2]); const C2 = r.rows[0].id;
r = await as(null, null, `select * from class_for_code('murry2')`); ok('join page finds the class by code, before sign-in', r.rows && r.rows[0] && r.rows[0].name === 'Period 2' && r.rows[0].teacher === 'Mr. Murry', JSON.stringify(r));
r = await as(S1, 'sam@students.flowriter.app', `insert into profiles (id, username, role, name, class_id) values ($1,'sam_k','student','Sam K.',$2)`, [S1, C1]); ok('student joins a class', !r.error, r.error);
await as(S2, 'ana@students.flowriter.app', `insert into profiles (id, username, role, name, class_id) values ($1,'ana_b','student','Ana B.',$2)`, [S2, C2]);
r = await as(null, null, `select email_for_username('SAM_K') as e`); ok('username login finds the account email', r.rows && r.rows[0].e === 'sam@students.flowriter.app');
r = await as(S1, null, `update profiles set role='teacher' where id=$1`, [S1]); ok('student cannot make themselves a teacher', !!r.error || (await as(S1, null, `select role from profiles where id=$1`, [S1])).rows[0].role === 'student', r.error);
r = await as(T1, 't1@school.org', `insert into lessons (class_id, title, text, song_id, mult, theme) values ($1,'Loops','e l h k','sg_sunny', 3.5, 'space') returning id`, [C1]); ok('teacher assigns a lesson (multiplier above 2 allowed)', !r.error, r.error);
const L1 = r.rows[0].id;
r = await as(T2, 't2@school.org', `insert into lessons (class_id, title, text) values ($1,'Sneaky','abc')`, [C1]); ok('teacher cannot add lessons to another teacher’s class', !!r.error);
r = await as(S1, null, `select title from lessons`); ok('student sees their class’s lesson', r.rows.length === 1 && r.rows[0].title === 'Loops');
r = await as(S2, null, `select title from lessons`); ok('student in another class does not', r.rows.length === 0);
r = await as(S1, null, `insert into attempts (user_id, lesson_id, mode) values ($1,$2,'demo'),($1,$2,'practice')`, [S1, L1]); ok('student records demo and practice', !r.error, r.error);
r = await as(S1, null, `insert into attempts (user_id, lesson_id, mode, score, letters) values ($1,$2,'test',.86,'[{"ch":"e","score":0.9}]')`, [S1, L1]); ok('student records the test', !r.error, r.error);
r = await as(S1, null, `insert into attempts (user_id, lesson_id, mode, score) values ($1,$2,'test',.99)`, [S1, L1]); ok('a second test is rejected', !!r.error, r.error && r.error.slice(0, 60));
r = await as(S1, null, `update attempts set score=1 where mode='test'`); r = await as(S1, null, `select score from attempts where mode='test'`); ok('student cannot change a submitted test', +r.rows[0].score === .86);
r = await as(S2, null, `insert into attempts (user_id, lesson_id, mode) values ($1,$2,'demo')`, [S2, L1]); ok('student cannot record work on another class’s lesson', !!r.error);
r = await as(T1, null, `select count(*)::int n from attempts`); ok('teacher sees their students’ work', r.rows[0].n === 3, JSON.stringify(r.rows));
r = await as(T2, null, `select count(*)::int n from attempts`); ok('other teachers do not', r.rows[0].n === 0);
r = await as(S2, null, `select count(*)::int n from attempts`); ok('other students do not', r.rows[0].n === 0);
r = await as(S1, null, `select username from profiles order by username`); ok('student sees only themselves and their teacher', JSON.stringify(r.rows.map(x => x.username)) === '["murry","sam_k"]', JSON.stringify(r.rows));
r = await as(T1, null, `select reset_student_password($1,'tiger42')`, [S1]); ok('teacher sets a new password for their student', !r.error, r.error);
r = await db.query(`select encrypted_password p from auth.users where id=$1`, [S1]); ok('password is changed in auth.users', r.rows[0].p === 'hash:tiger42');
r = await as(T2, null, `select reset_student_password($1,'hacked1')`, [S1]); ok('other teachers cannot reset it', !!r.error);
r = await as(T1, null, `insert into songs (id, owner_id, title, bpm, path) values ('sg_x',$1,'My Song',92,$2)`, [T1, T1 + '/sg_x.mp3']); ok('teacher adds a song', !r.error, r.error);
r = await as(S1, null, `insert into songs (id, owner_id, title, bpm) values ('sg_y',$1,'Nope',92)`, [S1]); ok('students cannot add songs', !!r.error);
r = await as(S1, null, `select title from songs`); ok('everyone signed in can read the library', r.rows.length === 1);
r = await as(T1, null, `insert into storage.objects (bucket_id, name, owner) values ('songs', $1, $2)`, [T1 + '/sg_x.mp3', T1]); ok('teacher uploads an MP3 to their folder', !r.error, r.error);
r = await as(T1, null, `insert into storage.objects (bucket_id, name, owner) values ('songs', $1, $2)`, [T2 + '/sg_z.mp3', T1]); ok('but not into another teacher’s folder', !!r.error);
r = await as(S1, null, `select count(*)::int n from storage.objects`); ok('students can download songs', r.rows[0].n === 1);
// allowlist
await db.exec(`insert into teacher_allowlist values ('approved@school.org')`);
await db.exec(`insert into auth.users values ('00000000-0000-0000-0000-0000000000c1','random@else.com','x')`);
r = await as('00000000-0000-0000-0000-0000000000c1', 'random@else.com', `insert into profiles (id, username, role, name) values ('00000000-0000-0000-0000-0000000000c1','rando','teacher','X')`); ok('with an allowlist, unlisted emails cannot become teachers', !!r.error);
r = await as('00000000-0000-0000-0000-0000000000c1', 'random@else.com', `insert into profiles (id, username, role, name, class_id) values ('00000000-0000-0000-0000-0000000000c1','rando','student','X',$1)`, [C1]); ok('but can still join as students', !r.error, r.error);
// ---- pilot features
r = await as(T1, 't1@school.org', `insert into lessons (class_id, title, text, kind) values ($1,'Check','The quick brown fox.','check') returning id`, [C1]); ok('teacher adds a handwriting check', !r.error, r.error);
r = await as(T1, 't1@school.org', `insert into lessons (class_id, title, text, kind) values ($1,'Bad','x','quiz')`, [C1]); ok('unknown lesson kinds are rejected', !!r.error);
r = await as(T1, 't1@school.org', `update classes set sequential = true where id = $1 returning sequential`, [C1]); ok('teacher turns on lessons in order', r.rows && r.rows[0].sequential === true, r.error);
r = await as(S1, null, `update profiles set handed = 'left' where id = $1 returning handed`, [S1]); ok('student sets left hand', r.rows && r.rows[0].handed === 'left', r.error);
r = await as(S1, null, `update profiles set handed = 'both' where id = $1`, [S1]); ok('invalid hand value rejected', !!r.error);
r = await as(T1, 't1@school.org', `insert into feedback (user_id, role, rating, body) values ($1,'teacher',4,'Kids love it')`, [T1]); ok('teacher sends feedback', !r.error, r.error);
r = await as(T2, 't2@school.org', `select count(*)::int n from feedback`); ok('other teachers cannot read it', r.rows[0].n === 0);
r = await as(T2, 't2@school.org', `select count(*)::int n from attempts`); const before = r.rows[0].n;
await db.exec(`insert into pilot_admins values ('t2@school.org')`);
r = await as(T2, 't2@school.org', `select count(*)::int n from attempts`); ok('a pilot admin sees every attempt', r.rows[0].n > before && r.rows[0].n === 3, `${before} -> ${r.rows[0].n}`);
r = await as(T2, 't2@school.org', `select count(*)::int n from feedback`); ok('and the feedback', r.rows[0].n === 1);
r = await as(T2, 't2@school.org', `select is_admin() a`); ok('is_admin() is true for the pilot team', r.rows[0].a === true);
r = await as(T1, 't1@school.org', `select is_admin() a`); ok('and false for everyone else', r.rows[0].a === false);
r = await as(T2, 't2@school.org', `insert into lessons (class_id, title, text) values ($1,'Admin write','abc')`, [C1]); ok('admins can read but not change other teachers’ classes', !!r.error);
r = await as(S2, null, `update profiles set class_id = $2 where id = $1 returning class_id`, [S2, C1]); ok('a student can join another class by changing their class', r.rows && r.rows[0].class_id === C1, r.error);
r = await as(T2, 't2@school.org', `select delete_student($1)`, [S1]); ok('a teacher cannot delete another teacher’s student', !!r.error);
r = await as(T1, 't1@school.org', `select delete_student($1)`, [S1]); ok('teacher deletes their student', !r.error, r.error);
r = await db.query(`select (select count(*)::int from auth.users where id=$1) u, (select count(*)::int from profiles where id=$1) p, (select count(*)::int from attempts where user_id=$1) a`, [S1]);
ok('the login, profile and every attempt are gone', r.rows[0].u === 0 && r.rows[0].p === 0 && r.rows[0].a === 0, JSON.stringify(r.rows[0]));
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);

// Copy this file to config.js and fill in the two values from your Supabase
// project (Dashboard > Project Settings > API). Then load it BEFORE the app
// script, e.g. <script src="config.js"></script>.
//
// Without this file the app runs on the seeded demo data in localStorage,
// which is what you want for a walkthrough or a pitch.
//
// The anon key is a public, browser-safe key. It is not a secret: what each
// account may read and write is decided by the row level security policies in
// schema.sql, not by the key. Never put the service_role key in here.
window.FLOWRITER_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-KEY',
};

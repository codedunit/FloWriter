// Copy this file to config.js, fill in your Supabase project, and deploy it
// next to index.html. Without config.js the site runs on demo data.
window.FLOWRITER_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',
  anonKey: 'YOUR-ANON-PUBLIC-KEY',          // Project Settings > API > anon public. Never the service_role key.
  // Students have no email. Their accounts use <username>@<this domain>,
  // which never receives mail. Use a domain you own.
  studentEmailDomain: 'students.flowriter.app',
};

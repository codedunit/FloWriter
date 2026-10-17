// =====================================================================
// Homepage content. Edit this file to fill in the video, the team and the
// About section, then rebuild (python3 build.py).
// =====================================================================
const SITE = {
  // The pilot explanation video. Use an .mp4 URL (plays on the page) or a
  // YouTube link (embedded on your own site; shown as a link elsewhere).
  // Leave empty to show the "coming soon" frame.
  video: '',
  videoPoster: '',

  // Cited on the homepage. Update the number and the source together.
  stat: {
    value: '25',
    label: 'U.S. states require cursive instruction, and more bills are moving',
    source: 'FOX Television Stations, July 2025',
    url: 'https://www.fox26houston.com/news/states-require-cursive-taught-schools',
  },

  about: [
    'FloWriter turns cursive practice into a musical performance. Every stroke of every letter is matched to a beat of a song, so a child learns the movement of each letter and the rhythm of writing it at the same time.',
    'Handwriting is coming back to classrooms, but most digital tools are tracing worksheets on a screen. FloWriter gives teachers a standard cursive sequence built on Zaner-Bloser letterforms, lets them shape every lesson around their class, and shows exactly which letters each student is still working on.',
  ],

  // Team cards, in order. Add a `photo` URL (square image) if you have one.
  team: [
    { name: 'Evan', role: 'Founder · product and curriculum', bio: 'Neuroscience student at Johns Hopkins on the physician-scientist track, TEDx speaker, and principal symphony musician. Built FloWriter to put rhythm back into handwriting.' },
    // { name: 'Teammate', role: 'Engineering', bio: 'One or two sentences.' },
    // { name: 'Teammate', role: 'Classroom research', bio: 'One or two sentences.' },
  ],

  // Shown as plain text in the footer and on the privacy page. Leave empty to hide.
  contact: '',

  // Privacy page (#/privacy). Have your schools review it before the pilot.
  privacyUpdated: 'October 2026',
  retention: 'We keep pilot data until the pilot ends. Within 30 days after that we delete it, unless the school asks us in writing to keep it for continued use.',
};

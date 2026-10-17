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

  // Team cards, in order. `photo` is a square image in src/photos (copied to dist/photos by the build).
  team: [
    { name: 'Aaron Wei', school: 'Cornell University', major: 'Electrical Engineering', photo: 'photos/aaron.jpg',
      linkedin: 'https://www.linkedin.com/in/aaron-wei-a56b27293',
      bio: 'Aaron is a violinist with a passion for classical music. He has played in prestigious orchestras such as the Cleveland Orchestra Youth Orchestra, the Ohio Music Education Association All-State Orchestra, and, more recently, the Cornell Symphony Orchestra. He was also the CEO and cofounder of the Fucik Trio, a chamber group that traveled around Northeast Ohio performing at senior homes. He learned cursive in elementary school and is still a massive cursive enthusiast today.' },
    { name: 'Evan Shi', school: 'Johns Hopkins University', major: 'Neuroscience and Applied Mathematics and Statistics', photo: 'photos/evan.jpg',
      linkedin: 'https://www.linkedin.com/in/evanshi08/',
      bio: 'Evan is a French horn and harp player with 13 years of musical experience. He has played in programs such as the Houston Youth Symphony and the Houston Harp Ensemble. For fun, he loves filmmaking and has directed award-winning documentaries. He snail-mails pen pals around the world and journals regularly, using the cursive he learned in elementary school.' },
  ],
  // Shown beside the team cards. Leave empty to hide.
  groupPhoto: 'photos/team.jpg',
  groupPhotoAlt: 'Photo-booth strip of Evan Shi and Aaron Wei, three frames',
  groupPhotoCaption: 'Evan (left) and Aaron',

  // Shown as plain text in the footer and on the privacy page. Leave empty to hide.
  contact: '',

  // Privacy page (#/privacy). Have your schools review it before the pilot.
  privacyUpdated: 'October 2026',
  retention: 'We keep pilot data until the pilot ends. Within 30 days after that we delete it, unless the school asks us in writing to keep it for continued use.',
};

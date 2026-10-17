// =====================================================================
// FloWriter curriculum: the Zaner-Bloser teaching order, plus a text
// generator teachers use to make their own practice text.
// Text may only use what the tracing engine draws: A-Z a-z . , ! ? '
// =====================================================================

// Zaner-Bloser introduces lowercase cursive by the stroke a letter starts
// with (undercurve, downcurve, overcurve), then capitals by family, then
// joins and sentences. Each lesson only uses letters taught up to that point.
const CURRICULUM = [
  { id: 'u1', title: 'Lowercase', lessons: [
    { id: 'zb1', title: 'Undercurve letters', focus: 'itwu', text: 'i t u w it wit tutu' },
    { id: 'zb2', title: 'More undercurve letters', focus: 'rspj', text: 'r s p j rust trip jut wisp' },
    { id: 'zb3', title: 'Undercurve loops', focus: 'elhkfb', text: 'e l h k f b tell help kite fish blue' },
    { id: 'zb4', title: 'Downcurve letters', focus: 'adgocq', text: 'a d g o c q dog cat good quiet' },
    { id: 'zb5', title: 'Overcurve letters', focus: 'nmxyzv', text: 'n m x y z v many fox zoom seven' },
  ]},
  { id: 'u2', title: 'Capitals', lessons: [
    { id: 'zb6', title: 'Downcurve capitals', focus: 'ACEO', text: 'A C E O Ann Cal Eve Otis' },
    { id: 'zb7', title: 'Curve forward capitals', focus: 'NMHKUYZVXW', text: 'N M H K U Y Nan Max Hugo Kim' },
    { id: 'zb8', title: 'Doublecurve and overcurve capitals', focus: 'TFIJQ', text: 'T F I J Q Tim Fay Ivy Jo Quinn' },
    { id: 'zb9', title: 'Undercurve loop capitals', focus: 'GSLDPRB', text: 'G S L D P R B Gus Sam Lea Dot Rex' },
  ]},
  { id: 'u3', title: 'Words and sentences', lessons: [
    { id: 'zb10', title: 'High joins after b o v w', focus: 'bovw', text: 'bow vow web owl boat oven' },
    { id: 'zb11', title: 'First sentences', focus: '', text: 'I can write to the beat.' },
    { id: 'zb12', title: 'A short story', focus: '', text: 'The cat sat on a red mat. It was happy.' },
    { id: 'zb13', title: 'Peter Pan', focus: '', text: 'All children, except one, grow up.', cite: 'J. M. Barrie, Peter Pan (1911), public domain' },
  ]},
];
const ZB_ORDER = 'itwurspjelhkfbadgocqnmxyzv';
function findPreset(id){ for (const u of CURRICULUM) for (const l of u.lessons) if (l.id === id) return { unit: u, lesson: l }; return null; }

// Common words children know (Dolch and Fry lists, plus music and classroom words).
const WORD_BANK = `a about after again air all also an and animal ant any apple are arm art as ask at ate away baby back bad bag
ball band barn bat be bean bear beat bed bee bell best big bike bird bit blue boat bob body book bow box boy bread brown bug
bus but buy by cake call came camp can cap car card care cat cell chair child city clap class clock cloud coat cold come cook
cool cow cub cup cut dad dance day deep desk did dig dish do dog doll door dot down draw dream drink drum duck each ear early
east eat egg end even every eye face fall far farm fast fat feet fell few find fine fire fish five fix flag flat flute fly
food foot for fox free friend frog from full fun game gas gate gift girl give glad go goat gold good got grass gray great
green grow gum had hall hand happy hat have he head hear heat help hen her here hill him his hit hop horn horse hot house how
hug hum hunt I ice if ill in ink into is it its jam jar jet job jog joy juice jump just keep key kick kid kind king kite
kitten lake lamp land last late laugh leaf leg let lid light like line lion lip list little live log long look lot loud love
low mad make man many map mat may me meet milk mix mom moon more most mud mug music must my name nap near neck nest net new
next nice night no nod nose not note now nut oak off old on one only open or our out over owl own pal pan park part pass pat
pen pet piano pick pie pig pin pink plan plant play please pot pull pup put quick quiet quit rain ran rat read red rest rice
ride ring river road rock room rope rose row rub rug run sad sail salt sand sat saw say sea seat see seed seven she ship shoe
shop show sing sip sit six sky sled sleep slow small snow so soap sock soft some song soon soup spin spot star stem step stop
storm sun sunny swim tag tail take talk tap tea tell ten tent than that the them then they thin this tie time tip to toe told
too top toy tree trip truck try tub tug turn two up us use van very vest vet vine violin wag walk want warm was wash water
wave way we web well went wet what when white who why wig will win wind wing wish with wolf won word work wow write yard
yarn yellow yes yet you zip zoo zoom`.split(/\s+/);

const SENTENCE_BANK = [
  'I can write to the beat.', 'The cat sat on a red mat.', 'We love to sing and dance.', 'My dog can jump high.',
  'The sun is warm today.', 'Tap the drum and hum.', 'A big fox ran fast.', 'Fish swim in the deep blue sea.',
  'Can you hear the music?', 'The owl sleeps all day.', 'I see a kite in the sky.', 'Stars shine at night.',
  'The frog sat on a log.', 'Seven bees buzz by the tree.', 'We read a good book.', 'The bus is yellow.',
  'Rain falls on the green grass.', 'My hat is on the bed.', 'The piano plays a soft song.', 'Jump, hop, and spin!',
  'Quiet music helps me write.', 'The duck swims in the pond.', 'I like milk and cake.', 'Our class has a pet fish.',
  'The wind blew my hat away.', 'Look at the big brown bear.', 'Zoe zips up her coat.', 'Max plays the violin.',
  'Ivy keeps a beat with her feet.', 'The moon is round and bright.',
];

// Generator. `focus`: letters to practice. `known`: letters the class already knows
// (blank = all). kind: 'letters' | 'words' | 'sentence'. Returns clean text.
function generateText({ focus = '', known = '', kind = 'words', count = 6, seed = Math.random } = {}){
  const f = [...new Set(focus.replace(/[^A-Za-z]/g, ''))];
  const k = new Set((known || 'abcdefghijklmnopqrstuvwxyz').toLowerCase().replace(/[^a-z]/g, ''));
  f.forEach(c => k.add(c.toLowerCase()));
  const pickN = (arr, n) => { const a = arr.slice(), out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(seed() * a.length), 1)[0]); return out; };
  if (kind === 'letters') {
    if (!f.length) return '';
    // Zaner-Bloser style drill: each letter alone, then joined three times
    return f.map(c => `${c} ${c}${c}${c}`).join(' ');
  }
  if (kind === 'sentence') {
    const fl = f.map(c => c.toLowerCase());
    const pool = SENTENCE_BANK.filter(s => !fl.length || fl.some(c => s.toLowerCase().includes(c)));
    return pickN(pool.length ? pool : SENTENCE_BANK, Math.max(1, Math.min(3, Math.round(count / 6)))).join(' ');
  }
  const fl = f.map(c => c.toLowerCase());
  const fits = WORD_BANK.filter(w => [...w.toLowerCase()].every(c => k.has(c)));
  const withFocus = fits.filter(w => !fl.length || fl.some(c => w.toLowerCase().includes(c)));
  const words = pickN(withFocus.length ? withFocus : fits, count);
  return words.join(' ');
}

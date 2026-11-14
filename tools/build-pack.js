// בונה "חבילת שירים" פרטית מתיקיית קובצי MIDI: כל הקבצים נקראים, מצומצמים למנגינה + בס, ממוינים לקטגוריות
// ונארזים לקובץ דחוס אחד בתוך האפליקציה (songs/). האפליקציה טוענת אותו לבד בפתיחה הראשונה (ושוב כשהחבילה מתעדכנת).
// הרצה: node tools/build-pack.js [תיקיית MIDI] [תיקיית פלט]   (ברירת מחדל: MIDI → songs/)
// אחרי בנייה מחדש: commit + push — וכל המכשירים יקבלו את השירים החדשים.
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const MidiFile = require('../js/midifile.js');
const root = path.join(__dirname, '..');
const dir = process.argv[2] || path.join(root, 'MIDI'), outDir = process.argv[3] || path.join(root, 'songs'), out = path.join(outDir, 'keys-star-songs.ksp');

const HEB = /[֐-׿]/;
const CLASSIC = /\b(bach|mozart|beethoven|chopin|tchaikovsky|tschaikowsky|vivaldi|debussy|schubert|handel|haendel|haydn|brahms|liszt|grieg|satie|pachelbel|albinoni|bizet|verdi|rossini|strauss|mendelssohn|schumann|dvorak|rachmaninov|rachmaninoff|ravel|saint-sa[eë]ns|offenbach|scott joplin|clementi|czerny|paganini|elgar|holst|mussorgsky|puccini|wagner|boccherini|corelli|scarlatti|purcell|telemann|faure|massenet|delibes|borodin|rimsky|khachaturian|gershwin|sibelius|smetana|weber|gounod|ponchielli|von suppe|suppe|lully|monti)\b/i;
const FILM = /\b(disney|frozen|moana|aladdin|lion king|mermaid|beauty and the beast|pocahontas|mulan|tangled|encanto|toy story|harry potter|star wars|john williams|hans zimmer|pirates of the caribbean|titanic|my heart will go on|circle of life|let it go|hakuna matata|under the sea|whole new world|how far i'?ll go|colors of the wind|can you feel the love|be our guest|part of your world|zelda|mario|pokemon|tetris|sonic|jurassic|indiana jones|ghostbusters|mission impossible|james bond|007|pink panther|shrek|ratatouille|wall-?e|nemo|incredibles|minions|despicable me|greatest showman|mamma mia|grease|sound of music|mary poppins|wizard of oz|cinderella|snow white|sleeping beauty|jungle book|peter pan|bambi|dumbo|pinocchio|hercules|tarzan|lilo|zootopia|inside out|lego movie|movie themes?|film|soundtrack|video game|nintendo|tv themes?|cartoon|anime|pixar|dreamworks|ice age|madagascar|kung fu panda|how to train your dragon|trolls|sesame|muppet)\b/i;
const ROCK = /\b(ac[ _]?dc|aerosmith|alice cooper|beatles|queen|led zeppelin|pink floyd|rolling stones|guns n'? ?roses|metallica|nirvana|deep purple|eagles|kiss|def leppard|bon jovi|doors|jimi hendrix|hendrix|green day|linkin park|u2|dire straits|scorpions|van halen|toto|bryan adams|bruce springsteen|elvis|chuck berry|creedence|the who|black sabbath|iron maiden|journey|boston|r\.?e\.?m\.?|oasis|red hot chili|foo fighters|ozzy|santana|eric clapton|clapton|cream|zz top|lynyrd skynyrd|status quo|rainbow|whitesnake|europe|survivor|foreigner|styx|kansas|yes|genesis|rush|the police|police|sting|blondie|the cure|depeche mode|smiths|ramones|sex pistols|clash|the kinks|kinks|the animals|animals|beach boys|buddy holly|little richard|jerry lee lewis|bill haley|roy orbison|the shadows|shadows|ventures|cheap trick|heart|pat benatar|joan jett|the knack|offspring|blink|weezer|muse|radiohead|coldplay|killers|white stripes|arctic monkeys|franz ferdinand|imagine dragons|twenty one pilots|evanescence|three doors down|3 doors down|creed|nickelback|bush|pearl jam|soundgarden|alice in chains|stone temple|smashing pumpkins|cranberries|alanis|ugly kid joe|extreme|mr\.? big|skid row|motley crue|poison|ratt|warrant|cinderella)\b/i;

const cleanTitle = s => s.replace(/\((?:[^()]*(?:midi by|www\.|piano cover|tutorial|easy|version|seq|sequenced)[^()]*)\)/gi, '').replace(/\s+/g, ' ').replace(/^[\s\-–_.]+|[\s\-–_.]+$/g, '').trim();
const titleCase = s => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
function describe(file) {
  const rel = path.relative(dir, file), parts = rel.split(path.sep), src = parts[0];
  let base = path.basename(file).replace(/\.(mid|midi|kar)$/i, '');
  try { if (/%[0-9a-f]{2}/i.test(base)) base = decodeURIComponent(base); } catch (e) { /* שם לא תקין */ }
  let title = base, artist = '';
  if (/^midiworld/i.test(src)) {
    artist = parts.length > 2 ? parts[1].replace(/_/g, ' ') : '';
    const m = base.split('_-_');
    title = (m.length > 1 ? m.slice(1).join(' - ') : base).replace(/_/g, ' ');
    if (!title.trim()) title = artist;
  } else if (/cprato/i.test(src)) {
    const m = /^(.+?)\s+-\s+(.+)$/.exec(base); if (m) { artist = m[1]; title = m[2]; }
  } else if (/freemidi/i.test(src)) {
    title = titleCase(base.replace(/[-_]+/g, ' '));
  } else if (/itamarnov/i.test(src)) {
    artist = 'ליווי פסנתר';
  } else title = base.replace(/_/g, ' ');
  title = cleanTitle(title); artist = cleanTitle(artist);
  const who = (artist + ' ' + parts.slice(1, -1).join(' ')).toLowerCase(), hay = who + ' ' + title.toLowerCase();
  // סרטים ומשחקים: לפי השם או התיקייה; קלאסי ורוק: לפי האמן בלבד ("Dancing Queen" של אבבא הוא לא להקת קווין)
  const cat = HEB.test(title + artist) ? 'israeli' : CLASSIC.test(who) ? 'classic' : FILM.test(hay) ? 'disney' : ROCK.test(who.replace(/\babba\b/, '')) ? 'rock' : 'pop';
  return { title: title || base, artist, cat };
}

function walk(d) { const r = []; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) r.push(...walk(p)); else if (/\.(mid|midi|kar)$/i.test(e.name)) r.push(p); } return r; }
const files = walk(dir).sort();
const songs = [], seen = new Set(); const stat = { ok: 0, bad: 0, dup: 0, tiny: 0, cut: 0 }, cats = {};
const MAXN = 3000; // שירים ארוכים מאוד נחתכים (רמיקסים של 10 דקות)
for (const f of files) {
  const info = describe(f);
  const key = (info.artist + '|' + info.title).toLowerCase().replace(/[^a-z0-9֐-׿|]+/g, '');
  if (seen.has(key)) { stat.dup++; continue; }
  let s;
  try { const b = fs.readFileSync(f); s = MidiFile.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), info.title); } catch (e) { stat.bad++; continue; }
  const rh = s.raw.filter(n => n[3] === 'R');
  if (rh.length < 24) { stat.tiny++; continue; }
  let raw = s.raw; if (raw.length > MAXN) { raw = raw.slice(0, MAXN); stat.cut++; }
  // דחיסה: כל תו = 3 מספרים שלמים — (תו×2 + יד), הפרש זמן מהתו הקודם ומשך, ביחידות של 1/48 פעמה
  const n = []; let prev = 0;
  for (const [m, st, du, h] of raw) { const t = Math.round(st * 48); n.push(m * 2 + (h === 'L' ? 1 : 0), t - prev, Math.max(1, Math.round(du * 48))); prev = t; }
  seen.add(key);
  const id = 'pk_' + require('crypto').createHash('md5').update(key).digest('hex').slice(0, 10);
  const row = { id, t: info.title, a: info.artist, c: info.cat, l: s.level, b: s.bpm, m: s.beats, n };
  if (s.lyrics && s.lyrics.length) row.y = s.lyrics;
  songs.push(row); stat.ok++; cats[info.cat] = (cats[info.cat] || 0) + 1;
}
const json = JSON.stringify({ app: 'keys-star-pack', v: 1, made: new Date().toISOString(), songs });
const gz = zlib.gzipSync(json, { level: 9 });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(out, gz);
const ver = require('crypto').createHash('md5').update(gz).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(outDir, 'pack-info.json'), JSON.stringify({ v: ver, n: songs.length, made: new Date().toISOString() }) + '\n');
console.log(`${files.length} קבצים → ${stat.ok} שירים (${stat.dup} כפולים, ${stat.bad} לא נקראו, ${stat.tiny} בלי מנגינה, ${stat.cut} נחתכו)`);
console.log('קטגוריות:', JSON.stringify(cats));
console.log(`גודל: ${(json.length / 1048576).toFixed(1)}MB → דחוס ${(gz.length / 1048576).toFixed(1)}MB · ${out}`);

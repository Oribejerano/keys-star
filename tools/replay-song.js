// ניתוח הקלטת נגינה של שיר (מתוך מסך הנגינה, כפתור ⏺): לכל "טעות" שהמשחק הכריז — מה באמת נוגן?
// משווה בין: (1) מה שהמשחק החליט בזמן אמת, (2) תמלול ייחוס איטי ומדויק של ההקלטה, (3) הרצה חוזרת של מנוע ההאזנה
// על אותו צליל עם אותם תווים צפויים (כדי לבדוק תיקונים: --opt=key:val).
// הרצה: node tools/replay-song.js <קובץ.wav | תיקייה> [-v] [--opt=key:val,key:val]
const fs = require('fs'), path = require('path');
const { readWav } = require('./analyze-wav.js'), { transcribe, nm } = require('./transcribe.js');
const Detector = require('../js/detector.js');
const args = process.argv.slice(2), verbose = args.includes('-v');
const target = args.find(a => !a.startsWith('-')) || path.join(__dirname, '..', 'samples');
const OPT = {}; for (const kv of ((args.find(a => a.startsWith('--opt=')) || '').slice(6)).split(',').filter(Boolean)) { const [k, v] = kv.split(':'); OPT[k] = +v; }

const f2 = x => x.toFixed(2);
const rel = d => ({ 0: 'אותו תו', 12: 'אוקטבה מעל', '-12': 'אוקטבה מתחת', 24: '2 אוקטבות מעל', '-24': '2 אוקטבות מתחת', 7: 'קווינטה מעל', '-7': 'קווינטה מתחת', 19: 'אוקטבה+קווינטה מעל', '-19': 'אוקטבה+קווינטה מתחת', 1: 'חצי טון מעל', '-1': 'חצי טון מתחת', 2: 'טון מעל', '-2': 'טון מתחת', 5: 'קוורטה מעל', '-5': 'קוורטה מתחת' }[d] || `${d > 0 ? '+' : ''}${d} חצאי טונים`);

// הרצה חוזרת של המנוע: דופק כל 5 אלפיות שנייה, ניתוח מלא כל דופק שני — כמו באפליקציה
function replay(x, sr, expAt, opt, dbgWant) {
  const det = new Detector(sr, opt), N = det.N, hop = Math.round(sr * 0.005), frame = new Float32Array(N), ev = [], dbg = [];
  if (dbgWant) det.dbg = o => dbg.push(o);
  let fi = 0;
  for (let p = hop; p <= x.length; p += hop) {
    const st = p - N; if (st >= 0) frame.set(x.subarray(st, p)); else { frame.fill(0); frame.set(x.subarray(0, p), -st); }
    const tMs = p / sr * 1000, exp = expAt(p / sr);
    for (const e of det.process(frame, tMs, exp, hop, (fi++ % 2) !== 1)) ev.push({ t: e.t0 != null ? e.t0 / 1000 : p / sr, at: p / sr, on: e.type === 'on', m: e.midi, g: !!e.ghost });
  }
  return { ev, dbg, det };
}

function one(file) {
  const { sr: sr0, x: x0, info } = readWav(file);
  if (!info || info.kind !== 'song') return false;
  // הקובץ נשמר בחצי קצב דגימה; מחזירים לקצב המקורי של המכשיר (אינטרפולציה) כדי שהמנוע ירוץ בדיוק כמו אצלה
  const sr = (info.rate && info.rate.orig) || sr0, k = sr / sr0;
  let x = x0;
  if (k !== 1) { x = new Float32Array(Math.floor(x0.length * k)); for (let i = 0; i < x.length; i++) { const p = i / k, a = Math.floor(p), f = p - a; x[i] = (x0[a] || 0) * (1 - f) + (x0[a + 1] || 0) * f; } }
  const dur = x.length / sr, log = info.log || [], live = info.events || [];
  console.log(`\n=== ${path.basename(file)} · ${info.title || ''} · ${f2(dur)} שניות · ${info.env && info.env.ua ? (/iPad|iPhone/.test(info.env.ua) ? 'iOS' : /Android/.test(info.env.ua) ? 'Android' : 'מחשב') : ''} · עוצמה מרבית ${info.peak}`);
  const starts = log.filter(o => o.k === 'start' || o.k === 'snap');
  for (const s of starts) console.log(`  ${f2(s.t)}s ${s.k === 'snap' ? 'הקלטה התחילה באמצע' : 'התחלה'}: מצב ${s.mode}, קצב ${Math.round(s.tempo * 100)}%, יד ${s.arr}, תיבות ${s.range.join('–')}`);
  const sc = info.score; console.log(`  בזמן אמת: ✓ ${sc.ok} פגיעות · ✗ ${sc.wrong} "טעויות" · ${sc.miss} פספוסים · 🚩 ${sc.flags} סימונים`);

  // רשימת התווים הצפויים לאורך הזמן — כמו שהמשחק מסר למנוע
  const expT = [];
  for (const o of log) { if (o.k === 'snap' && o.exp) expT.push([o.t, o.exp]); if (o.k === 'exp') expT.push([o.t, o.m]); }
  let ei = 0; const expAt = t => { while (ei + 1 < expT.length && expT[ei + 1][0] <= t) ei++; while (ei > 0 && expT[ei][0] > t) ei--; const e = expT[ei]; return e && e[0] <= t && e[1].length ? new Set(e[1]) : null; };

  // תמלול ייחוס: מה באמת נוגן (לאט ומדויק, בלי לדעת מה צפוי)
  const all = transcribe(x, sr, { minLevel: 0.04, poly: 3, tune: (info.cfg && info.cfg.tune) || 0 }).notes;
  // הקשות חלשות בהרבה מהנגינה הרגילה (רעש, שאריות של צליל) לא נחשבות "נוגן"
  const lv = all.map(n => n.level).sort((p, q) => p - q), typ = lv.length ? lv[Math.floor(lv.length * 0.7)] : 0;
  const ref = all.filter(n => n.level >= 0.5 * typ);
  const refNear = (t, a = 0.12, b = 0.2) => { const s = ref.filter(n => n.t >= t - a && n.t <= t + b); return s.length ? s : all.filter(n => n.t >= t - a && n.t <= t + b); };
  const R = replay(x, sr, expAt, Object.assign({ tune: (info.cfg && info.cfg.tune) || 0, ref: (info.cfg && info.cfg.ref) || 0 }, OPT), verbose);

  // כל "טעות": מוצאים את ההקשה שגרמה לה, ומה נוגן באמת באותו רגע
  const stat = { falseWrong: 0, realWrong: 0, phantom: 0, unclear: 0, rel: {} }, rows = [];
  for (const w of log.filter(o => o.k === 'wrong')) {
    const evs = live.filter(e => e.on && !e.g && e.m === w.m && e.t <= w.t + 0.05 && e.t >= w.t - 1.5);
    const e = evs[evs.length - 1], ta = e ? e.t : w.t;
    const rn = refNear(ta), played = new Set(rn.flatMap(n => n.notes)), want = w.want || [];
    let verdict;
    if (played.has(w.m) && !want.some(m => played.has(m))) { verdict = 'טעות אמיתית (באמת ניגנה את זה)'; stat.realWrong++; }
    else if (want.some(m => played.has(m))) {
      verdict = 'טעות שווא! ניגנה נכון'; stat.falseWrong++;
      const d = w.m - want.find(m => played.has(m)); stat.rel[rel(d)] = (stat.rel[rel(d)] || 0) + 1; verdict += ` · המנוע שמע ${rel(d)}`;
    } else if (!rn.length) { verdict = 'רפאים: לא נוגן כלום ברגע הזה (רעש/דיבור/צליל מתמשך)'; stat.phantom++; }
    else { verdict = `לא ברור: נוגן ${[...played].map(nm).join('+')}`; stat.unclear++; }
    const again = R.ev.some(r => r.on && !r.g && r.m === w.m && Math.abs(r.t - ta) < 0.12);
    rows.push({ t: ta, w, rn, verdict, again, lat: e && e.d });
  }
  for (const r of rows) {
    console.log(`  ✗ ${f2(r.t)}s שמע ${nm(r.w.m)} · צריך ${(r.w.want || []).map(nm).join('+') || '?'} · באמת נוגן: ${r.rn.map(n => n.notes.map(nm).join('+') + '@' + f2(n.t)).join(' ') || '—'} → ${r.verdict}${r.again ? '' : ' · (בהרצה חוזרת: כבר לא קורה)'}`);
    if (verbose) for (const d of R.dbg.filter(d => d.n === r.w.m && Math.abs(d.t / 1000 - r.t) < 0.25)) console.log('      ', JSON.stringify(d, (k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));
  }
  // סימוני 🚩: מה קרה לפניהם
  for (const fl of log.filter(o => o.k === 'flag')) {
    const prev = log.filter(o => ['hit', 'wrong', 'miss', 'skip', 'wait'].includes(o.k) && o.t <= fl.t && o.t >= fl.t - 4).map(o => `${o.k}:${nm(o.m)}@${f2(o.t)}`).join(' ');
    console.log(`  🚩 ${f2(fl.t)}s · לפני כן: ${prev || '—'}`);
  }
  // במצב לימוד: תווים שנוגנו אבל המשחק המשיך לחכות להם (לא שמע)
  const waits = log.filter(o => o.k === 'wait');
  let deaf = 0;
  for (const wt of waits) {
    const hit = log.find(o => o.k === 'hit' && o.m === wt.m && o.t >= wt.t);
    const until = hit ? hit.t : dur;
    const heard = ref.filter(n => n.t > wt.t + 0.05 && n.t < until - 0.3 && n.notes.includes(wt.m));
    if (heard.length) { deaf++; console.log(`  ⏳ ${f2(wt.t)}s חיכה ל-${nm(wt.m)} ${hit ? `עד ${f2(hit.t)}s` : 'עד הסוף'} — אבל נוגן כבר ב-${heard.map(n => f2(n.t)).join(', ')}`); }
  }
  const rw = R.ev.filter(e => e.on && !e.g);
  console.log(`  סיכום: ${stat.falseWrong} טעויות שווא · ${stat.realWrong} טעויות אמיתיות · ${stat.phantom} רפאים · ${stat.unclear} לא ברורות · ${deaf} תווים שלא נשמעו`);
  if (Object.keys(stat.rel).length) console.log('  מה המנוע שמע במקום:', JSON.stringify(stat.rel));
  console.log(`  הרצה חוזרת: ${rw.length} הקשות זוהו (בזמן אמת: ${live.filter(e => e.on && !e.g).length}) · תמלול ייחוס: ${ref.length} הקשות (+${all.length - ref.length} חלשות)`);
  return stat;
}

const files = fs.statSync(target).isDirectory() ? fs.readdirSync(target).filter(f => /\.wav$/i.test(f)).sort().map(f => path.join(target, f)) : [target];
let n = 0; for (const f of files) if (one(f)) n++;
if (!n) console.log('לא נמצאו הקלטות נגינה של שיר (song-…wav)');

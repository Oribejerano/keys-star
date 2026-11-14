// בדיקת מנוע ההאזנה על ההקלטות האמיתיות שבתיקיית samples (מהאורגנית, מהמכשיר ומהחדר האמיתיים).
// אמת המידה: תמלול ייחוס איטי (tools/transcribe.js) של ההקשות החזקות והברורות, ולקטעי הדיבור — "לא נוגן כלום".
// מודד: כמה הקשות אמיתיות זוהו (כשהמשחק מצפה להן, ובלי רמז), כמה זמן לקח, זיהויים כפולים/שגויים,
// כמה פעמים תו אחר "מתקבל" כאילו היה הנכון, וכמה פעמים דיבור ורעש מתקבלים כנגינה.
// הרצה: node tools/test-real.js [תיקייה] [-v] [--slow=4] [--opt=key:val,key:val]
const fs = require('fs'), path = require('path');
const { readWav } = require('./analyze-wav.js'), { transcribe, nm } = require('./transcribe.js');
const L = require('./test-detector.js');
const args = process.argv.slice(2), dir = args.find(a => !a.startsWith('-')) || path.join(__dirname, '..', 'samples'), verbose = args.includes('-v');
const opt = {}; for (const kv of ((args.find(a => a.startsWith('--opt=')) || '').slice(6) || '').split(',').filter(Boolean)) { const [k, v] = kv.split(':'); opt[k] = +v; }
const slow = (args.find(a => a.startsWith('--slow=')) || '').slice(7); if (slow) opt.slow = +slow;
// אילו תווים יכולים להופיע בכל סוג הקלטה (כל השאר בתמלול הייחוס נחשב ספק ולא נכנס לאמת המידה)
const ALLOWED = { repeat: [48, 60, 62, 64, 65, 67, 72], free: null, notes: null };
const MINLEVEL = { repeat: 0.12, free: 0.1, notes: 0.15 };
// קטעים שבהם ידוע שלא ניגנו (נבדק ידנית בעוצמות): רק דיבור ורעש
const SILENT = { 'repeat-20261114-202607': [[19.0, 24.6]] };
const REF = 0.42; // עוצמת הנגינה האופיינית בהקלטות האלה
const SETS = [[60], [62], [64], [65], [67], [69], [71], [72], [55], [76], [48, 52, 55], [60, 64, 67], [60, 62, 64, 65, 67], [64, 65], [47, 50, 55, 74]];

function truthOf(x, sr, info) {
  const kind = info.kind, t = transcribe(x, sr, { minLevel: MINLEVEL[kind] || 0.12 });
  let notes = t.notes.filter(n => n.t >= (info.plan[0] ? info.plan[0].t - 0.3 : 0));
  if (ALLOWED[kind]) notes = notes.filter(n => ALLOWED[kind].includes(n.notes[0]));
  else { // נגינה חופשית / קלידים בודדים: רק תווים שחוזרים בהקלטה או שנמצאים בטווח המנגינה
    const cnt = {}; for (const n of notes) cnt[n.notes[0]] = (cnt[n.notes[0]] || 0) + 1;
    notes = notes.filter(n => n.notes[0] >= 55 && n.notes[0] <= 91 && (kind === 'notes' ? n.level >= 0.2 : cnt[n.notes[0]] >= 3));
  }
  const out = []; // אותו תו פעמיים בתוך 130 אלפיות שנייה = הקשה אחת
  for (const n of notes) { const p = out[out.length - 1]; if (p && p.notes[0] === n.notes[0] && n.t - p.t < 0.13) continue; out.push(n); }
  if (SILENT[info.id]) return out.filter(n => !SILENT[info.id].some(([a, b]) => n.t >= a && n.t <= b));
  return out;
}
// כמו במשחק במצב נגינה: מצפים לתו מעט לפני הזמן שלו ועד שחלון הפגיעה שלו נסגר (0.3 שנייה אחריו), וגם לתו הנוכחי עד הבא
function expectedLikeGame(groups) {
  return t => { const s = new Set(); let cur = null; for (const g of groups) { if (g.t - 0.15 > t) break; cur = g; if (t <= g.t + 0.3) for (const m of g.notes) s.add(m); } if (cur) for (const m of cur.notes) s.add(m); return s; };
}
function evalGuided(groups, buf, sr, opt) {
  const ev = L.run(buf, sr, expectedLikeGame(groups), 10, opt); let hit = 0, tot = 0, wrong = 0, dbl = 0, lat = 0; const used = new Set(), missed = [];
  for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi];
    for (const m of g.notes) { tot++; const i = ev.findIndex((e, k) => !used.has(k) && e.midi === m && e.t0 >= g.t - 0.1 && e.t0 <= g.t + 0.15);
      if (i >= 0) { used.add(i); hit++; lat += ev[i].t - g.on[m]; } else missed.push(`${g.t.toFixed(2)}:${m}` + (gi ? `(${(g.t - groups[gi - 1].t).toFixed(2)} אחרי ${groups[gi - 1].notes[0]})` : '')); } }
  const sounding = (t, m) => groups.some(g => g.notes.includes(m) && t >= g.t - 0.05 && t <= g.t + g.dur + 0.6);
  for (let k = 0; k < ev.length; k++) if (!used.has(k) && !ev[k].ghost) { if (sounding(ev[k].t, ev[k].midi)) dbl++; else wrong++; }
  return { recall: hit / Math.max(1, tot), wrong, dbl, tot, lat: lat / Math.max(1, hit), missed };
}
const cut = (x, sr, a, b) => x.subarray(Math.floor(a * sr), Math.floor(b * sr));
// דיבור/רעש בלבד: כמה תווים "התקבלו" כשהמשחק מצפה להם, וכמה דווחו בלי שום רמז
function speechTest(x, sr, opt) {
  let acc = 0, other = 0; const by = [];
  for (const set of SETS) { const S = new Set(set), ev = L.run(x, sr, () => S, 10, opt).filter(e => !e.ghost); const a = ev.filter(e => S.has(e.midi)).length; acc += a; other += ev.length - a; by.push(a); }
  return { acc, other, free: L.run(x, sr, null, 10, opt).filter(e => !e.ghost).length, sec: x.length / sr, by };
}

const files = fs.readdirSync(dir).filter(f => /\.wav$/i.test(f)).sort();
const pct = v => (v * 100).toFixed(0).padStart(3) + '%', T = { hit: 0, tot: 0, wrong: 0, dbl: 0, lat: 0, fhit: 0, ffp: 0, imp: 0, impN: 0, sAcc: 0, sOther: 0, sFree: 0, sSec: 0, pAcc: 0, pOther: 0, pFree: 0 };
console.log('הקלטה'.padEnd(26), 'הקשות | מודרך  שגוי כפול השהיה | חופשי שווא | מתחזים −12  +12   +7');
for (const f of files) {
  const { sr, x, info } = readWav(path.join(dir, f)); if (!info || !info.plan) continue;
  const quiet = info.kind === 'noise' ? [[info.plan[0].t, x.length / sr]] : SILENT[info.id] || [];
  for (const [a, b] of quiet) {
    const s = speechTest(cut(x, sr, a, b), sr, opt); T.sAcc += s.acc; T.sOther += s.other; T.sFree += s.free; T.sSec += s.sec;
    // אותו דבר אחרי שהמנוע כבר למד את עוצמת הנגינה הרגילה (כמו באמצע תרגול)
    const p = speechTest(cut(x, sr, a, b), sr, Object.assign({ ref: REF }, opt)); T.pAcc += p.acc; T.pOther += p.other; T.pFree += p.free;
    console.log(`${info.id.padEnd(26)} דיבור/רעש ${s.sec.toFixed(0)} שניות: התקבלו כתו צפוי ${s.acc} (ב-${SETS.length} מערכי ציפייה) · דווחו כתו אחר ${s.other} · בלי רמז ${s.free}${verbose ? '  [' + s.by.join(' ') + ']' : ''}`);
  }
  if (info.kind === 'noise' || args.includes('--speech')) continue;
  const g = truthOf(x, sr, info); if (!g.length) continue;
  const G = evalGuided(g, x, sr, opt), F = L.evalFree(g, L.run(x, sr, null, 10, opt)), I = L.evalImpostor(g, x, sr, [-12, 12, 7], opt);
  console.log(info.id.padEnd(26), String(G.tot).padStart(5), '|', pct(G.recall), String(G.wrong).padStart(5), String(G.dbl).padStart(4), String(Math.round(G.lat * 1000)).padStart(5) + 'ms |', pct(F.recall), String(F.fp).padStart(4), '|', '      ', pct(I[-12]), pct(I[12]), pct(I[7]));
  if (verbose) console.log('   אמת: ' + g.map(n => `${n.t.toFixed(2)}:${nm(n.notes[0])}`).join(' ') + '\n   פוספסו: ' + G.missed.join(' '));
  T.hit += G.recall * G.tot; T.tot += G.tot; T.wrong += G.wrong; T.dbl += G.dbl; T.lat += G.lat * G.recall * G.tot; T.fhit += F.recall * F.tot; T.ffp += F.fp;
  for (const k of [-12, 12, 7]) { T.imp += I[k]; T.impN++; }
}
console.log(`\nסיכום (אמיתי): מודרך ${pct(T.hit / T.tot)} מתוך ${T.tot} הקשות · השהיה ${Math.round(T.lat / Math.max(1, T.hit) * 1000)}ms · שגויים ${T.wrong} · כפולים ${T.dbl} · חופשי ${pct(T.fhit / T.tot)} (שווא ${T.ffp}) · מתחזים ${pct(T.imp / Math.max(1, T.impN))}`);
console.log(`דיבור/רעש (${T.sSec.toFixed(0)} שניות × ${SETS.length} מערכים): התקבלו כתו צפוי ${T.sAcc} · דווחו כתו אחר ${T.sOther} · בלי רמז ${T.sFree}   ‖ אחרי לימוד עוצמת הנגינה: ${T.pAcc} · ${T.pOther} · ${T.pFree}`);

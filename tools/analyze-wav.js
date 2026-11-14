// מריץ את מנוע ההאזנה על הקלטות אמיתיות (קבצי WAV ממסך "הקלטות לכיוונון" באפליקציה) —
// כדי לכוונן את המנוע מול האורגנית, המכשיר והחדר האמיתיים.
// הקלטה מהאפליקציה מכילה גם את ההנחיות ("נגנו עכשיו דו"), את מה שהמנוע זיהה במכשיר בזמן אמת ואת נתוני המכשיר;
// הכלי משווה: מה היה צריך להישמע · מה זוהה במכשיר · מה מזהה המנוע הנוכחי על אותה הקלטה.
// הרצה: node tools/analyze-wav.js <קובץ.wav או תיקייה> [...] [--exp=60,62,64] [-v]
const fs = require('fs'), path = require('path');
const { run } = require('./test-detector.js');
const NAMES = ['דו', 'דו♯', 'רה', 'רה♯', 'מי', 'פה', 'פה♯', 'סול', 'סול♯', 'לה', 'לה♯', 'סי'];
const nm = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const KIND = { notes: 'קלידים בודדים', repeat: 'חזרות ונגינה מהירה', chords: 'אקורדים', noise: 'רעשי רקע בלי נגינה', free: 'נגינה חופשית' };

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('לא קובץ WAV');
  let p = 12, fmt = null, data = null, info = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, Math.min(b.length, p + 8 + len));
    if (id === 'ksta') { try { info = JSON.parse(b.toString('utf8', p + 8, p + 8 + len)); } catch (e) { /* נתונים פגומים — מנתחים בלי */ } }
    p += 8 + len + (len & 1);
  }
  if (!fmt || !data) throw new Error('קובץ WAV לא תקין');
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch)), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bps;
      v += fmt.tag === 3 ? data.readFloatLE(o) : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? data.readIntLE(o, 3) / 8388608 : fmt.bits === 32 ? data.readInt32LE(o) / 2147483648 : (data[o] - 128) / 128;
    }
    out[i] = v / fmt.ch;
  }
  return { sr: fmt.sr, x: out, info };
}

// משייך זיהויים לשלבי ההנחיה: לכל הקשה שהייתה אמורה להישמע מחפשים זיהוי של אותו תו בחלון השלב (עם שוליים לנגן שמאחר)
function match(plan, ev) {
  const used = new Set(), steps = [];
  plan.forEach((p, i) => {
    const lo = p.t - 0.2, hi = p.t + p.dur + (i + 1 < plan.length ? 0.9 : 1.5), got = [];
    for (const m of p.seq) {
      const k = ev.findIndex((e, j) => !used.has(j) && !e.ghost && e.midi === m && e.t0 >= lo && e.t0 < hi);
      if (k >= 0) { used.add(k); got.push(ev[k]); }
    }
    steps.push({ p, got, ok: got.length === p.seq.length });
  });
  const extra = ev.filter((e, j) => !used.has(j) && !e.ghost);
  return { steps, extra, ok: steps.filter(s => s.p.seq.length && s.ok).length, total: steps.filter(s => s.p.seq.length).length,
    hits: steps.reduce((s, x) => s + x.got.length, 0), want: plan.reduce((s, p) => s + p.seq.length, 0) };
}

function analyze(file, opt) {
  const { sr, x, info } = readWav(file);
  let peak = 0, sum = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i] * x[i]; }
  console.log(`\n══ ${path.basename(file)} · ${(x.length / sr).toFixed(1)} שניות · ${sr}Hz · שיא ${peak.toFixed(3)} · עוצמה ממוצעת ${Math.sqrt(sum / x.length).toFixed(4)}${peak > 0.98 ? ' · ⚠ עיוות (חזק מדי)' : peak < 0.02 ? ' · ⚠ חלש מאוד' : ''}`);
  const out = { file: path.basename(file), kind: info ? info.kind : '?' };
  if (!info || !info.plan) {
    const exp = opt.exp ? new Set(opt.exp) : null, ev = run(x, sr, exp ? () => exp : null);
    console.log(`בלי הנחיות בקובץ · זוהו ${ev.filter(e => !e.ghost).length} תווים · כיוון הכלי שנלמד: ${ev.det.tune.toFixed(1)} סנט`);
    for (const e of ev) console.log(`${e.t0.toFixed(2).padStart(7)}ש  ${String(e.midi).padStart(3)}  ${nm(e.midi).padEnd(7)} ${e.ghost ? '(הרמוניה)' : ''}  זוהה אחרי ${Math.round((e.t - e.t0) * 1000)}ms`);
    return out;
  }
  const e = info.env || {};
  console.log(`${KIND[info.kind] || info.kind} · ${info.date}${info.note ? ' · הערה: ' + info.note : ''}`);
  console.log(`מכשיר: ${(e.ua || '').replace(/^Mozilla\/5\.0 /, '').slice(0, 90)}\nמיקרופון: ${e.mic || '?'} · ביטול הד ${e.ec} · הנמכת רעש ${e.ns} · הגבר אוטומטי ${e.agc} · חלון ${e.N} · כיוון ${Number(e.tune || 0).toFixed(1)} סנט · פיצוי השהיה ${e.cfgLatency}ms`);
  const plan = info.plan;
  // 1) מה שזוהה במכשיר בזמן אמת
  const live = (info.events || []).filter(v => v.on).map(v => ({ t0: v.t, t: v.t + v.d / 1000, midi: v.m, ghost: !!v.g }));
  const L = match(plan, live);
  // 2) המנוע הנוכחי על אותה הקלטה, באותם תנאים (התווים הצפויים = הקלידים של השלב)
  const expAt = t => { for (const p of plan) if (t >= p.t && t < p.t + p.dur) return p.keys.length ? new Set(p.keys) : null; return null; };
  const evG = run(x, sr, expAt), G = match(plan, evG);
  // 3) בלי שום רמז (כמו בהקלטת שיר חדש)
  const evF = run(x, sr, null), F = match(plan, evF);
  const lat = a => { const d = a.map(v => (v.t - v.t0) * 1000).sort((p, q) => p - q); return d.length ? Math.round(d[d.length >> 1]) : 0; };
  if (opt.v || info.kind !== 'free') {
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i], show = s => s.got.length === p.seq.length ? '✓' : `✗ ${s.got.length}/${p.seq.length}`;
      if (!p.seq.length) { console.log(`  ${p.t.toFixed(1).padStart(5)}ש  ${String(p.label).padEnd(18)} (בלי נגינה)`); continue; }
      const times = G.steps[i].got.map(g => '+' + (g.t0 - p.t).toFixed(2)).join(' ');
      console.log(`  ${p.t.toFixed(1).padStart(5)}ש  ${String(p.label).padEnd(18)} במכשיר ${show(L.steps[i]).padEnd(7)} עכשיו ${show(G.steps[i]).padEnd(7)} בלי רמז ${show(F.steps[i]).padEnd(7)} ${opt.v ? times : ''}`);
    }
  }
  const ex = a => a.length ? a.map(v => `${nm(v.midi)}@${v.t0.toFixed(1)}`).join(' ') : '—';
  if (L.total) console.log(`שלבים שזוהו במלואם: במכשיר ${L.ok}/${L.total} · מנוע נוכחי ${G.ok}/${G.total} · בלי רמז ${F.ok}/${F.total}   (הקשות: ${L.hits}/${L.want} · ${G.hits}/${G.want} · ${F.hits}/${F.want})`);
  console.log(`זיהויים מיותרים: במכשיר ${L.extra.length} · מנוע נוכחי ${G.extra.length} · בלי רמז ${F.extra.length}`);
  if (G.extra.length) console.log(`  מיותרים (מנוע נוכחי): ${ex(G.extra.slice(0, 20))}`);
  if (F.extra.length && (opt.v || info.kind === 'noise')) console.log(`  מיותרים (בלי רמז): ${ex(F.extra.slice(0, 20))}`);
  console.log(`זמן זיהוי חציוני: במכשיר ${lat(live.filter(v => !v.ghost))}ms · מנוע נוכחי ${lat(evG.filter(v => !v.ghost))}ms · כיוון הכלי שנלמד: ${evG.det.tune.toFixed(1)} סנט`);
  if (info.kind === 'free' && !opt.v) console.log(`נגינה חופשית: זוהו ${evF.filter(v => !v.ghost).length} תווים (‎-v לרשימה המלאה)`);
  if (info.kind === 'free' && opt.v) for (const v of evF) if (!v.ghost) console.log(`${v.t0.toFixed(2).padStart(7)}ש  ${nm(v.midi)}`);
  return Object.assign(out, { live: L, now: G, free: F });
}

module.exports = { readWav, analyze, match };
if (require.main !== module) return;
const args = process.argv.slice(2), opt = { v: args.includes('-v') };
const ex = args.find(a => a.startsWith('--exp=')); if (ex) opt.exp = ex.slice(6).split(',').map(Number);
const old = args.find(a => /^\d+(,\d+)*$/.test(a)); if (old) opt.exp = old.split(',').map(Number); // תאימות לצורה הישנה
let files = [];
for (const a of args.filter(a => !a.startsWith('-') && a !== old)) {
  if (fs.existsSync(a) && fs.statSync(a).isDirectory()) files.push(...fs.readdirSync(a).filter(f => /\.wav$/i.test(f)).sort().map(f => path.join(a, f)));
  else files.push(a);
}
if (!files.length) { console.log('שימוש: node tools/analyze-wav.js <קובץ.wav או תיקייה> [...] [--exp=60,62,64] [-v]'); process.exit(1); }
const res = [];
for (const f of files) { try { res.push(analyze(f, opt)); } catch (e) { console.log(`\n══ ${f}: ${e.message}`); } }
const g = res.filter(r => r.now && r.now.total);
if (g.length > 1) {
  const s = k => g.reduce((a, r) => a + r[k].ok, 0), t = g.reduce((a, r) => a + r.now.total, 0);
  console.log(`\n══ סיכום ${g.length} הקלטות מודרכות: במכשיר ${s('live')}/${t} · מנוע נוכחי ${s('now')}/${t} · בלי רמז ${s('free')}/${t}`);
}

// מעבדת בדיקות למנוע הזיהוי: מייצרת נגינת פסנתר מדומה (כולל רמקול קטן, הד, רעש חדר, דיבור ונקישות)
// ומודדת כמה תווים זוהו נכון, כמה זיהויי שווא היו, וכמה "תווים מתחזים" התקבלו בטעות.
// הרצה: node tools/test-detector.js
const Detector = require('../js/detector.js');

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const f0 = m => 440 * Math.pow(2, (m - 69) / 12);

// צליל דמוי פסנתר: הרמוניות עם דעיכה, מעט אי-הרמוניות, התקפה חדה
function tone(buf, sr, t0, midi, dur, vel, R, prof, rel = 0.1) {
  const f = f0(midi), B = 0.00012 + 0.0002 * R(), i0 = Math.floor(t0 * sr), len = Math.floor((dur + 0.5) * sr);
  for (let h = 1; h <= 12; h++) {
    const fh = h * f * Math.sqrt(1 + B * h * h); if (fh > 7000) break;
    const amp = vel * prof[h] , tau = (1.8 / (1 + 0.3 * h)) * (0.7 + 0.6 * R()), ph = R() * 6.283, wq = 2 * Math.PI * fh / sr;
    for (let i = 0; i < len && i0 + i < buf.length; i++) {
      const tt = i / sr;
      let env = Math.min(1, tt / 0.006) * Math.exp(-tt / tau);
      if (tt > dur) env *= Math.exp(-(tt - dur) / rel);
      buf[i0 + i] += amp * env * Math.sin(wq * i + ph);
    }
  }
}
function profile(R, kind) { // עוצמות ההרמוניות של "הכלי"
  const p = [0]; const pw = kind === 'bright' ? 0.7 : kind === 'dull' ? 1.7 : 1.1;
  for (let h = 1; h <= 12; h++) p[h] = Math.pow(h, -pw) * (0.6 + 0.8 * R());
  if (kind === 'h2') p[2] = p[1] * 2.2;
  return p;
}
function highpass(buf, sr, fc, passes) { // רמקול קטן / מיקרופון טלפון: מחליש בסים
  for (let p = 0; p < passes; p++) {
    const w = 2 * Math.PI * fc / sr, al = Math.sin(w) / (2 * 0.707), c = Math.cos(w);
    const b0 = (1 + c) / 2, b1 = -(1 + c), b2 = (1 + c) / 2, a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < buf.length; i++) { const x = buf[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; buf[i] = y; }
  }
}
function reverb(buf, sr) { const taps = [[0.023, 0.35], [0.041, 0.25], [0.067, 0.18], [0.113, 0.1]]; const out = Float32Array.from(buf); for (const [d, g] of taps) { const k = Math.floor(d * sr); for (let i = k; i < buf.length; i++) out[i] += g * buf[i - k]; } return out; }
function rmsOf(b) { let s = 0; for (let i = 0; i < b.length; i++) s += b[i] * b[i]; return Math.sqrt(s / b.length); }
function addNoise(buf, sr, level, R) { let lp = 0; for (let i = 0; i < buf.length; i++) { const wn = R() * 2 - 1; lp = lp * 0.97 + wn * 0.03; buf[i] += level * (0.5 * wn + 6 * lp); } }
function addHum(buf, sr, level) { for (let i = 0; i < buf.length; i++) buf[i] += level * (Math.sin(2 * Math.PI * 50 * i / sr) + 0.5 * Math.sin(2 * Math.PI * 100 * i / sr) + 0.3 * Math.sin(2 * Math.PI * 150 * i / sr)); }
// דיבור מדומה: מקור הרמוני עם גובה שמחליק כל הזמן, פורמנטים והברות
function addSpeech(buf, sr, level, R) {
  let ph = 0, t = 0; const base = 110 + 120 * R(), f1 = 500 + 400 * R(), f2 = 1400 + 900 * R();
  for (let i = 0; i < buf.length; i++) {
    t = i / sr;
    const pitch = base * (1 + 0.18 * Math.sin(2 * Math.PI * 0.9 * t + 1) + 0.1 * Math.sin(2 * Math.PI * 2.3 * t));
    ph += 2 * Math.PI * pitch / sr;
    const syl = Math.max(0, Math.sin(2 * Math.PI * 3.1 * t)) ** 0.6 * (Math.sin(2 * Math.PI * 0.35 * t) > -0.5 ? 1 : 0);
    let v = 0;
    for (let h = 1; h <= 24; h++) { const fh = h * pitch; if (fh > 4000) break; const g = Math.exp(-(((fh - f1) / 220) ** 2)) + 0.6 * Math.exp(-(((fh - f2) / 350) ** 2)) + 0.25 / h; v += g * Math.sin(h * ph); }
    buf[i] += level * syl * v * 0.35;
  }
}
function addTaps(buf, sr, level, R) { for (let k = 0; k < buf.length / sr * 3; k++) { const i0 = Math.floor(R() * buf.length); for (let i = 0; i < 0.02 * sr && i0 + i < buf.length; i++) buf[i0 + i] += level * (R() * 2 - 1) * Math.exp(-i / (0.004 * sr)); } }

// ---- תסריטי נגינה: רשימת קבוצות [{t, notes:[midi], dur}] ----
function melody(R, n, lo, hi, gapLo, gapHi, legato) {
  const g = []; let t = 0.6, prev = Math.floor(lo + R() * (hi - lo));
  for (let i = 0; i < n; i++) {
    let m; const r = R();
    if (r < 0.15) m = prev; else if (r < 0.25) m = prev + (R() < 0.5 ? 12 : -12); else m = prev + Math.round((R() * 2 - 1) * 5);
    m = Math.max(lo, Math.min(hi, m)); const gap = gapLo + R() * (gapHi - gapLo);
    g.push({ t, notes: [m], dur: legato ? gap * 1.15 : gap * 0.8 }); t += gap; prev = m;
  }
  return g;
}
function chordsAndMelody(R, n) {
  const g = []; let t = 0.6;
  for (let i = 0; i < n; i++) {
    const root = 43 + Math.floor(R() * 12), minor = R() < 0.4, tri = [root, root + (minor ? 3 : 4), root + 7];
    const mel = 60 + Math.floor(R() * 20), kind = R();
    if (kind < 0.34) g.push({ t, notes: tri, dur: 0.7 });
    else if (kind < 0.67) g.push({ t, notes: [root, mel], dur: 0.6 });
    else g.push({ t, notes: [...tri, mel], dur: 0.7 });
    t += 0.75 + R() * 0.3;
    if (R() < 0.5) { g.push({ t, notes: [60 + Math.floor(R() * 20)], dur: 0.3 }); t += 0.4; }
  }
  return g;
}

function render(groups, o) {
  const R = rng(o.seed), sr = o.sr, total = (groups.length ? groups[groups.length - 1].t : 6) + 2;
  let buf = new Float32Array(Math.floor(total * sr)); const prof = profile(R, o.kind || 'mid');
  groups.forEach((g, gi) => { for (const m of g.notes) {
    // הקשה חוזרת על אותו קליד: כמו באורגנית אמיתית, הצליל הקודם נקטע והחדש מתחיל
    let dur = g.dur, rel = 0.1; const nx = groups.slice(gi + 1).find(x => x.notes.includes(m));
    if (nx && nx.t - g.t - 0.012 < dur) { dur = nx.t - g.t - 0.012; rel = 0.015; }
    tone(buf, sr, g.t + (R() - 0.5) * 0.012, m, dur, 0.5 + 0.5 * R(), R, prof, rel);
  } });
  if (o.hp) highpass(buf, sr, o.hp, 2);
  if (o.reverb) buf = reverb(buf, sr);
  const sig = groups.length ? rmsOf(buf) * 2.2 : 0.05; // עוצמה אופיינית בזמן נגינה
  if (o.snr != null) addNoise(buf, sr, sig * Math.pow(10, -o.snr / 20) * 0.6, R);
  if (o.hum) addHum(buf, sr, sig * 0.15);
  if (o.speech != null) addSpeech(buf, sr, sig * Math.pow(10, -o.speech / 20), R);
  if (o.taps) addTaps(buf, sr, sig * 1.5, R);
  const gain = o.gain || 0.2; const peak = buf.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
  for (let i = 0; i < buf.length; i++) buf[i] *= gain / peak;
  return buf;
}

// מריץ את המנוע ומחזיר אירועים. expectedFn(tSec) → Set או null
function run(buf, sr, expectedFn) {
  const det = new Detector(sr), N = det.N, hop = Math.round(sr * 0.02), frame = new Float32Array(N), ev = [];
  for (let p = hop; p <= buf.length; p += hop) {
    frame.fill(0); const st = p - N;
    for (let i = Math.max(0, st); i < p; i++) frame[i - st] = buf[i];
    const tSec = p / sr;
    for (const e of det.process(frame, tSec * 1000, expectedFn ? expectedFn(tSec) : null)) if (e.type === 'on') ev.push({ t: tSec, midi: e.midi, ghost: e.ghost });
  }
  return ev;
}
function expectedAt(groups, shift) {
  return t => { let cur = null; for (const g of groups) { if (g.t - 0.15 <= t) cur = g; else break; } return cur ? new Set(cur.notes.map(n => n + shift)) : new Set(); };
}
function evalFree(groups, ev) {
  let hit = 0, tot = 0, lat = 0; const used = new Set();
  for (const g of groups) for (const m of g.notes) { tot++; const i = ev.findIndex((e, k) => !used.has(k) && e.midi === m && e.t >= g.t - 0.03 && e.t <= g.t + 0.3); if (i >= 0) { used.add(i); hit++; lat += ev[i].t - g.t; } }
  return { recall: hit / Math.max(1, tot), fp: ev.filter((e, k) => !used.has(k) && !e.ghost).length, tot, lat: lat / Math.max(1, hit) };
}
function evalGuided(groups, buf, sr) { // כמו מצב לימוד: המשחק מצפה לתווים הנכונים
  const ev = run(buf, sr, expectedAt(groups, 0)); let hit = 0, tot = 0, wrong = 0; const used = new Set();
  for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi], end = gi + 1 < groups.length ? groups[gi + 1].t - 0.15 : g.t + 1;
    for (const m of g.notes) { tot++; const i = ev.findIndex((e, k) => !used.has(k) && e.midi === m && e.t >= g.t - 0.15 && e.t <= Math.max(end, g.t + 0.35)); if (i >= 0) { used.add(i); hit++; } } }
  const sounding = (t, m) => groups.some(g => g.notes.includes(m) && t >= g.t - 0.05 && t <= g.t + g.dur + 0.6);
  for (let k = 0; k < ev.length; k++) if (!used.has(k) && !ev[k].ghost && !sounding(ev[k].t, ev[k].midi)) wrong++;
  return { recall: hit / Math.max(1, tot), wrong, tot };
}
function evalImpostor(groups, buf, sr) { // המשחק מצפה לתו אחר ממה שנוגן — כמה פעמים הוא "מתקבל" בטעות?
  const res = {};
  for (const sh of (process.argv.includes('-q') ? [-12, -1, 5, 7, 12] : [-12, -7, -5, -2, -1, 1, 2, 5, 7, 12])) {
    const ev = run(buf, sr, expectedAt(groups, sh)); let acc = 0, tot = 0;
    for (let gi = 0; gi < groups.length; gi++) { const g = groups[gi], end = gi + 1 < groups.length ? groups[gi + 1].t - 0.15 : g.t + 1;
      for (const m of g.notes) { if (g.notes.includes(m + sh)) continue; tot++; if (ev.some(e => e.midi === m + sh && e.t >= g.t - 0.15 && e.t <= end)) acc++; } }
    res[sh] = acc / Math.max(1, tot);
  }
  return res;
}

const pct = v => (v * 100).toFixed(1).padStart(5) + '%';
const scen = [
  ['מנגינה נקייה', R => melody(R, 40, 60, 84, 0.3, 0.6), { snr: 35 }],
  ['מנגינה + רעש חדר', R => melody(R, 40, 60, 84, 0.3, 0.6), { snr: 15, hum: 1, reverb: 1 }],
  ['מנגינה + דיבור חזק', R => melody(R, 40, 60, 84, 0.3, 0.6), { snr: 20, speech: 3, reverb: 1 }],
  ['מנגינה + דיבור + נקישות', R => melody(R, 40, 60, 84, 0.3, 0.6), { snr: 18, speech: 6, taps: 1, reverb: 1 }],
  ['מנגינה מהירה לגאטו', R => melody(R, 50, 60, 84, 0.2, 0.3, true), { snr: 25, reverb: 1 }],
  ['יד שמאל נמוכה, רמקול קטן', R => melody(R, 40, 43, 59, 0.4, 0.7), { snr: 22, hp: 200, reverb: 1 }],
  ['אקורדים + מנגינה', R => chordsAndMelody(R, 25), { snr: 25, reverb: 1 }],
  ['אקורדים + מנגינה, רמקול קטן + דיבור', R => chordsAndMelody(R, 25), { snr: 20, hp: 180, speech: 8, reverb: 1 }],
  ['צליל עם הרמוניה שנייה חזקה', R => melody(R, 40, 55, 84, 0.3, 0.6), { snr: 25, kind: 'h2', reverb: 1 }],
  ['צליל בהיר', R => melody(R, 40, 55, 84, 0.3, 0.6), { snr: 25, kind: 'bright', reverb: 1 }],
  ['נגינה חלשה מאוד (מרחוק)', R => melody(R, 40, 60, 84, 0.3, 0.6), { snr: 12, gain: 0.01, reverb: 1 }],
];
const verbose = process.argv.includes('-v'), quick = process.argv.includes('-q');
module.exports = { melody, chordsAndMelody, render, run, rng, expectedAt };
if (require.main !== module) return;
let sumFree = 0, sumGuided = 0, sumFp = 0, sumWrong = 0, sumImp = 0, cnt = 0;
console.log('תסריט'.padEnd(38), 'חופשי  שווא | מודרך שגוי | מתחזים(ממוצע/מקס) | השהיה');
for (const sr of quick ? [48000] : [48000, 44100]) for (const [name, mk, o] of scen) {
  let fr = 0, fp = 0, gr = 0, gw = 0, im = 0, imMax = 0, lat = 0, K = quick ? 1 : 3, imDetail = {};
  for (let s = 0; s < K; s++) {
    const R = rng(1000 + s * 77 + name.length), groups = mk(R), buf = render(groups, Object.assign({ sr, seed: 5 + s }, o));
    const a = evalFree(groups, run(buf, sr, null)), b = evalGuided(groups, buf, sr), c = evalImpostor(groups, buf, sr);
    fr += a.recall / K; fp += a.fp; lat += a.lat / K; gr += b.recall / K; gw += b.wrong;
    const vals = Object.values(c); im += vals.reduce((x, y) => x + y, 0) / vals.length / K; imMax = Math.max(imMax, ...vals);
    for (const k in c) imDetail[k] = (imDetail[k] || 0) + c[k] / K;
  }
  console.log((name + ' ' + sr / 1000).padEnd(38), pct(fr), String(fp).padStart(4), '|', pct(gr), String(gw).padStart(4), '|', pct(im), pct(imMax), '|', Math.round(lat * 1000) + 'ms');
  if (verbose) console.log('   מתחזים לפי הזזה:', Object.entries(imDetail).map(([k, v]) => `${k}:${(v * 100).toFixed(0)}`).join(' '));
  sumFree += fr; sumGuided += gr; sumFp += fp; sumWrong += gw; sumImp += im; cnt++;
}
// רעש בלבד — אסור שיזוהה אף תו
console.log('\nרעש בלבד (10 שניות כל אחד) — מספר זיהויי שווא, חופשי / כשהמשחק מצפה לתו כלשהו:');
for (const [name, o] of [['שקט + רעש חדר', { snr: 0, hum: 1 }], ['דיבור', { speech: 0, snr: 10 }], ['דיבור + נקישות + זמזום', { speech: 0, snr: 6, taps: 1, hum: 1 }], ['נקישות', { taps: 1, snr: 10 }]]) {
  let a = 0, b = 0;
  for (let s = 0; s < 4; s++) { const buf = render([{ t: 9, notes: [], dur: 0 }], Object.assign({ sr: 48000, seed: 40 + s }, o)); a += run(buf, 48000, null).length; b += run(buf, 48000, () => new Set([60 + s * 3, 64 + s, 48 + s])).length; }
  console.log(' ', name.padEnd(28), a, '/', b);
}
console.log(`\nסיכום: זיהוי חופשי ${pct(sumFree / cnt)} · זיהוי מודרך ${pct(sumGuided / cnt)} · זיהויי שווא ${sumFp} · תווים שגויים במודרך ${sumWrong} · מתחזים ${pct(sumImp / cnt)}`);

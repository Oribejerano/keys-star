// מריץ את מנוע ההאזנה על הקלטה אמיתית (קובץ WAV מהאפליקציה: הגדרות ← "הקלטת דוגמה לכיוונון")
// ומדפיס אילו תווים זוהו ומתי — כדי לכוונן את המנוע מול האורגנית האמיתית.
// הרצה: node tools/analyze-wav.js piano-sample.wav [רשימת תווים צפויים, למשל 60,62,64]
const fs = require('fs');
const Detector = require('../js/detector.js');
const NAMES = ['דו', 'דו♯', 'רה', 'רה♯', 'מי', 'פה', 'פה♯', 'סול', 'סול♯', 'לה', 'לה♯', 'סי'];
const nm = m => NAMES[m % 12] + (Math.floor(m / 12) - 1);

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error('לא קובץ WAV');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), sr: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data') data = b.subarray(p + 8, Math.min(b.length, p + 8 + len));
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
  return { sr: fmt.sr, x: out };
}

const file = process.argv[2];
if (!file) { console.log('שימוש: node tools/analyze-wav.js <קובץ.wav> [תווים צפויים מופרדים בפסיק]'); process.exit(1); }
const { sr, x } = readWav(file);
const expected = process.argv[3] ? new Set(process.argv[3].split(',').map(Number)) : null;
const det = new Detector(sr), N = det.N, hop = Math.round(sr * 0.01), frame = new Float32Array(N);
let peak = 0, sum = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; sum += x[i] * x[i]; }
console.log(`קובץ: ${file} · ${(x.length / sr).toFixed(1)} שניות · ${sr}Hz · שיא ${peak.toFixed(3)} · עוצמה ממוצעת ${Math.sqrt(sum / x.length).toFixed(4)}${peak > 0.98 ? ' · ⚠ עיוות (חזק מדי)' : ''}`);
const ev = []; let attacks = 0, lastAtk = -1e9;
for (let p = hop; p <= x.length; p += hop) {
  const st = p - N; if (st >= 0) frame.set(x.subarray(st, p)); else { frame.fill(0); frame.set(x.subarray(0, p), -st); }
  for (const e of det.process(frame, p / sr * 1000, expected, hop)) if (e.type === 'on') ev.push({ t: e.t0 / 1000, midi: e.midi, ghost: e.ghost, lat: p / sr - e.t0 / 1000 });
  if (det.attackT !== lastAtk) { lastAtk = det.attackT; attacks++; }
}
console.log(`זוהו ${ev.length} תווים · ${attacks} נקישות · כיוון הכלי שנלמד: ${det.tune.toFixed(1)} סנט\n`);
for (const e of ev) console.log(`${e.t.toFixed(2).padStart(7)}ש  ${String(e.midi).padStart(3)}  ${nm(e.midi).padEnd(7)} ${e.ghost ? '(הרמוניה)' : ''}  זוהה אחרי ${Math.round(e.lat * 1000)}ms`);

// תמלול ייחוס להקלטות אמיתיות: ניתוח איטי ומדוקדק, עם "הצצה קדימה" (לא בזמן אמת),
// שקובע אילו קלידים באמת נוגנו ומתי. משמש כאמת מידה למנוע ההאזנה המהיר שבאפליקציה —
// כי מי שמנגן מול ההנחיות לא תמיד מנגן בדיוק מה שהתבקש (אוקטבה אחרת, הקשה נוספת, איחור).
// הרצה: node tools/transcribe.js <קובץ.wav> [-v]
const NM = ['דו', 'דו♯', 'רה', 'רה♯', 'מי', 'פה', 'פה♯', 'סול', 'סול♯', 'לה', 'לה♯', 'סי'];
const nm = m => NM[m % 12] + (Math.floor(m / 12) - 1);

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, h = len >> 1;
    for (let k = 0; k < h; k++) {
      const c = Math.cos(a * k), s = Math.sin(a * k);
      for (let i = k; i < n; i += len) { const j = i + h, vr = re[j] * c - im[j] * s, vi = re[j] * s + im[j] * c; re[j] = re[i] - vr; im[j] = im[i] - vi; re[i] += vr; im[i] += vi; }
    }
  }
}
const wins = {};
function spectrum(x, start, N) {
  const w = wins[N] || (wins[N] = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) { const j = start + i; re[i] = j >= 0 && j < x.length ? x[j] * w[i] : 0; }
  fft(re, im);
  const mag = new Float64Array(N / 2); for (let i = 0; i < N / 2; i++) mag[i] = Math.hypot(re[i], im[i]) / (N / 4);
  return mag;
}
function peaksOf(mag, sr, N, minRel) {
  let mx = 0; for (let i = 3; i < mag.length; i++) if (mag[i] > mx) mx = mag[i];
  const out = [];
  for (let i = 3; i < mag.length - 2; i++) {
    const v = mag[i];
    if (v < mx * minRel || v <= mag[i - 1] || v < mag[i + 1] || v <= mag[i - 2] || v <= mag[i + 2]) continue;
    const a = Math.log(mag[i - 1] + 1e-12), b = Math.log(v), c = Math.log(mag[i + 1] + 1e-12), d = 0.5 * (a - c) / (a - 2 * b + c);
    out.push({ f: (i + d) * sr / N, a: v });
  }
  return out;
}
const W = [1, 0.9, 0.8, 0.6, 0.5, 0.4, 0.3, 0.3];
// מחפש את התו שמסביר הכי טוב את הפסגות: יסוד + הרמוניות במקומות הנכונים
function bestNote(pk, tune) {
  let best = null; const all = {};
  for (let m = 33; m <= 100; m++) {
    const f0 = 440 * Math.pow(2, (m - 69 + tune / 100) / 12), a = [], dev = [];
    let cnt = 0, sc = 0;
    for (let h = 1; h <= 8 && h * f0 < 7000; h++) {
      const tol = (h >= 5 ? 45 : 32) / 1200; let bp = null;
      for (const p of pk) { const d = Math.abs(Math.log2(p.f / (h * f0))); if (d <= tol && (!bp || p.a > bp.a)) bp = p; }
      a[h] = bp ? bp.a : 0; if (bp) { cnt++; sc += bp.a * W[h - 1]; if (h <= 3) dev.push(1200 * Math.log2(bp.f / (h * f0))); }
    }
    if (!a[1]) continue;
    const mxh = Math.max(...a.slice(1));
    if (a[1] < 0.05 * mxh) continue;
    if (cnt < 2 && m < 80) continue;
    const odd = a[1] + (a[3] || 0) + (a[5] || 0), even = (a[2] || 0) + (a[4] || 0) + (a[6] || 0);
    if (odd < 0.12 * even) continue; // כמעט רק הרמוניות זוגיות: התו האמיתי אוקטבה מעל
    const c = { midi: m, sc, cents: dev.length ? dev.reduce((s, v) => s + v, 0) / dev.length : 0, a, f0 };
    all[m] = c;
    if (!best || sc > best.sc) best = c;
  }
  // אם יש יסוד ברור גם אוקטבה מתחת (עם הרמוניה שלישית משלו) — התו האמיתי הוא הנמוך
  while (best && all[best.midi - 12] && all[best.midi - 12].a[1] >= 0.15 * best.a[1] && all[best.midi - 12].a[3] > 0) best = all[best.midi - 12];
  return best;
}

function transcribe(x, sr, opt = {}) {
  // --- 1) נקישות: עלייה פתאומית בספקטרום ---
  const N1 = 1024, hop = Math.round(sr * 0.005), nf = Math.floor((x.length - N1) / hop);
  const b0 = Math.floor(100 * N1 / sr), b1 = Math.floor(6000 * N1 / sr), L = [], flux = new Float64Array(nf), rms = new Float64Array(nf);
  for (let k = 0; k < nf; k++) {
    const mag = spectrum(x, k * hop, N1), l = new Float32Array(b1 - b0); let e = 0;
    for (let b = b0; b < b1; b++) { l[b - b0] = Math.log(1 + 200 * mag[b]); e += mag[b] * mag[b]; }
    L.push(l); rms[k] = Math.sqrt(e);
    if (k >= 3) { let s = 0; const p = L[k - 3]; for (let b = 0; b < l.length; b++) { const d = l[b] - p[b]; if (d > 0) s += d; } flux[k] = s; }
  }
  const sorted = Float64Array.from(flux).sort(), p90 = sorted[Math.floor(nf * 0.9)], thrG = Math.max(2, 0.35 * p90);
  const cand = [];
  for (let k = 8; k < nf - 8; k++) {
    const v = flux[k]; if (v < thrG) continue;
    let ok = true; for (let j = k - 8; j <= k + 8; j++) if (flux[j] > v) { ok = false; break; }
    if (!ok) continue;
    const loc = Array.from(flux.subarray(Math.max(0, k - 60), Math.min(nf, k + 60))).sort((a, b) => a - b);
    if (v < 2.2 * loc[loc.length >> 1] + 1) continue;
    cand.push(k);
  }
  // מיקום מדויק של הנקישה: הנקודה שבה האנרגיה קופצת הכי חזק
  const blk = Math.round(sr * 0.0025), en = i => { let s = 0; for (let j = i; j < i + blk * 4; j++) s += (x[j] || 0) * (x[j] || 0); return s; };
  const onsets = cand.map(k => {
    const c = k * hop + N1 - hop * 3; let bi = c, br = 0;
    for (let i = c - Math.round(sr * 0.05); i <= c + Math.round(sr * 0.02); i += blk) { const r = (en(i) + 1e-9) / (en(i - blk * 4) + 1e-7); if (r > br) { br = r; bi = i; } }
    return bi;
  });
  // רק הקשות חזקות וברורות נכנסות לתמלול הייחוס (דיבור ורעשים חלשים בהרבה מהאורגנית); הקשות צמודות מאוחדות
  const lvl = o => { let s = 0; const n = Math.round(sr * 0.04); for (let j = o; j < o + n; j++) s += (x[j] || 0) * (x[j] || 0); return Math.sqrt(s / n); };
  const minLevel = opt.minLevel || 0.07, strong = [], rejected = [];
  for (const o of onsets) {
    const lv = lvl(o + Math.round(sr * 0.005));
    if (lv < minLevel) { rejected.push({ t: o / sr, why: `חלש (${lv.toFixed(3)})` }); continue; }
    if (strong.length && o - strong[strong.length - 1].o < sr * 0.07) continue;
    strong.push({ o, lv });
  }
  // --- 2) איזה תו נוסף בכל נקישה ---
  const notes = [], poly = opt.poly || 1;
  for (let i = 0; i < strong.length; i++) {
    const { o, lv } = strong[i], gap = (i + 1 < strong.length ? strong[i + 1].o : x.length) - o;
    const N = gap > sr * 0.2 ? 8192 : gap > sr * 0.11 ? 4096 : 2048, st = o + Math.round(sr * 0.012);
    const post = spectrum(x, st, N), pre = spectrum(x, o - Math.round(sr * 0.006) - N, N);
    const D = new Float64Array(post.length); for (let b = 0; b < D.length; b++) D[b] = Math.max(0, post[b] - 0.8 * pre[b]);
    let pk = peaksOf(D, sr, N, 0.04).filter(p => p.f > 55 && p.f < 7000);
    const got = [];
    for (let pass = 0; pass < poly && pk.length; pass++) {
      const b = bestNote(pk, opt.tune || 0); if (!b) break;
      if (pass && b.sc < 0.4 * got[0].sc) break;
      if (Math.abs(b.cents) > 18) { rejected.push({ t: o / sr, why: `לא מכוון (${nm(b.midi)} ${b.cents.toFixed(0)}¢)` }); break; }
      got.push(b);
      pk = pk.filter(p => { const r = p.f / b.f0, h = Math.round(r); return !(h >= 1 && Math.abs(Math.log2(r / h)) < 45 / 1200); });
    }
    if (!got.length) { if (!rejected.length || rejected[rejected.length - 1].t !== o / sr) rejected.push({ t: o / sr, why: 'לא זוהה תו' }); continue; }
    notes.push({ t: o / sr, notes: got.map(g => g.midi), dur: Math.min(1, gap / sr), on: Object.fromEntries(got.map(g => [g.midi, o / sr])), level: lv });
  }
  return { notes, rejected };
}

module.exports = { transcribe, nm, spectrum, peaksOf };
if (require.main !== module) return;
const { readWav } = require('./analyze-wav.js');
const { sr, x } = readWav(process.argv[2]), r = transcribe(x, sr);
console.log(`${r.notes.length} הקשות · ${r.rejected.length} נדחו`);
console.log(r.notes.map(n => `${n.t.toFixed(2)} ${n.notes.map(nm).join('+')}`).join(' | '));
if (process.argv.includes('-v')) console.log('נדחו: ' + r.rejected.map(n => `${n.t.toFixed(2)} ${n.why}`).join(' | '));

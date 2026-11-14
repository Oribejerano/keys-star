// מנוע זיהוי תווים מפסנתר דרך מיקרופון.
// עיקרון: מוצאים "פסגות" חדות בספקטרום שבולטות מעל רעש הרקע, ומקבלים תו רק אם יש לו
// סדרת הרמוניות מדויקת (צליל מכוון של קלידים) שעלתה עכשיו (התקפת קליד). רעש, דיבור וצלילים
// לא מכוונים לא עוברים את המסננים האלה. כשהמשחק יודע לאיזה תווים הוא מצפה, הם מזוהים בסף נמוך
// יותר, ותו לא צפוי מדווח כ"טעות" רק כשהראיות חזקות.
(function (root) {
  'use strict';
  const LO = 33, HI = 100, HL = 8, NH = 6;
  const REL = [12, 19, 24, 28, 31, 34, 36]; // מרווחים של הרמוניות מעל תו

  function Detector(sr) {
    this.sr = sr;
    const N = this.N = sr > 30000 ? 8192 : 4096;
    this.win = new Float32Array(N);
    for (let i = 0; i < N; i++) this.win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
    this.rev = new Uint16Array(N);
    const bits = Math.log2(N);
    for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); this.rev[i] = r; }
    this.cos = new Float32Array(N / 2); this.sin = new Float32Array(N / 2);
    for (let i = 0; i < N / 2; i++) { this.cos[i] = Math.cos(2 * Math.PI * i / N); this.sin[i] = Math.sin(2 * Math.PI * i / N); }
    this.re = new Float32Array(N); this.im = new Float32Array(N);
    this.binHz = sr / N;
    this.maxBin = Math.min(N / 2 - 2, Math.ceil(5600 / this.binHz));
    const M = this.maxBin + 2;
    this.mag = new Float32Array(M); this.sm = new Float32Array(M); this.nf = new Float32Array(M); this.pre = new Float64Array(M + 1);
    this.pf = new Float32Array(256); this.pa = new Float32Array(256); this.np = 0;
    this.F = new Float32Array(128); for (let n = 0; n < 128; n++) this.F[n] = 440 * Math.pow(2, (n - 69) / 12);
    this.a1 = new Float32Array(128); this.oddE = new Float32Array(128); this.fullE = new Float32Array(128);
    this.strict = new Uint8Array(128); this.pres = new Uint8Array(128);
    this.histO = new Float32Array(128 * HL); this.histF = new Float32Array(128 * HL); this.hp = 0;
    this.envO = new Float32Array(128); this.envF = new Float32Array(128);
    this.seen = new Uint8Array(128); this.gone = new Uint8Array(128); this.on = new Uint8Array(128);
    this.since = new Float64Array(128); this.lastOn = new Float64Array(128).fill(-1e9);
    this.a2 = new Float32Array(128); this.a3 = new Float32Array(128); this.cnt = new Uint8Array(128); this.env2 = new Float32Array(128); this.env3 = new Float32Array(128);
    this.rise0 = new Float64Array(128).fill(-1e9); this.riseF0 = new Float64Array(128).fill(-1e9);
    this.dev = new Float32Array(128); this.dLo = new Float32Array(128); this.dHi = new Float32Array(128); this.mf = 0;
    this.riseOddT = new Float64Array(128).fill(-1e9); this.riseFullT = new Float64Array(128).fill(-1e9);
    this.frames = 0; this.rmsSlow = 0; this.attackT = -1e9; this.level = 0;
    this.present = [];
  }

  Detector.prototype.fft = function () {
    const N = this.N, re = this.re, im = this.im, rev = this.rev, cs = this.cos, sn = this.sin;
    for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { const t = re[i]; re[i] = re[j]; re[j] = t; } }
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1, step = N / len;
      for (let i = 0; i < N; i += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = cs[k], wi = -sn[k], a = i + j, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
  };

  // מחזיר את עוצמת הפסגה הקרובה לתדר f (0 אם אין פסגה מספיק מדויקת)
  Detector.prototype.match = function (f, tolRatio) {
    const pf = this.pf, np = this.np;
    let lo = 0, hi = np - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (pf[mid] < f) lo = mid + 1; else hi = mid; }
    let best = -1, bd = 1e9;
    for (let i = lo - 1; i <= lo; i++) { if (i < 0 || i >= np) continue; const d = Math.abs(pf[i] - f); if (d < bd) { bd = d; best = i; } }
    if (best < 0) return 0;
    const tol = Math.max(f * tolRatio, 0.45 * this.binHz);
    if (bd > tol) return 0;
    this.mf = pf[best];
    return this.pa[best];
  };

  // האם התו הוא בעצם "חלקיק" של קול אנושי? לקול יש סדרת הרמוניות צפופה: פסגות גם מתחת וגם מעל
  // במרווחים שווים (f/k). לצליל קלידים בודד אין פסגות כאלה בין היסוד להרמוניה השנייה.
  Detector.prototype.voiceLike = function (f1, a1) {
    const min = 0.12 * a1;
    for (let k = 2; k <= 7; k++) {
      const d = f1 / k; if (d < 70) break;
      if (this.match(f1 - d, 0.02) < min || this.match(f1 + d, 0.02) < min) continue;
      if (k === 2 || this.match(f1 + 2 * d, 0.02) >= min || this.match(f1 - 2 * d, 0.02) >= min) return true;
    }
    return false;
  };

  // x: N הדגימות האחרונות. t: זמן באלפיות שנייה. expected: Set של תווים שהמשחק מצפה להם (או null)
  Detector.prototype.process = function (x, t, expected) {
    const N = this.N, re = this.re, im = this.im, w = this.win, mag = this.mag, sm = this.sm, nf = this.nf, pre = this.pre;
    const maxBin = this.maxBin, binHz = this.binHz, events = [];

    let s = 0; for (let i = N - 1024; i < N; i++) s += x[i] * x[i];
    const rms = Math.sqrt(s / 1024); this.level = rms;
    if (rms > 1.5 * this.rmsSlow && rms > 1e-4) this.attackT = t;
    this.rmsSlow = this.rmsSlow * 0.85 + rms * 0.15;

    for (let i = 0; i < N; i++) { re[i] = x[i] * w[i]; im[i] = 0; }
    this.fft();
    const sc = 4 / N, first = this.frames === 0;
    pre[0] = 0;
    for (let k = 0; k <= maxBin + 1; k++) {
      const m = Math.hypot(re[k], im[k]) * sc; mag[k] = m;
      sm[k] = first ? m : sm[k] * 0.6 + m * 0.4;
      nf[k] = first ? sm[k] : Math.min(sm[k], nf[k] * 1.005 + 1e-10); // רצפת רעש נלמדת לכל תדר
      pre[k + 1] = pre[k] + m;
    }
    this.frames++;

    // פסגות ספקטרליות חדות שבולטות מעל רעש הרקע
    const pf = this.pf, pa = this.pa; let np = 0, maxAmp = 0;
    const W = 10, kmin = Math.max(2, Math.floor(50 / binHz));
    for (let k = kmin; k <= maxBin && np < 255; k++) {
      const m = mag[k];
      if (m <= mag[k - 1] || m < mag[k + 1] || m < 2e-5 || m < 8 * nf[k]) continue;
      const lo = Math.max(0, k - W), hi = Math.min(maxBin + 1, k + W);
      const locEx = (pre[hi + 1] - pre[lo] - mag[k - 1] - m - mag[k + 1]) / (hi - lo - 2);
      if (m < 3.2 * locEx) continue;
      const a = Math.log(mag[k - 1] + 1e-12), b = Math.log(m), c = Math.log(mag[k + 1] + 1e-12);
      const den = a - 2 * b + c, p = den < 0 ? 0.5 * (a - c) / den : 0;
      pf[np] = (k + p) * binHz; pa[np] = Math.exp(b - 0.25 * (a - c) * p);
      if (pa[np] > maxAmp) maxAmp = pa[np];
      np++;
    }
    // מסירים פסגות זניחות ביחס לחזקה ביותר (אונות צד ורעש)
    let q = 0; for (let i = 0; i < np; i++) if (pa[i] >= 0.03 * maxAmp) { pf[q] = pf[i]; pa[q] = pa[i]; q++; }
    this.np = np = q;

    // ציון לכל תו לפי סדרת ההרמוניות שלו
    const A1 = this.a1, strict = this.strict, pres = this.pres, F = this.F, oddE = this.oddE, fullE = this.fullE;
    const tolR = Math.pow(2, 30 / 1200) - 1;
    let maxE = 0;
    for (let n = LO; n <= HI; n++) {
      const f0 = F[n]; let a1 = 0, a2 = 0, a3 = 0, a4 = 0, cnt = 0;
      if (np) for (let h = 1; h <= NH; h++) {
        const fh = f0 * h * (1 + 0.00008 * h * h); if (fh > 5400) break;
        const a = this.match(fh, tolR); if (!a) continue;
        if (h <= 5) cnt++;
        if (h === 1) { a1 = a; this.dev[n] = 1200 * Math.log2(this.mf / f0); } else if (h === 2) a2 = a; else if (h === 3) a3 = a; else if (h === 4) a4 = a;
      }
      A1[n] = a1; oddE[n] = a1; fullE[n] = a1 + a2 + a3 + 0.5 * a4; this.a2[n] = a2; this.a3[n] = a3; this.cnt[n] = cnt;
      // "מחמיר": יש יסוד אמיתי + לפחות הרמוניה נוספת, והיסוד לא זניח ביחס אליהן
      const st = a1 > 0 && cnt >= 2 && a1 >= 0.08 * Math.max(a2, a3, a4) && (a1 >= 0.25 * a2 || a3 > 0);
      strict[n] = st ? 1 : 0;
      const ex = expected && expected.has(n);
      // תו שהמשחק מצפה לו מתקבל גם בלי יסוד (רמקול קטן) או עם יסוד בלבד
      pres[n] = st || (ex && ((a2 > 0 && a3 > 0) || (a1 >= 0.1 * maxAmp && a1 > 0 && n >= 60))) ? 1 : 0;
      if (pres[n] && fullE[n] > maxE) maxE = fullE[n];
    }

    // התקפה = עלייה באנרגיה של התו מעל המעטפת האחרונה שלו (לא מתבלבל מ"גמגום" של צליל שעדיין מהדהד)
    const hO = this.histO, hF = this.histF, envO = this.envO, envF = this.envF, hp = this.hp;
    const present = this.present; present.length = 0;
    for (let n = LO; n <= HI; n++) {
      let mo = Infinity, mf = Infinity;
      for (let k = 0; k < HL; k++) { const a = hO[n * HL + k], b = hF[n * HL + k]; if (a < mo) mo = a; if (b < mf) mf = b; }
      const o = oddE[n], f = fullE[n];
      // עלייה ביסוד, או (הקשה חוזרת חלשה על אותו קליד) חזרה של ההרמוניות 2 ו-3 יחד
      const a2 = this.a2[n], a3 = this.a3[n];
      const re2 = o > 0 && a2 > 1.25 * this.env2[n] + 1e-7 && a3 > 1.25 * this.env3[n] + 1e-7;
      if ((o > 1.12 * envO[n] + 1e-7 && o > 1.3 * mo) || re2) { if (t - this.riseOddT[n] > 110) this.rise0[n] = t; this.riseOddT[n] = t; }
      if (f > 1.12 * envF[n] + 1e-7 && f > 1.3 * mf) { if (t - this.riseFullT[n] > 110) this.riseF0[n] = t; this.riseFullT[n] = t; }
      envO[n] = Math.max(o, envO[n] * 0.96); envF[n] = Math.max(f, envF[n] * 0.96);
      this.env2[n] = Math.max(a2, this.env2[n] * 0.96); this.env3[n] = Math.max(a3, this.env3[n] * 0.96);
      hO[n * HL + hp] = o; hF[n * HL + hp] = f;
    }
    this.hp = (hp + 1) % HL;

    for (let n = LO; n <= HI; n++) {
      const ex = expected && expected.has(n);
      if (!pres[n]) {
        this.seen[n] = 0;
        if (this.on[n] && ++this.gone[n] >= 3) { this.on[n] = 0; events.push({ type: 'off', midi: n }); }
        continue;
      }
      present.push(n);
      // יציבות גובה הצליל: קלידים מכוונים ויציבים, דיבור ושירה "מחליקים" — תו שהתדר שלו זז נפסל
      if (A1[n] > 0) {
        const d = this.dev[n];
        if (!this.seen[n]) { this.dLo[n] = d; this.dHi[n] = d; } else { if (d < this.dLo[n]) this.dLo[n] = d; if (d > this.dHi[n]) this.dHi[n] = d; }
        if (this.dHi[n] - this.dLo[n] > (ex ? 32 : 16)) { this.seen[n] = 0; this.lastOn[n] = Math.max(this.lastOn[n], t - 150); continue; }
      }
      if (!this.seen[n]) this.since[n] = t;
      if (this.seen[n] < 250) this.seen[n]++;
      this.gone[n] = 0;
      // ההתקפה נמדדת על היסוד של התו עצמו; רק לתו צפוי נמוך בלי יסוד (רמקול קטן) — על ההרמוניות
      const noFund = ex && A1[n] === 0 && n < 60;
      const rT = noFund ? this.riseFullT[n] : this.riseOddT[n], r0 = noFund ? this.riseF0[n] : this.rise0[n];
      if (t - rT > 260 || rT <= this.lastOn[n] + 120 || t - this.lastOn[n] < 230) continue; // אין התקפה חדשה (עלייה מיד אחרי זיהוי היא עדיין אותה הקשה)
      const need = ex ? 2 : 3, minMs = ex ? 20 : 50;
      if (this.seen[n] < need || t - this.since[n] < minMs) continue;
      if (!ex && !(strict[n] && fullE[n] >= 0.2 * maxE && A1[n] >= 0.12 * maxAmp && (this.cnt[n] >= 3 || n >= 79))) continue;
      if (A1[n] > 0 && (!ex || expected.size === 1) && this.voiceLike(F[n] * Math.pow(2, this.dev[n] / 1200), A1[n])) { this.seen[n] = 0; continue; }
      // האם זו רק הרמוניה של תו נמוך יותר?
      let low = -1;
      for (let r = 0; r < REL.length; r++) {
        const m = n - REL[r]; if (m < LO) break;
        if (!pres[m]) continue;
        const exM = expected && expected.has(m);
        // התו הנמוך הוקש באותו רגע בדיוק (ולא סתם עדיין מהדהד)?
        const struck = Math.abs(this.rise0[m] - r0) < 110 || (exM && A1[m] === 0 && Math.abs(this.riseF0[m] - r0) < 110);
        if (struck || (!ex && strict[m] && A1[n] <= 1.3 * A1[m])) { low = m; break; }
      }
      this.lastOn[n] = t;
      if (low < 0) { this.on[n] = 1; events.push({ type: 'on', midi: n, ghost: false }); }
      else if (ex && expected.has(low)) { this.on[n] = 1; events.push({ type: 'on', midi: n, ghost: true }); }
      // אחרת: הרמוניה של תו אחר — לא מדווחים עליה
    }
    return events;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Detector; else root.Detector = Detector;
})(typeof self !== 'undefined' ? self : this);

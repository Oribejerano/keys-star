// מנוע זיהוי תווים מפסנתר דרך מיקרופון (גרסה 2).
// עיקרון: מוצאים "פסגות" חדות בספקטרום שבולטות מעל רעש הרקע, ומקבלים תו רק אם יש לו
// סדרת הרמוניות מדויקת (צליל מכוון של קלידים) שעלתה עכשיו (הקשת קליד). רעש, דיבור וצלילים
// לא מכוונים לא עוברים את המסננים. כשהמשחק יודע לאיזה תווים הוא מצפה, הם מזוהים בסף נמוך
// יותר, ותו לא צפוי מדווח כ"טעות" רק כשהראיות חזקות.
// בנוסף: גלאי "נקישת הקשה" בזמן אמת נותן לכל תו חותמת זמן מדויקת של רגע ההקשה (t0),
// ומאפשר לזהות הקשה חוזרת על קליד שעדיין מצלצל בלי להתבלבל מצליל שמתנדנד (כורוס/רעד).
(function (root) {
  'use strict';
  const LO = 33, HI = 100, HL = 24, NH = 6;
  const REL = [12, 19, 24, 28, 31, 34, 36]; // מרווחים של הרמוניות מעל תו
  const ENV_TAU = 550, HIST_MS = 220;

  function Detector(sr, opt) {
    opt = opt || {};
    this.sr = sr;
    const N = this.N = sr > 30000 ? 8192 : 4096;
    // חלון א-סימטרי: עולה לאט על הדגימות הישנות ויורד מהר על החדשות — תו חדש "נראה" מוקדם יותר
    this.win = asymWindow(N, opt.asym == null ? 0.72 : opt.asym);
    this.fft = makeFFT(N);
    this.re = new Float32Array(N); this.im = new Float32Array(N);
    this.binHz = sr / N;
    this.maxBin = Math.min(N / 2 - 2, Math.ceil(5600 / this.binHz));
    const M = this.maxBin + 2;
    this.mag = new Float32Array(M); this.sm = new Float32Array(M); this.nf = new Float32Array(M); this.pre = new Float64Array(M + 1);
    this.tmp = new Float32Array(32); this.locK = opt.locK || 5; this.pf = new Float32Array(256); this.pa = new Float32Array(256); this.np = 0; this.mf = 0;
    this.F = new Float32Array(128); for (let n = 0; n < 128; n++) this.F[n] = 440 * Math.pow(2, (n - 69) / 12);
    this.tune = opt.tune || 0; this.tuneR = Math.pow(2, this.tune / 1200); // כיוון עדין של הכלי (סנטים), נלמד תוך כדי נגינה
    const f32 = () => new Float32Array(128), f64 = v => new Float64Array(128).fill(v);
    this.a = [null, f32(), f32(), f32(), f32(), f32()];      // עוצמת הרמוניות 1..5 לכל תו
    this.env = [null, f32(), f32(), f32(), f32(), f32()];    // המעטפת האחרונה של כל הרמוניה
    this.fullE = f32(); this.envF = f32(); this.cnt = new Uint8Array(128);
    this.strict = new Uint8Array(128); this.pres = new Uint8Array(128);
    this.histO = new Float32Array(128 * HL); this.histF = new Float32Array(128 * HL); this.histT = new Float64Array(HL).fill(-1e9); this.hp = 0;
    this.seen = new Uint8Array(128); this.on = new Uint8Array(128);
    this.since = f64(0); this.goneT = f64(0); this.lastOn = f64(-1e9);
    this.atkOn = f64(-1e9); this.rise0 = f64(-1e9); this.riseT = f64(-1e9); this.riseF0 = f64(-1e9); this.riseFT = f64(-1e9);
    this.dev = f32(); this.dLo = f32(); this.dHi = f32();
    // גלאי נקישות (בזמן, לא בתדר)
    this.faintK = opt.faintK == null ? 0.12 : opt.faintK; this.farRel = opt.farRel || 19;
    this.blk = Math.max(64, Math.round(sr * 0.005)); this.blkE = new Float32Array(10); this.blkD = new Float32Array(10); this.atkK = opt.atkK || 1.5; this.guard = opt.guard == null ? 1 : opt.guard; this.blkI = 0; this.carry = 0;
    this.atk = new Float64Array(8).fill(-1e9); this.atkI = 0; this.attackT = -1e9;
    // מסלול מהיר: חלון קצר (כ-43 אלפיות שנייה) על התדרים שמעל 420Hz, רק לתווים שהמשחק מצפה להם
    const N2 = this.N2 = N / 4;
    this.win2 = asymWindow(N2, 0.65); this.fft2 = makeFFT(N2); this.re2 = new Float32Array(N2); this.im2 = new Float32Array(N2);
    this.bin2 = sr / N2; this.max2 = Math.min(N2 / 2 - 2, Math.ceil(5400 / this.bin2));
    this.ring2 = []; for (let i = 0; i < 16; i++) this.ring2.push(new Float32Array(this.max2 + 2));
    this.ring2T = new Float64Array(16).fill(-1e9); this.ring2I = 0;
    this.pf2 = new Float32Array(128); this.pa2 = new Float32Array(128); this.pu2 = new Uint8Array(128);
    this.fastOn = opt.fast == null ? 1 : opt.fast; this.fastNeed = opt.fastNeed || 2; this.fastExpl = opt.fastExpl || 0.7; this.fast2 = opt.fast2 == null ? 1 : opt.fast2; this.fastSeen = new Uint8Array(128); this.fastT = new Float64Array(128).fill(-1e9);
    // הקשחה מול דיבור (כויל על הקלטות אמיתיות): תו צפוי חייב להסביר את רוב מה שנשמע, להיות מכוון, ולא חלש בהרבה מהנגינה הרגילה
    this.exExpl = opt.exExpl == null ? 0.62 : opt.exExpl; this.exDev = opt.exDev || 20; this.quietK = opt.quietK == null ? 0.55 : opt.quietK; this.lowFund = opt.lowFund || 55;
    this.subOct = opt.subOct == null ? 0.3 : opt.subOct; this.ref = opt.ref || 0; this.emitT = new Float64Array(128).fill(-1e9); this.ringMs = opt.ringMs == null ? 1500 : opt.ringMs; this.quiet = false; this.pu = new Uint8Array(256); this.explAll = 1;
    this.frames = 0; this.lastT = null; this.level = 0; this.peak = 0;
    this.present = [];
  }

  function makeFFT(N) {
    const rev = new Uint16Array(N), bits = Math.log2(N), cs = new Float32Array(N / 2), sn = new Float32Array(N / 2);
    for (let i = 0; i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    for (let i = 0; i < N / 2; i++) { cs[i] = Math.cos(2 * Math.PI * i / N); sn[i] = Math.sin(2 * Math.PI * i / N); }
    return function (re, im) {
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
  }
  function asymWindow(N, frac) {
    const Lr = Math.round(N * frac), Lf = N - Lr, w = new Float32Array(N);
    for (let i = 0; i < N; i++) w[i] = i < Lr ? 0.5 - 0.5 * Math.cos(Math.PI * i / Lr) : 0.5 + 0.5 * Math.cos(Math.PI * (i - Lr) / Lf);
    return w;
  }

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
    this.mf = pf[best]; this.mi = best;
    return this.pa[best];
  };

  // האם התו הוא בעצם "חלקיק" של קול אנושי? לקול יש סדרת הרמוניות צפופה: פסגות גם מתחת וגם מעל
  // במרווחים שווים (f/k). לצליל קלידים בודד אין פסגות כאלה בין היסוד להרמוניה השנייה.
  Detector.prototype.voiceLike = function (f1, a1, k0) {
    const min = (k0 || 0.12) * a1;
    for (let k = 2; k <= 7; k++) {
      const d = f1 / k; if (d < 70) break;
      if (this.match(f1 - d, 0.02) < min || this.match(f1 + d, 0.02) < min) continue;
      if (k === 2 || this.match(f1 + 2 * d, 0.02) >= min || this.match(f1 - 2 * d, 0.02) >= min) return true;
    }
    return false;
  };

  // גלאי נקישות: קפיצה חדה באנרגיה (הכוללת, או של התדרים הגבוהים) בבלוקים של 5 אלפיות שנייה,
  // ביחס למקסימום של 40 אלפיות השנייה שלפני — כך תנודה מחזורית של צליל נמוך לא נחשבת נקישה.
  Detector.prototype.attacks = function (x, t, newSamples) {
    const N = this.N, B = this.blk, E = this.blkE, D = this.blkD, sr = this.sr;
    let i0 = N - newSamples - this.carry; if (i0 < 1) i0 = 1;
    let pk = 0;
    for (; i0 + B <= N; i0 += B) {
      let e = 0, dd = 0;
      for (let i = i0; i < i0 + B; i++) { const v = x[i], d = v - x[i - 1]; e += v * v; dd += d * d; const av = v < 0 ? -v : v; if (av > pk) pk = av; }
      let me = 0, md = 0;
      for (let k = 2; k < 10; k++) { const q = (this.blkI - k + 20) % 10; if (E[q] > me) me = E[q]; if (D[q] > md) md = D[q]; }
      const tb = t - (N - i0) / sr * 1000;
      if ((e > this.atkK * me + 1e-9 || dd > this.atkK * md + 1e-10) && tb - this.attackT > 45) { this.attackT = tb; this.atkR = Math.max(e / (me + 1e-9), dd / (md + 1e-10)); this.atkE = e; this.atk[this.atkI] = tb; this.atkI = (this.atkI + 1) % 8; }
      E[this.blkI] = e; D[this.blkI] = dd; this.blkI = (this.blkI + 1) % 10;
    }
    this.carry = N - i0;
    this.peak = pk;
  };

  // מסלול מהיר לתווים צפויים. הרעיון: מיד אחרי נקישה, מסתכלים בחלון קצר רק על מה ש"עלה" עכשיו
  // בספקטרום. אם כמעט כל מה שעלה הוא בדיוק ההרמוניות של תו צפוי (כולל הרמוניה אי-זוגית, כדי
  // לא להתבלבל עם האוקטבה שמעל) — מאשרים אותו מיד, בלי לחכות לחלון הארוך והמדויק.
  Detector.prototype.fast = function (x, t, expected, events) {
    const N = this.N, N2 = this.N2, re = this.re2, im = this.im2, w = this.win2, max2 = this.max2, bin2 = this.bin2;
    const off = N - N2;
    for (let i = 0; i < N2; i++) { re[i] = x[off + i] * w[i]; im[i] = 0; }
    this.fft2(re, im);
    const cur = this.ring2[this.ring2I], sc = 4 / N2;
    for (let k = 0; k <= max2 + 1; k++) cur[k] = Math.hypot(re[k], im[k]) * sc;
    // הספקטרום מלפני כ-40 אלפיות שנייה — להשוואה
    let prev = null, bestAge = 1e9;
    for (let i = 0; i < 16; i++) { const age = t - this.ring2T[i]; if (age >= 28 && age <= 70 && Math.abs(age - 42) < bestAge) { bestAge = Math.abs(age - 42); prev = this.ring2[i]; } }
    this.ring2T[this.ring2I] = t; this.ring2I = (this.ring2I + 1) % 16;
    if (!prev || !expected || !expected.size || t - this.attackT > 90 || this.quiet) { this.fastSeen.fill(0); return; }
    // פסגות ש"עלו" עכשיו
    const pf = this.pf2, pa = this.pa2, pu = this.pu2, tmp = this.tmp; let np = 0, total = 0, maxA = 0;
    const kLo = Math.max(3, Math.ceil(420 / bin2));
    for (let k = kLo; k <= max2 && np < 127; k++) {
      const m = cur[k];
      if (m <= cur[k - 1] || m < cur[k + 1] || m < 6e-5) continue;
      if (m < 1.8 * Math.max(prev[k - 1], prev[k], prev[k + 1]) + 1e-6) continue;
      let cn = 0; const lo = Math.max(1, k - 6), hi = Math.min(max2 + 1, k + 6);
      for (let i = lo; i <= hi; i++) { if (i >= k - 1 && i <= k + 1) continue; const v = cur[i]; let j = cn++; while (j > 0 && tmp[j - 1] > v) { tmp[j] = tmp[j - 1]; j--; } tmp[j] = v; }
      const half = cn >> 1; let lowSum = 0; for (let i = 0; i < half; i++) lowSum += tmp[i];
      if (m < 4 * lowSum / half) continue;
      const a = Math.log(cur[k - 1] + 1e-12), b = Math.log(m), c = Math.log(cur[k + 1] + 1e-12), den = a - 2 * b + c, p = den < 0 ? 0.5 * (a - c) / den : 0;
      pf[np] = (k + p) * bin2; pa[np] = m; pu[np] = 0; if (m > maxA) maxA = m; np++;
    }
    let q = 0; for (let i = 0; i < np; i++) if (pa[i] >= 0.08 * maxA) { pf[q] = pf[i]; pa[q] = pa[i]; pu[q] = 0; total += pa[i]; q++; }
    np = q;
    if (np < 2) { this.fastSeen.fill(0); return; }
    const cand = []; let weak = false;
    for (const n of expected) {
      if (n < LO || n > HI || t - this.lastOn[n] < 200) continue;
      const f0 = this.F[n] * this.tuneR; let avail = 0, mc = 0, odd = 0, oddAvail = 0, low2 = 0;
      for (let h = 1; h <= 14 && avail < 6; h++) {
        const fh = f0 * h * (1 + 0.00008 * h * h); if (fh < 420) continue; if (fh > 5200) break;
        avail++; if (h & 1) oddAvail++;
        const tol = Math.max(fh * 0.02, 0.35 * bin2);
        let bi = -1, bd = tol; for (let i = 0; i < np; i++) { const d = Math.abs(pf[i] - fh); if (d <= bd) { bd = d; bi = i; } }
        if (bi >= 0) { mc++; if (h & 1) odd++; if (avail <= 2) low2++; pu[bi] = 1; }
      }
      // צליל עם שתי הרמוניות בלבד (יסוד + אוקטבה): מתקבל רק אם הן מסבירות כמעט את כל מה שעלה
      const two = mc === 2 && avail > 3 && low2 === 2 && this.fast2;
      if (!(mc >= 2 && (mc >= 3 || avail <= 3 || two) && (oddAvail === 0 || odd >= 1))) continue;
      if (two) weak = true;
      // האם בעצם הוקש הקליד שאוקטבה מתחת? אז גם היסוד שלו (חצי תדר) עלה עכשיו, ובעוצמה דומה
      if (this.subOct && !expected.has(n - 12)) {
        const kh = Math.round(f0 / 2 / bin2), k1 = Math.round(f0 / bin2);
        if (kh >= 4) {
          const sub = Math.max(cur[kh - 1], cur[kh], cur[kh + 1]), subP = Math.max(prev[kh - 1], prev[kh], prev[kh + 1]), a0 = Math.max(cur[k1 - 1], cur[k1], cur[k1 + 1]);
          if (sub >= this.subOct * a0 && sub >= 1.6 * subP) continue;
        }
      }
      cand.push(n);
    }
    let expl = 0; for (let i = 0; i < np; i++) if (pu[i]) expl += pa[i];
    if (!cand.length || expl < (weak ? 0.95 : this.fastExpl) * total) { this.fastSeen.fill(0); return; }
    for (const n of cand) {
      if (t - this.fastT[n] > 14) this.fastSeen[n] = 0;
      this.fastT[n] = t;
      if (++this.fastSeen[n] < this.fastNeed) continue;
      this.fastSeen[n] = 0; this.on[n] = 1; this.goneT[n] = 0;
      this.lastOn[n] = t + 40; this.atkOn[n] = this.attackT; this.emitT[n] = t; // המסלול הרגיל לא ידווח שוב על אותה הקשה
      if (this.dbg) this.dbg({ n, t, fast: 1, atkR: Math.min(99, this.atkR), expl: expl / total, np, age: t - this.attackT, lvl: this.level, maxA, nc: cand.length });
      if (this.level > this.ref) this.ref = this.ref ? this.ref + 0.3 * (this.level - this.ref) : this.level;
      events.push({ type: 'on', midi: n, ghost: false, t0: this.attackT, fast: true });
    }
  };

  // x: N הדגימות האחרונות. t: זמן (אלפיות שנייה). expected: Set של תווים שהמשחק מצפה להם (או null).
  // newSamples: כמה דגימות חדשות נוספו מאז הקריאה הקודמת.
  // fastOnly: מריץ רק את גלאי הנקישות והמסלול המהיר (לקריאות ביניים כל 5 אלפיות שנייה)
  Detector.prototype.process = function (x, t, expected, newSamples, fastOnly) {
    const N = this.N, re = this.re, im = this.im, w = this.win, mag = this.mag, sm = this.sm, nf = this.nf, pre = this.pre;
    const maxBin = this.maxBin, binHz = this.binHz, events = [];
    if (newSamples == null) newSamples = Math.round((this.lastA == null ? 10 : Math.max(2, Math.min(120, t - this.lastA))) * this.sr / 1000);
    newSamples = Math.max(0, Math.min(N - 2, newSamples | 0)); this.lastA = t;
    if (fastOnly) { this.attacks(x, t, newSamples); if (this.fastOn) this.fast(x, t, expected, events); return events; }
    const dt = this.lastT == null ? 20 : Math.max(2, Math.min(120, t - this.lastT)); this.lastT = t;
    const dec = Math.exp(-dt / ENV_TAU);

    let s = 0; for (let i = N - 1024; i < N; i++) s += x[i] * x[i];
    this.level = Math.sqrt(s / 1024);
    this.quiet = this.ref > 0 && this.level < this.quietK * this.ref; // חלש בהרבה מהנגינה הרגילה: כנראה דיבור או רעש
    this.attacks(x, t, newSamples);
    if (this.fastOn) this.fast(x, t, expected, events);

    for (let i = 0; i < N; i++) { re[i] = x[i] * w[i]; im[i] = 0; }
    this.fft(re, im);
    const sc = 4 / N, first = this.frames === 0, al = 1 - Math.exp(-dt / 43), up = Math.exp(dt * 0.00022);
    pre[0] = 0;
    for (let k = 0; k <= maxBin + 1; k++) {
      const m = Math.hypot(re[k], im[k]) * sc; mag[k] = m;
      sm[k] = first ? m : sm[k] + (m - sm[k]) * al;
      nf[k] = first ? sm[k] : Math.min(sm[k], nf[k] * up + 1e-10); // רצפת רעש נלמדת לכל תדר
      pre[k + 1] = pre[k] + m;
    }
    this.frames++;

    // פסגות ספקטרליות חדות שבולטות מעל רעש הרקע
    const pf = this.pf, pa = this.pa, tmp = this.tmp; let np = 0, maxAmp = 0;
    const W = 10, kmin = Math.max(2, Math.floor(50 / binHz));
    for (let k = kmin; k <= maxBin && np < 255; k++) {
      const m = mag[k];
      if (m <= mag[k - 1] || m < mag[k + 1] || m < 2e-5 || m < 8 * nf[k]) continue;
      const lo = Math.max(0, k - W), hi = Math.min(maxBin + 1, k + W);
      // בולטות מקומית: ביחס לחצי השקט של הסביבה (ה"עמקים"), כדי שצלילים סמוכים באקורד נמוך לא יסתירו זה את זה
      let cn = 0;
      for (let i = lo; i <= hi; i++) { if (i >= k - 1 && i <= k + 1) continue; const v = mag[i]; let j = cn++; while (j > 0 && tmp[j - 1] > v) { tmp[j] = tmp[j - 1]; j--; } tmp[j] = v; }
      const half = cn >> 1; let lowSum = 0; for (let i = 0; i < half; i++) lowSum += tmp[i];
      if (m < this.locK * lowSum / half) continue;
      const a = Math.log(mag[k - 1] + 1e-12), b = Math.log(m), c = Math.log(mag[k + 1] + 1e-12);
      const den = a - 2 * b + c, p = den < 0 ? 0.5 * (a - c) / den : 0;
      pf[np] = (k + p) * binHz; pa[np] = Math.exp(b - 0.25 * (a - c) * p);
      if (pa[np] > maxAmp) maxAmp = pa[np];
      np++;
    }
    let q = 0; for (let i = 0; i < np; i++) if (pa[i] >= 0.03 * maxAmp) { pf[q] = pf[i]; pa[q] = pa[i]; q++; }
    this.np = np = q;

    // ציון לכל תו לפי סדרת ההרמוניות שלו
    const A = this.a, A1 = A[1], strict = this.strict, pres = this.pres, F = this.F, fullE = this.fullE, cntA = this.cnt;
    const tolR = Math.pow(2, 30 / 1200) - 1, tuneR = this.tuneR;
    let maxE = 0;
    for (let n = LO; n <= HI; n++) {
      const f0 = F[n] * tuneR; let cnt = 0;
      A[1][n] = A[2][n] = A[3][n] = A[4][n] = A[5][n] = 0;
      if (np) for (let h = 1; h <= NH; h++) {
        const fh = f0 * h * (1 + 0.00008 * h * h); if (fh > 5400) break;
        const am = this.match(fh, tolR); if (!am) continue;
        if (h <= 5) { cnt++; A[h][n] = am; }
        if (h === 1) this.dev[n] = 1200 * Math.log2(this.mf / f0);
      }
      const a1 = A[1][n], a2 = A[2][n], a3 = A[3][n], a4 = A[4][n];
      fullE[n] = a1 + a2 + a3 + 0.5 * a4; cntA[n] = cnt;
      // "מחמיר": יש יסוד אמיתי + לפחות הרמוניה נוספת, והיסוד לא זניח ביחס אליהן
      const st = a1 > 0 && cnt >= 2 && a1 >= 0.08 * Math.max(a2, a3, a4) && (a1 >= 0.25 * a2 || a3 > 0);
      strict[n] = st ? 1 : 0;
      const ex = expected && expected.has(n);
      // תו שהמשחק מצפה לו מתקבל גם בלי יסוד (רמקול קטן) או עם יסוד בלבד
      // תו צפוי מתקבל גם בלי יסוד רק בקלידים הנמוכים (רמקול קטן), ועם יסוד בלבד רק בקלידים הגבוהים כשהוא הפסגה הבולטת
      pres[n] = st || (ex && ((n < this.lowFund && a2 > 0 && a3 > 0) || (n >= 76 && a1 >= 0.5 * maxAmp && a1 > 0))) ? 1 : 0;
      if (pres[n] && fullE[n] > maxE) maxE = fullE[n];
    }

    // כמה ממה שנשמע עכשיו מוסבר על ידי התווים הצפויים והתווים שכבר מצלצלים? בנגינה — כמעט הכול; בדיבור — מעט
    if (expected && expected.size && np) {
      const pu = this.pu, tol2 = Math.pow(2, 18 / 1200) - 1; let sum = 0, ex2 = 0;
      for (let i = 0; i < np; i++) { pu[i] = 0; sum += pa[i]; }
      const mark = n => { const f0 = F[n] * tuneR; for (let h = 1; h <= 8; h++) { const fh = f0 * h * (1 + 0.00008 * h * h); if (fh > 5400) break; if (this.match(fh, tol2)) pu[this.mi] = 1; } };
      for (const n of expected) if (n >= LO && n <= HI) mark(n);
      for (let n = LO; n <= HI; n++) if ((this.on[n] || t - this.emitT[n] < this.ringMs) && !expected.has(n)) mark(n); // גם תווים שזוהו לאחרונה ועדיין מהדהדים
      for (let i = 0; i < np; i++) if (pu[i]) ex2 += pa[i];
      this.explAll = ex2 / sum;
    } else this.explAll = 1;

    // הקשה = עלייה באנרגיית התו מעל המעטפת האחרונה שלו. אם התו כבר מצלצל, נדרשת גם נקישה אמיתית
    // באותו רגע — כך צליל שמתנדנד (כורוס, רעד, הגבר אוטומטי) לא נחשב הקשה חדשה.
    const hO = this.histO, hF = this.histF, hT = this.histT, env = this.env, envF = this.envF, hp = this.hp;
    const atkNow = t - this.attackT <= 200;
    for (let n = LO; n <= HI; n++) {
      // נקישה שכבר "נוצלה" לזיהוי התו הזה לא נספרת שוב
      const atkRecent = atkNow, atkNew = atkNow && this.attackT > this.atkOn[n] + 1;
      let mo = Infinity, mf = Infinity, moAge = 0;
      for (let k = 0; k < HL; k++) { const age = t - hT[k]; if (age > HIST_MS) continue; const p = hO[n * HL + k], g = hF[n * HL + k]; if (p < mo) { mo = p; moAge = age; } if (g < mf) mf = g; }
      if (mo === Infinity) { mo = 0; mf = 0; }
      const o = A1[n], f = fullE[n];
      const e1 = env[1][n] * dec, e2 = env[2][n] * dec, e3 = env[3][n] * dec, e4 = env[4][n] * dec, e5 = env[5][n] * dec;
      const a2 = A[2][n], a3 = A[3][n], a4 = A[4][n], a5 = A[5][n];
      if (o > 0) {
        const sounding = e1 >= 0.3 * o;
        const re2 = a2 > 1.25 * e2 + 1e-7 && a3 > 1.25 * e3 + 1e-7;
        // עם נקישה חדשה: מספיקה עלייה מתונה של הרמוניות 2 ו-3, בתנאי שהיסוד עצמו לא בדעיכה
        let v60 = Infinity; for (let k = 0; k < HL; k++) { const age = t - hT[k]; if (age >= 45 && age <= 80 && hO[n * HL + k] < v60) v60 = hO[n * HL + k]; }
        const re3 = atkNew && o >= 0.95 * v60 && a2 > 1.12 * e2 + 1e-7 && a3 > 1.12 * e3 + 1e-7;
        // הקשה חוזרת: הצליל הישן נקטע והחדש מתחיל → היסוד "צולל" לרגע ומתאושש, יחד עם נקישה
        let dip = false;
        if (atkNew && sounding && mo > 0 && o > 1.35 * mo && o >= 0.8 * e1) {
          // צלילה אמיתית: לפני נקודת השפל הצליל היה גבוה ממנה (ולא סתם תחילת צליל שעדיין עולה)
          let preMax = 0; for (let k = 0; k < HL; k++) { const age = t - hT[k]; if (age > moAge && age <= HIST_MS && hO[n * HL + k] > preMax) preMax = hO[n * HL + k]; }
          dip = preMax >= 1.33 * mo;
        }
        let rise = (o > 1.12 * e1 + 1e-7 && o > 1.3 * mo) || re2 || re3 || dip;
        if (rise && sounding && !atkRecent && this.guard) {
          // בלי נקישה: מקבלים רק עלייה תלולה (הקשה), לא עלייה איטית (צליל מתנדנד)
          if (!(o > 1.35 * v60)) rise = false;
        }
        if (rise) { if (t - this.riseT[n] > 110) this.rise0[n] = t; this.riseT[n] = t; }
      }
      const eF = envF[n] * dec;
      if (f > 1.12 * eF + 1e-7 && f > 1.3 * mf && !(eF >= 0.3 * f && !atkRecent)) { if (t - this.riseFT[n] > 110) this.riseF0[n] = t; this.riseFT[n] = t; }
      env[1][n] = Math.max(o, e1); env[2][n] = Math.max(a2, e2); env[3][n] = Math.max(a3, e3); env[4][n] = Math.max(a4, e4); env[5][n] = Math.max(a5, e5);
      envF[n] = Math.max(f, eF);
      hO[n * HL + hp] = o; hF[n * HL + hp] = f;
    }
    hT[hp] = t; this.hp = (hp + 1) % HL;

    const present = this.present; present.length = 0;
    for (let n = LO; n <= HI; n++) {
      const ex = expected && expected.has(n);
      if (!pres[n]) {
        this.seen[n] = 0;
        if (this.on[n]) { if (!this.goneT[n]) this.goneT[n] = t; else if (t - this.goneT[n] >= 60) { this.on[n] = 0; events.push({ type: 'off', midi: n }); } }
        continue;
      }
      present.push(n); this.goneT[n] = 0;
      // יציבות גובה הצליל: קלידים מכוונים ויציבים, דיבור ושירה "מחליקים" — תו שהתדר שלו זז נפסל
      if (A1[n] > 0) {
        const d = this.dev[n];
        if (!this.seen[n]) { this.dLo[n] = d; this.dHi[n] = d; } else { if (d < this.dLo[n]) this.dLo[n] = d; if (d > this.dHi[n]) this.dHi[n] = d; }
        if (this.dHi[n] - this.dLo[n] > (ex ? 32 : 12)) { this.seen[n] = 0; this.lastOn[n] = Math.max(this.lastOn[n], t - 150); continue; }
      }
      if (!this.seen[n]) this.since[n] = t;
      if (this.seen[n] < 250) this.seen[n]++;
      // ההקשה נמדדת על היסוד של התו עצמו; רק לתו צפוי נמוך בלי יסוד (רמקול קטן) — על ההרמוניות
      const noFund = ex && A1[n] === 0 && n < 60;
      const rT = noFund ? this.riseFT[n] : this.riseT[n], r0 = noFund ? this.riseF0[n] : this.rise0[n];
      if (t - rT > 260 || rT <= this.lastOn[n] + 120 || t - this.lastOn[n] < 200) continue; // אין הקשה חדשה
      // צליל חלש בהרבה מהנגינה הרגילה נבדק כמו תו לא צפוי: לאט ובקפדנות
      const lax = ex && !this.quiet;
      if (this.seen[n] < 2 || t - this.since[n] < (lax ? 12 : 80)) continue;
      if (!lax && !(strict[n] && fullE[n] >= 0.2 * maxE && A1[n] >= 0.12 * maxAmp && (cntA[n] >= 3 || n >= 79))) continue;
      if (!ex && this.quiet) continue;
      if (ex && (this.explAll < this.exExpl || (A1[n] > 0 && Math.abs(this.dev[n]) > this.exDev))) continue;
      if (A1[n] > 0 && (!lax || expected.size === 1) && this.voiceLike(F[n] * tuneR * Math.pow(2, this.dev[n] / 1200), A1[n])) { this.seen[n] = 0; continue; }
      // האם זו רק הרמוניה של תו נמוך יותר שהוקש באותו רגע בדיוק?
      let low = -1;
      for (let r = 0; r < REL.length; r++) {
        const m = n - REL[r]; if (m < LO) break;
        const exM = expected && expected.has(m);
        // (תו צפוי לא נחשב הרמוניה של תו רחוק — שתי אוקטבות ומעלה — שהיסוד שלו חלש בהרבה ממנו: זה רעש, לא הקשה)
        const faint = ex && !exM && REL[r] >= this.farRel && A1[m] < this.faintK * A1[n];
        const struck = (A1[m] > 0 && !faint && Math.abs(this.rise0[m] - r0) < 110) || (exM && pres[m] && A1[m] === 0 && Math.abs(this.riseF0[m] - r0) < 110);
        // תו לא צפוי: אם תו נמוך ממנו מצלצל (או צפוי ונשמע) והעוצמה מתאימה להרמוניה שלו — זו הרמוניה, לא תו
        if (struck || (!ex && ((A1[n] <= 1.3 * Math.max(A1[m], env[1][m])) || (exM && (A1[m] > 0 || A[3][m] > 0))))) { low = m; break; }
      }
      this.lastOn[n] = t; this.atkOn[n] = this.attackT;
      if (low >= 0 && !(ex && expected.has(low))) continue; // הרמוניה של תו אחר — לא מדווחים עליה
      // חותמת זמן של רגע ההקשה: הנקישה האחרונה סמוך לתחילת העלייה, ואם לא נמצאה — הערכה
      let best = -1e9;
      for (let k = 0; k < 8; k++) { const ak = this.atk[k]; if (ak >= r0 - 150 && ak <= r0 + 15 && ak > best) best = ak; }
      const t0 = best > -1e8 ? best : r0 - 45;
      this.on[n] = 1; this.emitT[n] = t;
      if (this.dbg && ex) { // נתוני פיתוח: מאפייני הזיהוי, לכיוונון מול הקלטות אמיתיות
        let sp = 0; for (let i = 0; i < np; i++) sp += pa[i];
        const a1 = A1[n], hs = a1 + A[2][n] + A[3][n] + A[4][n] + A[5][n];
        this.dbg({ n, t, fast: 0, a1max: a1 / maxAmp, a2a1: a1 ? A[2][n] / a1 : 9, a3a1: a1 ? A[3][n] / a1 : 9, cnt: cntA[n], strict: strict[n], dev: Math.abs(this.dev[n]), dr: this.dHi[n] - this.dLo[n],
          seen: this.seen[n], since: t - this.since[n], fE: fullE[n] / maxE, lvl: this.level, atk: Math.min(999, t - this.attackT), voice: a1 ? +this.voiceLike(F[n] * tuneR * Math.pow(2, this.dev[n] / 1200), a1) : 0, np, expl: hs / sp, maxAmp, explAll: this.explAll, quiet: +this.quiet });
      }
      events.push({ type: 'on', midi: n, ghost: low >= 0, t0: t0 });
      // עוצמת הנגינה הרגילה: נלמדת מתווים צפויים שזוהו בבירור (עולה מהר, יורדת לאט)
      if (ex && strict[n] && low < 0) this.ref = this.ref ? this.ref + (this.level > this.ref ? 0.3 : this.quiet ? 0.2 : 0.08) * (this.level - this.ref) : this.level;
      // כיוון עדין: לומדים בהדרגה כמה הכלי גבוה/נמוך מהכיוון התקני
      if (ex && strict[n] && cntA[n] >= 3 && Math.abs(this.dev[n]) < 25) {
        this.tune = Math.max(-40, Math.min(40, this.tune + 0.04 * this.dev[n])); this.tuneR = Math.pow(2, this.tune / 1200);
      }
    }
    return events;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Detector; else root.Detector = Detector;
})(typeof self !== 'undefined' ? self : this);

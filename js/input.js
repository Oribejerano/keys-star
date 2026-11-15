// קלט נגינה: מיקרופון (זיהוי תווים), MIDI ומגע. כל המקורות משדרים אירועי {type:'on'|'off', midi, src, ghost}
const Input = (() => {
  const subs = new Set();
  const held = new Map(); // midi -> {src, ghost}
  const on = fn => subs.add(fn);
  // t0 = רגע ההקשה האמיתי (בשעון performance.now), כשהוא ידוע
  function emit(type, midi, src, ghost = false, t0, ta) {
    if (type === 'on') held.set(midi, { src, ghost }); else held.delete(midi);
    for (const fn of subs) fn({ type, midi, src, ghost, t0, ta });
  }
  const heldNotes = () => [...held].map(([midi, v]) => ({ midi, ...v }));

  // ---- מגע ----
  function touch(midi, down) {
    // כשהמיקרופון מקשיב, רק הפסנתר האמיתי נחשב: המקלדת שעל המסך לא מנגנת ולא מקדמת
    if (mic.on) return;
    if (down) { Snd.unlock(); Snd.note(midi, 0.6, 0.75); emit('on', midi, 'touch'); }
    else emit('off', midi, 'touch');
  }

  // ---- MIDI ----
  const midi = { ok: false, devices: [] };
  function initMIDI() {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(acc => {
      const hook = () => {
        midi.devices = [];
        acc.inputs.forEach(inp => {
          midi.devices.push(inp.name);
          inp.onmidimessage = e => {
            const [s, a, b] = e.data, hi = s & 0xf0;
            if (hi === 0x90 && b > 0) emit('on', a, 'midi');
            else if (hi === 0x80 || (hi === 0x90 && b === 0)) emit('off', a, 'midi');
          };
        });
        midi.ok = midi.devices.length > 0;
      };
      hook(); acc.onstatechange = hook;
    }).catch(() => {});
  }

  // ---- מיקרופון ---- (הזיהוי עצמו ב-detector.js)
  let an = null, td = null, det = null, stream = null, srcNode = null, timer = 0, expected = null;
  let lastCtx = 0, slowEvery = 2, lastFull = -1e9, procAvg = 0; // ניתוח מהיר לכל 5 אלפיות שנייה של צליל; ניתוח מלא כל 10 (במכשיר איטי: 20)
  const mic = { on: false, level: 0, peak: 0, notes: [], error: '', tune: 0 };

  async function startMic(testNode) {
    if (mic.on) return true;
    const ac = Snd.ctx(); Snd.unlock();
    try {
      if (testNode) srcNode = testNode;
      else {
        // בלי עיבודי "שיחת טלפון" (ביטול הד, הנמכת רעש, הגבר אוטומטי) — הם מעוותים צלילי פסנתר
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1, latency: { ideal: 0 } } });
        srcNode = ac.createMediaStreamSource(stream);
      }
    } catch (e) { mic.error = 'אין גישה למיקרופון'; return false; }
    det = new Detector(ac.sampleRate, { tune: CFG.tune || 0, ref: CFG.ref || 0 });
    // חלון כפול: כך אפשר לנתח גם את הקטעים שהגיעו בזמן שהטיימר איחר (מכשיר איטי) — כל 5 אלפיות שנייה של צליל נבדקות
    an = ac.createAnalyser(); an.fftSize = det.N * 2; an.smoothingTimeConstant = 0;
    srcNode.connect(an);
    td = new Float32Array(det.N * 2);
    mic.on = true; mic.error = ''; lastCtx = ac.currentTime; procAvg = 0; lastFull = -1e9;
    timer = setInterval(tick, 5);
    return true;
  }
  function stopMic() {
    syncTune();
    mic.on = false; clearInterval(timer);
    try { srcNode && srcNode.disconnect(an); } catch (e) { /* כבר מנותק */ }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; srcNode = null; mic.notes = []; mic.level = 0;
    for (const [m, v] of [...held]) if (v.src === 'mic') emit('off', m, 'mic');
  }
  function tick() {
    if (!mic.on) return;
    const ac = Snd.ctx(), p0 = performance.now(), ct = ac.currentTime;
    const fresh = Math.round((ct - lastCtx) * ac.sampleRate);
    if (fresh <= 0) return; // שעון השמע עוד לא התקדם
    lastCtx = ct;
    an.getFloatTimeDomainData(td);
    // המנוע עובד בשעון השמע (מדויק לדגימה); חותמות הזמן מומרות לשעון של המשחק
    const off = p0 - ct * 1000, N = det.N, L = td.length, sr = ac.sampleRate, H = Math.round(sr * 0.005), fullMs = slowEvery * 5 - 0.5;
    // הצליל החדש מנותח בפרוסות של 5 אלפיות שנייה, גם אם הטיימר התעורר באיחור — כדי שאף הקשה לא "תיפול בין הכיסאות"
    let e = L - Math.min(fresh, N), didFull = false;
    for (;;) {
      const rem = L - e, step = rem > 1.5 * H ? H : rem; e += step;
      const tMs = ct * 1000 - (L - e) / sr * 1000, full = tMs - lastFull >= fullMs;
      if (full) { lastFull = tMs; didFull = true; }
      const evs = det.process(td.subarray(e - N, e), tMs, expected, step, !full);
      if (det.peak > mic.peak) mic.peak = det.peak;
      for (const ev of evs) emit(ev.type, ev.midi, 'mic', !!ev.ghost, ev.t0 != null ? ev.t0 + off : undefined, ev.t0);
      if (e >= L) break;
    }
    if (!didFull) return;
    mic.level = det.level; mic.notes = det.present; mic.tune = det.tune;
    // מכשיר איטי: ניתוח מלא כל 20 אלפיות שנייה במקום 10
    procAvg = procAvg * 0.95 + (performance.now() - p0) * 0.05;
    if (slowEvery === 2 && procAvg > 5) slowEvery = 4;
  }
  // המשחק מודיע לאילו תווים הוא מצפה עכשיו; הם מזוהים בסף רגיש יותר
  let expKey = '', expHook = null;
  function setExpected(list) {
    expected = list && list.length ? new Set(list) : null;
    if (expHook) { const k = expected ? [...expected].sort((a, b) => a - b).join(',') : ''; if (k !== expKey) { expKey = k; expHook(expected ? [...expected] : []); } }
  }
  // מאזין לשינויים ברשימת התווים הצפויים (להקלטת נגינה לכיוונון)
  function onExpected(fn) { expHook = fn; expKey = '\u0000'; }
  // שומר את כיוון הכלי שנלמד, כדי שבפעם הבאה ההאזנה תתחיל כבר מכוונת
  function syncTune() {
    if (!det) return;
    let ch = false;
    if (Math.abs((CFG.tune || 0) - det.tune) > 0.5) { CFG.tune = Math.round(det.tune * 10) / 10; ch = true; }
    // עוצמת הנגינה הרגילה שנלמדה (לפיה מבדילים בין נגינה לדיבור) — נשמרת, כדי שההגנה תפעל כבר מהתו הראשון
    if (det.ref > 0 && Math.abs((CFG.ref || 0) - det.ref) > 0.1 * det.ref) { CFG.ref = Math.round(det.ref * 1000) / 1000; ch = true; }
    if (ch) Store.save();
  }
  // לומדים מחדש את עוצמת הנגינה (בבדיקת ההאזנה, או כשמזיזים את המכשיר)
  function resetRef() { CFG.ref = 0; if (det) det.ref = 0; Store.save(); }

  // מקליט את האות הגולמי מהמיקרופון (להקלטות הכיוונון). t0 = הרגע (בשעון performance.now) של הדגימה הראשונה
  function startRec(maxSec) {
    if (!mic.on || !srcNode) return null;
    const ac = Snd.ctx(), sp = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(), chunks = [];
    const max = Math.round(maxSec * ac.sampleRate); let n = 0, t0 = 0, t0a = 0, done = false;
    mute.gain.value = 0;
    sp.onaudioprocess = e => {
      if (done) return;
      const d = e.inputBuffer.getChannelData(0);
      if (!t0) { t0 = performance.now() - d.length / ac.sampleRate * 1000; t0a = (ac.currentTime - d.length / ac.sampleRate) * 1000; }
      if (n < max) { chunks.push(new Float32Array(d)); n += d.length; }
    };
    srcNode.connect(sp); sp.connect(mute); mute.connect(ac.destination);
    return {
      get t0() { return t0; }, get t0a() { return t0a; }, get sec() { return n / ac.sampleRate; },
      stop() {
        done = true; sp.onaudioprocess = null;
        try { srcNode && srcNode.disconnect(sp); sp.disconnect(); mute.disconnect(); } catch (err) { /* כבר מנותק */ }
        const pcm = new Int16Array(n); let o = 0;
        for (const c of chunks) for (let i = 0; i < c.length; i++) pcm[o++] = Math.max(-1, Math.min(1, c[i])) * 32767;
        return { pcm, sr: ac.sampleRate };
      },
    };
  }
  // נתוני המיקרופון והמנוע, לצירוף להקלטות הכיוונון
  function micInfo() {
    const ac = Snd.ctx(), tr = stream && stream.getAudioTracks()[0], ts = tr && tr.getSettings ? tr.getSettings() : {};
    return {
      sr: ac.sampleRate, baseLatency: ac.baseLatency, outputLatency: ac.outputLatency, N: det ? det.N : 0, tune: det ? det.tune : 0, ref: det ? det.ref : 0, slowEvery,
      mic: tr ? tr.label : '', ec: ts.echoCancellation, ns: ts.noiseSuppression, agc: ts.autoGainControl, ch: ts.channelCount, micLatency: ts.latency,
    };
  }

  return { on, emit, touch, heldNotes, initMIDI, midi, startMic, stopMic, setExpected, syncTune, resetRef, startRec, micInfo, onExpected, get expected() { return expected ? [...expected] : []; }, mic, get micOn() { return mic.on; } };
})();

// קלט נגינה: מיקרופון (זיהוי תווים), MIDI ומגע. כל המקורות משדרים אירועי {type:'on'|'off', midi, src, ghost}
const Input = (() => {
  const subs = new Set();
  const held = new Map(); // midi -> {src, ghost}
  const on = fn => subs.add(fn);
  // t0 = רגע ההקשה האמיתי (בשעון performance.now), כשהוא ידוע
  function emit(type, midi, src, ghost = false, t0) {
    if (type === 'on') held.set(midi, { src, ghost }); else held.delete(midi);
    for (const fn of subs) fn({ type, midi, src, ghost, t0 });
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
  let lastCtx = 0, slowEvery = 2, tickN = 0, procAvg = 0; // דופק כל 5 אלפיות שנייה; ניתוח מלא כל דופק שני
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
    det = new Detector(ac.sampleRate, { tune: CFG.tune || 0 });
    an = ac.createAnalyser(); an.fftSize = det.N; an.smoothingTimeConstant = 0;
    srcNode.connect(an);
    td = new Float32Array(det.N);
    mic.on = true; mic.error = ''; lastCtx = ac.currentTime; procAvg = 0; tickN = 0;
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
    const off = p0 - ct * 1000;
    // בין ניתוח מלא לניתוח מלא רץ רק המסלול המהיר (נקישות + תווים צפויים) — כדי להגיב תוך אלפיות שנייה
    const fastOnly = (tickN++ % slowEvery) !== 0;
    const evs = det.process(td, ct * 1000, expected, fresh, fastOnly);
    if (det.peak > mic.peak) mic.peak = det.peak;
    for (const e of evs) emit(e.type, e.midi, 'mic', !!e.ghost, e.t0 != null ? e.t0 + off : undefined);
    if (fastOnly) return;
    mic.level = det.level; mic.notes = det.present; mic.tune = det.tune;
    // מכשיר איטי: ניתוח מלא כל 20 אלפיות שנייה במקום 10
    procAvg = procAvg * 0.95 + (performance.now() - p0) * 0.05;
    if (slowEvery === 2 && procAvg > 5) slowEvery = 4;
  }
  // המשחק מודיע לאילו תווים הוא מצפה עכשיו; הם מזוהים בסף רגיש יותר
  function setExpected(list) { expected = list && list.length ? new Set(list) : null; }
  // שומר את כיוון הכלי שנלמד, כדי שבפעם הבאה ההאזנה תתחיל כבר מכוונת
  function syncTune() { if (det && Math.abs((CFG.tune || 0) - det.tune) > 0.5) { CFG.tune = Math.round(det.tune * 10) / 10; Store.save(); } }

  // מקליט דוגמה גולמית מהמיקרופון (לכיוונון המנוע מול האורגנית האמיתית) ומחזיר קובץ WAV
  function recordSample(sec, onProgress) {
    return new Promise((resolve, reject) => {
      if (!mic.on || !srcNode) return reject(new Error('המיקרופון כבוי'));
      const ac = Snd.ctx(), sp = ac.createScriptProcessor(4096, 1, 1), mute = ac.createGain(), chunks = [];
      const total = Math.round(sec * ac.sampleRate); let n = 0;
      mute.gain.value = 0;
      sp.onaudioprocess = e => {
        const d = e.inputBuffer.getChannelData(0); chunks.push(new Float32Array(d)); n += d.length;
        if (onProgress) onProgress(Math.min(1, n / total));
        if (n < total) return;
        sp.onaudioprocess = null; try { srcNode.disconnect(sp); sp.disconnect(); mute.disconnect(); } catch (err) { /* כבר מנותק */ }
        const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, ac.sampleRate, true); v.setUint32(28, ac.sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        let o = 44; for (const c of chunks) for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 32767, true);
        resolve(new Blob([buf], { type: 'audio/wav' }));
      };
      srcNode.connect(sp); sp.connect(mute); mute.connect(ac.destination);
    });
  }

  return { on, emit, touch, heldNotes, initMIDI, midi, startMic, stopMic, setExpected, syncTune, recordSample, mic, get micOn() { return mic.on; } };
})();

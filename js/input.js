// קלט נגינה: מיקרופון (זיהוי תווים), MIDI ומגע. כל המקורות משדרים אירועי {type:'on'|'off', midi, src, ghost}
const Input = (() => {
  const subs = new Set();
  const held = new Map(); // midi -> {src, ghost}
  const on = fn => subs.add(fn);
  function emit(type, midi, src, ghost = false) {
    if (type === 'on') held.set(midi, { src, ghost }); else held.delete(midi);
    for (const fn of subs) fn({ type, midi, src, ghost });
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
  const mic = { on: false, level: 0, notes: [], error: '' };

  async function startMic(testNode) {
    if (mic.on) return true;
    const ac = Snd.ctx(); Snd.unlock();
    try {
      if (testNode) srcNode = testNode;
      else {
        // בלי עיבודי "שיחת טלפון" (ביטול הד, הנמכת רעש, הגבר אוטומטי) — הם מעוותים צלילי פסנתר
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
        srcNode = ac.createMediaStreamSource(stream);
      }
    } catch (e) { mic.error = 'אין גישה למיקרופון'; return false; }
    det = new Detector(ac.sampleRate);
    an = ac.createAnalyser(); an.fftSize = det.N; an.smoothingTimeConstant = 0;
    srcNode.connect(an);
    td = new Float32Array(det.N);
    mic.on = true; mic.error = '';
    timer = setInterval(tick, 20);
    return true;
  }
  function stopMic() {
    mic.on = false; clearInterval(timer);
    try { srcNode && srcNode.disconnect(an); } catch (e) { /* כבר מנותק */ }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; srcNode = null; mic.notes = []; mic.level = 0;
    for (const [m, v] of [...held]) if (v.src === 'mic') emit('off', m, 'mic');
  }
  function tick() {
    if (!mic.on) return;
    an.getFloatTimeDomainData(td);
    const evs = det.process(td, performance.now(), expected);
    mic.level = det.level; mic.notes = det.present;
    for (const e of evs) emit(e.type, e.midi, 'mic', !!e.ghost);
  }
  // המשחק מודיע לאילו תווים הוא מצפה עכשיו; הם מזוהים בסף רגיש יותר
  function setExpected(list) { expected = list && list.length ? new Set(list) : null; }

  return { on, emit, touch, heldNotes, initMIDI, midi, startMic, stopMic, setExpected, mic, get micOn() { return mic.on; } };
})();

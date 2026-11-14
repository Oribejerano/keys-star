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

  // ---- מיקרופון ----
  const LO = 36, HI = 96, HN = 5;
  const F = new Float32Array(130); for (let n = 0; n < 130; n++) F[n] = 440 * Math.pow(2, (n - 69) / 12);
  const E = new Float32Array(130), H1 = new Float32Array(130), H2 = new Float32Array(130);
  const hist = new Float32Array(130 * HN), lastOn = new Float64Array(130), gone = new Uint8Array(130), seen = new Uint8Array(130), pend = new Uint8Array(130), since = new Float64Array(130);
  let an = null, db = null, td = null, mag = null, stream = null, srcNode = null, raf = 0, hi = 0;
  let rmsSlow = 0, attackT = -1e9;
  const mic = { on: false, level: 0, notes: [], error: '' };

  async function startMic(testNode) {
    if (mic.on) return true;
    const ac = Snd.ctx(); Snd.unlock();
    try {
      if (testNode) srcNode = testNode;
      else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        srcNode = ac.createMediaStreamSource(stream);
      }
    } catch (e) { mic.error = 'אין גישה למיקרופון'; return false; }
    an = ac.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0;
    srcNode.connect(an);
    db = new Float32Array(an.frequencyBinCount); td = new Float32Array(an.fftSize); mag = new Float32Array(an.frequencyBinCount);
    hist.fill(0); lastOn.fill(-1e9); gone.fill(0);
    mic.on = true; mic.error = '';
    raf = setInterval(() => { if (mic.on) analyze(performance.now()); }, 16);
    return true;
  }
  function stopMic() {
    mic.on = false; clearInterval(raf);
    try { srcNode && srcNode.disconnect(an); } catch (e) { /* כבר מנותק */ }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; srcNode = null; mic.notes = []; mic.level = 0;
    for (const [m, v] of [...held]) if (v.src === 'mic') emit('off', m, 'mic');
  }

  function analyze(now) {
    const ac = Snd.ctx();
    an.getFloatTimeDomainData(td);
    let s = 0; for (let i = td.length - 1024; i < td.length; i++) s += td[i] * td[i];
    const rms = Math.sqrt(s / 1024); mic.level = rms;
    if (rms > 1.6 * rmsSlow && rms > 0.004) attackT = now;
    rmsSlow = rmsSlow * 0.85 + rms * 0.15;

    an.getFloatFrequencyData(db);
    const res = ac.sampleRate / an.fftSize, maxBin = Math.min(db.length - 1, Math.ceil(7000 / res));
    let sum = 0, cnt = 0;
    for (let i = 0; i <= maxBin; i++) { const v = Math.pow(10, db[i] / 20); mag[i] = v; if (i * res > 80) { sum += v; cnt++; } }
    const mean = sum / cnt;
    const pk = f => {
      const b = f / res, lo = Math.round(b * 0.975), up = Math.min(maxBin, Math.round(b * 1.025));
      let m = 0; for (let i = lo; i <= up; i++) if (mag[i] > m) m = mag[i];
      return m;
    };
    let maxE = 0;
    for (let n = LO - 1; n <= HI + 1; n++) {
      const f = F[n], h1 = pk(f), h2 = pk(2 * f), h3 = pk(3 * f);
      H1[n] = h1; H2[n] = h2; E[n] = h1 + 0.7 * h2 + 0.5 * h3;
      if (E[n] > maxE) maxE = E[n];
    }
    const thr = Math.max(mean * 10, Math.pow(10, (-75 + (100 - CFG.sens) * 0.4) / 20));
    const present = [];
    for (let n = LO; n <= HI; n++) {
      const e = E[n];
      const ok = e > thr && e >= 0.18 * maxE && H1[n] > mean * 5 && H1[n] >= 0.1 * H2[n] &&
        H1[n] >= H1[n - 1] && H1[n] >= H1[n + 1] && e >= E[n - 1] && e >= E[n + 1];
      if (ok) {
        let ghost = false;
        for (const p of present) { const d = n - p; if ((d === 12 || d === 19 || d === 24 || d === 28 || d === 31) && H1[p] >= 0.25 * H1[n]) { ghost = true; break; } }
        present.push(n); gone[n] = 0;
        let mn = Infinity; for (let k = 0; k < HN; k++) mn = Math.min(mn, hist[n * HN + k]);
        const fresh = now - lastOn[n] > 220;
        const attack = now - attackT < 140 && lastOn[n] < attackT - 30;
        if (fresh && (e > 1.45 * mn + thr * 0.2 || (attack && e > 1.2 * mn))) pend[n] = 1;
        // תו נחשב רק אחרי שהוא יציב כ-40 אלפיות שנייה — מסנן רעשי התקפה וקפיצות בין תווים שכנים
        if (!seen[n]) since[n] = now;
        if ((seen[n] = Math.min(200, seen[n] + 1)) >= 2 && now - since[n] >= 40 && pend[n]) { pend[n] = 0; lastOn[n] = now; emit('on', n, 'mic', ghost); }
        else if (held.has(n) && held.get(n).src === 'mic') held.get(n).ghost = ghost;
      } else {
        seen[n] = 0; pend[n] = 0;
        if (held.has(n) && held.get(n).src === 'mic' && ++gone[n] > 4) emit('off', n, 'mic');
      }
      hist[n * HN + hi] = e;
    }
    hi = (hi + 1) % HN;
    mic.notes = present;
  }

  return { on, emit, touch, heldNotes, initMIDI, midi, startMic, stopMic, mic, get micOn() { return mic.on; } };
})();

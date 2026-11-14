// סאונד: סינתיסייזר פסנתר פשוט + מטרונום
const Snd = (() => {
  let ac = null, master = null, noiseBuf = null;
  function ctx() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = 0.55;
      const comp = ac.createDynamicsCompressor();
      master.connect(comp); comp.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.04), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    }
    return ac;
  }
  function unlock() { ctx(); if (ac.state !== 'running') ac.resume(); }
  function note(midi, dur = 0.5, vel = 0.7, dest) {
    const a = ctx(), t = a.currentTime, f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = Math.min(9000, f * 6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.008);
    g.gain.setTargetAtTime(vel * 0.12, t + 0.01, Math.max(0.25, dur * 0.7));
    g.gain.setTargetAtTime(0, t + dur, 0.09);
    const parts = [['triangle', 1, 1], ['sine', 2, 0.28], ['sine', 3, 0.1]];
    for (const [type, mult, gain] of parts) {
      const o = a.createOscillator(), og = a.createGain();
      o.type = type; o.frequency.value = f * mult; og.gain.value = gain;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.7);
    }
    lp.connect(g); g.connect(dest || master);
  }
  function click(accent) {
    const a = ctx(), s = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; hp.type = 'highpass'; hp.frequency.value = accent ? 5000 : 3500;
    g.gain.value = accent ? 0.9 : 0.5;
    s.connect(hp); hp.connect(g); g.connect(master); s.start();
  }
  function chime(ok) {
    const seq = ok ? [72, 76, 79, 84] : [64, 60];
    seq.forEach((m, i) => setTimeout(() => note(m, 0.25, 0.5), i * 90));
  }
  return { ctx, unlock, note, click, chime };
})();

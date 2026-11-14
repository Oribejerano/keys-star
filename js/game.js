// מנוע המשחק: תווים נופלים, מצב לימוד (מחכה), מצב נגינה בקצב, והאזנה
const Game = (() => {
  const $ = id => document.getElementById(id);
  const COL = { R: '#38bdf8', L: '#fb923c' };
  const WIN = 0.32, GOOD = 0.2;
  let cv, ctx, W = 0, H = 0, dpr = 1, kb = null, song, B, opts = {}, notes = [];
  let t = 0, spb = 0.5, last = 0, raf = 0, running = false, paused = false, endAt = 0;
  let range = [0, 0], mode = 'play', st, combo = 0, score = 0, p0 = 0, clickIdx = 0;
  let waiting = false, stepWrong = false, msgUntil = 0;
  const flashes = new Map(), lastHit = new Map(); let pops = [];
  const hudCache = {};
  let stepAt = -1, stepSize = 0, loM = 0, hiM = 127;
  let rec = [], recT0 = 0; const recOn = new Map();

  // הקלטה: מחזיר את מה שנוגן כרשימת תווים (פעימה = חצי שנייה, 120 פעימות לדקה)
  function recorded() {
    const now = performance.now();
    for (const [m, s] of recOn) rec.push([m, s, now]);
    recOn.clear();
    return rec.map(([m, s, e]) => [m, Math.round((s - recT0) / 500 * 100) / 100, Math.max(0.2, Math.round((e - s) / 500 * 100) / 100), m >= 60 ? 'R' : 'L'])
      .sort((a, b) => a[1] - b[1]);
  }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    addEventListener('resize', () => { if (running) resize(); });
    bindKeys(cv, () => (running ? kb : null));
    Input.on(onInput);
  }
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  const nm = m => Music.name(m, CFG.names === 'letters' ? 'letters' : 'sol');
  const setHud = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; const el = $(id); if (el) el.textContent = v; } };

  function start(s, o) {
    stop();
    song = s; opts = Object.assign({ mode: 'play', arr: 'rh', tempo: 1 }, o); mode = opts.mode;
    const backing = CFG.backing && !Input.micOn;
    B = Music.build(song, opts.arr);
    range = opts.range || [0, B.total];
    notes = B.notes
      .filter(n => n.start >= range[0] - 1e-6 && n.start < range[1] - 1e-6 && (n.mine || mode === 'listen' || backing))
      .map(n => Object.assign({}, n, { state: 0, mine: mode === 'listen' ? false : n.mine }));
    let lo = 127, hi = 0;
    for (const n of notes) { lo = Math.min(lo, n.midi); hi = Math.max(hi, n.midi); }
    if (lo > hi) { lo = 60; hi = 72; }
    if (hi - lo < 14) hi = lo + 14;
    if (mode === 'record') { lo = 48; hi = 83; rec = []; recOn.clear(); recT0 = 0; }
    kb = new KB(lo, hi);
    loM = 127; hiM = 0; stepAt = -1;
    for (const n of notes) if (n.mine) { loM = Math.min(loM, n.midi); hiM = Math.max(hiM, n.midi); }
    spb = 60 / (song.bpm * opts.tempo);
    const lead = mode === 'play' ? (B.beats >= 3 ? B.beats : B.beats * 2) : 1.5;
    t = range[0] - lead; clickIdx = Math.floor(t - B.pickup + 1e-6);
    endAt = range[0];
    for (const n of notes) endAt = Math.max(endAt, n.start + Math.min(n.dur, 2));
    endAt += 0.5;
    st = { perfect: 0, good: 0, ok: 0, miss: 0, wrong: 0, maxCombo: 0, barErr: {} };
    combo = 0; score = 0; p0 = 0; waiting = false; stepWrong = false; pops = []; flashes.clear(); lastHit.clear();
    for (const k in hudCache) delete hudCache[k];
    setHud('hudBanner', opts.banner || ''); setHud('hudMsg', ''); $('hudMsg').classList.remove('on');
    running = true; paused = false; resize(); last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function pause(p) { paused = p === undefined ? !paused : p; return paused; }
  function setTempo(m) { opts.tempo = m; spb = 60 / (song.bpm * m); }

  function frame(ts) {
    if (!running) return;
    const dt = Math.min(0.12, (ts - last) / 1000); last = ts;
    if (!paused) step(dt);
    if (running) { draw(); raf = requestAnimationFrame(frame); }
  }

  function nextMine() { for (let i = p0; i < notes.length; i++) if (notes[i].mine && !notes[i].state) return notes[i]; return null; }
  function barOf(beat) { return Math.max(0, Math.floor((beat - B.pickup + 1e-6) / B.beats)); }
  function barErr(beat) { const b = barOf(beat); st.barErr[b] = (st.barErr[b] || 0) + 1; }
  function flash(m, color, sec) { flashes.set(m, { color, until: performance.now() + sec * 1000 }); }
  function pop(text, m, color) { const r = kb.rect(m); pops.push({ text, x: r.x + r.w / 2, color, born: performance.now() }); if (pops.length > 12) pops.shift(); }
  const lat = () => (Input.micOn ? CFG.latency / 1000 / spb : 0);

  function step(dt) {
    let nt = t + dt / spb;
    if (mode === 'wait') {
      const nx = nextMine();
      if (nx && nt >= nx.start) { nt = nx.start; waiting = true; }
    }
    const ci = Math.floor(nt - B.pickup + 1e-6);
    if (ci > clickIdx) {
      clickIdx = ci;
      if ((mode === 'play' && nt < range[0]) || (CFG.metro && mode !== 'wait')) Snd.click(((ci % B.beats) + B.beats) % B.beats === 0);
    }
    const tj = nt - lat();
    for (let i = p0; i < notes.length; i++) {
      const n = notes[i];
      if (n.start > nt + 1e-6) break;
      if (n.state) continue;
      if (!n.mine) {
        n.state = 1;
        Snd.note(n.midi, Math.min(2.5, n.dur * spb), n.hand === 'L' ? 0.4 : 0.7);
        flash(n.midi, COL[n.hand], Math.min(0.5, n.dur * spb));
      } else if (mode === 'play' && n.start < tj - WIN / spb) {
        n.state = 2; st.miss++; combo = 0; barErr(n.start); pop('פספוס', n.midi, '#f87171');
      }
    }
    while (p0 < notes.length && notes[p0].state) p0++;
    t = nt;
    if (mode !== 'record' && p0 >= notes.length && t >= endAt) finish();
  }

  function onInput(e) {
    if (running && mode === 'record') {
      if (e.ghost) return;
      const now = performance.now();
      if (e.type === 'on') { if (!recT0) recT0 = now; recOn.set(e.midi, now); flash(e.midi, COL[e.midi >= 60 ? 'R' : 'L'], 0.2); }
      else if (recOn.has(e.midi)) { rec.push([e.midi, recOn.get(e.midi), now]); recOn.delete(e.midi); }
      return;
    }
    if (!running || paused || e.type !== 'on' || mode === 'listen') return;
    if (mode === 'wait') {
      const nx = nextMine(); if (!nx) return;
      if ((nx.start - t) * spb > 0.6) return;
      const stepN = [];
      for (let i = p0; i < notes.length && notes[i].start <= nx.start + 0.06; i++) if (notes[i].mine && !notes[i].state) stepN.push(notes[i]);
      const h = stepN.find(n => n.midi === e.midi);
      if (nx.start !== stepAt) { stepAt = nx.start; stepSize = stepN.length; }
      if (h) {
        doHit(h, stepWrong ? 'ok' : 'perfect');
        let left = stepN.filter(n => n !== h);
        // במיקרופון קשה לשמוע כל צליל באקורד — אם חסר רק אחד מתוך 3+, מקבלים את האקורד
        if (e.src === 'mic' && stepSize >= 3 && left.length === 1) { doHit(left[0], 'perfect'); left = []; }
        if (!left.length) { waiting = false; stepWrong = false; }
      }
      else wrongNote(e, stepN);
      return;
    }
    if (t < range[0] - 0.6) return;
    const tj = t - lat(); let best = null, bd = 1e9, near = null;
    for (let i = p0; i < notes.length; i++) {
      const n = notes[i];
      if (!n.mine || n.state) continue;
      if (!near) near = n;
      if (n.start > tj + WIN / spb) break;
      if (n.midi !== e.midi) continue;
      const d = Math.abs(n.start - tj); if (d < bd) { bd = d; best = n; }
    }
    if (best && bd * spb <= WIN) {
      const ds = bd * spb, perf = Input.micOn ? 0.13 : 0.09;
      doHit(best, ds <= perf ? 'perfect' : ds <= GOOD ? 'good' : 'ok');
    } else wrongNote(e, near && (near.start - tj) * spb < 1.2 ? [near] : null);
  }

  function doHit(n, j) {
    n.state = 1; n.judge = j; st[j]++; combo++; st.maxCombo = Math.max(st.maxCombo, combo);
    score += { perfect: 100, good: 70, ok: 40 }[j] * (1 + Math.min(1, Math.floor(combo / 10) * 0.1));
    lastHit.set(n.midi, performance.now());
    flash(n.midi, '#4ade80', 0.25);
    pop(mode === 'wait' ? '✓' : { perfect: 'מושלם!', good: 'טוב!', ok: 'בסדר' }[j], n.midi, j === 'ok' ? '#fbbf24' : '#4ade80');
  }
  function wrongNote(e, expected) {
    if (e.ghost) return;
    if (e.src === 'mic' && (e.midi < loM - 2 || e.midi > hiM + 2)) return;
    const lh = lastHit.get(e.midi);
    if (e.src === 'mic' && lh && performance.now() - lh < 1500) return;
    st.wrong++; combo = 0; stepWrong = true; flash(e.midi, '#f87171', 0.35); barErr(Math.max(range[0], t));
    if (expected && expected.length) {
      const want = [...new Set(expected.map(n => nm(n.midi)))].join(' + ');
      setHud('hudMsg', `ניגנת ${nm(e.midi)} · צריך ${want}`);
      $('hudMsg').classList.add('on'); msgUntil = performance.now() + 1800;
    }
  }

  function finish() {
    stop();
    const total = notes.filter(n => n.mine).length || 1;
    const w = st.perfect + st.good * 0.8 + st.ok * 0.5;
    const acc = mode === 'listen' ? 1 : Math.max(0, Math.min(1, (w - 0.25 * st.wrong) / total));
    const stars = mode === 'listen' ? 0 : acc >= 0.93 ? 3 : acc >= 0.8 ? 2 : acc >= 0.6 ? 1 : 0;
    if (opts.onFinish) opts.onFinish(Object.assign({}, st, { total, acc, stars, score: Math.round(score), mode, bars: B.bars, beats: B.beats, pickup: B.pickup }));
  }

  // ---------- ציור ----------
  function draw() {
    const now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const kbH = Math.max(84, Math.min(H * 0.25, 190));
    const staffH = CFG.staff && H > 430 ? Math.min(150, H * 0.24) : 0;
    const hitY = H - kbH, top = staffH;
    kb.layout(0, hitY, W, kbH);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1023'); g.addColorStop(1, '#141c3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const ppb = (hitY - top) / (3.2 / spb);

    ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, hitY - top); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    for (const m of kb.whites) if (m % 12 === 0 || m % 12 === 5) { const x = kb.rect(m).x; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, hitY); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.font = '12px Rubik, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (let k = Math.max(0, barOf(t)); ; k++) {
      const beat = B.pickup + k * B.beats, y = hitY - (beat - t) * ppb;
      if (y < top || beat > range[1] + 1e-6) break;
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      if (beat < range[1] - 1e-6) ctx.fillText(String(k + 1), 6, y - 4);
    }
    const style = CFG.names === 'letters' ? 'letters' : 'sol';
    ctx.textAlign = 'center';
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], yb = hitY - (n.start - t) * ppb;
      if (yb < top - 4) break;
      const hgt = Math.max(14, n.dur * ppb - 3), yt = yb - hgt;
      if (yt > hitY) continue;
      const r = kb.rect(n.midi), pad = r.black ? 0 : Math.min(4, r.w * 0.1);
      let c = COL[n.hand];
      if (n.mine && n.state === 1) c = '#4ade80'; else if (n.state === 2) c = '#64748b';
      ctx.globalAlpha = n.mine || mode === 'listen' ? 1 : 0.4;
      ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = n.mine && !n.state ? 10 : 0;
      rrect(ctx, r.x + pad, yt, r.w - pad * 2, hgt, 6); ctx.fill();
      ctx.shadowBlur = 0;
      if (r.w >= 20 && hgt >= 16) {
        ctx.fillStyle = '#0b1023'; ctx.font = `700 ${Math.max(9, Math.min(14, r.w * 0.36))}px Rubik, sans-serif`;
        ctx.fillText(Music.name(n.midi, style), r.x + r.w / 2, yb - 6);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // קו הפגיעה + מקלדת
    ctx.fillStyle = waiting ? '#fbbf24' : '#a78bfa'; ctx.fillRect(0, hitY - 3, W, 3);
    let hint = null;
    if (mode === 'wait' && waiting) { const nx = nextMine(); if (nx) { hint = new Map(); for (let i = p0; i < notes.length && notes[i].start <= nx.start + 0.06; i++) if (notes[i].mine && !notes[i].state) hint.set(notes[i].midi, notes[i].hand); } }
    const heldSet = new Map(Input.heldNotes().map(h => [h.midi, h]));
    kb.draw(ctx, m => {
      const f = flashes.get(m);
      if (f) { if (f.until > now) return f.color; flashes.delete(m); }
      if (heldSet.has(m) && !heldSet.get(m).ghost) return '#c4b5fd';
      if (hint && hint.has(m)) return hint.get(m) === 'L' ? '#fed7aa' : '#bae6fd';
      return null;
    });

    // הודעות קופצות
    ctx.textAlign = 'center'; ctx.font = '700 18px Rubik, sans-serif';
    pops = pops.filter(p => now - p.born < 700);
    for (const p of pops) { const a = (now - p.born) / 700; ctx.globalAlpha = 1 - a; ctx.fillStyle = p.color; ctx.fillText(p.text, Math.max(40, Math.min(W - 40, p.x)), hitY - 16 - a * 40); }
    ctx.globalAlpha = 1;

    if (staffH) drawStaff(0, 0, W, staffH);

    if (mode === 'record') {
      ctx.textAlign = 'center'; ctx.fillStyle = '#f87171'; ctx.font = '800 34px Rubik, sans-serif';
      ctx.fillText('⏺ מקליטה', W / 2, top + (hitY - top) * 0.4);
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '500 18px Rubik, sans-serif';
      ctx.fillText(`${rec.length + recOn.size} תווים · נגני את השיר, ובסיום לחצי ✕`, W / 2, top + (hitY - top) * 0.4 + 36);
    }
    // ספירה לאחור
    if (mode === 'play' && t < range[0]) {
      const c = Math.ceil(range[0] - t);
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '800 90px Rubik, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(c), W / 2, top + (hitY - top) / 2 + 30);
    }

    // HUD
    setHud('hudScore', String(Math.round(score)));
    setHud('hudCombo', combo >= 3 ? `🔥 ${combo}` : '');
    const prog = Math.max(0, Math.min(1, (t - range[0]) / Math.max(1, endAt - range[0])));
    const pe = $('hudProg'); if (pe) pe.style.width = (prog * 100).toFixed(1) + '%';
    let ch = '';
    if (B.chords.length) { for (const c of B.chords) { if (c.start <= t + 0.05) ch = c.name; else break; } }
    setHud('hudChord', ch ? `${ch} · ${Music.chordHeb(ch, style)}` : '');
    if (msgUntil && now > msgUntil) { msgUntil = 0; $('hudMsg').classList.remove('on'); }
  }

  // חמשה: מפתח סול ליד ימין, מפתח פה ליד שמאל
  const DIA = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], SHARP = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  function drawStaff(x0, y0, w, h) {
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(x0, y0, w, h);
    const hasL = notes.some(n => n.hand === 'L'), hasR = notes.some(n => n.hand === 'R');
    const two = hasL && hasR;
    const g = two ? h / 17 : h / 11;
    const trebBottom = two ? y0 + g * 6.5 : y0 + g * 7.5;
    const bassBottom = two ? y0 + g * 14.5 : y0 + g * 7.5;
    const px = 64, pxb = (w - px - 20) / Math.max(6, B.beats * 2.5);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
    const lines = bottom => { for (let i = 0; i < 5; i++) { const y = bottom - i * g; ctx.beginPath(); ctx.moveTo(x0 + 8, y); ctx.lineTo(x0 + w - 8, y); ctx.stroke(); } };
    ctx.fillStyle = '#334155'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (hasR || !hasL) { lines(trebBottom); ctx.font = `${g * 5.2}px serif`; ctx.fillText('𝄞', x0 + 28, trebBottom - g * 1.7); }
    if (hasL) { lines(bassBottom); ctx.font = `${g * 3.6}px serif`; ctx.fillText('𝄢', x0 + 28, bassBottom - g * 2.2); }
    ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(px, y0 + 4); ctx.lineTo(px, y0 + h - 4); ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(px - 26, y0, w - px + 26, h); ctx.clip();
    for (let k = Math.max(0, barOf(t) - 1); ; k++) {
      const x = px + (B.pickup + k * B.beats - t) * pxb - g;
      if (x > w) break;
      if (x < px - 20) continue;
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
      if (hasR || !hasL) { ctx.beginPath(); ctx.moveTo(x, trebBottom - 4 * g); ctx.lineTo(x, trebBottom); ctx.stroke(); }
      if (hasL) { ctx.beginPath(); ctx.moveTo(x, bassBottom - 4 * g); ctx.lineTo(x, bassBottom); ctx.stroke(); }
    }
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i], x = px + (n.start - t) * pxb;
      if (x > w + 10) break;
      if (x < px - 24) continue;
      const stepv = (Math.floor(n.midi / 12) - 1) * 7 + DIA[n.midi % 12];
      const treb = n.hand === 'R';
      const bottom = treb ? trebBottom : bassBottom, ref = treb ? 30 : 18;
      const rel = stepv - ref, y = bottom - rel * g / 2;
      ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1;
      for (let s = -2; s >= rel; s -= 2) { const ly = bottom - s * g / 2; ctx.beginPath(); ctx.moveTo(x - g, ly); ctx.lineTo(x + g, ly); ctx.stroke(); }
      for (let s = 10; s <= rel; s += 2) { const ly = bottom - s * g / 2; ctx.beginPath(); ctx.moveTo(x - g, ly); ctx.lineTo(x + g, ly); ctx.stroke(); }
      const c = n.state === 2 ? '#ef4444' : n.state === 1 && n.mine ? '#16a34a' : !n.mine && mode !== 'listen' ? '#94a3b8' : '#0f172a';
      ctx.globalAlpha = x < px - 4 ? 0.35 : 1;
      ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(x, y, g * 0.62, g * 0.44, -0.35, 0, Math.PI * 2);
      if (n.dur * spb * (song.bpm * opts.tempo / 60) >= 2) ctx.stroke(); else ctx.fill();
      if (n.dur < 4) { ctx.beginPath(); ctx.moveTo(x + g * 0.56, y - g * 0.1); ctx.lineTo(x + g * 0.56, y - g * 3); ctx.stroke(); }
      if (SHARP[n.midi % 12]) { ctx.font = `700 ${g * 1.5}px sans-serif`; ctx.fillText('♯', x - g * 1.25, y); }
      ctx.globalAlpha = 1;
    }
    ctx.restore(); ctx.textBaseline = 'alphabetic';
  }

  return { init, start, stop, pause, setTempo, recorded, get time() { return t; }, get running() { return running; }, get tempo() { return opts.tempo; } };
})();

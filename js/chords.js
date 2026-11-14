// מאמן אקורדים: לימוד (רואים ומנגנים) + אתגר על זמן
const Chords = (() => {
  const $ = id => document.getElementById(id);
  const LEVELS = [
    ['שלב 1', ['C', 'F', 'G']], ['שלב 2', ['Am', 'Dm', 'Em']], ['שלב 3', ['D', 'A', 'E']],
    ['שלב 4', ['Bb', 'Gm', 'Bm', 'Cm', 'Eb']], ['שלב 5', ['G7', 'C7', 'D7', 'A7', 'E7']],
  ];
  const INV = ['מצב יסודי', 'היפוך ראשון', 'היפוך שני'];
  let cv, ctx, kb, W = 0, H = 0, dpr = 1, active = false, raf = 0;
  let cur = 'C', inv = 0, game = null, okUntil = 0, timer = 0, onXP = null;

  function notesFor(nm, iv) {
    const ns = Music.chordNotes(Music.parseChord(nm), 48);
    for (let i = 0; i < iv; i++) ns.push(ns.shift() + 12);
    return Math.max(...ns) > 71 ? ns.map(n => n - 12) : ns;
  }
  const style = () => (CFG.names === 'letters' ? 'letters' : 'sol');

  function init(canvas, xpFn) {
    cv = canvas; ctx = cv.getContext('2d'); kb = new KB(48, 71); onXP = xpFn;
    bindKeys(cv, () => (active ? kb : null));
    Input.on(() => { if (active) check(); });
    addEventListener('resize', () => { if (active) resize(); });
    $('chGrid').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b && !game) { cur = b.dataset.ch; inv = 0; ui(); playCur(); } });
    $('chPlay').onclick = playCur;
    $('chInv').onclick = () => { inv = (inv + 1) % 3; ui(); playCur(); };
    $('chGame').onclick = () => (game ? endGame() : startGame());
    let html = '';
    LEVELS.forEach(([name, list], i) => {
      html += `<div class="chrow"><label class="lvl"><input type="checkbox" data-lv="${i}" ${i < 2 ? 'checked' : ''}> ${name}</label>` +
        list.map(c => `<button class="chip" data-ch="${c}">${c}</button>`).join('') + '</div>';
    });
    $('chGrid').innerHTML = html;
  }
  function resize() {
    const r = cv.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); kb.layout(0, 0, W, H);
  }
  function show() { active = true; resize(); ui(); cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }
  function hide() { active = false; cancelAnimationFrame(raf); if (game) endGame(true); }
  function playCur() { Snd.unlock(); notesFor(cur, inv).forEach((m, i) => setTimeout(() => Snd.note(m, 1.2, 0.6), i * 40)); }

  function ui() {
    $('chName').textContent = cur;
    $('chHeb').textContent = Music.chordHeb(cur, style());
    const hideNotes = game && performance.now() - game.since < 4000;
    $('chNotes').textContent = hideNotes ? 'נגני את האקורד!' : notesFor(cur, game ? 0 : inv).map(m => Music.name(m, style())).join(' – ') + (game ? '' : ` · ${INV[inv]}`);
    $('chGame').textContent = game ? '⏹ סיום' : '🎮 אתגר אקורדים (60 שניות)';
    $('chInfo').textContent = game ? `⏱ ${Math.max(0, Math.ceil(game.left))}   ⭐ ${game.score}` : `שיא: ${Store.d.chordBest}`;
    document.querySelectorAll('#chGrid .chip').forEach(b => b.classList.toggle('sel', b.dataset.ch === cur && !game));
    $('chPlay').disabled = $('chInv').disabled = !!game;
  }

  function check() {
    const now = performance.now();
    if (now < okUntil) return;
    const hn = Input.heldNotes(); if (hn.length < 3) return;
    const req = new Set(Music.parseChord(cur).iv.map(i => (Music.parseChord(cur).root + i) % 12));
    const all = new Set(hn.map(h => h.midi % 12)), real = hn.filter(h => !h.ghost).map(h => h.midi % 12);
    for (const p of req) if (!all.has(p)) return;
    for (const p of real) if (!req.has(p)) return;
    okUntil = now + 900; Snd.chime(true);
    if (game) { game.score++; setTimeout(nextTarget, 650); }
    $('chName').classList.add('ok'); setTimeout(() => $('chName').classList.remove('ok'), 700);
  }

  function pool() {
    const p = [];
    document.querySelectorAll('#chGrid [data-lv]').forEach(c => { if (c.checked) p.push(...LEVELS[+c.dataset.lv][1]); });
    return p.length ? p : LEVELS[0][1];
  }
  function nextTarget() {
    if (!game) return;
    const p = pool(); let n; do { n = p[Math.floor(Math.random() * p.length)]; } while (n === cur && p.length > 1);
    cur = n; game.since = performance.now(); ui();
  }
  function startGame() {
    Snd.unlock(); game = { score: 0, left: 60, since: 0 }; nextTarget();
    timer = setInterval(() => { game.left -= 0.25; ui(); if (game.left <= 0) endGame(); }, 250);
  }
  function endGame(silent) {
    clearInterval(timer); const g = game; game = null; if (!g) return;
    if (!silent) {
      if (g.score > Store.d.chordBest) { Store.d.chordBest = g.score; Store.save(); }
      if (onXP) onXP(g.score * 8, `כל הכבוד! ${g.score} אקורדים בדקה 🎉`);
    }
    ui();
  }

  function draw() {
    if (!active) return;
    const now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const showHint = !game || now - game.since > 4000;
    const target = new Set(showHint ? notesFor(cur, game ? 0 : inv) : []);
    const heldSet = new Map(Input.heldNotes().map(h => [h.midi, h]));
    const req = new Set(Music.parseChord(cur).iv.map(i => (Music.parseChord(cur).root + i) % 12));
    kb.draw(ctx, m => {
      const h = heldSet.get(m);
      if (h && !h.ghost) return req.has(m % 12) ? '#4ade80' : '#f87171';
      if (target.has(m)) return '#fdba74';
      return null;
    });
    raf = requestAnimationFrame(draw);
  }

  return { init, show, hide };
})();

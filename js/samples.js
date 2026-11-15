// הקלטות לכיוונון: מקליטים נגינה אמיתית מול הנחיות ידועות ("נגנו עכשיו דו"), שומרים במכשיר ושולחים —
// כדי שאפשר יהיה לכוונן את מנוע ההאזנה בדיוק לאורגנית, למכשיר ולחדר האמיתיים.
// כל קובץ WAV מכיל גם את ההנחיות, את מה שהמנוע זיהה בזמן אמת ואת נתוני המכשיר (בתוך מקטע "ksta").
const Samples = (() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const style = () => (CFG.names === 'letters' ? 'letters' : 'sol');
  const MAX = 20; // כמה הקלטות נשמרות במכשיר
  let toast = () => {}, ensureMic = async () => {};

  // ---- סוגי ההקלטות ----
  // keys = הקלידים שמסומנים על המסך; seq = ההקשות שאמורות להישמע בשלב הזה, לפי הסדר
  const one = (m, dur = 2.2) => ({ keys: [m], seq: [m], dur, hint: 'פעם אחת' });
  const rep = (m, n, dur, hint) => ({ keys: [m], seq: Array(n).fill(m), dur, hint });
  const ch = (big, keys, hint = 'כל הקלידים המסומנים יחד') => ({ big, keys, seq: keys, dur: 3, hint, chord: true });
  const KINDS = {
    notes: {
      icon: '🎹', title: 'קלידים בודדים', sub: '16 קלידים לאורך המקלדת, אחד־אחד',
      steps: [43, 48, 52, 55, 60, 62, 64, 65, 66, 67, 69, 70, 72, 76, 79, 84].map(m => one(m)),
    },
    repeat: {
      icon: '🔁', title: 'חזרות ונגינה מהירה', sub: 'אותו קליד כמה פעמים, ורצף מהיר',
      steps: [
        rep(60, 4, 4, '4 פעמים ברצף'), rep(67, 4, 4, '4 פעמים ברצף'), rep(48, 4, 4, '4 פעמים ברצף'),
        rep(72, 6, 3.5, '6 פעמים, הכי מהר שאפשר'),
        { big: 'דו רה מי פה סול', keys: [60, 62, 64, 65, 67], seq: [60, 62, 64, 65, 67, 65, 64, 62, 60], dur: 6, hint: 'לעלות ולרדת, מהר' },
        { keys: [64, 65], seq: [64, 65, 64, 65, 64, 65, 64, 65], dur: 5, hint: 'לסירוגין, 4 פעמים כל קליד' },
      ],
    },
    chords: {
      icon: '🎼', title: 'אקורדים', sub: 'אקורדים ביד שמאל, ואקורד יחד עם מנגינה',
      steps: [
        ch('C', [48, 52, 55]), ch('F', [48, 53, 57]), ch('G', [47, 50, 55]), ch('Am', [48, 52, 57]), ch('Dm', [50, 53, 57]), ch('Em', [47, 52, 55]),
        ch('C + מי', [48, 52, 55, 64], 'אקורד ביד שמאל ותו ביד ימין, יחד'), ch('F + לה', [48, 53, 57, 69], 'אקורד ביד שמאל ותו ביד ימין, יחד'),
        ch('G + רה', [47, 50, 55, 74], 'אקורד ביד שמאל ותו ביד ימין, יחד'),
        ch('דו + מי', [60, 64], 'שני קלידים יחד'), ch('דו + דו', [60, 72], 'אוקטבה: שני קלידים יחד'),
      ],
    },
    noise: {
      icon: '🗣️', title: 'רעשי רקע בלי נגינה', sub: 'שקט, דיבור, מחיאות כפיים ושירה',
      steps: [
        { big: '🤫', keys: [], seq: [], dur: 5, hint: 'שקט — בלי לנגן ובלי לדבר' },
        { big: '🗣️', keys: [], seq: [], dur: 7, hint: 'דברו בקול רגיל (בלי לנגן)' },
        { big: '👏', keys: [], seq: [], dur: 5, hint: 'מחאו כפיים והקישו על השולחן' },
        { big: '🎤', keys: [], seq: [], dur: 6, hint: 'שירו או זמזמו מנגינה' },
      ],
    },
    free: {
      icon: '🎶', title: 'נגינה חופשית', sub: 'שיר שהיא אוהבת, כמו שמנגנים בבית',
      steps: [{ big: '🎶', keys: [], seq: [], dur: 45, hint: 'נגנו שיר כמו בבית — אפשר גם עם דיבור ברקע. לסיום: "סיום ושמירה"', free: true }],
    },
  };
  const secOf = k => Math.round(KINDS[k].steps.reduce((s, x) => s + x.dur, 0));

  // ---- שמירה במכשיר (IndexedDB); אם הדפדפן חוסם אותה, ההקלטות נשארות רק עד שסוגרים את הדף ----
  let dbp = null, volatile = false; const memMeta = new Map(), memAudio = new Map();
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('keysStarSamples', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta', { keyPath: 'id' }); r.result.createObjectStore('audio'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(['meta', 'audio'], mode); let rq;
    try { rq = fn(t.objectStore('meta'), t.objectStore('audio')); } catch (e) { return rej(e); }
    t.oncomplete = () => res(rq ? rq.result : undefined); t.onerror = t.onabort = () => rej(t.error);
  }));
  const db = {
    async list() { try { if (!volatile) return (await tx('readonly', m => m.getAll())).sort((a, b) => b.date - a.date); } catch (e) { volatile = true; } return [...memMeta.values()].sort((a, b) => b.date - a.date); },
    async put(meta, buf) {
      try { if (!volatile) { await tx('readwrite', (m, a) => { a.put(buf, meta.id); return m.put(meta); }); return; } } catch (e) { volatile = true; }
      memMeta.set(meta.id, meta); memAudio.set(meta.id, buf);
    },
    async patch(meta) { try { if (!volatile) { await tx('readwrite', m => m.put(meta)); return; } } catch (e) { volatile = true; } memMeta.set(meta.id, meta); },
    async audio(id) { try { if (!volatile) return await tx('readonly', (m, a) => a.get(id)); } catch (e) { volatile = true; } return memAudio.get(id); },
    async del(id) { try { if (!volatile) { await tx('readwrite', (m, a) => { a.delete(id); return m.delete(id); }); return; } } catch (e) { volatile = true; } memMeta.delete(id); memAudio.delete(id); },
  };

  // ---- קובץ WAV (16 ביט, מונו) + מקטע "ksta" עם הנתונים ----
  function wav(pcm, sr, info) {
    const js = new TextEncoder().encode(JSON.stringify(info)), jl = js.length + (js.length & 1), n = pcm.length * 2;
    const buf = new ArrayBuffer(44 + n + 8 + jl), v = new DataView(buf), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + n + 8 + jl, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0, o = 44; i < pcm.length; i++, o += 2) v.setInt16(o, pcm[i], true);
    w(44 + n, 'ksta'); v.setUint32(48 + n, js.length, true); new Uint8Array(buf, 52 + n, js.length).set(js);
    return buf;
  }

  // ---- הקלטה ----
  let rec = null, timer = 0, metas = [], audio = null, playing = null, kb = null, active = false;
  const files = new Map(); // id -> File מוכן לשליחה (נטען מראש, כדי שהשליחה תקרה מיד בלחיצה)
  const r3 = x => Math.round(x * 1000) / 1000;

  async function start(kind) {
    if (rec) return;
    if (metas.length >= MAX) return toast(`יש כבר ${MAX} הקלטות שמורות — שלחו ומחקו כמה לפני שמקליטים עוד`, 3500);
    Snd.unlock(); await ensureMic();
    if (!Input.micOn) return toast('🎤 צריך לאשר גישה למיקרופון', 3000);
    stopPlay();
    const h = Input.startRec(75);
    if (!h) return toast('ההקלטה לא התחילה', 2500);
    Input.mic.peak = 0;
    rec = { kind, def: KINDS[kind], i: -1, t: performance.now(), tStep: 0, h, plan: [], events: [], note: ($('smNote') || {}).value || '' };
    Store.d.sampleNote = rec.note; Store.save();
    Input.setExpected(null);
    render();
    clearInterval(timer); timer = setInterval(tick, 50);
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { if (rec) rec.lock = l; else l.release(); }).catch(() => {});
  }
  function nextStep(now) {
    rec.i++; rec.tStep = now;
    const st = rec.def.steps[rec.i];
    rec.plan.push({ t: r3((now - rec.h.t0) / 1000), dur: st.dur, keys: st.keys, seq: st.seq, label: label(st), heard: [] });
    Input.setExpected(st.keys.length ? st.keys : null);
    const nx = rec.def.steps[rec.i + 1];
    $('smStep').textContent = rec.def.steps.length > 1 ? `${rec.i + 1} מתוך ${rec.def.steps.length}` : '';
    $('smBig').textContent = label(st); $('smBig').classList.remove('ok');
    $('smHint').textContent = st.hint || '';
    $('smNext').textContent = nx ? `אחר כך: ${label(nx)}` : '';
    drawKb(st.keys);
  }
  const label = st => st.big || st.keys.map(m => Music.name(m, style())).join(' ');
  function tick() {
    if (!rec) return;
    const now = performance.now();
    if (rec.i < 0) {
      const left = 3000 - (now - rec.t);
      if (left > 0 || !rec.h.t0) {
        if (now - rec.t > 6000) { cancel(); return toast('המיקרופון לא מעביר צליל — נסו שוב', 3000); }
        $('smBig').textContent = Math.max(1, Math.ceil(left / 1000)); $('smHint').textContent = 'מתחילים… בינתיים שקט'; return;
      }
      nextStep(now);
    }
    const st = rec.def.steps[rec.i], el = (now - rec.tStep) / 1000;
    if (el >= st.dur) { if (rec.i + 1 >= rec.def.steps.length) return finish(); nextStep(now); return; }
    $('smBar').style.width = Math.max(0, 100 - el / st.dur * 100) + '%';
    $('smLvl').style.width = Math.min(100, Input.mic.level * 600) + '%';
    const ns = Input.heldNotes().filter(x => !x.ghost).map(x => Music.name(x.midi, style()));
    $('smHeard').textContent = 'האפליקציה שומעת: ' + (ns.length ? ns.join(' ') : '—');
    if (st.free) $('smStep').textContent = `${Math.floor(el)} / ${st.dur} שניות`;
  }
  // כל מה שהמנוע מזהה בזמן ההקלטה נרשם: מתי הייתה ההקשה, וכמה זמן אחריה הגיע הזיהוי
  Input.on(e => {
    if (srec && e.src === 'mic') srec.events.push({ p: actx(), t0: e.ta, on: e.type === 'on' ? 1 : 0, m: e.midi, g: e.ghost ? 1 : 0 });
    if (!rec || e.src !== 'mic' || !rec.h.t0) return;
    const now = performance.now(), t0 = e.t0 != null ? e.t0 : now;
    rec.events.push({ t: r3((t0 - rec.h.t0) / 1000), d: Math.round(now - t0), on: e.type === 'on' ? 1 : 0, m: e.midi, g: e.ghost ? 1 : 0 });
    if (e.type !== 'on' || e.ghost || rec.i < 0) return;
    const p = rec.plan[rec.i]; p.heard.push(e.midi);
    if (p.keys.length && p.keys.every(k => p.heard.includes(k)) && $('smBig')) $('smBig').classList.add('ok');
  });
  function endRec() {
    clearInterval(timer); Input.setExpected(null);
    if (rec.lock) rec.lock.release().catch(() => {});
    const r = rec; rec = null; return r;
  }
  function cancel() { if (!rec) return; endRec().h.stop(); render(); }
  // כמה מההנחיות זוהו בזמן אמת, וכמה זיהויים היו מיותרים
  function scoreOf(plan) {
    let ok = 0, total = 0, extra = 0;
    for (const p of plan) {
      const want = new Set(p.keys);
      extra += p.heard.filter(m => !want.has(m)).length;
      if (!p.keys.length) continue;
      total++;
      const cnt = m => p.heard.filter(x => x === m).length, need = m => p.seq.filter(x => x === m).length;
      if (p.keys.every(m => cnt(m) >= need(m))) ok++;
    }
    return { ok, total, extra };
  }
  async function finish() {
    if (!rec) return;
    const r = endRec(), { pcm, sr } = r.h.stop(), dur = pcm.length / sr;
    if (dur < 2 || !r.plan.length) { render(); return toast('ההקלטה קצרה מדי', 2000); }
    const d = new Date(), p2 = n => String(n).padStart(2, '0');
    const id = `${r.kind}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
    const score = scoreOf(r.plan);
    const meta = { id, kind: r.kind, date: d.getTime(), dur: Math.round(dur), sr, score, note: r.note, peak: r3(Input.mic.peak), sent: 0 };
    const info = {
      app: 'keys-star', v: 1, id, kind: r.kind, date: d.toISOString(), note: r.note, score, peak: meta.peak,
      plan: r.plan, events: r.events,
      env: Object.assign(Input.micInfo(), { ua: navigator.userAgent, cfgLatency: CFG.latency, cfgTune: CFG.tune || 0, standalone: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches) }),
    };
    const buf = wav(pcm, sr, info); meta.size = buf.byteLength;
    await db.put(meta, buf);
    files.set(id, new File([buf], `keys-${id}.wav`, { type: 'audio/wav' }));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await refresh();
    Snd.chime(true);
    const pk = meta.peak > 0.93 ? ' · הצליל חזק מדי למיקרופון — כדאי להרחיק מעט את המכשיר' : meta.peak < 0.02 ? ' · הצליל חלש מאוד' : '';
    toast((r.kind === 'noise' ? `נשמר ✓ זיהויי שווא: ${score.extra}` : score.total ? `נשמר ✓ זוהו בזמן אמת ${score.ok} מתוך ${score.total}` : 'ההקלטה נשמרה ✓') + pk, 3500);
  }

  // ---- הקלטת נגינה של שיר (מתוך מסך הנגינה): הצליל, כל מה שהמנוע שמע וכל החלטה של המשחק ----
  // (פגיעה / "טעות" / פספוס, ואיזה תו המשחק ציפה לשמוע) — כדי למצוא בדיוק איפה ההאזנה טעתה, ולתקן
  const SONG_MAX = 240; // 4 דקות לכל היותר (כ-11MB)
  let srec = null;
  const actx = () => Snd.ctx().currentTime * 1000; // שעון השמע — אותו שעון של ההקלטה עצמה, בלי "זחילה"
  const stampOf = d => { const p2 = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`; };
  function songStart() {
    if (srec || rec) return false;
    if (!Input.micOn) { toast('🎤 כדי להקליט צריך שהמיקרופון יהיה פעיל', 2800); return false; }
    const h = Input.startRec(SONG_MAX + 2);
    if (!h) { toast('ההקלטה לא התחילה', 2500); return false; }
    Input.mic.peak = 0;
    const now = actx();
    srec = { h, log: [], events: [], flags: 0, date: new Date(), cfg: { latency: CFG.latency, tune: CFG.tune || 0, ref: CFG.ref || 0 }, env0: Input.micInfo() };
    const snap = Game.snapshot(); if (snap) srec.log.push(Object.assign({ p: now }, snap, { exp: Input.expected }));
    Game.setLogger(o => { if (srec) srec.log.push(Object.assign({ p: actx() }, o)); });
    Input.onExpected(list => { if (srec) srec.log.push({ p: actx(), k: 'exp', m: list }); });
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then(l => { if (srec) srec.lock = l; else l.release(); }).catch(() => {});
    return true;
  }
  function songFlag() { if (!srec) return; srec.flags++; srec.log.push({ p: actx(), k: 'flag' }); }
  // הקטנת קצב הדגימה פי 2 (48000 → 24000) עם מסנן — חצי מהגודל, ובלי לאבד שום דבר שחשוב לזיהוי תווים
  function half(x) {
    const H = [-0.0322, 0, 0.2822, 0.5, 0.2822, 0, -0.0322], n = x.length >> 1, out = new Int16Array(n);
    for (let i = 0; i < n; i++) { let v = 0; for (let k = 0; k < 7; k++) { const j = 2 * i + k - 3; if (j >= 0 && j < x.length) v += H[k] * x[j]; } out[i] = Math.max(-32768, Math.min(32767, Math.round(v))); }
    return out;
  }
  async function songStop() {
    if (!srec) return null;
    const r = srec; srec = null;
    Game.setLogger(null); Input.onExpected(null);
    if (r.lock) r.lock.release().catch(() => {});
    const { pcm, sr } = r.h.stop(), dur = pcm.length / sr;
    if (dur < 3 || !r.h.t0) { toast('ההקלטה קצרה מדי', 2000); return null; }
    const t0 = r.h.t0a, rel = p => r3((p - t0) / 1000);
    const log = r.log.map(o => { const x = Object.assign({}, o); delete x.p; return Object.assign({ t: rel(o.p) }, x); });
    const events = r.events.map(e => ({ t: rel(e.t0 != null ? e.t0 : e.p), d: e.t0 != null ? Math.round(e.p - e.t0) : null, on: e.on, m: e.m, g: e.g }));
    const cnt = k => log.filter(o => o.k === k).length;
    const score = { ok: cnt('hit'), wrong: cnt('wrong'), miss: cnt('miss') + cnt('skip'), flags: r.flags };
    const first = log.find(o => o.k === 'start' || o.k === 'snap') || {};
    const d = r.date, id = `song-${stampOf(d)}`;
    const small = sr >= 44100, data = small ? half(pcm) : pcm, sr2 = small ? sr / 2 : sr;
    const meta = { id, kind: 'song', title: first.title || '', date: d.getTime(), dur: Math.round(dur), sr: sr2, score, note: '', peak: r3(Input.mic.peak), sent: 0 };
    const info = {
      app: 'keys-star', v: 1, id, kind: 'song', title: first.title || '', songId: first.id || '', date: d.toISOString(), score, peak: meta.peak,
      clock: 'audio', rate: { orig: sr, saved: sr2 }, cfg: r.cfg, log, events,
      env: Object.assign(r.env0, { tuneEnd: Input.micInfo().tune, refEnd: Input.micInfo().ref, ua: navigator.userAgent, standalone: !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches) }),
    };
    const buf = wav(data, sr2, info); meta.size = buf.byteLength;
    await db.put(meta, buf);
    files.set(id, new File([buf], `keys-${id}.wav`, { type: 'audio/wav' }));
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    refresh();
    return meta;
  }

  // ---- שליחה, השמעה, מחיקה ----
  async function fileOf(m) {
    if (!files.has(m.id)) { const buf = await db.audio(m.id); if (buf) files.set(m.id, new File([buf], `keys-${m.id}.wav`, { type: 'audio/wav' })); }
    return files.get(m.id);
  }
  async function send(list) {
    const fs = (await Promise.all(list.map(fileOf))).filter(Boolean);
    if (!fs.length) return toast('לא מצאתי את ההקלטה', 2000);
    let done = false;
    if (navigator.canShare && navigator.canShare({ files: fs })) {
      try { await navigator.share({ files: fs }); done = true; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (!done) { // אין חלון שיתוף במכשיר הזה — הקבצים יורדים לתיקיית ההורדות
      for (const f of fs) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); await new Promise(r => setTimeout(r, 400)); }
      toast(fs.length > 1 ? `${fs.length} קבצים ירדו לתיקיית ההורדות` : 'הקובץ ירד לתיקיית ההורדות', 3000);
    }
    for (const m of list) { m.sent = 1; await db.patch(m); }
    refresh();
  }
  function stopPlay() { if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); audio = null; } playing = null; }
  async function play(m) {
    const was = playing; stopPlay();
    if (was === m.id) return renderList();
    const f = await fileOf(m); if (!f) return;
    audio = new Audio(URL.createObjectURL(f)); playing = m.id;
    audio.onended = () => { stopPlay(); renderList(); };
    audio.play().catch(() => { stopPlay(); renderList(); });
    renderList();
  }

  // ---- מסך ----
  async function refresh() { metas = await db.list(); if (active && !rec) { render(); metas.forEach(m => fileOf(m).catch(() => {})); } }
  const mb = n => (n / 1048576).toFixed(1) + 'MB';
  function rowHtml(m) {
    const k = m.kind === 'song' ? { icon: '🎵', title: 'נגינה: ' + esc(m.title || 'שיר') } : KINDS[m.kind] || KINDS.free, d = new Date(m.date), p2 = n => String(n).padStart(2, '0');
    const sc = m.kind === 'song' ? `✓ ${m.score.ok} · ✗ ${m.score.wrong}${m.score.flags ? ` · 🚩 ${m.score.flags}` : ''}` : m.kind === 'noise' ? `זיהויי שווא: ${m.score.extra}` : m.score && m.score.total ? `זוהו ${m.score.ok}/${m.score.total}` : '';
    return `<div class="set smrow" data-id="${m.id}"><div class="grow"><b>${k.icon} ${k.title}</b>
      <small>${d.getDate()}.${d.getMonth() + 1} ${p2(d.getHours())}:${p2(d.getMinutes())} · ${m.dur} שניות · ${mb(m.size)}${sc ? ' · ' + sc : ''}${m.sent ? ' · ✓ נשלחה' : ''}${m.note ? '<br>' + esc(m.note) : ''}</small></div>
      <button class="icon" data-act="play" title="השמעה">${playing === m.id ? '⏹' : '▶'}</button><button class="icon" data-act="send" title="שליחה">📤</button><button class="icon" data-act="del" title="מחיקה">🗑</button></div>`;
  }
  function renderList() {
    const el = $('smList'); if (!el) return;
    const unsent = metas.filter(m => !m.sent).length;
    el.innerHTML = !metas.length ? '<div class="sub">עוד אין הקלטות. בחרו סוג הקלטה למעלה.</div>'
      : `<button class="btn hot wide" id="smSendAll">📤 שליחת ${metas.length > 1 ? `כל ${metas.length} ההקלטות` : 'ההקלטה'}${unsent && unsent < metas.length ? ` (${unsent} עוד לא נשלחו)` : ''}</button>` + metas.map(rowHtml).join('');
  }
  function render() {
    const body = $('smBody'); if (!body) return;
    if (rec) {
      body.innerHTML = `<div class="smrec"><div class="sub center" id="smStep"></div><div id="smBig">3</div><div id="smHint"></div>
        <canvas id="smCv"></canvas><div class="sub center">● דו האמצעי</div>
        <div class="meter"><i id="smBar"></i></div><div class="sub center" id="smNext"></div>
        <div class="meter"><i id="smLvl"></i></div><div class="sub center" id="smHeard"></div>
        <div class="btns row"><button class="btn" id="smStop">■ סיום ושמירה</button><button class="btn ghost" id="smCancel">ביטול</button></div></div>`;
      drawKb([]);
      return;
    }
    const cnt = k => metas.filter(m => m.kind === k).length;
    body.innerHTML = `<div class="tip">מקליטים כאן את האורגנית האמיתית, כדי לכוונן את ההאזנה בדיוק אליה. המסך אומר מה לנגן, וההקלטה נשמרת כאן במכשיר. בסוף לוחצים 📤 ושולחים. הכי טוב: להקליט את כל חמשת הסוגים, במקום ובעוצמה שבהם היא מנגנת בדרך כלל.</div>
      ${volatile ? '<div class="tip warnbox">הדפדפן לא מאפשר שמירה במכשיר (גלישה פרטית?). ההקלטות יישארו רק עד שסוגרים את הדף — שלחו אותן מיד.</div>' : ''}
      <div class="tip">🎵 <b>האפליקציה אמרה "טעות" כשניגנה נכון?</b> מתוך שיר, לוחצים למעלה על ⏺ ומנגנים כרגיל. כשהאפליקציה טועה אפשר ללחוץ 🚩 (לא חובה). בסוף לוחצים ⏹ או יוצאים מהשיר. ההקלטה נשמרת כאן, ושולחים אותה עם 📤.</div>
      <h3>הקלטה חדשה</h3>
      <div class="ask"><input id="smNote" type="text" maxlength="120" placeholder="הערה (לא חובה): איזה צליל נבחר באורגנית, איפה המכשיר מונח" autocomplete="off" value="${esc(Store.d.sampleNote || '')}"></div>
      <div class="modes">${Object.keys(KINDS).map(k => `<button class="mode" data-kind="${k}"><b>${KINDS[k].icon} ${KINDS[k].title}</b><span>${KINDS[k].sub} · ${k === 'free' ? 'עד ' : ''}${secOf(k)} שניות${cnt(k) ? ` · <i class="smhave">✓ נשמרו ${cnt(k)}</i>` : ''}</span></button>`).join('')}</div>
      <h3>ההקלטות השמורות${metas.length ? ` (${metas.length} · ${mb(metas.reduce((s, m) => s + m.size, 0))})` : ''}</h3><div id="smList"></div>`;
    renderList();
  }
  function drawKb(keys) {
    const cv = $('smCv'); if (!cv) return;
    kb = kb || new KB(36, 95);
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), ctx = cv.getContext('2d');
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
    kb.layout(0, 0, r.width, r.height);
    const set = new Set(keys);
    kb.draw(ctx, m => (set.has(m) ? '#fb923c' : null));
    const c = kb.rect(60); ctx.fillStyle = set.has(60) ? '#0f172a' : '#7c3aed'; ctx.beginPath(); ctx.arc(c.x + c.w / 2, r.height * 0.78, Math.max(2, Math.min(5, c.w * 0.28)), 0, 7); ctx.fill();
  }

  function init(o) {
    toast = o.toast; ensureMic = o.ensureMic;
    $('smBody').addEventListener('click', e => {
      const k = e.target.closest('[data-kind]'); if (k) return start(k.dataset.kind);
      if (e.target.closest('#smStop')) return finish();
      if (e.target.closest('#smCancel')) return cancel();
      if (e.target.closest('#smSendAll')) return send(metas.slice());
      const a = e.target.closest('[data-act]'); if (!a) return;
      const m = metas.find(x => x.id === a.closest('[data-id]').dataset.id); if (!m) return;
      if (a.dataset.act === 'play') play(m);
      else if (a.dataset.act === 'send') send([m]);
      else if (confirm('למחוק את ההקלטה?')) { if (playing === m.id) stopPlay(); files.delete(m.id); db.del(m.id).then(refresh); }
    });
    addEventListener('resize', () => { if (active && rec && rec.i >= 0) drawKb(rec.def.steps[rec.i].keys); });
  }
  function show() { active = true; render(); refresh(); ensureMic(); }
  function hide() { if (!active) return; active = false; if (rec) cancel(); stopPlay(); }
  const count = () => db.list().then(l => l.length);

  return { init, show, hide, count, KINDS, songStart, songStop, songFlag, SONG_MAX, get songOn() { return !!srec; }, get songSec() { return srec ? srec.h.sec : 0; } };
})();

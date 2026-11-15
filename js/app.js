// מסכים, התקדמות וחיבור כל החלקים
(() => {
  const $ = id => document.getElementById(id);
  const D = Store.d;
  let curSong = null, arr = 'rh', tempo = 1, lastRun = null, smartTok = 0, catFilter = 'all', query = '', recording = false, setRaf = 0;
  const allSongs = () => [...SONGS, ...D.mine, ...Library.list];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const starsOf = id => { const p = D.prog[id]; return p ? Math.max(p.wait || 0, p.play || 0, p.echo || 0) : 0; };
  const starHtml = n => `<span class="st">${[1, 2, 3].map(i => `<span class="${i <= n ? '' : 'off'}">★</span>`).join('')}</span>`;

  let toastT = 0;
  function toast(msg, ms = 1500) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

  function go(name) {
    document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
    $('app').classList.toggle('full', !['home', 'chords', 'settings'].includes(name));
    if (name !== 'game') { smartTok++; Game.stop(); if (Samples.songOn) saveSongRec(); }
    if (name === 'chords') { ensureMic(); Chords.show(); } else Chords.hide();
    if (name === 'samples') Samples.show(); else Samples.hide();
    cancelAnimationFrame(setRaf);
    if (name === 'home') renderHome();
    if (name === 'settings') renderSettings();
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { Snd.unlock(); go(b.dataset.go); } });

  // המיקרופון הוא הבסיס: נפתח בכל תחילת שיר/תרגול (אלא אם כובה במפורש בהגדרות)
  async function ensureMic() {
    if (CFG.mic && !Input.micOn) { const ok = await Input.startMic(); if (!ok) toast('🎤 אין גישה למיקרופון — צריך לאשר אותו בדפדפן כדי שאשמע את הנגינה', 3500); }
  }

  // ---------- התקדמות ----------
  const level = () => Math.floor(Math.sqrt(D.xp / 100)) + 1;
  function addXP(n, msg) { D.xp += Math.max(0, Math.round(n)); Store.save(); if (msg) toast(msg, 2200); renderStats(); }
  const dayStr = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function touchStreak() {
    const today = dayStr(new Date()); if (D.streak.last === today) return;
    const y = new Date(); y.setDate(y.getDate() - 1);
    D.streak.n = D.streak.last === dayStr(y) ? D.streak.n + 1 : 1; D.streak.last = today; Store.save();
  }
  function renderStats() {
    const lv = level(), base = (lv - 1) * (lv - 1) * 100, next = lv * lv * 100;
    $('stLvl').textContent = `רמה ${lv}`;
    $('stNext').textContent = `עוד ${Math.max(0, next - D.xp)} נקודות לרמה ${lv + 1}`;
    $('stStreak').textContent = D.streak.n || 0;
    $('stStars').textContent = allSongs().reduce((s, x) => s + starsOf(x.id), 0);
    $('xpFill').style.width = ((D.xp - base) / (next - base) * 100).toFixed(0) + '%';
  }

  // ---------- בית ----------
  // כל קטגוריה מקבלת צבע וסמל משלה — כך קל לזהות שירים במבט
  const LOOK = { known: ['#fbbf24', '#fb7185', '🎈'], israeli: ['#38bdf8', '#34d399', '🌟'], classic: ['#a78bfa', '#6366f1', '🎻'], disney: ['#60a5fa', '#c084fc', '🏰'],
    ilnew: ['#f472b6', '#a78bfa', '🎤'], pop: ['#f472b6', '#38bdf8', '🎧'], rock: ['#fb923c', '#ef4444', '🎸'], web: ['#38bdf8', '#818cf8', '🌐'], mine: ['#f472b6', '#fb923c', '💖'] };
  const ORDER = ['known', 'israeli', 'disney', 'ilnew', 'pop', 'rock', 'classic', 'web', 'mine'];
  const catName = id => ((CATS.find(c => c[0] === id) || [])[1] || '').replace(/^\S+\s/, '');
  // לכל שיר תמונה וצבעים משלו (לשירים המובנים — תמונה שמתאימה לשיר; לשירים שנוספו — לפי השם)
  const PIC = { twinkle: '⭐', jacob: '😴', yonatan: '🌳', birthday: '🎂', jingle: '🔔', hatikvah: '🇮🇱', london: '🌉', yankee: '🎩', saints: '🎺', susanna: '🪕',
    grace: '🕊️', silent: '🎄', bells: '🛎️', ode: '🎼', cancan: '💃', kleine: '🌃', mountain: '⛰️', lullaby: '🌙', minuet: '👑', greensleeves: '🍃', canon: '🎻', elise: '💌', turkish: '🎪' };
  const PICS = ['🎵', '🎶', '🦄', '🌈', '🎀', '🦋', '🍭', '🌸', '🐬', '🍓', '🎠', '🐱', '🌻', '🪐', '🧁', '🐼'];
  const GRADS = [['#fbbf24', '#fb7185'], ['#38bdf8', '#34d399'], ['#a78bfa', '#6366f1'], ['#f472b6', '#a78bfa'], ['#60a5fa', '#c084fc'], ['#fb923c', '#f43f5e'],
    ['#34d399', '#22d3ee'], ['#f9a8d4', '#fcd34d'], ['#818cf8', '#ec4899'], ['#2dd4bf', '#818cf8']];
  const hash = str => { let h = 7; for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0; return h; };
  const look = s => { const h = hash(s.id + s.title), g = GRADS[h % GRADS.length]; return [g[0], g[1], PIC[s.id] || PICS[(h >>> 4) % PICS.length]]; };
  const coverHtml = (s, big) => { const [c1, c2, e] = look(s); return `<div class="cover${big ? ' big' : ''}" style="--c1:${c1};--c2:${c2}"><span>${e}</span></div>`; };
  const diff = lv => lv <= 2 ? ['easy', 'קל'] : lv === 3 ? ['mid', 'בינוני'] : ['hard', 'מאתגר'];
  function cardHtml(s) {
    const [k, t] = diff(s.level || 3);
    return `<button class="card" data-song="${s.id}">${coverHtml(s)}<b dir="auto">${esc(s.title)}</b><small dir="auto">${esc(s.composer || '')}</small><div class="row"><span class="diff ${k}">${t}</span>${starHtml(starsOf(s.id))}</div></button>`;
  }
  // ---------- אתגר יומי: כל פעם אתגר אחר (סוג ושיר משתנים), ואחרי שמסיימים — מיד אתגר חדש ----------
  const CH_TYPES = ['stars', 'echo', 'learn', 'chords'];
  const lvCap = () => Math.min(5, 2 + Math.floor(level() / 2));
  const mix = x => { x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; x = Math.imul(x, 0x45d9f3b); x ^= x >>> 16; return x >>> 0; };
  // מאגר לאתגרים ולהפתעות: בעיקר שירי ילדים, דיסני וסרטים, ישראלי וקלאסי; לפעמים גם פופ ורוק
  const KID = new Set(['known', 'israeli', 'disney', 'classic']);
  function pickPool(r, maxLv) {
    const all = allSongs().filter(s => (s.level || 3) <= maxLv && s.cat !== 'mine'), kid = all.filter(s => KID.has(s.cat));
    return kid.length >= 10 && r % 3 !== 0 ? kid : all;
  }
  function challenge() {
    const day = Math.floor(Date.now() / 864e5);
    if (!D.daily || D.daily.day !== day) { D.daily = { day, n: 0 }; Store.save(); }
    // סוגי האתגרים מתחלפים בסבב (כל יום הסבב מתחיל ממקום אחר), והשיר נבחר באקראי
    const seed = mix(hash('ch' + day) ^ mix(D.daily.n + 1)), type = CH_TYPES[(day + D.daily.n) % CH_TYPES.length];
    if (type === 'chords') return { type, need: Math.max(6, Math.min(25, (D.chordBest || 0) + 1)) };
    const pool = pickPool(mix(seed ^ 0x51), lvCap());
    const fresh = pool.filter(s => starsOf(s.id) < 3), P = fresh.length ? fresh : pool;
    return { type, song: P[mix(seed ^ 0x9e3779b9) % P.length] };
  }
  function challengeDone() { D.daily.n++; Store.save(); addXP(60, '🏆 האתגר הושלם! +60 נקודות · מחכה לך אתגר חדש'); }
  function challengeHtml() {
    const c = challenge(); if (!c.song && c.type !== 'chords') return '';
    const t = c.song ? esc(c.song.title) : '';
    const [ic, b, sub] = c.type === 'stars' ? ['🎮', `3 כוכבים במשחק: ${t}`, 'מנגנים בקצב, בלי לפספס'] : c.type === 'learn' ? ['🐢', `ללמוד שיר: ${t}`, '2 כוכבים במצב לימוד']
      : c.type === 'echo' ? ['🦜', `לתפוס את המנגינה: ${t}`, '2 כוכבים בתופסת מנגינה'] : ['🎼', `${c.need} אקורדים בדקה אחת`, 'באתגר האקורדים'];
    return `<button class="daily" ${c.song ? `data-song="${c.song.id}"` : 'data-go="chords"'}><i>${ic}</i><div><b dir="auto">האתגר: ${b}</b><span>${sub} · <u data-skip="1">🔀 אתגר אחר</u></span></div><span class="go">▶</span></button>`;
  }
  // לכל קטגוריה גדולה מציגים מבחר משתנה מדי יום (כדי לגלות שירים חדשים), ואפשר לפתוח את כולם
  const dayMix = list => { const d = Math.floor(Date.now() / 864e5); return list.slice().sort((x, y) => hash(x.id + d) - hash(y.id + d)); };
  let catShow = 60;
  function renderHome() {
    renderStats();
    const h = new Date().getHours();
    $('hiTitle').textContent = h < 5 ? 'לילה טוב! 🌙' : h < 12 ? 'בוקר טוב! ☀️' : h < 17 ? 'צהריים טובים! 🌼' : h < 21 ? 'ערב טוב! 🌆' : 'לילה טוב! 🌙';
    const songsAll = allSongs();
    // כרטיסים בראש: להמשיך מאיפה שהפסקת, האתגר, והפתעה
    let top = '';
    const last = D.last && songsAll.find(s => s.id === D.last);
    if (last) top += `<button class="daily cont" data-song="${last.id}"><i>▶️</i><div><b dir="auto">להמשיך: ${esc(last.title)}</b><span>${starsOf(last.id) ? 'יש לך כבר ' + starsOf(last.id) + ' ⭐ — אפשר להשיג עוד!' : 'בואי נמשיך לתרגל'}</span></div><span class="go">▶</span></button>`;
    if (packMsg) top += `<div class="daily loading"><i><span class="spin"></span></i><div><b>מכינה לך אלפי שירים…</b><span id="packMsg">${packMsg}</span></div></div>`;
    top += challengeHtml();
    top += `<button class="daily surprise" id="surprise"><i>🎲</i><div><b>הפתיעי אותי!</b><span>שיר אקראי מתוך ${songsAll.length.toLocaleString('he-IL')} שירים</span></div><span class="go">▶</span></button>`;
    $('daily').innerHTML = top;
    $('daily').hidden = !!query;
    const cats = ORDER.filter(id => id === 'mine' || songsAll.some(s => s.cat === id));
    if (!cats.includes(catFilter) && catFilter !== 'all') catFilter = 'all';
    $('catChips').innerHTML = [['all', '✨ הכול'], ...cats.map(id => [id, (LOOK[id] || LOOK.mine)[2] + ' ' + catName(id)])].map(([id, n]) => `<button class="chip ${catFilter === id ? 'sel' : ''}" data-cat="${id}">${n}</button>`).join('');
    $('catChips').hidden = !!query;
    let html = '';
    if (query) {
      const q = query.toLowerCase(), found = songsAll.filter(s => (s.title + ' ' + (s.composer || '')).toLowerCase().includes(q));
      html = found.length ? `<div class="cat">🎵 באפליקציה (${found.length})</div><div class="grid">${found.slice(0, 60).map(cardHtml).join('')}</div>` + (found.length > 60 ? '<div class="sub">מוצגים 60 הראשונים — אפשר לדייק את החיפוש</div>' : '') : '';
      html += '<div class="cat">🌐 מהאינטרנט</div><div id="webRes" class="weblist"></div>';
    } else for (const cid of cats) {
      if (catFilter !== 'all' && catFilter !== cid) continue;
      let songs = songsAll.filter(s => s.cat === cid);
      const big = songs.length > 12, total = songs.length;
      if (big) songs = dayMix(songs);
      const lim = catFilter === 'all' ? 10 : catShow;
      html += `<div class="cat">${(LOOK[cid] || LOOK.mine)[2]} ${catName(cid)}${total > 12 ? ` <small class="cnt">${total.toLocaleString('he-IL')} שירים</small>` : ''}</div><div class="grid">${songs.slice(0, lim).map(cardHtml).join('')}`;
      if (total > lim) html += catFilter === 'all' ? `<button class="card add more" data-cat="${cid}"><i>➕</i><b>לכל ${total.toLocaleString('he-IL')} השירים</b></button>` : '<button class="card add more" id="catMore"><i>⬇️</i><b>עוד שירים</b></button>';
      if (cid === 'mine') html += '<button class="card add" data-rec="1"><i>⏺</i><b>להקליט שיר</b><small>מנגנים, והאפליקציה זוכרת</small></button><button class="card add" data-midi="1"><i>📂</i><b>קובץ MIDI</b><small>להורים: הוספת שיר מקובץ</small></button>';
      html += '</div>';
    }
    $('songList').innerHTML = html;
    if (query) webSearch(query);
  }
  $('scr-home').addEventListener('click', e => {
    if (e.target.closest('[data-skip]')) { D.daily.n++; Store.save(); renderHome(); return; }
    if (e.target.closest('#surprise')) {
      const pool = pickPool(Math.floor(Math.random() * 999), lvCap() + 1).filter(s => s.id !== D.last);
      if (pool.length) { Snd.unlock(); Snd.chime(true); openSong(pool[Math.floor(Math.random() * pool.length)].id); }
      return;
    }
    if (e.target.closest('#catMore')) { catShow += 60; renderHome(); return; }
    const c = e.target.closest('[data-cat]'); if (c) { catFilter = c.dataset.cat; catShow = 60; renderHome(); $('scr-home').querySelector('.main').scrollTop = 0; return; }
    const s = e.target.closest('[data-song]'); if (s) { openSong(s.dataset.song); return; }
    if (e.target.closest('[data-rec]')) { startRecord(); return; }
    if (e.target.closest('[data-midi]')) $('midiFile').click();
  });
  window.addEventListener('keys:chords', e => { const c = challenge(); if (c.type === 'chords' && e.detail >= c.need) challengeDone(); });
  // טעינה אוטומטית של כל השירים (בפעם הראשונה, או כשהחבילה מתעדכנת)
  let packMsg = '';
  function syncSongs(force) {
    return Library.sync((msg) => {
      const first = !packMsg; packMsg = msg;
      if (first && $('scr-home').classList.contains('on')) renderHome();
      const el = $('packMsg'); if (el) el.textContent = msg;
      const pi = $('packInfo'); if (pi) pi.textContent = '⏳ ' + msg;
    }, force).then(n => {
      packMsg = '';
      if (n) toast(`🎉 נוספו ${n.toLocaleString('he-IL')} שירים!`, 2600);
      if ($('scr-home').classList.contains('on')) renderHome();
      if ($('scr-settings').classList.contains('on')) renderSettings();
    }).catch(() => { packMsg = ''; if ($('scr-home').classList.contains('on')) renderHome(); });
  }
  Library.ready.then(() => { if ($('scr-home').classList.contains('on')) renderHome(); syncSongs(false); });
  $('askInput').addEventListener('input', e => { query = e.target.value.trim(); renderHome(); });
  $('askInput').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

  // ---------- שירים מהאינטרנט (BitMidi) ----------
  let webT = 0, webQ = '', webPage = 0, webItems = [];
  function webRender(state) {
    const el = $('webRes'); if (!el) return;
    if (state === 'wait') { el.innerHTML = '<div class="webmsg"><span class="spin"></span> מחפשת באינטרנט…</div>'; return; }
    if (state === 'err') { el.innerHTML = '<div class="webmsg">😕 אין חיבור לאינטרנט כרגע</div>'; return; }
    if (!webItems.length) { el.innerHTML = `<div class="webmsg">לא נמצא באינטרנט${/[֐-׿]/.test(webQ) ? ' — כדאי לנסות את שם השיר באנגלית (למשל: Let it be)' : ''}</div>`; return; }
    const have = new Set(D.mine.map(s => s.src));
    el.innerHTML = webItems.map(it => `<button class="webitem" data-web="${it.id}"><i>🎵</i><div class="grow"><b dir="auto">${esc(it.title)}</b><small dir="auto">${esc(it.artist || 'אמן לא ידוע')} · ${it.plays.toLocaleString('he-IL')} השמעות</small></div><span class="go">${have.has('bitmidi:' + it.id) ? '✓ יש' : '＋ להוסיף'}</span></button>`).join('') +
      (webItems.more ? '<button class="btn ghost wide" id="webMore">עוד תוצאות</button>' : '') +
      '<div class="webnote">השירים מגיעים מהמאגר BitMidi. כל שיר עובר צמצום אוטומטי למנגינה (יד ימין) ובס (יד שמאל), והאיכות משתנה משיר לשיר.</div>';
  }
  function webSearch(q) {
    if (q === webQ && webItems.length) return webRender();
    clearTimeout(webT); webRender('wait');
    if (q.length < 2) { $('webRes').innerHTML = '<div class="webmsg">הקלידי לפחות שתי אותיות</div>'; return; }
    webT = setTimeout(async () => {
      try {
        const r = await WebSongs.search(q, 0);
        if (q !== query) return;
        webQ = q; webPage = 0; webItems = r.items; webItems.more = r.pages > 1; webRender();
      } catch (e) { if (q === query) webRender('err'); }
    }, 550);
  }
  $('songList').addEventListener('click', async e => {
    if (e.target.closest('#webMore')) {
      const b = e.target.closest('#webMore'); b.disabled = true; b.textContent = 'טוענת…';
      try { const r = await WebSongs.search(webQ, webPage + 1); webPage++; const more = r.page + 1 < r.pages; webItems = webItems.concat(r.items); webItems.more = more; webRender(); }
      catch (err) { toast('😕 אין חיבור לאינטרנט כרגע', 2200); b.disabled = false; b.textContent = 'עוד תוצאות'; }
      return;
    }
    const w = e.target.closest('[data-web]'); if (!w) return;
    const it = webItems.find(x => String(x.id) === w.dataset.web); if (!it) return;
    const exist = D.mine.find(s => s.src === 'bitmidi:' + it.id);
    if (exist) return openSong(exist.id);
    if (w.classList.contains('busy')) return;
    w.classList.add('busy'); w.querySelector('.go').textContent = 'טוענת…';
    try {
      const song = await WebSongs.load(it);
      D.mine.push(song);
      if (Store.save() === false) { D.mine.pop(); toast('אין מספיק מקום במכשיר — כדאי למחוק כמה שירים מ"מהאינטרנט"', 3500); webRender(); return; }
      Snd.chime(true); toast('השיר נוסף! 🎉', 1600);
      $('askInput').value = ''; query = '';
      openSong(song.id);
    } catch (err) {
      toast(err.message === 'net' || err instanceof TypeError ? '😕 אין חיבור לאינטרנט כרגע' : 'לא הצלחתי לקרוא את השיר הזה — נסי תוצאה אחרת', 3000);
      webRender();
    }
  });

  function saveNew(song) {
    D.mine.push(song); Store.save();
    toast('השיר נוסף! 🎉', 1800); openSong(song.id);
  }
  $('midiFile').addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = ''; if (!files.length) return;
    const nameOf = f => f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    if (files.length === 1) {
      try { saveNew(MidiFile.parse(await files[0].arrayBuffer(), nameOf(files[0]))); }
      catch (err) { toast(err.message || 'לא הצלחתי לקרוא את הקובץ', 2500); }
      return;
    }
    let ok = 0;
    for (const [k, f] of files.entries()) {
      try { const sg = MidiFile.parse(await f.arrayBuffer(), nameOf(f)); sg.id += '_' + k; sg.cat = 'mine'; D.mine.push(sg); ok++; } catch (err) { /* מדלגים על קובץ לא תקין */ }
    }
    Store.save(); toast(`נוספו ${ok} שירים 🎉`, 2200); catFilter = 'mine'; go('home');
  });
  async function startRecord() {
    Snd.unlock(); await ensureMic();
    recording = true; go('game'); gameHud('record');
    Game.start({ id: 'rec', title: '', bpm: 120, raw: [] }, { mode: 'record', banner: '⏺ הקלטה' });
  }
  function endRecord() {
    recording = false;
    const raw = Game.recorded(); Game.stop();
    if (raw.length < 4) { toast('לא הוקלטו מספיק תווים', 2000); return go('home'); }
    const title = prompt('איך קוראים לשיר?', 'השיר שלי') || 'השיר שלי';
    saveNew({ id: 'mine_' + Date.now(), title, composer: 'הקלטה שלי', cat: 'mine', level: 3, bpm: 120, beats: 4, raw });
  }

  // ---------- מסך שיר ----------
  async function openSong(id) {
    const found = allSongs().find(s => s.id === id); if (!found) return;
    if (found.lib && !found.raw) { try { await Library.load(found); } catch (e) { toast(e.message || 'לא הצלחתי לפתוח את השיר', 2500); return; } }
    curSong = found;
    D.last = id; Store.save();
    const arrs = Music.arrangements(curSong);
    if (!arrs.some(a => a[0] === arr)) arr = arrs[0][0];
    $('sgTitle').textContent = curSong.title; $('sgComposer').textContent = curSong.composer || '';
    $('sgCover').outerHTML = coverHtml(curSong, true).replace('<div class="cover big"', '<div id="sgCover" class="cover big"');
    const p = D.prog[id] || {};
    $('sgStars').innerHTML = `<span title="לימוד">🐢 ${starHtml(p.wait || 0)}</span><span title="תופסת">🦜 ${starHtml(p.echo || 0)}</span><span title="משחק">🎮 ${starHtml(p.play || 0)}</span>`;
    $('sgArr').innerHTML = arrs.map(([k, n]) => `<button class="chip ${k === arr ? 'sel' : ''}" data-arr="${k}">${n}</button>`).join('');
    document.querySelectorAll('#sgSpeed [data-tempo]').forEach(b => b.classList.toggle('sel', Math.abs(b.dataset.tempo - tempo) < 0.01));
    $('sgDelete').hidden = !D.mine.includes(curSong);
    go('song');
  }
  $('sgArr').addEventListener('click', e => { const b = e.target.closest('[data-arr]'); if (b) { arr = b.dataset.arr; openSong(curSong.id); } });
  $('sgSpeed').addEventListener('click', e => { const b = e.target.closest('[data-tempo]'); if (!b) return; tempo = +b.dataset.tempo; document.querySelectorAll('#sgSpeed [data-tempo]').forEach(x => x.classList.toggle('sel', x === b)); });
  $('sgDelete').onclick = () => { if (confirm('למחוק את השיר?')) { D.mine = D.mine.filter(s => s !== curSong); delete D.prog[curSong.id]; Store.save(); go('home'); } };
  document.querySelector('#scr-song .modes').addEventListener('click', async e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    goFull(); Snd.unlock(); await ensureMic();
    const m = b.dataset.mode;
    if (m === 'smart') {
      const B = Music.build(curSong, arr), secs = [];
      for (let k = 0; k < B.bars; k += 4) secs.push([k === 0 ? 0 : B.pickup + k * B.beats, Math.min(B.total, B.pickup + (k + 4) * B.beats)]);
      runSmart(secs, [0.7, 0.9], true);
    } else if (m === 'echo') runEcho();
    else runSingle(m);
  });

  // ---------- הרצת משחק ----------
  function gameHud(mode) {
    $('gSrc').textContent = Input.micOn ? '🎤 מקשיבה' : Input.midi.ok ? '🎹 MIDI' : '🎤 כבוי';
    $('gSrc').classList.toggle('warn', !Input.micOn && !Input.midi.ok);
    $('gPause').textContent = '⏸';
    ['gPause', 'gSlow', 'gFast', 'gTempo'].forEach(id => { $(id).style.display = mode === 'record' ? 'none' : ''; });
    $('gSkip').style.display = mode === 'wait' ? '' : 'none';
    $('gRec').style.display = mode === 'record' ? 'none' : '';
    recHud();
    Input.mic.peak = 0;
  }
  function launch(o) {
    go('game'); gameHud(o.mode);
    Game.start(curSong, Object.assign({ arr }, o));
    $('gTempo').textContent = Math.round(Game.tempo * 100) + '%';
  }
  function runSingle(mode) {
    lastRun = () => runSingle(mode);
    launch({ mode, tempo, onFinish: showResult });
  }
  function runSmart(secs, stages, finalFull) {
    lastRun = () => runSmart(secs, stages, finalFull);
    go('game'); const tok = smartTok; let si = 0, gi = 0;
    const next = () => {
      if (tok !== smartTok) return;
      if (si >= secs.length) {
        if (finalFull) return launchKeep({ mode: 'play', tempo, banner: '🏁 עכשיו כל השיר!', onFinish: showResult });
        addXP(40, 'החלק הקשה כבר לא קשה! 💪'); return setTimeout(() => { if (tok === smartTok) openSong(curSong.id); }, 1500);
      }
      const tp = Math.round(stages[gi] * tempo * 100) / 100;
      launchKeep({
        mode: 'play', tempo: tp, range: secs[si], banner: `חלק ${si + 1}/${secs.length} · ${Math.round(tp * 100)}%`,
        onFinish: s => {
          if (tok !== smartTok) return;
          touchStreak(); addXP(s.score / 60);
          if (s.acc >= 0.85) { toast(gi + 1 >= stages.length ? 'מעולה! ממשיכים הלאה 🎉' : 'יפה! עכשיו קצת יותר מהר 🐇'); Snd.chime(true); gi++; if (gi >= stages.length) { gi = 0; si++; } }
          else toast('כמעט! עוד פעם, לאט ובזהירות 💪');
          setTimeout(next, 1500);
        },
      });
    };
    const launchKeep = o => { gameHud(o.mode); Game.start(curSong, Object.assign({ arr }, o)); $('gTempo').textContent = Math.round(Game.tempo * 100) + '%'; };
    next();
  }
  // ---------- תופסת מנגינה: שומעים קטע קצר, ומנגנים אותו בחזרה מהזיכרון ----------
  function runEcho() {
    lastRun = () => runEcho();
    go('game'); const tok = smartTok;
    const B = Music.build(curSong, arr), per = B.beats * 2, secs = [];
    for (let k = 0; k < B.bars; k += 2) {
      const sec = [k === 0 ? 0 : B.pickup + k * B.beats, Math.min(B.total, B.pickup + k * B.beats + per)];
      if (B.notes.some(n => n.mine && n.start >= sec[0] - 1e-6 && n.start < sec[1] - 1e-6)) secs.push(sec);
    }
    if (!secs.length) return openSong(curSong.id);
    const agg = { perfect: 0, ok: 0, miss: 0, wrong: 0, total: 0 };
    let i = 0, tries = 0;
    const start = (o) => { gameHud('wait'); Game.start(curSong, Object.assign({ arr, tempo }, o)); $('gTempo').textContent = Math.round(Game.tempo * 100) + '%'; };
    const listen = () => {
      if (tok !== smartTok) return;
      start({ mode: 'listen', onlyMine: true, range: secs[i], banner: `👂 הקשיבי · קטע ${i + 1}/${secs.length}`, onFinish: () => setTimeout(turn, 400) });
    };
    const turn = () => {
      if (tok !== smartTok) return;
      start({
        mode: 'wait', hide: true, range: secs[i], banner: `🦜 עכשיו את! · קטע ${i + 1}/${secs.length}`,
        onFinish: s => {
          if (tok !== smartTok) return;
          const acc = s.total ? (s.perfect + 0.5 * s.ok) / s.total : 1;
          if (acc < 0.75 && tries < 1) { tries++; toast('כמעט! הקשיבי שוב 👂', 1400); return setTimeout(listen, 1200); }
          agg.perfect += s.perfect; agg.ok += s.ok + s.good; agg.miss += s.miss; agg.wrong += s.wrong; agg.total += s.total;
          tries = 0; i++;
          if (acc >= 0.95) { Snd.chime(true); toast(['מושלם! 🎉', 'וואו! 🌟', 'בדיוק ככה! 💜'][i % 3], 1100); }
          if (i >= secs.length) {
            const a = agg.total ? (agg.perfect + 0.5 * agg.ok) / agg.total : 1;
            return showResult({ mode: 'echo', perfect: agg.perfect, good: 0, ok: agg.ok, miss: agg.miss, wrong: agg.wrong, total: agg.total, acc: a,
              stars: a >= 0.9 ? 3 : a >= 0.75 ? 2 : a >= 0.5 ? 1 : 0, score: Math.round(a * 1000), barErr: {}, bars: 0, beats: B.beats, pickup: B.pickup, medOff: null });
          }
          setTimeout(listen, 1300);
        },
      });
    };
    listen();
  }
  $('gExit').onclick = () => { if (recording) return endRecord(); go(curSong ? 'song' : 'home'); };
  $('gSkip').onclick = () => Game.skip();
  // הקלטת הנגינה לשיפור ההאזנה: הצליל + כל החלטה של המשחק, נשמר בהקלטות (הגדרות ← להורים)
  let recUi = 0;
  function recHud() {
    const on = Samples.songOn, b = $('gRec');
    b.classList.toggle('on', on); $('gFlag').hidden = !on;
    if (on) { const s = Math.floor(Samples.songSec); b.textContent = `⏹ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } else b.textContent = '⏺';
  }
  async function saveSongRec() {
    clearInterval(recUi); if (!Samples.songOn) return;
    const p = Samples.songStop(); recHud();
    const m = await p;
    if (m) toast('🎙️ ההקלטה נשמרה ✓ שולחים אותה מ: הגדרות ← להורים ← הקלטות', 4000);
  }
  $('gRec').onclick = async () => {
    if (Samples.songOn) return saveSongRec();
    if (recording) return;
    Snd.unlock(); await ensureMic();
    if (!Samples.songStart()) return;
    toast('⏺ מקליטה! נגני כרגיל. אם האפליקציה טועה, לחצי 🚩', 3000);
    clearInterval(recUi); recUi = setInterval(() => { recHud(); if (Samples.songSec >= Samples.SONG_MAX) { saveSongRec(); toast('ההקלטה הגיעה ל-4 דקות ונשמרה ✓', 3000); } }, 500);
    recHud();
  };
  $('gFlag').onclick = () => { Samples.songFlag(); toast('🚩 סימנתי. תודה!', 900); };
  $('gPause').onclick = () => { $('gPause').textContent = Game.pause() ? '▶' : '⏸'; };
  const nudge = d => { const v = Math.max(0.4, Math.min(1.3, Math.round((Game.tempo + d) * 100) / 100)); Game.setTempo(v); $('gTempo').textContent = Math.round(v * 100) + '%'; };
  $('gSlow').onclick = () => nudge(-0.1);
  $('gFast').onclick = () => nudge(0.1);

  // ---------- תוצאות ----------
  function showResult(s) {
    if (s.mode === 'listen') return openSong(curSong.id);
    // כיוונון עצמי: אם ההקשות מגיעות באופן עקבי מוקדם/מאוחר, מתקנים בהדרגה את פיצוי ההשהיה
    if (s.medOff != null && Input.micOn) { CFG.latency = Math.max(0, Math.min(300, Math.round(CFG.latency + 0.5 * s.medOff * 1000))); Store.save(); }
    Input.syncTune();
    touchStreak();
    const key = s.mode === 'wait' ? 'wait' : s.mode === 'echo' ? 'echo' : 'play';
    const p = D.prog[curSong.id] = D.prog[curSong.id] || {};
    const newBest = s.stars > (p[key] || 0);
    p[key] = Math.max(p[key] || 0, s.stars); p.best = Math.max(p.best || 0, s.score);
    addXP(s.score / 40 + s.stars * 15);
    const ch = challenge();
    if (ch.song && ch.song.id === curSong.id && ((ch.type === 'stars' && key === 'play' && s.stars >= 3) || (ch.type === 'learn' && key === 'wait' && s.stars >= 2) || (ch.type === 'echo' && key === 'echo' && s.stars >= 2))) setTimeout(challengeDone, 1600);
    $('rsStars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= s.stars ? '' : 'off'}">★</span>`).join('');
    $('rsTitle').textContent = s.stars === 3 ? 'מושלם! 🎉' : s.stars === 2 ? 'יפה מאוד!' : s.stars === 1 ? 'התחלה טובה!' : 'ממשיכים לתרגל 💪';
    $('rsAcc').textContent = Math.round(s.acc * 100) + '%';
    $('rsGrid').innerHTML = `<div><b>${s.perfect}</b>מושלם</div><div><b>${s.good + s.ok}</b>טוב</div><div><b>${s.miss}</b>פספוס</div><div><b>${s.wrong}</b>תו שגוי</div>`;
    let tip = '';
    if (s.stars === 3) tip = tempo < 1 ? 'שליטה מלאה! נסי עכשיו במהירות גבוהה יותר 🐇' : 'שליטה מלאה! נסי להוסיף את יד שמאל או אקורדים 🎼';
    else if (s.miss > s.wrong) tip = 'כמה תווים ברחו — כדאי להוריד קצת מהירות (🐢) או לנסות אימון חכם.';
    else if (s.wrong > 0) tip = 'היו כמה תווים לא מדויקים — מצב לימוד 🐢 יעזור לך לדייק אותם.';
    if (newBest && s.stars) tip = 'שיא חדש! ⭐ ' + tip;
    // התיבות הקשות
    const errs = Object.entries(s.barErr).map(([b, n]) => [+b, n]).sort((a, b) => b[1] - a[1]);
    const wb = $('rsWeak'); wb.hidden = true;
    if (errs.length && errs[0][1] >= 1 && s.bars > 2) {
      let b0 = errs[0][0], b1 = b0;
      while (s.barErr[b0 - 1] && b1 - b0 < 3) b0--;
      while (s.barErr[b1 + 1] && b1 - b0 < 3) b1++;
      if (b1 === b0) { if (b1 < s.bars - 1) b1++; else b0--; }
      const rangeB = [b0 === 0 ? 0 : s.pickup + b0 * s.beats, s.pickup + (b1 + 1) * s.beats];
      wb.hidden = false; wb.textContent = `🎯 תרגול התיבות הקשות (${b0 + 1}–${b1 + 1})`;
      wb.onclick = () => runSmart([rangeB], [0.6, 0.8, 1], false);
      tip += ` הכי קשה היה בתיבות ${b0 + 1}–${b1 + 1}.`;
    }
    $('rsTip').textContent = tip.trim();
    Snd.chime(s.stars > 0);
    go('result');
  }
  $('rsAgain').onclick = () => lastRun && lastRun();
  $('rsBack').onclick = () => openSong(curSong.id);

  // ---------- הגדרות ----------
  function renderSettings() {
    const chk = (k, title, sub) => `<div class="set"><label class="r"><span>${title}</span><input type="checkbox" data-k="${k}" ${CFG[k] ? 'checked' : ''}></label>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('setBody').innerHTML =
      `<h3 class="sec">🎤 ההאזנה לאורגנית</h3>` +
      chk('mic', 'האזנה במיקרופון', 'האפליקציה שומעת את הנגינה ובודקת אותה. כדאי לשים את המכשיר קרוב לרמקול של האורגנית.') +
      `<div class="set"><div id="micNote">—</div><div class="meter"><i id="micLvl"></i></div>
        <small>נגני תו אחד — השם שלו יופיע כאן. דיבור ורעשי רקע לא אמורים להופיע.</small>
        </div>` +
      `<h3 class="sec">🎨 תצוגה וצלילים</h3>` +
      `<div class="set"><div class="r"><span>שמות התווים</span><select data-k="names"><option value="sol">דו רה מי</option><option value="letters">C D E</option></select></div></div>` +
      chk('staff', 'חמשה עם תווים מעל השיר') + chk('metro', 'מטרונום (תקתוק קצב)') +
      chk('backing', 'ליווי אוטומטי', 'האפליקציה מנגנת את היד שאת לא מנגנת. כבוי אוטומטית כשהמיקרופון פעיל.') +
      `<h3 class="sec">👨‍👩‍👧 להורים</h3>` +
      `<div class="set"><div class="r"><span>🎙️ הקלטות לכיוונון</span><button class="btn ghost" data-go="samples">פתיחה</button></div>
        <small id="sampleInfo">מקליטים את האורגנית האמיתית (קלידים, אקורדים, רעשי רקע), שומרים ושולחים — כדי לכוונן את ההאזנה בדיוק אליה.</small></div>` +
      `<div class="set"><div class="r"><span>📚 ספריית השירים</span><button class="btn ghost" id="setPack">רענון</button></div>
        <small id="packInfo">${Library.list.length ? `במכשיר יש ${Library.list.length.toLocaleString('he-IL')} שירים מהספרייה. הם נטענים לבד, ומתעדכנים לבד כשנוספים שירים.` : 'השירים נטענים לבד בפעם הראשונה שפותחים את האפליקציה (צריך אינטרנט).'}</small></div>` +
      `<div class="set"><div class="r"><span>📂 הוספת שירים מקובצי MIDI</span><button class="btn ghost" id="setMidi">בחירת קבצים</button></div><small>אפשר לבחור הרבה קבצים בבת אחת. הם נשמרים רק במכשיר הזה, בקטגוריה "השירים שלי".</small></div>` +
      `<div class="set"><div class="r"><span>פיצוי השהיה (מתכוונן לבד)</span><b>${CFG.latency} אלפיות שנייה</b></div>
        <input type="range" data-k="latency" min="0" max="300" step="10" value="${CFG.latency}">
        <div class="r"><span>כיוון הכלי שנלמד</span><b>${(CFG.tune || 0) > 0 ? '+' : ''}${Math.round(CFG.tune || 0)} סנט</b></div></div>` +
      `<div class="set"><div class="r"><span>🎹 חיבור MIDI</span><b>${Input.midi.ok ? esc(Input.midi.devices.join(', ')) : navigator.requestMIDIAccess ? 'לא מחובר' : 'לא נתמך בדפדפן הזה'}</b></div><small>אורגנית עם יציאת USB נותנת את הזיהוי המדויק ביותר (בכרום במחשב ובאנדרואיד).</small></div>` +
      `<div class="set"><small>📱 להתקנה כאפליקציה במסך מלא: בספארי "שיתוף" ← "הוסף למסך הבית".</small></div>` +
      `<button class="link danger" id="setReset">איפוס כל ההתקדמות</button>` +
      `<div class="ver">גרסה ${BUILD}</div>`;
    $('setBody').querySelector('[data-k=names]').value = CFG.names;
    $('setReset').onclick = () => { if (confirm('לאפס כוכבים, ניקוד ורצף? (השירים שהוספת יישארו)')) { D.prog = {}; D.xp = 0; D.streak = { last: '', n: 0 }; D.chordBest = 0; Store.save(); toast('אופס'); } };
    $('setPack').onclick = () => { $('packInfo').textContent = '⏳ בודקת…'; syncSongs(true); };
    $('setMidi').onclick = () => $('midiFile').click();
    Samples.count().then(n => { const el = $('sampleInfo'); if (el && n) el.textContent = n === 1 ? 'הקלטה אחת שמורה במכשיר.' : `${n} הקלטות שמורות במכשיר.`; }).catch(() => {});
    ensureMic();
    const st = CFG.names === 'letters' ? 'letters' : 'sol';
    const loop = () => {
      const lv = $('micLvl'); if (!lv) return;
      lv.style.width = Math.min(100, Input.mic.level * 600) + '%';
      const ns = Input.heldNotes().filter(h => !h.ghost).map(h => Music.name(h.midi, st));
      $('micNote').textContent = ns.length ? ns.join(' ') : Input.micOn ? '🎤 מקשיבה…' : '—';
      setRaf = requestAnimationFrame(loop);
    };
    setRaf = requestAnimationFrame(loop);
  }
  $('setBody').addEventListener('change', async e => {
    const k = e.target.dataset.k; if (!k) return;
    CFG[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' ? +e.target.value : e.target.value;
    Store.save();
    if (k === 'mic') { Snd.unlock(); if (CFG.mic) await ensureMic(); else Input.stopMic(); }
    if (k === 'names') renderSettings();
  });

  // ---------- מסך מלא ----------
  const fsEl = document.documentElement;
  const inFs = () => document.fullscreenElement || document.webkitFullscreenElement;
  const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  function goFull() {
    if (inFs() || standalone()) return true;
    const rq = fsEl.requestFullscreen || fsEl.webkitRequestFullscreen;
    if (!rq) return false;
    try {
      const r = rq.call(fsEl, { navigationUI: 'hide' });
      // במסך מלא (אנדרואיד) נועלים לרוחב — כך רואים יותר קלידים
      const lock = () => { try { const p = screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'); if (p && p.catch) p.catch(() => {}); } catch (e) { /* לא נתמך */ } };
      if (r && r.then) r.then(lock, () => {}); else lock();
    } catch (e) { return false; }
    return true;
  }
  $('fsBtn').onclick = () => {
    if (inFs()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (!goFull()) toast('במכשיר הזה: "שיתוף" ← "הוסף למסך הבית", ואז האפליקציה נפתחת במסך מלא', 4500);
  };
  if (standalone()) $('fsBtn').hidden = true;

  // ---------- עדכון אוטומטי ----------
  // דף שנשמר במטמון (או אפליקציה שהוצמדה למסך הבית) לא תמיד נטען מחדש לבד. בכל פתיחה, ובכל חזרה למסך,
  // בודקים אם יש גרסה חדשה באתר — ואם כן, טוענים אותה (רק כשלא באמצע שיר).
  const BUILD = '20261115b';
  async function checkUpdate() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = (await r.json()).v;
      if (!v || v === BUILD || Game.running || recording || Samples.songOn) return;
      // פעם אחת לכל גרסה — כדי לא להיכנס ללולאה אם השרת עוד לא סיים להתעדכן
      let tried = ''; try { tried = sessionStorage.getItem('ksUpd') || ''; sessionStorage.setItem('ksUpd', v); } catch (e) { /* מצב פרטי */ }
      if (tried !== v) location.replace(location.pathname + '?v=' + v);
    } catch (e) { /* בלי אינטרנט — ממשיכים עם מה שיש */ }
  }
  checkUpdate();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });

  // ---------- אתחול ----------
  Game.init($('gameCv'));
  Chords.init($('chCv'), addXP);
  Samples.init({ toast, ensureMic });
  Input.initMIDI();
  renderHome();
  window.App = { go, openSong };
})();

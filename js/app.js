// מסכים, התקדמות וחיבור כל החלקים
(() => {
  const $ = id => document.getElementById(id);
  const D = Store.d;
  D.wishes = D.wishes || [];
  let curSong = null, arr = 'rh', tempo = 1, lastRun = null, smartTok = 0, catFilter = 'all', pendingAdd = null, recording = false, setRaf = 0;
  const allSongs = () => [...SONGS, ...D.mine];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const starsOf = id => { const p = D.prog[id]; return p ? Math.max(p.wait || 0, p.play || 0) : 0; };
  const starHtml = n => `<span class="st">${[1, 2, 3].map(i => `<span class="${i <= n ? '' : 'off'}">★</span>`).join('')}</span>`;

  let toastT = 0;
  function toast(msg, ms = 1500) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

  function go(name) {
    document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.go === name));
    $('app').classList.toggle('full', !['home', 'chords', 'settings'].includes(name));
    if (name !== 'game') { smartTok++; Game.stop(); }
    if (name === 'chords') { ensureMic(); Chords.show(); } else Chords.hide();
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
    $('stStreak').textContent = D.streak.n ? `🔥 ${D.streak.n}` : '';
    $('stStars').textContent = `⭐ ${allSongs().reduce((s, x) => s + starsOf(x.id), 0)}`;
    $('xpFill').style.width = ((D.xp - base) / (next - base) * 100).toFixed(0) + '%';
  }

  // ---------- בית / קטלוג ----------
  function renderHome() {
    renderStats();
    const day = Math.floor(Date.now() / 864e5), ds = SONGS[day % SONGS.length];
    const done = (D.prog[ds.id] || {}).play === 3;
    $('daily').innerHTML = `<button class="daily" data-song="${ds.id}"><div><b>${done ? '✅' : '🎯'} האתגר היומי: ${esc(ds.title)}</b><span>${done ? 'הושלם! כל הכבוד' : 'השיגי 3 כוכבים במצב נגינה'}</span></div><span class="go">▶</span></button>`;
    $('catChips').innerHTML = [['all', 'הכול'], ...CATS].map(([id, n]) => `<button class="chip ${catFilter === id ? 'sel' : ''}" data-cat="${id}">${n}</button>`).join('');
    const have = new Set(D.mine.map(s => s.title));
    let html = '';
    for (const [cid, cname] of CATS) {
      if (catFilter !== 'all' && catFilter !== cid) continue;
      const songs = allSongs().filter(s => s.cat === cid);
      const wants = cid === 'mine' ? D.wishes.filter(w => !have.has(w.title)).map(w => ['mine', w.title, 'הבקשה שלי'])
        : CATALOG.filter(c => c[0] === cid && !have.has(c[1]));
      html += `<div class="cat">${cname}</div><div class="grid">`;
      for (const s of songs) {
        const dots = [1, 2, 3, 4, 5].map(i => `<i class="${i <= s.level ? 'f' : ''}"></i>`).join('');
        html += `<button class="card" data-song="${s.id}"><b>${esc(s.title)}</b><small>${esc(s.composer || '')}</small><div class="row"><span class="dots">${dots}</span>${starHtml(starsOf(s.id))}</div></button>`;
      }
      wants.forEach(w => { html += `<button class="card want" data-want="${esc(w[1])}" data-artist="${esc(w[2])}" data-wcat="${cid}"><b>${esc(w[1])}</b><small>${esc(w[2])}</small><div class="row"><span>＋ להוסיף</span></div></button>`; });
      if (cid === 'mine') html += '<button class="card add" data-rec="1">⏺<br>הקלטת שיר חדש</button><button class="card add" data-midi="1">📂<br>קובץ MIDI</button>';
      html += '</div>';
    }
    $('songList').innerHTML = html;
  }
  $('scr-home').addEventListener('click', e => {
    const c = e.target.closest('[data-cat]'); if (c) { catFilter = c.dataset.cat; renderHome(); return; }
    const s = e.target.closest('[data-song]'); if (s) { openSong(s.dataset.song); return; }
    const w = e.target.closest('[data-want]'); if (w) { openAdd({ title: w.dataset.want, artist: w.dataset.artist, cat: w.dataset.wcat }); return; }
    if (e.target.closest('[data-rec]')) { pendingAdd = null; startRecord(); return; }
    if (e.target.closest('[data-midi]')) { pendingAdd = null; $('midiFile').click(); }
  });
  $('askForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('askInput').value.trim(); if (!v) return;
    $('askInput').value = ''; $('askInput').blur();
    const found = allSongs().find(s => s.title.includes(v));
    if (found) return openSong(found.id);
    const cat = CATALOG.find(c => c[1].toLowerCase().includes(v.toLowerCase()));
    if (cat) return openAdd({ title: cat[1], artist: cat[2], cat: cat[0] });
    if (!D.wishes.some(w => w.title === v)) { D.wishes.push({ title: v }); Store.save(); }
    openAdd({ title: v, artist: 'הבקשה שלי', cat: 'mine' });
  });

  // ---------- הוספת שיר (יוטיוב + הקלטה / MIDI) ----------
  function openAdd(item) {
    pendingAdd = item;
    $('adTitle').textContent = item.title; $('adArtist').textContent = item.artist || '';
    $('adRemove').hidden = !D.wishes.some(w => w.title === item.title);
    showVideo();
    go('add');
  }
  const ytId = u => { const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([\w-]{11})/.exec(u || ''); return m ? m[1] : null; };
  function showVideo() {
    const id = pendingAdd && D.videos[pendingAdd.title];
    $('adVideo').innerHTML = id ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1" allow="encrypted-media; fullscreen" allowfullscreen></iframe>` : '';
  }
  $('adVidForm').addEventListener('submit', e => {
    e.preventDefault();
    const id = ytId($('adVidUrl').value.trim());
    if (!id) return toast('לא זיהיתי קישור לסרטון', 2000);
    D.videos[pendingAdd.title] = id; Store.save(); $('adVidUrl').value = ''; showVideo();
  });
  $('adRec').onclick = () => startRecord();
  $('adMidi').onclick = () => $('midiFile').click();
  $('adRemove').onclick = () => { D.wishes = D.wishes.filter(w => w.title !== pendingAdd.title); Store.save(); go('home'); };

  function saveNew(song) {
    if (pendingAdd) { song.title = pendingAdd.title; song.composer = pendingAdd.cat === 'mine' ? song.composer : pendingAdd.artist; song.cat = pendingAdd.cat; }
    D.mine.push(song); Store.save(); pendingAdd = null;
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
    // כמה קבצים בבת אחת: כל קובץ נהיה שיר, בקטגוריה שממנה נכנסנו
    let ok = 0; const cat = pendingAdd ? pendingAdd.cat : 'mine';
    for (const [k, f] of files.entries()) {
      try { const sg = MidiFile.parse(await f.arrayBuffer(), nameOf(f)); sg.id += '_' + k; sg.cat = cat; D.mine.push(sg); ok++; } catch (err) { /* מדלגים על קובץ לא תקין */ }
    }
    Store.save(); pendingAdd = null; toast(`נוספו ${ok} שירים 🎉`, 2200); go('home');
  });
  async function startRecord() {
    Snd.unlock(); await ensureMic();
    recording = true; go('game'); gameHud('record');
    Game.start({ id: 'rec', title: '', bpm: 120, raw: [] }, { mode: 'record', banner: '⏺ הקלטה' });
  }
  function endRecord() {
    recording = false;
    const raw = Game.recorded(); Game.stop();
    if (raw.length < 4) { toast('לא הוקלטו מספיק תווים', 2000); return go(pendingAdd ? 'add' : 'home'); }
    const title = pendingAdd ? pendingAdd.title : (prompt('איך קוראים לשיר?', 'השיר שלי') || 'השיר שלי');
    saveNew({ id: 'mine_' + Date.now(), title, composer: 'הקלטה שלי', cat: 'mine', level: 3, bpm: 120, beats: 4, raw });
  }

  // ---------- מסך שיר ----------
  function openSong(id) {
    curSong = allSongs().find(s => s.id === id); if (!curSong) return;
    const arrs = Music.arrangements(curSong);
    if (!arrs.some(a => a[0] === arr)) arr = arrs[0][0];
    $('sgTitle').textContent = curSong.title; $('sgComposer').textContent = curSong.composer || '';
    const p = D.prog[id] || {};
    $('sgStars').innerHTML = `<span>🐢 ${starHtml(p.wait || 0)}</span><span>🎮 ${starHtml(p.play || 0)}</span>`;
    $('sgArr').innerHTML = arrs.map(([k, n]) => `<button class="chip ${k === arr ? 'sel' : ''}" data-arr="${k}">${n}</button>`).join('');
    $('sgDelete').hidden = !D.mine.includes(curSong);
    go('song');
  }
  $('sgArr').addEventListener('click', e => { const b = e.target.closest('[data-arr]'); if (b) { arr = b.dataset.arr; openSong(curSong.id); } });
  $('sgTempo').addEventListener('input', e => { tempo = e.target.value / 100; $('sgTempoVal').textContent = e.target.value + '%'; });
  $('sgDelete').onclick = () => { if (confirm('למחוק את השיר?')) { D.mine = D.mine.filter(s => s !== curSong); delete D.prog[curSong.id]; Store.save(); go('home'); } };
  document.querySelector('#scr-song .modes').addEventListener('click', async e => {
    const b = e.target.closest('[data-mode]'); if (!b) return;
    goFull(); Snd.unlock(); await ensureMic();
    const m = b.dataset.mode;
    if (m === 'smart') {
      const B = Music.build(curSong, arr), secs = [];
      for (let k = 0; k < B.bars; k += 4) secs.push([k === 0 ? 0 : B.pickup + k * B.beats, Math.min(B.total, B.pickup + (k + 4) * B.beats)]);
      runSmart(secs, [0.7, 0.9], true);
    } else runSingle(m);
  });

  // ---------- הרצת משחק ----------
  function gameHud(mode) {
    $('gSrc').textContent = Input.micOn ? '🎤 מקשיבה' : Input.midi.ok ? '🎹 MIDI' : '🎤 כבוי';
    $('gSrc').classList.toggle('warn', !Input.micOn && !Input.midi.ok);
    $('gPause').textContent = '⏸';
    ['gPause', 'gSlow', 'gFast', 'gTempo'].forEach(id => { $(id).style.display = mode === 'record' ? 'none' : ''; });
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
  $('gExit').onclick = () => { if (recording) return endRecord(); go(curSong ? 'song' : 'home'); };
  $('gPause').onclick = () => { $('gPause').textContent = Game.pause() ? '▶' : '⏸'; };
  const nudge = d => { const v = Math.max(0.4, Math.min(1.3, Math.round((Game.tempo + d) * 100) / 100)); Game.setTempo(v); $('gTempo').textContent = Math.round(v * 100) + '%'; };
  $('gSlow').onclick = () => nudge(-0.1);
  $('gFast').onclick = () => nudge(0.1);

  // ---------- תוצאות ----------
  function showResult(s) {
    if (s.mode === 'listen') return openSong(curSong.id);
    touchStreak();
    const key = s.mode === 'wait' ? 'wait' : 'play';
    const p = D.prog[curSong.id] = D.prog[curSong.id] || {};
    const newBest = s.stars > (p[key] || 0);
    p[key] = Math.max(p[key] || 0, s.stars); p.best = Math.max(p.best || 0, s.score);
    addXP(s.score / 40 + s.stars * 15);
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
      `<div class="set"><div class="r"><span>שמות התווים</span><select data-k="names"><option value="sol">דו רה מי</option><option value="letters">C D E</option></select></div></div>` +
      chk('mic', '🎤 האזנה לפסנתר במיקרופון', 'האפליקציה שומעת את הנגינה ובודקת אותה. שימי את המכשיר קרוב לרמקול של האורגנית.') +
      `<div class="set"><div id="micNote">—</div><div class="meter"><i id="micLvl"></i></div>
        <div class="r"><span>פיצוי השהיה</span><input type="range" data-k="latency" min="0" max="300" step="10" value="${CFG.latency}"></div>
        <small>בדיקה: נגני תו אחד — השם שלו אמור להופיע למעלה. דיבור ורעשי רקע לא אמורים להופיע.</small></div>` +
      `<div class="set"><div class="r"><span>🎹 חיבור MIDI</span><b>${Input.midi.ok ? esc(Input.midi.devices.join(', ')) : navigator.requestMIDIAccess ? 'לא מחובר' : 'לא נתמך בדפדפן הזה'}</b></div><small>חיבור האורגנית בכבל USB נותן את הזיהוי המדויק ביותר (נתמך בכרום במחשב ובאנדרואיד).</small></div>` +
      chk('backing', 'ליווי אוטומטי', 'האפליקציה מנגנת את היד שאת לא מנגנת. כבוי אוטומטית כשהמיקרופון פעיל.') +
      chk('metro', 'מטרונום') + chk('staff', 'הצגת חמשה עם תווים') +
      `<div class="set"><small>📱 להתקנה כאפליקציה: בספארי לחצי על "שיתוף" ← "הוסף למסך הבית".</small></div>` +
      `<button class="link danger" id="setReset">איפוס כל ההתקדמות</button>`;
    $('setBody').querySelector('[data-k=names]').value = CFG.names;
    $('setReset').onclick = () => { if (confirm('לאפס כוכבים, ניקוד ורצף? (השירים שהוספת יישארו)')) { D.prog = {}; D.xp = 0; D.streak = { last: '', n: 0 }; D.chordBest = 0; Store.save(); toast('אופס'); } };
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
    try { const r = rq.call(fsEl, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => {}); } catch (e) { return false; }
    return true;
  }
  $('fsBtn').onclick = () => {
    if (inFs()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (!goFull()) toast('במכשיר הזה: "שיתוף" ← "הוסף למסך הבית", ואז האפליקציה נפתחת במסך מלא', 4500);
  };
  if (standalone()) $('fsBtn').hidden = true;

  // ---------- אתחול ----------
  Game.init($('gameCv'));
  Chords.init($('chCv'), addXP);
  Input.initMIDI();
  renderHome();
  window.App = { go, openSong };
})();

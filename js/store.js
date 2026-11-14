// שמירת הגדרות והתקדמות במכשיר
const Store = (() => {
  const KEY = 'keysStar.v1';
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
  d = Object.assign({ prog: {}, xp: 0, streak: { last: '', n: 0 }, mine: [], chordBest: 0 }, d || {});
  d.settings = Object.assign({ names: 'sol', mic: true, sens: 40, latency: 120, metro: false, backing: true, staff: true }, d.settings || {});
  if (!d.v2) { d.v2 = 1; d.settings.mic = true; }
  if (!d.v3) { d.v3 = 1; d.settings.latency = 140; }
  d.videos = d.videos || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* אין מקום / מצב פרטי */ } };
  return { d, save, KEY };
})();
const CFG = Store.d.settings;

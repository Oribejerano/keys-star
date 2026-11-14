// שמירת הגדרות והתקדמות במכשיר
const Store = (() => {
  const KEY = 'keysStar.v1';
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch (e) { d = null; }
  d = Object.assign({ prog: {}, xp: 0, streak: { last: '', n: 0 }, mine: [], chordBest: 0 }, d || {});
  d.settings = Object.assign({ names: 'sol', mic: true, sens: 40, latency: 120, metro: false, backing: true, staff: true }, d.settings || {});
  if (!d.v2) { d.v2 = 1; d.settings.mic = true; }
  if (!d.v3) { d.v3 = 1; d.settings.latency = 140; }
  if (!d.v4) { d.v4 = 1; d.settings.latency = 60; d.settings.tune = 0; } // גרסה 2 של מנוע ההאזנה: חותמת זמן להקשה
  d.videos = d.videos || {};
  // מחזיר false אם השמירה נכשלה (אין מקום במכשיר / מצב פרטי)
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } };
  return { d, save, KEY };
})();
const CFG = Store.d.settings;

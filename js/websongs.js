// חיפוש שירים באינטרנט (מאגר BitMidi): מחפשים לפי שם, והשיר שנבחר נטען ישירות מהמאגר לתוך האפליקציה.
// שום קובץ לא נשמר באתר שלנו — השיר נשמר רק במכשיר של מי שהוסיפה אותו.
const WebSongs = (() => {
  const BASE = 'https://bitmidi.com';
  const cache = new Map(); // "שאילתה|עמוד" -> תוצאות
  // "Queen - Bohemian Rhapsody.mid" -> {title: 'Bohemian Rhapsody', artist: 'Queen'}
  function names(raw) {
    let n = String(raw || '').replace(/\.(mid|midi|kar)$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/\s/.test(n)) n = n.replace(/-+/g, ' '); // Let-It-Be -> Let It Be
    n = n.replace(/^([A-Z][A-Za-z&' ]{1,30})\.(?=[A-Z])/, '$1 - '); // ESTEFAN.Let it snow -> ESTEFAN - Let it snow
    const m = /^(.{2,40}?)\s+[-–]\s+(.{2,})$/.exec(n);
    return m ? { title: m[2].trim(), artist: m[1].trim() } : { title: n, artist: '' };
  }
  async function search(q, page = 0) {
    const key = q.toLowerCase() + '|' + page;
    if (cache.has(key)) return cache.get(key);
    const r = await fetch(`${BASE}/api/midi/search?q=${encodeURIComponent(q)}&page=${page}`);
    if (!r.ok) throw new Error('net');
    const j = (await r.json()).result || {};
    const res = { items: (j.results || []).map(x => Object.assign({ id: x.id, plays: x.plays || 0, url: BASE + (x.downloadUrl || `/uploads/${x.id}.mid`) }, names(x.name))), total: j.total || 0, pages: j.pageTotal || 0, page };
    cache.set(key, res);
    return res;
  }
  async function load(item) {
    const r = await fetch(item.url);
    if (!r.ok) throw new Error('net');
    const song = MidiFile.parse(await r.arrayBuffer(), item.title);
    return Object.assign(song, { id: 'web_' + item.id, title: item.title, composer: item.artist || 'מהאינטרנט', cat: 'web', src: 'bitmidi:' + item.id });
  }
  return { search, load, names };
})();

// ספריית שירים במכשיר: "חבילת שירים" (קובץ .ksp שנבנה מתיקיית MIDI עם tools/build-pack.js) נטענת פעם אחת
// ונשמרת במסד הנתונים של הדפדפן (IndexedDB) — יש בו מקום לאלפי שירים, בניגוד לאחסון הרגיל (כ-5MB).
// ברשימה נשמרים רק הפרטים (שם, אמן, קטגוריה, רמה); התווים עצמם נטענים רק כשפותחים שיר.
const Library = (() => {
  let list = [], dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('no-idb'));
    const r = indexedDB.open('keysStarLib', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('meta'); r.result.createObjectStore('notes'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
  }));
  const tx = (stores, mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction(stores, mode); let out;
    try { out = fn(...stores.map(s => t.objectStore(s))); } catch (e) { return rej(e); }
    t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = t.onabort = () => rej(t.error || new Error('tx'));
  }));
  const toEntry = s => ({ id: s.id, title: s.t, composer: s.a || '', cat: s.c || 'pop', level: s.l || 3, bpm: s.b || 120, beats: s.m || 4, lib: true });

  const ready = tx(['meta'], 'readonly', m => m.get('index'))
    .then(ix => { list = (ix && ix.songs) || []; return list; })
    .catch(() => (list = []));

  // טעינת קובץ החבילה (דחוס ב-gzip). onProgress(שלב, אחוז)
  async function importPack(file, onProgress) {
    const prog = onProgress || (() => {});
    prog('קוראת את הקובץ…', 0);
    let bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      if (!window.DecompressionStream) throw new Error('הדפדפן הזה ישן מדי לפתיחת החבילה — כדאי לעדכן את המכשיר');
      prog('פותחת את החבילה…', 5);
      bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    }
    let pack;
    try { pack = JSON.parse(new TextDecoder().decode(bytes)); } catch (e) { throw new Error('זה לא קובץ של חבילת שירים'); }
    if (!pack || pack.app !== 'keys-star-pack' || !Array.isArray(pack.songs)) throw new Error('זה לא קובץ של חבילת שירים');
    bytes = null;
    await tx(['meta', 'notes'], 'readwrite', (m, n) => { m.clear(); n.clear(); });
    const songs = pack.songs, entries = [];
    for (let i = 0; i < songs.length; i += 400) {
      const part = songs.slice(i, i + 400);
      await tx(['notes'], 'readwrite', n => { for (const s of part) n.put({ n: s.n, y: s.y || null }, s.id); });
      for (const s of part) entries.push(toEntry(s));
      prog(`שומרת שירים… ${Math.min(songs.length, i + 400)} / ${songs.length}`, 10 + 90 * Math.min(1, (i + 400) / songs.length));
    }
    await tx(['meta'], 'readwrite', m => m.put({ songs: entries, made: pack.made, at: Date.now() }, 'index'));
    list = entries;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    return entries.length;
  }
  // התווים של שיר: [תו, התחלה בפעמות, משך, יד]
  async function load(entry) {
    if (entry.raw) return entry;
    const rec = await tx(['notes'], 'readonly', n => n.get(entry.id));
    if (!rec) throw new Error('השיר לא נמצא במכשיר');
    const raw = [], n = rec.n; let t = 0;
    for (let i = 0; i + 2 < n.length; i += 3) { t += n[i + 1]; raw.push([n[i] >> 1, t / 48, n[i + 2] / 48, n[i] & 1 ? 'L' : 'R']); }
    entry.raw = raw; if (rec.y) entry.lyrics = rec.y;
    return entry;
  }
  async function clear() { await tx(['meta', 'notes'], 'readwrite', (m, n) => { m.clear(); n.clear(); }); list = []; }
  return { ready, importPack, load, clear, get list() { return list; } };
})();

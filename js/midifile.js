// קורא קבצי MIDI רגילים (.mid) והופך אותם לשיר באפליקציה.
// קובץ של עיבוד מלא (תופים, גיטרות, כלי מיתר, בס...) מצומצם למה שלומדים לנגן: מנגינה ליד ימין ובס ליד שמאל.
// קובץ פסנתר (עד שני חלקים) נשמר כמו שהוא.
const MidiFile = {
  parse(buf, title) {
    const d = new DataView(buf); let p = 0;
    const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p++)); return s; };
    if (d.byteLength < 14 || str(4) !== 'MThd') throw new Error('זה לא קובץ MIDI');
    const hl = d.getUint32(p); p += 4;
    const nt = d.getUint16(p + 2), div = d.getUint16(p + 4); p += hl;
    if (div & 0x8000) throw new Error('פורמט זמן לא נתמך');
    let bpm = 0, beats = 0; const lyr = [], txt = [];
    const parts = new Map(); // "track:channel" -> {notes, name, prog}
    const dec = (o, l) => { const b = new Uint8Array(buf, o, l); try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { try { return new TextDecoder('windows-1255').decode(b); } catch (e2) { return ''; } } };
    for (let k = 0; k < nt && p < d.byteLength - 8; k++) {
      const id = str(4), len = d.getUint32(p); p += 4; const end = Math.min(d.byteLength, p + len);
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, rs = 0, tname = ''; const on = {}, prog = {};
      const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 127); } while (b & 128 && p < end); return v; };
      const part = ch => { const key = k + ':' + ch; let pt = parts.get(key); if (!pt) { pt = { notes: [], name: '', prog: -1 }; parts.set(key, pt); } return pt; };
      try {
        while (p < end) {
          tick += vlq();
          let s = d.getUint8(p);
          if (s & 0x80) { p++; if (s < 0xf0) rs = s; } else s = rs;
          if (s === 0xff) {
            const ty = d.getUint8(p++), l = vlq();
            if (ty === 0x51 && l === 3 && !bpm) bpm = 6e7 / ((d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2));
            if (ty === 0x58 && !beats) beats = d.getUint8(p) * 4 / Math.pow(2, d.getUint8(p + 1));
            if (ty === 5 && l) lyr.push([tick / div, dec(p, l)]);
            if (ty === 1 && l) txt.push([tick / div, dec(p, l)]);
            if ((ty === 3 || ty === 4) && l && !tname) tname = dec(p, Math.min(l, 60));
            p += l;
          } else if (s === 0xf0 || s === 0xf7) { const l = vlq(); p += l; }
          else {
            const hi = s & 0xf0, ch = s & 15, a = d.getUint8(p++), b = (hi === 0xc0 || hi === 0xd0) ? 0 : d.getUint8(p++);
            if (hi === 0xc0) { prog[ch] = a; continue; }
            if (ch === 9 || a < 28 || a > 100) continue; // ערוץ 10 = תופים
            const kk = ch * 128 + a;
            if (hi === 0x90 && b > 0) on[kk] = tick;
            else if ((hi === 0x80 || hi === 0x90) && on[kk] != null) {
              const pt = part(ch); pt.notes.push([a, on[kk] / div, Math.max(0.1, (tick - on[kk]) / div)]);
              if (pt.prog < 0 && prog[ch] != null) pt.prog = prog[ch];
              delete on[kk];
            }
          }
        }
      } catch (e) { /* קובץ שנקטע באמצע — משתמשים במה שנקרא עד כאן */ }
      for (const [key, pt] of parts) if (key.startsWith(k + ':') && !pt.name) pt.name = tname;
      p = end;
    }
    const all = [...parts.values()].filter(pt => pt.notes.length);
    if (!all.length) throw new Error('לא נמצאו תווים בקובץ');
    for (const pt of all) pt.notes.sort((a, b) => a[1] - b[1] || b[0] - a[0]);

    const avg = pt => pt.notes.reduce((s, n) => s + n[0], 0) / pt.notes.length;
    // כמה מההקשות בחלק נשמעות יחד עם הקשה אחרת (אקורדים) — מנגינה כמעט תמיד "תו אחד בכל פעם"
    const poly = pt => { let c = 0; const ns = pt.notes; for (let i = 0; i < ns.length; i++) if ((i > 0 && ns[i][1] - ns[i - 1][1] < 0.06) || (i + 1 < ns.length && ns[i + 1][1] - ns[i][1] < 0.06)) c++; return c / ns.length; };
    // "קו עליון/תחתון": בכל רגע שומרים רק את התו הגבוה (מנגינה) או הנמוך (בס)
    const line = (ns, high) => {
      const out = [];
      for (const n of ns) {
        const last = out[out.length - 1];
        if (last && n[1] - last[1] < 0.06) { if (high ? n[0] > last[0] : n[0] < last[0]) out[out.length - 1] = n; continue; }
        if (last && last[1] + last[2] > n[1]) last[2] = Math.max(0.1, n[1] - last[1]); // בלי חפיפה
        out.push(n.slice());
      }
      return out;
    };

    let raw = [];
    if (all.length <= 2) { // קובץ פסנתר: ימין ושמאל כמו שהם
      if (all.length === 1) raw = all[0].notes.map(n => [...n, n[0] >= 60 ? 'R' : 'L']);
      else { all.sort((a, b) => avg(b) - avg(a)); all.forEach((pt, i) => pt.notes.forEach(n => raw.push([...n, i === 0 ? 'R' : 'L']))); }
    } else {
      const span = Math.max(1, ...all.map(pt => pt.notes[pt.notes.length - 1][1])) - Math.min(...all.map(pt => pt.notes[0][1]));
      const bad = /bass|drum|perc|pad|string|chord|accomp|rhythm|choir|brass sec|strings|בס|תופים/i, good = /melod|vocal|voice|lead|sing|lyric|solo|tune|מנגינה|שירה|קול/i;
      const scored = all.map(pt => {
        const a = avg(pt), pl = poly(pt), n = pt.notes.length, pr = pt.prog;
        let sc = Math.min(n, span * 4) * Math.pow(1 - pl, 2);
        sc *= a >= 60 && a <= 80 ? 1 : a > 80 ? 0.6 : Math.max(0.05, 1 - (60 - a) / 12);
        if (good.test(pt.name)) sc *= 3; else if (bad.test(pt.name)) sc *= 0.2;
        if ((pr >= 32 && pr <= 55) || (pr >= 88 && pr <= 103) || pr >= 112) sc *= 0.3; // בס, כלי מיתר, צלילי רקע, אפקטים
        if (n < span * 0.15) sc *= 0.3; // מופיע רק לרגעים
        return { pt, a, pl, sc };
      }).sort((x, y) => y.sc - x.sc);
      const mel = scored[0];
      const rest = scored.slice(1).filter(s => s.a < mel.a - 5);
      const bassOf = s => (/bass|בס/i.test(s.pt.name) || (s.pt.prog >= 32 && s.pt.prog <= 39) ? 3 : 1) * (s.a < 55 ? 2 : 0.5) * Math.min(s.pt.notes.length, span * 2) * (1 - 0.5 * s.pl);
      const bass = rest.sort((x, y) => bassOf(y) - bassOf(x))[0];
      line(mel.pt.notes, true).forEach(n => raw.push([...n, 'R']));
      if (bass) line(bass.pt.notes, false).forEach(n => raw.push([n[0] < 36 ? n[0] + 12 : n[0], n[1], n[2], 'L']));
    }
    const off = Math.floor(Math.min(...raw.map(n => n[1])));
    raw = raw.map(n => [n[0], Math.round((n[1] - off) * 1000) / 1000, Math.round(n[2] * 1000) / 1000, n[3]]).sort((a, b) => a[1] - b[1]);
    beats = Math.max(2, Math.round(beats || 4));
    bpm = Math.round(bpm || 120);
    // רמת קושי לפי קצב המנגינה (תווים בשנייה)
    const rh = raw.filter(n => n[3] === 'R'), secs = rh.length > 1 ? (rh[rh.length - 1][1] - rh[0][1]) * 60 / bpm : 1, nps = rh.length / Math.max(1, secs);
    const level = nps < 1.3 ? 2 : nps < 2.3 ? 3 : nps < 3.5 ? 4 : 5;
    // מילים: אירועי lyric, או טקסט בסגנון קריוקי. מקבצים הברות לשורות
    const src = lyr.length > 4 ? lyr : txt.filter(x => x[0] > 0 && x[1][0] !== '@');
    const lyrics = []; let cur = null;
    if (src.length > 4) for (const [b, rawTxt] of src) {
      const brk = /^[\/\\]|[\r\n]/.test(rawTxt), w = rawTxt.replace(/[\/\\\r\n]/g, '');
      if (!cur || brk || cur[1].length > 34) { cur = [Math.round((b - off) * 100) / 100, '']; lyrics.push(cur); }
      cur[1] += w;
    }
    return { id: 'mine_' + Date.now(), title, composer: 'קובץ MIDI', cat: 'mine', level, bpm, beats, raw, lyrics: lyrics.filter(l => l[1].trim()).map(l => [l[0], l[1].trim()]) };
  },
};
if (typeof module !== 'undefined' && module.exports) module.exports = MidiFile;

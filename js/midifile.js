// קורא קבצי MIDI רגילים (.mid) והופך אותם לשיר באפליקציה
const MidiFile = {
  parse(buf, title) {
    const d = new DataView(buf); let p = 0;
    const str = n => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(d.getUint8(p++)); return s; };
    if (str(4) !== 'MThd') throw new Error('זה לא קובץ MIDI');
    const hl = d.getUint32(p); p += 4;
    const nt = d.getUint16(p + 2), div = d.getUint16(p + 4); p += hl;
    if (div & 0x8000) throw new Error('פורמט זמן לא נתמך');
    let bpm = 0, beats = 0; const tracks = [];
    for (let k = 0; k < nt && p < d.byteLength - 8; k++) {
      const id = str(4), len = d.getUint32(p); p += 4; const end = p + len;
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, rs = 0; const on = {}, ns = [];
      const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 127); } while (b & 128); return v; };
      while (p < end) {
        tick += vlq();
        let s = d.getUint8(p);
        if (s & 0x80) { p++; if (s < 0xf0) rs = s; } else s = rs;
        if (s === 0xff) {
          const ty = d.getUint8(p++), l = vlq();
          if (ty === 0x51 && l === 3 && !bpm) bpm = 6e7 / ((d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2));
          if (ty === 0x58 && !beats) beats = d.getUint8(p) * 4 / Math.pow(2, d.getUint8(p + 1));
          p += l;
        } else if (s === 0xf0 || s === 0xf7) { const l = vlq(); p += l; }
        else {
          const hi = s & 0xf0, ch = s & 15, a = d.getUint8(p++), b = (hi === 0xc0 || hi === 0xd0) ? 0 : d.getUint8(p++);
          if (ch === 9 || a < 28 || a > 100) continue;
          if (hi === 0x90 && b > 0) on[a] = tick;
          else if ((hi === 0x80 || hi === 0x90) && on[a] != null) { ns.push([a, on[a] / div, Math.max(0.1, (tick - on[a]) / div)]); delete on[a]; }
        }
      }
      p = end; if (ns.length) tracks.push(ns);
    }
    if (!tracks.length) throw new Error('לא נמצאו תווים בקובץ');
    const avg = tr => tr.reduce((s, n) => s + n[0], 0) / tr.length;
    let raw = [];
    if (tracks.length === 1) raw = tracks[0].map(n => [...n, n[0] >= 60 ? 'R' : 'L']);
    else {
      tracks.sort((a, b) => avg(b) - avg(a));
      tracks.forEach((tr, i) => tr.forEach(n => raw.push([...n, i === 0 ? 'R' : 'L'])));
    }
    const off = Math.floor(Math.min(...raw.map(n => n[1])));
    raw = raw.map(n => [n[0], Math.round((n[1] - off) * 1000) / 1000, Math.round(n[2] * 1000) / 1000, n[3]]).sort((a, b) => a[1] - b[1]);
    beats = Math.max(2, Math.round(beats || 4));
    return { id: 'mine_' + Date.now(), title, composer: 'קובץ MIDI', cat: 'mine', level: 3, bpm: Math.round(bpm || 120), beats, raw };
  },
};

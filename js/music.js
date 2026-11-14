// כלי מוזיקה בסיסיים: שמות תווים, פענוח שירים, אקורדים
const Music = (() => {
  const LET = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const SOL = ['דו', 'דו♯', 'רה', 'רה♯', 'מי', 'פה', 'פה♯', 'סול', 'סול♯', 'לה', 'לה♯', 'סי'];
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7] };
  const QHEB = { '': "מז'ור", m: 'מינור', '7': '7', m7: 'מינור 7', maj7: "מז'ור 7", dim: 'מוקטן', sus4: 'סוס 4' };

  const pc = m => ((m % 12) + 12) % 12;
  function toMidi(s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) throw new Error('תו לא תקין: ' + s);
    return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
  }
  const name = (m, style) => (style === 'letters' ? LET : SOL)[pc(m)];
  const isBlack = m => [1, 3, 6, 8, 10].includes(pc(m));

  function parseLine(str, hand) {
    const out = []; let t = 0;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [p, d] = tok.split(':');
      const dur = d ? parseFloat(d) : 1;
      if (p !== 'R') for (const nn of p.split('+')) out.push({ midi: toMidi(nn), start: t, dur, hand });
      t += dur;
    }
    return out;
  }

  function parseChord(nm) {
    const m = /^([A-G])([#b]?)(maj7|m7|m|7|dim|sus4)?$/.exec(nm);
    if (!m) throw new Error('אקורד לא תקין: ' + nm);
    const root = pc(PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
    const q = m[3] || '';
    return { name: nm, root, q, iv: QUAL[q], flat: m[2] === 'b' };
  }
  function chordNotes(ch, low = 43, triad = false) {
    let r = ch.root; while (r < low) r += 12;
    return (triad ? ch.iv.slice(0, 3) : ch.iv).map(i => r + i);
  }
  function chordHeb(nm, style) {
    const c = parseChord(nm);
    const names = style === 'letters' ? LET : SOL;
    const rootName = c.flat ? names[pc(c.root + 1)] + '♭' : names[c.root];
    return rootName + ' ' + QHEB[c.q];
  }
  function parseChords(str, beats, pickup) {
    const out = []; let t = pickup;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [p, d] = tok.split(':');
      const dur = d ? parseFloat(d) : beats;
      out.push({ name: p, start: t, dur, ch: parseChord(p) });
      t += dur;
    }
    return out;
  }

  function arrangements(song) {
    if (song.raw) return song.raw.some(n => n[3] === 'L')
      ? [['rh', 'יד ימין'], ['lh', 'יד שמאל'], ['both', 'שתי ידיים']] : [['rh', 'יד ימין']];
    if (song.lh) return [['rh', 'יד ימין'], ['lh', 'יד שמאל'], ['both', 'שתי ידיים']];
    if (song.chords) return [['rh', 'מנגינה'], ['bass', 'מנגינה + בס'], ['chords', 'מנגינה + אקורדים']];
    return [['rh', 'יד ימין']];
  }

  // בונה רשימת תווים מוכנה למשחק לפי העיבוד שנבחר
  function build(song, arr) {
    const beats = song.beats || 4, pickup = song.pickup || 0;
    let R = [], L = [], chords = [];
    if (song.raw) {
      for (const [m, s, d, h] of song.raw) (h === 'L' ? L : R).push({ midi: m, start: s, dur: d, hand: h });
    } else {
      R = parseLine(song.rh, 'R');
      if (song.lh) L = parseLine(song.lh, 'L');
    }
    if (song.chords) chords = parseChords(song.chords, beats, pickup);
    if (!song.raw && !song.lh && chords.length) {
      const bass = arr === 'bass';
      for (const c of chords) {
        const ns = chordNotes(c.ch, 43, true);
        for (const m of (bass ? ns.slice(0, 1) : ns)) L.push({ midi: m, start: c.start, dur: c.dur, hand: 'L' });
      }
    }
    const mineR = arr !== 'lh', mineL = arr !== 'rh';
    const notes = [...R.map(n => ({ ...n, mine: mineR })), ...L.map(n => ({ ...n, mine: mineL }))]
      .sort((a, b) => a.start - b.start || a.midi - b.midi);
    let end = 0; for (const n of notes) end = Math.max(end, n.start + n.dur);
    const total = pickup + Math.ceil((end - pickup - 1e-6) / beats) * beats;
    return { notes, chords, lyrics: song.lyrics || [], total, beats, pickup, bars: Math.round((total - pickup) / beats) };
  }

  return { LET, SOL, pc, toMidi, name, isBlack, parseChord, chordNotes, chordHeb, arrangements, build };
})();

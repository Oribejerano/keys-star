// ספריית השירים. כתיב: "תו:משך" (משך בפעימות, ברירת מחדל 1), R = הפסקה, | = קו תיבה (לקריאות בלבד)
// chords: "אקורד:משך" (ברירת מחדל: תיבה שלמה) — מהם נבנית יד שמאל אוטומטית (בס / אקורדים)
const SONGS = (() => {
  const rep = (s, n) => Array(n).fill(s).join(' ');

  // לאליזה — פעימה = שמינית
  const feA = 'E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 | A4:1 R:.5 C4:.5 E4:.5 A4:.5 | B4:1 R:.5 E4:.5 G#4:.5 B4:.5 | C5:1 R:.5 E4:.5 E5:.5 D#5:.5 | E5:.5 D#5:.5 E5:.5 B4:.5 D5:.5 C5:.5 | A4:1 R:.5 C4:.5 E4:.5 A4:.5 | B4:1 R:.5 E4:.5 C5:.5 B4:.5';
  const feL = 'R:3 | A2:.5 E3:.5 A3:.5 R:1.5 | E2:.5 E3:.5 G#3:.5 R:1.5 | A2:.5 E3:.5 A3:.5 R:1.5 | R:3 | A2:.5 E3:.5 A3:.5 R:1.5 | E2:.5 E3:.5 G#3:.5 R:1.5';

  const hatA = 'D4:.5 E4:.5 F4:.5 G4:.5 A4 A4 | Bb4:.5 A4:.5 Bb4:.5 D5:.5 A4:2 | G4 G4:.5 G4:.5 F4 F4 | E4:.5 D4:.5 E4:.5 F4:.5 D4:2';
  const hatB = 'D4 D5 D5 D5 | C5:.5 D5:.5 C5:.5 Bb4:.5 A4:2';
  const hatC = 'C5 C5:.5 C5:.5 F4 F4 | G4:.5 A4:.5 Bb4:.5 C5:.5 A4:1.5 G4:.25 F4:.25 | G4 G4:.5 G4:.5 F4 F4 | E4:.5 D4:.5 E4:.5 F4:.5 D4:2';

  const gsEnd = 'C5:1.5 B4:.5 A4 | G#4:1.5 F#4:.5 G#4 | A4:3 | A4:3';
  const gsMid = 'D5:2 B4 | G4:1.5 A4:.5 B4';
  const gsV = `C5:2 D5 | E5:1.5 F#5:.5 E5 | ${gsMid} | C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:2 A4 | C5:2 D5 | E5:1.5 F#5:.5 E5 | ${gsMid} | ${gsEnd}`;
  const gsC = `G5:3 | G5:1.5 F#5:.5 E5 | ${gsMid} | C5:2 A4 | A4:1.5 G#4:.5 A4 | B4:2 G#4 | E4:3 | G5:3 | G5:1.5 F#5:.5 E5 | ${gsMid} | ${gsEnd}`;

  const mk = 'A3:.5 B3:.5 C4:.5 D4:.5 E4:.5 C4:.5 E4 | D#4:.5 B3:.5 D#4 D4:.5 Bb3:.5 D4 | A3:.5 B3:.5 C4:.5 D4:.5 E4:.5 C4:.5 E4:.5 A4:.5 | G4:.5 E4:.5 C4:.5 E4:.5 G4:2';
  const cc = 'D4:.5 F4:.5 E4:.5 D4:.5 | G4 G4 | G4:.5 A4:.5 E4:.5 F4:.5 | D4 D4 | D4:.5 F4:.5 E4:.5 D4:.5';
  const jb = 'E4 E4 E4:2 | E4 E4 E4:2 | E4 G4 C4:1.5 D4:.5 | E4:4 | F4 F4 F4:1.5 F4:.5 | F4 E4 E4 E4:.5 E4:.5';
  const mn = 'D5 G4:.5 A4:.5 B4:.5 C5:.5 | D5 G4 G4 | E5 C5:.5 D5:.5 E5:.5 F#5:.5 | G5 G4 G4 | C5 D5:.5 C5:.5 B4:.5 A4:.5 | B4 C5:.5 B4:.5 A4:.5 G4:.5';
  const odeA = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4';

  return [
    // ---------- חימום ושירים מוכרים ----------
    { id: 'twinkle', title: 'כוכב קטן', composer: 'עממי (מוצרט עיבד)', cat: 'known', level: 1, bpm: 100,
      rh: 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2',
      chords: 'C F:2 C:2 F:2 C:2 G:2 C:2 C:2 F:2 C:2 G:2 C:2 F:2 C:2 G:2 C F:2 C:2 F:2 C:2 G:2 C:2' },
    { id: 'jacob', title: 'אחינו יעקב', composer: 'עממי צרפתי', cat: 'known', level: 1, bpm: 110,
      rh: 'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2',
      chords: 'C C C C C C C:1 G:1 C:2 C:1 G:1 C:2' },
    { id: 'yonatan', title: 'יונתן הקטן', composer: 'עממי גרמני', cat: 'israeli', level: 1, bpm: 112,
      rh: 'G4 E4 E4:2 | F4 D4 D4:2 | C4 D4 E4 F4 | G4 G4 G4:2 | G4 E4 E4:2 | F4 D4 D4:2 | C4 E4 G4 G4 | C4:4 | D4 D4 D4 D4 | D4 E4 F4:2 | E4 E4 E4 E4 | E4 F4 G4:2 | G4 E4 E4:2 | F4 D4 D4:2 | C4 E4 G4 G4 | C4:4',
      chords: 'C G C C C G C C G G C C C G C C' },
    { id: 'birthday', title: 'יום הולדת שמח', composer: 'עממי', cat: 'known', level: 2, bpm: 100, beats: 3, pickup: 1,
      rh: 'G4:.75 G4:.25 | A4 G4 C5 | B4:2 G4:.75 G4:.25 | A4 G4 D5 | C5:2 G4:.75 G4:.25 | G5 E5 C5 | B4 A4 F5:.75 F5:.25 | E5 C5 D5 | C5:3',
      chords: 'C G G C C F C:2 G:1 C' },
    { id: 'jingle', title: "ג'ינגל בלס", composer: 'ג׳יימס פיירפונט', cat: 'known', level: 2, bpm: 120,
      rh: `${jb} | E4 D4 D4 E4 | D4:2 G4:2 | ${jb} | G4 G4 F4 D4 | C4:4`,
      chords: 'C C C C F C D G C C C C F C G C' },
    { id: 'hatikvah', title: 'התקווה', composer: 'ההמנון הלאומי', cat: 'israeli', level: 3, bpm: 80,
      rh: `${hatA} | ${hatA} | ${hatB} | ${hatB} | ${hatC} | ${hatC}`,
      chords: rep('Dm Gm:2 Dm:2 Gm:2 Dm:2 A:2 Dm:2', 2) + ' ' + rep('Dm Gm:2 Dm:2', 2) + ' ' + rep('F C:2 F:2 Gm:2 Dm:2 A:2 Dm:2', 2) },

    // ---------- קלאסי ----------
    { id: 'ode', title: 'אודה לשמחה', composer: 'בטהובן', cat: 'classic', level: 1, bpm: 108,
      rh: `${odeA} | E4:1.5 D4:.5 D4:2 | ${odeA} | D4:1.5 C4:.5 C4:2 | D4 D4 E4 C4 | D4 E4:.5 F4:.5 E4 C4 | D4 E4:.5 F4:.5 E4 D4 | C4 D4 G3:2 | ${odeA} | D4:1.5 C4:.5 C4:2`,
      chords: 'C G C C:2 G:2 C G C G:2 C:2 G:2 C:2 G:2 C:2 G:2 C:1 G:1 Am:1 D:1 G:2 C G C G:2 C:2' },
    { id: 'cancan', title: 'קאן-קאן', composer: 'אופנבך', cat: 'classic', level: 2, bpm: 116, beats: 2,
      rh: `C4:2 | ${cc} | C4:.5 C5:.5 B4:.5 A4:.5 | G4:.5 F4:.5 E4:.5 D4:.5 | C4:2 | ${cc} | C4:.5 G4:.5 D4:.5 E4:.5 | C4:2`,
      chords: 'C G C C G G C G C G C C G G C:1 G:1 C' },
    { id: 'kleine', title: 'מוזיקת לילה זעירה', composer: 'מוצרט', cat: 'classic', level: 2, bpm: 120,
      rh: rep('G4 R:.5 D4:.5 G4 R:.5 D4:.5 | G4:.5 D4:.5 G4:.5 B4:.5 D5 R | C5 R:.5 A4:.5 C5 R:.5 A4:.5 | C5:.5 A4:.5 F#4:.5 A4:.5 D4 R', 2),
      chords: rep('G G D D', 2) },
    { id: 'mountain', title: 'בהיכל מלך ההר', composer: 'גריג', cat: 'classic', level: 3, bpm: 104,
      rh: `${mk} | ${mk}`, chords: rep('Am B:2 Bb:2 Am C', 2) },
    { id: 'lullaby', title: 'שיר ערש', composer: 'ברהמס', cat: 'classic', level: 2, bpm: 92, beats: 3, pickup: 1,
      rh: 'E4:.5 E4:.5 | G4:1.5 E4:.5 E4 | G4:2 E4:.5 G4:.5 | C5 B4:1.5 A4:.5 | A4 G4 D4:.5 E4:.5 | F4 D4 D4:.5 E4:.5 | F4:2 D4:.5 F4:.5 | B4:.5 A4:.5 G4 B4 | C5:2 C4:.5 C4:.5 | C5:2 A4:.5 F4:.5 | G4:2 E4:.5 C4:.5 | F4 G4 A4 | G4:2 C4:.5 C4:.5 | C5:2 A4:.5 F4:.5 | G4:2 E4:.5 C4:.5 | F4 E4 D4 | C4:3',
      chords: 'C C C G G G G C F C F C F C G C' },
    { id: 'minuet', title: "מינואט בסול מז'ור", composer: 'באך / פצולד', cat: 'classic', level: 3, bpm: 108, beats: 3,
      rh: `${mn} | F#4 G4:.5 A4:.5 B4:.5 G4:.5 | A4:3 | ${mn} | A4 B4:.5 A4:.5 G4:.5 F#4:.5 | G4:3`,
      chords: 'G G C G Am G D D G G C G Am G D G' },
    { id: 'greensleeves', title: 'גרינסליבס', composer: 'עממי אנגלי', cat: 'classic', level: 3, bpm: 112, beats: 3, pickup: 1,
      rh: `A4 | ${gsV} | ${gsC}`,
      chords: 'Am Am G G Am Am E E Am Am G G Am E Am Am C C G G Am Am E E C C G G Am E Am Am' },
    { id: 'canon', title: 'קאנון ברה', composer: 'פכלבל', cat: 'classic', level: 3, bpm: 84,
      rh: 'F#5:2 E5:2 | D5:2 C#5:2 | B4:2 A4:2 | B4:2 C#5:2 | D5:2 C#5:2 | B4:2 A4:2 | G4:2 F#4:2 | G4:2 E4:2 | D4 F#4 A4 G4 | F#4 D4 F#4 E4 | D4 B3 D4 A4 | G4 B4 A4 G4 | F#4 D4 E4 C#5 | D5 F#5 A5 A4 | B4 G4 A4 F#4 | D4 D5 D5:1.5 C#5:.5 | D5:4',
      chords: rep('D:2 A:2 Bm:2 F#m:2 G:2 D:2 G:2 A:2', 4) + ' D' },
    { id: 'elise', title: 'לאליזה', composer: 'בטהובן', cat: 'classic', level: 4, bpm: 140, beats: 3, pickup: 1,
      rh: `E5:.5 D#5:.5 | ${feA} | A4:1 R:1 E5:.5 D#5:.5 | ${feA} | A4:3`,
      lh: `R:1 | ${feL} | A2:.5 E3:.5 A3:.5 R:1.5 | ${feL} | A2:.5 E3:.5 A3:2` },
    { id: 'turkish', title: 'המארש הטורקי', composer: 'מוצרט', cat: 'classic', level: 5, bpm: 112, beats: 2, pickup: 1,
      rh: 'B4:.25 A4:.25 G#4:.25 A4:.25 | C5:.5 R:.5 D5:.25 C5:.25 B4:.25 C5:.25 | E5:.5 R:.5 F5:.25 E5:.25 D#5:.25 E5:.25 | B5:.25 A5:.25 G#5:.25 A5:.25 B5:.25 A5:.25 G#5:.25 A5:.25 | C6 A5:.5 C6:.5 | B5:.5 A5:.5 G5:.5 A5:.5 | B5:.5 A5:.5 G5:.5 A5:.5 | B5:.5 A5:.5 G5:.5 F#5:.5 | E5:2',
      chords: 'Am Am Am Am Em Em B Em' },
  ];
})();

const CATS = [['mine', '📂 השירים שלי'], ['ilnew', '🎤 ישראלי חדש'], ['disney', '🎬 דיסני וסרטים'], ['known', '🎈 שירים מוכרים'],
  ['israeli', '🇮🇱 ישראלי'], ['rock', '🎸 רוק קלאסי'], ['classic', '🎻 קלאסי']];

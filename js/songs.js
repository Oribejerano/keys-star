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
  const su = 'E4 G4 G4:1.5 A4:.5 | G4 E4 C4:1.5 D4:.5';
  const ag = 'C4:2 E4:.5 C4:.5 | E4:2 D4';
  const sn = 'G4:1.5 A4:.5 G4 | E4:3', sn2 = 'A4:2 A4 | C5:1.5 B4:.5 A4 | G4:1.5 A4:.5 G4 | E4:3';
  const odeA = 'E4 E4 F4 G4 | G4 F4 E4 D4 | C4 C4 D4 E4';

  // ---------- חנוכה (התווים לפי דפי תווים מוכרים: תו ישראלי, ויקיפדיה ואוספי ABC) ----------
  const nlA = 'E4:.5 F4:.5 G4:.5 A4:.5 G4 E4 | F4:.5 E4:.5 D4:.5 F4:.5 E4:2 | E4:.5 F4:.5 G4:.5 A4:.5 G4 E4 | F4 E4:.5 D4:.5 C4:2';
  const nlB = 'E4 A4:.5 B4:.5 C5 C5 | B4 B4 A4:2 | G4 G4:.5 A4:.5 G4 E4 | F4 E4:.5 D4:.5 C4:2';
  const bcA = 'A4:1.5 G4:.5 A4 C5 | B4 C5 A4 R | A4:1.5 G4:.5 A4 C5 | B4 C5 A4 R | D5:1.5 C5:.5 D5:1.5 C5:.5 | A4 C5 D5 R | D5:1.5 C5:.5 D5:1.5 C5:.5 | A4 C5 D5 R';
  const bcB = 'E5:.5 D5:.5 C5 C5 A4 | A4 G4 A4 R | E5:.5 D5:.5 C5:2 E5 | D5 C5:.5 B4:.5 A4:2';
  const chA = 'G4 E4 G4:2 | G4 E4 G4:2 | E4 G4 C5 B4 | A4:4';
  const svA = 'A4:.5 A4:.5 B4 C5:.5 C5:.5 B4 | E5:.5 E5:.5 D5:.25 C5:.25 B4:.25 A4:.25 C5:.5 C5:.5 B4 | A4:.5 A4:.5 B4 C5:.5 C5:.5 D5 | E5:.5 E5:.5 E5:.5 E4:.5 A4:.5 A4:.5 A4';
  const svB = 'D5:.5 D5:.5 D5:.5 F5:.5 E5:.5 E5:.5 C5:.25 B4:.25 A4:.5 | G#4:.5 G#4:.5 E4:.5 G#4:.5 A4:.5 B4:.5 C5:.25 B4:.25 A4:.5';
  const kdA = 'E4:1.5 D4:.5 E4 R | E4:1.5 D4:.5 E4 R:.5 E4:.5 | E4 A4 E4 F#4 | G4:1.5 F#4:.5 E4 R';
  const kdB = 'E4 B4 A4 A4 | E4 D4 G4:2 | E4 B4 A4 E4:.5 F#4:.5 | G4 F#4 E4:2 | A4 D4 D4 D4 | D4 C#4:.5 D4:.5 E4:2 | G4 E4 D4 E4:.5 F#4:.5 | G4 F#4 E4:2';
  const clyA = 'G4:.5 G4:.5 A4:.5 B4:.5 G4 R:.5 D4:.5', clyB = 'C5:.75 B4:.25 C5:.5 D5:.5 B4 R:.5 B4:.5 | A4:.75 G4:.25 A4:.5 B4:.5 G4 R:.5 G4:.5';
  const clyC = 'G4:.5 F#4:.25 E4:.25 D4:.5 G4:.5 G4 R:.5 G4:.5 | G4:.5 F#4:.25 E4:.25 D4:.5 B4:.5 G4 R:.5 G4:.5';
  const hnA = 'B4 B4:.75 B4:.25 B4 B4 | B4:.5 A4:.5 G4:.5 A4:.5 B4 G4:.75 G4:.25 | D5 D5:.75 D5:.25 D5 D5:.75 D5:.25 | D5:.5 C5:.5 B4:.5 C5:.5 D5 B4';
  const hnB = 'D5:.5 G5:.5 B4:.5 C5:.5 D5 R:.5 D5:.5 | D5:.5 G5:.5 B4:.5 C5:.5 D5 R:.5 D5:.5 | E5:.5 D5:.5 C5:.5 B4:.5 A4 D5 | B4:.5 B4:.5 A4:.5 A4:.5 G4:2';
  const hnC = 'B4 B4 B4 B4 | B4:.5 A4:.5 G4:.5 A4:.5 B4 G4 | D5 D5 D5 D5 | D5:.5 C5:.5 B4:.5 C5:.5 D5 B4 | D5:.5 G5:.5 B4:.5 C5:.5 D5:2 | D5:.5 G5:.5 B4:.5 C5:.5 D5:2 | E5:.5 D5:.5 C5:.5 B4:.5 A4 D5 | B4 A4 G4:2';
  const hvA = 'C5 A4:.75 Bb4:.25 C5 F4 | G4:.25 A4:.25 Bb4:.25 C5:.25 Bb4:.5 A4:.5 G4:2 | A4:.25 Bb4:.25 C5:.25 D5:.25 C5:.5 C5:.5 F5 C5 | Bb4:.5 A4:.5 G4:.75 F4:.25 F4:2';
  const hvB = 'A4:.25 G4:.25 A4:.25 Bb4:.25 A4:.5 A4:.5 G4 F4 | Bb4:.5 A4:.5 G4:.5 F4:.5 E4:2 | F4:.25 E4:.25 F4:.25 G4:.25 F4:.5 F4:.5 D5 B4 | C5:.5 D5:.25 C5:.25 B4:.5 B4:.5 C5:2';
  const mzA = 'C4 G3 C4 F4 | E4 D4 C4:1.5 G4:.5 | G4 A4 D4 E4:.5 F4:.5';
  const mzB = 'E4:1.5 F4:.5 G4:1.5 A4:.5 | D4:1.5 E4:.5 F4:2 | E4 C4 A4 G4:.5 F4:.5';
  const ymA = 'E4:.5 | E4:.5 E4:.5 E4:.5 E4:.5 | A4 E4:.5 E4:.5 | E4 D4:.5 C4:.5 | D4 C4:.5 E4:.5 | E4:.5 E4:.5 E4:.5 E4:.5 | A4 E4:.5 E4:.5 | E4 D4:.5 C4:.5 | D4 C4';
  const ymB = 'C4:.5 D4:.5 E4:.5 D4:.5 | C4 C4 | D4 C4:.5 B3:.5';
  const ymC = 'E4 E4:.5 E4:.5 | F4 E4:.5 D4:.5';
  const drA = 'C4 C4 D4 D4 | E4 C4:2 E4 | G4 G4 F4 E4 | D4:3 D4 | D4 D4 D4 E4 | F4 D4:2 D4 | G4 F4 E4 D4';
  const drB = 'G4 E4 G4 E4 | G4 E4:2 E4 | G4 G4 F4 E4 | D4:3 D4 | F4 D4 F4 D4 | F4 D4:2 D4 | G4 F4 E4 D4';

  return [
    // ---------- 🕎 חנוכה ----------
    { id: 'h_sevivon', title: 'סביבון סוב סוב סוב', composer: 'לוין קיפניס · עממי', cat: 'hanukkah', level: 2, bpm: 100,
      rh: `${svA} | ${svB} | ${svB.replace(/ \| [^|]*$/, '')} | G#4:.5 G#4:.5 E4:.5 G#4:.5 A4:.5 A4:.5 A4`,
      chords: 'Am:1 E:1 Am:1 E:1 Am:1 Dm:1 Am:1 E:1 Am:1 E:1 Am:1 Dm:1 E:2 Am:2 Dm:2 Am:2 E:2 Am:2 Dm:2 Am:2 E:2 Am:2' },
    { id: 'h_chanukah', title: 'חנוכה חנוכה חג יפה כל כך', composer: 'לוין קיפניס · עממי', cat: 'hanukkah', level: 1, bpm: 112,
      rh: `${chA} | F4 D4 F4:2 | F4 D4 F4:2 | D4 F4 B4 A4 | G4:4 | ${chA} | B4 B4 B4:2 | B4 B4 B4:2 | B4 G4 A4 B4 | C5:4`,
      chords: 'C C C F G7 G7 G7 C C C C F G7 G7 G7 C' },
    { id: 'h_nerli', title: 'נר לי דקיק', composer: 'לוין קיפניס · דניאל סמבורסקי', cat: 'hanukkah', level: 1, bpm: 104,
      rh: `${nlA} | ${nlB} | ${nlB}`,
      chords: rep('C G7:2 C:2', 2) + ' ' + rep('Am E7:2 F:2 C G7:2 C:2', 2) },
    { id: 'h_banu', title: 'באנו חושך לגרש', composer: 'שרה לוי-תנאי · עמנואל עמירן', cat: 'hanukkah', level: 2, bpm: 108,
      rh: `${bcA} | ${bcB} | ${bcB}`,
      chords: 'Am G:2 Am:2 Am G:2 Am:2 Dm Am:2 Dm:2 Dm Am:2 Dm:2 ' + rep('Am Am:1 G:1 Am:2 Am G:2 Am:2', 2) },
    { id: 'h_kad', title: 'כד קטן', composer: 'אהרון אשמן · יואל ולבה', cat: 'hanukkah', level: 2, bpm: 100,
      rh: `${kdA} | ${kdA} | ${kdB}`,
      chords: rep('Em Em Em:2 Am:2 B7:2 Em:2', 2) + ' Em:2 Am:2 D:2 G:2 Em:2 Am:2 B7:2 Em:2 D D:2 Em:2 Em:2 D:2 B7:2 Em:2' },
    { id: 'h_chanukiya', title: 'חנוכייה לי יש', composer: 'שרה גלוזמן · ניסן כהן מלמד', cat: 'hanukkah', level: 2, bpm: 104, pickup: 0.5,
      rh: `D4:.5 | ${clyA} | ${clyA.replace('D4:.5', 'G4:.5')} | ${clyB} | ${clyB} | ${clyC} | G4:.5 F#4:.25 E4:.25 D4:.5 G4:.5 G4 R:.5 G4:.5 | G4:.5 F#4:.25 E4:.25 D4:.5 B4:.5 G4:2`,
      chords: 'G:1 D7:1 G:2 G:1 D7:1 G:2 C:2 G:2 D7:2 G:2 C:2 G:2 D7:2 G:2 ' + rep('G:1 D7:1 G:2', 4) },
    { id: 'h_hanerot', title: 'הנרות הללו', composer: 'מן המקורות · עממי', cat: 'hanukkah', level: 3, bpm: 100, pickup: 0.5,
      rh: `D4:.5 | ${hnA} | ${hnB} | ${hnC}`,
      chords: 'G D7:2 G:2 G D7:2 G:2 G G C:2 D7:2 G:1 D7:1 G:2 G D7:2 G:2 G D7:2 G:2 G G C:2 D7:2 G:1 D7:1 G:2' },
    { id: 'h_maoz', title: 'מעוז צור', composer: 'פיוט · לחן מסורתי', cat: 'hanukkah', level: 3, bpm: 96,
      rh: `${mzA} | E4 D4 C4:1.5 C4:.5 | ${mzA} | E4 D4 C4:2 | G4:1.5 G4:.5 A4 B4 | C5:2 G4:2 | C5 B4 A4 G4 | G4:.5 F4:.5 E4:.5 F4:.5 D4:2 | ${mzB} | E4 F4 G4:2 | ${mzB} | E4 D4 C4:2`,
      chords: rep('C:2 F:2 C:1 G:1 C:2 C:1 F:1 G:2 C:1 G:1 C:2', 2) + ' C:2 G:2 C C:1 G:1 F:1 C:1 C:1 F:1 G:2 C G:2 F:2 C:2 F:2 C:2 G:2 C G:2 F:2 C:2 F:2 C:1 G:1 C:2',
      lyrics: [[0, 'מעוז צור ישועתי'], [16, 'תיכון בית תפילתי'], [32, 'לעת תכין מטבח'], [48, 'אז אגמור בשיר מזמור']] },
    { id: 'h_yemei', title: 'ימי החנוכה', composer: 'אברהם אברונין · עממי', cat: 'hanukkah', level: 2, bpm: 120, beats: 2, pickup: 0.5,
      rh: `${ymA} | ${ymB} | C4:2 | ${ymB} | A3 A3:.5 C4:.5 | E4 E4 | R A3:.5 C4:.5 | E4 E4 | R A3 | ${ymC} | E4:2 | R:2 | ${ymC} | E4:.5 E4:.5 E4:.5 E4:.5 | F4 E4:.5 D4:.5 | C4 C4:.5 C4:.5 | D4 C4:.5 D4:.5 | E4:2 | R:2 | ${ymC} | E4:.5 E4:.5 E4:.5 E4:.5 | F4 E4:.5 D4:.5 | C4 C4:.5 C4:.5 | D4 C4:.5 B3:.5 | A3:2`,
      chords: 'Am Am Dm:1 Am:1 Dm:1 Am:1 Am Am Dm:1 Am:1 Dm:1 Am:1 C C G C C C G Am Am Am Am Am Am Dm E E Am Dm Am Dm C G Am Am Am Dm Am Dm C Dm:1 E:1 Am' },
    { id: 'h_dreidel', title: 'I Have a Little Dreidel', composer: 'סביבון באנגלית · עממי', cat: 'hanukkah', level: 1, bpm: 120, pickup: 1,
      rh: `G4 | ${drA} | C4:3 E4 | ${drB} | C4:3`,
      chords: 'C:2 G7:2 C Em:2 A7:2 Dm Dm:2 A7:2 Dm G7 C C C Em:2 A7:2 Dm Dm Dm:2 G7:2 G7 C' },
    { id: 'h_narima', title: 'הבה נרימה', composer: 'לוין קיפניס · הנדל', cat: 'hanukkah', level: 4, bpm: 96,
      rh: `${hvA} | ${hvB} | ${hvA}`,
      chords: 'F C7 F:2 Dm:2 Gm:1 C7:1 F:2 F:2 A7:1 Dm:1 Gm:2 A7:2 Dm:2 G7:2 C:1 G7:1 C:2 F C7 F:2 Dm:2 Gm:1 C7:1 F:2' },

    // ---------- חימום ושירים מוכרים ----------
    { id: 'twinkle', title: 'כוכב קטן', composer: 'עממי (מוצרט עיבד)', cat: 'known', level: 1, bpm: 100,
      rh: 'C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | G4 G4 F4 F4 | E4 E4 D4:2 | C4 C4 G4 G4 | A4 A4 G4:2 | F4 F4 E4 E4 | D4 D4 C4:2',
      chords: 'C F:2 C:2 F:2 C:2 G:2 C:2 C:2 F:2 C:2 G:2 C:2 F:2 C:2 G:2 C F:2 C:2 F:2 C:2 G:2 C:2',
      lyrics: [[0, 'Twinkle, twinkle, little star'], [8, 'How I wonder what you are'], [16, 'Up above the world so high'], [24, 'Like a diamond in the sky'], [32, 'Twinkle, twinkle, little star'], [40, 'How I wonder what you are']] },
    { id: 'jacob', title: 'אחינו יעקב', composer: 'עממי צרפתי', cat: 'known', level: 1, bpm: 110,
      rh: 'C4 D4 E4 C4 | C4 D4 E4 C4 | E4 F4 G4:2 | E4 F4 G4:2 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | G4:.5 A4:.5 G4:.5 F4:.5 E4 C4 | C4 G3 C4:2 | C4 G3 C4:2',
      chords: 'C C C C C C C:1 G:1 C:2 C:1 G:1 C:2',
      lyrics: [[0, 'אחינו יעקב, אחינו יעקב'], [8, 'אל תישן, אל תישן'], [16, 'הפעמון מצלצל, הפעמון מצלצל'], [24, 'דין דן דון, דין דן דון']] },
    { id: 'yonatan', title: 'יונתן הקטן', composer: 'עממי גרמני', cat: 'israeli', level: 1, bpm: 112,
      rh: 'G4 E4 E4:2 | F4 D4 D4:2 | C4 D4 E4 F4 | G4 G4 G4:2 | G4 E4 E4:2 | F4 D4 D4:2 | C4 E4 G4 G4 | C4:4 | D4 D4 D4 D4 | D4 E4 F4:2 | E4 E4 E4 E4 | E4 F4 G4:2 | G4 E4 E4:2 | F4 D4 D4:2 | C4 E4 G4 G4 | C4:4',
      chords: 'C G C C C G C C G G C C C G C C',
      lyrics: [[0, 'יונתן הקטן'], [8, 'רץ בבוקר אל הגן'], [16, 'הוא טיפס על העץ'], [24, 'אפרוחים חיפש'], [32, 'אוי ואבוי לו לשובב'], [40, 'חור גדול במכנסיו'], [48, 'מן העץ התגלגל'], [56, 'ועונשו קיבל']] },
    { id: 'birthday', title: 'יום הולדת שמח', composer: 'עממי', cat: 'known', level: 2, bpm: 100, beats: 3, pickup: 1,
      rh: 'G4:.75 G4:.25 | A4 G4 C5 | B4:2 G4:.75 G4:.25 | A4 G4 D5 | C5:2 G4:.75 G4:.25 | G5 E5 C5 | B4 A4 F5:.75 F5:.25 | E5 C5 D5 | C5:3',
      chords: 'C G G C C F C:2 G:1 C',
      lyrics: [[0, 'יום הולדת שמח'], [6, 'יום הולדת שמח'], [12, 'יום הולדת, יום הולדת'], [18, 'יום הולדת שמח!']] },
    { id: 'jingle', title: "ג'ינגל בלס", composer: 'ג׳יימס פיירפונט', cat: 'known', level: 2, bpm: 120,
      rh: `${jb} | E4 D4 D4 E4 | D4:2 G4:2 | ${jb} | G4 G4 F4 D4 | C4:4`,
      chords: 'C C C C F C D G C C C C F C G C',
      lyrics: [[0, 'Jingle bells, jingle bells'], [8, 'Jingle all the way'], [16, 'Oh what fun it is to ride'], [24, 'In a one-horse open sleigh'], [32, 'Jingle bells, jingle bells'], [40, 'Jingle all the way'], [48, 'Oh what fun it is to ride'], [56, 'In a one-horse open sleigh']] },
    { id: 'hatikvah', title: 'התקווה', composer: 'ההמנון הלאומי', cat: 'israeli', level: 3, bpm: 80,
      rh: `${hatA} | ${hatA} | ${hatB} | ${hatB} | ${hatC} | ${hatC}`,
      chords: rep('Dm Gm:2 Dm:2 Gm:2 Dm:2 A:2 Dm:2', 2) + ' ' + rep('Dm Gm:2 Dm:2', 2) + ' ' + rep('F C:2 F:2 Gm:2 Dm:2 A:2 Dm:2', 2),
      lyrics: [[0, 'כל עוד בלבב פנימה'], [8, 'נפש יהודי הומייה'], [16, 'ולפאתי מזרח קדימה'], [24, 'עין לציון צופייה'], [32, 'עוד לא אבדה תקוותנו'], [40, 'התקווה בת שנות אלפיים'], [48, 'להיות עם חופשי בארצנו'], [56, 'ארץ ציון וירושלים'], [64, 'להיות עם חופשי בארצנו'], [72, 'ארץ ציון וירושלים']] },

    { id: 'london', title: 'גשר לונדון', composer: 'עממי אנגלי', cat: 'known', level: 1, bpm: 112,
      rh: 'G4:1.5 A4:.5 G4 F4 | E4 F4 G4:2 | D4 E4 F4:2 | E4 F4 G4:2 | G4:1.5 A4:.5 G4 F4 | E4 F4 G4:2 | D4:2 G4:2 | E4 C4:3',
      chords: 'C C G C C C G C' },
    { id: 'yankee', title: 'ינקי דודל', composer: 'עממי אמריקאי', cat: 'known', level: 1, bpm: 120,
      rh: 'C4 C4 D4 E4 | C4 E4 D4 G3 | C4 C4 D4 E4 | C4:2 B3:2 | C4 C4 D4 E4 | F4 E4 D4 C4 | B3 G3 A3 B3 | C4:2 C4:2',
      chords: 'C C:2 G:2 C C:2 G:2 C F G C' },
    { id: 'saints', title: 'כשהקדושים צועדים', composer: 'עממי אמריקאי', cat: 'known', level: 2, bpm: 126,
      rh: 'R C4 E4 F4 | G4:4 | R C4 E4 F4 | G4:4 | R C4 E4 F4 | G4:2 E4:2 | C4:2 E4:2 | D4:4 | R E4 E4 D4 | C4:3 C4 | E4:2 G4:2 | G4 F4:3 | R:2 E4 F4 | G4:2 E4:2 | C4:2 D4:2 | C4:4',
      chords: 'C C C C C C C G C C C F F C C:2 G:2 C' },
    { id: 'susanna', title: 'הו סוזנה', composer: 'סטיבן פוסטר', cat: 'known', level: 2, bpm: 120, pickup: 1,
      rh: `C4:.5 D4:.5 | ${su} | E4 E4 D4 C4 | D4:3 C4:.5 D4:.5 | ${su} | E4 E4 D4 D4 | C4:4 | F4:2 F4:2 | A4 A4:2 A4 | G4 G4 E4 C4 | D4:3 C4:.5 D4:.5 | ${su} | E4 E4 D4 D4 | C4:3`,
      chords: 'C C C G C C C:2 G:2 C F F C G C C C:2 G:2 C' },
    { id: 'grace', title: 'Amazing Grace', composer: 'עממי', cat: 'known', level: 2, bpm: 90, beats: 3, pickup: 1,
      rh: `G3 | ${ag} | C4:2 A3 | G3:2 G3 | ${ag} | G4:3 | G4:2 E4 | G4:2 E4:.5 C4:.5 | E4:2 D4 | C4:2 A3 | G3:2 G3 | ${ag} | C4:3`,
      chords: 'C C F C C C G G C C F C C G C',
      lyrics: [[0, 'Amazing grace, how sweet the sound'], [12, 'That saved a wretch like me'], [24, 'I once was lost, but now am found'], [36, 'Was blind, but now I see']] },
    { id: 'silent', title: 'לילה שקט', composer: 'פרנץ גרובר', cat: 'known', level: 2, bpm: 96, beats: 3,
      rh: `${sn} | ${sn} | D5:2 D5 | B4:3 | C5:2 C5 | G4:3 | ${sn2} | ${sn2} | D5:2 D5 | F5:1.5 D5:.5 B4 | C5:3 | E5:3 | C5 G4 E4 | G4:1.5 F4:.5 D4 | C4:3 | C4:3`,
      chords: 'C C C C G G C C F F C C F F C C G G C C C G C C',
      lyrics: [[0, 'Silent night, holy night'], [12, 'All is calm, all is bright'], [24, 'Round yon virgin mother and child'], [36, 'Holy infant so tender and mild'], [48, 'Sleep in heavenly peace'], [60, 'Sleep in heavenly peace']] },
    { id: 'bells', title: 'פעמוני החג', composer: 'לאונטוביץ׳', cat: 'classic', level: 2, bpm: 150, beats: 3,
      rh: rep('Bb4 A4:.5 Bb4:.5 G4', 8) + ' ' + rep('D5 C5:.5 D5:.5 Bb4', 4) + ' G4:3',
      chords: 'Gm Gm Gm Gm Eb Eb Gm Gm Gm Gm Gm Gm Gm' },

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

const CATS = [['hanukkah', '🕎 חנוכה'], ['mine', '📂 השירים שלי'], ['web', '🌐 מהאינטרנט'], ['pop', '🎧 פופ ולהיטים'], ['ilnew', '🎤 ישראלי חדש'], ['disney', '🎬 דיסני וסרטים'], ['known', '🎈 שירים מוכרים'],
  ['israeli', '🇮🇱 ישראלי'], ['rock', '🎸 רוק קלאסי'], ['classic', '🎻 קלאסי']];

// קטלוג שירים לבחירה. שירים מוגנים בזכויות יוצרים לא מגיעים עם תווים מובנים —
// מוסיפים אותם דרך שיעור יוטיוב + הקלטה, או דרך קובץ MIDI. [קטגוריה, שם, אמן]
const CATALOG = [
  ['ilnew', 'תל אביב', 'עומר אדם'], ['ilnew', 'שני משוגעים', 'עומר אדם'], ['ilnew', 'מודה אני', 'עומר אדם'], ['ilnew', 'אחרי כל השנים', 'עומר אדם'],
  ['ilnew', 'שיר של אודיה (לבחירתך)', 'אודיה'], ['ilnew', 'יוניקורן', 'נועה קירל'], ['ilnew', 'פנתרה', 'נועה קירל'],
  ['ilnew', 'מלכת השושנים', 'עדן בן זקן'], ['ilnew', 'החיים שלנו תותים', 'חנן בן ארי'], ['ilnew', 'ויקיפדיה', 'חנן בן ארי'],
  ['ilnew', 'לשוב הביתה', 'ישי ריבו'], ['ilnew', 'סיבת הסיבות', 'ישי ריבו'], ['ilnew', 'טודו בום', 'סטטיק ובן אל'], ['ilnew', 'שמישהו יעצור אותי', 'עדן חסון'],

  ['disney', 'How Far I\'ll Go', 'מואנה'], ['disney', 'You\'re Welcome', 'מואנה'], ['disney', 'A Whole New World', 'אלאדין'], ['disney', 'Friend Like Me', 'אלאדין'],
  ['disney', 'Let It Go', 'פרוזן'], ['disney', 'Do You Want to Build a Snowman', 'פרוזן'], ['disney', 'Circle of Life', 'מלך האריות'], ['disney', 'Hakuna Matata', 'מלך האריות'],
  ['disney', 'Can You Feel the Love Tonight', 'מלך האריות'], ['disney', 'Under the Sea', 'בת הים הקטנה'], ['disney', 'Beauty and the Beast', 'היפה והחיה'],
  ['disney', 'We Don\'t Talk About Bruno', 'אנקנטו'], ['disney', 'Remember Me', 'קוקו'], ['disney', 'Hedwig\'s Theme', 'הארי פוטר'],
  ['disney', 'He\'s a Pirate', 'שודדי הקאריביים'], ['disney', 'Star Wars Theme', 'מלחמת הכוכבים'],

  ['israeli', 'ירושלים של זהב', 'נעמי שמר'], ['israeli', 'לו יהי', 'נעמי שמר'], ['israeli', 'הללויה', 'חלב ודבש'], ['israeli', 'אבניבי', 'יזהר כהן'],
  ['israeli', 'אני ואתה', 'אריק איינשטיין'], ['israeli', 'עוף גוזל', 'אריק איינשטיין'], ['israeli', 'יש לי ציפור קטנה בלב', 'נורית גלרון'], ['israeli', 'שיר לשלום', 'להקת הנח"ל'],

  ['rock', 'Let It Be', 'הביטלס'], ['rock', 'Hey Jude', 'הביטלס'], ['rock', 'Yesterday', 'הביטלס'], ['rock', 'Imagine', 'ג\'ון לנון'],
  ['rock', 'Bohemian Rhapsody', 'קווין'], ['rock', 'We Will Rock You', 'קווין'], ['rock', 'Piano Man', 'בילי ג\'ואל'], ['rock', 'Don\'t Stop Believin\'', 'ג\'רני'],
  ['rock', 'Hotel California', 'האיגלס'], ['rock', 'Stairway to Heaven', 'לד זפלין'], ['rock', 'Your Song', 'אלטון ג\'ון'],
];

import { Generator } from "@/components/generator";
import { ThemeToggle } from "@/components/theme-toggle";

export default function HomePage() {
  return (
    <div className="relative min-h-full">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(110,36,48,0.14),transparent_70%)]" />
      <header className="relative mx-auto flex w-full max-w-3xl items-start justify-between gap-4 px-4 pt-5 sm:px-6">
        <p className="text-sm text-muted-foreground">גיליון סאטירה · לא החשבון האמיתי</p>
        <ThemeToggle />
      </header>
      <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-6 pb-16 sm:px-6">
        <div className="border-b border-foreground/15 pb-6">
          <p className="text-xs tracking-[0.18em] text-muted-foreground">סאטירה מסומנת</p>
          <h1 className="font-display mt-2 text-4xl leading-tight font-bold sm:text-5xl">מחולל ישראל השנייה</h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-foreground/80">
            כל נושא הוא הוכחה. גם המזגן. כותבים פוסט אחד בסגנון הטיקים, והסימון נשאר על הכרטיס גם כשמשתפים אותו כתמונה.
          </p>
        </div>
        <Generator />
        <footer className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          הפרודיה צוחקת על המכונה הרטורית, לא על ציבור. היא לא נוגעת בשכול, בחטופים, בנפגעי שבעה באוקטובר, ולא באדם פרטי.
          אין כאן מתג שמסתיר את הסימון.
        </footer>
      </main>
    </div>
  );
}

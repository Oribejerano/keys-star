import type { Metadata } from "next";
import { Frank_Ruhl_Libre, Heebo } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { THEME_BOOT } from "@/lib/theme-boot";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

const frank = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["500", "700"],
  variable: "--font-frank",
});

export const metadata: Metadata = {
  title: "מחולל ישראל השנייה · פרודיה",
  description:
    "מחולל פוסטים סאטירי בעברית, בסגנון הטיקים של ד״ר אבישי בן חיים. הכרטיס מסומן כפרודיה, תמיד.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      suppressHydrationWarning
      className={`${heebo.variable} ${frank.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <DirectionProvider direction="rtl">{children}</DirectionProvider>
      </body>
    </html>
  );
}

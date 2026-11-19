"use client";

import { Button } from "@/components/ui/button";
import { THEME_STORAGE_KEY } from "@/lib/theme-boot";
import { useDarkMode } from "@/components/use-dark";

export function ThemeToggle() {
  const dark = useDarkMode();

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="h-11 px-3 text-base"
      onClick={toggle}
      aria-pressed={dark}
    >
      {dark ? "מצב בהיר" : "מצב כהה"}
    </Button>
  );
}

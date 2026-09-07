import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "bdo-theme";

export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const stored = window.localStorage.getItem(KEY);
  const dark =
    stored === "dark" ||
    (!stored && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    applyStoredTheme();
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem(KEY, next ? "dark" : "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Passer en mode jour" : "Passer en mode nuit"}
      title={dark ? "Mode jour" : "Mode nuit"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary ${className}`}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

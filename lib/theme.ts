/** Light / dark theme. The choice is kept in localStorage; "system" follows the OS setting. */
export type ThemeChoice = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_KEY = "syslab:theme";
export const THEME_EVENT = "syslab:theme";

export function getThemeChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(choice: ThemeChoice): Theme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** The theme on screen right now (read from <html>). */
export function currentTheme(): Theme {
  return typeof document !== "undefined" && document.documentElement.classList.contains("light") ? "light" : "dark";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }));
}

export function setThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private mode: the choice lasts for this page only.
  }
  applyTheme(resolveTheme(choice));
}

/**
 * Runs in <head> before the first paint, so a light-theme visitor never sees a dark flash.
 * Kept tiny and dependency-free; mirrors getThemeChoice + resolveTheme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem("${THEME_KEY}")||"dark";var t=c==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):c;if(t!=="light"&&t!=="dark")t="dark";var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.style.colorScheme=t;}catch(e){}})();`;

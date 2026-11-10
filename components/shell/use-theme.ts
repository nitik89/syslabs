"use client";

import { useEffect, useState } from "react";
import { THEME_EVENT, currentTheme, getThemeChoice, resolveTheme, setThemeChoice, type Theme, type ThemeChoice } from "@/lib/theme";

/** The theme on screen, kept in sync with the toggle and (for "system") the OS setting. */
export function useTheme(): { theme: Theme; choice: ThemeChoice; setChoice: (c: ThemeChoice) => void } {
  const [theme, setTheme] = useState<Theme>("dark");
  const [choice, setChoiceState] = useState<ThemeChoice>("dark");
  useEffect(() => {
    const sync = () => {
      setTheme(currentTheme());
      setChoiceState(getThemeChoice());
    };
    void Promise.resolve().then(sync);
    window.addEventListener(THEME_EVENT, sync);
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onOs = () => {
      if (getThemeChoice() === "system") setThemeChoice("system");
    };
    mq.addEventListener("change", onOs);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      mq.removeEventListener("change", onOs);
    };
  }, []);
  return {
    theme,
    choice,
    setChoice: (c) => {
      setThemeChoice(c);
      setChoiceState(c);
      setTheme(resolveTheme(c));
    },
  };
}

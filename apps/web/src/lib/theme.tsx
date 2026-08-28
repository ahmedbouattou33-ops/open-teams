"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
type ThemeContextValue = { theme: ThemeMode; resolvedTheme: ResolvedTheme; setTheme: (theme: ThemeMode) => void; toggleTheme: () => void };

const STORAGE_KEY = "openteams.theme.v1";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "system" || stored === "dark" ? stored : "dark";
}

function systemPrefersLight(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [systemLight, setSystemLight] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState((current) => current === stored ? current : stored);
    setSystemLight(systemPrefersLight());
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => setSystemLight(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [theme]);

  const resolvedTheme: ResolvedTheme = theme === "system" ? (systemLight ? "light" : "dark") : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.classList.toggle("light", resolvedTheme === "light");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme: (next) => {
      setThemeState((current) => current === next ? current : next);
      window.localStorage.setItem(STORAGE_KEY, next);
    },
    toggleTheme: () => {
      const next: ThemeMode = resolvedTheme === "dark" ? "light" : "dark";
      setThemeState((current) => current === next ? current : next);
      window.localStorage.setItem(STORAGE_KEY, next);
    },
  }), [theme, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

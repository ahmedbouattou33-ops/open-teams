"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const next: ThemeMode = resolvedTheme === "dark" ? "light" : "dark";
  return <div className="flex items-center gap-1 rounded-xl border border-surface-border bg-surface-raised p-1" aria-label="Theme selector">
    <button type="button" data-theme={theme} title="Light / Claire" aria-label="Light theme" onClick={() => setTheme("light")} className={`rounded-lg p-1.5 transition-all ${theme === "light" ? "bg-accent text-white shadow-sm" : "text-slate-400 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white"}`}><Sun className="h-3.5 w-3.5" /></button>
    <button type="button" data-theme={theme} title="Dark / Sombre" aria-label="Dark theme" onClick={() => setTheme("dark")} className={`rounded-lg p-1.5 transition-all ${theme === "dark" ? "bg-accent text-white shadow-sm" : "text-slate-400 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white"}`}><Moon className="h-3.5 w-3.5" /></button>
    <button type="button" data-theme={theme} title="System theme" aria-label="System theme" onClick={() => setTheme("system")} className={`hidden rounded-lg p-1.5 transition-all sm:block ${theme === "system" ? "bg-accent text-white shadow-sm" : "text-slate-400 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white"}`}><Monitor className="h-3.5 w-3.5" /></button>
    <button type="button" data-theme-toggle title={`Switch to ${next} theme`} aria-label={`Switch to ${next} theme`} onClick={() => setTheme(next)} className="ml-0.5 hidden h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-transform hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white sm:flex"><span className="sr-only">Toggle theme</span>{resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5 rotate-0 transition-transform" /> : <Moon className="h-3.5 w-3.5 rotate-0 transition-transform" />}</button>
  </div>;
}

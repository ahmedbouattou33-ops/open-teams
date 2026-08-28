"use client";

import { ChevronDown, Languages } from "lucide-react";
import { localeOptions, useLanguage, type Locale } from "@/lib/i18n";

const flags: Record<Locale, string> = { en: "🇬🇧", fr: "🇫🇷", ar: "🇩🇿" };

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  return <label className="flex items-center gap-1 rounded-xl border border-surface-border bg-surface-raised px-2 py-1.5 text-xs text-slate-600 dark:text-slate-300" title={t("chooseLanguage")} aria-label={t("language")}>
    <Languages className="h-3.5 w-3.5 text-accent" />
    <span className="hidden sm:inline">{flags[locale]}</span>
    <select aria-label="Interface language" value={locale} onChange={(event) => setLocale(event.target.value as Locale)} className="max-w-[92px] cursor-pointer bg-transparent font-semibold outline-none dark:text-slate-200">
      {localeOptions.map((option) => <option key={option.value} value={option.value}>{option.nativeLabel}</option>)}
    </select>
    <ChevronDown className="hidden h-3 w-3 sm:block" />
  </label>;
}

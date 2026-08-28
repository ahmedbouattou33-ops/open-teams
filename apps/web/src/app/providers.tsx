"use client";

import type { ReactNode } from "react";
import PushRegistration from "@/components/PushRegistration";
import { LanguageProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <PushRegistration />
        {children}
      </LanguageProvider>
    </ThemeProvider>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  title: { default: "OpenTeams", template: "%s · OpenTeams" },
  description:
    "Enterprise-grade open-source collaboration platform: real-time messaging, calls and secure file sharing.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className="dark" suppressHydrationWarning>
      <body className="bg-surface font-sans text-slate-900 antialiased dark:text-slate-200"><Providers>{children}</Providers></body>
    </html>
  );
}

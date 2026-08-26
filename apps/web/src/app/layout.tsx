import type { Metadata, Viewport } from "next";
import "./globals.css";
import "highlight.js/styles/github-dark.css";

export const metadata: Metadata = {
  title: { default: "OpenTeams", template: "%s · OpenTeams" },
  description:
    "Enterprise-grade open-source collaboration platform: real-time messaging, calls and secure file sharing.",
};

export const viewport: Viewport = {
  themeColor: "#0b0d10",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface font-sans text-slate-200 antialiased">{children}</body>
    </html>
  );
}

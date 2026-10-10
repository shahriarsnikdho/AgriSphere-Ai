import type { Metadata } from "next";
import "./globals.css";

// NOTE: fonts are intentionally not loaded from Google Fonts in the scaffold
// (keeps CI/offline builds deterministic). Sejda owns the Bangla font choice
// (e.g. self-hosted Noto Sans Bengali via next/font/local).
export const metadata: Metadata = {
  title: "AgriSphere",
  description:
    "AI-assisted crop disease detection and advisory for smallholder farmers in Bangladesh (preliminary estimates only).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

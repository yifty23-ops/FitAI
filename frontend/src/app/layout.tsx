import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FitAI — AI Personal Trainer",
  description: "AI-powered personal training with tiered coaching quality",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-[system-ui]">
        {children}
      </body>
    </html>
  );
}

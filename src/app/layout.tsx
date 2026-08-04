import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./ledger-page.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "Felice",
  applicationName: "Felice",
  description: "Felice — Quản lý tài chính workspace",
  icons: {
    icon: "/felice-logo.svg",
    shortcut: "/felice-logo.svg",
    apple: "/felice-logo.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={geist.variable}>
      <head>
        <Script src="/initialize-appearance.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

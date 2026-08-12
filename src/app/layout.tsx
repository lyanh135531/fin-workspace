import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import "./ledger-page.css";
import "./responsive-foundation.css";
import "./overview-desktop.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Felix",
  applicationName: "Felix",
  description: "Felix — Quản lý tài chính workspace",
  icons: {
    icon: "/felix-logo.svg",
    shortcut: "/felix-logo.svg",
    apple: "/felix-logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={geist.variable}>
      <head>
        <Script src="/initialize-appearance.js" strategy="beforeInteractive" />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua đến nội dung chính
        </a>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "Fin Workspace",
  description: "Workspace financial management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning className={geist.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var e=document.documentElement,t=localStorage.getItem('fin-workspace-theme'),m=localStorage.getItem('fin-workspace-mode'),d=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;e.dataset.theme=['sunrise','ocean','forest','lavender','midnight'].includes(t||'')?t:'sunrise';e.dataset.mode=m==='light'||m==='dark'?m:(d?'dark':'light');var sc=localStorage.getItem('fin-sidebar-collapsed');if(sc==='true')e.dataset.sidebarCollapsed='true'}catch(e){}" }} /></head>
      <body>{children}</body>
    </html>
  );
}

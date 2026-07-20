import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fin Workspace",
  description: "Workspace financial management",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var e=document.documentElement,t=localStorage.getItem('fin-workspace-theme'),m=localStorage.getItem('fin-workspace-mode');e.dataset.theme=['sunrise','ocean','forest','lavender','midnight'].includes(t||'')?t:'sunrise';e.dataset.mode=m==='light'||m==='dark'?m:(t==='light'?'light':'dark')}catch(e){}" }} /></head>
      <body>{children}</body>
    </html>
  );
}

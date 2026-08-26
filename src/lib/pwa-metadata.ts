import type { Metadata } from "next";

export const appPwaMetadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Felix",
  },
  icons: {
    apple: [
      {
        url: "/pwa-apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
} satisfies Metadata;

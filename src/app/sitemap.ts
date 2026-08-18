import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://felixwise.io.vn",
      lastModified: new Date("2026-08-17"),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}

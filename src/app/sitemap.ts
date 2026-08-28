import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://felixwise.io.vn",
      lastModified: new Date("2026-08-17"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: "https://felixwise.io.vn/privacy",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://felixwise.io.vn/terms",
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}

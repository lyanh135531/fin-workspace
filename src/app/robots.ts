import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/members/",
        "/onboarding/",
        "/overview/",
        "/portal/",
        "/recurring-transactions/",
        "/financial-plans/",
        "/setting/",
        "/settings/",
        "/wallets/",
        "/workspace/",
        "/workspaces/",
      ],
    },
    sitemap: "https://felixwise.io.vn/sitemap.xml",
    host: "https://felixwise.io.vn",
  };
}

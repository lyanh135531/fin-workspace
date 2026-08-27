import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
};

type FelixManifest = {
  id: string;
  name: string;
  start_url: string;
  scope: string;
  display: string;
  background_color: string;
  theme_color: string;
  lang: string;
  categories: string[];
  icons: ManifestIcon[];
};

function pngSize(path: string): { width: number; height: number } {
  const buffer = readFileSync(path);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe("Felix web app manifest", () => {
  const publicDirectory = resolve(process.cwd(), "public");
  const manifest = JSON.parse(
    readFileSync(resolve(publicDirectory, "manifest.webmanifest"), "utf8"),
  ) as FelixManifest;

  it("defines the standalone application identity and launch URL", () => {
    expect(manifest).toMatchObject({
      id: "/",
      name: "Felix",
      start_url: "/overview?source=pwa",
      scope: "/",
      display: "standalone",
      background_color: "#fff8f0",
      theme_color: "#e97f6d",
      lang: "vi",
    });
    expect(manifest.categories).toEqual(["finance", "productivity"]);
  });

  it("provides correctly sized regular, maskable and Apple icons", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ]),
    );

    for (const icon of manifest.icons) {
      const path = resolve(publicDirectory, icon.src.replace(/^\//, ""));
      expect(existsSync(path)).toBe(true);
      const [expectedWidth, expectedHeight] = icon.sizes
        .split("x")
        .map(Number);
      expect(pngSize(path)).toEqual({
        width: expectedWidth,
        height: expectedHeight,
      });
    }

    expect(pngSize(resolve(publicDirectory, "pwa-apple-touch-icon.png"))).toEqual(
      { width: 180, height: 180 },
    );
  });
});

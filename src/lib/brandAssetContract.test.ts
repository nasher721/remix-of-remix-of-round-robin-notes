import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readPngDimensions(path: string): { width: number; height: number } {
  const image = readFileSync(path);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
  };
}

test("browser and installed-app icons use the Rolling Rounds asset set", () => {
  const html = readFileSync("index.html", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  const auth = readFileSync("src/pages/Auth.tsx", "utf8");
  const landing = readFileSync("src/pages/Landing.tsx", "utf8");
  const mobileHeader = readFileSync("src/components/layout/MobileHeader.tsx", "utf8");
  const desktopDashboard = readFileSync("src/components/dashboard/DesktopDashboard.tsx", "utf8");
  const compactBrandSurfaces = `${landing}\n${mobileHeader}\n${desktopDashboard}`;
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
    icons: Array<{ src: string; sizes: string; type: string }>;
  };
  const serviceWorker = readFileSync("public/sw.js", "utf8");

  assert.match(html, /href="\/icons\/favicon-64\.png"/);
  assert.match(html, /href="\/icons\/apple-touch-icon\.png"/);
  assert.match(app, /src="\/icons\/icon-192\.png"/);
  assert.match(auth, /src="\/icons\/icon-192\.png"/);
  assert.doesNotMatch(`${app}\n${auth}`, /rolling-rounds-logo\.png/);
  assert.match(landing, /\/icons\/favicon-64\.png/);
  assert.match(mobileHeader, /\/icons\/favicon-64\.png/);
  assert.match(desktopDashboard, /\/icons\/favicon-64\.png/);
  assert.match(desktopDashboard, /\/icons\/icon-192\.png/);
  assert.doesNotMatch(compactBrandSurfaces, /rolling-rounds-logo\.png/);
  assert.deepEqual(manifest.icons.map(({ src, sizes, type }) => ({ src, sizes, type })), [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
  ]);
  assert.match(serviceWorker, /'\/icons\/favicon-64\.png'/);
  assert.match(serviceWorker, /'\/icons\/icon-192\.png'/);
  assert.doesNotMatch(`${html}\n${JSON.stringify(manifest)}\n${serviceWorker}`, /\/favicon\.ico/);

  assert.deepEqual(readPngDimensions("public/icons/favicon-64.png"), { width: 64, height: 64 });
  assert.deepEqual(readPngDimensions("public/icons/apple-touch-icon.png"), { width: 180, height: 180 });
  assert.deepEqual(readPngDimensions("public/icons/icon-192.png"), { width: 192, height: 192 });
  assert.deepEqual(readPngDimensions("public/icons/icon-512.png"), { width: 512, height: 512 });

  for (const retiredAsset of [
    "public/favicon.ico",
    "public/landing-hero-poster.svg",
    "public/placeholder.svg",
    "public/video_d947dcb3-9916-4d7f-b617-a3beb20d3fdf.mp4",
  ]) {
    assert.equal(existsSync(retiredAsset), false, `${retiredAsset} must not ship`);
  }
});

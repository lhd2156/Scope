import { chromium } from '@playwright/test';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(projectRoot, 'public');
const outputRoot = path.join(publicRoot, 'pwa');
const iconOutputRoot = path.join(outputRoot, 'icons');
const splashOutputRoot = path.join(outputRoot, 'splash');

const brandMarkImagePath = path.join(publicRoot, 'branding', 'scope-trips-logo-mark.png');
const brandMarkImage = await readFile(brandMarkImagePath);
const brandMarkDataUrl = `data:image/png;base64,${Buffer.from(brandMarkImage).toString('base64')}`;

const iconAssets = [
  { fileName: 'icon-192.png', size: 192, maskable: false },
  { fileName: 'icon-512.png', size: 512, maskable: false },
  { fileName: 'icon-maskable-192.png', size: 192, maskable: true },
  { fileName: 'icon-maskable-512.png', size: 512, maskable: true },
  { fileName: 'apple-touch-icon-180.png', size: 180, maskable: false },
];

const splashAssets = [
  {
    fileName: 'apple-splash-1170x2532.png',
    width: 1170,
    height: 2532,
  },
  {
    fileName: 'apple-splash-2532x1170.png',
    width: 2532,
    height: 1170,
  },
  {
    fileName: 'apple-splash-1536x2048.png',
    width: 1536,
    height: 2048,
  },
  {
    fileName: 'apple-splash-2048x1536.png',
    width: 2048,
    height: 1536,
  },
  {
    fileName: 'apple-splash-1668x2388.png',
    width: 1668,
    height: 2388,
  },
  {
    fileName: 'apple-splash-2388x1668.png',
    width: 2388,
    height: 1668,
  },
];

function buildIconHtml(maskable) {
  const frameInset = maskable ? '16%' : '19%';
  const badgeInset = maskable ? '7%' : '0%';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      :root {
        color-scheme: dark;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        background: transparent;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
      }

      .icon-surface {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: 24%;
        background:
          radial-gradient(circle at 18% 18%, rgba(16, 185, 129, 0.34), transparent 34%),
          radial-gradient(circle at 84% 20%, rgba(59, 130, 246, 0.32), transparent 36%),
          radial-gradient(circle at 50% 100%, rgba(134, 59, 255, 0.22), transparent 44%),
          linear-gradient(160deg, #090b14 0%, #0f0f1a 44%, #181833 100%);
        box-shadow:
          inset 0 0 0 max(2px, 0.75%) rgba(255, 255, 255, 0.08),
          inset 0 max(1px, 0.35%) 0 rgba(255, 255, 255, 0.12);
      }

      .icon-surface::before,
      .icon-surface::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .icon-surface::before {
        background:
          linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
        background-size: 13% 13%;
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.15));
      }

      .icon-surface::after {
        inset: ${frameInset};
        border-radius: 26%;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.03));
        border: max(1px, 0.5%) solid rgba(255, 255, 255, 0.14);
        backdrop-filter: blur(18px);
        box-shadow:
          0 max(10px, 4%) max(18px, 8%) rgba(0, 0, 0, 0.34),
          inset 0 max(1px, 0.4%) 0 rgba(255, 255, 255, 0.16);
      }

      .icon-badge {
        position: absolute;
        inset: ${badgeInset};
        z-index: 1;
        display: grid;
        place-items: center;
        border-radius: 24%;
        overflow: hidden;
      }

      .icon-badge img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        filter:
          drop-shadow(0 max(2px, 1.2%) max(6px, 3%) rgba(0, 0, 0, 0.35))
          drop-shadow(0 0 max(8px, 4%) rgba(16, 185, 129, 0.2));
      }

      .signal,
      .pinpoint,
      .trail {
        position: absolute;
        border-radius: 999px;
        pointer-events: none;
      }

      .signal {
        width: 26%;
        height: 26%;
        left: 8%;
        bottom: 9%;
        border: max(1px, 0.45%) solid rgba(16, 185, 129, 0.34);
        box-shadow: inset 0 0 max(10px, 4.5%) rgba(16, 185, 129, 0.16);
      }

      .pinpoint {
        width: 7.5%;
        height: 7.5%;
        right: 12%;
        top: 14%;
        background: linear-gradient(135deg, #34d399, #06b6d4);
        box-shadow:
          0 0 max(10px, 4.8%) rgba(16, 185, 129, 0.55),
          0 0 max(16px, 7.2%) rgba(59, 130, 246, 0.32);
      }

      .trail {
        width: 38%;
        height: max(2px, 1.4%);
        left: 11%;
        top: 28%;
        transform: rotate(-30deg);
        transform-origin: left center;
        background: linear-gradient(90deg, rgba(52, 211, 153, 0), rgba(52, 211, 153, 0.9), rgba(6, 182, 212, 0));
      }
    </style>
  </head>
  <body>
    <div class="icon-surface">
      <div class="trail"></div>
      <div class="signal"></div>
      <div class="pinpoint"></div>
      <div class="icon-badge">
        <img src="${brandMarkDataUrl}" alt="" />
      </div>
    </div>
  </body>
</html>`;
}

function buildSplashHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
      }

      body {
        position: relative;
        display: grid;
        place-items: center;
        padding: 0;
        background:
          radial-gradient(circle at 14% 16%, rgba(16, 185, 129, 0.28), transparent 28%),
          radial-gradient(circle at 84% 18%, rgba(59, 130, 246, 0.26), transparent 31%),
          radial-gradient(circle at 50% 100%, rgba(134, 59, 255, 0.24), transparent 44%),
          linear-gradient(160deg, #090b14 0%, #0f0f1a 42%, #17172d 100%);
        color: #f0f0f5;
      }

      body::before,
      body::after {
        content: '';
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      body::before {
        background:
          linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
        background-size: min(8vw, 92px) min(8vw, 92px);
        mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.14));
      }

      body::after {
        inset: 9%;
        border-radius: min(4vw, 56px);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .shell {
        position: relative;
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        padding: min(9vh, 8.5vw);
      }

      .card {
        position: relative;
        width: min(100%, 920px);
        padding: clamp(32px, 5vw, 82px);
        display: grid;
        justify-items: center;
        gap: clamp(18px, 2.6vw, 30px);
        text-align: center;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.05));
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: clamp(28px, 4vw, 44px);
        backdrop-filter: blur(22px);
        box-shadow:
          0 28px 80px rgba(0, 0, 0, 0.35),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      .card::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), transparent 42%, rgba(59, 130, 246, 0.08));
      }

      .badge {
        position: relative;
        z-index: 1;
        width: clamp(120px, 18vw, 220px);
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border-radius: 30%;
        background:
          radial-gradient(circle at 28% 26%, rgba(255, 255, 255, 0.34), transparent 54%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.05));
        border: 1px solid rgba(255, 255, 255, 0.18);
        box-shadow:
          0 0 48px rgba(16, 185, 129, 0.18),
          0 18px 34px rgba(0, 0, 0, 0.28);
      }

      .badge img {
        width: 62%;
        height: auto;
        filter:
          drop-shadow(0 6px 18px rgba(0, 0, 0, 0.3))
          drop-shadow(0 0 16px rgba(16, 185, 129, 0.18));
      }

      .eyebrow {
        position: relative;
        margin: 0;
        font-size: clamp(14px, 2vw, 24px);
        line-height: 1.2;
        letter-spacing: 0.32em;
        text-transform: uppercase;
        color: #34d399;
      }

      h1 {
        position: relative;
        margin: 0;
        font-size: clamp(52px, 8.5vw, 120px);
        line-height: 0.92;
        letter-spacing: -0.06em;
        font-weight: 700;
      }

      .subtitle {
        position: relative;
        max-width: 24ch;
        margin: 0;
        font-size: clamp(20px, 3vw, 38px);
        line-height: 1.3;
        color: rgba(240, 240, 245, 0.82);
      }

      .feature-row {
        position: relative;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
      }

      .pill {
        padding: 0.75em 1.1em;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(255, 255, 255, 0.08);
        color: rgba(240, 240, 245, 0.78);
        font-size: clamp(14px, 1.7vw, 20px);
        line-height: 1;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="card" aria-label="Scope splash screen">
        <div class="badge">
          <img src="${brandMarkDataUrl}" alt="" />
        </div>
        <p class="eyebrow">Discover • Capture • Plan</p>
        <h1>Scope Trips</h1>
        <p class="subtitle">Real-world adventures mapped for the moments between inspiration and departure.</p>
        <div class="feature-row" aria-hidden="true">
          <span class="pill">Open map</span>
          <span class="pill">Save spots</span>
          <span class="pill">Plan trips</span>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

async function renderIcon(page, asset) {
  await page.setViewportSize({ width: asset.size, height: asset.size });
  await page.setContent(buildIconHtml(asset.maskable), { waitUntil: 'load' });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  await page.screenshot({
    path: path.join(iconOutputRoot, asset.fileName),
    animations: 'disabled',
  });
}

async function renderSplash(page, asset) {
  await page.setViewportSize({ width: asset.width, height: asset.height });
  await page.setContent(buildSplashHtml(), { waitUntil: 'load' });
  await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
  await page.screenshot({
    path: path.join(splashOutputRoot, asset.fileName),
    animations: 'disabled',
  });
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(iconOutputRoot, { recursive: true });
await mkdir(splashOutputRoot, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  for (const asset of iconAssets) {
    await renderIcon(page, asset);
  }

  for (const asset of splashAssets) {
    await renderSplash(page, asset);
  }

  await page.close();
} finally {
  await browser.close();
}

console.log(`Generated ${iconAssets.length + splashAssets.length} PWA assets in ${outputRoot}`);

import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iosRepoRoot = path.resolve(__dirname, '..');
const webRepoRoot = path.resolve(iosRepoRoot, '..', 'I Got You');
const require = createRequire(path.join(webRepoRoot, 'package.json'));
const { chromium } = require('playwright');
const outputDir = path.join(iosRepoRoot, 'store-listing', 'android');
const screenshotsDir = path.join(outputDir, 'screenshots');
const siteUrl = 'http://127.0.0.1:4173';

const previewConfigs = [
  {
    title: 'Home, summaries, and quick actions',
    file: '01-home-dashboard.png',
  },
  {
    title: 'People, notes, and linked history',
    file: '02-contacts-history.png',
  },
  {
    title: 'Approve shared updates only when needed',
    file: '03-requests-approval.png',
  },
  {
    title: 'Settings, exports, and account controls',
    file: '04-settings-tools.png',
  },
];

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function copyAppIcon() {
  const source = path.join(webRepoRoot, 'assets', 'images', 'logo.png');
  const destination = path.join(outputDir, 'app-icon-source-logo.png');
  await fs.copyFile(source, destination);
  return destination;
}

function featuredGraphicHtml() {
  const logoPath = path.join(webRepoRoot, 'assets', 'images', 'logo.png');

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          width: 1024px;
          height: 500px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background:
            radial-gradient(circle at 15% 20%, rgba(167, 139, 250, 0.36), transparent 28%),
            radial-gradient(circle at 88% 80%, rgba(99, 102, 241, 0.34), transparent 26%),
            linear-gradient(135deg, #0f172a 0%, #1e1b4b 52%, #312e81 100%);
          color: white;
          overflow: hidden;
        }
        .frame {
          width: 100%;
          height: 100%;
          padding: 48px 56px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }
        .glow {
          position: absolute;
          inset: 24px;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 28px;
          pointer-events: none;
        }
        .copy {
          width: 58%;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .eyebrow {
          font-size: 15px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #c4b5fd;
          font-weight: 800;
        }
        h1 {
          margin: 0;
          font-size: 58px;
          line-height: 0.98;
          letter-spacing: -0.04em;
          max-width: 560px;
        }
        p {
          margin: 0;
          font-size: 24px;
          line-height: 1.3;
          color: rgba(255,255,255,0.84);
          max-width: 500px;
        }
        .chips {
          display: flex;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .chip {
          padding: 10px 16px;
          border-radius: 999px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.12);
          font-size: 16px;
          color: #eef2ff;
          font-weight: 700;
        }
        .art {
          width: 34%;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .logo-wrap {
          width: 270px;
          height: 270px;
          border-radius: 64px;
          background: linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.04));
          border: 1px solid rgba(255,255,255,0.16);
          box-shadow: 0 30px 80px rgba(15,23,42,0.42);
          display: flex;
          justify-content: center;
          align-items: center;
          backdrop-filter: blur(14px);
        }
        .logo-wrap img {
          width: 82%;
          height: 82%;
          object-fit: contain;
          filter: drop-shadow(0 12px 24px rgba(0,0,0,0.2));
        }
      </style>
    </head>
    <body>
      <div class="frame">
        <div class="glow"></div>
        <div class="copy">
          <div class="eyebrow">Buddy Balance</div>
          <h1>Track shared balances without the messy back-and-forth.</h1>
          <p>Keep loans, payments, contacts, and account tools organized in one clear record.</p>
          <div class="chips">
            <div class="chip">Shared balances</div>
            <div class="chip">Payment history</div>
            <div class="chip">Premium tools</div>
          </div>
        </div>
        <div class="art">
          <div class="logo-wrap">
            <img src="file://${logoPath}" alt="Buddy Balance logo" />
          </div>
        </div>
      </div>
    </body>
  </html>`;
}

async function generateFeaturedGraphic(browser) {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 1,
  });
  await page.setContent(featuredGraphicHtml(), { waitUntil: 'load' });
  const featuredPath = path.join(outputDir, 'featured-graphic-1024x500.png');
  await page.screenshot({ path: featuredPath });
  await page.close();
  return featuredPath;
}

async function generateScreenshots(browser) {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 2600 },
    deviceScaleFactor: 2,
  });

  await page.goto(siteUrl, { waitUntil: 'networkidle' });
  await page.locator('text=Inside the app').scrollIntoViewIfNeeded().catch(() => {});

  for (const preview of previewConfigs) {
    const title = page.locator(`text=${preview.title}`).first();
    await title.scrollIntoViewIfNeeded();
    const titleBox = await title.boundingBox();

    if (!titleBox) {
      throw new Error(`Could not resolve screenshot bounds for "${preview.title}"`);
    }

    const clip = {
      x: Math.max(0, titleBox.x - 420),
      y: Math.max(0, titleBox.y - 360),
      width: 360,
      height: 760,
    };

    await page.screenshot({
      path: path.join(screenshotsDir, preview.file),
      clip,
    });
  }

  await page.close();
}

async function writeReadme(paths) {
  const readme = `# Android Store Listing Assets

Generated assets for Google Play:

- App icon source: \`${path.relative(iosRepoRoot, paths.icon)}\`
- Featured graphic: \`${path.relative(iosRepoRoot, paths.featured)}\`
- Screenshots:
  - \`${path.relative(iosRepoRoot, path.join(screenshotsDir, '01-home-dashboard.png'))}\`
  - \`${path.relative(iosRepoRoot, path.join(screenshotsDir, '02-contacts-history.png'))}\`
  - \`${path.relative(iosRepoRoot, path.join(screenshotsDir, '03-requests-approval.png'))}\`
  - \`${path.relative(iosRepoRoot, path.join(screenshotsDir, '04-settings-tools.png'))}\`

Recommended Play Console values:

- App icon: use the logo-based icon source or export a final 512x512 version from the same mark.
- Featured graphic: upload \`featured-graphic-1024x500.png\`
- Phone screenshots: upload the four files in \`screenshots/\` in numeric order.
`;

  await fs.writeFile(path.join(outputDir, 'README.md'), readme, 'utf8');
}

async function main() {
  await ensureDir(outputDir);
  await ensureDir(screenshotsDir);

  const browser = await chromium.launch({ headless: true });
  try {
    const icon = await copyAppIcon();
    const featured = await generateFeaturedGraphic(browser);
    await generateScreenshots(browser);
    await writeReadme({ icon, featured });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

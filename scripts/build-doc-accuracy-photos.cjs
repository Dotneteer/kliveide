/**
 * Converts HALT2INT's real-machine photos for the documentation site
 * (`.plans/SPECTRUM_ACCURACY_DOCS_PLAN.md` §4.4), and builds the landing page's picture of the
 * accuracy feature from one of them.
 *
 * The photos are Mark Woodmass's, of his own 48Ks running HALT2INT v3, shipped with the program
 * under GPLv2 (`vendor/spectrum-tests/halt2int/COPYING`). As they come they are too heavy for a page
 * (464 KB and 1.6 MB), so each is cropped to the screen area and written as a ~700 px wide `.webp`:
 *
 *   docs/public/images/spectrum-accuracy/real-48k-early.webp
 *   docs/public/images/spectrum-accuracy/real-48k-late.webp
 *   docs/public/images/landing/accuracy-halt2int.webp   Klive's early run beside the real early 48K
 *
 * The landing picture uses Klive's published run (`halt2int-48k-early.png`, written by the slow
 * test tier with KIT_PUBLISH=1), so run this after re-publishing that picture.
 *
 * `sharp` is resolved from the docs workspace, as the doc-shots harness does: `npm run doc:install`
 * first. Run by hand, like `build-doc-fonts.cjs`: node scripts/build-doc-accuracy-photos.cjs
 */
const { join } = require("node:path");
const { statSync } = require("node:fs");

const repoRoot = join(__dirname, "..");
const KIT = join(repoRoot, "vendor", "spectrum-tests", "halt2int");
const IMAGES = join(repoRoot, "docs", "public", "images");
const OUT = join(IMAGES, "spectrum-accuracy");

/** The width the page shows them at */
const WIDTH = 700;

/** The photos, and the part of each that is the Spectrum's screen (in the photo's pixels) */
const PHOTOS = [
  { from: "Real 48k (early).png", to: "real-48k-early.webp", crop: { left: 0, top: 0, width: 675, height: 573 } },
  { from: "Real 48k (late).png", to: "real-48k-late.webp", crop: { left: 30, top: 40, width: 1300, height: 880 } }
];

function loadSharp() {
  for (const base of [join(repoRoot, "docs"), repoRoot]) {
    try {
      return require(require.resolve("sharp", { paths: [base] }));
    } catch {
      // --- try the next place
    }
  }
  throw new Error("sharp not found — run `npm run doc:install` first.");
}

async function main() {
  const sharp = loadSharp();
  const written = [];
  for (const { from, to, crop } of PHOTOS) {
    const target = join(OUT, to);
    await sharp(join(KIT, from)).extract(crop).resize({ width: WIDTH }).webp({ quality: 72 }).toFile(target);
    written.push(target);
  }

  // --- The landing picture: Klive's early run and the real early 48K, side by side, same height
  const height = 576;
  const klive = await sharp(join(OUT, "halt2int-48k-early.png")).resize({ height, kernel: "nearest" }).toBuffer();
  const kliveWidth = (await sharp(klive).metadata()).width;
  const real = await sharp(join(KIT, PHOTOS[0].from)).extract(PHOTOS[0].crop).resize({ height }).toBuffer();
  const realWidth = (await sharp(real).metadata()).width;
  const gap = 16;
  const landing = join(IMAGES, "landing", "accuracy-halt2int.webp");
  await sharp({
    create: { width: kliveWidth + gap + realWidth, height, channels: 3, background: { r: 0, g: 0, b: 0 } }
  })
    .composite([
      { input: klive, left: 0, top: 0 },
      { input: real, left: kliveWidth + gap, top: 0 }
    ])
    .webp({ quality: 75 })
    .toFile(landing);
  written.push(landing);

  for (const file of written) console.log(`${file.slice(repoRoot.length + 1)}: ${Math.round(statSync(file).size / 1024)} KB`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

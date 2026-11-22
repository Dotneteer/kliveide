/**
 * Copies "Unraveling the ZX Spectrum Next" from the book's own repository into the website.
 *
 * The book is written and built elsewhere (zx-next-book); the website publishes its PDF, its cover and
 * a zip of its examples project. Run this whenever a new edition of the book is built:
 *
 *   node dev/scripts/sync-unraveling-book.cjs [<zx-next-book folder>]   (default: ../zx-next-book)
 *
 * It writes, all tracked:
 *   docs/public/books/unraveling-the-zx-spectrum-next.pdf      the book (build/book.pdf)
 *   docs/books/unraveling-next/examples/                       the examples project, as the book has it
 *   docs/books/unraveling-next/cover.png                       the cover's source picture
 *   docs/public/images/books/unraveling-next/cover-*.webp      the cover, at the sizes the site shows
 *   docs/books/unraveling-next/book.json                       the facts the book's page shows
 *
 * The examples zip is not written here: `build-doc-assets.cjs` builds it on every docs build, with a
 * cleaned `klive.project` (docs/books/unraveling-next/README.md).
 */
const { execFileSync } = require("node:child_process");
const { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { REPO_ROOT } = require("./repo-root.cjs");

const SOURCE = resolve(process.argv[2] ?? join(REPO_ROOT, "..", "zx-next-book"));
const BOOK_DIR = join(REPO_ROOT, "docs", "books", "unraveling-next");
const PDF = join(REPO_ROOT, "docs", "public", "books", "unraveling-the-zx-spectrum-next.pdf");
const COVERS = join(REPO_ROOT, "docs", "public", "images", "books", "unraveling-next");
/** The cover's widths: the landing page's card, the book page, and the full-size link */
const COVER_WIDTHS = [240, 720, 1500];

function need(path, what) {
  if (!existsSync(path)) throw new Error(`sync-unraveling-book: ${what} is missing: ${path}`);
  return path;
}

/** The first "# " heading of a chapter */
function chapterTitle(file) {
  const line = readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith("# "));
  if (!line) throw new Error(`sync-unraveling-book: no title in ${file}`);
  return line.slice(2).trim();
}

/** The PDF's page count, from poppler's pdfinfo (the book's object streams are compressed) */
function pageCount(pdf, previous) {
  try {
    const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
    return Number(/^Pages:\s+(\d+)/m.exec(info)[1]);
  } catch {
    if (previous) {
      console.warn(`pdfinfo is not available; keeping the recorded page count (${previous}).`);
      return previous;
    }
    throw new Error("sync-unraveling-book: install poppler (pdfinfo) to read the page count");
  }
}

/** Every .kz80.asm file under a folder */
function asmFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? asmFiles(join(dir, e.name)) : e.name.endsWith(".asm") ? [join(dir, e.name)] : []
  );
}

/** Each part's demos in menu order, read from the demo tables of the program's entry file */
function readDemos(examples) {
  const code = join(examples, "code");
  const main = readFileSync(need(join(code, "main.kz80.asm"), "the examples' main file"), "utf8");
  const titles = {};
  for (const file of asmFiles(code)) {
    for (const m of readFileSync(file, "utf8").matchAll(/^(\w+Title):\s*\n?\s*\.defn\s+"([^"]*)"/gm)) titles[m[1]] = m[2];
  }
  const parts = [];
  for (const m of main.matchAll(/^Part(\d+)Demos:\n([\s\S]*?)^\s*\.defw 0/gm)) {
    parts[Number(m[1]) - 1] = [...m[2].matchAll(/\.defw (\w+Title),/g)].map(([, label]) => {
      if (!titles[label]) throw new Error(`sync-unraveling-book: no title for ${label}`);
      return titles[label];
    });
  }
  return parts;
}

async function main() {
  need(SOURCE, "the book's repository");
  const meta = JSON.parse(readFileSync(need(join(SOURCE, "book", "book.json"), "book/book.json"), "utf8"));
  const pdfSource = need(join(SOURCE, "build", "book.pdf"), "the built book (run `make pdf` there)");
  const examples = need(join(SOURCE, "examples"), "the examples folder");
  const cover = need(join(SOURCE, "figures", "cover-art", "cover.png"), "the cover");

  // --- The PDF
  mkdirSync(join(PDF, ".."), { recursive: true });
  cpSync(pdfSource, PDF);

  // --- The examples, as the book has them (the zip's clean-up happens at build time)
  rmSync(join(BOOK_DIR, "examples"), { recursive: true, force: true });
  cpSync(examples, join(BOOK_DIR, "examples"), {
    recursive: true,
    filter: (src) => !/(^|[\\/])(\.DS_Store|KliveOutput|\.klive)$/.test(src)
  });

  // --- The cover: the source and its web sizes
  cpSync(cover, join(BOOK_DIR, "cover.png"));
  const sharp = require(join(REPO_ROOT, "docs", "node_modules", "sharp"));
  mkdirSync(COVERS, { recursive: true });
  for (const width of COVER_WIDTHS) {
    await sharp(cover).resize({ width }).webp({ quality: 82 }).toFile(join(COVERS, `cover-${width}.webp`));
  }

  // --- The facts the page shows
  const factsFile = join(BOOK_DIR, "book.json");
  const previous = existsSync(factsFile) ? JSON.parse(readFileSync(factsFile, "utf8")) : undefined;
  const demos = readDemos(examples);
  const facts = {
    title: meta.title,
    subtitle: meta.subtitle,
    author: meta.author,
    year: meta.year,
    pages: pageCount(PDF, previous?.pages),
    pdfBytes: statSync(PDF).size,
    parts: meta.parts.map((part, i) => ({
      title: part.title,
      chapters: part.chapters.map((c) => chapterTitle(join(SOURCE, "content", `${c}.mdx`))),
      demos: demos[i] ?? []
    }))
  };
  writeFileSync(factsFile, JSON.stringify(facts, null, 2) + "\n");

  const chapters = facts.parts.reduce((n, p) => n + p.chapters.length, 0);
  const demoCount = facts.parts.reduce((n, p) => n + p.demos.length, 0);
  console.log(
    `Synced "${facts.title}": ${facts.pages} pages, ${(facts.pdfBytes / 1024 / 1024).toFixed(1)} MB, ` +
      `${facts.parts.length} parts, ${chapters} chapters, ${demoCount} demos.`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

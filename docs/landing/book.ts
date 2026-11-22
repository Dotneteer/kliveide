/**
 * "Unraveling the ZX Spectrum Next": the facts and files the landing page's card and the book's page
 * (/unraveling-book/) show. `docs/books/unraveling-next/book.json` is written by
 * `dev/scripts/sync-unraveling-book.cjs`; the examples zip by `dev/scripts/build-doc-assets.cjs`
 * (docs/books/unraveling-next/README.md).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export type BookPart = { title: string; chapters: string[]; demos: string[] };

export type Book = {
  title: string;
  subtitle: string;
  author: string;
  year: number;
  pages: number;
  pdfBytes: number;
  parts: BookPart[];
};

/** The book's English page; the book itself prints this address (without the slash) */
export const BOOK_PAGE = "/unraveling-book/";

/** The book's page in a language: English's is BOOK_PAGE, the others are under /<lang>/ */
export function bookHref(lang: string): string {
  return lang === "en" ? BOOK_PAGE : `/${lang}${BOOK_PAGE}`;
}

export const BOOK_PDF = `${basePath}/books/unraveling-the-zx-spectrum-next.pdf`;
export const BOOK_EXAMPLES = `${basePath}/books/unraveling-the-zx-spectrum-next-examples.zip`;

/** The cover at a width the sync script made (240, 720 or 1500) */
export function bookCover(width: 240 | 720 | 1500): string {
  return `${basePath}/images/books/unraveling-next/cover-${width}.webp`;
}

/** The cover's proportions (1800 x 2700) */
export const COVER_RATIO = { width: 2, height: 3 };

export function readBook(): Book {
  return JSON.parse(readFileSync(join(process.cwd(), "books", "unraveling-next", "book.json"), "utf8")) as Book;
}

/** The examples zip's size in bytes; the docs build makes it before Next runs (doc:assets) */
export function examplesBytes(): number | undefined {
  const file = join(process.cwd(), "public", "books", "unraveling-the-zx-spectrum-next-examples.zip");
  return existsSync(file) ? statSync(file).size : undefined;
}

/** The number of demos in the examples program */
export function demoCount(book: Book): number {
  return book.parts.reduce((n, p) => n + p.demos.length, 0);
}

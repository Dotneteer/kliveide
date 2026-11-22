# Unraveling the ZX Spectrum Next

István Novák's book on the Next's hardware, *Unraveling the ZX Spectrum Next, Volume 1: The Hardware,
as a Programmer Sees It*, as the website publishes it. The book is written and built in its own
repository (`zx-next-book`); nothing here is edited by hand.

| Here | What it is | Made by |
| --- | --- | --- |
| `examples/` | The book's examples project (`book-demos.nex`), as the book has it | the sync script |
| `cover.png` | The cover's source picture (1800 x 2700) | the sync script |
| `book.json` | The facts the book's page shows: pages, PDF size, parts, chapters, demos | the sync script |
| `docs/public/books/unraveling-the-zx-spectrum-next.pdf` | The book | the sync script |
| `docs/public/images/books/unraveling-next/cover-*.webp` | The cover at 240, 720 and 1500 pixels wide | the sync script |
| `docs/public/books/unraveling-the-zx-spectrum-next-examples.zip` | The examples, zipped (git-ignored) | every docs build |

## A new edition

Build the book there (`make pdf`), then here:

```bash
node dev/scripts/sync-unraveling-book.cjs ../zx-next-book
```

The script needs `pdfinfo` (poppler) for the page count and the docs site's `sharp`
(`npm run doc:install`). Commit what it changed.

## The examples zip

`dev/scripts/build-doc-assets.cjs` (part of `npm run doc:assets`, so of every docs build) zips
`examples/` into one folder named `examples`, the name the book uses. Its `klive.project` stays JSON
but loses the keys that hold the author's own machine and IDE state: `media` (SD card image paths),
`viewOptions`, `workspaceSettings` and `debugger`.

## Where the book appears

- The landing page's first screen: a card under Klive's own Download (`docs/landing/BookCard.tsx`),
  in every language. Its heading is the book's English title; its texts are in
  `docs/i18n/landing/en.json` (`book.*`), with the author's name as `book.author`, because
  Hungarian writes it family name first (Novák István).
- The book's own page (`docs/landing/BookPage.tsx`): `/unraveling-book/` in English, which the book
  prints, so it must not move, and `/<lang>/unraveling-book/` in the other site languages. Its texts
  are `bookPage.*` in the landing catalog, translated through `doc:i18n:todo` / `doc:i18n:merge`;
  the book's title, subtitle, chapters and demos stay English.

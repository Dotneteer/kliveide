# Book authoring notes

Working documents for *Inside the ZX Spectrum Next*. They live outside
`content/` on purpose: only `content/` produces routes, so nothing here is
published to the site or indexed by search.

- `book-writing-guidelines.md` — style, tone and structural conventions for the
  book's chapters.
- `book-plan.md` — the chapter plan and outstanding decisions for the author.
  (Was `content/book/toc.md`, which meant its "Open Questions for You" section
  was being served publicly at `/book/toc/` and indexed by Pagefind.)
- `next-audio/computer-sound-figures.cjs` — generates the figures of
  `content/en/under-the-hood/emulator-internals/computer-sound.mdx` in place
  (between its `{/* fig:<name> */}` markers) and prints the numbers its text
  quotes. Edit the script, not the generated SVG.
- `next-audio/overview-figures.cjs` (helpers in `next-audio/_svg.cjs`) — the
  figures of `next-audio/overview.mdx`, drawn from the machine captures in
  `next-audio/captures/`, which `test/zxnext-hw/audio/next-audio-scene.test.ts`
  writes with `NEXT_AUDIO_SHOTS=docs/authoring/next-audio/captures`.

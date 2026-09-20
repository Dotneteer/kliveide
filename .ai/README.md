# AI Assistance Notes

This folder stores durable notes for future AI-assisted work in this repository.

- Read `../AGENTS.md` first.
- Keep notes concise and oriented toward repeatable future work.
- For creating or updating IDE interactive commands, read
  `interactive-command-notes.md`.
- For future full-machine WASM backend migrations, read
  `wasm-v2-machine-migration-guide.md`. Its Cambridge Z88 section covers a machine that shares only
  the Z80 with the Spectrum: extending the shared core, feature-gated test backends, the per-key
  backend switch and the comparison submenu (`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`).
- **Before disassembling Z80 code out of a `.nex` file, or writing anything into a
  `.nex.dis` annotation sidecar, read `nex-reverse-engineering-guide.md`.** It carries
  the bank/offset/address model that every offset depends on, the NEX container layout,
  the full sidecar schema and the rules its loader enforces, a verified recipe for
  producing raw and annotated listings, the official Next register and I/O port
  references in `_input/next-fpga/` and how to query them, and the rules that stop a
  hand-written sidecar destroying the breakpoints stored beside the annotations.
- **Every reverse-engineering session updates `nex-reverse-engineering-guide.md` before
  it finishes** — the project author's standing instruction. Fold the durable learning
  into the section it belongs to, replace what it supersedes, and keep no history: that
  file is a standing brief, not a log. Findings about a *particular* program belong in
  that program's `.nex.dis` sidecar instead.
- For the user's high-level TypeScript-to-WASM migration intent and lessons
  learned from 48K/128K/+3E work, read
  `wasm-migration-intent-and-lessons.md`.
- **Before adding or migrating a dialog (or any stateful UI part) to the
  Model/Controller/View split that makes it testable without rendering, read
  `ui-mvc-guide.md`.**
- **Every style, theming or visual change updates
  `ui-theming-intent-and-lessons.md` as part of the same change** — the project
  author's standing instruction. Write the durable rule, fold it into the
  existing sections, replace what it supersedes, and keep no history: that file
  is a standing brief, not a log.
- **Before writing any test of ZX Spectrum Next hardware behaviour, read
  `../test/harness/zxnext/README.md`.** The harness runs the real machine (the WASM core) and scripts it
  through ports, NextRegs, memory, registers, picture and audio; it replaces mock-based device tests,
  and says how to add a method it lacks.
- **Before writing or running visual (pixel) tests of the ZX Spectrum Next, read
  `visual-tests-guide.md`.** Headless (WASM core in Node) and browser (WASM core in Chrome, real `.nexload`)
  tiers, how to write a case whose expectations come from the VHDL, and the pitfalls (non-linear
  display file, NextZXOS-changed NextRegs, `.ent`, IM2 tables) that already cost a session.
- **Before capturing documentation screenshots, or whenever you need the app driven
  programmatically into a known state, read `doc-screenshots-guide.md`.** It covers the
  Playwright-over-Electron harness in `scripts/doc-shots/`, driving the IDE through its own
  command prompt rather than the mouse, and seeding `KLIVE_SETTINGS_FILE` to pin theme,
  accent, panel sizes and fonts — which **corrects** the claim in
  `ui-theming-intent-and-lessons.md` that the settings file cannot set theme or accent.
- **Before touching theming, design tokens, the shared data-display primitives
  in `controls/data/`, or the Monaco syntax palette, read
  `ui-theming-intent-and-lessons.md`.** It carries the settled product
  decisions, the four token layers and their five mandates, the operational
  recipes for running and inspecting the app, and the mistakes the Phase 0-11
  modernization made so they are not repeated. **Including the one it made
  twice:** a standalone HTML replica is for choosing between design options with
  the author, never for believing a change works. Verify in the running app over
  CDP.

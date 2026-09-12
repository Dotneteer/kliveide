# AI Assistance Notes

This folder stores durable notes for future AI-assisted work in this repository.

- Read `../AGENTS.md` first.
- Keep notes concise and oriented toward repeatable future work.
- For future full-machine WASM backend migrations, read
  `wasm-v2-machine-migration-guide.md`.
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

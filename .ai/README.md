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
- **Before touching theming, design tokens, the shared data-display primitives
  in `controls/data/`, or the Monaco syntax palette, read
  `ui-theming-intent-and-lessons.md`.** It carries the settled product
  decisions, the four token layers and their five mandates, the operational
  recipes for running and inspecting the app, and the mistakes the Phase 0-9
  modernization made so they are not repeated.

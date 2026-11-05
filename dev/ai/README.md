# AI Assistance Notes

This folder stores durable notes for future AI-assisted work in this repository.

- Read `../../AGENTS.md` first.
- **Before committing, read `changesets-guide.md`**: when a commit carries a changeset in
  `dev/changes/`, when to ask the user, and how to show it. Before releasing, read `release-guide.md`.
- Keep notes concise and oriented toward repeatable future work.
- **Before planning or writing an "Under the hood" hardware article or series, read
  `hardware-articles-guide.md`**, and fold what a review teaches into it (a standing brief, not a log).
- For creating or updating IDE interactive commands, read
  `interactive-command-notes.md`.
- For future full-machine WASM backend migrations, read
  `wasm-v2-machine-migration-guide.md`. Its Cambridge Z88 section covers a machine that shares only
  the Z80 with the Spectrum: extending the shared core, feature-gated test backends, the per-key
  backend switch, the comparison submenu, and turning the lockstep comparisons into goldens before
  the TypeScript machine was removed (`dev/plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`).
- **Before disassembling Z80 code out of a `.nex` file, or writing anything into a
  `.nex.dis` annotation sidecar, read `nex-reverse-engineering-guide.md`.** It carries
  the bank/offset/address model that every offset depends on, the NEX container layout,
  the full sidecar schema and the rules its loader enforces, a verified recipe for
  producing raw and annotated listings, the official Next register and I/O port
  references in `dev/vendor/next-fpga/3.02.01/` and how to query them, and the rules that stop a
  hand-written sidecar destroying the breakpoints stored beside the annotations.
- **Before any style, token or theme work**, after `ui-theming-intent-and-lessons.md`, read `ui-design-system.md` (the token layers, the five mandates, the accents and their numbers, the derived themes).
- **Before changing the in-core debug loop or a core's debug path, read `wasm-core-debug.md`** (decisions D1-D14, traps T1-T11, the measured budgets) beside `src/emu/z80/wasm/README.md`.
- **Before changing the ZX80/ZX81, read `zx8081.md`** (the core's and the machine code's decisions, provenance, the virtual keyboard, open items) beside the core's README.
- **Before changing the Videoton TVC, read `videoton-tvc.md`** (decisions D1-D7, provenance, open hardware questions Q1-Q9, as-built notes, open items) beside the core's README.
- **Before adding a ZX Spectrum Next model or a behaviour that depends on the core version or board, read `zxnext-models.md`;** for the Next's real-time clock options, `zxnext-rtc.md`.
- **Before changing NEX debugging (`DebugSupport`, the breakpoint model, `DocumentPanels/Next/`, `nex-run`), read `nex-debugging.md`.**
- **Before changing the File Manager (`src/main/file-manager/`, `src/common/diskfs/`), read `file-manager.md`.**
- **Before changing the website or its documentation structure, read `docs-site.md`** (the rules
  R1-R7 and decisions the docs code and checks cite). **To turn Klive BASIC back on, read
  `klive-basic-switch.md`.**
- **Before writing anything into a shipped ROM sidecar (`src/public/roms/*.rom.dis`), read
  `rom-annotations/README.md` and `rom-annotations/PROVENANCE.md`.** The ROM annotations are
  written from scratch (decision D4): no commented ROM disassembly may be copied or consulted,
  from memory included, and every entry records its provenance. Log each authoring session in
  `PROVENANCE.md`. The machine-neutral annotation model (every machine's bank space, the active
  annotation set, ROM sidecars) is described in `../patterns/annotations.md`.
  **For the ZX81 ROM, also read `rom-annotations/zx81-authoring-guide.md`**: the working copy and
  the IDE open on it, the disassembly/apply/check tools in `rom-annotations/tools/`, harness
  probes, the traps already met, and what is left to annotate.
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
- **Before any work on ZX BASIC (Boriel BASIC) language support — Klive BASIC (the Klive-native
  compiler, `kbasic/compiler.md`, switched off since 2026-11-04 by
  `dev/ai/klive-basic-switch.md`), the Monaco language provider, or checking a new
  upstream release — read `zxbasic-syntax/README.md` and `kbasic/README.md`.**
  `zxbasic-syntax/zxbasic-syntax.json` is Klive's own description of the language and the only
  language reference to use. `kbasic/` holds the runtime ABI, the CODEBANK contract, the
  integration map and the documented library API. **No upstream code is copied, converted or
  translated — compiler or runtime**; upstream is read only to discover language and interface
  facts. `node dev/scripts/zxbasic-syntax-check.cjs` says whether a new upstream release changed
  anything the spec describes.
- **Before any work on the external Boriel BASIC 2.x integration (`zxbc`, the `.dbg` adapter, the
  bundled setup kit), read `boriel/README.md`.** `boriel/integration.md` is how the integration
  is built, `boriel/technical-debt.md` what is still open. The notes record what the pinned kit
  actually does: the macOS first-launch trap, the command line and
  diagnostics, the `.dbg` corrections the adapter needs, and the run-time data layouts verified on
  the 48K harness.
- **Before writing any test of ZX Spectrum Next hardware behaviour, read
  `../../test/harness/zxnext/README.md`.** The harness runs the real machine (the WASM core) and scripts it
  through ports, NextRegs, memory, registers, picture and audio; it replaces mock-based device tests,
  and says how to add a method it lacks.
- **Before writing or running visual (pixel) tests of the ZX Spectrum Next, read
  `visual-tests-guide.md`.** Headless (WASM core in Node) and browser (WASM core in Chrome, real `.nexload`)
  tiers, how to write a case whose expectations come from the VHDL, and the pitfalls (non-linear
  display file, NextZXOS-changed NextRegs, `.ent`, IM2 tables) that already cost a session.
- **Before capturing documentation screenshots, or whenever you need the app driven
  programmatically into a known state, read `doc-screenshots-guide.md`.** It covers the
  Playwright-over-Electron harness in `dev/scripts/doc-shots/`, driving the IDE through its own
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

# dev/

Everything here is for the people (and AI assistants) who develop Klive. None of it ships with the
app: `package.json`'s `build.files` is an allowlist (`out/**/*` and the licence files), so nothing
here reaches the packaged build.

The folder is being filled step by step by `.plans/ROOT_DECLUTTER_PLAN.md`. Until a subfolder has
moved, it is still at its old place in the repository root, shown in brackets below.

| Folder | What it holds | Who reads it |
|---|---|---|
| `ai/` | Guides, decisions and as-built records for each area of the code | AI assistants first, then contributors; `AGENTS.md` points into it |
| `patterns/` | Implementation pattern docs: the dialog MVC pattern, the Z80 back end, the source-level debugging model | Contributors and AI assistants before changing an established pattern |
| `plans/` (`.plans/`) | Current and archived implementation plans | Whoever works on the plan's area |
| `changes/` | Pending changesets, one per user-visible change | `npm run change`, `release:prepare` and the changeset-check workflow |
| `research/` | Research packs: datasheets, ROM listings, manuals, tapes and disks used while building a machine | Contributors and AI assistants working on that machine; some tests and doc scripts read tapes from it |
| `experiments/` | Klive projects used as demos and fixtures by the doc scripts | `dev/scripts/build-doc-assets.cjs`, the doc screenshot recipes |
| `vendor/` | Third-party kits and references: the Boriel BASIC kit description, the Next VHDL comment patches and the fetched VHDL, the Spectrum timing test kits | The app in a development run, the packaging, scripts and hardware tests |
| `scripts/` | Build, check, release, documentation and test tooling run through `npm run` | `package.json`, the workflows, the tests |

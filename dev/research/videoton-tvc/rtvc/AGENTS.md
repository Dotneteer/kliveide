# AGENTS.md — rtvc Documentation Index

This document serves as the entry point for coding agents and developers to find architectural knowledge, project information, and development guides for the Videoton TV Computer (TVC) emulator.

## Directory Map

Refer to the following resources for detailed documentation on the system:

- [TVC Technical Reference](info/tvc.md) — Detailed, implementation-neutral TVC hardware reference for emulator authors: timing, memory, I/O, interrupts, video, keyboard, sound, cassette, and expansion devices.
- [Zx82 Technical Reference](info/zx82.md) — Scoped ZX Spectrum 48K hardware reference and minimum agent-friendly emulation model, including limited instant-load options.
- [rtvc Implementation and Usage Reference](info/rtvc.md) — Rust architecture, emulation choices, media handling, snapshots, debugger, UI, persistence, and build targets.
- [rtvc Assembler Reference](info/assembler.md) — Built-in Z80 helper assembler syntax, `rtvc-asm` TOML output, and debugger loading workflow.
- [Hungarian rtvc Assembler Reference](info.hu/assembler.md) — Hungarian-language reference for the helper assembler, disassembler, output formats, and debugger workflow.
- [rtvc Developer Notes](info/developer.md) — Practical repo-specific findings, experimental workflows, debugger tricks, and development sharp edges that should be preserved but do not belong in hardware references.
- [User README](README.md) — User-facing run, snapshot, and web bundle commands.
- [Release Notes](CHANGES.md) — Concise release notes starting with the next release; older releases are intentionally not backfilled.
- [Open Issues and Desired Work](TODO.md) — High-level backlog of fixes, features, and emulator capabilities that are not yet complete.
- [Implementation Plans](.agents/plans/README.md) — Detailed, actionable plans for substantial work listed at a high level in `TODO.md`.
- [Development and Testing Skill](.agents/skills/development/SKILL.md) — Essential commands for compiling, running, testing, and benchmarking the emulator.
- [Release Skill](.agents/skills/release/SKILL.md) — Release workflow for version bumps, concise `CHANGES.md` updates, manual review, commits, tags, and pushes.
- [OpenCode Orchestrator Skill](.agents/skills/opencode-orchestrator/SKILL.md) — Optional local task-spec handoff to the OpenCode implementation agent.
- [info.hu](info.hu/) — Hungarian-language technical references, translated and adapted from [info/](info/). See [info.hu/README.md](info.hu/README.md) for the file index and the `L10N.md` policy.

## Documentation Maintenance Policy

To prevent documentation rot and ensure all agents have access to accurate information, adhere to the following rules:

1. **Keep the Hardware Specs Updated**: When verified TVC behavior changes or new hardware details are established, update [info/tvc.md](info/tvc.md). When Zx82 scope or verified Spectrum 48K behavior changes, update [info/zx82.md](info/zx82.md). Keep both references implementation-neutral and do not reproduce generic component specifications.
2. **Keep Commands and Workflows Updated**: If compilation workflows, test cases, or benchmarks change (e.g., adding a new benchmark tool or migrating test files), immediately update [.agents/skills/development/SKILL.md](.agents/skills/development/SKILL.md).
3. **Keep rtvc Details Updated**: If changing architecture, dependencies, build targets, emulation policy, media handling, snapshots, debugger behavior, UI strategy, browser storage, or WASM boundaries, update [info/rtvc.md](info/rtvc.md).
4. **Maintain the Boundary**: Put observable TVC hardware behavior in `info/tvc.md`, scoped Spectrum 48K behavior in `info/zx82.md`, repository-specific implementation and usage behavior in `info/rtvc.md`, and practical development findings or experimental workflow notes in `info/developer.md`.
5. **Avoid Topic Fragmentation**: Extend an existing machine or implementation reference rather than creating a new English subsystem document unless the material cannot reasonably fit an existing scope.
6. **Use Clickable Links**: When referencing codebase files or documentation, always use clickable Markdown links with the relative path (e.g., `[main.rs](src/main.rs)`) to enable easy navigation.
7. **Keep Planning Separate From the Backlog**: Keep [TODO.md](TODO.md) concise and high level: it records what should be added or fixed. Put detailed designs, implementation steps, integration points, and validation notes in [.agents/plans/](.agents/plans/README.md), and link the two when applicable.

## Session Archive

### 2026-05-23 — Hungarian localization (info.hu/)

Created Hungarian translations of the TVC technical reference documents under `info.hu/`, adapted from `info/tvc.md` and `info/sys/` sources:
- `info.hu/tvc.md` — Hungarian TVC hardware reference (translated from `info/tvc.md`)
- `info.hu/README.md` — File index and cross-reference between EN and HU docs
- `info.hu/sys/vt-dos.md` — Hungarian VT-DOS reference (adapted from `info/sys/vt-dos.md`)
- `info.hu/sys/basic.md` — Hungarian BASIC reference (adapted from `info/sys/basic.md`, plus original TVC BASIC extensions content not present in EN source)
- `L10N.md` — Localization policy: target audience, translation principles, UTF-8 with NFC normalization, term glossary, scope, and maintenance rules. Emphasizes original research (not machine translation) and specifies that `basic.md` supersedes the EN version as the authoritative reference.

Fixed encoding issues in `info.hu/sys/basic.md`:
- Corrupted `Ö` (U+FFFD replacement char → `Ö`)
- HTML entities (`&plusmn;`, `&minus;`, `&pi;`, `&ge;`, `&ne;`) → proper UTF-8 chars (`±`, `−`, `π`, `≥`, `≠`)

## Git and Command Execution Policy

To maintain control over repository history and remote operations, all agents must adhere to the following rules:

1. **No Automatic Pushing**: Never execute `git push` or perform any remote branch publishing/deletion commands without explicit, written confirmation and approval from the user.
2. **No Automatic Staging or Committing**: Never execute `git add`, `git commit`, or similar staging/commit commands without explicit, written confirmation and approval from the user, unless executing a documented repository skill (such as the Release Skill) that explicitly grants permission for these operations as part of its workflow.

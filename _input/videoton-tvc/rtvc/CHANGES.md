# Changes

Release notes start here. Older release history is intentionally not backfilled.

## Unreleased

## v0.8.6 - 2026-09-05

- Added `rtvc-basic` to compile numbered TVC BASIC source into CAS cassette
  images.
- Added `rtvc-tocas` to bulk convert `.bas` and `.asm` sources into sibling `.cas`
  files.
- Expanded the TVC debugger with bounded instruction tracing, richer
  automation, mapped-memory diagnostics, and rewindable frame history.
- Improved TVC video emulation and diagnostics, and reorganized ROM,
  snapshot, and local-state resources.


## v0.8.5 - 2026-06-20

- Added ZX Spectrum 48K emulation through the new `zx82` frontend.
- Added writable and formattable disk-image support.
- Added developer-mode and debugger UI improvements, expanded diagnostics, and
  ROM-aware disassembly tooling.
- Moved snapshots into the application data directory and improved ROM lookup.
- Expanded the TVC, BASIC, VT-DOS, and developer documentation.
- Expanded Windows and macOS releases into containing directories with disk,
  assembler, disassembler, and CAS-to-WAV command-line tools plus English and
  Hungarian documentation.

## v0.8.0 - 2026-06-13

- Added a simple built-in Z80 assembler.
- Added fastboot support to skip long RAM tests on startup.
- Improved the Gamebase dialog with autostart support, Escape-to-close, and case/Hungarian-accent-insensitive name filtering.
- Updated the web UI and reorganized the native menu.
- Decreased snapshot size and added application icons.
- Centered the emulator display while preserving responsive 4:3 scaling.

## v0.7.0 - 2026-06-09

- Build lightweight and full web bundles entirely with the optimized Cargo release profile.
- Added a searchable native/web Gamebase dialog with image tiles, metadata, extra screenshots, and on-demand CAS/DSK ZIP loading.
- Persisted native Gamebase media beside `rtvc.toml`, deduplicated recent-media names, and added File > Quit to the native app.
- Added debugger statistics and application-close commands, and improved debugger UI update responsiveness.
- Added tape playback progress to the emulator UI.
- Fixed browser audio initialization and Windows audio devices that use unsigned 8-bit PCM.

## v0.6.0 - 2026-06-09

- Added a full browser-based emulator UI with local CAS, DSK, ZIP, and snapshot file loading.

## v0.5.0 - 2026-06-04

- Added a TCP socket debugger command interface, supporting both native GUI and headless modes.
- Created a companion interactive Python REPL debugger client (`scripts/rtvc_debug.py`).
- Added command-line options (`-d`/`--disk`, `-t`/`--tape`, `-i`/`--inject`) to directly mount disk images, mount cassette tapes, or inject cassette tapes on startup.
- Added native GUI open-file dialogs for loading disk and cassette media.
- Fixed 16-bit address wrapping edge cases in the Z80 CPU instruction emulator.

## v0.4.1 - 2026-06-04

- Packaged macOS releases as an ad hoc signed `RTVC.app` bundle.
- Documented the macOS first-launch Control-click/right-click Open flow.

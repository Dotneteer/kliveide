# Frame History Debugger Progress

Last updated: 2026-07-21

## Status

A functional first vertical slice is implemented and compiles for native and
full-web targets. It still needs a hands-on UI smoke test before the feature is
considered complete.

## Completed

- [x] Detailed implementation plan written.
- [x] High-level TODO entry linked to the plan.
- [x] Planning documentation updated to use paired `-progress.md` continuation
  records after implementation starts.
- [x] Existing snapshot and frame-loop integration points inspected.
- [x] Added a UI-independent bounded `FrameHistory` model with adjustable
  1–30 second capacity, oldest-frame eviction, offsets, direct selection, and
  future-branch truncation.
- [x] Added downsampled framebuffer thumbnails stored independently of egui
  texture handles.
- [x] Added `Emu::capture_debug_snapshot` and `restore_debug_snapshot`, sharing
  the normal TVC state codec while restoring into the existing machine.
- [x] Added direct framebuffer refresh and key/input clearing after restore.
- [x] Captures are wired after completed, non-breakpoint frames only.
- [x] Added the Frame History workspace pane and View > Panes entry with Record,
  Stop, duration, Back Frame, Forward Frame, Return to Live, offsets, memory
  use, clickable thumbnails, and Save Selected Snapshot controls.
- [x] Save Selected Snapshot delegates to the existing normal snapshot dialog
  and writer.
- [x] Resuming or stepping through integrated UI controls from an older frame
  discards the newer branch.
- [x] Updated the implementation reference in `info/rtvc.md`.
- [x] Added the frame-timed `key_press <key> <duration>` debugger/TCP helper so
  automated checks can hold a key for an exact number of 50 Hz frames without
  host-side sleeps.

## Implementation Decisions

- Normal snapshot files and history restores will share the existing
  `Tvc::save_snapshot` / `Tvc::load_snapshot` state codec.
- History restore will load into the existing TVC instance rather than using
  `Emu::load_snapshot`, because the latter reconstructs the machine and
  reopens media. Loading into the existing instance preserves attached disk
  bytes while restoring the snapshotted controller state.
- The existing TVC snapshot loader already resets the emulated keyboard
  matrix. The history integration must additionally clear queued typed input
  and the UI's host pressed-key set.
- A history snapshot does not contain floppy image bytes, so disk writes are
  not rolled back.
- The history model will remain UI-independent. The debugger UI owns texture
  handles and invokes narrow emulator capture/restore methods.
- Restored video state is redrawn directly from VRAM and CRTC state without
  advancing the CPU.
- The existing snapshot save status reports the saved path. A dedicated Copy
  Path action and history-specific default filename are not yet implemented.

## Validation Run

- `cargo test frame_history --lib`: 6 passed.
- `cargo test debug_snapshot_restores_in_place --lib`: 1 passed.
- `cargo test --lib`: 116 passed.
- `cargo check`: passed.
- Targeted timed-key and TCP command tests: 3 passed.
- Manual headless check: `key_press 49 3` against a Laser Squad diagnostic
  snapshot was accepted and advanced execution from the player-count input
  loop. That port-local snapshot now lives in the standalone `tvc-ports`
  workspace and is not part of this repository.
- `cargo check --lib --no-default-features --features wasm-full --target
  wasm32-unknown-unknown`: passed.
- Documentation and source changes pass `git diff --check`.

## Next Steps

1. Manually smoke-test Record, Stop, navigation, thumbnail selection, screen
   refresh, resume-from-history branching, and Save Selected Snapshot with a
   running TVC game.
2. Load the saved selected-frame snapshot in a fresh rtvc process and confirm
   that it resumes from the selected PC and display state.
3. Add a history-specific default snapshot filename and a convenient Copy Path
   action if the manual workflow shows they are useful.
4. Decide whether TCP-issued stepping/continue commands should explicitly
   truncate a rewound UI timeline before execution; integrated UI controls
   already do so.

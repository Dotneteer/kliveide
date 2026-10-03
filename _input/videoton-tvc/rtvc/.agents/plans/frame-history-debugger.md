# Frame History Debugger Plan

## Goal

Add a short, adjustable history of once-per-frame emulator snapshots to the
debugger. A developer should be able to reproduce a visual failure, pause,
move backwards and forwards through recent frames, inspect thumbnails, and
save any selected in-memory state as a normal rtvc snapshot for later analysis
by a person or an AI agent.

This is frame-history debugging, not instruction-level reverse execution. It
is intended as a practical development tool for failures that become visible
over a few seconds.

## Scope Decisions

1. Capture one snapshot after each fully completed emulated frame.
2. Keep a time-limited in-memory ring buffer with an adjustable duration. Start
   with a five-second default and a practical range such as 1–30 seconds.
3. Provide Record, Stop, Back Frame, Forward Frame, and Return to Live controls.
4. Show the selected position relative to the newest frame, for example
   `Live`, `-1 frame`, or `-10 frames`.
5. Add a dedicated debugger view with clickable frame thumbnails.
6. Restore machine state without restoring host keyboard state. Every restore
   releases all emulated keys and clears queued text input.
7. Do not undo disk-image writes. The restored controller state operates on
   the currently attached disk contents.
8. Allow the selected in-memory state to be saved through the existing normal
   snapshot-file path.
9. Initially support the TVC machine. Keep the history controller sufficiently
   independent that other machines can provide compatible capture and restore
   operations later.
10. Use focused functional checks appropriate to a development tool; do not
    add a broad commercial-style test matrix.

## Non-Goals

- Instruction-by-instruction reverse execution.
- Replaying input to reconstruct intermediate states.
- Preserving pressed host or emulated keys across a restore.
- Undoing disk writes or versioning disk images.
- Persisting the frame history itself between emulator sessions.
- Creating a separate history snapshot file format.
- Making frame history part of normal emulation when recording is disabled.

## Architecture

Add a modular history controller, preferably in
`src/debugger/frame_history.rs` or the closest existing debugger module
layout. It owns the ring buffer, navigation cursor, capture policy, and compact
thumbnail data. It must not own emulator scheduling, file dialogs, or snapshot
serialization rules.

Suggested model:

```rust
pub struct FrameHistory {
    frames: VecDeque<FrameRecord>,
    selected: Option<usize>,
    recording: bool,
    capacity: usize,
}

pub struct FrameRecord {
    snapshot: Vec<u8>,
    thumbnail: FrameThumbnail,
    frame_number: u64,
    pc: u16,
}
```

The exact types may follow existing project conventions. Keep snapshot bytes
opaque to the history controller.

Expose narrow integration points on the application/emulator boundary:

```rust
pub fn capture_debug_snapshot(&mut self) -> Result<Vec<u8>>;
pub fn restore_debug_snapshot(&mut self, bytes: &[u8]) -> Result<()>;
```

The debugger UI calls the history controller. The controller calls these
capture and restore operations. The normal emulation loop only needs a single
post-frame capture hook and a notification when a historical state is
restored.

## Share the Existing Snapshot Path

Do not build another snapshot decoder or a second machine-restore procedure.
Refactor the current snapshot implementation so both file loading and history
restoration use the same core state serializer and loader:

1. The existing file snapshot path continues to handle file selection,
   compression/container decoding, ROM/media preparation, and errors intended
   for users.
2. A shared internal machine-state capture/load layer serializes and restores
   CPU, memory, paging, video, sound, interrupt, and device state.
3. Frame history calls that same internal layer directly with in-memory bytes.
4. Saving a selected frame calls the existing public snapshot save operation
   after restoring the selected state. It produces the same legitimate
   `.rtvcsnap.zip` file that the emulator normally creates.

This keeps snapshot compatibility and restore semantics in one place. History
snapshots may omit file-only work such as reopening media, but must not have an
independent state decoder.

## Capture Timing and Capacity

Capture only after a complete `Emu::tick()` frame, when the framebuffer and
all frame-boundary device state agree. Do not capture a partial frame stopped
by an instruction breakpoint or an individual debugger step.

Convert the selected duration to a frame capacity using the machine frame
rate. If the duration changes while recording, resize the ring buffer and
discard the oldest frames first. Prefer uncompressed in-memory state initially
because capture and restore latency matter more than a modest memory saving.
Display the estimated or current memory usage in the view so unexpectedly
large histories are apparent.

A five-second TVC history is expected to consume tens of megabytes once full,
including thumbnails. Measure the real state size during implementation and
adjust the default or range if necessary instead of embedding that estimate in
user documentation.

## Timeline and Navigation Semantics

- Starting recording clears the old timeline, captures the current complete
  state as its first entry, and then records each completed frame.
- Stopping recording retains the captured frames and current selection.
- Back Frame, Forward Frame, Return to Live, and clicking a thumbnail pause
  emulation before restoring the selected state.
- The newest entry is `Live`; older entries use negative frame offsets.
- Restoring a state refreshes the displayed framebuffer directly from restored
  video state without advancing the CPU.
- Continuing, stepping, or otherwise resuming execution from an older state
  creates a new timeline branch. Discard all entries newer than the selected
  state before capturing new frames.
- Moving forwards through the existing history remains possible while paused.
  Direct debugger edits to a restored state are temporary unless execution is
  resumed from that state.

## Keyboard and External State

Keyboard state is deliberately not meaningful history. After every restore:

- clear the emulated keyboard matrix;
- clear queued typed text and synthetic key state;
- clear the UI's tracked pressed-key set; and
- require new key-down events before any key is considered pressed.

Centralize this cleanup in the same post-restore notification used by normal
snapshot loading where possible. This prevents a key held during capture from
becoming stuck because its later host key-up event was never replayed.

Breakpoints, debugger layout, and other host-side debugging configuration stay
unchanged. Attached disk contents also stay current. Restoring the saved floppy
controller registers without rolling back disk bytes is an accepted
limitation.

## Debugger UI

Add a `Frame History` debugger view that can be opened and closed like the
existing debugger panes. It should contain:

- Record and Stop buttons with mutually clear enabled states;
- an adjustable history duration;
- Back Frame, Forward Frame, and Return to Live buttons;
- a position label such as `Live` or `-10 frames`;
- captured frame count and approximate memory use;
- a horizontally scrollable thumbnail timeline, newest frame on the right;
- a visible selected-frame highlight; and
- a `Save Selected Snapshot...` action.

Each thumbnail should show a small version of the TVC framebuffer and a compact
label containing its relative offset and useful context such as the Z80 PC.
Store small portable pixel buffers in the history records. Keep UI texture
handles in the UI layer so the controller remains renderer-independent.

Clicking a thumbnail performs the same operation as frame navigation: pause,
select, restore, refresh the framebuffer, and update the position label.

## Saving a Frame for Agent Analysis

The selected frame is the emulator's active restored state. `Save Selected
Snapshot...` therefore uses the normal snapshot save dialog and existing
snapshot writer rather than exporting the opaque history record itself.

Use an informative default filename when the platform permits it, for example:

```text
rtvc-frame-00142-pc-C418.rtvcsnap.zip
```

After saving, show the full saved path and provide a convenient Copy Path
action. The resulting file must load through the regular UI, command line, and
debugger automation path. This supports the intended agent workflow:

1. Record while reproducing the problem.
2. Stop or pause when corruption is visible.
3. Move back to the last useful frame.
4. Save the selected state as a normal snapshot file.
5. Give that path to an agent, which loads it using existing rtvc tooling.

## Implementation Order

1. Extract or identify the shared in-memory snapshot capture/load core used by
   normal snapshot files.
2. Add emulator-level debug capture and restore integration points, including
   post-restore input clearing and framebuffer refresh.
3. Implement the history ring buffer, duration/capacity handling, selection,
   navigation, and branch truncation independently of the UI.
4. Add the completed-frame capture hook to the emulator scheduler with no work
   performed while recording is disabled.
5. Add thumbnail generation using the existing framebuffer representation.
6. Add the Frame History debugger view and its controls.
7. Connect Save Selected Snapshot to the normal snapshot writer and expose the
   resulting path.
8. Update [info/rtvc.md](../../info/rtvc.md) and user-facing help once the
   implemented behavior is final.

## Focused Validation

Add small tests for behavior that is easy to regress:

- ring-buffer capacity, eviction, resizing, and frame offsets;
- back, forward, direct selection, return-to-live, and branch truncation;
- restoring representative CPU, RAM, video RAM, paging, and device state;
- releasing keys and clearing queued input after restore; and
- saving a selected frame as a standard snapshot and loading it back with the
  expected PC and representative memory values.

Perform a manual smoke test:

1. Record several seconds while running a game.
2. Pause and navigate through several thumbnails in both directions.
3. Resume from an older frame and confirm the future branch is discarded.
4. Save a selected frame, restart rtvc, load the saved file normally, and
   continue execution.

Use `cargo check` and targeted snapshot/frame-history tests. Broad platform,
performance, or release testing is outside the scope of this feature plan.

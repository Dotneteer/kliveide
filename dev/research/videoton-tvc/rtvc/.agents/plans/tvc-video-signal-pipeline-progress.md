# TVC Video Signal Pipeline Progress

Plan: [tvc-video-signal-pipeline.md](tvc-video-signal-pipeline.md)

## Current state

- The Interleaved pipeline lives in [`src/emulator/vid.rs`](../../src/emulator/vid.rs).
  Parallel comparison copies (`vid2.rs`, `vid3.rs`) have been removed.
- Video tests live in [`src/emulator/vid_tests.rs`](../../src/emulator/vid_tests.rs).
- The existing public `Vid` facade and snapshot wire format are preserved.

## Completed

- Reviewed the Motorola MC6845 description and TVC hardware documentation.
- Identified the required boundaries: CRTC timing, TVC final-color/sync
  generation, bounded signal transport, and receiver-only sync lock.
- Audited all callers of the current video facade.
- Added explicit CRTC, TVC generator, signal ring, and television receiver
  components in `vid.rs`.
- Changed the interleaved transport to carry packed final IGRB pixels plus
  shaped sync and blanking state.
- Wired the signal pipeline as the only Interleaved implementation.
- Added sync-driven PAL receiver lock, missing-sync behavior, ring-drop lock
  invalidation, and a 608x288 aperture positioned from observed edges.
- Added VS-set/MA9-released vertical blanking and isolated external monostable
  pulse widths as named approximations.
- Documented the hardware pipeline in `info/tvc.md` and receiver policy in
  `info/rtvc.md`.
- Added focused tests for normal timing, comparator behavior after live total
  writes, unreachable sync, final-color serialization, palette immutability,
  border encoding, missing VS, normal lock, and Laser Squad R6 timing.

## Validation

- `cargo fmt --all -- --check`: passed.
- Focused `vid::tests`: 9 passed.
- Focused `tvc::tests`: 28 passed.
- Full library suite with the sandbox-only occupied-port test skipped: 146
  passed, 1 skipped.
- `cargo check` and `cargo check --bins`: passed.
- Lightweight WASM simple and realistic checks: passed.
- Full-web WASM check: passed.
- `cargo run --bin perf_test`: completed; the benchmark covers the Z80 core,
  not the video ring specifically.

The unskipped full suite's only unrelated failure was the debugger occupied-
port test, whose socket bind was denied by the execution sandbox.

## Remaining verification

1. Measure or derive the board-variant SN74LS123 RC pulse widths and replace the
   isolated 8-character/4-line approximations.
2. Perform visual boot, VT-DOS, and Laser Squad comparison captures on a host
   with the required ROM/media fixtures.
3. Add a video-specific throughput benchmark if profiling shows the packed
   signal ring to be material.

# TVC Video Signal Pipeline and Television Sync Plan

Link to backlog: [TODO.md](../../TODO.md#video-emulation).

This plan supersedes the register-derived monitor work proposed in Phase 4 of
[vid-hardening.md](vid-hardening.md). The hardening work remains valid for
overflow safety, address wrapping, decoding, and adversarial CRTC values; only
the proposed monitor architecture is replaced here.

## Goal

Model the TVC video path as three distinct hardware stages:

1. the MC6845-compatible CRTC generates addresses, display enable, raw sync,
   and cursor timing;
2. the TVC display circuitry fetches VRAM, shifts pixels, resolves palette and
   border colors, blanks retrace, and reshapes sync for the external output;
3. an emulated television locks to the resulting sync signals and renders only
   the final color signal it could display.

The Interleaved model must tolerate software-reprogrammed CRTC geometry without
using normal firmware register values as monitor limits. If stable horizontal
or vertical sync is absent, it must not fabricate a picture.

Keep the public framebuffer at 608x288 and retain FastFrame as an explicitly
simplified current-state renderer.

## Evidence and Documentation Ownership

Primary implementation evidence:

- Motorola MC6845 functional block diagram and CRTC description supplied for
  this work;
- the TVC hardware description in
  `../../../tvcdocs/TVC_HARDVER/tvchardver.md`, especially its display-unit,
  border, sync-shaping, video-register, and PAL-encoder sections;
- [info/tvc.md](../../info/tvc.md#video-system), which remains the rtvc
  repository's authoritative hardware reference.

Before relying on a newly verified hardware fact in code, promote it into
`info/tvc.md`. Put emulator policy, receiver tolerances, lost-sync presentation,
and approximation choices in [info/rtvc.md](../../info/rtvc.md#video-emulation).

Do not copy the complete external hardware manual into this repository. Record
only the verified behavior needed to understand and validate the emulator.

## Current Architectural Problem

`Vid::stream_some()` currently queues a VRAM byte plus mode and sync flags.
`Vid::render_stream()` then performs pixel decoding and palette lookup while
also acting as a monitor. This crosses hardware boundaries:

- palette changes can affect already-queued bytes because colors are resolved
  when the consumer runs rather than when the TVC emits them;
- the monitor can inspect CRTC registers and palette state that a television
  cannot observe;
- fixed `76`-clock and `288`-line termination conditions are used as raster
  structure instead of as properties of the output surface;
- raw CRTC sync, TVC-shaped external sync, border selection, retrace blanking,
  and television lock are conflated.

The corrected design must make it impossible for the television stage to read
VRAM, palette state, video mode, border state, or CRTC registers.

## Hardware Boundary

### Stage 1: CRTC

Advance once per character clock and produce an internal tick containing:

- MA and RA;
- horizontal and vertical display enable, or the combined DE output;
- raw HS and VS levels and edges;
- cursor output/interrupt match;
- line, raster, and character-row progression needed internally.

The CRTC continues counting when HS or VS is absent. A sync-position comparison
that is never reached before its corresponding total reset produces no pulse;
it does not stop address generation or the other counter chain.

Implement and test the exact MC6845 variant behavior used by the TVC. In
particular, verify from the TVC component documentation and schematics:

- whether R3 controls only raw horizontal sync width;
- the raw vertical-sync duration;
- equality timing for the R2 and R7 comparators;
- zero-width and out-of-range register behavior;
- the effect of mid-frame register writes on active counters and outputs.

Do not infer external TV sync-pulse width directly from a CRTC register: the TVC
reshapes raw HS and VS downstream.

### Stage 2: TVC video generator

Consume CRTC ticks and current TVC state to produce the external video signal:

- fetch the addressed byte from the selected display VRAM bank;
- serialize it at the mode-dependent pixel rate;
- resolve palette entries immediately for 2- and 4-color modes;
- emit direct IGRB colors for 16-color modes;
- use DE-derived WSE behavior to select paper pixels or the border register;
- model horizontal and vertical retrace blanking through NVRCL;
- model the MA9-controlled vertical-video re-enable behavior;
- trigger the external monostables from raw CRTC HS and VS;
- emit shaped HSYNC and VSYNC and, where useful, derived composite sync.

The stream must carry the final TVC color signal, not undecoded VRAM data. One
candidate representation is one entry per character clock:

```rust
struct VideoSignal {
    /// Eight final four-bit IGRB pixel values, left to right.
    pixels: u32,
    hsync: bool,
    vsync: bool,
    blanked: bool,
}
```

The precise packed representation may change after benchmarking, but it must:

- preserve eight final pixel colors for every character clock;
- preserve sync transitions at character-clock precision;
- distinguish black video from retrace blanking for tests and diagnostics;
- contain no references that require later palette, mode, border, or VRAM
  lookup.

The external monostable pulse widths and NVRCL timing are a research gate. Read
the relevant TVC schematics/component values and record verified durations in
`info/tvc.md`; do not substitute unexplained firmware constants.

### Stage 3: television receiver

Consume only `VideoSignal` entries. The receiver must not access `Vid` CRTC or
color-generation state.

Maintain independent horizontal and vertical lock state:

- acquire horizontal lock from repeated shaped HSYNC edges;
- acquire vertical lock from shaped VSYNC plus a stable sequence of horizontal
  lines;
- measure periods from observed edges rather than R0/R4/R9;
- consume samples continuously while unlocked;
- invalidate lock on missing, implausible, or discontinuous sync;
- invalidate lock when ring overflow drops samples;
- discard partial raster state and reacquire cleanly when sync returns;
- return a completed frame only while both locks are valid.

Receiver timing acceptance is an emulator policy representing the connected
PAL television. Define documented tolerances around supported horizontal and
vertical frequencies. Do not use normal TVC CRTC register values as fallback
geometry. Values derived from register bit widths may be used only as defensive
resource bounds, not as evidence of television lock.

The 608x288 framebuffer is the television surface. Its aperture and sampling
must be expressed relative to observed sync timing. Decide through a focused
calibration step whether accepted nonstandard timing is:

- sampled at native TVC pixel-clock spacing and clipped to the fixed surface;
  or
- mapped through a receiver phase accumulator to the fixed raster.

Choose the policy that best matches a PAL CRT and preserves normal TVC geometry.
Document the choice and add a visual golden test. The number 76 may remain as
`608 / 8` when converting the fixed output width, but it must not terminate or
define a generated CRTC line.

## Internal Structure

Keep the existing `Vid` public facade initially to minimize integration churn,
but split its internals into explicit components, either as private structs in
the video module or as small sibling modules:

```text
Vid
 ├─ CrtcState
 ├─ TvcVideoGenerator
 ├─ SignalRing<VideoSignal>
 └─ TelevisionReceiver
```

Responsibilities:

- `CrtcState`: registers, counters, MA/RA, DE, raw sync, cursor timing;
- `TvcVideoGenerator`: VRAM fetch, shift/serialization, palette, border,
  NVRCL, external sync shaping;
- `SignalRing`: bounded transport and dropped-sample reporting;
- `TelevisionReceiver`: lock acquisition, aperture, framebuffer production,
  and lost-sync state.

Once the signal path is the canonical module, keep it in [`src/emulator/vid.rs`](../../src/emulator/vid.rs). Legacy `vid.rs` / `vid2.rs` comparison copies have been removed.

## FastFrame Policy

Retain FastFrame for lightweight and debugging use. It may render from current
VRAM/register/palette state and clamp programmed geometry to 608x288, but it
must be documented as not modeling:

- mid-frame mode, palette, border, or CRTC changes;
- TVC monostables and retrace blanking;
- television sync acquisition or loss.

Do not force FastFrame and Interleaved to produce identical output for invalid
or reprogrammed sync. They should share pure pixel-color decoding helpers, not
the Interleaved hardware pipeline.

## Implementation Order

### Phase 0: Promote evidence and freeze current behavior

1. Add the verified TVC pipeline to `info/tvc.md`: DE/WSE border selection,
   shifter/palette output, raw HS/VS, external monostables, NCSYNC, NVRCL, and
   MA9 video re-enable.
2. Update `info/rtvc.md` to mark the current Interleaved monitor as an
   approximation pending this plan.
3. Preserve normal-firmware and Laser Squad R6=48 screenshots or framebuffer
   hashes as migration references; do not treat current porch placement as
   automatically authoritative.
4. Create `tvc-video-signal-pipeline-progress.md` when implementation begins.

### Phase 1: Make CRTC outputs explicit

1. Extract or introduce `CrtcState::tick()` without changing external output.
2. Return explicit MA, RA, DE, raw HS, raw VS, and cursor state.
3. Correct comparator edge and pulse-duration behavior using verified MC6845
   evidence.
4. Add unit tests for normal timing and adversarial/missing-sync programming.
5. Keep cursor-interrupt timing connected to the same tick path.

### Phase 2: Generate final TVC colors and shaped sync

1. Add `TvcVideoGenerator` and the packed `VideoSignal` representation.
2. Move mode decoding and palette lookup from `render_stream()` into signal
   production.
3. Implement DE-selected paper/border output.
4. Implement verified NVRCL horizontal/vertical blanking and MA9 re-enable.
5. Implement external HS/VS monostables and composite-sync derivation.
6. Change the ring to carry final signal entries and report overflow to the
   receiver.

### Phase 3: Replace the monitor state machine

1. Introduce explicit unlocked, horizontal-locked, and fully-locked receiver
   states.
2. Detect sync edges and measure periods solely from `VideoSignal`.
3. Remove all CRTC-register, palette, border, mode, and VRAM reads from the
   receiver.
4. Implement documented PAL lock tolerances and timeouts.
5. Implement the calibrated 608x288 aperture and line/frame completion.
6. Reset receiver lock after dropped samples, snapshot load, machine reset, or
   discontinuous timing.
7. Feed the existing lost-sync UI from receiver lock state rather than from a
   fixed host-tick heuristic alone.

### Phase 4: Integration and cleanup

1. Update `Tvc::advance_video_for`, debug stepping, IRQ service, and run-loop
   frame completion to use the new facade without changing CPU scheduling.
2. Confirm lightweight WASM and full-web builds use the same Interleaved signal
   path when selected.
3. Benchmark signal packing, ring traffic, and television conversion.
4. Keep the pipeline in [`src/emulator/vid.rs`](../../src/emulator/vid.rs); do
   not reintroduce parallel `vid2.rs` / `vid3.rs` copies.
5. Update `info/rtvc.md`, release notes if user-visible output changes, and the
   progress record.

## Test Plan

### CRTC unit tests

- normal firmware produces 100 character clocks per line and 314 raster lines;
- DE spans exactly the programmed horizontal and vertical displayed regions;
- raw HS begins on the verified R2 coincidence and has verified duration;
- raw VS begins on the verified R7 coincidence and has verified duration;
- R2 beyond the reachable horizontal count produces no HS without stopping
  line, vertical, MA, or RA progression;
- R7 beyond the reachable vertical count produces no VS without stopping frame
  or address progression;
- R5 adjust and R9 raster progression remain correct;
- mid-row 14-bit MA wrapping and cursor comparison remain correct.

### TVC video-generator tests

- all three serializer modes produce eight expected IGRB output pixels;
- palette writes affect only subsequently generated pixels;
- mode and border writes affect only subsequently generated pixels;
- DE selects paper inside the active region and border outside it;
- NVRCL produces blanked output rather than border color during retrace;
- MA9 re-enables vertical video at the verified point;
- raw HS/VS trigger external pulses with verified widths;
- composite sync is the documented combination of shaped horizontal and
  vertical sync.

### Television tests

- normal shaped PAL sync acquires both locks and completes a 608x288 frame;
- valid HS without VS never completes a frame;
- valid VS without HS never completes a frame;
- missing both sync signals continuously drains the ring without a frame;
- stable reprogrammed timing inside receiver tolerance reacquires and displays;
- timing outside tolerance loses lock and produces no picture;
- returning normal sync discards partial state and reacquires cleanly;
- dropped ring samples invalidate lock;
- the receiver output is unchanged by mutations to CRTC/palette state after
  corresponding signal samples have already been queued.

### Integration scenarios

- normal TVC boot and VT-DOS;
- Laser Squad with only R6 changed from 60 to 48: unchanged line/frame sync,
  192 paper lines, and the additional area emitted as border where not blanked;
- a diagnostic program that changes R0/R1/R2 during display;
- a diagnostic program that removes and restores HS;
- a diagnostic program that removes and restores VS;
- mid-raster palette and border changes;
- snapshot save/load while Interleaved is selected;
- debugger step and run-to-cursor-interrupt behavior.

## Validation

Run after each behavioral phase:

```sh
cargo fmt --all -- --check
cargo test --lib
cargo check
cargo check --bins
cargo check --lib --no-default-features --features wasm,web-vid-simple --target wasm32-unknown-unknown
cargo check --lib --no-default-features --features wasm,web-vid-realistic --target wasm32-unknown-unknown
cargo check --lib --no-default-features --features wasm-full --target wasm32-unknown-unknown
cargo run --bin perf_test
```

Also run the FUSE CPU suite as a repository-wide regression check, then perform
the manual integration scenarios above. Record framebuffer references,
measured sync periods, lock transitions, and performance results in the
progress file.

## Performance Requirements

- Interleaved must remain suitable for real-time 50 Hz native execution.
- Avoid one heap allocation per sample, line, or frame.
- Keep the ring bounded and power-of-two indexed.
- Prefer packed final IGRB pixels over eight `u32` framebuffer colors in the
  transport.
- Convert IGRB to RGBA only in the television/framebuffer stage.
- Benchmark before choosing the final signal layout; do not trade correctness
  for an assumed optimization.

## Snapshot and Scheduling Constraints

The current snapshot stores CRTC registers, palette, border, and video mode but
not transient beam/receiver state. Preserve that wire format unless a concrete
resume requirement justifies a versioned extension. On snapshot load, reset
the CRTC transient counters according to existing policy and force the
television to reacquire sync.

CPU instructions are currently advanced as a unit and their elapsed video time
is applied after execution. This plan preserves that event granularity. Exact
Z80 I/O-write timing within an instruction is a separate bus-cycle project;
document that limitation when describing mid-raster accuracy.

## Completion Criteria

The work is complete when:

- the Interleaved ring contains final TVC output colors and shaped sync;
- the television receiver has no access to CRTC registers, VRAM, palette,
  border, or video mode;
- frame and line structure come from observed sync edges;
- missing sync cannot fabricate or complete a picture;
- normal TVC and Laser Squad output are validated;
- reprogrammed and missing-sync diagnostic cases behave deterministically;
- native, WASM, tests, and performance validation pass;
- `info/tvc.md`, `info/rtvc.md`, and the progress record match the implemented
  behavior.

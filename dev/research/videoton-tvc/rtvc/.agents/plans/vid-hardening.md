# Vid Module Hardening Plan

Link to backlog: [TODO.md](../../TODO.md) — no dedicated TVC-video item exists yet; propose adding `## Video Emulation — Robustness` if this plan is accepted. Covers [src/emulator/vid.rs](../../src/emulator/vid.rs) against [info/tvc.md](../../info/tvc.md#video-system) and integration in [src/emulator/tvc.rs](../../src/emulator/tvc.rs).

## Goal

Make the TVC video path panic-free under adversarial/supervisor CRTC programming, remove overflow UB, align `Interleaved` vs `FastFrame` decoder behavior, and add the missing vid-specific regression coverage — without changing the documented 608×288 output or the two-model architecture.

Keep this plan implementation-neutral where possible; keep runtime behavior docs in [info/rtvc.md](../../info/rtvc.md#video-emulation).

---

## Context

* Architecture under review: reviewer rates `sound` — two render paths are intentional and correct:
  * `VidModel::FastFrame` → whole-frame from live state via [Vid::draw_frame](src/emulator/vid.rs:622)
  * `VidModel::Interleaved` → 1× `i16` per character clock through sync/data ring via [Vid::stream_some](src/emulator/vid.rs:350) + monitor state-machine via [Vid::render_stream](src/emulator/vid.rs:480)
  * Cursor IRQ derived from live CRTC compare in [Vid::stream_some](src/emulator/vid.rs:370), not frame boundary; IRQ service time also streamed in [Tvc::service_shared_irq](src/emulator/tvc.rs:977) — both match [info/tvc.md](../../info/tvc.md#cursor-interrupt).
* Verified correct (no action needed beyond golden tests): `gen_address` at [vid.rs:22](src/emulator/vid.rs:22), mode 0/1/2 serializers, palette/border `IIGGRRBB` duplication, CRTC mirror + read masks (`R12/R14/R16 & 0x3F`, write-only → `0xFF`), snapshot `reset+reconfig` round-trip.
* Cross-reference: [info/tvc.md#clock-and-timing](../../info/tvc.md#clock-and-timing) requires deriving timing from CRTC state — firmware defaults (`R0=99`, `R1=64`, `R4=77`, `R6=60`, `R9=3`) are only a reference trace.

## Scope Decisions

1. **P0 — Crash fixes first (bugs 1–3 are panics).** No new features until `cargo run` cannot abort on out-of-spec CRTC values.
2. **Preserve both renderers.** `draw_frame` and `stream_some`/`render_stream` remain; dedup the decoder, do not collapse the models.
3. **Prefer clamp-and-draw over reject.** Software *may* reprogram the CRTC — docs say to handle it. Clamp geometry, fill overflow with border, never panic.
4. **Stream overflow is defensive, not performance path.** Producer/consumer are balanced today; any new caller (debugger, wasm) must not `panic!`. Choose drop/overwrite semantics explicitly.
5. **Hardcoded sync (bug 4) is P1 approximation-debt.** Fixing requires monitor-model change; document it now, derive later behind a flag.
6. **Tests live next to the bug.** Add a dedicated `vid` test module (`src/emulator/vid_tests.rs` or `#[cfg(test)]` in `vid.rs`) with adversarial CRTC + golden-byte cases — these would fail today in debug and pin bugs 1–2.

## Findings → Planned Fixes

### P0.1 Bug 1 — `usize` underflow in `draw_frame` ([vid.rs:629](src/emulator/vid.rs:629))

```rust
let top_border = (288 - active_height) / 2;   // active_height = vd*(slr+1) can exceed 288
let left_border = (76 - hd) / 2;              // hd can exceed 76
```

* Repro: `hd=100`, `vd=127`, `slr=31` → `active_height=4064`, `76-100` underflows, debug panics / release wraps.
* Fix: `saturating_sub` + clamp. Compute `active_height = (vd as usize).saturating_mul(scanlines_per_row).min(288)`, `active_width_chars = hd.min(76)`, then `top_border = 288usize.saturating_sub(active_height)/2`, `left_border = 76usize.saturating_sub(active_width_chars)/2`. Also clamp per-line loops to `0..76` with border fill outside `left_border..left_border+hd_clamped`. Identical for vertical: `y < top_border || y >= top_border + active_height` already handles clamp if `active_height` is clamped.

### P0.2 Bug 2 — `u8` overflow in `stream_some` ([vid.rs:379](src/emulator/vid.rs:379), [vid.rs:406](src/emulator/vid.rs:406), [vid.rs:420](src/emulator/vid.rs:420))

```rust
self.char_x > self.hsp && self.char_x < self.hsp + self.hsw  // hsp: u8 up to 255, hsw: 0..15
self.char_x <= self.ht  // ht up to 255, char_x: u8 wraps past 255
```

* Repro: `hsp=250`, `hsw=15` → `265` overflows `u8`; `ht=255` → `char_x` increments past 255 wraps in release / panics in debug.
* Fix: widen sync-window arithmetic to `u16`/`i16`:
  ```rust
  let hsp = self.hsp as u16;
  let hsw = self.hsw as u16;
  let cx  = self.char_x as u16;
  let hsync = if cx > hsp && cx < hsp + hsw { HSYNC } else { 0 };
  ```
  Same for `ht` comparisons: `if (self.char_x as u16) <= self.ht as u16`. Consider widening `char_x` storage to `u16` internally — it is a character-clock counter, not a CRTC register — or keep `u8` but gate `> ht` with `u16` to avoid wrap. Audit `self.char_x += 1` overflow: with `ht=255` the line is 256 chars; incrementing `u8` 255→0 mid-line is wrong; needs `u16`.

### P0.3 Bug 3 — `stream_data` panics on overflow ([vid.rs:462](src/emulator/vid.rs:462))

```rust
if next == self.stream_tail { panic!("streamData overflow"); }
```

* Today paired at three call sites, but any future producer without drain (debugger stepping, wasm `render_stream` not called per frame) crashes.
* Fix: decide policy and implement *one* (document in [info/rtvc.md](../../info/rtvc.md#video-emulation)):
  * **Option A — overwrite-oldest (recommended for emulator):** advance `stream_tail` on overflow, count `dropped` metric, keep running. Never loses forward progress, matches monitor dropping stale scanline.
  * **Option B — stall/drop-newest:** silently drop the new sample (or return `bool`). Preserves consumer view but loses scanline data under pressure.
  * **Not recommended:** grow buffer — hides bug, unbounded.
  * Regardless, replace `panic!` with `debug_assert!` + handling, expose `is_overflowed` or `dropped_samples: u64` for diagnostics. Keep `STREAM_SIZE` as capacity for ring; see P2.2 for pow2.

### P1.1 Bug 4 — Hardcoded sync constants in `render_stream` ([vid.rs:496-528](src/emulator/vid.rs:496))

```rust
if self.render_vcnt == 26 { ... }        // assumes 26 VSYNC lines
if self.render_hcnt == 16 { ... }        // 16-char back porch
if self.render_hcnt == 76 { ... }        // 76 active chars
if self.render_y == 288 { ... }
self.render_a = fb_width * self.render_y as usize; // vertical placement ~line 294
```

* With non-firmware geometry (`vt`/`hd` reprogrammed — documented as reachable), lock lands mid-frame → sheared image. `vsw` ignored (26-line counter), vertical output placement not hardware-derived.
* Fix (two stages):
  1. **Now:** add `// APPROXIMATION` comment block referencing [info/tvc.md#normal-firmware-crtc-programming](../../info/tvc.md#normal-firmware-crtc-programming) and the CRTC-derived-timing policy in [info/tvc.md#clock-and-timing](../../info/tvc.md#clock-and-timing). Document known deviations (`vsw` ignored, `vt`/`adj`/`vsp` not used for `render_vcnt` target, porch/active constants fixed). No behavior change yet.
  2. **Follow-up (separate PR):** derive monitor geometry from live CRTC: `total_lines = (vt+1)*(slr+1)+adj`, `vsync_lines = vsw` (≈ vs derived), `htotal = ht+1`, `active_chars = hd`, porch = `ht - hd` split via `hsp`/`hsw` or heuristic. Gate behind `Vid` config or make `render_stream` take `&self` snapshot so `draw_frame` and streaming converge. Validate against firmware trace `(77+1)*4+2=314` lines, 100 clocks/line, 76 used for 608px output (64 active + porch scaled).

### P1.2 Bug 5 — Cursor compare edge case ([vid.rs:370](src/emulator/vid.rs:370), [vid.rs:444](src/emulator/vid.rs:444))

```rust
cursor_it = self.curenabled && self.mem == self.curaddr && self.line == self.curstart;
...
self.mem = (self.mem_start + row*hd) & 0x3FFF; // masked only on row boundary
```

* Mid-row `mem` can exceed `0x3FFF` before mask → never equals wrapped `curaddr` (`& 0x3FFF`). Also redundant `self.curenabled &&` inside `if self.curenabled`.
* Fix: mask before compare: `(self.mem & 0x3FFF) == (self.curaddr & 0x3FFF)` (or keep `& 0x3FFF` on store per-increment). Remove redundant guard:
  ```rust
  if self.curenabled && (self.mem & 0x3FFF) == (self.curaddr & 0x3FFF) && self.line == self.curstart {
      cursor_it = true;
  }
  ```
  Also audit `self.curaddr` masking: [vid.rs:201](src/emulator/vid.rs:201) already does `& 0x3FFF` equivalent via `0x3F` high bits, but compare should be consistent. Cross-check `cursor_interrupt_setup` at [vid.rs:292](src/emulator/vid.rs:292) which correctly uses `& 0x3FFF` — make streaming path match.

### P2 — Maintainability / Performance

#### P2.1 Decoder duplicated (~80 lines) — [vid.rs:551](src/emulator/vid.rs:551) `write_pixel` vs [vid.rs:660](src/emulator/vid.rs:660) `draw_frame`

* Mode-1 nibble dance `pixelN = (bN+3<<1)|bN+4` and mode-2 odd/even split are tricky; two copies diverge silently.
* Fix: extract shared pure function, e.g.:
  ```rust
  fn decode_byte_to_rgba(mode: u8, byte: u8, palette: &[Color;4]) -> [u32; 8]
  // or smaller: fn decode_pixel_indices(mode: u8, byte: u8) -> [u8; 8]
  // then map through palette/to_rgba in renderer
  ```
  Both `write_pixel` and `draw_frame` call it. Add golden-byte tests to lock bit layouts (see Tests). Keep `to_rgba` at [vid.rs:14](src/emulator/vid.rs:14) as color primitive.

#### P2.2 `% STREAM_SIZE` on every push/pop ([vid.rs:460](src/emulator/vid.rs:460), [vid.rs:473](src/emulator/vid.rs:473))

* `STREAM_SIZE = 608*288*2*2 = 700416` not power of two → real division per sample (~200 samples/line × 314 lines/frame ≈ 62k divs/frame).
* Fix: make ring power of two + mask. Pick next pow2 `1<<20 = 1_048_576` (≈ +50% memory, still < 2 MiB `i16` buffer) or `1<<19 = 524288` if bounding is tight but must hold worst-case frame (`(ht_max+1)*vt_max*(slr_max+1)`). Simpler: `const STREAM_MASK: usize = STREAM_SIZE.next_power_of_two() - 1;` using masked index; keep `STREAM_SIZE` logical capacity but allocate `STREAM_CAP = STREAM_MASK+1` for storage. Benchmark with `cargo run --bin perf_test` before/after — like existing register-accessor mask optimization.

#### P2.3 Dead `Color { r,g,b }` fields ([vid.rs:27](src/emulator/vid.rs:27))

* Only `.rgba` and `.color` are read; `r,g,b` written in [vid.rs:46](src/emulator/vid.rs:46) never used.
* Fix: remove `r,g,b` fields or `#[allow(dead_code)]` narrowly. If kept for future debug overlay, gate with `#[cfg(debug_assertions)]` or document use. `Color` becomes `{ color: u8, rgba: u32 }`.

#### P2.4 `im`/`skec` decoded but unused ([vid.rs:74-75](src/emulator/vid.rs:74), [vid.rs:194](src/emulator/vid.rs:194))

* Documented as uncommon interlace/skew; acceptable to keep decoding. Add comment referencing [info/tvc.md#interlace-skew-and-light-pen](../../info/tvc.md#interlace-skew-and-light-pen) and file TODO to implement when a test ROM exercises it. No code change now.

---

## Implementation Order

### Phase 0 — Tests first (TDD, proves bugs 1–2)

1. Create `src/emulator/vid_tests.rs` (or `#[cfg(test)] mod tests` in `vid.rs`), wired via `#[cfg(test)] #[path = "vid_tests.rs"]`.
2. **Adversarial CRTC tests** (must not panic in debug):
   * `draw_frame_does_not_panic_hd_gt_76`: `hd=100`, `hd=255` with `slr=3`, `vd=60` → call [Vid::draw_frame](src/emulator/vid.rs:622) on 608×288 framebuffer, assert no panic and border-filled overflow.
   * `draw_frame_does_not_panic_vd_overflow`: `vd=127`, `slr=31` → active_height 4064 → assert clamped border fill, no `saturating_sub` panic.
   * `stream_some_does_not_panic_hsp_overflow`: `hsp=250`, `hsw=15`, `ht=255`, `hd=64` → `stream_some` for `FRAME_CLOCKS` cycles, step `render_stream`, assert no panic/wrap.
   * `stream_some_char_x_wraps_correctly`: `ht=255`, run 300 char clocks, assert `char_x` progression uses `u16` semantics.
   * `stream_data_does_not_panic_on_overflow`: fill ring without draining, call `stream_some` again → assert no panic (after P0.3 fix).
3. **Golden-byte tests** for mode decoders (against [info/tvc.md#video-mode](../../info/tvc.md#video-mode)):
   * Mode 0: `0b1010_0101` → indices `[1,0,1,0,0,1,0,1]` palette lookup.
   * Mode 1: known byte e.g. `0xAB = 0b1010_1011` → four pixels with `pixelN=(bN+3<<1)|bN+4` — assert four `d0..d3` values.
   * Mode 2: `0b1101_0010` → left `I=1,G=0,R=1,B=0`, right `I=1,G=1,R=0,B=1` → assert `to_rgba` outputs `0xFF...` with `0x7F`/`0xFF` levels.
   * Run same bytes through both `decode_byte` helper and `draw_frame` path to ensure no divergence.

### Phase 1 — P0 crash fixes (one PR, no behavior change otherwise)

1. Fix [vid.rs:629](src/emulator/vid.rs:629) with `saturating_sub` + clamp (P0.1).
2. Widen sync arithmetic to `u16` at [vid.rs:379](src/emulator/vid.rs:379) etc. (P0.2); decide `char_x: u8` → `u16` or guarded `u16` compare.
3. Fix cursor compare at [vid.rs:370](src/emulator/vid.rs:370) + [vid.rs:444](src/emulator/vid.rs:444) (P1.2 but trivial, batch with P0).
4. Replace `panic!` at [vid.rs:462](src/emulator/vid.rs:462) with overwrite-oldest or drop-newest (P0.3) + `dropped` counter.
5. `cargo test --lib` — adversarial tests now pass in debug; existing [src/emulator/tvc_tests.rs](../../src/emulator/tvc_tests.rs) still green.

### Phase 2 — Dedup + cleanup (P2.1, P2.3)

1. Extract `decode_byte` helper, rewrite [vid.rs:551](src/emulator/vid.rs:551) and [vid.rs:660](src/emulator/vid.rs:660) to call it.
2. Remove or gate `Color.r/g/b`.
3. Add comment for `im`/`skec`.
4. Re-run golden-byte tests + `cargo test`.

### Phase 3 — Performance (P2.2)

1. Change ring to pow2 + mask; keep logical `STREAM_SIZE` for compatibility or rename to `STREAM_CAP`.
2. Benchmark `perf_test` before/after; verify no functional change with `render_stream` frame-completion test.

### Phase 4 — Sync-const documentation + future derivation (P1.1)

1. Add approximation comment block in [vid.rs:480](src/emulator/vid.rs:480) (`render_stream`) explaining 26/16/76/288 assumptions and `vsw` ignored.
2. Update [info/rtvc.md#video-emulation](../../info/rtvc.md#video-emulation) to note known limitation vs [info/tvc.md#clock-and-timing](../../info/tvc.md#clock-and-timing) CRTC-derived policy.
3. File follow-up plan to derive `render_vcnt`/`render_hcnt` targets from live `vt`/`ht`/`hd`/`vsp`/`vsw`/`adj`/`slr`; do not implement in this plan's PR.

---

## Validation

* **Unit:** new `vid_tests` adversarial + golden tests; existing `cargo test` (FUSE 1334, `tvc_tests` snapshot/CRTC).
* **Integration:** `cargo run --bin rtvc -- snapshots/boot12dos.rtvcsnap.zip` still boots; resize CRTC via debugger `write_memory`/`port` and observe border fill, not panic.
* **Cross-target:** `cargo check`, `cargo check --bins`, three wasm checks per [.agents/skills/development/SKILL.md](../../.agents/skills/development/SKILL.md#cross-target-validation), `cargo tree` lightweight tree has no `cpal`/`egui`.
* **Performance:** `cargo run --bin perf_test` for ring-mask change.

## Risks & Mitigations

* Widening `char_x` to `u16` changes struct layout — snapshot `VID` chunk at [src/tvc_snapshot.rs](../../src/tvc_snapshot.rs) currently serializes CRTC regs, not streaming cursor; streaming state is transient (reset on load) so no wire break. Verify `Vid::reset` at [vid.rs:160](src/emulator/vid.rs:160) resets new width.
* Pow2 ring changes memory by ~350 KiB — acceptable; if wasm memory is constrained, keep `700416` logical size with `1<<20` physical and `%`→`&` via `next_power_of_two`.
* Border-centering math change may shift 1px with odd `active_height`/`hd` — matches spec intent; add test that `hd=64` centered at `(76-64)/2=6` unchanged.

## Docs to Update When Done

* [info/rtvc.md#video-emulation](../../info/rtvc.md#video-emulation) — note `saturating` clamping policy and `stream_data` overflow handling choice.
* [info/rtvc.md#current-crtc-policy](../../info/rtvc.md#current-crtc-policy) — if adding pow2 ring, note ring sizing.
* This plan's status → create `vid-hardening-progress.md` sibling per [.agents/plans/README.md](../../.agents/plans/README.md) when implementation starts.

## Offer

Reviewer offered to fix 1–3 + regression tests. Accept: merge Phase 0+1 as one PR, then follow with Phase 2–4. Keep PRs small enough that `cargo test` + manual smoke (boot, change CRTC, no panic) is sufficient review.

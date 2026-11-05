# Instruction Trace Progress

Last updated: 2026-07-22

## Status

A functional bounded instruction trace is implemented for TVC and Zx82. Core,
TCP, and workspace integration compile and focused tests pass. A hands-on UI
smoke test remains.

## Completed

- [x] Added a UI-independent `InstructionTrace` ring with configurable
  1,000–1,000,000 entry capacity.
- [x] Captured pre-instruction clock, opcode bytes, complete Z80 register and
  interrupt state, elapsed cycles, and accepted-interrupt markers.
- [x] Captured memory and port writes only while an instruction trace entry is
  active.
- [x] Recorded TVC main/video mapper values without adding TVC details to the
  generic trace model.
- [x] Integrated one narrow trace hook into the TVC and Zx82 instruction-step
  paths; tracing disabled is allocation-free.
- [x] Added an Instruction Trace debugger pane with Record, Stop, Clear,
  capacity control, newest-first virtualized rows, disassembly, registers,
  mapper values, writes, and links to the Disassembly pane.
- [x] Added `instruction_trace_start`, `instruction_trace_stop`,
  `instruction_trace_clear`, `instruction_trace_status`, and
  `instruction_trace_list` TCP commands.
- [x] Added `trace`/`itrace` commands to `scripts/rtvc_debug.py`.
- [x] Updated the implementation and development workflow references.

## Decisions

- This is an observation tool, not reverse execution. It does not restore old
  CPU state or undo memory, port, or disk writes.
- Record starts a fresh trace. Reset and state load clear entries, and traces
  are not serialized into snapshots.
- Each entry owns only effects produced while executing that instruction. If a
  TVC interrupt is accepted immediately afterward, its entry writes are kept
  with the interrupted instruction and the entry is marked
  `interrupt_accepted`.
- TCP list responses are capped at 10,000 newest entries to bound response
  size; the in-memory ring may be larger.

## Validation

- `cargo test instruction_trace --lib`: 5 passed.
- `cargo test --lib`: 121 passed.
- `cargo check`: passed.
- Lightweight `web-vid-simple` and `web-vid-realistic` WASM checks: passed.
- Full `wasm-full` check: passed.
- `python3 -m py_compile scripts/rtvc_debug.py`: passed.
- Headless TCP smoke test against a port-local Laser Squad diagnostic snapshot:
  a 1,000-entry ring filled while running, `trace status` reported its state,
  and `trace list 5` returned disassembly, registers, mapper values, stack/RAM
  writes, and port writes. The snapshot now lives in the standalone
  `tvc-ports` workspace and is not part of this repository.
- `git diff --check`: passed.

## Next Steps

1. Smoke-test the integrated pane controls and virtualized trace rows.
2. Use the captured writes to locate the first malformed Spectrum shadow write;
   add address-range filtering or a write watchpoint only if the trace proves
   too noisy.

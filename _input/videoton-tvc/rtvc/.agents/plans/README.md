# Implementation Plans

This directory contains detailed, actionable plans for substantial emulator
work.

[TODO.md](../../TODO.md) is the high-level backlog: it records what should be
added or fixed. A plan in this directory explains how a selected item should be
implemented, including scope, design decisions, integration points,
implementation order, limitations, and focused validation.

## Conventions

- Use a short descriptive kebab-case filename, such as
  `frame-history-debugger.md`.
- Link to the corresponding [TODO.md](../../TODO.md) entry when one exists.
- Prefer clear module boundaries and explicit integration points over detailed
  pseudocode that will quickly become stale.
- Record significant scope and design decisions so later agents do not need to
  rediscover them.
- Update the plan when implementation changes an important decision. Keep
  user-facing and implementation reference documentation authoritative for
  completed behavior.
- When implementation begins, create a sibling `<plan-name>-progress.md` file.
  Keep it as a concise continuation record: current status, completed work,
  decisions discovered during implementation, validation already run, and the
  next concrete steps. Update it whenever a work session materially changes
  the implementation state.

## Current Plans

- [C80 Compiler and Integrated Source View](c80-compiler.md)
- [Clean Up the `laser-port1` Porting Effort](cleanup-laser-port1.md)
  ([progress](cleanup-laser-port1-progress.md))
- [Frame History Debugger](frame-history-debugger.md)
  ([progress](frame-history-debugger-progress.md))
- [Instruction Trace](instruction-trace-progress.md)
- [Multi-System Architecture](multi-system-architecture.md)
- [TVC Video Signal Pipeline and Television Sync](tvc-video-signal-pipeline.md)

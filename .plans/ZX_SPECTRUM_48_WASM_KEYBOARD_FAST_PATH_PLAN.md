# ZX Spectrum 48K WASM Keyboard Fast Path Plan

Reference source: `sp48-keyboard.c` from `Dotneteer/kliveide` `dotneteer/groups-plan`.

Goal: move the ZX Spectrum 48K WASM keyboard matrix to C/WASM-owned state, following the reference implementation's eight-row keyboard line model and key status helpers.

## Steps

| Step | Status | Notes |
| --- | --- | --- |
| K0 | Completed | Mapped the reference keyboard implementation and the current TS-to-WASM keyboard row sync path. |
| K1 | Completed | Added C-side keyboard line storage, reset, key status setter, line getter, and pointer export. |
| K2 | Completed | Switched FE port reads to consume C-side keyboard lines instead of the generic input block keyboard row area. |
| K3 | Completed | Extended the WASM loader/runtime and TypeScript adapter to sync rows into the C keyboard line view. |
| K4 | Completed | Updated mocks/tests and added focused coverage for C keyboard exports and adapter sync. |
| K5 | Completed | Ran WASM build, focused tests, size check, type-check, and whitespace validation. |

## Design Notes

- Keep the existing TypeScript `KeyboardDevice` as the UI-facing source of truth.
- Sync row bitfields into a WASM-owned `keyboard_lines[8]` buffer for fast port reads.
- Keep `inputKeyboardRowsOffset` layout values for compatibility with existing ABI/tests, but stop using them on the hot FE read path.
- Export `sp48_keyboard_lines_ptr`, `sp48_set_key_status`, and `sp48_get_keyboard_line` for direct state access and focused tests.

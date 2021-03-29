# Klive Electron Application

## Electron processes

```
======================   ======================
| Emulator window    |   | IDE window         |
| (renderer process) |   | (renderer process) |
======================   ======================
          ^                        ^
          |    ================    |
          |--->| Main process |<---|
               ================
```

## State Management

- redux (distributed)
- Stores:
    - `mainStore` (single source of truth)
    - `emuStore` (emulator replica)
    - `ideStore` (ide replica)
- Replication rules:
    - each store recognizes if a `dispatch` is originated locally/remotely
    - Local update in `mainStore` triggers update in `emuStore` and `ideStore`
    - Local update in `emuStore` triggers update in `mainStore`. `mainStore` forwards updates to `ideStore`.
    - Local update in `ideStore` triggers update in `mainStore`. `mainStore` forwards updates to `emuStore`.
    - Updates are in a single transaction.

## Virtual Machines

All virtual machines (ZX Spectrum, Cambridge Z88, and future machines) run in the Emulator window's renderer process as a combination of JavaScript and WebAssembly code.
- WebAssembly: virtual machine core implementation (CPU, memory, and other hardware emulation)
- JavaScript: UI integration and machine execution loop management


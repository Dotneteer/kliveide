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

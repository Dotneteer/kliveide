# Klive BASIC's runtime package

The runtime modules only Klive BASIC needs — its String operations (`strings`), arrays (`arrays`),
DATA/READ (`data`) and USR (`usr`) — as the `kbasic` package of the shared Z80 back end's runtime.
Every program also links the back end's `core` and `zx` packages (`src/main/z80-backend/runtime/`).

The header, the linking rules, the register contract (`@abi`) and the conventions are the back end's:
read `src/main/z80-backend/runtime/README.md`. A module here may require `core`, `zx` and `kbasic`
modules; no `core` or `zx` module may require one of these. Run `npm run runtime:bundle` after
changing a module.

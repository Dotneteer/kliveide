# ZX Spectrum Next WASM Backend

The ZX Spectrum Next production default is the full-machine WASM backend.
`ZxNextMachineFactory` still accepts the `zxnextImplementation` machine config
value, so `"typescript"` remains an explicit fallback while `"wasm"` selects the
default runtime directly.

The production artifact is built from `zxnext/zxnext.c` and companion device
translation units into `dist/zx-spectrum-next.wasm`.

Useful commands:

```sh
npm run build:zxnext-wasm
npm run check:zxnext-wasm-size
npm run benchmark:zxnext-wasm -- --frames 120 --warmup 20 --runs 5
```

Normal frame execution should call WASM once per frame, sync only changed input
and storage adapter state, and avoid per-tact or per-port JavaScript crossings.
`ZxNextWasmV2Machine.getWasmV2Diagnostics()` exposes the adapter counters used
to guard that contract.

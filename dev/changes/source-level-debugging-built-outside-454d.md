---
type: feature
---

**Source-level debugging for a `.nex` built outside Klive:** `nex-run -d` now reads the `<name>.dbg` that Boriel BASIC's `zxbc` wrote beside the `.nex` (build with `--debug=<name>.dbg`, and `-M <name>.map` for symbols), checks that it belongs to that exact build, and stops at your source breakpoints. The Windows install of Boriel BASIC is also about 34 MB smaller, because the installer no longer unpacks debug-symbol files that nothing loads.

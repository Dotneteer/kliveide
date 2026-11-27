---
type: fix
---

Tape: TZX files that use pure-tone, pulse-sequence, pure-data or direct-recording blocks (12h-15h)
played incompletely: the ZX Spectrum models played a pure tone as silence, and the other three block
types were dropped on every machine, so tapes with custom loaders failed to load. They now play on
the ZX Spectrum 48K, 128K, +2/+3 and Next and on the SAM Coupé.

---
type: breaking
issues: [1431, 1432]
---
ZX Spectrum 48K, 128K and +2E/+3E machine states saved by 0.63.0 no longer load exactly, because
the emulator cores' memory layout changed. Such a `.kls` file loads from the `.szx` snapshot it
carries: nearly the same state, without the tape's exact position, the disk controller's state and
a few CPU details. Klive says when this happens.

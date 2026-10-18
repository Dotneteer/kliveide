---
type: feature
issues: [1463]
---
**Source-level debugging of Boriel BASIC programs:** programs built with Boriel BASIC 2 get the
same debugger as Klive BASIC programs, on the ZX Spectrum and on the Next: source breakpoints, the
execution point, Step Into/Over/Out, the Call Stack (`FASTCALL` routines included), the Variables
panel, watches and runtime-error stops. The Next's NEX export writes its debug file, so
`nex-run -d` debugs it.

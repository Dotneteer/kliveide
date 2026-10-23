---
type: feature
---

**Machine code for the HT-1080Z:** the assembler takes `.model HT1080Z`, and Run and Debug
start the code in the emulated machine as its `SYSTEM` command would: Klive answers the power-on
question so BASIC keeps below the code, writes it into RAM and starts it, and a `RET` goes back to
BASIC. Inject leaves the code for `X=USR(0)`. Export writes a `.cmd` load module or a `.cas` tape
that loads with `SYSTEM`. A new project template prints a welcome on the screen; `klive run` and
the Z80 unit-test runner take HT-1080Z projects too.

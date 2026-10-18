---
type: feature
issues: [1448]
---
**Code and data detection:** after a run with code coverage on, **Debug › Detect Code and
Data...** (also `ann-detect` or the Disassembly view's tools button) proposes annotation regions
from what the program actually did: code, and `.defb`, `.defw` or `.defm` data, bank by bank. It
warns about self-modifying code, overlapping instructions and code bytes that are also read, and
its changes can be undone.

---
type: feature
issues: [1448]
highlight: "**Reverse-engineering tools:** annotations on every machine, annotated ROMs, code and data detection from coverage, a graphics finder, SkoolKit import/export and export as re-assemblable source."
---
**Annotations on every machine:** the Disassembly view is now an editable, annotated listing on
the ZX Spectrum 48K, 128K, +2A/+3 and Next, the Pentagon, the Scorpion, the Timex machines, the
ZX80 and the ZX81. Right-click a row to add a label, a synopsis or an end-of-line comment, or to
mark data; the `label` command adds a label from the command prompt. Annotations are kept in a
`.dis` file beside the program: `nex-run`, `zx-snapshot`, `tape-load` of a ZX80/ZX81 program and
the open project (`annotations.dis`) choose it for you, or pick one with `ann-new` or `ann-open`.
Snapshot banks can be annotated too. The same names appear in the Execution History, the Call
Stack, the Profiler and `dis`, and on every machine with banks, `bp-set` accepts
`<bank>:+<offset>` and `<bank>:<label>`.

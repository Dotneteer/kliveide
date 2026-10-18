---
type: feature
issues: [1445]
---
**Debug recordings:** **Debug › Save Debug Recording...** (`drsave`) saves a reverse-debugging
session to a `.klr` file. **Debug › Open Debug Recording...** (`drload`), **File › Open File...**
or dropping the file on the Emulator window opens it on the same machine and configuration, paused
where it was saved, with its whole past to step back through; its breakpoints and watches come
with it as session breakpoints. A minute of a ZX Spectrum game takes about 1-2 MB, and `.klr`
files have a viewer in the Explorer. A recording replays only in the Klive build that made it; for
a file from another build, Klive offers to open its end state instead.

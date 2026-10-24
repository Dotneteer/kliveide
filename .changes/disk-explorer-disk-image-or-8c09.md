---
type: fix
---

Disk Explorer: a disk image or cartridge changed with the `disk` command (`disk add`, `disk rm`,
...) kept showing its old files in an already open Disk Explorer until it was opened again. Every
open view of the image now reloads after any edit.

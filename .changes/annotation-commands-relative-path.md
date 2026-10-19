---
type: fix
---

Annotations: with no project open, `ann-new`, `ann-open` and the `rom-ann-*` commands took a relative
file name as relative to Klive's own folder, so `ann-new zx80.rom.dis` wrote an annotation set among
Klive's application files. A relative path now needs an open project, and the command says so;
`ann-new` with a `.rom.dis` name also points to `rom-ann-new` for a ROM's own annotations.

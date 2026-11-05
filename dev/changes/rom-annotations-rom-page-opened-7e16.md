---
type: fix
---

ROM annotations: a ROM page opened read-only from Klive's own annotations (with no working copy) had
no context menu in its disassembly, so Go to Definition and Go to References (and their Ctrl+F12 and
Shift+F12 keys) could not be used. They now work there; the editing entries stay disabled until a
working copy is made.

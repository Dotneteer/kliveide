---
type: fix
---

A Boriel BASIC program with a `DO` … `LOOP` (or another block statement) warned that its debug information failed a check ("statements overlap"), and source stepping could stop on the block's line instead of its first statement: zxbc records the block over the first inner statement's code. Klive now gives that code to the inner statement.

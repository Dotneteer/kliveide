---
type: internal
---

The Boriel BASIC banked-program test checked the far-call runtime's old `shadowStackKind` field, removed by the source-debug model's version 2; it now checks the `records` layout the adapter writes. The test runs only where a real zxbc is installed, so CI never saw it fail.

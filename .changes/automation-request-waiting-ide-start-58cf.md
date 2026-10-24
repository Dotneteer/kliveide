---
type: fix
---

An automation request waiting for the IDE to start sometimes failed with a `timeout` error instead of `not-ready` when its timeout ran out; it now always reports `not-ready`.

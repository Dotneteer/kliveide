---
type: fix
issues: [1462]
---
ZX80: *Load and Run* of a program file, and running code from the IDE, often stopped at the K
cursor, because the 4K ROM ignored a key that came too soon after the reset. Klive now waits
before it types `LOAD` or `RUN`.

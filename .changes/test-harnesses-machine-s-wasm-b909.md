---
type: internal
---

Test harnesses: a machine's WASM core is built only when it is out of date, once per test process. Every
test file used to rebuild it behind the shared build lock, so in a full run a test could wait for the
other files' builds and pass its timeout (the HT-1080Z GALAXY sample test did).

---
type: fix
---

The emulator's sound started after one frame instead of the intended three, so it ran with a cushion of only 12-31 ms and could run dry, and fade out with a click, when frames arrived a few milliseconds late. A frame now counts as a lone frame (as when the debugger steps) only after two frames' worth of time without a new one.

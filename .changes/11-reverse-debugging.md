---
type: feature
issues: [1445]
---
**Reverse debugging on every Z80 machine:** while a debug session is paused, **Step Back**, **Step
Forward**, **Reverse Step Over**, **Reverse Step Out** and **Reverse Continue** (Alt+F5) put the
whole machine back at any recorded instruction, memory, devices and screen included, and every
panel shows that moment. Stepping or continuing from the past replays the recorded run with your
breakpoints active, and **Take over here** makes the current point the present and goes on live
(on the Next this undoes the SD card writes of the discarded future). Reverse Continue checks
every breakpoint kind, so a memory-write breakpoint finds where a byte last changed; a long search
shows its progress and can be cancelled (`reverse-continue-cancel`). The status bar shows how far
back you are, and a click returns to the present. **Settings › Debugging** sets how much memory
the timeline may use.

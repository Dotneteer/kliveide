---
type: fix
---

ZX Spectrum 128K: the contention table was wrong on every display line but the first (a delay missing before the line's first cell, a stray one after its last), and the frame interrupt lasted 32 T-states instead of 35. With late timing (its authors' machine), ZX Spectrum Timing Tests 128K now passes all but one test.

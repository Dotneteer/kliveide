---
type: fix
---

ZX Spectrum +2A/+3: the gate array's timing followed the older machines' ULA. Port $FE and the instructions' internal cycles were contended, which the gate array never does, and a border colour change appeared 4 T-states (8 pixels) late. Timed border effects such as ULA 128E +3 Test now draw what a real +3 shows.

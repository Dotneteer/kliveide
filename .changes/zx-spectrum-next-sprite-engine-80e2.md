---
type: fix
---

ZX Spectrum Next: the sprite engine ran out of time on a crowded line at the wrong sprite. Klive counted 18 clocks for a 1× sprite instead of 17, refused a sprite by the previous sprite's scale instead of its own, let sprites parked off the right cost nothing, and never cut a sprite part-way at the end of a line, so a line with every sprite on it showed 71 sprites instead of 75; the line budget now matches the hardware, checked clock by clock against its simulated sprite engine.

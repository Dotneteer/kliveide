---
type: fix
---

On the ZX Spectrum Next, sound played about half a second late: the audio buffer took the Next's frame, counted in 28 MHz clocks, for eight times its real length, so playback waited for about 24 frames instead of three. The buffer is now sized from the frame's real length.

---
type: fix
---

Screen recording: while a recording ran, the emulator paused after every frame until the recorder
had taken it, so the live sound kept running dry and played choppy (most audibly with a 128K
game's AY music). The emulator now keeps its pace while the frames are written.

---
type: feature
issues: [1431]
highlight: "**RZX input recordings:** play, debug, record, roll back and render `.rzx` files to video."
---
**RZX input recordings:** Klive plays and records RZX files (version 0.13) on the ZX Spectrum 48K
(16K and NTSC too), the 128K and the +2E/+3E, and a recording made on a +2A or +3 plays on the new
Amstrad models. Open an `.rzx` file with **File › Open File...**, drop it on the Emulator window,
use **Play recording** in the Explorer or the recording's tab, or `zx-rzx <file>`. **Debug
recording** (`zx-rzx <file> -d`) stops at the first instruction, breakpoints and stepping work
while it plays, and a desync pauses the machine and names the frame. The `.rzx` viewer shows the
file's details, its segments (each can be played from, `zx-rzx <file> -s <n>`) and its first
snapshot. **Machine › Record › RZX: Record** (`zx-rzx-record`) records from the current state with
a rollback point every five seconds, with **RZX: Roll Back** (`zx-rzx-rollback`), **RZX: Insert
Rollback Point** (`zx-rzx-point`) and **RZX: Stop and Save...** (`zx-rzx-stop <file>`). **RZX:
Render a Recording to Video...** (`zx-rzx-video <file>`) plays a recording into a video file. A
PLAY/REC badge in the status bar shows the frame counter.

---
type: feature
issues: [1442]
---
**Hide, solo and probe the ZX Spectrum Next's video layers:** the Layers strip under the emulator
screen (**Settings › Emulator › Show the Layers strip**, the status bar's context menu, or the
`layers` command, such as `layers spr off` or `layers l2 solo`) lists the layers in their `$15`
priority order, hides or solos each one, marks where no layer is opaque, and draws the four clip
windows. A paused picture is redrawn exactly at once, even after mid-frame Copper changes. The
pixel probe names the layer that produced a pixel and the rule that made it win, and a click opens
the inspector that owns it. **View › Machine Views › Layers** (`show-layers`) shows the priority
stack and a card per layer. This changes only what the emulator shows, never what the machine
does, and a pill on the screen says when a layer is hidden.

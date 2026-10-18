---
type: feature
issues: [1434]
highlight: "**ZX Spectrum Next inspectors:** Copper debugging, and live Sprite, Tilemap and Layer 2 inspectors, with layer hiding and a pixel probe on the emulator screen."
---
**ZX Spectrum Next Copper debugging:** a **Copper** panel in the Debug activity shows the Copper's
mode, state, PC, write pointer, line offset and beam, with the instructions around its PC. The
**Copper List** document (**View › Machine Views › Copper List**, or `show-copper [index]`)
decodes all 1024 instructions with their meaning and a colour swatch for palette writes, marks the
Copper's PC and last hit, flags a list without `HALT` and `WAIT`s that never match at the current
timing, and draws a raster ruler of where in the frame each `WAIT` acts. `bp-set cu:<index>` stops
the machine when the Copper completes an instruction, with hit counts, conditions, logpoints and
one-shots; set one from the list's gutter, its row menu (**Run to here**, `run-to cu:`) or the
margin of a `.copper` source line. **Step Copper** (**Debug › Step Copper**, `step-copper`) runs
to the Copper's next instruction.

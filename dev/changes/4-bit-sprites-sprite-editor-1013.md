---
type: feature
---

**4-bit sprites in the sprite editor.** A `.spr` sheet can now be read as 4-bit patterns (128 bytes, two pixels per byte) with the new 8-bit/4-bit switch in the sheet toolbar, and every tool, undo, copy and paste works on them; the sheet's toolbar and strip then call them patterns. A palette-offset choice picks which 16 colours a 4-bit sheet is drawn with, and the palette shows only that row. Switching never changes the file; the editor remembers the choice for each file.

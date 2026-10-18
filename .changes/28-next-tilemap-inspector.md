---
type: feature
issues: [1435]
---
**Tilemap Inspector for the ZX Spectrum Next:** **View › Machine Views › Tilemap Inspector**,
`show-tilemap [x y]` or `show-tiles [n]` opens one document with two linked views: **Map**, the
40x32 or 80x32 map (whole, or as displayed) with each cell's tile, attributes and address, and
**Tiles**, the 256 or 512 definitions with usage counts and unused tiles dimmed. Select a tile and
every cell that uses it is outlined. Diagnostics check the map, the tile definitions and the ULA
screen for setup mistakes such as overlaps. The inspector only reads, so opening it never changes
the machine.

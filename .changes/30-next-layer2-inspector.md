---
type: feature
issues: [1436]
---
**Layer 2 Inspector for the ZX Spectrum Next:** **View › Machine Views › Layer 2 Inspector** or
`show-layer2 [shadow|window]` shows the displayed (`$12`), shadow (`$13`) or `$123B` write-window
banks as an image at their resolution, either whole with the 16K bank boundaries outlined, or as
displayed with the scroll and clip window applied. A Banks strip names each bank's role, and the
pixel inspector gives a pixel's byte, palette index and addresses: **Show in memory** opens the
byte (in its 8K page when it is not mapped), and **Break on write** sets a bank-relative write
breakpoint.

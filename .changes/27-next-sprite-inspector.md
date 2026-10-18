---
type: feature
issues: [1434]
---
**Sprite Inspector for the ZX Spectrum Next:** **View › Machine Views › Sprite Inspector**,
`show-sprites [n]` or `show-patterns [n]` opens one document with two linked views. **Sprites**
decodes all 128 attribute slots (pattern, position, palette offset, transforms, anchors,
visibility) with diagnostics chips, change markers since the last stop and **copy as
nextreg/.db**; **Patterns** shows the 16K of pattern RAM in the live or a pinned sprite palette,
with usage badges. An inspector shows the selection and a map of sprite space. `export-patterns`
(or **Export pattern RAM as .spr**) saves the pattern RAM. The inspector only reads: it does not
clear the sprite status port `$303B`.

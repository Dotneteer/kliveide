---
type: feature
issues: [1448, 1460, 1466]
---
**ROM annotations:** Klive recognises a ROM by its bytes, also when it is loaded from your own
file, and shows the labels and comments it ships for it, so calls into the ROM read by name. This
release ships the main entry points of the ZX Spectrum 48K ROM and the whole ZX81 ROM: a label on
every call and jump target, a synopsis for each of its 604 labels, its data regions, and its
tables (keys and keywords, edit keys, the calculator, syntax, operator priorities and the
character set). ROM labels are set in italics, and the Disassembly view's **ROM labels** switch
hides them. `bp-set ROM:<name>` breaks at a ROM label, and `ROM:<name>` also works in breakpoint
conditions.

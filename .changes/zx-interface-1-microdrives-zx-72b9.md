---
type: feature
highlight: "**The ZX Interface 1 with two Microdrives** on the ZX Spectrum 48K and 128K."
---

**ZX Interface 1 and Microdrives:** the ZX Spectrum 16K, 48K, 128K and +2 can have an Interface 1
with two Microdrives (Machine › Interfaces), running the shipped second-edition ROM or your own.
`.mdr` cartridges are inserted, created blank, write-protected and saved as; what the Spectrum
writes goes back into the file sector by sector. FORMAT, CAT, SAVE *, LOAD *, VERIFY *, ERASE, MOVE
and the OPEN # streams work as on the real drive, at its speed or with Fast Microdrive. Boot
Cartridge in Microdrive 1 runs a cartridge's `run` program. The Disk Explorer and `disk` open
`.mdr` files, `crd mdr` and `crd mdrblank` make cartridges, and Export Code (`expc -f mdr`)
writes one that boots your program. `.z80` and `.szx` snapshots keep the interface and its
paging (`.szx` also links the cartridges), and RZX recordings and reverse debugging work with it.
RS232 and the network are not connected. The Interface 1 and the DivMMC are connected one at a time.

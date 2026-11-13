---
type: fix
---

ZX Spectrum Next: Run and `nex-run` copied the `.nex` file onto the model's default SD card image,
not the card the machine had mounted, so NextZXOS loaded a stale copy from a project's own card.
The file now goes to the mounted card, and a card that is not a `.cim` image gives an error.

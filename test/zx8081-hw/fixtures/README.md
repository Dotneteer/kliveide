# ZX80/ZX81 test fixtures made for Klive

- `hi.o`: a ZX80 `.O` program, `10 PRINT "HI"`. Made on 2026-10-03 by typing the line on Klive's own
  ZX80 (the WASM core with the ZX80 ROM) and writing out $4000 up to E_LINE - the bytes a ZX80 SAVE
  writes. No third-party program is in it.

The third-party `.P` files the tests use stay in `_input/zx81-tapes/` with their licences.

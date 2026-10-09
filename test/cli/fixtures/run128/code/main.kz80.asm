; klive run's 128K fixture: pages bank 3 in at $C000, leaves a marker in it and in Marker, then
; ends in DI; HALT.
  .model Spectrum128
  .org $8000
Main:
  di
  ld a,$13
  ld bc,$7ffd
  out (c),a
  ld a,$5a
  ld ($c000),a
  ld (Marker),a
  halt

Marker:
  .defb 0

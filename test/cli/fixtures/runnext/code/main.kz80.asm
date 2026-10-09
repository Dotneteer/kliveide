; klive run's ZX Spectrum Next fixture: counts in Counter until it reaches 100, sets the border
; through a NextReg-free OUT and ends in DI; HALT. `.savenex` lets the e2e test build it as a .nex too.
  .model Next
  .savenex file "runnext.nex"
  .savenex ram 768
  .savenex stackaddr $bff0
  .org $8000
Main:
  di
  ld sp,$bff0
  ld hl,Counter
Loop:
  inc (hl)
  ld a,(hl)
  cp 100
  jr nz,Loop
  ld a,4
  out ($fe),a
  halt

Counter:
  .defb 0

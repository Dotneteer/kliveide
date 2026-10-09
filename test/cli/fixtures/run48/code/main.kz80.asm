; klive run's 48K fixture (.plans/COMMAND_LINE_AUTOMATION_PLAN.md §6): fills the top third of the
; screen, turns the border red, counts ten loops in Counter (calling Step each time) and ends in
; DI; HALT, so every stop condition has something to stop at.
  .org $8000
Main:
  ld hl,$4000
  ld de,$4001
  ld bc,$07ff
  ld (hl),$ff
  ldir
  ld a,2
  out ($fe),a
  ld b,10
Loop:
  ld hl,Counter
  inc (hl)
  call Step
  djnz Loop
Done:
  di
  halt

Step:
  ret

Counter:
  .defb 0

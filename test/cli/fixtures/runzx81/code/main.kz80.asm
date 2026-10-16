; klive run's ZX81 fixture (.plans/ZX8081_CODE_INJECTION_PLAN.md): the code goes into a 1 REM line,
; RUN calls it through RAND USR, it counts ten loops in Counter and returns to BASIC.
  .model ZX81
Main:
  ld b,10
Loop:
  ld hl,Counter
  inc (hl)
  djnz Loop
Done:
  ret

Counter:
  .defb 0

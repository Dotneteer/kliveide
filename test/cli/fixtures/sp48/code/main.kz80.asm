; The command line's fixture project (.plans/UNIT_TESTS_CLI_PLAN.md §6): every test passes.
; The repository's CI runs 'klive test' on it, as the docs' GitHub Actions example does.
#include "unit_tests.kz80.asm"

  .org $8000
Main:
  ret

; --- Adds B to A
Add:
  add a,b
  ret

; --- The length of the zero-terminated string at HL in A
StrLen:
  ld b,0
StrLenLoop:
  ld a,(hl)
  or a
  jr z,StrLenDone
  inc hl
  inc b
  jr StrLenLoop
StrLenDone:
  ld a,b
  ret

  UNITTEST_INITIALIZE()
  ret

  .module Math
UT_AddSmall:
  ld a,2
  ld b,3
  call Add
  TEST_A(5)
  TC_END()

UT_AddWraps:
  ld a,$ff
  ld b,2
  call Add
  TEST_A(1)
  TC_END()
  .endmodule

  .module Strings
UT_Length:
  ld hl,Hello
  call StrLen
  TEST_A(5)
  TC_END() ; LOGPOINT length is ${A}

UT_Empty:
  ld hl,Empty
  call StrLen
  TEST_A(0)
  TC_END()

Hello: .defm "HELLO"
  .defb 0
Empty: .defb 0
  .endmodule

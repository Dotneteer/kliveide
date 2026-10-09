; A fixture of the command line's tests: a pass, a failed assertion, a stack overflow, a timeout
; and a test whose LOGPOINT text needs XML escaping. The include is the passing fixture's.
#include "../../sp48/code/unit_tests.kz80.asm"

  .org $8000
Main:
  ret

  UNITTEST_INITIALIZE()
  ret

UT_Pass:
  ld a,5
  TEST_A(5)
  TC_END()

  .module Suite
UT_Fail:
  ld a,7
  TEST_A(5)
  TC_END()

UT_Overflow:
  push hl
  jr UT_Overflow

UT_Escape:
  ld a,1
  TC_END() ; LOGPOINT <a & "b"> 'c'
  .endmodule

  .module Slow
UT_Timeout:
  jr UT_Timeout
  .endmodule

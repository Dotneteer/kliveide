; A fixture of the command line's tests: the unit-test frame, but no UT_ labels.
#include "../../sp48/code/unit_tests.kz80.asm"

  .org $8000
Main:
  ret

  UNITTEST_INITIALIZE()
  ret

; A fixture of the command line's tests: the build fails.
#include "../../sp48/code/unit_tests.kz80.asm"

  .org $8000
Main:
  ld a,UndefinedSymbol
  ret

  UNITTEST_INITIALIZE()
  ret

UT_Never:
  TC_END()

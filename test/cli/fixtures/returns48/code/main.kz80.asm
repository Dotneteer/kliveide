; klive run's keyboard fixture: the program returns to BASIC at once, so --keys types at the editor.
  .injectopt subroutine
  .org $8000
Main:
  ret

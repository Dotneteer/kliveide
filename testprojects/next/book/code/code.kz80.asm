; ==============================================================================
; ZX Spectrum Next Screen Test Cases 
; ==============================================================================
.model next

.savenex file "screen-tests.nex"
.savenex core "3.1.0"
.savenex stackaddr STACK_TOP

; Unbanked code in bank 2 at $8000
    jp Main

#include "display.kz80.asm"
#include "helpers.kz80.asm"
#include "border-tests.kz80.asm"
#include "ula-tests.kz80.asm"

#include "teststable.kz80.asm"

Main:
    ; When NEX file starts, interrupt is disabled
    ei
MainLoop
    call ClearScreen            ; Empty screen
    PrintText2(WelcomeText)     ; Display the menu text
KeyLoop
    call WaitForKey             ; Dispatch the key
    cp KEY_X                    ; Handle "Exit" key
    jp z,Exit
    cp KEY_LC_X 
    jp z,Exit
    cp KEY_T                    ; Hanlde the "Test" key
    jp z,RunTests
    cp KEY_LC_T
    jp z,RunTests
    Border(4)
    jr KeyLoop
trap 
    jr $

;
; Start the test cycle
RunTests
    ld bc,0
    ld hl,TestTable
`testloop
    ld e,(hl)
    inc hl
    ld d,(hl)
    inc hl
    ld a,d
    or e
    jr z,EndTests
    ;
    ; Save main registers
    push bc
    push de
    ;
    ; Invoke the next test
    call ClearScreen
    ;
    ; Print test number and title
    push hl
    push de
    ld h,b
    ld l,c
    call PrintHL
    pop de                      ; DE=Current test descriptor
    ex de,hl
    ld e,(hl)
    inc hl
    ld d,(hl)                   ; DE=Test routine
    inc hl
    ld c,(hl)
    inc hl
    ld b,(hl)                   ; BC=Test parameter
    inc hl
    ld a,(hl)                   ; A=Non-zero if should wait for key
    inc hl                      ; HL=Test title to print
    ;
    ; Save test address, parameter, and keypress flag
    push de
    push bc
    push af
    ex de,hl
    PrintAt(2, 0)
    Ink(1)
    call PrintTermText
    Ink(0)
    pop af                      ; Restor keypress flag
    and a
    jr z,`runTest               ; No keypress required
    ld de,StartTestText
    call PrintTermText
    call WaitForKey
    ld de,EmptyText
    call PrintTermText
`runTest
    pop bc                     ; Restore address and parameters
    pop de
    ;
    ; Execute the test
    ;
    ex de,hl
    push `testReturn
    jp (hl)
    ; 
`testReturn
    ; Sign the test has been ended
    call Beep
    pop hl
    ;
    ; Restore main registers
    pop de
    pop bc
    inc bc
    jr `testLoop

;
; All tests run
EndTests
    ; call ClearScreen
    PrintText2(EndText)
    call WaitForKey
    Border(7)
    jp MainLoop

;
; Page to ZX Spectrum Next ROM and restart
Exit
    nextreg $8e,$00
    jp $0

WelcomeText
    .dm "\a\x01\x01" ; AT 1, 1
    .dm "Klive Screen Tests"
    .dm "\a\x03\x01" ; AT 3, 1
    .dm "\I\x01L\I\x00 List tests"
    .dm "\a\x05\x01" ; AT 5, 1
    .dm "\I\x01T\I\x00 Execute tests"
    .dm "\a\x09\x01" ; AT 9, 1
    .dm "\I\x01X\I\x00 Exit"
    TERM_TEXT()

EndText
    .dm "\a\x14\x01" ; AT 20, 1
    .dm "Tests completed."
    .dm "\a\x15\x01" ; AT 21, 1
    .dm "Press any key."
    TERM_TEXT()

StartTestText
    .dm "\a\x04\x00" ; AT 4, 1
    .dm "Press any key to start the test"
    TERM_TEXT()
EmptyText
    .dm "\a\x04\x00" ; AT 4, 1
    .dm "                               "
    TERM_TEXT()


;
; Keep $100 bytes for stack
.defs $100
STACK_TOP


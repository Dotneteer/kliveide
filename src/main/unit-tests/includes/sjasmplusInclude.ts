/*
 * Klive's unit-test include in sjasmplus syntax (`.plans/Z80_UNIT_TESTS_PLAN.md` D5).
 *
 * Written from scratch for Klive, like the Klive-assembler one (`kliveInclude.ts`): the same labels,
 * macro names and behaviour, in sjasmplus syntax. A DeZog project keeps the include it already has;
 * **Testing → Add unit-test support** writes this one only into a project that has none.
 */

/** The file name the include is written under */
export const SJASMPLUS_INCLUDE_FILE = "unit_tests.inc";

export const SJASMPLUS_UNIT_TEST_INCLUDE = `; ==================================================================================================
; Klive unit-test macros (sjasmplus syntax)
;
; DeZog-compatible unit tests: a test is a subroutine whose label starts with UT_ and that ends with
; TC_END instead of RET. Its suite is its module: Module1.UT_test2 is in the suite Module1.
;
; Set-up, once in the program:
;
;     ; the SLDOPT COMMENT line that exports DeZog's comment keywords to the SLD file
;     ; (Klive's sjasmplus page and its build warning LP002 give it)
;     include "unit_tests.inc"
;     ...
;     UNITTEST_INITIALIZE
;         ; your initialisation code, run before every test
;         ret
;
; The Klive IDE runs every test on a fresh machine: it runs the code after UNITTEST_INITIALIZE,
; writes the test's address into the CALL at UNITTEST_CALL_ADDR, and starts UNITTEST_TEST_WRAPPER.
; A test passes when it reaches UNITTEST_TEST_READY_SUCCESS (TC_END), and fails when one of its
; assertion comments stops it. Every assertion compares registers only, so a failure shows the values: in
; "A == B  (A=$07, B=$05)" the first register holds the actual value and the second the expected one
; (TEST_STRING and TEST_MEM_CMP: A expected, C actual).
;
; Written for Klive from the documented meaning of DeZog's conventions; adapt it freely.
; ==================================================================================================

; --------------------------------------------------------------------------------------------------
; The test frame: the wrapper, the success loop, a private stack of 50 words and the start point.
; Invoke it once; your initialisation code follows it and ends with RET.
    MACRO UNITTEST_INITIALIZE
UNITTEST_TEST_WRAPPER:
    di
    ld sp,UNITTEST_STACK
UNITTEST_CALL_ADDR:
    call 0                          ; the runner writes the test's address here
.returned:
    jr .returned                    ; a test that ends with RET returns here: an error, use TC_END
UNITTEST_TEST_READY_SUCCESS:
    jr UNITTEST_TEST_READY_SUCCESS  ; TC_END jumps here: the test passed
UNITTEST_STACK_BOTTOM:
    defs 100                        ; the tests' stack, 50 words; a write to its lowest word overflows
UNITTEST_STACK:
    defw 0                          ; what a RET past the empty stack would read: an underflow
UNITTEST_START:
    di
    ENDM

; --------------------------------------------------------------------------------------------------
; Ends a test case (instead of RET)
    MACRO TC_END
    jp UNITTEST_TEST_READY_SUCCESS
    ENDM

; --------------------------------------------------------------------------------------------------
; Registers

; Loads known values into A, BC, DE and HL; TEST_UNCHANGED_* checks they are still there
    MACRO DEFAULT_REGS
    ld a,0xAA
    ld bc,0xBBCC
    ld de,0xDDEE
    ld hl,0x1122
    ENDM

; Fills every register - the alternate set, IX and IY too - with values
    MACRO USE_ALL_REGS
    exx
    ex af,af'
    ld a,0xA1
    ld bc,0xB1C1
    ld de,0xD1E1
    ld hl,0x4151
    ex af,af'
    exx
    ld a,0xA2
    ld bc,0xB2C2
    ld de,0xD2E2
    ld hl,0x4252
    ld ix,0x1A2A
    ld iy,0x1B2B
    ENDM

    MACRO TEST_UNCHANGED_A
    nop ; ASSERTION A == 0xAA
    ENDM
    MACRO TEST_UNCHANGED_B
    nop ; ASSERTION B == 0xBB
    ENDM
    MACRO TEST_UNCHANGED_C
    nop ; ASSERTION C == 0xCC
    ENDM
    MACRO TEST_UNCHANGED_D
    nop ; ASSERTION D == 0xDD
    ENDM
    MACRO TEST_UNCHANGED_E
    nop ; ASSERTION E == 0xEE
    ENDM
    MACRO TEST_UNCHANGED_H
    nop ; ASSERTION H == 0x11
    ENDM
    MACRO TEST_UNCHANGED_L
    nop ; ASSERTION L == 0x22
    ENDM
    MACRO TEST_UNCHANGED_BC
    nop ; ASSERTION BC == 0xBBCC
    ENDM
    MACRO TEST_UNCHANGED_DE
    nop ; ASSERTION DE == 0xDDEE
    ENDM
    MACRO TEST_UNCHANGED_HL
    nop ; ASSERTION HL == 0x1122
    ENDM
    MACRO TEST_UNCHANGED_BC_DE
    nop ; ASSERTION BC == 0xBBCC && DE == 0xDDEE
    ENDM
    MACRO TEST_UNCHANGED_BC_DE_HL
    nop ; ASSERTION BC == 0xBBCC && DE == 0xDDEE && HL == 0x1122
    ENDM

; A holds value
    MACRO TEST_A value
    push bc
    ld b,value
    nop ; ASSERTION A == B
    pop bc
    ENDM

; A does not hold value
    MACRO TEST_A_UNEQUAL value
    push bc
    ld b,value
    nop ; ASSERTION A != B
    pop bc
    ENDM

; An 8-bit register other than A holds value: TEST_REG b, 5
    MACRO TEST_REG reg, value
    push af
    ld a,value
    nop ; ASSERTION reg == A
    pop af
    ENDM

; A register pair other than IX holds value: TEST_DREG hl, 0x4000
    MACRO TEST_DREG dreg, value
    push ix
    ld ix,value
    nop ; ASSERTION dreg == IX
    pop ix
    ENDM

; --------------------------------------------------------------------------------------------------
; Flags

    MACRO TEST_FLAG_Z
    nop ; ASSERTION (F & 0x40) != 0
    ENDM

    MACRO TEST_FLAG_NZ
    nop ; ASSERTION (F & 0x40) == 0
    ENDM

; Always fails
    MACRO TEST_FAIL
    nop ; ASSERTION
    ENDM

; --------------------------------------------------------------------------------------------------
; Memory

; The byte at addr is value
    MACRO TEST_MEMORY_BYTE addr, value
    push af
    push bc
    ld a,(addr)
    ld b,value
    nop ; ASSERTION A == B
    pop bc
    pop af
    ENDM

; The word at addr is value
    MACRO TEST_MEMORY_WORD addr, value
    push de
    push hl
    ld hl,(addr)
    ld de,value
    nop ; ASSERTION HL == DE
    pop hl
    pop de
    ENDM

; The bytes at addr are the string; with term0 non-zero a 0 must follow them
    MACRO TEST_STRING addr, string, term0
    push af
    push bc
    push de
    push hl
    ld hl,addr
    ld de,.expected
.next:
    ld a,(de)
    or a
    jr z,.atEnd
    ld c,(hl)
    cp c
    jr nz,.check
    inc hl
    inc de
    jr .next
.atEnd:
    IF term0
    ld c,(hl)
    ELSE
    ld c,a
    ENDIF
.check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
    jr .done
.expected:
    db string
    db 0
.done:
    ENDM

; Like TEST_STRING, with the expected string given as the address of a 0-terminated string
    MACRO TEST_STRING_PTR addr, string_addr, term0
    push af
    push bc
    push de
    push hl
    ld hl,addr
    ld de,string_addr
.next:
    ld a,(de)
    or a
    jr z,.atEnd
    ld c,(hl)
    cp c
    jr nz,.check
    inc hl
    inc de
    jr .next
.atEnd:
    IF term0
    ld c,(hl)
    ELSE
    ld c,a
    ENDIF
.check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
    ENDM

; count bytes at addr1 equal the bytes at addr2 (the expected ones)
    MACRO TEST_MEM_CMP addr1, addr2, count
    push af
    push bc
    push de
    push hl
    ld hl,addr1
    ld de,addr2
    ld bc,count
.next:
    ld a,b
    or c
    jr z,.same
    ld a,(de)
    cp (hl)
    jr nz,.differs
    inc hl
    inc de
    dec bc
    jr .next
.differs:
    ld c,(hl)
    jr .check
.same:
    xor a
    ld c,a
.check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
    ENDM
`;

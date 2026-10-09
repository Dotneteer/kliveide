/*
 * Klive's unit-test include for its own assembler (`.plans/Z80_UNIT_TESTS_PLAN.md` D4).
 *
 * Written from scratch for Klive from the documented meaning of DeZog's conventions: the same
 * label names and macro names, in Klive syntax. No DeZog code is copied. **Testing → Add unit-test
 * support** writes it into a project as `unit_tests.kz80.asm`, where the user can read and adapt it.
 *
 * Two rules keep it working:
 * - The runner drives the labels only (D2). A `.`-prefixed label is defined in the global scope even
 *   inside a macro, which is how `UNITTEST_INITIALIZE()` lays them down.
 * - Every assertion ends in one `ASSERTION` comment whose expression reads registers only (T9), so
 *   the same test logic also works under DeZog's expression rules, and the failure report shows the
 *   values that differ.
 */

/** The file name the include is written under */
export const KLIVE_INCLUDE_FILE = "unit_tests.kz80.asm";

/** The values `DEFAULT_REGS` loads, which `TEST_UNCHANGED_*` checks */
export const DEFAULT_REG_VALUES = { A: 0xaa, B: 0xbb, C: 0xcc, D: 0xdd, E: 0xee, H: 0x11, L: 0x22 } as const;

export const KLIVE_UNIT_TEST_INCLUDE = `; ==================================================================================================
; Klive unit-test macros (Klive assembler syntax)
;
; DeZog-compatible unit tests: a test is a subroutine whose label starts with UT_ and that ends with
; TC_END() instead of RET. Its suite is its module: Module1.UT_test2 is in the suite Module1.
;
; Set-up, once in the program:
;
;     #include "unit_tests.kz80.asm"
;     ...
;     UNITTEST_INITIALIZE()
;         ; your initialisation code, run before every test
;         ret
;
; The Klive IDE runs every test on a fresh machine: it runs the code after UNITTEST_INITIALIZE(),
; writes the test's address into the CALL at UNITTEST_CALL_ADDR, and starts UNITTEST_TEST_WRAPPER.
; A test passes when it reaches UNITTEST_TEST_READY_SUCCESS (TC_END), and fails when one of its
; assertion comments stops it. Every assertion below compares registers only, so a failure shows the values: in
; "A == B  (A=$07, B=$05)" the first register holds the actual value and the second the expected one
; (TEST_STRING and TEST_MEM_CMP: A expected, C actual).
;
; Written for Klive from the documented meaning of DeZog's conventions; adapt it freely.
; ==================================================================================================

; --------------------------------------------------------------------------------------------------
; The test frame: the wrapper, the success loop, a private stack of 50 words and the start point.
; Invoke it once; your initialisation code follows it and ends with RET.
UNITTEST_INITIALIZE: .macro()
.UNITTEST_TEST_WRAPPER:
    di
    ld sp,UNITTEST_STACK
.UNITTEST_CALL_ADDR:
    call 0                          ; the runner writes the test's address here
TestReturned:
    jr TestReturned                 ; a test that ends with RET returns here: an error, use TC_END()
.UNITTEST_TEST_READY_SUCCESS:
    jr UNITTEST_TEST_READY_SUCCESS  ; TC_END() jumps here: the test passed
.UNITTEST_STACK_BOTTOM:
    .defs 100                       ; the tests' stack, 50 words; a write to its lowest word overflows
.UNITTEST_STACK:
    .defw 0                         ; what a RET past the empty stack would read: an underflow
.UNITTEST_START:
    di
.endm

; --------------------------------------------------------------------------------------------------
; Ends a test case (instead of RET)
TC_END: .macro()
    jp UNITTEST_TEST_READY_SUCCESS
.endm

; --------------------------------------------------------------------------------------------------
; Registers

; Loads known values into A, BC, DE and HL; TEST_UNCHANGED_* checks they are still there
DEFAULT_REGS: .macro()
    ld a,$AA
    ld bc,$BBCC
    ld de,$DDEE
    ld hl,$1122
.endm

; Fills every register - the alternate set, IX and IY too - with values, so a routine that relies on
; a register it did not set shows up
USE_ALL_REGS: .macro()
    exx
    ex af,af'
    ld a,$A1
    ld bc,$B1C1
    ld de,$D1E1
    ld hl,$4151
    ex af,af'
    exx
    ld a,$A2
    ld bc,$B2C2
    ld de,$D2E2
    ld hl,$4252
    ld ix,$1A2A
    ld iy,$1B2B
.endm

TEST_UNCHANGED_A: .macro()
    nop ; ASSERTION A == 0xAA
.endm
TEST_UNCHANGED_B: .macro()
    nop ; ASSERTION B == 0xBB
.endm
TEST_UNCHANGED_C: .macro()
    nop ; ASSERTION C == 0xCC
.endm
TEST_UNCHANGED_D: .macro()
    nop ; ASSERTION D == 0xDD
.endm
TEST_UNCHANGED_E: .macro()
    nop ; ASSERTION E == 0xEE
.endm
TEST_UNCHANGED_H: .macro()
    nop ; ASSERTION H == 0x11
.endm
TEST_UNCHANGED_L: .macro()
    nop ; ASSERTION L == 0x22
.endm
TEST_UNCHANGED_BC: .macro()
    nop ; ASSERTION BC == 0xBBCC
.endm
TEST_UNCHANGED_DE: .macro()
    nop ; ASSERTION DE == 0xDDEE
.endm
TEST_UNCHANGED_HL: .macro()
    nop ; ASSERTION HL == 0x1122
.endm
TEST_UNCHANGED_BC_DE: .macro()
    nop ; ASSERTION BC == 0xBBCC && DE == 0xDDEE
.endm
TEST_UNCHANGED_BC_DE_HL: .macro()
    nop ; ASSERTION BC == 0xBBCC && DE == 0xDDEE && HL == 0x1122
.endm

; A holds value
TEST_A: .macro(value)
    push bc
    ld b,{{value}}
    nop ; ASSERTION A == B
    pop bc
.endm

; A does not hold value
TEST_A_UNEQUAL: .macro(value)
    push bc
    ld b,{{value}}
    nop ; ASSERTION A != B
    pop bc
.endm

; An 8-bit register other than A holds value: TEST_REG(b, 5)
TEST_REG: .macro(reg, value)
    push af
    ld a,{{value}}
    nop ; ASSERTION {{reg}} == A
    pop af
.endm

; A register pair other than IX holds value: TEST_DREG(hl, $4000)
TEST_DREG: .macro(dreg, value)
    push ix
    ld ix,{{value}}
    nop ; ASSERTION {{dreg}} == IX
    pop ix
.endm

; --------------------------------------------------------------------------------------------------
; Flags

; The Z flag is set
TEST_FLAG_Z: .macro()
    nop ; ASSERTION (F & 0x40) != 0
.endm

; The Z flag is clear
TEST_FLAG_NZ: .macro()
    nop ; ASSERTION (F & 0x40) == 0
.endm

; Always fails
TEST_FAIL: .macro()
    nop ; ASSERTION
.endm

; --------------------------------------------------------------------------------------------------
; Memory

; The byte at addr is value: TEST_MEMORY_BYTE(Result, 5)
TEST_MEMORY_BYTE: .macro(addr, value)
    push af
    push bc
    ld a,({{addr}})
    ld b,{{value}}
    nop ; ASSERTION A == B
    pop bc
    pop af
.endm

; The word at addr is value: TEST_MEMORY_WORD(Result, $1234)
TEST_MEMORY_WORD: .macro(addr, value)
    push de
    push hl
    ld hl,({{addr}})
    ld de,{{value}}
    nop ; ASSERTION HL == DE
    pop hl
    pop de
.endm

; The bytes at addr are the string; with term0 non-zero a 0 must follow them: TEST_STRING(Buffer, "HELLO", 1)
; On a failure A is the expected character, C the actual one and HL its address.
TEST_STRING: .macro(addr, string, term0)
    push af
    push bc
    push de
    push hl
    ld hl,{{addr}}
    ld de,Expected
Next:
    ld a,(de)
    or a
    jr z,AtEnd
    ld c,(hl)
    cp c
    jr nz,Check
    inc hl
    inc de
    jr Next
AtEnd:
  .if {{term0}}
    ld c,(hl)
  .else
    ld c,a
  .endif
Check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
    jr Done
Expected:
    .defm "{{string}}"
    .defb 0
Done:
.endm

; Like TEST_STRING, with the expected string given as the address of a 0-terminated string
TEST_STRING_PTR: .macro(addr, string_addr, term0)
    push af
    push bc
    push de
    push hl
    ld hl,{{addr}}
    ld de,{{string_addr}}
Next:
    ld a,(de)
    or a
    jr z,AtEnd
    ld c,(hl)
    cp c
    jr nz,Check
    inc hl
    inc de
    jr Next
AtEnd:
  .if {{term0}}
    ld c,(hl)
  .else
    ld c,a
  .endif
Check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
.endm

; count bytes at addr1 equal the bytes at addr2 (the expected ones): TEST_MEM_CMP(Buffer, Expected, 8)
; On a failure A is the expected byte, C the actual one and HL its address.
TEST_MEM_CMP: .macro(addr1, addr2, count)
    push af
    push bc
    push de
    push hl
    ld hl,{{addr1}}
    ld de,{{addr2}}
    ld bc,{{count}}
Next:
    ld a,b
    or c
    jr z,Same
    ld a,(de)
    cp (hl)
    jr nz,Differs
    inc hl
    inc de
    dec bc
    jr Next
Differs:
    ld c,(hl)
    jr Check
Same:
    xor a
    ld c,a
Check:
    nop ; ASSERTION A == C
    pop hl
    pop de
    pop bc
    pop af
.endm
`;

; ==============================================================================
; ZX Spectrum Next book examples
; ==============================================================================

; Use ZX Spectrum Next with .NEX compilation
.model next
.savenex file "nbook.nex"
.savenex core "3.1.0"
.savenex stackaddr STACK_TOP

; Unbanked code in bank 2 at $8000
    jp Main

; Use the utility methods
#include "_helpers/sysvars.asm"
#include "_helpers/display.asm"
#include "_helpers/timing.asm"
#include "_helpers/io.asm"

; Include the examples
#include "00_intro/print.asm"
#include "01_z80n/extinstr.asm"
#include "02_talktohw/nr.asm"
#include "02_talktohw/io.asm"
#include "03_memory/mmu.asm"
#include "05_ctc/ctc.asm"
#include "06_zxndma/memcpy.asm"

; We keep 256 bytes for the stack
STACK
    .defs $100
STACK_TOP

; The start of the example
Main
    Display.ClearScreen()
;
; Here are the examples. Uncomment the one you want to run
    // --- 00: Flying Start Demos
    call PrintDemo.Welcome
    // call PrintDemo.Values

    // --- 01: Z80N Demos
    // call SwapnibDemo
    // call MirrorDemo
    // call TestDemo
    // call BslaDemo
    // call BsraDemo
    // call BsrlDemo
    // call BsrfDemo
    // call BrlcDemo
    // call LdixDemo
    // call LddxDemo
    // call LdirxDemo
    // call LddrxDemo
    // call LdwsDemo
    // call LdpirxDemo
    // call PixeladDemo
    // call PixeldnDemo
    // call SetaeDemo
    
    // --- 02: Talk to HW Demos
    // call ReadIoDemo
    // call WriteIoDemo
    // call WiteNextRegDemo

    // --- 03: Memory
    // call MmuRoundTripDemo
    // call ShadowScreenDemo

    // --- 05: CTC Demos
    // call Measure1Demo
    // call Measure2Demo
    // call Measure3Demo

    // --- 06: ZXNDMA Demos
    // call DmaSimpleMemCopyDemo

; When the example ends, we keep in infinite loop.
; You can reset or restart the machine.
trap
    ei
    Display.WaitForExit()
    jp $


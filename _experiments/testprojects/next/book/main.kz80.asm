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
#include "03_memory/legacy.asm"
#include "04_interrupts/int.asm"
#include "05_ctc/ctc.asm"
#include "06_zxndma/memcpy.asm"

; We keep 64 bytes for the stack
STACK
    .defs $40
STACK_TOP

; The start of the example
Main
    Display.ClearScreen()
;
; Here are the examples. Uncomment the one you want to run
    // --- 00: Flying Start Demos
    // call PrintDemo.Welcome
    // call PrintDemo.Values

    // --- 01: Z80N Demos
    // call Z80NDemo.DoSwapnib
    // call Z80NDemo.DoMirror
    // call Z80NDemo.DoTest
    // call Z80NDemo.DoBsla
    // call Z80NDemo.DoBsra
    // call Z80NDemo.DoBsrf
    // call Z80NDemo.DoBsrl
    // call Z80NDemo.DoBrlc
    // call Z80NDemo.DoLdix
    // call Z80NDemo.DoLddx
    // call Z80NDemo.DoLdirx
    // call Z80NDemo.DoLddrx
    // call Z80NDemo.DoLdws
    // call Z80NDemo.DoLdpirx
    // call Z80NDemo.DoPixelad
    // call Z80NDemo.DoPixeldn
    // call Z80NDemo.DoSetae
    
    // --- 02: Talk to HW Demos
    // call IoDemo.Read
    // call IoDemo.Write
    // call NextRegDemo.Write

    // --- 03: Memory
    // call MmuDemo.MmuRoundTrip
    // call LegacyMemDemo.ShadowScreen
    // call LegacyMemDemo.AllRam
    // call LegacyMemDemo.DffdBanks

    // --- 04: Interrupts
    // call InterruptsDemo.FrameCounter
    call InterruptsDemo.TwoSources

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


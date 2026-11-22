; Unraveling the ZX Spectrum Next, Volume 1: the demo program.
;
; One .nex file with a menu. The first screen lists the parts of the book; each part's screen
; lists its demos, one or more per chapter. When a demo ends, the shell puts the machine back
; in a known state and shows the part's screen again. See examples/README.md for the rules
; every demo follows.

    .model next
    .savenex file "book-demos.nex"

; Memory used by the shell, all inside bank 2 ($8000-$BFFF):
;   $8000-$BCFF  code and data (the assembler warns past $BFFF; keep below StackTop)
;   $BD00-$BDFF  the stack, growing down from StackTop
;   $BE00-$BF00  the IM2 vector table: 257 bytes of $BF
;   $BFBF        a jump to the frame interrupt handler
StackTop:   .equ $BE00
VectorPage: .equ $BE
IsrAddr:    .equ $BFBF

; Banks the demos load from the NEX file. One table, so that two demos never share a bank.
;   Bank 20      Bank Window: text at the start of pages 40 and 41
;   Bank 21      Bank Window: text at the start of page 42
;   Bank 25      Copper Sky: its Copper list, at the start of page 50
;   Bank 26      Pi Audio: the demo's code, at the start of page 52 (CallBank pages it in at $C000)
;   Bank 27      Jack Wrap: the demo's code, at the start of page 54

Start:
    di
    ld sp,StackTop
PartsLoop:
    call ResetMachine       ; also leaves interrupts on
    call ClearScreen
    call DrawParts
    call ChoosePart
DemosLoop:
    call ResetMachine
    call ClearScreen
    call DrawDemos
    call ChooseDemo         ; HL: the demo's entry point; carry: back to the parts
    jr c,PartsLoop
    push hl
    call ClearScreen
    pop hl
    call CallHl             ; run the demo; it returns when the user is done
    jr DemosLoop

CallHl:
    jp (hl)

; The parts of the book: the title, then the part's demo table. The menu gives them keys 1-9.
PartTable:
    .defw Part1Title, Part1Demos
    .defw Part2Title, Part2Demos
    .defw Part3Title, Part3Demos
    .defw Part4Title, Part4Demos
    .defw 0

Part1Title: .defn "I. The Machine"
Part2Title: .defn "II. The Picture"
Part3Title: .defn "III. The Sound"
Part4Title: .defn "IV. Talking to the World"

; Each part's demos in book order: the title, the entry point, and Ready or Planned (a planned
; demo is listed in blue). The menu gives them the keys 1-9, then A-Z.
Part1Demos:
    .defw CoreVersionTitle, CoreVersion
    .defb Ready
    .defw FourSpeedsTitle, FourSpeeds
    .defb Ready
    .defw PatternFillTitle, PatternFill
    .defb Ready
    .defw BankWindowTitle, BankWindow
    .defb Ready
    .defw FourteenVoicesTitle, FourteenVoices
    .defb Ready
    .defw DmaVersusLdirTitle, DmaVersusLdir
    .defb Ready
    .defw StopwatchTitle, Stopwatch
    .defb Ready
    .defw InputMonitorTitle, InputMonitor
    .defb Ready
    .defw 0

Part2Demos:
    .defw BeamClockTitle, BeamClock
    .defb Ready
    .defw PaletteCycleTitle, PaletteCycle
    .defb Ready
    .defw UlaModesTitle, UlaModes
    .defb Ready
    .defw BigPixelsTitle, BigPixels
    .defb Ready
    .defw Layer2ResolutionsTitle, Layer2Resolutions
    .defb Ready
    .defw TileScrollerTitle, TileScroller
    .defb Ready
    .defw SpriteSwarmTitle, SpriteSwarm
    .defb Ready
    .defw LayerOrderTitle, LayerOrder
    .defb Ready
    .defw CopperSkyTitle, CopperSky
    .defb Ready
    .defw 0

Part3Demos:
    .defw TwoVoicesTitle, TwoVoices
    .defb Ready
    .defw EnvelopeShapesTitle, EnvelopeShapes
    .defb Ready
    .defw NineChannelsTitle, NineChannels
    .defb Ready
    .defw DrumHitTitle, DrumHit
    .defb Ready
    .defw PiAudioTitle, PiAudio
    .defb Ready
    .defw JackWrapTitle, JackWrap
    .defb Ready
    .defw 0

Part4Demos:
    .defw SdSectorTitle, SdSector
    .defb Ready
    .defw SerialEchoTitle, SerialEcho
    .defb Ready
    .defw AtProbeTitle, AtProbe
    .defb Ready
    .defw ClockTitle, Clock
    .defb Ready
    .defw 0

#include "shell/reset.kz80.asm"
#include "shell/menu.kz80.asm"
#include "lib/nextreg.kz80.asm"
#include "lib/screen.kz80.asm"
#include "lib/keys.kz80.asm"
#include "lib/sound.kz80.asm"
#include "lib/bank.kz80.asm"
#include "lib/sd.kz80.asm"

; Part I: The Machine
#include "demos/1-machine/core-version.kz80.asm"
#include "demos/1-machine/four-speeds.kz80.asm"
#include "demos/1-machine/pattern-fill.kz80.asm"
#include "demos/1-machine/bank-window.kz80.asm"
#include "demos/1-machine/fourteen-voices.kz80.asm"
#include "demos/1-machine/dma-versus-ldir.kz80.asm"
#include "demos/1-machine/stopwatch.kz80.asm"
#include "demos/1-machine/input-monitor.kz80.asm"

; Part II: The Picture
#include "demos/2-picture/beam-clock.kz80.asm"
#include "demos/2-picture/palette-cycle.kz80.asm"
#include "demos/2-picture/ula-modes.kz80.asm"
#include "demos/2-picture/big-pixels.kz80.asm"
#include "demos/2-picture/layer-2-resolutions.kz80.asm"
#include "demos/2-picture/tile-scroller.kz80.asm"
#include "demos/2-picture/sprite-swarm.kz80.asm"
#include "demos/2-picture/layer-order.kz80.asm"
#include "demos/2-picture/copper-sky.kz80.asm"

; Part III: The Sound
#include "demos/3-sound/two-voices.kz80.asm"
#include "demos/3-sound/envelope-shapes.kz80.asm"
#include "demos/3-sound/nine-channels.kz80.asm"
#include "demos/3-sound/drum-hit.kz80.asm"
#include "demos/3-sound/pi-audio.kz80.asm"
#include "demos/3-sound/jack-wrap.kz80.asm"

; Part IV: Talking to the World
#include "demos/4-world/sd-sector.kz80.asm"
#include "demos/4-world/serial-echo.kz80.asm"
#include "demos/4-world/at-probe.kz80.asm"
#include "demos/4-world/clock.kz80.asm"

; The end of the shell and the demos: the assembler stops if they reach the stack
CodeEnd:
    .if CodeEnd > StackTop - $100
        .error "Code and data reach the stack at $BD00: move data to a bank or to $C000"
    .endif

; The IM2 jump must sit at the address every vector in the table points to
    .org IsrAddr
    jp FrameIsr

; Banked data comes last: after a .bank pragma, everything belongs to that bank
#include "demos/1-machine/bank-window-data.kz80.asm"
#include "demos/3-sound/pi-audio-code.kz80.asm"
#include "demos/3-sound/jack-wrap-code.kz80.asm"
#include "demos/2-picture/copper-sky-data.kz80.asm"

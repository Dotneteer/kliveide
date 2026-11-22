; Data for Copper Sky (copper-sky.kz80.asm): its Copper list, 629 instructions, 1,258 bytes.
; Banked data: main.kz80.asm includes this file after all unbanked code. The list sits at the
; start of bank 25, page 50; the demo pages it into slot 6, at $C000, to copy it to the Copper.

    .bank 25                ; pages 50 and 51

; One line of the sky: wait for dot 408 of the Copper's line before it, which is dot -48 of this
; line, the left edge of its border (the Copper's line number moves on at dot -12, so the border's
; first 36 dots still count as the line before), then give entry 16 the line's colour, in RRRGGGBB.
; The colour depends on skyY, the line's place from the top of the frame (0 for line 247): dark navy
; at the top, then purple, pink, orange and a pale yellow at the bottom.
CsSkyLine: .macro(line, before)
    skyY = ({{line}} + 64) % 311
    skyR = int(skyY * 9 / 311) <? 7
    skyG = skyY < 160 ? 0 : int((skyY - 160) * 8 / 151) <? 7
    skyB = skyY < 110 ? 1 + int(skyY / 55) : (skyY < 200 ? 3 - int((skyY - 110) / 45) : (skyY < 260 ? 0 : int((skyY - 260) / 25)))
    .copper wait {{before}}, 51
    .copper move $41, (skyR << 5) | (skyG << 2) | skyB
.endm

; The list, run in mode 11. Line 0 is the first line of the display area, and the lines come
; in the order 0-310: the display area, the bottom border, then the top of the next frame.
CsList:
    .copper move $43, $80   ; ULA palette 1, index kept
    .copper move $40, 16    ; entry 16: PAPER 0 and border 0
    .for cl = 1 .to 151
    CsSkyLine(cl, cl - 1)
    .next
    .copper wait 151, 33    ; line 151, dot 264: right border
    .copper move $26, 0     ; no scroll: the bar, lines 152-191
    .for cl = 152 .to 191
    CsSkyLine(cl, cl - 1)
    .next
    .copper wait 191, 33    ; line 191, dot 264: after the bar
CsScrollMove:
    .copper move $26, 0     ; playfield scroll: the CPU's byte
    .for cl = 192 .to 310
    CsSkyLine(cl, cl - 1)
    .next
    CsSkyLine(0, 310)       ; line 0 of the next frame, from the end of this one
    .copper halt            ; WAIT 511, 63: stop until the next frame
CsListEnd:

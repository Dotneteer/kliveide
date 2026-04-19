CTC_CH0     .equ $183b
CTC_CH1     .equ $193b
CTC_CH2     .equ $1a3b
CTC_CH3     .equ $1b3b

; The couter value when  measuring starts
Counter_Start
    .defw 0

; ------------------------------------------------------------------------------
; Sets up the CTC (CH0 and CH1) for 16-bit counting. The counter starts the 
; countdown immediately
; OUT:
;   ....DEHL/IX same
;   AFBC..../.. different
; ------------------------------------------------------------------------------
SetupCtc16
; === Set up Channel 0: timer, prescaler ÷16, time constant = 256 ===
; ZC/TO fires every 256 × 16 / 28 MHz ≈ 146.3 μs
    ld bc, CTC_CH0
    ld a, %00000101          ; Timer mode, prescaler ÷16, time const follows
    out (c), a
    ld a, 0                  ; Time constant = 256
    out (c), a
 
; === Set up Channel 1: counter mode, triggered by Ch0's ZC/TO ===
; Each Ch0 ZC/TO decrements Ch1 by 1
    ld bc, CTC_CH1
    ld a, %01000101          ; Counter mode (D6=1), time const follows
    out (c), a
    ld a, 0                  ; Time constant = 256
    out (c), a
    ret 

; ------------------------------------------------------------------------------
; Saves the current counter value (start counter)
; OUT:
;   ......HL/IX same
;   AFBCDE../.. different
; ------------------------------------------------------------------------------
StartMeasure
    ld bc, CTC_CH1
    in a, (c)
    ld d, a                  ; D = coarse count (Ch1)
    ld bc, CTC_CH0
    in a, (c)
    ld e, a                  ; E = fine count (Ch0)
    ld (Counter_Start), de   ; Save 16-bit start value

; ------------------------------------------------------------------------------
; Gets the measure value since the last start
; OUT:
;   A......./IX same
;   .FBCDEHL/.. different
; ------------------------------------------------------------------------------
GetMeasuredCounter
    ld bc, CTC_CH1
    in d, (c)
    ld bc, CTC_CH0
    in e, (c)
 
; Elapsed = start − end (both channels count down)
    ld hl, (Counter_Start)   ; H = start coarse, L = start fine
    ld (Counter_Start),de    ; Next time use this start value
    or a                     ; clear carry flag
    sbc hl, de               ; HL = start − end (elapsed ticks, since counters count down)
    ex de, hl                ; DE = elapsed ticks
    ret

; ------------------------------------------------------------------------------
; Decrements BC in a loop until it reaches 0
; IN:
;   BC=Start counter value
; OUT:
;   ....DEHL/IX same
;   AFBC..../.. different
; ------------------------------------------------------------------------------
_delayWithBc
    dec bc
    ld a,b
    or c
    ret z
    jr _delayWithBc
    


; Copyright 2021 Mark Woodmass

; This program is licensed under the GNU General Public License. See the
; file `COPYING' for details


; ix = code address to execute at specified cycle using 48K timings
; hl = cycle to execute code at
; de = post-test interrupt exit address (or the target code can JP directly to exit)

                        IF NOT DEFINED EXEC_CYCLE_
                        EXEC_CYCLE_ equ 1

FRAME_DELAY_48K         equ   9888-1-29-28
FRAME_DELAY_128K        equ   10908-1-29-28

exec_cycle_48k          ld    bc,FRAME_DELAY_48K
                        jr    exec_cycle

exec_cycle_128k         ld    bc,FRAME_DELAY_128K
                        jr    exec_cycle


exec_cycle              proc
                        di
                        ld    (oldexecstack),sp
                        ld    sp,#f100

                        ld    (_frame_sync_delay+1),bc      ; set frame sync delay for machine type
                        ld    (_int_exit_addr+1),de         ; set post-test interrupt exit address

                        ld    de,67
                        or    a
                        sbc   hl,de
                        ld    (_delay_period+1),hl

                        ld    hl,#f100
                        ld    de,#f101
                        ld    bc,256
                        ld    (hl),#f2
                        ldir

                        ld    a,195
                        ld    hl,_syncint1
                        ld    (#f2f2),a
                        ld    (#f2f3),hl

                        ld    a,#f1
                        ld    i,a
                        im    2

                        ei
                        halt

                        ; ==========================
                        ; frame sync loop
      _syncint1         ei
                        ld    hl,60000
                        call  delay

      _frame_sync_delay ld    hl,FRAME_DELAY_48K
                        call  delay
                        nop
                        ; ==========================

                        ; we have synchronised to framestart here
                        di

      _int_exit_addr    ld    hl,default_exit_int
                        ld    (#f2f3),hl

                        ; reach here at 29t
      _delay_period     ld    hl,0
                        call  delay

                        ld    a,#7d
                        ld    r,a               ; makes R=0 when hitting the target address

                        ei
                        jp    (ix)              ; jump to target address

                        endp

                        ; default exit interrupt
                        ; a direct JP here can be used to exit early
default_exit_int        proc
                        ld    sp,(oldexecstack)
                        push  af
                        call  restore_BASIC
                        pop   af
                        ret
                        endp

restore_BASIC           proc
                        di
                        ld    a,63
                        ld    i,a
                        im    1
                        ei
                        ret
                        endp

oldexecstack            dw    0

                        ENDIF

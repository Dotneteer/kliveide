
; Copyright 2025 Mark Woodmass

; This program is licensed under the GNU General Public License. See the
; file `COPYING' for details

; Test timings only target ZX Spectrum 48K machines.

                        org   50000

start                   proc
                        xor   a
                        call  8859
                        ld    a,64+7
                        ld    (23693),a
                        call  3435
                        ld    a,2
                        call  #1601

                        ld    (oldStack),sp

                        call  prepare_display

                        ld    hl,14335-40             ; cycle to hit target address at
                        ld    ix,hold_snow            ; ix = target address
                        ld    de,default_exit_int     ; post-test exit interrupt address
                        call  exec_cycle_48k          ; run the test
                        endp

M1_14                   macro
                        ld    a,0
                        ld    a,0
                        endm

hold_snow               proc

                        di
                        ld    a,#40
                        ld    i,a

            _mainloop   ld    b,192 ; 14315

                        xor   a
                        ld    r,a

                        ; 14335: 65432100
                        ; 14343: 65432100
                        ; 14351: 65432100
                        ; 14359: 65432100
                        ; 14367: 65432100
                        ; 14375: 65432100
                        ; 14383: 65432100
                        ; 14391: 65432100
                        ; .....
                        ; 14455: 65432100

            _scanloop   M1_14 ; 14335 / 14559 / 14783 / 15007
                        M1_14 ; 14349
                        M1_14 ; 14363
                        M1_14 ; 14377
                        M1_14 ; 14391
                        M1_14 ; 14405
                        M1_14 ; 14419
                        M1_14 ; 14433

                        ; waste 99 cycles
                        ld    ix,0  ; 14447
                        ld    ix,0
                        ld    ix,0
                        ld    ix,0
                        ld    ix,0
                        ld    a,0
                        ld    a,r ;r,a
                        ld    a,r
                        inc   a

                        djnz  _scanloop

                        ld    a,#7f
                        in    a,(254)
                        rra
                        jr    nc,_exit

                        ; delay for next frame
                        ld    hl,12481+14335    ; 57367
                        call  delay

                        jp    _mainloop         ; 14305

      _exit             ld    a,#3f
                        ld    i,a
                        im    1
                        ld    sp,(oldStack)
                        ei
                        ret
                        endp

prepare_display         proc

                        ld    hl,16384
                        ld    b,12
                        ld    c,0
            _scrloop1   push  bc
                        push  hl
                        call  _draw
                        pop   hl

                        ld    c,2
                  _sk1  ld    a,l
                        add   a,32
                        ld    l,a
                        jr    nc,_sk2
                        ld    a,h
                        add   a,8
                        ld    h,a

                  _sk2  dec   c
                        jr    nz,_sk1

                        pop   bc
                        inc   c
                        res   2,c
                        djnz  _scrloop1

                        ret

            _draw       push  bc

                        ld    b,8
                        push  hl

            _loop1      push  hl

                        ld    a,1
                        ld    c,32
            _loop2      ld    (hl),a
                        inc   l
                        rlca
                        dec   c
                        jr    nz,_loop2

                        pop   hl
                        inc   h
                        djnz  _loop1

                        pop   hl
                        pop   bc

                        ld    a,h
                        rrca
                        rrca
                        rrca
                        and   3
                        or    #58
                        ld    h,a

                        ld    b,32

            _attrs1     ld    a,c
                        add   a,2
                        rlca
                        rlca
                        rlca
                        or    64+7
                        ld    (hl),a
                        inc   l

                        inc   c
                        res   2,c
                        djnz  _attrs1

                        ret
                        endp

oldStack                dw    0

                        include     execcycle.asm
                        include     delay.asm

                        end   start


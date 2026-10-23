
; Copyright 2021 Mark Woodmass

; This program is licensed under the GNU General Public License. See the
; file `COPYING' for details

; Only compatible on ZX Spectrum 48K

                        org   50000

start                   proc
                        call  3435
                        ld    a,2
                        call  #1601

                        call  test_float_timing

                        call  print_text_pc
                        db    "ADDR  CYCLE R",6,"ADDR  CYCLE R",13,255

                        ld    hl,results_obtained
                        ld    (results_obtained_ptr),hl

                        ld    hl,12000          ; top border area
                        call  do_test_set

                        ld    hl,14335          ; first contended cycle on early machine
                        call  do_test_set

                        ld    hl,14336          ; first contended cycle on late machine
                        call  do_test_set

                        ld    hl,14335+224+3    ; first contended sequence on scan 2; 3T on early, 4T on late
                        call  do_test_set

                        ld    hl,57239          ; 6T on last contended sequence on scan 191; 0T on late as last contended sequence starts at 57240 
                        call  do_test_set

                        call  display_machine_timings
                        ret
                        endp

test_float_timing       proc

      _float_byte       equ   #aa

                        call  print_text_pc
                        db    22,0,0,16,1,"Float: ",16,2,255

                        ld    a,_float_byte
                        ld    (22528),a

                        ld    hl,14339-10-7           ; cycle to hit target address at
                        call  _do_float_test
                        ld    de,early.txt
                        cp    _float_byte
                        jr    z,_print_result

                        ld    hl,14340-10-7           ; cycle to hit target address at
                        call  _do_float_test
                        ld    de,late.txt
                        cp    _float_byte
                        jr    z,_print_result

                        ld    de,unknown.txt

      _print_result     call  print_text

                        call  print_text_pc
                        db    16,0,13,255

      _exit             ld    a,56
                        ld    (22528),a
                        ret

      _do_float_test    ld    ix,_read_float_bus      ; ix = target address
                        ld    de,default_exit_int     ; post-test exit interrupt address
                        call  exec_cycle_48k          ; run the test
                        ret

      _read_float_bus   ld    a,#ff
                        in    a,(#ff)
                        jp    default_exit_int
                        endp

; cycle count for this set of HALT addresses
do_test_set             proc
                        ld    (target_cycle),hl       ; store cycle count for this set of HALT addresses

                        ld    hl,16384
                        call  do_test

                        ld    hl,32767
                        call  do_test

                        ld    hl,32768
                        call  do_test

                        ld    hl,49151
                        call  do_test

                        ld    hl,49152
                        call  do_test

                        ld    hl,65535
                        call  do_test

                        ld    a,13
                        rst   16
                        ld    a,13
                        rst   16
                        ret
                        endp

; hl = target address
do_test                 proc

                        push  hl
                        pop   ix                      ; ix = target address
                        ld    (hl),#76                ; place a HALT opcode at target address

                        ld    de,num_txt
                        call  word_to_string
                        call  print_dec_16
                        ld    a,"/"
                        rst   16
                        ld    hl,(target_cycle)
                        ld    de,num_txt
                        call  word_to_string
                        call  print_dec_16
                        ld    a,":"
                        rst   16

                        ld    hl,(target_cycle)       ; cycle to hit target address at
                        ld    de,_read_R_exit_int     ; post-test exit interrupt address
                        call  exec_cycle_48k          ; run the test

                        ld    hl,(results_obtained_ptr)
                        ld    (hl),a
                        inc   hl
                        ld    (results_obtained_ptr),hl

                        ld    hl,0
                        ld    (16384),hl

                        call  print_hex_8

                        ld    a,6
                        rst   16
                        ret

      _read_R_exit_int  ld    a,r
                        jp    default_exit_int

                        endp


display_machine_timings proc

                        call  print_text_pc
                        db    22,0,16,16,1,"HALT: ",16,2,255

                        ld    de,results_early
                        call  comp_30_result_bytes
                        jr    z,_machine_early

                        ld    de,results_late
                        call  comp_30_result_bytes
                        jr    z,_machine_late

                        call  print_text_pc
                        db    "Unknown",16,0,13,255
                        ret

      _machine_early    call  print_text_pc
                        db    "Early",16,0,13,255
                        ret

      _machine_late     call  print_text_pc
                        db    "Late",16,0,13,255
                        ret
                        endp

comp_30_result_bytes    proc
                        ld    hl,results_obtained
                        ld    b,30
      _comp_loop        ld    a,(de)
                        cp    (hl)
                        ret   nz
                        inc   de
                        inc   hl
                        djnz  _comp_loop
                        ret
                        endp

print_dec_16            proc
                        call  print_text_pc
num_txt                 ds    5
                        db    255
                        ret
                        endp

                        include     execcycle.asm
                        include     delay.asm
                        include     print.asm

target_cycle            dw    0

early.txt               db    "Early",255
late.txt                db    "Late",255
unknown.txt             db    "Unknown",255

results_early           db    #0c, #0c, #0c, #0c, #0c, #0c
                        db    #44, #43, #45, #45, #45, #45
                        db    #44, #43, #44, #44, #44, #44
                        db    #1c, #0b, #0c, #0c, #0c, #0c
                        db    #5d, #5d, #5f, #5f, #5f, #5f

results_late            db    #0c, #0c, #0c, #0c, #0c, #0c
                        db    #45, #45, #45, #45, #45, #45
                        db    #44, #43, #44, #44, #44, #44
                        db    #1c, #0b, #0c, #0c, #0c, #0c
                        db    #5e, #5f, #5f, #5f, #5f, #5f

results_obtained_ptr    dw    0
results_obtained        ds    30

                        end   start



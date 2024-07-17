Rom0Start
            di
            jp InitSys
            db $45, $44, $08, $02
Rst08
            jp L15E0
            db $2a, $2e, $2a, $ff, $00
;
; Invoke RST $10 in ROM 3
;
Rst10
            rst $28
            dw $0010
            ret
            jp InitSys
            nop
;
; Invokes a ROM 1 subroutine.
; The subroutine address is specified in the two bytes following the RST $18 call instruction.
;
Rst18
            jp L3E80
            db $3c, $44, $49, $52, $BE
;
; Invokes a ROM 2 subroutine.
; The subroutine address is specified in the two bytes following the RST $20 call instruction.
;
Rst20
            jp InvRom2
            db  $14, $00, $04, $98, $00
;
; Invokes a ROM 3 subroutine.            
; The subroutine address is specified in the two bytes following the RST $28 call instruction.
;
Rst28 
            ld (OLDBC),bc          ; Save BC temporarily
            ex (sp),hl
            jp InvRom3
Rst30
            jp L15C9
            call L04D7
            ld (hl),a
            ret
Rst38
            push af
            push hl
            ld h,$00
            ld a,$80
            jp L0046
            inc a
            ld d,d
            ld d,l
            ld c,(hl)
            cp (hl)
L0046       out ($E3),a
            dec b
            ld a,(de)
            rla
            rst $38
            rlca
            add a,a
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            pop hl
            pop af
            ei
            ret
            nop
            nop
            retn
L0068       ld (OLDBC),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex (sp),hl
L0072       push $007B
            push bc
            ld bc,(OLDBC)
            nextreg $8C,$80
            ret
InvRom3     
            ld c,(hl)              ; Read the next byte following the return address (LSB)
            inc hl                 ; Move to the next byte
            ld b,(hl)              ; Read the next byte following the return address (MSB)
            inc hl                 ; Move to the next byte
            ex (sp),hl             ; Save the return address
L0085       push $5B4D             ; Return to $5B4D (BackRom0) after completing the ROM 3 routine
            push bc
            ld bc,(OLDBC)
            jp L5B48
;
; Here follows the five paging subroutines which are copied into
; the system variables area (starting at $5B00)
;
; Call Swap ($5b00) to change ROM 0<->3 or ROM 1<->2
;
Swap
            push af                ; Save AF & BC
            push bc
            ld bc,$7FFD  
            ld a,(BANKM)           ; Get copy of last OUT to $7ffd
            xor $10                ; Toggle bit 4 (change ROM 0<->1 or ROM 2<->3)
            di                     ; Disable interrupts
            ld (BANKM),a           ; Store the new ROM bank value
            out (c),a              ; Page new ROM bank
;
; Enter at Stoo with interrupts disabled and AF/BC stacked
; to change ROM 0<->2 or ROM 1<->3
;
Stoo
            ld bc,$1FFD            ; Get copy of last OUT to $1ffd
            ld a,(BANK678)
            xor $04                ; Toggle bit 2 (change ROM 0<->2 or ROM 1<->3)
            ld (BANK678),a         ; Store the new ROM bank value
            out (c),a              ; Page new ROM bank
            ei                     ; Enable interrupts
            pop bc  
            pop af                 ; Restore AF & BC
            ret                    ; Done.
;
; Enter at Younger with return address in RETADDR to swap
; ROM 0<->3 or ROM 1<->2 and return there
Younger
            call L5B00             ; Call Swap (swap ROM 0<->3 or ROM 1<->2)
            push hl                ; Save HL
            ld hl,(RETADDR)        ; Get return address from system vars   
            ex (sp),hl             ; Resore HL and return address
            ret                    ; Done.
;
; Enter at Rrgnuoy with return address in RETADDR to swap
; ROM 0<->2 or ROM 1<->3 and return there
;
Regnuoy
            push hl                ; Save HL
            ld hl,$5B34            
            ex (sp),hl             ; Place $5b34 as return address
            push af                
            push bc                ; Save AF & BC
            jp L5B10               ; Call STOO (swap ROM 0<->2 or ROM 1<->3) and return here ($5b34)
l5b34
            push hl                ; Save HL
            ld hl,(RETADDR)        ; Get return address from system vars
            ex (sp),hl             ; Restore HL and return address
            ret                    ; Done.

            push $0AB0             ; Push return address (in ROM 1)
            nextreg $8E,$01        ; Select ROM 1
            ret                    ; Jump to $0AB0 in ROM 1
            nextreg $8E,$02        ; Select ROM 2
            ret                    ; 
            nextreg $8E,$03        ; Select ROM 3
            ret
;
; Return to this address ($5B4D) after completing a ROM 3 routine
;
BackRom0
            nextreg $8E,$00        ; Select ROM 0
            ret                    
;
; Copy ROM swap routines into the system variables area ($5B00)
;
CopySwap       
            ld hl,Swap             ; Start of the Swap routines
            ld de,$5B00            ; Destination address
            ld bc,$0052            ; Length of the routines
            ldir                   ; Copy the routines 
            ret                    ; Done.
;            
; =================================================================================================
; Initialize the system
;
; Set up the Next registers
;
InitSys  
            nextreg $07,$03        ; Cpu speed = 28Mhz
            nextreg $03,$B0        ; ZX +2A/+2B/+3 display timing
            nextreg $C0,$08        ; Enable stackless NMI response
            ld a,$FF               ; All bit set: enable all internal port deconding
            nextreg $82,a          ; Enable all internal port decoding (bit 0-7)
            nextreg $83,a          ; Enable all internal port decoding (bit 8-15)
            nextreg $84,a          ; Enable all internal port decoding (bit 16-23)
            nextreg $85,a          ; Enable all internal port decoding (bit 24-31)
            xor a                  ; All bit cleared: 
            nextreg $80,a          ; Disable all extension bus features
            nextreg $81,a          ; Expansion bus control register
            nextreg $8A,a          ; Extension bus I/O propagate disabled
            nextreg $8F,a          ; Memory mapping mode: Standard ZX 128K/+3
            ld bc,$243B            
            ld d,$06
            out (c),d
            inc b
            in a,(c)               ; Read NextReg $06
            and $44                ; Keep only Bit 6 (divert beep only to internal speaker) 
                                   ; and Bit 2 (PS/2 mode). Reset all other bits (Disable F8, F5/F6 
                                   ; F3 hot keys, disable DivMMC NMI bt Drive button, disable Multiface
                                   ; NMI by M1 button, use YM audio chip)
            out (c),a              ; Write back to NextReg $06
;
; Display a black screen
;
            ld hl,$5800            ; ULA Screen attributes start here
            ld de,$5801            ; Next attribute address
            ld (hl),l              ; PAPER black + INK black
            ld bc,$02FF            ; 767 attributes to set
            ldir                   ; Set all attributes
;
; Test the memory banks (16K banks)
;
            ld bc,$7000            ; B = $70 (no. of 16K banks with 2MB Next), C = 0 (bank number)
            ld hl,$4000            ; Start of the ULA screen memory
TestBank                           ; Loop to test all 16K banks
            ld a,c                 ; A = bank number (initially 0)
            exx                    ; Save to alternate registers
            add a,a                ; A = A * 2
            nextreg $56,a          ; Set Slot 6 ($c000-$dfff) to 8K Bank in A
            inc a                  ; A += 1
            nextreg $57,a          ; Set Slot 7 ($e000-$ffff) to 8K Bank in A
            srl a                  ; A = A/2
            ld hl,$FFFF            ; HL = 0xFFFF
            ex af,af'              ; A = bank number to test
            ld a,(hl)              ; Store the bank number to $FFFF
            exx                    ; Restore alternate registers
            ld (hl),a              ; Store last byte of the bant to the screen area
                                   ; (In a later stage, this byte value will be restored to the bank)
            ld a,c                 ; A = Bank number
            cp $0C                 ; Bank number < 12?
            jr nc,TestBank1        ; No, jump to TestBank1
            ld (hl),$00            ; Store 0 to $4000
TestBank1   
            inc hl                 ; Move to the next address
            exx                    ; Save alternate registers
            ex af,af'              ; A = bank number to test
            ld (hl),$BB            ; Store $BB to $FFFF
            dec hl                 ; HL points to $FFFE
            ld de,$FFFD            ; DE = $FFFD
            ld bc,$3FFE            ; BC the remaining length of a 16K page
            cp $0C                 ; Bank number < 12?
            jr nc,TestBank3        ; No, jump to TestBank3
            cp $08                 ; Bank number == 8?
            jr nz,TestBank2        ; No, jump to TestBank2   
            ld b,$1F               ; Yes, set B = $1F to zero only the last 8K of the bank
TestBank2
            ld (hl),$00            ; Store zero to $FFFE
            lddr                   ; Fill the remaining of 16K page with zeros
TestBank3
            exx                    ; Restore alternate registers
            inc c                  ; Increment the bank number
            djnz TestBank          ; Loop until all banks tested
            jr TestBits
;
; Report bit error by setting the background color
; E contains the bit number (0-7) that is faulty
; Z = 1: issue with settting the bit value to 0
; Z = 0: issue with setting the bit value to 1
;
BitError    
            ex af,af'              ; Save the Z flag
            ld a,$08               ; A = 8
            sub e                  ; A points to the faulty bit number
            ld l,a                 ; L = faulty bit number
            ex af,af'              ; Restore Z flag
            ld a,l                 ; A = faulty bit number
            jr nz,BitError2        ; Bit value 1 issue? Jump to BitError2
            out ($FE),a            ; Set the background color according to the faulty bit
BitError1                     
            jr BitError1           ; Loop forever
BitError2    
            xor $07                ;
            ld h,a                 ; H = 7 - faulty bit number
;
; Draw a border stripe to indicate the faulty bit (thin stripe, complement color)
;
BitError3    
            ld b,$20               
BitError4                          
            ld a,h
            out ($FE),a
            djnz BitError4         ; Short loop (32)
;
; Draw a border stripe to indicate the faulty bit (thick stripe, fault color)
;
BitError5   
            ld a,l
            out ($FE),a
            djnz BitError5         ; Long loop (256)
            jr BitError3           ; Loop forever
;
; At this point all banks have been tested. The loop starting here will traverse all banks
; and tests memory bits (from 0 to 7) in each bank. If a bit is stuck, the bank will be
; marked as bad.
;
TestBits       
            xor a                  ; A = 0          
            ld bc,$4000            ; BC = $4000, store bank check results here
TestBits1   ld de,$0108            ; D = $01 (Bit 0 set), E = $08 (number of bits to test)
            add a,a                ; A = A * 2
            nextreg $56,a          ; Set Slot 6 ($c000-$dfff) to 8K Bank in A
            inc a                  ; A += 1
            nextreg $57,a          ; Set Slot 7 ($e000-$ffff) to 8K Bank in A
            srl a                  ; A = A/2
            ex af,af'              ; Save the current bank number to A'
            ld hl,$FFFF            ; HL = 0xFFFF
            ld a,(hl)              ; Get the last byte of the bank
            cp $BB                 ; Is it $BB?
            jr nz,TestDone            ; The current bank seems not be falty or non-existent, jump to TestDone
            ld a,(bc)              ; Read the last byte of the bank from the screen memory area
            inc bc                 ; Move to the next byte
            ld (hl),a              ; Restore the last byte of the bank
;
; The next cycle will use the $1CBA offset within the bank ($DCBA) address to test the memory bits
;
            ld hl,$DCBA            
            ld a,(hl)
            ld xl,a                ; Save the byte at $DCBA to XL
;
; Bit test loop
;
TestBits2   ld a,d                 ; A = Bit mask for test
; 
; Check for bit value 1
;
            ld (hl),a              ; Store pattern to $DCBA
            ld a,(hl)              ; Read back the stored byte
            and d                  ; Test the byte read back
            jr z,BitError         ; Was it zero? If so, it's an error, jump to BitError
; 
; Test for bit value 0
;
            cpl                    ; Complement the bit mask
            ld (hl),a              ; Store the complemented pattern to $DCBA
            ld a,(hl)              ; Read back the stored byte
            and d                  ; Test the byte read back
            jr nz,BitError        ; Was it non-zero? If so, it's an error, jump to BitError
;
; Move to the next bit pattern
;
            rlc d                  ; D = D << 1
            dec e                  ; Decrement the bit counter
            jr nz,TestBits2        ; Loop until all bits tested

            ld a,xl                ; Restore the byte saved from $DCBA
            ld (hl),a              ; Store the byte back to $DCBA
            ex af,af'              ; Restore the current bank number
            inc a                  ; Increment the bank number
            cp $70                 ; Bank $70 (112) reached?
            jr nz,TestBits1        ; If not, loop to test the next bank
            ex af,af'              ; Save the latest bank number to A'
;
; At this point we have the highest bank number in A'
;            
TestDone   
            ex af,af'              ; Get the bank number to A
            dec a                  ; Decrement the bank number (banks are 0-based)
            ld (YLOC),a            ; Store the bank number to YLOC
            ld sp,$5BFF            ; Set the stack pointer to $5BFF
            rst $20                ; Call $1EDF in ROM 2
            dw $1edf               ; 
            nextreg $8e,$08        ; Change to ROM 0 and RAM bank 0
            im 1                   ; Set interrupt mode 1
            call CopySwap          ; Copy the ROM swap routines to the system variables area
            ld hl,$FFFF            ; HL = $FFFF, address of last byte of physical RAM
            ld (PRAMT),hl          ; Store the address to the system variables area
            ld de,$3EAF            ; DE = $3EAF, address of the last byte of the system variables area
            ld bc,$00A8
            ex de,hl
            rst $28                ; Call $1661 in ROM 3
            dw $1661               ; This routine copies the UDG character definitions to the UDG area
                                   ; (ROM 3: $3E08-$3EAF, $A8 bytes)
            ex de,hl               ; Move the last byte of the system variables area to HL
            inc hl                 ; Increment HL to compensate the LDDR copy operation's last decrement
            ld (UDG),hl            ; Store the address to the start of the UDG area
            dec hl                 ; Decrement HL to point to the last byte of the available ROM
            ld (RAMTOP),hl         ; Store this address in RAMTOP
            ld b,$00               ; B = 0
            ld iy,$5C3A            ; IY = $5C3A, start address of the system variables area
            ld a,(YLOC)            ; Restore the last bank number
            ld c,a                 ; C = bank number
            ld hl,(UDG)            ; HL = start address of the UDG area 
            exx                    ; Save alternate registers
;
; Configure DivMMC behavior
;
            nextreg $B8,$82        ; Enable DivMMC automap on $0008 and $0038
            nextreg $B9,$00        ; Enable all DivMMC entry points only when ROM 3 is present
            nextreg $BA,$00        ; All DivMMC mappins are delayed 
            nextreg $BB,$F2        ; Enable DivMMC automap on 0x3Dxx (nstruction fetch, instant, ROM3)
                                   ; Disable automap on addresses 0x1FF8-0x1FFF (instruction fetch, delayed)
                                   ; Enable automap on address 0x056A (instruction fetch, delayed, ROM3)
                                   ; Enable automap on address 0x04D7 (instruction fetch, delayed, ROM3)
                                   ; Enable automap on address 0x0066 (instruction fetch + button, instant)
            nextreg $D8,$01        ; Enable +3 FDC traps on ports 0x2ffd and 0x3ffd
            ld a,$05
            call GetNRegA          ; Get Next Register $05 (Peripheral 1 Setting) value
            and $05                ; Keep only 50/60Hz mode and the scandoubler bit 
            or $5A                 ; Set Joystick 1 & 2 mode to MD1
            out (c),a              ; Write back to Next Register $05
            ld a,$08               
            call GetNRegA          ; Get Next Register $08 (Peripheral 3 Setting) value 
            or $4E                 ; Disable RAM and port contention
                                   ; Enable 8-bit DACs, port 0xff Timex video mode read, and turbosound
            out (c),a              ; Write back to Next Register $08
            ld a,$06               
            call GetNRegA          ; Get Next Register $06 (Peripheral 2 Setting) value
            and $44                ; Keep the Divert BEEP to internal speaker and PS/2 mode bits
            or $AB                 ; Enable F8, F5/F6, F3 hot keys, Multiface NMI by M1 button
                                   ; Hold all AY in reset
            out (c),a              ; Write back to Next Register $06
            and $FC                ; Reset Bit 0 and 1 --> Audio chip mode to YM
            out (c),a              ; Write back to Next Register $06
            ld a,$0A               
            call GetNRegA          ; Get Next Register $0A (Peripheral 5 Setting) value
            or $10                 ; Enable DivMMC automap
            out (c),a              ; Write back to Next Register $0A
            call CopySwap          ; Copy the ROM swap routines to the system variables area
            ld h,d                 ; After the operation DE points to the next available byte in,
            ld l,e                 ; the system variables area ($5B52, OLDHL)
            ld (hl),c              ; Store 0 to OLDHL LSB (after CopySwap BC = 0)
            inc de                 ; DE points to HL + 1
            ld bc,$015F            ; BC = $015F (351)
            ldir                   ; Fill the system variable area ($5B52-$5CB1) with zeros
            ld hl,$5BFF            ; HL = $5BFF, this address will be used as the top of the stack
            ld (OLDSP),hl          ; Store this address to the OLDSP system variable ($5B6A)
            ld sp,hl               ; Set the stack pointer to $5BFF
            rst $18                
            dw $3471               ; Invokes the InitStack ($3471) subroutine in ROM 1
            ld a,$CF               ; "RST $08" instruction
            ld (RAMRST),a          ; RST 8 instruction. Used by ROM 1 to report old errors to ROM 3.
            ld hl,$0040            ; Length of warning buzz
            ld (RASP),hl           ; Store to RASP ($5C38)
            exx                    ; Restore alternate registers
            ld a,c                 ; A = bank number
            ld (YLOC),a            ; Store the bank number to YLOC
            ld (UDG),hl            ; Store the start address of the UDG area to UDG 
            push bc                ; Save the bank number
            call L2329
            rst $18
            cp c
            inc d
            ld hl,$3C00
            ld (CHARS),hl
            set 4,(iy+$01)
            ld a,$FF
            ld (iy),a              ; ERRNR, set to $FF (One less than the report code)
            ld (RCSTEP),a
            ld (RCSTEP+1 ),a
            ld (STRIP2+4),a            
            ld (STRIP2+5),a
            ld a,$54               ; "T"
            ld (LODDRV),a
            ld (SAVDRV),a
            ld hl,$5CB6            ; Start of CHANS area 
            ld (CHANS),hl
            ld de,$15AF            
            ld bc,$0015
            ex de,hl
            rst $28
            jp LEB33
            dec hl
            ld (DATADD),hl
            inc hl
            ld ($5C53),hl
            ld ($5C4B),hl
            ld (hl),$80
            inc hl
            ld ($5C59),hl
            ld (hl),$0D
            inc hl
            ld (hl),$80
            inc hl
            ld ($5C61),hl
            ld ($5C63),hl
            ld ($5C65),hl
            ld a,$38
            ld ($5C8D),a
            ld ($5C8F),a
            ld ($5B61),a
            ld ($5B63),a
            ld ($5C48),a
            ld a,$07
            out ($FE),a
            ld hl,$0523
            ld ($5C09),hl
            dec (iy-$3A)
            dec (iy-$36)
            ld hl,$15C6
            ld de,$5C10
            ld bc,$000E
            rst $28
            jp LFD33
            ld (hl),$31
            ld (bc),a
            ei
            rst $28
            ld l,e
            dec c
            pop af
            rst $08
            push af
            call L0360
            rst $18
            ld de,$2115
            ld e,d
            inc bc
            ld de,$D5B8
            ld bc,$0006
            ldir
            ex de,hl
            scf
            call L0F3C
            ld hl,$0020
            ld ($D73D),hl
            inc l
            inc l
            inc l
            ld ($D73F),hl
            ld a,$03
            ld ($5C81),a
            rst $20
            dw $1e43
            ld hl,$10a5
            ld de,$D633
            ld bc,$3700
            call L0FD5
            ld hl,$10C5
            ld de,$D6DA
            ld bc,$3760
L0342       call L0FD5
            call L1003
            call L0F82
            pop af
            rst $18
            jp z,LFD2B
            rlc d
            xor $FD
            ld (hl),$31
            ld (bc),a
            jp L11BE
            nop
            nop
            nop
            inc bc
            nop
            inc a
L0360       ld hl,$0DF7
            ld de,$D750
            ld bc,$0010
            ldir
            ret
L036C       add hl,$0004
            ld b,a
            ld a,(hl)
            cp $53
            jr nz,L0391
L0376       push ix
            ld a,($5C7F)
            and $0F
            add a,$F2
            ld xh,a
            ld xl,$00
            ld a,b
            call L2767
            pop ix
L038A       ld hl,$15FE
            push hl
L038E       jp L5B48
L0391       cp $4B
            jr z,L0376
            ld hl,($5C51)
            ex de,hl
            and a
            sbc hl,de
            ld c,l
            ex de,hl
            add hl,$0005
            cp $44
            jr z,L03C0
            dec c
            jr nz,L03C7
            ld e,(hl)
            inc hl
            ld h,(hl)
            ld l,e
            ld de,$15FE
            push de
            ld a,b
            push ix
            ld ix,($5C51)
            call L03BF
            pop ix
            jr L038E
L03BF       jp (hl)
L03C0       ld a,c
            dec a
            call L0481
            jr L038A
L03C7       inc hl
            inc hl
            ld e,(hl)
            inc hl
            ld h,(hl)
            ld l,e
            ld de,$15FE
            push de
            push ix
            ld ix,($5C51)
            call L03BF
            pop ix
            jr c,L038E
            jr z,L038E
L03E0       ld a,$07
            jp L27B0
L03E5       ld hl,($5C51)
            push hl
            pop ix
            ld a,(hl)
            cp $4D
            jr nz,L0408
            ld a,(ix+$01)
            cp $5B
            jr nz,L0408
            ld a,(ix+$04)
            cp $53
            jr z,L042E
            cp $4B
            jr z,L042E
            cp $44
            jr z,L045F
            jr L044A
L0408       ld a,e
            cp $04
            jp z,L0495
            add hl,de
            ld c,(hl)
            inc hl
            ld b,(hl)
            cp $02
            jr z,L041C
            exx
            ld a,c
            exx
            jp L0085
L041C       res 3,(iy+$02)
            call L0085
L0423       ret c
            jr nz,L03E0
            rst $18
            ld d,b
            dec hl
            ld de,$0002
            jr L03E5
L042E       ld a,($5C7F)
            and $0F
            add a,$F2
            ld xh,a
            ld xl,$00
            ld a,e
            cp $02
            jp z,L11E0
            cp $04
            exx
            jp z,L2B9A
            ld a,c
            jp L275B
L044A       ld a,e
            add hl,de
            ld e,$05
            add hl,de
            ld e,(hl)
            inc hl
            ld d,(hl)
            push de
            cp $02
            jr z,L045A
            exx
            ld a,c
            ret
L045A       ld hl,$0423
            ex (sp),hl
            jp (hl)
L045F       ld bc,$0005
            add hl,bc
            exx
            push bc
            exx
            pop bc
            ld a,e
            cp $04
            jr nz,L047B
            add a,b
            add a,b
            cp $06
            jr nz,L047B
            exx
            push hl
            push de
            exx
            pop ix
            pop de
            jr nz,L0495
L047B       ld b,c
            call L0481
            jr L0423
L0481       ld c,(hl)
            inc hl
            ld h,(hl)
            ex de,hl
            ld e,b
            srl a
            add a,$FB
            ld b,a
            rst $20
            dw $01cf
            ret c
            inc a
            ret z
            inc a
            jp z,L03E0
L0495       ld a,$12
            jp L27B0
            call L04D7
            ld a,(hl)
            ret
            inc b
            djnz L04A7
            ld de,$000F
            jr L04CB
L04A7       djnz L04C8
            ld a,d
            or e
            jp nz,L03E0
            push hl
            ld hl,($5C51)
            ld de,$000D
            add hl,de
            ld e,(hl)
            inc hl
            ld d,(hl)
            dec de
            inc hl
            ex de,hl
            pop bc
            and a
            sbc hl,bc
            ex de,hl
            jp c,L03E0
            ld (hl),c
            inc hl
            ld (hl),b
            ret
L04C8       ld de,$000D
L04CB       ld hl,($5C51)
            add hl,de
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            ld de,$0000
            ret
L04D7       ld hl,($5C51)
            ld de,$000D
            add hl,de
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            push hl
            and a
            sbc hl,bc
            pop hl
            ex de,hl
            jp nc,L03E0
            inc de
            ld (hl),d
            dec hl
            ld (hl),e
            inc hl
            inc hl
            ld c,(hl)
            inc hl
            ld b,(hl)
            ex de,hl
            add hl,bc
            dec hl
            scf
            ret
L04FD       ld hl,($5C51)
            ld de,$000D
            add hl,de
            ld b,(hl)
            pop hl
            rst $08
            jp (hl)
            exx
            call L04FD
            push bc
            exx
            ld a,b
            pop bc
            and a
            jr z,L051B
            dec a
            jr z,L0522
            rst $20
            dw $0139
            jr L051E
L051B       rst $20
            dw $0133
            ld d,$00
            jr L0537
L0522       rst $20
            dw $0136
            jr L0537
            call L04FD
            rst $20
            dw $0118
            ld a,c
L052E       jr L0537
            ld c,a
            call L04FD
            rst $20
            dw $011B
            rst $30
            ret c
            ld a,$12
            jp L27B0
            exx
L053F       push hl
            push bc
            push hl
            ld hl,(RETADDR)
            ex (sp),hl
            rst $28
            ret pe
            add hl,de
            pop hl
            ld (RETADDR),hl
            pop bc
            pop hl
            ld de,(CHANS)
            and a
            sbc hl,de
            push hl
            ld a,$13
            ld hl,$5C10
L055C       ld e,(hl)
            inc hl
            ld d,(hl)
            ex (sp),hl
            and a
            sbc hl,de
            add hl,de
            jr nc,L056B
            ex de,hl
            and a
            sbc hl,bc
            ex de,hl
L056B       ex (sp),hl
            dec hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            dec a
            jr nz,L055C
            pop hl
            ret
            exx
L0577       push hl
            push bc
            push hl
            ld hl,($5C53)
            add hl,bc
            ld a,h
            cp $C0
            jr nc,L05C7
            ld hl,(RETADDR)
            ex (sp),hl
            rst $28
            ld d,l
            ld d,$E1
            ld (RETADDR),hl
            ld hl,(DATADD)
            ld de,($5C53)
            dec de
            and a
            sbc hl,de
            jr nc,L059F
            ld (DATADD),de
L059F       pop bc
            pop hl
            ld de,(CHANS)
            and a
            sbc hl,de
            push hl
            ld a,$13
            ld hl,$5C10
L05AE       ld e,(hl)
            inc hl
            ld d,(hl)
            ex (sp),hl
            and a
            sbc hl,de
            add hl,de
            jr nc,L05BC
            ex de,hl
            and a
            add hl,bc
            ex de,hl
L05BC       ex (sp),hl
            dec hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            dec a
            jr nz,L05AE
            pop hl
            ret
L05C7       rst $28
            dec d
            rra
            dec bc
            jp p,L0A05
            push af
            dec b
            rlca
            ld sp,$2006
            ld sp,$0D06
            inc (hl)
            ld b,$0E
            add hl,de
            ld b,$37
            jp p,L3605
            push af
            dec b
            ex af,af'
            add a,$3D
            add hl,bc
            cp d
            dec a
            dec (hl)
            add a,$3D
            jr c,L05A7
            dec a
            jr nc,L0624
            ld b,$FF
            scf
            jr L05F6
            and a
L05F6       ld a,($F700)
            call L089E
            call c,L060A
            call nc,L0610
            ld ($F700),a
            call L089E
            scf
            ret
L060A       dec a
            ret p
            ld a,($F71F)
            ret
L0610       inc a
            ld hl,($F71F)
            inc l
            cp l
            ret c
            xor a
            ret
            ld hl,$58E8
            ld a,($F71F)
            inc a
            ld b,a
L0621       push bc
            ld de,$0402
            call L08B1
            add hl,$0010
            pop bc
            djnz L0621
            scf
            ret
            scf
            jr L0638
            ld a,($F700)
            and a
L0638       pop hl
            pop hl
            ld hl,$5B68
            res 1,(hl)
            push af
            call L0853
            pop af
            ret
L0645       push af
            ld hl,$F720
            ld bc,$0800
            ld de,$0DEA
            ld a,$7F
            in a,($FE)
            bit 1,a
            call nz,L3BC5
            ex de,hl
            ld hl,$09EA
            ld bc,$03C3
            ldir
            pop af
            call L0675
            ret nc
L0666       call L069B
            ret c
            call L08E7
            jr nc,L0670
            ret z
L0670       call nc,L3E18
            jr L0666
L0675       ld hl,$F720
            ld c,a
L0679       ld a,(hl)
            cp $3D
            jr nz,L0695
            inc hl
            call L09CD
            jr nc,L0695
            ld a,c
            cp e
            jr nz,L0695
            call L0834
            ret z
            ld a,c
            ld ($D744),a
            ld ($D742),hl
            scf
            ret
L0695       call L082E
            ret z
            jr L0679
L069B       xor a
            ld ($F700),a
            xor a
            rst $18
            xor c
            inc d
            call L0850
            ld a,$02
            rst $28
            ld bc,$2116
            inc a
            ld e,h
            res 0,(hl)
            ld hl,$5C8F
            ld a,($D6E0)
            ld (hl),a
            xor a
            inc hl
            ld (hl),a
            inc hl
            ld (hl),a
            ld a,$FE
            call L07B5
            ld hl,($D742)
            call L07C2
            ld a,$20
            rst $10
            push hl
            call L0E2F
            call L3D6D
            call L0E2F
            ld a,$20
            rst $10
            pop hl
            ld a,($D6E3)
            ld ($5C8F),a
L06DE       xor a
            ld bc,$F701
            ld de,$F70B
L06E5       push af
            call L082E
            jr z,L070B
            cp $3D
            jr z,L070B
            pop af
            push af
            push bc
            push de
            call L07B5
            call L07D9
            ld a,c
            pop de
            pop bc
            ex de,hl
            ld (hl),e
            inc hl
            ld (hl),d
            inc hl
            ex de,hl
            ld (bc),a
            inc bc
            pop af
            inc a
            cp $0A
            jr c,L06E5
            push af
L070B       pop af
            dec a
            ld ($F71F),a
            ld hl,$0DAD
            jp m,L06DE
            inc a
            call L07B5
            ld b,$09
            call L07D1
            ld a,(YLOC)
            and a
            jr z,L0744
            inc a
            ld hl,(CHARS)
            push hl
            inc hl
            ld (CHARS),hl
            ld l,a
            ld h,$00
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            ld e,$20
            rst $18
            inc d
            scf
            ld a,$4B
            rst $10
            ld a,$20
            rst $10
            pop hl
            ld (CHARS),hl
L0744       ld hl,($D6E2)
            ld a,h
            xor l
            and $07
            jr nz,L0771
            ld hl,$7740
            ld a,($F71F)
            inc a
            inc a
            add a,a
            add a,a
            add a,a
            dec a
            ld b,a
            push bc
            ld de,$FF00
            call L0841
            ld b,$7F
            ld de,$0001
            call L0841
            pop bc
            inc b
            ld de,$0100
            call L0841
L0771       res 5,(iy+$01)
            ld hl,$5B68
            set 1,(hl)
            ld a,($F700)
            call L089E
L0780       xor a
            ld ($5C41),a
            call L1255
            ld hl,$05CA
            call L15A1
            jr c,L0780
            call L0814
            ld bc,($F71E)
            inc b
            ld c,$00
            ld hl,$F701
L079C       cp (hl)
            jr z,L07A6
            inc hl
            inc c
            djnz L079C
            and a
            jr L07B0
L07A6       ld a,c
            ld ($F700),a
            ld hl,$0634
            call L15C1
L07B0       call nc,L3E18
            jr L0780
L07B5       add a,$07
            ld b,a
            ld c,$08
            ld a,$16
            rst $10
            ld a,b
            rst $10
            ld a,c
            rst $10
            ret
L07C2       ld b,$08
            ld a,$20
            rst $10
L07C7       ld a,(hl)
            cp $20
            jr c,L07D1
            inc hl
            rst $10
            djnz L07C7
            ret
L07D1       push af
L07D2       ld a,$20
            rst $10
            djnz L07D2
            pop af
            ret
L07D9       ld bc,$0F00
            ld e,c
            ld a,$20
            rst $10
L07E0       ld a,(hl)
            cp $3A
            jr z,L07D1
            cp $20
            jr c,L07D1
            inc hl
            cp $5F
            jr z,L07FC
            ld e,a
            rst $10
            djnz L07E0
L07F2       ld a,(hl)
            cp $3A
            ret z
            cp $20
            ret c
            inc hl
            jr L07F2
L07FC       inc c
            dec c
            jr nz,L07E0
            ld a,e
            call L0814
            ld c,a
            push hl
            ld hl,($5C84)
            dec hl
            call L0825
            ld a,($D6E5)
            ld (hl),a
            pop hl
            jr L07E0
L0814       cp $41
            ret c
            cp $5B
            ret nc
            or $20
            ret
L081D       ld a,(hl)
            inc hl
            cp $FF
            ret z
            rst $10
            jr L081D
L0825       ld a,h
            rrca
            rrca
            rrca
            or $50
            ld h,a
            ret
L082D       inc hl
L082E       ld a,(hl)
            cp $20
            jr nc,L082D
L0833       inc hl
L0834       ld a,(hl)
            cp $FF
            ret z
            cp $0D
            jr z,L0833
            cp $0A
            ret nz
            jr L0833
L0841       push bc
            push de
            push hl
            ld b,h
            ld c,l
            rst $28
            jp (hl)
            ld ($D1E1),hl
            pop bc
            add hl,de
            djnz L0841
            ret
L0850       scf
            jr L0854
L0853       and a
L0854       ld hl,$5C3C
            ld de,$ED11
            ld bc,$0001
            call L0894
            ld hl,$5C7D
            ld bc,$0015
            call L0893
            ld bc,$0E13
L086C       push bc
            push de
            ld b,c
            rst $28
            sbc a,e
            ld c,$ED
            inc (hl)
            ex af,af'
            nop
            pop de
            call L087F
            pop bc
            dec c
            djnz L086C
            ret
L087F       ld bc,$0810
            push hl
L0883       push bc
            ld b,$00
            push hl
            call L0893
            pop hl
            pop bc
            inc h
            djnz L0883
            pop hl
            call L0825
L0893       ex af,af'
L0894       jr c,L0897
            ex de,hl
L0897       ldir
            jr c,L089C
            ex de,hl
L089C       ex af,af'
            ret
L089E       push af
            ld d,a
            ld e,$20
            mul d,e
            add de,$58E8
            ex de,hl
            ld de,$0601
            call L08B1
            pop af
            ret
L08B1       ld c,$10
L08B3       ld a,(hl)
            push hl
            ld hl,$D6E7
            ld b,d
L08B9       cp (hl)
            jr z,L08C5
            dec hl
            djnz L08B9
            pop hl
L08C0       inc hl
            dec c
            jr nz,L08B3
            ret
L08C5       ld a,l
            xor e
            ld l,a
            ld a,(hl)
            pop hl
            ld (hl),a
            jr L08C0
            call m,LFC82
            add a,d
            call m,L2C82
            sub e
            ld (hl),l
            sub e
            dec de
            sub e
            call nc,L8011
            sub e
            sub b
            sub e
            cp b
            ld de,$2BE0
            and b
            sub e
            xor d
            sub e
L08E7       add a,a
            ld hl,$F70B
            add hl,a
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            ld a,(hl)
            inc hl
            cp $3A
L08F5       scf
            ccf
            ret nz
            ld e,(hl)
            inc hl
            cp (hl)
            jr nz,L08FE
            inc hl
L08FE       ld a,e
            or $20
            cp $69
            jr z,L0919
            cp $67
            jr z,L0933
            cp $62
            jr z,L0944
            cp $6D
            jr nz,L08F5
            call L09CD
            ret nc
            ld a,e
            jp L0675
L0919       call L09CD
            ret nc
            ld a,e
            cp $0D
            ret nc
            add a,a
            ld hl,$08CD
            add hl,a
            ld c,(hl)
            inc hl
            ld b,(hl)
            bit 7,b
            res 7,b
            jp nz,L0072
            push bc
            ret
L0933       push hl
            ld de,$DA31
L0937       ld a,(hl)
            ldi
            inc a
            cp $21
            jr nc,L0937
            ld hl,$0DB1
            jr L094C
L0944       ld a,$FF
            ld ($E090),a
            ld ($DA31),a
L094C       ld de,$D5B8
            ld a,(de)
            sub $04
            jr nz,L0957
            ld ($D5B8),a
L0957       ld xl,$03
            ld de,$C000
            ld bc,($D73D)
            call L0983
            xor a
L0965       ld (de),a
            inc de
            dec c
            jr nz,L0965
            ld a,xl
            res 1,a
            set 3,a
            ld (de),a
            set 0,(iy+$30)
            call L0068
            ld d,h
            inc b
            ld c,$00
            call L0068
            ret c
            rlca
            and a
            ret
L0983       ld a,(hl)
            inc a
            cp $21
            ret c
            dec a
            push hl
            ld b,$01
            cp $7C
            jr nz,L099E
            dec hl
            ld a,(hl)
            cp $22
            ld hl,$E090
            jr nz,L09AC
            ld hl,$DA31
            jr L09AC
L099E       cp $60
            ld hl,$0DDA
            jr z,L09AC
            cp $7F
            ld hl,$0DDD
            jr nz,L09B5
L09AC       ld a,(hl)
            inc hl
            inc a
            cp $21
            jr c,L09C9
            dec a
            inc b
L09B5       ld (de),a
            inc de
            dec c
            jr nz,L09C7
            ld a,xl
            ld (de),a
            inc de
            ld xl,$02
            inc de
            inc de
            ld a,($D73D)
            ld c,a
L09C7       djnz L09AC
L09C9       pop hl
            inc hl
            jr L0983
L09CD       ld e,$00
            ld a,(hl)
            jr L09D8
L09D2       ld a,(hl)
            call L2E95
            scf
            ret z
L09D8       sub $30
            ccf
            ret nc
            ld d,$0A
            cp d
            ret nc
            inc hl
            mul d,e
            add de,a
            ld a,d
            and a
            jr z,L09D2
            ret
            dec c
            dec a
            jr nc,L09F8
            ld c,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld e,d
            ld e,b
            ld c,a
            ld d,e
            ld a,(bc)
            ld b,d
L09F8       ld e,a
            ld (hl),d
            ld l,a
            ld (hl),a
            ld (hl),e
            ld h,l
            ld (hl),d
            ld a,($3169)
            jr nc,L0A0E
            ld b,e
L0A05       ld l,a
            ld l,l
            ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L0A59
            ld e,a
L0A0E       ld l,c
            ld l,(hl)
            ld h,l
            ld a,($3269)
            ld a,(bc)
            ld c,(hl)
            ld e,a
            ld h,l
            ld a,b
            ld (hl),h
            ld b,d
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($3069)
            ld a,(bc)
            ld b,e
            ld e,a
            ld h,c
            ld l,h
            ld h,e
            ld (hl),l
            ld l,h
            ld h,c
            ld (hl),h
            ld l,a
            ld (hl),d
            ld a,($3169)
            ld a,(bc)
            ld b,a
            ld e,a
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            ld a,($4E67)
            ld h,l
            ld a,b
            ld (hl),h
            ld e,d
            ld e,b
            ld c,a
            ld d,e
            ld a,(bc)
            ld c,l
            ld e,a
            ld l,a
            ld (hl),d
            ld h,l
            ld l,$2E
            ld l,$3A
            ld l,l
            ld sp,$3D0A
            ld sp,$4E0A
            ld h,l
            ld a,b
            ld (hl),h
            ld e,d
            ld e,b
            ld c,a
L0A59       ld d,e
            ld a,(bc)
            ld d,h
            ld h,c
            ld (hl),b
            ld h,l
            jr nz,L0AAD
            ld e,a
            ld l,a
            ld h,c
            ld h,h
            ld h,l
            ld (hl),d
            ld a,($4C62)
            ld c,a
            ld b,c
            ld b,h
            ld ($637F),hl
            ld h,c
            ld (hl),e
            ld l,h
            ld l,a
            ld h,c
            ld h,h
            ld l,$62
            ld h,c
            ld (hl),e
            ld ($540A),hl
            ld h,c
            ld (hl),b
            ld h,l
            jr nz,L0AD6
            ld e,a
            ld h,l
            ld (hl),e
            ld (hl),h
            ld h,l
            ld (hl),d
            ld a,($4C62)
            ld c,a
            ld b,c
            ld b,h
            ld ($747F),hl
            ld h,c
            ld (hl),b
            ld h,l
            ld (hl),h
            ld h,l
            ld (hl),e
            ld (hl),h
            ld l,$62
            ld h,c
            ld (hl),e
            ld ($490A),hl
            ld e,a
            ld l,(hl)
            ld (hl),h
            ld h,l
            ld (hl),d
            ld h,(hl)
            ld h,c
            ld h,e
            ld h,l
            jr nz,L0ADC
            ld a,($356D)
L0AAD       ld a,(bc)
            ld b,e
            ld e,a
            ld d,b
            cpl
            ld c,l
            ld a,($2E62)
            ld b,e
            ld d,b
            ld c,l
            ld a,(bc)
            jr nz,L0AF0
            ld e,a
            jr c,L0B0A
            jr nz,L0B03
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($5362)
            ld d,b
            ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            inc (hl)
            jr c,L0B0C
            ld d,b
            ld d,d
            ld c,c
            ld c,(hl)
L0AD6       ld d,h
            jr nz,L0B2E
            ld d,e
            ld d,d
            jr nc,L0AE7
            ld sp,$325F
            jr c,L0B2D
            jr nz,L0B26
            ld b,c
            ld d,e
            ld c,c
L0AE7       ld b,e
            ld a,($5362)
            ld d,b
            ld b,l
            ld b,e
            ld d,h
            ld d,d
L0AF0       ld d,l
            ld c,l
            ld ($317F),hl
            ld ($2E38),a
            ld a,d
            jr c,L0B2B
            ld ($5A0A),hl
            ld e,a
            ld e,b
            jr c,L0B32
            jr nz,L0B46
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($5362)
            ld d,b
L0B0C       ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            ld ($387F),hl
            jr nc,L0B45
            ld l,a
            ld ($5A0A),hl
            ld e,b
            ld e,a
            jr c,L0B50
            jr nz,L0B63
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($5362)
            ld d,b
            ld b,l
            ld b,e
L0B2B       ld d,h
            ld d,d
L0B2D       ld d,l
L0B2E       ld c,l
            ld ($387F),hl
L0B32       ld sp,$702E
            ld ($540A),hl
            ld l,a
            ld e,a
            ld l,a
            ld l,h
            ld (hl),e
            ld a,($366D)
            ld a,(bc)
            ld c,l
            ld e,a
            ld l,a
            ld (hl),d
L0B45       ld h,l
L0B46       ld l,$2E
            ld l,$3A
            ld l,l
            jr nc,L0B57
            dec a
            ld ($4F0A),a
            ld (hl),b
            ld (hl),h
            ld l,c
            ld l,a
            ld l,(hl)
            ld (hl),e
L0B57       ld a,(bc)
            ld c,(hl)
            ld e,a
            ld h,l
            ld a,b
            ld (hl),h
            ld b,d
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($3369)
            ld a,(bc)
            ld b,e
            ld l,a
            ld l,l
            ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L0BBB
            ld e,a
            ld l,c
            ld l,(hl)
            ld h,l
            ld a,($3469)
            ld a,(bc)
            inc sp
            ld ($5F2F),a
            ld (hl),$34
            cpl
            jr c,L0BB5
            ld a,($3569)
            ld a,(bc)
            ld d,e
            ld e,a
            ld h,e
            ld (hl),d
            ld h,l
            ld h,l
            ld l,(hl)
            ld a,($3669)
            ld a,(bc)
            ld d,d
            ld e,a
            ld h,l
            ld l,(hl)
            ld (hl),l
            ld l,l
            ld h,d
            ld h,l
            ld (hl),d
            ld a,($3769)
            ld a,(bc)
            ld b,e
            ld e,a
            ld l,h
            ld h,l
            ld h,c
            ld (hl),d
            ld a,($3869)
            ld a,(bc)
            ld d,h
            ld l,a
            ld l,e
            ld e,a
            ld h,l
            ld l,(hl)
            jr nz,L0C19
            ld h,l
            ld a,c
            ld (hl),e
            ld a,($3169)
            ld sp,$530A
            ld (hl),h
            ld (hl),d
            ld l,c
            ld l,(hl)
L0BBB       ld h,a
            jr nz,L0C32
            ld l,a
            ld e,a
            ld l,e
            ld h,l
            ld l,(hl)
            ld (hl),e
            ld a,($3169)
            ld ($470A),a
            ld e,a
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            ld a,($4E67)
            ld h,l
            ld a,b
            ld (hl),h
            ld b,d
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,(bc)
            ld b,l
            ld a,b
            ld e,a
            ld l,c
            ld (hl),h
            ld a,($3969)
            ld a,(bc)
            dec a
            inc sp
            ld a,(bc)
            ld c,a
            ld (hl),b
            ld (hl),h
            ld l,c
            ld l,a
            ld l,(hl)
            ld (hl),e
            ld a,(bc)
            ld b,e
            ld e,a
            ld h,c
            ld l,h
            ld h,e
            ld (hl),l
            ld l,h
            ld h,c
            ld (hl),h
            ld l,a
            ld (hl),d
            ld a,($3369)
            ld a,(bc)
            inc sp
            ld ($5F2F),a
            ld (hl),$34
            cpl
            jr c,L0C3C
            ld a,($3569)
            ld a,(bc)
            ld b,a
            ld e,a
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            ld a,($4367)
            ld h,c
            ld l,h
            ld h,e
            ld (hl),l
            ld l,h
L0C19       ld h,c
            ld (hl),h
            ld l,a
            ld (hl),d
            ld a,(bc)
            ld b,l
            ld a,b
            ld e,a
            ld l,c
            ld (hl),h
            ld a,($3969)
            ld a,(bc)
            dec a
            inc (hl)
            ld a,(bc)
            ld c,a
            ld (hl),b
            ld (hl),h
            ld l,c
            ld l,a
            ld l,(hl)
            ld (hl),e
            ld a,(bc)
L0C32       ld b,e
            ld l,a
            ld l,l
            ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L0C87
            ld e,a
L0C3C       ld l,c
            ld l,(hl)
            ld h,l
            ld a,($3369)
            ld a,(bc)
            ld c,(hl)
            ld e,a
            ld h,l
            ld a,b
            ld (hl),h
            ld b,d
            ld b,c
            ld d,e
            ld c,c
            ld b,e
            ld a,($3469)
            ld a,(bc)
            inc sp
            ld ($5F2F),a
            ld (hl),$34
            cpl
            jr c,L0C8F
            ld a,($3569)
            ld a,(bc)
            ld b,a
            ld e,a
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            ld a,($4367)
            ld l,a
            ld l,l
            ld l,l
            ld h,c
            ld l,(hl)
            ld h,h
            jr nz,L0CBB
            ld l,c
            ld l,(hl)
            ld h,l
            ld a,(bc)
            ld b,l
            ld a,b
            ld e,a
            ld l,c
            ld (hl),h
            ld a,($3969)
            ld a,(bc)
            dec a
            dec (hl)
            ld a,(bc)
            ld c,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld e,d
            ld e,b
            ld c,a
            ld d,e
L0C87       ld a,(bc)
            jr nz,L0CBE
            ld e,a
            jr c,L0CD8
            jr nz,L0CD2
L0C8F       ld h,c
            ld (hl),d
            ld (hl),h
            jr nz,L0D03
            ld l,(hl)
            ld l,h
            ld a,c
            ld a,($5362)
            ld d,b
            ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            ld ($347F),hl
            jr c,L0D09
            ld l,$7A
            jr c,L0CDA
            ld ($200A),hl
            inc (hl)
            jr c,L0CFB
            jr nz,L0CF5
            ld h,c
            ld (hl),d
            ld (hl),h
            dec hl
            ld l,d
            ld e,a
            ld l,a
            ld a,c
            ld (hl),e
L0CBB       ld a,($5362)
L0CBE       ld d,b
            ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            ld ($347F),hl
            jr c,L0D2D
            ld l,d
            ld l,$7A
            jr c,L0CFF
            ld ($310A),hl
L0CD2       ld e,a
            ld ($4B38),a
            jr nz,L0D1B
L0CD8       ld h,c
            ld (hl),d
L0CDA       ld (hl),h
            jr nz,L0D4C
            ld l,(hl)
            ld l,h
            ld a,c
            ld a,($5362)
            ld d,b
            ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            ld ($317F),hl
            ld ($6338),a
            ld l,$7A
            jr c,L0D24
            ld ($310A),hl
            ld ($4B38),a
            jr nz,L0D3F
            ld h,c
            ld (hl),d
            ld (hl),h
L0CFF       dec hl
            ld l,d
            ld l,a
            ld e,a
L0D03       ld a,c
            ld (hl),e
            ld a,($5362)
            ld d,b
L0D09       ld b,l
            ld b,e
            ld d,h
            ld d,d
            ld d,l
            ld c,l
            ld ($317F),hl
            ld ($6338),a
            ld l,d
            ld l,$7A
            jr c,L0D4A
            ld ($420A),hl
            ld e,a
            ld h,c
            ld h,e
            ld l,e
            ld l,$2E
            ld l,$3A
            ld l,l
            ld sp,$3D0A
            ld (hl),$0A
            ld d,h
            ld l,a
L0D2D       ld l,a
            ld l,h
            ld (hl),e
            ld a,(bc)
            ld d,e
            ld h,l
            ld (hl),h
            jr nz,L0D79
            ld e,a
            ld l,h
            ld l,a
            ld h,e
            ld l,e
            ld a,($4C62)
            ld c,a
L0D3F       ld b,c
            ld b,h
            ld ($737F),hl
            ld h,l
            ld (hl),h
            ld (hl),d
            ld (hl),h
            ld h,e
            ld l,$62
            ld h,c
L0D4C       ld (hl),e
            ld ($570A),hl
            ld e,a
            ld c,c
            ld b,(hl)
            ld c,c
            jr nz,L0DC9
            ld h,l
            ld (hl),h
            ld (hl),l
            ld (hl),b
            ld a,($4C62)
            ld c,a
            ld b,c
            ld b,h
            ld ($3A63),hl
            cpl
            ld h,c
            ld (hl),b
            ld (hl),b
            ld (hl),e
            cpl
            ld (hl),a
            ld l,c
            ld h,(hl)
            ld l,c
            cpl
            ld (hl),e
            ld h,l
            ld (hl),h
            ld (hl),l
            ld (hl),b
            cpl
            ld (hl),a
            ld l,c
            ld h,(hl)
            ld l,c
            ld ($622E),a
            ld h,c
            ld (hl),e
            ld ($523A),hl
            ld d,l
            ld c,(hl)
            ld a,(bc)
            ld d,l
            ld e,a
            ld (hl),b
            ld h,h
            ld h,c
            ld (hl),h
            ld h,l
            ld (hl),d
            ld a,($4C62)
            ld c,a
            ld b,c
            ld b,h
            ld ($757F),hl
            ld (hl),b
            ld h,h
            ld h,c
            ld (hl),h
            ld h,l
            ld (hl),d
            ld l,$62
            ld h,c
            ld (hl),e
            ld ($420A),hl
            ld e,a
            ld h,c
            ld h,e
            ld l,e
            ld l,$2E
            ld l,$3A
            ld l,l
            ld sp,$FF0A
            dec c
            jr nz,L0DBD
            rst $38
            ld l,h
            ld h,c
            ld a,c
            ld h,l
            ld (hl),d
            ld ($302C),a
            ld a,($616C)
            ld a,c
L0DBD       ld h,l
            ld (hl),d
            jr nc,L0DFB
            ld (hl),e
            ld (hl),b
            ld (hl),d
            ld l,c
            ld (hl),h
            ld h,l
            jr nz,L0E39
L0DC9       ld (hl),d
            ld l,c
            ld l,(hl)
            ld (hl),h
            jr nc,L0E09
            ld l,$67
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            jr nz,L0DF9
            ld a,h
            ld ($650D),hl
            ld l,(hl)
            rst $38
            ld h,e
            ld a,($6E2F)
            ld h,l
            ld a,b
            ld (hl),h
            ld a,d
            ld a,b
            ld l,a
            ld (hl),e
            cpl
            rst $38
            ld a,a
            ld h,l
            ld l,(hl)
            ld c,l
            ld h,l
            ld l,(hl)
            ld (hl),l
            ld (hl),e
            ld l,$63
            ld h,(hl)
            ld h,a
            nop
            ld bc,$0703
            rrca
L0DFB       rra
            ccf
            ld a,a
            rst $38
            cp $FC
            ret m
            ret p
            ret po
            ret nz
            add a,b
            nop
            nop
            nop
L0E09       nop
            nop
            nop
            rst $38
            rst $38
            rst $38
            nop
            rst $38
            nop
            rst $38
            nop
            rst $38
            nop
            rst $38
            jr c,L0E51
            jr c,L0E53
            jr c,L0E55
            jr c,L0E57
            rst $38
            rst $38
            rst $38
            nop
            nop
            nop
            nop
            nop
            call m,L8484
            add a,h
            add a,h
            add a,h
            add a,h
            call m,L55CD
            ld c,$E5
            ld bc,$0590
            ld de,$D6DB
L0E39       ld a,(de)
            inc de
            ld ($5C8F),a
            ld a,c
            xor $01
            ld c,a
            rst $10
            djnz L0E39
            ld a,(de)
            ld ($5C8F),a
            ld a,$20
            rst $10
            pop de
            jp L0E58
L0E50       ld de,$0DF7
L0E53       jr L0E58
L0E55       ld de,$D750
L0E58       ld hl,(UDG)
            ld (UDG),de
            ret
            pop hl
            pop hl
            ei
            halt
            res 5,(iy+$01)
            rst $08
            ld a,$02
            rst $28
            ld bc,$CD16
            add a,d
            rrca
            ld a,($D5B8)
            cp $FE
            push af
            cp $04
            jr c,L0E80
            ld a,($5C3A)
            cp $FF
L0E80       call c,L11E0
            call L1003
            pop af
            jp z,L2C1F
            jp nc,L11B8
            call L0068
            push hl
            ld (bc),a
            call L0EDD
            xor a
            rst $18
            cp c
            inc d
            ret
            ld a,($D73D)
            sub $20
            jr z,L0EA3
            ld a,$09
L0EA3       push af
            rst $18
            xor c
            inc d
            pop af
            ret z
            push ix
            ld ix,$FB00
            ld hl,$0EC6
            call L2727
            ld a,($D73D)
            cp $40
            ld a,$08
            jr z,L0EC0
            ld a,$06
L0EC0       call L275B
            pop ix
            ret
            ld a,(de)
            rla
            sbc a,(hl)
L0EC9       ld a,($5C7F)
            and $0F
            jr z,L0ED5
            res 5,(iy+$02)
            ret
L0ED5       ld (iy+$31),$02
            rst $28
            ld l,(hl)
            dec c
            ret
L0EDD       ld a,($D5B8)
            cp $04
            ret z
            cp $08
            call nz,L1073
L0EE8       ld a,($5B7B)
            push af
            ld a,($5C7F)
            push af
            halt
            xor a
            out ($FF),a
            ld hl,$D5B9
            ld a,(hl)
            push hl
            rst $18
            xor c
            inc d
            pop hl
            pop af
            ld (hl),a
            inc hl
            ld a,(hl)
            ld bc,$123B
            ld ($5B7B),a
            out (c),a
            pop af
            ld (hl),a
            inc hl
            call L3DB1
            ld e,(hl)
            ld (hl),a
            out (c),e
            inc hl
            ld bc,(CHARS)
            ld e,(hl)
            ld (hl),c
            inc hl
            ld d,(hl)
            ld (hl),b
            inc hl
            ld (CHARS),de
            call L0F3B
            ld a,($D5B8)
            cp $08
            ret z
            call L2708
            ld h,$F7
            call L0F5F
            ld h,$FB
            call L0F5F
            jp L2797
L0F3B       and a
L0F3C       ld de,$0418
            nextreg $1C,$0F
L0F43       push de
            ld b,$04
L0F46       push bc
            call L0F70
            dec e
            pop bc
            djnz L0F46
            pop de
            inc e
            dec d
            jr nz,L0F43
            ret
L0F54       ld d,h
            ld a,l
            ld c,$30
            xor c
            ld e,a
            ld b,$00
            ldir
            ret
L0F5F       ld l,$00
            ld d,h
            ld e,$30
            ld b,e
L0F65       ld c,(hl)
            ld a,(de)
            ld (hl),a
            ld a,c
            ld (de),a
            inc hl
            inc de
            djnz L0F65
            ret
            and a
L0F70       ld a,(hl)
            ld bc,$243B
            out (c),e
            inc b
            in d,(c)
            jr nc,L0F7C
            ld a,d
L0F7C       out (c),a
            ld (hl),d
            inc hl
            inc e
            ret
L0F82       xor a
            ld ($5C41),a
            ld (iy-$30),$02
            ld hl,$5C3B
            ld a,(hl)
            or $0C
            ld (hl),a
            ret
L0F92       xor a
            ld d,$20
            ld bc,$243B
            nextreg $43,a
            ld e,$00
L0F9D       ld a,e
            nextreg $40,a
            ld a,$41
            out (c),a
            inc b
            in a,(c)
            dec b
            ld (hl),a
            inc hl
            ld a,$44
            out (c),a
            inc b
            in a,(c)
            dec b
            ld (hl),a
            inc hl
            inc e
            dec d
            jr nz,L0F9D
            ret
L0FBA       xor a
            ld d,$20
            ld e,$00
            nextreg $43,a
L0FC2       ld a,e
            nextreg $40,a
            ld a,(hl)
            inc hl
            nextreg $44,a
            ld a,(hl)
            inc hl
            nextreg $44,a
            inc e
            dec d
            jr nz,L0FC2
            ret
L0FD5       push bc
            ld bc,$0020
            push de
            ldir
            ex de,hl
            call L0F92
            pop hl
            pop de
            jr L0FFB
L0FE4       ld de,$3700
            dec a
            jr z,L0FFA
            dec a
            jr z,L0FFB
            dec a
            jr z,L1014
            dec a
            jp z,L1078
            ld de,$3760
            dec a
            jr nz,L0FFB
L0FFA       ex de,hl
L0FFB       ld bc,$0060
            rst $20
            ld l,b
            nop
            scf
            ret
L1003       ld a,($D5B8)
            cp $04
            ret z
            call L0EE8
            ld hl,$D694
            ld de,$3760
            jr L101A
L1014       ld hl,$D5ED
            ld de,$3700
L101A       push de
            ld a,$43
            call GetNRegA
            ld (hl),a
            inc hl
            ld a,$15
            call GetNRegA
            ld (hl),a
            inc hl
            ld a,$14
            call GetNRegA
            ld (hl),a
            inc hl
            ld a,($5C8D)
            ld (hl),a
            inc hl
            ld a,($5B62)
            ld (hl),a
            inc hl
            ld a,($5C48)
            ld (hl),a
            inc hl
            call L0F92
            pop de
            push hl
            call L0FFA
            pop hl
            push hl
            add hl,$0020
            call L0FBA
            pop hl
            ld a,(hl)
            ld ($5C8D),a
            ld ($5C48),a
            push af
            rra
            rra
            rra
            out ($FE),a
            pop af
            cpl
            and $38
            ld ($5B62),a
            ld a,$4A
            call GetNRegA
            nextreg $14,a
            nextreg $15,$00
            scf
            ret
L1073       ld hl,$D694
            jr L107B
L1078       ld hl,$D5ED
L107B       ld a,(hl)
            push af
            inc hl
            ld a,(hl)
            nextreg $15,a
            inc hl
            ld a,(hl)
            nextreg $14,a
            inc hl
            ld a,(hl)
            ld ($5C8D),a
            inc hl
            ld a,(hl)
            ld ($5B62),a
            inc hl
            ld a,(hl)
            ld ($5C48),a
            rra
            rra
            rra
            out ($FE),a
            inc hl
            call L0FBA
            pop af
            nextreg $43,a
            scf
            ret
            jr c,L10F7
            ld d,(hl)
            ld h,(hl)
            ld h,l
            ld b,l
            ld b,a
            rlca
            jr nc,L10D7
            jr z,L10D9
            jr z,L10B3
L10B3       nop
            nop
            jr c,L10EF
            jr c,L10F1
            jr c,L10BB
L10BB       nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            jr c,L1117
            ld d,(hl)
            ld h,(hl)
            ld h,l
            ld b,l
            ld b,a
            rlca
            ld l,b
            ld a,b
            ld l,c
            ld a,c
            add hl,hl
            add hl,sp
            rst $08
            rst $20
            rst $18
            rst $28
L10D7       rst $10
            dec a
L10D9       jr c,L1116
            inc a
            ld a,($3D39)
            jr c,L1119
            nop
            nop
            nop
            nop
L10E5       nextreg $51,$10
            ld hl,$23B7
            scf
            call L0F3C
            xor a
L10F1       out ($FE),a
            ld bc,$243B
            ld a,$15
            out (c),a
            inc b
            in h,(c)
            in a,($FF)
            ld l,a
            push hl
            or $38
            out ($FF),a
            res 1,h
            out (c),h
            ld hl,($5C78)
            res 7,h
            res 7,l
            ld a,l
            and $03
            inc a
            ld d,a
            ld a,h
L1116       and $03
            inc a
L1119       ld e,a
L111A       ld a,h
            add a,d
            cp $E8
            jr c,L1125
            ld a,d
            neg
            ld d,a
            add a,h
L1125       ld h,a
            ld c,$C8
            call L1172
            ld a,l
            add a,e
            cp $A8
            jr c,L1136
            ld a,e
            neg
            ld e,a
            add a,l
L1136       ld l,a
            ld c,$50
            call L1172
            halt
            bit 5,(iy+$01)
            jr z,L111A
            xor a
            ld bc,$FF90
            call L117C
            xor a
            ld bc,$BF20
            call L117C
            pop hl
            ld a,h
            nextreg $15,a
            ld a,l
            out ($FF),a
            ld a,($5C48)
            rrca
            rrca
            rrca
            out ($FE),a
            res 5,(iy+$01)
            ld hl,$23B7
            call L0F3B
            nextreg $51,$FF
            jp L11E0
L1172       ld b,$18
            bit 7,(iy+$47)
            jr z,L117C
            ld b,$FF
L117C       push hl
            push de
            push bc
            ld e,a
            add a,b
            ld d,a
            ld hl,$0318
L1185       ld bc,$243B
            out (c),l
            inc b
            out (c),e
            out (c),d
            inc l
            dec h
            jr nz,L1185
            dec b
            out (c),l
            inc b
            pop hl
            sla l
            push af
            ld a,e
            jr nc,L11A0
            srl a
L11A0       bit 7,l
            res 7,l
            jr z,L11A7
            add a,l
L11A7       out (c),a
            pop af
            ld a,d
            jr nc,L11AF
            srl a
L11AF       add a,l
            out (c),a
            pop de
            pop hl
            ret
            call L1003
L11B8       ld bc,$0017
            call L1277
L11BE       ld a,$FF
            ld ($D5B8),a
            ld sp,$5BFF
L11C6       xor a
L11C7       call L0645
            ld a,($D744)
            and a
            jr nz,L11C6
            ld a,$01
            jr L11C7
            ld a,($D5B8)
            and a
            ret nz
            pop hl
            call L0068
            ld ($C913),a
L11E0       ld a,($5C81)
            and $7F
L11E5       push af
            ld a,($5B68)
            bit 1,a
            jr z,L11F0
            rst $18
            sub c
            scf
L11F0       ld bc,$0BB8
            pop af
L11F4       and a
            jr z,L1202
            dec c
            jr nz,L1202
            djnz L1202
            dec a
            jp z,L10E5
            jr L11E5
L1202       halt
            ld hl,$5C3B
            bit 5,(hl)
            jr z,L11F4
            res 5,(hl)
            ld a,($5C08)
            ld hl,$5C41
            cp $0E
            jr z,L121C
            res 0,(hl)
            cp $10
            jr nc,L123B
L121C       push af
            cp $06
            jr nz,L122A
            ld hl,$5C6A
            ld a,$08
            xor (hl)
            ld (hl),a
            jr L1236
L122A       cp $0E
            jr c,L123A
            sub $0D
            cp (hl)
            ld (hl),a
            jr nz,L1236
            ld (hl),$00
L1236       set 3,(iy+$02)
L123A       pop af
L123B       bit 7,(iy+$30)
            scf
            ret nz
            bit 1,(iy+$07)
            ret nz
            ld hl,$1264
            ld b,$08
L124B       cp (hl)
            inc hl
            jr nz,L1250
            ld a,(hl)
L1250       inc hl
            djnz L124B
            scf
            ret
L1255       call L11E0
            push af
            ld a,($5C39)
            ld hl,$00C8
            call L3E20
            pop af
            ret
            add a,$5B
            push bc
            ld e,l
            rst $00
            ld a,a
            jp po,LC37E
            ld a,h
            call LCC5C
            ld a,e
            bit 7,l
L1274       ld bc,$1517
L1277       ld a,c
            sub b
            inc a
            ld c,a
            ld a,$18
            sub b
            ld b,a
L127F       push bc
            rst $28
            sbc a,e
            ld c,$0E
            ex af,af'
            bit 3,(iy+$45)
            jr z,L12AE
            ex af,af'
            ld a,$0B
            ex af,af'
            call L12D1
L1292       push hl
            xor a
            ld b,$20
L1296       ld (hl),a
            inc hl
            djnz L1296
            pop hl
            push hl
            set 5,h
            ld b,$20
L12A0       ld (hl),a
            inc hl
            djnz L12A0
            pop hl
            inc h
            dec c
            jr nz,L1292
            call L12D1
            jr L12BB
L12AE       push hl
            ld b,$20
            xor a
L12B2       ld (hl),a
            inc hl
            djnz L12B2
            pop hl
            inc h
            dec c
            jr nz,L12AE
L12BB       ld b,$20
            push bc
            rst $28
            adc a,b
            ld c,$EB
            pop bc
            ld a,($5C8D)
L12C6       ld (hl),a
            inc hl
            djnz L12C6
            pop bc
            dec b
            dec c
            jr nz,L127F
            scf
            ret
L12D1       push af
            push bc
            ld a,$53
            call GetNRegA
            ex af,af'
            out (c),a
            pop bc
            pop af
            ret
;
; Reads the Next Register
; IN:  A = Register Number
; OUT: A = Next Register Value
;      BC = Next register value port
;            
GetNRegA
            ld bc,$243B            ; Use the standard next register read pattern
            out (c),a
            inc b
            in a,(c)
            ret

            inc d
            ld bc,$2047
            inc d
            nop
            add hl,de
            or b
            ld b,$00
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            jr nz,L130B
            ld bc,$204C
            inc d
            nop
            add hl,de
            or b
            dec h
            nop
            ld l,c
            ld l,(hl)
            ld l,e
            ld (hl),e
            add hl,de
            or b
            ld b,c
            nop
            ld b,l
            ld c,(hl)
            ld d,h
L130B       ld b,l
            ld d,d
            dec a
            ld (hl),e
            ld h,l
            ld l,h
            ld h,l
            ld h,e
            ld (hl),h
            jr nz,L135B
            ld b,h
            ld c,c
            ld d,h
            dec a
            ld (hl),l
            ld (hl),b
            jr nz,L1363
            ld e,b
            ld d,h
            ld b,l
            ld c,(hl)
            ld b,h
            dec a
            ld l,l
            ld l,a
            ld (hl),d
            ld h,l
            jr nz,L136C
            ld d,d
            ld b,l
            ld b,c
            ld c,e
            dec c
            inc d
            ld bc,$2044
            inc d
            nop
            add hl,de
            cp b
            ld b,$00
            ld (hl),d
            ld l,c
            halt
            ld h,l
            jr nz,L1353
            ld bc,$2043
            inc d
            nop
            add hl,de
            cp b
            dec h
            nop
            ld l,a
            ld (hl),b
            ld a,c
            jr nz,L1366
            cp b
            jr c,L1350
L1350       ld l,l
            ld l,a
            add hl,de
L1353       cp b
            ld b,e
            nop
            inc d
            ld bc,$1456
            nop
L135B       ld h,l
            jr nz,L1377
            cp b
            ld d,c
            nop
            inc d
            ld bc,$2052
            inc d
L1366       nop
            add hl,de
            cp b
            ld d,a
            nop
            ld h,l
L136C       ld l,(hl)
            ld h,c
            ld l,l
            ld h,l
            jr nz,L138B
            cp b
            ld (hl),h
            nop
            inc d
            ld bc,$2045
            inc d
            nop
            add hl,de
            cp b
            ld a,d
            nop
            ld (hl),d
            ld h,c
            ld (hl),e
            ld h,l
            jr nz,L139E
            cp b
            sub d
            nop
            ld l,l
            add hl,de
            cp b
L138B       sbc a,b
            nop
            inc d
            ld bc,$204B
            inc d
            nop
            add hl,de
            cp b
            sbc a,(hl)
            nop
            ld h,h
            ld l,c
            ld (hl),d
            jr nz,L13B5
            cp b
            or b
L139E       nop
            inc d
            ld bc,$2055
            inc d
            nop
            add hl,de
            cp b
            or (hl)
            nop
            ld l,(hl)
            add hl,de
            cp b
            cp h
            nop
            ld l,l
            ld l,a
            ld (hl),l
            ld l,(hl)
            ld (hl),h
            jr nz,L13CE
L13B5       cp b
            ret c
            nop
            ld (hl),d
            ld h,l
            add hl,de
            cp b
            ex (sp),hl
            nop
            inc d
            ld bc,$1920
            cp b
            call po,L4D00
            jr nz,L13DC
            nop
            add hl,de
            cp b
            jp pe,L6F00
L13CE       ld (hl),l
            ld l,(hl)
            ld (hl),h
            rst $38
            ld b,e
            ld l,b
            ld h,c
            ld l,(hl)
            ld h,a
            ld h,l
            jr nz,L144E
            ld l,a
            jr nz,L1441
            ld h,l
            ld (hl),e
            ld (hl),h
            ld l,c
            ld l,(hl)
            ld h,c
            ld (hl),h
            ld l,c
            ld l,a
            ld l,(hl)
            jr nz,L144A
            ld l,(hl)
            ld h,h
            jr nz,L145D
            ld (hl),d
            ld h,l
            ld (hl),e
            ld (hl),e
            jr nz,L1443
            jr nz,L1469
            ld l,a
            jr nz,L1468
            ld h,c
            ld (hl),e
            ld (hl),h
            ld h,l
            rst $38
            add hl,de
            ex af,af'
            nop
            nop
            jr nz,L141C
            ex af,af'
            ld bc,$4F00
            jr nz,L1422
            ex af,af'
            rlca
            nop
            ld (hl),d
            ld h,h
            ld h,l
            ld (hl),d
            ld a,($0819)
            ld a,($2B00)
            dec l
            add hl,de
            ex af,af'
            jp nc,L4900
L141C       ld l,(hl)
            ld h,(hl)
            ld l,a
            ld a,($0819)
L1422       sbc a,e
            nop
            ld c,(hl)
            ld h,c
            ld l,l
            ld h,l
            add hl,de
            ex af,af'
            or e
            nop
            ld b,c
            ld (hl),d
            ld h,l
            ld h,c
            add hl,de
            ex af,af'
            ld c,l
            nop
            ld l,l
            ld l,c
            ld e,b
            jr nz,L14A8
            rst $38
            add hl,de
            ex af,af'
            halt
            nop
            ld (hl),e
            ld h,l
            ld h,c
L1441       ld (hl),d
            ld h,e
L1443       ld c,b
            rst $38
            ld d,$16
            nop
            jr nz,L1461
L144A       nop
            nop
            jr nz,L1465
L144E       nop
            nop
            ld d,$16
            nop
            rst $38
            ld l,$2E
            rst $38
            ld c,(hl)
            ld h,l
            ld (hl),a
            jr nz,L14CA
            ld h,c
L145D       ld l,l
            ld h,l
            ld a,($FF20)
            ld d,b
            ld h,c
            ld (hl),e
L1465       ld (hl),h
            ld h,l
            jr nz,L14CA
L1469       ld (hl),e
            ld a,($FF20)
            ld h,e
            ld l,a
            ld (hl),b
            ld a,c
            ld l,c
            ld l,(hl)
            ld h,a
            ld l,$2E
            ld l,$FF
            ld h,l
            ld (hl),d
            ld h,c
            ld (hl),e
            ld l,c
            ld l,(hl)
            ld h,a
            ld l,$2E
            ld l,$FF
            ld a,a
            ld h,d
            ld (hl),d
            ld l,a
            ld (hl),a
            ld (hl),e
            ld h,l
            ld (hl),d
            ld l,$63
            ld h,(hl)
            ld h,a
            nop
            ld a,a
            ld h,l
            ld l,(hl)
            ld b,d
            ld (hl),d
            ld l,a
            ld (hl),a
            ld (hl),e
            ld h,l
            ld a,b
            ld (hl),h
            ld l,$63
            ld h,(hl)
            ld h,a
            nop
            ld e,$05
            ld d,$15
            dec h
            ld d,e
            jr nz,L14C8
L14A8       ld a,e
            add hl,de
            xor b
            pop bc
            nop
            ld l,$16
            dec d
            rrca
            ld b,(hl)
            ld l,c
            ld l,h
            ld (hl),h
            ld h,l
            ld (hl),d
            ld a,($55FF)
            ld (hl),e
            ld h,l
            ld (hl),d
            jr nz,L1520
            ld (hl),d
            ld h,l
            ld h,c
            jr nz,L14EC
            jr nc,L14F4
            ld l,$31
L14C8       dec (hl)
            add hl,hl
L14CA       ld a,($FF20)
            ld e,$05
            ld d,$16
            nop
            rst $38
            ld l,(hl)
            ld h,c
            ld l,l
            ld h,l
            rst $38
            ld l,(hl)
            ld l,a
            ld l,(hl)
            ld h,l
            rst $38
            ld h,h
            ld h,c
            ld (hl),h
            ld h,l
            rst $38
            ld (hl),e
            ld l,c
            ld a,d
            ld h,l
            rst $38
            ld h,c
            ld (hl),h
            ld (hl),h
            ld (hl),d
            rst $38
L14EC       out ($14),a
            ret c
            inc d
            inc d
            jp po,L1914
            ex af,af'
            jr nz,L14F8
L14F8       rst $38
            ret c
            inc d
            jp po,LDD14
            inc d
            rst $20
            inc d
            add hl,de
            ex af,af'
            ex de,hl
            nop
            rst $38
            add hl,de
            nop
            ld bc,$FF00
            ld d,e
            ld h,l
            ld h,c
            ld (hl),d
            ld h,e
            ld l,b
            ld a,($FF0D)
            ld b,l
            ld e,b
            ld d,h
            ld b,l
            ld c,(hl)
            ld b,h
            dec a
            ld h,(hl)
            ld l,c
            ld l,h
            ld h,l
            ld (hl),e
L1520       cpl
            ld h,h
            ld l,c
            ld (hl),d
            ld (hl),e
            rst $38
            ld d,$02
            nop
            ld (de),a
            ld bc,$5020
            ld (hl),d
            ld l,a
            ld h,e
            ld h,l
            ld (hl),e
            ld (hl),e
            ld l,c
            ld l,(hl)
            ld h,a
            ld l,$2E
            ld l,$20
            ld (de),a
            nop
            jr nz,L153D
            ld d,b
            ld (hl),d
            ld h,l
            ld (hl),e
            ld (hl),e
            jr nz,L15A6
            ld l,(hl)
            ld a,c
            jr nz,L15B4
            ld h,l
            ld a,c
            rst $38
            ld b,e
            ld c,h
            ld d,e
            ld a,($4F4C)
            ld b,c
            ld b,h
            ld ($5552),hl
            ld c,(hl)
            ld l,$42
            ld b,c
            ld d,e
            ld ($720D),hl
            ld (hl),l
            ld l,(hl)
            ld l,$67
            ld h,h
            ld h,l
            rst $38
            ld h,e
            ld a,($642F)
            ld l,a
            ld h,e
            ld (hl),e
            cpl
            ld h,a
            ld (hl),l
            ld l,c
            ld h,h
            ld h,l
            ld (hl),e
            cpl
            ld h,d
            ld (hl),d
            ld l,a
            ld (hl),a
            ld (hl),e
            ld h,l
            ld (hl),d
            ld l,$67
            ld h,h
            ld h,l
            rst $38
            ld h,e
            ld a,($63FF)
            ld a,($6C2F)
            ld l,c
            ld l,(hl)
            ld l,e
            ld (hl),e
            rst $38
            ld c,(hl)
            ld h,l
            ld a,b
            ld (hl),h
            ld c,h
            ld l,c
            ld l,(hl)
            ld l,e
            ld d,d
            ld d,l
            ld c,(hl)
            ld c,h
            ld c,(hl)
            ld c,e
            ld b,d
            ld b,c
            ld d,e
            ld d,e
            ld b,e
            ld d,d
L15A1       push $15C4
            push de
L15A6       push bc
L15A7       ld b,(hl)
            inc b
            jr z,L15B6
            dec b
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc hl
            cp b
            jr z,L15BC
L15B4       jr L15A7
L15B6       and a
            dec b
            pop bc
            pop de
            pop hl
            ret
L15BC       pop bc
            ex de,hl
            ex (sp),hl
            ex de,hl
            ret
L15C1       call L15C8
            ld h,$01
            dec h
            ret
L15C8       jp (hl)
L15C9       nextreg $8E,$08
L15CD       ex af,af'
            pop af
            ld ($5B52),hl
            ld hl,(OLDSP)
L15D5       ld (OLDSP),sp
            ld sp,hl
            ld hl,($5B52)
            push af
            ex af,af'
            ret
L15E0       ex af,af'
            pop af
            ld ($5B52),hl
            ld hl,(OLDSP)
            ld (OLDSP),sp
            ld sp,hl
            ld hl,($5B52)
            push af
            ex af,af'
            nextreg $8E,$78
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            ld hl,($5C51)
            jp L036C
            ld (hl),c
            jr L1587
            jr L1676
            add hl,de
            or b
            add hl,de
            jr nc,L1628
            ld b,l
            ld a,(de)
            ret po
            dec de
            ld (hl),c
            jr nz,L165F
L1615       ld a,(de)
            ld h,(hl)
            ld a,(de)
            and d
            ld a,(de)
            cp a
            ld a,(de)
            add a,a
L161D       dec de
            ld b,e
            jr nz,L15D8
            jr nz,L15D5
            jr nz,L1615
            dec de
            ld d,e
            inc e
L1628       sbc a,c
            inc e
            or b
            inc e
            jp c,LFA1C
            inc e
            jp c,LD61A
L1633       ld a,(de)
            rst $00
            inc e
            rr d
            xor e
            jr nz,L1641
            dec e
            rra
            dec e
            ld hl,($D11D)
L1641       ld d,$01
            add hl,de
            ld c,d
            dec de
            pop bc
            dec de
            rst $08
            ld a,(de)
            push af
            ld a,(de)
            rst $38
            add hl,de
            ld b,h
            ld a,(de)
            ld l,l
            add hl,de
            or b
            add hl,de
            jr nc,L1670
            ld b,l
            ld a,(de)
            ld b,h
            ld a,(de)
            ld (hl),c
            jr nz,L16A1
            ld a,(de)
            ld b,h
L165F       ld a,(de)
            and d
            ld a,(de)
            cp a
            ld a,(de)
            ld b,h
            ld a,(de)
            or (hl)
            jr L1620
            jr nz,L161D
            jr nz,L1697
            rla
            ld hl,($2A17)
            rla
            ld hl,($2A17)
            rla
L1676       ld hl,($4417)
            ld a,(de)
            ld b,h
            ld a,(de)
            ld hl,($4417)
            ld a,(de)
            ld hl,($2A17)
            rla
            ld b,h
            ld a,(de)
            ld hl,($8C17)
            ld d,$44
            ld a,(de)
            set 6,(ix+$25)
            set 7,(ix+$25)
            ret
L1695       push ix
L1697       pop hl
            add hl,$0030
            ret
L169D       call L1695
            ld bc,$00FF
            bit 7,(ix+$19)
            ret nz
            call L16B5
            ld c,a
            inc c
            ret
L16AE       ld a,$20
            inc xh
            dec xh
            ret z
L16B5       ld a,(ix+$1C)
            bit 4,(ix+$25)
            ret z
            srl a
            ret
L16C0       push af
            push bc
            push de
            push hl
            ld e,a
            call L1D47
            pop hl
            pop de
            pop bc
            pop af
            ret
L16CD       res 7,(ix+$25)
            bit 4,(ix+$19)
            jr z,L1708
L16D7       call L22D4
            ld (ix+$0F),a
            ld c,a
            ld b,a
            xor a
L16E0       scf
            rra
            djnz L16E0
            ld (ix+$10),a
            ld (ix+$0D),l
            ld (ix+$0E),h
            ld l,(ix+$11)
            ld h,b
            add hl,hl
            add hl,hl
            add hl,hl
            xor a
            bit 4,(ix+$1D)
            jr z,L16FC
            add hl,hl
L16FC       sbc hl,bc
            inc a
            jr nc,L16FC
            dec a
            ld (ix+$1C),a
            jp L2043
L1708       and $03
            cp $03
            ret z
            ld b,a
            ld a,(ix+$19)
            and $FC
            or b
            ld (ix+$19),a
            ret
L1718       ld hl,$164C
            jp L1D61
L171E       res 6,(ix+$25)
            bit 7,(ix+$25)
            jr nz,L16CD
            jr L175C
            bit 7,(ix+$19)
            ret z
            set 6,(ix+$25)
            jr L175C
L1735       ld a,e
            bit 6,(ix+$25)
            jr nz,L171E
            cp $20
            jr c,L1718
L1740       jr nz,L1756
            ld a,(ix+$2A)
            and a
            ret z
            ld (ix+$2C),a
            ld a,(ix+$29)
            dec a
            ld (ix+$2B),a
            inc (ix+$2A)
            jr L175C
L1756       inc (ix+$2A)
            call L18D9
L175C       call L1695
            ld a,(ix+$29)
            add hl,a
            ld (hl),e
            inc a
            ld (ix+$29),a
            bit 6,(ix+$25)
            ret nz
            cp $FE
            jr nc,L1779
            call L16B5
            cp (ix+$2A)
            ret nc
L1779       call L16B5
            cp (ix+$2A)
            jr nc,L17B7
            ld a,(ix+$2C)
            cp $01
            ld a,(ix+$2B)
            jr z,L178E
            and a
            jr z,L1795
L178E       ld c,a
            inc c
            ld b,(ix+$2C)
            jr L17BD
L1795       call L1695
            call L16B5
            ld b,a
            ld c,$00
L179E       ld a,(hl)
            inc hl
            inc c
            cp $20
            jr nc,L17B0
            call L16C0
            ld a,(hl)
            inc hl
            inc c
            call L16C0
            jr L179E
L17B0       call L16C0
            djnz L179E
            jr L1833
L17B7       ld c,(ix+$29)
            ld b,(ix+$2A)
L17BD       ld a,c
            and a
            ret z
            call L1695
            ld a,(ix+$19)
            and $03
            jr z,L17FA
            call L16B5
            sub b
            ld e,a
            ld a,(ix+$19)
            and $02
            jr nz,L17E6
            ld a,e
            srl a
L17D9       and a
            jr z,L17FA
            push af
            ld a,$20
            call L16C0
            pop af
            dec a
            jr L17D9
L17E6       push bc
            push hl
            ld d,$00
L17EA       ld a,(hl)
            inc hl
            cp $20
            jr nz,L17F1
            inc d
L17F1       jr nc,L17F5
            inc hl
            dec c
L17F5       dec c
            jr nz,L17EA
            pop hl
            pop bc
L17FA       ld b,$00
            push bc
L17FD       ld a,(hl)
            call L16C0
            cp $20
            jr nc,L180D
            inc hl
            dec c
            ld a,(hl)
            call L16C0
            jr L182E
L180D       jr nz,L182E
            ld a,(ix+$19)
            and $02
            jr z,L182E
            ld a,e
            ld b,$00
L1819       sub d
            jr c,L181F
            inc b
            jr L1819
L181F       dec d
            ld a,b
            and a
            jr z,L182E
            ld a,e
            sub b
            ld e,a
L1827       ld a,$20
            call L16C0
            djnz L1827
L182E       inc hl
            dec c
            jr nz,L17FD
            pop bc
L1833       push bc
            call L2043
            pop bc
            call L1695
            add hl,bc
            ld a,(ix+$29)
            sub c
            ld b,a
            push af
            call L18A8
            pop af
            ret z
L1847       ld a,(hl)
            cp $20
            jr nz,L1850
            inc hl
            djnz L1847
            ret
L1850       push bc
            push hl
            ld e,(hl)
            ld a,e
            cp $20
            jr c,L1861
            call L1740
L185B       pop hl
            pop bc
            inc hl
            djnz L1850
            ret
L1861       call L175C
            pop hl
            pop bc
            inc hl
            dec b
            ret z
            push bc
            push hl
            ld e,(hl)
            call L175C
            jr L185B
            bit 4,(ix+$19)
            ret z
            ld a,(ix+$0F)
            inc a
            cp $09
            ret nc
L187D       jp L16D7
            bit 4,(ix+$19)
            jr z,L188F
            ld a,(ix+$0F)
            dec a
            cp $03
            jr nc,L187D
            ret
L188F       ld a,(ix+$24)
            and a
            call nz,L2043
            call L169D
            call L19E7
            set 5,(ix+$19)
            res 6,(ix+$25)
            res 7,(ix+$25)
L18A8       xor a
            ld (ix+$29),a
            ld (ix+$2A),a
            ld (ix+$2C),a
            ld (ix+$2B),a
            ret
L18B6       ld a,(ix+$29)
            push af
L18BA       ld a,(ix+$19)
            push af
            res 1,(ix+$19)
            call L1779
            pop af
            ld (ix+$19),a
            ld a,(ix+$29)
            and a
            jr nz,L18BA
            pop af
            and a
            ret nz
            call L1AA2
            ret c
            jp L2071
L18D9       call L18EF
            ret nz
            ld d,(ix+$2A)
            call L16B5
            cp d
            ret c
            ld (ix+$2C),d
            ld a,(ix+$29)
            ld (ix+$2B),a
            ret
L18EF       cp $2C
            ret z
            cp $2E
            ret z
            cp $21
            ret z
            cp $3F
            ret z
            cp $3B
            ret z
            cp $3A
            ret
            bit 4,(ix+$19)
            jr nz,L1914
            res 7,(ix+$19)
            rra
            ret nc
            set 7,(ix+$19)
            ret
L1912       ld a,$08
L1914       call L22D4
            ex de,hl
            ld hl,(CHARS)
            inc d
            inc h
            ld bc,$0300
            ld a,h
            cp $BD
            jr nc,L1947
            and $C0
            jr z,L192C
            ldir
            ret
L192C       push hl
            push de
            push bc
            ld d,$54
            call L27BA
            pop bc
            pop de
            ex (sp),hl
            res 6,d
            rst $28
            jp L1633
            ld d,h
            pop hl
            call L27BD
L1942       ld d,$56
            jp L27BA
L1947       push bc
            push de
            push hl
            call L27B3
            ex (sp),hl
            ld a,(hl)
            inc hl
            ex (sp),hl
            push af
            dec d
            call L27BD
            pop af
            pop hl
            pop de
            pop bc
            ld (de),a
            inc de
            dec bc
            ld a,b
            or c
            jr nz,L1947
            ret
L1962       ld d,$54
            call L27BA
            push hl
            call L239B
            jr L193C
            bit 4,(ix+$19)
            jr nz,L1912
            bit 3,(ix+$25)
            jr nz,L198D
            call L1A0B
            push ix
            pop hl
            ld e,(ix+$0B)
            ld d,(ix+$0C)
            add hl,de
            call L19E7
            set 3,(ix+$25)
L198D       ld (iy+$58),$80
L1991       ld de,$218A
            push ix
            pop hl
            ld c,(ix+$0B)
            ld b,(ix+$0C)
            add hl,bc
            push hl
            call L1A0B
            pop hl
            and a
            sbc hl,bc
            ld ($5B9B),hl
            ld ($F358),hl
            ex de,hl
            jp L20C9
            bit 4,(ix+$19)
            jr nz,L1962
            bit 3,(ix+$25)
            ret z
            ld (iy+$58),$00
            call L1991
            call L1A0B
            ld hl,($F358)
            res 3,(ix+$25)
L19CC       push hl
            ld l,(ix+$0B)
            ld h,(ix+$0C)
            and a
            sbc hl,bc
            ld (ix+$0B),l
            ld (ix+$0C),h
            pop hl
            rst $30
            call L053F
            call L15CD
L19E4       jp L1942
L19E7       push hl
            ld l,(ix+$0B)
            ld h,(ix+$0C)
            add hl,bc
            ld (ix+$0B),l
            ld (ix+$0C),h
            pop hl
            rst $30
            call L0577
            call L15CD
            jr L19E4
            call L18B6
            call L169D
            res 5,(ix+$19)
            jr L19CC
L1A0B       ld hl,$0000
            ld c,(ix+$11)
            ld b,h
            ld a,(ix+$12)
L1A15       add hl,bc
            dec a
            jr nz,L1A15
            ld c,l
            ld b,h
            add hl,hl
            add hl,hl
            add hl,hl
            call L26F9
            jr c,L1A2B
            jr z,L1A27
            ld b,h
            ld c,l
L1A27       add hl,bc
L1A28       ld b,h
            ld c,l
            ret
L1A2B       add hl,hl
            add hl,hl
            add hl,hl
            jr L1A28
L1A30       ld a,(ix+$17)
L1A33       ld (ix+$22),a
            ld a,(ix+$13)
            ld (ix+$21),a
            ld (ix+$23),$00
            ld (ix+$24),$00
            ret
            ld a,(ix+$18)
            jr L1A33
            ld a,(ix+$24)
            and a
            ret z
L1A4F       dec (ix+$24)
            ld a,(ix+$23)
            sub (ix+$0F)
            ld (ix+$23),a
            ret nc
            add a,(ix+$1D)
            ld (ix+$23),a
            dec (ix+$21)
            ret
            ld a,(ix+$24)
            inc a
            cp (ix+$1C)
            ret nc
            ld (ix+$24),a
            ld a,(ix+$23)
            add a,(ix+$0F)
            ld (ix+$23),a
            cp (ix+$1D)
            ret c
            sub (ix+$1D)
            ld (ix+$23),a
            inc (ix+$21)
            ret
L1A88       ld a,(ix+$22)
            add a,$08
            bit 0,(ix+$25)
            ret z
            dec a
            dec a
            ret
L1A95       ld a,(ix+$22)
            sub $08
            bit 0,(ix+$25)
            ret z
            inc a
            inc a
            ret
L1AA2       ld a,(ix+$16)
            add a,a
            add a,a
            add a,a
            inc a
            ld b,a
            ld a,(ix+$22)
            add a,$08
            bit 0,(ix+$25)
            jr z,L1AB9
            dec a
            dec a
            inc b
            inc b
L1AB9       cp b
            ret nc
            ld (ix+$22),a
            ret
            call L1A95
            ret c
            cp (ix+$17)
            ret c
            ld (ix+$22),a
            ret
            ld e,$22
            jr L1AEE
            ld e,$23
            ld (ix+$2B),a
            jr L1AF1
            ld e,$21
            jr L1AEE
            ld e,$20
            ld d,$FF
            cp e
            jr nc,L1AED
            add a,a
            ld c,a
            add a,a
            bit 0,(ix+$25)
            jr nz,L1AEB
            ld c,a
L1AEB       add a,c
            ld d,a
L1AED       ld a,d
L1AEE       ld (ix+$2D),a
L1AF1       ld (ix+$26),e
            ret
            ld h,a
            ld l,(ix+$2B)
L1AF9       push hl
            ld d,$00
            ld e,(ix+$0F)
            add hl,de
            dec hl
            ld a,h
            ld c,l
            ld h,d
            ld l,d
            ld b,$10
L1B07       rl c
            rla
            adc hl,hl
            sbc hl,de
            jr nc,L1B11
            add hl,de
L1B11       djnz L1B07
            rl c
            rla
            cpl
            and a
            jr nz,L1B7E
            ld a,c
            cpl
            pop de
            push af
            bit 4,(ix+$1D)
            ld h,$00
            jr z,L1B38
            bit 3,e
            jr z,L1B2C
            ld h,$08
L1B2C       ld a,e
            and $07
            ld l,a
            ld a,d
            rra
            ld a,e
            rra
            and $F8
            or l
            ld e,a
L1B38       ld a,e
            and $07
            add a,h
            ld h,a
            ld a,e
            rra
            rra
            rra
            and $1F
            add a,(ix+$13)
            ld l,a
            pop de
            jr L1B62
L1B4A       ld d,a
            ld b,a
            inc b
            ld l,(ix+$13)
            xor a
            ld e,(ix+$1D)
L1B54       dec b
            jr z,L1B61
            add a,(ix+$0F)
            cp e
            jr c,L1B54
            sub e
            inc l
            jr L1B54
L1B61       ld h,a
L1B62       ld a,d
            cp (ix+$1C)
            jr nc,L1B7E
            ld (ix+$24),a
            ld (ix+$21),l
            ld (ix+$23),h
            ld a,(ix+$2D)
            add a,(ix+$17)
            jr c,L1B7E
            cp (ix+$18)
            jr c,L1B83
L1B7E       ld a,$04
            jp L27AF
L1B83       ld (ix+$22),a
            ret
            ld a,(ix+$22)
            ld b,(ix+$17)
            sub b
            ld (ix+$2D),a
            ld a,(ix+$24)
            and a
            jr nz,L1BA2
            call L1A95
            sub b
            ret c
            ld (ix+$2D),a
            ld a,(ix+$1C)
L1BA2       dec a
            push af
            call L1B4A
            call L1BAD
            pop af
            jr L1B4A
L1BAD       push af
            ld a,(ix+$25)
            push af
            res 4,(ix+$25)
            ld a,$20
            call L1D6B
            pop af
            ld (ix+$25),a
            pop af
            ret
            ld l,(ix+$2D)
            ld h,a
L1BC5       ld c,(ix+$1C)
            ld b,$00
            and a
L1BCB       sbc hl,bc
            jr nc,L1BCB
            add hl,bc
            ld a,l
            ld b,(ix+$24)
            sub b
            jr nc,L1BD8
            add a,c
L1BD8       and a
            ret z
            call L1BAD
            dec a
            jr L1BD8
            ld a,(ix+$1C)
            srl a
            cp (ix+$24)
            ld l,a
            ld h,$00
            jr nc,L1BC5
            ld l,h
            jr L1BC5
            call L26F8
            jr c,L1C20
            dec a
            jr z,L1C40
            ld a,($5B64)
            and a
            jr nz,L1C07
            ld a,e
            cp $08
            jr nc,L1C75
            ld d,$F8
            jr L1C0C
L1C07       cpl
            ld d,a
            and e
            jr nz,L1C75
L1C0C       ld a,(ix+$1F)
            and d
            or e
            ld (ix+$1F),a
            ld a,$61
            bit 3,(iy+$45)
            jr z,L1C27
            ld a,$63
            jr L1C27
L1C20       ld (ix+$1F),e
            ld d,$00
            add a,$5E
L1C27       ld hl,$5C6C
L1C2A       ld b,a
            ld a,(hl)
            and d
            or e
            ld (hl),a
            bit 5,(iy+$45)
            ret z
            ld l,b
            ld h,$5B
            ld a,(hl)
            and d
            or e
            ld (hl),a
            ret
L1C3C       ld a,e
            xor $07
            ld e,a
L1C40       ld a,e
            cp $08
            jr nc,L1C75
            add a,a
            add a,a
            add a,a
            ld e,a
            ld d,$00
            or $06
            out ($FF),a
            ld a,$62
            jr L1C27
            call L26F8
            jr c,L1C89
            dec a
            jr z,L1C3C
            ld a,($5B64)
            and a
            jr nz,L1C6E
            ld a,e
            cp $08
            jr nc,L1C75
            add a,a
            add a,a
            add a,a
            ld e,a
            ld d,$C7
            jr L1C0C
L1C6E       cpl
            and a
            jr nz,L1C7A
            inc e
            dec e
            ret z
L1C75       ld a,$13
            jp L27AF
L1C7A       rra
            jr c,L1C83
            sla e
            jr nc,L1C7A
            jr L1C75
L1C83       ld a,($5B64)
            ld d,a
            jr L1C0C
L1C89       ld d,$00
            ld (ix+$20),e
            ld hl,$5C6D
            dec a
            ld a,$88
            jr z,L1C2A
            inc a
            jr L1C2A
            call L26F8
            ret c
            dec a
            ret z
            ld a,($5B64)
            and a
            ret nz
            ld a,e
            cp $02
            jr nc,L1C75
            rrca
            ld e,a
            ld d,$7F
L1CAD       jp L1C0C
            call L26F8
            ret c
            dec a
            ret z
            ld a,($5B64)
            and a
            ret nz
            ld a,e
            cp $02
            jr nc,L1C75
            rrca
            rrca
            ld e,a
            ld d,$BF
            jr L1CAD
            call L26F8
            ret c
            dec a
            ret z
            ld d,$00
            jr L1CAD
L1CD1       cp $02
            jr nc,L1C75
            rra
            ld a,$00
            sbc a,a
            ret
            call L1CD1
            ld (ix+$27),a
            and $0C
            ld d,$F3
L1CE4       bit 5,(iy+$45)
            jr nz,L1CF0
            and $05
            set 3,d
            set 1,d
L1CF0       ld e,a
            ld a,($5C91)
            and d
            or e
            ld ($5C91),a
            ret
            call L1CD1
            ld (ix+$28),a
            and $03
            ld d,$FC
            jr L1CE4
            ld e,a
            call L1A30
            ld a,(ix+$12)
            ld c,a
            ld a,e
L1D0F       ld b,(ix+$1C)
L1D12       push af
            push bc
            call L1D6B
            pop bc
            pop af
            djnz L1D12
            dec c
            jr nz,L1D0F
            ret
            res 4,(ix+$25)
            rra
            ret nc
            set 4,(ix+$25)
            ret
            res 5,(ix+$25)
            rra
            jr nc,L1D35
            set 5,(ix+$25)
L1D35       res 0,(ix+$25)
            rra
            ret nc
            set 0,(ix+$25)
            ret
L1D40       bit 5,(ix+$19)
            jp nz,L1735
L1D47       ld a,(ix+$26)
            and a
            jr nz,L1D5A
            ld a,e
            cp $20
            jr nc,L1D6B
            cp $10
            jr c,L1D5E
            ld (ix+$26),a
            ret
L1D5A       ld (ix+$26),$00
L1D5E       ld hl,$1604
L1D61       add hl,a
            add hl,a
            ld c,(hl)
            inc hl
            ld h,(hl)
            ld l,c
            ld a,e
            jp (hl)
L1D6B       ld h,$00
            ld l,a
            add hl,hl
            add hl,hl
            add hl,hl
            cp $80
            jr c,L1DAD
            cp $90
            jr nc,L1D93
            ld e,a
            ld hl,$F350
            push hl
            ld a,(ix+$0F)
            ld c,a
            srl c
            sub c
            ld b,a
            dec b
            dec c
            push bc
            call L22BD
            pop bc
            call L22BD
            pop hl
            jr L1DE6
L1D93       call L2B3E
            ld bc,$1D6B
            jp c,L2B5B
            res 1,(ix+$25)
            ld de,(UDG)
            add hl,de
            ld de,$0480
            and a
            sbc hl,de
            jr L1DC6
L1DAD       res 1,(ix+$25)
            cp $20
            jr nz,L1DB9
            set 1,(ix+$25)
L1DB9       ld c,(ix+$0D)
            ld b,(ix+$0E)
            add hl,bc
            bit 2,(ix+$19)
            jr z,L1DE6
L1DC6       ld a,h
            cp $BF
            jr c,L1DE6
            sub $40
            ld h,a
            push hl
            ld d,$54
            call L27B5
            ex (sp),hl
            ld de,$F350
            ld bc,$0008
            ldir
            pop hl
            ld d,$54
            call L27BD
            ld hl,$F350
L1DE6       ld a,(ix+$24)
            bit 4,(ix+$25)
            jr z,L1DF0
            inc a
L1DF0       cp (ix+$1C)
            call nc,L2043
            ld a,(ix+$25)
            and $30
            jp z,L1EAC
            bit 4,a
            jr z,L1E6A
            ex de,hl
            ld hl,$F330
            ld b,$08
L1E08       push bc
            ld b,(ix+$0F)
            srl b
            jr c,L1E2B
            push bc
            ld (hl),$01
            ld a,(de)
L1E14       rla
            push af
            rl (hl)
            pop af
            rl (hl)
            djnz L1E14
            jr c,L1E23
L1E1F       rl (hl)
            jr nc,L1E1F
L1E23       ld bc,$0008
            add hl,bc
            ld (hl),$01
            jr L1E47
L1E2B       push bc
            ld (hl),$01
            ld a,(de)
L1E2F       rla
            push af
            rl (hl)
            pop af
            rl (hl)
            djnz L1E2F
            rla
            push af
L1E3A       rl (hl)
            jr nc,L1E3A
            ld bc,$0008
            add hl,bc
            ld (hl),$01
            pop af
            rl (hl)
L1E47       pop bc
L1E48       rla
            push af
            rl (hl)
            pop af
            rl (hl)
            djnz L1E48
            jr c,L1E57
L1E53       rl (hl)
            jr nc,L1E53
L1E57       ld bc,$0007
            and a
            sbc hl,bc
            inc de
            pop bc
            djnz L1E08
            ld hl,$F330
            call L1E6A
            ld hl,$F338
L1E6A       bit 5,(ix+$25)
            jr z,L1EAC
            ex de,hl
            ld hl,$F340
            ld b,$08
L1E76       ld a,(de)
            inc de
            ld (hl),a
            inc hl
            ld (hl),a
            inc hl
            djnz L1E76
            ld hl,$F340
            bit 0,(ix+$25)
            jr z,L1E88
            inc hl
L1E88       call L1EAC
            call L1A4F
            ld hl,$F348
            ld a,(ix+$22)
            add a,$08
            bit 0,(ix+$25)
            jr z,L1E9F
            dec a
            dec a
            dec hl
L1E9F       ld (ix+$22),a
            call L1EAC
            call L1A95
            ld (ix+$22),a
            ret
L1EAC       push hl
            ld b,(ix+$18)
            inc b
            call L1A88
            cp b
            jr c,L1EC2
            ld a,(ix+$22)
            sub $08
            ld (ix+$22),a
            call L2071
L1EC2       call L26F9
            jp c,L1FE4
            ld a,(ix+$21)
            ld d,(ix+$22)
            call L22AC
            bit 3,(ix+$1E)
            ld b,(ix+$1F)
            jr nz,L1F0D
            ex af,af'
            ld (hl),b
            ld a,(ix+$23)
            add a,(ix+$0F)
            cp $09
            jr c,L1EE9
            inc hl
            ld (hl),b
            dec hl
L1EE9       ld a,(ix+$22)
            and $07
            jr z,L1F17
            bit 0,(ix+$25)
            jr z,L1EFA
            cp $03
            jr c,L1F17
L1EFA       add hl,$0020
            ld (hl),b
            ld a,(ix+$23)
            add a,(ix+$0F)
            cp $09
            jr c,L1F17
            inc hl
            ld (hl),b
            jr L1F17
L1F0D       ld a,b
            ex af,af'
            bit 3,(ix+$23)
            jr z,L1F17
            set 7,d
L1F17       ex de,hl
            exx
            ex (sp),hl
            push bc
            push de
            ld b,$08
            bit 0,(ix+$25)
            jr z,L1F27
            dec b
            dec b
            inc hl
L1F27       ld e,(ix+$27)
            ld d,xl
            ld c,(ix+$10)
            ld a,c
            exx
            cpl
            or (ix+$28)
            ld d,a
            ld b,(ix+$23)
            res 3,b
            ld a,(ix+$1E)
            cp $0D
            jr z,L1F4B
            ld a,b
            add a,(ix+$0F)
            cp $09
            jp c,L1FB3
L1F4B       ld e,$FF
            bsrf de,b
            ld c,d
            ld xl,e
            exx
L1F53       ld a,(hl)
            inc hl
            xor e
            and c
            exx
            ld d,a
            ld e,$00
            bsrl de,b
            ex af,af'
            jr z,L1F9A
            ex af,af'
            bit 2,(iy+$45)
            jr nz,L1F7D
            push hl
            ld a,c
            and (hl)
            xor d
            ld (hl),a
            bit 7,h
            set 7,h
            jr z,L1F75
            res 7,h
            inc hl
L1F75       ld a,xl
            and (hl)
            xor e
            ld (hl),a
            pop hl
            jr L1FA6
L1F7D       ld a,c
            and (hl)
            xor d
            ld (hl),a
            inc hl
            ld a,xl
            and (hl)
            xor e
            ld (hl),a
            dec hl
            set 7,h
            ex af,af'
            ld (hl),a
            ex af,af'
            inc b
            dec b
            jr z,L1F96
            inc hl
            ex af,af'
            ld (hl),a
            ex af,af'
            dec hl
L1F96       res 7,h
            jr L1FA6
L1F9A       ex af,af'
            ld a,c
            and (hl)
            xor d
            ld (hl),a
            inc hl
            ld a,xl
            and (hl)
            xor e
            ld (hl),a
            dec hl
L1FA6       pixeldn
            exx
            djnz L1F53
            ld xl,d
            pop de
            pop bc
            pop hl
            exx
            jr L1FCC
L1FB3       bsrf de,b
            ld c,d
            exx
L1FB7       ld a,(hl)
            inc hl
            xor e
            and c
            exx
            ld d,a
            bsrl de,b
            ld a,c
            and (hl)
            xor d
            ld (hl),a
            pixeldn
            exx
            djnz L1FB7
            pop de
L1FC9       pop bc
            pop hl
            exx
L1FCC       inc (ix+$24)
            ld a,(ix+$23)
            add a,(ix+$0F)
            cp (ix+$1D)
            jr c,L1FE0
            sub (ix+$1D)
            inc (ix+$21)
L1FE0       ld (ix+$23),a
            ret
L1FE4       ld a,(ix+$21)
            add a,a
            add a,a
            add a,a
            add a,(ix+$23)
            ld l,a
            ld h,(ix+$22)
            call L268F
            ld a,c
            sub (ix+$0F)
            inc a
            ld c,a
            ld d,(ix+$1F)
            ld e,(ix+$20)
            bit 0,(ix+$27)
            jr z,L2009
            ld a,d
            ld d,e
            ld e,a
L2009       exx
            ex (sp),hl
            push bc
            ld b,$08
            bit 0,(ix+$25)
            jr z,L2017
            ld b,$06
            inc hl
L2017       ld a,(hl)
            inc hl
            exx
            push bc
            ld b,(ix+$0F)
            bit 0,(ix+$28)
            jr nz,L203A
L2024       rla
            ld (hl),d
            jr c,L2029
            ld (hl),e
L2029       inc hl
            djnz L2024
L202C       pop bc
            ld a,c
            add hl,a
            ld a,h
            cp b
            call nc,L26D6
            exx
L2036       djnz L2017
            jr L1FC9
L203A       rla
            jr nc,L203E
            ld (hl),d
L203E       inc hl
            djnz L203A
            jr L202C
L2043       xor a
            ld (ix+$23),a
            ld (ix+$24),a
            ld a,(ix+$13)
            ld (ix+$21),a
            bit 5,(ix+$25)
            call nz,L2057
L2057       push hl
            call L1A88
            ld (ix+$22),a
            ld a,(ix+$18)
            cp (ix+$22)
            call c,L2069
            pop hl
            ret
L2069       ld a,(ix+$22)
            sub $08
            ld (ix+$22),a
L2071       ld a,(ix+$1A)
            and a
            jr z,L208E
            dec (ix+$1B)
            jr nz,L208E
            ld (ix+$1B),a
            ld hl,$2178
            call L2160
            call L2118
            call L11E0
            call L2118
L208E       ld hl,$2181
            call L2160
            ld e,$01
            call L20CE
            call L209D
            ret
L209D       call L215D
            ld c,(ix+$11)
            ld b,$01
            push bc
            ld h,(ix+$16)
            jr L20DB
            ld (ix+$1A),a
            ld (ix+$1B),a
            ret
            ld hl,$2172
            jr L20C9
            call L1A30
            ld a,$01
            ld (ix+$1B),a
            ld hl,$2169
            jr L20C9
            push hl
            call L1942
            pop hl
L20C9       call L2160
            ld e,$00
L20CE       ld c,(ix+$11)
            ld a,(ix+$12)
            sub e
            ld b,a
            ret z
            push bc
            ld h,(ix+$14)
L20DB       ld l,(ix+$13)
L20DE       add hl,hl
            add hl,hl
            add hl,hl
            call L26F9
            jr c,L2124
            ex de,hl
            call L22B0
            pop bc
            push bc
L20EC       push bc
            ld b,$00
            bit 3,(iy+$45)
            call z,L5B91
            pop bc
            djnz L20EC
            pop bc
L20FA       push bc
            ld b,$00
            ld l,e
            ld a,d
            or $07
            ld h,a
            pixeldn
            push hl
            ld a,$08
L2107       push af
            push de
            call L5B94
            pop de
            pop af
            inc h
            inc d
            dec a
            jr nz,L2107
            pop de
            pop bc
            djnz L20FA
            ret
L2118       ld bc,$0101
            push bc
            ld h,(ix+$16)
            ld l,(ix+$15)
            jr L20DE
L2124       ld ($5B8C),ix
            ld a,(ix+$20)
            ld ($5B9A),a
            call L268E
            pop de
            ld a,e
            add a,a
            add a,a
            ld xl,a
            ld xh,$00
            add ix,ix
L213C       ld e,$08
L213E       push de
            push hl
            call L5B97
            pop hl
            ld a,b
            ld b,$00
            add hl,bc
            inc hl
            ld b,a
            pop de
            dec e
            jr nz,L213E
            ld a,h
            cp b
            call nc,L26D5
            dec d
            jr nz,L213C
            ld ix,($5B8C)
            jp L1942
L215D       ld hl,$2169
L2160       ld de,$5B91
            ld bc,$0009
            ldir
            ret
            jp L21A1
            jp L21D3
            jp L223B
            jp L21A1
            jp L21F1
            ret
            nop
            nop
            jp L220C
            jp L2251
            jp L2193
            jp L21BB
            jp L221F
            jp L21B2
            jp L21FB
            jp L2246
L2193       push de
            ex de,hl
            ld hl,$0020
            add hl,de
            push hl
            push bc
            ldir
            pop bc
            pop hl
            pop de
            ret
L21A1       ld a,(ix+$1F)
            ld b,c
L21A5       ld (hl),a
            inc hl
            djnz L21A5
L21A9       ld a,$20
            sub c
            add a,l
            ld l,a
            ld a,b
            adc a,h
            ld h,a
            ret
L21B2       push de
            ex de,hl
            call L225B
            ex de,hl
            pop de
            jr L21A9
L21BB       push hl
            push de
            push bc
            ldir
            pop bc
            pop de
            pop hl
            bit 3,(ix+$1E)
            ret z
            push hl
            push bc
            set 7,h
            set 7,d
            ldir
            pop bc
            pop hl
            ret
L21D3       push de
            ld b,c
            xor a
L21D6       ld (de),a
            inc de
            djnz L21D6
            pop de
            bit 3,(ix+$1E)
            ret z
            bit 2,(ix+$1E)
            jr z,L21E9
L21E6       ld a,(ix+$1F)
L21E9       ld b,c
            set 7,d
L21EC       ld (de),a
            inc de
            djnz L21EC
            ret
L21F1       ld a,(ix+$1E)
            and $0C
            cp $0C
            ret nz
            jr L21E6
L21FB       push hl
            push de
            call L225B
            pop de
            set 7,d
            bit 3,(iy+$45)
            call nz,L225E
            pop hl
            ret
L220C       ld a,(ix+$1E)
            and $0C
            cp $08
            jr nz,L2217
            set 7,d
L2217       ld b,c
L2218       ld a,(de)
            cpl
            ld (de),a
            inc de
            djnz L2218
            ret
L221F       ex de,hl
            ld h,$00
            ld l,c
            inc hl
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,de
            bit 7,c
            jr nz,L2233
            ld a,h
            cp b
            jr c,L2233
            add a,$68
            ld h,a
L2233       push bc
            push ix
            pop bc
            ldir
            pop bc
            ret
L223B       ld a,($5B9A)
            ld e,xl
L2240       ld (hl),a
            inc hl
            dec e
            jr nz,L2240
            ret
L2246       push bc
            ld b,$00
            ld c,xl
            ex de,hl
            call L225B
            pop bc
            ret
L2251       ld d,xl
L2253       ld a,(hl)
            cpl
            ld (hl),a
            inc hl
            dec d
            jr nz,L2253
            ret
L225B       ld hl,($5B9B)
L225E       ld a,(iy+$58)
            bit 7,a
            jr z,L2266
            ex de,hl
L2266       and $07
            jr z,L229B
            dec a
            jr z,L227D
            dec a
            jr z,L2287
            dec a
            jr z,L2291
            ld a,($5C93)
            push bc
            dec c
            inc bc
            ldirx
            jr L22A0
L227D       ld b,c
L227E       ld a,(de)
            and (hl)
            ld (de),a
            inc hl
            inc de
            djnz L227E
            jr L22A1
L2287       ld b,c
L2288       ld a,(de)
            or (hl)
            ld (de),a
            inc hl
            inc de
            djnz L2288
            jr L22A1
L2291       ld b,c
L2292       ld a,(de)
            xor (hl)
            ld (de),a
            inc hl
            inc de
            djnz L2292
            jr L22A1
L229B       push bc
            dec c
            inc bc
            ldir
L22A0       pop bc
L22A1       bit 7,(iy+$58)
            jr z,L22A8
            ex de,hl
L22A8       ld ($5B9B),hl
            ret
L22AC       add a,a
            add a,a
            add a,a
            ld e,a
L22B0       pixelad
            ld a,d
            rlca
            rlca
            and $03
            or $58
            ld d,a
            ld e,l
            ex de,hl
            ret
L22BD       xor a
            srl e
            rra
L22C1       sra a
            dec c
            jr nz,L22C1
            srl e
            rra
L22C9       sra a
            djnz L22C9
            ld b,$04
L22CF       ld (hl),a
            inc hl
            djnz L22CF
            ret
L22D4       cp $03
            jr c,L22ED
            cp $09
            jr nc,L22ED
            ld hl,$EC00
            cp $05
            ret c
            ld h,$EF
            cp $07
            ret c
            ld h,$F7
            ret z
            ld h,$FB
            ret
L22ED       ld a,$0A
            jp L27AF
            nop
            ei
            ex af,af'
            rst $38
            djnz L2304
            nop
            nop
            rrca
            dec bc
            nop
            ld h,b
            djnz L230C
            ld bc,$0810
            ld bc,$FF00
            nop
            ei
            ex af,af'
            rst $38
            jr nz,L2324
L230C       nop
            nop
            rra
            rla
            nop
            ret nz
            djnz L232C
            ld bc,$0820
            ld (bc),a
            nop
            rst $38
            ld b,b
            djnz L2326
            nop
            nop
            jr nz,L2329
            dec b
            jr c,L2324
L2324       jr nz,L232E
L2326       dec c
            jr c,L2329
L2329       push $2386
            ld e,b
L232E       ld d,$54
            call L270A
            dec e
            jr z,L2372
            ld hl,$A000
            ld de,$A001
            ld bc,$0151
            ld (hl),l
            ldir
            ld a,(YLOC)
            inc a
            add a,a
            ld ($A050),a
            ld a,$10
            ld ($A051),a
            ld hl,$FFFF
            ld ($A000),hl
            ld ($A028),hl
            ld a,l
            ld ($A002),a
            ld ($A02A),a
            ld hl,$3FF7
            ld ($A020),hl
            ld ($A048),hl
            ld hl,$0001
            rst $20
            cp l
            ld bc,$327B
            ld e,b
            ld e,e
L2372       ld hl,$3D00
            ld de,$BC00
            ld bc,$0300
            rst $28
            jp LCD33
            sbc a,e
            inc hl
            ld d,$54
            jp L2799
            call L2708
            call L264D
            ld hl,$F700
            call L0F54
            ld hl,$FB00
            call L0F54
            jp L2797
L239B       ld hl,$BC00
            ld de,$B800
            ld bc,$0003
L23A4       ld a,(hl)
            inc hl
            add a,a
            ld (de),a
            inc de
            djnz L23A4
            dec c
            jr nz,L23A4
            push ix
            ld ix,$2632
            ld hl,$23F2
            ld de,$AD00
            ld b,$60
L23BC       ld c,$08
L23BE       xor a
            bit 3,c
            jr nz,L23DA
            ld a,c
            dec a
            jr nz,L23D8
            ld a,b
            cp (ix)
            ld a,$00
            jr nz,L23DA
            inc ix
            ld a,(ix)
            inc ix
            jr L23DA
L23D8       ld a,(hl)
            inc hl
L23DA       push af
            and $E0
            ld (de),a
            inc d
            inc d
            inc d
            pop af
            add a,a
            add a,a
            add a,a
            ld (de),a
            dec d
            dec d
            dec d
            inc de
            dec c
            jr nz,L23BE
            djnz L23BC
            pop ix
            ret
            nop
            nop
            nop
            nop
            nop
            nop
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            nop
            ld b,h
            xor d
            xor d
            nop
            nop
            nop
            nop
            xor d
            rst $38
            xor d
            xor d
            rst $38
            xor d
            ld b,d
            rst $28
            adc a,d
            rst $28
            inc hl
            rst $28
            xor c
            ld hl,$4442
            adc a,b
            xor c
            ld c,b
            or h
            ld c,b
            or d
            ld b,d
            add a,h
            nop
            nop
            nop
            nop
            ld b,d
            add a,h
            add a,h
            add a,h
            add a,h
            ld b,d
            add a,h
            ld b,d
            ld b,d
            ld b,d
            ld b,d
            add a,h
            nop
            xor d
            ld b,h
            xor $44
            xor d
            nop
            ld b,h
            ld b,h
            xor $44
            ld b,h
            nop
            nop
            nop
            nop
            ld b,d
            add a,h
            nop
            nop
            nop
            adc a,$00
            nop
            nop
            nop
            nop
            nop
            nop
            ld b,h
            ld ($4422),hl
            ld b,h
            adc a,b
            adc a,b
            ld b,(hl)
            xor c
            xor c
            xor c
            xor c
            ld b,(hl)
            ld b,d
            add a,$42
            ld b,d
            ld b,d
            ld b,a
            ld b,(hl)
            xor c
            ld hl,$8846
            rst $28
            add a,$29
            jp nz,L2921
            add a,$22
            ld h,d
            and (hl)
            xor d
            rst $28
            ld ($88EF),hl
            adc a,$21
            add hl,hl
            add a,$66
            adc a,b
            adc a,$A9
            xor c
            ld b,(hl)
            rst $28
            ld hl,$4442
            add a,h
            add a,h
            ld b,(hl)
            xor c
            ld b,(hl)
            xor c
            xor c
            ld b,(hl)
            ld b,(hl)
            xor c
            xor c
            ld h,a
            ld hl,$00C6
            ld b,h
            nop
            nop
            ld b,h
            nop
            nop
            ld b,h
            nop
            nop
            ld b,h
            adc a,b
            nop
            ld ($8844),hl
            ld b,h
            ld ($0000),hl
            adc a,$00
            adc a,$00
            nop
            adc a,b
            ld b,h
            ld ($8844),hl
            ld b,(hl)
            xor c
            ld hl,$0042
            ld b,d
            ld b,(hl)
            rst $28
            xor l
            jp pe,LE788
            ld b,(hl)
            xor c
            xor c
            rst $28
            xor c
            xor c
            adc a,$A9
            adc a,$A9
            xor c
            adc a,$46
            xor c
            adc a,b
            adc a,b
            xor c
            ld b,(hl)
            adc a,$A9
            xor c
            xor c
            xor c
            adc a,$EF
            adc a,b
            adc a,$88
            adc a,b
            rst $28
            rst $28
            adc a,b
            xor $88
            adc a,b
            adc a,b
            ld b,(hl)
            xor c
            adc a,b
            ex de,hl
            xor c
            ld b,a
            xor c
            xor c
            rst $28
            xor c
            xor c
            xor c
            xor $44
            ld b,h
            ld b,h
            ld b,h
            xor $21
            ld hl,$A121
            xor c
            ld b,(hl)
            xor c
            xor d
            call z,LA9CA
            xor c
            adc a,b
            adc a,b
            adc a,b
            adc a,b
            adc a,b
            rst $28
            or c
            ei
            or l
            or c
            or c
            or c
            jp (hl)
            xor l
            xor l
            xor e
            xor e
            xor c
            ld b,(hl)
            xor c
            xor c
            xor c
            xor c
            ld b,(hl)
            adc a,$A9
            xor c
            adc a,$88
            adc a,b
            and $A9
            xor c
            xor l
            ex de,hl
            rst $20
            xor $A9
            xor c
            adc a,$C9
            xor c
            ld h,a
            adc a,b
            ld b,(hl)
            ld hl,$C629
            xor $44
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            xor c
            xor c
            xor c
            xor c
            xor c
            and $AA
            xor d
            xor d
            xor d
            xor d
            ld b,h
            or c
            or c
            pop af
            push af
            ei
            ld d,c
            xor d
            xor d
            ld b,h
            ld b,h
            xor d
            xor d
            xor d
            xor d
            xor d
            ld b,h
            ld b,h
            ld b,h
            rst $28
            ld hl,$4442
            adc a,b
            rst $28
            add a,$84
            add a,h
            add a,h
            add a,h
            add a,$00
            adc a,b
            ret z
            ld b,h
            ld h,d
            ld ($2266),hl
            ld ($2222),hl
            ld h,(hl)
            ld b,h
            xor $44
            ld b,h
            ld b,h
            ld b,h
            nop
            nop
            nop
            nop
            nop
            nop
            ld b,(hl)
            xor c
            adc a,b
            xor $88
            rst $28
            nop
            add a,$21
            ld h,a
            xor c
            ld b,a
            adc a,b
            adc a,b
            adc a,$A9
            xor c
            adc a,$00
            ld h,a
            adc a,b
            adc a,b
            adc a,b
            ld h,a
            ld hl,$6721
            xor c
            xor c
            ld h,a
            nop
            ld b,(hl)
            xor c
            adc a,$88
            ld h,a
            ld h,(hl)
            adc a,b
            call z,L8888
            adc a,b
            nop
            ld h,a
            xor c
            xor c
            ld h,a
            ld hl,$8888
            adc a,$A9
            xor c
            xor c
            ld b,h
            nop
            ld c,h
            ld b,h
            ld b,h
            ld c,(hl)
            ld hl,$2100
            ld hl,$A921
            adc a,b
            xor d
            call z,LAACC
            xor c
            ld c,b
            ld c,b
            ld c,b
            ld c,b
            ld c,b
            ld b,(hl)
            nop
            cp d
            push af
            or l
            or l
            or l
L25C6       nop
            adc a,$A9
            xor c
            xor c
            xor c
            nop
            ld b,(hl)
            xor c
            xor c
            xor c
            ld b,(hl)
            nop
            adc a,$A9
            xor c
            adc a,$88
            nop
            ld h,a
            xor c
            xor c
            ld h,a
            ld hl,$6700
            adc a,b
            adc a,b
            adc a,b
            adc a,b
            nop
            ld h,a
            adc a,b
            ld b,(hl)
            ld hl,$44CE
            xor $44
            ld b,h
            ld b,h
            ld b,e
            nop
            xor c
            xor c
            xor c
            xor c
            and $00
            xor d
            xor d
            xor d
            xor d
            ld b,h
            nop
            or c
            or l
            push af
            push af
            ld c,d
            nop
            xor d
            xor d
            ld b,h
            xor d
            xor d
            nop
            xor c
            xor c
            xor c
            ld h,a
            ld hl,$EF00
            ld hl,$8442
            rst $28
            ld h,(hl)
            ld b,h
            adc a,b
            ld b,h
            ld b,h
            ld h,(hl)
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            ld b,h
            call z,L2244
            ld b,h
            ld b,h
            call z,LAA45
            nop
            nop
            nop
            nop
            xor $B1
            di
            or l
            di
            or c
            ld e,h
            ld b,d
            cpl
            jr nz,L2658
            rst $38
            add hl,de
            add a,$16
            ld b,(hl)
            djnz L25C6
            rrca
            ld hl,$C607
            ld bc,$CDEE
            ex af,af'
            daa
            call L264D
            jp L2797
L264D       ld hl,$22F2
            ld de,$F30D
            ld bc,$0014
            ldir
L2658       call L2686
            ld de,$F40D
            ld bc,$2315
            call L2673
            ld de,$FB0D
            call L2673
            ld de,$F70D
            call L2673
            ld de,$FF0D
L2673       push hl
            push bc
            ld bc,$000F
            ldir
            pop hl
            ld c,$05
            ldir
            call L2686
            ld b,h
            ld c,l
            pop hl
            ret
L2686       ld b,$0F
            xor a
L2689       ld (de),a
            inc de
            djnz L2689
            ret
L268E       scf
L268F       bit 1,(iy+$45)
            jr z,L26C1
            push de
            push af
            ld a,h
            rlca
            rlca
            rlca
            and $07
            ld e,a
            ld a,h
            and $1F
            or $C0
            ld h,a
            ld bc,$243B
            ld d,$13
            out (c),d
            inc b
            in a,(c)
            add a,a
            add a,e
            ld e,a
            nextreg $56,a
            pop af
            jr nc,L26BC
            ld a,e
            inc a
            nextreg $57,a
L26BC       pop de
            ld bc,$E0FF
            ret
L26C1       srl h
            jr nc,L26C7
            set 7,l
L26C7       set 6,h
            ld bc,$587F
            ld a,h
            cp b
            ret c
            add a,$68
            ld h,a
            ld b,$D8
            ret
L26D5       scf
L26D6       bit 7,c
            jr z,L26F1
            res 5,h
            ld a,$56
L26DE       push bc
            ld bc,$243B
            out (c),a
            inc b
            in a,(c)
            inc a
            out (c),a
            pop bc
            ret nc
            ld a,$57
            and a
            jr L26DE
L26F1       ld a,h
            add a,$68
            ld h,a
            ld b,$D8
            ret
L26F8       ld e,a
L26F9       ld a,($5C7F)
            and $0F
            ret z
            cp $03
            ret c
            srl a
            srl a
            dec a
            ret
L2708       ld d,$56
L270A       pop bc
            ld hl,$0000
            add hl,sp
            ld a,h
            cp $5C
            jr c,L271C
            ld hl,(OLDSP)
            ld (OLDSP),sp
            ld sp,hl
L271C       ld ($5B8E),a
            push bc
            call L27BA
            ld ($5B8A),hl
            ret
L2727       ld e,$80
            jr L272D
L272B       ld e,$FF
L272D       ld ($5B8F),hl
            call L2708
            call L279E
            ld hl,($5B8F)
            ld d,$FF
            bit 7,e
            jr nz,L2742
            ld d,e
            ld e,$FF
L2742       ld a,(hl)
            inc hl
            cp e
            jr c,L274E
            ld d,$01
            inc e
            jr z,L276E
            res 7,a
L274E       push hl
            push de
            ld e,a
            call L1D40
            pop de
            pop hl
            dec d
            jr nz,L2742
            jr L276E
L275B       ld e,a
            call L2708
            call L279E
            call L1D40
            jr L276E
L2767       ld e,a
            call L2708
            call L1D47
L276E       ld hl,($5B8A)
            ld a,l
            nextreg $56,a
            ld a,h
            nextreg $57,a
L2779       ld a,($5B8E)
            cp $5C
            ret c
            ld hl,(OLDSP)
            ld (OLDSP),sp
            ld sp,hl
            ret
L2788       ld a,b
            or c
            ret z
            ld a,(de)
            push bc
            push de
            call L275B
            pop de
            pop bc
            inc de
            dec bc
            jr L2788
L2797       ld d,$56
L2799       call L27B5
            jr L2779
L279E       ld a,(iy+$45)
            and $0F
            cp (ix+$1E)
            ret z
            xor (ix+$1E)
            cp $05
            ret z
            ld a,$5E
L27AF       rst $30
L27B0       rst $18
            and l
            dec c
L27B3       ld d,$56
L27B5       ld hl,($5B8A)
            jr L27BD
L27BA       ld hl,$100B
L27BD       push bc
            ld bc,$243B
            out (c),d
            inc b
            in a,(c)
            out (c),l
            ld l,a
            dec b
            inc d
            out (c),d
            inc b
            in a,(c)
            out (c),h
            ld h,a
            pop bc
            ret
L27D5       set 7,(iy+$37)
            and a
            jr z,L27DF
            ld c,a
            ld b,$00
L27DF       bit 7,b
            jr z,L27F2
            ld ix,$0000
            ld a,(iy+$45)
            and $0F
            jr z,L27F2
            add a,$F2
            ld xh,a
L27F2       ld a,c
            and a
            ret z
            ld a,e
            bit 2,b
            jr z,L27FB
            ld a,d
L27FB       ld ($5B9A),a
            ld ($5B8F),hl
            ld hl,$5C71
            ld a,(hl)
            and $E3
            ld (hl),a
            ld a,b
            and $10
            or (hl)
            ld (hl),a
            ld a,b
            add a,a
            add a,a
            and $0C
            or (hl)
            ld (hl),a
            ld a,b
            swapnib
            and $06
            ld b,a
            ld hl,$5C3C
            ld a,(hl)
            and $F9
            or b
            ld (hl),a
            ld b,e
            ld a,c
            cp b
            jr nc,L2828
            ld b,c
L2828       ld ($5B9B),bc
            call L2708
            inc xh
            dec xh
            call nz,L279E
            ld (ix+$1B),$00
            ld a,($5B9A)
            ld d,a
            ld hl,$5C71
            bit 4,(hl)
            res 4,(hl)
            ld bc,($5B9B)
            ld hl,($5B8F)
            jr z,L2854
            call L2AF9
            call nz,L2A85
L2854       ld a,$0D
            ld ($5B9B),a
            inc b
            dec b
            jr nz,L286D
            ld a,($5C71)
            and $C0
            jr nz,L286D
            ld (hl),$22
            inc hl
            ld (hl),$22
            dec hl
            inc d
            ld b,$02
L286D       xor a
            push af
L286F       ld hl,($5B8F)
            ld e,$00
            ld a,d
            call L2AEB
            bit 4,(iy+$37)
            call z,L2AA9
            ld a,b
            sub d
            call L2AEB
            pop af
            sub e
            call nc,L2A76
            bit 4,(iy+$37)
            jr nz,L28BE
            push bc
            push de
            call L1255
            pop de
            pop bc
            ld hl,$2941
            call L15A1
            jr z,L28B0
            cp $20
            jr nc,L28EA
            ld hl,$5C71
            bit 3,(hl)
            jr z,L28B7
            ld ($5B9B),a
            set 4,(hl)
            res 2,(hl)
L28B0       push bc
            push de
            call nc,L3E18
            pop de
            pop bc
L28B7       ld a,e
            push af
            call L2A85
            jr L286F
L28BE       ld e,b
            ld a,(ix+$18)
            sub (ix+$22)
            srl a
            srl a
            srl a
            ld b,a
            ld a,(ix+$1A)
            sub b
            inc a
            ld (ix+$1B),a
            ld a,(iy+$37)
            rra
            rra
            and $03
            ld b,a
            ld a,($5B9B)
            ld c,a
            push de
            ld d,$56
            call L27B5
            pop de
            jp L2779
L28EA       push af
            cp $20
            jr nz,L28F7
            ld a,$FE
            in a,($FE)
            rra
            call nc,L292A
L28F7       pop af
            ld h,a
            cp $80
            jr c,L2903
            bit 1,(iy+$02)
            jr z,L28B7
L2903       ld a,b
            cp c
            jr nc,L28B0
            push hl
            ld hl,($5B8F)
            ld a,d
            add hl,a
            inc b
            inc d
            ld a,c
            sub d
            jr z,L2923
            push bc
            push de
            push hl
            ld c,a
            ld b,$00
            add hl,bc
            ld d,h
            ld e,l
            dec hl
            lddr
            pop hl
L2921       pop de
            pop bc
L2923       pop af
            ld (hl),a
            call L29D2
            jr L28B7
L292A       bit 2,(iy+$02)
            ret z
            rst $18
            ld (hl),l
            ld a,$C0
            call L27B3
            ld hl,(OLDSP)
            ld (OLDSP),sp
            ld sp,hl
            rst $18
            ld e,$00
            nop
            and (hl)
            add hl,hl
            inc bc
            ld h,(hl)
            ld hl,($FA04)
            add hl,hl
            dec b
            dec d
            ld hl,($7507)
            add hl,hl
            ex af,af'
            ld a,d
            add hl,hl
            add hl,bc
            add a,b
            add hl,hl
            ld a,(bc)
            sub (hl)
            add hl,hl
            dec bc
            add a,(hl)
            add hl,hl
            inc c
            or a
            add hl,hl
            dec c
            add ix,ix
            djnz L29D1
            ld hl,($7011)
            ld hl,($B318)
            add hl,hl
            dec de
            jr nc,L2998
            inc e
            ld c,e
            ld hl,($AC1D)
            add hl,hl
            rst $38
            ld b,$00
            ld d,b
            scf
            ret
L297A       dec d
            scf
            ret p
            inc d
            and a
            ret
L2980       ld a,d
            cp b
            ret z
            inc d
            scf
            ret
            call L297A
            ret nc
            call L16AE
            sbc a,d
            neg
            ld d,$00
            scf
            ret m
            ld d,a
            ret
            call L2980
            ret nc
            call L16AE
            add a,d
            dec a
            ld d,b
            cp b
            ccf
            ret c
            scf
            ld d,a
            ret
            ld a,d
            cp b
            ret z
            ld d,b
            scf
            ret
            ld a,d
            and a
            ret z
            ld d,$00
            scf
            ret
L29B3       ld a,d
            cp b
            ret z
            inc d
L29B7       ld a,d
            and a
            ret z
            push bc
            push de
            ld hl,($5B8F)
            add hl,a
            ld d,h
            ld e,l
            dec de
            ld a,b
            sub d
            jr z,L29CD
            ld c,b
            ld b,$00
            ldir
L29CD       pop de
            pop bc
            dec b
            dec d
L29D1       scf
L29D2       ld hl,$5C71
            bit 2,(hl)
            ret z
L29D8       set 4,(hl)
            res 3,(hl)
            ret
            ld hl,$5C71
            res 2,(hl)
            scf
            jr L29D8
L29E5       ld hl,($5B8F)
            ld a,d
            add hl,a
            dec hl
            ld a,(hl)
            cp $20
            ret
L29F0       ld hl,($5B8F)
            ld a,d
            add hl,a
            ld a,(hl)
            cp $20
            ret
            ld a,d
            and a
            ret z
L29FD       call L29E5
            jr nz,L2A09
            call L297A
            jr c,L29FD
            scf
            ret
L2A09       call L29E5
            scf
            ret z
            call L297A
            jr c,L2A09
            scf
            ret
            ld a,d
            cp b
            ret z
L2A18       call L29F0
            jr z,L2A24
            call L2980
            jr c,L2A18
            scf
            ret
L2A24       call L29F0
            scf
            ret nz
            call L2980
            jr c,L2A24
            scf
            ret
            ld a,d
            and a
            ret z
L2A33       call L29E5
            jr nz,L2A3F
            call L29B7
            jr c,L2A33
            scf
            ret
L2A3F       call L29E5
            scf
            ret z
            call L29B7
            jr c,L2A3F
            scf
            ret
            ld a,d
            cp b
            ret z
L2A4E       call L29F0
            jr z,L2A5A
            call L29B3
            jr c,L2A4E
            scf
            ret
L2A5A       call L29F0
            scf
            ret nz
            call L29B3
            jr c,L2A5A
            scf
            ret
L2A66       call L29B7
            ccf
            ret c
            jr L2A66
            ld b,d
            scf
            ret
            call L0068
            and b
            inc de
            ret
L2A76       ret z
            push de
            ld e,a
            push de
            ld a,$20
            call L2A9E
            pop de
            call L2A85
            pop de
            ret
L2A85       inc e
            dec e
            ret z
            inc xh
            dec xh
            ld a,$08
            jr z,L2A9E
            ld (ix+$28),$FF
            ld a,$0C
            call L2A9E
            ld (ix+$28),$00
            ret
L2A9E       push af
            push de
            call L2B12
            pop de
            pop af
            dec e
            jr nz,L2A9E
            ret
L2AA9       push hl
            push de
            push bc
            call L2AD9
            call L2AE8
            sub $90
            add a,a
            add a,a
            add a,a
            ld bc,$0008
            ld hl,$0DF7
            ld e,a
            ld d,b
            add hl,de
            ld de,$5B9D
            push de
            ldir
            pop de
            call L0E58
            push hl
            ld a,$90
            call L2B26
            pop de
            call L0E58
            pop bc
            pop de
            pop hl
            inc e
            ret
L2AD9       ld a,($5C41)
            and $03
            ret nz
            ld a,($5C6A)
            and $08
            ret z
            ld a,$03
            ret
L2AE8       add a,$92
            ret
L2AEB       push bc
            ld b,a
            inc b
            jr L2AF5
L2AF0       ld a,(hl)
            inc hl
            call L2B12
L2AF5       djnz L2AF0
            pop bc
            ret
L2AF9       push bc
            push hl
            ld e,$00
            inc b
            jr L2B05
L2B00       ld a,(hl)
            inc hl
            call L2B0A
L2B05       djnz L2B00
            pop hl
            pop bc
            ret
L2B0A       push hl
            ld hl,$2B10
            jr L2B16
            inc e
            ret
L2B12       push hl
            ld hl,$2B26
L2B16       call L2B3E
            jr nc,L2B24
            push bc
            ld b,h
            ld c,l
            call L2B5B
            pop bc
            pop hl
            ret
L2B24       ex (sp),hl
            ret
L2B26       inc e
            inc xh
            dec xh
            jp nz,L16C0
            push bc
            push de
            push hl
            ld e,a
            call L27B3
            ld a,e
            rst $10
            call L1942
            pop hl
            pop de
            pop bc
            ret
L2B3E       cp $A5
            ccf
            ret nc
            inc xh
            dec xh
            ret z
            push de
            push hl
            ld h,$00
            ld l,a
            add hl,$FF70
            add hl,hl
            add hl,hl
            add hl,hl
            ld de,(UDG)
            add hl,de
            pop hl
            pop de
            ret
L2B5B       push de
            sub $A5
            ld de,$0095
            rst $28
            ld b,c
            inc c
            ex de,hl
            pop de
            jr c,L2B7B
            inc xh
            dec xh
            jr z,L2B74
            bit 1,(ix+$25)
            jr L2B78
L2B74       bit 0,(iy+$01)
L2B78       call z,L2B94
L2B7B       rst $28
            ld a,e
            nop
            inc hl
L2B7F       push af
            push bc
            push hl
            and $7F
            call L2B98
            pop hl
            pop bc
            pop af
            add a,a
            jr nc,L2B7B
            cp $48
            jr z,L2B94
            cp $82
            ret c
L2B94       ld a,$A0
            jr L2B7F
L2B98       push bc
            ret
L2B9A       exx
            call L2BA0
            exx
            ret
L2BA0       call L2708
            exx
            inc b
            djnz L2BB2
            ld a,(ix+$21)
            ld l,(ix+$23)
            ld h,(ix+$22)
            jr L2BCA
L2BB2       djnz L2BC1
            ld a,d
            and a
            jp nz,L1B7E
            ld (ix+$2D),e
            call L1AF9
            jr L2BDC
L2BC1       ld a,(ix+$15)
            inc a
            ld l,$00
            ld h,(ix+$18)
L2BCA       sub (ix+$13)
            ld e,a
            ld d,(ix+$1D)
            mul d,e
            ld a,h
            ld h,$00
            ex de,hl
            add hl,de
            sub (ix+$17)
            ld e,a
L2BDC       exx
            jp L276E
L2BE0       nextreg $57,$10
            ld hl,$E3C7
            ld e,(hl)
            ld (hl),$00
            inc hl
            ld d,(hl)
            nextreg $57,$0F
            ld hl,$5245
            and a
            sbc hl,de
            jr nz,L2C03
            ld hl,$1454
            call L2CA6
            ld a,$00
            rst $20
            or c
            ld bc,$DDCD
            ld c,$DF
            cp c
            inc d
            call L1003
            call L3B92
            ld hl,$F700
            ld de,$12E7
            ld a,$FF
            ld b,$0F
            call L2C2E
L2C1C       jp L11B8
L2C1F       ld a,($D5E9)
            cp $3B
            jr c,L2C1C
            jr nz,L2BE0
            xor a
            call L0068
            call m,LF502
            ld a,d
            or e
            jp z,L333B
            pop af
            ld ($D5D4),a
            and $40
            jr z,L2C3D
            ld a,b
L2C3D       ld ($D5D5),a
            ld ($D5CE),hl
            ld ($D5D0),de
            xor a
            ld ($D5DC),a
            call L3226
            call L3264
L2C51       call L32FA
L2C54       ld a,$7F
            in a,($FE)
            rra
            jr nc,L2C54
            res 5,(iy+$01)
            ld ($D5D6),sp
            call L34D1
            res 3,(iy+$30)
            call L1255
            push af
            ld a,($D5E2)
            and a
            ld hl,$3D21
            jr z,L2C7A
            ld hl,$3CFA
L2C7A       pop af
            call L2C82
            jr nz,L2C51
            jr L2C54
L2C82       call L15A1
            call nc,L3E18
            xor a
            ld ($5C41),a
            bit 5,(iy+$30)
            ret
L2C91       ld ix,$F700
            push de
            ld a,$16
            call L275B
            pop de
            push de
            ld a,e
            call L275B
            pop de
            ld a,d
            jp L275B
L2CA6       ld b,h
            ld c,l
            ld hl,$D827
L2CAB       push hl
L2CAC       ld a,(bc)
            inc bc
            ld (hl),a
            inc hl
            inc a
            jr nz,L2CAC
            pop hl
            ret
L2CB5       ld hl,$D5E4
            inc (hl)
            ld hl,$D3C3
            ld de,$C738
            push de
            ld bc,$000D
            ldir
            jr L2CDC
L2CC7       ld hl,$D5EA
            res 3,(hl)
L2CCC       xor a
            ld ($D5E4),a
            ld a,($D5EA)
            and $40
            ld ($D5E1),a
            call L2D32
            push de
L2CDC       ld hl,$1526
            call L33DC
            pop de
            xor a
            push af
            ld a,($D5E1)
            and a
            jr z,L2D0A
            ld hl,$000B
            call L2CA6
            ld bc,$00A7
            call L2D50
            ld ($D5DF),hl
            and a
            jr z,L2D0A
            pop bc
            cp $F7
            jr nc,L2D29
            push af
            call L2D3F
            xor a
            ld ($D5E1),a
L2D0A       xor a
            push de
            call L339B
            pop de
            pop bc
            push bc
            ld a,($D5EA)
            and $40
            or $27
            ld c,a
            push de
            call L2D50
            ld ($D5DD),hl
            pop de
            pop bc
            add a,b
            push af
            call L2D3F
            pop af
L2D29       ld hl,$D5EA
            set 3,(hl)
            ld ($D5E2),a
            ret
L2D32       ld de,$C738
            push de
            xor a
            ld b,$0D
L2D39       ld (de),a
            inc de
            djnz L2D39
            pop de
            ret
L2D3F       push de
            ld hl,$C738
            ld b,$0D
L2D45       ld a,(de)
            ld c,(hl)
            ld (hl),a
            ld a,c
            ld (de),a
            inc de
            inc hl
            djnz L2D45
            pop de
            ret
L2D50       ld a,$F8
            sub b
            ld b,a
            ld a,($D5EA)
            bit 3,a
            jr z,L2D5D
            set 4,c
L2D5D       xor $10
            and $30
            ld h,a
            ld a,c
            and $C0
            or h
            ld h,a
            push bc
            push de
            push hl
            call L357E
            pop hl
            pop de
            pop bc
            and $07
            or h
            ld h,a
            and $03
            cp $01
            jr z,L2D7C
            set 3,h
L2D7C       ld a,h
            res 6,c
            ld hl,$D827
            rst $20
            ld e,$01
            ld a,$00
            ld ($D5E3),a
            jr nc,L2D8E
            ld a,b
            dec a
L2D8E       push af
            ld d,a
            ld e,$0D
            mul d,e
            add de,$C738
            pop af
            ret
            ld c,$01
L2D9C       ld b,$00
L2D9E       push bc
            push hl
            ld de,$1598
            call L31CA
            pop hl
            pop bc
            scf
            ret z
            and a
            dec b
            ret z
            inc hl
            ex de,hl
            ld hl,($D5CE)
L2DB2       ld a,(hl)
            inc hl
            inc a
            jr z,L2DE4
            dec a
            jr z,L2DB2
            push de
            push hl
            push af
            call L2E31
            jr nz,L2DDD
            ld a,(hl)
            call L2E8C
            jr nz,L2DDD
            dec c
            jr nz,L2DDD
            pop bc
            pop hl
L2DCD       ld a,(hl)
            inc hl
            dec b
            call L2E8C
            jr nz,L2DCD
            call L3114
            and a
            ld a,b
            pop de
            scf
            ret
L2DDD       pop af
            pop hl
            add hl,a
            pop de
            jr L2DB2
L2DE4       ld a,(de)
            cp $20
            jr z,L2DEB
L2DE9       and a
            ret
L2DEB       push bc
            ex de,hl
            add hl,$FFF8
            ld de,$D827
            push de
            call L340D
            pop hl
            ld de,$0001
            ld b,d
            ld c,e
            rst $20
            ld b,$01
            pop bc
            ret nc
            push bc
            ld b,$00
            rst $20
            rrca
            ld bc,$DDF5
            push hl
            ld b,$00
            rst $20
            add hl,bc
            ld bc,$F1E1
            pop bc
            ret nc
            ld a,(hl)
            inc hl
            ld e,(hl)
            inc hl
            ld d,(hl)
            and a
            ld hl,$159A
L2E1E       jp z,L2D9C
            cp $03
            jr nz,L2DE9
            ld hl,$1B00
            sbc hl,de
            jr nz,L2DE9
            ld hl,$159D
            jr L2E1E
L2E31       push de
            ld b,$03
L2E34       ld a,(hl)
            cp $2A
            inc hl
            jr z,L2E5B
            dec hl
            ld a,(de)
            inc de
            and $7F
            cp $20
            jr z,L2E6F
            cp (hl)
            jr z,L2E58
            cp $41
            jr c,L2E53
            cp $5B
            jr nc,L2E53
            set 5,a
            cp (hl)
            jr z,L2E58
L2E53       ld a,(hl)
            cp $3F
            jr nz,L2E79
L2E58       inc hl
            djnz L2E34
L2E5B       pop de
            ld a,(hl)
            cp $2C
            jr nz,L2E8C
L2E61       inc hl
            ld a,(hl)
            call L2E8C
            ret z
            call L2E95
            jr nz,L2E61
L2E6C       xor a
            inc a
            ret
L2E6F       ld a,(hl)
            cp $2C
            jr z,L2E5B
            call L2E8C
            jr z,L2E5B
L2E79       pop de
L2E7A       ld a,(hl)
            cp $2C
            inc hl
            jr z,L2E31
            call L2E8C
            jr z,L2E6C
            call L2E95
            jr z,L2E6C
            jr L2E7A
L2E8C       cp $3A
            ret z
            cp $3B
            ret z
            cp $3C
            ret
L2E95       cp $FF
            ret z
L2E98       cp $0D
            ret z
            cp $0A
            ret
            xor a
            ld ($5C41),a
            ld a,($D5D5)
            cpl
            and $04
            ret nz
            ld ($D5D8),sp
            ld de,$1490
            call L3BB7
L2EB3       push hl
            ld hl,$3D67
            ld bc,$0006
            ld de,$D827
            ldir
            pop hl
            push de
            ex de,hl
            ld hl,$E090
            ld c,$00
L2EC7       push hl
            pop ix
            res 7,c
            ld (hl),$16
            inc hl
            ld a,c
            srl a
            srl a
            add a,$16
            ld (hl),a
            inc hl
            push de
            ld a,c
            and $03
            ld d,a
            ld e,$0D
            mul d,e
            ld (hl),e
            inc hl
            pop de
            ld b,$0D
L2EE6       ld a,(de)
            inc de
            cp $3A
            jr z,L2F1C
            call L2E95
            jr z,L2EF9
            bit 5,a
            jr z,L2EFE
L2EF5       ld (hl),a
            inc hl
            djnz L2EE6
L2EF9       push ix
            pop hl
            jr L2F61
L2EFE       bit 7,c
            jr nz,L2EF5
            set 7,c
            ld (hl),$14
            inc hl
            ld (hl),$01
            inc hl
            ld (hl),a
            inc hl
            ld (hl),$14
            inc hl
            ld (hl),$00
            inc hl
            set 5,a
            ex (sp),hl
            ld (hl),a
            ex (sp),hl
            dec b
            jr z,L2EF9
            jr L2EE6
L2F1C       push hl
            call L33FF
            ld a,(de)
            set 5,a
            cp $66
            jr nz,L2F2C
            bit 7,(hl)
            jr nz,L2F43
            inc de
L2F2C       cp $64
            jr nz,L2F35
            bit 7,(hl)
            jr z,L2F43
            inc de
L2F35       inc hl
            ld a,(de)
            cp $2E
            jr nz,L2F46
            inc de
            ex de,hl
            call L2E31
            ex de,hl
            jr z,L2F46
L2F43       pop hl
            jr L2EF9
L2F46       ld a,(de)
            inc de
            cp $3A
            jr nz,L2F43
            pop hl
            ex (sp),hl
            inc hl
            ld (hl),$D0
            inc hl
            ld (hl),$2F
            inc hl
            inc h
            ld (hl),e
            inc hl
            ld (hl),d
            dec hl
            dec h
            ex (sp),hl
            inc c
            bit 3,c
            jr nz,L2F70
L2F61       call L2E98
            jp z,L2EC7
            inc a
            jr z,L2F6E
            ld a,(de)
            inc de
            jr L2F61
L2F6E       ld d,$00
L2F70       ld ($D5DA),de
            ld a,$FF
            ld (hl),a
            pop hl
            ld (hl),a
            ld a,c
            and $7F
            jr z,L2F9B
L2F7E       call L33D4
            call L33D9
            ld hl,$E090
            call L2FC4
L2F8A       res 3,(iy+$30)
            call L1255
            ld hl,$D827
            call L2C82
            jr nz,L2F7E
            jr L2F8A
L2F9B       ld sp,($D5D8)
L2F9F       xor a
            ld ($D5DC),a
            set 5,(iy+$30)
            scf
            ret
            ld sp,($D5D8)
            call L2F9F
            ld hl,($D5DA)
            ld a,h
            and a
            jr z,L2F9B
L2FB7       ld a,(hl)
            inc hl
            call L2E98
            jp z,L2EB3
            inc a
            jr z,L2F9B
            jr L2FB7
L2FC4       ld a,(hl)
            inc hl
            cp $FF
            ret z
            push hl
            call L275B
            pop hl
            jr L2FC4
            inc h
            ld e,(hl)
            inc hl
            ld d,(hl)
            ex de,hl
            ld a,(hl)
            call L2E8C
            jr z,L3001
            ld de,$DA30
L2FDE       ld a,(hl)
            inc de
            inc hl
            ld (de),a
            call L2E95
            ret z
            call L2E8C
            jr nz,L2FDE
            xor a
            ld (de),a
            dec hl
            push hl
            call L33D4
            call L33D9
            set 5,(iy+$30)
            ld hl,$DA31
            rst $18
            ld l,h
            dec hl
            pop hl
            ret nz
L3001       ld a,(hl)
            inc hl
            call L2E8C
            scf
            ccf
            ret nz
            ld c,a
            ld b,$FF
            ld de,$F700
            push de
L3010       inc b
            ld a,(hl)
            ld (de),a
            inc hl
            inc de
            call L2E95
            jr nz,L3010
            push bc
            call L33F9
            pop bc
            pop hl
            ld a,c
            jp L30D3
            ld a,($D5D5)
            cpl
            and $02
            ret nz
            ld a,$3C
            call L3114
            call L33F9
            jr z,L3042
            call L31C7
            jr nz,L3042
            call L311D
            ld hl,$155E
            jr L3097
L3042       call L38AA
            jr nc,L3092
            ld hl,$DA31
            push hl
            ld bc,$0001
L304E       ld a,(hl)
            inc hl
            inc a
            jr z,L305E
            inc b
            jr z,L305D
            cp $2F
            jr nz,L304E
            ld c,b
            jr L304E
L305D       dec b
L305E       dec c
            jr z,L3062
            ld b,c
L3062       ld a,b
            pop de
            push de
            add de,a
            ld hl,$1561
            ld bc,$0005
            ldir
            pop hl
            push hl
            call L309A
            jr c,L3096
            ld hl,$1566
            ld de,$F700
            ld bc,$000F
            ldir
            pop hl
L3082       ld a,(hl)
            ldi
            inc a
            jr nz,L3082
            ld hl,$F700
            push hl
            call L309A
            jr c,L3096
            pop hl
L3092       push $1566
L3096       pop hl
L3097       jp L0933
L309A       ld de,$0001
            ld b,d
            ld c,e
            rst $20
            ld b,$01
            ret nc
            ld b,$00
            rst $20
            add hl,bc
            ld bc,$C937
            ld c,$02
            ld a,$7F
            in a,($FE)
            and c
            jr z,L30B4
            dec c
L30B4       call L33F9
            jr z,L30D8
            dec c
            jr nz,L30C7
            ld a,($D5D5)
            cpl
            and $01
            jr nz,L30C7
            call L31C7
L30C7       jp nz,L325D
            call L311D
            ret nc
            ld hl,$154C
            ld a,$3C
L30D3       call L3114
            jr L30EB
L30D8       call L2D9C
            ret nc
            jr nz,L30EB
            push bc
            ld de,$D827
            ld bc,$03FF
            call L3BBA
            pop bc
            jr L3135
L30EB       and a
            push hl
            push af
            ld bc,$D827
            ld hl,$E090
            call L2CAB
            call L38AA
            pop af
            push af
            call nz,L31E6
            pop af
            pop hl
            jp z,L31DB
            push hl
            add hl,a
            ld a,(hl)
            ld (hl),$0D
            ex (sp),hl
            push af
            call L094C
            pop af
            pop hl
            ld (hl),a
            and a
            ret
L3114       ld ($D5E9),a
            ld a,$FE
            ld ($D5B8),a
            ret
L311D       ld hl,$D827
            ld a,$00
            rst $20
            or c
            ld bc,$91ED
            ld d,a
            djnz L313B
            ld b,l
            ld d,d
            ld ($E3C7),de
            nextreg $57,$0F
            ret
L3135       ld de,$158D
            ld b,$08
L313A       ld a,(de)
L313B       cp (hl)
            inc de
            inc hl
L313E       scf
            ccf
            ret nz
            djnz L313A
            ld a,(hl)
            call L2E98
            jr nz,L313E
            push bc
            call L31A2
            jr nc,L3154
            push hl
            call L325D
            pop hl
L3154       pop bc
            ret nc
            push bc
            call L31A2
            pop bc
            ccf
            ret c
            push bc
            ld hl,$D827
            push hl
            call L3847
            pop hl
            ld de,$C400
L3169       ld a,(hl)
            ldi
            inc a
            jr nz,L3169
            dec de
            ld (de),a
            ld hl,$D5EA
            res 7,(hl)
L3176       call L34DA
            ld d,$FF
L317B       inc d
            ld a,($D5E2)
            ld e,a
            ld a,d
            cp e
            jr c,L3191
            push de
            call L3705
            pop de
            jr c,L3176
            call L32EA
            and a
            pop bc
            ret
L3191       call L3664
            jr nz,L317B
            ld a,d
            call L3751
            pop bc
            ld a,c
            dec a
            jp z,L30B4
            scf
            ret
L31A2       ld de,$D827
            ld bc,$FE02
L31A8       ld a,(hl)
            cp $FF
            ret z
            inc hl
            call L2E98
            jr z,L31A8
L31B2       ld (de),a
            inc de
            ld a,(hl)
            call L2E95
            jr z,L31C2
            inc hl
            djnz L31B2
            dec c
            jr nz,L31B2
            and a
            ret
L31C2       ld a,$FF
            ld (de),a
            scf
            ret
L31C7       ld de,$1595
L31CA       ex de,hl
            ld b,$03
L31CD       inc de
            ld a,(de)
            and $7F
            cp (hl)
            inc hl
            ret nz
            djnz L31CD
            ret
            xor a
            inc a
            jr L31E2
L31DB       ld de,$DA31
            ld hl,$E090
            xor a
L31E2       ld sp,($D5D6)
L31E6       scf
            push af
            push hl
            push de
            ld bc,$1581
            ld hl,$C752
            push hl
            call L2CAB
            call L2D32
            pop hl
            ld bc,$02A0
            xor a
            push de
            push hl
            rst $20
            ld e,$01
            pop hl
            pop de
            ld bc,$0220
            xor a
            rst $20
            ld e,$01
            call L1078
            call L33BD
            call L33D4
            ld a,($D693)
            rst $18
            xor c
            inc d
            ld hl,($D73A)
            rst $28
            dec d
            ld d,$CD
            ret
            ld c,$D1
            pop hl
            pop af
            ret
L3226       and a
            call L33BD
            ld a,($5C7F)
            ld ($D693),a
            ld hl,($5C51)
            ld ($D73A),hl
            ld a,$05
            rst $18
            xor c
            inc d
            ld a,$02
            rst $28
            ld bc,$C316
            inc d
            djnz L3282
            ld b,e
            rst $20
            dec l
            ld bc,$8421
            dec d
            call L2CA6
            ld a,$02
            rst $20
            or c
            ld bc,$0818
            ld hl,$1454
            call L2CA6
            jr L3260
L325D       ld hl,$D827
L3260       rst $20
            ld b,$05
            ret nc
L3264       ld hl,$09F7
            ld de,$D633
            call L3F4A
            ld ix,$F700
            ld a,($D63A)
            call L356F
            ld hl,$14A0
            call L33DC
            call L3315
            ld hl,$E4C9
            call L33DC
            ld a,($D639)
            ld e,a
            ld hl,$5AA9
            ld (hl),e
            ld hl,$5AB7
            ld a,($D5EA)
            bit 4,a
            jr z,L3299
            ld (hl),e
L3299       inc hl
            bit 5,a
            jr nz,L329F
            ld (hl),e
L329F       inc hl
            bit 2,a
            jr z,L32A5
            ld (hl),e
L32A5       call L3463
            call L3505
            call L32FA
            call L2CC7
            nextreg $57,$10
            ld hl,$D92C
            ld de,$E3C9
            ld xl,$00
L32BE       ld a,(de)
            cp (hl)
            jr z,L32C6
            ld xl,$01
            ld a,(hl)
L32C6       ldi
            inc a
            jr nz,L32BE
            dec xl
            jr z,L32F7
            ld hl,($E4DD)
            nextreg $57,$0F
L32D6       ld a,($D5E4)
            cp l
            jr z,L32EC
            ld a,($D5E2)
            cp $F7
            jr nz,L32EA
            push hl
            call L2CB5
            pop hl
            jr L32D6
L32EA       ld h,$FF
L32EC       ld a,($D5E2)
            and a
            jr z,L32F7
            dec a
            cp h
            jr c,L32F7
            ld a,h
L32F7       jp L374C
L32FA       ld hl,($D5D0)
            ld a,($D5DC)
            add a,a
            jr nc,L3306
            ld hl,$13D2
L3306       res 5,(iy+$30)
L330A       push hl
            call L33D4
            call L33D9
            pop hl
L3312       jp L272B
L3315       xor a
            call L339B
            jr nz,L332F
            ld hl,$D836
            ld de,$D5EA
            ldi
            ldi
            ld c,(hl)
            inc hl
            ld b,(hl)
            ld hl,$62FF
            and a
            sbc hl,bc
            ret z
L332F       xor a
            dec de
            ld (de),a
            dec de
            ld (de),a
            ld hl,$000B
            call L3376
            ret
L333B       pop af
            cp $08
            jr c,L3343
            ld a,$15
            ret
L3343       and a
            jr z,L3350
            dec a
            jp nz,L0FE4
            ld ($D5EA),bc
            jr L3376
L3350       push hl
            call L3315
            pop de
            ld hl,$D827
            ld bc,$000F
            ldir
            ld bc,($D5EA)
            scf
            ret
L3363       push bc
            xor a
            call L339B
            pop bc
            ld hl,$D5EA
            ld a,(hl)
            xor b
            ld (hl),a
            inc hl
            ld a,(hl)
            xor c
            ld (hl),a
            ld hl,$D827
L3376       nextreg $57,$10
            ld de,$0000
            ld ($E4DD),de
            nextreg $57,$0F
            ld de,$D827
            ld bc,$000F
            ldir
            ld hl,$D5EA
            ld c,$02
            ldir
            ex de,hl
            ld (hl),$FF
            inc hl
            ld (hl),$62
            scf
L339B       ld hl,$D827
            ld de,$E4C9
            ld b,$13
            jr c,L33A6
            ex de,hl
L33A6       nextreg $57,$10
            ld c,$00
L33AC       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            add a,c
            ld c,a
            djnz L33AC
            ld a,c
            cp (hl)
            ld (de),a
            nextreg $57,$0F
            scf
            ret
L33BD       ld hl,$E3B6
            ld de,STRIP2+5
            ld bc,$0022
            jr c,L33C9
            ex de,hl
L33C9       nextreg $57,$10
            lddr
            nextreg $57,$0F
            ret
L33D4       ld hl,$1445
            jr L33DC
L33D9       ld hl,$14CD
L33DC       ld ix,$F700
            jp L3312
L33E3       push af
            push hl
            add hl,$0008
            call L33DC
            pop hl
            pop af
            and $03
            add a,a
            add hl,a
            ld a,(hl)
            inc hl
            ld h,(hl)
            ld l,a
            jr L33DC
L33F9       ld de,$D827
            call L340A
L33FF       ld hl,($D5E6)
            add hl,$0007
            and a
            bit 7,(hl)
            ret
L340A       ld hl,($D5E6)
L340D       push hl
            ex (sp),hl
            ld b,$08
            call L3422
            ex (sp),hl
            ld a,(hl)
            pop hl
            and $7F
            cp $2E
            ret z
            ld a,$2E
            ld (de),a
            inc de
            ld b,$03
L3422       ld a,(hl)
            inc hl
            and $7F
            cp $20
            jr z,L342C
            ld (de),a
            inc de
L342C       djnz L3422
            ld a,$FF
            ld (de),a
            ret
            ld a,($D5D4)
            and $20
            ret z
            ld a,$FF
            rst $20
            dec l
            ld bc,$43FE
            ret z
            ld l,a
            rst $20
            call p,LD000
            call L3B8C
            ld a,$FF
            rst $20
            dec l
            ld bc,$3C4F
            cp $51
            jr c,L3455
            ld a,$41
L3455       cp c
            ret z
            ld b,a
            push bc
            rst $20
            dec l
            ld bc,$78C1
            jp c,L3264
            jr L344E
L3463       ld bc,$0000
            call L1277
            ld hl,$D92C
            push hl
            ld a,$FF
            rst $20
            dec l
            ld bc,$7932
            ld e,e
            ld (SAVDRV),a
            pop hl
            push hl
            ld (hl),a
            inc hl
            ld (hl),$3A
            inc hl
            ld (hl),$FF
            pop hl
            push hl
            ld a,$01
            rst $20
            or c
            ld bc,$0621
            dec d
            call L33DC
            pop hl
            xor a
L3490       ld b,(hl)
            inc hl
            inc a
            inc b
            jr nz,L3490
            dec hl
            dec a
            ld bc,$0033
            cp c
            jr nc,L349F
            ld c,a
L349F       ld de,$DA31
            ld a,c
            add de,a
            lddr
            ldd
            ld c,$33
            call L3B5B
            ld l,$00
L34B0       ld a,($D63A)
            jr L34F3
L34B5       push af
            call L33FF
            pop bc
            jr nz,L34C9
            ld c,$01
            call L2D9E
            ld a,$00
            ret nc
            ld a,$01
            ret z
            inc a
            ret
L34C9       call L31C7
            ld a,$03
            ret z
            inc a
            ret
L34D1       xor a
            call L34B5
            ld hl,$D63B
            jr L34E9
L34DA       ld hl,$D645
            ld a,(hl)
            dec hl
            dec hl
            push hl
            sub (hl)
            inc a
            push de
            call L34B5
            pop de
            pop hl
L34E9       add hl,a
            ld a,(hl)
            ld hl,($D5E8)
            add hl,$0002
L34F3       ld bc,$5800
            ld h,c
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,hl
            add hl,bc
            ld c,$20
L34FF       ld (hl),a
            inc hl
            dec c
            jr nz,L34FF
            ret
L3505       ld bc,$0101
            call L1277
            ld l,$01
            call L34B0
            ld a,($D63A)
            call L356F
            ld hl,$13FD
            call L33DC
            ld a,($D5EA)
            and $40
            ld a,$6E
            jr z,L352C
            ld a,$66
            call L275B
            ld a,$66
L352C       call L275B
            call L357E
            push af
            ld hl,$143A
L3536       and $07
            call z,L33DC
            pop af
            push af
            ld hl,$14EC
            call L33E3
            ld hl,$14F9
            ld a,($D5EA)
            call L33E3
            ld a,($D639)
            ld c,a
            ld hl,$5820
            ld (hl),c
            ld l,$2B
            ld (hl),c
            ld l,$32
            ld (hl),c
            ld l,$33
            ld (hl),c
            ld l,$36
            ld (hl),c
            ld l,$3A
            ld (hl),c
            pop af
            rra
            rra
            and $01
            add a,$27
            ld l,a
            ld (hl),c
            ld a,($D633)
L356F       ld ix,$F700
            push af
            ld a,$18
            call L275B
            pop af
            call L275B
            ret
L357E       ld a,($D5D5)
            and $08
            ld a,$01
            ret z
            ld a,($D5EB)
            scf
            ret
            call L357E
            and $07
            ret nz
            ld hl,$D5EA
            res 7,(hl)
            ld hl,$150B
            call L3306
            ld hl,$1514
            call L33DC
            ld de,$0000
            ld b,$03
L35A7       push bc
            push de
            ld b,$00
            ld c,e
            ld hl,$100B
            ld ($5B8A),hl
            ld hl,$E1D2
            ld de,$C400
            ld a,c
            and a
            call nz,L1947
            xor a
            ld (de),a
            call L360D
            ld a,b
            and a
            jr nz,L35CF
            call L34DA
            ld a,d
            call L3751
            jr L35D3
L35CF       ld a,d
            call L374C
L35D3       call L34D1
L35D6       ld de,$0816
            call L2C91
            pop de
            pop bc
            ld a,b
            and a
            jr z,L3607
            xor a
            ld b,$07
            ld c,$29
            ld hl,$E1D2
            call L27D5
            bit 1,b
            jr z,L35A7
            xor a
            ld ($5C41),a
            push bc
            push de
            ld a,c
            cp $0E
            jr nz,L35D6
            ld hl,$D5EA
            ld a,(hl)
            xor $80
            ld (hl),a
            pop de
            pop bc
L3605       jr L35A7
L3607       set 5,(iy+$30)
            scf
            ret
L360D       ld bc,$0000
L3610       ld a,($D5E4)
            and a
            jr nz,L3618
            ld c,$01
L3618       ld de,$0000
            call L3664
            ret z
            jr c,L3649
            ld a,($D5E2)
            ld d,a
            dec d
            call L3664
            ret z
            jr nc,L3658
L362C       ld a,e
            cp d
            ret z
            inc a
            cp d
            ret z
            add a,d
            rra
            push af
            push de
            ld d,a
            call L3664
            pop hl
            pop ix
            ret z
            ex de,hl
            jr c,L3645
            ld e,xh
            jr L362C
L3645       ld d,xh
            jr L362C
L3649       bit 0,c
            ret nz
            push bc
            call L36EE
            pop bc
            set 0,b
            jr c,L3610
            ld d,$00
            ret
L3658       push bc
            push de
            call L3705
            pop de
            pop bc
            set 0,b
            jr c,L3610
            ret
L3664       push de
            inc d
            ld e,$0D
            mul d,e
            add de,$C738
            ex de,hl
            ld a,($D5EA)
            bit 6,a
            jr z,L368F
            push hl
            add hl,$0007
            bit 7,(hl)
            pop hl
            jr nz,L3688
            add a,a
            jr nc,L368F
            xor a
            inc a
            scf
            pop de
            ret
L3688       add a,a
            jr c,L368F
            xor a
            inc a
            pop de
            ret
L368F       push bc
            call L38AD
            ld hl,$DA31
            call L3847
            pop bc
            ld hl,$DA30
            ld de,$C3FF
L36A0       inc de
            inc hl
            ld a,(de)
            and a
            jr z,L36BA
            cp (hl)
            jr z,L36A0
            push bc
            call L36BF
            ld c,a
            ld a,(hl)
            call L36BF
            ld b,a
            ld a,c
            cp b
            pop bc
            jr z,L36A0
            pop de
            ret
L36BA       ld d,(hl)
            inc d
            cp d
            pop de
            ret
L36BF       cp $61
            ret c
            cp $7B
            ret nc
            and $DF
            ret
            ld e,$01
            jr L36CE
            ld e,$13
L36CE       call L34DA
            ld a,($D5E5)
            sub e
            ld d,a
            jr nc,L3751
            ld a,($D5E4)
            and a
            jr nz,L36E5
            ld a,d
            add a,e
            and a
            ret z
            xor a
            jr L3751
L36E5       push de
            call L36EE
            pop af
            add a,$F7
            jr L374C
L36EE       ld a,($D5E4)
            and a
            ret z
            dec a
            push af
            call L2CCC
            pop af
            scf
            ret z
L36FB       push af
            call L2CB5
            pop af
            dec a
            jr nz,L36FB
            scf
            ret
L3705       ld a,($D5E2)
            cp $F7
            ccf
            ret nz
            call L2CB5
            ld a,($D5E2)
            and a
            scf
            ret nz
            call L36EE
            and a
            ret
            ld e,$01
            jr L3720
            ld e,$13
L3720       call L34DA
            ld a,($D5E2)
            ld d,a
            ld a,($D5E5)
            add a,e
            jr c,L3730
            cp d
            jr c,L3751
L3730       sub $F7
            ld b,a
            push bc
            call L3705
            pop bc
            jr c,L3744
            ld d,a
            dec d
            ld a,($D5E5)
            cp d
            ret z
            ld a,d
            jr L3751
L3744       ld a,($D5E2)
            dec a
            cp b
            jr c,L374C
            ld a,b
L374C       ld hl,$D5E3
            ld (hl),$FF
L3751       ld ($D5E5),a
            ld hl,($D5E4)
            ld h,a
            nextreg $57,$10
            ld ($E4DD),hl
            nextreg $57,$0F
            ld b,$FF
            ld hl,$C64E
L3768       add hl,$00F7
            inc b
            sub $13
            jr nc,L3768
            add a,$13
            push af
            push hl
            ld a,($D5E3)
            cp b
            jp z,L3833
            ld a,b
            ld ($D5E3),a
            ld c,$13
            ld d,a
            ld e,c
            mul d,e
            ld a,($D5E2)
            sub e
            cp c
            jr c,L378E
            ld a,c
L378E       push hl
            push af
            ld b,$02
            ld c,$14
            call L1277
            pop bc
            inc b
            ld c,$02
            pop hl
            xor a
            jp L382F
L37A0       ld ($D5E8),a
            ld ($D5E6),hl
            push bc
            call L38AD
            push af
            call L3C10
            ld hl,$DA31
            ld a,($D5EA)
            bit 2,a
            call z,L3847
            pop af
            pop de
            push de
            ld d,$00
            call L2C91
            ld a,($D5EA)
            and $03
            ld hl,$3843
            add hl,a
            ld c,(hl)
            push bc
            call L3B5B
            pop bc
            pop de
            push de
            ld d,c
            inc d
            call L33FF
            push hl
            jr z,L37F1
            ld d,$2E
            call L2C91
            pop hl
            call L31C7
            ld hl,$001B
            jr nz,L37EC
            ld hl,$0041
L37EC       call L2727
            jr L381F
L37F1       call L2C91
            pop hl
            ld a,($D5EA)
            and $03
            jr z,L381F
            dec a
            jr nz,L3804
            call L3C20
            jr L381F
L3804       dec a
            jr nz,L3814
            ld de,($5C3F)
            ld bc,($5C74)
            rst $18
            ld b,a
            scf
            jr L381F
L3814       call L3CAE
            ex de,hl
            inc hl
            inc hl
            ld e,$04
            call L272D
L381F       call L34DA
            pop bc
L3823       ld hl,($D5E6)
            add hl,$000D
            ld a,($D5E8)
            inc a
            inc c
L382F       dec b
            jp nz,L37A0
L3833       pop hl
            pop af
            ld ($D5E8),a
            ld e,a
            ld d,$0D
            mul d,e
            add hl,de
            ld ($D5E6),hl
            scf
            ret
            dec l
            dec h
            ld ($CD2D),hl
            ld d,e
            jr c,L3823
L384B       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            inc a
            jr nz,L384B
            ret
L3853       ld bc,$0000
            ld a,$FF
            cpir
            dec hl
            ld d,h
            ld e,l
            push bc
L385E       dec hl
            ld a,(hl)
            cp $2E
            jr z,L386C
            inc bc
            bit 7,b
            jr nz,L385E
            ex de,hl
            pop bc
            push bc
L386C       pop de
            ld d,h
            ld e,l
            dec hl
            ld a,(hl)
            cp $7D
            scf
            ret nz
            call L3897
            push de
            ld e,a
            call L3897
            swapnib
            or e
            pop de
            add bc,a
            bit 7,b
            scf
            ret z
            ld b,$FF
            neg
            add a,$03
            ld c,a
            add hl,bc
            ld a,(hl)
            cp $7B
            scf
            ret nz
            ex de,hl
            and a
            ret
L3897       dec hl
            ld a,(hl)
            sub $30
            cp $0A
            ret c
            sub $07
            cp $10
            ret c
            sub $20
            cp $10
L38A7       ret c
            xor a
            ret
L38AA       ld hl,($D5E6)
L38AD       push hl
            ld ix,($D5DD)
            add hl,$0007
            bit 7,(hl)
            jr z,L38C5
            ld a,($D5EA)
            and $40
            jr z,L38C5
            ld ix,($D5DF)
L38C5       pop de
            ld hl,$000B
            call L2CA6
            ld bc,$DA31
            rst $20
            or a
            ld bc,$CDC9
            xor d
            jr c,L38A7
            ld hl,$DA31
            ld d,$5A
            call L38EC
            ld d,$02
            call L3910
            ret nc
            ex de,hl
            ld hl,$DA31
            jp L3ABC
L38EC       push de
            push hl
            call L3B14
            pop hl
            pop bc
            ld d,b
            push de
            push hl
            call L3853
            pop hl
            ex de,hl
            and a
            sbc hl,de
            ld b,l
            pop de
            ret
            ld de,$0400
            call L390F
            ret nc
            ld a,$02
            rst $20
            or c
            ld bc,$6018
L390F       ld b,e
L3910       ld a,($D5D4)
            and d
            ret z
            ld d,$5A
            ld hl,$1457
            jr L391D
L391C       ld b,e
L391D       push bc
            push de
            call L3306
            pop de
            pop bc
            ld c,d
            ld d,b
            ld b,$04
            xor a
            ld hl,$E152
            call L27D5
            set 5,(iy+$30)
            ld a,e
            and a
            ret z
            push de
            ld hl,$100B
            ld ($5B8A),hl
            ld hl,$E152
            ld de,$D827
            ld bc,$005A
            push de
            call L1947
            pop de
            pop hl
            ld h,$00
            add hl,de
L394F       ld (hl),$FF
            dec hl
            ld a,(hl)
            cp $20
            jr z,L394F
            ex de,hl
L3958       ld a,(hl)
            cp $20
            scf
            ret nz
            inc hl
            jr L3958
            ld hl,$2A7C
            ld e,$08
            call L3B3E
            jr z,L3975
            ld a,$03
            rst $20
            or c
            ld bc,$DAD4
            ld a,($64C3)
            ld ($21E5),a
            ld a,b
            inc d
            call L330A
            pop hl
            rst $20
            inc h
            ld bc,$CFC3
            ld a,($0011)
            ld c,$21
            or c
            inc d
            call L391C
            ld hl,$D827
            jr c,L3994
            ld hl,$000B
L3994       call L3376
            jr L3972
            ld de,$0200
            ld hl,$14B9
            call L391C
            ld e,$00
            jr nc,L39BD
            ld hl,$D827
L39A9       ld a,(hl)
            inc hl
            cp $FF
            jr z,L39BD
            sub $30
            ccf
            ret nc
            ld d,$0A
            cp d
            ret nc
            mul d,e
            add de,a
            jr L39A9
L39BD       ld a,e
            rst $20
            jr nc,L39C2
            ret nc
L39C2       jr L3972
            ld a,($D5EB)
            ld c,a
            dec a
            xor c
            and $03
            ld c,a
            jr L39D1
            ld c,$04
L39D1       ld b,$00
            push bc
            call L357E
            pop bc
            ret nc
            jr L39DF
            ld b,$20
L39DD       ld c,$00
L39DF       call L3363
            jr L3972
            ld b,$04
            jr L39DD
            ld b,$10
            jr L39DD
            ld b,$40
            jr L39DD
            ld a,($D5EA)
            ld b,a
            inc a
            xor b
            and $03
            ld b,a
            ld c,$00
            call L3363
            call L3505
L3A01       ld a,($D5E5)
            ld d,a
            jp L374C
            call L38AA
            ret nc
            ld b,$02
            ld c,$14
            call L1277
            ld de,$000A
            call L2C91
            ld c,$FF
            call L3B5B
            ld hl,$153E
            call L3306
            set 5,(iy+$30)
            call L1255
            jr L3A01
            ld a,$02
            ld hl,$2A95
            jr L3A39
            ld a,$01
            ld hl,$2A90
L3A39       ld ($D5DC),a
            ld e,$01
            call L3B3E
            ld hl,$D5DC
            jr z,L3A4A
            ld a,(hl)
            and $01
            ret nz
L3A4A       set 7,(hl)
            call L38AA
            ld de,$E090
            push de
            call L3C05
            pop de
L3A57       ld a,(de)
            inc de
            inc a
            jr nz,L3A57
            dec de
            ld h,d
            ld l,e
            ld bc,$E090
            and a
            sbc hl,bc
            ld ($D5D2),hl
            ld hl,$DA31
            call L3C08
            set 5,(iy+$30)
            scf
            ret
            ld hl,$D5DC
            ld a,(hl)
            add a,a
            res 7,(hl)
            ret nc
            bit 0,(hl)
            ld hl,$2A85
            jr nz,L3A86
            ld hl,$2A9A
L3A86       call L3B45
            ld hl,$E090
            ld bc,($D5D2)
            add hl,bc
            ld d,$5A
            call L38EC
            ld hl,$1462
            call L391D
            jr nc,L3ACF
            ld de,$DA31
            push de
            push hl
            call L3C05
            pop hl
            call L3C08
            pop hl
            ld de,$D827
            push de
            call L3C08
            pop de
            ld a,($D5DC)
            rra
            jr c,L3AC1
            ld hl,$E090
L3ABC       rst $20
            daa
            ld bc,$0E18
L3AC1       ld a,$80
            ld ($D7FD),a
            ld hl,$146D
            call L330A
            rst $18
            or c
            ld a,$F5
            call L3B8C
            call L33D4
            pop af
            jp L396F
            cp $0A
            jr nc,L3AE2
            add a,$3E
            jr L3AE4
L3AE2       add a,$19
L3AE4       push af
            call L33D4
            ld a,$12
            rst $10
            ld a,$01
            rst $10
            pop af
            rst $18
            dec de
            dec c
            ld a,$12
            rst $10
            ld a,$00
            rst $10
            call L3E18
            call L1255
            ret
            ld a,($D5D4)
            and $10
            ret z
            call L33D4
            set 5,(iy+$30)
            ld c,$03
            rst $18
            and c
            dec hl
            scf
            jr L3ACF
L3B14       push hl
            ld bc,$FFFF
L3B18       ld a,(hl)
            inc hl
            inc bc
            inc a
            jr nz,L3B18
            ld a,b
            and a
            jr nz,L3B26
            ld a,c
            cp d
            jr c,L3B29
L3B26       ld b,$00
            ld c,d
L3B29       push bc
            call L1942
            ld ($5B8A),hl
            ld de,$E152
            pop bc
            pop hl
            push bc
            call L1947
            call L27B3
            pop de
            ret
L3B3E       ld a,($D5D4)
            and e
            pop de
            ret z
            push de
L3B45       push hl
            call L33D4
            pop hl
            rst $18
            ld l,h
            dec hl
            set 5,(iy+$30)
            pop de
            ret nz
            push de
            call L33F9
            ld hl,$D827
            ret
L3B5B       nextreg $57,$10
            ld b,c
            inc b
            ld hl,$DA31
            ld de,$E152
            push de
            push bc
L3B69       ld a,(hl)
            inc hl
            ld (de),a
            inc de
            inc a
            jr z,L3B83
            djnz L3B69
L3B72       ld a,(hl)
            inc hl
            inc a
            jr nz,L3B72
            dec hl
            dec hl
            dec de
            dec de
            ld bc,$0010
            lddr
            ld a,$7E
            ld (de),a
L3B83       nextreg $57,$0F
            pop de
            pop hl
            jp L272D
L3B8C       ld a,($D5D4)
            and $80
            ret z
L3B92       ld hl,$F701
            push hl
            ld bc,$07FE
            ld de,$1483
            call L3BC5
            pop hl
L3BA0       ld d,h
            ld e,l
            dec hl
            ld b,$00
L3BA5       ld a,(de)
            inc de
            call L2E95
            jr z,L3BAF
            inc b
            jr nz,L3BA5
L3BAF       ld (hl),b
            ex de,hl
            inc a
            jr nz,L3BA0
            dec hl
            ld (hl),a
            ret
L3BB7       ld bc,$0700
L3BBA       ld hl,$C000
            push bc
            push hl
            call L3BC5
            pop hl
            pop bc
            ret
L3BC5       push hl
            push bc
            push de
            ld d,h
            ld e,l
            inc de
            ld (hl),$FF
            ldir
            pop hl
            ld de,$D827
            push de
            ld c,$00
            call L0983
            ld a,$FF
            ld (de),a
            pop hl
            ld de,$0001
            ld b,d
            ld c,e
            rst $20
            ld b,$01
            pop de
            dec de
            pop hl
            ret nc
            push hl
            push de
            ld bc,$0007
            rst $20
            ld (de),a
            ld bc,$0330
            ld de,$0000
            push de
            ld b,$00
            rst $20
            add hl,bc
            ld bc,$E1D1
            and a
            sbc hl,de
            pop de
            add hl,de
            scf
            ret
L3C05       ld hl,$D92C
L3C08       ld a,(hl)
            ld (de),a
            inc a
            ret z
            inc hl
            inc de
            jr L3C08
L3C10       ld ($5C74),bc
            ld ($5C3F),de
            ld ($5B6E),ix
            ld ($5B70),hl
            ret
L3C20       ld hl,($5B6E)
            ld de,($5B70)
            ld ix,$3C8A
            ld a,$20
            ld b,$09
L3C2F       push bc
            bit 7,(ix+$03)
            jr z,L3C41
            cp $20
            ld c,a
            jr z,L3C3D
            ld c,$2C
L3C3D       push af
            ld a,c
            rst $10
            pop af
L3C41       ld c,(ix)
            ld b,(ix+$01)
            and a
            sbc hl,bc
            ex de,hl
            ld c,(ix+$02)
            ld b,(ix+$03)
            res 7,b
            sbc hl,bc
            ex de,hl
            jr c,L3C61
            inc a
            cp $21
            jr nz,L3C41
            ld a,$31
            jr L3C41
L3C61       ld c,(ix)
            ld b,(ix+$01)
            add hl,bc
            ex de,hl
            ld c,(ix+$02)
            ld b,(ix+$03)
            res 7,b
            adc hl,bc
            ex de,hl
            push af
            rst $10
            pop af
            cp $20
            jr z,L3C7D
            ld a,$30
L3C7D       ld bc,$0004
            add ix,bc
            pop bc
            djnz L3C2F
            ld a,l
            add a,$30
            rst $10
            ret
            nop
            jp z,L3B9A
            nop
            pop hl
            push af
            add a,l
            add a,b
            sub (hl)
            sbc a,b
            nop
            ld b,b
            ld b,d
            rrca
            nop
            and b
            add a,(hl)
            ld bc,$1080
            daa
            nop
            nop
            ret pe
            inc bc
            nop
            nop
            ld h,h
            nop
            nop
            add a,b
            ld a,(bc)
            nop
            nop
            nop
L3CAE       xor a
            bit 7,(hl)
            inc hl
            jr z,L3CB5
            inc a
L3CB5       bit 7,(hl)
            inc hl
            jr z,L3CBC
            set 3,a
L3CBC       bit 7,(hl)
            inc hl
            jr z,L3CC3
            set 2,a
L3CC3       bit 7,(hl)
            inc hl
            jr z,L3CCA
            set 1,a
L3CCA       ld b,a
            ld c,a
            ld de,$5B9D
            push de
            ld a,$20
            ld (de),a
            inc de
            ld (de),a
            inc de
            ld a,$64
            call L3CF1
            ld a,$61
            call L3CF1
            ld a,$73
            call L3CF1
            ld a,$70
            call L3CF1
            ld a,$20
            ld (de),a
            inc de
            ld (de),a
            pop de
            ret
L3CF1       srl c
            jr c,L3CF7
            ld a,$2D
L3CF7       ld (de),a
            inc de
            ret
            dec c
            xor d
            jr nc,L3D2E
            xor d
            jr nc,L3D66
            ld h,b
            add hl,sp
            ld h,e
L3D04       inc (hl)
            ld a,($D372)
            jr c,L3D80
            dec l
            ld a,($9E0E)
            ld l,$0A
            ld a,(de)
            scf
            ld (hl),$1A
            scf
            add hl,bc
            ld e,$37
            jr c,L3D38
            scf
            ld l,b
            adc a,e
            dec (hl)
            ld l,(hl)
            ex af,af'
            ld a,($C80B)
            ld (hl),$37
            ret z
            ld (hl),$08
            call z,L3536
            call z,L2036
L3D2E       rst $10
            ld sp,$4864
            inc (hl)
            ld l,l
            rst $38
            ld a,($016B)
L3D38       add hl,sp
            ld (hl),l
            ld ($6634),a
            add a,e
            add hl,sp
            ld (hl),b
            ld (hl),h
            ld a,($5507)
            ld ($436C),a
            ld ($DB2E),a
            add hl,sp
            ld (hl),e
            ret pe
            add hl,sp
            ld l,c
            ret p
            add hl,sp
            ld a,b
            call pe,L6F39
            call nz,L2D39
            rst $08
            add hl,sp
            dec hl
            rst $08
            add hl,sp
            ld h,c
            sbc a,c
            add hl,sp
            ld h,a
            inc h
            jr nc,L3DDF
            call po,LFF39
            jr nz,L3D04
            cpl
            ld c,$A9
            cpl
L3D6D       ld a,$FF
            call L07B5
            ld a,($D5BB)
            add a,$85
            ld l,a
            ld a,$00
            ld b,a
            adc a,$3D
            ld h,a
            ld c,(hl)
            add hl,bc
L3D80       call L081D
            scf
            ret
            inc b
            dec c
            ld d,$1F
            jr nz,L3DBE
            ld l,$35
            ld c,l
            ld c,b
            ld a,d
            jr nz,L3DD0
            rst $38
            inc a
            jr nz,L3DB6
            scf
            ld c,l
            ld c,b
            ld a,d
            jr nz,L3DDA
            rst $38
            inc a
            jr nz,L3DD1
            inc (hl)
            ld c,l
            ld c,b
            ld a,d
            jr nz,L3DE4
            rst $38
            inc a
            jr nz,L3DDC
            jr c,L3DF9
            ld c,b
            ld a,d
            jr nz,L3DD0
            rst $38
L3DB1       halt
            ld a,$07
            call GetNRegA
            and $03
            ret
            ld a,($D5BB)
            inc a
L3DBE       cp $04
            ret nc
L3DC1       ld ($D5BB),a
            jr L3D6D
            ld a,($D5BB)
            dec a
            ret m
            jr L3DC1
L3DCD       call L3DB1
L3DD0       push af
L3DD1       xor a
            out (c),a
            rst $28
            or l
            inc bc
            pop af
            nextreg $07,a
            ret
L3DDC       ld (OLDBC),bc
            ex (sp),hl
            ld c,(hl)
            inc hl
            ld b,(hl)
L3DE4       inc hl
            ex (sp),hl
            push $3E93
            push $007B
            push bc
            push $007B
            jp L3E8F
            nop
            nop
            nop
L3DF9       nop
            nop
            nop
            nop
            nop
            nop
            nop
;
; Invoke the EXDOS ROM
;
InvRom2       
            ld (OLDBC),bc          ; Store BC to OLDBC        
            ex (sp),hl             ; Get the return address
            ld c,(hl)              ; Read the next byte following the return address (LSB)
            inc hl                 ; Move to next byte
            ld b,(hl)              ; Read the next byte following the return address (MSB)
            inc hl                 ; Move to next byte
            ex (sp),hl             ; Restore the return address to the stack
            push RetFromR2         ; Return address ROM 2 call completes ($3E13)
                                   ; Note that the RetFromR2 address will be in ROM 2:
                                   ;   nextreg $8E,$00
                                   ;   ret
                                   ; These instructions will switch back to ROM 0
            push bc                ; Address of the ROM 1 routine to call to the stack
            ld bc,(OLDBC)          ; Restore the previous value of BC
RetFromR2   
            nextreg $8E,$02        ; Switch to ROM 2
            ret                    ; Jump to the ROM 2 routine
L3E18       ld a,(RASP)
            srl a
            ld hl,$0C80
L3E20       push ix
            ld d,$00
            ld e,a
L3E25       call L3DCD
            pop ix
            ret
            push ix
            ld de,$0030
            ld hl,$0300
            jr L3E25
            push af
            push hl
            ld a,($5C8D)
            push af
            ld a,($5C48)
            ld ($5C8D),a
            call L0EC9
            ld a,$FD
            rst $28
            ld bc,$F116
            ld ($5C8D),a
            pop hl
L3E4E       ld a,(hl)
            inc hl
            cp $FF
            jr z,L3E57
            rst $10
            jr L3E4E
L3E57       pop af
            jr z,L3E69
            call L11E0
L3E5D       push de
            call L0EC9
            ld a,$FE
            rst $28
            ld bc,$D116
            ld a,e
            ret
L3E69       call L11E0
            and $DF
            ld e,$00
            cp $43
            jr z,L3E5D
            inc e
            cp $52
            jr z,L3E5D
            inc e
            cp $49
            jr z,L3E5D
            jr L3E69
;
;  
;
L3E80       ld (OLDBC),bc          ; Store BC to OLDBC
            ex (sp),hl             ; Get the return address
            ld c,(hl)              ; Read the next byte following the return address (LSB) 
            inc hl                 ; Move to next byte
            ld b,(hl)              ; Read the next byte following the return address (MSB)
            inc hl                 ; Move to next byte
            ex (sp),hl             ; Restore the return address to the stack
            push RetFromR1         ; Return address when back from ROM 1 ($3E93)
                                   ; Note that the RetFromR2 address will be in ROM 1:
                                   ;   nextreg $8E,$00
                                   ;   ret
                                   ; These instructions will switch back to ROM 0
            push bc                ; Address of the ROM 1 routine to call
            ld bc,(OLDBC)          ; Restore the previous value of BC
RetFromR1
            nextreg $8E,$01        ; Switch to ROM 1
            ret                    ; Jump to the ROM 1 routine
L3E98       ld hl,($5C5D)
            push hl
            ld hl,($5C51)
            add hl,$000F
            ld ($5C5D),hl
            ex (sp),hl
            push hl
            exx
            push bc
            push de
            push hl
            exx
            rst $28
            jr L3EB0
L3EB0       rst $28
            cp h
            jr z,L3E8D
            pop hl
            pop de
            pop bc
            exx
            pop de
            ld ($5C5D),de
            jp c,L0495
            ld a,b
            and $E0
            cp $C0
            jr nz,L3ECD
            inc hl
            inc hl
            inc hl
            ld a,(hl)
            inc hl
            dec a
L3ECD       jp nz,L0495
            ld c,(hl)
            inc hl
            ld b,(hl)
            inc hl
            ex de,hl
            pop hl
            dec hl
            ld a,(hl)
            dec hl
            ld l,(hl)
            ld h,a
            push hl
            sbc hl,bc
            pop hl
            ret
            call L3E98
            jr nc,L3EFB
            add hl,de
            ld a,(hl)
L3EE7       ld hl,($5C51)
            add hl,$000D
            ld e,(hl)
            inc hl
            ld d,(hl)
            inc de
            ld (hl),d
            dec hl
            ld (hl),e
            scf
            ret
            push af
            call L3E98
L3EFB       jp nc,L03E0
            add hl,de
            pop af
            ld (hl),a
            jr L3EE7
            push hl
            push de
            ld a,b
            push af
            call L3E98
            pop af
            and a
            jr nz,L3F14
            pop bc
            pop bc
            ld de,$0000
            ret
L3F14       dec a
            jr nz,L3F30
            pop hl
            ld a,h
            or l
            jp nz,L03E0
            pop hl
            and a
            sbc hl,bc
            jr nc,L3EFB
            add hl,bc
            ex de,hl
            ld hl,($5C51)
            ld bc,$000D
            add hl,bc
            ld (hl),e
            inc hl
            ld (hl),d
            ret
L3F30       pop hl
            pop hl
            ld h,b
            ld l,c
            ld de,$0000
            ret
            ld a,($D5B8)
            cp $08
            ret z
            ld hl,$0A15
            and a
            jr z,L3F47
            ld hl,$0A23
L3F47       ld de,$D6DA
L3F4A       push ix
            push hl
            push de
            call L0E50
            ex (sp),hl
            push hl
            call L1274
            ld a,(iy+$45)
            and $0F
            jr nz,L3F5F
            ld a,$05
L3F5F       add a,$F2
            ld xh,a
            ld xl,$00
            ld hl,$3FE7
            call L272B
            pop hl
            push hl
            ld a,$07
            add hl,a
            ld a,(hl)
            call L275B
            ld a,$14
            call L275B
            bit 3,(iy+$45)
            ld bc,$1A00
            jr z,L3F87
            ld bc,$3901
L3F87       push bc
            ld a,c
            call L275B
            pop bc
L3F8D       push bc
            ld a,$20
            call L275B
            pop bc
            djnz L3F8D
            pop de
            ld a,(de)
            push af
            dec c
            ld bc,$0690
L3F9D       push bc
            push de
            ld a,c
            call z,L275B
            ld a,$18
            call L275B
            pop de
            inc de
            push de
            ld a,(de)
            call L275B
            pop de
            pop bc
            ld a,c
            xor $01
            ld c,a
            xor a
            djnz L3F9D
            ld hl,$3FEE
            call L272B
            pop af
            pop de
            call L0E58
            pop hl
            push af
L3FC5       ld a,(hl)
            inc hl
            cp $3A
            jr z,L3FDA
            cp $20
            jr c,L3FDA
            cp $5F
            jr z,L3FC5
            push hl
            call L275B
            pop hl
            jr L3FC5
L3FDA       ld hl,$0023
            call L2727
            pop af
            call L275B
            pop ix
            ret
            ld e,$08
            ld d,$15
            nop
            jr L3FED
            jr nz,L4006
            dec d
            nop
            rst $38
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop
            nop


;; ==========================================================================
;; Standard operations

;; ld bc,NN (0x01)
(func $LdBCNN
  (i32.store16
    (i32.const $BC#)
    (call $readCode16)
  )
)

;; ld (bc),a (0x02)
(func $LdBCiA
  (call $writeMemory
    (i32.load16_u (i32.const $BC#))
    (i32.load8_u (i32.const $A#))
  )

  ;; Update WZ
  (i32.store8
    (i32.const $WL#)
    (i32.load8_u (i32.const $A#))
  )
  (i32.store8
    (i32.const $WH#)
    (i32.add (i32.load16_u (i32.const $BC#)) (i32.const 1))
  )
)

;; inc bc (0x03)
(func $IncBC
  (i32.store16
    (i32.const $BC#)
    (i32.add (i32.load16_u (i32.const $BC#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc b (0x04)
(func $IncB
  (local $v i32)
  i32.const $B# 
  (i32.load8_u (i32.const $B#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec b (0x05)
(func $DecB
  (local $v i32)
  i32.const $B# 
  (i32.load8_u (i32.const $B#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld b,N (0x06)
(func $LdBN
  (i32.store8 
    (i32.const $B#)
    (call $readCodeMemory)
  )
)

;; rlca (0x07)
(func $Rlca
  (i32.store8
    (i32.const $A#)
    (i32.or
      (i32.shl (i32.load8_u (i32.const $A#)) (i32.const 1))
      (i32.shr_u (i32.load8_u (i32.const $A#)) (i32.const 7))
    )
  )

  i32.const $F#
  (i32.or
    ;; S, Z, PV flags mask
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4))
    ;; R5, R3, C from result 
    (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x29)) 
  )
  i32.store8
)

;; ex af,af' (0x08)
(func $ExAf
  (local $tmp i32)
  (set_local $tmp (i32.load16_u (i32.const $AF#)))
  (i32.store16
    (i32.const $AF#)
    (i32.load16_u offset=8 (get_global $REG_AREA_INDEX))
  )
  (i32.store16 offset=8 (get_global $REG_AREA_INDEX) (get_local $tmp))
)

;; add hl,bc (0x09)
(func $AddHLBC
  (i32.store16
    (i32.const $HL#)
    (call $AluAdd16
      (i32.load16_u (i32.const $HL#))
      (i32.load16_u (i32.const $BC#))
    )
  )
)

;; ld a,(bc) (0x0a)
(func $LdABCi
  ;; Calculate WZ
  (i32.store16 
    (i32.const $WZ#)
    (i32.add (i32.load16_u (i32.const $BC#)) (i32.const 1))
  )

  ;; Read A from (BC)
  (i32.store8
    (i32.const $A#)
    (call $readMemory (i32.load16_u (i32.const $BC#)))
  )
)

;; dec bc (0x0b)
(func $DecBC
  (i32.store16
    (i32.const $BC#)
    (i32.sub (i32.load16_u (i32.const $BC#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc c (0x0c)
(func $IncC
  (local $v i32)
  i32.const $C#
  (i32.load8_u (i32.const $C#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec c (0x0d)
(func $DecC
  (local $v i32)
  i32.const $C# 
  (i32.load8_u (i32.const $C#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld c,N (0x0e)
(func $LdCN
  (i32.store8 (i32.const $C#) (call $readCodeMemory))
)

;; rrca (0x0f)
(func $Rrca
  (local $newC i32)
  ;; Calc new C flag
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 1))
  set_local $newC

  ;; Shift value
  i32.const $A#
  (i32.shr_u (i32.load8_u (i32.const $A#)) (i32.const 1))

  ;; Combine with C flag
  (i32.shl (get_local $newC) (i32.const 7))
  i32.or
  i32.store8

  ;; Calc the new F
  i32.const $F#
  (i32.or
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
    (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Keey R3 and R5
  )
  (i32.or (get_local $newC))
  i32.store8
)

;; djnz (0x10)
(func $Djnz
  (local $e i32)
  (call $incTacts (i32.const 1))
  (set_local $e (call $readCodeMemory))

  ;; Decrement B
  (i32.store8 
    (i32.const $B#)
    (i32.sub (i32.load8_u (i32.const $B#)) (i32.const 1))
  )

  ;; Reached 0?
  (i32.eqz (i32.load8_u (i32.const $B#)))
  if return end

  ;; Jump
  (call $relativeJump (get_local $e))
)

;; ld de,NN (0x11)
(func $LdDENN
  (i32.store16
    (i32.const $DE#)
    (call $readCode16)
  )
)

;; ld (de),a (0x12)
(func $LdDEiA
  ;; Update WZ
  (i32.store8
    (i32.const $WH#)
    (i32.add (i32.load16_u (i32.const $DE#)) (i32.const 1))
  )
  (i32.store8
    (i32.const $WL#)
    (i32.load8_u (i32.const $A#))
  )
  (call $writeMemory (i32.load16_u (i32.const $DE#)) (i32.load8_u (i32.const $A#)))
)

;; inc de (0x13)
(func $IncDE
  (i32.store16
    (i32.const $DE#)
    (i32.add (i32.load16_u (i32.const $DE#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc d (0x14)
(func $IncD
  (local $v i32)
  i32.const $D#
  (i32.load8_u (i32.const $D#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec d (0x15)
(func $DecD
  (local $v i32)
  i32.const $D#
  (i32.load8_u (i32.const $D#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld d,N (0x16)
(func $LdDN
  (i32.store8
    (i32.const $D#)
    (call $readCodeMemory)
  )
)

;; rla (0x17)
(func $Rla
  (local $res i32)
  (local $newC i32)
  ;; Shift left
  (i32.shl (i32.load8_u (i32.const $A#)) (i32.const 1))
  tee_local $res

  ;; Calculate new C flag
  i32.const 8
  i32.shr_u
  i32.const 0x01 ;; C Flag mask
  i32.and
  set_local $newC

  ;; Adjust with current C flag
  i32.const $A#
  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C Flag mask
  i32.and
  get_local $res
  i32.or
  i32.store8

  ;; Calculate new C Flag
  i32.const $F#
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Keep R3 and R5
  i32.or

  get_local $newC
  i32.or
  i32.store8
)

;; jr NN (0x18)
(func $JrE
  (call $relativeJump (call $readCodeMemory))
)

;; add hl,de (0x19)
(func $AddHLDE
  (i32.store16
    (i32.const $HL#)
    (call $AluAdd16 
      (i32.load16_u (i32.const $HL#))
      (i32.load16_u (i32.const $DE#))
    )
  )
)

;; ld a,(de) (0x1a)
(func $LdADEi
  ;; Calculate WZ
  (i32.store16
    (i32.const $WZ#)
    (i32.add (i32.load16_u (i32.const $DE#)) (i32.const 1))
  )

  ;; Read A from (DE)
  (i32.store8
    (i32.const $A#)
    (call $readMemory (i32.load16_u (i32.const $DE#)))
  )
)

;; dec de (0x1b)
(func $DecDE
  (i32.store16
    (i32.const $DE#)
    (i32.sub (i32.load16_u (i32.const $DE#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc e (0x1c)
(func $IncE
  (local $v i32)
  i32.const $E#
  (i32.load8_u (i32.const $E#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec e (0x1d)
(func $DecE
  (local $v i32)
  i32.const $E#
  (i32.load8_u (i32.const $E#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld e,N (0x1e)
(func $LdEN
  (i32.store8
    (i32.const $E#)
    (call $readCodeMemory)
  )
)

;; rra (0x1f)
(func $Rra
  (local $newC i32)

  ;; Calculate the new C flag
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 1))
  set_local $newC

  ;; Shift right
  i32.const $A#
  (i32.shr_u (i32.load8_u (i32.const $A#)) (i32.const 1))

  ;; Adjust with current C flag
  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C Flag mask
  i32.and
  i32.const 7
  i32.shl
  i32.or
  i32.store8

  ;; Calculate new C Flag
  i32.const $F#
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Keep R3 and R5
  i32.or

  get_local $newC
  i32.or
  i32.store8
)

;; jr nz,NN (0x20)
(func $JrNz
  (local $e i32)
  (set_local $e (call $readCodeMemory))
  call $testZ
  if return end
  (call $relativeJump (get_local $e))
)

;; ld hl,NN (0x21)
(func $LdHLNN
  (i32.store16
    (i32.const $HL#)
    (call $readCode16)
  )
)

;; ld (NN),hl (0x22)
(func $LdNNiHL
  (local $addr i32)
  ;; Obtain the address to store HL
  (i32.store16 (i32.const $WZ#)
    (tee_local $addr (call $readCode16))

    ;; Set WZ to addr + 1
    (i32.add (i32.const 1))
  )

  ;; Store HL
  (call $writeMemory (get_local $addr) (i32.load8_u (i32.const $L#)))
  (call $writeMemory
    (i32.load16_u (i32.const $WZ#))
    (i32.load8_u (i32.const $H#))
  )
)

;; inc hl (0x23)
(func $IncHL
  (i32.store16
    (i32.const $HL#)
    (i32.add (i32.load16_u (i32.const $HL#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc h (0x24)
(func $IncH
  (local $v i32)
  i32.const $H#
  (i32.load8_u (i32.const $H#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec h (0x25)
(func $DecH
  (local $v i32)
  i32.const $H#
  (i32.load8_u (i32.const $H#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld h,N (0x26)
(func $LdHN
  (i32.store8
    (i32.const $H#)
    (call $readCodeMemory)
  )
)

;; daa (0x27)
(func $Daa
  (local $a i32)
  (local $lNibble i32)
  (local $hNibble i32)
  (local $diff i32)
  (local $cAfter i32)
  (local $hFlag i32)
  (local $nFlag i32)
  (local $hAfter i32)
  (local $pvAfter i32)

  ;; Get A and store nibbles
  (i32.load8_u (i32.const $A#))
  tee_local $a
  i32.const 4
  i32.shr_u
  set_local $hNibble
  get_local $a
  i32.const 0x0f
  i32.and
  set_local $lNibble

  ;; Calculate H flag
  (i32.load8_u (i32.const $F#))
  i32.const 0x10 ;; Mask for H flag
  i32.and
  set_local $hFlag

  ;; Calculate N flag
  (i32.load8_u (i32.const $F#))
  i32.const 0x02 ;; Mask for N flag
  i32.and
  set_local $nFlag

  ;; Set default calculation values
  i32.const 0x00
  set_local $diff
  i32.const 0x00
  set_local $cAfter

  ;; Calculate the diff value
  (i32.eq 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
    (i32.const 0)
  )
  if
    ;; C flag is 0
    ;; Test if hNibble is 0..9 and lNibble is 0..9
    (i32.and
      (i32.le_u (get_local $hNibble) (i32.const 9))
      (i32.le_u (get_local $lNibble) (i32.const 9))
    )
    if
      i32.const 0x06
      i32.const 0x00
      get_local $hFlag
      select
      set_local $diff
    else
      ;; Test if hNibble is 0..8 and lNibble is a..f
      (i32.le_u (get_local $hNibble) (i32.const 8))
      (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
      (i32.le_u (get_local $lNibble) (i32.const 0x0f))
      i32.and
      i32.and
      if
        i32.const 6
        set_local $diff
      else
        ;; Test if hNibble is a..f and lNibble is 0..9 and H flag not set
        (i32.ge_u (get_local $hNibble) (i32.const 0x0a))
        (i32.le_u (get_local $hNibble) (i32.const 0x0f))
        (i32.le_u (get_local $lNibble) (i32.const 0x09))
        (i32.eq (get_local $hFlag) (i32.const 0x00))
        i32.and
        i32.and
        i32.and
        if
          i32.const 0x60
          set_local $diff
          i32.const 1
          set_local $cAfter
        else
          ;; Test if hNibble is 9..f and lNibble is a..f
          (i32.ge_u (get_local $hNibble) (i32.const 0x09))
          (i32.le_u (get_local $hNibble) (i32.const 0x0f))
          (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
          (i32.le_u (get_local $lNibble) (i32.const 0x0f))
          i32.and
          i32.and
          i32.and
          if
            i32.const 0x66
            set_local $diff
            i32.const 1
            set_local $cAfter
          else
            ;; Test if hNibble is a..f and lNibble is 0..9
            (i32.ge_u (get_local $hNibble) (i32.const 0x0a))
            (i32.le_u (get_local $hNibble) (i32.const 0x0f))
            (i32.le_u (get_local $lNibble) (i32.const 0x09))
            i32.and
            i32.and
            if
              ;; Test if H flag is set
              get_local $hFlag
              i32.const 0
              i32.ne
              if
                i32.const 0x66
                set_local $diff
              end
              i32.const 1
              set_local $cAfter
            end
          end
        end
      end
    end
  else
    ;; C flag is 1
    i32.const 1
    set_local $cAfter

    ;; Test if lNibble is 0..9
      (i32.le_u (get_local $lNibble) (i32.const 0x09))
    if
      i32.const 0x66
      i32.const 0x60
      get_local $hFlag
      select
      set_local $diff
    else
      ;; Test if lNibble is a..f
      (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
      (i32.le_u (get_local $lNibble) (i32.const 0x0f))
      i32.and
      if
        i32.const 0x66
        set_local $diff
      end
    end
  end

  ;; Calculate the new value of H flag
  i32.const 0
  set_local $hAfter

  ;; Test if lNibble is a..f and N is reset
  (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
  (i32.le_u (get_local $lNibble) (i32.const 0x0f))
  get_local $nFlag
  i32.const 1
  i32.shr_u   ;; Conver N to 0 or 1
  i32.const 1
  i32.xor
  i32.and
  i32.and
  if
    i32.const 0x10
    set_local $hAfter
  else
    ;; Test if lNibble is 0..5 and N is set and H is set
    (i32.le_u (get_local $lNibble) (i32.const 0x05))
    get_local $nFlag
    i32.const 1
    i32.shr_u   ;; Conver N to 0 or 1
    get_local $hFlag
    i32.const 4
    i32.shr_u   ;; Conver H to 0 or 1
    i32.and
    i32.and
    if
      i32.const 0x10
      set_local $hAfter
    end
  end

  ;; Calculate the new value of A
  i32.const $A#
  get_local $a
  get_local $diff
  i32.sub
  (i32.load8_u (i32.const $A#))
  get_local $diff
  i32.add
  get_local $nFlag
  select
  tee_local $a
  i32.store8

  i32.const $F#

  ;; Calculate parity
  get_local $a
  i32.const 0xff
  i32.and
  i32.popcnt
  i32.const 2
  i32.rem_u
  i32.const 2
  i32.shl
  i32.const 0x04 ;; PV flag mask
  i32.xor
  set_local $pvAfter

  ;; Calculate F value
  ;; Z flag
  i32.const 0x00
  i32.const 0x40
  (i32.load8_u (i32.const $A#))
  tee_local $a
  select   ;; Z is on top
  ;; S, R3, R5 flag
  get_local $a
  i32.const 0xA8 ;; Mask for S, R3, R5
  i32.and  ;; Z, S|R3|R5
  i32.or   ;; Z|S|R3|R5
  get_local $pvAfter
  i32.or
  get_local $nFlag
  i32.or
  get_local $hAfter
  i32.or
  get_local $cAfter
  i32.or

  ;; Done
  i32.store8
)

;; jr z,NN (0x28)
(func $JrZ
  (local $e i32)
  (set_local $e (call $readCodeMemory))
  call $testNZ
  if return end
  (call $relativeJump (get_local $e))
)

;; add hl,hl (0x29)
(func $AddHLHL
  (i32.store16
    (i32.const $HL#)
    (call $AluAdd16
      (i32.load16_u (i32.const $HL#))
      (i32.load16_u (i32.const $HL#))
    )
  )
)

;; ld hl,(NN) (0x2a)
(func $LdHLNNi
  (local $addr i32)
  ;; Read the address
  (i32.store16
    (i32.const $WZ#)
    (tee_local $addr (call $readCode16))

    ;; Set WZ to addr + 1
    (i32.add (i32.const 1))
  )

  ;; Read HL from memory
  (i32.store8
    (i32.const $L#)
    (call $readMemory (get_local $addr))
  )
  (i32.store8
    (i32.const $H#)
    (call $readMemory (i32.load16_u (i32.const $WZ#)))
  )
)

;; dec hl (0x2b)
(func $DecHL
  (i32.store16
    (i32.const $HL#)
    (i32.sub (i32.load16_u (i32.const $HL#)) (i32.const 1))
  )
  (call $incTacts (i32.const 2))
)

;; inc l (0x2c)
(func $IncL
  (local $v i32)
  i32.const $L#
  (i32.load8_u (i32.const $L#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustIncFlags (get_local $v))
)

;; dec l (0x2d)
(func $DecL
  (local $v i32)
  i32.const $L#
  (i32.load8_u (i32.const $L#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8
  (call $adjustDecFlags (get_local $v))
)

;; ld l,N (0x2e)
(func $LdLN
  (i32.store8
    (i32.const $L#)
    (call $readCodeMemory)
  )
)

;; cpl (0x2f)
(func $Cpl
  ;; New value of A
  (i32.store8
    (i32.const $A#)
    (i32.xor (i32.load8_u (i32.const $A#)) (i32.const 0xff))
  )

  i32.const $F#
  ;; New F
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc5)) ;; Keep S, Z, PV, C
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Keep R3 and R5
  i32.or
  
  i32.const 0x12 ;; Set H and N
  i32.or
  i32.store8
)

;; jr nc,NN (0x30)
(func $JrNc
  (local $e i32)
  (set_local $e (call $readCodeMemory))
  call $testC
  if return end
  (call $relativeJump (get_local $e))
)

;; ld sp,NN (0x31)
(func $LdSPNN
  (call $setSP (call $readCode16))
)

;; ld (NN),a (0x32)
(func $LdNNiA
  (local $addr i32)

  ;; Adjust WZ
  (i32.store8
    (i32.const $WL#)
    (tee_local $addr (call $readCode16))
    (i32.add (i32.const 1))
  )
  (i32.store8
    (i32.const $WH#)
    (i32.load8_u (i32.const $A#))
  )

  ;; Store A
  (call $writeMemory (get_local $addr) (i32.load8_u (i32.const $A#)))
)

;; inc sp (0x33)
(func $IncSP
  (set_global $SP 
    (i32.and (i32.add (get_global $SP) (i32.const 1)) (i32.const 0xffff)) 
  )
  (call $incTacts (i32.const 2))
)

;; inc (hl) (0x34)
(func $IncHLi
  (local $v i32)

  ;; Get the value from the memory
  (call $readMemory (i32.load16_u (i32.const $HL#)))
  set_local $v

  ;; Adjust tacts
  (call $contendRead (i32.load16_u (i32.const $HL#)) (i32.const 1))

  ;; Increment value
  (i32.load16_u (i32.const $HL#))
  (i32.add (get_local $v) (i32.const 1))
  call $writeMemory

  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u

  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C flag mask
  i32.and
  i32.or
  i32.store8
)

;; dec (hl) (0x35)
(func $DecHLi
  (local $v i32)

  ;; Get the value from the memory
  (call $readMemory (i32.load16_u (i32.const $HL#)))
  set_local $v

  ;; Adjust tacts
  (call $contendRead (i32.load16_u (i32.const $HL#)) (i32.const 1))

  ;; Increment value
  (i32.load16_u (i32.const $HL#))
  (i32.sub (get_local $v) (i32.const 1))
  call $writeMemory

  ;; Adjust flags
  i32.const $F#
  (i32.add (get_global $DEC_FLAGS) (get_local $v))
  i32.load8_u

  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C flag mask
  i32.and
  i32.or
  i32.store8
)

;; ld (hl),n (0x36)
(func $LdHLiN
  (call $writeMemory 
    (i32.load16_u (i32.const $HL#))
    (call $readCodeMemory)
  )
)

;; scf (0x37)
(func $Scf
  i32.const $F#
  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Mask for R5, R3
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Mask for S, Z, PV
  i32.or
  i32.const 0x01 ;; Mask for C flag
  i32.or
  i32.store8
)

;; jr c,NN (0x38)
(func $JrC
  (local $e i32)
  (set_local $e (call $readCodeMemory))
  call $testNC
  if return end
  (call $relativeJump (get_local $e))
)

;; add hl,sp (0x39)
(func $AddHLSP
  (i32.store16
    (i32.const $HL#)
    (call $AluAdd16 (i32.load16_u (i32.const $HL#)) (get_global $SP))
  )
)

;; ld a,(NN) (0x3a)
(func $LdANNi
  (local $addr i32)

  ;; Read the address
  (i32.store16 
    (i32.const $WZ#)
    (tee_local $addr (call $readCode16))
  
    ;; Set WZ to addr + 1
    (i32.const 1)
    (i32.add)
  )
  
  ;; Read A from memory
  (i32.store8
    (i32.const $A#)
    (call $readMemory (get_local $addr))
  )
)

;; dec sp (0x3b)
(func $DecSP
  (call $setSP (i32.sub (get_global $SP) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc a (0x3c)
(func $IncA
  (local $v i32)
  i32.const $A#
  (i32.load8_u (i32.const $A#))
  (i32.add (tee_local $v) (i32.const 1))
  i32.store8

  (call $adjustIncFlags (get_local $v))
)

;; dec a (0x3d)
(func $DecA
  (local $v i32)
  i32.const $A#
  (i32.load8_u (i32.const $A#))
  (i32.sub (tee_local $v) (i32.const 1))
  i32.store8

  (call $adjustDecFlags (get_local $v))
)

;; ld a,N (0x3e)
(func $LdAN
  (i32.store8
    (i32.const $A#)
    (call $readCodeMemory)
  )
)

;; ccf (0x3f)
(func $Ccf
  (local $cFlag i32)

  i32.const $F#

  (i32.and (i32.load8_u (i32.const $A#)) (i32.const 0x28)) ;; Mask for R5, R3
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Mask for S, Z, PV
  i32.or
  
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01)) ;; Mask for C flag
  tee_local $cFlag
  i32.const 0x01 ;; Complement C flag
  i32.xor
  i32.or

  (i32.shl (get_local $cFlag) (i32.const 4)) ;; Set H to the previous C
  i32.or
  i32.store8
)

;; ld b,c (0x41)
(func $LdBC
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld b,d (0x42)
(func $LdBD
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld b,e (0x43)
(func $LdBE
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld b,h (0x44)
(func $LdBH
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld b,l (0x45)
(func $LdBL
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld b,(hl) (0x46)
(func $LdBHLi
  (i32.store8 
    (i32.const $B#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld b,a (0x47)
(func $LdBA
  (i32.store8 
    (i32.const $B#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld c,b (0x48)
(func $LdCB
  (i32.store8 
    (i32.const $C#) 
    (i32.load8_u (i32.const $B#))
  )
)

;; ld c,d (0x4a)
(func $LdCD
  (i32.store8 
    (i32.const $C#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld c,e (0x4b)
(func $LdCE
  (i32.store8
    (i32.const $C#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld c,h (0x4c)
(func $LdCH
  (i32.store8
    (i32.const $C#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld c,l (0x4d)
(func $LdCL
  (i32.store8
    (i32.const $C#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld c,(hl) (0x4e)
(func $LdCHLi
  (i32.store8
    (i32.const $C#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld c,a (0x4f)
(func $LdCA
  (i32.store8
    (i32.const $C#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld d,b (0x50)
(func $LdDB
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $B#))
  )
)

;; ld d,c (0x51)
(func $LdDC
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld d,e (0x53)
(func $LdDE
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld d,h (0x54)
(func $LdDH
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld d,l (0x55)
(func $LdDL
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld d,(hl) (0x56)
(func $LdDHLi
  (i32.store8
    (i32.const $D#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld d,a (0x57)
(func $LdDA
  (i32.store8
    (i32.const $D#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld e,b (0x58)
(func $LdEB
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $B#))
  )
)

;; ld e,c (0x59)
(func $LdEC
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld e,d (0x5a)
(func $LdED
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld e,h (0x5c)
(func $LdEH
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld e,l (0x5d)
(func $LdEL
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld e,(hl) (0x5e)
(func $LdEHLi
  (i32.store8
    (i32.const $E#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld e,a (0x5f)
(func $LdEA
  (i32.store8
    (i32.const $E#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld h,b (0x60)
(func $LdHB
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $B#))
  )
)

;; ld h,c (0x61)
(func $LdHC
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld h,d (0x62)
(func $LdHD
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld h,e (0x63)
(func $LdHE
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld h,l (0x65)
(func $LdHL
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld h,(hl) (0x66)
(func $LdHHLi
  (i32.store8
    (i32.const $H#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld h,a (0x67)
(func $LdHA
  (i32.store8
    (i32.const $H#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld l,b (0x68)
(func $LdLB
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $B#))
  )
)

;; ld l,c (0x69)
(func $LdLC
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld l,d (0x6a)
(func $LdLD
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld l,e (0x6b)
(func $LdLE
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld l,h (0x6c)
(func $LdLH
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld l,(hl) (0x6e)
(func $LdLHLi
  (i32.store8
    (i32.const $L#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; ld l,a (0x6f)
(func $LdLA
  (i32.store8
    (i32.const $L#)
    (i32.load8_u (i32.const $A#))
  )
)

;; ld (hl),b (0x70)
(func $LdHLiB
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $B#))
  )
)

;; ld (hl),c (0x71)
(func $LdHLiC
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $C#))
  )
)

;; ld (hl),d (0x72)
(func $LdHLiD
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $D#))
  )
)

;; ld (hl),e (0x73)
(func $LdHLiE
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $E#))
  )
)

;; ld (hl),h (0x74)
(func $LdHLiH
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $H#))
  )
)

;; ld (hl),l (0x75)
(func $LdHLiL
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $L#))
  )
)

;; halt (0x76)
(func $Halt
  ;; Set the HLT flag
  (i32.or (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
  set_global $cpuSignalFlags
  call $hookHalted

  ;; Decrement PC
  (i32.sub (get_global $PC) (i32.const 1))
  call $setPC
)

;; ld (hl),a (0x77)
(func $LdHLiA
  (call $writeMemory
    (i32.load16_u (i32.const $HL#))
    (i32.load8_u (i32.const $A#))
  )
)

;; ld a,b (0x78)
(func $LdAB
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $B#))
  )
)

;; ld a,c (0x79)
(func $LdAC
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $C#))
  )
)

;; ld a,d (0x7a)
(func $LdAD
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $D#))
  )
)

;; ld a,e (0x7b)
(func $LdAE
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $E#))
  )
)

;; ld a,h (0x7c)
(func $LdAH
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $H#))
  )
)

;; ld a,l (0x7d)
(func $LdAL
  (i32.store8
    (i32.const $A#)
    (i32.load8_u (i32.const $L#))
  )
)

;; ld a,(hl) (0x7e)
(func $LdAHLi
  (i32.store8
    (i32.const $A#)
    (i32.load16_u (i32.const $HL#))
    (call $readMemory)
  )
)

;; add a,b (0x80)
(func $AddAB
  (call $AluAdd (i32.load8_u (i32.const $B#)) (i32.const 0))
)

;; add a,c (0x81)
(func $AddAC
  (call $AluAdd (i32.load8_u (i32.const $C#)) (i32.const 0))
)

;; add a,d (0x82)
(func $AddAD
  (call $AluAdd (i32.load8_u (i32.const $D#)) (i32.const 0))
)

;; add a,e (0x83)
(func $AddAE
  (call $AluAdd (i32.load8_u (i32.const $E#)) (i32.const 0))
)

;; add a,h (0x84)
(func $AddAH
  (call $AluAdd (i32.load8_u (i32.const $H#)) (i32.const 0))
)

;; add a,l (0x85)
(func $AddAL
  (call $AluAdd (i32.load8_u (i32.const $L#)) (i32.const 0))
)

;; add a,(hl) (0x86)
(func $AddAHLi
  (call $AluAdd 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
    (i32.const 0)
  )
)

;; add a,a (0x87)
(func $AddAA
  (call $AluAdd (i32.load8_u (i32.const $A#)) (i32.const 0))
)

;; adc a,b (0x88)
(func $AdcAB
  (call $AluAdd 
    (i32.load8_u (i32.const $B#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,c (0x89)
(func $AdcAC
  (call $AluAdd 
    (i32.load8_u (i32.const $C#))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,d (0x8a)
(func $AdcAD
  (call $AluAdd 
    (i32.load8_u (i32.const $D#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,e (0x8b)
(func $AdcAE
  (call $AluAdd 
    (i32.load8_u (i32.const $E#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,h (0x8c)
(func $AdcAH
  (call $AluAdd 
    (i32.load8_u (i32.const $H#))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,l (0x8d)
(func $AdcAL
  (call $AluAdd 
    (i32.load8_u (i32.const $L#))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,(hl) (0x8e)
(func $AdcAHLi
  (call $AluAdd 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,a (0x8f)
(func $AdcAA
  (call $AluAdd 
    (i32.load8_u (i32.const $A#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sub B (0x90)
(func $SubAB
  (call $AluSub (i32.load8_u (i32.const $B#)) (i32.const 0))
)

;; sub C (0x91)
(func $SubAC
  (call $AluSub (i32.load8_u (i32.const $C#)) (i32.const 0))
)

;; sub D (0x92)
(func $SubAD
  (call $AluSub (i32.load8_u (i32.const $D#)) (i32.const 0))
)

;; sub E (0x93)
(func $SubAE
  (call $AluSub (i32.load8_u (i32.const $E#)) (i32.const 0))
)

;; sub H (0x94)
(func $SubAH
  (call $AluSub (i32.load8_u (i32.const $H#)) (i32.const 0))
)

;; sub L (0x95)
(func $SubAL
  (call $AluSub (i32.load8_u (i32.const $L#)) (i32.const 0))
)

;; sub (hl) (0x96)
(func $SubAHLi
  (call $AluSub 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
    (i32.const 0)
  )
)

;; sub A (0x97)
(func $SubAA
  (call $AluSub (i32.load8_u (i32.const $A#)) (i32.const 0))
)

;; sbc a,b (0x98)
(func $SbcAB
  (call $AluSub 
    (i32.load8_u (i32.const $B#))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,c (0x99)
(func $SbcAC
  (call $AluSub 
    (i32.load8_u (i32.const $C#))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,d (0x9a)
(func $SbcAD
  (call $AluSub 
    (i32.load8_u (i32.const $D#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,e (0x9b)
(func $SbcAE
  (call $AluSub 
    (i32.load8_u (i32.const $E#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,h (0x9c)
(func $SbcAH
  (call $AluSub 
    (i32.load8_u (i32.const $H#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,l (0x9d)
(func $SbcAL
  (call $AluSub 
    (i32.load8_u (i32.const $L#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,(hl) (0x9e)
(func $SbcAHLi
  (call $AluSub
    (call $readMemory (i32.load16_u (i32.const $HL#)))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,a (0x9f)
(func $SbcAA
  (call $AluSub 
    (i32.load8_u (i32.const $A#)) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; and b (0xa0)
(func $AndAB
  (call $AluAnd (i32.load8_u (i32.const $B#)))
)

;; and c (0xa1)
(func $AndAC
  (call $AluAnd (i32.load8_u (i32.const $C#)))
)

;; and d (0xa2)
(func $AndAD
  (call $AluAnd (i32.load8_u (i32.const $D#)))
)

;; and e (0xa3)
(func $AndAE
  (call $AluAnd (i32.load8_u (i32.const $E#)))
)

;; and h (0xa4)
(func $AndAH
  (call $AluAnd (i32.load8_u (i32.const $H#)))
)

;; and l (0xa5)
(func $AndAL
  (call $AluAnd (i32.load8_u (i32.const $L#)))
)

;; and (hl) (0xa6)
(func $AndAHLi
  (call $AluAnd 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
  )
)

;; and a (0xa7)
(func $AndAA
  (call $AluAnd (i32.load8_u (i32.const $A#)))
)

;; xor b (0xa8)
(func $XorAB
  (call $AluXor (i32.load8_u (i32.const $B#)))
)

;; xor c (0xa9)
(func $XorAC
  (call $AluXor (i32.load8_u (i32.const $C#)))
)

;; xor d (0xaa)
(func $XorAD
  (call $AluXor (i32.load8_u (i32.const $D#)))
)

;; xor e (0xab)
(func $XorAE
  (call $AluXor (i32.load8_u (i32.const $E#)))
)

;; xor h (0xac)
(func $XorAH
  (call $AluXor (i32.load8_u (i32.const $H#)))
)

;; xor l (0xad)
(func $XorAL
  (call $AluXor (i32.load8_u (i32.const $L#)))
)

;; xor (hl) (0xae)
(func $XorAHLi
  (call $AluXor
    (call $readMemory (i32.load16_u (i32.const $HL#)))
  )
)

;; xor a (0xaf)
(func $XorAA
  (call $AluXor (i32.load8_u (i32.const $A#)))
)

;; or b (0xb0)
(func $OrAB
  (call $AluOr (i32.load8_u (i32.const $B#)))
)

;; or c (0xb2)
(func $OrAC
  (call $AluOr (i32.load8_u (i32.const $C#)))
)

;; or d (0xb2)
(func $OrAD
  (call $AluOr (i32.load8_u (i32.const $D#)))
)

;; or e (0xb3)
(func $OrAE
  (call $AluOr (i32.load8_u (i32.const $E#)))
)

;; or h (0xb4)
(func $OrAH
  (call $AluOr (i32.load8_u (i32.const $H#)))
)

;; or l (0xb5)
(func $OrAL
  (call $AluOr (i32.load8_u (i32.const $L#)))
)

;; or (hl) (0xb6)
(func $OrAHLi
  (call $AluOr 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
  )
)

;; or a (0xb7)
(func $OrAA
  (call $AluOr (i32.load8_u (i32.const $A#)))
)

;; cp b (0xb8)
(func $CpAB
  (call $AluCp (i32.load8_u (i32.const $B#)))
)

;; cp c (0xb9)
(func $CpAC
  (call $AluCp (i32.load8_u (i32.const $C#)))
)

;; cp d (0xba)
(func $CpAD
  (call $AluCp (i32.load8_u (i32.const $D#)))
)

;; cp e (0xbb)
(func $CpAE
  (call $AluCp (i32.load8_u (i32.const $E#)))
)

;; cp h (0xbc)
(func $CpAH
  (call $AluCp (i32.load8_u (i32.const $H#)))
)

;; cp l (0xbd)
(func $CpAL
  (call $AluCp (i32.load8_u (i32.const $L#)))
)

;; cp (hl) (0xbe)
(func $CpAHLi
  (call $AluCp 
    (call $readMemory (i32.load16_u (i32.const $HL#)))
  )
)

;; cp a (0xbf)
(func $CpAA
  (call $AluCp (i32.load8_u (i32.const $A#)))
)

;; ret nz (0xc0)
(func $RetNz
  (call $incTacts (i32.const 1))
  call $testZ
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; pop bc (0xc1)
(func $PopBC
  (i32.store16
    (i32.const $BC#)
    (call $popValue)
  )
)

;; jp nz (0xc2)
(func $JpNz
  call $readAddrToWZ
  call $testZ
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; jp (0xc3)
(func $Jp
  call $readAddrToWZ
  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; call nz (0xc4)
(func $CallNz
  (local $oldPC i32)

  call $readAddrToWZ
  call $testZ
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC
  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push bc (0xc5)
(func $PushBC
  (i32.load16_u (i32.const $BC#))
  call $pushValue
)

;; add a,N (0xc6)
(func $AddAN
  call $readCodeMemory
  i32.const 0 ;; No carry
  call $AluAdd
)

;; rst N (0xc7, 0xcf, 0xd7, 0xdf, 0xe7, 0xef, 0xf7, 0xff)
(func $RstN
  (local $oldPC i32)
  i32.const $WZ#
  get_global $PC
  tee_local $oldPC
  call $pushValue
  (i32.and (get_global $opCode) (i32.const 0x38))
  i32.store16

  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; ret nz (0xc8)
(func $RetZ
  (call $incTacts (i32.const 1))
  call $testNZ
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; ret (0xc9)
(func $Ret
  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; jp z (0xca)
(func $JpZ
  call $readAddrToWZ
  call $testNZ
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; CB prefix
(func $SignCB
  i32.const $PREF_BIT# set_global $prefixMode
  i32.const 1 set_global $isInOpExecution
  i32.const 1 set_global $isInterruptBlocked
)

;; call z (0xcc)
(func $CallZ
  (local $oldPC i32)
  call $readAddrToWZ
  call $testNZ
  if return  end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; call (0xcd)
(func $CallNN
  (local $oldPC i32)
  call $readAddrToWZ

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC
  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; adc a,N (0xce)
(func $AdcAN
  call $readCodeMemory
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 1))
  call $AluAdd
)

;; ret nc (0xd0)
(func $RetNc
  ;; Adjust tacts
  (call $incTacts (i32.const 1))
  call $testC
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; pop de (0xd1)
(func $PopDE
  (i32.store16
    (i32.const $DE#)
    (call $popValue)
  )
)

;; jp nc (0xd2)
(func $JpNc
  call $readAddrToWZ
  call $testC
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; out (N),a (0xd3)
(func $OutNA
  (local $port i32)
  call $readCodeMemory
  (i32.shl (i32.load8_u (i32.const $A#)) (i32.const 8))
  i32.add
  tee_local $port
  (i32.load8_u (i32.const $A#))
  call $writePort

  ;; Update WZ
  (i32.store8
    (i32.const $WL#)
    (i32.add (get_local $port) (i32.const 1))
  )
  (i32.store8
    (i32.const $WH#)
    (i32.load8_u (i32.const $A#))
  )
)

;; call nc (0xd4)
(func $CallNc
  (local $oldPC i32)
  call $readAddrToWZ
  call $testC
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push de (0xd5)
(func $PushDE
  (i32.load16_u (i32.const $DE#))
  call $pushValue
)

;;  sub N (0xd6)
(func $SubAN
  call $readCodeMemory
  i32.const 0 ;; No carry
  call $AluSub
)

;; ret c (0xd8)
(func $RetC
  ;; Adjust tacts
  (call $incTacts (i32.const 1))
  call $testNC
  if return  end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; exx (0xd9)
(func $Exx
  (local $tmp i32)
  (i32.load16_u (i32.const $BC#))
  set_local $tmp
  (i32.store16
    (i32.const $BC#)
    (i32.load16_u offset=10 (get_global $REG_AREA_INDEX))
  )
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=10

  (i32.load16_u (i32.const $DE#))
  set_local $tmp
  (i32.store16
    (i32.const $DE#)
    (i32.load16_u offset=12 (get_global $REG_AREA_INDEX))
  )
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=12

  (i32.load16_u (i32.const $HL#))
  set_local $tmp
  (i32.store16
    (i32.const $HL#)
    (i32.load16_u offset=14 (get_global $REG_AREA_INDEX))
  )
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=14
)

;; jp c (0xda)
(func $JpC
  call $readAddrToWZ
  call $testNC
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; in a,(N) (0xdb)
(func $InAN
  (local $port i32)

  i32.const $A#
  call $readCodeMemory
  (i32.shl (i32.load8_u (i32.const $A#)) (i32.const 8))
  i32.add
  tee_local $port
  call $readPort
  i32.store8

  (i32.store16
    (i32.const $WZ#)
    (i32.add (get_local $port) (i32.const 1))
  )
)

;; call c (0xdc)
(func $CallC
  (local $oldPC i32)
  call $readAddrToWZ
  call $testNC
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; DD prefix
(func $SignDD
  i32.const $IND_IX# set_global $indexMode
  i32.const 1 set_global $isInOpExecution
  i32.const 1 set_global $isInterruptBlocked
)

;;  sbc N (0xde)
(func $SbcAN
  call $readCodeMemory
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 1))
  call $AluSub
)

;; ret po (0xe0)
(func $RetPo
  ;; Adjust tacts
  (call $incTacts (i32.const 1))
  call $testPE
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; pop hl (0xe1)
(func $PopHL
  (i32.store16
    (i32.const $HL#)
    (call $popValue)
  )
)

;; jp po (0xe2)
(func $JpPo
  call $readAddrToWZ
  call $testPE
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; ex (sp),hl (0xe3)
(func $ExSPiHL
  (local $tmpSp i32)
  i32.const $WZ#
  get_global $SP
  tee_local $tmpSp
  call $readMemory
  (i32.add (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  (i32.shl (call $readMemory) (i32.const 8))
  i32.add
  i32.store16

  ;; Adjust tacts
  (call $contendRead (get_local $tmpSp) (i32.const 1))

  ;; Write H to stack
  get_local $tmpSp
  (i32.load8_u (i32.const $H#))
  call $writeMemory

  ;; Write L to stack
  (i32.sub (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  (i32.load8_u (i32.const $L#))
  call $writeMemory

  ;; Adjust tacts
  (call $contendWrite (get_local $tmpSp) (i32.const 1))
  (call $contendWrite (get_local $tmpSp) (i32.const 1))

  ;; Copy WZ to HL
  (i32.store16
    (i32.const $HL#)
    (i32.load16_u (i32.const $WZ#))
  )
)

;; call po (0xe4)
(func $CallPo
  (local $oldPC i32)
  call $readAddrToWZ
  call $testPE
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push hl (0xe5)
(func $PushHL
  (i32.load16_u (i32.const $HL#))
  call $pushValue
)

;; and a,N (0xe6)
(func $AndAN
  call $readCodeMemory
  call $AluAnd
)

;; ret pe (0xe8)
(func $RetPe
  (call $incTacts (i32.const 1))
  call $testPO
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; jp (hl) (0xe9)
(func $JpHL
  (i32.load16_u (i32.const $HL#))
  call $setPC
)

;; jp po (0xea)
(func $JpPe
  call $readAddrToWZ
  call $testPO
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; ex de,hl (0xeb)
(func $ExDEHL
  (local $tmp i32)
  (set_local $tmp (i32.load16_u (i32.const $DE#)))
  (i32.store16
    (i32.const $DE#)
    (i32.load16_u (i32.const $HL#))
  )
  (i32.store16
    (i32.const $HL#)
    (get_local $tmp)
  )
)

;; call pe (0xec)
(func $CallPe
  (local $oldPC i32)
  call $readAddrToWZ
  call $testPO
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; ED prefix
(func  $SignED
  i32.const $PREF_EXT# set_global $prefixMode
  i32.const 1 set_global $isInOpExecution
  i32.const 1 set_global $isInterruptBlocked
)

;; xor a,N (0xee)
(func $XorAN
  call $readCodeMemory
  call $AluXor
)

;; ret p (0xf0)
(func $RetP
  (call $incTacts (i32.const 1))
  call $testM
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; pop af (0xf1)
(func $PopAF
  (i32.store16 
    (i32.const $AF#)
    (call $popValue)
  )
)

;; jp p (0xf2)
(func $JpP
  call $readAddrToWZ
  call $testM
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; di (0xf3)
(func $Di
  i32.const 0 set_global $iff1
  i32.const 0 set_global $iff2
)

;; call p (0xf4)
(func $CallP
  (local $oldPC i32)
  call $readAddrToWZ
  call $testM
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push af (0xf5)
(func $PushAF
  (i32.load16_u (i32.const $AF#))
  call $pushValue
)

;; or A,N (0xf6)
(func $OrAN
  call $readCodeMemory
  call $AluOr
)

;; ret m (0xf8)
(func $RetM
  (call $incTacts (i32.const 1))
  call $testP
  if return end

  (i32.store16
    (i32.const $WZ#)
    (call $popValue)
  )
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  call $popFromStepOver
)

;; ld sp,hl
(func $LdSPHL
  (i32.load16_u (i32.const $HL#))
  call $setSP
  (call $incTacts (i32.const 2))
)

;; jp m (0xfa)
(func $JpM
  call $readAddrToWZ
  call $testP
  if return end

  (i32.load16_u (i32.const $WZ#))
  call $setPC
)

;; ei (0xfb)
(func $Ei
  i32.const 1 set_global $isInterruptBlocked
  i32.const 1 set_global $iff1
  i32.const 1 set_global $iff2
  i32.const 3 set_global $backlogCount
)

;; call m (0xfc)
(func $CallM
  (local $oldPC i32)
  call $readAddrToWZ
  call $testP
  if return end

  ;; Adjust tacts
  (call $contendRead (get_global $PC) (i32.const 0))

  get_global $PC
  tee_local $oldPC

  call $pushValue
  (i32.load16_u (i32.const $WZ#))
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; FD prefix
(func $SignFD
  i32.const $IND_IY# set_global $indexMode
  i32.const 1 set_global $isInOpExecution
  i32.const 1 set_global $isInterruptBlocked
)

;; call cp N (0xfe)
(func $CpAN
  call $readCodeMemory
  call $AluCp
)


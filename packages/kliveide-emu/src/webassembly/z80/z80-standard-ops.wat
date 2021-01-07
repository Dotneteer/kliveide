;; ==========================================================================
;; Standard operations

;; ld bc,NN (0x01)
(func $LdBCNN
  (call $setBC (call $readCode16))
)

;; ld (bc),a (0x02)
(func $LdBCiA
  (call $writeMemory (call $getBC) (call $getA))

  ;; Update WZ
  (call $setWL (call $getA))
  (call $setWH (i32.add (call $getBC) (i32.const 1)))
)

;; inc bc (0x03)
(func $IncBC
  (call $setBC (i32.add (call $getBC) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc b (0x04)
(func $IncB
  (local $v i32)
  call $getB
  (call $setB (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec b (0x05)
(func $DecB
  (local $v i32)
  call $getB
  (call $setB (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld b,N (0x06)
(func $LdBN
  (call $setB (call $readCodeMemory))
)

;; rlca (0x07)
(func $Rlca
  (i32.or
    (i32.shl (call $getA) (i32.const 1))
    (i32.shr_u (call $getA) (i32.const 7))
  )
  call $setA

  i32.const $F#
  (i32.or
    ;; S, Z, PV flags mask
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4))
    ;; R5, R3, C from result 
    (i32.and (call $getA) (i32.const 0x29)) 
  )
  i32.store8
)

;; ex af,af' (0x08)
(func $ExAf
  (local $tmp i32)
  (set_local $tmp (call $getAF))
  (call $setAF (i32.load16_u offset=8 (get_global $REG_AREA_INDEX)))
  (i32.store16 offset=8 (get_global $REG_AREA_INDEX) (get_local $tmp))
)

;; add hl,bc (0x09)
(func $AddHLBC
  (call $AluAdd16 (call $getHL) (call $getBC))
  call $setHL
)

;; ld a,(bc) (0x0a)
(func $LdABCi
  ;; Calculate WZ
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ

  ;; Read A from (BC)
  (call $readMemory (call $getBC))
  (call $setA (i32.and (i32.const 0xff)))
)

;; dec bc (0x0b)
(func $DecBC
  (call $setBC (i32.sub (call $getBC) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc c (0x0c)
(func $IncC
  (local $v i32)
  call $getC
  (call $setC (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec c (0x0d)
(func $DecC
  (local $v i32)
  call $getC
  (call $setC (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld c,N (0x0e)
(func $LdCN
  (call $setC (call $readCodeMemory))
)

;; rrca (0x0f)
(func $Rrca
  (local $newC i32)
  ;; Calc new C flag
  (i32.and (call $getA) (i32.const 1))
  set_local $newC

  ;; Shift value
  (i32.shr_u (call $getA) (i32.const 1))

  ;; Combine with C flag
  (i32.shl (get_local $newC) (i32.const 7))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Calc the new F
  i32.const $F#
  (i32.or
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
    (i32.and (call $getA) (i32.const 0x28)) ;; Keey R3 and R5
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
  (i32.sub (call $getB) (i32.const 1))
  call $setB

  ;; Reached 0?
  (i32.eqz (call $getB))
  if return end

  ;; Jump
  (call $relativeJump (get_local $e))
)

;; ld de,NN (0x11)
(func $LdDENN
  (call $setDE (call $readCode16))
)

;; ld (de),a (0x12)
(func $LdDEiA
  ;; Update WZ
  (call $setWH (i32.add (call $getDE) (i32.const 1)))
  (call $setWL (call $getA))
  (call $writeMemory (call $getDE) (call $getA))
)

;; inc de (0x13)
(func $IncDE
  (call $setDE (i32.add (call $getDE) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc d (0x14)
(func $IncD
  (local $v i32)
  call $getD
  (call $setD (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec d (0x15)
(func $DecD
  (local $v i32)
  call $getD
  (call $setD (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld d,N (0x16)
(func $LdDN
  (call $setD (call $readCodeMemory))
)

;; rla (0x17)
(func $Rla
  (local $res i32)
  (local $newC i32)
  ;; Shift left
  (i32.shl (call $getA) (i32.const 1))
  tee_local $res

  ;; Calculate new C flag
  i32.const 8
  i32.shr_u
  i32.const 0x01 ;; C Flag mask
  i32.and
  set_local $newC

  ;; Adjust with current C flag
  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C Flag mask
  i32.and
  get_local $res
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Calculate new C Flag
  i32.const $F#
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
  (i32.and (call $getA) (i32.const 0x28)) ;; Keep R3 and R5
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
  (call $AluAdd16 (call $getHL) (call $getDE))
  call $setHL
)

;; ld a,(de) (0x1a)
(func $LdADEi
  ;; Calculate WZ
  (i32.add (call $getDE) (i32.const 1))
  call $setWZ

  ;; Read A from (DE)
  call $getDE
  call $readMemory
  (call $setA (i32.and (i32.const 0xff)))
)

;; dec de (0x1b)
(func $DecDE
  (call $setDE (i32.sub (call $getDE) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc e (0x1c)
(func $IncE
  (local $v i32)
  call $getE
  (call $setE (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec e (0x1d)
(func $DecE
  (local $v i32)
  call $getE
  (call $setE (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld e,N (0x1e)
(func $LdEN
  (call $setE (call $readCodeMemory))
)

;; rra (0x1f)
(func $Rra
  (local $newC i32)

  ;; Calculate the new C flag
  (i32.and (call $getA) (i32.const 1))
  set_local $newC

  ;; Shift right
  (i32.shr_u (call $getA) (i32.const 1))

  ;; Adjust with current C flag
  (i32.load8_u (i32.const $F#))
  i32.const 0x01 ;; C Flag mask
  i32.and
  i32.const 7
  i32.shl
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Calculate new C Flag
  i32.const $F#
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc4)) ;; Keep S, Z, PV
  (i32.and (call $getA) (i32.const 0x28)) ;; Keep R3 and R5
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
  (call $setHL (call $readCode16))
)

;; ld (NN),hl (0x22)
(func $LdNNiHL
  (local $addr i32)
  ;; Obtain the address to store HL
  (tee_local $addr (call $readCode16))

  ;; Set WZ to addr + 1
  (call $setWZ (i32.add (i32.const 1)))

  ;; Store HL
  (call $writeMemory (get_local $addr) (call $getL))
  (call $writeMemory (call $getWZ) (call $getH))
)

;; inc hl (0x23)
(func $IncHL
  (call $setHL (i32.add (call $getHL) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc h (0x24)
(func $IncH
  (local $v i32)
  call $getH
  (call $setH (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec h (0x25)
(func $DecH
  (local $v i32)
  call $getH
  (call $setH (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld h,N (0x26)
(func $LdHN
  (call $setH (call $readCodeMemory))
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
  call $getA
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
  get_local $a
  get_local $diff
  i32.sub
  call $getA
  get_local $diff
  i32.add
  get_local $nFlag
  select
  tee_local $a
  (call $setA (i32.and (i32.const 0xff)))

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
  call $getA
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
  (call $AluAdd16 (call $getHL) (call $getHL))
  call $setHL
)

;; ld hl,(NN) (0x2a)
(func $LdHLNNi
  (local $addr i32)
  ;; Read the address
  (tee_local $addr (call $readCode16))

  ;; Set WZ to addr + 1
  (call $setWZ (i32.add (i32.const 1)))

  ;; Read HL from memory
  (call $setL (call $readMemory (get_local $addr)))
  (call $setH (call $readMemory (call $getWZ)))
)

;; dec hl (0x2b)
(func $DecHL
  (call $setHL (i32.sub (call $getHL) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc l (0x2c)
(func $IncL
  (local $v i32)
  call $getL
  (call $setL (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec l (0x2d)
(func $DecL
  (local $v i32)
  call $getL
  (call $setL (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld l,N (0x2e)
(func $LdLN
  (call $setL (call $readCodeMemory))
)

;; cpl (0x2f)
(func $Cpl
  ;; New value of A
  (i32.xor (call $getA) (i32.const 0xff))
  (call $setA (i32.and (i32.const 0xff)))

  i32.const $F#
  ;; New F
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0xc5)) ;; Keep S, Z, PV, C
  (i32.and (call $getA) (i32.const 0x28)) ;; Keep R3 and R5
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
  (tee_local $addr (call $readCode16))

  ;; Adjust WZ
  (call $setWL (i32.add (i32.const 1)))
  (call $setWH (call $getA))

  ;; Store A
  (call $writeMemory (get_local $addr) (call $getA))
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
  (call $readMemory (call $getHL))
  set_local $v

  ;; Adjust tacts
  (call $contendRead (call $getHL) (i32.const 1))

  ;; Increment value
  call $getHL
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
  (call $readMemory (call $getHL))
  set_local $v

  ;; Adjust tacts
  (call $contendRead (call $getHL) (i32.const 1))

  ;; Increment value
  call $getHL
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
  (call $writeMemory (call $readCodeMemory (call $getHL)))
)

;; scf (0x37)
(func $Scf
  i32.const $F#
  (i32.and (call $getA) (i32.const 0x28)) ;; Mask for R5, R3
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
  (call $AluAdd16 (call $getHL) (get_global $SP))
  call $setHL
)

;; ld a,(NN) (0x3a)
(func $LdANNi
  (local $addr i32)

  ;; Read the address
  (tee_local $addr (call $readCode16))
  
  ;; Set WZ to addr + 1
  (call $setWZ (i32.const 1) (i32.add))
  
  ;; Read A from memory
  (call $readMemory (get_local $addr))
  (call $setA (i32.and (i32.const 0xff)))
)

;; dec sp (0x3b)
(func $DecSP
  (call $setSP (i32.sub (get_global $SP) (i32.const 1)))
  (call $incTacts (i32.const 2))
)

;; inc a (0x3c)
(func $IncA
  (local $v i32)
  call $getA
  (call $setA (i32.add (tee_local $v) (i32.const 1)))
  (call $adjustIncFlags (get_local $v))
)

;; dec a (0x3d)
(func $DecA
  (local $v i32)
  call $getA
  (call $setA (i32.sub (tee_local $v) (i32.const 1)))
  (call $adjustDecFlags (get_local $v))
)

;; ld a,N (0x3e)
(func $LdAN
  (call $setA (call $readCodeMemory))
)

;; ccf (0x3f)
(func $Ccf
  (local $cFlag i32)

  i32.const $F#

  (i32.and (call $getA) (i32.const 0x28)) ;; Mask for R5, R3
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
  (call $setB (call $getC))
)

;; ld b,d (0x42)
(func $LdBD
  (call $setB (call $getD))
)

;; ld b,e (0x43)
(func $LdBE
  (call $setB (call $getE))
)

;; ld b,h (0x44)
(func $LdBH
  (call $setB (call $getH))
)

;; ld b,l (0x45)
(func $LdBL
  (call $setB (call $getL))
)

;; ld b,(hl) (0x46)
(func $LdBHLi
  (call $setB (call $readMemory (call $getHL)))
)

;; ld b,a (0x47)
(func $LdBA
  (call $setB (call $getA))
)

;; ld c,b (0x48)
(func $LdCB
  (call $setC (call $getB))
)

;; ld c,d (0x4a)
(func $LdCD
  (call $setC (call $getD))
)

;; ld c,e (0x4b)
(func $LdCE
  (call $setC (call $getE))
)

;; ld c,h (0x4c)
(func $LdCH
  (call $setC (call $getH))
)

;; ld c,l (0x4d)
(func $LdCL
  (call $setC (call $getL))
)

;; ld c,(hl) (0x4e)
(func $LdCHLi
  (call $setC (call $readMemory (call $getHL)))
)

;; ld c,a (0x4f)
(func $LdCA
  (call $setC (call $getA))
)

;; ld d,b (0x50)
(func $LdDB
  (call $setD (call $getB))
)

;; ld d,c (0x51)
(func $LdDC
  (call $setD (call $getC))
)

;; ld d,e (0x53)
(func $LdDE
  (call $setD (call $getE))
)

;; ld d,h (0x54)
(func $LdDH
  (call $setD (call $getH))
)

;; ld d,l (0x55)
(func $LdDL
  (call $setD (call $getL))
)

;; ld d,(hl) (0x56)
(func $LdDHLi
  (call $setD (call $readMemory (call $getHL)))
)

;; ld d,a (0x57)
(func $LdDA
  (call $setD (call $getA))
)

;; ld e,b (0x58)
(func $LdEB
  (call $setE (call $getB))
)

;; ld e,c (0x59)
(func $LdEC
  (call $setE (call $getC))
)

;; ld e,d (0x5a)
(func $LdED
  (call $setE (call $getD))
)

;; ld e,h (0x5c)
(func $LdEH
  (call $setE (call $getH))
)

;; ld e,l (0x5d)
(func $LdEL
  (call $setE (call $getL))
)

;; ld e,(hl) (0x5e)
(func $LdEHLi
  (call $setE (call $readMemory (call $getHL)))
)

;; ld e,a (0x5f)
(func $LdEA
  (call $setE (call $getA))
)

;; ld h,b (0x60)
(func $LdHB
  (call $setH (call $getB))
)

;; ld h,c (0x61)
(func $LdHC
  (call $setH (call $getC))
)

;; ld h,d (0x62)
(func $LdHD
  (call $setH (call $getD))
)

;; ld h,e (0x63)
(func $LdHE
  (call $setH (call $getE))
)

;; ld h,l (0x65)
(func $LdHL
  (call $setH (call $getL))
)

;; ld h,(hl) (0x66)
(func $LdHHLi
  (call $setH (call $readMemory (call $getHL)))
)

;; ld h,a (0x67)
(func $LdHA
  (call $setH (call $getA))
)

;; ld l,b (0x68)
(func $LdLB
  (call $setL (call $getB))
)

;; ld l,c (0x69)
(func $LdLC
  (call $setL (call $getC))
)

;; ld l,d (0x6a)
(func $LdLD
  (call $setL (call $getD))
)

;; ld l,e (0x6b)
(func $LdLE
  (call $setL (call $getE))
)

;; ld l,h (0x6c)
(func $LdLH
  (call $setL (call $getH))
)

;; ld l,(hl) (0x6e)
(func $LdLHLi
  (call $setL (call $readMemory (call $getHL)))
)

;; ld l,a (0x6f)
(func $LdLA
  (call $setL (call $getA))
)

;; ld (hl),b (0x70)
(func $LdHLiB
  (call $writeMemory (call $getHL) (call $getB))
)

;; ld (hl),c (0x71)
(func $LdHLiC
  (call $writeMemory (call $getHL) (call $getC))
)

;; ld (hl),d (0x72)
(func $LdHLiD
  (call $writeMemory (call $getHL) (call $getD))
)

;; ld (hl),e (0x73)
(func $LdHLiE
  (call $writeMemory (call $getHL) (call $getE))
)

;; ld (hl),h (0x74)
(func $LdHLiH
  (call $writeMemory (call $getHL) (call $getH))
)

;; ld (hl),l (0x75)
(func $LdHLiL
  (call $writeMemory (call $getHL) (call $getL))
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
  (call $writeMemory (call $getHL) (call $getA))
)

;; ld a,b (0x78)
(func $LdAB
  (call $setA (call $getB))
)

;; ld a,c (0x79)
(func $LdAC
  (call $setA (call $getC))
)

;; ld a,d (0x7a)
(func $LdAD
  (call $setA (call $getD))
)

;; ld a,e (0x7b)
(func $LdAE
  (call $setA (call $getE))
)

;; ld a,h (0x7c)
(func $LdAH
  (call $setA (call $getH))
)

;; ld a,l (0x7d)
(func $LdAL
  (call $setA (call $getL))
)

;; ld a,(hl) (0x7e)
(func $LdAHLi
  (call $setA (call $readMemory (call $getHL)))
)

;; add a,b (0x80)
(func $AddAB
  (call $AluAdd (call $getB) (i32.const 0))
)

;; add a,c (0x81)
(func $AddAC
  (call $AluAdd (call $getC) (i32.const 0))
)

;; add a,d (0x82)
(func $AddAD
  (call $AluAdd (call $getD) (i32.const 0))
)

;; add a,e (0x83)
(func $AddAE
  (call $AluAdd (call $getE) (i32.const 0))
)

;; add a,h (0x84)
(func $AddAH
  (call $AluAdd (call $getH) (i32.const 0))
)

;; add a,l (0x85)
(func $AddAL
  (call $AluAdd (call $getL) (i32.const 0))
)

;; add a,(hl) (0x86)
(func $AddAHLi
  (call $AluAdd (call $readMemory (call $getHL)) (i32.const 0))
)

;; add a,a (0x87)
(func $AddAA
  (call $AluAdd (call $getA) (i32.const 0))
)

;; adc a,b (0x88)
(func $AdcAB
  (call $AluAdd 
    (call $getB) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,c (0x89)
(func $AdcAC
  (call $AluAdd 
    (call $getC) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,d (0x8a)
(func $AdcAD
  (call $AluAdd 
    (call $getD) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,e (0x8b)
(func $AdcAE
  (call $AluAdd 
    (call $getE) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,h (0x8c)
(func $AdcAH
  (call $AluAdd 
    (call $getH) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,l (0x8d)
(func $AdcAL
  (call $AluAdd 
    (call $getL) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,(hl) (0x8e)
(func $AdcAHLi
  (call $AluAdd 
    (call $readMemory (call $getHL))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; adc a,a (0x8f)
(func $AdcAA
  (call $AluAdd 
    (call $getA) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sub B (0x90)
(func $SubAB
  (call $AluSub (call $getB) (i32.const 0))
)

;; sub C (0x91)
(func $SubAC
  (call $AluSub (call $getC) (i32.const 0))
)

;; sub D (0x92)
(func $SubAD
  (call $AluSub (call $getD) (i32.const 0))
)

;; sub E (0x93)
(func $SubAE
  (call $AluSub (call $getE) (i32.const 0))
)

;; sub H (0x94)
(func $SubAH
  (call $AluSub (call $getH) (i32.const 0))
)

;; sub L (0x95)
(func $SubAL
  (call $AluSub (call $getL) (i32.const 0))
)

;; sub (hl) (0x96)
(func $SubAHLi
  (call $AluSub (call $readMemory (call $getHL)) (i32.const 0))
)

;; sub A (0x97)
(func $SubAA
  (call $AluSub (call $getA) (i32.const 0))
)

;; sbc a,b (0x98)
(func $SbcAB
  (call $AluSub 
    (call $getB) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,c (0x99)
(func $SbcAC
  (call $AluSub 
    (call $getC) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,d (0x9a)
(func $SbcAD
  (call $AluSub 
    (call $getD) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,e (0x9b)
(func $SbcAE
  (call $AluSub 
    (call $getE) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,h (0x9c)
(func $SbcAH
  (call $AluSub 
    (call $getH) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,l (0x9d)
(func $SbcAL
  (call $AluSub 
    (call $getL) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,(hl) (0x9e)
(func $SbcAHLi
  (call $AluSub
    (call $readMemory (call $getHL))
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; sbc a,a (0x9f)
(func $SbcAA
  (call $AluSub 
    (call $getA) 
    (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  )
)

;; and b (0xa0)
(func $AndAB
  (call $AluAnd (call $getB))
)

;; and c (0xa1)
(func $AndAC
  (call $AluAnd (call $getC))
)

;; and d (0xa2)
(func $AndAD
  (call $AluAnd (call $getD))
)

;; and e (0xa3)
(func $AndAE
  (call $AluAnd (call $getE))
)

;; and h (0xa4)
(func $AndAH
  (call $AluAnd (call $getH))
)

;; and l (0xa5)
(func $AndAL
  (call $AluAnd (call $getL))
)

;; and (hl) (0xa6)
(func $AndAHLi
  (call $AluAnd (call $readMemory (call $getHL)))
)

;; and a (0xa7)
(func $AndAA
  (call $AluAnd (call $getA))
)

;; xor b (0xa8)
(func $XorAB
  (call $AluXor (call $getB))
)

;; xor c (0xa9)
(func $XorAC
  (call $AluXor (call $getC))
)

;; xor d (0xaa)
(func $XorAD
  (call $AluXor (call $getD))
)

;; xor e (0xab)
(func $XorAE
  (call $AluXor (call $getE))
)

;; xor h (0xac)
(func $XorAH
  (call $AluXor (call $getH))
)

;; xor l (0xad)
(func $XorAL
  (call $AluXor (call $getL))
)

;; xor (hl) (0xae)
(func $XorAHLi
  (call $AluXor (call $readMemory (call $getHL)))
)

;; xor a (0xaf)
(func $XorAA
  (call $AluXor (call $getA))
)

;; or b (0xb0)
(func $OrAB
  (call $AluOr (call $getB))
)

;; or c (0xb2)
(func $OrAC
  (call $AluOr (call $getC))
)

;; or d (0xb2)
(func $OrAD
  (call $AluOr (call $getD))
)

;; or e (0xb3)
(func $OrAE
  (call $AluOr (call $getE))
)

;; or h (0xb4)
(func $OrAH
  (call $AluOr (call $getH))
)

;; or l (0xb5)
(func $OrAL
  (call $AluOr (call $getL))
)

;; or (hl) (0xb6)
(func $OrAHLi
  (call $AluOr (call $readMemory (call $getHL)))
)

;; or a (0xb7)
(func $OrAA
  (call $AluOr (call $getA))
)

;; cp b (0xb8)
(func $CpAB
  (call $AluCp (call $getB))
)

;; cp c (0xb9)
(func $CpAC
  (call $AluCp (call $getC))
)

;; cp d (0xba)
(func $CpAD
  (call $AluCp (call $getD))
)

;; cp e (0xbb)
(func $CpAE
  (call $AluCp (call $getE))
)

;; cp h (0xbc)
(func $CpAH
  (call $AluCp (call $getH))
)

;; cp l (0xbd)
(func $CpAL
  (call $AluCp (call $getL))
)

;; cp (hl) (0xbe)
(func $CpAHLi
  (call $AluCp (call $readMemory (call $getHL)))
)

;; cp a (0xbf)
(func $CpAA
  (call $AluCp (call $getA))
)

;; ret nz (0xc0)
(func $RetNz
  (call $incTacts (i32.const 1))
  call $testZ
  if return end

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; pop bc (0xc1)
(func $PopBC
  call $popValue
  call $setBC
)

;; jp nz (0xc2)
(func $JpNz
  call $readAddrToWZ
  call $testZ
  if return end

  call $getWZ
  call $setPC
)

;; jp (0xc3)
(func $Jp
  call $readAddrToWZ
  call $getWZ
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
  call $getWZ
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push bc (0xc5)
(func $PushBC
  call $getBC
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
  get_global $PC
  tee_local $oldPC
  call $pushValue
  (i32.and (get_global $opCode) (i32.const 0x38))
  call $setWZ
  call $getWZ
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; ret nz (0xc8)
(func $RetZ
  (call $incTacts (i32.const 1))
  call $testNZ
  if return end

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; ret (0xc9)
(func $Ret
  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; jp z (0xca)
(func $JpZ
  call $readAddrToWZ
  call $testNZ
  if return end

  call $getWZ
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
  call $getWZ
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
  call $getWZ
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; pop de (0xd1)
(func $PopDE
  call $popValue
  call $setDE
)

;; jp nc (0xd2)
(func $JpNc
  call $readAddrToWZ
  call $testC
  if return end

  call $getWZ
  call $setPC
)

;; out (N),a (0xd3)
(func $OutNA
  (local $port i32)
  call $readCodeMemory
  (i32.shl (call $getA) (i32.const 8))
  i32.add
  tee_local $port
  call $getA
  call $writePort

  ;; Update WZ
  (call $setWL (i32.add (get_local $port) (i32.const 1)))
  (call $setWH (call $getA))
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
  call $getWZ
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push de (0xd5)
(func $PushDE
  call $getDE
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; exx (0xd9)
(func $Exx
  (local $tmp i32)
  call $getBC
  set_local $tmp
  get_global $REG_AREA_INDEX
  i32.load16_u offset=10
  call $setBC
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=10

  call $getDE
  set_local $tmp
  get_global $REG_AREA_INDEX
  i32.load16_u offset=12
  call $setDE
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=12

  call $getHL
  set_local $tmp
  get_global $REG_AREA_INDEX
  i32.load16_u offset=14
  call $setHL
  get_global $REG_AREA_INDEX
  get_local $tmp
  i32.store16 offset=14
)

;; jp c (0xda)
(func $JpC
  call $readAddrToWZ
  call $testNC
  if return end

  call $getWZ
  call $setPC
)

;; in a,(N) (0xdb)
(func $InAN
  (local $port i32)

  call $readCodeMemory
  (i32.shl (call $getA) (i32.const 8))
  i32.add
  tee_local $port
  call $readPort
  (call $setA (i32.and (i32.const 0xff)))

  (i32.add (get_local $port) (i32.const 1))
  call $setWZ
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
  call $getWZ
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; pop hl (0xe1)
(func $PopHL
  call $popValue
  call $setHL
)

;; jp po (0xe2)
(func $JpPo
  call $readAddrToWZ
  call $testPE
  if return end

  call $getWZ
  call $setPC
)

;; ex (sp),hl (0xe3)
(func $ExSPiHL
  (local $tmpSp i32)
  get_global $SP
  tee_local $tmpSp
  call $readMemory
  (i32.add (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  (i32.shl (call $readMemory) (i32.const 8))
  i32.add
  call $setWZ

  ;; Adjust tacts
  (call $contendRead (get_local $tmpSp) (i32.const 1))

  ;; Write H to stack
  get_local $tmpSp
  call $getH
  call $writeMemory

  ;; Write L to stack
  (i32.sub (get_local $tmpSp) (i32.const 1))
  tee_local $tmpSp
  call $getL
  call $writeMemory

  ;; Adjust tacts
  (call $contendWrite (get_local $tmpSp) (i32.const 1))
  (call $contendWrite (get_local $tmpSp) (i32.const 1))

  ;; Copy WZ to HL
  call $getWZ
  call $setHL
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
  call $getWZ
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push hl (0xe5)
(func $PushHL
  call $getHL
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; jp (hl) (0xe9)
(func $JpHL
  call $getHL
  call $setPC
)

;; jp po (0xea)
(func $JpPe
  call $readAddrToWZ
  call $testPO
  if return end

  call $getWZ
  call $setPC
)

;; ex de,hl (0xeb)
(func $ExDEHL
  (local $tmp i32)
  call $getDE
  set_local $tmp
  call $getHL
  call $setDE
  get_local $tmp
  call $setHL
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
  call $getWZ
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; pop af (0xf1)
(func $PopAF
  call $popValue
  call $setAF
)

;; jp p (0xf2)
(func $JpP
  call $readAddrToWZ
  call $testM
  if return end

  call $getWZ
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
  call $getWZ
  call $setPC

  (call $pushToStepOver (get_local $oldPC))
)

;; push af (0xf5)
(func $PushAF
  call $getAF
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

  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; ld sp,hl
(func $LdSPHL
  call $getHL
  call $setSP
  (call $incTacts (i32.const 2))
)

;; jp m (0xfa)
(func $JpM
  call $readAddrToWZ
  call $testP
  if return end

  call $getWZ
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
  call $getWZ
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


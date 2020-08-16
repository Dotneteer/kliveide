;; ==========================================================================
;; Extended instructions

;; swapnib (0x23)
(func $SwapNib
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.shl (call $getA) (i32.const 4))
  (i32.shr_u (call $getA) (i32.const 4))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))
)

;; mirror (0x24)
(func $Mirror
  (local $a i32)
  (local $newA i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  i32.const 0
  set_local $newA
  (i32.or (call $getA) (i32.const 0xff00))
  set_local $a
  loop $mirror_loop
    ;; Get the rightmost bit of A
    (i32.and (get_local $a) (i32.const 0x01))

    ;; Pull it into new A from right
    (i32.shl (get_local $newA) (i32.const 1))
    i32.or
    set_local $newA

    ;; Shift A
    (i32.shr_u (get_local $a) (i32.const 1))
    tee_local $a

    ;; Test branch condition
    i32.const 0xff00
    i32.and
    br_if $mirror_loop
  end
  (call $setA (i32.and (get_local $newA)(i32.const 0xff)))
)

;; test N (0x27)
(func $TestN
  (local $a i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  call $getA
  set_local $a

  call $readCodeMemory
  call $AluAnd

  get_local $a
  (call $setA (i32.and (i32.const 0xff)))
)

;; bsla de,b (0x28)
(func $Bsla
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shl
  call $setDE
)

;; bsra de,b (0x29)
(func $Bsra
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.and (call $getDE) (i32.const 0x8000))
  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shr_u
  i32.or
  call $setDE
)

;; bsrl de,b (0x2a)
(func $Bsrl
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shr_u
  call $setDE
)

;; bsrf de,b (0x2b)
(func $Bsrf
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.xor (call $getDE) (i32.const 0xffff))
  (i32.and (call $getB) (i32.const 0x0f))
  i32.shr_u
  i32.const 0xffff
  i32.xor
  call $setDE
)

;; brlc de,b (0x2c)
(func $Brlc
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  call $getDE
  (i32.and (call $getB) (i32.const 0x0f))
  i32.shl

  call $getDE
  i32.const 16
  (i32.and (call $getB) (i32.const 0x0f))
  i32.sub
  i32.shr_u
  i32.or
  call $setDE
)

;; mul (0x30)
(func $Mul
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.mul (call $getD) (call $getE))
  call $setDE
)

;; add hl,a (0x31)
(func $AddHLA
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getHL) (call $getA))
  call $setHL
)

;; add de,a (0x32)
(func $AddDEA
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getDE) (call $getA))
  call $setDE
)

;; add bc,a (0x33)
(func $AddBCA
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getBC) (call $getA))
  call $setBC
)

;; add hl,NN (0x34)
(func $AddHLNN
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getHL) (call $readAddrFromCode))
  call $setHL
  (call $incTacts (i32.const 2))
)

;; add de,NN (0x35)
(func $AddDENN
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getDE) (call $readAddrFromCode))
  call $setDE
  (call $incTacts (i32.const 2))
)

;; add bc,NN (0x36)
(func $AddBCNN
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  (i32.add (call $getBC) (call $readAddrFromCode))
  call $setBC
  (call $incTacts (i32.const 2))
)

;; in b,(c) (0x40)
(func $InBC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setB
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),b (0x41)
(func $OutCB
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getB))
)

;; sbc hl,bc (0x42)
(func $SbcHLBC
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getBC))
  (call $incTacts (i32.const 7))
)

;; ld (NN),bc (0x43)
(func $LdNNiBC
  (local $addr i32)
  call $readAddrFromCode
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (call $getC))
  call $getWZ
  (call $writeMemory (call $getB))
)

;; in c,(c) (0x48)
(func $InCC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setC
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),c (0x49)
(func $OutCC
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getC))
)

;; in d,(c) (0x50)
(func $InDC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setD
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),d (0x51)
(func $OutCD
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getD))
)

;; in e,(c) (0x58)
(func $InEC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setE
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),e (0x59)
(func $OutCE
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getE))
)

;; in h,(c) (0x60)
(func $InHC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setH
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),h (0x61)
(func $OutCH
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getH))
)

;; in l,(c) (0x68)
(func $InLC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setL
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),l (0x69)
(func $OutCL
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getL))
)

;; in (c) (0x70)
(func $In0C
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  set_local $pval
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),0 (0x71)
(func $OutC0
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (i32.const 0))
)

;; in a,(c) (0x78)
(func $InAC
  (local $pval i32)
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $readPort (call $getBC))
  tee_local $pval
  call $setA
  
  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (get_local $pval))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; out (c),a (0x79)
(func $OutCA
  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
  (call $writePort (call $getBC) (call $getA))
)

;; ld (NN),QQ 
(func $LdNNiQQ
  (local $qq i32)
  (local $addr i32)

  ;; Obtain address
  call $readAddrFromCode
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ

  ;; Obtain reg value
  (i32.shr_u 
    (i32.and (get_global $opCode) (i32.const 0x30))
    (i32.const 4)
  )
  call $getReg16
  set_local $qq

  get_local $addr
  (i32.and (get_local $qq) (i32.const 0xff))
  call $writeMemory
  call $getWZ
  (i32.shr_u (get_local $qq) (i32.const 8))
  call $writeMemory
)

;; neg
(func $Neg
  (local $a i32)
  ;; Calc the new value of A
  (i32.sub (i32.const 0) (call $getA))
  i32.const 0xff
  i32.and
  tee_local $a

  ;; Keep S, R5, R3
  i32.const 0xA8 ;; Mask for S|R5|R3
  i32.and ;; (S|R5|R3)
  ;; Set N
  i32.const 0x02 ;; (S|R5|R3, N)

  ;; Calculate Z
  i32.const 0x00
  i32.const 0x40
  (i32.ne (get_local $a) (i32.const 0))
  select ;; (S|R5|R3, N, Z)

  ;; Calculate C
  i32.const 0x01
  i32.const 0x00
  (i32.ne (get_local $a) (i32.const 0))
  select ;; (S|R5|R3, N, Z, C)

  ;; Calculate PV
  i32.const 0x04
  i32.const 0x00
  (i32.eq (get_local $a) (i32.const 0x80))
  select ;; (S|R5|R3, N, Z, C, PV)

  ;; Calculate H
  i32.const 0
  call $getA
  i32.const 0x0f
  i32.and
  i32.const 24
  i32.shl
  i32.const 24
  i32.shr_s
  i32.sub
  i32.const 0x10
  i32.and ;; (S|R5|R3, N, Z, C, PV, H)

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))

  ;; Store the result
  get_local $a
  (call $setA (i32.and (i32.const 0xff)))
)

;; retn/reti
(func $Retn
  get_global $iff2
  set_global $iff1
  call $popValue
  call $setWZ
  call $getWZ
  call $setPC

  call $popFromStepOver
)

;; im N
(func $ImN
  (local $mode i32)
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x18))
    (i32.const 3)
  )
  (i32.lt_u (tee_local $mode) (i32.const 2))
  if (result i32)
    i32.const 1
  else
    get_local $mode
  end
  i32.const 1
  i32.sub
  set_global $interruptMode
)

;; ld i,a 0x47
(func $LdIA
  call $getA
  call $setI    
  (call $incTacts (i32.const 1))
)

;; adc hl,bc (0x4a)
(func $AdcHLBC
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getBC))
  (call $incTacts (i32.const 7))
)

;; ld bc,(NN) (0x4b)
(func $LdBCNNi
  (local $addr i32)
  call $readAddrFromCode
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $setC (call $readMemory (get_local $addr)))
  (call $setB (call $readMemory (call $getWZ)))
)

;; ld r,a 0x4f
(func $LdRA
  call $getA
  call $setR    
  (call $incTacts (i32.const 1))
)

;; sbc hl,de (0x52)
(func $SbcHLDE
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getDE))
  (call $incTacts (i32.const 7))
)

;; ld (NN),de (0x53)
(func $LdNNiDE
  (local $addr i32)
  call $readAddrFromCode
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (call $getE))
  call $getWZ
  (call $writeMemory (call $getD))
)

;; ld a,i (0x57)
(func $LdAXr
  (local $xr i32)
  (i32.and (get_global $opCode) (i32.const 0x08))
  if (result i32)
    call $getR
  else
    call $getI
  end
  tee_local $xr
  (call $setA (i32.and (i32.const 0xff)))

  ;; Set flags
  (i32.and (call $getF) (i32.const 0x01)) ;; (C)
  (i32.and (get_local $xr) (i32.const 0xa8)) ;; (C, S|R5|R3)

  i32.const 0x04
  i32.const 0x00
  get_global $iff2
  select  ;; (C, S|R5|R3, PV)

  i32.const 0x00
  i32.const 0x40
  get_local $xr
  select  ;; (C, S|R5|R3, PV, Z)

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
  (call $incTacts (i32.const 1))
)

;; adc hl,de (0x5a)
(func $AdcHLDE
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getDE))
  (call $incTacts (i32.const 7))
)

;; ld de,(NN) (0x5b)
(func $LdDENNi
  (local $addr i32)
  call $readAddrFromCode
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $setE (call $readMemory (get_local $addr)))
  (call $setD (call $readMemory (call $getWZ)))
)

;; sbc hl,hl (0x62)
(func $SbcHLHL
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (call $getHL))
  (call $incTacts (i32.const 7))
)

;; rrd (0x67)
(func $Rrd
  (local $hl i32)
  (local $tmp i32)
  call $getHL
  tee_local $hl
  call $readMemory
  set_local $tmp

  ;; Adjust tacts
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 4))
  else
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
  end

  ;; WZ := HL + 1
  (i32.add (get_local $hl) (i32.const 1))
  call $setWZ

  ;; Write back to memory
  call $getHL
  (i32.shl (call $getA) (i32.const 4))
  (i32.shr_u (get_local $tmp) (i32.const 4))
  i32.or
  call $writeMemory

  ;; Set A
  (i32.and (call $getA) (i32.const 0xf0))
  (i32.and (get_local $tmp) (i32.const 0x0f))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Keep C
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; adc hl,hl (0x6a)
(func $AdcHLHL
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (call $getHL))
  (call $incTacts (i32.const 7))
)

;; rld (0x6f)
(func $Rld
  (local $hl i32)
  (local $tmp i32)
  call $getHL
  tee_local $hl
  call $readMemory
  set_local $tmp

  ;; Adjust tacts
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 4))
  else
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $hl))
    (call $incTacts (i32.const 1))
  end

  ;; WZ := HL + 1
  (i32.add (get_local $hl) (i32.const 1))
  call $setWZ

  ;; Write back to memory
  call $getHL
  (i32.and (call $getA) (i32.const 0x0f))
  (i32.shl (get_local $tmp) (i32.const 4))
  i32.or
  call $writeMemory

  ;; Set A
  (i32.and (call $getA) (i32.const 0xf0))
  (i32.shr_u (get_local $tmp) (i32.const 4))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))

  ;; Adjust flags
  (i32.add (get_global $LOG_FLAGS) (call $getA))
  i32.load8_u

  ;; Keep C
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; sbc hl,sp (0x72)
(func $SbcHLSP
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluSbcHL (get_global $SP))
  (call $incTacts (i32.const 7))
)

;; ld (NN),sp (0x73)
(func $LdNNiSP
  (local $addr i32)
  call $readAddrFromCode
  (i32.add (tee_local $addr) (i32.const 1))
  call $setWZ
  get_local $addr
  (call $writeMemory (i32.and (get_global $SP) (i32.const 0xff)))
  call $getWZ
  (call $writeMemory (i32.shr_u (get_global $SP) (i32.const 8)))
)

;; adc hl,sp (0x7a)
(func $AdcHLSP
  (call $setWZ (i32.add (call $getHL) (i32.const 1)))
  (call $AluAdcHL (get_global $SP))
  (call $incTacts (i32.const 7))
)

;; ld sp,(NN) (0x7b)
(func $LdSPNNi
  (local $addr i32)
  call $readAddrFromCode
  (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
  (call $readMemory (get_local $addr))
  (call $readMemory (call $getWZ))
  i32.const 8
  i32.shl
  i32.add
  call $setSP
)

;; push NN (0x8a)
(func $PushNN
  (local $v i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end    

  call $readAddrFromCode
  set_local $v
  call $decSP
  get_global $SP
  (i32.shr_u (get_local $v) (i32.const 8))
  call $writeMemory
  call $decSP
  get_global $SP
  get_local $v
  call $writeMemory
)

;; outinb (0x90)
(func $OutInB
  (local $hl i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  ;; Adjust tacts
  i32.const 1
  call $incTacts

  ;; Write (HL) to port BC
  call $getBC
  call $getHL
  tee_local $hl
  call $readMemory
  call $writePort

  ;; Increment HL
  (i32.add (get_local $hl) (i32.const 1))
  call $setHL
)

;; nextreg (0x91)
(func $NextReg
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  ;; Write TBBLUE index register
  call $readCodeMemory
  call $writeTbBlueIndex

  ;; Write TBBLUE value register
  call $readCodeMemory
  call $writeTbBlueValue
)

;; nextreg A (0x92)
(func $NextRegA
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  ;; Write TBBLUE index register
  call $readCodeMemory
  call $writeTbBlueIndex

  ;; Write TBBLUE value register
  call $getA
  call $writeTbBlueValue
)

;; pixeldn (0x93)
(func $PixelDn
  (local $hl i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  call $getHL
  (i32.ne 
    (i32.and (tee_local $hl) (i32.const 0x0700))
    (i32.const 0x0700)
  )
  if (result i32)
    ;; Next pixel row within a character row
    (i32.add (get_local $hl) (i32.const 0x100))
  else
    (i32.ne 
      (i32.and (get_local $hl) (i32.const 0xe0))
      (i32.const 0xe0)
    )
    if (result i32)
      ;; The start of next character row
      (i32.and (get_local $hl) (i32.const 0xf8ff))
      i32.const 0x20
      i32.add
    else
      ;; The start of the next screen-third
      (i32.and (get_local $hl) (i32.const 0xf81f))
      i32.const 0x0800
      i32.add
    end
  end

  ;; Done
  call $setHL
)

;; pixelad (0x94)
(func $PixelAd
  (local $d i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  call $getD
  ;; (D & 0xc0) << 5
  (i32.and (tee_local $d) (i32.const 0xc0))
  i32.const 5
  i32.shl

  ;; (D & 0x07) << 8
  (i32.and (get_local $d) (i32.const 0x07))
  i32.const 8
  i32.shl

  ;; (D & 0x38) << 2
  (i32.and (get_local $d) (i32.const 0x38))
  i32.const 2
  i32.shl

  ;; E >> 3
  (i32.shr_u (call $getE) (i32.const 3))

  ;; Calculate the address
  i32.const 0x4000
  i32.add
  i32.add
  i32.add
  i32.add
  call $setHL
)

;; setae (0x96)
(func $SetAE
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  i32.const 0x80
  (i32.and (call $getE) (i32.const 0x07))
  i32.shr_u
  (call $setA (i32.and (i32.const 0xff)))
)

;; jp (c) (0x98)
(func $JpInC
  (local $bc i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  call $getBC
  (i32.add (tee_local $bc) (i32.const 1))
  call $setWZ

  get_local $bc
  (i32.shl (call $readPort) (i32.const 6))

  (i32.and (get_global $PC) (i32.const 0xc000))
  i32.add
  call $setPC
  (call $incTacts (i32.const 1))
)

;; ==========================================================================
;; Helpers for block operations

;; Implements the core of the ldi/ldd/ldir/lddr operations
;; $step: direction (1 or -1)
;; result: the value of flags
(func $LdBase (param $step i32) (result i32)
  (local $de i32)
  (local $hl i32)
  (local $memVal i32)
  
  ;; (DE) := (HL)
  call $getDE
  tee_local $de
  call $getHL
  tee_local $hl
  call $readMemory
  tee_local $memVal
  call $writeMemory

  ;; Increment/decrement HL
  (i32.add (get_local $hl) (get_local $step))
  call $setHL

  ;; Adjust tacts
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 2))
  else
    (call $memoryDelay (get_local $de))
    (call $incTacts (i32.const 1))
    (call $memoryDelay (get_local $de))
    (call $incTacts (i32.const 1))
  end

  ;; Increment/decrement DE
  (i32.add (get_local $de) (get_local $step))
  call $setDE

  ;; Keep S, Z, and C
  (i32.and (call $getF) (i32.const 0xc1)) ;; (S|Z|C)
  (i32.add (get_local $memVal) (call $getA))
  (i32.and (tee_local $memVal) (i32.const 0x08))
  (i32.shl (get_local $memVal) (i32.const 4))
  
  i32.const 0x20 ;; Mask for R5
  i32.and
  i32.or ;; (S|Z|C, R5|R3)
  i32.or

  ;; Decrement BC
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC
)

;; Base of the cpi/cpd/cpir/cpdr operations
;; $step: direction, 1/-1
(func $CpBase (param $step i32) (result i32)
  (local $hl i32)
  (local $compRes i32)
  (local $r3r5 i32)
  call $getA
  call $getHL
  tee_local $hl
  call $readMemory

  ;; Calc compRes
  i32.sub
  tee_local $compRes
  set_local $r3r5
  
  ;; Keep C 
  (i32.and (call $getF) (i32.const 0x01))

  ;; Set N
  i32.const 0x02 ;; (C, N)

  ;; Calculate H
  (i32.and (call $getA) (i32.const 0x0f))
  (i32.and (get_local $compRes) (i32.const 0x0f))
  i32.sub
  i32.const 0x10
  i32.and
  if (result i32) ;; (C, N, H)
    (i32.sub (get_local $compRes) (i32.const 1))
    set_local $r3r5
    i32.const 0x10
  else
    i32.const 0x00
  end

  ;; Calculate Z
  i32.const 0x00
  i32.const 0x40
  (i32.and (get_local $compRes) (i32.const 0xff))
  select ;; (C, N, H, Z)

  (i32.and (get_local $compRes) (i32.const 0x80)) ;; (C, N, H, Z, S)
  (i32.and (get_local $r3r5) (i32.const 0x08)) ;; (C, N, H, Z, S, R3)
  (i32.shl (get_local $r3r5) (i32.const 4))
  i32.const 0x20
  i32.and ;; (C, N, H, Z, S, R3,R5)

  ;; Adjust tacts
  (call $Adjust5Tacts (get_local $hl))

  ;; Increment/decrement HL
  (i32.add (get_local $hl) (get_local $step))
  call $setHL

  ;; Decrement BC
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC

  ;; Merge flags
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
  i32.or
)

;; Base of ini/id/inir/indr operations
(func $InBase (param $step i32)
  (local $bc i32)
  (local $hl i32)
  (call $incTacts (i32.const 1))
  call $getBC
  (i32.add (tee_local $bc) (i32.const 1))
  call $setWZ

  ;; (HL) := in(BC)
  call $getHL
  tee_local $hl
  get_local $bc
  call $readPort
  call $writeMemory

  ;; Set N
  (i32.or (call $getF) (i32.const 0x02))
  (call $setF (i32.and (i32.const 0xff)))

  ;; Decrement B
  (i32.sub (call $getB) (i32.const 1))
  tee_local $bc
  call $setB

  ;; Set or reset Z
  (i32.eq (get_local $bc) (i32.const 0))
  if (result i32)
    (i32.or (call $getF) (i32.const 0x40))
  else
    (i32.and (call $getF) (i32.const 0xbf))
  end
  (call $setF (i32.and (i32.const 0xff)))

  ;; Increment or decrement HL
  (i32.add (call $getHL) (get_local $step))
  call $setHL
)

;; Base of outi/outd/otir/otdr operations
(func $OutBase (param $step i32)
  (local $f i32)
  (local $b i32)
  (local $hl i32)
  (call $incTacts (i32.const 1))

  ;; Set N
  (i32.const 0x02 (call $getF) (tee_local $f))
  i32.or
  set_local $f

  ;; Decrement B
  (i32.sub (call $getB) (i32.const 1))
  tee_local $b
  call $setB
  get_local $b

  ;; Set or reset Z
  i32.const 0
  i32.eq
  if (result i32)
    (i32.or (get_local $f) (i32.const 0x40))
  else
    (i32.and (get_local $f) (i32.const 0xbf))
  end
  (call $setF (i32.and (i32.const 0xff)))

  ;; Write port
  call $getBC
  tee_local $b
  call $getHL
  tee_local $hl
  call $readMemory
  call $writePort

  ;; Increment/decrement HL
  (i32.add (get_local $hl) (get_local $step))
  call $setHL

  ;; WZ := BC + 1
  (i32.add (get_local $b) (i32.const 1))
  call $setWZ
)

;; Base of the ldix/lddx operations
(func $LdxBase (param $step i32)
  (local $de i32)
  (local $hl i32)
  (local $memVal i32)

  ;; Obtain DE
  call $getDE
  set_local $de

  ;; Conditional copy from (HL) to (DE)
  call $getHL
  tee_local $hl
  call $readMemory
  tee_local $memVal
  call $getA
  i32.ne
  if
    get_local $de
    get_local $memVal
    call $writeMemory
    (call $incTacts (i32.const 2))
  else
    (call $incTacts (i32.const 5))
  end

  ;; Prepare for loop
  (i32.add (get_local $hl) (get_local $step))
  call $setHL
  (i32.add (get_local $de) (get_local $step))
  call $setDE
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC
)

;; Tail of the ldir/lddr operations
(func $LdrTail
  (local $pc i32)

  ;; Test exit
  (i32.eq (call $getBC) (i32.const 0))
  if return end

  ;; Set PV
  (i32.or (call $getF) (i32.const 0x04))
  (call $setF (i32.and (i32.const 0xff)))

  ;; PC := PC - 2
  (i32.sub (get_global $PC) (i32.const 2))
  tee_local $pc
  call $setPC

  ;; Adjust tacts
  (i32.sub (call $getDE) (i32.const 1))
  call $Adjust5Tacts

  ;; WZ := PC + 1
  (i32.add (get_local $pc) (i32.const 1))
  call $setWZ
)

;; Tail of the cpir/cpdr operations
(func $CprTail
  (local $f i32)
  (local $pc i32)
  call $getBC
  if
    ;; Set PV
    call $getF
    (i32.or (tee_local $f) (i32.const 0x04))
    (call $setF (i32.and (i32.const 0xff)))
    (i32.eq
      (i32.and (get_local $f) (i32.const 0x40))
      (i32.const 0)
    )
    if
      ;; Value not found yet
      ;; PC := PC - 2
      (i32.sub (get_global $PC) (i32.const 2))
      tee_local $pc
      call $setPC

      ;; Adjust tacts
      (i32.sub (call $getHL) (i32.const 1))
      call $Adjust5Tacts

      ;; WZ := PC + 1
      (i32.add (get_local $pc) (i32.const 1))
      call $setWZ
    end
  end
)

;; Tail of the inir/indr operations
(func $IndTail
  (i32.ne (call $getB) (i32.const 0))
  if
    ;; Set PV
    (i32.or (call $getF) (i32.const 0x04))
    (call $setF (i32.and (i32.const 0xff)))

    ;; PC := PC - 2
    (i32.sub (get_global $PC) (i32.const 2))
    call $setPC

    ;; Adjust tacts
    (i32.sub (call $getHL) (i32.const 1))
    call $Adjust5Tacts
  else
    ;; Reset PV
    (i32.and (call $getF) (i32.const 0xfb))
    (call $setF (i32.and (i32.const 0xff)))
  end
)

;; Tail of the otir/otdr instructions
(func $OutrTail
  (i32.ne (call $getB) (i32.const 0))
  if
    ;; Set PV
    (i32.or (call $getF) (i32.const 0x04))
    (call $setF (i32.and (i32.const 0xff)))

    ;; PC := PC - 2
    (i32.sub (get_global $PC) (i32.const 2))
    call $setPC

    ;; Adjust tacts
    call $getBC
    call $Adjust5Tacts
  else
    ;; Reset PV
    (i32.and (call $getF) (i32.const 0xfb))
    (call $setF (i32.and (i32.const 0xff)))
  end
)

;; Tail of the ldirx/lddrx operations
(func $LdrxTail
  (i32.eq (call $getBC) (i32.const 0))
  if return end

  (i32.sub (get_global $PC) (i32.const 2))
  call $setPC
  (call $incTacts (i32.const 5))
)

;; ==========================================================================
;; Block operations

;; ldi (0xa0)
(func $Ldi
  (call $LdBase (i32.const 1))
  
  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; cpi (0xa1)
(func $Cpi
  (call $CpBase (i32.const 1))

  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (call $setF (i32.and (i32.const 0xff)))

  call $getHL
  call $setWZ
)

;; ini (0xa2)
(func $Ini
  (call $InBase (i32.const 1))
)

;; outi (0xa3)
(func $Outi
  (call $OutBase (i32.const 1))
)

;; ldix (0x0a4)
(func $Ldix
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  (call $LdxBase (i32.const 1))
)

;; ldws
(func $Ldws
  (local $v i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  ;; (HL) := (DE)
  call $getDE
  call $getHL
  call $readMemory
  call $writeMemory

  ;; Increment L
  (i32.add (call $getL) (i32.const 1))
  call $setL

  ;; Increment D
  call $getD
  (i32.add (tee_local $v) (i32.const 1))
  call $setD

  ;; Adjust flags
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (call $getF) (i32.const 0x01))
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; ldd (0xa8)
(func $Ldd
  (call $LdBase (i32.const -1))
  
  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
)

;; cpd (0xa9)
(func $Cpd
  (call $CpBase (i32.const -1))

  ;; Calc PV
  i32.const 0x04
  i32.const 0x00
  (i32.ne (call $getBC) (i32.const 0))
  select

  ;; Merge flags
  i32.or
  (call $setF (i32.and (i32.const 0xff)))
  call $getHL
  call $setWZ
)

;; ind (0xaa)
(func $Ind
  (call $InBase (i32.const -1))
)

;; outd (0xab)
(func $Outd
  (call $OutBase (i32.const -1))
)

;; lddx (0x0ac)
(func $Lddx
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  (call $LdxBase (i32.const -1))
)

;; ldir (0xb0)
(func $Ldir
  (call $LdBase (i32.const 1))
  (call $setF (i32.and (i32.const 0xff)))
  call $LdrTail
)

;; cpir (0xb1)
(func $Cpir
  (call $CpBase (i32.const 1))
  (call $setF (i32.and (i32.const 0xff)))
  call $CprTail
)

;; Inir (0xb2)
(func $Inir
  (call $InBase (i32.const 1))
  call $IndTail
)

;; Otir (0xb3)
(func $Otir
  (call $OutBase (i32.const 1))
  call $OutrTail
)

;; ldirx
(func $Ldirx
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  (call $LdxBase (i32.const 1))
  call $LdrxTail
)

;; ldpirx
(func $Ldpirx
  (local $memVal i32)
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  ;; Read (HL & 0xfff8 + E & 0x07)
  (i32.and (call $getHL) (i32.const 0xfff8))
  (i32.and (call $getE) (i32.const 0x07))
  i32.add
  call $readMemory
  tee_local $memVal

  ;; Conditional copy
  call $getA
  i32.ne
  if
    call $getDE
    get_local $memVal
    call $writeMemory
    (call $incTacts (i32.const 2))
  else
    (call $incTacts (i32.const 5))
  end

  ;; Inc DE
  (i32.add (call $getDE) (i32.const 1))
  call $setDE

  ;; Decrement BC
  (i32.sub (call $getBC) (i32.const 1))
  call $setBC
  call $LdrxTail
)

;; lddr (0xb8)
(func $Lddr
  (call $LdBase (i32.const -1))
  (call $setF (i32.and (i32.const 0xff)))
  call $LdrTail
)

;; cpdr (0xb9)
(func $Cpdr
  (call $CpBase (i32.const -1))
  (call $setF (i32.and (i32.const 0xff)))
  call $CprTail
)

;; Indr (0xba)
(func $Indr
  (call $InBase (i32.const -1))
  call $IndTail
)

;; Otdr (0xbb)
(func $Otdr
  (call $OutBase (i32.const -1))
  call $OutrTail
)

;; lddrx
(func $Lddrx
  (i32.eq (get_global $allowExtendedSet) (i32.const 0))
  if return end

  (call $LdxBase (i32.const -1))
  call $LdrxTail
)

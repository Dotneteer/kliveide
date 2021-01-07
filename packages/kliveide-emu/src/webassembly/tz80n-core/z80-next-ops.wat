;; ============================================================================
;; Implementation of Z80 Next instructions

;; swapnib (0x23)
(func $SwapNib
  (i32.shl (call $getA) (i32.const 4))
  (i32.shr_u (call $getA) (i32.const 4))
  i32.or
  (call $setA (i32.and (i32.const 0xff)))
)

;; mirror (0x24)
(func $Mirror
  (local $a i32)
  (local $newA i32)

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

  call $getA
  set_local $a

  call $readCodeMemory
  call $AluAnd

  get_local $a
  (call $setA (i32.and (i32.const 0xff)))
)

;; bsla de,b (0x28)
(func $Bsla
  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shl
  call $setDE
)

;; bsra de,b (0x29)
(func $Bsra
  (i32.and (call $getDE) (i32.const 0x8000))
  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shr_u
  i32.or
  call $setDE
)

;; bsrl de,b (0x2a)
(func $Bsrl
  call $getDE
  (i32.and (call $getB) (i32.const 0x07))
  i32.shr_u
  call $setDE
)

;; bsrf de,b (0x2b)
(func $Bsrf
  (i32.xor (call $getDE) (i32.const 0xffff))
  (i32.and (call $getB) (i32.const 0x0f))
  i32.shr_u
  i32.const 0xffff
  i32.xor
  call $setDE
)

;; brlc de,b (0x2c)
(func $Brlc
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
  (i32.mul (call $getD) (call $getE))
  call $setDE
)

;; add hl,a (0x31)
(func $AddHLA
  (i32.add (call $getHL) (call $getA))
  call $setHL
)

;; add de,a (0x32)
(func $AddDEA
  (i32.add (call $getDE) (call $getA))
  call $setDE
)

;; add bc,a (0x33)
(func $AddBCA
  (i32.add (call $getBC) (call $getA))
  call $setBC
)

;; add hl,NN (0x34)
(func $AddHLNN
  (i32.add (call $getHL) (call $readCode16))
  call $setHL
  (call $incTacts (i32.const 2))
)

;; add de,NN (0x35)
(func $AddDENN
  (i32.add (call $getDE) (call $readCode16))
  call $setDE
  (call $incTacts (i32.const 2))
)

;; add bc,NN (0x36)
(func $AddBCNN
  (i32.add (call $getBC) (call $readCode16))
  call $setBC
  (call $incTacts (i32.const 2))
)

;; push NN (0x8a)
(func $PushNN
  (local $v i32)

  call $readCode16
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

  (i32.add (call $getBC) (i32.const 1))
  call $setWZ
)

;; nextreg (0x91)
(func $NextReg

  ;; Write TBBLUE index register
  call $readCodeMemory
  call $writeTbBlueIndex

  ;; Write TBBLUE value register
  call $readCodeMemory
  call $writeTbBlueValue
)

;; nextreg A (0x92)
(func $NextRegA

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
  i32.const 0x80
  (i32.and (call $getE) (i32.const 0x07))
  i32.shr_u
  (call $setA (i32.and (i32.const 0xff)))
)

;; jp (c) (0x98)
(func $JpInC
  (local $bc i32)

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

;; ----------------------------------------------------------------------------
;; Helpers for block operations

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

;; Tail of the ldirx/lddrx operations
(func $LdrxTail
  (i32.eq (call $getBC) (i32.const 0))
  if return end

  (i32.sub (get_global $PC) (i32.const 2))
  call $setPC
  (call $incTacts (i32.const 5))
)

;; ----------------------------------------------------------------------------
;; Block operations

;; ldix (0xa4)
(func $Ldix
  (call $LdxBase (i32.const 1))
)

;; ldws (0xa5)
(func $Ldws
  (local $v i32)

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
  i32.const $F#
  (i32.add (get_global $INC_FLAGS) (get_local $v))
  i32.load8_u
  (i32.and (i32.load8_u (i32.const $F#)) (i32.const 0x01))
  i32.or

  ;; Store flags
  i32.store8
)

;; lddx (0x0ac)
(func $Lddx
  (call $LdxBase (i32.const -1))
)

;; ldirx (0xb4)
(func $Ldirx
  (call $LdxBase (i32.const 1))
  call $LdrxTail
)

;; ldpirx (0xb7)
(func $Ldpirx
  (local $memVal i32)

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

;; lddrx (0xbc)
(func $Lddrx
  (call $LdxBase (i32.const -1))
  call $LdrxTail
)

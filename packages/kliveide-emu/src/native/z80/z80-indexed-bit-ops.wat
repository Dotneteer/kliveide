;; ============================================================================
;; Implementation of Z80 indexed bit operations

;; rlc (ix+d),Q
(func $XBopQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  (i32.and (get_global $opCode) (i32.const 0x07))
  set_local $q

  ;; Read the operand
  get_local $addr
  call $readMemory

  ;; Adjust tacts
  (i32.eq (get_global $useGateArrayContention) (i32.const 0))
  if
    (call $memoryDelay (get_local $addr))
  end
  (call $incTacts (i32.const 1))
  

  ;; Get the type of operation
  get_global $BOP_JT
  (i32.shr_u
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  i32.add
  call_indirect (type $BitOpFunc)
  set_local $res

  ;; Write back to memory
  get_local $addr
  get_local $res
  call $writeMemory

  ;; Store conditionally to reg
  (i32.ne (get_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)

;; bit (ix+d),Q
(func $XBitNQ (param $addr i32)
  get_local $addr
  call $readMemory
  (i32.shr_u 
    (i32.and (get_global $opCode) (i32.const 0x38))
    (i32.const 3)
  )
  call $Bit

  (i32.eq (get_global $useGateArrayContention) (i32.const 0))
  if
    (call $memoryDelay (call $getHL))
  end
  (call $incTacts (i32.const 1))
)

;; res (ix+d),Q
(func $XResNQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  get_local $addr
  get_local $addr
  call $readMemory
  
  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.const 0xff
  i32.xor
  i32.and
  tee_local $res
  call $writeMemory
  
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (call $getHL))
    (call $incTacts (i32.const 1))
  end

  (i32.and (get_global $opCode) (i32.const 0x07))
  (i32.ne (tee_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)

;; set (ix+d),Q
(func $XSetNQ (param $addr i32)
  (local $q i32)
  (local $res i32)
  get_local $addr
  get_local $addr
  call $readMemory
  (i32.shl 
    (i32.const 1)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
  )
  i32.or
  tee_local $res
  call $writeMemory
  get_global $useGateArrayContention
  if
    (call $incTacts (i32.const 1))
  else
    (call $memoryDelay (call $getHL))
    (call $incTacts (i32.const 1))
  end

  (i32.and (get_global $opCode) (i32.const 0x07))
  (i32.ne (tee_local $q) (i32.const 6))
  if
    (call $setReg8 (get_local $q) (get_local $res))
  end
)

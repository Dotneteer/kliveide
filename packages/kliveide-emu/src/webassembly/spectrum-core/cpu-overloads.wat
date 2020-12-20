;; ==========================================================================
;; Helper functions to manage a ZX Spectrum machine

;; ----------------------------------------------------------------------------
;; Z80 Memory access

;; Memory contention on read operation
(func $contendRead (param $addr i32) (param $delay i32)
  (i32.eqz (get_global $useGateArrayContention))
  if
    (call $memoryDelay (get_local $addr))
  end
  (call $incTacts (get_local $delay))
)

;; Memory contention on write operation
(func $contendWrite (param $addr i32) (param $delay i32)
  (i32.eqz (get_global $useGateArrayContention))
  if
    (call $memoryDelay (get_local $addr))
  end
  (call $incTacts (get_local $delay))
)

;; Reads the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readMemoryInternal (param $addr i32) (result i32)
  (local $indexAddr i32)

  ;; Calculate the index table address
  (i32.shr_u
    (i32.and (get_local $addr) (i32.const 0xffff))  
    (i32.const 14)
  ) ;; Now, we have the page number
  (i32.mul (i32.const 6)) ;; Offset in the index table
  (i32.add (get_global $PAGE_INDEX_16))
  tee_local $indexAddr ;; Index entry address

  ;; Get memory value from the offset
  i32.load ;; New we have the page offset
  (i32.and (get_local $addr) (i32.const 0x3fff))
  i32.add
  i32.load8_u ;; (memory value)

  ;; Apply contention
  (i32.load8_u offset=4 (get_local $indexAddr))
  if
    call $applyContentionDelay
  end

  (call $incTacts (i32.const 3))
)

;; Emulates the contention of the specified memory location
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  ;; Calculate the index table address
  (i32.shr_u
    (i32.and (get_local $addr) (i32.const 0xffff))  
    (i32.const 14)
  ) ;; Now, we have the page number
  (i32.mul (i32.const 6)) ;; Offset in the index table
  (i32.add (get_global $PAGE_INDEX_16))

  ;; Apply contention
  i32.load8_u offset=4
  if
    call $applyContentionDelay
  end
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemoryInternal (param $addr i32) (param $value i32)
  (local $indexAddr i32)

  ;; Calculate the index table address
  (i32.shr_u
    (i32.and (get_local $addr) (i32.const 0xffff))  
    (i32.const 14)
  ) ;; Now, we have the page number
  (i32.mul (i32.const 6)) ;; Offset in the index table
  (i32.add (get_global $PAGE_INDEX_16))
  tee_local $indexAddr ;; Index entry address

  ;; Check for read-onliness
  i32.load8_u offset=5
  if 
    (call $incTacts (i32.const 3))
    return
  end

  ;; Get memory value from the offset
  (i32.load (get_local $indexAddr)) ;; New we have the page offset
  (i32.and (get_local $addr) (i32.const 0x3fff))
  i32.add
  (i32.store8 (get_local $value)) ;; (memory value)

  ;; Apply contention
  (i32.load8_u offset=4 (get_local $indexAddr))
  if
    call $applyContentionDelay
  end

  (call $incTacts (i32.const 3))
  (call $setMemoryWritePoint (get_local $addr))
)

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Writes the specified TBBLUE index of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueIndex (param $idx i32)
  ;; NOOP
)

;; Writes the specified TBBLUE value of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueValue (param $idx i32)
  ;; NOOP
)

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
  (local $lookupEntryAddr i32)

  ;; We need the lookup entry for the block of $addr
  (call $calculateBlockLookupEntry (get_local $addr))
  tee_local $lookupEntryAddr

  ;; Calculate the memory address
  (i32.add 
    ;; Get the read pointer
    (i32.load offset=0)
    ;; Add the block offset
    (i32.and (get_local $addr) (i32.const 0x1fff))
  )

  ;; Get memory value from the offset
  i32.load8_u

  ;; Apply contention
  (i32.load8_u offset=9 (get_local $lookupEntryAddr))
  if
    call $applyContentionDelay
  end

  (call $incTacts (i32.const 3))
)

;; Emulates the contention of the specified memory location
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  ;; We need the lookup entry for the block of $addr
  (call $calculateBlockLookupEntry (get_local $addr))

  ;; Apply contention
  i32.load8_u offset=9
  if
    call $applyContentionDelay
  end
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemoryInternal (param $addr i32) (param $value i32)
  (local $lookupEntryAddr i32)

  ;; We need the lookup entry for the block of $addr
  (call $calculateBlockLookupEntry (get_local $addr))
  tee_local $lookupEntryAddr

  ;; Check for read-onliness
  i32.load8_u offset=8
  if 
    ;; ROM, cannot be written
    (call $incTacts (i32.const 3))
    return
  end

  ;; Calculate the memory address
  (i32.add 
    ;; Get the write pointer
    (i32.load offset=4 (get_local $lookupEntryAddr))
    ;; Add the block offset
    (i32.and (get_local $addr) (i32.const 0x1fff))
  )

  ;; Store the value in the memory
  (i32.store8 (get_local $value))

  ;; Apply contention
  (i32.load8_u offset=9 (get_local $lookupEntryAddr))
  if
    call $applyContentionDelay
  end

  (call $incTacts (i32.const 3))
  (call $setMemoryWritePoint (get_local $addr))
)

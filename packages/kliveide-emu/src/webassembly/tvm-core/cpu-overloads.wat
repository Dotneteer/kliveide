;; ==========================================================================
;; Helper functions to manage a ZX Spectrum machine

;; Machine type discriminator. This variable shows the type of ZX Spectrum
;; machine the engine uses. Dynamic operations just as memory read/write 
;; (and all the others) are dispatched according machine type.
;; 0x00: ZX Spectrum 48K
;; 0x01: ZX Spectrum 128K
;; 0x02: ZX Spectrum +3
;; 0x03: ZX Spectrum Next
;; 0x04: Z80 Test machine
;; 0x05: Cambridge Z88 machine
(global $MACHINE_TYPE (mut i32) (i32.const 0x00))

;; Number of dispatchable functions per machine types
(global $MACHINE_FUNC_COUNT i32 (i32.const 20))

;; ----------------------------------------------------------------------------
;; Z80 Memory access

;; Reads the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readMemoryInternal (param $addr i32) (result i32)
  (local $value i32)
  (local $logAddr i32)
  
  ;; Read the memory value
  (i32.add (get_local $addr) (get_global $BANK_0_OFFS))
  i32.load8_u
  set_local $value

  ;; Calculate the address in the memory log
  (i32.add (get_global $TEST_MEM_LOG_OFFS)
    (i32.mul (get_global $memLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $value))

  ;; Store "read" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 0))

  ;; Increment log length
  (i32.add (get_global $memLogLength) (i32.const 1))
  set_global $memLogLength

  ;; Done, return the memory value
  get_local $value

  ;; Standard Z80 delay
  (call $incTacts (i32.const 3))
)

;; Emulates the contention of the specified memory location
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  ;; The test machine's memory is not contended
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemoryInternal (param $addr i32) (param $v i32)
  (local $logAddr i32)

  ;; Write the memory value
  (i32.add (get_local $addr) (get_global $BANK_0_OFFS))
  get_local $v
  i32.store8

  ;; Calculate the address in the memory log
  (i32.add (get_global $TEST_MEM_LOG_OFFS)
    (i32.mul (get_global $memLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $v))

  ;; Store "write" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 1))

  ;; Increment log length
  (i32.add (get_global $memLogLength) (i32.const 1))
  set_global $memLogLength

  ;; Standard Z80 delay
  (call $incTacts (i32.const 3))
)

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPortInternal (param $addr i32) (result i32)
  (local $value i32)
  (local $logAddr i32)

  ;; Read the next port value from the input buffer
  get_global $TEST_INPUT_OFFS
  get_global $nextTestInput
  i32.add
  i32.load8_u
  set_local $value

  ;; Move to the next input element
  (i32.add (get_global $nextTestInput) (i32.const 1))
  set_global $nextTestInput
  (i32.ge_u (get_global $nextTestInput) (get_global $testInputLength))
  if
    i32.const 0 set_global $nextTestInput
  end

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_IO_LOG_OFFS)
    (i32.mul (get_global $ioLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $value))

  ;; Store "read" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 0))

  ;; Increment log length
  (i32.add (get_global $ioLogLength) (i32.const 1))
  set_global $ioLogLength

  ;; Done, return the memory value
  get_local $value

  ;; Standard Z80 delay
  (call $incTacts (i32.const 4))
)

;; Writes the specified port of the current machine type
;; $addr: 16-bit port address
;; $v: 8-bit value to write
(func $writePortInternal (param $addr i32) (param $v i32)
  (local $logAddr i32)
  ;; Default delay

  (call $incTacts (i32.const 4))

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_IO_LOG_OFFS)
    (i32.mul (get_global $ioLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $v))

  ;; Store "write" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 1))

  ;; Increment log length
  (i32.add (get_global $ioLogLength) (i32.const 1))
  set_global $ioLogLength
)

;; Writes the specified TBBLUE index of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueIndex (param $idx i32)
  (local $logAddr i32)

  ;; Port delay
  (call $incTacts (i32.const 3))

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_TBBLUE_LOG_OFFS)
    (i32.mul (get_global $tbBlueLogLength) (i32.const 2))
  )
  tee_local $logAddr

  ;; Store value in the log
  i32.const 1
  i32.store8 offset=0
  (i32.store8 offset=1 (get_local $logAddr) (get_local $idx))

  ;; Increment log length
  (i32.add (get_global $tbBlueLogLength) (i32.const 1))
  set_global $tbBlueLogLength
)

;; Writes the specified TBBLUE value of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueValue (param $val i32)
  (local $logAddr i32)

  ;; Port delay
  (call $incTacts (i32.const 3))

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_TBBLUE_LOG_OFFS)
    (i32.mul (get_global $tbBlueLogLength) (i32.const 2))
  )
  tee_local $logAddr

  ;; Store value in the log
  i32.const 0
  i32.store8 offset=0
  (i32.store8 offset=1 (get_local $logAddr) (get_local $val))

  ;; Increment log length
  (i32.add (get_global $tbBlueLogLength) (i32.const 1))
  set_global $tbBlueLogLength
)

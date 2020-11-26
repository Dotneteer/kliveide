;; ==========================================================================
;; Helper functions to manage a ZX Spectrum machine

;; Represents a no-operation function
(func $NOOP)

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
(func $readMemory (param $addr i32) (result i32)
  get_local $addr
  (i32.add
    (i32.const $MACHINES_TABLE#)
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
  )
  call_indirect (type $MemReadFunc)
  (call $incTacts (i32.const 3))
)

;; Emulates the contention of the specified memory location
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  get_local $addr
  (i32.add
    (i32.const $MACHINES_TABLE#)
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
  )
  call_indirect (type $MemReadFunc)
  drop
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemory (param $addr i32) (param $v i32)
  get_local $addr
  get_local $v
  (i32.add
    (i32.add
      (i32.const $MACHINES_TABLE#)
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    )
    (i32.const 1)
  )
  call_indirect (type $MemWriteFunc)
  (call $incTacts (i32.const 3))
  (call $setMemoryWritePoint (get_local $addr))
)

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPort (param $addr i32) (result i32)
  get_local $addr
  (i32.add
    (i32.add
      (i32.const $MACHINES_TABLE#)
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    )
    (i32.const 2)
  )
  call_indirect (type $PortReadFunc)
  (call $incTacts (i32.const 4))
)

;; Writes the specified port of the current machine type
;; $addr: 16-bit port address
;; $v: 8-bit value to write
(func $writePort (param $addr i32) (param $v i32)
  get_local $addr
  get_local $v
  (i32.add
    (i32.add
      (i32.const $MACHINES_TABLE#)
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    )
    (i32.const 3)
  )
  call_indirect (type $PortWriteFunc)
)

;; Writes the specified TBBLUE index of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueIndex (param $idx i32)
  (call $incTacts (i32.const 3))

  ;; Allow to write the log
  get_local $idx
  (i32.add
    (i32.add
      (i32.const $MACHINES_TABLE#)
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    )
    (i32.const 4)
  )
  call_indirect (type $TbBlueWriteFunc)
)

;; Writes the specified TBBLUE value of the current machine type
;; $idx: 8-bit index register value
(func $writeTbBlueValue (param $idx i32)
  (call $incTacts (i32.const 3))

  get_local $idx
  (i32.add
    (i32.add
      (i32.const $MACHINES_TABLE#)
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    )
    (i32.const 5)
  )
  call_indirect (type $TbBlueWriteFunc)
)

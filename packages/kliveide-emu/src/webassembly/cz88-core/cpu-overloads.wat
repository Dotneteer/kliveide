;; ==========================================================================
;; Helper functions to manage a Cambridge Z88 machine

;; ----------------------------------------------------------------------------
;; Z80 Memory access

;; Reads the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readMemoryInternal (param $addr i32) (result i32)
  (local $tmp i32)
  (i32.eq
    (call $getRomInfoForAddress (get_local $addr))
    (i32.const 0xff)
  )
  if
    ;; Empty memory slot
    call $generateRandomByte
    (call $incTacts (i32.const 3))
    return
  end

  ;; Load the byte from the memory
  (call $calcMemoryAddress (get_local $addr))
  i32.load8_u
  (call $incTacts (i32.const 3))
)

;; Emulates the contention of the specified memory location
;; $addr: 16-bit memory address
(func $memoryDelay (param $addr i32)
  (call $readMemory (get_local $addr))
  drop
)

;; Writes the specified memory location of the current machine type
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeMemoryInternal (param $addr i32) (param $value i32)
  (i32.eqz (call $getRomInfoForAddress (get_local $addr)))
  if
    ;; RAM, so can be written
    (i32.store8
      (call $calcMemoryAddress (get_local $addr))
      (get_local $value)
    )
  end
  (call $incTacts (i32.const 3))
)

;; ----------------------------------------------------------------------------
;; Z80 I/O access

;; Reads the specified I/O port of the current machine type
;; $addr: 16-bit port address
;; returns: Port value
(func $readPortInternal (param $addr i32) (result i32)
  (local $addr8 i32)
  (local $screenRegVal i32)

  ;; Use only the A0..A7 lines
  (i32.and (get_local $addr) (i32.const 0xff))
  set_local $addr8

  (i32.eq (get_local $addr8) (i32.const 0xb0))
  if
    ;; Machine Identification (MID)
    ;; $01: F88
    ;; $80: ZVM
    ;; $FF: Z88 (Blink on Cambridge Z88 does not implement read operation, and returns $FF)
    i32.const 0x80
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb1))
  if
    ;; STA, Main Blink Interrupt Status
    get_global $STA
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb2))
  if
    (i32.and (get_global $INT) (i32.const $BM_INTKWAIT#))
    if
      (i32.eqz (get_global $isKeypressed))
      if
        call $snoozeCpu
        i32.const 0xff
        return
      end
    end
    ;; Keyboard
    (call $getKeyLineStatus (i32.shr_u (get_local $addr) (i32.const 8)))
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb5))
  if
    ;; TSTA, which RTC interrupt occurred...
    get_global $TSTA
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd0))
  if
    ;; TIM0, 5ms period, counts to 199
    get_global $TIM0
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd1))
  if
    ;; TIM1, 1 second period, counts to 59
    get_global $TIM1
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd2))
  if
    ;; TIM2, 1 minute period, counts to 255
    get_global $TIM2
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd3))
  if
    ;; TIM3, 256 minutes period, counts to 255
    get_global $TIM3
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd4))
  if
    ;; TIM4, 64K minutes Period, counts to 31
    get_global $TIM4
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0x70))
  if
    ;; SCW, get screen width in pixels / 8
    get_global $SCW
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0x71))
  if
    ;; SCH, get screen height in pixels / 8
    get_global $SCH
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe0))
  if
    ;; RxD (not implemented yet)
    i32.const 0x00
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe1))
  if
    ;; RxE (not implemented yet)
    i32.const 0x00
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe5))
  if
    ;; UIT, UART Int status, always ready to receive... (not implemented yet)
    i32.const 0x10
    return
  end

  ;; Return the default port value
  i32.const 0xff
)

;; Writes the specified port of the current machine type
;; $addr: 16-bit port address
;; $v: 8-bit value to write
(func $writePortInternal (param $addr i32) (param $v i32)
  (local $addr8 i32)
  (local $screenRegVal i32)

  ;; Use only the A0..A7 lines
  (i32.and (get_local $addr) (i32.const 0xff))
  set_local $addr8

  ;; No ports below address 0x70 are handled
  (i32.lt_u (get_local $addr8) (i32.const 0x70))
  if return end

  ;; Check for screen ports (0x70..0x74)
  (i32.le_u (get_local $addr8) (i32.const 0x74))
  if
    ;; This is a screen port, calculate the register value
    (i32.or 
      (i32.and (get_local $addr) (i32.const 0xff00))
      (get_local $v)
    )
    set_local $screenRegVal

    ;; Dispatch according to port
    (i32.eq (get_local $addr8) (i32.const 0x70))
    if 
      ;; PB0, Pixel Base Register 0 (Screen)
      get_local $screenRegVal set_global $PB0
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x71))
    if
      ;; PB1, Pixel Base Register 1 (Screen)
      get_local $screenRegVal set_global $PB1
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x72))
    if
      ;; PB2, Pixel Base Register 2 (Screen)
      get_local $screenRegVal set_global $PB2
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x73))
    if
      ;; PB3, Pixel Base Register 3 (Screen)
      get_local $screenRegVal set_global $PB3
    else
      ;; 0x74: SBR, Screen Base Register
      get_local $screenRegVal set_global $SBR
    end
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd0))
  if
    ;; SR0
    (call $setSR0 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd1))
  if
    ;; SR1
    (call $setSR1 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd2))
  if
    ;; SR2
    (call $setSR2 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd3))
  if
    ;; SR3
    (call $setSR3 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xb0))
  if
    (call $setCOM (get_local $v))
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb1))
  if
    ;; INT, Set Main Blink Interrupts
    get_local $v set_global $INT
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb3))
  if
    ;; EPR, Eprom Programming Register
    get_local $v set_global $EPR
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb4))
  if
    ;; TACK, Set Timer Interrupt Acknowledge
    (call $setTACK (get_local $v))
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb5))
  if
    ;; TMK, Set Timer interrupt Mask
    get_local $v set_global $TMK
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb6))
  if
    ;; ACK, acknowledge interrupt
    (call $setACK (get_local $v))
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe2))
  if
    ;; RXC, UART Receiver Control (not yet implemented)
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe3))
  if
    ;; TXD, UART Transmit Data (not yet implemented)
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe4))
  if
    ;; TXC, UART Transmit Control (not yet implemented)
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe5))
  if
    ;; UMK, UART Int. mask (not yet implemented)
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xe6))
  if
    ;; UAK, UART acknowledge int. mask (not yet implemented)
    return
  end
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

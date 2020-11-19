;; ==========================================================================
;; Cambridge Z88 functions

;; Reads the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readCz88Memory (param $addr i32) (result i32)
  i32.const 0xff
)

;; Writes the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeCz88Memory (param $addr i32) (param $v i32)
)

;; Reads a port of the Cambridge Z88 machine
;; $addr: port address
;; Returns: value read from port
(func $readPortCz88 (param $addr i32) (result i32)
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
    get_global $z88STA
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb2))
  if
    ;; Keyboard
    ;; TODO: Implement keybord scan
    i32.const 0xff
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb5))
  if
    ;; TSTA, which RTC interrupt occurred...
    get_global $z88TSTA
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd0))
  if
    ;; TIM0, 5ms period, counts to 199
    get_global $z88TIM0
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd1))
  if
    ;; TIM1, 1 second period, counts to 59
    get_global $z88TIM1
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd2))
  if
    ;; TIM2, 1 minute period, counts to 255
    get_global $z88TIM2
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd3))
  if
    ;; TIM3, 256 minutes period, counts to 255
    get_global $z88TIM3
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd4))
  if
    ;; TIM4, 64K minutes Period, counts to 31
    get_global $z88TIM4
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0x70))
  if
    ;; SCW, get screen width in pixels / 8
    get_global $z88SCW
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0x71))
  if
    ;; SCH, get screen height in pixels / 8
    get_global $z88SCH
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

;; Writes a port of the Cambridge Z88 machine
;; $addr: port address
;; $v: Port value
(func $writePortCz88 (param $addr i32) (param $v i32)
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
      get_local $screenRegVal set_global $z88PB0
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x71))
    if
      ;; PB1, Pixel Base Register 1 (Screen)
      get_local $screenRegVal set_global $z88PB1
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x72))
    if
      ;; PB2, Pixel Base Register 2 (Screen)
      get_local $screenRegVal set_global $z88PB2
      return
    end
    (i32.eq (get_local $addr8) (i32.const 0x73))
    if
      ;; PB3, Pixel Base Register 3 (Screen)
      get_local $screenRegVal set_global $z88PB3
    else
      ;; 0x74: SBR, Screen Base Register
      get_local $screenRegVal set_global $z88SBR
    end
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xd0))
  if
    ;; SR0
    (call $setZ88SR0 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd1))
  if
    ;; SR1
    (call $setZ88SR1 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd2))
  if
    ;; SR2
    (call $setZ88SR2 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xd3))
  if
    ;; SR3
    (call $setZ88SR3 (get_local $v))
    return
  end 

  (i32.eq (get_local $addr8) (i32.const 0xb0))
  if
    ;; COM, Set Command Register
    get_local $v set_global $z88COM

    ;; RAMS flag may change, se emulate setting SR0 again
    (call $setZ88SR0 (i32.load8_u offset=0 (get_global $Z88_SR)))
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb1))
  if
    ;; INT, Set Main Blink Interrupts
    get_local $v set_global $z88INT
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb3))
  if
    ;; EPR, Eprom Programming Register
    get_local $v set_global $z88EPR
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb4))
  if
    ;; TACK, Set Timer Interrupt Acknowledge
    get_local $v set_global $z88TACK
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb5))
  if
    ;; TMK, Set Timer interrupt Mask
    get_local $v set_global $z88TMK
    return
  end

  (i32.eq (get_local $addr8) (i32.const 0xb6))
  if
    ;; TMK, Set Timer interrupt Mask
    get_local $v set_global $z88ACK
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

;; Sets up the Cambridge Z88 machine
(func $setupCz88
  ;; CPU configuration
  i32.const 3_276_800 set_global $baseClockFrequency
  i32.const 1 set_global $clockMultiplier
  i32.const 0 set_global $supportsNextOperation
  call $resetCpu

  ;; Blink initial setup
  call $resetZ88Blink
  call $resetZ88Rtc
  call $resetZ88Memory
  call $resetZ88Screen
)

;; Gets the Cambridge Z88 machine state
(func $getCz88MachineState
  ;; CPU configuration
  (i32.store offset=48 (get_global $STATE_TRANSFER_BUFF) (get_global $baseClockFrequency))
  (i32.store8 offset=52 (get_global $STATE_TRANSFER_BUFF) (get_global $clockMultiplier))
  (i32.store8 offset=53 (get_global $STATE_TRANSFER_BUFF) (get_global $supportsNextOperation))

  ;; BLINK device
  (i32.store8 offset=54 (get_global $STATE_TRANSFER_BUFF) (get_global $z88INT))
  (i32.store8 offset=55 (get_global $STATE_TRANSFER_BUFF) (get_global $z88STA))
  (i32.store8 offset=56 (get_global $STATE_TRANSFER_BUFF) (get_global $z88COM))

  ;; RTC device
  (i32.store8 offset=57 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TIM0))
  (i32.store8 offset=58 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TIM1))
  (i32.store8 offset=59 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TIM2))
  (i32.store8 offset=60 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TIM3))
  (i32.store8 offset=61 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TIM4))
  (i32.store8 offset=62 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TSTA))
  (i32.store8 offset=63 (get_global $STATE_TRANSFER_BUFF) (get_global $z88TMK))

  ;; Screen device
  (i32.store8 offset=64 (get_global $STATE_TRANSFER_BUFF) (get_global $z88PB0))
  (i32.store8 offset=65 (get_global $STATE_TRANSFER_BUFF) (get_global $z88PB1))
  (i32.store8 offset=66 (get_global $STATE_TRANSFER_BUFF) (get_global $z88PB2))
  (i32.store8 offset=67 (get_global $STATE_TRANSFER_BUFF) (get_global $z88PB3))
  (i32.store16 offset=68 (get_global $STATE_TRANSFER_BUFF) (get_global $z88SBR))
  (i32.store8 offset=70 (get_global $STATE_TRANSFER_BUFF) (get_global $z88SCW))
  (i32.store8 offset=71 (get_global $STATE_TRANSFER_BUFF) (get_global $z88SCH))

  ;; Memory device
  (i32.store offset=72 (get_global $STATE_TRANSFER_BUFF) (i32.load (get_global $Z88_SR)))
  (i32.store offset=76 (get_global $STATE_TRANSFER_BUFF) (i32.load (get_global $Z88_CHIP_MASKS)))
  (i32.store8 offset=80 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=4 (get_global $Z88_CHIP_MASKS)))

  ;; TODO: Get other state values
)

;; ==========================================================================
;; Cambridge Z88 functions

;; Reads the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $readCz88Memory (param $addr i32) (result i32)
  ;; TODO: Implement this method
  i32.const 0xff
)

;; Writes the memory of the Cambridge Z88 machibe
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $writeCz88Memory (param $addr i32) (param $v i32)
  ;; TODO: Implement this method
)

;; Reads a port of the Cambridge Z88 machine
;; $addr: port address
;; Returns: value read from port
(func $readPortCz88 (param $addr i32) (result i32)
  ;; TODO: Implement this method

  ;; Return the default port value
  i32.const 0xff
)

;; Writes a port of the Cambridge Z88 machine
;; $addr: port address
;; $v: Port value
(func $writePortCz88 (param $addr i32) (param $v i32)
  ;; TODO: Implement this method
)

;; Sets up the Cambridge Z88 machine
(func $setupCz88
  ;; TODO: Implement this method
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

  ;; TODO: Get other state values
)

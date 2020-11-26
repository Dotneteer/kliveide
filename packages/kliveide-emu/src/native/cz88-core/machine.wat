;; Turns on the Cambridge Z88 machine
(func $turnOnMachine
  call $setupMachine
)

;; Sets up the Cambridge Z88 machine
(func $setupMachine 
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

;; Writes the Cambridge Z88 machine state to the transfer area
(func $getMachineState
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

;; ============================================================================
;; Test methods

(func $testReadCz88Memory (param $addr i32) (result i32)
  (call $readMemory (get_local $addr))
)

(func $testWriteCz88Memory (param $addr i32) (param $v i32)
  (call $writeMemory (get_local $addr) (get_local $v))
)

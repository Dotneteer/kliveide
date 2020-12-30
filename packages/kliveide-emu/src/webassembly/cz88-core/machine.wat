;; Turns on the Cambridge Z88 machine
(func $turnOnMachine
  call $setupMachine
  call $clearMemory
)

;; Resets the machine
(func $resetMachine
  call $setupMachine
)

;; Sets up the Cambridge Z88 machine
(func $setupMachine 
  ;; CPU configuration
  i32.const 3_276_800 set_global $baseClockFrequency
  i32.const 1 set_global $clockMultiplier
  call $resetCpu

  ;; Screen configuration
  i32.const 64 set_global $screenLines
  i32.const 640 set_global $screenWidth
  i32.const 16384 set_global $tactsInFrame

  ;; Blink initial setup
  call $resetBlink
  call $resetRtc
  call $resetMemory
  call $resetZ88Screen
  call $resetKeyboard
)

;; Writes the Cambridge Z88 machine state to the transfer area
(func $getMachineState
  call $getCpuState
  call $getExecutionEngineState

  ;; BLINK device
  (i32.store8 offset=160 (get_global $STATE_TRANSFER_BUFF) (get_global $INT))
  (i32.store8 offset=161 (get_global $STATE_TRANSFER_BUFF) (get_global $STA))
  (i32.store8 offset=162 (get_global $STATE_TRANSFER_BUFF) (get_global $COM))

  ;; RTC device
  (i32.store8 offset=163 (get_global $STATE_TRANSFER_BUFF) (get_global $TIM0))
  (i32.store8 offset=164 (get_global $STATE_TRANSFER_BUFF) (get_global $TIM1))
  (i32.store8 offset=165 (get_global $STATE_TRANSFER_BUFF) (get_global $TIM2))
  (i32.store8 offset=166 (get_global $STATE_TRANSFER_BUFF) (get_global $TIM3))
  (i32.store8 offset=167 (get_global $STATE_TRANSFER_BUFF) (get_global $TIM4))
  (i32.store8 offset=168 (get_global $STATE_TRANSFER_BUFF) (get_global $TSTA))
  (i32.store8 offset=169 (get_global $STATE_TRANSFER_BUFF) (get_global $TMK))

  ;; Screen device
  (i32.store16 offset=170 (get_global $STATE_TRANSFER_BUFF) (get_global $PB0))
  (i32.store16 offset=172 (get_global $STATE_TRANSFER_BUFF) (get_global $PB1))
  (i32.store16 offset=174 (get_global $STATE_TRANSFER_BUFF) (get_global $PB2))
  (i32.store16 offset=176 (get_global $STATE_TRANSFER_BUFF) (get_global $PB3))
  (i32.store16 offset=178 (get_global $STATE_TRANSFER_BUFF) (get_global $SBR))
  (i32.store8 offset=180 (get_global $STATE_TRANSFER_BUFF) (get_global $SCW))
  (i32.store8 offset=181 (get_global $STATE_TRANSFER_BUFF) (get_global $SCH))

  ;; Memory device
  (i32.store offset=182 (get_global $STATE_TRANSFER_BUFF) (i32.load (get_global $Z88_SR)))
  (i32.store offset=186 (get_global $STATE_TRANSFER_BUFF) (i32.load (get_global $Z88_CHIP_MASKS)))
  (i32.store8 offset=190 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=4 (get_global $Z88_CHIP_MASKS)))

  ;; Get other state values
  (i32.store8 offset=191 (get_global $STATE_TRANSFER_BUFF) (get_global $shiftsReleased))
  (i32.store offset=192 (get_global $STATE_TRANSFER_BUFF) (i32.load (get_global $KEYBOARD_LINES)))
  (i32.store offset=196 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=4 (get_global $KEYBOARD_LINES)))
)

;; ============================================================================
;; Test methods

(func $testReadCz88Memory (param $addr i32) (result i32)
  (call $readMemory (get_local $addr))
)

(func $testWriteCz88Memory (param $addr i32) (param $v i32)
  (call $writeMemory (get_local $addr) (get_local $v))
)

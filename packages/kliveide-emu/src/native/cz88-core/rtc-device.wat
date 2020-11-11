;; ============================================================================
;; Implements the Z88 Real-Time Clock device (Blink)

;; TIM0, 5 millisecond period, counts to 199, Z80 IN Register
(global $z88TIM0 (mut i32) (i32.const 0x0000))

;; TIM1, 1 second period, counts to 59, Z80 IN Register
(global $z88TIM1 (mut i32) (i32.const 0x0000))

;; TIM2, 1 minutes period, counts to 255, Z80 IN Register
(global $z88TIM2 (mut i32) (i32.const 0x0000))

;; TIM3, 256 minutes period, counts to 255, Z80 IN Register
(global $z88TIM3 (mut i32) (i32.const 0x0000))

;; TIM4, 64K minutes period, counts to 31, Z80 IN Register
(global $z88TIM4 (mut i32) (i32.const 0x0000))

;; TSTA, Timer interrupt status, Z80 IN Read Register
;;
;; $BM_TSTAMIN# = 0x04      // TSTA: Set if minute interrupt has occurred
;; $BM_TSTASEC# = 0x02      // TSTA: Set if second interrupt has occurred
;; $BM_TSTATICK# = 0x01     // TSTA: Set if tick interrupt has occurred
(global $z88TSTA (mut i32) (i32.const 0x0000))

;; TMK, Timer interrupt mask, Z80 OUT Write Register
;;
;; $BM_TMKMIN# = 0x04       // TMK: Set to enable minute interrupt
;; $BM_TMKSEC# = 0x02       // TMK: Set to enable second interrupt
;; $BM_TMKTICK# = 0x01      // TMK: Set to enable tick interrupt
(global $z88TMK (mut i32) (i32.const 0x0000))

;; ============================================================================
;; Real-Time Clock methods

;; Resets the Z88 Real-Time Clock
(func $resetZ88Rtc
  i32.const 0x98 set_global $z88TIM0
  i32.const 0x00 set_global $z88TIM1
  i32.const 0x00 set_global $z88TIM2
  i32.const 0x00 set_global $z88TIM3
  i32.const 0x00 set_global $z88TIM4
  i32.const 0x00 set_global $z88TSTA
  i32.const 0x00 set_global $z88TMK
)

;; Increments the Z88 Real-Time Clock (in every 5 ms)
(func $incZ88Rtc
  ;; TODO: Implement this method
)

;; ============================================================================
;; Test methods

;; Emulates a sequence of 5ms ticks
(func $testIncZ88Rtc (param $ticks i32)
  loop $incCycle
    (get_local $ticks)
    if
      call $incZ88Rtc

      (i32.sub (get_local $ticks) (i32.const 1))
      set_local $ticks
      br $incCycle
    end
  end
)

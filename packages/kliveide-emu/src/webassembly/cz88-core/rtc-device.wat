;; ============================================================================
;; Implements the Z88 Real-Time Clock device (Blink)

;; TIM0, 5 millisecond period, counts to 199, Z80 IN Register
(global $TIM0 (mut i32) (i32.const 0x0000))

;; TIM1, 1 second period, counts to 59, Z80 IN Register
(global $TIM1 (mut i32) (i32.const 0x0000))

;; TIM2, 1 minutes period, counts to 255, Z80 IN Register
(global $TIM2 (mut i32) (i32.const 0x0000))

;; TIM3, 256 minutes period, counts to 255, Z80 IN Register
(global $TIM3 (mut i32) (i32.const 0x0000))

;; TIM4, 64K minutes period, counts to 31, Z80 IN Register
(global $TIM4 (mut i32) (i32.const 0x0000))

;; TSTA, Timer interrupt status, Z80 IN Read Register
;;
;; $BM_TSTAMIN# = 0x04      // TSTA: Set if minute interrupt has occurred
;; $BM_TSTASEC# = 0x02      // TSTA: Set if second interrupt has occurred
;; $BM_TSTATICK# = 0x01     // TSTA: Set if tick interrupt has occurred
(global $TSTA (mut i32) (i32.const 0x0000))

;; TMK, Timer interrupt mask, Z80 OUT Write Register
;;
;; $BM_TMKMIN# = 0x04       // TMK: Set to enable minute interrupt
;; $BM_TMKSEC# = 0x02       // TMK: Set to enable second interrupt
;; $BM_TMKTICK# = 0x01      // TMK: Set to enable tick interrupt
(global $TMK (mut i32) (i32.const 0x0000))

;; ============================================================================
;; Real-Time Clock methods

;; Resets the Z88 Real-Time Clock
(func $resetRtc
  i32.const 0x98 set_global $TIM0
  i32.const 0x00 set_global $TIM1
  i32.const 0x00 set_global $TIM2
  i32.const 0x00 set_global $TIM3
  i32.const 0x00 set_global $TIM4
  i32.const 0x00 set_global $TSTA
  i32.const 0x00 set_global $TMK
)

;; Increments the Z88 Real-Time Clock (in every 5 ms)
(func $incRtcCounter
  (i32.and (get_global $COM) (i32.const $BM_COMRESTIM#))
  if
    ;; Stop Real Time Clock (RESTIM = 1) and reset counters
    i32.const 0x98 set_global $TIM0
    i32.const 0x00 set_global $TIM1
    i32.const 0x00 set_global $TIM2
    i32.const 0x00 set_global $TIM3
    i32.const 0x00 set_global $TIM4
    return
  end
  
  ;; fire a single interrupt for TSTA.TICK register, but only if the flap is closed
  ;; (the Blink doesn't emit RTC interrupts while the flap is open, even if INT.TIME is enabled)
  (i32.and (get_global $STA) (i32.const $BM_STAFLAPOPEN#))
  (i32.eqz)
  if
    (i32.and (get_global $TMK) (i32.const $BM_TMKTICK#))
    if
      (i32.and (get_global $TSTA) (i32.const $BM_TSTATICK#))
      i32.eqz
      if
        (i32.and (get_global $INT) (i32.const $BM_INTTIME#))
        if
          ;; INT.TIME interrupts are enabled, and Blink may signal it
          ;; TMK.TICK interrupts are enabled, signal that a tick occurred
          (i32.or (get_global $TSTA) (i32.const $BM_TSTATICK#))
          set_global $TSTA
        end
      end
    end
  end

  ;; Increment TIM0
  (i32.add (get_global $TIM0) (i32.const 1))
  set_global $TIM0

  ;; Handle TIM0
  (i32.gt_u (get_global $TIM0) (i32.const 199))
  if
    i32.const 0 set_global $TIM0
  end

  (i32.eq (get_global $TIM0) (i32.const 0x80))
  if
    ;; Increment TIM1
    (i32.add (get_global $TIM1) (i32.const 1))
    set_global $TIM1

    ;; signal interrupt only if the flap is closed (the Blink doesn't emit RTC interrupts while the flap is open,
    ;; even if INT.TIME is enabled)
    (i32.and (get_global $STA) (i32.const $BM_STAFLAPOPEN#))
    (i32.eqz)
    if
      (i32.and (get_global $TMK) (i32.const $BM_TMKSEC#))
      if
        (i32.and (get_global $TSTA) (i32.const $BM_TSTASEC#))
        i32.eqz
        if
          (i32.and (get_global $INT) (i32.const $BM_INTTIME#))
          if
            ;; INT.TIME interrupts are enabled, and Blink may signal it
            ;; TMK.TICK interrupts are enabled, signal that a tick occurred
            (i32.or (get_global $TSTA) (i32.const $BM_TSTASEC#))
            set_global $TSTA
          end
        end
      end
    end
  end

  ;; Handle TIM1
  (i32.gt_u (get_global $TIM1) (i32.const 59))
  if
    ;; 1 minute has passed
    i32.const 0 set_global $TIM1

    (i32.and (get_global $STA) (i32.const $BM_STAFLAPOPEN#))
    (i32.eqz)
    if
      (i32.and (get_global $TMK) (i32.const $BM_TMKMIN#))
      if
        (i32.and (get_global $TSTA) (i32.const $BM_TSTAMIN#))
        i32.eqz
        if
          (i32.and (get_global $INT) (i32.const $BM_INTTIME#))
          if
            ;; TMK.MIN interrupts are enabled, signal that a minute occurred only if it's not already signaled.
            ;; but only if the flap is closed (the Blink doesn't emit RTC interrupts while the flap is open, even if INT.TIME is enabled)
            ;; INT.TIME interrupts are enabled, and Blink may signal it
            (i32.or (get_global $TSTA) (i32.const $BM_TSTAMIN#))
            set_global $TSTA
          end
        end
      end
    end

    ;; Increment TIM2
    (i32.add (get_global $TIM2) (i32.const 1))
    set_global $TIM2

    (i32.gt_u (get_global $TIM2) (i32.const 255))
    if
      ;; 256 minutes passed
      i32.const 0 set_global $TIM2

      ;; Increment TIM3
      (i32.add (get_global $TIM3) (i32.const 1))
      set_global $TIM3

      (i32.gt_u (get_global $TIM3) (i32.const 255))
      if
        ;; 65536 minutes passed
        i32.const 0 set_global $TIM3

        ;; Increment TIM4
        (i32.add (get_global $TIM4) (i32.const 1))
        set_global $TIM4

        (i32.gt_u (get_global $TIM4) (i32.const 31))
        if
          ;; 65536 * 32 minutes passed
          i32.const 0 set_global $TIM4
        end        
      end
    end
  end

  (get_global $TSTA)
  if
    ;; a combination of one or more time events has occurred
    (i32.or (get_global $STA) (i32.const $BM_STATIME#))
    set_global $STA

    (i32.and (get_global $INT) (i32.const $BM_INTGINT#))
    if
      call $awakeCpu
    end
  end
)

;; ============================================================================
;; Test methods

;; Emulates a sequence of 5ms ticks
(func $testIncZ88Rtc (param $ticks i32)
  loop $incCycle
    (get_local $ticks)
    if
      call $incRtcCounter

      (i32.sub (get_local $ticks) (i32.const 1))
      set_local $ticks
      br $incCycle
    end
  end
)

;; Sets the RTC registers of Z88
(func $testSetRtcRegs 
  (param $tim0 i32)
  (param $tim1 i32)
  (param $tim2 i32)
  (param $tim3 i32)
  (param $tim4 i32)

  (i32.and (get_local $tim0) (i32.const 0xff))
  set_global $TIM0
  (i32.and (get_local $tim1) (i32.const 0xff))
  set_global $TIM1
  (i32.and (get_local $tim2) (i32.const 0xff))
  set_global $TIM2
  (i32.and (get_local $tim3) (i32.const 0xff))
  set_global $TIM3
  (i32.and (get_local $tim4) (i32.const 0xff))
  set_global $TIM4
)

;; Sets the TMK register of Z88
(func $testSetZ88TMK (param $value i32)
  get_local $value set_global $TMK
)

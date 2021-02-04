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

;; Tick event to raise as an interrupt
(global $tickEvent (mut i32) (i32.const 0x0000))

;; ============================================================================
;; Real-Time Clock methods

;; Resets the Z88 Real-Time Clock
(func $resetRtc
  i32.const 0x00 set_global $TIM0
  i32.const 0x00 set_global $TIM1
  i32.const 0x00 set_global $TIM2
  i32.const 0x00 set_global $TIM3
  i32.const 0x00 set_global $TIM4
)

;; Increments the Z88 Real-Time Clock (in every 5 ms)
(func $incRtcCounter
  ;; Sign no TICK event
  (set_global $tickEvent (i32.const 0))

  (i32.and (get_global $COM) (i32.const $BM_COMRESTIM#))
  if
    ;; Stop Real Time Clock (RESTIM = 1) and reset counters
    call $resetRtc
    return
  end
  
  ;; Increment TIM0
  (set_global $TIM0 (i32.add (get_global $TIM0) (i32.const 1)))

  ;; Test if TIM0 is to be reset
  (i32.gt_u (get_global $TIM0) (i32.const 199))
  if
    ;; When this counter reaches 200, wrap back to 0
    (set_global $TIM0 (i32.const 0))
  else
    (i32.and (get_global $TIM0) (i32.const 0x01))
    if
      ;; a 10ms TSTA.TICK event as occurred (every 2nd 5ms count)
      (set_global $tickEvent (i32.const $BM_TSTATICK#))
    end

    (i32.eq (get_global $TIM0) (i32.const 128))
    if
      ;; According to blink dump monitoring on Z88, when TIM0 reaches 0x80 (bit 7), a second has passed
      (set_global $TIM1 (i32.add (get_global $TIM1) (i32.const 1)))
      (set_global $tickEvent (i32.const $BM_TMKSEC#))

      (i32.gt_u (get_global $TIM1) (i32.const 59))
      if
        ;; 60 seconds passed
        (set_global $TIM1 (i32.const 0))

        ;; Increment TIM2
        (set_global $TIM2 (i32.add (get_global $TIM2) (i32.const 1)))
        (i32.gt_u (get_global $TIM2) (i32.const 255))
        if
          ;; 256 minutes has passed
          (set_global $TIM2 (i32.const 0))

          ;; Increment TIM3
          (set_global $TIM3 (i32.add (get_global $TIM3) (i32.const 1)))
          (i32.gt_u (get_global $TIM3) (i32.const 255))
          if
            ;; 65535 minutes has passed
            (set_global $TIM3 (i32.const 0))

            ;; Increment TIM4
            (set_global $TIM4 (i32.add (get_global $TIM4) (i32.const 1)))
            (i32.gt_u (get_global $TIM4) (i32.const 31))
            if
              ;; 32 * 65535 minutes has passed
              (set_global $TIM4 (i32.const 0))
            end
          end
        end
      end

      (i32.eq (get_global $TIM1) (i32.const 32))
      if
        ;; 1 minute has passed
        (set_global $tickEvent (i32.const $BM_TSTAMIN#))
      end
    end
  end

  (i32.eqz (i32.and (get_global $INT) (i32.const $BM_INTGINT#)))
  if
    ;; No interrupts get out of Blink
    return
  end
  
  (i32.and (get_global $STA) (i32.const $BM_STAFLAPOPEN#))
  if
    ;; Flap is Open
    ;; (on real hardware, there is no interrupt - in OZvm it's a trick to get 
    ;; LCD switched off properly by the ROM)
    ;; (guarantee there is no STA.TIME event)
    ;; STA = STA & ~BM_STATIME
    (set_global $STA (i32.and (get_global $STA) (i32.const 0xfe)))
    (i32.eqz (i32.rem_u (get_global $TIM0) (i32.const 3)))
    if
      call $awakeCpu
    end
    return
  end

  (i32.eqz (i32.and (get_global $INT) (i32.const $BM_INTTIME#)))
  if
    ;; INT.TIME is not enabled (no RTC interrupts)
    ;; No interrupt is fired
    ;; STA = STA & ~BM_STATIME
    (set_global $STA (i32.and (get_global $STA) (i32.const 0xfe)))
    return
  end

  (i32.eqz (get_global $TMK))
  if
    ;; No time event (a TMK.TICK, TMK.SEC or TMK.MIN) is enabled (not allowed to happen)
    ;; No interrupt is fired
    ;; STA = STA & ~BM_STATIME
    (set_global $STA (i32.and (get_global $STA) (i32.const 0xfe)))
    return
  end

  get_global $tickEvent
  if
    ;; always signal what RTC event happened in Blink
    (set_global $TSTA (get_global $tickEvent))
    (i32.and (get_global $TMK) (get_global $tickEvent))
    if
      ;; only fire the interrupt that TMK is allowing to come out
      (set_global $STA (i32.or (get_global $STA) (i32.const $BM_STATIME#)))
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
      (set_global $TSTA (i32.const 0))
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

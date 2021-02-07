;; Indicates that keys were released after the Z88 went to sleep
(global $shiftsReleased (mut i32) (i32.const 0x0000))

;; Indicates if Z88 is in halt mode
(global $isInSleepMode (mut i32) (i32.const 0x0000))

;; Should CPU clock change be allowed?
(func $allowCpuClockChange (result i32)
  i32.const 1
)

;; The execution engine starts a new frame
(func $onInitNewFrame (param $oldClockMultiplier i32)
  ;; Reset beeper frame state for every 8th frame
  (i32.and (get_global $frameCount) (i32.const 0x07))
  i32.eqz
  if
    (i32.ne (get_local $oldClockMultiplier) (get_global $clockMultiplier))
    if
      (call $setBeeperSampleRate (get_global $audioSampleRate))
    end 
    i32.const 0 set_global $audioSampleCount
  end
)

;; The execution engine is about to execute a CPU cycle
(func $beforeCpuCycle (param $frameTact i32)
  ;; TODO: Implement this method
)

;; The execution engine is about to execute a CPU cycle
(func $afterCpuCycle (param $frameTact i32)
  ;; Awake the CPU whenever a key is pressed
  get_global $isKeypressed
  if
    call $awakeCpu
  end

  ;; Check for interrupt
  (get_global $interruptSignalActive)
  if (result i32)
    ;; Set the interrupt signal
    (i32.or (get_global $cpuSignalFlags) (i32.const $SIG_INT#))
  else
    ;; Remove the interrupt signal
    (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_INT_MASK#))
  end
  set_global $cpuSignalFlags
)

;; The execution engine is before checking loop termination
(func $beforeTerminationCheck (param $frameTact i32)
  ;; TODO: Implement this method
)

;; Tests if the execution cycle reached the termination point
(func $testIfTerminationPointReached (result i32)
  ;; TODO: Implement this method
  i32.const 0
)

;; The execution engine is after checking loop termination
(func $afterTerminationCheck
  ;; Is it time to render the next beeper/sound sample?
  (i32.ge_u (get_global $tacts) (get_global $audioNextSampleTact))
  if
    ;; Render next beeper sample
    (i32.add (get_global $CZ88_BEEPER_BUFFER) (get_global $audioSampleCount))
    i32.const 1
    i32.const 0
    get_global $beeperLastEarBit
    select
    i32.store8 

    ;; Adjust sample count
    (i32.add (get_global $audioSampleCount) (i32.const 1))
    set_global $audioSampleCount

    ;; Calculate next sample tact
    (i32.add (get_global $audioGateValue) (get_global $audioLowerGate))
    set_global $audioGateValue
    (i32.add (get_global $audioNextSampleTact) (get_global $audioSampleLength))
    set_global $audioNextSampleTact

    (i32.ge_u (get_global $audioGateValue) (get_global $audioUpperGate))
    if
      ;; Shift the next sample 
      (i32.add (get_global $audioNextSampleTact) (i32.const 1))
      set_global $audioNextSampleTact

      (i32.sub (get_global $audioGateValue) (get_global $audioUpperGate))
      set_global $audioGateValue
    end
  end
)

;; The execution engine has just completed the current frame
(func $onFrameCompleted
  ;; 5ms frame completed, update the real time clock
  call $incRtcCounter

;; Check again if a key is pressed
  (i32.or
    (i32.load offset=0 (get_global $KEYBOARD_LINES))
    (i32.load offset=4 (get_global $KEYBOARD_LINES))
  )
  set_global $isKeypressed

  ;; Awake the CPU when a key is pressed
  get_global $isKeypressed
  if
    ;; A keyboard key is pressed, maybe the CPU should be woken up
    (i32.and (get_global $INT) (i32.const $BM_INTKWAIT#))
    if
      call $awakeCpu
    end
  end

  ;; Set flash phase
  (i32.le_u (get_global $TIM0) (i32.const 120))
  set_global $flashPhase

  ;; Set text flash phase
  (i32.add (get_global $textFlashCount) (i32.const 1))
  set_global $textFlashCount
  (i32.ge_u (get_global $textFlashCount) (get_global $textFlashToggleCount))
  if
    (set_global $textFlashCount (i32.const 0))
    (i32.xor (get_global $textFlashPhase) (i32.const 0x01))
    set_global $textFlashPhase
  end

  ;; Refresh the screen for every 8th frame
  (i32.and (get_global $frameCount) (i32.const 0x07))
  i32.eqz
  if
    call $renderScreen
  end

  ;; Check id the CPU is HALTed
  (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
  if
    ;; Check if I is 0x3F
    (i32.eq (i32.load8_u (i32.const $I#)) (i32.const 0x3f))
    if
      (set_global $isInSleepMode (i32.const 1))
      get_global $shiftsReleased
      if
        ;; Test if both shift keys are pressed again
        (i32.or
          ;; Test right shift
          (i32.and
           (i32.load8_u offset=7 (get_global $KEYBOARD_LINES))
           (i32.const 0x80)
          )
          ;; Test left shift
          (i32.and
            (i32.load8_u offset=6 (get_global $KEYBOARD_LINES))
            (i32.const 0x40)
          )
        )
        (i32.eq (i32.const 0xc0))
        if
          (set_global $shiftsReleased (i32.const 0))
          return
        end
      else
        ;; Test if both shift keys are released
        (i32.or
          ;; Test right shift released
          (i32.and
            (i32.load8_u offset=7 (get_global $KEYBOARD_LINES))
            (i32.const 0x80)
          )
          ;; Test left shift released
          (i32.and
            (i32.load8_u offset=6 (get_global $KEYBOARD_LINES))
            (i32.const 0x40)
          )
        )
        i32.eqz
        if
          ;; Sign that both shift keys are released
          (set_global $shiftsReleased (i32.const 1))
        end
      end
    else
      (set_global $isInSleepMode (i32.const 0))
    end
  else
    (set_global $isInSleepMode (i32.const 0))
  end

  ;; Special shift key handling for sleep mode
  get_global $isInSleepMode
  if
    (i32.and (get_global $isLeftShiftDown) (get_global $isRightShiftDown))
    if
      ;; Sign both shift as pressed
      (i32.store8 offset=7 
        (get_global $KEYBOARD_LINES)
        ;; Set right shift
        (i32.or
          (i32.load8_u offset=7 (get_global $KEYBOARD_LINES))
          (i32.const 0x80)
        )
      )
      (i32.store8 offset=6
        (get_global $KEYBOARD_LINES)
        ;; Set left shift
        (i32.and
          (i32.load8_u offset=6 (get_global $KEYBOARD_LINES))
          (i32.const 0x40)
        )
      )
    end
  end

  ;; Prepare for the next beeper sample rate that may overflow to the next frame
  (i32.gt_u (get_global $audioNextSampleTact) (get_global $tacts))
  if
    (i32.sub 
      (get_global $audioNextSampleTact)
      (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
    )
    set_global $audioNextSampleTact
  end

)

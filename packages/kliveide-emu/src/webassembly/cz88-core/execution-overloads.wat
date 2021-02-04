;; Should CPU clock change be allowed?
(func $allowCpuClockChange (result i32)
  i32.const 1
)

;; The execution engine starts a new frame
(func $onInitNewFrame (param $oldClockMultiplier i32)
  ;; TODO: Implement this method
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
  (call $isMaskableInterruptRequested)
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
  ;; TODO: Implement this method
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
    ;; A keyboard status bit is set in one of the first 4 lines
    (i32.and (get_global $INT) (i32.const $BM_INTKWAIT#))
    if
      call $awakeCpu
    end
  else
    (i32.load offset=4 (get_global $KEYBOARD_LINES))
    if
      ;; A keyboard status bit is set in one of the second 4 lines
      call $awakeCpu
    end
  end

  ;; Set flash phase
  (i32.add (get_global $flashCount) (i32.const 1))
  set_global $flashCount
  (i32.ge_u (get_global $flashCount) (get_global $flashToggleCount))
  if
    (set_global $flashCount (i32.const 0))
    (i32.xor (get_global $flashPhase) (i32.const 0x01))
    set_global $flashPhase
  end

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
)

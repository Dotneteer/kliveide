;; ==========================================================================
;; Helpers for testing the Z80 CPU

;; The mode to run tests
(global $testRunMode (mut i32) (i32.const 0x0000))

;; The end of the code injected for test pusposes
(global $testCodeEndsAt (mut i32) (i32.const 0x0000))

;; The length of test input sequence
(global $testInputLength (mut i32) (i32.const 0x0000))

;; The index of the next test input
(global $nextTestInput (mut i32) (i32.const 0x0000))

;; The length of the memory access log
(global $memLogLength (mut i32) (i32.const 0x0000))

;; The length of the I/O access log
(global $ioLogLength (mut i32) (i32.const 0x0000))

;; The length of the TBBLUE access log
(global $tbBlueLogLength (mut i32) (i32.const 0x0000))

;; Prepares the test code to run
(func $prepareTest (param $mode i32) (param $codeEnds i32)
  get_local $mode set_global $testRunMode
  get_local $codeEnds set_global $testCodeEndsAt
  i32.const 0 set_global $nextTestInput
  i32.const 0 set_global $memLogLength
  i32.const 0 set_global $ioLogLength
  i32.const 0 set_global $tbBlueLogLength

  ;; Set the machine type to Z80 CPU test machine
  i32.const 4 set_global $MACHINE_TYPE
)

;; Sets the length of the test input
(func $setTestInputLength (param $l i32)
  get_local $l set_global $testInputLength
)

;; Gets the length of the memory access log
(func $getMemLogLength (result i32)
  get_global $memLogLength
)

;; Gets the length of the I/O access log
(func $getIoLogLength (result i32)
  get_global $ioLogLength
)

;; Gets the length of the TBBLUE access log
(func $getTbBlueLogLength (result i32)
  get_global $tbBlueLogLength
)

;; Runs the test code. Stops according to the specified $testRunMode
;; Run mode values:
;; 0: Normal
;; 1: One cycle
;; 2: One instruction
;; 3: Until halt
;; 4: Until end
(func $runTestCode
  loop $codeExec
    call $executeCpuCycle

    ;; Check the run mode
    ;; Test for normal or one cycle
    (i32.le_u (get_global $testRunMode) (i32.const 1))
    if return end

    ;; Test for one instruction
    (i32.eq (get_global $testRunMode) (i32.const 2))
    if
      (i32.eq (get_global $isInOpExecution) (i32.const 0))
      if
        return
      else
        ;; continue
        br $codeExec
      end
    end

    ;; Test for UntilHalt
    (i32.eq (get_global $testRunMode) (i32.const 3))
    if
      ;; Stop if HLT flag set
      (i32.ne
        (i32.and (get_global $cpuSignalFlags) (i32.const $SIG_HLT#))
        (i32.const 0)
      )
      if
        return
      else
        ;; continue
        br $codeExec
      end
    end

    ;; Run until code ends
    (i32.ge_u (get_global $PC) (get_global $testCodeEndsAt))
    if return end

    ;; Go on with code execution
    br $codeExec
  end
)

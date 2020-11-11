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
        (i32.and (get_global $stateFlags) (i32.const $SIG_HLT#))
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

;; Sets the machine type to the default Z80 machine
(func $resetMachineType
  i32.const 0 set_global $MACHINE_TYPE
)

;; Test machine memory read operation; logs the memory access
;; $addr: 16-bit memory address
;; returns: Memory contents
(func $testMachineRead (param $addr i32) (result i32)
  (local $value i32)
  (local $logAddr i32)
  
  ;; Read the memory value
  (i32.add (get_local $addr) (get_global $BANK_0_OFFS))
  i32.load8_u
  set_local $value

  ;; Calculate the address in the memory log
  (i32.add (get_global $TEST_MEM_LOG_OFFS)
    (i32.mul (get_global $memLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $value))

  ;; Store "read" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 0))

  ;; Increment log length
  (i32.add (get_global $memLogLength) (i32.const 1))
  set_global $memLogLength

  ;; Done, return the memory value
  get_local $value
)

;; Default memory write operation
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
(func $testMachineWrite (param $addr i32) (param $v i32)
  (local $logAddr i32)

  ;; Write the memory value
  (i32.add (get_local $addr) (get_global $BANK_0_OFFS))
  get_local $v
  i32.store8

  ;; Calculate the address in the memory log
  (i32.add (get_global $TEST_MEM_LOG_OFFS)
    (i32.mul (get_global $memLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $v))

  ;; Store "write" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 1))

  ;; Increment log length
  (i32.add (get_global $memLogLength) (i32.const 1))
  set_global $memLogLength
)

;; Test machine I/O read operation; logs the I/O access
;; $addr: 16-bit port address
;; returns: Port value
(func $testMachineIoRead (param $addr i32) (result i32)
  (local $value i32)
  (local $logAddr i32)

  ;; Read the next port value from the input buffer
  get_global $TEST_INPUT_OFFS
  get_global $nextTestInput
  i32.add
  i32.load8_u
  set_local $value

  ;; Move to the next input element
  (i32.add (get_global $nextTestInput) (i32.const 1))
  set_global $nextTestInput
  (i32.ge_u (get_global $nextTestInput) (get_global $testInputLength))
  if
    i32.const 0 set_global $nextTestInput
  end

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_IO_LOG_OFFS)
    (i32.mul (get_global $ioLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $value))

  ;; Store "read" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 0))

  ;; Increment log length
  (i32.add (get_global $ioLogLength) (i32.const 1))
  set_global $ioLogLength

  ;; Done, return the memory value
  get_local $value
)

;; Test machine memory write operation
;; $addr: 16-bit memory address
;; $v: 8-bit value to write
;; $suppCont: Suppress memory contention flag
(func $testMachineIoWrite (param $addr i32) (param $v i32)
  (local $logAddr i32)
  ;; Default delay

  (call $incTacts (i32.const 4))

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_IO_LOG_OFFS)
    (i32.mul (get_global $ioLogLength) (i32.const 4))
  )
  tee_local $logAddr

  ;; Store address in the log
  get_local $addr i32.store16 offset=0

  ;; Store value in the log
  (i32.store8 offset=2 (get_local $logAddr) (get_local $v))

  ;; Store "write" flag
  (i32.store8 offset=3 (get_local $logAddr) (i32.const 1))

  ;; Increment log length
  (i32.add (get_global $ioLogLength) (i32.const 1))
  set_global $ioLogLength
)

;; Test machine TBBLUE register index write operation
;; $val: 8-bit index vlaue
(func $testMachineTbBlueIndexWrite (param $val i32)
  (local $logAddr i32)

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_TBBLUE_LOG_OFFS)
    (i32.mul (get_global $tbBlueLogLength) (i32.const 2))
  )
  tee_local $logAddr

  ;; Store value in the log
  i32.const 1
  i32.store8 offset=0
  (i32.store8 offset=1 (get_local $logAddr) (get_local $val))

  ;; Increment log length
  (i32.add (get_global $tbBlueLogLength) (i32.const 1))
  set_global $tbBlueLogLength
)

;; Test machine TBBLUE value write operation
;; $val: 8-bit index vlaue
(func $testMachineTbBlueValueWrite (param $val i32)
  (local $logAddr i32)

  ;; Calculate the address in the I/O log
  (i32.add (get_global $TEST_TBBLUE_LOG_OFFS)
    (i32.mul (get_global $tbBlueLogLength) (i32.const 2))
  )
  tee_local $logAddr

  ;; Store value in the log
  i32.const 0
  i32.store8 offset=0
  (i32.store8 offset=1 (get_local $logAddr) (get_local $val))

  ;; Increment log length
  (i32.add (get_global $tbBlueLogLength) (i32.const 1))
  set_global $tbBlueLogLength
)

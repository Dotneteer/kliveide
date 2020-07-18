(module
  (func $trace (import "imports" "trace") (param i32))

  ;; We keep 1024 KB of memory
  (memory (export "memory") 24)

  ;; ==========================================================================
  ;; CPU API

  (export "turnOnCpu" (func $turnOnCpu))
  (export "resetCpu" (func $resetCpu))
  (export "getCpuState" (func $getCpuState))
  (export "updateCpuState" (func $updateCpuState))
  (export "enableExtendedInstructions" (func $enableExtendedInstructions))

  ;; Test Z80 CPU machine exports
  (export "prepareTest" (func $prepareTest))
  (export "setTestInputLength" (func $setTestInputLength))
  (export "getMemLogLength" (func $getMemLogLength))
  (export "getIoLogLength" (func $getIoLogLength))
  (export "getTbBlueLogLength" (func $getTbBlueLogLength))
  (export "runTestCode" (func $runTestCode))
  (export "resetMachineType" (func $resetMachineType))

  ;; ZX Spectrum machine exports
  (export "initZxSpectrum" (func $initZxSpectrum))
  (export "turnOnMachine" (func $turnOnMachine))
  (export "resetMachine" (func $resetMachine))
  (export "setUlaIssue" (func $setUlaIssue))
  (export "getMachineState" (func $getMachineState))
  (export "setExecutionOptions" (func $setExecutionOptions))
  (export "executeMachineCycle" (func $executeMachineCycle))
  (export "setKeyStatus" (func $setKeyStatus))
  (export "getKeyStatus" (func $getKeyStatus))
  (export "setPC" (func $setPC))
  (export "setInterruptTact" (func $setInterruptTact))
  (export "checkForInterrupt" (func $checkForInterrupt))
  (export "setBeeperSampleRate" (func $setBeeperSampleRate))
  (export "colorize" (func $colorize))
  (export "getCursorMode" (func $getCursorMode))

  ;; ==========================================================================
  ;; Function signatures

  (type $MemReadFunc (func (param $addr i32) (result i32)))
  (type $MemWriteFunc (func (param $addr i32) (param $v i32)))
  (type $PortReadFunc (func (param $addr i32) (result i32)))
  (type $PortWriteFunc (func (param $addr i32) (param $v i32)))
  (type $TbBlueWriteFunc (func (param $addr i32)))
  (type $OpFunc (func))
  (type $IndexedBitFunc (func (param $addr i32)))
  (type $BitOpFunc (func (param $a i32) (result i32)))
  (type $ActionFunc (func))
  (type $ValueFunc (func (result i32)))

  ;; ==========================================================================
  ;; Memory map
  ;; 0x00_0000 (64K): Memory for the Z80 CPU test machine/ZX Spectrum 48K
  ;; 0x01_0000 (28 bytes): Z80 registers
  ;; 0x01_0020 (8 bytes): Z80 8-bit register index conversion table
  ;; 0x01_0028 (4 bytes): Z80 16-bit register index conversion table
  ;; 0x01_0040 (448 bytes): State transfer buffer (between WA and JS)
  ;; 0x01_0200 (256 bytes): Test I/O input buffer
  ;; 0x01_0300 (1024 bytes): Test memory access log
  ;; 0x01_0700 (1024 bytes): Test I/O access log
  ;; 0x01_0b00 (1024 bytes): Test TbBlue access log
  ;; 0x01_0f00 (256 bytes): INC flags table
  ;; 0x01_1000 (256 bytes): DEC flags table
  ;; 0x01_1100 (256 bytes): Logic operations flags table
  ;; 0x01_1200 (256 bytes): RLC flags table
  ;; 0x01_1300 (256 bytes): RRC flags table
  ;; 0x01_1400 (256 bytes): RL flags (no carry) table
  ;; 0x01_1500 (256 bytes): RL flags (carry set) table
  ;; 0x01_1600 (256 bytes): RR flags (no carry) table
  ;; 0x01_1700 (256 bytes): RR flags (carry set) table
  ;; 0x01_1800 (256 bytes): SRA flags table
  ;; 0x01_1900 (1024 bytes): ZX Spectrum execution cyle options
  ;; 0x01_1D00 (16384 bytes): ZX Spectrum 48 ROM
  ;; 0x01_5D00 (256 bytes): Keyboard line status
  ;; 0x01_5E00 (0x6_0000 bytes): Rendering tact table
  ;; 0x07_5E00 (0x1_4000 bytes): Contention value table
  ;; 0x08_9E00 (256 bytes): Paper color bytes (flash off)
  ;; 0x08_9F00 (256 bytes): Ink color bytes (flash off)
  ;; 0x08_A000 (256 bytes): Paper color bytes (flash on)
  ;; 0x08_A100 (256 bytes): Ink color bytes (flash on)
  ;; 0x08_A200 (0x2_8000 bytes): Pixel rendering buffer
  ;; 0x0B_2200 (0x2000 bytes): Beeper sample rendering buffer
  ;; 0x0B_4200 (0xA_0000 bytes): Buffer for pixel colorization
  ;; 0x15_4200 ZX Spectrum 48 palette
  ;; 0x15_4300 Next free slot
  ;; The offset of the first byte of the ZX Spectrum 48 memory
  ;; Block lenght: 0x1_0000
  (global $SP_MEM_OFFS i32 (i32.const 0))

  ;; ==========================================================================
  ;; Z80 CPU core
  ;; ==========================================================================
  ;; Z80 CPU state

  ;; CPU registers
  (global $A (mut i32) (i32.const 0x00))
  (global $F (mut i32) (i32.const 0x00))

  (global $PC (mut i32) (i32.const 0x00))
  (global $SP (mut i32) (i32.const 0x00))

  ;; The index of the register area (length: 0x1c)
  (global $REG_AREA_INDEX i32 (i32.const 0x1_0000))

  ;; State transfer buffer (length: 0xc0)
  (global $STATE_TRANSFER_BUFF i32 (i32.const 0x1_0040))

  ;; Once-set
  (global $tactsInFrame (mut i32) (i32.const 1_000_000)) ;; Number of tacts within a frame
  (global $allowExtendedSet (mut i32) (i32.const 0x00))  ;; Should allow extended operation set?

  ;; Mutable
  (global $tacts (mut i32) (i32.const 0x0000)) ;; CPU tacts since starting the cpu
  (global $stateFlags (mut i32) (i32.const 0x00)) ;; Z80 state flags
  (global $useGateArrayContention (mut i32) (i32.const 0x0000)) ;; Should use gate array contention?
  (global $iff1 (mut i32) (i32.const 0x00)) ;; Interrupt flip-flop #1
  (global $iff2 (mut i32) (i32.const 0x00)) ;; Interrupt flip-flop #2
  (global $interruptMode (mut i32) (i32.const 0x00)) ;; Current interrupt mode
  (global $isInterruptBlocked (mut i32) (i32.const 0x00)) ;; Current interrupt block
  (global $isInOpExecution (mut i32) (i32.const 0x00)) ;; Is currently processing an op?
  (global $prefixMode (mut i32) (i32.const 0x00)) ;; Current operation prefix mode
  (global $indexMode (mut i32) (i32.const 0x00)) ;; Current operation index mode
  (global $maskableInterruptModeEntered (mut i32) (i32.const 0x00)) ;; Signs that CPU entered into maskable interrupt mode
  (global $opCode (mut i32) (i32.const 0x00)) ;; Operation code being processed

  ;; Writes the CPU state to the transfer area
  (func $getCpuState
    ;; Registers
    (i32.store8 offset=0 (get_global $STATE_TRANSFER_BUFF) (get_global $F))
    (i32.store8 offset=1 (get_global $STATE_TRANSFER_BUFF) (get_global $A))

    (i32.store16 offset=18 (get_global $STATE_TRANSFER_BUFF) (get_global $PC))
    (i32.store16 offset=20 (get_global $STATE_TRANSFER_BUFF) (get_global $SP))

    ;; Other CPU state variables
    (i32.store offset=28 (get_global $STATE_TRANSFER_BUFF) (get_global $tactsInFrame))
    (i32.store8 offset=32 (get_global $STATE_TRANSFER_BUFF) (get_global $allowExtendedSet))
    (i32.store offset=33 (get_global $STATE_TRANSFER_BUFF) (get_global $tacts))
    (i32.store8 offset=37 (get_global $STATE_TRANSFER_BUFF) (get_global $stateFlags))
    (i32.store8 offset=38 (get_global $STATE_TRANSFER_BUFF) (get_global $useGateArrayContention))
    (i32.store8 offset=39 (get_global $STATE_TRANSFER_BUFF) (get_global $iff1))
    (i32.store8 offset=40 (get_global $STATE_TRANSFER_BUFF) (get_global $iff2))
    (i32.store8 offset=41 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptMode))
    (i32.store8 offset=42 (get_global $STATE_TRANSFER_BUFF) (get_global $isInterruptBlocked))
    (i32.store8 offset=43 (get_global $STATE_TRANSFER_BUFF) (get_global $isInOpExecution))
    (i32.store8 offset=44 (get_global $STATE_TRANSFER_BUFF) (get_global $prefixMode))
    (i32.store8 offset=45 (get_global $STATE_TRANSFER_BUFF) (get_global $indexMode))
    (i32.store8 offset=46 (get_global $STATE_TRANSFER_BUFF) (get_global $maskableInterruptModeEntered))
    (i32.store8 offset=47 (get_global $STATE_TRANSFER_BUFF) (get_global $opCode))
  )

  ;; Restores the CPU state from the transfer area
  (func $updateCpuState
    ;; Registers
    (set_global $F (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=0))
    (set_global $A (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=1))

    (set_global $PC (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=18))
    (set_global $SP (get_global $STATE_TRANSFER_BUFF) (i32.load16_u offset=20))

    ;; Other CPU state variables
    (set_global $tactsInFrame (get_global $STATE_TRANSFER_BUFF) (i32.load offset=28))
    (set_global $allowExtendedSet (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=32))
    (set_global $tacts (get_global $STATE_TRANSFER_BUFF) (i32.load offset=33))
    (set_global $stateFlags (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=37))
    (set_global $useGateArrayContention (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=38))
    (set_global $iff1 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=39))
    (set_global $iff2 (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=40))
    (set_global $interruptMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=41))
    (set_global $isInterruptBlocked (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=42))
    (set_global $isInOpExecution (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=43))
    (set_global $prefixMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=44))
    (set_global $indexMode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=45))
    (set_global $maskableInterruptModeEntered (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=46))
    (set_global $opCode (get_global $STATE_TRANSFER_BUFF) (i32.load8_u offset=47))
  )

  ;; ==========================================================================
  ;; Helpers for testing the Z80 CPU

  ;; The offset of the test input stream (length: 0x0100)
  (global $TEST_INPUT_OFFS i32 (i32.const 0x1_0200))

  ;; The offset of the test memory access log stream (length: 0x0400)
  (global $TEST_MEM_LOG_OFFS i32 (i32.const 0x1_0300))

  ;; The offset of the test I/O access log stream stream (length: 0x0400)
  (global $TEST_IO_LOG_OFFS i32 (i32.const 0x1_0700))

  ;; The offset of the test TBBlue access log stream stream (length: 0x0400)
  (global $TEST_TBBLUE_LOG_OFFS i32 (i32.const 0x1_0b00))

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
          (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;)))
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
      (i32.ge_u (call $getPC) (get_global $testCodeEndsAt))
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
    (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
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
    (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
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

  ;; ==========================================================================
  ;; Function jump table

  ;; Machine type discriminator
  ;; 0x00: ZX Spectrum 48K
  ;; 0x01: ZX Spectrum 128K
  ;; 0x02: ZX Spectrum +3
  ;; 0x03: ZX Spectrum Next
  ;; 0x04: Z80 Test machine
  (global $MACHINE_TYPE (mut i32) (i32.const 0x00))

  ;; Number of functions per machine types
  (global $MACHINE_FUNC_COUNT i32 (i32.const 20))

  ;; Jump table start indices
  (global $STANDARD_JT i32 (i32.const 100))
  (global $INDEXED_JT i32 (i32.const 356))
  (global $EXTENDED_JT i32 (i32.const 612))
  (global $BIT_JT i32 (i32.const 868))
  (global $INDEXED_BIT_JT i32 (i32.const 1124))
  (global $BOP_JT i32 (i32.const 1380))

  ;; 100: 5 machine types (12 function for each)
  ;; 256: Standard operations
  ;; 256: Indexed operations
  ;; 256: Extended operations
  ;; 256: Bit operations
  ;; 256: Indexed bit operations
  ;; 8: ALU bit operations

  (table $dispatch 1388 anyfunc)

  ;; Table of machine type functions
  ;; Function indexes
  ;; 0: Read memory (func (param $addr i32) (result i32)))
  ;; 1: Read memory, non-contended (func (param $addr i32) (result i32)))
  ;; 2: Write memory (func (param $addr i32) (param $v i32)))
  ;; 3: Read port (func (param $addr i32) (result i32)))
  ;; 4: Write port (func (param $addr i32) (param $v i32)))
  ;; 5: Write TbBlue register index (func (param $addr i32)))
  ;; 6: Write TbBlue register value (func (param $addr i32)))
  ;; 7: Setup machine (func)
  ;; 8: Get machine state (func)
  ;; 9: Start new frame (func)
  ;; 10: Screen frame ended (func)
  ;; 11: Colorize (func)
  ;; 12-19: Unused
  (elem (i32.const 0)
    ;; Index 0: Machine type #0
    $readMemorySp48
    $readMemoryNcSp48
    $writememorySp48
    $readPortSp48
    $writePortSp48
    $NOOP
    $NOOP

    $setupSpectrum48
    $getSpectrum48MachineState
    $NOOP
    $NOOP
    $colorizeSp48
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    ;; Index 20: Machine type #1
    $defaultRead
    $defaultRead
    $defaultWrite
    $defaultIoRead
    $defaultIoWrite
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    ;; Index 40: Machine type #2
    $defaultRead
    $defaultRead
    $defaultWrite
    $defaultIoRead
    $defaultIoWrite
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    ;; Index 60: Machine type #3
    $defaultRead
    $defaultRead
    $defaultWrite
    $defaultIoRead
    $defaultIoWrite
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP

    ;; Index 80: Test Z80 CPU Machine (type #4)
    $testMachineRead
    $testMachineRead
    $testMachineWrite
    $testMachineIoRead
    $testMachineIoWrite
    $testMachineTbBlueIndexWrite
    $testMachineTbBlueValueWrite

    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
  
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
    $NOOP
)

;; Table of standard instructions
(elem (i32.const 100)
    ;; 0x00-0x07
    $NOOP     $LdBCNN   $LdBCiA   $IncBC    $IncB     $DecB     $LdBN     $Rlca
    ;; 0x08-0x0f
    $ExAf     $AddHLBC  $LdABCi   $DecBC    $IncC     $DecC     $LdCN     $Rrca
    ;; 0x10-0x17
    $Djnz     $LdDENN   $LdDEiA   $IncDE    $IncD     $DecD     $LdDN     $Rla
    ;; 0x18-0x1f
    $JrE      $AddHLDE  $LdADEi   $DecDE    $IncE     $DecE     $LdEN     $Rra
    ;; 0x20-0x27
    $JrNz     $LdHLNN   $LdNNiHL  $IncHL    $IncH     $DecH     $LdHN     $Daa
    ;; 0x28-0x2f
    $JrZ      $AddHLHL  $LdHLNNi  $DecHL    $IncL     $DecL     $LdLN     $Cpl
    ;; 0x30-0x37
    $JrNc     $LdSPNN   $LdNNiA   $IncSP    $IncHLi   $DecHLi   $LdHLiN   $Scf
    ;; 0x38-0x3f
    $JrC      $AddHLSP  $LdANNi   $DecSP    $IncA     $DecA     $LdAN     $Ccf
    ;; 0x40-0x47
    $NOOP     $LdBC     $LdBD     $LdBE     $LdBH     $LdBL     $LdBHLi   $LdBA     
    ;; 0x48-0x4f
    $LdCB     $NOOP     $LdCD     $LdCE     $LdCH     $LdCL     $LdCHLi   $LdCA     
    ;; 0x50-0x57
    $LdDB     $LdDC     $NOOP     $LdDE     $LdDH     $LdDL     $LdDHLi   $LdDA     
    ;; 0x58-0x5f
    $LdEB     $LdEC     $LdED     $NOOP     $LdEH     $LdEL     $LdEHLi   $LdEA     
    ;; 0x60-0x67
    $LdHB     $LdHC     $LdHD     $LdHE     $NOOP     $LdHL     $LdHHLi   $LdHA     
    ;; 0x68-0x6f
    $LdLB     $LdLC     $LdLD     $LdLE     $LdLH     $NOOP     $LdLHLi   $LdLA     
    ;; 0x70-0x77
    $LdHLiB   $LdHLiC   $LdHLiD   $LdHLiE   $LdHLiH   $LdHLiL   $Halt     $LdHLiA   
    ;; 0x78-0x7f
    $LdAB     $LdAC     $LdAD     $LdAE     $LdAH     $LdAL     $LdAHLi   $NOOP     
    ;; 0x80-0x87
    $AddAB    $AddAC    $AddAD    $AddAE    $AddAH    $AddAL    $AddAHLi  $AddAA
    ;; 0x88-0x8f
    $AdcAB    $AdcAC    $AdcAD    $AdcAE    $AdcAH    $AdcAL    $AdcAHLi  $AdcAA
    ;; 0x90-0x97
    $SubAB    $SubAC    $SubAD    $SubAE    $SubAH    $SubAL    $SubAHLi  $SubAA
    ;; 0x98-0x9f
    $SbcAB    $SbcAC    $SbcAD    $SbcAE    $SbcAH    $SbcAL    $SbcAHLi  $SbcAA
    ;; 0xa0-0xa7
    $AndAB    $AndAC    $AndAD    $AndAE    $AndAH    $AndAL    $AndAHLi  $AndAA
    ;; 0xa8-0xaf
    $XorAB    $XorAC    $XorAD    $XorAE    $XorAH    $XorAL    $XorAHLi  $XorAA
    ;; 0xb0-0xb7
    $OrAB     $OrAC     $OrAD     $OrAE     $OrAH     $OrAL     $OrAHLi   $OrAA
    ;; 0xb8-0xbf
    $CpAB     $CpAC     $CpAD     $CpAE     $CpAH     $CpAL     $CpAHLi   $CpAA
    ;; 0xc0-0xc7
    $RetNz    $PopBC    $JpNz     $Jp       $CallNz   $PushBC   $AddAN    $RstN
    ;; 0xc8-0xcf
    $RetZ     $Ret      $JpZ      $SignCB   $CallZ    $CallNN   $AdcAN    $RstN
    ;; 0xd0-0xd7
    $RetNc    $PopDE    $JpNc     $OutNA    $CallNc   $PushDE   $SubAN    $RstN
    ;; 0xd8-0xdf
    $RetC     $Exx      $JpC      $InAN     $CallC    $SignDD   $SbcAN    $RstN
    ;; 0xe0-0xe7
    $RetPo    $PopHL    $JpPo     $ExSPiHL  $CallPo   $PushHL   $AndAN    $RstN
    ;; 0xe8-0xef
    $RetPe    $JpHL     $JpPe     $ExDEHL   $CallPe   $SignED   $XorAN    $RstN
    ;; 0xf0-0xf7
    $RetP     $PopAF    $JpP      $Di       $CallP    $PushAF   $OrAN     $RstN
    ;; 0xf8-0xff
    $RetM     $LdSPHL   $JpM      $Ei       $CallM    $SignFD   $CpAN     $RstN
  )

;; Table of indexed instructions
(elem (i32.const 356)
    ;; 0x00-0x07
    $NOOP     $LdBCNN   $LdBCiA   $IncBC    $IncB     $DecB     $LdBN     $Rlca
    ;; 0x08-0x0f
    $ExAf     $AddIXBC  $LdABCi   $DecBC    $IncC     $DecC     $LdCN     $Rrca
    ;; 0x10-0x17
    $Djnz     $LdDENN   $LdDEiA   $IncDE    $IncD     $DecD     $LdDN     $Rla
    ;; 0x18-0x1f
    $JrE      $AddIXDE  $LdADEi   $DecDE    $IncE     $DecE     $LdEN     $Rra
    ;; 0x20-0x27
    $JrNz     $LdIXNN   $LdNNiIX  $IncIX    $IncXH    $DecXH    $LdXHN    $Daa
    ;; 0x28-0x2f
    $JrZ      $AddIXIX  $LdIXNNi  $DecIX    $IncXL    $DecXL    $LdXLN    $Cpl
    ;; 0x30-0x37
    $JrNc     $LdSPNN   $LdNNiA   $IncSP    $IncIXi   $DecIXi   $LdIXiN   $Scf
    ;; 0x38-0x3f
    $JrC      $AddIXSP  $LdANNi   $DecSP    $IncA     $DecA     $LdAN     $Ccf
    ;; 0x40-0x47
    $NOOP     $LdBC     $LdBD     $LdBE     $LdBXH    $LdBXL    $LdBIXi   $LdBA
    ;; 0x48-0x4f
    $LdCB     $NOOP     $LdCD     $LdCE     $LdCXH    $LdCXL    $LdCIXi   $LdCA
    ;; 0x50-0x57
    $LdDB     $LdDC     $NOOP     $LdDE     $LdDXH    $LdDXL    $LdDIXi   $LdDA
    ;; 0x58-0x5f
    $LdEB     $LdEC     $LdED     $NOOP     $LdEXH    $LdEXL    $LdEIXi   $LdEA
    ;; 0x60-0x67
    $LdXHB    $LdXHC    $LdXHD    $LdXHE    $NOOP     $LdXHXL   $LdHIXi   $LdXHA
    ;; 0x68-0x6f
    $LdXLB    $LdXLC    $LdXLD    $LdXLE    $LdXLXH   $NOOP     $LdLIXi   $LdXLA
    ;; 0x70-0x77
    $LdIXiB   $LdIXiC   $LdIXiD   $LdIXiE   $LdIXiH   $LdIXiL   $Halt     $LdIXiA
    ;; 0x78-0x7f
    $LdAB     $LdAC     $LdAD     $LdAE     $LdAXH    $LdAXL    $LdAIXi   $NOOP
    ;; 0x80-0x87
    $AddAB    $AddAC    $AddAD    $AddAE    $AddAXH   $AddAXL   $AddAIXi  $AddAA
    ;; 0x88-0x8f
    $AdcAB    $AdcAC   $AdcAD    $AdcAE    $AdcAXH   $AdcAXL   $AdcAIXi  $AdcAA
    ;; 0x90-0x97
    $SubAB    $SubAC    $SubAD    $SubAE    $SubAXH   $SubAXL   $SubAIXi  $SubAA
    ;; 0x98-0x9f
    $SbcAB    $SbcAC    $SbcAD    $SbcAE    $SbcAXH   $SbcAXL   $SbcAIXi  $SbcAA
    ;; 0xa0-0xa7
    $AndAB    $AndAC    $AndAD    $AndAE    $AndAXH   $AndAXL   $AndAIXi  $AndAA
    ;; 0xa8-0xaf
    $XorAB    $XorAC    $XorAD    $XorAE    $XorAXH   $XorAXL   $XorAIXi  $XorAA
    ;; 0xb0-0xb7
    $OrAB     $OrAC     $OrAD     $OrAE     $OrAXH    $OrAXL    $OrAIXi   $OrAA
    ;; 0xb8-0xbf
    $CpAB     $CpAC     $CpAD     $CpAE     $CpAXH    $CpAXL    $CpAIXi   $CpAA
    ;; 0xc0-0xc7
    $RetNz    $PopBC    $JpNz     $Jp       $CallNz   $PushBC   $AddAN    $RstN
    ;; 0xc8-0xcf
    $RetZ     $Ret      $JpZ      $SignCB   $CallZ    $CallNN   $AdcAN    $RstN
    ;; 0xd0-0xd7
    $RetNc    $PopDE    $JpNc     $OutNA    $CallNc   $PushDE   $SubAN    $RstN
    ;; 0xd8-0xdf
    $RetC     $Exx      $JpC      $InAN     $CallC    $SignDD   $SbcAN    $RstN
    ;; 0xe0-0xe7
    $RetPo    $PopIX    $JpPo     $ExSPiIX  $CallPo   $PushIX   $AndAN    $RstN
    ;; 0xe8-0xef
    $RetPe    $JpIX     $JpPe     $ExDEHL   $CallPe   $NOOP     $XorAN    $RstN
    ;; 0xf0-0xf7
    $RetP     $PopAF    $JpP      $Di       $CallP    $PushAF   $OrAN     $RstN
    ;; 0xf8-0xff
    $RetM     $LdSPIX   $JpM      $Ei       $CallM    $SignFD   $CpAN     $RstN
  )

;; Table of extended instructions
(elem (i32.const 612)
    ;; 0x00-0x07
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x08-0x0f
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x10-0x17
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x18-0x1f
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x20-0x27
    $NOOP     $NOOP     $NOOP     $SwapNib  $Mirror   $NOOP     $NOOP     $TestN
    ;; 0x28-0x2f
    $Bsla     $Bsra     $Bsrl     $Bsrf     $Brlc     $NOOP     $NOOP     $NOOP
    ;; 0x30-0x37
    $Mul      $AddHLA   $AddDEA   $AddBCA   $AddHLNN  $AddDENN  $AddBCNN  $NOOP
    ;; 0x38-0x3f
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x40-0x47
    $InBC     $OutCB    $SbcHLBC  $LdNNiBC  $Neg      $Retn     $ImN      $LdIA
    ;; 0x48-0x4f
    $InCC     $OutCC    $AdcHLBC  $LdBCNNi  $Neg      $Retn     $ImN      $LdRA
    ;; 0x50-0x57
    $InDC     $OutCD    $SbcHLDE  $LdNNiDE  $Neg      $Retn     $ImN      $LdAXr
    ;; 0x58-0x5f
    $InEC     $OutCE    $AdcHLDE  $LdDENNi  $Neg      $Retn     $ImN      $LdAXr
    ;; 0x60-0x67
    $InHC     $OutCH    $SbcHLHL  $LdNNiHL  $Neg      $Retn     $ImN      $Rrd
    ;; 0x68-0x6f
    $InLC     $OutCL    $AdcHLHL  $LdHLNNi  $Neg      $Retn     $ImN      $Rld
    ;; 0x70-0x77
    $In0C     $OutC0    $SbcHLSP  $LdNNiSP  $Neg      $Retn     $ImN      $NOOP
    ;; 0x78-0x7f
    $InAC     $OutCA    $AdcHLSP  $LdSPNNi  $Neg      $Retn     $ImN      $NOOP
    ;; 0x80-0x87
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x88-0x8f
    $NOOP     $NOOP     $PushNN   $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0x90-0x97
    $OutInB   $NextReg  $NextRegA $PixelDn  $PixelAd  $SetAE    $NOOP     $NOOP
    ;; 0x98-0x9f
    $JpInC    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xa0-0xa7
    $Ldi      $Cpi      $Ini      $Outi     $Ldix     $Ldws     $NOOP     $NOOP
    ;; 0xa8-0xaf
    $Ldd      $Cpd      $Ind      $Outd     $Lddx     $NOOP     $NOOP     $NOOP
    ;; 0xb0-0xb7
    $Ldir     $Cpir     $Inir     $Otir     $Ldirx    $NOOP     $NOOP     $Ldpirx
    ;; 0xb8-0xbf
    $Lddr     $Cpdr     $Indr     $Otdr     $Lddrx    $NOOP     $NOOP     $NOOP
    ;; 0xc0-0xc7
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xc8-0xcf
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xd0-0xd7
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xd8-0xdf
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xe0-0xe7
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xe8-0xef
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xf0-0xf7
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
    ;; 0xf8-0xff
    $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP     $NOOP
  )

;; Table of bit instructions
(elem (i32.const 868)
    ;; 0x00-0x07
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x08-0x0f
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x10-0x17
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x18-0x1f
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x20-0x27
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x28-0x2f
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x30-0x37
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x38-0x3f
    $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
    ;; 0x40-0x47
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x48-0x4f
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x50-0x57
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x58-0x5f
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x60-0x67
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x68-0x6f
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x70-0x77
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x78-0x7f
    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
    ;; 0x80-0x87
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0x88-0x8f
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0x90-0x97
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0x98-0x9f
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0xa0-0xa7
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0xa8-0xaf
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0xb0-0xb7
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0xb8-0xbf
    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
    ;; 0xc0-0xc7
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xc8-0xcf
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xd0-0xd7
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xd8-0xdf
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xe0-0xe7
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xe8-0xef
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xf0-0xf7
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
    ;; 0xf8-0xff
    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  )

;; Table of indexed bit instructions
(elem (i32.const 1124)
    ;; 0x00-0x07
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x08-0x0f
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x10-0x17
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x18-0x1f
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x20-0x27
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x28-0x2f
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x30-0x37
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x38-0x3f
    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
    ;; 0x40-0x47
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x48-0x4f
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x50-0x57
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x58-0x5f
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x60-0x67
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x68-0x6f
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x70-0x77
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x78-0x7f
    $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
    ;; 0x80-0x87
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0x88-0x8f
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0x90-0x97
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0x98-0x9f
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0xa0-0xa7
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0xa8-0xaf
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0xb0-0xb7
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0xb8-0xbf
    $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
    ;; 0xc0-0xc7
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xc8-0xcf
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xd0-0xd7
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xd8-0xdf
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xe0-0xe7
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xe8-0xef
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xf0-0xf7
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
    ;; 0xf8-0xff
    $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  )

  ;; Table of bit operations
  (elem (i32.const 1380)
    $Rlc
    $Rrc
    $Rl
    $Rr
    $Sla
    $Sra
    $Sll
    $Srl
  )

  ;; ALU tables

  ;; 8-bit INC operation flags table
  (global $INC_FLAGS i32 (i32.const 0x1_0f00))
  (data (i32.const 0x1_0f00) "\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\10\00\00\00\00\00\00\00\08\08\08\08\08\08\08\08\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\30\20\20\20\20\20\20\20\28\28\28\28\28\28\28\28\94\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\90\80\80\80\80\80\80\80\88\88\88\88\88\88\88\88\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\b0\a0\a0\a0\a0\a0\a0\a0\a8\a8\a8\a8\a8\a8\a8\a8\50")

  ;; 8-bit DEC operation flags table
  (global $DEC_FLAGS i32 (i32.const 0x1_1000))
  (data (i32.const 0x1_1000) "\ba\42\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\02\02\02\02\02\02\02\02\0a\0a\0a\0a\0a\0a\0a\1a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3a\22\22\22\22\22\22\22\22\2a\2a\2a\2a\2a\2a\2a\3e\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\82\82\82\82\82\82\82\82\8a\8a\8a\8a\8a\8a\8a\9a\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa\ba\a2\a2\a2\a2\a2\a2\a2\a2\aa\aa\aa\aa\aa\aa\aa")

  ;; 8-bit ALU logical operation flags table
  (global $LOG_FLAGS i32 (i32.const 0x1_1100))
  (data (i32.const 0x1_1100) "\44\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\00\04\04\00\04\00\00\04\0c\08\08\0c\08\0c\0c\08\04\00\00\04\00\04\04\00\08\0c\0c\08\0c\08\08\0c\24\20\20\24\20\24\24\20\28\2c\2c\28\2c\28\28\2c\20\24\24\20\24\20\20\24\2c\28\28\2c\28\2c\2c\28\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\84\80\80\84\80\84\84\80\88\8c\8c\88\8c\88\88\8c\80\84\84\80\84\80\80\84\8c\88\88\8c\88\8c\8c\88\a0\a4\a4\a0\a4\a0\a0\a4\ac\a8\a8\ac\a8\ac\ac\a8\a4\a0\a0\a4\a0\a4\a4\a0\a8\ac\ac\a8\ac\a8\a8\ac")

  ;; 8-bit RLC operation flags table
  (global $RLC_FLAGS i32 (i32.const 0x1_1200))
  (data (i32.const 0x1_1200) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

  ;; 8-bit RRC operation flags table
  (global $RRC_FLAGS i32 (i32.const 0x1_1300))
  (data (i32.const 0x1_1300) "\44\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\00\85\04\81\04\81\00\85\04\81\00\85\00\85\04\81\0c\89\08\8d\08\8d\0c\89\08\8d\0c\89\0c\89\08\8d\04\81\00\85\00\85\04\81\00\85\04\81\04\81\00\85\08\8d\0c\89\0c\89\08\8d\0c\89\08\8d\08\8d\0c\89\24\a1\20\a5\20\a5\24\a1\20\a5\24\a1\24\a1\20\a5\28\ad\2c\a9\2c\a9\28\ad\2c\a9\28\ad\28\ad\2c\a9\20\a5\24\a1\24\a1\20\a5\24\a1\20\a5\20\a5\24\a1\2c\a9\28\ad\28\ad\2c\a9\28\ad\2c\a9\2c\a9\28\ad")

  ;; 8-bit RL operation flags with no carry table
  (global $RL0_FLAGS i32 (i32.const 0x1_1400))
  (data (i32.const 0x1_1400) "\44\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\45\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9")

  ;; 8-bit RL operation flags with carry table
  (global $RL1_FLAGS i32 (i32.const 0x1_1500))
  (data (i32.const 0x1_1500) "\00\04\04\00\0c\08\08\0c\04\00\00\04\08\0c\0c\08\24\20\20\24\28\2c\2c\28\20\24\24\20\2c\28\28\2c\04\00\00\04\08\0c\0c\08\00\04\04\00\0c\08\08\0c\20\24\24\20\2c\28\28\2c\24\20\20\24\28\2c\2c\28\84\80\80\84\88\8c\8c\88\80\84\84\80\8c\88\88\8c\a0\a4\a4\a0\ac\a8\a8\ac\a4\a0\a0\a4\a8\ac\ac\a8\80\84\84\80\8c\88\88\8c\84\80\80\84\88\8c\8c\88\a4\a0\a0\a4\a8\ac\ac\a8\a0\a4\a4\a0\ac\a8\a8\ac\01\05\05\01\0d\09\09\0d\05\01\01\05\09\0d\0d\09\25\21\21\25\29\2d\2d\29\21\25\25\21\2d\29\29\2d\05\01\01\05\09\0d\0d\09\01\05\05\01\0d\09\09\0d\21\25\25\21\2d\29\29\2d\25\21\21\25\29\2d\2d\29\85\81\81\85\89\8d\8d\89\81\85\85\81\8d\89\89\8d\a1\a5\a5\a1\ad\a9\a9\ad\a5\a1\a1\a5\a9\ad\ad\a9\81\85\85\81\8d\89\89\8d\85\81\81\85\89\8d\8d\89\a5\a1\a1\a5\a9\ad\ad\a9\a1\a5\a5\a1\ad\a9\a9\ad")

  ;; 8-bit RR operation flags with no carry table
  (global $RR0_FLAGS i32 (i32.const 0x1_1600))
  (data (i32.const 0x1_1600) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\04\05\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29")

  ;; 8-bit RL operation flags with carry table
  (global $RR1_FLAGS i32 (i32.const 0x1_1700))
  (data (i32.const 0x1_1700) "\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

  ;; 8-bit SRA operation flags table
  (global $SRA_FLAGS i32 (i32.const 0x1_1800))
  (data (i32.const 0x1_1800) "\44\45\00\01\00\01\04\05\00\01\04\05\04\05\00\01\08\09\0c\0d\0c\0d\08\09\0c\0d\08\09\08\09\0c\0d\00\01\04\05\04\05\00\01\04\05\00\01\00\01\04\05\0c\0d\08\09\08\09\0c\0d\08\09\0c\0d\0c\0d\08\09\20\21\24\25\24\25\20\21\24\25\20\21\20\21\24\25\2c\2d\28\29\28\29\2c\2d\28\29\2c\2d\2c\2d\28\29\24\25\20\21\20\21\24\25\20\21\24\25\24\25\20\21\28\29\2c\2d\2c\2d\28\29\2c\2d\28\29\28\29\2c\2d\84\85\80\81\80\81\84\85\80\81\84\85\84\85\80\81\88\89\8c\8d\8c\8d\88\89\8c\8d\88\89\88\89\8c\8d\80\81\84\85\84\85\80\81\84\85\80\81\80\81\84\85\8c\8d\88\89\88\89\8c\8d\88\89\8c\8d\8c\8d\88\89\a0\a1\a4\a5\a4\a5\a0\a1\a4\a5\a0\a1\a0\a1\a4\a5\ac\ad\a8\a9\a8\a9\ac\ad\a8\a9\ac\ad\ac\ad\a8\a9\a4\a5\a0\a1\a0\a1\a4\a5\a0\a1\a4\a5\a4\a5\a0\a1\a8\a9\ac\ad\ac\ad\a8\a9\ac\ad\a8\a9\a8\a9\ac\ad")

  ;; Reg8 index conversion table
  (global $REG8_TAB_OFFS i32 (i32.const 0x1_0020))
  (data (i32.const 0x1_0020) "\03\02\05\04\07\06\00\01")

  ;; Reg16 index conversion table
  (global $REG16_TAB_OFFS i32 (i32.const 0x1_0028))
  (data (i32.const 0x1_0028) "\02\04\06\14")

  ;; Represents a no-operation function
  (func $NOOP)

  ;; ==========================================================================
  ;; Z80 CPU registers access

  ;; Gets the value of A
  (func $getA (result i32)
    get_global $A
  )

  ;; Sets the value of A
  (func $setA (param $v i32)
    get_local $v set_global $A
  )
  
  ;; Gets the value of AF
  (func $getAF (result i32)
    (i32.or 
      (i32.shl (get_global $A) (i32.const 8))
      (get_global $F)
    )
  )

  ;; Sets the value of AF
  (func $setAF (param $v i32)
    (i32.and (get_local $v) (i32.const 0xff))
    set_global $F
    (i32.and 
      (i32.shr_u (get_local $v) (i32.const 8)) 
      (i32.const 0xff)
    )
    set_global $A
  )

  ;; Gets the value of B
  (func $getB (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=3
  )

  ;; Sets the value of B
  (func $setB (param $v i32)
    (i32.store8 offset=3 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of C
  (func $getC (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=2
  )

  ;; Sets the value of C
  (func $setC (param $v i32)
    (i32.store8 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of BC
  (func $getBC (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=2
  )

  ;; Sets the value of BC
  (func $setBC (param $v i32)
    (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of D
  (func $getD (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=5
  )

  ;; Sets the value of D
  (func $setD (param $v i32)
    (i32.store8 offset=5 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of E
  (func $getE (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=4
  )

  ;; Sets the value of E
  (func $setE (param $v i32)
    (i32.store8 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of DE
  (func $getDE (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=4
  )

  ;; Sets the value of DE
  (func $setDE (param $v i32)
    (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of H
  (func $getH (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=7
  )

  ;; Sets the value of H
  (func $setH (param $v i32)
    (i32.store8 offset=7 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of L
  (func $getL (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=6
  )

  ;; Sets the value of L
  (func $setL (param $v i32)
    (i32.store8 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of HL
  (func $getHL (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=6
  )

  ;; Sets the value of HL
  (func $setHL (param $v i32)
    (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of I
  (func $getI (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=16
  )

  ;; Sets the value of I
  (func $setI (param $v i32)
    (i32.store8 offset=16 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of R
  (func $getR (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=17
  )

  ;; Sets the value of R
  (func $setR (param $v i32)
    (i32.store8 offset=17 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of PC
  (func $getPC (result i32)
    get_global $PC
  )

  ;; Sets the value of PC
  (func $setPC (param $v i32)
    (set_global $PC (i32.and (get_local $v) (i32.const 0xffff)))
  )

  ;; Gets the value of SP
  (func $getSP (result i32)
    get_global $SP
  )

  ;; Sets the value of SP
  (func $setSP (param $v i32)
    (set_global $SP (i32.and (get_local $v) (i32.const 0xffff)))
  )

  ;; Gets the value of XH
  (func $getXH (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=23
  )

  ;; Sets the value of XH
  (func $setXH (param $v i32)
    (i32.store8 offset=23 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of XL
  (func $getXL (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=22
  )

  ;; Sets the value of XL
  (func $setXL (param $v i32)
    (i32.store8 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of IX
  (func $getIX (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=22
  )

  ;; Sets the value of IX
  (func $setIX (param $v i32)
    (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of YH
  (func $getYH (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=25
  )

  ;; Sets the value of YH
  (func $setYH (param $v i32)
    (i32.store8 offset=25 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of YL
  (func $getYL (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=24
  )

  ;; Sets the value of YL
  (func $setYL (param $v i32)
    (i32.store8 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of IY
  (func $getIY (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=24
  )

  ;; Sets the value of IY
  (func $setIY (param $v i32)
    (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of WH
  (func $getWH (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=27
  )

  ;; Sets the value of WH
  (func $setWH (param $v i32)
    (i32.store8 offset=27 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of WL
  (func $getWL (result i32)
    get_global $REG_AREA_INDEX i32.load8_u offset=26
  )

  ;; Sets the value of WL
  (func $setWL (param $v i32)
    (i32.store8 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the value of WZ
  (func $getWZ (result i32)
    get_global $REG_AREA_INDEX i32.load16_u offset=26
  )

  ;; Sets the value of WZ
  (func $setWZ (param $v i32)
    (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (get_local $v))
  )

  ;; Gets the specified 8-bit register
  ;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
  ;; returns: 8-bit register value
  (func $getReg8 (param $r i32) (result i32)
    (i32.eq (get_local $r) (i32.const 0x07))
    if
      get_global $A
      return
    end

    get_global $REG_AREA_INDEX

    ;; Convert 8-bit register index to offset
    get_global $REG8_TAB_OFFS
    (i32.and (get_local $r) (i32.const 0x07))
    i32.add
    i32.load8_u

    ;; Load 8-bit register from memory
    i32.add
    i32.load8_u
  )

  ;; Sets the specified 8-bit register
  ;; $r: Register index from 0-7: B, C, D, E, H, L, F, A
  (func $setReg8 (param $r i32) (param $v i32)
    (i32.eq (get_local $r) (i32.const 0x07))
    if
      get_local $v
      (set_global $A (i32.and (i32.const 0xff)))
      return
    end

    get_global $REG_AREA_INDEX

    ;; Convert 8-bit register index to offset
    get_global $REG8_TAB_OFFS
    (i32.and (get_local $r) (i32.const 0x07))
    i32.add
    i32.load8_u

    ;; Store register to memory
    i32.add
    get_local $v
    i32.store8
  )

  ;; Gets the specified 16-bit register
  ;; $r: Register index from 0-3: BC, DE, HL, SP
  ;; returns: 8-bit register value
  (func $getReg16 (param $r i32) (result i32)
    get_global $REG_AREA_INDEX
    
    ;; Convert 16-bit register index to offset
    get_global $REG16_TAB_OFFS
    (i32.and (get_local $r) (i32.const 0x03))
    i32.add
    i32.load8_u

    ;; Load register from memory
    i32.add
    i32.load16_u
  )

  ;; Sets the specified 16-bit register
  ;; $r: Register index from 0-3: BC, DE, HL, SP
  (func $setReg16 (param $r i32) (param $v i32)
    get_global $REG_AREA_INDEX
    
    ;; Convert 16-bit register index to offset
    get_global $REG16_TAB_OFFS
    (i32.and (get_local $r) (i32.const 0x03))
    i32.add
    i32.load8_u

    ;; Store register tomemory
    i32.add
    get_local $v
    i32.store16
  )

  ;; Sets the current index mode
  ;; $im: Index mode: 1: IX; other: IY
  (func $setIndexMode (param $im i32)
    get_local $im
    set_global $indexMode
  )

  ;; Gets the value of the index register according to the current indexing mode
  (func $getIndexReg (result i32)
    get_global $indexMode
    i32.const 1
    i32.eq
    if (result i32)
      get_global $REG_AREA_INDEX i32.load16_u offset=22 ;; IX
    else
      get_global $REG_AREA_INDEX i32.load16_u offset=24 ;; IY
    end
  )

  ;; Sets the value of the index register according to the current indexing mode
  ;; $v: 16-bit index register value
  (func $setIndexReg (param $v i32)
    get_global $indexMode
    i32.const 1
    i32.eq
    if
      (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IX
    else
      (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (get_local $v)) ;; IY
    end
  )

  ;; ==========================================================================
  ;; Z80 clock management

  ;; Increments the current frame tact with the specified value
  ;; $inc: Increment
  (func $incTacts (param $inc i32)
    (i32.add (get_global $tacts) (get_local $inc))
    set_global $tacts
  )

  ;; ==========================================================================
  ;; Z80 CPU life cycle methods

  ;; Turns on the CPU
  (func $turnOnCpu
    i32.const 0xff set_global $A
    i32.const 0xff set_global $F
    i32.const 0xffff set_global $PC
    i32.const 0xffff set_global $SP
    (i32.store16 offset=0 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=2 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=4 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=6 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=8 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=10 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=12 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=14 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=16 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=18 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=20 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=22 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=24 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    (i32.store16 offset=26 (get_global $REG_AREA_INDEX) (i32.const 0xffff))
    i32.const 0x0000 set_global $tacts
    i32.const 0x0000 set_global $stateFlags
    i32.const 0x0000 set_global $useGateArrayContention
    i32.const 0x0000 set_global $iff1
    i32.const 0x0000 set_global $iff2
    i32.const 0x0000 set_global $interruptMode
    i32.const 0x0000 set_global $isInterruptBlocked
    i32.const 0x0000 set_global $isInOpExecution
    i32.const 0x0000 set_global $prefixMode
    i32.const 0x0000 set_global $indexMode
    i32.const 0x0000 set_global $maskableInterruptModeEntered
    i32.const 0x0000 set_global $opCode
  )

  ;; Enables/disables extended instruction set
  ;; $f: True, enable; false, disable
  (func $enableExtendedInstructions (param $f i32)
    get_local $f
    set_global $allowExtendedSet
  )

  ;; ==========================================================================
  ;; Z80 Memory access

  ;; Default memory read operation
  ;; $addr: 16-bit memory address
  ;; returns: Memory contents
  (func $defaultRead (param $addr i32) (result i32)
    (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
    i32.load8_u
  )

  ;; Default memory write operation
  ;; $addr: 16-bit memory address
  ;; $v: 8-bit value to write
  (func $defaultWrite (param $addr i32) (param $v i32)
    (i32.add (get_local $addr) (get_global $SP_MEM_OFFS))
    get_local $v
    i32.store8
  )

  ;; Default I/O read operation
  ;; $addr: 16-bit memory address
  ;; returns: Memory contents
  (func $defaultIoRead (param $addr i32) (result i32)
    i32.const 0xff
  )

  ;; Default I/O write operation
  ;; $addr: 16-bit memory address
  ;; $v: 8-bit value to write
  (func $defaultIoWrite (param $addr i32) (param $v i32)
    (call $incTacts (i32.const 4))
  )

  ;; Reads the specified memory location of the current machine type
  ;; $addr: 16-bit memory address
  ;; returns: Memory contents
  (func $readMemory (param $addr i32) (result i32)
    get_local $addr
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    call_indirect (type $MemReadFunc)
    (call $incTacts (i32.const 3))
  )

  ;; Reads the specified memory location of the current machine type
  ;; $addr: 16-bit memory address
  ;; returns: Memory contents
  (func $readMemoryNc (param $addr i32) (result i32)
    get_local $addr
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 1)
    )
    call_indirect (type $MemReadFunc)
  )

  ;; Reads the specified memory location of the current machine type
  ;; but with no extra delay applies
  ;; $addr: 16-bit memory address
  (func $memoryDelay (param $addr i32)
    get_local $addr
    (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
    call_indirect (type $MemReadFunc)
    drop
  )

  ;; Writes the specified memory location of the current machine type
  ;; $addr: 16-bit memory address
  ;; $v: 8-bit value to write
  (func $writeMemory (param $addr i32) (param $v i32)
    get_local $addr
    get_local $v
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 2)
    )
    call_indirect (type $MemWriteFunc)
    (call $incTacts (i32.const 3))
  )

  ;; Reads the specified I/O port of the current machine type
  ;; $addr: 16-bit port address
  ;; returns: Port value
  (func $readPort (param $addr i32) (result i32)
    get_local $addr
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 3)
    )
    call_indirect (type $PortReadFunc)
    (call $incTacts (i32.const 4))
  )

  ;; Writes the specified port of the current machine type
  ;; $addr: 16-bit port address
  ;; $v: 8-bit value to write
  (func $writePort (param $addr i32) (param $v i32)
    get_local $addr
    get_local $v
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 4)
    )
    call_indirect (type $PortWriteFunc)
  )

  ;; Writes the specified TBBLUE index of the current machine type
  ;; $idx: 8-bit index register value
  (func $writeTbBlueIndex (param $idx i32)
    (call $incTacts (i32.const 3))

    ;; Allow to write the log
    get_local $idx
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 5)
    )
    call_indirect (type $TbBlueWriteFunc)
  )

  ;; Writes the specified TBBLUE value of the current machine type
  ;; $idx: 8-bit index register value
  (func $writeTbBlueValue (param $idx i32)
    (call $incTacts (i32.const 3))

    get_local $idx
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 6)
    )
    call_indirect (type $TbBlueWriteFunc)
  )

  ;; ==========================================================================
  ;; Execution cycle methods

  ;; Executes the CPU's processing cycle
  (func $executeCpuCycle
    ;; Is there any CPU signal raised?
    (i32.ne (get_global $stateFlags) (i32.const 0))
    if
      ;; Yes, process them
      (i32.ne (call $processCpuSignals) (i32.const 0))
      if return end
    end

    ;; It's time to process the next op code
    ;; Read it from PC and store in opCode
    call $readCodeMemory
    set_global $opCode

    ;; Execute a memory refresh
    call $refreshMemory

    ;; Test for no prefix
    (i32.eq (get_global $prefixMode) (i32.const 0))
    if
      ;; Execute the current operation
      i32.const 0 set_global $isInterruptBlocked
      call $processStandardOrIndexedOperations
      (i32.eq (get_global $isInterruptBlocked) (i32.const 0))
      if
        i32.const 0 set_global $indexMode
        i32.const 0 set_global $prefixMode
        i32.const 0 set_global $isInOpExecution
      end
      return
    end

    ;; Branch according to prefix modes
    ;; Test for extended mode
    (i32.eq (get_global $prefixMode) (i32.const 1))
    if
      i32.const 0 set_global $isInterruptBlocked
      call $processExtendedOperations
      i32.const 0 set_global $indexMode
      i32.const 0 set_global $prefixMode
      i32.const 0 set_global $isInOpExecution
      return
    end

    ;; Branch according to prefix modes
    ;; Test for bit mode
    (i32.eq (get_global $prefixMode) (i32.const 2))
    if
      i32.const 0 set_global $isInterruptBlocked
      call $processBitOperations
      i32.const 0 set_global $indexMode
      i32.const 0 set_global $prefixMode
      i32.const 0 set_global $isInOpExecution
      return
    end
  )

  ;; Process the CPU signals
  ;; Returns true, if the signal has been processed; otherwise, false
  (func $processCpuSignals (result i32)
    ;; Test for INT
    (i32.and (get_global $stateFlags) (i32.const 0x01 (; INT signal ;)))
    if
      ;; Test for unblocked interrupt
      (i32.eq (get_global $isInterruptBlocked) (i32.const 0))
      if
        (i32.ne (get_global $iff1) (i32.const 0))
        if
          call $executeInterrupt
          i32.const 1
          return
        end
      end
    end

    ;; Test for NMI
    (i32.and (get_global $stateFlags) (i32.const 0x02 (; NMI signal ;)))
    if
      call $executeNMI
      i32.const 1
      return
    end

    ;; Test for HLT
    (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;)))
    if
      (call $incTacts (i32.const 3))
      call $refreshMemory
      i32.const 1
      return
    end

    ;; Test for RST
    (i32.and (get_global $stateFlags) (i32.const 0x04 (; RST signal ;)))
    if
      call $resetCpu
      i32.const 1
      return
    end

    ;; No active signals to process
    i32.const 0
  )

  ;; Refreshes the memory
  (func $refreshMemory
    (local $r i32)
    ;; r := (r + 1) & 0x7f | (r & 0x80)
    call $getR
    tee_local $r
    i32.const 1
    i32.add
    i32.const 0x7f
    i32.and
    get_local $r
    i32.const 0x80
    i32.and
    i32.or
    call $setR
    (call $incTacts (i32.const 1))
  )

  ;; Resets the CPU
  (func $resetCpu
    i32.const 0 set_global $iff1
    i32.const 0 set_global $iff2
    i32.const 0 set_global $interruptMode
    i32.const 0 set_global $isInterruptBlocked
    i32.const 0 set_global $stateFlags
    i32.const 0 set_global $prefixMode
    i32.const 0 set_global $indexMode
    (call $setPC (i32.const 0))
    (call $setI (i32.const 0))
    (call $setR (i32.const 0))
    i32.const 0x0000 set_global $isInOpExecution
    i32.const 0x0000 set_global $tacts
  )

  ;; Executes the NMI request
  (func $executeNMI
     ;; Test for HLT
    (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;) ))
    if
      (set_global $PC 
        (i32.and (i32.add (call $getPC) (i32.const 1)) (i32.const 0xffff)) 
      )
      (i32.and (get_global $stateFlags) (i32.const 0xf7 (; ~HLT mask ;) ))
      set_global $stateFlags
    end
    get_global $iff1 set_global $iff2
    i32.const 0 set_global $iff1

    ;; Push PC
    call $getPC
    call $pushValue

    ;; Set NMI routione address
    (call $setPC (i32.const 0x0066))
  )

  ;; Executes the NMI request
  (func $executeInterrupt
    (local $addr i32)
    ;; Test for HLT
    (i32.and (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;) ))
    if
      (set_global $PC 
        (i32.and (i32.add (call $getPC) (i32.const 1)) (i32.const 0xffff)) 
      )
      (i32.and (get_global $stateFlags) (i32.const 0xf7 (; ~HLT mask ;) ))
      set_global $stateFlags
    end

    i32.const 0 set_global $iff1
    i32.const 0 set_global $iff2
    
    ;; Push PC
    call $getPC
    call $pushValue
    
    ;; Test interrupt mode 0
    (i32.eq (get_global $interruptMode) (i32.const 2))
    if
      ;; Interrupt mode 2
      (call $incTacts (i32.const 2))
      
      ;; Let's assume, the device retrieves 0xff (the least significant bit is ignored)
      ;; addr = i << 8 | 0xfe;
      call $getI
      i32.const 8
      i32.shl
      i32.const 0xfe
      i32.or
      tee_local $addr
      (call $incTacts (i32.const 5))
      call $readMemory
      (i32.add (get_local $addr) (i32.const 1))
      call $readMemory
      i32.const 8
      i32.shl
      i32.or
      call $setWZ
      (call $incTacts (i32.const 6))
    else
      ;; Interrupt mode 0 or 1
      (call $setWZ (i32.const 0x0038))
      (call $incTacts (i32.const 5))
    end

    ;; pc := wz
    call $getWZ
    call $setPC
  )

  ;; Processes standard or indexed operations
  (func $processStandardOrIndexedOperations
    get_global $INDEXED_JT
    get_global $STANDARD_JT
    get_global $indexMode
    select
    get_global $opCode
    i32.add
    call_indirect (type $OpFunc)
  )

  ;; Processes bit operations
  (func $processBitOperations
    get_global $indexMode
    if
      ;; indexed bit operations
      ;; WZ := IX + opCode
      call $getIndexReg
      get_global $opCode
      i32.const 24
      i32.shl
      i32.const 24
      i32.shr_s
      i32.add
      call $setWZ

      ;; Adjust tacts
      (i32.eq (get_global $useGateArrayContention) (i32.const 0))
      if
        call $getPC
        call $memoryDelay
      end
      (call $incTacts (i32.const 1))
      call $getWZ ;; The address to use with the indexed bit operation

      ;; Get operation function
      get_global $INDEXED_BIT_JT
      call $readCodeMemory
      set_global $opCode
      get_global $opCode
      i32.add
      call_indirect (type $IndexedBitFunc)
    else
      ;; Normal bit operations
      (i32.add (get_global $BIT_JT) (get_global $opCode))
      call_indirect (type $OpFunc)
    end
  )

  ;; Processes extended operations
  (func $processExtendedOperations
    get_global $EXTENDED_JT
    get_global $opCode
    i32.add
    call_indirect (type $OpFunc)
  )

  ;; ==========================================================================
  ;; Instruction helpers

  ;; Decrements the value of SP
  (func $decSP
    (set_global $SP 
      (i32.and (i32.sub (call $getSP) (i32.const 1)) (i32.const 0xffff)) 
    )
  )

  ;; Pushes the value to the stack
  (func $pushValue (param $v i32)
    (local $sp i32)
    call $decSP
    (call $incTacts (i32.const 1))
    call $getSP
    (i32.shr_u (get_local $v) (i32.const 8))
    call $writeMemory
    call $decSP
    call $getSP
    get_local $v
    call $writeMemory
  )

  ;; Pops a value to the stack
  (func $popValue (result i32)
    call $getSP
    call $readMemory
    (set_global $SP 
      (i32.and (i32.add (call $getSP) (i32.const 1)) (i32.const 0xffff)) 
    )
    call $getSP
    call $readMemory
    (set_global $SP 
      (i32.and (i32.add (call $getSP) (i32.const 1)) (i32.const 0xffff)) 
    )
    i32.const 8
    i32.shl
    i32.or
  )

  ;; Reads the memory location at PC
  (func $readCodeMemory (result i32)
    get_global $PC
    call $readMemory ;; we'll return this value
    (set_global $PC 
      (i32.and (i32.add (call $getPC) (i32.const 1)) (i32.const 0xffff)) 
    )
  )

  ;; Add two 16-bit values following the add hl,NN logic
  (func $AluAddHL (param $regHL i32) (param $other i32) (result i32)
    (local $f i32)
    (local $res i32)

    ;; Keep S, Z, and PV from F
    get_global $F
    i32.const 0xc4 ;; Mask for preserving S, Z, PV
    i32.and
    set_local $f

    ;; Calc the value of H flag
    (i32.add
      (i32.and (get_local $regHL) (i32.const 0x0fff))
      (i32.and (get_local $other) (i32.const 0x0fff))
    )
    i32.const 0x08
    i32.shr_u
    i32.const 0x10 ;; Mask for H flag
    i32.and        ;; Now, we have H flag on top

    ;; Combine H flag with others
    get_local $f
    i32.or
    set_local $f

    ;; Calculate result
    (i32.add (get_local $regHL) (get_local $other))
    tee_local $res

    ;; Test for C flag
    i32.const 0x1_0000
    i32.ge_u
    if
      ;; Set C
      (i32.or (get_local $f) (i32.const 0x01))
      set_local $f
    end

    ;; Calculate R3 and R5 flags
    (i32.shr_u (get_local $res) (i32.const 8))
    i32.const 0x28 ;; Mask for R3, R5
    i32.and

    ;; Combine them with F
    get_local $f
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))

    ;; Fetch the result
    get_local $res
  )

  ;; Add two 16-bit values following the sbc hl,NN logic
  (func $AluAdcHL (param $other i32)
    (local $res i32)
    (local $f i32)
    (local $signed i32)

    ;; Calculate result
    (i32.add (call $getHL) (get_local $other))
    tee_local $res
    (i32.and (get_global $F) (i32.const 0x01))
    tee_local $f
    i32.add
    tee_local $res

    ;; Calculate Z
    i32.const 0xffff
    i32.and
    if (result i32)  ;; (Z)
      i32.const 0x00
    else
      i32.const 0x40
    end

    ;; Calculate H
    (i32.and (call $getHL) (i32.const 0x0fff))
    (i32.and (get_local $other) (i32.const 0x0fff))
    i32.add
    get_local $f
    i32.add
    i32.const 8
    i32.shr_u
    i32.const 0x10 ;; Mask for H
    i32.and ;; (Z, H)

    ;; Calculate C
    i32.const 0x01
    i32.const 0x00
    (i32.and (get_local $res) (i32.const 0x1_0000))
    select ;; (Z, H, C)

    ;; Calculate PV
    (i32.shr_s 
      (i32.shl (call $getHL) (i32.const 16))
      (i32.const 16)
    )
    (i32.shr_s 
      (i32.shl (get_local $other) (i32.const 16))
      (i32.const 16)
    )
    i32.add
    get_local $f
    i32.add
    tee_local $signed
    i32.const -0x8000
    i32.lt_s
    get_local $signed
    i32.const 0x8000
    i32.ge_s
    i32.or
    if (result i32) ;; (Z, H, C, PV)
      i32.const 0x04
    else
      i32.const 0x00
    end

    ;; Store the result
    get_local $res
    call $setHL

    ;; Calculate S, R5, R3
    call $getH
    i32.const 0xA8 ;; Mask for S|R5|R3
    i32.and

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Subtract two 16-bit values following the sbc hl,NN logic
  (func $AluSbcHL (param $other i32)
    (local $res i32)
    (local $f i32)
    (local $signed i32)

    ;; Calculate result
    (i32.sub (call $getHL) (get_local $other))
    tee_local $res
    (i32.and (get_global $F) (i32.const 0x01))
    tee_local $f
    i32.sub
    tee_local $res

    ;; Calculate Z
    i32.const 0xffff
    i32.and
    if (result i32)  ;; (Z)
      i32.const 0x00
    else
      i32.const 0x40
    end

    ;; Set N
    i32.const 0x02 ;; (Z, N)

    ;; Calculate H
    (i32.and (call $getHL) (i32.const 0x0fff))
    (i32.and (get_local $other) (i32.const 0x0fff))
    i32.sub
    get_local $f
    i32.sub
    i32.const 8
    i32.shr_u
    i32.const 0x10 ;; Mask for H
    i32.and ;; (Z, N, H)

    ;; Calculate C
    i32.const 0x01
    i32.const 0x00
    (i32.and (get_local $res) (i32.const 0x1_0000))
    select ;; (Z, N, H, C)

    ;; Calculate PV
    (i32.shr_s 
      (i32.shl (call $getHL) (i32.const 16))
      (i32.const 16)
    )
    (i32.shr_s 
      (i32.shl (get_local $other) (i32.const 16))
      (i32.const 16)
    )
    i32.sub
    get_local $f
    i32.sub
    tee_local $signed
    i32.const -0x8000
    i32.lt_s
    get_local $signed
    i32.const 0x8000
    i32.ge_s
    i32.or
    if (result i32) ;; (Z, N, H, C, PV)
      i32.const 0x04
    else
      i32.const 0x00
    end

    ;; Store the result
    get_local $res
    call $setHL

    ;; Calculate S, R5, R3
    call $getH
    i32.const 0xA8 ;; Mask for S|R5|R3
    i32.and

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Carries out a relative jump
  ;; $e: 8-bit distance value
  (func $relativeJump (param $e i32)
    call $AdjustIXTact

    ;; Convert the 8-bit distance to i32
    (i32.shr_s 
      (i32.shl (get_local $e) (i32.const 24))
      (i32.const 24)
    )

    ;; Calculate the destination address
    call $getPC
    i32.add
    call $setPC

    ;; Copy to WZ
    call $getPC
    call $setWZ
  )

  ;; Adjust tacts for IX-indirect addressing
  (func $AdjustIXTact
    call $getPC
    call $Adjust5Tacts
  )

  ;; Adjust tacts for IX-indirect addressing
  (func $Adjust5Tacts (param $addr i32)
    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 5))
    else
      (call $memoryDelay (get_local $addr))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $addr))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $addr))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $addr))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $addr))
      (call $incTacts (i32.const 1))
    end
  )

  ;; Gets the index address for an operation
  (func $getIndexedAddress (result i32)
    call $getIndexReg
    (i32.shr_s 
      (i32.shl (call $readCodeMemory) (i32.const 24))
      (i32.const 24)
    )
    i32.add
  )

  ;; Executes ALU addition; sets A and F
  ;; $arg: other argument
  ;; $c: Value of the C flag
  (func $AluAdd (param $arg i32) (param $c i32)
    (local $a i32)
    (local $res i32)
    (local $pv i32)
    ;; Add values (+carry) and store in A
    get_global $A
    tee_local $a
    get_local $arg
    i32.add
    get_local $c
    i32.add
    tee_local $res
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Put Z on stack
    i32.const 0x00 ;; NZ
    i32.const 0x40 ;; Z
    (i32.and (get_local $res) (i32.const 0xff))
    select         ;; Z

    ;; Get S, R5, and R3 from result
    get_local $res
    i32.const 0xa8
    i32.and        ;; Z, S|R5|R3

    ;; Get C flag
    get_local $res
    i32.const 0x100
    i32.and
    i32.const 8
    i32.shr_u      ;; Z, S|R5|R3, C

    ;; Calculate H flag
    i32.const 0x10
    i32.const 0x00
    (i32.and (get_local $a) (i32.const 0x0f))
    (i32.and (get_local $arg) (i32.const 0x0f))
    i32.add
    get_local $c
    (i32.and (i32.add) (i32.const 0x10))
    select        ;; Z, S|R5|R3, C, H

    ;; <i32>$arg + <i32>$a + C
    (i32.shr_s 
      (i32.shl (get_local $a) (i32.const 24))
      (i32.const 24)
    )
    tee_local $pv
    (i32.shr_s 
      (i32.shl (get_local $arg) (i32.const 24))
      (i32.const 24)
    )
    i32.add
    get_local $c
    i32.add
    tee_local $pv

    ;; Calculate PV flag
    i32.const 0x80
    i32.ge_s
    if (result i32)
      i32.const 0x04
    else
      get_local $pv
      i32.const -0x81
      i32.le_s
      if (result i32)
        i32.const 0x04
      else
        i32.const 0x00
      end
    end

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Executes ALU subtraction; sets A and F
  ;; $arg: other argument
  ;; $c: Value of the C flag
  (func $AluSub (param $arg i32) (param $c i32)
    (local $a i32)
    (local $res i32)
    (local $pv i32)
    ;; Subtract values (-carry) and store in A
    get_global $A
    tee_local $a
    get_local $arg
    i32.sub
    get_local $c
    i32.sub
    tee_local $res
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Put Z on stack
    i32.const 0x00 ;; NZ
    i32.const 0x40 ;; Z
    (i32.and (get_local $res) (i32.const 0xff))
    select         ;; Z

    ;; Get S, R5, and R3 from result
    get_local $res
    i32.const 0xa8
    i32.and        ;; Z, S|R5|R3

    ;; Get C flag
    get_local $res
    i32.const 0x100
    i32.and
    i32.const 8
    i32.shr_u      ;; Z, S|R5|R3, C

    ;; Calculate H flag
    i32.const 0x10
    i32.const 0x00
    (i32.and (get_local $a) (i32.const 0x0f))
    (i32.and (get_local $arg) (i32.const 0x0f))
    i32.sub
    get_local $c
    i32.sub
    i32.const 0x10
    i32.and
    select        ;; Z, S|R5|R3, C, H

    ;; <i32>$a - <i32>$arg - C
    (i32.shr_s 
      (i32.shl (get_local $a) (i32.const 24))
      (i32.const 24)
    )
    tee_local $pv
    (i32.shr_s 
      (i32.shl (get_local $arg) (i32.const 24))
      (i32.const 24)
    )
    i32.sub
    get_local $c
    i32.sub
    tee_local $pv

    ;; Calculate PV flag
    i32.const 0x80
    i32.ge_s
    if (result i32)
      i32.const 0x04
    else
      get_local $pv
      i32.const -0x81
      i32.le_s
      if (result i32)
        i32.const 0x04
      else
        i32.const 0x00
      end
    end

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or

    ;; Set N
    i32.const 0x02 ;; N flag mask
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Executes ALU AND operations; sets A and F
  ;; $arg: other argument
  (func $AluAnd (param $arg i32)
    (i32.and (get_global $A) (get_local $arg))
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_global $A))
    i32.load8_u

    ;; Set H
    i32.const 0x10 ;; H flag mask
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Executes ALU XOR operation; sets A and F
  ;; $arg: other argument
  (func $AluXor (param $arg i32)
    (i32.xor (get_global $A) (get_local $arg))
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_global $A))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Executes ALU OOR operation; sets A and F
  ;; $arg: other argument
  (func $AluOr (param $arg i32)
    (i32.or (get_global $A) (get_local $arg))
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_global $A))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Executes ALU 8-add compare; sets F
  ;; $arg: other argument
  (func $AluCp (param $arg i32)
    (local $res i32)
    (local $signed i32)

    ;; Subtract values
    get_global $A
    get_local $arg
    i32.sub
    set_local $res

    ;; Signed substract
    (i32.shl (get_global $A) (i32.const 24))
    (i32.shr_s (i32.const 24))
    (i32.shl (get_local $arg) (i32.const 24))
    (i32.shr_s (i32.const 24))
    i32.sub
    set_local $signed

    ;; Calculate N flag (set)
    i32.const 0x02 ;; [N]

    ;; Calculate H flag
    (i32.and (get_global $A) (i32.const 0x0f))
    (i32.and (get_local $arg) (i32.const 0x0f))
    i32.sub
    (i32.and (i32.const 0x10)) ;; [N, H] 

    ;; Keep S, R3, and R5 from result
    (i32.and (get_local $res) (i32.const 0xa8)) ;; [N, H, S|R3|R5]

    ;; Calculate Z flag
    i32.const 0x00
    i32.const 0x40
    (i32.and (get_local $res) (i32.const 0xff))
    select ;; [N, H, S|R3|R5, Z]

    ;; Calculate C
    i32.const 0x01
    i32.const 0x00
    (i32.and (get_local $res) (i32.const 0x10000))
    select ;; [N, H, S|R3|R5, Z, C]

    ;; Calculate PV
    (i32.ge_s (get_local $signed) (i32.const 0x80))
    if (result i32)
      i32.const 0x04
    else
      (i32.le_s (get_local $signed) (i32.const -0x81))
      if (result i32)
        i32.const 0x04
      else
        i32.const 0x00
      end
    end

    ;; Merge flags and store them
    i32.or
    i32.or
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; Tests the Z condition
  (func $testZ (result i32)
    (i32.ne 
      (i32.and (get_global $F) (i32.const 0x40))
      (i32.const 0)
    )
  )

  ;; Tests the NZ condition
  (func $testNZ (result i32)
    (i32.eq
      (i32.and (get_global $F) (i32.const 0x40))
      (i32.const 0)
    )
  )

  ;; Tests the C condition
  (func $testC (result i32)
    (i32.ne
      (i32.and (get_global $F) (i32.const 0x01))
      (i32.const 0)
    )
  )

  ;; Tests the NC condition
  (func $testNC (result i32)
    (i32.eq
      (i32.and (get_global $F) (i32.const 0x01))
      (i32.const 0)
    )
  )

  ;; Tests the PE condition
  (func $testPE (result i32)
    (i32.ne
      (i32.and (get_global $F) (i32.const 0x04))
      (i32.const 0)
    )
  )

  ;; Tests the PO condition
  (func $testPO (result i32)
    (i32.eq
      (i32.and (get_global $F) (i32.const 0x04))
      (i32.const 0)
    )
  )

  ;; Tests the M condition
  (func $testM (result i32)
    (i32.ne
      (i32.and (get_global $F) (i32.const 0x80))
      (i32.const 0)
    )
  )

  ;; Tests the P condition
  (func $testP (result i32)
    (i32.eq
      (i32.and (get_global $F) (i32.const 0x80))
      (i32.const 0)
    )
  )

  ;; Read address to WZ
  (func $readAddrToWZ
    call $readCodeMemory
    call $readCodeMemory
    i32.const 8
    i32.shl
    i32.or
    call $setWZ
  )

  ;; Read address from code
  (func $readAddrFromCode (result i32)
    call $readCodeMemory
    call $readCodeMemory
    i32.const 8
    i32.shl
    i32.or
  )


  ;; ==========================================================================
  ;; Standard operations

  ;; ld bc,NN (0x01)
  (func $LdBCNN
    (call $setBC (call $readAddrFromCode))
  )

  ;; ld (bc),a (0x02)
  (func $LdBCiA
    (call $writeMemory (call $getBC) (get_global $A))
  )

  ;; inc bc (0x03)
  (func $IncBC
    (call $setBC (i32.add (call $getBC) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; Adjust INC flags
  (func $adjustIncFlags (param $v i32)
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01)) ;; C flag mask
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; inc b (0x04)
  (func $IncB
    (local $v i32)
    call $getB
    (i32.add (tee_local $v) (i32.const 1))
    call $setB
    (call $adjustIncFlags (get_local $v))
  )

  ;; Adjust DEC flags
  (func $adjustDecFlags (param $v i32)
    (i32.add (get_global $DEC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01)) ;; C flag mask
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; dec b (0x05)
  (func $DecB
    (local $v i32)
    call $getB
    (i32.sub (tee_local $v) (i32.const 1))
    call $setB
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld b,N (0x06)
  (func $LdBN
    (call $setB (call $readCodeMemory))
  )

  ;; ld Q,N (0x06, 0x0e, 0x16, 0x1e, 0x26, 0x2e, 0x36, 0x3e)
  (func $LdQN
    (local $q i32)

    ;; Get 8-bit reg index
    (i32.shr_u 
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )

    ;; Fetch data and store it
    call $readCodeMemory
    call $setReg8
  )

  ;; rlca (0x07)
  (func $Rlca
    (local $res i32)
    (local $newC i32)
    (i32.shl (get_global $A) (i32.const 1))
    
    (i32.ge_u (tee_local $res) (i32.const 0x100))
    if (result i32)
      i32.const 0x01
    else
      i32.const 0x00
    end
    tee_local $newC
    get_local $res
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))
    get_global $F
    i32.const 0xc4 ;; S, Z, PV flags mask
    i32.and
    get_local $newC
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ex af,af' (0x08)
  (func $ExAf
    (local $tmp i32)
    call $getAF
    set_local $tmp
    get_global $REG_AREA_INDEX
    i32.load16_u offset=8
    call $setAF
    get_global $REG_AREA_INDEX
    get_local $tmp
    i32.store16 offset=8
  )

  ;; add hl,bc (0x09)
  (func $AddHLBC
    ;; Calculate WZ
    (i32.add (call $getHL) (i32.const 1))
    call $setWZ

    ;; Calc the new HL value
    (call $AluAddHL (call $getHL) (call $getBC))
    call $setHL
    (call $incTacts (i32.const 7))
  )

  ;; ld a,(bc) (0x0a)
  (func $LdABCi
    ;; Calculate WZ
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ

    ;; Read A from (BC)
    call $getBC
    call $readMemory
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; dec bc (0x0b)
  (func $DecBC
    (call $setBC (i32.sub (call $getBC) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc c (0x0c)
  (func $IncC
    (local $v i32)
    call $getC
    (i32.add (tee_local $v) (i32.const 1))
    call $setC
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec c (0x0d)
  (func $DecC
    (local $v i32)
    call $getC
    (i32.sub (tee_local $v) (i32.const 1))
    call $setC
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld c,N (0x0e)
  (func $LdCN
    (call $setC (call $readCodeMemory))
  )

  ;; rrca (0x0f)
  (func $Rrca
    (local $newC i32)
    ;; Calc new C flag
    (i32.and (get_global $A) (i32.const 1))
    set_local $newC

    ;; Shift value
    (i32.shr_u (get_global $A) (i32.const 1))

    ;; Combine with C flag
    get_local $newC
    i32.const 7
    i32.shl
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Calc the new F
    get_global $F
    i32.const 0xC4 ;; Keep S, Z, PV
    i32.and
    get_local $newC
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; djnz (0x10)
  (func $Djnz
    (local $e i32)
    (call $incTacts (i32.const 1))
    call $readCodeMemory
    set_local $e

    ;; Decrement B
    (i32.sub (call $getB) (i32.const 1))
    call $setB

    ;; Reached 0?
    (i32.eq (call $getB) (i32.const 0))
    if return end

    ;; Jump
    (call $relativeJump (get_local $e))
  )

  ;; ld de,NN (0x11)
  (func $LdDENN
    (call $setDE (call $readAddrFromCode))
  )

  ;; ld (de),a (0x12)
  (func $LdDEiA
    (call $writeMemory (call $getDE) (get_global $A))
  )

  ;; inc de (0x13)
  (func $IncDE
    (call $setDE (i32.add (call $getDE) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc d (0x14)
  (func $IncD
    (local $v i32)
    call $getD
    (i32.add (tee_local $v) (i32.const 1))
    call $setD
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec d (0x15)
  (func $DecD
    (local $v i32)
    call $getD
    (i32.sub (tee_local $v) (i32.const 1))
    call $setD
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld d,N (0x16)
  (func $LdDN
    (call $setD (call $readCodeMemory))
  )

  ;; rla (0x17)
  (func $Rla
    (local $res i32)
    (local $newC i32)
    ;; Shift left
    (i32.shl (get_global $A) (i32.const 1))
    tee_local $res

    ;; Calculate new C flag
    i32.const 8
    i32.shr_u
    i32.const 0x01 ;; C Flag mask
    i32.and
    set_local $newC

    ;; Adjust with current C flag
    get_global $F
    i32.const 0x01 ;; C Flag mask
    i32.and
    get_local $res
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Calculate new C Flag
    get_global $F
    i32.const 0xc4 ;; Keep S, Z, PV
    i32.and
    get_local $newC
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; jr NN (0x18)
  (func $JrE
    ;; Calculate new address
    (i32.shr_s 
      (i32.shl (call $readCodeMemory) (i32.const 24))
      (i32.const 24)
    )
    call $getPC
    i32.add
    call $setPC

    ;; Set WZ
    call $getPC
    call $setWZ

    (call $incTacts (i32.const 5))
  )

  ;; add hl,de (0x19)
  (func $AddHLDE
    ;; Calculate WZ
    (i32.add (call $getHL) (i32.const 1))
    call $setWZ

    ;; Calc the new HL value
    (call $AluAddHL (call $getHL) (call $getDE))
    call $setHL
    (call $incTacts (i32.const 7))
  )

  ;; ld a,(de) (0x1a)
  (func $LdADEi
    ;; Calculate WZ
    (i32.add (call $getDE) (i32.const 1))
    call $setWZ

    ;; Read A from (DE)
    call $getDE
    call $readMemory
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; dec de (0x1b)
  (func $DecDE
    (call $setDE (i32.sub (call $getDE) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc e (0x1c)
  (func $IncE
    (local $v i32)
    call $getE
    (i32.add (tee_local $v) (i32.const 1))
    call $setE
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec e (0x1d)
  (func $DecE
    (local $v i32)
    call $getE
    (i32.sub (tee_local $v) (i32.const 1))
    call $setE
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld e,N (0x1e)
  (func $LdEN
    (call $setE (call $readCodeMemory))
  )

  ;; rra (0x1f)
  (func $Rra
    (local $newC i32)

    ;; Calculate the new C flag
    (i32.and (get_global $A) (i32.const 1))
    set_local $newC

    ;; Shift right
    (i32.shr_u (get_global $A) (i32.const 1))

    ;; Adjust with current C flag
    get_global $F
    i32.const 0x01 ;; C Flag mask
    i32.and
    i32.const 7
    i32.shl
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Calculate new C Flag
    get_global $F
    i32.const 0xc4 ;; Keep S, Z, PV
    i32.and
    get_local $newC
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; jr nz,NN (0x20)
  (func $JrNz
    (local $e i32)
    call $readCodeMemory
    set_local $e
    call $testZ
    if return end

    ;; Jump
    get_local $e
    call $relativeJump
  )

  ;; ld hl,NN (0x21)
  (func $LdHLNN
    (call $setHL (call $readAddrFromCode))
  )

  ;; ld (NN),hl
  (func $LdNNiHL
    (local $addr i32)
    ;; Obtain the address to store HL
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Store HL
    get_local $addr
    call $getL
    call $writeMemory
    call $getWZ
    call $getH
    call $writeMemory
  )

  ;; inc hl (0x23)
  (func $IncHL
    (call $setHL (i32.add (call $getHL) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc h (0x24)
  (func $IncH
    (local $v i32)
    call $getH
    (i32.add (tee_local $v) (i32.const 1))
    call $setH
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec h (0x25)
  (func $DecH
    (local $v i32)
    call $getH
    (i32.sub (tee_local $v) (i32.const 1))
    call $setH
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld h,N (0x26)
  (func $LdHN
    (call $setH (call $readCodeMemory))
  )

  ;; daa (0x27)
  (func $Daa
    (local $a i32)
    (local $lNibble i32)
    (local $hNibble i32)
    (local $diff i32)
    (local $cAfter i32)
    (local $hFlag i32)
    (local $nFlag i32)
    (local $hAfter i32)
    (local $pvAfter i32)

    ;; Get A and store nibbles
    get_global $A
    tee_local $a
    i32.const 4
    i32.shr_u
    set_local $hNibble
    get_local $a
    i32.const 0x0f
    i32.and
    set_local $lNibble

    ;; Calculate H flag
    get_global $F
    i32.const 0x10 ;; Mask for H flag
    i32.and
    set_local $hFlag

    ;; Calculate N flag
    get_global $F
    i32.const 0x02 ;; Mask for N flag
    i32.and
    set_local $nFlag

    ;; Set default calculation values
    i32.const 0x00
    set_local $diff
    i32.const 0x00
    set_local $cAfter

    ;; Calculate the diff value
    (i32.eq 
      (i32.and (get_global $F) (i32.const 0x01))
      (i32.const 0)
    )
    if
      ;; C flag is 0
      ;; Test if hNibble is 0..9 and lNibble is 0..9
      (i32.and
        (i32.le_u (get_local $hNibble) (i32.const 9))
        (i32.le_u (get_local $lNibble) (i32.const 9))
      )
      if
        i32.const 0x06
        i32.const 0x00
        get_local $hFlag
        select
        set_local $diff
      else
        ;; Test if hNibble is 0..8 and lNibble is a..f
        (i32.le_u (get_local $hNibble) (i32.const 8))
        (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
        (i32.le_u (get_local $lNibble) (i32.const 0x0f))
        i32.and
        i32.and
        if
          i32.const 6
          set_local $diff
        else
          ;; Test if hNibble is a..f and lNibble is 0..9 and H flag not set
          (i32.ge_u (get_local $hNibble) (i32.const 0x0a))
          (i32.le_u (get_local $hNibble) (i32.const 0x0f))
          (i32.le_u (get_local $lNibble) (i32.const 0x09))
          (i32.eq (get_local $hFlag) (i32.const 0x00))
          i32.and
          i32.and
          i32.and
          if
            i32.const 0x60
            set_local $diff
            i32.const 1
            set_local $cAfter
          else
            ;; Test if hNibble is 9..f and lNibble is a..f
            (i32.ge_u (get_local $hNibble) (i32.const 0x09))
            (i32.le_u (get_local $hNibble) (i32.const 0x0f))
            (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
            (i32.le_u (get_local $lNibble) (i32.const 0x0f))
            i32.and
            i32.and
            i32.and
            if
              i32.const 0x66
              set_local $diff
              i32.const 1
              set_local $cAfter
            else
              ;; Test if hNibble is a..f and lNibble is 0..9
              (i32.ge_u (get_local $hNibble) (i32.const 0x0a))
              (i32.le_u (get_local $hNibble) (i32.const 0x0f))
              (i32.le_u (get_local $lNibble) (i32.const 0x09))
              i32.and
              i32.and
              if
                ;; Test if H flag is set
                get_local $hFlag
                i32.const 0
                i32.ne
                if
                  i32.const 0x66
                  set_local $diff
                end
                i32.const 1
                set_local $cAfter
              end
            end
          end
        end
      end
    else
      ;; C flag is 1
      i32.const 1
      set_local $cAfter

      ;; Test if lNibble is 0..9
        (i32.le_u (get_local $lNibble) (i32.const 0x09))
      if
        i32.const 0x66
        i32.const 0x60
        get_local $hFlag
        select
        set_local $diff
      else
        ;; Test if lNibble is a..f
        (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
        (i32.le_u (get_local $lNibble) (i32.const 0x0f))
        i32.and
        if
          i32.const 0x66
          set_local $diff
        end
      end
    end

    ;; Calculate the new value of H flag
    i32.const 0
    set_local $hAfter

    ;; Test if lNibble is a..f and N is reset
    (i32.ge_u (get_local $lNibble) (i32.const 0x0a))
    (i32.le_u (get_local $lNibble) (i32.const 0x0f))
    get_local $nFlag
    i32.const 1
    i32.shr_u   ;; Conver N to 0 or 1
    i32.const 1
    i32.xor
    i32.and
    i32.and
    if
      i32.const 0x10
      set_local $hAfter
    else
      ;; Test if lNibble is 0..5 and N is set and H is set
      (i32.le_u (get_local $lNibble) (i32.const 0x05))
      get_local $nFlag
      i32.const 1
      i32.shr_u   ;; Conver N to 0 or 1
      get_local $hFlag
      i32.const 4
      i32.shr_u   ;; Conver H to 0 or 1
      i32.and
      i32.and
      if
        i32.const 0x10
        set_local $hAfter
      end
    end

    ;; Calculate the new value of A
    get_local $a
    get_local $diff
    i32.sub
    get_global $A
    get_local $diff
    i32.add
    get_local $nFlag
    select
    tee_local $a
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Calculate parity
    get_local $a
    i32.const 0xff
    i32.and
    i32.popcnt
    i32.const 2
    i32.rem_u
    i32.const 2
    i32.shl
    i32.const 0x04 ;; PV flag mask
    i32.xor
    set_local $pvAfter

    ;; Calculate F value
    ;; Z flag
    i32.const 0x00
    i32.const 0x40
    get_global $A
    tee_local $a
    select   ;; Z is on top
    ;; S, R3, R5 flag
    get_local $a
    i32.const 0xA8 ;; Mask for S, R3, R5
    i32.and  ;; Z, S|R3|R5
    i32.or   ;; Z|S|R3|R5
    get_local $pvAfter
    i32.or
    get_local $nFlag
    i32.or
    get_local $hAfter
    i32.or
    get_local $cAfter
    i32.or

    ;; Done
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; jr z,NN (0x28)
  (func $JrZ
    (local $e i32)
    call $readCodeMemory
    set_local $e
    call $testNZ
    if return end

    ;; Jump
    get_local $e
    call $relativeJump
  )

  ;; add hl,hl (0x29)
  (func $AddHLHL
    ;; Calculate WZ
    (i32.add (call $getHL) (i32.const 1))
    call $setWZ

    ;; Calc the new HL value
    (call $AluAddHL (call $getHL) (call $getHL))
    call $setHL
    (call $incTacts (i32.const 7))
  )

  ;; ld hl,(NN) (0x2a)
  (func $LdHLNNi
    (local $addr i32)
    ;; Read the address
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Read HL from memory
    get_local $addr
    call $readMemory
    call $setL
    call $getWZ
    call $readMemory
    call $setH
  )

  ;; dec hl (0x2b)
  (func $DecHL
    (call $setHL (i32.sub (call $getHL) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc l (0x2c)
  (func $IncL
    (local $v i32)
    call $getL
    (i32.add (tee_local $v) (i32.const 1))
    call $setL
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec l (0x2d)
  (func $DecL
    (local $v i32)
    call $getL
    (i32.sub (tee_local $v) (i32.const 1))
    call $setL
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld l,N (0x2e)
  (func $LdLN
    (call $setL (call $readCodeMemory))
  )

  ;; cpl (0x2f)
  (func $Cpl
    ;; New value of A
    (i32.xor (get_global $A) (i32.const 0xff))
    (set_global $A (i32.and (i32.const 0xff)))

    ;; New F
    get_global $F
    i32.const 0xed ;; Keep S, Z, R3, R3, PV, C
    i32.and
    i32.const 0x12 ;; Set H and N
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; jr nc,NN (0x30)
  (func $JrNc
    (local $e i32)
    call $readCodeMemory
    set_local $e
    call $testC
    if return end

    ;; Jump
    get_local $e
    call $relativeJump
  )

  ;; ld sp,NN (0x31)
  (func $LdSPNN
    (call $setSP (call $readAddrFromCode))
  )

  ;; ld (NN),a (0x32)
  (func $LdNNiA
    (local $addr i32)

    ;; Read the address
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Store A
    get_local $addr
    get_global $A
    call $writeMemory
    get_global $A
    call $setWH
  )

  ;; inc sp (0x33)
  (func $IncSP
    (set_global $SP 
      (i32.and (i32.add (call $getSP) (i32.const 1)) (i32.const 0xffff)) 
    )
    (call $incTacts (i32.const 2))
  )

  ;; inc (hl) (0x34)
  (func $IncHLi
    (local $v i32)

    ;; Get the value from the memory
    call $getHL
    call $readMemory
    set_local $v

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getHL
      call $memoryDelay
    end
    (call $incTacts (i32.const 1))

    ;; Increment value
    call $getHL
    (i32.add (get_local $v) (i32.const 1))
    call $writeMemory

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u

    get_global $F
    i32.const 0x01 ;; C flag mask
    i32.and
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
)

  ;; dec (hl) (0x35)
  (func $DecHLi
    (local $v i32)

    ;; Get the value from the memory
    call $getHL
    call $readMemory
    set_local $v

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getHL
      call $memoryDelay
    end
    (call $incTacts (i32.const 1))

    ;; Increment value
    call $getHL
    (i32.sub (get_local $v) (i32.const 1))
    call $writeMemory

    ;; Adjust flags
    (i32.add (get_global $DEC_FLAGS) (get_local $v))
    i32.load8_u

    get_global $F
    i32.const 0x01 ;; C flag mask
    i32.and
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ld (hl),n
  (func $LdHLiN
    (local $v i32)
    call $readCodeMemory
    set_local $v
    call $getHL
    get_local $v
    call $writeMemory
  )

  ;; scf (0x37)
  (func $Scf
    (i32.and (get_global $A) (i32.const 0x28)) ;; Mask for R5, R3
    (i32.and (get_global $F) (i32.const 0xc4)) ;; Mask for S, Z, PV
    i32.or
    i32.const 0x01 ;; Mask for C flag
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; jr c,NN (0x38)
  (func $JrC
    (local $e i32)
    call $readCodeMemory
    set_local $e
    call $testNC
    if return end

    ;; Jump
    get_local $e
    call $relativeJump
  )

  ;; add hl,sp (0x39)
  (func $AddHLSP
    ;; Calculate WZ
    (i32.add (call $getHL) (i32.const 1))
    call $setWZ

    ;; Calc the new HL value
    (call $AluAddHL (call $getHL) (call $getSP))
    call $setHL
    (call $incTacts (i32.const 7))
  )

  ;; ld a,(NN) (0x3a)
  (func $LdANNi
    (local $addr i32)

    ;; Read the address
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Read A from memory
    get_local $addr
    call $readMemory
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; dec sp (0x3b)
  (func $DecSP
    (call $setSP (i32.sub (call $getSP) (i32.const 1)))
    (call $incTacts (i32.const 2))
  )

  ;; inc a (0x3c)
  (func $IncA
    (local $v i32)
    call $getA
    (i32.add (tee_local $v) (i32.const 1))
    call $setA
    (call $adjustIncFlags (get_local $v))
  )

  ;; dec a (0x3d)
  (func $DecA
    (local $v i32)
    call $getA
    (i32.sub (tee_local $v) (i32.const 1))
    call $setA
    (call $adjustDecFlags (get_local $v))
  )

  ;; ld a,N (0x3e)
  (func $LdAN
    (call $setA (call $readCodeMemory))
  )

  ;; ccf (0x3f)
  (func $Ccf
    (i32.and (get_global $A) (i32.const 0x28)) ;; Mask for R5, R3
    (i32.and (get_global $F) (i32.const 0xc4)) ;; Mask for S, Z, PV
    i32.or
    (i32.and (get_global $F) (i32.const 0x01)) ;; Mask for C flag
    i32.const 0x01 ;; Complement C flag
    i32.xor
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ld b,c (0x41)
  (func $LdBC
    (call $setB (call $getC))
  )

  ;; ld b,d (0x42)
  (func $LdBD
    (call $setB (call $getD))
  )

  ;; ld b,e (0x43)
  (func $LdBE
    (call $setB (call $getE))
  )

  ;; ld b,h (0x44)
  (func $LdBH
    (call $setB (call $getH))
  )

  ;; ld b,l (0x45)
  (func $LdBL
    (call $setB (call $getL))
  )

  ;; ld b,(hl) (0x46)
  (func $LdBHLi
    (call $setB (call $readMemory (call $getHL)))
  )

  ;; ld b,a (0x47)
  (func $LdBA
    (call $setB (call $getA))
  )

  ;; ld c,b (0x48)
  (func $LdCB
    (call $setC (call $getB))
  )

  ;; ld c,d (0x4a)
  (func $LdCD
    (call $setC (call $getD))
  )

  ;; ld c,e (0x4b)
  (func $LdCE
    (call $setC (call $getE))
  )

  ;; ld c,h (0x4c)
  (func $LdCH
    (call $setC (call $getH))
  )

  ;; ld c,l (0x4d)
  (func $LdCL
    (call $setC (call $getL))
  )

  ;; ld c,(hl) (0x4e)
  (func $LdCHLi
    (call $setC (call $readMemory (call $getHL)))
  )

  ;; ld c,a (0x4f)
  (func $LdCA
    (call $setC (call $getA))
  )

  ;; ld d,b (0x50)
  (func $LdDB
    (call $setD (call $getB))
  )

  ;; ld d,c (0x51)
  (func $LdDC
    (call $setD (call $getC))
  )

  ;; ld d,e (0x53)
  (func $LdDE
    (call $setD (call $getE))
  )

  ;; ld d,h (0x54)
  (func $LdDH
    (call $setD (call $getH))
  )

  ;; ld d,l (0x55)
  (func $LdDL
    (call $setD (call $getL))
  )

  ;; ld d,(hl) (0x56)
  (func $LdDHLi
    (call $setD (call $readMemory (call $getHL)))
  )

  ;; ld d,a (0x57)
  (func $LdDA
    (call $setD (call $getA))
  )

  ;; ld e,b (0x58)
  (func $LdEB
    (call $setE (call $getB))
  )

  ;; ld e,c (0x59)
  (func $LdEC
    (call $setE (call $getC))
  )

  ;; ld e,d (0x5a)
  (func $LdED
    (call $setE (call $getD))
  )

  ;; ld e,h (0x5c)
  (func $LdEH
    (call $setE (call $getH))
  )

  ;; ld e,l (0x5d)
  (func $LdEL
    (call $setE (call $getL))
  )

  ;; ld e,(hl) (0x5e)
  (func $LdEHLi
    (call $setE (call $readMemory (call $getHL)))
  )

  ;; ld e,a (0x5f)
  (func $LdEA
    (call $setE (call $getA))
  )

  ;; ld h,b (0x60)
  (func $LdHB
    (call $setH (call $getB))
  )

  ;; ld h,c (0x61)
  (func $LdHC
    (call $setH (call $getC))
  )

  ;; ld h,d (0x62)
  (func $LdHD
    (call $setH (call $getD))
  )

  ;; ld h,e (0x63)
  (func $LdHE
    (call $setH (call $getE))
  )

  ;; ld h,l (0x65)
  (func $LdHL
    (call $setH (call $getL))
  )

  ;; ld h,(hl) (0x66)
  (func $LdHHLi
    (call $setH (call $readMemory (call $getHL)))
  )

  ;; ld h,a (0x67)
  (func $LdHA
    (call $setH (call $getA))
  )

  ;; ld l,b (0x68)
  (func $LdLB
    (call $setL (call $getB))
  )

  ;; ld l,c (0x69)
  (func $LdLC
    (call $setL (call $getC))
  )

  ;; ld l,d (0x6a)
  (func $LdLD
    (call $setL (call $getD))
  )

  ;; ld l,e (0x6b)
  (func $LdLE
    (call $setL (call $getE))
  )

  ;; ld l,h (0x6c)
  (func $LdLH
    (call $setL (call $getH))
  )

  ;; ld l,(hl) (0x6e)
  (func $LdLHLi
    (call $setL (call $readMemory (call $getHL)))
  )

  ;; ld l,a (0x6f)
  (func $LdLA
    (call $setL (call $getA))
  )

  ;; ld (hl),b (0x70)
  (func $LdHLiB
    (call $writeMemory (call $getHL) (call $getB))
  )

  ;; ld (hl),c (0x71)
  (func $LdHLiC
    (call $writeMemory (call $getHL) (call $getC))
  )

  ;; ld (hl),d (0x72)
  (func $LdHLiD
    (call $writeMemory (call $getHL) (call $getD))
  )

  ;; ld (hl),e (0x73)
  (func $LdHLiE
    (call $writeMemory (call $getHL) (call $getE))
  )

  ;; ld (hl),h (0x74)
  (func $LdHLiH
    (call $writeMemory (call $getHL) (call $getH))
  )

  ;; ld (hl),l (0x75)
  (func $LdHLiL
    (call $writeMemory (call $getHL) (call $getL))
  )

  ;; halt (0x76)
  (func $Halt
    ;; Set the HLT flag
    (i32.or (get_global $stateFlags) (i32.const 0x08 (; HLT signal ;)))
    set_global $stateFlags

    ;; Decrement PC
    (i32.sub (call $getPC) (i32.const 1))
    call $setPC
  )

  ;; ld (hl),a (0x77)
  (func $LdHLiA
    (call $writeMemory (call $getHL) (call $getA))
  )

  ;; ld a,b (0x78)
  (func $LdAB
    (call $setA (call $getB))
  )

  ;; ld a,c (0x79)
  (func $LdAC
    (call $setA (call $getC))
  )

  ;; ld a,d (0x7a)
  (func $LdAD
    (call $setA (call $getD))
  )

  ;; ld a,e (0x7b)
  (func $LdAE
    (call $setA (call $getE))
  )

  ;; ld a,h (0x7c)
  (func $LdAH
    (call $setA (call $getH))
  )

  ;; ld a,l (0x7d)
  (func $LdAL
    (call $setA (call $getL))
  )

  ;; ld a,(hl) (0x7e)
  (func $LdAHLi
    (call $setA (call $readMemory (call $getHL)))
  )

  ;; add a,b (0x80)
  (func $AddAB
    (call $AluAdd (call $getB) (i32.const 0))
  )

  ;; add a,c (0x81)
  (func $AddAC
    (call $AluAdd (call $getC) (i32.const 0))
  )

  ;; add a,d (0x82)
  (func $AddAD
    (call $AluAdd (call $getD) (i32.const 0))
  )

  ;; add a,e (0x83)
  (func $AddAE
    (call $AluAdd (call $getE) (i32.const 0))
  )

  ;; add a,h (0x84)
  (func $AddAH
    (call $AluAdd (call $getH) (i32.const 0))
  )

  ;; add a,l (0x85)
  (func $AddAL
    (call $AluAdd (call $getL) (i32.const 0))
  )

  ;; add a,(hl) (0x86)
  (func $AddAHLi
    (call $AluAdd (call $readMemory (call $getHL)) (i32.const 0))
  )

  ;; add a,a (0x87)
  (func $AddAA
    (call $AluAdd (call $getA) (i32.const 0))
  )

  ;; adc a,b (0x88)
  (func $AdcAB
    (call $AluAdd 
      (call $getB) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,c (0x89)
  (func $AdcAC
    (call $AluAdd 
      (call $getC) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,d (0x8a)
  (func $AdcAD
    (call $AluAdd 
      (call $getD) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,e (0x8b)
  (func $AdcAE
    (call $AluAdd 
      (call $getE) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,h (0x8c)
  (func $AdcAH
    (call $AluAdd 
      (call $getH) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,l (0x8d)
  (func $AdcAL
    (call $AluAdd 
      (call $getL) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,(hl) (0x8e)
  (func $AdcAHLi
    (call $AluAdd 
      (call $readMemory (call $getHL))
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; adc a,a (0x8f)
  (func $AdcAA
    (call $AluAdd 
      (call $getA) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sub B (0x90)
  (func $SubAB
    (call $AluSub (call $getB) (i32.const 0))
  )

  ;; sub C (0x91)
  (func $SubAC
    (call $AluSub (call $getC) (i32.const 0))
  )

  ;; sub D (0x92)
  (func $SubAD
    (call $AluSub (call $getD) (i32.const 0))
  )

  ;; sub E (0x93)
  (func $SubAE
    (call $AluSub (call $getE) (i32.const 0))
  )

  ;; sub H (0x94)
  (func $SubAH
    (call $AluSub (call $getH) (i32.const 0))
  )

  ;; sub L (0x95)
  (func $SubAL
    (call $AluSub (call $getL) (i32.const 0))
  )

  ;; sub (hl) (0x96)
  (func $SubAHLi
    (call $AluSub (call $readMemory (call $getHL)) (i32.const 0))
  )

  ;; sub A (0x97)
  (func $SubAA
    (call $AluSub (call $getA) (i32.const 0))
  )

  ;; sbc a,b (0x98)
  (func $SbcAB
    (call $AluSub 
      (call $getB) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,c (0x99)
  (func $SbcAC
    (call $AluSub 
      (call $getC) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,d (0x9a)
  (func $SbcAD
    (call $AluSub 
      (call $getD) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,e (0x9b)
  (func $SbcAE
    (call $AluSub 
      (call $getE) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,h (0x9c)
  (func $SbcAH
    (call $AluSub 
      (call $getH) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,l (0x9d)
  (func $SbcAL
    (call $AluSub 
      (call $getL) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,(hl) (0x9e)
  (func $SbcAHLi
    (call $AluSub
      (call $readMemory (call $getHL))
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; sbc a,a (0x9f)
  (func $SbcAA
    (call $AluSub 
      (call $getA) 
      (i32.and (get_global $F) (i32.const 0x01))
    )
  )

  ;; and b (0xa0)
  (func $AndAB
    (call $AluAnd (call $getB))
  )

  ;; and c (0xa1)
  (func $AndAC
    (call $AluAnd (call $getC))
  )

  ;; and d (0xa2)
  (func $AndAD
    (call $AluAnd (call $getD))
  )

  ;; and e (0xa3)
  (func $AndAE
    (call $AluAnd (call $getE))
  )

  ;; and h (0xa4)
  (func $AndAH
    (call $AluAnd (call $getH))
  )

  ;; and l (0xa5)
  (func $AndAL
    (call $AluAnd (call $getL))
  )

  ;; and (hl) (0xa6)
  (func $AndAHLi
    (call $AluAnd (call $readMemory (call $getHL)))
  )

  ;; and a (0xa7)
  (func $AndAA
    (call $AluAnd (call $getA))
  )

  ;; xor b (0xa8)
  (func $XorAB
    (call $AluXor (call $getB))
  )

  ;; xor c (0xa9)
  (func $XorAC
    (call $AluXor (call $getC))
  )

  ;; xor d (0xaa)
  (func $XorAD
    (call $AluXor (call $getD))
  )

  ;; xor e (0xab)
  (func $XorAE
    (call $AluXor (call $getE))
  )

  ;; xor h (0xac)
  (func $XorAH
    (call $AluXor (call $getH))
  )

  ;; xor l (0xad)
  (func $XorAL
    (call $AluXor (call $getL))
  )

  ;; xor (hl) (0xae)
  (func $XorAHLi
    (call $AluXor (call $readMemory (call $getHL)))
  )

  ;; xor a (0xaf)
  (func $XorAA
    (call $AluXor (call $getA))
  )

  ;; or b (0xb0)
  (func $OrAB
    (call $AluOr (call $getB))
  )

  ;; or c (0xb2)
  (func $OrAC
    (call $AluOr (call $getC))
  )

  ;; or d (0xb2)
  (func $OrAD
    (call $AluOr (call $getD))
  )

  ;; or e (0xb3)
  (func $OrAE
    (call $AluOr (call $getE))
  )

  ;; or h (0xb4)
  (func $OrAH
    (call $AluOr (call $getH))
  )

  ;; or l (0xb5)
  (func $OrAL
    (call $AluOr (call $getL))
  )

  ;; or (hl) (0xb6)
  (func $OrAHLi
    (call $AluOr (call $readMemory (call $getHL)))
  )

  ;; or a (0xb7)
  (func $OrAA
    (call $AluOr (call $getA))
  )

  ;; cp b (0xb8)
  (func $CpAB
    (call $AluCp (call $getB))
  )

  ;; cp c (0xb9)
  (func $CpAC
    (call $AluCp (call $getC))
  )

  ;; cp d (0xba)
  (func $CpAD
    (call $AluCp (call $getD))
  )

  ;; cp e (0xbb)
  (func $CpAE
    (call $AluCp (call $getE))
  )

  ;; cp h (0xbc)
  (func $CpAH
    (call $AluCp (call $getH))
  )

  ;; cp l (0xbd)
  (func $CpAL
    (call $AluCp (call $getL))
  )

  ;; cp (hl) (0xbe)
  (func $CpAHLi
    (call $AluCp (call $readMemory (call $getHL)))
  )

  ;; cp a (0xbf)
  (func $CpAA
    (call $AluCp (call $getA))
  )

  ;; ret nz (0xc0)
  (func $RetNz
    (call $incTacts (i32.const 1))
    call $testZ
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; pop bc (0xc1)
  (func $PopBC
    call $popValue
    call $setBC
  )

  ;; jp nz (0xc2)
  (func $JpNz
    call $readAddrToWZ
    call $testZ
    if return end

    call $getWZ
    call $setPC
  )

  ;; jp (0xc3)
  (func $Jp
    call $readAddrToWZ
    call $getWZ
    call $setPC
  )

  ;; call nz (0xc4)
  (func $CallNz
    call $readAddrToWZ
    call $testZ
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; push bc (0xc5)
  (func $PushBC
    call $getBC
    call $pushValue
  )

  ;; add a,N (0xc6)
  (func $AddAN
    call $readCodeMemory
    i32.const 0 ;; No carry
    call $AluAdd
  )

  ;; rst N (0xc7, 0xcf, 0xd7, 0xdf, 0xe7, 0xef, 0xf7, 0xff)
  (func $RstN
    call $getPC
    call $pushValue
    (i32.and (get_global $opCode) (i32.const 0x38))
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; ret nz (0xc8)
  (func $RetZ
    (call $incTacts (i32.const 1))
    call $testNZ
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; ret (0xc9)
  (func $Ret
    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; jp z (0xca)
  (func $JpZ
    call $readAddrToWZ
    call $testNZ
    if return end

    call $getWZ
    call $setPC
  )

  ;; CB prefix
  (func $SignCB
    i32.const 2 set_global $prefixMode
    i32.const 1 set_global $isInOpExecution
    i32.const 1 set_global $isInterruptBlocked
  )

  ;; call z (0xcc)
  (func $CallZ
    call $readAddrToWZ
    call $testNZ
    if return  end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; call (0xcd)
  (func $CallNN
    call $readAddrToWZ

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; adc a,N (0xce)
  (func $AdcAN
    call $readCodeMemory
    (i32.and (get_global $F) (i32.const 1))
    call $AluAdd
  )

  ;; ret nc (0xd0)
  (func $RetNc
    ;; Adjust tacts
    (call $incTacts (i32.const 1))
    call $testC
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; pop de (0xd1)
  (func $PopDE
    call $popValue
    call $setDE
  )

  ;; jp nc (0xd2)
  (func $JpNc
    call $readAddrToWZ
    call $testC
    if return end

    call $getWZ
    call $setPC
  )

  ;; out (N),a (0xd3)
  (func $OutNA
    (local $port i32)
    call $readCodeMemory
    (i32.shl (get_global $A) (i32.const 8))
    i32.add
    tee_local $port
    get_global $A
    call $writePort
    (i32.add (get_local $port) (i32.const 1))
    call $setWZ
  )

  ;; call nc (0xd4)
  (func $CallNc
    call $readAddrToWZ
    call $testC
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; push de (0xd5)
  (func $PushDE
    call $getDE
    call $pushValue
  )

  ;;  sub N (0xd6)
  (func $SubAN
    call $readCodeMemory
    i32.const 0 ;; No carry
    call $AluSub
  )

  ;; ret c (0xd8)
  (func $RetC
    ;; Adjust tacts
    (call $incTacts (i32.const 1))
    call $testNC
    if return  end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; exx (0xd9)
  (func $Exx
    (local $tmp i32)
    call $getBC
    set_local $tmp
    get_global $REG_AREA_INDEX
    i32.load16_u offset=10
    call $setBC
    get_global $REG_AREA_INDEX
    get_local $tmp
    i32.store16 offset=10

    call $getDE
    set_local $tmp
    get_global $REG_AREA_INDEX
    i32.load16_u offset=12
    call $setDE
    get_global $REG_AREA_INDEX
    get_local $tmp
    i32.store16 offset=12

    call $getHL
    set_local $tmp
    get_global $REG_AREA_INDEX
    i32.load16_u offset=14
    call $setHL
    get_global $REG_AREA_INDEX
    get_local $tmp
    i32.store16 offset=14
  )

  ;; jp c (0xda)
  (func $JpC
    call $readAddrToWZ
    call $testNC
    if return end

    call $getWZ
    call $setPC
  )

  ;; in a,(N) (0xdb)
  (func $InAN
    (local $port i32)
    call $readCodeMemory
    (i32.shl (get_global $A) (i32.const 8))
    i32.add
    tee_local $port
    call $readPort
    (set_global $A (i32.and (i32.const 0xff)))

    (i32.add (get_local $port) (i32.const 1))
    call $setWZ
  )

  ;; call c (0xdc)
  (func $CallC
    call $readAddrToWZ
    call $testNC
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; DD prefix
  (func $SignDD
    i32.const 1 set_global $indexMode
    i32.const 1 set_global $isInOpExecution
    i32.const 1 set_global $isInterruptBlocked
  )

  ;;  sbc N (0xde)
  (func $SbcAN
    call $readCodeMemory
    (i32.and (get_global $F) (i32.const 1))
    call $AluSub
  )

  ;; ret po (0xe0)
  (func $RetPo
    ;; Adjust tacts
    (call $incTacts (i32.const 1))
    call $testPE
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; pop hl (0xe1)
  (func $PopHL
    call $popValue
    call $setHL
  )

  ;; jp po (0xe2)
  (func $JpPo
    call $readAddrToWZ
    call $testPE
    if return end

    call $getWZ
    call $setPC
  )

  ;; ex (sp),hl (0xe3)
  (func $ExSPiHL
    (local $tmpSp i32)
    call $getSP
    tee_local $tmpSp
    call $readMemory
    (i32.add (get_local $tmpSp) (i32.const 1))
    tee_local $tmpSp
    (i32.shl (call $readMemory) (i32.const 8))
    i32.add
    call $setWZ

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
      
    else
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
    end

    ;; Write H to stack
    get_local $tmpSp
    call $getH
    call $writeMemory

    ;; Write L to stack
    (i32.sub (get_local $tmpSp) (i32.const 1))
    tee_local $tmpSp
    call $getL
    call $writeMemory

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 2))
    else
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
    end

    ;; Copy WZ to HL
    call $getWZ
    call $setHL
  )

  ;; call po (0xe4)
  (func $CallPo
    call $readAddrToWZ
    call $testPE
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; push hl (0xe5)
  (func $PushHL
    call $getHL
    call $pushValue
  )

  ;; and a,N (0xe6)
  (func $AndAN
    call $readCodeMemory
    call $AluAnd
  )

  ;; ret pe (0xe8)
  (func $RetPe
    (call $incTacts (i32.const 1))
    call $testPO
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; jp (hl) (0xe9)
  (func $JpHL
    call $getHL
    call $setPC
  )

  ;; jp po (0xea)
  (func $JpPe
    call $readAddrToWZ
    call $testPO
    if return end

    call $getWZ
    call $setPC
  )

  ;; ex de,hl (0xeb)
  (func $ExDEHL
    (local $tmp i32)
    call $getDE
    set_local $tmp
    call $getHL
    call $setDE
    get_local $tmp
    call $setHL
  )

  ;; call pe (0xec)
  (func $CallPe
    call $readAddrToWZ
    call $testPO
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; ED prefix
  (func  $SignED
    i32.const 1 set_global $prefixMode
    i32.const 1 set_global $isInOpExecution
    i32.const 1 set_global $isInterruptBlocked
  )
  
  ;; xor a,N (0xee)
  (func $XorAN
    call $readCodeMemory
    call $AluXor
  )

  ;; ret p (0xf0)
  (func $RetP
    (call $incTacts (i32.const 1))
    call $testM
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; pop af (0xf1)
  (func $PopAF
    call $popValue
    call $setAF
  )

  ;; jp p (0xf2)
  (func $JpP
    call $readAddrToWZ
    call $testM
    if return end

    call $getWZ
    call $setPC
  )

  ;; di (0xf3)
  (func $Di
    i32.const 0 set_global $iff1
    i32.const 0 set_global $iff2
  )

  ;; call p (0xf4)
  (func $CallP
    call $readAddrToWZ
    call $testM
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; push af (0xf5)
  (func $PushAF
    call $getAF
    call $pushValue
  )

  ;; or A,N (0xf6)
  (func $OrAN
    call $readCodeMemory
    call $AluOr
  )

  ;; ret m (0xf8)
  (func $RetM
    (call $incTacts (i32.const 1))
    call $testP
    if return end

    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; ld sp,hl
  (func $LdSPHL
    call $getHL
    call $setSP
    (call $incTacts (i32.const 2))
  )

  ;; jp m (0xfa)
  (func $JpM
    call $readAddrToWZ
    call $testP
    if return end

    call $getWZ
    call $setPC
  )

  ;; ei (0xfb)
  (func $Ei
    i32.const 1 set_global $isInterruptBlocked
    i32.const 1 set_global $iff1
    i32.const 1 set_global $iff2
  )

  ;; call m (0xfc)
  (func $CallM
    call $readAddrToWZ
    call $testP
    if return end

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      call $getPC
      call $memoryDelay
    end

    call $getPC
    call $pushValue
    call $getWZ
    call $setPC
  )

  ;; FD prefix
  (func $SignFD
    i32.const 2 set_global $indexMode
    i32.const 1 set_global $isInOpExecution
    i32.const 1 set_global $isInterruptBlocked
  )

  ;; call cp N (0xfe)
  (func $CpAN
    call $readCodeMemory
    call $AluCp
  )

  ;; ==========================================================================
  ;; Indexed operations

  ;; add ix,bc (0x09)
  (func $AddIXBC
    (local $qq i32)
    (local $indReg i32)
    call $getIndexReg
    tee_local $indReg
    (call $setWZ (i32.add (i32.const 1)))
    (call $AluAddHL (get_local $indReg) (call $getBC))
    call $setIndexReg
    (call $incTacts (i32.const 7))
  )

  ;; add ix,de (0x19)
  (func $AddIXDE
    (local $qq i32)
    (local $indReg i32)
    call $getIndexReg
    tee_local $indReg
    (call $setWZ (i32.add (i32.const 1)))
    (call $AluAddHL (get_local $indReg) (call $getDE))
    call $setIndexReg
    (call $incTacts (i32.const 7))
  )

  ;; ld ix,NN (0x21)
  (func $LdIXNN
    call $readAddrFromCode
    call $setIndexReg
  )

  (func $LdNNiIX
    (local $addr i32)
    (local $ix i32)
    ;; Obtain the address to store HL
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Store IX
    get_local $addr
    call $getIndexReg
    tee_local $ix
    call $writeMemory
    call $getWZ
    (i32.shr_u (get_local $ix) (i32.const 8))
    call $writeMemory
  )

  ;; inc ix (0x23)
  (func $IncIX
    (i32.add (call $getIndexReg) (i32.const 1))
    call $setIndexReg
    (call $incTacts (i32.const 2))
  )

  ;; inc xh (0x24)
  (func $IncXH
    (local $ix i32)
    (local $v i32)
    ;; Get register value
    (i32.const 8 (call $getIndexReg) (tee_local $ix))
    i32.shr_u
    tee_local $v

    ;; Increment register value
    i32.const 1
    i32.add
    i32.const 8
    i32.shl
    get_local $ix
    i32.const 0xff
    i32.and
    i32.or
    call $setIndexReg

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; dec xh (0x25)
  (func $DecXH
    (local $ix i32)
    (local $v i32)
    ;; Get register value
    call $getIndexReg
    (i32.shr_u (tee_local $ix) (i32.const 8))
    tee_local $v

    ;; Decrement register value
    i32.const 1
    i32.sub
    i32.const 8
    i32.shl
    get_local $ix
    i32.const 0xff
    i32.and
    i32.or
    call $setIndexReg

    ;; Adjust flags
    (i32.add (get_global $DEC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ld xh,N (0x26)
  (func $LdXHN
    (i32.and (call $getIndexReg) (i32.const 0xff))
    (i32.shl (call $readCodeMemory) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; add ix,ix (0x29)
  (func $AddIXIX
    (local $qq i32)
    (local $indReg i32)
    call $getIndexReg
    tee_local $indReg
    (call $setWZ (i32.add (i32.const 1)))
    (call $AluAddHL (get_local $indReg) (get_local $indReg))
    call $setIndexReg
    (call $incTacts (i32.const 7))
  )

  ;; ld ix,(NN) (0x2a)
  (func $LdIXNNi
    (local $addr i32)
    ;; Read the address
    call $readAddrFromCode
    tee_local $addr

    ;; Set WZ to addr + 1
    i32.const 1
    i32.add
    call $setWZ

    ;; Read HL from memory
    get_local $addr
    call $readMemory
    call $getWZ
    call $readMemory
    i32.const 8
    i32.shl
    i32.or
    call $setIndexReg
  )

  ;; dec ix (0x2b)
  (func $DecIX
    (i32.sub (call $getIndexReg) (i32.const 1))
    call $setIndexReg
    (call $incTacts (i32.const 2))
  )

  ;; inc xl (0x2c)
  (func $IncXL
    (local $ix i32)
    (local $v i32)
    ;; Get register value
    call $getIndexReg
    (i32.and (tee_local $ix) (i32.const 0xff))
    tee_local $v

    ;; Increment register value
    i32.const 1
    i32.add
    get_local $ix
    i32.const 0xff00
    i32.and
    i32.or
    call $setIndexReg

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; dec xl (0x2d)
  (func $DecXL
    (local $ix i32)
    (local $v i32)
    ;; Get register value
    call $getIndexReg
    (i32.and (tee_local $ix) (i32.const 0xff))
    tee_local $v

    ;; Increment register value
    i32.const 1
    i32.sub
    get_local $ix
    i32.const 0xff00
    i32.and
    i32.or
    call $setIndexReg

    ;; Adjust flags
    (i32.add (get_global $DEC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ld xl,N (0x2e)
  (func $LdXLN
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    call $readCodeMemory
    i32.or
    call $setIndexReg
  )

  ;; inc (ix+d) (0x34)
  (func $IncIXi
    (local $v i32)
    (local $addr i32)
    call $getIndexedAddress
    tee_local $addr
    call $readMemory
    (call $AdjustIXTact (set_local $v))

    ;; Increment value
    get_local $addr
    (i32.add (get_local $v) (i32.const 1))
    call $writeMemory
    (call $incTacts (i32.const 1))

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

    ;; dec (ix+d) (0x35)
  (func $DecIXi
    (local $v i32)
    (local $addr i32)

    call $getIndexedAddress
    tee_local $addr
    call $readMemory
    (call $AdjustIXTact (set_local $v))

    ;; Increment value
    get_local $addr
    (i32.sub (get_local $v) (i32.const 1))
    call $writeMemory
    (call $incTacts (i32.const 1))

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ld (ix+d),B (0x36)
  (func $LdIXiN
    call $getIndexedAddress
    call $readCodeMemory

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 2))
    else
      (call $memoryDelay (call $getPC))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (call $getPC))
      (call $incTacts (i32.const 1))
    end

    ;; Store value
    call $writeMemory
  )

  ;; add ix,sp (0x39)
  (func $AddIXSP
    (local $qq i32)
    (local $indReg i32)
    call $getIndexReg
    tee_local $indReg
    (call $setWZ (i32.add (i32.const 1)))
    (call $AluAddHL (get_local $indReg) (call $getSP))
    call $setIndexReg
    (call $incTacts (i32.const 7))
  )

  ;; ld b,xh (0x44)
  (func $LdBXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $setB
  )

  ;; ld b,xl (0x45)
  (func $LdBXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $setB
  )

  ;; ld b,(ix+d) (0x46)
  (func $LdBIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setB (call $readMemory))
  )

  ;; ld c,xh (0x4c)
  (func $LdCXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $setC
  )

  ;; ld c,xl (0x4d)
  (func $LdCXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $setC
  )

  ;; ld c,(ix+d) (0x4e)
  (func $LdCIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setC (call $readMemory))
  )

  ;; ld d,xh (0x54)
  (func $LdDXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $setD
  )

  ;; ld d,xl (0x55)
  (func $LdDXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $setD
  )

  ;; ld d,(ix+d) (0x56)
  (func $LdDIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setD (call $readMemory))
  )

  ;; ld e,xh (0x5c)
  (func $LdEXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $setE
  )

  ;; ld e,xl (0x5d)
  (func $LdEXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $setE
  )

  ;; ld e,(ix+d) (0x5e)
  (func $LdEIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setE (call $readMemory))
  )

  ;; ld xh,b (0x60)
  (func $LdXHB
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getB) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld xh,c (0x61)
  (func $LdXHC
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getC) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld xh,d (0x62)
  (func $LdXHD
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getD) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld xh,e (0x63)
  (func $LdXHE
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getE) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld xh,xl (0x65)
  (func $LdXHXL
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getIndexReg) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld h,(ix+d) (0x66)
  (func $LdHIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setH (call $readMemory))
  )

  ;; ld xh,e (0x67)
  (func $LdXHA
    (i32.and (call $getIndexReg) (i32.const 0x00ff))
    (i32.shl (call $getA) (i32.const 8))
    i32.or
    call $setIndexReg
  )

  ;; ld xl,b (0x68)
  (func $LdXLB
    (i32.or 
      (i32.and (call $getIndexReg) (i32.const 0xff00))
      (call $getB)
    )
    call $setIndexReg
  )

  ;; ld xl,c (0x69)
  (func $LdXLC
    (i32.or 
      (i32.and (call $getIndexReg) (i32.const 0xff00))
      (call $getC)
    )
    call $setIndexReg
  )

  ;; ld xl,d (0x6a)
  (func $LdXLD
    (i32.or 
      (i32.and (call $getIndexReg) (i32.const 0xff00))
      (call $getD)
    )
    call $setIndexReg
  )

  ;; ld xl,e (0x6b)
  (func $LdXLE
    (i32.or 
      (i32.and (call $getIndexReg) (i32.const 0xff00))
      (call $getE)
    )
    call $setIndexReg
  )

  ;; ld xl,xh (0x6c)
  (func $LdXLXH
    (local $xh i32)
    (i32.and (call $getIndexReg) (i32.const 0xff00))
    (i32.shr_u (tee_local $xh) (i32.const 8))
    get_local $xh
    i32.or
    call $setIndexReg
  )

  ;; ld l,(ix+d) (0x6e)
  (func $LdLIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setL (call $readMemory))
  )

  ;; ld xl,a (0x6f)
  (func $LdXLA
    (i32.or 
      (i32.and (call $getIndexReg) (i32.const 0xff00))
      (call $getA)
    )
    call $setIndexReg
  )

  ;; ld (ix+d),b (0x70)
  (func $LdIXiB
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getB))
  )

  ;; ld (ix+d),c (0x71)
  (func $LdIXiC
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getC))
  )

  ;; ld (ix+d),d (0x72)
  (func $LdIXiD
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getD))
  )

  ;; ld (ix+d),e (0x73)
  (func $LdIXiE
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getE))
  )

  ;; ld (ix+d),h (0x74)
  (func $LdIXiH
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getH))
  )

  ;; ld (ix+d),l (0x75)
  (func $LdIXiL
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getL))
  )

  ;; ld (ix+d),b (0x77)
  (func $LdIXiA
    call $getIndexedAddress
    call $AdjustIXTact
    (call $writeMemory (call $getA))
  )

  ;; ld a,xh (0x7c)
  (func $LdAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $setA
  )

  ;; ld a,xl (0x7d)
  (func $LdAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $setA
  )

  ;; ld b,(ix+d) (0x7e)
  (func $LdAIXi
    (call $AdjustIXTact (call $getIndexedAddress))
    (call $setA (call $readMemory))
  )

  ;; add a,xh (0x84)
  (func $AddAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    i32.const 0
    call $AluAdd
  )

  ;; add a,xl (0x85)
  (func $AddAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    i32.const 0
    call $AluAdd
  )

  ;; add a,(ix+d) (0x86)
  (func $AddAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    i32.const 0
    call $AluAdd
  )

  ;; adc a,xh (0x8c)
  (func $AdcAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    (i32.and (get_global $F) (i32.const 1))
    call $AluAdd
  )

  ;; adc a,xl (0x8d)
  (func $AdcAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    (i32.and (get_global $F) (i32.const 1))
    call $AluAdd
  )

  ;; adc a,(ix+d) (0x8e)
  (func $AdcAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    (i32.and (get_global $F) (i32.const 1))
    call $AluAdd
  )

  ;; sub a,xh (0x94)
  (func $SubAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    i32.const 0
    call $AluSub
  )

  ;; sub a,xl (0x95)
  (func $SubAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    i32.const 0
    call $AluSub
  )

  ;; sub a,(ix+d) (0x96)
  (func $SubAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    i32.const 0
    call $AluSub
  )

  ;; sbc a,xh (0x9c)
  (func $SbcAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    (i32.and (get_global $F) (i32.const 1))
    call $AluSub
  )

  ;; sbc a,xl (0x9d)
  (func $SbcAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    (i32.and (get_global $F) (i32.const 1))
    call $AluSub
  )

  ;; sub a,(ix+d) (0x9e)
  (func $SbcAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    (i32.and (get_global $F) (i32.const 1))
    call $AluSub
  )

  ;; and a,xh (0xa4)
  (func $AndAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $AluAnd
  )

  ;; and a,xl (0xa5)
  (func $AndAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $AluAnd
  )

  ;; and a,(ix+d) (0x9e)
  (func $AndAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    call $AluAnd
  )

  ;; xor a,xh (0xac)
  (func $XorAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $AluXor
  )

  ;; xor a,xl (0xad)
  (func $XorAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $AluXor
  )

  ;; xor a,(ix+d) (0xae)
  (func $XorAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    call $AluXor
  )

  ;; or a,xh (0xb4)
  (func $OrAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $AluOr
  )

  ;; or a,xl (0xb5)
  (func $OrAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $AluOr
  )

  ;; or a,(ix+d) (0xb6)
  (func $OrAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    call $AluOr
  )

  ;; cp xh (0xbc)
  (func $CpAXH
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $AluCp
  )

  ;; cp xl (0xbd)
  (func $CpAXL
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $AluCp
  )

  ;; cp (ix+d) (0xbe)
  (func $CpAIXi
    call $getIndexedAddress
    call $AdjustIXTact
    call $readMemory
    call $AluCp
  )

  ;; pop ix (0xe1)
  (func $PopIX
    call $popValue
    call $setIndexReg
  )

    ;; ex (sp),ix (0xe3)
  (func $ExSPiIX
    (local $tmpSp i32)
    call $getSP
    tee_local $tmpSp
    call $readMemory
    (i32.add (get_local $tmpSp) (i32.const 1))
    tee_local $tmpSp
    (i32.shl (call $readMemory) (i32.const 8))
    i32.add
    call $setWZ

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
    end

    ;; Write H to stack
    get_local $tmpSp
    (i32.shr_u (call $getIndexReg) (i32.const 8))
    call $writeMemory

    ;; Write L to stack
    (i32.sub (get_local $tmpSp) (i32.const 1))
    tee_local $tmpSp
    (i32.and (call $getIndexReg) (i32.const 0xff))
    call $writeMemory

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 2))
    else
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $tmpSp))
      (call $incTacts (i32.const 1))
    end

    ;; Copy WZ to IX
    call $getWZ
    call $setIndexReg
  )

  ;; push ix (0xe5)
  (func $PushIX
    call $getIndexReg
    call $pushValue
  )

  ;; jp (ix) (0xe9)
  (func $JpIX
    call $getIndexReg
    call $setPC
  )

  ;; ld sp,ix (0xf9)
  (func $LdSPIX
    call $getIndexReg
    call $setSP
    i32.const 2
    call $incTacts
  )

  ;; ==========================================================================
  ;; Extended instructions

  ;; swapnib (0x23)
  (func $SwapNib
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.shl (get_global $A) (i32.const 4))
    (i32.shr_u (get_global $A) (i32.const 4))
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; mirror (0x24)
  (func $Mirror
    (local $a i32)
    (local $newA i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    i32.const 0
    set_local $newA
    (i32.or (get_global $A) (i32.const 0xff00))
    set_local $a
    loop $mirror_loop
      ;; Get the rightmost bit of A
      (i32.and (get_local $a) (i32.const 0x01))

      ;; Pull it into new A from right
      (i32.shl (get_local $newA) (i32.const 1))
      i32.or
      set_local $newA

      ;; Shift A
      (i32.shr_u (get_local $a) (i32.const 1))
      tee_local $a

      ;; Test branch condition
      i32.const 0xff00
      i32.and
      br_if $mirror_loop
    end
    (set_global $A (i32.and (get_local $newA)(i32.const 0xff)))
  )

  ;; test N (0x27)
  (func $TestN
    (local $a i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    get_global $A
    set_local $a

    call $readCodeMemory
    call $AluAnd

    get_local $a
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; bsla de,b (0x28)
  (func $Bsla
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    call $getDE
    (i32.and (call $getB) (i32.const 0x07))
    i32.shl
    call $setDE
  )

  ;; bsra de,b (0x29)
  (func $Bsra
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.and (call $getDE) (i32.const 0x8000))
    call $getDE
    (i32.and (call $getB) (i32.const 0x07))
    i32.shr_u
    i32.or
    call $setDE
  )

  ;; bsrl de,b (0x2a)
  (func $Bsrl
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    call $getDE
    (i32.and (call $getB) (i32.const 0x07))
    i32.shr_u
    call $setDE
  )

  ;; bsrf de,b (0x2b)
  (func $Bsrf
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.xor (call $getDE) (i32.const 0xffff))
    (i32.and (call $getB) (i32.const 0x0f))
    i32.shr_u
    i32.const 0xffff
    i32.xor
    call $setDE
  )

  ;; brlc de,b (0x2c)
  (func $Brlc
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    call $getDE
    (i32.and (call $getB) (i32.const 0x0f))
    i32.shl

    call $getDE
    i32.const 16
    (i32.and (call $getB) (i32.const 0x0f))
    i32.sub
    i32.shr_u
    i32.or
    call $setDE
  )

  ;; mul (0x30)
  (func $Mul
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.mul (call $getD) (call $getE))
    call $setDE
  )

  ;; add hl,a (0x31)
  (func $AddHLA
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getHL) (get_global $A))
    call $setHL
  )

  ;; add de,a (0x32)
  (func $AddDEA
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getDE) (get_global $A))
    call $setDE
  )

  ;; add bc,a (0x33)
  (func $AddBCA
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getBC) (get_global $A))
    call $setBC
  )

  ;; add hl,NN (0x34)
  (func $AddHLNN
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getHL) (call $readAddrFromCode))
    call $setHL
    (call $incTacts (i32.const 2))
  )

  ;; add de,NN (0x35)
  (func $AddDENN
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getDE) (call $readAddrFromCode))
    call $setDE
    (call $incTacts (i32.const 2))
  )

  ;; add bc,NN (0x36)
  (func $AddBCNN
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    (i32.add (call $getBC) (call $readAddrFromCode))
    call $setBC
    (call $incTacts (i32.const 2))
  )

  ;; in b,(c) (0x40)
  (func $InBC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setB
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),b (0x41)
  (func $OutCB
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getB))
  )

  ;; sbc hl,bc (0x42)
  (func $SbcHLBC
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluSbcHL (call $getBC))
    (call $incTacts (i32.const 7))
  )

  ;; ld (NN),bc (0x43)
  (func $LdNNiBC
    (local $addr i32)
    call $readAddrFromCode
    (i32.add (tee_local $addr) (i32.const 1))
    call $setWZ
    get_local $addr
    (call $writeMemory (call $getC))
    call $getWZ
    (call $writeMemory (call $getB))
  )

  ;; in c,(c) (0x48)
  (func $InCC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setC
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),c (0x49)
  (func $OutCC
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getC))
  )

  ;; in d,(c) (0x50)
  (func $InDC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setD
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),d (0x51)
  (func $OutCD
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getD))
  )

  ;; in e,(c) (0x58)
  (func $InEC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setE
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),e (0x59)
  (func $OutCE
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getE))
  )

  ;; in h,(c) (0x60)
  (func $InHC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setH
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),h (0x61)
  (func $OutCH
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getH))
  )

  ;; in l,(c) (0x68)
  (func $InLC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setL
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),l (0x69)
  (func $OutCL
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getL))
  )

  ;; in (c) (0x70)
  (func $In0C
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    set_local $pval
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),0 (0x71)
  (func $OutC0
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (i32.const 0))
  )

  ;; in a,(c) (0x78)
  (func $InAC
    (local $pval i32)
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $readPort (call $getBC))
    tee_local $pval
    call $setA
    
    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_local $pval))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; out (c),a (0x79)
  (func $OutCA
    (i32.add (call $getBC) (i32.const 1))
    call $setWZ
    (call $writePort (call $getBC) (call $getA))
  )

  ;; ld (NN),QQ 
  (func $LdNNiQQ
    (local $qq i32)
    (local $addr i32)

    ;; Obtain address
    call $readAddrFromCode
    (i32.add (tee_local $addr) (i32.const 1))
    call $setWZ

    ;; Obtain reg value
    (i32.shr_u 
      (i32.and (get_global $opCode) (i32.const 0x30))
      (i32.const 4)
    )
    call $getReg16
    set_local $qq

    get_local $addr
    (i32.and (get_local $qq) (i32.const 0xff))
    call $writeMemory
    call $getWZ
    (i32.shr_u (get_local $qq) (i32.const 8))
    call $writeMemory
  )

  ;; neg
  (func $Neg
    (local $a i32)
    ;; Calc the new value of A
    (i32.sub (i32.const 0) (get_global $A))
    i32.const 0xff
    i32.and
    tee_local $a

    ;; Keep S, R5, R3
    i32.const 0xA8 ;; Mask for S|R5|R3
    i32.and ;; (S|R5|R3)
    ;; Set N
    i32.const 0x02 ;; (S|R5|R3, N)

    ;; Calculate Z
    i32.const 0x00
    i32.const 0x40
    (i32.ne (get_local $a) (i32.const 0))
    select ;; (S|R5|R3, N, Z)

    ;; Calculate C
    i32.const 0x01
    i32.const 0x00
    (i32.ne (get_local $a) (i32.const 0))
    select ;; (S|R5|R3, N, Z, C)

    ;; Calculate PV
    i32.const 0x04
    i32.const 0x00
    (i32.eq (get_local $a) (i32.const 0x80))
    select ;; (S|R5|R3, N, Z, C, PV)

    ;; Calculate H
    i32.const 0
    get_global $A
    i32.const 0x0f
    i32.and
    i32.const 24
    i32.shl
    i32.const 24
    i32.shr_s
    i32.sub
    i32.const 0x10
    i32.and ;; (S|R5|R3, N, Z, C, PV, H)

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))

    ;; Store the result
    get_local $a
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; retn/reti
  (func $Retn
    get_global $iff2
    set_global $iff1
    call $popValue
    call $setWZ
    call $getWZ
    call $setPC
  )

  ;; im N
  (func $ImN
    (local $mode i32)
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x18))
      (i32.const 3)
    )
    (i32.lt_u (tee_local $mode) (i32.const 2))
    if (result i32)
      i32.const 1
    else
      get_local $mode
    end
    i32.const 1
    i32.sub
    set_global $interruptMode
  )

  ;; ld i,a 0x47
  (func $LdIA
    get_global $A
    call $setI    
    (call $incTacts (i32.const 1))
  )

  ;; adc hl,bc (0x4a)
  (func $AdcHLBC
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluAdcHL (call $getBC))
    (call $incTacts (i32.const 7))
  )

  ;; ld bc,(NN) (0x4b)
  (func $LdBCNNi
    (local $addr i32)
    call $readAddrFromCode
    (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
    (call $setC (call $readMemory (get_local $addr)))
    (call $setB (call $readMemory (call $getWZ)))
  )

  ;; ld r,a 0x4f
  (func $LdRA
    get_global $A
    call $setR    
    (call $incTacts (i32.const 1))
  )

  ;; sbc hl,de (0x52)
  (func $SbcHLDE
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluSbcHL (call $getDE))
    (call $incTacts (i32.const 7))
  )

  ;; ld (NN),de (0x53)
  (func $LdNNiDE
    (local $addr i32)
    call $readAddrFromCode
    (i32.add (tee_local $addr) (i32.const 1))
    call $setWZ
    get_local $addr
    (call $writeMemory (call $getE))
    call $getWZ
    (call $writeMemory (call $getD))
  )

  ;; ld a,i (0x57)
  (func $LdAXr
    (local $xr i32)
    (i32.and (get_global $opCode) (i32.const 0x08))
    if (result i32)
      call $getR
    else
      call $getI
    end
    tee_local $xr
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Set flags
    (i32.and (get_global $F) (i32.const 0x01)) ;; (C)
    (i32.and (get_local $xr) (i32.const 0xa8)) ;; (C, S|R5|R3)

    i32.const 0x04
    i32.const 0x00
    get_global $iff2
    select  ;; (C, S|R5|R3, PV)

    i32.const 0x00
    i32.const 0x40
    get_local $xr
    select  ;; (C, S|R5|R3, PV, Z)

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
    (call $incTacts (i32.const 1))
  )

  ;; adc hl,de (0x5a)
  (func $AdcHLDE
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluAdcHL (call $getDE))
    (call $incTacts (i32.const 7))
  )

  ;; ld de,(NN) (0x5b)
  (func $LdDENNi
    (local $addr i32)
    call $readAddrFromCode
    (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
    (call $setE (call $readMemory (get_local $addr)))
    (call $setD (call $readMemory (call $getWZ)))
  )

  ;; sbc hl,hl (0x62)
  (func $SbcHLHL
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluSbcHL (call $getHL))
    (call $incTacts (i32.const 7))
  )

  ;; rrd (0x67)
  (func $Rrd
    (local $hl i32)
    (local $tmp i32)
    call $getHL
    tee_local $hl
    call $readMemory
    set_local $tmp

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 4))
    else
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
    end
  
    ;; WZ := HL + 1
    (i32.add (get_local $hl) (i32.const 1))
    call $setWZ

    ;; Write back to memory
    call $getHL
    (i32.shl (get_global $A) (i32.const 4))
    (i32.shr_u (get_local $tmp) (i32.const 4))
    i32.or
    call $writeMemory

    ;; Set A
    (i32.and (get_global $A) (i32.const 0xf0))
    (i32.and (get_local $tmp) (i32.const 0x0f))
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_global $A))
    i32.load8_u

    ;; Keep C
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; adc hl,hl (0x6a)
  (func $AdcHLHL
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluAdcHL (call $getHL))
    (call $incTacts (i32.const 7))
  )

  ;; rld (0x6f)
  (func $Rld
    (local $hl i32)
    (local $tmp i32)
    call $getHL
    tee_local $hl
    call $readMemory
    set_local $tmp

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 4))
    else
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $hl))
      (call $incTacts (i32.const 1))
    end
  
    ;; WZ := HL + 1
    (i32.add (get_local $hl) (i32.const 1))
    call $setWZ

    ;; Write back to memory
    call $getHL
    (i32.and (get_global $A) (i32.const 0x0f))
    (i32.shl (get_local $tmp) (i32.const 4))
    i32.or
    call $writeMemory

    ;; Set A
    (i32.and (get_global $A) (i32.const 0xf0))
    (i32.shr_u (get_local $tmp) (i32.const 4))
    i32.or
    (set_global $A (i32.and (i32.const 0xff)))

    ;; Adjust flags
    (i32.add (get_global $LOG_FLAGS) (get_global $A))
    i32.load8_u

    ;; Keep C
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; sbc hl,sp (0x72)
  (func $SbcHLSP
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluSbcHL (call $getSP))
    (call $incTacts (i32.const 7))
  )

  ;; ld (NN),sp (0x73)
  (func $LdNNiSP
    (local $addr i32)
    call $readAddrFromCode
    (i32.add (tee_local $addr) (i32.const 1))
    call $setWZ
    get_local $addr
    (call $writeMemory (i32.and (call $getSP) (i32.const 0xff)))
    call $getWZ
    (call $writeMemory (i32.shr_u (call $getSP) (i32.const 8)))
  )

  ;; adc hl,sp (0x7a)
  (func $AdcHLSP
    (call $setWZ (i32.add (call $getHL) (i32.const 1)))
    (call $AluAdcHL (call $getSP))
    (call $incTacts (i32.const 7))
  )

  ;; ld sp,(NN) (0x7b)
  (func $LdSPNNi
    (local $addr i32)
    call $readAddrFromCode
    (call $setWZ (i32.add (tee_local $addr) (i32.const 1)))
    (call $readMemory (get_local $addr))
    (call $readMemory (call $getWZ))
    i32.const 8
    i32.shl
    i32.add
    call $setSP
  )

  ;; push NN (0x8a)
  (func $PushNN
    (local $v i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end    

    call $readAddrFromCode
    set_local $v
    call $decSP
    call $getSP
    (i32.shr_u (get_local $v) (i32.const 8))
    call $writeMemory
    call $decSP
    call $getSP
    get_local $v
    call $writeMemory
  )

  ;; outinb (0x90)
  (func $OutInB
    (local $hl i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    ;; Adjust tacts
    i32.const 1
    call $incTacts

    ;; Write (HL) to port BC
    call $getBC
    call $getHL
    tee_local $hl
    call $readMemory
    call $writePort

    ;; Increment HL
    (i32.add (get_local $hl) (i32.const 1))
    call $setHL
  )

  ;; nextreg (0x91)
  (func $NextReg
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    ;; Write TBBLUE index register
    call $readCodeMemory
    call $writeTbBlueIndex

    ;; Write TBBLUE value register
    call $readCodeMemory
    call $writeTbBlueValue
  )

  ;; nextreg A (0x92)
  (func $NextRegA
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    ;; Write TBBLUE index register
    call $readCodeMemory
    call $writeTbBlueIndex

    ;; Write TBBLUE value register
    get_global $A
    call $writeTbBlueValue
  )

  ;; pixeldn (0x93)
  (func $PixelDn
    (local $hl i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    call $getHL
    (i32.ne 
      (i32.and (tee_local $hl) (i32.const 0x0700))
      (i32.const 0x0700)
    )
    if (result i32)
      ;; Next pixel row within a character row
      (i32.add (get_local $hl) (i32.const 0x100))
    else
      (i32.ne 
        (i32.and (get_local $hl) (i32.const 0xe0))
        (i32.const 0xe0)
      )
      if (result i32)
        ;; The start of next character row
        (i32.and (get_local $hl) (i32.const 0xf8ff))
        i32.const 0x20
        i32.add
      else
        ;; The start of the next screen-third
        (i32.and (get_local $hl) (i32.const 0xf81f))
        i32.const 0x0800
        i32.add
      end
    end

    ;; Done
    call $setHL
  )

  ;; pixelad (0x94)
  (func $PixelAd
    (local $d i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    call $getD
    ;; (D & 0xc0) << 5
    (i32.and (tee_local $d) (i32.const 0xc0))
    i32.const 5
    i32.shl

    ;; (D & 0x07) << 8
    (i32.and (get_local $d) (i32.const 0x07))
    i32.const 8
    i32.shl

    ;; (D & 0x38) << 2
    (i32.and (get_local $d) (i32.const 0x38))
    i32.const 2
    i32.shl

    ;; E >> 3
    (i32.shr_u (call $getE) (i32.const 3))

    ;; Calculate the address
    i32.const 0x4000
    i32.add
    i32.add
    i32.add
    i32.add
    call $setHL
  )

  ;; setae (0x96)
  (func $SetAE
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    i32.const 0x80
    (i32.and (call $getE) (i32.const 0x07))
    i32.shr_u
    (set_global $A (i32.and (i32.const 0xff)))
  )

  ;; jp (c) (0x98)
  (func $JpInC
    (local $bc i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    call $getBC
    (i32.add (tee_local $bc) (i32.const 1))
    call $setWZ

    get_local $bc
    (i32.shl (call $readPort) (i32.const 6))

    (i32.and (call $getPC) (i32.const 0xc000))
    i32.add
    call $setPC
    (call $incTacts (i32.const 1))
  )

  ;; ==========================================================================
  ;; Helpers for block operations

  ;; Implements the core of the ldi/ldd/ldir/lddr operations
  ;; $step: direction (1 or -1)
  ;; result: the value of flags
  (func $LdBase (param $step i32) (result i32)
    (local $de i32)
    (local $hl i32)
    (local $memVal i32)
    
    ;; (DE) := (HL)
    call $getDE
    tee_local $de
    call $getHL
    tee_local $hl
    call $readMemory
    tee_local $memVal
    call $writeMemory

    ;; Increment/decrement HL
    (i32.add (get_local $hl) (get_local $step))
    call $setHL

    ;; Adjust tacts
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 2))
    else
      (call $memoryDelay (get_local $de))
      (call $incTacts (i32.const 1))
      (call $memoryDelay (get_local $de))
      (call $incTacts (i32.const 1))
    end

    ;; Increment/decrement DE
    (i32.add (get_local $de) (get_local $step))
    call $setDE

    ;; Keep S, Z, and C
    (i32.and (get_global $F) (i32.const 0xc1)) ;; (S|Z|C)
    (i32.add (get_local $memVal) (get_global $A))
    (i32.and (tee_local $memVal) (i32.const 0x08))
    (i32.shl (get_local $memVal) (i32.const 4))
    
    i32.const 0x20 ;; Mask for R5
    i32.and
    i32.or ;; (S|Z|C, R5|R3)
    i32.or

    ;; Decrement BC
    (i32.sub (call $getBC) (i32.const 1))
    call $setBC
  )

  ;; Base of the cpi/cpd/cpir/cpdr operations
  ;; $step: direction, 1/-1
  (func $CpBase (param $step i32) (result i32)
    (local $hl i32)
    (local $compRes i32)
    (local $r3r5 i32)
    get_global $A
    call $getHL
    tee_local $hl
    call $readMemory

    ;; Calc compRes
    i32.sub
    tee_local $compRes
    set_local $r3r5
    
    ;; Keep C 
    (i32.and (get_global $F) (i32.const 0x01))

    ;; Set N
    i32.const 0x02 ;; (C, N)

    ;; Calculate H
    (i32.and (get_global $A) (i32.const 0x0f))
    (i32.and (get_local $compRes) (i32.const 0x0f))
    i32.sub
    i32.const 0x10
    i32.and
    if (result i32) ;; (C, N, H)
      (i32.sub (get_local $compRes) (i32.const 1))
      set_local $r3r5
      i32.const 0x10
    else
      i32.const 0x00
    end

    ;; Calculate Z
    i32.const 0x00
    i32.const 0x40
    (i32.and (get_local $compRes) (i32.const 0xff))
    select ;; (C, N, H, Z)

    (i32.and (get_local $compRes) (i32.const 0x80)) ;; (C, N, H, Z, S)
    (i32.and (get_local $r3r5) (i32.const 0x08)) ;; (C, N, H, Z, S, R3)
    (i32.shl (get_local $r3r5) (i32.const 4))
    i32.const 0x20
    i32.and ;; (C, N, H, Z, S, R3,R5)

    ;; Adjust tacts
    (call $Adjust5Tacts (get_local $hl))

    ;; Increment/decrement HL
    (i32.add (get_local $hl) (get_local $step))
    call $setHL

    ;; Decrement BC
    (i32.sub (call $getBC) (i32.const 1))
    call $setBC

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    i32.or
    i32.or
    i32.or
  )

  ;; Base of ini/id/inir/indr operations
  (func $InBase (param $step i32)
    (local $bc i32)
    (local $hl i32)
    (call $incTacts (i32.const 1))
    call $getBC
    (i32.add (tee_local $bc) (i32.const 1))
    call $setWZ

    ;; (HL) := in(BC)
    call $getHL
    tee_local $hl
    get_local $bc
    call $readPort
    call $writeMemory

    ;; Set N
    (i32.or (get_global $F) (i32.const 0x02))
    (set_global $F (i32.and (i32.const 0xff)))

    ;; Decrement B
    (i32.sub (call $getB) (i32.const 1))
    tee_local $bc
    call $setB

    ;; Set or reset Z
    (i32.eq (get_local $bc) (i32.const 0))
    if (result i32)
      (i32.or (get_global $F) (i32.const 0x40))
    else
      (i32.and (get_global $F) (i32.const 0xbf))
    end
    (set_global $F (i32.and (i32.const 0xff)))

    ;; Increment or decrement HL
    (i32.add (call $getHL) (get_local $step))
    call $setHL
  )

  ;; Base of outi/outd/otir/otdr operations
  (func $OutBase (param $step i32)
    (local $f i32)
    (local $b i32)
    (local $hl i32)
    (call $incTacts (i32.const 1))

    ;; Set N
    (i32.const 0x02 (get_global $F) (tee_local $f))
    i32.or
    set_local $f

    ;; Decrement B
    (i32.sub (call $getB) (i32.const 1))
    tee_local $b
    call $setB
    get_local $b

    ;; Set or reset Z
    i32.const 0
    i32.eq
    if (result i32)
      (i32.or (get_local $f) (i32.const 0x40))
    else
      (i32.and (get_local $f) (i32.const 0xbf))
    end
    (set_global $F (i32.and (i32.const 0xff)))

    ;; Write port
    call $getBC
    tee_local $b
    call $getHL
    tee_local $hl
    call $readMemory
    call $writePort

    ;; Increment/decrement HL
    (i32.add (get_local $hl) (get_local $step))
    call $setHL

    ;; WZ := BC + 1
    (i32.add (get_local $b) (i32.const 1))
    call $setWZ
  )

  ;; Base of the ldix/lddx operations
  (func $LdxBase (param $step i32)
    (local $de i32)
    (local $hl i32)
    (local $memVal i32)

    ;; Obtain DE
    call $getDE
    set_local $de

    ;; Conditional copy from (HL) to (DE)
    call $getHL
    tee_local $hl
    call $readMemory
    tee_local $memVal
    get_global $A
    i32.ne
    if
      get_local $de
      get_local $memVal
      call $writeMemory
      (call $incTacts (i32.const 2))
    else
      (call $incTacts (i32.const 5))
    end

    ;; Prepare for loop
    (i32.add (get_local $hl) (get_local $step))
    call $setHL
    (i32.add (get_local $de) (get_local $step))
    call $setDE
    (i32.sub (call $getBC) (i32.const 1))
    call $setBC
  )

  ;; Tail of the ldir/lddr operations
  (func $LdrTail
    (local $pc i32)

    ;; Test exit
    (i32.eq (call $getBC) (i32.const 0))
    if return end

    ;; Set PV
    (i32.or (get_global $F) (i32.const 0x04))
    (set_global $F (i32.and (i32.const 0xff)))

    ;; PC := PC - 2
    (i32.sub (call $getPC) (i32.const 2))
    tee_local $pc
    call $setPC

    ;; Adjust tacts
    (i32.sub (call $getDE) (i32.const 1))
    call $Adjust5Tacts

    ;; WZ := PC + 1
    (i32.add (get_local $pc) (i32.const 1))
    call $setWZ
  )

  ;; Tail of the cpir/cpdr operations
  (func $CprTail
    (local $f i32)
    (local $pc i32)
    call $getBC
    if
      ;; Set PV
      get_global $F
      (i32.or (tee_local $f) (i32.const 0x04))
      (set_global $F (i32.and (i32.const 0xff)))
      (i32.eq
        (i32.and (get_local $f) (i32.const 0x40))
        (i32.const 0)
      )
      if
        ;; Value not found yet
        ;; PC := PC - 2
        (i32.sub (call $getPC) (i32.const 2))
        tee_local $pc
        call $setPC

        ;; Adjust tacts
        (i32.sub (call $getHL) (i32.const 1))
        call $Adjust5Tacts

        ;; WZ := PC + 1
        (i32.add (get_local $pc) (i32.const 1))
        call $setWZ
      end
    end
  )

  ;; Tail of the inir/indr operations
  (func $IndTail
    (i32.ne (call $getB) (i32.const 0))
    if
      ;; Set PV
      (i32.or (get_global $F) (i32.const 0x04))
      (set_global $F (i32.and (i32.const 0xff)))

      ;; PC := PC - 2
      (i32.sub (call $getPC) (i32.const 2))
      call $setPC

      ;; Adjust tacts
      (i32.sub (call $getHL) (i32.const 1))
      call $Adjust5Tacts
    else
      ;; Reset PV
      (i32.and (get_global $F) (i32.const 0xfb))
      (set_global $F (i32.and (i32.const 0xff)))
    end
  )

  ;; Tail of the otir/otdr instructions
  (func $OutrTail
    (i32.ne (call $getB) (i32.const 0))
    if
      ;; Set PV
      (i32.or (get_global $F) (i32.const 0x04))
      (set_global $F (i32.and (i32.const 0xff)))

      ;; PC := PC - 2
      (i32.sub (call $getPC) (i32.const 2))
      call $setPC

      ;; Adjust tacts
      call $getBC
      call $Adjust5Tacts
    else
      ;; Reset PV
      (i32.and (get_global $F) (i32.const 0xfb))
      (set_global $F (i32.and (i32.const 0xff)))
    end
  )

  ;; Tail of the ldirx/lddrx operations
  (func $LdrxTail
    (i32.eq (call $getBC) (i32.const 0))
    if return end

    (i32.sub (call $getPC) (i32.const 2))
    call $setPC
    (call $incTacts (i32.const 5))
  )

  ;; ==========================================================================
  ;; Block operations

  ;; ldi (0xa0)
  (func $Ldi
    (call $LdBase (i32.const 1))
    
    ;; Calc PV
    i32.const 0x04
    i32.const 0x00
    (i32.ne (call $getBC) (i32.const 0))
    select

    ;; Merge flags
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )
  
  ;; cpi (0xa1)
  (func $Cpi
    (call $CpBase (i32.const 1))

    ;; Calc PV
    i32.const 0x04
    i32.const 0x00
    (i32.ne (call $getBC) (i32.const 0))
    select

    ;; Merge flags
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))

    call $getHL
    call $setWZ
  )

  ;; ini (0xa2)
  (func $Ini
    (call $InBase (i32.const 1))
  )

  ;; outi (0xa3)
  (func $Outi
    (call $OutBase (i32.const 1))
  )

  ;; ldix (0x0a4)
  (func $Ldix
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    (call $LdxBase (i32.const 1))
  )

  ;; ldws
  (func $Ldws
    (local $v i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    ;; (HL) := (DE)
    call $getDE
    call $getHL
    call $readMemory
    call $writeMemory

    ;; Increment L
    (i32.add (call $getL) (i32.const 1))
    call $setL

    ;; Increment D
    call $getD
    (i32.add (tee_local $v) (i32.const 1))
    call $setD

    ;; Adjust flags
    (i32.add (get_global $INC_FLAGS) (get_local $v))
    i32.load8_u
    (i32.and (get_global $F) (i32.const 0x01))
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ldd (0xa8)
  (func $Ldd
    (call $LdBase (i32.const -1))
    
    ;; Calc PV
    i32.const 0x04
    i32.const 0x00
    (i32.ne (call $getBC) (i32.const 0))
    select

    ;; Merge flags
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; cpd (0xa9)
  (func $Cpd
    (call $CpBase (i32.const -1))

    ;; Calc PV
    i32.const 0x04
    i32.const 0x00
    (i32.ne (call $getBC) (i32.const 0))
    select

    ;; Merge flags
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
    call $getHL
    call $setWZ
  )

  ;; ind (0xaa)
  (func $Ind
    (call $InBase (i32.const -1))
  )

  ;; outd (0xab)
  (func $Outd
    (call $OutBase (i32.const -1))
  )

  ;; lddx (0x0ac)
  (func $Lddx
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    (call $LdxBase (i32.const -1))
  )

  ;; ldir (0xb0)
  (func $Ldir
    (call $LdBase (i32.const 1))
    (set_global $F (i32.and (i32.const 0xff)))
    call $LdrTail
  )

  ;; cpir (0xb1)
  (func $Cpir
    (call $CpBase (i32.const 1))
    (set_global $F (i32.and (i32.const 0xff)))
    call $CprTail
  )

  ;; Inir (0xb2)
  (func $Inir
    (call $InBase (i32.const 1))
    call $IndTail
  )

  ;; Otir (0xb3)
  (func $Otir
    (call $OutBase (i32.const 1))
    call $OutrTail
  )

  ;; ldirx
  (func $Ldirx
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    (call $LdxBase (i32.const 1))
    call $LdrxTail
  )

  ;; ldpirx
  (func $Ldpirx
    (local $memVal i32)
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    ;; Read (HL & 0xfff8 + E & 0x07)
    (i32.and (call $getHL) (i32.const 0xfff8))
    (i32.and (call $getE) (i32.const 0x07))
    i32.add
    call $readMemory
    tee_local $memVal

    ;; Conditional copy
    get_global $A
    i32.ne
    if
      call $getDE
      get_local $memVal
      call $writeMemory
      (call $incTacts (i32.const 2))
    else
      (call $incTacts (i32.const 5))
    end

    ;; Inc DE
    (i32.add (call $getDE) (i32.const 1))
    call $setDE

    ;; Decrement BC
    (i32.sub (call $getBC) (i32.const 1))
    call $setBC
    call $LdrxTail
  )

  ;; lddr (0xb8)
  (func $Lddr
    (call $LdBase (i32.const -1))
    (set_global $F (i32.and (i32.const 0xff)))
    call $LdrTail
  )

  ;; cpdr (0xb9)
  (func $Cpdr
    (call $CpBase (i32.const -1))
    (set_global $F (i32.and (i32.const 0xff)))
    call $CprTail
  )

  ;; Indr (0xba)
  (func $Indr
    (call $InBase (i32.const -1))
    call $IndTail
  )

  ;; Otdr (0xbb)
  (func $Otdr
    (call $OutBase (i32.const -1))
    call $OutrTail
  )

  ;; lddrx
  (func $Lddrx
    (i32.eq (get_global $allowExtendedSet) (i32.const 0))
    if return end

    (call $LdxBase (i32.const -1))
    call $LdrxTail
  )

  ;; ==========================================================================
  ;; Bit operation helpers

  ;; RLC logic - sets flags
  ;; $a: argument
  (func $Rlc (param $a i32) (result i32)
    (local $res i32)
    (i32.shl (get_local $a) (i32.const 1))
    (i32.shr_u (get_local $a) (i32.const 7))
    i32.or
    i32.const 0xff
    i32.and
    set_local $res
    (i32.load8_u (i32.add (get_global $RLC_FLAGS) (get_local $a)))
    (set_global $F (i32.and (i32.const 0xff)))
    get_local $res
  )

  ;; RRC logic - sets flags
  ;; $a: argument
  (func $Rrc (param $a i32) (result i32)
    (local $res i32)
    (i32.shl (get_local $a) (i32.const 7))
    (i32.shr_u (get_local $a) (i32.const 1))
    i32.or
    i32.const 0xff
    i32.and
    set_local $res
    (i32.load8_u (i32.add (get_global $RRC_FLAGS) (get_local $a)))
    (set_global $F (i32.and (i32.const 0xff)))
    get_local $res
  )

  ;; RL logic - sets flags
  ;; $a: argument
  (func $Rl (param $a i32) (result i32)
    (local $c i32)
    (i32.and (get_global $F) (i32.const 0x01))
    tee_local $c
    if (result i32)
      get_global $RL1_FLAGS
    else
      get_global $RL0_FLAGS
    end
    get_local $a
    i32.add
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))
    (i32.shl (get_local $a) (i32.const 1))
    get_local $c
    i32.or
  )

  ;; RR logic - sets flags
  ;; $a: argument
  (func $Rr (param $a i32) (result i32)
    (local $c i32)
    (i32.and (get_global $F) (i32.const 0x01))
    i32.const 7
    i32.shl
    tee_local $c
    if (result i32)
      get_global $RR1_FLAGS
    else
      get_global $RR0_FLAGS
    end
    get_local $a
    i32.add
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))
    (i32.shr_u (get_local $a) (i32.const 1))
    get_local $c
    i32.or
  )

  ;; SLA logic - sets flags
  ;; $a: argument
  (func $Sla (param $a i32) (result i32)
    (i32.add (get_global $RL0_FLAGS) (get_local $a))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))
    (i32.shl (get_local $a) (i32.const 1))
  )

  ;; SRA logic - sets flags
  ;; $a: argument
  (func $Sra (param $a i32) (result i32)
    (i32.add (get_global $SRA_FLAGS) (get_local $a))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))

    (i32.shr_u (get_local $a) (i32.const 1))
    (i32.and (get_local $a) (i32.const 0x80))
    i32.or
  )

  ;; SLL logic - sets flags
  ;; $a: argument
  (func $Sll (param $a i32) (result i32)
    (i32.add (get_global $RL1_FLAGS) (get_local $a))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))

    (i32.shl (get_local $a) (i32.const 1))
    i32.const 1
    i32.or
  )

  ;; SRL logic - sets flags
  ;; $a: argument
  (func $Srl (param $a i32) (result i32)
    (i32.add (get_global $RR0_FLAGS) (get_local $a))
    i32.load8_u
    (set_global $F (i32.and (i32.const 0xff)))

    (i32.shr_u (get_local $a) (i32.const 1))
  )

  ;; Bit logic - sets flags
  ;; $a: argument
  ;; $n: bit index
  (func $Bit (param $a i32) (param $n i32)
    (local $val i32)
    get_local $a
    (i32.shl (i32.const 0x01) (get_local $n))
    i32.and
    tee_local $val

    ;; Z and PV
    if (result i32) ;; (Z|PV|S)
      i32.const 0x80
      i32.const 0x00
      (i32.eq (get_local $n) (i32.const 7))
      select
    else
      i32.const 0x44
    end

    ;; Keep C
    (i32.and (get_global $F) (i32.const 0x01))
    (i32.and (get_local $val) (i32.const 0x28)) ;; (Z|PV|S, C, R3|R5)
    i32.const 0x10 ;; (Z|PV|S, C, R3|R5, H)

    ;; Merge flags
    i32.or
    i32.or
    i32.or
    (set_global $F (i32.and (i32.const 0xff)))
  )

  ;; ==========================================================================
  ;; Bit operations

  ;; Bop Q
  (func $BopQ
    (local $q i32)
    (tee_local $q (i32.and (get_global $opCode) (i32.const 0x07)))
    get_local $q
    call $getReg8

    ;; Call the bit operation
    get_global $BOP_JT
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    i32.add
    call_indirect (type $BitOpFunc)

    ;; Store result
    call $setReg8
  )

  ;; Bop (hl)
  (func $BopHLi
    call $getHL
    call $getHL
    call $readMemory
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (call $getHL))
      (call $incTacts (i32.const 1))
    end

    ;; Call the bit operation
    get_global $BOP_JT
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    i32.add
    call_indirect (type $BitOpFunc)

    ;; Store the result
    call $writeMemory
  )

  ;; Bit N,Q (0x40-7f)
  (func $BitNQ
    (i32.and (get_global $opCode) (i32.const 0x07)) ;;
    call $getReg8
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    call $Bit
  )

  ;; bit N,(hl)
  (func $BitNHLi
    call $getHL
    call $readMemory
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    call $Bit

    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      (call $memoryDelay (call $getHL))
    end
    (call $incTacts (i32.const 1))
  )

  ;; res N,Q (0x80-bf)
  (func $ResNQ
    (local $q i32)
    (i32.and (get_global $opCode) (i32.const 0x07))
    tee_local $q  ;; (Q)
    get_local $q
    call $getReg8 ;; (Q,regQ)

    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.const 0xff
    i32.xor
    i32.and
    call $setReg8
  )

  ;; res N,(hl)
  (func $ResNHLi
    call $getHL
    call $getHL
    call $readMemory

    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.const 0xff
    i32.xor
    i32.and
    call $writeMemory

    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (call $getHL))
      (call $incTacts (i32.const 1))
    end
  )

  ;; set N,Q (0xc0-ff)
  (func $SetNQ
    (local $q i32)
    (i32.and (get_global $opCode) (i32.const 0x07))
    tee_local $q  ;; (Q)
    get_local $q
    call $getReg8 ;; (Q,regQ)

    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.or
    call $setReg8
  )

  ;; set N,(hl)
  (func $SetNHLi
    call $getHL
    call $getHL
    call $readMemory

    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.or
    call $writeMemory

    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (call $getHL))
      (call $incTacts (i32.const 1))
    end
  )

  ;; ==========================================================================
  ;; Indexed bit operations

  ;; rlc (ix+d),Q
  (func $XBopQ (param $addr i32)
    (local $q i32)
    (local $res i32)
    (i32.and (get_global $opCode) (i32.const 0x07))
    set_local $q

    ;; Read the operand
    get_local $addr
    call $readMemory

    ;; Adjust tacts
    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      (call $memoryDelay (get_local $addr))
    end
    (call $incTacts (i32.const 1))
    

    ;; Get the type of operation
    get_global $BOP_JT
    (i32.shr_u
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    i32.add
    call_indirect (type $BitOpFunc)
    set_local $res

    ;; Write back to memory
    get_local $addr
    get_local $res
    call $writeMemory

    ;; Store conditionally to reg
    (i32.ne (get_local $q) (i32.const 6))
    if
      (call $setReg8 (get_local $q) (get_local $res))
    end
  )

  ;; bit (ix+d),Q
  (func $XBitNQ (param $addr i32)
    get_local $addr
    call $readMemory
    (i32.shr_u 
      (i32.and (get_global $opCode) (i32.const 0x38))
      (i32.const 3)
    )
    call $Bit

    (i32.eq (get_global $useGateArrayContention) (i32.const 0))
    if
      (call $memoryDelay (call $getHL))
    end
    (call $incTacts (i32.const 1))
  )

  ;; res (ix+d),Q
  (func $XResNQ (param $addr i32)
    (local $q i32)
    (local $res i32)
    get_local $addr
    get_local $addr
    call $readMemory
    
    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.const 0xff
    i32.xor
    i32.and
    tee_local $res
    call $writeMemory
    
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (call $getHL))
      (call $incTacts (i32.const 1))
    end

    (i32.and (get_global $opCode) (i32.const 0x07))
    (i32.ne (tee_local $q) (i32.const 6))
    if
      (call $setReg8 (get_local $q) (get_local $res))
    end
  )

  ;; set (ix+d),Q
  (func $XSetNQ (param $addr i32)
    (local $q i32)
    (local $res i32)
    get_local $addr
    get_local $addr
    call $readMemory
    (i32.shl 
      (i32.const 1)
      (i32.shr_u
        (i32.and (get_global $opCode) (i32.const 0x38))
        (i32.const 3)
      )
    )
    i32.or
    tee_local $res
    call $writeMemory
    get_global $useGateArrayContention
    if
      (call $incTacts (i32.const 1))
    else
      (call $memoryDelay (call $getHL))
      (call $incTacts (i32.const 1))
    end

    (i32.and (get_global $opCode) (i32.const 0x07))
    (i32.ne (tee_local $q) (i32.const 6))
    if
      (call $setReg8 (get_local $q) (get_local $res))
    end
  )

  ;; ==========================================================================
  ;; ZX Spectrum engine core
  ;; ==========================================================================
  ;; ZX Spectrum configuration
  
  ;; Base CPU clock frequency
  (global $baseClockFrequency (mut i32) (i32.const 0x0000))

  ;; Clock frequency multiplier
  (global $clockMultiplier (mut i32) (i32.const 0x0000))

  ;; Supports ZX Spectrrum Next operations?
  (global $supportsNextOperation (mut i32) (i32.const 0x0000))

  ;; Number of ROMs
  (global $numberOfRoms (mut i32) (i32.const 0x0000))

  ;; The address in memory where the machine's ROM contents start
  (global $romContentsAddress (mut i32) (i32.const 0x0000))

  ;; The index of the ROM with ZX Spectrum 48 code
  (global $spectrum48RomIndex (mut i32) (i32.const 0x0000))

  ;; Contention type of memory
  ;; 0: No contention
  ;; 1: ULA
  ;; 2: GateArray
  ;; 3: ZX Spectrum Next
  (global $contentionType (mut i32) (i32.const 0x0000))

  ;; Number of RAM banks
  (global $ramBanks (mut i32) (i32.const 0x0000))

  ;; Size of Next memory in KBytes
  ;; 0 - Legacy models that do not support Next memory mapping
  ;; 512 - 512KBytes
  ;; 1024 - 1024 KBytes
  ;; 1536 - 1.5MBytes
  ;; 2048 - 2 MBytes
  (global $nextMemorySize (mut i32) (i32.const 0x0000))

  ;; The tact index of the interrupt relative to the top-left screen pixel
  (global $interruptTact (mut i32) (i32.const 0x0000))

  ;; Number of lines used for vertical sync
  (global $verticalSyncLines (mut i32) (i32.const 0x0000))

  ;; The number of top border lines that are not visible when rendering the screen
  (global $nonVisibleBorderTopLines (mut i32) (i32.const 0x0000))

  ;; The number of border lines before the display
  (global $borderTopLines (mut i32) (i32.const 0x0000))

  ;; Number of display lines
  (global $displayLines (mut i32) (i32.const 0x0000))

  ;; The number of border lines after the display
  (global $borderBottomLines (mut i32) (i32.const 0x0000))

  ;; The number of bottom border lines that are not visible when rendering the screen
  (global $nonVisibleBorderBottomLines (mut i32) (i32.const 0x0000))

  ;; Horizontal blanking time (HSync+blanking). Given in Z80 clock cycles.
  (global $horizontalBlankingTime (mut i32) (i32.const 0x0000))

  ;; The time of displaying left part of the border. Given in Z80 clock cycles.
  (global $borderLeftTime (mut i32) (i32.const 0x0000))

  ;; The time of displaying a pixel row. Given in Z80 clock cycles.
  (global $displayLineTime (mut i32) (i32.const 0x0000))

  ;; The time of displaying right part of the border. Given in Z80 clock cycles.
  (global $borderRightTime (mut i32) (i32.const 0x0000))

  ;; The time used to render the nonvisible right part of the border. Given in Z80 clock cycles.
  (global $nonVisibleBorderRightTime (mut i32) (i32.const 0x0000))

  ;; The time the data of a particular pixel should be prefetched before displaying it.
  ;; Given in Z80 clock cycles.
  (global $pixelDataPrefetchTime (mut i32) (i32.const 0x0000))

  ;; The time the data of a particular pixel attribute should be prefetched before displaying it.
  ;; Given in Z80 clock cycles.
  (global $attributeDataPrefetchTime (mut i32) (i32.const 0x0000))

  ;; Total number of screen lines
  (global $screenLines (mut i32) (i32.const 0x0000))

  ;; First visible display line
  (global $firstDisplayLine (mut i32) (i32.const 0x0000))

  ;; Last visible display line
  (global $lastDisplayLine (mut i32) (i32.const 0x0000))

  ;; Number of pixels in the left border
  (global $borderLeftPixels (mut i32) (i32.const 0x0000))

  ;; Number of pixels in the right border
  (global $borderRightPixels (mut i32) (i32.const 0x0000))

  ;; Width of display in pixels
  (global $displayWidth (mut i32) (i32.const 0x0000))

  ;; Total width of the screen
  (global $screenWidth (mut i32) (i32.const 0x0000))

  ;; Total time of a screen line
  (global $screenLineTime (mut i32) (i32.const 0x0000))

  ;; Total number of raster lines (including the non-visible ones)
  (global $rasterLines (mut i32) (i32.const 0x0000))

  ;; The tact in which the top left pixel should be displayed. Given in Z80 clock cycles.
  (global $firstDisplayPixelTact (mut i32) (i32.const 0x0000))

  ;; The tact at which the first pixel is displayed
  (global $firstScreenPixelTact (mut i32) (i32.const 0x0000))
  
  ;; ==========================================================================
  ;; ZX Spectrum execution engine state

  ;; The ULA issue of the engine
  (global $ulaIssue (mut i32) (i32.const 0x0000))

  ;; The last rendered ULA tact
  (global $lastRenderedUlaTact (mut i32) (i32.const 0x0000))

  ;; Number of frames rendered
  (global $frameCount (mut i32) (i32.const 0x0000))

  ;; Indicates that a screen frame has just completed
  (global $frameCompleted (mut i32) (i32.const 0x0000))

  ;; Gets or sets the value of the contention accummulated since the start
  ;; of the machine
  (global $contentionAccummulated (mut i32) (i32.const 0x0000))

  ;; Gets the value of the contention accummulated since the last execution
  ;; cycle started
  (global $lastExecutionContentionValue (mut i32) (i32.const 0x0000))

  ;; The emulation mode to use with the execution cycle
  ;; 0: Debugger
  ;; 1: UntilHalt
  ;; 2: UntilCpuFrameEnds
  ;; 3: UntilUlaFrameEnds
  ;; 4: UntilExecutionPoint
  (global $emulationMode (mut i32) (i32.const 0x0000))

  ;; The debug step mode to use with the execution cycle
  ;; (only when $emulationMode is Debugger)
  ;; 0: StopAtBreakPoints
  ;; 1: StepInto
  ;; 2: StepOver
  ;; 3: StepOut
  (global $debugStepMode (mut i32) (i32.const 0x0000))

  ;; Indicates if fast tape mode is allowed
  (global $fastTapeMode (mut i32) (i32.const 0x0000))

  ;; The index of the ROM when a termination point is defined
  (global $terminationRom (mut i32) (i32.const 0x0000))

  ;; The value of the PC register to reach when a termination point 
  ;; is defined
  (global $terminationPoint (mut i32) (i32.const 0x0000))

  ;; This flag shows that the virtual machine should run in hidden mode
  ;; (no screen, no sound, no delays)
  (global $fastVmMode (mut i32) (i32.const 0x0000))

  ;; This flag shows whether the virtual machine should render the screen.
  ;; True, renders the screen; false, does not render the screen.
  ;; This flag overrides the $fastVmMode setting.
  (global $disableScreenRendering (mut i32) (i32.const 0x0000))

  ;; The reason the execution cycle completed.
  ;; 0: The machine is still executing
  ;; 1: Termination point reached
  ;; 2: Breakpoint reached
  ;; 3: Halted
  ;; 4: CPU frame completed
  ;; 5: Screen rendering frame/ULA frame completed
  (global $executionCompletionReason (mut i32) (i32.const 0x0000))

  ;; ==========================================================================
  ;; Port device state

  ;; Last value of bit 3 on port $FE
  (global $portBit3LastValue (mut i32) (i32.const 0x0000))

  ;; Last value of bit 4 on port $FE
  (global $portBit4LastValue (mut i32) (i32.const 0x0000))

  ;; Tacts value when last time bit 4 of $fe changed from 0 to 1
  (global $portBit4ChangedFrom0Tacts (mut i32) (i32.const 0x0000))

  ;; Tacts value when last time bit 4 of $fe changed from 1 to 0
  (global $portBit4ChangedFrom1Tacts (mut i32) (i32.const 0x0000))

  ;; ==========================================================================
  ;; Interrupt device state

  ;; Signs that an interrupt has been raised in the current frame.
  (global $interruptRaised (mut i32) (i32.const 0x0000))

  ;; Signs that the interrupt request has been revoked.
  (global $interruptRevoked (mut i32) (i32.const 0x0000))

  ;; ==========================================================================
  ;; Screen device state

  ;; The current border color
  (global $borderColor (mut i32) (i32.const 0x0000))

  ;; The current flash phase (normal/inverse)
  (global $flashPhase (mut i32) (i32.const 0x0000))

  ;; Pixel byte #1 read by ULA
  (global $pixelByte1 (mut i32) (i32.const 0x0000))

  ;; Pixel byte #2 read by ULA
  (global $pixelByte2 (mut i32) (i32.const 0x0000))

  ;; Attribute byte #1 read by ULA
  (global $attrByte1 (mut i32) (i32.const 0x0000))

  ;; Attribute byte #2 read by ULA
  (global $attrByte2 (mut i32) (i32.const 0x0000))

  ;; Number of flash frames
  (global $flashFrames (mut i32) (i32.const 0x0000))

  ;; Pointer to the next tact in the rendering table
  (global $renderingTablePtr (mut i32) (i32.const 0x0000))

  ;; Pointer to the next pixel in the rendering buffet
  (global $pixelBufferPtr (mut i32) (i32.const 0x0000))

  ;; ==========================================================================
  ;; Beeper device state

  ;; Sample rate of the beeper audio
  (global $beeperSampleRate (mut i32) (i32.const 0x0000))

  ;; Sample length (lower) in CPU clock tacts
  (global $beeperSampleLength (mut i32) (i32.const 0x0000))

  ;; Lower gate for sample length
  (global $beeperLowerGate (mut i32) (i32.const 0x0000))

  ;; Upper gate for sample length
  (global $beeperUpperGate (mut i32) (i32.const 0x0000))

  ;; Current beeper gate value
  (global $beeperGateValue (mut i32) (i32.const 0x0000))

  ;; Tact value of the last sample
  (global $beeperNextSampleTact (mut i32) (i32.const 0x0000))

  ;; Last EAR bit value
  (global $beeperLastEarBit (mut i32) (i32.const 0x0000))

  ;; Count of samples in this frame
  (global $beeperSampleCount (mut i32) (i32.const 0x0000))


  ;; ==========================================================================
  ;; Public functions to manage a ZX Spectrum machine

  ;; Transfer area for the ZX Spectrum execution cycle options
  (global $EXEC_OPTIONS_BUFF i32 (i32.const 0x01_1900))

  ;; Start address of keyboard line status
  (global $KEYBOARD_LINES i32 (i32.const 0x1_5D00))

  ;; Rendering tact table
  ;; Each table entry has 5 bytes:
  ;; Byte 0: 
  ;;   Bit 4..0: Rendering phase
  ;;     0x00: None. The ULA does not do any rendering.
  ;;     0x04: Border. The ULA sets the border color to display the current pixel.
  ;;     0x05: BorderFetchPixel. The ULA sets the border color to display the
  ;;           current pixel. It prepares to display the fist pixel in the row
  ;;           with pre-fetching the corresponding byte from the display memory.
  ;;     0x06: BorderFetchAttr. The ULA sets the border color to display the
  ;;           current pixel. It has already fetched the 8 pixel bits to display.
  ;;           It carries on preparing to display the fist pixel in the row with
  ;;           pre-fetching the corresponding attribute byte from the display memory.
  ;;     0x08: DisplayB1. The ULA displays the next two pixels of Byte1 sequentially
  ;;           during a single Z80 clock cycle.
  ;;     0x09: DisplayB1FetchB2. The ULA displays the next two pixels of Byte1
  ;;           sequentially during a single Z80 clock cycle. It prepares to display
  ;;           the pixels of the next byte in the row with pre-fetching the
  ;;           corresponding byte from the display memory.
  ;;     0x0a: DisplayB1FetchA2. The ULA displays the next two pixels of Byte1
  ;;           sequentially during a single Z80 clock cycle. It prepares to display
  ;;           the pixels of the next byte in the row with pre-fetching the
  ;;           corresponding attribute from the display memory.
  ;;     0x10: DisplayB2. The ULA displays the next two pixels of Byte2 sequentially
  ;;           during a single Z80 clock cycle.
  ;;     0x11: DisplayB2FetchB1. The ULA displays the next two pixels of Byte2
  ;;           sequentially during a single Z80 clock cycle. It prepares to display
  ;;           the pixels of the next byte in the row with pre-fetching the
  ;;           corresponding byte from the display memory.
  ;;     0x12: DisplayB2FetchA1. The ULA displays the next two pixels of Byte2
  ;;           sequentially during a single Z80 clock cycle. It prepares to display
  ;;           the pixels of the next byte in the row with pre-fetching the
  ;;           corresponding attribute from the display memory.
  ;;   Bit 7..5: Tact contention value
  ;; Byte 1..2: Pixel address
  ;; Byte 3..4: Attribute address
  (global $RENDERING_TACT_TABLE i32 (i32.const 0x01_5E00))

  ;; Rendering tact contention values
  (global $CONTENTION_TABLE i32 (i32.const 0x07_5E00))

  ;; Initializes a ZX Spectrum machine with the specified type
  ;; $type: Machine type
  ;;   0: ZX Spectrum 48K
  ;;   1: ZX Spectrum 128K
  ;;   2: ZX Spectrum 3+
  ;;   3: ZX Spectrum Next
  ;; $edition: Machine edition (ignored, as of now)
  (func $initZxSpectrum (param $type i32) (param $edition i32)
    ;; Store machine type
    (i32.gt_u (get_local $type) (i32.const 3))
    if (result i32)
      i32.const 0
    else
      get_local $type
    end
    set_global $MACHINE_TYPE

    call $setupMachine
  )

  ;; Turns on the ZX Spectrum machine
  (func $turnOnMachine)

  ;; Resets the ZX Spectrum machine
  (func $resetMachine
    call $resetCpu

    ;; Reset engine state variables
    i32.const 0 set_global $lastRenderedUlaTact
    i32.const 0 set_global $frameCount
    i32.const 0 set_global $tacts
    i32.const 1 set_global $frameCompleted
    i32.const 0 set_global $contentionAccummulated
    i32.const 0 set_global $lastExecutionContentionValue
    i32.const 0 set_global $emulationMode
    i32.const 0 set_global $debugStepMode
    i32.const 0 set_global $fastTapeMode
    i32.const -1 set_global $terminationRom
    i32.const -1 set_global $terminationPoint
    i32.const 0 set_global $fastVmMode
    i32.const 0 set_global $disableScreenRendering
    i32.const 0 set_global $executionCompletionReason

    ;; Reset keyboard line status
    (i32.store offset=0 (get_global $KEYBOARD_LINES) (i32.const 0))
    (i32.store offset=4 (get_global $KEYBOARD_LINES) (i32.const 0))

    ;; Reset port state
    i32.const 0 set_global $portBit3LastValue
    i32.const 0 set_global $portBit4LastValue
    i32.const 0 set_global $portBit4ChangedFrom0Tacts
    i32.const 0 set_global $portBit4ChangedFrom1Tacts

    ;; Reset interrupt state
    i32.const 0 set_global $interruptRaised
    i32.const 0 set_global $interruptRevoked

    ;; Reset beeper state
    i32.const 0 set_global $beeperGateValue
    i32.const 0 set_global $beeperNextSampleTact
    i32.const 0 set_global $beeperLastEarBit
   )

  ;; Sets the ULA issue to use
  (func $setUlaIssue (param $ula i32)
    i32.const 0x02
    i32.const 0x03
    (i32.eq (get_local $ula) (i32.const 2))
    select
    set_global $ulaIssue
  )

  ;; Writes the ZX Spectrum machine state to the transfer area
  (func $getMachineState
    ;; Start with CPU state
    call $getCpuState
    call $getCommonSpectrumMachineState
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 8)
    )
    call_indirect (type $ActionFunc)
  )

  ;; Copies exeution options from the transfer area
  (func $setExecutionOptions
    (i32.load8_u offset=0 (get_global $STATE_TRANSFER_BUFF)) set_global $emulationMode
    (i32.load8_u offset=1 (get_global $STATE_TRANSFER_BUFF)) set_global $debugStepMode
    (i32.load8_u offset=2 (get_global $STATE_TRANSFER_BUFF)) set_global $fastTapeMode
    (i32.load8_u offset=3 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationRom
    (i32.load16_u offset=4 (get_global $STATE_TRANSFER_BUFF)) set_global $terminationPoint
    (i32.load8_u offset=6 (get_global $STATE_TRANSFER_BUFF)) set_global $fastVmMode
    (i32.load8_u offset=7 (get_global $STATE_TRANSFER_BUFF)) set_global $disableScreenRendering
  )

  ;; Executes the ZX Spectrum machine cycle
  (func $executeMachineCycle
    (local $currentUlaTact i32)

    ;; Initialize the execution cycle
    i32.const 0 set_global $executionCompletionReason
    get_global $contentionAccummulated set_global $lastExecutionContentionValue


    ;; The physical frame cycle that goes on while CPU and ULA
    ;; processes everything within a screen rendering frame
    loop $frameCycle
      ;; Check if we're just about starting the next frame
      get_global $frameCompleted
      if
        ;; Reset frame information
        (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
        set_global $lastRenderedUlaTact

        ;; Reset interrupt information
        i32.const 0 set_global $interruptRevoked
        i32.const 0 set_global $interruptRaised

        ;; Reset pointers used for screen rendering
        (i32.add
          (get_global $RENDERING_TACT_TABLE)
          (i32.mul (get_global $lastRenderedUlaTact) (i32.const 5))
        )
        set_global $renderingTablePtr

        get_global $PIXEL_RENDERING_BUFFER set_global $pixelBufferPtr
        i32.const 0 set_global $frameCompleted

        ;; Calculate flash phase
        (i32.rem_u (get_global $frameCount) (get_global $flashFrames))
        i32.eqz
        if
          (i32.xor (get_global $flashPhase) (i32.const 0x01))
          set_global $flashPhase
        end

        ;; Reset beeper frame state and create samples
        i32.const 0 set_global $beeperSampleCount
        call $createEarBitSamples

        call $startNewFrame
      end

      ;; Calculate the current frame tact
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))

      ;; Take care of raising the interrupt
      (call $checkForInterrupt (tee_local $currentUlaTact))
      call $executeCpuCycle

      call $getPC
      i32.const 0x12a9
      i32.eq
      if
        i32.const 444444
        call $trace
        call $getAF
        call $trace
        call $getBC
        call $trace
        call $getDE
        call $trace
        call $getHL
        call $trace
      end

      ;; Execute an entire instruction
      loop $instructionLoop
        get_global $isInOpExecution
        if
          call $executeCpuCycle

          call $getPC
          i32.const 0x12a9
          i32.eq
          if
            i32.const 444444
            call $trace
            call $getAF
            call $trace
            call $getBC
            call $trace
            call $getDE
            call $trace
            call $getHL
            call $trace
          end

          br $instructionLoop
        end
      end 

      ;; TODO: Check various terminations

      ;; Render the screen
      (call $renderScreen (get_local $currentUlaTact))

      ;; Exit if if halted and execution mode is UntilHalted
      (i32.eq (get_global $emulationMode) (i32.const 1))
      if
        (i32.and (get_global $stateFlags) (i32.const 0x08)) ;; HLT signal set?
        if
          i32.const 3 set_global $executionCompletionReason ;; Reason: halted
          return
        end
      end     

      ;; Notify the tape device to check tape hooks
      call $checkTapeHooks

      ;; Test frame completion
      (i32.ge_u (get_local $currentUlaTact) (get_global $tactsInFrame))
      set_global $frameCompleted
      (br_if $frameCycle (i32.eq (get_global $frameCompleted) (i32.const 0)))
    end

    ;; The current screen rendering frame completed
    ;; Create the missing beeper samples
    call $createEarBitSamples

    ;; Prepare for the next beeper sample rate
    (i32.ge_u (get_global $beeperNextSampleTact) (get_global $tacts))
    if
      (i32.sub 
        (get_global $beeperNextSampleTact)
        (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
      )
      set_global $beeperNextSampleTact
    end

    ;; Adjust tacts
    (i32.sub 
      (get_global $tacts)
      (i32.mul (get_global $tactsInFrame) (get_global $clockMultiplier))
    )
    set_global $tacts

    (i32.add (get_global $frameCount) (i32.const 1))
    set_global $frameCount

    ;; Sign frame completion
    call $completeFrame
    i32.const 5 set_global $executionCompletionReason ;; Reason: frame completed
  )

  ;; Sets the status of the specified key
  (func $setKeyStatus (param $keyCode i32) (param $isDown i32)
    (local $line i32)
    (local $mask i32)

    ;; Ignore invalid key codes
    (i32.gt_u (get_local $keyCode) (i32.const 39))
    if return end

    ;; Calculate line address
    (i32.add 
      (get_global $KEYBOARD_LINES)
      (i32.div_u (get_local $keyCode) (i32.const 5))
    )
    set_local $line

    ;; Calculate line mask
    (i32.shl 
      (i32.const 1)
      (i32.rem_u (get_local $keyCode) (i32.const 5))
    )
    set_local $mask

    get_local $isDown
    if
      ;; Key is down
      get_local $line
      (i32.load8_u (get_local $line))
      get_local $mask
      i32.or
      i32.store8
    else
      get_local $line
      (i32.load8_u (get_local $line))
      get_local $mask
      i32.const 0xff
      i32.xor
      i32.and
      i32.store8
    end
  )

  ;; Gets the status of the specified key
  (func $getKeyStatus (param $keyCode i32) (result i32)
    ;; Ignore invalid key codes
    (i32.gt_u (get_local $keyCode) (i32.const 39))
    if 
      i32.const 0
      return
    end

    ;; Get line value
    (i32.add 
      (get_global $KEYBOARD_LINES)
      (i32.div_u (get_local $keyCode) (i32.const 5))
    )
    i32.load8_u

    ;; Calculate line mask
    (i32.shl 
      (i32.const 1)
      (i32.rem_u (get_local $keyCode) (i32.const 5))
    )

    ;; Return the result
    i32.and
  )

  ;; Gets the byte we would get when querying the I/O address with the
  ;; specified byte as the highest 8 bits of the address line
  ;; $line: The highest 8 bits of the address line
  ;; Returns the status value to be received when querying the I/O
  (func $getKeyLineStatus (param $line i32) (result i32)
    (local $status i32)
    (local $lineIndex i32)
    ;; Init query loop
    (i32.xor (get_local $line) (i32.const 0xff))
    set_local $line
    i32.const 0 set_local $status
    i32.const 0 set_local $lineIndex

    ;; Iterate through all lines
    loop $lineLoop
      (i32.gt_u (get_local $line) (i32.const 0))
      if
        (i32.and (get_local $line) (i32.const 0x01))
        if
          (i32.add (get_global $KEYBOARD_LINES) (get_local $lineIndex))
          i32.load8_u
          get_local $status
          i32.or
          set_local $status
        end
        ;; Update for next iteration
        (i32.add (get_local $lineIndex) (i32.const 1))
        set_local $lineIndex
        (i32.shr_u (get_local $line) (i32.const 1))
        set_local $line
        br $lineLoop
      end
    end
    get_local $status
    i32.const 0xff
    i32.xor
  )

  ;; Sets the interrupt tact for test purposes
  (func $setInterruptTact (param $tact i32)
    get_local $tact set_global $interruptTact
  )

  ;; ==========================================================================
  ;; Helper functions to manage a ZX Spectrum machine

  ;; Sets up the ZX Spectrum machine
  (func $setupMachine 
    ;; Let's use ULA issue 3 by default
    i32.const 3 set_global $ulaIssue

    call $resetMachine

    ;; Invoke machine type specific setup
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 7)
    )
    call_indirect (type $ActionFunc)
  )

  ;; Calculates extra screen attributes from screen configuration parameters
  (func $calcScreenAttributes
    (i32.add 
      (i32.add (get_global $borderTopLines) (get_global $displayLines))
      (get_global $borderBottomLines)
    )
    set_global $screenLines

    (i32.add 
      (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
      (get_global $borderTopLines)
    )
    set_global $firstDisplayLine

    (i32.sub
      (i32.add (get_global $firstDisplayLine) (get_global $displayLines))
      (i32.const 1)
    )
    set_global $lastDisplayLine

    (i32.mul (i32.const 2) (get_global $borderLeftTime))
    set_global $borderLeftPixels

    (i32.mul (i32.const 2) (get_global $borderRightTime))
    set_global $borderRightPixels

    (i32.mul (i32.const 2) (get_global $displayLineTime))
    set_global $displayWidth

    (i32.add 
      (i32.add (get_global $borderLeftPixels) (get_global $displayWidth))
      (get_global $borderRightPixels)
    )
    set_global $screenWidth

    (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
    (i32.add (get_global $borderRightTime) (get_global $nonVisibleBorderRightTime))
    get_global $horizontalBlankingTime
    i32.add
    i32.add
    set_global $screenLineTime

    (i32.add (get_global $firstDisplayLine) (get_global $displayLines))
    (i32.add (get_global $borderBottomLines) (get_global $nonVisibleBorderBottomLines))
    i32.add
    set_global $rasterLines

    (i32.mul (get_global $rasterLines) (get_global $screenLineTime))
    set_global $tactsInFrame

    (i32.add 
      (i32.mul (get_global $firstDisplayLine) (get_global $screenLineTime))
      (get_global $borderLeftTime)
    )
    set_global $firstDisplayPixelTact

    (i32.mul
      (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
      (get_global $screenLineTime)
    )
    set_global $firstScreenPixelTact

    (f32.div 
      (f32.div 
        (f32.convert_u/i32 (get_global $baseClockFrequency)) 
        (f32.convert_u/i32 (get_global $tactsInFrame))
      )
      (f32.const 2.0)
    )
    i32.trunc_u/f32
    set_global $flashFrames
  )

  ;; Gets the ZX Spectrum 48 machine state
  (func $getCommonSpectrumMachineState
    ;; CPU configuration
    (i32.store offset=48 (get_global $STATE_TRANSFER_BUFF) (get_global $baseClockFrequency))      
    (i32.store8 offset=52 (get_global $STATE_TRANSFER_BUFF) (get_global $clockMultiplier))      
    (i32.store8 offset=53 (get_global $STATE_TRANSFER_BUFF) (get_global $supportsNextOperation))      

    ;; Memory configuration
    (i32.store8 offset=54 (get_global $STATE_TRANSFER_BUFF) (get_global $numberOfRoms))      
    (i32.store offset=55 (get_global $STATE_TRANSFER_BUFF) (get_global $romContentsAddress))      
    (i32.store8 offset=59 (get_global $STATE_TRANSFER_BUFF) (get_global $spectrum48RomIndex))      
    (i32.store8 offset=60 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionType))      
    (i32.store8 offset=61 (get_global $STATE_TRANSFER_BUFF) (get_global $ramBanks))      
    (i32.store8 offset=62 (get_global $STATE_TRANSFER_BUFF) (get_global $nextMemorySize))

    ;; Screen frame configuration
    (i32.store16 offset=63 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptTact))      
    (i32.store16 offset=65 (get_global $STATE_TRANSFER_BUFF) (get_global $verticalSyncLines))      
    (i32.store16 offset=67 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderTopLines))      
    (i32.store16 offset=69 (get_global $STATE_TRANSFER_BUFF) (get_global $borderTopLines))      
    (i32.store16 offset=71 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLines))      
    (i32.store16 offset=73 (get_global $STATE_TRANSFER_BUFF) (get_global $borderBottomLines))      
    (i32.store16 offset=75 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderBottomLines))      
    (i32.store16 offset=77 (get_global $STATE_TRANSFER_BUFF) (get_global $horizontalBlankingTime))      
    (i32.store16 offset=79 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftTime))      
    (i32.store16 offset=81 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLineTime))      
    (i32.store16 offset=83 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightTime))      
    (i32.store16 offset=85 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderRightTime))      
    (i32.store16 offset=87 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelDataPrefetchTime))      
    (i32.store16 offset=89 (get_global $STATE_TRANSFER_BUFF) (get_global $attributeDataPrefetchTime))      

    ;; Calculated screen attributes
    (i32.store offset=91 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLines))      
    (i32.store offset=95 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayLine))
    (i32.store offset=99 (get_global $STATE_TRANSFER_BUFF) (get_global $lastDisplayLine))
    (i32.store offset=103 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftPixels))      
    (i32.store offset=107 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightPixels))      
    (i32.store offset=111 (get_global $STATE_TRANSFER_BUFF) (get_global $displayWidth))      
    (i32.store offset=115 (get_global $STATE_TRANSFER_BUFF) (get_global $screenWidth))      
    (i32.store offset=119 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLineTime))      
    (i32.store offset=123 (get_global $STATE_TRANSFER_BUFF) (get_global $rasterLines))      
    (i32.store offset=127 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayPixelTact))      
    (i32.store offset=131 (get_global $STATE_TRANSFER_BUFF) (get_global $firstScreenPixelTact))

    ;; ZX Spectrum engine state
    (i32.store8 offset=135 (get_global $STATE_TRANSFER_BUFF) (get_global $ulaIssue))
    (i32.store offset=136 (get_global $STATE_TRANSFER_BUFF) (get_global $lastRenderedUlaTact))
    (i32.store offset=140 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCount))
    (i32.store8 offset=144 (get_global $STATE_TRANSFER_BUFF) (get_global $frameCompleted))
    (i32.store offset=145 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionAccummulated))
    (i32.store offset=149 (get_global $STATE_TRANSFER_BUFF) (get_global $lastExecutionContentionValue))
    (i32.store8 offset=153 (get_global $STATE_TRANSFER_BUFF) (get_global $emulationMode))
    (i32.store8 offset=154 (get_global $STATE_TRANSFER_BUFF) (get_global $debugStepMode))
    (i32.store8 offset=155 (get_global $STATE_TRANSFER_BUFF) (get_global $fastTapeMode))
    (i32.store8 offset=156 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationRom))
    (i32.store16 offset=157 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationPoint))
    (i32.store8 offset=159 (get_global $STATE_TRANSFER_BUFF) (get_global $fastVmMode))
    (i32.store8 offset=160 (get_global $STATE_TRANSFER_BUFF) (get_global $disableScreenRendering))
    (i32.store8 offset=161 (get_global $STATE_TRANSFER_BUFF) (get_global $executionCompletionReason))

    ;; Keyboard lines
    (i32.store offset=162 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=0 (get_global $KEYBOARD_LINES)))
    (i32.store offset=166 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=4 (get_global $KEYBOARD_LINES)))

    ;; Port state
    (i32.store8 offset=170 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit3LastValue))
    (i32.store8 offset=171 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4LastValue))
    (i32.store offset=172 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom0Tacts))
    (i32.store offset=176 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom1Tacts))

    ;; Interrupt state
    (i32.store8 offset=180 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRaised))
    (i32.store8 offset=181 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRevoked))

    ;; Screen state
    (i32.store8 offset=182 (get_global $STATE_TRANSFER_BUFF) (get_global $borderColor))
    (i32.store8 offset=183 (get_global $STATE_TRANSFER_BUFF) (get_global $flashPhase))
    (i32.store8 offset=184 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte1))
    (i32.store8 offset=185 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte2))
    (i32.store8 offset=186 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte1))
    (i32.store8 offset=187 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte2))
    (i32.store8 offset=188 (get_global $STATE_TRANSFER_BUFF) (get_global $flashFrames))
    (i32.store offset=189 (get_global $STATE_TRANSFER_BUFF) (get_global $renderingTablePtr))
    (i32.store offset=193 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelBufferPtr))

    ;; Beeper state
    (i32.store offset=197 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleRate))
    (i32.store offset=201 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleLength))
    (i32.store offset=205 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperLowerGate))
    (i32.store offset=209 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperUpperGate))
    (i32.store offset=213 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperGateValue))
    (i32.store offset=217 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperNextSampleTact))
    (i32.store8 offset=221 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperLastEarBit))
    (i32.store offset=222 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperSampleCount))
  )

  ;; Copies a segment of memory
  ;; $from: Source address
  ;; $to: Destination address
  ;; $count #of bytes to copy
  (func $copyMemory (param $from i32) (param $to i32) (param $count i32)
    loop $copy
      (i32.gt_u (get_local $count) (i32.const 0))
      if
        ;; Copy a single byte
        get_local $to
        get_local $from
        i32.load8_u
        i32.store8

        ;; Increment indexes
        (i32.add (get_local $from) (i32.const 1))
        set_local $from
        (i32.add (get_local $to) (i32.const 1))
        set_local $to

        ;; Decrement counter
        (i32.sub (get_local $count) (i32.const 1))
        set_local $count
        
        ;; continue
        br $copy
      end
    end
  )

  ;; Starts a new frame
  (func $startNewFrame
      ;; TODO: Init a new frame
      ;; Invoke machine type specific "New frame" function
      (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 9)
    )
    call_indirect (type $ActionFunc)
  )

  ;; Executes the actions to respond a screen rendering frame completion
  (func $completeFrame
      ;; TODO: Complete
      ;; Invoke machine type specific "Frame completed" function
      (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 10)
    )
    call_indirect (type $ActionFunc)
  )

  ;; Colorizes the data in pixel buffer
  (func $colorize
    (i32.add
      (i32.mul (get_global $MACHINE_TYPE) (get_global $MACHINE_FUNC_COUNT))
      (i32.const 11)
    )
    call_indirect (type $ActionFunc)
  )

  ;; Checks and executes interrupt, it it's time
  (func $checkForInterrupt (param $currentUlaTact i32)
    ;; We've already handled the interrupt
    get_global $interruptRevoked
    if return end

    ;; Is it too early to raise the interrupt?
    (i32.lt_u (get_local $currentUlaTact) (get_global $interruptTact))
    if return end

    ;; Are we over the longest op after the interrupt tact?
    (i32.gt_u 
      (get_local $currentUlaTact)
      (i32.add (get_global $interruptTact) (i32.const 23)) ;; tacts of the longest op
    )
    if
      ;; Let's revoke the INT signal
      i32.const 1 set_global $interruptRevoked
      (i32.and (get_global $stateFlags) (i32.const 0xfe))
      set_global $stateFlags ;; Reset the interrupt signal
      return
    end

    ;; The interrupt is raised, not revoked, but the CPU has not handled it yet
    get_global $interruptRaised
    if return end

    ;; Do not raise interrupt when CPU blocks
    get_global $isInterruptBlocked
    if return end

    ;; It is time to raise the interrupt
    i32.const 1 set_global $interruptRaised
    (i32.or (get_global $stateFlags) (i32.const 0x01))
    set_global $stateFlags ;; Set the interrupt signal
  )

  ;; ==========================================================================
  ;; Screen device routines

  ;; Table of paper colors (flash off)
  (global $PAPER_COLORS_OFF_TABLE i32 (i32.const 0x08_9E00))
  (data (i32.const 0x08_9E00) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

  ;; Table of ink colors (flash off)
  (global $INK_COLORS_OFF_TABLE i32 (i32.const 0x08_9F00))
  (data (i32.const 0x08_9F00) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

  ;; Table of paper colors (flash on)
  (global $PAPER_COLORS_ON_TABLE i32 (i32.const 0x08_A000))
  (data (i32.const 0x08_A000) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

  ;; Table of ink colors (flash on)
  (global $INK_COLORS_ON_TABLE i32 (i32.const 0x08_A100))
  (data (i32.const 0x08_A100) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

  ;; The buffer for the rendered pixels
  (global $PIXEL_RENDERING_BUFFER i32 (i32.const 0x08_A200))

  ;; The buffer for the colorized pixels
  (global $COLORIZATION_BUFFER i32 (i32.const 0x0B_4200))

  ;; Table of ZX Spectrum color palette
  (global $SPECTRUM_PALETTE i32 (i32.const 0x15_4200))
  (data (i32.const 0x15_4200) "\00\00\00\ff\00\00\aa\ff\aa\00\00\ff\aa\00\aa\ff\00\aa\00\ff\00\aa\aa\ff\aa\aa\00\ff\aa\aa\aa\ff\00\00\00\ff\00\00\ff\ff\ff\00\00\ff\ff\00\ff\ff\00\ff\00\ff\00\ff\ff\ff\ff\ff\00\ff\ff\ff\ff\ff")

  ;; Initializes the table used for screen rendering
  (func $initRenderingTactTable
    (local $firstVisibleLine i32)
    (local $lastVisibleLine i32)
    (local $lastVisibleLineTact i32)
    (local $lastDisplayLineTact i32)
    (local $borderPixelFetchTact i32)
    (local $borderAttrFetchTact i32)
    (local $tact i32)
    (local $line i32)
    (local $tactInLine i32)
    (local $phase i32)
    (local $contentionDelay i32)
    (local $pixelAddr i32)
    (local $attrAddr i32)
    (local $tablePointer i32)
    (local $contentionPtr i32)
    (local $pixelTact i32)

    ;; Calculate the first and last visible lines
    (i32.add (get_global $verticalSyncLines) (get_global $nonVisibleBorderTopLines))
    set_local $firstVisibleLine
    (i32.sub (get_global $rasterLines) (get_global $nonVisibleBorderBottomLines))
    set_local $lastVisibleLine

    ;; Calculate the last visible line and display tacts
    (i32.sub 
      (i32.sub (get_global $screenLineTime) (get_global $nonVisibleBorderRightTime))
      (get_global $horizontalBlankingTime)
    )
    set_local $lastVisibleLineTact
    (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
    set_local $lastDisplayLineTact

    ;; Calculate border pixel and attribute fetch tacts
    (i32.sub (get_global $borderLeftTime) (get_global $pixelDataPrefetchTime))
    set_local $borderPixelFetchTact
    (i32.sub (get_global $borderLeftTime) (get_global $attributeDataPrefetchTime))
    set_local $borderAttrFetchTact

    ;; Init the loop over tacts
    get_global $RENDERING_TACT_TABLE set_local $tablePointer
    get_global $CONTENTION_TABLE set_local $contentionPtr
    i32.const 0 set_local $tact

    loop $tactLoop
      (i32.lt_u (get_local $tact) (get_global $tactsInFrame))
      if
        ;; Init the current tact
        i32.const 0 set_local $phase
        i32.const 0 set_local $contentionDelay
        i32.const 0 set_local $pixelAddr
        i32.const 0 set_local $attrAddr

        ;; Calculate line and tact in line
        (i32.div_u (get_local $tact) (get_global $screenLineTime))
        set_local $line
        (i32.rem_u (get_local $tact) (get_global $screenLineTime))
        set_local $tactInLine

        ;; Test, if the current tact is visible
        (i32.ge_u (get_local $line) (get_local $firstVisibleLine))
        if (result i32)
          (i32.lt_u (get_local $line) (get_local $lastVisibleLine))
          if (result i32)
            (i32.lt_u (get_local $tactInLine) (get_local $lastVisibleLineTact))
          else
            i32.const 0
          end
        else
          i32.const 0
        end

        ;; At this point, the test result is at the top of the stack
        if
          ;; Yes, the tact is visible.
          ;; Test, if it is in the display area
          (i32.ge_u (get_local $line) (get_global $firstDisplayLine))
          if (result i32)
            (i32.le_u (get_local $line) (get_global $lastDisplayLine))
            if (result i32)
              (i32.ge_u (get_local $tactInLine) (get_global $borderLeftTime))
              if (result i32)
                (i32.lt_u (get_local $tactInLine) (get_local $lastDisplayLineTact))
              else
                i32.const 0
              end
            else
              i32.const 0
            end
          else
            i32.const 0
          end

          ;; At this point, the test result is at the top of the stack
          if
            ;; Yes, it is the display area
            ;; Carry out actions according to pixel tact
            (i32.and
              (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
              (i32.const 0x07)
            )
            (i32.eq (tee_local $pixelTact) (i32.const 0))
            if
              ;; Pixel tact 0
              i32.const 0x09 set_local $phase ;; DisplayB1FetchB2
              (call $calcPixelAddr 
                (get_local $line)
                (i32.add (get_local $tactInLine) (i32.const 4))
              )
              set_local $pixelAddr
              i32.const 5
              i32.const 0
              (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
              select
              set_local $contentionDelay
            else
              (i32.eq (get_local $pixelTact) (i32.const 1))
              if
                ;; Pixel tact 1
                i32.const 0x0a set_local $phase ;; DisplayB1FetchA2
                (call $calcAttrAddr 
                  (get_local $line)
                  (i32.add (get_local $tactInLine) (i32.const 3))
                )
                set_local $attrAddr
                i32.const 4
                i32.const 7
                (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                select
                set_local $contentionDelay
              else
                (i32.eq (get_local $pixelTact) (i32.const 2))
                if
                  ;; Pixel tact 2
                  i32.const 0x08 set_local $phase ;; DisplayB1
                  i32.const 3
                  i32.const 6
                  (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                  select
                  set_local $contentionDelay
                else
                  (i32.eq (get_local $pixelTact) (i32.const 3))
                  if
                    ;; Pixel tact 3
                    i32.const 0x08 set_local $phase ;; DisplayB1
                    i32.const 2
                    i32.const 5
                    (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                    select
                    set_local $contentionDelay
                  else
                    (i32.eq (get_local $pixelTact) (i32.const 4))
                    if
                      ;; Pixel tact 4
                      i32.const 0x10 set_local $phase ;; DisplayB2
                      i32.const 1
                      i32.const 4
                      (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                      select
                      set_local $contentionDelay
                    else
                      (i32.eq (get_local $pixelTact) (i32.const 5))
                      if
                        ;; Pixel tact 5
                        i32.const 0x10 set_local $phase ;; DisplayB2
                        i32.const 0
                        i32.const 3
                        (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                        select
                        set_local $contentionDelay
                      else
                        (i32.eq (get_local $pixelTact) (i32.const 6))
                        if
                          ;; Pixel tact 6
                          ;; Test, if there are more pixels to display in this line
                          (i32.lt_u 
                            (get_local $tactInLine)
                            (i32.sub 
                              (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
                              (get_global $pixelDataPrefetchTime)
                            )
                          )
                          if
                            ;; Yes, there are still more bytes
                            i32.const 0x11 set_local $phase ;; DisplayB2FetchB1
                            (call $calcPixelAddr 
                              (get_local $line)
                              (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                            )
                            set_local $pixelAddr
                            i32.const 0
                            i32.const 2
                            (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                            select
                            set_local $contentionDelay
                          else
                            ;; Last byte in this line
                            i32.const 0x10 set_local $phase ;; DisplayB2
                          end
                        else
                          ;; Pixel tact 7
                          ;; Test, if there are more pixels to display in this line
                          (i32.lt_u 
                            (get_local $tactInLine)
                            (i32.sub 
                              (i32.add (get_global $borderLeftTime) (get_global $displayLineTime))
                              (get_global $attributeDataPrefetchTime)
                            )
                          )
                          if
                            ;; Yes, there are still more bytes
                            i32.const 0x12 set_local $phase ;; DisplayB2FetchA1
                            (call $calcAttrAddr 
                              (get_local $line)
                              (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                            )
                            set_local $attrAddr
                            i32.const 6
                            i32.const 1
                            (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                            select
                            set_local $contentionDelay
                          else
                            ;; Last byte in this line
                            i32.const 0x10 set_local $phase ;; DisplayB2
                          end
                        end
                      end
                    end
                  end
                end
              end
            end
          else
            ;; No, it is the border area
            i32.const 0x04 set_local $phase

            ;; Is it left or right border?
            (i32.ge_u (get_local $line) (get_global $firstDisplayLine))
            if 
              (i32.le_u (get_local $line) (get_global $lastDisplayLine))
              if
                ;; Yes, it is left or right border
                ;; Is it pixel data prefetch time?
                (i32.eq (get_local $tactInLine) (get_local $borderPixelFetchTact))
                if
                  ;; Yes, prefetch pixel data
                  i32.const 0x05 set_local $phase ;; BorderFetchPixel
                  (call $calcPixelAddr 
                    (get_local $line)
                    (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                  )
                  set_local $pixelAddr
                  i32.const 0
                  i32.const 2
                  (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                  select
                  set_local $contentionDelay
                else
                  ;; Is it attribute data prefetch time?
                  (i32.eq (get_local $tactInLine) (get_local $borderAttrFetchTact))
                  if
                    ;; Yes, prefetch attribute data
                    i32.const 0x06 set_local $phase ;; BorderFetchAttr
                    (call $calcAttrAddr 
                      (get_local $line)
                      (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                    )
                    set_local $attrAddr
                    i32.const 6
                    i32.const 1
                    (i32.eq (get_global $contentionType) (i32.const 1)) ;; ULA contention?
                    select
                    set_local $contentionDelay
                  end
                end
              end
            end
          end
        end 

        ;; Store the current item
        (i32.store8 (get_local $tablePointer) (get_local $phase))
        (i32.store16 offset=1 (get_local $tablePointer) (get_local $pixelAddr))
        (i32.store16 offset=3 (get_local $tablePointer) (get_local $attrAddr))
        (i32.store8 (get_local $contentionPtr) (get_local $contentionDelay))

        ;; Move to the next table item
        (i32.add (get_local $tablePointer) (i32.const 5))
        set_local $tablePointer
        (i32.add (get_local $contentionPtr) (i32.const 1))
        set_local $contentionPtr

        ;; Continue the loop
        (i32.add (get_local $tact) (i32.const 1))
        set_local $tact

        br $tactLoop
      end
    end

    ;; Add extra (non-rendering) tacts to protect frame overflow
    i32.const 100 set_local $line
    loop $trailLoop
      get_local $line
      if
        (i32.store8 (get_local $tablePointer) (i32.const 0)) ;; "None" rendering phase
        (i32.store16 offset=1 (get_local $tablePointer) (i32.const 0))
        (i32.store16 offset=3 (get_local $tablePointer) (i32.const 0))

        ;; Move to the next table item
        (i32.add (get_local $tablePointer) (i32.const 5))
        set_local $tablePointer

        ;; Decrement counter
        (i32.sub (get_local $line) (i32.const 1))
        set_local $line
        br $trailLoop
      end
    end
  )

  ;; Calculates pixel address
  ;; $line: Screen line
  ;; $tactInLine: Tact in screen line
  (func $calcPixelAddr (param $line i32) (param $tactInLine i32) (result i32)
    (local $row i32)
    (i32.sub (get_local $line) (get_global $firstDisplayLine))

    ;; (row & 0xc0) << 5
    (i32.and (tee_local $row) (i32.const 0xc0))
    i32.const 5
    i32.shl

    ;; (row & 0x07) << 8
    (i32.and (get_local $row) (i32.const 0x07))
    i32.const 8
    i32.shl

    ;; (row & 0x38) << 2
    (i32.and (get_local $row) (i32.const 0x38))
    i32.const 2
    i32.shl

    ;; colum >> 3
    (i32.shr_u 
      (i32.shl 
        (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
        (i32.const 1)
      ) 
      (i32.const 3)
    )

    ;; Calculate the address
    i32.const 0x4000
    i32.add
    i32.add
    i32.add
    i32.add
  )

  ;; Calculates attribute address
  ;; $line: Screen line
  ;; $tactInLine: Tact in screen line
  (func $calcAttrAddr (param $line i32) (param $tactInLine i32) (result i32)
    ;; Calculate (column >> 3)
    (i32.shr_u
      (i32.shl 
        (i32.sub (get_local $tactInLine) (get_global $borderLeftTime))
        (i32.const 1)
      )
      (i32.const 3)
    )

    ;; Calculate ((row >> 3) << 5)
    (i32.shl
      (i32.shr_u
        (i32.sub (get_local $line) (get_global $firstDisplayLine))
        (i32.const 3)
      )
      (i32.const 5)
    )

    ;; Combine address parts
    i32.or
    i32.const 0x5800
    i32.add
  )

  ;; Renders the next screen portion
  ;; $toTact: last tact to render
  (func $renderScreen (param $toTact i32)
    (local $tact i32)
    (local $phase i32)
    (local $tmp i32)

    get_global $lastRenderedUlaTact
    set_local $tact

    ;; Iterate through tacts
    loop $tactLoop
      (i32.le_u (get_local $tact) (get_local $toTact))
      if
        ;; Obtain rendering phase information
        (i32.load8_u offset=0 (get_global $renderingTablePtr))
        
        ;;Process the current rendering tact
        (i32.gt_u (tee_local $phase) (i32.const 0))
        if
          ;; Test for border procesing
          (i32.and (get_local $phase) (i32.const 0x04))
          if
            ;; Store border pixels
            (i32.store8 offset=0 (get_global $pixelBufferPtr) (get_global $borderColor))
            (i32.store8 offset=1 (get_global $pixelBufferPtr) (get_global $borderColor))

            ;; Fetch border byte?
            (i32.and (get_local $phase) (i32.const 0x01))
            if
              ;; Fetch pixel byte 1
              (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
              set_global $pixelByte1
            else
              (i32.and (get_local $phase) (i32.const 0x02))
              if
                ;; Fetch attr byte 1
                (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
                set_global $attrByte1
              end
            end
          else
            ;; Test for Byte1 processing
            (i32.and (get_local $phase) (i32.const 0x08))
            if
              ;; Process Byte1 pixels
              get_global $pixelBufferPtr
              (call $getAttrColor
                (i32.and (get_global $pixelByte1) (i32.const 0x80))
                (get_global $attrByte1)
              )
              i32.store8 offset=0
              get_global $pixelBufferPtr

              (call $getAttrColor
                (i32.and (get_global $pixelByte1) (i32.const 0x40))
                (get_global $attrByte1)
              )
              i32.store8 offset=1
              (i32.shl (get_global $pixelByte1) (i32.const 2))
              (i32.and (i32.const 0xff))
              set_global $pixelByte1

              ;; Fetch pixel byte?
              (i32.and (get_local $phase) (i32.const 0x01))
              if
                ;; Fetch pixel byte 2
                (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
                set_global $pixelByte2
              else
                (i32.and (get_local $phase) (i32.const 0x02))
                if
                  ;; Fetch attr byte 2
                  (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
                  set_global $attrByte2
                end
              end
            else
              ;; Process Byte2 pixels
              get_global $pixelBufferPtr
              (call $getAttrColor
                (i32.and (get_global $pixelByte2) (i32.const 0x80))
                (get_global $attrByte2)
              )
              i32.store8 offset=0
              get_global $pixelBufferPtr
              (call $getAttrColor
                (i32.and (get_global $pixelByte2) (i32.const 0x40))
                (get_global $attrByte2)
              )
              i32.store8 offset=1
              (i32.shl (get_global $pixelByte2) (i32.const 2))
              (i32.and (i32.const 0xff))
              set_global $pixelByte2

              ;; Fetch pixel byte?
              (i32.and (get_local $phase) (i32.const 0x01))
              if
                ;; Fetch pixel byte 1
                (call $readMemoryNc (i32.load16_u offset=1 (get_global $renderingTablePtr)))
                set_global $pixelByte1
              else
                (i32.and (get_local $phase) (i32.const 0x02))
                if
                  ;; Fetch attr byte 1
                  (call $readMemoryNc (i32.load16_u offset=3 (get_global $renderingTablePtr)))
                  set_global $attrByte1
                end
              end
            end
          end

          ;; Move to the next pixel in the buffer
          (i32.add (get_global $pixelBufferPtr) (i32.const 2))
          set_global $pixelBufferPtr
        end

        ;; Move to the next rendering tact
        (i32.add (get_global $renderingTablePtr) (i32.const 5))
        set_global $renderingTablePtr

        ;; Increment loop counter
        (i32.add (get_local $tact) (i32.const 1))
        set_local $tact

        ;; continue
        br $tactLoop
      end
      get_local $tact set_global $lastRenderedUlaTact
    end
  )

  ;; Gets the color for the specified pixel
  ;; $pixel: 0: paper, other: ink
  (func $getAttrColor (param $pixel i32) (param $attr i32) (result i32)
    get_local $pixel
    if (result i32)
      get_global $flashPhase
      if (result i32)
        get_global $INK_COLORS_ON_TABLE
      else
        get_global $INK_COLORS_OFF_TABLE
      end
    else
      get_global $flashPhase
      if (result i32)
        get_global $PAPER_COLORS_ON_TABLE
      else
        get_global $PAPER_COLORS_OFF_TABLE
      end
    end
    get_local $attr
    i32.add
    i32.load8_u
  )

  ;; Puts a pair of pixels into the rendering buffer
  (func $setPixels (param $pixelAddr i32) (param $pixel1Color i32) (param $pixel2Color i32)
  )

  ;; ==========================================================================
  ;; Beeper device routines

  ;; The buffer for beeper samples
  (global $BEEPER_SAMPLE_BUFFER i32 (i32.const 0x0B_2200))

  ;; Sets the specified beeper sample rate
  ;; $rate: New beeper sample rate
  (func $setBeeperSampleRate (param $rate i32)
    (local $sampleLength f32)
    get_local $rate set_global $beeperSampleRate

    ;; Calculate the sample length
    (f32.div
      (f32.convert_u/i32 (i32.mul (get_global $baseClockFrequency) (get_global $clockMultiplier)))
      (f32.convert_u/i32 (get_local $rate))
    )
    tee_local $sampleLength
    i32.trunc_u/f32
    set_global $beeperSampleLength

    ;; Calculate the gate values for the sample length
    (f32.mul 
      (f32.sub 
        (get_local $sampleLength) 
        (f32.convert_u/i32 (get_global $beeperSampleLength))
      )
      (f32.const 100_000)
    )
    i32.trunc_u/f32
    set_global $beeperLowerGate
    i32.const 100_000 set_global $beeperUpperGate
    (i32.shr_u
      (i32.add (get_global $beeperLowerGate) (get_global $beeperUpperGate))
      (i32.const 1)
    )
    set_global $beeperGateValue
  )

  ;; Checks if tape device hook should be applied
  (func $checkTapeHooks)

  ;; Applies memory contention delay according to the current
  ;; screen rendering tact
  (func $applyContentionDelay
    (i32.add
      (get_global $CONTENTION_TABLE) 
      (i32.div_u (get_global $tacts) (get_global $clockMultiplier))
    )
    i32.load8_u
    call $incTacts
  )

  ;; Applies I/O contention wait
  ;; $addr: port address
  (func $applyIOContentionDelay (param $addr i32)
    (local $lowbit i32)

    ;; Calculate the low bit value
    (i32.and (get_local $addr) (i32.const 0x0001))
    set_local $lowbit

    ;; Check for contended range
    (i32.eq
      (i32.and (get_local $addr) (i32.const 0xc000))
      (i32.const 0x4000)
    )
    if
      ;; Contended address
      get_local $lowbit
      if
        ;; Low bit set, C:1, C:1, C:1, C:1 
        call $applyContentionDelay
        (call $incTacts (i32.const 1))
        call $applyContentionDelay
        (call $incTacts (i32.const 1))
        call $applyContentionDelay
        (call $incTacts (i32.const 1))
        call $applyContentionDelay
        (call $incTacts (i32.const 1))
      else
        ;; Low bit reset, C:1, C:3
        call $applyContentionDelay
        (call $incTacts (i32.const 1))
        call $applyContentionDelay
        (call $incTacts (i32.const 3))
      end
    else
      ;; Non-contended address
      get_local $lowbit
      if
        ;; Low bit set, N:4
        (call $incTacts (i32.const 4))
      else
        ;; Low bit reset, N:1, C:3
        (call $incTacts (i32.const 1))
        call $applyContentionDelay
        (call $incTacts (i32.const 3))
      end
    end
  )

  ;; Tests if the machine is in tape load mode
  (func $isInLoadMode (result i32)
    ;; TODO implement this method
    i32.const 0
  )

  ;; Reads information from the 0xfe port
  (func $readPort$FE (param $addr i32) (result i32)
    (local $portValue i32)
    (local $bit4Sensed i32)
    (local $chargeTime i32)
    (local $bit6Value i32)
    (local $tmp i32)

    ;; Scan keyboard line status
    (call $getKeyLineStatus (i32.shr_u (get_local $addr) (i32.const 8)))
    set_local $portValue

    call $isInLoadMode
    if (result i32)
      ;; TODO: Handle EAR bit from tape
      get_local $portValue
    else
      ;; Handle analog EAR bit
      get_global $portBit4LastValue
      (i32.eq (tee_local $bit4Sensed) (i32.const 0))
      if
        ;; Changed later to 1 from 0 than to 0 from 1?
        (i32.sub (get_global $portBit4ChangedFrom1Tacts) (get_global $portBit4ChangedFrom0Tacts))
        (i32.gt_s (tee_local $chargeTime) (i32.const 0))
        if 
          ;; Yes, calculate charge time
          (i32.gt_u (get_local $chargeTime) (i32.const 700))
          if (result i32)
            i32.const 2800
          else
            (i32.mul (i32.const 4) (get_local $chargeTime))
          end
          set_local $chargeTime

          ;; Calculate time ellapsed since last change from 1 to 0
          (i32.sub (get_global $tacts) (get_global $portBit4ChangedFrom1Tacts))
          ;; Less than charge time?
          (i32.lt_u (get_local $chargeTime))
          i32.const 4
          i32.shl
          set_local $bit4Sensed
        end
      end

      ;; Calculate bit 6 value
      get_global $portBit3LastValue
      if (result i32)
        i32.const 0x40
      else
        i32.const 0x40
        i32.const 0x00
        get_local $bit4Sensed
        select
      end
      set_local $bit6Value

      ;; Check for ULA 3
      (i32.eq (get_global $ulaIssue) (i32.const 3))
      if
        get_global $portBit3LastValue
        if
          (i32.eq (get_local $bit4Sensed) (i32.const 0))
          if
          i32.const 0
          set_local $bit6Value
          end
        end
      end

      ;; Merge bit 6 with port value
      (i32.and (get_local $portValue) (i32.const 0xbf))
      get_local $bit6Value
      i32.or
    end
  )

  ;; Writes information to the 0xfe port
  (func $writePort$FE (param $addr i32) (param $v i32)
    (local $bit4 i32)

    ;; Extract border color
    (i32.and (get_local $v) (i32.const 0x07))
    set_global $borderColor

    ;; Let the beeper device process the EAR bit
    (i32.and (get_local $v) (i32.const 0x10))
    set_local $bit4
    (call $processEarBit (get_local $bit4))

    ;; Set the last value of bit3
    (i32.and (get_local $v) (i32.const 0x08))
    set_global $portBit3LastValue

    ;; Have the tape device process the MIC bit
    (call $processMicBit (get_global $portBit3LastValue))

    ;; Manage bit 4 value
    get_global $portBit4LastValue
    if
      ;; Bit 4 was 1, is it now 0?
      (i32.eq (get_local $bit4) (i32.const 0))
      if
        get_global $tacts set_global $portBit4ChangedFrom1Tacts
        i32.const 0 set_global $portBit4LastValue
      end
    else
      ;; Bit 4 was 0, is it now 1?
      get_local $bit4
      if
        get_global $tacts set_global $portBit4ChangedFrom0Tacts
        i32.const 0x10 set_global $portBit4LastValue
      end
    end
  )

  ;; This function processes the EAR bit (beeper device)
  (func $processEarBit (param $earBit i32)
    call $createEarBitSamples
    get_local $earBit set_global $beeperLastEarBit
  )

  ;; Creates EAR bit samples until the current CPU tact
  (func $createEarBitSamples
    ;; Process only if enough time spent from last sample
    (i32.lt_s
      (i32.mul
        (i32.sub (get_global $tacts) (get_global $beeperNextSampleTact))
        (i32.const 2)
      )
      (get_global $beeperSampleLength)
    )
    if return end

    loop $earBitLoop
      (i32.le_u (get_global $beeperNextSampleTact) (get_global $tacts))
      if
        ;; Store the next sample
        (i32.add (get_global $BEEPER_SAMPLE_BUFFER) (get_global $beeperSampleCount))
        i32.const 1
        i32.const 0
        get_global $beeperLastEarBit
        select
        i32.store8 

        ;; Adjust sample count
        (i32.add (get_global $beeperSampleCount) (i32.const 1))
        set_global $beeperSampleCount

        ;; Calculate the next beeper sample tact
        (i32.add (get_global $beeperGateValue) (get_global $beeperLowerGate))
        set_global $beeperGateValue
        (i32.add (get_global $beeperNextSampleTact) (get_global $beeperSampleLength))
        set_global $beeperNextSampleTact

        (i32.ge_u (get_global $beeperGateValue) (get_global $beeperUpperGate))
        if
          ;; Shift the next sample 
          (i32.add (get_global $beeperNextSampleTact) (i32.const 1))
          set_global $beeperNextSampleTact

          (i32.sub (get_global $beeperGateValue) (get_global $beeperUpperGate))
          set_global $beeperGateValue
        end
        br $earBitLoop
      end
    end
  )

  ;; This function processes the MIC bit (tape device)
  (func $processMicBit (param $micBit i32))

  ;; Gets the current cursor mode
  (func $getCursorMode (result i32)
    ;; Get the value of the MODE ZX Spectrum system variable
    (i32.add (get_global $SP_MEM_OFFS) (i32.const 0x5c41))
    i32.load8_u
  )

  ;; ==========================================================================
  ;; ZX Spectrum 48K ROM
  
  ;; Start address of ZX Spectrum 48 ROM in memory
  (global $SPECTRUM_48_ROM_INDEX i32 (i32.const 0x1_1D00))

  (data (i32.const 0x1_1d00) "\f3\af\11\ff\ff\c3\cb\11\2a\5d\5c\22\5f\5c\18\43\c3\f2\15\ff\ff\ff\ff\ff\2a\5d\5c\7e\cd\7d\00\d0\cd\74\00\18\f7\ff\ff\ff\c3\5b\33\ff\ff\ff\ff\ff\c5\2a\61\5c\e5\c3\9e\16\f5\e5\2a\78\5c\23\22\78\5c\7c\b5\20\03\fd\34\40\c5\d5\cd\bf\02\d1\c1\e1\f1\fb\c9\e1\6e\fd\75\00\ed\7b\3d\5c\c3\c5\16\ff\ff\ff\ff\ff\ff\ff\f5\e5\2a\b0\5c\7c\b5\20\01\e9\e1\f1\ed\45\2a\5d\5c\23\22\5d\5c\7e\c9\fe\21\d0\fe\0d\c8\fe\10\d8\fe\18\3f\d8\23\fe\16\38\01\23\37\22\5d\5c\c9\bf\52\4e\c4\49\4e\4b\45\59\a4\50\c9\46\ce\50\4f\49\4e\d4\53\43\52\45\45\4e\a4\41\54\54\d2\41\d4\54\41\c2\56\41\4c\a4\43\4f\44\c5\56\41\cc\4c\45\ce\53\49\ce\43\4f\d3\54\41\ce\41\53\ce\41\43\d3\41\54\ce\4c\ce\45\58\d0\49\4e\d4\53\51\d2\53\47\ce\41\42\d3\50\45\45\cb\49\ce\55\53\d2\53\54\52\a4\43\48\52\a4\4e\4f\d4\42\49\ce")
  (data (i32.const 0x1_1e00) "\4f\d2\41\4e\c4\3c\bd\3e\bd\3c\be\4c\49\4e\c5\54\48\45\ce\54\cf\53\54\45\d0\44\45\46\20\46\ce\43\41\d4\46\4f\52\4d\41\d4\4d\4f\56\c5\45\52\41\53\c5\4f\50\45\4e\20\a3\43\4c\4f\53\45\20\a3\4d\45\52\47\c5\56\45\52\49\46\d9\42\45\45\d0\43\49\52\43\4c\c5\49\4e\cb\50\41\50\45\d2\46\4c\41\53\c8\42\52\49\47\48\d4\49\4e\56\45\52\53\c5\4f\56\45\d2\4f\55\d4\4c\50\52\49\4e\d4\4c\4c\49\53\d4\53\54\4f\d0\52\45\41\c4\44\41\54\c1\52\45\53\54\4f\52\c5\4e\45\d7\42\4f\52\44\45\d2\43\4f\4e\54\49\4e\55\c5\44\49\cd\52\45\cd\46\4f\d2\47\4f\20\54\cf\47\4f\20\53\55\c2\49\4e\50\55\d4\4c\4f\41\c4\4c\49\53\d4\4c\45\d4\50\41\55\53\c5\4e\45\58\d4\50\4f\4b\c5\50\52\49\4e\d4\50\4c\4f\d4\52\55\ce\53\41\56\c5\52\41\4e\44\4f\4d\49\5a\c5\49\c6\43\4c\d3\44\52\41\d7\43\4c\45\41\d2\52\45\54\55\52")
  (data (i32.const 0x1_1f00) "\ce\43\4f\50\d9\42\48\59\36\35\54\47\56\4e\4a\55\37\34\52\46\43\4d\4b\49\38\33\45\44\58\0e\4c\4f\39\32\57\53\5a\20\0d\50\30\31\51\41\e3\c4\e0\e4\b4\bc\bd\bb\af\b0\b1\c0\a7\a6\be\ad\b2\ba\e5\a5\c2\e1\b3\b9\c1\b8\7e\dc\da\5c\b7\7b\7d\d8\bf\ae\aa\ab\dd\de\df\7f\b5\d6\7c\d5\5d\db\b6\d9\5b\d7\0c\07\06\04\05\08\0a\0b\09\0f\e2\2a\3f\cd\c8\cc\cb\5e\ac\2d\2b\3d\2e\2c\3b\22\c7\3c\c3\3e\c5\2f\c9\60\c6\3a\d0\ce\a8\ca\d3\d4\d1\d2\a9\cf\2e\2f\11\ff\ff\01\fe\fe\ed\78\2f\e6\1f\28\0e\67\7d\14\c0\d6\08\cb\3c\30\fa\53\5f\20\f4\2d\cb\00\38\e6\7a\3c\c8\fe\28\c8\fe\19\c8\7b\5a\57\fe\18\c9\cd\8e\02\c0\21\00\5c\cb\7e\20\07\23\35\2b\20\02\36\ff\7d\21\04\5c\bd\20\ee\cd\1e\03\d0\21\00\5c\be\28\2e\eb\21\04\5c\be\28\27\cb\7e\20\04\eb\cb\7e\c8\5f\77\23\36\05\23\3a\09\5c\77\23\fd\4e\07\fd")
  (data (i32.const 0x1_2000) "\56\01\e5\cd\33\03\e1\77\32\08\5c\fd\cb\01\ee\c9\23\36\05\23\35\c0\3a\0a\5c\77\23\7e\18\ea\42\16\00\7b\fe\27\d0\fe\18\20\03\cb\78\c0\21\05\02\19\7e\37\c9\7b\fe\3a\38\2f\0d\fa\4f\03\28\03\c6\4f\c9\21\eb\01\04\28\03\21\05\02\16\00\19\7e\c9\21\29\02\cb\40\28\f4\cb\5a\28\0a\fd\cb\30\5e\c0\04\c0\c6\20\c9\c6\a5\c9\fe\30\d8\0d\fa\9d\03\20\19\21\54\02\cb\68\28\d3\fe\38\30\07\d6\20\04\c8\c6\08\c9\d6\36\04\c8\c6\fe\c9\21\30\02\fe\39\28\ba\fe\30\28\b6\e6\07\c6\80\04\c8\ee\0f\c9\04\c8\cb\68\21\30\02\20\a4\d6\10\fe\22\28\06\fe\20\c0\3e\5f\c9\3e\40\c9\f3\7d\cb\3d\cb\3d\2f\e6\03\4f\06\00\dd\21\d1\03\dd\09\3a\48\5c\e6\38\0f\0f\0f\f6\08\00\00\00\04\0c\0d\20\fd\0e\3f\05\c2\d6\03\ee\10\d3\fe\44\4f\cb\67\20\09\7a\b3\28\09\79\4d\1b\dd\e9\4d\0c\dd\e9\fb\c9\ef\31\27\c0\03\34\ec\6c")
  (data (i32.const 0x1_2100) "\98\1f\f5\04\a1\0f\38\21\92\5c\7e\a7\20\5e\23\4e\23\46\78\17\9f\b9\20\54\23\be\20\50\78\c6\3c\f2\25\04\e2\6c\04\06\fa\04\d6\0c\30\fb\c6\0c\c5\21\6e\04\cd\06\34\cd\b4\33\ef\04\38\f1\86\77\ef\c0\02\31\38\cd\94\1e\fe\0b\30\22\ef\e0\04\e0\34\80\43\55\9f\80\01\05\34\35\71\03\38\cd\99\1e\c5\cd\99\1e\e1\50\59\7a\b3\c8\1b\c3\b5\03\cf\0a\89\02\d0\12\86\89\0a\97\60\75\89\12\d5\17\1f\89\1b\90\41\02\89\24\d0\53\ca\89\2e\9d\36\b1\89\38\ff\49\3e\89\43\ff\6a\73\89\4f\a7\00\54\89\5c\00\00\00\89\69\14\f6\24\89\76\f1\10\05\cd\fb\24\3a\3b\5c\87\fa\8a\1c\e1\d0\e5\cd\f1\2b\62\6b\0d\f8\09\cb\fe\c9\21\3f\05\e5\21\80\1f\cb\7f\28\03\21\98\0c\08\13\dd\2b\f3\3e\02\47\10\fe\d3\fe\ee\0f\06\a4\2d\20\f5\05\25\f2\d8\04\06\2f\10\fe\d3\fe\3e\0d\06\37\10\fe\d3\fe\01\0e\3b\08\6f\c3\07\05\7a\b3")
  (data (i32.const 0x1_2200) "\28\0c\dd\6e\00\7c\ad\67\3e\01\37\c3\25\05\6c\18\f4\79\cb\78\10\fe\30\04\06\42\10\fe\d3\fe\06\3e\20\ef\05\af\3c\cb\15\c2\14\05\1b\dd\23\06\31\3e\7f\db\fe\1f\d0\7a\3c\c2\fe\04\06\3b\10\fe\c9\f5\3a\48\5c\e6\38\0f\0f\0f\d3\fe\3e\7f\db\fe\1f\fb\38\02\cf\0c\f1\c9\14\08\15\f3\3e\0f\d3\fe\21\3f\05\e5\db\fe\1f\e6\20\f6\02\4f\bf\c0\cd\e7\05\30\fa\21\15\04\10\fe\2b\7c\b5\20\f9\cd\e3\05\30\eb\06\9c\cd\e3\05\30\e4\3e\c6\b8\30\e0\24\20\f1\06\c9\cd\e7\05\30\d5\78\fe\d4\30\f4\cd\e7\05\d0\79\ee\03\4f\26\00\06\b0\18\1f\08\20\07\30\0f\dd\75\00\18\0f\cb\11\ad\c0\79\1f\4f\13\18\07\dd\7e\00\ad\c0\dd\23\1b\08\06\b2\2e\01\cd\e3\05\d0\3e\cb\b8\cb\15\06\b0\d2\ca\05\7c\ad\67\7a\b3\20\ca\7c\fe\01\c9\cd\e7\05\d0\3e\16\3d\20\fd\a7\04\c8\3e\7f\db\fe\1f\d0\a9\e6\20\28\f3\79\2f\4f\e6\07\f6")
  (data (i32.const 0x1_2300) "\08\d3\fe\37\c9\f1\3a\74\5c\d6\e0\32\74\5c\cd\8c\1c\cd\30\25\28\3c\01\11\00\3a\74\5c\a7\28\02\0e\22\f7\d5\dd\e1\06\0b\3e\20\12\13\10\fc\dd\36\01\ff\cd\f1\2b\21\f6\ff\0b\09\03\30\0f\3a\74\5c\a7\20\02\cf\0e\78\b1\28\0a\01\0a\00\dd\e5\e1\23\eb\ed\b0\df\fe\e4\20\49\3a\74\5c\fe\03\ca\8a\1c\e7\cd\b2\28\cb\f9\30\0b\21\00\00\3a\74\5c\3d\28\15\cf\01\c2\8a\1c\cd\30\25\28\18\23\7e\dd\77\0b\23\7e\dd\77\0c\23\dd\71\0e\3e\01\cb\71\28\01\3c\dd\77\00\eb\e7\fe\29\20\da\e7\cd\ee\1b\eb\c3\5a\07\fe\aa\20\1f\3a\74\5c\fe\03\ca\8a\1c\e7\cd\ee\1b\dd\36\0b\00\dd\36\0c\1b\21\00\40\dd\75\0d\dd\74\0e\18\4d\fe\af\20\4f\3a\74\5c\fe\03\ca\8a\1c\e7\cd\48\20\20\0c\3a\74\5c\a7\ca\8a\1c\cd\e6\1c\18\0f\cd\82\1c\df\fe\2c\28\0c\3a\74\5c\a7\ca\8a\1c\cd\e6\1c\18\04\e7\cd\82\1c\cd\ee\1b\cd\99\1e\dd")
  (data (i32.const 0x1_2400) "\71\0b\dd\70\0c\cd\99\1e\dd\71\0d\dd\70\0e\60\69\dd\36\00\03\18\44\fe\ca\28\09\cd\ee\1b\dd\36\0e\80\18\17\3a\74\5c\a7\c2\8a\1c\e7\cd\82\1c\cd\ee\1b\cd\99\1e\dd\71\0d\dd\70\0e\dd\36\00\00\2a\59\5c\ed\5b\53\5c\37\ed\52\dd\75\0b\dd\74\0c\2a\4b\5c\ed\52\dd\75\0f\dd\74\10\eb\3a\74\5c\a7\ca\70\09\e5\01\11\00\dd\09\dd\e5\11\11\00\af\37\cd\56\05\dd\e1\30\f2\3e\fe\cd\01\16\fd\36\52\03\0e\80\dd\7e\00\dd\be\ef\20\02\0e\f6\fe\04\30\d9\11\c0\09\c5\cd\0a\0c\c1\dd\e5\d1\21\f0\ff\19\06\0a\7e\3c\20\03\79\80\4f\13\1a\be\23\20\01\0c\d7\10\f6\cb\79\20\b3\3e\0d\d7\e1\dd\7e\00\fe\03\28\0c\3a\74\5c\3d\ca\08\08\fe\02\ca\b6\08\e5\dd\6e\fa\dd\66\fb\dd\5e\0b\dd\56\0c\7c\b5\28\0d\ed\52\38\26\28\07\dd\7e\00\fe\03\20\1d\e1\7c\b5\20\06\dd\6e\0d\dd\66\0e\e5\dd\e1\3a\74\5c\fe\02\37\20\01\a7")
  (data (i32.const 0x1_2500) "\3e\ff\cd\56\05\d8\cf\1a\dd\5e\0b\dd\56\0c\e5\7c\b5\20\06\13\13\13\eb\18\0c\dd\6e\fa\dd\66\fb\eb\37\ed\52\38\09\11\05\00\19\44\4d\cd\05\1f\e1\dd\7e\00\a7\28\3e\7c\b5\28\13\2b\46\2b\4e\2b\03\03\03\dd\22\5f\5c\cd\e8\19\dd\2a\5f\5c\2a\59\5c\2b\dd\4e\0b\dd\46\0c\c5\03\03\03\dd\7e\fd\f5\cd\55\16\23\f1\77\d1\23\73\23\72\23\e5\dd\e1\37\3e\ff\c3\02\08\eb\2a\59\5c\2b\dd\22\5f\5c\dd\4e\0b\dd\46\0c\c5\cd\e5\19\c1\e5\c5\cd\55\16\dd\2a\5f\5c\23\dd\4e\0f\dd\46\10\09\22\4b\5c\dd\66\0e\7c\e6\c0\20\0a\dd\6e\0d\22\42\5c\fd\36\0a\00\d1\dd\e1\37\3e\ff\c3\02\08\dd\4e\0b\dd\46\0c\c5\03\f7\36\80\eb\d1\e5\e5\dd\e1\37\3e\ff\cd\02\08\e1\ed\5b\53\5c\7e\e6\c0\20\19\1a\13\be\23\20\02\1a\be\1b\2b\30\08\e5\eb\cd\b8\19\e1\18\ec\cd\2c\09\18\e2\7e\4f\fe\80\c8\e5\2a\4b\5c\7e\fe\80\28\25\b9\28")
  (data (i32.const 0x1_2600) "\08\c5\cd\b8\19\c1\eb\18\f0\e6\e0\fe\a0\20\12\d1\d5\e5\23\13\1a\be\20\06\17\30\f7\e1\18\03\e1\18\e0\3e\ff\d1\eb\3c\37\cd\2c\09\18\c4\20\10\08\22\5f\5c\eb\cd\b8\19\cd\e8\19\eb\2a\5f\5c\08\08\d5\cd\b8\19\22\5f\5c\2a\53\5c\e3\c5\08\38\07\2b\cd\55\16\23\18\03\cd\55\16\23\c1\d1\ed\53\53\5c\ed\5b\5f\5c\c5\d5\eb\ed\b0\e1\c1\d5\cd\e8\19\d1\c9\e5\3e\fd\cd\01\16\af\11\a1\09\cd\0a\0c\fd\cb\02\ee\cd\d4\15\dd\e5\11\11\00\af\cd\c2\04\dd\e1\06\32\76\10\fd\dd\5e\0b\dd\56\0c\3e\ff\dd\e1\c3\c2\04\80\53\74\61\72\74\20\74\61\70\65\2c\20\74\68\65\6e\20\70\72\65\73\73\20\61\6e\79\20\6b\65\79\ae\0d\50\72\6f\67\72\61\6d\3a\a0\0d\4e\75\6d\62\65\72\20\61\72\72\61\79\3a\a0\0d\43\68\61\72\61\63\74\65\72\20\61\72\72\61\79\3a\a0\0d\42\79\74\65\73\3a\a0\cd\03\0b\fe\20\d2\d9\0a\fe\06\38\69")
  (data (i32.const 0x1_2700) "\fe\18\30\65\21\0b\0a\5f\16\00\19\5e\19\e5\c3\03\0b\4e\57\10\29\54\53\52\37\50\4f\5f\5e\5d\5c\5b\5a\54\53\0c\3e\22\b9\20\11\fd\cb\01\4e\20\09\04\0e\02\3e\18\b8\20\03\05\0e\21\c3\d9\0d\3a\91\5c\f5\fd\36\57\01\3e\20\cd\65\0b\f1\32\91\5c\c9\fd\cb\01\4e\c2\cd\0e\0e\21\cd\55\0c\05\c3\d9\0d\cd\03\0b\79\3d\3d\e6\10\18\5a\3e\3f\18\6c\11\87\0a\32\0f\5c\18\0b\11\6d\0a\18\03\11\87\0a\32\0e\5c\2a\51\5c\73\23\72\c9\11\f4\09\cd\80\0a\2a\0e\5c\57\7d\fe\16\da\11\22\20\29\44\4a\3e\1f\91\38\0c\c6\02\4f\fd\cb\01\4e\20\16\3e\16\90\da\9f\1e\3c\47\04\fd\cb\02\46\c2\55\0c\fd\be\31\da\86\0c\c3\d9\0d\7c\cd\03\0b\81\3d\e6\1f\c8\57\fd\cb\01\c6\3e\20\cd\3b\0c\15\20\f8\c9\cd\24\0b\fd\cb\01\4e\20\1a\fd\cb\02\46\20\08\ed\43\88\5c\22\84\5c\c9\ed\43\8a\5c\ed\43\82\5c\22\86\5c\c9\fd\71\45\22")
  (data (i32.const 0x1_2800) "\80\5c\c9\fd\cb\01\4e\20\14\ed\4b\88\5c\2a\84\5c\fd\cb\02\46\c8\ed\4b\8a\5c\2a\86\5c\c9\fd\4e\45\2a\80\5c\c9\fe\80\38\3d\fe\90\30\26\47\cd\38\0b\cd\03\0b\11\92\5c\18\47\21\92\5c\cd\3e\0b\cb\18\9f\e6\0f\4f\cb\18\9f\e6\f0\b1\0e\04\77\23\0d\20\fb\c9\d6\a5\30\09\c6\15\c5\ed\4b\7b\5c\18\0b\cd\10\0c\c3\03\0b\c5\ed\4b\36\5c\eb\21\3b\5c\cb\86\fe\20\20\02\cb\c6\26\00\6f\29\29\29\09\c1\eb\79\3d\3e\21\20\0e\05\4f\fd\cb\01\4e\28\06\d5\cd\cd\0e\d1\79\b9\d5\cc\55\0c\d1\c5\e5\3a\91\5c\06\ff\1f\38\01\04\1f\1f\9f\4f\3e\08\a7\fd\cb\01\4e\28\05\fd\cb\30\ce\37\eb\08\1a\a0\ae\a9\12\08\38\13\14\23\3d\20\f2\eb\25\fd\cb\01\4e\cc\db\0b\e1\c1\0d\23\c9\08\3e\20\83\5f\08\18\e6\7c\0f\0f\0f\e6\03\f6\58\67\ed\5b\8f\5c\7e\ab\a2\ab\fd\cb\57\76\28\08\e6\c7\cb\57\20\02\ee\38\fd\cb\57\66\28\08")
  (data (i32.const 0x1_2900) "\e6\f8\cb\6f\20\02\ee\07\77\c9\e5\26\00\e3\18\04\11\95\00\f5\cd\41\0c\38\09\3e\20\fd\cb\01\46\cc\3b\0c\1a\e6\7f\cd\3b\0c\1a\13\87\30\f5\d1\fe\48\28\03\fe\82\d8\7a\fe\03\d8\3e\20\d5\d9\d7\d9\d1\c9\f5\eb\3c\cb\7e\23\28\fb\3d\20\f8\eb\f1\fe\20\d8\1a\d6\41\c9\fd\cb\01\4e\c0\11\d9\0d\d5\78\fd\cb\02\46\c2\02\0d\fd\be\31\38\1b\c0\fd\cb\02\66\28\16\fd\5e\2d\1d\28\5a\3e\00\cd\01\16\ed\7b\3f\5c\fd\cb\02\a6\c9\cf\04\fd\35\52\20\45\3e\18\90\32\8c\5c\2a\8f\5c\e5\3a\91\5c\f5\3e\fd\cd\01\16\af\11\f8\0c\cd\0a\0c\fd\cb\02\ee\21\3b\5c\cb\de\cb\ae\d9\cd\d4\15\d9\fe\20\28\45\fe\e2\28\41\f6\20\fe\6e\28\3b\3e\fe\cd\01\16\f1\32\91\5c\e1\22\8f\5c\cd\fe\0d\fd\46\31\04\0e\21\c5\cd\9b\0e\7c\0f\0f\0f\e6\03\f6\58\67\11\e0\5a\1a\4e\06\20\eb\12\71\13\23\10\fa\c1\c9\80\73\63\72\6f\6c\6c\bf")
  (data (i32.const 0x1_2a00) "\cf\0c\fe\02\38\80\fd\86\31\d6\19\d0\ed\44\c5\47\2a\8f\5c\e5\2a\91\5c\e5\cd\4d\0d\78\f5\21\6b\5c\46\78\3c\77\21\89\5c\be\38\03\34\06\18\cd\00\0e\f1\3d\20\e8\e1\fd\75\57\e1\22\8f\5c\ed\4b\88\5c\fd\cb\02\86\cd\d9\0d\fd\cb\02\c6\c1\c9\af\2a\8d\5c\fd\cb\02\46\28\04\67\fd\6e\0e\22\8f\5c\21\91\5c\20\02\7e\0f\ae\e6\55\ae\77\c9\cd\af\0d\21\3c\5c\cb\ae\cb\c6\cd\4d\0d\fd\46\31\cd\44\0e\21\c0\5a\3a\8d\5c\05\18\07\0e\20\2b\77\0d\20\fb\10\f7\fd\36\31\02\3e\fd\cd\01\16\2a\51\5c\11\f4\09\a7\73\23\72\23\11\a8\10\3f\38\f6\01\21\17\18\2a\21\00\00\22\7d\5c\fd\cb\30\86\cd\94\0d\3e\fe\cd\01\16\cd\4d\0d\06\18\cd\44\0e\2a\51\5c\11\f4\09\73\23\72\fd\36\52\01\01\21\18\21\00\5b\fd\cb\01\4e\20\12\78\fd\cb\02\46\28\05\fd\86\31\d6\18\c5\47\cd\9b\0e\c1\3e\21\91\5f\16\00\19\c3\dc\0a\06\17")
  (data (i32.const 0x1_2b00) "\cd\9b\0e\0e\08\c5\e5\78\e6\07\78\20\0c\eb\21\e0\f8\19\eb\01\20\00\3d\ed\b0\eb\21\e0\ff\19\eb\47\e6\07\0f\0f\0f\4f\78\06\00\ed\b0\06\07\09\e6\f8\20\db\e1\24\c1\0d\20\cd\cd\88\0e\21\e0\ff\19\eb\ed\b0\06\01\c5\cd\9b\0e\0e\08\c5\e5\78\e6\07\0f\0f\0f\4f\78\06\00\0d\54\5d\36\00\13\ed\b0\11\01\07\19\3d\e6\f8\47\20\e5\e1\24\c1\0d\20\dc\cd\88\0e\62\6b\13\3a\8d\5c\fd\cb\02\46\28\03\3a\48\5c\77\0b\ed\b0\c1\0e\21\c9\7c\0f\0f\0f\3d\f6\50\67\eb\61\68\29\29\29\29\29\44\4d\c9\3e\18\90\57\0f\0f\0f\e6\e0\6f\7a\e6\18\f6\40\67\c9\f3\06\b0\21\00\40\e5\c5\cd\f4\0e\c1\e1\24\7c\e6\07\20\0a\7d\c6\20\6f\3f\9f\e6\f8\84\67\10\e7\18\0d\f3\21\00\5b\06\08\c5\cd\f4\0e\c1\10\f9\3e\04\d3\fb\fb\21\00\5b\fd\75\46\af\47\77\23\10\fc\fd\cb\30\8e\0e\21\c3\d9\0d\78\fe\03\9f\e6\02\d3\fb\57\cd\54\1f")
  (data (i32.const 0x1_2c00) "\38\0a\3e\04\d3\fb\fb\cd\df\0e\cf\0c\db\fb\87\f8\30\eb\0e\20\5e\23\06\08\cb\12\cb\13\cb\1a\db\fb\1f\30\fb\7a\d3\fb\10\f0\0d\20\e9\c9\2a\3d\5c\e5\21\7f\10\e5\ed\73\3d\5c\cd\d4\15\f5\16\00\fd\5e\ff\21\c8\00\cd\b5\03\f1\21\38\0f\e5\fe\18\30\31\fe\07\38\2d\fe\10\38\3a\01\02\00\57\fe\16\38\0c\03\fd\cb\37\7e\ca\1e\10\cd\d4\15\5f\cd\d4\15\d5\2a\5b\5c\fd\cb\07\86\cd\55\16\c1\23\70\23\71\18\0a\fd\cb\07\86\2a\5b\5c\cd\52\16\12\13\ed\53\5b\5c\c9\5f\16\00\21\99\0f\19\5e\19\e5\2a\5b\5c\c9\09\66\6a\50\b5\70\7e\cf\d4\2a\49\5c\fd\cb\37\6e\c2\97\10\cd\6e\19\cd\95\16\7a\b3\ca\97\10\e5\23\4e\23\46\21\0a\00\09\44\4d\cd\05\1f\cd\97\10\2a\51\5c\e3\e5\3e\ff\cd\01\16\e1\2b\fd\35\0f\cd\55\18\fd\34\0f\2a\59\5c\23\23\23\23\22\5b\5c\e1\cd\15\16\c9\fd\cb\37\6e\20\08\21\49\5c\cd\0f\19\18")
  (data (i32.const 0x1_2d00) "\6d\fd\36\00\10\18\1d\cd\31\10\18\05\7e\fe\0d\c8\23\22\5b\5c\c9\cd\31\10\01\01\00\c3\e8\19\cd\d4\15\cd\d4\15\e1\e1\e1\22\3d\5c\fd\cb\00\7e\c0\f9\c9\37\cd\95\11\ed\52\19\23\c1\d8\c5\44\4d\62\6b\23\1a\e6\f0\fe\10\20\09\23\1a\d6\17\ce\00\20\01\23\a7\ed\42\09\eb\38\e6\c9\fd\cb\37\6e\c0\2a\49\5c\cd\6e\19\eb\cd\95\16\21\4a\5c\cd\1c\19\cd\95\17\3e\00\c3\01\16\fd\cb\37\7e\28\a8\c3\81\0f\fd\cb\30\66\28\a1\fd\36\00\ff\16\00\fd\5e\fe\21\90\1a\cd\b5\03\c3\30\0f\e5\cd\90\11\2b\cd\e5\19\22\5b\5c\fd\36\07\00\e1\c9\fd\cb\02\5e\c4\1d\11\a7\fd\cb\01\6e\c8\3a\08\5c\fd\cb\01\ae\f5\fd\cb\02\6e\c4\6e\0d\f1\fe\20\30\52\fe\10\30\2d\fe\06\30\0a\47\e6\01\4f\78\1f\c6\12\18\2a\20\09\21\6a\5c\3e\08\ae\77\18\0e\fe\0e\d8\d6\0d\21\41\5c\be\77\20\02\36\00\fd\cb\02\de\bf\c9\47\e6\07\4f\3e\10")
  (data (i32.const 0x1_2e00) "\cb\58\20\01\3c\fd\71\d3\11\0d\11\18\06\3a\0d\5c\11\a8\10\2a\4f\5c\23\23\73\23\72\37\c9\cd\4d\0d\fd\cb\02\9e\fd\cb\02\ae\2a\8a\5c\e5\2a\3d\5c\e5\21\67\11\e5\ed\73\3d\5c\2a\82\5c\e5\37\cd\95\11\eb\cd\7d\18\eb\cd\e1\18\2a\8a\5c\e3\eb\cd\4d\0d\3a\8b\5c\92\38\26\20\06\7b\fd\96\50\30\1e\3e\20\d5\cd\f4\09\d1\18\e9\16\00\fd\5e\fe\21\90\1a\cd\b5\03\fd\36\00\ff\ed\5b\8a\5c\18\02\d1\e1\e1\22\3d\5c\c1\d5\cd\d9\0d\e1\22\82\5c\fd\36\26\00\c9\2a\61\5c\2b\a7\ed\5b\59\5c\fd\cb\37\6e\c8\ed\5b\61\5c\d8\2a\63\5c\c9\7e\fe\0e\01\06\00\cc\e8\19\7e\23\fe\0d\20\f1\c9\f3\3e\ff\ed\5b\b2\5c\d9\ed\4b\b4\5c\ed\5b\38\5c\2a\7b\5c\d9\47\3e\07\d3\fe\3e\3f\ed\47\00\00\00\00\00\00\62\6b\36\02\2b\bc\20\fa\a7\ed\52\19\23\30\06\35\28\03\35\28\f3\2b\d9\ed\43\b4\5c\ed\53\38\5c\22\7b\5c\d9\04\28\19")
  (data (i32.const 0x1_2f00) "\22\b4\5c\11\af\3e\01\a8\00\eb\ed\b8\eb\23\22\7b\5c\2b\01\40\00\ed\43\38\5c\22\b2\5c\21\00\3c\22\36\5c\2a\b2\5c\36\3e\2b\f9\2b\2b\22\3d\5c\ed\56\fd\21\3a\5c\fb\21\b6\5c\22\4f\5c\11\af\15\01\15\00\eb\ed\b0\eb\2b\22\57\5c\23\22\53\5c\22\4b\5c\36\80\23\22\59\5c\36\0d\23\36\80\23\22\61\5c\22\63\5c\22\65\5c\3e\38\32\8d\5c\32\8f\5c\32\48\5c\21\23\05\22\09\5c\fd\35\c6\fd\35\ca\21\c6\15\11\10\5c\01\0e\00\ed\b0\fd\cb\01\ce\cd\df\0e\fd\36\31\02\cd\6b\0d\af\11\38\15\cd\0a\0c\fd\cb\02\ee\18\07\fd\36\31\02\cd\95\17\cd\b0\16\3e\00\cd\01\16\cd\2c\0f\cd\17\1b\fd\cb\00\7e\20\12\fd\cb\30\66\28\40\2a\59\5c\cd\a7\11\fd\36\00\ff\18\dd\2a\59\5c\22\5d\5c\cd\fb\19\78\b1\c2\5d\15\df\fe\0d\28\c0\fd\cb\30\46\c4\af\0d\cd\6e\0d\3e\19\fd\96\4f\32\8c\5c\fd\cb\01\fe\fd\36\00\ff\fd\36\0a\01")
  (data (i32.const 0x1_3000) "\cd\8a\1b\76\fd\cb\01\ae\fd\cb\30\4e\c4\cd\0e\3a\3a\5c\3c\f5\21\00\00\fd\74\37\fd\74\26\22\0b\5c\21\01\00\22\16\5c\cd\b0\16\fd\cb\37\ae\cd\6e\0d\fd\cb\02\ee\f1\47\fe\0a\38\02\c6\07\cd\ef\15\3e\20\d7\78\11\91\13\cd\0a\0c\af\11\36\15\cd\0a\0c\ed\4b\45\5c\cd\1b\1a\3e\3a\d7\fd\4e\0d\06\00\cd\1b\1a\cd\97\10\3a\3a\5c\3c\28\1b\fe\09\28\04\fe\15\20\03\fd\34\0d\01\03\00\11\70\5c\21\44\5c\cb\7e\28\01\09\ed\b8\fd\36\0a\ff\fd\cb\01\9e\c3\ac\12\80\4f\cb\4e\45\58\54\20\77\69\74\68\6f\75\74\20\46\4f\d2\56\61\72\69\61\62\6c\65\20\6e\6f\74\20\66\6f\75\6e\e4\53\75\62\73\63\72\69\70\74\20\77\72\6f\6e\e7\4f\75\74\20\6f\66\20\6d\65\6d\6f\72\f9\4f\75\74\20\6f\66\20\73\63\72\65\65\ee\4e\75\6d\62\65\72\20\74\6f\6f\20\62\69\e7\52\45\54\55\52\4e\20\77\69\74\68\6f\75\74\20\47\4f\53\55")
  (data (i32.const 0x1_3100) "\c2\45\6e\64\20\6f\66\20\66\69\6c\e5\53\54\4f\50\20\73\74\61\74\65\6d\65\6e\f4\49\6e\76\61\6c\69\64\20\61\72\67\75\6d\65\6e\f4\49\6e\74\65\67\65\72\20\6f\75\74\20\6f\66\20\72\61\6e\67\e5\4e\6f\6e\73\65\6e\73\65\20\69\6e\20\42\41\53\49\c3\42\52\45\41\4b\20\2d\20\43\4f\4e\54\20\72\65\70\65\61\74\f3\4f\75\74\20\6f\66\20\44\41\54\c1\49\6e\76\61\6c\69\64\20\66\69\6c\65\20\6e\61\6d\e5\4e\6f\20\72\6f\6f\6d\20\66\6f\72\20\6c\69\6e\e5\53\54\4f\50\20\69\6e\20\49\4e\50\55\d4\46\4f\52\20\77\69\74\68\6f\75\74\20\4e\45\58\d4\49\6e\76\61\6c\69\64\20\49\2f\4f\20\64\65\76\69\63\e5\49\6e\76\61\6c\69\64\20\63\6f\6c\6f\75\f2\42\52\45\41\4b\20\69\6e\74\6f\20\70\72\6f\67\72\61\ed\52\41\4d\54\4f\50\20\6e\6f\20\67\6f\6f\e4\53\74\61\74\65\6d\65\6e\74\20\6c\6f\73\f4\49\6e\76\61\6c\69")
  (data (i32.const 0x1_3200) "\64\20\73\74\72\65\61\ed\46\4e\20\77\69\74\68\6f\75\74\20\44\45\c6\50\61\72\61\6d\65\74\65\72\20\65\72\72\6f\f2\54\61\70\65\20\6c\6f\61\64\69\6e\67\20\65\72\72\6f\f2\2c\a0\7f\20\31\39\38\32\20\53\69\6e\63\6c\61\69\72\20\52\65\73\65\61\72\63\68\20\4c\74\e4\3e\10\01\00\00\c3\13\13\ed\43\49\5c\2a\5d\5c\eb\21\55\15\e5\2a\61\5c\37\ed\52\e5\60\69\cd\6e\19\20\06\cd\b8\19\cd\e8\19\c1\79\3d\b0\28\28\c5\03\03\03\03\2b\ed\5b\53\5c\d5\cd\55\16\e1\22\53\5c\c1\c5\13\2a\61\5c\2b\2b\ed\b8\2a\49\5c\eb\c1\70\2b\71\2b\73\2b\72\f1\c3\a2\12\f4\09\a8\10\4b\f4\09\c4\15\53\81\0f\c4\15\52\f4\09\c4\15\50\80\cf\12\01\00\06\00\0b\00\01\00\01\00\06\00\10\00\fd\cb\02\6e\20\04\fd\cb\02\de\cd\e6\15\d8\28\fa\cf\07\d9\e5\2a\51\5c\23\23\18\08\1e\30\83\d9\e5\2a\51\5c\5e\23\56\eb\cd\2c\16\e1\d9")
  (data (i32.const 0x1_3300) "\c9\87\c6\16\6f\26\5c\5e\23\56\7a\b3\20\02\cf\17\1b\2a\4f\5c\19\22\51\5c\fd\cb\30\a6\23\23\23\23\4e\21\2d\16\cd\dc\16\d0\16\00\5e\19\e9\4b\06\53\12\50\1b\00\fd\cb\02\c6\fd\cb\01\ae\fd\cb\30\e6\18\04\fd\cb\02\86\fd\cb\01\8e\c3\4d\0d\fd\cb\01\ce\c9\01\01\00\e5\cd\05\1f\e1\cd\64\16\2a\65\5c\eb\ed\b8\c9\f5\e5\21\4b\5c\3e\0e\5e\23\56\e3\a7\ed\52\19\e3\30\09\d5\eb\09\eb\72\2b\73\23\d1\23\3d\20\e8\eb\d1\f1\a7\ed\52\44\4d\03\19\eb\c9\00\00\eb\11\8f\16\7e\e6\c0\20\f7\56\23\5e\c9\2a\63\5c\2b\cd\55\16\23\23\c1\ed\43\61\5c\c1\eb\23\c9\2a\59\5c\36\0d\22\5b\5c\23\36\80\23\22\61\5c\2a\61\5c\22\63\5c\2a\63\5c\22\65\5c\e5\21\92\5c\22\68\5c\e1\c9\ed\5b\59\5c\c3\e5\19\23\7e\a7\c8\b9\23\20\f8\37\c9\cd\1e\17\cd\01\17\01\00\00\11\e2\a3\eb\19\38\07\01\d4\15\09\4e\23\46\eb\71\23\70")
  (data (i32.const 0x1_3400) "\c9\e5\2a\4f\5c\09\23\23\23\4e\eb\21\16\17\cd\dc\16\4e\06\00\09\e9\4b\05\53\03\50\01\e1\c9\cd\94\1e\fe\10\38\02\cf\17\c6\03\07\21\10\5c\4f\06\00\09\4e\23\46\2b\c9\ef\01\38\cd\1e\17\78\b1\28\16\eb\2a\4f\5c\09\23\23\23\7e\eb\fe\4b\28\08\fe\53\28\04\fe\50\20\cf\cd\5d\17\73\23\72\c9\e5\cd\f1\2b\78\b1\20\02\cf\0e\c5\1a\e6\df\4f\21\7a\17\cd\dc\16\30\f1\4e\06\00\09\c1\e9\4b\06\53\08\50\0a\00\1e\01\18\06\1e\06\18\02\1e\10\0b\78\b1\20\d5\57\e1\c9\18\90\ed\73\3f\5c\fd\36\02\10\cd\af\0d\fd\cb\02\c6\fd\46\31\cd\44\0e\fd\cb\02\86\fd\cb\30\c6\2a\49\5c\ed\5b\6c\5c\a7\ed\52\19\38\22\d5\cd\6e\19\11\c0\02\eb\ed\52\e3\cd\6e\19\c1\c5\cd\b8\19\c1\09\38\0e\eb\56\23\5e\2b\ed\53\6c\5c\18\ed\22\6c\5c\2a\6c\5c\cd\6e\19\28\01\eb\cd\33\18\fd\cb\02\a6\c9\3e\03\18\02\3e\02\fd\36\02\00\cd")
  (data (i32.const 0x1_3500) "\30\25\c4\01\16\df\cd\70\20\38\14\df\fe\3b\28\04\fe\2c\20\06\e7\cd\82\1c\18\08\cd\e6\1c\18\03\cd\de\1c\cd\ee\1b\cd\99\1e\78\e6\3f\67\69\22\49\5c\cd\6e\19\1e\01\cd\55\18\d7\fd\cb\02\66\28\f6\3a\6b\5c\fd\96\4f\20\ee\ab\c8\e5\d5\21\6c\5c\cd\0f\19\d1\e1\18\e0\ed\4b\49\5c\cd\80\19\16\3e\28\05\11\00\00\cb\13\fd\73\2d\7e\fe\40\c1\d0\c5\cd\28\1a\23\23\23\fd\cb\01\86\7a\a7\28\05\d7\fd\cb\01\c6\d5\eb\fd\cb\30\96\21\3b\5c\cb\96\fd\cb\37\6e\28\02\cb\d6\2a\5f\5c\a7\ed\52\20\05\3e\3f\cd\c1\18\cd\e1\18\eb\7e\cd\b6\18\23\fe\0d\28\06\eb\cd\37\19\18\e0\d1\c9\fe\0e\c0\23\23\23\23\23\23\7e\c9\d9\2a\8f\5c\e5\cb\bc\cb\fd\22\8f\5c\21\91\5c\56\d5\36\00\cd\f4\09\e1\fd\74\57\e1\22\8f\5c\d9\c9\2a\5b\5c\a7\ed\52\c0\3a\41\5c\cb\07\28\04\c6\43\18\16\21\3b\5c\cb\9e\3e\4b\cb\56\28\0b\cb\de")
  (data (i32.const 0x1_3600) "\3c\fd\cb\30\5e\28\02\3e\43\d5\cd\c1\18\d1\c9\5e\23\56\e5\eb\23\cd\6e\19\cd\95\16\e1\fd\cb\37\6e\c0\72\2b\73\c9\7b\a7\f8\18\0d\af\09\3c\38\fc\ed\42\3d\28\f1\c3\ef\15\cd\1b\2d\30\30\fe\21\38\2c\fd\cb\01\96\fe\cb\28\24\fe\3a\20\0e\fd\cb\37\6e\20\16\fd\cb\30\56\28\14\18\0e\fe\22\20\0a\f5\3a\6a\5c\ee\04\32\6a\5c\f1\fd\cb\01\d6\d7\c9\e5\2a\53\5c\54\5d\c1\cd\80\19\d0\c5\cd\b8\19\eb\18\f4\7e\b8\c0\23\7e\2b\b9\c9\23\23\23\22\5d\5c\0e\00\15\c8\e7\bb\20\04\a7\c9\23\7e\cd\b6\18\22\5d\5c\fe\22\20\01\0d\fe\3a\28\04\fe\cb\20\04\cb\41\28\df\fe\0d\20\e3\15\37\c9\e5\7e\fe\40\38\17\cb\6f\28\14\87\fa\c7\19\3f\01\05\00\30\02\0e\12\17\23\7e\30\fb\18\06\23\23\4e\23\46\23\09\d1\a7\ed\52\44\4d\19\eb\c9\cd\dd\19\c5\78\2f\47\79\2f\4f\03\cd\64\16\eb\e1\19\d5\ed\b0\e1\c9\2a\59\5c\2b\22")
  (data (i32.const 0x1_3700) "\5d\5c\e7\21\92\5c\22\65\5c\cd\3b\2d\cd\a2\2d\38\04\21\f0\d8\09\da\8a\1c\c3\c5\16\d5\e5\af\cb\78\20\20\60\69\1e\ff\18\08\d5\56\23\5e\e5\eb\1e\20\01\18\fc\cd\2a\19\01\9c\ff\cd\2a\19\0e\f6\cd\2a\19\7d\cd\ef\15\e1\d1\c9\b1\cb\bc\bf\c4\af\b4\93\91\92\95\98\98\98\98\98\98\98\7f\81\2e\6c\6e\70\48\94\56\3f\41\2b\17\1f\37\77\44\0f\59\2b\43\2d\51\3a\6d\42\0d\49\5c\44\15\5d\01\3d\02\06\00\67\1e\06\cb\05\f0\1c\06\00\ed\1e\00\ee\1c\00\23\1f\04\3d\06\cc\06\05\03\1d\04\00\ab\1d\05\cd\1f\05\89\20\05\02\2c\05\b2\1b\00\b7\11\03\a1\1e\05\f9\17\08\00\80\1e\03\4f\1e\00\5f\1e\03\ac\1e\00\6b\0d\09\00\dc\22\06\00\3a\1f\05\ed\1d\05\27\1e\03\42\1e\09\05\82\23\00\ac\0e\05\c9\1f\05\f5\17\0b\0b\0b\0b\08\00\f8\03\09\05\20\23\07\07\07\07\07\07\08\00\7a\1e\06\00\94\22\05\60\1f\06\2c\0a\00")
  (data (i32.const 0x1_3800) "\36\17\06\00\e5\16\0a\00\93\17\0a\2c\0a\00\93\17\0a\00\93\17\00\93\17\fd\cb\01\be\cd\fb\19\af\32\47\5c\3d\32\3a\5c\18\01\e7\cd\bf\16\fd\34\0d\fa\8a\1c\df\06\00\fe\0d\28\7a\fe\3a\28\eb\21\76\1b\e5\4f\e7\79\d6\ce\da\8a\1c\4f\21\48\1a\09\4e\09\18\03\2a\74\5c\7e\23\22\74\5c\01\52\1b\c5\4f\fe\20\30\0c\21\01\1c\06\00\09\4e\09\e5\df\05\c9\df\b9\c2\8a\1c\e7\c9\cd\54\1f\38\02\cf\14\fd\cb\0a\7e\20\71\2a\42\5c\cb\7c\28\14\21\fe\ff\22\45\5c\2a\61\5c\2b\ed\5b\59\5c\1b\3a\44\5c\18\33\cd\6e\19\3a\44\5c\28\19\a7\20\43\47\7e\e6\c0\78\28\0f\cf\ff\c1\cd\30\25\c8\2a\55\5c\3e\c0\a6\c0\af\fe\01\ce\00\56\23\5e\ed\53\45\5c\23\5e\23\56\eb\19\23\22\55\5c\eb\22\5d\5c\57\1e\00\fd\36\0a\ff\15\fd\72\0d\ca\28\1b\14\cd\8b\19\28\08\cf\16\cd\30\25\c0\c1\c1\df\fe\0d\28\ba\fe\3a\ca\28\1b\c3\8a")
  (data (i32.const 0x1_3900) "\1c\0f\1d\4b\09\67\0b\7b\8e\71\b4\81\cf\cd\de\1c\bf\c1\cc\ee\1b\eb\2a\74\5c\4e\23\46\eb\c5\c9\cd\b2\28\fd\36\37\00\30\08\fd\cb\37\ce\20\18\cf\01\cc\96\29\fd\cb\01\76\20\0d\af\cd\30\25\c4\f1\2b\21\71\5c\b6\77\eb\ed\43\72\5c\22\4d\5c\c9\c1\cd\56\1c\cd\ee\1b\c9\3a\3b\5c\f5\cd\fb\24\f1\fd\56\01\aa\e6\40\20\24\cb\7a\c2\ff\2a\c9\cd\b2\28\f5\79\f6\9f\3c\20\14\f1\18\a9\e7\cd\82\1c\fe\2c\20\09\e7\cd\fb\24\fd\cb\01\76\c0\cf\0b\cd\fb\24\fd\cb\01\76\c8\18\f4\fd\cb\01\7e\fd\cb\02\86\c4\4d\0d\f1\3a\74\5c\d6\13\cd\fc\21\cd\ee\1b\2a\8f\5c\22\8d\5c\21\91\5c\7e\07\ae\e6\aa\ae\77\c9\cd\30\25\28\13\fd\cb\02\86\cd\4d\0d\21\90\5c\7e\f6\f8\77\fd\cb\57\b6\df\cd\e2\21\18\9f\c3\05\06\fe\0d\28\04\fe\3a\20\9c\cd\30\25\c8\ef\a0\38\c9\cf\08\c1\cd\30\25\28\0a\ef\02\38\eb\cd\e9\34\da\b3\1b")
  (data (i32.const 0x1_3a00) "\c3\29\1b\fe\cd\20\09\e7\cd\82\1c\cd\ee\1b\18\06\cd\ee\1b\ef\a1\38\ef\c0\02\01\e0\01\38\cd\ff\2a\22\68\5c\2b\7e\cb\fe\01\06\00\09\07\38\06\0e\0d\cd\55\16\23\e5\ef\02\02\38\e1\eb\0e\0a\ed\b0\2a\45\5c\eb\73\23\72\fd\56\0d\14\23\72\cd\da\1d\d0\fd\46\38\2a\45\5c\22\42\5c\3a\47\5c\ed\44\57\2a\5d\5c\1e\f3\c5\ed\4b\55\5c\cd\86\1d\ed\43\55\5c\c1\38\11\e7\f6\20\b8\28\03\e7\18\e8\e7\3e\01\92\32\44\5c\c9\cf\11\7e\fe\3a\28\18\23\7e\e6\c0\37\c0\46\23\4e\ed\43\42\5c\23\4e\23\46\e5\09\44\4d\e1\16\00\c5\cd\8b\19\c1\d0\18\e0\fd\cb\37\4e\c2\2e\1c\2a\4d\5c\cb\7e\28\1f\23\22\68\5c\ef\e0\e2\0f\c0\02\38\cd\da\1d\d8\2a\68\5c\11\0f\00\19\5e\23\56\23\66\eb\c3\73\1e\cf\00\ef\e1\e0\e2\36\00\02\01\03\37\00\04\38\a7\c9\38\37\c9\e7\cd\1f\1c\cd\30\25\28\29\df\22\5f\5c\2a\57\5c\7e\fe\2c\28")
  (data (i32.const 0x1_3b00) "\09\1e\e4\cd\86\1d\30\02\cf\0d\cd\77\00\cd\56\1c\df\22\57\5c\2a\5f\5c\fd\36\26\00\cd\78\00\df\fe\2c\28\c9\cd\ee\1b\c9\cd\30\25\20\0b\cd\fb\24\fe\2c\c4\ee\1b\e7\18\f5\3e\e4\47\ed\b9\11\00\02\c3\8b\19\cd\99\1e\60\69\cd\6e\19\2b\22\57\5c\c9\cd\99\1e\78\b1\20\04\ed\4b\78\5c\ed\43\76\5c\c9\2a\6e\5c\fd\56\36\18\0c\cd\99\1e\60\69\16\00\7c\fe\f0\30\2c\22\42\5c\fd\72\0a\c9\cd\85\1e\ed\79\c9\cd\85\1e\02\c9\cd\d5\2d\38\15\28\02\ed\44\f5\cd\99\1e\f1\c9\cd\d5\2d\18\03\cd\a2\2d\38\01\c8\cf\0a\cd\67\1e\01\00\00\cd\45\1e\18\03\cd\99\1e\78\b1\20\04\ed\4b\b2\5c\c5\ed\5b\4b\5c\2a\59\5c\2b\cd\e5\19\cd\6b\0d\2a\65\5c\11\32\00\19\d1\ed\52\30\08\2a\b4\5c\a7\ed\52\30\02\cf\15\eb\22\b2\5c\d1\c1\36\3e\2b\f9\c5\ed\73\3d\5c\eb\e9\d1\fd\66\0d\24\e3\33\ed\4b\45\5c\c5\e5\ed\73\3d\5c\d5\cd")
  (data (i32.const 0x1_3c00) "\67\1e\01\14\00\2a\65\5c\09\38\0a\eb\21\50\00\19\38\03\ed\72\d8\2e\03\c3\55\00\01\00\00\cd\05\1f\44\4d\c9\c1\e1\d1\7a\fe\3e\28\0b\3b\e3\eb\ed\73\3d\5c\c5\c3\73\1e\d5\e5\cf\06\cd\99\1e\76\0b\78\b1\28\0c\78\a1\3c\20\01\03\fd\cb\01\6e\28\ee\fd\cb\01\ae\c9\3e\7f\db\fe\1f\d8\3e\fe\db\fe\1f\c9\cd\30\25\28\05\3e\ce\c3\39\1e\fd\cb\01\f6\cd\8d\2c\30\16\e7\fe\24\20\05\fd\cb\01\b6\e7\fe\28\20\3c\e7\fe\29\28\20\cd\8d\2c\d2\8a\1c\eb\e7\fe\24\20\02\eb\e7\eb\01\06\00\cd\55\16\23\23\36\0e\fe\2c\20\03\e7\18\e0\fe\29\20\13\e7\fe\3d\20\0e\e7\3a\3b\5c\f5\cd\fb\24\f1\fd\ae\01\e6\40\c2\8a\1c\cd\ee\1b\cd\30\25\e1\c8\e9\3e\03\18\02\3e\02\cd\30\25\c4\01\16\cd\4d\0d\cd\df\1f\cd\ee\1b\c9\df\cd\45\20\28\0d\cd\4e\20\28\fb\cd\fc\1f\cd\4e\20\28\f3\fe\29\c8\cd\c3\1f\3e\0d\d7\c9\df\fe\ac\20")
  (data (i32.const 0x1_3d00) "\0d\cd\79\1c\cd\c3\1f\cd\07\23\3e\16\18\10\fe\ad\20\12\e7\cd\82\1c\cd\c3\1f\cd\99\1e\3e\17\d7\79\d7\78\d7\c9\cd\f2\21\d0\cd\70\20\d0\cd\fb\24\cd\c3\1f\fd\cb\01\76\cc\f1\2b\c2\e3\2d\78\b1\0b\c8\1a\13\d7\18\f7\fe\29\c8\fe\0d\c8\fe\3a\c9\df\fe\3b\28\14\fe\2c\20\0a\cd\30\25\28\0b\3e\06\d7\18\06\fe\27\c0\cd\f5\1f\e7\cd\45\20\20\01\c1\bf\c9\fe\23\37\c0\e7\cd\82\1c\a7\cd\c3\1f\cd\94\1e\fe\10\d2\0e\16\cd\01\16\a7\c9\cd\30\25\28\08\3e\01\cd\01\16\cd\6e\0d\fd\36\02\01\cd\c1\20\cd\ee\1b\ed\4b\88\5c\3a\6b\5c\b8\38\03\0e\21\47\ed\43\88\5c\3e\19\90\32\8c\5c\fd\cb\02\86\cd\d9\0d\c3\6e\0d\cd\4e\20\28\fb\fe\28\20\0e\e7\cd\df\1f\df\fe\29\c2\8a\1c\e7\c3\b2\21\fe\ca\20\11\e7\cd\1f\1c\fd\cb\37\fe\fd\cb\01\76\c2\8a\1c\18\0d\cd\8d\2c\d2\af\21\cd\1f\1c\fd\cb\37\be\cd\30\25\ca\b2\21")
  (data (i32.const 0x1_3e00) "\cd\bf\16\21\71\5c\cb\b6\cb\ee\01\01\00\cb\7e\20\0b\3a\3b\5c\e6\40\20\02\0e\03\b6\77\f7\36\0d\79\0f\0f\30\05\3e\22\12\2b\77\22\5b\5c\fd\cb\37\7e\20\2c\2a\5d\5c\e5\2a\3d\5c\e5\21\3a\21\e5\fd\cb\30\66\28\04\ed\73\3d\5c\2a\61\5c\cd\a7\11\fd\36\00\ff\cd\2c\0f\fd\cb\01\be\cd\b9\21\18\03\cd\2c\0f\fd\36\22\00\cd\d6\21\20\0a\cd\1d\11\ed\4b\82\5c\cd\d9\0d\21\71\5c\cb\ae\cb\7e\cb\be\20\1c\e1\e1\22\3d\5c\e1\22\5f\5c\fd\cb\01\fe\cd\b9\21\2a\5f\5c\fd\36\26\00\22\5d\5c\18\17\2a\63\5c\ed\5b\61\5c\37\ed\52\44\4d\cd\b2\2a\cd\ff\2a\18\03\cd\fc\1f\cd\4e\20\ca\c1\20\c9\2a\61\5c\22\5d\5c\df\fe\e2\28\0c\3a\71\5c\cd\59\1c\df\fe\0d\c8\cf\0b\cd\30\25\c8\cf\10\2a\51\5c\23\23\23\23\7e\fe\4b\c9\e7\cd\f2\21\d8\df\fe\2c\28\f6\fe\3b\28\f2\c3\8a\1c\fe\d9\d8\fe\df\3f\d8\f5\e7\f1\d6\c9\f5\cd")
  (data (i32.const 0x1_3f00) "\82\1c\f1\a7\cd\c3\1f\f5\cd\94\1e\57\f1\d7\7a\d7\c9\d6\11\ce\00\28\1d\d6\02\ce\00\28\56\fe\01\7a\06\01\20\04\07\07\06\04\4f\7a\fe\02\30\16\79\21\91\5c\18\38\7a\06\07\38\05\07\07\07\06\38\4f\7a\fe\0a\38\02\cf\13\21\8f\5c\fe\08\38\0b\7e\28\07\b0\2f\e6\24\28\01\78\4f\79\cd\6c\22\3e\07\ba\9f\cd\6c\22\07\07\e6\50\47\3e\08\ba\9f\ae\a0\ae\77\23\78\c9\9f\7a\0f\06\80\20\03\0f\06\40\4f\7a\fe\08\28\04\fe\02\30\bd\79\21\8f\5c\cd\6c\22\79\0f\0f\0f\18\d8\cd\94\1e\fe\08\30\a9\d3\fe\07\07\07\cb\6f\20\02\ee\07\32\48\5c\c9\3e\af\90\da\f9\24\47\a7\1f\37\1f\a7\1f\a8\e6\f8\a8\67\79\07\07\07\a8\e6\c7\a8\07\07\6f\79\e6\07\c9\cd\07\23\cd\aa\22\47\04\7e\07\10\fd\e6\01\c3\28\2d\cd\07\23\cd\e5\22\c3\4d\0d\ed\43\7d\5c\cd\aa\22\47\04\3e\fe\0f\10\fd\47\7e\fd\4e\57\cb\41\20\01\a0\cb\51\20")
  (data (i32.const 0x1_4000) "\02\a8\2f\77\c3\db\0b\cd\14\23\47\c5\cd\14\23\59\c1\51\4f\c9\cd\d5\2d\da\f9\24\0e\01\c8\0e\ff\c9\df\fe\2c\c2\8a\1c\e7\cd\82\1c\cd\ee\1b\ef\2a\3d\38\7e\fe\81\30\05\ef\02\38\18\a1\ef\a3\38\36\83\ef\c5\02\38\cd\7d\24\c5\ef\31\e1\04\38\7e\fe\80\30\08\ef\02\02\38\c1\c3\dc\22\ef\c2\01\c0\02\03\01\e0\0f\c0\01\31\e0\01\31\e0\a0\c1\02\38\fd\34\62\cd\94\1e\6f\e5\cd\94\1e\e1\67\22\7d\5c\c1\c3\20\24\df\fe\2c\28\06\cd\ee\1b\c3\77\24\e7\cd\82\1c\cd\ee\1b\ef\c5\a2\04\1f\31\30\30\00\06\02\38\c3\77\24\c0\02\c1\02\31\2a\e1\01\e1\2a\0f\e0\05\2a\e0\01\3d\38\7e\fe\81\30\07\ef\02\02\38\c3\77\24\cd\7d\24\c5\ef\02\e1\01\05\c1\02\01\31\e1\04\c2\02\01\31\e1\04\e2\e5\e0\03\a2\04\31\1f\c5\02\20\c0\02\c2\02\c1\e5\04\e0\e2\04\0f\e1\01\c1\02\e0\04\e2\e5\04\03\c2\2a\e1\2a\0f\02\38\1a\fe\81")
  (data (i32.const 0x1_4100) "\c1\da\77\24\c5\ef\01\38\3a\7d\5c\cd\28\2d\ef\c0\0f\01\38\3a\7e\5c\cd\28\2d\ef\c5\0f\e0\e5\38\c1\05\28\3c\18\14\ef\e1\31\e3\04\e2\e4\04\03\c1\02\e4\04\e2\e3\04\0f\c2\02\38\c5\ef\c0\02\e1\0f\31\38\3a\7d\5c\cd\28\2d\ef\03\e0\e2\0f\c0\01\e0\38\3a\7e\5c\cd\28\2d\ef\03\38\cd\b7\24\c1\10\c6\ef\02\02\01\38\3a\7d\5c\cd\28\2d\ef\03\01\38\3a\7e\5c\cd\28\2d\ef\03\38\cd\b7\24\c3\4d\0d\ef\31\28\34\32\00\01\05\e5\01\05\2a\38\cd\d5\2d\38\06\e6\fc\c6\04\30\02\3e\fc\f5\cd\28\2d\ef\e5\01\05\31\1f\c4\02\31\a2\04\1f\c1\01\c0\02\31\04\31\0f\a1\03\1b\c3\02\38\c1\c9\cd\07\23\79\b8\30\06\69\d5\af\5f\18\07\b1\c8\68\41\d5\16\00\60\78\1f\85\38\03\bc\38\07\94\4f\d9\c1\c5\18\04\4f\d5\d9\c1\2a\7d\5c\78\84\47\79\3c\85\38\0d\28\0d\3d\4f\cd\e5\22\d9\79\10\d9\d1\c9\28\f3\cf\0a\df\06\00\c5\4f")
  (data (i32.const 0x1_4200) "\21\96\25\cd\dc\16\79\d2\84\26\06\00\4e\09\e9\cd\74\00\03\fe\0d\ca\8a\1c\fe\22\20\f3\cd\74\00\fe\22\c9\e7\fe\28\20\06\cd\79\1c\df\fe\29\c2\8a\1c\fd\cb\01\7e\c9\cd\07\23\2a\36\5c\11\00\01\19\79\0f\0f\0f\e6\e0\a8\5f\79\e6\18\ee\40\57\06\60\c5\d5\e5\1a\ae\28\04\3c\20\1a\3d\4f\06\07\14\23\1a\ae\a9\20\0f\10\f7\c1\c1\c1\3e\80\90\01\01\00\f7\12\18\0a\e1\11\08\00\19\d1\c1\10\d3\48\c3\b2\2a\cd\07\23\79\0f\0f\0f\4f\e6\e0\a8\6f\79\e6\03\ee\58\67\7e\c3\28\2d\22\1c\28\4f\2e\f2\2b\12\a8\56\a5\57\a7\84\a6\8f\c4\e6\aa\bf\ab\c7\a9\ce\00\e7\c3\ff\24\df\23\e5\01\00\00\cd\0f\25\20\1b\cd\0f\25\28\fb\cd\30\25\28\11\f7\e1\d5\7e\23\12\13\fe\22\20\f8\7e\23\fe\22\28\f2\0b\d1\21\3b\5c\cb\b6\cb\7e\c4\b2\2a\c3\12\27\e7\cd\fb\24\fe\29\c2\8a\1c\e7\c3\12\27\c3\bd\27\cd\30\25\28\28\ed\4b\76")
  (data (i32.const 0x1_4300) "\5c\cd\2b\2d\ef\a1\0f\34\37\16\04\34\80\41\00\00\80\32\02\a1\03\31\38\cd\a2\2d\ed\43\76\5c\7e\a7\28\03\d6\10\77\18\09\cd\30\25\28\04\ef\a3\38\34\e7\c3\c3\26\01\5a\10\e7\fe\23\ca\0d\27\21\3b\5c\cb\b6\cb\7e\28\1f\cd\8e\02\0e\00\20\13\cd\1e\03\30\0e\15\5f\cd\33\03\f5\01\01\00\f7\f1\12\0e\01\06\00\cd\b2\2a\c3\12\27\cd\22\25\c4\35\25\e7\c3\db\25\cd\22\25\c4\80\25\e7\18\48\cd\22\25\c4\cb\22\e7\18\3f\cd\88\2c\30\56\fe\41\30\3c\cd\30\25\20\23\cd\9b\2c\df\01\06\00\cd\55\16\23\36\0e\23\eb\2a\65\5c\0e\05\a7\ed\42\22\65\5c\ed\b0\eb\2b\cd\77\00\18\0e\df\23\7e\fe\0e\20\fa\23\cd\b4\33\22\5d\5c\fd\cb\01\f6\18\14\cd\b2\28\da\2e\1c\cc\96\29\3a\3b\5c\fe\c0\38\04\23\cd\b4\33\18\33\01\db\09\fe\2d\28\27\01\18\10\fe\ae\28\20\d6\af\da\8a\1c\01\f0\04\fe\14\28\14\d2\8a\1c\06\10\c6\dc")
  (data (i32.const 0x1_4400) "\4f\fe\df\30\02\cb\b1\fe\ee\38\02\cb\b9\c5\e7\c3\ff\24\df\fe\28\20\0c\fd\cb\01\76\20\17\cd\52\2a\e7\18\f0\06\00\4f\21\95\27\cd\dc\16\30\06\4e\21\ed\26\09\46\d1\7a\b8\38\3a\a7\ca\18\00\c5\21\3b\5c\7b\fe\ed\20\06\cb\76\20\02\1e\99\d5\cd\30\25\28\09\7b\e6\3f\47\ef\3b\38\18\09\7b\fd\ae\01\e6\40\c2\8a\1c\d1\21\3b\5c\cb\f6\cb\7b\20\02\cb\b6\c1\18\c1\d5\79\fd\cb\01\76\20\15\e6\3f\c6\08\4f\fe\10\20\04\cb\f1\18\08\38\d7\fe\17\28\02\cb\f9\c5\e7\c3\ff\24\2b\cf\2d\c3\2a\c4\2f\c5\5e\c6\3d\ce\3e\cc\3c\cd\c7\c9\c8\ca\c9\cb\c5\c7\c6\c8\00\06\08\08\0a\02\03\05\05\05\05\05\05\06\cd\30\25\20\35\e7\cd\8d\2c\d2\8a\1c\e7\fe\24\f5\20\01\e7\fe\28\20\12\e7\fe\29\28\10\cd\fb\24\df\fe\2c\20\03\e7\18\f5\fe\29\c2\8a\1c\e7\21\3b\5c\cb\b6\f1\28\02\cb\f6\c3\12\27\e7\e6\df\47\e7\d6\24\4f\20")
  (data (i32.const 0x1_4500) "\01\e7\e7\e5\2a\53\5c\2b\11\ce\00\c5\cd\86\1d\c1\30\02\cf\18\e5\cd\ab\28\e6\df\b8\20\08\cd\ab\28\d6\24\b9\28\0c\e1\2b\11\00\02\c5\cd\8b\19\c1\18\d7\a7\cc\ab\28\d1\d1\ed\53\5d\5c\cd\ab\28\e5\fe\29\28\42\23\7e\fe\0e\16\40\28\07\2b\cd\ab\28\23\16\00\23\e5\d5\cd\fb\24\f1\fd\ae\01\e6\40\20\2b\e1\eb\2a\65\5c\01\05\00\ed\42\22\65\5c\ed\b0\eb\2b\cd\ab\28\fe\29\28\0d\e5\df\fe\2c\20\0d\e7\e1\cd\ab\28\18\be\e5\df\fe\29\28\02\cf\19\d1\eb\22\5d\5c\2a\0b\5c\e3\22\0b\5c\d5\e7\e7\cd\fb\24\e1\22\5d\5c\e1\22\0b\5c\e7\c3\12\27\23\7e\fe\21\38\fa\c9\fd\cb\01\f6\df\cd\8d\2c\d2\8a\1c\e5\e6\1f\4f\e7\e5\fe\28\28\28\cb\f1\fe\24\28\11\cb\e9\cd\88\2c\30\0f\cd\88\2c\30\16\cb\b1\e7\18\f6\e7\fd\cb\01\b6\3a\0c\5c\a7\28\06\cd\30\25\c2\51\29\41\cd\30\25\20\08\79\e6\e0\cb\ff\4f\18\37\2a\4b\5c")
  (data (i32.const 0x1_4600) "\7e\e6\7f\28\2d\b9\20\22\17\87\f2\3f\29\38\30\d1\d5\e5\23\1a\13\fe\20\28\fa\f6\20\be\28\f4\f6\80\be\20\06\1a\cd\88\2c\30\15\e1\c5\cd\b8\19\eb\c1\18\ce\cb\f8\d1\df\fe\28\28\09\cb\e8\18\0d\d1\d1\d1\e5\df\cd\88\2c\30\03\e7\18\f8\e1\cb\10\cb\70\c9\2a\0b\5c\7e\fe\29\ca\ef\28\7e\f6\60\47\23\7e\fe\0e\28\07\2b\cd\ab\28\23\cb\a8\78\b9\28\12\23\23\23\23\23\cd\ab\28\fe\29\ca\ef\28\cd\ab\28\18\d9\cb\69\20\0c\23\ed\5b\65\5c\cd\c0\33\eb\22\65\5c\d1\d1\af\3c\c9\af\47\cb\79\20\4b\cb\7e\20\0e\3c\23\4e\23\46\23\eb\cd\b2\2a\df\c3\49\2a\23\23\23\46\cb\71\28\0a\05\28\e8\eb\df\fe\28\20\61\eb\eb\18\24\e5\df\e1\fe\2c\28\20\cb\79\28\52\cb\71\20\06\fe\29\20\3c\e7\c9\fe\29\28\6c\fe\cc\20\32\df\2b\22\5d\5c\18\5e\21\00\00\e5\e7\e1\79\fe\c0\20\09\df\fe\29\28\51\fe\cc\28\e5\c5\e5\cd\ee\2a")
  (data (i32.const 0x1_4700) "\e3\eb\cd\cc\2a\38\19\0b\cd\f4\2a\09\d1\c1\10\b3\cb\79\20\66\e5\cb\71\20\13\42\4b\df\fe\29\28\02\cf\02\e7\e1\11\05\00\cd\f4\2a\09\c9\cd\ee\2a\e3\cd\f4\2a\c1\09\23\42\4b\eb\cd\b1\2a\df\fe\29\28\07\fe\2c\20\db\cd\52\2a\e7\fe\28\28\f8\fd\cb\01\b6\c9\cd\30\25\c4\f1\2b\e7\fe\29\28\50\d5\af\f5\c5\11\01\00\df\e1\fe\cc\28\17\f1\cd\cd\2a\f5\50\59\e5\df\e1\fe\cc\28\09\fe\29\c2\8a\1c\62\6b\18\13\e5\e7\e1\fe\29\28\0c\f1\cd\cd\2a\f5\df\60\69\fe\29\20\e6\f1\e3\19\2b\e3\a7\ed\52\01\00\00\38\07\23\a7\fa\20\2a\44\4d\d1\fd\cb\01\b6\cd\30\25\c8\af\fd\cb\01\b6\c5\cd\a9\33\c1\2a\65\5c\77\23\73\23\72\23\71\23\70\23\22\65\5c\c9\af\d5\e5\f5\cd\82\1c\f1\cd\30\25\28\12\f5\cd\99\1e\d1\78\b1\37\28\05\e1\e5\a7\ed\42\7a\de\00\e1\d1\c9\eb\23\5e\23\56\c9\cd\30\25\c8\cd\a9\30\da\15\1f\c9\2a")
  (data (i32.const 0x1_4800) "\4d\5c\fd\cb\37\4e\28\5e\01\05\00\03\23\7e\fe\20\28\fa\30\0b\fe\10\38\11\fe\16\30\0d\23\18\ed\cd\88\2c\38\e7\fe\24\ca\c0\2b\79\2a\59\5c\2b\cd\55\16\23\23\eb\d5\2a\4d\5c\1b\d6\06\47\28\11\23\7e\fe\21\38\fa\f6\20\13\12\10\f4\f6\80\12\3e\c0\2a\4d\5c\ae\f6\20\e1\cd\ea\2b\e5\ef\02\38\e1\01\05\00\a7\ed\42\18\40\fd\cb\01\76\28\06\11\06\00\19\18\e7\2a\4d\5c\ed\4b\72\5c\fd\cb\37\46\20\30\78\b1\c8\e5\f7\d5\c5\54\5d\23\36\20\ed\b8\e5\cd\f1\2b\e1\e3\a7\ed\42\09\30\02\44\4d\e3\eb\78\b1\28\02\ed\b0\c1\d1\e1\eb\78\b1\c8\d5\ed\b0\e1\c9\2b\2b\2b\7e\e5\c5\cd\c6\2b\c1\e1\03\03\03\c3\e8\19\3e\df\2a\4d\5c\a6\f5\cd\f1\2b\eb\09\c5\2b\22\4d\5c\03\03\03\2a\59\5c\2b\cd\55\16\2a\4d\5c\c1\c5\03\ed\b8\eb\23\c1\70\2b\71\f1\2b\77\2a\59\5c\2b\c9\2a\65\5c\2b\46\2b\4e\2b\56\2b\5e\2b\7e\22\65")
  (data (i32.const 0x1_4900) "\5c\c9\cd\b2\28\c2\8a\1c\cd\30\25\20\08\cb\b1\cd\96\29\cd\ee\1b\38\08\c5\cd\b8\19\cd\e8\19\c1\cb\f9\06\00\c5\21\01\00\cb\71\20\02\2e\05\eb\e7\26\ff\cd\cc\2a\da\20\2a\e1\c5\24\e5\60\69\cd\f4\2a\eb\df\fe\2c\28\e8\fe\29\20\bb\e7\c1\79\68\26\00\23\23\29\19\da\15\1f\d5\c5\e5\44\4d\2a\59\5c\2b\cd\55\16\23\77\c1\0b\0b\0b\23\71\23\70\c1\78\23\77\62\6b\1b\36\00\cb\71\28\02\36\20\c1\ed\b8\c1\70\2b\71\2b\3d\20\f8\c9\cd\1b\2d\3f\d8\fe\41\3f\d0\fe\5b\d8\fe\61\3f\d0\fe\7b\c9\fe\c4\20\19\11\00\00\e7\d6\31\ce\00\20\0a\eb\3f\ed\6a\da\ad\31\eb\18\ef\42\4b\c3\2b\2d\fe\2e\28\0f\cd\3b\2d\fe\2e\20\28\e7\cd\1b\2d\38\22\18\0a\e7\cd\1b\2d\da\8a\1c\ef\a0\38\ef\a1\c0\02\38\df\cd\22\2d\38\0b\ef\e0\a4\05\c0\04\0f\38\e7\18\ef\fe\45\28\03\fe\65\c0\06\ff\e7\fe\2b\28\05\fe\2d\20\02\04\e7\cd")
  (data (i32.const 0x1_4a00) "\1b\2d\38\cb\c5\cd\3b\2d\cd\d5\2d\c1\da\ad\31\a7\fa\ad\31\04\28\02\ed\44\c3\4f\2d\fe\30\d8\fe\3a\3f\c9\cd\1b\2d\d8\d6\30\4f\06\00\fd\21\3a\5c\af\5f\51\48\47\cd\b6\2a\ef\38\a7\c9\f5\ef\a0\38\f1\cd\22\2d\d8\ef\01\a4\04\0f\38\cd\74\00\18\f1\07\0f\30\02\2f\3c\f5\21\92\5c\cd\0b\35\ef\a4\38\f1\cb\3f\30\0d\f5\ef\c1\e0\00\04\04\33\02\05\e1\38\f1\28\08\f5\ef\31\04\38\f1\18\e5\ef\02\38\c9\23\4e\23\7e\a9\91\5f\23\7e\89\a9\57\c9\0e\00\e5\36\00\23\71\23\7b\a9\91\77\23\7a\89\a9\77\23\36\00\e1\c9\ef\38\7e\a7\28\05\ef\a2\0f\27\38\ef\02\38\e5\d5\eb\46\cd\7f\2d\af\90\cb\79\42\4b\7b\d1\e1\c9\57\17\9f\5f\4f\af\47\cd\b6\2a\ef\34\ef\1a\20\9a\85\04\27\38\cd\a2\2d\d8\f5\05\04\28\03\f1\37\c9\f1\c9\ef\31\36\00\0b\31\37\00\0d\02\38\3e\30\d7\c9\2a\38\3e\2d\d7\ef\a0\c3\c4\c5\02\38\d9\e5")
  (data (i32.const 0x1_4b00) "\d9\ef\31\27\c2\03\e2\01\c2\02\38\7e\a7\20\47\cd\7f\2d\06\10\7a\a7\20\06\b3\28\09\53\06\08\d5\d9\d1\d9\18\57\ef\e2\38\7e\d6\7e\cd\c1\2d\57\3a\ac\5c\92\32\ac\5c\7a\cd\4f\2d\ef\31\27\c1\03\e1\38\cd\d5\2d\e5\32\a1\5c\3d\17\9f\3c\21\ab\5c\77\23\86\77\e1\c3\cf\2e\d6\80\fe\1c\38\13\cd\c1\2d\d6\07\47\21\ac\5c\86\77\78\ed\44\cd\4f\2d\18\92\eb\cd\ba\2f\d9\cb\fa\7d\d9\d6\80\47\cb\23\cb\12\d9\cb\13\cb\12\d9\21\aa\5c\0e\05\7e\8f\27\77\2b\0d\20\f8\10\e7\af\21\a6\5c\11\a1\5c\06\09\ed\6f\0e\ff\ed\6f\20\04\0d\0c\20\0a\12\13\fd\34\71\fd\34\72\0e\00\cb\40\28\01\23\10\e7\3a\ab\5c\d6\09\38\0a\fd\35\71\3e\04\fd\be\6f\18\41\ef\02\e2\38\eb\cd\ba\2f\d9\3e\80\95\2e\00\cb\fa\d9\cd\dd\2f\fd\7e\71\fe\08\38\06\d9\cb\12\d9\18\20\01\00\02\7b\cd\8b\2f\5f\7a\cd\8b\2f\57\c5\d9\c1\10\f1\21\a1")
  (data (i32.const 0x1_4c00) "\5c\79\fd\4e\71\09\77\fd\34\71\18\d3\f5\21\a1\5c\fd\4e\71\06\00\09\41\f1\2b\7e\ce\00\77\a7\28\05\fe\0a\3f\30\08\10\f1\36\01\04\fd\34\72\fd\70\71\ef\02\38\d9\e1\d9\ed\4b\ab\5c\21\a1\5c\78\fe\09\38\04\fe\fc\38\26\a7\cc\ef\15\af\90\fa\52\2f\47\18\0c\79\a7\28\03\7e\23\0d\cd\ef\15\10\f4\79\a7\c8\04\3e\2e\d7\3e\30\10\fb\41\18\e6\50\15\06\01\cd\4a\2f\3e\45\d7\4a\79\a7\f2\83\2f\ed\44\4f\3e\2d\18\02\3e\2b\d7\06\00\c3\1b\1a\d5\6f\26\00\5d\54\29\29\19\29\59\19\4c\7d\d1\c9\7e\36\00\a7\c8\23\cb\7e\cb\fe\2b\c8\c5\01\05\00\09\41\4f\37\2b\7e\2f\ce\00\77\10\f8\79\c1\c9\e5\f5\4e\23\46\77\23\79\4e\c5\23\4e\23\46\eb\57\5e\d5\23\56\23\5e\d5\d9\d1\e1\c1\d9\23\56\23\5e\f1\e1\c9\a7\c8\fe\21\30\16\c5\47\d9\cb\2d\cb\1a\cb\1b\d9\cb\1a\cb\1b\10\f2\c1\d0\cd\04\30\c0\d9\af\2e\00\57\5d\d9")
  (data (i32.const 0x1_4d00) "\11\00\00\c9\1c\c0\14\c0\d9\1c\20\01\14\d9\c9\eb\cd\6e\34\eb\1a\b6\20\26\d5\23\e5\23\5e\23\56\23\23\23\7e\23\4e\23\46\e1\eb\09\eb\8e\0f\ce\00\20\0b\9f\77\23\73\23\72\2b\2b\2b\d1\c9\2b\d1\cd\93\32\d9\e5\d9\d5\e5\cd\9b\2f\47\eb\cd\9b\2f\4f\b8\30\03\78\41\eb\f5\90\cd\ba\2f\cd\dd\2f\f1\e1\77\e5\68\61\19\d9\eb\ed\4a\eb\7c\8d\6f\1f\ad\d9\eb\e1\1f\30\08\3e\01\cd\dd\2f\34\28\23\d9\7d\e6\80\d9\23\77\2b\28\1f\7b\ed\44\3f\5f\7a\2f\ce\00\57\d9\7b\2f\ce\00\5f\7a\2f\ce\00\30\07\1f\d9\34\ca\ad\31\d9\57\d9\af\c3\55\31\c5\06\10\7c\4d\21\00\00\29\38\0a\cb\11\17\30\03\19\38\02\10\f3\c1\c9\cd\e9\34\d8\23\ae\cb\fe\2b\c9\1a\b6\20\22\d5\e5\d5\cd\7f\2d\eb\e3\41\cd\7f\2d\78\a9\4f\e1\cd\a9\30\eb\e1\38\0a\7a\b3\20\01\4f\cd\8e\2d\d1\c9\d1\cd\93\32\af\cd\c0\30\d8\d9\e5\d9\d5\eb\cd\c0\30")
  (data (i32.const 0x1_4e00) "\eb\38\5a\e5\cd\ba\2f\78\a7\ed\62\d9\e5\ed\62\d9\06\21\18\11\30\05\19\d9\ed\5a\d9\d9\cb\1c\cb\1d\d9\cb\1c\cb\1d\d9\cb\18\cb\19\d9\cb\19\1f\10\e4\eb\d9\eb\d9\c1\e1\78\81\20\01\a7\3d\3f\17\3f\1f\f2\46\31\30\68\a7\3c\20\08\38\06\d9\cb\7a\d9\20\5c\77\d9\78\d9\30\15\7e\a7\3e\80\28\01\af\d9\a2\cd\fb\2f\07\77\38\2e\23\77\2b\18\29\06\20\d9\cb\7a\d9\20\12\07\cb\13\cb\12\d9\cb\13\cb\12\d9\35\28\d7\10\ea\18\d7\17\30\0c\cd\04\30\20\07\d9\16\80\d9\34\28\18\e5\23\d9\d5\d9\c1\78\17\cb\16\1f\77\23\71\23\72\23\73\e1\d1\d9\e1\d9\c9\cf\05\cd\93\32\eb\af\cd\c0\30\38\f4\eb\cd\c0\30\d8\d9\e5\d9\d5\e5\cd\ba\2f\d9\e5\60\69\d9\61\68\af\06\df\18\10\17\cb\11\d9\cb\11\cb\10\d9\29\d9\ed\6a\d9\38\10\ed\52\d9\ed\52\d9\30\0f\19\d9\ed\5a\d9\a7\18\08\a7\ed\52\d9\ed\52\d9\37\04\fa\d2\31\f5\28")
  (data (i32.const 0x1_4f00) "\e1\5f\51\d9\59\50\f1\cb\18\f1\cb\18\d9\c1\e1\78\91\c3\3d\31\7e\a7\c8\fe\81\30\06\36\00\3e\20\18\51\fe\91\20\1a\23\23\23\3e\80\a6\2b\b6\2b\20\03\3e\80\ae\2b\20\36\77\23\36\ff\2b\3e\18\18\33\30\2c\d5\2f\c6\91\23\56\23\5e\2b\2b\0e\00\cb\7a\28\01\0d\cb\fa\06\08\90\80\38\04\5a\16\00\90\28\07\47\cb\3a\cb\1b\10\fa\cd\8e\2d\d1\c9\7e\d6\a0\f0\ed\44\d5\eb\2b\47\cb\38\cb\38\cb\38\28\05\36\00\2b\10\fb\e6\07\28\09\47\3e\ff\cb\27\10\fc\a6\77\eb\d1\c9\cd\96\32\eb\7e\a7\c0\d5\cd\7f\2d\af\23\77\2b\77\06\91\7a\a7\20\08\b3\42\28\10\53\58\06\89\eb\05\29\30\fc\cb\09\cb\1c\cb\1d\eb\2b\73\2b\72\2b\70\d1\c9\00\b0\00\40\b0\00\01\30\00\f1\49\0f\da\a2\40\b0\00\0a\8f\36\3c\34\a1\33\0f\30\ca\30\af\31\51\38\1b\35\24\35\3b\35\3b\35\3b\35\3b\35\3b\35\3b\35\14\30\2d\35\3b\35\3b\35\3b\35\3b")
  (data (i32.const 0x1_5000) "\35\3b\35\3b\35\9c\35\de\35\bc\34\45\36\6e\34\69\36\de\35\74\36\b5\37\aa\37\da\37\33\38\43\38\e2\37\13\37\c4\36\af\36\4a\38\92\34\6a\34\ac\34\a5\34\b3\34\1f\36\c9\35\01\35\c0\33\a0\36\86\36\c6\33\7a\36\06\35\f9\34\9b\36\83\37\14\32\a2\33\4f\2d\97\32\49\34\1b\34\2d\34\0f\34\cd\bf\35\78\32\67\5c\d9\e3\d9\ed\53\65\5c\d9\7e\23\e5\a7\f2\80\33\57\e6\60\0f\0f\0f\0f\c6\7c\6f\7a\e6\1f\18\0e\fe\18\30\08\d9\01\fb\ff\54\5d\09\d9\07\6f\11\d7\32\26\00\19\5e\23\56\21\65\33\e3\d5\d9\ed\4b\66\5c\c9\f1\3a\67\5c\d9\18\c3\d5\e5\01\05\00\cd\05\1f\e1\d1\c9\ed\5b\65\5c\cd\c0\33\ed\53\65\5c\c9\cd\a9\33\ed\b0\c9\62\6b\cd\a9\33\d9\e5\d9\e3\c5\7e\e6\c0\07\07\4f\0c\7e\e6\3f\20\02\23\7e\c6\50\12\3e\05\91\23\13\06\00\ed\b0\c1\e3\d9\e1\d9\47\af\05\c8\12\13\18\fa\a7\c8\f5\d5\11\00\00\cd\c8")
  (data (i32.const 0x1_5100) "\33\d1\f1\3d\18\f2\4f\07\07\81\4f\06\00\09\c9\d5\2a\68\5c\cd\06\34\cd\c0\33\e1\c9\62\6b\d9\e5\21\c5\32\d9\cd\f7\33\cd\c8\33\d9\e1\d9\c9\e5\eb\2a\68\5c\cd\06\34\eb\cd\c0\33\eb\e1\c9\06\05\1a\4e\eb\12\71\23\13\10\f7\eb\c9\47\cd\5e\33\31\0f\c0\02\a0\c2\31\e0\04\e2\c1\03\38\cd\c6\33\cd\62\33\0f\01\c2\02\35\ee\e1\03\38\c9\06\ff\18\06\cd\e9\34\d8\06\00\7e\a7\28\0b\23\78\e6\80\b6\17\3f\1f\77\2b\c9\d5\e5\cd\7f\2d\e1\78\b1\2f\4f\cd\8e\2d\d1\c9\cd\e9\34\d8\d5\11\01\00\23\cb\16\2b\9f\4f\cd\8e\2d\d1\c9\cd\99\1e\ed\78\18\04\cd\99\1e\0a\c3\28\2d\cd\99\1e\21\2b\2d\e5\c5\c9\cd\f1\2b\0b\78\b1\20\23\1a\cd\8d\2c\38\09\d6\90\38\19\fe\15\30\15\3c\3d\87\87\87\fe\a8\30\0c\ed\4b\7b\5c\81\4f\30\01\04\c3\2b\2d\cf\09\e5\c5\47\7e\23\b6\23\b6\23\b6\78\c1\e1\c0\37\c9\cd\e9\34\d8\3e\ff\18")
  (data (i32.const 0x1_5200) "\06\cd\e9\34\18\05\af\23\ae\2b\07\e5\3e\00\77\23\77\23\17\77\1f\23\77\23\77\e1\c9\eb\cd\e9\34\eb\d8\37\18\e7\eb\cd\e9\34\eb\d0\a7\18\de\eb\cd\e9\34\eb\d0\d5\1b\af\12\1b\12\d1\c9\78\d6\08\cb\57\20\01\3d\0f\30\08\f5\e5\cd\3c\34\d1\eb\f1\cb\57\20\07\0f\f5\cd\0f\30\18\33\0f\f5\cd\f1\2b\d5\c5\cd\f1\2b\e1\7c\b5\e3\78\20\0b\b1\c1\28\04\f1\3f\18\16\f1\18\13\b1\28\0d\1a\96\38\09\20\ed\0b\13\23\e3\2b\18\df\c1\f1\a7\f5\ef\a0\38\f1\f5\dc\01\35\f1\f5\d4\f9\34\f1\0f\d4\01\35\c9\cd\f1\2b\d5\c5\cd\f1\2b\e1\e5\d5\c5\09\44\4d\f7\cd\b2\2a\c1\e1\78\b1\28\02\ed\b0\c1\e1\78\b1\28\02\ed\b0\2a\65\5c\11\fb\ff\e5\19\d1\c9\cd\d5\2d\38\0e\20\0c\f5\01\01\00\f7\f1\12\cd\b2\2a\eb\c9\cf\0a\2a\5d\5c\e5\78\c6\e3\9f\f5\cd\f1\2b\d5\03\f7\e1\ed\53\5d\5c\d5\ed\b0\eb\2b\36\0d\fd\cb\01\be\cd\fb\24")
  (data (i32.const 0x1_5300) "\df\fe\0d\20\07\e1\f1\fd\ae\01\e6\40\c2\8a\1c\22\5d\5c\fd\cb\01\fe\cd\fb\24\e1\22\5d\5c\18\a0\01\01\00\f7\22\5b\5c\e5\2a\51\5c\e5\3e\ff\cd\01\16\cd\e3\2d\e1\cd\15\16\d1\2a\5b\5c\a7\ed\52\44\4d\cd\b2\2a\eb\c9\cd\94\1e\fe\10\d2\9f\1e\2a\51\5c\e5\cd\01\16\cd\e6\15\01\00\00\30\03\0c\f7\12\cd\b2\2a\e1\cd\15\16\c3\bf\35\cd\f1\2b\78\b1\28\01\1a\c3\28\2d\cd\f1\2b\c3\2b\2d\d9\e5\21\67\5c\35\e1\20\04\23\d9\c9\d9\5e\7b\17\9f\57\19\d9\c9\13\13\1a\1b\1b\a7\20\ef\d9\23\d9\c9\f1\d9\e3\d9\c9\ef\c0\02\31\e0\05\27\e0\01\c0\04\03\e0\38\c9\ef\31\36\00\04\3a\38\c9\31\3a\c0\03\e0\01\30\00\03\a1\03\38\c9\ef\3d\34\f1\38\aa\3b\29\04\31\27\c3\03\31\0f\a1\03\88\13\36\58\65\66\9d\78\65\40\a2\60\32\c9\e7\21\f7\af\24\eb\2f\b0\b0\14\ee\7e\bb\94\58\f1\3a\7e\f8\cf\e3\38\cd\d5\2d\20\07\38\03")
  (data (i32.const 0x1_5400) "\86\30\09\cf\05\38\07\96\30\04\ed\44\77\c9\ef\02\a0\38\c9\ef\3d\31\37\00\04\38\cf\09\a0\02\38\7e\36\80\cd\28\2d\ef\34\38\00\03\01\31\34\f0\4c\cc\cc\cd\03\37\00\08\01\a1\03\01\38\34\ef\01\34\f0\31\72\17\f8\04\01\a2\03\a2\03\31\34\32\20\04\a2\03\8c\11\ac\14\09\56\da\a5\59\30\c5\5c\90\aa\9e\70\6f\61\a1\cb\da\96\a4\31\9f\b4\e7\a0\fe\5c\fc\ea\1b\43\ca\36\ed\a7\9c\7e\5e\f0\6e\23\80\93\04\0f\38\c9\ef\3d\34\ee\22\f9\83\6e\04\31\a2\0f\27\03\31\0f\31\0f\31\2a\a1\03\31\37\c0\00\04\02\38\c9\a1\03\01\36\00\02\1b\38\c9\ef\39\2a\a1\03\e0\00\06\1b\33\03\ef\39\31\31\04\31\0f\a1\03\86\14\e6\5c\1f\0b\a3\8f\38\ee\e9\15\63\bb\23\ee\92\0d\cd\ed\f1\23\5d\1b\ea\04\38\c9\ef\31\1f\01\20\05\38\c9\cd\97\32\7e\fe\81\38\0e\ef\a1\1b\01\05\31\36\a3\01\00\06\1b\33\03\ef\a0\01\31\31\04\31\0f")
  (data (i32.const 0x1_5500) "\a1\03\8c\10\b2\13\0e\55\e4\8d\58\39\bc\5b\98\fd\9e\00\36\75\a0\db\e8\b4\63\42\c4\e6\b5\09\36\be\e9\36\73\1b\5d\ec\d8\de\63\be\f0\61\a1\b3\0c\04\0f\38\c9\ef\31\31\04\a1\03\1b\28\a1\0f\05\24\31\0f\38\c9\ef\22\a3\03\1b\38\c9\ef\31\30\00\1e\a2\38\ef\01\31\30\00\07\25\04\38\c3\c4\36\02\31\30\00\09\a0\01\37\00\06\a1\01\05\02\a1\38\c9\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff")
  (data (i32.const 0x1_5600) "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff")
  (data (i32.const 0x1_5700) "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff")
  (data (i32.const 0x1_5800) "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff")
  (data (i32.const 0x1_5900) "\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff\ff")
  (data (i32.const 0x1_5a00) "\00\00\00\00\00\00\00\00\00\10\10\10\10\00\10\00\00\24\24\00\00\00\00\00\00\24\7e\24\24\7e\24\00\00\08\3e\28\3e\0a\3e\08\00\62\64\08\10\26\46\00\00\10\28\10\2a\44\3a\00\00\08\10\00\00\00\00\00\00\04\08\08\08\08\04\00\00\20\10\10\10\10\20\00\00\00\14\08\3e\08\14\00\00\00\08\08\3e\08\08\00\00\00\00\00\00\08\08\10\00\00\00\00\3e\00\00\00\00\00\00\00\00\18\18\00\00\00\02\04\08\10\20\00\00\3c\46\4a\52\62\3c\00\00\18\28\08\08\08\3e\00\00\3c\42\02\3c\40\7e\00\00\3c\42\0c\02\42\3c\00\00\08\18\28\48\7e\08\00\00\7e\40\7c\02\42\3c\00\00\3c\40\7c\42\42\3c\00\00\7e\02\04\08\10\10\00\00\3c\42\3c\42\42\3c\00\00\3c\42\42\3e\02\3c\00\00\00\00\10\00\00\10\00\00\00\10\00\00\10\10\20\00\00\04\08\10\08\04\00\00\00\00\3e\00\3e\00\00\00\00\10\08\04\08\10\00\00\3c\42\04\08\00\08\00")
  (data (i32.const 0x1_5b00) "\00\3c\4a\56\5e\40\3c\00\00\3c\42\42\7e\42\42\00\00\7c\42\7c\42\42\7c\00\00\3c\42\40\40\42\3c\00\00\78\44\42\42\44\78\00\00\7e\40\7c\40\40\7e\00\00\7e\40\7c\40\40\40\00\00\3c\42\40\4e\42\3c\00\00\42\42\7e\42\42\42\00\00\3e\08\08\08\08\3e\00\00\02\02\02\42\42\3c\00\00\44\48\70\48\44\42\00\00\40\40\40\40\40\7e\00\00\42\66\5a\42\42\42\00\00\42\62\52\4a\46\42\00\00\3c\42\42\42\42\3c\00\00\7c\42\42\7c\40\40\00\00\3c\42\42\52\4a\3c\00\00\7c\42\42\7c\44\42\00\00\3c\40\3c\02\42\3c\00\00\fe\10\10\10\10\10\00\00\42\42\42\42\42\3c\00\00\42\42\42\42\24\18\00\00\42\42\42\42\5a\24\00\00\42\24\18\18\24\42\00\00\82\44\28\10\10\10\00\00\7e\04\08\10\20\7e\00\00\0e\08\08\08\08\0e\00\00\00\40\20\10\08\04\00\00\70\10\10\10\10\70\00\00\10\38\54\10\10\10\00\00\00\00\00\00\00\00\ff")
  (data (i32.const 0x1_5c00) "\00\1c\22\78\20\20\7e\00\00\00\38\04\3c\44\3c\00\00\20\20\3c\22\22\3c\00\00\00\1c\20\20\20\1c\00\00\04\04\3c\44\44\3c\00\00\00\38\44\78\40\3c\00\00\0c\10\18\10\10\10\00\00\00\3c\44\44\3c\04\38\00\40\40\78\44\44\44\00\00\10\00\30\10\10\38\00\00\04\00\04\04\04\24\18\00\20\28\30\30\28\24\00\00\10\10\10\10\10\0c\00\00\00\68\54\54\54\54\00\00\00\78\44\44\44\44\00\00\00\38\44\44\44\38\00\00\00\78\44\44\78\40\40\00\00\3c\44\44\3c\04\06\00\00\1c\20\20\20\20\00\00\00\38\40\38\04\78\00\00\10\38\10\10\10\0c\00\00\00\44\44\44\44\38\00\00\00\44\44\28\28\10\00\00\00\44\54\54\54\28\00\00\00\44\28\10\28\44\00\00\00\44\44\44\3c\04\38\00\00\7c\08\10\20\7c\00\00\0e\08\30\08\08\0e\00\00\08\08\08\08\08\08\00\00\70\10\0c\10\10\70\00\00\14\28\00\00\00\00\00\3c\42\99\a1\a1\99\42\3c")

  ;; ==========================================================================
  ;; ZX Spectrum 48K functions

  ;; Reads the memory of the ZX Spectrum 48 machine
  (func $readMemorySp48 (param $addr i32) (result i32)
    get_global $SP_MEM_OFFS
    (i32.and (get_local $addr) (i32.const 0xffff))
    i32.add
    i32.load8_u ;; (memory value)

    (i32.and (get_local $addr) (i32.const 0xc000))
    (i32.eq (i32.const 0x4000))
    if
      call $applyContentionDelay
    end
  )

  ;; Reads the memory of the ZX Spectrum 48 machine in non-contended way
  (func $readMemoryNcSp48 (param $addr i32) (result i32)
    get_global $SP_MEM_OFFS
    (i32.and (get_local $addr) (i32.const 0xffff))
    i32.add
    i32.load8_u ;; (memory value)
  )

  ;; Writes the memory of the ZX Spectrum 48 machine
  (func $writememorySp48 (param $addr i32) (param $val i32)
    (local $memSegment i32)
    (i32.and (get_local $addr) (i32.const 0xffff)) ;; ($addr)
    (i32.and (tee_local $addr) (i32.const 0xc000))
    (i32.eq (tee_local $memSegment) (i32.const 0x0000))
    ;; Do not write to ROM
    if return end

    (i32.eq (get_local $memSegment) (i32.const 0x4000))
    if
      call $applyContentionDelay
    end
    (i32.add (get_global $SP_MEM_OFFS) (get_local $addr))
    get_local $val
    i32.store8
  )

  ;; Reads a port of the ZX Spectrum 48 machine
  ;; $addr: port address
  ;; Returns: value read from port
  (func $readPortSp48 (param $addr i32) (result i32)
    (call $applyIOContentionDelay (get_local $addr))
    (i32.and (get_local $addr) (i32.const 0x0001))
    (i32.eq (i32.const 0))
    if
      ;; Handle the 0xfe port
      (call $readPort$FE (get_local $addr))
      return
    end

    (i32.and (get_local $addr) (i32.const 0x00e0))
    (i32.eq (i32.const 0))
    if
      ;; Handle the Kempston port
      i32.const 0xff
      return
    end

    ;; TODO: Implement floating port handling
    i32.const 0xff
  )

  ;; Writes a port of the ZX Spectrum 48 machine
  ;; $addr: port address
  ;; $v: Port value
  (func $writePortSp48 (param $addr i32) (param $v i32)
    (call $applyIOContentionDelay (get_local $addr))
    (i32.and (get_local $addr) (i32.const 0x0001))
    (i32.eq (i32.const 0))
    if
      ;; Handle the 0xfe port
      (call $writePort$FE (get_local $addr) (get_local $v))
      return
    end
  )

  ;; Sets up the ZX Spectrum 48 machine
  (func $setupSpectrum48
    ;; CPU configuration
    i32.const 3_500_000 set_global $baseClockFrequency
    i32.const 1 set_global $clockMultiplier
    i32.const 0 set_global $supportsNextOperation
    
    ;; Memory configuration
    i32.const 1 set_global $numberOfRoms
    get_global $SPECTRUM_48_ROM_INDEX set_global $romContentsAddress
    i32.const 0 set_global $spectrum48RomIndex
    i32.const 1 set_global $contentionType
    i32.const 0 set_global $ramBanks
    i32.const 0 set_global $nextMemorySize

    ;; Screen frame configuration
    i32.const 11 set_global $interruptTact
    i32.const 8 set_global $verticalSyncLines
    i32.const 8 set_global $nonVisibleBorderTopLines
    i32.const 48 set_global $borderTopLines
    i32.const 48 set_global $borderBottomLines
    i32.const 8 set_global $nonVisibleBorderBottomLines
    i32.const 192 set_global $displayLines
    i32.const 24 set_global $borderLeftTime
    i32.const 24 set_global $borderRightTime
    i32.const 128 set_global $displayLineTime
    i32.const 40 set_global $horizontalBlankingTime
    i32.const 8 set_global $nonVisibleBorderRightTime
    i32.const 2 set_global $pixelDataPrefetchTime
    i32.const 1 set_global $attributeDataPrefetchTime

    call $calcScreenAttributes
    call $initRenderingTactTable

    ;; Setup ROM
    (call $copyMemory 
      (get_global $SPECTRUM_48_ROM_INDEX)
      (get_global $SP_MEM_OFFS)
      (i32.const 0x4000)
    )
  )

  ;; Gets the ZX Spectrum 48 machine state
  (func $getSpectrum48MachineState
  )

  ;; Colotizes the pixel data of ZX Spectrum 48
  (func $colorizeSp48
    (local $sourcePtr i32)
    (local $destPtr i32)
    (local $counter i32)

    ;; Calculate the counter
    (i32.mul (get_global $screenLines) (get_global $screenWidth))
    set_local $counter

    ;; Reset the pointers
    get_global $PIXEL_RENDERING_BUFFER set_local $sourcePtr
    get_global $COLORIZATION_BUFFER set_local $destPtr

    loop $colorizeLoop
      get_local $counter
      if
        get_local $destPtr ;; [destPtr]
        get_global $SPECTRUM_PALETTE ;; [destPtr, palette]

        ;; Get the pixel information
        get_local $sourcePtr
        i32.load8_u
        (i32.and (i32.const 0x0f))
        (i32.shl (i32.const 2)) ;; [destPtr, palette, pixelPalOffset]
        i32.add  ;; [destPtr, paletteAddr]
        i32.load ;; [destPtr, color]
        i32.store

        ;; Increment pointers
        (i32.add (get_local $sourcePtr) (i32.const 1))
        set_local $sourcePtr
        (i32.add (get_local $destPtr) (i32.const 4))
        set_local $destPtr

        ;; Decrement counter
        (i32.sub (get_local $counter) (i32.const 1))
        set_local $counter

        ;; Next loop
        br $colorizeLoop
      end
    end
  )
)

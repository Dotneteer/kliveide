;; ==========================================================================
;; Exported function

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
(export "initMachine" (func $initMachine))
(export "turnOnMachine" (func $turnOnMachine))
(export "setUlaIssue" (func $setUlaIssue))
(export "getMachineState" (func $getMachineState))
(export "setExecutionOptions" (func $setExecutionOptions))
(export "executeMachineCycle" (func $executeMachineCycle))
(export "setKeyStatus" (func $setKeyStatus))
(export "getKeyStatus" (func $getKeyStatus))
(export "setPC" (func $setPC))
(export "setSP" (func $setSP))
(export "setInterruptTact" (func $setInterruptTact))
(export "checkForInterrupt" (func $checkForInterrupt))
(export "setBeeperSampleRate" (func $setBeeperSampleRate))
(export "colorize" (func $colorize))
(export "getCursorMode" (func $getCursorMode))
(export "initTape" (func $initTape))
(export "setFastLoad" (func $setFastLoad))
(export "eraseBreakpoints" (func $eraseBreakPoints))
(export "setBreakpoint" (func $setBreakpoint))
(export "removeBreakpoint" (func $removeBreakpoint))
(export "testBreakpoint" (func $testBreakpoint))
(export "resetStepOverStack" (func $resetStepOverStack))
(export "markStepOverStack" (func $markStepOverStack))
(export "eraseMemoryWriteMap" (func $eraseMemoryWriteMap))
(export "setMemoryWritePoint" (func $setMemoryWritePoint))

;; Cambridge Z88 exports
(export "testIncZ88Rtc" (func $testIncZ88Rtc))
(export "testSetRtcRegs" (func $testSetRtcRegs))
(export "testSetZ88INT" (func $testSetZ88INT))
(export "testSetZ88STA" (func $testSetZ88STA))
(export "testSetZ88COM" (func $testSetZ88COM))

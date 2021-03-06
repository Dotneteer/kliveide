;; Test Z80 CPU machine exports
(export "resetStepOverStack" (func $resetStepOverStack))
(export "markStepOverStack" (func $markStepOverStack))
(export "setExecutionOptions" (func $setExecutionOptions))
(export "executeMachineLoop" (func $executeMachineLoop))
(export "setKeyStatus" (func $setKeyStatus))
(export "getKeyStatus" (func $getKeyStatus))

;; Cambridge Z88 exports
(export "turnOnMachine" (func $turnOnMachine))
(export "resetMachine" (func $resetMachine))
(export "getMachineState" (func $getMachineState))
(export "testIncZ88Rtc" (func $testIncZ88Rtc))
(export "testSetRtcRegs" (func $testSetRtcRegs))
(export "testSetZ88INT" (func $testSetZ88INT))
(export "testSetZ88STA" (func $testSetZ88STA))
(export "testSetZ88COM" (func $testSetZ88COM))
(export "testSetZ88TMK" (func $testSetZ88TMK))
(export "testReadCz88Memory" (func $testReadCz88Memory))
(export "testWriteCz88Memory" (func $testWriteCz88Memory))
(export "setZ88ChipMask" (func $setZ88ChipMask))
(export "setZ88Card3Rom" (func $setZ88Card3Rom))
(export "setZ88RndSeed" (func $setZ88RndSeed))
(export "writePortCz88" (func $writePort))
(export "clearMemory" (func $clearMemory))
(export "setZ88ScreenSize" (func $setZ88ScreenSize))
(export "raiseBatteryLow" (func $raiseBatteryLow))
(export "setBeeperSampleRate" (func $setBeeperSampleRate))

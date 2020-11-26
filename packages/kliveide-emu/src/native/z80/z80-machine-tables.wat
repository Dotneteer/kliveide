;; ============================================================================
;; Machine type tables

;; Machine types table
;; $MACHINES_TABLE# = 1288

;; Function indexes
;; 0: Read memory (func (param $addr i32) (result i32)))
;; 1: Write memory (func (param $addr i32) (param $v i32)))
;; 2: Read port (func (param $addr i32) (result i32)))
;; 3: Write port (func (param $addr i32) (param $v i32)))
;; 4: Write TbBlue register index (func (param $addr i32)))
;; 5: Write TbBlue register value (func (param $addr i32)))
;; 6: Setup machine (func)
;; 7: Get machine state (func)
;; 8: Colorize (func)
;; 9: Execute machine cycle
;; 10-19: Unused
(elem (i32.const $MACHINES_TABLE#)
  ;; Index 0: Machine type #0 (ZX Spectrum 48K)
  $readPagedMemory16            ;; 0
  $writePagedMemory16           ;; 1
  $readPortSp48                 ;; 2
  $writePortSp48                ;; 3
  $NOOP                         ;; 4
  $NOOP                         ;; 5
  $setupSpectrum48              ;; 6
  $getSpectrum48MachineState    ;; 7
  $colorizeSp48                 ;; 8
  $executeSpectrumMachineCycle  ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19

  ;; Index 20: Machine type #1 (ZX Spectrum 128K)
  $readPagedMemory16            ;; 0
  $writePagedMemory16           ;; 1
  $readPortSp128                ;; 2
  $writePortSp128               ;; 3
  $NOOP                         ;; 4
  $NOOP                         ;; 5
  $setupSpectrum128             ;; 6
  $getSpectrum128MachineState   ;; 7
  $colorizeSp48                 ;; 8
  $executeSpectrumMachineCycle  ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19

  ;; Index 40: Machine type #2 (ZX Spectrum +3)
  $defaultRead                  ;; 0
  $defaultWrite                 ;; 1
  $defaultIoRead                ;; 2
  $defaultIoWrite               ;; 3
  $NOOP                         ;; 4
  $NOOP                         ;; 5
  $NOOP                         ;; 6
  $NOOP                         ;; 7
  $NOOP                         ;; 8
  $NOOP                         ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19

  ;; Index 60: Machine type #3 (ZX Spectrum Next)
  $defaultRead                  ;; 0
  $defaultWrite                 ;; 1
  $defaultIoRead                ;; 2
  $defaultIoWrite               ;; 3
  $NOOP                         ;; 4
  $NOOP                         ;; 5
  $NOOP                         ;; 6
  $NOOP                         ;; 7
  $NOOP                         ;; 8
  $NOOP                         ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19

  ;; Index 80: Test Z80 CPU Machine (type #4)
  $testMachineRead              ;; 0
  $testMachineWrite             ;; 1
  $testMachineIoRead            ;; 2
  $testMachineIoWrite           ;; 3
  $testMachineTbBlueIndexWrite  ;; 4
  $testMachineTbBlueValueWrite  ;; 5
  $NOOP                         ;; 6
  $NOOP                         ;; 7
  $NOOP                         ;; 8
  $NOOP                         ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19

  ;; Index 100: Cambridge Z88 Machine (type #5)
  $readCz88Memory               ;; 0
  $writeCz88Memory              ;; 1
  $readPortCz88                 ;; 2
  $writePortCz88                ;; 3
  $NOOP                         ;; 4
  $NOOP                         ;; 5
  $setupCz88                    ;; 6
  $getCz88MachineState          ;; 7
  $NOOP                         ;; 8
  $executeZ88MachineCycle       ;; 9
  $NOOP                         ;; 10
  $NOOP                         ;; 11
  $NOOP                         ;; 12
  $NOOP                         ;; 13
  $NOOP                         ;; 14
  $NOOP                         ;; 15
  $NOOP                         ;; 16
  $NOOP                         ;; 17
  $NOOP                         ;; 18
  $NOOP                         ;; 19
)

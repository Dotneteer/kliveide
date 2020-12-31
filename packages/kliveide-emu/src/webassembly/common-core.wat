;; ============================================================================
;; Common core variables

;; ----------------------------------------------------------------------------
;; CPU-related

;; Base CPU clock frequency
(global $baseClockFrequency (mut i32) (i32.const 0x0000))

;; Clock frequency multiplier
(global $clockMultiplier (mut i32) (i32.const 0x0000))

;; Default clock frequency multiplier
(global $defaultClockMultiplier (mut i32) (i32.const 1))

;; ----------------------------------------------------------------------------
;; Screen related

;; Total width of the screen
(global $screenWidth (mut i32) (i32.const 0x0000))

;; Total number of screen lines
(global $screenLines (mut i32) (i32.const 0x0000))

;; ----------------------------------------------------------------------------
;; Execution engine constants
;;
;; $MEMCONT_NONE# = 0   // No contention
;; $MEMCONT_ULA# = 1    // ULA
;; $MEMCONT_GATEARR = 2 // Gate array
;; $MEMCONT_NEXT = 3    // ZX Spectrum Next
;;
;; $EMU_CONT# = 0        // Continuous
;; $EMU_HALT# = 1        // Until HALT
;; $EMU_CPU_FRAME# = 2   // Until CPU frame ends
;; $EMU_ULA_FRAME# = 3   // Until ULA frame ends
;; $EMU_TERM_POINT# = 4  // Until terminatio point
;;
;; $DEB_NONE# = 0        // None
;; $DEB_STOP_BR# = 1     // Stop at breakpoints
;; $DEB_INTO# = 2        // Step-into
;; $DEB_OVER# = 3        // Step-over
;; $DEB_OUT# = 4         // Step-out
;;
;; $EX_REA_EXEC# = 0     // The machine is still executing
;; $EX_REA_TERM# = 1     // Termination point reached
;; $EX_REA_BREAK# = 2    // Breakpoint reached
;; $EX_REA_HALT# = 3     // Halted
;; $EX_REA_FRAME# = 4    // Screen rendering frame/ULA frame completed

;; ----------------------------------------------------------------------------
;; Execution cycle variables

;; The last rendered frame tact
(global $lastRenderedFrameTact (mut i32) (i32.const 0x0000))

;; Gets or sets the value of the contention accummulated since the start
;; of the machine
(global $contentionAccummulated (mut i32) (i32.const 0x0000))

;; Number of frames rendered
(global $frameCount (mut i32) (i32.const 0x0000))

;; Indicates that a screen frame has just completed
(global $frameCompleted (mut i32) (i32.const 0x0000))

;; Gets the value of the contention accummulated since the last execution
;; cycle started
(global $lastExecutionContentionValue (mut i32) (i32.const 0x0000))

;; The emulation mode to use with the execution cycle
;; 0: Debugger
;; 1: UntilHalt
;; 2: UntilCpuFrameEnds
;; 3: UntilFrameEnds
;; 4: UntilExecutionPoint
(global $emulationMode (mut i32) (i32.const 0x0000))

;; The debug step mode to use with the execution cycle
;; (only when $emulationMode is Debugger)
;; 0: None
;; 1: StopAtBreakPoints
;; 2: StepInto
;; 3: StepOver
;; 4: StepOut
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
;; 4: Screen rendering frame/ULA frame completed
(global $executionCompletionReason (mut i32) (i32.const 0x0000))

;; The step-over breakpoint
(global $stepOverBreakpoint (mut i32) (i32.const 0x0000))

;; Sets the clock multiplier
(func $setClockMultiplier (param $multiplier i32)
  (local $mult i32)
  (i32.and (get_local $multiplier) (i32.const 0x1f))
  (set_global $defaultClockMultiplier (tee_local $mult))
  (set_global $clockMultiplier (get_local $mult))
)
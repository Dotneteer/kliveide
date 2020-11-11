;; ============================================================================
;; Common core configuration

;; Base CPU clock frequency
(global $baseClockFrequency (mut i32) (i32.const 0x0000))

;; Clock frequency multiplier
(global $clockMultiplier (mut i32) (i32.const 0x0000))

;; Supports the Z80 CPU the ZX Spectrum Next operations?
(global $supportsNextOperation (mut i32) (i32.const 0x0000))

;; Number of frames rendered
(global $frameCount (mut i32) (i32.const 0x0000))

;; Indicates that a screen frame has just completed
(global $frameCompleted (mut i32) (i32.const 0x0000))





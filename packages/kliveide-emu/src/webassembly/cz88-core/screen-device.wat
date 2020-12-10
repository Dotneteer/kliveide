;; ============================================================================
;; Implements the Z88 Screen device (Blink)

;; LORES0 (PB0, 16bits register). The 6 * 8 pixel per char User Defined Fonts.
(global $PB0 (mut i32) (i32.const 0x0000))

;; LORES1 (PB1, 16bits register). The 6 * 8 pixel per char fonts.
(global $PB1 (mut i32) (i32.const 0x0000))

;; HIRES0 (PB2 16bits register). The 8 * 8 pixel per char PipeDream Map.
(global $PB2 (mut i32) (i32.const 0x0000))

;; HIRES1 (PB3, 16bits register) The 8 * 8 pixel per char fonts for the OZ
;; window
(global $PB3 (mut i32) (i32.const 0x0000))

;; Screen Base Register (16bits register) The Screen base File (2K size,
;; containing char info about screen). If this register is 0, then the system
;; cannot render the pixel screen.
(global $SBR (mut i32) (i32.const 0x0000))

;; Blink Read register, SCW ($70)
;; LCD Horisontal resolution in pixels / 8
;; Available horisontal resolutions:
;; 640 pixels ($FF or 80), 800 pixels (100)
(global $SCW (mut i32) (i32.const 0xff))

;; Blink Read register, SCH ($71)
;; LCD Vertical resolution in pixels / 8
;; Available horisontal resolutions:
;; 64 pixels ($FF or 8), 256 pixels (32), 480 pixels (60)
(global $SCH (mut i32) (i32.const 0xff))

;; ============================================================================
;; Screen methods

;; Resets the Z88 Screen device
(func $resetZ88Screen
  i32.const 0x00 set_global $PB0
  i32.const 0x00 set_global $PB1
  i32.const 0x00 set_global $PB2
  i32.const 0x00 set_global $PB3
  i32.const 0x00 set_global $SBR
  i32.const 8 set_global $SCH
)


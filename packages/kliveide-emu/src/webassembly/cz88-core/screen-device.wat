;; ============================================================================
;; Implements the Z88 Screen device (Blink)

;; Pixel value constants
;;
;; $PX_COL_ON#   = 0xff7D1B46
;; $PX_COL_OFF#  = 0xffB9E0D2
;; $PX_COL_GREY# = 0xffA7B090
;; $PX_SCR_OFF#  = 0xffE0E0E0
;;
;; Attribute constants
;;
;; $ATTR_HRS# = 0x20
;; $ATTR_REV# = 0x10
;; $ATTR_FLS# = 0x08
;; $ATTR_GRY# = 0x04
;; $ATTR_UND# = 0x02
;; $ATTR_NUL# = 0x34
;; $ATTR_CUR# = 0x38

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

;; Number of screen frames rendered
(global $screenFrameCount (mut i32) (i32.const 0x0000))

;; Flash toggle counter
(global $flashToggleCount (mut i32) (i32.const 0x0000))

;; Current flash phase
(global $flashPhase (mut i32) (i32.const 0x0000))

;; Current flash count
(global $flashCount (mut i32) (i32.const 0x0000))

;; LORES 0 address
(global $loRes0 (mut i32) (i32.const 0x0000))

;; LORES 0 bank
(global $loRes0Bank (mut i32) (i32.const 0x0000))

;; LORES 1 address
(global $loRes1 (mut i32) (i32.const 0x0000))

;; LORES 1 bank
(global $loRes1Bank (mut i32) (i32.const 0x0000))

;; HIRES 0 address
(global $hiRes0 (mut i32) (i32.const 0x0000))

;; HIRES 0 bank
(global $hiRes0Bank (mut i32) (i32.const 0x0000))

;; HIRES 1 address
(global $hiRes1 (mut i32) (i32.const 0x0000))

;; HIRES 1 bank
(global $hiRes1Bank (mut i32) (i32.const 0x0000))

;; SBR
(global $sbr (mut i32) (i32.const 0x0000))

;; SBR bank
(global $sbrBank (mut i32) (i32.const 0x0000))

;; SBF row width
(global $sbfRowWidth (mut i32) (i32.const 0x0000))

;; SBF size
(global $sbfSize (mut i32) (i32.const 0x0000))

;; SBF size
(global $ctrlCharsPerRow (mut i32) (i32.const 0x0000))


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
  i32.const 0 set_global $screenFrameCount
  i32.const 140 set_global $flashToggleCount
  i32.const 0 set_global $flashPhase
  i32.const 0 set_global $flashCount
  i32.const 256 set_global $sbfRowWidth

  ;; Calculate screen dimensions
  (i32.mul (get_global $sbfRowWidth) (get_global $SCH))
  set_global $sbfSize

  ;; Screen width in pixels
  (i32.eq (get_global $SCW) (i32.const 0xff))
  if (result i32)
    i32.const 640
  else
    (i32.mul (get_global $SCW) (i32.const 8))
  end
  set_global $screenWidth

  ;; Screen height
  (i32.mul (get_global $SCH) (i32.const 8))
  set_global $screenLines

  ;; Control characters in a row
  (i32.div_u (get_global $screenWidth) (i32.const 6))
  set_global $ctrlCharsPerRow
)

;; Renders the screen
(func $renderScreen
  (local $coordX i32)
  (local $coordY i32)
  (local $rowCount i32)
  (local $rowSbrPtr i32)
  (local $sbrPtr i32)
  (local $columnCount i32)
  (local $charAddr i32)
  (local $char i32)
  (local $attr i32)

  ;; Test if LCD is ON
  (i32.eqz (i32.and (get_global $COM) (i32.const $BM_COMLCDON#)))
  if
    call $renderScreenOff
    return
  end

  ;; Prepare rendering
  call $initRendering

  ;; Init coordinates and pointers
  (set_local $coordX (i32.const 0))
  (set_local $coordY (i32.const 0))
  (set_local $rowCount (get_global $SCH))
  (set_local $rowSbrPtr 
    (call $getBankedMemoryAddress (get_global $sbrBank) (get_global $sbr))
  )
  
  ;; Row loop
  loop $rowLoop
    get_local $rowCount
    if
      ;; Initialize the row pointer and the column loop
      (set_local $sbrPtr (get_local $rowSbrPtr))      
      (set_local $columnCount 
        (i32.add (get_global $ctrlCharsPerRow) (i32.const 1))
      )

      ;; Column loop
      loop $columnLoop

        get_local $columnCount
        if
          ;; Read the screen character and its attribute
          (set_local $char (i32.load8_u offset=0 (get_local $sbrPtr)))
          (set_local $attr (i32.load8_u offset=1 (get_local $sbrPtr)))

          ;; Render individual characters
          (i32.and (get_local $attr) (i32.const $ATTR_HRS#))
          i32.eqz
          if
            ;; It is a LORES character
            (call $drawLoResChar 
              (get_local $coordX)
              (get_local $coordY)
              (get_local $char)
              (get_local $attr)
            )
            (i32.add (get_local $coordX) (i32.const 6))
            set_local $coordX
          else
            (i32.eq
              (i32.and (get_local $attr) (i32.const $ATTR_CUR#))
              (i32.const $ATTR_CUR#)
            )
            if
              (call $drawLoResCursor 
                (get_local $coordX)
                (get_local $coordY)
                (get_local $char)
                (get_local $attr)
              )
              (i32.add (get_local $coordX) (i32.const 6))
              set_local $coordX
            else
              (i32.ne
                (i32.and (get_local $attr) (i32.const $ATTR_NUL#))
                (i32.const $ATTR_NUL#)
              )
              if
                (call $drawHiResChar 
                  (get_local $coordX)
                  (get_local $coordY)
                  (get_local $char)
                  (get_local $attr)
                )
                (i32.add (get_local $coordX) (i32.const 8))
                set_local $coordX
              end
            end
          end

          ;; Increment sbr pointer
          (i32.add (get_local $sbrPtr) (i32.const 2))
          set_local $sbrPtr

          ;; Decrement counter
          (i32.sub (get_local $columnCount) (i32.const 1))
          set_local $columnCount

          br $columnLoop
        end
      end

      ;; TODO: Turn off the remaining pixels

      ;; Prepare for next pixel row
      (set_local $coordX (i32.const 0))
      (i32.add (get_local $coordY) (i32.const 8))
      set_local $coordY

      ;; Decrement the counter
      (i32.sub (get_local $rowCount) (i32.const 1))
      set_local $rowCount

      ;; Prepare for the next row
      (i32.add (get_local $rowSbrPtr) (get_global $sbfRowWidth))
      set_local $rowSbrPtr
      br $rowLoop
    end
  end
)

;; Draws a LoRes character
(func $drawLoResChar
  (param $x i32)
  (param $y i32)
  (param $char i32)
  (param $attr i32)

  (local $pixelPtr i32)
  (local $rowCount i32)
  (local $pixelColor i32)
  (local $fontOffset i32)
  (local $fontBank i32)
  (local $fontAddress i32)
  (local $charMask i32)
  (local $charPattern i32)

  (i32.lt_u 
    (get_global $screenWidth)
    (i32.add (get_local $x) (i32.const 6))
  )
  if return end

  ;; Initialize the top-left position
  (call $calcPixelPtr (get_local $x) (get_local $y))
  set_local $pixelPtr
 
  ;; Check empty flash character
  (i32.and (get_local $attr) (i32.const $ATTR_FLS#))
  if
    get_global $flashPhase
    if
      ;; Loop for 8 rows
      (set_local $rowCount (i32.const 8))
      loop $emptyRows
        get_local $rowCount
        if
          ;; Store empty pixels
          (i32.store offset=0 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=4 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=8 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=12 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=16 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=20 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))

          ;; Next iteration
          (i32.add
            (get_local $pixelPtr)
            (i32.mul (get_global $screenWidth) (i32.const 4))
          )
          set_local $pixelPtr
          (i32.sub (get_local $rowCount) (i32.const 1))
          set_local $rowCount
          br $emptyRows
        end
      end
      return
    end
  end

  ;; Set pixel color
  (select
    (i32.const $PX_COL_GREY#)
    (i32.const $PX_COL_ON#)
    (i32.and (get_local $attr) (i32.const $ATTR_GRY#))
  )
  set_local $pixelColor

  ;; Calculate font offset
  (i32.or
    (i32.shl 
      (i32.and (get_local $attr) (i32.const 0x01))
      (i32.const 8)
    )
    (get_local $char)
  )
  tee_local $fontOffset
  (i32.ge_u (i32.const 0x01c0))
  if
    ;; UDG
    (i32.add
      (get_global $loRes0)
      (i32.shl
       (i32.and (get_local $char) (i32.const 0x3f))
       (i32.const 3)
      )
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $loRes0Bank))
  else
    ;; Standard character
    (i32.add
      (get_global $loRes1)
      (i32.shl (get_local $fontOffset) (i32.const 3))
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $loRes1Bank))
  end

  ;; Draw the bits sequentially
  (call $getBankedMemoryAddress (get_local $fontBank) (get_local $fontOffset))
  set_local $fontAddress

  ;; Init character mask
  (select
    (i32.const 0xff)
    (i32.const 0x00)
    (i32.and (get_local $attr) (i32.const $ATTR_REV#))
  )
  set_local $charMask

  ;; Line 0
  (i32.xor
    (i32.load8_u offset=0 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 1
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=1 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 2
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=2 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 3
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=3 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 4
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=4 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 5
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=5 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 6
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=6 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 7
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr

  ;; Check for underline
  (i32.and (get_local $attr) (i32.const $ATTR_UND#))
  if
    (i32.and (get_local $attr) (i32.const $ATTR_REV#))
    if
      ;; Reverse underscore
      (call $drawLowResRow 
        (get_local $pixelPtr)
        (get_local $pixelColor)
        (i32.const 0x00)
      )
    else
      ;; Normal underscore
      (call $drawLowResRow 
        (get_local $pixelPtr)
        (get_local $pixelColor)
        (i32.const 0xff)
      )
    end
    return
  end

  ;; No underscore, display the 8th row of the char font
  (i32.xor
    (i32.load8_u offset=7 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )
)

;; Draws a row of LoRes char
(func $drawLowResRow
  (param $pixelPtr i32)
  (param $pixelColor i32)
  (param $charPattern i32)

  ;; Pixel 0
  (i32.store offset=0
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x20))
    )
  )
  ;; Pixel 1
  (i32.store offset=4
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x10))
    )
  )
  ;; Pixel 2
  (i32.store offset=8
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x08))
    )
  )
  ;; Pixel 3
  (i32.store offset=12
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x04))
    )
  )
  ;; Pixel 4
  (i32.store offset=16
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x02))
    )
  )
  ;; Pixel 5
  (i32.store offset=20
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x01))
    )
  )
)

;; Draws a LoRes cursor
(func $drawLoResCursor
  (param $x i32)
  (param $y i32)
  (param $char i32)
  (param $attr i32)

  (local $pixelPtr i32)
  (local $rowCount i32)
  (local $fontOffset i32)
  (local $fontBank i32)
  (local $fontAddress i32)
  (local $charMask i32)
  (local $charPattern i32)

  (i32.lt_u 
    (get_global $screenWidth)
    (i32.add (get_local $x) (i32.const 6))
  )
  if return end

  ;; Initialize the top-left position
  (call $calcPixelPtr (get_local $x) (get_local $y))
  set_local $pixelPtr
 
  ;; Calculate font offset
  (i32.or
    (i32.shl 
      (i32.and (get_local $attr) (i32.const 0x01))
      (i32.const 8)
    )
    (get_local $char)
  )
  tee_local $fontOffset
  (i32.ge_u (i32.const 0x01c0))
  if
    ;; UDG
    (i32.add
      (get_global $loRes0)
      (i32.shl
       (i32.and (get_local $char) (i32.const 0x3f))
       (i32.const 3)
      )
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $loRes0Bank))
  else
    ;; Standard character
    (i32.add
      (get_global $loRes1)
      (i32.shl (get_local $fontOffset) (i32.const 3))
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $loRes1Bank))
  end

  ;; Draw the bits sequentially
  (call $getBankedMemoryAddress (get_local $fontBank) (get_local $fontOffset))
  set_local $fontAddress

  ;; Init character mask
  (select
    (i32.const 0xff)
    (i32.const 0x00)
    (get_global $flashPhase)
  )
  set_local $charMask

  ;; Line 0
  (i32.xor
    (i32.load8_u offset=0 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 1
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=1 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 2
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=2 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 3
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=3 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 4
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=4 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 5
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=5 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 6
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=6 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )

  ;; Line 7
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=7 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawLowResRow 
    (get_local $pixelPtr)
    (i32.const $PX_COL_ON#)
    (get_local $charPattern)
  )
)

;; Draws a HiRes character
(func $drawHiResChar
  (param $x i32)
  (param $y i32)
  (param $char i32)
  (param $attr i32)

  (local $pixelPtr i32)
  (local $rowCount i32)
  (local $pixelColor i32)
  (local $fontOffset i32)
  (local $fontBank i32)
  (local $fontAddress i32)
  (local $charMask i32)
  (local $charPattern i32)

  (i32.lt_u 
    (get_global $screenWidth)
    (i32.add (get_local $x) (i32.const 8))
  )
  if return end

  ;; Initialize the top-left position
  (call $calcPixelPtr (get_local $x) (get_local $y))
  set_local $pixelPtr
 
  ;; Check empty flash character
  (i32.and (get_local $attr) (i32.const $ATTR_FLS#))
  if
    get_global $flashPhase
    if
      ;; Loop for 8 rows
      (set_local $rowCount (i32.const 8))
      loop $emptyRows
        get_local $rowCount
        if
          ;; Store empty pixels
          (i32.store offset=0 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=4 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=8 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=12 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=16 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=20 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=24 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))
          (i32.store offset=28 (get_local $pixelPtr) (i32.const $PX_COL_OFF#))

          ;; Next iteration
          (i32.add
            (get_local $pixelPtr)
            (i32.mul (get_global $screenWidth) (i32.const 4))
          )
          set_local $pixelPtr
          (i32.sub (get_local $rowCount) (i32.const 1))
          set_local $rowCount
          br $emptyRows
        end
      end
      return
    end
  end

  ;; Set pixel color
  (select
    (i32.const $PX_COL_GREY#)
    (i32.const $PX_COL_ON#)
    (i32.and (get_local $attr) (i32.const $ATTR_GRY#))
  )
  set_local $pixelColor

  ;; Calculate font offset
  (i32.or
    (i32.shl 
      (i32.and (get_local $attr) (i32.const 0x03))
      (i32.const 8)
    )
    (get_local $char)
  )
  tee_local $fontOffset
  (i32.ge_u (i32.const 0x0300))
  if
    ;; OZ window font entries
    (i32.add
      (get_global $hiRes1)
      (i32.shl (get_local $char) (i32.const 3))
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $hiRes1Bank))
  else
    ;; Pipedream map entries
    (i32.add
      (get_global $hiRes0)
      (i32.shl (get_local $fontOffset) (i32.const 3))
    )
    set_local $fontOffset
    (set_local $fontBank (get_global $hiRes0Bank))
  end

  ;; Draw the bits sequentially
  (call $getBankedMemoryAddress (get_local $fontBank) (get_local $fontOffset))
  set_local $fontAddress

  ;; Init character mask
  (select
    (i32.const 0xff)
    (i32.const 0x00)
    (i32.and (get_local $attr) (i32.const $ATTR_REV#))
  )
  set_local $charMask

  ;; Line 0
  (i32.xor
    (i32.load8_u offset=0 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 1
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=1 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 2
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=2 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 3
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=3 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 4
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=4 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 5
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=5 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 6
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=6 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )

  ;; Line 7
  (i32.add 
    (get_local $pixelPtr)
    (i32.mul (get_global $screenWidth) (i32.const 4))
  )
  set_local $pixelPtr
  (i32.xor
    (i32.load8_u offset=7 (get_local $fontAddress))
    (get_local $charMask)
  )
  set_local $charPattern
  (call $drawHiResRow 
    (get_local $pixelPtr)
    (get_local $pixelColor)
    (get_local $charPattern)
  )
)

;; Draws a row of HiRes char
(func $drawHiResRow
  (param $pixelPtr i32)
  (param $pixelColor i32)
  (param $charPattern i32)

  ;; Pixel 0
  (i32.store offset=0
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x80))
    )
  )
  ;; Pixel 1
  (i32.store offset=4
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x40))
    )
  )
  ;; Pixel 2
  (i32.store offset=8
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x20))
    )
  )
  ;; Pixel 3
  (i32.store offset=12
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x10))
    )
  )
  ;; Pixel 4
  (i32.store offset=16
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x08))
    )
  )
  ;; Pixel 5
  (i32.store offset=20
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x04))
    )
  )
  ;; Pixel 6
  (i32.store offset=24
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x02))
    )
  )
  ;; Pixel 7
  (i32.store offset=28
    (get_local $pixelPtr)
    (select
      (get_local $pixelColor)
      (i32.const $PX_COL_OFF#)
      (i32.and (get_local $charPattern) (i32.const 0x01))
    )
  )
)

;; Calculates the pixel buffer position for the specified coordinates
(func $calcPixelPtr (param $x i32) (param $y i32) (result i32)
  (i32.add
    (get_global $PIXEL_BUFFER)
    (i32.mul
      (i32.add
        (i32.mul (get_local $y) (get_global $screenWidth))
        (get_local $x)
      )
      (i32.const 4)
    )
  )
)

;; Initializes screen rendering variables
(func $initRendering
  ;; LORES 0
  (i32.shl
    (i32.or
      (i32.and
        (i32.shl (get_global $PB0) (i32.const 3))
        (i32.const 0xf700)
      )
      (i32.and
        (i32.shl (get_global $PB0) (i32.const 1))
        (i32.const 0x003f)
      )
    )
    (i32.const 8)
  )
  set_global $loRes0

  ;; Separate LORES 0 to bank and offset
  (i32.shr_u (get_global $loRes0) (i32.const 16))
  set_global $loRes0Bank
  (i32.and (get_global $loRes0) (i32.const 0x3fff))
  set_global $loRes0

  ;; LORES 1
  (i32.shl
    (i32.or
      (i32.and
        (i32.shl (get_global $PB1) (i32.const 6))
        (i32.const 0xff00)
      )
      (i32.and
        (i32.shl (get_global $PB1) (i32.const 4))
        (i32.const 0x0030)
      )
    )
    (i32.const 8)
  )
  set_global $loRes1

  ;; Separate LORES 1 to bank and offset
  (i32.shr_u (get_global $loRes1) (i32.const 16))
  set_global $loRes1Bank
  (i32.and (get_global $loRes1) (i32.const 0x3fff))
  set_global $loRes1

  ;; HIRES 0
  (i32.shl
    (i32.or
      (i32.and
        (i32.shl (get_global $PB2) (i32.const 7))
        (i32.const 0xff00)
      )
      (i32.and
        (i32.shl (get_global $PB2) (i32.const 5))
        (i32.const 0x0020)
      )
    )
    (i32.const 8)
  )
  set_global $hiRes0

  ;; Separate HIRES 0 to bank and offset
  (i32.shr_u (get_global $hiRes0) (i32.const 16))
  set_global $hiRes0Bank
  (i32.and (get_global $hiRes0) (i32.const 0x3fff))
  set_global $hiRes0

  ;; HIRES 1
  (i32.shl
    (i32.or
      (i32.and
        (i32.shl (get_global $PB3) (i32.const 5))
        (i32.const 0xff00)
      )
      (i32.and
        (i32.shl (get_global $PB3) (i32.const 3))
        (i32.const 0x0038)
      )
    )
    (i32.const 8)
  )
  set_global $hiRes1

  ;; Separate HIRES 0 to bank and offset
  (i32.shr_u (get_global $hiRes1) (i32.const 16))
  set_global $hiRes1Bank
  (i32.and (get_global $hiRes1) (i32.const 0x3fff))
  set_global $hiRes1

  ;; SBR
  (i32.shl
    (i32.or
      (i32.and
        (i32.shl (get_global $SBR) (i32.const 5))
        (i32.const 0xff00)
      )
      (i32.and
        (i32.shl (get_global $SBR) (i32.const 3))
        (i32.const 0x0038)
      )
    )
    (i32.const 8)
  )
  set_global $sbr

  ;; Separate SBR to bank and offset
  (i32.shr_u (get_global $sbr) (i32.const 16))
  set_global $sbrBank
  (i32.and (get_global $sbr) (i32.const 0x3fff))
  set_global $sbr
)

;; Renders the OFF state of the LCD screen
(func $renderScreenOff
  (local $count i32)
  (local $ptr i32)

  ;; Prepare rendering
  (set_local $ptr (get_global $PIXEL_BUFFER))

  (i32.mul (get_global $screenWidth) (get_global $screenLines))
  set_local $count

  ;; Rendering loop
  loop $renderLoop
    get_local $count
    if
      (i32.store 
        (get_local $ptr)
        (i32.const $PX_SCR_OFF#)
      )

      ;; Decrement counter
      (i32.sub (get_local $count) (i32.const 1))
      set_local $count

      ;; Increment pointer
      (i32.add (get_local $ptr) (i32.const 4))
      set_local $ptr
      br $renderLoop
    end
  end
)

;; Reads the banked memory
(func $getBankedMemoryAddress (param $bank i32) (param $offs i32) (result i32)
  (i32.add
    (get_global $Z88_MEM_AREA)
    (i32.or
      (i32.and (get_local $offs) (i32.const 0x3fff))
      (i32.shl (get_local $bank) (i32.const 14))
    )
  )
)

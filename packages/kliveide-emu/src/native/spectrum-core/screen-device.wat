;; ============================================================================
;; Implements the ZX Spectrum screen device

;; ----------------------------------------------------------------------------
;; Screen device constants
;; $RT_NONE# = 0x00
;; $RT_Border# = 0x04
;; $RT_BorderFetchPixel# = 0x05
;; $RT_BorderFetchAttr# = 0x06
;; $RT_DisplayB1# = 0x08
;; $RT_DisplayB1FetchB2# = 0x09
;; $RT_DisplayB1FetchA2# = 0x0a
;; $RT_DisplayB2# = 0x10
;; $RT_DisplayB2FetchB1# = 0x11
;; $RT_DisplayB2FetchA1# = 0x12

;; ----------------------------------------------------------------------------
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

;; Paper color bytes, flash off (256 bytes)
(data (i32.const 0x49_4200) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

;; Ink color bytes, flash off (256 bytes)
(data (i32.const 0x49_4300) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

;; Paper color bytes, flash on (256 bytes)
(data (i32.const 0x49_4400) "\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f")

;; Ink color bytes, flash on (256 bytes)
(data (i32.const 0x49_4500) "\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\08\09\0a\0b\0c\0d\0e\0f\00\00\00\00\00\00\00\00\01\01\01\01\01\01\01\01\02\02\02\02\02\02\02\02\03\03\03\03\03\03\03\03\04\04\04\04\04\04\04\04\05\05\05\05\05\05\05\05\06\06\06\06\06\06\06\06\07\07\07\07\07\07\07\07\08\08\08\08\08\08\08\08\09\09\09\09\09\09\09\09\0a\0a\0a\0a\0a\0a\0a\0a\0b\0b\0b\0b\0b\0b\0b\0b\0c\0c\0c\0c\0c\0c\0c\0c\0d\0d\0d\0d\0d\0d\0d\0d\0e\0e\0e\0e\0e\0e\0e\0e\0f\0f\0f\0f\0f\0f\0f\0f")

;; ZX Spectrum 48 palette (256 byte)
(data (i32.const 0x49_4600) "\00\00\00\ff\00\00\aa\ff\aa\00\00\ff\aa\00\aa\ff\00\aa\00\ff\00\aa\aa\ff\aa\aa\00\ff\aa\aa\aa\ff\00\00\00\ff\00\00\ff\ff\ff\00\00\ff\ff\00\ff\ff\00\ff\00\ff\00\ff\ff\ff\ff\ff\00\ff\ff\ff\ff\ff")

;; ----------------------------------------------------------------------------
;; Screen device routines

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
      i32.const $RT_NONE# set_local $phase
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
            i32.const $RT_DisplayB1FetchB2# set_local $phase
            (call $calcPixelAddr 
              (get_local $line)
              (i32.add (get_local $tactInLine) (i32.const 4))
            )
            set_local $pixelAddr
            i32.const 5
            i32.const 0
            (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
            select
            set_local $contentionDelay
          else
            (i32.eq (get_local $pixelTact) (i32.const 1))
            if
              ;; Pixel tact 1
              i32.const $RT_DisplayB1FetchA2# set_local $phase
              (call $calcAttrAddr 
                (get_local $line)
                (i32.add (get_local $tactInLine) (i32.const 3))
              )
              set_local $attrAddr
              i32.const 4
              i32.const 7
              (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
              select
              set_local $contentionDelay
            else
              (i32.eq (get_local $pixelTact) (i32.const 2))
              if
                ;; Pixel tact 2
                i32.const $RT_DisplayB1# set_local $phase
                i32.const 3
                i32.const 6
                (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                select
                set_local $contentionDelay
              else
                (i32.eq (get_local $pixelTact) (i32.const 3))
                if
                  ;; Pixel tact 3
                  i32.const $RT_DisplayB1# set_local $phase
                  i32.const 2
                  i32.const 5
                  (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                  select
                  set_local $contentionDelay
                else
                  (i32.eq (get_local $pixelTact) (i32.const 4))
                  if
                    ;; Pixel tact 4
                    i32.const $RT_DisplayB2# set_local $phase
                    i32.const 1
                    i32.const 4
                    (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                    select
                    set_local $contentionDelay
                  else
                    (i32.eq (get_local $pixelTact) (i32.const 5))
                    if
                      ;; Pixel tact 5
                      i32.const $RT_DisplayB2# set_local $phase
                      i32.const 0
                      i32.const 3
                      (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
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
                          i32.const $RT_DisplayB2FetchB1# set_local $phase
                          (call $calcPixelAddr 
                            (get_local $line)
                            (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                          )
                          set_local $pixelAddr
                          i32.const 0
                          i32.const 2
                          (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                          select
                          set_local $contentionDelay
                        else
                          ;; Last byte in this line
                          i32.const $RT_DisplayB2# set_local $phase
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
                          i32.const $RT_DisplayB2FetchA1# set_local $phase
                          (call $calcAttrAddr 
                            (get_local $line)
                            (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                          )
                          set_local $attrAddr
                          i32.const 6
                          i32.const 1
                          (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                          select
                          set_local $contentionDelay
                        else
                          ;; Last byte in this line
                          i32.const $RT_DisplayB2# set_local $phase
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
          i32.const $RT_Border# set_local $phase

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
                i32.const $RT_BorderFetchPixel# set_local $phase
                (call $calcPixelAddr 
                  (get_local $line)
                  (i32.add (get_local $tactInLine) (get_global $pixelDataPrefetchTime))
                )
                set_local $pixelAddr
                i32.const 0
                i32.const 2
                (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
                select
                set_local $contentionDelay
              else
                ;; Is it attribute data prefetch time?
                (i32.eq (get_local $tactInLine) (get_local $borderAttrFetchTact))
                if
                  ;; Yes, prefetch attribute data
                  i32.const $RT_BorderFetchAttr# set_local $phase
                  (call $calcAttrAddr 
                    (get_local $line)
                    (i32.add (get_local $tactInLine) (get_global $attributeDataPrefetchTime))
                  )
                  set_local $attrAddr
                  i32.const 6
                  i32.const 1
                  (i32.eq (get_global $contentionType) (i32.const $MEMCONT_ULA#))
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
  ;; i32.const 0x4000
  ;; i32.add
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
  ;;i32.const 0x5800
  i32.const 0x1800
  i32.add
)

;; Renders the next screen portion
;; $toTact: last tact to render
(func $renderScreen (param $toTact i32)
  (local $tact i32)
  (local $phase i32)
  (local $tmp i32)

  get_global $lastRenderedFrameTact
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
        (i32.and (get_local $phase) (i32.const $RT_Border#))
        if
          ;; Store border pixels
          (i32.store8 offset=0 (get_global $pixelBufferPtr) (get_global $borderColor))
          (i32.store8 offset=1 (get_global $pixelBufferPtr) (get_global $borderColor))

          ;; Fetch border byte?
          (i32.and (get_local $phase) (i32.const 0x01))
          if
            ;; Fetch pixel byte 1
            (call $readScreenMemory (i32.load16_u offset=1 (get_global $renderingTablePtr)))
            set_global $pixelByte1
          else
            (i32.and (get_local $phase) (i32.const 0x02))
            if
              ;; Fetch attr byte 1
              (call $readScreenMemory (i32.load16_u offset=3 (get_global $renderingTablePtr)))
              set_global $attrByte1
            end
          end
        else
          ;; Test for Byte1 processing
          (i32.and (get_local $phase) (i32.const $RT_DisplayB1#))
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
              (call $readScreenMemory (i32.load16_u offset=1 (get_global $renderingTablePtr)))
              set_global $pixelByte2
            else
              (i32.and (get_local $phase) (i32.const 0x02))
              if
                ;; Fetch attr byte 2
                (call $readScreenMemory (i32.load16_u offset=3 (get_global $renderingTablePtr)))
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
              (call $readScreenMemory (i32.load16_u offset=1 (get_global $renderingTablePtr)))
              set_global $pixelByte1
            else
              (i32.and (get_local $phase) (i32.const 0x02))
              if
                ;; Fetch attr byte 1
                (call $readScreenMemory (i32.load16_u offset=3 (get_global $renderingTablePtr)))
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
    get_local $tact set_global $lastRenderedFrameTact
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

;; Reads the contents of the screen memory
(func $readScreenMemory (param $addr i32) (result i32)
  (i32.add 
    (get_global $memoryScreenOffset)
    (get_local $addr)
  )
  i32.load8_u
)

;; Colorizes the data in pixel buffer
(func $colorize
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

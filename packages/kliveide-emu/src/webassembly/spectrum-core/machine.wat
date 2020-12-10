;; Turns on the ZX Spectrum machine
(func $turnOnMachine
  call $setupMachine
)

;; Resets the machine
(func $resetMachine
  call $setupMachine
)

;; Gets the ZX Spectrum 48 machine state
(func $getCommonSpectrumMachineState
  ;; Spectrum-specific machine state
  (i32.store8 offset=160 (get_global $STATE_TRANSFER_BUFF) (get_global $ulaIssue))
  (i32.store8 offset=161 (get_global $STATE_TRANSFER_BUFF) (get_global $fastTapeMode))
  (i32.store8 offset=162 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationRom))
  (i32.store16 offset=163 (get_global $STATE_TRANSFER_BUFF) (get_global $terminationPoint))
  (i32.store8 offset=165 (get_global $STATE_TRANSFER_BUFF) (get_global $fastVmMode))

  ;; Memory configuration
  (i32.store8 offset=180 (get_global $STATE_TRANSFER_BUFF) (get_global $numberOfRoms))      
  (i32.store offset=181 (get_global $STATE_TRANSFER_BUFF) (get_global $romContentsAddress))      
  (i32.store8 offset=185 (get_global $STATE_TRANSFER_BUFF) (get_global $spectrum48RomIndex))      
  (i32.store8 offset=186 (get_global $STATE_TRANSFER_BUFF) (get_global $contentionType))      
  (i32.store8 offset=187 (get_global $STATE_TRANSFER_BUFF) (get_global $ramBanks))      
  (i32.store8 offset=188 (get_global $STATE_TRANSFER_BUFF) (get_global $nextMemorySize))

  ;; Screen frame configuration
  (i32.store16 offset=189 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptTact))      
  (i32.store16 offset=191 (get_global $STATE_TRANSFER_BUFF) (get_global $verticalSyncLines))      
  (i32.store16 offset=193 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderTopLines))      
  (i32.store16 offset=195 (get_global $STATE_TRANSFER_BUFF) (get_global $borderTopLines))      
  (i32.store16 offset=197 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLines))      
  (i32.store16 offset=199 (get_global $STATE_TRANSFER_BUFF) (get_global $borderBottomLines))      
  (i32.store16 offset=201 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderBottomLines))      
  (i32.store16 offset=203 (get_global $STATE_TRANSFER_BUFF) (get_global $horizontalBlankingTime))      
  (i32.store16 offset=205 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftTime))      
  (i32.store16 offset=207 (get_global $STATE_TRANSFER_BUFF) (get_global $displayLineTime))      
  (i32.store16 offset=209 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightTime))      
  (i32.store16 offset=211 (get_global $STATE_TRANSFER_BUFF) (get_global $nonVisibleBorderRightTime))      
  (i32.store16 offset=213 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelDataPrefetchTime))      
  (i32.store16 offset=215 (get_global $STATE_TRANSFER_BUFF) (get_global $attributeDataPrefetchTime))      

  ;; Calculated screen attributes
  (i32.store offset=240 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLines))      
  (i32.store offset=244 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayLine))
  (i32.store offset=248 (get_global $STATE_TRANSFER_BUFF) (get_global $lastDisplayLine))
  (i32.store offset=252 (get_global $STATE_TRANSFER_BUFF) (get_global $borderLeftPixels))      
  (i32.store offset=256 (get_global $STATE_TRANSFER_BUFF) (get_global $borderRightPixels))      
  (i32.store offset=260 (get_global $STATE_TRANSFER_BUFF) (get_global $displayWidth))      
  (i32.store offset=264 (get_global $STATE_TRANSFER_BUFF) (get_global $screenWidth))      
  (i32.store offset=268 (get_global $STATE_TRANSFER_BUFF) (get_global $screenLineTime))      
  (i32.store offset=272 (get_global $STATE_TRANSFER_BUFF) (get_global $rasterLines))      
  (i32.store offset=276 (get_global $STATE_TRANSFER_BUFF) (get_global $firstDisplayPixelTact))      
  (i32.store offset=280 (get_global $STATE_TRANSFER_BUFF) (get_global $firstScreenPixelTact))

  ;; Keyboard lines
  (i32.store offset=284 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=0 (get_global $KEYBOARD_LINES)))
  (i32.store offset=288 (get_global $STATE_TRANSFER_BUFF) (i32.load offset=4 (get_global $KEYBOARD_LINES)))

  ;; Port state
  (i32.store8 offset=292 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit3LastValue))
  (i32.store8 offset=293 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4LastValue))
  (i32.store offset=294 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom0Tacts))
  (i32.store offset=298 (get_global $STATE_TRANSFER_BUFF) (get_global $portBit4ChangedFrom1Tacts))

  ;; Interrupt state
  (i32.store8 offset=302 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRaised))
  (i32.store8 offset=303 (get_global $STATE_TRANSFER_BUFF) (get_global $interruptRevoked))

  ;; Screen state
  (i32.store8 offset=304 (get_global $STATE_TRANSFER_BUFF) (get_global $borderColor))
  (i32.store8 offset=305 (get_global $STATE_TRANSFER_BUFF) (get_global $flashPhase))
  (i32.store8 offset=306 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte1))
  (i32.store8 offset=307 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelByte2))
  (i32.store8 offset=308 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte1))
  (i32.store8 offset=309 (get_global $STATE_TRANSFER_BUFF) (get_global $attrByte2))
  (i32.store8 offset=310 (get_global $STATE_TRANSFER_BUFF) (get_global $flashFrames))
  (i32.store offset=311 (get_global $STATE_TRANSFER_BUFF) (get_global $renderingTablePtr))
  (i32.store offset=315 (get_global $STATE_TRANSFER_BUFF) (get_global $pixelBufferPtr))

  ;; Beeper state
  (i32.store offset=319 (get_global $STATE_TRANSFER_BUFF) (get_global $audioSampleRate))
  (i32.store offset=323 (get_global $STATE_TRANSFER_BUFF) (get_global $audioSampleLength))
  (i32.store offset=327 (get_global $STATE_TRANSFER_BUFF) (get_global $audioLowerGate))
  (i32.store offset=331 (get_global $STATE_TRANSFER_BUFF) (get_global $audioUpperGate))
  (i32.store offset=335 (get_global $STATE_TRANSFER_BUFF) (get_global $audioGateValue))
  (i32.store offset=339 (get_global $STATE_TRANSFER_BUFF) (get_global $audioNextSampleTact))
  (i32.store8 offset=343 (get_global $STATE_TRANSFER_BUFF) (get_global $beeperLastEarBit))
  (i32.store offset=344 (get_global $STATE_TRANSFER_BUFF) (get_global $audioSampleCount))

  ;; Sound device state
  (i32.store8 offset=348 (get_global $STATE_TRANSFER_BUFF) (get_global $psgSupportsSound))
  (i32.store8 offset=349 (get_global $STATE_TRANSFER_BUFF) (get_global $psgRegisterIndex))
  (i32.store offset=350 (get_global $STATE_TRANSFER_BUFF) (get_global $psgClockStep))
  (i32.store offset=354 (get_global $STATE_TRANSFER_BUFF) (get_global $psgNextClockTact))
  (i32.store offset=358 (get_global $STATE_TRANSFER_BUFF) (get_global $psgOrphanSamples))
  (i32.store offset=362 (get_global $STATE_TRANSFER_BUFF) (get_global $psgOrphanSum))

  ;; Tape device state
  (i32.store8 offset=366 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeMode))
  (i32.store16 offset=367 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesRoutine))
  (i32.store16 offset=369 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesResume))
  (i32.store16 offset=371 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeLoadBytesInvalidHeader))
  (i32.store16 offset=373 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeSaveBytesRoutine))
  (i32.store8 offset=375 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBlocksToPlay))
  (i32.store8 offset=376 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeEof))
  (i32.store offset=377 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBufferPtr))
  (i32.store offset=381 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeNextBlockPtr))
  (i32.store8 offset=385 (get_global $STATE_TRANSFER_BUFF) (get_global $tapePlayPhase))
  (i64.store offset=386 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeStartTact))
  (i32.store8 offset=394 (get_global $STATE_TRANSFER_BUFF) (get_global $tapeBitMask))

  ;; Memory pages
  (i32.store8 offset=395 (get_global $STATE_TRANSFER_BUFF) (get_global $memorySelectedRom))
  (i32.store8 offset=396 (get_global $STATE_TRANSFER_BUFF) (get_global $memoryPagingEnabled))
  (i32.store8 offset=397 (get_global $STATE_TRANSFER_BUFF) (get_global $memorySelectedBank))
  (i32.store8 offset=398 (get_global $STATE_TRANSFER_BUFF) (get_global $memoryUseShadowScreen))
  (i32.store16 offset=399 (get_global $STATE_TRANSFER_BUFF) (get_global $memoryScreenOffset))
)

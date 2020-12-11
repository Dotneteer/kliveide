;; Table of extended instructions
(elem (i32.const $EXTENDED_JT#)
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

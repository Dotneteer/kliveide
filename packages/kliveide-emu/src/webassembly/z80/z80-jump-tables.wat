;; ============================================================================
;; Z80 jump tables used

;; ----------------------------------------------------------------------------
;; Jump table start indices

;; Z80 standard instructions
;; $STANDARD_JT# = 0

;; Z80 indexed instructions
;; $INDEXED_JT# = 256

;; Z80 extended instructions
;; $EXTENDED_JT# = 512

;; Z80 bit instructions
;; $BIT_JT# = 768

;; Z80 indexed bit instructions
;; $INDEXED_BIT_JT# = 1024

;; ALU bit manipulation operations table
;; $BOP_JT# = 1280

;; This table stores all dispatchable functions
;; 120: 6 machine types (20 function for each)
;; 256: Standard operations
;; 256: Indexed operations
;; 256: Extended operations
;; 256: Bit operations
;; 256: Indexed bit operations
;; 8: ALU bit operations

;; Represents a no-operation function
(func $NOOP)

;; ----------------------------------------------------------------------------
;; Table of machine-type specific functions

;; Table of standard instructions
(elem (i32.const $STANDARD_JT#)
  ;; 0x00-0x07
  $NOOP     $LdBCNN   $LdBCiA   $IncBC    $IncB     $DecB     $LdBN     $Rlca
  ;; 0x08-0x0f
  $ExAf     $AddHLBC  $LdABCi   $DecBC    $IncC     $DecC     $LdCN     $Rrca
  ;; 0x10-0x17
  $Djnz     $LdDENN   $LdDEiA   $IncDE    $IncD     $DecD     $LdDN     $Rla
  ;; 0x18-0x1f
  $JrE      $AddHLDE  $LdADEi   $DecDE    $IncE     $DecE     $LdEN     $Rra
  ;; 0x20-0x27
  $JrNz     $LdHLNN   $LdNNiHL  $IncHL    $IncH     $DecH     $LdHN     $Daa
  ;; 0x28-0x2f
  $JrZ      $AddHLHL  $LdHLNNi  $DecHL    $IncL     $DecL     $LdLN     $Cpl
  ;; 0x30-0x37
  $JrNc     $LdSPNN   $LdNNiA   $IncSP    $IncHLi   $DecHLi   $LdHLiN   $Scf
  ;; 0x38-0x3f
  $JrC      $AddHLSP  $LdANNi   $DecSP    $IncA     $DecA     $LdAN     $Ccf
  ;; 0x40-0x47
  $NOOP     $LdBC     $LdBD     $LdBE     $LdBH     $LdBL     $LdBHLi   $LdBA     
  ;; 0x48-0x4f
  $LdCB     $NOOP     $LdCD     $LdCE     $LdCH     $LdCL     $LdCHLi   $LdCA     
  ;; 0x50-0x57
  $LdDB     $LdDC     $NOOP     $LdDE     $LdDH     $LdDL     $LdDHLi   $LdDA     
  ;; 0x58-0x5f
  $LdEB     $LdEC     $LdED     $NOOP     $LdEH     $LdEL     $LdEHLi   $LdEA     
  ;; 0x60-0x67
  $LdHB     $LdHC     $LdHD     $LdHE     $NOOP     $LdHL     $LdHHLi   $LdHA     
  ;; 0x68-0x6f
  $LdLB     $LdLC     $LdLD     $LdLE     $LdLH     $NOOP     $LdLHLi   $LdLA     
  ;; 0x70-0x77
  $LdHLiB   $LdHLiC   $LdHLiD   $LdHLiE   $LdHLiH   $LdHLiL   $Halt     $LdHLiA   
  ;; 0x78-0x7f
  $LdAB     $LdAC     $LdAD     $LdAE     $LdAH     $LdAL     $LdAHLi   $NOOP     
  ;; 0x80-0x87
  $AddAB    $AddAC    $AddAD    $AddAE    $AddAH    $AddAL    $AddAHLi  $AddAA
  ;; 0x88-0x8f
  $AdcAB    $AdcAC    $AdcAD    $AdcAE    $AdcAH    $AdcAL    $AdcAHLi  $AdcAA
  ;; 0x90-0x97
  $SubAB    $SubAC    $SubAD    $SubAE    $SubAH    $SubAL    $SubAHLi  $SubAA
  ;; 0x98-0x9f
  $SbcAB    $SbcAC    $SbcAD    $SbcAE    $SbcAH    $SbcAL    $SbcAHLi  $SbcAA
  ;; 0xa0-0xa7
  $AndAB    $AndAC    $AndAD    $AndAE    $AndAH    $AndAL    $AndAHLi  $AndAA
  ;; 0xa8-0xaf
  $XorAB    $XorAC    $XorAD    $XorAE    $XorAH    $XorAL    $XorAHLi  $XorAA
  ;; 0xb0-0xb7
  $OrAB     $OrAC     $OrAD     $OrAE     $OrAH     $OrAL     $OrAHLi   $OrAA
  ;; 0xb8-0xbf
  $CpAB     $CpAC     $CpAD     $CpAE     $CpAH     $CpAL     $CpAHLi   $CpAA
  ;; 0xc0-0xc7
  $RetNz    $PopBC    $JpNz     $Jp       $CallNz   $PushBC   $AddAN    $RstN
  ;; 0xc8-0xcf
  $RetZ     $Ret      $JpZ      $SignCB   $CallZ    $CallNN   $AdcAN    $RstN
  ;; 0xd0-0xd7
  $RetNc    $PopDE    $JpNc     $OutNA    $CallNc   $PushDE   $SubAN    $RstN
  ;; 0xd8-0xdf
  $RetC     $Exx      $JpC      $InAN     $CallC    $SignDD   $SbcAN    $RstN
  ;; 0xe0-0xe7
  $RetPo    $PopHL    $JpPo     $ExSPiHL  $CallPo   $PushHL   $AndAN    $RstN
  ;; 0xe8-0xef
  $RetPe    $JpHL     $JpPe     $ExDEHL   $CallPe   $SignED   $XorAN    $RstN
  ;; 0xf0-0xf7
  $RetP     $PopAF    $JpP      $Di       $CallP    $PushAF   $OrAN     $RstN
  ;; 0xf8-0xff
  $RetM     $LdSPHL   $JpM      $Ei       $CallM    $SignFD   $CpAN     $RstN
)

;; Table of indexed instructions
(elem (i32.const $INDEXED_JT#)
  ;; 0x00-0x07
  $NOOP     $LdBCNN   $LdBCiA   $IncBC    $IncB     $DecB     $LdBN     $Rlca
  ;; 0x08-0x0f
  $ExAf     $AddIXBC  $LdABCi   $DecBC    $IncC     $DecC     $LdCN     $Rrca
  ;; 0x10-0x17
  $Djnz     $LdDENN   $LdDEiA   $IncDE    $IncD     $DecD     $LdDN     $Rla
  ;; 0x18-0x1f
  $JrE      $AddIXDE  $LdADEi   $DecDE    $IncE     $DecE     $LdEN     $Rra
  ;; 0x20-0x27
  $JrNz     $LdIXNN   $LdNNiIX  $IncIX    $IncXH    $DecXH    $LdXHN    $Daa
  ;; 0x28-0x2f
  $JrZ      $AddIXIX  $LdIXNNi  $DecIX    $IncXL    $DecXL    $LdXLN    $Cpl
  ;; 0x30-0x37
  $JrNc     $LdSPNN   $LdNNiA   $IncSP    $IncIXi   $DecIXi   $LdIXiN   $Scf
  ;; 0x38-0x3f
  $JrC      $AddIXSP  $LdANNi   $DecSP    $IncA     $DecA     $LdAN     $Ccf
  ;; 0x40-0x47
  $NOOP     $LdBC     $LdBD     $LdBE     $LdBXH    $LdBXL    $LdBIXi   $LdBA
  ;; 0x48-0x4f
  $LdCB     $NOOP     $LdCD     $LdCE     $LdCXH    $LdCXL    $LdCIXi   $LdCA
  ;; 0x50-0x57
  $LdDB     $LdDC     $NOOP     $LdDE     $LdDXH    $LdDXL    $LdDIXi   $LdDA
  ;; 0x58-0x5f
  $LdEB     $LdEC     $LdED     $NOOP     $LdEXH    $LdEXL    $LdEIXi   $LdEA
  ;; 0x60-0x67
  $LdXHB    $LdXHC    $LdXHD    $LdXHE    $NOOP     $LdXHXL   $LdHIXi   $LdXHA
  ;; 0x68-0x6f
  $LdXLB    $LdXLC    $LdXLD    $LdXLE    $LdXLXH   $NOOP     $LdLIXi   $LdXLA
  ;; 0x70-0x77
  $LdIXiB   $LdIXiC   $LdIXiD   $LdIXiE   $LdIXiH   $LdIXiL   $Halt     $LdIXiA
  ;; 0x78-0x7f
  $LdAB     $LdAC     $LdAD     $LdAE     $LdAXH    $LdAXL    $LdAIXi   $NOOP
  ;; 0x80-0x87
  $AddAB    $AddAC    $AddAD    $AddAE    $AddAXH   $AddAXL   $AddAIXi  $AddAA
  ;; 0x88-0x8f
  $AdcAB    $AdcAC   $AdcAD    $AdcAE    $AdcAXH   $AdcAXL   $AdcAIXi  $AdcAA
  ;; 0x90-0x97
  $SubAB    $SubAC    $SubAD    $SubAE    $SubAXH   $SubAXL   $SubAIXi  $SubAA
  ;; 0x98-0x9f
  $SbcAB    $SbcAC    $SbcAD    $SbcAE    $SbcAXH   $SbcAXL   $SbcAIXi  $SbcAA
  ;; 0xa0-0xa7
  $AndAB    $AndAC    $AndAD    $AndAE    $AndAXH   $AndAXL   $AndAIXi  $AndAA
  ;; 0xa8-0xaf
  $XorAB    $XorAC    $XorAD    $XorAE    $XorAXH   $XorAXL   $XorAIXi  $XorAA
  ;; 0xb0-0xb7
  $OrAB     $OrAC     $OrAD     $OrAE     $OrAXH    $OrAXL    $OrAIXi   $OrAA
  ;; 0xb8-0xbf
  $CpAB     $CpAC     $CpAD     $CpAE     $CpAXH    $CpAXL    $CpAIXi   $CpAA
  ;; 0xc0-0xc7
  $RetNz    $PopBC    $JpNz     $Jp       $CallNz   $PushBC   $AddAN    $RstN
  ;; 0xc8-0xcf
  $RetZ     $Ret      $JpZ      $SignCB   $CallZ    $CallNN   $AdcAN    $RstN
  ;; 0xd0-0xd7
  $RetNc    $PopDE    $JpNc     $OutNA    $CallNc   $PushDE   $SubAN    $RstN
  ;; 0xd8-0xdf
  $RetC     $Exx      $JpC      $InAN     $CallC    $SignDD   $SbcAN    $RstN
  ;; 0xe0-0xe7
  $RetPo    $PopIX    $JpPo     $ExSPiIX  $CallPo   $PushIX   $AndAN    $RstN
  ;; 0xe8-0xef
  $RetPe    $JpIX     $JpPe     $ExDEHL   $CallPe   $NOOP     $XorAN    $RstN
  ;; 0xf0-0xf7
  $RetP     $PopAF    $JpP      $Di       $CallP    $PushAF   $OrAN     $RstN
  ;; 0xf8-0xff
  $RetM     $LdSPIX   $JpM      $Ei       $CallM    $SignFD   $CpAN     $RstN
)

;; Table of bit instructions
(elem (i32.const $BIT_JT#)
  ;; 0x00-0x07
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x08-0x0f
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x10-0x17
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x18-0x1f
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x20-0x27
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x28-0x2f
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x30-0x37
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x38-0x3f
  $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopQ     $BopHLi   $BopQ
  ;; 0x40-0x47
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x48-0x4f
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x50-0x57
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x58-0x5f
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x60-0x67
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x68-0x6f
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x70-0x77
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x78-0x7f
  $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNQ    $BitNHLi  $BitNQ
  ;; 0x80-0x87
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0x88-0x8f
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0x90-0x97
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0x98-0x9f
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0xa0-0xa7
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0xa8-0xaf
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0xb0-0xb7
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0xb8-0xbf
  $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNQ    $ResNHLi  $ResNQ
  ;; 0xc0-0xc7
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xc8-0xcf
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xd0-0xd7
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xd8-0xdf
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xe0-0xe7
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xe8-0xef
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xf0-0xf7
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
  ;; 0xf8-0xff
  $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNQ    $SetNHLi  $SetNQ
)

;; Table of indexed bit instructions
(elem (i32.const $INDEXED_BIT_JT#)
  ;; 0x00-0x07
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x08-0x0f
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x10-0x17
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x18-0x1f
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x20-0x27
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x28-0x2f
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x30-0x37
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x38-0x3f
  $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ    $XBopQ
  ;; 0x40-0x47
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x48-0x4f
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x50-0x57
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x58-0x5f
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x60-0x67
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x68-0x6f
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x70-0x77
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x78-0x7f
  $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ   $XBitNQ
  ;; 0x80-0x87
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0x88-0x8f
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0x90-0x97
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0x98-0x9f
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0xa0-0xa7
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0xa8-0xaf
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0xb0-0xb7
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0xb8-0xbf
  $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ   $XResNQ
  ;; 0xc0-0xc7
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xc8-0xcf
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xd0-0xd7
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xd8-0xdf
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xe0-0xe7
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xe8-0xef
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xf0-0xf7
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
  ;; 0xf8-0xff
  $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ   $XSetNQ
)

;; Table of bit operations
(elem (i32.const $BOP_JT#)
  $Rlc
  $Rrc
  $Rl
  $Rr
  $Sla
  $Sra
  $Sll
  $Srl
)

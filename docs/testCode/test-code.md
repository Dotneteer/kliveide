# ZX Spectrum Next Test Code Snippets

## ULA 

```basic
  10 SAVE "/samples/ula.bas"
  20 RUN AT 3
  30 BORDER 5
  40 PRINT AT 0,0; PAPER 1; INK 3; "XYZ01234"
```

## ULA Clip + horizontal scroll

```basic
  10 SAVE "/samples/ulaclip.bas"
  20 RUN AT 3
  30 LAYER DIM 8,8,128,96
  40 BORDER 5
  50 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  60 FOR %s=0 TO 255
  70 REG $26,%s
  80 REG $27,0
  90 PAUSE 0
 100 NEXT %s
 110 PAUSE 0
 120 REG $26,0
 130 REG $27,0
```

## ULA Clip + vertical scroll

```basic
  10 SAVE "/samples/ulaclipy.bas"
  20 RUN AT 3
  30 LAYER DIM 8,8,128,96
  40 BORDER 5
  50 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  60 FOR %s=0 TO 192
  70 REG $26,0
  80 REG $27,%s
  90 PAUSE 0
 100 NEXT %s
 110 PAUSE 0
 120 REG $26,0
 130 REG $27,0
```

## ULA HiColor + horizontal scroll

```basic
  10 SAVE "/samples/ulahicol.bas"
  20 RUN AT 3
  30 LAYER 1,3
  40 BORDER 5
  50 CLS 
  60 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  70 FOR %s=0 TO 255
  80 REG $26,%s
  90 REG $27,0
 100 PAUSE 0
 110 NEXT %s
 120 PAUSE 0
 130 REG $26,0
 140 REG $27,0
```

## ULA HiColor + vertical scroll

```basic
  10 SAVE "/samples/ulahicoly.bas"
  20 RUN AT 3
  30 LAYER 1,3
  40 BORDER 5
  50 CLS 
  60 PRINT AT 0,0; PAPER 2; INK 6; "XYZ01234"
  70 FOR %s=0 TO 192
  80 REG $26,0
  90 REG $27,%s
 100 PAUSE 0
 110 NEXT %s
 120 PAUSE 0
 130 REG $26,0
 140 REG $27,0
```

## ULA HiRes + horizontal scroll

```basic
  10 SAVE "/samples/ulahires.bas"
  20 RUN AT 3
  30 LAYER 1,2
  40 BORDER 5
  50 CLS 
  60 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  70 FOR %s=0 TO 255
  80 REG $26,%s
  90 REG $27,0
 100 PAUSE 0
 110 NEXT %s
 120 PAUSE 0
 130 REG $26,0
 140 REG $27,0
```

## ULA HiRes + vertical scroll

```basic
  10 SAVE "/samples/ulahiresy.bas"
  20 RUN AT 3
  30 LAYER 1,2
  40 CLS 
  50 BORDER 5
  60 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  70 FOR %s=0 TO 192
  80 REG $26,0
  90 REG $27,%s
 100 PAUSE 0
 110 NEXT %s
 120 PAUSE 0
 130 REG $26,0
 140 REG $27,0
```

## ULA LoRes + horizontal scroll + clipping

```basic
  10 SAVE "/samples/ulalores.bas"
  20 RUN AT 3
  30 LAYER 1,0
  40 LAYER DIM 0,0,96,96
  50 CLS 
  60 BORDER 3
  70 FOR j=1 TO 2
  80 FOR %p=0 TO 7
  90 FOR %i=0 TO 7
 100 PRINT PAPER %p; INK %i; "X"; 
 110 NEXT %i
 120 NEXT %p
 130 NEXT j
 140 FOR %s=0 TO 255
 150 REG $32,%s
 160 REG $33,0
 170 PAUSE 0
 180 NEXT %s
 190 PAUSE 0
 200 REG $32,0
 210 REG $33,0
```

## ULA LoRes + vertical scroll

```basic
  10 SAVE "/samples/ulaloresy.bas"
  20 RUN AT 3
  30 LAYER 1,0
  40 CLS 
  50 BORDER 3
  60 FOR j=1 TO 2
  70 FOR %p=0 TO 7
  80 FOR %i=0 TO 7
  90 PRINT PAPER %p; INK %i; "X"; 
 100 NEXT %i
 110 NEXT %p
 120 NEXT j
 130 FOR %s=0 TO 192
 140 REG $32,0
 150 REG $33,%s
 160 PAUSE 0
 170 NEXT %s
 180 PAUSE 0
 190 REG $32,0
 200 REG $33,0
```

## ULA Lores Radastan + horizontal scroll + clipping

```basic
  10 SAVE "/samples/radas.bas"
  20 RUN AT 3
  30 LAYER 1,0
  40 LAYER DIM 0,0,96,96
  50 CLS 
  60 BORDER 3
  70 REG $15,BIN 10000000
  80 REG $6a,BIN 00100000
  90 FOR j=1 TO 2
 100 FOR %p=0 TO 7
 110 FOR %i=0 TO 7
 120 PRINT PAPER %p; INK %i; "X"; 
 130 NEXT %i
 140 NEXT %p
 150 NEXT j
 160 FOR %s=0 TO 255
 170 REG $32,%s
 180 REG $33,0
 190 PAUSE 0
 200 NEXT %s
 210 PAUSE 0
 220 REG $32,0
 230 REG $33,0
```

## ULA Lores Radastan + vertical scroll

```basic
  10 SAVE "/samples/radasy.bas"
  20 RUN AT 3
  30 LAYER 1,0
  50 CLS 
  60 BORDER 3
  70 REG $15,BIN 10000000
  80 REG $6a,BIN 00100000
  90 FOR j=1 TO 2
 100 FOR %p=0 TO 7
 110 FOR %i=0 TO 7
 120 PRINT PAPER %p; INK %i; "X"; 
 130 NEXT %i
 140 NEXT %p
 150 NEXT j
 160 FOR %s=0 TO 192
 170 REG $32,0
 180 REG $33,%s
 190 PAUSE 0
 200 NEXT %s
 210 PAUSE 0
 220 REG $32,0
 230 REG $33,0
```

## Layer 2 256x192x8 + horizontal scroll + clipping

```basic
  10 SAVE "/samples/layer2.bas"
  20 RUN AT 3
  30 LAYER 2,1
  40 REG $1c,$01
  50 REG $18,$08
  60 REG $18,$7f
  70 REG $18,$08
  80 REG $18,$7f
  90 CLS 
 100 BORDER 3
 110 FOR %p=0 TO 1
 120 FOR %i=0 TO 255
 130 PRINT PAPER %p; INK %i; "X"; 
 140 NEXT %i
 150 NEXT %p
 160 FOR %s=0 TO 256
 170 REG $16,%s
 180 REG $71,0
 190 REG $17,0
 200 PAUSE 0
 210 NEXT %s
 220 PAUSE 0
 230 REG $16,0
 240 REG $71,0
 250 REG $17,0
```

## Layer 2 256x192x8 + vertical scroll

```basic
  10 SAVE "/samples/layer2y.bas"
  20 RUN AT 3
  30 LAYER 2,1
  40 CLS 
  50 BORDER 3
  60 FOR %p=0 TO 1
  70 FOR %i=0 TO 255
  80 PRINT PAPER %p; INK %i; "X"; 
  90 NEXT %i
 100 NEXT %p
 110 FOR %s=0 TO 192
 120 REG $16,0
 130 REG $71,0
 140 REG $17,%s
 150 PAUSE 0
 160 NEXT %s
 170 PAUSE 0
 180 REG $16,0
 190 REG $71,0
 200 REG $17,0
```

## Layer 2 320x256x8 + horizontal scroll

```basic
  10 SAVE "/samples/layer2hi.bas"
  20 RUN AT 3
  30 BORDER 3
  40 REG $1c,$00
  50 REG $18,$00
  60 REG $18,$9f
  70 REG $18,$00
  80 REG $18,$ff
  90 REG $12,$09 
 100 REG $70,$10 
 110 REG $69,$80 
 120 REG $25,$04 
 130 FOR %i=0 TO $bfff
 140 BANK 09 POKE %i,176
 150 BANK 10 POKE %i,85
 160 BANK 11 POKE %i,23
 170 BANK 12 POKE %i,34
 180 BANK 13 POKE %i,45
 190 NEXT %i
 200 FOR %s=0 TO 256
 210 REG $16,%s
 220 REG $71,0
 230 REG $17,0
 240 PAUSE 0
 250 NEXT %s
 260 PAUSE 0
 270 REG $16,0
 280 REG $71,0
 290 REG $17,0
```

## Layer 2 640x256x4

```basic
  10 SAVE "/samples/layer2-640.bas"
  20 RUN AT 3
  30 BORDER 3
  40 REG $1c,$01
  50 REG $18,$00
  60 REG $18,$9f
  70 REG $18,$00
  80 REG $18,$ff
  90 REG $12,$09
 100 REG $70,$20
 110 REG $69,$80
 120 REG $15,$04
 130 FOR %i=0 TO $bfff
 140 BANK 09 POKE %i,11
 150 BANK 10 POKE %i,85
 160 BANK 11 POKE %i,$55
 170 BANK 12 POKE %i,34
 180 BANK 13 POKE %i,255
 190 NEXT %i
 200 PAUSE 0
 210 REG $16,0
 220 REG $17,0
```

## Tilemap 40x32 + attribute elimination

```basic
  10 SAVE "/samples/tm1.bas"
  20 RUN AT 3
  30 CLS 
  40 BORDER 3
  50 ; 
  60 ;  Clip
  70 ; 
  80 REG $1c,$08
  90 REG $1b,$00
 100 REG $1b,$9f
 110 REG $1b,$00
 120 REG $1b,$ff
 130 ; 
 140 ;  Offsets
 150 ; 
 160 REG $2f,$00
 170 REG $30,$00
 180 REG $31,$00
 190 ; 
 200 ;  Base adresses
 210 ; 
 220 REG $6e,$00: ;  map=$4000
 230 REG $6f,$18: ;  def=$5800
 240 ; 
 250 ;  Palette
 260 ; 
 270 REG $43,BIN 00110000
 280 REG $40,$00
 290 REG $41,BIN 00000000
 300 REG $41,BIN 00000011
 310 REG $41,BIN 11100000
 320 REG $41,BIN 11100011
 330 REG $41,BIN 00011100
 340 REG $41,BIN 00011111
 350 REG $41,BIN 11111100
 360 REG $41,BIN 11111111
 370 ; 
 380 ;  Define tile 0
 390 ; 
 400 DATA $00,$00,$00,$00
 410 DATA $04,$44,$44,$40
 420 DATA $04,$44,$44,$40
 430 DATA $04,$44,$22,$22
 440 DATA $04,$44,$22,$22
 450 DATA $04,$44,$33,$33
 460 DATA $04,$44,$33,$33
 470 DATA $04,$44,$11,$11
 480 RESTORE %400
 490 FOR %i=0 TO 31 
 500 READ %b
 510 BANK 5 POKE %i+$1800,%b
 520 NEXT %i
 530 ; 
 540 ;  Turn on tilemap
 550 ; 
 560 REG $6b,BIN 10100001
 570 REG $6c,BIN 00000000
 580 ; 
 590 ;  Return to ULA
 600 ; 
 610 PAUSE 0
 620 REG $6b,BIN 00000000
```

## Tilemap 40x32 + no attribute elimination + rotation and mirror

```basic
  10 SAVE "/samples/tm2.bas"
  20 RUN AT 3
  30 CLS 
  40 BORDER 3
  50 ; 
  60 ;  Clip
  70 ; 
  80 REG $1c,$08
  90 REG $1b,$00
 100 REG $1b,$9f
 110 REG $1b,$00
 120 REG $1b,$ff
 130 ; 
 140 ;  Offsets
 150 ; 
 160 REG $2f,$00
 170 REG $30,$00
 180 REG $31,$00
 190 ; 
 200 ;  Base adresses
 210 ; 
 220 REG $6e,$00: ;  map=$4000
 230 REG $6f,$18: ;  def=$5800
 240 ; 
 250 ;  Palette
 260 ; 
 270 REG $43,BIN 00110000
 280 REG $40,$00
 290 REG $41,BIN 00000000
 300 REG $41,BIN 00000011
 310 REG $41,BIN 11100000
 320 REG $41,BIN 11100011
 330 REG $41,BIN 00011100
 340 REG $41,BIN 00011111
 350 REG $41,BIN 11111100
 360 REG $41,BIN 11111111
 370 ; 
 380 ;  Define tile 0
 390 ; 
 400 DATA $00,$00,$00,$00
 410 DATA $04,$44,$44,$40
 420 DATA $04,$44,$44,$40
 430 DATA $04,$44,$22,$22
 440 DATA $04,$44,$22,$22
 450 DATA $04,$44,$33,$33
 460 DATA $04,$44,$11,$11
 470 DATA $00,$00,$11,$11
 480 RESTORE %400
 490 FOR %i=0 TO 31 
 500 READ %b
 510 BANK 5 POKE %i+$1800,%b
 520 NEXT %i
 530 ; 
 540 ;  Turn on tilemap
 550 ; 
 560 REG $6b,BIN 10000001
 570 REG $6c,BIN 00000000
 580 ; 
 590 ;  Rotation an mirror
 600 ; 
 610 BANK 5 POKE $0001,$00
 620 BANK 5 POKE $0003,$02
 630 BANK 5 POKE $0005,$04
 640 BANK 5 POKE $0007,$06
 650 BANK 5 POKE $0009,$08
 660 BANK 5 POKE $000b,$0a
 670 BANK 5 POKE $000d,$0c
 680 BANK 5 POKE $000f,$0e
 690 ; 
 700 ;  Return to ULA
 710 ; 
 720 PAUSE 0
 730 REG $6b,BIN 00000000
```

## Tilemap 40x32 + no attribute elimination + default attribute

```basic
  10 SAVE "/samples/tm3.bas"
  20 RUN AT 3
  30 CLS 
  40 BORDER 3
  50 ; 
  60 ;  Clip
  70 ; 
  80 REG $1c,$08
  90 REG $1b,$00
 100 REG $1b,$9f
 110 REG $1b,$00
 120 REG $1b,$ff
 130 ; 
 140 ;  Offsets
 150 ; 
 160 REG $2f,$00
 170 REG $30,$00
 180 REG $31,$00
 190 ; 
 200 ;  Base adresses
 210 ; 
 220 REG $6e,$00: ;  map=$4000
 230 REG $6f,$18: ;  def=$5800
 240 ; 
 250 ;  Palette
 260 ; 
 270 REG $43,BIN 00110000
 280 REG $40,$00
 290 REG $41,BIN 00000000
 300 REG $41,BIN 00000011
 310 REG $41,BIN 11100000
 320 REG $41,BIN 11100011
 330 REG $41,BIN 00011100
 340 REG $41,BIN 00011111
 350 REG $41,BIN 11111100
 360 REG $41,BIN 11111111
 370 ; 
 380 ;  Define tile 0
 390 ; 
 400 DATA $00,$00,$00,$00
 410 DATA $04,$44,$44,$40
 420 DATA $04,$44,$44,$40
 430 DATA $04,$44,$22,$22
 440 DATA $04,$44,$22,$22
 450 DATA $04,$44,$33,$33
 460 DATA $04,$44,$11,$11
 470 DATA $00,$00,$11,$11
 480 RESTORE %400
 490 FOR %i=0 TO 31 
 500 READ %b
 510 BANK 5 POKE %i+$1800,%b
 520 NEXT %i
 530 ; 
 540 ;  Turn on tilemap
 550 ; 
 560 REG $6b,BIN 10100001
 570 REG $6c,BIN 00000000
 580 ; 
 590 ;  Rotation an mirror
 600 ; 
 610 REG $6c,$0e
 620 ; 
 630 ;  Return to ULA
 640 ; 
 650 PAUSE 0
 660 REG $6b,BIN 00000000
```

## Tilemap 40x32 + no attribute elimination + multiple tile defs

```basic
  10 SAVE "/samples/tm4.bas"
  20 RUN AT 3
  30 CLS 
  40 BORDER 3
  50 ; 
  60 ;  Clip
  70 ; 
  80 REG $1c,$08
  90 REG $1b,$00
 100 REG $1b,$9f
 110 REG $1b,$00
 120 REG $1b,$ff
 130 ; 
 140 ;  Offsets
 150 ; 
 160 REG $2f,$00
 170 REG $30,$00
 180 REG $31,$00
 190 ; 
 200 ;  Base adresses
 210 ; 
 220 REG $6e,$00: ;  map=$4000
 230 REG $6f,$18: ;  def=$5800
 240 ; 
 250 ;  Palette
 260 ; 
 270 REG $43,BIN 00110000
 280 REG $40,$00
 290 REG $41,BIN 00000000
 300 REG $41,BIN 00000011
 310 REG $41,BIN 11100000
 320 REG $41,BIN 11100011
 330 REG $41,BIN 00011100
 340 REG $41,BIN 00011111
 350 REG $41,BIN 11111100
 360 REG $41,BIN 11111111
 370 ; 
 380 ;  Define tile 0
 390 ; 
 400 DATA $00,$00,$00,$00
 410 DATA $04,$44,$44,$40
 420 DATA $04,$44,$44,$40
 430 DATA $04,$44,$22,$22
 440 DATA $04,$44,$22,$22
 450 DATA $04,$44,$33,$33
 460 DATA $04,$44,$33,$33
 470 DATA $04,$44,$11,$11
 480 ; 
 490 ;  Define tile 1
 500 ; 
 510 DATA $00,$00,$11,$11
 520 DATA $22,$22,$33,$33
 530 DATA $44,$44,$55,$55
 540 DATA $66,$66,$77,$77
 550 DATA $00,$00,$11,$11
 560 DATA $22,$22,$33,$33
 570 DATA $44,$44,$55,$55
 580 DATA $66,$66,$77,$77
 590 ; 
 600 ;  Define tile 2
 610 ; 
 620 DATA $22,$22,$22,$22
 630 DATA $26,$66,$66,$62
 640 DATA $26,$66,$66,$62
 650 DATA $26,$66,$66,$62
 660 DATA $26,$66,$66,$62
 670 DATA $26,$66,$66,$62
 680 DATA $22,$22,$22,$22
 690 DATA $00,$00,$11,$11
 700 RESTORE %400
 710 FOR %i=0 TO 95 
 720 READ %b
 730 BANK 5 POKE %i+$1800,%b
 740 NEXT %i
 750 ; 
 760 ;  Add tile definitions
 770 ; 
 780 FOR %i=0 TO 100
 790 BANK 5 POKE %i*2+1,$01
 800 NEXT %i
 810 FOR %i=300 TO 400
 820 BANK 5 POKE %i*2+1,$02
 830 NEXT %i
 840 ; 
 850 ;  Turn on tilemap
 860 ; 
 870 REG $6b,BIN 10100001
 880 REG $6c,BIN 00000000
 890 ; 
 900 ;  Return to ULA
 910 ; 
 920 PAUSE 0
 930 REG $6b,BIN 00000000
```
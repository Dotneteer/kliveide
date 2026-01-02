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
  25 LAYER 1,3
  30 BORDER 5
  40 PRINT AT 2,0; PAPER 1; INK 3; "XYZ01234"
  50 FOR %s=0 TO 255
  60 REG $26,%s
  70 REG $27,0
  80 PAUSE 0
  90 NEXT %s
 100 PAUSE 0
 110 REG $26,0
 120 REG $27,0
```

## ULA HiColor + vertical scroll

```basic
  10 SAVE "/samples/ulahicol.bas"
  20 RUN AT 3
  30 LAYER 1,3
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

## Layer 2 256x192x8 + horizontal scroll

```basic
  10 SAVE "/samples/layer2.bas"
  20 RUN AT 0
  30 LAYER 2,1
  40 REG $1c,01
  50 REG $18,$00
  60 REG $18,$ff
  70 REG $18,$00
  80 REG $18,$9f
  90 CLS 
 100 BORDER 3
 110 FOR %p=0 TO 1
 120 FOR %i=0 TO 255
 130 PRINT PAPER %p; INK %i; "X"; 
 140 NEXT %i
 150 NEXT %p
 160 FOR %s=0 TO 255
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

## Layer 2 256x192x8 + vertical scroll + clipping

```basic
  10 SAVE "/samples/layer2y.bas"
  20 RUN AT 0
  30 LAYER 2,1
  40 REG $1c,01
  50 REG $18,$08
  60 REG $18,$c0
  70 REG $18,$00
  80 REG $18,$8f
  90 CLS 
 100 BORDER 3
 110 FOR %p=0 TO 1
 120 FOR %i=0 TO 255
 130 PRINT PAPER %p; INK %i; "X"; 
 140 NEXT %i
 150 NEXT %p
 160 FOR %s=0 TO 192
 170 REG $16,0
 180 REG $71,0
 190 REG $17,%s
 200 PAUSE 0
 210 NEXT %s
 220 PAUSE 0
 230 REG $16,0
 240 REG $71,0
 250 REG $17,0
```
100 REM CRTC register explorer for the Videoton TV Computer.
110 REM Port of Kieran Connell's BBC BASIC MODE 1 CRTC explorer.
120 REM BBC poked the 6845 at &FE00/&FE01. TVC uses OUT 112,113 (ports 70H/71H).
130 REM Defaults are the TVC firmware values, not BBC MODE 1.
140 REM Cursor keys: up=5, down=24, left=19, right=4. Press R to reset.
150 GRAPHICS 2
160 SET PAPER 0 : SET PALETTE 0,85 : SET BORDER 1
170 M=11 : DIM R(M) : DIM N$(M)*22
180 GOSUB 700
190 A=0
200 PRINT AT 16,10: "Total scanlines = ";(R(4)+1)*(R(9)+1)+R(5);"    "
210 PRINT AT 17,10: "Displayed bytes = ";R(1)*R(6);"      "
220 PRINT AT 3+A,3: "=>";
230 K$=INKEY$ : IF K$="" THEN 230
240 PRINT AT 3+A,3: "  ";
250 K=ORD(K$)
260 IF K=5 AND A>0 THEN A=A-1
270 IF K=24 AND A<M THEN A=A+1
280 IF K<>19 THEN 310
290 R(A)=R(A)-1 : IF R(A)<0 THEN R(A)=R(A)+256
300 GOSUB 600 : GOTO 200
310 IF K<>4 THEN 340
320 R(A)=R(A)+1 : IF R(A)>255 THEN R(A)=R(A)-256
330 GOSUB 600 : GOTO 200
340 IF K=ORD("R") OR K=ORD("r") THEN GOSUB 700
350 GOTO 200
360 END
500 REM Coordinate grid so CRTC clipping is visible
510 CLS
520 FOR Y=1 TO 24 : PRINT AT Y,1: Y; : NEXT
530 REM CHR$ avoids the leading space BASIC adds when printing a number.
540 REM 0E6BH is editor width; raise it so col 64 does not wrap/insert a line.
550 POKE 3691,65
560 FOR X=1 TO 64 : PRINT AT 1,X: CHR$(48+X-INT(X/10)*10); : NEXT
570 FOR Y=2 TO 23 : PRINT AT Y,64: CHR$(48+Y-INT(Y/10)*10); : NEXT
580 FOR X=3 TO 64 : PRINT AT 24,X: CHR$(48+X-INT(X/10)*10); : NEXT
590 POKE 3691,64
592 PRINT AT 19,11: "Use cursor keys to"
593 PRINT AT 20,11: "change register values"
594 PRINT AT 21,11: "Press R to reset"
596 FOR I=0 TO M : A=I : GOSUB 650 : NEXT
598 RETURN
600 REM Write register A and keep the cursor IRQ on the last displayed byte
610 OUT 112,A : OUT 113,R(A)
620 CA=R(1)*R(6) : IF CA>0 THEN CA=CA-1
630 OUT 112,14 : OUT 113,INT(CA/256)
640 OUT 112,15 : OUT 113,CA-INT(CA/256)*256
650 PRINT AT 3+A,6: N$(A);TAB(28);"R";A;"=";R(A);"  "
660 RETURN
700 REM Firmware CRTC defaults from info/tvc.md
710 RESTORE
720 FOR I=0 TO M : READ N$(I),R(I) : NEXT
730 FOR I=0 TO M : A=I : GOSUB 610 : NEXT
740 A=0
750 GOSUB 500
760 RETURN
900 DATA "Horizontal total-1",99
910 DATA "Horizontal displayed",64
920 DATA "Horizontal sync pos",75
930 DATA "Horiz sync width",50
940 DATA "Vertical total-1",77
950 DATA "Vert total adjust",2
960 DATA "Vertical displayed",60
970 DATA "Vertical sync pos",66
980 DATA "Interlace control",0
990 DATA "Scanlines per row-1",3
1000 DATA "Cursor start",3
1010 DATA "Cursor end",3

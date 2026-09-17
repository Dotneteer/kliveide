No copper. This case checks the pipeline itself: assembling, loading, running, capturing.

**Should see:** a red border (ULA colour 2, `#B60000`) all around a yellow paper area (ULA
colour 6, `#B6B600`). The paper is the 256x192 ULA display, which is 512x192 in the doubled-width
buffer (x 96-607, y 48-239). Border width: 96 px left, 112 px right, 48 rows above and below.

**Must not see:** ink pixels (all bitmap bytes are 0), any third colour, or a flashing/changing
picture: the program parks in `jr $` with interrupts disabled, so every captured frame (50, 100, 200; with `--long` also 1000 and 10000) is
identical.

**Source of the expectation:** the ZX Spectrum attribute byte `$30` = PAPER 6, INK 0, no BRIGHT;
`OUT ($FE),2` sets the border to red. The screen geometry (48-row top border, paper at x 96) is
Klive's buffer layout, not a hardware fact, so this case is also the reference for it.

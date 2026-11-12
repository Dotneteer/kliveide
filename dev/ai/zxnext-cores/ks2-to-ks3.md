# KS2 (issue 4) to KS3 (issue 5): the board delta

What a program can see differ between the two boards, classified from the public VHDL of core
3.02.04 (`zxnext.vhd`, `zxnext_top_issue4.vhd`, `zxnext_top_issue5.vhd`). `dev/plans/ZXNEXT_3_03_PLAN.md`
phase 3. In C a board difference is guarded by `ZXNEXT_BOARD_ISSUE >= 3` (`zxnext-profile.h`).

| # | Item | VHDL | Klive |
|---|---|---|---|
| 1 | `g_board_issue` is 3; NextReg `$0F` reads it | top_issue5 ~39; zxnext ~6455 | `ZXNEXT_BOARD_ISSUE` (build define) |
| 2 | 4 MB SRAM: address bit 21 reaches the SRAM on issue 5 only | zxnext ~1763-1777 | `ZXNEXT_SRAM_SIZE`, the upper 2 MB after the error page (`zxnextSramOffset`) |
| 3 | NextReg `$04` keeps 8 bits (7 on issues 2-4): config mode maps any 16K bank of the 4 MB | zxnext ~6218-6246 | `ZXNEXT_NR_04_MASK` (`zxnext-memory.c`) |
| 4 | The MMU and Layer 2 still reach pages 0-223 only (`*_A21_A13` bit 8 set above `$DF`) | zxnext ~3258, ~3265 | unchanged |
| 5 | +3 FDC signals on the expansion bus (`$81` bit 3, `$1FFD` bit 3) | zxnext ~1818-1834 | the bit and the motor latch are stored on every board already (3.02.04 delta); no device is attached, so nothing else is visible |
| 6 | `$10` core ID: same rule as issue 4 (`g_board_issue >= 2`) | zxnext ~6200 | unchanged |
| 7 | Expansion-bus peripheral generics: same as issue 4 | zxnext ~8090 | unchanged |
| 8 | VGA DAC 8 bits a channel (DDR pins), a 3 ns delayed 28 MHz clock, a VGA test pattern generic | top_issue5 | not visible to a program: Klive renders the digital RGB |

Nothing else in `zxnext.vhd@3.02.04` reads `g_board_issue` (12 occurrences: the generic, the eight
generate blocks above and the `$0F` read).

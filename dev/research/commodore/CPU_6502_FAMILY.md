# The MOS 6502 family in the Commodore machines

Research pack, Commodore plan. **Facts, not a plan.** Written 2026-11-23.

Scope: the NMOS 6502 core as the Commodore 64 (6510, 8500), C128 (8502), C16/C116/Plus/4
(7501, 8501), VIC-20 (6502) and the 1541 drive (6502) use it, at the precision a cycle-exact
C/WebAssembly core needs. Other files in this pack cover the VIC-II, TED, VIA/CIA and the 1541's
gate array; this file stops at the CPU's pins.

Conventions:

- Sources are cited inline. *Inference* marks something concluded rather than read.
- GPL sources (VICE) were read for facts only; nothing here is copied from them. BSD/MIT/zlib
  sources (MAME's m6502, floooh's chips, Clock Signal) were read and are summarised, not copied.
- No published commented ROM disassembly was used. (`dev/research/c64_rom_disassembly.txt` exists
  in the repository; it was not opened.)
- "Cycle" means one φ2 period of the CPU. "R" / "W" are bus read / write cycles.

---

## §1 Family members and how they differ

### §1.1 Summary table

| Chip | Used in | Process | Port | NMI pin | SO pin | SYNC pin | RDY | AEC | Clock |
|---|---|---|---|---|---|---|---|---|---|
| 6502 | VIC-20, 1541 (also 1540, 1570/71 use 6502-family parts) | NMOS | none | yes | yes | yes | yes | no | φ0 in, φ1/φ2 out |
| 6510 | C64 (breadbin), SX-64 | NMOS | 6 bits (P0-P5) at $00/$01 | yes | **no** | **no** | yes | yes | φ0 in, φ2 out |
| 8500 | C64C / later C64 boards | HMOS-II | same as 6510 | yes | no | no | yes | yes | same |
| 8502 | C128 / C128D | HMOS-II | 7 bits (P0-P6) | yes | no | no | yes | yes | 1 MHz or 2 MHz |
| 7501 / 8501 | C16, C116, Plus/4 | HMOS-I / HMOS-II | 7 bits (P0-P4, P6, P7; no P5 pin) | **no** | no | no | yes | yes | φ0 from TED |
| 6510T | 1551 drive (Plus/4 family) | NMOS | 8 bits | no | - | - | no | - | - |

Sources: 6510 pinout and pin functions, Ruud Baltissen's pages hosted by J. Schepers,
<https://ist.uwaterloo.ca/~schepers/MJK/6510.html> (lists ø0 in, RDY, /IRQ, /NMI, AEC, A0-A15,
P0-P5, D0-D7, R/W, ø2 out, /RES; no SO and no SYNC). 7501/8501 pinout,
<https://ist.uwaterloo.ca/~schepers/MJK/7501.html> (page marked "NOT VERIFIED!" by its author;
lists RDY, /IRQ, AEC, no /NMI, P0-P4, P6, P7; "P5 not externally accessible"). 8500/8502
process and role, Wikipedia's 6510/8502 articles (<https://en.wikipedia.org/wiki/MOS_Technology_6510>,
<https://en.wikipedia.org/wiki/MOS_Technology_8502>). 6510T in the 1551 (no NMI/RDY): search summary of
the same Schepers pages. MAME models the 7501 and the 8502 as the 6510 with no core changes:
`src/devices/cpu/m6502/m7501.cpp` ("6510 derivative, essentially identical") and `m8502.cpp`
("6510 derivative, capable of running at 2MHz"), BSD-3-Clause, <https://github.com/mamedev/mame>.

### §1.2 One instruction core

All of these are NMOS-architecture 6502 cores (HMOS is a process refinement of NMOS, not the CMOS
65C02). The documented instruction set, the cycle counts, the bus sequences (§2), the interrupt
behaviour (§3), the NMOS decimal flags (§5) and the set of undocumented opcodes (§6) are the same
on all of them. Evidence:

- MAME derives `m6510`, `m7501`, `m8502` from `m6502_device` and shares one opcode table
  (`om6502.lst`) for the stable behaviour; the derived classes add only the port
  (`m6510.cpp`), the clock (8502) and nothing else (7501).
- VICE runs one CPU core (`src/6510core.c`, GPL, facts only) for the C64, C128 (8502 mode),
  Plus/4 and VIC-20, and a copy of it for the drives.
- VICE testprogs `CPU/sha`, `CPU/shxy` readmes record the SHA/SHX/SHY results as "verified on
  C64(old) with 6510 ... C64C(new) with 8500" with the same results
  (<https://github.com/libsidplayfp/VICE-testprogs/tree/master/CPU>).

What does differ between individual chips is only the **unstable** part of the undocumented set:
the ANE/LXA "magic constant" and some RDY-related side effects (§6.3), which vary by chip, date
code and temperature. *Inference*: the HMOS parts (8500/8502/7501) may differ from the NMOS 6510
there, but no source found states a systematic per-model constant; VICE testprogs
`CPU/ane-lax/dumps` holds per-machine dumps that are the best evidence (dump names such as
`dump6510_3184` identify the CPU date code).

The 6502 itself has an early-1976 "ROR bug" revision; no Commodore machine in scope uses it
(*inference*: all are well after June 1976).

### §1.3 The 6510 processor port ($00/$01)

Registers: $00 is the data direction register (DDR, 1 = output), $01 is the data register.
On reset both are cleared, so every bit is an input (VICE `c64/c64pla.c`, `c64pla_pport_reset`,
fact: "both DDR and DATA are 0 after poweron/reset").

C64 wiring (bits 0-5): P0 LORAM, P1 HIRAM, P2 CHAREN, P3 cassette write (output), P4 cassette
sense (input), P5 cassette motor (output) (Schepers 6510 page; C64-wiki
<https://www.c64-wiki.com/wiki/Zeropage>).

Read value of $01 — facts from VICE `c64pla_config_changed` (GPL, own words):

- An output bit reads back the latched data bit.
- An input bit reads the pin. LORAM, HIRAM, CHAREN and cassette sense have pull-up resistors
  (VICE passes a pull-up mask of $17, bits 0,1,2,4), so with DDR=0 the KERNAL/BASIC/I/O are
  banked in, which is how the machine boots.
- Bit 5 (motor) reads 0 when it is an input; bit 4 (sense) reads 0 when a Datasette key is
  pressed; bit 3 (write) is pulled low by the tape port when it is an input.
- Bits 6 and 7 have no pins but the latch and DDR bits exist (§1.4).

Bus behaviour of a write to $00 or $01: the CPU's internal port register takes the value, **and the
write cycle still appears on the external bus**, so the RAM under $00/$01 is written too — but with
the value the VIC-II left on the data bus in the preceding φ1 half-cycle, not with the CPU's
value (VICE `c64mem.c`, `zero_store`, stores `vicii_read_phi1_lowlevel()` into RAM for both
addresses). A read of $00/$01 returns the port, never the RAM. The RAM at $00/$01 is visible to
the VIC-II and readable by the CPU only through tricks (e.g. sprite collision / VIC fetches).
*Inference*: an emulator needs the "last VIC-II φ1 byte" to model this; it is visible to software.

### §1.4 Floating bits 6/7 and the "capacitor fade"

Observed behaviour, from VICE testprogs `CPU/cpuport/readme.txt` (theory marked as partly
guesswork by its author) and VICE `c64/c64.h`, `c64/c64mem.c` (`zero_read`, `zero_store`):

1. All 8 DDR bits are implemented and read back.
2. All 8 data latch bits exist. An unconnected bit programmed as output reads back what was
   written.
3. When an unconnected bit is switched from output to input, or written while an output, a
   charge is left on the floating node; reading it as input returns the last driven value until it
   "fades" to 0 after a delay.
4. The delay depends on the chip and temperature.

Delay values in use or measured:

| Source | 6510 | 8500 | 8502 | Notes |
|---|---|---|---|---|
| VICE `c64.h` | 350,000 cycles (~350 ms), plus up to 20 % random | 1,500,000 cycles (~1.5 s) | - | bits 6,7 |
| VICE `c64.h` (SX-64) | 1,500,000 cycles for bits 3,4,5 | | | those pins are unconnected on the SX-64 board |
| VICE `c128.h` | | | 53,000 cycles (~53 ms), bit 7 | |
| VICE testprogs `cpuport` readme | "some hundred microseconds" (text) | measured "~200000us" on a new C64 | | internal inconsistency, see D5 |
| VICE `c64.h` comment on Lorenz `cpuport.prg` | must be ≥ 5,984 cycles or that test fails | | | |

Software that depends on it: Lorenz `cpuport.prg`; a SID (`Rayden/Boot_Zak_v2.sid`) per the
cpuport readme. MAME models the same thing generically: `m6510_device::set_pulls(pullup, floating)`
and `set_floating_falloff(mask, cycles)`; `port_r()` returns floating bits from a "drive" latch
until a per-bit deadline passes (`m6510.cpp`, BSD-3). floooh's `m6502.h` has
`m6510_io_pullup` / `m6510_io_floating` and a `io_drive` latch but **no fade timer**: a floating
bit keeps its last driven value forever (read of `m6510_iorq`, zlib).

### §1.5 8500 (C64C)

Same pins, same port, same instruction set; HMOS-II; lower power. Differences an emulator sees:
the fade time of bits 6/7 (§1.4) and possibly the ANE/LXA constants (§6.3). (Schepers 6510 page:
"fully compatible"; VICE `c64.h` comment: the 6510's unused bits are "more temperature
dependant" and fade faster than the 8500's.)

### §1.6 8502 (C128)

- Port: 7 bits. Bits 0-5 as on the C64 (in C128 mode the MMU, not P0-P2, does banking; in C64
  mode they drive the C64 PLA logic). **Bit 6 is an input: the CAPS LOCK / ASCII-DIN key**,
  which on international machines selects the character ROM (VICE `c128/c128mem.c`, comment above
  `mem_update_chargen`; pull-up mask $57 = bits 0,1,2,4,6). Bit 7 is unconnected and fades (§1.4).
- 2 MHz mode: selected by bit 0 of the VIC-IIe register $D030. The 8502 then runs at about
  2.04 MHz (twice the 1 MHz system clock) by using the φ1 half-cycles the VIC-II normally owns.
  The 40-column VIC picture is not usable in 2 MHz mode (the VIC loses its φ1 fetches), so
  software switches to 1 MHz for 40-column display or I/O timing. *Inference* on the exact
  mechanism and on what happens to I/O accesses (CIA/SID are 1 MHz parts) in 2 MHz mode;
  see OQ3. This belongs in the C128 file of this pack.
- Same core otherwise; the Z80 in the C128 is out of this file's scope.

### §1.7 7501 / 8501 (C16, C116, Plus/4)

- No NMI pin (Schepers 7501 page). A Plus/4 World forum thread says the core "accepts NMI" but the
  board never wires one (<https://plus4world.powweb.com/forum/3948>). *Inference*: the die is a
  6510-family core, so an NMI input exists internally and is tied inactive; for emulation the
  difference does not matter — there is no NMI source. See D6.
- Clock: φ0 is generated by the TED. The TED runs the CPU at "single clock" while it fetches
  display data and at "double clock" in the borders / with the display blanked (*inference* from
  general Plus/4 sources; nominal PAL ~0.886 / ~1.773 MHz). The TED also uses RDY/AEC to stop
  the CPU on bad lines. Details belong to the TED file; see OQ4.
- Port (VICE `plus4/plus4mem.c`, `mem_proc_port_read` / `mem_proc_port_store`; Schepers 7501
  page):

  | Bit | Direction | Connected to |
  |---|---|---|
  | P0 | out | serial (IEC) DATA out (inverted on the bus) |
  | P1 | out | serial CLK out; also cassette write |
  | P2 | out | serial ATN out |
  | P3 | out | cassette motor (active low per VICE) |
  | P4 | in | cassette read |
  | P5 | — | no pin; VICE masks it to 0 in both DDR and data reads ($DF) |
  | P6 | in | serial CLK in |
  | P7 | in | serial DATA in (also cassette sense if jumper J8 closed, Schepers) |

  The serial bus is driven straight from the CPU port; there is no CIA in these machines.
- Writes to $00/$01 also go to the RAM underneath (VICE `zero_store` writes `mem_ram[addr] = value`
  for both — here with the CPU's value, unlike the C64; *inference*: because the TED, not a
  separate video chip with its own φ1 bus, is involved).

### §1.8 6502 in the VIC-20 and 1541

Plain NMOS 6502 with SO and SYNC pins. The 1541 ties SO to the gate array's BYTE READY (gated by
VIA2's CA2, "SOE") so that each GCR byte arriving from the head sets V (§4.4). The VIC-20's
6502 is clocked by the VIC (6560/6561) and is never halted by it (*inference*: the VIC 656x
interleaves its fetches in φ1 and has no BA/RDY stealing; confirm in the VIC-20 file).

---

## §2 Cycle-by-cycle bus behaviour

Ground rules for every NMOS 6502 (source: "64doc" by John West and Marko Mäkelä, the classic
cycle reference, shipped in VICE testprogs `CPU/64doc` and mirrored at
<https://archive.nesdev.org/6502_cpu.txt>; cross-checked against Tom Harte's per-cycle tests,
§7.1, and floooh's decoder):

- **Every cycle is a bus cycle.** The NMOS 6502 never idles the bus; when it has nothing to do
  it performs a dummy read (or, in RMW, a dummy write). Dummy accesses hit I/O registers and
  have side effects (CIA ICR acknowledge, VIA flag clears, VIC $D019).
- The first cycle of every instruction is the opcode fetch at PC (SYNC high on a 6502).
- A two-byte instruction always reads the byte after the opcode in cycle 2, even if it has no
  operand.
- Zero-page indexing wraps within page 0. The stack is always $0100-$01FF and S wraps within it.
- Indexing with page crossing: the low byte is added first, the high byte is fixed one cycle
  later; the intermediate (wrong-page) address is put on the bus as a read.

### §2.1 Per-mode sequences

Notation: `PC` = read at PC then PC+1; `PC'` = read at PC without increment; `[a]` = read of
address a; `W[a]` = write; `AL/AH` = address low/high; `BAL/BAH` = base before indexing;
`unfixed` = BAH:(BAL+index)&$FF; `fixed` = correct 16-bit sum; `zp` = page-zero address.

| Mode | Kind | Cycles | Sequence after cycle 1 (opcode fetch) |
|---|---|---|---|
| Implied / accumulator | - | 2 | 2: `PC'` dummy |
| Immediate | R | 2 | 2: `PC` operand |
| Zero page | R | 3 | 2: `PC` zp; 3: `[zp]` |
| Zero page | W | 3 | 2: `PC` zp; 3: `W[zp]` |
| Zero page | RMW | 5 | 2: `PC` zp; 3: `[zp]`; 4: `W[zp]` **old value**; 5: `W[zp]` new value |
| zp,X / zp,Y | R / W | 4 | 2: `PC` zp; 3: `[zp]` dummy; 4: `[(zp+i)&FF]` or W |
| zp,X | RMW | 6 | as above, then read, write old, write new at (zp+X)&FF |
| Absolute | R / W | 4 | 2: `PC` AL; 3: `PC` AH; 4: `[AH:AL]` or W |
| Absolute | RMW | 6 | 2-3 as above; 4: read; 5: write old; 6: write new |
| abs,X / abs,Y | R | 4 (+1) | 2: AL; 3: AH; 4: `[unfixed]`; if page crossed 5: `[fixed]` |
| abs,X / abs,Y | W | 5 | 4: `[unfixed]` dummy, always; 5: `W[fixed]` |
| abs,X (abs,Y undoc.) | RMW | 7 | 4: `[unfixed]` dummy; 5: `[fixed]`; 6: write old; 7: write new |
| (zp,X) | R / W | 6 | 2: `PC` zp; 3: `[zp]` dummy; 4: `[(zp+X)&FF]` AL; 5: `[(zp+X+1)&FF]` AH; 6: `[AH:AL]` or W |
| (zp,X) (undoc.) | RMW | 8 | 6: read; 7: write old; 8: write new |
| (zp),Y | R | 5 (+1) | 2: zp; 3: `[zp]` BAL; 4: `[(zp+1)&FF]` BAH; 5: `[unfixed]`; if crossed 6: `[fixed]` |
| (zp),Y | W | 6 | 5: `[unfixed]` dummy always; 6: `W[fixed]` |
| (zp),Y (undoc.) | RMW | 8 | 5: dummy; 6: read fixed; 7: write old; 8: write new |
| JMP abs | - | 3 | 2: AL; 3: AH (PC loaded) |
| JMP (ind) | - | 5 | 2: IAL; 3: IAH; 4: `[IAH:IAL]` → PCL; 5: `[IAH:(IAL+1)&FF]` → PCH (**page-wrap bug**) |
| JSR | - | 6 | 2: `PC` AL (PC now points at AH); 3: `[$0100+S]` dummy; 4: `W[$0100+S]` PCH, S-1; 5: `W` PCL, S-1; 6: `PC` AH, PC = AH:AL |
| RTS | - | 6 | 2: `PC'` dummy; 3: `[$0100+S]` dummy, S+1; 4: pull PCL, S+1; 5: pull PCH; 6: `[PC]` dummy, PC+1 |
| RTI | - | 6 | 2: `PC'` dummy; 3: `[$0100+S]` dummy, S+1; 4: pull P, S+1; 5: pull PCL, S+1; 6: pull PCH |
| PHA / PHP | - | 3 | 2: `PC'` dummy; 3: `W[$0100+S]`, S-1 |
| PLA / PLP | - | 4 | 2: `PC'` dummy; 3: `[$0100+S]` dummy, S+1; 4: `[$0100+S]` value |
| Branch not taken | - | 2 | 2: `PC` offset |
| Branch taken, same page | - | 3 | 2: `PC` offset; 3: `[PC]` dummy (opcode after the branch), PCL += offset |
| Branch taken, page crossed | - | 4 | 3: as above; 4: `[PCH_old:PCL_new]` dummy, then PCH fixed |
| BRK | - | 7 | §3.2 |

Notes:

- **RMW double write.** The NMOS core writes the unmodified value back in the cycle it computes the
  result, then writes the result. On the C64 this is relied upon: `INC $D019` / `LSR $D019` /
  `ASL $D019` acknowledge the VIC-II's interrupt latch with the first (old-value) write; a RMW on a
  CIA ICR or VIA register produces two writes. The 65C02 instead does two reads, which is why
  C64 code is NMOS-specific (masswerk notes; nesdev "CPU" pages).
- **Dummy reads on I/O.** `LDA $DC0D` acknowledges CIA 1's interrupts; so does any instruction
  whose dummy read lands on $DC0D, e.g. abs,X with a page cross from $DBxx. The (zp),Y and abs,X
  write forms *always* perform the dummy read at the unfixed address.
- **JSR** reads the high address byte in the **last** cycle, after pushing; self-modifying code
  that overwrites the high byte of its own JSR operand via the stack pushes sees the new byte
  (VICE testprogs `CPU/jsrselfmod`).
- **Branch PC** for page crossing: the reference is the address of the instruction after the
  branch (PC after the operand).
- **Read-only undocumented forms** (LAX, NOP abs,X, LAS) take the +1 page-cross penalty; write and
  RMW forms (SAX, SHx, SLO...) take the fixed count.
- In a Harte test, "only one bus operation per cycle" and "any address not listed is never
  touched" are checked, so the dummy-access addresses above are verifiable (§7.1).

### §2.2 Cycle counts that matter for C64 timing code

Documented-opcode counts are those of the MCS6500 programming manual
(<https://archive.org/details/mcs-6500-family-hardware-manual-1976-01> hardware manual; programming
manual equivalent). The longest instruction is 8 cycles (undocumented RMW (zp,X)/(zp),Y). Stable
raster code depends on exact counts, the branch penalty and the interrupt latency jitter (§3.4).

---

## §3 Interrupts

Primary source: nesdev wiki "CPU interrupts" (<https://www.nesdev.org/wiki/CPU_interrupts>), which
describes the shared NMOS core, cross-checked against floooh `m6502.h` (`m6502_tick`, interrupt
pipeline) and Clock Signal `Processors/6502/Implementation/6502Implementation.hpp`.

### §3.1 Detection

- **IRQ** is level-sensitive. The line is sampled during φ2; if low, an internal signal is raised
  in the next φ1 for one cycle only, so IRQ must stay low to keep being seen.
- **NMI** is edge-sensitive. A high-to-low change between consecutive φ2 samples sets an internal
  latch that stays set until the NMI is serviced. Holding NMI low does not cause a second NMI; it
  must go high and low again. (On the C64 this matters: CIA 2 and RESTORE share the line, so an
  unacknowledged CIA 2 NMI blocks RESTORE.)
- **RESET** is level; while low the CPU is held; the 7-cycle sequence runs after release.
- MAME ignores an NMI (and SO) edge in the same cycle reset is released (`m6502.cpp`,
  `execute_set_input`).

### §3.2 Sequences (all 7 cycles)

| Cycle | BRK | IRQ / NMI | RESET |
|---|---|---|---|
| 1 | fetch opcode $00, PC+1 | opcode fetch suppressed: read at PC, forced to $00, no PC increment | same, no increment |
| 2 | read PC (padding byte), PC+1 | read PC, no increment | read PC |
| 3 | push PCH | push PCH | read $0100+S (write suppressed), S-1 |
| 4 | push PCL | push PCL | same |
| 5 | push P with B=1 (bit 5 always 1) | push P with B=0 | same (S ends 3 lower) |
| 6 | read vector low, set I | read vector low, set I | read $FFFC, set I |
| 7 | read vector high | read vector high | read $FFFD |

Vectors: NMI $FFFA, RESET $FFFC, IRQ/BRK $FFFE. D is **not** cleared by interrupts on NMOS
(6502.org decimal tutorial, <http://www.6502.org/tutorials/decimal_mode.html>). After power-up
A/X/Y/S/D are undefined in principle; S typically ends at $FD after the reset sequence (S starts at
0 and the three suppressed pushes decrement it) — *inference* from the sequence; emulators and
Harte-style tests take $FD.

The B "flag" does not exist in the register; it only exists in the byte pushed by PHP/BRK (1) or
IRQ/NMI (0). Bit 5 is always pushed as 1.

### §3.3 When interrupts are taken (polling)

- An interrupt is acted on if it was detected by the end of the **second-to-last** cycle of the
  current instruction (i.e. the signal state at that point, not at the last cycle). floooh
  implements this with an `irq_pip` / `nmi_pip` shift register shifted each tick and tested at
  SYNC, with IRQ needing to be active "in the full cycle before SYNC".
- NMI has priority if both are pending; the IRQ, still asserted, is taken later.
- The interrupt sequence itself does not poll; at least one instruction of the handler runs before
  another interrupt is taken (floooh: "no interrupt poll at the end of the interrupt sequence").
- **Branches**: polling happens before cycle 2 (operand fetch) but **not** before cycle 3 of a taken
  branch. For a taken branch that crosses a page there is an additional poll before the fix-up
  cycle. Consequence: an IRQ that becomes visible only during the third cycle of a taken,
  non-crossing branch is delayed by one instruction. floooh implements this by shifting the
  interrupt pipelines back one step in the taken-no-cross path (`irq_pip >>= 1; nmi_pip >>= 1`
  in the branch decoder).
- **CLI / SEI / PLP** poll at the end of their first cycle, before I changes. So after CLI with an
  IRQ pending, one more instruction runs before the IRQ; after SEI, an IRQ can still be taken right
  after the SEI. **RTI** changes I before polling, so an IRQ pending when RTI clears I is taken
  immediately after RTI.

### §3.4 Interrupt hijacking

- The vector is chosen when the vector fetch starts (after the PCH/PCL/P pushes). An NMI that is
  detected during the first four cycles of a BRK or IRQ sequence redirects it to $FFFA. A hijacked
  BRK pushes P with B=1, so an NMI handler can see it; the BRK itself is lost (it does not run
  again). A hijacked IRQ is usually re-taken after the NMI's RTI because the line is still low.
- An IRQ can hijack BRK, invisibly (same vector).
- floooh checks the NMI pipeline in BRK cycle index 3 (the P push) and notes "NMI half-hijacking
  not possible" in the vector-fetch cycle; after the sequence it re-arms a pending NMI so it is
  taken after the first handler instruction.
- C64 relevance: stable raster routines and tape/disk loaders that run NMIs from CIA 2 while IRQs
  from the VIC-II/CIA 1 are active hit these cases; VICE testprogs `interrupts/` covers them.

### §3.5 Latency and jitter

*Inference* from §2/§3: IRQ response latency is 7 cycles of sequence plus the remainder of the
current instruction (0-7 cycles; 0-8 with undocumented RMW), which produces the familiar 1-7
cycle jitter that "stable raster" techniques remove. An emulator that services interrupts only at
instruction boundaries without the second-to-last-cycle rule is off by one in a known fraction of
cases; the Lorenz suite's `irq`/`nmi` tests and VICE testprogs check this.

---

## §4 RDY, AEC, SO

### §4.1 RDY on the NMOS 6502

- RDY low stops the CPU **only on a read cycle**: the current read is repeated (the address stays
  on the bus) until RDY goes high. Write cycles proceed regardless. (Schepers 6510 page: "the CPU
  waits after the next read cycle"; floooh `m6502_tick`: "RDY pin is only checked during read
  cycles"; Clock Signal `6502Implementation.hpp` checks `is_read(next_bus_operation_)` unless the
  personality is a 65C02.) The 65C02 halts on writes too.
- Interrupt detection continues while halted (floooh: "interrupt detection also works in RDY
  phases"; it shifts the IRQ pipeline during a halt).
- *Inference*: because the halted read is repeated, a halted read of an I/O register with read side
  effects can trigger them more than once on real hardware (e.g. a CIA ICR read during a VIC-II
  steal). Whether the CIA sees every repeated cycle as a read depends on the CIA's own φ2 decode.
  See OQ5.

### §4.2 The 3-cycle write window and VIC-II/TED stealing

The 6510's RDY is driven by the VIC-II's BA, its AEC by the VIC-II's AEC. Christian Bauer's VIC
article (<https://www.cebix.net/VIC-Article.txt>, §3.6 and the timing diagrams) describes it:

- The VIC-II pulls **BA low three cycles before** it needs the bus in φ2 (character pointers on a
  bad line, sprite data). During those three cycles AEC stays high, so the CPU may continue, but
  only with writes.
- After three cycles AEC goes low, the CPU's bus drivers are tri-stated, and the VIC-II uses φ2 as
  well as φ1.
- Three cycles because the 6502 never does more than **three consecutive writes** (the interrupt
  and BRK pushes of PCH, PCL, P; JSR does two; RMW does two). So by the time AEC drops, the CPU
  is guaranteed to be stopped at a read.
- Hence a bad line steals 40 cycles plus 0-3 more depending on what the CPU was doing (writes
  continue into the window). Sprite fetches steal 2 cycles per sprite plus the same window.

The 7501/8501 has RDY and AEC; the TED uses them for its bad-line fetches (TED file). The 8502
has them too; the VIC-IIe drives them as on the C64.

Emulator design consequence (*inference*): the core must expose whether the *next* cycle is a
read or a write before it is executed, so the machine can stop it on the first read after BA
falls. floooh's pin-mask design gives this naturally (§8.2): the tick returns the next cycle's
R/W pin and address, and the system sets RDY before the next tick.

### §4.3 AEC

AEC low tri-states address, data and R/W; the CPU does not see it as a halt. In emulation AEC is
normally folded into RDY handling plus "VIC owns the bus this cycle" in the memory system; floooh
defines `M6510_AEC` but marks it "not implemented".

### §4.4 SO (1541)

- SO is an input on the 6502 (not the 6510/8502/7501). A falling edge sets the V flag; releasing
  it does not clear V (Wikipedia, 6502 pin list; MAME `m6502.cpp`, `execute_set_input`, sets
  `F_V` on an assert edge, ignoring an edge in the same cycle as reset release).
- The 1541 connects the gate array's BYTE READY to SO, enabled by VIA2 CA2 (SOE). The DOS read/write
  loops are `BVC *` followed by `CLV`. A Rockwell note quoted in search results says the CPU
  "responds to an I/O activity in equal or less than three clock cycles" with a `BVC` to itself.
- *Inference*: the exact cycle on which the edge becomes visible to a `BVC` (same cycle as the
  branch's operand fetch, or the next) decides whether disk-speed-sensitive fast loaders work.
  VICE's drive code models it; check it for facts. See OQ1.

---

## §5 Decimal mode on NMOS

Source: Bruce Clark, "Decimal Mode", <http://www.6502.org/tutorials/decimal_mode.html>
(algorithms in its Appendix A); VICE testprogs `CPU/decimalmode`, `CPU/bclark`.

- **ADC (D=1)**: the accumulator and carry come from a two-stage BCD adjust (low nibble, then high
  nibble). **Z comes from the binary sum** (the result computed as if D=0). **N and V come from
  an intermediate value**: after the low-nibble adjust but before the high-nibble adjust. So N and Z
  frequently disagree with the BCD accumulator.
- **SBC (D=1)**: the accumulator gets low/high nibble borrow corrections; **all flags (N, V, Z, C)
  are the binary result's**.
- Only C is meaningful in decimal mode on NMOS. Invalid BCD operands ($xA-$xF nibbles) give
  results that follow the same algorithms; the algorithms in Appendix A reproduce real NMOS chips
  for all 256×256×2 inputs.
- No extra cycle on NMOS (the 65C02 takes one more and fixes N/Z).
- Undocumented opcodes with decimal behaviour: **ARR, RRA, ISC (ISB), SBC $EB** (VICE testprogs
  `CPU/decimalmode` tests exactly these plus ADC/SBC). ARR in decimal mode has its own odd flag and
  fix-up rules; No More Secrets (§10) describes them.
- The 2A03 (NES) has decimal mode disabled; floooh's `bcd_disabled` exists for that. Commodore
  chips all have it enabled.
- Bruce Clark's test program is in the public domain: its header says so (per the tutorial page).

---

## §6 Undocumented opcodes

### §6.1 The full table (NMOS 6502/6510/8500/8502/7501)

Sources: masswerk 6502 instruction set (<https://www.masswerk.at/6502/6502_instruction_set.html>),
"6502 'Illegal' Opcodes Demystified" (<https://masswerk.at/nowgobang/2021/6502-illegal-opcodes>),
No More Secrets (groepaz, §10). Names vary; first name is the one used in No More Secrets / VICE.

| Name (aliases) | Opcodes | Effect | Stability |
|---|---|---|---|
| SLO (ASO) | 07 17 0F 1F 1B 03 13 | ASL mem, then ORA | stable |
| RLA | 27 37 2F 3F 3B 23 33 | ROL mem, then AND | stable |
| SRE (LSE) | 47 57 4F 5F 5B 43 53 | LSR mem, then EOR | stable |
| RRA | 67 77 6F 7F 7B 63 73 | ROR mem, then ADC (decimal aware) | stable |
| SAX (AXS, AAX) | 87 97(zp,Y) 8F 83 | store A&X | stable |
| LAX | A7 B7(zp,Y) AF BF(abs,Y) A3 B3 | load A and X | stable |
| DCP (DCM) | C7 D7 CF DF DB C3 D3 | DEC mem, then CMP | stable |
| ISC (ISB, INS) | E7 F7 EF FF FB E3 F3 | INC mem, then SBC (decimal aware) | stable |
| ANC | 0B, 2B | AND #; C = bit 7 of result | stable |
| ALR (ASR) | 4B | AND #, then LSR A | stable |
| ARR | 6B | AND #, then ROR A; C and V from bits 6/5 of result; decimal mode differs | stable |
| SBX (AXS) | CB | X = (A&X) − #, flags like CMP (no borrow in) | stable |
| USBC | EB | same as SBC # | stable |
| LAS (LAR) | BB abs,Y | A = X = S = mem & S | stable |
| NOP (various) | 1A 3A 5A 7A DA FA (impl, 2); 80 82 89 C2 E2 (imm, 2); 04 44 64 (zp, 3); 14 34 54 74 D4 F4 (zp,X, 4); 0C (abs, 4); 1C 3C 5C 7C DC FC (abs,X, 4+1) | no effect; **they still perform their reads**, including dummy and page-cross reads | stable |
| SHA (AHX, AXA) | 9F abs,Y; 93 (zp),Y | store A & X & (H+1) | "unstable" (§6.4) |
| SHX (SXA, XAS) | 9E abs,Y | store X & (H+1) | §6.4 |
| SHY (SYA, SAY) | 9C abs,X | store Y & (H+1) | §6.4 |
| TAS (SHS, XAS) | 9B abs,Y | S = A & X; store S & (H+1) | §6.4 |
| ANE (XAA) | 8B | A = (A \| CONST) & X & # | highly unstable (§6.3) |
| LXA (LAX #, OAL) | AB | A = X = (A \| CONST) & # | highly unstable (§6.3) |
| JAM (KIL, HLT) | 02 12 22 32 42 52 62 72 92 B2 D2 F2 | lock up | §6.5 |

That is 105 undocumented opcodes plus 151 documented ones (C64-wiki
<https://www.c64-wiki.com/wiki/Undocumented_opcode>). Bus behaviour of the undocumented RMW
forms follows §2.1's RMW rows, including the double write; this is why `DCP $D019`/`ISC` acks work.

### §6.2 C64 software that depends on undocumented opcodes

Widely used: LAX, SAX, DCP, ISC, SLO, RLA, SRE, RRA, ANC, ALR, ARR, SBX, LAS, NOPs (copy
protections, packers/crunchers, demos, the Ocean/Imagine tape loader). Specific cases recorded in
VICE `6510core.c` comments (GPL, facts): *Spectipede* (original tape) and *Turrican 3* use ANE
in its unstable form; the Ocean/Imagine loader (*Yie Ar Kung Fu*, *Rambo*, *Comic Bakery*) uses ANE
in a stable way; *Wizball* needs LXA's constant to be $EE. Lorenz's suite tests every stable
undocumented opcode.

### §6.3 The magic constant (ANE $8B, LXA $AB)

- Formula: ANE: A = (A | C) & X & imm; LXA: A = X = (A | C) & imm. C depends on chip, date code,
  temperature, and on RDY: VICE testprogs `CPU/ane` and `CPU/lax` readmes say bits 0 and/or 4
  "drop off" when RDY changes state at the beginning of bad-line DMA. Only bits where A has 0 and
  the mask has 1 are affected, so `ANE #0` or `A = $FF` beforehand gives a stable result.
- Values used:

| Implementation | ANE C | LXA C | Notes |
|---|---|---|---|
| VICE `6510core.c` | **$EF** ($EE in a RDY cycle) | $EE ($EE in RDY cycle) | $EF chosen so *Spectipede* and *Turrican 3* work |
| Tom Harte SingleStepTests 6502 v1 | $EE | $EE | *verified* 2026-11-23 by fitting all 256 constants to the first 3,000 cases of `8b.json` / `ab.json`; only $EE fits |
| floooh `m6502.h` | $EE | $EE | |
| Clock Signal `6502Implementation.hpp` | $EE | $EE | |
| MAME `om6502.lst` (`ane_imm`, `lxa_imm`) | $00 (A &= imm & X) | $FF (A = X = imm) | effectively different constants |
| masswerk | "typically $00, $FF or $EE" | (same kind) | |

Consequence: passing Harte's tests and running *Spectipede*/*Turrican 3* as VICE does are in
direct conflict for ANE (D1). A configurable constant, or a "test mode" vs "machine mode", is the
only way to have both (*inference*).

### §6.4 SHA / SHX / SHY / TAS

From VICE testprogs `CPU/sha`, `CPU/shxy`, `CPU/shs` readmes (their author says these are
"fully predictable, just more complex than thought"):

- **Stable case** (no page crossing, no DMA): value = V & (H+1), where V is the stored register
  combination (A&X, X, Y, or S=A&X for TAS) and H is the high byte of the *base* address operand
  (so H+1 is the high byte of the address "plus one"). TAS also sets S = A & X.
- **Page crossing** (L + index > $FF): the high byte of the target address becomes
  (H+1) & V — i.e. equal to the value being stored; the low byte is the normal (L+index)&$FF.
  *Verified* against Harte `9e.json` (2026-11-23): all 4,977 page-crossing SHX cases write
  value = X & (H+1) to address (value << 8) | low. VICE's `SHA_IND_Y` and MAME's `sha_aby` do the
  same.
- **DMA / RDY case**: if the VIC-II halts the CPU so that the write is delayed (per `shxy`:
  "DMA begins between the third and fourth cycle"), the "& (H+1)" drops off: the value stored is
  V alone. The address calculation is *not* affected: on a page cross the high byte is still
  (H+1) & V. *Inference*: the H+1 term comes from the address-high latch at the time of the
  write; a stalled cycle replaces it. The core must therefore know whether RDY held it in the
  cycle before the write.
- Cycle counts: abs,X/abs,Y forms 5 cycles (always with the dummy read at the unfixed address),
  (zp),Y form 6 cycles.
- floooh's `m6502.h` stores V & ((effective high) + 1) at the correctly carried address (no
  address corruption, no RDY effect); *inference* from reading its decoder for $93/$9B/$9C/$9E/$9F:
  it would fail Harte's page-crossing cases. See D3.

### §6.5 JAM

Opcodes 02, 12, 22, 32, 42, 52, 62, 72, 92, B2, D2, F2. The CPU stops in an internal state with
$FF on the data bus and the address bus showing $FFFF repeatedly (masswerk; floooh's decoder puts
$FFFF/$FF on the pins and loops). IRQ and NMI do not release it; only RESET does (VICE testprogs
`CPU/cpujam`: `jamirq`, `jamnmi`, and `unjam`, which shows a JAM fetched from a CIA timer stays
jammed when the timer register changes). *Inference*: the bus keeps cycling, so a jammed C64's
VIC/CIA keep running; a debugger should report "CPU jammed at PC" and allow reset.

---

## §7 Test suites and their licences (checked 2026-11-23)

| Suite | What it tests | Licence (how checked) | Commit or fetch |
|---|---|---|---|
| Tom Harte **SingleStepTests/65x02**, `6502/v1` (<https://github.com/SingleStepTests/65x02>) | 256 opcode files × 10,000 random single-instruction cases, initial/final registers and RAM, **per-cycle bus list** `[address, value, "read"\|"write"]`; 64 KiB flat RAM; includes undocumented and JAM opcodes | **MIT** (`gh api repos/SingleStepTests/65x02/license`; "Copyright (c) 2024 Thomas Harte et al") | Licence allows committing, but each file is 3-4.5 MB (~1 GB total); fetch into `.local/` and cache, commit a small sample if wanted |
| Older home **SingleStepTests/ProcessorTests** `6502/v1` | earlier copy of the same format | no licence file reported by the API (404) | use 65x02 instead |
| **Klaus Dormann** 6502_65C02_functional_tests (<https://github.com/Klaus2m5/6502_65C02_functional_tests>) | all documented opcodes/modes, flags, decimal (optional), interrupts (needs a feedback register) | **GPL-3.0** (API + file header "Copyright (C) 2012-2020 Klaus Dormann", GPLv3 or later) | Do not commit; fetch. Running a GPL test binary as test input does not make Klive GPL, but committing the source/binary into an MIT repo needs care (*inference*); fetching avoids the question |
| **Wolfgang Lorenz C64 Emulator Test Suite 2.15** (in VICE testprogs `general/Lorenz-2.15`) | every opcode incl. undocumented ones, flags, cycle counts, CIA, interrupts, CPU port | **"Public Domain, no Copyright"** (its readme.txt) | Could be committed; it is a C64 disk image set, so it also needs the C64 machine |
| **Bruce Clark decimal test** (6502.org tutorial Appendix B) | ADC/SBC all inputs in decimal mode | **public domain** (code header, per the tutorial) | Can be written/committed |
| **VICE testprogs** (SVN; GitHub mirror <https://github.com/libsidplayfp/VICE-testprogs>) | CPU (`64doc`, `ane`, `ane-lax`, `asap`, `bclark`, `cpujam`, `cpuport`, `cputest`, `decimalmode`, `hmc6502`, `jsrselfmod`, `kdormann`, `lax`, `sha`, `shs`, `shxy`, `Acid800`), `interrupts/`, `c1541/`, `Plus4/`, `TED/`, `VIC20/`, `c128/` ... | **No repository licence** (mirror API: none). Mixed authorship; individual readmes rarely state terms; `kdormann/` carries Dormann's GPL `license.txt` | Fetch, never commit; check each program's terms before relying on it |
| **visual6502** JSSim (<https://github.com/trebonian/visual6502>) | transistor-level 6502 rev D | Code files MIT ("Copyright (c) 2010 Brian Silverman, Barry Silverman, Ed Spittles"); README says "note the various licenses ... associated with each file" | The **netlist data** is the issue, see next row |
| **perfect6502** (<https://github.com/mist64/perfect6502>) | C transistor-level 6502 simulation, usable as an oracle | Repository **MIT**; but `netlist_6502.h` is **CC BY-NC-SA 3.0** (header: Greg James, Brian Silverman, Barry Silverman) | Do not commit the netlist (non-commercial + share-alike is incompatible with Klive's MIT). Fetch and run locally as an oracle only |

Klive's own licence is MIT (`/LICENSE`).

### §7.1 What Harte's tests do and do not cover

- Covered: every opcode, registers/flags, decimal mode, undocumented stable and unstable ones (with
  constant $EE), JAM, every bus cycle's address/value/direction, SHx page-crossing corruption.
- Not covered: interrupts, RDY, SO, the 6510 port, anything time-dependent across instructions.
  These need Lorenz, VICE testprogs and the machine-level harness.

---

## §8 Permissively licensed implementations

Licences checked with `gh api repos/OWNER/REPO/license` or file headers on 2026-11-23.

| Project | Licence | Style | Notes |
|---|---|---|---|
| floooh **chips** `chips/m6502.h` (<https://github.com/floooh/chips>) | **zlib** | cycle-stepped, 64-bit pin mask, C single header | 6502 + 6510 port; RDY; SYNC; IRQ/NMI pipelines with hijacking; BCD switch; ANE/LXA $EE; no SO input; no port fade; SHx without page-cross corruption; code-generated from `codegen/m6502_gen.py`. Same repo has m6522 (VIA), m6526 (CIA), m6569 (VIC-II), m6561 (VIC-I), m6581 (SID), all zlib |
| **Clock Signal** (CLK) `Processors/6502/` (<https://github.com/TomHarte/CLK>) | **MIT** (repo LICENCE; individual headers say "Copyright ... All rights reserved", superseded by the repo licence — *inference*) | C++ template, micro-op scheduled, run-for-cycles with bus handler callback per cycle | Ready line on reads only (NMOS); ANE/LXA $EE; author also generated the Harte tests with it |
| **MAME** `src/devices/cpu/m6502/` (<https://github.com/mamedev/mame>) | **BSD-3-Clause** per file header (Olivier Galibert); the MAME repo as a whole reports "NOASSERTION" (mixed) | C++, generated from `.lst` descriptions (`m6502make.py`), sub-instruction resumable | Has m6502, m6504, m6507, m6509, m6510, m6510t, m7501, m8502; generic port with pull-ups, floating bits and fall-off (`set_pulls`, `set_floating_falloff`); SO edge; ANE/LXA effectively $00/$FF |
| **fake6502** (Mike Chambers, original) | **public domain** ("released into the public domain, but if you use it please do give credit", per the v1.1 header in mirrors) | instruction-stepped | Not cycle-exact; no bus sequences. The fork omarandlorraine/fake6502 is **GPL-2.0**; ivop/fake6502 is BSD-2 for its new code |
| gianlucag **mos6502** | MIT | instruction-stepped C++ | not cycle-exact |
| mnaberez **py65** | BSD-3 | Python, instruction level | reference only |
| redcode **6502** | LGPL-3.0 | | not permissive for static linking into an MIT core (*inference*) |
| **perfect6502** | MIT code + CC BY-NC-SA netlist | transistor level | oracle only (§7) |
| VICE `src/6510core.c`, `src/6510dtvcore.c`, drive cores | **GPL-2** | macro-generated, cycle accurate with "alarm" scheduling | facts only |

### §8.1 Facts worth carrying from VICE (GPL, facts only)

ANE/LXA constants and the RDY variants (§6.3); SHx address/value rules (§6.4); port fade
constants and the RAM-under-$00/$01 write (§1.3, §1.4); Plus/4 port bit mapping (§1.7); C128 bit 6
CAPS sense and bit 7 fade (§1.6).

### §8.2 floooh's cycle-stepped pin-mask design (candidate model)

Described in "A new cycle-stepped 6502 CPU emulator", <https://floooh.github.io/2019/12/13/cycle-stepped-6502.html>,
and the `m6502.h` header comment. In architecture terms:

1. **The CPU is a pure function of (state, pins) → pins, one clock per call.**
   `uint64_t m6502_tick(m6502_t*, uint64_t pins)`. The 64-bit mask carries A0-A15 (bits 0-15),
   D0-D7 (16-23), control pins (RW, SYNC, IRQ, NMI, RDY, RES, AEC) and the 6510 port pins P0-P5
   (32-37).
2. **The CPU never touches memory.** Each tick leaves an address and RW on the pins; the system
   loop performs the read (puts the byte on D0-D7) or the write (takes D0-D7) before the next tick.
   The 6510 port is the system's job too: `M6510_CHECK_IO(pins)` detects $0000/$0001 and
   `m6510_iorq()` services it.
3. **Decoder = one switch on `(opcode << 3) | cycle`.** Each instruction has up to 8 cases; each
   case does that cycle's ALU work for the *previous* bus result and sets up the *next* bus cycle.
   The last case of every instruction calls "fetch" (address = PC, SYNC on). The table is generated
   by a Python script from a compact description, so all 256 opcodes, including undocumented ones,
   are explicit.
4. **SYNC** marks the opcode-fetch cycle. On the tick that sees SYNC, the CPU latches the opcode,
   checks the interrupt pipelines and RESET, and if one is pending replaces the opcode with BRK ($00)
   and suppresses the PC increment and (for reset) the writes, via `brk_flags`.
5. **Interrupt timing** is modelled with shift registers (`irq_pip`, `nmi_pip`) that move one bit
   per tick, so "active during the second-to-last cycle" becomes a bit test at SYNC; the branch
   quirk and hijacking are a few explicit lines (§3).
6. **RDY**: if RDY is set and the current cycle is a read, the tick returns without advancing the
   state (the read repeats). Writes ignore RDY.
7. **Systems are built by chaining chips** through the same pin-mask convention (m6526, m6569, ...),
   one tick per system clock, which suits machines whose chips interleave on φ1/φ2.

Performance: a switch dispatch per cycle; floooh's C64 runs in the browser via WASM in real time
(*inference* from the existence of his tiny8bit web emulators; no measured number collected here).
Klive's Z80 cores are instruction-stepped with hooks (`src/emu/z80/wasm/README.md`); a cycle-stepped
6502 is a different model and the debugger loop would need to stop at SYNC rather than after an
instruction function returns (*inference*).

What a Klive core would add to that design (from §1-§6): SO input with edge detect (1541); port
fade timers and per-model pull-up/floating masks; port width per model (6/7/7-with-gap); RDY-aware
SHx; configurable ANE/LXA constants; the "RAM under $00/$01 gets the VIC φ1 byte" hook; the 8502
2 MHz mode; the JAM state as an explicit flag.

---

## §9 Debugger interaction

- **Instruction boundaries.** The 6502 has a SYNC pin, high during each opcode fetch (also the
  fetch cycle whose opcode is replaced by BRK for an interrupt). The 6510/8502/7501 do not bring
  SYNC out (§1.1) but have it internally; an emulator exposes it as state. A cycle-stepped core
  stops "at an instruction" on the SYNC cycle, *before* the opcode read has side effects
  (*inference*: important if PC is in I/O space).
- An interrupt can be taken at any boundary; a debugger stepping "one instruction" may land at the
  start of the handler. Many debuggers offer "step over interrupts" (*inference*).
- **Call stack.** JSR pushes (return address − 1): PCH then PCL of the address of the JSR's last
  byte. RTS pulls and adds 1. Interrupts push PC (exact address of the next instruction, or BRK's
  address + 2) and P; RTI pulls P then PC with no adjust. So frames are 2 bytes (JSR) or 3 bytes
  (IRQ/NMI/BRK). Stack page $0100-$01FF, S wraps; deep recursion or `TXS` resets break a
  shadow-stack approach. *Inference*: a call stack is best kept as a shadow stack updated on JSR/
  BRK/IRQ/NMI entry and RTS/RTI exit, with re-sync when S is changed by `TXS` or moves above a
  frame (like the Z80 step-out stack in `src/emu/z80/wasm/z80-cpu-exports.c`).
- **Step over** a JSR: run until PC = JSR address + 3 with S back at its pre-JSR value. **Step
  out**: run until an RTS/RTI pops the current frame (S rises above it). Software that manipulates
  the stack (PLA/PLA to drop a return; pushing an address then RTS as a jump table — common in the
  KERNAL/BASIC) defeats pure JSR/RTS pairing; S-based conditions are more robust (*inference*).
- **BRK as software breakpoint.** BRK is a 2-byte instruction (padding byte); on the C64 it goes
  through $FFFE → KERNAL → the $0316 vector, which monitors hook. An emulator debugger should not
  insert BRK into memory (it changes bus behaviour and RAM contents); it should compare PC at SYNC
  (*inference*). BRK in RAM is legitimate program behaviour (monitors, crash handling).
- **JAM** stops forward progress; the debugger should report it (§6.5).
- **Memory watchpoints** must decide whether dummy reads/writes count. VICE distinguishes
  "watchpoints trigger on dummy accesses" as an option (`plus4mem.c` comment on
  `watchpoints_active` bit 1).
- **Cycle-exact stepping.** With a cycle-stepped core, "step one cycle" is natural and useful for
  VIC-II timing work (*inference*).

---

## §10 Disagreements

- **D1 — ANE ($8B) constant.** VICE $EF (and $EE during a RDY cycle); Harte tests, floooh, Clock
  Signal $EE; MAME behaves as $00; masswerk lists $00/$FF/$EE. VICE's choice is driven by real
  games; Harte's by the generating emulator.
- **D2 — LXA ($AB) constant.** VICE, Harte, floooh, Clock Signal $EE; MAME behaves as $FF
  (A = X = imm).
- **D3 — SHx page crossing.** VICE, MAME, Harte (verified): target high byte becomes the stored
  value. floooh: normal carried address (*inference* from code). masswerk: "page-crossing may not
  work".
- **D4 — SHx under DMA.** VICE `sha` readme: "& H+1 drops off" if DMA is going on during the
  instruction; `shxy` readme narrows it to DMA beginning between cycles 3 and 4; both say the
  address is unaffected. Only VICE models it.
- **D5 — Port fade time.** cpuport readme text says "some hundred microseconds", but its own
  measurement is ~200,000 µs on a new (8500) C64; VICE uses ~350 ms for the 6510 and ~1.5 s for
  the 8500 (and says the 6510 fades faster); Lorenz's test needs ≥ 5,984 cycles. floooh: never
  fades.
- **D6 — 7501 NMI.** Schepers' pinout: no NMI pin. Plus/4 World forum: the 7501 "accepts NMI" but
  it is unwired. Both agree there is no NMI source in the machines.
- **D7 — 7501 pins 38/39.** The Schepers 7501 page's table and diagram disagree on which of pins
  38/39 is R/W versus φ2/D0. Irrelevant to emulation.
- **D8 — Port bit counts.** Some sources call the 6510 port 8-bit (all latch bits exist), others
  6-bit (pins). Both are true: 8 latch/DDR bits, 6 pins (cpuport readme).
- **D9 — SO latency.** MAME sets V on the same call as the edge; the Rockwell note gives "≤ 3
  cycles" response for `BVC *`; exact silicon timing not found (OQ1).

---

## §11 Open questions

- **OQ1** — SO timing: on which cycle relative to the falling edge does V become visible to an
  executing `BVC`, and does an edge during the branch's own cycles count? Needed for 1541 fast
  loaders. Candidate sources: visual6502 node-level simulation (perfect6502 as a local oracle),
  VICE drive core facts.
- **OQ2** — Which ANE/LXA constant to ship per model (6510, 8500, 8502, 7501, 6502 in the drive),
  and whether to expose it as a setting. VICE testprogs `CPU/ane-lax/dumps` holds real-chip dumps
  to analyse.
- **OQ3** — 8502 2 MHz mode: exact clocking, what the VIC-IIe does in φ1, how I/O accesses
  (CIA/SID/VIC registers) behave at 2 MHz, and whether RDY/BA still stops the CPU. For the C128
  file.
- **OQ4** — 7501 clocking under the TED: the single/double clock switching points, how the switch
  aligns to CPU cycles, and how TED's RDY/AEC stealing interacts with the 3-write window. For the
  TED file.
- **OQ5** — Repeated reads during RDY halts: does a CIA/VIA register with read side effects see
  each halted cycle as a separate read? (Affects `LDA $DC0D` during a bad line.)
- **OQ6** — The φ1 data-bus value written to RAM on $00/$01 writes on the C64: exact source
  (last VIC fetch in that half-cycle) for the C128 in C64 mode and C128 mode.
- **OQ7** — Port fade timing model: fixed constant, per-model constant plus randomness (VICE), or a
  setting; and whether bit 7 on the 8502 and bits 6/7 on the 7501-family (bit 5 has no pin there)
  fade too.
- **OQ8** — Whether the drive 6502 in the 1541 and the VIC-20's 6502 need RDY at all (*inference*:
  no stealing in either machine), so a single core with RDY support is still the simplest route.
- **OQ9** — Reset state the machines rely on: S=$FD, I=1, D undefined (choose 0?), A/X/Y = 0?
  Harte tests do not cover reset; Lorenz does not test it.

---

## §12 Reference documents worth fetching later (into `.local/`, not committed)

1. Tom Harte, SingleStepTests 65x02, `6502/v1/*.json` — MIT. <https://github.com/SingleStepTests/65x02>
2. Wolfgang Lorenz C64 Emulator Test Suite 2.15 — public domain; in VICE testprogs
   `general/Lorenz-2.15/`.
3. VICE testprogs — `CPU/`, `interrupts/`, `c1541/`, `Plus4/`, `TED/`, `VIC20/`, `c128/`; mirror
   <https://github.com/libsidplayfp/VICE-testprogs>, original on SourceForge (vice-emu SVN).
4. Klaus Dormann, 6502 functional test — GPL-3. <https://github.com/Klaus2m5/6502_65C02_functional_tests>
5. Bruce Clark, "Decimal Mode" tutorial and test — public domain code.
   <http://www.6502.org/tutorials/decimal_mode.html>
6. groepaz, "No More Secrets — NMOS 6510 Unintended Opcodes" (PDF, CSDb releases; a copy on
   cpcwiki.eu refused automated fetch, the oric.org copy is gone) — the most complete undocumented
   opcode reference for the C64; licence not checked (OQ for the plan: read for facts).
7. "64doc" (John West, Marko Mäkelä) — cycle-by-cycle bus sequences; VICE testprogs `CPU/64doc`,
   <https://archive.nesdev.org/6502_cpu.txt>.
8. nesdev wiki: CPU interrupts, CPU pinout, Status flags (<https://www.nesdev.org/wiki/CPU_interrupts>).
9. Christian Bauer, "The MOS 6567/6569 video controller (VIC-II) and its application in the
   Commodore 64" — BA/AEC/RDY timing. <https://www.cebix.net/VIC-Article.txt>
10. MOS MCS6500 hardware and programming manuals (1976) — archive.org.
11. floooh's "A new cycle-stepped 6502 CPU emulator" (2019) blog post and `chips/m6502.h` (zlib).
12. perfect6502 (MIT code, CC BY-NC-SA netlist) as a local oracle for OQ1/OQ5.
13. masswerk 6502 instruction set and "6502 'Illegal' Opcodes Demystified".
14. Schepers/Baltissen chip pages (6510, 7501, 6502) — pinouts; marked unverified by their author.
15. Already in the repository: `dev/research/6502_undocumented_opcodes.txt` (Freddy Offenga,
    "6502 Undocumented Opcodes", v3.0 1997, Atari-based) — an older list; prefer No More Secrets
    and the VICE testprogs readmes where they differ.

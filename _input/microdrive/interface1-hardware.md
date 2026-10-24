# ZX Interface 1: hardware reference (for emulation)

Research notes for a future Klive plan. Everything here is written in our own words. Source tags
like **[SW]** point to the bibliography in `sources.md`. Where a statement is inferred from what
the ROM does, rather than read in a hardware document, it is marked **(inferred)**.

Source key: [SW] Sinclair Wiki "ZX Interface 1" · [SM] Thorn-EMI/Sinclair Service Manual, Oct 1985 ·
[IO] "if1 i/o addresses.txt" (k1.spdns.de) · [NC] no$zx specs (Martin Korth) · [GC] Gianluca Carri,
*Spectrum Shadow ROM Disassembly* (ROM v1) · [V1]/[V2] commented v1/v2 ROM disassemblies
(Hutcheson/Wearmouth) · [UM] *ZX Interface 1 and Microdrive* user manual · [MAME] MAME `intf1.cpp`
and `microdrv.cpp` (BSD-3, read for behaviour only) · [OQ] OqtaDrive technical notes ·
[WOS] WoS "Hardware Ports" FAQ · [MDFS] mdfs.net SpecIO · [SCF] Spectrum Computing forum thread
"ZX Microdrive internal format" · [WIKI] Wikipedia "ZX Microdrive" · [WOSF] WoS hardware feature
article · [FUSE] Fuse man page.

---

## 1. What is inside

- Four ICs: IC1 is a custom gate array ("ULA") that handles the microdrives, RS232 and the
  network; IC2 is the 8 KB ROM; IC3 is the address decoder used for ROM paging; IC4 is the
  oscillator buffer [SM §1].
- The gate array has its own **8.0 MHz** crystal clock, separate from the Spectrum's
  3.5 MHz [SM §1.4.2, test table §3.3].
- All the gate array's peripherals are serial. The gate array turns CPU bytes into serial
  streams and back [SM §1.4.4].
- The IF1 has a pass-through expansion connector at the back. A device there, such as
  Interface 2, can pull **ROMCS2**, which disables both the IF1 ROM and the Spectrum ROM through
  isolating diodes [SM §1.3.1].

## 2. I/O ports

### 2.1 Address decoding

| Port (usual) | Low-byte pattern | Function |
|---|---|---|
| `$E7` (231) | `xxx0 0xxx` (A4=0, A3=0) | Microdrive data, 8-bit, read/write |
| `$EF` (239) | `xxx0 1xxx` (A4=0, A3=1) | Control (write) / status (read) |
| `$F7` (247) | `xxx1 0xxx` (A4=1, A3=0) | RS232 / network data, 1 bit |

- The IF1 is selected by **A3 and A4 only**. The combination A4=A3=1 is "not IF1" [MDFS],
  [WOS], [NC]. MAME also dispatches on `address & 0x18` and nothing else [MAME].
- The high byte is ignored. So is A0 as far as the IF1 is concerned (see §2.6 for the uncertainty).
- Software always uses the fully-qualified addresses `$E7`, `$EF` and `$F7`. All three have
  A0=1, so the ULA, which decodes A0=0, never sees them. They also have A5–A7 set, so a
  Kempston joystick (A5=0, or A7..A5=000) does not respond [WOS], [MDFS].

### 2.2 Conflicts that follow from the partial decoding

- **Any port with A4=A3=0 is the microdrive data port.** That includes port `$00`,
  `$FE`-family ports with A3/A4 clear such as `$E6`, and so on. Reading the data port blocks the
  CPU (see §4). This is the documented **"IN 0 crash"**: a program that reads port 0, for
  example a badly written Kempston read, hangs the machine when an IF1 is attached [IO], [NC].
- The Kempston joystick at `$1F` (`0001 1111`) has A4=A3=1, so it does **not** collide.
- The ULA at `$FE` (`1111 1110`) has A4=A3=1, so it does not collide either. But an even port with
  A3 or A4 clear (for example `$E6`, `$EE`, `$F6`) selects **both** the ULA and the IF1
  **(inferred** from the decoding masks). An emulator should let both see the access.
- **I/O contention side effect.** IF1 transistor Q10 gates IORQ to the Spectrum's ULA so that the
  ULA only sees IORQ when A0 is low. Without it, the ULA may stretch the CPU clock on any I/O
  cycle. The manual says this transistor "is duplicated inside the Spectrum in later issues"
  [SM §1.2.4–1.2.5]. In practice this only matters for very early issue boards. It is worth one line
  in the plan, not emulation work.

### 2.3 Port `$EF` write: control register

| Bit | Name | Meaning (register level) |
|---|---|---|
| 0 | COMMS DATA | Serial drive-select bit shifted into the drive chain. **0 = select** the drive that receives it, 1 = deselect. When no drive is in use it also picks what `$F7` bit 0 drives: **1 = RS232 (RXD)**, **0 = network** [SW], [IO], [NC], ROM usage [V2]. |
| 1 | COMMS CLK | Clock for the drive-select shift register. It idles **high** on the IF1 (the QL idles low) [OQ]. |
| 2 | R/W | **1 = read, 0 = write** [SW], [NC]. |
| 3 | ERASE | **0 = erase head on**, 1 = off (active low) [SW]. |
| 4 | CTS | RS232 "Clear To Send" output (1 = asserted/high). The ROM writes `$FE` while waiting to receive and `$EE`/`$EF` otherwise [SM table], [V2 REC-BYTE/BCHAN-OUT]. |
| 5 | WAIT | Network synchronisation enable. The ROM writes it as **1 almost everywhere** and as **0** only in the network receive loop (`OUT ($EF),$CE` in INPAK), so 0 appears to *enable* the hardware wait used to sync to network bits **(inferred** from [V2] INPAK; [SM] says only that WAIT makes the Spectrum "wait until a looked-for signal arrives on the network"). |
| 6–7 | — | Not used [NC]. The ROM always writes them as 1. |

Values the ROM actually writes, with their meaning decoded from the bits above:

| Value | Binary | Used for |
|---|---|---|
| `$EE` | 1110 1110 | Idle: erase off, read, CLK=1, DATA=0. Written on every ROM entry (START-4) and at the end of every read or write [GC 00BC], [V2 L00BC]. |
| `$EC` | 1110 1100 | Drive select: CLK low with DATA=0 (the "select" bit) [V2 SW-MOTOR]. |
| `$EF` | 1110 1111 | Drive select: CLK high with DATA=1 (a "deselect" bit). Also the RS232 send setup (CTS low, `$F7` bit 0 routed to RS232). |
| `$ED` | 1110 1101 | Drive select: CLK low with DATA=1. |
| `$E6` | 1110 0110 | Erase on, still in read mode. Written about 2.7 ms before a write and right after it [GC 128F/189A], [V2 L15B7]. |
| `$E2` | 1110 0010 | Erase on and write on. Written just before the `OTIR` [GC 1889], [V2 L15BF]. |
| `$FE` | 1111 1110 | RS232 receive: CTS high [V2 L0B95]. |
| `$CE` | 1100 1110 | Network receive: WAIT bit = 0 [V2 L105B]. |

The [SM] port table and the Sinclair Wiki agree on the bit order. [SW] writes the read bits
right-aligned in a flattened table that is easy to misread. The raw wiki source (saved in `docs/`)
puts Write Protect at bit 0, Sync at 1, Gap at 2, DTR at 3 and Busy at 4.

### 2.4 Port `$EF` read: status register

| Bit | Name | Meaning |
|---|---|---|
| 0 | WRITE PROTECT | **1 = writable** (tab present), **0 = protected**. It also reads **0** when no drive is selected or no cartridge is inserted, which stops FORMAT on an absent drive [SM §2.7], [SW]. Every ROM write path does `IN A,($EF) : AND 1 : JR NZ, ok` [GC], [V2]. |
| 1 | SYNC | Goes **0** when the gate array has recognised the sync mark at the end of a block preamble. The ROM polls for `bit1 = 0` and then starts `INIR` [GC 18D2], [V2 L1620]. |
| 2 | GAP | Polarity: see below. |
| 3 | DTR | RS232 input. The ROM waits for bit 3 = 1 ("remote ready") before sending each byte [V2 L0D21], [UM App. 4]. |
| 4 | BUSY | Named in every table, but **never tested by either ROM** (grep of [V1]/[V2]). [NC] writes "Busy (what busy?)". Its meaning is unknown. |
| 5–7 | — | Not used. The value read is undocumented (open question). |

**GAP polarity.** No hardware document states it outright. What the ROM does is unambiguous:

- **Presence test** (SEL-DRIVE): the cartridge counts as present once it sees **6 consecutive
  reads with bit 2 = 0**. If 5000 tries fail, it reports "Microdrive not present"
  [GC 1811–1828], [V2 L154C–L155B].
- **Block search** (GET-M-HD / GET-M-BUF): it first needs **8 consecutive reads with bit 2 = 1**,
  then **6 consecutive reads with bit 2 = 0**, then it waits for SYNC (bit 1) = 0, then it runs
  `INIR` [GC 18B1–18DE], [V2 L15F6–L1633].
- FORMAT starts the motor with SW-MOTOR directly and **skips the presence test**
  [GC 1B74], [V2 L1B5D].

The only reading that fits all three facts, and the manual's statement that an *absent drive, a
missing cartridge and an unformatted cartridge* all give "Microdrive not present" [UM App. 5], is:

> **bit 2 = 1 while the head is over a gap (erased tape, no flux transitions, or no
> drive/cartridge at all); bit 2 = 0 while recorded signal is passing.**

So the block search means "be inside a gap, then see the recording start, then wait for sync".
FORMAT has to skip the presence test because a blank tape is "all gap". MAME's microdrive
device uses the same convention: gap output 1 for erased tape and when no cartridge is
loaded [MAME microdrv.cpp]. **Caveat:** the comments in the v2 disassembly read the bit the other
way round ("six consecutive reads required to register as a gap") [V2 L154C]. Treat the
comments as interpretation. The emulator must reproduce the *register behaviour* above, which is
not in doubt.

### 2.5 Port `$F7`: RS232 / network data

| Direction | Bit | Meaning |
|---|---|---|
| Read | 0 | NET input (the network line level) |
| Read | 7 | RS232 **TXDATA**, the data *received* from the remote end (named from the DCE side) [SW], [SM], [NC] |
| Read | 1–6 | Not used (value undocumented) |
| Write | 0 | Network output, **or** RS232 RXDATA (data *sent*). Which one depends on the last COMMS DATA bit written to `$EF`: **1 → RS232, 0 → network** [SW], [IO], [NC] |
| Write | 1–7 | Not used |

- Polarity conflict: [SM §1.5.1] says the gate array's COMMS OUT pin *high* selects RS232, and
  [SW] says the COMMS DATA line on the drive connector is *inverted* from the register. Taken
  together, register bit 1 would mean "line low" and therefore "network", which contradicts the
  ROM. The ROM sets register bit 0 = 1 (`$EF`) before every RS232 send [V2 L0D07], so **at
  register level, 1 = RS232**. The pin-level polarity does not matter for an emulator.
- The ROM writes `$01` to `$F7` on every entry (START-4) and writes `$F7` = 1/0 while shifting
  drive-select bits (SW-MOTOR). This leaves the network line released (idle 1) while the
  microdrive chain is clocked [GC 00BD], [V2 L1565].

### 2.6 Port open questions

- Whether IC1 also qualifies on A0, A1, A2 or A5–A7: no source gives the gate array's full decode.
  The tables only give A3/A4 [NC], [WOS], [MDFS]. MAME uses A3/A4 only.
- What the unused read bits return (EF 5–7, F7 1–6): undocumented. Returning 1s is a guess.

## 3. Shadow ROM paging

### 3.1 The rule

- **Page in** (IF1 ROM replaces the Spectrum ROM at `$0000–$1FFF`) on an **instruction fetch
  (M1)** from **`$0008`** or **`$1708`** [IO], [NC], [GC p."THE START"], [V2 L0008 comment:
  "An instruction fetch on address $0008 pages in this ROM"].
  - `$0008` is the 48K ROM's ERROR restart (`RST 8`). Errors, hook codes and new commands all
    arrive there. Channel I/O does too, because IF1 channels put `$0008` in their main-ROM
    input/output slots [GC "M channel data"].
  - `$1708` is the middle of the 48K ROM's CLOSE-2 routine. The IF1 takes it over to close its own
    channels and to fix a 48K bug with closing an unopened stream [GC 1708].
- **Page out** on an instruction fetch from **`$0700`**, where the IF1 ROM holds a single `RET`
  (UNPAGE) [IO], [NC], [GC], [V1 L0700], [V2 L0700]. All exits from the shadow ROM go through
  `JP $0700`, or through a stacked `$0700` return address.
- The **8 KB IF1 ROM occupies `$0000–$1FFF`** [GC intro: "kept between 0000H and 1FFFH"].
  *Open question:* what the CPU sees at `$2000–$3FFF` while the shadow ROM is paged. ROMCS
  disables the whole 16 KB Spectrum ROM. MAME mirrors the 8 KB IF1 ROM there
  (`offset & 0x1fff`). Real hardware is unverified. The IF1 ROM never executes or reads there
  while paged: every main-ROM call goes through CALBAS, which unpages first.

### 3.2 Exact timing within the fetch

- **Page-in timing does not matter for correctness**, because both ROMs hold the same instruction
  at both addresses. At `$0008` both have `LD HL,($5C5D)` (`2A 5D 5C`). At `$1708` both have
  `INC HL` (`23`). This was checked against Klive's `sp48.rom` and is stated by [GC] and
  [V2 L0008]. MAME pages in **before** the opcode fetch at `$0008`/`$1708` [MAME
  `pre_opcode_fetch`].
- **Page-out must happen *after* the opcode fetch at `$0700`.** The 48K ROM has `LD (HL),C`
  (`71`) at `$0700`, while the IF1 ROM has `RET` (`C9`). The `RET` must come from the IF1 ROM
  [MAME `post_opcode_fetch`, with the comment that otherwise "the incorrect opcode is fetched for
  0x0700"]. The bytes were checked against Klive's `sp48.rom`.
- Only M1 cycles trigger paging: data reads, and `RST`/`CALL` stack traffic, at those addresses do
  not [IO]/[NC] say "executes"/"opcode fetches". The Service Manual describes IC3 as decoding
  the address lines (all zeros) and setting a latch in IC1 [SM §1.2.2]. It does not mention M1
  explicitly. *Open question:* whether the latch also responds to the second and third bytes of a
  multi-byte instruction. It cannot matter, because only opcodes are ever fetched at those three
  addresses.
- Practical Klive rule: in the CPU's M1 hook, if PC == `$0008` or `$1708`, set `if1Paged = true`
  before reading the opcode. If PC == `$0700` and the IF1 is paged, read the opcode from the IF1
  ROM, then set `if1Paged = false`.

### 3.3 Version differences

- **v1 and v2 use the same three trigger addresses.** Both ROMs have `RET` at `$0700` and the
  fixed-position CLOSE routine at `$1708` [V1 L0700/L1708], [V2 L0700/L1708]. No source reports a
  hardware paging difference between issues.
- Software can tell the editions apart: `CLOSE #0: PRINT PEEK 23729` gives 0 on v1 and 80 on v2,
  because v2 uses the spare 48K system variable bytes `$5CB0/$5CB1` as the RS232 column and line
  width [GC App. 8], [V2 CRT-VARS]. According to [GC], v2 shipped in IF1s with serial numbers
  above 87315.
- There is mention of an unpublished "ROM 3" (Andrew Pennell, *Your Sinclair*), as cited in a
  comment in [V2]. It is not a practical concern.

### 3.4 While the shadow ROM is paged

- `$0038` (IM 1) is `EI : RET` in the IF1 ROM. **The keyboard is not scanned and FRAMES is
  not incremented** while it is paged [GC 0038]. `$0066` (NMI) is `RETN` [GC 0066].
- Microdrive access also runs with interrupts **disabled** (§6).

## 4. WAIT: how the IF1 holds the CPU during data transfer

- **Reading port `$E7` asserts the Z80 /WAIT line until the gate array has assembled the next
  8 bits from the tape** [IO], [NC]. If no drive is running, or no formatted cartridge is
  passing, the read never completes and the machine hangs (the "IN 0 crash") [IO], [NC].
- Writes to `$E7` are paced the same way: the ROM pushes 543 bytes with bare `OTIR` and does not
  poll a status bit, so the hardware must hold /WAIT until the serialiser can take the next byte
  **(inferred** from [GC 1895], [V2 L15D0]; a forum description says flow control "is controlled
  with the CPU WAIT signal" [SCF]).
- When does WAIT release on reads? The gate array searches for the preamble by itself and does not
  hand the preamble bytes to the CPU. After SYNC goes low, the **first byte `IN`/`INIR` gets is
  the byte after the `$FF $FF` mark**: HDFLAG for a header, RECFLG for a record [SCF] (Kiwi,
  citing the Microdrive Book p.39), consistent with the ROM loading directly into HDFLAG/RECFLG
  [GC 12C4, 11A5].
- The ROM's own byte loops are far faster than the tape: v2 READ-BLK runs
  `IN A,(C) : CP E : JR NZ : DJNZ`, 36 T per byte. So the **CPU's pace is set entirely by WAIT**,
  one byte per tape byte time (§7).
- Emulator consequence: the plan needs either (a) a real WAIT model, where the CPU stalls on an
  `$E7` access until the next byte time, or (b) a cheaper model that charges the stall to the
  T-state counter (advance time to the next byte boundary). The ROM only needs bytes at a
  consistent pace. It never measures the byte time. It does measure gaps by poll counting (§7.3).
- What happens if the CPU reads `$E7` during a **write** (R/W = 0), or writes during a read: not
  documented.

## 5. Drive selection (the COMMS daisy chain) and motor control

- Each microdrive contains **one D flip-flop stage of a shift register**. COMMS CLK goes to every
  drive. The IF1's COMMS output feeds drive 1's COMMS IN, and each drive's COMMS OUT feeds the
  next drive's COMMS IN [SM §2.4], [V2 SW-MOTOR comment, citing Ben Cheese's patent]. Drive 1 is
  the one nearest the IF1 [UM ch.2].
- **The flip-flop's output *is* the drive select.** While it is 1, the drive's motor runs, its LED
  is lit and erase current is possible. While it is 0, the motor is off and erase is impossible
  [SM §2.5–2.6]. **Selecting a drive starts its motor**. There is no separate motor control bit
  [SW], [SM].
- The ROM always clocks **8 bits**, drive 8's bit first and drive 1's bit last. The one "select"
  bit (register DATA=0) lands in the target drive and every other drive gets "deselect" [SW],
  [GC 182A], [V2 L1565]. Asking for "drive 0", or an out-of-range number, shifts eight deselect
  bits, which stops all motors [V2 comment].
- Per bit the ROM does: `OUT $EF` with CLK=1 and DATA (=`$EE` select / `$EF` deselect), ~1 ms
  delay, `OUT $EF` with CLK=0 (`$EC`/`$ED`), ~1 ms delay. After the 8th bit: `$EE` (CLK back
  high, DATA=0) [GC], [V2]. Each "1 ms" delay is DELAY-BC with BC=135: 135 × 26 = 3510 T
  ≈ 1.0 ms at 3.5 MHz [GC 1867 says 3553 T]. One full select therefore takes **~16 ms**.
- **Which clock edge shifts?** It is not stated in any hardware doc. MAME's microdrive shifts on the
  **falling** edge of COMMS CLK [MAME `clk_w`]. That fits the ROM, which sets DATA together with
  CLK going high and then drops CLK, so the data is stable on the falling edge. The Service
  Manual's bench test `OUT 239,252: OUT 239,254` (CLK low, DATA 0, then CLK high) also starts
  drive 1 [SM §3.3], whichever edge is used, because the ROM leaves CLK high. **Recommendation:
  shift on the falling edge (1→0).**
- The physical limit of 8 drives is in software only [V2 comment]. If two drives end up selected
  through direct port pokes, the bus conflict can damage real drives [SW]. An emulator can simply
  allow it, or let the lower-numbered drive win.
- OqtaDrive notes (from a hardware drive emulator connected to a real IF1): the IF1 gives **8
  clocks to select and 16 to deselect** (two SW-MOTOR calls in practice), and its "stop time if
  nothing received" is **250 ms** [OQ]. The latter is OqtaDrive's own timeout heuristic, not an
  IF1 behaviour.
- Motor start-up: SEL-DRIVE waits a further `5000 × 26 T` ≈ **37 ms** (Carri: "about 40 ms")
  after selection before it tests for presence [GC 1806]. FORMAT instead waits BC=`$32C8`
  (13 000 × 26 T ≈ **97 ms**) and then checks the write-protect bit [GC 1B77], [V2 L1B5D]. The
  drive itself has an RC soft-start on the motor (C10/R2, and C7 added in later issues) [SM §2.6,
  §4 2.3(a)].
- The write-protect line is only meaningful for the **selected** drive. A drive that is not
  selected, not connected or has no cartridge reads as protected (bit 0 = 0) [SM §2.7], [SW].

## 6. Interrupts and the border during microdrive access

- SEL-DRIVE with a drive number executes `DI` and **returns with interrupts disabled**. SEL-DRIVE
  with 0 (all off) executes `EI` [GC 17F7], [V2 L1532]. All microdrive I/O therefore runs with
  interrupts off, from motor-on to motor-off. FRAMES stops and the keyboard is not scanned.
  BREAK is polled by hand through TEST-BRK (`IN $7FFE`/`$FEFE`, SPACE+CAPS) inside every wait
  loop [GC 18E9], [V2 L163E].
- Before each write (OUT-M-BLK/WR-BLK) the ROM writes **IOBORD** (`$5CC6`, default 0 = black) to
  port `$FE`, and afterwards it restores BORDCR (BORD-REST). So **the border flashes to IOBORD
  while a block is written**. Reads do not change the border [GC 1884/189E], [V2 L15BF/L0D4D].
  RS232 and network transfers also use IOBORD [V2 L0B95, L0D07, GET-PACK]. The `OUT ($FE)`
  also writes bits 3/4 (MIC/EAR) as 0.
- The manual's descriptions ("the border will flash" during SAVE, "border flashing" = write in
  progress) and the service tests ("border remains black during the first part of the format" =
  dead gate-array clock, because the CPU is stuck in a WAIT inside OTIR) both follow from this
  [UM ch.4, App. 2], [SM §3.2(d)].

## 7. Timing: tape, bits, bytes, gaps

### 7.1 Tape and loop

| Quantity | Value | Source |
|---|---|---|
| Tape | endless loop of 1.9–2 mm video tape, about **5 m / 200 in** | [WIKI], [WOSF], [SM §2.2] |
| Speed | about **76 cm/s (30 in/s)** | [WIKI] (an old German note calls this figure "grossly wrong" [k1 info.txt]; treat it as approximate) |
| One revolution | about **7–8 s** (manual: CAT "in about seven seconds") | [WOSF], [WIKI], [UM ch.3], [SW] "8 to 10 seconds" |
| Tracks | 2 tracks, read and written in parallel by a stereo head; bytes alternate between the tracks, and software sees one track | [SM §2.2, §2.9], [SW] |
| Encoding | FM / biphase: a transition at every bit-cell start, plus one mid-cell for a 1 | [SM §2.13], [SW] |
| Bit order | LSB first | [SW] |

### 7.2 Bit and byte rate

- [SW]: about **80 kbit/s per track**, 160 kbit/s combined, "20 KB/s raw".
- [OQ] (measured on real hardware by a drive emulator): IF1 "byte cycle" **12 µs**, versus 10 µs on
  the QL. MAME's QL model uses 100 kbit/s per track = **10 µs per bit** [MAME]. So OqtaDrive's
  "byte cycle" must mean the **bit-cell time per track**. The Spectrum IF1 is therefore ~83.3
  kbit/s per track, which agrees with [SW].
- [WIKI] gives 15 KB/s (120 kbit/s). That is lower, probably an effective rate. **Conflict noted.**
- Derived: one byte per track every 8 × 12 µs = **96 µs**. With two tracks interleaved, the CPU
  gets **one byte every ~48 µs ≈ 168 T at 3.5 MHz** (about 170 T at 3.5469 MHz on a 128K),
  i.e. ~20.8 KB/s. **(Derived; use as the default byte time.)**
- The ROM tolerates speed variation (the drive "can handle media stretching and data rate
  change" [SW]). Only the *relative* lengths of gaps and blocks matter (§7.3).

### 7.3 What the ROM measures (the emulator must satisfy these)

All delays are DELAY-BC: about **26 T per count** (Carri gives BC×26−43 T for the whole call)
[GC 18FA], [V2 L1652]. The table converts at 3.5 MHz.

| Situation | ROM behaviour | Implication |
|---|---|---|
| Presence | up to 5000 attempts, each needing 6 consecutive GAP=0 polls | Any formatted cartridge passes almost at once. An absent or blank one fails after roughly 0.15–0.2 s of polling. |
| Header/record search | ≥ 8 consecutive GAP=1 polls, then ≥ 6 consecutive GAP=0 polls, then SYNC=0 | One gap poll, including the TEST-BRK call, is about 90 T. A gap must therefore last longer than ~8 polls (≈ 0.2 ms), and the recorded signal must be present for ≥ 6 polls (≈ 0.15 ms) before sync. In v2, SYNC must arrive within 60 polls of 38 T each (≈ 0.65 ms) after that, or the search starts again [V2 L1620]. The 12-byte preamble lasts ≈ 0.58 ms at 48 µs/byte, so SYNC has to follow the preamble promptly. |
| v2 timeouts | header search gives up after 65 536 gap-check iterations, record search after 500. On timeout it **increments the first byte of the destination** (HDFLAG/RECFLG) to force a "wrong block" result [V2 L15DE–L15F6] | v1 has no timeout and loops forever, with BREAK the only exit [GC]. |
| Write a record into an existing sector | read the header, `$E6` (erase on), wait BC=`$168` (360 × 26 ≈ 9 360 T ≈ **2.7 ms**), `$E2` + 3 NOPs, OTIR 543 bytes, `$E6`, then `$EE` [GC 128F–129E], [V2 L1362–] | The record block starts ~2.7 ms after the header ends. So the header-to-record gap on tape must be longer than that, or the write would overwrite the header. |
| FORMAT v1 | per sector: header (30 bytes), wait `$1B2` (434 × 26 ≈ 11 300 T ≈ **3.2 ms**), record (543 bytes), wait `$33F` (831 × 26 ≈ 21 600 T ≈ **6.2 ms**), erase held on throughout [GC 1BD6–1C08] | Sets the nominal layout: header → 3.2 ms gap → record → 6.2 ms gap. |
| FORMAT v2 | header (30 bytes), wait 3.2 ms, **long** test record (641 bytes: 27 descriptor bytes + 614 × `$FC`), wait `$100` (≈ 1.9 ms) [V2 L1BAB–L1BDF] | The v2 format writes longer records, then verifies them (§3 of `interface1-rom-behaviour.md`). |

- Derived sector length on tape (v1 FORMAT at 48 µs/byte): 30 × 48 µs (1.4 ms) + 3.2 ms +
  543 × 48 µs (26.1 ms) + 6.2 ms ≈ **37 ms per sector**. A 7–8 s loop then holds roughly
  **190–215 sectors**. That is consistent with ~180 usable sectors after the bad region at the
  splice/overlap (Fuse: "Average real capacity is around 180 blocks (90 Kb)" [FUSE]).
- MAME's *QL* model (not Spectrum) uses 14 byte-pairs header, 35 byte-pairs (2.8 ms) erased gap,
  269 byte-pairs block and 60 byte-pairs (4.8 ms) inter-sector gap [MAME]. It is useful as a
  sanity reference for the shape, but the Spectrum numbers above come from the IF1 ROM.

## 8. The edge connectors

- **Microdrive connector** (16-pin, keyed). Signals: D0 and D1 (one per track, TTL, bidirectional:
  outputs from the drive when reading, inputs when writing), COMMS CLK, COMMS DATA, WR-PROT (low
  = protected), R/W (low = write), ERASE (open collector via 270 Ω), +9 V, GND [SW], [SM §1.7].
  The pin table is in [SW].
- **Spectrum side**: the IF1 sits on the Spectrum's expansion connector, passes the bus through to
  a rear connector (Interface 2, ZX Printer, ...), drives **ROMCS** to disable the Spectrum ROM
  while paged, and honours ROMCS2 from the rear [SM §1.3.1]. It also uses /WAIT (§4) and gates
  IORQ to the ULA (§2.2). The RS232 ±12 V comes from the Spectrum's 12 V line and a charge pump
  [SM §1.5.2].
- Up to 8 microdrives are daisy-chained through the drives' own expansion connectors [UM ch.2],
  [SM §2.1].

## 9. Summary for the plan

1. Ports: decode A4/A3 = 00/01/10. `$E7` data with WAIT, `$EF` control/status, `$F7` 1-bit
   serial/network.
2. Paging: M1 at `$0008`/`$1708` → IF1 ROM in. M1 at `$0700` → IF1 ROM out **after** that fetch.
3. Drive select: an 8-stage shift register clocked by EF bit 1 (shift on 1→0), data = NOT EF bit 0.
   The selected drive's motor runs.
4. Status: bit 0 = writable, bit 1 = 0 at sync, bit 2 = 1 in a gap. Byte time ~48 µs (~168 T).
5. Writes: ERASE (bit 3 = 0) and R/W (bit 2 = 0) frame an OTIR. Bytes go to the tape at the head
   position. Where the tape was erased but not written, it becomes gap.

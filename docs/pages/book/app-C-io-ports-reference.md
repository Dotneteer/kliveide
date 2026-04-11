# Appendix C: I/O Ports Reference

The original 48K Spectrum had exactly one I/O port worth knowing about: `0xFE`. Write to it and your border changed colour and your speaker clicked. Read from it and you found out which keys were pressed. That was more or less the whole story.

The ZX Spectrum Next has somewhere north of fifty distinct port addresses. Not counting the address lines that act as parameters, not counting all the ways the same address maps to different functions, and definitely not counting the legacy peripheral ports that coexist alongside the new hardware. It's a lot.

This reference organizes them by what they *do*, not by address order. The address table at the top of each section tells you what to `IN`/`OUT`, and the explanation tells you why.

## How Z80 I/O Addressing Works

Before diving in, a quick note on how the Z80's I/O instructions work — because it's immediately relevant to how several Next ports decode.

When the Z80 executes `IN A,(n)`, it puts the 16-bit address `(A << 8) | n` on the address bus. When it executes `IN r,(C)`, it puts the full 16-bit contents of `BC` on the address bus. The point: all sixteen address lines are visible during I/O, and the Next hardware checks various combinations of them to decide which port is responding.

Most ports only care about a few bits of the address, which is why the port table in the official documentation uses `X` to mark "don't care" bits:

```
|R|W||AAAA AAAA AAAA AAAA|Port(hex)|Description       |
      A                 A
      1                 0
      5                
|*|*||XXXX XXXX XXXX XXX0| 0xfe    |ULA               |
| |*||0XXX XXXX XXXX XX01| 0x7ffd  |ZX Spectrum 128K  |
```

Port `0xFE` responds whenever address bit 0 is 0, regardless of what the rest of the address lines are doing. Port `0x7FFD` requires specific patterns in both the high and low bytes. This partial decoding is inherited from the original Spectrum hardware and means some ports alias — the same physical port responds at many different addresses.

> **Why partial decoding?** In the original Spectrum, full address decoding would have required more logic chips. By only checking a few bits, Sinclair saved on both chip count and cost. The side effect is that `OUT (0xFE),A` and `OUT (0x7EFE),A` hit the same ULA port. The Next preserves this behaviour for compatibility.

---

## Port Enable/Disable: The Master Switch Panel

Before we get into individual ports, there's a feature worth knowing about upfront: almost every port on the Next can be individually disabled. NextRegs `0x82` through `0x85` form a 28-bit enable register that controls which ports the hardware will respond to.

This matters enormously for compatibility. Some classic Spectrum software accidentally hits ports that the Next has repurposed. Turning off the relevant port silently drops those accesses, restoring original behaviour. Turn everything on and you get the full Next hardware; selectively disable what conflicts with your legacy title and the rest runs properly.

The mapping is:

| Bit | NextReg | Port(s) Controlled |
|-----|---------|-------------------|
| 0 | `0x82`[0] | `0xFF` Timex video / SCLD |
| 1 | `0x82`[1] | `0x7FFD` 128K memory paging |
| 2 | `0x82`[2] | `0xDFFD` Next bank extension |
| 3 | `0x82`[3] | `0x1FFD` +3 memory paging |
| 4 | `0x82`[4] | `0x????` +3 floating bus |
| 5 | `0x82`[5] | `0x6B` ZXN DMA |
| 6 | `0x82`[6] | `0x1F` / `0xDF` Kempston joystick 1 |
| 7 | `0x82`[7] | `0x37` Kempston joystick 2 |
| 8 | `0x83`[0] | `0xE3` DivMMC control |
| 9 | `0x83`[1] | Multiface ports |
| 10 | `0x83`[2] | `0x103B` / `0x113B` I2C |
| 11 | `0x83`[3] | `0xE7` / `0xEB` SPI |
| 12 | `0x83`[4] | `0x133B`–`0x163B` UART |
| 13 | `0x83`[5] | `0xFBDF` / `0xFFDF` / `0xFADF` Kempston mouse |
| 14 | `0x83`[6] | `0x57` / `0x5B` / `0x303B` Sprites |
| 15 | `0x83`[7] | `0x123B` Layer 2 |
| 16 | `0x84`[0] | `0xFFFD` / `0xBFFD` AY |
| 17 | `0x84`[1] | DAC Soundrive mode 1 (`0x1F`, `0x0F`, `0x4F`, `0x5F`) |
| 18 | `0x84`[2] | DAC Soundrive mode 2 (`0xF1`, `0xF3`, `0xF9`, `0xFB`) |
| 19 | `0x84`[3] | DAC Profi Covox (`0x3F`, `0x5F`) |
| 20 | `0x84`[4] | DAC Covox (`0x0F`, `0x4F`) |
| 21 | `0x84`[5] | DAC Pentagon/ATM (`0xFB`, `0xDF`) |
| 22 | `0x84`[6] | DAC GS Covox (`0xB3`) |
| 23 | `0x84`[7] | DAC Specdrum (`0xDF`) |
| 24 | `0x85`[0] | `0xBF3B` / `0xFF3B` ULA+ |
| 25 | `0x85`[1] | `0x0B` Z80 DMA |
| 26 | `0x85`[2] | `0xEFF7` Pentagon 1024K memory |
| 27 | `0x85`[3] | `0x183B`–`0x1F3B` CTC |

All bits default to `1` (enabled). Write `0` to disable the corresponding port group.

---

## ULA and Display Timing (`0xFE`, `0xFF`)

### The ULA Port (`0xFE`)

The original port. Present on every Spectrum ever made. The ULA responds whenever address bit 0 is 0.

**Reading `0xFE`:**

The high 8 address bits act as a row selector for the keyboard matrix. Each bit in `A[15:8]` selects one row when low — multiple rows can be selected simultaneously by clearing multiple bits:

```z80klive
ld a,$fe    ; select all rows
in a,($fe)  ; read all key columns
```

| Bit | Meaning |
|-----|---------|
| 6 | EAR input from the tape jack |
| 4–0 | Key column result (active low — 0 means key pressed) |

> Setting NextReg `0x08` bit 0 enables Issue 2 keyboard emulation, which changes how bit 6 behaves. Issue 2 machines connected EAR and MIC together, so some software relied on the MIC signal appearing on the EAR bit. Enable this if code is checking the EAR bit for tape loading but failing.

**Writing `0xFE`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 4 | EAR out — drives the internal speaker |
| 3 | MIC out — saves to tape via audio jack |
| 2–0 | Border colour (3-bit Spectrum colour index) |

The classic "beeper music" technique works entirely through bit 4: toggle it at audio frequencies and the speaker vibrates, generating square-wave audio. Everything from 48K game soundtracks to AY-style synthesizer emulation that runs on a bare 48K machine was built on this single bit.

### Timex / SCLD Extension (`0xFF`)

The Timex SCLD (Screen Color Logic Device) extended the ULA with additional display modes. On the original Timex machines this was a separate chip. On the Next it's integrated, and readable only if NextReg `0x08` bit 2 is set.

**Reading/Writing `0xFF`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 7 | Timex horizontal MMU bank select (not implemented) |
| 6 | 1 to disable the ULA frame interrupt |
| 5–3 | Screen colour in hi-res mode (ink colour; paper is the contrasting colour) |
| 2–0 | ULA screen mode |

**Screen modes (bits 2:0):**

| Value | Mode |
|-------|------|
| `000` | Screen 0 — standard Spectrum screen at `0x4000` |
| `001` | Screen 1 — standard Spectrum screen at `0x6000` |
| `010` | Hi-colour — 256×192 pixels at `0x4000`, per-row attributes at `0x6000` |
| `110` | Hi-res — 512×192 monochrome, even columns at `0x4000`, odd at `0x6000` |

---

## Memory Banking (`0x7FFD`, `0xDFFD`, `0x1FFD`, `0x2FFD`, `0x3FFD`, `0xEFF7`)

These ports control what memory appears where in the Z80's 64KB address space. They implement the banking schemes of various historical Spectrum models — all the way from 128K through +3, and including the Russian Pentagon variants. Any write to one of these ports also sets MMU slots 0 and 1 to `0xFF`, revealing the ROM in the bottom 16K.

### 128K Paging (`0x7FFD`)

The port that launched a thousand demos. Responds when `A15 = 0` and bits 1:0 of the address = `01` (with some +3-specific conditions).

**Writing `0x7FFD`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 7–6 | Extra bank bits in Pentagon 512K/1024K mode |
| 5 | Paging lock: 1 disables this port and freezes the current bank selection |
| 4 | ROM select: 0 = 128K editor, 1 = 48K BASIC |
| 3 | Screen bank: 0 = Bank 5, 1 = Bank 7 |
| 2–0 | 16K RAM bank mapped to `0xC000` |

Bit 5 is the "128K protection bit". Once set, the page selection freezes and this port stops responding — exactly the behaviour the original 128K hardware used to protect paged memory from accidental modification. NextReg `0x08` bit 7 can override this lock if you need to.

The ROM selection in bit 4 is the *low* bit of a 2-bit ROM selector; bit 2 of port `0x1FFD` provides the high bit. Together they select one of four 16K ROM images.

### Next Bank Extension (`0xDFFD`)

The original 128K only had 3 bits for the RAM bank number, reaching 128KB. The Next has up to 2MB. Port `0xDFFD` extends the bank selector with four more significant bits.

**Writing `0xDFFD`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 3–0 | Most significant bits of the 16K RAM bank (combined with `0x7FFD` bits 2:0 to form a 7-bit bank number) |

### +3 Paging (`0x1FFD`)

The +3 added a second paging port for ROM selection and the "special" all-RAM mode. Requires `A[15:14] = 00` and bits 1:0 = `01`.

**Writing `0x1FFD`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 4 | Printer strobe (not implemented on the Next) |
| 3 | Disk motor (not implemented) |
| 2 | High ROM select bit (combined with `0x7FFD` bit 4): `00`=ROM0, `01`=ROM1, `10`=ROM2/+3DOS, `11`=ROM3/48K |
| 0 | Paging mode: 0 = normal, 1 = special (all-RAM) |

**Special (all-RAM) mode** fills all 64KB with four RAM banks, selected by bits 2:1:

| Bits 2:1 | `0xC000–0xFFFF` | `0x8000–0xBFFF` | `0x4000–0x7FFF` | `0x0000–0x3FFF` |
|----------|-----------------|-----------------|-----------------|-----------------|
| `00` | Bank 3 | Bank 2 | Bank 1 | Bank 0 |
| `01` | Bank 7 | Bank 6 | Bank 5 | Bank 4 |
| `10` | Bank 3 | Bank 6 | Bank 5 | Bank 5 |
| `11` | Bank 3 | Bank 6 | Bank 7 | Bank 4 |

Exiting special mode restores the middle 32KB (slots 2–5) to banks 5 and 2, while the top and bottom 16KB resume following `0x7FFD` and `0x1FFD` settings.

### +3 FDC Ports (`0x2FFD`, `0x3FFD`)

These are the Floppy Disk Controller ports from the +3. On the Next they are implemented as **I/O traps** — optionally enabled via NextReg `0xD8` — that generate an NMI rather than talking to actual disk hardware. This allows ESXDOS/NextZXOS to intercept disk access from +3 software.

- **`0x2FFD`** — FDC status register (read-only trap)
- **`0x3FFD`** — FDC data register (read/write trap)

### Pentagon 1024K Memory (`0xEFF7`)

The Russian Pentagon 1024K extension to the 128K banking scheme. Only active when Pentagon 1024K mapping mode is enabled via NextReg `0x8F`.

**Writing `0xEFF7`:** (soft reset = 0)

| Bit | Meaning |
|-----|---------|
| 3 | 1 to overlay the bottom 16K with RAM from 16K bank 0 |
| 2 | 0 = Pentagon 1024K mode active (disables bit 5 lock in `0x7FFD`); 1 = standard 128K mode |

---

## NextReg Gateway (`0x243B`, `0x253B`)

The most important pair of ports on the machine. Everything that doesn't have its own dedicated port lives behind these two addresses.

- **`0x243B`** — Register select: write the NextReg number you want to access
- **`0x253B`** — Register value: read or write the selected register's data

See [Appendix B: NextReg Reference](app-B-nextreg-reference.md) for the full register documentation. The `nextreg` Z80N instruction wraps this two-port sequence into a single opcode — but reads still require the explicit port sequence.

---

## Layer 2 Control (`0x123B`)

Layer 2 is the full-colour 256×192 bitmap display layer. This port controls how it maps into the Z80's address space for fast CPU access. The actual display bank assignments live in NextRegs `0x12` and `0x13`.

**Reading/Writing `0x123B`:**

If bit 4 = 0 (memory mapping control):

| Bit | Meaning |
|-----|---------|
| 7–6 | Map segment: `00`=first 16K, `01`=second 16K, `10`=third 16K, `11`=full 48K |
| 3 | 0 = map active Layer 2 (NextReg `0x12`), 1 = map shadow Layer 2 (NextReg `0x13`) |
| 2 | 1 enables mapping for memory reads |
| 1 | 1 enables Layer 2 display |
| 0 | 1 enables mapping for memory writes |

If bit 4 = 1 (bank offset):

| Bit | Meaning |
|-----|---------|
| 2–0 | 16K bank offset applied to Layer 2 memory mapping |

Layer 2 mapping through this port is separate from the MMU — it overlays whatever the MMU has mapped, but only for the access type you've enabled (read, write, or both). This allows write-only mapping: you draw directly into Layer 2 memory while reads see the underlying content, useful for double-buffering tricks without burning through all your MMU slots.

---

## AY Sound Chips (`0xFFFD`, `0xBFFD`, `0xBFF5`)

The Next includes three AY-3-8910 chips — enough for nine independent voices of programmable sound generation. Only one chip is active at a time; you switch between them by writing a control word to `0xFFFD`.

### Register Select and Chip Switch (`0xFFFD`)

**Reading `0xFFFD`:** Returns the value of the currently selected register in the active AY chip.

**Writing `0xFFFD`:**

If bits 7:5 = `000`, selects an AY register (0–15) in the currently active chip.

If TurboSound is enabled (NextReg `0x08` bit 1 = 1) and multiple chips are active, writing with bit 7 = 1 switches the active chip:

| Bit | Meaning |
|-----|---------|
| 7 | Must be 1 |
| 6 | Left channel enable for selected chip |
| 5 | Right channel enable for selected chip |
| 4–2 | Must be `111` |
| 1–0 | Chip select: `11`=AY 0 (default), `10`=AY 1, `01`=AY 2 |

### Data Register (`0xBFFD`)

**Writing `0xBFFD`:** Writes data to the currently selected AY register in the active chip.

**Reading `0xBFFD`:** Readable (returning the register value) only when +3 or Next video timing is active. On 48K timing, reads return the floating bus.

### AY Info Port (`0xBFF5`)

This is a read-only diagnostic port that sits within the `0xBFFD` address space (decoded when address bit 3 is 0). Not as widely known as the other two, but genuinely useful.

**Reading `0xBFF5`:**

| Bit | Meaning |
|-----|--------|
| 7–6 | Active AY chip: `11`=AY 0, `10`=AY 1, `01`=AY 2 |
| 5 | Reserved |
| 4–0 | Currently selected AY register number |

Use this when writing a driver that might be called with the AY state unknown — read `0xBFF5` to discover which chip is currently active and which register is selected, then restore them when you're done.

> Unlike plain `0xBFFD` reads (which only return valid data on +3 or Next video timing), `0xBFF5` always responds regardless of the current timing mode. If you need to reliably inspect AY state without knowing which timing mode is active, `0xBFF5` is the safe choice.

---

## Digital-to-Analogue Converters (DAC Ports)

The Next provides four 8-bit DAC channels, labelled A through D, which feed the audio outputs:
- **Channels A and B** go to the left audio channel
- **Channels C and D** go to the right audio channel

DAC output must be enabled globally via NextReg `0x08` bit 3.

These ports originated in various Spectrum expansion peripherals — Covox, Soundrive, Specdrum, GS card — each with its own port mapping. The Next supports all of them simultaneously, routing each to the appropriate DAC channel.

| DAC Channel | Write Ports |
|-------------|-------------|
| A | `0xFB`, `0xDF`, `0x1F`, `0xF1`, `0x3F` |
| B | `0xB3`, `0x0F`, `0xF3` |
| C | `0xB3`, `0x4F`, `0xF9` |
| D | `0xFB`, `0xDF`, `0x5F` |

All DAC ports are write-only.

**Port grouping by origin:**

| Origin | Ports | Channels |
|--------|-------|---------|
| GS Covox (`0xB3`) | `0xB3` | B and C (mono) |
| Pentagon/ATM (`0xFB`, `0xDF`) | `0xFB`, `0xDF` | A and D (mono) |
| Specdrum (`0xDF`) | `0xDF` | A and D |
| Soundrive mode 1 | `0x1F`, `0x0F`, `0x4F`, `0x5F` | A, B, C, D |
| Soundrive mode 2 | `0xF1`, `0xF3`, `0xF9`, `0xFB` | A, B, C, D |
| Profi Covox | `0x3F`, `0x5F` | A and D (stereo) |
| Covox | `0x0F`, `0x4F` | B and C (stereo) |

Each group can be individually enabled or disabled via NextRegs `0x84`[1:7]. Enabling multiple groups at the same time causes their addresses to overlap — the DAC channel sees all writes, but port priority rules determine what happens when both a DAC write and a joystick read happen at the same address.

---

## DMA Controller (`0x0B`, `0x6B`)

The DMA controller moves blocks of data between memory and I/O devices without tying up the CPU. Which port you use to access it determines the operating mode — and the DMA remembers this mode until you change it or reset.

- **`0x0B`** — Z80 DMA mode (classic Zilog Z80DMA compatibility)
- **`0x6B`** — ZXN DMA mode (Next-specific extensions, including burst mode for digital audio playback)

Both ports are read/write. The Z80DMA specification is at https://www.zilog.com/docs/z80/ps0181.pdf. The ZXN DMA extensions are documented at https://www.specnext.com/the-zxndma/.

> **Burst mode** is the ZXN DMA killer feature. It keeps the DMA running across multiple bytes in a single bus grant, dramatically increasing throughput. For digital audio playback — streaming sample data to a DAC channel at 44kHz — burst mode is the difference between "works" and "doesn't".

---

## CTC: Counter/Timer Channels (`0x183B`–`0x1F3B`)

The Zilog CTC is a four-channel (currently; the planned eight were temporarily reduced) counter/timer peripheral. Each channel can generate timer interrupts at programmable intervals, or count external signal transitions.

Channels are addressed as:

| Port | Channel |
|------|---------|
| `0x183B` | Channel 0 |
| `0x193B` | Channel 1 |
| `0x1A3B` | Channel 2 |
| `0x1B3B` | Channel 3 |

(Channels 4–7 at `0x1C3B`–`0x1F3B` are currently reserved but decoded.)

Each channel has one port that serves both control word writes and time constant writes — the CTC determines which is which based on the control word's D2 bit:

- **D2 = 1** — this is a control word, and a time constant byte follows
- **D2 = 0** — soft reset; no time constant follows

**A few Next-specific CTC clarifications** that aren't obvious from the Zilog datasheet:

1. After a hard reset, the channel requires a control word with D2 = 1 to initialise; control words without D2 = 1 are ignored and the channel stays in hard reset.
2. A soft reset (D1 = 1) generates the hard reset state if D2 = 0. With D2 = 1, the channel immediately expects a time constant and then runs.
3. Changing the trigger edge selection in bit 4 counts as a clock edge — a timer waiting for an initial edge will advance.
4. The ZC/TO (Zero Count/Timeout) output pulse lasts exactly one clock cycle, not the entire period the counter is at zero.

The four channels are cascaded: channel 0's ZC/TO output drives channel 1's CLK/TRG input, and so on. Channel 3's ZC/TO output is divided by two and drives the joystick clock in I/O mode.

To reliably soft-reset a CTC channel in an unknown state, write a soft-reset control word (D1 = 1, D2 = 0) twice.

---

## Serial Communication

### I2C (`0x103B`, `0x113B`)

Bit-banged I2C master interface, connected to the RTC module, optionally to the Raspberry Pi GPIO (see NextReg `0xA0`), and an internal connector.

- **`0x103B`** — I2C clock line: bit 0 = SCL state (read to sense, write to drive)
- **`0x113B`** — I2C data line: bit 0 = SDA state

The Next always acts as I2C master. You manage the full I2C framing (start/stop conditions, byte streaming, ACK/NAK) in software by toggling these bits.

### SPI (`0xE7`, `0xEB`)

SPI master interface to five devices: the two SD card slots, the FPGA configuration flash (reserved for internal use), and up to two Raspberry Pi SPI devices.

**`0xE7` — SPI Chip Select:**

| Bit | Device | Active when |
|-----|--------|-------------|
| 7 | FPGA flash | = 0 (unavailable — internal use only) |
| 3 | Pi SPI port 1 | = 0 |
| 2 | Pi SPI port 0 | = 0 |
| 1 | SD card 1 | = 0 |
| 0 | SD card 0 | = 0 |

Only one bit should be 0 at a time. Multiple zeros result in undefined behaviour (no device selected effectively). Pi SPI requires the GPIO to be configured for SPI via NextReg `0xA0`.

**`0xEB` — SPI Data:** Write to send a byte; read to receive it. Transaction with the selected device.

### UART (`0x133B`, `0x143B`, `0x153B`, `0x163B`)

Two fully independent UARTs share the same four port addresses. One connects to the ESP Wi-Fi module; the other to the Raspberry Pi GPIO connector. You select which one you're talking to via the select port, then all subsequent operations go to that UART until you select the other one.

Both UARTs have 512-byte receive and 64-byte transmit FIFOs.

**`0x153B` — UART Select:**

| Bit | Meaning |
|-----|---------|
| 6 | 0 = ESP Wi-Fi UART, 1 = Pi GPIO UART (soft reset = 0) |
| 4 | Write 1 to latch the prescaler bits in 2:0 |
| 2–0 | Most significant 3 bits of the 17-bit baud rate prescaler |

**`0x163B` — UART Frame Format:** (hard reset = `0x18`)

| Bit | Meaning |
|-----|---------|
| 7 | Write 1 to immediately reset Tx/Rx modules and flush FIFOs |
| 6 | 1 to assert break on Tx (hold Tx = 0 when idle) |
| 5 | 1 to enable hardware flow control (CTS/RTS) |
| 4–3 | Data bits: `11`=8, `10`=7, `01`=6, `00`=5 |
| 2 | 1 to enable parity |
| 1 | 0 = even parity, 1 = odd parity |
| 0 | 0 = one stop bit, 1 = two stop bits |

**`0x133B` — UART Tx (write) / Status (read):**

Reading returns the UART status:

| Bit | Meaning |
|-----|---------|
| 7 | 1 if Rx is in break condition (Tx from remote held at 0 for 20+ bit periods) |
| 6 | 1 if Rx had a framing error (clears on read; includes parity/stop bit errors) |
| 5 | 1 if next Rx byte was received after an error condition |
| 4 | 1 if Tx buffer is empty |
| 3 | 1 if Rx buffer is near full (≥ 3/4 full) |
| 2 | 1 if Rx buffer overflowed (clears on read) |
| 1 | 1 if Tx buffer is full |
| 0 | 1 if Rx buffer contains unread bytes |

Writing sends a byte to the selected UART.

**`0x143B` — UART Rx (read) / Baud Prescaler (write):**

Reading returns the next byte from the receive FIFO (returns 0 if empty).

Writing configures the lower 14 bits of the baud rate prescaler. The prescaler formula:

$$\text{prescaler} = \frac{F_{sys}}{\text{baud rate}}$$

Where $F_{sys}$ is the system clock (see NextReg `0x11` for the exact frequency per video mode). For a 27 MHz HDMI system clock at 115200 baud: $\lfloor 27000000 / 115200 \rfloor = 234$.

---

## ULA+ Extension (`0xBF3B`, `0xFF3B`)

ULA+ is a community-developed extension to the ULA colour system that provides a 64-entry palette indexed by the standard Spectrum attribute byte, enabling per-attribute 8-bit colour assignment. On the Next, the 64 ULA+ palette entries live in indices 192–255 of the standard ULA palette — so there are actually two ULA+ palettes, one per ULA palette set.

**`0xBF3B` — ULA+ Register Select (write-only):**

| Bits 7:6 | Group |
|----------|-------|
| `00` | Palette group: bits 5:0 select palette index 0–63 |
| `01` | Mode group: selects mode control (bits 5:0 ignored) |

**`0xFF3B` — ULA+ Data:**

Reading returns the current palette value (if palette group) or bit 0 = ULA+ enabled state (if mode group).

Writing sets the palette entry at the current index (if palette group) or bit 0 = 1 enables ULA+ / 0 disables it (if mode group).

All ULA+ colours are 8-bit format `GGGRRRBB`. The ninth blue bit is automatically generated as the logical OR of the two blue bits.

---

## Sprites (`0x303B`, `0x57`, `0x5B`)

The Next supports up to 128 hardware sprites, each up to 16×16 pixels. These three ports form the entire sprite I/O interface.

**`0x303B` — Sprite Slot Select:**

Reading returns status flags:
- Bit 1: 1 if more than the maximum clipped sprites appeared on a single line (overflow)
- Bit 0: 1 if any two displayed sprites collided on screen

Reading also clears both flags.

Writing selects the current sprite and pattern:
- Bits 6:0 set the current sprite index (0–127)
- Bits 5:0 with bit 7 set the pattern index (0–63; bit 7 offsets 128 bytes into the pattern for 4-bit sprites)

> The current sprite index and pattern index are independent — writing this port advances both simultaneously, but they can get out of sync if you write attribute and pattern data in different quantities.

**`0x57` — Sprite Attributes (write-only):**

Writes one attribute byte for the current sprite. Each sprite takes 4 or 5 attribute bytes; after the last one is written, the current sprite pointer advances to the next sprite (wrapping 127→0).

**`0x5B` — Sprite Pattern Data (write-only):**

Writes one pixel byte starting at the current pattern address, then advances by one. The pattern address resets when you write a pattern index via `0x303B`. Each full 8-bit pattern is 256 bytes; 4-bit patterns use 128 bytes.

---

## Multiface (`0x1F` / `0x9F` / `0x3F` / `0xBF`, configurable)

The Multiface is an NMI-triggered debugging/freezing peripheral. The Next implements it in FPGA and supports three different Multiface hardware types (selected via NextReg `0x0A` bits 7:6): Multiface 1, Multiface 128, and Multiface +3 (the default).

The port addresses for enabling and disabling the Multiface depend on the type selected:

| Type | Enable Port | Disable Port |
|------|-------------|--------------|
| Multiface 1 | `0x9F` | `0x1F` |
| Multiface 128 v87.12 | `0x9F` | `0x1F` |
| Multiface 128 v87.2 | `0xBF` | `0x3F` |
| Multiface +3 (default) | `0x3F` | `0xBF` |

NMI buttons (M1/DRIVE on the keyboard) trigger the Multiface NMI. The Multiface maps its own ROM into `0x0000–0x3FFF` while active, replacing whatever was there. When disabled, the previous ROM/RAM returns.

---

## DivMMC (`0xE3`)

The DivMMC provides automatic SD card content injection, compatible with ESXDOS and NextZXOS. Port `0xE3` lets software control it manually or inspect its current state.

**Reading/Writing `0xE3`:**

| Bit | Meaning |
|-----|---------|
| 7 | `CONMEM`: 1 to manually map in DivMMC (ESXDOS ROM in `0x0000–0x1FFF`, selected RAM bank in `0x2000–0x3FFF`) |
| 6 | `MAPRAM`: 1 to replace the ESXDOS ROM with DivMMC bank 3 (write-once; only a power cycle clears it, unless NextReg `0x09` bit 3 is set) |
| 3–0 | `BANK`: selected DivMMC RAM bank for the `0x2000–0x3FFF` region |

DivMMC's main trick is **automap**: it monitors instruction fetch addresses and automatically pages itself in when the CPU fetches from specific addresses (RST vectors, certain entry points). This happens transparently without software intervention and is how ESXDOS provides OS services to software that was never written for it.

The entry points that trigger automap are configurable via NextRegs `0xB8`–`0xBB`. The factory defaults map these fetch addresses to automapping actions:

| Fetch Address | Automap Effect |
|---------------|---------------|
| `0x0000`–`0x0038` (RST vectors) | Delayed or instant DivMMC map-in |
| `0x0066` | NMI handler — instant or delayed map-in |
| `0x04C6` | ROM tape-load entry (`LD-BYTES`) — ESXDOS/original DivMMC tape trap; ROM3 delayed map-in |
| `0x04D7` | ROM tape-load mid-point — NextZXOS tape trap (better compatibility); ROM3 delayed map-in |
| `0x0562` | ROM tape-save entry (`SA-BYTES`) — ESXDOS/original DivMMC tape trap; ROM3 delayed map-in |
| `0x056A` | ROM tape-save mid-point — NextZXOS tape trap (better compatibility); ROM3 delayed map-in |
| `0x3D00`–`0x3DFF` | ROM3 instant map-in (TR-DOS) |
| `0x1FF8`–`0x1FFF` | Delayed unmap |

The four tape trap addresses intercept the Spectrum's built-in tape routines: when BASIC runs `LOAD ""` or `SAVE "name"`, the ROM calls these entry points, and DivMMC maps itself in instead, letting ESXDOS or NextZXOS serve the request from the SD card. The two variants (`0x04C6`/`0x0562` vs `0x04D7`/`0x056A`) hook at slightly different offsets in the tape routines; which pair is active is controlled by NextReg `0xBB` bits 2–5.

These are **memory address monitors**, not I/O ports — the DivMMC watches instruction fetch cycles (M1) rather than responding to `IN`/`OUT` instructions.

---

## Input Devices

### Kempston Mouse (`0xFBDF`, `0xFFDF`, `0xFADF`)

A PS/2 mouse is presented to software as a Kempston mouse on three read-only ports.

**`0xFBDF` — Mouse X position:** 0–255, wraps right (255→0) and left (0→255).

**`0xFFDF` — Mouse Y position:** 0–255, decrements on downward movement (wraps 0→255) and increments on upward movement (wraps 255→0). This matches the original Kempston mouse convention.

**`0xFADF` — Mouse buttons and scroll wheel:**

| Bits | Meaning |
|------|---------|
| 7–4 | Scroll wheel position (0–15, wraps) |
| 2 | Middle button (1 = pressed) |
| 1 | Left button (1 = pressed) |
| 0 | Right button (1 = pressed) |

Mouse sensitivity and button reversal are configured via NextReg `0x0A`.

### Kempston Joystick 1 (`0x1F`, `0xDF`)

Standard Kempston joystick interface. Port `0xDF` is an alias that works when the mouse is disabled.

**Reading `0x1F`:**

| Bit | Meaning |
|-----|---------|
| 7 | 0 (MD Pad: Start) |
| 6 | 0 (MD Pad: A) |
| 5 | Fire 2 (MD Pad: C, pin 9) |
| 4 | Fire 1 (MD Pad: B, pin 6) |
| 3 | Up (pin 1) |
| 2 | Down (pin 2) |
| 1 | Left (pin 3) |
| 0 | Right (pin 4) |

Mega Drive/Genesis multi-button pads (`A`, `X`, `Y`, `Z`) are read via NextReg `0xB2`.

### Kempston Joystick 2 (`0x37`)

Same bit layout as joystick 1, but for the right joystick port.

---

## Quick Reference: All Ports

| Port | R | W | Description |
|------|---|---|-------------|
| `0xFE` | ✓ | ✓ | ULA — keyboard, EAR, border, speaker |
| `0xFF` | ✓ | ✓ | Timex SCLD — screen mode, hi-res colour |
| `0x7FFD` | | ✓ | 128K RAM paging |
| `0xDFFD` | | ✓ | Next RAM bank extension |
| `0x1FFD` | | ✓ | +3 ROM/paging mode |
| `0x2FFD` | ✓ | | +3 FDC status (I/O trap only) |
| `0x3FFD` | ✓ | ✓ | +3 FDC data (I/O trap only) |
| `0xEFF7` | | ✓ | Pentagon 1024K memory |
| `0x243B` | ✓ | ✓ | NextReg register select |
| `0x253B` | ✓ | ✓ | NextReg data |
| `0x103B` | ✓ | ✓ | I2C SCL |
| `0x113B` | ✓ | ✓ | I2C SDA |
| `0x123B` | ✓ | ✓ | Layer 2 control |
| `0x133B` | ✓ | ✓ | UART Tx / status |
| `0x143B` | ✓ | ✓ | UART Rx / baud rate |
| `0x153B` | ✓ | ✓ | UART select |
| `0x163B` | ✓ | ✓ | UART frame format |
| `0x183B`–`0x1B3B` | ✓ | ✓ | CTC channels 0–3 |
| `0xFFFD` | ✓ | ✓ | AY register select / chip switch |
| `0xBFFD` | ✓ | ✓ | AY data (+3/Next timing for reads) |
| `0xBFF5` | ✓ | | AY info (active chip and register) |
| `0x1F` | ✓ | | Kempston joystick 1 / DAC A (write) |
| `0xDF` | ✓ | | Kempston joystick 1 alias / DAC A,D (write) |
| `0x37` | ✓ | | Kempston joystick 2 |
| DAC ports (various) | | ✓ | 8-bit DAC channels A–D |
| `0xFBDF` | ✓ | | Kempston mouse X |
| `0xFFDF` | ✓ | | Kempston mouse Y |
| `0xFADF` | ✓ | | Kempston mouse buttons/wheel |
| `0xE7` | ✓ | ✓ | SPI chip select |
| `0xEB` | ✓ | ✓ | SPI data |
| `0xE3` | ✓ | ✓ | DivMMC control |
| `0x0B` | ✓ | ✓ | Z80 DMA (Z80DMA mode) |
| `0x6B` | ✓ | ✓ | ZXN DMA (Next DMA mode) |
| `0x303B` | ✓ | ✓ | Sprite slot select / status |
| `0x57` | | ✓ | Sprite attributes |
| `0x5B` | | ✓ | Sprite pattern data |
| `0xBF3B` | | ✓ | ULA+ register select |
| `0xFF3B` | ✓ | ✓ | ULA+ data |
| `0x1F` / `0x9F` etc. | ✓ | ✓ | Multiface enable/disable (type-dependent) |

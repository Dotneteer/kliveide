# TVC video-RAM clock stretch — figures 20–22 transcribed

Transcription of figures 20, 21 and 22 of the TVC hardware manual (`tvchardver.pdf`, PDF pages
209–210), with the timing rule they encode. The text that goes with them is §2.2.4, book
pp. 52–55; [TVC_HARDWARE_OVERVIEW.md](TVC_HARDWARE_OVERVIEW.md) §3 gives the context.

**How this was read.** The figures are hand-drawn. I measured each edge against the drawn 160 ns
grid; every main edge of figure 20 lands on a whole unit to within about a tenth of a unit. The
internal signals of figures 21–22 that fall *between* grid lines (`/MREQ`, `/VRAM`, `/M1`,
`/VCAS`, the gate pulses) are given to about ±0.1 unit and are approximate. In the waveforms
below, one character = 40 ns, and the axis counts **units of 160 ns = half a CPU T-state**.

---

## Figure 20 — "A CPU órajele videomemória használatnál" (the CPU clock during video-RAM use)

The upper four cases, Φ(1)–Φ(4), are labelled *írás-olvasás* (memory write/read). The lower four,
Φ(5)–Φ(8), are labelled *utasításlehívás* (opcode fetch, M1). In each pair of four, T1 starts
0, 1, 2 or 3 units after the start of a CPU slot (DEB high), which covers every possible phase.

```text
           0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16
DEB        ▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁
           │  CPU  │ CRTC  │  CPU  │ CRTC  │  CPU  │ CRTC  │  CPU  │ CRTC  │
/VRAS      ▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁▔▔▔▁▁▁▁▁
                               (1)(2)(5)(6)(7)     (3)(4)(8)
/VWR       ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
                               (1)(2)          (3)(4)
                   ── memory read / write ──
Φ(1)       ▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔            T1 T2 T3(held high)
Φ(2)         ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▔▔
Φ(3)             ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔
Φ(4)                 ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔
                   ── opcode fetch (M1) ──
Φ(5)       ▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔    T1 T2(held low) T3 T4
Φ(6)         ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔
Φ(7)             ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔
Φ(8)                 ▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔
```

The `(n)` labels under `/VRAS` and `/VWR` mark which CPU slot each case uses: cases 1, 2, 5, 6
and 7 use the slot at units 4–6, and cases 3, 4 and 8 use the slot at units 8–10. Each clock
trace ends where the next machine cycle's T1 would begin.

### Figure 20 as a table

`p` is the phase of T1's rising edge relative to the start of a CPU slot (DEB rising), in 160 ns
units. A normal Z80 read/write cycle (T1–T3) is 6 units; a normal M1 (T1–T4) is 8.

| Case | Cycle | p | Slot used | Held | Edge that ends the hold | Cycle length (units) | **Stretch** |
|---|---|---:|---|---|---|---:|---:|
| Φ(1) | read/write | 0 | 4–6 | T3 high | T3 ↓ at 7 | 8 | **+2** (1 T) |
| Φ(2) | read/write | 1 | 4–6 | T3 high | T3 ↓ at 7 | 7 | **+1** (½ T) |
| Φ(3) | read/write | 2 | 8–10 | T3 high | T3 ↓ at 11 | 10 | **+4** (2 T) |
| Φ(4) | read/write | 3 | 8–10 | T3 high | T3 ↓ at 11 | 9 | **+3** (1½ T) |
| Φ(5) | M1 | 0 | 4–6 | T2 low | T3 ↑ at 7 | 11 | **+3** (1½ T) |
| Φ(6) | M1 | 1 | 4–6 | T2 low | T3 ↑ at 7 | 10 | **+2** (1 T) |
| Φ(7) | M1 | 2 | 4–6 | T2 low | T3 ↑ at 7 | 9 | **+1** (½ T) |
| Φ(8) | M1 | 3 | 8–10 | T2 low | T3 ↑ at 11 | 12 | **+4** (2 T) |

This matches the text (p. 54): for a read or write the clock is held **high in T3** until T3's
falling edge comes after a DEB 1→0 edge. For an opcode fetch it is held **low in T2** until T3's
rising edge does. In every case the latching edge is exactly **one unit after the CPU slot ends**,
and the stretch is always 1–4 units, as the text says (p. 53).

---

## The rule the figure encodes

The table follows from one rule. *Inference:* this is my reconstruction, and it reproduces all
eight cases exactly.

> The CPU takes the first CPU slot that starts at least **3 units** (read/write) or **2 units**
> (M1) after T1's rising edge. The clock resumes so that the latching edge falls one unit after
> that slot ends.

M1 needs one unit less lead because NM1 pre-clears flip-flop 3 of the stretch circuit (p. 55;
compare `Q3` in figures 21 and 22). In code, with time in 160 ns units and CPU slots starting at
`t ≡ 0 (mod 4)`:

```text
p      = t_T1 mod 4                      // phase of T1's rising edge
lead   = isM1 ? 2 : 3
s      = smallest s >= lead with (p + s) mod 4 == 0   // T1 -> start of the slot used
stretch_units = isM1 ? s - 1 : s - 2     // in 160 ns half-T-states
```

| p | read/write stretch | M1 stretch |
|---:|---:|---:|
| 0 | 2 | 3 |
| 1 | 1 | 2 |
| 2 | 4 | 1 |
| 3 | 3 | 4 |

**The phase carries over between accesses.**

- A stretched **read/write** cycle always ends at the start of a CPU slot, so the next machine
  cycle starts at p = 0.
- A stretched **M1** always ends 3 units after a slot start, so the next cycle starts at p = 3.

Two consequences, both inferred from the table:

- Code running from video RAM pays the worst M1 case repeatedly. A `NOP` fetched from VRAM
  after another VRAM fetch costs 4 T + 2 T = **6 T-states**.
- Back-to-back VRAM data accesses settle at **+1 T-state** each.

An emulator therefore needs CPU time in half-T-states (or at least the CPU's phase modulo 4
against DEB). It can't use a plain per-access penalty.

---

## Figure 21 — "A CLOCK STRECH áramkör működése Φ(1) esetben" (the stretch circuit, case Φ(1))

Internal signals of the stretch circuit (manual figure 18) for a read/write at p = 0. Here `/DEB`
is the inverted DEB: **low = CPU slot**. `gate 1`, `gate 2`, `/Q1`, `Q2`, `Q3` and `inverter 4`
are the manual's "1. kapu", "2. kapu", flip-flops 1–3 and "4. inverter".

```text
           0   1   2   3   4   5   6   7   8   9
6M25       ▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁
/DEB       ▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁
Φ(1)       ▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▔▔▔▔
/MREQ      ▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔
/VRAM      ▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔
/VCAS      ▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔
gate 1     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▁▁▁▁▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁
gate 2     ▁▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▁▔▔▔▔▁▁▁▔▔▔▔▔▁▁▁▁▁▁▁
/Q1        ▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔
Q2         ▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁
Q3         ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔
inverter 4 ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔
```

## Figure 22 — "A CLOCK STRECH áramkör működése Φ(5) esetben" (the stretch circuit, case Φ(5))

Same circuit, opcode fetch at p = 0. The drawing ends at the end of T3. The caption's clock row is
printed "GM25", a misprint for 6M25.

```text
           0   1   2   3   4   5   6   7   8   9
6M25       ▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁▔▔▁▁
/DEB       ▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▁▁▁▁
Φ(5)       ▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁
/MREQ      ▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔
/VRAM      ▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔
/M1        ▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔
/VCAS      ▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔
gate 1     ▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▁▁▁▁▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁
gate 2 STB ▁▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▁▔▔▔▔▁▁▁▔▔▔▔▔▁▁▁▁▁▁▁
/Q1        ▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁▔▔▔▔
Q2         ▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▁▁▁▁
Q3         ▔▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔
inverter 4 ▔▔▔▔▔▔▔▔▔▔▔▔▁▁▁▁▁▁▁▁▁▁▁▁▔▔▔▔▔▔▔▔▔▔▔▔
```

### What figures 21–22 show about the mechanism

- The CPU clock is a J-K flip-flop that toggles on each falling edge of N6M25, i.e. at every whole
  unit [p. 54]. While **`inverter 4` is low**, its J and K inputs are held at 0, so it stops
  toggling and Φ keeps its level.
- **Read/write (fig. 21):** STB (`gate 2`) rises once `/MREQ` and `/VRAM` are both active. The
  request then ripples through flip-flops 1, 2 and 3, one per 160 ns (`/Q1` at 2, `Q2` at 3,
  `Q3` at 4). When all three are set, `inverter 4` goes low, at the start of T3 (unit 4). It
  releases when `/DEB` and `/VCAS` are low together, in the second half of the CPU slot (unit 6).
  The toggles at 5 and 6 are lost: Φ stays high from 4 to 7, a **+2** stretch.
- **M1 (fig. 22):** `/M1` clears `Q3` almost at once (unit ≈0.2), so `inverter 4` goes low one unit
  earlier, at unit 3 in the middle of T2. It releases at the same point (unit 6). The toggles at 4,
  5 and 6 are lost: Φ stays low from 3 to 7, a **+3** stretch. This is the "half a clock shorter
  setup" that the text gives for opcode fetches.
- In both figures the stretch equals the number of whole-unit clock toggles that fall inside the
  window when `inverter 4` is low.

---

## Open points

- **Board variant.** The manual covers the 32K, 64K and 64K+; these figures aren't tied to one of
  them. The 64K+ has a discrete oscillator [p. 48], so its stretch logic should be checked against
  the 64K+ schematics before it is assumed identical.
- **DEB phase at reset.** The clock flip-flops start from a fixed state at power-on reset [p. 49], so
  the CPU-to-DEB phase after reset is deterministic, but the figures don't show its value.
- **Accesses not shown.** Only memory read/write and M1 are drawn. I/O cycles and interrupt
  acknowledge don't address memory, so they should not trigger the stretch. *Unverified:* the
  refresh address put out during M1's T3–T4 together with `/MREQ` could decode as video RAM
  when page 2 holds VRAM. The figures don't settle whether that triggers a stretch.

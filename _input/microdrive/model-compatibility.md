# Interface 1 compatibility by Spectrum model

Own-words notes; `[Fn]` references are in `sources-formats.md`. Hardware paging details are in
the other agent's `interface1-*.md`; here only "does it work on model X, and why".

---

## 1. Summary table

| Model | Works with IF1? | Confidence | Notes |
|---|---|---|---|
| 16K / 48K (Issue 1–6) | **Yes** — the design target | high | [F24][F23] |
| Spectrum+ (48K) | **Yes** | high | same board/ROM as 48K [F23] |
| 128K "Toastrack" (UK) | **Yes**, including from 128 BASIC | high | see §2 [F34][F35][F36] |
| Spanish 128 | Yes **(probable)** | medium | same editor-ROM mechanism "located elsewhere" [F35] |
| +2 (grey, Amstrad) | **Yes** (awkward physical fit) | high | [F24][F23] |
| +2A / +2B / +3 / +3B | **No** | high | see §3 [F24][F28][F37] |
| Pentagon / Scorpion | Not supported in practice | low | different expansion buses; no `.z80` hardware mode for "clone + IF1" [F8] |
| Timex TC2048 | Unclear | low | edge connector Spectrum-compatible but missing some signals [F38]; Z80 format reuses the IF1-paged byte for Timex port `0xFF` [F8] |
| Timex TS2068 / TC2068 | No (needs an adapted IF1) | medium | Warajevo docs talk of "a specially-adapted Interface 1" [F39] |
| ZX Spectrum Next | No | high | not an IF1 host; Klive's Next machine should not offer it |

## 2. The 128K / +2 in detail

### 2.1 How the IF1 coexists with two ROMs

- The IF1 pages its 8 KB ROM in on an opcode fetch from `0x0008` (error restart) or `0x1708`
  (CLOSE #) and out after a fetch from `0x0700` [F17][F11]. It decides from the **address only**;
  it cannot see which of the 128's internal ROMs is selected (MAME's device does the same: it
  checks only the fetch address) [F11].
- On the 128, the IF1's ROMCS overrides whichever internal ROM is selected [F40].
- The 128 editor ROM (ROM 0) produces standard Spectrum error reports by delegating to ROM 1: it
  switches back to RAM bank 0, stores the error code in the new system variable RAMERR, and
  returns into a `RST 08H` instruction kept in RAM (system variable RAMRST, in the old printer
  buffer) via its SWAP routine — so the `RST 08H` executes with **ROM 1 (48 BASIC) paged** [F35].
  That `RST 08H` fetch from `0x0008` is exactly what the IF1 traps.
- The codes ROM 0 sends this way include `C Nonsense in BASIC`, the error the IF1 uses to parse
  its extra syntax [F35]. Hence **IF1 commands work from 128 BASIC**, not only from 48 BASIC.
  Independent confirmation: Paul Farrow's ROM 0 bug list has an entry (found by Toni Baker) that
  occurs "only with ZX Interface 1 attached" in the 128 editor — `1000 OPEN #4,"X"` produces
  "Invalid device expression, 1000:1", one character too long for the editor's lower area, which
  corrupts the screen or (in the full-screen editor) crashes [F36].
- In 48 BASIC mode (`SPECTRUM` command or the menu's 48 BASIC) the machine runs ROM 1 only, so IF1
  behaviour is that of a 48K **(derived)**.
- Contemporary review: "apart from Interface One" ROM-carrying add-ons had problems with the
  128's paging [F34].

### 2.2 128-specific caveats

- **Risk when ROM 0 executes `0x0008` or `0x1708`:** because the IF1 decodes addresses only, if
  code ever fetches from those addresses while ROM 0 is paged, the IF1 ROM would take over with
  the wrong context. Whether ROM 0 (or 128K games that leave ROM 0 paged) ever does this was not
  established **(open question)**; an emulator should simply reproduce the address-only behaviour.
- ROM 0 bug: error code `0x1C` ("a MERGE error") is wrongly sent to ROM 1 [F35] — relevant only
  as a curiosity, but it is the same path the IF1 sees.
- The 128 has its own RS-232/keypad port (AUX) and its own "RAM disk" commands (`SAVE!`, `LOAD!`,
  `CAT!`, `FORMAT`-like syntax), which resemble the IF1 commands but are separate [F34]. The IF1's
  RS-232 is a different port on the IF1 itself.
- The IF1 inserts 58 bytes of system variables at 23734 (`0x5CB6`) when first needed, moving
  CHANS/PROG up (PROG becomes 23813 instead of 23755) **(derived** from the ROM's "58 free bytes"
  check [F12]**)**. The 128's extra system variables live in the printer buffer (23296–23551),
  so there is no overlap [F35]. Software that assumes PROG = 23755 (some loaders, some
  machine code in REM lines) breaks with IF1 attached on any model — the manual and Sinclair's
  hints sheet warn about this and advise `NEW` before loading tape machine code [F6][F41].
- The real-hardware hint "some 128K machines show 'Microdrive not present' on the first access"
  (the IF1's COMMS CLK line idles low after power-on) affects hardware Microdrive emulators, not
  software emulation [F21][F22].

### 2.3 +2 (grey)

Same architecture and ROMs (with Amstrad's copyright messages) as the 128, same expansion
connector; works with the IF1, though the IF1's wedge shape does not sit well under the larger
case [F24].

## 3. Why the +2A / +2B / +3 / +3B do not work

- **Connector:** the single ROMCS line (lower pin 25 on 48K/128K) is gone; instead the two ROM
  chips' output-enable lines are brought out separately (upper pin 4 and lower pin 15). A peripheral
  that relies on pulling ROMCS cannot switch the internal ROM off [F37][F40]. Several other lines
  (video, `IORQGE`, the unregulated 9 V supply) changed too [F37].
- **ROM / rights:** *Sinclair User* (July 1987): you can plug an IF1 into a +3 but it will not
  work; the cause is in the hardware so no software fix is possible; and Amstrad could not have
  guaranteed compatibility because the Microdrive rights, including the IF1 ROM code, stayed with
  Sinclair [F28]. The +3 reuses the IF1-style `CAT`/`FORMAT`/`MOVE` syntax for its disk drive
  instead [F28].
- **Power (probable):** the IF1 powers the Microdrives from the Spectrum's 9 V rail, which the
  +2A/+3 connector no longer provides (+5/+12/−12 V instead) [F37] — **(probable, not confirmed by
  a source that names the IF1)**.
- No documented working adapter/modification was found [search, F37].

Emulator consequence: there is no `.z80` hardware mode for "+2A/+3 + IF1" [F8], MAME offers the
IF1 for the 48K and 128K expansion slots but **not** the +3 slot [F11]. Klive should not offer the
IF1 on +2A/+3 (or, if ever offered, label it "non-historical").

## 4. What emulators allow per model

| Emulator | Models offering IF1 | Source |
|---|---|---|
| MAME | 48K family and 128K family slots (`spectrum_expansion_devices`, `spec128_expansion_devices`); not the +3 slot | [F11] |
| Fuse | IF1 is a global peripheral option; the manual states no model restriction for it (it does for DISCiPLE: "48K, 128K and grey +2 … but not +2A or +3") — so whether Fuse lets you enable IF1 on a +3 is **unverified** | [F9] |
| Spectaculator | Emulates IF1 with 16K/48K/128K/+2/+2A/+3 models; per-model restriction **not documented** | [F32] |
| ZEsarUX | Microdrive emulation on "ZX Spectrum" (v12, Jan 2025); per-model list **not documented** | [F15] |
| SpecEmu | No IF1 information found on its site **(unknown)** | [F42] |
| Z80 file format | 48K(+16K) and 128K(+2) only | [F8] |

## 5. Recommendation for Klive

Offer the IF1 on: 48K, 16K (if Klive has it), 128K, 128K Spanish (verify), +2. Not on +2A/+3,
Pentagon/Scorpion, Timex or Next. Implement paging purely by fetch address (no knowledge of the
128 ROM selection), and let the 128's own ROM 0 → ROM 1 → `RST 08H` path do the rest.

## 6. Open questions

1. Does ROM 0 of the 128/+2 (or common 128K software) ever fetch from `0x0008`/`0x1708` while
   ROM 0 is paged? (Test in Klive with a fetch watchpoint.)
2. Does the IF1's "RUN with no program loads `run` from drive 1" auto-boot work from 128 BASIC?
3. Spanish 128: confirm the editor ROM uses the same RAMRST path.
4. TC2048 + IF1: any period report of it working.

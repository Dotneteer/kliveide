# Interface 1 ROM versions and licensing

Own-words notes; `[Fn]` references are in `sources-formats.md`. (The hardware/paging side of
the ROM is covered by the other agent's `interface1-*.md` files.)

---

## 1. Versions

| | Edition 1 ("v1", "Issue 1") | Edition 2 ("v2") |
|---|---|---|
| Size | 8 KB (`0x2000`) | 8 KB (`0x2000`) |
| Common file name | `if1-1.rom` | `if1-2.rom` |
| CRC32 | `e72a12ae` | `bb66dd1e` |
| SHA-1 | `4ffd9ed9c00cdc6f92ce69fdd8b618ef1203f48e` | `5cfb6bca4177c45fefd571734576b55e3a127c08` |
| Shipped in | early units | units with serial number above 87315 [F13] |

- CRC32/SHA-1 values are MAME's (`ROM_SYSTEM_BIOS` "v1"/"v2", default "v2") [F11]. No MD5 was
  found published; compute it from a user-supplied file if needed.
- A third edition is rumoured (said to improve QL compatibility) but appears never to have been
  released [F13][F23]. Carri notes an unpublished "ROM 3" can be deduced from addresses
  published in *Your Sinclair* [F12].
- The ROM carries "1983 Sinclair Research Ltd" and the initials of its author ("MJB",
  identified in the disassembly as Martin Brennan) [F12].

### 1.1 How to tell them apart

- **From BASIC:** `CLOSE #0: PRINT PEEK 23729` → **0** on edition 1, **80** on edition 2
  [F13][F23]. 23729 (`0x5CB1`) is the IF1 system variable WIDTH (RS-232 "t" channel line width)
  that edition 2 introduced and initialises to 80; `CLOSE #0` is just a cheap way to make the IF1
  create its system variables [F13].
- **From the image:** compare CRC32/SHA-1 above.

### 1.2 Known differences (v1 bugs, v2 changes)

From the appendix in Carri's *Spectrum Shadow ROM Disassembly* and the disassembly comments
[F12][F13], the IMC notes [F16] and the Dataserve summary [F23]:

- **Microdrive speed:** v1 CAT/ERASE/OPEN always scanned 255 sectors (~3 s wasted per command on a
  real ~180-sector tape); v2 stops after "highest sector number seen + 3" sectors. The v2 algorithm
  also works on emulated 254-sector cartridges [F12].
- **FORMAT:** v2 verifies with direct `OUT`s rather than through the channel, and marks every
  sector that follows a bad one as bad too (better reliability; see the 126/127 K note in
  `mdr-and-file-formats.md`) [F12][F13]. Faster formatting is also cited [F23].
- **CLOSE bug:** a missing `SET 7,(HL)` in v1's CLOSE routine was fixed at `0x1741` in v2 [F13].
- **Memory check:** v2 checks there is room before creating an `m`/`n` channel; v1 could crash —
  the "low RAMTOP" bug that "crashed a lot of programs" [F13][F23]. Even v2 still has a related
  out-of-memory crash path (Spectrum ROM error raised with motor running and interrupts disabled)
  per the IMC notes [F16].
- **RS-232 "t" channel:** rewritten in v2 — TAB and comma supported, leading-space bug fixed,
  variable line width via WIDTH (23729); no CR sent when a "b" channel is closed [F13].
- **Hook codes:** v2 adds hook codes `0x33` (read the next record descriptor) and `0x34` (open an
  RS-232 "b" channel); hook `0x2F` fixed (carry preserved); hook `0x2B` changed [F13].
- **Timeout:** v2's header-read routine returns (with the flag bit inverted) on time-out [F13].
- **Routine addresses moved** between editions, so programs that call into the shadow ROM
  directly (rather than through hook codes) may need per-edition addresses — Carri's book prints
  two label tables for exactly this reason [F13]. Wikipedia makes the same point [F24]. Sinclair
  claimed at the time that there should be no compatibility problems [F25].

### 1.3 Which one software expects

- Software that uses only hook codes works on both; v2 is by far the more common and is the
  **de-facto default**: Fuse's default file is `if1-2.rom` [F9], MAME defaults to v2 [F11], the
  zx-state spec says "use the standard v2 ROM" when no custom ROM is stored [F5], ZXPicoMD is
  tested only with v2 [F21].
- Programs that need hook `0x33`/`0x34` require v2 **(derived)**.
- Recommendation: Klive should default to v2 and offer v1 as an option (for accuracy tests and
  for the PEEK 23729 test).

### 1.4 Modified / third-party IF1 ROMs (awareness only)

- IMC ROM: v2 plus fixes and an extra 8 KB of commands (16 KB total) [F16] — matches the SZX
  allowance for a 16 KB custom IF1 ROM [F5].
- A forum post says a ZXC4 ROM cartridge "maps over" the IF1 ROM and effectively gives a v2 ROM
  [F33] (**uncertain**, single forum source).

---

## 2. Licensing

### 2.1 The Amstrad statement does **not** cover the IF1 ROM

The well-known permission for emulator authors is Cliff Lawson's (Amstrad plc) comp.sys.sinclair
post of 31 August 1999 [F26][F27]. Amstrad allows emulators to include its ROM images unaltered
in their copyright messages, asks for an acknowledgement, forbids charging for the ROMs, and allows
modified ROMs with the same proviso.

But the same post answers the question "does this apply to … Interface 1+2 …?" by saying that
Amstrad believes it bought only the Spectrum 48/128 rights from Sinclair, and that he does not
believe "the (c) for ZXs or IF1/2 has anything to do with Amstrad" [F26]. So the
Amstrad permission **cannot be relied on for the Interface 1 ROM.**

### 2.2 Who owns it

- The ROM's own notice is "1983 Sinclair Research Ltd" [F12].
- *Sinclair User* (July 1987) reported that the Microdrive rights, including the IF1 ROM code,
  stayed with Sinclair after the Amstrad takeover — given as one reason why the +3 was not made
  IF1-compatible [F28].
- Debian's `spectrum-roms` package records `if1-2.rom` as "Copyright (C) 1983 Sinclair Research
  Ltd." with no "now owned by Amstrad" note (unlike the 48/128 ROMs), and ships it in **non-free**
  [F29][F30].
- No public redistribution statement from Sinclair Research for the IF1 ROM was found. (A
  similar gap exists for the QL ROMs, which projects describe as never formally licensed [F31].)

### 2.3 Who ships it anyway

| Project | Ships IF1 ROM? | Notes |
|---|---|---|
| Fuse | Expects `if1-2.rom`; "not all these ROMs are supplied with Fuse — you must supply your own" [F9] | Distributions package it separately (Debian `spectrum-roms`, RPM Fusion `fuse-emulator-roms`, nonfree repo) [F29][F27] |
| Debian `spectrum-roms` | Yes, `if1-2.rom` | non-free archive [F29] |
| ZEsarUX | Yes: `src/if1-v1.rom` and `src/if1-v2.rom` in its repository [F15] | |
| Spectaculator | Emulates IF1 and even bundles the original Sinclair Business and Games cartridges [F32] | commercial; licence basis not stated |
| MAME | No (ROMs are never shipped; CRC/SHA-1 listed for verification) [F11] | |

### 2.4 Options for Klive (MIT)

1. **User-supplied ROM** (Fuse model): ship no IF1 ROM; the user points Klive at `if1-2.rom`/`if1-1.rom`;
   Klive verifies CRC32 and labels the version. Legally cleanest.
2. **Ship it with a notice and a takedown promise**, as Klive already does for the HT-1080Z ROMs
   ("no explicit permission … removed on request", `THIRD_PARTY_NOTICES.md`). Precedent exists
   (ZEsarUX, Debian non-free), but there is no permission statement to quote.
3. **Write a clean-room replacement ROM** — large job; would also need to satisfy the provenance
   rules Klive uses for its own ROM work.

This is a decision for the project author; this file only records the facts.

## 3. Open questions

1. Does any written permission from Sinclair Research (or its successor) for the IF1 ROM exist?
2. MD5 of both ROMs (compute locally from a user-supplied file if Klive wants them).
3. Exact list of software that *requires* v1 or v2 (none found).

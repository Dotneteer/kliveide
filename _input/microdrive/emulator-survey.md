# How existing emulators present the Interface 1 and Microdrives

Behaviour only — gathered from manuals, changelogs, feature lists and file-format specs. No GPL
code was read for this file. `[Fn]` references are in `sources-formats.md`.

---

## 1. At a glance

| | Fuse | Spectaculator | ZEsarUX (≥ 12) | MAME | SpecEmu |
|---|---|---|---|---|---|
| Drives | 8 [F9] | up to 8 [F32] | not stated | **2** (`mdv1`, `mdv2`) [F11] | unknown [F42] |
| Image formats | MDR [F9][F10] | MDR, zipped MDR [F32] | MDR, RMD (raw), QL MDV [F15] | MDR, MDV (image device lists both) [F11] | — |
| New/blank cartridge | "Insert New" = **unformatted** cartridge; length set by `--mdr-len` (10–254) or random ≈ 180 blocks [F9] | not documented | "stretching the microdrive when it's new" (raw mode) [F15] | — | — |
| Write protect | menu: Enable/Disable tab per drive [F9] | stored in MDR [F2] | yes (implied) | — | — |
| Persisting writes | only on Save/Save as/Eject (prompt on eject if modified) [F9] | not documented | — | — | — |
| IF1 ROM | user-supplied `if1-2.rom` (`--rom-interface-1`) [F9] | built in (v2 is the zx-state default) [F5] | ships `if1-v1.rom`, `if1-v2.rom` [F15] | v1 or v2 selectable as BIOS, default v2 [F11] | — |
| RS-232 | yes: RxD/TxD to FIFO or file (`--rs232-rx/--rs232-tx`), handshake option, menu plug/unplug [F9] | yes: input and output independently to a real serial port or a file [F32] | not stated | RS-232 port device [F11] | — |
| ZX Net | menu "Sinclair NET plug in/unplug" (documented as TODO) [F9] | not documented | not stated | not stated | — |
| Extras | — | drive noise; bundles original Sinclair Business & Games cartridges [F32] | MDR browser (file map, fragmentation, rename, sector info, chkdsk), bad-sector emulation, data sound, "Visual Microdrive" window, CPU WAIT states added for microdrive [F15] | software list of 73 *Outlet* MDRs, all marked unsupported [F11] | — |

## 2. Fuse (most detailed public documentation)

- Enable with `--interface1` or Options → Peripherals → Interface 1; this also enables the IF1
  RS-232 (and nominally the network) [F9].
- Menus per drive (1–8): **Insert New**, **Insert…**, **Eject**, **Save**, **Save as…**,
  **Write protect → Enable/Disable**; RS-232 **Plug/Unplug RxD/TxD**; Sinclair NET **Plug in/Unplug** [F9].
- Command line: `--microdrive-file`, `--microdrive-2-file` … `--microdrive-8-file`, `--mdr-len`,
  `--mdr-random-len`, `--rom-interface-1`, `--rs232-rx`, `--rs232-tx`, `--no-rs232-handshake` [F9].
- Changes stay in memory until saved; on eject a modified cartridge triggers a "save changes?"
  prompt [F9]. → Good model for Klive: never write the user's `.mdr` silently.
- Emulation level: Fuse runs the real IF1 ROM and lets the user FORMAT unformatted cartridges of
  arbitrary length, which implies port-level emulation of the drive's byte stream rather than
  trapping ROM routines **(derived)**. IF1/Microdrive emulation was written by Gergely Szasz [F9].
- Fuse's DISCiPLE section documents model restrictions; the IF1 section does not [F9].

## 3. Spectaculator

- Emulates IF1 incl. RS-232 and up to 8 Microdrives with `.mdr`; zipped MDRs load directly; drive
  noise is emulated; the original Sinclair Business and Games cartridges ship with it [F32].
- Its zx-state (SZX) format stores, per drive, motor state, **head position within the MDR** and
  **"preamble bytes left to skip"** [F5] → it emulates the drive as a byte stream with synthesised
  preambles, i.e. at the port level, not by traps **(derived)**.
- Cartridges in SZX are references to external MDR files (embedding "not implemented") [F5].

## 4. ZEsarUX

- Microdrive emulation on the Spectrum arrived in **ZEsarUX 12 (16 Jan 2025)** [F15]:
  - **Standard MDR** emulation with an MDR browser: file map, fragmentation view, rename, sector info,
    chkdsk, bad-sector emulation.
  - **Raw (RMD)** emulation: keeps gap zones and sync bytes, can auto-generate bad sectors and
    "stretch" a new cartridge, and supports non-IF1 recording formats (Multiface 128 microdrive
    extension, CP/M on LEC memory).
  - Simulated data sound; **Visual Microdrive** window; the Z80 core gained **WAIT-state** support
    "needed to emulate microdrive" (the IF1 holds the CPU on data-port access) [F15][F17].
- ZEsarUX 13 (2026) adds an option to **accelerate** disk/microdrive loading and saving [F15].
- Its repository ships both IF1 ROMs and test images `src/tests/testmicrodrive.{mdr,rmd,tap}`
  [F15] (GPL repository; data files only, see `test-material.md`).

## 5. MAME

- `spectrum_intf1_device`: IF1 ROM v1/v2 selectable (default v2), RS-232 port, **two** microdrive
  image devices chained by the COMMS line, pass-through expansion slot [F11].
- ROM paging is by fetch address: enable *before* the opcode fetch at `0x0008`/`0x1708`, disable
  *after* the fetch at `0x0700` (the comment explains the opcode at `0x0700` must still come from
  the IF1 ROM) [F11]. (BSD-3 file; read only for behaviour.)
- The microdrive image device accepts `mdv` and `mdr`; its constants describe the QL's QLAY layout
  (255 × 686 bytes, 100 kbit/s) [F11]. All 73 entries of the `spectrum_microdrive` software list
  (Outlet magazine MDRs) are flagged `supported="no"` [F11] → Spectrum microdrive support in MAME
  should be considered incomplete.

## 6. Hardware Microdrive emulators (relevant for timing and format expectations)

| Device | Notes |
|---|---|
| **vDriveZX** (Charlie Ingley) | 8 drives, MDR, compatible with Fuse/Spectaculator images [F20] |
| **ZXPicoMD** (Tom Dalby) | 8 drives, MDR on SD; the IF1 allows only ~50–100 ms between motor-on and data before "Microdrive not present"; ~15 KB/s; blank formatted cartridge = 127 KB; tested with ROM v2 only; defrag cut a demo's load from 23 s to 6 s [F21] |
| **OqtaDrive** (xelalexv) | 8 drives, Spectrum + QL; MDR, MDV, MDI, RMD; Z80/SNA/TAP converted on load; auto-saves when the drive stops [F22] |
| **Pico IF1** (Derek Fountain / João Alves write-up) | emulates the whole IF1 + 8 drives with the real ROM; MDR; RS-232 and network not implemented [F43] |

## 7. Emulation approaches

| Approach | Who | Pros | Cons |
|---|---|---|---|
| **Port-level byte stream** (ports `0xE7` data, `0xEF` control/status; gap/sync synthesised; CPU WAIT on data port) | Fuse, Spectaculator, ZEsarUX (MDR mode) **(derived)** | runs the real ROM, so every program and copy-protection behaves; FORMAT works; SZX-compatible | needs correct gap/sync/preamble timing and the WAIT behaviour |
| **Raw track** (gaps, sync, bad sectors stored) | ZEsarUX RMD [F15] | non-IF1 formats (Multiface, CP/M) work | own format, larger files |
| **ROM traps** (intercept hook codes / CAT/LOAD/SAVE) | none of the surveyed Spectrum emulators | fast | breaks software that drives the ports directly; not worth it for Klive |

### 7.1 Timing (real hardware)

- Tape loop ≈ 5 m at 76 cm/s → about 8 s per revolution [F7]; Sinclair Wiki says 8–10 s [F4].
- Data rate: Wikipedia gives 15 KB/s (120 kbit/s) [F7]; the Sinclair Wiki gives ~80 kbit/s per
  track × 2 tracks ≈ 20 KB/s raw [F4]. **Disagreement** — the other agent's hardware notes should
  settle it.
- Manual figures: FORMAT ≈ 30 s, CAT ≈ 7 s, SAVE ≈ 6 s [F6].
- The IF1 must see data within ~50–100 ms of starting the motor or it reports "Microdrive not
  present" [F21].
- Reading the data port when no data can arrive (motor off, no formatted cartridge) stalls the Z80
  indefinitely — the "IN 0 crash" [F17]. An emulator must model this stall (and a reset escape).
- Real-time speed is what the ROM expects; acceleration is optional (ZEsarUX 13 offers it [F15]).
  A Klive "fast microdrive" option would have to shorten gaps while keeping the ROM's time-outs
  satisfied **(derived)**.

## 8. Known accuracy issues and lessons

- MDR does not store gaps, so the preamble/gap timing is synthesised by every emulator — the
  ROM's time-outs (above) must be met [F1][F21].
- Real cartridges have ~180 sectors; emulators default to 254 and the ROM copes [F12][F9].
- The ROM v2 FORMAT marks the sector after any bad one as bad, so a perfect 254-sector emulated
  tape still loses one sector (see `mdr-and-file-formats.md`) [F12].
- QL-formatted cartridges make the Spectrum CAT spin; reformat [F23].
- Saving to the user's file only on explicit save/eject (Fuse) or on drive stop (OqtaDrive) are
  both established conventions [F9][F22].
- Hardware IF1 quirk: COMMS CLK can idle low at power-on, so the first drive access fails on
  some machines [F21][F22] — not something an emulator needs to reproduce.

## 9. Suggested Klive UX (from the above)

- Machine settings: "Interface 1" on/off, ROM edition (v2 default, v1), number of drives (1–8;
  the plan targets 1–2).
- Per drive: Insert…, Insert new (unformatted | formatted), Eject (prompt if dirty), Save / Save
  as, Write-protect toggle, activity indicator (motor on/off, reading/writing).
- A cartridge browser, analogous to the existing Disk Explorer: name, files (type, length, start,
  autorun line), free/bad sectors, export file to TAP/host, import.
- Persist state in Klive's own machine state; SZX/Z80 import/export as in
  `snapshot-and-state-formats.md`.

## 10. Open questions

1. Does Fuse refuse IF1 on +2A/+3? How does Fuse model the "IN 0" stall?
2. SpecEmu's IF1 support (no public documentation found).
3. Spectaculator's model restrictions and its new-cartridge length.

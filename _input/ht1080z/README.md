# HT-1080Z: research pack for a Klive machine

This is background collected on 2026-10-21, before writing a plan to add the HT-1080Z, the Hungarian school computer made by Hiradástechnikai Szövetkezet from 1983, to Klive. It is not a plan. It records the facts, the open questions, and what the existing emulators can and cannot give us.

Every file cites its sources inline: URLs, and for emulator code the file and function. Anything concluded rather than read is marked *inference*. Where sources disagree, both versions are kept. Reference documents are in `docs/`. The MIT-licensed TypeScript TRS-80 sources are in `lkesteloot-trs80/`. No ROM images are included.

| File | Covers |
|---|---|
| [HARDWARE.md](HARDWARE.md) | Lineage and variants; CPU, clocks, NMI and interrupts; memory map; I/O ports; video (format, chargen, semigraphics, timing, VIDEO CUT/PAGE, "snow"); sound (beeper and AY-3-8910); keyboard matrix; cassette hardware; the 50-pin bus and the EU7 expansion unit (FD1771, printer, HRG card); reset and boot |
| [STORAGE_FIRMWARE_SOFTWARE.md](STORAGE_FIRMWARE_SOFTWARE.md) | ROM sets (MAME names and hashes), what Hungary changed, redistribution status; Level II ROM entry points, the communications region, the token table; cassette signal and file structures, `.cas`/`.cmd`/`.cpt`/`.wav`; disk (WD1771, DOSes, JV1/JV3/DMK); software archives and test programs |
| [EXISTING_EMULATORS.md](EXISTING_EMULATORS.md) | About 17 HT-1080Z and TRS-80 Model I emulators, with licences verified against the repositories; the code structure of the main candidates; port source and accuracy oracle |
| [lkesteloot-trs80/](lkesteloot-trs80/README.md) | lkesteloot/trs80 (MIT, TypeScript) at commit `11ed9327`: the Model I machine, the WD1771, the JV1/JV3/DMK and CAS/CMD readers, and the cassette encoder. ROM files and the GPL Fuse test vectors are left out, so `Trs80.ts` does not compile on its own. Input only. |
| [docs/](docs/) | 40 reference documents (see below) |

### Reference documents in `docs/` (grouped; full source URLs are in the two files' "Reference documents downloaded" sections)

| Group | Files |
|---|---|
| Official HT manuals (Hungarian) | `ht1080z_hasznalati_utmutato_user_manual_hu.pdf`, `ht1080z_basic_kezikonyv_basic_manual_hu.pdf`, `ht1080z_basic_referencia_kartya_hu.pdf`, `ht1080z_bovito_egysegek_expansion_units_hu.pdf`, `ht1080z64_kezelesi_utmutato_operating_manual_hu.pdf`, `ht1080z64_valtozasok_changes_hu.pdf` |
| HT ROM | `ht1080z_fix_taroloja_rom_book_hu.pdf` (FIXTÁR, a 159-page ROM book that includes the differences between versions), `ht_rom_basic_0000-2FFF_kezi_visszafejtes_kollar_hu.pdf` (Kollár's hand disassembly), `ht1080z_ram_munkaterulet_workspace_fekete_hu.pdf`, `ht1080z_utasitaskeszlet_instruction_set_hu.pdf`, `magyar_elektronika_*`, `mm1987_06_magyar_hibauzenetek_hu.pdf`, `bitlet_basic_tokenek_hu.jpg` |
| Schematics (HT-1080Z/64) | `ht1080z64_schematic_*.pdf`: CPU board (F panel), video board (E panel, 2 sheets plus layout), sound, keyboard, cassette, power supply |
| Expansion | `ht_EU7_HRG_card_registers_hu.pdf`, `ht_EU7_HRG_card_calibration_hu.pdf`, `ht_technomir_measurement_modules_hu.pdf`, `radiotechnika_1984_0{7,8,9}_*` |
| Parent machines | `EACA_Genie_manual_1982.pdf` (**the main hardware-timing source**), `system80_users_manual_with_blue_label_pages.pdf`, `trs80_reference_manual_photocopy_used_in_hungary.pdf`, `trs80com_model1_3_4_rom_disassembly_interactive.htm` |
| Formats and emulators | `tim_mann_trs80_disk_image_formats_dskspec.html`, `david_keil_dmk_trstech.htm`, `homeserver_*` pages (CAS formats, ROM variants, Series I/II/64, Grósz's emulator readme, Kollár's converter) |

## The machine at a glance

The HT-1080Z is **a licensed EACA Video Genie I / System-80 (Blue Label) with an AY-3-8910 sound board added**. It is not a direct copy of the Tandy TRS-80 Model I, but it runs Model I Level II software. There are three variants: Series I (1983), Series II (1984; accented characters) and /64 (1985; 48K user RAM, BASIC 2.20, extension 2.51). MAME calls them `ht1080z`, `ht1080z2` and `ht108064`. About 2,364 units went to schools.

| Block | Summary | Detail |
|---|---|---|
| CPU | Z80 at master clock ÷ 6, so one T-state per character cell. That is 1.77742 MHz on the /64 (10.6645 MHz crystal, traced on the schematic) and ≈ 1.774 MHz on Series I/II (10.644 MHz, from the Genie manual). No wait states. IM 1, but **the bare machine has no INT source**. The RESET key drives NMI, which goes to 0066h with memory kept. | HW §2 |
| Memory | 12K BASIC ROM at 0000–2FFF. A 1.5–2K extension EPROM at 3000–37FF, different for each variant. Keyboard at 3800–3BFF. 1K × 8 video RAM at 3C00–3FFF. RAM at 4000–7FFF (16K), or 4000–FFFF on the /64 (48K; no paging documented). | HW §3 |
| Video | 64×16 text in 6×12 cells. Glyphs are 5 dots wide, from a 2K HT character ROM. Bit 7 of a character selects 2×3 semigraphics, giving 128×48. A line is 112 character times; a frame is 312 lines (34,944 T-states, about 50.8 Hz, PAL). The 32-column mode is a hardware VIDEO CUT switch plus a PAGE key; software cannot select it. A CPU access to video RAM blanks a short dash on screen instead of stalling the CPU. | HW §5 |
| Ports | FF write: bits 0–1 cassette out (three levels), bit 2 relay/motor. FF read: bit 7 is the cassette-in latch, cleared by any write to FF. FE bit 4 selects the internal or external recorder. FD is the printer. 1F selects the AY register; 1E is AY data. | HW §4 |
| Sound | A speaker plays the cassette-out bits (muted while the relay is on). The AY-3-8910 mixes its three channels to mono. Its ports A/B go to a rear user port. There is no SOUND keyword: BASIC programs use `OUT 31,reg : OUT 30,val`. | HW §6 |
| Keyboard | Standard TRS-80 8×8 matrix at 3800h. Rows are selected by address lines and ORed together. Hungarian accented letters are typed through software key combinations. | HW §7 |
| Tape | Internal recorder (Series II and later) and an external one, with motor relay. 500 baud FM, 2 ms bit cells, MSB first. The ROM writes 255 zero bytes and then A5h. File types: BASIC (D3 D3 D3), SYSTEM (55h, 3Ch blocks, 78h) and EDTASM. Image formats are `.cas`, `.cmd` and `.wav`. No HT-specific speed or format was found. | HW §8, SFS §3 |
| Disk | Optional EU7 expansion unit: FD1771 at 37EC–37EF, drive select at 37E0, up to 4 SS/SD drives. **Its card adds the 40 Hz heartbeat interrupt.** NEWDOS/80 or TRSDOS images in JV1/JV3/DMK. | HW §9, SFS §4 |
| ROM differences from Tandy | Second-recorder select is `OUT (FE)` at 0212h. The printer is on port FD. Tape-read delays use the older v1.0–1.2 values. Everything else (0235h, 0264h, 0284h, 0296h, the RST vectors, the 4000h communications region) matches Tandy's Level II. | SFS §1.3–1.4 |

## Components an emulator needs, roughly in build order

1. **Memory map and ROM loading**, with a variant table for Series I, Series II and /64 (main ROM, extension EPROM, character ROM, RAM size).
2. **Z80 timing frame.** Klive's existing Z80 can be reused. Use 112 T-states per line × 312 lines, with no contention and no internal interrupt. Add NMI from a Reset command.
3. **Video.** A 64×16 text and semigraphics renderer driven from the character ROM, with VIDEO CUT and PAGE as UI toggles. The video-access "dash" is optional.
4. **Keyboard matrix** at 3800h. At this point the machine reaches `READY ?` / `MEMORY SIZE?`.
5. **Port FF/FE latches**, the beeper, and the **AY-3-8910** on 1E/1F. Klive already has an AY implementation from the Spectrum 128.
6. **Tape.** Signal-level 500-baud playback and record, motor control, two decks, `.cas` and `.wav`. Optionally a ROM-trap fast load, as Grósz's emulator and the MiST core do.
7. **EU7 expansion option.** The 40 Hz RTC interrupt and the 37E0 latch, an FD1771 with JV1/JV3/DMK images, and the printer on FD. The HRG card can come later. It is a second video subsystem with its own monitor: two 512 × 512 1-bit pages written through X/Y and command ports at 68–7Bh, an MC6845, a shadow of the 3C00–3FFF text, and its own 10.5 MHz dot clock with interlaced output. HW §9.2 has the details.
8. **IDE integration.** Machine type, a Level II BASIC token table for listing and export, `.cas`/`.cmd` export from the assembler, and the HT's Hungarian glyphs in the memory and screen views.

## Main conclusions

- **Port source: `lkesteloot/trs80` (MIT, TypeScript).** It is active and tested, and covers the Model I subset the HT shares: memory and I/O decode, keyboard, signal-level cassette, WD1771 with JV1/JV3/DMK, and the CAS/CMD parsers. It has no HT or System-80 support. Klive keeps its own Z80. The copy is in `lkesteloot-trs80/`.
- **HT-specific parts: MiST `ht1080z` core** (BSD-3 headers, by Jozsef Laszlo) for the AY decode, the PAL geometry and VIDEO CUT/PAGE. **MAME `src/mame/trs/` (BSD-3)** for the System-80 port map, ROM hashes and character-ROM layout. **SDLTRS (BSD-2 plus the xtrs licence)** for System-80 I/O quirks. All three may be ported with their notices. The GPL files in the MiST/MiSTer repos (`HT1080Z_MiST.sv`, `fdc1771.sv`) and MiSTer's non-commercial files are for facts only.
- **Accuracy oracle:** trs80gp (closed, scriptable, claims cycle-exact Model I timing) run with `-m1 -50` and the HT ROMs. For the AY and the System-80 ports, cross-check by hand against the Hungarian emulators: Grósz's HT1080Z and Kollár's Real-80. **MAME is a fact source, not an oracle:** all three HT sets are flagged `MACHINE_NOT_WORKING`, and it always runs the 40 Hz interrupt.
- **ROMs:** no permission to redistribute them was found, from Microsoft, Tandy, EACA or HT. ht.homeserver.hu hosts dumps without a licence. The safe default is user-supplied ROMs, as with the Enterprise. There is no free replacement ROM.
- **No open emulator models the HT at T-state or raster level.** The EACA Genie manual in `docs/` has enough timing detail (dot clock, line and frame structure, the video-access circuit) to do it.

## Points the sources disagree on (to settle with test programs or hardware)

| Question | Positions | Where |
|---|---|---|
| Master crystal / CPU clock | **On the /64 the schematics settle it:** the E panel crystal is "10,6645 MHz", and it is the dot clock. It goes as CK to the F panel, where a 74LS92 ÷6 drives the Z80 Φ, giving **1.77742 MHz** and about 50.86 Hz. Series I/II use EACA boards with the Genie manual's 10.644 MHz, giving ≈ 1.774 MHz. MAME uses 10.48 MHz ÷ 6 = 1.7467 MHz, which gives exactly 50 Hz. Other quoted figures are 1.65, 1.78 and 1.79 MHz. **The VHDL does not settle it:** the HT-specific MiST core runs 1.750 MHz only because of its 27 MHz board PLL (42 MHz ÷ 24), and MiSTer's 1.774 MHz is the NTSC Tandy crystal. Both cores do confirm CPU = dot clock ÷ 6 and AY clock = CPU clock. | HW §2, §12 |
| Frame rate | About 50.8 Hz (from the Genie crystal) or 49.98 Hz (MAME) | HW §12 |
| AY clock | The CPU clock (*inference* from the schematic; both the MiST and MiSTer cores clock the YM2149 with the CPU enable) or 1.5 MHz (MAME's own comment calls it a guess) | HW §2, §6.2 |
| Interrupts | None on a bare HT (schematic, Laszlo), or always 40 Hz (MAME) | HW §2 |
| /64 memory | 48K user RAM on 64K of chips, with no paging found; the decode on the F panel is not fully read | HW §3.2 |
| EU7 registers at 37E0–37EF vs the extension EPROM at 3000–37FF | Undocumented how the bus card overrides the window | HW §12, EMU open questions |
| Series I extension ROM | EACA `sys80.z13` unchanged (MAME), or an HT-modified one ("NEW KEYBOARD ROUTINE ENABLE", FIXTÁR's differences before serial 832) | SFS §7 #4 |
| Tape leader | 255 zero bytes (the ROM code) or 256 (documentation) | SFS §7 #1 |
| Printer routine at 003Bh | Character in C (HT articles) or in A (Tandy) | SFS §7 #11 |
| Port FF read, bits 6–0 | Undocumented; MAME returns D6 = NOT(cpl) and D5–D0 = 1 | HW §4.3 |

Each file's own "Open questions" section has the full list.

## Suggested next steps before the plan

- Read the FIXTÁR ROM book and the /64 operating manual in `docs/`. The hardware research did not reach them; they should settle the Series I/II/64 ROM differences and the /64 memory question.
- Compare the hashes of the ht.homeserver.hu ROM dumps with MAME's table (the user supplies the files; we do not download them).
- Decide the ROM policy and the provenance rule: port from lkesteloot, MiST BSD files and MAME; read GPL sources only; use trs80gp and the Hungarian emulators as behavioural oracles.
- Decide the clock: measure a known AY tone or a tape timing on a real machine, or take the Genie crystal as the reference and keep MAME's value as an option.

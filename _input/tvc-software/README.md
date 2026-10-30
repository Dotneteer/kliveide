# Videoton TVC software for testing the Klive TVC machine

Downloaded 2026-10-30 from the Hungarian TVC community archive,
<https://tvc.homeserver.hu/cas/> (the "Videoton TVC Game Library" the Wikipedia article links to).
Test input for `.plans/VIDEOTON_TVC_PLAN.md` (§9 tape and the HBF card).

**This folder is in the repository only for a while, at the project author's decision, for testing
the TVC.** Most of it is 1980s commercial or magazine software that the community archive
preserves; Klive does not hold the rights to it. Unlike `_input/zx81-tapes/` (permissively licensed
files only), nothing here may be copied into `test/` fixtures, `src/public/` or the docs site, and
nothing here may be shipped. The `homebrew/` folder is new work published freely by its authors on
the same site, but without a stated licence, so the same rule applies.

The archive's ZIP and RAR files were unpacked; PC tools (Windows `.exe`, Python, batch files) and
scanned documents were dropped. File names are as the archive gives them (Hungarian, some with
CP437/CP852 characters).

**Checked:** 959 of 960 `.cas` files start with the `0x11` buffered-file header
(`cassette/games/ten_brick.cas` starts with `0x0D`: a good malformed-file case). Every `.dsk` starts
with an `EB` FAT12 boot sector. The CRC32s match 1,072 of the 1,132 tape/disk entries in MAME's
software lists (`_input/videoton-tvc/mame/hash/tvc_{cass,flop}.xml`), which also give titles,
publishers and years.

## Layout

| Folder | Contents | Count |
|---|---|---|
| `cassette/games/` | Games (archive folder `jatek/`). Mostly BASIC + machine code. | 330 `.cas` |
| `cassette/utilities/` | User programs (`felhasznaloi/`): biorhythm, music, word processor (Viditype), floppy copy, sound digitizer. | 22 `.cas` |
| `cassette/education/` | Educational programs (`oktato/`): BASIC course, geography, English tests. | 170 `.cas` |
| `cassette/demos/` | Small demos (`demo/`), several only a few hundred bytes: quick first loads. | 9 `.cas` |
| `cassette/new-uploads/` | Recently converted programs (`uj/`). | 182 `.cas` |
| `disks/` | The archive's disk collection (`dsk/`), one raw image per title. 842 are **360K** (40 cylinders, two sides; the README says single-sided images are spread over side 0, check what a 40-cylinder double-sided one does), `demo01-03.dsk` are **720K**. | 845 `.dsk` |
| `cartridges/` | ROM cartridges (`.crt`) from the disk folder: Tetris, Space Invaders, Pac-Man, Turbo Rudi, ... Klive has no cartridge slot yet. | 10 `.crt` |
| `homebrew/<year>/<author>/` | New TVC software from the archive's 2023-2026 upload folders: games, demos, music, sources. | 243 `.cas`, 7 `.dsk` |
| `tape-recordings/` | **Real tape recordings** (`eredeti/`, 8-bit 44.1 kHz mono WAV) of four original cassettes, with the `.cas` files converted from them and the block order (`sorrend.txt`). | 4 `.wav` |

## Good first tests

- **Tape, smallest first:** `cassette/demos/_for1.cas` (170 bytes), `_box.cas`, then a game such as
  `cassette/games/_gunfight.cas`.
- **Disk (HBF card + VT-DOS):** `homebrew/2025/Doberdo_Brothers/ecliptic_tvc/Ecliptic/ecliptic.dsk` and
  `.../monty_on_the_run_tvc/Monty_on_the_Run/monty.dsk` (modern, demanding machine code), then any of
  `disks/`. MAME's list notes that most disks start with `LOAD"*"`, then `RUN` if they do not
  autostart.
- **720K disks:** `disks/demo01.dsk` .. `demo03.dsk`, `homebrew/2023/Kiss_Károly/szokes_a_varbol.dsk`.
- **Tape timing (README "Tape", open question Q2):** `tape-recordings/*/*.wav` are real recordings
  of original tapes; measuring their pilot, 0/1 and sync periods would settle the frequency question,
  and each has a matching `.cas` to compare the decoded bytes with.
- **Malformed input:** `cassette/games/ten_brick.cas` (non-`0x11` header).

Some programs need a 64K+ machine or BASIC 2.2; MAME's lists and the archive's per-letter pages
(`https://tvc.homeserver.hu/html/tvc_programok_a.html` ...) say which.

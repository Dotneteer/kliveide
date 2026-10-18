---
type: feature
issues: [1432]
---
**New experimental machines: the Timex TC2048, TC2068 and TS2068.** They run 48K software and add
the Timex SCLD's screen modes (a second screen, 8x1 extended colour and 512x192 two-colour), port
`$FF` and the 3.528 MHz clock; the TS2068 has a 60 Hz frame and the TC2048 a built-in Kempston
port. The 2068s add 8K bank switching from the HOME bank, the cartridge DOCK and the Extension ROM
(partitions `H0`-`H7`, `D0`-`D7` and `X0`-`X7` in the views and breakpoints), an AY chip with the
PSG panel, two joysticks, and cartridges: **Machine › Cartridge › Insert Cartridge...** takes a
`.dck` file. Klive cannot ship Timex's ROMs, so name yours under **Settings › Machine** (TC2048
ROM, TC2068 ROM or TS2068 ROM); until then the machine boots the Sinclair 48K ROM. With a 2068 ROM
other than the known TS2068 one, the IDE cannot start a program or a tape. `.szx` and `.z80`
snapshots load and save; a `.sna` saves as a 48K, and Klive names what it loses.

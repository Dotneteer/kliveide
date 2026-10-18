---
type: feature
issues: [1432]
---
**New experimental machine: the Scorpion ZS-256,** a Russian 128K-compatible machine with 256K of
RAM in sixteen banks (`B0`-`B15`), port `$1FFD`, four ROMs (`R0`-`R3`: the 128K editor, 48K BASIC,
the service monitor and TR-DOS) and a built-in Beta 128 disk interface with two drives, as on the
Pentagon. Klive cannot ship its 64K ROM, so name yours under **Settings › Machine › Scorpion
ROM**. Until then it boots the 128K ROMs and takes TR-DOS from the TR-DOS ROM setting, and
running, debugging, the tape loader and booting a disk work as on the 128K. With the Scorpion's
own ROM the IDE cannot start a program, tape or disk in its editor, so load them by hand. `.szx`
and `.z80` snapshots keep all sixteen banks; a `.sna` is refused while `$1FFD` is in use.

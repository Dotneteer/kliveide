SAM Coupé ROMs (sam-*.rom)

These are the system ROMs of the SAM Coupé (Miles Gordon Technology plc, 1989):
SAM BASIC and the machine's firmware, 32K each (ROM0 at 0000h, ROM1 at C000h when
LMPR bit 6 is set). Their author and copyright holder is Dr Andrew J. A. Wright.

Permission: Andrew Wright wrote on Wed, 16 Apr 2008, in a reply titled
"Re: Sam Coupe ROM" to Hans de Goede (the Fedora extras commits mailing list):

  "I hereby allow all my SAM Coupé titles (including ROMs) and associated
   manuals to be freely (re)distributed."

  signed "Andrew J. A. Wright, 16/04/2008".

The message is reproduced in the "Trivia" section of World of SAM's ROM page,
https://www.worldofsam.org/products/rom , beside the archive's own 2006
permission, https://www.worldofsam.org/copyrights/sam-coupe-rom-images .
The original is in the Red Hat archive,
https://listman.redhat.com/archives/fedora-extras-commits/2008-April/msg07874.html ;
on 2026-11-20 that host did not resolve from Klive's build machine, so the quote
above was checked against World of SAM's copy only.

The grant sets no conditions. Klive ships the images unmodified, charges nothing
for them and credits the author. They will be removed on request from a rights
holder.

  Klive file      MAME name  Size  CRC32     SHA1
  sam-rom30.rom   rom30.z5   32K   e535c25d  d390f0be420dfb12b1e54a4f528b5055d7d97e2a
  sam-rom31.rom   rom31.z5   32K   0b7e3585  c86601633fb61a8c517f7657aad9af4e6870f2ee

  - ROM 3.0 is the last official release and Klive's default; its splash reads
    "MILES GORDON TECHNOLOGY plc" (lower case), PEEK 15 = 30.
  - ROM 3.1 differs from 3.0 in four bytes only: the version byte (PEEK 15 = 31)
    and "PLC" in capitals. It is MAME's default image and SimCoupé's bundled one.

Both images match MAME's CRC32 and SHA1 for those names.

Sizes and CRC32s are checked by test/machines/sam-rom-images.test.ts.
This notice must be retained.

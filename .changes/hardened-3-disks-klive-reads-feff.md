---
type: feature
---

**Hardened +3 disks:** Klive now reads and writes standard and extended `.dsk` images byte for byte,
including weak sectors, CRC-error and deleted-data sectors, mixed sector sizes and 80-track
double-sided disks, and the +3's disk controller keeps every sector's own ID, size and status, so
protected disks behave as on the real drive and +3 BASIC's `FORMAT` works. Create Disk adds a 720K
double-sided, 80-track type, and its blank disks are what the +3's own `FORMAT` lays down. This also
fixes several faults: a double-sided disk from Create Disk came out single-sided; a +3 save could
land on the wrong sector of a CPC data-format disk, a disk with repeated sector IDs or one with
mixed sector sizes; disks with more than 42 tracks could not be opened; the disk viewer always
reported weak sectors; and every TR-DOS disk save on the Pentagon and Scorpion also reported
"Updating attached disk media failed".

---
type: feature
issues: [1432]
---
**TR-DOS disks on the Pentagon 128:** the Pentagon has the Beta 128 disk interface, with two
drives that take `.trd` and `.scl` images, and TR-DOS. Klive cannot ship the TR-DOS ROM, so name
your own 16K copy under **Settings › Machine › TR-DOS ROM**; without it the Pentagon runs without
its drives. **Machine › Disks** inserts, ejects and write-protects disks; TR-DOS writes go back
into `.trd` files, while an `.scl` is never changed (**Save Disk in Drive A as .trd...** keeps the
changes). **Create Disk File...** and `crd` (for example `crd trd80ds games`) make blank TR-DOS
disks, and **Boot Disk in Drive A** selects 48 BASIC, enters TR-DOS and runs the disk's `boot`
program. The debugger shows the TR-DOS ROM as partition `R2`, so `R2:$3D2F` stops only in TR-DOS.
`.szx` snapshots and state files keep the disk interface's state.

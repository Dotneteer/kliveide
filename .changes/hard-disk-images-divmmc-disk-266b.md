---
type: feature
---

**Hard-disk images and the DivMMC:** the Disk Explorer opens .img, .hdf and .cim hard-disk images and SD cards with FAT16 or FAT32 file systems: browse their folders and long file names, pick a partition, add files and whole folders as they are, save, rename and delete them, and see the volume's areas and a cluster map with the selected file's clusters outlined. The Next's SD card opens there too. The `disk` command and `klive disk` make (`new card.img fat16 64`), list and fill these images (`mkdir`, adding a folder). The ZX Spectrum 48K, 128K and +2A/+3 can have a DivMMC interface (Machine › SD Card › DivMMC Interface), which boots esxDOS from your own ROM (Settings › Machine › esxDOS ROM) and reads an .img, .hdf or .cim SD card; its NMI button is in the same menu, the debugger shows its ROM and RAM banks as memory partitions, and reverse debugging undoes the card writes it discards.

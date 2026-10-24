---
type: feature
---

**Disk Explorer:** .dsk (+3DOS), .trd and .scl (TR-DOS) disk images open as their files. List them,
preview BASIC listings, screens and code (as memory or disassembly), add files by dragging them from
the project explorer or the desktop (a .tap's files with their headers, a .scr as a screen, a .bas
text file tokenised, anything else as code), save them to the host, rename and delete them, set
+3DOS attributes, and compact a TR-DOS disk. The Layout view shows every track and sector coloured
by what it holds. A disk in the running machine's drive can be edited too: the machine pauses, the
disk is written and put back, and the machine runs on. The new `disk` command (`ls`, `info`, `add`,
`get`, `rm`, `mv`, `compact`, `new`) does the same from the command prompt and automation, and
`klive disk` does it headless on image files. Export Code (`expc -f dsk` or `-f trd`) writes a disk
that boots the program: the +3's Loader runs its DISK loader, and TR-DOS its boot loader.

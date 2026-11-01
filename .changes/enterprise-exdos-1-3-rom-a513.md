---
type: feature
---

**Enterprise EXDOS 1.3 ROM annotations:** the EXDOS disk ROM (segments 20h and 21h) is annotated, with a label on every call and jump target and a synopsis for each of its 1,055 labels: the extension's start-up and actions, the 31 EXDOS functions and the DISK and drive-letter devices, the FAT12 file system and its sector buffers, the floppy controller and RAM disk drivers, the format code, the Abort/Retry/Ignore prompt and the EXDOS commands and their interpreter. Segment 21h's English and German message tables are listed as text, and the byte that follows each call to segment 20h's workspace-word helper as data.

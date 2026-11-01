---
type: feature
---

**Enterprise 128 ROM annotations:** Klive now ships the first part of EXOS 2.1 annotated, its
segment 00h, with a label on every call and jump target, a synopsis for each of its 1,132 labels,
and its data regions: the start-up (ROM checksum, RAM test, ROM scan), the EXOS calls and their
dispatch, channels and memory allocation, module loading, and the built-in VIDEO, SOUND, KEYBOARD
and EDITOR devices with their control codes, escape sequences, tables and character set. The
segment reads by name in the Disassembly view whenever EXOS pages it in, and in the ROM annotation
editor. Every Enterprise ROM (EXOS 2.0 and 2.1, IS-BASIC, EXDOS) is now listed under Debug › ROM
Annotations, where the others can be annotated too.

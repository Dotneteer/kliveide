---
type: fix
---

Tapes: a `.cas` file was always read as an HT-1080Z tape. Opening a Videoton TVC tape in the IDE
showed "No HT-1080Z file follows the sync byte", and a TVC tape restored at startup was refused with
a message box even when the TVC was the current machine. The tape viewer now reads which machine's
tape a `.cas` is from its contents and shows TVC tapes with their headers, BASIC listing and code;
Run, Insert and Debug are enabled on that machine only; and a tape set before its machine is ready
goes into the deck when the machine starts. TVC tapes whose header record counts are wrong now load
too.

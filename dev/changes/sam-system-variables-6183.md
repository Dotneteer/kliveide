---
type: fix
---

SAM Coupé: the System Variables panel described ERR_NR as the error number minus one, BORDCR as the
border colour and COMSV as the MIDI input vector, and named two variables differently from the
Technical Manual. They now follow the manual and the ROM: ERRNR (was ERR_NR) holds the error number
itself, BORDCR the lower screen's attributes, COMSV the comms interrupt vector, and `$5C08` is RBHEAD
(was LAST_K). BORDCOL, the value sent to the border, is listed too.

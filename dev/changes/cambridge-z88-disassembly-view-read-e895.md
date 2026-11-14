---
type: fix
---

Cambridge Z88: the Disassembly view read the EXTCALL instruction (RST 28h, OZ 4.5 and later) as four
bytes instead of five, so it listed the instruction after every EXTCALL wrongly; and Export Disassembly
as Source failed to reassemble when an OS_Pout string held a quote or a backslash.

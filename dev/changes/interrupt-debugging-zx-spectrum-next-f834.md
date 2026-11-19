---
type: feature
---

**Interrupt debugging for the ZX Spectrum Next**: an Interrupts panel in the Machine info activity shows the daisy chain at a pause (which source is requesting, in service or held, each one's vector and handler) with diagnostics for the usual traps, such as a handler that ended with RETN or returned without EI; the Interrupt Timeline document draws the interrupt events of the last frames as swimlanes with each interrupt's latency; and interrupt stops (`bp-set int:ack:line`, or the Interrupt event type in the breakpoint dialog) pause the machine when an interrupt is taken, lost or kept waiting, when a handler's return releases nothing, or when an NMI is taken.

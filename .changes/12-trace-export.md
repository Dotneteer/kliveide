---
type: feature
issues: [1445]
---
**Trace export:** **Debug › Export Execution History...**, the Execution History's **Export**
button or `history-export` (`hexp`) saves a range of the history as a text or CSV trace. The
defaults suit diffing two runs: times are relative to the first row, the header has no export
time, and `-nointerrupts` leaves interrupt services out. The columns can be chosen, and CSV has
one column per register.

---
type: feature
issues: [1446]
---
**Automation:** with **Settings › General › Automation** on (it is off by default), scripts drive
the running Klive with `klive ide`: build, run and debug the project, wait for a stop, read and
write registers and memory, set breakpoints, take screenshots and, at the **Full** level, run any
IDE command. Any language can do the same through a local, token-authenticated JSON-RPC 2.0
protocol. Three permission levels (Read, Control, Full) limit what scripts may do, and an
**Automation** status bar item and output pane show the connected scripts and their calls.

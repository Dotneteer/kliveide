---
type: fix
---

Debugger: a BASIC watch expression using `MOD` with a negative operand showed a different result from the program's: `-100 MOD 3` was shown as -1, while the compiled program computes 1 (the remainder of the magnitudes). Watches now compute `MOD` as the program does.

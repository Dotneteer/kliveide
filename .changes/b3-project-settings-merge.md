---
type: fix
issues: [1463]
---
Settings: a nested setting in the project's settings hid the user's settings of the same group (a
project's `zxbasic.compiler` hid the user's `zxbasic.root`, for example). Project settings now
override user settings one key at a time.
